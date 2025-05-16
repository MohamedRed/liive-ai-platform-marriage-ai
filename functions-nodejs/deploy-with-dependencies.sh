#!/bin/bash
set -e

# First, build the database-types package
echo "Building database-types package..."
cd ../packages/database-types
npm run build
cd ../../functions-nodejs

# Create a temporary directory for database-types in lib
echo "Preparing for deployment..."
mkdir -p lib/packages/database-types/dist

# Copy the database-types package files
echo "Copying database-types package..."
cp -r ../packages/database-types/dist/* lib/packages/database-types/dist/
cp ../packages/database-types/package.json lib/packages/database-types/

# Build the functions
echo "Building functions..."
npm run build

# Update the import paths in the compiled JavaScript files
echo "Updating import paths..."
find lib -name "*.js" -type f -exec sed -i '' 's|require("@liive-marriage-ai/database-types")|require("./packages/database-types/dist")|g' {} \;
find lib -name "*.js" -type f -exec sed -i '' 's|from "@liive-marriage-ai/database-types"|from "./packages/database-types/dist"|g' {} \;

# Deploy only the meal planning functions
echo "Deploying meal planning functions..."
firebase deploy --only functions:mealPlanningFunctions

# Clean up
echo "Cleaning up..."
rm -rf lib/packages 