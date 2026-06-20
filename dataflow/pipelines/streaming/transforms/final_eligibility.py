"""Final authoritative eligibility gate before match writes/actions.

Scoreboard fetch already applies hard eligibility before model reranking, but a
candidate can become ineligible after that point (deleted/hidden, verification
revoked, block list changed, etc.). This transform re-checks the database after
cross-encoder/LLM reranking and before final Firestore writes, delayed matching,
or notification/voice actions.
"""

from __future__ import annotations

import logging
import traceback
from typing import Any, Dict

import apache_beam as beam
from apache_beam.metrics import Metrics
from google.cloud import firestore

from .eligibility import is_candidate_hard_eligible
from ..common.definitions import COLLECTIONS

logger = logging.getLogger(__name__)


class FinalMatchEligibilityGateDoFn(beam.DoFn):
    """Filters reranked matches through the live authoritative hard gate."""

    OUTPUT_ERROR_TAG = "error"

    def __init__(self, project_id: str):
        self.project_id = project_id
        self.db = None
        self.logger = logging.getLogger(__name__)
        self.filtered_counter = Metrics.counter(self.__class__.__name__, "final_ineligible_matches_filtered")
        self.passed_counter = Metrics.counter(self.__class__.__name__, "final_eligible_matches_passed")
        self.error_counter = Metrics.counter(self.__class__.__name__, "final_eligibility_errors")
        self.profiles_collection = COLLECTIONS["USERS"]["USER_INFO"]
        self.candidate_identity_verification_coll = COLLECTIONS["MARRIAGE"]["IDENTITY_VERIFICATIONS"]
        self.candidate_wali_verification_coll = COLLECTIONS["MARRIAGE"]["USER_WALI_RELATION_VERIFICATIONS"]

    def setup(self):
        try:
            self.db = firestore.Client(project=self.project_id)
            self.logger.info("FinalMatchEligibilityGateDoFn setup complete for project %s", self.project_id)
        except Exception as e:
            self.logger.error("Failed FinalMatchEligibilityGateDoFn setup: %s", e, exc_info=True)
            raise RuntimeError(f"FinalMatchEligibilityGateDoFn Firestore setup failed: {e}") from e

    def _fetch_doc_data(self, collection_name: str, document_id: str) -> Dict[str, Any] | None:
        if not self.db:
            return None
        doc = self.db.collection(collection_name).document(str(document_id)).get()
        if not doc.exists:
            return None
        data = doc.to_dict() or {}
        data.setdefault("id", str(document_id))
        return data

    def _match_is_still_eligible(self, triggering_profile: Dict[str, Any], match: Dict[str, Any]) -> bool:
        matched_user_id = match.get('id')
        if not matched_user_id:
            return False
        candidate_profile = self._fetch_doc_data(self.profiles_collection, matched_user_id)
        candidate_identity_verification = self._fetch_doc_data(self.candidate_identity_verification_coll, matched_user_id)
        candidate_wali_verification = self._fetch_doc_data(self.candidate_wali_verification_coll, matched_user_id)
        return is_candidate_hard_eligible(
            triggering_profile=triggering_profile,
            candidate_profile=candidate_profile,
            candidate_identity_verification=candidate_identity_verification,
            candidate_wali_verification=candidate_wali_verification,
        )

    def process(self, element: Dict[str, Any]):
        if not self.db:
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": "Firestore client not initialized in final eligibility gate",
                "element": element,
            })
            return

        if not isinstance(element, dict) or "user_id" not in element or "matches" not in element:
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": "Invalid element for final eligibility gate",
                "element": element,
            })
            return

        user_id = str(element.get("user_id"))
        matches = element.get("matches") or []
        if not isinstance(matches, list):
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": "matches must be a list for final eligibility gate",
                "element": element,
            })
            return

        try:
            triggering_profile = self._fetch_doc_data(self.profiles_collection, user_id)
            if not triggering_profile:
                self.logger.warning(
                    "FinalMatchEligibilityGateDoFn: triggering profile %s missing; filtering all matches.",
                    user_id,
                )
                filtered_element = {**element, "matches": []}
                if matches:
                    self.filtered_counter.inc(len(matches))
                yield filtered_element
                return

            filtered_matches = []
            removed_count = 0
            for match in matches:
                if not isinstance(match, dict):
                    removed_count += 1
                    continue
                if self._match_is_still_eligible(triggering_profile, match):
                    filtered_matches.append(match)
                else:
                    removed_count += 1
                    self.logger.info(
                        "FinalMatchEligibilityGateDoFn: filtered ineligible final match %s for user %s.",
                        match.get('id'),
                        user_id,
                    )

            if removed_count:
                self.filtered_counter.inc(removed_count)
            if filtered_matches:
                self.passed_counter.inc(len(filtered_matches))
            yield {**element, "matches": filtered_matches}

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(
                "FinalMatchEligibilityGateDoFn failed for user %s: %s\nTraceback: %s",
                user_id,
                e,
                traceback.format_exc(),
                exc_info=True,
            )
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": f"Final eligibility gate failed: {str(e)}",
                "element": element,
                "traceback": traceback.format_exc(),
            })


@beam.ptransform_fn
def ApplyFinalMatchEligibilityGate(pcoll: beam.PCollection[Dict[str, Any]], project_id: str) -> beam.PCollectionTuple:
    """Re-check hard eligibility after LLM reranking and before side effects."""
    return (
        pcoll
        | "FilterFinalMatchesByEligibility" >> beam.ParDo(
            FinalMatchEligibilityGateDoFn(project_id=project_id)
        ).with_outputs(FinalMatchEligibilityGateDoFn.OUTPUT_ERROR_TAG, main="main")
    )
