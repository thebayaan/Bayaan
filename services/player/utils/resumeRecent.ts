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
    useRecentlyPlayedStore.getState().resumeChain(recentIndex);
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
  useRecentlyPlayedStore.getState().resumeChain(recentIndex);
}
