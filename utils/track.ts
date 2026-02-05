import {Reciter, RECITERS} from '@/data/reciterData';
import {Track} from '@/types/audio';
import {Surah} from '@/data/surahData';
import {generateSmartAudioUrl} from './audioUtils';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {resolveFilePath} from '@/services/downloadService';
import type {UploadedRecitation} from '@/types/uploads';
import {resolveRecitationPath} from '@/services/uploads/UploadsService';
import {getSurahById, getReciterName} from '@/services/dataService';

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
 * Uses smart URL generation to prefer local downloaded files over remote URLs
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
  const url = generateSmartAudioUrl(reciter, String(surah.id), rewayatId);
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
 * Creates a Track object for a downloaded file using local file path
 * @param reciter - Reciter object
 * @param surah - Surah object
 * @param filePath - Local file path (can be relative filename or absolute path)
 * @param rewayatId - Optional specific rewayat ID
 * @returns Track object with resolved absolute file path
 */
export function createDownloadedTrack(
  reciter: Reciter,
  surah: Surah,
  filePath: string,
  rewayatId?: string,
): Track {
  // Resolve the path to ensure it uses the current app container
  // This is necessary because iOS changes the container UUID on app updates
  const resolvedPath = resolveFilePath(filePath);

  return {
    id: `${reciter.id}-${surah.id}`,
    url: resolvedPath, // Use resolved absolute path
    title: surah.name,
    artist: reciter.name,
    artwork: getReciterArtwork(reciter),
    surahId: String(surah.id),
    reciterId: reciter.id,
    reciterName: reciter.name,
    rewayatId: rewayatId || reciter.rewayat[0].id,
    duration: 0, // Will be set by TrackPlayer
    description: `${surah.translated_name_english} - ${surah.name}`,
  };
}

/**
 * Creates a Track object from an uploaded recitation
 */
export function createUserUploadTrack(recitation: UploadedRecitation): Track {
  const url = resolveRecitationPath(recitation.filePath);

  // Build title from tags, fallback to original filename
  let title = recitation.originalFilename;
  if (recitation.type === 'surah' && recitation.surahNumber) {
    const surah = getSurahById(recitation.surahNumber);
    if (surah) title = surah.name;
  } else if (recitation.type === 'other' && recitation.title) {
    title = recitation.title;
  }

  // Build artist from reciter tags, fallback to 'My Recitations'
  let artist = 'My Recitations';
  let resolvedRewayatId: string | undefined;
  if (recitation.reciterId) {
    const name = getReciterName(recitation.reciterId);
    if (name) artist = name;

    // Resolve rewayah name to rewayat UUID so the player can look it up
    if (recitation.rewayah) {
      const reciter = RECITERS.find(r => r.id === recitation.reciterId);
      if (reciter) {
        const match = reciter.rewayat.find(
          rw =>
            rw.name === recitation.rewayah &&
            (!recitation.style || rw.style === recitation.style),
        );
        if (match) resolvedRewayatId = match.id;
      }
    }
  }

  return {
    id: `upload-${recitation.id}`,
    url,
    title,
    artist,
    artwork: '',
    surahId: recitation.surahNumber
      ? String(recitation.surahNumber)
      : undefined,
    reciterId: recitation.reciterId || '',
    reciterName: artist,
    rewayatId: resolvedRewayatId,
    duration: recitation.duration || 0,
    isUserUpload: true,
    userRecitationId: recitation.id,
  };
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
