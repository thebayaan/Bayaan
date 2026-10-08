// @ai-generated
/**
 * LOCAL-ONLY full-data check of which stored rows mark a verse in the verse
 * sheets (skipped unless BAYAAN_OVERLAY_DB_DIR is set; needs Node >= 22.5
 * for node:sqlite):
 *
 *   BAYAAN_OVERLAY_DB_DIR=/path/to/dbs npx jest selectionAnnotations.alldbs --watchAll=false
 *
 * The directory holds dk_words_<id>.db (warsh, qaloon, bazzi, qumbul, doori,
 * soosi, shouba) and/or digital-khatt-v2.db (Hafs; the bundled one is used
 * when it is missing).
 *
 * For every verse unit of every DB, the keys whose rows mark it
 * (unitRowKeys: what the sheets look up for "is bookmarked", the current
 * highlight colour and Remove) are exactly the keys unitForAnchor resolves
 * to it, one per slot, its own anchor first. So every row of the rewayah is
 * seen by the verse it marks: a row at a verse's anchor, and a legacy row
 * saved before Release 1 on any Hafs verse (verse-units contract section 3:
 * "S:A" names the rewayah verse holding the start of Hafs S:A), including
 * the Hafs verses that start inside a rewayah verse (the second Hafs verse
 * of a merged verse, a partial overlap), which an exact anchor match missed.
 */
import * as fs from 'fs';
import * as path from 'path';

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {},
  getRewayahDataIdentityKey: () => null,
}));
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: {get: () => null, getStatus: () => 'error'},
}));
jest.mock('@/services/verse-annotations/VerseAnnotationService', () => ({
  verseAnnotationService: {},
}));

import {
  buildRewayahVerseUnits,
  type VerseUnitSlot,
} from '@/services/mushaf/RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {unitSelection} from '@/components/share/rewayahVerseSelection';
import {selectionRowKeys, unitRowKeys} from '../selectionAnnotations';

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

const FILES: [string, RewayahId][] = [
  ['digital-khatt-v2.db', 'hafs'],
  ['dk_words_shouba.db', 'shubah'],
  ['dk_words_bazzi.db', 'al-bazzi'],
  ['dk_words_qumbul.db', 'qunbul'],
  ['dk_words_warsh.db', 'warsh'],
  ['dk_words_qaloon.db', 'qalun'],
  ['dk_words_doori.db', 'al-duri-abi-amr'],
  ['dk_words_soosi.db', 'al-susi'],
];

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

const run = DB_DIR && sqlite ? describe : describe.skip;

run('rows that mark a verse, on every words DB (local only)', () => {
  const dbFile = (file: string) => {
    const local = path.join(DB_DIR ?? '', file);
    if (fs.existsSync(local)) return local;
    return file === 'digital-khatt-v2.db' ? path.join(DK_DIR, file) : null;
  };
  const present = FILES.filter(([file]) => dbFile(file) !== null);

  it('finds the words DBs', () => {
    expect(present.length).toBeGreaterThan(1);
  });

  for (const [file, rewayah] of present) {
    it(`${file}`, () => {
      const slots = readSlots(dbFile(file)!);
      const model = buildRewayahVerseUnits(rewayah, slots, `${rewayah}@db`);
      const failures: string[] = [];
      const fail = (msg: string) => {
        if (failures.length < 20) failures.push(msg);
      };

      // Every slot's key, as a stored row names it.
      const keyOfSlot = new Map<number, string>();
      for (const slot of slots) {
        keyOfSlot.set(
          slot.id,
          slot.word === 1
            ? `${slot.surah}:${slot.ayah}`
            : `${slot.surah}:${slot.ayah}:${slot.word}`,
        );
      }

      let rowKeys = 0;
      for (const unit of model.units) {
        const keys = unitRowKeys(model, unit);
        rowKeys += keys.length;
        const expected: string[] = [];
        for (let id = unit.firstWordId; id <= unit.lastWordId; id++) {
          expected.push(keyOfSlot.get(id)!);
        }
        if (keys.join() !== expected.join()) {
          fail(`${unit.key}: ${keys.slice(0, 4)} vs ${expected.slice(0, 4)}`);
        }
        if (keys[0] !== model.hafsAnchor(unit).key) {
          fail(`${unit.key}: first key ${keys[0]}`);
        }
        for (const key of keys) {
          if (model.unitForAnchor(key) !== unit) {
            fail(`${unit.key}: ${key} names another verse`);
          }
        }
        const sheetKeys = selectionRowKeys(unitSelection(model, [unit]));
        if (sheetKeys.length !== 1 || sheetKeys[0].join() !== keys.join()) {
          fail(`${unit.key}: the sheet looks up other keys`);
        }
      }
      // Every slot except the unnumbered Fatiha basmala belongs to one verse.
      const unnumbered = model
        .unnumberedWordRanges()
        .reduce((n, r) => n + r.last - r.first + 1, 0);
      if (rowKeys + unnumbered !== slots.length) {
        fail(`${rowKeys} row keys + ${unnumbered} for ${slots.length} slots`);
      }

      // A legacy row on any Hafs verse is seen by the verse it marks.
      for (const slot of slots) {
        if (slot.word !== 1) continue;
        const legacyKey = `${slot.surah}:${slot.ayah}`;
        const unit = model.unitForAnchor(legacyKey);
        if (!unit) {
          if (!model.isUnnumberedWordId(slot.id)) {
            fail(`legacy ${legacyKey} names no verse`);
          }
          continue;
        }
        if (!unitRowKeys(model, unit).includes(legacyKey)) {
          fail(`legacy ${legacyKey} unseen by ${unit.key}`);
        }
      }

      expect(failures).toEqual([]);
    });
  }
});
