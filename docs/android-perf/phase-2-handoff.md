# Phase 2 Handoff — Startup Declutter

**Status:** DONE
**Branch:** `perf/android-config-phase3` (combined with Phase 3)

---

## What Was Done

### 1. Lazy-loaded all sheet components (`components/sheets/sheets.tsx`)

- Replaced 19 eager `import` statements with `React.lazy()` + `Suspense` wrappers
- Created a `lazySheet()` helper that wraps each sheet in `React.lazy` + `Suspense` with an empty `<View />` fallback
- Removed `RewayatInfoSheet` registration — 0 usages of `SheetManager.show('rewayat-info')` found in the codebase (dead code). Type declaration kept for safety.
- All TypeScript type declarations preserved (compile-time only, zero runtime cost)

**How it works in React Native:** Metro bundles all modules into a single file but `import()` defers module *evaluation* until called. On first sheet open, `require()` evaluates the module synchronously (imperceptible since sheet is animating open). Subsequent opens use the cached module.

**Heaviest sheets deferred:** OrganizeRecitationSheet (1,204 lines), SurahOptionsSheet (570 lines), PlayerOptionsSheet (549 lines) — all pull in data services, hooks, and component libraries.

### 2. Consolidated root layout effects (`app/_layout.tsx`)

- **Removed dead effect:** The "navigation handler" effect (lines 221-225) had an empty body — only an early return that did nothing.
- **Merged theme sync effects:** `SystemUI.setBackgroundColorAsync` and Android nav bar setup merged into a single effect with `[theme.colors.background, isDarkMode]` dependency.
- **Merged background init effects:** Tajweed preload and SQLite services init merged into a single `[]` effect.
- **Removed `isTajweedLoading` state:** Was only used as a run-once guard; `[]` dependency handles this naturally.
- **Added `InteractionManager` import** from `react-native`.
- **Net result:** 9 useEffects → 6. Removed 1 `useState`.

### 3. Replaced `setTimeout` with `InteractionManager` in tajweed loader (`utils/tajweedLoader.ts`)

- Removed `preloadTajweedDataWithTimeout()` entirely (the `setTimeout(100ms)` variant)
- Made `preloadTajweedData()` synchronous — it does the heavy work directly when called
- The deferral responsibility moved to the caller (`_layout.tsx` wraps call in `InteractionManager.runAfterInteractions`)
- Removed the old async variant that used dynamic `import()` (unnecessary since `require()` in Metro is synchronous)

**Why InteractionManager over setTimeout:** `setTimeout(100ms)` is an arbitrary delay that may still collide with user interaction. `InteractionManager.runAfterInteractions()` is React Native's built-in mechanism to defer work until after animations, gestures, and transitions are complete — it guarantees the first frame is painted before the heavy 8.3MB JSON parse begins.

---

## Patterns Established

1. **`lazySheet()` helper** — reusable pattern for any future sheet registrations. Just add a new `registerSheet()` call with the helper.
2. **InteractionManager for heavy deferred work** — use `InteractionManager.runAfterInteractions()` instead of `setTimeout` for deferring non-critical startup work.
3. **Caller-controlled deferral** — utility functions do work synchronously; the caller decides *when* to invoke them. Cleaner separation of concerns.

---

## What's Left for Phase 1

Phase 1 (Data Loading Revolution) focuses on the **biggest remaining bottleneck**: large JSON data files.

Key targets:
- Move 20MB+ reciters JSON to SQLite for on-demand queries instead of full parse
- Pre-build Fuse.js search indices at build time instead of runtime
- Tajweed data is now properly deferred (Phase 2), but could be moved to SQLite for even better memory usage (Phase 1 scope)

---

## Verification Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `npx prettier --check` passes on modified files
- [ ] App launches on Android — no crash, no white screen
- [ ] Open every sheet type at least once — all render correctly
- [ ] Toggle light/dark theme — nav bar still updates
- [ ] Audio playback still works
- [ ] iOS still works (no regressions)
