from dataclasses import dataclass
from typing import Any, Mapping


class MatchVideoAuthorizationError(ValueError):
    """Raised when a supervised video token request is not authorized."""


@dataclass(frozen=True)
class SupervisedVideoCounterpart:
    match_id: str
    matched_user_id: str
    wali_id: str


@dataclass(frozen=True)
class AuthorizedSupervisedVideoRoom:
    room: str
    match_id: str
    matched_user_id: str
    wali_id: str
    matched_user_wali_id: str


def _trimmed_string(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    return trimmed or None


def _require_string(value: Any, field_name: str) -> str:
    trimmed = _trimmed_string(value)
    if trimmed is None:
        raise MatchVideoAuthorizationError(f"{field_name} is required")
    return trimmed


def parse_supervised_video_request(data: Any) -> str:
    if not isinstance(data, Mapping):
        raise MatchVideoAuthorizationError("matchId is required")

    raw_match_id = data.get("matchId", data.get("matchedUserId"))
    return _require_string(raw_match_id, "matchId")


def _candidate_ids(candidate: Mapping[str, Any]) -> set[str]:
    ids: set[str] = set()
    for key in ("id", "matchId", "matchedUserId", "matched_user_id", "userId", "user_id"):
        value = _trimmed_string(candidate.get(key))
        if value is not None:
            ids.add(value)
    return ids


def _matched_user_id_from_candidate(candidate: Mapping[str, Any], fallback_match_id: str) -> str:
    for key in ("matchedUserId", "matched_user_id", "userId", "user_id", "id"):
        value = _trimmed_string(candidate.get(key))
        if value is not None:
            return value
    return fallback_match_id


def _wali_id_from_candidate(candidate: Mapping[str, Any]) -> str | None:
    acceptance = candidate.get("acceptance")
    if isinstance(acceptance, Mapping):
        wali_id = _trimmed_string(acceptance.get("waliId"))
        if wali_id is not None:
            return wali_id
    return _trimmed_string(candidate.get("waliId"))


def _is_accepted(candidate: Mapping[str, Any]) -> bool:
    if candidate.get("status") == "accepted":
        return True
    acceptance = candidate.get("acceptance")
    return isinstance(acceptance, Mapping) and acceptance.get("status") == "accepted"


def _room_safe(value: str) -> str:
    return "".join(char if char.isalnum() or char in {"-", "_"} else "_" for char in value)


def supervised_room_name(user_id: str, matched_user_id: str) -> str:
    first, second = sorted((_room_safe(user_id), _room_safe(matched_user_id)))
    return f"marriage_match_{first}_{second}"


def _matches_list(match_document: Mapping[str, Any] | None) -> list[Any]:
    if not isinstance(match_document, Mapping):
        raise MatchVideoAuthorizationError("Match document is unavailable")

    matches = match_document.get("matches")
    if not isinstance(matches, list):
        raise MatchVideoAuthorizationError("Match list is unavailable")
    return matches


def _find_candidate(matches: list[Any], candidate_id: str) -> Mapping[str, Any] | None:
    for candidate in matches:
        if not isinstance(candidate, Mapping):
            continue
        if candidate_id in _candidate_ids(candidate):
            return candidate
    return None


def resolve_supervised_video_counterpart(
    user_id: str,
    match_id: str,
    match_document: Mapping[str, Any] | None,
) -> SupervisedVideoCounterpart:
    _require_string(user_id, "userId")
    canonical_match_id = _require_string(match_id, "matchId")
    candidate = _find_candidate(_matches_list(match_document), canonical_match_id)

    if candidate is None:
        raise MatchVideoAuthorizationError("Match is not available for supervised video")
    if not _is_accepted(candidate):
        raise MatchVideoAuthorizationError("Match must be accepted before supervised video starts")

    wali_id = _wali_id_from_candidate(candidate)
    if wali_id is None:
        raise MatchVideoAuthorizationError("Accepted match is missing wali authorization")

    return SupervisedVideoCounterpart(
        match_id=canonical_match_id,
        matched_user_id=_matched_user_id_from_candidate(candidate, canonical_match_id),
        wali_id=wali_id,
    )


def _authorize_reciprocal_match(
    user_id: str,
    matched_user_document: Mapping[str, Any] | None,
) -> str:
    if not isinstance(matched_user_document, Mapping):
        raise MatchVideoAuthorizationError("Reciprocal match document is unavailable")

    matches = matched_user_document.get("matches")
    if not isinstance(matches, list):
        raise MatchVideoAuthorizationError("Reciprocal match list is unavailable")

    reciprocal_candidate = _find_candidate(matches, user_id)
    if reciprocal_candidate is None or not _is_accepted(reciprocal_candidate):
        raise MatchVideoAuthorizationError("Missing reciprocal accepted match")

    wali_id = _wali_id_from_candidate(reciprocal_candidate)
    if wali_id is None:
        raise MatchVideoAuthorizationError("Missing reciprocal wali authorization")
    return wali_id


def authorize_supervised_video_room(
    user_id: str,
    match_id: str,
    match_document: Mapping[str, Any] | None,
    matched_user_document: Mapping[str, Any] | None,
) -> AuthorizedSupervisedVideoRoom:
    canonical_user_id = _require_string(user_id, "userId")
    counterpart = resolve_supervised_video_counterpart(canonical_user_id, match_id, match_document)
    matched_user_wali_id = _authorize_reciprocal_match(canonical_user_id, matched_user_document)

    return AuthorizedSupervisedVideoRoom(
        room=supervised_room_name(canonical_user_id, counterpart.matched_user_id),
        match_id=counterpart.match_id,
        matched_user_id=counterpart.matched_user_id,
        wali_id=counterpart.wali_id,
        matched_user_wali_id=matched_user_wali_id,
    )
