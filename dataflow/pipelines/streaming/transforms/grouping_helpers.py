# apps/marriage-ai/dataflow/pipelines/streaming/transforms/grouping_helpers.py
import apache_beam as beam
import logging
import statistics
from apache_beam.metrics import Metrics
from typing import Dict, List, Any, Tuple, Optional

# Assuming common contains MetricNames, COLLECTIONS if needed by UpdateAllScoresDoFn
# If not, UpdateAllScoresDoFn needs adjustment or COLLECTIONS passed in.
from .common import MetricNames, COLLECTIONS

logger = logging.getLogger(__name__)

# --- Helper DoFns for CoGroupByKey Approach --- #

class ExtractQAsForScoringDoFn(beam.DoFn):
    """Extracts QA pairs from a profile for lying score calculation."""
    OUTPUT_ERROR_TAG = 'errors'

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def process(self, profile):
        # profile is expected to be a dictionary fetched by ProcessAndValidateProfile
        try:
            user_id = profile.get('id')
            if not user_id:
                self.logger.warning("Profile missing ID in ExtractQAsForScoringDoFn")
                yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': 'Missing profile ID', 'element': profile})
                return

            # Assuming QAs are stored as a map {qa_id: {question: ..., answer: ...}}
            qa_data = profile.get("questions_answers", {})
            if not qa_data or not isinstance(qa_data, dict):
                 # self.logger.info(f"No valid questions_answers dict found for user {user_id} in ExtractQAsForScoringDoFn")
                 return # Nothing to score

            for qa_id, qa_dict in qa_data.items():
                if isinstance(qa_dict, dict) and 'question' in qa_dict and 'answer' in qa_dict:
                     yield {
                         'profile_id': user_id,
                         'qa_id': qa_id,
                         'qa_data': qa_dict # Pass the whole QA dict
                     }
                else:
                     self.logger.warning(f"Skipping malformed QA entry {qa_id} for user {user_id}")
                     yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': f'Malformed QA entry {qa_id}', 'element': profile})

        except Exception as e:
            self.logger.error(f"Error in ExtractQAsForScoringDoFn for profile {profile.get('id', 'UNKNOWN')}: {e}", exc_info=True)
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': str(e), 'element': profile})


class AggregateScoresDoFn(beam.DoFn):
    """Aggregates per-question scores into a single dictionary and calculates an overall score."""
    OUTPUT_ERROR_TAG = 'errors'

    def __init__(self, aggregation_method='average'):
        self.aggregation_method = aggregation_method
        self.logger = logging.getLogger(__name__)

    def process(self, element):
        user_id, scores_iterable = element # Input from GroupByKey: (user_id, iterable[{...score_item...}])
        try:
            per_qa_scores = {}
            all_scores = []
            # scores_iterable contains dicts like {'qa_id': ..., 'lying_score': ...}
            for score_item in scores_iterable:
                if isinstance(score_item, dict):
                    qa_id = score_item.get('qa_id')
                    score = score_item.get('lying_score')
                    if qa_id is not None and score is not None:
                        per_qa_scores[qa_id] = score
                        all_scores.append(score)
                    else:
                        self.logger.warning(f"Skipping invalid score item (missing fields) for user {user_id}: {score_item}")
                else:
                     self.logger.warning(f"Skipping invalid score item (wrong type {type(score_item)}) for user {user_id}: {score_item}")

            aggregate_score = 0.0 # Default score
            if all_scores: # Calculate only if valid scores were found
                if self.aggregation_method == 'average':
                    aggregate_score = statistics.mean(all_scores)
                elif self.aggregation_method == 'max':
                    aggregate_score = max(all_scores)
                # Add other methods if needed
            else:
                self.logger.info(f"No valid scores found to aggregate for user {user_id}. Using default aggregate score 0.0.")

            # Always yield an entry for the user, even if scores are empty/default
            # This ensures the user appears in the CoGroupByKey input
            yield (user_id, {
                'scores': per_qa_scores, # Dict of {qa_id: score}
                'aggregate': aggregate_score # Single aggregate score
            })

        except Exception as e:
            self.logger.error(f"Error aggregating scores for user {user_id}: {e}", exc_info=True)
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': str(e), 'user_id': user_id})

