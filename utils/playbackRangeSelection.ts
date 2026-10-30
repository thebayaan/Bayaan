// @ai-generated
/**
 * Ranges for the Mushaf Listen sheet: presets (page, surah, juz), quick
 * extends, verse counts and typed references ("2:255-257", "mulk 1-10",
 * "juz 30"). Keys are in the range pickers' numbering
 * (utils/playbackRangePicker.ts): Hafs verse keys, or the verse units of the
 * mushaf's rewayah when they are ready.
 *
 * Page and juz ranges come from the Hafs verse keys of the mushaf pages
 * (`hafsKeysOfPage`), mapped into the pickers' numbering.
 */

import {SURAHS} from '@/data/surahData';
import {rankSurahs} from '@/utils/search/catalog';
import {normalizeSearchText} from '@/utils/search/normalize';
import type {RangePickerNumbering} from '@/utils/playbackRangePicker';

// Same as pickerVerseCount (utils/playbackRangePicker.ts), which pulls in the
// player store; this module stays free of it.
function pickerVerseCount(n: RangePickerNumbering, surah: number): number {
  if (n.units) return n.units.verseCount(surah);
  return SURAHS[surah - 1]?.verses_count ?? 1;
}

export const MUSHAF_PAGE_COUNT = 604;

// First page of each juz in the 604-page Madani layout.
export const JUZ_START_PAGES: readonly number[] = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322,
  342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

export interface VerseRange {
  start: string;
  end: string;
}

export interface RangeEnv {
  numbering: RangePickerNumbering;
  /** Hafs verse keys of a mushaf page, in reading order. */
  hafsKeysOfPage: (page: number) => readonly string[];
  /** The mushaf page of a Hafs verse key. */
  pageOfHafsKey: (key: string) => number | undefined;
}

export type RangePreset = 'page' | 'surah' | 'juz' | 'custom';
export type RangeExtend = 'plus5' | 'page' | 'surah' | 'juz';

function parseKey(key: string): [number, number] {
  const [s, a] = key.split(':').map(Number);
  return [s, a];
}

/** Negative when `a` comes before `b`, zero when equal. */
export function compareVerseKeys(a: string, b: string): number {
  const [as, aa] = parseKey(a);
  const [bs, ba] = parseKey(b);
  return as !== bs ? as - bs : aa - ba;
}

/** The two keys in reading order. */
export function orderedRange(a: string, b: string): VerseRange {
  return compareVerseKeys(a, b) <= 0 ? {start: a, end: b} : {start: b, end: a};
}

export function isKeyInRange(key: string, range: VerseRange): boolean {
  return (
    compareVerseKeys(range.start, key) <= 0 &&
    compareVerseKeys(key, range.end) <= 0
  );
}

/** Whether `key` names a verse in the pickers' numbering. */
export function isValidKey(n: RangePickerNumbering, key: string): boolean {
  const [s, a] = parseKey(key);
  if (!Number.isInteger(s) || !Number.isInteger(a)) return false;
  if (s < 1 || s > 114 || a < 1) return false;
  return a <= pickerVerseCount(n, s);
}

export function surahRange(n: RangePickerNumbering, surah: number): VerseRange {
  return {start: `${surah}:1`, end: `${surah}:${pickerVerseCount(n, surah)}`};
}

/** Number of verses from `range.start` to `range.end`, both included. */
export function countVerses(
  n: RangePickerNumbering,
  range: VerseRange,
): number {
  const [ss, sa] = parseKey(range.start);
  const [es, ea] = parseKey(range.end);
  if (ss === es) return Math.max(0, ea - sa + 1);
  let count = pickerVerseCount(n, ss) - sa + 1;
  for (let s = ss + 1; s < es; s++) count += pickerVerseCount(n, s);
  return count + ea;
}

/** The key `steps` verses after `key`, stopping at the last verse (114). */
export function advanceKey(
  n: RangePickerNumbering,
  key: string,
  steps: number,
): string {
  let [s, a] = parseKey(key);
  let left = steps;
  while (left > 0) {
    const count = pickerVerseCount(n, s);
    const room = count - a;
    if (left <= room) return `${s}:${a + left}`;
    if (s === 114) return `${s}:${count}`;
    left -= room + 1;
    s += 1;
    a = 1;
  }
  return `${s}:${a}`;
}

/** The range of the given Hafs keys in the pickers' numbering. */
export function rangeForHafsKeys(
  n: RangePickerNumbering,
  hafsKeys: readonly string[],
): VerseRange | null {
  if (hafsKeys.length === 0) return null;
  if (!n.units) {
    return {start: hafsKeys[0], end: hafsKeys[hafsKeys.length - 1]};
  }
  const units = n.units.unitsForHafsKeys(hafsKeys);
  if (units.length === 0) return null;
  return {start: units[0].key, end: units[units.length - 1].key};
}

