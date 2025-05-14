import unittest
import apache_beam as beam
from apache_beam.testing.test_pipeline import TestPipeline
from apache_beam.testing.util import assert_that, equal_to, is_empty
from unittest.mock import patch, MagicMock, ANY
import numpy as np
import time
import datetime
import json # For reranking mock
import base64 # For scheduler task verification

# Import necessary protobuf types for task verification
from google.protobuf import timestamp_pb2
# Import firestore for type checking in mocks
from google.cloud import firestore, tasks_v2, storage # Added tasks_v2, storage
# from google.cloud.firestore_v1.types.base import Timestamp as FirestoreTimestamp # Try v1.types.base
import openai
import pinecone.grpc # Import parent module
import PyPDF2 # Import PyPDF2

# Import the transforms to be tested
from apps.marriage_ai.dataflow.pipelines.streaming.transforms.profile_processing import FetchProfileDoFn
from apps.marriage_ai.dataflow.pipelines.streaming.transforms.embedding import GenerateUserEmbedding
from apps.marriage_ai.dataflow.pipelines.streaming.transforms.pinecone_ops import QueryPinecone
# Renamed: from apps.marriage_ai.dataflow.pipelines.streaming.transforms.pinecone_ops import StorePineconeEmbeddingDoFn
from apps.marriage_ai.dataflow.pipelines.streaming.transforms.reranking import RerankMatchesDoFn, CalculateLyingScoreDoFn # Added Reranking
# Import scoring/grouping transforms
from apps.marriage_ai.dataflow.pipelines.streaming.transforms.grouping_helpers import (
    AggregateScoresDoFn, ProcessJoinedDataDoFn, ExtractQAsForScoringDoFn, UpdateAllScoresDoFn
)
# Correct import for CalculateLyingScoreDoFn - already correct
# from apps.marriage_ai.dataflow.pipelines.streaming.transforms.reranking import CalculateLyingScoreDoFn
# Import next question transforms
from apps.marriage_ai.dataflow.pipelines.streaming.transforms.next_question import (
    SuggestNextProfileQuestionDoFn, UpdateNextQuestionDoFn
)
# Import the *actual* scheduling transform
from apps.marriage_ai.dataflow.pipelines.streaming.transforms.scheduling import ScheduleDelayedMatchingDoFn

# --- Mock Paths - Updated to target source libraries ---
MOCK_FS_CLIENT_PATH = 'google.cloud.firestore.Client'
MOCK_FS_BATCH_PATH = 'google.cloud.firestore.batch'
MOCK_FS_TRANSACTION_PATH = 'google.cloud.firestore.transaction'
MOCK_FS_SERVER_TIMESTAMP_PATH = 'google.cloud.firestore.SERVER_TIMESTAMP'
# MOCK_FS_TIMESTAMP_PATH = 'apps.marriage_ai.dataflow.pipelines.streaming.tests.test_end_to_end.FirestoreTimestamp' # Target specific import again
# Patch the fromtimestamp method directly where it's used in the test module
MOCK_FS_TIMESTAMP_FROMTIMESTAMP_PATH = 'apps.marriage_ai.dataflow.pipelines.streaming.tests.test_end_to_end.firestore.Timestamp.fromtimestamp'
MOCK_FS_QUERY_PATH = 'google.cloud.firestore.Query' # For DESCENDING

MOCK_OPENAI_CLIENT_PATH = 'openai.OpenAI'

MOCK_PINECONE_CLIENT_PATH = 'pinecone.grpc.PineconeGRPC' # Patch the client constructor

MOCK_ACCESS_SECRET_PATH = 'apps.marriage_ai.dataflow.pipelines.streaming.utils.access_secret' # Correct path

MOCK_CLOUD_TASKS_CLIENT_PATH = 'google.cloud.tasks_v2.CloudTasksClient'
MOCK_CLOUD_TASKS_TIMESTAMP_PATH = 'google.protobuf.timestamp_pb2.Timestamp' # Corrected path

MOCK_GCS_CLIENT_PATH = 'google.cloud.storage.Client'
MOCK_PYPDF2_READER_PATH = 'PyPDF2.PdfReader'

# Add mock path for datetime module used in scheduling
# MOCK_DATETIME_PATH = 'datetime.datetime.utcnow' # Incorrect - Patch module where imported
MOCK_DATETIME_PATH = 'apps.marriage_ai.dataflow.pipelines.streaming.transforms.scheduling.datetime' # Correct path


# Constants for testing
TEST_PROJECT_ID = 'test-project'
TEST_USER_ID = 'user_e2e_test'
TEST_LOCATION_ID = 'us-central1' # For Cloud Tasks
TEST_QUEUE_ID = 'test-queue'     # For Cloud Tasks
TEST_PUBSUB_TOPIC = 'test-delayed-matching-topic' # For Scheduling DoFn
TEST_DELAY_SECONDS = 3600 # For Scheduling DoFn (e.g., 1 hour)
EMBEDDING_DIM = 3
PINECONE_NAMESPACE = 'test-namespace'
PINECONE_TOP_K = 5
RERANK_MODEL = 'gpt-4o' # Assume a model used by reranker
TEST_BUCKET_NAME = 'test-bucket' # For PDF instructions
TEST_PDF_PATH = 'instructions/rerank.pdf' # For PDF instructions

# Define a dummy server timestamp for deterministic tests
DUMMY_TIMESTAMP = datetime.datetime(2023, 1, 1, 12, 0, 0, tzinfo=datetime.timezone.utc)
# Dummy Timestamp object to be returned by firestore.Timestamp.fromtimestamp
# DUMMY_FS_TIMESTAMP = firestore.Timestamp(2023, 1, 1, 12, 0, 0) # Keep this commented out/removed
# Dummy Task Timestamp object
DUMMY_TASK_TIMESTAMP = timestamp_pb2.Timestamp(seconds=int(DUMMY_TIMESTAMP.timestamp())) # Use protobuf timestamp

# Use a fixed time for testing scheduling delay calculation (seconds since epoch)
FIXED_QUERY_TIME = DUMMY_TIMESTAMP.timestamp()


