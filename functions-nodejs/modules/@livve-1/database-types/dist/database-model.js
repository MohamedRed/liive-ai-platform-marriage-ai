"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGACY_COLLECTIONS = exports.COLLECTIONS = exports.DATABASES = void 0;
// Database and collection names as constants
exports.DATABASES = {
    USERS: 'users', // Core user database
    MARRIAGE: 'marriage', // Marriage domain
    BUILDER: 'builder', // App Builder domain
    HIJRA: 'hijra', // Hijra domain
    HAJJ: 'hajj', // Hajj/Umra domain
    COOKING: 'cooking', // Cooking domain
    CHARITY: 'charity', // Charity domain
    NEWS: 'news', // News domain
    POLLS: 'polls', // Polls domain
    HELP: 'help', // Help domain
    LOST_THINGS: 'lost-things', // Lost Things domain
    FRIENDS: 'friends', // Friends domain
    MOSQUE_COMMUNITY: 'mosque-community', // Mosque Community domain
    SECOND_HAND: 'second-hand', // Second Hand domain
    HEALTH: 'health', // Health domain
    RIDESHARING: 'ridesharing', // Ridesharing domain
    CITY: 'city', // City domain
    JOBS: 'jobs', // Jobs domain
    TRAVELING: 'traveling', // Traveling domain
};
// Collections by database
exports.COLLECTIONS = {
    // Core user collections that exist in the USERS database
    USERS: {
        USERS: 'USERS', // Core user data
        USER_INFO: 'USER_INFO', // Profile metadata
        USER_SETTINGS: 'USER_SETTINGS', // User notification and preferences settings
        AUDIT_LOGS: 'AUDIT_LOGS', // Audit logs
    },
    // Collections for the MARRIAGE database
    MARRIAGE: {
        NEXT_QUESTION_SUGGESTIONS: 'NEXT_QUESTION_SUGGESTIONS', // User state/metadata for the next question suggestion process
        QUESTIONS_ANSWERS: 'QAS', // All QAs for a user (Uses QuestionTemplate.id or generated ID)
        QA_EDIT_LOGS: 'QA_EDIT_LOGS', // Edit history for QAs
        IDENTITY_VERIFICATIONS: 'ID_VERIFICATIONS', // Identity verification status/data
        USER_WALI_RELATION_VERIFICATIONS: 'USER_WALI_RELATION_VERIFICATIONS', // Wali verification status/data
        WALI_USER_PROVIDED_INFO: 'WALI_USER_PROVIDED_INFO', // Wali info entered by user
        WALI_INFO: 'WALI_INFO', // Wali info entered by wali
        MATCHES: 'MATCHES', // Match results
        LAYER2_FOUNDATIONAL_QUESTIONS: 'LAYER2_FOUNDATIONAL_QUESTIONS', // Template questions for Layer 2
        // No LAYER3 collection needed per Scenario 2 (Dynamic Generation)
        MATCH_CANDIDATE_SCOREBOARD: 'MATCH_CANDIDATE_SCOREBOARD', // Stores aggregated scores for potential matches
        MARRIAGE_PROFILE_SUMMARIES: 'MARRIAGE_PROFILE_SUMMARIES', // Stores pre-generated LLM summaries of user profiles
    },
    // Collections for the COOKING database
    COOKING: {
        RECIPES: 'RECIPES', // Recipe information
        MEAL_PLANS: 'MEAL_PLANS', // Meal planning data
        SHOPPING_LISTS: 'SHOPPING_LISTS', // Shopping lists for ingredients
        FAVORITES: 'FAVORITES', // Favorited recipes
    },
    // Collections for the HEALTH database
    HEALTH: {
        NUTRITION: 'NUTRITION', // Nutrition information
        SUPPLEMENTS: 'SUPPLEMENTS', // Supplement data
        BODY_METRICS: 'BODY_METRICS', // Body metrics and tracking
        HEALTH_GOALS: 'HEALTH_GOALS', // Health goals and tracking
    },
    // Collections for the BUILDER database
    BUILDER: {
        APPS: 'APPS', // Created apps
        TEMPLATES: 'TEMPLATES', // App templates
        APP_ANALYTICS: 'APP_ANALYTICS', // Analytics for created apps
    },
    // Add placeholder collection objects for other domains
    // These can be expanded as each domain is developed
    HIJRA: {},
    HAJJ: {},
    CHARITY: {},
    NEWS: {},
    POLLS: {},
    HELP: {},
    LOST_THINGS: {},
    FRIENDS: {},
    MOSQUE_COMMUNITY: {},
    SECOND_HAND: {},
    RIDESHARING: {},
    CITY: {},
    JOBS: {},
    TRAVELING: {},
};
// Legacy collection names for backward compatibility
// To be deprecated in future versions
exports.LEGACY_COLLECTIONS = {
    USERS: 'USERS', // Core user data
    USER_INFO: 'USER_INFO', // Profile metadata
    USER_SETTINGS: 'USER_SETTINGS', // User notification and preferences settings
    QUESTIONS_ANSWERS: 'QAS', // All QAs for a user
    QA_EDIT_LOGS: 'QA_EDIT_LOGS', // Edit history for QAs
    IDENTITY_VERIFICATIONS: 'ID_VERIFICATIONS', // Identity verification status/data
    USER_WALI_RELATION_VERIFICATIONS: 'USER_WALI_RELATION_VERIFICATIONS', // Wali verification status/data
    WALI_USER_PROVIDED_INFO: 'WALI_USER_PROVIDED_INFO', // Wali info entered by user
    WALI_INFO: 'WALI_INFO', // Wali info entered by wali
    MATCHES: 'MATCHES', // Match results
    AUDIT_LOGS: 'AUDIT_LOGS', // Audit logs
};
