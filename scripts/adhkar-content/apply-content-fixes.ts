// scripts/adhkar-content/apply-content-fixes.ts
// Applies the adhkar content fixes to data/adhkar.json. Idempotent.
//   npx tsx scripts/adhkar-content/apply-content-fixes.ts
// Then record the fingerprint:
//   npx tsx scripts/adhkar-content/write-data-fingerprint.ts
import fs from 'fs';
import path from 'path';
import {applyAllFixes, parseSeedFile, serializeSeedFile} from './adhkarFixes';
import {EVENING_TEXTS_DOC} from './eveningRows';

const root = path.resolve(__dirname, '../..');
const dataPath = path.join(root, 'data/adhkar.json');

function main(): void {
  const before = fs.readFileSync(dataPath, 'utf8');
  const parsed: unknown = JSON.parse(before);
  const markdown = fs.readFileSync(path.join(root, EVENING_TEXTS_DOC), 'utf8');
  const after = serializeSeedFile(
    applyAllFixes(parseSeedFile(parsed), markdown),
  );
  if (after === before) {
    console.log('[adhkar] data/adhkar.json is already up to date');
    return;
  }
  fs.writeFileSync(dataPath, after);
  console.log('[adhkar] wrote data/adhkar.json');
}

main();