/** The Hafs key holding the start of `key` (a picker key). */
function hafsKeyOf(n: RangePickerNumbering, key: string): string | null {
  if (!n.units) return key;
  return n.units.unitByKey(key)?.hafsKeys[0] ?? null;
}

export function pageOfKey(env: RangeEnv, key: string): number | undefined {
  const hafs = hafsKeyOf(env.numbering, key);
  return hafs ? env.pageOfHafsKey(hafs) : undefined;
}

export function juzOfPage(page: number): number {
  let juz = 1;
  for (let i = 0; i < JUZ_START_PAGES.length; i++) {
    if (page >= JUZ_START_PAGES[i]) juz = i + 1;
  }
  return juz;
}

export function pageRange(env: RangeEnv, page: number): VerseRange | null {
  return rangeForHafsKeys(env.numbering, env.hafsKeysOfPage(page));
}

export function juzRange(env: RangeEnv, juz: number): VerseRange | null {
  if (juz < 1 || juz > 30) return null;
  const firstPage = JUZ_START_PAGES[juz - 1];
  const lastPage = juz === 30 ? MUSHAF_PAGE_COUNT : JUZ_START_PAGES[juz] - 1;
  const first = env.hafsKeysOfPage(firstPage)[0];
  const lastKeys = env.hafsKeysOfPage(lastPage);
  const last = lastKeys[lastKeys.length - 1];
  if (!first || !last) return null;
  return rangeForHafsKeys(env.numbering, [first, last]);
}

/** The range `preset` names around the page on screen (`page`). */
export function presetRange(
  env: RangeEnv,
  preset: Exclude<RangePreset, 'custom'>,
  page: number,
  /** The verse the surah and juz presets are taken from. */
  anchorKey: string,
): VerseRange | null {
  if (preset === 'page') return pageRange(env, page);
  if (preset === 'surah')
    return surahRange(env.numbering, parseKey(anchorKey)[0]);
  return juzRange(env, juzOfPage(pageOfKey(env, anchorKey) ?? page));
}

function sameRange(a: VerseRange | null, b: VerseRange): boolean {
  return !!a && a.start === b.start && a.end === b.end;
}

/** The preset that names `range` exactly, else 'custom'. */
export function detectPreset(
  env: RangeEnv,
  range: VerseRange,
  page: number,
): RangePreset {
  if (sameRange(pageRange(env, page), range)) return 'page';
  const [ss] = parseKey(range.start);
  if (sameRange(surahRange(env.numbering, ss), range)) return 'surah';
  const startPage = pageOfKey(env, range.start);
  if (startPage && sameRange(juzRange(env, juzOfPage(startPage)), range)) {
    return 'juz';
  }
  return 'custom';
}

/** `range` with its end moved by a quick extend. */
export function extendRange(
  env: RangeEnv,
  range: VerseRange,
  kind: RangeExtend,
): VerseRange {
  const n = env.numbering;
  let end = range.end;
  if (kind === 'plus5') {
    end = advanceKey(n, range.end, 5);
  } else if (kind === 'surah') {
    end = surahRange(n, parseKey(range.end)[0]).end;
  } else {
    const page = pageOfKey(env, range.end);
    const target =
      page === undefined
        ? null
        : kind === 'page'
        ? pageRange(env, page)
        : juzRange(env, juzOfPage(page));
    if (target) end = target.end;
  }
  return compareVerseKeys(end, range.end) > 0
    ? {start: range.start, end}
    : range;
}

// ---------------------------------------------------------------------------
// Typed references
// ---------------------------------------------------------------------------

export type RangeSuggestionKind =
  | 'range'
  | 'verse'
  | 'toEndOfSurah'
  | 'page'
  | 'surah'
  | 'juz';

export interface RangeSuggestion {
  kind: RangeSuggestionKind;
  range: VerseRange;
  /** The page or juz number for 'page' and 'juz'. */
  number?: number;
}

// Verses people look for by name, as Hafs keys.
const NAMED_VERSES: Record<string, string> = {
  kursi: '2:255',
  'ayat al kursi': '2:255',
  'ayatul kursi': '2:255',
  الكرسي: '2:255',
  'ايه الكرسي': '2:255',
};

const JUZ_NAMES: Record<string, number> = {
  amma: 30,
  'juz amma': 30,
  tabarak: 29,
  'juz tabarak': 29,
  عم: 30,
  'جزء عم': 30,
  تبارك: 29,
  'جزء تبارك': 29,
};

