"""Formatting boundary for LLM reranking input."""

from __future__ import annotations

import logging
from typing import Any, Dict, Tuple

import apache_beam as beam
from apache_beam.metrics import Metrics

logger = logging.getLogger(__name__)


class FormatForLLMRerankDoFn(beam.DoFn):
    """Validates and reshapes CoGroupByKey output for the LLM reranker."""

    OUTPUT_ERROR_TAG = "error"

    def __init__(self, cross_encoded_tag: str, user_history_tag: str):
        self.cross_encoded_tag = cross_encoded_tag
        self.user_history_tag = user_history_tag
        self.success_counter = Metrics.counter(self.__class__.__name__, "llm_rerank_input_formatted")
        self.error_counter = Metrics.counter(self.__class__.__name__, "llm_rerank_input_format_errors")

    def _emit_error(self, error_message: str, triggering_user_id: Any, grouped_data: Any, element: Any, **context: Any):
        self.error_counter.inc()
        payload = {
            "error_message": error_message,
            "operation": "format_for_llm_rerank",
            "triggering_user_id": triggering_user_id,
            "grouped_data": grouped_data,
            "element": element,
        }
        payload.update(context)
        return beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, payload)

    def process(self, element: Tuple[str, Dict[str, Any]]):
        triggering_user_id = None
        grouped_data = None

        if not isinstance(element, tuple) or len(element) != 2:
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": "Invalid CoGroup element for LLM rerank formatting",
                "operation": "format_for_llm_rerank",
                "triggering_user_id": triggering_user_id,
                "grouped_data": grouped_data,
                "element": element,
            })
            return

        triggering_user_id, grouped_data = element
        if not isinstance(grouped_data, dict):
            yield self._emit_error(
                "Invalid grouped data for LLM rerank formatting",
                triggering_user_id,
                grouped_data,
                element,
            )
            return

        cross_encoded_list = grouped_data.get(self.cross_encoded_tag, [])
        user_qas_list = grouped_data.get(self.user_history_tag, [])

        if not cross_encoded_list:
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": "Missing cross-encoded candidates for LLM rerank",
                "operation": "format_for_llm_rerank",
                "triggering_user_id": triggering_user_id,
                "grouped_data": grouped_data,
                "element": element,
            })
            return

        candidates = cross_encoded_list[0]
        if not isinstance(candidates, list):
            yield self._emit_error(
                "Invalid cross-encoded candidates shape for LLM rerank",
                triggering_user_id,
                grouped_data,
                element,
                cross_encoded_candidates=candidates,
            )
            return

        user_qas = user_qas_list[0] if user_qas_list else {}
        if not isinstance(user_qas, (dict, list)):
            yield self._emit_error(
                "Invalid user history shape for LLM rerank",
                triggering_user_id,
                grouped_data,
                element,
                user_qas=user_qas,
            )
            return

        self.success_counter.inc()
        yield (triggering_user_id, {'candidates': candidates, 'user_qas': user_qas})


@beam.ptransform_fn
def PrepareForLLMRerank(
    pcoll: beam.PCollection[Tuple[str, Dict[str, Any]]],
    cross_encoded_tag: str,
    user_history_tag: str,
) -> beam.PCollectionTuple:
    """Validate and format grouped cross-encoder/history output for LLM reranking."""
    return (
        pcoll
        | "FormatForLLMRerank" >> beam.ParDo(
            FormatForLLMRerankDoFn(
                cross_encoded_tag=cross_encoded_tag,
                user_history_tag=user_history_tag,
            )
        ).with_outputs(FormatForLLMRerankDoFn.OUTPUT_ERROR_TAG, main="main")
    )
