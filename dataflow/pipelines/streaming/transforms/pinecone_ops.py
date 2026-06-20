# apps/marriage-ai/dataflow/pipelines/streaming/transforms/pinecone_ops.py
import apache_beam as beam
import logging
import time
import traceback
from apache_beam.metrics import Metrics
from typing import Tuple, List, Dict, Any # Added for type hints

# Import constants and metrics from common
from .common import MetricNames
# Import utility functions
from ..utils import access_secret
from .eligibility import build_pinecone_hard_filter

logger = logging.getLogger(__name__)


class DeleteStaleQuestionVectorsDoFn(beam.DoFn):
    """Deletes old Pinecone vectors for a user's question before re-embedding it.

    Answer edits can change the number and content of parsed statements. The
    embedding step uses deterministic statement ids for the current parse, so
    upsert overwrites matching ids, but it cannot remove extra vectors left over
    from an older answer with more statements. This DoFn runs once per parsed
    answer, deletes every vector for that user/question filter, and then passes
    the element downstream for fresh embedding generation.
    """

    OUTPUT_ERROR_TAG = 'error'

    def __init__(self, project_id, pinecone_region, pinecone_index):
        self.project_id = project_id
        self.pinecone_region = pinecone_region
        self.pinecone_index_name = pinecone_index
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('DeleteStaleQuestionVectorsDoFn', MetricNames.ERRORS)
        self.delete_counter = Metrics.counter('DeleteStaleQuestionVectorsDoFn', 'pinecone_question_vector_deletes')
        self.index = None
        self.pc = None
        self.setup_error_message = None

    def setup(self):
        self.logger.info(f"Setting up Pinecone client for stale-vector cleanup in region {self.pinecone_region}")
        try:
            from pinecone.grpc import PineconeGRPC

            self.pc = PineconeGRPC(
                api_key=access_secret(self.project_id, "PINECONE_API_KEY"),
                environment=self.pinecone_region,
            )
            index_name_formatted = self.pinecone_index_name.lower().replace('_', '-')
            if index_name_formatted not in self.pc.list_indexes().names:
                raise ValueError(f"Pinecone index '{index_name_formatted}' not found.")
            self.index = self.pc.Index(index_name_formatted)
            self.setup_error_message = None
            self.logger.info(f"Successfully connected to Pinecone index '{index_name_formatted}' for stale-vector cleanup.")
        except Exception as e:
            self.setup_error_message = f"Pinecone stale-vector cleanup setup failed: {e}"
            self.logger.error(self.setup_error_message, exc_info=True)

    def process(self, element: Dict[str, Any]):
        if not self.index:
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": self.setup_error_message or "Pinecone index not initialized in stale-vector cleanup",
                "element": element,
            })
            return

        user_id = element.get('user_id')
        question_id = element.get('question_id')
        if not user_id or not question_id:
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": "Missing user_id or question_id for stale-vector cleanup",
                "element": element,
            })
            return

        try:
            delete_filter = {
                'user_id': str(user_id),
                'original_question_id': str(question_id),
            }
            self.index.delete(filter=delete_filter)
            self.delete_counter.inc()
            yield element
        except Exception as e:
            self.error_counter.inc()
            self.logger.error(
                f"Failed to delete stale Pinecone vectors for user={user_id}, question={question_id}: {e}\n"
                f"Traceback: {traceback.format_exc()}",
                exc_info=True,
            )
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": f"Pinecone stale-vector delete failed: {str(e)}",
                "element": element,
                "traceback": traceback.format_exc(),
            })


@beam.ptransform_fn
def DeleteStaleQuestionVectors(pcoll: beam.PCollection[Dict[str, Any]],
                               project_id: str,
                               pinecone_region: str,
                               pinecone_index: str) -> beam.PCollectionTuple:
    """Delete previous vectors for each edited question before re-embedding."""
    return (
        pcoll
        | 'DeleteStaleQuestionVectorsInPinecone' >> beam.ParDo(
            DeleteStaleQuestionVectorsDoFn(
                project_id=project_id,
                pinecone_region=pinecone_region,
                pinecone_index=pinecone_index,
            )
        ).with_outputs(DeleteStaleQuestionVectorsDoFn.OUTPUT_ERROR_TAG, main='main')
    )

