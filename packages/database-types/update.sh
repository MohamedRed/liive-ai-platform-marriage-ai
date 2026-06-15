#!/bin/bash
set -e

# Define colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting database-types package update process...${NC}"

# 1. Get current version and increment
CURRENT_VERSION=$(node -p "require('./package.json').version")
MAJOR=$(echo $CURRENT_VERSION | cut -d. -f1)
MINOR=$(echo $CURRENT_VERSION | cut -d. -f2)
PATCH=$(echo $CURRENT_VERSION | cut -d. -f3)
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"

echo -e "${YELLOW}Current version: $CURRENT_VERSION -> New version: $NEW_VERSION${NC}"

# 2. Update package.json version
npm version $NEW_VERSION --no-git-tag-version

echo -e "${GREEN}Updated package.json version to $NEW_VERSION${NC}"

# 3. Build the package
echo -e "${YELLOW}Building package...${NC}"
yarn build

# 4. Publish the package
echo -e "${YELLOW}Publishing package to GitHub Packages...${NC}"
npm publish

echo -e "${GREEN}Package published successfully!${NC}"

# 5. Go to functions-nodejs and update the dependency
cd ../../functions-nodejs

# Update the dependency
echo -e "${YELLOW}Updating dependency in functions-nodejs...${NC}"
npm install @livve-1/database-types@$NEW_VERSION --save

echo -e "${GREEN}Dependency updated to version $NEW_VERSION${NC}"

# 6. Build the functions
echo -e "${YELLOW}Building functions...${NC}"
npm run build

echo -e "${GREEN}All done! Package updated to version $NEW_VERSION and functions rebuilt.${NC}" 