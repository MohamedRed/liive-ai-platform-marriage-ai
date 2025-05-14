import unittest
import apache_beam as beam
from apache_beam.testing.test_pipeline import TestPipeline
from apache_beam.testing.util import assert_that, equal_to
from unittest.mock import patch, MagicMock

# Adjust import path based on your structure
# Assuming the DoFn is in pinecone_ops.py
from apps.marriage_ai.dataflow.pipelines.streaming.transforms.pinecone_ops import QueryPinecone

# Mock paths for external dependencies
# Target the pinecone_ops.py module
MOCK_PINECONE_GRPC_PATH = 'apps.marriage_ai.dataflow.pipelines.streaming.transforms.pinecone_ops.PineconeGRPC'
MOCK_ACCESS_SECRET_PATH = 'apps.marriage_ai.dataflow.pipelines.streaming.transforms.pinecone_ops.access_secret'


class TestQueryPinecone(unittest.TestCase):

    @patch(MOCK_ACCESS_SECRET_PATH, return_value="fake-pinecone-key")
    @patch(MOCK_PINECONE_GRPC_PATH)
    def test_query_pinecone_success(self, mock_pinecone_grpc_constructor, mock_access_secret):
        """Tests successful Pinecone query with GRPC client."""
        # --- Mock Configuration --- 
        mock_pinecone_client = MagicMock()
        mock_pinecone_grpc_constructor.return_value = mock_pinecone_client
        
        # Mock list_indexes response
        mock_list_response = MagicMock()
        pinecone_index_name = "test-index" # Name passed to DoFn
        index_name_formatted = pinecone_index_name.lower().replace('_', '-')
        mock_list_response.names = [index_name_formatted, 'other-index']
        mock_pinecone_client.list_indexes.return_value = mock_list_response
        
        # Mock Index object and its query method
        mock_pinecone_index = MagicMock()
        mock_pinecone_client.Index.return_value = mock_pinecone_index
        
        # Mock the Pinecone query response
        mock_query_response = MagicMock()
        # Mock usage data
        mock_usage = MagicMock()
        mock_usage.read_units = 12 # Simulate actual QRU usage
        mock_query_response.usage = mock_usage
        # Simulate finding two matches
        match1 = MagicMock()
        match1.id = "match_user_1"
        match1.score = 0.95
        match1.metadata = {'name': 'Match Alice'}
        match2 = MagicMock()
        match2.id = "match_user_2"
        match2.score = 0.88
        match2.metadata = {'name': 'Match Bob'}
        mock_query_response.matches = [match1, match2]
        mock_pinecone_index.query.return_value = mock_query_response

        # --- Test Data --- 
        user_id = 'user_query_1'
        input_vector = [0.1, 0.2, 0.3, 0.4] # Example embedding vector
        input_element = (user_id, input_vector)

        # --- Expected Output ---
        expected_matches_list = [
            {'id': 'match_user_1', 'score': 0.95, 'metadata': {'name': 'Match Alice'}},
            {'id': 'match_user_2', 'score': 0.88, 'metadata': {'name': 'Match Bob'}}
        ]
        expected_output = [{
            'user_id': user_id,
            'matches': expected_matches_list
        }]

        # --- Pipeline ---
        project_id = "test-proj"
        pinecone_region = "gcp-starter" # Should match DoFn init
        top_k = 10 # Example value

        dofn_instance = QueryPinecone(
            project_id=project_id,
            pinecone_region=pinecone_region,
            pinecone_index=pinecone_index_name,
            top_k=top_k
        )

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_element])
            output_pcoll = input_pcoll | beam.ParDo(dofn_instance)
            assert_that(output_pcoll, equal_to(expected_output), label="CheckPineconeQuerySuccessGRPC")

        # --- Verification --- 
        mock_access_secret.assert_called_once_with(project_id, "PINECONE_API_KEY")
        mock_pinecone_grpc_constructor.assert_called_once_with(api_key="fake-pinecone-key", environment=pinecone_region)
        mock_pinecone_client.list_indexes.assert_called_once()
        mock_pinecone_client.Index.assert_called_once_with(index_name_formatted)
        mock_pinecone_index.query.assert_called_once_with(
            vector=input_vector,
            top_k=top_k,
            include_metadata=True 
            # Add filter verification if needed
        )
        # Verify rate limit recalculation logic was hit (optional)
        self.assertEqual(dofn_instance.qru_per_query, mock_usage.read_units)

    @patch(MOCK_ACCESS_SECRET_PATH, return_value="fake-pinecone-key")
    @patch(MOCK_PINECONE_GRPC_PATH)
    def test_query_pinecone_query_error(self, mock_pinecone_grpc_constructor, mock_access_secret):
        """Tests behavior when index.query raises an exception."""
        # --- Mock Configuration (Setup Success) ---
        mock_pinecone_client = MagicMock()
        mock_pinecone_grpc_constructor.return_value = mock_pinecone_client
        mock_list_response = MagicMock()
        pinecone_index_name = "test-index"
        index_name_formatted = pinecone_index_name.lower().replace('_', '-')
        mock_list_response.names = [index_name_formatted]
        mock_pinecone_client.list_indexes.return_value = mock_list_response
        mock_pinecone_index = MagicMock()
        mock_pinecone_client.Index.return_value = mock_pinecone_index

        # Mock query to raise an error
        mock_pinecone_index.query.side_effect = Exception("Pinecone query failed!")

        # --- Test Data ---
        input_element = ('user_query_err', [0.5] * 10)

        # --- Expected Output ---
        expected_output = [] # Error should prevent output

        # --- Pipeline ---
        dofn_instance = QueryPinecone(
            project_id="test-proj",
            pinecone_region="gcp-starter",
            pinecone_index=pinecone_index_name,
            top_k=5
        )
        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_element])
            output_pcoll = input_pcoll | beam.ParDo(dofn_instance)
            assert_that(output_pcoll, equal_to(expected_output), label="CheckPineconeQueryError")

        # --- Verification ---
        mock_pinecone_index.query.assert_called_once() # Verify query was attempted

    @patch(MOCK_ACCESS_SECRET_PATH, return_value="fake-pinecone-key")
    @patch(MOCK_PINECONE_GRPC_PATH)
    def test_query_pinecone_setup_error_list(self, mock_pinecone_grpc_constructor, mock_access_secret):
        """Tests behavior when list_indexes fails during setup."""
        # --- Mock Configuration ---
        mock_pinecone_client = MagicMock()
        mock_pinecone_grpc_constructor.return_value = mock_pinecone_client
        # Mock list_indexes to raise error
        mock_pinecone_client.list_indexes.side_effect = Exception("Cannot list indexes!")

        # --- Test Data ---
        input_element = ('user_setup_err', [0.1] * 10)

        # --- Expected Output ---
        expected_output = [] # Setup error prevents processing

        # --- Pipeline ---
        # Expect the setup method itself to fail
        dofn_instance = QueryPinecone(
            project_id="test-proj",
            pinecone_region="gcp-starter",
            pinecone_index="any-index",
            top_k=5
        )
        with TestPipeline() as p:
             input_pcoll = p | beam.Create([input_element])
             # Setup fails, so ParDo should raise error (or produce no output)
             output_pcoll = input_pcoll | beam.ParDo(dofn_instance) 
             assert_that(output_pcoll, equal_to(expected_output), label="CheckPineconeSetupListError")

        # --- Verification ---
        mock_pinecone_client.list_indexes.assert_called_once()
        mock_pinecone_client.Index.assert_not_called()

    @patch(MOCK_ACCESS_SECRET_PATH, return_value="fake-pinecone-key")
    @patch(MOCK_PINECONE_GRPC_PATH)
    def test_query_pinecone_setup_error_not_found(self, mock_pinecone_grpc_constructor, mock_access_secret):
        """Tests behavior when the target index is not found during setup."""
        # --- Mock Configuration ---
        mock_pinecone_client = MagicMock()
        mock_pinecone_grpc_constructor.return_value = mock_pinecone_client
        # Mock list_indexes response - does NOT contain the target index
        mock_list_response = MagicMock()
        mock_list_response.names = ['other-index-1', 'other-index-2']
        mock_pinecone_client.list_indexes.return_value = mock_list_response

        # --- Test Data ---
        input_element = ('user_setup_notfound', [0.2] * 10)

        # --- Expected Output ---
        expected_output = [] # Setup error prevents processing

        # --- Pipeline ---
        # Expect the setup method itself to fail because index not found
        dofn_instance = QueryPinecone(
            project_id="test-proj",
            pinecone_region="gcp-starter",
            pinecone_index="unfindable-index",
            top_k=5
        )
        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_element])
            output_pcoll = input_pcoll | beam.ParDo(dofn_instance)
            assert_that(output_pcoll, equal_to(expected_output), label="CheckPineconeSetupNotFoundError")

        # --- Verification ---
        mock_pinecone_client.list_indexes.assert_called_once()
        mock_pinecone_client.Index.assert_not_called()

    @patch(MOCK_ACCESS_SECRET_PATH, return_value="fake-pinecone-key")
    @patch(MOCK_PINECONE_GRPC_PATH)
    def test_query_pinecone_no_matches(self, mock_pinecone_grpc_constructor, mock_access_secret):
        """Tests handling when Pinecone query returns no matches."""
        # --- Mock Configuration (Setup Success) ---
        mock_pinecone_client = MagicMock()
        mock_pinecone_grpc_constructor.return_value = mock_pinecone_client
        mock_list_response = MagicMock()
        pinecone_index_name = "test-index"
        index_name_formatted = pinecone_index_name.lower().replace('_', '-')
        mock_list_response.names = [index_name_formatted]
        mock_pinecone_client.list_indexes.return_value = mock_list_response
        mock_pinecone_index = MagicMock()
        mock_pinecone_client.Index.return_value = mock_pinecone_index

        # Mock query response with empty matches list
        mock_query_response = MagicMock()
        mock_query_response.matches = []
        mock_query_response.usage = MagicMock() # Include usage even if no matches
        mock_query_response.usage.read_units = 5
        mock_pinecone_index.query.return_value = mock_query_response

        # --- Test Data ---
        user_id = 'user_no_matches'
        input_element = (user_id, [0.9] * 10)

        # --- Expected Output ---
        # Should yield a dict with an empty matches list
        expected_output = [{
            'user_id': user_id,
            'matches': []
        }]

        # --- Pipeline ---
        dofn_instance = QueryPinecone(
            project_id="test-proj",
            pinecone_region="gcp-starter",
            pinecone_index=pinecone_index_name,
            top_k=5
        )
        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_element])
            output_pcoll = input_pcoll | beam.ParDo(dofn_instance)
            assert_that(output_pcoll, equal_to(expected_output), label="CheckPineconeNoMatches")

        # --- Verification ---
        mock_pinecone_index.query.assert_called_once() # Verify query was still made

    @patch(MOCK_ACCESS_SECRET_PATH, return_value="fake-pinecone-key")
    @patch(MOCK_PINECONE_GRPC_PATH)
    def test_query_pinecone_invalid_input(self, mock_pinecone_grpc_constructor, mock_access_secret):
        """Tests behavior with invalid input element format."""
        # --- Mock Configuration (Setup might run, but process shouldn't query) ---
        mock_pinecone_client = MagicMock()
        mock_pinecone_grpc_constructor.return_value = mock_pinecone_client
        # ... setup mocks as needed if setup validation happens ...
        # Assume setup succeeds for this test focus
        mock_list_response = MagicMock()
        mock_list_response.names = ['test-index']
        mock_pinecone_client.list_indexes.return_value = mock_list_response
        mock_pinecone_index = MagicMock()
        mock_pinecone_client.Index.return_value = mock_pinecone_index

        # --- Test Data (Invalid formats) ---
        invalid_inputs = [
            "not_a_tuple",
            (123, [0.1]), # user_id not string (assuming processed later)
            ('user_id_only'), # Missing vector
            ('user_vector_wrong_type', "not_a_list")
        ]

        # --- Expected Output ---
        expected_output = [] # No output for invalid inputs

        # --- Pipeline ---
        dofn_instance = QueryPinecone(
            project_id="test-proj",
            pinecone_region="gcp-starter",
            pinecone_index="test-index",
            top_k=5
        )
        with TestPipeline() as p:
            input_pcoll = p | beam.Create(invalid_inputs)
            output_pcoll = input_pcoll | beam.ParDo(dofn_instance)
            assert_that(output_pcoll, equal_to(expected_output), label="CheckPineconeInvalidInput")

        # --- Verification ---
        # Verify the query method was never called
        mock_pinecone_index.query.assert_not_called()

    # TODO: Add test for Pinecone query error (index.query raises Exception)
    # TODO: Add test for Pinecone setup error (e.g., list_indexes fails, index not found)
    # TODO: Add test for handling no matches found (result.matches is empty/None)
    # TODO: Add test for invalid input format 

if __name__ == '__main__':
    unittest.main() 