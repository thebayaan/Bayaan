# Android Performance Audit — Bayaan

**Date:** February 2026
**Scope:** Mounting/unmounting jank, sheet navigation lag, bundled data loading, general Android weakness
**Methodology:** 6 parallel investigation agents analyzed sheets, data loading, mount/unmount patterns, Android config, navigation architecture, and lists/images/animations

---

## Executive Summary

Android performance lags behind iOS due to a compounding set of issues, not any single root cause. The three biggest offenders are:

1. **28MB of bundled JSON parsed on the JS thread** — Hermes is slower at JSON deserialization than JSC, and the app loads massive Quran data files synchronously
2. **Eager initialization of everything** — 17 action sheets, 7+ providers, 8 useEffects in the root layout, and multiple services all compete for the JS thread at startup
3. **Missing Android-specific optimizations** — no `largeHeap`, sheet gesture handling disabled on Android (New Architecture and Hermes are already enabled in `android/gradle.properties`)

---

## Detailed Findings

### CRITICAL — Bundled Data Loading (Severity: 10/10)

The `data/` directory contains **28MB of JSON files** that are bundled into the app:

| File | Size | When Loaded |
|------|------|-------------|
| `QPC Hafs Tajweed 2.json` | **8.3MB** | App startup (setTimeout 100ms) |
| `QPC V4 2.json` | **5.2MB** | On demand (Mushaf view) |
| `quran-translation.json` | 3.2MB | On demand |
| `quran.json` | 1.8MB | On demand |
| `IndopakNastaleeq.json` | 1.6MB | On demand |
| `englishwbwtransliteration.json` | 1.5MB | On demand |
| `SaheehInternational...` | 1.2MB | On demand |
| `clear-quran-translation.json` | 1.2MB | On demand |
| `transliteration.json` | 1.1MB | On demand |
| `surahInfo.json` | 928KB | On demand |
| `reciters.json` | **492KB** | **App startup (import)** |
| `adhkar.json` | 449KB | On demand |

**The Critical Path:**

1. **`reciters.json` (492KB)** is loaded via static `import` in `data/reciterData.ts` — this is a synchronous require that blocks the JS thread during module evaluation. Every file that imports `RECITERS` triggers this parse. It's imported by **20+ files**.

2. **`QPC Hafs Tajweed 2.json` (8.3MB)** is loaded via `require()` in `utils/tajweedLoader.ts:188` inside a `setTimeout(100ms)`. While the 100ms defer helps slightly, the `require()` call itself is **synchronous and blocks the entire JS thread** while Hermes parses 8.3MB of JSON. After parsing, the app then iterates every entry, runs regex processing (`processTajweedWord`), and builds indexed lookup tables. This can freeze the UI for **1-3 seconds on mid-range Android devices**.

3. **`surahData.ts`** is an inline TypeScript array (114 entries, ~30KB) — this is fine, but it's imported everywhere.

**Why this hurts Android more than iOS:**
- Hermes JSON parsing is measurably slower than JSC for large payloads
- Android devices generally have slower I/O for reading from the app bundle
- The single-threaded JS execution model means all JSON parsing blocks UI renders

**Files:**
- `data/reciterData.ts:1` — `import recitersData from './reciters.json'`
- `utils/tajweedLoader.ts:184-224` — `preloadTajweedDataWithTimeout()`
- `app/_layout.tsx:129-135` — triggers tajweed preload on mount

---

### CRITICAL — Eager Sheet Registration (Severity: 8/10)

**`components/sheets/sheets.tsx`** eagerly imports and registers all 17 action sheets at app startup:

```
import {SurahOptionsSheet} from './SurahOptionsSheet';
import {RewayatInfoSheet} from './RewayatInfoSheet';
import {FavoriteRecitersSheet} from './FavoriteRecitersSheet';
// ... 14 more imports
```

This file is imported as a side-effect in `app/_layout.tsx:29`:
```
import '@/components/sheets/sheets';
```

**Impact:** All 17 sheet component modules and their entire dependency trees are evaluated during initial module loading. Each sheet imports its own hooks, store selectors, and component libraries. This adds significant JS evaluation time before the first frame.

Additionally, some sheets contain heavy content:
- `SelectReciterSheet` — renders the full reciter list with search (imports RECITERS)
- `FavoriteRecitersSheet` — also imports RECITERS
- `OrganizeRecitationSheet` — imports RECITERS and SURAHS
- `AddToCollectionSheet` — contains its own sheet manager calls

**Files:**
- `components/sheets/sheets.tsx:1-46` — all 17 registrations
- `app/_layout.tsx:29` — side-effect import

---

### HIGH — Root Layout Initialization Overload (Severity: 8/10)

