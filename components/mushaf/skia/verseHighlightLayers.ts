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
 *
 * Verse units (@ai): the renderers pass the keys of the shown text's verse
 * units (the rewayah's own verses, MushafVerseMapService unit segments), so
 * every layer paints whole units and nothing straddles a unit boundary.
 * unitKeyedVerseLayers() maps the stores' values (stored rows, the playback
 * band, the selection) to those keys; for Hafs a unit is its Hafs verse and
 * the mapping is the identity.
 */

// @ai-start
import type {ShownVerseUnits} from '@/services/mushaf/MushafVerseMapService';
import {parseUnitKey} from '@/services/mushaf/RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {TimingNumberingMode} from '@/utils/timestampNumbering';
// @ai-end

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

// @ai-start
// ── Verse units: store values -> unit keys of the shown text ──────────────

/** What the player is reciting, as the follow-along band needs it. */
export interface PlaybackBand {
  /** Hafs verse keys the current timing entry recites (empty when idle). */
  readonly hafsKeys: readonly string[];
  /** Numbering of the loaded timing set, or null. */
  readonly mode: TimingNumberingMode | null;
  /** The reciter's rewayah (the numbering of a 'riwayah' set). */
  readonly reciterRewayah: RewayahId | null;
  /** The current timing entry's key in the set's numbering, or null. */
  readonly entryKey: string | null;
}

export const NO_PLAYBACK_BAND: PlaybackBand = Object.freeze({
  hafsKeys: Object.freeze([]) as readonly string[],
  mode: null,
  reciterRewayah: null,
  entryKey: null,
});

/**
 * The follow-along band as unit keys of the shown text (verse-units
 * contract 4.2): for a set numbered in the shown rewayah itself, exactly the
 * unit the entry is (Warsh reciter on the Warsh mushaf: Warsh 1:6 lights
 * Warsh 1:6 only, not the Warsh 1:7 that shares Hafs 1:7 with it); otherwise
 * every unit holding a Hafs verse the entry recites (a Hafs-numbered entry
 * of a split Hafs verse recites both parts, so both are lit). Empty when
 * idle, when nothing is tracked (the unnumbered basmala before verse 1) or
 * when the text has no units.
 */
export function playbackBandUnitKeys(
  shown: ShownVerseUnits | null,
  band: PlaybackBand,
): string[] {
  if (!shown || band.hafsKeys.length === 0) return [];
  if (
    band.mode === 'riwayah' &&
    band.reciterRewayah === shown.rewayah &&
    band.entryKey
  ) {
    const entry = parseUnitKey(band.entryKey);
    const key = entry ? shown.unitKeyByRef(entry.surah, entry.ayah) : null;
    if (key) return [key];
  }
  return shown.unitKeysForHafsKeys(band.hafsKeys);
}

/** A stored bookmark / highlight row, as the verse layers read it. */
export interface StoredRowRef {
  /** verse_key: a Hafs storage anchor, "S:A" or "S:A:W". */
  readonly verseKey: string;
  /** rewayah_id the row was saved in; null / undefined (legacy): Hafs. */
  readonly rewayahId?: RewayahId | null;
}

/** Store values the verse layers paint, before mapping to the shown units. */
export interface PageVerseLayerSources {
  /** verse_key (storage anchor) of every bookmark row in the store. */
  bookmarkedVerseKeys: ReadonlySet<string>;
  /** verse_key (storage anchor) -> colour name of every highlight row. */
  persistentHighlights: Readonly<Record<string, string>>;
  /**
   * The bookmark / highlight rows behind the two fields above, by verse_key,
   * with the rewayah each was saved in (the annotations store's bookmarkRows
   * / highlightRows; the page renderers pass them). A row given here follows
   * the storage rule: a Hafs row marks every unit holding its Hafs verse.
   * (Shown in Hafs, a row of any rewayah marks the Hafs verse its key names
   * and a mid-verse anchor none, as the Hafs sheet reads rows: see
   * HAFS_SHOWN_UNITS.unitKeysForStoredVerse.)
   * Without them every row is read as an anchor of the shown rewayah
   * (exactly the unit it names; a Hafs row of a split Hafs verse then marks
   * its first part only).
   */
  bookmarkRows?: Readonly<Record<string, StoredRowRef>>;
  highlightRows?: Readonly<Record<string, StoredRowRef>>;
  playback: PlaybackBand;
  /**
   * The band already as unit keys of the shown rewayah (the player store's
   * own unit band, where it publishes one); used instead of `playback`.
   */
  playbackUnitKeys?: readonly string[] | null;
  /** The selection when it is on this page, else null. */
  selection: {
    rewayah: RewayahId | null;
    verseKeys: readonly string[];
  } | null;
}

