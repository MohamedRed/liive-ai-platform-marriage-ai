# apps/marriage-ai/dataflow/pipelines/streaming/transforms/reranking.py
import apache_beam as beam
import logging
import json
import traceback
import io # For PDF reading
from datetime import datetime # For lying score history formatting
from typing import Dict, Any, Tuple, List

# Import third-party libraries used within DoFns
import openai
import PyPDF2
from google.cloud import firestore, storage, secretmanager # Add secretmanager
from apache_beam.metrics import Metrics
from sentence_transformers import CrossEncoder # Added import

# Import constants and metrics from common
from .common import MetricNames, COLLECTIONS # Import COLLECTIONS if needed here
from .match_write_guard import latest_source_version
# Import utility functions
from ..utils import access_secret

logger = logging.getLogger(__name__)

# --- Helper Functions --- #

def read_pdf_from_firebase(project_id: str, bucket_name: str, file_path: str) -> str:
    """Read PDF instructions from Firebase Storage (GCS)."""
    try:
        # Initialize GCS client - okay to do here as it's called infrequently during setup/process
        # Alternatively, pass client in if used very frequently
        storage_client = storage.Client(project=project_id)
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(file_path)

        logger.info(f"Downloading PDF from gs://{bucket_name}/{file_path}")
        pdf_content = blob.download_as_bytes()

        pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
        text = ""
        for page in pdf_reader.pages:
            extracted_text = page.extract_text()
            if extracted_text:
                 text += extracted_text + "\n"
        logger.info(f"Successfully extracted text from PDF: {len(text)} characters.")
        return text
    except Exception as e:
        logger.error(f"Failed to read PDF from Firebase Storage gs://{bucket_name}/{file_path}: {e}", exc_info=True)
        # Surface setup-time instruction load failures with the owning DoFn name
        # so DLQ rows identify the active reranking boundary.
        raise RuntimeError("RerankMatchesDoFn setup failed") from e


# --- DoFn for Lying Score Calculation --- #

