// Canonical rewayah identity. Single source of truth for:
// - the RewayahId union (20 canonical slugs),
// - resolution from API rewayat records (name → slug),
// - predicates for what data (words/diffs) exists for a given slug,
// - display labels,
// - persisted-id migration table for the one-shot rename from the pre-canonical slugs.
//
// All other rewayah-aware code imports from here. Do not define a RewayahId
// literal, a resolver, or a migration mapping anywhere else.

import {resolveRewayatName, type RewayatEntry} from '@/data/rewayat';

// ── Canonical slug union ─────────────────────────────────────────────────────

export type RewayahId =
  // 8 with Digital Khatt text data bundled today
  | 'hafs'
  | 'shubah'
  | 'al-bazzi'
  | 'qunbul'
  | 'warsh'
  | 'qalun'
  | 'al-duri-abi-amr'
  | 'al-susi'
  // 12 without DK data (taxonomy only — audio works, text preview unavailable)
  | 'hisham'
  | 'ibn-dhakwan'
  | 'khalaf-an-hamzah'
  | 'khallad'
  | 'al-duri-al-kisai'
  | 'abu-al-harith'
  | 'ibn-jammaz'
  | 'ibn-wardan'
  | 'rawh'
  | 'ruwais'
  | 'idris'
  | 'ishaq';

export const ALL_REWAYAH_IDS: readonly RewayahId[] = [
  'hafs',
  'shubah',
  'al-bazzi',
  'qunbul',
  'warsh',
  'qalun',
  'al-duri-abi-amr',
  'al-susi',
  'hisham',
  'ibn-dhakwan',
  'khalaf-an-hamzah',
  'khallad',
  'al-duri-al-kisai',
  'abu-al-harith',
  'ibn-jammaz',
  'ibn-wardan',
  'rawh',
  'ruwais',
  'idris',
  'ishaq',
];

// ── Canonical registry id ↔ RewayahId ────────────────────────────────────────

// Maps the kebab ids from data/rewayat.ts's REWAYAT_REGISTRY (e.g. "hafs-an-assem")
// to our RewayahId slug. Anything not in this table (e.g. the combined
// "rowis-rawh-an-yakoob" field recording) returns null — callers fall back to
// 'hafs' for display purposes.
const CANONICAL_ID_TO_REWAYAH_ID: Readonly<Record<string, RewayahId>> = {
  'hafs-an-assem': 'hafs',
  'shubah-an-assem': 'shubah',
  'albizi-an-ibn-katheer': 'al-bazzi',
  'qunbol-an-ibn-katheer': 'qunbul',
  'warsh-an-nafi': 'warsh',
  'qalon-an-nafi': 'qalun',
  'aldori-an-abi-amr': 'al-duri-abi-amr',
  'assosi-an-abi-amr': 'al-susi',
  'hesham-an-ibn-amer': 'hisham',
  'ibn-thakwan-an-ibn-amer': 'ibn-dhakwan',
  'khalaf-an-hamzah': 'khalaf-an-hamzah',
  'khallad-an-hamzah': 'khallad',
  'aldorai-an-alkisaai': 'al-duri-al-kisai',
  'abu-al-harith-an-alkisai': 'abu-al-harith',
  'ibn-jammaz-an-abi-jafar': 'ibn-jammaz',
  'ibn-wardan-an-abi-jafar': 'ibn-wardan',
  'rawh-an-yaqub': 'rawh',
  'ruwais-an-yaqub': 'ruwais',
  'idris-an-khalaf': 'idris',
  'ishaq-an-khalaf': 'ishaq',
  // 'rowis-rawh-an-yakoob' intentionally omitted — combined field recording,
  // not a distinct rewayah. resolveRewayahFromName returns null; callers
  // fall back to 'hafs' display text.
};

// ── Resolution from API records ──────────────────────────────────────────────

// Resolve a Postgres/API rewayat.name (e.g. "Hafs A'n Assem" or an alias like
// "Warsh A'n Nafi' Men Tariq Alazraq") to a canonical RewayahId. Returns null
// when the name doesn't map to any of our 20 slugs.
export function resolveRewayahFromName(
  dbName: string | null | undefined,
): RewayahId | null {
  if (!dbName) return null;
  const entry = resolveRewayatName(dbName);
  if (!entry) return null;
  return CANONICAL_ID_TO_REWAYAH_ID[entry.id] ?? null;
}