/** The PageHighlightLayersInput fields that name verses, as unit keys. */
export interface UnitKeyedVerseLayers {
  bookmarkedVerseKeys: ReadonlySet<string>;
  persistentHighlights: Readonly<Record<string, string>>;
  playbackVerseKeys: readonly string[];
  selectedVerseKeys: readonly string[] | null;
}

const NO_UNIT_LAYERS: UnitKeyedVerseLayers = Object.freeze({
  bookmarkedVerseKeys: new Set<string>(),
  persistentHighlights: Object.freeze({}),
  playbackVerseKeys: Object.freeze([]) as readonly string[],
  selectedVerseKeys: null,
});

/**
 * Maps the stores' values to unit keys of the shown text, so that every
 * layer paints exactly whole units:
 *  - bookmarks / colour highlights: the units each stored row marks (the
 *    storage rule of the verse-units contract, section 3). A unit marked by
 *    several highlight rows takes the colour of, in order: a row of the
 *    shown rewayah at the unit's own anchor (what marking the unit writes),
 *    another row of the shown rewayah, a Hafs row, a row of another rewayah;
 *    on a tie the row with the earlier anchor, then the smaller verse_key
 *    (the same rule as the annotations' deriveUnitAnnotations);
 *  - playback: playbackBandUnitKeys;
 *  - selection: its own keys when made in the shown rewayah; a Hafs-keyed
 *    selection (QCF, routes, navigation) lights the units holding those
 *    Hafs verses; a selection in another rewayah's numbering is not shown.
 * With no units (a non-Hafs text whose units were refused) nothing is
 * painted as a verse. For Hafs the result equals the inputs, for rows of
 * any rewayah, less the keys that name no Hafs verse (another rewayah's
 * mid-verse anchors, malformed keys), which the Hafs pipeline before verse
 * units never painted either.
 */
export function unitKeyedVerseLayers(
  shown: ShownVerseUnits | null,
  sources: PageVerseLayerSources,
): UnitKeyedVerseLayers {
  if (!shown) return NO_UNIT_LAYERS;
  // The rewayah a row was saved in: from its row when known (null = legacy,
  // Hafs), else the shown rewayah (see PageVerseLayerSources).
  const rowOf = (
    rows: Readonly<Record<string, StoredRowRef>> | undefined,
    verseKey: string,
  ): {verseKey: string; rewayahId: RewayahId} => {
    const row = rows?.[verseKey];
    return {
      verseKey,
      rewayahId: row ? (row.rewayahId ?? 'hafs') : shown.rewayah,
    };
  };

  const bookmarkedVerseKeys = new Set<string>();
  for (const verseKey of sources.bookmarkedVerseKeys) {
    const row = rowOf(sources.bookmarkRows, verseKey);
    for (const key of shown.unitKeysForStoredVerse(row)) {
      bookmarkedVerseKeys.add(key);
    }
  }

  const persistentHighlights: Record<string, string> = {};
  // The row whose colour a unit takes so far: rank, then the earlier anchor,
  // then the smaller verse_key (the annotations' own tie rule, so the tint
  // and the verse-actions sheet agree on a unit's colour). @ai
  const colourPick = new Map<
    string,
    {rank: number; order: number; verseKey: string}
  >();
  for (const [verseKey, color] of Object.entries(
    sources.persistentHighlights,
  )) {
    const row = rowOf(sources.highlightRows, verseKey);
    const order = shown.anchorOrder(verseKey);
    for (const key of shown.unitKeysForStoredVerse(row)) {
      let rank = 0;
      if (row.rewayahId === shown.rewayah) {
        rank = shown.describe(key)?.anchor === verseKey ? 3 : 2;
      } else if (row.rewayahId === 'hafs') {
        rank = 1;
      }
      const current = colourPick.get(key);
      if (
        !current ||
        rank > current.rank ||
        (rank === current.rank &&
          (order < current.order ||
            (order === current.order && verseKey < current.verseKey)))
      ) {
        colourPick.set(key, {rank, order, verseKey});
        persistentHighlights[key] = color;
      }
    }
  }

  let selectedVerseKeys: string[] | null = null;
  const selection = sources.selection;
  if (selection && selection.verseKeys.length > 0) {
    const keys =
      selection.rewayah === shown.rewayah
        ? [...selection.verseKeys]
        : selection.rewayah === 'hafs'
          ? shown.unitKeysForHafsKeys(selection.verseKeys)
          : [];
    selectedVerseKeys = keys.length > 0 ? keys : null;
  }

  return {
    bookmarkedVerseKeys,
    persistentHighlights,
    playbackVerseKeys:
      sources.playbackUnitKeys ?? playbackBandUnitKeys(shown, sources.playback),
    selectedVerseKeys,
  };
}

