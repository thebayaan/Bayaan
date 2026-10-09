// @ai-generated
/**
 * Long-press and iOS drag-select on a mushaf page (useVerseUnitDragSelect,
 * the gesture logic of both SkiaPage and ContinuousMushafView): the unit
 * under the finger is the shown rewayah's own verse, a drag extends over
 * consecutive verse units of the page, and release opens the verse actions
 * with the units' payload. Real Release 1 slots on the real page-1 layout
 * (verseUnitPages.ts); the renderer's touch -> character mapping is replaced
 * by a direct (line, char) position.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {Platform} from 'react-native';

const mockSheets: {name: string; payload: unknown}[] = [];
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {
    show: (name: string, options: {payload: unknown}) => {
      mockSheets.push({name, payload: options.payload});
      return Promise.resolve();
    },
  },
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {Medium: 'medium', Light: 'light'},
}));
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
    getStatus: (rewayah: string) =>
      mockUnitsByRewayah.has(rewayah) ? 'ready' : 'error',
  },
}));

import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import type {FakeDKService} from '@/services/mushaf/__fixtures__/rewayahOverlayFixture';
import {
  buildFixtureUnits,
  fixtureLines,
  fixtureWords,
  pageOfFixtureSurah,
  UNITS_FIXTURE_REWAYAH,
  type UnitsFixtureDb,
} from '@/services/mushaf/__fixtures__/verseUnitPages';
import {
  useVerseUnitDragSelect,
  type LineCharHit,
  type VerseUnitDragHandlers,
} from '../verseUnitDragSelect';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

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

// Touch points are given as (char index, line index) of the page.
const charAt = (x: number, y: number): LineCharHit | null =>
  x < 0 ? null : {lineIndex: y, charIndex: x};

let handlers: VerseUnitDragHandlers | null = null;
function Harness({page}: {page: number}) {
  handlers = useVerseUnitDragSelect(page, charAt);
  return null;
}

let renderer: TestRenderer.ReactTestRenderer | null = null;
let shownPage = 1;
function mount(page = 1) {
  shownPage = page;
  act(() => {
    renderer = TestRenderer.create(<Harness page={page} />);
  });
}

/** A touch point inside unit `key` on the page (its first segment). */
function pointIn(key: string, at: 'start' | 'end' = 'start'): [number, number] {
  const [first] = mushafVerseMapService.getUnitSegmentsForPage(shownPage, key);
  if (!first) throw new Error(`no segment of ${key}`);
  const {segment} = first;
  return [
    at === 'start' ? segment.startCharIndex : segment.endCharIndex,
    first.lineIndex,
  ];
}

const press = (key: string, at?: 'start' | 'end') =>
  act(() => handlers!.onDragStart(...pointIn(key, at)));
const dragTo = (key: string) =>
  act(() => handlers!.onDragUpdate(...pointIn(key)));
const release = () => act(() => handlers!.onDragEnd());
const selection = () => {
  const s = useMushafVerseSelectionStore.getState();
  return {
    rewayah: s.selectedRewayah,
    keys: s.selectedVerseKeys,
    page: s.selectedPageNumber,
  };
};

beforeEach(() => {
  mockSheets.length = 0;
  useMushafVerseSelectionStore.getState().clearSelection();
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  handlers = null;
  mushafVerseMapService.clear();
});

