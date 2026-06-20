# apps/marriage-ai/dataflow/pipelines/streaming/transforms/next_question.py
import apache_beam as beam
import logging
import traceback
import json # Added for OpenAI JSON parsing
from datetime import datetime, timezone # Added timezone
from typing import List, Dict, Optional, Any, Tuple, Set # Added for type hints
from apache_beam.metrics import Metrics

# Import necessary clients and common definitions
from google.cloud import firestore
import openai
from google.protobuf import json_format
from google.protobuf.struct_pb2 import Value

# Import Vertex AI specific clients (using v1beta1 for Gemini 1.5 Pro)
try:
    from google.cloud.aiplatform_v1beta1.services.prediction_service import PredictionServiceClient
    from google.cloud.aiplatform_v1beta1.types import prediction_service
except ImportError:
    # Fallback or specific handling if v1beta1 is not available
    # For now, log and potentially raise later if needed during setup
    logging.warning("Could not import aiplatform_v1beta1. Ensure google-cloud-aiplatform>=1.49.0 is installed.")
    PredictionServiceClient = None # Define as None to handle checks later
    prediction_service = None

# Assuming common defines MetricNames, COLLECTIONS
# Might need access_secret from utils if API keys handled that way
from .common import MetricNames # Import COLLECTIONS from definitions instead
from ..common.definitions import COLLECTIONS # Import the central definition
from ..utils import access_secret # If API key fetched via secret manager
from ..utils.firestore_helpers import get_all_user_qas, get_match_qas, get_qas_by_tag # Added get_qas_by_tag
from ..utils.llm_helpers import parse_llm_json_output, construct_vertex_prompt # Added

logger = logging.getLogger(__name__)

# --- Configuration --- #
# TODO: Make these configurable (e.g., pipeline options or fetched config)
OPEN_CRITERIA_QUESTION_ID = "Q_OPEN_CRITERIA" # Keep if Layer 1 logic still needs it
# SEMANTIC_SIMILARITY_THRESHOLD = 0.7 # Not used when using OpenAI completion for relevance
# MAX_RECENT_ANSWERS_FOR_CONTEXT = 3 # May not be needed with candidate list approach
FOUNDATIONAL_LAYER = 2 # Define layer numbers
GENERAL_LAYER = 3
# TODO: Define OpenAI model names
OPENAI_COMPLETION_MODEL = "o1-mini" # Or gpt-4 etc.
OPENAI_API_KEY_SECRET = "OPENAI_API_KEY" # Name of the secret in Secret Manager

# Define a placeholder key question ID for comparison
KEY_QUESTION_FOR_COMPARISON = "L2_FAMILY_GOALS_01"

# Constants for LLM Analysis
CLUSTER_ANALYSIS_MODEL = "o1-mini" # Or another suitable model
MAX_CONTEXT_ANSWERS = 5 # How many answers to include in context for analysis

# Define constants if needed (e.g., for context prep)
MAX_CONTEXT_ANSWERS_PER_USER = 50 # Example limit for Q&A pairs per user in context

# Configuration Constants
DEFAULT_LAYER3_MODEL_NAME = "gemini-1.5-pro-001" # Explicitly using 1.5 Pro
MAX_MATCHES_FOR_CONTEXT = 5 # Max matches whose Q&A are *fetched* initially
ESTIMATED_TOKENS_PER_CHAR = 4
MAX_CONTEXT_TOKENS = 900_000
DEFAULT_LLM_TEMPERATURE = 0.7
DEFAULT_LLM_MAX_OUTPUT_TOKENS = 2048

# --- Constants for Layer 1 --- #
FIRST_OPEN_ENDED_QID = "Q_INITIAL_GOALS_OPEN" # ID of the first question that *starts* the sequence
DEFAULT_CLARIFICATION_TAG = "initial_goals" # The tag value used for the sequence
DEFAULT_LAYER1_MODEL_NAME = "gemini-1.0-pro"
DEFAULT_LAYER1_TEMPERATURE = 0.5
DEFAULT_LAYER1_MAX_OUTPUT_TOKENS = 512

# --- Layer Type Constants --- #
CLARIFICATION_LAYER = 1
FOUNDATIONAL_LAYER = 2
GENERAL_LAYER = 3
INSIGHT_LAYER = 4 # L4 Assessments
TOP_MATCH_LAYER = 5 # L5 Top Match Deep Dive

# --- Constants for Layer 4 --- #
DEFAULT_LAYER4_MODEL_NAME = "gemini-1.5-pro-001" # Needs strong reasoning
MIN_QAS_FOR_INSIGHT = 10 # Minimum Q&As before generating insight questions
DEFAULT_LAYER4_TEMPERATURE = 0.6
DEFAULT_LAYER4_MAX_OUTPUT_TOKENS = 1024

# --- Helper Functions (Potentially moved to utils later) --- #

def load_layer2_question_templates(project_id: str) -> Dict[str, Dict[str, Any]]:
    """Loads the Layer 2 question templates from Firestore.

    Returns:
        A dictionary mapping question_id to question template data (dict).
        Example: {"L2_FINANCES_01": {"id": "L2_FINANCES_01", "text": "...", "layer": 2, "priority": 1}}
    """
    logger.info("Loading Layer 2 question templates from Firestore...")
    db = firestore.Client(project=project_id)
    templates = {}
    try:
        collection_name = COLLECTIONS['MARRIAGE']['LAYER2_FOUNDATIONAL_QUESTIONS']
        docs = db.collection(collection_name).stream()
        for doc in docs:
            q_data = doc.to_dict()
            q_data['id'] = doc.id # Ensure ID is included
            # Basic validation
            if 'text' in q_data and isinstance(q_data.get('layer'), int) and q_data['layer'] == FOUNDATIONAL_LAYER:
                templates[doc.id] = q_data
            else:
                logger.warning(f"Skipping invalid Layer 2 template: {doc.id} - Data: {q_data}")

        logger.info(f"Loaded {len(templates)} Layer 2 question templates from '{collection_name}'.")
        # TODO: Add caching mechanism if this is too slow/expensive
        return templates
    except Exception as e:
        logger.error(f"Failed to load Layer 2 question templates: {e}", exc_info=True)
        # Surface setup-time template load failures with the owning DoFn name
        # so DLQ rows identify the active candidate-generation boundary.
        raise RuntimeError("Layer2CandidateDoFn setup failed") from e

