# Queue System

The queue in Bayaan is a flat array of `Track` objects inside `playerStore`. There is no separate queue service or context — the store is the single source of truth.

---

## Queue state

Queue state lives in `playerStore` under the `queue` slice:

```typescript
interface QueueState {
  tracks: Track[];       // All tracks in the current queue
  currentIndex: number;  // Index of the currently playing track
  total: number;         // Total number of tracks (= tracks.length)
}
```

Access via the store:
```typescript
import {usePlayerStore} from '@/services/player/store/playerStore';

const tracks = usePlayerStore(s => s.queue.tracks);
const currentIndex = usePlayerStore(s => s.queue.currentIndex);
const currentTrack = usePlayerStore(s => s.queue.tracks[s.queue.currentIndex]);
```

---

## Starting a new queue

To start playback of a new set of tracks, call `updateQueue`:

```typescript
import {usePlayerActions} from '@/hooks/usePlayerActions';

const {updateQueue} = usePlayerActions();

// Play from the beginning
await updateQueue(tracks, 0);

// Play from a specific surah (e.g. user tapped surah 18)
await updateQueue(allTracks, 17); // 0-indexed
```

`updateQueue` replaces the current queue, loads the track at `startIndex` into `ExpoAudioService`, and starts playback.

---

## Modifying the queue

```typescript
const {addToQueue, removeFromQueue, moveInQueue} = usePlayerActions();

// Add tracks to the end
addToQueue(newTracks);

// Remove a track by index
removeFromQueue(3);

// Reorder (e.g. drag-and-drop)
moveInQueue(fromIndex, toIndex);
```

---

## Navigation

```typescript
const {skipToNext, skipToPrevious, seekTo} = usePlayerActions();

skipToNext();              // Move to next track
skipToPrevious();          // Move to previous track
seekTo(120);               // Seek to 2 minutes in current track
```

---

## Repeat modes

| Mode | Behaviour |
|------|-----------|
| `'off'` | Queue plays to end then stops |
| `'track'` | Current track loops indefinitely |
| `'queue'` | Queue restarts from index 0 after the last track |

```typescript
const {setRepeatMode} = usePlayerActions();
setRepeatMode('track');
```

---

## Track shape

Tracks are defined in `types/audio.ts`:

```typescript
interface Track {
  id: string;
  url: string;               // Streaming URL or local file path
  title: string;             // Surah name
  artist: string;            // Reciter display name
  artwork?: string;          // Reciter image URL
  reciterId?: string;        // Used for download lookup and progress tracking
  surahId?: string;          // String-encoded surah number
  rewayatId?: string;
  isDownloaded?: boolean;    // True if a local file exists
  localPath?: string;        // Set by download system; resolved at play time
  isUserUpload?: boolean;    // True for user-uploaded recitations
  userRecitationId?: string; // For upload-specific progress tracking
}
```

When `localPath` is set, the player resolves the full file path at runtime using `resolveFilePath()` in `utils/audioUtils.ts` — this handles iOS path changes after app updates.

---

## Download integration

The player checks download state when loading a track. If the track has a `localPath` in `downloadStore`, playback switches to the local file automatically. No manual intervention is needed in queue management code.

---

## Queue persistence

The queue is persisted to AsyncStorage as part of `playerStore`. On app relaunch, `restoreSession.ts` restores the previous queue and seeks to the last known position (paused, not auto-playing).

The persisted snapshot includes:
- Full `tracks` array
- `currentIndex`
- Last known `position` and `duration`
