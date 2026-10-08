// @ai-generated
/**
 * Mushaf verse overlays in verse units (decision 3): bookmarks, colour
 * highlights, the follow-along band and the selection paint exactly the
 * shown rewayah's own verses, split at unit boundaries (also at an inline
 * verse marker mid-line), never a Hafs verse range. Real Release 1 slots
 * (verseUnitsFixture.json) on the real page-1 layout and synthetic pages.
 *
 * Hafs: the unit pipeline paints exactly what the previous Hafs pipeline
 * painted (here on the fixture pages; on all 604 pages in
 * services/mushaf/__tests__/mushafVerseUnits.alldbs.test.ts).
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@/services/mushaf/DigitalKhattDataService', () => {
  const actual = jest.requireActual(
    '@/services/mushaf/DigitalKhattDataService',
  );
  const {createFakeDKService} = jest.requireActual(
    '@/services/mushaf/__fixtures__/rewayahOverlayFixture',
  );
  return {
    ...actual,
    digitalKhattDataService: createFakeDKService(actual.BASMALLAH_TEXT),
  };
});

const mockUnitsByRewayah = new Map<string, unknown>();
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: {
    get: (rewayah: string) => mockUnitsByRewayah.get(rewayah) ?? null,
  },
}));

import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {
  HAFS_SHOWN_UNITS,
  mushafVerseMapService,
  shownVerseUnitsOf,
} from '@/services/mushaf/MushafVerseMapService';
import type {FakeDKService} from '@/services/mushaf/__fixtures__/rewayahOverlayFixture';
import {
  buildFixtureUnits,
  fixtureLines,
  fixturePages,
  fixtureWords,
  UNITS_FIXTURE_REWAYAH,
  type UnitsFixtureDb,
} from '@/services/mushaf/__fixtures__/verseUnitPages';
import {
  baseComputePageHighlightLayers,
  baseOrderedVerseKeysForPage,
  baseVerseSegmentsForPage,
} from '@/services/mushaf/__fixtures__/baseHafsVersePipeline';
import {
  computeUnitPageHighlightLayers,
  NO_PLAYBACK_BAND,
  playbackBandUnitKeys,
  unitKeyedVerseLayers,
  unitThemeIndex,
  type LineHighlight,
  type PageVerseLayerSources,
  type PlaybackBand,
} from '../verseHighlightLayers';

const dk = digitalKhattDataService as unknown as FakeDKService;

function show(db: UnitsFixtureDb): void {
  mockUnitsByRewayah.clear();
  mockUnitsByRewayah.set(UNITS_FIXTURE_REWAYAH[db], buildFixtureUnits(db));
  dk.loadData({
    rewayah: UNITS_FIXTURE_REWAYAH[db],
    words: fixtureWords(db),
    lines: fixtureLines(),
  });
}

afterEach(() => mushafVerseMapService.clear());

const warsh = () => shownVerseUnitsOf(buildFixtureUnits('warsh'));

function band(overrides: Partial<PlaybackBand>): PlaybackBand {
  return {...NO_PLAYBACK_BAND, ...overrides};
}
const band1 = band;

function sources(
  overrides: Partial<PageVerseLayerSources>,
): PageVerseLayerSources {
  return {
    bookmarkedVerseKeys: new Set(),
    persistentHighlights: {},
    playback: NO_PLAYBACK_BAND,
    selection: null,
    ...overrides,
  };
}

describe('playbackBandUnitKeys (verse-units contract 4.2)', () => {
  it('a set in the shown rewayah lights exactly the recited verse', () => {
    const shown = warsh();
    const warshSet = {mode: 'riwayah', reciterRewayah: 'warsh'} as const;
    // Warsh 1:6 and 1:7 share Hafs 1:7: each lights only itself.
    expect(
      playbackBandUnitKeys(
        shown,
        band({...warshSet, hafsKeys: ['1:7'], entryKey: '1:6'}),
      ),
    ).toEqual(['1:6']);
    expect(
      playbackBandUnitKeys(
        shown,
        band({...warshSet, hafsKeys: ['1:7'], entryKey: '1:7'}),
      ),
    ).toEqual(['1:7']);
    // Warsh 103:1 = Hafs 103:1 + 103:2: one verse.
    expect(
      playbackBandUnitKeys(
        shown,
        band({...warshSet, hafsKeys: ['103:1', '103:2'], entryKey: '103:1'}),
      ),
    ).toEqual(['103:1']);
  });

  it('a Hafs-numbered entry lights every unit it recites', () => {
    const shown = warsh();
    expect(
      playbackBandUnitKeys(
        shown,
        band({mode: 'hafs', hafsKeys: ['1:7'], entryKey: '1:7'}),
      ),
    ).toEqual(['1:6', '1:7']);
    expect(
      playbackBandUnitKeys(
        shown,
        band({mode: 'hafs', hafsKeys: ['103:2'], entryKey: '103:2'}),
      ),
    ).toEqual(['103:1']);
    // Before verse 1 (the unnumbered basmala) nothing is lit.
    expect(
      playbackBandUnitKeys(
        shown,
        band({mode: 'hafs', hafsKeys: ['1:1'], entryKey: '1:1'}),
      ),
    ).toEqual([]);
  });

  it("another rewayah's set goes through the Hafs verses it recites", () => {
    const shown = warsh();
    // al-Bazzi 71:24 recites Hafs 71:23 (from word 10) and 71:24 (to word
    // 3); in Warsh those Hafs verses are held by Warsh 71:23, 71:24, 71:25.
    expect(
      playbackBandUnitKeys(
        shown,
        band({
          mode: 'riwayah',
          reciterRewayah: 'al-bazzi',
          hafsKeys: ['71:23', '71:24'],
          entryKey: '71:24',
        }),
      ),
    ).toEqual(['71:23', '71:24', '71:25']);
  });

  it('falls back to the Hafs verses when the entry is not a unit', () => {
    expect(
      playbackBandUnitKeys(
        warsh(),
        band({
          mode: 'riwayah',
          reciterRewayah: 'warsh',
          hafsKeys: ['1:7'],
          entryKey: '1:99',
        }),
      ),
    ).toEqual(['1:6', '1:7']);
  });

  it('nothing when idle or without units', () => {
    expect(playbackBandUnitKeys(warsh(), NO_PLAYBACK_BAND)).toEqual([]);
    expect(
      playbackBandUnitKeys(null, band({mode: 'hafs', hafsKeys: ['1:7']})),
    ).toEqual([]);
  });

  it('Hafs: the band is the Hafs verses recited, as before', () => {
    expect(
      playbackBandUnitKeys(
        HAFS_SHOWN_UNITS,
        band({
          mode: 'riwayah',
          reciterRewayah: 'warsh',
          hafsKeys: ['2:1', '2:2'],
          entryKey: '2:1',
        }),
      ),
    ).toEqual(['2:1', '2:2']);
    expect(
      playbackBandUnitKeys(
        HAFS_SHOWN_UNITS,
        band({mode: 'hafs', hafsKeys: ['2:255'], entryKey: '2:255'}),
      ),
    ).toEqual(['2:255']);
  });
});

describe('unitKeyedVerseLayers', () => {
  it('rows are read as anchors of the shown rewayah: one unit per row', () => {
    const out = unitKeyedVerseLayers(
      warsh(),
      sources({
        bookmarkedVerseKeys: new Set(['1:7:5', '103:1', '1:1', 'bad']),
        persistentHighlights: {'1:7': 'yellow', '1:7:5': 'green'},
      }),
    );
    expect([...out.bookmarkedVerseKeys]).toEqual(['1:7', '103:1']);
    expect(out.persistentHighlights).toEqual({'1:6': 'yellow', '1:7': 'green'});
  });

  it('rows with their rewayah follow the storage rule (Hafs rows: every unit holding the verse)', () => {
    const out = unitKeyedVerseLayers(
      warsh(),
      sources({
        bookmarkedVerseKeys: new Set(['1:7', '103:2', '1:7:5']),
        bookmarkRows: {
          '1:7': {verseKey: '1:7', rewayahId: 'hafs'},
          '103:2': {verseKey: '103:2', rewayahId: null}, // legacy: Hafs
          '1:7:5': {verseKey: '1:7:5', rewayahId: 'warsh'},
        },
        persistentHighlights: {'1:7': 'yellow', '1:7:5': 'green'},
        highlightRows: {
          '1:7': {verseKey: '1:7', rewayahId: 'hafs'},
          '1:7:5': {verseKey: '1:7:5', rewayahId: 'warsh'},
        },
      }),
    );
    expect([...out.bookmarkedVerseKeys]).toEqual(['1:6', '1:7', '103:1']);
    // Warsh 1:7 is marked by the Hafs row and by its own Warsh row: the row
    // made on the unit itself wins, whatever the row order.
    expect(out.persistentHighlights).toEqual({'1:6': 'yellow', '1:7': 'green'});
    const reversed = unitKeyedVerseLayers(
      warsh(),
      sources({
        persistentHighlights: {'1:7:5': 'green', '1:7': 'yellow'},
        highlightRows: {
          '1:7': {verseKey: '1:7', rewayahId: 'hafs'},
          '1:7:5': {verseKey: '1:7:5', rewayahId: 'warsh'},
        },
      }),
    );
    expect(reversed.persistentHighlights).toEqual({
      '1:7': 'green',
      '1:6': 'yellow',
    });
  });

  it('highlight precedence: own anchor > shown rewayah > Hafs > other rewayah', () => {
    const colours = (rows: [string, string, string | null][]) =>
      unitKeyedVerseLayers(
        warsh(),
        sources({
          persistentHighlights: Object.fromEntries(
            rows.map(([key, colour]) => [key, colour]),
          ),
          highlightRows: Object.fromEntries(
            rows.map(([key, , rewayahId]) => [
              key,
              {verseKey: key, rewayahId: rewayahId as never},
            ]),
          ),
        }),
      ).persistentHighlights;
    // Warsh 103:1 holds Hafs 103:1-2; every row below marks it. Rows are
    // listed lowest rank first, so the rank decides, not the order.
    const on103 = (rows: [string, string, string | null][]) =>
      colours(rows)['103:1'];
    // Another rewayah's row (inexact path) < a Hafs row.
    expect(
      on103([
        ['103:1', 'blue', 'qalun'],
        ['103:2', 'yellow', 'hafs'],
      ]),
    ).toBe('yellow');
    // A Hafs row < a Warsh row anchored inside the unit (a legacy row).
    expect(
      on103([
        ['103:1', 'yellow', 'hafs'],
        ['103:2', 'blue', 'warsh'],
      ]),
    ).toBe('blue');
    // ... < the Warsh row at the unit's own anchor.
    expect(
      on103([
        ['103:2', 'blue', 'warsh'],
        ['103:1', 'green', 'warsh'],
      ]),
    ).toBe('green');
    // Equal ranks: the first row.
    expect(
      on103([
        ['103:1', 'blue', 'qalun'],
        ['103:2', 'green', 'qalun'],
      ]),
    ).toBe('blue');
  });

  it('the selection: own numbering as is, Hafs keys mapped, others dropped', () => {
    const shown = warsh();
    const select = (rewayah: string | null, verseKeys: string[]) =>
      unitKeyedVerseLayers(
        shown,
        sources({selection: {rewayah: rewayah as never, verseKeys}}),
      ).selectedVerseKeys;
    expect(select('warsh', ['1:6'])).toEqual(['1:6']);
    expect(select('warsh', ['1:6', '1:7'])).toEqual(['1:6', '1:7']);
    expect(select('hafs', ['1:7'])).toEqual(['1:6', '1:7']);
    expect(select('hafs', ['103:2'])).toEqual(['103:1']);
    expect(select('hafs', ['1:1'])).toBeNull();
    expect(select('qalun', ['1:6'])).toBeNull();
    expect(select(null, ['1:6'])).toBeNull();
    expect(
      unitKeyedVerseLayers(shown, sources({selection: null})).selectedVerseKeys,
    ).toBeNull();
  });

  it("the player store's own unit band is used as is when given", () => {
    const shown = warsh();
    const band = (playbackUnitKeys: readonly string[] | null | undefined) =>
      unitKeyedVerseLayers(
        shown,
        sources({
          playback: band1({mode: 'hafs', hafsKeys: ['1:7'], entryKey: '1:7'}),
          playbackUnitKeys,
        }),
      ).playbackVerseKeys;
    expect(band(['1:7'])).toEqual(['1:7']);
    expect(band([])).toEqual([]);
    // Not given: derived from the band (both units of Hafs 1:7).
    expect(band(undefined)).toEqual(['1:6', '1:7']);
    expect(band(null)).toEqual(['1:6', '1:7']);
    // Without units nothing, whatever the store says.
    expect(
      unitKeyedVerseLayers(null, sources({playbackUnitKeys: ['1:7']}))
        .playbackVerseKeys,
    ).toEqual([]);
  });

  it('without units nothing is painted as a verse', () => {
    const out = unitKeyedVerseLayers(
      null,
      sources({
        bookmarkedVerseKeys: new Set(['1:7']),
        persistentHighlights: {'1:7': 'yellow'},
        playback: band({mode: 'hafs', hafsKeys: ['1:7']}),
        selection: {rewayah: 'hafs', verseKeys: ['1:7']},
      }),
    );
    expect(out.bookmarkedVerseKeys.size).toBe(0);
    expect(out.persistentHighlights).toEqual({});
    expect(out.playbackVerseKeys).toEqual([]);
    expect(out.selectedVerseKeys).toBeNull();
  });

  it('Hafs: the identity', () => {
    const bookmarks = new Set(['2:255', '1:1', '114:6']);
    const highlights = {'2:3': 'green', '2:1': 'yellow', '3:7': 'blue'};
    const out = unitKeyedVerseLayers(
      HAFS_SHOWN_UNITS,
      sources({
        bookmarkedVerseKeys: bookmarks,
        persistentHighlights: highlights,
        playback: band({mode: 'hafs', hafsKeys: ['2:4'], entryKey: '2:4'}),
        selection: {rewayah: 'hafs', verseKeys: ['2:5', '2:6']},
      }),
    );
    expect([...out.bookmarkedVerseKeys]).toEqual([...bookmarks]);
    expect(Object.entries(out.persistentHighlights)).toEqual(
      Object.entries(highlights),
    );
    expect(out.playbackVerseKeys).toEqual(['2:4']);
    expect(out.selectedVerseKeys).toEqual(['2:5', '2:6']);
  });
});

describe('unitThemeIndex', () => {
  it('a unit takes the theme of the Hafs verse it starts in', () => {
    const themes: Record<string, number> = {'103:1': 4, '103:2': 5, '1:7': 2};
    const of = (k: string) => themes[k];
    expect(unitThemeIndex(warsh(), '103:1', of)).toBe(4);
    expect(unitThemeIndex(warsh(), '1:7', of)).toBe(2);
    expect(unitThemeIndex(HAFS_SHOWN_UNITS, '103:2', of)).toBe(5);
    expect(unitThemeIndex(warsh(), '1:99', of)).toBeUndefined();
    expect(unitThemeIndex(null, '1:7', of)).toBeUndefined();
  });
});

// ── Painting a page, as the renderers compose it ──────────────────────────

const COLORS = {
  bookmark: 'BOOKMARK',
  play: 'PLAY',
  select: 'SELECT',
  theme: 'THEME',
  highlight: {yellow: 'Y', green: 'G'} as Record<string, string>,
};

/** SkiaPage's verse layers, composed exactly as SkiaPage composes them. */
function paintUnits(
  page: number,
  src: Partial<PageVerseLayerSources>,
  themeIndexOfHafs?: (hafsKey: string) => number | undefined,
) {
  return computeUnitPageHighlightLayers({
    pageNumber: page,
    shown: mushafVerseMapService.getShownVerseUnits(),
    segments: mushafVerseMapService,
    diffHighlights: new Map(),
    themes: themeIndexOfHafs
      ? {color: COLORS.theme, themeIndexOfHafsVerse: themeIndexOfHafs}
      : null,
    sources: sources(src),
    bookmarkColor: COLORS.bookmark,
    highlightColors: COLORS.highlight,
    playbackColor: COLORS.play,
    selectionColor: COLORS.select,
  });
}

