#!/bin/bash
set -e

echo "Starting deployment of minimal test function..."

# Navigate to the root directory
cd "$(dirname "$0")"
cd ../../

# Navigate to functions-nodejs
echo "Setting up functions-nodejs..."
cd functions-nodejs

# Create .npmrc file with GitHub registry authentication if missing
if [ ! -f .npmrc ] || ! grep -q "npm.pkg.github.com" .npmrc; then
  echo "Configuring GitHub Packages authentication..."
  echo "@livve-1:registry=https://npm.pkg.github.com/" > .npmrc
  echo "Created .npmrc for GitHub authentication"
fi

# Build the functions
echo "Building the functions..."
npm run build

# Deploy just the minimal test function
echo "Deploying minimal test function..."
firebase deploy --only functions:nodejs:minimalTestFunction --project marriage-ai-289c6

echo "Deployment completed!" 