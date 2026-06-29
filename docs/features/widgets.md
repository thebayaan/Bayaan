# Feature: Home Screen Widgets (iOS & Android)

**Status:** Planned
**Priority:** Medium
**Complexity:** High
**Created:** 2026-02-21
**GitHub Issue:** [#126](https://github.com/thebayaan/Bayaan/issues/126)
**Related:** [Shareable Deep Links (#117)](https://github.com/thebayaan/Bayaan/issues/117), [Cloud Sync (#120)](https://github.com/thebayaan/Bayaan/issues/120)

## Overview

Build native home screen widgets for iOS (WidgetKit + SwiftUI) and Android (App Widgets / Jetpack Glance) that give users quick access to Quran playback, reading progress, adhkar, and listening stats without opening the app.

## Widget Catalog

### Tier 1 — High Value, Low Complexity

#### 1. Now Playing / Continue Listening
- Shows currently playing or last played surah, reciter name, and progress
- Play/pause button directly on widget (iOS 17+ interactive widgets, Android natively)
- Tap to open app and resume playback
- Sizes: small, medium, large

#### 2. Quick Play (Surah Shortcuts)
- Grid of 4–6 surah buttons (configurable or auto-populated from most played / recents)
- One tap opens app and starts playing immediately
- Good defaults: Al-Fatiha, Ya-Sin, Al-Mulk, Al-Kahf, Ar-Rahman, Al-Waqi'ah

#### 3. Daily Verse / Ayah of the Day
- Displays a Quran verse in Arabic + translation, refreshes daily
- Tap opens the mushaf at that verse's page
- Calligraphic presentation using existing Uthmani fonts

#### 4. Last Read (Mushaf Bookmark)
- Shows last mushaf page and surah name from `mushafSessionStore.getLastReadPage()` (MMKV-backed)
- "Continue reading" — one tap opens mushaf where the user left off
- Uses `mushafSettingsStore.recentPages` for additional context

### Tier 2 — Medium Complexity

#### 5. Adhkar (Morning/Evening)
- Auto-switches between morning and evening adhkar based on time of day
- Shows current dhikr with repeat count
- Progress indicator if the user has started the sequence
- Tap opens adhkar flow in-app

#### 6. Listening Stats
- Total listening time today/this week, most played surah, streak count
- Data from `playCountStore`
- Motivational: "You've listened to 3 surahs today"

#### 7. Playlist Widget
- User picks a playlist during widget configuration
- Shows first few tracks with reciter names
- Tap any track to start playing

#### 8. Favorites / Loved Tracks
- Quick-access grid of loved recitations
- Tap to play directly

### Tier 3 — High Complexity / High Delight

#### 9. Juz Tracker / Khatma Progress
- Circular progress ring: "12/30 Juz completed"
- Based on mushaf pages read or surahs listened to
- Requires new tracking logic (does not exist yet)

#### 10. Live Tasbeeh Counter
- Interactive widget — tap to increment counter on home screen without opening app
- Shows current dhikr text, count, and target
- iOS 17+ interactive widgets support this; Android has always supported it

#### 11. Prayer Time + Suggested Adhkar
- Shows next prayer time (requires prayer time calculation or API)
- Suggests relevant adhkar for the time of day
- Larger scope — may warrant its own feature

#### 12. Random Reciter Discovery
- "Listen to someone new" — random reciter with photo and name
- Tap to browse their surahs
- Refreshes daily or on tap

## Technical Architecture

### iOS (WidgetKit + SwiftUI)

Widgets are a **separate Xcode target** written in Swift/SwiftUI, not part of the React Native bundle.

**Data sharing:**
- App Group container (`group.com.bayaan.app`) shared between RN app and widget extension
- RN app writes to `UserDefaults(suiteName: "group.com.bayaan.app")` or a shared SQLite file
- Widget reads from the same App Group on timeline refresh

**Update model:**
- Timeline-based — widget provides a `TimelineProvider` with scheduled entries
- RN app triggers timeline reload via `WidgetCenter.shared.reloadAllTimelines()` when state changes

**Interactivity (iOS 17+):**
- Buttons and toggles trigger `AppIntent` without opening the app
- Enables play/pause and tasbeeh counter directly on widget

**Sizes:** Small (2x2), Medium (4x2), Large (4x4), Lock Screen, StandBy

### Android (App Widgets / Jetpack Glance)

Widgets use `AppWidgetProvider` with `RemoteViews` or Jetpack Glance (Compose-style).

**Data sharing:**
- `SharedPreferences` or shared SQLite accessible by both RN and the widget
- RN app writes via a native module bridge

**Update model:**
- Widgets update via broadcasts or `AppWidgetManager.updateAppWidget()`
- RN app triggers updates when player state or data changes

**Interactivity:**
- Buttons work natively via `PendingIntent`
- Play/pause, counter increment, etc.

**Sizes:** Flexible grid-based (1x1 through 4x4+)

### Data Flow (Both Platforms)

```
React Native app
  ├── state changes (player, mushaf, adhkar, play counts)
  ├── writes to shared storage (App Group / SharedPreferences)
  └── triggers widget refresh

Widget (native)
  ├── reads from shared storage
  ├── renders native UI (SwiftUI / Glance)
  └── user taps → deep link (bayaan://) → opens app at correct screen
```

### Expo Integration

Since widgets are native code, integration with the Expo/RN project requires:

1. **Expo Config Plugin** to add widget extension target (iOS) and widget provider (Android) during `expo prebuild`
2. **Native module** to write data from RN → shared storage (App Group / SharedPreferences)
3. **Deep links** via existing `bayaan://` scheme bring users back into the RN app

**Community packages:**
- `@bittingz/expo-widgets` — Expo config plugin that scaffolds iOS and Android widget targets
- `expo-apple-targets` — Adds arbitrary Apple extension targets to an Expo project
- `react-native-android-widget` — Write Android widget UI in JS via Jetpack Glance
- `react-native-shared-group-preferences` — Read/write to App Group UserDefaults from RN

### Existing Data Sources

| Widget | Data Source | Already Exists? |
|--------|------------|-----------------|
| Now Playing | `playerStore` (current track, progress) | Yes |
| Quick Play | `playCountStore.getMostPlayed()`, `recentSurahStore` | Yes |
| Daily Verse | `surahData`, verse text from SQLite | Yes |
| Last Read | `mushafSessionStore.getLastReadPage()` (MMKV), `mushafSettingsStore.recentPages` | Yes |
| Adhkar | `adhkarStore`, `adhkarSettingsStore` | Yes |
| Listening Stats | `playCountStore` | Yes (counts only, no duration) |
| Playlist | `PlaylistService` (SQLite) | Yes |
| Favorites | `favoriteRecitersStore`, loved tracks | Yes |
| Juz Tracker | — | No (needs new tracking) |
| Tasbeeh Counter | `adhkarStore.dhikrCounts` | Partial |
| Prayer Times | — | No (needs calculation/API) |

## Implementation Phases

1. **Phase 1:** Shared data bridge — native module to write player/mushaf state to App Group (iOS) and SharedPreferences (Android)
2. **Phase 2:** Now Playing widget (both platforms) — exercises the full pattern
3. **Phase 3:** Last Read + Quick Play widgets — reuse the same bridge
4. **Phase 4:** Daily Verse + Adhkar widgets
5. **Phase 5:** Interactive widgets (play/pause, tasbeeh counter) — iOS 17+ and Android

## Files Likely Affected

- `app.config.js` — Config plugin for widget targets, App Group entitlement
- New: `plugins/withWidgets.js` — Expo config plugin for widget setup
- New: `ios/BayaanWidgets/` — Swift/SwiftUI widget extension
- New: `android/app/src/main/java/.../widgets/` — Kotlin widget provider
- New: `services/widget/WidgetBridge.ts` — RN → native shared storage bridge
- Existing stores (`playerStore`, `mushafSettingsStore`, `playCountStore`) — add write-to-widget-storage side effects

## Open Questions

- Which widgets to build first? (Recommended: Now Playing, then Last Read)
- Should widget UI match the app theme (dark/light)?
- Minimum iOS version for interactive widgets? (iOS 17 for AppIntent-based interactivity)
- Use `@bittingz/expo-widgets` or build custom config plugin?
- Should listening stats track duration (not just play counts) to power the stats widget?
