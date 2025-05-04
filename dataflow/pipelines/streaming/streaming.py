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
calculates lying scores (based on QA edit history), generates embeddings,
queries Pinecone for matches, joins scores and matches using CoGroupByKey,
reranks matches based on compatibility and joined scores,
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
from .common.definitions import COLLECTIONS, DEFAULT_LOCATION # Import COLLECTIONS
from .utils.firestore_helpers import get_all_user_qas # Import history fetch helper

# Import modular components
from .transforms.common import (
    MetricNames,
    ParseFirestoreTriggerEventDoFn,
    WriteToDLQFn,
    DebugLogDoFn,
    FetchUserHistoryDoFn,
    LogElement,
    LogError
)
from .transforms.profile_processing import ProcessAndValidateProfile
from .transforms.embedding import GenerateProfileEmbedding
from .transforms.pinecone_ops import StoreEmbeddingInPinecone, QueryMatchesFromPinecone
from .transforms.reranking import (
    RerankAndScoreMatches, # The composite transform (expects modified input)
    CalculateLyingScoreDoFn # Used in the score calculation branch
)
# Import the new grouping helpers
from .transforms.grouping_helpers import (
    ExtractQAsForScoringDoFn,
    AggregateScoresDoFn,
    UpdateAllScoresDoFn,
    ProcessJoinedDataDoFn,
    FilterDenseMatchesDoFn,
    AddUserToMatchesDoFn,
    FetchMatchDataDoFn
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
from .transforms.scheduling import ScheduleDelayedMatching, HandleMatchActions
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
    parser.add_argument('--top_k', type=int, default=20, help='Number of nearest neighbors to query from Pinecone')

    # Reranking Config
    parser.add_argument('--pdf_bucket', required=True, help='GCS bucket containing the AI instructions PDF')
    parser.add_argument('--pdf_instructions_path', default='agent-instructions-1.0.pdf', help='Path to AI instructions PDF within the bucket')

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

        # --- Fetch User History (in parallel) --- #
        user_history_keyed = (
             parsed_event_data # Contains user_id
             | "FetchUserHistory" >> beam.ParDo(FetchUserHistoryDoFn(
                 project_id=known_args.project,
                 qa_collection_name=qa_collection_name
             ))
             # Output: (user_id, list_of_qa_dicts)
        )
        # TODO: Add error handling for FetchUserHistoryDoFn if needed

        # --- Process Profiles --- #
        processed_immediate, immediate_proc_errors = (
            parsed_event_data
            | "ProcessImmediateProfiles" >> ProcessAndValidateProfile(
                project_id=known_args.project,
                collection_name=user_info_collection
            ).with_outputs(ProcessAndValidateProfile.ERROR_TAG, main=ProcessAndValidateProfile.OUTPUT_TAG)
        )
        immediate_proc_errors | "DLQ_ImmediateProcErrors" >> dlq_sink("ImmediateProcErrors")
        # processed_immediate: {'user_id':..., 'profile_data':..., 'qa_id':..., 'answer':..., 'clarificationTag':...}

        processed_immediate | "DebugLogProcessedImmediate" >> DebugLogDoFn(label="ProcessedImmediate")

        # --- Generate Candidates for Next Question (Layers 1, 2, 3, 4) --- #

        # Layer 1: Clarification (triggered only if applicable based on incoming data)
        layer1_candidates_tagged, layer1_errors = (
            processed_immediate
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
        layer2_candidates_tagged, layer2_errors = (
            processed_immediate
            | "GenerateLayer2Candidates" >> beam.ParDo(Layer2CandidateDoFn(
                project_id=known_args.project,
                profiles_collection=user_info_collection
            )).with_outputs(Layer2CandidateDoFn.OUTPUT_ERROR_TAG, main='main')
            | "KeyLayer2Candidates" >> beam.Map(lambda x: (x['user_id'], x.get('candidates', [])))
        )
        layer2_errors | "DLQ_Layer2Errors" >> dlq_sink("Layer2Errors")
        # layer2_candidates_tagged is PCollection of (user_id, [list_of_L2_cands])

        # Layer 3: Semantic Gap Questions (Requires Matches)
        # First, we need the matching branch results...

        # --- Branch for Matching Logic (Parallel to Candidate Generation) --- #
        # ... (Lying score calculation: extract_qa_errors, calculated_scores_per_qa, aggregated_scores)
        # ... (Embedding: immediate_embeddings)
        # ... (Store Embedding: stored_immediate_embeddings)

        # Query Matches (using stored embeddings)
        pinecone_matches, query_errors = (
            processed_immediate
            | "QueryPineconeMatches" >> QueryMatchesFromPinecone(
                project_id=known_args.project,
                pinecone_region=known_args.pinecone_region,
                pinecone_index=known_args.pinecone_index,
                top_k=known_args.top_k
            ).with_outputs(QueryMatchesFromPinecone.ERROR_TAG, main=QueryMatchesFromPinecone.OUTPUT_TAG)
        )
        query_errors | "DLQ_QueryErrors" >> dlq_sink("QueryErrors")

        # Filter Matches for Density
        filtered_matches, filter_errors = (
             pinecone_matches
             | "FilterDenseMatches" >> beam.ParDo(FilterDenseMatchesDoFn())
             .with_outputs(FilterDenseMatchesDoFn.OUTPUT_ERROR_TAG, main='main')
        )
        filter_errors | "DLQ_FilterMatchErrors" >> dlq_sink("FilterMatchErrors")
        # filtered_matches is PCollection of {'user_id': ..., 'matches': [...]} keyed by user_id
        keyed_filtered_matches = filtered_matches | "KeyFilteredMatches" >> beam.Map(lambda x: (x['user_id'], x))

        # Generate Layer 3 Candidates using filtered matches
        layer3_candidates_tagged, layer3_errors = (
            keyed_filtered_matches
            | "MapToLayer3Input" >> beam.Map(lambda x: x[1])
            | "GenerateLayer3Candidates" >> beam.ParDo(Layer3CandidateDoFn(
                project_id=known_args.project,
                location=known_args.region,
                profiles_collection=user_info_collection,
                qa_collection_name=qa_collection_name
            )).with_outputs(Layer3CandidateDoFn.OUTPUT_CANDIDATES_TAG, Layer3CandidateDoFn.OUTPUT_ERROR_TAG)
        )
        layer3_errors | "DLQ_Layer3Errors" >> dlq_sink("Layer3Errors")
        # layer3_candidates_tagged is PCollection of (user_id, [list_of_L3_cands])

        # Layer 4: Assessment Templates (Needs user history)
        layer4_candidates_tagged, layer4_errors = (
             user_history_keyed.history # Input is (user_id, list_of_qa_dicts)
             | "GenerateLayer4Candidates" >> beam.ParDo(Layer4CandidateDoFn(
                 project_id=known_args.project
             )).with_outputs(Layer4CandidateDoFn.OUTPUT_ERROR_TAG, main=Layer4CandidateDoFn.OUTPUT_CANDIDATES_TAG)
        )
        layer4_candidates = layer4_candidates_tagged[Layer4CandidateDoFn.OUTPUT_CANDIDATES_TAG]
        layer4_errors = layer4_candidates_tagged[Layer4CandidateDoFn.OUTPUT_ERROR_TAG]

        # --- Combine Candidate Layers and History --- #
        all_candidates_and_history = (
            {
                Layer1CandidateDoFn.OUTPUT_CANDIDATES_TAG: layer1_candidates_tagged,
                Layer2CandidateDoFn.__name__: layer2_candidates_tagged,
                Layer3CandidateDoFn.OUTPUT_CANDIDATES_TAG: layer3_candidates_tagged,
                Layer4CandidateDoFn.OUTPUT_CANDIDATES_TAG: layer4_candidates_tagged,
                FetchUserHistoryDoFn.HISTORY_TAG: user_history_keyed.history # Add history
            }
            | "CombineAllCandidatesAndHistory" >> beam.CoGroupByKey()
        )

        # --- Select and Update Next Question --- #
        selected_next_question, selection_errors = (
            all_candidates_and_history # Use combined data
            | "SelectBestNextQuestion" >> beam.ParDo(SelectBestQuestionDoFn(
                project_id=known_args.project, # Pass project_id
                location=known_args.region # Pass location (region)
                # semantic_model_name etc. use defaults
            ))
            .with_outputs(SelectBestQuestionDoFn.OUTPUT_ERROR_TAG, main='main')
        )
        selection_errors | "DLQ_SelectionErrors" >> dlq_sink("SelectionErrors")

        _, update_next_q_errors = (
             selected_next_question
             | "UpdateNextQuestionSuggestion" >> beam.ParDo(UpdateNextQuestionDoFn(
                 project_id=known_args.project
             )).with_outputs(UpdateNextQuestionDoFn.OUTPUT_ERROR_TAG, main='main')
        )
        update_next_q_errors | "DLQ_UpdateNextQErrors" >> dlq_sink("UpdateNextQErrors")

        # --- Continue with Reranking Logic using Matches and Scores --- #

        # We need to join aggregated_scores and keyed_filtered_matches
        joined_scores_and_matches = (
             {
                 'scores': aggregated_scores, # (user_id, score_dict)
                 'matches': keyed_filtered_matches # (user_id, matches_dict)
             }
             | "JoinScoresAndMatches" >> beam.CoGroupByKey()
             | "ProcessJoinedData" >> beam.ParDo(ProcessJoinedDataDoFn())
        )

        # Assuming RerankAndScoreMatches takes {'user_id': ..., 'scores': ..., 'matches': ...}
        reranked_matches, reranking_errors = (
            joined_scores_and_matches
            | "RerankAndScoreMatches" >> RerankAndScoreMatches(
                project_id=known_args.project,
                pdf_bucket=known_args.pdf_bucket,
                pdf_instructions_path=known_args.pdf_instructions_path
            ).with_outputs(RerankAndScoreMatches.ERROR_TAG, main=RerankAndScoreMatches.OUTPUT_TAG)
        )
        reranking_errors | "DLQ_RerankingErrors" >> dlq_sink("RerankingErrors")

        # --- Final Output/Actions --- #

        # Write reranked matches to Firestore
        _, write_match_errors = (
            reranked_matches
            | "WriteMatchesToFirestore" >> WriteMatchesToFirestore(
                project_id=known_args.project,
                collection_name=matches_collection
            ).with_outputs(WriteMatchesToFirestore.ERROR_TAG, main=WriteMatchesToFirestore.OUTPUT_TAG)
        )
        write_match_errors | "DLQ_WriteMatchErrors" >> dlq_sink("WriteMatchErrors")

        # Schedule Delayed Matching
        _, schedule_errors = (
            reranked_matches # Could also trigger from processed_immediate if needed sooner
            | "ScheduleDelayedMatching" >> ScheduleDelayedMatching(
                project_id=known_args.project,
                location=known_args.tasks_location,
                queue_name=known_args.delayed_matching_queue,
                target_topic=known_args.delayed_matching_pubsub_topic,
                delay_seconds=known_args.delayed_task_delay_seconds,
                service_account_email=known_args.service_account_email # For task authentication
            ).with_outputs(ScheduleDelayedMatching.ERROR_TAG, main=ScheduleDelayedMatching.OUTPUT_TAG)
        )
        schedule_errors | "DLQ_ScheduleErrors" >> dlq_sink("ScheduleErrors")

        # Handle Actions (Notifications/Voice)
        _, action_errors = (
             reranked_matches # Trigger actions based on final matches
             | "HandleMatchActions" >> HandleMatchActions(
                 project_id=known_args.project,
                 location=known_args.tasks_location,
                 notification_queue=known_args.notification_queue,
                 voice_agent_queue=known_args.voice_agent_queue,
                 notification_url=known_args.notification_function_url,
                 voice_agent_url=known_args.voice_agent_function_url,
                 service_account_email=known_args.service_account_email
             ).with_outputs(HandleMatchActions.ERROR_TAG, main=HandleMatchActions.OUTPUT_TAG)
         )
        action_errors | "DLQ_ActionErrors" >> dlq_sink("ActionErrors")

        logger.info("Streaming pipeline graph built.")

if __name__ == "__main__":
    run_streaming_pipeline()
