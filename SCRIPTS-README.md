# Marriage AI Scripts Guide

## Scripts Organization

All scripts for this project have been organized into proper directories:

- **Database Types Management**: Located in `scripts/database-types/`
- **Deployment Scripts**: Located in `scripts/deployment/`

For a detailed explanation of each script and its purpose, see `scripts/README.md`.

## Quick Access with Yarn

You can access the most important scripts using yarn commands:

### Database Types Management

```bash
# For development mode (local linking)
yarn dev-mode

# For production mode (published version)
yarn prod-mode

# For full integration
yarn integrate-db-types

# For quick linking without building
yarn use-local

# For quick installation of published version
yarn use-published
```

### Deployment

```bash
# Full deployment
yarn deploy

# Deploy meal planning feature
yarn deploy:meal-planning
```

## Detailed Documentation

For detailed information about database types usage and integration, see:
`scripts/database-types/DATABASE-TYPES-GUIDE.md` 