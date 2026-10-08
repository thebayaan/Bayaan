// @ai-generated
/**
 * MushafVerseMapService verse-unit segments (decision 3): tap / long-press /
 * drag targets and every verse overlay of the mushaf work in the shown
 * rewayah's OWN verses. Real slots of complete surahs from five Release 1
 * words DBs (verseUnitsFixture.json, laid out by verseUnitPages.ts); the
 * expected unit of every slot comes from the fixture's independent Python
 * walk, not from the TypeScript builder.
 *
 * Every line of every words DB is checked by
 * mushafVerseUnits.alldbs.test.ts (local, BAYAAN_OVERLAY_DB_DIR), with the
 * Hafs differential against the previous code on all 604 pages.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../DigitalKhattDataService', () => {
  const actual = jest.requireActual('../DigitalKhattDataService');
  const {createFakeDKService} = jest.requireActual(
    '../__fixtures__/rewayahOverlayFixture',
  );
  return {
    ...actual,
    digitalKhattDataService: createFakeDKService(actual.BASMALLAH_TEXT),
  };
});

// The units the runtime service would build from the active words.
const mockUnitsByRewayah = new Map<string, unknown>();
const mockUnitsService = {
  throwOnGet: false,
  // Status reported while get() returns null: 'error' = refused.
  statusWithoutUnits: 'error' as string,
  // Rewayat whose units were asked for, in order.
  gets: [] as string[],
};
jest.mock('../RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: {
    get: (rewayah: string) => {
      mockUnitsService.gets.push(rewayah);
      if (mockUnitsService.throwOnGet) throw new Error('units build failed');
      return mockUnitsByRewayah.get(rewayah) ?? null;
    },
    getStatus: (rewayah: string) =>
      mockUnitsByRewayah.has(rewayah)
        ? 'ready'
        : mockUnitsService.statusWithoutUnits,
  },
}));

import {digitalKhattDataService} from '../DigitalKhattDataService';
import {
  followShownRewayah,
  HAFS_SHOWN_UNITS,
  mushafVerseMapService,
  selectionForAnchor,
  selectionForUnitKeys,
  shownVerseUnitsOf,
  verseNavigationTarget,
  type VerseSegment,
} from '../MushafVerseMapService';
import {getLineWordSpans} from '../lineWordSpans';
import {
  unitsForStoredVerse,
  type RewayahVerseUnits,
} from '../RewayahVerseUnits';
import type {FakeDKService} from '../__fixtures__/rewayahOverlayFixture';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {
  buildFixtureUnits,
  expectedUnitOfSlot,
  fixtureLines,
  fixturePages,
  fixtureWords,
  unitsFixture,
  UNITS_FIXTURE_DBS,
  UNITS_FIXTURE_REWAYAH,
  type UnitsFixtureDb,
} from '../__fixtures__/verseUnitPages';

const dk = digitalKhattDataService as unknown as FakeDKService;

/** Shows `db` in the mushaf; its units are available unless `refused`. */
function show(db: UnitsFixtureDb, opts: {refused?: boolean} = {}): void {
  mockUnitsByRewayah.clear();
  if (!opts.refused) {
    mockUnitsByRewayah.set(UNITS_FIXTURE_REWAYAH[db], buildFixtureUnits(db));
  }
  dk.loadData({
    rewayah: UNITS_FIXTURE_REWAYAH[db],
    words: fixtureWords(db),
    lines: fixtureLines(),
  });
}

