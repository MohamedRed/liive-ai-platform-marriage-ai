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


if __name__ == "__main__":
    unittest.main()
