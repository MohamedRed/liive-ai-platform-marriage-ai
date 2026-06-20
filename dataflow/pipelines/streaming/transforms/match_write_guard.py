"""Pure helpers for idempotent and freshness-aware final match writes.

These functions intentionally avoid Beam/Firestore imports so they can be tested
in the lightweight production-readiness suite. The Beam writer uses them to skip
stale or duplicate final match writes before any downstream side effects run.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Mapping

FINGERPRINT_FIELDS = (
    "user_id",
    "matches",
    "topMatchPercentage",
    "rawTopMatchAiScore",
    "currentUserCoreProfileCompletenessFactor",
    "currentUserAnsweredCoreQuestionsCount",
    "totalCoreQuestionsInSystem",
    "minConfidenceWeightUsed",
    "matchWriteSourceVersion",
    "sourceScoreboardMaxUpdatedAt",
)

SOURCE_VERSION_FIELDS = (
    "matchWriteSourceVersion",
    "sourceScoreboardMaxUpdatedAt",
    "scoreboardMaxUpdatedAt",
)

MATCH_SOURCE_VERSION_FIELDS = (
    "sourceScoreboardUpdatedAt",
    "scoreboardUpdatedAt",
    "last_updated",
    "lastUpdated",
)

EXISTING_SOURCE_VERSION_FIELDS = (
    "matchWriteSourceVersion",
    "sourceScoreboardMaxUpdatedAt",
)


def _datetime_to_utc_iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    value = value.astimezone(timezone.utc).replace(microsecond=value.microsecond)
    return value.isoformat().replace("+00:00", "Z")


def normalize_source_version(value: Any) -> str | None:
    """Return a stable comparable string for timestamps/versions when possible."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return _datetime_to_utc_iso(value)
    if hasattr(value, "to_datetime"):
        try:
            return _datetime_to_utc_iso(value.to_datetime())
        except Exception:
            pass
    seconds = getattr(value, "seconds", None)
    nanos = getattr(value, "nanos", None)
    if seconds is not None:
        try:
            nanos_value = int(nanos or 0)
            return _datetime_to_utc_iso(datetime.fromtimestamp(float(seconds) + nanos_value / 1e9, tz=timezone.utc))
        except Exception:
            pass
    return str(value)


def _version_sort_key(value: Any) -> tuple[int, Any]:
    normalized = normalize_source_version(value)
    if normalized is None:
        return (0, "")
    parse_candidate = normalized.replace("Z", "+00:00")
    try:
        return (3, datetime.fromisoformat(parse_candidate).timestamp())
    except ValueError:
        pass
    try:
        return (2, float(normalized))
    except ValueError:
        return (1, normalized)


def latest_source_version(values: list[Any] | tuple[Any, ...]) -> str | None:
    normalized_values = [normalize_source_version(value) for value in values]
    normalized_values = [value for value in normalized_values if value is not None]
    if not normalized_values:
        return None
    return max(normalized_values, key=_version_sort_key)


def _canonicalize(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {str(key): _canonicalize(value[key]) for key in sorted(value.keys(), key=str)}
    if isinstance(value, (list, tuple)):
        return [_canonicalize(item) for item in value]
    normalized_version = normalize_source_version(value)
    if isinstance(value, datetime) or hasattr(value, "to_datetime") or getattr(value, "seconds", None) is not None:
        return normalized_version
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def canonical_match_write_payload(element: Mapping[str, Any]) -> dict[str, Any]:
    """Return only the fields that define the persisted final match result."""
    payload = {field: element.get(field) for field in FINGERPRINT_FIELDS if field in element}
    source_version = extract_match_write_source_version(element)
    if source_version is not None:
        payload["matchWriteSourceVersion"] = source_version
    return _canonicalize(payload)


def build_match_write_fingerprint(element: Mapping[str, Any]) -> str:
    canonical_payload = canonical_match_write_payload(element)
    encoded = json.dumps(canonical_payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def extract_match_write_source_version(element: Mapping[str, Any] | None) -> str | None:
    if not isinstance(element, Mapping):
        return None
    versions: list[Any] = []
    for field in SOURCE_VERSION_FIELDS:
        if field in element:
            versions.append(element.get(field))
    matches = element.get("matches")
    if isinstance(matches, list):
        for match in matches:
            if not isinstance(match, Mapping):
                continue
            for field in MATCH_SOURCE_VERSION_FIELDS:
                if field in match:
                    versions.append(match.get(field))
    return latest_source_version(tuple(versions))


def existing_match_write_source_version(existing_data: Mapping[str, Any] | None) -> str | None:
    if not isinstance(existing_data, Mapping):
        return None
    versions = [existing_data.get(field) for field in EXISTING_SOURCE_VERSION_FIELDS if field in existing_data]
    return latest_source_version(tuple(versions))


def should_apply_match_write(
    existing_data: Mapping[str, Any] | None,
    incoming_source_version: Any,
    incoming_fingerprint: str,
) -> bool:
    """Return False for duplicate writes or incoming results older than stored state."""
    if not isinstance(existing_data, Mapping) or not existing_data:
        return True
    if existing_data.get("matchWriteFingerprint") == incoming_fingerprint:
        return False
    existing_source_version = existing_match_write_source_version(existing_data)
    incoming_normalized_version = normalize_source_version(incoming_source_version)
    if existing_source_version and incoming_normalized_version:
        if _version_sort_key(existing_source_version) > _version_sort_key(incoming_normalized_version):
            return False
    return True
