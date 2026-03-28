/**
 * Mushaf Audio Utilities
 *
 * Resolves audio URLs for mushaf playback.
 */

import {RECITERS, type Reciter} from '@/data/reciterData';
import {generateAudioUrl} from '@/utils/audioUtils';

/**
 * Resolve the audio URL for a given rewayat and surah number.
 */
export function resolveMushafAudioUrl(
  rewayatId: string,
  surahNumber: number,
): string {
  const reciter = RECITERS.find(r => r.rewayat.some(rw => rw.id === rewayatId));
  if (reciter) {
    return generateAudioUrl(reciter, surahNumber.toString(), rewayatId);
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
