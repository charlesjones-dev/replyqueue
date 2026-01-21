#!/bin/bash
# Build and package ReplyQueue for Chrome Web Store submission
# Usage: ./scripts/package.sh

set -e

# Get project root (parent of scripts directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Get version from manifest.json
VERSION=$(grep '"version"' manifest.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')

echo -e "\033[36mBuilding ReplyQueue v$VERSION...\033[0m"

# Clean dist folder
if [ -d "dist" ]; then
    rm -rf dist
    echo -e "\033[90mCleaned dist folder\033[0m"
fi

# Run build
echo -e "\033[90mRunning pnpm build...\033[0m"
pnpm build
if [ $? -ne 0 ]; then
    echo -e "\033[31mBuild failed!\033[0m"
    exit 1
fi

# Create packages folder if it doesn't exist
PACKAGES_DIR="packages"
mkdir -p "$PACKAGES_DIR"

# Create zip file
ZIP_NAME="replyqueue-v$VERSION.zip"
ZIP_PATH="$PACKAGES_DIR/$ZIP_NAME"

# Remove existing zip if present
if [ -f "$ZIP_PATH" ]; then
    rm "$ZIP_PATH"
fi

echo -e "\033[90mCreating $ZIP_NAME...\033[0m"
cd dist
zip -r "../$ZIP_PATH" .
cd ..

# Get file size
SIZE=$(du -h "$ZIP_PATH" | cut -f1)

echo ""
echo -e "\033[32mPackage created successfully!\033[0m"
echo -e "  File: $ZIP_PATH"
echo -e "  Size: $SIZE"
echo ""
echo -e "\033[33mUpload this file to the Chrome Developer Dashboard\033[0m"
