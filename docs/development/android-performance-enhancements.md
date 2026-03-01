# Android Performance Enhancements

**Last Updated:** February 2026
**Source:** 15-agent deep investigation covering navigation, scrolling, sheets, playback, build config, Zustand subscriptions, barrel exports, animation config, and image loading.
**Prior Art:** See also `docs/android-performance-audit.md` (6-agent audit covering data loading, startup, and sheet gestures).

---

## Overview

Android performance lags behind iOS across 4 areas: **navigation transitions**, **list scrolling**, **sheet open/close**, and **audio playback**. The root causes are compounding — no single fix resolves everything, but the issues are well-understood and actionable.

---

## Phase 1: Quick Wins (Low effort, immediate impact)

### 1.1 Enable R8 in release builds

**Files:** `android/gradle.properties`

R8 (dead code elimination, method inlining, obfuscation) is currently **disabled** for release builds. Typical savings: 20-33% APK size + faster startup.

```properties
# Add these lines:
android.enableMinifyInReleaseBuilds=true
android.enableShrinkResourcesInReleaseBuilds=true
```

After enabling, test thoroughly — may need additional keep rules in `android/app/proguard-rules.pro`. Also consider switching `proguard-android.txt` to `proguard-android-optimize.txt` in `build.gradle:135`.

### 1.2 Guard console.log in hot paths

**Files:** `utils/audioUtils.ts:214,224,232`, `services/dataService.ts:168,172`, `services/downloadService.ts:81,89,116,145,174`

`generateSmartAudioUrl()` logs unconditionally for every track — called 114x when loading a reciter. Each `console.log` marshals data across the JS-Native bridge on Android.

```typescript
// Wrap all hot-path logs:
if (__DEV__) console.log(...)
```

### 1.3 Fix StyleSheet.create inside render bodies

**Files (CRITICAL — in list items):**
- `components/SurahItem.tsx:51` — `const styles = createStyles(theme)`
- `components/cards/ReciterItem.tsx:32`
- `components/cards/ReciterCard.tsx:20`
- `components/cards/TrackCard.tsx:126`
- `components/cards/CircularReciterCard.tsx:87`

**Files (MEDIUM — in sheets):**
- `SurahOptionsSheet`, `PlayerOptionsSheet`, `AmbientSoundsSheet`, `SelectReciterSheet`, `PlaybackSpeedSheet`, `MushafRepeatOptionsSheet`, `MushafLayoutSheet`, `AdhkarBentoCard`

Fix pattern:
```typescript
// Before (new object every render):
const styles = createStyles(theme);

// After:
const styles = useMemo(() => createStyles(theme), [theme]);
```

### 1.4 Add FlatList optimization props to ~20 bare lists

The following FlatLists have **zero** optimization props set:

| File | Component |
|------|-----------|
| `collection/loved.tsx:724` | Loved |
| `collection/downloads.tsx:604` | Downloads |
| `collection/bookmarks.tsx:235` | Bookmarks |
| `collection/notes.tsx:257` | Notes |
| `collection/uploads.tsx:523` | Uploads |
| `collection/playlists.tsx:348` | Playlists |
| `collection/favorite-reciters.tsx:380` | FavoriteReciters |
| `ReciterBrowse.tsx:213` | ReciterBrowse |
| `CategoryScreen.tsx:119` | CategoryScreen |
| `PlaylistDetail.tsx:407` | PlaylistDetail |
| `ReciterDownloadsList.tsx:427` | ReciterDownloadsList |
| `SystemPlaylistDetail.tsx:640` | SystemPlaylistDetail |
| `SearchView.tsx:536` | SearchView (results) |
| `CollectionSearchModal.tsx:724` | CollectionSearchModal |
| `MushafSearchView.tsx:880` | MushafSearchView (results) |
| `UploadsTabContent.tsx:429,453` | UploadsTabContent |
| `settings/default-reciter.tsx:125` | DefaultReciterSetting |
| `CollectionView.tsx:97` | CollectionView |

Add to each:
```tsx
removeClippedSubviews={true}
maxToRenderPerBatch={10}
windowSize={5}
initialNumToRender={10}
```

### 1.5 Add estimatedItemSize to all FlashLists

5 FlashLists are missing the required `estimatedItemSize` prop, causing measurement-based layout jank:

| File | Component |
|------|-----------|
| `SurahsView.tsx` | Surah list |
| `QueueList.tsx` | Queue |
| `QuranView/index.tsx` | Verse list |
| `MushafSearchView.tsx` (browse) | Browse results |
| `SurahList/index.tsx` | Reciter profile surah list |

### 1.6 Add freezeOnBlur to adhkar stacks

**Files:** `app/(tabs)/(a.home)/adhkar/_layout.tsx`, `adhkar/[superId]/_layout.tsx`, `adhkar/saved/_layout.tsx`

```tsx
<Stack screenOptions={{ freezeOnBlur: true }}>
```

---

## Phase 2: Zustand Subscription Fixes (Medium effort, high impact)

### 2.1 SurahItem/SurahCard: 3 subscriptions -> 1 per list item

