// Mock database types for testing

// Collection names
export const COLLECTIONS = {
  USER_INFO: 'USER_INFO',
  USER_SETTINGS: 'USER_SETTINGS',
  USER_QAS: 'USER_QAS',
  QA_EDIT_LOGS: 'QA_EDIT_LOGS',
  MATCHES: 'MATCHES',
  WALIS: 'WALIS',
  MATCH_USER_UPDATES: 'MATCH_USER_UPDATES'
};

// Question interfaces
export interface Question {
  question: string;
  answer?: string;
  updatedAt?: {
    toMillis: () => number;
  };
}

export interface QuestionsAnswers {
  userId: string;
  questions: {
    [key: string]: Question;
  };
}

// User info interfaces
export interface UserInfo {
  id: string;
  contact: {
    phoneNumber?: string;
    email?: string;
  };
  name: {
    firstName: string;
    lastName: string;
  };
}

// User settings interfaces
export interface NotificationPreferences {
  enabled: boolean;
  quietHours?: {
    start: number;
    end: number;
  };
  availableHours?: {
    [day: string]: {
      start: number;
      end: number;
    };
  };
  availableDays?: string[];
}

export interface UserSettings {
  userId: string;
  notification: {
    fcmToken?: string;
    preferences: NotificationPreferences;
  };
}

// Match interfaces
export interface SuggestedQuestion {
  question: string;
  rationale: string;
  section: string;
}

export interface Match {
  id: string;
  ai_score: number;
  suggested_questions: SuggestedQuestion[];
}

export interface Matches {
  userId: string;
  matches: Match[];
}

// Wali interfaces
export enum WaliRelationship {
  FATHER = 'FATHER',
  MOTHER = 'MOTHER',
  BROTHER = 'BROTHER',
  SISTER = 'SISTER',
  UNCLE = 'UNCLE',
  AUNT = 'AUNT',
  COUSIN = 'COUSIN',
  FRIEND = 'FRIEND',
  OTHER = 'OTHER'
}

export interface WaliContact {
  phone: string;
  email: string;
}

export interface WaliName {
  first: string;
  last: string;
}

export interface WaliAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Wali {
  id: string;
  name: WaliName;
  contact: WaliContact;
  address: WaliAddress;
  relationship: WaliRelationship;
  userId: string;
}

export interface NewWali {
  name: WaliName;
  contact: WaliContact;
  address: WaliAddress;
  relationship: WaliRelationship;
}

// Schema validators
export const NewWaliSchema = {
  shape: {}
};

export type StripeOutputsType = any; 