// Resolve from a full canonical registry entry — avoids a double lookup when
// the caller already has the entry in hand.
export function resolveRewayahFromEntry(
  entry: RewayatEntry | null | undefined,
): RewayahId | null {
  if (!entry) return null;
  return CANONICAL_ID_TO_REWAYAH_ID[entry.id] ?? null;
}

// ── Data availability predicates ─────────────────────────────────────────────

// Digital Khatt words + layout exist for these 8 today. UI that renders Arabic
// text should check this; if false, show a "Text preview not yet available"
// state rather than silently falling back to Hafs words.
const IDS_WITH_TEXT_DATA: ReadonlySet<RewayahId> = new Set([
  'hafs',
  'shubah',
  'al-bazzi',
  'qunbul',
  'warsh',
  'qalun',
  'al-duri-abi-amr',
  'al-susi',
]);

export function hasTextData(id: RewayahId): boolean {
  return IDS_WITH_TEXT_DATA.has(id);
}

// The 7 non-Hafs slugs with bundled diff data. Hafs has no diffs (it IS the
// baseline). Narrow type so callers can use hasDiffData() as a type guard
// and pass a fully-typed id into legend / diff-card components.
export type RewayahWithDiffs =
  | 'shubah'
  | 'al-bazzi'
  | 'qunbul'
  | 'warsh'
  | 'qalun'
  | 'al-duri-abi-amr'
  | 'al-susi';

const IDS_WITH_DIFF_DATA: ReadonlySet<RewayahWithDiffs> = new Set([
  'shubah',
  'al-bazzi',
  'qunbul',
  'warsh',
  'qalun',
  'al-duri-abi-amr',
  'al-susi',
]);

export function hasDiffData(id: RewayahId): id is RewayahWithDiffs {
  return (IDS_WITH_DIFF_DATA as ReadonlySet<RewayahId>).has(id);
}

// ── Display labels ───────────────────────────────────────────────────────────

const SHORT_LABELS: Readonly<Record<RewayahId, string>> = {
  hafs: 'Hafs',
  shubah: "Shu'bah",
  'al-bazzi': 'Al-Bazzi',
  qunbul: 'Qunbul',
  warsh: 'Warsh',
  qalun: 'Qalun',
  'al-duri-abi-amr': 'Al-Duri (Abu Amr)',
  'al-susi': 'Al-Susi',
  hisham: 'Hisham',
  'ibn-dhakwan': 'Ibn Dhakwan',
  'khalaf-an-hamzah': 'Khalaf (Hamzah)',
  khallad: 'Khallad',
  'al-duri-al-kisai': "Al-Duri (al-Kisa'i)",
  'abu-al-harith': 'Abu al-Harith',
  'ibn-jammaz': 'Ibn Jammaz',
  'ibn-wardan': 'Ibn Wardan',
  rawh: 'Rawh',
  ruwais: 'Ruwais',
  idris: 'Idris',
  ishaq: 'Ishaq',
};

export function getShortLabel(id: RewayahId): string {
  return SHORT_LABELS[id];
}

// Long labels — the "Student 'an Teacher" form used in the mushaf
// settings picker. Kept as ASCII (matches the rest of the app's rewayah
// copy). Used where the picker UI needs to disambiguate transmitters.
const LONG_LABELS: Readonly<Record<RewayahId, string>> = {
  hafs: "Hafs 'an Asim",
  shubah: "Shu'bah 'an Asim",
  'al-bazzi': "Al-Bazzi 'an Ibn Kathir",
  qunbul: "Qunbul 'an Ibn Kathir",
  warsh: "Warsh 'an Nafi'",
  qalun: "Qalun 'an Nafi'",
  'al-duri-abi-amr': "Al-Duri 'an Abu Amr",
  'al-susi': "Al-Susi 'an Abu Amr",
  hisham: "Hisham 'an Ibn Amir",
  'ibn-dhakwan': "Ibn Dhakwan 'an Ibn Amir",
  'khalaf-an-hamzah': "Khalaf 'an Hamzah",
  khallad: "Khallad 'an Hamzah",
  'al-duri-al-kisai': "Al-Duri 'an al-Kisa'i",
  'abu-al-harith': "Abu al-Harith 'an al-Kisa'i",
  'ibn-jammaz': "Ibn Jammaz 'an Abu Ja'far",
  'ibn-wardan': "Ibn Wardan 'an Abu Ja'far",
  rawh: "Rawh 'an Ya'qub",
  ruwais: "Ruways 'an Ya'qub",
  idris: "Idris 'an Khalaf al-Bazzar",
  ishaq: "Ishaq 'an Khalaf al-Bazzar",
};

