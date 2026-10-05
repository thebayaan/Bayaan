# RFC-016: Expo SDK 56 Native Capability Roadmap

## Status

Proposed.

## Context

Expo SDK 56 was released on May 21, 2026. It includes React Native 0.85,
React 19.2, production-ready Expo UI, stable iOS widgets, inline modules,
faster native builds, a faster Expo Modules runtime, improved file-system APIs,
Expo Router changes, and several EAS build improvements.

Bayaan is currently on Expo SDK 55 with React Native 0.83.2 and React 19.2.
The app already uses a development-client workflow, checked-in native projects,
New Architecture, Hermes, Expo Router, `expo-audio`, `expo-sqlite`,
`expo-file-system/legacy`, Skia, FlashList, Reanimated, MMKV/Nitro, Sentry,
share intents, and native iOS/Android project configuration.

The app has reached a stage where native code should be treated as a strategic
product capability, especially for Android performance and native platform
surfaces. The goal should not be to rewrite the app in Swift/Kotlin, but to use
SDK 56 to make native code easier to add exactly where it raises the ceiling.

Primary upstream references:

- Expo SDK 56 changelog: https://expo.dev/changelog/sdk-56
- SDK 56 docs: https://docs.expo.dev/versions/v56.0.0/

## Goals

- Upgrade Bayaan from SDK 55 to SDK 56 safely.
- Identify SDK 56 features that can materially improve Bayaan.
- Establish a practical native-code roadmap for Mushaf, Android performance,
  widgets, audio, storage, downloads, and native UI.
- Avoid expensive rewrites unless prototypes prove the benefit.
- Keep React Native as the product iteration layer while moving select hot paths
  and platform surfaces native.

## Non-Goals

- Rewriting the full app in Swift and Kotlin.
- Replacing the current Mushaf renderer without profiling and prototype data.
- Migrating every community UI dependency to Expo UI in one pass.
- Moving away from Expo Router or the development-client workflow.

## Current Bayaan Surfaces That Matter

### Mushaf

The Mushaf is one of the highest-leverage areas for native investment. It is
performance-sensitive and combines:

- Skia rendering.
- FlashList / continuous scrolling.
- custom Quran font handling.
- page, line, ayah, and word lookup.
- gesture hit-testing.
- ayah highlighting.
- timestamp follow-along.
- bookmarks, notes, tafseer, translations, and similar verses.
- SQLite-backed local datasets.

Android is the higher-risk platform for smoothness and responsiveness. Any
native Mushaf work should start with Android profiling before a rewrite is
considered.

### Audio

Bayaan uses `expo-audio` for playback and background audio. SDK 56 adds
audio improvements such as real-time microphone buffer access and live-stream
status fields. Most of that is not immediately central to Bayaan, but the
broader SDK 56 Expo Modules runtime improvements can help native module call
overhead.

Audio-related native opportunities:

- More reliable lock-screen metadata and state sync.
- Native timestamp-to-highlight mapping.
- More precise playback progress handling for follow-along.
- Android media-control polish.
- Future Live Activity integration for active recitation.

### SQLite And Local Data

Bayaan relies heavily on SQLite for Quran-related data, adhkar, tafseer,
translations, uploads, timestamps, bookmarks, notes, highlights, and playlists.
SDK 56 includes `expo-sqlite` improvements such as native `ArrayBuffer` blob
columns, statement bind params, and session changesets.

The larger opportunity is not simply using new SQLite APIs. It is to reduce JS
coordination overhead by exposing purpose-built native queries that return
compact page or feature payloads.

### Downloads, Uploads, And File Handling

Bayaan still uses `expo-file-system/legacy` in several services. SDK 56 expands
the new file-system API with progress, abort support, task-based uploads and
downloads, resumable downloads, overwrite options, multi-file picking, and
experimental file watching.

This can improve:

- recitation downloads.
- uploaded audio imports.
- font downloads.
- share-card file output.
- cache cleanup.