/** Independent oracle: spans grouped by the fixture's expected units. */
function expectedSegments(
  db: UnitsFixtureDb,
  page: number,
  lineIndex: number,
): VerseSegment[] {
  const spans = getLineWordSpans(dk.getPageLines(page)[lineIndex], dk);
  const out: VerseSegment[] = [];
  let current: VerseSegment | null = null;
  for (const span of spans) {
    const unit = expectedUnitOfSlot(db, span.wordId);
    if (!unit) {
      current = null;
      continue;
    }
    const key = `${unit[0]}:${unit[1]}`;
    if (current && current.verseKey === key) {
      current.endCharIndex = span.end;
      current.lastWordId = span.wordId;
    } else {
      current = {
        verseKey: key,
        surahNumber: unit[0],
        ayahNumber: unit[1],
        startCharIndex: span.start,
        endCharIndex: span.end,
        firstWordId: span.wordId,
        lastWordId: span.wordId,
      };
      out.push(current);
    }
  }
  return out;
}

function lineCount(page: number): number {
  return dk.getPageLines(page).length;
}

function lineText(page: number, lineIndex: number): string {
  return dk.getLineText(dk.getPageLines(page)[lineIndex]);
}

afterEach(() => mushafVerseMapService.clear());

describe('unit segments on every line of the fixture pages', () => {
  it.each(UNITS_FIXTURE_DBS)('%s: one segment per run of a unit', db => {
    show(db);
    let segments = 0;
    for (const page of fixturePages()) {
      for (let line = 0; line < lineCount(page); line++) {
        const actual = mushafVerseMapService.getUnitSegments(page, line);
        expect(actual).toEqual(expectedSegments(db, page, line));
        segments += actual.length;
      }
    }
    expect(segments).toBeGreaterThan(100);
  });

  it('Warsh 1:6 ends at its inline marker mid-line; Warsh 1:7 starts after it', () => {
    show('warsh');
    // Page 1 line 7 = slots 30-33: 'عَلَي۟هِم۟ ۝٦' (13) + 3 words of 1:7.
    expect(lineText(1, 6).length).toBe(46);
    expect(mushafVerseMapService.getUnitSegments(1, 6)).toEqual([
      {
        verseKey: '1:6',
        surahNumber: 1,
        ayahNumber: 6,
        startCharIndex: 0,
        endCharIndex: 12,
        firstWordId: 30,
        lastWordId: 30,
      },
      {
        verseKey: '1:7',
        surahNumber: 1,
        ayahNumber: 7,
        startCharIndex: 14,
        endCharIndex: 45,
        firstWordId: 31,
        lastWordId: 33,
      },
    ]);
    // The marker belongs to the verse it ends.
    expect(lineText(1, 6).slice(0, 13).endsWith('۝٦')).toBe(true);
    // Hafs groups the same line as ONE verse (Hafs 1:7).
    expect(
      mushafVerseMapService.getVerseSegments(1, 6).map(s => s.verseKey),
    ).toEqual(['1:7']);
  });

  it('a unit runs across a blank slot (al-Bazzi 71:24, Hafs 71:23 marker slot)', () => {
    show('bazzi');
    // Synthetic page 1071, line index 33 = slots 79183-79188; 79184 is blank.
    const segments = mushafVerseMapService.getUnitSegments(1071, 33);
    expect(
      segments.map(s => [s.verseKey, s.firstWordId, s.lastWordId]),
    ).toEqual([
      ['71:24', 79183, 79187],
      ['71:25', 79188, 79188],
    ]);
  });

  it('the unnumbered Fatiha basmala has no segment in the Madani / Basri counts', () => {
    for (const db of ['warsh', 'doori'] as const) {
      show(db);
      // Page 1 line 2 = Hafs 1:1 (slots 1-5).
      expect(lineText(1, 1)).not.toBe('');
      expect(mushafVerseMapService.getUnitSegments(1, 1)).toEqual([]);
      for (let i = 0; i <= lineText(1, 1).length; i++) {
        expect(mushafVerseMapService.findUnitAtCharIndex(1, 1, i)).toBeNull();
      }
      expect(mushafVerseMapService.getOrderedUnitKeysForPage(1)).toEqual([
        '1:1',
        '1:2',
        '1:3',
        '1:4',
        '1:5',
        '1:6',
        '1:7',
      ]);
      mushafVerseMapService.clear();
    }
    for (const db of ['hafs', 'shouba', 'bazzi'] as const) {
      show(db);
      expect(
        mushafVerseMapService.getUnitSegments(1, 1).map(s => s.verseKey),
      ).toEqual(['1:1']);
      mushafVerseMapService.clear();
    }
  });
});