def get_user_profile_and_answers(db: firestore.Client, user_id: str, profiles_collection: str) -> Tuple[Optional[Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    """Fetches user profile and their answered questions from the QAS collection.

    Returns:
        A tuple: (profile_dict or None, answered_q_data_map).
        answered_q_data_map example: {"Q1": {"answer": "...", "layer": 2, "createdAt": ...}, ...}
    """
    try:
        # Fetch profile (adjust collection name if needed)
        # Assuming profile lives in USERS/USER_INFO for now
        profile_ref = db.collection(COLLECTIONS['USERS']['USER_INFO']).document(user_id)
        profile_doc = profile_ref.get()
        profile_data = profile_doc.to_dict() if profile_doc.exists else None
        if profile_data is None:
            logger.warning(f"User profile not found: {user_id} in {COLLECTIONS['USERS']['USER_INFO']}")
            # Depending on pipeline logic, might continue without profile or fail

        # Fetch answers from the dedicated QAS collection in MARRIAGE DB
        answers_map = {}
        qas_collection_name = COLLECTIONS['MARRIAGE']['QAS']
        qas_doc_ref = db.collection(qas_collection_name).document(user_id)
        qas_doc = qas_doc_ref.get()

        if qas_doc.exists:
            qas_data = qas_doc.to_dict()
            answers_map = qas_data.get("questions", {})
            if not isinstance(answers_map, dict):
                logger.warning(f"User {user_id} questions field in {qas_collection_name} is not a dict: {type(answers_map)}. Returning empty answers.")
                answers_map = {}
        else:
            logger.info(f"No QAS document found for user {user_id} in {qas_collection_name}. Assuming no answers yet.")

        return profile_data, answers_map
    except Exception as e:
        logger.error(f"Failed to fetch profile/answers for {user_id}: {e}", exc_info=True)
        # Return None/empty on error to allow potential DLQ handling upstream
        return None, {}


# --- Candidate Generation DoFns --- #

class Layer2CandidateDoFn(beam.DoFn):
    """Generates candidate Layer 2 (Foundational) questions for a user."""
    OUTPUT_ERROR_TAG = 'errors'

    def __init__(self, project_id: str, profiles_collection: str):
        self.project_id = project_id
        self.profiles_collection = profiles_collection # Used by helper
        self._layer2_templates = None
        self._db = None
        self.setup_error_message = None

    def setup(self):
        logger.info("Setting up Layer2CandidateDoFn...")
        try:
            self._db = firestore.Client(project=self.project_id)
            # Load templates once per worker
            self._layer2_templates = load_layer2_question_templates(self.project_id)
            if not self._layer2_templates:
                raise RuntimeError("Layer2CandidateDoFn setup failed")
            self.setup_error_message = None
            logger.info("Layer2CandidateDoFn setup complete.")
        except Exception as e:
            error_message = str(e)
            self.setup_error_message = (
                error_message
                if error_message.startswith("Layer2CandidateDoFn setup failed")
                else f"Layer2CandidateDoFn setup failed: {e}"
            )
            logger.error(self.setup_error_message, exc_info=True)

    def process(self, element: Dict[str, Any]):
        # Expects element containing at least 'user_id'
        if not self._db or not self._layer2_templates:
             error_message = self.setup_error_message or "Layer2CandidateDoFn setup failed"
             logger.error("%s. Skipping element.", error_message)
             Metrics.counter(self.__class__.__name__, MetricNames.ERRORS).inc()
             yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': error_message, 'element': element})
             return

        user_id = element.get('user_id')
        if not user_id:
            logger.warning(f"Missing user_id in element: {element}")
            Metrics.counter(self.__class__.__name__, MetricNames.MISSING_USER_ID).inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': 'Missing user_id', 'element': element})
            return

        try:
            logger.info(f"Generating Layer 2 candidates for user: {user_id}")
            _profile_data, answered_q_data = get_user_profile_and_answers(self._db, user_id, self.profiles_collection)
            answered_q_ids = set(answered_q_data.keys())

            candidate_templates = [
                template for q_id, template in self._layer2_templates.items()
                if q_id not in answered_q_ids
            ]

            candidate_templates.sort(key=lambda t: t.get('priority', 0))

            logger.info(f"Found {len(candidate_templates)} Layer 2 candidates for {user_id}.")
            Metrics.counter(self.__class__.__name__, 'candidates_generated').inc(len(candidate_templates))
            yield {
                'user_id': user_id,
                'layer': FOUNDATIONAL_LAYER,
                'candidates': candidate_templates # List of dicts
            }

        except Exception as e:
            logger.error(f"Error in Layer2CandidateDoFn for user {user_id}: {e}", exc_info=True)
            Metrics.counter(self.__class__.__name__, MetricNames.ERRORS).inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': str(e), 'user_id': user_id, 'trace': traceback.format_exc()})


class Layer3CandidateDoFn(beam.DoFn):
    """
    Generates Layer 3 (General/Cluster - Semantic Gap) question candidates
    if no Layer 2 candidates are found. Uses a single LLM call for analysis
    and generation based on user Q&A and filtered match Q&A.
    """
    OUTPUT_CANDIDATES_TAG = 'layer3_candidates'
    OUTPUT_ERROR_TAG = 'errors'

    def __init__(self,
                 project_id: str,
                 location: str,
                 model_name: str = DEFAULT_LAYER3_MODEL_NAME,
                 profiles_collection: str = COLLECTIONS['USERS']['USER_INFO'],
                 qa_collection_name: str = COLLECTIONS['MARRIAGE']['QAS'],
                 max_matches_context: int = MAX_MATCHES_FOR_CONTEXT,
                 tokens_per_char: int = ESTIMATED_TOKENS_PER_CHAR,
                 max_context_tokens: int = MAX_CONTEXT_TOKENS
                ):
        self.project_id = project_id
        self.location = location
        self.model_name = model_name
        self.profiles_collection = profiles_collection
        self.qa_collection_name = qa_collection_name
        self.max_matches_context = max_matches_context # Max to fetch initially
        self.tokens_per_char = tokens_per_char
        self.max_context_tokens = max_context_tokens
        self.logger = logging.getLogger(__name__)
        self.db = None
        self.prediction_client = None
        self.model_endpoint = None
        self.setup_error_message = None

    def setup(self):
        try:
            from google.cloud import firestore
            from google.cloud.aiplatform_v1beta1.services.prediction_service import PredictionServiceClient
            from google.cloud.aiplatform_v1beta1.types import prediction_service

            self.db = firestore.Client(project=self.project_id)
            client_options = {"api_endpoint": f"{self.location}-aiplatform.googleapis.com"}
            self.prediction_client = PredictionServiceClient(client_options=client_options)
            self.model_endpoint = (
                f"projects/{self.project_id}/locations/{self.location}/"f"publishers/google/models/{self.model_name}"
            )
            self.setup_error_message = None
            self.logger.info(f"Layer3CandidateDoFn setup complete (Firestore, Vertex AI Endpoint: {self.model_endpoint})")
        except ImportError as e:
            self.setup_error_message = f"Layer3CandidateDoFn setup failed: missing aiplatform v1beta1 library: {e}"
            self.logger.error(self.setup_error_message, exc_info=True)
        except Exception as e:
            self.setup_error_message = f"Layer3CandidateDoFn setup failed: {e}"
            self.logger.error(self.setup_error_message, exc_info=True)

    def _prepare_analysis_context(self,
                                  user_id: str,
                                  user_qas: Dict[str, Dict],
                                  match_qas: Dict[str, Dict], # All initially *fetched* match QAs
                                  original_matches_list: List[Dict], # Needed to know score order
                                  num_matches_to_use: Optional[int] = None
                                 ) -> Tuple[str, int]:
        """
        Prepares the combined context string (JSON) for the LLM and estimates token count.
        Optionally limits the number of *matches* whose Q&A are included in the context.

        Args:
            user_id: The primary user's ID.
            user_qas: Dictionary of the user's QA data.
            match_qas: Dictionary of *all fetched* match QA data {match_user_id: {qa_id: {...}}}.
            original_matches_list: The original list of matches [{id:..., score:...}] sorted by score.
            num_matches_to_use: If set, limits the number of matches included based on original_matches_list order.

        Returns:
            A tuple containing the JSON context string and estimated token count.
        """
        reduced_match_qas = {}
        included_match_ids = set(match_qas.keys()) # Start with all fetched matches

        if num_matches_to_use is not None and num_matches_to_use < len(original_matches_list):
            # Get the IDs of the top N matches from the original sorted list
            top_match_ids = {m['id'] for m in original_matches_list[:num_matches_to_use] if 'id' in m}
            # Filter the fetched QAs to include only these top matches
            reduced_match_qas = {mid: qas for mid, qas in match_qas.items() if mid in top_match_ids}
            included_match_ids = top_match_ids
            self.logger.debug(f"User {user_id}: Reducing context to use top {num_matches_to_use} matches.")
        else:
            # Use all fetched match QAs
            reduced_match_qas = match_qas
            num_matches_to_use = len(included_match_ids) # Actual number used

        context_data = {
            "primary_user_id": user_id,
            "primary_user_qa": user_qas,
            "matched_users_qa": reduced_match_qas # Potentially reduced set of matches
        }
        try:
            context_string = json.dumps(context_data, indent=2)
            estimated_tokens = len(context_string) // self.tokens_per_char
            token_info = f"Estimated tokens: {estimated_tokens} (Length: {len(context_string)})"
            token_info += f" [Using QAs from {len(reduced_match_qas)}/{len(match_qas)} fetched matches]"
            self.logger.debug(f"User {user_id}: Prepared Layer 3 context. {token_info}")
            return context_string, estimated_tokens
        except TypeError as e:
            self.logger.error(f"Error serializing context for user {user_id}: {e}", exc_info=True)
            return json.dumps({"error": "context_serialization_failed"}), 0
        except Exception as e:
            self.logger.error(f"Unexpected error preparing context for user {user_id}: {e}", exc_info=True)
            return json.dumps({"error": "unexpected_context_preparation_error"}), 0

    def _call_llm_for_analysis_and_candidates(self, user_id: str, user_qas: Dict, match_qas: Dict, original_matches_list: List[Dict]) -> List[Dict]:
        """
        Calls the LLM with the combined context, applying token reduction by reducing
        the number of matches included if needed. Uses Gemini API via PredictionServiceClient.
        """
        if not self.prediction_client or not self.model_endpoint:
            error_message = self.setup_error_message or "Layer3CandidateDoFn setup failed"
            if not self.setup_error_message:
                self.setup_error_message = error_message
            self.logger.error("%s. Cannot generate Layer 3 candidates for user %s.", error_message, user_id)
            Metrics.counter(self.__class__.__name__, MetricNames.ERRORS).inc()
            return []

        # 1. Prepare Initial Context & Estimate Tokens (using all *fetched* match QAs)
        initial_num_matches = len(match_qas)
        analysis_context_str, estimated_tokens = self._prepare_analysis_context(
            user_id, user_qas, match_qas, original_matches_list, num_matches_to_use=initial_num_matches
        )

        if estimated_tokens == 0 and "error" in analysis_context_str:
            self.logger.error(f"Skipping LLM call for user {user_id} due to context preparation error.")
            Metrics.counter(self.__class__.__name__, MetricNames.ERRORS).inc()
            return []

        self.logger.info(f"User {user_id}: Initial estimated context tokens: {estimated_tokens} (using {initial_num_matches} matches)")
        Metrics.distribution(self.__class__.__name__, 'layer3_initial_estimated_tokens').update(estimated_tokens)
        Metrics.distribution(self.__class__.__name__, 'layer3_initial_num_matches').update(initial_num_matches)

        # 2. Apply Token Reduction Strategy if Needed (reduce number of matches)
        applied_reduction_level = None # Tracks the number of matches used

        if estimated_tokens > self.max_context_tokens:
            self.logger.warning(f"User {user_id}: Initial context ({estimated_tokens} tokens) exceeds limit ({self.max_context_tokens}). Applying reduction by removing matches.")
            Metrics.counter(self.__class__.__name__, 'layer3_token_reduction_triggered').inc()

            reduction_successful = False
            # Try reducing number of matches from max-1 down to 1
            for num_matches_to_try in range(initial_num_matches - 1, 0, -1):
                temp_context_str, temp_estimated_tokens = self._prepare_analysis_context(
                    user_id, user_qas, match_qas, original_matches_list, num_matches_to_use=num_matches_to_try
                )
                self.logger.info(f"User {user_id}: Trying reduction with top {num_matches_to_try} matches. Estimated tokens: {temp_estimated_tokens}")
                if temp_estimated_tokens <= self.max_context_tokens:
                    analysis_context_str = temp_context_str
                    estimated_tokens = temp_estimated_tokens
                    applied_reduction_level = num_matches_to_try
                    reduction_successful = True
                    self.logger.info(f"User {user_id}: Reduction successful. Using top {num_matches_to_try} matches. Final estimated tokens: {estimated_tokens}")
                    break # Stop at the first successful reduction level

            if not reduction_successful:
                self.logger.error(f"User {user_id}: Context still too large ({estimated_tokens} tokens) even after reducing to 1 match. Skipping LLM call.")
                Metrics.counter(self.__class__.__name__, 'layer3_token_reduction_failed').inc()
                return [] # Cannot proceed

        # Log final estimated tokens and number of matches used
        final_num_matches = applied_reduction_level if applied_reduction_level is not None else initial_num_matches
        self.logger.info(f"User {user_id}: Final estimated context tokens for LLM call: {estimated_tokens} (using {final_num_matches} matches)")
        Metrics.distribution(self.__class__.__name__, 'layer3_final_estimated_tokens').update(estimated_tokens)
        Metrics.distribution(self.__class__.__name__, 'layer3_final_num_matches').update(final_num_matches)
        if applied_reduction_level is not None:
             Metrics.counter(self.__class__.__name__, f'layer3_reduction_num_matches_{applied_reduction_level}_applied').inc()

        # 3. Construct Prompt (Using final analysis_context_str)
        # System instruction is refined based on user feedback
        system_instruction=(
            "You are an AI assistant helping a user build their relationship profile by suggesting relevant questions. "
            "Analyze the provided JSON context containing the primary user's answers ('primary_user_qa') "
            "and answers from similar matched users ('matched_users_qa').\n\n"
            "**Your Core Task:** Identify key topics or themes relevant to relationships that meet **BOTH** of the following criteria:\n"
            "1. The topic is clearly discussed or represented in the answers of **ALL** the users listed under 'matched_users_qa'.\n"
            "2. The topic appears significantly under-explored (e.g., answered very briefly or vaguely compared to matches) or entirely missing in the 'primary_user_qa'.\n\n"
            "**Generation Goal:** Based *only* on these identified 'universal gaps', generate 3 to 5 diverse, open-ended profile questions. These questions should directly help the primary user elaborate on those specific under-explored areas identified.\n\n"
            "**Important Constraints:**\n"
            "- Focus on questions that encourage deeper reflection relevant to relationships (values, communication, goals, lifestyle, etc.).\n"
            "- Ensure the generated questions explore new ground and do not closely repeat the topics already covered thoroughly in the `primary_user_qa`.\n\n"
            "**Output Format:**\n"
            "- Respond ONLY with a valid JSON list containing objects.\n"
            "- Each object must have exactly two keys: 'question_text' (string) and 'reasoning' (string, explaining which universal gap the question addresses).\n"
            "- Do not include any text before or after the JSON list.\n"
            "- If your analysis finds no topics satisfying BOTH criteria above (i.e., no universal gaps found), respond ONLY with an empty JSON list `[]`.\n\n"
            "**Example Output (Success):**\n"
            '[{"question_text": "How do you typically navigate disagreements about future goals with a partner?", "reasoning": "Addresses the universal gap in discussing conflict resolution strategies, present in all matches but lacking detail in primary user."}, {"question_text": "What role does shared humor play in your ideal relationship?", "reasoning": "Targets the universally discussed theme of humor and connection, which was under-explored by the primary user."}]\n\n'
            "**Example Output (No Gaps Found):**\n"
            '[]'
        )
        user_input = f"Analyze the following profile data and generate questions based on semantic gaps:\n```json\n{analysis_context_str}\n```"

        prompt_instance = {
            "contents": [
                {"role": "user", "parts": [{"text": system_instruction}]},
                {"role": "model", "parts": [{"text": "Okay, I understand. Provide the JSON data."}]},
                {"role": "user", "parts": [{"text": user_input}]}
            ]
        }

        # 4. Call Vertex AI Gemini Model (Request/Response handling remains the same)
        try:
            request = prediction_service.PredictRequest(
                endpoint=self.model_endpoint,
                instances=[json_format.ParseDict(prompt_instance, Value())],
                parameters=json_format.ParseDict({
                    "temperature": DEFAULT_LLM_TEMPERATURE,
                    "maxOutputTokens": DEFAULT_LLM_MAX_OUTPUT_TOKENS,
                }, Value())
            )
            response = self.prediction_client.predict(request=request)

            # Process response (remains the same)
            if not response.predictions:
                self.logger.warning(f"LLM call for Layer 3 (user {user_id}) returned no predictions.")
                Metrics.counter(self.__class__.__name__, MetricNames.LLM_ERRORS).inc()
                return []

            prediction_result = json_format.MessageToDict(response.predictions[0])
            candidates_list = prediction_result.get('candidates', [])
            raw_output = ""
            if candidates_list and isinstance(candidates_list, list) and len(candidates_list) > 0:
                 content = candidates_list[0].get('content', {})
                 parts = content.get('parts', [])
                 if parts and isinstance(parts, list) and len(parts) > 0:
                      raw_output = parts[0].get('text', '')
            elif 'content' in prediction_result:
                 raw_output = prediction_result.get('content', '')

            if not raw_output:
                self.logger.warning(f"LLM call for Layer 3 (user {user_id}) returned empty content in prediction structure: {prediction_result}")
                Metrics.counter(self.__class__.__name__, MetricNames.LLM_ERRORS).inc()
                return []

            # 5. Parse LLM Output (remains the same)
            candidates = parse_llm_json_output(raw_output, self.logger, f"Layer 3 LLM (user {user_id})")
            valid_candidates = []
            if isinstance(candidates, list):
                for cand in candidates:
                    if isinstance(cand, dict) and 'question_text' in cand and 'reasoning' in cand:
                        valid_candidates.append(cand)
                else:
                        self.logger.warning(f"Invalid candidate structure from Layer 3 LLM for user {user_id}: {cand}")
            else:
                self.logger.warning(f"Layer 3 LLM output for user {user_id} was not a list after parsing: {type(candidates)}")

            Metrics.counter(self.__class__.__name__, 'layer3_candidates_generated').inc(len(valid_candidates))
            self.logger.info(f"Generated {len(valid_candidates)} valid Layer 3 candidates for user {user_id}.")
            return valid_candidates

        except Exception as e:
            self.logger.error(f"Error calling/parsing Layer 3 LLM for user {user_id}: {e}", exc_info=True)
            Metrics.counter(self.__class__.__name__, MetricNames.LLM_ERRORS).inc()
            return []

    def process(self, element: Dict[str, Any]):
        user_id = element.get('user_id')
        matches = element.get('matches', []) # Original filtered matches list [{id:..., score:...}]

        if not user_id:
            self.logger.error("Layer3CandidateDoFn received element without user_id.")
            Metrics.counter(self.__class__.__name__, MetricNames.ERRORS).inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': 'Missing user_id', 'element': element})
            return

        if not self.db or not self.prediction_client or not self.model_endpoint:
             error_message = self.setup_error_message or "Layer3CandidateDoFn setup failed"
             self.logger.error("%s. Skipping.", error_message)
             Metrics.counter(self.__class__.__name__, MetricNames.ERRORS).inc()
             yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': error_message, 'user_id': user_id})
             return

        try:
            # 1. Fetch User's Q&A
            user_qas = get_all_user_qas(self.db, self.qa_collection_name, user_id, self.logger)
            if not user_qas:
                self.logger.warning(f"No Q&A found for user {user_id}. Cannot generate Layer 3 candidates.")
                yield beam.pvalue.TaggedOutput(self.OUTPUT_CANDIDATES_TAG, (user_id, []))
                return

            # 2. Fetch Q&A for top N filtered matches (up to max_matches_context)
            match_ids_to_fetch = [m['id'] for m in matches[:self.max_matches_context] if isinstance(m, dict) and 'id' in m]
            match_qas = {} # Dictionary {match_id: {qa_id: {...}}} containing QAs for *fetched* matches
            if match_ids_to_fetch:
                match_qas = get_match_qas(self.db, self.qa_collection_name, match_ids_to_fetch, self.logger)
            else:
                 self.logger.info(f"No filtered matches provided for user {user_id}. Layer 3 analysis skipped.")
                 yield beam.pvalue.TaggedOutput(self.OUTPUT_CANDIDATES_TAG, (user_id, [])) # Yield empty if no matches
                 return

            # If match_qas is empty even after fetching, skip LLM call
            if not match_qas:
                self.logger.warning(f"No Q&A data found for any of the top {len(match_ids_to_fetch)} matches for user {user_id}. Skipping Layer 3 LLM call.")
                yield beam.pvalue.TaggedOutput(self.OUTPUT_CANDIDATES_TAG, (user_id, []))
                return

            # 3. Call LLM for Analysis & Candidate Generation (Pass original matches list)
            layer3_candidates = self._call_llm_for_analysis_and_candidates(user_id, user_qas, match_qas, matches)

            # 4. Format and Yield Output
            output_candidates = [
                {**cand, 'layer': 3, 'candidate_source': 'llm_semantic_gap'}
                for cand in layer3_candidates
            ]
            yield beam.pvalue.TaggedOutput(self.OUTPUT_CANDIDATES_TAG, (user_id, output_candidates))

        except Exception as e:
            self.logger.error(f"Error in Layer3CandidateDoFn process for user {user_id}: {e}", exc_info=True)
            Metrics.counter(self.__class__.__name__, MetricNames.ERRORS).inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': str(e), 'user_id': user_id})
            yield beam.pvalue.TaggedOutput(self.OUTPUT_CANDIDATES_TAG, (user_id, []))


# --- Selection and Update DoFns --- #

class SelectBestQuestionDoFn(beam.DoFn):
    """Selects the best question using a single LLM call based on history and priorities."""
    OUTPUT_ERROR_TAG = 'errors'
    # Input Tags from CoGroupByKey
    LAYER1_TAG = Layer1CandidateDoFn.OUTPUT_CANDIDATES_TAG
    LAYER2_TAG = Layer2CandidateDoFn.__name__
    LAYER3_TAG = Layer3CandidateDoFn.OUTPUT_CANDIDATES_TAG
    LAYER4_TAG = Layer4CandidateDoFn.OUTPUT_CANDIDATES_TAG
    HISTORY_TAG = FetchUserHistoryDoFn.HISTORY_TAG
    # Add tag for reranking results
    DEFAULT_RERANKING_TAG = 'reranking_results' # Default tag name

    def __init__(self,
                 project_id: str,
                 location: str,
                 selector_model_name: str = DEFAULT_SELECTOR_MODEL_NAME,
                 selector_temp: float = DEFAULT_SELECTOR_TEMPERATURE,
                 selector_max_tokens: int = DEFAULT_SELECTOR_MAX_TOKENS,
                 reranking_results_tag: str = DEFAULT_RERANKING_TAG # Accept tag name
                ):
        self.project_id = project_id
        self.location = location
        self.selector_model_name = selector_model_name
        self.selector_temp = selector_temp
        self.selector_max_tokens = selector_max_tokens
        self.reranking_results_tag = reranking_results_tag # Store the tag name
        self.logger = logging.getLogger(__name__)
        self.prediction_client = None
        self.selector_model_endpoint = None
        self.setup_error_message = None
        # Counters
        self.llm_selection_calls = Metrics.counter(self.__class__.__name__, 'llm_selection_calls')
        self.llm_selection_errors = Metrics.counter(self.__class__.__name__, 'llm_selection_errors')
        self.no_candidates_counter = Metrics.counter(self.__class__.__name__, 'no_candidates_found')
        self.layer5_candidates_generated = Metrics.counter(self.__class__.__name__, 'layer5_candidates_generated')

    def setup(self):
        # Setup PredictionServiceClient (remains the same)
        try:
            client_options = {"api_endpoint": f"{self.location}-aiplatform.googleapis.com"}
            # Use the correct client based on imports (v1beta1 if needed)
            if PredictionServiceClient:
                self.prediction_client = PredictionServiceClient(client_options=client_options)
                self.selector_model_endpoint = (
                    f"projects/{self.project_id}/locations/{self.location}/"f"publishers/google/models/{self.selector_model_name}"
                )
                self.setup_error_message = None
                self.logger.info(f"SelectBestQuestionDoFn: Prediction client initialized. Selector Endpoint: {self.selector_model_endpoint}")
            else:
                 self.setup_error_message = "SelectBestQuestionDoFn setup failed: PredictionServiceClient not available"
                 self.logger.error(self.setup_error_message)
        except Exception as e:
             self.setup_error_message = f"SelectBestQuestionDoFn setup failed: {e}"
             self.logger.error(self.setup_error_message, exc_info=True)

    def _format_candidates_for_prompt(self, candidates: List[Dict]) -> str:
        "Formats the candidate list with priorities for the LLM prompt."""
        formatted_list = []
        for i, cand in enumerate(candidates):
            # Ensure candidate has necessary fields
            text = cand.get('text') or cand.get('question_text', '')
            layer = cand.get('layer')
            priority_tuple = _get_candidate_priority(cand)
            reasoning = cand.get('reasoning', '')
            cand_id = cand.get('id')
            framework = cand.get('framework')

            if not text: continue

            entry = f"Candidate {i+1}:\n"
            entry += f"  Text: {text}\n"
            entry += f"  Layer: {layer}"
            if layer == TOP_MATCH_LAYER:
                 entry += " (Top Match Deep Dive)"
            entry += "\n"
            if framework: # Add framework info for Layer 4
                 entry += f"  Framework: {framework}\n"
            entry += f"  Priority Score: {priority_tuple} (Layer Rank {priority_tuple[0]}, Internal {priority_tuple[1]}; Lower is higher priority)\n"
            if reasoning:
                entry += f"  Reasoning: {reasoning}\n"
            if cand_id:
                entry += f"  ID: {cand_id}\n"
            formatted_list.append(entry)
        return "\n".join(formatted_list) if formatted_list else "No candidate questions available."

    def _format_history_for_prompt(self, history: List[Dict]) -> str:
        "Formats the user's Q&A history (sorted recent first) for the LLM prompt."""
        if not history:
            return "User has no Q&A history yet."

        # History should already be sorted by FetchUserHistoryDoFn or here
        try:
            default_ts = datetime.min.replace(tzinfo=timezone.utc)
            history.sort(key=lambda qa: qa.get('createdAt', default_ts), reverse=True)
        except Exception as sort_err:
            self.logger.error(f"SelectBest: Failed to sort Q&A history for prompt: {sort_err}. Proceeding unsorted.")

        formatted_list = []
        # Limit history length for prompt if necessary? Currently using full history.
        MAX_HISTORY_ITEMS_FOR_PROMPT = 20 # Example limit
        for i, qa in enumerate(history[:MAX_HISTORY_ITEMS_FOR_PROMPT]):
            q_text = qa.get('question', '[Question Missing]')
            a_text = qa.get('answer', '[Answer Missing]')
            entry = f"History Item {i+1} (Most Recent = 1):\n"
            entry += f"  Q: {q_text}\n"
            entry += f"  A: {a_text}\n"
            formatted_list.append(entry)
        if len(history) > MAX_HISTORY_ITEMS_FOR_PROMPT:
            formatted_list.append(f"(... {len(history) - MAX_HISTORY_ITEMS_FOR_PROMPT} older history items omitted ...)")
        return "\n".join(formatted_list)

    def _call_llm_selector(self, user_id: str, formatted_history: str, formatted_candidates: str) -> Optional[str]:
        """Calls the LLM to select the best question."""
        if not self.prediction_client or not self.selector_model_endpoint:
            error_message = self.setup_error_message or "SelectBestQuestionDoFn setup failed"
            if not self.setup_error_message:
                self.setup_error_message = error_message
            self.logger.error("%s. Cannot select question for user %s.", error_message, user_id)
            self.llm_selection_errors.inc()
            return None

        system_instruction = (
            "You are an AI assistant tasked with selecting the single best next question for a user building their relationship profile. "
            "You will be given the user's recent Q&A history and a list of potential candidate questions from different sources (layers)."
        )
        user_prompt = (
            f"## User Q&A History (Most Recent First):\n{formatted_history}\n\n"
            f"## Candidate Questions (Prioritized - Lower Score = Higher Priority):\n{formatted_candidates}\n\n"
            f"## Candidate Layers Explained:\n"
            f"- Layer 1 (Clarification): Follow-up questions to clarify recent answers in specific sequences. Highest priority if ambiguity exists.\n"
            f"- Layer 5 (Top Match Deep Dive): Questions generated by comparing the user to their current top match, designed to explore compatibility further. High priority for engagement.\n"
            f"- Layer 2 (Foundational): Predefined core questions about relationship topics. Ensures core profile is built.\n"
            f"- Layer 4 (Assessments): Structured questions from established frameworks (e.g., Attachment Styles). Provides deeper insights after foundation.\n"
            f"- Layer 3 (General/Semantic Gap): AI-generated questions targeting under-explored topics compared to similar profiles. Fills broader gaps.\n\n"
            f"## Your Task:\n"
            f"Based on the user's history and the available candidates, select the **single best question** to ask next. Consider these factors IN ORDER:\n"
            f"1. **Layer 1 (Clarification):** If a Layer 1 question exists AND the most recent history strongly suggests clarification is needed, SELECT IT.\n"
            f"2. **Layer 5 (Top Match):** If no critical clarification is needed, AND a Layer 5 question exists, it is STRONGLY PREFERRED to maintain engagement related to matching.\n"
            f"3. **Relevance & Flow:** If multiple non-L1/L5 candidates remain, prefer questions that naturally follow up on or are semantically related to the **most recent** Q&A history items. Avoid abrupt topic changes.\n"
            f"4. **Priority Score:** If multiple questions still seem suitable (or none seem particularly relevant), choose the candidate with the **lowest overall priority score number** (which already incorporates the L1 > L5 > L2 > L4 > L3 layer order).\n"
            f"5. **Purpose:** Briefly consider the goal of each layer as described above when making the final choice among tied priorities.\n\n"
            f"**Output Format:** Respond ONLY with the exact text of the single candidate question you select. Do not add any explanation, greetings, or formatting other than the question text itself.\n"
            f"Selected Question Text:"
        )

        prompt_instance = construct_vertex_prompt(system_instruction, user_prompt)
        # ... (Rest of LLM call and response parsing remains the same) ...
        # ... (try/except block) ...
        try:
            if not prediction_service:
                raise RuntimeError("prediction_service types not imported correctly.")
            request = prediction_service.PredictRequest(
                endpoint=self.selector_model_endpoint,
                instances=[json_format.ParseDict(prompt_instance, Value())],
                parameters=json_format.ParseDict({
                    "temperature": self.selector_temp,
                    "maxOutputTokens": self.selector_max_tokens,
                }, Value())
            )
            response = self.prediction_client.predict(request=request)
            # ... (response parsing logic) ...
            # ... 
            prediction_result = json_format.MessageToDict(response.predictions[0])
            content = prediction_result.get('content')
            raw_output = ""
            if content and isinstance(content, dict):
                parts = content.get('parts')
                if parts and isinstance(parts, list) and len(parts) > 0 and isinstance(parts[0], dict):
                    raw_output = parts[0].get('text', '')
            elif 'candidates' in prediction_result:
                pass # Add pass to satisfy indentation if fallback logic is complex/unused for now
                # candidates_list = prediction_result.get('candidates', [])
                # ... (rest of fallback parsing)
            selected_text = raw_output.strip()
            # ... (validation)
            return selected_text
        except Exception as e:
            # ... (error logging) ...
            return None

    def process(self, element: Tuple[str, Dict[str, List[Any]]]):
        user_id, grouped_data = element
        selected_question_dict = None
        candidate_count = 0
        self.logger.info(f"SelectBest: Processing user {user_id}. Available data tags: {list(grouped_data.keys())}")

        try:
            # --- Extract Candidates and History --- #
            def extract_candidates_from_group(tag: str, group_dict: Dict) -> List[Dict]:
                # ... (implementation as before) ...
                results = group_dict.get(tag, [])
                if results and isinstance(results, list) and isinstance(results[0], tuple) and len(results[0]) == 2:
                    # Handles L1, L3, L4, History which are tuples (user_id, list)
                    data_list = results[0][1]
                    if isinstance(data_list, list):
                        return [item for item in data_list if isinstance(item, dict)]
                elif results and isinstance(results, list) and isinstance(results[0], dict):
                    # Handles L2, Reranking which might be just the list/dict directly
                    if tag == Layer2CandidateDoFn.__name__:
                        # L2 output is {'user_id': ..., 'candidates': [...]}
                        # We keyed it in streaming.py, so it *should* be [(user_id, list)] now.
                        # Add defensive check if structure is different.
                        if isinstance(results[0], tuple) and len(results[0]) == 2: 
                           data_list = results[0][1]
                           if isinstance(data_list, list): return [item for item in data_list if isinstance(item, dict)]
                        else: 
                           self.logger.warning(f"SelectBest ({user_id}): Unexpected structure for L2 tag '{tag}': {type(results[0])}")
                    elif tag == self.reranking_results_tag:
                         # Reranking output is {'user_id': ..., 'ranked_matches': ..., ...}
                         # We keyed it in streaming.py, so results[0] is the dict
                         return results # Return the list containing the single result dict
                elif results:
                     self.logger.warning(f"SelectBest ({user_id}): Unexpected data structure for tag '{tag}': {results}")
                return []

            layer1_candidates = extract_candidates_from_group(self.LAYER1_TAG, grouped_data)
            layer2_candidates = extract_candidates_from_group(self.LAYER2_TAG, grouped_data)
            layer3_candidates = extract_candidates_from_group(self.LAYER3_TAG, grouped_data)
            layer4_candidates = extract_candidates_from_group(self.LAYER4_TAG, grouped_data)
            user_history = extract_candidates_from_group(self.HISTORY_TAG, grouped_data)
            reranking_results_list = extract_candidates_from_group(self.reranking_results_tag, grouped_data)

            all_candidates = layer1_candidates + layer2_candidates + layer3_candidates + layer4_candidates

            # --- Generate Layer 5 Candidate --- #
            layer5_candidates = []
            if reranking_results_list and isinstance(reranking_results_list, list) and len(reranking_results_list) > 0:
                reranking_data = reranking_results_list[0] # Get the first (and only) element from the flattened input
                if isinstance(reranking_data, dict):
                    matches_list = reranking_data.get('matches', []) # Correct key for the list of match objects
                    
                    if matches_list and isinstance(matches_list, list) and len(matches_list) > 0:
                        top_match = matches_list[0] # Get the actual top match dictionary
                        if isinstance(top_match, dict):
                            suggested_questions = top_match.get('suggested_questions', []) # This is List[str]

                            if suggested_questions and isinstance(suggested_questions, list) and len(suggested_questions) > 0:
                                l5_text = suggested_questions[0] # Take the first suggested question
                                if isinstance(l5_text, str) and l5_text.strip(): # Ensure it's a non-empty string
                                    l5_candidate = {
                                        'question_text': l5_text,
                                        'text': l5_text, # Ensure 'text' field is present for _format_candidates_for_prompt
                                        'layer': TOP_MATCH_LAYER,
                                        'reasoning': f"Explore compatibility with top match ({top_match.get('match_id', 'Unknown')}) based on reranking insight.",
                                        'candidate_source': 'reranking_top_match_suggestion',
                                        'id': f"L5_{user_id}_{top_match.get('match_id', 'NOMA')}_{datetime.now().strftime('%H%M%S')}"
                                    }
                                    layer5_candidates.append(l5_candidate)
                                    self.layer5_candidates_generated.inc()
                                    self.logger.info(f"SelectBest ({user_id}): Generated Layer 5 candidate: {l5_text[:50]}...")
                                else:
                                    self.logger.warning(f"SelectBest ({user_id}): Top match suggested_questions[0] is not a valid string: '{l5_text}'")
                            else:
                                self.logger.info(f"SelectBest ({user_id}): No 'suggested_questions' list found, is empty, or not a list for the top match: {top_match.get('match_id', 'Unknown')}.")
                        else:
                            self.logger.warning(f"SelectBest ({user_id}): Top match object is not a dictionary.")
                    else:
                        self.logger.info(f"SelectBest ({user_id}): No 'matches' list found or is empty in reranking_data for Layer 5.")
                else:
                    self.logger.warning(f"SelectBest ({user_id}): reranking_data item is not a dictionary.")
            else:
                self.logger.info(f"SelectBest ({user_id}): No reranking_results_list available or is empty for Layer 5 generation.")

            all_candidates.extend(layer5_candidates)

            candidate_count = len(all_candidates)
            self.logger.info(f"SelectBest ({user_id}): Total candidates (incl. L5={len(layer5_candidates)}): {candidate_count}")

            # --- Selection Logic --- #
            if not all_candidates:
                self.logger.warning(f"No candidates found from any layer for user {user_id}. Cannot select a question.")
                self.no_candidates_counter.inc()
                # selected_question_dict remains None - Add pass if no other action needed
                pass
            else:
                # This block seems correctly indented relative to the else
                all_candidates.sort(key=_get_candidate_priority)
                self.logger.debug(f"SelectBest ({user_id}): Top 3 prioritized candidates (L1>{'L5>' if layer5_candidates else ''}L2>L4>L3): {[{'layer': c.get('layer'), 'text': c.get('text', c.get('question_text',''))[:30]+'...'} for c in all_candidates[:3]]}")
                formatted_history = self._format_history_for_prompt(user_history)
                formatted_candidates = self._format_candidates_for_prompt(all_candidates)
                selected_text = self._call_llm_selector(user_id, formatted_history, formatted_candidates)

                if selected_text:
                    # ... (match selected text to candidate dict - logic remains same) ...
                    for cand in all_candidates:
                         cand_text_orig = cand.get('text') or cand.get('question_text')
                         if cand_text_orig and cand_text_orig.strip() == selected_text:
                             selected_question_dict = cand
                             self.logger.info(f"User {user_id}: LLM selected question (Layer {selected_question_dict.get('layer')}):")
                             break
                    if not selected_question_dict: # Fallback if LLM text doesn't match
                        error_message = f"Selector LLM selected unmatched text: {selected_text}"
                        self.logger.error("User %s: %s. Falling back to highest priority.", user_id, error_message)
                        yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                            'error': error_message,
                            'user_id': user_id,
                            'element': element,
                        })
                        selected_question_dict = all_candidates[0]
                        self.llm_selection_errors.inc()
                else: # Fallback if LLM fails
                    error_message = self.setup_error_message or "SelectBestQuestionDoFn selector LLM failed"
                    self.logger.error("User %s: %s. Falling back to highest priority.", user_id, error_message)
                    yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                        'error': error_message,
                        'user_id': user_id,
                        'element': element,
                    })
                    selected_question_dict = all_candidates[0]
                    self.llm_selection_errors.inc()

            # ... (yield output dictionary as before) ...
            yield {
                'user_id': user_id,
                'selected_question': selected_question_dict,
                'candidate_count': candidate_count
            }
        except Exception as e:
            error_message = f"SelectBestQuestionDoFn process failed: {e}"
            self.logger.error(error_message, exc_info=True)
            Metrics.counter(self.__class__.__name__, MetricNames.ERRORS).inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                'error': error_message,
                'user_id': user_id,
                'element': element,
                'trace': traceback.format_exc(),
            })
            yield {
                'user_id': user_id,
                'selected_question': None,
                'candidate_count': 0
            }