This should be a separate migration after the core SDK upgrade because SDK 56
also changes `File.copy()` and `File.move()` to async methods in the new API.

### Native UI

Bayaan currently uses community components that SDK 56 Expo UI can replace or
partially replace:

- `@gorhom/bottom-sheet`
- `@react-native-community/slider`
- `@react-native-segmented-control/segmented-control`
- `@react-native-masked-view/masked-view`

Expo UI is now production-ready and exposes universal native components backed
by SwiftUI on iOS and Jetpack Compose on Android. It also includes drop-in
replacements for several community packages.

The right adoption strategy is selective:

- Start with settings controls, segmented controls, simple sliders, and simple
  native-feeling form rows.
- Avoid the main player sheet and Mushaf controls until Expo UI has been proven
  in lower-risk surfaces.
- Use Expo UI for native polish, not as a forced design-system rewrite.

## SDK 56 Features That Can Help Bayaan

### 1. Inline Modules

Inline modules let us define Expo native modules directly inside the app
structure, alongside TypeScript. During prebuild, Expo can add Swift/Kotlin
files to the native projects and autolink them.

This is important for Bayaan because we can add native code without creating a
separate package for every experiment.

Expected benefits:

- Faster native experimentation.
- Smaller boundary between product code and native acceleration.
- Easier Android-first prototypes.
- Typed interfaces through SDK 56's type generation tooling.
- A practical path to native Mushaf and audio helpers.

Inline modules do not automatically make the app faster. They help when we move
the correct CPU-bound, latency-sensitive, or platform-specific work native.

Best first inline-module candidates:

- `mushaf-native-engine`
- `audio-timestamp-engine`
- `download-manager`
- `widget-data-provider`

### 2. Expo Modules Runtime Improvements

SDK 56 improves Expo Modules runtime performance. Android benefits from a Kotlin
compiler-plugin approach that replaces more reflection with build-time metadata.
iOS benefits from a leaner JSI path using Swift/C++ interop.

This makes native module calls cheaper, but performance wins still depend on
moving meaningful work across the boundary. The win should be measured with
before/after profiling rather than assumed.

### 3. Widgets And Live Activities

SDK 56 promotes iOS widgets to stable. Widgets and Live Activities no longer
need to be pre-rendered and have better timeline management, error handling,
config plugin support, and environment access.

High-value Bayaan widgets:

- Continue Reading: last Mushaf page, surah, or ayah.
- Daily Ayah: one verse with translation and a deep link.
- Morning / Evening Adhkar: current status and quick entry.
- Tasbeeh Counter: persistent counter shortcut.
- Current Recitation: resume current or last played recitation.
- Favorites: quick launch favorite reciter, playlist, or surah.

Potential Live Activities:

- Active recitation progress.
- Current surah / ayah follow-along.
- Long adhkar session progress.

Implementation considerations:

- Define a minimal shared data contract from JS to native widget storage.
- Keep widget data small, local, and privacy-safe.
- Treat Android widgets as a separate roadmap item if Expo's stable widget
  support remains iOS-first.
- Prototype one widget first: Continue Reading is likely the cleanest.

### 4. Expo UI

Expo UI can raise Bayaan's native polish, especially for Android, but it should
be adopted gradually.

Good first targets:

- Settings rows and switches.
- Reciter-choice segmented controls.
- Reading-theme segmented controls.
- Simple sliders in ambient/audio settings.
- Simple bottom sheets that do not require complex nested scroll behavior.

Avoid at first:

- Player sheet.
- Mushaf action sheets.
- Queue list sheets.
- Any surface with complicated gesture coordination.

Decision rule:

Use Expo UI where it removes community dependency risk, improves native feel,
or reduces custom UI code. Do not use it where the current custom UI is already
highly tuned or where Expo UI prop gaps would cause regressions.

### 5. Faster Native Builds

SDK 56 includes precompiled Expo packages on iOS by default and EAS prebuilt
artifacts for major community libraries such as Reanimated and Screens. This
matters because Bayaan has a large native dependency graph.