describe('hit-testing', () => {
  it.each(UNITS_FIXTURE_DBS)(
    '%s: every char hits the unit of its slot, separators between units hit nothing',
    db => {
      show(db);
      for (const page of fixturePages()) {
        for (let line = 0; line < lineCount(page); line++) {
          const spans = getLineWordSpans(dk.getPageLines(page)[line], dk);
          for (const span of spans) {
            const unit = expectedUnitOfSlot(db, span.wordId);
            const key = unit ? `${unit[0]}:${unit[1]}` : undefined;
            for (const index of [span.start, span.end]) {
              expect(
                mushafVerseMapService.findUnitAtCharIndex(page, line, index)
                  ?.verseKey,
              ).toBe(key);
            }
          }
          for (let i = 1; i < spans.length; i++) {
            const gap = spans[i].start - 1;
            const before = expectedUnitOfSlot(db, spans[i - 1].wordId);
            const after = expectedUnitOfSlot(db, spans[i].wordId);
            const hit = mushafVerseMapService.findUnitAtCharIndex(
              page,
              line,
              gap,
            );
            if (before && before === after) {
              expect(hit?.verseKey).toBe(`${before[0]}:${before[1]}`);
            } else {
              expect(hit).toBeNull();
            }
          }
        }
      }
    },
  );

  it('Warsh page 1 line 7: the marker hits 1:6, the next word hits 1:7', () => {
    show('warsh');
    const hit = (i: number) =>
      mushafVerseMapService.findUnitAtCharIndex(1, 6, i)?.verseKey ?? null;
    expect(hit(11)).toBe('1:6'); // U+06DD
    expect(hit(12)).toBe('1:6'); // its digit
    expect(hit(13)).toBeNull(); // the separator
    expect(hit(14)).toBe('1:7');
    expect(hit(45)).toBe('1:7');
  });
});

describe('ordered unit keys and per-unit segments of a page', () => {
  it.each(UNITS_FIXTURE_DBS)('%s', db => {
    show(db);
    for (const page of fixturePages()) {
      const expectedOrder: string[] = [];
      const expectedByKey = new Map<
        string,
        {lineIndex: number; segment: VerseSegment}[]
      >();
      for (let line = 0; line < lineCount(page); line++) {
        for (const segment of expectedSegments(db, page, line)) {
          if (!expectedByKey.has(segment.verseKey)) {
            expectedOrder.push(segment.verseKey);
            expectedByKey.set(segment.verseKey, []);
          }
          expectedByKey.get(segment.verseKey)!.push({lineIndex: line, segment});
        }
      }
      expect(mushafVerseMapService.getOrderedUnitKeysForPage(page)).toEqual(
        expectedOrder,
      );
      for (const [key, segments] of expectedByKey) {
        expect(mushafVerseMapService.getUnitSegmentsForPage(page, key)).toEqual(
          segments,
        );
      }
    }
  });

  it('the units of a page are consecutive verses of the rewayah', () => {
    for (const db of UNITS_FIXTURE_DBS) {
      show(db);
      const units = buildFixtureUnits(db);
      for (const page of fixturePages()) {
        const keys = mushafVerseMapService.getOrderedUnitKeysForPage(page);
        const first = units.unitByKey(keys[0])!;
        const last = units.unitByKey(keys[keys.length - 1])!;
        expect(units.unitsInRange(first, last).map(u => u.key)).toEqual(keys);
      }
      mushafVerseMapService.clear();
    }
  });
});

