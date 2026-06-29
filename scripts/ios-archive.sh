#!/bin/bash

# iOS Archive and Upload Script
# Usage: ./scripts/ios-archive.sh [--upload]
#
# Auto-detects the iOS workspace + scheme by scanning `ios/*.xcworkspace`,
# rather than hardcoding the app name. Drop-in for forks that customize the
# appName via `expo prebuild --clean` — the script names the archive +
# IPA according to whatever workspace exists, no edits needed.
#
# Companion: ios/ExportOptions.example.plist — copy to ios/ExportOptions.plist
# (gitignored — it contains your team ID) and fill in your APPLE_TEAM_ID.

set -e

# Force UTF-8 locale for CocoaPods. Ruby 3.3 + CocoaPods 1.16.x raise
# Encoding::CompatibilityError when LANG isn't a UTF-8 locale. Mirrors
# the same guard in package.json's "ios" script.
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# Don't fail the archive when Sentry source-map upload hits a transient
# network error (DNS, SSL_read, etc). Symbolication is best-effort; a
# flaky upload should not block a release build.
export SENTRY_ALLOW_FAILURE=true

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ── Auto-detect workspace + scheme ────────────────────────────────────────────
shopt -s nullglob
WORKSPACES=(ios/*.xcworkspace)
shopt -u nullglob
if [ ${#WORKSPACES[@]} -eq 0 ]; then
    echo -e "${RED}❌ No iOS workspace found. Run 'npx expo prebuild --platform ios' first.${NC}"
    exit 1
fi
if [ ${#WORKSPACES[@]} -gt 1 ]; then
    echo -e "${RED}❌ Multiple iOS workspaces found in ios/. Expected exactly one.${NC}"
    printf '   %s\n' "${WORKSPACES[@]}"
    exit 1
fi
WORKSPACE="${WORKSPACES[0]}"
APP_NAME="$(basename "$WORKSPACE" .xcworkspace)"
SCHEME="$APP_NAME"
CONFIGURATION="Release"
ARCHIVE_PATH="build/${APP_NAME}.xcarchive"
EXPORT_PATH="build/export"
EXPORT_OPTIONS="ios/ExportOptions.plist"
IPA_PATH="${EXPORT_PATH}/${APP_NAME}.ipa"

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
echo -e "  Workspace: ${GREEN}$WORKSPACE${NC}"
echo -e "  Scheme:    ${GREEN}$SCHEME${NC}"
echo -e "  IPA:       ${GREEN}$IPA_PATH${NC}"

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
echo -e "  Version:   ${GREEN}$VERSION${NC}"

# Pre-flight: ExportOptions.plist must exist (created by hand during sprint
# bootstrap; see planning/ for the team-id-aware template).
if [ ! -f "$EXPORT_OPTIONS" ]; then
    echo -e "${RED}❌ Missing $EXPORT_OPTIONS. Create it with method=app-store and your APPLE_TEAM_ID.${NC}"
    exit 1
fi

# Pre-flight: assert version sync between app.config.ts source-of-truth +
# iOS Info.plist + android/app/build.gradle. `expo prebuild` regenerates the
# native dirs from the config, but if you bump app.config.ts and forget to
# re-prebuild before archiving, the archive will ship with stale version
# metadata — Apple rejects builds whose CFBundleShortVersionString is below
# a previously-shipped value. Catching this at archive time costs an extra
# build cycle.
#
# Default: check-only. On drift, exit non-zero and ask the developer to
# re-run with VERIFY_FIX=1 (consciously opt-in to native-file mutation).
# `VERIFY_FIX=1` triggers `--fix` on this single archive run; standing rule
# is still archive BEFORE committing the resulting sync (committing first
# bumps the build count and leaves the native files 1 behind again).
#
# Why opt-in: previous default of unconditional `--fix` mutated native
# files on every archive run, which (a) makes the working tree non-pristine
# whenever the script runs, and (b) means there's no signal when drift
# actually exists vs. when everything was already in sync.
# --platform=ios scopes the check to the iOS Info.plist only — an Android-only
# build number drift shouldn't block an iOS archive (release cadences differ).
if [ "${VERIFY_FIX:-}" = "1" ] || [ "${VERIFY_FIX:-}" = "true" ]; then
    echo -e "\n${YELLOW}🔍 Verifying version sync (VERIFY_FIX=1 → auto-fix on drift)...${NC}"
    node "$(dirname "$0")/verify-version-sync.js" --platform=ios --fix || {
        echo -e "${RED}❌ Version sync patch failed — manual fix needed (see output above).${NC}"
        exit 1
    }
else
    echo -e "\n${YELLOW}🔍 Verifying version sync (check-only, iOS)...${NC}"
    node "$(dirname "$0")/verify-version-sync.js" --platform=ios || {
        echo -e "${RED}❌ Version drift detected. Review output above, then either:${NC}"
        echo -e "${RED}   - re-run with VERIFY_FIX=1 ${0} to auto-patch and archive in one shot, OR${NC}"
        echo -e "${RED}   - fix manually and re-run ${0}.${NC}"
        exit 1
    }
fi

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

if [ ! -f "$IPA_PATH" ]; then
    echo -e "${RED}❌ Export failed (expected $IPA_PATH)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ IPA exported to $IPA_PATH${NC}"

# Upload to App Store Connect (optional)
if [ "$UPLOAD" = true ]; then
    echo -e "\n${YELLOW}🚀 Uploading to App Store Connect...${NC}"
    if [ -n "$APP_STORE_CONNECT_API_KEY_ID" ] && [ -n "$APP_STORE_CONNECT_ISSUER_ID" ]; then
        xcrun altool --upload-app \
            --type ios \
            --file "$IPA_PATH" \
            --apiKey "$APP_STORE_CONNECT_API_KEY_ID" \
            --apiIssuer "$APP_STORE_CONNECT_ISSUER_ID"
    else
        echo -e "${YELLOW}⚠️  APP_STORE_CONNECT_API_KEY_ID / _ISSUER_ID not set in env.${NC}"
        echo -e "${YELLOW}   Manual upload options:${NC}"
        echo -e "${YELLOW}     • Transporter.app — drag $IPA_PATH onto its window${NC}"
        echo -e "${YELLOW}     • xcrun altool --upload-app --type ios --file $IPA_PATH \\${NC}"
        echo -e "${YELLOW}       --apiKey \$ID --apiIssuer \$ISSUER  (Apple ID API key)${NC}"
    fi
fi

echo -e "\n${GREEN}🎉 Done!${NC}"
echo -e "  Archive: $ARCHIVE_PATH"
echo -e "  IPA:     $IPA_PATH"
