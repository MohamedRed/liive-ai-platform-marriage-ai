# apps/marriage-ai/dataflow/pipelines/streaming/transforms/firestore_io.py
import apache_beam as beam
import logging
import traceback
from google.cloud import firestore # Keep specific client import here
from apache_beam.metrics import Metrics

# Import constants and metrics from common
from .common import MetricNames, COLLECTIONS

logger = logging.getLogger(__name__)

class UpdateFirestoreDoFn(beam.DoFn):
    """DoFn for updating Firestore with reranked matches"""

    def __init__(self, project_id: str, collection_name: str):
        self.project_id = project_id
        self.collection_name = collection_name # e.g., COLLECTIONS["MATCHES"]
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('UpdateFirestoreDoFn', MetricNames.ERRORS)
        self.update_success_counter = Metrics.counter('UpdateFirestoreDoFn', 'firestore_updates_success')
        self.missing_user_id_counter = Metrics.counter('UpdateFirestoreDoFn', 'missing_user_id')
        self.db = None

    def setup(self):
        try:
            self.db = firestore.Client(project=self.project_id)
            self.logger.info(f"UpdateFirestoreDoFn setup complete for project {self.project_id}")
        except Exception as e:
            self.logger.error(f"Failed to initialize Firestore client in UpdateFirestoreDoFn setup: {str(e)}", exc_info=True)
            raise

    def process(self, element):
        # Expecting element like {'user_id': ..., 'ranked_matches': [...], 'topMatchPercentage': ...}
        if not self.db:
            self.logger.error("Firestore client not initialized in UpdateFirestoreDoFn. Skipping.")
            self.error_counter.inc()
            raise RuntimeError("Setup failed for UpdateFirestoreDoFn")

        # Adjust check for new expected structure
        if not isinstance(element, dict) or 'user_id' not in element or 'ranked_matches' not in element:
            self.logger.error(f"Invalid input element format for UpdateFirestoreDoFn (missing user_id or ranked_matches): {element}")
            self.error_counter.inc()
            raise TypeError(f"Invalid input element format for UpdateFirestoreDoFn: {type(element)}")

        user_id = element.get('user_id')
        # Rename variable to match element structure
        ranked_matches = element.get('ranked_matches', []) # Default to empty list
        top_percentage = element.get('topMatchPercentage') # Get the percentage

        if not user_id:
            self.logger.warning("No user_id found in element for Firestore update.")
            self.missing_user_id_counter.inc()
            return # Cannot update without user_id

        try:
            doc_ref = self.db.collection(self.collection_name).document(user_id)

            # Example: Overwrite matches field completely and add percentage
            update_data = {
                "matches": ranked_matches, # Replace the entire array (use correct key)
                "topMatchPercentage": top_percentage, # Add the percentage
                "last_updated": firestore.SERVER_TIMESTAMP # Add an update timestamp
            }

            # Remove topMatchPercentage if it's None to avoid storing null?
            if top_percentage is None:
                del update_data['topMatchPercentage']
            
            doc_ref.set(update_data, merge=True) # Use set with merge=True to update/create

            self.update_success_counter.inc()
            # self.logger.info(f"Successfully set/merged matches for user {user_id}")

            # Yield element for potential downstream processing (e.g., final logging)
            yield element

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Firestore update failed for user {user_id}: {str(e)}\nTraceback: {traceback.format_exc()}", exc_info=True)
            raise # Propagate error for DLQ


@beam.ptransform_fn
def WriteMatchesToFirestore(pcoll: beam.PCollection[dict], project_id: str, collection_name: str) -> beam.PCollection[dict]:
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
        ))
    ) 