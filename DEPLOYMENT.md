# Bayaan App Deployment Guide

This document outlines the complete process for deploying the Bayaan app to both Google Play Store (Android) and Apple App Store (iOS).

## Version Management

Bayaan uses a Git-based version management system described in detail in [VERSION-MANAGEMENT.md](docs/VERSION-MANAGEMENT.md).

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

### Build Android App Bundle

1. Navigate to the android directory:
   ```bash
   cd android
   ```

2. Build the release bundle:
   ```bash
   ./gradlew bundleRelease
   ```

3. The AAB will be located at:
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

For detailed information on keystore management, refer to:
```
~/Documents/app-credentials/bayaan/keystore/keystore-info.txt
```

## iOS Deployment

### Build iOS IPA

1. Open the project in Xcode:
   ```bash
   cd ios
   open Bayaan.xcworkspace
   ```

2. Select "Generic iOS Device" as the build destination

3. **IMPORTANT**: Create a fresh build before archiving to ensure version changes are applied:
   ```bash
   # First, clean the build
   Product > Clean Build Folder (Shift+Command+K)
   
   # Then build the app
   Product > Build (Command+B)
   ```

4. Once the build succeeds, proceed to archive:
   ```bash
   Product > Archive
   ```

5. When archiving completes, the Organizer window will appear with your new archive

### Upload to App Store Connect

1. In the Organizer window, select your archive
2. Click "Distribute App"
3. Select "App Store Connect" and click "Next"
4. Choose "Upload" and follow the prompts
5. Wait for the upload to complete and processing to finish

### Alternatively, Build and Upload via Command Line

```bash
cd ios
# Clean and build first
xcodebuild clean -workspace Bayaan.xcworkspace -scheme Bayaan
xcodebuild -workspace Bayaan.xcworkspace -scheme Bayaan -configuration Release

# Then run fastlane
fastlane release
```

This requires Fastlane to be set up with appropriate configuration.

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
2. Check keystore-info.txt for correct credentials
3. If needed, request an upload key reset in Google Play Console

### iOS Provisioning Issues

1. Verify your Apple Developer Program membership is active
2. Check that provisioning profiles are up to date
3. Ensure your signing certificate hasn't expired

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
  BAYAAN_UPLOAD_STORE_PASSWORD=your_keystore_password
  BAYAAN_UPLOAD_KEY_PASSWORD=your_key_password
  ```

This keeps sensitive credentials outside the project repository while maintaining convenience for development.

### Benefits of This Approach

1. **Security**: Passwords are never stored in the project repository
2. **Convenience**: No need to enter passwords each time you build
3. **Organized**: Keystore information is well-documented
4. **Flexibility**: Environment variables can override gradle.properties if needed

### For CI/CD Integration

For CI/CD integration, set environment variables in your build system:
```
BAYAAN_UPLOAD_STORE_PASSWORD
BAYAAN_UPLOAD_KEY_PASSWORD
``` 