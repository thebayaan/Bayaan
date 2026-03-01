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
    const recentTracks = useRecentlyPlayedStore.getState().recentTracks;
    if (recentTracks.length === 0) return;

    const {reciter, surah, rewayatId, progress, duration} = recentTracks[0];
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