class CalculateLyingScoreDoFn(beam.DoFn):
    OUTPUT_ERROR_TAG = 'error'
    # Note: This DoFn assumes input related to QA changes, which might differ
    # from the main flow's `matches` PCollection. Adapt pipeline graph accordingly.
    def __init__(self, project_id: str):
        self.project_id = project_id
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('CalculateLyingScoreDoFn', MetricNames.ERRORS)
        self.openai_client = None
        self.db = None
        self.setup_error_message = None

    def setup(self):
        # Initialize OpenAI and Firestore clients
        try:
            self.db = firestore.Client(project=self.project_id)
            api_key = access_secret(self.project_id, "OPENAI_API_KEY")
            self.openai_client = openai.OpenAI(api_key=api_key)
            self.setup_error_message = None
            self.logger.info("CalculateLyingScoreDoFn setup complete (Firestore & OpenAI)")
        except Exception as e:
             self.setup_error_message = f"CalculateLyingScoreDoFn setup failed: {e}"
             self.logger.error(self.setup_error_message, exc_info=True)

    def process(self, element):
        """Calculate lying score for modified QAs"""
        if not self.db or not self.openai_client:
             error_message = self.setup_error_message or "CalculateLyingScoreDoFn setup failed"
             self.logger.error("%s. Skipping.", error_message)
             self.error_counter.inc()
             yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                 "error_message": error_message,
                 "element": element,
             })
             return

        # Expecting element like: {'profile_id': ..., 'qa_id': ..., 'qa_data': ...}
        # This structure needs to be produced by an upstream transform.
        if not isinstance(element, dict) or 'profile_id' not in element or 'qa_id' not in element or 'qa_data' not in element:
            self.logger.error(f"Invalid input element format for CalculateLyingScoreDoFn: {element}")
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": "Invalid input element format for CalculateLyingScoreDoFn",
                "element": element,
            })
            return

        profile_id = element['profile_id']
        qa_id = element['qa_id']
        qa_data = element['qa_data']
        question = qa_data.get('question')
        current_answer = qa_data.get('answer')

        if not question or not current_answer:
             self.logger.warning(f"Missing question or answer in qa_data for {profile_id}/{qa_id}. Skipping lying score.")
             self.error_counter.inc()
             yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                 "error_message": "Missing question or answer for lying score calculation",
                 "profile_id": profile_id,
                 "qa_id": qa_id,
                 "element": element,
             })
             return

        try:
            # self.logger.info(f"Calculating lying score for {profile_id}, QA: {qa_id}")
            # Get edit history from Firestore (using QA_EDIT_LOGS collection)
            # Adjust collection/field names based on actual Firestore structure
            edit_log_ref = self.db.collection(COLLECTIONS["MARRIAGE"]["QA_EDIT_LOGS"])
            query = edit_log_ref.where('userId', '==', profile_id)\
                                .where('questionId', '==', qa_id)\
                                .order_by('createdAt', direction=firestore.Query.DESCENDING)\
                                .limit(10) # Limit history for performance/cost

            history_events = list(query.stream())

            if not history_events:
                # self.logger.info(f"No edit history found for {profile_id}/{qa_id}. Assigning default score.")
                # If no history, assume score is 0 (or handle as needed)
                lying_score = 0.0
            else:
                edit_history_formatted = []
                for event_doc in history_events:
                    event_data = event_doc.to_dict()
                    ts = event_data.get('createdAt') or event_data.get('timestamp')
                    prev_ans = event_data.get('previousAnswer', '')
                    new_ans = event_data.get('newAnswer', '')
                    ts_str = ts.strftime('%Y-%m-%d %H:%M:%S') if isinstance(ts, datetime) else str(ts)
                    edit_history_formatted.append(
                        f"[{ts_str}] Changed from: '{prev_ans}' to: '{new_ans}'"
                    )

                # Format edit history for prompt (most recent first due to query order)
                history_text = '\n'.join(reversed(edit_history_formatted))

                # Generate prompt for OpenAI
                # TODO: Refine this prompt for better accuracy and specific instructions
                prompt = f"""
                Analyze the edit history for the following question and answer to assess potential deception or significant changes in stance. Provide a numerical score between 0.0 (no deception/stable) and 1.0 (likely deception/highly unstable).

                Question: {question}
                Current Answer: {current_answer}

                Recent Edit History (up to 10 changes, oldest first):
                {history_text}

                Consider:
                - Frequency of edits.
                - Time between edits.
                - Nature of changes (minor tweaks vs. complete reversals).
                - Contradictions between versions.
                - Drastic shifts in stated beliefs, values, or facts.

                Output only the numerical score (float between 0.0 and 1.0).
                """

                # Get lying score from OpenAI
                response = self.openai_client.chat.completions.create(
                    model="gpt-4", # Consider a cheaper/faster model if appropriate
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.2 # Lower temperature for more deterministic scoring
                )
                response_content = response.choices[0].message.content.strip()

                try:
                    lying_score = float(response_content)
                    lying_score = max(0.0, min(1.0, lying_score)) # Clamp score between 0 and 1
                    # self.logger.info(f"Calculated lying score for {profile_id}/{qa_id}: {lying_score:.2f}")
                except ValueError:
                     self.logger.error(f"Failed to parse lying score from OpenAI response for {profile_id}/{qa_id}. Response: '{response_content}'")
                     self.error_counter.inc()
                     yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                         "error_message": "Failed to parse lying score from OpenAI response",
                         "profile_id": profile_id,
                         "qa_id": qa_id,
                         "response_content": response_content,
                         "element": element,
                     })
                     return

            yield {
                'profile_id': profile_id,
                'qa_id': qa_id,
                'lying_score': lying_score
            }

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Error calculating lying score for {profile_id}/{qa_id}: {str(e)}\nTraceback: {traceback.format_exc()}", exc_info=True)
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": f"Error calculating lying score for {profile_id}/{qa_id}: {str(e)}",
                "profile_id": profile_id,
                "qa_id": qa_id,
                "element": element,
                "traceback": traceback.format_exc(),
            })

class UpdateLyingScoreDoFn(beam.DoFn):
    OUTPUT_ERROR_TAG = 'error'
    # Updates the calculated lying score back to the main user profile Q&A section
    def __init__(self, project_id: str):
        self.project_id = project_id
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('UpdateLyingScoreDoFn', MetricNames.ERRORS)
        self.update_counter = Metrics.counter('UpdateLyingScoreDoFn', 'lying_scores_updated')
        self.db = None
        self.setup_error_message = None

    def setup(self):
        try:
            self.db = firestore.Client(project=self.project_id)
            self.setup_error_message = None
            self.logger.info("UpdateLyingScoreDoFn setup complete (Firestore)")
        except Exception as e:
             self.setup_error_message = f"UpdateLyingScoreDoFn setup failed: {e}"
             self.logger.error(self.setup_error_message, exc_info=True)

    def process(self, element):
        if not self.db:
             error_message = self.setup_error_message or "UpdateLyingScoreDoFn setup failed"
             self.logger.error("%s. Skipping.", error_message)
             self.error_counter.inc()
             yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                 "error_message": error_message,
                 "element": element,
             })
             return

        # Expecting {'profile_id': ..., 'qa_id': ..., 'lying_score': ...}
        if not isinstance(element, dict) or 'profile_id' not in element or 'qa_id' not in element or 'lying_score' not in element:
            self.logger.error(f"Invalid input element format for UpdateLyingScoreDoFn: {element}")
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": "Invalid input element format for UpdateLyingScoreDoFn",
                "element": element,
            })
            return

        profile_id = element['profile_id']
        qa_id = element['qa_id']
        lying_score = element['lying_score']

        try:
            # self.logger.info(f"Updating lying score for {profile_id}, QA: {qa_id} to {lying_score:.2f}")
            # Assuming QAs are stored in a map/object within the profile document
            # Adjust path based on your Firestore structure (e.g., COLLECTIONS["USERS"] or profile collection)
            profile_ref = self.db.collection(COLLECTIONS["USERS"]["USER_INFO"]).document(profile_id)
            # Use dot notation for updating nested fields in Firestore
            update_data = {f'questions_answers.{qa_id}.aiLyingScore': lying_score}

            profile_ref.update(update_data)
            self.update_counter.inc()
            # self.logger.info(f"Successfully updated lying score for {profile_id}/{qa_id}.")

            # Yield the element if needed downstream, otherwise this can be a terminal step for this branch
            yield element

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Firestore update failed for lying score ({profile_id}/{qa_id}): {str(e)}\nTraceback: {traceback.format_exc()}", exc_info=True)
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": f"Firestore update failed for lying score ({profile_id}/{qa_id}): {str(e)}",
                "profile_id": profile_id,
                "qa_id": qa_id,
                "element": element,
                "traceback": traceback.format_exc(),
            })


