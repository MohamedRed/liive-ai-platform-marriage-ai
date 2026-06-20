# apps/marriage-ai/dataflow/pipelines/streaming/transforms/common.py
import apache_beam as beam
import logging
import json
import traceback
import time
from datetime import datetime
from apache_beam.metrics import Metrics
from apache_beam.io.filesystems import FileSystems
from google.protobuf.timestamp_pb2 import Timestamp # Needed for DLQ
from ..common.definitions import COLLECTIONS # Ensure COLLECTIONS is available
from google.cloud import firestore
from typing import Tuple, Dict, Any

# Configure logging (can be configured once in the main script)
# logger = logging.getLogger(__name__) # Each module can get its own logger if needed

class MetricNames:
    PROCESSED = 'processed_profiles'
    ERRORS = 'processing_errors'
    QUERIES = 'pinecone_queries'

class DebugLogDoFn(beam.DoFn):
    """DoFn for debugging pipeline steps"""
    def __init__(self, step_name):
        self.step_name = step_name
        self.logger = logging.getLogger(__name__) # Get logger for this specific instance

    def process(self, element):
        try:
            self.logger.info(f"\n=== {self.step_name} ===")
            self.logger.info(f"Element type: {type(element)}")
            # Attempt to serialize complex objects for logging
            try:
                if isinstance(element, dict):
                     log_content = json.dumps(element, indent=2, default=str) # Add default=str for non-serializable types
                elif hasattr(element, '__dict__'):
                     log_content = json.dumps(element.__dict__, indent=2, default=str)
                else:
                    log_content = str(element)
                self.logger.info(f"Element content: {log_content}")
            except TypeError as json_err:
                 self.logger.warning(f"Could not JSON serialize element for debug log: {json_err}. Falling back to str().")
                 self.logger.info(f"Element content (fallback): {str(element)}")

            yield element
        except Exception as e:
            # Log error but still yield element to avoid breaking pipeline
            self.logger.error(f"Error during logging in {self.step_name}: {str(e)}")
            yield element

class ParseFirestoreTriggerEventDoFn(beam.DoFn):
    """Parses a Pub/Sub message containing Firestore change event data.

    Assumes the message data is JSON encoded and contains user_id and details
    about the specific Q&A change that triggered the event.
    """
    OUTPUT_ERROR_TAG = 'errors'

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('ParseFirestoreTriggerEventDoFn', MetricNames.ERRORS)
        self.missing_data_counter = Metrics.counter('ParseFirestoreTriggerEventDoFn', 'missing_trigger_data')

    def process(self, element: beam.io.ReadFromPubSub.PubsubMessage):
        try:
            # Decode message data
            try:
                message_data_str = element.data.decode('utf-8')
                event_data = json.loads(message_data_str)
            except (AttributeError, UnicodeDecodeError, json.JSONDecodeError) as e:
                self.logger.error(f"Failed to decode/parse Pub/Sub message data: {e}. Data: {element.data[:200]}...", exc_info=True)
                self.error_counter.inc()
                yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': f'Message parsing failed: {e}', 'raw_data': repr(element.data)})
                return

            # Extract required fields (adjust based on actual event structure)
            user_id = event_data.get('user_id')
            triggering_qa = event_data.get('triggering_qa') # Assuming nested structure

            if not isinstance(triggering_qa, dict):
                self.logger.warning(f"Missing or invalid 'triggering_qa' structure in event data for user {user_id}. Event: {event_data}")
                self.missing_data_counter.inc()
                yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': 'Missing triggering_qa structure', 'event_data': event_data})
                return

            qa_id = triggering_qa.get('qa_id')
            answer = triggering_qa.get('answer')
            clarification_tag = triggering_qa.get('clarificationTag') # May be None if not present
            question_text = triggering_qa.get('question') # Optional

            # Validate essential fields
            if not user_id or not qa_id or answer is None: # Allow empty string answer, but not None
                self.logger.warning(f"Missing essential fields (user_id, qa_id, or answer) in parsed event. User: {user_id}, QA: {qa_id}, Answer Type: {type(answer)}. Event: {event_data}")
                self.missing_data_counter.inc()
                yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': 'Missing essential fields', 'event_data': event_data})
                return

            # Output the parsed and validated data
            output_dict = {
                'user_id': user_id,
                'question_id': qa_id,
                'answer_text': answer,
                'clarificationTag': clarification_tag,
                'question_text': question_text
            }
            yield output_dict

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Unexpected error parsing trigger event: {e}", exc_info=True)
            # Output raw data to DLQ on unexpected errors
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': f'Unexpected error: {e}', 'raw_data': repr(element.data)})

