"""Validation boundaries for next-question candidate input shaping."""

from __future__ import annotations

import logging
from typing import Any, Dict, Sequence

import apache_beam as beam
from apache_beam.metrics import Metrics

logger = logging.getLogger(__name__)


class FormatInputForLayer3DoFn(beam.DoFn):
    """Formats scoreboard candidate tuples for Layer 3 question generation."""

    OUTPUT_ERROR_TAG = "error"

    def __init__(self):
        self.success_counter = Metrics.counter(self.__class__.__name__, "layer3_inputs_formatted")
        self.error_counter = Metrics.counter(self.__class__.__name__, "layer3_input_format_errors")

    def _error_payload(self, error_message: str, element: Any, **context: Any) -> Dict[str, Any]:
        self.error_counter.inc()
        payload = {
            "error_message": error_message,
            "operation": "format_input_for_layer3",
            "element": element,
        }
        payload.update(context)
        return payload

    def process(self, element: Sequence[Any]):
        if not isinstance(element, (tuple, list)) or len(element) != 2:
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, self._error_payload(
                "Malformed Layer 3 input",
                element,
            ))
            return

        user_id = element[0]
        matches = element[1]

        if not user_id or not isinstance(matches, list):
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, self._error_payload(
                "Malformed Layer 3 input",
                element,
                user_id=user_id,
                matches=matches,
            ))
            return

        self.success_counter.inc()
        yield {
            "user_id": user_id,
            "matches": matches,
        }


@beam.ptransform_fn
def FormatInputForLayer3(pcoll: beam.PCollection[Sequence[Any]]) -> beam.PCollectionTuple:
    """Validate and format top-candidate tuples for Layer 3 question generation."""
    return (
        pcoll
        | "FormatInputForLayer3Records" >> beam.ParDo(
            FormatInputForLayer3DoFn()
        ).with_outputs(FormatInputForLayer3DoFn.OUTPUT_ERROR_TAG, main="main")
    )
