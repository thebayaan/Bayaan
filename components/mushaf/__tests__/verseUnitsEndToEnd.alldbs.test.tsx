// @ai-generated
/**
 * LOCAL-ONLY verse units end to end (decision 3 of Release 1) on every verse
 * of every words DB (skipped unless BAYAAN_OVERLAY_DB_DIR is set; needs
 * Node >= 22.5 for node:sqlite):
 *
 *   BAYAAN_OVERLAY_DB_DIR=bundled npx jest verseUnitsEndToEnd.alldbs --watchAll=false
 *   BAYAAN_OVERLAY_DB_DIR=/path/to/dbs npx jest verseUnitsEndToEnd.alldbs --watchAll=false
 *
 * The directory holds dk_words_<id>.db (warsh, qaloon, bazzi, qumbul, doori,
 * soosi, shouba) and/or digital-khatt-v2.db (Hafs; else the repo's). The
 * layout DB comes from the repo. The verse units are built by the real
 * RewayahVerseUnitsService from the words on screen and cross-checked
 * against the bundled verse maps, as at runtime (refused units fail here).
 *
 * On all 604 pages of each DB (__fixtures__/verseUnitsEndToEnd.tsx):
 *  - every rewayah verse is selected whole by a long-press on any of its
 *    words (both ends of every word), with its payload; the iOS drag over
 *    every page selects its verses in reading order;
 *  - the selection band, the follow-along band of a reciter numbered by the
 *    rewayah and a bookmark's tint paint exactly the verse's own words;
 *  - the copied text is exactly the verse's slots (and what the pages
 *    draw), with its Hafs-aligned translations and the citation in the
 *    rewayah's numbering ("Quran 2:1 · Warsh");
 *  - Play from here starts at the verse itself (mushaf and main player),
 *    Repeat loops exactly its entry;
 *  - its storage anchor round-trips: the bookmark row written through the
 *    annotations store, what that row marks, the route a saved row opens and
 *    the verse selected there, the share link;
 *  - Hafs differential: the Hafs DB gives exactly the base results (page
 *    order, payloads, painted layers, copied text, citations, keys, routes,
 *    links) on all 604 pages.
 */
import * as fs from 'fs';
import * as path from 'path';

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

// The real units service (set in beforeAll), over the words on screen.
const mockUnitsService: {
  current: {get(r: string): unknown; getStatus(r: string): string} | null;
} = {current: null};
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: {
    get: (rewayah: string) => mockUnitsService.current?.get(rewayah) ?? null,
    getStatus: (rewayah: string) =>
      mockUnitsService.current?.getStatus(rewayah) ?? 'loading',
  },
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

import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import type {DKLine} from '@/services/mushaf/DigitalKhattDataService';
import type {FakeDKService} from '@/services/mushaf/__fixtures__/rewayahOverlayFixture';
import type {RewayahVerseUnitsService} from '@/services/mushaf/RewayahVerseUnitsService';
import type {RewayahVerseUnits} from '@/services/mushaf/RewayahVerseUnits';
import {rewayahVerseMapService} from '@/services/mushaf/RewayahVerseMapService';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {
  runEndToEnd,
  type EndToEndData,
} from '../__fixtures__/verseUnitsEndToEnd';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const REPO = path.resolve(__dirname, '../../..');
const DK_DIR = path.join(REPO, 'data/mushaf/digitalkhatt');
const envDir = process.env.BAYAAN_OVERLAY_DB_DIR;
const DB_DIR = envDir === 'bundled' ? DK_DIR : envDir;

interface SqliteDb {
  prepare(sql: string): {all(): Record<string, unknown>[]};
  close(): void;
}
let sqlite: {
  DatabaseSync: new (file: string, opts?: object) => SqliteDb;
} | null = null;
try {
  sqlite = require('node:sqlite');
} catch {
  sqlite = null;
}

