# apps/marriage-ai/dataflow/pipelines/streaming/transforms/firestore_io.py
import apache_beam as beam
import logging
import traceback
from google.cloud import firestore # Keep specific client import here
from apache_beam.metrics import Metrics

# Import constants and metrics from common
from .common import MetricNames, COLLECTIONS
from .match_write_guard import (
    build_match_write_fingerprint,
    extract_match_write_source_version,
    should_apply_match_write,
)

logger = logging.getLogger(__name__)

class UpdateFirestoreDoFn(beam.DoFn):
    """DoFn for updating Firestore with reranked matches"""
    OUTPUT_TAG = 'main'
    ERROR_TAG = 'error'

    def __init__(self, project_id: str, collection_name: str):
        self.project_id = project_id
        self.collection_name = collection_name # e.g., COLLECTIONS["MATCHES"]
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('UpdateFirestoreDoFn', MetricNames.ERRORS)
        self.update_success_counter = Metrics.counter('UpdateFirestoreDoFn', 'firestore_updates_success')
        self.skipped_write_counter = Metrics.counter('UpdateFirestoreDoFn', 'stale_or_duplicate_match_writes_skipped')
        self.missing_user_id_counter = Metrics.counter('UpdateFirestoreDoFn', 'missing_user_id')
        self.db = None
        self.setup_error_message = None

    def setup(self):
        try:
            self.db = firestore.Client(project=self.project_id)
            self.setup_error_message = None
            self.logger.info(f"UpdateFirestoreDoFn setup complete for project {self.project_id}")
        except Exception as e:
            self.setup_error_message = f"UpdateFirestoreDoFn setup failed: {str(e)}"
            self.logger.error(self.setup_error_message, exc_info=True)

    def process(self, element):
        # Expecting element like {
        #   'user_id': ...,
        #   'matches': [...],
        #   'topMatchPercentage': ..., 
        #   'rawTopMatchAiScore': ..., 
        #   'currentUserCoreProfileCompletenessFactor': ..., 
        #   'currentUserAnsweredCoreQuestionsCount': ..., 
        #   'totalCoreQuestionsInSystem': ..., 
        #   'minConfidenceWeightUsed': ...
        # }
        if not self.db:
            error_message = self.setup_error_message or "UpdateFirestoreDoFn setup failed"
            self.logger.error("%s. Skipping match write.", error_message)
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.ERROR_TAG, {
                "error_message": error_message,
                "element": element,
            })
            return

        if not isinstance(element, dict) or 'user_id' not in element or 'matches' not in element:
            self.logger.error(f"Invalid input element format for UpdateFirestoreDoFn (missing user_id or matches): {element}")
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.ERROR_TAG, {
                "error_message": f"Invalid input element format for UpdateFirestoreDoFn: {type(element)}",
                "element": element,
            })
            return

        user_id = element.get('user_id')
        matches_list = element.get('matches', [])
        
        # Extract all new and existing fields for Firestore
        top_match_percentage = element.get('topMatchPercentage') # Adjusted percentage
        raw_top_match_ai_score = element.get('rawTopMatchAiScore')
        completeness_factor = element.get('currentUserCoreProfileCompletenessFactor')
        answered_core_count = element.get('currentUserAnsweredCoreQuestionsCount')
        total_core_system = element.get('totalCoreQuestionsInSystem')
        min_confidence_weight = element.get('minConfidenceWeightUsed')

        if not user_id:
            self.logger.warning("No user_id found in element for Firestore update.")
            self.missing_user_id_counter.inc()
            yield beam.pvalue.TaggedOutput(self.ERROR_TAG, {
                "error_message": "Missing user_id in element for Firestore update",
                "element": element,
            })
            return

        try:
            doc_ref = self.db.collection(self.collection_name).document(user_id)
            existing_snapshot = doc_ref.get()
            existing_data = existing_snapshot.to_dict() if getattr(existing_snapshot, 'exists', False) else {}
            match_write_fingerprint = build_match_write_fingerprint(element)
            match_write_source_version = extract_match_write_source_version(element)

            if not should_apply_match_write(existing_data, match_write_source_version, match_write_fingerprint):
                self.skipped_write_counter.inc()
                self.logger.info(
                    "Skipping stale or duplicate match write for user %s with source version %s",
                    user_id,
                    match_write_source_version,
                )
                return

            update_data = {
                "matches": matches_list,
                "topMatchPercentage": top_match_percentage,
                "rawTopMatchAiScore": raw_top_match_ai_score,
                "currentUserCoreProfileCompletenessFactor": completeness_factor,
                "currentUserAnsweredCoreQuestionsCount": answered_core_count,
                "totalCoreQuestionsInSystem": total_core_system,
                "minConfidenceWeightUsed": min_confidence_weight,
                "matchWriteFingerprint": match_write_fingerprint,
                "matchWriteSourceVersion": match_write_source_version,
                "lastMatchWriteAt": firestore.SERVER_TIMESTAMP,
                "last_updated": firestore.SERVER_TIMESTAMP
            }

            # Clean up any None values to avoid writing them explicitly as null in Firestore, if desired.
            # topMatchPercentage could be None if calculation failed.
            if top_match_percentage is None:
                del update_data['topMatchPercentage']
            # rawTopMatchAiScore could be None if no matches or score extraction failed
            if raw_top_match_ai_score is None:
                del update_data['rawTopMatchAiScore']
            if match_write_source_version is None:
                del update_data['matchWriteSourceVersion']
            # Other numeric fields will default to 0 or 0.0 if not found by .get() and calculation had issues,
            # which is usually fine for Firestore.
            
            doc_ref.set(update_data, merge=True)

            self.update_success_counter.inc()
            yield element

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Firestore update failed for user {user_id}: {str(e)}\nTraceback: {traceback.format_exc()}", exc_info=True)
            yield beam.pvalue.TaggedOutput(self.ERROR_TAG, {
                "error_message": f"Firestore update failed for user {user_id}: {str(e)}",
                "element": element,
                "traceback": traceback.format_exc(),
            })


@beam.ptransform_fn
def WriteMatchesToFirestore(pcoll: beam.PCollection[dict], project_id: str, collection_name: str) -> beam.PCollectionTuple:
    """Composite PTransform to write reranked matches to Firestore.

    Args:
        pcoll: PCollection of dictionaries containing user_id and reranked matches.
        project_id: GCP Project ID.
        collection_name: Firestore collection name to write matches to.

    Returns:
        Input PCollection passed through.
    """
    return (
        pcoll
        | "UpdateFirestore" >> beam.ParDo(UpdateFirestoreDoFn(
            project_id=project_id,
            collection_name=collection_name
        )).with_outputs(UpdateFirestoreDoFn.ERROR_TAG, main=UpdateFirestoreDoFn.OUTPUT_TAG)
    ) 