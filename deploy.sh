#!/bin/bash

# Navigate to the vite-ts directory
cd vite-ts

# Generate PWA icons
echo "Generating PWA icons..."
yarn generate:icons

# Build the application
echo "Building the application..."
yarn build

# Return to root directory
cd ..

# Deploy to Firebase Hosting
echo "Deploying to Firebase Hosting..."
firebase deploy --only hosting

echo "Deployment complete!" 