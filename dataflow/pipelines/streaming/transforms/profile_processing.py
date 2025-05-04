# apps/marriage-ai/dataflow/pipelines/streaming/transforms/profile_processing.py
import apache_beam as beam
import logging
import json
import traceback
from typing import Dict, Any, Tuple # Added Tuple
from apache_beam.metrics import Metrics
# Import Firestore client
from google.cloud import firestore

# Import constants and metrics from common
from .common import MetricNames
# Import central COLLECTIONS definition
from ..common.definitions import COLLECTIONS

# Assume logger is configured in the main script
logger = logging.getLogger(__name__)

class FetchProfileDoFn(beam.DoFn):
    def __init__(self, project_id, collection_name, is_test=False):
        self.project_id = project_id
        self.collection_name = collection_name # This should be USER_INFO collection
        self.is_test = is_test
        # Each DoFn instance gets its own logger and counter instances
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('FetchProfileDoFn', MetricNames.ERRORS)
        self.profiles_not_found = Metrics.counter('FetchProfileDoFn', 'profiles_not_found')
        self.db = None # Initialize db to None

    def setup(self):
        # Setup runs once per worker process
        if not self.is_test:
            try:
                self.db = firestore.Client(project=self.project_id)
                self.logger.info(f"FetchProfileDoFn: Firestore client initialized successfully for project {self.project_id}.")
            except Exception as e:
                 self.logger.error(f"FetchProfileDoFn: Failed to initialize Firestore client in setup: {str(e)}", exc_info=True)
                 # If setup fails, subsequent process calls might fail. Raising here might be appropriate.
                 raise

    def process(self, event_dict: Dict[str, Any]): # Input is the event dictionary
        if not self.db and not self.is_test:
             self.logger.error("FetchProfileDoFn: Firestore client not initialized. Skipping profile fetch.")
             self.error_counter.inc()
             # If setup failed, we should probably let the error propagate rather than just returning
             # raise RuntimeError("Firestore client failed to initialize in setup.")
             # For DLQ purposes, maybe output the input event to error tag?
             # Yielding nothing means the element is dropped.
             return

        user_id = event_dict.get('user_id')
        if not user_id:
             self.logger.error(f"FetchProfileDoFn: Missing user_id in event dictionary: {event_dict}")
             self.error_counter.inc()
             # Yield to error tag or just return?
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
                # Don't yield if profile not found, effectively dropping the element
                return

            profile = doc.to_dict()
            if profile is None:
                 self.logger.error(f"Profile data for {user_id} is None after fetch.")
                 self.error_counter.inc()
                 return # Drop element

            profile['id'] = user_id # Ensure ID is part of the profile dict
            yield (profile, event_dict) # Yield tuple: (fetched_profile, original_event_data)

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Error fetching profile for {user_id}: {str(e)}", exc_info=True)
            # Re-raising stops the element processing. Needs DLQ handling in the main pipeline.
            # Consider outputting event_dict to an error tag here if needed.
            raise

class ValidateProfileDoFn(beam.DoFn):
    """Validates if a user's identity and Wali relation are verified by checking Firestore verification collections."""

    def __init__(self, project_id: str, is_test: bool = False):
        self.project_id = project_id
        self.is_test = is_test
        self.logger = logging.getLogger(__name__)
        self.processed_counter = Metrics.counter('ValidateProfileDoFn', MetricNames.PROCESSED)
        self.validation_failed = Metrics.counter('ValidateProfileDoFn', 'validation_failed')
        self.verification_fetch_failed = Metrics.counter('ValidateProfileDoFn', 'verification_fetch_failed')
        self.error_counter = Metrics.counter('ValidateProfileDoFn', MetricNames.ERRORS)
        self.db = None # Firestore client
        # Get collection names from central definitions
        self.identity_verification_coll = COLLECTIONS['MARRIAGE']['IDENTITY_VERIFICATIONS']
        self.wali_verification_coll = COLLECTIONS['MARRIAGE']['USER_WALI_RELATION_VERIFICATIONS']

    def setup(self):
        # Setup Firestore client
        if not self.is_test:
            try:
                self.db = firestore.Client(project=self.project_id)
                self.logger.info("ValidateProfileDoFn: Firestore client initialized.")
            except Exception as e:
                self.logger.error(f"ValidateProfileDoFn: Failed Firestore client setup: {e}", exc_info=True)
                raise

    def _is_verified(self, collection_name: str, user_id: str) -> bool:
        """Checks if a verification document exists and has status 'verified'."""
        if self.is_test:
            # In test mode, assume verified to allow pipeline flow
            self.logger.debug(f"TEST MODE: Assuming verification '{collection_name}' is TRUE for user {user_id}")
            return True
        if not self.db:
            self.logger.error(f"ValidateProfileDoFn: Firestore client not available for verification check ({collection_name}, user {user_id}).")
            return False

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
            return False # Assume not verified on error

    def process(self, element: Tuple[Dict, Dict]): # Input is tuple: (profile, event_dict)
        profile, event_dict = element # Unpack the tuple
        user_id = profile.get('id', event_dict.get('user_id', '[UNKNOWN_ID]')) # Get ID for logging

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
                    # Add trigger-specific fields needed downstream (e.g., for Layer 1)
                    'qa_id': event_dict.get('qa_id'),
                    'answer': event_dict.get('answer'),
                    'clarificationTag': event_dict.get('clarificationTag'),
                    'question': event_dict.get('question') # Optional original question text
                }
                yield output_dict # Pass merged dictionary downstream
            else:
                self.logger.warning(f"Profile {user_id} FAILED validation (Identity verified: {identity_verified}, Wali verified: {wali_verified})")
                self.validation_failed.inc()
                # Do not yield profile if validation fails, dropping the element

        except Exception as e:
            # Catch potential errors during validation/merging logic itself
            self.error_counter.inc()
            self.logger.error(f"Error during validation processing for {user_id}: {str(e)}", exc_info=True)
            # Re-raising stops the element. Needs DLQ handling.
            raise


@beam.ptransform_fn
def ProcessAndValidateProfile(pcoll: beam.PCollection[Dict[str, Any]], # Input is dict from parser
                              project_id: str,
                              collection_name: str, # This is the USER_INFO collection name
                              is_test: bool = False) -> beam.PCollection[Dict[str, Any]]: # Output is merged dict
    """Composite PTransform to fetch profile, validate verifications, and merge with trigger event data.

    Args:
        pcoll: PCollection of event dictionaries from ParseFirestoreTriggerEventDoFn.
        project_id: GCP Project ID.
        collection_name: Firestore collection name for user profiles (USER_INFO).
        is_test: Boolean flag for testing mode.

    Returns:
        PCollection of merged dictionaries containing profile data and triggering Q&A details
        ONLY FOR USERS whose identity and Wali relation are verified.
    """
    OUTPUT_TAG = 'validated_profile'
    ERROR_TAG = 'processing_errors'

    fetched_data = (
        pcoll
        | "FetchProfiles" >> beam.ParDo(FetchProfileDoFn(
            project_id=project_id,
            collection_name=collection_name, # Pass USER_INFO collection name
            is_test=is_test
        ))
        # Output: PCollection[Tuple[Dict, Dict]] -> (profile, event_dict)
    )

    validated_data = (
        fetched_data
        | "ValidateVerificationsAndMerge" >> beam.ParDo(ValidateProfileDoFn(
            project_id=project_id,
            is_test=is_test
            # No need to pass collection names here, they are accessed via COLLECTIONS
            ))
        # Output: PCollection[Dict[str, Any]] -> merged dictionary for verified users
    )

    return validated_data