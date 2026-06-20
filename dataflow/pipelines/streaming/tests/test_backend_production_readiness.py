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

    def test_firestore_match_writer_client_initialization_failures_are_tagged_not_raised(self):
        firestore_source = read("dataflow/pipelines/streaming/transforms/firestore_io.py")

        self.assertIn("UpdateFirestoreDoFn.ERROR_TAG", firestore_source)
        self.assertIn("WriteMatchesToFirestore", firestore_source)
        self.assertIn(".with_outputs(UpdateFirestoreDoFn.ERROR_TAG, main=UpdateFirestoreDoFn.OUTPUT_TAG)", firestore_source)
        self.assertIn("Firestore client not initialized in UpdateFirestoreDoFn", firestore_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.ERROR_TAG", firestore_source)
        self.assertNotIn("raise RuntimeError(\"Setup failed for UpdateFirestoreDoFn\")", firestore_source)
        self.assertNotIn("Failed to initialize Firestore client in UpdateFirestoreDoFn setup: {str(e)}", firestore_source)

    def test_cloud_tasks_side_effect_setup_failures_are_tagged_not_raised(self):
        scheduling_source = read("dataflow/pipelines/streaming/transforms/scheduling.py")

        self.assertIn("ScheduleDelayedMatchingDoFn.ERROR_TAG", scheduling_source)
        self.assertIn("HandleMatchActionsDoFn.ERROR_TAG", scheduling_source)
        self.assertIn(".with_outputs(ScheduleDelayedMatchingDoFn.ERROR_TAG, main=ScheduleDelayedMatchingDoFn.OUTPUT_TAG)", scheduling_source)
        self.assertIn(".with_outputs(HandleMatchActionsDoFn.ERROR_TAG, main=HandleMatchActionsDoFn.OUTPUT_TAG)", scheduling_source)
        self.assertIn("setup_error_message", scheduling_source)
        self.assertIn("yield beam.pvalue.TaggedOutput(self.ERROR_TAG", scheduling_source)
        self.assertNotIn("raise RuntimeError(\"Setup failed for ScheduleDelayedMatchingDoFn\")", scheduling_source)
        self.assertNotIn("raise RuntimeError(\"Setup failed for HandleMatchActionsDoFn\")", scheduling_source)
        self.assertNotIn("Failed ScheduleDelayedMatchingDoFn setup: {e}", scheduling_source)
        self.assertNotIn("Failed HandleMatchActionsDoFn setup: {e}", scheduling_source)

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
        fake_firestore = types.ModuleType("google.cloud.firestore")
        setattr(fake_firestore, "Client", object)

        stubbed_modules = {
            "apache_beam": fake_beam,
            "apache_beam.metrics": fake_metrics,
            "apache_beam.io": fake_io,
            "apache_beam.io.filesystems": fake_filesystems,
            "google.cloud.firestore": fake_firestore,
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

    def test_candidate_fetch_waits_for_successful_scoreboard_updates(self):
        streaming_source = read("dataflow/pipelines/streaming/streaming.py")

        self.assertIn("scoreboard_update_results.main", streaming_source)
        self.assertIn("'triggering_user_id'", streaming_source)
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

        self.assertIn("matches_with_percentage", streaming_source)
        self.assertIn("non_empty_matches_for_side_effects", streaming_source)
        self.assertIn('| "FilterNonEmptyMatchesForSideEffects"', streaming_source)
        self.assertIn("bool(element.get('matches'))", streaming_source)
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
            streaming_source.index("non_empty_matches_for_side_effects = ("):
            streaming_source.index("# Schedule Delayed Matching")
        ]
        self.assertIn("successful_match_writes", side_effect_filter_block)
        self.assertNotIn("matches_with_percentage", side_effect_filter_block)


if __name__ == "__main__":
    unittest.main()
