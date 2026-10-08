// @ai-generated
/**
 * Test helper for the LOCAL-ONLY all-DB audio tests: the verse units of every
 * Release 1 words DB in BAYAAN_OVERLAY_DB_DIR (dk_words_<id>.db for the seven
 * non-Hafs rewayat, digital-khatt-v2.db for Hafs, falling back to the repo's
 * Hafs DB) and their verse maps (<id>-versemap.json, falling back to the
 * bundled ones). Needs Node >= 22.5 (node:sqlite); `allDbDir()` is null when
 * the variable is unset or node:sqlite is missing, and the tests then skip.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  buildRewayahVerseUnits,
  type RewayahVerseUnits,
  type VerseUnitSlot,
} from '@/services/mushaf/RewayahVerseUnits';
import {
  RewayahVerseMapService,
  VERSE_MAP_FILE_IDS,
  type VerseMapFileId,
} from '@/services/mushaf/RewayahVerseMapService';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

const REPO = path.resolve(__dirname, '../../..');
const DK_DIR = path.join(REPO, 'data/mushaf/digitalkhatt');

interface SqliteDb {
  prepare(sql: string): {all(): Record<string, unknown>[]};
  close(): void;
}
type Sqlite = {DatabaseSync: new (file: string, opts?: object) => SqliteDb};

function loadSqlite(): Sqlite | null {
  try {
    return require('node:sqlite') as Sqlite;
  } catch {
    return null;
  }
}

/** Words DB file of each rewayah with bundled text. */
export const ALL_DB_FILES: Readonly<Record<string, RewayahId>> = {
  'digital-khatt-v2.db': 'hafs',
  'dk_words_shouba.db': 'shubah',
  'dk_words_bazzi.db': 'al-bazzi',
  'dk_words_qumbul.db': 'qunbul',
  'dk_words_warsh.db': 'warsh',
  'dk_words_qaloon.db': 'qalun',
  'dk_words_doori.db': 'al-duri-abi-amr',
  'dk_words_soosi.db': 'al-susi',
};

/** The DB directory, or null when the all-DB tests must skip. */
export function allDbDir(): string | null {
  const dir = process.env.BAYAAN_OVERLAY_DB_DIR;
  if (!dir || !loadSqlite()) return null;
  return dir === 'bundled' ? DK_DIR : dir;
}

function readSlots(file: string): VerseUnitSlot[] {
  const db = new (loadSqlite()!.DatabaseSync)(file, {readOnly: true});
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

/** The verse units of every words DB found in `dir` (the repo's Hafs DB too). */
export function loadAllDbUnits(dir: string): Map<RewayahId, RewayahVerseUnits> {
  const out = new Map<RewayahId, RewayahVerseUnits>();
  for (const [file, rewayah] of Object.entries(ALL_DB_FILES)) {
    let full = path.join(dir, file);
    if (!fs.existsSync(full) && rewayah === 'hafs') {
      full = path.join(DK_DIR, file);
    }
    if (!fs.existsSync(full)) continue;
    out.set(
      rewayah,
      buildRewayahVerseUnits(rewayah, readSlots(full), `${rewayah}@alldbs`),
    );
  }
  return out;
}

/** Raw verse map JSON of a rewayah in `dir` (else the bundled one). */
export function readVerseMapJson(dir: string, fileId: VerseMapFileId): unknown {
  const local = path.join(dir, `${fileId}-versemap.json`);
  const file = fs.existsSync(local)
    ? local
    : path.join(DK_DIR, `${fileId}-versemap.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Bundled verse map JSON of a rewayah (what the app ships). */
export function readBundledVerseMapJson(fileId: VerseMapFileId): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(DK_DIR, `${fileId}-versemap.json`), 'utf8'),
  );
}

/** A verse map service reading the verse maps of `dir`. */
export function allDbVerseMaps(dir: string): RewayahVerseMapService {
  const loaders = {} as Record<VerseMapFileId, () => unknown>;
  for (const fileId of Object.values(VERSE_MAP_FILE_IDS)) {
    loaders[fileId] = () => readVerseMapJson(dir, fileId);
  }
  return new RewayahVerseMapService(loaders);
}
