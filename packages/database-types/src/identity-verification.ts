import { Timestamping } from './index';

export interface VerificationMetadata {
    verificationMetadata: {
      attempts: number;
      lastError?: string;
    };
  }
  
  // Enums for Type Safety
  export enum VerificationStatus {
    PENDING = 'pending',
    VERIFIED = 'verified',
    REQUIRES_INPUT = 'requires_input',
    CANCELED = 'canceled'
  }
  
  // Base Identity Verification interface
  export interface IdentityVerification extends VerificationMetadata, Timestamping {
    provider: 'stripe' | 'internal';
    sessionId: string;
    status: VerificationStatus;
  }
  
  // Third-party Integration Types
  // Outputs from Stripe's verification
  export type StripeOutputsType = {
    last_name?: string;
    dob?: { day: number; month: number; year: number };
    address?: {
      city?: string;
    };
  };