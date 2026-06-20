#!/usr/bin/env python3
"""Smoke-test import-time dependencies for the streaming Dataflow runtime.

This script intentionally performs import checks only. It does not initialize
Firestore, Secret Manager, Pinecone, OpenAI, Cloud Tasks, or SentenceTransformer
models, so it is safe for CI and Flex Template build checks without credentials.
"""

from __future__ import annotations

import importlib
import sys
from dataclasses import dataclass


@dataclass(frozen=True)
class RuntimeModule:
    module: str
    package_hint: str


REQUIRED_RUNTIME_MODULES: tuple[RuntimeModule, ...] = (
    RuntimeModule("apache_beam", "apache-beam[gcp]"),
    RuntimeModule("google.cloud.firestore", "google-cloud-firestore"),
    RuntimeModule("google.cloud.pubsub", "google-cloud-pubsub"),
    RuntimeModule("google.cloud.tasks_v2", "google-cloud-tasks"),
    RuntimeModule("google.cloud.storage", "google-cloud-storage"),
    RuntimeModule("google.cloud.secretmanager", "google-cloud-secret-manager"),
    RuntimeModule("google.protobuf.timestamp_pb2", "protobuf"),
    RuntimeModule("pinecone", "pinecone[grpc]"),
    RuntimeModule("openai", "openai"),
    RuntimeModule("sentence_transformers", "sentence-transformers"),
    RuntimeModule("PyPDF2", "pypdf2"),
)


def check_runtime_imports() -> list[str]:
    """Return human-readable failures for missing import-time dependencies."""
    failures: list[str] = []
    for runtime_module in REQUIRED_RUNTIME_MODULES:
        try:
            importlib.import_module(runtime_module.module)
        except Exception as exc:  # pragma: no cover - message path is what CI needs
            failures.append(
                f"{runtime_module.module} import failed: {exc!r} "
                f"(install/check {runtime_module.package_hint})"
            )
    return failures


def main() -> int:
    failures = check_runtime_imports()
    if failures:
        print("Streaming Dataflow runtime smoke failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1
    print(f"Streaming Dataflow runtime smoke passed ({len(REQUIRED_RUNTIME_MODULES)} imports).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