class StoreIndividualEmbeddingsDoFn(beam.DoFn): # Renamed class
    """Stores individual Q&A embeddings in Pinecone with per-element DLQ visibility."""
    OUTPUT_ERROR_TAG = 'error'

    def __init__(self, project_id, pinecone_region, pinecone_index, batch_size=100): # batch_size kept for API compatibility
        self.project_id = project_id
        self.pinecone_region = pinecone_region
        self.pinecone_index_name = pinecone_index
        self.batch_size = batch_size
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('StoreIndividualEmbeddingsDoFn', MetricNames.ERRORS)
        self.upsert_counter = Metrics.counter('StoreIndividualEmbeddingsDoFn', 'pinecone_vectors_upserted')
        self.upsert_batch_counter = Metrics.counter('StoreIndividualEmbeddingsDoFn', 'pinecone_upsert_batches')
        self.index = None
        self.pc = None
        self.setup_error_message = None

    def setup(self):
        """Initialize Pinecone client and get index."""
        self.logger.info(f"Setting up Pinecone client for storing embeddings in region {self.pinecone_region}")
        try:
            from pinecone.grpc import PineconeGRPC # Import moved to setup

            self.pc = PineconeGRPC(
                api_key=access_secret(self.project_id, "PINECONE_API_KEY"),
                environment=self.pinecone_region
            )

            index_name_formatted = self.pinecone_index_name.lower().replace('_', '-')

            if index_name_formatted not in self.pc.list_indexes().names:
                 raise ValueError(f"Pinecone index '{index_name_formatted}' not found.")
            else:
                 self.index = self.pc.Index(index_name_formatted)
                 self.setup_error_message = None
                 self.logger.info(f"Successfully connected to Pinecone index '{index_name_formatted}' for storing.")

        except Exception as e:
            self.setup_error_message = f"Pinecone embedding store setup failed: {e}"
            self.logger.error(self.setup_error_message, exc_info=True)

    def process(self, element: Tuple[str, List[float], Dict[str, Any]]): # Updated input type
        if not self.index:
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": self.setup_error_message or "Pinecone index not initialized in embedding store",
                "element": element,
            })
            return

        try:
            vector_id, embedding_vector, metadata = element
        except Exception as e:
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": f"Invalid Pinecone embedding-store element shape: {str(e)}",
                "element": element,
                "traceback": traceback.format_exc(),
            })
            return

        if not vector_id or not isinstance(embedding_vector, list) or not isinstance(metadata, dict):
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": "Invalid Pinecone embedding-store element fields",
                "element": element,
            })
            return

        try:
            self.index.upsert(vectors=[(vector_id, embedding_vector, metadata)])
            self.upsert_counter.inc()
            self.upsert_batch_counter.inc()
            yield element
        except Exception as e:
            self.error_counter.inc()
            self.logger.error(
                f"Failed to upsert Pinecone vector {vector_id}: {str(e)}\nTraceback: {traceback.format_exc()}",
                exc_info=True,
            )
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": f"Pinecone embedding upsert failed: {str(e)}",
                "vector_id": vector_id,
                "element": element,
                "traceback": traceback.format_exc(),
            })

    def teardown(self):
         if self.pc:
              self.logger.info("Pinecone client teardown (placeholder - check library for specific methods if explicit closing is needed)")

