import unittest
import apache_beam as beam
from apache_beam.testing.util import assert_that, equal_to

# Adjust the import path based on your project structure
from apps.marriage_ai.dataflow.pipelines.streaming.transforms.reranking import RerankMatchesDoFn

class TestRerankMatchesDoFn(unittest.TestCase):

    def test_rerank_matches_basic(self):
        # Sample input: (user_id, {'scores': [score_data], 'matches': [pinecone_matches]})
        # score_data typically includes {'aggregated_score': float, 'per_qa_scores': dict}
        # pinecone_matches is a list of dictionaries, e.g., [{'id': 'match1', 'score': 0.9, ...}, ...]
        test_user_id = "user123"
        input_data = [
            (test_user_id, {
                'scores': [{'aggregated_score': 0.75, 'per_qa_scores': {}}],
                'matches': [
                    {'id': 'profileA', 'score': 0.9, 'metadata': {'name': 'Alice'}},
                    {'id': 'profileB', 'score': 0.8, 'metadata': {'name': 'Bob'}},
                ]
            })
        ]

        # Expected output format: (user_id, reranked_match_dict)
        # Assumed reranking logic: reranked_score = aggregated_score * original_match_score
        expected_output = [
            (test_user_id, {'id': 'profileA', 'score': 0.9, 'metadata': {'name': 'Alice'}, 'reranked_score': 0.75 * 0.9}),
            (test_user_id, {'id': 'profileB', 'score': 0.8, 'metadata': {'name': 'Bob'}, 'reranked_score': 0.75 * 0.8})
        ]

        with beam.Pipeline() as pipeline:
            results = (
                pipeline
                | "CreateInput" >> beam.Create(input_data)
                | "Rerank" >> beam.ParDo(RerankMatchesDoFn())
                # We might need a step here to extract just the matches if RerankMatchesDoFn yields (user_id, match)
                # | "ExtractMatch" >> beam.Map(lambda x: x[1]) # Example if yielding tuples
            )

            assert_that(
                results,
                equal_to(expected_output),
                label="CheckRerankedMatches"
            )

if __name__ == '__main__':
    unittest.main() 