/** The release-base (Hafs-keyed) pipeline, frozen in a fixture. */
function paintHafsBefore(
  page: number,
  input: {
    bookmarkedVerseKeys: ReadonlySet<string>;
    persistentHighlights: Record<string, string>;
    playbackVerseKeys: readonly string[];
    selectedVerseKeys: readonly string[] | null;
  },
  themeIndexOfHafs?: (hafsKey: string) => number | undefined,
) {
  return baseComputePageHighlightLayers({
    getVerseSegments: vk => baseVerseSegmentsForPage(dk, page, vk),
    diffHighlights: new Map(),
    themes: themeIndexOfHafs
      ? {
          verseKeys: baseOrderedVerseKeysForPage(dk, page),
          color: COLORS.theme,
          themeIndexOf: vk => themeIndexOfHafs(vk),
        }
      : null,
    bookmarkedVerseKeys: input.bookmarkedVerseKeys,
    bookmarkColor: COLORS.bookmark,
    persistentHighlights: input.persistentHighlights,
    highlightColors: COLORS.highlight,
    playbackVerseKeys: input.playbackVerseKeys,
    playbackColor: COLORS.play,
    selectedVerseKeys: input.selectedVerseKeys,
    selectionColor: COLORS.select,
  });
}

const of = (
  map: Map<number, LineHighlight[]> | null,
  line: number,
  color: string,
) => (map?.get(line) ?? []).filter(h => h.color === color);

