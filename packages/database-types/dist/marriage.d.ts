import { Timestamp as FirestoreTimestamp } from '@firebase/firestore-types';
import { z as zod } from 'zod';
import { Timestamping } from './index';
import { PersonalInfo, UserMetadata, InvitationMetadata } from './users';
import { IdentityVerification, VerificationMetadata, VerificationStatus } from './identity-verification';
export declare enum QuestionLayer {
    LAYER_1_CLARIFICATION = 1,
    LAYER_2_FOUNDATIONAL = 2,
    LAYER_3_GENERAL = 3,
    LAYER_4_INSIGHT = 4,// Added for completeness, though not a template layer
    LAYER_5_TOP_MATCH = 5
}
export interface QuestionTemplate extends Timestamping {
    id: string;
    text: string;
    layer: QuestionLayer.LAYER_2_FOUNDATIONAL;
    section?: string;
    priority?: number;
}
export declare enum RelationshipType {
    FATHER = "father",
    BROTHER = "brother",
    UNCLE = "uncle",
    OTHER = "other"
}
export interface QuestionsAnswers {
    userId: string;
    questions: {
        [questionId: string]: {
            question: string;
            answer: string;
            layer: QuestionLayer;
            section?: string;
            createdAt: FirestoreTimestamp;
            updatedAt?: FirestoreTimestamp;
            aiLyingScore?: number;
            isGenerated?: boolean;
        };
    };
}
export interface QAEditLogs {
    userId: string;
    questionId: string;
    previousAnswer: string;
    newAnswer: string;
    createdAt: FirestoreTimestamp;
    metadata?: {
        deviceInfo?: string;
        ipAddress?: string;
        location: {
            country: string;
            timezone?: string;
        };
    };
}
export interface WaliIdentityVerification extends IdentityVerification {
    waliId: string;
}
export interface WaliRelationVerification extends VerificationMetadata, Timestamping {
    userId: string;
    waliId: string;
    relationship: RelationshipType;
    status: VerificationStatus;
}
export interface WaliUserProvidedInfo extends PersonalInfo, Timestamping {
    userId: string;
    relationship: RelationshipType;
}
export interface WaliInfo extends PersonalInfo, UserMetadata, InvitationMetadata, Timestamping {
    waliId: string;
    userId: string;
    relationship: RelationshipType;
}
export interface NextQuestionSuggestion extends Timestamping {
    userId: string;
    suggestionCompletionState?: 'initializing' | 'layer2_ongoing' | 'layer3_ongoing' | 'layer4_ongoing' | 'completed' | string;
    lastActivity?: FirestoreTimestamp;
    nextSuggestedQuestionId?: string | null;
    nextSuggestedQuestionText?: string | null;
    nextSuggestedQuestionLayer?: QuestionLayer | null;
    nextSuggestedQuestionSection?: string | null;
    nextSuggestedQuestionTimestamp?: FirestoreTimestamp;
    nextSuggestedQuestionReasoning?: string;
    nextSuggestionSource?: string;
    nextSuggestedQuestionFramework?: string;
    nextSuggestedQuestionClarificationTag?: string;
    nextSuggestionCandidateCount?: number | null;
}
/**
 * Represents an entry in the match candidate scoreboard.
 * Path: MATCH_CANDIDATE_SCOREBOARD/{triggering_user_id}/candidate_scores/{matched_user_id}
 */
export interface MatchCandidateScoreboardEntry extends Timestamping {
    triggering_user_id: string;
    matched_user_id: string;
    score: number;
}
/**
 * Represents a pre-generated LLM summary of a user's profile.
 * Path: MARRIAGE_PROFILE_SUMMARIES/{userId}
 */
export interface MarriageProfileSummary extends Timestamping {
    userId: string;
    profileSummaryText: string;
    qasVersionHash: string;
}
export interface Matches extends Timestamping {
    userId: string;
    matches: {
        userId: string;
        aggregated_score?: number;
        cross_encoder_score?: number;
        ai_score: number;
        suggested_questions: {
            question: string;
            rationale: string;
            section: string;
        }[];
        metadata?: {
            [key: string]: any;
        };
    }[];
    topMatchPercentage: number;
    rawTopMatchAiScore: number;
    currentUserCoreProfileCompletenessFactor: number;
    currentUserAnsweredCoreQuestionsCount: number;
    totalCoreQuestionsInSystem: number;
    minConfidenceWeightUsed: number;
}
export declare const NewWaliSchema: zod.ZodObject<{
    name: zod.ZodObject<{
        first: zod.ZodString;
        last: zod.ZodString;
    }, "strip", zod.ZodTypeAny, {
        first: string;
        last: string;
    }, {
        first: string;
        last: string;
    }>;
    contact: zod.ZodObject<{
        phone: zod.ZodString;
        email: zod.ZodString;
    }, "strip", zod.ZodTypeAny, {
        email: string;
        phone: string;
    }, {
        email: string;
        phone: string;
    }>;
    address: zod.ZodObject<{
        street: zod.ZodString;
        city: zod.ZodString;
        state: zod.ZodOptional<zod.ZodString>;
        postalCode: zod.ZodString;
        country: zod.ZodString;
    }, "strip", zod.ZodTypeAny, {
        city: string;
        street: string;
        postalCode: string;
        country: string;
        state?: string | undefined;
    }, {
        city: string;
        street: string;
        postalCode: string;
        country: string;
        state?: string | undefined;
    }>;
    relationship: zod.ZodNativeEnum<typeof RelationshipType>;
}, "strip", zod.ZodTypeAny, {
    name: {
        first: string;
        last: string;
    };
    contact: {
        email: string;
        phone: string;
    };
    address: {
        city: string;
        street: string;
        postalCode: string;
        country: string;
        state?: string | undefined;
    };
    relationship: RelationshipType;
}, {
    name: {
        first: string;
        last: string;
    };
    contact: {
        email: string;
        phone: string;
    };
    address: {
        city: string;
        street: string;
        postalCode: string;
        country: string;
        state?: string | undefined;
    };
    relationship: RelationshipType;
}>;
export type ProfileEvent = {
    type: 'profile_update';
    changedFields: string[];
    previousValues: Record<string, any>;
    newValues: Record<string, any>;
    timestamp: FirestoreTimestamp;
} | {
    type: 'verification_update';
    verificationType: 'identity' | 'wali';
    status: VerificationStatus;
    timestamp: FirestoreTimestamp;
};
