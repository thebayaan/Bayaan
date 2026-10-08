// @ai-generated
/**
 * LOCAL-ONLY full-data check of the mushaf in verse units (skipped unless
 * BAYAAN_OVERLAY_DB_DIR is set; needs Node >= 22.5 for node:sqlite):
 *
 *   BAYAAN_OVERLAY_DB_DIR=bundled npx jest mushafVerseUnits.alldbs --watchAll=false
 *   BAYAAN_OVERLAY_DB_DIR=/path/to/dbs npx jest mushafVerseUnits.alldbs --watchAll=false
 *
 * The directory holds dk_words_<id>.db (warsh, qaloon, bazzi, qumbul, doori,
 * soosi, shouba) and/or digital-khatt-v2.db (Hafs). The layout DB comes from
 * the repo. The units need Release 1 words DBs (inline verse markers).
 *
 * For every words DB, on every line of all 604 pages:
 *  - unit segments: the line's slots grouped by their verse unit, the unit
 *    of each slot coming from an independent walk of the DB in this test
 *    (verse numbers counted from the markers, not the core builder); a unit
 *    that ends at an inline marker inside a line ends its segment there;
 *    the unnumbered Fatiha basmala of the Madani / Basri counts has none;
 *  - hit-testing: both ends of every slot hit its unit, the separator
 *    between two units hits nothing;
 *  - page order: the page's units, consecutive verses of the rewayah;
 *  - every unit is selectable whole from any of its words (key, storage
 *    anchor, Hafs verses), its anchor selects it again, and its selection
 *    band, its follow-along band
 *    (an entry of a set numbered in the rewayah itself) and a bookmark on
 *    its anchor paint exactly its segments, nothing else;
 *  - the Hafs-keyed API (Hafs-aligned callers) equals the base code.
 * Hafs differential against the base pipeline (baseHafsVersePipeline.ts,
 * the code of the release base): segments, page order, every hit-test,
 * every painted layer for synthetic store states, rows saved at every
 * anchor of every rewayah (mid-verse anchors paint nothing in Hafs) and
 * the verse-actions payload are identical on all 604 pages. Shu'bah:
 * units = Hafs verses.
 */
import * as fs from 'fs';
import * as path from 'path';

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

// The units the runtime service builds from the active words: built here
// from the same DB rows with the core builder.
const mockUnits: {current: unknown} = {current: null};
jest.mock('../RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: {
    get: () => mockUnits.current,
    getStatus: () => (mockUnits.current ? 'ready' : 'error'),
  },
}));

import {digitalKhattDataService, type DKLine} from '../DigitalKhattDataService';
import {
  mushafVerseMapService,
  selectionForAnchor,
  selectionForUnitKeys,
} from '../MushafVerseMapService';
import {getLineWordSpans} from '../lineWordSpans';
import {
  buildRewayahVerseUnits,
  parseVerseMarker,
  type RewayahVerseUnits,
  type VerseUnitSlot,
} from '../RewayahVerseUnits';
import type {FakeDKService} from '../__fixtures__/rewayahOverlayFixture';
import {
  baseComputePageHighlightLayers,
  baseFindVerseAtCharIndex,
  baseOrderedVerseKeysForPage,
  basePayloadForKeys,
  baseVerseSegments,
  baseVerseSegmentsForPage,
} from '../__fixtures__/baseHafsVersePipeline';
import {
  computeUnitPageHighlightLayers,
  NO_PLAYBACK_BAND,
  type LineHighlight,
  type PageVerseLayerSources,
  type PlaybackBand,
} from '@/components/mushaf/skia/verseHighlightLayers';
import {verseActionsPayloadForUnits} from '@/store/mushafVerseSelectionStore';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

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

// file, rewayah, verses, units that end at an inline marker inside a line
// are expected (every rewayah with split Hafs verses has some).
const FILES: [string, RewayahId, number, boolean][] = [
  ['digital-khatt-v2.db', 'hafs', 6236, false],
  ['dk_words_shouba.db', 'shubah', 6236, false],
  ['dk_words_bazzi.db', 'al-bazzi', 6220, true],
  ['dk_words_qumbul.db', 'qunbul', 6220, true],
  ['dk_words_warsh.db', 'warsh', 6214, true],
  ['dk_words_qaloon.db', 'qalun', 6214, true],
  ['dk_words_doori.db', 'al-duri-abi-amr', 6217, true],
  ['dk_words_soosi.db', 'al-susi', 6217, true],
];
const MADANI_BASRI = new Set<RewayahId>([
  'warsh',
  'qalun',
  'al-duri-abi-amr',
  'al-susi',
]);
const TOTAL_PAGES = 604;

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

