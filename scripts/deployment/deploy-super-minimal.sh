#!/bin/bash
set -e

echo "Starting deployment of super minimal test function..."

# Navigate to the root directory
cd "$(dirname "$0")"
cd ../../

# Explicitly set the Firebase project
echo "Setting Firebase project..."
firebase use marriage-ai-289c6

# Navigate to functions-nodejs
echo "Setting up functions-nodejs..."
cd functions-nodejs

# Build the functions
echo "Building the functions..."
npm run build

# Deploy just the super minimal test function
echo "Deploying super minimal test function..."
firebase deploy --only functions:nodejs:superMinimalTest --project marriage-ai-289c6

echo "Deployment completed!" 