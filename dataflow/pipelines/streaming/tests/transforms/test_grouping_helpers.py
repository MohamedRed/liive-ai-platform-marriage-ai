# apps/marriage-ai/dataflow/pipelines/streaming/tests/transforms/test_grouping_helpers.py
import unittest
import apache_beam as beam
from apache_beam.testing.test_pipeline import TestPipeline
from apache_beam.testing.util import assert_that, equal_to
from unittest.mock import patch, MagicMock # Import mock

# Import the DoFn to test
from ....transforms.grouping_helpers import (
    AggregateScoresDoFn,
    ProcessJoinedDataDoFn,
    ExtractQAsForScoringDoFn,
    UpdateAllScoresDoFn # Add this import
)

class AggregateScoresDoFnTest(unittest.TestCase):

    def test_aggregate_scores_average(self):
        """Tests score aggregation using the default 'average' method."""
        user_id = "user1"
        input_scores = [
            {'qa_id': 'q1', 'lying_score': 0.1},
            {'qa_id': 'q2', 'lying_score': 0.3},
            {'qa_id': 'q3', 'lying_score': 0.5},
        ]
        input_element = (user_id, input_scores)

        expected_output = [
            (user_id, {'scores': {'q1': 0.1, 'q2': 0.3, 'q3': 0.5}, 'aggregate': 0.3})
        ]

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_element])
            output_pcoll = input_pcoll | beam.ParDo(AggregateScoresDoFn(aggregation_method='average'))

            assert_that(output_pcoll, equal_to(expected_output), label="CheckAverageAggregation")

    def test_aggregate_scores_max(self):
        """Tests score aggregation using the 'max' method."""
        user_id = "user2"
        input_scores = [
            {'qa_id': 'q1', 'lying_score': 0.1},
            {'qa_id': 'q2', 'lying_score': 0.8},
            {'qa_id': 'q3', 'lying_score': 0.5},
        ]
        input_element = (user_id, input_scores)

        expected_output = [
            (user_id, {'scores': {'q1': 0.1, 'q2': 0.8, 'q3': 0.5}, 'aggregate': 0.8}) # Expect max score
        ]

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_element])
            # Instantiate DoFn with 'max' method
            output_pcoll = input_pcoll | beam.ParDo(AggregateScoresDoFn(aggregation_method='max'))

            assert_that(output_pcoll, equal_to(expected_output), label="CheckMaxAggregation")

    def test_aggregate_scores_empty_input(self):
        """Tests behavior when the input iterable for a user is empty."""
        user_id = "user3"
        input_element = (user_id, []) # Empty list of scores

        # Expect default output (empty scores dict, aggregate 0.0)
        expected_output = [
            (user_id, {'scores': {}, 'aggregate': 0.0})
        ]

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_element])
            output_pcoll = input_pcoll | beam.ParDo(AggregateScoresDoFn())

            assert_that(output_pcoll, equal_to(expected_output), label="CheckEmptyInput")

    def test_aggregate_scores_invalid_items(self):
        """Tests behavior with invalid items mixed in the input iterable."""
        user_id = "user4"
        input_scores = [
            {'qa_id': 'q1', 'lying_score': 0.2},
            None, # Invalid item
            {'qa_id': 'q3'}, # Missing score
            {'lying_score': 0.6}, # Missing qa_id
            {'qa_id': 'q4', 'lying_score': 0.4},
            "not a dict" # Invalid item
        ]
        input_element = (user_id, input_scores)

        # Expect only valid items to be aggregated (q1 and q4 -> avg 0.3)
        expected_output = [
            (user_id, {'scores': {'q1': 0.2, 'q4': 0.4}, 'aggregate': 0.3})
        ]

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_element])
            output_pcoll = input_pcoll | beam.ParDo(AggregateScoresDoFn())

            assert_that(output_pcoll, equal_to(expected_output), label="CheckInvalidItems")

    def test_aggregate_scores_single_item(self):
        """Tests aggregation with only one score item."""
        user_id = "user5"
        input_scores = [
            {'qa_id': 'q_single', 'lying_score': 0.75},
        ]
        input_element = (user_id, input_scores)

        expected_output = [
            (user_id, {'scores': {'q_single': 0.75}, 'aggregate': 0.75})
        ]

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_element])
            output_pcoll = input_pcoll | beam.ParDo(AggregateScoresDoFn())

            assert_that(output_pcoll, equal_to(expected_output), label="CheckSingleItem")

