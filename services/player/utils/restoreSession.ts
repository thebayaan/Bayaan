import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {usePlayerStore} from '@/services/player/store/playerStore';
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

/**
 * Waits for playerStore to finish hydrating from AsyncStorage.
 * Returns immediately if already hydrated.
 */
function waitForPlayerStoreHydration(): Promise<void> {
  return new Promise(resolve => {
    if (usePlayerStore.persist.hasHydrated()) {
      resolve();
      return;
    }
    const unsub = usePlayerStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
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
    // Wait for playerStore to hydrate from AsyncStorage so we can read
    // the persisted queue (important for upload tracks).
    await waitForPlayerStoreHydration();

    const persistedState = usePlayerStore.getState();
    const persistedTrack =
      persistedState.queue.tracks[persistedState.queue.currentIndex];

    // Upload tracks aren't tracked in recentlyPlayedStore, so restore from
    // the persisted playerStore queue directly.
    if (persistedTrack?.isUserUpload) {
      const startPosition =
        persistedState.playback.position > 0
          ? persistedState.playback.position
          : 0;

      persistedState.updatePlaybackState({
        state: 'paused',
        position: startPosition,
        duration: persistedState.playback.duration,
      });

      if (__DEV__) {
        console.log(
          '[RestoreSession] Restored upload track from persisted queue',
          {
            title: persistedTrack.title,
            position: Math.round(startPosition),
          },
        );
      }

      loadAudioInBackground(persistedTrack.url, startPosition);
      return;
    }

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

/** Loads the audio source and seeks to position. Runs after store is populated. */
function loadAudioInBackground(url: string, startPosition: number) {
  // Use setTimeout to defer off the critical startup path
  setTimeout(async () => {
    try {
      await expoAudioService.loadTrack(url);
      if (startPosition > 0) {
        await expoAudioService.seekTo(startPosition);
      }
      if (__DEV__) {
        console.log('[RestoreSession] Phase 2: Audio loaded and seeked');
      }
    } catch (error) {
      // Non-fatal — user can still tap the card to replay
      if (__DEV__) {
        console.debug('[RestoreSession] Background audio load failed:', error);
      }
    }
  }, 100);
}
