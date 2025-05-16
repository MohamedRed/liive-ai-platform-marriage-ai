# Migration Guide: Domain-Driven Firebase Functions

This document outlines the transition plan from a monolithic functions structure to a domain-driven architecture that aligns with the database structure.

## Current Structure

The current Firebase functions structure is organized in a monolithic file (`index.ts`) with all functions defined in one place. The database follows a flat collection structure.

## Target Structure

The target architecture is domain-driven, with:

1. Separate domains organized in dedicated directories:
   - `domains/users/`
   - `domains/marriage/`
   - `domains/identity-verification/`
   - `domains/cooking/` (for meal planning)
   - etc.

2. Separate Firestore databases per domain:
   - `users` database for user data
   - `marriage` database for marriage-related data
   - `cooking` database for meal planning data
   - etc.

## Migration Steps

### Step 1: Organize Functions by Domain (✓ Completed)

- Created domain-specific directories
- Moved functions to relevant domains
- Created new exports from these domain files

### Step 2: Update Collection References (✓ Completed)

- Used `COLLECTIONS_LEGACY` for backward compatibility
- Updated all database references to use these constants

### Step 3: Create Main Export File (✓ Completed)

- Created `main.ts` to import and export all domain functions
- Set up the framework for database-specific access

### Step 4: Gradually Migrate to Multi-Database Structure (In Progress)

For each domain:

1. Create a new database with the domain name
2. Create collections in this database according to the model in `database-model.ts`
3. Migrate data from the legacy structure to the new database
4. Update the domain function files to use the new database
5. Remove legacy code

### Step 5: Integration Testing

After completing code changes:

1. Test each domain's functions individually
2. Test cross-domain interactions
3. Validate data integrity

### Step 6: Deployment Strategy

1. Deploy the new domain-based functions
2. Validate that they're working correctly
3. Gradually deprecate the legacy functions
4. Monitor for any issues

## Domain Function Files

### Users Domain (`domains/users/index.ts`)

Contains functions related to user profiles and settings:
- `getUserProfile`
- `getUserSettings`
- `updateUserProfile`
- `updateUserSettings`
- `logAuditEvent`

### Marriage Domain (`domains/marriage/index.ts`)

Contains functions related to marriage counseling:
- `getUserQA`
- `updateUserAnswers`
- `getWaliInfo`
- `updateWaliVerificationStatus`

### Identity Verification (`domains/identity-verification/index.ts`)

Contains functions related to identity verification:
- `stripeIdentityWebhook`
- `createIdentityVerificationSession`
- `getVerificationOutputs`

## Required Database Changes

The migration will involve creating new databases in Firestore for each domain, with appropriate collection structures:

1. `users` database with collections:
   - `USERS`
   - `USER_INFO`
   - `USER_SETTINGS`
   - `AUDIT_LOGS`

2. `marriage` database with collections:
   - `QAS` (Questions and Answers)
   - `QA_EDIT_LOGS`
   - `IDENTITY_VERIFICATIONS`
   - `USER_WALI_RELATION_VERIFICATIONS`
   - `WALI_USER_PROVIDED_INFO`
   - `WALI_INFO`
   - `MATCHES`

3. `cooking` database with collections:
   - `RECIPES`
   - `MEAL_PLANS`
   - `SHOPPING_LISTS`
   - `FAVORITES`

## Completion Status

- [x] Domain directories created
- [x] Functions reorganized by domain
- [x] Main export file created
- [ ] Database-specific exports implemented
- [ ] New databases created in Firestore
- [ ] Data migration completed
- [ ] Legacy code removed
- [ ] Integration testing completed
- [ ] Production deployment 