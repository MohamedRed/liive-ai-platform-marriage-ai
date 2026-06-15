#!/bin/bash
set -e

echo "Starting deployment of meal planning functions..."

# Navigate to the root directory
cd "$(dirname "$0")"
cd ../../

# Define variables
PROJECT_ID="marriage-ai-289c6"

# Explicitly set the Firebase project
echo "Setting Firebase project..."
firebase use $PROJECT_ID

# Build the database-types package
echo "Building database-types package..."
cd packages/database-types
npm run build
cd ../../

# Navigate to functions-nodejs
echo "Setting up functions-nodejs..."
cd functions-nodejs

# Create a modules directory for the local database-types package
echo "Preparing local database-types package for deployment..."
mkdir -p ./modules/@livve-1/database-types/
cp -r ../packages/database-types/dist ./modules/@livve-1/database-types/
cp ../packages/database-types/package.json ./modules/@livve-1/database-types/

# Update package.json to use local module
echo "Updating package.json to use local database-types package..."
cat > update-package.js << 'EOF'
const fs = require('fs');
const path = require('path');

try {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = require(packageJsonPath);
  
  // Create a backup of the original package.json
  fs.writeFileSync(`${packageJsonPath}.bak`, JSON.stringify(packageJson, null, 2));
  
  // Update the database-types dependency to use local module
  if (packageJson.dependencies && packageJson.dependencies['@livve-1/database-types']) {
    packageJson.dependencies['@livve-1/database-types'] = 'file:./modules/@livve-1/database-types';
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log("Updated package.json to use local database-types package");
  } else {
    console.log("Warning: @livve-1/database-types not found in package.json dependencies");
  }
} catch (error) {
  console.error('Error updating package.json:', error);
  process.exit(1);
}
EOF

# Run the script to update package.json
node update-package.js
rm update-package.js

# Ensure .gcloudignore doesn't exclude the modules directory
echo "Updating .gcloudignore (if exists) to preserve modules directory..."
if [ -f ".gcloudignore" ]; then
  if grep -q "node_modules" .gcloudignore; then
    # Add exception for our modules directory
    sed -i.bak '/node_modules/i !modules/**' .gcloudignore
    # Remove backup file
    rm -f .gcloudignore.bak
  fi
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the functions
echo "Building the functions..."
npm run build

# Deploy each function individually with vendor flag
echo "Deploying functions with GOOGLE_VENDOR_NPM_DEPENDENCIES=true..."

# Deploy generateMealPlan function
echo "Deploying generateMealPlan function..."
firebase deploy --only functions:nodejs:generateMealPlan --project $PROJECT_ID

echo "Waiting 10 seconds before deploying the next function..."
sleep 10

# Deploy getUserMealPlans function
echo "Deploying getUserMealPlans function..."
firebase deploy --only functions:nodejs:getUserMealPlans --project $PROJECT_ID

echo "Waiting 10 seconds before deploying the next function..."
sleep 10

# Deploy updateMeal function
echo "Deploying updateMeal function..."
firebase deploy --only functions:nodejs:updateMeal --project $PROJECT_ID

echo "Waiting 10 seconds before deploying the next function..."
sleep 10

# Deploy shareMealPlan function
echo "Deploying shareMealPlan function..."
firebase deploy --only functions:nodejs:shareMealPlan --project $PROJECT_ID

# Restore the original package.json
echo "Restoring original package.json..."
if [ -f "package.json.bak" ]; then
  mv package.json.bak package.json
  echo "Original package.json restored"
fi

# Clean up
echo "Cleaning up..."
rm -rf ./modules

echo "Deployment completed successfully!" 