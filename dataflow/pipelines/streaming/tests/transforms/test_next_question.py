import unittest
import apache_beam as beam
from apache_beam.testing.test_pipeline import TestPipeline
from apache_beam.testing.util import assert_that, equal_to
from unittest.mock import patch, MagicMock
from datetime import datetime

# Adjust import path based on your structure
from apps.marriage_ai.dataflow.pipelines.streaming.transforms.next_question import (
    SuggestNextProfileQuestionDoFn,
    UpdateNextQuestionDoFn,
    OPEN_CRITERIA_QUESTION_ID,
    FOUNDATIONAL_TAG
)

# Mock paths for external dependencies
MOCK_FIRESTORE_PATH = 'apps.marriage_ai.dataflow.pipelines.streaming.transforms.next_question.firestore.Client'
MOCK_OPENAI_CLIENT_PATH = 'apps.marriage_ai.dataflow.pipelines.streaming.transforms.next_question.openai.OpenAI'
MOCK_ACCESS_SECRET_PATH = 'apps.marriage_ai.dataflow.pipelines.streaming.transforms.next_question.access_secret'

# Sample Question Bank Data
SAMPLE_QUESTION_BANK = {
    'q_found_1': {'id': 'q_found_1', 'text': 'Foundational Q1 (Related)?', 'tags': [FOUNDATIONAL_TAG], 'priority': 2},
    'q_found_2': {'id': 'q_found_2', 'text': 'Foundational Q2 (Priority)?', 'tags': [FOUNDATIONAL_TAG], 'priority': 3}, # Higher priority
    'q_clarify_1': {'id': 'q_clarify_1', 'text': 'Clarification Q1 (Finance)?', 'tags': ['clarification_needed'], 'clarifies_topic': 'finance', 'priority': 5}, # Clarification question
    'q_cluster_1': {'id': 'q_cluster_1', 'text': 'Cluster Q1?', 'tags': ['cluster_derived'], 'priority': 1}, # Layer 3 candidate
    'q_other': {'id': 'q_other', 'text': 'Other Q?', 'tags': ['misc'], 'priority': 1},
    OPEN_CRITERIA_QUESTION_ID: {'id': OPEN_CRITERIA_QUESTION_ID, 'text': 'Open Criteria?', 'tags': ['layer1_open'], 'priority': 0}
}

