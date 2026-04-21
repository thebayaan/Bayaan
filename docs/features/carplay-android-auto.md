# Feature: Apple CarPlay & Android Auto Support

**Status:** Planned
**Priority:** High
**Complexity:** High
**Created:** 2026-02-20

## Overview

Add Apple CarPlay and Android Auto support to Bayaan, allowing users to browse reciters, select surahs, and control Quran playback directly from their car's infotainment display. As an audio-focused app, Bayaan is a strong candidate for both platforms' audio app templates.

## User Story

As a user driving with my phone connected to my car, I want to browse reciters and play Quran surahs through my car's display, so that I can listen safely without touching my phone.

## Platform Requirements

### Apple CarPlay

**Entitlement:** `com.apple.developer.carplay-audio` (must be requested from Apple, ~1 month approval)

**Key requirements:**
- Scene-based architecture: `CarPlaySceneDelegate` alongside the app's main scene
- `Info.plist` must declare `UIApplicationSceneManifest` with both phone and CarPlay scene roles
- Audio category already configured (`playback` mode with background audio)
- CarPlay-specific templates (no custom UI — Apple provides list/grid/now-playing templates)

**Testing:** iOS Simulator > I/O > External Displays > CarPlay

### Android Auto

**Key requirements:**
- `automotive_app_desc.xml` resource descriptor
- `AndroidManifest.xml` meta-data entry for `com.google.android.gms.car.application`
- MediaSession integration (already partially in place via `expo-media-control`)
- Media browse tree for the Android Auto UI to query

**Testing:** Desktop Head Unit (DHU) from Android SDK Manager

## Technical Foundation (Already Exists)

Bayaan already has significant infrastructure that CarPlay/Android Auto builds on:

| Component | Status | File |
|-----------|--------|------|
| Background audio | Done | `app.config.js` (UIBackgroundModes: audio) |
| Media session / lock screen | Done | `services/audio/LockScreenService.ts` |
| Remote commands (play/pause/skip/seek) | Done | `LockScreenService.ts` |
| Metadata sync (title, artist, artwork) | Done | `LockScreenService.ts` |
| Foreground service (Android) | Done | `AndroidManifest.xml` |
| Player state management | Done | `services/player/store/playerStore.ts` |
| Queue management | Done | `services/player/store/playerStore.ts` |

## Architecture

### Library

Use `@g4rb4g3/react-native-carplay` — the Expo-compatible fork of `react-native-carplay` that supports both iOS CarPlay and Android Auto with a unified TypeScript API.

```bash
npm install @g4rb4g3/react-native-carplay
```

### Integration Pattern

```
┌──────────────────────────────────────────────────┐
│  Zustand Stores (playerStore, queueStore)        │
│  Source of truth for all playback state           │
└────────────┬──────────────────┬──────────────────┘
             │                  │
    ┌────────▼────────┐  ┌─────▼──────────────────┐
    │ LockScreenService│  │ CarPlayService (NEW)   │
    │ (existing)       │  │ Singleton              │
    │ Lock screen /    │  │ CarPlay & Android Auto │
    │ notification     │  │ templates & commands   │
    └─────────────────┘  └────────────────────────┘
```

### CarPlayService Singleton

New file: `services/carplay/CarPlayService.ts`

```typescript
import CarPlay, {
  ListTemplate,
  TabBarTemplate,
  NowPlayingTemplate,
} from '@g4rb4g3/react-native-carplay';

class CarPlayService {
  private static instance: CarPlayService;
  private isConnected = false;

  static getInstance(): CarPlayService {
    if (!this.instance) this.instance = new CarPlayService();
    return this.instance;
  }

  initialize(): void {
    CarPlay.onConnect(() => {
      this.isConnected = true;
      this.presentRootTemplate();
    });

    CarPlay.onDisconnect(() => {
      this.isConnected = false;
    });

    // Subscribe to playerStore for state sync
    playerStore.subscribe((state) => {
      if (this.isConnected) this.syncNowPlaying(state);
    });
  }

  private presentRootTemplate(): void {
    // TabBar with: Browse Reciters | Now Playing | Queue
    const tabBar = new TabBarTemplate({
      templates: [
        this.buildReciterListTemplate(),
        this.buildNowPlayingTemplate(),
      ],
    });
    CarPlay.setRootTemplate(tabBar);
  }

  private buildReciterListTemplate(): ListTemplate {
    // Reciters → Rewayat → Surahs drill-down
  }

  private buildNowPlayingTemplate(): NowPlayingTemplate {
    // Synced from playerStore state
  }

  private syncNowPlaying(state: PlayerState): void {
    // Update metadata and playback state on CarPlay display
  }
}
```