**Files:** `components/SurahItem.tsx:83-85`, `components/cards/SurahCard.tsx:94-96`, `TrackCard.tsx:44-46`, `UploadCard.tsx:51-53`, `UploadsTabContent.tsx:99-101`, `uploads.tsx:91-93`

Current pattern (3 subscriptions x 114 items = 342 evaluations per queue update):
```typescript
const playbackStatus = usePlayerStore(state => state.playback.state);
const currentIndex = usePlayerStore(state => state.queue.currentIndex);
const tracks = usePlayerStore(state => state.queue.tracks); // FULL ARRAY
```

Fix — single derived boolean:
```typescript
const isCurrentAndPlaying = usePlayerStore(s => {
  const t = s.queue.tracks[s.queue.currentIndex];
  return t?.surahId === surahId && t?.reciterId === reciterId && s.playback.state === 'playing';
});
```

### 2.2 Controls.tsx: remove position subscription

**File:** `components/player/v2/PlayerContent/PlaybackControls/Controls.tsx:22`

Position is only used in seek handlers — read imperatively instead:
```typescript
// Before:
const playbackPosition = usePlayerStore(s => s.playback.position);

// After (inside handler):
const pos = usePlayerStore.getState().playback.position;
```

### 2.3 Header/TrackInfo/PlayerSheet: replace queue object subscription

**Files:** `Header.tsx:35`, `TrackInfo.tsx:23`, `PlayerSheet.tsx:27`, `PlayerContent/index.tsx:66`

```typescript
// Before:
const queue = usePlayerStore(s => s.queue);

// After:
const currentTrack = usePlayerStore(s => s.queue.tracks[s.queue.currentIndex] ?? null);
const currentIndex = usePlayerStore(s => s.queue.currentIndex);
```

### 2.4 ControlButtons: replace settings object subscription

**File:** `components/player/v2/PlayerContent/ControlButtons/index.tsx:71`

```typescript
// Before:
const settings = usePlayerStore(s => s.settings);

// After:
const repeatMode = usePlayerStore(s => s.settings.repeatMode);
const sleepTimerActive = usePlayerStore(s => !!s.settings.sleepTimerEnd);
```

### 2.5 progressStore: split playback selector

**File:** `services/player/store/progressStore.ts:53`

```typescript
// Before:
const playback = usePlayerStore(state => state.playback);

// After:
const position = usePlayerStore(state => state.playback.position);
const duration = usePlayerStore(state => state.playback.duration);
```

### 2.6 QueueList UploadQueueItem: merge 2 subscriptions

**File:** `components/player/v2/PlayerContent/QueueList.tsx:28-29`

Combine into single derived selector with `shallow`.

### 2.7 downloadStore: use Set instead of array for O(1) lookups

**File:** `services/player/store/downloadStore.ts:349-363`

`isDownloading` uses `downloading.includes(id)` which is O(n). Called per-row in 114-item lists = O(n^2). Change `downloading` from `string[]` to `Set<string>`.

---

## Phase 3: Audio Pipeline (Medium effort, high impact)

### 3.1 Move ExpoAudioProvider out of navigation wrapper

**File:** `app/_layout.tsx:381`

`ExpoAudioProvider` contains `useAudioPlayerStatus(player)` which fires on every audio tick. It currently wraps the entire navigation tree, cascading re-renders through all context consumers.

Move audio status polling to a leaf component that doesn't wrap navigation, or isolate the status subscription so it doesn't propagate through the provider tree.

### 3.2 Replace busy-poll with event-driven load detection

**File:** `services/audio/ExpoAudioService.ts:160-173`

`waitForLoaded()` polls `isLoaded` every 50ms (up to 5s). Replace with subscribing to player status events.

### 3.3 Reduce ambient audio status interval

**File:** `services/audio/AmbientAudioService.ts:37`

Two players each emit at 50ms = 40 events/sec on JS thread. Use 500ms normally, only 50ms during active crossfade.

### 3.4 Remove trackLoading on play/pause

**File:** `services/player/store/playerStore.ts:148,173`

`play()` and `pause()` set `trackLoading: true` unnecessarily, triggering re-renders. Only set during actual track loads.

### 3.5 Store IDs not full objects in recentlyPlayedStore

**File:** `services/player/store/recentlyPlayedStore.ts:208-215`

On every pause, `JSON.stringify` serializes full Reciter objects (with rewayat arrays) to AsyncStorage. Store only reciter/surah IDs and resolve on read.

### 3.6 Add pre-buffering for next track

**File:** `services/player/store/playerStore.ts:82-112`

Track switching is fully serial: load -> poll -> play. Start loading the next track URL ~30s before the current one ends.

### 3.7 Configure Android audio focus

**File:** `services/audio/ExpoAudioService.ts:60-64`

`interruptionMode: 'doNotMix'` is an iOS concept. Android audio focus (AUDIOFOCUS_GAIN, etc.) should be explicitly configured for proper interaction with phone calls, other media apps, etc.

---

## Phase 4: Navigation & Sheets (Medium effort, medium impact)

