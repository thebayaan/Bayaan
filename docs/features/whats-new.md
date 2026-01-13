# What's New Feature

## Overview

The What's New feature automatically shows users a changelog modal when they update the app to a new version. It's also accessible from the Settings menu for users who want to review what's new at any time.

## Architecture

### Components

1. **ChangelogContent** (`components/changelog/ChangelogContent.tsx`)
   - Reusable component that renders changelog data
   - Displays version, release date, highlights, and categorized changes
   - Theme-aware styling

2. **WhatsNewModal** (`components/modals/WhatsNewModal.tsx`)
   - Bottom sheet modal that auto-shows on version change
   - Uses the BaseModal pattern
   - Automatically marks version as seen when dismissed

3. **WhatsNew Screen** (`app/(tabs)/(a.home)/settings/whats-new.tsx`)
   - Full-screen view accessible from Settings
   - Shows the latest changelog
   - Can be extended to show version history

### Data & Utilities

1. **Changelog Data** (`data/changelog.json`)
   - Array of changelog entries
   - Most recent version should be first in the array
   - Supports categorized changes with icons

2. **Version Utilities** (`utils/versionUtils.ts`)
   - `getCurrentVersion()`: Get current app version
   - `getLastSeenVersion()`: Get last seen version from storage
   - `hasVersionChanged()`: Check if version has changed
   - `markVersionAsSeen()`: Mark current version as seen
   - `resetVersionTracking()`: Reset for testing purposes

3. **Types** (`types/changelog.ts`)
   - TypeScript interfaces for changelog data structure

## User Flow

### Auto-Show on Update

1. User updates the app to a new version
2. On app launch, `WhatsNewModal` checks if version has changed
3. If version changed, modal appears after 500ms delay
4. User reviews the changes
5. User taps "Continue" or swipes down to dismiss
6. Version is marked as seen
7. Modal won't appear again until next version update

### Manual Access from Settings

1. User opens Settings
2. User taps "What's New" in the "About Bayaan" section
3. Full-screen changelog page opens
4. User can review all changes at their own pace
5. User taps back button to return to Settings

## Testing

### Using the Dev Menu

The app includes a floating developer menu (visible only in __DEV__ mode) for easy testing:

1. **Look for the 🛠️ button** in the bottom-right corner of the app
2. **Tap the button** to open the dev menu
3. **Select "🔄 Test What's New Modal"**
4. **Restart the app** (full restart, not hot reload)
5. **Expected behavior**:
   - Modal should appear ~500ms after app loads
   - Modal should display current version's changelog
   - Tapping "Continue" or swiping down should close the modal
   - Modal should not appear again on subsequent launches

The dev menu also includes:
- **📊 Log Version State**: Shows current and last seen version in console
- Easily extendable for future debugging tools

### Manual Testing (Alternative)

If you prefer programmatic testing:

1. **Reset version tracking**:
   ```typescript
   import { resetVersionTracking } from '@/utils/versionUtils';
   await resetVersionTracking();
   ```
   - Or manually clear AsyncStorage key: `@bayaan_last_seen_version`

2. **Restart the app** (full restart, not hot reload)

### Test Manual Access

1. Open the app
2. Navigate to Settings
3. Scroll to "About Bayaan" section
4. Tap "What's New" (has gift icon)
5. **Expected behavior**:
   - Full-screen changelog page opens
   - Current version is displayed
   - All categories and changes are visible
   - Back button returns to Settings

### Test Version Change Detection

1. **Simulate version change**:
   - In `app.json`, change version to "1.0.4"
   - In `package.json`, change version to "1.2.3" (or match app.json)
   
2. **Rebuild the app**:
   ```bash
   npm run ios
   # or
   npm run android
   ```

3. **Expected behavior**:
   - On first launch, modal should appear
   - Modal shows the changelog
   - After dismissing, it shouldn't appear again

## Updating the Changelog

When releasing a new version:

1. **Open** `data/changelog.json`

2. **Add new entry at the beginning** of the array:
   ```json
   {
     "version": "1.0.4",
     "releaseDate": "2026-01-20",
     "highlights": [
       "Key feature 1",
       "Key feature 2"
     ],
     "categories": [
       {
         "title": "New Features",
         "icon": "star",
         "items": [
           {
             "title": "Feature Name",
             "description": "Description of the feature"
           }
         ]
       }
     ]
   }
   ```

3. **Update version numbers**:
   - Update `version` in `app.json`
   - Update `version` in `package.json`
   - These should match the changelog version

4. **Test the changes** following the testing instructions above

## Design Philosophy

The What's New modal follows these principles:
- **Concise**: Only 3-4 key points that matter to users
- **User-focused**: Benefits and outcomes, not technical details
- **Beautiful**: Clean, centered floating modal with smooth animations
- **Quick**: Easy to dismiss, non-intrusive

## Customization

### Change Modal Size

In `WhatsNewModal.tsx`, adjust the `snapPoints` prop:
```typescript
snapPoints={['85%']} // Current: 85% of screen height
```

### Change Auto-Show Delay

In `WhatsNewModal.tsx`, adjust the timeout:
```typescript
setTimeout(() => {
  bottomSheetRef.current?.snapToIndex(0);
}, 500); // Current: 500ms delay
```

### Show Version History

In `whats-new.tsx`, you can extend the screen to show previous versions by iterating through `changelogData` array instead of just showing `changelogData[0]`.

## Future Enhancements

- Show version history (expandable sections for past versions)
- Share changelog on social media
- Search within changelog
- Filter by category
- Mark favorite changes
- Feedback button for specific changes

