import { z as zod } from 'zod';
// Database collection names as constants
export const COLLECTIONS = {
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
// 2. Enums for Type Safety
export var VerificationStatus;
(function (VerificationStatus) {
    VerificationStatus["PENDING"] = "pending";
    VerificationStatus["VERIFIED"] = "verified";
    VerificationStatus["REQUIRES_INPUT"] = "requires_input";
    VerificationStatus["CANCELED"] = "canceled";
})(VerificationStatus || (VerificationStatus = {}));
export var RelationshipType;
(function (RelationshipType) {
    RelationshipType["FATHER"] = "father";
    RelationshipType["BROTHER"] = "brother";
    RelationshipType["UNCLE"] = "uncle";
    RelationshipType["OTHER"] = "other";
})(RelationshipType || (RelationshipType = {}));
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
