import type {Track} from '@/types/audio';
import {Surah} from '@/data/surahData';
import {
  getReciterById,
  getSurahById,
  getAvailableSurahsForRewayat,
} from '@/services/dataService';
import {createTracksForReciter} from '@/utils/track';
import {generateSmartAudioUrl} from '@/utils/audioUtils';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';

export interface ResumeRecentParams {
  reciterId: string;
  surahId: number;
  rewayatId?: string;
  startPosition: number;
  // Index of the entry in recentlyPlayedStore.recentTracks.
  recentIndex: number;
  updateQueue: (
    tracks: Track[],
    currentIndex?: number,
    startPosition?: number,
  ) => Promise<void>;
}

// @ai-start
/**
 * Moves the resumed entry to the front of the recents list.
 *
 * It is found by what it is, once the queue has loaded. By then a progress
 * tick for the track that just started can already have moved it to the
 * front, and the place it had when it was pressed belongs to another card:
 * that card was the one promoted. The place it had is only used when the
 * entry cannot be found by reciter, surah and rewayah.
 *
 * An entry saved without a rewayah plays the queued one, and the tick that
 * moves it to the front gives it that rewayah, so either one is its own.
 */
function promoteResumed(
  reciterId: string,
  surahId: number,
  rewayatId: string | undefined,
  queuedRewayatId: string,
  pressedIndex: number,
): void {
  const {recentTracks, resumeChain} = useRecentlyPlayedStore.getState();
  const index = recentTracks.findIndex(
    t =>
      !t.isUserUpload &&
      t.reciter?.id === reciterId &&
      t.surah?.id === surahId &&
      ((t.rewayatId || '') === (rewayatId || '') ||
        t.rewayatId === queuedRewayatId),
  );
  resumeChain(index !== -1 ? index : pressedIndex);
}
// @ai-end

/**
 * Resumes a recently played (non upload) entry: queues the whole rewayah
 * starting at the surah, at the saved position, and moves the entry to the
 * front of the recents list.
 */
export async function resumeRecent({
  reciterId,
  surahId,
  rewayatId,
  startPosition,
  recentIndex,
  updateQueue,
}: ResumeRecentParams): Promise<void> {
  const [reciter, surah] = await Promise.all([
    getReciterById(reciterId),
    getSurahById(surahId),
  ]);

  if (!reciter || !surah) {
    console.error('Could not find reciter or surah');
    return;
  }

  const rewayatToUseId = rewayatId || reciter.rewayat[0]?.id;
  if (!rewayatToUseId) {
    console.error('Could not determine rewayat ID');
    return;
  }

  const availableSurahIds = await getAvailableSurahsForRewayat(rewayatToUseId);

  const allSurahsForRewayat = availableSurahIds
    .map(id => getSurahById(id))
    .filter((s): s is Surah => s !== undefined);

  if (allSurahsForRewayat.length === 0) {
    console.error('No available surahs found for this rewayat');
    return;
  }

  const startIndex = allSurahsForRewayat.findIndex(s => s.id === surahId);

  if (startIndex === -1) {
    const track = await createTracksForReciter(
      reciter,
      [surah],
      rewayatToUseId,
    );
    if (!track || track.length === 0) {
      console.error('Failed to create fallback track');
      return;
    }
    await updateQueue(track, 0, startPosition);
    promoteResumed(reciterId, surahId, rewayatId, rewayatToUseId, recentIndex); // @ai
    return;
  }

  const artwork = getReciterArtwork(reciter);

  const reorderedSurahs = [
    allSurahsForRewayat[startIndex],
    ...allSurahsForRewayat.slice(startIndex + 1),
    ...allSurahsForRewayat.slice(0, startIndex),
  ];

  const allTracks = reorderedSurahs.map(s => ({
    id: `${reciter.id}:${s.id}`,
    url: generateSmartAudioUrl(reciter, s.id.toString(), rewayatToUseId),
    title: s.name,
    artist: reciter.name,
    reciterId: reciter.id,
    artwork,
    surahId: s.id.toString(),
    reciterName: reciter.name,
    rewayatId: rewayatToUseId,
  }));

  await updateQueue(allTracks, 0, startPosition);
  promoteResumed(reciterId, surahId, rewayatId, rewayatToUseId, recentIndex); // @ai
}
