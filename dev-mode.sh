#!/bin/bash

# Set script to exit on error
set -e

# Define color codes for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===== Setting up Development Mode for Database Types =====${NC}"

# Step 1: Navigate to the database-types package and build it
echo -e "\n${YELLOW}Step 1: Building the database-types package...${NC}"
cd packages/database-types
yarn build
echo -e "${GREEN}✓ Database-types package built successfully!${NC}"

# Step 2: Set up linking for local development
echo -e "\n${YELLOW}Step 2: Setting up package linking...${NC}"
yarn link
echo -e "${GREEN}✓ Package prepared for linking${NC}"

# Step 3: Go back to marriage-ai and configure for local usage
echo -e "\n${YELLOW}Step 3: Configuring marriage-ai frontend for local usage...${NC}"
cd ../../
yarn link @livve-1/database-types
echo -e "${GREEN}✓ Frontend linked to local package${NC}"

# Step 4: Configure functions-nodejs for local usage
echo -e "\n${YELLOW}Step 4: Configuring functions-nodejs for local usage...${NC}"
cd functions-nodejs
yarn link @livve-1/database-types
echo -e "${GREEN}✓ Functions-nodejs linked to local package${NC}"

echo -e "\n${GREEN}===== Development Mode Setup Complete! =====${NC}"
echo -e "You are now using the local version of the database-types package in both:"
echo -e "  - Marriage-AI frontend"
echo -e "  - Functions-nodejs backend"
echo -e ""
echo -e "${YELLOW}Important: After making changes to database-types, run:${NC}"
echo -e "  cd packages/database-types && yarn build"
echo -e "Changes will be immediately available to both projects." 