# --- Tests for ProcessJoinedDataDoFn --- #

class TestProcessJoinedDataDoFn(unittest.TestCase):
    SCORES_TAG = 'scores_tag'
    MATCHES_TAG = 'matches_tag'

    def test_process_joined_basic(self):
        """Tests processing with standard single score and match entries."""
        user_id = "user1"
        score_data = {'scores': {'q1': 0.5}, 'aggregate': 0.5}
        match_list = [{'id': 'matchA', 'score': 0.9}]
        input_element = (user_id, {
            self.SCORES_TAG: [score_data],
            self.MATCHES_TAG: [{'matches': match_list}] # Matches are nested in a dict
        })

        expected_output = [{
            'user_id': user_id,
            'scores': score_data,
            'matches': match_list
        }]

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_element])
            output_pcoll = input_pcoll | beam.ParDo(ProcessJoinedDataDoFn())
            assert_that(output_pcoll, equal_to(expected_output), label="CheckBasicJoin")

    def test_process_joined_no_matches(self):
        """Tests processing when the matches list is empty."""
        user_id = "user2"
        score_data = {'scores': {'q2': 0.7}, 'aggregate': 0.7}
        input_element = (user_id, {
            self.SCORES_TAG: [score_data],
            self.MATCHES_TAG: [] # Empty matches list
        })

        expected_output = [{
            'user_id': user_id,
            'scores': score_data,
            'matches': [] # Expect empty matches list
        }]

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_element])
            output_pcoll = input_pcoll | beam.ParDo(ProcessJoinedDataDoFn())
            assert_that(output_pcoll, equal_to(expected_output), label="CheckNoMatchesJoin")

    def test_process_joined_no_scores(self):
        """Tests processing when the scores list is empty."""
        user_id = "user3"
        match_list = [{'id': 'matchB', 'score': 0.8}]
        input_element = (user_id, {
            self.SCORES_TAG: [], # Empty scores list
            self.MATCHES_TAG: [{'matches': match_list}]
        })

        # Expect default score data
        expected_score_data = {'scores': {}, 'aggregate': 0.0}
        expected_output = [{
            'user_id': user_id,
            'scores': expected_score_data,
            'matches': match_list
        }]

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_element])
            output_pcoll = input_pcoll | beam.ParDo(ProcessJoinedDataDoFn())
            assert_that(output_pcoll, equal_to(expected_output), label="CheckNoScoresJoin")

    def test_process_joined_multiple_entries(self):
        """Tests processing with unexpected multiple score/match entries (takes first)."""
        user_id = "user4"
        score_data1 = {'scores': {'q1': 0.5}, 'aggregate': 0.5}
        score_data2 = {'scores': {'q2': 0.9}, 'aggregate': 0.9}
        match_list1 = [{'id': 'matchA', 'score': 0.9}]
        match_list2 = [{'id': 'matchC', 'score': 0.7}]

        input_element = (user_id, {
            self.SCORES_TAG: [score_data1, score_data2], # Multiple scores
            self.MATCHES_TAG: [{'matches': match_list1}, {'matches': match_list2}] # Multiple matches
        })

        # Expect the first score entry and the first match list
        expected_output = [{
            'user_id': user_id,
            'scores': score_data1,
            'matches': match_list1
        }]

        # Note: This test assumes the DoFn logs errors/warnings but proceeds
        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_element])
            output_pcoll = input_pcoll | beam.ParDo(ProcessJoinedDataDoFn())
            assert_that(output_pcoll, equal_to(expected_output), label="CheckMultipleEntriesJoin")


# --- Tests for ExtractQAsForScoringDoFn --- #

