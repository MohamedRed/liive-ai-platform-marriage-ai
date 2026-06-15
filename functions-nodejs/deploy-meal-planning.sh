#!/bin/bash

# Exit on any error
set -e

echo "Starting deployment of meal planning cloud functions..."

# Build the database-types package first
echo "Building database-types package..."
cd "$(dirname "$0")/../packages/database-types"
npm run build
cd "$(dirname "$0")"

# Create a lib directory if it doesn't exist
echo "Preparing function deployment..."
mkdir -p lib

# Copy the database-types directly into the lib folder (where Firebase will look)
echo "Copying database-types into lib folder..."
mkdir -p lib/types
cp -r ../packages/database-types/dist/* lib/types/

# Build the functions
echo "Building functions..."
npm run build

# Update imports in compiled JS files to point to local types
echo "Updating imports in compiled files..."
find lib -name "*.js" -type f -exec sed -i '' 's/@liive-marriage-ai\/database-types/.\/types/g' {} \;

# Deploy meal planning functions
echo "Deploying meal planning functions..."
firebase deploy --only functions:nodejs:generateMealPlan,functions:nodejs:getUserMealPlans,functions:nodejs:updateMeal,functions:nodejs:shareMealPlan

# Clean up
echo "Cleaning up..."
rm -rf lib/types

echo "Deployment completed successfully!" 