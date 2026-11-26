// @ai-generated
import type {Track} from '@/types/audio';
import type {QueueState} from '@/services/player/types/state';

/**
 * True when `track` plays this surah of this reciter, in the same rewayah
 * when both name one. Every surah row and card reads its now-playing state
 * through this check, so the rows and the cards cannot drift apart.
 */
export function isTrackForSurah(
  track: Track | null | undefined,
  reciterId: string | undefined,
  surahId: number,
  rewayatId: string | undefined,
): boolean {
  if (!track || !reciterId) return false;
  const rewayatMatches =
    rewayatId && track.rewayatId ? rewayatId === track.rewayatId : true;
  return (
    track.reciterId === reciterId &&
    track.surahId === surahId.toString() &&
    rewayatMatches
  );
}

/** True when the queue's current track is this surah (see isTrackForSurah). */
export function isCurrentSurahTrack(
  queue: Pick<QueueState, 'tracks' | 'currentIndex'>,
  reciterId: string | undefined,
  surahId: number,
  rewayatId: string | undefined,
): boolean {
  const {tracks, currentIndex} = queue;
  const track =
    currentIndex >= 0 && currentIndex < tracks.length
      ? tracks[currentIndex]
      : null;
  return isTrackForSurah(track, reciterId, surahId, rewayatId);
}
