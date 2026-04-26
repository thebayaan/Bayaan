# Bayaan App Deployment Guide

This document outlines the complete process for deploying the Bayaan app to both Google Play Store (Android) and Apple App Store (iOS).

## Version Management

Bayaan uses a Git-based version management system described in detail in [version-management.md](version-management.md).

### Quick Version Summary

- **Versioning System**: Semantic versioning (MAJOR.MINOR.PATCH)
- **Version Source**: Git tags
- **Build Number**: Based on Git commit count
- **Version Bump Commands**:
  ```bash
  # Increment patch version (1.0.3 → 1.0.4)
  npm run version:patch

  # Increment minor version (1.0.3 → 1.1.0)
  npm run version:minor

  # Increment major version (1.0.3 → 2.0.0)
  npm run version:major
  ```
- **Check Current Version**:
  ```bash
  npm run version:current
  ```

## Deployment Prerequisites

1. Ensure all changes are committed to Git
2. Run tests to verify app functionality
3. Bump version using the appropriate command (see above)
4. Push changes and new version tag:
   ```bash
   git commit -am "Bump version to X.Y.Z"
   git push
   git push origin vX.Y.Z
   ```

## Android Deployment

### Android Signing Configuration

Bayaan uses an Expo Config Plugin (`withAndroidSigning.js` in the project root) to automatically manage Android signing configuration. The plugin:

- Adds proper signing configurations to `android/app/build.gradle`
- Ensures correct signing for release builds
- Maintains configuration even when native projects are regenerated

This approach eliminates the need for an external `signing.gradle` file that was previously used.

### Build Android App Bundle

1. First, generate a fresh native build with Expo:
   ```bash
   npx expo prebuild --platform android --clean
   ```

2. Navigate to the android directory:
   ```bash
   cd android
   ```

3. Build the release bundle:
   ```bash
   ./gradlew bundleRelease
   ```

4. The AAB will be located at:
   ```
   app/build/outputs/bundle/release/app-release.aab
   ```

### Upload to Google Play Console

