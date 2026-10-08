// @ai-generated
/**
 * Test-only: the Hafs-keyed verse pipeline of the mushaf pages EXACTLY as it
 * was at the release base (7de55bda), before verse units, frozen here so the
 * Hafs differential tests compare the shipped pipeline with the base code
 * itself (not with code that might change along with it):
 *  - baseVerseSegments & co.: MushafVerseMapService's Hafs verse segments,
 *    page order, hit-test and per-verse segments (verbatim logic);
 *  - baseComputePageHighlightLayers: verseHighlightLayers.ts, verbatim;
 *  - basePayloadForKeys: the verse-actions payload SkiaPage and
 *    ContinuousMushafView built from the selected keys.
 *
 * Not imported by app code.
 */
import type {DKLine} from '../DigitalKhattDataService';
import {getLineWordSpans, type WordSlotSource} from '../lineWordSpans';

/** The data-service reads the base segment code made. */
export interface BaseSegmentSource extends WordSlotSource {
  getPageLines(pageNumber: number): DKLine[];
}

export interface BaseVerseSegment {
  verseKey: string; // "2:255"
  surahNumber: number;
  ayahNumber: number;
  startCharIndex: number; // in line text
  endCharIndex: number; // in line text
  firstWordId: number;
  lastWordId: number;
}

// ── MushafVerseMapService (7de55bda), without its caches ─────────────────

export function baseVerseSegments(
  dk: BaseSegmentSource,
  pageNumber: number,
  lineIndex: number,
): BaseVerseSegment[] {
  const lines = dk.getPageLines(pageNumber);
  if (lineIndex >= lines.length) return [];

  // Surah-name and basmallah lines have no word slots, hence no segments.
  const spans = getLineWordSpans(lines[lineIndex], dk);
  if (spans.length === 0) return [];

  const segments: BaseVerseSegment[] = [];
  let currentSegment: BaseVerseSegment | null = null;

  for (const span of spans) {
    const verseKey = span.info.verseKey;

    if (currentSegment && currentSegment.verseKey === verseKey) {
      // Extend current segment (covers the space before this slot too)
      currentSegment.endCharIndex = span.end;
      currentSegment.lastWordId = span.wordId;
    } else {
      // Start new segment
      const parts: string[] = verseKey.split(':');
      currentSegment = {
        verseKey,
        surahNumber: parseInt(parts[0], 10),
        ayahNumber: parseInt(parts[1], 10),
        startCharIndex: span.start,
        endCharIndex: span.end,
        firstWordId: span.wordId,
        lastWordId: span.wordId,
      };
      segments.push(currentSegment);
    }
  }

  return segments;
}

export function baseOrderedVerseKeysForPage(
  dk: BaseSegmentSource,
  pageNumber: number,
): string[] {
  const lines = dk.getPageLines(pageNumber);
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const segments = baseVerseSegments(dk, pageNumber, i);
    for (const segment of segments) {
      if (!seen.has(segment.verseKey)) {
        seen.add(segment.verseKey);
        ordered.push(segment.verseKey);
      }
    }
  }

  return ordered;
}

export function baseFindVerseAtCharIndex(
  dk: BaseSegmentSource,
  pageNumber: number,
  lineIndex: number,
  charIndex: number,
): BaseVerseSegment | null {
  const segments = baseVerseSegments(dk, pageNumber, lineIndex);
  for (const segment of segments) {
    if (
      charIndex >= segment.startCharIndex &&
      charIndex <= segment.endCharIndex
    ) {
      return segment;
    }
  }
  return null;
}

export function baseVerseSegmentsForPage(
  dk: BaseSegmentSource,
  pageNumber: number,
  verseKey: string,
): {lineIndex: number; segment: BaseVerseSegment}[] {
  const lines = dk.getPageLines(pageNumber);
  const results: {lineIndex: number; segment: BaseVerseSegment}[] = [];

  for (let i = 0; i < lines.length; i++) {
    const segments = baseVerseSegments(dk, pageNumber, i);
    for (const segment of segments) {
      if (segment.verseKey === verseKey) {
        results.push({lineIndex: i, segment});
      }
    }
  }

  return results;
}

// ── SkiaPage / ContinuousMushafView handleDragEnd payload (7de55bda) ─────

export function basePayloadForKeys(keys: readonly string[]): {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  verseKeys: string[] | undefined;
  source: 'mushaf';
} | null {
  if (keys.length === 0) return null;

  const firstKey = keys[0];
  const [surahStr, ayahStr] = firstKey.split(':');
  const surahNumber = parseInt(surahStr, 10);
  const ayahNumber = parseInt(ayahStr, 10);

  return {
    verseKey: firstKey,
    surahNumber,
    ayahNumber,
    verseKeys: keys.length > 1 ? [...keys] : undefined,
    source: 'mushaf',
  };
}

// ── verseHighlightLayers.ts (7de55bda), verbatim ─────────────────────────

interface LineHighlight {
  start: number;
  end: number;
  color: string;
}

type LineHighlightMap = Map<number, LineHighlight[]>;

interface VerseLineSegment {
  lineIndex: number;
  segment: {startCharIndex: number; endCharIndex: number};
}

