# Bayaan

## What This Is

Bayaan is a Quran audio app for iOS and Android that lets users listen to Quran recitations from various reciters. Users can browse reciters, play surahs with background audio support, create playlists, download for offline listening, and mark favorites. Built with React Native and Expo.

## Core Value

Reliable, uninterrupted Quran playback — users must be able to listen to recitations seamlessly, whether online or offline.

## Requirements

### Validated

- ✓ Audio playback with background support — existing
- ✓ Queue management with lazy batch loading — existing
- ✓ Reciter and rewayat browsing — existing
- ✓ Surah selection and playback — existing
- ✓ Playlist creation and management (SQLite-backed) — existing
- ✓ Offline downloads with local file playback — existing
- ✓ Loved/favorite tracks persistence — existing
- ✓ Search functionality (reciters and surahs) — existing
- ✓ Dark/light theme support — existing
- ✓ Playback controls (rate, repeat, shuffle) — existing
- ✓ Recently played tracking — existing

### Active

(None yet — use `/gsd:new-milestone` to define next work)

### Out of Scope

- Cross-device sync — Deferred, requires Supabase schema and conflict resolution
- Verse-level navigation — Requires verse timestamp metadata not currently available
- Playback statistics/analytics — Future enhancement

## Context

**Technical environment:**

- React Native 0.76.9 with Expo SDK 52
- Expo Router v4 for file-based navigation
- Zustand for state management with AsyncStorage persistence
- SQLite for playlist storage
- react-native-track-player for audio (known issues, migration planned)

**Known issues to address:**

- Android performance is slow, especially playback responsiveness
- Background player controls become inconsistent after extended playback
- usePlayback hook has architectural issues (global state, race conditions)
- Tight coupling between TrackPlayer events and Zustand stores

**Codebase health:**

- Well-structured layered architecture
- Some large components need refactoring (ReciterProfile, BrowseReciters)
- Test coverage gaps in playback and download services

## Constraints

- **Platform**: Must support iOS 13+ and Android 8+ (API 26+)
- **Expo**: Stay within Expo managed workflow where possible
- **Offline-first**: Core playback must work without network after downloads

## Key Decisions


| Decision                  | Rationale                                                    | Outcome                                                  |
| ------------------------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| Zustand over Redux        | Simpler API, less boilerplate, sufficient for app complexity | ✓ Good                                                   |
| SQLite for playlists      | Need relational queries, AsyncStorage insufficient           | ✓ Good                                                   |
| react-native-track-player | Standard choice at time of development                       | ⚠️ Revisit — migration to react-native-audio-api planned |
| Expo managed workflow     | Faster iteration, OTA updates                                | ✓ Good                                                   |


---

*Last updated: 2026-01-26 after initialization*