class QueryPinecone(beam.DoFn):
    OUTPUT_ERROR_TAG = 'error' # Define an error tag

    def __init__(self, project_id, pinecone_region, pinecone_index, top_k):
        self.project_id = project_id
        self.pinecone_region = pinecone_region
        self.pinecone_index_name = pinecone_index # Store original name
        self.top_k = top_k
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('QueryPinecone', MetricNames.ERRORS)
        self.query_counter = Metrics.counter('QueryPinecone', MetricNames.QUERIES)
        self.rate_limit_waits = Metrics.counter('QueryPinecone', 'rate_limit_waits')
        self.index = None
        self.pc = None
        self.setup_error_message = None

        # Rate limiting parameters (consider making them configurable)
        self.total_qru_limit = 2000 # Query Read Units per second limit
        self.qru_per_query = 10     # Default assumption, will recalibrate
        self.safety_margin = 0.9    # Use 90% of limit
        self.max_queries_per_second = int((self.total_qru_limit * self.safety_margin) / self.qru_per_query)
        self.query_count = 0
        self.window_start_time = 0

    def setup(self):
        """Initializes the Pinecone client and index connection."""
        self.logger.info(f"Setting up Pinecone client for querying in region {self.pinecone_region}")
        try:
            from pinecone.grpc import PineconeGRPC # Import moved to setup

            self.pc = PineconeGRPC(
                api_key=access_secret(self.project_id, "PINECONE_API_KEY"),
                environment=self.pinecone_region
            )

            # Format index name consistently
            index_name_formatted = self.pinecone_index_name.lower().replace('_', '-')
            self.logger.info(f"Attempting to connect to Pinecone index: '{index_name_formatted}'")

            # Check if index exists before trying to connect
            available_indexes = self.pc.list_indexes().names
            self.logger.info(f"Available Pinecone indexes: {available_indexes}")
            if index_name_formatted not in available_indexes:
                raise ValueError(f"Pinecone index '{index_name_formatted}' not found.")
            else:
                # Index exists, connect to it
                self.index = self.pc.Index(index_name_formatted)
                # Optional: Describe index to confirm connection (adds latency to setup)
                # index_description = self.pc.describe_index(index_name_formatted)
                # self.logger.info(f"Successfully connected to Pinecone index '{index_name_formatted}'. Description: {index_description}")
                self.logger.info(f"Successfully connected to Pinecone index '{index_name_formatted}'.")

            # Initialize rate limiting window
            self.window_start_time = time.time()
            self.setup_error_message = None

        except Exception as e:
            self.setup_error_message = f"Pinecone query setup failed: {e}"
            self.logger.error(self.setup_error_message, exc_info=True)

    def process(self, item: Tuple[str, List[float], Dict[str, Any]]): # Updated item type
        if not self.index:
            self.logger.error("Pinecone index not initialized. Skipping query.")
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {"error_message": self.setup_error_message or "Pinecone index not initialized in process", "element": item})
            return

        triggering_vector_id, embedding_vector, triggering_metadata = item
        query_start_time = time.time() # Capture query start time

        try:
            triggering_user_id = triggering_metadata.get('user_id')
            triggering_statement_facet = triggering_metadata.get('facet')
            triggering_statement_text = triggering_metadata.get('statement_text', 'N/A') # For logging
            triggering_original_question_id = triggering_metadata.get('original_question_id', 'N/A') # For output

            if not triggering_user_id or not triggering_statement_facet:
                self.logger.error(f"Missing user_id or facet in triggering_metadata for vector {triggering_vector_id}. Metadata: {triggering_metadata}")
                self.error_counter.inc()
                yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                    "error_message": "Missing user_id or facet in triggering_metadata", 
                    "triggering_vector_id": triggering_vector_id,
                    "element": item
                })
                return

            # --- Perform Standard AP/PA Query ---
            primary_target_facet = None
            match_type_ap_pa = None

            if triggering_statement_facet == 'attribute':
                primary_target_facet = 'preference'
                match_type_ap_pa = 'AP' # User A's Attribute matching User B's Preference
            elif triggering_statement_facet == 'preference':
                primary_target_facet = 'attribute'
                match_type_ap_pa = 'PA' # User A's Preference matching User B's Attribute
            else:
                self.logger.warning(f"Invalid triggering_statement_facet '{triggering_statement_facet}' for vector {triggering_vector_id}. Skipping primary query.")
                # No yield to main output, but tag error
                yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                    "error_message": f"Invalid triggering_statement_facet: {triggering_statement_facet}",
                    "triggering_vector_id": triggering_vector_id,
                    "element": item
                })
                # Do not proceed to AA query if primary facet is invalid
                return

            pinecone_filter_ap_pa = build_pinecone_hard_filter(triggering_metadata, primary_target_facet)

            self._wait_for_rate_limit() # Apply rate limiting before each query
            
            self.logger.debug(f"Querying Pinecone (AP/PA) for vector {triggering_vector_id} (User: {triggering_user_id}, Facet: {triggering_statement_facet}, Target Facet: {primary_target_facet}). Filter: {pinecone_filter_ap_pa}")
            query_response_ap_pa = self.index.query(
                vector=embedding_vector,
                filter=pinecone_filter_ap_pa,
                top_k=self.top_k,
                include_metadata=True
            )
            self.query_counter.inc()
            self.query_count += 1
            
            query_latency_ms = (time.time() - query_start_time) * 1000
            Metrics.distribution(self.__class__.__name__, 'pinecone_ap_pa_query_latency_ms').update(int(query_latency_ms))

            if query_response_ap_pa and query_response_ap_pa.matches:
                for match in query_response_ap_pa.matches:
                    matched_metadata = match.metadata or {}
                    yield {
                        'triggering_user_id': triggering_user_id,
                        'triggering_statement_id': triggering_vector_id,
                        'triggering_statement_facet': triggering_statement_facet,
                        'triggering_statement_text': triggering_statement_text,
                        'triggering_original_question_id': triggering_original_question_id,
                        'matched_user_id': matched_metadata.get('user_id'),
                        'matched_statement_id': match.id,
                        'matched_statement_facet': matched_metadata.get('facet'),
                        'matched_statement_text': matched_metadata.get('statement_text'),
                        'matched_original_question_id': matched_metadata.get('original_question_id'),
                        'pinecone_score': match.score,
                        'match_type': match_type_ap_pa 
                    }
            
            # --- Perform Attribute-Attribute (AA) Query if triggering facet is 'attribute' ---
            if triggering_statement_facet == 'attribute':
                pinecone_filter_aa = build_pinecone_hard_filter(triggering_metadata, 'attribute')
                
                aa_query_start_time = time.time()
                self._wait_for_rate_limit() # Apply rate limiting

                self.logger.debug(f"Querying Pinecone (AA) for vector {triggering_vector_id} (User: {triggering_user_id}, Facet: {triggering_statement_facet}, Target Facet: attribute). Filter: {pinecone_filter_aa}")
                query_response_aa = self.index.query(
                    vector=embedding_vector, # Use the same embedding vector
                    filter=pinecone_filter_aa,
                    top_k=self.top_k, # Potentially a different top_k for AA matches? For now, same.
                    include_metadata=True
                )
                self.query_counter.inc() # Count this as another query
                self.query_count += 1
                
                aa_query_latency_ms = (time.time() - aa_query_start_time) * 1000
                Metrics.distribution(self.__class__.__name__, 'pinecone_aa_query_latency_ms').update(int(aa_query_latency_ms))

                if query_response_aa and query_response_aa.matches:
                    for match in query_response_aa.matches:
                        matched_metadata = match.metadata or {}
                        yield {
                            'triggering_user_id': triggering_user_id,
                            'triggering_statement_id': triggering_vector_id,
                            'triggering_statement_facet': triggering_statement_facet, # Still 'attribute'
                            'triggering_statement_text': triggering_statement_text,
                            'triggering_original_question_id': triggering_original_question_id,
                            'matched_user_id': matched_metadata.get('user_id'),
                            'matched_statement_id': match.id,
                            'matched_statement_facet': matched_metadata.get('facet'), # Should be 'attribute'
                            'matched_statement_text': matched_metadata.get('statement_text'),
                            'matched_original_question_id': matched_metadata.get('original_question_id'),
                            'pinecone_score': match.score,
                            'match_type': 'AA' # Attribute-Attribute match
                        }

        except Exception as e:
            self.logger.error(f"Error querying Pinecone for vector {triggering_vector_id}: {str(e)}\\nTraceback: {traceback.format_exc()}", exc_info=True)
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": str(e), 
                "triggering_vector_id": triggering_vector_id,
                "traceback": traceback.format_exc(),
                "element": item
            })

    def _wait_for_rate_limit(self): # Extracted rate limit logic into a helper
        while True:
            current_time = time.time()
            elapsed_time = current_time - self.window_start_time

            if elapsed_time >= 1.0:
                self.query_count = 0
                self.window_start_time = current_time
                elapsed_time = 0.0 # Reset elapsed time for current check

            if self.query_count < self.max_queries_per_second:
                break 
            else:
                self.rate_limit_waits.inc()
                sleep_duration = (1.0 - elapsed_time) + 0.01 # Wait for the remainder of the second + small buffer
                # self.logger.warning(f"Rate limit reached ({self.query_count} queries in {elapsed_time:.2f}s). Waiting for {sleep_duration:.2f}s...")
                time.sleep(sleep_duration)
                # After sleeping, the loop will re-evaluate, potentially resetting the window

    def teardown(self):
         # Optional: Close Pinecone connection if necessary/possible
         if self.pc:
              self.logger.info("Pinecone client teardown (placeholder - check library for specific methods)")


