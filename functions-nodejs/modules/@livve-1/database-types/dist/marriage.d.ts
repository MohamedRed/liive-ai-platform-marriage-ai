import { Timestamp as FirestoreTimestamp } from '@firebase/firestore-types';
import { z as zod } from 'zod';
import { Timestamping } from './index';
import { PersonalInfo, UserMetadata, InvitationMetadata } from './users';
import { IdentityVerification, VerificationMetadata, VerificationStatus } from './identity-verification';
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
            section?: string;
            createdAt: FirestoreTimestamp;
            updatedAt?: FirestoreTimestamp;
            aiLyingScore?: number;
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
export interface Matches extends Timestamping {
    matches: {
        userId: string;
        vector_score: number;
        ai_score: number;
        suggested_questions: {
            question: string;
            rationale: string;
            section: string;
        }[];
        metadata: {
            [key: string]: [value: string];
        };
    }[];
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