describe('Warsh page 1: every overlay paints exactly its verse units', () => {
  // Page 1, Warsh: L6 (index 5) = slots 24-29 (1:5 ends at 26, 1:6 starts
  // at 27); L7 (index 6) = slot 30 'عَلَي۟هِم۟ ۝٦' [0-12] ending 1:6, then
  // 1:7 [14-45]; L8 (index 7) = the rest of 1:7.
  beforeEach(() => show('warsh'));

  it('selecting Warsh 1:6 paints it up to its inline marker, not 1:7', () => {
    const map = paintUnits(1, {
      selection: {rewayah: 'warsh', verseKeys: ['1:6']},
    });
    const l6 = mushafVerseMapService
      .getUnitSegments(1, 5)
      .find(s => s.verseKey === '1:6')!;
    expect(of(map, 5, COLORS.select)).toEqual([
      {start: l6.startCharIndex, end: l6.endCharIndex, color: COLORS.select},
    ]);
    expect(of(map, 6, COLORS.select)).toEqual([
      {start: 0, end: 12, color: COLORS.select},
    ]);
    expect(of(map, 7, COLORS.select)).toEqual([]);
  });

  it('selecting Warsh 1:7 (the second half of Hafs 1:7) paints only it', () => {
    const map = paintUnits(1, {
      selection: {rewayah: 'warsh', verseKeys: ['1:7']},
    });
    expect(of(map, 5, COLORS.select)).toEqual([]);
    expect(of(map, 6, COLORS.select)).toEqual([
      {start: 14, end: 45, color: COLORS.select},
    ]);
    expect(of(map, 7, COLORS.select)).toHaveLength(1);
  });

  it('a Warsh reciter on Warsh 1:6 lights 1:6 only', () => {
    const map = paintUnits(1, {
      playback: band({
        mode: 'riwayah',
        reciterRewayah: 'warsh',
        hafsKeys: ['1:7'],
        entryKey: '1:6',
      }),
    });
    expect(of(map, 6, COLORS.play)).toEqual([
      {start: 0, end: 12, color: COLORS.play},
    ]);
    expect(of(map, 7, COLORS.play)).toEqual([]);
  });

  it('a Hafs-numbered entry of Hafs 1:7 lights both units as one band', () => {
    const map = paintUnits(1, {
      playback: band({mode: 'hafs', hafsKeys: ['1:7'], entryKey: '1:7'}),
    });
    expect(of(map, 6, COLORS.play)).toEqual([
      {start: 0, end: 45, color: COLORS.play},
    ]);
    expect(of(map, 7, COLORS.play)).toHaveLength(1);
  });

  it('a bookmark on Warsh 1:7 (anchor 1:7:5) tints 1:7, not 1:6', () => {
    const map = paintUnits(1, {bookmarkedVerseKeys: new Set(['1:7:5'])});
    expect(of(map, 5, COLORS.bookmark)).toEqual([]);
    expect(of(map, 6, COLORS.bookmark)).toEqual([
      {start: 14, end: 45, color: COLORS.bookmark},
    ]);
    expect(of(map, 7, COLORS.bookmark)).toHaveLength(1);
  });

  it('the unnumbered basmala is never painted', () => {
    const map = paintUnits(1, {
      bookmarkedVerseKeys: new Set(['1:1']),
      persistentHighlights: {'1:1': 'yellow'},
      playback: band({mode: 'hafs', hafsKeys: ['1:1'], entryKey: '1:1'}),
      selection: {rewayah: 'hafs', verseKeys: ['1:1']},
    });
    expect(map?.get(1) ?? []).toEqual([]);
  });

  it('a Hafs-keyed selection (navigation flash) lights the units holding it', () => {
    const map = paintUnits(1, {
      selection: {rewayah: 'hafs', verseKeys: ['1:7']},
    });
    expect(of(map, 6, COLORS.select)).toEqual([
      {start: 0, end: 12, color: COLORS.select},
      {start: 14, end: 45, color: COLORS.select},
    ]);
  });
});

