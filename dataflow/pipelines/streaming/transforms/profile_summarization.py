# apps/marriage-ai/dataflow/pipelines/streaming/transforms/profile_summarization.py
import apache_beam as beam
import logging
import hashlib
import json
import traceback
from datetime import datetime, timezone

# Import third-party libraries
import openai
from google.cloud import firestore
from apache_beam.metrics import Metrics

# Import utilities and common definitions
from ..utils import access_secret
# from .common import MetricNames # Assuming common metrics, can be defined here if specific

logger = logging.getLogger(__name__)

# --- Metrics for Profile Summarization ---
SUMMARY_GENERATION_SUCCESS = 'SummaryGenerationSuccess'
SUMMARY_GENERATION_ERRORS = 'SummaryGenerationErrors'
SUMMARY_STORE_SUCCESS = 'SummaryStoreSuccess'
SUMMARY_STORE_ERRORS = 'SummaryStoreErrors'
EMPTY_PROFILE_FOR_SUMMARY = 'EmptyProfileForSummary'

# TODO: Make LLM model name configurable (e.g., via common/config.py or pipeline args)
DEFAULT_SUMMARIZATION_MODEL = "gpt-3.5-turbo" 
# TODO: Get collection name from common/definitions.py once added
DEFAULT_PROFILE_SUMMARIES_COLLECTION = "MARRIAGE_PROFILE_SUMMARIES"


def generate_qas_hash(qas_data: dict) -> str:
    """Generates an MD5 hash of the Q&A data for versioning."""
    if not qas_data:
        return ""
    # Sort to ensure consistent hash for the same data regardless of order
    # This is important if Q&As are fetched as a dict and key order isn't guaranteed
    # or if they are a list and order might change but content is same.
    # For dicts, sorting items (key-value pairs) is good.
    # For lists of dicts, sorting the list based on a stable key (e.g., questionId) would be ideal.
    # Simple JSON dump with sorted keys is a good general approach for dicts.
    try:
        # Ensure deterministic serialization for hashing
        serialized_qas = json.dumps(qas_data, sort_keys=True, ensure_ascii=False)
        return hashlib.md5(serialized_qas.encode('utf-8')).hexdigest()
    except Exception as e:
        logger.error(f"Error generating hash for Q&A data: {e}")
        return "" # Fallback to empty string if hashing fails


