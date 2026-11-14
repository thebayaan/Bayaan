import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {
  usePlayerStore,
  currentPlayOpId,
} from '@/services/player/store/playerStore';
import {
  getAvailableSurahsForRewayat,
  getSurahById,
} from '@/services/dataService';
import {Surah} from '@/data/surahData';
import {generateSmartAudioUrl} from '@/utils/audioUtils';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {expoAudioService} from '@/services/audio/ExpoAudioService';
import {Track} from '@/types/audio';
import {useUploadsStore} from '@/store/uploadsStore';
import {createUserUploadTrack} from '@/utils/track';
import {hasCarReplacedQueue} from '@/services/car/sessionGate';
import {trackRestoreLoad, pendingRestoreLoad} from './restoreLoad'; // @ai
import {resolveTrackUrl, registerTrackUrlResolver} from './trackUrl'; // @ai

/**
 * Waits for playerStore to finish hydrating from AsyncStorage.
 * Returns immediately if already hydrated. Falls back after a timeout
 * to prevent the splash screen from hanging indefinitely on Android
 * where AsyncStorage (SQLite-backed) can be slow or miss the event.
 */
function waitForPlayerStoreHydration(timeoutMs = 3000): Promise<void> {
  return new Promise(resolve => {
    if (usePlayerStore.persist.hasHydrated()) {
      resolve();
      return;
    }

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const unsub = usePlayerStore.persist.onFinishHydration(() => {
      unsub();
      settle();
    });

    setTimeout(() => {
      if (__DEV__ && !settled) {
        console.warn(
          `[RestoreSession] playerStore hydration timed out after ${timeoutMs}ms, continuing`,
        );
      }
      settle();
    }, timeoutMs);
  });
}

/**
 * Phase 1: Populates the player store queue and playback state from
 * persisted recentTracks[0]. This makes the floating player render
 * immediately showing the last track. Does NOT load audio.
 *
 * Phase 2: Loads the audio source and seeks to the saved position
 * so that tapping play works. Run this after app is ready.
 */
export async function restoreSession(): Promise<void> {
  try {
    // @ai From here on the player chooses each track's url when it loads it.
    registerTrackUrlResolver();
    // Wait for playerStore to hydrate from AsyncStorage so we can read
    // the persisted queue (important for upload tracks).
    await waitForPlayerStoreHydration();

    const persistedState = usePlayerStore.getState();
    const persistedTrack =
      persistedState.queue.tracks[persistedState.queue.currentIndex];

    // A car request (CarPlay / Android Auto) already replaced the queue.
    if (hasCarReplacedQueue()) return;

    // @ai-start
    // The queue that was playing is saved with the player store: restore
    // that. Rebuilding it from the last recent card (below) replaced a
    // playlist, Loved or a hand-made queue with "this reciter's whole
    // Quran", and restored a different track whenever the recent cards had
    // fallen out of step with the player.
    if (persistedTrack) {
      const restored = restorePersistedQueue(
        persistedState.queue.tracks,
        persistedState.queue.currentIndex,
      );
      if (restored) {
        const startPosition = Math.max(0, persistedState.playback.position);
        persistedState.updateQueueState({
          tracks: restored.tracks,
          currentIndex: restored.index,
          total: restored.tracks.length,
        });
        persistedState.updatePlaybackState({
          state: 'paused',
          position: startPosition,
          duration: persistedState.playback.duration,
        });

        if (__DEV__) {
          console.log('[RestoreSession] Restored the saved queue', {
            title: restored.tracks[restored.index].title,
            position: Math.round(startPosition),
            queueSize: restored.tracks.length,
          });
        }

        loadAudioInBackground(
          restored.tracks[restored.index].url,
          startPosition,
        );
        return;
      }
    }
    // @ai-end

    const recentTracks = useRecentlyPlayedStore.getState().recentTracks;
    if (recentTracks.length === 0) return;

    const recent = recentTracks[0];

    // Handle upload entry in recentlyPlayedStore
    if (recent.isUserUpload && recent.userRecitationId) {
      const recitation = useUploadsStore
        .getState()
        .recitations.find(r => r.id === recent.userRecitationId);
      if (recitation) {
        const uploadTrack = createUserUploadTrack(recitation);
        const startPosition = recent.progress * recent.duration;

        const playerStore = usePlayerStore.getState();
        playerStore.updateQueueState({tracks: [uploadTrack], currentIndex: 0});
        playerStore.updatePlaybackState({
          position: startPosition,
          duration: recent.duration,
          state: 'paused',
        });

        if (__DEV__) {
          console.log('[RestoreSession] Restored upload from recentTracks', {
            title: uploadTrack.title,
            position: Math.round(startPosition),
          });
        }

        loadAudioInBackground(uploadTrack.url, startPosition);
        return;
      }
      // Upload file was deleted — fall through to next recent track or bail
      if (recentTracks.length <= 1) return;
      // Could try recentTracks[1] but keep it simple for now
      return;
    }

    const {reciter, surah, rewayatId, progress, duration} = recent;
    const startPosition = progress * duration;

    // Build the full queue for auto-advance
    const availableSurahIds = await getAvailableSurahsForRewayat(rewayatId);
    const allSurahs = availableSurahIds
      .map(id => getSurahById(id))
      .filter((s): s is Surah => s !== undefined);

    const startIndex = allSurahs.findIndex(s => s.id === surah.id);
    const artwork = getReciterArtwork(reciter);

    let tracks: Track[];
    if (startIndex !== -1 && allSurahs.length > 0) {
      const reorderedSurahs = [
        allSurahs[startIndex],
        ...allSurahs.slice(startIndex + 1),
        ...allSurahs.slice(0, startIndex),
      ];
      tracks = reorderedSurahs.map(s => ({
        id: `${reciter.id}:${s.id}`,
        url: generateSmartAudioUrl(reciter, s.id.toString(), rewayatId),
        title: s.name,
        artist: reciter.name,
        reciterId: reciter.id,
        artwork,
        surahId: s.id.toString(),
        reciterName: reciter.name,
        rewayatId,
      }));
    } else {
      // Fallback: single track
      tracks = [
        {
          id: `${reciter.id}:${surah.id}`,
          url: generateSmartAudioUrl(reciter, surah.id.toString(), rewayatId),
          title: surah.name,
          artist: reciter.name,
          reciterId: reciter.id,
          artwork,
          surahId: surah.id.toString(),
          reciterName: reciter.name,
          rewayatId,
        },
      ];
    }

    // The await above gave a car request time to take over the queue.
    if (hasCarReplacedQueue()) return;

    // Phase 1: Populate store state (floating player renders immediately)
    const playerStore = usePlayerStore.getState();
    playerStore.updateQueueState({tracks, currentIndex: 0});
    playerStore.updatePlaybackState({
      position: startPosition,
      duration,
      state: 'paused',
    });

    if (__DEV__) {
      console.log('[RestoreSession] Phase 1: Store populated', {
        reciter: reciter.name,
        surah: surah.name,
        position: Math.round(startPosition),
        queueSize: tracks.length,
      });
    }

    // Phase 2: Load audio source in background (non-blocking)
    loadAudioInBackground(tracks[0].url, startPosition);
  } catch (error) {
    console.error('[RestoreSession] Error restoring session:', error);
  }
}

