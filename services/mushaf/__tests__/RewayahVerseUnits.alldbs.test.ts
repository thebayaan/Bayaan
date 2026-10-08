// @ai-generated
/**
 * LOCAL-ONLY full-data check of the verse units (skipped unless
 * BAYAAN_OVERLAY_DB_DIR is set; needs Node >= 22.5 for node:sqlite):
 *
 *   BAYAAN_OVERLAY_DB_DIR=bundled npx jest RewayahVerseUnits.alldbs --watchAll=false
 *   BAYAAN_OVERLAY_DB_DIR=/path/to/dbs npx jest RewayahVerseUnits.alldbs --watchAll=false
 *
 * The directory holds dk_words_<id>.db (warsh, qaloon, bazzi, qumbul, doori,
 * soosi, shouba) with their <id>-versemap.json, and/or digital-khatt-v2.db
 * (Hafs). Missing verse maps and the Hafs DB fall back to the bundled ones;
 * the layout DB always comes from the repo. The units need Release 1 words
 * DBs (inline verse markers, contract C1): older data fails here, as it is
 * refused at runtime.
 *
 * For every words DB it asserts, on every slot:
 *  - every slot belongs to exactly one unit, except the unnumbered Fatiha
 *    basmala of the Madani / Basri counts (exactly the Hafs 1:1 slots: the
 *    basmala's four words and a blank marker slot; its spelling, the
 *    rewayah's own basmala, is checked by rewayahOverlays.alldbs);
 *  - the units of every surah are numbered 1..N, N = the verse map's count
 *    (Hafs: the Hafs count), and the totals are 6236 / 6220 / 6214 / 6217;
 *  - each unit's text is the surah's token stream cut after each verse
 *    marker (the stream the data gates prove equal to the official text);
 *  - hafsKeys equal r2h and unitsForHafsKey equals h2r for every verse;
 *  - Hafs, Shu'bah and every identity surah: units are the Hafs verses;
 *  - storage anchors are distinct, round-trip, and are mid-verse exactly for
 *    the split Hafs verses (59 / 67 / 57 / 0);
 *  - a unit starts on the page of its anchor's Hafs verse start (so
 *    getPageForVerse(anchor.hafsKey) pages to it);
 *  - the named edge cases of the consumer contract.
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  buildRewayahVerseUnits,
  crossCheckVerseUnits,
  parseVerseMarker,
  type RewayahVerseUnits,
  type VerseUnitSlot,
} from '../RewayahVerseUnits';
import {
  RewayahVerseMapService,
  VERSE_MAP_FILE_IDS,
  type VerseMapFileId,
} from '../RewayahVerseMapService';
import {SURAHS} from '@/data/surahData';
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

const FILES: [string, RewayahId, number, number][] = [
  // file, rewayah, total verses, split Hafs verses
  ['digital-khatt-v2.db', 'hafs', 6236, 0],
  ['dk_words_shouba.db', 'shubah', 6236, 0],
  ['dk_words_bazzi.db', 'al-bazzi', 6220, 67],
  ['dk_words_qumbul.db', 'qunbul', 6220, 67],
  ['dk_words_warsh.db', 'warsh', 6214, 59],
  ['dk_words_qaloon.db', 'qalun', 6214, 59],
  ['dk_words_doori.db', 'al-duri-abi-amr', 6217, 57],
  ['dk_words_soosi.db', 'al-susi', 6217, 57],
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

function readPageOfWord(): (wordId: number) => number {
  const db = new sqlite!.DatabaseSync(
    path.join(DK_DIR, 'digital-khatt-15-lines.db'),
    {readOnly: true},
  );
  let lines: {page: number; first: number; last: number}[];
  try {
    lines = db
      .prepare(
        "SELECT page_number, first_word_id, last_word_id FROM pages WHERE line_type = 'ayah' ORDER BY first_word_id",
      )
      .all()
      .map(r => ({
        page: Number(r.page_number),
        first: Number(r.first_word_id),
        last: Number(r.last_word_id),
      }));
  } finally {
    db.close();
  }
  return wordId => {
    let lo = 0;
    let hi = lines.length - 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (lines[mid].last < wordId) lo = mid + 1;
      else if (lines[mid].first > wordId) hi = mid - 1;
      else return lines[mid].page;
    }
    return -1;
  };
}

function verseMapService(): RewayahVerseMapService {
  const loaders = {} as Record<VerseMapFileId, () => unknown>;
  for (const fileId of Object.values(VERSE_MAP_FILE_IDS)) {
    loaders[fileId] = () => {
      const local = path.join(DB_DIR!, `${fileId}-versemap.json`);
      const file = fs.existsSync(local)
        ? local
        : path.join(DK_DIR, `${fileId}-versemap.json`);
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    };
  }
  return new RewayahVerseMapService(loaders);
}

const run = DB_DIR && sqlite ? describe : describe.skip;

run('verse units of every words DB (local only)', () => {
  const present = DB_DIR
    ? FILES.filter(([file]) => fs.existsSync(path.join(DB_DIR, file)))
    : [];
  const hafsFile = fs.existsSync(path.join(DB_DIR ?? '', 'digital-khatt-v2.db'))
    ? path.join(DB_DIR!, 'digital-khatt-v2.db')
    : path.join(DK_DIR, 'digital-khatt-v2.db');

  let hafsSlots: VerseUnitSlot[];
  let pageOf: (wordId: number) => number;
  let verseMap: RewayahVerseMapService;
  beforeAll(() => {
    hafsSlots = readSlots(hafsFile);
    pageOf = readPageOfWord();
    verseMap = verseMapService();
  });

  it('finds at least one words DB', () => {
    expect(present.length).toBeGreaterThan(0);
  });

  const built = new Map<RewayahId, RewayahVerseUnits>();

  for (const [file, rewayah, total, splits] of present) {
    it(`${file}`, () => {
      const slots = readSlots(path.join(DB_DIR!, file));
      const started = Date.now();
      const u = buildRewayahVerseUnits(rewayah, slots, `${rewayah}@alldbs`);
      const ms = Date.now() - started;
      built.set(rewayah, u);
      const failures: string[] = [];
      let failureCount = 0;
      const fail = (msg: string) => {
        failureCount += 1;
        if (failures.length < 20) failures.push(msg);
      };
      const hafsKeyOf = (s: VerseUnitSlot) => `${s.surah}:${s.ayah}`;

      // Rows other than text are the Hafs rows.
      expect(slots.length).toBe(hafsSlots.length);
      slots.forEach((s, i) => {
        const h = hafsSlots[i];
        if (
          s.id !== h.id ||
          hafsKeyOf(s) !== hafsKeyOf(h) ||
          s.word !== h.word
        ) {
          fail(`row ${s.id} differs from Hafs`);
        }
      });

      // 1. every slot in exactly one unit (except the P10 basmala)
      expect(u.units.length).toBe(total);
      let cursor = 0;
      const unnumbered = new Set<number>();
      for (const r of u.unnumberedWordRanges()) {
        for (let id = r.first; id <= r.last; id++) unnumbered.add(id);
      }
      for (const s of slots) {
        const unit = u.unitForWordId(s.id);
        if (unnumbered.has(s.id)) {
          if (unit) fail(`${s.id}: unnumbered slot in ${unit.key}`);
          continue;
        }
        if (!unit) {
          fail(`${s.id}: in no unit`);
          continue;
        }
        while (u.units[cursor].lastWordId < s.id) cursor += 1;
        if (u.units[cursor] !== unit || s.id < unit.firstWordId) {
          fail(`${s.id}: unit mismatch`);
        }
      }
      const fatihaBasmala = slots.filter(s => hafsKeyOf(s) === '1:1');
      if (MADANI_BASRI.has(rewayah)) {
        expect([...unnumbered]).toEqual(fatihaBasmala.map(s => s.id));
        // @ai — the basmala's four words (no verse number) and the blank 1:1
        // marker slot. The words are the rewayah's own basmala in the
        // release data (the Hafs basmala in data before the basmala merge);
        // their spelling is the basmala gate's to check (EXPECTED_BASMALA in
        // rewayahOverlays.alldbs), not the units'.
        expect(fatihaBasmala.map(s => s.text === '')).toEqual([
          false,
          false,
          false,
          false,
          true,
        ]);
        for (const s of fatihaBasmala.slice(0, 4)) {
          expect(s.text).not.toContain('\u06DD');
        }
      } else {
        expect(unnumbered.size).toBe(0);
      }

      // 2. numbering 1..N with the verse map's counts
      for (let surah = 1; surah <= 114; surah++) {
        const list = u.unitsOfSurah(surah);
        const expected =
          rewayah === 'hafs'
            ? SURAHS[surah - 1].verses_count
            : verseMap.verseCount(rewayah, surah);
        if (list.length !== expected) {
          fail(`surah ${surah}: ${list.length} verses, expected ${expected}`);
        }
        list.forEach((unit, i) => {
          if (unit.ayah !== i + 1) fail(`${unit.key}: numbered out of order`);
        });
      }

      // 3. text = the token stream cut after each verse marker
      let surahTokens: string[] = [];
      let surahNow = 0;
      let verseIndex = 0;
      for (const s of slots) {
        if (s.surah !== surahNow) {
          surahNow = s.surah;
          verseIndex = 0;
          surahTokens = [];
        }
        if (!s.text || unnumbered.has(s.id)) continue;
        for (const token of s.text.split(' ')) {
          surahTokens.push(token);
          const n = parseVerseMarker(token);
          if (n === null) continue;
          verseIndex += 1;
          const unit = u.unitByRef(s.surah, verseIndex);
          if (n !== verseIndex || !unit) {
            fail(`${s.surah}: marker ${n} where verse ${verseIndex} ends`);
          } else if (u.unitText(unit) !== surahTokens.join(' ')) {
            fail(`${unit.key}: text differs from the token stream`);
          }
          surahTokens = [];
        }
      }

      // 4. r2h / h2r
      if (rewayah !== 'hafs') {
        for (const unit of u.units) {
          const mapped = verseMap.toHafsKeys(rewayah, unit.key);
          if (mapped.join() !== unit.hafsKeys.join()) {
            fail(`r2h ${unit.key}: ${unit.hafsKeys} vs ${mapped}`);
          }
        }
        const hafsKeys = new Set(slots.map(hafsKeyOf));
        for (const key of hafsKeys) {
          const mapped = verseMap.toRiwayahKeys(rewayah, key);
          const actual = u.unitsForHafsKey(key).map(x => x.key);
          if (mapped.join() !== actual.join()) {
            fail(`h2r ${key}: ${actual} vs ${mapped}`);
          }
        }
      }
      expect(crossCheckVerseUnits(u, verseMap)).toEqual([]);

      // 5. identity surahs: the units are the Hafs verses
      for (let surah = 1; surah <= 114; surah++) {
        if (!verseMap.isIdentitySurah(rewayah, surah)) continue;
        for (const unit of u.unitsOfSurah(surah)) {
          const range = u.hafsVerseWordRange(unit.key)!;
          if (
            unit.hafsKeys.join() !== unit.key ||
            unit.firstWordId !== range.first ||
            unit.lastWordId !== range.last ||
            u.hafsAnchor(unit).key !== unit.key
          ) {
            fail(`${unit.key}: identity verse is not the Hafs verse`);
          }
        }
      }
      if (rewayah === 'hafs' || rewayah === 'shubah') {
        // getVerseText(key): the verse's non-blank slots joined by spaces.
        const verseTexts = new Map<string, string[]>();
        for (const s of slots) {
          if (!s.text) continue;
          const list = verseTexts.get(hafsKeyOf(s));
          if (list) list.push(s.text);
          else verseTexts.set(hafsKeyOf(s), [s.text]);
        }
        for (const unit of u.units) {
          const text = (verseTexts.get(unit.key) ?? []).join(' ');
          if (u.unitText(unit) !== text) fail(`${unit.key}: not getVerseText`);
        }
      }

      // 6. anchors
      const anchors = new Set<string>();
      let midVerse = 0;
      for (const unit of u.units) {
        const anchor = u.hafsAnchor(unit);
        if (anchors.has(anchor.key))
          fail(`${unit.key}: anchor ${anchor.key} reused`);
        anchors.add(anchor.key);
        if (u.unitForAnchor(anchor.key) !== unit) {
          fail(`${unit.key}: anchor ${anchor.key} does not resolve back`);
        }
        if (anchor.wordPosition > 1) midVerse += 1;
        const verseStart = u.hafsVerseWordRange(anchor.hafsKey)!.first;
        if (pageOf(unit.firstWordId) !== pageOf(verseStart)) {
          fail(
            `${unit.key}: starts on another page than Hafs ${anchor.hafsKey}`,
          );
        }
      }
      const split = new Set<string>();
      for (const unit of u.units) {
        for (const k of unit.hafsKeys) {
          if (u.unitsForHafsKey(k).length > 1) split.add(k);
        }
      }
      expect([midVerse, split.size]).toEqual([splits, splits]);

      console.log(
        `${file}: ${u.units.length} units built in ${ms} ms, ${midVerse} mid-verse anchors, failures=${failureCount}`,
      );
      expect(failures).toEqual([]);
    });
  }

  // Named edge cases of the consumer contract (when those DBs are present):
  // rewayah, its verse, that verse's Hafs verses, its storage anchor.
  const edgeCases: [RewayahId, string, string[], string][] = [
    ['warsh', '1:6', ['1:7'], '1:7'],
    ['warsh', '1:7', ['1:7'], '1:7:5'],
    ['warsh', '11:81', ['11:82'], '11:82'],
    ['warsh', '11:82', ['11:82', '11:83'], '11:82:12'],
    ['warsh', '11:83', ['11:84'], '11:84'],
    ['warsh', '56:49', ['56:46'], '56:46'],
    ['warsh', '56:52', ['56:49', '56:50'], '56:49'],
    ['warsh', '56:53', ['56:50'], '56:50:2'],
    ['warsh', '22:19', ['22:19', '22:20', '22:21'], '22:19'],
    ['warsh', '42:1', ['42:1', '42:2', '42:3'], '42:1'],
    ['al-duri-abi-amr', '1:7', ['1:7'], '1:7:5'],
    ['al-bazzi', '2:217', ['2:219'], '2:219'],
    ['al-bazzi', '2:218', ['2:219', '2:220'], '2:219:18'],
    ['al-bazzi', '2:219', ['2:221'], '2:221'],
    ['al-bazzi', '18:83', ['18:84', '18:85', '18:86'], '18:84'],
    ['al-bazzi', '18:84', ['18:86'], '18:86:14'],
    ['al-bazzi', '30:1', ['30:1', '30:2', '30:3'], '30:1'],
    ['shubah', '2:1', ['2:1'], '2:1'],
  ];
  it('matches the named edge cases', () => {
    for (const [rewayah, key, hafsKeys, anchor] of edgeCases) {
      const u = built.get(rewayah);
      if (!u) continue;
      const unit = u.unitByKey(key)!;
      expect([key, [...unit.hafsKeys], u.hafsAnchor(unit).key]).toEqual([
        key,
        hafsKeys,
        anchor,
      ]);
      // A verse that ends inside a Hafs verse ends with an inline marker.
      const next = u.next(unit);
      const endsInside =
        next !== null &&
        next.hafsKeys[0] === unit.hafsKeys[unit.hafsKeys.length - 1];
      expect([key, u.slotText(unit.lastWordId).includes(' ')]).toEqual([
        key,
        endsInside,
      ]);
    }
  });
});
