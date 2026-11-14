/* eslint-env node, es2020 */
// Shows what the model heard on rows of text_harness.mjs output, to see why a
// correct word scored badly.
//   node judge/debug_rows.mjs <pool jsonl> <cfg index> <how many> [--min -20] [--max -1000]
import fs from 'node:fs';
import path from 'node:path';
import {loadModel, loadTokens, greedy, readF32, sliceFrames} from './model.mjs';
import {fbank} from './fbank.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const MAN = path.join(HERE, '../.out/natural/manifests');
const OUT = path.join(HERE, '../.out/natural/judge');
const [file, cfgIndex, howMany] = process.argv.slice(2);
const argOf = (n, d) => {
  const at = process.argv.indexOf(n);
  return at > 0 ? Number(process.argv[at + 1]) : d;
};
const lo = argOf('--max', -1e9);
const hi = argOf('--min', -20);
const index = JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8'));
const clips = new Map();
for (const m of ['pool.json', 'w1_control.json', 'w1.json']) {
  for (const c of JSON.parse(fs.readFileSync(path.join(MAN, m), 'utf8'))) clips.set(c.id, c);
}
const rows = fs
  .readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map(l => JSON.parse(l))
  .filter(r => r.r[cfgIndex].expected <= hi && r.r[cfgIndex].expected >= lo);
console.log(`${rows.length} rows in range`);
const step = Math.max(1, Math.floor(rows.length / Number(howMany)));
const model = await loadModel();
const tokens = loadTokens();
for (let i = 0; i < rows.length; i += step) {
  const row = rows[i];
  const cfg = row.r[cfgIndex].cfg;
  const clip = clips.get(row.run);
  const pieces = clip.parts ? clip.parts.map(p => readF32(p.audio)) : [readF32(clip.audio)];
  const audio = new Float32Array(pieces.reduce((x, y) => x + y.length, 0));
  let at = 0;
  for (const p of pieces) {
    audio.set(p, at);
    at += p.length;
  }
  const end = Math.min(audio.length, Math.round((row.t1 + cfg.delta) * 16000));
  const start = Math.max(0, end - Math.round(cfg.D * 16000));
  const feats = fbank(audio);
  const cut = sliceFrames(feats, start, end, audio.length);
  const r = await model.runFrames(cut.data, cut.frames);
  const g = greedy(r.logp, r.frames, tokens);
  const letters = index.ayat[row.key].map(x => x.l);
  const ctx = letters.slice(Math.max(0, row.j - cfg.left), row.j).join(' ') + ' [' + letters[row.j] + '] ' + letters.slice(row.j + 1, row.j + 1 + cfg.right).join(' ');
  console.log(
    `${row.key}:${row.j}/${row.n} restart=${!!row.restart} word ${row.t0.toFixed(2)}-${row.t1.toFixed(2)} slice ${(start / 16000).toFixed(2)}-${(end / 16000).toFixed(2)} exp=${row.r[cfgIndex].expected}\n  text: ${ctx}\n  heard: ${g.text}\n  mut ${JSON.stringify(row.r[cfgIndex].mut.slice(0, 2))} near ${JSON.stringify(row.r[cfgIndex].near.slice(0, 2))}`,
  );
}
