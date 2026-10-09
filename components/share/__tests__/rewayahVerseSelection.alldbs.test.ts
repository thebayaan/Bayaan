// @ai-generated
/**
 * LOCAL-ONLY full-data check of what the verse sheets name, copy, store and
 * link for every verse of every words DB (skipped unless BAYAAN_OVERLAY_DB_DIR
 * is set; needs Node >= 22.5 for node:sqlite):
 *
 *   BAYAAN_OVERLAY_DB_DIR=/path/to/dbs npx jest rewayahVerseSelection.alldbs --watchAll=false
 *
 * The directory holds dk_words_<id>.db (warsh, qaloon, bazzi, qumbul, doori,
 * soosi, shouba) and/or digital-khatt-v2.db (Hafs; the bundled one is used
 * when it is missing). The units need Release 1 words DBs (inline verse
 * markers): older data is refused, as at runtime.
 *
 * For every verse unit of every DB:
 *  - a contract-4.1 payload (unit keys + Hafs anchor fields) selects exactly
 *    that verse: label and citation in the rewayah's numbering, the copied
 *    text is exactly its slots ending with its own marker, the row anchor is
 *    hafsAnchor (round-trips through storedVerseSelection), the link names
 *    the anchor's Hafs verse, playback starts at it;
 *  - a Hafs-keyed payload (a producer without units) of the anchor's Hafs
 *    verse selects the rewayah verses holding it (h2r), never nothing;
 *  - translations: each Hafs verse once, in order, with a note exactly when
 *    the rewayah divides it.
 * For every surah: all its verses selected copy as one line per verse,
 * cite "S:1-N", and show each Hafs verse's translation once without notes.
 * Hafs and Shu'bah: every selection equals the Hafs selection of the same
 * Hafs keys (one code path, Hafs output unchanged).
 */
import * as fs from 'fs';
import * as path from 'path';

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {},
  getRewayahDataIdentityKey: () => null,
}));
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: jest
    .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
    .verseUnitsServiceStub({peek: () => null, status: () => 'error'}),
}));

