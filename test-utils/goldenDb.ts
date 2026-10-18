import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {AdapterDatabase} from './sqliteAdapter';

const GOLDEN_ROOT = path.join(__dirname, '..', 'test-fixtures', 'golden');

export type Row = Record<string, unknown>;

export interface GoldenManifest {
  tables: Record<string, number>;
  digests: Record<string, string>;
  variant?: string;
}

interface NameRow {
  name: string;
}

interface ColumnRow {
  name: string;
  pk: number;
}

// Copies the committed golden .db files into dir. Tests always work on a
// copy so the committed files are never modified.
export function copyGoldenInto(tag: string, dir: string): void {
  const src = path.join(GOLDEN_ROOT, tag);
  for (const file of fs.readdirSync(src)) {
    if (!file.endsWith('.db')) continue;
    fs.copyFileSync(path.join(src, file), path.join(dir, file));
  }
}

export function goldenDbFiles(tag: string): string[] {
  return fs
    .readdirSync(path.join(GOLDEN_ROOT, tag))
    .filter(f => f.endsWith('.db'))
    .sort();
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGoldenManifest(value: unknown): value is GoldenManifest {
  if (!isStringRecord(value)) return false;
  return isStringRecord(value.tables) && isStringRecord(value.digests);
}

export function goldenManifest(tag: string): GoldenManifest {
  const raw: unknown = JSON.parse(
    fs.readFileSync(path.join(GOLDEN_ROOT, tag, 'manifest.json'), 'utf8'),
  );
  if (!isGoldenManifest(raw)) throw new Error(`Bad golden manifest: ${tag}`);
  return raw;
}

export async function listTables(db: AdapterDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<NameRow>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return rows.map(r => r.name);
}

export async function primaryKey(
  db: AdapterDatabase,
  table: string,
): Promise<string[]> {
  const cols = await db.getAllAsync<ColumnRow>(
    `SELECT name, pk FROM pragma_table_info('${table}')`,
  );
  return cols
    .filter(c => c.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map(c => c.name);
}

// Every row of a table, ordered by primary key so the order survives a
// table rebuild (rowids may change, primary keys must not).
export async function readTable(
  db: AdapterDatabase,
  table: string,
): Promise<Row[]> {
  const pk = await primaryKey(db, table);
  const order = pk.length > 0 ? pk.map(c => `"${c}"`).join(', ') : 'rowid';
  return db.getAllAsync<Row>(`SELECT * FROM "${table}" ORDER BY ${order}`);
}

export function rowsDigest(rows: Row[]): string {
  return crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

// Content tables whose rows are hashed into the manifest at generation time.
export const DIGEST_TABLES = [
  'tafaseer/tafaseer',
  'tafaseer/tafseer_metadata',
  'translations/translations',
  'translations/translation_metadata',
];