### 4.1 Use native animation for root Stack

**File:** `app/_layout.tsx:393`

`animation: 'fade'` runs on the JS thread. Use `animation: 'default'` or `'slide_from_right'` for hardware-accelerated native transitions on Android.

### 4.2 Defer data fetches with InteractionManager

**Files:**
- `app/(tabs)/(a.home)/adhkar/[superId]/index.tsx:68-87` — SQLite query on mount
- `app/(tabs)/(a.home)/adhkar/[superId]/[dhikrId].tsx:94` — SQLite query on mount
- `app/(tabs)/(a.home)/adhkar/saved/index.tsx:38` — fan-out SQLite reads
- `app/(tabs)/(c.collection)/collection/loved.tsx:153-184` — Promise.all enrichment
- `app/(tabs)/(c.collection)/collection/downloads.tsx:226-249` — Promise.all enrichment
- `app/(tabs)/(c.collection)/index.tsx:52-63` — SQLite on every focus

Wrap in `InteractionManager.runAfterInteractions()` so queries don't compete with navigation animation.

### 4.3 Wrap renderItem functions in useCallback

**Files:**
- `PlaylistDetail.tsx:376`
- `ReciterDownloadsList.tsx:391`
- `loved.tsx:616`
- `bookmarks.tsx:126`
- `notes.tsx:146`
- `downloads.tsx:548`
- `ReciterBrowse.tsx:215` (also inline anonymous)
- `mushaf/main.tsx:388` (inline anonymous)
- `FollowAlongSheet.tsx:46` (inline anonymous)

Also: avoid inline `() => handler(item)` closures in renderItem — these defeat React.memo on child components.

### 4.4 Virtualize heavy sheet content

- `MushafPlayerOptionsSheet`: 114 surah rows + 286 ayah chips rendered in plain Views -> use FlatList
- `SimilarVersesSheet`: All Skia verse renders in ScrollView -> use FlatList
- `FollowAlongSheet`: Uses plain RN FlatList instead of actions-sheet's FlatList (scroll conflicts)

### 4.5 Mushaf SkiaPage: lift font loading

**File:** `components/mushaf/skia/SkiaPage.tsx:76-80`

`useFonts()` is called on every SkiaPage mount (up to 7 pages with windowSize). Load fonts once at the mushaf screen level and pass via context/props.

---

## Phase 5: Deep Optimizations (Higher effort, long-term quality)

### 5.1 Migrate large JSON to SQLite
See `docs/android-performance-audit.md` Phase 1. The `data/` directory has 28MB of JSON files parsed on the JS thread. SQLite reads are paginated and lazy.

### 5.2 Lazy-register action sheets
Currently 17+ sheets are eagerly imported in `components/sheets/sheets.tsx` at startup. Use dynamic `import()` to register on first use.

### 5.3 Investigate React Compiler compatibility
Currently disabled ("causes performance issues with Zustand subscriptions"). Research if fixed in newer versions.

### 5.4 Pre-build Fuse.js search index
`SearchView.tsx` builds indices on mount. Generate at build time instead.

### 5.5 ReciterProfile scroll animations
`StickyHeader` and `NavigationButtons` use old `Animated` API. Migrate to Reanimated `useAnimatedScrollHandler` for smoother scroll-linked animations on Android.

---

## What's Already Correct (No changes needed)

- Hermes: enabled (`hermesEnabled=true`)
- New Architecture: enabled (`newArchEnabled=true`)
- Bundle compression: disabled (correct for Hermes mmap)
- `inlineRequires: true` in Metro config
- `GestureHandlerRootView` wraps entire app
- Reanimated v4 + babel plugin correctly configured (last in plugins)
- `freezeOnBlur: true` on main tab/stack layouts
- `lazy: true` on tab navigator
- `largeHeap: true` via config plugin
- All `useNativeDriver` usages are `true`
- Download selectors use `shallow` properly
- `ReciterImage` well-optimized (expo-image, recyclingKey, memo)
- `RecitersView` FlatLists have full optimization props
- `TrackItem.tsx` uses proper derived selector pattern
- Barrel exports are minimal (only 1 active barrel import)
- `animateOnMount={false}` on PlayerSheet

---

## Priority Matrix

| Phase | Impact | Effort | Items |
|-------|--------|--------|-------|
| **Phase 1: Quick wins** | High | Low | R8, console.log guards, StyleSheet, FlatList props, FlashList estimatedItemSize, freezeOnBlur |
| **Phase 2: Zustand fixes** | High | Medium | List item subscriptions, Controls position, queue/settings object subs, Set for downloads |
| **Phase 3: Audio pipeline** | High | Medium | ExpoAudioProvider placement, busy-poll, ambient interval, trackLoading, recentlyPlayed, pre-buffering |
| **Phase 4: Nav & sheets** | Medium | Medium | Native animation, InteractionManager, useCallback renderItem, virtualize sheets, SkiaPage fonts |
| **Phase 5: Deep** | Medium | High | SQLite migration, lazy sheets, React Compiler, Fuse.js pre-build, Reanimated migration |

**Recommended order:** Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5
