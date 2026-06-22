"""Match display percentage enrichment with DLQ-observable failures."""

from __future__ import annotations

import logging
import traceback
from typing import Any, Dict, Iterable

import apache_beam as beam
from apache_beam.metrics import Metrics

from ..common import config
from ..common.definitions import FOUNDATIONAL_LAYER, INSIGHT_LAYER
from .scoring import normalize_ai_score_to_unit

logger = logging.getLogger(__name__)


class CalculateAdjustedTopMatchPercentageDoFn(beam.DoFn):
    """Adds display confidence fields to a reranked match payload.

    Empty match lists are valid and stay on the main path with percentage fields
    set to ``None``/zero. Malformed shapes are data-contract failures: they are
    emitted to the error tag instead of being logged and then partially written to
    Firestore.
    """

    OUTPUT_ERROR_TAG = "error"

    def __init__(self):
        self.success_counter = Metrics.counter(self.__class__.__name__, "match_percentage_success")
        self.empty_matches_counter = Metrics.counter(self.__class__.__name__, "match_percentage_empty_matches")
        self.error_counter = Metrics.counter(self.__class__.__name__, "match_percentage_errors")

    @staticmethod
    def _iter_user_qas(user_qas: Any) -> Iterable[Dict[str, Any]] | None:
        if isinstance(user_qas, dict):
            values = user_qas.values()
        elif isinstance(user_qas, list):
            values = user_qas
        else:
            return None

        normalized_qas = []
        for qa_data in values:
            if not isinstance(qa_data, dict):
                return None
            normalized_qas.append(qa_data)
        return normalized_qas

    @staticmethod
    def _enrich_element(element: Dict[str, Any], raw_top_match_ai_score: float | None,
                        adjusted_top_match_percentage: int | None,
                        core_profile_completeness_factor: float,
                        answered_core_count: int) -> Dict[str, Any]:
        enriched = dict(element)
        enriched['topMatchPercentage'] = adjusted_top_match_percentage
        enriched['rawTopMatchAiScore'] = raw_top_match_ai_score
        enriched['currentUserCoreProfileCompletenessFactor'] = core_profile_completeness_factor
        enriched['currentUserAnsweredCoreQuestionsCount'] = answered_core_count
        enriched['totalCoreQuestionsInSystem'] = config.TOTAL_CORE_QUESTIONS_IN_SYSTEM
        enriched['minConfidenceWeightUsed'] = config.MIN_CONFIDENCE_WEIGHT
        return enriched

    def _error_payload(self, error_message: str, element: Any, **context: Any) -> Dict[str, Any]:
        self.error_counter.inc()
        payload = {
            "error_message": error_message,
            "operation": "calculate_adjusted_top_match_percentage",
            "element": element,
        }
        payload.update(context)
        return payload

    def process(self, element: Dict[str, Any]):
        if not isinstance(element, dict):
            yield beam.pvalue.TaggedOutput(
                self.OUTPUT_ERROR_TAG,
                self._error_payload("Invalid element for match percentage calculation", element),
            )
            return

        user_id = element.get('user_id')
        matches_list = element.get('matches', [])
        user_qas = element.get('user_qas', {})

        if not isinstance(matches_list, list):
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, self._error_payload(
                "Invalid matches shape for match percentage calculation",
                element,
                user_id=user_id,
                matches=matches_list,
            ))
            return

        if not matches_list:
            self.empty_matches_counter.inc()
            yield self._enrich_element(element, None, None, 0.0, 0)
            return

        top_match = matches_list[0]
        if not isinstance(top_match, dict):
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, self._error_payload(
                "Invalid top match shape for match percentage calculation",
                element,
                user_id=user_id,
                top_match=top_match,
            ))
            return

        normalized_user_qas = self._iter_user_qas(user_qas)
        if normalized_user_qas is None:
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, self._error_payload(
                "Invalid user_qas shape for match percentage calculation",
                element,
                user_id=user_id,
                user_qas=user_qas,
            ))
            return

        try:
            raw_top_match_ai_score = normalize_ai_score_to_unit(top_match.get('ai_score'))
            adjusted_top_match_percentage = None
            answered_core_count = 0
            core_profile_completeness_factor = 0.0

            if raw_top_match_ai_score is not None:
                for qa_data in normalized_user_qas:
                    layer = qa_data.get('layer')
                    if layer == FOUNDATIONAL_LAYER or layer == INSIGHT_LAYER:
                        answered_core_count += 1

                if config.TOTAL_CORE_QUESTIONS_IN_SYSTEM > 0:
                    core_profile_completeness_factor = min(
                        1.0,
                        answered_core_count / config.TOTAL_CORE_QUESTIONS_IN_SYSTEM,
                    )
                else:
                    core_profile_completeness_factor = 1.0

                adjusted_percentage_float = raw_top_match_ai_score * (
                    config.MIN_CONFIDENCE_WEIGHT
                    + (1 - config.MIN_CONFIDENCE_WEIGHT) * core_profile_completeness_factor
                )
                adjusted_top_match_percentage = round(adjusted_percentage_float * 100)

            self.success_counter.inc()
            yield self._enrich_element(
                element,
                raw_top_match_ai_score,
                adjusted_top_match_percentage,
                core_profile_completeness_factor,
                answered_core_count,
            )

        except Exception as e:
            self.logger.error(
                "CalculateAdjustedTopMatchPercentageDoFn failed for user %s: %s\nTraceback: %s",
                user_id,
                e,
                traceback.format_exc(),
                exc_info=True,
            )
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, self._error_payload(
                f"Match percentage calculation failed: {str(e)}",
                element,
                user_id=user_id,
                traceback=traceback.format_exc(),
            ))


@beam.ptransform_fn
def CalculateAdjustedTopMatchPercentage(pcoll: beam.PCollection[Dict[str, Any]]) -> beam.PCollectionTuple:
    """Enrich final eligible match payloads with display percentage fields."""
    return (
        pcoll
        | "CalculateAdjustedTopMatchPercentageFields" >> beam.ParDo(
            CalculateAdjustedTopMatchPercentageDoFn()
        ).with_outputs(CalculateAdjustedTopMatchPercentageDoFn.OUTPUT_ERROR_TAG, main="main")
    )
