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

logger = logging.getLogger(__name__)

class StoreIndividualEmbeddingsDoFn(beam.DoFn): # Renamed class
    """Stores individual Q&A embeddings in Pinecone with batching."""
    def __init__(self, project_id, pinecone_region, pinecone_index, batch_size=100): # Added batch_size
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
        self.batch = [] # Initialize batch

    def setup(self):
        """Initialize Pinecone client and get index."""
        from pinecone.grpc import PineconeGRPC # Import moved to setup
        # import time # time is already imported at module level
        self.logger.info(f"Setting up Pinecone client for storing embeddings in region {self.pinecone_region}")
        try:
            self.pc = PineconeGRPC(
                api_key=access_secret(self.project_id, "PINECONE_API_KEY"),
                environment=self.pinecone_region
            )

            index_name_formatted = self.pinecone_index_name.lower().replace('_', '-')

            if index_name_formatted not in self.pc.list_indexes().names:
                 self.logger.error(f"Pinecone index '{index_name_formatted}' does not exist. Cannot store embeddings.")
                 raise ValueError(f"Pinecone index '{index_name_formatted}' not found.")
            else:
                 self.index = self.pc.Index(index_name_formatted)
                 self.logger.info(f"Successfully connected to Pinecone index '{index_name_formatted}' for storing.")

        except Exception as e:
            self.logger.error(f"Failed to setup Pinecone client or connect to index: {e}", exc_info=True)
            raise

    def _flush_batch(self):
        """Upserts the current batch of vectors to Pinecone."""
        if not self.batch:
            return

        if not self.index:
             self.logger.error("Pinecone index not initialized. Cannot flush batch.")
             self.error_counter.inc(len(self.batch)) # Increment by number of items not flushed
             # Decide if we should clear the batch or attempt later; for now, clear to avoid reprocessing same error
             self.batch = []
             # This situation should ideally be caught by setup failing.
             # If setup succeeded but index is None, it's a critical state.
             raise RuntimeError("Pinecone index became uninitialized after setup. Cannot flush batch.")

        try:
            # self.logger.info(f"Upserting batch of {len(self.batch)} vectors to Pinecone index {self.index.name}")
            upsert_response = self.index.upsert(
                vectors=self.batch 
                # vectors is a list of tuples: (id, vector, metadata)
                # namespace="your_namespace" # Consider if namespace is needed
            )
            self.upsert_counter.inc(len(self.batch))
            self.upsert_batch_counter.inc()
            # self.logger.info(f"Batch upsert response: {upsert_response}")
        except Exception as e:
            self.error_counter.inc(len(self.batch)) # Count each item in failed batch as an error
            self.logger.error(f"Failed to upsert batch of {len(self.batch)} vectors: {str(e)}\nTraceback: {traceback.format_exc()}", exc_info=True)
            # Depending on retry strategy, you might not clear the batch here,
            # or re-raise to let Beam's retry mechanism handle it.
            # For now, re-raise to indicate failure for this bundle.
            raise
        finally:
            self.batch = [] # Always clear batch after attempt

    def process(self, element: Tuple[str, List[float], Dict[str, Any]]): # Updated input type
        # element is (vector_id, embedding_vector, metadata)
        self.batch.append(element)
        if len(self.batch) >= self.batch_size:
            self._flush_batch()

    def finish_bundle(self):
        """Process any remaining elements in the batch at the end of a bundle."""
        self._flush_batch()

    def teardown(self):
         self._flush_batch() # Ensure any final data is flushed
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

        # Rate limiting parameters (consider making them configurable)
        self.total_qru_limit = 2000 # Query Read Units per second limit
        self.qru_per_query = 10     # Default assumption, will recalibrate
        self.safety_margin = 0.9    # Use 90% of limit
        self.max_queries_per_second = int((self.total_qru_limit * self.safety_margin) / self.qru_per_query)
        self.query_count = 0
        self.window_start_time = 0

    def setup(self):
        """Initializes the Pinecone client and index connection."""
        from pinecone.grpc import PineconeGRPC # Import moved to setup
        import time
        self.logger.info(f"Setting up Pinecone client for querying in region {self.pinecone_region}")
        try:
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
                # Original code created the index, but this might be risky in a query DoFn.
                # Consider creating the index separately as part of infrastructure setup.
                # If creation is desired here, uncomment and refine the logic below.
                self.logger.error(f"Pinecone index '{index_name_formatted}' not found. Cannot query.")
                raise ValueError(f"Pinecone index '{index_name_formatted}' not found.")
                # --- Index Creation Logic (Optional - Use with caution) ---
                # self.logger.info(f"Index {index_name_formatted} not found, creating new index...")
                # EMBEDDING_DIMENSION = 3072 # Example for text-embedding-3-large
                # self.pc.create_index(
                #     name=index_name_formatted,
                #     dimension=EMBEDDING_DIMENSION, # Make dimension configurable or detect from embedding
                #     metric='cosine', # Make metric configurable
                #     spec={
                #         'serverless': {
                #             'cloud': 'gcp', # Make cloud configurable
                #             'region': self.pinecone_region
                #         }
                #     }
                # )
                # # Wait for index to be ready (add timeout and better error handling)
                # while True:
                #     try:
                #         status = self.pc.describe_index(index_name_formatted).status
                #         if status and status.get('ready'):
                #              self.logger.info(f"Index {index_name_formatted} created and ready.")
                #              break
                #         self.logger.info(f"Waiting for index {index_name_formatted} to be ready...")
                #         time.sleep(5)
                #     except Exception as wait_e:
                #         self.logger.warning(f"Error checking index status while waiting: {str(wait_e)}")
                #         time.sleep(5)
                # self.index = self.pc.Index(index_name_formatted)
                # --- End Index Creation Logic ---
            else:
                # Index exists, connect to it
                self.index = self.pc.Index(index_name_formatted)
                # Optional: Describe index to confirm connection (adds latency to setup)
                # index_description = self.pc.describe_index(index_name_formatted)
                # self.logger.info(f"Successfully connected to Pinecone index '{index_name_formatted}'. Description: {index_description}")
                self.logger.info(f"Successfully connected to Pinecone index '{index_name_formatted}'.")

            # Initialize rate limiting window
            self.window_start_time = time.time()

        except Exception as e:
            self.logger.error(f"Failed to setup Pinecone client or connect to index '{self.pinecone_index_name}': {e}", exc_info=True)
            # Yield to error tag? Setup errors are usually critical and might fail the worker.
            raise

    def process(self, item: Tuple[str, List[float], Dict[str, Any]]): # Updated item type
        if not self.index:
            self.logger.error("Pinecone index not initialized. Skipping query.")
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {"error_message": "Pinecone index not initialized in process", "element": item})
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

            pinecone_filter_ap_pa = {
                'user_id': {'$ne': str(triggering_user_id)},
                'facet': primary_target_facet
            }

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
                pinecone_filter_aa = {
                    'user_id': {'$ne': str(triggering_user_id)},
                    'facet': 'attribute'  # Target is also 'attribute'
                }
                
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
def StoreEmbeddingInPinecone(pcoll: beam.PCollection[tuple[str, list[float]]], project_id: str, pinecone_region: str, pinecone_index: str) -> beam.PCollection[tuple[str, list[float]]]:
    """Composite PTransform to store embeddings in Pinecone.

    Args:
        pcoll: PCollection of (user_id, embedding) tuples.
        project_id: GCP Project ID.
        pinecone_region: Pinecone region (environment).
        pinecone_index: Pinecone index name.

    Returns:
        The original PCollection, passed through after storing.
    """
    return (
        pcoll
        | "StoreInPinecone" >> beam.ParDo(StorePineconeEmbeddingDoFn(
            project_id=project_id,
            pinecone_region=pinecone_region,
            pinecone_index=pinecone_index
        ))
    )

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
) -> beam.pvalue.PDone: # Indicates a sink
    """Composite PTransform to store individual Q&A embeddings in Pinecone.

    Args:
        pcoll: PCollection of (vector_id, embedding_vector, metadata_dict) tuples.
        project_id: GCP Project ID for accessing secrets.
        pinecone_region: Pinecone region (e.g., 'us-west1-gcp').
        pinecone_index: Name of the Pinecone index.
        batch_size: Number of vectors to batch for upsert.

    Returns:
        beam.pvalue.PDone after writing to Pinecone.
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
        )
    ) 