class TestExtractQAsForScoringDoFn(unittest.TestCase):

    def test_extract_valid_qas(self):
        """Tests extraction from a profile with valid Q&A entries."""
        profile = {
            'id': 'user10',
            'name': 'Alice',
            'questions_answers': {
                'q1': {'question': 'Q1 Text?', 'answer': 'A1 Text'},
                'q2': {'question': 'Q2 Text?', 'answer': 'A2 Text'}
            }
        }

        expected_output = [
            {'profile_id': 'user10', 'qa_id': 'q1', 'qa_data': {'question': 'Q1 Text?', 'answer': 'A1 Text'}},
            {'profile_id': 'user10', 'qa_id': 'q2', 'qa_data': {'question': 'Q2 Text?', 'answer': 'A2 Text'}}
        ]

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([profile])
            output_pcoll = input_pcoll | beam.ParDo(ExtractQAsForScoringDoFn())
            # Using contains_in_any_order because dict key order isn't guaranteed
            assert_that(output_pcoll, equal_to(expected_output, equals_fn=lambda x, y: sorted(x) == sorted(y)), label="CheckValidQAs")

    def test_extract_no_qa_field(self):
        """Tests extraction from a profile missing the questions_answers field."""
        profile = {
            'id': 'user11',
            'name': 'Bob'
            # Missing questions_answers
        }

        expected_output = [] # Expect no output

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([profile])
            output_pcoll = input_pcoll | beam.ParDo(ExtractQAsForScoringDoFn())
            assert_that(output_pcoll, equal_to(expected_output), label="CheckNoQAField")

    def test_extract_empty_qa_dict(self):
        """Tests extraction from a profile with an empty questions_answers dict."""
        profile = {
            'id': 'user12',
            'name': 'Charlie',
            'questions_answers': {}
        }

        expected_output = [] # Expect no output

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([profile])
            output_pcoll = input_pcoll | beam.ParDo(ExtractQAsForScoringDoFn())
            assert_that(output_pcoll, equal_to(expected_output), label="CheckEmptyQADict")

    def test_extract_mixed_validity_qas(self):
        """Tests extraction with a mix of valid and malformed Q&A entries."""
        profile = {
            'id': 'user13',
            'name': 'David',
            'questions_answers': {
                'q1': {'question': 'Q1 Text?', 'answer': 'A1 Text'}, # Valid
                'q2': {'question': 'Q2 Text?'}, # Missing answer
                'q3': 'not a dict', # Invalid type
                'q4': {'answer': 'A4 Text'}, # Missing question
                'q5': {'question': 'Q5 Text?', 'answer': 'A5 Text'} # Valid
            }
        }

        expected_output = [
            {'profile_id': 'user13', 'qa_id': 'q1', 'qa_data': {'question': 'Q1 Text?', 'answer': 'A1 Text'}},
            {'profile_id': 'user13', 'qa_id': 'q5', 'qa_data': {'question': 'Q5 Text?', 'answer': 'A5 Text'}}
        ]

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([profile])
            output_pcoll = input_pcoll | beam.ParDo(ExtractQAsForScoringDoFn())
            # Using contains_in_any_order again
            assert_that(output_pcoll, equal_to(expected_output, equals_fn=lambda x, y: sorted(x) == sorted(y)), label="CheckMixedValidityQAs")

    def test_extract_missing_profile_id(self):
        """Tests extraction from a profile missing the id field."""
        profile = {
            # Missing id
            'name': 'Eve',
            'questions_answers': {
                'q1': {'question': 'Q1 Text?', 'answer': 'A1 Text'}
            }
        }

        expected_output = [] # Expect no main output

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([profile])
            # Test the main output; error output testing is more complex
            main_output, error_output = (
                input_pcoll
                | beam.ParDo(ExtractQAsForScoringDoFn()).with_outputs(ExtractQAsForScoringDoFn.OUTPUT_ERROR_TAG, main='main')
            )
            assert_that(main_output, equal_to(expected_output), label="CheckMissingIdMainOutput")
            # Optionally, assert on error_output if needed
            # assert_that(error_output, ...) # Needs specific error format check