class UpdateNextQuestionDoFn(beam.DoFn):
    """Updates the suggested next question details in the user's NEXT_QUESTION_SUGGESTIONS Firestore doc."""
    OUTPUT_ERROR_TAG = 'errors'

    def __init__(self, project_id: str):
        self.project_id = project_id
        self.db = None
        self.setup_error_message = None
        # Ensure this uses the correct path from definitions
        self.suggestions_collection_name = COLLECTIONS.get('MARRIAGE', {}).get('NEXT_QUESTION_SUGGESTIONS')
        self.logger = logging.getLogger(__name__)

        if not self.suggestions_collection_name:
            raise ValueError("NEXT_QUESTION_SUGGESTIONS collection name not found in COLLECTIONS definition.")

    def setup(self):
        try:
            self.db = firestore.Client(project=self.project_id)
            self.setup_error_message = None
            self.logger.info(f"UpdateNextQuestionDoFn setup complete (Firestore collection: {self.suggestions_collection_name})")
        except Exception as e:
            self.setup_error_message = f"UpdateNextQuestionDoFn setup failed: {e}"
            self.logger.error(self.setup_error_message, exc_info=True)

    def process(self, element: Dict[str, Any]):
        # Expects element like: {'user_id': ..., 'selected_question': { ... }, 'candidate_count': ...}
        if not self.db:
            error_message = self.setup_error_message or "UpdateNextQuestionDoFn setup failed"
            self.logger.error("%s. Cannot update next-question suggestion.", error_message)
            Metrics.counter(self.__class__.__name__, MetricNames.ERRORS).inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': error_message, 'element': element})
            return

        user_id = element.get('user_id')
        selected_question = element.get('selected_question') # This can be None now
        candidate_count = element.get('candidate_count') # Get the count

        # Handle case where no question was selected (e.g., no candidates)
        if selected_question is None:
            # If no question selected, maybe clear the suggestion or set specific state?
            # Option 1: Clear the suggestion document (or specific fields)
            try:
                self.logger.info(f"No question selected for user {user_id} (candidate count: {candidate_count}). Clearing suggestion.")
                suggestion_ref = self.db.collection(self.suggestions_collection_name).document(user_id)
                # Update with minimal fields or delete?
                suggestion_ref.set({
                    'userId': user_id,
                    'suggestionCompletionState': 'no_candidates_found', # Example state
                    'lastActivity': firestore.SERVER_TIMESTAMP,
                    'nextSuggestionCandidateCount': candidate_count, # Still store count
                    # Clear out old question fields explicitly
                    'nextSuggestedQuestionId': None,
                    'nextSuggestedQuestionText': None,
                    'nextSuggestedQuestionLayer': None,
                    'nextSuggestedQuestionSection': None,
                    'nextSuggestedQuestionTimestamp': None,
                    'nextSuggestedQuestionReasoning': None,
                    'nextSuggestionSource': None,
                    'nextSuggestedQuestionFramework': None,
                    'nextSuggestedQuestionClarificationTag': None
                }, merge=True)
                Metrics.counter(self.__class__.__name__, 'suggestions_cleared').inc()
            except Exception as e:
                Metrics.counter(self.__class__.__name__, MetricNames.ERRORS).inc()
                self.logger.error(f"Clearing next-question suggestion failed ({user_id}): {str(e)}", exc_info=True)
                yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                    'error': str(e),
                    'user_id': user_id,
                    'candidate_count': candidate_count,
                    'element': element,
                    'operation': 'clear_next_question_suggestion',
                    'trace': traceback.format_exc(),
                })
            return # Stop processing for this element

        # --- Proceed if a question was selected --- #
        if not user_id or not isinstance(selected_question, dict):
            self.logger.error(f"Invalid input for UpdateNextQuestionDoFn (selected_question invalid): {element}")
            Metrics.counter(self.__class__.__name__, MetricNames.ERRORS).inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': 'Invalid selected_question format', 'element': element})
            return

        try:
            suggestion_ref = self.db.collection(self.suggestions_collection_name).document(user_id)

            # --- Prepare data to write - Align with NextQuestionSuggestion interface --- #
            question_id = selected_question.get('id')
            question_text = selected_question.get('text') or selected_question.get('question_text')
            layer = selected_question.get('layer')
            section = selected_question.get('section')
            reasoning = selected_question.get('reasoning', '')
            source = selected_question.get('candidate_source')
            framework = selected_question.get('framework')
            clarification_tag = selected_question.get('clarificationTag')

            # Determine suggestion_source_detail
            if framework: suggestion_source_detail = f'layer_{layer}_{framework}' # L4
            elif layer == TOP_MATCH_LAYER: suggestion_source_detail = 'reranking_top_match' # L5
            elif source: suggestion_source_detail = source # L1 or L3
            elif layer: suggestion_source_detail = f'layer_{layer}' # L2
            else: suggestion_source_detail = 'unknown'

            # Determine completion_state
            completion_state = 'unknown_state' # Default
            if layer == FOUNDATIONAL_LAYER: completion_state = 'layer2_ongoing'
            elif layer == GENERAL_LAYER: completion_state = 'layer3_ongoing'
            elif layer == INSIGHT_LAYER: completion_state = 'layer4_ongoing'
            elif layer == CLARIFICATION_LAYER: completion_state = 'layer1_ongoing'
            elif layer == TOP_MATCH_LAYER: completion_state = 'layer5_ongoing' # Add state for L5

            update_data = {
                'userId': user_id,
                'nextSuggestedQuestionId': question_id,
                'nextSuggestedQuestionText': question_text or 'N/A',
                'nextSuggestedQuestionLayer': layer, # Will now correctly be 1, 2, 3, 4, or 5
                'nextSuggestedQuestionSection': section,
                'nextSuggestedQuestionTimestamp': firestore.SERVER_TIMESTAMP,
                'suggestionCompletionState': completion_state,
                'lastActivity': firestore.SERVER_TIMESTAMP,
                'nextSuggestedQuestionReasoning': reasoning,
                'nextSuggestionSource': suggestion_source_detail, # Updated source logic
                'nextSuggestedQuestionFramework': framework,
                'nextSuggestedQuestionClarificationTag': clarification_tag,
                'nextSuggestionCandidateCount': candidate_count
            }

            # Remove keys with None values before writing
            update_data = {k: v for k, v in update_data.items() if v is not None}

            self.logger.info(f"Updating suggestion for user {user_id}: ID={question_id}, Layer={layer}, Source={suggestion_source_detail}, Count={candidate_count}, Text={update_data.get('nextSuggestedQuestionText')[:50]}...")
            suggestion_ref.set(update_data, merge=True)
            Metrics.counter(self.__class__.__name__, 'suggestions_updated').inc()

        except Exception as e:
            # Restore error handling
            Metrics.counter(self.__class__.__name__, MetricNames.ERRORS).inc()
            self.logger.error(f"Firestore update failed for next suggestion ({user_id}): {str(e)}", exc_info=True)
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': str(e), 'user_id': user_id, 'trace': traceback.format_exc()})


