/* eslint-env node, es2020 */
// Check twin_ayat/pairs.json against data/quran.json. Prints numbers and keys only.
// Usage: node fix2/stage/verify_pairs.mjs   (writes .out/fix2/data/logs/verify_pairs.json)
import fs from 'node:fs';
import path from 'node:path';
import {OUT, ROOT, lettersOf} from '../common.mjs';
const DATA = path.join(OUT, 'data');
fs.mkdirSync(path.join(DATA, 'logs'), {recursive: true});
const raw = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data/quran.json'), 'utf8'),
);
const text = new Map(Object.values(raw).map(e => [e.verse_key, e.text]));
const AR = /[ء-يٱ-ۓ]/;
const words = k =>
  text
    .get(k)
    .split(/\s+/)
    .filter(t => AR.test(t));
const pairs = JSON.parse(
  fs.readFileSync(path.join(DATA, 'twin_ayat/pairs.json'), 'utf8'),
);
const clips = JSON.parse(
  fs.readFileSync(path.join(DATA, 'twin_ayat/manifest.json'), 'utf8'),
).clips;
const voices = new Set(clips.map(c => c.reciter));
const have = new Map();
for (const c of clips) {
  const k = `${c.surah}:${c.ayahStart}`;
  have.set(k, (have.get(k) ?? 0) + 1);
}
const out = {
  n: pairs.length,
  byType: {},
  bad: [],
  lettersIdentical: [],
  marksOnlyByType: {},
  missingVoices: [],
};
for (const p of pairs) {
  const X = words(p.x),
    Y = words(p.y),
    LX = X.map(lettersOf),
    LY = Y.map(lettersOf);
  out.byType[p.type] = (out.byType[p.type] ?? 0) + 1;
  const err = [];
  if (X.length !== p.wordsX || Y.length !== p.wordsY)
    err.push(
      `counts ${X.length}/${Y.length} vs stated ${p.wordsX}/${p.wordsY}`,
    );
  for (const k of [p.x, p.y])
    if ((have.get(k) ?? 0) !== voices.size)
      out.missingVoices.push(`${k}:${have.get(k) ?? 0}`);
  if (p.type === 'sub' || p.type === 'spelling') {
    if (X.length !== Y.length) err.push('word counts differ');
    else {
      const diff = X.map((w, i) => (w !== Y[i] ? i : -1)).filter(i => i >= 0);
      const ldiff = LX.map((w, i) => (w !== LY[i] ? i : -1)).filter(
        i => i >= 0,
      );
      if (p.wordX !== p.wordY) err.push('wordX != wordY');
      if (diff.length !== 1 || diff[0] !== p.wordX)
        err.push(`raw diff at [${diff}] stated ${p.wordX}`);
      if (ldiff.length === 0) {
        out.lettersIdentical.push(p.id);
        out.marksOnlyByType[p.type] = (out.marksOnlyByType[p.type] ?? 0) + 1;
        if (p.type === 'sub') err.push('sub but letters identical');
      } else if (ldiff.length !== 1 || ldiff[0] !== p.wordX)
        err.push(`letter diff at [${ldiff}]`);
      if (p.type === 'spelling' && ldiff.length)
        err.push('spelling but letters differ');
    }
  } else if (p.type === 'indel') {
    if (X.length !== Y.length + 1) err.push('x not one word longer');
    else {
      if (p.wordX !== p.wordY) err.push('wordX != wordY (insert position)');
      const rebuilt = [...Y.slice(0, p.wordY), X[p.wordX], ...Y.slice(p.wordY)];
      if (rebuilt.join(' ') !== X.join(' ')) {
        const lre = [
          ...LY.slice(0, p.wordY),
          LX[p.wordX],
          ...LY.slice(p.wordY),
        ];
        err.push(
          lre.join(' ') === LX.join(' ')
            ? 'raw marks differ but letters match'
            : 'longer != shorter + word at index',
        );
      }
    }
  } else err.push('unknown type');
  if (err.length) out.bad.push({id: p.id, err});
}
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(
  path.join(DATA, 'logs/verify_pairs.json'),
  JSON.stringify(out, null, 1),
);