describe('Warsh page 1', () => {
  beforeEach(() => show('warsh'));

  it('long-press on the second half of Hafs 1:7 selects Warsh 1:7, not Hafs 1:7', () => {
    mount();
    press('1:7');
    expect(selection()).toEqual({rewayah: 'warsh', keys: ['1:7'], page: 1});
    expect(useMushafVerseSelectionStore.getState().selectedUnits).toEqual([
      {key: '1:7', anchor: '1:7:5', hafsKeys: ['1:7']},
    ]);
    release();
    expect(mockSheets).toEqual([
      {
        name: 'verse-actions',
        payload: {
          verseKey: '1:7',
          surahNumber: 1,
          ayahNumber: 7,
          verseKeys: undefined,
          source: 'mushaf',
          rewayah: 'warsh',
          unitKeys: ['1:7'],
        },
      },
    ]);
  });

  it('the inline marker ۝٦ belongs to Warsh 1:6', () => {
    mount();
    press('1:6', 'end');
    expect(selection().keys).toEqual(['1:6']);
  });

  it('a drag extends over consecutive units of the page, never back past the start', () => {
    mount();
    press('1:5');
    dragTo('1:6');
    expect(selection().keys).toEqual(['1:5', '1:6']);
    dragTo('1:7');
    expect(selection().keys).toEqual(['1:5', '1:6', '1:7']);
    dragTo('1:3');
    expect(selection().keys).toEqual(['1:5']);
    dragTo('1:6');
    release();
    expect(mockSheets).toHaveLength(1);
    expect(mockSheets[0].payload).toEqual({
      // Hafs fields: the first unit's anchor verse, every Hafs verse held.
      verseKey: '1:6',
      surahNumber: 1,
      ayahNumber: 6,
      verseKeys: ['1:6', '1:7'],
      source: 'mushaf',
      rewayah: 'warsh',
      unitKeys: ['1:5', '1:6'],
    });
  });

  it('the unnumbered basmala is no verse: nothing to select or open', () => {
    mount();
    // Page 1, line 2 holds Hafs 1:1, the basmala Warsh does not number.
    act(() => handlers!.onDragStart(3, 1));
    expect(selection().keys).toEqual([]);
    release();
    expect(mockSheets).toEqual([]);
    // Off the text: nothing either.
    act(() => handlers!.onDragStart(-1, 3));
    release();
    expect(mockSheets).toEqual([]);
  });

  it('Android: the long-press selects the pressed unit only (no drag)', () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      mount();
      press('1:5');
      dragTo('1:7');
      expect(selection().keys).toEqual(['1:5']);
    } finally {
      replaced.restore();
    }
  });

  it("drags run in the rewayah's own verse order (verses Hafs does not have)", () => {
    // al-Bazzi numbers surah 71 in 30 verses (Hafs: 28).
    show('bazzi');
    mount(pageOfFixtureSurah(71));
    press('71:28');
    dragTo('71:30');
    expect(selection()).toEqual({
      rewayah: 'al-bazzi',
      keys: ['71:28', '71:29', '71:30'],
      page: pageOfFixtureSurah(71),
    });
    // al-Bazzi 71:24 starts inside Hafs 71:23 and ends inside Hafs 71:24;
    // al-Bazzi 71:23, the first part of Hafs 71:23, names its first word.
    press('71:23');
    dragTo('71:25');
    expect(useMushafVerseSelectionStore.getState().selectedUnits).toEqual([
      {key: '71:23', anchor: '71:23:1', hafsKeys: ['71:23']},
      {key: '71:24', anchor: '71:23:10', hafsKeys: ['71:23', '71:24']},
      {key: '71:25', anchor: '71:24:4', hafsKeys: ['71:24']},
    ]);
  });

  it('units and their order follow the text on screen across a rewayah switch', () => {
    mount();
    press('1:1');
    dragTo('1:2');
    expect(selection()).toMatchObject({rewayah: 'warsh', keys: ['1:1', '1:2']});
    release();
    // al-Bazzi numbers the basmala as verse 1: its 1:2 is Warsh 1:1. The
    // mounted page needs no re-render: units are read at gesture time.
    show('bazzi');
    press('1:1');
    dragTo('1:3');
    expect(selection()).toMatchObject({
      rewayah: 'al-bazzi',
      keys: ['1:1', '1:2', '1:3'],
    });
  });
});

describe('Hafs page 1: the selection and payload as before', () => {
  it('Hafs verses, the previous payload fields, unit keys = Hafs keys', () => {
    show('hafs');
    mount();
    press('1:6');
    dragTo('1:7');
    expect(selection()).toEqual({
      rewayah: 'hafs',
      keys: ['1:6', '1:7'],
      page: 1,
    });
    release();
    expect(mockSheets[0].payload).toEqual({
      verseKey: '1:6',
      surahNumber: 1,
      ayahNumber: 6,
      verseKeys: ['1:6', '1:7'],
      source: 'mushaf',
      rewayah: 'hafs',
      unitKeys: ['1:6', '1:7'],
    });
  });
});