# --- Candidate Generation DoFns --- #

class Layer1CandidateDoFn(beam.DoFn):
    """
    Generates Layer 1 (Clarification) questions for a tagged sequence, starting
    with FIRST_OPEN_ENDED_QID. Continues as long as the LLM deems necessary.
    Relies on a 'clarificationTag' field in the Q&A data.
    """
    OUTPUT_CANDIDATES_TAG = 'layer1_candidates'
    OUTPUT_ERROR_TAG = 'errors'

    def __init__(self,
                 project_id: str,
                 location: str,
                 qa_collection_name: str = COLLECTIONS['MARRIAGE']['QAS'],
                 clarification_tag: str = DEFAULT_CLARIFICATION_TAG,
                 model_name: str = DEFAULT_LAYER1_MODEL_NAME,
                 temperature: float = DEFAULT_LAYER1_TEMPERATURE,
                 max_output_tokens: int = DEFAULT_LAYER1_MAX_OUTPUT_TOKENS):
        self.project_id = project_id
        self.location = location
        self.qa_collection_name = qa_collection_name
        self.clarification_tag = clarification_tag
        self.model_name = model_name
        self.temperature = temperature
        self.max_output_tokens = max_output_tokens
        self.logger = logging.getLogger(__name__)
        self.db = None # Firestore client
        self.prediction_client = None
        self.model_endpoint = None
        self.setup_error_message = None

    def setup(self):
        # Setup PredictionServiceClient and Firestore client
        try:
            from google.cloud import firestore
            from google.cloud.aiplatform_v1beta1.services.prediction_service import PredictionServiceClient
            from google.cloud.aiplatform_v1beta1.types import prediction_service

            self.db = firestore.Client(project=self.project_id)
            client_options = {"api_endpoint": f"{self.location}-aiplatform.googleapis.com"}
            self.prediction_client = PredictionServiceClient(client_options=client_options)
            self.model_endpoint = (
                f"projects/{self.project_id}/locations/{self.location}/"f"publishers/google/models/{self.model_name}"
            )
            self.setup_error_message = None
            self.logger.info(f"Layer1CandidateDoFn setup complete (Firestore, Vertex AI Endpoint: {self.model_endpoint})")
        except ImportError as e:
            self.setup_error_message = f"Layer1CandidateDoFn setup failed: missing library: {e}"
            self.logger.error(self.setup_error_message, exc_info=True)
        except Exception as e:
            self.setup_error_message = f"Layer1CandidateDoFn setup failed: {e}"
            self.logger.error(self.setup_error_message, exc_info=True)

    def _call_llm_for_clarification(self, user_id: str, qa_sequence: List[Dict]) -> List[Dict]:
        """
        Calls an LLM with the sequence of Q&As for a specific tag,
        asking if the *latest* answer needs clarification.
        """
        if not self.prediction_client or not self.model_endpoint:
            error_message = self.setup_error_message or "Layer1CandidateDoFn setup failed"
            if not self.setup_error_message:
                self.setup_error_message = error_message
            self.logger.error("%s. Cannot run clarification check for user %s.", error_message, user_id)
            Metrics.counter(self.__class__.__name__, MetricNames.ERRORS).inc()
            return []
        if not qa_sequence: # Should not happen if called correctly, but check
             self.logger.warning(f"Layer 1: _call_llm_for_clarification called with empty sequence for user {user_id}.")
             return []

        # Format the sequence for the prompt (e.g., numbered turns)
        prompt_context = "Here is the conversation history for the initial relationship goals topic:\n\n"
        for i, qa in enumerate(qa_sequence):
            q_text = qa.get('question', '[Question Text Missing]')
            a_text = qa.get('answer', '[Answer Text Missing]')
            prompt_context += f"Turn {i+1} Question: {q_text}\n"
            prompt_context += f"Turn {i+1} Answer: {a_text}\n\n"

        latest_answer = qa_sequence[-1].get('answer', '')

        system_instruction = (
            "You are an AI assistant reviewing a sequence of answers a user provided about a specific relationship topic "
            "for their profile. Your task is to determine if the *latest* answer in the sequence requires further clarification."
        )
        user_prompt = (
            f"{prompt_context}"
            f"Considering the entire conversation history above, is the **latest answer** (Turn {len(qa_sequence)}) sufficiently clear, specific, and detailed? "
            f"Or does it introduce new ambiguities or fail to adequately address the question asked in the last turn?"
            f"If the *latest* answer needs clarification, generate 1 or 2 open-ended clarification questions "
            f"that directly probe the ambiguous or underdeveloped points in that *specific latest answer*. Focus ONLY on clarifying the latest answer based on the conversation context. "
            f"Do not introduce completely new topics or re-ask previous questions unless the latest answer contradicts them significantly."
            f"If the latest answer is clear and adequately addresses the last question, provide an empty list.\n\n"
            f"**Output Format:** Respond ONLY with a valid JSON list of strings, where each string is a clarification question targeting the latest answer. Output `[]` if no further clarification is needed based on the latest answer."
            f"**Example (Needs Clarification):** [\"You mentioned feeling 'more aligned' now, could you describe what changed specifically?\", \"Regarding your point about finances, how do you envision discussing large purchases together?\"]\n"
            f"**Example (Clear Answer):** []"
        )

        prompt_instance = {
            "contents": [
                {"role": "user", "parts": [{"text": system_instruction}]},
                {"role": "model", "parts": [{"text": "Okay, I understand. Please provide the conversation sequence."}]},
                {"role": "user", "parts": [{"text": user_prompt}]}
            ]
        }

        try:
            request = prediction_service.PredictRequest(
                endpoint=self.model_endpoint,
                instances=[json_format.ParseDict(prompt_instance, Value())],
                parameters=json_format.ParseDict({
                    "temperature": self.temperature,
                    "maxOutputTokens": self.max_output_tokens,
                }, Value())
            )
            response = self.prediction_client.predict(request=request)

            # Process response (same parsing logic as before)
            if not response.predictions:
                self.logger.warning(f"Layer 1 LLM call for user {user_id} (sequence) returned no predictions.")
                Metrics.counter(self.__class__.__name__, MetricNames.LLM_ERRORS).inc()
                return []

            prediction_result = json_format.MessageToDict(response.predictions[0])
            candidates_list = prediction_result.get('candidates', [])
            raw_output = ""
            if candidates_list and isinstance(candidates_list, list) and len(candidates_list) > 0:
                 content = candidates_list[0].get('content', {})
                 parts = content.get('parts', [])
                 if parts and isinstance(parts, list) and len(parts) > 0:
                      raw_output = parts[0].get('text', '')
            elif 'content' in prediction_result:
                 raw_output = prediction_result.get('content', '')

            if not raw_output:
                self.logger.warning(f"Layer 1 LLM call for user {user_id} (sequence) returned empty content: {prediction_result}")
                Metrics.counter(self.__class__.__name__, MetricNames.LLM_ERRORS).inc()
                return []

            clarification_questions_text = parse_llm_json_output(raw_output, self.logger, f"Layer 1 LLM (user {user_id}, seq_len={len(qa_sequence)})")

            valid_candidates = []
            if isinstance(clarification_questions_text, list):
                for q_text in clarification_questions_text:
                    if isinstance(q_text, str) and q_text.strip():
                        valid_candidates.append({
                            'question_text': q_text.strip(),
                            'layer': 1,
                            'candidate_source': 'llm_clarification',
                            'clarificationTag': self.clarification_tag,
                            'reasoning': f'Clarification needed for turn {len(qa_sequence)} in sequence {self.clarification_tag}'
                        })
                    else:
                        self.logger.warning(f"Layer 1 LLM for user {user_id} returned invalid text in list: {q_text}")
                if not valid_candidates:
                     self.logger.info(f"Layer 1 LLM determined no further clarification needed for user {user_id} on sequence {self.clarification_tag} (Turn {len(qa_sequence)}).")
            else:
                self.logger.warning(f"Layer 1 LLM output for user {user_id} was not a list after parsing: {type(clarification_questions_text)}")

            Metrics.counter(self.__class__.__name__, 'layer1_candidates_generated').inc(len(valid_candidates))
            return valid_candidates

        except Exception as e:
            self.logger.error(f"Error calling/parsing Layer 1 LLM for user {user_id} (sequence): {e}", exc_info=True)
            Metrics.counter(self.__class__.__name__, MetricNames.LLM_ERRORS).inc()
            return []

    def process(self, element: Dict[str, Any]):
        # Expects element containing triggering QA details, including the tag.
        # Example: {'user_id': 'user123', 'qa_id': 'Q_CLARIFY_1', 'answer': '...', 'clarificationTag': 'initial_goals'}
        # The initial trigger for Q_INITIAL_GOALS_OPEN must also include the tag.

        triggering_tag = element.get('clarificationTag')
        user_id = element.get('user_id')
        triggering_qa_id = element.get('qa_id')

        # --- Check if this trigger belongs to the target clarification sequence --- #
        if not user_id or triggering_tag != self.clarification_tag:
            # This trigger is not part of the sequence Layer 1 manages.
            # Yield empty list for CoGroupByKey compatibility.
            if triggering_tag != self.clarification_tag:
                 self.logger.debug(f"Layer 1: Skipping trigger for user {user_id}, tag '{triggering_tag}' != target '{self.clarification_tag}'.")
            yield beam.pvalue.TaggedOutput(self.OUTPUT_CANDIDATES_TAG, (user_id or 'UNKNOWN', []))
            return

        # --- Fetch the sequence using the helper --- #
        if not self.db or not self.prediction_client or not self.model_endpoint:
             error_message = self.setup_error_message or "Layer1CandidateDoFn setup failed"
             self.logger.error("%s. Cannot fetch sequence.", error_message)
             Metrics.counter(self.__class__.__name__, MetricNames.ERRORS).inc()
             yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': error_message, 'user_id': user_id, 'tag': self.clarification_tag})
             yield beam.pvalue.TaggedOutput(self.OUTPUT_CANDIDATES_TAG, (user_id, []))
             return

        try:
            self.logger.info(f"Layer 1: Received trigger for sequence '{self.clarification_tag}' for user {user_id} (QA: {triggering_qa_id}). Fetching sequence.")

            # --- Fetch the sequence using the helper --- #
            qa_sequence = get_qas_by_tag(self.db, self.qa_collection_name, user_id, self.clarification_tag, self.logger)
            # *** Placeholder removed ***

            if not qa_sequence:
                 self.logger.warning(f"Layer 1: No QA sequence found for tag '{self.clarification_tag}' for user {user_id}, despite trigger. Skipping LLM call.")
                 yield beam.pvalue.TaggedOutput(self.OUTPUT_CANDIDATES_TAG, (user_id, []))
                 return

            # No Max Depth Check
            current_depth = len(qa_sequence)

            # --- Call LLM with the sequence context --- #
            clarification_candidates = self._call_llm_for_clarification(user_id, qa_sequence)

            self.logger.info(f"Layer 1: Generated {len(clarification_candidates)} clarification candidates for user {user_id} (Sequence Turn {current_depth+1}).")
            yield beam.pvalue.TaggedOutput(self.OUTPUT_CANDIDATES_TAG, (user_id, clarification_candidates))

        except Exception as e:
            self.logger.error(f"Error in Layer1CandidateDoFn process for user {user_id}, tag {self.clarification_tag}: {e}", exc_info=True)
            Metrics.counter(self.__class__.__name__, MetricNames.ERRORS).inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': str(e), 'user_id': user_id, 'tag': self.clarification_tag})
            yield beam.pvalue.TaggedOutput(self.OUTPUT_CANDIDATES_TAG, (user_id, []))

