import { Timestamp as FirestoreTimestamp } from '@firebase/firestore-types';
import { z as zod } from 'zod';
import { Timestamping } from './index';
import { PersonalInfo, UserMetadata, InvitationMetadata } from './users';
import { IdentityVerification, VerificationMetadata, VerificationStatus } from './identity-verification';

// Define the layers
export enum QuestionLayer {
  LAYER_1_CLARIFICATION = 1,
  LAYER_2_FOUNDATIONAL = 2,
  LAYER_3_GENERAL = 3,
  LAYER_4_INSIGHT = 4, // Added for completeness, though not a template layer
}

// Interface for Question Templates (primarily for Layer 2)
export interface QuestionTemplate extends Timestamping {
  id: string;            // Unique ID for the question (e.g., "L2_FINANCES_01")
  text: string;          // The actual question text presented to the user
  layer: QuestionLayer.LAYER_2_FOUNDATIONAL; // Explicitly Layer 2
  section?: string;       // Optional grouping (e.g., "Finances", "Family")
  priority?: number;      // Optional priority for ordering within the layer
  // Add any other relevant metadata for selection/ranking
  // e.g., prerequisites?: string[]; // IDs of questions that should be answered first
}

export enum RelationshipType {
  FATHER = 'father',
  BROTHER = 'brother',
  UNCLE = 'uncle',
  OTHER = 'other'
}

// Questions & Answers Document (stored in QAS collection)
export interface QuestionsAnswers {
  userId: string;
  questions: {
    [questionId: string]: { // Key is the QuestionTemplate.id for Layer 2, or generated ID/hash for Layer 3
      question: string;       // Store the actual text asked (template text or generated text)
      answer: string;
      layer: QuestionLayer;   // Record which layer this Q&A belongs to
      section?: string;       // Inherited from template or assigned for generated
      createdAt: FirestoreTimestamp;
      updatedAt?: FirestoreTimestamp;
      aiLyingScore?: number;
      // Optional: Store if the question was generated dynamically
      isGenerated?: boolean;
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
export interface WaliIdentityVerification extends IdentityVerification {
  waliId: string;
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

// Interface for the state of a user within the Marriage App context
// Renamed from MarriageProfile
export interface NextQuestionSuggestion extends Timestamping {
  userId: string; // Matches the main user ID
  // Renamed from profileCompletionState
  suggestionCompletionState?: 'initializing' | 'layer2_ongoing' | 'layer3_ongoing' | 'layer4_ongoing' | 'completed' | string; // Tracks overall progress - added layer4
  lastActivity?: FirestoreTimestamp; // Timestamp of last interaction relevant to suggestions

  // Fields to store the next suggested question
  nextSuggestedQuestionId?: string | null;    // ID if it's a Layer 2/4 template, null otherwise
  nextSuggestedQuestionText?: string | null;   // Text of the question (template or generated)
  nextSuggestedQuestionLayer?: QuestionLayer | null; // Layer number (1, 2, 3, or 4)
  nextSuggestedQuestionSection?: string | null; // Optional section from L2 template
  nextSuggestedQuestionTimestamp?: FirestoreTimestamp; // When this question was suggested

  // Additional metadata about the suggestion source and context
  nextSuggestedQuestionReasoning?: string; // Optional: LLM reasoning (L1, L3)
  nextSuggestionSource?: string;          // Optional: Detailed source (e.g., 'layer_4_big_five', 'llm_clarification')
  nextSuggestedQuestionFramework?: string; // Optional: Specific framework for L4 assessments
  nextSuggestedQuestionClarificationTag?: string; // Optional: Tag for L1 clarification sequences

  // Add field for total candidate count when this suggestion was made
  nextSuggestionCandidateCount?: number | null;

  // Other metadata related to suggestion state can be added here
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
  // Add field for the overall top match percentage for the primary user
  topMatchPercentage?: number | null; // e.g., 85 (representing 85%)
}

// Enhanced Zod Schema for Wali
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

// Event Typing with Discriminated Union
export type ProfileEvent = 
  | {
      type: 'profile_update';
      changedFields: string[];
      previousValues: Record<string, any>;
      newValues: Record<string, any>;
      timestamp: FirestoreTimestamp;
    }
  | {
      type: 'verification_update';
      verificationType: 'identity' | 'wali';
      status: VerificationStatus;
      timestamp: FirestoreTimestamp;
    };
