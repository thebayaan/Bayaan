// @ai-generated
/**
 * LOCAL-ONLY full-data check of the player list rows (skipped unless
 * BAYAAN_OVERLAY_DB_DIR is set; needs Node >= 22.5 for node:sqlite):
 *
 *   BAYAAN_OVERLAY_DB_DIR=/path/to/dbs npx jest verseUnitRows.alldbs --watchAll=false
 *
 * The directory holds dk_words_<id>.db (warsh, qaloon, bazzi, qumbul, doori,
 * soosi, shouba) and/or digital-khatt-v2.db (Hafs); the Hafs DB falls back to
 * the bundled one. Release 1 words DBs are required (older data is refused by
 * the verse units, as at runtime).
 *
 * For every surah of every words DB it asserts, on every row:
 *  - one row per rewayah verse in order, plus the unnumbered Fatiha basmala
 *    (Madani / Basri counts) as the first row of al-Fatihah;
 *  - each row draws exactly its verse (its words joined = unitText), and
 *    each word sits on one of the row's own slots with that slot's text;
 *  - every Hafs verse's translation is shown under exactly one row; a
 *    shared-translation note exactly where rows divide a Hafs verse;
 *  - word by word: no Hafs word in two rows, and every Hafs slot that holds
 *    a word in this rewayah is in some row's slice;
 *  - storage: each verse row carries its verse's anchor, which lands on it
 *    (rowIndexForHafsReference);
 *  - follow-along: a rewayah-numbered entry lights exactly its verse, a
 *    Hafs-numbered entry every verse holding it;
 *  - the verse-actions payload and Hafs references (initial anchor).
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  buildRewayahVerseUnits,
  type RewayahVerseUnits,
  type VerseUnitSlot,
} from '@/services/mushaf/RewayahVerseUnits';
import {layoutWords} from '@/services/mushaf/lineWordSpans';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {TimingNumbering} from '@/utils/timestampNumbering';
import {
  buildVerseUnitRows,
  playbackBandUnits,
  rowIndexForHafsReference,
  unitVerseActionsPayload,
  UNNUMBERED_BASMALA_ROW_KEY,
  type VerseUnitRow,
} from '../verseUnitRows';

const REPO = path.resolve(__dirname, '../../../../../..');
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

const FILES: [string, RewayahId, number][] = [
  // file, rewayah, verses
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

function readSlots(file: string): VerseUnitSlot[] {
  const db = new sqlite!.DatabaseSync(file, {readOnly: true});
  try {
    return db
      .prepare('SELECT id, surah, ayah, word, text FROM words ORDER BY id')
      .all()
      .map(r => ({
        id: Number(r.id),
        surah: Number(r.surah),
        ayah: Number(r.ayah),
        word: Number(r.word),
        text: (r.text as string | null) ?? '',
      }));
  } finally {
    db.close();
  }
}

function numbering(
  mode: 'hafs' | 'riwayah',
  reciterRewayah: RewayahId,
): TimingNumbering {
  return {
    surah: 0,
    mode,
    reciterRewayah,
    reason: 'alldbs',
    hafsKeysForEntry: () => [],
    entryAyahsForHafsAyah: () => [],
    startEntryForHafsAyah: () => null,
    endEntryAyahForHafsAyah: () => null,
    entryRangeForHafsAyah: () => null,
    // Verse-unit answers of fix/r1-v-audio (unused here). @ai
    numbersVersesOf: rewayah =>
      mode === 'riwayah' && reciterRewayah === rewayah,
    startEntryForUnit: () => null,
    endEntryAyahForUnit: () => null,
    entryRangeForUnit: () => null,
    unitKeysForEntry: () => [],
  };
}

const tracking = (verseKeys: readonly string[], reciterVerseKey: string) => ({
  surahNumber: Number(reciterVerseKey.split(':')[0]),
  ayahNumber: Number(verseKeys[0]?.split(':')[1] ?? 0),
  verseKey: verseKeys[0] ?? reciterVerseKey,
  timestampFrom: 0,
  timestampTo: 1,
  verseKeys: [...verseKeys],
  reciterVerseKey,
});

const run = DB_DIR && sqlite ? describe : describe.skip;

run('player list rows of every words DB (local only)', () => {
  const present = DB_DIR
    ? FILES.filter(([file]) => fs.existsSync(path.join(DB_DIR, file)))
    : [];

  it('finds at least one words DB', () => {
    expect(present.length).toBeGreaterThan(0);
  });

  for (const [file, rewayah, total] of present) {
    it(`${file}`, () => {
      const slots = readSlots(path.join(DB_DIR!, file));
      const units: RewayahVerseUnits = buildRewayahVerseUnits(
        rewayah,
        slots,
        `${rewayah}@alldbs`,
      );
      const textOf = new Map(slots.map(s => [s.id, s.text]));
      const failures: string[] = [];
      let failureCount = 0;
      const fail = (msg: string) => {
        failureCount += 1;
        if (failures.length < 20) failures.push(msg);
      };
      const content = (hafsKey: string) => ({translation: `T(${hafsKey})`});
      const sameRewayah = numbering('riwayah', rewayah);
      const hafsNumbered = numbering('hafs', rewayah);
      let rowCount = 0;
      let unnumberedRows = 0;
      let slowest = 0;

      for (let surah = 1; surah <= 114; surah++) {
        const started = Date.now();
        const rows = buildVerseUnitRows(units, surah, content);
        slowest = Math.max(slowest, Date.now() - started);
        rowCount += rows.length;
        const verseRows = rows.filter(r => r.unit !== null);
        const list = units.unitsOfSurah(surah);
        if (
          verseRows.length !== list.length ||
          verseRows.some((r, i) => r.unit !== list[i])
        ) {
          fail(`surah ${surah}: rows are not its verses in order`);
        }
        const unnumbered = rows.filter(r => r.unit === null);
        unnumberedRows += unnumbered.length;
        if (unnumbered.length > 0) {
          if (
            surah !== 1 ||
            !MADANI_BASRI.has(rewayah) ||
            unnumbered.length !== 1 ||
            rows[0].verse_key !== UNNUMBERED_BASMALA_ROW_KEY
          ) {
            fail(`surah ${surah}: unexpected unnumbered row`);
          }
        }

        const owners = new Map<string, number>();
        const holders = new Map<string, number>();
        const sliced = new Map<string, Set<number>>();
        rows.forEach((row: VerseUnitRow, index) => {
          const unit = row.unit;
          const where = unit ? `${unit.key}` : 'basmala';
          // Text and words.
          if (unit && layoutWords(row.words).text !== units.unitText(unit)) {
            fail(`${where}: row text differs from the verse text`);
          }
          for (const w of row.words) {
            const range = units.hafsVerseWordRange(w.verseKey);
            const id = range ? range.first + w.wordPositionInVerse - 1 : -1;
            const inRow = unit
              ? id >= unit.firstWordId && id <= unit.lastWordId
              : units.isUnnumberedWordId(id);
            if (!range || !inRow || textOf.get(id) !== w.text) {
              fail(`${where}: word ${w.verseKey}:${w.wordPositionInVerse}`);
            }
          }
          // Hafs-aligned content.
          if (
            unit &&
            row.parts.map(p => p.hafsKey).join() !== unit.hafsKeys.join()
          ) {
            fail(`${where}: parts differ from hafsKeys`);
          }
          for (const p of row.parts) {
            holders.set(p.hafsKey, (holders.get(p.hafsKey) ?? 0) + 1);
            if (p.owned)
              owners.set(p.hafsKey, (owners.get(p.hafsKey) ?? 0) + 1);
            const set = sliced.get(p.hafsKey) ?? new Set<number>();
            for (let pos = p.firstWord; pos <= p.lastWord; pos++) {
              if (set.has(pos))
                fail(`${where}: Hafs ${p.hafsKey}:${pos} twice`);
              set.add(pos);
            }
            sliced.set(p.hafsKey, set);
          }
          if (!unit) return;
          // Storage anchor.
          const anchor = units.hafsAnchor(unit);
          if (row.anchor !== anchor) fail(`${where}: anchor`);
          // Follow-along.
          const own = playbackBandUnits(
            units,
            tracking(unit.hafsKeys, unit.key),
            sameRewayah,
          );
          if (own.length !== 1 || own[0] !== unit) {
            fail(`${where}: rewayah-numbered band is not exactly the verse`);
          }
          // Sheet payload and Hafs references.
          const payload = unitVerseActionsPayload(row, 'player');
          if (
            !payload ||
            payload.verseKey !== anchor.hafsKey ||
            payload.surahNumber !== anchor.surah ||
            payload.ayahNumber !== anchor.ayah ||
            payload.unitKeys.join() !== unit.key ||
            payload.rewayah !== rewayah ||
            (payload.verseKeys ?? [anchor.hafsKey]).join() !==
              (unit.hafsKeys.length > 1
                ? unit.hafsKeys
                : [anchor.hafsKey]
              ).join()
          ) {
            fail(`${where}: payload`);
          }
          if (rowIndexForHafsReference(rows, units, anchor.key) !== index) {
            fail(`${where}: its anchor does not land on it`);
          }
        });

        for (let ayah = 1; ; ayah++) {
          const key = `${surah}:${ayah}`;
          const range = units.hafsVerseWordRange(key);
          if (!range) break;
          if (owners.get(key) !== 1) {
            fail(`${key}: translation under ${owners.get(key) ?? 0} rows`);
          }
          const shared = (holders.get(key) ?? 0) > 1;
          for (const row of rows) {
            for (const p of row.parts) {
              if (p.hafsKey === key && (p.note !== null) !== shared) {
                fail(`${key}: note under ${row.verse_key}`);
              }
            }
          }
          // Word by word: every slot holding a word is in a slice.
          const set = sliced.get(key) ?? new Set<number>();
          for (let id = range.first; id <= range.last; id++) {
            if (textOf.get(id) && !set.has(id - range.first + 1)) {
              fail(`${key}:${id - range.first + 1}: word in no slice`);
            }
          }
          // A Hafs-numbered entry lights every verse holding the Hafs verse.
          const band = playbackBandUnits(
            units,
            tracking([key], key),
            hafsNumbered,
          );
          const holding = units.unitsForHafsKey(key);
          if (
            band.length !== holding.length ||
            band.some((u, i) => u !== holding[i])
          ) {
            fail(`${key}: Hafs-numbered band`);
          }
        }
      }

      if (failureCount > 0) {
        throw new Error(
          `${file}: ${failureCount} failures\n${failures.join('\n')}`,
        );
      }
      expect(rowCount).toBe(total + (MADANI_BASRI.has(rewayah) ? 1 : 0));
      expect(unnumberedRows).toBe(MADANI_BASRI.has(rewayah) ? 1 : 0);
      console.log(
        `[verseUnitRows.alldbs] ${file}: ${rowCount} rows, slowest surah ${slowest} ms`,
      );
    });
  }
});
