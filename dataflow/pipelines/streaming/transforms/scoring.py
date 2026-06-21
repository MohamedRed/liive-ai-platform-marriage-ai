"""Pure scoring helpers for the streaming matching pipeline."""

from __future__ import annotations

import hashlib
from numbers import Real
from typing import Any, Mapping


DEFAULT_WEIGHT_PREFERENCE_FULFILLMENT = 1.0
DEFAULT_WEIGHT_ATTRIBUTE_SIMILARITY = 0.4
_VALID_MATCH_TYPES = {"AP", "PA", "AA"}


def normalize_ai_score_to_unit(score: object) -> float | None:
    """Normalize an LLM compatibility score to the inclusive 0.0-1.0 range.

    The reranker returns compatibility on a 0-100 scale, while the downstream
    display-confidence formula expects a 0-1 unit value. This helper also accepts
    already-normalized 0-1 scores so legacy callers and tests can migrate safely.
    """
    if score is None:
        return None
    if not isinstance(score, Real) or isinstance(score, bool):
        try:
            score = float(score)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return None

    score_float = float(score)
    if score_float > 1.0:
        score_float = score_float / 100.0
    return max(0.0, min(1.0, score_float))


def normalize_similarity_score(score: object) -> float | None:
    """Normalize a vector/cross-encoder similarity score to 0.0-1.0.

    Matching evidence should never decrease a candidate's total because of an
    out-of-range or negative score from an upstream model. Unknown/unparseable
    values are skipped by returning None.
    """
    if score is None:
        return None
    if not isinstance(score, Real) or isinstance(score, bool):
        try:
            score = float(score)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return None
    return max(0.0, min(1.0, float(score)))


def calculate_weighted_match_score(
    pinecone_score: object,
    match_type: str,
    weight_preference_fulfillment: float = DEFAULT_WEIGHT_PREFERENCE_FULFILLMENT,
    weight_attribute_similarity: float = DEFAULT_WEIGHT_ATTRIBUTE_SIMILARITY,
) -> float | None:
    """Return the weighted contribution for one statement-level match hit.

    AP/PA hits are preference-fulfillment evidence. AA hits are weaker attribute
    similarity evidence. Unknown match types return None so callers can route the
    hit to DLQ instead of writing a misleading zero-score candidate.
    """
    normalized_score = normalize_similarity_score(pinecone_score)
    if normalized_score is None or match_type not in _VALID_MATCH_TYPES:
        return None

    if match_type in {"AP", "PA"}:
        return normalized_score * float(weight_preference_fulfillment)
    return normalized_score * float(weight_attribute_similarity)


def calculate_candidate_compatibility_score(total_evidence_score: Any, evidence_count: Any) -> float | None:
    """Return a normalized candidate compatibility score from evidence.

    The scoreboard can accumulate multiple statement-level evidence rows for the
    same candidate. Ranking by the raw sum rewards users for having more matched
    statements, not necessarily higher compatibility. The production scoreboard
    keeps evidence_count for confidence/observability but ranks by the bounded
    average compatibility contribution.
    """
    try:
        parsed_evidence_count = int(evidence_count)
    except (TypeError, ValueError):
        return None
    if parsed_evidence_count <= 0:
        return None
    try:
        average_score = float(total_evidence_score) / parsed_evidence_count
    except (TypeError, ValueError, ZeroDivisionError):
        return None
    return max(0.0, min(1.0, average_score))


def stable_match_evidence_id(match_hit: Mapping[str, object]) -> str | None:
    """Create a stable Firestore document id for statement-level match evidence.

    Reprocessing the same Pub/Sub/Dataflow event must overwrite the same evidence
    document, not increment a candidate's score again. The id includes both users,
    both statement ids, and match type so repeated pipeline runs are idempotent
    while distinct pieces of evidence remain separate.
    """
    required_fields = (
        "triggering_user_id",
        "matched_user_id",
        "triggering_statement_id",
        "matched_statement_id",
        "match_type",
    )
    values = []
    for field in required_fields:
        value = match_hit.get(field)
        if value is None or str(value) == "":
            return None
        values.append(str(value))

    material = "\x1f".join(values).encode("utf-8")
    return hashlib.sha256(material).hexdigest()