class TestMarriageAIPipelines(unittest.TestCase):

    # --- Helper Methods for Mock Setup ---

    def _setup_mock_firestore_client(self, mock_fs_client_constructor):
        """Creates and returns a mock Firestore client via its constructor mock."""
        # Remove spec=firestore.Client as the class itself is already mocked by the patcher
        # mock_fs_client = MagicMock(spec=firestore.Client)
        mock_fs_client = MagicMock() # No spec needed here
        mock_fs_client_constructor.return_value = mock_fs_client

        # *** Mock methods used by the client instance ***
        # Mock batch()
        mock_batch = MagicMock(spec=firestore.WriteBatch)
        mock_fs_client.batch.return_value = mock_batch

        # Mock transaction()
        mock_transaction = MagicMock(spec=firestore.Transaction)
        mock_fs_client.transaction.return_value = mock_transaction

        # Mock collection().document() chain -> Needs careful setup per test
        mock_collection_ref = MagicMock(spec=firestore.CollectionReference)
        mock_fs_client.collection.return_value = mock_collection_ref

        # Return the instance, batch, and transaction mocks for configuration
        return mock_fs_client, mock_batch, mock_transaction

    def _configure_mock_firestore_reads(self, mock_fs_client, reads_config):
        """Configures mock document reads for a mock Firestore client.

        Args:
            mock_fs_client: The mocked firestore.Client instance.
            reads_config: A dict where keys are collection names and values are dicts
                          mapping document IDs to the data they should return (or None if not exists).
                          Example: {'users': {'user1': {'name': 'Alice'}, 'user2': None}}
        """
        # We need to mock collection(name).document(id).get()
        collection_mocks = {}

        def collection_side_effect(collection_name):
            if collection_name not in collection_mocks:
                 # Create a new mock collection if not already configured
                 mock_coll = MagicMock(spec=firestore.CollectionReference, name=f"Collection_{collection_name}")
                 doc_mocks = {}

                 def document_side_effect(doc_id):
                     if doc_id not in doc_mocks:
                          # Create a new mock document ref if not configured
                          mock_doc = MagicMock(spec=firestore.DocumentReference, name=f"Doc_{collection_name}_{doc_id}")
                          # Set up default .get() -> non-existent snapshot
                          mock_snapshot = MagicMock(spec=firestore.DocumentSnapshot, name=f"Snapshot_{collection_name}_{doc_id}", id=doc_id)
                          mock_snapshot.exists = False
                          mock_snapshot.to_dict.return_value = None
                          mock_doc.get.return_value = mock_snapshot
                          doc_mocks[doc_id] = mock_doc
                     return doc_mocks[doc_id]

                 mock_coll.document.side_effect = document_side_effect
                 collection_mocks[collection_name] = mock_coll

                 # Configure specific reads for this collection based on reads_config
                 if collection_name in reads_config:
                     collection_read_config = reads_config[collection_name]
                     for doc_id, data in collection_read_config.items():
                         mock_doc_ref = document_side_effect(doc_id) # Ensure doc mock exists
                         mock_snapshot = mock_doc_ref.get.return_value # Get the existing snapshot mock
                         if data is not None:
                             mock_snapshot.exists = True
                             mock_snapshot.to_dict.return_value = data
            else:
                             mock_snapshot.exists = False
                             mock_snapshot.to_dict.return_value = None

            return collection_mocks[collection_name]

        mock_fs_client.collection.side_effect = collection_side_effect

    def _configure_mock_firestore_query(self, mock_fs_client, collection_name, expected_docs_data):
        """Configures a mock Firestore client for a specific query().stream() call."""
        # Mock collection(name).where(...).order_by(...).limit(...).stream()
        mock_query = MagicMock(spec=firestore.Query)
        # Simulate chainable methods returning the query object itself
        mock_query.where.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query

        # Prepare mock stream results
        mock_doc_snapshots = []
        for doc_id, data in expected_docs_data.items():
            snapshot = MagicMock(spec=firestore.DocumentSnapshot, id=doc_id)
            snapshot.exists = True
            snapshot.to_dict.return_value = data
            mock_doc_snapshots.append(snapshot)

        mock_query.stream.return_value = mock_doc_snapshots

        # Find the collection mock and attach the query mock
        # Assumes _configure_mock_firestore_reads was called or collection mock exists
        mock_coll = mock_fs_client.collection(collection_name)
        mock_coll.where.return_value = mock_query # Start the query chain from the collection

    def _setup_mock_openai_client(self, mock_openai_client_constructor):
        """Creates and returns a mock OpenAI client via its constructor mock."""
        # mock_openai_client = MagicMock(spec=openai.OpenAI)
        mock_openai_client = MagicMock() # Remove spec
        mock_openai_client_constructor.return_value = mock_openai_client
        return mock_openai_client

    def _setup_mock_openai_embeddings(self, mock_openai_client, embeddings_list):
        """Configures the mock OpenAI client to return a sequence of embedding responses."""
        responses = []
        for embedding_vector in embeddings_list:
            mock_response = MagicMock()
            # Match the actual structure: response.data[0].embedding
            mock_embedding_obj = MagicMock()
            mock_embedding_obj.embedding = embedding_vector
            mock_response.data = [mock_embedding_obj]
            responses.append(mock_response)
        # Mock the create method on the embeddings attribute
        mock_openai_client.embeddings = MagicMock()
        mock_openai_client.embeddings.create.side_effect = responses

    def _setup_mock_openai_chat_completions(self, mock_openai_client, responses_list):
        """Configures the mock OpenAI client to return a sequence of chat completion responses."""
        mock_responses = []
        for content in responses_list:
            mock_response = MagicMock()
            # Match the actual structure: response.choices[0].message.content
            mock_message = MagicMock()
            mock_message.content = content
            mock_choice = MagicMock()
            mock_choice.message = mock_message
            mock_response.choices = [mock_choice]
            mock_responses.append(mock_response)
        # Mock the create method on the chat.completions attribute
        mock_openai_client.chat = MagicMock()
        mock_openai_client.chat.completions = MagicMock()
        mock_openai_client.chat.completions.create.side_effect = mock_responses

    def _setup_mock_pinecone_client(self, mock_pinecone_client_constructor, index_name):
         """Sets up mock Pinecone client and its index via constructor mock."""
         # mock_pinecone_client = MagicMock(spec=pinecone.grpc.PineconeGRPC)
         mock_pinecone_client = MagicMock() # Remove spec
         mock_pinecone_client_constructor.return_value = mock_pinecone_client

         # Mock the index method to return a specific mock index
         mock_pinecone_index = MagicMock(name=f'MockPineconeIndex_{index_name}') # Remove spec
         mock_pinecone_client.Index.return_value = mock_pinecone_index

         # Mock list_indexes().names to include the target index
         mock_list_response = MagicMock()
         mock_list_response.names = [index_name]
         mock_pinecone_client.list_indexes.return_value = mock_list_response

         return mock_pinecone_client, mock_pinecone_index

    def _setup_mock_pinecone_query(self, mock_pinecone_index, matches, query_time=None):
        """Configures the mock Pinecone index query response."""
        mock_query_result = MagicMock()
        mock_pinecone_matches = []
        for match_data in matches:
             mock_match = MagicMock(id=match_data['id'], score=match_data['score'])
             # Add metadata if needed for testing
             mock_match.metadata = {'userID': match_data['id']}
             mock_pinecone_matches.append(mock_match)
        mock_query_result.matches = mock_pinecone_matches
        # Mock the usage attribute expected by the code
        mock_query_result.usage = MagicMock(read_units=10) # Example value

        # QueryPinecone expects only the result, not a tuple with time
             mock_pinecone_index.query.return_value = mock_query_result
        # Store query_time for verification if needed, but don't return it
        mock_pinecone_index._test_query_time = query_time

    def _setup_mock_cloud_tasks_client(self, mock_tasks_client_constructor):
         """Sets up mock Cloud Tasks client via constructor mock."""
         mock_tasks_client_instance = MagicMock() # Remove spec
         mock_tasks_client_constructor.return_value = mock_tasks_client_instance
         return mock_tasks_client_instance

    def _configure_mock_cloud_tasks_creation(self, mock_tasks_client, parent_queue_path, task_name):
         """Configures the mock task creation methods."""
         mock_tasks_client.queue_path.return_value = parent_queue_path
         mock_created_task_response = MagicMock(name=task_name)
         mock_tasks_client.create_task.return_value = mock_created_task_response
         return mock_created_task_response

    def _setup_mock_gcs_client(self, mock_gcs_client_constructor):
         """Sets up mock GCS client via constructor mock."""
         mock_gcs_client = MagicMock() # Remove spec
         mock_gcs_client_constructor.return_value = mock_gcs_client
         return mock_gcs_client

    def _configure_mock_gcs_pdf_read(self, mock_gcs_client, bucket_name, file_path, pdf_bytes):
         """Configures the mock GCS client to return specific PDF bytes."""
         mock_bucket = MagicMock(spec=storage.Bucket)
         mock_blob = MagicMock(spec=storage.Blob)
         mock_blob.download_as_bytes.return_value = pdf_bytes
         mock_bucket.blob.return_value = mock_blob
         mock_gcs_client.bucket.return_value = mock_bucket
         # Add assertions later if needed:
         # mock_gcs_client.bucket.assert_called_with(bucket_name)
         # mock_bucket.blob.assert_called_with(file_path)

    def _setup_mock_pypdf2_reader(self, mock_pypdf2_reader_constructor, pdf_text):
         """Sets up mock PyPDF2 reader via constructor mock."""
         mock_pdf_reader = MagicMock() # Remove spec
         # Mock the pages attribute to return a list of mock pages
         mock_page = MagicMock()
         mock_page.extract_text.return_value = pdf_text
         mock_pdf_reader.pages = [mock_page]
         mock_pypdf2_reader_constructor.return_value = mock_pdf_reader
         return mock_pdf_reader

    # --- Test Utility ---
    def assert_list_almost_equal(self, list1, list2):
        """Helper function to compare lists of floats with tolerance."""
        if len(list1) != len(list2):
            self.fail(f"Lists have different lengths: {len(list1)} != {len(list2)}")
        if not np.allclose(list1, list2, atol=1e-6):
            self.fail(f"Lists are not almost equal: {list1} vs {list2}")
        return True # Indicate success for chained assertions if needed


    # --- Test 1: Fetch -> Embed -> Query ---
    @patch(MOCK_ACCESS_SECRET_PATH) # Combined access secret mock
    @patch(MOCK_PINECONE_CLIENT_PATH) # Target Pinecone client constructor
    @patch(MOCK_OPENAI_CLIENT_PATH) # Target OpenAI client constructor
    @patch(MOCK_FS_CLIENT_PATH) # Target Firestore client constructor
    def test_fetch_embed_query_success(self,
                                         mock_fs_client_constructor,
                                         mock_openai_client_constructor,
                                         mock_pinecone_client_constructor,
                                         mock_access_secret):
        """Tests the sequence: Fetch Profile -> Generate Embedding -> Query Pinecone."""

        # --- Test Data ---
        test_user_id = TEST_USER_ID + "_fetch"
        test_profile_data = {
            'id': test_user_id,
            'name': 'Fetch Test User',
            'questions_answers': [
                {'question': 'Q1?', 'answer': 'A1', 'section': 's1'},
                {'question': 'Q2?', 'answer': 'A2', 'section': 's2'}
            ]
        }
        openai_embeddings = [[0.1] * EMBEDDING_DIM, [0.2] * EMBEDDING_DIM]
        expected_final_embedding = [0.15] * EMBEDDING_DIM
        pinecone_matches_data = [
            {'id': 'match1', 'score': 0.9},
            {'id': 'match2', 'score': 0.8}
        ]
        # QueryPinecone output now includes query_time in the main dict
        expected_query_output_structure = {
            'user_id': test_user_id,
            'matches': pinecone_matches_data,
            'query_time': FIXED_QUERY_TIME,
            'embedding': expected_final_embedding # Embedding is passed through
        }
        pinecone_index_name = 'test-index' # Needs to be lowercase, hyphenated for pinecone_ops

        # Configure access_secret mock
        def access_secret_side_effect(project_id, secret_id):
            # print(f"Mock access_secret called with: {project_id}, {secret_id}") # Debug print
            if secret_id == "OPENAI_API_KEY": return 'openai-key'
            if secret_id == "PINECONE_API_KEY": return 'pinecone-key'
            # print(f"Mock access_secret returning None for: {secret_id}") # Debug print
            return None # Correct indentation
        mock_access_secret.side_effect = access_secret_side_effect

        # --- Mock Setup ---
        # Firestore
        mock_fs_client, _, _ = self._setup_mock_firestore_client(mock_fs_client_constructor)
        self._configure_mock_firestore_reads(mock_fs_client, {
            'user_profiles': { test_user_id: test_profile_data }
        })

        # OpenAI
        mock_openai_client = self._setup_mock_openai_client(mock_openai_client_constructor)
        self._setup_mock_openai_embeddings(mock_openai_client, openai_embeddings)

        # Pinecone
        mock_pinecone_client, mock_pinecone_index = self._setup_mock_pinecone_client(
            mock_pinecone_client_constructor, pinecone_index_name
        )
        self._setup_mock_pinecone_query(mock_pinecone_index, pinecone_matches_data, query_time=FIXED_QUERY_TIME)

        # --- Pipeline ---
        # FetchProfileDoFn uses is_test=False internally when db is None, handle this
        fetch_dofn = FetchProfileDoFn(project_id=TEST_PROJECT_ID, collection_name='user_profiles')
        embed_dofn = GenerateUserEmbedding(project_id=TEST_PROJECT_ID)
        # embedding_dim is handled internally now based on model
        query_dofn = QueryPinecone(
            project_id=TEST_PROJECT_ID,
            pinecone_region='gcp-dummy', # Need region now
            pinecone_index=pinecone_index_name,
            top_k=PINECONE_TOP_K
        )
        # Rate limit interval not needed to mock anymore

        with TestPipeline() as p:
            input_data = p | 'CreateInput' >> beam.Create([{'user_id': test_user_id}])
            # Validate profile is now part of ProcessAndValidateProfile PTransform
            # profile_data = input_data | 'FetchProfile' >> beam.ParDo(fetch_dofn)
            profile_data = input_data | 'FetchProfile' >> beam.ParDo(fetch_dofn) # Assume Fetch only for now
            embedding_data = profile_data | 'GenerateEmbedding' >> beam.ParDo(embed_dofn)
            query_results = embedding_data | 'QueryPinecone' >> beam.ParDo(query_dofn)

            # Define checker function for the output structure
            def check_query_output(actual_list):
                # assert_that receives a list of elements
                assert len(actual_list) == 1, f"Expected 1 element, got {len(actual_list)}"
                actual = actual_list[0]
                assert isinstance(actual, dict), f"Expected dict, got {type(actual)}"
                assert actual['user_id'] == expected_query_output_structure['user_id']
                assert actual['matches'] == expected_query_output_structure['matches']
                assert isinstance(actual['query_time'], float)
                # Check embedding approximately
                self.assert_list_almost_equal(actual['embedding'], expected_query_output_structure['embedding'])


            assert_that(query_results, check_query_output, label="CheckQueryOutputStructure")

        # --- Verification ---
        # Firestore
        mock_fs_client_constructor.assert_called_once_with(project=TEST_PROJECT_ID)
        # Check collection().document().get() was called
        mock_fs_client.collection.assert_called_with('user_profiles')
        mock_fs_client.collection('user_profiles').document.assert_called_with(test_user_id)
        mock_fs_client.collection('user_profiles').document(test_user_id).get.assert_called_once()

        # Access Secret
        mock_access_secret.assert_any_call(TEST_PROJECT_ID, "OPENAI_API_KEY")
        mock_access_secret.assert_any_call(TEST_PROJECT_ID, "PINECONE_API_KEY")

        # OpenAI
        mock_openai_client_constructor.assert_called_once_with(api_key='openai-key')
        self.assertEqual(mock_openai_client.embeddings.create.call_count, len(test_profile_data['questions_answers']))

        # Pinecone
        mock_pinecone_client_constructor.assert_called_once_with(api_key='pinecone-key', environment='gcp-dummy')
        mock_pinecone_client.Index.assert_called_once_with(pinecone_index_name)
        mock_pinecone_index.query.assert_called_once()
        call_args, call_kwargs = mock_pinecone_index.query.call_args
        self.assert_list_almost_equal(call_kwargs['vector'], expected_final_embedding)
        self.assertEqual(call_kwargs['top_k'], PINECONE_TOP_K)
        # Namespace no longer directly passed in tests, assumed default or None in DoFn
        # self.assertEqual(call_kwargs['namespace'], PINECONE_NAMESPACE)
        # include_values is not configurable in DoFn, defaults to False internally? Check DoFn.
        # self.assertEqual(call_kwargs['include_values'], False) # Assuming Pinecone default or DoFn setting
        self.assertEqual(call_kwargs['include_metadata'], True) # QueryPinecone sets this


    # --- Test 2: Main Pipeline Flow After Initial Processing ---
    # Patch all source libraries used across the involved DoFns
    @patch(MOCK_FS_SERVER_TIMESTAMP_PATH, new=DUMMY_TIMESTAMP) # Global dummy timestamp
    @patch(MOCK_CLOUD_TASKS_TIMESTAMP_PATH) # For timestamp_pb2.Timestamp (needed for Task creation)
    @patch(MOCK_DATETIME_PATH) # Patch datetime module in scheduling.py
    @patch(MOCK_CLOUD_TASKS_CLIENT_PATH)
    @patch(MOCK_OPENAI_CLIENT_PATH)
    @patch(MOCK_FS_CLIENT_PATH)
    @patch(MOCK_ACCESS_SECRET_PATH)
    @patch(MOCK_PYPDF2_READER_PATH) # For Rerank instructions
    @patch(MOCK_GCS_CLIENT_PATH) # For Rerank instructions
    def test_main_pipeline_flow_after_initial_processing(
        self,
        mock_gcs_client_constructor,
        mock_pypdf2_reader_constructor,
        mock_access_secret,
        mock_fs_client_constructor,
        mock_openai_client_constructor,
        mock_tasks_client_constructor,
        mock_protobuf_timestamp_constructor, # Mock for timestamp_pb2.Timestamp()
        mock_scheduling_datetime, # Mock for datetime module in scheduling.py
    ):
        """ Tests the main flow: Rerank -> (Lying Score & Schedule Delayed) -> CoGroupBy -> Update -> Suggest NextQ """

        # --- Test Data ---
        user_id = 'user_main_flow'
        match_id_1 = 'match_mf_1'
        match_id_2 = 'match_mf_2' # Included in initial, filtered by rerank
        match_id_3 = 'match_mf_3'
        # Input to RerankMatchesDoFn needs user_id, embedding, matches, query_time
        initial_embedding = [0.5] * EMBEDDING_DIM
        initial_matches_data = [
            {'id': match_id_1, 'score': 0.95},
            {'id': match_id_2, 'score': 0.60}, # Lower score, might be filtered
            {'id': match_id_3, 'score': 0.85}
        ]
        initial_pipeline_input = (user_id, { # Represents output of QueryPinecone
            'user_id': user_id,
            'embedding': initial_embedding,
            'matches': initial_matches_data,
            'query_time': FIXED_QUERY_TIME
        })
        # Output of RerankMatchesDoFn
        reranked_matches_list = [
            {'id': match_id_3, 'score': 0.98, 'match_reason': '...'}, # Added reason
            {'id': match_id_1, 'score': 0.92, 'match_reason': '...'}
        ]
        rerank_openai_response_content = json.dumps({ # Simulate OpenAI response for reranking
             'compatibility_score': 0.95, # Overall score (example)
             'reranked_matches': reranked_matches_list,
             'suggested_questions': ["Rerank Q1?", "Rerank Q2?"] # Added questions
        })
        # Expected output element from RerankMatchesDoFn
        reranked_matches_output = {
            'user_id': user_id,
            'embedding': initial_embedding, # Pass through embedding
            'query_time': FIXED_QUERY_TIME, # Pass through query time
            'original_matches': initial_matches_data, # Keep original matches
            'reranked_matches': reranked_matches_list, # Add reranked list
            'suggested_questions': ["Rerank Q1?", "Rerank Q2?"] # Add suggested Qs
        }
        reranked_matches_formatted = [(user_id, {'type': 'reranked_match', 'data': reranked_matches_output})] # For CoGroupByKey

        # Data for other branches (Lying Score, Scheduling)
        # Profile data needed for Rerank, Lying Score, Next Question
        # Create the dummy timestamp *inside* the test now using firestore.Timestamp
        dummy_fs_timestamp_for_test = firestore.Timestamp(2023, 1, 1, 12, 0, 0) # Use firestore.Timestamp

        user_profile_data = { 'id': user_id, 'name': 'Main Flow User', 'questions_answers': { # Use map now
            'q_user1': {'question': 'Q_user1', 'answer': 'A_user1', 'section': 's1', 'timestamp': dummy_fs_timestamp_for_test},
            'q_user3': {'question': 'Q_user3', 'answer': 'A_user3', 'section': 's3', 'timestamp': dummy_fs_timestamp_for_test}
        }}
        match1_profile_data = { 'id': match_id_1, 'name': 'Match 1', 'questions_answers': {
            'q_match1': {'question': 'Q_match1', 'answer': 'A_match1_1', 'section': 's1', 'timestamp': dummy_fs_timestamp_for_test},
        }}
        match3_profile_data = { 'id': match_id_3, 'name': 'Match 3', 'questions_answers': {
             'q_match3': {'question': 'Q_match3', 'answer': 'A_match3_3', 'section': 's3', 'timestamp': dummy_fs_timestamp_for_test}
        }}
        # For Lying Score calculation - history
        qa_edit_history_data = {
            f'{user_id}_q_user1_edit1': {'profileId': user_id, 'qaId': 'q_user1', 'previousAnswer': 'Old A1', 'newAnswer': 'A_user1', 'timestamp': dummy_fs_timestamp_for_test}
        }
        # OpenAI responses for Lying Score
        lying_score_openai_responses = ['0.15', '0.25'] # Responses for Q_user1 and Q_user3 (based on history/current)
        # Expected output from CalculateLyingScoreDoFn branch (before formatting)
        lying_scores_raw = [
            {'profile_id': user_id, 'qa_id': 'q_user1', 'lying_score': 0.15},
            {'profile_id': user_id, 'qa_id': 'q_user3', 'lying_score': 0.25} # Assuming no history -> 0? Let's assume OpenAI gives 0.25
        ]
        # Formatted for CoGroupByKey
        lying_scores_formatted = [
            (user_id, {'type': 'lying_score', 'data': {'match_id': ANY, 'score': 0.15, 'reason': ANY, 'qa_pair': ANY}}), # Structure mismatch - Update test/DoFn
            (user_id, {'type': 'lying_score', 'data': {'match_id': ANY, 'score': 0.25, 'reason': ANY, 'qa_pair': ANY}})
        ]
        # Aggregated score data expected by UpdateAllScoresDoFn
        aggregate_score_data = {
             'scores': {'q_user1': 0.15, 'q_user3': 0.25}, # Per QA scores
             'aggregate': 0.20 # Calculated average
        }

        # Data for Next Question logic
        updated_user_profile_data_for_nextq = { # User profile *after* UpdateAllScores writes aggregate score
            **user_profile_data,
            'aggregateLyingScore': 0.20,
            # Add other fields SuggestNextQ might read, e.g., last suggested question
            'suggested_next_question_id': None # Example field
        }
        # OpenAI response for SuggestNextQuestionDoFn
        suggested_question_openai_response = "Suggested Q after Main Flow?"
        # Question bank data needed by SuggestNextQ
        question_bank_data = {
            'Q_FOUNDATIONAL1': {'id': 'Q_FOUNDATIONAL1', 'text': 'Foundational Q1?', 'tags': ['foundational'], 'priority': 1},
            'Q_FOUNDATIONAL2': {'id': 'Q_FOUNDATIONAL2', 'text': 'Foundational Q2?', 'tags': ['foundational'], 'priority': 2}, # Higher priority, should be picked
            'Q_ALREADY_ANSWERED': {'id': 'q_user1', 'text': 'Q_user1', 'tags': [], 'priority': 0} # Already answered
        }
        # Expected output from SuggestNextQuestionDoFn
        suggested_next_q_output = (user_id, 'Q_FOUNDATIONAL2') # Expect highest priority unanswered foundational Q

        # Data for Scheduling logic
        schedule_output_formatted = [(user_id, {'type': 'schedule_result', 'data': reranked_matches_output})] # For CoGroupByKey
        mock_parent_queue_path = f"projects/{TEST_PROJECT_ID}/locations/{TEST_LOCATION_ID}/queues/{TEST_QUEUE_ID}"
        mock_task_name = f'{mock_parent_queue_path}/tasks/mocktask123'
        # Data for PDF instructions read by Rerank
        pdf_instruction_text = "Rerank based on these instructions."
        pdf_bytes = b"%PDF-1.4..." # Dummy PDF bytes

        # --- Mock Configuration ---
        # Configure access_secret mock for this test
        def access_secret_side_effect(project_id, secret_id):
            # Map secrets needed by DoFns in this test flow
            if secret_id == "OPENAI_API_KEY": return 'openai-key-main'
            if secret_id == "GOOGLE_APPLICATION_CREDENTIALS": return '/path/to/dummy/creds.json' # For GCS/Tasks
            # Add other secrets if needed by DoFns called here
            return None
        mock_access_secret.side_effect = access_secret_side_effect

        # Firestore Client (used by multiple DoFns)
        mock_fs_client, mock_batch, mock_transaction = self._setup_mock_firestore_client(mock_fs_client_constructor)
        # Configure reads needed by Rerank, Lying Score, Next Question
        self._configure_mock_firestore_reads(mock_fs_client, {
            'user_profiles': { # Collection name used by Rerank/NextQ
                 user_id: user_profile_data, # User profile for Rerank
                 match_id_1: match1_profile_data, # Match profiles for Rerank
                 match_id_3: match3_profile_data,
            },
            'QUESTIONS': question_bank_data, # For SuggestNextQ's question bank load
            'QA_EDIT_LOGS': qa_edit_history_data, # For CalculateLyingScore edit history query
            'delayed_matching_tasks': {} # For ScheduleDelayedMatching write check
        })
        # Configure query needed by CalculateLyingScoreDoFn
        self._configure_mock_firestore_query(mock_fs_client, 'QA_EDIT_LOGS', qa_edit_history_data)

        # Configure mock for datetime.utcnow() used in ScheduleDelayedMatching
        mock_scheduling_datetime.utcnow.return_value = datetime.datetime.fromtimestamp(FIXED_QUERY_TIME, tz=datetime.timezone.utc)

        # OpenAI Client (used by multiple DoFns)
        mock_openai_client = self._setup_mock_openai_client(mock_openai_client_constructor)
        # Configure responses needed by Rerank, Lying Score, Next Question
        self._setup_mock_openai_chat_completions(mock_openai_client, [
            rerank_openai_response_content,
            *lying_score_openai_responses,
            suggested_question_openai_response
        ])

        # GCS Client and PyPDF2 Reader (for Rerank)
        mock_gcs_client = self._setup_mock_gcs_client(mock_gcs_client_constructor)
        self._configure_mock_gcs_pdf_read(mock_gcs_client, TEST_BUCKET_NAME, TEST_PDF_PATH, pdf_bytes)
        self._setup_mock_pypdf2_reader(mock_pypdf2_reader_constructor, pdf_instruction_text)

        # Cloud Tasks Client (for Scheduling)
        mock_tasks_client = self._setup_mock_cloud_tasks_client(mock_tasks_client_constructor)
        mock_created_task = self._configure_mock_cloud_tasks_creation(mock_tasks_client, mock_parent_queue_path, mock_task_name)
        # Configure timestamp_pb2.Timestamp() used by ScheduleDelayedMatching
        mock_protobuf_timestamp_constructor.return_value = DUMMY_TASK_TIMESTAMP

        # --- Pipeline ---
        # Instantiate DoFns (using updated __init__ params where needed)
        rerank_dofn = RerankMatchesDoFn(
            project_id=TEST_PROJECT_ID,
            profiles_collection='user_profiles', # Pass collection name
            pdf_bucket=TEST_BUCKET_NAME,
            pdf_instructions_path=TEST_PDF_PATH
            # model_name is now internal to the DoFn
        )
        format_rerank_dofn = beam.Map(lambda x: (x['user_id'], {'type': 'reranked_match', 'data': x})) # Format based on Rerank output dict

        # Branch for Lying Score (input needs modification)
        # Assuming Rerank output is the basis, need to extract QAs from *user* profile
        extract_user_qas_dofn = ExtractQAsForScoringDoFn() # This expects a profile dict, not rerank output
        # TODO: Pipeline modification needed here. Let's assume for now Lying Score pipeline starts
        # with the user profile fetched separately or passed differently.
        # Simulate input to Lying Score branch:
        lying_score_input = [
             {'profile_id': user_id, 'qa_id': 'q_user1', 'qa_data': user_profile_data['questions_answers']['q_user1']},
             {'profile_id': user_id, 'qa_id': 'q_user3', 'qa_data': user_profile_data['questions_answers']['q_user3']}
        ]
        calculate_lying_dofn = CalculateLyingScoreDoFn(project_id=TEST_PROJECT_ID)
        # Format output for CoGroupByKey (structure seems different from test data - adapt)
        format_lying_score_dofn = beam.Map(lambda x: (x['profile_id'], {'type': 'lying_score', 'data': x})) # Format based on CalculateLyingScore output
        aggregate_lying_scores_dofn = AggregateScoresDoFn() # Aggregates per-QA scores for a user

        # Branch for Scheduling (input is output of Rerank)
        schedule_dofn = ScheduleDelayedMatchingDoFn(
            project_id=TEST_PROJECT_ID, location=TEST_LOCATION_ID, queue_name=TEST_QUEUE_ID,
            topic_name=TEST_PUBSUB_TOPIC, delay_seconds=TEST_DELAY_SECONDS
        )
        format_schedule_dofn = beam.Map(lambda x: (x['user_id'], {'type': 'schedule_result', 'data': x})) # Format based on Schedule output dict

        # CoGroupByKey and subsequent steps
        # Define a DoFn to process the CoGrouped data and prepare for UpdateAllScores
        class ProcessCoGroupedForUpdateDoFn(beam.DoFn):
            def process(self, element):
                user_id, grouped_data = element
                 # Assuming Lying Scores branch produced aggregated results
                 lying_data_list = grouped_data.get('lying_scores_tag', []) # Expect aggregate result here
                 # Reranked data list might be empty if no matches
                 # Scheduling list might be empty if scheduling failed or didn't run
                 # Need robust handling

                 if lying_data_list:
                     # Assuming AggregateScoresDoFn output is tagged correctly
                     # yield (user_id, lying_data_list[0]) # Yield (user_id, {'scores': {...}, 'aggregate': ...})
                     # Let's yield the aggregate score data directly for UpdateAllScoresDoFn
                     # This requires AggregateScoresDoFn to be run *before* the CoGroupByKey
                     # Or adjust this processor / UpdateAllScoresDoFn input expectations.
                     # For now, simulate the expected input for UpdateAllScores:
                     yield (user_id, aggregate_score_data) # Simulate aggregation result
                 else:
                      # Handle case where no scores were calculated
                      yield (user_id, {'scores': {}, 'aggregate': None})

        update_scores_dofn = UpdateAllScoresDoFn(project_id=TEST_PROJECT_ID, profiles_collection='user_profiles')
        suggest_next_q_dofn = SuggestNextProfileQuestionDoFn(project_id=TEST_PROJECT_ID, profiles_collection='user_profiles')
        update_next_q_dofn = UpdateNextQuestionDoFn(project_id=TEST_PROJECT_ID, profiles_collection='user_profiles')

        with TestPipeline() as p:
            # Initial Input PCollection
            initial_input_pc = p | 'CreateInitialInput' >> beam.Create([initial_pipeline_input])

            # Reranking Branch
            reranked_matches_pc = initial_input_pc | 'RerankMatches' >> beam.ParDo(rerank_dofn)
            reranked_formatted_pc = reranked_matches_pc | 'FormatReranked' >> format_rerank_dofn

            # Lying Score Branch (Simulated Input)
            lying_score_start = p | 'CreateLyingScoreInput' >> beam.Create(lying_score_input)
            lying_scores_calculated = lying_score_start | 'CalculateLyingScores' >> beam.ParDo(calculate_lying_dofn)
            # Aggregate scores *before* CoGroupByKey
            aggregated_lying_scores = (
                lying_scores_calculated
                | 'GroupScoresByUser' >> beam.GroupBy(lambda x: x['profile_id']) # Group by user ID
                | 'MapToUserScores' >> beam.Map(lambda kv: (kv[0], list(kv[1]))) # UserID, List[{qa_id:.., score:..}]
                | 'AggregateScores' >> beam.ParDo(aggregate_lying_scores_dofn) # Output: (UserID, {'scores':.., 'aggregate':..})
            )
            lying_scores_formatted_pc = aggregated_lying_scores | 'FormatLyingScores' >> beam.Map(lambda x: (x[0], {'type': 'lying_score', 'data': x[1]}))


            # Scheduling Branch (Input from Reranking)
            schedule_results_pc = reranked_matches_pc | 'ScheduleDelayed' >> beam.ParDo(schedule_dofn)
            schedule_formatted_pc = schedule_results_pc | 'FormatSchedule' >> format_schedule_dofn

            # Combine Streams - Use aggregated scores now
            grouped_data = (
                {
                    'reranked_matches_tag': reranked_formatted_pc,
                    'lying_scores_tag': lying_scores_formatted_pc, # Tag the aggregated scores
                    'scheduling_tag': schedule_formatted_pc
                }
                | 'CombineStreams' >> beam.CoGroupByKey()
            )

            # Process CoGrouped Data for Update
            scores_to_update = grouped_data | 'ProcessCoGroupedData' >> beam.ParDo(ProcessCoGroupedForUpdateDoFn())

            # Update Scores -> Suggest Next Question -> Update Next Question
            user_id_after_update = scores_to_update | 'UpdateAllScores' >> beam.ParDo(update_scores_dofn)
            # SuggestNextQ expects user_id input
            next_q_suggestion = user_id_after_update | 'SuggestNextQuestion' >> beam.ParDo(suggest_next_q_dofn)
            final_update_result = next_q_suggestion | 'UpdateNextQuestion' >> beam.ParDo(update_next_q_dofn)

            # Assertions
            # Check the final update result (should be the tuple from UpdateNextQ)
            def check_final_update(actual_list):
                 assert len(actual_list) == 1
                 # UpdateNextQuestionDoFn yields the (user_id, suggested_q_id) tuple it processed
                 assert actual_list[0] == suggested_next_q_output

            assert_that(final_update_result, check_final_update, label="CheckFinalUpdateResult")

        # --- Verification ---
        # Access Secret (check counts if specific keys were needed)
        self.assertGreaterEqual(mock_access_secret.call_count, 1) # Check it was called at least once

        # OpenAI Client Constructor
        mock_openai_client_constructor.assert_called_once_with(api_key='openai-key-main')
        # OpenAI API Calls
        self.assertEqual(mock_openai_client.chat.completions.create.call_count, 4)

        # Cloud Tasks Client Constructor and Calls
        mock_tasks_client_constructor.assert_called_once()
        mock_tasks_client.queue_path.assert_called_once_with(TEST_PROJECT_ID, TEST_LOCATION_ID, TEST_QUEUE_ID)
        mock_tasks_client.create_task.assert_called_once()
        call_args, call_kwargs = mock_tasks_client.create_task.call_args
        self.assertIn('request', call_kwargs)
        request_arg = call_kwargs['request']
        self.assertEqual(request_arg.parent, mock_parent_queue_path)
        task_arg = request_arg.task
        self.assertTrue(hasattr(task_arg, 'pubsub_target'))
        self.assertEqual(task_arg.pubsub_target.topic_name, f'projects/{TEST_PROJECT_ID}/topics/{TEST_PUBSUB_TOPIC}')
        pubsub_data_decoded = json.loads(base64.b64decode(task_arg.pubsub_target.data).decode('utf-8'))
        self.assertEqual(pubsub_data_decoded.get('userId'), user_id)
        self.assertEqual(task_arg.pubsub_target.attributes['userId'], user_id)
        # Check timestamp using the mock task timestamp
        self.assertEqual(task_arg.schedule_time, DUMMY_TASK_TIMESTAMP)
        mock_protobuf_timestamp_constructor.assert_called_once_with(seconds=int(FIXED_QUERY_TIME + TEST_DELAY_SECONDS))

        # GCS Client and PDF Reader Mocks (for Rerank)
        mock_gcs_client_constructor.assert_called_once_with(project=TEST_PROJECT_ID)
        mock_gcs_client.bucket.assert_called_once_with(TEST_BUCKET_NAME)
        mock_gcs_client.bucket(TEST_BUCKET_NAME).blob.assert_called_once_with(TEST_PDF_PATH)
        mock_gcs_client.bucket(TEST_BUCKET_NAME).blob(TEST_PDF_PATH).download_as_bytes.assert_called_once()
        mock_pypdf2_reader_constructor.assert_called_once()

        # Firestore
        mock_fs_client_constructor.assert_called_once_with(project=TEST_PROJECT_ID)
        mock_fs_client.collection('user_profiles').document(user_id).get.assert_called()
        mock_fs_client.collection('user_profiles').document(match_id_1).get.assert_called()
        mock_fs_client.collection('user_profiles').document(match_id_3).get.assert_called()
        mock_fs_client.collection('QA_EDIT_LOGS').where.assert_called()
        mock_fs_client.collection('QUESTIONS').stream.assert_called_once()
        mock_fs_client.collection('delayed_matching_tasks').document(user_id).set.assert_called_once()
        set_call_args, set_call_kwargs = mock_fs_client.collection('delayed_matching_tasks').document(user_id).set.call_args
        set_data = set_call_args[0]
        self.assertEqual(set_data['taskName'], mock_created_task.name)
        self.assertEqual(set_data['status'], 'SCHEDULED')
        expected_scheduled_fs_timestamp = firestore.Timestamp.fromtimestamp(FIXED_QUERY_TIME + TEST_DELAY_SECONDS)
        self.assertEqual(set_data['scheduledTime'], expected_scheduled_fs_timestamp)
        self.assertEqual(set_data['createdAt'], DUMMY_TIMESTAMP)
        self.assertTrue(set_call_kwargs.get('merge'))
        mock_scheduling_datetime.utcnow.assert_called_once()
        mock_fs_client.batch.assert_called()
        mock_batch.update.assert_called()
        mock_batch.commit.assert_called()
        mock_fs_client.transaction.assert_called()
        mock_transaction.update.assert_called()
        mock_transaction.commit.assert_called_once()


    # --- Test 3: Error Handling in Fetch -> Embed -> Query ---
    # Patch relevant source libraries
    @patch(MOCK_ACCESS_SECRET_PATH)
    @patch(MOCK_PINECONE_CLIENT_PATH)
    @patch(MOCK_OPENAI_CLIENT_PATH)
    @patch(MOCK_FS_CLIENT_PATH)
    def test_fetch_embed_query_error_handling(self,
                                              mock_fs_client_constructor,
                                              mock_openai_client_constructor,
                                              mock_pinecone_client_constructor,
                                              mock_access_secret):
        """Tests pipeline behavior when GenerateUserEmbedding's OpenAI call fails."""
        user_id_error = "user_embed_fail"
        test_profile_data = {
            'id': user_id_error,
            'name': 'Embed Error User',
            'questions_answers': [{'question': 'Q_err?', 'answer': 'A_err', 'section': 's_err'}]
        }
        error_message = "Simulated OpenAI API Error"
        pinecone_index_name = 'test-index-err'

        # Configure access_secret mock
        def access_secret_side_effect(project_id, secret_id):
             if secret_id == "OPENAI_API_KEY": return 'openai-key-err'
             if secret_id == "PINECONE_API_KEY": return 'pinecone-key-err'
             return None
        mock_access_secret.side_effect = access_secret_side_effect

        # --- Mock Setup ---
        # Firestore
        mock_fs_client, _, _ = self._setup_mock_firestore_client(mock_fs_client_constructor)
        self._configure_mock_firestore_reads(mock_fs_client, {
            'user_profiles': { user_id_error: test_profile_data }
        })

        # OpenAI - Configure to raise an error
        mock_openai_client = self._setup_mock_openai_client(mock_openai_client_constructor)
        # Mock embeddings attribute and make create raise error
        mock_openai_client.embeddings = MagicMock()
        mock_openai_client.embeddings.create.side_effect = Exception(error_message)

        # Pinecone - Setup needed for QueryPinecone's setup, but query shouldn't be called
        mock_pinecone_client, mock_pinecone_index = self._setup_mock_pinecone_client(
            mock_pinecone_client_constructor, pinecone_index_name
        )

        # --- Pipeline ---
        fetch_dofn = FetchProfileDoFn(project_id=TEST_PROJECT_ID, collection_name='user_profiles')
        embed_dofn = GenerateUserEmbedding(project_id=TEST_PROJECT_ID)
        query_dofn = QueryPinecone(
            project_id=TEST_PROJECT_ID,
            pinecone_region='gcp-dummy-err',
            pinecone_index=pinecone_index_name,
            top_k=PINECONE_TOP_K
        )

        with TestPipeline() as p:
            input_data = p | 'CreateErrorInput' >> beam.Create([{'user_id': user_id_error}])
            profile_data = input_data | 'FetchProfileError' >> beam.ParDo(fetch_dofn)
            # Wrap ParDo in try/except or expect pipeline failure?
            # For checking downstream, expect embedding_data to be empty or raise error
            # Let's assume the ParDo fails and query_results is empty
            try:
            embedding_data = profile_data | 'GenerateEmbeddingError' >> beam.ParDo(embed_dofn)
            query_results = embedding_data | 'QueryPineconeError' >> beam.ParDo(query_dofn)
                 # If no exception, assert query_results is empty
            assert_that(query_results, is_empty(), label="CheckQueryOutputIsEmptyOnError")
            except Exception as e:
                 # Check if the exception is the one we expect from OpenAI mock
                 self.assertIn(error_message, str(e))
                 # If exception is raised, assert_that won't run, which is expected.

        # --- Verification ---
        # Firestore
        mock_fs_client_constructor.assert_called_once_with(project=TEST_PROJECT_ID)
        mock_fs_client.collection('user_profiles').document(user_id_error).get.assert_called_once()

        # Access Secret
        mock_access_secret.assert_any_call(TEST_PROJECT_ID, "OPENAI_API_KEY")
        # PINECONE_API_KEY access depends on whether QueryPinecone setup runs before error
        # It likely does run setup.
        mock_access_secret.assert_any_call(TEST_PROJECT_ID, "PINECONE_API_KEY")

        # OpenAI
        mock_openai_client_constructor.assert_called_once_with(api_key='openai-key-err')
        mock_openai_client.embeddings.create.assert_called_once() # The failing call

        # Pinecone
        # Setup should run for QueryPinecone
        mock_pinecone_client_constructor.assert_called_once_with(api_key='pinecone-key-err', environment='gcp-dummy-err')
        mock_pinecone_client.Index.assert_called_once_with(pinecone_index_name)
        # Query should NOT be called
        mock_pinecone_index.query.assert_not_called()


    # --- Test 4: Delayed Matching Flow ---
    # Simplified test focusing only on Fetch -> Embed -> Query part triggered by scheduler
    @patch(MOCK_ACCESS_SECRET_PATH)
    @patch(MOCK_PINECONE_CLIENT_PATH)
    @patch(MOCK_OPENAI_CLIENT_PATH)
    @patch(MOCK_FS_CLIENT_PATH)
    def test_delayed_matching_flow(self,
                                   mock_fs_client_constructor,
                                   mock_openai_client_constructor,
                                   mock_pinecone_client_constructor,
                                   mock_access_secret):
        """Tests the delayed flow: Input (userId) -> Fetch -> Embed -> Query."""
        user_id_delayed = "user_delayed_match"
        test_profile_data_delayed = {
            'id': user_id_delayed,
            'name': 'Delayed Test User',
            'questions_answers': [
                {'question': 'Q_delayed1?', 'answer': 'A_delayed1', 'section': 's_d1'},
                {'question': 'Q_delayed2?', 'answer': 'A_delayed2', 'section': 's_d2'}
            ]
        }
        openai_embeddings_delayed = [[0.8] * EMBEDDING_DIM, [0.9] * EMBEDDING_DIM]
        expected_final_embedding_delayed = [0.85] * EMBEDDING_DIM
        pinecone_matches_data_delayed = [
            {'id': 'match_d1', 'score': 0.7},
            {'id': 'match_d2', 'score': 0.6}
        ]
        # Expected output structure from QueryPinecone
        expected_query_output_structure = {
            'user_id': user_id_delayed,
            'matches': pinecone_matches_data_delayed,
            'embedding': expected_final_embedding_delayed,
             # query_time might be added by QueryPinecone even if not in input, check DoFn
            'query_time': ANY # Check if QueryPinecone adds this
        }
        pinecone_index_name = 'test-index-delayed'

        # Configure access_secret mock
        def access_secret_side_effect(project_id, secret_id):
            if secret_id == "OPENAI_API_KEY": return 'openai-key-delayed'
            if secret_id == "PINECONE_API_KEY": return 'pinecone-key-delayed'
            return None
        mock_access_secret.side_effect = access_secret_side_effect

        # --- Mock Setup ---
        # Firestore
        mock_fs_client, _, _ = self._setup_mock_firestore_client(mock_fs_client_constructor)
        self._configure_mock_firestore_reads(mock_fs_client, {
            'user_profiles': { user_id_delayed: test_profile_data_delayed }
        })

        # OpenAI
        mock_openai_client = self._setup_mock_openai_client(mock_openai_client_constructor)
        self._setup_mock_openai_embeddings(mock_openai_client, openai_embeddings_delayed)

        # Pinecone
        mock_pinecone_client, mock_pinecone_index = self._setup_mock_pinecone_client(
            mock_pinecone_client_constructor, pinecone_index_name
        )
        # Configure query without passing query_time, as it's not in the delayed flow input element
        self._setup_mock_pinecone_query(mock_pinecone_index, pinecone_matches_data_delayed, query_time=None)

        # --- Pipeline ---
        # Instantiate DoFns
        fetch_dofn = FetchProfileDoFn(project_id=TEST_PROJECT_ID, collection_name='user_profiles')
        embed_dofn = GenerateUserEmbedding(project_id=TEST_PROJECT_ID)
        query_dofn = QueryPinecone(
            project_id=TEST_PROJECT_ID,
            pinecone_region='gcp-dummy-delayed',
            pinecone_index=pinecone_index_name, top_k=PINECONE_TOP_K
        )

        with TestPipeline() as p:
            # Input simulates message from Pub/Sub triggered by Cloud Tasks
            input_data = p | 'CreateDelayedInput' >> beam.Create([{'userId': user_id_delayed}])
            # Map to the format expected by FetchProfileDoFn
            mapped_input = input_data | 'MapInput' >> beam.Map(lambda x: {'user_id': x['userId']})
            profile_data = mapped_input | 'FetchProfileDelayed' >> beam.ParDo(fetch_dofn)
            embedding_data = profile_data | 'GenerateEmbeddingDelayed' >> beam.ParDo(embed_dofn)
            query_results = embedding_data | 'QueryPineconeDelayed' >> beam.ParDo(query_dofn)

            def check_delayed_query_output(actual_list):
                assert len(actual_list) == 1
                actual = actual_list[0]
                assert isinstance(actual, dict)
                assert actual['user_id'] == expected_query_output_structure['user_id']
                assert actual['matches'] == expected_query_output_structure['matches']
                self.assert_list_almost_equal(actual['embedding'], expected_query_output_structure['embedding'])
                # Check if query_time was added by the DoFn
                assert 'query_time' in actual
                assert isinstance(actual['query_time'], float)

            assert_that(query_results, check_delayed_query_output, label="CheckDelayedQueryOutputStructure")

        # --- Verification ---
        # Firestore
        mock_fs_client_constructor.assert_called_once_with(project=TEST_PROJECT_ID)
        mock_fs_client.collection('user_profiles').document(user_id_delayed).get.assert_called_once()

        # Access Secret
        mock_access_secret.assert_any_call(TEST_PROJECT_ID, "OPENAI_API_KEY")
        mock_access_secret.assert_any_call(TEST_PROJECT_ID, "PINECONE_API_KEY")

        # OpenAI
        mock_openai_client_constructor.assert_called_once_with(api_key='openai-key-delayed')
        self.assertEqual(mock_openai_client.embeddings.create.call_count, len(test_profile_data_delayed['questions_answers']))

        # Pinecone
        mock_pinecone_client_constructor.assert_called_once_with(api_key='pinecone-key-delayed', environment='gcp-dummy-delayed')
        mock_pinecone_client.Index.assert_called_once_with(pinecone_index_name)
        mock_pinecone_index.query.assert_called_once()
        call_args, call_kwargs = mock_pinecone_index.query.call_args
        self.assert_list_almost_equal(call_kwargs['vector'], expected_final_embedding_delayed)
        self.assertEqual(call_kwargs['top_k'], PINECONE_TOP_K)
        # Namespace default check
        # Metadata check
        self.assertEqual(call_kwargs['include_metadata'], True)

if __name__ == '__main__':
    unittest.main() 