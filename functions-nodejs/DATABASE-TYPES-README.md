# Database Types Management

## Important Note

The database-types package management scripts are now located in the parent directory under `scripts/database-types/`.

To manage the database-types package for both the frontend and functions-nodejs, please **use the yarn scripts from the parent directory**:

```bash
# Navigate to the parent directory
cd ..

# For development mode (local linking)
yarn dev-mode

# For production mode (published version)
yarn prod-mode

# For quick linking without building
yarn use-local

# For quick installation of published version
yarn use-published

# For full integration
yarn integrate-db-types
```

Alternatively, you can use the shell scripts directly:

```bash
cd ..
./scripts/database-types/dev-mode.sh
./scripts/database-types/prod-mode.sh
./scripts/database-types/integrate-database-types.sh
```

For detailed documentation, please refer to the `scripts/database-types/DATABASE-TYPES-GUIDE.md` file in the parent directory.

## Legacy Scripts (Removed)

The following scripts have been removed from this package.json:

- `use-local`: Replaced by `yarn dev-mode` or `yarn use-local` in parent directory
- `use-published`: Replaced by `yarn prod-mode` or `yarn use-published` in parent directory

These changes help maintain a single source of truth for database-types management. 