class UpdateAllScoresDoFn(beam.DoFn):
    """Updates Firestore with per-question lying scores within the QAS document."""
    OUTPUT_ERROR_TAG = 'errors'

    # Only needs the QA collection name now
    def __init__(self, project_id: str, qa_collection: str):
        self.project_id = project_id
        # self.profiles_collection = profiles_collection # Removed
        self.qa_collection = qa_collection # Store the QA collection name
        self.logger = logging.getLogger(__name__)
        self.db = None

    def setup(self):
        try:
            from google.cloud import firestore # Import within setup
            self.db = firestore.Client(project=self.project_id)
            self.logger.info("UpdateAllScoresDoFn setup complete (Firestore)")
        except Exception as e:
             self.logger.error(f"Failed UpdateAllScoresDoFn setup: {e}", exc_info=True)
             raise

    def process(self, element):
        if not self.db:
            self.logger.error("Firestore client not initialized in UpdateAllScoresDoFn. Skipping.")
            Metrics.counter('UpdateAllScoresDoFn', MetricNames.ERRORS).inc()
            raise RuntimeError("Setup failed for UpdateAllScoresDoFn")

        user_id, score_data = element # Input: (user_id, {'scores': {qa_id: score}, 'aggregate': agg_score})
        try:
            if not user_id or not isinstance(score_data, dict):
                self.logger.error(f"Invalid input format for UpdateAllScoresDoFn: {element}")
                Metrics.counter('UpdateAllScoresDoFn', MetricNames.ERRORS).inc()
                yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': 'Invalid input format', 'element': element})
                return

            # Get reference to the user's document within the QAS collection
            qa_doc_ref = self.db.collection(self.qa_collection).document(user_id)
            per_qa_scores = score_data.get('scores', {})
            # aggregate_score = score_data.get('aggregate') # No longer used for writing

            batch = self.db.batch()
            updates = {}

            # Remove aggregate score update
            # if aggregate_score is not None:
            #     updates['aggregateLyingScore'] = aggregate_score

            for qa_id, score in per_qa_scores.items():
                 # Construct the field path within the 'questions' map in the QAS document
                 field_path = f'questions.{qa_id}.aiLyingScore'
                 updates[field_path] = score

            if not updates:
                self.logger.info(f"No individual QA scores to update for user {user_id}")
                return

            # Update the user's QAS document with the individual scores
            batch.update(qa_doc_ref, updates)
            batch.commit()
            Metrics.counter('UpdateAllScoresDoFn', 'qa_scores_updated').inc()
            # Rename metric for clarity
            # Metrics.counter('UpdateAllScoresDoFn', 'profiles_updated').inc()

        except Exception as e:
            Metrics.counter('UpdateAllScoresDoFn', MetricNames.ERRORS).inc()
            self.logger.error(f"Firestore update failed for QA scores ({user_id}): {str(e)}", exc_info=True)
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': str(e), 'user_id': user_id})

class ProcessJoinedDataDoFn(beam.DoFn):
    """Processes the output of CoGroupByKey, combining scores, matches, and user history for reranking."""
    OUTPUT_ERROR_TAG = 'errors'
    # SCORES_TAG and MATCHES_TAG are now passed in constructor if they vary, or use fixed ones.

    def __init__(self, scores_tag: str, matches_tag: str, history_tag: str):
        self.logger = logging.getLogger(__name__)
        self.scores_tag = scores_tag
        self.matches_tag = matches_tag
        self.history_tag = history_tag # New tag for user history

    def process(self, element):
        user_id, joined_data = element
        try:
            scores_list = joined_data.get(self.scores_tag, [])
            matches_list = joined_data.get(self.matches_tag, [])
            history_list = joined_data.get(self.history_tag, []) # Get history data

            # Scores side should always have exactly one entry
            if len(scores_list) == 1:
                 score_data = scores_list[0]
            else:
                 self.logger.error(f"Unexpected number of score entries for user {user_id} in join: {len(scores_list)}. Using default.")
                 score_data = {'scores': {}, 'aggregate': 0.0}
                 if len(scores_list) != 0:
                     self.logger.warning(f"Multiple score entries found: {scores_list}")

            # Matches side can have zero or one entry
            if len(matches_list) == 1:
                match_data_dict = matches_list[0]
                matches = match_data_dict.get('matches', []) # Assuming matches are under a 'matches' key
            elif len(matches_list) == 0:
                matches = []
            else: 
                self.logger.error(f"Unexpected number of match entries for user {user_id} in join: {len(matches_list)}. Taking first.")
                match_data_dict = matches_list[0]
                matches = match_data_dict.get('matches', [])
                self.logger.warning(f"Multiple match entries found: {matches_list}")

            # History side should have one entry (the user_qas dict)
            user_qas = {}
            if len(history_list) == 1:
                user_qas = history_list[0] # This is the user_qas_dict
            elif len(history_list) > 1:
                 self.logger.warning(f"Multiple history entries for user {user_id}: {len(history_list)}. Taking first.")
                 user_qas = history_list[0]
            else: # No history found - log and use empty
                self.logger.warning(f"No history entry found for user {user_id} in join for reranking.")

            yield {
                'user_id': user_id,
                'scores': score_data, 
                'matches': matches, 
                'user_qas': user_qas # Add user_qas to the output
            }

        except Exception as e:
            self.logger.error(f"Error processing joined data for user {user_id}: {e}", exc_info=True)
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': str(e), 'user_id': user_id}) 

