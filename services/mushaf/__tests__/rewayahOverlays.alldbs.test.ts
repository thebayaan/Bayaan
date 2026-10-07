/**
 * LOCAL-ONLY full-data check (skipped unless BAYAAN_OVERLAY_DB_DIR is set;
 * needs Node >= 22.5 for node:sqlite). Runs the overlay walkers on EVERY line
 * of every words DB found in the directory:
 *
 *   BAYAAN_OVERLAY_DB_DIR=bundled npx jest rewayahOverlays.alldbs --watchAll=false
 *   BAYAAN_OVERLAY_DB_DIR=/path/to/dbs npx jest rewayahOverlays.alldbs --watchAll=false
 *
 * The directory holds dk_words_<id>.db (warsh, qaloon, bazzi, qumbul, doori,
 * soosi, shouba) and/or digital-khatt-v2.db (Hafs), optionally <id>-diff.json
 * next to them ('bundled' = data/mushaf/digitalkhatt). The layout DB and the
 * Hafs QPC tajweed JSON always come from the repo.
 *
 * Per line it asserts: spans index exactly into the getLineText string (one
 * separator between slots, none for blank slots); every slot hit-tests to its
 * own verse; the Allah-name map equals the token-level map of the line text;
 * Hafs tajweed equals the word-id walker on Hafs and is absent on any other
 * rewayah; every whole-word diff tint is exactly a flagged slot's whole-word
 * part (no inline marker) and every foreground index lies inside a slot's
 * whole-word part.
 */
import * as path from 'path';
import * as fs from 'fs';

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

const mockDiffAssets: Record<string, Record<string, unknown>> = {
  shubah: {},
  'al-bazzi': {},
  qunbul: {},
  warsh: {},
  qalun: {},
  'al-duri-abi-amr': {},
  'al-susi': {},
};
jest.mock(
  '@/data/mushaf/digitalkhatt/shouba-diff.json',
  () => mockDiffAssets.shubah,
);
jest.mock(
  '@/data/mushaf/digitalkhatt/bazzi-diff.json',
  () => mockDiffAssets['al-bazzi'],
);
jest.mock(
  '@/data/mushaf/digitalkhatt/qumbul-diff.json',
  () => mockDiffAssets.qunbul,
);
jest.mock(
  '@/data/mushaf/digitalkhatt/warsh-diff.json',
  () => mockDiffAssets.warsh,
);
jest.mock(
  '@/data/mushaf/digitalkhatt/qaloon-diff.json',
  () => mockDiffAssets.qalun,
);
jest.mock(
  '@/data/mushaf/digitalkhatt/doori-diff.json',
  () => mockDiffAssets['al-duri-abi-amr'],
);
jest.mock(
  '@/data/mushaf/digitalkhatt/soosi-diff.json',
  () => mockDiffAssets['al-susi'],
);

import {digitalKhattDataService, type DKLine} from '../DigitalKhattDataService';
import {mushafVerseMapService} from '../MushafVerseMapService';
import {
  getLineAllahNameCharMap,
  getTextAllahNameCharMap,
} from '../AllahNameHighlightService';
import {getLineTajweedMap} from '../TajweedMappingService';
import {alignWordTajweed, detectWordTafkhim} from '../TajweedAlignmentService';
import {rewayahDiffService} from '../RewayahDiffService';
import {getLineWordSpans, wholeWordText} from '../lineWordSpans';
import type {FakeDKService} from '../__fixtures__/rewayahOverlayFixture';
import {preloadTajweedData} from '@/utils/tajweedLoader';
import {useTajweedStore} from '@/store/tajweedStore';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

const REPO = path.resolve(__dirname, '../../..');
const DK_DIR = path.join(REPO, 'data/mushaf/digitalkhatt');
const envDir = process.env.BAYAAN_OVERLAY_DB_DIR;
const DB_DIR = envDir === 'bundled' ? DK_DIR : envDir;

