#!/usr/bin/env python
#
# Copyright 2024 Marriage AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0

"""An Apache Beam streaming pipeline for user matching using modular PTransforms.

It reads user profile update events (triggered by QA updates) from Pub/Sub,
extracts QA changes, parses answers into statements, generates statement embeddings,
stores and queries statement embeddings in Pinecone, updates a match scoreboard,
fetches top candidates from scoreboard, performs multi-stage reranking (cross-encoder + LLM),
calculates lying scores for QAs and updates them in Firestore,
suggests the next profile question for the user based on the 3-layer logic,
schedules delayed matching, triggers actions (notifications/voice),
and writes results to Firestore.
"""

from __future__ import annotations
import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions, StandardOptions
import logging
import argparse
import warnings
from datetime import datetime
import statistics # For calculating average aggregate score
from apache_beam.metrics import Metrics # For custom DoFn metrics
from google.cloud import firestore # Needed for history fetch setup
from .common.definitions import COLLECTIONS, DEFAULT_LOCATION, FOUNDATIONAL_LAYER, INSIGHT_LAYER # Import COLLECTIONS and layer constants
from .utils.firestore_helpers import get_all_user_qas # Import history fetch helper
from .common import config # <<< Corrected import for config.py

# Import modular components
from .transforms.common import (
    MetricNames,
    ParseFirestoreTriggerEventDoFn,
    WriteToDLQFn,
    DebugLogDoFn,
    FetchUserHistoryDoFn,
    FetchFullQAsForUser
)
from .transforms.profile_processing import ProcessAndValidateProfile
from .transforms.embedding import GenerateEmbeddingsForStatements
from .transforms.pinecone_ops import DeleteStaleQuestionVectors, QueryMatchesFromPinecone, StoreIndividualEmbeddingsInPinecone
from .transforms.reranking import (
    RerankAndScoreMatches, # The composite transform (expects modified input)
    CalculateLyingScoreDoFn, # Used in the score calculation branch
    UpdateLyingScoreDoFn,
    CrossEncodeCandidates, # Added CrossEncodeCandidates
    CrossEncodeDoFn
)
# Import the new grouping helpers
# from .transforms.grouping_helpers import (
#     FetchTopCandidatesFromScoreboard, # These are defined in scoreboard.py
#     FetchTopCandidatesDoFn
# )
from .transforms.scoreboard import (
    DeleteStaleScoreboardEvidence,
    WriteToScoreboard, # Already imported for writing
    FetchTopCandidatesFromScoreboard, # Import from scoreboard.py
    FetchTopCandidatesDoFn # Import from scoreboard.py
)
# Import the new next_question transforms
from .transforms.next_question import (
    Layer1CandidateDoFn,
    Layer2CandidateDoFn,
    Layer3CandidateDoFn,
    Layer4CandidateDoFn,
    SelectBestQuestionDoFn,
    UpdateNextQuestionDoFn
)
from .transforms.firestore_io import WriteMatchesToFirestore
from .transforms.final_eligibility import ApplyFinalMatchEligibilityGate
from .transforms.scheduling import ScheduleDelayedMatching, HandleMatchActions
from .transforms.profile_summarization import GenerateAndStoreProfileSummary
from .transforms.answer_parsing import ParseAnswerIntoStatements
from .transforms.scoring import normalize_ai_score_to_unit
# Import utility functions if needed
# from .utils import access_secret

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
warnings.filterwarnings("ignore", category=Warning)

# --- Helper DoFns are now moved to transforms/grouping_helpers.py and transforms/next_question.py --- #

