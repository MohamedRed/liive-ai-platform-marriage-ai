# apps/marriage-ai/dataflow/pipelines/streaming/transforms/profile_processing.py
import apache_beam as beam
import logging
import json
import traceback
from types import SimpleNamespace
from typing import Dict, Any, Tuple, Optional # Added Optional
from apache_beam.metrics import Metrics
# Import Firestore client
from google.cloud import firestore

# Import constants and metrics from common
from .common import MetricNames
# Import central COLLECTIONS definition
from ..common.definitions import COLLECTIONS

# Assume logger is configured in the main script
logger = logging.getLogger(__name__)

# --- Metrics for ExtractChangedQADoFn ---
# CHANGED_QA_EXTRACTION_ERRORS = 'ChangedQAExtractionErrors' # No longer needed
# CHANGED_QA_FOUND = 'ChangedQAFound' # No longer needed
# CHANGED_QA_MISSING_FIELDS = 'ChangedQAMissingFields' # No longer needed

# class ExtractChangedQADoFn(beam.DoFn): # This DoFn is no longer needed
#     """Extracts the specific Q&A that was changed from a Firestore trigger event."""
#     OUTPUT_ERROR_TAG = 'error' # Define an error tag
# 
#     def __init__(self, project_id: str): # project_id might be needed if Firestore fallback is implemented
#         self.project_id = project_id
# ... (rest of the DoFn implementation removed for brevity) ...
#             yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {"error_message": str(e), "element": element, "traceback": traceback.format_exc()})

# @beam.ptransform_fn # This PTransform is no longer needed
# def ExtractChangedQA(pcoll: beam.PCollection[Dict[str, Any]], project_id: str) -> beam.PCollectionTuple:
#     """
#     PTransform to extract individual changed Q&A pairs from Firestore trigger events.
# ... (rest of the PTransform implementation removed for brevity) ...
#     return results

class FetchProfileDoFn(beam.DoFn):
    OUTPUT_ERROR_TAG = 'error'

    def __init__(self, project_id, collection_name, is_test=False):
        self.project_id = project_id
        self.collection_name = collection_name # This should be USER_INFO collection
        self.is_test = is_test
        # Each DoFn instance gets its own logger and counter instances
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('FetchProfileDoFn', MetricNames.ERRORS)
        self.profiles_not_found = Metrics.counter('FetchProfileDoFn', 'profiles_not_found')
        self.db = None # Initialize db to None
        self.setup_error_message = None

    def setup(self):
        # Setup runs once per worker process
        if not self.is_test:
            try:
                self.db = firestore.Client(project=self.project_id)
                self.setup_error_message = None
                self.logger.info(f"FetchProfileDoFn: Firestore client initialized successfully for project {self.project_id}.")
            except Exception as e:
                self.setup_error_message = f"FetchProfileDoFn Firestore client setup failed: {str(e)}"
                self.logger.error(self.setup_error_message, exc_info=True)

    def process(self, event_dict: Dict[str, Any]): # Input is the event dictionary
        if not self.db and not self.is_test:
            error_message = self.setup_error_message or "FetchProfileDoFn: Firestore client not initialized"
            self.logger.error("%s. Skipping profile fetch.", error_message)
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": error_message,
                "element": event_dict,
            })
            return

        user_id = event_dict.get('user_id') if isinstance(event_dict, dict) else None
        if not user_id:
            self.logger.error(f"FetchProfileDoFn: Missing user_id in event dictionary: {event_dict}")
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": "Missing user_id in profile fetch event",
                "element": event_dict,
            })
            return

        try:
            self.logger.info(f"Fetching profile for user: {user_id} from {self.collection_name}")
            # Test logic might need slight adjustment if input is dict
            if self.is_test:
                # Simulate fetching based on user_id from event_dict
                test_profile = {
                    'id': user_id,
                    # Removed dummy verification fields
                    'questions_answers': {}
                }
                yield (test_profile, event_dict) # Yield tuple
                return

            doc_ref = self.db.collection(self.collection_name).document(user_id)
            doc = doc_ref.get()

            if not doc.exists:
                self.logger.warning(f"Profile {user_id} not found in collection {self.collection_name}")
                self.profiles_not_found.inc()
                yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                    "error_message": f"Profile {user_id} not found in {self.collection_name}",
                    "user_id": user_id,
                    "element": event_dict,
                })
                return

            profile = doc.to_dict()
            if profile is None:
                self.logger.error(f"Profile data for {user_id} is None after fetch.")
                self.error_counter.inc()
                yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                    "error_message": f"Profile data for {user_id} is None after fetch",
                    "user_id": user_id,
                    "element": event_dict,
                })
                return

            profile['id'] = user_id # Ensure ID is part of the profile dict
            yield (profile, event_dict) # Yield tuple: (fetched_profile, original_event_data)

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Error fetching profile for {user_id}: {str(e)}", exc_info=True)
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": f"Error fetching profile for {user_id}: {str(e)}",
                "user_id": user_id,
                "element": event_dict,
                "traceback": traceback.format_exc(),
            })

