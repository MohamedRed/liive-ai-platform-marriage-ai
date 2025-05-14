# apps/marriage-ai/dataflow/pipelines/streaming/transforms/reranking.py
import apache_beam as beam
import logging
import json
import traceback
import io # For PDF reading
from datetime import datetime # For lying score history formatting
from typing import Dict, Any

# Import third-party libraries used within DoFns
import openai
import PyPDF2
from google.cloud import firestore, storage, secretmanager # Add secretmanager
from apache_beam.metrics import Metrics

# Import constants and metrics from common
from .common import MetricNames, COLLECTIONS # Import COLLECTIONS if needed here
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
        # Depending on criticality, either return empty string or raise error
        raise RuntimeError(f"Failed to read PDF instructions from gs://{bucket_name}/{file_path}") from e


# --- DoFn for Lying Score Calculation --- #

class CalculateLyingScoreDoFn(beam.DoFn):
    # Note: This DoFn assumes input related to QA changes, which might differ
    # from the main flow's `matches` PCollection. Adapt pipeline graph accordingly.
    def __init__(self, project_id: str):
        self.project_id = project_id
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('CalculateLyingScoreDoFn', MetricNames.ERRORS)
        self.openai_client = None
        self.db = None

    def setup(self):
        # Initialize OpenAI and Firestore clients
        try:
            self.db = firestore.Client(project=self.project_id)
            api_key = access_secret(self.project_id, "OPENAI_API_KEY")
            self.openai_client = openai.OpenAI(api_key=api_key)
            self.logger.info("CalculateLyingScoreDoFn setup complete (Firestore & OpenAI)")
        except Exception as e:
             self.logger.error(f"Failed CalculateLyingScoreDoFn setup: {e}", exc_info=True)
             raise

    def process(self, element):
        """Calculate lying score for modified QAs"""
        if not self.db or not self.openai_client:
             self.logger.error("Clients not initialized in CalculateLyingScoreDoFn. Skipping.")
             self.error_counter.inc()
             raise RuntimeError("Setup failed for CalculateLyingScoreDoFn")

        # Expecting element like: {'profile_id': ..., 'qa_id': ..., 'qa_data': ...}
        # This structure needs to be produced by an upstream transform.
        if not isinstance(element, dict) or 'profile_id' not in element or 'qa_id' not in element or 'qa_data' not in element:
            self.logger.error(f"Invalid input element format for CalculateLyingScoreDoFn: {element}")
            self.error_counter.inc()
            return

        profile_id = element['profile_id']
        qa_id = element['qa_id']
        qa_data = element['qa_data']
        question = qa_data.get('question')
        current_answer = qa_data.get('answer')

        if not question or not current_answer:
             self.logger.warning(f"Missing question or answer in qa_data for {profile_id}/{qa_id}. Skipping lying score.")
             return

        try:
            # self.logger.info(f"Calculating lying score for {profile_id}, QA: {qa_id}")
            # Get edit history from Firestore (using QA_EDIT_LOGS collection)
            # Adjust collection/field names based on actual Firestore structure
            edit_log_ref = self.db.collection(COLLECTIONS["QA_EDIT_LOGS"])
            query = edit_log_ref.where('profileId', '==', profile_id)\
                                .where('qaId', '==', qa_id)\
                                .order_by('timestamp', direction=firestore.Query.DESCENDING)\
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
                    ts = event_data.get('timestamp')
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
                     return # Don't yield if score parsing failed

            yield {
                'profile_id': profile_id,
                'qa_id': qa_id,
                'lying_score': lying_score
            }

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Error calculating lying score for {profile_id}/{qa_id}: {str(e)}\nTraceback: {traceback.format_exc()}", exc_info=True)
            raise