describe('Hafs: unit segments are the Hafs verse segments', () => {
  it('every line, hit and page order of the Hafs fixture pages', () => {
    show('hafs');
    for (const page of fixturePages()) {
      expect(mushafVerseMapService.getOrderedUnitKeysForPage(page)).toEqual(
        mushafVerseMapService.getOrderedVerseKeysForPage(page),
      );
      for (let line = 0; line < lineCount(page); line++) {
        expect(mushafVerseMapService.getUnitSegments(page, line)).toEqual(
          mushafVerseMapService.getVerseSegments(page, line),
        );
        for (let i = 0; i <= lineText(page, line).length; i++) {
          expect(
            mushafVerseMapService.findUnitAtCharIndex(page, line, i),
          ).toEqual(mushafVerseMapService.findVerseAtCharIndex(page, line, i));
        }
      }
    }
  });

  it('never builds Hafs units', () => {
    show('hafs');
    mockUnitsByRewayah.clear();
    expect(mushafVerseMapService.getShownVerseUnits()).toBe(HAFS_SHOWN_UNITS);
    expect(mushafVerseMapService.getUnitSegments(1, 1)).not.toEqual([]);
  });
});

describe('refused units (fail closed)', () => {
  it('a non-Hafs text without units has no verse targets at all', () => {
    show('warsh', {refused: true});
    expect(mushafVerseMapService.getShownVerseUnits()).toBeNull();
    for (const page of fixturePages()) {
      expect(mushafVerseMapService.getOrderedUnitKeysForPage(page)).toEqual([]);
      for (let line = 0; line < lineCount(page); line++) {
        expect(mushafVerseMapService.getUnitSegments(page, line)).toEqual([]);
        expect(mushafVerseMapService.findUnitAtCharIndex(page, line, 0)).toBe(
          null,
        );
      }
    }
    // The Hafs-aligned grouping stays available to Hafs-keyed callers.
    expect(mushafVerseMapService.getOrderedVerseKeysForPage(1)).toContain(
      '1:7',
    );
    expect(selectionForUnitKeys(['1:6'])).toBeNull();
  });

  it('units still loading are not remembered as refused', () => {
    show('warsh', {refused: true});
    mockUnitsService.statusWithoutUnits = 'loading';
    try {
      expect(mushafVerseMapService.getShownVerseUnits()).toBeNull();
      expect(mushafVerseMapService.getUnitSegments(1, 6)).toEqual([]);
      expect(mushafVerseMapService.getOrderedUnitKeysForPage(1)).toEqual([]);
      // The words arrive without a cache-version bump: the next call
      // resolves them (nothing empty was cached meanwhile).
      mockUnitsByRewayah.set('warsh', buildFixtureUnits('warsh'));
      expect(mushafVerseMapService.getShownVerseUnits()?.rewayah).toBe('warsh');
      expect(
        mushafVerseMapService.getUnitSegments(1, 6).map(s => s.verseKey),
      ).toEqual(['1:6', '1:7']);
      expect(mushafVerseMapService.getOrderedUnitKeysForPage(1)).toContain(
        '1:7',
      );
    } finally {
      mockUnitsService.statusWithoutUnits = 'error';
    }
  });

  it('a units service that throws is treated as refused', () => {
    show('warsh');
    mockUnitsService.throwOnGet = true;
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      expect(mushafVerseMapService.getShownVerseUnits()).toBeNull();
      expect(mushafVerseMapService.getUnitSegments(1, 6)).toEqual([]);
      expect(error).toHaveBeenCalledTimes(1);
    } finally {
      mockUnitsService.throwOnGet = false;
      error.mockRestore();
    }
  });
});

