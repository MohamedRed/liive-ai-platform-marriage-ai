# apps/marriage-ai/dataflow/pipelines/streaming/transforms/scoreboard.py
import apache_beam as beam
import logging
import traceback
from typing import Dict, Any, Iterable
from apache_beam.metrics import Metrics

from google.cloud import firestore
from google.cloud.firestore import SERVER_TIMESTAMP

from .scoring import (
    DEFAULT_WEIGHT_ATTRIBUTE_SIMILARITY,
    DEFAULT_WEIGHT_PREFERENCE_FULFILLMENT,
    calculate_weighted_match_score,
    stable_match_evidence_id,
)
from .eligibility import is_candidate_hard_eligible
from ..common.definitions import COLLECTIONS

logger = logging.getLogger(__name__)

DEFAULT_SCOREBOARD_COLLECTION = "MATCH_CANDIDATE_SCOREBOARD"
SCOREBOARD_UPDATE_SUCCESS = 'ScoreboardUpdateSuccess'
SCOREBOARD_UPDATE_ERRORS = 'ScoreboardUpdateErrors'

DEFAULT_TOP_N_CANDIDATES = 10


class UpdateScoreboardDoFn(beam.DoFn):
    """Updates a Firestore scoreboard using idempotent match evidence documents.

    Earlier versions incremented candidate scores directly. That made Pub/Sub or
    Dataflow retries inflate compatibility scores because the same statement hit
    could be applied repeatedly. This writer stores each statement-level hit under
    a stable evidence id and recomputes the candidate total from evidence, so
    reprocessing the same hit overwrites evidence instead of double-counting it.
    """

    OUTPUT_ERROR_TAG = 'error'

    def __init__(self, project_id: str,
                 collection_name: str = DEFAULT_SCOREBOARD_COLLECTION,
                 weight_preference_fulfillment: float = DEFAULT_WEIGHT_PREFERENCE_FULFILLMENT,
                 weight_attribute_similarity: float = DEFAULT_WEIGHT_ATTRIBUTE_SIMILARITY):
        self.project_id = project_id
        self.collection_name = collection_name
        self.weight_preference_fulfillment = weight_preference_fulfillment
        self.weight_attribute_similarity = weight_attribute_similarity
        self.db = None
        self.logger = logging.getLogger(__name__)
        self.success_counter = Metrics.counter('UpdateScoreboardDoFn', SCOREBOARD_UPDATE_SUCCESS)
        self.error_counter = Metrics.counter('UpdateScoreboardDoFn', SCOREBOARD_UPDATE_ERRORS)
        self.weighted_score_sum = Metrics.counter(self.__class__.__name__, 'weighted_score_sum')
        self.evidence_count = Metrics.counter(self.__class__.__name__, 'scoreboard_evidence_written')

    def setup(self):
        try:
            self.db = firestore.Client(project=self.project_id)
            self.logger.info(f"UpdateScoreboardDoFn: Firestore client initialized for project {self.project_id}.")
        except Exception as e:
            self.logger.error(f"UpdateScoreboardDoFn: Failed to initialize Firestore client in setup: {str(e)}", exc_info=True)
            raise RuntimeError(f"UpdateScoreboardDoFn: Firestore client failed to initialize: {e}")

    def _candidate_doc_ref(self, triggering_user_id: str, matched_user_id: str):
        return (self.db.collection(self.collection_name)
                .document(triggering_user_id)
                .collection('candidate_scores')
                .document(matched_user_id))

    @staticmethod
    def _score_from_evidence_docs(evidence_docs: Iterable[Any], replacement_evidence_id: str, replacement_score: float) -> tuple[float, int]:
        """Recompute a candidate score from existing evidence plus replacement."""
        total_score = float(replacement_score)
        total_count = 1
        for doc in evidence_docs:
            if getattr(doc, 'id', None) == replacement_evidence_id:
                continue
            data = doc.to_dict() or {}
            score = data.get('weighted_score')
            try:
                total_score += float(score)
                total_count += 1
            except (TypeError, ValueError):
                continue
        return total_score, total_count

    def _write_scoreboard_evidence(self,
                                    triggering_user_id: str,
                                    matched_user_id: str,
                                    evidence_id: str,
                                    weighted_score: float,
                                    element: Dict[str, Any]) -> None:
        candidate_doc_ref = self._candidate_doc_ref(triggering_user_id, matched_user_id)
        evidence_ref = candidate_doc_ref.collection('evidence').document(evidence_id)
        evidence_collection_ref = candidate_doc_ref.collection('evidence')
        transaction = self.db.transaction()

        @firestore.transactional
        def update_in_transaction(transaction):
            existing_evidence_docs = list(evidence_collection_ref.stream(transaction=transaction))
            total_score, evidence_count = self._score_from_evidence_docs(
                existing_evidence_docs,
                evidence_id,
                weighted_score,
            )

            evidence_payload = {
                'weighted_score': float(weighted_score),
                'pinecone_score': element.get('pinecone_score'),
                'match_type': element.get('match_type'),
                'triggering_statement_id': element.get('triggering_statement_id'),
                'triggering_statement_facet': element.get('triggering_statement_facet'),
                'triggering_statement_text': element.get('triggering_statement_text'),
                'triggering_original_question_id': element.get('triggering_original_question_id'),
                'matched_statement_id': element.get('matched_statement_id'),
                'matched_statement_facet': element.get('matched_statement_facet'),
                'matched_statement_text': element.get('matched_statement_text'),
                'matched_original_question_id': element.get('matched_original_question_id'),
                'last_seen': SERVER_TIMESTAMP,
            }
            candidate_payload = {
                'score': float(total_score),
                'evidence_count': evidence_count,
                'last_updated': SERVER_TIMESTAMP,
                'triggering_user_id': triggering_user_id,
                'matched_user_id': matched_user_id,
            }

            transaction.set(evidence_ref, evidence_payload, merge=True)
            transaction.set(candidate_doc_ref, candidate_payload, merge=True)

        update_in_transaction(transaction)

    def process(self, element: Dict[str, Any]):
        """
        Processes a match hit and updates the corresponding score in Firestore.
        Input element is expected to include triggering/matched user ids,
        triggering/matched statement ids, pinecone_score, and match_type.
        """
        if not self.db:
            self.logger.error("UpdateScoreboardDoFn: Firestore client not initialized. Skipping update.")
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {"error_message": "Firestore client not initialized in process", "element": element})
            return

        try:
            triggering_user_id = element.get('triggering_user_id')
            matched_user_id = element.get('matched_user_id')
            pinecone_score = element.get('pinecone_score')
            match_type = element.get('match_type')
            evidence_id = stable_match_evidence_id(element)
            weighted_score = calculate_weighted_match_score(
                pinecone_score,
                match_type,
                self.weight_preference_fulfillment,
                self.weight_attribute_similarity,
            )

            if not triggering_user_id or not matched_user_id or not evidence_id or weighted_score is None:
                self.logger.warning(
                    "UpdateScoreboardDoFn: Missing/invalid required fields for scoreboard update. "
                    f"triggering_user_id={triggering_user_id}, matched_user_id={matched_user_id}, "
                    f"match_type={match_type}, pinecone_score={pinecone_score}, evidence_id={evidence_id}."
                )
                self.error_counter.inc()
                yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {"error_message": "Missing or invalid fields for scoreboard update", "element": element})
                return

            triggering_user_id = str(triggering_user_id)
            matched_user_id = str(matched_user_id)

            self._write_scoreboard_evidence(
                triggering_user_id=triggering_user_id,
                matched_user_id=matched_user_id,
                evidence_id=evidence_id,
                weighted_score=float(weighted_score),
                element=element,
            )

            self.success_counter.inc()
            self.evidence_count.inc()
            self.weighted_score_sum.inc(int(float(weighted_score) * 100))
            yield element

        except Exception as e:
            self.logger.error(f"UpdateScoreboardDoFn: Error updating Firestore for element {element}: {str(e)}\nTraceback: {traceback.format_exc()}", exc_info=True)
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": f"Firestore update failed: {str(e)}",
                "element": element,
                "traceback": traceback.format_exc()
            })


