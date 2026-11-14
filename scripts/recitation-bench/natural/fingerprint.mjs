/* eslint-env node, es2020 */
// Checks that no test reciter's recording is an EveryAyah recording under
// another name: best-lag cosine of log-mel features on a few ayat, against every
// Hafs folder on everyayah.com. A same-recording control comes from folders of
// one reciter at two bitrates.
//
//   node natural/fingerprint.mjs <everyayah_dir> <out.json>
//
// <everyayah_dir>/<folder>/<sss><aaa>.f32 are 16 kHz mono float32 decodes of
// EveryAyah's files; the scored clips are read from .out/natural/audio.
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../../..');
const AUDIO = path.resolve(HERE, '../.out/natural/audio');
const {KaldiFbank} = await import(
  path.join(ROOT, 'node_modules/@tilawa/core/dist/recitation/fbank.js')
);

function features(file) {
  const samples = new Float32Array(fs.readFileSync(file).buffer.slice(0));
  const frames = new KaldiFbank().acceptWaveform(samples);
  // Every other frame, 40 bands, each band zero-mean over the clip.
  const out = [];
  for (let t = 0; t < frames.length; t += 2) {
    const f = new Float32Array(40);
    for (let b = 0; b < 40; b++) f[b] = (frames[t][2 * b] + frames[t][2 * b + 1]) / 2;
    out.push(f);
  }
  const mean = new Float32Array(40);
  for (const f of out) for (let b = 0; b < 40; b++) mean[b] += f[b] / out.length;
  for (const f of out) for (let b = 0; b < 40; b++) f[b] -= mean[b];
  return out;
}

function bestCosine(x, y, maxLag = 50) {
  let best = -1;
  for (let lag = -maxLag; lag <= maxLag; lag += 1) {
    let dot = 0;
    let nx = 0;
    let ny = 0;
    for (let t = 0; t < x.length; t++) {
      const u = t + lag;
      if (u < 0 || u >= y.length) continue;
      const a = x[t];
      const b = y[u];
      for (let k = 0; k < 40; k++) {
        dot += a[k] * b[k];
        nx += a[k] * a[k];
        ny += b[k] * b[k];
      }
    }
    if (nx > 0 && ny > 0) {
      const c = dot / Math.sqrt(nx * ny);
      if (c > best) best = c;
    }
  }
  return best;
}

const [eaDir, outFile] = process.argv.slice(2);
const folders = fs.readdirSync(eaDir).filter(f => fs.statSync(path.join(eaDir, f)).isDirectory());
const ayat = [...new Set(folders.flatMap(f => fs.readdirSync(path.join(eaDir, f))))].filter(f => f.endsWith('.f32'));
const ea = new Map();
for (const folder of folders) {
  for (const a of ayat) {
    const file = path.join(eaDir, folder, a);
    if (fs.existsSync(file)) ea.set(`${folder}/${a}`, features(file));
  }
}
const toQua = a => `${Number(a.slice(0, 3))}_${Number(a.slice(3, 6))}.f32`;
const reciters = fs.readdirSync(AUDIO).filter(r => fs.statSync(path.join(AUDIO, r)).isDirectory());
const rows = [];
for (const r of reciters) {
  for (const a of ayat) {
    const file = path.join(AUDIO, r, toQua(a));
    if (!fs.existsSync(file)) continue;
    const x = features(file);
    for (const folder of folders) {
      const y = ea.get(`${folder}/${a}`);
      if (y) rows.push({reciter: r, folder, ayah: a, cos: +bestCosine(x, y).toFixed(3)});
    }
  }
  console.log(r, Math.max(...rows.filter(x => x.reciter === r).map(x => x.cos)));
}
// Same reciter, two bitrates of one folder name: the same-recording control.
const stem = f => f.replace(/_?\d+\s*[kK]bps.*$/, '');
const controls = [];
for (const a of ayat) {
  for (let i = 0; i < folders.length; i++) {
    for (let j = i + 1; j < folders.length; j++) {
      if (stem(folders[i]) !== stem(folders[j])) continue;
      const x = ea.get(`${folders[i]}/${a}`);
      const y = ea.get(`${folders[j]}/${a}`);
      if (x && y) controls.push({a: folders[i], b: folders[j], ayah: a, cos: +bestCosine(x, y).toFixed(3)});
    }
  }
}
// Different reciters inside EveryAyah: what chance looks like.
const chance = [];
for (const a of ayat) {
  for (let i = 0; i + 1 < folders.length; i += 3) {
    if (stem(folders[i]) === stem(folders[i + 1])) continue;
    const x = ea.get(`${folders[i]}/${a}`);
    const y = ea.get(`${folders[i + 1]}/${a}`);
    if (x && y) chance.push(+bestCosine(x, y).toFixed(3));
  }
}
const top = [...rows].sort((p, q) => q.cos - p.cos).slice(0, 25);
const summary = {
  ayat: ayat.length,
  folders: folders.length,
  comparisons: rows.length,
  maxTestVsEveryAyah: top[0]?.cos ?? null,
  top,
  sameRecordingControl: controls.sort((p, q) => q.cos - p.cos),
  chanceMax: Math.max(...chance),
  chanceN: chance.length,
};
fs.writeFileSync(outFile, JSON.stringify(summary, null, 1));
console.log(JSON.stringify({...summary, top: top.slice(0, 5), sameRecordingControl: summary.sameRecordingControl.slice(-5)}, null, 0));
