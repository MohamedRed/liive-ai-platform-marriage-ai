# Marriage AI Scripts

This directory contains organized scripts for the Marriage AI application.

## Directory Structure

- **database-types/**: Scripts for managing the database-types package
  - `dev-mode.sh`: Sets up development mode for the database-types package
  - `prod-mode.sh`: Sets up production mode for the database-types package
  - `integrate-database-types.sh`: Fully integrates the database-types package
  - `standardize-imports.sh`: Standardizes imports in the codebase
  - `DATABASE-TYPES-GUIDE.md`: Documentation for the database-types package

- **deployment/**: Scripts for deploying various parts of the application
  - `deploy.sh`: Main deployment script
  - `deploy-meal-planning.sh`: Script for deploying the meal planning feature

## Usage

### Database Types Management

To use the database-types scripts, navigate to this directory and run:

```bash
# For development mode (local linking)
./database-types/dev-mode.sh

# For production mode (published version)
./database-types/prod-mode.sh

# For full integration
./database-types/integrate-database-types.sh
```

Or you can use the npm scripts from the root package.json:

```bash
yarn dev-mode
yarn prod-mode
yarn integrate-db-types
```

### Deployment

To deploy the application or specific features:

```bash
# Full deployment
./deployment/deploy.sh

# Deploy meal planning feature
./deployment/deploy-meal-planning.sh
``` 