`app/_layout.tsx` is the app's entry point and it does **too much work simultaneously**:

**8 useEffect hooks running on mount:**
1. Deferred font loading (7 Arabic/Quran fonts)
2. Tajweed data preload (triggers 8.3MB JSON parse)
3. AppInitializer (SQLite DB + 7 services)
4. `onLayoutRootView` (splash screen hiding)
5. expo-audio service initialization + store pre-warming
6. Navigation readiness check
7. SystemUI background color
8. Android navigation bar configuration (**dynamic import of `expo-navigation-bar`**)

**7-level provider nesting:**
```
ErrorBoundary
  ThemeProvider
    SafeAreaProvider
      ExpoAudioProvider
        GestureHandlerRootView
          SheetProvider
            Stack
```

**Problem:** On mount, the root layout triggers font loading, tajweed parsing, SQLite initialization, audio service setup, store hydration, AND 17 sheet module evaluations — all competing for the same JS thread. On Android, this creates a visible freeze after splash screen dismissal.

The **dynamic import of expo-navigation-bar** (`app/_layout.tsx:234`) runs on every theme change on Android, adding latency to theme switches.

**Files:**
- `app/_layout.tsx:60-375`
- `services/AppInitializer.ts:68-139`

---

### HIGH — Sheet Gesture Handling Disabled on Android (Severity: 7/10)

All three `@gorhom/bottom-sheet` usage sites disable `enableContentPanningGesture` on Android:

```typescript
enableContentPanningGesture={Platform.OS === 'ios'}
```

**Found in:**
- `components/player/v2/PlayerSheet.tsx:259`
- `components/BottomSheetModal.tsx:113`
- `components/modals/BaseModal.tsx:97`

This means on Android, content inside bottom sheets **cannot be scrolled by gestures starting on the content area** — the user can only drag the handle. This creates a noticeably worse UX on Android and makes sheet interaction feel broken/unresponsive.

This was likely added as a workaround for gesture conflicts, but it's a blanket disable rather than a proper fix.

---

### MEDIUM — Missing Android Configuration (Severity: 5/10)

`app.config.js` is missing some Android-specific optimizations:

1. **No `largeHeap: true`** — With 28MB of bundled JSON data plus runtime data structures, the app should request large heap allocation on Android. Without it, the app runs under tighter memory constraints, increasing GC pressure and potential OOM crashes.

2. ~~**New Architecture**~~ — **RESOLVED.** `newArchEnabled=true` is already set in `android/gradle.properties:38`.

3. ~~**Hermes engine**~~ — **RESOLVED.** `hermesEnabled=true` is already set in `android/gradle.properties:42`.

4. **React Compiler disabled** — There's a comment: `// React Compiler disabled - causes performance issues with Zustand subscriptions`. This means the app misses out on automatic memoization that would particularly help Android.

5. **No ProGuard/R8 optimization flags** in the Expo config.

**Files:**
- `app.config.js:87-96` — Android section

---

### MEDIUM — Fuse.js Search Initialization (Severity: 6/10)

`components/search/SearchView.tsx` creates two separate Fuse.js indices when the search tab first mounts:

1. **Reciter Fuse** — Indexes all reciters with multiple weighted keys (name, translated_name, rewayat names)
2. **Surah Fuse** — Indexes all 114 surahs with weighted keys

This initialization happens in a `useEffect` with `[]` dependency, meaning it runs every time the search screen mounts. On Android, building the Fuse index for ~200+ reciters with nested rewayat data causes a visible pause.

The search tab uses `lazy: true` in the tab config, so this only happens on first navigation to search — but when it does, it's noticeable.

**Files:**
- `components/search/SearchView.tsx:121-138` — Fuse instance creation

---

### MEDIUM — No `getItemLayout` on Lists (Severity: 6/10)

The main `SurahsView` SectionList (`components/SurahsView.tsx:397-413`) has good config:
- `initialNumToRender={25}`
- `maxToRenderPerBatch={10}`
- `windowSize={5}`
- `removeClippedSubviews={true}`

But it's **missing `getItemLayout`**, which means React Native must measure every list item asynchronously. For the 114+ items in the surah list (plus Juz headers in some modes), this causes:
- Scroll position jumps
- Blank cells during fast scrolling
- Extra layout passes on Android (which is slower at async measurement than iOS)

The card view mode creates variable-height rows, making `getItemLayout` harder, but the list view mode has consistent heights and should use it.

**Files:**
- `components/SurahsView.tsx:397-413`

---

### MEDIUM — LinearGradient in List Items (Severity: 5/10)

Juz header items in `SurahsView` render **two `LinearGradient` components** each (`components/SurahsView.tsx:178-208`). `expo-linear-gradient` uses native views, and creating/destroying these during scroll in a virtualized list adds overhead on Android, where native view creation is more expensive than iOS.

