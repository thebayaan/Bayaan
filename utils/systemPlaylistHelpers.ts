import {
  SystemPlaylist,
  SystemPlaylistItem,
  getSystemPlaylistById as getPlaylistById,
} from '@/data/systemPlaylists';
import {Track} from '@/types/audio';
import {createTrack} from '@/utils/track';
import {getReciterById, getSurahById} from '@/services/dataService';

/**
 * Get a system playlist by ID
 */
export function getSystemPlaylistById(
  id: string,
): SystemPlaylist | undefined {
  return getPlaylistById(id);
}

/**
 * Validate that all items in a system playlist exist (surahs and reciters)
 * @param items - Array of system playlist items
 * @returns Object with validation result and any missing items
 */
export async function validateSystemPlaylistItems(
  items: SystemPlaylistItem[],
): Promise<{
  isValid: boolean;
  missingSurahs: number[];
  missingReciters: string[];
}> {
  const missingSurahs: number[] = [];
  const missingReciters: string[] = [];

  for (const item of items) {
    // Check if surah exists
    const surah = await getSurahById(item.surahId);
    if (!surah) {
      missingSurahs.push(item.surahId);
    }

    // Check if reciter exists (only for fully-curated playlists)
    if (item.reciterId) {
      const reciter = await getReciterById(item.reciterId);
      if (!reciter) {
        missingReciters.push(item.reciterId);
      }
    }
  }

  return {
    isValid: missingSurahs.length === 0 && missingReciters.length === 0,
    missingSurahs,
    missingReciters,
  };
}

/**
 * Create Track objects from a fully-curated system playlist
 * Only works for playlists where all items have reciterId specified
 * @param playlist - System playlist object
 * @returns Array of Track objects, or null if playlist is not fully-curated
 */
export async function createTracksFromSystemPlaylist(
  playlist: SystemPlaylist,
): Promise<Track[] | null> {
  if (playlist.type !== 'fully-curated') {
    return null;
  }

  const tracks: Track[] = [];

  for (const item of playlist.items) {
    if (!item.reciterId) {
      // Skip items without reciter for safety
      continue;
    }

    const reciter = await getReciterById(item.reciterId);
    const surah = await getSurahById(item.surahId);

    if (!reciter || !surah) {
      console.warn(
        `Skipping item: Missing reciter or surah for surahId=${item.surahId}, reciterId=${item.reciterId}`,
      );
      continue;
    }

    const track = await createTrack(reciter, surah, item.rewayatId);
    tracks.push(track);
  }

  return tracks;
}

/**
 * Get the total duration of a system playlist
 * Note: This is an estimation based on average surah durations
 * Actual duration will vary by reciter
 * @param playlist - System playlist object
 * @returns Estimated duration in seconds, or null if cannot be calculated
 */
export function getSystemPlaylistEstimatedDuration(
  playlist: SystemPlaylist,
): number | null {
  // Average duration estimates for common surahs (in seconds)
  const averageDurations: Record<number, number> = {
    1: 60, // Al-Fatihah
    2: 5400, // Al-Baqarah (90 min)
    3: 3600, // Ali 'Imran (60 min)
    4: 4200, // An-Nisa (70 min)
    18: 1800, // Al-Kahf (30 min)
    36: 900, // Ya-Sin (15 min)
    55: 900, // Ar-Rahman (15 min)
    56: 720, // Al-Waqiah (12 min)
    67: 540, // Al-Mulk (9 min)
    112: 20, // Al-Ikhlas
    113: 25, // Al-Falaq
    114: 30, // An-Nas
  };

  // Default duration for surahs not in the map (5 minutes average)
  const defaultDuration = 300;

  let totalDuration = 0;
  for (const item of playlist.items) {
    totalDuration += averageDurations[item.surahId] || defaultDuration;
  }

  return totalDuration;
}

/**
 * Format duration in seconds to human-readable string
 * @param seconds - Duration in seconds
 * @returns Formatted string like "1h 23m" or "45m" or "3m"
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

/**
 * Check if a system playlist can be played immediately (fully-curated)
 * or requires user to select reciters (surah-only)
 * @param playlist - System playlist object
 * @returns Object with playability status and message
 */
export function checkPlaylistPlayability(playlist: SystemPlaylist): {
  canPlayImmediately: boolean;
  requiresReciterSelection: boolean;
  message: string;
} {
  if (playlist.type === 'fully-curated') {
    return {
      canPlayImmediately: true,
      requiresReciterSelection: false,
      message: 'Ready to play',
    };
  }

  return {
    canPlayImmediately: false,
    requiresReciterSelection: true,
    message: 'Select reciters to play',
  };
}

/**
 * Get unique reciter IDs from a system playlist
 * Useful for displaying reciter info in fully-curated playlists
 * @param playlist - System playlist object
 * @returns Array of unique reciter IDs
 */
export function getUniqueReciterIds(playlist: SystemPlaylist): string[] {
  const reciterIds = playlist.items
    .map(item => item.reciterId)
    .filter((id): id is string => id !== undefined);

  return [...new Set(reciterIds)];
}

/**
 * Get items grouped by reciter for a fully-curated playlist
 * @param playlist - System playlist object
 * @returns Map of reciter ID to array of surah IDs
 */
export function getItemsByReciter(
  playlist: SystemPlaylist,
): Map<string, number[]> {
  const itemsByReciter = new Map<string, number[]>();

  for (const item of playlist.items) {
    if (!item.reciterId) continue;

    const existing = itemsByReciter.get(item.reciterId) || [];
    existing.push(item.surahId);
    itemsByReciter.set(item.reciterId, existing);
  }

  return itemsByReciter;
}