// file, rewayah, verses
const FILES: [string, RewayahId, number][] = [
  ['digital-khatt-v2.db', 'hafs', 6236],
  ['dk_words_shouba.db', 'shubah', 6236],
  ['dk_words_bazzi.db', 'al-bazzi', 6220],
  ['dk_words_qumbul.db', 'qunbul', 6220],
  ['dk_words_warsh.db', 'warsh', 6214],
  ['dk_words_qaloon.db', 'qalun', 6214],
  ['dk_words_doori.db', 'al-duri-abi-amr', 6217],
  ['dk_words_soosi.db', 'al-susi', 6217],
];
const PAGES = Array.from({length: 604}, (_, i) => i + 1);
const CHECKS = [
  'pages',
  'long-presses',
  'selection bands',
  'drags',
  'copies',
  'playback',
  'storage',
];

function readRows(file: string, sql: string): Record<string, unknown>[] {
  const db = new sqlite!.DatabaseSync(file, {readOnly: true});
  try {
    return db.prepare(sql).all();
  } finally {
    db.close();
  }
}

function fileOf(name: string, rewayah: RewayahId): string | null {
  const own = path.join(DB_DIR!, name);
  if (fs.existsSync(own)) return own;
  const bundled = path.join(DK_DIR, name);
  return rewayah === 'hafs' && fs.existsSync(bundled) ? bundled : null;
}

const run = DB_DIR && sqlite ? describe : describe.skip;

run('verse units end to end on every words DB (local only)', () => {
  const dk = digitalKhattDataService as unknown as FakeDKService;
  let service: RewayahVerseUnitsService;
  let lines: DKLine[] = [];

  beforeAll(() => {
    // The runtime units service, reading the words on screen (the stand-in
    // data service) and cross-checking them with the bundled verse maps.
    const {RewayahVerseUnitsService: Service} = jest.requireActual(
      '@/services/mushaf/RewayahVerseUnitsService',
    );
    service = new Service(
      {
        get rewayah() {
          return dk.rewayah;
        },
        get initialized() {
          return true;
        },
        isRewayahReady: (r: RewayahId) => r === dk.rewayah,
        getRewayahLoadState: (r: RewayahId) =>
          r === dk.rewayah ? 'ready' : 'idle',
        getWordInfo: (id: number) => dk.getWordInfo(id),
        getWordText: (id: number) => dk.getWordText(id),
        getVerseWords: (key: string, r?: RewayahId) => dk.getVerseWords(key, r),
      },
      rewayahVerseMapService,
      (r: RewayahId) => `${r}@end-to-end#${dk.getCacheVersion()}`,
    ) as RewayahVerseUnitsService;
    mockUnitsService.current = service;
    lines = readRows(
      path.join(DK_DIR, 'digital-khatt-15-lines.db'),
      'SELECT * FROM pages ORDER BY page_number, line_number',
    ) as unknown as DKLine[];
  });

  const present = DB_DIR
    ? FILES.filter(([name, rewayah]) => fileOf(name, rewayah) !== null)
    : [];

  it('finds the Hafs DB and the seven rewayah DBs', () => {
    expect(present.map(([, rewayah]) => rewayah)).toEqual(
      FILES.map(([, rewayah]) => rewayah),
    );
  });

  for (const [name, rewayah, verses] of present) {
    it(`${name}: every verse, from a word on its page to what is copied, played and stored`, async () => {
      const words = readRows(
        fileOf(name, rewayah)!,
        'SELECT id, location, text FROM words ORDER BY id',
      ).map(
        r =>
          [
            Number(r.id),
            String(r.location),
            (r.text as string | null) ?? '',
          ] as const,
      );
      const data: EndToEndData = {rewayah, words, lines, pages: PAGES};
      const report = await runEndToEnd(data, {
        sheet: mockSheet,
        unitsOf: r => service.get(r) as RewayahVerseUnits | null,
        database: mockDatabase,
      });
      expect({count: report.count, failures: report.failures}).toEqual({
        count: 0,
        failures: [],
      });
      expect(report.checked.verses).toBe(verses);
      expect(report.checked.pages).toBe(604);
      expect(report.checked.copies).toBe(verses);
      expect(report.checked.playback).toBe(verses);
      expect(report.checked.storage).toBe(verses);
      for (const check of CHECKS) {
        expect([check, report.checked[check] ?? 0]).not.toEqual([check, 0]);
      }
    }, 900_000);
  }
});
