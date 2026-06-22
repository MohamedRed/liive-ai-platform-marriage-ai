from dataclasses import dataclass
from typing import Any, Mapping


class MatchVideoAuthorizationError(ValueError):
    """Raised when a supervised video token request is not authorized."""


@dataclass(frozen=True)
class AuthorizedSupervisedVideoRoom:
    room: str
    match_id: str
    wali_id: str


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


def supervised_room_name(user_id: str, match_id: str) -> str:
    first, second = sorted((_room_safe(user_id), _room_safe(match_id)))
    return f"marriage_match_{first}_{second}"


def authorize_supervised_video_room(
    user_id: str,
    match_id: str,
    match_document: Mapping[str, Any] | None,
) -> AuthorizedSupervisedVideoRoom:
    canonical_user_id = _require_string(user_id, "userId")
    canonical_match_id = _require_string(match_id, "matchId")

    if not isinstance(match_document, Mapping):
        raise MatchVideoAuthorizationError("Match document is unavailable")

    matches = match_document.get("matches")
    if not isinstance(matches, list):
        raise MatchVideoAuthorizationError("Match list is unavailable")

    for candidate in matches:
        if not isinstance(candidate, Mapping):
            continue
        if canonical_match_id not in _candidate_ids(candidate):
            continue
        if not _is_accepted(candidate):
            raise MatchVideoAuthorizationError("Match must be accepted before supervised video starts")
        wali_id = _wali_id_from_candidate(candidate)
        if wali_id is None:
            raise MatchVideoAuthorizationError("Accepted match is missing wali authorization")
        return AuthorizedSupervisedVideoRoom(
            room=supervised_room_name(canonical_user_id, canonical_match_id),
            match_id=canonical_match_id,
            wali_id=wali_id,
        )

    raise MatchVideoAuthorizationError("Match is not available for supervised video")