class ExtractUserIDDoFn(beam.DoFn):
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        # Metrics counters should be initialized once per worker, Beam handles this.
        # It's okay to define them here.
        self.error_counter = Metrics.counter('ExtractUserIDDoFn', MetricNames.ERRORS)

    def process(self, element):
        # element can be PubsubMessage or dict (from test/other sources)
        try:
            # self.logger.info(f"Processing PubSub element: {element}") # Can be verbose
            user_id = None
            attributes = {}

            # Handle beam's PubsubMessage structure
            if hasattr(element, 'attributes') and isinstance(element.attributes, dict):
                attributes = element.attributes
                user_id = attributes.get('user_id')
            elif isinstance(element, dict):
                 # Dictionary format (e.g., from DLQ read or test)
                attributes = element.get('attributes', {}) # Get attributes dict if nested
                user_id = attributes.get('user_id')

                # Handle case where the element dict *is* the attributes
                if not user_id and 'user_id' in element:
                    user_id = element.get('user_id')
                    # In this case, the element itself might be what we want to log/pass to DLQ
                    attributes = element
            else:
                 self.logger.warning(f"Received unexpected element type for user ID extraction: {type(element)}")
                 # Decide what to do - skip, error, etc.
                 return

            if not user_id:
                self.logger.error("No user_id found in PubSub message attributes", extra={"attributes": attributes})
                # Let DLQ handle this - don't yield
                return

            # self.logger.info(f"Extracted user_id: {user_id}") # Can be verbose
            yield user_id

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Error extracting user_id: {str(e)}\nTraceback: {traceback.format_exc()}", exc_info=True)
            # Re-raising stops the element processing. The pipeline needs a DeadLetter sink.
            raise

class WriteToDLQFn(beam.DoFn):
    """Custom DoFn to write DLQ records to GCS"""
    def __init__(self, output_path):
        self.output_path = output_path
        self.logger = logging.getLogger(__name__)
        self.dlq_write_errors = Metrics.counter('WriteToDLQFn', 'dlq_write_errors')

    def process(self, failed_element_info):
        """
        Processes information about a failed element.
        Expects input from a DeadLetter sink, typically a PCollection of tuples:
        (failed_element, exception_object or error_string)
        Or a PCollection of Beam Row objects if using with_exception_handling
        """
        failed_element = None
        error_info = None
        trace = None

        # Handle different input types from error handling mechanisms
        if isinstance(failed_element_info, tuple) and len(failed_element_info) == 2:
            failed_element, error_info = failed_element_info
        elif isinstance(failed_element_info, beam.Row):
            # Assuming structure from .with_exception_handling()
            failed_element = getattr(failed_element_info, 'element', None)
            error_info = getattr(failed_element_info, 'exception', 'Unknown error')
            # traceback might not be readily available here, depends on beam version/details
        else:
            self.logger.error(f"Received unexpected input type in WriteToDLQFn: {type(failed_element_info)}")
            failed_element = failed_element_info # Best guess
            error_info = 'Unknown error structure'

        serialized_error = str(error_info)
        if isinstance(error_info, Exception):
            # Get traceback if possible
            tb_list = traceback.format_exception(type(error_info), error_info, error_info.__traceback__)
            trace = "".join(tb_list)
            serialized_error = f"{type(error_info).__name__}: {str(error_info)}"

        class CustomJSONEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, (datetime, Timestamp)):
                    try:
                        # Use ISO format for better readability and standard parsing
                        dt_obj = obj if isinstance(obj, datetime) else datetime.fromtimestamp(obj.seconds + obj.nanos / 1e9)
                        return dt_obj.isoformat() + 'Z' # Indicate UTC if applicable
                    except Exception:
                         return repr(obj)
                if isinstance(obj, bytes):
                    try:
                        return obj.decode('utf-8', errors='replace') # Attempt to decode bytes
                    except Exception:
                         return repr(obj) # Fallback for non-decodable bytes
                # Handle Beam's PubsubMessage if passed directly
                if type(obj).__name__ == 'PubsubMessage':
                    return {
                        'data': self.default(getattr(obj, 'data', None)), # Recurse on data
                        'attributes': getattr(obj, 'attributes', {}),
                        'message_id': getattr(obj, 'message_id', None),
                        # publish_time might be google.protobuf.Timestamp
                        'publish_time': self.default(getattr(obj, 'publish_time', None))
                    }
                try:
                    # Try standard JSON encoding first
                    return super().default(obj)
                except TypeError:
                    # Fallback for other non-serializable types
                    return repr(obj)

        try:
            # Create a unique filename using timestamp
            ts = datetime.utcnow()
            # Ensure output_path is treated as a directory path
            filename = FileSystems.join(self.output_path.rstrip('/'), f"dlq-{ts.strftime('%Y%m%d-%H%M%S')}-{int(ts.timestamp() * 1000)}.json")

            record = {
                'failed_element': failed_element,
                'error_message': serialized_error,
                'error_traceback': trace,
                'timestamp_utc': ts.isoformat() + 'Z'
            }

            # Write the record to GCS using custom encoder
            self.logger.info(f"Writing failed record to DLQ: {filename}")
            with FileSystems.create(filename) as f:
                # Ensure consistent encoding
                f.write(json.dumps(record, cls=CustomJSONEncoder, indent=2).encode('utf-8'))

            # DLQ sinks usually terminate the branch, no yield needed.

        except Exception as e:
            self.dlq_write_errors.inc()
            self.logger.error(f"FATAL: Failed to write DLQ record to {self.output_path}: {str(e)}", exc_info=True)
            # If writing to DLQ fails, we lose the record. Log thoroughly. 