class GenerateProfileSummaryDoFn(beam.DoFn):
    """Generates a profile summary using an LLM based on user's Q&As."""
    OUTPUT_ERROR_TAG = 'error'

    def __init__(self, project_id: str, model_name: str = DEFAULT_SUMMARIZATION_MODEL):
        self.project_id = project_id
        self.model_name = model_name
        self.logger = logging.getLogger(__name__)
        self.openai_client = None
        self.success_counter = Metrics.counter('GenerateProfileSummaryDoFn', SUMMARY_GENERATION_SUCCESS)
        self.error_counter = Metrics.counter('GenerateProfileSummaryDoFn', SUMMARY_GENERATION_ERRORS)
        self.empty_profile_counter = Metrics.counter('GenerateProfileSummaryDoFn', EMPTY_PROFILE_FOR_SUMMARY)
        
    def setup(self):
        self.logger.info(f"Setting up GenerateProfileSummaryDoFn. Initializing OpenAI client for model: {self.model_name}")
        try:
            api_key = access_secret(self.project_id, "OPENAI_API_KEY")
            self.openai_client = openai.OpenAI(api_key=api_key)
            self.logger.info("GenerateProfileSummaryDoFn setup complete (OpenAI client).")
        except Exception as e:
            self.logger.error(f"Failed GenerateProfileSummaryDoFn setup: {e}", exc_info=True)
            raise # Critical setup failure

    def _prepare_qas_for_prompt(self, questions_answers: dict | list) -> str:
        text_parts = []
        if isinstance(questions_answers, dict):
            for qa_id, qa_item in questions_answers.items():
                question = qa_item.get('question', '')
                answer = qa_item.get('answer', '')
                if question and answer:
                    text_parts.append(f"Q: {question}\nA: {answer}")
        elif isinstance(questions_answers, list):
            for qa_item in questions_answers:
                if isinstance(qa_item, dict):
                    question = qa_item.get('question', '')
                    answer = qa_item.get('answer', '')
                    if question and answer:
                        text_parts.append(f"Q: {question}\nA: {answer}")
        return "\n\n".join(text_parts)

    def process(self, element: Tuple[str, Dict[str, Any]]):
        # Input: (user_id, profile_data_dict)
        # profile_data_dict is expected to contain 'questions_answers'
        if not self.openai_client:
            self.logger.error("GenerateProfileSummaryDoFn not properly initialized. Skipping.")
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {"error_message": "DoFn not initialized", "element": element})
            return

        user_id, profile_data = element
        questions_answers = profile_data.get('questions_answers', {})

        if not questions_answers:
            self.logger.info(f"No Q&A data found for user {user_id}. Cannot generate summary.")
            self.empty_profile_counter.inc()
            # We might still want to output something to clear an old summary or write a 'no_summary' marker
            # For now, just return and don't yield to main output. Consider error tag if this is unexpected.
            return

        qas_text_for_prompt = self._prepare_qas_for_prompt(questions_answers)
        if not qas_text_for_prompt.strip():
            self.logger.info(f"Formatted Q&A text is empty for user {user_id}. Cannot generate summary.")
            self.empty_profile_counter.inc()
            return

        # Generate a hash of the Q&A data for versioning
        # This hash represents the version of the data used to generate this summary
        qas_version_hash = generate_qas_hash(questions_answers)

        # TODO: Refine this prompt. Make it configurable or load from a file/GCS.
        prompt = f"""
        Based on the following questions and answers from a user's profile on a Muslim marriage platform, please generate a concise and insightful summary (around 150-250 words). 
        The summary should highlight key aspects of their personality, religious views, values, lifestyle, and what they might be looking for in a partner. 
        This summary will be used by an AI to help find compatible matches, so focus on information that would be relevant for assessing compatibility. 
        Avoid including verbatim questions or answers if possible; instead, synthesize the information.

        User's Questions and Answers:
        ---
        {qas_text_for_prompt}
        ---

        Output only the summary text.
        """

        try:
            response = self.openai_client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.5, # Allow for some nuanced language
                max_tokens=350 # Roughly 250 words + buffer
            )
            summary_text = response.choices[0].message.content.strip()

            if not summary_text:
                self.logger.warning(f"LLM generated an empty summary for user {user_id}.")
                self.error_counter.inc() # Or a specific counter for empty LLM responses
                # Decide if we should yield to error or just log and not yield
                return

            self.success_counter.inc()
            yield (user_id, summary_text, qas_version_hash)

        except Exception as e:
            self.logger.error(f"Error generating summary for user {user_id}: {e}\nTraceback: {traceback.format_exc()}", exc_info=True)
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": f"LLM summary generation failed: {str(e)}",
                "user_id": user_id,
                "traceback": traceback.format_exc()
            })