### Browse Hierarchy

```
Tab Bar
├── Browse (ListTemplate)
│   ├── Reciter A (ListTemplate)
│   │   ├── Hafs A'n Asim - Murattal (ListTemplate)
│   │   │   ├── Al-Fatiha → plays surah
│   │   │   ├── Al-Baqarah → plays surah
│   │   │   └── ...
│   │   └── Other rewayat...
│   ├── Reciter B
│   └── ...
└── Now Playing (NowPlayingTemplate)
    ├── Surah name + reciter
    ├── Play/Pause
    ├── Previous / Next track
    ├── Skip forward / backward
    └── Progress bar
```

### Template Constraints

CarPlay and Android Auto enforce strict UI limits for driver safety:

- **List items:** Max ~12 visible items (scrollable, but limited depth)
- **Template depth:** Max 5 levels deep on iOS, varies on Android
- **No custom views:** Must use platform-provided templates only
- **No frequent updates:** Avoid rapid template refreshes (causes jank)
- **Images:** Must be pre-sized; CarPlay uses small thumbnails

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| CP-01 | User can browse reciters from car display | Must |
| CP-02 | User can drill into rewayat and select a surah to play | Must |
| CP-03 | Now Playing screen shows surah name, reciter, and artwork | Must |
| CP-04 | Play/pause/skip controls work from car display | Must |
| CP-05 | Previous/next track advances through queue | Must |
| CP-06 | Playback state syncs between phone and car display | Must |
| CP-07 | CarPlay/Auto gracefully handles disconnect mid-playback | Must |
| CP-08 | Queue continues playing when CarPlay/Auto disconnects | Must |
| CP-09 | Reciter images appear as thumbnails in browse lists | Should |
| CP-10 | Search for reciters or surahs from car display | Could |
| CP-11 | Recently played section for quick access | Could |
| CP-12 | Favorites/playlists accessible from car display | Could |

### Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| CP-NF-01 | Template transitions feel responsive (<300ms) | Must |
| CP-NF-02 | No additional battery drain beyond normal playback | Must |
| CP-NF-03 | Works with both wired and wireless CarPlay/Auto | Should |
| CP-NF-04 | Ambient sounds continue working when connected | Should |

## Implementation Phases

### Phase 0: Apple Entitlement Request (Do First)

1. Request `com.apple.developer.carplay-audio` from Apple Developer portal
2. Timeline: ~1 month for approval (development can proceed in simulator)

### Phase 1: iOS CarPlay Setup

1. Install `@g4rb4g3/react-native-carplay`
2. Create config plugin for iOS Scene architecture:
   - `CarPlaySceneDelegate` in native iOS code
   - `UIApplicationSceneManifest` in `Info.plist`
   - CarPlay entitlement in `.entitlements` file
3. Verify library links and builds with `expo prebuild --platform ios`
4. Test basic connection in iOS Simulator CarPlay window

### Phase 2: Android Auto Setup

1. Create `android/app/src/main/res/xml/automotive_app_desc.xml`
2. Add meta-data to `AndroidManifest.xml`
3. Verify MediaSession token is accessible from `expo-media-control`
4. Test basic connection with Desktop Head Unit (DHU)

### Phase 3: CarPlayService Core

1. Create `services/carplay/CarPlayService.ts` singleton
2. Implement connect/disconnect lifecycle
3. Build root TabBarTemplate with browse + now playing
4. Register in `AppInitializer.ts` (non-critical, low priority)

### Phase 4: Browse Hierarchy

