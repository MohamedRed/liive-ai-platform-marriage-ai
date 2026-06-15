import unittest
import apache_beam as beam
from apache_beam.testing.test_pipeline import TestPipeline
from apache_beam.testing.util import assert_that, equal_to
from unittest.mock import patch, MagicMock
from datetime import datetime

# Adjust import path based on your structure
# ACTUAL DoFn is in reranking.py
from apps.marriage_ai.dataflow.pipelines.streaming.transforms.reranking import CalculateLyingScoreDoFn, COLLECTIONS

# --- Adjust Mock Paths to Target the 'reranking' module --- #
MOCK_FIRESTORE_PATH = 'apps.marriage_ai.dataflow.pipelines.streaming.transforms.reranking.firestore.Client'
MOCK_FIRESTORE_QUERY_PATH = 'apps.marriage_ai.dataflow.pipelines.streaming.transforms.reranking.firestore.Query' # For query chaining
MOCK_OPENAI_CLIENT_PATH = 'apps.marriage_ai.dataflow.pipelines.streaming.transforms.reranking.openai.OpenAI'
MOCK_ACCESS_SECRET_PATH = 'apps.marriage_ai.dataflow.pipelines.streaming.transforms.reranking.access_secret'

# Define COLLECTIONS constant if not imported or available elsewhere in tests
# COLLECTIONS = {"QA_EDIT_LOGS": "QA_EDIT_LOGS", "USERS": "USERS"} # Example