const COLORS = {
  bookmark: 'BOOKMARK',
  play: 'PLAY',
  select: 'SELECT',
  theme: 'THEME',
  highlight: {yellow: 'Y', green: 'G', blue: 'B'} as Record<string, string>,
};

const NO_SOURCES: PageVerseLayerSources = {
  bookmarkedVerseKeys: new Set(),
  persistentHighlights: {},
  playback: NO_PLAYBACK_BAND,
  selection: null,
};

/** SkiaPage's layers, composed exactly as it composes them. */
function paint(
  page: number,
  sources: Partial<PageVerseLayerSources>,
  themeIndexOfHafsVerse?: (hafsKey: string) => number | undefined,
): Map<number, LineHighlight[]> {
  return (
    computeUnitPageHighlightLayers({
      pageNumber: page,
      shown: mushafVerseMapService.getShownVerseUnits(),
      segments: mushafVerseMapService,
      diffHighlights: new Map(),
      themes: themeIndexOfHafsVerse
        ? {color: COLORS.theme, themeIndexOfHafsVerse}
        : null,
      sources: {...NO_SOURCES, ...sources},
      bookmarkColor: COLORS.bookmark,
      highlightColors: COLORS.highlight,
      playbackColor: COLORS.play,
      selectionColor: COLORS.select,
    }) ?? new Map()
  );
}

/** What one unit's segments on a page paint, in one colour. */
function unitPaint(
  page: number,
  unitKey: string,
  color: string,
): Map<number, LineHighlight[]> {
  const out = new Map<number, LineHighlight[]>();
  for (const {
    lineIndex,
    segment,
  } of mushafVerseMapService.getUnitSegmentsForPage(page, unitKey)) {
    const list = out.get(lineIndex) ?? [];
    list.push({
      start: segment.startCharIndex,
      end: segment.endCharIndex,
      color,
    });
    out.set(lineIndex, list);
  }
  return out;
}

interface OracleUnit {
  key: string;
  surah: number;
  ayah: number;
}

/**
 * Independent slot -> unit walk: per surah, verse N runs up to the slot
 * whose last token is the marker N (contract C1); the Madani / Basri Fatiha
 * basmala (Hafs 1:1) belongs to no verse.
 */
function oracleUnits(
  rewayah: RewayahId,
  slots: readonly VerseUnitSlot[],
): Map<number, OracleUnit | null> {
  const out = new Map<number, OracleUnit | null>();
  let surah = 0;
  let count = 0;
  let current: OracleUnit | null = null;
  for (const slot of slots) {
    if (slot.surah !== surah) {
      surah = slot.surah;
      count = 0;
      current = null;
    }
    if (MADANI_BASRI.has(rewayah) && slot.surah === 1 && slot.ayah === 1) {
      out.set(slot.id, null);
      continue;
    }
    if (!current) {
      current = {key: `${surah}:${count + 1}`, surah, ayah: count + 1};
    }
    out.set(slot.id, current);
    const tokens = slot.text ? slot.text.split(' ') : [];
    const marker = tokens.length
      ? parseVerseMarker(tokens[tokens.length - 1])
      : null;
    if (marker !== null) {
      if (marker !== count + 1) {
        throw new Error(`${slot.surah}:${slot.ayah}:${slot.word} marker`);
      }
      count += 1;
      current = null;
    }
  }
  return out;
}

