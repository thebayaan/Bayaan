import {readJSON, remove, storage, writeJSON} from './storage';

const KEY = 'bayaan_tv_loved_surahs';
const MAX_ENTRIES = 114;

/**
 * A surah the listener loved, with the recitation they loved it in, so the
 * Library can play it back in the same voice. Mirrors the phone's loved
 * tracks (services/player/store/lovedStore.ts), keyed by surah on TV because
 * the Library shows "Favorite surahs" rather than tracks.
 */
export type LovedSurah = {
  surahNumber: number;
  reciterId: string;
  rewayahId: string;
  addedAt: number;
};

/** Loved surahs, most recently loved first. */
export function getLovedSurahs(): LovedSurah[] {
  const saved = readJSON<LovedSurah[]>(KEY);
  if (!Array.isArray(saved)) return [];
  return saved.filter(
    e =>
      e !== null &&
      typeof e === 'object' &&
      Number.isInteger(e.surahNumber) &&
      e.surahNumber >= 1 &&
      e.surahNumber <= 114 &&
      typeof e.reciterId === 'string',
  );
}

export function isLovedSurah(surahNumber: number): boolean {
  return getLovedSurahs().some(e => e.surahNumber === surahNumber);
}

/** Loves or un-loves a surah; returns whether it is loved afterwards. */
export function toggleLovedSurah(
  surahNumber: number,
  reciterId: string,
  rewayahId: string,
): boolean {
  const existing = getLovedSurahs();
  if (existing.some(e => e.surahNumber === surahNumber)) {
    writeJSON(
      KEY,
      existing.filter(e => e.surahNumber !== surahNumber),
    );
    return false;
  }
  const next: LovedSurah[] = [
    {surahNumber, reciterId, rewayahId, addedAt: Date.now()},
    ...existing,
  ].slice(0, MAX_ENTRIES);
  writeJSON(KEY, next);
  return true;
}

export function clearLovedSurahs(): void {
  remove(KEY);
}

export const LOVED_SURAHS_KEY = KEY;
export {storage};
