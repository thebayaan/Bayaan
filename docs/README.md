# Bayaan Documentation

This is the documentation hub for the Bayaan open-source Quran app. All docs live in this directory.

**Tech stack:** React Native 0.83 · Expo SDK 55 · Expo Router (SDK 55) · expo-audio · Zustand · expo-sqlite · MMKV · Skia

Archived docs and shipped implementation plans are kept for historical context. For current behavior, start with the architecture overview and the relevant feature doc.

---

## Getting started

New to the project? Start here:

1. [README.md](../README.md) — project overview, features, quick start
2. [CONTRIBUTING.md](../CONTRIBUTING.md) — setup guide, code standards, PR workflow
3. [Architecture overview](architecture/current-state.md) — how all the pieces fit together
4. [Self-hosting guide](contributing/self-hosting.md) — running your own backend

---

## Architecture

| Document | Description |
|----------|-------------|
| [current-state.md](architecture/current-state.md) | Full architecture overview: startup, audio, navigation, state, database |
| [playback-migration.md](architecture/playback-migration.md) | **[ARCHIVED]** Historical plan for migrating from TrackPlayer to expo-audio |
| [auth-removal.md](architecture/auth-removal.md) | **[ARCHIVED]** Log of authentication removal for initial release |

---

## Features

### Implemented features

| Document | Description |
|----------|-------------|
| [player.md](features/player.md) | Audio player architecture, ExpoAudioService, playerStore, queue |
| [queue.md](features/queue.md) | Queue management, track shape, repeat modes |
| [downloads.md](features/downloads.md) | Offline download system, downloadStore, file path resolution |
| [ambient-sounds.md](features/ambient-sounds.md) | Ambient audio, AmbientAudioService, ambient store |
| [verse-interactions.md](features/verse-interactions.md) | Verse annotations — bookmarks, notes, highlights |
| [ayah-timestamps.md](features/ayah-timestamps.md) | Ayah timestamp fetch, cache, and follow-along system |
| [reciter-profile.md](features/reciter-profile.md) | Reciter profile screen components |
| [whats-new.md](features/whats-new.md) | What's New / changelog feature |
| [uploads.md](features/uploads.md) | User-uploaded recitations feature |
| [mushaf-page.md](features/mushaf-page.md) | Mushaf page feature overview (see digital-khatt/ for rendering details) |
| [digital-khatt-rendering.md](features/digital-khatt-rendering.md) | Digital Khatt rendering overview |
| [adhkar-feature-plan.md](features/adhkar-feature-plan.md) | Adhkar feature — implementation reference |
| [rewayat.md](features/rewayat.md) | Multi-qira'at (rewayat) support — 8 KFGQPC readings across mushaf, player, and UGC |
| [analytics.md](features/analytics.md) | Analytics & listening insights — Phase 1 shipped (PostHog events, local aggregation, Sentry) |

### Digital Khatt (Mushaf rendering)

Deep documentation of the Uthmani Mushaf rendering system:

| Document | Description |
|----------|-------------|
| [README.md](features/digital-khatt/README.md) | Hub — reading order, TL;DR, primary source files |
| [architecture.md](features/digital-khatt/architecture.md) | System architecture |
| [data-pipeline.md](features/digital-khatt/data-pipeline.md) | Data loading pipeline |
| [rendering-pipeline.md](features/digital-khatt/rendering-pipeline.md) | Skia rendering pipeline |
| [justification-engine.md](features/digital-khatt/justification-engine.md) | Line justification engine |
| [mmkv-layout-cache-proposal.md](features/digital-khatt/mmkv-layout-cache-proposal.md) | MMKV layout cache design |
| [debugging-playbook.md](features/digital-khatt/debugging-playbook.md) | Debugging guide |
| [development-guide.md](features/digital-khatt/development-guide.md) | Development guide |
| [glossary.md](features/digital-khatt/glossary.md) | Terminology glossary |

### Planned / future features