function verseSuggestions(env: RangeEnv, key: string): RangeSuggestion[] {
  const n = env.numbering;
  if (!isValidKey(n, key)) return [];
  const out: RangeSuggestion[] = [
    {kind: 'verse', range: {start: key, end: key}},
  ];
  const toEnd = surahRange(n, parseKey(key)[0]).end;
  if (toEnd !== key) {
    out.push({kind: 'toEndOfSurah', range: {start: key, end: toEnd}});
  }
  const page = pageOfKey(env, key);
  const onPage = page ? pageRange(env, page) : null;
  if (page && onPage) out.push({kind: 'page', range: onPage, number: page});
  return out;
}

function rangeSuggestion(
  env: RangeEnv,
  a: string,
  b: string,
): RangeSuggestion[] {
  const n = env.numbering;
  if (!isValidKey(n, a) || !isValidKey(n, b)) return [];
  const range = orderedRange(a, b);
  if (range.start === range.end) return verseSuggestions(env, range.start);
  return [
    {kind: 'range', range},
    ...verseSuggestions(env, range.start).filter(s => s.kind !== 'page'),
  ];
}

/** The verse `hafsKey` in the pickers' numbering. */
function pickerKeyForHafs(
  n: RangePickerNumbering,
  hafsKey: string,
): string | null {
  if (!n.units) return hafsKey;
  return n.units.unitsForHafsKey(hafsKey)[0]?.key ?? null;
}

/**
 * Suggestions for a typed reference, best first. Understands "2:255",
 * "2:255-257", "2:255-3:5", "baqarah 255", "mulk 1-10", "juz 30", "amma",
 * "page 42", "kursi", a surah name or number. Numbers are in the pickers'
 * numbering.
 */
export function parseRangeQuery(
  env: RangeEnv,
  query: string,
): RangeSuggestion[] {
  const n = env.numbering;
  const q = normalizeSearchText(query).replace(/[–—]/g, '-');
  if (!q) return [];

  // 2:255-3:5
  let m = q.match(/^(\d+)\s*:\s*(\d+)\s*-\s*(\d+)\s*:\s*(\d+)$/);
  if (m) return rangeSuggestion(env, `${m[1]}:${m[2]}`, `${m[3]}:${m[4]}`);
  // 2:255-257
  m = q.match(/^(\d+)\s*:\s*(\d+)\s*-\s*(\d+)$/);
  if (m) return rangeSuggestion(env, `${m[1]}:${m[2]}`, `${m[1]}:${m[3]}`);
  // 2:255
  m = q.match(/^(\d+)\s*:\s*(\d+)$/);
  if (m) return verseSuggestions(env, `${m[1]}:${m[2]}`);

  // page 42
  m = q.match(/^(?:page|pg|p|صفحه|ص)\s*(\d+)$/);
  if (m) {
    const page = Number(m[1]);
    const range =
      page >= 1 && page <= MUSHAF_PAGE_COUNT ? pageRange(env, page) : null;
    return range ? [{kind: 'page', range, number: page}] : [];
  }

  // juz 30, amma
  m = q.match(/^(?:juz|jz|j|الجزء|جزء|ج)\s*(\d+)$/);
  const juz = m ? Number(m[1]) : JUZ_NAMES[q];
  if (juz) {
    const range = juzRange(env, juz);
    return range ? [{kind: 'juz', range, number: juz}] : [];
  }

  // kursi
  const named = NAMED_VERSES[q];
  if (named) {
    const key = pickerKeyForHafs(n, named);
    return key ? verseSuggestions(env, key) : [];
  }

  // 18, 18 1-10, mulk 1-10, baqarah 255
  m = q.match(/^(.*?)\s*(\d+)?\s*(?:-\s*(\d+))?$/);
  const namePart = m?.[1]?.trim() ?? '';
  const from = m?.[2] ? Number(m[2]) : null;
  const to = m?.[3] ? Number(m[3]) : null;

  let surahs: number[];
  if (!namePart && from !== null && to === null) {
    // A bare number is a surah.
    return from >= 1 && from <= 114
      ? [{kind: 'surah', range: surahRange(n, from)}]
      : [];
  } else if (namePart) {
    surahs = rankSurahs(namePart)
      .slice(0, 3)
      .map(s => s.id);
  } else {
    return [];
  }

  const out: RangeSuggestion[] = [];
  for (const surah of surahs) {
    if (from === null) {
      out.push({kind: 'surah', range: surahRange(n, surah)});
    } else if (to === null) {
      out.push(...verseSuggestions(env, `${surah}:${from}`).slice(0, 2));
    } else {
      out.push(
        ...rangeSuggestion(env, `${surah}:${from}`, `${surah}:${to}`).slice(
          0,
          1,
        ),
      );
    }
  }
  return out;
}

export function surahIdOfKey(key: string): number {
  return parseKey(key)[0];
}

export function ayahOfKey(key: string): number {
  return parseKey(key)[1];
}

export const SURAH_COUNT = SURAHS.length;
