# Feature: Apple Watch & Wear OS Support

**Status:** Proposal
**Priority:** Low
**Complexity:** High
**Created:** 2026-02-20

## Overview

Add smartwatch companion apps for Apple Watch (watchOS) and Wear OS (Android), allowing users to control Quran playback from their wrist and optionally listen to recitations independently via Bluetooth headphones.

## User Story

As a user listening to Quran on my phone, I want to control playback from my Apple Watch or Wear OS watch so that I can pause, skip, and see what's playing without reaching for my phone.

As a user going for a walk or exercising, I want to download surahs to my watch so that I can listen via AirPods/Bluetooth headphones without carrying my phone.

## Technical Feasibility

### Critical Constraint: No React Native on Watches

Unlike TV platforms, **React Native cannot run on smartwatches**. Watch apps must be written entirely in native code:

- **Apple Watch** → Swift + SwiftUI (mandatory since watchOS 7+)
- **Wear OS** → Kotlin + Jetpack Compose for Wear OS

Bridge libraries exist to let the React Native phone app communicate with the native watch app, but the **watch UI is fully native**.

### Communication Libraries


| Platform | Library                                                                                                    | Status                               | Protocol                              |
| -------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------- |
| watchOS  | `[rn-watch-connect](https://github.com/CRIIPI11/rn-watch-connect)`                                         | Active (modern fork)                 | Apple WatchConnectivity (`WCSession`) |
| watchOS  | `[react-native-watch-connectivity](https://github.com/watch-connectivity/react-native-watch-connectivity)` | Unmaintained (v1.1.0, 2022)          | WatchConnectivity                     |
| Wear OS  | `[react-native-wear-connectivity](https://github.com/fabOnReact/react-native-wear-connectivity)`           | Active (v0.1.17, RN 0.82 compatible) | Wearable Data Layer API               |


### Expo Compatibility

- Neither watch bridge library works in Expo Go
- Requires `expo prebuild` to generate native projects
- watchOS target must be added manually in Xcode and preserved across prebuilds (config plugin or committed `ios/` directory)
- Wear OS module added alongside the existing Android project

## Platform Capabilities

### Apple Watch Audio


| Hardware           | Speaker Playback       | Bluetooth Headphones | Standalone (no iPhone) |
| ------------------ | ---------------------- | -------------------- | ---------------------- |
| Series 9 and older | No media audio         | Yes                  | Yes (Wi-Fi/LTE)        |
| Series 10+ (2024)  | Yes (first to support) | Yes                  | Yes (Wi-Fi/LTE)        |
| Ultra 2            | Yes                    | Yes                  | Yes (Wi-Fi/LTE)        |


**Caveats:**

- Speaker playback drains ~6 min battery per minute of audio — impractical for long surahs
- Bluetooth headphone playback is the realistic path for standalone listening
- watchOS aggressively kills background downloads — even well-funded apps (Overcast, Spotify) struggle with download reliability
- **75 MB app bundle size limit** on watchOS
- Independent app capability available since watchOS 6 (2019)

### Wear OS Audio


| Feature                    | Status                                                                |
| -------------------------- | --------------------------------------------------------------------- |
| Bluetooth audio output     | Supported on all Wear OS devices                                      |
| Built-in speaker for media | Added in Wear OS 5.1 (Nov 2024), but Google officially discourages it |
| Standalone LTE streaming   | Available on cellular models                                          |
| Audio offload to DSP       | Supported on modern chipsets (battery optimization)                   |


**Caveats:**

- Android 15+ enforces `setSuppressPlaybackOnUnsuitableOutput(true)` — media won't play on speaker unless explicitly allowed
- Bluetooth headphone playback is the recommended path
- Downloads should use WorkManager with charging + Wi-Fi constraints

## Architecture

### Communication Flow

```
┌─────────────────────┐          WatchConnectivity /         ┌──────────────────┐
│   Phone App (RN)    │         Wearable Data Layer          │   Watch App      │
│                     │◄────────────────────────────────────►│   (Native)       │
│  ┌───────────────┐  │                                      │                  │
│  │ Bridge Module │  │  Messages:                           │  ┌────────────┐  │
│  │ (rn-watch-    │  │  • play/pause/skip commands          │  │  SwiftUI   │  │
│  │  connect)     │  │  • current track info                │  │  or        │  │
│  └───────────────┘  │  • playback state sync               │  │  Compose   │  │
│                     │                                      │  └────────────┘  │
│  ┌───────────────┐  │  Application Context:                │                  │
│  │ ExpoAudio     │  │  • reciter list                      │  ┌────────────┐  │
│  │ Service       │  │  • surah list                        │  │  AVPlayer   │  │
│  │ (playback)    │  │  • user preferences                  │  │  or Media3  │  │
│  └───────────────┘  │                                      │  │ (standalone)│  │
│                     │  File Transfer:                      │  └────────────┘  │
│  ┌───────────────┐  │  • audio files for offline           │                  │
│  │ Zustand       │  │                                      │                  │
│  │ Stores        │  │                                      │                  │
│  └───────────────┘  │                                      │                  │
└─────────────────────┘                                      └──────────────────┘
```

