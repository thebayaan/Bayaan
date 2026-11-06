import {SURAHS} from '@/data/surahData';

// Primitives shared by the per-kind QF snapshot parsers.

const VERSE_KEY = /^(\d{1,3}):(\d{1,3})$/;
const AYAH_COUNTS = new Map(
  SURAHS.map(surah => [surah.id, surah.verses_count]),
);

/** A real Hafs verse key ("2:255"); null for anything else, out-of-range included. */
export function parseVerseKey(
  value: unknown,
): {surah: number; ayah: number} | null {
  if (typeof value !== 'string') return null;
  const match = VERSE_KEY.exec(value);
  if (!match) return null;
  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  const ayahCount = AYAH_COUNTS.get(surah);
  if (ayahCount === undefined || ayah < 1 || ayah > ayahCount) return null;
  return {surah, ayah};
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
