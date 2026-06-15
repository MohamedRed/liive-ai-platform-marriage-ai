#!/bin/bash

# Set script to exit on error
set -e

# Define color codes for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===== Setting up Production Mode for Database Types =====${NC}"

# Step 1: Navigate to the database-types package
echo -e "\n${YELLOW}Step 1: Updating and publishing database-types package...${NC}"
cd packages/database-types

# Update the package version
echo -e "${YELLOW}Updating package version...${NC}"
yarn update-version

# Build the package
echo -e "${YELLOW}Building package...${NC}"
yarn build

# Publish the package
echo -e "${YELLOW}Publishing package to GitHub Packages...${NC}"
npm publish

# Get the current version for user feedback
VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}✓ Published database-types package version ${VERSION}${NC}"

# Step 2: Configure marriage-ai frontend for production usage
echo -e "\n${YELLOW}Step 2: Configuring marriage-ai frontend for production usage...${NC}"
cd ../../
yarn unlink "@livve-1/database-types" || true
yarn add "@livve-1/database-types@$VERSION"
echo -e "${GREEN}✓ Frontend configured to use published package v${VERSION}${NC}"

# Step 3: Configure functions-nodejs for production usage
echo -e "\n${YELLOW}Step 3: Configuring functions-nodejs for production usage...${NC}"
cd functions-nodejs
yarn unlink "@livve-1/database-types" || true
yarn add "@livve-1/database-types@$VERSION"
echo -e "${GREEN}✓ Functions-nodejs configured to use published package v${VERSION}${NC}"

echo -e "\n${GREEN}===== Production Mode Setup Complete! =====${NC}"
echo -e "Both projects are now using the published version (${VERSION}) of the database-types package:"
echo -e "  - Marriage-AI frontend"
echo -e "  - Functions-nodejs backend" 