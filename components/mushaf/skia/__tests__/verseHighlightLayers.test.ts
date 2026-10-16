// @ai-generated
/**
 * Page highlight layers (SkiaPage / ContinuousMushafView): the follow-along
 * highlight paints every Hafs verse the reciter is reciting, and with a single
 * playback verse (every Hafs recitation) the result is identical to the
 * previous inline implementation, reproduced verbatim below as the oracle.
 */

import {
  computePageHighlightLayers,
  type LineHighlight,
  type PageHighlightLayersInput,
  type VerseLineSegment,
} from '../verseHighlightLayers';

const PLAY = 'play';
const SELECT = 'select';
const BOOKMARK = 'bookmark';
const THEME = 'theme';
const DIFF = 'diff';
const COLORS: Record<string, string> = {yellow: 'Y', green: 'G'};

/**
 * A fake page: line text is verse words joined by single spaces, verse after
 * verse, like the DigitalKhatt line text; segment ends are inclusive.
 */
function fakePage(lines: {verse: string; length: number}[][]) {
  const segments = new Map<string, VerseLineSegment[]>();
  const order: string[] = [];
  lines.forEach((line, lineIndex) => {
    let pos = 0;
    for (const {verse, length} of line) {
      const seg = {startCharIndex: pos, endCharIndex: pos + length - 1};
      if (!segments.has(verse)) {
        segments.set(verse, []);
        order.push(verse);
      }
      segments.get(verse)!.push({lineIndex, segment: seg});
      pos += length + 1; // single space separator
    }
  });
  return {
    getVerseSegments: (vk: string) => segments.get(vk) ?? [],
    order,
  };
}

// Warsh 2:1 recites Hafs 2:1 + 2:2; Hafs 2:2 continues on line 1.
const page = fakePage([
  [
    {verse: '2:1', length: 5},
    {verse: '2:2', length: 20},
  ],
  [
    {verse: '2:2', length: 12},
    {verse: '2:3', length: 30},
  ],
  [
    {verse: '2:3', length: 8},
    {verse: '2:4', length: 25},
    {verse: '2:5', length: 10},
  ],
]);

function input(
  overrides: Partial<PageHighlightLayersInput>,
): PageHighlightLayersInput {
  return {
    getVerseSegments: page.getVerseSegments,
    diffHighlights: new Map(),
    themes: null,
    bookmarkedVerseKeys: new Set(),
    bookmarkColor: BOOKMARK,
    persistentHighlights: {},
    highlightColors: COLORS,
    playbackVerseKeys: [],
    playbackColor: PLAY,
    selectedVerseKeys: null,
    selectionColor: SELECT,
    ...overrides,
  };
}

const byColor = (
  map: Map<number, LineHighlight[]> | null,
  line: number,
  color: string,
) => (map?.get(line) ?? []).filter(h => h.color === color);

