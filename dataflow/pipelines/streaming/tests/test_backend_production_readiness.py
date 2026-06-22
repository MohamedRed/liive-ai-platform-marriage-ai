"""Production-readiness regressions for the Marriage AI backend pipeline.

These tests intentionally avoid cloud dependencies. They verify that the active
backend modules can be imported and that previously observed wiring mistakes do
not regress. They run with stdlib unittest so the repo does not need pytest just
for static/backend contract checks.
"""

from __future__ import annotations

import ast
import importlib
import json
import sys
import tempfile
import types
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

    def test_root_frontend_uses_local_database_types_package(self):
        package_json = json.loads(read("package.json"))

        self.assertEqual(
            package_json["dependencies"].get("@livve-1/database-types"),
            "file:./packages/database-types",
        )
        self.assertNotIn("@nanostores/react", package_json["dependencies"])
        self.assertFalse((REPO_ROOT / "package-lock.json").exists())

    def test_root_typescript_config_targets_local_sources_only(self):
        tsconfig = json.loads(read("tsconfig.json"))
        paths = tsconfig["compilerOptions"].get("paths", {})
        excludes = set(tsconfig.get("exclude", []))

        self.assertEqual(paths.get("@livve-1/database-types"), ["./packages/database-types/src"])
        self.assertEqual(paths.get("@liive-marriage-ai/database-types"), ["./packages/database-types/src"])
        self.assertIn("src/**/*.test.ts", excludes)
        self.assertIn("src/**/*.test.tsx", excludes)
        self.assertIn("src/**/__tests__/**", excludes)

    def test_firebase_phone_auth_helper_uses_modular_verifier_contract(self):
        source = read("src/auth/context/firebase/action.ts")

        self.assertIn("ApplicationVerifier", source)
        self.assertIn("PhoneAuthProvider", source)
        self.assertIn("appVerifier: ApplicationVerifier", source)
        self.assertIn("_signInWithPhoneNumber(auth, phoneNumber, appVerifier)", source)
        self.assertIn("PhoneAuthProvider.credential(verificationId, verificationCode)", source)
        self.assertNotIn("auth.PhoneAuthProvider", source)
        self.assertNotIn("const userCredential =", source)

    def test_python_livekit_callable_requires_auth_and_only_reads_livekit_secrets(self):
        source = read("functions-python/main.py")

        self.assertIn("if req.auth is None:", source)
        self.assertIn("https_fn.HttpsError", source)
        self.assertIn("FunctionsErrorCode.UNAUTHENTICATED", source)
        self.assertLess(source.index("if req.auth is None:"), source.index("uid = req.auth.uid"))
        self.assertIn("LIVEKIT_API_KEY", source)
        self.assertIn("LIVEKIT_API_SECRET", source)
        self.assertIn("LIVEKIT_WEBSOCKET_URL", source)
        self.assertNotIn("OPENAI_API_KEY", source)
        self.assertNotIn("openai_api_key", source)

    def test_root_toast_hook_has_self_contained_build_types(self):
        source = read("src/hooks/use-toast.ts")

        self.assertNotIn("src/components/ui/toast", source)
        self.assertIn("type ToastActionElement = React.ReactElement", source)
        self.assertIn("onOpenChange?: (open: boolean) => void", source)
        self.assertIn("onOpenChange: (open: boolean) =>", source)

    def test_phone_number_verification_has_typed_window_and_error_guards(self):
        source = read("src/sections/assistant/phone-number-verification.tsx")

        self.assertIn("interface Window", source)
        self.assertIn("recaptchaVerifier?: RecaptchaVerifier", source)
        self.assertIn("function getAuthErrorCode(error: unknown): string | undefined", source)
        self.assertIn("getAuthErrorCode(error)", source)
        self.assertIn("if (!confirmationResult)", source)
        self.assertNotIn("error?.code", source)
        self.assertNotIn("console.log(\"Logged in user:\", userCredential.user)", source)
        self.assertIn('<Field.Code name="code" />', source)
        self.assertNotIn('<Field.Code name="code" label=', source)

    def test_hook_form_autocomplete_wrappers_avoid_controller_props_and_unused_events(self):
        country_source = read("src/components/hook-form/rhf-country-select.tsx")
        autocomplete_source = read("src/components/hook-form/rhf-autocomplete.tsx")

        self.assertNotIn("<Controller\n      sx=", country_source)
        self.assertIn("onChange={(_event, newValue)", country_source)
        self.assertIn("onChange={(_event, newValue)", autocomplete_source)
        self.assertNotIn("onChange={(event, newValue)", country_source)
        self.assertNotIn("onChange={(event, newValue)", autocomplete_source)

    def test_strict_ui_callbacks_mark_intentionally_unused_events(self):
        rating_source = read("src/components/hook-form/rhf-rating.tsx")
        table_source = read("src/components/table/use-table.ts")

        self.assertIn("onChange={(_event, newValue)", rating_source)
        self.assertIn("onChangePage = useCallback((_event: unknown, newPage: number)", table_source)
        self.assertNotIn("onChange={(event, newValue)", rating_source)
        self.assertNotIn("onChangePage = useCallback((event: unknown, newPage: number)", table_source)

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

    def test_streaming_graph_has_no_known_composite_transform_wiring_blockers(self):
        source = read("dataflow/pipelines/streaming/streaming.py")

        self.assertNotIn("RerankMatchesDoFn.OUTPUT_ERROR_TAG", source)
        self.assertNotIn("RerankAndScoreMatches(\n                project_id=known_args.project,\n                profiles_collection=user_info_collection, \n                pdf_bucket=known_args.pdf_bucket,\n                pdf_instructions_path=known_args.pdf_instructions_path\n            ).with_outputs", source)
        self.assertNotIn(".with_outputs(ProcessAndValidateProfile", source)
        self.assertNotIn("layer4_candidates_tagged[Layer4CandidateDoFn.OUTPUT_CANDIDATES_TAG]", source)
        self.assertNotIn(".with_outputs(WriteMatchesToFirestore", source)
        self.assertNotIn(".with_outputs(ScheduleDelayedMatching", source)
        self.assertNotIn(".with_outputs(HandleMatchActions", source)

    def test_lying_score_input_format_errors_are_tagged_not_lambda_failures(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        formatter_path = REPO_ROOT / "dataflow/pipelines/streaming/transforms/lying_score_input.py"
        self.assertTrue(formatter_path.exists(), "lying score input formatter transform must exist")
        formatter_source = formatter_path.read_text()

        self.assertIn("class FormatForLyingScoreDoFn", formatter_source)
        self.assertIn("FormatForLyingScoreDoFn.OUTPUT_ERROR_TAG", formatter_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", formatter_source)
        self.assertIn('"operation": "format_for_lying_score"', formatter_source)
        self.assertIn('"Missing fields for lying score input"', formatter_source)
        self.assertIn('"profile_id": user_id', formatter_source)
        self.assertIn('"qa_id": question_id', formatter_source)
        self.assertIn("FormatForLyingScore", streaming_source)
        self.assertIn("lying_score_input_results.error | \"DLQ_LyingScoreInputErrors\" >> dlq_sink(\"LyingScoreInputErrors\")", streaming_source)
        self.assertIn("lying_score_input = lying_score_input_results.main", streaming_source)
        self.assertNotIn("| \"FormatForLyingScore\" >> beam.Map(\n                lambda x:", streaming_source)

    def test_streaming_lying_score_errors_are_tagged_and_written_to_dlq(self):
        source = read("dataflow/pipelines/streaming/streaming.py")
        reranking_source = read("dataflow/pipelines/streaming/transforms/reranking.py")

        reranking_tree = ast.parse(reranking_source)
        class_error_tags = {
            node.name: any(
                isinstance(stmt, ast.Assign)
                and any(isinstance(target, ast.Name) and target.id == "OUTPUT_ERROR_TAG" for target in stmt.targets)
                for stmt in node.body
            )
            for node in reranking_tree.body
            if isinstance(node, ast.ClassDef)
        }

        self.assertTrue(class_error_tags.get("CalculateLyingScoreDoFn"))
        self.assertTrue(class_error_tags.get("UpdateLyingScoreDoFn"))
        self.assertIn("calculated_lying_scores_results =", source)
        self.assertIn(".with_outputs(CalculateLyingScoreDoFn.OUTPUT_ERROR_TAG, main='main')", source)
        self.assertIn("lying_score_errors | \"DLQ_LyingScoreErrors\" >> dlq_sink(\"LyingScoreErrors\")", source)
        self.assertIn("calculated_lying_scores = calculated_lying_scores_results.main", source)
        self.assertIn("update_lying_score_results =", source)
        self.assertIn(".with_outputs(UpdateLyingScoreDoFn.OUTPUT_ERROR_TAG, main='main')", source)
        self.assertIn("update_lying_score_errors | \"DLQ_UpdateLyingScoreErrors\" >> dlq_sink(\"UpdateLyingScoreErrors\")", source)
        self.assertNotIn("raise # Propagate error for DLQ", reranking_source)

    def test_streaming_pinecone_embedding_store_errors_are_tagged_and_written_to_dlq(self):
        source = read("dataflow/pipelines/streaming/streaming.py")
        pinecone_source = read("dataflow/pipelines/streaming/transforms/pinecone_ops.py")
        pinecone_tree = ast.parse(pinecone_source)
        class_error_tags = {
            node.name: any(
                isinstance(stmt, ast.Assign)
                and any(isinstance(target, ast.Name) and target.id == "OUTPUT_ERROR_TAG" for target in stmt.targets)
                for stmt in node.body
            )
            for node in pinecone_tree.body
            if isinstance(node, ast.ClassDef)
        }

        self.assertTrue(class_error_tags.get("StoreIndividualEmbeddingsDoFn"))
        self.assertIn("StoreIndividualEmbeddingsDoFn.OUTPUT_ERROR_TAG", pinecone_source)
        self.assertIn(").with_outputs(StoreIndividualEmbeddingsDoFn.OUTPUT_ERROR_TAG, main='main')", pinecone_source)
        self.assertIn("store_statement_embeddings_results =", source)
        self.assertIn("store_statement_embeddings_results.error | \"DLQ_StoreStatementEmbeddingsErrors\" >> dlq_sink(\"StoreStatementEmbeddingsErrors\")", source)
        self.assertNotIn("raise\n        finally:\n            self.batch = []", pinecone_source)

    def test_active_pinecone_setup_failures_are_tagged_not_raised(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        pinecone_source = read("dataflow/pipelines/streaming/transforms/pinecone_ops.py")

        for class_name in (
            "DeleteStaleQuestionVectorsDoFn",
            "StoreIndividualEmbeddingsDoFn",
            "QueryPinecone",
        ):
            self.assertIn(f"{class_name}.OUTPUT_ERROR_TAG", pinecone_source)

        self.assertIn("setup_error_message", pinecone_source)
        self.assertIn("DeleteStaleQuestionVectorsDoFn setup failed", pinecone_source)
        self.assertIn("StoreIndividualEmbeddingsDoFn setup failed", pinecone_source)
        self.assertIn("QueryPinecone setup failed", pinecone_source)
        self.assertIn('"error_message": self.setup_error_message or "DeleteStaleQuestionVectorsDoFn setup failed"', pinecone_source)
        self.assertIn('"error_message": self.setup_error_message or "StoreIndividualEmbeddingsDoFn setup failed"', pinecone_source)
        self.assertIn('"error_message": self.setup_error_message or "QueryPinecone setup failed"', pinecone_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", pinecone_source)
        self.assertIn(").with_outputs(DeleteStaleQuestionVectorsDoFn.OUTPUT_ERROR_TAG, main='main')", pinecone_source)
        self.assertIn(").with_outputs(StoreIndividualEmbeddingsDoFn.OUTPUT_ERROR_TAG, main='main')", pinecone_source)
        self.assertIn(").with_outputs(QueryPinecone.OUTPUT_ERROR_TAG, main='main')", pinecone_source)
        self.assertIn("stale_vector_cleanup_results.error | \"DLQ_StaleVectorCleanupErrors\" >> dlq_sink(\"StaleVectorCleanupErrors\")", streaming_source)
        self.assertIn("store_statement_embeddings_results.error | \"DLQ_StoreStatementEmbeddingsErrors\" >> dlq_sink(\"StoreStatementEmbeddingsErrors\")", streaming_source)
        self.assertIn("statement_match_hits_results.error | \"DLQ_StatementQueryErrors\" >> dlq_sink(\"StatementQueryErrors\")", streaming_source)
        self.assertNotIn("Failed to setup Pinecone cleanup client or connect to index: {e}", pinecone_source)
        self.assertNotIn("Failed to setup Pinecone client or connect to index: {e}", pinecone_source)
        self.assertNotIn("Failed to setup Pinecone client or connect to index '{self.pinecone_index_name}': {e}", pinecone_source)
        self.assertNotIn("Pinecone stale-vector cleanup setup failed", pinecone_source)
        self.assertNotIn("Pinecone embedding store setup failed", pinecone_source)
        self.assertNotIn("Pinecone query setup failed", pinecone_source)
        self.assertNotIn("Pinecone index not initialized in stale-vector cleanup", pinecone_source)
        self.assertNotIn("Pinecone index not initialized in embedding store", pinecone_source)
        self.assertNotIn("Pinecone index not initialized in process", pinecone_source)
        self.assertNotIn("Pinecone index not initialized. Skipping query.", pinecone_source)
        self.assertNotIn("raise\n\n    def process(self, element: Dict[str, Any]):", pinecone_source)
        self.assertNotIn("raise\n\n    def process(self, element: Tuple[str, List[float], Dict[str, Any]]):", pinecone_source)
        self.assertNotIn("raise\n\n    def process(self, item: Tuple[str, List[float], Dict[str, Any]]):", pinecone_source)

    def test_next_question_candidate_setup_failures_are_tagged_not_raised(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        next_question_source = read("dataflow/pipelines/streaming/transforms/next_question.py")

        for class_name in (
            "Layer1CandidateDoFn",
            "Layer2CandidateDoFn",
            "Layer3CandidateDoFn",
            "Layer4CandidateDoFn",
        ):
            self.assertIn(f"class {class_name}", next_question_source)

        self.assertGreaterEqual(next_question_source.count("OUTPUT_ERROR_TAG = 'errors'"), 4)
        self.assertIn("setup_error_message", next_question_source)
        self.assertIn("partial_setup_error_message", next_question_source)
        self.assertIn("Layer1CandidateDoFn setup failed", next_question_source)
        self.assertIn("Layer2CandidateDoFn setup failed", next_question_source)
        self.assertIn("Layer3CandidateDoFn setup failed", next_question_source)
        self.assertIn("Layer4CandidateDoFn setup failed", next_question_source)
        self.assertIn("error_message = self.setup_error_message or \"Layer1CandidateDoFn setup failed\"", next_question_source)
        self.assertIn("error_message = self.setup_error_message or \"Layer2CandidateDoFn setup failed\"", next_question_source)
        self.assertIn("error_message = self.setup_error_message or \"Layer3CandidateDoFn setup failed\"", next_question_source)
        self.assertIn("error_message = self.setup_error_message or \"Layer4CandidateDoFn setup failed\"", next_question_source)
        self.assertIn("if not self.db or not self.prediction_client or not self.model_endpoint", next_question_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", next_question_source)
        self.assertIn("if self.partial_setup_error_message:", next_question_source)
        self.assertIn("'error': self.partial_setup_error_message", next_question_source)
        self.assertIn("'partial_setup_failure': True", next_question_source)
        self.assertIn("clarification_candidates, layer1_error_message = self._call_llm_for_clarification", next_question_source)
        self.assertIn("'partial_candidate_generation_failure': True", next_question_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': layer1_error_message", next_question_source)
        self.assertIn("layer3_candidates, layer3_error_message = self._call_llm_for_analysis_and_candidates", next_question_source)
        self.assertIn("'partial_candidate_generation_failure': True", next_question_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': layer3_error_message", next_question_source)
        self.assertIn("layer1_errors | \"DLQ_Layer1Errors\" >> dlq_sink(\"Layer1Errors\")", streaming_source)
        self.assertIn("layer2_errors | \"DLQ_Layer2Errors\" >> dlq_sink(\"Layer2Errors\")", streaming_source)
        self.assertIn("layer3_errors | \"DLQ_Layer3Errors\" >> dlq_sink(\"Layer3Errors\")", streaming_source)
        self.assertIn("layer4_errors | \"DLQ_Layer4Errors\" >> dlq_sink(\"Layer4Errors\")", streaming_source)
        self.assertNotIn("Failed Layer1CandidateDoFn setup due to missing library: {e}", next_question_source)
        self.assertNotIn("Failed Layer1CandidateDoFn setup: {e}", next_question_source)
        self.assertNotIn("Failed Layer2CandidateDoFn setup: {e}", next_question_source)
        self.assertNotIn("Could not load Layer 2 question templates", next_question_source)
        self.assertNotIn("Layer 2 templates are empty or failed to load during setup", next_question_source)
        self.assertNotIn("Failed Layer3CandidateDoFn setup due to missing aiplatform v1beta1 library: {e}", next_question_source)
        self.assertNotIn("Failed Layer3CandidateDoFn setup: {e}", next_question_source)
        self.assertNotIn("if setup_errors and not any(loaded_summary.values())", next_question_source)
        self.assertNotIn("preserve failures for per-element DLQ if no usable templates load", next_question_source)
        self.assertNotIn("Vertex AI client not loaded", next_question_source)
        self.assertNotIn("# Propagate exception to potentially fail the pipeline startup", next_question_source)

    def test_layer2_candidate_keying_errors_are_tagged_not_inline_lambda_failures(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        layer_input_path = REPO_ROOT / "dataflow/pipelines/streaming/transforms/next_question_input.py"
        self.assertTrue(layer_input_path.exists(), "next-question input formatting transform must exist")
        layer_input_source = layer_input_path.read_text()

        self.assertIn("class KeyLayer2CandidatesDoFn", layer_input_source)
        self.assertIn("KeyLayer2CandidatesDoFn.OUTPUT_ERROR_TAG", layer_input_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", layer_input_source)
        self.assertIn('"operation": "key_layer2_candidates"', layer_input_source)
        self.assertIn('"Malformed Layer 2 candidate output"', layer_input_source)
        self.assertIn('"user_id": user_id', layer_input_source)
        self.assertIn("candidates=candidates", layer_input_source)
        self.assertIn("KeyLayer2Candidates", streaming_source)
        self.assertIn("layer2_keying_results.error | \"DLQ_Layer2KeyingErrors\" >> dlq_sink(\"Layer2KeyingErrors\")", streaming_source)
        self.assertIn("layer2_candidates_tagged = layer2_keying_results.main", streaming_source)
        self.assertNotIn("| \"KeyLayer2Candidates\" >> beam.Map(lambda x: (x['user_id'], x.get('candidates', [])))", streaming_source)

    def test_layer3_input_format_errors_are_tagged_not_inline_lambda_failures(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        layer_input_path = REPO_ROOT / "dataflow/pipelines/streaming/transforms/next_question_input.py"
        self.assertTrue(layer_input_path.exists(), "next-question input formatting transform must exist")
        layer_input_source = layer_input_path.read_text()

        self.assertIn("class FormatInputForLayer3DoFn", layer_input_source)
        self.assertIn("FormatInputForLayer3DoFn.OUTPUT_ERROR_TAG", layer_input_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", layer_input_source)
        self.assertIn('"operation": "format_input_for_layer3"', layer_input_source)
        self.assertIn('"Malformed Layer 3 input"', layer_input_source)
        self.assertIn('"user_id": user_id', layer_input_source)
        self.assertIn('"matches": matches', layer_input_source)
        self.assertIn("FormatInputForLayer3", streaming_source)
        self.assertIn("layer3_input_results.error | \"DLQ_Layer3InputErrors\" >> dlq_sink(\"Layer3InputErrors\")", streaming_source)
        self.assertIn("layer3_input = layer3_input_results.main", streaming_source)
        self.assertNotIn("| \"FormatInputForLayer3\" >> beam.Map(lambda x: {'user_id': x[0], 'matches': x[1]})", streaming_source)

    def test_select_best_question_setup_failures_are_tagged_not_silent_fallbacks(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        next_question_source = read("dataflow/pipelines/streaming/transforms/next_question.py")

        self.assertIn("class SelectBestQuestionDoFn", next_question_source)
        self.assertIn("SelectBestQuestionDoFn.OUTPUT_ERROR_TAG", streaming_source)
        self.assertIn("setup_error_message", next_question_source)
        self.assertIn("SelectBestQuestionDoFn setup failed", next_question_source)
        self.assertIn("error_message = self.setup_error_message or \"SelectBestQuestionDoFn setup failed\"", next_question_source)
        self.assertIn("error_message = self.setup_error_message or \"SelectBestQuestionDoFn selector LLM failed\"", next_question_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", next_question_source)
        self.assertIn("selection_errors_first_pass | \"DLQ_SelectionErrorsFirstPass\" >> dlq_sink(\"SelectionErrorsFirstPass\")", streaming_source)
        self.assertIn("selection_errors_final | \"DLQ_SelectionErrorsFinalPass\" >> dlq_sink(\"SelectionErrorsFinalPass\")", streaming_source)
        self.assertNotIn("SelectBestQuestionDoFn: Failed to initialize Prediction client in setup: {e}", next_question_source)
        self.assertNotIn("Selector LLM client not initialized", next_question_source)
        self.assertNotIn("Selector LLM failed. Falling back to highest priority", next_question_source)
        self.assertNotIn("pass # Ensure it yields fallback", next_question_source)

    def test_update_next_question_setup_failures_are_tagged_not_raised(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        next_question_source = read("dataflow/pipelines/streaming/transforms/next_question.py")

        self.assertIn("class UpdateNextQuestionDoFn", next_question_source)
        self.assertIn("OUTPUT_ERROR_TAG = 'errors'", next_question_source)
        self.assertIn("setup_error_message", next_question_source)
        self.assertIn("UpdateNextQuestionDoFn setup failed", next_question_source)
        self.assertIn("error_message = self.setup_error_message or \"UpdateNextQuestionDoFn setup failed\"", next_question_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", next_question_source)
        self.assertIn("Clearing next-question suggestion failed", next_question_source)
        self.assertIn("'operation': 'clear_next_question_suggestion'", next_question_source)
        self.assertIn(").with_outputs(UpdateNextQuestionDoFn.OUTPUT_ERROR_TAG, main='main')", streaming_source)
        self.assertIn("update_next_q_errors | \"DLQ_UpdateNextQErrors\" >> dlq_sink(\"UpdateNextQErrors\")", streaming_source)
        self.assertNotIn("Failed UpdateNextQuestionDoFn setup: {e}", next_question_source)
        self.assertNotIn("# ... (error handling for db init) ...", next_question_source)

    def test_firestore_match_writer_client_initialization_failures_are_tagged_not_raised(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        firestore_source = read("dataflow/pipelines/streaming/transforms/firestore_io.py")

        self.assertIn("class UpdateFirestoreDoFn", firestore_source)
        self.assertIn("UpdateFirestoreDoFn.ERROR_TAG", firestore_source)
        self.assertIn("WriteMatchesToFirestore", firestore_source)
        self.assertIn("setup_error_message", firestore_source)
        self.assertIn("UpdateFirestoreDoFn setup failed", firestore_source)
        self.assertIn("error_message = self.setup_error_message or \"UpdateFirestoreDoFn setup failed\"", firestore_source)
        self.assertIn(".with_outputs(UpdateFirestoreDoFn.ERROR_TAG, main=UpdateFirestoreDoFn.OUTPUT_TAG)", firestore_source)
        self.assertIn("write_match_errors | \"DLQ_WriteMatchErrors\" >> dlq_sink(\"WriteMatchErrors\")", streaming_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.ERROR_TAG", firestore_source)
        self.assertNotIn("raise RuntimeError(\"Setup failed for UpdateFirestoreDoFn\")", firestore_source)
        self.assertNotIn("Firestore client initialization failed in UpdateFirestoreDoFn setup", firestore_source)
        self.assertNotIn("Firestore client not initialized in UpdateFirestoreDoFn", firestore_source)

    def test_cloud_tasks_side_effect_setup_failures_are_tagged_not_raised(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        scheduling_source = read("dataflow/pipelines/streaming/transforms/scheduling.py")

        self.assertIn("ScheduleDelayedMatchingDoFn.ERROR_TAG", scheduling_source)
        self.assertIn("HandleMatchActionsDoFn.ERROR_TAG", scheduling_source)
        self.assertIn(".with_outputs(ScheduleDelayedMatchingDoFn.ERROR_TAG, main=ScheduleDelayedMatchingDoFn.OUTPUT_TAG)", scheduling_source)
        self.assertIn(".with_outputs(HandleMatchActionsDoFn.ERROR_TAG, main=HandleMatchActionsDoFn.OUTPUT_TAG)", scheduling_source)
        self.assertIn("setup_error_message", scheduling_source)
        self.assertIn("ScheduleDelayedMatchingDoFn setup failed", scheduling_source)
        self.assertIn("HandleMatchActionsDoFn setup failed", scheduling_source)
        self.assertIn("error_message = self.setup_error_message or \"ScheduleDelayedMatchingDoFn setup failed\"", scheduling_source)
        self.assertIn("error_message = self.setup_error_message or \"HandleMatchActionsDoFn setup failed\"", scheduling_source)
        self.assertIn("schedule_errors | \"DLQ_ScheduleErrors\" >> dlq_sink(\"ScheduleErrors\")", streaming_source)
        self.assertIn("action_errors | \"DLQ_ActionErrors\" >> dlq_sink(\"ActionErrors\")", streaming_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.ERROR_TAG", scheduling_source)
        self.assertNotIn("raise RuntimeError(\"Setup failed for ScheduleDelayedMatchingDoFn\")", scheduling_source)
        self.assertNotIn("raise RuntimeError(\"Setup failed for HandleMatchActionsDoFn\")", scheduling_source)
        self.assertNotIn("Failed ScheduleDelayedMatchingDoFn setup: {e}", scheduling_source)
        self.assertNotIn("Failed HandleMatchActionsDoFn setup: {e}", scheduling_source)
        self.assertNotIn("Clients not initialized in ScheduleDelayedMatchingDoFn", scheduling_source)
        self.assertNotIn("Clients not initialized in HandleMatchActionsDoFn", scheduling_source)

    def test_handle_match_actions_validates_matches_shape_before_side_effects(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        scheduling_source = read("dataflow/pipelines/streaming/transforms/scheduling.py")

        self.assertIn("HandleMatchActionsDoFn.ERROR_TAG", scheduling_source)
        self.assertIn("matches = element.get('matches')", scheduling_source)
        self.assertIn("if not isinstance(matches, list):", scheduling_source)
        self.assertIn('"error_message": "Invalid matches shape for HandleMatchActionsDoFn"', scheduling_source)
        self.assertIn("if not all(isinstance(match, dict) for match in matches):", scheduling_source)
        self.assertIn('"error_message": "Invalid match item shape for HandleMatchActionsDoFn"', scheduling_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.ERROR_TAG", scheduling_source)
        self.assertIn("action_errors | \"DLQ_ActionErrors\" >> dlq_sink(\"ActionErrors\")", streaming_source)
        self.assertLess(
            scheduling_source.index("if not isinstance(matches, list):"),
            scheduling_source.index("settings_ref = self.db.collection"),
        )
        self.assertLess(
            scheduling_source.index("if not all(isinstance(match, dict) for match in matches):"),
            scheduling_source.index("settings_ref = self.db.collection"),
        )

    def test_handle_match_actions_task_failures_are_tagged_not_log_only(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        scheduling_source = read("dataflow/pipelines/streaming/transforms/scheduling.py")

        self.assertIn("def _schedule_task(", scheduling_source)
        self.assertIn("return True, None", scheduling_source)
        self.assertIn("return False, {", scheduling_source)
        self.assertIn('"error_message": f"Failed to schedule {operation} task on queue {queue_name} for user {user_id}: {e}"', scheduling_source)
        self.assertIn('"operation": operation', scheduling_source)
        self.assertIn('"payload": payload', scheduling_source)
        self.assertIn("success, action_error = self._schedule_task(", scheduling_source)
        self.assertIn("if not success and action_error:", scheduling_source)
        self.assertIn('action_error["element"] = element', scheduling_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.ERROR_TAG, action_error)", scheduling_source)
        self.assertIn('operation="schedule_match_notification"', scheduling_source)
        self.assertIn('operation="schedule_voice_agent_call"', scheduling_source)
        self.assertIn("action_errors | \"DLQ_ActionErrors\" >> dlq_sink(\"ActionErrors\")", streaming_source)
        self.assertNotIn("# Don't raise here, just log the failure for this specific action", scheduling_source)

    def test_handle_match_actions_availability_fallback_is_tagged_not_log_only(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        scheduling_source = read("dataflow/pipelines/streaming/transforms/scheduling.py")

        self.assertIn("def _check_notification_availability(self, prefs, user_id: str):", scheduling_source)
        self.assertIn("return True, None", scheduling_source)
        self.assertIn('"error_message": f"Notification availability check failed for user {user_id}: {e}"', scheduling_source)
        self.assertIn('"operation": "check_notification_availability"', scheduling_source)
        self.assertIn('"prefs": prefs', scheduling_source)
        self.assertIn("return True, {", scheduling_source)
        self.assertIn("is_available, availability_error = self._check_notification_availability(notification_prefs, user_id)", scheduling_source)
        self.assertIn("if availability_error:", scheduling_source)
        self.assertIn('availability_error["element"] = element', scheduling_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.ERROR_TAG, availability_error)", scheduling_source)
        self.assertIn("action_errors | \"DLQ_ActionErrors\" >> dlq_sink(\"ActionErrors\")", streaming_source)
        self.assertNotIn("# Default to available on error to avoid blocking notifications due to bad settings", scheduling_source)

    def test_handle_match_actions_missing_settings_are_tagged_not_log_only(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        scheduling_source = read("dataflow/pipelines/streaming/transforms/scheduling.py")

        self.assertIn("if not user_settings_doc.exists:", scheduling_source)
        self.assertIn('"error_message": f"User settings missing for HandleMatchActionsDoFn user {user_id}"', scheduling_source)
        self.assertIn('"operation": "fetch_user_settings"', scheduling_source)
        self.assertIn('"user_id": user_id', scheduling_source)
        self.assertIn('"element": element', scheduling_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.ERROR_TAG, {", scheduling_source)
        self.assertIn("yield element", scheduling_source)
        self.assertIn("action_errors | \"DLQ_ActionErrors\" >> dlq_sink(\"ActionErrors\")", streaming_source)
        self.assertLess(
            scheduling_source.index('"error_message": f"User settings missing for HandleMatchActionsDoFn user {user_id}"'),
            scheduling_source.index("yield element\n                return"),
        )
        self.assertNotIn("# Yield element anyway, as processing is done, just actions skipped", scheduling_source)

    def test_trigger_event_parser_dlq_error_paths_do_not_assume_pubsub_data(self):
        common_source = read("dataflow/pipelines/streaming/transforms/common.py")
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")

        self.assertIn("class ParseFirestoreTriggerEventDoFn", common_source)
        self.assertIn("def _raw_data_for_dlq", common_source)
        self.assertIn("raw_data = self._raw_data_for_dlq(element)", common_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", common_source)
        self.assertIn("parsing_errors | \"DLQ_ParsingErrors\" >> dlq_sink(\"ParsingErrors\")", streaming_source)
        self.assertNotIn("element.data[:200]", common_source)
        self.assertNotIn("repr(element.data)", common_source)

    def test_fetch_user_history_setup_failures_are_tagged_not_generic(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        common_source = read("dataflow/pipelines/streaming/transforms/common.py")

        self.assertIn("FetchUserHistoryDoFn.ERROR_TAG", streaming_source)
        self.assertIn("setup_error_message", common_source)
        self.assertIn("FetchUserHistoryDoFn setup failed", common_source)
        self.assertIn("error_message = self.setup_error_message or \"FetchUserHistoryDoFn setup failed\"", common_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.ERROR_TAG", common_source)
        self.assertIn(").with_outputs(FetchUserHistoryDoFn.ERROR_TAG, main='main')", streaming_source)
        self.assertIn("user_history_results[FetchUserHistoryDoFn.ERROR_TAG] | \"DLQ_UserHistoryErrors\" >> dlq_sink(\"UserHistoryErrors\")", streaming_source)
        self.assertNotIn("Failed to initialize Firestore client in setup: {str(e)}", common_source)
        self.assertNotIn('"error_message": "Firestore client not initialized"', common_source)
        self.assertNotIn("# raise # Uncomment to fail fast", common_source)

    def test_fetch_full_qas_setup_failures_are_tagged_not_raised(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        common_source = read("dataflow/pipelines/streaming/transforms/common.py")

        self.assertIn("FetchFullQAsDoFn.OUTPUT_ERROR_TAG", common_source)
        self.assertIn("setup_error_message", common_source)
        self.assertIn("FetchFullQAsDoFn setup failed", common_source)
        self.assertIn("error_message = self.setup_error_message or \"FetchFullQAsDoFn setup failed\"", common_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", common_source)
        self.assertIn(").with_outputs(FetchFullQAsDoFn.OUTPUT_ERROR_TAG, main='main')", common_source)
        self.assertIn("fetch_qas_errors | \"DLQ_FetchQAsErrors\" >> dlq_sink(\"FetchQAsErrors\")", streaming_source)
        self.assertNotIn("FetchFullQAsDoFn: Failed to initialize Firestore client in setup: {str(e)}", common_source)
        self.assertNotIn("Firestore client not initialized", common_source)
        self.assertNotIn("raise\n\n    def process(self, element: Tuple[str, Dict[str, Any]]):", common_source)

    def test_fetch_full_qas_input_keying_errors_are_tagged_not_inline_lambda_failures(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        common_source = read("dataflow/pipelines/streaming/transforms/common.py")

        self.assertIn("class KeyProfileForQAFetchDoFn", common_source)
        self.assertIn("OUTPUT_ERROR_TAG = 'error'", common_source)
        self.assertIn("Missing user_id for Q&A fetch keying", common_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", common_source)
        self.assertIn("beam.ParDo(KeyProfileForQAFetchDoFn()).with_outputs(", common_source)
        self.assertIn("KeyProfileForQAFetchDoFn.OUTPUT_ERROR_TAG, main='main'", common_source)
        self.assertIn("FlattenFetchFullQAsErrors", common_source)
        self.assertIn("return FetchFullQAsResult(main=fetch_results['main'], error=combined_errors)", common_source)
        self.assertIn("fetch_qas_errors | \"DLQ_FetchQAsErrors\" >> dlq_sink(\"FetchQAsErrors\")", streaming_source)
        self.assertNotIn("| 'KeyByUserForQAFetch' >> beam.Map(lambda x: (x['user_id'], x))", common_source)

    def test_profile_summary_setup_failures_are_tagged_not_raised(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        summary_source = read("dataflow/pipelines/streaming/transforms/profile_summarization.py")

        self.assertIn("GenerateProfileSummaryDoFn.OUTPUT_ERROR_TAG", summary_source)
        self.assertIn("UpdateProfileSummaryInDedicatedCollectionDoFn.OUTPUT_ERROR_TAG", summary_source)
        self.assertIn("setup_error_message", summary_source)
        self.assertIn("GenerateProfileSummaryDoFn setup failed", summary_source)
        self.assertIn("UpdateProfileSummaryInDedicatedCollectionDoFn setup failed", summary_source)
        self.assertIn("error_message = self.setup_error_message or \"GenerateProfileSummaryDoFn setup failed\"", summary_source)
        self.assertIn("error_message = self.setup_error_message or \"UpdateProfileSummaryInDedicatedCollectionDoFn setup failed\"", summary_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", summary_source)
        self.assertIn(").with_outputs(GenerateProfileSummaryDoFn.OUTPUT_ERROR_TAG, main='main')", summary_source)
        self.assertIn(").with_outputs(UpdateProfileSummaryInDedicatedCollectionDoFn.OUTPUT_ERROR_TAG, main='main')", summary_source)
        self.assertIn("summary_results_tuple.generation_errors | \"DLQ_SummaryGenerationErrors\" >> dlq_sink(\"SummaryGenerationErrors\")", streaming_source)
        self.assertIn("summary_results_tuple.storage_errors | \"DLQ_SummaryStorageErrors\" >> dlq_sink(\"SummaryStorageErrors\")", streaming_source)
        self.assertNotIn("Failed GenerateProfileSummaryDoFn setup: {e}", summary_source)
        self.assertNotIn("Failed UpdateProfileSummaryInDedicatedCollectionDoFn setup: {e}", summary_source)
        self.assertNotIn("GenerateProfileSummaryDoFn not initialized", summary_source)
        self.assertNotIn("UpdateProfileSummaryInDedicatedCollectionDoFn not initialized", summary_source)
        self.assertNotIn("raise # Critical setup failure", summary_source)

    def test_profile_summary_empty_llm_output_is_tagged_not_silently_dropped(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        summary_source = read("dataflow/pipelines/streaming/transforms/profile_summarization.py")

        self.assertIn("GenerateProfileSummaryDoFn.OUTPUT_ERROR_TAG", summary_source)
        self.assertIn("summary_text = response.choices[0].message.content.strip()", summary_source)
        self.assertIn('"error_message": "GenerateProfileSummaryDoFn empty summary generated"', summary_source)
        self.assertIn('"user_id": user_id', summary_source)
        self.assertIn('"element": element', summary_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", summary_source)
        self.assertIn("summary_results_tuple.generation_errors | \"DLQ_SummaryGenerationErrors\" >> dlq_sink(\"SummaryGenerationErrors\")", streaming_source)
        self.assertNotIn("# Decide if we should yield to error or just log and not yield", summary_source)

    def test_profile_summary_missing_or_unformattable_qas_are_tagged_not_silently_dropped(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        summary_source = read("dataflow/pipelines/streaming/transforms/profile_summarization.py")

        self.assertIn("GenerateProfileSummaryDoFn.OUTPUT_ERROR_TAG", summary_source)
        self.assertIn('"error_message": "GenerateProfileSummaryDoFn missing questions_answers"', summary_source)
        self.assertIn('"error_message": "GenerateProfileSummaryDoFn empty formatted Q&A text"', summary_source)
        self.assertIn('"user_id": user_id', summary_source)
        self.assertIn('"element": element', summary_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", summary_source)
        self.assertIn("summary_results_tuple.generation_errors | \"DLQ_SummaryGenerationErrors\" >> dlq_sink(\"SummaryGenerationErrors\")", streaming_source)
        self.assertNotIn("# For now, just return and don't yield to main output. Consider error tag if this is unexpected.", summary_source)

    def test_profile_summary_qas_formatting_exceptions_are_tagged_not_bundle_failures(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        summary_source = read("dataflow/pipelines/streaming/transforms/profile_summarization.py")

        self.assertIn("GenerateProfileSummaryDoFn.OUTPUT_ERROR_TAG", summary_source)
        self.assertIn("qas_text_for_prompt = self._prepare_qas_for_prompt(questions_answers)", summary_source)
        self.assertIn('"error_message": f"GenerateProfileSummaryDoFn Q&A formatting failed: {str(e)}"', summary_source)
        self.assertIn('"user_id": user_id', summary_source)
        self.assertIn('"element": element', summary_source)
        self.assertIn('"traceback": traceback.format_exc()', summary_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", summary_source)
        self.assertIn("summary_results_tuple.generation_errors | \"DLQ_SummaryGenerationErrors\" >> dlq_sink(\"SummaryGenerationErrors\")", streaming_source)
        self.assertNotIn(
            "qas_text_for_prompt = self._prepare_qas_for_prompt(questions_answers)\n        if not qas_text_for_prompt.strip()",
            summary_source,
        )

    def test_profile_summary_qas_hash_failures_are_tagged_not_silent_empty_versions(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        summary_source = read("dataflow/pipelines/streaming/transforms/profile_summarization.py")

        self.assertIn("GenerateProfileSummaryDoFn.OUTPUT_ERROR_TAG", summary_source)
        self.assertIn("qas_version_hash = generate_qas_hash(questions_answers)", summary_source)
        self.assertIn('"error_message": f"GenerateProfileSummaryDoFn Q&A hash generation failed: {str(e)}"', summary_source)
        self.assertIn('"user_id": user_id', summary_source)
        self.assertIn('"element": element', summary_source)
        self.assertIn('"traceback": traceback.format_exc()', summary_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", summary_source)
        self.assertIn("summary_results_tuple.generation_errors | \"DLQ_SummaryGenerationErrors\" >> dlq_sink(\"SummaryGenerationErrors\")", streaming_source)
        self.assertNotIn('return "" # Fallback to empty string if hashing fails', summary_source)

    def test_streaming_dlq_writer_persists_structured_error_record(self):
        class _FakeMetrics:
            @staticmethod
            def counter(*_args, **_kwargs):
                return types.SimpleNamespace(inc=lambda *_args, **_kwargs: None)

        class _FakeFileSystems:
            @staticmethod
            def join(*parts):
                return str(Path(parts[0]).joinpath(*parts[1:]))

            @staticmethod
            def create(path):
                Path(path).parent.mkdir(parents=True, exist_ok=True)
                return open(path, "wb")

        class _FakePCollection:
            def __class_getitem__(cls, _item):
                return cls

        fake_beam = types.ModuleType("apache_beam")
        fake_beam.DoFn = object
        fake_beam.Row = type("Row", (), {})
        fake_beam.PCollection = _FakePCollection
        fake_beam.PCollectionTuple = _FakePCollection
        fake_beam.ptransform_fn = lambda fn: fn
        fake_beam.pvalue = types.SimpleNamespace(TaggedOutput=lambda tag, value: (tag, value))
        fake_metrics = types.ModuleType("apache_beam.metrics")
        fake_metrics.Metrics = _FakeMetrics
        fake_filesystems = types.ModuleType("apache_beam.io.filesystems")
        fake_filesystems.FileSystems = _FakeFileSystems
        fake_io = types.ModuleType("apache_beam.io")
        fake_io.filesystems = fake_filesystems
        setattr(fake_io, "ReadFromPubSub", types.SimpleNamespace(PubsubMessage=type("PubsubMessage", (), {})))
        fake_beam.io = fake_io
        fake_google = types.ModuleType("google")
        fake_google_cloud = types.ModuleType("google.cloud")
        fake_google_protobuf = types.ModuleType("google.protobuf")
        fake_timestamp_pb2 = types.ModuleType("google.protobuf.timestamp_pb2")
        fake_firestore = types.ModuleType("google.cloud.firestore")
        setattr(fake_firestore, "Client", object)
        setattr(fake_google_cloud, "firestore", fake_firestore)
        setattr(fake_timestamp_pb2, "Timestamp", type("Timestamp", (), {}))

        stubbed_modules = {
            "apache_beam": fake_beam,
            "apache_beam.metrics": fake_metrics,
            "apache_beam.io": fake_io,
            "apache_beam.io.filesystems": fake_filesystems,
            "google": fake_google,
            "google.cloud": fake_google_cloud,
            "google.cloud.firestore": fake_firestore,
            "google.protobuf": fake_google_protobuf,
            "google.protobuf.timestamp_pb2": fake_timestamp_pb2,
        }
        original_modules = {name: sys.modules.get(name) for name in stubbed_modules}
        sys.modules.update(stubbed_modules)
        sys.modules.pop("dataflow.pipelines.streaming.transforms.common", None)
        try:
            common = importlib.import_module("dataflow.pipelines.streaming.transforms.common")
            with tempfile.TemporaryDirectory() as temp_dir:
                dlq_writer = common.WriteToDLQFn(temp_dir)
                maybe_output = dlq_writer.process(({"user_id": "user-1", "payload": b"bad"}, RuntimeError("boom")))
                if maybe_output is not None:
                    list(maybe_output)

                dlq_files = sorted(Path(temp_dir).glob("dlq-*.json"))
                self.assertEqual(len(dlq_files), 1)
                record = json.loads(dlq_files[0].read_text())
        finally:
            sys.modules.pop("dataflow.pipelines.streaming.transforms.common", None)
            for name, original in original_modules.items():
                if original is None:
                    sys.modules.pop(name, None)
                else:
                    sys.modules[name] = original

        self.assertEqual(record["failed_element"]["user_id"], "user-1")
        self.assertEqual(record["failed_element"]["payload"], "bad")
        self.assertIn("RuntimeError: boom", record["error_message"])
        self.assertIn("timestamp_utc", record)
        self.assertIn("error_traceback", record)

    def test_streaming_runtime_smoke_covers_dataflow_import_dependencies(self):
        requirements = read("dataflow/pipelines/streaming/requirements.txt")
        smoke_path = REPO_ROOT / "dataflow/pipelines/streaming/scripts/runtime_smoke.py"
        self.assertTrue(smoke_path.exists(), "streaming runtime smoke script must exist")
        smoke_source = smoke_path.read_text()
        workflow = read(".github/workflows/backend-production-readiness.yml")
        readme = read("dataflow/README.md")

        self.assertIn("sentence-transformers", requirements)
        self.assertIn("REQUIRED_RUNTIME_MODULES", smoke_source)
        for module_name in (
            "apache_beam",
            "google.cloud.firestore",
            "google.cloud.tasks_v2",
            "google.cloud.storage",
            "google.cloud.secretmanager",
            "pinecone",
            "openai",
            "sentence_transformers",
            "PyPDF2",
        ):
            self.assertIn(module_name, smoke_source)
        self.assertIn("Run Dataflow streaming runtime smoke", workflow)
        self.assertIn("python3 dataflow/pipelines/streaming/scripts/runtime_smoke.py", workflow)
        self.assertIn("runtime_smoke.py", readme)

    def test_streaming_flex_template_dockerfile_installs_and_smokes_runtime_explicitly(self):
        dockerfile = read("dataflow/pipelines/streaming/Dockerfile")
        readme = read("dataflow/README.md")

        self.assertIn('ENV FLEX_TEMPLATE_PYTHON_REQUIREMENTS_FILE="${WORKDIR}/requirements.txt"', dockerfile)
        self.assertIn("pip install --no-cache-dir -r ${WORKDIR}/requirements.txt", dockerfile)
        self.assertLess(
            dockerfile.index('ENV FLEX_TEMPLATE_PYTHON_REQUIREMENTS_FILE="${WORKDIR}/requirements.txt"'),
            dockerfile.index("pip install --no-cache-dir -r ${WORKDIR}/requirements.txt"),
        )
        self.assertNotIn("-r $FLEX_TEMPLATE_PYTHON_REQUIREMENTS_FILE", dockerfile)
        self.assertIn("COPY ./common ./common", dockerfile)
        self.assertIn("COPY ./utils ./utils", dockerfile)
        self.assertIn("COPY ./scripts ./scripts", dockerfile)
        self.assertIn("python scripts/runtime_smoke.py", dockerfile)
        self.assertIn("pip download --no-cache-dir --dest /tmp/dataflow-requirements-cache -r ${WORKDIR}/requirements.txt", dockerfile)
        for line in dockerfile.splitlines():
            if line.lstrip().startswith(("COPY ", "RUN ")):
                self.assertNotIn(" #", line, f"Dockerfile instruction has inline shell-style comment: {line}")
        self.assertIn("Dockerfile runs `python scripts/runtime_smoke.py`", readme)

    def test_streaming_deploy_script_requires_external_config_without_baked_in_placeholders(self):
        deploy_script = read("dataflow/pipelines/streaming/deploy_flex_templates.sh")
        example_path = REPO_ROOT / "dataflow/pipelines/streaming/deploy_flex_templates.env.example"
        self.assertTrue(example_path.exists(), "streaming deploy env example must exist")
        example = example_path.read_text()

        self.assertIn("set -euo pipefail", deploy_script)
        self.assertIn("DEPLOY_CONFIG", deploy_script)
        self.assertIn("required_var()", deploy_script)
        self.assertIn("Streaming deploy config", deploy_script)
        self.assertNotIn("YOUR_", deploy_script)
        self.assertNotIn("your-", deploy_script)
        self.assertNotIn("*** REPLACE", deploy_script)
        self.assertNotIn('PROJECT_ID="marriage-ai-289c6"', deploy_script)
        self.assertNotIn('BUCKET_NAME="marriage-ai-289c6-dataflow-assets"', deploy_script)

        required_config_vars = (
            "PROJECT_ID",
            "REGION",
            "BUCKET_NAME",
            "ARTIFACT_REPO",
            "IMAGE_NAME_STREAMING",
            "IMAGE_TAG",
            "PINECONE_INDEX",
            "PINECONE_REGION",
            "TOP_K",
            "PDF_BUCKET",
            "PDF_INSTRUCTIONS_PATH",
            "TASKS_LOCATION",
            "DELAYED_MATCHING_QUEUE",
            "NOTIFICATION_QUEUE",
            "VOICE_AGENT_QUEUE",
            "NOTIFICATION_FUNCTION_URL",
            "VOICE_AGENT_FUNCTION_URL",
            "DELAYED_TASK_DELAY_SECONDS",
            "DATAFLOW_WORKER_SA",
            "IMMEDIATE_TOPIC",
            "DELAYED_TOPIC",
        )
        for var_name in required_config_vars:
            self.assertIn(f"required_var {var_name}", deploy_script)
            self.assertIn(f"{var_name}=", example)
        self.assertIn("deploy_flex_templates.env.example", read("dataflow/README.md"))

    def test_streaming_deploy_preflight_checks_worker_iam_permissions(self):
        preflight_source = read("dataflow/pipelines/streaming/scripts/preflight_deploy.py")
        readme = read("dataflow/README.md")

        self.assertIn("REQUIRED_WORKER_PROJECT_ROLES", preflight_source)
        for role_name in (
            "roles/dataflow.worker",
            "roles/datastore.user",
            "roles/pubsub.subscriber",
            "roles/pubsub.publisher",
            "roles/cloudtasks.enqueuer",
            "roles/secretmanager.secretAccessor",
            "roles/storage.objectAdmin",
            "roles/artifactregistry.reader",
        ):
            self.assertIn(role_name, preflight_source)
            self.assertIn(role_name, readme)
        self.assertIn("gcloud projects get-iam-policy", preflight_source)
        self.assertIn("worker-iam", preflight_source)
        self.assertIn("--skip-iam-checks", preflight_source)
        self.assertIn("IAM permissions", readme)
        self.assertIn("Dataflow worker service account", readme)

    def test_streaming_deploy_preflight_checks_cloud_tasks_token_creator(self):
        preflight_source = read("dataflow/pipelines/streaming/scripts/preflight_deploy.py")
        scheduling_source = read("dataflow/pipelines/streaming/transforms/scheduling.py")
        readme = read("dataflow/README.md")

        self.assertIn("tasks_v2.OAuthToken", scheduling_source)
        self.assertIn("tasks_v2.OidcToken", scheduling_source)
        self.assertIn("cloud_tasks_service_agent_email", preflight_source)
        self.assertIn("service-", preflight_source)
        self.assertIn("gcp-sa-cloudtasks.iam.gserviceaccount.com", preflight_source)
        self.assertIn("roles/iam.serviceAccountTokenCreator", preflight_source)
        self.assertIn("gcloud projects describe", preflight_source)
        self.assertIn("gcloud iam service-accounts get-iam-policy", preflight_source)
        self.assertIn("cloud-tasks-token-creator", preflight_source)
        self.assertIn("Cloud Tasks service agent", readme)
        self.assertIn("roles/iam.serviceAccountTokenCreator", readme)
        self.assertIn("OAuthToken", readme)
        self.assertIn("OidcToken", readme)

    def test_streaming_deploy_preflight_checks_required_runtime_resources(self):
        preflight_path = REPO_ROOT / "dataflow/pipelines/streaming/scripts/preflight_deploy.py"
        self.assertTrue(preflight_path.exists(), "streaming deploy preflight script must exist")
        preflight_source = preflight_path.read_text()
        deploy_script = read("dataflow/pipelines/streaming/deploy_flex_templates.sh")
        readme = read("dataflow/README.md")

        self.assertIn("REQUIRED_SECRET_NAMES", preflight_source)
        for secret_name in ("OPENAI_API_KEY", "PINECONE_API_KEY"):
            self.assertIn(secret_name, preflight_source)
        for resource_check in (
            "gcloud secrets describe",
            "gcloud pubsub topics describe",
            "gcloud tasks queues describe",
            "gcloud iam service-accounts describe",
            "gsutil ls",
            "urlparse",
            "PLACEHOLDER_TOKENS",
        ):
            self.assertIn(resource_check, preflight_source)
        self.assertNotIn("access_secret_version", preflight_source)
        self.assertIn("preflight_deploy.py", deploy_script)
        self.assertLess(deploy_script.index("preflight_deploy.py"), deploy_script.index("gcloud dataflow flex-template build"))
        for shell_variable in (
            "PROJECT_ID",
            "REGION",
            "DATAFLOW_WORKER_SA",
            "IMMEDIATE_TOPIC",
            "DELAYED_TOPIC",
            "TASKS_LOCATION",
            "DELAYED_MATCHING_QUEUE",
            "NOTIFICATION_QUEUE",
            "VOICE_AGENT_QUEUE",
            "PDF_BUCKET",
            "PDF_INSTRUCTIONS_PATH",
            "NOTIFICATION_FUNCTION_URL",
            "VOICE_AGENT_FUNCTION_URL",
        ):
            self.assertIn(f"${{{shell_variable}}}", deploy_script)
        self.assertIn("preflight_deploy.py", readme)
        self.assertIn("does not read or print secret values", readme)

    def test_streaming_flex_template_metadata_matches_required_parser_args(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        tree = ast.parse(streaming_source)
        required_args = set()
        for node in ast.walk(tree):
            if not (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Attribute)
                and node.func.attr == "add_argument"
                and node.args
                and isinstance(node.args[0], ast.Constant)
                and isinstance(node.args[0].value, str)
                and node.args[0].value.startswith("--")
            ):
                continue
            required = any(
                keyword.arg == "required"
                and isinstance(keyword.value, ast.Constant)
                and keyword.value.value is True
                for keyword in node.keywords
            )
            if required:
                required_args.add(node.args[0].value.removeprefix("--"))

        template_spec = json.loads(read("dataflow/pipelines/streaming/template_spec.json"))
        template_parameter_names = {parameter["name"] for parameter in template_spec["parameters"]}
        deploy_script = read("dataflow/pipelines/streaming/deploy_flex_templates.sh")

        self.assertSetEqual(
            required_args,
            {
                "project",
                "region",
                "runner",
                "temp_location",
                "staging_location",
                "service_account_email",
                "requirements_file",
                "user_profile_updated_pubsub_topic",
                "delayed_matching_pubsub_topic",
                "pinecone_index",
                "pinecone_region",
                "pdf_bucket",
                "notification_function_url",
                "voice_agent_function_url",
                "dlq_gcs_path",
            },
        )
        self.assertTrue(
            required_args.issubset(template_parameter_names),
            f"template_spec.json missing required parser args: {sorted(required_args - template_parameter_names)}",
        )
        self.assertFalse(
            {"pubsub_topic", "dlq_bucket", "profiles_collection", "matches_collection"} & template_parameter_names,
            "template_spec.json must not advertise stale/non-parser parameter names",
        )
        for arg_name in required_args:
            self.assertIn(f'--parameters {arg_name}="', deploy_script)
        self.assertNotIn('--parameters profiles_collection="', deploy_script)
        self.assertNotIn('--parameters matches_collection="', deploy_script)

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

    def test_scoreboard_uses_idempotent_normalized_match_evidence_not_additive_increment(self):
        source = read("dataflow/pipelines/streaming/transforms/scoreboard.py")

        self.assertNotIn("Increment(", source)
        self.assertIn("stable_match_evidence_id", source)
        self.assertIn("collection('evidence')", source)
        self.assertIn("weighted_score", source)
        self.assertIn("calculate_candidate_compatibility_score", source)
        self.assertIn("'score': compatibility_score", source)
        self.assertIn("'compatibility_score': compatibility_score", source)
        self.assertIn("'total_evidence_score': float(total_score)", source)

    def test_scoreboard_scoring_helpers_are_deterministic_weighted_and_normalized(self):
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
        self.assertEqual(scoring.calculate_candidate_compatibility_score(1.8, 3), 0.6)
        self.assertEqual(scoring.calculate_candidate_compatibility_score(5.0, 2), 1.0)
        self.assertEqual(scoring.calculate_candidate_compatibility_score(-1.0, 2), 0.0)
        self.assertIsNone(scoring.calculate_candidate_compatibility_score(1.0, 0))
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

    def test_update_user_answers_persists_matching_event_outbox_before_publish(self):
        source = read("functions-nodejs/src/domains/marriage/index.ts")
        matching_events_source = read("functions-nodejs/src/domains/marriage/matching-events.ts")
        combined_source = source + "\n" + matching_events_source
        rules = read("firestore.rules")

        self.assertIn("@google-cloud/pubsub", combined_source)
        self.assertIn("publishMatchingEvent", combined_source)
        self.assertIn("USER_PROFILE_UPDATED_PUBSUB_TOPIC", combined_source)
        self.assertIn("MATCHING_EVENT_OUTBOX", combined_source)
        self.assertIn("republishPendingMatchingEvents", combined_source)
        self.assertIn("matchingEventRef", combined_source)
        self.assertIn("status: \"pending\"", combined_source)
        self.assertIn("status: \"published\"", combined_source)
        self.assertIn("status: \"publish_failed\"", combined_source)
        self.assertIn("triggering_qa", combined_source)
        self.assertIn("qa_id: params.questionId", combined_source)
        self.assertIn("transaction.set(matchingEventRef", matching_events_source)
        self.assertLess(source.index("queueMatchingEvent"), source.index("await publishMatchingEvent"))
        self.assertIn("match /MATCHING_EVENT_OUTBOX/{document=**}", rules)
        self.assertIn("allow read, write: if false", rules)

    def test_matching_event_republisher_bounds_poison_retries_and_drains_oldest_first(self):
        matching_events_source = read("functions-nodejs/src/domains/marriage/matching-events.ts")

        self.assertIn("MAX_REPUBLISH_ATTEMPTS", matching_events_source)
        self.assertIn("status: \"dead_letter\"", matching_events_source)
        self.assertIn("markMatchingEventDeadLetter", matching_events_source)
        self.assertIn("data.attempts >= MAX_REPUBLISH_ATTEMPTS", matching_events_source)
        self.assertIn('.orderBy("createdAt", "asc")', matching_events_source)
        self.assertIn('return "dead_letter"', matching_events_source)
        self.assertIn("deadLettered", matching_events_source)

    def test_delayed_matching_uses_authenticated_http_task_to_publish_pubsub(self):
        source = read("dataflow/pipelines/streaming/transforms/scheduling.py")

        self.assertNotIn("PubsubTarget", source)
        self.assertIn("pubsub.googleapis.com/v1/{pubsub_topic_path}:publish", source)
        self.assertIn("OAuthToken", source)
        self.assertIn("OidcToken", source)
        self.assertIn("service_account_email", source)
        self.assertIn("with_outputs(ScheduleDelayedMatchingDoFn.ERROR_TAG", source)
        self.assertIn("with_outputs(HandleMatchActionsDoFn.ERROR_TAG", source)

    def test_matching_branch_only_embeds_verified_processed_profiles(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        profile_processing_source = read("dataflow/pipelines/streaming/transforms/profile_processing.py")

        self.assertIn("ParseAnswerToStatements", streaming_source)
        self.assertIn("processed_profile_data  # verified profiles only", streaming_source)
        self.assertNotIn("parsed_event_data  # Use parsed_event_data directly. Input: {'user_id', 'question_id', 'question_text', 'answer_text', ...}", streaming_source)
        self.assertIn("'question_id': event_dict.get('question_id')", profile_processing_source)
        self.assertIn("'answer_text': event_dict.get('answer_text')", profile_processing_source)
        self.assertIn("'question_text': event_dict.get('question_text')", profile_processing_source)

    def test_profile_processing_errors_are_tagged_and_written_to_dlq(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        profile_processing_source = read("dataflow/pipelines/streaming/transforms/profile_processing.py")

        self.assertIn("FetchProfileDoFn.OUTPUT_ERROR_TAG", profile_processing_source)
        self.assertIn("ValidateProfileDoFn.OUTPUT_ERROR_TAG", profile_processing_source)
        self.assertIn("FetchProfiles" , profile_processing_source)
        self.assertIn(".with_outputs(FetchProfileDoFn.OUTPUT_ERROR_TAG, main='main')", profile_processing_source)
        self.assertIn(".with_outputs(ValidateProfileDoFn.OUTPUT_ERROR_TAG, main='main')", profile_processing_source)
        self.assertIn("FlattenProfileProcessingErrors", profile_processing_source)
        self.assertIn("processed_profile_results =", streaming_source)
        self.assertIn("processed_profile_results.error | \"DLQ_ProfileProcessingErrors\" >> dlq_sink(\"ProfileProcessingErrors\")", streaming_source)
        self.assertIn("processed_profile_data = processed_profile_results.main", streaming_source)
        self.assertNotIn("raise\n", profile_processing_source)

    def test_profile_processing_setup_failures_are_tagged_not_generic(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        profile_processing_source = read("dataflow/pipelines/streaming/transforms/profile_processing.py")

        for class_name in ("FetchProfileDoFn", "ValidateProfileDoFn"):
            self.assertIn(f"class {class_name}", profile_processing_source)
            self.assertIn(f"{class_name}.OUTPUT_ERROR_TAG", profile_processing_source)
            self.assertIn(f"{class_name} setup failed", profile_processing_source)

        self.assertIn("setup_error_message", profile_processing_source)
        self.assertIn("error_message = self.setup_error_message or \"FetchProfileDoFn setup failed\"", profile_processing_source)
        self.assertIn("error_message = self.setup_error_message or \"ValidateProfileDoFn setup failed\"", profile_processing_source)
        self.assertIn("raise RuntimeError(error_message)", profile_processing_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", profile_processing_source)
        self.assertIn(".with_outputs(FetchProfileDoFn.OUTPUT_ERROR_TAG, main='main')", profile_processing_source)
        self.assertIn(".with_outputs(ValidateProfileDoFn.OUTPUT_ERROR_TAG, main='main')", profile_processing_source)
        self.assertIn("processed_profile_results.error | \"DLQ_ProfileProcessingErrors\" >> dlq_sink(\"ProfileProcessingErrors\")", streaming_source)
        self.assertNotIn("FetchProfileDoFn Firestore client setup failed", profile_processing_source)
        self.assertNotIn("ValidateProfileDoFn Firestore client setup failed", profile_processing_source)
        self.assertNotIn("FetchProfileDoFn: Firestore client not initialized", profile_processing_source)
        self.assertNotIn("ValidateProfileDoFn: Firestore client not initialized", profile_processing_source)
        self.assertNotIn("Firestore client not available for verification check", profile_processing_source)

    def test_match_hard_filters_reject_ineligible_candidates_even_with_high_score(self):
        eligibility = importlib.import_module("dataflow.pipelines.streaming.transforms.eligibility")

        triggering_profile = {
            "id": "u1",
            "gender": "female",
            "lookingFor": ["male"],
            "age": 30,
            "preferences": {"ageRange": {"min": 28, "max": 38}},
            "blockedUserIds": [],
            "userMetadata": {"acceptedTerms": True},
        }
        valid_candidate = {
            "id": "u2",
            "gender": "male",
            "lookingFor": ["female"],
            "age": 33,
            "userMetadata": {"acceptedTerms": True},
        }
        wrong_gender_candidate = {**valid_candidate, "id": "u3", "gender": "female"}
        blocked_candidate = {**valid_candidate, "id": "u4", "blockedUserIds": ["u1"]}
        unverified_identity = {"status": "pending"}
        verified = {"status": "verified"}

        self.assertTrue(eligibility.is_candidate_hard_eligible(triggering_profile, valid_candidate, verified, verified))
        self.assertFalse(eligibility.is_candidate_hard_eligible(triggering_profile, wrong_gender_candidate, verified, verified))
        self.assertFalse(eligibility.is_candidate_hard_eligible(triggering_profile, blocked_candidate, verified, verified))
        self.assertFalse(eligibility.is_candidate_hard_eligible(triggering_profile, valid_candidate, unverified_identity, verified))

    def test_embedding_and_pinecone_query_carry_hard_filter_metadata(self):
        embedding_source = read("dataflow/pipelines/streaming/transforms/embedding.py")
        pinecone_source = read("dataflow/pipelines/streaming/transforms/pinecone_ops.py")
        scoreboard_source = read("dataflow/pipelines/streaming/transforms/scoreboard.py")

        self.assertIn("build_match_metadata", embedding_source)
        self.assertIn("build_pinecone_hard_filter", pinecone_source)
        self.assertIn("is_candidate_hard_eligible", scoreboard_source)
        self.assertIn("candidate_identity_verification_coll", scoreboard_source)
        self.assertIn("candidate_wali_verification_coll", scoreboard_source)

    def test_lying_score_setup_failures_are_tagged_not_raised(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        reranking_source = read("dataflow/pipelines/streaming/transforms/reranking.py")

        self.assertIn("class CalculateLyingScoreDoFn", reranking_source)
        self.assertIn("class UpdateLyingScoreDoFn", reranking_source)
        self.assertGreaterEqual(reranking_source.count("OUTPUT_ERROR_TAG = 'error'"), 2)
        self.assertIn("setup_error_message", reranking_source)
        self.assertIn("CalculateLyingScoreDoFn setup failed", reranking_source)
        self.assertIn("UpdateLyingScoreDoFn setup failed", reranking_source)
        self.assertIn("error_message = self.setup_error_message or \"CalculateLyingScoreDoFn setup failed\"", reranking_source)
        self.assertIn("error_message = self.setup_error_message or \"UpdateLyingScoreDoFn setup failed\"", reranking_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", reranking_source)
        self.assertIn(".with_outputs(CalculateLyingScoreDoFn.OUTPUT_ERROR_TAG, main='main')", streaming_source)
        self.assertIn(".with_outputs(UpdateLyingScoreDoFn.OUTPUT_ERROR_TAG, main='main')", streaming_source)
        self.assertIn("lying_score_errors | \"DLQ_LyingScoreErrors\" >> dlq_sink(\"LyingScoreErrors\")", streaming_source)
        self.assertIn("update_lying_score_errors | \"DLQ_UpdateLyingScoreErrors\" >> dlq_sink(\"UpdateLyingScoreErrors\")", streaming_source)
        self.assertNotIn("Failed CalculateLyingScoreDoFn setup: {e}", reranking_source)
        self.assertNotIn("Failed UpdateLyingScoreDoFn setup: {e}", reranking_source)
        self.assertNotIn("raise\n\n    def process(self, element):", reranking_source)
        self.assertNotIn("Setup failed for CalculateLyingScoreDoFn", reranking_source)
        self.assertNotIn("Setup failed for UpdateLyingScoreDoFn", reranking_source)

    def test_cross_encoder_setup_failures_are_tagged_not_raised(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        reranking_source = read("dataflow/pipelines/streaming/transforms/reranking.py")

        self.assertIn("class CrossEncodeDoFn", reranking_source)
        self.assertIn("CrossEncodeDoFn.OUTPUT_ERROR_TAG", reranking_source)
        self.assertIn("CrossEncodeDoFn setup failed", reranking_source)
        self.assertIn("error_message = self.setup_error_message or \"CrossEncodeDoFn setup failed\"", reranking_source)
        self.assertIn("partial_profile_fetch_errors = []", reranking_source)
        self.assertIn("partial_profile_fetch_error_message = f\"CrossEncodeDoFn summary fetch failed", reranking_source)
        self.assertIn("'partial_profile_fetch_failure': True", reranking_source)
        self.assertIn("'profile_role': 'triggering_user'", reranking_source)
        self.assertIn("'profile_role': 'candidate'", reranking_source)
        self.assertIn("CrossEncodeDoFn candidate profile text unavailable", reranking_source)
        self.assertIn("'fallback_cross_encoder_score': -1.0", reranking_source)
        self.assertIn("'partial_profile_text_failure': True", reranking_source)
        self.assertIn("for partial_profile_fetch_error in partial_profile_fetch_errors:", reranking_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, partial_profile_fetch_error)", reranking_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", reranking_source)
        self.assertIn(".with_outputs(CrossEncodeDoFn.OUTPUT_ERROR_TAG, main='main')", reranking_source)
        self.assertIn("cross_encoded_candidates_results.error | \"DLQ_CrossEncodeErrors\" >> dlq_sink(\"CrossEncodeErrors\")", streaming_source)
        self.assertNotIn("Failed CrossEncodeDoFn setup: {e}", reranking_source)
        self.assertNotIn("raise # Critical setup failure", reranking_source)
        self.assertNotIn("\"error_message\": \"DoFn not initialized\"", reranking_source)
        self.assertNotIn("# Do not increment profile_fetch_error_counter here yet, as fallback might succeed.", reranking_source)

    def test_llm_reranker_setup_failures_are_tagged_not_raised(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        reranking_source = read("dataflow/pipelines/streaming/transforms/reranking.py")

        self.assertIn("class RerankMatchesDoFn", reranking_source)
        self.assertIn("RerankMatchesDoFn.OUTPUT_ERROR_TAG", reranking_source)
        self.assertIn("RerankMatchesDoFn setup failed", reranking_source)
        self.assertIn("error_message = self.setup_error_message or \"RerankMatchesDoFn setup failed\"", reranking_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", reranking_source)
        self.assertIn("partial_rerank_profile_fetch_errors = []", reranking_source)
        self.assertIn("'partial_profile_fetch_failure': True", reranking_source)
        self.assertIn("'profile_role': 'candidate'", reranking_source)
        self.assertIn("'fallback_ai_score': 0", reranking_source)
        self.assertIn("partial_rerank_llm_errors = []", reranking_source)
        self.assertIn("'partial_llm_rerank_failure': True", reranking_source)
        self.assertIn("'fallback_ai_score': ai_score", reranking_source)
        self.assertIn("'fallback_suggested_questions': suggested_questions", reranking_source)
        self.assertIn("for partial_rerank_profile_fetch_error in partial_rerank_profile_fetch_errors:", reranking_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, partial_rerank_profile_fetch_error)", reranking_source)
        self.assertIn("for partial_rerank_llm_error in partial_rerank_llm_errors:", reranking_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, partial_rerank_llm_error)", reranking_source)
        self.assertNotIn("return 0, [] \n", reranking_source)
        self.assertNotIn("return 0, []\n", reranking_source)
        self.assertIn(".with_outputs(RerankMatchesDoFn.OUTPUT_ERROR_TAG, main='main')", reranking_source)
        self.assertIn("reranked_matches_data_results.error | \"DLQ_LLMRerankingErrors\" >> dlq_sink(\"LLMRerankingErrors\")", streaming_source)
        self.assertNotIn("Failed RerankMatchesDoFn setup: {e}", reranking_source)
        self.assertNotIn("raise RuntimeError(\"Setup failed for RerankMatchesDoFn\")", reranking_source)
        self.assertNotIn("Failed to read PDF instructions", reranking_source)
        self.assertNotIn("raise\n\n    def _fetch_profile", reranking_source)

    def test_llm_rerank_input_format_errors_are_tagged_not_silently_dropped(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        formatter_path = REPO_ROOT / "dataflow/pipelines/streaming/transforms/llm_rerank_input.py"
        self.assertTrue(formatter_path.exists(), "LLM rerank input formatter transform must exist")
        formatter_source = formatter_path.read_text()

        self.assertIn("class FormatForLLMRerankDoFn", formatter_source)
        self.assertIn("FormatForLLMRerankDoFn.OUTPUT_ERROR_TAG", formatter_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", formatter_source)
        self.assertIn('"error_message": "Missing cross-encoded candidates for LLM rerank"', formatter_source)
        self.assertIn('"operation": "format_for_llm_rerank"', formatter_source)
        self.assertIn('"triggering_user_id": triggering_user_id', formatter_source)
        self.assertIn('"grouped_data": grouped_data', formatter_source)
        self.assertIn("PrepareForLLMRerank", formatter_source)
        self.assertIn("prepared_for_llm_rerank_results.error | \"DLQ_FormatForLLMRerankErrors\" >> dlq_sink(\"FormatForLLMRerankErrors\")", streaming_source)
        self.assertIn("prepared_for_llm_rerank = prepared_for_llm_rerank_results.main", streaming_source)
        self.assertNotIn("class FormatForLLMRerankDoFn(beam.DoFn):", streaming_source)
        self.assertNotIn("Skipping LLM rerank", streaming_source)

    def test_answer_parsing_setup_and_llm_failures_are_tagged_not_silently_main(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        answer_parsing_source = read("dataflow/pipelines/streaming/transforms/answer_parsing.py")

        self.assertIn("ParseAnswerStatementsDoFn.OUTPUT_ERROR_TAG", answer_parsing_source)
        self.assertIn("setup_error_message", answer_parsing_source)
        self.assertIn("ParseAnswerStatementsDoFn setup failed", answer_parsing_source)
        self.assertIn("error_message = self.setup_error_message or \"ParseAnswerStatementsDoFn setup failed\"", answer_parsing_source)
        self.assertIn("if not self.client:\n            error_message = self.setup_error_message or \"ParseAnswerStatementsDoFn setup failed\"\n            raise RuntimeError(error_message)", answer_parsing_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", answer_parsing_source)
        self.assertIn("raise RuntimeError(f\"LLM call failed for answer parsing", answer_parsing_source)
        self.assertIn("parse_error_message", answer_parsing_source)
        self.assertIn("statements, parse_error_message = self._parse_llm_response_for_statements", answer_parsing_source)
        self.assertIn("if parse_error_message:\n                    raise RuntimeError(parse_error_message)", answer_parsing_source)
        self.assertIn("ParseAnswerStatementsDoFn response parse failed", answer_parsing_source)
        self.assertIn("parsed_statements_results.error | \"DLQ_ParseStatementsErrors\" >> dlq_sink(\"ParseStatementsErrors\")", streaming_source)
        self.assertNotIn("Failed to setup OpenAI client for answer parsing: {e}", answer_parsing_source)
        self.assertNotIn("Answer parsing OpenAI client setup failed", answer_parsing_source)
        self.assertNotIn("OpenAI client not initialized for answer parsing", answer_parsing_source)
        self.assertNotIn("OpenAI client for answer parsing is not initialized", answer_parsing_source)
        self.assertNotIn("return []\n        except Exception as e:\n            self.logger.error(f\"LLM call failed for answer parsing", answer_parsing_source)

    def test_answer_parsing_invalid_input_shape_is_tagged_before_field_access(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        answer_parsing_source = read("dataflow/pipelines/streaming/transforms/answer_parsing.py")

        self.assertIn("ParseAnswerStatementsDoFn.OUTPUT_ERROR_TAG", answer_parsing_source)
        self.assertIn("if not isinstance(element, dict):", answer_parsing_source)
        self.assertIn('"error_message": "Invalid answer parsing input shape"', answer_parsing_source)
        self.assertIn('"element": element', answer_parsing_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", answer_parsing_source)
        self.assertIn("parsed_statements_results.error | \"DLQ_ParseStatementsErrors\" >> dlq_sink(\"ParseStatementsErrors\")", streaming_source)
        self.assertLess(
            answer_parsing_source.index("if not isinstance(element, dict):"),
            answer_parsing_source.index("user_id = element.get('user_id')"),
        )

    def test_statement_embedding_errors_are_tagged_and_written_to_dlq(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        embedding_source = read("dataflow/pipelines/streaming/transforms/embedding.py")

        self.assertIn("GenerateStatementEmbeddingsDoFn.OUTPUT_ERROR_TAG", embedding_source)
        self.assertIn("setup_error_message", embedding_source)
        self.assertIn("GenerateStatementEmbeddingsDoFn setup failed", embedding_source)
        self.assertIn("error_message = self.setup_error_message or \"GenerateStatementEmbeddingsDoFn setup failed\"", embedding_source)
        self.assertIn("raise RuntimeError(error_message)", embedding_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", embedding_source)
        self.assertIn("parsed_statements = element.get('parsed_statements')", embedding_source)
        self.assertIn("if parsed_statements is None:", embedding_source)
        self.assertIn('"error_message": "Missing parsed_statements for statement embedding"', embedding_source)
        self.assertIn("if not isinstance(parsed_statements, list):", embedding_source)
        self.assertIn('"error_message": "Invalid parsed_statements shape for statement embedding"', embedding_source)
        self.assertNotIn("parsed_statements = element.get('parsed_statements', [])", embedding_source)
        self.assertIn(".with_outputs(GenerateStatementEmbeddingsDoFn.OUTPUT_ERROR_TAG, main='main')", embedding_source)
        self.assertIn("return SimpleNamespace(main=embedding_results.main, error=embedding_results[GenerateStatementEmbeddingsDoFn.OUTPUT_ERROR_TAG])", embedding_source)
        self.assertIn("statement_embedding_results =", streaming_source)
        self.assertIn("statement_embedding_results.error | \"DLQ_StatementEmbeddingErrors\" >> dlq_sink(\"StatementEmbeddingErrors\")", streaming_source)
        self.assertIn("statement_embeddings = statement_embedding_results.main", streaming_source)
        self.assertNotIn("statement_embeddings = (\n            stale_vector_cleanup_results.main", streaming_source)
        self.assertNotIn("Failed to setup OpenAI client for statement embedding: {e}", embedding_source)
        self.assertNotIn("Statement embedding OpenAI client setup failed", embedding_source)
        self.assertNotIn("OpenAI client not initialized for statement embedding", embedding_source)
        self.assertNotIn("OpenAI client for embedding is not initialized", embedding_source)

    def test_statement_embedding_rejects_invalid_facets_before_embedding(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        embedding_source = read("dataflow/pipelines/streaming/transforms/embedding.py")

        self.assertIn("GenerateStatementEmbeddingsDoFn.OUTPUT_ERROR_TAG", embedding_source)
        self.assertIn("if facet not in ('attribute', 'preference'):", embedding_source)
        self.assertIn('"error_message": "Invalid statement facet for embedding"', embedding_source)
        self.assertIn('"statement": statement_data', embedding_source)
        self.assertIn('"statement_index": stmt_index', embedding_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", embedding_source)
        self.assertIn("statement_embedding_results.error | \"DLQ_StatementEmbeddingErrors\" >> dlq_sink(\"StatementEmbeddingErrors\")", streaming_source)
        self.assertLess(
            embedding_source.index("if facet not in ('attribute', 'preference'):"),
            embedding_source.index("embedding_vector = self._get_embedding(text_to_embed)"),
        )

    def test_firestore_indexes_include_matching_production_queries(self):
        indexes = read("firestore.indexes.json")

        self.assertIn('"collectionGroup": "QA_EDIT_LOGS"', indexes)
        self.assertIn('"fieldPath": "userId"', indexes)
        self.assertIn('"fieldPath": "questionId"', indexes)
        self.assertIn('"fieldPath": "createdAt"', indexes)
        self.assertIn('"collectionGroup": "MATCHING_EVENT_OUTBOX"', indexes)
        self.assertIn('"fieldPath": "status"', indexes)

    def test_scoreboard_cleanup_removes_stale_question_evidence_before_reembedding(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        scoreboard_source = read("dataflow/pipelines/streaming/transforms/scoreboard.py")

        self.assertIn("DeleteStaleScoreboardEvidence", streaming_source)
        self.assertLess(
            streaming_source.index('| "DeleteStaleScoreboardEvidence"'),
            streaming_source.index('| "DeleteStaleQuestionVectors"'),
        )
        self.assertIn("class DeleteStaleScoreboardEvidenceDoFn", scoreboard_source)
        self.assertIn("triggering_original_question_id", scoreboard_source)
        self.assertIn("transaction.delete(evidence_ref", scoreboard_source)
        self.assertIn("transaction.delete(candidate_doc_ref", scoreboard_source)
        self.assertIn("_score_from_remaining_evidence_docs", scoreboard_source)

    def test_scoreboard_setup_failures_are_tagged_not_raised(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        scoreboard_source = read("dataflow/pipelines/streaming/transforms/scoreboard.py")

        for class_name in (
            "DeleteStaleScoreboardEvidenceDoFn",
            "UpdateScoreboardDoFn",
            "FetchTopCandidatesDoFn",
        ):
            self.assertIn(f"class {class_name}", scoreboard_source)
            self.assertIn(f"{class_name} setup failed", scoreboard_source)

        self.assertIn("setup_error_message", scoreboard_source)
        self.assertIn("error_message = self.setup_error_message or \"DeleteStaleScoreboardEvidenceDoFn setup failed\"", scoreboard_source)
        self.assertIn("error_message = self.setup_error_message or \"UpdateScoreboardDoFn setup failed\"", scoreboard_source)
        self.assertIn("error_message = self.setup_error_message or \"FetchTopCandidatesDoFn setup failed\"", scoreboard_source)
        self.assertIn("raise RuntimeError(error_message)", scoreboard_source)
        self.assertIn(".with_outputs(DeleteStaleScoreboardEvidenceDoFn.OUTPUT_ERROR_TAG, main='main')", scoreboard_source)
        self.assertIn(".with_outputs(UpdateScoreboardDoFn.OUTPUT_ERROR_TAG, main='main')", scoreboard_source)
        self.assertIn(".with_outputs(FetchTopCandidatesDoFn.OUTPUT_ERROR_TAG, main='main')", scoreboard_source)
        self.assertIn("stale_scoreboard_cleanup_results.error | \"DLQ_StaleScoreboardCleanupErrors\" >> dlq_sink(\"StaleScoreboardCleanupErrors\")", streaming_source)
        self.assertIn("scoreboard_update_results.error | \"DLQ_ScoreboardUpdateErrors\" >> dlq_sink(\"ScoreboardUpdateErrors\")", streaming_source)
        self.assertIn("top_candidates_for_reranking_results.error | \"DLQ_FetchTopCandidatesErrors\" >> dlq_sink(\"FetchCandidatesErrors\")", streaming_source)
        self.assertNotIn("Failed to initialize Firestore client in setup", scoreboard_source)
        self.assertNotIn("Firestore client failed to initialize", scoreboard_source)
        self.assertNotIn("Firestore client not initialized in process", scoreboard_source)
        self.assertNotIn("Firestore client not initialized in scoreboard cleanup", scoreboard_source)

    def test_scoreboard_candidate_fetch_dlqs_missing_triggering_profile(self):
        scoreboard_source = read("dataflow/pipelines/streaming/transforms/scoreboard.py")

        self.assertIn('"error_message": "Triggering profile unavailable for candidate fetch"', scoreboard_source)
        self.assertIn('"triggering_user_id": triggering_user_id', scoreboard_source)
        self.assertIn('"operation": "fetch_triggering_profile"', scoreboard_source)
        self.assertIn('yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {', scoreboard_source)
        self.assertNotIn("triggering profile {triggering_user_id} not found or unavailable; skipping candidates", scoreboard_source)
        self.assertNotIn("yield (triggering_user_id, [])\n                return\n\n            self.logger.info(f\"Fetching top", scoreboard_source)

    def test_candidate_fetch_waits_for_successful_scoreboard_updates(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")

        self.assertIn("scoreboard_update_results.main", streaming_source)
        self.assertIn("ExtractTriggeringUserIdAfterScoreboardUpdate", streaming_source)
        self.assertIn("DistinctTriggeringUsersAfterScoreboardUpdate", streaming_source)
        self.assertNotIn(
            "processed_profile_data\n            | \"ExtractTriggeringUserIdForScoreboardFetch\"",
            streaming_source,
        )
        self.assertLess(
            streaming_source.index('| "UpdateMatchScoreboard"'),
            streaming_source.index('| "ExtractTriggeringUserIdAfterScoreboardUpdate"'),
        )
        self.assertLess(
            streaming_source.index('| "ExtractTriggeringUserIdAfterScoreboardUpdate"'),
            streaming_source.index('| "FetchTopCandidatesFromScoreboard"'),
        )

    def test_scoreboard_update_trigger_user_extraction_errors_are_tagged(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        extraction_path = REPO_ROOT / "dataflow/pipelines/streaming/transforms/scoreboard_update_input.py"
        self.assertTrue(extraction_path.exists(), "scoreboard update input transform must exist")
        extraction_source = extraction_path.read_text()

        self.assertIn("class ExtractTriggeringUserIdAfterScoreboardUpdateDoFn", extraction_source)
        self.assertIn("ExtractTriggeringUserIdAfterScoreboardUpdateDoFn.OUTPUT_ERROR_TAG", extraction_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", extraction_source)
        self.assertIn('"operation": "extract_triggering_user_after_scoreboard_update"', extraction_source)
        self.assertIn('"Missing triggering_user_id after scoreboard update"', extraction_source)
        self.assertIn('"element": element', extraction_source)
        self.assertIn("triggering_user_extraction_results.error | \"DLQ_ScoreboardTriggerUserExtractionErrors\" >> dlq_sink(\"ScoreboardTriggerUserExtractionErrors\")", streaming_source)
        self.assertIn("distinct_triggering_users = (\n            triggering_user_extraction_results.main", streaming_source)
        self.assertNotIn("beam.Map(lambda x: x['triggering_user_id'])", streaming_source)

    def test_final_match_eligibility_setup_failures_are_tagged_not_raised(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        final_gate_source = read("dataflow/pipelines/streaming/transforms/final_eligibility.py")

        self.assertIn("class FinalMatchEligibilityGateDoFn", final_gate_source)
        self.assertIn("FinalMatchEligibilityGateDoFn.OUTPUT_ERROR_TAG", final_gate_source)
        self.assertIn("setup_error_message", final_gate_source)
        self.assertIn("FinalMatchEligibilityGateDoFn setup failed", final_gate_source)
        self.assertIn("error_message = self.setup_error_message or \"FinalMatchEligibilityGateDoFn setup failed\"", final_gate_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", final_gate_source)
        self.assertIn(".with_outputs(FinalMatchEligibilityGateDoFn.OUTPUT_ERROR_TAG, main=\"main\")", final_gate_source)
        self.assertIn("final_match_eligibility_results.error | \"DLQ_FinalMatchEligibilityErrors\" >> dlq_sink(\"FinalMatchEligibilityErrors\")", streaming_source)
        self.assertNotIn("Failed FinalMatchEligibilityGateDoFn setup", final_gate_source)
        self.assertNotIn("raise RuntimeError(f\"FinalMatchEligibilityGateDoFn Firestore setup failed", final_gate_source)
        self.assertNotIn("Firestore client not initialized in final eligibility gate", final_gate_source)

    def test_final_match_eligibility_dlqs_missing_triggering_profile(self):
        final_gate_source = read("dataflow/pipelines/streaming/transforms/final_eligibility.py")

        self.assertIn('"error_message": "Triggering profile unavailable for final eligibility gate"', final_gate_source)
        self.assertIn('"operation": "fetch_triggering_profile"', final_gate_source)
        self.assertIn('"triggering_user_id": user_id', final_gate_source)
        self.assertIn('"matches": matches', final_gate_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {", final_gate_source)
        self.assertNotIn('filtered_element = {**element, "matches": []}', final_gate_source)
        self.assertNotIn("yield filtered_element\n                return", final_gate_source)

    def test_final_selection_input_flatten_errors_are_tagged_not_inline_unchecked(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        flatten_path = REPO_ROOT / "dataflow/pipelines/streaming/transforms/final_selection_input.py"
        self.assertTrue(flatten_path.exists(), "final selection input flatten transform must exist")
        flatten_source = flatten_path.read_text()

        self.assertIn("class FlattenFinalSelectionInputDoFn", flatten_source)
        self.assertIn("FlattenFinalSelectionInputDoFn.OUTPUT_ERROR_TAG", flatten_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", flatten_source)
        self.assertIn('"operation": "flatten_final_selection_input"', flatten_source)
        self.assertIn('"Invalid final selection grouped data"', flatten_source)
        self.assertIn('"Invalid candidates/history grouped payload"', flatten_source)
        self.assertIn('"user_id": user_id', flatten_source)
        self.assertIn('"element": element', flatten_source)
        self.assertIn("FlattenFinalSelectionInput", flatten_source)
        self.assertIn("flattened_input_results.error | \"DLQ_FlattenFinalSelectionInputErrors\" >> dlq_sink(\"FlattenFinalSelectionInputErrors\")", streaming_source)
        self.assertIn("flattened_input_for_final_selection = flattened_input_results.main", streaming_source)
        self.assertNotIn("class FlattenFinalSelectionInputDoFn(beam.DoFn):", streaming_source)

    def test_match_percentage_calculation_errors_are_tagged_not_logged_only(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        percentage_path = REPO_ROOT / "dataflow/pipelines/streaming/transforms/match_percentage.py"
        self.assertTrue(percentage_path.exists(), "match percentage transform must exist")
        percentage_source = percentage_path.read_text()

        self.assertIn("class CalculateAdjustedTopMatchPercentageDoFn", percentage_source)
        self.assertIn("CalculateAdjustedTopMatchPercentageDoFn.OUTPUT_ERROR_TAG", percentage_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", percentage_source)
        self.assertIn("normalize_ai_score_to_unit", percentage_source)
        self.assertIn('"Invalid user_qas shape for match percentage calculation"', percentage_source)
        self.assertIn('"Invalid top match shape for match percentage calculation"', percentage_source)
        self.assertIn('"operation": "calculate_adjusted_top_match_percentage"', percentage_source)
        self.assertIn("CalculateAdjustedTopMatchPercentage", streaming_source)
        self.assertIn("match_percentage_results.error | \"DLQ_MatchPercentageErrors\" >> dlq_sink(\"MatchPercentageErrors\")", streaming_source)
        self.assertIn("matches_with_percentage = match_percentage_results.main", streaming_source)
        self.assertNotIn("def calculate_adjusted_top_match_percentage(element):", streaming_source)
        self.assertNotIn("Error calculating adjusted top score", streaming_source)

    def test_final_match_write_and_actions_are_authoritatively_eligibility_gated(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        final_gate_path = REPO_ROOT / "dataflow/pipelines/streaming/transforms/final_eligibility.py"
        self.assertTrue(final_gate_path.exists(), "final eligibility gate module must exist")
        final_gate_source = final_gate_path.read_text()

        self.assertIn("ApplyFinalMatchEligibilityGate", streaming_source)
        self.assertLess(
            streaming_source.index('| "ApplyFinalMatchEligibilityGate"'),
            streaming_source.index('| "CalculateAdjustedTopMatchPercentage"'),
        )
        self.assertLess(
            streaming_source.index('| "ApplyFinalMatchEligibilityGate"'),
            streaming_source.index('| "WriteMatchesToFirestore"'),
        )
        self.assertLess(
            streaming_source.index('| "ApplyFinalMatchEligibilityGate"'),
            streaming_source.index('| "ScheduleDelayedMatching"'),
        )
        self.assertLess(
            streaming_source.index('| "ApplyFinalMatchEligibilityGate"'),
            streaming_source.index('| "HandleMatchActions"'),
        )
        self.assertIn("class FinalMatchEligibilityGateDoFn", final_gate_source)
        self.assertIn("is_candidate_hard_eligible", final_gate_source)
        self.assertIn("candidate_identity_verification_coll", final_gate_source)
        self.assertIn("candidate_wali_verification_coll", final_gate_source)
        self.assertIn("match.get('id')", final_gate_source)
        self.assertIn("filtered_matches", final_gate_source)

    def test_empty_final_matches_are_written_but_do_not_trigger_side_effects(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")
        side_effect_path = REPO_ROOT / "dataflow/pipelines/streaming/transforms/match_side_effect_input.py"
        self.assertTrue(side_effect_path.exists(), "side-effect input filter transform must exist")
        side_effect_source = side_effect_path.read_text()

        self.assertIn("matches_with_percentage", streaming_source)
        self.assertIn("non_empty_matches_for_side_effects", streaming_source)
        self.assertIn("class FilterNonEmptyMatchesForSideEffectsDoFn", side_effect_source)
        self.assertIn("FilterNonEmptyMatchesForSideEffectsDoFn.OUTPUT_ERROR_TAG", side_effect_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG", side_effect_source)
        self.assertIn('"operation": "filter_non_empty_matches_for_side_effects"', side_effect_source)
        self.assertIn('"Malformed match write output before side effects"', side_effect_source)
        self.assertIn("matches=matches", side_effect_source)
        self.assertIn("side_effect_filter_results.error | \"DLQ_MatchSideEffectInputErrors\" >> dlq_sink(\"MatchSideEffectInputErrors\")", streaming_source)
        self.assertIn("non_empty_matches_for_side_effects = side_effect_filter_results.main", streaming_source)
        self.assertNotIn("beam.Filter(lambda element: bool(element.get('matches')))", streaming_source)
        self.assertLess(
            streaming_source.index('| "CalculateAdjustedTopMatchPercentage"'),
            streaming_source.index('| "WriteMatchesToFirestore"'),
        )
        self.assertLess(
            streaming_source.index('| "CalculateAdjustedTopMatchPercentage"'),
            streaming_source.index('| "FilterNonEmptyMatchesForSideEffects"'),
        )
        self.assertLess(
            streaming_source.index('| "FilterNonEmptyMatchesForSideEffects"'),
            streaming_source.index('| "ScheduleDelayedMatching"'),
        )
        self.assertLess(
            streaming_source.index('| "FilterNonEmptyMatchesForSideEffects"'),
            streaming_source.index('| "HandleMatchActions"'),
        )
        schedule_block = streaming_source[
            streaming_source.index("schedule_results = ("):
            streaming_source.index("schedule_errors = schedule_results.error")
        ]
        action_block = streaming_source[
            streaming_source.index("action_results = ("):
            streaming_source.index("action_errors = action_results.error")
        ]
        self.assertIn("non_empty_matches_for_side_effects", schedule_block)
        self.assertIn("non_empty_matches_for_side_effects", action_block)

    def test_final_match_write_guard_is_idempotent_and_freshness_aware(self):
        guard = importlib.import_module("dataflow.pipelines.streaming.transforms.match_write_guard")
        base_element = {
            "user_id": "user-a",
            "matches": [
                {
                    "id": "match-a",
                    "ai_score": 92,
                    "scoreboard_score": 0.83,
                    "sourceScoreboardUpdatedAt": "2026-06-20T11:00:00Z",
                }
            ],
            "topMatchPercentage": 88,
            "rawTopMatchAiScore": 0.92,
        }
        reordered_element = {
            "rawTopMatchAiScore": 0.92,
            "matches": [dict(reversed(list(base_element["matches"][0].items())))],
            "topMatchPercentage": 88,
            "user_id": "user-a",
        }

        fingerprint = guard.build_match_write_fingerprint(base_element)

        self.assertEqual(fingerprint, guard.build_match_write_fingerprint(reordered_element))
        self.assertEqual(
            guard.extract_match_write_source_version(base_element),
            "2026-06-20T11:00:00Z",
        )
        self.assertTrue(guard.should_apply_match_write({}, "2026-06-20T11:00:00Z", fingerprint))
        self.assertFalse(guard.should_apply_match_write(
            {
                "matchWriteFingerprint": fingerprint,
                "matchWriteSourceVersion": "2026-06-20T11:00:00Z",
            },
            "2026-06-20T11:00:00Z",
            fingerprint,
        ))
        self.assertFalse(guard.should_apply_match_write(
            {"matchWriteSourceVersion": "2026-06-20T12:00:00Z"},
            "2026-06-20T11:00:00Z",
            "older-different-fingerprint",
        ))
        self.assertTrue(guard.should_apply_match_write(
            {"matchWriteSourceVersion": "2026-06-20T10:00:00Z"},
            "2026-06-20T11:00:00Z",
            "newer-different-fingerprint",
        ))

    def test_final_match_writer_audits_guarded_writes_and_side_effects_follow_successful_writes(self):
        firestore_source = read("dataflow/pipelines/streaming/transforms/firestore_io.py")
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")

        self.assertIn("build_match_write_fingerprint", firestore_source)
        self.assertIn("extract_match_write_source_version", firestore_source)
        self.assertIn("should_apply_match_write", firestore_source)
        self.assertIn("doc_ref.get()", firestore_source)
        self.assertIn("matchWriteFingerprint", firestore_source)
        self.assertIn("matchWriteSourceVersion", firestore_source)
        self.assertIn("lastMatchWriteAt", firestore_source)
        self.assertIn("stale_or_duplicate_match_writes_skipped", firestore_source)

        self.assertIn("successful_match_writes = write_match_results.main", streaming_source)
        self.assertIn("non_empty_matches_for_side_effects", streaming_source)
        side_effect_filter_block = streaming_source[
            streaming_source.index("side_effect_filter_results = ("):
            streaming_source.index("# Schedule Delayed Matching")
        ]
        self.assertIn("successful_match_writes", side_effect_filter_block)
        self.assertNotIn("matches_with_percentage", side_effect_filter_block)


if __name__ == "__main__":
    unittest.main()
