import fs from 'fs';
import path from 'path';

const GOLDEN_ROOT = path.join(__dirname, '..', 'test-fixtures', 'golden');

export interface GoldenManifest {
  tables: Record<string, number>;
}

// Copies the committed golden .db files into dir. The committed files are WAL
// mode databases, so they must never be opened in place.
export function copyGoldenInto(tag: string, dir: string): void {
  const src = path.join(GOLDEN_ROOT, tag);
  for (const file of fs.readdirSync(src)) {
    if (!file.endsWith('.db')) continue;
    fs.copyFileSync(path.join(src, file), path.join(dir, file));
  }
}

function isGoldenManifest(value: unknown): value is GoldenManifest {
  if (typeof value !== 'object' || value === null) return false;
  if (!('tables' in value)) return false;
  const tables: unknown = value.tables;
  return typeof tables === 'object' && tables !== null;
}

export function goldenManifest(tag: string): GoldenManifest {
  const raw: unknown = JSON.parse(
    fs.readFileSync(path.join(GOLDEN_ROOT, tag, 'manifest.json'), 'utf8'),
  );
  if (!isGoldenManifest(raw)) throw new Error(`Bad golden manifest: ${tag}`);
  return raw;
}