class TestSuggestNextProfileQuestionDoFn(unittest.TestCase):

    # Helper to create mock Firestore documents/streams
    def _create_mock_docs(self, data_dict):
        mock_docs = []
        for doc_id, data in data_dict.items():
            mock_doc = MagicMock()
            mock_doc.id = doc_id
            mock_doc.to_dict.return_value = data
            mock_docs.append(mock_doc)
        return mock_docs

    @patch(MOCK_ACCESS_SECRET_PATH, return_value='test-key')
    @patch(MOCK_OPENAI_CLIENT_PATH)
    @patch(MOCK_FIRESTORE_PATH)
    def test_suggest_layer2_foundational_by_priority(self, mock_firestore_constructor, mock_openai_constructor, mock_access_secret):
        """Tests Layer 2 suggestion, falling back to highest priority foundational question."""
        # --- Mock Configuration --- 
        mock_firestore_client = MagicMock()
        mock_firestore_constructor.return_value = mock_firestore_client

        # Mock question bank loading
        mock_question_docs = self._create_mock_docs(SAMPLE_QUESTION_BANK)
        mock_firestore_client.collection('QUESTIONS').stream.return_value = mock_question_docs

        # Mock user profile loading
        user_id = 'user_layer2_prio'
        profiles_collection = 'USERS_test'
        # User has answered the open criteria q, but not the foundational ones
        user_answers = {
            OPEN_CRITERIA_QUESTION_ID: {'answer': 'Some answer', 'timestamp': datetime.now()}
        }
        mock_profile_doc = MagicMock()
        mock_profile_doc.exists = True
        mock_profile_doc.to_dict.return_value = {'questions_answers': user_answers}
        mock_firestore_client.collection(profiles_collection).document(user_id).get.return_value = mock_profile_doc

        # Mock OpenAI Client (shouldn't be used in this path)
        mock_openai_client = MagicMock()
        mock_openai_constructor.return_value = mock_openai_client

        # --- Test Data --- 
        # Input element just needs user_id as DoFn fetches the rest
        test_input_element = {
            'user_id': user_id,
            # Other fields from previous steps might be present but aren't directly used
            'scores': { 'aggregate': 0.8 }, 
            'matches': []
        }

        # --- Expected Output --- 
        # Should suggest the highest priority unanswered foundational question (q_found_2)
        expected_output = [
            (user_id, {'suggested_question_id': 'q_found_2'})
        ]

        # --- Pipeline --- 
        with TestPipeline() as p:
            input_pcoll = p | beam.Create([test_input_element])
            output_pcoll = input_pcoll | beam.ParDo(SuggestNextProfileQuestionDoFn(
                project_id='test-proj',
                profiles_collection=profiles_collection
            ))

            assert_that(output_pcoll, equal_to(expected_output), label="CheckLayer2PrioritySuggestion")

        # --- Verification --- 
        # Verify mocks were called as expected
        mock_access_secret.assert_called_once_with('test-proj', "OPENAI_API_KEY")
        mock_firestore_constructor.assert_called_once_with(project='test-proj')
        mock_firestore_client.collection.assert_any_call('QUESTIONS')
        mock_firestore_client.collection.assert_any_call(profiles_collection)
        mock_firestore_client.collection(profiles_collection).document.assert_called_once_with(user_id)
        
        # Verify OpenAI was NOT called for analysis or semantic similarity in this path
        mock_openai_client.chat.completions.create.assert_not_called()

    @patch(MOCK_ACCESS_SECRET_PATH, return_value='test-key')
    @patch(MOCK_OPENAI_CLIENT_PATH)
    @patch(MOCK_FIRESTORE_PATH)
    def test_suggest_layer2_semantic_similarity(self, mock_firestore_constructor, mock_openai_constructor, mock_access_secret):
        """Tests Layer 2 suggestion using OpenAI for semantic similarity."""
        # --- Mock Configuration --- 
        mock_firestore_client = MagicMock()
        mock_firestore_constructor.return_value = mock_firestore_client
        mock_question_docs = self._create_mock_docs(SAMPLE_QUESTION_BANK)
        mock_firestore_client.collection('QUESTIONS').stream.return_value = mock_question_docs

        user_id = 'user_layer2_sem'
        profiles_collection = 'USERS_test'
        # User answered open criteria and another question recently
        recent_answer_text = "My answer to the other question."
        user_answers = {
            OPEN_CRITERIA_QUESTION_ID: {'answer': 'Some answer', 'timestamp': datetime(2023, 1, 1)},
            'q_other': {'answer': recent_answer_text, 'timestamp': datetime.now()} # Most recent
        }
        mock_profile_doc = MagicMock()
        mock_profile_doc.exists = True
        mock_profile_doc.to_dict.return_value = {'questions_answers': user_answers}
        mock_firestore_client.collection(profiles_collection).document(user_id).get.return_value = mock_profile_doc

        # Mock OpenAI Client to return the *less* priority foundational question based on similarity
        mock_openai_client = MagicMock()
        mock_openai_constructor.return_value = mock_openai_client
        mock_completion = MagicMock()
        # Simulate OpenAI selecting the text of q_found_1 as most relevant
        mock_completion.choices[0].message.content = SAMPLE_QUESTION_BANK['q_found_1']['text']
        mock_openai_client.chat.completions.create.return_value = mock_completion

        # --- Test Data --- 
        test_input_element = {'user_id': user_id, 'scores': { 'aggregate': 0.8 }, 'matches': []}

        # --- Expected Output --- 
        # Should suggest q_found_1 due to semantic similarity, despite q_found_2 having higher priority
        expected_output = [
            (user_id, {'suggested_question_id': 'q_found_1'})
        ]

        # --- Pipeline --- 
        with TestPipeline() as p:
            input_pcoll = p | beam.Create([test_input_element])
            output_pcoll = input_pcoll | beam.ParDo(SuggestNextProfileQuestionDoFn(
                project_id='test-proj',
                profiles_collection=profiles_collection
            ))
            assert_that(output_pcoll, equal_to(expected_output), label="CheckLayer2SemanticSuggestion")

        # --- Verification ---
        mock_openai_client.chat.completions.create.assert_called_once() # Called for semantic check
        # Check that the prompt for semantic check was constructed correctly (optional but good)
        call_args, _ = mock_openai_client.chat.completions.create.call_args
        prompt_content = call_args[1][0]['content'] # Accessing messages=[{"role": "user", "content": prompt}]
        self.assertIn(recent_answer_text, prompt_content)
        self.assertIn(SAMPLE_QUESTION_BANK['q_found_1']['text'], prompt_content)
        self.assertIn(SAMPLE_QUESTION_BANK['q_found_2']['text'], prompt_content)

    @patch(MOCK_ACCESS_SECRET_PATH, return_value='test-key')
    @patch(MOCK_OPENAI_CLIENT_PATH)
    @patch(MOCK_FIRESTORE_PATH)
    def test_suggest_layer1_clarification(self, mock_firestore_constructor, mock_openai_constructor, mock_access_secret):
        """Tests Layer 1: analyze open criteria -> find clarification question."""
        # --- Mock Configuration --- 
        mock_firestore_client = MagicMock()
        mock_firestore_constructor.return_value = mock_firestore_client
        mock_question_docs = self._create_mock_docs(SAMPLE_QUESTION_BANK)
        mock_firestore_client.collection('QUESTIONS').stream.return_value = mock_question_docs

        user_id = 'user_layer1_clarify'
        profiles_collection = 'USERS_test'
        open_criteria_answer = "I value honesty and good finance management."
        user_answers = {
            OPEN_CRITERIA_QUESTION_ID: {'answer': open_criteria_answer, 'timestamp': datetime.now()}
            # No other answers needed for this test
        }
        mock_profile_doc = MagicMock()
        mock_profile_doc.exists = True
        mock_profile_doc.to_dict.return_value = {'questions_answers': user_answers}
        mock_firestore_client.collection(profiles_collection).document(user_id).get.return_value = mock_profile_doc

        # Mock OpenAI Client: first call for analysis, second potential for semantic (shouldn't happen)
        mock_openai_client = MagicMock()
        mock_openai_constructor.return_value = mock_openai_client
        # Mock analysis response: identifies 'finance' needs clarification
        analysis_completion = MagicMock()
        analysis_completion.choices[0].message.content = '{"clarification_needed": ["finance"]}'
        mock_openai_client.chat.completions.create.return_value = analysis_completion # Only response needed

        # --- Test Data --- 
        test_input_element = {'user_id': user_id, 'scores': { 'aggregate': 0.8 }, 'matches': []}

        # --- Expected Output --- 
        # Should suggest the clarification question related to 'finance' (q_clarify_1)
        expected_output = [
            (user_id, {'suggested_question_id': 'q_clarify_1'})
        ]

        # --- Pipeline --- 
        with TestPipeline() as p:
            input_pcoll = p | beam.Create([test_input_element])
            output_pcoll = input_pcoll | beam.ParDo(SuggestNextProfileQuestionDoFn(
                project_id='test-proj',
                profiles_collection=profiles_collection
            ))
            assert_that(output_pcoll, equal_to(expected_output), label="CheckLayer1Clarification")

        # --- Verification ---
        # OpenAI called once for analysis
        mock_openai_client.chat.completions.create.assert_called_once()
        call_args, _ = mock_openai_client.chat.completions.create.call_args
        prompt_content = call_args[1][0]['content']
        self.assertIn(open_criteria_answer, prompt_content)
        self.assertIn('clarification_needed', prompt_content) # Check analysis prompt structure

    @patch(MOCK_ACCESS_SECRET_PATH, return_value='test-key')
    @patch(MOCK_OPENAI_CLIENT_PATH)
    @patch(MOCK_FIRESTORE_PATH)
    def test_suggest_layer3_cluster_fallback_none(self, mock_firestore_constructor, mock_openai_constructor, mock_access_secret):
        """Tests fallback when Layer 1&2 done, and Layer 3 placeholder finds nothing."""
        # --- Mock Configuration --- 
        mock_firestore_client = MagicMock()
        mock_firestore_constructor.return_value = mock_firestore_client
        mock_question_docs = self._create_mock_docs(SAMPLE_QUESTION_BANK)
        mock_firestore_client.collection('QUESTIONS').stream.return_value = mock_question_docs

        user_id = 'user_layer3_fallback'
        profiles_collection = 'USERS_test'
        # User answered open criteria AND all foundational questions
        user_answers = {
            OPEN_CRITERIA_QUESTION_ID: {'answer': 'Done', 'timestamp': datetime(2023, 1, 1)},
            'q_found_1': {'answer': 'Done', 'timestamp': datetime(2023, 1, 2)},
            'q_found_2': {'answer': 'Done', 'timestamp': datetime(2023, 1, 3)}
            # q_clarify_1, q_cluster_1, q_other are unanswered
        }
        mock_profile_doc = MagicMock()
        mock_profile_doc.exists = True
        mock_profile_doc.to_dict.return_value = {'questions_answers': user_answers}
        mock_firestore_client.collection(profiles_collection).document(user_id).get.return_value = mock_profile_doc

        # Mock OpenAI Client (might be called for semantic check on empty cluster set, or not at all)
        mock_openai_client = MagicMock()
        mock_openai_constructor.return_value = mock_openai_client

        # --- Test Data --- 
        # Provide some dummy matches, although _get_cluster_questions is hardcoded empty
        test_input_element = {'user_id': user_id, 'scores': { 'aggregate': 0.8 }, 'matches': [{'id': 'match1'}]}

        # --- Expected Output --- 
        # Since _get_cluster_questions is empty, and Layer 1&2 are done, expect no suggestion
        expected_output = []

        # --- Pipeline --- 
        with TestPipeline() as p:
            input_pcoll = p | beam.Create([test_input_element])
            output_pcoll = input_pcoll | beam.ParDo(SuggestNextProfileQuestionDoFn(
                project_id='test-proj',
                profiles_collection=profiles_collection
            ))
            assert_that(output_pcoll, equal_to(expected_output), label="CheckLayer3FallbackNone")
        
        # --- Verification --- 
        # OpenAI should NOT be called for analysis. Might be called for semantic check if logic gets that far.
        # mock_openai_client.chat.completions.create.assert_not_called() # Or assert specific calls avoided

    @patch(MOCK_ACCESS_SECRET_PATH, return_value='test-key')
    @patch(MOCK_OPENAI_CLIENT_PATH)
    @patch(MOCK_FIRESTORE_PATH)
    def test_suggest_profile_not_found(self, mock_firestore_constructor, mock_openai_constructor, mock_access_secret):
        """Tests behavior when the user profile is not found."""
        # --- Mock Configuration --- 
        mock_firestore_client = MagicMock()
        mock_firestore_constructor.return_value = mock_firestore_client
        mock_question_docs = self._create_mock_docs(SAMPLE_QUESTION_BANK)
        mock_firestore_client.collection('QUESTIONS').stream.return_value = mock_question_docs # Still loads bank

        user_id = 'user_not_found'
        profiles_collection = 'USERS_test'
        # Mock profile loading - profile does not exist
        mock_profile_doc = MagicMock()
        mock_profile_doc.exists = False
        mock_firestore_client.collection(profiles_collection).document(user_id).get.return_value = mock_profile_doc

        # Mock OpenAI Client (should not be reached)
        mock_openai_client = MagicMock()
        mock_openai_constructor.return_value = mock_openai_client

        # --- Test Data --- 
        test_input_element = {'user_id': user_id, 'scores': { 'aggregate': 0.8 }, 'matches': []}

        # --- Expected Output --- 
        expected_output = [] # No suggestion if profile missing

        # --- Pipeline --- 
        with TestPipeline() as p:
            input_pcoll = p | beam.Create([test_input_element])
            output_pcoll = input_pcoll | beam.ParDo(SuggestNextProfileQuestionDoFn(
                project_id='test-proj',
                profiles_collection=profiles_collection
            ))
            assert_that(output_pcoll, equal_to(expected_output), label="CheckProfileNotFound")
        
        # --- Verification --- 
        mock_firestore_client.collection(profiles_collection).document(user_id).get.assert_called_once()
        mock_openai_client.chat.completions.create.assert_not_called()

    @patch(MOCK_ACCESS_SECRET_PATH, return_value='test-key')
    @patch(MOCK_OPENAI_CLIENT_PATH)
    @patch(MOCK_FIRESTORE_PATH)
    def test_suggest_no_unanswered_questions(self, mock_firestore_constructor, mock_openai_constructor, mock_access_secret):
        """Tests behavior when all applicable questions have been answered."""
        # --- Mock Configuration --- 
        mock_firestore_client = MagicMock()
        mock_firestore_constructor.return_value = mock_firestore_client
        mock_question_docs = self._create_mock_docs(SAMPLE_QUESTION_BANK)
        mock_firestore_client.collection('QUESTIONS').stream.return_value = mock_question_docs

        user_id = 'user_all_answered'
        profiles_collection = 'USERS_test'
        # User answered ALL questions in the bank
        user_answers = { q_id: {'answer': 'Done', 'timestamp': datetime.now()} for q_id in SAMPLE_QUESTION_BANK }
        mock_profile_doc = MagicMock()
        mock_profile_doc.exists = True
        mock_profile_doc.to_dict.return_value = {'questions_answers': user_answers}
        mock_firestore_client.collection(profiles_collection).document(user_id).get.return_value = mock_profile_doc

        # Mock OpenAI Client (shouldn't be needed if no candidates found)
        mock_openai_client = MagicMock()
        mock_openai_constructor.return_value = mock_openai_client

        # --- Test Data --- 
        test_input_element = {'user_id': user_id, 'scores': { 'aggregate': 0.8 }, 'matches': []}

        # --- Expected Output --- 
        expected_output = [] # No more questions to suggest

        # --- Pipeline --- 
        with TestPipeline() as p:
            input_pcoll = p | beam.Create([test_input_element])
            output_pcoll = input_pcoll | beam.ParDo(SuggestNextProfileQuestionDoFn(
                project_id='test-proj',
                profiles_collection=profiles_collection
            ))
            assert_that(output_pcoll, equal_to(expected_output), label="CheckAllQuestionsAnswered")
        
        # --- Verification --- 
        # Verify Firestore reads happened
        mock_firestore_client.collection(profiles_collection).document(user_id).get.assert_called_once()
        # Verify OpenAI wasn't called for analysis or similarity as no candidates should exist
        mock_openai_client.chat.completions.create.assert_not_called()

    # TODO: Add tests for Layer 3 (Cluster-Based) - requires defining cluster logic
    # TODO: Add tests for edge cases (errors in dependencies)