1. Build reciter list from `reciters.json` data
2. Implement drill-down: Reciters → Rewayat → Surahs
3. Handle surah selection → trigger playback via `usePlayerActions`
4. Add reciter thumbnail images to list items
5. Optimize for CarPlay's item limits (pagination if needed)

### Phase 5: Now Playing & Playback Sync

1. Implement NowPlayingTemplate with metadata from playerStore
2. Subscribe to playerStore changes → update CarPlay display
3. Route CarPlay playback commands → playerStore actions
4. Sync progress/duration/playback state bidirectionally
5. Handle edge cases: queue end, errors, loading states

### Phase 6: Polish & Edge Cases

1. Handle app backgrounding while CarPlay is connected
2. Handle phone call interruptions
3. Test wireless CarPlay/Android Auto
4. Verify ambient sounds behavior during CarPlay session
5. Test with real car hardware (if available)
6. Add "Recently Played" section (if template space allows)

## Native Code Requirements

### iOS: Config Plugin or Manual Setup

**New file:** `plugins/withCarPlay.js` (Expo config plugin)

Responsible for:
- Adding `UIApplicationSceneManifest` to `Info.plist`
- Creating `CarPlaySceneDelegate.swift`
- Adding `com.apple.developer.carplay-audio` entitlement
- Modifying `AppDelegate` for Scene-based lifecycle

### Android: Resource & Manifest Changes

**New file:** `android/app/src/main/res/xml/automotive_app_desc.xml`
```xml
<?xml version="1.0" encoding="utf-8"?>
<automotive-app xmlns:android="http://schemas.android.com/apk/res/android">
</automotive-app>
```

**AndroidManifest.xml addition:**
```xml
<meta-data
  android:name="com.google.android.gms.car.application"
  android:resource="@xml/automotive_app_desc" />
```

## Key Files (New)

| File | Purpose |
|------|---------|
| `services/carplay/CarPlayService.ts` | Main singleton coordinating CarPlay/Auto |
| `services/carplay/templates.ts` | Template builders (browse, now playing) |
| `services/carplay/types.ts` | TypeScript interfaces |
| `plugins/withCarPlay.js` | Expo config plugin for native setup |

## Key Files (Modified)

| File | Change |
|------|--------|
| `app.config.js` | Add `withCarPlay` plugin |
| `services/AppInitializer.ts` | Register CarPlayService |
| `package.json` | Add `@g4rb4g3/react-native-carplay` |
| `android/app/src/main/AndroidManifest.xml` | Add automotive meta-data |

## Risks & Considerations

| Risk | Mitigation |
|------|------------|
| Apple entitlement rejection | Apply early; Bayaan is a clear audio app candidate |
| Scene architecture breaks Expo | Use config plugin; test thoroughly after prebuild |
| expo-media-control conflicts | Test MediaSession token sharing; may need patch |
| Template update performance | Batch updates, avoid rapid syncs from store |
| Ambient audio on CarPlay | Test early; ambient uses separate AudioPlayer |

## Dependencies

- `@g4rb4g3/react-native-carplay` (or `react-native-carplay` v2.4+)
- Apple CarPlay entitlement approval
- Expo development build (not managed workflow)

## Success Criteria

1. User can browse reciters and play a surah entirely from CarPlay/Android Auto
2. Now Playing displays correct surah name, reciter, and artwork
3. Play/pause/skip/seek controls work from car display
4. Playback continues seamlessly when CarPlay/Auto disconnects
5. No crashes or UI glitches during connect/disconnect cycles
6. Works on both wired and wireless connections

## References

- [react-native-carplay docs](https://birkir.dev/react-native-carplay/)
- [@g4rb4g3/react-native-carplay (Expo fork)](https://www.npmjs.com/package/@g4rb4g3/react-native-carplay)
- [Apple CarPlay Audio App Guide](https://developer.apple.com/carplay/documentation/)
- [Android Auto Developer Guide](https://developer.android.com/training/cars)
- [expo-config-carplay-plugin](https://github.com/KMalkowski/expo-config-carplay-plugin)
- [Expo Scene Discussion #24354](https://github.com/expo/expo/discussions/24354)

---

*Created: 2026-02-20*
