// scripts/generate-context-vectors.ts
// Writes next-occasions.vectors.json from the TS reference rules and the
// committed Hijri table. Swift and Kotlin tests compare against it.
// Run: npm run generate:widget-vectors
import fs from 'fs';
import path from 'path';
import {
  buildNextOccasionVectors,
  parseHijriTable,
} from '../modules/bayaan-widgets/src/contextRules';

const dir = path.resolve(
  __dirname,
  '../modules/bayaan-widgets/src/__fixtures__',
);
const table = parseHijriTable(
  JSON.parse(fs.readFileSync(path.join(dir, 'hijri.table.json'), 'utf8')),
);
if (!table) throw new Error('hijri.table.json is malformed');
const out = {count: 3, cases: buildNextOccasionVectors(table, 3)};
fs.writeFileSync(
  path.join(dir, 'next-occasions.vectors.json'),
  `${JSON.stringify(out, null, 2)}\n`,
);
console.log(`[generate-context-vectors] ${out.cases.length} cases`);
