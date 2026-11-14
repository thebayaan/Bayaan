/* eslint-env node, es2020 */
// Official word totals per manifest (whitespace tokens with an Arabic letter, data/quran.json).
// Usage: node fix2/stage/verify_words.mjs   (writes .out/fix2/data/logs/verify_words.json)
import fs from 'node:fs';
import path from 'node:path';
import {OUT, ROOT} from '../common.mjs';
const DATA = path.join(OUT, 'data');
fs.mkdirSync(path.join(DATA, 'logs'), {recursive: true});
const raw = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data/quran.json'), 'utf8'),
);
const text = new Map(Object.values(raw).map(e => [e.verse_key, e.text]));
const AR = /[ء-يٱ-ۓ]/;
const nw = k =>
  text
    .get(k)
    .split(/\s+/)
    .filter(t => AR.test(t)).length;
const out = {};
for (const set of fs.readdirSync(DATA).sort()) {
  const mf = path.join(DATA, set, 'manifest.json');
  if (!fs.existsSync(mf)) continue;
  let w = 0,
    bad = 0;
  for (const c of JSON.parse(fs.readFileSync(mf, 'utf8')).clips) {
    if (c.kind === 'span' && c.extra?.wordStart) {
      w += c.extra.wordEnd - c.extra.wordStart + 1;
      continue;
    }
    if (c.surah == null) continue;
    for (let a = c.ayahStart; a <= c.ayahEnd; a++) {
      if (!text.has(`${c.surah}:${a}`)) {
        bad++;
        continue;
      }
      w += nw(`${c.surah}:${a}`);
    }
    if (c.kind === 'surah' && !text.has(`${c.surah}:${c.ayahEnd}`)) bad++;
    if (c.kind === 'surah' && text.has(`${c.surah}:${c.ayahEnd + 1}`)) bad++;
  }
  out[set] = {words: w, badKeys: bad};
}
console.log(JSON.stringify(out));
fs.writeFileSync(
  path.join(DATA, 'logs/verify_words.json'),
  JSON.stringify(out, null, 1),
);
