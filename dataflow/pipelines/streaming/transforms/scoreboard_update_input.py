"""Formatting boundaries for scoreboard update outputs."""

from __future__ import annotations

import logging
from typing import Any, Dict

import apache_beam as beam
from apache_beam.metrics import Metrics

logger = logging.getLogger(__name__)


class ExtractTriggeringUserIdAfterScoreboardUpdateDoFn(beam.DoFn):
    """Extracts triggering user IDs from successful scoreboard update records."""

    OUTPUT_ERROR_TAG = "error"

    def __init__(self):
        self.success_counter = Metrics.counter(self.__class__.__name__, "triggering_user_ids_extracted")
        self.error_counter = Metrics.counter(self.__class__.__name__, "triggering_user_id_extraction_errors")

    def _error_payload(self, error_message: str, element: Any, **context: Any) -> Dict[str, Any]:
        self.error_counter.inc()
        payload = {
            "error_message": error_message,
            "operation": "extract_triggering_user_after_scoreboard_update",
            "element": element,
        }
        payload.update(context)
        return payload

    def process(self, element: Dict[str, Any]):
        if not isinstance(element, dict):
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, self._error_payload(
                "Invalid scoreboard update output element",
                element,
            ))
            return

        triggering_user_id = element.get("triggering_user_id")
        if not triggering_user_id:
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, self._error_payload(
                "Missing triggering_user_id after scoreboard update",
                element,
            ))
            return

        self.success_counter.inc()
        yield str(triggering_user_id)


@beam.ptransform_fn
def ExtractTriggeringUserIdAfterScoreboardUpdate(
    pcoll: beam.PCollection[Dict[str, Any]],
) -> beam.PCollectionTuple:
    """Validate scoreboard update records and extract triggering user ids."""
    return (
        pcoll
        | "ExtractTriggeringUserIdAfterScoreboardUpdateRecords" >> beam.ParDo(
            ExtractTriggeringUserIdAfterScoreboardUpdateDoFn()
        ).with_outputs(ExtractTriggeringUserIdAfterScoreboardUpdateDoFn.OUTPUT_ERROR_TAG, main="main")
    )
