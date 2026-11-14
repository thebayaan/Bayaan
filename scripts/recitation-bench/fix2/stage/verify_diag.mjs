/* eslint-env node, es2020 */
// Diagnose suspect clips from logs/verify_model.json (ratio > 0.3). Numbers and keys only.
// Usage: ORT_THREADS=1 node fix2/stage/verify_diag.mjs   (writes .out/fix2/data/logs/verify_diag.json)
import fs from 'node:fs';
import path from 'node:path';
import {loadModel} from '../model.mjs';
import {
  OUT,
  ayahWords,
  lettersOf,
  readF32,
  relativeTo,
  argmaxPath,
  greedySpan,
  editDistance,
  tokensOf,
} from '../common.mjs';
const DATA = path.join(OUT, 'data');
fs.mkdirSync(path.join(DATA, 'logs'), {recursive: true});
const res = JSON.parse(
  fs.readFileSync(path.join(DATA, 'logs/verify_model.json'), 'utf8'),
);
const SR = 16000;
const model = await loadModel();
async function hypOf(file, maxSec = Infinity) {
  let wave = readF32(file);
  wave = wave.subarray(0, Math.min(wave.length, maxSec * SR));
  const hyp = [];
  const win = wave.length > 20 * SR ? 15 * SR : wave.length;
  for (let t = 0; t < wave.length; t += win) {
    const r = await model.run(wave.subarray(t, Math.min(wave.length, t + win)));
    if (!r.frames) continue;
    const am = argmaxPath(relativeTo(r.logp, r.frames), r.frames);
    hyp.push(...greedySpan(am, 0, r.frames - 1));
  }
  return hyp;
}
const toks = k => tokensOf((ayahWords(k) ?? []).join(''));
const nAyat = s => {
  let a = 1;
  while (ayahWords(`${s}:${a + 1}`)) a++;
  return a;
};
const meta = new Map();
for (const l of fs
  .readFileSync(path.join(DATA, '_dl/sobolev_metadata.jsonl'), 'utf8')
  .split('\n')) {
  if (!l.trim()) continue;
  const d = JSON.parse(l);
  const ch = d.file_name.match(/chunk(\d+)\./)?.[1];
  meta.set(`${d.recording_id}-${ch}`, d);
}
const clips = new Map();
for (const s of ['sobolev', 'dev_pool', 'twin_ayat'])
  for (const c of JSON.parse(
    fs.readFileSync(path.join(DATA, s, 'manifest.json'), 'utf8'),
  ).clips)
    clips.set(`${s}/${c.id}`, c);
const out = {};
for (const [k, v] of Object.entries(res)) {
  if (v.ratio <= 0.3) continue;
  const c = clips.get(k);
  if (!c) continue;
  const o = {};
  if (v.mode === 'surah') {
    const hyp = await hypOf(c.audio, 60);
    let best = [];
    for (let s = 1; s <= 114; s++) {
      const ref = [];
      for (
        let a = 1;
        ref.length < hyp.length * 1.6 && ayahWords(`${s}:${a}`);
        a++
      )
        ref.push(...toks(`${s}:${a}`));
      best.push([
        +(editDistance(hyp, ref.slice(0, hyp.length)) / hyp.length).toFixed(3),
        s,
      ]);
    }
    best.sort((a, b) => a[0] - b[0]);
    o.bestSurahStart = best.slice(0, 3);
    // does it match surah 50 anywhere later (e.g. file starts mid-surah)?
    const all = [];
    for (let a = 1; a <= nAyat(c.surah); a++)
      all.push(...toks(`${c.surah}:${a}`));
    let bw = [Infinity, 0];
    for (let st = 0; st + hyp.length <= all.length; st += 5) {
      const d = editDistance(hyp, all.slice(st, st + hyp.length)) / hyp.length;
      if (d < bw[0]) bw = [+d.toFixed(3), st];
    }
    o.bestWindowInClaimedSurah = {
      ratio: bw[0],
      startLetter: bw[1],
      ofLetters: all.length,
    };
    o.hypLetters60s = hyp.length;
  } else {
    const hyp = await hypOf(c.audio);
    const row = meta.get(`${c.extra.recording}-${c.extra.chunk}`);
    if (row) {
      const rt = tokensOf(row.text.split(/\s+/).map(lettersOf).join(''));
      o.rowTextRatio = +(editDistance(hyp, rt) / rt.length).toFixed(3);
      o.rowTextLetters = rt.length;
      o.rowTextVsAyah = +(
        editDistance(rt, toks(`${c.surah}:${c.ayahStart}`)) /
        Math.max(1, rt.length)
      ).toFixed(3);
    }
    let best = {r: Infinity};
    const n = nAyat(c.surah);
    for (let a = Math.max(1, c.ayahStart - 4); a <= c.ayahStart; a++)
      for (let b = c.ayahStart; b <= Math.min(n, c.ayahStart + 8); b++) {
        const ref = [];
        for (let x = a; x <= b; x++) ref.push(...toks(`${c.surah}:${x}`));
        const r = editDistance(hyp, ref) / ref.length;
        if (r < best.r) best = {r: +r.toFixed(3), from: a, to: b};
      }
    o.bestSpanInSurah = best;
    o.seconds = c.seconds;
  }
  out[k] = o;
  console.log(k, JSON.stringify(o));
}
fs.writeFileSync(
  path.join(DATA, 'logs/verify_diag.json'),
  JSON.stringify(out, null, 1),
);