def parse_pipeline_options(argv=None):
    """Parse command-line arguments and configure PipelineOptions."""
    parser = argparse.ArgumentParser()
    # Add arguments required by the pipeline transforms and execution
    parser.add_argument('--project', required=True, help='GCP project ID')
    parser.add_argument('--region', required=True, help='GCP region for Dataflow job')
    parser.add_argument('--runner', required=True, help='Beam Runner (e.g., DataflowRunner, DirectRunner)')
    parser.add_argument('--job_name', help='Dataflow job name (optional, defaults to generated name)')
    parser.add_argument('--temp_location', required=True, help='GCS path for temporary files (gs://...)')
    parser.add_argument('--staging_location', required=True, help='GCS path for staging files (gs://...)')
    parser.add_argument('--service_account_email', required=True, help='Service account email for Dataflow worker')
    parser.add_argument('--requirements_file', required=True, help='Path to requirements.txt for Flex Template')

    # PubSub Topics
    parser.add_argument('--user_profile_updated_pubsub_topic', required=True, help='PubSub topic for immediate events (projects/.../topics/...) - triggered on QA update')
    parser.add_argument('--delayed_matching_pubsub_topic', required=True, help='PubSub topic for delayed matching events (projects/.../topics/...)')

    # Pinecone Config
    parser.add_argument('--pinecone_index', required=True, help='Pinecone index name')
    parser.add_argument('--pinecone_region', required=True, help='Pinecone region (environment, e.g., us-west1-gcp)')
    parser.add_argument('--top_k', type=int, default=20, help='Number of nearest neighbors to query from Pinecone (per statement)')

    # Scoreboard Weights (New)
    parser.add_argument('--weight_preference_fulfillment', type=float, default=1.0, help='Weight for AP/PA matches in scoreboard')
    parser.add_argument('--weight_attribute_similarity', type=float, default=0.4, help='Weight for AA matches in scoreboard')

    # Reranking Config
    parser.add_argument('--pdf_bucket', required=True, help='GCS bucket containing the AI instructions PDF')
    parser.add_argument('--pdf_instructions_path', default='agent-instructions-1.0.pdf', help='Path to AI instructions PDF within the bucket')
    parser.add_argument('--rerank_top_n', type=int, default=10, help='Number of top candidates from scoreboard to rerank')

    # Scheduling Config
    parser.add_argument('--tasks_location', default='us-central1', help='Cloud Tasks location')
    parser.add_argument('--delayed_matching_queue', default='delayed-matching', help='Cloud Tasks queue for delayed matching')
    parser.add_argument('--notification_queue', default='match-notifications', help='Cloud Tasks queue for notifications')
    parser.add_argument('--voice_agent_queue', default='voice-agent-calls', help='Cloud Tasks queue for voice agent calls')
    parser.add_argument('--notification_function_url', required=True, help='URL for the notification Cloud Function/Run service')
    parser.add_argument('--voice_agent_function_url', required=True, help='URL for the voice agent Cloud Function/Run service')
    parser.add_argument('--delayed_task_delay_seconds', type=int, default=300, help='Delay for scheduled delayed matching task')

    # DLQ Config
    parser.add_argument('--dlq_gcs_path', required=True, help='GCS path prefix for Dead Letter Queue files (gs://...)')

    # Keep the arguments for potential overrides or different configurations if needed elsewhere,
    # but the pipeline logic will now primarily use the definitions.py constants.
    parser.add_argument('--profiles_collection_arg', default=None, help='[DEPRECATED - Use definitions.py] Firestore collection for user profiles')
    parser.add_argument('--matches_collection_arg', default=None, help='[DEPRECATED - Use definitions.py] Firestore collection for storing matches')

    known_args, pipeline_args = parser.parse_known_args(argv)

    # Log if deprecated args are used
    if known_args.profiles_collection_arg:
        logger.warning("Argument --profiles_collection_arg is deprecated. Collection name is now sourced from common/definitions.py (COLLECTIONS['USERS']['USER_INFO']).")
    if known_args.matches_collection_arg:
        logger.warning("Argument --matches_collection_arg is deprecated. Collection name is now sourced from common/definitions.py (COLLECTIONS['MARRIAGE']['MATCHES']).")

    pipeline_options = PipelineOptions(
        pipeline_args,
        runner=known_args.runner,
        project=known_args.project,
        region=known_args.region,
        job_name=known_args.job_name or f"user-matching-streaming-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
        temp_location=known_args.temp_location,
        staging_location=known_args.staging_location,
        service_account_email=known_args.service_account_email,
        streaming=True
    )
    pipeline_options.view_as(StandardOptions).streaming = True

    logger.info(f"Pipeline Options: {pipeline_options.display_data()}")
    logger.info(f"Known Arguments: {vars(known_args)}")

    return known_args, pipeline_options