export function getLongLabel(id: RewayahId): string {
  return LONG_LABELS[id];
}

// One-line descriptions for the picker. The first 8 are the copy that
// used to live inline in MushafSettingsContent.REWAYAH_OPTIONS; the
// remaining 12 are short geographic / historical context for the
// taxonomy-only entries.
const DESCRIPTIONS: Readonly<Record<RewayahId, string>> = {
  hafs: 'The standard reading, used by most of the Muslim world',
  shubah: 'The second Kufan transmission from Asim',
  'al-bazzi':
    'Meccan transmission from Ibn Kathir, read throughout Mecca and Yemen',
  qunbul: 'The second Meccan transmission from Ibn Kathir',
  warsh: "Medinan transmission from Nafi' — dominant across North Africa",
  qalun:
    "The second Medinan transmission from Nafi' — read in Libya and parts of Tunisia",
  'al-duri-abi-amr':
    'Basran transmission from Abu Amr — common in Sudan and parts of West Africa',
  'al-susi': 'The second Basran transmission from Abu Amr',
  hisham: 'Damascene transmission from Ibn Amir',
  'ibn-dhakwan': 'The second Damascene transmission from Ibn Amir',
  'khalaf-an-hamzah': 'Kufan transmission from Hamzah',
  khallad: 'The second Kufan transmission from Hamzah',
  'al-duri-al-kisai':
    "Kufan transmission from al-Kisa'i (distinct from Al-Duri 'an Abu Amr)",
  'abu-al-harith': "The second Kufan transmission from al-Kisa'i",
  'ibn-jammaz': "Medinan transmission from Abu Ja'far (10th Qira'ah)",
  'ibn-wardan':
    "The second Medinan transmission from Abu Ja'far (10th Qira'ah)",
  rawh: "Basran transmission from Ya'qub (10th Qira'ah)",
  ruwais: "The second Basran transmission from Ya'qub (10th Qira'ah)",
  idris: "Transmission from Khalaf al-Bazzar (10th Qira'ah)",
  ishaq: "The second transmission from Khalaf al-Bazzar (10th Qira'ah)",
};

export function getDescription(id: RewayahId): string {
  return DESCRIPTIONS[id];
}

// Convenience for display sites that hold an API `rewayat` record: maps
// the record's free-form `name` through the canonical resolver and
// returns our short label when we recognize it. Falls back to the raw
// name when we don't — so rewayat not yet in the canonical registry
// (forward-compat with the server adding new ones, or reciter profile
// picker showing tariq-aliased variants we want to pass through) still
// render something sensible instead of disappearing. Prefer this
// helper over reading `rewayat.name` directly in any UI display path.
export function getDisplayLabelFromName(
  dbName: string | null | undefined,
): string {
  if (!dbName) return '';
  const canonical = resolveRewayahFromName(dbName);
  return canonical ? getShortLabel(canonical) : dbName;
}

// ── Persisted-id migration ───────────────────────────────────────────────────

// One-shot rename from the pre-canonical slugs (shipped only in TestFlight) to
// the canonical ones. Consumed by:
//   - mushafSettingsStore Zustand persist migrate (v12 → v13),
//   - VerseAnnotationDatabaseService SQLite migration block,
//   - any future web verse-share URL alias resolver.
// Hafs and warsh are unchanged; the other 6 move. Identity entries are
// included so the migrator is total on the old 8-value union.
export const PERSISTED_ID_MIGRATIONS: Readonly<Record<string, RewayahId>> = {
  hafs: 'hafs',
  warsh: 'warsh',
  shouba: 'shubah',
  bazzi: 'al-bazzi',
  qumbul: 'qunbul',
  qaloon: 'qalun',
  doori: 'al-duri-abi-amr',
  soosi: 'al-susi',
};

// Map any persisted string (possibly an old pre-canonical slug) to a valid
// RewayahId. Returns 'hafs' for unrecognized inputs — the conservative
// default, mirrors the existing fallback behavior for un-stamped annotations.
export function migratePersistedId(persisted: string): RewayahId {
  const mapped = PERSISTED_ID_MIGRATIONS[persisted];
  if (mapped) return mapped;
  return isRewayahId(persisted) ? persisted : 'hafs';
}

// Type guard. Useful at the DB read boundary where the column is TEXT.
export function isRewayahId(value: unknown): value is RewayahId {
  return (
    typeof value === 'string' &&
    (ALL_REWAYAH_IDS as readonly string[]).includes(value)
  );
}