# --- Tests for UpdateNextQuestionDoFn --- #

@patch(MOCK_ACCESS_SECRET_PATH) # Although not used directly, DoFn setup might call it
@patch(MOCK_FIRESTORE_PATH)
class TestUpdateNextQuestionDoFn(unittest.TestCase):

    def test_update_next_question_success(self, mock_firestore_constructor, mock_access_secret):
        """Tests successful update of suggestedNextQuestionId."""
        # --- Mock Configuration --- 
        mock_db = MagicMock()
        mock_firestore_constructor.return_value = mock_db
        mock_batch = MagicMock()
        mock_db.batch.return_value = mock_batch # Use batch for updates
        mock_profile_ref = MagicMock()
        mock_db.collection.return_value.document.return_value = mock_profile_ref

        project_id = "test-project"
        collection = "USERS_test"
        user_id = "user_update_1"
        suggested_q_id = "q_next_test"
        # Input from SuggestNextProfileQuestionDoFn
        input_element = (user_id, {'suggested_question_id': suggested_q_id})

        expected_updates = {
            'suggestedNextQuestionId': suggested_q_id
        }

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_element])
            # Note: DoFn doesn't yield main output, only potential errors
            _ = input_pcoll | beam.ParDo(UpdateNextQuestionDoFn(project_id=project_id, profiles_collection=collection))

        # --- Verification --- 
        mock_firestore_constructor.assert_called_once_with(project=project_id)
        mock_db.collection.assert_called_once_with(collection)
        mock_db.collection.return_value.document.assert_called_once_with(user_id)
        mock_db.batch.assert_called_once()
        mock_batch.update.assert_called_once_with(mock_profile_ref, expected_updates)
        mock_batch.commit.assert_called_once()

    def test_update_next_question_invalid_input(self, mock_firestore_constructor, mock_access_secret):
        """Tests behavior with invalid input (e.g., missing user_id or question_id)."""
        # --- Mock Configuration --- 
        mock_db = MagicMock()
        mock_firestore_constructor.return_value = mock_db
        mock_batch = MagicMock()
        mock_db.batch.return_value = mock_batch

        project_id = "test-project"
        collection = "USERS_test"
        # Invalid input: missing suggested_question_id
        input_element = ("user_update_invalid", {})

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_element])
            main_output, error_output = (
                 input_pcoll
                 | beam.ParDo(UpdateNextQuestionDoFn(project_id=project_id, profiles_collection=collection))
                   .with_outputs(UpdateNextQuestionDoFn.OUTPUT_ERROR_TAG, main='main')
            )
            assert_that(main_output, equal_to([]), label="CheckMainOutputEmptyInvalid")
            # Optionally assert on error_output content

        # --- Verification --- 
        # Should not attempt to interact with Firestore documents/batch
        mock_firestore_constructor.assert_called_once_with(project=project_id)
        mock_db.collection.assert_not_called()
        mock_db.batch.assert_not_called()
        mock_batch.update.assert_not_called()
        mock_batch.commit.assert_not_called()

if __name__ == '__main__':
    unittest.main() 