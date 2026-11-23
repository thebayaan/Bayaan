/* eslint-env node, es2020 */
// Writes services/recitation/secondLook/alternatives.json: each word's mutashabih
// alternatives, as the judge's index holds them (recitation-bench/judge/build_index.py,
// from the pinned official text alone). Near words stay out.
//
//   node scripts/second-look/build_alternatives.mjs          rewrites the table
//   node scripts/second-look/build_alternatives.mjs --check  says whether it still holds
//
// Why a table: on 77,430 words, deriving the lists at run time from the app's text
// gives the same lists, but costs 370 ms of JS and about 48 MB of heap under node
// --jitless, against about 3 ms and 1.3 MB of bundle for this.
//
// The shape: `letters` holds every alternative's letters, `lists` every distinct list
// of alternatives (numbers into letters, base 36), and `ayat`, one string a surah, each
// ayah's words as numbers into lists plus one, base 36, empty for a word with none.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX = path.resolve(
  HERE,
  '../recitation-bench/.out/natural/judge/index.json',
);
const TABLE = path.resolve(
  HERE,
  '../../services/recitation/secondLook/alternatives.json',
);

const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
const used = new Set();
const lists = new Map();
const ayahs = Object.entries(index.ayat);
for (const [, rows] of ayahs) {
  for (const {m} of rows) {
    if (!m.length) continue;
    for (const id of m) used.add(id);
    const key = m.join();
    lists.set(key, (lists.get(key) ?? 0) + 1);
  }
}
// The commonest lists get the shortest numbers.
const ordered = [...lists.entries()]
  .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  .map(([key]) => key);
const listNumber = new Map(ordered.map((key, i) => [key, i]));
const typeIds = [...used].sort((a, b) => a - b);
const typeNumber = new Map(typeIds.map((id, i) => [id, i]));
const SURAHS = 114;
const ayat = Array.from({length: SURAHS}, () => []);
let words = 0;
let withAlternatives = 0;
for (const [key, rows] of ayahs) {
  const [surah, ayah] = key.split(':').map(Number);
  const numbers = rows.map(({m}) =>
    m.length ? (listNumber.get(m.join()) + 1).toString(36) : '',
  );
  while (numbers.length && numbers[numbers.length - 1] === '') numbers.pop();
  ayat[surah - 1][ayah - 1] = numbers.join(',');
  words += rows.length;
  withAlternatives += rows.filter(({m}) => m.length).length;
}
const table = {
  about:
    "Each word's mutashabih alternatives, as letters, for the second judge's scoring only. Never shown, logged or stored. Written by scripts/second-look/build_alternatives.mjs from the pinned official text alone.",
  letters: typeIds.map(id => index.types[id]).join(' '),
  lists: ordered
    .map(key =>
      key
        .split(',')
        .map(id => typeNumber.get(Number(id)).toString(36))
        .join(','),
    )
    .join(';'),
  ayat: ayat.map(rows => rows.join(';')),
};
const text = `${JSON.stringify(table)}\n`;
if (process.argv.includes('--check')) {
  const same = fs.readFileSync(TABLE, 'utf8') === text;
  console.log(
    `alternatives.json: ${same ? 'holds' : 'differs from the index'}`,
  );
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(TABLE, text);
console.log(
  JSON.stringify({
    bytes: Buffer.byteLength(text),
    words,
    withAlternatives,
    letters: typeIds.length,
    lists: ordered.length,
    sha256: crypto.createHash('sha256').update(text).digest('hex'),
  }),
);
