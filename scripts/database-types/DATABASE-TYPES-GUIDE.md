# Database Types Integration Guide

This document provides guidance on using the `@livve-1/database-types` package in both the Marriage AI frontend and functions-nodejs backend.

## Overview

The `@livve-1/database-types` package contains shared TypeScript definitions for database collections, documents, and related constants used throughout the Marriage AI application. By centralizing these definitions, we ensure consistency between the frontend and backend.

## Getting Started

### Installation

The package is already included in both projects' dependencies. You have multiple options to manage the package:

#### Option 1: Using yarn scripts (recommended)

To update to the latest version in both projects simultaneously:

```bash
yarn prod-mode
```

For local development against a local version of the package in both projects:

```bash
yarn dev-mode
```

For quick linking without building:

```bash
yarn use-local
```

For quick installation of the latest published version:

```bash
yarn use-published
```

#### Option 2: Using shell scripts directly

```bash
# From marriage-ai root directory
./scripts/database-types/dev-mode.sh
./scripts/database-types/prod-mode.sh
```

## Usage Examples

### Importing Collection Names

```typescript
import { COLLECTIONS } from '@livve-1/database-types';

// Use in Firestore queries
const profileRef = doc(firestore, COLLECTIONS.PROFILES, userId);
```

### Importing Type Definitions

```typescript
import { UserInfo, WaliInfo, Matches } from '@livve-1/database-types';

// Use in component props or variables
const [profile, setProfile] = useState<UserInfo | null>(null);
```

### Using Enum Values

```typescript
import { RelationshipType } from '@livve-1/database-types';

// Use enum values
const relationship = RelationshipType.FATHER;
```

## Development Workflow

When developing features that require changes to database types:

1. Set up local development mode:
   ```bash
   yarn dev-mode
   ```

2. Make changes to the database-types package

3. Build the package to apply changes:
   ```bash
   cd packages/database-types && yarn build
   ```

4. Your changes will immediately be available in both the frontend and functions-nodejs

## Production Deployment

Before deploying to production:

1. Update to the published version:
   ```bash
   yarn prod-mode
   ```

2. Build and deploy both projects

## Maintenance

To standardize imports across both codebases (if you find inconsistent imports):

```bash
yarn integrate-db-types
```

## Full Integration Process

If you need to fully integrate or re-integrate the database-types package:

```bash
yarn integrate-db-types
```

This script will:
1. Build the database-types package
2. Link it for local development in both projects
3. Standardize all imports in both projects
4. Build both projects to check for TypeScript errors

## Troubleshooting

### Type Errors

If you encounter type errors related to the database-types package:

1. Check that the types you're using are exported from the package
2. Make sure you're importing from `@livve-1/database-types` and not from relative paths
3. Verify that the package is properly linked or installed by running `yarn dev-mode` or `yarn use-local`
4. Try rebuilding the package and both projects

### Import Errors

If imports aren't resolving correctly:

1. Check the paths in both project's `tsconfig.json` files
2. Verify that the package is properly linked or installed
3. Run `yarn integrate-db-types` to standardize all imports 