import unittest
import apache_beam as beam
from apache_beam.testing.test_pipeline import TestPipeline
from apache_beam.testing.util import assert_that, equal_to
from unittest.mock import patch, MagicMock

# Adjust import path based on your structure
from apps.marriage_ai.dataflow.pipelines.streaming.transforms.profile_processing import FetchProfileDoFn, ValidateProfileDoFn

# Mock paths for external dependencies
# Target the profile_processing.py module
MOCK_FIRESTORE_PATH = 'apps.marriage_ai.dataflow.pipelines.streaming.transforms.profile_processing.firestore.Client'


class TestFetchProfileDoFn(unittest.TestCase):

    @patch(MOCK_FIRESTORE_PATH)
    def test_fetch_profile_success(self, mock_firestore_constructor):
        """Tests successful fetching of a profile from Firestore."""
        # --- Mock Firestore --- 
        mock_firestore_client = MagicMock()
        mock_firestore_constructor.return_value = mock_firestore_client
        mock_doc_ref = MagicMock()
        mock_doc = MagicMock()
        
        user_id = "user_exists"
        expected_profile_data = {'name': 'Test User', 'isVerified': True, 'isWaliVerified': True}

        mock_doc.exists = True
        mock_doc.to_dict.return_value = expected_profile_data
        mock_doc_ref.get.return_value = mock_doc
        mock_firestore_client.collection.return_value.document.return_value = mock_doc_ref
        
        project_id = "test-proj"
        collection = "USERS_test"

        # --- Expected Output --- 
        # Profile dict with 'id' added
        expected_output = [dict(expected_profile_data, id=user_id)]

        # --- Pipeline ---
        dofn_instance = FetchProfileDoFn(project_id=project_id, collection_name=collection)
        with TestPipeline() as p:
            input_pcoll = p | beam.Create([user_id])
            output_pcoll = input_pcoll | beam.ParDo(dofn_instance)
            assert_that(output_pcoll, equal_to(expected_output), label="CheckFetchSuccess")

        # --- Verification --- 
        mock_firestore_constructor.assert_called_once_with(project=project_id)
        mock_firestore_client.collection.assert_called_once_with(collection)
        mock_firestore_client.collection(collection).document.assert_called_once_with(user_id)
        mock_doc_ref.get.assert_called_once()

    @patch(MOCK_FIRESTORE_PATH)
    def test_fetch_profile_not_found(self, mock_firestore_constructor):
        """Tests behavior when the profile document is not found."""
        # --- Mock Firestore --- 
        mock_firestore_client = MagicMock()
        mock_firestore_constructor.return_value = mock_firestore_client
        mock_doc_ref = MagicMock()
        mock_doc = MagicMock()
        
        user_id = "user_not_found"
        mock_doc.exists = False # Simulate not found
        mock_doc_ref.get.return_value = mock_doc
        mock_firestore_client.collection.return_value.document.return_value = mock_doc_ref
        
        project_id = "test-proj"
        collection = "USERS_test"

        # --- Expected Output --- 
        expected_output = [] # No output if not found

        # --- Pipeline ---
        dofn_instance = FetchProfileDoFn(project_id=project_id, collection_name=collection)
        with TestPipeline() as p:
            input_pcoll = p | beam.Create([user_id])
            output_pcoll = input_pcoll | beam.ParDo(dofn_instance)
            assert_that(output_pcoll, equal_to(expected_output), label="CheckFetchNotFound")

        # --- Verification --- 
        mock_doc_ref.get.assert_called_once()

    @patch(MOCK_FIRESTORE_PATH)
    def test_fetch_profile_firestore_error(self, mock_firestore_constructor):
        """Tests behavior when Firestore client raises an error during fetch."""
        # --- Mock Firestore --- 
        mock_firestore_client = MagicMock()
        mock_firestore_constructor.return_value = mock_firestore_client
        mock_doc_ref = MagicMock()
        # Simulate error on .get()
        mock_doc_ref.get.side_effect = Exception("Firestore connection error")
        mock_firestore_client.collection.return_value.document.return_value = mock_doc_ref
        
        user_id = "user_fetch_error"
        project_id = "test-proj"
        collection = "USERS_test"

        # --- Expected Output --- 
        expected_output = [] # Error should prevent output

        # --- Pipeline ---
        dofn_instance = FetchProfileDoFn(project_id=project_id, collection_name=collection)
        with TestPipeline() as p:
            input_pcoll = p | beam.Create([user_id])
            output_pcoll = input_pcoll | beam.ParDo(dofn_instance)
            assert_that(output_pcoll, equal_to(expected_output), label="CheckFetchError")

        # --- Verification --- 
        mock_doc_ref.get.assert_called_once() # Verify .get() was attempted

    def test_fetch_profile_test_mode(self):
        """Tests fetching in test mode (should not call Firestore)."""
        user_id = "user_test_mode"
        project_id = "test-proj"
        collection = "USERS_test"

        # --- Expected Output (from hardcoded test data in DoFn) --- 
        expected_profile_data = {
            'id': user_id,
            'isVerified': True,
            'isWaliVerified': True,
            'questions_answers': [
                {
                    'question': 'What are your hobbies?',
                    'answer': 'I enjoy reading, hiking, and programming.'
                },
                {
                    'question': 'What are you looking for in a spouse?',
                    'answer': 'Someone who is kind, religious, and family-oriented.'
                }
            ]
        }
        expected_output = [expected_profile_data]

        # --- Pipeline ---
        # is_test=True should prevent Firestore initialization/calls
        dofn_instance = FetchProfileDoFn(project_id=project_id, collection_name=collection, is_test=True)
        with TestPipeline() as p:
            input_pcoll = p | beam.Create([user_id])
            output_pcoll = input_pcoll | beam.ParDo(dofn_instance)
            assert_that(output_pcoll, equal_to(expected_output), label="CheckFetchTestMode")

        # --- Verification --- 
        # No Firestore interaction expected in test mode
        # We don't need @patch here, as Firestore client shouldn't be constructed


