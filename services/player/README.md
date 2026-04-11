# Player System

The player system is built on [expo-audio](https://docs.expo.dev/versions/latest/sdk/audio/) and consists of three layers: an audio engine singleton, a React bridge provider, and a Zustand store for state.

---

## Architecture

```
User action (e.g. tap play)
        │
        ▼
  playerStore.play()           ← Zustand store action
        │
        ▼
  expoAudioService.play()      ← Singleton service call
        │
        ▼
  AudioPlayer (expo-audio)     ← Native audio engine
        │
        ▼
  useAudioPlayerStatus()       ← Reactive status hook (in ExpoAudioProvider)
        │
        ▼
  playerStore.updatePlaybackState()  ← State written back to Zustand
```

---

## Core components

### `services/audio/ExpoAudioService.ts`

Singleton class wrapping the expo-audio `AudioPlayer`. Handles:

- Audio mode initialization (background playback, silent mode bypass)
- `play()`, `pause()`, `seekTo()`, `setRate()`, `loadUrl()`
- State listener pattern for non-React consumers
- Connected to the React `AudioPlayer` instance via `setPlayer()` called from the provider

Access via the exported singleton:

```typescript
import {expoAudioService} from '@/services/audio/ExpoAudioService';
```

### `services/audio/ExpoAudioProvider.tsx`

React provider that must be mounted at the app root (`app/_layout.tsx`). It:

- Creates the `AudioPlayer` instance via `useAudioPlayer(null)`
- Passes the instance to `ExpoAudioService` via `setPlayer()`
- Subscribes to reactive status updates with `useAudioPlayerStatus()`
- Writes progress, playback state, and track-end events back to `playerStore`
- Syncs ambient audio with main playback (pause/resume together)
- Handles lock screen controls via `LockScreenService`

### `services/player/store/playerStore.ts`

Zustand store (with AsyncStorage persistence) that owns all player state:

```typescript
interface UnifiedPlayerState {
  playback: {
    state: 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'ended';
    position: number;    // seconds
    duration: number;    // seconds
    rate: number;        // 0.5 – 2.0
    buffering: boolean;
  };
  queue: {
    tracks: Track[];
    currentIndex: number;
    total: number;
  };
  settings: {
    repeatMode: 'off' | 'track' | 'queue';
    sleepTimer: { enabled: boolean; duration: number } | null;
    skipSilence: boolean;
  };
  ui: {
    sheetMode: 'hidden' | 'full';
    isImmersive: boolean;
  };
}
```

Key actions:

- `play()`, `pause()`, `skipToNext()`, `skipToPrevious()`
- `updateQueue(tracks, startIndex)` — replaces queue and starts playback
- `addToQueue(tracks)`, `removeFromQueue(index)`, `moveInQueue(from, to)`
- `seekTo(position)`, `setRate(rate)`, `setRepeatMode(mode)`
- `setSleepTimer(durationMs)`, `clearSleepTimer()`

### `hooks/usePlayerActions.ts`

Zero-re-render hook for dispatching player actions. Preferred over direct store subscriptions in components that only need to trigger actions.

```typescript
const { play, pause, skipToNext, updateQueue } = usePlayerActions();
```

Use `usePlayerStore(selector)` only when a component needs to read and re-render on state changes.

---

## Directory structure

```
services/
├── audio/
│   ├── ExpoAudioService.ts      # Core audio engine singleton
│   ├── ExpoAudioProvider.tsx    # React bridge (mount at root)
│   ├── AmbientAudioService.ts   # Ambient sounds (second AudioPlayer)
│   ├── AudioCoordinator.ts      # Coordinates main vs mushaf audio
│   ├── LockScreenService.ts     # Lock screen / now-playing info
│   └── MushafAudioService.ts    # Mushaf verse-by-verse playback
└── player/
    ├── store/
    │   ├── playerStore.ts           # Main player state
    │   ├── downloadStore.ts         # Download state and progress
    │   ├── lovedStore.ts            # Loved/favourited tracks
    │   ├── recentlyPlayedStore.ts   # Recently played history
    │   ├── favoriteRecitersStore.ts # Favourite reciters
    │   └── progressStore.ts         # Playback progress persistence
    ├── types/
    │   └── state.ts                 # UnifiedPlayerState types
    └── utils/
        ├── storage.ts               # AsyncStorage helpers
        └── restoreSession.ts        # Session restore on app launch
```

---

## Adding a new player action

1. Add the action to `UnifiedPlayerState` in `services/player/types/state.ts`
2. Implement the action in `services/player/store/playerStore.ts`
3. Call `expoAudioService` methods as needed
4. Export via `usePlayerActions` if it should be zero-re-render accessible

---

## Ambient audio

Ambient sounds use a separate `AudioPlayer` instance managed by `AmbientAudioService`. The ambient player is independent of the main queue but syncs pause/resume state through `ExpoAudioProvider`. See [docs/features/ambient-sounds.md](../../docs/features/ambient-sounds.md) for details.

---

## Mushaf audio

The Mushaf reader uses `MushafAudioService` for verse-by-verse playback, coordinated through `AudioCoordinator` to prevent simultaneous playback with the main player. The active audio source is tracked in `AudioCoordinator.getActiveSource()`.

---

## Further reading

- [docs/features/player.md](../../docs/features/player.md) — full player feature documentation
- [docs/features/downloads.md](../../docs/features/downloads.md) — offline download system
- [docs/architecture/current-state.md](../../docs/architecture/current-state.md) — full architecture overview