class TestCalculateLyingScoreDoFn(unittest.TestCase):

    # Helper to create mock Firestore query results
    def _create_mock_docs(self, data_list):
        mock_docs = []
        for data in data_list:
            mock_doc = MagicMock()
            mock_doc.to_dict.return_value = data
            mock_docs.append(mock_doc)
        return mock_docs

    @patch(MOCK_ACCESS_SECRET_PATH, return_value='test-key')
    @patch(MOCK_OPENAI_CLIENT_PATH)
    @patch(MOCK_FIRESTORE_PATH)
    @patch(MOCK_FIRESTORE_QUERY_PATH) # Patch Query class if chaining methods like where/order_by
    def test_calculate_score_basic(self, mock_firestore_query, mock_firestore_constructor, mock_openai_constructor, mock_access_secret):
        """Tests basic score calculation with mock OpenAI response and history."""
        # --- Mock Configuration --- 
        
        # Mock Firestore Client
        mock_firestore_client = MagicMock()
        mock_firestore_constructor.return_value = mock_firestore_client
        
        # Mock Firestore Query Chaining
        mock_query_obj = MagicMock()
        # Make collection('...').where(...).where(...).order_by(...).limit(...) return the query object
        mock_firestore_client.collection.return_value.where.return_value.where.return_value.order_by.return_value.limit.return_value = mock_query_obj

        # Mock Firestore Query Result (edit history)
        history_data = [
            {'previousAnswer': 'Initial answer', 'newAnswer': 'Slightly changed answer', 'timestamp': datetime(2023, 1, 2)},
            {'previousAnswer': None, 'newAnswer': 'Initial answer', 'timestamp': datetime(2023, 1, 1)}
        ]
        mock_query_obj.stream.return_value = self._create_mock_docs(history_data)

        # Mock OpenAI Client
        mock_openai_client = MagicMock()
        mock_openai_constructor.return_value = mock_openai_client
        mock_completion = MagicMock()
        # Simulate OpenAI returning a float score as a string
        expected_score = 0.2
        mock_completion.choices[0].message.content = str(expected_score)
        mock_openai_client.chat.completions.create.return_value = mock_completion

        # --- Test Data --- 
        user_id = 'user_score_1'
        qa_id = 'q_test_score'
        question_text = 'Test Question?'
        current_answer_text = 'Current answer'
        test_input_element = {
            'profile_id': user_id,
            'qa_id': qa_id,
            'qa_data': {'question': question_text, 'answer': current_answer_text}
        }

        # --- Expected Output ---
        expected_output = [
            {'profile_id': user_id, 'qa_id': qa_id, 'lying_score': expected_score}
        ]

        # --- Pipeline ---
        # DoFn is defined in reranking.py
        dofn_instance = CalculateLyingScoreDoFn(project_id='test-proj')

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([test_input_element])
            output_pcoll = input_pcoll | beam.ParDo(dofn_instance)
            assert_that(output_pcoll, equal_to(expected_output), label="CheckBasicScoreCalcWithHistory")

        # --- Verification --- 
        mock_access_secret.assert_called_once_with('test-proj', "OPENAI_API_KEY")
        
        # Verify Firestore query call structure
        mock_firestore_client.collection.assert_called_once_with(COLLECTIONS["QA_EDIT_LOGS"])
        # Check the where clauses
        mock_firestore_client.collection.return_value.where.assert_any_call('profileId', '==', user_id)
        mock_firestore_client.collection.return_value.where.return_value.where.assert_any_call('qaId', '==', qa_id)
        # Check order_by and limit
        mock_firestore_client.collection.return_value.where.return_value.where.return_value.order_by.assert_called_once()
        mock_firestore_client.collection.return_value.where.return_value.where.return_value.order_by.return_value.limit.assert_called_once_with(10)
        mock_query_obj.stream.assert_called_once()

        # Verify OpenAI call
        mock_openai_client.chat.completions.create.assert_called_once()
        call_args, call_kwargs = mock_openai_client.chat.completions.create.call_args
        prompt_content = call_kwargs['messages'][0]['content']
        self.assertEqual(call_kwargs['model'], 'gpt-4')
        self.assertIn(question_text, prompt_content)
        self.assertIn(current_answer_text, prompt_content)
        self.assertIn('Initial answer', prompt_content) # Check history included
        self.assertIn('Slightly changed answer', prompt_content)

    @patch(MOCK_ACCESS_SECRET_PATH, return_value='test-key')
    @patch(MOCK_OPENAI_CLIENT_PATH)
    @patch(MOCK_FIRESTORE_PATH)
    @patch(MOCK_FIRESTORE_QUERY_PATH) # Patch Query class
    def test_calculate_score_no_history(self, mock_firestore_query, mock_firestore_constructor, mock_openai_constructor, mock_access_secret):
        """Tests score calculation when no edit history exists (expect score 0.0)."""
        # --- Mock Configuration --- 
        mock_firestore_client = MagicMock()
        mock_firestore_constructor.return_value = mock_firestore_client
        mock_query_obj = MagicMock()
        mock_firestore_client.collection.return_value.where.return_value.where.return_value.order_by.return_value.limit.return_value = mock_query_obj
        # Mock Firestore Query Result -> Empty list
        mock_query_obj.stream.return_value = []

        # Mock OpenAI Client (should not be called)
        mock_openai_client = MagicMock()
        mock_openai_constructor.return_value = mock_openai_client

        # --- Test Data --- 
        user_id = 'user_score_nohist'
        qa_id = 'q_test_nohist'
        test_input_element = {
            'profile_id': user_id,
            'qa_id': qa_id,
            'qa_data': {'question': 'Q No History?', 'answer': 'First Answer'}
        }

        # --- Expected Output ---
        # Default score of 0.0 when no history
        expected_output = [
            {'profile_id': user_id, 'qa_id': qa_id, 'lying_score': 0.0}
        ]

        # --- Pipeline ---
        dofn_instance = CalculateLyingScoreDoFn(project_id='test-proj')
        with TestPipeline() as p:
            input_pcoll = p | beam.Create([test_input_element])
            output_pcoll = input_pcoll | beam.ParDo(dofn_instance)
            assert_that(output_pcoll, equal_to(expected_output), label="CheckScoreNoHistory")

        # --- Verification --- 
        mock_query_obj.stream.assert_called_once()
        mock_openai_client.chat.completions.create.assert_not_called()

    @patch(MOCK_ACCESS_SECRET_PATH, return_value='test-key')
    @patch(MOCK_OPENAI_CLIENT_PATH)
    @patch(MOCK_FIRESTORE_PATH)
    @patch(MOCK_FIRESTORE_QUERY_PATH) # Patch Query class
    def test_calculate_score_openai_error(self, mock_firestore_query, mock_firestore_constructor, mock_openai_constructor, mock_access_secret):
        """Tests behavior when OpenAI call raises an exception."""
        # --- Mock Configuration --- 
        mock_firestore_client = MagicMock()
        mock_firestore_constructor.return_value = mock_firestore_client
        mock_query_obj = MagicMock()
        mock_firestore_client.collection.return_value.where.return_value.where.return_value.order_by.return_value.limit.return_value = mock_query_obj
        # Mock Firestore history (same as basic test)
        history_data = [
            {'previousAnswer': None, 'newAnswer': 'Initial answer', 'timestamp': datetime(2023, 1, 1)}
        ]
        mock_query_obj.stream.return_value = self._create_mock_docs(history_data)

        # Mock OpenAI Client to raise an error
        mock_openai_client = MagicMock()
        mock_openai_constructor.return_value = mock_openai_client
        mock_openai_client.chat.completions.create.side_effect = Exception("OpenAI API Error")

        # --- Test Data --- 
        test_input_element = {
            'profile_id': 'user_score_openai_err',
            'qa_id': 'q_test_openai_err',
            'qa_data': {'question': 'Q OpenAI Error?', 'answer': 'Answer that causes error'}
        }

        # --- Expected Output ---
        expected_output = [] # No output yielded on error

        # --- Pipeline ---
        # We expect the DoFn to raise the exception internally and log it
        # The pipeline runner handles the exception (e.g., sending to DLQ if configured)
        # For unit testing, we assert no output is produced in the main PCollection.
        dofn_instance = CalculateLyingScoreDoFn(project_id='test-proj')
        with TestPipeline() as p:
            input_pcoll = p | beam.Create([test_input_element])
            # Need to handle potential DoFn exception if not caught internally
            # For simplicity, we assume it's caught and just check output
            output_pcoll = input_pcoll | beam.ParDo(dofn_instance)
            assert_that(output_pcoll, equal_to(expected_output), label="CheckOpenAIError")

        # --- Verification --- 
        mock_query_obj.stream.assert_called_once()
        mock_openai_client.chat.completions.create.assert_called_once() # Verify it was attempted

    @patch(MOCK_ACCESS_SECRET_PATH, return_value='test-key')
    @patch(MOCK_OPENAI_CLIENT_PATH)
    @patch(MOCK_FIRESTORE_PATH)
    @patch(MOCK_FIRESTORE_QUERY_PATH) # Patch Query class
    def test_calculate_score_invalid_openai_response(self, mock_firestore_query, mock_firestore_constructor, mock_openai_constructor, mock_access_secret):
        """Tests behavior with invalid (non-float) OpenAI response."""
        # --- Mock Configuration --- 
        mock_firestore_client = MagicMock()
        mock_firestore_constructor.return_value = mock_firestore_client
        mock_query_obj = MagicMock()
        mock_firestore_client.collection.return_value.where.return_value.where.return_value.order_by.return_value.limit.return_value = mock_query_obj
        history_data = [
            {'previousAnswer': None, 'newAnswer': 'Initial answer', 'timestamp': datetime(2023, 1, 1)}
        ]
        mock_query_obj.stream.return_value = self._create_mock_docs(history_data)

        # Mock OpenAI Client to return non-float text
        mock_openai_client = MagicMock()
        mock_openai_constructor.return_value = mock_openai_client
        mock_completion = MagicMock()
        mock_completion.choices[0].message.content = "Cannot determine score."
        mock_openai_client.chat.completions.create.return_value = mock_completion

        # --- Test Data --- 
        test_input_element = {
            'profile_id': 'user_score_openai_inv',
            'qa_id': 'q_test_openai_inv',
            'qa_data': {'question': 'Q Invalid Resp?', 'answer': 'Answer ok'}
        }

        # --- Expected Output ---
        expected_output = [] # No output yielded on parsing error

        # --- Pipeline ---
        dofn_instance = CalculateLyingScoreDoFn(project_id='test-proj')
        with TestPipeline() as p:
            input_pcoll = p | beam.Create([test_input_element])
            output_pcoll = input_pcoll | beam.ParDo(dofn_instance)
            assert_that(output_pcoll, equal_to(expected_output), label="CheckInvalidOpenAIResponse")

        # --- Verification --- 
        mock_query_obj.stream.assert_called_once()
        mock_openai_client.chat.completions.create.assert_called_once()

    @patch(MOCK_ACCESS_SECRET_PATH, return_value='test-key')
    @patch(MOCK_OPENAI_CLIENT_PATH)
    @patch(MOCK_FIRESTORE_PATH)
    @patch(MOCK_FIRESTORE_QUERY_PATH)
    def test_calculate_score_invalid_input(self, mock_firestore_query, mock_firestore_constructor, mock_openai_constructor, mock_access_secret):
        """Tests behavior with invalid input element format."""
        # --- Mock Configuration --- 
        # Mocks shouldn't be called if input validation fails early
        mock_firestore_client = MagicMock()
        mock_firestore_constructor.return_value = mock_firestore_client
        mock_openai_client = MagicMock()
        mock_openai_constructor.return_value = mock_openai_client

        # --- Test Data --- 
        # Invalid: Missing 'qa_data'
        test_input_element = {
            'profile_id': 'user_score_invalid_input',
            'qa_id': 'q_test_invalid_input'
        }

        # --- Expected Output ---
        expected_output = [] # No output expected

        # --- Pipeline ---
        dofn_instance = CalculateLyingScoreDoFn(project_id='test-proj')
        with TestPipeline() as p:
            input_pcoll = p | beam.Create([test_input_element])
            output_pcoll = input_pcoll | beam.ParDo(dofn_instance)
            assert_that(output_pcoll, equal_to(expected_output), label="CheckInvalidInputElement")

        # --- Verification --- 
        # Verify Firestore and OpenAI were NOT called
        mock_firestore_client.collection.assert_not_called()
        mock_openai_client.chat.completions.create.assert_not_called()

    # TODO: Add tests for Firestore errors (e.g., query fails)

if __name__ == '__main__':
    unittest.main() 