# --- Fetch User History for Candidate Generation --- #
class FetchUserHistoryDoFn(beam.DoFn):
    """Fetches the Q&A history (questions map) for a user from Firestore."""
    # HISTORY_TAG was for CoGroupByKey, not an output tag here. Main output is implicit.
    ERROR_TAG = 'error'     # Tag for error output

    # Metrics constants
    FETCH_HISTORY_SUCCESS = 'FetchHistorySuccess'
    FETCH_HISTORY_ERRORS = 'FetchHistoryErrors'
    FETCH_HISTORY_NOT_FOUND = 'FetchHistoryNotFound' # User/QAs doc not found or no 'questions' field
    FETCH_HISTORY_MISSING_UID = 'FetchHistoryMissingUserId'

    def __init__(self, project_id: str, qa_collection_name: str):
        self.project_id = project_id
        self.qa_collection_name = qa_collection_name
        self.db = None
        self.logger = logging.getLogger(__name__)
        
        # Metrics
        self.success_counter = Metrics.counter(self.__class__.__name__, self.FETCH_HISTORY_SUCCESS)
        self.error_counter = Metrics.counter(self.__class__.__name__, self.FETCH_HISTORY_ERRORS)
        self.not_found_counter = Metrics.counter(self.__class__.__name__, self.FETCH_HISTORY_NOT_FOUND)
        self.missing_uid_counter = Metrics.counter(self.__class__.__name__, self.FETCH_HISTORY_MISSING_UID)

    def setup(self):
        try:
            self.db = firestore.Client(project=self.project_id)
            self.logger.info(f"{self.__class__.__name__}: Firestore client initialized for project {self.project_id}.")
        except Exception as e:
            self.logger.error(f"{self.__class__.__name__}: Failed to initialize Firestore client in setup: {str(e)}", exc_info=True)
            # Allow pipeline to start, but process method will fail if db is None
            # Alternatively, raise e to fail fast if DB is critical for all elements.
            # For now, let process handle db being None.
            # raise # Uncomment to fail fast

    def process(self, element: Dict[str, Any]):
        # Expected input element: Dict from ParseFirestoreTriggerEventDoFn, e.g., {'user_id': ..., 'qa_id': ...}
        user_id = element.get('user_id')

        if not user_id:
            self.logger.warning(f"{self.__class__.__name__}: Missing user_id in input element: {element}")
            self.missing_uid_counter.inc()
            yield beam.pvalue.TaggedOutput(self.ERROR_TAG, {
                "error_message": "Missing user_id in input element",
                "element": element,
                "traceback": traceback.format_exc() # Will show where get was called on None if that's the case
            })
            return

        if not self.db:
            self.logger.error(f"{self.__class__.__name__}: Firestore client not initialized. Cannot fetch history for {user_id}.")
            self.error_counter.inc() # Counts as a processing error
            yield beam.pvalue.TaggedOutput(self.ERROR_TAG, {
                "error_message": "Firestore client not initialized",
                "user_id": user_id,
                "element": element
            })
            return

        try:
            # self.logger.info(f"{self.__class__.__name__}: Fetching Q&A history for user: {user_id} from collection: {self.qa_collection_name}")
            qas_doc_ref = self.db.collection(self.qa_collection_name).document(user_id)
            qas_doc = qas_doc_ref.get()

            questions_answers_map = {}
            if qas_doc.exists:
                qas_data = qas_doc.to_dict()
                if qas_data and 'questions' in qas_data and isinstance(qas_data['questions'], dict):
                    questions_answers_map = qas_data['questions']
                    self.success_counter.inc()
                    # self.logger.info(f"{self.__class__.__name__}: Successfully fetched history for {user_id} with {len(questions_answers_map)} QAs.")
                else:
                    self.logger.warning(f"{self.__class__.__name__}: Q&A document for user {user_id} found, but 'questions' field is missing, empty, or not a dict. Data: {qas_data}")
                    self.not_found_counter.inc() # History technically not found in expected format
                    # Yield empty map for this case, as user exists but history is malformed/empty
            else:
                self.logger.warning(f"{self.__class__.__name__}: No Q&A document found for user {user_id} in {self.qa_collection_name}. History will be empty.")
                self.not_found_counter.inc()
                # Yield empty map, user might be new or QAS doc not created yet

            # Yield to main output: (user_id, questions_answers_map)
            # This matches the expected structure for 'user_history_keyed' in streaming.py
            yield (user_id, questions_answers_map)

        except Exception as e:
            self.logger.error(f"{self.__class__.__name__}: Error fetching Q&A history for user {user_id}: {str(e)}", exc_info=True)
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.ERROR_TAG, {
                "error_message": f"Failed to fetch Q&A history for {user_id}: {str(e)}",
                "user_id": user_id,
                "element": element, # Original input element for context
                "traceback": traceback.format_exc()
            })