# --- Composite PTransforms ---

@beam.ptransform_fn
def QueryMatchesFromPinecone(pcoll: beam.PCollection[Tuple[str, List[float], Dict[str, Any]]], 
                             project_id: str, 
                             pinecone_region: str, 
                             pinecone_index: str, 
                             top_k: int) -> beam.PCollectionTuple:
    """Composite PTransform to query Pinecone for matches based on individual statements.

    Args:
        pcoll: PCollection of (triggering_vector_id, embedding_vector, triggering_metadata) tuples.
        project_id: GCP Project ID.
        pinecone_region: Pinecone region (environment).
        pinecone_index: Pinecone index name.
        top_k: Number of top matches to retrieve for each statement query.

    Returns:
        PCollectionTuple with 'main' output containing dictionaries of detailed match data,
        and 'error' output for elements that failed processing.
    """
    results = (
        pcoll
        | "QueryPineconePerStatement" >> beam.ParDo(QueryPinecone(
            project_id=project_id,
            pinecone_region=pinecone_region,
            pinecone_index=pinecone_index,
            top_k=top_k
        )).with_outputs(QueryPinecone.OUTPUT_ERROR_TAG, main='main')
    )
    return results

@beam.ptransform_fn
def StoreIndividualEmbeddingsInPinecone(
    pcoll: beam.PCollection[Tuple[str, List[float], Dict[str, Any]]],
    project_id: str,
    pinecone_region: str,
    pinecone_index: str,
    batch_size: int = 100
) -> beam.PCollectionTuple:
    """Composite PTransform to store individual Q&A embeddings in Pinecone.

    Args:
        pcoll: PCollection of (vector_id, embedding_vector, metadata_dict) tuples.
        project_id: GCP Project ID for accessing secrets.
        pinecone_region: Pinecone region (e.g., 'us-west1-gcp').
        pinecone_index: Name of the Pinecone index.
        batch_size: Kept for call-site compatibility. Writes are currently
            per-element so each failed vector can be emitted to the DLQ branch.

    Returns:
        PCollectionTuple with 'main' containing successfully upserted elements
        and 'error' containing failed elements for DLQ persistence.
    """
    return (
        pcoll
        | 'StoreIndividualEmbeddings' >> beam.ParDo(
            StoreIndividualEmbeddingsDoFn(
                project_id=project_id,
                pinecone_region=pinecone_region,
                pinecone_index=pinecone_index,
                batch_size=batch_size
            )
        ).with_outputs(StoreIndividualEmbeddingsDoFn.OUTPUT_ERROR_TAG, main='main')
    )