export interface BasePageHighlightLayersInput {
  /** Segments of a verse on this page, one per line it occupies. */
  getVerseSegments: (verseKey: string) => readonly VerseLineSegment[];
  /** Layer -1, per line (already gated on 'Show differences'). */
  diffHighlights: ReadonlyMap<number, readonly Readonly<LineHighlight>[]>;
  /** Layer 0, or null when themes are off (or not drawn by the renderer). */
  themes: {
    verseKeys: readonly string[];
    color: string;
    /** Theme index of a verse; undefined when it has no theme. */
    themeIndexOf: (verseKey: string) => number | undefined;
  } | null;
  bookmarkedVerseKeys: ReadonlySet<string>;
  bookmarkColor: string;
  /** Verse key -> colour name. */
  persistentHighlights: Readonly<Record<string, string>>;
  /** Colour name -> colour. */
  highlightColors: Readonly<Record<string, string>>;
  /** Hafs verse keys being recited, in reading order (empty when idle). */
  playbackVerseKeys: readonly string[];
  playbackColor: string;
  /** Selected verse keys when the selection is on this page, else null. */
  selectedVerseKeys: readonly string[] | null;
  selectionColor: string;
}

/**
 * Highlights per line index, or null when nothing at all can be painted (the
 * caller substitutes its shared empty map).
 */
export function baseComputePageHighlightLayers(
  input: BasePageHighlightLayersInput,
): LineHighlightMap | null {
  const {
    getVerseSegments,
    diffHighlights,
    themes,
    bookmarkedVerseKeys,
    bookmarkColor,
    persistentHighlights,
    highlightColors,
    playbackVerseKeys,
    playbackColor,
    selectedVerseKeys,
    selectionColor,
  } = input;

  const hasAnnotations = Object.keys(persistentHighlights).length > 0;
  const hasBookmarks = bookmarkedVerseKeys.size > 0;
  const hasPlayback = playbackVerseKeys.length > 0;
  const hasRewayahDiffs = diffHighlights.size > 0;
  const selectedSet = selectedVerseKeys ? new Set(selectedVerseKeys) : null;
  const playbackSet = new Set(playbackVerseKeys);

  if (
    !hasAnnotations &&
    !hasBookmarks &&
    !hasPlayback &&
    !selectedSet &&
    !themes &&
    !hasRewayahDiffs
  ) {
    return null;
  }

  const map: LineHighlightMap = new Map();
  const lineArray = (lineIndex: number): LineHighlight[] => {
    let arr = map.get(lineIndex);
    if (!arr) {
      arr = [];
      map.set(lineIndex, arr);
    }
    return arr;
  };
  const addVerseHighlight = (verseKey: string, color: string) => {
    for (const {lineIndex, segment} of getVerseSegments(verseKey)) {
      lineArray(lineIndex).push({
        start: segment.startCharIndex,
        end: segment.endCharIndex,
        color,
      });
    }
  };

  // Layer -1: rewayah diff tints (painted first, overdrawn by any verse layer)
  if (hasRewayahDiffs) {
    for (const [lineIndex, entries] of diffHighlights) {
      const arr = lineArray(lineIndex);
      for (const entry of entries) arr.push(entry);
    }
  }

  // Layer 0: theme zebra (lowest verse layer)
  if (themes) {
    for (const vk of themes.verseKeys) {
      // Skip verses that will be painted by a higher layer
      if (persistentHighlights[vk]) continue;
      if (bookmarkedVerseKeys.has(vk)) continue;
      if (playbackSet.has(vk)) continue;
      if (selectedSet?.has(vk)) continue;
      const themeIndex = themes.themeIndexOf(vk);
      if (themeIndex === undefined) continue;
      // Only paint even-indexed themes; odd themes stay transparent (zebra)
      if (themeIndex % 2 !== 0) continue;
      addVerseHighlight(vk, themes.color);
    }
  }

  // Layer 0.5: bookmarks (a colour highlight, playback or selection wins)
  for (const vk of bookmarkedVerseKeys) {
    if (persistentHighlights[vk]) continue;
    if (playbackSet.has(vk)) continue;
    if (selectedSet?.has(vk)) continue;
    addVerseHighlight(vk, bookmarkColor);
  }

  // Layer 1: persistent colour highlights
  for (const [vk, colorName] of Object.entries(persistentHighlights)) {
    if (selectedSet?.has(vk)) continue;
    if (playbackSet.has(vk)) continue;
    const color = highlightColors[colorName];
    if (!color) continue;
    addVerseHighlight(vk, color);
  }

  // Layer 2: playback, every recited Hafs verse (a selected verse is skipped)
  const joinRuns = playbackVerseKeys.length > 1;
  const playbackRuns = new Map<number, LineHighlight[]>();
  for (const vk of playbackVerseKeys) {
    if (selectedSet?.has(vk)) continue;
    for (const {lineIndex, segment} of getVerseSegments(vk)) {
      let runs = playbackRuns.get(lineIndex);
      if (!runs) {
        runs = [];
        playbackRuns.set(lineIndex, runs);
      }
      const last = runs[runs.length - 1];
      // Consecutive recited verses on one line are separated by a single
      // space (segment ends are inclusive): draw them as one run.
      if (
        joinRuns &&
        last &&
        segment.startCharIndex > last.end &&
        segment.startCharIndex <= last.end + 2
      ) {
        last.end = segment.endCharIndex;
      } else {
        runs.push({
          start: segment.startCharIndex,
          end: segment.endCharIndex,
          color: playbackColor,
        });
      }
    }
  }
  for (const [lineIndex, runs] of playbackRuns) {
    lineArray(lineIndex).push(...runs);
  }

  // Layer 3: selection (highest)
  if (selectedVerseKeys) {
    for (const vk of selectedVerseKeys) addVerseHighlight(vk, selectionColor);
  }

  return map;
}
