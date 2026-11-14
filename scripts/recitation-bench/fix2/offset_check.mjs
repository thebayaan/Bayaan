/* eslint-env node, es2020 */
// Per staged Quran.com file: how far the checker's own word times sit from the Quran.com
// segment times. About eight ayat of 4 or more words and under 14 s per file, each read
// with 2.5 s of audio either side; interior words only. Medians are checker minus
// Quran.com, in seconds.
//
//   node fix2/offset_check.mjs [<name> ...]
//
// With no names, every file under .out/fix2/qdc; the whole result replaces
// .out/fix2/qdc_offsets.json, which run_planted.sh, the experiments and the manifests
// read. With names, only those are printed and the file is left alone.
import fs from 'node:fs';
import path from 'node:path';
import {loadModel, fbank} from './model.mjs';
import {
  OUT,
  QDC,
  FRAME,
  SR,
  alignFree,
  ayahGroups,
  loadQdc,
  readF32,
  relativeTo,
  tokensOf,
} from './common.mjs';

const named = process.argv.slice(2);
const files = named.length
  ? named
  : fs
      .readdirSync(QDC)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
const model = await loadModel();
const res = {};
for (const f of files.sort()) {
  const base = path.join(QDC, f);
  if (!fs.existsSync(`${base}.f32`)) {
    continue;
  }
  const said = loadQdc(`${base}.json`);
  const wave = readF32(`${base}.f32`);
  const pick = ayahGroups(said).filter(
    g => g.length >= 4 && said[g[g.length - 1]].end - said[g[0]].start < 14,
  );
  const step = Math.max(1, Math.floor(pick.length / 8));
  const ds = [];
  const de = [];
  for (let k = 0; k < pick.length; k += step) {
    const g = pick[k];
    const t0 = Math.max(0, said[g[0]].start - 2.5);
    const t1 = Math.min(wave.length / SR, said[g[g.length - 1]].end + 2.5);
    const feats = fbank(
      wave.subarray(Math.round(t0 * SR), Math.round(t1 * SR)),
    );
    const r = await model.runFrames(feats.data, feats.frames);
    const rel = relativeTo(r.logp, r.frames);
    // Free ends: the window holds the neighbouring ayat's speech too.
    const al = alignFree(
      rel,
      r.frames,
      g.map(i => tokensOf(said[i].letters)),
    );
    for (let j = 1; j < g.length - 1; j++) {
      if (al[j].start >= 0) {
        ds.push(t0 + al[j].start * FRAME - said[g[j]].start);
        de.push(t0 + (al[j].end + 1) * FRAME - said[g[j]].end);
      }
    }
  }
  ds.sort((a, b) => a - b);
  de.sort((a, b) => a - b);
  const q = (a, p) =>
    a.length
      ? +a[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(2)
      : null;
  res[f] = {
    n: ds.length,
    startMed: q(ds, 0.5),
    start10: q(ds, 0.1),
    start90: q(ds, 0.9),
    endMed: q(de, 0.5),
    repeats: said.filter(w => w.repeat).length,
    odd: said.odd,
    words: said.length,
    minutes: +(wave.length / SR / 60).toFixed(1),
  };
  console.log(f, JSON.stringify(res[f]));
}
if (!named.length) {
  fs.writeFileSync(
    path.join(OUT, 'qdc_offsets.json'),
    JSON.stringify(res, null, 1),
  );
}