def run_streaming_pipeline(argv=None):
    """Defines and runs the modular streaming pipeline using CoGroupByKey."""
    known_args, pipeline_options = parse_pipeline_options(argv)

    # Get collection names from the central definition
    user_info_collection = COLLECTIONS['USERS']['USER_INFO']
    matches_collection = COLLECTIONS['MARRIAGE']['MATCHES']
    qa_collection_name = COLLECTIONS['MARRIAGE']['QAS'] # Already using definition

    # TODO: Add MARRIAGE_PROFILE_SUMMARIES to common/definitions.py
    # For now, assume it will be accessible like this for prototyping:
    profile_summaries_collection = COLLECTIONS['MARRIAGE_APP_SPECIFIC']['PROFILE_SUMMARIES']
    match_candidate_scoreboard_collection = COLLECTIONS['MARRIAGE_APP_SPECIFIC']['MATCH_CANDIDATE_SCOREBOARD']

    # We'll also need the summarization model name, can be from known_args or config
    # For now, let's assume a pipeline argument or use default from the PTransform
    # parser.add_argument('--summarization_llm_model', default=DEFAULT_SUMMARIZATION_MODEL_FROM_TRANSFORM)

    with beam.Pipeline(options=pipeline_options) as pipeline:
        logger.info("Building modular streaming pipeline graph (CoGroupByKey approach)...")

        dlq_sink = lambda label: label >> f"Write{label}ToDLQ" >> beam.ParDo(WriteToDLQFn(known_args.dlq_gcs_path))

        # --- Branch 1: Immediate Profile Updates (Triggered by Answer Update) ---
        immediate_events = (
            pipeline
            | "ReadImmediateEvents" >> beam.io.ReadFromPubSub(
                topic=known_args.user_profile_updated_pubsub_topic,
                with_attributes=True,
                 id_label="event_id"
             ).with_output_types(beam.io.ReadFromPubSub.PubsubMessage)
        )
        parsed_event_data, parsing_errors = (
             immediate_events
             | "ParseTriggerEvent" >> beam.ParDo(ParseFirestoreTriggerEventDoFn())
               .with_outputs(ParseFirestoreTriggerEventDoFn.OUTPUT_ERROR_TAG, main="main")
        )
        parsing_errors | "DLQ_ParsingErrors" >> dlq_sink("ParsingErrors")
        parsed_event_data | "DebugLogParsedEvent" >> DebugLogDoFn(label="ParsedEventData")

        # --- Fetch User History (in parallel with other initial processing) --- #
        # Assuming FetchUserHistoryDoFn is updated to use with_outputs for error handling
        # and has defined FetchUserHistoryDoFn.OUTPUT_ERROR_TAG and a main output tag (e.g., FetchUserHistoryDoFn.OUTPUT_HISTORY_TAG or implicit 'main')
        user_history_results = (
             parsed_event_data # Contains user_id, or just user_id if mapped before
             | "FetchUserHistoryData" >> beam.ParDo(FetchUserHistoryDoFn( # Renamed ParDo step for clarity
                 project_id=known_args.project,
                 qa_collection_name=qa_collection_name
             )).with_outputs(FetchUserHistoryDoFn.ERROR_TAG, main='main') # Using ERROR_TAG as defined in placeholder
        )
        user_history_results[FetchUserHistoryDoFn.ERROR_TAG] | "DLQ_UserHistoryErrors" >> dlq_sink("UserHistoryErrors")
        user_history_keyed = user_history_results['main'] # Assuming default main output tag
        # Output of main: (user_id, list_of_qa_dicts)
        # TODO: Add error handling for FetchUserHistoryDoFn if needed <- This TODO can now be resolved if DoFn is updated.
        user_history_keyed | "DebugLogUserHistory" >> DebugLogDoFn(label="UserHistoryKeyed")

        # --- Process Profiles (Main User Document from USER_INFO) --- #
        processed_profile_results = (
            parsed_event_data # Contains user_id and potentially changed fields
            | "ProcessUserProfileData" >> ProcessAndValidateProfile(
                project_id=known_args.project,
                collection_name=user_info_collection # This is COLLECTIONS['USERS']['USER_INFO']
            )
        )
        processed_profile_results.error | "DLQ_ProfileProcessingErrors" >> dlq_sink("ProfileProcessingErrors")
        processed_profile_data = processed_profile_results.main
        # processed_profile_data: (user_id, profile_data_dict from user_info_collection)
        # This profile_data_dict should contain 'questions_answers' if that's where they are stored directly in the user document.
        # Or, if QAs are in a separate collection, ProcessAndValidateProfile would need to fetch and include them.
        # Based on marriage.ts, QAS collection is separate. So, processed_profile_data from ProcessAndValidateProfile
        # might *not* have questions_answers needed for summarization directly.
        # Let's assume for now ProcessAndValidateProfile makes QAs available if they are central to the profile concept it handles.
        # If not, we need to fetch them separately for summarization.

        processed_profile_data | "DebugLogProcessedProfile" >> DebugLogDoFn(label="ProcessedProfileData")

        # --- Fetch Full Q&A data for these users --- #
        # Input: processed_profile_data (dict containing user_id)
        # Output (main): (user_id, enriched_profile_data_dict where profile_data now includes questions_answers)
        # Output (error): errors
        profile_with_qas_data, fetch_qas_errors = (
            processed_profile_data
            | "FetchFullQAs" >> FetchFullQAsForUser(
                project_id=known_args.project,
                qa_collection_name=qa_collection_name
            )
            # FetchFullQAsForUser is a PTransformTuple with .main and .error
        )
        fetch_qas_errors | "DLQ_FetchQAsErrors" >> dlq_sink("FetchQAsErrors")
        profile_with_qas_data | "DebugLogProfileWithQAs" >> DebugLogDoFn(label="ProfileWithQAsData")
        # profile_with_qas_data is PCollection of (user_id, profile_data_dict_with_qas)
        # where profile_data_dict_with_qas is {'user_id': ..., 'profile_data': {..., 'questions_answers': fetched_map}}
        # No, FetchFullQAsDoFn yields (user_id, output_profile_data_for_summary) where output_profile_data_for_summary is the dict with QAs.
        # So profile_with_qas_data is (user_id, dict_profile_and_qas) - this is the correct input for GenerateAndStoreProfileSummary

        # --- Generate and Store Profile Summary (New Branch) --- #
        summary_results_tuple = (
            profile_with_qas_data # Input: (user_id, profile_data_dict_with_qas)
            | "GenerateAndStoreSummary" >> GenerateAndStoreProfileSummary(
                project_id=known_args.project,
                profile_summaries_collection=profile_summaries_collection,
            )
        )
        summary_results_tuple.generation_errors | "DLQ_SummaryGenerationErrors" >> dlq_sink("SummaryGenerationErrors")
        summary_results_tuple.storage_errors | "DLQ_SummaryStorageErrors" >> dlq_sink("SummaryStorageErrors")
        summary_results_tuple.main | "DebugLogStoredSummaries" >> DebugLogDoFn(label="StoredSummaries")

        # --- Lying Score Calculation Branch (Updates Q&As in Firestore) ---
        # Input: parsed_event_data (which now contains 'user_id', 'question_id', 'question_text', 'answer_text')
        lying_score_input = (
            parsed_event_data # Use parsed_event_data directly
            | "FormatForLyingScore" >> beam.Map(
                lambda x: {
                    'profile_id': x['user_id'], 
                    'qa_id': x['question_id'], 
                    'qa_data': {
                        'question': x.get('question_text'), 
                        'answer': x.get('answer_text')
                    }
                }
            )
        )
        lying_score_input | "DebugLogLyingScoreInput" >> DebugLogDoFn(label="LyingScoreInput")

        calculated_lying_scores_results = (
            lying_score_input
            | "CalculateLyingScores" >> beam.ParDo(CalculateLyingScoreDoFn(project_id=known_args.project))
              .with_outputs(CalculateLyingScoreDoFn.OUTPUT_ERROR_TAG, main='main')
        )
        lying_score_errors = calculated_lying_scores_results[CalculateLyingScoreDoFn.OUTPUT_ERROR_TAG]
        lying_score_errors | "DLQ_LyingScoreErrors" >> dlq_sink("LyingScoreErrors")
        calculated_lying_scores = calculated_lying_scores_results.main
        calculated_lying_scores | "DebugLogCalculatedLyingScores" >> DebugLogDoFn(label="CalculatedLyingScores")
        
        update_lying_score_results = ( # Sink operation
            calculated_lying_scores
            | "UpdateLyingScoresInProfile" >> beam.ParDo(UpdateLyingScoreDoFn(project_id=known_args.project))
              .with_outputs(UpdateLyingScoreDoFn.OUTPUT_ERROR_TAG, main='main')
        )
        update_lying_score_errors = update_lying_score_results[UpdateLyingScoreDoFn.OUTPUT_ERROR_TAG]
        update_lying_score_errors | "DLQ_UpdateLyingScoreErrors" >> dlq_sink("UpdateLyingScoreErrors")

        # --- New Granular Embedding, Scoreboard, and Candidate Fetching Flow ---
        # 1. Parse Answer into Statements
        parsed_statements_results = (
            processed_profile_data  # verified profiles only; preserves user_id/question_id/question_text/answer_text
            | "ParseAnswerToStatements" >> ParseAnswerIntoStatements(
                  project_id=known_args.project
              )
        )
        parsed_statements_results.error | "DLQ_ParseStatementsErrors" >> dlq_sink("ParseStatementsErrors")
        # parsed_statements_results.main is PCollection of elements like input, augmented with 'parsed_statements' list
        parsed_statements_results.main | "DebugLogParsedStatementsElement" >> DebugLogDoFn(label="ParsedStatementsElement")

        # 2. Delete stale scoreboard evidence and vectors for this edited
        # answer before generating replacement statement embeddings. This keeps
        # both Firestore ranking evidence and Pinecone vectors consistent with
        # the current answer version.
        stale_scoreboard_cleanup_results = (
            parsed_statements_results.main
            | "DeleteStaleScoreboardEvidence" >> DeleteStaleScoreboardEvidence(
                project_id=known_args.project,
                collection_name=match_candidate_scoreboard_collection
            )
        )
        stale_scoreboard_cleanup_results.error | "DLQ_StaleScoreboardCleanupErrors" >> dlq_sink("StaleScoreboardCleanupErrors")

        stale_vector_cleanup_results = (
            stale_scoreboard_cleanup_results.main
            | "DeleteStaleQuestionVectors" >> DeleteStaleQuestionVectors(
                project_id=known_args.project,
                pinecone_region=known_args.pinecone_region,
                pinecone_index=known_args.pinecone_index
            )
        )
        stale_vector_cleanup_results.error | "DLQ_StaleVectorCleanupErrors" >> dlq_sink("StaleVectorCleanupErrors")

        # 3. Generate Embeddings for Statements
        statement_embeddings = (
            stale_vector_cleanup_results.main
            | "GenerateStatementEmbeddings" >> GenerateEmbeddingsForStatements(
                project_id=known_args.project
              )
            # Output: (vector_id, embedding_vector, metadata)
        )
        statement_embeddings | "DebugLogStatementEmbeddings" >> DebugLogDoFn(label="StatementEmbeddingsGenerated")

        # 4. Store Statement Embeddings (Sink)
        store_statement_embeddings_results = (
            statement_embeddings
            | "StoreStatementEmbeddings" >> StoreIndividualEmbeddingsInPinecone(
                project_id=known_args.project,
                pinecone_region=known_args.pinecone_region,
                pinecone_index=known_args.pinecone_index
            )
        )
        store_statement_embeddings_results.error | "DLQ_StoreStatementEmbeddingsErrors" >> dlq_sink("StoreStatementEmbeddingsErrors")
        store_statement_embeddings_results.main | "DebugLogStoredStatementEmbeddings" >> DebugLogDoFn("StoredStatementEmbeddings")

        # 5. Query Pinecone for Matches per Statement
        statement_match_hits_results = (
            statement_embeddings
            | "QueryStatementMatches" >> QueryMatchesFromPinecone( # This is the NEW PTransform from pinecone_ops.py
                project_id=known_args.project,
                pinecone_region=known_args.pinecone_region,
                pinecone_index=known_args.pinecone_index,
                top_k=known_args.top_k 
            )
        )
        statement_match_hits_results.error | "DLQ_StatementQueryErrors" >> dlq_sink("StatementQueryErrors")
        statement_match_hits_results.main | "DebugLogStatementMatchHits" >> DebugLogDoFn(label="StatementMatchHits")

        # 6. Update Scoreboard
        scoreboard_update_results = (
            statement_match_hits_results.main
            | "UpdateMatchScoreboard" >> WriteToScoreboard(
                project_id=known_args.project,
                collection_name=match_candidate_scoreboard_collection,
                weight_preference_fulfillment=known_args.weight_preference_fulfillment,
                weight_attribute_similarity=known_args.weight_attribute_similarity
            )
        )
        scoreboard_update_results.error | "DLQ_ScoreboardUpdateErrors" >> dlq_sink("ScoreboardUpdateErrors")
        scoreboard_update_results.main | "DebugLogScoreboardUpdates" >> DebugLogDoFn(label="ScoreboardUpdatePColl") # Debug the pass-through elements
        
        # 7. Prepare for Fetching Top Candidates only after successful
        # scoreboard writes. This prevents reranking from reading candidate
        # scores before the fresh evidence for this event has been committed.
        distinct_triggering_users = (
            scoreboard_update_results.main
            | "ExtractTriggeringUserIdAfterScoreboardUpdate" >> beam.Map(lambda x: x['triggering_user_id'])
            | "DistinctTriggeringUsersAfterScoreboardUpdate" >> beam.Distinct()
        )
        distinct_triggering_users | "DebugLogDistinctUsersForRerank" >> DebugLogDoFn(label="DistinctTriggeringUsersForRerank")

        # 8. Fetch Top Candidates from Scoreboard
        top_candidates_for_reranking_results = (
            distinct_triggering_users
            | "FetchTopCandidatesFromScoreboard" >> FetchTopCandidatesFromScoreboard(
                 project_id=known_args.project,
                collection_name=match_candidate_scoreboard_collection,
                top_n=known_args.rerank_top_n 
            )
        )
        # The existing DLQ sink for fetch_candidates_errors (line 415) can be removed or reused here.
        # Replacing: fetch_candidates_errors | "DLQ_FetchCandidatesErrors" >> dlq_sink("FetchCandidatesErrors")
        top_candidates_for_reranking_results.error | "DLQ_FetchTopCandidatesErrors" >> dlq_sink("FetchCandidatesErrors") # Reused DLQ label for now
        
        top_candidates_for_reranking = top_candidates_for_reranking_results.main
        # This 'top_candidates_for_reranking' PCollection is now correctly defined.
        # The existing "DebugLogTopCandidatesForReranking" can be applied to this PCollection (line 416).
        top_candidates_for_reranking | "DebugLogTopCandidatesForReranking" >> DebugLogDoFn(label="TopCandidatesForReranking")

        # --- END OF NEW GRANULAR EMBEDDING & SCOREBOARD FLOW ---

        # --- Generate Candidates for Next Question (Layers 1, 2, 3, 4) --- #
        # Layer 1 & 2 are based on processed_profile_data

        # Layer 1: Clarification (triggered only if applicable based on incoming data)
        layer1_candidates_tagged, layer1_errors = (
            processed_profile_data
            | "GenerateLayer1Candidates" >> beam.ParDo(Layer1CandidateDoFn(
                project_id=known_args.project,
                location=known_args.region, # Use region as location for Vertex
                qa_collection_name=qa_collection_name
                # clarification_tag uses default
                # model_name uses default
            )).with_outputs(Layer1CandidateDoFn.OUTPUT_CANDIDATES_TAG, Layer1CandidateDoFn.OUTPUT_ERROR_TAG)
        )
        layer1_errors | "DLQ_Layer1Errors" >> dlq_sink("Layer1Errors")
        # layer1_candidates_tagged is PCollection of (user_id, [list_of_L1_cands])

        # Layer 2: Foundational Questions
        layer2_results = (
            processed_profile_data
            | "GenerateLayer2Candidates" >> beam.ParDo(Layer2CandidateDoFn(
                project_id=known_args.project,
                profiles_collection=user_info_collection
            )).with_outputs(Layer2CandidateDoFn.OUTPUT_ERROR_TAG, main='main')
        )
        layer2_candidates_tagged = (
            layer2_results['main']
            | "KeyLayer2Candidates" >> beam.Map(lambda x: (x['user_id'], x.get('candidates', [])))
        )
        layer2_errors = layer2_results[Layer2CandidateDoFn.OUTPUT_ERROR_TAG]
        layer2_errors | "DLQ_Layer2Errors" >> dlq_sink("Layer2Errors")
        # layer2_candidates_tagged is PCollection of (user_id, [list_of_L2_cands])

        # Layer 3: Semantic Gap Questions 
        # Adapting Layer 3 to use top_candidates_for_reranking from the new scoreboard flow.
        # Input to Layer3CandidateDoFn.process needs to be a dict: {'user_id': ..., 'matches': [...]}
        # where 'matches' is the list of candidate dicts.
        # top_candidates_for_reranking is PCollection of (triggering_user_id, list_of_candidate_dicts)
        
        layer3_input = (
            top_candidates_for_reranking
            | "FormatInputForLayer3" >> beam.Map(lambda x: {'user_id': x[0], 'matches': x[1]})
        )
        layer3_input | "DebugLogLayer3Input" >> DebugLogDoFn(label="Layer3Input")

        layer3_results = (
            layer3_input
            | "GenerateLayer3Candidates" >> beam.ParDo(Layer3CandidateDoFn(
                project_id=known_args.project,
                location=known_args.region, # Ensure location is passed if needed by LLM client
                profiles_collection=user_info_collection, # Pass relevant collections
                qa_collection_name=qa_collection_name
                # model_name uses default from Layer3CandidateDoFn definition
            )).with_outputs(Layer3CandidateDoFn.OUTPUT_ERROR_TAG, main=Layer3CandidateDoFn.OUTPUT_CANDIDATES_TAG)
        )
        layer3_errors = layer3_results[Layer3CandidateDoFn.OUTPUT_ERROR_TAG]
        layer3_candidates_tagged = layer3_results[Layer3CandidateDoFn.OUTPUT_CANDIDATES_TAG] # This is (user_id, list_of_L3_cands])
        
        layer3_errors | "DLQ_Layer3Errors" >> dlq_sink("Layer3Errors")
        layer3_candidates_tagged | "DebugLogLayer3Candidates" >> DebugLogDoFn(label="Layer3CandidatesOutput")

        # Layer 4: Assessment Templates (Needs user history)
        layer4_results = (
             user_history_keyed # Input is (user_id, list_of_qa_dicts)
             | "GenerateLayer4Candidates" >> beam.ParDo(Layer4CandidateDoFn(
                 project_id=known_args.project
             )).with_outputs(Layer4CandidateDoFn.OUTPUT_ERROR_TAG, main=Layer4CandidateDoFn.OUTPUT_CANDIDATES_TAG)
        )
        layer4_candidates_tagged = layer4_results[Layer4CandidateDoFn.OUTPUT_CANDIDATES_TAG]
        layer4_errors = layer4_results[Layer4CandidateDoFn.OUTPUT_ERROR_TAG]
        layer4_errors | "DLQ_Layer4Errors" >> dlq_sink("Layer4Errors") # DLQ sink for layer 4

        # --- Combine Candidate Layers and History --- #
        all_candidates_and_history = (
            {
                Layer1CandidateDoFn.OUTPUT_CANDIDATES_TAG: layer1_candidates_tagged,
                Layer2CandidateDoFn.__name__: layer2_candidates_tagged,
                Layer3CandidateDoFn.OUTPUT_CANDIDATES_TAG: layer3_candidates_tagged,
                Layer4CandidateDoFn.OUTPUT_CANDIDATES_TAG: layer4_candidates_tagged,
                FetchUserHistoryDoFn.HISTORY_TAG: user_history_keyed,
            }
            | "CombineAllCandidatesAndHistory" >> beam.CoGroupByKey()
        )
        all_candidates_and_history | "DebugLogCombinedCandidates" >> DebugLogDoFn("CombinedCandidatesForNextQ")

        # --- Select and Update Next Question (First Pass - before full reranking results) --- #
        # This selection happens based on candidate questions generated so far.
        # The reranking results will be used in a second pass of SelectBestQuestionDoFn later.
        selected_next_question_first_pass, selection_errors_first_pass = ( # Renamed to avoid conflict
            all_candidates_and_history 
            | "SelectBestNextQuestionFirstPass" >> beam.ParDo(SelectBestQuestionDoFn(
                 project_id=known_args.project,
                location=known_args.region,
                # reranking_results_tag=None # No reranking results for this pass yet
            ))
            .with_outputs(SelectBestQuestionDoFn.OUTPUT_ERROR_TAG, main='main')
        )
        selection_errors_first_pass | "DLQ_SelectionErrorsFirstPass" >> dlq_sink("SelectionErrorsFirstPass")

        # Note: UpdateNextQuestionDoFn for the first pass is deferred until after reranking
        # to potentially include insights from the top match. Or it can be done here if immediate update is preferred.
        # For now, the main `selected_next_question` and `update_next_q_errors` are later in the code.

        # --- Reranking Logic using new top_candidates_for_reranking --- #
        
        # The old join logic (JoinScoresMatchesAndHistory) has been removed as the new 
        # top_candidates_for_reranking PCollection from the scoreboard flow provides the necessary candidate list.

        # The DLQ for fetch_candidates_errors (line 415 of original) was handled by the new FetchTopCandidatesFromScoreboard results
        # The DebugLog for top_candidates_for_reranking (line 416 of original) is kept with the new definition.

        # Stage 1 Reranking: Cross-Encoder
        # Input: top_candidates_for_reranking - (triggering_user_id, list_of_top_candidate_dicts from scoreboard)
        # Output (main): (triggering_user_id, list_of_candidates_with_cross_encoder_scores)
        cross_encoded_candidates_results = ( # Renamed for PCollectionTuple
            top_candidates_for_reranking # This is now correctly defined from scoreboard flow
            | "CrossEncodeTopCandidates" >> CrossEncodeCandidates(
                project_id=known_args.project,
                profiles_collection=user_info_collection, 
                profile_summaries_collection=profile_summaries_collection, # Added this argument
                model_name='cross-encoder/ms-marco-MiniLM-L-6-v2' # Explicitly set, can be arg later
            )
            # CrossEncodeCandidates PTransform already uses with_outputs internally
        )
        cross_encoded_candidates_results.error | "DLQ_CrossEncodeErrors" >> dlq_sink("CrossEncodeErrors")
        cross_encoded_candidates = cross_encoded_candidates_results.main
        cross_encoded_candidates | "DebugLogCrossEncodedCandidates" >> DebugLogDoFn(label="CrossEncodedCandidates")

        # Prepare input for the final LLM Reranking stage
        # We need: 
        # 1. cross_encoded_candidates: (triggering_user_id, list_of_candidates_with_cross_encoder_scores)
        # 2. user_history_keyed: (triggering_user_id, list_of_qa_dicts) - for 'user_qas'

        # Define tags for CoGroupByKey
        CROSS_ENCODED_TAG = 'cross_encoded_candidates'
        USER_HISTORY_TAG = 'user_history_for_rerank'

        # Key user_history_keyed again if it's not already suitable (it should be (user_id, data))
        # user_history_keyed is already (user_id, list_of_qa_dicts)

        inputs_for_llm_rerank = (
            {
                CROSS_ENCODED_TAG: cross_encoded_candidates, # (triggering_user_id, list_of_candidates)
                USER_HISTORY_TAG: user_history_keyed      # (triggering_user_id, user_qas_list)
            }
            | "CoGroupForLLMRerank" >> beam.CoGroupByKey()
            # Output of CoGroupByKey: (triggering_user_id, {CROSS_ENCODED_TAG: [list_of_candidates], USER_HISTORY_TAG: [user_qas_list]})
        )

        # DoFn to format the CoGroupByKey output for RerankAndScoreMatches
        class FormatForLLMRerankDoFn(beam.DoFn):
            def process(self, element):
                triggering_user_id, grouped_data = element
                cross_encoded_list = grouped_data.get(CROSS_ENCODED_TAG, [])
                user_qas_list = grouped_data.get(USER_HISTORY_TAG, [])

                if not cross_encoded_list: # Should be a list containing one item: the list of candidates
                    logger.warning(f"Missing cross-encoded candidates for user {triggering_user_id} in CoGroup output. Skipping LLM rerank.")
                    # Optionally yield to an error tag here if this is unexpected
                    return 
                
                # cross_encoded_list[0] is the actual list_of_candidates from cross_encoded_candidates PCollection
                # user_qas_list[0] is the actual list_of_qa_dicts from user_history_keyed PCollection
                
                candidates = cross_encoded_list[0] if cross_encoded_list else []
                user_qas = user_qas_list[0] if user_qas_list else {}

                yield (triggering_user_id, {'candidates': candidates, 'user_qas': user_qas})

        prepared_for_llm_rerank = (
            inputs_for_llm_rerank
            | "FormatForLLMRerank" >> beam.ParDo(FormatForLLMRerankDoFn())
        )
        prepared_for_llm_rerank | "DebugLogPreparedForLLMRerank" >> DebugLogDoFn(label="PreparedForLLMRerank")

        # Stage 2 Reranking: LLM-based (uses the adapted RerankAndScoreMatches)
        # Input: (triggering_user_id, {'candidates': list_of_candidates_with_scores, 'user_qas': user_qas_dict})
        # Output (main): {'user_id': ..., 'matches': [...], 'user_qas': ...}
        # Output (error): Error dictionary
        reranked_matches_data_results = ( # Renamed for PCollectionTuple
            prepared_for_llm_rerank 
            | "RerankTopCandidatesWithLLM" >> RerankAndScoreMatches(
                project_id=known_args.project,
                profiles_collection=user_info_collection, 
                pdf_bucket=known_args.pdf_bucket,
                pdf_instructions_path=known_args.pdf_instructions_path
            )
        )
        reranked_matches_data_results.error | "DLQ_LLMRerankingErrors" >> dlq_sink("LLMRerankingErrors")
        reranked_matches_data = reranked_matches_data_results.main # Get main output
        # OLD reranking_errors is now handled by reranked_matches_data_results.error
        # OLD: # reranking_errors | "DLQ_RerankingErrors" >> dlq_sink("RerankingErrors") # Old line

        final_match_eligibility_results = (
            reranked_matches_data
            | "ApplyFinalMatchEligibilityGate" >> ApplyFinalMatchEligibilityGate(
                project_id=known_args.project
            )
        )
        final_match_eligibility_results.error | "DLQ_FinalMatchEligibilityErrors" >> dlq_sink("FinalMatchEligibilityErrors")
        final_eligible_matches_data = final_match_eligibility_results.main

        # Expected output of RerankAndScoreMatches (now RerankMatchesDoFn internally):
        # e.g., {
        #   'user_id': 'user123',
        #   'matches': [{'match_id': 'matchA', 'ai_score': 0.85, ...}, ...], # <<< Key is 'matches'
        #   'user_qas': { 'qid1': {'answer': '...', 'layer': 1}, ... }
        # }

        # Add step to calculate Adjusted Top Match Percentage
        def calculate_adjusted_top_match_percentage(element):
            user_id = element.get('user_id')
            matches_list = element.get('matches', [])
            user_qas = element.get('user_qas', {})

            raw_top_match_ai_score = None
            adjusted_top_match_percentage = None
            num_answered_core_questions_by_user = 0
            core_profile_completeness_factor = 0.0

            if matches_list:
                try:
                    top_match = matches_list[0]
                    raw_top_match_ai_score_raw = top_match.get('ai_score')

                    raw_top_match_ai_score = normalize_ai_score_to_unit(raw_top_match_ai_score_raw)

                    if raw_top_match_ai_score is not None:

                        for qa_id, qa_data in user_qas.items():
                            layer = qa_data.get('layer')
                            if layer == FOUNDATIONAL_LAYER or layer == INSIGHT_LAYER:
                                num_answered_core_questions_by_user += 1
                        
                        if config.TOTAL_CORE_QUESTIONS_IN_SYSTEM > 0:
                            core_profile_completeness_factor = min(1.0, num_answered_core_questions_by_user / config.TOTAL_CORE_QUESTIONS_IN_SYSTEM)
                        else:
                            core_profile_completeness_factor = 1.0

                        adjusted_percentage_float = raw_top_match_ai_score * (
                            config.MIN_CONFIDENCE_WEIGHT + (1 - config.MIN_CONFIDENCE_WEIGHT) * core_profile_completeness_factor
                        )
                        adjusted_top_match_percentage = round(adjusted_percentage_float * 100)

                except Exception as e:
                    logger.error(f"Error calculating adjusted top score for {user_id}: {e}")
            
            element['topMatchPercentage'] = adjusted_top_match_percentage
            element['rawTopMatchAiScore'] = raw_top_match_ai_score # Store as 0-1
            element['currentUserCoreProfileCompletenessFactor'] = core_profile_completeness_factor
            element['currentUserAnsweredCoreQuestionsCount'] = num_answered_core_questions_by_user
            element['totalCoreQuestionsInSystem'] = config.TOTAL_CORE_QUESTIONS_IN_SYSTEM
            element['minConfidenceWeightUsed'] = config.MIN_CONFIDENCE_WEIGHT
            return element

        matches_with_percentage = (
            final_eligible_matches_data # Authoritatively filtered before percentage calculation and side effects
            | "CalculateAdjustedTopMatchPercentage" >> beam.Map(calculate_adjusted_top_match_percentage)
        )

        # --- Combine Candidate Layers, History, AND Reranking Results (FOR FINAL NEXT QUESTION SELECTION) --- #
        RERANKING_RESULTS_TAG = 'reranking_results' 
        all_inputs_for_final_selection = ( # Renamed variable
            {
                # Branch B Outputs (Candidate Generation Layers) - from previous CoGroupByKey
                # We need to re-key all_candidates_and_history if it's not suitable
                # all_candidates_and_history is (user_id, {tag: [values], ...})
                # Let's just use its output directly for the tags.
                # This assumes SelectBestQuestionDoFn can handle this structure if we pass the dict of PCollections.
                # Alternative: Re-structure SelectBestQuestionDoFn or flatten all_candidates_and_history.
                # For now, let's assume SelectBestQuestionDoFn is adapted or we prepare inputs for it.

                # This CoGroupByKey combines the output of the *first* "CombineAllCandidatesAndHistory"
                # with the *new* "keyed_reranked_matches".
                'candidates_and_history_grouped': all_candidates_and_history, # (user_id, {tag: [values], ...})
                RERANKING_RESULTS_TAG: matches_with_percentage # (user_id, reranked_match_data_dict)
            }
            | "CombineAllInputsForFinalSelection" >> beam.CoGroupByKey()
        )
        all_inputs_for_final_selection | "DebugLogCombinedForFinalSelect" >> DebugLogDoFn("CombinedForAllInputsFinalSelect")

        # --- Prepare for Final Next Question Selection: Flatten CoGroupByKey output --- #
        class FlattenFinalSelectionInputDoFn(beam.DoFn):
            # Define tags as class attributes to ensure they are consistent with SelectBestQuestionDoFn
            # These should match the tags used in the initial CoGroupByKey for candidates/history
            # and the reranking results tag.
            L1_TAG = Layer1CandidateDoFn.OUTPUT_CANDIDATES_TAG
            L2_TAG = Layer2CandidateDoFn.__name__ # Or whatever was used as key
            L3_TAG = Layer3CandidateDoFn.OUTPUT_CANDIDATES_TAG
            L4_TAG = Layer4CandidateDoFn.OUTPUT_CANDIDATES_TAG # Assuming it was Layer4CandidateDoFn.OUTPUT_CANDIDATES_TAG
            HISTORY_TAG = FetchUserHistoryDoFn.HISTORY_TAG 
            RERANK_TAG = RERANKING_RESULTS_TAG # Defined as 'reranking_results'

            CANDIDATES_HISTORY_GROUP_KEY = 'candidates_and_history_grouped'

            def process(self, element):
                user_id, grouped_data = element
                
                flat_data = {}
                
                # Extract from the nested 'candidates_and_history_grouped'
                candidates_history_list = grouped_data.get(self.CANDIDATES_HISTORY_GROUP_KEY, [])
                if candidates_history_list:
                    # candidates_history_list[0] is the dict from the first CoGroupByKey
                    # e.g., {L1_TAG: [...], L2_TAG: [...], HISTORY_TAG: [...]}
                    nested_dict = candidates_history_list[0]
                    flat_data[self.L1_TAG] = nested_dict.get(self.L1_TAG, [])
                    flat_data[self.L2_TAG] = nested_dict.get(self.L2_TAG, [])
                    flat_data[self.L3_TAG] = nested_dict.get(self.L3_TAG, [])
                    flat_data[self.L4_TAG] = nested_dict.get(self.L4_TAG, [])
                    flat_data[self.HISTORY_TAG] = nested_dict.get(self.HISTORY_TAG, [])
                else:
                    # Ensure keys exist even if empty, as SelectBestQuestionDoFn might expect them
                    flat_data[self.L1_TAG] = []
                    flat_data[self.L2_TAG] = []
                    flat_data[self.L3_TAG] = []
                    flat_data[self.L4_TAG] = []
                    flat_data[self.HISTORY_TAG] = []

                # Add the reranking results (which is already a list from CoGroupByKey)
                flat_data[self.RERANK_TAG] = grouped_data.get(self.RERANK_TAG, [])
                
                yield (user_id, flat_data)

        flattened_input_for_final_selection = (
            all_inputs_for_final_selection
            | "FlattenFinalSelectionInput" >> beam.ParDo(FlattenFinalSelectionInputDoFn())
        )
        flattened_input_for_final_selection | "DebugLogFlattenedFinalSelect" >> DebugLogDoFn("FlattenedInputForFinalSelect")

        # --- Select and Update Next Question (Second Pass - with Reranking Results) --- #
        # This SelectBestQuestionDoFn call should ideally use the reranking_results
        selected_next_question_final, selection_errors_final = ( # Renamed
            flattened_input_for_final_selection  # Use the flattened input
            | "SelectBestNextQuestionFinalPass" >> beam.ParDo(SelectBestQuestionDoFn( 
                project_id=known_args.project,
                location=known_args.region,
                reranking_results_tag=RERANKING_RESULTS_TAG # Pass the tag name
                # candidates_history_tag is not needed as input is now flat
            ))
            .with_outputs(SelectBestQuestionDoFn.OUTPUT_ERROR_TAG, main='main')
        )
        selection_errors_final | "DLQ_SelectionErrorsFinalPass" >> dlq_sink("SelectionErrorsFinalPass") # Changed DLQ label

        _, update_next_q_errors = ( # This uses the final selected question
             selected_next_question_final 
            | "UpdateNextQuestionSuggestion" >> beam.ParDo(UpdateNextQuestionDoFn(
                project_id=known_args.project
            )).with_outputs(UpdateNextQuestionDoFn.OUTPUT_ERROR_TAG, main='main')
        )
        update_next_q_errors | "DLQ_UpdateNextQErrors" >> dlq_sink("UpdateNextQErrors")

        # --- Final Output/Actions (using matches_with_percentage from Branch A) --- #

        # Write all final results, including an empty matches list, so the UI and
        # stored state are cleared when the final eligibility gate removes every
        # candidate. Side effects below run only for non-empty final match sets.
        write_match_results = (
            matches_with_percentage # Use the result from Branch A
            | "WriteMatchesToFirestore" >> WriteMatchesToFirestore(
                project_id=known_args.project,
                collection_name=matches_collection
            )
        )
        write_match_errors = write_match_results.error
        write_match_errors | "DLQ_WriteMatchErrors" >> dlq_sink("WriteMatchErrors")
        successful_match_writes = write_match_results.main

        non_empty_matches_for_side_effects = (
            successful_match_writes
            | "FilterNonEmptyMatchesForSideEffects" >> beam.Filter(lambda element: bool(element.get('matches')))
        )

        # Schedule Delayed Matching
        schedule_results = (
            non_empty_matches_for_side_effects
            | "ScheduleDelayedMatching" >> ScheduleDelayedMatching(
                 project_id=known_args.project,
                 location=known_args.tasks_location,
                 queue_name=known_args.delayed_matching_queue,
                topic_name=known_args.delayed_matching_pubsub_topic,
                delay_seconds=known_args.delayed_task_delay_seconds,
                service_account_email=known_args.service_account_email
             )
        )
        schedule_errors = schedule_results.error
        schedule_errors | "DLQ_ScheduleErrors" >> dlq_sink("ScheduleErrors")

        # Handle Actions (Notifications/Voice)
        action_results = (
             non_empty_matches_for_side_effects
             | "HandleMatchActions" >> HandleMatchActions(
                project_id=known_args.project,
                location=known_args.tasks_location,
                notification_queue=known_args.notification_queue,
                voice_agent_queue=known_args.voice_agent_queue,
                notification_function_url=known_args.notification_function_url,
                voice_agent_function_url=known_args.voice_agent_function_url,
                service_account_email=known_args.service_account_email
             )
         )
        action_errors = action_results.error
        action_errors | "DLQ_ActionErrors" >> dlq_sink("ActionErrors")

        logger.info("Streaming pipeline graph built.")

if __name__ == "__main__":
    run_streaming_pipeline()
