import {readJSON, remove, storage, writeJSON} from './storage';

const KEY = 'bayaan_tv_loved_surahs';
/** Bumped when the saved shape changes; see migrateLovedSurahs. */
const VERSION_KEY = 'bayaan_tv_loved_surahs_version';
const VERSION = '2';
/** One surah can be loved in several voices, so more than 114. */
export const MAX_LOVED_SURAHS = 500;

/**
 * A surah the listener loved in one voice, with the recitation they loved it
 * in, so the Library plays it back the same way. Keyed by surah + reciter,
 * like the phone's loved tracks (services/player/store/lovedStore.ts): loving
 * Al-Fatihah by Al-Minshawi says nothing about Al-Fatihah by Sudais.
 */
export type LovedSurah = {
  surahNumber: number;
  reciterId: string;
  rewayahId: string;
  addedAt: number;
};

/** Whether `list` holds this surah in this voice. */
export function isLovedIn(
  list: readonly LovedSurah[],
  surahNumber: number,
  reciterId: string,
): boolean {
  return list.some(
    e => e.surahNumber === surahNumber && e.reciterId === reciterId,
  );
}

/**
 * Cleans saved entries: drops malformed ones, fills fields older versions
 * left out, and keeps one entry per surah + reciter (the newest; the list is
 * stored newest first).
 */
export function normalizeLoved(saved: unknown): LovedSurah[] {
  if (!Array.isArray(saved)) return [];
  const out: LovedSurah[] = [];
  for (const raw of saved as Partial<LovedSurah>[]) {
    if (
      raw === null ||
      typeof raw !== 'object' ||
      !Number.isInteger(raw.surahNumber) ||
      (raw.surahNumber as number) < 1 ||
      (raw.surahNumber as number) > 114 ||
      typeof raw.reciterId !== 'string' ||
      raw.reciterId.length === 0
    ) {
      continue;
    }
    const entry: LovedSurah = {
      surahNumber: raw.surahNumber as number,
      reciterId: raw.reciterId,
      rewayahId: typeof raw.rewayahId === 'string' ? raw.rewayahId : '',
      addedAt:
        typeof raw.addedAt === 'number' && Number.isFinite(raw.addedAt)
          ? raw.addedAt
          : 0,
    };
    if (!isLovedIn(out, entry.surahNumber, entry.reciterId)) out.push(entry);
  }
  return out.slice(0, MAX_LOVED_SURAHS);
}

/**
 * Rewrites loves saved by older builds (one per surah, sometimes without a
 * rewayah) in the current shape, once. Every old entry already names its
 * reciter, so each keeps the voice it was loved in.
 */
export function migrateLovedSurahs(): void {
  if (storage.getString(VERSION_KEY) === VERSION) return;
  const saved = readJSON<unknown>(KEY);
  if (saved !== null) writeJSON(KEY, normalizeLoved(saved));
  storage.set(VERSION_KEY, VERSION);
}

/** Loved surahs, most recently loved first. */
export function getLovedSurahs(): LovedSurah[] {
  return normalizeLoved(readJSON<unknown>(KEY));
}

/** Whether this surah is loved in this reciter's voice. */
export function isLovedSurah(surahNumber: number, reciterId: string): boolean {
  return isLovedIn(getLovedSurahs(), surahNumber, reciterId);
}

/**
 * Loves or un-loves a surah in one voice; returns whether it is loved
 * afterwards. Other voices' loves of the same surah are left alone.
 */
export function toggleLovedSurah(
  surahNumber: number,
  reciterId: string,
  rewayahId: string,
): boolean {
  const existing = getLovedSurahs();
  if (isLovedIn(existing, surahNumber, reciterId)) {
    writeJSON(
      KEY,
      existing.filter(
        e => !(e.surahNumber === surahNumber && e.reciterId === reciterId),
      ),
    );
    return false;
  }
  const next: LovedSurah[] = [
    {surahNumber, reciterId, rewayahId, addedAt: Date.now()},
    ...existing,
  ].slice(0, MAX_LOVED_SURAHS);
  writeJSON(KEY, next);
  return true;
}

export function clearLovedSurahs(): void {
  remove(KEY);
}

export const LOVED_SURAHS_KEY = KEY;
export {storage};