# --- Metrics for CrossEncoder --- #
CROSS_ENCODE_SUCCESS = 'CrossEncodeSuccess'
CROSS_ENCODE_ERRORS = 'CrossEncodeErrors'
PROFILE_FETCH_ERRORS_CROSS_ENCODE = 'ProfileFetchErrorsCrossEncode'

class CrossEncodeDoFn(beam.DoFn):
    """Reranks candidates using a Cross-Encoder model."""
    OUTPUT_ERROR_TAG = 'error'

    def __init__(self, project_id: str, 
                 profiles_collection: str, # Main user profiles (e.g., USER_INFO)
                 profile_summaries_collection: str, # Dedicated summaries collection
                 model_name: str = 'cross-encoder/ms-marco-MiniLM-L-6-v2'):
        self.project_id = project_id
        self.profiles_collection = profiles_collection
        self.profile_summaries_collection = profile_summaries_collection # New arg
        self.model_name = model_name
        self.logger = logging.getLogger(__name__)
        self.db = None
        self.cross_encoder_model = None
        self.setup_error_message = None
        
        self.success_counter = Metrics.counter('CrossEncodeDoFn', CROSS_ENCODE_SUCCESS)
        self.error_counter = Metrics.counter('CrossEncodeDoFn', CROSS_ENCODE_ERRORS)
        self.profile_fetch_error_counter = Metrics.counter('CrossEncodeDoFn', PROFILE_FETCH_ERRORS_CROSS_ENCODE)

    def setup(self):
        self.logger.info(f"Setting up CrossEncodeDoFn. Initializing Firestore and loading cross-encoder model: {self.model_name}")
        try:
            self.db = firestore.Client(project=self.project_id)
            self.cross_encoder_model = CrossEncoder(self.model_name)
            self.setup_error_message = None
            self.logger.info("CrossEncodeDoFn setup complete.")
        except Exception as e:
            self.setup_error_message = f"CrossEncodeDoFn setup failed: {e}"
            self.logger.error(self.setup_error_message, exc_info=True)

    def _fetch_profile_text_for_cross_encoder(self, user_id: str) -> Tuple[str | None, str | None]:
        """Fetches profile text and reports summary-fetch fallback visibility."""
        summary_text = None
        partial_profile_fetch_error_message = None
        try:
            # 1. Attempt to fetch from dedicated summaries collection
            summary_doc_ref = self.db.collection(self.profile_summaries_collection).document(user_id)
            summary_doc = summary_doc_ref.get()
            if summary_doc.exists:
                summary_data = summary_doc.to_dict()
                if summary_data and summary_data.get('profileSummaryText'):
                    summary_text = summary_data['profileSummaryText']
                    self.logger.info(f"Using dedicated summary for user {user_id} for cross-encoder.")
                    # Optional: Implement staleness check here using qasVersionHash if needed in the future.
                    # For now, if summary exists, we use it.
                    return summary_text.strip(), None
                else:
                    self.logger.info(f"Dedicated summary document for {user_id} found but no profileSummaryText or empty.")
            else:
                self.logger.info(f"No dedicated summary found for user {user_id} in {self.profile_summaries_collection}. Attempting fallback.")

        except Exception as e_summary_fetch:
            partial_profile_fetch_error_message = f"CrossEncodeDoFn summary fetch failed for user {user_id}: {e_summary_fetch}"
            self.logger.error("%s. Attempting main-profile fallback.", partial_profile_fetch_error_message, exc_info=True)

        # 2. Fallback: Fetch full profile and use Q&As (or profileSummary field from main profile)
        self.logger.info(f"Fallback: Fetching full profile for {user_id} from {self.profiles_collection} to generate text for cross-encoder.")
        try:
            main_profile_doc_ref = self.db.collection(self.profiles_collection).document(user_id)
            main_profile_doc = main_profile_doc_ref.get()
            if not main_profile_doc.exists:
                self.logger.warning(f"Fallback: Main profile not found for cross-encoder: {user_id} in {self.profiles_collection}")
                self.profile_fetch_error_counter.inc() # Increment here as this is the final attempt for this user_id
                return None, partial_profile_fetch_error_message
            
            profile_data = main_profile_doc.to_dict()
            text_parts = []
            
            # Check for 'profileSummary' field in the main profile document as a first fallback
            main_profile_summary = profile_data.get('profileSummary') 
            if main_profile_summary and isinstance(main_profile_summary, str) and main_profile_summary.strip():
                self.logger.info(f"Fallback: Using profileSummary field from main profile for user {user_id}.")
                text_parts.append(main_profile_summary.strip())
            else:
                self.logger.info(f"Fallback: profileSummary not in main profile or empty for user {user_id}. Using all Q&As.")
                questions_answers = profile_data.get('questions_answers', {}) # Q&As might be in main profile doc or fetched separately by an earlier step
                                                                        # This DoFn assumes if it reaches here, it needs to find QAs in this profile_data
                if isinstance(questions_answers, dict):
                    for qa_id, qa_item in questions_answers.items():
                        question = qa_item.get('question', '')
                        answer = qa_item.get('answer', '')
                        if question and answer:
                            text_parts.append(f"Q: {question} A: {answer}")
                elif isinstance(questions_answers, list):
                    for qa_item in questions_answers: 
                        if isinstance(qa_item, dict):
                            question = qa_item.get('question', '')
                            answer = qa_item.get('answer', '')
                            if question and answer:
                                text_parts.append(f"Q: {question} A: {answer}")
            
            if not text_parts:
                self.logger.warning(f"Fallback: Could not generate meaningful text for profile {user_id} from Q&As or summary in main profile.")
                self.profile_fetch_error_counter.inc() # Increment as fallback also failed
                return None, partial_profile_fetch_error_message
            
            full_text = " \n ".join(text_parts)
            if len(full_text) > 3000: 
                self.logger.warning(f"Fallback: Generated profile text for user {user_id} is very long ({len(full_text)} chars). May be truncated.")
            return full_text, partial_profile_fetch_error_message

        except Exception as e_main_fetch:
            self.logger.error(f"Fallback: Error fetching/formatting main profile text for {user_id}: {e_main_fetch}", exc_info=True)
            self.profile_fetch_error_counter.inc() # Increment as fallback also failed
            return None, partial_profile_fetch_error_message

    def process(self, element: Tuple[str, List[Dict[str, Any]]]):
        # Input: (triggering_user_id, list_of_top_candidate_dicts from scoreboard)
        # list_of_top_candidate_dicts: [{'matched_user_id': ..., 'aggregated_score': ...}, ...]
        if not self.db or not self.cross_encoder_model:
            error_message = self.setup_error_message or "CrossEncodeDoFn setup failed"
            self.logger.error("%s. Skipping.", error_message)
            self.error_counter.inc()
            # Yield to error tag because this element cannot be processed
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {"error_message": error_message, "element": element})
            return

        triggering_user_id, candidates_list = element
        
        try:
            partial_profile_fetch_errors = []
            triggering_user_profile_text, triggering_profile_fetch_error = self._fetch_profile_text_for_cross_encoder(triggering_user_id)
            if triggering_profile_fetch_error:
                partial_profile_fetch_errors.append({
                    'error_message': triggering_profile_fetch_error,
                    'triggering_user_id': triggering_user_id,
                    'user_id': triggering_user_id,
                    'candidates_list': candidates_list,
                    'element': element,
                    'profile_role': 'triggering_user',
                    'partial_profile_fetch_failure': True,
                })
            if not triggering_user_profile_text:
                self.logger.warning(f"Could not get profile text for triggering user {triggering_user_id}. Skipping cross-encoding for this user.")
                self.error_counter.inc()
                for partial_profile_fetch_error in partial_profile_fetch_errors:
                    yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, partial_profile_fetch_error)
                yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                    "error_message": f"Failed to get profile text for triggering_user_id {triggering_user_id}", 
                    "triggering_user_id": triggering_user_id,
                    "candidates_list": candidates_list
                })
                return

            enriched_candidates = []
            sentence_pairs_to_score = []
            original_candidate_info_map = [] # To map scores back

            for candidate_info in candidates_list:
                matched_user_id = candidate_info.get('matched_user_id')
                if not matched_user_id:
                    self.logger.warning(f"Skipping candidate with missing matched_user_id: {candidate_info}")
                    continue

                candidate_profile_text, candidate_profile_fetch_error = self._fetch_profile_text_for_cross_encoder(matched_user_id)
                if candidate_profile_fetch_error:
                    partial_profile_fetch_errors.append({
                        'error_message': candidate_profile_fetch_error,
                        'triggering_user_id': triggering_user_id,
                        'user_id': matched_user_id,
                        'candidate_info': candidate_info,
                        'element': element,
                        'profile_role': 'candidate',
                        'partial_profile_fetch_failure': True,
                    })
                if candidate_profile_text:
                    sentence_pairs_to_score.append([triggering_user_profile_text, candidate_profile_text])
                    original_candidate_info_map.append(candidate_info)
                else:
                    # If candidate profile text can't be fetched, keep original info but score will be low/default
                    enriched_candidates.append({**candidate_info, 'cross_encoder_score': -1.0}) # Default low score
            
            if sentence_pairs_to_score:
                cross_encoder_scores = self.cross_encoder_model.predict(sentence_pairs_to_score, show_progress_bar=False)
                for i, original_info in enumerate(original_candidate_info_map):
                    enriched_candidates.append({
                        **original_info,
                        'cross_encoder_score': float(cross_encoder_scores[i])
                    })
            
            # Sort by new cross_encoder_score, highest first
            enriched_candidates.sort(key=lambda x: x.get('cross_encoder_score', -1.0), reverse=True)
            
            self.success_counter.inc()
            for partial_profile_fetch_error in partial_profile_fetch_errors:
                yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, partial_profile_fetch_error)
            yield (triggering_user_id, enriched_candidates)

        except Exception as e:
            self.logger.error(f"Error in CrossEncodeDoFn for user {triggering_user_id}: {e}\nTraceback: {traceback.format_exc()}", exc_info=True)
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": f"Cross-encoding failed: {str(e)}", 
                "triggering_user_id": triggering_user_id,
                "candidates_list": candidates_list, # Original candidates list
                "traceback": traceback.format_exc()
            })

