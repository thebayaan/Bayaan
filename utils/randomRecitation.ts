import {Reciter, RECITERS} from '@/data/reciterData';
import {Surah, SURAHS} from '@/data/surahData';

/**
 * Gets a random reciter from the available reciters
 */
function getRandomReciter(): Reciter {
  const randomIndex = Math.floor(Math.random() * RECITERS.length);
  return RECITERS[randomIndex];
}

/**
 * Gets a random surah that is available for the given reciter
 */
function getRandomAvailableSurah(reciter: Reciter): Surah {
  // Get the rewayat with the most surahs
  const primaryRewayat = reciter.rewayat.reduce(
    (prev, current) =>
      current.surah_total > prev.surah_total ? current : prev,
    reciter.rewayat[0],
  );

  // Get available surahs for this reciter
  const availableSurahs = primaryRewayat.surah_list
    .filter((surahId): surahId is number => surahId !== null)
    .map(surahId => SURAHS.find(surah => surah.id === surahId))
    .filter((surah): surah is Surah => surah !== undefined);

  // If no available surahs, fall back to first surah
  if (availableSurahs.length === 0) {
    return SURAHS[0];
  }

  // Select a random surah from available ones
  const randomIndex = Math.floor(Math.random() * availableSurahs.length);
  return availableSurahs[randomIndex];
}

/**
 * Gets a random reciter and surah combination
 */
export async function getRandomTrack(): Promise<{
  reciter: Reciter;
  surah: Surah;
}> {
  // Try up to 5 times to find a valid combination
  for (let i = 0; i < 5; i++) {
    try {
      const reciter = getRandomReciter();
      const surah = getRandomAvailableSurah(reciter);

      return {reciter, surah};
    } catch (error) {
      console.warn('Error finding random track, retrying:', error);
    }
  }

  // Fallback to a known good combination
  const fallbackReciter =
    RECITERS.find(
      r =>
        r.name === 'Mishary Alafasi' ||
        r.rewayat.some(rw => rw.surah_total > 10),
    ) || RECITERS[0];

  const fallbackSurah = SURAHS[0]; // Al-Fatihah

  return {
    reciter: fallbackReciter,
    surah: fallbackSurah,
  };
}

/**
 * Gets multiple random tracks for continuous playback
 * @param count Number of random tracks to retrieve (default 5)
 * @param sameReciter Whether to use the same reciter for all tracks (default true)
 * @returns Array of {reciter, surah} pairs
 */
export async function getMultipleRandomTracks(
  count = 5,
  sameReciter = true,
): Promise<Array<{reciter: Reciter; surah: Surah}>> {
  const tracks: Array<{reciter: Reciter; surah: Surah}> = [];
  let currentReciter: Reciter | null = null;
  let usedSurahIds: Set<number> = new Set();

  // Try to get the requested number of tracks
  for (let i = 0; i < count; i++) {
    try {
      // If we want the same reciter and we already have one, use it
      // Otherwise get a new random reciter
      if (sameReciter && currentReciter) {
        // For the same reciter, get a different surah if possible
        let attempts = 0;
        let surah: Surah;

        do {
          surah = getRandomAvailableSurah(currentReciter);
          attempts++;
          // Break after 5 attempts to avoid infinite loop
          if (attempts > 5) break;
        } while (usedSurahIds.has(surah.id) && attempts < 5);

        tracks.push({reciter: currentReciter, surah});
        usedSurahIds.add(surah.id);
      } else {
        // Get a new random track
        const {reciter, surah} = await getRandomTrack();

        // For the first track or when using different reciters, save the reciter
        if (i === 0 || !sameReciter) {
          currentReciter = reciter;
          usedSurahIds = new Set([surah.id]);
        }

        tracks.push({reciter, surah});
      }
    } catch (error) {
      console.warn('Error finding random track, continuing:', error);
    }
  }

  // If we couldn't get any tracks, fall back to one track
  if (tracks.length === 0) {
    const fallbackTrack = await getRandomTrack();
    return [fallbackTrack];
  }

  return tracks;
}