**Files:**
- `components/SurahsView.tsx:178-208` — Juz header with 2x LinearGradient

---

### MEDIUM — AppInitializer Sequential Critical Path (Severity: 5/10)

`services/AppInitializer.ts` runs critical services **sequentially** and non-critical in parallel:

**Sequential (critical):**
1. Database initialization (SQLite)
2. Playlist Service initialization

**Parallel (non-critical):**
3. Audio Configuration
4. Playlists Data loading
5. Adhkar Service
6. Adhkar Store Data
7. Uploads Service + recitations + custom reciters + orphan cleanup

The sequential portion blocks app readiness. Database init on Android is typically 200-500ms slower than iOS due to SQLite performance differences.

**Files:**
- `services/AppInitializer.ts:79-136`

---

### LOW — TouchableOpacity Still Used (Severity: 3/10)

Despite CLAUDE.md explicitly stating "Use `Pressable` instead of `TouchableOpacity`", `TouchableOpacity` is still used in several places:
- `components/SurahsView.tsx:258,292,326,362` — sort buttons and view mode toggle
- Various other components

The opacity animation on press uses the JS thread on Android, while `Pressable` can use native press handling.

---

### LOW — `Color()` Calls in Render (Severity: 3/10)

Multiple components call `Color(theme.colors.text).alpha(0.05).toString()` inside render methods or inline styles. While individually cheap, these create new string objects on every render.

**Found in:**
- `components/SurahsView.tsx:189,262,299,330`
- `components/player/v2/PlayerSheet.tsx:242`

---

## Architecture Diagram — Current Problem

```
App Launch (Android)
├── Module Evaluation (BLOCKING)
│   ├── reciters.json parse (492KB) ← blocks all imports of RECITERS
│   ├── 17 sheet modules + their dependency trees
│   └── All data/* module requires
├── Root Layout Mount
│   ├── useEffect #1: Font loading (7 Arabic fonts)
│   ├── useEffect #2: Tajweed preload → setTimeout(100ms) → require(8.3MB JSON) ← HUGE FREEZE
│   ├── useEffect #3: AppInitializer (SQLite + 7 services)
│   ├── useEffect #4: expo-audio init + store pre-warming
│   ├── useEffect #5: Navigation readiness
│   ├── useEffect #6: SystemUI color
│   ├── useEffect #7: Android nav bar (dynamic import!)
│   └── useEffect #8: Share intent handling
├── Provider Tree (7 levels)
├── Tab Layout Mount
│   └── Home tab (lazy=true, good)
│       └── SurahsView mounts → SectionList with 114+ items, no getItemLayout
└── First Frame Rendered (LATE on Android)
```

---

## Multi-Phase Remediation Plan

### Phase 1: Data Loading Revolution (Highest Impact)
**Goal:** Eliminate JS thread blocking from bundled data
**Expected Impact:** 40-60% improvement in startup and mount/unmount responsiveness

1. **Move large JSON data to SQLite** — Instead of bundling `QPC Hafs Tajweed 2.json` (8.3MB), `QPC V4 2.json` (5.2MB), and other Quran text data as JSON, pre-process them into a SQLite database that ships with the app. SQLite reads are paginated, lazy, and don't block the JS thread for the entire dataset.

2. **Lazy-load tajweed data per-surah** — Instead of parsing all 8.3MB at startup, load tajweed data only for the currently viewed surah. Use the SQLite approach: `SELECT * FROM tajweed WHERE surah = ?`.

3. **Chunk the tajweed processing** — If SQLite migration is too large for Phase 1, at minimum use `InteractionManager.runAfterInteractions()` combined with chunked processing (process 100 entries per frame using `requestAnimationFrame` or `setImmediate`).

4. **Pre-build the Fuse.js index** — Generate the Fuse index at build time (via a script) and ship the serialized index instead of building it at runtime.

---

### Phase 2: Startup Declutter (High Impact)
**Goal:** Reduce work competing for the JS thread during app initialization
**Expected Impact:** 20-30% improvement in time-to-interactive

1. **Lazy-register action sheets** — Replace the eager import of all 17 sheets in `sheets.tsx` with dynamic `import()` calls. Register each sheet only when it's first shown. Most users never open most sheets in a single session.

2. **Cache the `expo-navigation-bar` module** — The Android nav bar setup dynamically imports `expo-navigation-bar` on every theme change. Import it once at the top level (with `Platform.OS === 'android'` guard) and cache the reference.

3. **Defer non-visible initialization** — Move tajweed, adhkar, uploads, and Fuse.js initialization to `InteractionManager.runAfterInteractions()` so they run after the first frame is painted.