# ... (Layer2CandidateDoFn, Layer3CandidateDoFn) ...

# --- Helper Functions within this module --- #
def _get_candidate_priority(candidate: Dict) -> Tuple[int, int]:
    """Assigns a sortable priority tuple (layer_priority, internal_priority)."""
    layer = candidate.get('layer')
    # Layer Priority: Lower number is higher priority (L1 > L5 > L2 > L4 > L3)
    layer_priority = {
        CLARIFICATION_LAYER: 1,
        TOP_MATCH_LAYER: 2,
        FOUNDATIONAL_LAYER: 3,
        INSIGHT_LAYER: 4, # L4 Assessments
        GENERAL_LAYER: 5, # L3 Semantic Gap
    }.get(layer, 99)

    # Internal Priority: Use 'priority' field if available (lower is better), else default
    # Invert internal priority because lower DB value means higher priority here
    internal_priority = 0
    if layer == FOUNDATIONAL_LAYER or layer == INSIGHT_LAYER: # Apply to L2 and L4
        internal_priority = -int(candidate.get('priority', 999))
    # L5 questions don't have an inherent internal priority from source, treat as 0

    return (layer_priority, internal_priority)

# ... (Layer1CandidateDoFn, Layer2CandidateDoFn, Layer3CandidateDoFn) ...

