#!/bin/bash

# Set script to exit on error
set -e

# Define color codes for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting import standardization process...${NC}"

# Move to the marriage-ai root directory
# cd ../../ # REMOVED: This was causing the script to run from the wrong directory

# Find all TypeScript and TSX files in the src directory
# This command will now run in the directory where the script was called from (apps/marriage-ai)
FILES=$(find src -type f -name "*.ts" -o -name "*.tsx")

# Counter for modified files
MODIFIED_COUNT=0

# Process each file
for FILE in $FILES; do
  # Check if the file imports from the relative path
  if grep -q "from '../../../packages/database-types/src'" "$FILE"; then
    echo -e "Updating imports in ${YELLOW}$FILE${NC}..."
    
    # Replace the relative path with the package import
    sed -i '' 's|from '"'"'../../../packages/database-types/src'"'"'|from '"'"'@livve-1/database-types'"'"'|g' "$FILE"
    
    # Also replace any @liive-marriage-ai/database-types imports
    sed -i '' 's|from '"'"'@liive-marriage-ai/database-types'"'"'|from '"'"'@livve-1/database-types'"'"'|g' "$FILE"
    
    MODIFIED_COUNT=$((MODIFIED_COUNT + 1))
  elif grep -q "from '@liive-marriage-ai/database-types'" "$FILE"; then
    echo -e "Updating imports in ${YELLOW}$FILE${NC}..."
    
    # Replace the old package name with the new one
    sed -i '' 's|from '"'"'@liive-marriage-ai/database-types'"'"'|from '"'"'@livve-1/database-types'"'"'|g' "$FILE"
    
    MODIFIED_COUNT=$((MODIFIED_COUNT + 1))
  fi
done

echo -e "${GREEN}Import standardization complete!${NC}"
echo -e "${GREEN}Modified $MODIFIED_COUNT files.${NC}"

# Remind to build the project
echo -e "${YELLOW}Remember to run 'yarn build' to ensure all changes are properly compiled.${NC}" 