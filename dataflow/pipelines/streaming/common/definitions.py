# common/definitions.py

# Keep the Python pipeline self-contained. Earlier versions tried to import a
# generated TypeScript database model package from inside the Dataflow tree, but
# that package is not shipped with the Python Flex Template and prevented the
# pipeline from importing at startup. These constants intentionally mirror the
# backend contract names used by the Firebase functions and native service
# contracts.
COLLECTIONS = {
    # Core user collections
    'USERS': {
        'USERS': 'USERS',
        'USER_INFO': 'USER_INFO',
        'USER_SETTINGS': 'USER_SETTINGS',
        'AUDIT_LOGS': 'AUDIT_LOGS',
    },
    # Collections for the MARRIAGE database
    'MARRIAGE': {
        'NEXT_QUESTION_SUGGESTIONS': 'NEXT_QUESTION_SUGGESTIONS',
        'QAS': 'QAS', # Using 'QAS' as key, matching TS QUESTIONS_ANSWERS collection name
        'QA_EDIT_LOGS': 'QA_EDIT_LOGS',
        'IDENTITY_VERIFICATIONS': 'ID_VERIFICATIONS',
        'USER_WALI_RELATION_VERIFICATIONS': 'USER_WALI_RELATION_VERIFICATIONS',
        'WALI_USER_PROVIDED_INFO': 'WALI_USER_PROVIDED_INFO',
        'WALI_INFO': 'WALI_INFO',
        'MATCHES': 'MATCHES',
        'LAYER2_FOUNDATIONAL_QUESTIONS': 'LAYER2_FOUNDATIONAL_QUESTIONS',
        # Layer 3 questions are generated, no collection
    },
    # Layer 4 Assessment Collections (Pipeline specific, not in database-model.ts)
    'ASSESSMENTS': {
        'attachment': 'ASSESSMENT_QUESTIONS_ATTACHMENT',
        'big_five': 'ASSESSMENT_QUESTIONS_BIGFIVE',
        'core_values': 'ASSESSMENT_QUESTIONS_COREVALUES',
        'love_languages': 'ASSESSMENT_QUESTIONS_LOVELANGUAGES',
    },
    # Add other domains if needed by this specific pipeline (unlikely)
    # e.g., 'COOKING': TS_COLLECTIONS['COOKING'],
    # Application-specific collections used by the pipeline but not in core DB model
    'MARRIAGE_APP_SPECIFIC': {
        'PROFILE_SUMMARIES': 'MARRIAGE_PROFILE_SUMMARIES',
        'MATCH_CANDIDATE_SCOREBOARD': 'MATCH_CANDIDATE_SCOREBOARD' # Added based on summary
    }
}

# Constants for Pub/Sub Topics or other pipeline configs if needed
# ...

class MetricNames:
    ERRORS = 'errors'
    MISSING_USER_ID = 'missing_user_id'
    LLM_ERRORS = 'llm_errors'
    CANDIDATES_GENERATED = 'candidates_generated'
    # Add other metric names as needed

# Constants related to question layers/types
CLARIFICATION_LAYER = 1
FOUNDATIONAL_LAYER = 2
GENERAL_LAYER = 3
INSIGHT_LAYER = 4 # Even though implementation changed, keep layer number

# Other potential constants...
DEFAULT_LOCATION = 'us-central1' # Example 