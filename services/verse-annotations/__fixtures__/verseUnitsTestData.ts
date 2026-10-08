// @ai-generated
/**
 * Verse units for the annotation / search / share-link tests.
 *
 * - fixtureUnits(): real slots of complete surahs (1, 71, 103, 106, 107,
 *   112, 114) of the Release 1 words DBs, from the core's fixture
 *   (services/mushaf/__fixtures__/verseUnitsFixture.json). Always available.
 * - allDbUnits(): every words DB in BAYAAN_OVERLAY_DB_DIR (local only; needs
 *   node:sqlite), as RewayahVerseUnits.alldbs.test.ts reads them. Empty when
 *   the variable is unset, so CI without the files skips those tests.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  buildRewayahVerseUnits,
  type RewayahVerseUnits,
  type VerseUnitSlot,
} from '@/services/mushaf/RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

// ── Fixture (always) ────────────────────────────────────────────────────────

type FixtureDb = 'hafs' | 'shouba' | 'warsh' | 'bazzi' | 'doori';

interface VerseUnitsFixture {
  ids: number[];
  locations: string[];
  texts: Record<FixtureDb, string[]>;
}

const FIXTURE_DB: Partial<Record<RewayahId, FixtureDb>> = {
  hafs: 'hafs',
  shubah: 'shouba',
  warsh: 'warsh',
  'al-bazzi': 'bazzi',
  'al-duri-abi-amr': 'doori',
};

/** Rewayat the fixture has slots for. */
export const FIXTURE_REWAYAT = Object.keys(FIXTURE_DB) as RewayahId[];

const built = new Map<RewayahId, RewayahVerseUnits>();

/** The fixture's verse units of `rewayah` (one instance per rewayah). */
export function fixtureUnits(rewayah: RewayahId): RewayahVerseUnits {
  const cached = built.get(rewayah);
  if (cached) return cached;
  const db = FIXTURE_DB[rewayah];
  if (!db) throw new Error(`no fixture slots for ${rewayah}`);
  const fixture =
    require('@/services/mushaf/__fixtures__/verseUnitsFixture.json') as VerseUnitsFixture;
  const slots: VerseUnitSlot[] = fixture.ids.map((id, i) => {
    const [surah, ayah, word] = fixture.locations[i].split(':').map(Number);
    return {id, surah, ayah, word, text: fixture.texts[db][i]};
  });
  const units = buildRewayahVerseUnits(rewayah, slots, `${rewayah}@fixture`);
  built.set(rewayah, units);
  return units;
}

/** A unit by its key in the rewayah's numbering; throws when absent. */
export function unitOf(units: RewayahVerseUnits, key: string) {
  const unit = units.unitByKey(key);
  if (!unit) throw new Error(`${units.rewayah} has no verse ${key}`);
  return unit;
}

// ── Every words DB (local) ──────────────────────────────────────────────────

const REPO = path.resolve(__dirname, '../../..');
const DK_DIR = path.join(REPO, 'data/mushaf/digitalkhatt');
const envDir = process.env.BAYAAN_OVERLAY_DB_DIR;

/** The directory of the all-DB tests, or null (tests skipped). */
export const ALL_DB_DIR: string | null =
  envDir === 'bundled' ? DK_DIR : envDir || null;

interface SqliteDb {
  prepare(sql: string): {all(): Record<string, unknown>[]};
  close(): void;
}
interface SqliteModule {
  DatabaseSync: new (file: string, opts?: object) => SqliteDb;
}

// Required only for the all-DB tests (node:sqlite warns when loaded).
function loadSqlite(): SqliteModule | null {
  if (!ALL_DB_DIR) return null;
  try {
    return require('node:sqlite') as SqliteModule;
  } catch {
    return null;
  }
}
const sqlite = loadSqlite();

/** True when the all-DB tests can run here. */
export const ALL_DBS_AVAILABLE = ALL_DB_DIR !== null && sqlite !== null;

/** Words DB files, their rewayah and verse total. */
export const ALL_DB_FILES: readonly [string, RewayahId, number][] = [
  ['digital-khatt-v2.db', 'hafs', 6236],
  ['dk_words_shouba.db', 'shubah', 6236],
  ['dk_words_bazzi.db', 'al-bazzi', 6220],
  ['dk_words_qumbul.db', 'qunbul', 6220],
  ['dk_words_warsh.db', 'warsh', 6214],
  ['dk_words_qaloon.db', 'qalun', 6214],
  ['dk_words_doori.db', 'al-duri-abi-amr', 6217],
  ['dk_words_soosi.db', 'al-susi', 6217],
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

/**
 * The words DBs present in ALL_DB_DIR (the Hafs DB falls back to the
 * bundled one), with their expected verse totals.
 */
export function allDbFiles(): {
  file: string;
  rewayah: RewayahId;
  total: number;
}[] {
  if (!ALL_DBS_AVAILABLE || !ALL_DB_DIR) return [];
  const out: {file: string; rewayah: RewayahId; total: number}[] = [];
  for (const [name, rewayah, total] of ALL_DB_FILES) {
    const local = path.join(ALL_DB_DIR, name);
    if (fs.existsSync(local)) out.push({file: local, rewayah, total});
    else if (rewayah === 'hafs') {
      out.push({file: path.join(DK_DIR, name), rewayah, total});
    }
  }
  return out;
}

/** Builds the verse units of one words DB file. */
export function buildDbUnits(
  file: string,
  rewayah: RewayahId,
): RewayahVerseUnits {
  return buildRewayahVerseUnits(rewayah, readSlots(file), `${rewayah}@alldbs`);
}
