// @ai-generated
/**
 * Verse units end to end (decision 3 of Release 1) on real slots: seven
 * complete surahs of the Hafs, Shu'bah, Warsh, al-Bazzi and al-Duri words
 * DBs (verseUnitsFixture.json, laid out as pages by verseUnitPages.ts).
 * Always runs. From a long-press on every word to the payload, the
 * selection band, the copied text and citation, Play from here / Repeat
 * for a reciter numbered by the rewayah, and the stored anchor (bookmark
 * row, what it marks, route, share link); Hafs gives the base results. The
 * chain and its checks: __fixtures__/verseUnitsEndToEnd.tsx.
 * verseUnitsEndToEnd.alldbs.test.tsx runs the same chain on every verse of
 * every words DB.
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
  return {...actual, digitalKhattDataService: createFakeDKService()};
});

// The verse units of the words on screen (built from the same slots).
const mockUnits: {current: {rewayah: string} | null} = {current: null};
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: jest
    .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
    .verseUnitsServiceStub({
      peek: (rewayah: string) =>
        mockUnits.current?.rewayah === rewayah ? mockUnits.current : null,
    }),
}));

const mockSheet: {last: {name: string; payload: unknown} | null} = {
  last: null,
};
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {
    show: (name: string, options?: {payload?: unknown}) => {
      mockSheet.last = {name, payload: options?.payload};
      return Promise.resolve();
    },
    hide: () => Promise.resolve(),
    hideAll: () => undefined,
  },
}));

jest.mock('@/utils/toastUtils', () => ({showToast: jest.fn()}));
jest.mock('expo-haptics', () => ({
  impactAsync: () => Promise.resolve(),
  ImpactFeedbackStyle: {Light: 'light', Medium: 'medium', Heavy: 'heavy'},
}));

// The annotations store is real; its database is not.
const mockDatabase: {
  lastAddBookmark: unknown[] | null;
  lastRemoveBookmark: unknown[] | null;
} = {lastAddBookmark: null, lastRemoveBookmark: null};
jest.mock('@/services/verse-annotations/VerseAnnotationService', () => ({
  verseAnnotationService: {
    getAnnotationsForSurah: async () => ({
      bookmarks: [],
      notes: [],
      highlights: [],
    }),
    // The store's unit API writes each change in one call (one
    // transaction): its last bookmark row added / deleted, as the
    // single-row calls record them.
    applyAnnotationChanges: async (changes: {
      addBookmarks?: {
        verseKey: string;
        surahNumber: number;
        ayahNumber: number;
        rewayahId: string;
      }[];
      removeBookmarks?: string[];
    }) => {
      for (const row of changes.addBookmarks ?? []) {
        mockDatabase.lastAddBookmark = [
          row.verseKey,
          row.surahNumber,
          row.ayahNumber,
          row.rewayahId,
        ];
      }
      for (const verseKey of changes.removeBookmarks ?? []) {
        mockDatabase.lastRemoveBookmark = [verseKey];
      }
    },
    addBookmark: async (...args: unknown[]) => {
      mockDatabase.lastAddBookmark = args;
    },
    removeBookmark: async (...args: unknown[]) => {
      mockDatabase.lastRemoveBookmark = args;
    },
    upsertHighlight: async () => undefined,
    removeHighlight: async () => undefined,
    addNote: async () => undefined,
  },
}));

jest.mock('@/store/mushafSettingsStore', () => {
  const {create} = jest.requireActual('zustand');
  return {useMushafSettingsStore: create(() => ({rewayah: 'hafs'}))};
});

jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {trackShareCreated: () => undefined},
}));

// The main player's timings are set by the test (resolvePlayFromHere).
jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {getTimestampsForSurah: async () => null},
}));
jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {hasSurah: () => true, hasSource: () => true},
}));

import {
  runEndToEnd,
  walkOracle,
  type EndToEndData,
} from '../__fixtures__/verseUnitsEndToEnd';
import {
  buildFixtureUnits,
  fixtureLines,
  fixturePages,
  fixtureWords,
  unitsFixture,
  UNITS_FIXTURE_DBS,
  UNITS_FIXTURE_REWAYAH,
} from '@/services/mushaf/__fixtures__/verseUnitPages';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const CHECKS = [
  'pages',
  'long-presses',
  'selection bands',
  'drags',
  'copies',
  'playback',
  'storage',
];

describe('verse units end to end on real slots', () => {
  it.each(UNITS_FIXTURE_DBS)(
    '%s: the oracle agrees with the fixture walk',
    db => {
      // Two independent walks of the same slots (this test's and the
      // Python generator's) name the same verses.
      const oracle = walkOracle(UNITS_FIXTURE_REWAYAH[db], fixtureWords(db));
      expect(
        oracle.units.map(u => [
          u.surah,
          u.ayah,
          u.firstId,
          u.lastId,
          u.hafsKeys,
          u.anchor,
          u.text,
        ]),
      ).toEqual(unitsFixture.expected[db]);
    },
  );

  it.each(UNITS_FIXTURE_DBS)(
    '%s: from a word on the page to what is copied, played and stored',
    async db => {
      const rewayah = UNITS_FIXTURE_REWAYAH[db];
      const units = buildFixtureUnits(db);
      const data: EndToEndData = {
        rewayah,
        words: fixtureWords(db),
        lines: fixtureLines(),
        pages: fixturePages(),
      };
      const report = await runEndToEnd(data, {
        sheet: mockSheet,
        useUnitsOf: () => {
          mockUnits.current = units;
        },
        unitsOf: r => (r === rewayah ? units : null),
        database: mockDatabase,
      });
      expect({count: report.count, failures: report.failures}).toEqual({
        count: 0,
        failures: [],
      });
      expect(report.checked.verses).toBe(unitsFixture.expected[db].length);
      for (const check of CHECKS) {
        expect([check, report.checked[check] ?? 0]).not.toEqual([check, 0]);
      }
    },
  );
});
