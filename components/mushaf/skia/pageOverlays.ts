import type {RewayahId} from '@/store/mushafSettingsStore';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import {getLineAllahNameCharMap} from '@/services/mushaf/AllahNameHighlightService';
import {getLineTajweedMap} from '@/services/mushaf/TajweedMappingService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService'; // @ai
import {
  rewayahDiffService,
  type PageDiffHighlight,
} from '@/services/mushaf/RewayahDiffService';

/**
 * Per-line overlay maps shared by the two mushaf page renderers (SkiaPage and
 * ContinuousMushafView), so both paint exactly the same thing. Every map is
 * indexed into the line string DigitalKhattDataService.getLineText renders
 * (the shared span model in services/mushaf/lineWordSpans.ts).
 *
 * `textRewayah` is the rewayah of the rendered text, i.e. the active DK words
 * cache (digitalKhattDataService.rewayah). Callers recompute these maps when
 * it, the settings, or the identity of the rendered text
 * (getPageTextIdentity) change.
 */

export type LineMaps = (Map<number, string> | null)[];

// @ai-start
/**
 * Identity of the text the page renderers draw: the data identity of the
 * active DK words cache (`<rewayah>@<wordsSha8>.<layoutSha8>`, see
 * DigitalKhattDataService.getLayoutIdentityKey), or null before the first
 * load. The renderers read it with
 * useSyncExternalStore(digitalKhattDataService.subscribeCacheChanges, ...): it
 * changes exactly when the served text changes (a rewayah switch or a data
 * reload) and not on the other cache events (a side-cache load, or a failed
 * one, for another rewayah; a failed switch), so those never re-render a
 * mounted page. Page layouts (justification) are only ever drawn with the
 * text identity they were computed for.
 */
export function getPageTextIdentity(): string | null {
  return digitalKhattDataService.getLayoutIdentityKey();
}
// @ai-end

/** Hafs (QPC) tajweed is only ever painted on Hafs text. */
export function isTajweedEnabled(
  showTajweed: boolean,
  textRewayah: RewayahId,
): boolean {
  return showTajweed && textRewayah === 'hafs';
}

/**
 * Rewayah highlights (whole-word background AND letter-level / silah
 * foreground) are painted only when 'Show differences' is on and the text is
 * not Hafs.
 */
export function isRewayahDiffPaintEnabled(
  showRewayahDiffs: boolean,
  textRewayah: RewayahId,
): boolean {
  return showRewayahDiffs && textRewayah !== 'hafs';
}

export function computeLineTajweedMaps(
  pageNumber: number,
  lineCount: number,
  indexedTajweedData: IndexedTajweedData | null,
  enabled: boolean,
): LineMaps | null {
  if (!enabled || !indexedTajweedData) return null;
  const maps: LineMaps = [];
  for (let i = 0; i < lineCount; i++) {
    maps.push(getLineTajweedMap(pageNumber, i, indexedTajweedData));
  }
  return maps;
}

export function computeLineAllahNameColorMaps(
  pageNumber: number,
  lineCount: number,
  color: string,
  enabled: boolean,
): LineMaps | null {
  if (!enabled) return null;
  const maps: LineMaps = [];
  for (let i = 0; i < lineCount; i++) {
    const charMap = getLineAllahNameCharMap(pageNumber, i);
    if (!charMap) {
      maps.push(null);
      continue;
    }
    const colorMap = new Map<number, string>();
    for (const key of charMap.keys()) colorMap.set(key, color);
    maps.push(colorMap);
  }
  return maps;
}

/**
 * Char→rule maps per line: tajweed (Hafs only) as the base layer, rewayah
 * foreground categories (+ silah) on top so rewayah rules win on overlap.
 * With `paintRewayahDiffs` false no rewayah foreground color is painted.
 */
export function computeLineCharRuleMaps(
  pageNumber: number,
  lineCount: number,
  tajweedMaps: LineMaps | null,
  paintRewayahDiffs: boolean,
): LineMaps | null {
  const withRewayah =
    paintRewayahDiffs && rewayahDiffService.hasForegroundDiffs;
  if (!tajweedMaps && !withRewayah) return null;

  const maps: LineMaps = [];
  for (let i = 0; i < lineCount; i++) {
    const tajweed = tajweedMaps?.[i] ?? null;
    const rewayahMap = withRewayah
      ? rewayahDiffService.getRewayahRuleMapForLine(pageNumber, i)
      : null;
    if (!rewayahMap) {
      maps.push(tajweed);
      continue;
    }
    if (!tajweed) {
      maps.push(rewayahMap);
      continue;
    }
    const merged = new Map(tajweed);
    for (const [k, v] of rewayahMap) merged.set(k, v);
    maps.push(merged);
  }
  return maps;
}

const NO_DIFF_HIGHLIGHTS: ReadonlyMap<
  number,
  readonly Readonly<PageDiffHighlight>[]
> = new Map();

/** Whole-word variant background tints per line ('Show differences'). */
export function computePageDiffBackgrounds(
  pageNumber: number,
  paintRewayahDiffs: boolean,
): ReadonlyMap<number, readonly Readonly<PageDiffHighlight>[]> {
  if (!paintRewayahDiffs || !rewayahDiffService.hasDiffs) {
    return NO_DIFF_HIGHLIGHTS;
  }
  return rewayahDiffService.getPageDiffHighlightsByLine(pageNumber);
}