describe('follow-along highlight with several Hafs verses', () => {
  it('paints every recited Hafs verse, joined across the separator', () => {
    const map = computePageHighlightLayers(
      input({playbackVerseKeys: ['2:1', '2:2']}),
    );
    // line 0: "2:1" [0-4] + space + "2:2" [6-25] -> one run
    expect(byColor(map, 0, PLAY)).toEqual([{start: 0, end: 25, color: PLAY}]);
    // line 1: the rest of 2:2
    expect(byColor(map, 1, PLAY)).toEqual([{start: 0, end: 11, color: PLAY}]);
    expect(byColor(map, 2, PLAY)).toEqual([]);
  });

  it('three verses over two lines (one reciter verse, three Hafs verses)', () => {
    const map = computePageHighlightLayers(
      input({playbackVerseKeys: ['2:3', '2:4', '2:5']}),
    );
    expect(byColor(map, 1, PLAY)).toEqual([{start: 13, end: 42, color: PLAY}]);
    expect(byColor(map, 2, PLAY)).toEqual([{start: 0, end: 44, color: PLAY}]);
  });

  it('every recited verse wins over lower layers, not just the first', () => {
    const map = computePageHighlightLayers(
      input({
        playbackVerseKeys: ['2:1', '2:2'],
        bookmarkedVerseKeys: new Set(['2:2', '2:4']),
        persistentHighlights: {'2:2': 'green', '2:5': 'yellow'},
        themes: {
          verseKeys: page.order,
          color: THEME,
          themeIndexOf: () => 0,
        },
      }),
    );
    for (const line of [0, 1]) {
      const colors = (map?.get(line) ?? []).map(h => h.color);
      expect(colors).not.toContain(BOOKMARK);
      expect(colors).not.toContain('G');
    }
    // verses that are not recited keep their own layers
    expect(byColor(map, 2, BOOKMARK)).toEqual([
      {start: 9, end: 33, color: BOOKMARK},
    ]);
    expect(byColor(map, 2, 'Y')).toEqual([{start: 35, end: 44, color: 'Y'}]);
    expect(byColor(map, 1, THEME)).toEqual([
      {start: 13, end: 42, color: THEME},
    ]);
  });

  it('a selected verse is painted as selected and splits the run', () => {
    const map = computePageHighlightLayers(
      input({
        playbackVerseKeys: ['2:3', '2:4', '2:5'],
        selectedVerseKeys: ['2:4'],
      }),
    );
    expect(byColor(map, 2, PLAY)).toEqual([
      {start: 0, end: 7, color: PLAY},
      {start: 35, end: 44, color: PLAY},
    ]);
    expect(byColor(map, 2, SELECT)).toEqual([
      {start: 9, end: 33, color: SELECT},
    ]);
  });

  it('keeps the layer order: diff < bookmark < colour < playback < selection', () => {
    const map = computePageHighlightLayers(
      input({
        diffHighlights: new Map([[2, [{start: 1, end: 2, color: DIFF}]]]),
        playbackVerseKeys: ['2:4', '2:5'],
        bookmarkedVerseKeys: new Set(['2:3']),
        persistentHighlights: {'2:3': 'yellow'},
        selectedVerseKeys: ['2:3'],
      }),
    );
    expect((map?.get(2) ?? []).map(h => h.color)).toEqual([DIFF, PLAY, SELECT]);
  });

  it('paints nothing at all when there is nothing to paint', () => {
    expect(computePageHighlightLayers(input({}))).toBeNull();
  });
});

// ── Oracle: the inline implementation this helper replaced ─────────────────

interface LegacyArgs {
  pageVerseKeys: string[];
  getVerseSegments: (vk: string) => readonly VerseLineSegment[];
  persistentHighlights: Record<string, string>;
  bookmarkedVerseKeys: Set<string>;
  playbackVerseKey: string | null;
  diffHighlights: Map<number, LineHighlight[]>;
  selectedVerseKeys: string[];
  selectedPageNumber: number | null;
  pageNumber: number;
  showThemes: boolean;
  themeIndexOf: (vk: string) => number | undefined;
}

const EMPTY = new Map<number, LineHighlight[]>();

/** SkiaPage's previous lineBackgroundHighlightsMap body, verbatim logic. */
function legacy(a: LegacyArgs): Map<number, LineHighlight[]> {
  const hasAnnotations = Object.keys(a.persistentHighlights).length > 0;
  const hasBookmarks = a.bookmarkedVerseKeys.size > 0;
  const hasPlayback = !!a.playbackVerseKey;
  const diffHighlights = a.diffHighlights;
  const hasRewayahDiffs = diffHighlights.size > 0;
  const selectedSet =
    a.selectedVerseKeys.length > 0 && a.selectedPageNumber === a.pageNumber
      ? new Set(a.selectedVerseKeys)
      : null;
  if (
    !hasAnnotations &&
    !hasBookmarks &&
    !hasPlayback &&
    !selectedSet &&
    !a.showThemes &&
    !hasRewayahDiffs
  )
    return EMPTY;
  const map = new Map<number, LineHighlight[]>();
  const addVerseHighlight = (vk: string, color: string) => {
    for (const {lineIndex, segment} of a.getVerseSegments(vk)) {
      let arr = map.get(lineIndex);
      if (!arr) {
        arr = [];
        map.set(lineIndex, arr);
      }
      arr.push({
        start: segment.startCharIndex,
        end: segment.endCharIndex,
        color,
      });
    }
  };
  if (hasRewayahDiffs) {
    for (const [lineIndex, entries] of diffHighlights) {
      let arr = map.get(lineIndex);
      if (!arr) {
        arr = [];
        map.set(lineIndex, arr);
      }
      for (const entry of entries) arr.push(entry);
    }
  }
  if (a.showThemes) {
    for (const vk of a.pageVerseKeys) {
      if (a.persistentHighlights[vk]) continue;
      if (a.bookmarkedVerseKeys.has(vk)) continue;
      if (a.playbackVerseKey === vk) continue;
      if (selectedSet?.has(vk)) continue;
      const themeIndex = a.themeIndexOf(vk);
      if (themeIndex === undefined) continue;
      if (themeIndex % 2 !== 0) continue;
      addVerseHighlight(vk, THEME);
    }
  }
  for (const verseKey of a.bookmarkedVerseKeys) {
    if (a.persistentHighlights[verseKey]) continue;
    if (a.playbackVerseKey === verseKey) continue;
    if (selectedSet?.has(verseKey)) continue;
    addVerseHighlight(verseKey, BOOKMARK);
  }
  for (const [verseKey, colorName] of Object.entries(a.persistentHighlights)) {
    if (selectedSet?.has(verseKey)) continue;
    if (a.playbackVerseKey === verseKey) continue;
    const color = COLORS[colorName];
    if (!color) continue;
    addVerseHighlight(verseKey, color);
  }
  if (a.playbackVerseKey && !selectedSet?.has(a.playbackVerseKey)) {
    addVerseHighlight(a.playbackVerseKey, PLAY);
  }
  if (selectedSet) {
    for (const vk of a.selectedVerseKeys) addVerseHighlight(vk, SELECT);
  }
  return map;
}

/** Deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe('single playback verse (Hafs): identical to the previous code', () => {
  it('matches the oracle on 3,000 random pages and annotation states', () => {
    const rand = rng(20261006);
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
    const subset = (xs: readonly string[], p: number) =>
      xs.filter(() => rand() < p);
    let compared = 0;
    for (let i = 0; i < 3000; i++) {
      const lineCount = 1 + Math.floor(rand() * 6);
      let verse = 1 + Math.floor(rand() * 20);
      const lines: {verse: string; length: number}[][] = [];
      for (let l = 0; l < lineCount; l++) {
        const line: {verse: string; length: number}[] = [];
        const n = 1 + Math.floor(rand() * 3);
        for (let k = 0; k < n; k++) {
          line.push({verse: `2:${verse}`, length: 3 + Math.floor(rand() * 40)});
          if (k < n - 1 || rand() < 0.6) verse++;
        }
        lines.push(line);
      }
      const p = fakePage(lines);
      const keys = p.order;
      const playback = rand() < 0.7 ? pick(keys) : null;
      const persistent: Record<string, string> = {};
      for (const k of subset(keys, 0.2)) {
        persistent[k] = pick(['yellow', 'green', 'unknown']);
      }
      const bookmarks = new Set(subset(keys, 0.2));
      const selected = rand() < 0.4 ? subset(keys, 0.3) : [];
      const selectionOnPage = rand() < 0.8;
      const showThemes = rand() < 0.4;
      const themeIndex = new Map(keys.map(k => [k, Math.floor(rand() * 4)]));
      const themeIndexOf = (k: string) =>
        rand() < 0.1 ? undefined : themeIndex.get(k);
      const diff = new Map<number, LineHighlight[]>();
      if (rand() < 0.3) {
        diff.set(0, [{start: 0, end: 2, color: DIFF}]);
      }
      // the theme lookup is random per call: fix one answer per key so both
      // implementations see the same themes
      const themeAnswer = new Map(keys.map(k => [k, themeIndexOf(k)]));

      const expected = legacy({
        pageVerseKeys: keys,
        getVerseSegments: p.getVerseSegments,
        persistentHighlights: persistent,
        bookmarkedVerseKeys: bookmarks,
        playbackVerseKey: playback,
        diffHighlights: diff,
        selectedVerseKeys: selected,
        selectedPageNumber: selectionOnPage ? 7 : 8,
        pageNumber: 7,
        showThemes,
        themeIndexOf: k => themeAnswer.get(k),
      });
      const actual = computePageHighlightLayers({
        getVerseSegments: p.getVerseSegments,
        diffHighlights: diff,
        themes: showThemes
          ? {
              verseKeys: keys,
              color: THEME,
              themeIndexOf: k => themeAnswer.get(k),
            }
          : null,
        bookmarkedVerseKeys: bookmarks,
        bookmarkColor: BOOKMARK,
        persistentHighlights: persistent,
        highlightColors: COLORS,
        playbackVerseKeys: playback ? [playback] : [],
        playbackColor: PLAY,
        selectedVerseKeys:
          selected.length > 0 && selectionOnPage ? selected : null,
        selectionColor: SELECT,
      });
      if (expected === EMPTY) {
        expect(actual).toBeNull();
      } else {
        expect(actual).not.toBeNull();
        expect([...actual!.entries()]).toEqual([...expected.entries()]);
      }
      compared++;
    }
    expect(compared).toBe(3000);
  });
});