let sqlite: {
  DatabaseSync: new (file: string, opts?: object) => SqliteDb;
} | null = null;
interface SqliteDb {
  prepare(sql: string): {all(): Record<string, unknown>[]};
  close(): void;
}
try {
  sqlite = require('node:sqlite');
} catch {
  sqlite = null;
}

const FILES: [string, RewayahId, string | null][] = [
  ['digital-khatt-v2.db', 'hafs', null],
  ['dk_words_shouba.db', 'shubah', 'shouba-diff.json'],
  ['dk_words_bazzi.db', 'al-bazzi', 'bazzi-diff.json'],
  ['dk_words_qumbul.db', 'qunbul', 'qumbul-diff.json'],
  ['dk_words_warsh.db', 'warsh', 'warsh-diff.json'],
  ['dk_words_qaloon.db', 'qalun', 'qaloon-diff.json'],
  ['dk_words_doori.db', 'al-duri-abi-amr', 'doori-diff.json'],
  ['dk_words_soosi.db', 'al-susi', 'soosi-diff.json'],
];

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

run('overlay walkers on every line of every words DB (local only)', () => {
  const layoutRows = DB_DIR
    ? (readRows(
        path.join(DK_DIR, 'digital-khatt-15-lines.db'),
        'SELECT * FROM pages ORDER BY page_number, line_number',
      ) as unknown as DKLine[])
    : [];
  const linesByPage = new Map<number, DKLine[]>();
  for (const line of layoutRows) {
    const list = linesByPage.get(line.page_number);
    if (list) list.push(line);
    else linesByPage.set(line.page_number, [line]);
  }

  let tajweed: NonNullable<
    ReturnType<typeof useTajweedStore.getState>['indexedTajweedData']
  >;
  beforeAll(() => {
    preloadTajweedData();
    tajweed = useTajweedStore.getState().indexedTajweedData!;
  });

  const present = DB_DIR
    ? FILES.filter(([file]) => fs.existsSync(path.join(DB_DIR, file)))
    : [];

  it('finds at least one words DB', () => {
    expect(present.length).toBeGreaterThan(0);
  });

  for (const [file, rewayah, diffFile] of present) {
    it(`${file}`, () => {
      const words = readRows(
        path.join(DB_DIR!, file),
        'SELECT id, location, text FROM words ORDER BY id',
      ).map(r => [r.id, r.location, r.text] as [number, string, string]);
      dk.loadData({rewayah, words, lines: layoutRows});

      const diffPath = diffFile ? path.join(DB_DIR!, diffFile) : null;
      const diff =
        diffPath && fs.existsSync(diffPath)
          ? (JSON.parse(fs.readFileSync(diffPath, 'utf8')) as Record<
              string,
              unknown
            >)
          : null;
      if (diff) {
        const target = mockDiffAssets[rewayah];
        for (const key of Object.keys(target)) delete target[key];
        Object.assign(target, diff);
      }
      rewayahDiffService.loadForRewayah(diff ? rewayah : 'hafs');
      const flagged = new Set<string>();
      for (const [verseKey, value] of Object.entries(diff ?? {})) {
        if (verseKey.startsWith('__')) continue;
        if (Array.isArray(value)) {
          for (const pos of value as number[])
            flagged.add(`${verseKey}:${pos}`);
          continue;
        }
        for (const cat of ['major', 'mukhtalif']) {
          const entries = (value as Record<string, unknown[]>)[cat] ?? [];
          for (const entry of entries) {
            const pos = Array.isArray(entry) ? entry[0] : entry;
            flagged.add(`${verseKey}:${pos}`);
          }
        }
      }

      const violations: string[] = [];
      let violationCount = 0;
      const fail = (msg: string) => {
        violationCount++;
        if (violations.length < 20) violations.push(msg);
      };
      const stats = {
        lines: 0,
        blank: 0,
        multiToken: 0,
        inlineMarker: 0,
        tints: 0,
        fgChars: 0,
      };

      for (const [pageNumber, pageLines] of linesByPage) {
        pageLines.forEach((line, lineIndex) => {
          if (line.line_type !== 'ayah') return;
          stats.lines++;
          const where = `${file} p${pageNumber} L${lineIndex + 1}`;
          const text = dk.getLineText(line);
          const spans = getLineWordSpans(line, dk);
          for (let id = line.first_word_id; id <= line.last_word_id; id++) {
            const slot = dk.getWordText(id);
            if (!slot) stats.blank++;
            else if (slot.includes(' ')) {
              stats.multiToken++;
              if (wholeWordText(slot) !== slot) stats.inlineMarker++;
            }
          }

          // 1. spans index exactly into the rendered line
          let cursor = 0;
          spans.forEach((span, i) => {
            if (text.slice(span.start, span.end + 1) !== span.text) {
              fail(`${where}: span ${span.wordId} text mismatch`);
            }
            if (span.start !== (i === 0 ? 0 : cursor + 1)) {
              fail(`${where}: span ${span.wordId} starts at ${span.start}`);
            }
            cursor = span.end + 1;
          });
          if (cursor !== text.length) fail(`${where}: spans end at ${cursor}`);

          // 2. hit-testing
          for (const span of spans) {
            for (const index of [span.start, span.end]) {
              const hit = mushafVerseMapService.findVerseAtCharIndex(
                pageNumber,
                lineIndex,
                index,
              );
              if (hit?.verseKey !== span.info.verseKey) {
                fail(`${where}: char ${index} hits ${hit?.verseKey}`);
              }
            }
          }

          // 3. Allah-name map on the rendered text
          const allah = getLineAllahNameCharMap(pageNumber, lineIndex);
          const expectedAllah = getTextAllahNameCharMap(text);
          if (
            JSON.stringify([...(allah ?? [])]) !==
            JSON.stringify([...(expectedAllah ?? [])])
          ) {
            fail(`${where}: Allah-name map differs`);
          }

          // 4. tajweed: Hafs only
          const tajweedMap = getLineTajweedMap(pageNumber, lineIndex, tajweed);
          if (rewayah !== 'hafs') {
            if (tajweedMap) fail(`${where}: Hafs tajweed on ${rewayah}`);
          } else {
            const expected = new Map<number, string>();
            for (const span of spans) {
              const verseWords = tajweed[span.info.verseKey];
              if (!verseWords) continue;
              const tw = verseWords.find(
                w =>
                  Number(w.location.split(':')[2]) ===
                  span.info.wordPositionInVerse,
              );
              const rules = tw
                ? alignWordTajweed(span.text, tw.segments)
                : detectWordTafkhim(span.text);
              rules?.forEach((rule, k) => expected.set(span.start + k, rule));
            }
            if (
              JSON.stringify([...(tajweedMap ?? [])]) !==
              JSON.stringify([...expected])
            ) {
              fail(`${where}: tajweed map differs`);
            }
          }

          // 5. diff tints and foreground indices
          for (const range of rewayahDiffService.getDiffRangesForLine(
            pageNumber,
            lineIndex,
          )) {
            stats.tints++;
            const span = spans.find(s => s.start === range.start);
            if (
              !span ||
              range.end !== span.wordEnd ||
              !flagged.has(
                `${span.info.verseKey}:${span.info.wordPositionInVerse}`,
              )
            ) {
              fail(`${where}: tint ${range.start}-${range.end}`);
            }
          }
          const fg = rewayahDiffService.getRewayahRuleMapForLine(
            pageNumber,
            lineIndex,
          );
          for (const index of fg?.keys() ?? []) {
            stats.fgChars++;
            if (!spans.some(s => index >= s.start && index <= s.wordEnd)) {
              fail(`${where}: foreground char ${index} outside a word`);
            }
          }
        });
      }

      console.log(
        `${file}: ${JSON.stringify(stats)} violations=${violationCount}`,
      );
      expect(violations).toEqual([]);
      expect(stats.lines).toBe(8820);
    });
  }
});
