import { Timestamping } from './index';
export interface VerificationMetadata {
    verificationMetadata: {
        attempts: number;
        lastError?: string;
    };
}
export declare enum VerificationStatus {
    PENDING = "pending",
    VERIFIED = "verified",
    REQUIRES_INPUT = "requires_input",
    CANCELED = "canceled"
}
export interface IdentityVerification extends VerificationMetadata, Timestamping {
    provider: 'stripe' | 'internal';
    sessionId: string;
    status: VerificationStatus;
}
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