class ValidateProfileDoFn(beam.DoFn):
    """Validates if a user's identity and Wali relation are verified by checking Firestore verification collections."""
    OUTPUT_ERROR_TAG = 'error'

    def __init__(self, project_id: str, is_test: bool = False):
        self.project_id = project_id
        self.is_test = is_test
        self.logger = logging.getLogger(__name__)
        self.processed_counter = Metrics.counter('ValidateProfileDoFn', MetricNames.PROCESSED)
        self.validation_failed = Metrics.counter('ValidateProfileDoFn', 'validation_failed')
        self.verification_fetch_failed = Metrics.counter('ValidateProfileDoFn', 'verification_fetch_failed')
        self.error_counter = Metrics.counter('ValidateProfileDoFn', MetricNames.ERRORS)
        self.db = None # Firestore client
        self.setup_error_message = None
        # Get collection names from central definitions
        self.identity_verification_coll = COLLECTIONS['MARRIAGE']['IDENTITY_VERIFICATIONS']
        self.wali_verification_coll = COLLECTIONS['MARRIAGE']['USER_WALI_RELATION_VERIFICATIONS']

    def setup(self):
        # Setup Firestore client
        if not self.is_test:
            try:
                self.db = firestore.Client(project=self.project_id)
                self.setup_error_message = None
                self.logger.info("ValidateProfileDoFn: Firestore client initialized.")
            except Exception as e:
                self.setup_error_message = f"ValidateProfileDoFn Firestore client setup failed: {e}"
                self.logger.error(self.setup_error_message, exc_info=True)
        # else: self.logger.info("ValidateProfileDoFn: Running in test mode, Firestore client not initialized.") # Optional log for test mode

    def _is_verified(self, collection_name: str, user_id: str) -> bool:
        """Checks if a verification document exists and has status 'verified'."""
        if self.is_test:
            # In test mode, assume verified to allow pipeline flow
            self.logger.debug(f"TEST MODE: Assuming verification '{collection_name}' is TRUE for user {user_id}")
            return True
        if not self.db:
            raise RuntimeError(f"Firestore client not available for verification check ({collection_name}, user {user_id})")

        try:
            doc_ref = self.db.collection(collection_name).document(user_id)
            doc = doc_ref.get()
            if doc.exists:
                data = doc.to_dict()
                status = data.get('status')
                # Compare against the string value of the enum member
                if status == 'verified':
                    self.logger.debug(f"Verification check PASSED for user {user_id} in {collection_name}.")
                    return True
                else:
                    self.logger.info(f"Verification check FAILED for user {user_id} in {collection_name}. Status: {status}")
                    return False
            else:
                self.logger.info(f"Verification document NOT FOUND for user {user_id} in {collection_name}. Assuming not verified.")
                return False
        except Exception as e:
            self.logger.error(f"Error fetching verification status for user {user_id} from {collection_name}: {e}", exc_info=True)
            self.verification_fetch_failed.inc()
            raise RuntimeError(f"Verification fetch failed for user {user_id} from {collection_name}: {e}") from e

    def process(self, element: Tuple[Dict, Dict]): # Input is tuple: (profile, event_dict)
        try:
            profile, event_dict = element # Unpack the tuple
        except Exception as e:
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": f"Invalid validation input shape: {str(e)}",
                "element": element,
                "traceback": traceback.format_exc(),
            })
            return

        if not isinstance(profile, dict) or not isinstance(event_dict, dict):
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": "Invalid validation input fields",
                "element": element,
            })
            return

        user_id = profile.get('id', event_dict.get('user_id', '[UNKNOWN_ID]')) # Get ID for logging

        if not self.db and not self.is_test:
            error_message = self.setup_error_message or "ValidateProfileDoFn: Firestore client not initialized"
            self.logger.error("%s. Skipping profile validation for %s.", error_message, user_id)
            self.error_counter.inc()
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": error_message,
                "user_id": user_id,
                "element": element,
            })
            return

        try:
            # Perform validation by checking Firestore verification collections
            identity_verified = self._is_verified(self.identity_verification_coll, user_id)
            wali_verified = self._is_verified(self.wali_verification_coll, user_id)

            if identity_verified and wali_verified:
                self.logger.info(f"Profile {user_id} PASSED validation (Identity and Wali verified).")
                self.processed_counter.inc()
                # Merge validated profile with necessary trigger info
                output_dict = {
                    'user_id': user_id,
                    'profile_data': profile, # Include the full fetched profile
                    # Preserve the parsed-event contract used by answer parsing,
                    # embedding, lying-score, and question-generation branches.
                    'question_id': event_dict.get('question_id'),
                    'answer_text': event_dict.get('answer_text'),
                    'question_text': event_dict.get('question_text'),
                    'clarificationTag': event_dict.get('clarificationTag'),
                    # Backward-compatible aliases for older next-question code.
                    'qa_id': event_dict.get('question_id'),
                    'answer': event_dict.get('answer_text'),
                    'question': event_dict.get('question_text')
                }
                yield output_dict # Pass merged dictionary downstream
            else:
                self.logger.warning(f"Profile {user_id} FAILED validation (Identity verified: {identity_verified}, Wali verified: {wali_verified})")
                self.validation_failed.inc()
                # Do not yield profile if validation fails; this is a business rejection, not a DLQ error.

        except Exception as e:
            # Catch potential errors during validation/merging logic itself
            self.error_counter.inc()
            self.logger.error(f"Error during validation processing for {user_id}: {str(e)}", exc_info=True)
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {
                "error_message": f"Error during validation processing for {user_id}: {str(e)}",
                "user_id": user_id,
                "element": element,
                "traceback": traceback.format_exc(),
            })