describe('caches follow the shown words', () => {
  it('a rewayah switch replaces the unit segments and the units', () => {
    show('warsh');
    const warsh = mushafVerseMapService.getUnitSegments(1, 6);
    expect(warsh.map(s => s.verseKey)).toEqual(['1:6', '1:7']);
    expect(mushafVerseMapService.getShownVerseUnits()?.rewayah).toBe('warsh');

    show('bazzi');
    expect(
      mushafVerseMapService.getUnitSegments(1, 6).map(s => s.verseKey),
    ).toEqual(['1:7']);
    expect(mushafVerseMapService.getShownVerseUnits()?.rewayah).toBe(
      'al-bazzi',
    );

    show('hafs');
    expect(mushafVerseMapService.getShownVerseUnits()).toBe(HAFS_SHOWN_UNITS);
  });

  it('a data reload (cache version bump) re-resolves the units', () => {
    show('warsh', {refused: true});
    expect(mushafVerseMapService.getUnitSegments(1, 6)).toEqual([]);
    mockUnitsByRewayah.set('warsh', buildFixtureUnits('warsh'));
    dk.bumpVersion();
    expect(
      mushafVerseMapService.getUnitSegments(1, 6).map(s => s.verseKey),
    ).toEqual(['1:6', '1:7']);
  });
});

describe('describe(): key, storage anchor and Hafs verses of each unit', () => {
  it.each(UNITS_FIXTURE_DBS)('%s', db => {
    show(db);
    const shown = mushafVerseMapService.getShownVerseUnits()!;
    for (const [surah, ayah, , , hafsKeys, anchor] of unitsFixture.expected[
      db
    ]) {
      expect(shown.describe(`${surah}:${ayah}`)).toEqual({
        key: `${surah}:${ayah}`,
        anchor,
        hafsKeys,
      });
    }
    expect(shown.describe('1:99')).toBeNull();
    expect(shown.describe('nonsense')).toBeNull();
  });

  it('selectionForUnitKeys carries the rewayah and the anchors', () => {
    show('warsh');
    expect(selectionForUnitKeys(['1:6', '1:7'])).toEqual({
      rewayah: 'warsh',
      units: [
        {key: '1:6', anchor: '1:7', hafsKeys: ['1:7']},
        {key: '1:7', anchor: '1:7:5', hafsKeys: ['1:7']},
      ],
    });
    expect(selectionForUnitKeys(['103:1'])).toEqual({
      rewayah: 'warsh',
      units: [{key: '103:1', anchor: '103:1', hafsKeys: ['103:1', '103:2']}],
    });
    expect(selectionForUnitKeys(['1:99'])).toBeNull();
    show('hafs');
    expect(selectionForUnitKeys(['2:255'])).toEqual({
      rewayah: 'hafs',
      units: [{key: '2:255', anchor: '2:255', hafsKeys: ['2:255']}],
    });
  });
});

describe('selectionForAnchor (stored rows, route params)', () => {
  it('selects exactly the unit holding the anchored slot', () => {
    show('warsh');
    expect(selectionForAnchor('1:7:5')).toEqual({
      rewayah: 'warsh',
      units: [{key: '1:7', anchor: '1:7:5', hafsKeys: ['1:7']}],
    });
    // A Hafs anchor 'S:A' is the Hafs verse's first slot: Warsh 1:6.
    expect(selectionForAnchor('1:7')?.units.map(u => u.key)).toEqual(['1:6']);
    // A slot inside a unit: the unit holding it (legacy row on Hafs 103:2).
    expect(selectionForAnchor('103:2')?.units.map(u => u.key)).toEqual([
      '103:1',
    ]);
    // The unnumbered basmala, a slot past the verse, nonsense: nothing.
    expect(selectionForAnchor('1:1')).toBeNull();
    expect(selectionForAnchor('1:7:99')).toBeNull();
    expect(selectionForAnchor('nonsense')).toBeNull();
  });

  it('Hafs: the Hafs verse of the anchor', () => {
    show('hafs');
    expect(selectionForAnchor('1:7')).toEqual({
      rewayah: 'hafs',
      units: [{key: '1:7', anchor: '1:7', hafsKeys: ['1:7']}],
    });
    expect(selectionForAnchor('1:7:5')?.units.map(u => u.key)).toEqual(['1:7']);
    expect(selectionForAnchor('1:8')).toBeNull();
  });

  it('nothing while the units are refused', () => {
    show('warsh', {refused: true});
    expect(selectionForAnchor('1:7:5')).toBeNull();
  });
});

