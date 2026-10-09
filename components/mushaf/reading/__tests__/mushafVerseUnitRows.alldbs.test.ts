// @ai-generated
/**
 * LOCAL-ONLY full-data check of the mushaf's list and reading modes in verse
 * units (skipped unless BAYAAN_OVERLAY_DB_DIR is set; needs Node >= 22.13 for
 * node:sqlite):
 *
 *   BAYAAN_OVERLAY_DB_DIR=/path/to/dbs npx jest mushafVerseUnitRows.alldbs --watchAll=false
 *
 * The directory holds dk_words_<id>.db (warsh, qaloon, bazzi, qumbul, doori,
 * soosi, shouba) and/or digital-khatt-v2.db (Hafs). The layout DB comes from
 * the repo. The units need Release 1 words DBs (inline verse markers).
 *
 * For every words DB, on all 604 pages:
 *  - reading mode: a page's rows are exactly the verse units the mushaf page
 *    shows and selects (MushafVerseMapService.getOrderedUnitKeysForPage), in
 *    order, plus the unnumbered Fatiha basmala row (Madani / Basri counts);
 *    each row is the verse itself (its words = its text); a surah header
 *    comes right before the first row of a surah opening on the page. Hafs:
 *    the same rows and headers as the Hafs code (getReadingPageItems);
 *  - list mode: every verse of the rewayah exactly once, in order, under its
 *    surah's header; every Hafs key, stored anchor and page lands on the
 *    row holding that slot; a row reports the page of its first word;
 *  - follow-along: a verse of the reciter's own rewayah lights exactly its
 *    row; a Hafs-numbered entry every row holding that Hafs verse.
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
  return {
    ...actual,
    digitalKhattDataService: createFakeDKService(actual.BASMALLAH_TEXT),
  };
});
// The units the runtime service builds from the active words: built here
// from the same DB rows with the core builder.
const mockUnits: {current: unknown} = {current: null};
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: jest
    .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
    .verseUnitsServiceStub({peek: () => mockUnits.current}),
}));

import {
  digitalKhattDataService,
  type DKLine,
} from '@/services/mushaf/DigitalKhattDataService';
import {
  mushafVerseMapService,
  shownVerseUnitsOf,
} from '@/services/mushaf/MushafVerseMapService';
import {
  buildRewayahVerseUnits,
  type RewayahVerseUnits,
  type VerseUnitSlot,
} from '@/services/mushaf/RewayahVerseUnits';
import type {FakeDKService} from '@/services/mushaf/__fixtures__/rewayahOverlayFixture';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {getReadingPageItems} from '@/utils/mushafPageVerses';
import {
  NO_PLAYBACK_BAND,
  playbackBandUnitKeys,
} from '@/components/mushaf/skia/verseHighlightLayers';
import {UNNUMBERED_BASMALA_ROW_KEY} from '@/components/player/v2/PlayerContent/QuranView/verseUnitRows';
import {
  buildUnitListModel,
  pageRowKeys,
  readingPageUnitItems,
  unitRowByKey,
  type UnitListItem,
} from '../mushafVerseUnitRows';

const REPO = path.resolve(__dirname, '../../../..');
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

// Hafs first: getReadingPageItems caches per page (the Hafs comparison).
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
const MADANI_BASRI = new Set<RewayahId>([
  'warsh',
  'qalun',
  'al-duri-abi-amr',
  'al-susi',
]);
const TOTAL_PAGES = 604;
const BASMALA = UNNUMBERED_BASMALA_ROW_KEY;

const run = DB_DIR && sqlite ? describe : describe.skip;
const dk = digitalKhattDataService as unknown as FakeDKService;

function readRows(file: string, sql: string): Record<string, unknown>[] {
  const db = new sqlite!.DatabaseSync(file, {readOnly: true});
  try {
    return db.prepare(sql).all();
  } finally {
    db.close();
  }
}

const keyOf = (item: UnitListItem) =>
  item.type === 'surah_header'
    ? `header:${item.surahNumber}`
    : item.verse.verse_key;

run(
  'mushaf list and reading modes in verse units, every words DB (local only)',
  () => {
    const layoutRows = DB_DIR
      ? (readRows(
          path.join(DK_DIR, 'digital-khatt-15-lines.db'),
          'SELECT * FROM pages ORDER BY page_number, line_number',
        ) as unknown as DKLine[])
      : [];
    const present = DB_DIR
      ? FILES.filter(([file]) => fs.existsSync(path.join(DB_DIR, file)))
      : [];

    it('finds the Hafs DB and at least one rewayah DB', () => {
      expect(present.some(([, r]) => r === 'hafs')).toBe(true);
      expect(present.length).toBeGreaterThan(1);
    });

    for (const [file, rewayah, verseTotal] of present) {
      describe(file, () => {
        let units: RewayahVerseUnits;

        beforeAll(() => {
          const rows = readRows(
            path.join(DB_DIR!, file),
            'SELECT id, location, surah, ayah, word, text FROM words ORDER BY id',
          );
          const slots: VerseUnitSlot[] = rows.map(r => ({
            id: Number(r.id),
            surah: Number(r.surah),
            ayah: Number(r.ayah),
            word: Number(r.word),
            text: (r.text as string | null) ?? '',
          }));
          mushafVerseMapService.clear();
          dk.loadData({
            rewayah,
            words: rows.map(
              r =>
                [
                  Number(r.id),
                  String(r.location),
                  (r.text as string | null) ?? '',
                ] as [number, string, string],
            ),
            lines: layoutRows,
          });
          units = buildRewayahVerseUnits(rewayah, slots, `${rewayah}@alldbs`);
          mockUnits.current = units;
        });

        afterAll(() => {
          mockUnits.current = null;
          mushafVerseMapService.clear();
        });

        it('reading mode: each page lists exactly the verses the mushaf page shows', () => {
          expect(units.units.length).toBe(verseTotal);
          const problems: string[] = [];
          const fail = (msg: string) => {
            if (problems.length < 20) problems.push(msg);
          };
          let basmalaRows = 0;
          for (let page = 1; page <= TOTAL_PAGES; page++) {
            const keys = pageRowKeys(units, page);
            const shown = mushafVerseMapService.getOrderedUnitKeysForPage(page);
            const expected =
              page === 1 && MADANI_BASRI.has(rewayah)
                ? [BASMALA, ...shown]
                : shown;
            if (keys.join() !== expected.join()) {
              fail(`p${page}: rows ${keys.join(' ')} vs ${expected.join(' ')}`);
            }
            const items = readingPageUnitItems(units, page);
            const headers = new Set(
              dk
                .getPageLines(page)
                .filter(l => l.line_type === 'surah_name')
                .map(l => l.surah_number),
            );
            const rowKeys: string[] = [];
            let surah = 0;
            items.forEach((item, i) => {
              if (item.type === 'surah_header') {
                const next = items[i + 1];
                if (
                  !headers.has(item.surahNumber) ||
                  next?.type !== 'verse' ||
                  next.surahNumber !== item.surahNumber
                ) {
                  fail(`p${page}: misplaced header ${item.surahNumber}`);
                }
                return;
              }
              const row = item.verse;
              rowKeys.push(row.verse_key);
              if (unitRowByKey(units, row.verse_key) !== row) {
                fail(`p${page}: ${row.verse_key} is not its row`);
              }
              if (row.surah_number !== surah) {
                if (
                  headers.has(row.surah_number) &&
                  items[i - 1]?.type !== 'surah_header'
                ) {
                  fail(`p${page}: no header before ${row.verse_key}`);
                }
                surah = row.surah_number;
              }
              if (row.unit) {
                if (
                  row.label !== row.unit.key ||
                  row.unit.key !== row.verse_key
                ) {
                  fail(`p${page}: ${row.verse_key} label ${row.label}`);
                }
                const text = row.words.map(w => w.text).join(' ');
                if (text !== units.unitText(row.unit)) {
                  fail(`p${page}: ${row.verse_key} text`);
                }
              } else {
                basmalaRows += 1;
              }
            });
            if (rowKeys.join() !== keys.join()) {
              fail(`p${page}: items ${rowKeys.join(' ')}`);
            }
            if (rewayah === 'hafs') {
              // The Hafs code's rows and headers, item for item.
              const hafs = getReadingPageItems(page).map(item =>
                item.type === 'surah_header'
                  ? `header:${item.surahNumber}`
                  : item.verse.verse_key,
              );
              const mine = items.map(keyOf);
              if (mine.join() !== hafs.join()) {
                fail(`p${page}: Hafs ${hafs.join(' ')} vs ${mine.join(' ')}`);
              }
            }
          }
          expect(problems).toEqual([]);
          expect(basmalaRows).toBe(MADANI_BASRI.has(rewayah) ? 1 : 0);
        });

        it('list mode: every verse once, in order, and every lookup lands on its row', () => {
          const model = buildUnitListModel(units);
          const problems: string[] = [];
          const fail = (msg: string) => {
            if (problems.length < 20) problems.push(msg);
          };
          // Every surah header, then exactly its verses.
          const keys = model.items.map(keyOf);
          const expected: string[] = [];
          for (let surah = 1; surah <= 114; surah++) {
            expected.push(`header:${surah}`);
            if (surah === 1 && MADANI_BASRI.has(rewayah))
              expected.push(BASMALA);
            for (const unit of units.unitsOfSurah(surah))
              expected.push(unit.key);
          }
          expect(keys).toEqual(expected);
          const indexOfUnit = (key: string) => model.indexOfRow(key);

          // Page of each row's first word: from the mushaf page segments.
          const startPage = new Map<string, number>();
          for (let page = 1; page <= TOTAL_PAGES; page++) {
            for (const key of mushafVerseMapService.getOrderedUnitKeysForPage(
              page,
            )) {
              if (!startPage.has(key)) startPage.set(key, page);
            }
            const first = pageRowKeys(units, page)[0];
            if (model.indexForPage(page) !== model.indexOfRow(first)) {
              fail(`page ${page}: not at ${first}`);
            }
          }
          for (const unit of units.units) {
            const anchor = units.hafsAnchor(unit);
            const index = indexOfUnit(unit.key);
            if (index === undefined) {
              fail(`${unit.key}: no row`);
              continue;
            }
            // A stored anchor lands on its own verse.
            if (model.indexForHafsReference(anchor.key) !== index) {
              fail(`${unit.key}: anchor ${anchor.key}`);
            }
            if (model.pageOfRow(unit.key) !== startPage.get(unit.key)) {
              fail(`${unit.key}: page ${model.pageOfRow(unit.key)}`);
            }
            // Follow-along: a verse of the reciter's own rewayah lights
            // exactly its row.
            const band = playbackBandUnitKeys(shownVerseUnitsOf(units), {
              ...NO_PLAYBACK_BAND,
              hafsKeys: unit.hafsKeys,
              mode: 'riwayah',
              reciterRewayah: rewayah,
              entryKey: unit.key,
            });
            if (band.join() !== unit.key) fail(`${unit.key}: band ${band}`);
          }
          if (MADANI_BASRI.has(rewayah)) {
            expect(model.pageOfRow(BASMALA)).toBe(1);
            expect(model.indexForHafsReference('1:1')).toBe(
              model.indexOfRow(BASMALA),
            );
          }
          // Every Hafs verse: its first slot's row; during playback the
          // band's row holding it; a Hafs-numbered entry lights every row
          // holding it.
          for (let surah = 1; surah <= 114; surah++) {
            for (let ayah = 1; ; ayah++) {
              const hafsKey = `${surah}:${ayah}`;
              if (!units.hafsVerseWordRange(hafsKey)) break;
              const holding = units.unitsForHafsKey(hafsKey);
              const atStart = units.unitForAnchor(hafsKey);
              const want = atStart
                ? indexOfUnit(atStart.key)
                : model.indexOfRow(BASMALA);
              if (model.indexForHafsReference(hafsKey) !== want) {
                fail(`${hafsKey}: row`);
              }
              for (const unit of holding) {
                if (
                  model.indexForHafsReference(hafsKey, [unit.key]) !==
                  indexOfUnit(unit.key)
                ) {
                  fail(`${hafsKey}: band row ${unit.key}`);
                }
              }
              const band = playbackBandUnitKeys(shownVerseUnitsOf(units), {
                ...NO_PLAYBACK_BAND,
                hafsKeys: [hafsKey],
                mode: 'hafs',
                reciterRewayah: 'hafs',
                entryKey: hafsKey,
              });
              if (band.join() !== holding.map(u => u.key).join()) {
                fail(`${hafsKey}: Hafs band ${band}`);
              }
            }
          }
          expect(problems).toEqual([]);
        });
      });
    }
  },
);