/**
 * Theme zebra index of a unit: themes are Hafs-aligned, so a unit takes the
 * theme of the Hafs verse it starts in (for Hafs: the verse's own theme).
 */
export function unitThemeIndex(
  shown: ShownVerseUnits | null,
  unitKey: string,
  themeIndexOfHafsVerse: (hafsKey: string) => number | undefined,
): number | undefined {
  const hafsKey = shown?.describe(unitKey)?.hafsKeys[0];
  return hafsKey === undefined ? undefined : themeIndexOfHafsVerse(hafsKey);
}

/** Unit segments of the shown text (mushafVerseMapService provides them). */
export interface UnitSegmentSource {
  getUnitSegmentsForPage(
    pageNumber: number,
    unitKey: string,
  ): readonly VerseLineSegment[];
  getOrderedUnitKeysForPage(pageNumber: number): readonly string[];
}

/** What the page renderers (SkiaPage, ContinuousMushafView) pass in. */
export interface UnitPageHighlightInput {
  pageNumber: number;
  /** MushafVerseMapService.getShownVerseUnits(): null paints no verse. */
  shown: ShownVerseUnits | null;
  segments: UnitSegmentSource;
  /** Layer -1, per line (already gated on 'Show differences'). */
  diffHighlights: ReadonlyMap<number, readonly Readonly<LineHighlight>[]>;
  /**
   * Theme zebra (themes are Hafs-aligned: see unitThemeIndex), or null when
   * themes are off or not drawn by the renderer.
   */
  themes: {
    color: string;
    themeIndexOfHafsVerse: (hafsKey: string) => number | undefined;
  } | null;
  sources: PageVerseLayerSources;
  bookmarkColor: string;
  highlightColors: Readonly<Record<string, string>>;
  playbackColor: string;
  selectionColor: string;
}

/**
 * The highlight layers of one page in verse units of the shown text: the
 * stores' values mapped by unitKeyedVerseLayers, painted from the unit
 * segments, so every verse layer paints exactly whole units, split at unit
 * boundaries (also at an inline verse marker inside a line). For Hafs this
 * is exactly what the Hafs-keyed pipeline painted (proved on all 604 pages
 * by mushafVerseUnits.alldbs.test.ts). Null when nothing can be painted.
 */
export function computeUnitPageHighlightLayers(
  input: UnitPageHighlightInput,
): LineHighlightMap | null {
  const {pageNumber, shown, segments, themes} = input;
  const unitLayers = unitKeyedVerseLayers(shown, input.sources);
  return computePageHighlightLayers({
    getVerseSegments: unitKey =>
      segments.getUnitSegmentsForPage(pageNumber, unitKey),
    diffHighlights: input.diffHighlights,
    themes: themes
      ? {
          verseKeys: segments.getOrderedUnitKeysForPage(pageNumber),
          color: themes.color,
          themeIndexOf: unitKey =>
            unitThemeIndex(shown, unitKey, themes.themeIndexOfHafsVerse),
        }
      : null,
    bookmarkedVerseKeys: unitLayers.bookmarkedVerseKeys,
    bookmarkColor: input.bookmarkColor,
    persistentHighlights: unitLayers.persistentHighlights,
    highlightColors: input.highlightColors,
    playbackVerseKeys: unitLayers.playbackVerseKeys,
    playbackColor: input.playbackColor,
    selectedVerseKeys: unitLayers.selectedVerseKeys,
    selectionColor: input.selectionColor,
  });
}
// @ai-end