### WatchConnectivity Channels (watchOS)


| Method                     | Direction                 | Use Case                           |
| -------------------------- | ------------------------- | ---------------------------------- |
| `sendMessage`              | Bidirectional, real-time  | Play/pause/skip commands           |
| `updateApplicationContext` | Phone → Watch             | Sync current surah, reciter, state |
| `transferUserInfo`         | Phone → Watch, queued     | Queue updates                      |
| `transferFile`             | Bidirectional, background | Download audio to watch            |


### Wearable Data Layer (Wear OS)


| API             | Use Case                                  |
| --------------- | ----------------------------------------- |
| `MessageClient` | Low-latency commands (play/pause/skip)    |
| `DataClient`    | Synced state (current track, preferences) |
| `ChannelClient` | Large file transfers (audio downloads)    |


**Wear OS constraint:** Both phone and watch apps must share the **same package name and signing certificate**.

## Watch UI Design

### Apple Watch (SwiftUI)

#### Now Playing Screen (Primary)

```
┌───────────────────────┐
│                       │
│    Al-Baqarah         │
│    Sheikh Al-Husary   │
│                       │
│  ━━━━━━━●━━━━━━━━━━━  │
│  02:34       45:12    │
│                       │
│    ⏮    ▶❚❚    ⏭     │
│                       │
│  🔊 ━━━━━━●━━━━━━━━━  │
│                       │
└───────────────────────┘
   (Digital Crown = volume)
```

#### Surah List Screen

```
┌───────────────────────┐
│  Select Surah         │
│  ─────────────────    │
│  1. Al-Fatiha     ▶   │
│  2. Al-Baqarah    ▶   │
│  3. Aal-Imran     ▶   │
│  4. An-Nisa       ▶   │
│  5. Al-Ma'idah    ▶   │
│  ...                   │
└───────────────────────┘
   (Digital Crown = scroll)
```

#### Reciter Selection

```
┌───────────────────────┐
│  Reciters             │
│  ─────────────────    │
│  ┌─────┐              │
│  │ img │ Al-Husary    │
│  └─────┘              │
│  ┌─────┐              │
│  │ img │ Al-Minshawi  │
│  └─────┘              │
│  ┌─────┐              │
│  │ img │ As-Sudais    │
│  └─────┘              │
└───────────────────────┘
```

### Wear OS (Jetpack Compose)

Similar layouts but adapted for round displays:

- Curved text for titles
- `ScalingLazyColumn` for scrollable lists
- Rotary input (crown/bezel) for scrolling and volume
- `Horologist` library for media playback UI scaffolding

## Requirements

### Functional Requirements


| ID    | Requirement                                                  | Priority |
| ----- | ------------------------------------------------------------ | -------- |
| SW-01 | Watch displays current surah name and reciter                | Must     |
| SW-02 | Play/pause control from watch                                | Must     |
| SW-03 | Next/previous track from watch                               | Must     |
| SW-04 | Playback progress bar on watch                               | Must     |
| SW-05 | Volume control (Digital Crown on watchOS, rotary on Wear OS) | Must     |
| SW-06 | Surah selection from watch                                   | Should   |
| SW-07 | Reciter selection from watch                                 | Should   |
| SW-08 | Watch complication showing current surah                     | Should   |
| SW-09 | Download surahs to watch for standalone playback             | Could    |
| SW-10 | Standalone Bluetooth headphone playback without phone        | Could    |
| SW-11 | Ambient sounds toggle from watch                             | Could    |
| SW-12 | Queue view on watch                                          | Could    |


### Non-Functional Requirements


| ID       | Requirement                                              | Priority |
| -------- | -------------------------------------------------------- | -------- |
| SW-NF-01 | Watch app launches in < 2 seconds                        | Must     |
| SW-NF-02 | Remote control commands execute in < 500ms               | Must     |
| SW-NF-03 | Watch app uses < 30MB memory                             | Should   |
| SW-NF-04 | Watch app bundle < 20MB (well within 75MB watchOS limit) | Should   |
| SW-NF-05 | Minimal battery impact when used as remote control       | Must     |
| SW-NF-06 | State syncs within 1 second of phone state change        | Should   |


## Implementation Phases

### Phase 0: Research & Proof of Concept