1. Go to [Google Play Console](https://play.google.com/console/)
2. Select the Bayaan app
3. Navigate to "Production" (or your desired track)
4. Click "Create new release"
5. Upload the AAB file
6. Add release notes
7. Review and roll out

### Keystore Management

The upload keystore is stored at:
```
~/Documents/app-credentials/bayaan/keystore/bayaan-upload-key.keystore
```

Keystore credentials are managed securely through:
- **Keystore path**: Referenced via `BAYAAN_UPLOAD_STORE_FILE` in `~/.gradle/gradle.properties`
- **Keystore password**: Set as `BAYAAN_UPLOAD_STORE_PASSWORD` in `~/.gradle/gradle.properties`
- **Key alias**: Set as `BAYAAN_UPLOAD_KEY_ALIAS` in `~/.gradle/gradle.properties` (defaults to 'upload')
- **Key password**: Set as `BAYAAN_UPLOAD_KEY_PASSWORD` in `~/.gradle/gradle.properties`

For detailed information on keystore management, refer to:
```
~/Documents/app-credentials/bayaan/keystore/keystore-info.txt
```

## iOS Deployment

### iOS Team Configuration

Bayaan uses an Expo Config Plugin (`withIOSTeam.js` in the project root) to automatically maintain the iOS Team ID configuration. This plugin:

- Ensures the correct Apple Developer Team ID ('S4W5Q2L53W') is set in the Xcode project
- Maintains this configuration even when native projects are regenerated with `expo prebuild`
- Eliminates manual steps to reconfigure team settings in Xcode

### Build iOS IPA

1. First, generate a fresh native build with Expo:
   ```bash
   npx expo prebuild --platform ios --clean
   ```

2. Open the project in Xcode:
   ```bash
   cd ios
   open Bayaan.xcworkspace
   ```

3. Select "Generic iOS Device" as the build destination

4. **IMPORTANT**: Create a fresh build before archiving to ensure version changes are applied:
   ```bash
   # First, clean the build
   Product > Clean Build Folder (Shift+Command+K)
   
   # Then build the app
   Product > Build (Command+B)
   ```

5. Once the build succeeds, proceed to archive:
   ```bash
   Product > Archive
   ```

6. When archiving completes, the Organizer window will appear with your new archive

### Upload to App Store Connect

1. In the Organizer window, select your archive
2. Click "Distribute App"
3. Select "App Store Connect" and click "Next"
4. Choose "Upload" and follow the prompts
5. Wait for the upload to complete and processing to finish

### Terminal-Only Release (Recommended)

For the full terminal-based workflow using `xcodebuild` + `asc` (no Xcode GUI needed), see **[Terminal iOS Release Guide](terminal-ios-release.md)**.

## Post-Deployment

1. Create a release in GitHub with release notes:
   ```bash
   gh release create vX.Y.Z --notes "Release notes here"
   ```

2. Notify the team of the new release

3. Monitor app performance and user feedback

## Troubleshooting

### Android Signing Issues

If you encounter "wrong signing key" errors:
1. Verify you're using the correct keystore
2. Check that your `~/.gradle/gradle.properties` has the correct credentials
3. Ensure `app.json` and `app.config.js` both include the `withAndroidSigning.js` plugin
4. Try running `npx expo prebuild --platform android --clean` to regenerate the native project
5. If needed, request an upload key reset in Google Play Console

### iOS Provisioning Issues

1. Verify your Apple Developer Program membership is active
2. Check that provisioning profiles are up to date
3. Ensure your signing certificate hasn't expired
4. If team settings are reset despite using the plugin:
   - Check that both `app.json` and `app.config.js` include the `withIOSTeam.js` plugin
   - Verify that the Team ID in `withIOSTeam.js` matches your Apple Developer Team ID
   - Try running `npx expo prebuild --platform ios --clean` to regenerate iOS files
   - As a last resort, manually set the team in Xcode: Target > Signing & Capabilities > Team

### Version Not Updated in Build

If your version bump isn't reflected in the final build:
1. Ensure you've created a fresh build after the version bump
2. For iOS, always clean the project (Product > Clean Build Folder) before building
3. Check that any build scripts that modify version numbers have run correctly

## Deployment Checklist

- [ ] All features tested and working
- [ ] Version bumped appropriately
- [ ] Git tag created and pushed
- [ ] App built for production
- [ ] App uploaded to appropriate store
- [ ] Release notes added
- [ ] GitHub release created
- [ ] Team notified

For detailed procedures and documentation on credentials, refer to:
```
~/Documents/app-credentials/bayaan/
```

## Keystore Security

Keystore credentials are managed securely through:
- **Keystore file**: Stored at `~/Documents/app-credentials/bayaan/keystore/bayaan-upload-key.keystore`
- **Passwords**: Stored in `~/.gradle/gradle.properties` using variables:
  ```
  BAYAAN_UPLOAD_STORE_FILE=/path/to/keystore/bayaan-upload-key.keystore
  BAYAAN_UPLOAD_STORE_PASSWORD=your_keystore_password
  BAYAAN_UPLOAD_KEY_ALIAS=upload
  BAYAAN_UPLOAD_KEY_PASSWORD=your_key_password
  ```

This keeps sensitive credentials outside the project repository while maintaining convenience for development.

### Benefits of This Approach

1. **Security**: Passwords are never stored in the project repository
2. **Convenience**: No need to enter passwords each time you build
3. **Organized**: Keystore information is well-documented
4. **Flexibility**: Environment variables can override gradle.properties if needed
5. **Resilience**: Expo config plugin maintains signing configuration even if native files are regenerated

### For CI/CD Integration

For CI/CD integration, set environment variables in your build system:
```
BAYAAN_UPLOAD_STORE_FILE
BAYAAN_UPLOAD_STORE_PASSWORD
BAYAAN_UPLOAD_KEY_ALIAS
BAYAAN_UPLOAD_KEY_PASSWORD
``` 
