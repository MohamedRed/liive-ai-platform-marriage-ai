#!/bin/bash

# Set script to exit on error
set -e

# Define color codes for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===== Starting Database Types Integration Process =====${NC}"

# Step 1: Navigate to the database-types package and build it
echo -e "\n${YELLOW}Step 1: Building the database-types package...${NC}"
cd packages/database-types
yarn install
yarn build
echo -e "${GREEN}✓ Database-types package built successfully!${NC}"

# Step 2: Link the package for local development
echo -e "\n${YELLOW}Step 2: Linking the package for local development...${NC}"
yarn link
echo -e "${GREEN}✓ Package prepared for linking${NC}"

# Step 3: Go back to marriage-ai and link to the local package
echo -e "\n${YELLOW}Step 3: Linking marriage-ai frontend to local database-types package...${NC}"
cd ../../
yarn link @livve-1/database-types
echo -e "${GREEN}✓ Frontend linked to local database-types package!${NC}"

# Step 4: Run the standardize-imports script to update frontend imports
echo -e "\n${YELLOW}Step 4: Standardizing imports across the frontend codebase...${NC}"
./scripts/database-types/standardize-imports.sh
echo -e "${GREEN}✓ Frontend imports standardized!${NC}"

# Step 5: Link functions-nodejs to the local package
echo -e "\n${YELLOW}Step 5: Linking functions-nodejs to local database-types package...${NC}"
cd functions-nodejs
yarn link @livve-1/database-types
echo -e "${GREEN}✓ Functions-nodejs linked to local database-types package!${NC}"

# Step 6: Standardize imports in functions-nodejs
echo -e "\n${YELLOW}Step 6: Standardizing imports in functions-nodejs...${NC}"
# Create a functions-specific standardize script on the fly
cat > standardize-imports-functions.sh << 'EOF'
#!/bin/bash
set -e
FILES=$(find src -type f -name "*.ts")
MODIFIED_COUNT=0
for FILE in $FILES; do
  if grep -q "from '../../../packages/database-types/src'" "$FILE" || grep -q "from '@liive-marriage-ai/database-types'" "$FILE"; then
    echo -e "Updating imports in $FILE..."
    sed -i '' 's|from '"'"'../../../packages/database-types/src'"'"'|from '"'"'@livve-1/database-types'"'"'|g' "$FILE"
    sed -i '' 's|from '"'"'@liive-marriage-ai/database-types'"'"'|from '"'"'@livve-1/database-types'"'"'|g' "$FILE"
    MODIFIED_COUNT=$((MODIFIED_COUNT + 1))
  fi
done
echo -e "Modified $MODIFIED_COUNT files in functions-nodejs."
EOF
chmod +x standardize-imports-functions.sh
./standardize-imports-functions.sh
rm standardize-imports-functions.sh
echo -e "${GREEN}✓ Functions-nodejs imports standardized!${NC}"

# Step 7: Build both projects to check for errors
echo -e "\n${YELLOW}Step 7: Building projects to check for TypeScript errors...${NC}"
echo -e "${YELLOW}7a: Building marriage-ai frontend...${NC}"
cd ..
yarn build

echo -e "${YELLOW}7b: Building functions-nodejs...${NC}"
cd functions-nodejs
yarn build

echo -e "\n${GREEN}===== Database Types Integration Complete! =====${NC}"
echo -e "Both projects are now using the @livve-1/database-types package consistently."
echo -e "You can switch between development and production modes using:"
echo -e "  - ${YELLOW}yarn dev-mode${NC} - to use the local version of the package in both projects"
echo -e "  - ${YELLOW}yarn prod-mode${NC} - to use the published version of the package in both projects" 