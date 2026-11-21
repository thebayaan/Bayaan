/* eslint-env node, es2020 */
// How the second model hears phone-recorded learners: greedy text of each clean
// clip, whole and alone, against the official letters. Report only: small sets,
// and sobolev's clean clips are not verified correct. Engine-free.
//   ORT_THREADS=1 node judge/phone_check.mjs
import fs from 'node:fs';
import path from 'node:path';
import {loadModel, loadTokens, greedy, readF32} from './model.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, '../.out/natural/judge');
const MAN = path.join(HERE, '../.out/natural/manifests');
const index = JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8'));
const clips = JSON.parse(fs.readFileSync(path.join(MAN, 'learners.json'), 'utf8'));
const model = await loadModel();
const tokens = loadTokens();
const edit = (a, b) => {
  let prev = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
};
const totals = {};
for (const c of clips) {
  const t = c.truth;
  const clean = t.dataset === 'sobolev' ? t.label === 'unknown' : t.label === 'correct';
  if (!clean) continue;
  const row = index.ayat[t.expectedKey];
  if (!row) continue;
  const from = t.wordStart ?? 0;
  const to = t.wordEnd ?? row.length;
  const ref = row.slice(from, to).map(x => x.l);
  const wave = readF32(c.audio);
  if (wave.length < 16000 * 0.3) continue;
  const r = await model.run(wave);
  const hyp = greedy(r.logp, r.frames, tokens).text.split(' ').filter(Boolean);
  const o = (totals[t.dataset] ??= {clips: 0, words: 0, wordEdits: 0, letters: 0, letterEdits: 0, exactClips: 0});
  o.clips += 1;
  o.words += ref.length;
  o.wordEdits += edit(hyp, ref);
  const a = hyp.join('');
  const b = ref.join('');
  o.letters += b.length;
  o.letterEdits += edit(a, b);
  if (a === b) o.exactClips += 1;
}
for (const [k, o] of Object.entries(totals)) {
  console.log(k, JSON.stringify({...o, WER: +((100 * o.wordEdits) / o.words).toFixed(2), CER: +((100 * o.letterEdits) / o.letters).toFixed(2)}));
}
