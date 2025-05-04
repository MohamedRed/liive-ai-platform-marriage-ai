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
                'qa_id': qa_id,
                'answer': answer,
                'clarificationTag': clarification_tag,
                'question': question_text # Include if available
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
                'timestamp_utc': self.default(ts) # Use encoder for consistency
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