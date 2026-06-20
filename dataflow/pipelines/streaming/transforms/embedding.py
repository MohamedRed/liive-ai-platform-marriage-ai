# apps/marriage-ai/dataflow/pipelines/streaming/transforms/embedding.py
import apache_beam as beam
import logging
import traceback
import openai # Keep import here as it's specific to this DoFn
import hashlib # For creating unique statement IDs if needed
from types import SimpleNamespace
from apache_beam.metrics import Metrics
from typing import Dict, Any, Tuple, List

# Import constants and metrics from common
# from .common import MetricNames # Assuming MetricNames might be defined elsewhere if needed globally
from ..utils import access_secret
from .eligibility import build_match_metadata

logger = logging.getLogger(__name__)

# Specific metrics for this DoFn with its new responsibilities
STATEMENT_EMBEDDING_ERRORS = 'StatementEmbeddingErrors'
STATEMENTS_PROCESSED_FOR_EMBEDDING = 'StatementsProcessedForEmbedding'
EMPTY_PARSED_STATEMENTS_LIST = 'EmptyParsedStatementsList'

class GenerateStatementEmbeddingsDoFn(beam.DoFn): # Renamed class
    """Generates embeddings for individual statements parsed from user answers."""
    OUTPUT_ERROR_TAG = 'error'

    def __init__(self, project_id: str):
        self.project_id = project_id
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('GenerateStatementEmbeddingsDoFn', STATEMENT_EMBEDDING_ERRORS)
        self.statements_processed_counter = Metrics.counter('GenerateStatementEmbeddingsDoFn', STATEMENTS_PROCESSED_FOR_EMBEDDING)
        self.empty_statements_list_counter = Metrics.counter('GenerateStatementEmbeddingsDoFn', EMPTY_PARSED_STATEMENTS_LIST)
        self.client = None
        self.setup_error_message = None

    def setup(self):
        self.logger.info("Setting up OpenAI client for statement embedding generation.")
        try:
            api_key = access_secret(self.project_id, "OPENAI_API_KEY")
            self.client = openai.OpenAI(api_key=api_key)
            self.setup_error_message = None
            self.logger.info("OpenAI client setup complete for statement embedding.")
        except Exception as e:
            self.setup_error_message = f"GenerateStatementEmbeddingsDoFn setup failed: {e}"
            self.logger.error(self.setup_error_message, exc_info=True)

    def _get_embedding(self, text: str) -> List[float]:
        """Get embedding for a single text using the initialized client."""
        if not self.client:
            error_message = self.setup_error_message or "GenerateStatementEmbeddingsDoFn setup failed"
            raise RuntimeError(error_message)
        try:
            response = self.client.embeddings.create(
                model="text-embedding-3-large", # Consider making model configurable via config.py
                input=text,
                encoding_format="float"
            )
            return response.data[0].embedding
        except Exception as e:
            self.logger.error(f"OpenAI embedding API call failed for text '{text[:100]}...': {e}", exc_info=True)
            raise

    def process(self, element: Dict[str, Any]):
        """Processes an element containing parsed statements and generates embeddings for each."""
        if not self.client:
            error_message = self.setup_error_message or "GenerateStatementEmbeddingsDoFn setup failed"
            self.logger.error("%s. Skipping statement embedding generation.", error_message)
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": error_message,
                "element": element,
            })
            return

        if not isinstance(element, dict):
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": "Invalid statement embedding input shape",
                "element": element,
            })
            return

        parsed_statements = element.get('parsed_statements')
        profile_match_metadata = build_match_metadata(element.get('profile_data'))
        # user_id_from_element = element.get('user_id') # The top-level user_id from the element

        if parsed_statements is None:
            self.logger.error("Missing parsed_statements for statement embedding. Element: %s", element)
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": "Missing parsed_statements for statement embedding",
                "element": element,
            })
            return

        if not isinstance(parsed_statements, list):
            self.logger.error("Invalid parsed_statements shape for statement embedding: %s. Element: %s", type(parsed_statements), element)
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": "Invalid parsed_statements shape for statement embedding",
                "element": element,
                "parsed_statements_type": str(type(parsed_statements)),
            })
            return

        if not parsed_statements:
            self.logger.warning(f"No parsed_statements found in element for user '{element.get('user_id', 'UNKNOWN')}', original_qid '{element.get('question_id', 'UNKNOWN')}'. Element: {element}")
            self.empty_statements_list_counter.inc()
            return # Don't yield if no statements to process

        for stmt_index, statement_data in enumerate(parsed_statements):
            try:
                user_id = statement_data.get('user_id') if isinstance(statement_data, dict) else None
                original_question_id = statement_data.get('original_question_id') if isinstance(statement_data, dict) else None
                original_question_text = statement_data.get('original_question_text') if isinstance(statement_data, dict) else None
                statement_text = statement_data.get('statement_text') if isinstance(statement_data, dict) else None
                facet = statement_data.get('facet') if isinstance(statement_data, dict) else None # This is crucial

                if not all([user_id, original_question_id, original_question_text, statement_text, facet]):
                    self.logger.warning(f"Skipping statement due to missing fields: {statement_data} from element for user '{element.get('user_id', 'UNKNOWN')}'")
                    self.error_counter.inc() # Count this specific statement as an error
                    yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                        "error_message": "Statement missing required embedding fields",
                        "element": element,
                        "statement": statement_data,
                        "statement_index": stmt_index,
                    })
                    continue

                text_to_embed = f"Question: {original_question_text} [SEP] Statement: {statement_text}"
                
                embedding_vector = self._get_embedding(text_to_embed)

                # Create a unique ID for the statement vector
                # Using an index to ensure uniqueness within the context of a single original answer being processed.
                # A more globally unique ID might be needed if these can be reprocessed independently.
                vector_id = f"{user_id}|{original_question_id}|stmt_{stmt_index}"
                # Alternative: hash the statement text for more deterministic ID if content doesn't change
                # statement_hash = hashlib.md5(statement_text.encode()).hexdigest()[:8]
                # vector_id = f"{user_id}|{original_question_id}|{statement_hash}"

                metadata = {
                    'user_id': str(user_id),
                    'original_question_id': str(original_question_id),
                    'original_question_text': original_question_text, # For context/inspection
                    'statement_text': statement_text, # The actual text of the statement
                    'facet': facet, # The determined facet for THIS statement
                    'statement_index': stmt_index, # Useful for ordering/debugging
                    **profile_match_metadata,
                    # 'is_critical': False, # Placeholder, or derive from original question properties if available
                    # 'section': original_question_data.get('section', 'default') # If section is tied to original question
                }
                
                self.statements_processed_counter.inc()
                yield (vector_id, embedding_vector, metadata)

            except Exception as e:
                # Catch errors for individual statements to allow other statements in the same element to proceed.
                self.error_counter.inc()
                statement_id_for_log = f"user '{element.get('user_id', 'UNKNOWN')}', original_qid '{statement_data.get('original_question_id', 'UNKNOWN') if isinstance(statement_data, dict) else 'UNKNOWN'}', stmt_idx {stmt_index}"
                self.logger.error(f"Error generating embedding for statement {statement_id_for_log}: {str(e)}\nTraceback: {traceback.format_exc()}", exc_info=True)
                yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                    "error_message": f"Error generating embedding for statement {statement_id_for_log}: {str(e)}",
                    "element": element,
                    "statement": statement_data,
                    "statement_index": stmt_index,
                    "traceback": traceback.format_exc(),
                })

@beam.ptransform_fn
def GenerateEmbeddingsForStatements(pcoll: beam.PCollection[Dict[str, Any]], project_id: str) -> SimpleNamespace:
    """Composite PTransform to generate embeddings for individual parsed statements.

    Args:
        pcoll: PCollection of dictionaries (output from ParseAnswerIntoStatements), 
               where each dict contains a 'parsed_statements' list.
        project_id: GCP Project ID.

    Returns:
        SimpleNamespace with:
        - main: tuples (vector_id, embedding_vector, metadata_dict) for each statement.
        - error: structured statement embedding errors for DLQ persistence.
    """
    embedding_results = (
        pcoll
        | "GenerateStatementEmbeddings" >> beam.ParDo(GenerateStatementEmbeddingsDoFn(project_id))
          .with_outputs(GenerateStatementEmbeddingsDoFn.OUTPUT_ERROR_TAG, main='main')
    )
    return SimpleNamespace(main=embedding_results.main, error=embedding_results[GenerateStatementEmbeddingsDoFn.OUTPUT_ERROR_TAG])