class UpdateLyingScoreDoFn(beam.DoFn):
    # Updates the calculated lying score back to the main user profile Q&A section
    def __init__(self, project_id: str):
        self.project_id = project_id
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('UpdateLyingScoreDoFn', MetricNames.ERRORS)
        self.update_counter = Metrics.counter('UpdateLyingScoreDoFn', 'lying_scores_updated')
        self.db = None

    def setup(self):
        try:
            self.db = firestore.Client(project=self.project_id)
            self.logger.info("UpdateLyingScoreDoFn setup complete (Firestore)")
        except Exception as e:
             self.logger.error(f"Failed UpdateLyingScoreDoFn setup: {e}", exc_info=True)
             raise

    def process(self, element):
        if not self.db:
             self.logger.error("Firestore client not initialized in UpdateLyingScoreDoFn. Skipping.")
             self.error_counter.inc()
             raise RuntimeError("Setup failed for UpdateLyingScoreDoFn")

        # Expecting {'profile_id': ..., 'qa_id': ..., 'lying_score': ...}
        if not isinstance(element, dict) or 'profile_id' not in element or 'qa_id' not in element or 'lying_score' not in element:
            self.logger.error(f"Invalid input element format for UpdateLyingScoreDoFn: {element}")
            self.error_counter.inc()
            return

        profile_id = element['profile_id']
        qa_id = element['qa_id']
        lying_score = element['lying_score']

        try:
            # self.logger.info(f"Updating lying score for {profile_id}, QA: {qa_id} to {lying_score:.2f}")
            # Assuming QAs are stored in a map/object within the profile document
            # Adjust path based on your Firestore structure (e.g., COLLECTIONS["USERS"] or profile collection)
            profile_ref = self.db.collection(COLLECTIONS["USERS"]).document(profile_id)
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
            raise # Propagate error for DLQ


# --- DoFn for Reranking --- #