1. Set up `rn-watch-connect` in the Expo project (requires `expo prebuild`)
2. Add a minimal watchOS target in Xcode with SwiftUI
3. Verify bidirectional `WCSession` messaging between RN and SwiftUI
4. Display a "Hello from Bayaan" screen on Apple Watch simulator
5. Send a play/pause command from watch → phone and verify it triggers `ExpoAudioService`
6. Document Xcode project setup steps for reproducibility

**Exit criteria:** Watch sends a message, phone receives it and toggles playback

### Phase 1: Apple Watch Remote Control

1. **Phone side (React Native):**
  - Add native module (or `rn-watch-connect`) for WatchConnectivity
  - Broadcast playback state changes to watch via `updateApplicationContext`
  - Handle incoming commands (play, pause, next, prev, seek)
  - Send reciter/surah metadata to watch
2. **Watch side (SwiftUI):**
  - Now Playing screen with surah name, reciter, progress, controls
  - Play/pause, next/prev buttons
  - Digital Crown volume control
  - Receive and display application context updates

### Phase 2: Watch Navigation & Selection

1. **Watch side:**
  - Surah list screen (scrollable, tappable)
  - Reciter list screen with images
  - Send "play surah X by reciter Y" commands to phone
2. **Phone side:**
  - Handle surah/reciter selection commands from watch
  - Sync available reciters and surah list to watch via `transferUserInfo`

### Phase 3: Complications

1. Watch face complication showing current surah name
2. Complication showing reciter name or playback state
3. Tapping complication opens the Bayaan watch app

### Phase 4: Wear OS Remote Control

1. Set up `react-native-wear-connectivity` in the Android project
2. Create Wear OS module (Kotlin + Jetpack Compose for Wear OS)
3. Mirror Phase 1-2 functionality for Wear OS
4. Use `Horologist` media toolkit for standard media UI patterns

### Phase 5: Standalone Playback (Optional, High Effort)

1. Implement file transfer to download surahs to watch storage
2. watchOS: `AVQueuePlayer` + `WKExtendedRuntimeSession` for background audio
3. Wear OS: `Media3` / `ExoPlayer` with `MediaSessionService`
4. Download management UI on watch (limited storage awareness)
5. Handle Bluetooth headphone routing

**Warning:** Standalone playback is the most complex phase. watchOS background download reliability is a known ecosystem-wide problem. Even Overcast and Spotify struggle with this. Consider this phase carefully before committing.

## Open Questions

1. **Native developer availability** — Watch apps require Swift (watchOS) and Kotlin (Wear OS) expertise. Can the current team handle this, or is it outsourced?
2. **Expo prebuild persistence** — How to preserve the watchOS Xcode target across `expo prebuild --clean` runs? Config plugin or committed `ios/` directory?
3. **Which platform first?** — Apple Watch has a larger installed base for this demographic, but Wear OS is easier to bridge from React Native. Recommend Apple Watch first.
4. **Standalone playback worth the effort?** — Given watchOS download reliability issues, is remote control sufficient for v1?
5. **Mushaf on watch?** — Screen is too small for meaningful Quran text display. Skip for watch.
6. **RTL support on watch?** — SwiftUI handles RTL well natively. Verify Arabic text rendering on both platforms.

## Market Context

No major Quran app currently offers full standalone audio playback on smartwatches. Existing apps (Muslim Pro, Quran Explorer) focus on complications and basic info display. A well-executed Bayaan watch app with remote control + standalone playback would be a differentiator.

## Dependencies

- `rn-watch-connect` or custom native module for watchOS bridge
- `react-native-wear-connectivity` for Wear OS bridge
- Swift/SwiftUI expertise for watchOS app
- Kotlin/Compose expertise for Wear OS app
- Expo `prebuild` workflow (cannot use Expo Go)

## Success Criteria

1. User can control phone playback from Apple Watch (play/pause/skip)
2. Watch displays current surah and reciter in real-time
3. Commands execute with < 500ms latency
4. Watch app is stable and doesn't crash
5. Minimal battery impact on watch when used as remote
6. (Phase 5) User can listen to downloaded surahs from watch via Bluetooth headphones

## References

- [react-native-watch-connectivity](https://github.com/watch-connectivity/react-native-watch-connectivity)
- [rn-watch-connect](https://github.com/CRIIPI11/rn-watch-connect)
- [react-native-wear-connectivity](https://github.com/fabOnReact/react-native-wear-connectivity)
- [Apple WatchConnectivity Documentation](https://developer.apple.com/documentation/watchconnectivity)
- [Wear OS Media Guide](https://developer.android.com/media/implement/surfaces/wear-os)
- [Horologist Media Toolkit](https://github.com/google/horologist)
- [Apple TV & Android TV Feature Doc](./tv-app.md) — sibling feature for large-screen platforms

---

*Created: 2026-02-20*