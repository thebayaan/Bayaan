#!/bin/bash

# iOS Archive and Upload Script
# Usage: ./scripts/ios-archive.sh [--upload]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
WORKSPACE="ios/Bayaan.xcworkspace"
SCHEME="Bayaan"
CONFIGURATION="Release"
ARCHIVE_PATH="build/Bayaan.xcarchive"
EXPORT_PATH="build/export"
EXPORT_OPTIONS="ios/ExportOptions.plist"

# Parse arguments
UPLOAD=false
for arg in "$@"; do
    case $arg in
        --upload)
            UPLOAD=true
            shift
            ;;
    esac
done

echo -e "${YELLOW}🔧 iOS Archive Script${NC}"
echo "========================"

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
echo -e "Version: ${GREEN}$VERSION${NC}"

# Clean build folder
echo -e "\n${YELLOW}📁 Cleaning build folder...${NC}"
rm -rf build/
mkdir -p build/

# Run pod install
echo -e "\n${YELLOW}📦 Running pod install...${NC}"
cd ios && pod install && cd ..

# Archive
echo -e "\n${YELLOW}📦 Archiving...${NC}"
xcodebuild -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -configuration "$CONFIGURATION" \
    -archivePath "$ARCHIVE_PATH" \
    -destination "generic/platform=iOS" \
    archive \
    | xcpretty || xcodebuild -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -configuration "$CONFIGURATION" \
    -archivePath "$ARCHIVE_PATH" \
    -destination "generic/platform=iOS" \
    archive

if [ ! -d "$ARCHIVE_PATH" ]; then
    echo -e "${RED}❌ Archive failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Archive created at $ARCHIVE_PATH${NC}"

# Export
echo -e "\n${YELLOW}📤 Exporting IPA...${NC}"
xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportPath "$EXPORT_PATH" \
    -exportOptionsPlist "$EXPORT_OPTIONS" \
    | xcpretty || xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportPath "$EXPORT_PATH" \
    -exportOptionsPlist "$EXPORT_OPTIONS"

if [ ! -f "$EXPORT_PATH/Bayaan.ipa" ]; then
    echo -e "${RED}❌ Export failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ IPA exported to $EXPORT_PATH/Bayaan.ipa${NC}"

# Upload to App Store Connect (optional)
if [ "$UPLOAD" = true ]; then
    echo -e "\n${YELLOW}🚀 Uploading to App Store Connect...${NC}"
    xcrun altool --upload-app \
        --type ios \
        --file "$EXPORT_PATH/Bayaan.ipa" \
        --apiKey "$APP_STORE_CONNECT_API_KEY_ID" \
        --apiIssuer "$APP_STORE_CONNECT_ISSUER_ID" \
        2>/dev/null || \
    xcrun notarytool submit "$EXPORT_PATH/Bayaan.ipa" \
        --keychain-profile "AC_PASSWORD" \
        --wait 2>/dev/null || \
    echo -e "${YELLOW}⚠️  Auto-upload requires App Store Connect API key setup.${NC}"
    echo -e "${YELLOW}   You can manually upload using Transporter app or:${NC}"
    echo -e "${YELLOW}   xcrun altool --upload-app --type ios --file $EXPORT_PATH/Bayaan.ipa${NC}"
fi

echo -e "\n${GREEN}🎉 Done!${NC}"
echo -e "Archive: $ARCHIVE_PATH"
echo -e "IPA: $EXPORT_PATH/Bayaan.ipa"