Expected impact:

- Faster local clean iOS builds.
- Faster EAS iOS builds.
- Better signal from EAS build-time statistics.
- Less upgrade friction once the project is aligned with SDK 56.

Android also has experimental CMake precompiled headers through
`expo-build-properties`. This should be considered only after the SDK upgrade is
stable.

### 6. Expo Router Changes

SDK 56 decouples Expo Router from React Navigation. Bayaan currently has direct
imports from React Navigation packages for theme providers, tab props, focus
effects, header height, and actions.

Upgrade work required:

- Run the SDK 56 Expo Router codemod.
- Audit all direct `@react-navigation/*` imports.
- Replace or isolate remaining imports.
- Verify custom tab bars, tablet sidebar navigation, focus effects, and native
  headers.

This is likely one of the highest-risk upgrade areas.

### 7. Status Bar And Navigation Bar

SDK 56 gives `expo-status-bar` and `expo-navigation-bar` a more consistent
declarative component API. Bayaan currently configures Android navigation bar
styling imperatively in the root layout.

After the upgrade, consider replacing imperative setup with declarative status
and navigation bar components where possible.

### 8. File System

The improved SDK 56 file-system API can help Bayaan's downloads and uploads,
but it should not block the SDK upgrade.

Recommended path:

1. Keep `expo-file-system/legacy` during the SDK upgrade.
2. Add tests around download/import/cache behavior.
3. Migrate one service at a time to the new API.
4. Use task-based downloads for recitation downloads.
5. Use abort/progress support for better UI and cancellation.

### 9. Vector Icons

SDK 56 deprecates `@expo/vector-icons` in favor of scoped
`@react-native-vector-icons/*` packages. Bayaan uses `@expo/vector-icons`
heavily.

Recommended path:

1. Keep `@expo/vector-icons` explicitly installed for the SDK 56 upgrade.
2. Do not combine icon migration with the SDK upgrade PR.
3. Run the vector-icons codemod later.
4. Verify icon font loading and bundle size after migration.

## Native Mushaf Strategy

Bayaan should consider a native Mushaf future, but it should be approached as a
measured roadmap rather than a rewrite.

### Phase 1: Profile Current Android Mushaf

Measure:

- JS thread time.
- UI thread time.
- Skia draw cost.
- FlashList measurement and recycling.
- SQLite read time.
- memory and GC behavior.
- frame drops during scroll.
- tap/highlight latency.
- timestamp follow-along latency.

This determines whether native work should target data, layout, rendering, or
gesture handling.

### Phase 2: Native Mushaf Engine

Create an inline module, starting with Kotlin and then Swift if useful:

- `getPagePayload(page, rewayah, options)`
- `getVisibleRangePayload(startPage, endPage, options)`
- `hitTest(page, x, y, viewportMetrics)`
- `getHighlightForPosition(trackId, positionMs)`
- `prefetchPages(pages, options)`
- `clearPageCache()`

The React/Skia renderer remains in place, but JS receives compact, prepared
payloads instead of coordinating many data lookups and transformations.

This is the best first native Mushaf investment because it lowers risk while
targeting likely Android bottlenecks.

### Phase 3: Android Native Renderer Prototype

Build a feature-flagged Android-native Mushaf renderer for one mode only:

- page mode, or
- continuous mode if profiling shows list/rendering is the main issue.

Prototype options:

- Jetpack Compose wrapper through Expo UI / native views.
- Android custom view / canvas if Compose text/rendering cannot match Quran
  font requirements.

Compare against current Skia renderer:

- rendering fidelity.
- scroll FPS.
- memory.
- first page load time.
- touch hit-test accuracy.
- highlight latency.
- implementation complexity.

Only proceed if the native prototype clearly beats the current implementation.

### Phase 4: Cross-Platform Native View

If Android native rendering proves valuable, decide whether iOS needs the same
path. iOS may not need a full native renderer if the current Skia renderer is
already smooth.

