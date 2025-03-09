import admin from 'firebase-admin';
import { z as zod } from 'zod';
import { Timestamp as FirestoreTimestamp } from '@firebase/firestore-types';

// Database collection names as constants
export const COLLECTIONS = {
  USERS: 'USERS',                    // Core user data
  USER_INFO: 'USER_INFO',              // Profile metadata
  USER_SETTINGS: 'USER_SETTINGS',    // User notification and preferences settings
  QUESTIONS_ANSWERS: 'QAS',          // All QAs for a user
  QA_EDIT_LOGS: 'QA_EDIT_LOGS',     // Edit history for QAs
  IDENTITY_VERIFICATIONS: 'ID_VERIFICATIONS',  // Identity verification status/data
  USER_WALI_RELATION_VERIFICATIONS: 'USER_WALI_RELATION_VERIFICATIONS',    // Wali verification status/data
  WALI_USER_PROVIDED_INFO: 'WALI_USER_PROVIDED_INFO',  // Wali info entered by user
  WALI_INFO: 'WALI_INFO',  // Wali info entered by wali
  MATCHES: 'MATCHES',                // Match results
  AUDIT_LOGS: 'AUDIT_LOGS',  // Audit logs
} as const;

// 1. Core Type Definitions
type Timestamp = admin.firestore.Timestamp;

// 2. Enums for Type Safety
export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REQUIRES_INPUT = 'requires_input',
  CANCELED = 'canceled'
}

export enum RelationshipType {
  FATHER = 'father',
  BROTHER = 'brother',
  UNCLE = 'uncle',
  OTHER = 'other'
}

// Audit Logs collection
interface AuditLog {
  action: string;
  timestamp: Timestamp;
  source: 'user' | 'system' | 'admin';
}

// 8. Enhanced Zod Schema for Wali
export const NewWaliSchema = zod.object({
  name: zod.object({
    first: zod.string().min(1),
    last: zod.string().min(1)
  }),
  contact: zod.object({
    phone: zod.string().regex(/^\+?[1-9]\d{1,14}$/),
    email: zod.string().email()
  }),
  address: zod.object({
    street: zod.string(),
    city: zod.string(),
    state: zod.string().optional(),
    postalCode: zod.string(),
    country: zod.string().length(2) // ISO 3166-1 alpha-2
  }),
  relationship: zod.nativeEnum(RelationshipType),
});

// 9. Event Typing with Discriminated Union
export type ProfileEvent = 
  | {
      type: 'profile_update';
      changedFields: string[];
      previousValues: Record<string, any>;
      newValues: Record<string, any>;
      timestamp: Timestamp;
    }
  | {
      type: 'verification_update';
      verificationType: 'identity' | 'wali';
      status: VerificationStatus;
      timestamp: Timestamp;
    };

// 10. Third-party Integration Types
// Outputs from Stripe's verification
export type StripeOutputsType = {
  last_name?: string;
  dob?: { day: number; month: number; year: number };
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
  }
}

// Core User Profile (minimal required data)
export interface UserInfo extends Timestamping, UserMetadata {
  id: string;
  // From signup
  contact: {
    email: string;
    phoneNumber: string;
  };
  // For profile
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
          start: number;  // Hour in 24-hour format (0-23)
          end: number;    // Hour in 24-hour format (0-23)
          label?: string; // Optional label for the period
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
        start: number;  // Hour in 24-hour format (0-23)
        end: number;    // Hour in 24-hour format (0-23)
      }>;
    };
  }
}

// Questions & Answers Document
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
    }
  };
}

// QA Edit History
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
      country: string;    // ISO 3166-1 alpha-2
      timezone?: string;  // IANA timezone
    };
  };
}

// Identity Verification
export interface IdentityVerification extends VerificationMetadata, Timestamping {
  userId?: string;
  waliId?: string;
  provider: 'stripe' | 'internal';
  sessionId: string;
  status: VerificationStatus;
}

// Wali Verification Status
export interface WaliRelationVerification extends VerificationMetadata, Timestamping {
  userId: string;
  waliId: string;
  relationship: RelationshipType;
  status: VerificationStatus;
}

// Wali Info (entered by user)
export interface WaliUserProvidedInfo extends PersonalInfo, Timestamping {
  userId: string;  // User who entered this info
  relationship: RelationshipType;
}

// Wali Info (entered by wali)
export interface WaliInfo extends PersonalInfo, UserMetadata, InvitationMetadata, Timestamping {
  waliId: string;  // Wali's user ID
  userId: string;  // User they are wali for
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
  }[]
}