class RerankMatchesDoFn(beam.DoFn):
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
            self.logger.info("RerankMatchesDoFn setup complete.")

        except Exception as e:
            self.logger.error(f"Failed RerankMatchesDoFn setup: {e}", exc_info=True)
            raise

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

    def _format_profile_for_prompt(self, profile, per_qa_scores):
        # Format profile Q&A for OpenAI prompt, using provided lying scores.
        # profile: The fetched profile data dict.
        # per_qa_scores: Dictionary of {qa_id: score} passed in the input element.
        formatted_profile = ""
        qa_data = profile.get("questions_answers", {}) # Use {} as default

        if isinstance(qa_data, dict):
             for qa_id, qa in qa_data.items():
                question = qa.get('question', '')
                answer = qa.get('answer', '')
                # Get score from the input dictionary, default to 0.0 if missing for this qa_id
                lying_score = per_qa_scores.get(qa_id, 0.0)
                formatted_profile += f"Q: {question}\nA: {answer} (AI Lying Score: {lying_score:.2f})\n"
        # Handle list format if needed, requires QA items in list to have an 'id'
        elif isinstance(qa_data, list):
             for qa_item in qa_data:
                 if isinstance(qa_item, dict) and 'id' in qa_item:
                      qa_id = qa_item['id']
                      question = qa_item.get('question', '')
                      answer = qa_item.get('answer', '')
                      lying_score = per_qa_scores.get(qa_id, 0.0)
                      formatted_profile += f"Q: {question}\nA: {answer} (AI Lying Score: {lying_score:.2f})\n"
                 else:
                      self.logger.warning(f"Skipping QA list item without ID during formatting: {qa_item}")

        # Add other profile fields if relevant for reranking
        # formatted_profile += f"Other Info: {profile.get('some_other_field', '')}\n"
        return formatted_profile.strip()

    def _get_compatibility_score_and_questions(self, source_profile_fmt, match_profile_fmt, aggregate_score_source=None, aggregate_score_match=None):
        # Get compatibility score and suggested questions from OpenAI.
        # Optionally include aggregate scores in the context.

        # TODO: Enhance prompt based on the 3-layer strategy (custom, foundational, cluster)

        context = ""
        if aggregate_score_source is not None:
            context += f"Note: Source User Overall Consistency Score: {aggregate_score_source:.2f} (0=Consistent, 1=Inconsistent based on edit history).\n"
        # We don't have the match's aggregate score unless fetched separately or also passed in.
        # if aggregate_score_match is not None:
        #     context += f"Note: Potential Match Overall Consistency Score: {aggregate_score_match:.2f}\n"

        # Using triple quotes for the prompt string for better readability
        prompt = f"""
        You are an AI assistant for a Muslim marriage platform. Your task is to evaluate the compatibility between two user profiles for marriage and suggest insightful follow-up questions.

        Analyze these two profiles for marriage compatibility based on Islamic values, personality, lifestyle, and goals. Consider the provided per-answer AI Lying Scores (0.0=trustworthy answer, 1.0=potential deception based on edit history) which indicate the stability and truthfulness of specific answers.
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
        1. Calculate a compatibility score from 0 to 100, where 100 is highly compatible. Consider shared values, potential conflicts, complementary traits, and the reliability indicated by the per-answer lying scores.
        2. Generate 3 concise, open-ended follow-up questions that the Source User could ask the Potential Match to clarify important areas, explore potential issues, or deepen understanding. Focus on questions related to:
            - Core religious practices and beliefs
            - Family values and expectations
            - Life goals and aspirations
            - Personality compatibility
            - Potential deal-breakers
        3. For each question, provide a brief rationale and categorize it into one section: religious_practice, family_values, education, personality, hobbies, lifestyle, goals.

        Provide your response ONLY in the following JSON format:
        {{ "score": <number between 0-100>, "suggested_questions": [ {{ "question": "<question text>", "rationale": "<why this question is important>", "section": "<relevant section>" }} ] }}
        """

        try:
            response = self.openai_client.chat.completions.create(
                model="o1-mini", # Consider making model configurable
                messages=[
                    {"role": "system", "content": self.ai_instructions}, # Use loaded PDF content as system prompt
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3, # Slightly creative but mostly factual
                response_format={ "type": "json_object" } # Use json_object type
            )
            result_str = response.choices[0].message.content
            result = json.loads(result_str)

            score = float(result.get('score', 0)) # Default score to 0
            # Validate questions structure
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

            return min(max(score, 0), 100), questions # Ensure score is 0-100
        except (ValueError, KeyError, json.JSONDecodeError) as e:
            # Corrected error logging f-string
            self.logger.error(f"Failed to call or parse AI response for compatibility: {str(e)}\nResponse string: '{result_str if 'result_str' in locals() else '[unavailable]'}'", exc_info=True)
            self.error_counter.inc()
            return 0, [] # Return default on error
        except Exception as e:
             self.logger.error(f"Unexpected error during AI call for compatibility: {str(e)}", exc_info=True)
             self.error_counter.inc()
             return 0, []

    def process(self, element: Dict[str, Any]):
        user_id = element.get('user_id')
        score_data = element.get('scores', {}) # Dict {'scores': {qa_id: score}, 'aggregate': agg_score}
        matches = element.get('matches', []) # List of {'id': ..., 'score': ..., 'metadata': ...}
        user_qas = element.get('user_qas', {}) # <<< NEW: Extract user_qas

        if not self.db or not self.openai_client or not self.ai_instructions:
             self.logger.error("Clients or instructions not initialized in RerankMatchesDoFn. Skipping.")
             self.error_counter.inc()
             # Use raise here because if setup fails, the worker is likely unusable
             raise RuntimeError("Setup failed for RerankMatchesDoFn")

        # Validate input structure
        if not isinstance(element, dict) or \
           'user_id' not in element or \
           'scores' not in element or \
           'matches' not in element or \
           not isinstance(element.get('scores'), dict) or \
           'scores' not in element.get('scores', {}) or \
           'aggregate' not in element.get('scores', {}):
            self.logger.error(f"Invalid input element format for RerankMatchesDoFn: {element}")
            self.error_counter.inc()
            # If input is invalid, cannot proceed. Depending on DLQ setup,
            # returning might send the malformed element, raising might be better if unrecoverable.
            # Let's return for now, assuming DLQ handles it.
            return

        try:
            # self.logger.info(f"Reranking {len(matches)} matches for user {user_id}")
            # Fetch source profile ONCE
            source_profile = self._fetch_profile(user_id)
            if not source_profile:
                self.logger.error(f"Could not fetch source profile {user_id}. Cannot perform reranking.")
                self.error_counter.inc()
                yield {
                    'user_id': user_id,
                    'matches': [], # Empty list for reranked matches
                    'user_qas': user_qas
                 }
                return

            # Format source profile using the provided scores
            source_profile_fmt = self._format_profile_for_prompt(source_profile, score_data.get('scores', {}))

            # Process each match
            reranked_matches = []
            for match in matches:
                match_id = match.get('id')
                if not match_id:
                     self.logger.warning(f"Skipping match with missing ID for user {user_id}: {match}")
                     continue

                # Fetch matched profile
                matched_profile = self._fetch_profile(match_id)
                if not matched_profile:
                    self.logger.warning(f"Could not fetch profile for match {match_id}. Skipping rerank for this match.")
                    continue # Skip this match if profile fetch fails

                # Format matched profile. NOTE: We don't have the matched user's scores here unless fetched separately.
                # The prompt currently only shows scores for Profile 1 (Source User).
                # Fetching scores for every match would add significant latency & cost.
                # For now, format without scores for the match.
                matched_profile_fmt = self._format_profile_for_prompt(matched_profile, {}) # Pass empty scores for match

                # Get AI score and questions, passing the source user's aggregate score
                ai_score, suggested_questions = self._get_compatibility_score_and_questions(
                    source_profile_fmt,
                    matched_profile_fmt,
                    aggregate_score_source=score_data.get('aggregate')
                )

                # Format the output to include both scores and questions
                reranked_matches.append({
                    'id': match_id,
                    'vector_score': match.get('score', 0.0), # Original Pinecone score
                    'ai_score': ai_score, # Score from OpenAI reranking
                    'suggested_questions': suggested_questions, # List of question dicts
                    'metadata': match.get('metadata') # Pass original metadata through
                })

            # Sort by AI score (highest first)
            reranked_matches.sort(key=lambda x: x['ai_score'], reverse=True)

            self.rerank_success_counter.inc(len(reranked_matches))

            # Yield the final result for this user_id
            yield {
                'user_id': user_id,
                'matches': reranked_matches, # The list of reranked match dictionaries
                'user_qas': user_qas
            }

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Error in RerankMatchesDoFn for user {user_id}: {e}", exc_info=True)
            # Optionally yield a tagged error or a specific structure if the main output path isn't taken
            # For now, let's assume it might re-raise or be handled by with_outputs in the main pipeline file.
            # To ensure the main output path structure is somewhat met for CalculateAdjustedTopMatchPercentage if an error happens before yielding:
            yield beam.pvalue.TaggedOutput(self.ERROR_TAG, {
                 'user_id': user_id,
                 'error': str(e),
                 'original_element': element # or specific parts of it
            })

# --- Composite PTransform --- #

@beam.ptransform_fn
def RerankAndScoreMatches(pcoll: beam.PCollection[dict], project_id: str, profiles_collection: str, pdf_bucket: str, pdf_instructions_path: str) -> beam.PCollection[dict]:
    """Composite PTransform to rerank matches using AI.

    Assumes the input PCollection provides elements like:
    {'user_id': ..., 'scores': {'scores': {qa_id: score}, 'aggregate': agg_score}, 'matches': [...]}
    Scores are used directly by the internal RerankMatchesDoFn.

    Args:
        pcoll: PCollection of dictionaries from Pinecone query
               ({'user_id': ..., 'scores': {'scores': {qa_id: score}, 'aggregate': agg_score}, 'matches': [...]}).
        project_id: GCP Project ID.
        profiles_collection: Firestore collection for user profiles.
        pdf_bucket: GCS bucket for AI instructions PDF.
        pdf_instructions_path: Path to AI instructions PDF within the bucket.

    Returns:
        PCollection of dictionaries with reranked matches
               ({'user_id': ..., 'matches': [...]}).
    """

    reranked = (
        pcoll
        | "RerankMatchesWithAI" >> beam.ParDo(RerankMatchesDoFn(
            project_id=project_id,
            profiles_collection=profiles_collection,
            pdf_bucket=pdf_bucket,
            pdf_instructions_path=pdf_instructions_path
        ))
        # Add error handling output here if RerankMatchesDoFn is modified to yield tagged errors
        # .with_outputs(...)
    )
    return reranked 