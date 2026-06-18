"""Pure scoring helpers for the streaming matching pipeline."""

from __future__ import annotations

from numbers import Real


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
