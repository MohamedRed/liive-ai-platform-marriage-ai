#!/bin/bash
set -e

echo "Starting deployment of meal planning functions..."

# Navigate to the root directory
cd "$(dirname "$0")"

# Build the database-types package
echo "Building database-types package..."
cd packages/database-types
npm run build
cd ../../

# Navigate to functions-nodejs
echo "Setting up functions-nodejs..."
cd functions-nodejs

# Build the functions
echo "Building the functions..."
npm run build

# Deploy the meal planning functions
echo "Deploying meal planning functions..."
firebase deploy --only functions:nodejs:generateMealPlan,functions:nodejs:getUserMealPlans,functions:nodejs:updateMeal,functions:nodejs:shareMealPlan --project marriage-ai-289c6

echo "Deployment completed successfully!" 