| Document | Description |
|----------|-------------|
| [cloud-sync.md](features/cloud-sync.md) | Cloud sync (planned) |
| [shareable-links.md](features/shareable-links.md) | Deep link sharing |
| [carplay-android-auto.md](features/carplay-android-auto.md) | CarPlay / Android Auto |
| [smartwatch.md](features/smartwatch.md) | Smartwatch integration |
| [tv-app.md](features/tv-app.md) | TV app |
| [web-app.md](features/web-app.md) | Separate web app |
| [widgets.md](features/widgets.md) | Home screen widgets |
| [player-transition.md](features/player-transition.md) | Player UI transition improvements |
| [translations-tafaseer-research.md](features/translations-tafaseer-research.md) | Translations and Tafaseer research |

---

## Development

| Document | Description |
|----------|-------------|
| [app-initialization.md](development/app-initialization.md) | AppInitializer system, priorities, registering new services |
| [git-workflow.md](development/git-workflow.md) | Git flow, branching conventions, PR process |
| [android-performance-enhancements.md](development/android-performance-enhancements.md) | Android performance audit and improvements |
| [performance-postmortem.md](development/performance-postmortem.md) | **[ARCHIVED]** Playback performance postmortem (TrackPlayer era) |
| [whats-new-implementation.md](development/whats-new-implementation.md) | What's New feature implementation notes |

---

## Contributing

| Document | Description |
|----------|-------------|
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Setup, code standards, PR workflow |
| [ai-guidelines.md](contributing/ai-guidelines.md) | AI-assisted development policy and code marking convention |
| [self-hosting.md](contributing/self-hosting.md) | Running your own backend (Supabase, API, EAS) |

---

## Deployment

| Document | Description |
|----------|-------------|
| [deployment.md](deployment/deployment.md) | Full build and release process for iOS and Android |
| [version-management.md](deployment/version-management.md) | Git-based versioning, `generate-version.js`, build numbers |

---

## Research

| Document | Description |
|----------|-------------|
| [native-tabs-inset-issues.md](research/native-tabs-inset-issues.md) | NativeTabs safe area issues (SDK 55) |
| [native-tabs-quick-fixes.md](research/native-tabs-quick-fixes.md) | NativeTabs quick fix workarounds |
| [download-systems-analysis.md](download-systems-analysis.md) | Download codepath consolidation analysis |

---

## Performance (Android)

| Document | Description |
|----------|-------------|
| [00-tracker.md](android-perf/00-tracker.md) | Android performance work tracker (phases 1–5) |
| [android-performance-audit.md](android-performance-audit.md) | Original Android performance audit |
| [phase-2-handoff.md](android-perf/phase-2-handoff.md) | Phase 2 handoff notes |
| [phase-3-handoff.md](android-perf/phase-3-handoff.md) | Phase 3 handoff notes |

---

## Testing

| Document | Description |
|----------|-------------|
| [download-testing.md](testing/download-testing.md) | Manual download regression test checklist |

---

## Implementation plans (shipped)

These documents were written before implementation and are kept for historical reference. Each has a **SHIPPED** banner at the top.

| Document | Feature |
|----------|---------|
| [2026-03-04-word-by-word-translation-design.md](plans/2026-03-04-word-by-word-translation-design.md) | Word-by-word translation design |
| [2026-03-04-word-by-word-implementation.md](plans/2026-03-04-word-by-word-implementation.md) | Word-by-word implementation plan |
| [2026-03-06-android-floating-ui.md](plans/2026-03-06-android-floating-ui.md) | Android floating tab bar + player |
| [2026-03-06-android-floating-ui-design.md](plans/2026-03-06-android-floating-ui-design.md) | Android floating UI design |
| [2026-03-07-on-demand-timestamps.md](plans/2026-03-07-on-demand-timestamps.md) | On-demand timestamp fetch |
| [2026-03-07-mushaf-thematic-highlighting.md](plans/2026-03-07-mushaf-thematic-highlighting.md) | Mushaf thematic highlighting |
