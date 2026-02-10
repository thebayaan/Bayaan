# Phase 3 Handoff — Android Config Quick Wins

**Status:** DONE
**Branch:** `perf/android-config-phase3`

---

## Changes Made

### 1. `withLargeHeap.js` (CREATED)

Expo config plugin that sets `android:largeHeap="true"` on the `<application>` tag in AndroidManifest.xml.

- Uses `withAndroidManifest` from `@expo/config-plugins` (safe API, not `withDangerousMod`)
- Follows the project's existing plugin pattern (`withAndroidSigning.js`, `withIOSTeam.js`)
- **Why:** The app loads 28MB+ of bundled JSON. `largeHeap` increases available heap from ~128-256MB to ~256-512MB on Android, reducing GC pressure and OOM risk on mid-range devices.

### 2. `app.config.js` (MODIFIED)

Added `'./withLargeHeap.js'` to the plugins array between `withAndroidSigning.js` and `withIOSTeam.js`.

### 3. `app/_layout.tsx` (MODIFIED)

Cached the `expo-navigation-bar` dynamic import at module level.

**Before:** Every theme change triggered `await import('expo-navigation-bar')`, creating a new promise chain each time. `RNStatusBar.setTranslucent(true)` also ran repeatedly.

**After:** A module-level `let NavigationBarModule: any = null` caches the import. The first theme change triggers the dynamic import and sets `setTranslucent(true)`. All subsequent theme changes reuse the cached module directly — only `setBackgroundColorAsync` and `setButtonStyleAsync` run.

**Pattern established:** Module-level caching for lazy-loaded platform modules. Phase 2 can reuse this pattern for other deferred imports.

### 4. `docs/android-performance-audit.md` (MODIFIED)

Corrected inaccuracies found during investigation:

- **Executive summary:** Removed "no New Architecture" and "no explicit Hermes" — both are already enabled
- **"Missing Android Configuration" section:** Downgraded severity from 7/10 to 5/10. Marked items 2 (New Architecture) and 3 (Hermes) as ~~RESOLVED~~ with locations (`gradle.properties:38` and `:42`)
- **Phase 3 remediation plan:** Marked New Architecture evaluation and Hermes optimization as already done

---

## Items Confirmed Already Done (No Action Needed)

| Item | Location | Value |
|------|----------|-------|
| New Architecture (Fabric + TurboModules) | `android/gradle.properties:38` | `newArchEnabled=true` |
| Hermes JS engine | `android/gradle.properties:42` | `hermesEnabled=true` |

---

## Items Not Addressed (Out of Scope for Phase 3)

| Item | Why Skipped | Which Phase |
|------|-------------|-------------|
| React Compiler | Disabled due to Zustand subscription issues — needs investigation | Phase 3 (future revisit) |
| ProGuard/R8 flags | Low impact relative to other phases; Expo handles R8 in release builds by default | Phase 6 |

---

## Testing Checklist

- [ ] `expo prebuild --platform android --clean` succeeds
- [ ] `android/app/src/main/AndroidManifest.xml` contains `android:largeHeap="true"`
- [ ] `npx tsc --noEmit` passes
- [ ] App launches on Android without crashing
- [ ] Toggle light/dark theme 5+ times — nav bar updates correctly, no lag
- [ ] Navigate through all tabs
- [ ] Open the player sheet, open several action sheets
- [ ] Audio playback works
- [ ] iOS still launches and works (config plugin is Android-only)

---

## Context for Phase 2 — Startup Declutter

### What Phase 2 Should Do

Per the audit (`docs/android-performance-audit.md`, Phase 2 section):

1. **Lazy-register action sheets** — Replace the eager import of all 17 sheets in `components/sheets/sheets.tsx` with dynamic `import()` calls. Register each sheet only when first shown.
2. **Defer non-visible initialization** — Move tajweed, adhkar, uploads, and Fuse.js initialization to `InteractionManager.runAfterInteractions()` so they run after the first frame.
3. **Consolidate root layout useEffects** — Merge the 8 `useEffect` hooks in `app/_layout.tsx` into 2-3 logical groups.

### Key Files for Phase 2

| File | Why |
|------|-----|
| `components/sheets/sheets.tsx` | All 17 sheet registrations — make them lazy |
| `app/_layout.tsx` | 8 useEffects to consolidate; already has the nav bar caching pattern from Phase 3 |
| `services/AppInitializer.ts` | Startup orchestrator — may need to defer non-critical services |
| `utils/tajweedLoader.ts` | Tajweed preload — should use `InteractionManager.runAfterInteractions()` |
| `components/search/SearchView.tsx` | Fuse.js initialization — consider deferring |

### Patterns from Phase 3 to Reuse

- **Module-level caching:** The `let NavigationBarModule: any = null` pattern in `app/_layout.tsx` works well for caching dynamic imports. Use the same approach for lazy sheet registration.
- **Config plugin style:** If any Phase 2 changes need native config, follow the `withLargeHeap.js` pattern (use typed Expo config-plugins APIs, not `withDangerousMod`).

---

## All Files Touched

| File | Action |
|------|--------|
| `withLargeHeap.js` | CREATED |
| `app.config.js` | MODIFIED |
| `app/_layout.tsx` | MODIFIED |
| `docs/android-performance-audit.md` | MODIFIED |
| `docs/android-perf/00-tracker.md` | CREATED |
| `docs/android-perf/phase-3-handoff.md` | CREATED |
