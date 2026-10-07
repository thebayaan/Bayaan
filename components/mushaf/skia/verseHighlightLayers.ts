// @ai-generated
/**
 * Background highlight layers of one mushaf page, shared by the two page
 * renderers (SkiaPage and ContinuousMushafView) so both paint exactly the
 * same thing. Pure: verse segments and theme lookups are passed in.
 *
 * Layers, lowest first (a later layer paints over an earlier one):
 *   -1  rewayah whole-word variant tints ('Show differences')
 *    0  theme zebra (SkiaPage only)
 *  0.5  bookmarks
 *    1  persistent colour highlights
 *    2  playback (follow-along)
 *    3  selection
 * A verse painted by a higher verse layer is skipped by the lower ones.
 *
 * Playback paints EVERY Hafs verse the reciter is reciting: one reciter verse
 * can cover several Hafs verses (Warsh 2:1 recites Hafs 2:1 and 2:2), and the
 * whole unit is highlighted, joined across the separator between consecutive
 * verses on a line so it reads as the single verse the reciter recites. A
 * Hafs recitation always has one playback key, so its output is unchanged.
 */

export interface LineHighlight {
  start: number;
  end: number;
  color: string;
}

export type LineHighlightMap = Map<number, LineHighlight[]>;

export interface VerseLineSegment {
  lineIndex: number;
  segment: {startCharIndex: number; endCharIndex: number};
}

export interface PageHighlightLayersInput {
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
export function computePageHighlightLayers(
  input: PageHighlightLayersInput,
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
