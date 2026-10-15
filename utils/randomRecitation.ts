import {Reciter, RECITERS} from '@/data/reciterData';
import {Surah, SURAHS} from '@/data/surahData';

/** Returns a number in [0, 1), like Math.random (injectable for tests). */
export type RandomSource = () => number;

/**
 * Gets a random reciter from the available reciters
 */
function getRandomReciter(reciters: Reciter[], random: RandomSource): Reciter {
  const randomIndex = Math.floor(random() * reciters.length);
  return reciters[randomIndex];
}

/**
 * Picks a random index using weights that favor lower-numbered surahs (longer).
 * Weight = 1 / sqrt(surahId) for a moderate bias (~7.5x ratio between surah 2 and 114).
 * Al-Fatihah (id 1) is de-weighted to match a mid-range surah since it's very short.
 */
function weightedRandomIndex(surahs: Surah[], random: RandomSource): number {
  const MID_SURAH_WEIGHT = 1 / Math.sqrt(50);
  let totalWeight = 0;
  const weights = surahs.map(s => {
    const w = s.id === 1 ? MID_SURAH_WEIGHT : 1 / Math.sqrt(s.id);
    totalWeight += w;
    return w;
  });

  let roll = random() * totalWeight;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return i;
  }
  return weights.length - 1;
}

/**
 * Gets a random surah that is available for the given reciter.
 * Biased toward lower-numbered (longer) surahs.
 */
function getRandomAvailableSurah(
  reciter: Reciter,
  random: RandomSource,
): Surah {
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

  return availableSurahs[weightedRandomIndex(availableSurahs, random)];
}

/**
 * Gets a random reciter and surah combination
 */
function pickRandomTrack(
  reciters: Reciter[],
  random: RandomSource,
): {reciter: Reciter; surah: Surah} {
  // Try up to 5 times to find a valid combination
  for (let i = 0; i < 5; i++) {
    try {
      const reciter = getRandomReciter(reciters, random);
      const surah = getRandomAvailableSurah(reciter, random);

      return {reciter, surah};
    } catch (error) {
      console.warn('Error finding random track, retrying:', error);
    }
  }

  // Fallback to a known good combination
  const fallbackReciter =
    reciters.find(
      r =>
        r.name === 'Mishary Alafasi' ||
        r.rewayat.some(rw => rw.surah_total > 10),
    ) || reciters[0];

  const fallbackSurah = SURAHS[0]; // Al-Fatihah

  return {
    reciter: fallbackReciter,
    surah: fallbackSurah,
  };
}

/**
 * The rewayah a random pick plays in: a random one that has the surah, else
 * the reciter's largest.
 */
function randomRewayatId(
  reciter: Reciter,
  surahId: number,
  random: RandomSource,
): string | null {
  if (reciter.rewayat.length === 0) return null;
  const available = reciter.rewayat.filter(r => r.surah_list.includes(surahId));
  if (available.length > 0) {
    return available[Math.floor(random() * available.length)].id;
  }
  return reciter.rewayat.reduce(
    (prev, current) =>
      current.surah_total > prev.surah_total ? current : prev,
    reciter.rewayat[0],
  ).id;
}

export interface RandomRecitation {
  reciter: Reciter;
  surah: Surah;
  rewayatId: string;
}

/**
 * Random Recitation (the Home screen card and the car's Surprise me): `count`
 * surahs, each from its own random reciter.
 */
export function pickRandomRecitations(
  count: number,
  reciters: Reciter[] = RECITERS,
  random: RandomSource = Math.random,
): RandomRecitation[] {
  const picks: RandomRecitation[] = [];
  if (reciters.length === 0) return picks;
  for (let i = 0; i < count; i++) {
    const {reciter, surah} = pickRandomTrack(reciters, random);
    const rewayatId = randomRewayatId(reciter, surah.id, random);
    if (rewayatId) picks.push({reciter, surah, rewayatId});
  }
  return picks;
}
