/* eslint-env node, es2020 */
// Checks every file named in .out/second-look/frozen.json against its recorded sha256 and
// writes what it found to .out/chatter/learners_built/frozen_check.<stage>.json. Reads only.
//   node chatter/learners_built_frozen.mjs start|end
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const BENCH = path.resolve(HERE, '..');
const LOOK = path.resolve(BENCH, '../second-look');
const OUT = path.join(BENCH, '.out/chatter/learners_built');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const frozenFile = path.join(BENCH, '.out/second-look/frozen.json');
const frozen = JSON.parse(fs.readFileSync(frozenFile, 'utf8'));
const stage = process.argv[2] ?? 'now';
const rows = [
  ...Object.entries(frozen.own).map(([name, want]) => ({name, file: path.join(LOOK, name), want})),
  ...Object.entries(frozen.bench).map(([name, want]) => ({name, file: path.join(BENCH, name), want})),
];
const differ = [];
for (const r of rows) {
  const got = fs.existsSync(r.file) ? sha(r.file) : 'missing';
  if (got !== r.want) differ.push({name: r.name, want: r.want, got});
}
const result = {
  stage,
  at: new Date().toISOString(),
  files: rows.length,
  same: rows.length - differ.length,
  differ,
  frozenJsonSha: sha(frozenFile),
};
fs.mkdirSync(OUT, {recursive: true});
fs.writeFileSync(path.join(OUT, `frozen_check.${stage}.json`), JSON.stringify(result, null, 1));
console.log(JSON.stringify(result));
process.exit(differ.length ? 1 : 0);