# --- Fetch Full Q&As for Summarization/Other Processing --- #
FETCH_FULL_QAS_SUCCESS = 'FetchFullQAsSuccess'
FETCH_FULL_QAS_ERRORS = 'FetchFullQAsErrors'
FETCH_FULL_QAS_NOT_FOUND = 'FetchFullQAsNotFound'

class FetchFullQAsDoFn(beam.DoFn):
    """Fetches the full Q&A document (questions_answers map) for a user from Firestore."""
    OUTPUT_ERROR_TAG = 'error'

    def __init__(self, project_id: str, qa_collection_name: str):
        self.project_id = project_id
        self.qa_collection_name = qa_collection_name # e.g., COLLECTIONS['MARRIAGE']['QAS']
        self.db = None
        self.logger = logging.getLogger(__name__)
        self.success_counter = Metrics.counter('FetchFullQAsDoFn', FETCH_FULL_QAS_SUCCESS)
        self.error_counter = Metrics.counter('FetchFullQAsDoFn', FETCH_FULL_QAS_ERRORS)
        self.not_found_counter = Metrics.counter('FetchFullQAsDoFn', FETCH_FULL_QAS_NOT_FOUND)
        self.setup_error_message = None

    def setup(self):
        try:
            self.db = firestore.Client(project=self.project_id)
            self.setup_error_message = None
            self.logger.info(f"FetchFullQAsDoFn: Firestore client initialized for project {self.project_id}.")
        except Exception as e:
            self.setup_error_message = f"FetchFullQAsDoFn setup failed: {str(e)}"
            self.logger.error(self.setup_error_message, exc_info=True)

    def process(self, element: Tuple[str, Dict[str, Any]]):
        # Input element: (user_id, passthrough_data_dict)
        # passthrough_data_dict is the original element we want to enrich, e.g., output of ProcessAndValidateProfile
        # which is like {'user_id': ..., 'profile_data': actual_profile_from_user_info_coll, ...other_fields}
        user_id, passthrough_data = element

        if not self.db:
            error_message = self.setup_error_message or "Firestore client not initialized"
            self.logger.error("FetchFullQAsDoFn: %s. Skipping Q&A fetch.", error_message)
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {"error_message": error_message, "element": element})
            return
        
        if not user_id:
            self.logger.warning(f"FetchFullQAsDoFn: Missing user_id in input element: {element}")
            self.error_counter.inc()
            # Decide if this should go to error tag or just be dropped
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {"error_message": "Missing user_id in input", "element": element})
            return

        try:
            # self.logger.info(f"Fetching Q&As for user: {user_id} from {self.qa_collection_name}")
            qas_doc_ref = self.db.collection(self.qa_collection_name).document(user_id)
            qas_doc = qas_doc_ref.get()

            questions_answers_map = {}
            if qas_doc.exists:
                qas_data = qas_doc.to_dict()
                if qas_data and 'questions' in qas_data: # 'questions' is the map as per marriage.ts
                    questions_answers_map = qas_data['questions']
                    self.success_counter.inc()
                else:
                    self.logger.warning(f"Q&A document for user {user_id} exists but has no 'questions' field or is empty. Data: {qas_data}")
                    self.not_found_counter.inc() # Or a different counter for malformed data
            else:
                self.logger.warning(f"No Q&A document found for user {user_id} in {self.qa_collection_name}. Summary will be based on empty Q&As.")
                self.not_found_counter.inc()
            
            # Enrich the passthrough_data. If it contains 'profile_data', add to it.
            # Otherwise, create a new structure. 
            # The goal is that the output element for GenerateProfileSummaryDoFn is (user_id, dict_containing_qas)
            
            # The output of ProcessAndValidateProfile is a dict, not a tuple.
            # Let's assume the input to this DoFn will be the direct output of ProcessAndValidateProfile
            # which is: {'user_id': ..., 'profile_data': profile_from_user_info, ...other_fields}
            # So, `element` here should be that dict, and we should key it by user_id before this DoFn if it's not already.
            # For now, let's stick to the (user_id, passthrough_data) input assumption for this DoFn.

            # Construct the output. The PTransform wrapper will handle input keying.
            # We are creating a new dictionary that will be the second element of the output tuple.
            # It includes the original profile data and the fetched Q&As.
            output_profile_data_for_summary = passthrough_data.get('profile_data', {})
            output_profile_data_for_summary['questions_answers'] = questions_answers_map
            
            # Yield (user_id, enriched_profile_data_for_summary_input)
            # where enriched_profile_data_for_summary_input is what GenerateProfileSummaryDoFn expects as its second tuple element.
            yield (user_id, output_profile_data_for_summary)

        except Exception as e:
            self.logger.error(f"Error fetching Q&As for user {user_id}: {str(e)}\nTraceback: {traceback.format_exc()}", exc_info=True)
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": f"Failed to fetch Q&As for {user_id}: {str(e)}", 
                "user_id": user_id,
                "original_passthrough_data": passthrough_data,
                "traceback": traceback.format_exc()
            })

@beam.ptransform_fn
def FetchFullQAsForUser(pcoll: beam.PCollection[Dict[str,Any]], 
                        project_id: str, 
                        qa_collection_name: str) -> beam.PCollectionTuple:
    """ PTransform to fetch the full Q&A document for a user.
        Input: PCollection of dictionaries (e.g., from ProcessAndValidateProfile) that contain a 'user_id'.
        Output: PCollectionTuple with 'main' as (user_id, enriched_profile_data_dict) 
                where enriched_profile_data_dict contains the original 'profile_data' 
                from the input element, now augmented with a 'questions_answers' map.
                And 'error' tag for errors.
    """
    return (
        pcoll
        # Key the input PCollection by user_id, passing through the original element as value
        | 'KeyByUserForQAFetch' >> beam.Map(lambda x: (x['user_id'], x)) 
        | 'FetchQADocument' >> beam.ParDo(
            FetchFullQAsDoFn(project_id=project_id, qa_collection_name=qa_collection_name)
          ).with_outputs(FetchFullQAsDoFn.OUTPUT_ERROR_TAG, main='main')
    ) 