@beam.ptransform_fn
def ProcessAndValidateProfile(pcoll: beam.PCollection[Dict[str, Any]], # Input is dict from parser
                              project_id: str,
                              collection_name: str, # This is the USER_INFO collection name
                              is_test: bool = False) -> SimpleNamespace:
    """Composite PTransform to fetch profile, validate verifications, and merge with trigger event data.

    Args:
        pcoll: PCollection of event dictionaries from ParseFirestoreTriggerEventDoFn.
        project_id: GCP Project ID.
        collection_name: Firestore collection name for user profiles (USER_INFO).
        is_test: Boolean flag for testing mode.

    Returns:
        SimpleNamespace with:
        - main: merged dictionaries ONLY FOR USERS whose identity and Wali relation are verified.
        - error: structured fetch/validation errors for DLQ persistence.
    """
    fetched_data = (
        pcoll
        | "FetchProfiles" >> beam.ParDo(FetchProfileDoFn(
            project_id=project_id,
            collection_name=collection_name, # Pass USER_INFO collection name
            is_test=is_test
        )).with_outputs(FetchProfileDoFn.OUTPUT_ERROR_TAG, main='main')
        # Output main: PCollection[Tuple[Dict, Dict]] -> (profile, event_dict)
    )

    validated_data = (
        fetched_data.main
        | "ValidateVerificationsAndMerge" >> beam.ParDo(ValidateProfileDoFn(
            project_id=project_id,
            is_test=is_test
            # No need to pass collection names here, they are accessed via COLLECTIONS
            )).with_outputs(ValidateProfileDoFn.OUTPUT_ERROR_TAG, main='main')
        # Output main: PCollection[Dict[str, Any]] -> merged dictionary for verified users
    )

    processing_errors = (
        (
            fetched_data[FetchProfileDoFn.OUTPUT_ERROR_TAG],
            validated_data[ValidateProfileDoFn.OUTPUT_ERROR_TAG],
        )
        | "FlattenProfileProcessingErrors" >> beam.Flatten()
    )

    return SimpleNamespace(main=validated_data.main, error=processing_errors)