describe('verseNavigationTarget (search, bookmark chips)', () => {
  it('a Hafs key selects and scrolls to that Hafs verse, as before', () => {
    show('warsh');
    expect(verseNavigationTarget('1:7', 'hafs')).toEqual({
      rewayah: 'hafs',
      hafsKey: '1:7',
      unit: null,
      scrollHafsKey: '1:7',
    });
  });

  it("a key in the shown rewayah's numbering selects exactly that unit", () => {
    show('warsh');
    expect(verseNavigationTarget('1:7', 'warsh')).toEqual({
      rewayah: 'warsh',
      hafsKey: null,
      unit: {key: '1:7', anchor: '1:7:5', hafsKeys: ['1:7']},
      // Scrolls to the Hafs verse holding its start (Hafs 1:7).
      scrollHafsKey: '1:7',
    });
    expect(verseNavigationTarget('103:1', 'warsh').unit).toEqual({
      key: '103:1',
      anchor: '103:1',
      hafsKeys: ['103:1', '103:2'],
    });
  });

  it("a stored anchor 'S:A:W' given as a Hafs key selects the unit holding that slot", () => {
    show('warsh');
    expect(verseNavigationTarget('1:7:5', 'hafs')).toEqual({
      rewayah: 'warsh',
      hafsKey: null,
      unit: {key: '1:7', anchor: '1:7:5', hafsKeys: ['1:7']},
      scrollHafsKey: '1:7',
    });
    // A slot inside the first part (word 3 of Hafs 1:7): Warsh 1:6.
    expect(verseNavigationTarget('1:7:3', 'hafs').unit?.key).toBe('1:6');
    // Hafs on screen: the Hafs verse of the anchor.
    show('hafs');
    expect(verseNavigationTarget('1:7:5', 'hafs')).toEqual({
      rewayah: 'hafs',
      hafsKey: null,
      unit: {key: '1:7', anchor: '1:7', hafsKeys: ['1:7']},
      scrollHafsKey: '1:7',
    });
    // No units yet (refused here): the anchor's Hafs verse, as a Hafs key.
    show('warsh', {refused: true});
    expect(verseNavigationTarget('1:7:5', 'hafs')).toEqual({
      rewayah: 'hafs',
      hafsKey: '1:7',
      unit: null,
      scrollHafsKey: '1:7',
    });
    // Not an anchor of an existing Hafs verse: passed on as before.
    expect(verseNavigationTarget('1:8:2', 'hafs').hafsKey).toBe('1:8:2');
  });

  it('a key of another numbering, or no unit, selects nothing', () => {
    show('warsh');
    const nothing = (rewayah: 'qalun' | 'warsh', key: string) => {
      const target = verseNavigationTarget(key, rewayah);
      expect(target.hafsKey).toBeNull();
      expect(target.unit).toBeNull();
      expect(target.scrollHafsKey).toBeNull();
    };
    nothing('qalun', '1:6'); // Qalun numbering while Warsh is shown
    nothing('warsh', '1:8'); // Warsh has 7 verses in the Fatiha
    show('warsh', {refused: true});
    nothing('warsh', '1:6');
  });
});

