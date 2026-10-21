// @ai-start
/**
 * Extra on-device passages derived from the QUL thematic passages in
 * `data/quran-themes.json` (1,051 entries, each `{surah, ayahFrom, ayahTo}`,
 * contiguous and in mushaf order within a surah).
 *
 * A derived moment starts at a theme's first ayah and ends at the end of that
 * theme or of a later consecutive one, whichever puts the reciter's clip
 * closest to 20–45 s without passing 90 s. The end depends on the reciter's
 * pace, so a candidate carries every possible end and the choice is made when
 * the card is resolved with that reciter's timestamps.
 */

import type {AyahTimestamp} from '@/types/timestamps';
import type {FeedCandidate} from './buildFeed';
import {mulberry32} from './buildFeed';
import type {MomentPassage} from './passages';

export interface ThemeRange {
  surah: number;
  ayahFrom: number;
  ayahTo: number;
}

export interface SpanTarget {
  /** Preferred clip length window. */
  minMs: number;
  maxMs: number;
  /** Never longer than this. */
  hardMaxMs: number;
}

export const DEFAULT_SPAN_TARGET: SpanTarget = {
  minMs: 20_000,
  maxMs: 45_000,
  hardMaxMs: 90_000,
};

/** Curated passages are picked this many times more often than derived ones. */
export const THEME_PASSAGE_WEIGHT = 0.3;
/** Most consecutive themes one derived moment may join. */
export const MAX_THEMES_PER_SPAN = 6;
/** Derived passages offered per reciter in one session's feed. */
export const THEME_PASSAGES_PER_RECITER = 12;

/** Themes grouped by surah, in ayah order. */
export function groupThemesBySurah(
  themes: ThemeRange[],
): Map<number, ThemeRange[]> {
  const bySurah = new Map<number, ThemeRange[]>();
  for (const t of themes) {
    if (t.ayahTo < t.ayahFrom) continue;
    const list = bySurah.get(t.surah) ?? [];
    list.push({surah: t.surah, ayahFrom: t.ayahFrom, ayahTo: t.ayahTo});
    bySurah.set(t.surah, list);
  }
  for (const list of bySurah.values()) {
    list.sort((a, b) => a.ayahFrom - b.ayahFrom);
  }
  return bySurah;
}

/**
 * The last ayah of the theme at `index` and of each theme after it, for as
 * long as the next theme starts right after the previous one ends.
 */
export function themeEndsFrom(
  surahThemes: ThemeRange[],
  index: number,
  maxThemes: number = MAX_THEMES_PER_SPAN,
): number[] {
  const ends: number[] = [];
  let prevEnd = surahThemes[index].ayahFrom - 1;
  for (let i = index; i < surahThemes.length && ends.length < maxThemes; i++) {
    if (surahThemes[i].ayahFrom !== prevEnd + 1) break;
    prevEnd = surahThemes[i].ayahTo;
    ends.push(prevEnd);
  }
  return ends;
}

/**
 * Picks where a derived moment ends: the candidate end whose clip length is
 * closest to the target window (the first one inside it, when several are),
 * never past `hardMaxMs`. Null when even the first theme is too long or its
 * timing is missing.
 */
export function chooseSpanEnd(
  surah: number,
  fromAyah: number,
  ends: number[],
  timestamps: AyahTimestamp[],
  target: SpanTarget = DEFAULT_SPAN_TARGET,
): number | null {
  const byAyah = new Map<number, AyahTimestamp>();
  for (const t of timestamps) {
    if (t.surahNumber === surah) byAyah.set(t.ayahNumber, t);
  }
  const start = byAyah.get(fromAyah);
  if (!start) return null;

  let best: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let checkedTo = fromAyah;
  for (const end of ends) {
    // Every ayah up to this end needs timing, or the clip would be cut wrong.
    for (let a = checkedTo; a <= end; a++) {
      if (!byAyah.has(a)) return best;
    }
    checkedTo = end + 1;
    const length = byAyah.get(end)!.timestampTo - start.timestampFrom;
    if (length > target.hardMaxMs) break;
    let distance = 0;
    if (length < target.minMs) distance = target.minMs - length;
    else if (length > target.maxMs) distance = length - target.maxMs;
    if (distance < bestDistance) {
      best = end;
      bestDistance = distance;
    }
    if (distance === 0 || length > target.maxMs) break;
  }
  return best;
}

function overlaps(theme: ThemeRange, passage: MomentPassage): boolean {
  return (
    theme.surah === passage.surah &&
    theme.ayahFrom <= passage.toAyah &&
    passage.fromAyah <= theme.ayahTo
  );
}

/** A derived passage's id. Its end is only known once it is resolved. */
export function themePassageId(surah: number, fromAyah: number): string {
  return `theme:${surah}:${fromAyah}`;
}

/**
 * Derived candidates for one reciter: a seeded sample of the themes in the
 * surahs they have timings for, leaving out themes that overlap a curated
 * passage (the curated version is preferred).
 */
export function themeCandidatesForReciter(
  reciterId: string,
  rewayatId: string,
  timedSurahs: Iterable<number>,
  themesBySurah: Map<number, ThemeRange[]>,
  curated: MomentPassage[],
  options: {seed: number; perReciter?: number; weight?: number},
): FeedCandidate[] {
  const pool: FeedCandidate[] = [];
  for (const surah of timedSurahs) {
    const themes = themesBySurah.get(surah);
    if (!themes) continue;
    themes.forEach((theme, index) => {
      if (curated.some(p => overlaps(theme, p))) return;
      const themeEnds = themeEndsFrom(themes, index);
      if (themeEnds.length === 0) return;
      pool.push({
        reciterId,
        rewayatId,
        passage: {
          id: themePassageId(surah, theme.ayahFrom),
          surah,
          fromAyah: theme.ayahFrom,
          toAyah: theme.ayahTo,
        },
        weight: options.weight ?? THEME_PASSAGE_WEIGHT,
        themeEnds,
      });
    });
  }

  const limit = options.perReciter ?? THEME_PASSAGES_PER_RECITER;
  if (pool.length <= limit) return pool;
  // Partial Fisher-Yates with a per-reciter seed.
  let hash = options.seed;
  /* eslint-disable no-bitwise */
  for (let i = 0; i < reciterId.length; i++) {
    hash = Math.imul(hash ^ reciterId.charCodeAt(i), 16777619);
  }
  /* eslint-enable no-bitwise */
  const rand = mulberry32(hash);
  for (let i = 0; i < limit; i++) {
    const j = i + Math.floor(rand() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, limit);
}

let bundledThemes: Map<number, ThemeRange[]> | null = null;

/** The bundled thematic passages, grouped by surah (loaded once). */
export function getBundledThemesBySurah(): Map<number, ThemeRange[]> {
  if (!bundledThemes) {
    const data = require('@/data/quran-themes.json') as {
      themes: ThemeRange[];
    };
    bundledThemes = groupThemesBySurah(data.themes);
  }
  return bundledThemes;
}
// @ai-end
