#!/usr/bin/env python3
"""Preflight checks for the streaming Dataflow Flex Template deployment.

The checks validate configuration shape and cloud resource existence before the
expensive template build/job launch path. Secret checks only describe secret
metadata; this script does not read or print secret values.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from dataclasses import dataclass
from urllib.parse import urlparse


REQUIRED_SECRET_NAMES: tuple[str, ...] = ("OPENAI_API_KEY", "PINECONE_API_KEY")
REQUIRED_COMMANDS: tuple[str, ...] = ("gcloud", "gsutil")
REQUIRED_WORKER_PROJECT_ROLES: tuple[str, ...] = (
    "roles/dataflow.worker",
    "roles/datastore.user",
    "roles/pubsub.subscriber",
    "roles/pubsub.publisher",
    "roles/cloudtasks.enqueuer",
    "roles/secretmanager.secretAccessor",
    "roles/storage.objectAdmin",
    "roles/artifactregistry.reader",
)
PLACEHOLDER_TOKENS: tuple[str, ...] = (
    "YOUR_",
    "your-",
    "your_",
    "example.com",
    "REPLACE",
    "REPLACE_WITH",
    "placeholder",
)


@dataclass(frozen=True)
class CheckResult:
    name: str
    ok: bool
    detail: str


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True)
    parser.add_argument("--region", required=True)
    parser.add_argument("--service-account-email", required=True)
    parser.add_argument("--immediate-topic", required=True)
    parser.add_argument("--delayed-topic", required=True)
    parser.add_argument("--tasks-location", required=True)
    parser.add_argument("--delayed-matching-queue", required=True)
    parser.add_argument("--notification-queue", required=True)
    parser.add_argument("--voice-agent-queue", required=True)
    parser.add_argument("--pdf-bucket", required=True)
    parser.add_argument("--pdf-instructions-path", required=True)
    parser.add_argument("--notification-function-url", required=True)
    parser.add_argument("--voice-agent-function-url", required=True)
    parser.add_argument("--pinecone-index", required=True)
    parser.add_argument("--pinecone-region", required=True)
    parser.add_argument(
        "--skip-cloud-checks",
        action="store_true",
        help="Only validate local command availability and placeholder/config shape.",
    )
    parser.add_argument(
        "--skip-iam-checks",
        action="store_true",
        help=(
            "Skip project-level Dataflow worker IAM role checks. Use only when "
            "least-privilege/resource-level IAM is verified separately."
        ),
    )
    return parser.parse_args(argv)


def has_placeholder(value: str) -> bool:
    return any(token.lower() in value.lower() for token in PLACEHOLDER_TOKENS)


def require_real_value(name: str, value: str) -> CheckResult:
    if not value.strip():
        return CheckResult(name, False, "value is empty")
    if has_placeholder(value):
        return CheckResult(name, False, "value still looks like a placeholder")
    return CheckResult(name, True, "configured")


def require_url(name: str, value: str) -> CheckResult:
    base_result = require_real_value(name, value)
    if not base_result.ok:
        return base_result
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return CheckResult(name, False, "must be an absolute http(s) URL")
    return CheckResult(name, True, "valid URL shape")


def require_command(command: str) -> CheckResult:
    return CheckResult(
        f"command:{command}",
        shutil.which(command) is not None,
        "found" if shutil.which(command) is not None else "not found on PATH",
    )


def topic_resource(project: str, topic: str) -> str:
    return topic if topic.startswith("projects/") else f"projects/{project}/topics/{topic}"


def gcs_pdf_uri(bucket: str, path: str) -> str:
    return f"gs://{bucket.strip('/')}/{path.lstrip('/')}"


def run_cloud_check(name: str, command: list[str], *, command_hint: str) -> CheckResult:
    completed = subprocess.run(command, text=True, capture_output=True, check=False)
    if completed.returncode == 0:
        return CheckResult(name, True, "exists")
    stderr = (completed.stderr or completed.stdout or "").strip().splitlines()
    detail = stderr[-1] if stderr else f"{command_hint} failed with exit {completed.returncode}"
    return CheckResult(name, False, detail)


def worker_iam_checks(project: str, service_account_email: str) -> list[CheckResult]:
    """Verify project-level roles expected by the streaming Dataflow worker.

    This intentionally checks project IAM policy only. Deployments that grant
    equivalent least-privilege resource-level roles can use --skip-iam-checks and
    verify those bindings separately.
    """
    command = [
        "gcloud",
        "projects",
        "get-iam-policy",
        project,
        "--flatten=bindings[].members",
        f"--filter=bindings.members:serviceAccount:{service_account_email}",
        "--format=value(bindings.role)",
    ]
    completed = subprocess.run(command, text=True, capture_output=True, check=False)
    if completed.returncode != 0:
        stderr = (completed.stderr or completed.stdout or "").strip().splitlines()
        detail = stderr[-1] if stderr else "gcloud projects get-iam-policy failed"
        return [CheckResult("worker-iam:policy", False, detail)]

    granted_roles = {
        line.strip()
        for line in completed.stdout.splitlines()
        if line.strip().startswith("roles/")
    }
    checks: list[CheckResult] = []
    for role_name in REQUIRED_WORKER_PROJECT_ROLES:
        checks.append(
            CheckResult(
                f"worker-iam:{role_name}",
                role_name in granted_roles,
                "granted" if role_name in granted_roles else "missing project-level binding",
            )
        )
    return checks


def local_config_checks(args: argparse.Namespace) -> list[CheckResult]:
    checks = [require_command(command) for command in REQUIRED_COMMANDS]
    checks.extend(
        [
            require_real_value("project", args.project),
            require_real_value("region", args.region),
            require_real_value("service_account_email", args.service_account_email),
            require_real_value("immediate_topic", args.immediate_topic),
            require_real_value("delayed_topic", args.delayed_topic),
            require_real_value("tasks_location", args.tasks_location),
            require_real_value("delayed_matching_queue", args.delayed_matching_queue),
            require_real_value("notification_queue", args.notification_queue),
            require_real_value("voice_agent_queue", args.voice_agent_queue),
            require_real_value("pdf_bucket", args.pdf_bucket),
            require_real_value("pdf_instructions_path", args.pdf_instructions_path),
            require_real_value("pinecone_index", args.pinecone_index),
            require_real_value("pinecone_region", args.pinecone_region),
            require_url("notification_function_url", args.notification_function_url),
            require_url("voice_agent_function_url", args.voice_agent_function_url),
        ]
    )
    return checks


def cloud_resource_checks(args: argparse.Namespace) -> list[CheckResult]:
    checks: list[CheckResult] = []

    for secret_name in REQUIRED_SECRET_NAMES:
        # gcloud secrets describe verifies metadata only; it never reads secret values.
        checks.append(
            run_cloud_check(
                f"secret:{secret_name}",
                ["gcloud", "secrets", "describe", secret_name, "--project", args.project],
                command_hint="gcloud secrets describe",
            )
        )

    for label, topic in (
        ("pubsub:immediate", args.immediate_topic),
        ("pubsub:delayed", args.delayed_topic),
    ):
        checks.append(
            run_cloud_check(
                label,
                [
                    "gcloud",
                    "pubsub",
                    "topics",
                    "describe",
                    topic_resource(args.project, topic),
                    "--project",
                    args.project,
                ],
                command_hint="gcloud pubsub topics describe",
            )
        )

    for queue_name in (
        args.delayed_matching_queue,
        args.notification_queue,
        args.voice_agent_queue,
    ):
        checks.append(
            run_cloud_check(
                f"tasks-queue:{queue_name}",
                [
                    "gcloud",
                    "tasks",
                    "queues",
                    "describe",
                    queue_name,
                    "--location",
                    args.tasks_location,
                    "--project",
                    args.project,
                ],
                command_hint="gcloud tasks queues describe",
            )
        )

    checks.append(
        run_cloud_check(
            "service-account",
            [
                "gcloud",
                "iam",
                "service-accounts",
                "describe",
                args.service_account_email,
                "--project",
                args.project,
            ],
            command_hint="gcloud iam service-accounts describe",
        )
    )
    checks.append(
        run_cloud_check(
            "instructions-pdf",
            ["gsutil", "ls", gcs_pdf_uri(args.pdf_bucket, args.pdf_instructions_path)],
            command_hint="gsutil ls",
        )
    )
    return checks


def print_results(results: list[CheckResult]) -> None:
    for result in results:
        status = "ok" if result.ok else "FAIL"
        print(f"[{status}] {result.name}: {result.detail}")


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    results = local_config_checks(args)
    if not args.skip_cloud_checks and all(result.ok for result in results):
        results.extend(cloud_resource_checks(args))
        if not args.skip_iam_checks:
            results.extend(worker_iam_checks(args.project, args.service_account_email))

    print_results(results)
    failures = [result for result in results if not result.ok]
    if failures:
        print(
            f"Streaming deploy preflight failed ({len(failures)} issue(s)). "
            "Fix config/resources before building or launching the template.",
            file=sys.stderr,
        )
        return 1

    print("Streaming deploy preflight passed. Secret values were not read or printed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
