# apps/marriage-ai/dataflow/pipelines/streaming/transforms/pinecone_ops.py
import apache_beam as beam
import logging
import time
import traceback
from apache_beam.metrics import Metrics

# Import constants and metrics from common
from .common import MetricNames
# Import utility functions
from ..utils import access_secret

logger = logging.getLogger(__name__)

class StorePineconeEmbeddingDoFn(beam.DoFn):
    """Stores user embeddings in Pinecone with rate limiting considerations (though less critical for upsert)."""
    def __init__(self, project_id, pinecone_region, pinecone_index):
        self.project_id = project_id
        self.pinecone_region = pinecone_region
        self.pinecone_index_name = pinecone_index # Store the original name
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('StorePineconeEmbeddingDoFn', MetricNames.ERRORS)
        self.upsert_counter = Metrics.counter('StorePineconeEmbeddingDoFn', 'pinecone_upserts')
        self.index = None
        self.pc = None

    def setup(self):
        """Initialize Pinecone client and get index."""
        from pinecone.grpc import PineconeGRPC # Import moved to setup
        import time
        self.logger.info(f"Setting up Pinecone client for storing embeddings in region {self.pinecone_region}")
        try:
            self.pc = PineconeGRPC(
                api_key=access_secret(self.project_id, "PINECONE_API_KEY"),
                environment=self.pinecone_region # Use environment for region
            )

            # Convert index name to valid format (lowercase, hyphenated)
            # It's crucial this matches the format used in QueryPinecone
            index_name_formatted = self.pinecone_index_name.lower().replace('_', '-')

            # Check if index exists
            if index_name_formatted not in self.pc.list_indexes().names:
                 self.logger.error(f"Pinecone index '{index_name_formatted}' does not exist. Cannot store embeddings.")
                 # Decide how to handle - maybe raise error to stop worker?
                 # For now, log error and index will remain None, causing process to fail.
                 raise ValueError(f"Pinecone index '{index_name_formatted}' not found.")
            else:
                 self.index = self.pc.Index(index_name_formatted)
                 self.logger.info(f"Successfully connected to Pinecone index '{index_name_formatted}' for storing.")

        except Exception as e:
            self.logger.error(f"Failed to setup Pinecone client or connect to index: {e}", exc_info=True)
            raise # Propagate setup failure

    def process(self, item):
        if not self.index:
             self.logger.error("Pinecone index not initialized. Skipping embedding storage.")
             self.error_counter.inc()
             raise RuntimeError("Pinecone index failed to initialize in setup.")

        user_id, embedding = item
        try:
            # self.logger.info(f"Storing embedding for user {user_id} in Pinecone index {self.index.name}")
            # Metadata should be compatible with Pinecone requirements (strings, numbers, booleans)
            metadata_payload = {
                'userID': str(user_id) # Ensure userID is a string
                # Add other relevant, filterable metadata if needed
            }

            # Upsert the embedding
            upsert_response = self.index.upsert(
                vectors=[{
                    'id': str(user_id), # Ensure ID is a string
                    'values': embedding,
                    'metadata': metadata_payload
                }]
                # Consider adding namespace if using namespaces in Pinecone
                # namespace="your_namespace"
            )
            self.upsert_counter.inc()
            # self.logger.info(f"Upsert response for {user_id}: {upsert_response}")

            # Pass through the original item for potential further processing
            yield item

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Failed to store embedding for {user_id}: {str(e)}\nTraceback: {traceback.format_exc()}", exc_info=True)
            raise # Propagate error for DLQ handling

    def teardown(self):
         # Optional: Close Pinecone connection if necessary/possible
         # pc.deinit() or similar - check pinecone library specifics
         # pass
         if self.pc:
              # Note: Pinecone clients often manage connections automatically.
              # Explicit closing might not be needed or available.
              # Refer to the specific Pinecone client library documentation.
              self.logger.info("Pinecone client teardown (placeholder - check library for specific methods)")

