import unittest
import apache_beam as beam
from apache_beam.testing.test_pipeline import TestPipeline
from apache_beam.testing.util import assert_that, equal_to
from unittest.mock import patch, MagicMock
import numpy as np # For easy vector math in test calculation

# Adjust import path based on your structure
# Assuming the DoFn is in embedding.py
from apps.marriage_ai.dataflow.pipelines.streaming.transforms.embedding import GenerateUserEmbedding

# Mock paths for external dependencies
# Target the embedding.py module
MOCK_OPENAI_CLIENT_PATH = 'apps.marriage_ai.dataflow.pipelines.streaming.transforms.embedding.openai.OpenAI'
MOCK_ACCESS_SECRET_PATH = 'apps.marriage_ai.dataflow.pipelines.streaming.transforms.embedding.access_secret'

# Predefined section weights from the DoFn (or mock if needed)
DEFAULT_SECTION_WEIGHTS = {
    "religious_practice": 2.0,
    "family_values": 1.5,
    "education": 1.2,
    "personality": 1.0,
    "hobbies": 0.8,
    "default": 1.0
}
EMBEDDING_MODEL = "text-embedding-3-large"
EMBEDDING_DIM = 3 # Using small dim for easier test calculation

class TestGenerateUserEmbedding(unittest.TestCase):

    def _mock_openai_embedding(self, mock_openai_client, qa_texts, embedding_dim=EMBEDDING_DIM):
        """Helper to configure mock OpenAI client for multiple embedding calls."""
        mock_responses = []
        for i, text in enumerate(qa_texts):
            mock_embedding_response = MagicMock()
            mock_embedding_object = MagicMock()
            # Create a unique deterministic vector for each QA for testing
            mock_vector = [(i + 1) * 0.1] * embedding_dim 
            mock_embedding_object.embedding = mock_vector
            mock_embedding_response.data = [mock_embedding_object]
            mock_responses.append(mock_embedding_response)
        
        # Make subsequent calls to create return different responses
        mock_openai_client.embeddings.create.side_effect = mock_responses
        return mock_responses # Return for potential verification

    @patch(MOCK_ACCESS_SECRET_PATH, return_value='test-key')
    @patch(MOCK_OPENAI_CLIENT_PATH)
    def test_generate_user_embedding_success(self, mock_openai_constructor, mock_access_secret):
        """Tests successful weighted embedding generation."""
        # --- Mock Configuration --- 
        mock_openai_client = MagicMock()
        mock_openai_constructor.return_value = mock_openai_client

        # --- Test Data --- 
        user_id = 'user_embed_weighted'
        # Profile with a list of QAs in different sections
        input_profile = {
            'id': user_id,
            'name': 'Weighted User',
            'questions_answers': [
                {'question': 'Q Religion?', 'answer': 'Very important', 'section': 'religious_practice', 'weight': 1.0}, # QA 1
                {'question': 'Q Family?', 'answer': 'Quite important', 'section': 'family_values', 'weight': 0.9}, # QA 2
                {'question': 'Q Hobbies?', 'answer': 'Reading', 'section': 'hobbies'}, # QA 3 (default QA weight 1.0)
                {'question': 'Q Personality?', 'answer': 'Introvert', 'section': 'personality'}, # QA 4
            ]
        }

        # Prepare texts that will be sent to OpenAI and mock responses
        qa_texts_to_embed = [
            f"Q: {qa['question']}\nA: {qa['answer']}" for qa in input_profile['questions_answers']
        ]
        mock_responses = self._mock_openai_embedding(mock_openai_client, qa_texts_to_embed)
        # Expected vectors from mock responses:
        # QA1 (Religion): [0.1, 0.1, 0.1]
        # QA2 (Family):   [0.2, 0.2, 0.2]
        # QA3 (Hobbies):  [0.3, 0.3, 0.3]
        # QA4 (Personality): [0.4, 0.4, 0.4]
        
        # --- Expected Output Calculation --- 
        # 1. Calculate Section Embeddings (Weighted average of QA embeddings in that section)
        # Section: religious_practice
        qa1_emb = np.array([0.1] * EMBEDDING_DIM)
        qa1_weight = 1.0
        sec_religion_weight = DEFAULT_SECTION_WEIGHTS['religious_practice']
        religion_emb = (qa1_emb * qa1_weight * sec_religion_weight) / (qa1_weight * sec_religion_weight)
        
        # Section: family_values
        qa2_emb = np.array([0.2] * EMBEDDING_DIM)
        qa2_weight = 0.9
        sec_family_weight = DEFAULT_SECTION_WEIGHTS['family_values']
        family_emb = (qa2_emb * qa2_weight * sec_family_weight) / (qa2_weight * sec_family_weight)

        # Section: hobbies
        qa3_emb = np.array([0.3] * EMBEDDING_DIM)
        qa3_weight = 1.0 # Default QA weight
        sec_hobbies_weight = DEFAULT_SECTION_WEIGHTS['hobbies']
        hobbies_emb = (qa3_emb * qa3_weight * sec_hobbies_weight) / (qa3_weight * sec_hobbies_weight)

        # Section: personality
        qa4_emb = np.array([0.4] * EMBEDDING_DIM)
        qa4_weight = 1.0 # Default QA weight
        sec_personality_weight = DEFAULT_SECTION_WEIGHTS['personality']
        personality_emb = (qa4_emb * qa4_weight * sec_personality_weight) / (qa4_weight * sec_personality_weight)

        # 2. Calculate Final Embedding (Weighted average of Section Embeddings)
        total_final_weight = sec_religion_weight + sec_family_weight + sec_hobbies_weight + sec_personality_weight
        expected_final_vector_np = (
            (religion_emb * sec_religion_weight) + 
            (family_emb * sec_family_weight) + 
            (hobbies_emb * sec_hobbies_weight) + 
            (personality_emb * sec_personality_weight)
        ) / total_final_weight
        expected_final_vector = expected_final_vector_np.tolist()

        expected_output = [(user_id, expected_final_vector)]

        # --- Pipeline ---
        dofn_instance = GenerateUserEmbedding(project_id='test-proj')
        # Override weights in DoFn instance for testing if needed, or use defaults
        # dofn_instance.section_weights = DEFAULT_SECTION_WEIGHTS 

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_profile])
            output_pcoll = input_pcoll | beam.ParDo(dofn_instance)
            # Use assert_that with a custom checker for float list comparison
            assert_that(output_pcoll, equal_to(expected_output, equals_fn=self.assert_list_almost_equal), label="CheckWeightedEmbeddingSuccess")

        # --- Verification --- 
        mock_access_secret.assert_called_once_with('test-proj', "OPENAI_API_KEY")
        # Check OpenAI calls
        self.assertEqual(mock_openai_client.embeddings.create.call_count, len(qa_texts_to_embed))
        for i, text in enumerate(qa_texts_to_embed):
             call_args, call_kwargs = mock_openai_client.embeddings.create.call_args_list[i]
             self.assertEqual(call_kwargs['model'], EMBEDDING_MODEL)
             self.assertEqual(call_kwargs['input'], text)
             self.assertEqual(call_kwargs['encoding_format'], "float")

    def assert_list_almost_equal(self, list1, list2):
        """Helper function to compare lists of floats with tolerance."""
        if len(list1) != len(list2):
            return False
        return np.allclose(list1, list2, atol=1e-6)

    @patch(MOCK_ACCESS_SECRET_PATH, return_value='test-key')
    @patch(MOCK_OPENAI_CLIENT_PATH)
    def test_generate_embedding_openai_error(self, mock_openai_constructor, mock_access_secret):
        """Tests behavior when OpenAI API call fails for one QA."""
        # --- Mock Configuration ---
        mock_openai_client = MagicMock()
        mock_openai_constructor.return_value = mock_openai_client

        # --- Test Data ---
        user_id = 'user_embed_openai_err'
        input_profile = {
            'id': user_id,
            'name': 'OpenAI Error User',
            'questions_answers': [
                {'question': 'Q1?', 'answer': 'A1', 'section': 's1'}, # Call 1 (Success)
                {'question': 'Q2?', 'answer': 'A2', 'section': 's1'}  # Call 2 (Error)
            ]
        }
        qa_texts_to_embed = [f"Q: {qa['question']}\nA: {qa['answer']}" for qa in input_profile['questions_answers']]

        # Configure mock: Success for first call, Exception for second
        mock_response1 = MagicMock()
        mock_response1.data = [MagicMock()]
        mock_response1.data[0].embedding = [0.1] * EMBEDDING_DIM
        mock_openai_client.embeddings.create.side_effect = [
            mock_response1, 
            Exception("OpenAI API Error")
        ]

        # --- Expected Output ---
        expected_output = [] # Error in DoFn should prevent output

        # --- Pipeline ---
        dofn_instance = GenerateUserEmbedding(project_id='test-proj')
        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_profile])
            output_pcoll = input_pcoll | beam.ParDo(dofn_instance)
            assert_that(output_pcoll, equal_to(expected_output), label="CheckOpenAIErrorHandling")

        # --- Verification ---
        # Verify OpenAI was attempted for both
        self.assertEqual(mock_openai_client.embeddings.create.call_count, 2)

    @patch(MOCK_ACCESS_SECRET_PATH, return_value='test-key')
    @patch(MOCK_OPENAI_CLIENT_PATH)
    def test_generate_embedding_invalid_input_format(self, mock_openai_constructor, mock_access_secret):
        """Tests behavior with various invalid input profile formats."""
        # --- Mock Configuration (Shouldn't be called) ---
        mock_openai_client = MagicMock()
        mock_openai_constructor.return_value = mock_openai_client

        # --- Test Data (List of invalid profiles) ---
        invalid_profiles = [
            {'id': 'user_invalid_1'}, # Missing questions_answers
            {'id': 'user_invalid_2', 'questions_answers': 'not_a_list'}, # questions_answers wrong type
            {'id': 'user_invalid_3', 'questions_answers': ['not_a_dict']}, # QA item wrong type
            {'id': 'user_invalid_4', 'questions_answers': [{'question': 'Q?', 'section': 's1'}]}, # QA item missing answer
        ]

        # --- Expected Output ---
        expected_output = [] # No output for any invalid input

        # --- Pipeline ---
        dofn_instance = GenerateUserEmbedding(project_id='test-proj')
        with TestPipeline() as p:
            input_pcoll = p | beam.Create(invalid_profiles)
            output_pcoll = input_pcoll | beam.ParDo(dofn_instance)
            assert_that(output_pcoll, equal_to(expected_output), label="CheckInvalidInputFormats")

        # --- Verification ---
        mock_openai_client.embeddings.create.assert_not_called()

    @patch(MOCK_ACCESS_SECRET_PATH, return_value='test-key')
    @patch(MOCK_OPENAI_CLIENT_PATH)
    def test_generate_embedding_empty_or_invalid_qas(self, mock_openai_constructor, mock_access_secret):
        """Tests behavior with empty or fully invalid QA lists."""
        # --- Mock Configuration (Shouldn't be called) ---
        mock_openai_client = MagicMock()
        mock_openai_constructor.return_value = mock_openai_client

        # --- Test Data ---
        profiles = [
            {'id': 'user_empty_qa', 'questions_answers': []}, # Empty list
            {'id': 'user_all_invalid_qa', 'questions_answers': [ # List with only invalid items
                {'question': 'Q1?'}, # Missing answer
                {'answer': 'A2'}   # Missing question
            ]}
        ]

        # --- Expected Output ---
        expected_output = []

        # --- Pipeline ---
        dofn_instance = GenerateUserEmbedding(project_id='test-proj')
        with TestPipeline() as p:
            input_pcoll = p | beam.Create(profiles)
            output_pcoll = input_pcoll | beam.ParDo(dofn_instance)
            assert_that(output_pcoll, equal_to(expected_output), label="CheckEmptyOrAllInvalidQAs")

        # --- Verification ---
        mock_openai_client.embeddings.create.assert_not_called()

    @patch(MOCK_ACCESS_SECRET_PATH, return_value='test-key')
    @patch(MOCK_OPENAI_CLIENT_PATH)
    def test_generate_embedding_zero_weight(self, mock_openai_constructor, mock_access_secret):
        """Tests behavior if all section weights lead to zero total weight."""
        # --- Mock Configuration ---
        mock_openai_client = MagicMock()
        mock_openai_constructor.return_value = mock_openai_client

        # --- Test Data ---
        user_id = 'user_embed_zero_weight'
        input_profile = {
            'id': user_id,
            'name': 'Zero Weight User',
            'questions_answers': [
                {'question': 'Q Default?', 'answer': 'A Default', 'section': 'default'} # Single QA
            ]
        }
        qa_texts_to_embed = [f"Q: {qa['question']}\nA: {qa['answer']}" for qa in input_profile['questions_answers']]
        # Mock OpenAI response for the single QA
        self._mock_openai_embedding(mock_openai_client, qa_texts_to_embed)

        # --- Expected Output ---
        expected_output = [] # Should not yield if total weight is zero

        # --- Pipeline ---
        dofn_instance = GenerateUserEmbedding(project_id='test-proj')
        # *** Override section weights in the instance for this test ***
        dofn_instance.section_weights = {"default": 0.0} 

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_profile])
            output_pcoll = input_pcoll | beam.ParDo(dofn_instance)
            assert_that(output_pcoll, equal_to(expected_output), label="CheckZeroTotalWeight")

        # --- Verification ---
        # OpenAI *should* be called for the QA item
        self.assertEqual(mock_openai_client.embeddings.create.call_count, 1)

if __name__ == '__main__':
    unittest.main() 