@beam.ptransform_fn
def CrossEncodeCandidates(pcoll: beam.PCollection[Tuple[str, List[Dict[str, Any]]]], 
                        project_id: str, 
                        profiles_collection: str, 
                        profile_summaries_collection: str, # Add new arg
                        model_name: str = 'cross-encoder/ms-marco-MiniLM-L-6-v2') -> beam.PCollectionTuple:
    """
    PTransform to rerank candidates using a Cross-Encoder model.

    Args:
        pcoll: PCollection of (triggering_user_id, list_of_top_candidate_dicts from scoreboard).
        project_id: GCP Project ID.
        profiles_collection: Firestore collection name for user profiles.
        profile_summaries_collection: Firestore collection for dedicated profile summaries.
        model_name: Name of the sentence-transformers CrossEncoder model.

    Returns:
        PCollectionTuple with:
         - 'main': (triggering_user_id, list_of_candidates_with_cross_encoder_scores)
         - 'error': PCollection of elements that failed processing.
    """
    return (
        pcoll
        | 'CrossEncodeCandidatePairs' >> beam.ParDo(
            CrossEncodeDoFn(
                project_id=project_id, 
                profiles_collection=profiles_collection, 
                profile_summaries_collection=profile_summaries_collection, # Pass to DoFn
                model_name=model_name
            )
          ).with_outputs(CrossEncodeDoFn.OUTPUT_ERROR_TAG, main='main')
    )