// @ai-start
/**
 * The saved queue, made playable again: every url is chosen afresh (a local
 * path saved before an iOS app update points into the old app container;
 * downloads may have been added or removed), and uploads that were deleted
 * are dropped. Returns null when the current track itself is gone, so the
 * caller falls back to the recent cards.
 */
function restorePersistedQueue(
  tracks: Track[],
  currentIndex: number,
): {tracks: Track[]; index: number} | null {
  const uploads = useUploadsStore.getState().recitations;
  const kept: Track[] = [];
  let index = -1;
  tracks.forEach((track, i) => {
    if (
      track.isUserUpload &&
      !uploads.some(r => r.id === track.userRecitationId)
    ) {
      return;
    }
    if (i === currentIndex) index = kept.length;
    kept.push({...track, url: resolveTrackUrl(track)});
  });
  return index === -1 ? null : {tracks: kept, index};
}
// @ai-end

// @ai The in-flight phase 2 load lives in ./restoreLoad (the player store
// waits for it too). Re-exported for the callers that import it from here.
export {pendingRestoreLoad};

/**
 * Loads the audio source and seeks to position. Runs after store is populated.
 * Skips the load and seek once a newer play claimed a playOpId, so it cannot
 * replace or rewind a source that play started. Exported for tests.
 */
export function loadAudioInBackground(
  url: string,
  startPosition: number,
): void {
  const opId = currentPlayOpId();
  let settle: () => void = () => undefined;
  const load = new Promise<void>(resolve => {
    settle = resolve;
  });
  trackRestoreLoad(load); // @ai
  // Use setTimeout to defer off the critical startup path
  setTimeout(async () => {
    try {
      // @ai Inside the try, so the finally below still settles
      // pendingRestoreLoad() when a car request took the queue first.
      if (hasCarReplacedQueue()) return;
      if (currentPlayOpId() !== opId) return;
      await expoAudioService.loadTrack(url);
      if (currentPlayOpId() !== opId) return;
      if (startPosition > 0 && !hasCarReplacedQueue()) {
        await expoAudioService.seekTo(startPosition);
        // @ai-start
        // The player's first status after the load reports 0:00 and is
        // written to the store. Put the restored position back, or the
        // slider and the recent card show the start of the surah until
        // playback begins, and tapping the card restarts it from there.
        if (currentPlayOpId() === opId && !hasCarReplacedQueue()) {
          usePlayerStore.getState().updatePlaybackState({
            position: startPosition,
          });
        }
        // @ai-end
      }
      if (__DEV__) {
        console.log('[RestoreSession] Phase 2: Audio loaded and seeked');
      }
    } catch (error) {
      // Non-fatal — user can still tap the card to replay
      if (__DEV__) {
        console.debug('[RestoreSession] Background audio load failed:', error);
      }
    } finally {
      settle();
    }
  }, 100);
}
