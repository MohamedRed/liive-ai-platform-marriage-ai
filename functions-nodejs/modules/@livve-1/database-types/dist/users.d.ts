import { Timestamp as FirestoreTimestamp } from '@firebase/firestore-types';
import { Timestamping } from './index';
import { IdentityVerification } from './identity-verification';
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
export interface UserIdentityVerification extends IdentityVerification {
    userId: string;
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
export interface InvitationMetadata {
    invitationMetadata: {
        invitationSent: boolean;
        invitationMethod: 'sms' | 'email';
    };
}
export interface AuditLog {
    domain: string;
    action: string;
    timestamp: FirestoreTimestamp;
    source: 'user' | 'system' | 'admin';
}
