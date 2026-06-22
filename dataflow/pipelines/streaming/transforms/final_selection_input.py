"""Formatting boundary for final next-question selection inputs."""

from __future__ import annotations

import logging
from typing import Any, Dict, Tuple

import apache_beam as beam
from apache_beam.metrics import Metrics

logger = logging.getLogger(__name__)


class FlattenFinalSelectionInputDoFn(beam.DoFn):
    """Validates and flattens nested CoGroupByKey data for final question selection."""

    OUTPUT_ERROR_TAG = "error"

    def __init__(
        self,
        layer1_tag: str,
        layer2_tag: str,
        layer3_tag: str,
        layer4_tag: str,
        history_tag: str,
        reranking_results_tag: str,
        candidates_history_group_key: str = "candidates_and_history_grouped",
    ):
        self.layer1_tag = layer1_tag
        self.layer2_tag = layer2_tag
        self.layer3_tag = layer3_tag
        self.layer4_tag = layer4_tag
        self.history_tag = history_tag
        self.reranking_results_tag = reranking_results_tag
        self.candidates_history_group_key = candidates_history_group_key
        self.success_counter = Metrics.counter(self.__class__.__name__, "final_selection_input_flattened")
        self.error_counter = Metrics.counter(self.__class__.__name__, "final_selection_input_flatten_errors")

    def _error_payload(self, error_message: str, user_id: Any, element: Any, **context: Any) -> Dict[str, Any]:
        self.error_counter.inc()
        payload = {
            "error_message": error_message,
            "operation": "flatten_final_selection_input",
            "user_id": user_id,
            "element": element,
        }
        payload.update(context)
        return payload

    @staticmethod
    def _first_list_value(value: Any) -> Any:
        if isinstance(value, list) and value:
            return value[0]
        return None

    def process(self, element: Tuple[str, Dict[str, Any]]):
        user_id = None
        if not isinstance(element, tuple) or len(element) != 2:
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, self._error_payload(
                "Invalid final selection input element",
                user_id,
                element,
            ))
            return

        user_id, grouped_data = element
        if not isinstance(grouped_data, dict):
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, self._error_payload(
                "Invalid final selection grouped data",
                user_id,
                element,
                grouped_data=grouped_data,
            ))
            return

        flat_data = {}
        candidates_history_list = grouped_data.get(self.candidates_history_group_key, [])
        if candidates_history_list:
            nested_dict = self._first_list_value(candidates_history_list)
            if not isinstance(nested_dict, dict):
                yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, self._error_payload(
                    "Invalid candidates/history grouped payload",
                    user_id,
                    element,
                    candidates_history_grouped=candidates_history_list,
                ))
                return

            for tag in (self.layer1_tag, self.layer2_tag, self.layer3_tag, self.layer4_tag, self.history_tag):
                tag_value = nested_dict.get(tag, [])
                if not isinstance(tag_value, list):
                    yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, self._error_payload(
                        "Invalid candidates/history tag payload",
                        user_id,
                        element,
                        tag=tag,
                        tag_value=tag_value,
                    ))
                    return
                flat_data[tag] = tag_value
        else:
            flat_data[self.layer1_tag] = []
            flat_data[self.layer2_tag] = []
            flat_data[self.layer3_tag] = []
            flat_data[self.layer4_tag] = []
            flat_data[self.history_tag] = []

        reranking_results = grouped_data.get(self.reranking_results_tag, [])
        if not isinstance(reranking_results, list):
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, self._error_payload(
                "Invalid reranking results payload for final selection",
                user_id,
                element,
                reranking_results=reranking_results,
            ))
            return

        flat_data[self.reranking_results_tag] = reranking_results
        self.success_counter.inc()
        yield (user_id, flat_data)


@beam.ptransform_fn
def FlattenFinalSelectionInput(
    pcoll: beam.PCollection[Tuple[str, Dict[str, Any]]],
    layer1_tag: str,
    layer2_tag: str,
    layer3_tag: str,
    layer4_tag: str,
    history_tag: str,
    reranking_results_tag: str,
    candidates_history_group_key: str = "candidates_and_history_grouped",
) -> beam.PCollectionTuple:
    """Validate and flatten nested final-selection CoGroupByKey output."""
    return (
        pcoll
        | "FlattenFinalSelectionInputRecords" >> beam.ParDo(
            FlattenFinalSelectionInputDoFn(
                layer1_tag=layer1_tag,
                layer2_tag=layer2_tag,
                layer3_tag=layer3_tag,
                layer4_tag=layer4_tag,
                history_tag=history_tag,
                reranking_results_tag=reranking_results_tag,
                candidates_history_group_key=candidates_history_group_key,
            )
        ).with_outputs(FlattenFinalSelectionInputDoFn.OUTPUT_ERROR_TAG, main="main")
    )
