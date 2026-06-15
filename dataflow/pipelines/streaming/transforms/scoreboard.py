# apps/marriage-ai/dataflow/pipelines/streaming/transforms/scoreboard.py
import apache_beam as beam
import logging
import traceback
from typing import Dict, Any
from apache_beam.metrics import Metrics

# Import Firestore client and FieldValue for Increment and ServerTimestamp
from google.cloud import firestore
from google.cloud.firestore import Increment, SERVER_TIMESTAMP

# from .common import MetricNames # If you have specific common metric names

logger = logging.getLogger(__name__)

# Define a default collection name, can be overridden if passed as arg
DEFAULT_SCOREBOARD_COLLECTION = "MATCH_CANDIDATE_SCOREBOARD"
# Define specific metric names for this DoFn
SCOREBOARD_UPDATE_SUCCESS = 'ScoreboardUpdateSuccess'
SCOREBOARD_UPDATE_ERRORS = 'ScoreboardUpdateErrors'

DEFAULT_TOP_N_CANDIDATES = 10 # Default number of top candidates to fetch

# Default weights for scoring
DEFAULT_WEIGHT_PREFERENCE_FULFILLMENT = 1.0
DEFAULT_WEIGHT_ATTRIBUTE_SIMILARITY = 0.4

class UpdateScoreboardDoFn(beam.DoFn):
    """Updates a Firestore-based scoreboard with match scores, applying weights based on match type."""
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
        self.weighted_score_sum = Metrics.counter(self.__class__.__name__, 'weighted_score_sum') # For observing total weighted score added

    def setup(self):
        try:
            self.db = firestore.Client(project=self.project_id)
            self.logger.info(f"UpdateScoreboardDoFn: Firestore client initialized for project {self.project_id}.")
        except Exception as e:
            self.logger.error(f"UpdateScoreboardDoFn: Failed to initialize Firestore client in setup: {str(e)}", exc_info=True)
            # This is a critical error; subsequent process calls will fail.
            raise RuntimeError(f"UpdateScoreboardDoFn: Firestore client failed to initialize: {e}")

    def process(self, element: Dict[str, Any]):
        """
        Processes a match hit and updates the corresponding score in the Firestore scoreboard.
        Input element is expected to be a dictionary like:
        {
            'triggering_user_id': str,
            'matched_user_id': str,
            'pinecone_score': float,
            'match_type': str, # 'AP', 'PA', or 'AA'
            ... (other fields from statement_match_hits)
        }
        """
        if not self.db:
            self.logger.error("UpdateScoreboardDoFn: Firestore client not initialized. Skipping update.")
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {"error_message": "Firestore client not initialized in process", "element": element})
            return

        try:
            triggering_user_id = str(element.get('triggering_user_id'))
            matched_user_id = str(element.get('matched_user_id'))
            
            # For simplicity, using the raw pinecone_score as the increment.
            # Could be a fixed value (e.g., 1 for a "vote") or scaled.
            # score_increment = element.get('pinecone_score') # Old way

            pinecone_score = element.get('pinecone_score')
            match_type = element.get('match_type')

            if not triggering_user_id or not matched_user_id or pinecone_score is None or not match_type:
                self.logger.warning(f"UpdateScoreboardDoFn: Missing required fields (triggering_user_id, matched_user_id, pinecone_score, or match_type) in element: {element}")
                self.error_counter.inc()
                yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {"error_message": "Missing required fields for scoreboard update", "element": element})
                return

            # Calculate weighted score
            weighted_score = 0.0
            if match_type in ['AP', 'PA']:
                weighted_score = pinecone_score * self.weight_preference_fulfillment
            elif match_type == 'AA':
                weighted_score = pinecone_score * self.weight_attribute_similarity
            else:
                self.logger.warning(f"UpdateScoreboardDoFn: Unknown match_type '{match_type}' for element {element}. Defaulting score to 0.")
                # Potentially tag error or skip update, for now, it means score_increment will be 0 if not caught earlier

            if weighted_score == 0.0 and pinecone_score != 0.0: # Log if weighting resulted in zero score from non-zero input due to unknown type
                self.logger.info(f"UpdateScoreboardDoFn: Weighted score is 0 for non-zero Pinecone score due to match_type '{match_type}'. Element: {element}")

            # Structure: SCOREBOARD_COLLECTION / {triggering_user_id} / candidate_scores / {matched_user_id}
            # The document {matched_user_id} will store the aggregated score.
            doc_path = f"{self.collection_name}/{triggering_user_id}/candidate_scores/{matched_user_id}"
            doc_ref = self.db.document(doc_path)

            payload = {
                'score': Increment(float(weighted_score)), # Use weighted_score
                'last_updated': SERVER_TIMESTAMP,
                # Denormalize IDs for easier querying of the scoreboard if needed directly
                'triggering_user_id': triggering_user_id,
                'matched_user_id': matched_user_id 
            }
            
            # self.logger.debug(f"Attempting to update scoreboard at {doc_path} with increment {score_increment}")
            doc_ref.set(payload, merge=True) # merge=True ensures we don't overwrite other fields if any
            
            self.success_counter.inc()
            self.weighted_score_sum.inc(int(weighted_score * 100)) # Track sum as integer (e.g. score * 100)
            yield element # Pass through the original element

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
    """
    PTransform to process match hits and update a Firestore-based scoreboard.

    Args:
        pcoll: PCollection of match hit dictionaries.
        project_id: GCP Project ID.
        collection_name: Name of the Firestore collection for the scoreboard.
        weight_preference_fulfillment: Weight for AP/PA matches.
        weight_attribute_similarity: Weight for AA matches.

    Returns:
        PCollectionTuple with:
         - 'main': The pass-through input PCollection of match hit dictionaries.
         - 'error': PCollection of elements that failed during the scoreboard update.
    """
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

    def setup(self):
        try:
            self.db = firestore.Client(project=self.project_id)
            self.logger.info(f"FetchTopCandidatesDoFn: Firestore client initialized for project {self.project_id}.")
        except Exception as e:
            self.logger.error(f"FetchTopCandidatesDoFn: Failed to initialize Firestore client in setup: {str(e)}", exc_info=True)
            raise RuntimeError(f"FetchTopCandidatesDoFn: Firestore client failed to initialize: {e}")

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
                    top_candidates_list.append({
                        'matched_user_id': doc.id, # The ID of the candidate_scores sub-collection document is matched_user_id
                        'aggregated_score': data.get('score'),
                        'last_updated': data.get('last_updated')
                        # Add other fields if they were denormalized into candidate_scores docs
                    })
            
            if not top_candidates_list:
                self.logger.info(f"No candidates found in scoreboard for user {triggering_user_id}")
                self.no_candidates_counter.inc()
                # Yield with empty list to indicate no candidates, rather than erroring
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

    Args:
        pcoll: PCollection of triggering_user_id strings.
        project_id: GCP Project ID.
        collection_name: Name of the Firestore collection for the scoreboard.
        top_n: Number of top candidates to fetch.

    Returns:
        PCollectionTuple with:
         - 'main': PCollection of (triggering_user_id, list_of_top_candidates_details_dicts).
         - 'error': PCollection of elements (triggering_user_id) that failed processing.
    """
    return (
        pcoll
        | 'FetchTopNFromScoreboard' >> beam.ParDo(
            FetchTopCandidatesDoFn(project_id=project_id, collection_name=collection_name, top_n=top_n)
          ).with_outputs(FetchTopCandidatesDoFn.OUTPUT_ERROR_TAG, main='main')
    ) 