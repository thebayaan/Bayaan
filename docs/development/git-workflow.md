# Git Workflow Guidelines for Bayaan

This document outlines the Git branching strategy and workflow practices for the Bayaan project. Following these guidelines will help maintain code quality, streamline collaboration, and ensure smooth deployment processes.

## Table of Contents

1. [Branching Strategy Overview](#branching-strategy-overview)
2. [Branch Types](#branch-types)
3. [Naming Conventions](#naming-conventions)
4. [Common Workflows](#common-workflows)
5. [Commit Message Guidelines](#commit-message-guidelines)
6. [Code Review Process](#code-review-process)
7. [Handling Merge Conflicts](#handling-merge-conflicts)
8. [Tagging and Releases](#tagging-and-releases)

## Branching Strategy Overview

Bayaan follows a modified Git Flow branching strategy, designed to support continuous development and regular releases. This approach maintains a clean production environment while allowing parallel feature development.

![Git Flow Diagram](https://nvie.com/img/git-model@2x.png)

## Branch Types

### Long-lived Branches

These branches exist throughout the project's lifetime:

#### `main`
- Contains production-ready code
- Always deployable
- Tagged for releases
- Usually updated by maintainers during release work

#### `develop`
- Integration branch for features
- Contains the latest delivered development changes
- Source for feature branches
- Merged into `main` during releases

### Short-lived Branches

These branches have a limited lifespan:

#### Feature Branches
- Created from: `develop`
- Merge back into: `develop`
- Naming: `feature/feature-name`
- Purpose: New features and non-urgent enhancements
- External/open-source contributors should normally open a PR instead of pushing directly to `main`

#### Hotfix Branches
- Created from: `main`
- Merge back into: `main` AND `develop`
- Naming: `hotfix/issue-description`
- Purpose: Urgent production fixes

#### Release Branches
- Created from: `develop`
- Merge back into: `main` AND `develop`
- Naming: `release/version-number`
- Purpose: Preparing for a new production release

## Naming Conventions

### Branch Names

Follow these patterns for consistency:

- **Feature branches**: `feature/descriptive-feature-name`
  - Example: `feature/audio-player-enhancement`

- **Hotfix branches**: `hotfix/brief-issue-description`
  - Example: `hotfix/android-footnote-spacing`

- **Release branches**: `release/version-number`
  - Example: `release/1.2.0`

Use kebab-case (lowercase with hyphens) for descriptive parts of branch names.

## Common Workflows

### Starting a New Feature

```bash
# Ensure you have the latest develop branch
git checkout develop
git pull origin develop

# Create a new feature branch
git checkout -b feature/your-feature-name

# Make changes, commit, and push
git add .
git commit -m "Description of changes"
git push -u origin feature/your-feature-name
```

### Creating a Hotfix

```bash
# Start from main
git checkout main
git pull origin main

# Create hotfix branch
git checkout -b hotfix/issue-description

# Make changes, commit, and push
git add .
git commit -m "Fix critical issue X"
git push -u origin hotfix/issue-description
```

### Completing a Feature

```bash
# Ensure your feature branch is up to date
git checkout feature/your-feature-name
git pull origin feature/your-feature-name

# Rebase on latest develop (preferred over merge)
git checkout develop
git pull origin develop
git checkout feature/your-feature-name
git rebase develop

# Fix any conflicts during rebase
# Then merge to develop with --no-ff to preserve history
git checkout develop
git merge feature/your-feature-name --no-ff -m "Merge feature/your-feature-name into develop"
git push origin develop
```

### Applying a Hotfix

```bash
# After completing and testing the hotfix
# Merge to main
git checkout main
git merge hotfix/issue-description --no-ff -m "Merge hotfix/issue-description"
git push origin main

# Also merge to develop
git checkout develop
git merge hotfix/issue-description --no-ff -m "Merge hotfix/issue-description into develop"
git push origin develop

# Tag the release on main
git checkout main
git tag -a v1.0.1 -m "Version 1.0.1 - Hotfix for issue X"
git push origin v1.0.1
```

### Preparing a Release

```bash
# Create release branch from develop
git checkout develop
git pull origin develop
git checkout -b release/1.2.0

# Make any release-specific changes
# (version numbers, documentation, etc.)
git add .
git commit -m "Prepare version 1.2.0 for release"
git push -u origin release/1.2.0

# After testing, merge to main
git checkout main
git pull origin main
git merge release/1.2.0 --no-ff -m "Merge release 1.2.0"
git tag -a v1.2.0 -m "Version 1.2.0"
git push origin main
git push origin v1.2.0

# Also merge back to develop
git checkout develop
git pull origin develop
git merge release/1.2.0 --no-ff -m "Merge release 1.2.0 back to develop"
git push origin develop
```

## Commit Message Guidelines

Good commit messages help with code maintenance and debugging. Follow these guidelines:

1. **Use the imperative mood**
   - "Add feature" not "Added feature" or "Adds feature"

2. **First line is a summary (50 chars max)**
   - Concise description of the change

3. **Separate summary from body with a blank line**
   - Not all commits need a body

4. **Body explains what and why, not how**
   - The code shows how; explain why the change was needed

Example:
```
Fix Android footnote spacing on translation text

- Implemented responsive line height calculation
- Added platform-specific styles for Android
- Fixed vertical alignment of superscript elements

Resolves issue #123
```

## Code Review Process

All changes should go through code review before merging:

1. Create a Pull Request (PR) from your branch to the target branch
2. Request reviews from appropriate team members
3. Address all comments and ensure CI tests pass
4. Use "Squash and merge" for feature branches to keep history clean
5. Use "Create a merge commit" for hotfix and release branches to preserve history

## Handling Merge Conflicts

Merge conflicts are inevitable but can be minimized and handled effectively:

1. **Pull regularly** from the parent branch to reduce conflict buildup
2. **Rebase feature branches** on develop before creating a PR
3. When conflicts occur:
   - Understand both changes before resolving
   - Consult with the author of the conflicting code if needed
   - Use visual tools (VS Code, GitHub Desktop, etc.) for complex conflicts
4. After resolving conflicts, thoroughly test the affected functionality

```bash
# Rebasing approach for handling conflicts
git checkout develop
git pull origin develop
git checkout feature/your-feature
git rebase develop

# If conflicts occur, fix them in each file
# Then continue the rebase
git add .
git rebase --continue

# Force push is needed after rebasing a branch that was already pushed
git push --force-with-lease origin feature/your-feature
```

## Tagging and Releases

Semantic versioning (MAJOR.MINOR.PATCH) should be used for release tags:

- **MAJOR**: Incompatible API changes
- **MINOR**: Backwards-compatible functionality
- **PATCH**: Backwards-compatible bug fixes

```bash
# Creating an annotated tag
git tag -a v1.2.3 -m "Version 1.2.3 - Brief description"

# Pushing tags to remote
git push origin v1.2.3
```

## Bayaan-Specific Implementation

Based on our project structure, we've implemented the following:

### Current Branch Structure

- **`main`**: Production-ready code
- **`develop`**: Integration branch for features
- **Feature branches**:
  - `feature/offline-downloads`: Offline content functionality
  - `ui-performance-fixes`: UI performance improvements
- **Hotfix branches**:
  - `hotfix/android-release-config`: Android signing configuration
  - `hotfix/android-footnote-spacing`: Text spacing fixes for Android

### Implemented Workflows

We've successfully implemented:

1. **Hotfix workflow** for Android release configuration:
   - Created `hotfix/android-release-config` from `main`
   - Committed changes to improve the signing configuration
   - Merged to both `main` and `develop`

2. **Feature workflow** for UI performance:
   - Created `ui-performance-fixes` branch
   - Implemented performance improvements for ReciterProfile and fixed Android footnote spacing
   - Merged to `develop` for integration and future release

### Best Practices We're Following

- **Non-fast-forward merges** (`--no-ff`) to preserve feature history
- **Descriptive commit messages** explaining the what and why
- **Branch naming convention** that clearly indicates purpose
- **Proper merging strategy** for hotfixes (to both `main` and `develop`)

## Conclusion

This Git workflow is designed to maintain the stability of the Bayaan app while supporting efficient development. By following these guidelines, we can minimize conflicts, maintain a clean history, and ensure smooth releases.

The strategy should evolve with the project's needs, but the core principles of protecting the production environment and maintaining parallel development tracks should remain. 
