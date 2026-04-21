# Terminal-Only iOS Release Guide

Build, archive, upload, and submit Bayaan to the App Store entirely from the terminal — no Xcode GUI or browser required.

Uses `xcodebuild` for building and `asc` ([asccli.sh](https://asccli.sh)) for App Store Connect operations.

## Prerequisites

### Tools

| Tool | Install | Purpose |
|------|---------|---------|
| Xcode | Mac App Store | `xcodebuild` for archive/export |
| `asc` | `brew install asc` | App Store Connect CLI ([asccli.sh](https://asccli.sh)) |
| Expo CLI | Bundled with project | `expo prebuild` |

### Credentials

| Credential | Location |
|------------|----------|
| App Store Connect API Key (.p8) | `~/Documents/app-credentials/bayaan/appstoreconnect/AuthKey_89436RZQQ2.p8` |
| Key ID | `89436RZQQ2` |
| Issuer ID | `11bd7cc0-6b65-4e93-bc4e-e2218eb4a185` |
| Team ID | `S4W5Q2L53W` |
| App ID | `6648769980` |
| Bundle ID | `com.bayaan.app` |

### One-Time Setup

```bash
# Install asc
brew install asc

# Authenticate (credentials stored in system keychain)
asc auth login \
  --name "Bayaan" \
  --key-id "89436RZQQ2" \
  --issuer-id "11bd7cc0-6b65-4e93-bc4e-e2218eb4a185" \
  --private-key ~/Documents/app-credentials/bayaan/appstoreconnect/AuthKey_89436RZQQ2.p8

# Verify connection
asc apps list
```

> **Note:** The `.p8` file must have restricted permissions: `chmod 600 AuthKey_89436RZQQ2.p8`

---

## Full Release Flow

### Step 1: Bump Version

```bash
cd /Users/osmansaeday/theBayaan/Bayaan

# Choose one:
npm run version:patch   # 2.1.2 → 2.1.3
npm run version:minor   # 2.1.2 → 2.2.0
npm run version:major   # 2.1.2 → 3.0.0

# Check result
npm run version:current
```

### Step 2: Prebuild iOS

```bash
npx expo prebuild --platform ios --clean
```

This regenerates the `ios/` directory and runs `pod install`. Takes ~5 minutes.

### Step 3: Archive

```bash
mkdir -p build

xcodebuild archive \
  -workspace ios/Bayaan.xcworkspace \
  -scheme Bayaan \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath build/Bayaan.xcarchive \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=S4W5Q2L53W
```

This is the longest step (~15 minutes). The archive is saved to `build/Bayaan.xcarchive`.

### Step 4: Export IPA

```bash
xcodebuild -exportArchive \
  -archivePath build/Bayaan.xcarchive \
  -exportPath build/output \
  -exportOptionsPlist ExportOptions.plist
```

The IPA is saved to `build/output/Bayaan.ipa` (~120MB).

### Step 5: Upload to App Store Connect

```bash
asc builds upload \
  --app 6648769980 \
  --ipa build/output/Bayaan.ipa
```

Upload takes ~1 minute. Apple then processes the build (~5-10 min).

Check processing status:

```bash
asc status --app 6648769980
```

### Step 6: Distribute to TestFlight

```bash
# Distribute to a single group
asc publish testflight \
  --app 6648769980 \
  --build-number BUILD_NUM \
  --group "Family" \
  --notify

# Distribute to multiple groups
asc publish testflight \
  --app 6648769980 \
  --build-number BUILD_NUM \
  --group "Family,Bayaan Team,Experimental" \
  --notify

# Wait for processing before distributing
asc publish testflight \
  --app 6648769980 \
  --build-number BUILD_NUM \
  --group "Family" \
  --wait \
  --notify
```

### Step 7: Submit for App Store Review (Optional)

```bash
# Upload + submit in one shot
asc publish appstore \
  --app 6648769980 \
  --ipa build/output/Bayaan.ipa \
  --version "X.Y.Z" \
  --submit \
  --confirm

# Or submit an already-uploaded build
asc submit create \
  --app 6648769980 \
  --version "X.Y.Z" \
  --build "BUILD_ID" \
  --confirm
```

### Step 8: Post-Release

```bash
# Commit and tag
git commit -am "Bump version to X.Y.Z"
git push && git push origin vX.Y.Z

# Create GitHub release
gh release create vX.Y.Z --notes "Release notes here"
```

---

## TestFlight Groups

| Group | ID | Type | Public Link |
|-------|----|------|-------------|
| Bayaan Internal | `43f885ac-6107-439c-8b1a-5ea16cce032f` | Internal | Auto (all builds) |
| Family | `68456f9f-6d19-46a1-b3c5-a9f1599279d3` | External | `testflight.apple.com/join/YK9CqkxH` |
| Experimental | `e18ff87e-fc91-4839-9c46-cce86db1d30e` | External | `testflight.apple.com/join/51BjDRen` |
| Bayaan Team | `ece383d1-1326-4ded-91f0-573b30510011` | External | `testflight.apple.com/join/rJ8xgHU1` |

You can use either the group **name** or **ID** with `--group`.

### TestFlight Management

```bash
# List all groups
asc testflight groups list --app 6648769980

# List testers in a group
asc testflight testers list --app 6648769980

# Add a tester to a group
asc testflight groups add-testers --group "GROUP_ID" --email "user@example.com"

# Create a new group
asc testflight groups create --app 6648769980 --name "New Group"

# View TestFlight feedback
asc testflight feedback list --app 6648769980

# View TestFlight crashes
asc testflight crashes view --submission-id "SUBMISSION_ID"

# Send notification to testers about a build
asc testflight notifications send --build-id "BUILD_ID"
```

---

## App Store Connect Commands

### Status & Monitoring

```bash
# Full release pipeline dashboard
asc status --app 6648769980

# List recent builds with processing state
asc builds list --app 6648769980 --limit 10

# Check crashes
asc crashes --app 6648769980 --sort -createdDate --limit 10

# Customer reviews
asc reviews list --app 6648769980
```

### Builds

```bash
# List builds
asc builds list --app 6648769980 --limit 5

# Upload a new build
asc builds upload --app 6648769980 --ipa path/to/app.ipa
```

### Versions & Metadata

```bash
# List app versions
asc versions list --app 6648769980

# List localizations
asc localizations list --app 6648769980

# List screenshots
asc screenshots list --app 6648769980
```

### Review & Submission

```bash
# Check review status
asc review view --app 6648769980

# Validate submission readiness
asc validate --app 6648769980

# Submit for review
asc submit create --app 6648769980 --version "X.Y.Z" --build "BUILD_ID" --confirm
```

### Signing & Certificates

```bash
# List certificates
asc certificates list

# List provisioning profiles
asc profiles list

# List bundle IDs
asc bundle-ids list
```

---

## One-Command Flows

### TestFlight-only release (no App Store submission)

```bash
# Build + upload + distribute to Family group
npx expo prebuild --platform ios --clean && \
mkdir -p build && \
xcodebuild archive \
  -workspace ios/Bayaan.xcworkspace \
  -scheme Bayaan \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath build/Bayaan.xcarchive \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=S4W5Q2L53W && \
xcodebuild -exportArchive \
  -archivePath build/Bayaan.xcarchive \
  -exportPath build/output \
  -exportOptionsPlist ExportOptions.plist && \
asc publish testflight \
  --app 6648769980 \
  --ipa build/output/Bayaan.ipa \
  --group "Family" \
  --wait \
  --notify
```

### Full App Store release

```bash
npx expo prebuild --platform ios --clean && \
mkdir -p build && \
xcodebuild archive \
  -workspace ios/Bayaan.xcworkspace \
  -scheme Bayaan \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath build/Bayaan.xcarchive \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=S4W5Q2L53W && \
xcodebuild -exportArchive \
  -archivePath build/Bayaan.xcarchive \
  -exportPath build/output \
  -exportOptionsPlist ExportOptions.plist && \
asc publish appstore \
  --app 6648769980 \
  --ipa build/output/Bayaan.ipa \
  --version "X.Y.Z" \
  --submit \
  --confirm
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `asc auth` fails with permissions | `chmod 600` on the `.p8` file |
| Archive fails with signing error | Ensure `CODE_SIGN_STYLE=Automatic` and `DEVELOPMENT_TEAM=S4W5Q2L53W` are set |
| Export fails "no profiles" | Open Xcode once to let it download provisioning profiles, or use `xcodebuild -downloadAllPlatforms` |
| Upload rejected "invalid binary" | Ensure `ExportOptions.plist` has `method` set to `app-store-connect` |
| Build processing stuck | Check `asc status --app 6648769980` — processing can take up to 30 min |
| `asc` command not found | Run `brew install asc` or check `which asc` |
| Keychain credentials error during export | Cosmetic warning from Xcode — does not affect the export |
| Build number already exists | Apple rejects duplicate build numbers; bump version or ensure a new commit count |

---

## ExportOptions.plist

Located at project root (`ExportOptions.plist`). Contents:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>teamID</key>
    <string>S4W5Q2L53W</string>
    <key>uploadBitcode</key>
    <false/>
    <key>uploadSymbols</key>
    <true/>
    <key>destination</key>
    <string>export</string>
    <key>signingStyle</key>
    <string>automatic</string>
</dict>
</plist>
```

---

## Typical Build Times (Apple Silicon)

| Step | Duration |
|------|----------|
| `expo prebuild --platform ios --clean` | ~5 min |
| `xcodebuild archive` | ~15 min |
| `xcodebuild -exportArchive` | ~30 sec |
| `asc builds upload` | ~1 min |
| Apple processing | ~5-10 min |
| **Total** | **~25-30 min** |
