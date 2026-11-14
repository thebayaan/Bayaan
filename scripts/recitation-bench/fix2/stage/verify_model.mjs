/* eslint-env node, es2020 */
// Spot-check staged clips with the checker (fix2/model.mjs, ORT_THREADS=1). Numbers only in output.
// Usage: ORT_THREADS=1 node fix2/stage/verify_model.mjs [<out.json>]   (resumable: skips ids already in out.json)
import fs from 'node:fs';
import path from 'node:path';
import {loadModel} from '../model.mjs';
import {
  OUT as FIX2_OUT,
  ayahWords,
  allKeys,
  readF32,
  relativeTo,
  argmaxPath,
  greedySpan,
  editDistance,
  tokensOf,
  rng,
} from '../common.mjs';
const DATA = path.join(FIX2_OUT, 'data');
fs.mkdirSync(path.join(DATA, 'logs'), {recursive: true});
const OUT = process.argv[2] ?? path.join(DATA, 'logs/verify_model.json');
const res = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const SR = 16000,
  SURAH_SEC = 60;
const ayahToks = k => tokensOf((ayahWords(k) ?? []).join(''));
const BASMALA = ayahToks('1:1');
// semi-global: hyp may skip up to `maxSkip` leading letters (lead-in), ref end free.
function semi(hyp, ref, maxSkip) {
  const n = hyp.length,
    m = ref.length;
  maxSkip = Math.min(maxSkip, Math.floor(n / 2));
  let best = {d: Infinity};
  // D[i][j]: cost hyp[s..i) vs ref[0..j) with s<=maxSkip free
  let prev = new Float64Array(m + 1),
    cur = new Float64Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  let pskip = new Int32Array(m + 1);
  if (n === 0) return {d: m, refLen: m, skip: 0};
  for (let i = 1; i <= n; i++) {
    cur[0] = i <= maxSkip ? 0 : prev[0] + 1;
    const cskip = new Int32Array(m + 1);
    cskip[0] = i <= maxSkip ? i : pskip[0];
    for (let j = 1; j <= m; j++) {
      const a = prev[j] + 1,
        b = cur[j - 1] + 1,
        c = prev[j - 1] + (hyp[i - 1] === ref[j - 1] ? 0 : 1);
      if (c <= a && c <= b) {
        cur[j] = c;
        cskip[j] = pskip[j - 1];
      } else if (a <= b) {
        cur[j] = a;
        cskip[j] = pskip[j];
      } else {
        cur[j] = b;
        cskip[j] = cskip[j - 1];
      }
    }
    if (i === n)
      for (let j = 1; j <= m; j++)
        if (cur[j] < best.d || (cur[j] === best.d && j > best.j))
          best = {d: cur[j], j, skip: cskip[j]};
    [prev, cur] = [cur, prev];
    pskip = cskip;
  }
  return {d: best.d, refLen: best.j, skip: best.skip};
}
let keys = null;
function bestAyah(hyp) {
  keys ??= allKeys();
  let b = {r: Infinity};
  for (const k of keys) {
    const ref = ayahToks(k);
    if (
      Math.abs(ref.length - hyp.length) >
      0.35 * Math.max(ref.length, hyp.length)
    )
      continue;
    const r = editDistance(hyp, ref) / ref.length;
    if (r < b.r) b = {r: +r.toFixed(3), key: k};
  }
  return b;
}
function sample(arr, n, seed) {
  const R = rng(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
const jobs = [];
for (const set of fs.readdirSync(DATA).sort()) {
  const mf = path.join(DATA, set, 'manifest.json');
  if (!fs.existsSync(mf)) continue;
  const clips = JSON.parse(fs.readFileSync(mf, 'utf8')).clips;
  const ay = clips.filter(c => c.kind === 'ayah');
  if (set === 'twin_ayat') {
    // stratified so every voice gets a median: 4 per voice
    const by = new Map();
    for (const c of ay) {
      if (!by.has(c.reciter)) by.set(c.reciter, []);
      by.get(c.reciter).push(c);
    }
    let s = 7;
    for (const [, cs] of [...by].sort())
      for (const c of sample(cs, 4, s++)) jobs.push([set, c, 'ayah']);
  } else if (ay.length)
    for (const c of sample(ay, 40, 1234)) jobs.push([set, c, 'ayah']);
  const sp = clips.filter(c => c.kind === 'span' && c.extra?.wordStart);
  for (const c of sample(sp, 40, 99)) jobs.push([set, c, 'span']);
  const su = clips.filter(c => c.kind === 'surah');
  const by = new Map();
  for (const c of su) {
    if (!by.has(c.reciter)) by.set(c.reciter, []);
    by.get(c.reciter).push(c);
  }
  let s = 31;
  for (const [, cs] of [...by].sort()) {
    // two per reciter; where a voice has two sources (timingsKind differs), one of each
    const kinds = [...new Set(cs.map(c => c.timingsKind))];
    const pick =
      kinds.length > 1
        ? kinds.map(
            k =>
              sample(
                cs.filter(c => c.timingsKind === k),
                1,
                s++,
              )[0],
          )
        : sample(cs, 2, s++);
    for (const c of pick) jobs.push([set, c, 'surah']);
  }
}
const model = await loadModel();
let n = 0;
for (const [set, c, mode] of jobs) {
  const key = `${set}/${c.id}`;
  if (res[key]) continue;
  let wave = readF32(c.audio);
  if (mode === 'surah') wave = wave.subarray(0, SURAH_SEC * SR);
  // The checker collapses on long inputs (60 s gave 9 letters where 4 x 15 s gave 116), so
  // decode in 15 s windows when a clip is over 20 s and join the greedy letters.
  const hyp = [];
  const win = wave.length > 20 * SR ? 15 * SR : wave.length;
  for (let t = 0; t < wave.length; t += win) {
    const r = await model.run(wave.subarray(t, Math.min(wave.length, t + win)));
    if (!r.frames) continue;
    const am = argmaxPath(relativeTo(r.logp, r.frames), r.frames);
    hyp.push(...greedySpan(am, 0, r.frames - 1));
  }
  const o = {
    set,
    id: c.id,
    reciter: c.reciter,
    mode,
    surah: c.surah,
    ayahStart: c.ayahStart,
    ayahEnd: c.ayahEnd,
    label: c.label,
    hypLetters: hyp.length,
  };
  if (mode === 'ayah' || mode === 'span') {
    let ref = [];
    if (mode === 'span')
      ref = tokensOf(
        ayahWords(`${c.surah}:${c.ayahStart}`)
          .slice(c.extra.wordStart - 1, c.extra.wordEnd)
          .join(''),
      );
    else
      for (let a = c.ayahStart; a <= c.ayahEnd; a++)
        ref.push(...ayahToks(`${c.surah}:${a}`));
    o.refLetters = ref.length;
    o.ratio = +(editDistance(hyp, ref) / ref.length).toFixed(3);
    if (o.ratio > 0.3) {
      // diagnose
      o.ratioWithBasmalaPrefix = +(
        editDistance(hyp, [...BASMALA, ...ref]) / ref.length
      ).toFixed(3);
      const sg = semi(hyp, ref, 60);
      o.prefixSkip = sg.skip;
      o.coveredRefLetters = sg.refLen;
      o.ratioTruncatedOrLead = +(sg.d / Math.max(1, sg.refLen)).toFixed(3);
      o.bestAyah = bestAyah(hyp);
    }
  } else {
    const ref = [];
    for (
      let a = c.ayahStart;
      a <= c.ayahEnd && ref.length < hyp.length * 1.6 + 50;
      a++
    )
      ref.push(...ayahToks(`${c.surah}:${a}`));
    const sg = semi(hyp, ref, 120);
    o.prefixSkip = sg.skip;
    o.coveredRefLetters = sg.refLen;
    o.ratio = +(sg.d / Math.max(1, sg.refLen)).toFixed(3);
    if (o.ratio > 0.3)
      o.ratioNoSkip = +(semi(hyp, ref, 0).d / Math.max(1, sg.refLen)).toFixed(
        3,
      );
  }
  res[key] = o;
  if (++n % 10 === 0) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  console.log(
    key,
    mode,
    o.ratio,
    o.prefixSkip ?? '',
    o.bestAyah ? JSON.stringify(o.bestAyah) : '',
  );
}
fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
console.log('jobs', jobs.length, 'done');