Possible end states:

- Android native Mushaf renderer + iOS Skia renderer.
- Shared native engine + React/Skia renderer on both platforms.
- Full native renderers on both platforms.

The first two are more realistic than a full native rewrite.

## Broader Native-Code Roadmap

### Keep React Native For

- navigation.
- settings.
- collection screens.
- lists.
- forms.
- onboarding.
- most sheets.
- themes.
- product iteration.

### Move Native Where It Raises The Ceiling

- Mushaf data engine.
- Android Mushaf rendering experiments.
- audio follow-along timing.
- media controls and lock-screen polish.
- widgets and Live Activities.
- download/import background tasks.
- large local database queries.
- native UI controls where Expo UI is a good fit.

## Upgrade Plan

1. Create an SDK 56 upgrade branch.
2. Run `npx expo install expo@^56.0.0 --fix`.
3. Run `npx expo-doctor@latest`.
4. Apply Expo Router codemod and manually fix remaining navigation imports.
5. Update native project files using Expo's native project upgrade guidance.
6. Set iOS deployment target to 16.4.
7. Ensure local and CI Node versions are at least 20.19.4.
8. Rebuild iOS and Android dev clients.
9. Smoke test startup, navigation, player, background audio, lock screen,
   downloads, uploads, share intent, Mushaf, SQLite-backed screens, widgets
   baseline, Sentry, PostHog, OTA-enabled and OTA-disabled configs.
10. After the upgrade is stable, start separate feature branches for widgets,
    Expo UI pilots, file-system migration, vector-icon migration, and native
    Mushaf experiments.

## Recommended First Follow-Up PRs

### PR 1: SDK 56 Upgrade

Pure upgrade and compatibility work. No product feature changes.

### PR 2: Widget Prototype

Add one iOS widget: Continue Reading.

Acceptance criteria:

- shows last read page/surah/ayah.
- deep-links into Mushaf.
- handles empty state.
- does not expose private data unexpectedly.

### PR 3: Expo UI Pilot

Replace one low-risk settings control group with Expo UI.

Acceptance criteria:

- native feel improves or dependency surface is reduced.
- Android and iOS both match Bayaan's theme.
- no regressions in accessibility, dark mode, or RTL-adjacent layouts.

### PR 4: Android Mushaf Profiling

Add profiling notes, traces, and target bottleneck findings.

Acceptance criteria:

- identifies whether bottleneck is JS, UI thread, Skia draw, SQLite, memory, or
  list measurement.
- proposes one native module experiment based on data.

### PR 5: Native Mushaf Engine Prototype

Add a Kotlin-first inline module for a narrow Mushaf operation.

Acceptance criteria:

- feature-flagged.
- benchmarked against current JS path.
- no renderer rewrite.
- clear before/after metrics.

## Open Questions

- Should Bayaan continue checking in generated native directories, or move
  closer to Continuous Native Generation for easier SDK upgrades?
- Which Mushaf mode is the worst on Android: page mode, continuous mode, or
  follow-along mode?
- Is the current Mushaf bottleneck primarily data preparation, rendering,
  gesture hit-testing, or React re-rendering?
- Should widgets be iOS-only initially, or should Android widget support be
  planned in parallel with a different native approach?
- Should Expo UI become a long-term UI primitive for settings and simple
  controls, or remain limited to select native widgets?

## Recommendation

Upgrade to SDK 56 first, then use it as the foundation for native expansion.
The highest-value roadmap is:

1. SDK 56 compatibility.
2. iOS Continue Reading widget.
3. Android Mushaf profiling.
4. Kotlin-first native Mushaf engine inline module.
5. Low-risk Expo UI pilot.
6. File-system migration for downloads/uploads.
7. Vector-icons migration.
8. Android native Mushaf renderer prototype only if profiling justifies it.

This keeps Bayaan fast to develop while opening the door to native-level
performance and platform polish where users will actually feel it.
