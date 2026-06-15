import logging
from typing import Dict, List, Any, Optional, Tuple
from google.cloud import firestore

logger = logging.getLogger(__name__)

def get_all_user_qas(db: firestore.Client, qa_collection_name: str, user_id: str, logger_instance: Optional[logging.Logger] = None) -> Dict[str, Dict]:
    """Fetches all Q&A data for a specific user from their document in the QAS collection.

    Args:
        db: Firestore client instance.
        qa_collection_name: Name of the collection storing Q&A documents (e.g., 'MARRIAGE_QAS').
        user_id: The ID of the user whose Q&A to fetch.
        logger_instance: Optional logger to use; defaults to the module logger.

    Returns:
        A dictionary mapping qa_id to the QA data dict {qa_id: {question: ..., answer: ..., ...}},
        or an empty dict if the document/data is not found or invalid.
    """
    log = logger_instance or logger
    try:
        qas_doc_ref = db.collection(qa_collection_name).document(user_id)
        qas_doc = qas_doc_ref.get()

        if qas_doc.exists:
            qas_data = qas_doc.to_dict()
            answers_map = qas_data.get("questions", {})
            if not isinstance(answers_map, dict):
                log.warning(f"User {user_id} questions field in {qa_collection_name} is not a dict: {type(answers_map)}. Returning empty answers.")
                return {}
            log.debug(f"Successfully fetched {len(answers_map)} QAs for user {user_id} from {qa_collection_name}.")
            return answers_map
        else:
            log.info(f"No QAS document found for user {user_id} in {qa_collection_name}. Assuming no answers yet.")
            return {}
    except Exception as e:
        log.error(f"Failed to fetch QAs for user {user_id} from {qa_collection_name}: {e}", exc_info=True)
        return {}

def get_match_qas(db: firestore.Client, qa_collection_name: str, match_ids: List[str], logger_instance: Optional[logging.Logger] = None) -> Dict[str, Dict]:
    """Fetches Q&A data for multiple users (matches) efficiently.

    Args:
        db: Firestore client instance.
        qa_collection_name: Name of the collection storing Q&A documents.
        match_ids: A list of user IDs (matches) to fetch Q&A for.
        logger_instance: Optional logger to use.

    Returns:
        A dictionary mapping match_id to their Q&A data dict {match_id: {qa_id: {...}, ...}}.
    """
    log = logger_instance or logger
    match_qas_data = {}
    if not match_ids:
        return match_qas_data

    try:
        # Use 'in' query to fetch multiple documents by ID
        refs = [db.collection(qa_collection_name).document(mid) for mid in match_ids]
        docs = db.get_all(refs)

        fetched_ids = set()
        for doc in docs:
            if doc.exists:
                user_id = doc.id
                fetched_ids.add(user_id)
                qas_data = doc.to_dict()
                answers_map = qas_data.get("questions", {})
                if isinstance(answers_map, dict):
                    match_qas_data[user_id] = answers_map
                else:
                    log.warning(f"Match user {user_id} questions field in {qa_collection_name} is not a dict: {type(answers_map)}. Skipping QAs for this match.")
            # else: Document for a match_id didn't exist, skip silently or log info

        log.info(f"Fetched QAs for {len(fetched_ids)}/{len(match_ids)} requested match IDs from {qa_collection_name}.")
        missing_ids = set(match_ids) - fetched_ids
        if missing_ids:
            log.info(f"Could not find QAS documents for match IDs: {missing_ids}")

        return match_qas_data
    except Exception as e:
        log.error(f"Failed to fetch QAs for matches ({len(match_ids)} IDs) from {qa_collection_name}: {e}", exc_info=True)
        return {}

def get_qas_by_tag(db: firestore.Client, qa_collection_name: str, user_id: str, tag: str, logger_instance: Optional[logging.Logger] = None) -> List[Dict]:
    """Fetches all Q&A entries for a user with a specific clarificationTag, sorted chronologically.

    Args:
        db: Firestore client instance.
        qa_collection_name: Name of the Q&A collection.
        user_id: The user's ID.
        tag: The clarificationTag value to filter by.
        logger_instance: Optional logger to use.

    Returns:
        A list of QA data dictionaries [{qa_id:..., question:..., answer:..., createdAt:..., clarificationTag:...}, ...],
        sorted by the 'createdAt' timestamp (ascending).
        Returns an empty list if no matching QAs are found or on error.
    """
    log = logger_instance or logger
    try:
        # First, get all QAs for the user
        all_qas = get_all_user_qas(db, qa_collection_name, user_id, log)
        if not all_qas:
            return []

        # Filter by tag
        tagged_qas = []
        for qa_id, qa_data in all_qas.items():
            if isinstance(qa_data, dict) and qa_data.get('clarificationTag') == tag:
                # Include the qa_id within the dictionary for easier access later
                qa_data_with_id = qa_data.copy()
                qa_data_with_id['qa_id'] = qa_id
                tagged_qas.append(qa_data_with_id)

        if not tagged_qas:
            log.info(f"No QAs found with tag '{tag}' for user {user_id} in {qa_collection_name}.")
            return []

        # Sort by timestamp (assuming 'createdAt' field exists and is a comparable type, like Firestore Timestamp)
        try:
            # Add a default timestamp far in the past if 'createdAt' is missing for sorting stability
            default_timestamp = datetime.min.replace(tzinfo=timezone.utc) # Or appropriate default
            tagged_qas.sort(key=lambda qa: qa.get('createdAt', default_timestamp))
            log.debug(f"Found and sorted {len(tagged_qas)} QAs with tag '{tag}' for user {user_id}.")
            return tagged_qas
        except TypeError as te:
            log.error(f"TypeError sorting QAs by 'createdAt' for tag '{tag}', user {user_id}. Check timestamp format. Error: {te}", exc_info=True)
            # Return unsorted list on type error during sort?
            return tagged_qas # Or return empty list: []
        except Exception as sort_e:
            log.error(f"Unexpected error sorting QAs by tag '{tag}' for user {user_id}: {sort_e}", exc_info=True)
            return tagged_qas # Return unsorted list on unexpected error

    except Exception as e:
        log.error(f"Failed to get QAs by tag '{tag}' for user {user_id}: {e}", exc_info=True)
        return [] 