describe('Hafs: the unit pipeline paints exactly what the Hafs pipeline painted', () => {
  it('every fixture page, every layer', () => {
    show('hafs');
    const themeIndexOfHafs = (k: string) =>
      Number(k.split(':')[1]) % 3 === 0 ? undefined : Number(k.split(':')[1]);
    let compared = 0;
    for (const page of fixturePages()) {
      const keys = baseOrderedVerseKeysForPage(dk, page);
      for (let i = 0; i < keys.length; i++) {
        const window = keys.slice(i, i + 3);
        const input = {
          bookmarkedVerseKeys: new Set([keys[i], keys[keys.length - 1 - i]]),
          persistentHighlights: {
            [keys[(i + 1) % keys.length]]: 'yellow',
            [keys[(i + 2) % keys.length]]: 'green',
          },
          playbackVerseKeys: window.slice(0, (i % 3) + 1),
          selectedVerseKeys: i % 2 === 0 ? window : null,
        };
        const before = paintHafsBefore(page, input, themeIndexOfHafs);
        const after = paintUnits(
          page,
          {
            bookmarkedVerseKeys: input.bookmarkedVerseKeys,
            persistentHighlights: input.persistentHighlights,
            playback: band({
              mode: 'hafs',
              hafsKeys: input.playbackVerseKeys,
              entryKey: input.playbackVerseKeys[0],
            }),
            selection: input.selectedVerseKeys
              ? {rewayah: 'hafs', verseKeys: input.selectedVerseKeys}
              : null,
          },
          themeIndexOfHafs,
        );
        expect(after).toEqual(before);
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(50);
  });
});