describe('followShownRewayah (the mushaf screen, on a rewayah switch)', () => {
  // The fake data service has no rewayah listeners: give it the real
  // service's onRewayahChange contract for this block.
  const listeners = new Set<(rewayah: RewayahId) => void>();
  const fake = dk as unknown as {
    onRewayahChange: (l: (rewayah: RewayahId) => void) => () => void;
  };
  beforeAll(() => {
    fake.onRewayahChange = listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
  });
  /** Switches the shown text like the data service does, then notifies. */
  function switchTo(db: UnitsFixtureDb): void {
    show(db);
    for (const listener of [...listeners]) listener(UNITS_FIXTURE_REWAYAH[db]);
  }
  afterEach(() => {
    useMushafVerseSelectionStore.getState().clearSelection();
    listeners.clear();
  });

  it("drops a selection of the previous rewayah's units, keeps a Hafs one", () => {
    show('warsh');
    const tasks: (() => void)[] = [];
    const unsubscribe = followShownRewayah(task => tasks.push(task));
    const selection = selectionForUnitKeys(['1:6', '1:7'])!;
    const store = useMushafVerseSelectionStore.getState();
    store.selectUnits(selection.rewayah, selection.units, 1);
    switchTo('bazzi');
    expect(useMushafVerseSelectionStore.getState().selectedVerseKeys).toEqual(
      [],
    );
    store.selectVerse('1:7', 1);
    switchTo('doori');
    expect(useMushafVerseSelectionStore.getState()).toMatchObject({
      selectedRewayah: 'hafs',
      selectedVerseKeys: ['1:7'],
    });
    unsubscribe();
    expect(listeners.size).toBe(0);
  });

  it("builds the new text's verse units after the switch, not on the first render", () => {
    show('hafs');
    const tasks: (() => void)[] = [];
    followShownRewayah(task => tasks.push(task));
    mockUnitsService.gets.length = 0;
    switchTo('warsh');
    // Scheduled, not run inside the listener.
    expect(mockUnitsService.gets).toEqual([]);
    expect(tasks).toHaveLength(1);
    tasks[0]();
    expect(mockUnitsService.gets).toEqual(['warsh']);
    // Resolved once for this text: the first page asks for nothing more.
    mushafVerseMapService.getUnitSegments(1, 6);
    expect(mockUnitsService.gets).toEqual(['warsh']);
    // A switch to Hafs builds nothing.
    switchTo('hafs');
    expect(tasks).toHaveLength(1);
  });
});