@beam.ptransform_fn
def WriteToScoreboard(pcoll: beam.PCollection[Dict[str, Any]],
                      project_id: str,
                      collection_name: str = DEFAULT_SCOREBOARD_COLLECTION,
                      weight_preference_fulfillment: float = DEFAULT_WEIGHT_PREFERENCE_FULFILLMENT,
                      weight_attribute_similarity: float = DEFAULT_WEIGHT_ATTRIBUTE_SIMILARITY
                      ) -> beam.PCollectionTuple:
    """Write statement-level match evidence and recomputed candidate scores."""
    return (
        pcoll
        | 'UpdateFirestoreScoreboard' >> beam.ParDo(
            UpdateScoreboardDoFn(
                project_id=project_id,
                collection_name=collection_name,
                weight_preference_fulfillment=weight_preference_fulfillment,
                weight_attribute_similarity=weight_attribute_similarity
            )
          ).with_outputs(UpdateScoreboardDoFn.OUTPUT_ERROR_TAG, main='main')
    )


FETCH_CANDIDATES_SUCCESS = 'FetchCandidatesSuccess'
FETCH_CANDIDATES_ERRORS = 'FetchCandidatesErrors'
NO_CANDIDATES_FOUND = 'NoCandidatesFound'


class FetchTopCandidatesDoFn(beam.DoFn):
    """Fetches top N candidates for a user from the Firestore scoreboard."""
    OUTPUT_ERROR_TAG = 'error'

    def __init__(self, project_id: str,
                 collection_name: str = DEFAULT_SCOREBOARD_COLLECTION,
                 top_n: int = DEFAULT_TOP_N_CANDIDATES):
        self.project_id = project_id
        self.collection_name = collection_name
        self.top_n = top_n
        self.db = None
        self.logger = logging.getLogger(__name__)
        self.success_counter = Metrics.counter('FetchTopCandidatesDoFn', FETCH_CANDIDATES_SUCCESS)
        self.error_counter = Metrics.counter('FetchTopCandidatesDoFn', FETCH_CANDIDATES_ERRORS)
        self.no_candidates_counter = Metrics.counter('FetchTopCandidatesDoFn', NO_CANDIDATES_FOUND)
        self.filtered_out_counter = Metrics.counter('FetchTopCandidatesDoFn', 'hard_filter_rejections')
        self.profiles_collection = COLLECTIONS['USERS']['USER_INFO']
        self.candidate_identity_verification_coll = COLLECTIONS['MARRIAGE']['IDENTITY_VERIFICATIONS']
        self.candidate_wali_verification_coll = COLLECTIONS['MARRIAGE']['USER_WALI_RELATION_VERIFICATIONS']

    def setup(self):
        try:
            self.db = firestore.Client(project=self.project_id)
            self.logger.info(f"FetchTopCandidatesDoFn: Firestore client initialized for project {self.project_id}.")
        except Exception as e:
            self.logger.error(f"FetchTopCandidatesDoFn: Failed to initialize Firestore client in setup: {str(e)}", exc_info=True)
            raise RuntimeError(f"FetchTopCandidatesDoFn: Firestore client failed to initialize: {e}")

    def _fetch_doc_data(self, collection_name: str, document_id: str) -> Dict[str, Any] | None:
        if not self.db:
            return None
        doc = self.db.collection(collection_name).document(str(document_id)).get()
        if not doc.exists:
            return None
        data = doc.to_dict() or {}
        data.setdefault('id', str(document_id))
        return data

    def _candidate_passes_hard_filters(self, triggering_profile: Dict[str, Any], matched_user_id: str) -> bool:
        candidate_profile = self._fetch_doc_data(self.profiles_collection, matched_user_id)
        candidate_identity_verification = self._fetch_doc_data(self.candidate_identity_verification_coll, matched_user_id)
        candidate_wali_verification = self._fetch_doc_data(self.candidate_wali_verification_coll, matched_user_id)
        return is_candidate_hard_eligible(
            triggering_profile=triggering_profile,
            candidate_profile=candidate_profile,
            candidate_identity_verification=candidate_identity_verification,
            candidate_wali_verification=candidate_wali_verification,
        )

    def process(self, triggering_user_id: str):
        """
        Processes a triggering_user_id and fetches their top candidates from the scoreboard.
        Input: triggering_user_id (str)
        Output: (triggering_user_id, list_of_top_candidates_details_dicts)
        """
        if not self.db:
            self.logger.error("FetchTopCandidatesDoFn: Firestore client not initialized. Skipping fetch.")
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": "Firestore client not initialized in process",
                "triggering_user_id": triggering_user_id
            })
            return

        try:
            triggering_profile = self._fetch_doc_data(self.profiles_collection, triggering_user_id)
            if not triggering_profile:
                self.logger.warning(
                    f"FetchTopCandidatesDoFn: triggering profile {triggering_user_id} not found or unavailable; skipping candidates."
                )
                self.no_candidates_counter.inc()
                yield (triggering_user_id, [])
                return

            self.logger.info(f"Fetching top {self.top_n} candidates for user {triggering_user_id} from scoreboard: {self.collection_name}")
            candidate_scores_ref = self.db.collection(self.collection_name)\
                                          .document(triggering_user_id)\
                                          .collection('candidate_scores')

            query = candidate_scores_ref.order_by('score', direction=firestore.Query.DESCENDING).limit(self.top_n)
            top_candidate_docs = query.stream()

            top_candidates_list = []
            for doc in top_candidate_docs:
                if doc.exists:
                    data = doc.to_dict()
                    if not self._candidate_passes_hard_filters(triggering_profile, doc.id):
                        self.filtered_out_counter.inc()
                        self.logger.info(
                            f"Candidate {doc.id} for user {triggering_user_id} rejected by hard eligibility filters."
                        )
                        continue
                    top_candidates_list.append({
                        'matched_user_id': doc.id,
                        'aggregated_score': data.get('score'),
                        'evidence_count': data.get('evidence_count'),
                        'last_updated': data.get('last_updated')
                    })

            if not top_candidates_list:
                self.logger.info(f"No candidates found in scoreboard for user {triggering_user_id}")
                self.no_candidates_counter.inc()
                yield (triggering_user_id, [])
                return

            self.success_counter.inc()
            yield (triggering_user_id, top_candidates_list)

        except Exception as e:
            self.logger.error(f"FetchTopCandidatesDoFn: Error fetching candidates for user {triggering_user_id}: {str(e)}\nTraceback: {traceback.format_exc()}", exc_info=True)
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": f"Firestore query failed for top candidates: {str(e)}",
                "triggering_user_id": triggering_user_id,
                "traceback": traceback.format_exc()
            })


@beam.ptransform_fn
def FetchTopCandidatesFromScoreboard(pcoll: beam.PCollection[str],
                                     project_id: str,
                                     collection_name: str = DEFAULT_SCOREBOARD_COLLECTION,
                                     top_n: int = DEFAULT_TOP_N_CANDIDATES) -> beam.PCollectionTuple:
    """
    PTransform to fetch top N candidates for each user from the Firestore scoreboard.

    Returns a tuple where main output is (triggering_user_id,
    list_of_top_candidates_details_dicts), and error output contains failed
    triggering_user_id records.
    """
    return (
        pcoll
        | 'FetchTopNFromScoreboard' >> beam.ParDo(
            FetchTopCandidatesDoFn(project_id=project_id, collection_name=collection_name, top_n=top_n)
          ).with_outputs(FetchTopCandidatesDoFn.OUTPUT_ERROR_TAG, main='main')
    )
