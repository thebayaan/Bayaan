// @ai-generated
/**
 * The format of the bundled Quran search index (assets/data/quran-search-
 * v1.db, built by scripts/search/build-quran-search-db.ts).
 *
 * A posting is one word of the Hafs Digital Khatt text with what one of its
 * spellings says about it, packed in a number:
 *   slot = verseIndex * 256 + position   (verseIndex 0..6235 in mushaf order,
 *                                         position = the DK slot, 1..255)
 *   code = slot * 32 + flags             (below 2^26: plain arithmetic)
 *   flags: bits 0-1 tier (3 full spelling, 2 without proclitics, 1 without
 *          the article), bit 2 hasHamza, bit 3 rasmOnly, bit 4 reserved
 *          (a spelling of another rewayah; 0 in v1).
 * A word's slots in one verse are consecutive codes / 32, and a phrase never
 * crosses into the next verse because the stride (256) leaves a gap.
 * Postings are stored as text: ascending codes, the first absolute and the
 * rest as deltas, in base 36, comma-separated.
 */
import {SURAHS} from '@/data/surahData';

export {QURAN_TIER, type QuranTier} from './quranText';

export const QURAN_SEARCH_DB_NAME = 'quran-search-v1.db';
/** `meta.format` of the DB this code reads. */
export const QURAN_SEARCH_FORMAT = 1;
export const QURAN_VERSE_COUNT = 6236;
/** Slots per verse in a posting code (positions 1..255). */
export const QURAN_SLOT_STRIDE = 256;
/** Flag values per slot in a posting code. */
export const QURAN_FLAG_RANGE = 32;
export const QURAN_FLAG = {
  /** tier = flags % 4 */
  tierMask: 3,
  hasHamza: 4,
  rasmOnly: 8,
  /** Reserved: a spelling found only in another rewayah's text. */
  otherRewayah: 16,
} as const;

export interface QuranPosting {
  verseIndex: number;
  position: number;
  tier: 1 | 2 | 3;
  hasHamza: boolean;
  rasmOnly: boolean;
}

/** A root of the i'rab data ('ر ح م'), counted in words (not stems). */
export interface QuranRoot {
  id: number;
  root: string;
  words: number;
  ayahs: number;
}

/** A lemma of a root; lemma null holds the root's words without one. */
export interface QuranLemma {
  id: number;
  rootId: number;
  lemma: string | null;
  words: number;
  ayahs: number;
}

export function packPosting(posting: QuranPosting): number {
  const {verseIndex, position, tier} = posting;
  if (
    !Number.isInteger(verseIndex) ||
    verseIndex < 0 ||
    verseIndex >= QURAN_VERSE_COUNT
  ) {
    throw new RangeError(`verse index out of range: ${verseIndex}`);
  }
  if (
    !Number.isInteger(position) ||
    position < 1 ||
    position >= QURAN_SLOT_STRIDE
  ) {
    throw new RangeError(`word position out of range: ${position}`);
  }
  if (tier !== 1 && tier !== 2 && tier !== 3) {
    throw new RangeError(`tier out of range: ${String(tier)}`);
  }
  const flags =
    tier +
    (posting.hasHamza ? QURAN_FLAG.hasHamza : 0) +
    (posting.rasmOnly ? QURAN_FLAG.rasmOnly : 0);
  return (verseIndex * QURAN_SLOT_STRIDE + position) * QURAN_FLAG_RANGE + flags;
}

/** The slot of a code: verseIndex * 256 + position. */
export function slotOfCode(code: number): number {
  return Math.floor(code / QURAN_FLAG_RANGE);
}

export function flagsOfCode(code: number): number {
  return code % QURAN_FLAG_RANGE;
}

/** True when `flag` (one of QURAN_FLAG's bits) is set in `flags`. */
export function hasFlag(flags: number, flag: number): boolean {
  return Math.floor(flags / flag) % 2 === 1;
}

export function unpackPosting(code: number): QuranPosting {
  const flags = flagsOfCode(code);
  const slot = slotOfCode(code);
  const tier = flags % 4;
  if (tier === 0) throw new RangeError(`posting without a tier: ${code}`);
  return {
    verseIndex: Math.floor(slot / QURAN_SLOT_STRIDE),
    position: slot % QURAN_SLOT_STRIDE,
    tier: tier as 1 | 2 | 3,
    hasHamza: hasFlag(flags, QURAN_FLAG.hasHamza),
    rasmOnly: hasFlag(flags, QURAN_FLAG.rasmOnly),
  };
}

/** Ascending codes as text (see the file comment); '' for none. */
export function encodePostings(codes: readonly number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    if (!Number.isSafeInteger(code) || code < 0) {
      throw new RangeError(`not a posting code: ${code}`);
    }
    if (i > 0 && code <= codes[i - 1]) {
      throw new RangeError('posting codes must be strictly ascending');
    }
    parts.push((i === 0 ? code : code - codes[i - 1]).toString(36));
  }
  return parts.join(',');
}

const BASE36 = /^[0-9a-z]+$/;

/** The codes of an encoded postings list. Throws on malformed text. */
export function decodePostings(text: string): number[] {
  if (!text) return [];
  const codes: number[] = [];
  let code = 0;
  for (const part of text.split(',')) {
    if (!BASE36.test(part)) throw new Error('malformed postings');
    code += parseInt(part, 36);
    codes.push(code);
  }
  return codes;
}

/** Index of each surah's first verse (SURAH_START[s - 1] for surah s). */
const SURAH_START: readonly number[] = (() => {
  const starts: number[] = [];
  let next = 0;
  for (const surah of SURAHS) {
    starts.push(next);
    next += surah.verses_count;
  }
  if (next !== QURAN_VERSE_COUNT) {
    throw new Error(`surah data counts ${next} verses`);
  }
  return starts;
})();

/** The verse at a mushaf-order index: 0 → '1:1', 7 → '2:1', 6235 → '114:6'. */
export function verseKeyAt(verseIndex: number): string {
  if (
    !Number.isInteger(verseIndex) ||
    verseIndex < 0 ||
    verseIndex >= QURAN_VERSE_COUNT
  ) {
    throw new RangeError(`verse index out of range: ${verseIndex}`);
  }
  let lo = 0;
  let hi = SURAH_START.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (SURAH_START[mid] <= verseIndex) lo = mid;
    else hi = mid - 1;
  }
  return `${lo + 1}:${verseIndex - SURAH_START[lo] + 1}`;
}

/** The mushaf-order index of 'S:A', or null for anything else. */
export function verseIndexOf(verseKey: string): number | null {
  const match = /^([1-9]\d{0,2}):([1-9]\d{0,2})$/.exec(verseKey);
  if (!match) return null;
  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  const info = SURAHS[surah - 1];
  if (!info || ayah < 1 || ayah > info.verses_count) return null;
  return SURAH_START[surah - 1] + ayah - 1;
}