# --- Tests for UpdateAllScoresDoFn --- #

# Mock the Firestore client import path based on where it's imported in the DoFn
# Assuming it's imported inside setup: 'google.cloud.firestore'
@patch('apps.marriage_ai.dataflow.pipelines.streaming.transforms.grouping_helpers.firestore.Client')
class TestUpdateAllScoresDoFn(unittest.TestCase):

    def test_update_all_scores_success(self, mock_firestore_client):
        """Tests successful update with aggregate and per-QA scores."""
        # Configure the mock
        mock_db = MagicMock()
        mock_firestore_client.return_value = mock_db
        mock_batch = MagicMock()
        mock_db.batch.return_value = mock_batch
        mock_profile_ref = MagicMock()
        mock_db.collection.return_value.document.return_value = mock_profile_ref

        project_id = "test-project"
        collection = "USERS_test"
        user_id = "user20"
        input_element = (user_id, {
            'scores': {'q1': 0.8, 'q2': 0.6},
            'aggregate': 0.7
        })

        expected_updates = {
            'aggregateLyingScore': 0.7,
            'questions_answers.q1.aiLyingScore': 0.8,
            'questions_answers.q2.aiLyingScore': 0.6
        }

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_element])
            _ = input_pcoll | beam.ParDo(UpdateAllScoresDoFn(project_id=project_id, profiles_collection=collection))

        # Verify Firestore interactions
        mock_firestore_client.assert_called_once_with(project=project_id)
        mock_db.collection.assert_called_once_with(collection)
        mock_db.collection.return_value.document.assert_called_once_with(user_id)
        mock_db.batch.assert_called_once()
        mock_batch.update.assert_called_once_with(mock_profile_ref, expected_updates)
        mock_batch.commit.assert_called_once()

    def test_update_no_scores(self, mock_firestore_client):
        """Tests behavior when there are no scores to update."""
        mock_db = MagicMock()
        mock_firestore_client.return_value = mock_db
        mock_batch = MagicMock()
        mock_db.batch.return_value = mock_batch
        mock_profile_ref = MagicMock()
        mock_db.collection.return_value.document.return_value = mock_profile_ref

        project_id = "test-project"
        collection = "USERS_test"
        user_id = "user21"
        input_element = (user_id, {
            'scores': {},
            'aggregate': None # Or omitted
        })

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_element])
            _ = input_pcoll | beam.ParDo(UpdateAllScoresDoFn(project_id=project_id, profiles_collection=collection))

        # Verify Firestore interactions - commit should NOT be called
        mock_firestore_client.assert_called_once_with(project=project_id)
        mock_db.collection.assert_called_once_with(collection)
        mock_db.collection.return_value.document.assert_called_once_with(user_id)
        mock_db.batch.assert_called_once() # Batch might still be created
        mock_batch.update.assert_not_called()
        mock_batch.commit.assert_not_called()

    def test_update_invalid_input(self, mock_firestore_client):
        """Tests behavior with invalid input format (e.g., missing user_id)."""
        mock_db = MagicMock()
        mock_firestore_client.return_value = mock_db
        mock_batch = MagicMock()
        mock_db.batch.return_value = mock_batch

        project_id = "test-project"
        collection = "USERS_test"
        input_element = (None, {'scores': {}, 'aggregate': 0.5}) # Invalid user_id

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([input_element])
            # Capture error output if needed, or just ensure no commit
            main_output, error_output = (
                input_pcoll
                | beam.ParDo(UpdateAllScoresDoFn(project_id=project_id, profiles_collection=collection))
                  .with_outputs(UpdateAllScoresDoFn.OUTPUT_ERROR_TAG, main='main')
            )
            # Minimal check: Ensure no commit happened
            assert_that(main_output, equal_to([]), label="CheckMainOutputEmpty")

        mock_firestore_client.assert_called_once_with(project=project_id)
        mock_db.collection.assert_not_called()
        mock_db.batch.assert_not_called()
        mock_batch.update.assert_not_called()
        mock_batch.commit.assert_not_called()


if __name__ == '__main__':
    unittest.main() 