# --- Layer 4 Candidate Generation (Assessment Templates) --- #

class Layer4CandidateDoFn(beam.DoFn):
    """
    Generates Layer 4 (Assessment) questions by finding the highest priority
    unanswered question from configured assessment frameworks (e.g., Attachment, Big Five).
    """
    OUTPUT_CANDIDATES_TAG = 'layer4_candidates'
    OUTPUT_ERROR_TAG = 'errors'

    def __init__(self, project_id: str):
        self.project_id = project_id
        self.logger = logging.getLogger(__name__)
        self.db = None
        self.setup_error_message = None
        self.partial_setup_error_message = None
        # Store templates loaded during setup, keyed by framework name
        self._assessment_templates: Dict[str, List[Dict]] = {}
        self.framework_collections = COLLECTIONS.get('ASSESSMENTS', {})
        if not self.framework_collections:
             self.logger.warning("Layer 4: No assessment framework collections defined in common.definitions.COLLECTIONS['ASSESSMENTS']. Layer 4 will produce no candidates.")

        # Metrics
        self.templates_loaded_counter = Metrics.counter(self.__class__.__name__, 'templates_loaded')
        self.candidates_generated_counter = Metrics.counter(self.__class__.__name__, MetricNames.CANDIDATES_GENERATED)
        self.no_candidates_counter = Metrics.counter(self.__class__.__name__, 'no_candidates_found')

    def setup(self):
        self.logger.info("Setting up Layer4CandidateDoFn (Assessment Templates)...")
        setup_errors = []
        try:
            self.db = firestore.Client(project=self.project_id)
            self.setup_error_message = None
            self.partial_setup_error_message = None
            if not self.framework_collections:
                self.logger.warning("Layer 4: Skipping template loading as no frameworks are defined.")
                return

            # Load templates for each framework
            for framework_name, collection_name in self.framework_collections.items():
                self.logger.info(f"Layer 4: Loading templates for framework '{framework_name}' from collection '{collection_name}'...")
                framework_templates = []
                try:
                    docs = self.db.collection(collection_name).stream()
                    count = 0
                    invalid_count = 0
                    for doc in docs:
                        q_data = doc.to_dict()
                        q_id = doc.id

                        # Basic validation based on expected structure
                        is_valid = False
                        if isinstance(q_data, dict):
                             has_text = q_data.get('text') is not None
                             is_layer_4 = q_data.get('layer') == INSIGHT_LAYER
                             has_valid_priority = isinstance(q_data.get('priority'), int)
                             if has_text and is_layer_4 and has_valid_priority:
                                 is_valid = True

                        if is_valid:
                            # Add implicit fields
                            q_data['id'] = q_id
                            q_data['framework'] = framework_name
                            framework_templates.append(q_data)
                            count += 1
                        else:
                            self.logger.warning(f"Layer 4: Skipping invalid template in '{collection_name}': ID={q_id}, Data={q_data}")
                            invalid_count += 1

                    self._assessment_templates[framework_name] = framework_templates
                    self.templates_loaded_counter.inc(count)
                    self.logger.info(f"Layer 4: Loaded {count} valid templates (skipped {invalid_count} invalid) for framework '{framework_name}'.")

                except Exception as e:
                    setup_errors.append(f"{framework_name}/{collection_name}: {e}")
                    self.logger.error(f"Layer 4: Failed to load templates for framework '{framework_name}' from '{collection_name}': {e}", exc_info=True)
                    # Continue loading other frameworks, but preserve failures for per-element DLQ.

            # Log final loaded state
            loaded_summary = {fw: len(tpls) for fw, tpls in self._assessment_templates.items()}
            self.logger.info(f"Layer 4: Finished template loading. Summary: {loaded_summary}")
            if setup_errors:
                self.partial_setup_error_message = f"Layer4CandidateDoFn setup failed: {'; '.join(setup_errors)}"
                if not any(loaded_summary.values()):
                    self.setup_error_message = self.partial_setup_error_message

            # TODO: Consider adding a caching layer if Firestore reads are too frequent/slow.

        except Exception as e:
            self.setup_error_message = f"Layer4CandidateDoFn setup failed: {e}"
            self.partial_setup_error_message = self.setup_error_message
            self.logger.error(self.setup_error_message, exc_info=True)
            # Allow pipeline to continue; process will emit the failed element to the error tag.

    def _get_answered_ids(self, user_history: List[Dict]) -> Set[str]:
        """Extracts the set of answered question IDs from the user history."""
        answered_ids = set()
        if not user_history:
            return answered_ids
        for qa in user_history:
            # Assuming the history contains dicts with an 'id' field for the question ID
            # Adjust this logic if the history structure is different (e.g., nested under 'question_id')
            q_id = qa.get('id') or qa.get('questionId') # Try common keys
            if q_id and isinstance(q_id, str):
                answered_ids.add(q_id)
            else:
                 # Log if an item in history doesn't have a usable ID
                 # self.logger.debug(f"Layer 4: Found history item without 'id' or 'questionId': {qa}")
                 pass # Avoid excessive logging, maybe add a counter
        return answered_ids

    def process(self, element: Tuple[str, List[Dict]]):
        # Expects input keyed by user_id from the user_history_keyed PCollection
        # element: (user_id, list_of_qa_dicts)
        user_id, user_history = element

        if not user_id:
            self.logger.warning("Layer 4: Received element without user_id.")
            yield beam.pvalue.TaggedOutput(self.OUTPUT_CANDIDATES_TAG, ('UNKNOWN', []))
            return

        if not self.db:
            error_message = self.setup_error_message or "Layer4CandidateDoFn setup failed"
            self.logger.error("Layer 4 (%s): %s. Skipping.", user_id, error_message)
            Metrics.counter(self.__class__.__name__, MetricNames.ERRORS).inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': error_message, 'user_id': user_id, 'element': element})
            # Yield empty list for CoGroupByKey compatibility
            yield beam.pvalue.TaggedOutput(self.OUTPUT_CANDIDATES_TAG, (user_id, []))
            return

        if self.setup_error_message and not self._assessment_templates:
            error_message = self.setup_error_message or "Layer4CandidateDoFn setup failed"
            self.logger.error("Layer 4 (%s): %s. Skipping.", user_id, error_message)
            Metrics.counter(self.__class__.__name__, MetricNames.ERRORS).inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': error_message, 'user_id': user_id, 'element': element})
            yield beam.pvalue.TaggedOutput(self.OUTPUT_CANDIDATES_TAG, (user_id, []))
            return

        if not self._assessment_templates:
            self.logger.debug(f"Layer 4 ({user_id}): No assessment templates loaded. Cannot generate candidates.")
            yield beam.pvalue.TaggedOutput(self.OUTPUT_CANDIDATES_TAG, (user_id, []))
            return

        if self.partial_setup_error_message:
            self.logger.error("Layer 4 (%s): %s. Continuing with loaded templates.", user_id, self.partial_setup_error_message)
            Metrics.counter(self.__class__.__name__, MetricNames.ERRORS).inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                'error': self.partial_setup_error_message,
                'user_id': user_id,
                'element': element,
                'partial_setup_failure': True,
            })

        next_candidates = []
        try:
            answered_ids = self._get_answered_ids(user_history)
            self.logger.debug(f"Layer 4 ({user_id}): Found {len(answered_ids)} answered question IDs in history.")

            # Find the next unanswered question for each framework
            for framework_name, templates in self._assessment_templates.items():
                if not templates:
                    continue # Skip if no templates loaded for this framework

                # Filter templates to find unanswered ones
                unanswered_templates = [
                    tpl for tpl in templates if tpl.get('id') not in answered_ids
                ]

                if unanswered_templates:
                    # Find the one with the lowest priority number
                    unanswered_templates.sort(key=lambda tpl: tpl.get('priority', 999))
                    next_question_for_framework = unanswered_templates[0]
                    next_candidates.append(next_question_for_framework)
                    self.logger.debug(f"Layer 4 ({user_id}): Found next candidate for '{framework_name}': ID={next_question_for_framework.get('id')}, Prio={next_question_for_framework.get('priority')}")
                else:
                    self.logger.debug(f"Layer 4 ({user_id}): No unanswered questions found for framework '{framework_name}'.")

            # Yield the list of candidates (0 to N, where N is num frameworks)
            if next_candidates:
                self.logger.info(f"Layer 4 ({user_id}): Generated {len(next_candidates)} assessment candidates from frameworks: {[c.get('framework') for c in next_candidates]}.")
                self.candidates_generated_counter.inc(len(next_candidates))
            else:
                 self.logger.info(f"Layer 4 ({user_id}): No Layer 4 candidates generated (all assessment questions answered or no templates).")
                 self.no_candidates_counter.inc()

            yield beam.pvalue.TaggedOutput(self.OUTPUT_CANDIDATES_TAG, (user_id, next_candidates))

        except Exception as e:
            self.logger.error(f"Error in Layer4CandidateDoFn process for user {user_id}: {e}", exc_info=True)
            Metrics.counter(self.__class__.__name__, MetricNames.ERRORS).inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': str(e), 'user_id': user_id}) 
            # Yield empty list on error for CoGroupByKey compatibility
            yield beam.pvalue.TaggedOutput(self.OUTPUT_CANDIDATES_TAG, (user_id, []))


# --- Selection and Update DoFns --- #

# (SelectBestQuestionDoFn - Needs update later)
# ...

# (UpdateNextQuestionDoFn - Needs update later)
# ...

# ... (Layer1CandidateDoFn, Layer2CandidateDoFn, Layer3CandidateDoFn) ...

# --- Old DoFn - To be removed --- #
# SuggestNextProfileQuestionDoFn class definition should be deleted entirely. 