class UpdateProfileSummaryInDedicatedCollectionDoFn(beam.DoFn):
    """Stores the generated profile summary in a dedicated Firestore collection."""
    OUTPUT_ERROR_TAG = 'error'

    def __init__(self, project_id: str, collection_name: str = DEFAULT_PROFILE_SUMMARIES_COLLECTION):
        self.project_id = project_id
        self.collection_name = collection_name # TODO: Ensure this comes from common/definitions.py
        self.db = None
        self.logger = logging.getLogger(__name__)
        self.success_counter = Metrics.counter('UpdateProfileSummaryInDedicatedCollectionDoFn', SUMMARY_STORE_SUCCESS)
        self.error_counter = Metrics.counter('UpdateProfileSummaryInDedicatedCollectionDoFn', SUMMARY_STORE_ERRORS)

    def setup(self):
        self.logger.info(f"Setting up UpdateProfileSummaryInDedicatedCollectionDoFn for collection: {self.collection_name}")
        try:
            self.db = firestore.Client(project=self.project_id)
            self.logger.info("UpdateProfileSummaryInDedicatedCollectionDoFn setup complete (Firestore client).")
        except Exception as e:
            self.logger.error(f"Failed UpdateProfileSummaryInDedicatedCollectionDoFn setup: {e}", exc_info=True)
            raise # Critical setup failure

    def process(self, element: Tuple[str, str, str]):
        # Input: (user_id, summary_text, qas_version_hash)
        if not self.db:
            self.logger.error("UpdateProfileSummaryInDedicatedCollectionDoFn not properly initialized. Skipping.")
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {"error_message": "DoFn not initialized", "element": element})
            return
        
        user_id, summary_text, qas_version_hash = element

        if not user_id or not summary_text: # qas_version_hash can be empty if generation failed
            self.logger.warning(f"Missing user_id or summary_text in element: {element}. Cannot store summary.")
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {"error_message": "Missing user_id or summary_text for storage", "element": element})
            return
            
        try:
            doc_ref = self.db.collection(self.collection_name).document(user_id)
            payload = {
                'userId': user_id,
                'profileSummaryText': summary_text,
                'qasVersionHash': qas_version_hash,
                'lastGeneratedAt': firestore.SERVER_TIMESTAMP # Use server timestamp
            }
            doc_ref.set(payload, merge=True) # Use set with merge=True to create or overwrite

            self.success_counter.inc()
            yield element # Pass through for potential further processing or logging

        except Exception as e:
            self.logger.error(f"Error storing summary for user {user_id} in {self.collection_name}: {e}\nTraceback: {traceback.format_exc()}", exc_info=True)
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": f"Firestore summary storage failed: {str(e)}",
                "user_id": user_id,
                "collection_name": self.collection_name,
                "traceback": traceback.format_exc()
            })


@beam.ptransform_fn
def GenerateAndStoreProfileSummary(
    pcoll: beam.PCollection[Tuple[str, Dict[str, Any]]],
    project_id: str,
    profile_summaries_collection: str, # Pass collection name
    summarization_model_name: str = DEFAULT_SUMMARIZATION_MODEL
) -> beam.PCollectionTuple:
    """
    Composite PTransform to generate a profile summary from Q&As and store it.

    Args:
        pcoll: PCollection of (user_id, profile_data_dict with 'questions_answers').
        project_id: GCP Project ID.
        profile_summaries_collection: Firestore collection name for storing summaries.
        summarization_model_name: Name of the LLM to use for summarization.
    
    Returns:
        A PCollectionTuple with 'main' output containing (user_id, summary_text, qas_version_hash)
        and 'error' outputs from both generation and storage steps.
    """
    generated_summaries, generation_errors = (
        pcoll
        | 'GenerateSummaryText' >> beam.ParDo(
            GenerateProfileSummaryDoFn(project_id=project_id, model_name=summarization_model_name)
          ).with_outputs(GenerateProfileSummaryDoFn.OUTPUT_ERROR_TAG, main='main')
    )

    stored_summaries, storage_errors = (
        generated_summaries
        | 'StoreSummaryInFirestore' >> beam.ParDo(
            UpdateProfileSummaryInDedicatedCollectionDoFn(project_id=project_id, collection_name=profile_summaries_collection)
          ).with_outputs(UpdateProfileSummaryInDedicatedCollectionDoFn.OUTPUT_ERROR_TAG, main='main')
    )
    
    # For now, just pass through the successfully stored summaries as the main output of the composite PTransform
    # Errors from both stages should be handled by the caller by accessing the PCollectionTuple directly
    # This PTransform doesn't merge error PCollections from sub-transforms.
    # The caller would access generation_errors and storage_errors separately.
    # If a single error output is desired, they would need to be Flattened.
    
    # For simplicity, let's define the PCollectionTuple explicitly for clarity.
    # The main output is what was successfully stored.
    # Errors are tagged separately from their respective stages.
    return beam.PCollectionTuple(
        main=stored_summaries, 
        generation_errors=generation_errors, 
        storage_errors=storage_errors
    ) 