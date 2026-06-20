"""Hard eligibility helpers for Marriage AI matching.

These helpers intentionally stay pure and dependency-light so they can be unit
-tested without Beam, Firestore, Pinecone, or model clients. The matching pipeline
uses them in two places:

1. vector metadata/query filtering to avoid retrieving obviously ineligible
   candidates from Pinecone; and
2. Firestore scoreboard fetch filtering as the authoritative server-side gate
   before cross-encoder/LLM reranking.

The helpers enforce constraints when the relevant profile fields are present and
always fail closed for deleted/hidden/archived profiles, block lists, and required
candidate verification documents.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Iterable, Mapping


TRUE_VALUES = {"true", "1", "yes", "y", "active", "verified"}
FALSE_VALUES = {"false", "0", "no", "n", "inactive", "disabled", "deleted", "hidden", "archived"}
GENDER_ALIASES = {
    "m": "male",
    "man": "male",
    "men": "male",
    "male": "male",
    "f": "female",
    "woman": "female",
    "women": "female",
    "female": "female",
}


def _get_path(data: Mapping[str, Any] | None, path: str) -> Any:
    current: Any = data or {}
    for part in path.split("."):
        if not isinstance(current, Mapping) or part not in current:
            return None
        current = current[part]
    return current


def _first_value(data: Mapping[str, Any] | None, paths: Iterable[str]) -> Any:
    for path in paths:
        value = _get_path(data, path)
        if value is not None and value != "":
            return value
    return None


def _normalize_string(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip().lower()
    return normalized or None


def _normalize_bool(value: Any, default: bool | None = None) -> bool | None:
    if isinstance(value, bool):
        return value
    normalized = _normalize_string(value)
    if normalized in TRUE_VALUES:
        return True
    if normalized in FALSE_VALUES:
        return False
    return default


def _normalize_string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        raw_values = [part.strip() for part in value.replace(";", ",").split(",")]
    elif isinstance(value, Iterable) and not isinstance(value, (Mapping, bytes, bytearray)):
        raw_values = [str(part).strip() for part in value]
    else:
        raw_values = [str(value).strip()]
    return [item.lower() for item in raw_values if item]


def normalize_gender(value: Any) -> str | None:
    normalized = _normalize_string(value)
    if not normalized:
        return None
    return GENDER_ALIASES.get(normalized, normalized)


def profile_id(profile: Mapping[str, Any] | None) -> str | None:
    value = _first_value(profile, ("id", "userId", "uid", "user_id"))
    return str(value) if value is not None and value != "" else None


def profile_gender(profile: Mapping[str, Any] | None) -> str | None:
    return normalize_gender(_first_value(profile, (
        "gender",
        "sex",
        "profile.gender",
        "personalInfo.gender",
        "marriageProfile.gender",
        "demographics.gender",
    )))


def looking_for_genders(profile: Mapping[str, Any] | None) -> list[str]:
    value = _first_value(profile, (
        "lookingFor",
        "looking_for",
        "interestedIn",
        "interested_in",
        "seekingGender",
        "seeking_gender",
        "preferredGender",
        "preferred_gender",
        "preferences.gender",
        "preferences.genders",
        "preferences.lookingFor",
        "matchPreferences.gender",
        "matchPreferences.genders",
        "marriagePreferences.gender",
        "marriagePreferences.genders",
    ))
    return [gender for gender in (normalize_gender(item) for item in _normalize_string_list(value)) if gender]


def profile_country(profile: Mapping[str, Any] | None) -> str | None:
    return _normalize_string(_first_value(profile, (
        "country",
        "address.country",
        "personalInfo.address.country",
        "location.country",
        "profile.location.country",
    )))


def profile_age(profile: Mapping[str, Any] | None, today: date | None = None) -> int | None:
    age_value = _first_value(profile, ("age", "profile.age", "demographics.age"))
    if age_value is not None:
        try:
            age = int(age_value)
            return age if 0 < age < 120 else None
        except (TypeError, ValueError):
            pass

    birth_value = _first_value(profile, (
        "dateOfBirth",
        "date_of_birth",
        "birthDate",
        "birthdate",
        "dob",
        "personalInfo.dateOfBirth",
        "profile.dateOfBirth",
    ))
    if birth_value is None:
        return None

    if today is None:
        today = date.today()
    try:
        if hasattr(birth_value, "date"):
            born = birth_value.date()
        elif hasattr(birth_value, "to_datetime"):
            born = birth_value.to_datetime().date()
        else:
            born = datetime.fromisoformat(str(birth_value).replace("Z", "+00:00")).date()
    except (TypeError, ValueError):
        return None

    age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    return age if 0 < age < 120 else None


def _age_range(profile: Mapping[str, Any] | None) -> tuple[int | None, int | None]:
    value = _first_value(profile, (
        "preferences.ageRange",
        "matchPreferences.ageRange",
        "marriagePreferences.ageRange",
        "lookingForAgeRange",
        "preferredAgeRange",
    ))
    if not isinstance(value, Mapping):
        return None, None

    def parse_int(*keys: str) -> int | None:
        for key in keys:
            raw = value.get(key)
            if raw is not None:
                try:
                    parsed = int(raw)
                    return parsed if 0 < parsed < 120 else None
                except (TypeError, ValueError):
                    return None
        return None

    return parse_int("min", "from", "minimum"), parse_int("max", "to", "maximum")


def is_profile_active(profile: Mapping[str, Any] | None) -> bool:
    if not isinstance(profile, Mapping):
        return False
    metadata_raw = profile.get("userMetadata")
    metadata: Mapping[str, Any] = metadata_raw if isinstance(metadata_raw, Mapping) else {}
    for flag in ("isDeleted", "isHidden", "isArchived", "deleted", "hidden", "archived"):
        value = profile.get(flag, metadata.get(flag))
        if _normalize_bool(value, default=False):
            return False
    status = _normalize_string(_first_value(profile, ("status", "accountStatus", "profileStatus")))
    if status in {"deleted", "hidden", "archived", "suspended", "banned", "disabled"}:
        return False
    return True


def verification_is_verified(document_data: Mapping[str, Any] | None) -> bool:
    if not isinstance(document_data, Mapping):
        return False
    status = _normalize_string(document_data.get("status"))
    return status == "verified"


def _blocked_ids(profile: Mapping[str, Any] | None) -> set[str]:
    blocked = _first_value(profile, (
        "blockedUserIds",
        "blocked_user_ids",
        "blockedUsers",
        "privacy.blockedUserIds",
        "safety.blockedUserIds",
    ))
    return {str(value) for value in _normalize_string_list(blocked)}


def _age_allowed(requesting_profile: Mapping[str, Any], candidate_profile: Mapping[str, Any]) -> bool:
    candidate_age = profile_age(candidate_profile)
    min_age, max_age = _age_range(requesting_profile)
    if candidate_age is None or (min_age is None and max_age is None):
        return True
    if min_age is not None and candidate_age < min_age:
        return False
    if max_age is not None and candidate_age > max_age:
        return False
    return True


def _gender_allowed(requesting_profile: Mapping[str, Any], candidate_profile: Mapping[str, Any]) -> bool:
    requester_gender = profile_gender(requesting_profile)
    candidate_gender = profile_gender(candidate_profile)
    requester_looking_for = looking_for_genders(requesting_profile)
    candidate_looking_for = looking_for_genders(candidate_profile)

    if requester_looking_for and candidate_gender and candidate_gender not in requester_looking_for:
        return False
    if candidate_looking_for and requester_gender and requester_gender not in candidate_looking_for:
        return False
    return True


def is_candidate_hard_eligible(
    triggering_profile: Mapping[str, Any] | None,
    candidate_profile: Mapping[str, Any] | None,
    candidate_identity_verification: Mapping[str, Any] | None,
    candidate_wali_verification: Mapping[str, Any] | None,
) -> bool:
    """Return whether a candidate can enter ranking before model scores.

    This is intentionally independent of the semantic/vector score; high model
    scores cannot override deletion/privacy, verification, block, gender, or age
    constraints.
    """
    if not isinstance(triggering_profile, Mapping) or not isinstance(candidate_profile, Mapping):
        return False
    if not is_profile_active(triggering_profile) or not is_profile_active(candidate_profile):
        return False
    if not verification_is_verified(candidate_identity_verification):
        return False
    if not verification_is_verified(candidate_wali_verification):
        return False

    triggering_id = profile_id(triggering_profile)
    candidate_id = profile_id(candidate_profile)
    if triggering_id and candidate_id:
        if candidate_id in _blocked_ids(triggering_profile):
            return False
        if triggering_id in _blocked_ids(candidate_profile):
            return False

    if not _gender_allowed(triggering_profile, candidate_profile):
        return False
    if not _age_allowed(triggering_profile, candidate_profile):
        return False
    if not _age_allowed(candidate_profile, triggering_profile):
        return False
    return True


def build_match_metadata(profile: Mapping[str, Any] | None) -> dict[str, Any]:
    """Extract Pinecone-safe hard-filter metadata from a user profile."""
    metadata: dict[str, Any] = {
        "is_matchable": bool(is_profile_active(profile)),
    }
    gender = profile_gender(profile)
    if gender:
        metadata["gender"] = gender
    looking_for = looking_for_genders(profile)
    if looking_for:
        metadata["looking_for_genders"] = looking_for
    country = profile_country(profile)
    if country:
        metadata["country"] = country
    age = profile_age(profile)
    if age is not None:
        metadata["age"] = age
    return metadata


def build_pinecone_hard_filter(triggering_metadata: Mapping[str, Any], target_facet: str) -> dict[str, Any]:
    """Build a Pinecone metadata filter for cheap hard eligibility pruning.

    Firestore filtering remains authoritative. Pinecone filtering only applies
    constraints that can be represented in vector metadata.
    """
    triggering_user_id = triggering_metadata.get("user_id")
    pinecone_filter: dict[str, Any] = {
        "user_id": {"$ne": str(triggering_user_id)},
        "facet": target_facet,
        "is_matchable": True,
    }

    looking_for = _normalize_string_list(triggering_metadata.get("looking_for_genders"))
    if looking_for:
        pinecone_filter["gender"] = {"$in": looking_for}

    triggering_gender = normalize_gender(triggering_metadata.get("gender"))
    if triggering_gender:
        pinecone_filter["looking_for_genders"] = {"$in": [triggering_gender]}

    country = profile_country(triggering_metadata)
    if country:
        # Conservative locality pruning: when country is indexed, prefer same
        # country before broader reranking. If the product later supports global
        # relocation matching, make this configurable.
        pinecone_filter["country"] = country

    return pinecone_filter