# TODO: Add tests for ValidateProfileDoFn

class TestValidateProfileDoFn(unittest.TestCase):

    def test_validation_success(self):
        """Tests a profile that should pass validation."""
        input_profile = {
            'id': 'user_valid',
            'name': 'Valid User',
            'isVerified': True,
            'isWaliVerified': True,
            'other_field': 'data'
        }

        expected_output = [input_profile] # Expect the profile to be yielded

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_profile])
            output_pcoll = input_pcoll | beam.ParDo(ValidateProfileDoFn())
            assert_that(output_pcoll, equal_to(expected_output), label="CheckValidationSuccess")

    def test_validation_failure_user_not_verified(self):
        """Tests a profile that fails validation (user not verified)."""
        input_profile = {
            'id': 'user_invalid_user',
            'name': 'Invalid User',
            'isVerified': False, # Fails here
            'isWaliVerified': True
        }

        expected_output = [] # Expect no output

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_profile])
            output_pcoll = input_pcoll | beam.ParDo(ValidateProfileDoFn())
            assert_that(output_pcoll, equal_to(expected_output), label="CheckValidationFailUser")

    def test_validation_failure_wali_not_verified(self):
        """Tests a profile that fails validation (wali not verified)."""
        input_profile = {
            'id': 'user_invalid_wali',
            'name': 'Invalid Wali',
            'isVerified': True,
            'isWaliVerified': False # Fails here
        }

        expected_output = [] # Expect no output

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_profile])
            output_pcoll = input_pcoll | beam.ParDo(ValidateProfileDoFn())
            assert_that(output_pcoll, equal_to(expected_output), label="CheckValidationFailWali")

    def test_validation_missing_fields(self):
        """Tests profiles missing one or both validation fields."""
        profiles_to_test = [
            {'id': 'user_missing_user', 'isWaliVerified': True}, # Missing isVerified (defaults False)
            {'id': 'user_missing_wali', 'isVerified': True}, # Missing isWaliVerified (defaults False)
            {'id': 'user_missing_both'} # Missing both
        ]

        expected_output = [] # Expect no output for any of these

        with TestPipeline() as p:
            input_pcoll = p | beam.Create(profiles_to_test)
            output_pcoll = input_pcoll | beam.ParDo(ValidateProfileDoFn())
            assert_that(output_pcoll, equal_to(expected_output), label="CheckValidationMissingFields")


if __name__ == '__main__':
    unittest.main() 