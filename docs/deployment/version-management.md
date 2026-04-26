# Bayaan Version Management

This document explains how the Git-based version management system works in the Bayaan app.

## Overview

Bayaan uses Git metadata (tags and commit history) to automatically manage app version numbers. This ensures that:

1. Version numbers are directly tied to Git history
2. Versions increase automatically with each build
3. No manual version number management is needed
4. Information about the build is preserved (branch, commit hash, etc.)

## How It Works

### Version Generation

The system extracts version information from:

1. **Semantic Version (1.2.3)**: Derived from Git tags following the pattern `v1.2.3` or `1.2.3`
2. **Build Number**: Based on total commit count in the repository
3. **Git Metadata**: Branch name, commit hash, and build time

This information is generated at build time and made available both:
- In the app configuration (`app.config.js`)
- At runtime through Expo Constants

### Directory Structure

```
scripts/
  ├── generate-version.js   # Extracts version info from Git
  └── version-bump.js       # Helper to create version tags
utils/
  └── appVersion.ts         # TypeScript interface for runtime access
```

## Usage

### Viewing Current Version

```bash
npm run version:current
```

This shows all version information extracted from Git:

```json
{
  "semanticVersion": "1.0.3",
  "buildNumber": "45",
  "versionCode": 45,
  "gitBranch": "main",
  "gitHash": "0dbcd9d",
  "buildTime": "2023-06-15",
  "fullVersion": "1.0.3 (45)",
  "major": 1,
  "minor": 0,
  "patch": 3
}
```

### Creating a New Version

To create a new version, use one of these commands based on semantic versioning:

```bash
# Sync remote tags first when collaborating with others
git fetch origin --tags

# Increment patch version (1.0.3 -> 1.0.4)
npm run version:patch

# Increment minor version (1.0.3 -> 1.1.0)
npm run version:minor

# Increment major version (1.0.3 -> 2.0.0)
npm run version:major
```

These commands:
1. Create a Git tag for the new version
2. Update package.json with the new version

After running one of these commands, you need to:
1. Commit the package.json change
2. Push the new tag to remote

```bash
git commit -am "Bump version to X.Y.Z"
git push origin vX.Y.Z
```

## Step-by-Step Version Bump Workflow

Follow this process each time you need to create a new version:

### Step 1: Ensure Your Working Directory is Clean

Before bumping the version, make sure all your changes are committed:

```bash
git status
```

If there are uncommitted changes, commit them or stash them:

```bash
git add .
git commit -m "Your commit message"
```

### Step 2: Run the Version Bump Command

Choose the appropriate command based on the type of version change:

```bash
# For small bug fixes or minor changes (1.0.3 → 1.0.4)
npm run version:patch

# For new features that don't break compatibility (1.0.3 → 1.1.0)
npm run version:minor

# For major changes that might break compatibility (1.0.3 → 2.0.0)
npm run version:major
```

This command will:
1. Calculate the new version based on the current version
2. Update your `package.json` with the new version number
3. Create a Git tag (e.g., `v1.0.4`) for the new version

### Step 3: Commit the Package.json Change

After running the version bump command, you'll need to commit the change to package.json:

```bash
git commit -am "Bump version to X.Y.Z"
```

Replace X.Y.Z with your actual new version number.

### Step 4: Push Changes and Tags

Push both your commit and the new tag to the remote repository:

```bash
# Push the commit
git push

# Push the tag
git push origin vX.Y.Z
```

Replace X.Y.Z with your actual version number (e.g., `git push origin v1.0.4`).

### Step 5: Verify the Version

To verify that the version was updated correctly, run:

```bash
npm run version:current
```

This will show you the current version information extracted from Git.

### Example Workflow

Here's an example of the complete workflow for a patch version bump:

```bash
# 1. Check status
git status

# 2. Make sure all changes are committed
git add .
git commit -m "Fixed bug in player sheet toggling"

# 3. Bump the version
npm run version:patch
# Output will show something like:
# ✅ Updated package.json version to 1.0.4
# ✅ Created Git tag: v1.0.4

# 4. Commit package.json changes
git commit -am "Bump version to 1.0.4"

# 5. Push changes and tag
git push
git push origin v1.0.4

# 6. Verify new version
npm run version:current
```

### When To Run Version Bumps

You should create a new version when:

1. **Releasing to App Stores**: Before submitting a new build to the App Store or Google Play
2. **Major Features**: When completing significant features
3. **Bug Fix Releases**: When releasing a set of bug fixes
4. **API Changes**: When changing the interface that other systems might depend on

### Version Type Guidelines

- **Patch (1.0.3 → 1.0.4)**: Bug fixes, small tweaks, documentation updates
- **Minor (1.0.3 → 1.1.0)**: New features, non-breaking changes, improvements
- **Major (1.0.3 → 2.0.0)**: Breaking changes, significant redesigns, major feature overhauls

### Important Notes

1. **Build Numbers**: The build number is automatically derived from your total commit count and will increase with each new commit.

2. **CI/CD Integration**: If you're using CI/CD pipelines, the version information will be automatically extracted during the build process.

3. **Multiple Developers**: If multiple people are working on the project, make sure to pull the latest tags before creating a new version:
   ```bash
   git fetch --tags
   ```

4. **App Store Submissions**: For iOS submissions, Apple requires that build numbers increase with each submission. This system ensures that happens automatically through the commit count.

### Accessing Version in Code

In TypeScript code, import from the appVersion utility:

```typescript
import { APP_VERSION, getVersionString, getFullVersionString } from '@/utils/appVersion';

// Use in components
const MyComponent = () => (
  <View>
    <Text>Version: {getVersionString()}</Text>
    <Text>Full: {getFullVersionString()}</Text>
    <Text>Build: {APP_VERSION.buildNumber}</Text>
    {APP_VERSION.gitHash && (
      <Text>Commit: {APP_VERSION.gitHash}</Text>
    )}
  </View>
);
```

## Build Process

During the build process:

1. `scripts/generate-version.js` extracts version information from Git
2. `app.config.js` imports this information and uses it for app configuration
3. The version information is included in the app bundle via Expo Constants
4. `utils/appVersion.ts` provides a TypeScript interface to access this information at runtime

## Edge Cases

The system handles several edge cases:

1. **No Git Tags**: Falls back to version in package.json
2. **No Git Access**: Uses default version values (1.0.0)
3. **CI/CD Environments**: Can override version values via environment variables

## Benefits

- **Single Source of Truth**: Git history is the definitive source for versioning
- **No Manual Updates**: Version numbers increase automatically
- **CI/CD Friendly**: Works well in automated build pipelines
- **Transparent**: Version numbers are directly visible in Git history
- **Consistent**: Ensures that build numbers always increase

## Notes for CI/CD Integration

If running in a CI environment with limited Git depth, ensure that:

1. Git tags are fetched: `git fetch --tags --depth=1000`
2. Sufficient history is fetched: `git fetch --depth=1000`

Or set environment variables to override:

```
BUILD_NUMBER=123
``` 
