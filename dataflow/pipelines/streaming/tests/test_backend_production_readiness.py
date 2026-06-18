"""Production-readiness regressions for the Marriage AI backend pipeline.

These tests intentionally avoid cloud dependencies. They verify that the active
backend modules can be imported and that previously observed wiring mistakes do
not regress. They run with stdlib unittest so the repo does not need pytest just
for static/backend contract checks.
"""

from __future__ import annotations

import ast
import importlib
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[4]


def read(relative_path: str) -> str:
    return (REPO_ROOT / relative_path).read_text()


class BackendProductionReadinessTests(unittest.TestCase):
    def test_collection_definitions_import_without_generated_types_package(self):
        definitions = importlib.import_module("dataflow.pipelines.streaming.common.definitions")

        self.assertEqual(definitions.COLLECTIONS["USERS"]["USER_INFO"], "USER_INFO")
        self.assertEqual(definitions.COLLECTIONS["MARRIAGE"]["QAS"], "QAS")
        self.assertEqual(definitions.COLLECTIONS["MARRIAGE"]["QA_EDIT_LOGS"], "QA_EDIT_LOGS")

    def test_streaming_uses_ptransform_wrappers_and_imports_update_lying_score(self):
        source = read("dataflow/pipelines/streaming/streaming.py")
        tree = ast.parse(source)
        imported_names = {
            alias.asname or alias.name
            for node in tree.body
            if isinstance(node, ast.ImportFrom)
            for alias in node.names
        }

        self.assertIn("UpdateLyingScoreDoFn", imported_names)
        self.assertIn("ParseAnswerIntoStatements", imported_names)
        self.assertIn(">> ParseAnswerIntoStatements(", source)
        self.assertNotIn(">> ParseAnswerStatementsDoFn(", source)

    def test_pinecone_store_transform_uses_existing_store_class(self):
        source = read("dataflow/pipelines/streaming/transforms/pinecone_ops.py")

        self.assertIn("class StoreIndividualEmbeddingsDoFn", source)
        self.assertNotIn("StorePineconeEmbeddingDoFn", source)

    def test_lying_score_update_uses_concrete_user_info_collection_path(self):
        source = read("dataflow/pipelines/streaming/transforms/reranking.py")

        self.assertNotIn('collection(COLLECTIONS["USERS"])', source)
        self.assertIn('COLLECTIONS["USERS"]["USER_INFO"]', source)

    def test_ai_score_normalization_handles_0_to_100_and_0_to_1_inputs(self):
        scoring = importlib.import_module("dataflow.pipelines.streaming.transforms.scoring")

        self.assertIsNone(scoring.normalize_ai_score_to_unit(None))
        self.assertEqual(scoring.normalize_ai_score_to_unit(-5), 0.0)
        self.assertEqual(scoring.normalize_ai_score_to_unit(0), 0.0)
        self.assertEqual(scoring.normalize_ai_score_to_unit(0.85), 0.85)
        self.assertEqual(scoring.normalize_ai_score_to_unit(85), 0.85)
        self.assertEqual(scoring.normalize_ai_score_to_unit(100), 1.0)
        self.assertEqual(scoring.normalize_ai_score_to_unit(120), 1.0)

    def test_answer_parser_contract_uses_json_object_with_statements_array(self):
        source = read("dataflow/pipelines/streaming/transforms/answer_parsing.py")

        self.assertIn('"statements"', source)
        self.assertTrue(
            "parsed_payload.get('statements'" in source
            or 'parsed_payload.get("statements"' in source
        )
        self.assertIn("if not isinstance(parsed_statements, list)", source)

    def test_scoreboard_uses_idempotent_match_evidence_not_additive_increment(self):
        source = read("dataflow/pipelines/streaming/transforms/scoreboard.py")

        self.assertNotIn("Increment(", source)
        self.assertIn("stable_match_evidence_id", source)
        self.assertIn("collection('evidence')", source)
        self.assertIn("weighted_score", source)

    def test_scoreboard_scoring_helpers_are_deterministic_and_weighted(self):
        scoring = importlib.import_module("dataflow.pipelines.streaming.transforms.scoring")
        hit = {
            "triggering_user_id": "u1",
            "matched_user_id": "u2",
            "triggering_statement_id": "stmt-a",
            "matched_statement_id": "stmt-b",
            "match_type": "AP",
        }

        self.assertEqual(scoring.calculate_weighted_match_score(0.8, "AP"), 0.8)
        self.assertEqual(scoring.calculate_weighted_match_score(0.8, "PA"), 0.8)
        self.assertEqual(scoring.calculate_weighted_match_score(0.8, "AA"), 0.32000000000000006)
        self.assertIsNone(scoring.calculate_weighted_match_score(0.8, "UNKNOWN"))
        self.assertEqual(
            scoring.stable_match_evidence_id(hit),
            scoring.stable_match_evidence_id(dict(reversed(list(hit.items())))),
        )

    def test_matching_pipeline_deletes_stale_question_vectors_before_embedding(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        pinecone_source = read("dataflow/pipelines/streaming/transforms/pinecone_ops.py")

        self.assertIn("DeleteStaleQuestionVectors", streaming_source)
        self.assertLess(
            streaming_source.index("DeleteStaleQuestionVectors"),
            streaming_source.index("GenerateStatementEmbeddings"),
        )
        self.assertIn("class DeleteStaleQuestionVectorsDoFn", pinecone_source)
        self.assertIn("self.index.delete", pinecone_source)
        self.assertIn("'original_question_id': str(question_id)", pinecone_source)

    def test_firebase_config_points_to_restrictive_firestore_rules(self):
        firebase_config = read("firebase.json")
        rules = read("firestore.rules")

        self.assertIn('"firestore"', firebase_config)
        self.assertIn('"rules": "firestore.rules"', firebase_config)
        self.assertIn("service cloud.firestore", rules)
        self.assertIn("allow read, write: if false", rules)
        self.assertIn("match /QAS/{userId}", rules)
        self.assertIn("match /MATCHES/{userId}", rules)
        self.assertIn("match /MATCH_CANDIDATE_SCOREBOARD/{document=**}", rules)
        self.assertIn("allow write: if false", rules)

    def test_update_user_answers_publishes_matching_event(self):
        source = read("functions-nodejs/src/domains/marriage/index.ts")

        self.assertIn("@google-cloud/pubsub", source)
        self.assertIn("publishMatchingEvent", source)
        self.assertIn("USER_PROFILE_UPDATED_PUBSUB_TOPIC", source)
        self.assertIn("triggering_qa", source)
        self.assertIn("qa_id: params.questionId", source)
        self.assertIn("await publishMatchingEvent", source)


if __name__ == "__main__":
    unittest.main()
