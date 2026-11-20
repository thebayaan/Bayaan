/**
 * Mushaf Audio Utilities
 *
 * Resolves audio URLs for mushaf playback.
 */

import {RECITERS, type Reciter} from '@/data/reciterData';
import {audioFileUrl} from '@/utils/audioFileUrl';

/**
 * Resolve the audio URL for a given rewayat and surah number.
 */
export function resolveMushafAudioUrl(
  rewayatId: string,
  surahNumber: number,
): string {
  const reciter = RECITERS.find(r => r.rewayat.some(rw => rw.id === rewayatId));
  if (reciter) {
    const rewayat = reciter.rewayat.find(rw => rw.id === rewayatId);
    if (rewayat) {
      // @ai-start
      const remoteUrl = audioFileUrl(rewayat, surahNumber);
      // A recording that was replaced on the CDN (its URL carries a
      // version): a file downloaded before that is the old recording, which
      // the verse timings no longer fit, and a download does not say which
      // recording it holds. Verse-by-verse audio is streamed for those.
      if (remoteUrl.includes('?v=')) return remoteUrl;
      // Otherwise the downloaded file when there is one, as the main player
      // does: the mushaf used to stream a downloaded surah again, and could
      // not play it offline.
      try {
        // Required here, not imported: audioUtils loads the download store
        // and with it the main player's modules, which must not be loaded
        // (or form an import cycle) by importing the mushaf player store.
        const {generateSmartAudioUrl} =
          require('@/utils/audioUtils') as typeof import('@/utils/audioUtils');
        return generateSmartAudioUrl(reciter, String(surahNumber), rewayatId);
      } catch (error) {
        console.warn('[MushafAudio] No download lookup, streaming:', error);
        return remoteUrl;
      }
      // @ai-end
    }
  }

  throw new Error(`Cannot resolve audio URL for rewayat ${rewayatId}`);
}

/**
 * Find the reciter and rewayat info for a given rewayat ID.
 */
export function findReciterForRewayat(rewayatId: string): {
  reciter: Reciter;
  rewayatName: string;
  style: string;
} | null {
  for (const reciter of RECITERS) {
    const rewayat = reciter.rewayat.find(rw => rw.id === rewayatId);
    if (rewayat) {
      return {
        reciter,
        rewayatName: rewayat.name,
        style: rewayat.style,
      };
    }
  }
  return null;
}