run('mushaf verse units on every page of every words DB (local only)', () => {
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

  for (const [file, rewayah, verseTotal, inlineEnds] of present) {
    describe(file, () => {
      let units: RewayahVerseUnits;
      let oracle: Map<number, OracleUnit | null>;
      let texts: Map<number, string>;

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
        texts = new Map(slots.map(s => [s.id, s.text]));
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
        oracle = oracleUnits(rewayah, slots);
      });

      afterAll(() => {
        mockUnits.current = null;
        mushafVerseMapService.clear();
      });

      it('segments, hit-tests and page order follow the units', () => {
        expect(units.units.length).toBe(verseTotal);
        const problems: string[] = [];
        const fail = (msg: string) => {
          if (problems.length < 20) problems.push(msg);
        };
        const seen = new Set<string>();
        let inlineBoundaries = 0;
        let previousLast = -1;
        for (let page = 1; page <= TOTAL_PAGES; page++) {
          const lines = dk.getPageLines(page);
          const order: string[] = [];
          for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const where = `p${page} L${lineIndex + 1}`;
            const spans = getLineWordSpans(lines[lineIndex], dk);
            // Oracle segments: spans grouped by their slot's unit.
            const expected: {
              key: string;
              surah: number;
              ayah: number;
              start: number;
              end: number;
              first: number;
              last: number;
            }[] = [];
            let open: (typeof expected)[number] | null = null;
            spans.forEach((span, i) => {
              const unit = oracle.get(span.wordId) ?? null;
              if (!unit) {
                open = null;
                return;
              }
              if (open && open.key === unit.key) {
                open.end = span.end;
                open.last = span.wordId;
              } else {
                if (open && i > 0) {
                  // A unit boundary inside the line: at an inline marker
                  // when the closing slot holds a word and its marker.
                  const closing = texts.get(spans[i - 1].wordId) ?? '';
                  if (closing.includes(' ')) inlineBoundaries++;
                }
                open = {
                  key: unit.key,
                  surah: unit.surah,
                  ayah: unit.ayah,
                  start: span.start,
                  end: span.end,
                  first: span.wordId,
                  last: span.wordId,
                };
                expected.push(open);
                if (!order.includes(unit.key)) order.push(unit.key);
              }
            });
            const actual = mushafVerseMapService
              .getUnitSegments(page, lineIndex)
              .map(s => ({
                key: s.verseKey,
                surah: s.surahNumber,
                ayah: s.ayahNumber,
                start: s.startCharIndex,
                end: s.endCharIndex,
                first: s.firstWordId,
                last: s.lastWordId,
              }));
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
              fail(`${where}: segments ${JSON.stringify(actual)}`);
            }
            // Hit-testing: both ends of every slot; separators.
            spans.forEach((span, i) => {
              const key = oracle.get(span.wordId)?.key ?? null;
              for (const index of [span.start, span.end]) {
                const hit = mushafVerseMapService.findUnitAtCharIndex(
                  page,
                  lineIndex,
                  index,
                );
                if ((hit?.verseKey ?? null) !== key) {
                  fail(`${where}: char ${index} hits ${hit?.verseKey}`);
                }
              }
              if (i === 0) return;
              const before = oracle.get(spans[i - 1].wordId)?.key ?? null;
              const gap = mushafVerseMapService.findUnitAtCharIndex(
                page,
                lineIndex,
                span.start - 1,
              );
              const want = before !== null && before === key ? key : null;
              if ((gap?.verseKey ?? null) !== want) {
                fail(`${where}: separator before ${span.wordId} hits ${gap}`);
              }
            });
            // The Hafs-keyed API (Hafs-aligned callers) is the base code.
            const hafsSegments = mushafVerseMapService.getVerseSegments(
              page,
              lineIndex,
            );
            if (
              JSON.stringify(hafsSegments) !==
              JSON.stringify(baseVerseSegments(dk, page, lineIndex))
            ) {
              fail(`${where}: Hafs verse segments changed`);
            }
          }
          const ordered = mushafVerseMapService.getOrderedUnitKeysForPage(page);
          if (JSON.stringify(ordered) !== JSON.stringify(order)) {
            fail(`p${page}: order ${ordered}`);
          }
          // Consecutive verses of the rewayah, continuing the previous page.
          const indexes = ordered.map(k => units.unitByKey(k)?.index ?? -1);
          indexes.forEach((index, i) => {
            if (index < 0) fail(`p${page}: ${ordered[i]} is no unit`);
            if (i > 0 && index !== indexes[i - 1] + 1) {
              fail(`p${page}: ${ordered[i]} does not follow ${ordered[i - 1]}`);
            }
          });
          if (indexes.length > 0) {
            if (
              indexes[0] !== previousLast &&
              indexes[0] !== previousLast + 1
            ) {
              fail(`p${page}: starts at ${ordered[0]}`);
            }
            previousLast = indexes[indexes.length - 1];
          }
          for (const key of ordered) seen.add(key);
          if (
            JSON.stringify(
              mushafVerseMapService.getOrderedVerseKeysForPage(page),
            ) !== JSON.stringify(baseOrderedVerseKeysForPage(dk, page))
          ) {
            fail(`p${page}: Hafs verse order changed`);
          }
        }
        expect(problems).toEqual([]);
        // Every verse of the rewayah is on some page.
        expect(seen.size).toBe(units.units.length);
        if (inlineEnds) expect(inlineBoundaries).toBeGreaterThan(10);
        else expect(inlineBoundaries).toBe(0);
      });

      it('the Fatiha basmala is a verse only where the rewayah counts it', () => {
        // Page 1, line 2 holds Hafs 1:1.
        const keys = mushafVerseMapService
          .getUnitSegments(1, 1)
          .map(s => s.verseKey);
        expect(keys).toEqual(MADANI_BASRI.has(rewayah) ? [] : ['1:1']);
      });

      it('every unit is selected and painted whole: selection, band, bookmark', () => {
        const problems: string[] = [];
        const fail = (msg: string) => {
          if (problems.length < 20) problems.push(msg);
        };
        let checked = 0;
        for (let page = 1; page <= TOTAL_PAGES; page++) {
          for (const key of mushafVerseMapService.getOrderedUnitKeysForPage(
            page,
          )) {
            const unit = units.unitByKey(key)!;
            const anchor = units.hafsAnchor(unit).key;
            const selection = selectionForUnitKeys([key]);
            const expected = JSON.stringify({
              rewayah,
              units: [{key, anchor, hafsKeys: [...unit.hafsKeys]}],
            });
            if (JSON.stringify(selection) !== expected) {
              fail(`${key}: selection ${JSON.stringify(selection)}`);
            }
            // Its storage anchor opens exactly it again (route params).
            if (JSON.stringify(selectionForAnchor(anchor)) !== expected) {
              fail(`${key}: anchor ${anchor} does not select it`);
            }
            const want = (color: string) =>
              JSON.stringify([...unitPaint(page, key, color)]);
            const selected = paint(page, {
              selection: {rewayah, verseKeys: [key]},
            });
            if (JSON.stringify([...selected]) !== want(COLORS.select)) {
              fail(`p${page} ${key}: selection band`);
            }
            const band: PlaybackBand = {
              hafsKeys: unit.hafsKeys,
              mode: rewayah === 'hafs' ? 'hafs' : 'riwayah',
              reciterRewayah: rewayah,
              entryKey: key,
            };
            if (
              JSON.stringify([...paint(page, {playback: band})]) !==
              want(COLORS.play)
            ) {
              fail(`p${page} ${key}: playback band`);
            }
            const bookmarked = paint(page, {
              bookmarkedVerseKeys: new Set([anchor]),
            });
            if (JSON.stringify([...bookmarked]) !== want(COLORS.bookmark)) {
              fail(`p${page} ${key}: bookmark`);
            }
            checked++;
          }
        }
        expect(problems).toEqual([]);
        expect(checked).toBeGreaterThanOrEqual(units.units.length);
      });

      if (rewayah === 'shubah') {
        it("Shu'bah: the units are the Hafs verses on every line", () => {
          for (let page = 1; page <= TOTAL_PAGES; page++) {
            const lines = dk.getPageLines(page);
            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
              expect(
                mushafVerseMapService.getUnitSegments(page, lineIndex),
              ).toEqual(baseVerseSegments(dk, page, lineIndex));
            }
          }
        });
      }

      if (rewayah === 'hafs') {
        it('Hafs differential: segments, page order and every hit-test', () => {
          let chars = 0;
          for (let page = 1; page <= TOTAL_PAGES; page++) {
            expect(
              mushafVerseMapService.getOrderedUnitKeysForPage(page),
            ).toEqual(baseOrderedVerseKeysForPage(dk, page));
            const lines = dk.getPageLines(page);
            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
              const base = baseVerseSegments(dk, page, lineIndex);
              expect(
                mushafVerseMapService.getUnitSegments(page, lineIndex),
              ).toEqual(base);
              const length = dk.getLineText(lines[lineIndex]).length;
              for (let i = -1; i <= length + 1; i++) {
                const now = mushafVerseMapService.findUnitAtCharIndex(
                  page,
                  lineIndex,
                  i,
                );
                const before = baseFindVerseAtCharIndex(dk, page, lineIndex, i);
                if (JSON.stringify(now) !== JSON.stringify(before)) {
                  throw new Error(`p${page} L${lineIndex + 1} char ${i}`);
                }
                chars++;
              }
            }
            for (const key of baseOrderedVerseKeysForPage(dk, page)) {
              expect(
                mushafVerseMapService.getUnitSegmentsForPage(page, key),
              ).toEqual(baseVerseSegmentsForPage(dk, page, key));
            }
          }
          expect(chars).toBeGreaterThan(300000);
        });

        it('Hafs differential: every painted layer, every page', () => {
          // Deterministic stand-in for the theme data (Hafs-keyed).
          const themeIndexOfHafs = (hafsKey: string) => {
            const ayah = Number(hafsKey.split(':')[1]);
            return ayah % 5 === 0 ? undefined : Math.floor(ayah / 3);
          };
          const colours = ['yellow', 'green', 'blue', 'missing'];
          let compared = 0;
          for (let page = 1; page <= TOTAL_PAGES; page++) {
            const keys = baseOrderedVerseKeysForPage(dk, page);
            const states = keys.length === 0 ? 1 : Math.min(keys.length, 6);
            for (let i = 0; i < states; i++) {
              const at = (n: number) =>
                keys[(i + n) % Math.max(keys.length, 1)];
              const window = keys.slice(i, i + 1 + (i % 3));
              const bookmarked = new Set(
                keys.length ? [at(0), at(3), '2:999', 'nonsense'] : [],
              );
              const highlights: Record<string, string> = {};
              if (keys.length) {
                highlights[at(1)] = colours[i % colours.length];
                highlights[at(2)] = colours[(i + 1) % colours.length];
                highlights[at(3)] = 'green';
              }
              const playing = i % 2 === 0 ? window : [];
              const selected = i % 3 === 1 ? window : null;
              const withThemes = i % 2 === 1;
              const before =
                baseComputePageHighlightLayers({
                  getVerseSegments: vk =>
                    baseVerseSegmentsForPage(dk, page, vk),
                  diffHighlights: new Map(),
                  themes: withThemes
                    ? {
                        verseKeys: baseOrderedVerseKeysForPage(dk, page),
                        color: COLORS.theme,
                        themeIndexOf: themeIndexOfHafs,
                      }
                    : null,
                  bookmarkedVerseKeys: bookmarked,
                  bookmarkColor: COLORS.bookmark,
                  persistentHighlights: highlights,
                  highlightColors: COLORS.highlight,
                  playbackVerseKeys: playing,
                  playbackColor: COLORS.play,
                  selectedVerseKeys: selected,
                  selectionColor: COLORS.select,
                }) ?? new Map();
              const after = paint(
                page,
                {
                  bookmarkedVerseKeys: bookmarked,
                  persistentHighlights: highlights,
                  playback: playing.length
                    ? {
                        hafsKeys: playing,
                        mode: 'hafs',
                        reciterRewayah: 'hafs',
                        entryKey: playing[0],
                      }
                    : NO_PLAYBACK_BAND,
                  selection: selected
                    ? {rewayah: 'hafs', verseKeys: selected}
                    : null,
                },
                withThemes ? themeIndexOfHafs : undefined,
              );
              // Lines without highlights render nothing in both.
              const drop = (m: Map<number, LineHighlight[]>) =>
                JSON.stringify([...m].filter(([, list]) => list.length > 0));
              if (drop(after) !== drop(before)) {
                throw new Error(`p${page} state ${i}: layers differ`);
              }
              compared++;
            }
          }
          expect(compared).toBeGreaterThan(2500);
        });

        it('Hafs differential: rows saved at every anchor of every rewayah', () => {
          // A row of any rewayah marks, on the Hafs page, the Hafs verse its
          // verse_key names, exactly as the base pipeline painted it; a
          // mid-verse anchor (the later part of a split Hafs verse: Warsh
          // 1:7 at '1:7:5') names none and is not painted, as the Hafs
          // verse sheet reports and removes rows by their exact key too.
          const byHafsVerse = new Map<string, [string, RewayahId][]>();
          const midVerse = new Set<string>();
          for (const [other, otherRewayah] of present) {
            if (otherRewayah === 'hafs') continue;
            const slots = readRows(
              path.join(DB_DIR!, other),
              'SELECT id, surah, ayah, word, text FROM words ORDER BY id',
            ).map(r => ({
              id: Number(r.id),
              surah: Number(r.surah),
              ayah: Number(r.ayah),
              word: Number(r.word),
              text: (r.text as string | null) ?? '',
            }));
            const otherUnits = buildRewayahVerseUnits(
              otherRewayah,
              slots,
              `${otherRewayah}@alldbs`,
            );
            for (const unit of otherUnits.units) {
              const anchor = otherUnits.hafsAnchor(unit);
              const list = byHafsVerse.get(anchor.hafsKey) ?? [];
              list.push([anchor.key, otherRewayah]);
              byHafsVerse.set(anchor.hafsKey, list);
              if (anchor.key !== anchor.hafsKey) midVerse.add(anchor.key);
            }
          }
          const colours = ['yellow', 'green', 'blue'];
          const included = new Set<string>();
          let compared = 0;
          for (let page = 1; page <= TOTAL_PAGES; page++) {
            // verse_key is UNIQUE: the first rewayah to claim a key has it.
            const bookmarkRows: Record<
              string,
              {verseKey: string; rewayahId: RewayahId}
            > = {};
            const highlights: Record<string, string> = {};
            for (const hafsKey of baseOrderedVerseKeysForPage(dk, page)) {
              for (const [verseKey, rewayahId] of byHafsVerse.get(hafsKey) ??
                []) {
                if (bookmarkRows[verseKey]) continue;
                bookmarkRows[verseKey] = {verseKey, rewayahId};
                const n = Object.keys(bookmarkRows).length;
                if (n % 2 === 0) highlights[verseKey] = colours[n % 3];
                included.add(verseKey);
              }
            }
            const bookmarked = new Set(
              Object.keys(bookmarkRows).filter((_, n) => n % 3 !== 1),
            );
            const before =
              baseComputePageHighlightLayers({
                getVerseSegments: vk => baseVerseSegmentsForPage(dk, page, vk),
                diffHighlights: new Map(),
                themes: null,
                bookmarkedVerseKeys: bookmarked,
                bookmarkColor: COLORS.bookmark,
                persistentHighlights: highlights,
                highlightColors: COLORS.highlight,
                playbackVerseKeys: [],
                playbackColor: COLORS.play,
                selectedVerseKeys: null,
                selectionColor: COLORS.select,
              }) ?? new Map();
            const after = paint(page, {
              bookmarkedVerseKeys: bookmarked,
              bookmarkRows,
              persistentHighlights: highlights,
              highlightRows: bookmarkRows,
            });
            const drop = (m: Map<number, LineHighlight[]>) =>
              JSON.stringify([...m].filter(([, list]) => list.length > 0));
            if (drop(after) !== drop(before)) {
              throw new Error(`p${page}: rows not painted as the base did`);
            }
            compared++;
          }
          expect(compared).toBe(TOTAL_PAGES);
          // Every mid-verse anchor of every DB here was in some page's rows.
          expect([...midVerse].filter(key => !included.has(key))).toEqual([]);
        });

        it('Hafs differential: the verse-actions payload of every selection', () => {
          let compared = 0;
          for (let page = 1; page <= TOTAL_PAGES; page++) {
            const keys = baseOrderedVerseKeysForPage(dk, page);
            const ranges = keys.map(k => [k]);
            if (keys.length > 1) ranges.push(keys.slice(0, 2), keys);
            for (const range of ranges) {
              const selection = selectionForUnitKeys(range)!;
              expect(selection.rewayah).toBe('hafs');
              const {
                rewayah: payloadRewayah,
                unitKeys,
                ...hafsFields
              } = verseActionsPayloadForUnits('hafs', selection.units)!;
              expect(hafsFields).toEqual(basePayloadForKeys(range));
              expect(payloadRewayah).toBe('hafs');
              expect(unitKeys).toEqual(range);
              compared++;
            }
          }
          expect(compared).toBeGreaterThan(6236);
        });
      }
    });
  }
});