4. **Consolidate root layout useEffects** — Merge the 8 useEffect hooks into 2-3 logical groups (critical init, deferred init, theme sync) to reduce the number of effect scheduling overhead.

---

### Phase 3: Android-Specific Configuration (Medium Impact)
**Goal:** Enable Android platform optimizations
**Expected Impact:** 15-25% general performance improvement

1. **Enable `largeHeap: true`** in `app.config.js` under `android`:
   ```js
   android: {
     ...existing,
     largeHeap: true,
   }
   ```

2. ~~**Evaluate New Architecture**~~ — **Already enabled.** `newArchEnabled=true` in `android/gradle.properties:38`. No action needed.

3. **Investigate React Compiler compatibility** — The comment says it was disabled due to Zustand issues. Research if newer Zustand versions or the `useStore` pattern with explicit selectors resolves this. The compiler's auto-memoization would significantly help Android.

4. ~~**Explicit Hermes optimizations**~~ — **Already enabled.** `hermesEnabled=true` in `android/gradle.properties:42`. No action needed.

---

### Phase 4: Sheet & Navigation Smoothness (Medium Impact)
**Goal:** Fix sheet interaction UX and navigation transitions on Android
**Expected Impact:** Noticeable UX improvement, eliminates "broken feel"

1. **Fix `enableContentPanningGesture` on Android** — Instead of disabling it entirely, use proper gesture conflict resolution. Options:
   - Use `simultaneousHandlers` to allow both sheet and content gestures
   - Use `BottomSheetScrollView`/`BottomSheetFlatList` from `@gorhom/bottom-sheet` inside sheet content
   - Test per-sheet — some sheets may work fine with the gesture enabled

2. **Add screen transition optimization** — The root Stack uses `animation: 'fade'` which is good, but ensure all nested navigators also use native-driver animations. Consider `animation: 'none'` for tab switches if they're already lazy-loaded.

3. **Add `freezeOnBlur` verification** — Already set on tabs (good), but verify it's working by checking that off-screen tabs truly don't re-render.

4. **Optimize PlayerSheet** — The player bottom sheet (`@gorhom/bottom-sheet`) renders `PlayerContent` eagerly. Consider rendering a placeholder when the sheet is at index -1 (hidden).

---

### Phase 5: List & Rendering Polish (Lower Impact, High Polish)
**Goal:** Smooth scrolling and eliminate frame drops in lists
**Expected Impact:** 10-15% improvement in scroll performance

1. **Add `getItemLayout` to SurahsView** in list mode (fixed height items). This eliminates async measurement and enables instant scroll-to-index.

2. **Replace LinearGradient in Juz headers** — Use a simpler View with opacity gradient or a cached static image for the decorative lines. Native view creation for each header in a virtualized list is expensive.

3. **Replace remaining TouchableOpacity** with Pressable across all components.

4. **Memoize `Color()` computations** — Move `Color(theme.colors.text).alpha(X).toString()` into `useMemo` or compute them once in the theme object.

5. **Add `recyclingKey` to expo-image** in list contexts to enable image recycling on Android.

6. **Audit and add `React.memo`** to frequently re-rendered list item components (SurahItem, SurahCard, ReciterItem).

---

### Phase 6: Memory & Long-Session Stability (Maintenance)
**Goal:** Prevent performance degradation over time
**Expected Impact:** Prevents crashes and slowdowns in extended sessions

1. **Implement memory monitoring** — Add a dev-mode memory usage display to catch leaks early.

2. **Audit Zustand store sizes** — Check if stores accumulate stale data over time (recently played, search history, etc.).

3. **Configure expo-image cache limits** — Set explicit cache size limits for Android to prevent memory pressure from accumulated images.

4. **Test with Android profiler** — Use Android Studio's CPU and Memory profiler with a release build to validate improvements from each phase.

---

## Priority Matrix

| Phase | Impact | Effort | Do First? |
|-------|--------|--------|-----------|
| Phase 1: Data Loading | Very High | High | YES |
| Phase 2: Startup Declutter | High | Medium | YES |
| Phase 3: Android Config | Medium | Low | YES (quick wins) |
| Phase 4: Sheet & Nav | Medium | Medium | After 1-3 |
| Phase 5: List Polish | Medium-Low | Low | After 1-3 |
| Phase 6: Memory | Low (preventive) | Low | Ongoing |

**Recommended order:** Phase 3 (quick config wins) → Phase 2 (startup declutter) → Phase 1 (data revolution) → Phase 4 → Phase 5 → Phase 6

Phase 3 is listed first because `largeHeap` and config changes are one-line fixes with immediate benefit. Phase 2's lazy sheet loading is medium effort with high payoff. Phase 1 is the most impactful but requires the most work (SQLite migration for Quran data).
