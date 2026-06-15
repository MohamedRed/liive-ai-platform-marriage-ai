import admin from 'firebase-admin';
import { z as zod } from 'zod';
import { Timestamp as FirestoreTimestamp } from '@firebase/firestore-types';
export declare const COLLECTIONS: {
    readonly USERS: "USERS";
    readonly USER_INFO: "USER_INFO";
    readonly USER_SETTINGS: "USER_SETTINGS";
    readonly QUESTIONS_ANSWERS: "QAS";
    readonly QA_EDIT_LOGS: "QA_EDIT_LOGS";
    readonly IDENTITY_VERIFICATIONS: "ID_VERIFICATIONS";
    readonly USER_WALI_RELATION_VERIFICATIONS: "USER_WALI_RELATION_VERIFICATIONS";
    readonly WALI_USER_PROVIDED_INFO: "WALI_USER_PROVIDED_INFO";
    readonly WALI_INFO: "WALI_INFO";
    readonly MATCHES: "MATCHES";
    readonly AUDIT_LOGS: "AUDIT_LOGS";
};
type Timestamp = admin.firestore.Timestamp;
export declare enum VerificationStatus {
    PENDING = "pending",
    VERIFIED = "verified",
    REQUIRES_INPUT = "requires_input",
    CANCELED = "canceled"
}
export declare enum RelationshipType {
    FATHER = "father",
    BROTHER = "brother",
    UNCLE = "uncle",
    OTHER = "other"
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
        phone: string;
        email: string;
    }, {
        phone: string;
        email: string;
    }>;
    address: zod.ZodObject<{
        street: zod.ZodString;
        city: zod.ZodString;
        state: zod.ZodOptional<zod.ZodString>;
        postalCode: zod.ZodString;
        country: zod.ZodString;
    }, "strip", zod.ZodTypeAny, {
        street: string;
        city: string;
        postalCode: string;
        country: string;
        state?: string | undefined;
    }, {
        street: string;
        city: string;
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
        phone: string;
        email: string;
    };
    address: {
        street: string;
        city: string;
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
        phone: string;
        email: string;
    };
    address: {
        street: string;
        city: string;
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
    timestamp: Timestamp;
} | {
    type: 'verification_update';
    verificationType: 'identity' | 'wali';
    status: VerificationStatus;
    timestamp: Timestamp;
};
export type StripeOutputsType = {
    last_name?: string;
    dob?: {
        day: number;
        month: number;
        year: number;
    };
    address?: {
        city?: string;
    };
};
export interface SystemMetadata {
    system: {
        apiVersion: string;
        schemaVersion: number;
        createdAt: FirestoreTimestamp;
        updatedAt: FirestoreTimestamp;
    };
}
export interface Timestamping {
    createdAt: FirestoreTimestamp;
    updatedAt: FirestoreTimestamp;
}
export interface UserMetadata {
    userMetadata: {
        acceptedTerms: boolean;
        marketingOptIn?: boolean;
        isDeleted?: boolean;
        isHidden?: boolean;
        isArchived?: boolean;
        isTest?: boolean;
    };
}
export interface VerificationMetadata {
    verificationMetadata: {
        attempts: number;
        lastError?: string;
    };
}
export interface InvitationMetadata {
    invitationMetadata: {
        invitationSent: boolean;
        invitationMethod: 'sms' | 'email';
    };
}
export interface PersonalInfo {
    personalInfo: {
        name: {
            firstName: string;
            lastName: string;
        };
        contact: {
            email: string;
            phoneNumber: string;
        };
        address: {
            street: string;
            city: string;
            state: string;
            country: string;
            postalCode: string;
        };
    };
}
export interface UserInfo extends Timestamping, UserMetadata {
    id: string;
    contact: {
        email: string;
        phoneNumber: string;
    };
    name: {
        firstName: string;
        lastName: string;
    };
}
export interface UserSettings extends Timestamping {
    notification: {
        fcmToken: string;
        updatedAt: string;
        preferences?: {
            enabled: boolean;
            activeHours?: {
                periods: {
                    start: number;
                    end: number;
                    label?: string;
                }[];
            };
            availableDays?: {
                sunday?: boolean;
                monday?: boolean;
                tuesday?: boolean;
                wednesday?: boolean;
                thursday?: boolean;
                friday?: boolean;
                saturday?: boolean;
            };
            availableHours?: Record<string, {
                start: number;
                end: number;
            }>;
        };
    };
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
export interface IdentityVerification extends VerificationMetadata, Timestamping {
    userId?: string;
    waliId?: string;
    provider: 'stripe' | 'internal';
    sessionId: string;
    status: VerificationStatus;
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
export * from './meal-planning';