# --- Filtering DoFn with Dynamic Threshold --- #

# Configurable parameters for dynamic thresholding
# TODO: Make these configurable via pipeline options
MEDIAN_MULTIPLIER = 1.9 # e.g., 1.9 means threshold is 90% above median
MIN_DROPS_FOR_MEDIAN = 3  # Min number of drops before using median
MIN_BASE_THRESHOLD = 0.02 # Small absolute threshold to handle zero/tiny medians

class FilterDenseMatchesDoFn(beam.DoFn):
    """Filters Pinecone query results to keep the initial dense cluster based on a dynamic score drop-off threshold derived from the median drop."""
    OUTPUT_ERROR_TAG = 'errors'

    def __init__(self,
                 median_multiplier: float = MEDIAN_MULTIPLIER,
                 min_drops_for_median: int = MIN_DROPS_FOR_MEDIAN,
                 min_base_threshold: float = MIN_BASE_THRESHOLD):
        self.median_multiplier = median_multiplier
        self.min_drops_for_median = min_drops_for_median
        self.min_base_threshold = min_base_threshold
        self.logger = logging.getLogger(__name__)

    def process(self, element: Dict[str, Any]):
        # Expects element like: {'user_id': ..., 'matches': [{'id': ..., 'score': ...}, ...]}
        # Assumes 'matches' is sorted by score descending by Pinecone
        try:
            user_id = element.get('user_id')
            raw_matches = element.get('matches', [])

            if not user_id:
                self.logger.warning(f"Missing user_id in element for filtering: {element}")
                yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': 'Missing user_id', 'element': element})
                return

            if not isinstance(raw_matches, list):
                self.logger.warning(f"Matches data is not a list for user {user_id}: {type(raw_matches)}")
                filtered_matches = []
            elif len(raw_matches) < 2:
                filtered_matches = raw_matches # Keep all if 0 or 1 match
            else:
                keep_upto_index = len(raw_matches) # Default: keep all
                scores = [m.get('score', 0.0) for m in raw_matches if isinstance(m, dict)]
                observed_drops = []

                # Iterate through pairs to calculate drops and check threshold
                for i in range(len(scores) - 1):
                    current_drop = max(0.0, scores[i] - scores[i+1]) # Ensure drop is non-negative
                    dynamic_threshold = self.min_base_threshold # Start with minimum base

                    # Apply dynamic threshold only after observing enough drops
                    if len(observed_drops) >= self.min_drops_for_median:
                        try:
                            median_drop = statistics.median(observed_drops)
                            # Calculate dynamic threshold based on median, ensuring it's at least the base threshold
                            dynamic_threshold = max(self.min_base_threshold, median_drop * self.median_multiplier)
                        except statistics.StatisticsError:
                            # Should not happen if len >= 1, but handle defensively
                            self.logger.warning(f"StatisticsError calculating median for user {user_id}")
                        except Exception as median_err:
                             self.logger.error(f"Error calculating median drop for user {user_id}: {median_err}")

                    # Check if the current drop exceeds the calculated threshold
                    if current_drop > dynamic_threshold:
                        keep_upto_index = i + 1 # Keep matches up to and including index i
                        self.logger.info(
                            f"User {user_id}: Stopping cluster at index {i}. "
                            f"Drop ({current_drop:.4f}) > Threshold ({dynamic_threshold:.4f}). "
                            f"(Median drop: {median_drop:.4f} based on {len(observed_drops)} previous drops)"
                        )
                        break # Stop at the first significant drop
                    else:
                         # Add the current valid drop to our observed list for next iteration's median
                         observed_drops.append(current_drop)

                filtered_matches = raw_matches[:keep_upto_index]

            # Logging and output (same as before)
            num_raw = len(raw_matches) if isinstance(raw_matches, list) else 0
            num_filtered = len(filtered_matches)
            self.logger.info(f"Filtered matches for {user_id}: kept {num_filtered}/{num_raw} (dynamic threshold)")
            Metrics.counter(self.__class__.__name__, 'matches_input').inc(num_raw)
            Metrics.counter(self.__class__.__name__, 'matches_output').inc(num_filtered)

            yield {
                'user_id': user_id,
                'matches': filtered_matches
            }

        except Exception as e:
            self.logger.error(f"Error filtering matches for user {user_id}: {e}", exc_info=True)
            Metrics.counter(self.__class__.__name__, MetricNames.ERRORS).inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {'error': str(e), 'element': element}) 