class QueryPinecone(beam.DoFn):
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
            raise

    def process(self, item):
        if not self.index:
            self.logger.error("Pinecone index not initialized. Skipping query.")
            self.error_counter.inc()
            raise RuntimeError("Pinecone index failed to initialize in setup.")

        user_id, embedding = item
        query_start_time = time.time() # Capture query start time

        try:
            # --- Rate Limiting Logic ---           
            while True:
                current_time = time.time()
                elapsed_time = current_time - self.window_start_time

                # Reset counters every second
                if elapsed_time >= 1.0:
                    # self.logger.info(f"Resetting rate limit window. Queries in last window: {self.query_count}")
                    self.query_count = 0
                    self.window_start_time = current_time
                    elapsed_time = 0.0

                # Check if we can make another query in the current window
                if self.query_count < self.max_queries_per_second:
                    # self.logger.info(f"Proceeding with query {self.query_count + 1}/{self.max_queries_per_second} in window.")
                    break # Exit loop and perform query
                else:
                    # Wait for the next time window
                    wait_time = 1.0 - elapsed_time
                    self.logger.warning(f"Pinecone query rate limit reached ({self.query_count}/{self.max_queries_per_second}). Waiting {wait_time:.3f}s for next window.")
                    self.rate_limit_waits.inc()
                    time.sleep(wait_time)
            # --- End Rate Limiting Logic ---

            # Perform the query
            # self.logger.info(f"Querying Pinecone for user {user_id} with top_k={self.top_k}")
            result = self.index.query(
                vector=embedding,
                top_k=self.top_k,
                include_metadata=True
                # Add namespace if used
                # namespace="your_namespace"
                # Add filter if needed (e.g., exclude self)
                # filter={'userID': {'$ne': str(user_id)}}
            )

            # Update QRU usage and recalculate max queries if needed
            actual_qru = result.usage.read_units if result.usage else self.qru_per_query
            if actual_qru != self.qru_per_query:
                self.logger.warning(f"Pinecone QRU usage changed from {self.qru_per_query} to {actual_qru}. Recalculating limit.")
                self.qru_per_query = actual_qru if actual_qru else 10 # Avoid division by zero
                self.max_queries_per_second = int((self.total_qru_limit * self.safety_margin) / self.qru_per_query)
                self.logger.info(f"New maximum queries per second: {self.max_queries_per_second}")

            # Process results
            matches = []
            if result and result.matches:
                for match in result.matches:
                     # Ensure metadata is accessed correctly and handle potential absence
                    metadata = match.metadata if hasattr(match, 'metadata') else None
                    matches.append({
                        'id': match.id, # Matched user ID
                        'score': match.score, # Similarity score
                        'metadata': metadata
                    })

            # Increment counters and yield result
            self.query_count += 1
            self.query_counter.inc()
            # self.logger.info(f"Query {self.query_count}/{self.max_queries_per_second} completed. Found {len(matches)} matches for user {user_id}")
            # for match in matches:
            #     self.logger.info(f"  Match: {match[\'id']} with score {match[\'score']:.4f}")

            yield {
                'user_id': user_id,
                'matches': matches,
                'query_time': query_start_time # Include the query time for potential downstream use
            }

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Pinecone query failed for user {user_id}: {str(e)}\nTraceback: {traceback.format_exc()}", exc_info=True)
            raise # Propagate error for DLQ

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
def QueryMatchesFromPinecone(pcoll: beam.PCollection[tuple[str, list[float]]], project_id: str, pinecone_region: str, pinecone_index: str, top_k: int) -> beam.PCollection[dict]:
    """Composite PTransform to query Pinecone for matches.

    Args:
        pcoll: PCollection of (user_id, embedding) tuples.
        project_id: GCP Project ID.
        pinecone_region: Pinecone region (environment).
        pinecone_index: Pinecone index name.
        top_k: Number of top matches to retrieve.

    Returns:
        PCollection of dictionaries, each containing 'user_id' and 'matches' list.
    """
    return (
        pcoll
        | "QueryPinecone" >> beam.ParDo(QueryPinecone(
            project_id=project_id,
            pinecone_region=pinecone_region,
            pinecone_index=pinecone_index,
            top_k=top_k
        ))
    ) 