# --- DoFn for Reranking (Existing RerankMatchesDoFn to be adapted) --- #

class RerankMatchesDoFn(beam.DoFn):
    OUTPUT_ERROR_TAG = 'error' # Define error tag
    # Uses OpenAI to rerank matches based on profile compatibility.
    # Expects scores to be provided in the input element.
    def __init__(self, project_id, profiles_collection, pdf_bucket, pdf_instructions_path):
        self.project_id = project_id
        self.profiles_collection = profiles_collection # Firestore collection for profiles
        self.pdf_bucket = pdf_bucket
        self.pdf_instructions_path = pdf_instructions_path
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('RerankMatchesDoFn', MetricNames.ERRORS)
        self.rerank_success_counter = Metrics.counter('RerankMatchesDoFn', 'rerank_success')
        self.fetch_profile_errors = Metrics.counter('RerankMatchesDoFn', 'fetch_profile_errors')
        self.openai_client = None
        self.db = None
        self.ai_instructions = None
        self.setup_error_message = None

    def setup(self):
        self.logger.info("Setting up RerankMatchesDoFn (OpenAI client, Firestore, PDF instructions)")
        try:
            self.db = firestore.Client(project=self.project_id)
            api_key = access_secret(self.project_id, "OPENAI_API_KEY")
            self.openai_client = openai.OpenAI(api_key=api_key)

            # Read ranking instructions during setup (reads once per worker)
            self.ai_instructions = read_pdf_from_firebase(
                project_id=self.project_id,
                bucket_name=self.pdf_bucket,
                file_path=self.pdf_instructions_path
            )
            self.setup_error_message = None
            self.logger.info("RerankMatchesDoFn setup complete.")

        except Exception as e:
            error_message = str(e)
            self.setup_error_message = (
                error_message
                if error_message.startswith("RerankMatchesDoFn setup failed")
                else f"RerankMatchesDoFn setup failed: {e}"
            )
            self.logger.error(self.setup_error_message, exc_info=True)

    def _fetch_profile(self, user_id):
        # Helper to fetch a single profile, returns None on error.
        try:
            doc = self.db.collection(self.profiles_collection).document(user_id).get()
            if doc.exists:
                profile = doc.to_dict()
                profile['id'] = user_id # Ensure ID is present
                return profile
            else:
                self.logger.warning(f"Profile not found during reranking fetch: {user_id}")
                return None
        except Exception as e:
            self.fetch_profile_errors.inc()
            self.logger.error(f"Error fetching profile {user_id} during reranking: {e}", exc_info=True)
            return None # Return None instead of raising to allow partial reranking

    def _format_profile_for_prompt(self, profile_data: Dict[str, Any]) -> str:
        # Format profile Q&A for OpenAI prompt.
        # Now directly uses aiLyingScore from the profile_data if available.
        formatted_profile = "User Profile:\n"
        
        # Potentially add other key fields like age, occupation if readily available and useful for LLM context
        # e.g., age = profile_data.get('profile', {}).get('personalInfo', {}).get('age') ...

        qa_data = profile_data.get("questions_answers", {}) 

        if isinstance(qa_data, dict):
             for qa_id, qa in qa_data.items():
                question = qa.get('question', '')
                answer = qa.get('answer', '')
                # Use aiLyingScore directly from the QA item in the profile
                lying_score = qa.get('aiLyingScore') 
                score_info = f" (Truthfulness Score: {lying_score:.2f})" if lying_score is not None else ""
                formatted_profile += f"Q: {question}\nA: {answer}{score_info}\n"
        # Handle list format if profiles store Q&A as list (ensure compatibility with your data model)
        # elif isinstance(qa_data, list): ... (similar adaptation)
        
        return formatted_profile.strip()

    def _get_compatibility_score_and_questions(self, source_profile_fmt: str, match_profile_fmt: str, 
                                               cross_encoder_score: float | None = None, 
                                               scoreboard_score: float | None = None,
                                               source_user_consistency_score: float | None = None):
        # ... (LLM Prompt modification)
        context = ""
        if source_user_consistency_score is not None:
            context += f"Note: Source User Overall Consistency Score: {source_user_consistency_score:.2f} (0=Consistent, 1=Inconsistent based on edit history).\n"
        if scoreboard_score is not None:
            context += f"The initial system match score (from scoreboard) for this pair was: {scoreboard_score:.2f}.\n"
        if cross_encoder_score is not None:
            context += f"A cross-encoder model then refined this score to: {cross_encoder_score:.4f}.\n"
        
        prompt = f"""
        You are an AI assistant for a Muslim marriage platform. Your task is to evaluate the compatibility between two user profiles for marriage and suggest insightful follow-up questions.

        Analyze these two profiles for marriage compatibility based on Islamic values, personality, lifestyle, and goals. Consider the provided per-answer Truthfulness Scores (0.0=trustworthy answer, 1.0=potential deception based on edit history) which indicate the stability and truthfulness of specific answers, if available for Profile 1.
        {context}
        User Profile 1 (Source User):
        ---
        {source_profile_fmt}
        ---

        User Profile 2 (Potential Match):
        ---
        {match_profile_fmt}
        ---

        Instructions:
        1. Provide a final holistic compatibility score from 0 to 100, where 100 is highly compatible. Use all available information, including any previous scores provided in the context.
        2. Generate 3 concise, open-ended follow-up questions that User Profile 1 could ask User Profile 2 to clarify important areas, explore potential issues, or deepen understanding. Focus on questions related to:
            - Core religious practices and beliefs
            - Family values and expectations
            - Life goals and aspirations
            - Personality compatibility
            - Potential deal-breakers
        3. For each question, provide a brief rationale and categorize it into one section: religious_practice, family_values, education, personality, hobbies, lifestyle, goals.

        Provide your response ONLY in the following JSON format:
        {{ "score": <number between 0-100>, "suggested_questions": [ {{ "question": "<question text>", "rationale": "<why this question is important>", "section": "<relevant section>" }} ] }}
        """
        # ... (Rest of the LLM call and JSON parsing logic remains largely the same)
        # Ensure error handling and default return values are robust.
        result_str = '[unavailable]'
        try:
            response = self.openai_client.chat.completions.create(
                model="o1-mini", # Consider making model configurable via config.py or pipeline args
                messages=[
                    {"role": "system", "content": self.ai_instructions}, 
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3, 
                response_format={ "type": "json_object" } 
            )
            result_str = response.choices[0].message.content
            result = json.loads(result_str)

            score = float(result.get('score', 0)) 
            questions = []
            raw_questions = result.get('suggested_questions', [])
            if isinstance(raw_questions, list):
                 for q in raw_questions:
                      if isinstance(q, dict) and 'question' in q and 'rationale' in q and 'section' in q:
                           questions.append({
                                'question': str(q['question']),
                                'rationale': str(q['rationale']),
                                'section': str(q['section'])
                           })
                      else:
                           self.logger.warning(f"Malformed suggested question item: {q}")
            else:
                 self.logger.warning(f"Unexpected format for suggested_questions: {raw_questions}")
            return min(max(score, 0), 100), questions, None
        except (ValueError, KeyError, json.JSONDecodeError) as e:
            error_message = f"RerankMatchesDoFn compatibility LLM response parse failed: {str(e)}"
            self.logger.error(f"{error_message}\nResponse string: '{result_str if 'result_str' in locals() else '[unavailable]'}'", exc_info=True)
            self.error_counter.inc()
            return 0, [], error_message
        except Exception as e:
             error_message = f"RerankMatchesDoFn compatibility LLM call failed: {str(e)}"
             self.logger.error(error_message, exc_info=True)
             self.error_counter.inc()
             return 0, [], error_message

    def process(self, element: Tuple[str, Dict[str, Any]]):
        # Expected input: (triggering_user_id, data_dict)
        # data_dict = {'candidates': list_of_enriched_candidates, 'user_qas': user_qas_dict}
        # list_of_enriched_candidates: [{'matched_user_id': ..., 'aggregated_score' (scoreboard), 'cross_encoder_score': ...}, ...]
        
        triggering_user_id, data_dict = element
        candidates_list = data_dict.get('candidates', [])
        user_qas_for_triggering_user = data_dict.get('user_qas', {})
        source_scoreboard_max_updated_at = latest_source_version(tuple(
            candidate.get('last_updated')
            for candidate in candidates_list
            if isinstance(candidate, dict)
        ))
        # The 'scores' dict from old input (containing per-QA lying scores and aggregate) is no longer directly passed.
        # Lying scores per QA should be part of the fetched profile data.
        # Aggregate lying/consistency score might need to be fetched or computed if still used.

        if not self.db or not self.openai_client or not self.ai_instructions:
             error_message = self.setup_error_message or "RerankMatchesDoFn setup failed"
             self.logger.error("%s. Skipping.", error_message)
             self.error_counter.inc()
             yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                 'user_id': triggering_user_id,
                 'error_message': error_message,
                 'element': element,
             })
             return

        if not triggering_user_id or not isinstance(candidates_list, list):
            self.logger.error(f"Invalid input element format for RerankMatchesDoFn: triggering_user_id or candidates_list missing/malformed. Element: {element}")
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {"error_message": "Invalid input structure", "element": element})
            return

        try:
            source_profile_data = self._fetch_profile(triggering_user_id)
            if not source_profile_data:
                self.logger.error(f"Could not fetch source profile {triggering_user_id}. Cannot perform LLM reranking.")
                self.error_counter.inc()
                # Yield to error tag, as we can't proceed for this user_id
                yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                    "error_message": f"Failed to fetch source profile {triggering_user_id}", 
                    "triggering_user_id": triggering_user_id
                })
                return

            # Format source profile (now uses aiLyingScore from fetched profile directly)
            source_profile_fmt = self._format_profile_for_prompt(source_profile_data)
            # Placeholder for source_user_consistency_score - this would need to be calculated or fetched
            # e.g., from source_profile_data if stored there after lying score calculation
            source_user_consistency_score = source_profile_data.get('aggregateLyingScore') # Example, adapt to actual field name

            reranked_matches = []
            partial_rerank_profile_fetch_errors = []
            partial_rerank_llm_errors = []
            for candidate_info in candidates_list:
                matched_user_id = candidate_info.get('matched_user_id')
                if not matched_user_id:
                     self.logger.warning(f"Skipping candidate with missing matched_user_id for user {triggering_user_id}: {candidate_info}")
                     continue

                matched_profile_data = self._fetch_profile(matched_user_id)
                if not matched_profile_data:
                    self.logger.warning(f"Could not fetch profile for match {matched_user_id}. Skipping LLM rerank for this candidate.")
                    partial_rerank_profile_fetch_errors.append({
                        'error_message': f"RerankMatchesDoFn candidate profile fetch failed for {matched_user_id}",
                        'user_id': triggering_user_id,
                        'triggering_user_id': triggering_user_id,
                        'matched_user_id': matched_user_id,
                        'candidate_info': candidate_info,
                        'element': element,
                        'profile_role': 'candidate',
                        'partial_profile_fetch_failure': True,
                        'fallback_ai_score': 0,
                    })
                    # Add to reranked_matches with existing scores but no new AI score, or skip entirely
                    # For now, let's add with a default low AI score to keep it in the list if needed downstream
                    reranked_matches.append({
                        'id': matched_user_id,
                        'scoreboard_score': candidate_info.get('aggregated_score'),
                        'cross_encoder_score': candidate_info.get('cross_encoder_score'),
                        'ai_score': 0, # Default if LLM rerank fails for this candidate
                        'suggested_questions': [],
                        'sourceScoreboardUpdatedAt': candidate_info.get('last_updated'),
                        'notes': 'Profile fetch failed for LLM reranking'
                    })
                    continue
                
                # Format matched profile (currently without its own lying scores in the prompt)
                matched_profile_fmt = self._format_profile_for_prompt(matched_profile_data)

                ai_score, suggested_questions, llm_error_message = self._get_compatibility_score_and_questions(
                    source_profile_fmt,
                    matched_profile_fmt,
                    cross_encoder_score=candidate_info.get('cross_encoder_score'),
                    scoreboard_score=candidate_info.get('aggregated_score'),
                    source_user_consistency_score=source_user_consistency_score
                )
                if llm_error_message:
                    partial_rerank_llm_errors.append({
                        'error_message': llm_error_message,
                        'user_id': triggering_user_id,
                        'triggering_user_id': triggering_user_id,
                        'matched_user_id': matched_user_id,
                        'candidate_info': candidate_info,
                        'element': element,
                        'partial_llm_rerank_failure': True,
                        'fallback_ai_score': ai_score,
                        'fallback_suggested_questions': suggested_questions,
                    })

                reranked_matches.append({
                    'id': matched_user_id,
                    'scoreboard_score': candidate_info.get('aggregated_score'), 
                    'cross_encoder_score': candidate_info.get('cross_encoder_score'),
                    'ai_score': ai_score, # Score from LLM reranking
                    'suggested_questions': suggested_questions,
                    'sourceScoreboardUpdatedAt': candidate_info.get('last_updated'),
                    # 'metadata': candidate_info.get('original_pinecone_metadata') # If we passed original metadata through cross-encoder
                })

            reranked_matches.sort(key=lambda x: x['ai_score'], reverse=True)
            self.rerank_success_counter.inc(len(reranked_matches))

            for partial_rerank_profile_fetch_error in partial_rerank_profile_fetch_errors:
                yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, partial_rerank_profile_fetch_error)
            for partial_rerank_llm_error in partial_rerank_llm_errors:
                yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, partial_rerank_llm_error)

            yield {
                'user_id': triggering_user_id,
                'matches': reranked_matches,
                'user_qas': user_qas_for_triggering_user, # Pass through for downstream calculation
                'sourceScoreboardMaxUpdatedAt': source_scoreboard_max_updated_at,
                'matchWriteSourceVersion': source_scoreboard_max_updated_at,
            }

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Error in RerankMatchesDoFn for user {triggering_user_id}: {e}", exc_info=True)
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                 'user_id': triggering_user_id, # Changed from 'error' to 'user_id' for consistency
                 'error_message': str(e),
                 'original_element_tuple_part2': data_dict, 
                 'traceback': traceback.format_exc()
            })

@beam.ptransform_fn
def RerankAndScoreMatches(pcoll: beam.PCollection[Tuple[str, Dict[str, Any]]], 
                          project_id: str, 
                          profiles_collection: str, 
                          pdf_bucket: str, 
                          pdf_instructions_path: str) -> beam.PCollectionTuple:
    """Composite PTransform to rerank matches using an LLM.
       Input: PCollection of (triggering_user_id, data_dict) 
              where data_dict = {'candidates': list_of_enriched_candidates, 'user_qas': user_qas_dict}
    """
    return (
        pcoll
        | "RerankWithLLM" >> beam.ParDo(RerankMatchesDoFn(
            project_id=project_id,
            profiles_collection=profiles_collection,
            pdf_bucket=pdf_bucket,
            pdf_instructions_path=pdf_instructions_path
        )).with_outputs(RerankMatchesDoFn.OUTPUT_ERROR_TAG, main='main')
    )