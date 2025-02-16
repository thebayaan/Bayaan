import {Reciter} from '@/data/reciterData';
import {Track} from '@/types/audio';
import {Surah} from '@/data/surahData';
import {generateAudioUrl} from './audioUtils';
import {getReciterArtwork} from '@/utils/artworkUtils';

/**
 * Filters and returns available surahs for a given rewayat
 * @param surahs - Complete list of surahs
 * @param rewayatSurahList - List of surah IDs available in the rewayat
 * @returns Filtered list of available surahs
 */
export function getAvailableSurahs(
  surahs: Surah[],
  rewayatSurahList?: (number | null)[],
): Surah[] {
  if (!rewayatSurahList) return surahs;
  const validSurahIds = rewayatSurahList.filter(
    (id): id is number => id !== null,
  );
  return surahs.filter(surah => validSurahIds.includes(surah.id));
}

/**
 * Creates a Track object for a specific surah and reciter
 * @param reciter - Reciter object
 * @param surah - Surah object
 * @param rewayatId - Optional specific rewayat ID
 * @returns Track object
 */
export async function createTrack(
  reciter: Reciter,
  surah: Surah,
  rewayatId?: string,
): Promise<Track> {
  const url = generateAudioUrl(reciter, String(surah.id), rewayatId);
  return {
    id: `${reciter.id}-${surah.id}`,
    url,
    title: surah.name,
    artist: reciter.name,
    artwork: getReciterArtwork(reciter),
    surahId: String(surah.id),
    reciterId: reciter.id,
    reciterName: reciter.name,
    duration: 0, // Will be set by TrackPlayer
    description: `${surah.translated_name_english} - ${surah.name}`,
    rewayatId: rewayatId || reciter.rewayat[0].id,
  };
}

/**
 * Creates Track objects for multiple surahs
 * @param reciter - Reciter object
 * @param surahs - Array of Surah objects
 * @param rewayatId - Optional specific rewayat ID
 * @returns Array of Track objects
 */
export async function createTracksForReciter(
  reciter: Reciter,
  surahs: Surah[],
  rewayatId?: string,
): Promise<Track[]> {
  return Promise.all(
    surahs.map(surah => createTrack(reciter, surah, rewayatId)),
  );
}

/**
 * Creates Track objects for a range of surahs, filtering by available surahs
 * @param reciter - Reciter object
 * @param startSurah - Starting surah number
 * @param endSurah - Ending surah number
 * @param allSurahs - Complete list of surahs
 * @param rewayatId - Optional specific rewayat ID
 * @returns Array of Track objects for available surahs in the range
 */
export async function createTracksForRange(
  reciter: Reciter,
  startSurah: number,
  endSurah: number,
  allSurahs: Surah[],
  rewayatId?: string,
): Promise<Track[]> {
  // Get the rewayat to use
  const rewayat = rewayatId
    ? reciter.rewayat.find(r => r.id === rewayatId)
    : reciter.rewayat[0];

  if (!rewayat) {
    throw new Error('No valid rewayat found for reciter');
  }

  // Get surahs in the specified range
  const surahsInRange = allSurahs.filter(
    surah => surah.id >= startSurah && surah.id <= endSurah,
  );

  // Filter by available surahs in the rewayat
  const availableSurahs = getAvailableSurahs(surahsInRange, rewayat.surah_list);

  // Create tracks for available surahs
  return createTracksForReciter(reciter, availableSurahs, rewayatId);
}

/**
 * Shuffles an array of tracks
 * @param tracks - Array of tracks to shuffle
 * @returns Shuffled array of tracks
 */
export function shuffleTracks<T extends Track>(tracks: T[]): T[] {
  const shuffled = [...tracks];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
