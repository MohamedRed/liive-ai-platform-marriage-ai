# Firebase Functions for Marriage AI

This directory contains Firebase Cloud Functions for the Marriage AI platform.

## Project Structure

The codebase follows a domain-driven architecture:

```
src/
├── domains/                    # Domain-specific function modules
│   ├── users/                  # User-related functions
│   ├── marriage/               # Marriage counseling functions
│   ├── identity-verification/  # Identity verification functions
│   └── cooking/                # Meal planning functions
├── shared/                     # Shared utilities and types
├── main.ts                     # Main entry point (exports all functions)
├── index.ts                    # Legacy entry point (re-exports from main.ts)
└── new-index.ts                # New entry point (transitional)
```

## Domains

### Users Domain
Functions for managing user profiles, settings, and audit logs.

### Marriage Domain
Functions related to marriage counseling, Q&A, wali verification, and matches.

### Identity Verification
Functions for identity verification via Stripe Identity and custom verification flows.

### Cooking (Meal Planning)
Functions for managing recipes, meal plans, and shopping lists.

## Development Guidelines

1. **Domain Separation**: Keep functions within their appropriate domains
2. **Collection Constants**: Use constants from `@liive-marriage-ai/database-types` for Firestore collection references
3. **Error Handling**: Follow consistent error handling patterns
4. **Type Safety**: Ensure all functions have proper TypeScript typing
5. **Testing**: Write unit tests for functions with complex logic

## Firebase Configuration

This project uses multiple Firebase databases to isolate domain data:
- `users`: User profile and settings data
- `marriage`: Marriage counseling and matching data
- `cooking`: Meal planning data

During the transitional period, the code uses `COLLECTIONS_LEGACY` constants for backward compatibility.

## Deployment

Functions are deployed automatically via CI/CD pipeline. To deploy manually:

```bash
npm run deploy:functions
```

## Migration

A migration from the monolithic structure to the domain-driven architecture is in progress. See [MIGRATION.md](./MIGRATION.md) for details about the migration plan and current status.

## Local Development

To run functions locally:

```bash
npm run serve:functions
```

## Testing

```bash
npm run test:functions
``` 