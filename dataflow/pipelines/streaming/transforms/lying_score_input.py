"""Formatting boundary for lying-score calculation input."""

from __future__ import annotations

import logging
from typing import Any, Dict

import apache_beam as beam
from apache_beam.metrics import Metrics

logger = logging.getLogger(__name__)


class FormatForLyingScoreDoFn(beam.DoFn):
    """Validates parsed trigger events before lying-score calculation."""

    OUTPUT_ERROR_TAG = "error"

    def __init__(self):
        self.success_counter = Metrics.counter(self.__class__.__name__, "lying_score_input_formatted")
        self.error_counter = Metrics.counter(self.__class__.__name__, "lying_score_input_format_errors")

    def _error_payload(self, error_message: str, element: Any, **context: Any) -> Dict[str, Any]:
        self.error_counter.inc()
        payload = {
            "error_message": error_message,
            "operation": "format_for_lying_score",
            "element": element,
        }
        payload.update(context)
        return payload

    def process(self, element: Dict[str, Any]):
        if not isinstance(element, dict):
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, self._error_payload(
                "Invalid element for lying score input",
                element,
            ))
            return

        user_id = element.get('user_id')
        question_id = element.get('question_id')
        answer_text = element.get('answer_text')
        question_text = element.get('question_text')

        if not user_id or not question_id or answer_text is None:
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, self._error_payload(
                "Missing fields for lying score input",
                element,
                user_id=user_id,
                question_id=question_id,
                answer_text=answer_text,
            ))
            return

        self.success_counter.inc()
        yield {
            "profile_id": user_id,
            "qa_id": question_id,
            "qa_data": {
                "question": question_text,
                "answer": answer_text,
            },
        }


@beam.ptransform_fn
def FormatForLyingScore(pcoll: beam.PCollection[Dict[str, Any]]) -> beam.PCollectionTuple:
    """Validate and format parsed trigger events for lying-score calculation."""
    return (
        pcoll
        | "FormatForLyingScoreRecords" >> beam.ParDo(
            FormatForLyingScoreDoFn()
        ).with_outputs(FormatForLyingScoreDoFn.OUTPUT_ERROR_TAG, main="main")
    )