describe('ShownVerseUnits mappings', () => {
  function keysOf(units: readonly {key: string}[]): string[] {
    return units.map(u => u.key);
  }

  it('Warsh: stored rows, Hafs keys and rewayah refs map to its own verses', () => {
    const units = buildFixtureUnits('warsh');
    const shown = shownVerseUnitsOf(units);
    // A Warsh row anchored on the second part of Hafs 1:7 is Warsh 1:7 only.
    expect(
      shown.unitKeysForStoredVerse({verseKey: '1:7:5', rewayahId: 'warsh'}),
    ).toEqual(['1:7']);
    // A Warsh row on "1:7" (Warsh 1:6's anchor, or a legacy Hafs-verse row).
    expect(
      shown.unitKeysForStoredVerse({verseKey: '1:7', rewayahId: 'warsh'}),
    ).toEqual(['1:6']);
    // A Hafs row on Hafs 1:7 marks both Warsh verses holding its words.
    expect(
      shown.unitKeysForStoredVerse({verseKey: '1:7', rewayahId: 'hafs'}),
    ).toEqual(['1:6', '1:7']);
    expect(
      shown.unitKeysForStoredVerse({verseKey: '1:7', rewayahId: null}),
    ).toEqual(['1:6', '1:7']);
    // A Hafs row on Hafs 103:2 marks Warsh 103:1 (= Hafs 103:1 + 103:2).
    expect(
      shown.unitKeysForStoredVerse({verseKey: '103:2', rewayahId: 'hafs'}),
    ).toEqual(['103:1']);
    // The unnumbered basmala marks nothing.
    expect(
      shown.unitKeysForStoredVerse({verseKey: '1:1', rewayahId: 'hafs'}),
    ).toEqual([]);
    expect(shown.unitKeysForHafsKeys(['1:7'])).toEqual(['1:6', '1:7']);
    expect(shown.unitKeysForHafsKeys(['1:1'])).toEqual([]);
    expect(shown.unitKeysForHafsKeys(['103:2', '103:1'])).toEqual(['103:1']);
    expect(shown.unitKeyByRef(1, 6)).toBe('1:6');
    expect(shown.unitKeyByRef(1, 8)).toBeNull();
    expect(shown.unitOfSlot(30, '1:7')?.key).toBe('1:6');
    expect(shown.unitOfSlot(31, '1:7')?.key).toBe('1:7');
    expect(shown.unitOfSlot(3, '1:1')).toBeNull();
  });

  it('HAFS_SHOWN_UNITS answers like the units built from the Hafs DB', () => {
    const units: RewayahVerseUnits = buildFixtureUnits('hafs');
    const otherRewayah = [
      buildFixtureUnits('warsh'),
      buildFixtureUnits('bazzi'),
      buildFixtureUnits('doori'),
    ];
    unitsFixture.ids.forEach((id, i) => {
      const hafsVerseKey = unitsFixture.locations[i]
        .split(':')
        .slice(0, 2)
        .join(':');
      const unit = units.unitForWordId(id)!;
      const ref = HAFS_SHOWN_UNITS.unitOfSlot(id, hafsVerseKey)!;
      expect([ref.key, ref.surah, ref.ayah]).toEqual([
        unit.key,
        unit.surah,
        unit.ayah,
      ]);
    });
    for (const unit of units.units) {
      expect(HAFS_SHOWN_UNITS.describe(unit.key)).toEqual({
        key: unit.key,
        anchor: units.hafsAnchor(unit).key,
        hafsKeys: [...unit.hafsKeys],
      });
      expect(HAFS_SHOWN_UNITS.unitKeysForHafsKeys([unit.key])).toEqual(
        keysOf(units.unitsForHafsKey(unit.key)),
      );
      expect(HAFS_SHOWN_UNITS.unitKeyByRef(unit.surah, unit.ayah)).toBe(
        unit.key,
      );
      for (const rewayahId of ['hafs', null, 'warsh'] as const) {
        const row = {verseKey: unit.key, rewayahId};
        expect(HAFS_SHOWN_UNITS.unitKeysForStoredVerse(row)).toEqual(
          keysOf(unitsForStoredVerse(units, row).units),
        );
      }
      expect(HAFS_SHOWN_UNITS.unitKeyForAnchor(unit.key)).toBe(
        units.unitForAnchor(unit.key)?.key ?? null,
      );
    }
    // Rows saved in other rewayat (their anchors, including mid-verse
    // ones). A row marks the Hafs verse its key names, as the Hafs verse
    // sheet and the Hafs list rows read it; a mid-verse anchor (the later
    // part of a split Hafs verse) marks none, so the Hafs page never paints
    // a mark the Hafs sheet cannot show or remove. Navigation to an anchor
    // still lands on the Hafs verse holding its slot.
    let midVerse = 0;
    for (const saved of otherRewayah) {
      for (const unit of saved.units) {
        const anchor = saved.hafsAnchor(unit);
        const row = {verseKey: anchor.key, rewayahId: saved.rewayah};
        if (anchor.key === anchor.hafsKey) {
          expect(HAFS_SHOWN_UNITS.unitKeysForStoredVerse(row)).toEqual(
            keysOf(unitsForStoredVerse(units, row).units),
          );
        } else {
          midVerse++;
          expect(HAFS_SHOWN_UNITS.unitKeysForStoredVerse(row)).toEqual([]);
        }
        expect(HAFS_SHOWN_UNITS.unitKeyForAnchor(row.verseKey)).toBe(
          units.unitForAnchor(row.verseKey)?.key ?? null,
        );
      }
    }
    // The fixture has such verses (Warsh 1:7 is stored as '1:7:5').
    expect(midVerse).toBeGreaterThan(0);
  });
});