import {
  buildRewayahVerseUnits,
  parseVerseMarker,
  type RewayahVerseUnits,
  type VerseUnit,
  type VerseUnitSlot,
} from '@/services/mushaf/RewayahVerseUnits';
import {
  getShortLabel,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';
import {joinVerseTexts} from '../rewayahVerseText';
import {
  readUnitTexts,
  selectionCitation,
  selectionPlaybackKeys,
  selectionPreviewProps,
  selectionTranslationParts,
  selectVerses,
  storedVerseSelection,
  type ReadyVerseSelection,
  type VerseSelection,
  type VerseSelectionRequest,
} from '../rewayahVerseSelection';

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

function ready(selection: VerseSelection): ReadyVerseSelection {
  if (selection.status !== 'ready') {
    throw new Error(`selection is ${selection.status}`);
  }
  return selection;
}

/** The payload a unit producer sends (contract 4.1). */
function unitRequest(
  model: RewayahVerseUnits,
  units: readonly VerseUnit[],
): VerseSelectionRequest {
  const anchor = model.hafsAnchor(units[0]);
  const hafsKeys = [...new Set(units.flatMap(u => [...u.hafsKeys]))];
  return {
    rewayah: model.rewayah,
    unitKeys: units.map(u => u.key),
    verseKey: anchor.hafsKey,
    surahNumber: anchor.surah,
    ayahNumber: anchor.ayah,
    verseKeys: hafsKeys.length > 1 ? hafsKeys : undefined,
  };
}

/** The payload a producer without units sends (Hafs keys). */
function hafsRequest(
  rewayah: RewayahId,
  keys: readonly string[],
): VerseSelectionRequest {
  const [s, a] = keys[0].split(':').map(Number);
  return {
    rewayah,
    verseKey: keys[0],
    surahNumber: s,
    ayahNumber: a,
    verseKeys: keys.length > 1 ? [...keys] : undefined,
  };
}

const run = DB_DIR && sqlite ? describe : describe.skip;

run('verse sheets on every verse of every words DB (local only)', () => {
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
      const model = buildRewayahVerseUnits(
        rewayah,
        readSlots(dbFile(file)!),
        `${rewayah}@alldbs`,
      );
      const failures: string[] = [];
      let failureCount = 0;
      const fail = (msg: string) => {
        failureCount += 1;
        if (failures.length < 20) failures.push(msg);
      };
      const check = (ok: boolean, msg: () => string) => {
        if (!ok) fail(msg());
      };
      const identity = rewayah === 'hafs' || rewayah === 'shubah';
      // The texts copy / share use. Hafs reads its Hafs keys, as before
      // (no units); a Hafs verse's text is its unit text (core invariant 6).
      const textsOf = (sel: ReadyVerseSelection): string[] => {
        const texts = readUnitTexts(sel);
        if (rewayah !== 'hafs') return texts ?? [];
        check(texts === null, () => `${sel.label}: Hafs read by units`);
        return sel.keys.map(key => model.unitText(model.unitByKey(key)!));
      };
      const citationOf = (label: string) =>
        rewayah === 'hafs'
          ? `Quran ${label}`
          : `Quran ${label} · ${getShortLabel(rewayah)}`;

      for (const unit of model.units) {
        const anchor = model.hafsAnchor(unit);
        const sel = selectVerses(unitRequest(model, [unit]), model, 'ready');
        if (sel.status !== 'ready') {
          fail(`${unit.key}: selection ${sel.status}`);
          continue;
        }
        check(
          sel.keys.length === 1 && sel.keys[0] === unit.key,
          () => `${unit.key}: keys ${sel.keys}`,
        );
        check(sel.label === unit.key, () => `${unit.key}: label ${sel.label}`);
        check(
          selectionCitation(sel) === citationOf(unit.key),
          () => `${unit.key}: citation ${selectionCitation(sel)}`,
        );
        // Copy / share: exactly its slots, ending with its own marker.
        const text = textsOf(sel)[0] ?? '';
        const lastToken = text.slice(text.lastIndexOf(' ') + 1);
        check(
          text === model.unitText(unit) &&
            parseVerseMarker(lastToken) === unit.ayah,
          () => `${unit.key}: text ends with ${lastToken}`,
        );
        const preview = selectionPreviewProps(sel);
        check(
          rewayah === 'hafs'
            ? preview.text === undefined && preview.verseKey === unit.key
            : preview.text === text,
          () => `${unit.key}: preview`,
        );
        // Rows: the anchor, round trip.
        check(
          sel.anchors.length === 1 &&
            sel.anchors[0].key === anchor.key &&
            sel.anchors[0].surah === anchor.surah &&
            sel.anchors[0].ayah === anchor.ayah,
          () => `${unit.key}: anchor ${JSON.stringify(sel.anchors)}`,
        );
        const stored = storedVerseSelection(model, [anchor.key]);
        check(
          stored?.keys.length === 1 && stored.keys[0] === unit.key,
          () => `${unit.key}: stored ${anchor.key} -> ${stored?.keys}`,
        );
        // Link and playback: the anchor's Hafs verse.
        check(
          sel.linkVerse.surah === anchor.surah &&
            sel.linkVerse.ayah === anchor.ayah &&
            sel.linkLabel === unit.key,
          () => `${unit.key}: link ${JSON.stringify(sel.linkVerse)}`,
        );
        const play = selectionPlaybackKeys(sel);
        check(
          play.firstHafsKey === anchor.hafsKey &&
            play.lastHafsKey === unit.hafsKeys[unit.hafsKeys.length - 1],
          () => `${unit.key}: playback ${JSON.stringify(play)}`,
        );
        // Translations: each Hafs verse once, noted exactly when divided.
        const parts = selectionTranslationParts(sel);
        check(
          parts.map(p => p.hafsKey).join() === unit.hafsKeys.join(),
          () => `${unit.key}: parts ${parts.map(p => p.hafsKey)}`,
        );
        for (const part of parts) {
          const divided = model.unitsForHafsKey(part.hafsKey).length > 1;
          check(
            (part.note !== null) === divided,
            () => `${unit.key}: note on ${part.hafsKey}`,
          );
        }
        // A producer without units: the verses holding the anchor's Hafs
        // verse (h2r), always including this one.
        const legacy = selectVerses(
          hafsRequest(rewayah, [anchor.hafsKey]),
          model,
          'ready',
        );
        const holders = model.unitsForHafsKey(anchor.hafsKey).map(u => u.key);
        check(
          legacy.status === 'ready' &&
            legacy.keys.join() === holders.join() &&
            legacy.keys.includes(unit.key),
          () =>
            `${unit.key}: Hafs payload ${anchor.hafsKey} -> ${legacy.status}`,
        );
        // Hafs and Shu'bah: the Hafs selection of the same key.
        if (identity) {
          const hafs = ready(
            selectVerses(hafsRequest('hafs', [unit.key]), null, 'ready'),
          );
          check(
            hafs.label === sel.label &&
              JSON.stringify(hafs.anchors) === JSON.stringify(sel.anchors) &&
              JSON.stringify(hafs.linkVerse) ===
                JSON.stringify(sel.linkVerse) &&
              JSON.stringify(selectionTranslationParts(hafs)) ===
                JSON.stringify(parts),
            () => `${unit.key}: differs from Hafs`,
          );
        }
      }

      for (const surah of model.surahs()) {
        const units = model.unitsOfSurah(surah);
        const sel = selectVerses(unitRequest(model, units), model, 'ready');
        if (sel.status !== 'ready') {
          fail(`surah ${surah}: selection ${sel.status}`);
          continue;
        }
        const n = units.length;
        const label = n === 1 ? `${surah}:1` : `${surah}:1-${n}`;
        check(sel.label === label, () => `surah ${surah}: label ${sel.label}`);
        // One line per verse: every verse ends with its marker.
        const copied = joinVerseTexts(textsOf(sel));
        check(
          copied.split('\n').length === n,
          () => `surah ${surah}: ${copied.split('\n').length} lines for ${n}`,
        );
        // Every Hafs verse of the surah once, no notes (all selected).
        const parts = selectionTranslationParts(sel);
        const expected = new Set(units.flatMap(u => [...u.hafsKeys]));
        check(
          parts.length === expected.size &&
            parts.every(p => expected.has(p.hafsKey) && p.note === null),
          () => `surah ${surah}: translation parts`,
        );
        // Any two neighbouring verses select as a consecutive range.
        for (let i = 0; i + 1 < n; i++) {
          const pair = selectVerses(
            unitRequest(model, [units[i], units[i + 1]]),
            model,
            'ready',
          );
          check(
            pair.status === 'ready' &&
              pair.label === `${surah}:${i + 1}-${i + 2}`,
            () => `surah ${surah}: pair ${i + 1}`,
          );
        }
      }

      if (failureCount > 0) {
        throw new Error(
          `${rewayah}: ${failureCount} failures\n${failures.join('\n')}`,
        );
      }
    });
  }
});
