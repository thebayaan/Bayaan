# Android Performance Improvement — Master Tracker

**Source audit:** `docs/android-performance-audit.md`
**Execution order:** Phase 3 → Phase 2 → Phase 1 → Phase 4 → Phase 5 → Phase 6

---

## Phase Status

| Phase | Name | Status | Branch | Commit | Impact Summary |
|-------|------|--------|--------|--------|----------------|
| 3 | Android Config Quick Wins | **DONE** | `perf/android-config-phase3` | — | `largeHeap` enabled, nav bar import cached, audit corrected (New Arch + Hermes already on) |
| 2 | Startup Declutter | PENDING | — | — | Lazy sheet registration, deferred init, consolidated useEffects |
| 1 | Data Loading Revolution | PENDING | — | — | Move large JSON to SQLite, lazy tajweed, pre-built Fuse index |
| 4 | Sheet & Navigation Smoothness | PENDING | — | — | Fix Android sheet gestures, screen transitions, PlayerSheet optimization |
| 5 | List & Rendering Polish | PENDING | — | — | getItemLayout, replace LinearGradient, Pressable migration, memo audit |
| 6 | Memory & Long-Session Stability | PENDING | — | — | Memory monitoring, store audit, cache limits, profiler validation |

---

## Cumulative File Changes

### Phase 3

| File | Action | Description |
|------|--------|-------------|
| `withLargeHeap.js` | CREATED | Expo config plugin — sets `android:largeHeap="true"` via `withAndroidManifest` |
| `app.config.js` | MODIFIED | Registered `withLargeHeap.js` in plugins array |
| `app/_layout.tsx` | MODIFIED | Cached `expo-navigation-bar` module at module level; import runs once, reused on theme changes |
| `docs/android-performance-audit.md` | MODIFIED | Corrected: New Architecture and Hermes already enabled; downgraded config severity 7→5 |
| `docs/android-perf/00-tracker.md` | CREATED | This file — master tracker |
| `docs/android-perf/phase-3-handoff.md` | CREATED | Phase 3 handoff with context for Phase 2 |

---

## How to Start a New Phase

Tell Claude: *"Read `docs/android-perf/00-tracker.md` and `docs/android-perf/phase-N-handoff.md` — we're starting Phase X"*

Claude will read both documents, understand the full state, and pick up the next phase with zero knowledge loss.

---

## Context

- **App:** Bayaan — React Native/Expo Quran audio app
- **Problem:** Android performance lags behind iOS due to compounding issues (28MB bundled JSON, eager initialization, missing config)
- **Key files:** `app/_layout.tsx` (root layout), `services/AppInitializer.ts` (startup), `components/sheets/sheets.tsx` (sheet registration), `data/reciterData.ts` (reciters JSON)
- **Already confirmed enabled:** New Architecture (`gradle.properties:38`), Hermes (`gradle.properties:42`)
