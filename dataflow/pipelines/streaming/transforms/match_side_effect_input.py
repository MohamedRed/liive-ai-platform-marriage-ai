"""Validation boundary for final match side-effect inputs."""

from __future__ import annotations

import logging
from typing import Any, Dict

import apache_beam as beam
from apache_beam.metrics import Metrics

logger = logging.getLogger(__name__)


class FilterNonEmptyMatchesForSideEffectsDoFn(beam.DoFn):
    """Allows only non-empty final match write records to trigger side effects."""

    OUTPUT_ERROR_TAG = "error"

    def __init__(self):
        self.passed_counter = Metrics.counter(self.__class__.__name__, "non_empty_match_side_effect_inputs")
        self.empty_counter = Metrics.counter(self.__class__.__name__, "empty_match_side_effect_inputs_skipped")
        self.error_counter = Metrics.counter(self.__class__.__name__, "match_side_effect_input_errors")

    def _error_payload(self, error_message: str, element: Any, **context: Any) -> Dict[str, Any]:
        self.error_counter.inc()
        payload = {
            "error_message": error_message,
            "operation": "filter_non_empty_matches_for_side_effects",
            "element": element,
        }
        payload.update(context)
        return payload

    def process(self, element: Dict[str, Any]):
        if not isinstance(element, dict):
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, self._error_payload(
                "Malformed match write output before side effects",
                element,
            ))
            return

        matches = element.get("matches")
        if matches is None:
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, self._error_payload(
                "Malformed match write output before side effects",
                element,
                user_id=element.get("user_id"),
                matches=matches,
            ))
            return

        if not isinstance(matches, list):
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, self._error_payload(
                "Malformed match write output before side effects",
                element,
                user_id=element.get("user_id"),
                matches=matches,
            ))
            return

        if not matches:
            self.empty_counter.inc()
            return

        self.passed_counter.inc()
        yield element


@beam.ptransform_fn
def FilterNonEmptyMatchesForSideEffects(
    pcoll: beam.PCollection[Dict[str, Any]],
) -> beam.PCollectionTuple:
    """Validate and filter final match-write records before side effects."""
    return (
        pcoll
        | "FilterNonEmptyMatchesForSideEffectsRecords" >> beam.ParDo(
            FilterNonEmptyMatchesForSideEffectsDoFn()
        ).with_outputs(FilterNonEmptyMatchesForSideEffectsDoFn.OUTPUT_ERROR_TAG, main="main")
    )
