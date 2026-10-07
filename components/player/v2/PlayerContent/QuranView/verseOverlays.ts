import type {DKWordInfo} from '@/services/mushaf/DigitalKhattDataService';
import type {RewayahId} from '@/store/mushafSettingsStore';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import {getVerseTajweedMap} from '@/services/mushaf/DigitalKhattVerseTajweedService';
import {
  rewayahDiffService,
  type DiffRange,
} from '@/services/mushaf/RewayahDiffService';

/**
 * Verse-level overlays for SkiaVerseText (list / reading views, player,
 * settings sample). All maps index into layoutWords(words).text, the exact
 * string SkiaVerseText renders (blank slots skipped, multi-token slots kept
 * whole; services/mushaf/lineWordSpans.ts).
 */
export interface VerseOverlayInput {
  verseKey: string | undefined;
  /** The rendered words (useRewayahWords), possibly including blanks. */
  words: readonly DKWordInfo[];
  /** Rewayah of the rendered words. */
  rewayah: RewayahId;
  /** Active mushaf rewayah: the only one whose diff data is loaded. */
  mushafRewayah: RewayahId;
  showTajweed: boolean;
  indexedTajweedData: IndexedTajweedData | null;
  showRewayahDiffs: boolean;
}

/**
 * Rewayah highlights (foreground and whole-word background) are painted only
 * with 'Show differences' on, for non-Hafs text whose rewayah is the active
 * mushaf rewayah (rewayahDiffService holds that rewayah's diff data only).
 */
export function verseRewayahDiffsApply(
  input: Pick<
    VerseOverlayInput,
    'rewayah' | 'mushafRewayah' | 'showRewayahDiffs'
  >,
): boolean {
  return (
    input.showRewayahDiffs &&
    input.rewayah !== 'hafs' &&
    input.rewayah === input.mushafRewayah
  );
}

/**
 * Char→rule map: Hafs tajweed as the base layer (Hafs text only), rewayah
 * foreground categories + silah on top so rewayah rules win on overlap.
 */
export function computeVerseCharRuleMap(
  input: VerseOverlayInput,
): Map<number, string> | null {
  const tajweedMap =
    input.verseKey &&
    input.showTajweed &&
    input.indexedTajweedData &&
    input.rewayah === 'hafs'
      ? getVerseTajweedMap(input.verseKey, input.indexedTajweedData, {
          rewayah: input.rewayah,
          words: input.words,
        })
      : null;
  const rewayahMap =
    verseRewayahDiffsApply(input) && input.words.length > 0
      ? rewayahDiffService.getRewayahRuleMapForWords(input.words, input.rewayah)
      : null;
  if (!tajweedMap && !rewayahMap) return null;
  if (!rewayahMap) return tajweedMap;
  if (!tajweedMap) return rewayahMap;
  const merged = new Map(tajweedMap);
  for (const [k, v] of rewayahMap) merged.set(k, v);
  return merged;
}

/** Whole-word variant background ranges ('Show differences'). */
export function computeVerseDiffRanges(
  input: Pick<
    VerseOverlayInput,
    'words' | 'rewayah' | 'mushafRewayah' | 'showRewayahDiffs'
  >,
): DiffRange[] {
  if (!verseRewayahDiffsApply(input) || input.words.length === 0) return [];
  return rewayahDiffService.getDiffRangesForWords(input.words, input.rewayah);
}
