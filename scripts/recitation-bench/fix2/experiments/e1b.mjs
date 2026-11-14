/* eslint-env node, es2020 */
// E1b: how much audio after a word the checker needs, with windows that stay inside one
// ayah. Condition A: the left edge at the ayah's start (or, when the ayah is longer than
// W, at a true word boundary), the right edge on a time grid, as live audio ends
// wherever it ends. Condition B: the right edge at a word's true end, bare (B0) or with a
// quiet tail (Bq), as a second pass trimmed to a word boundary would see it. Word times
// are Quran.com's, so use files whose offset (offset_check.mjs) is small.
//
//   node fix2/experiments/e1b.mjs <rid> <surah> [W=8] [hop=0.24]
//
// One line per word per window in .out/fix2/e1b/<rid>_<surah>_W<W>.jsonl; read them with
// e1b_an.py.
import fs from 'node:fs';
import path from 'node:path';
import {loadModel, sliceFrames, fbank} from '../model.mjs';
import {
  OUT,
  QDC,
  FRAME,
  BINS,
  SR,
  alignFree,
  allKeys,
  argmaxPath,
  ayahGroups,
  ayahWords,
  editDistance,
  greedySpan,
  loadQdc,
  readF32,
  relativeTo,
  rng,
  tokensOf,
} from '../common.mjs';

const [rid, surah, wArg, hopArg] = process.argv.slice(2);
if (!rid || !surah) {
  console.error(
    'usage: node fix2/experiments/e1b.mjs <rid> <surah> [W=8] [hop=0.24]',
  );
  process.exit(2);
}
const W = Number(wArg ?? 8);
const HOP = Number(hopArg ?? 0.24);
const base = path.join(QDC, `${rid}_${surah}`);
const said = loadQdc(`${base}.json`);
const wave = readF32(`${base}.f32`);
const feats = fbank(wave);
const model = await loadModel();
fs.mkdirSync(path.join(OUT, 'e1b'), {recursive: true});
const out = fs.openSync(
  path.join(OUT, 'e1b', `${rid}_${surah}_W${W}.jsonl`),
  'w',
);

// A planted alternative per said word: another word of this surah or surah 2, within one
// letter of its length and at least two edits away.
const pool = [];
for (const k of allKeys().filter(
  key => key.startsWith(`${surah}:`) || key.startsWith('2:'),
)) {
  for (const w of ayahWords(k)) {
    pool.push(w);
  }
}
const rand = rng(1000 * Number(rid) + Number(surah));
const alt = said.map(w => {
  for (let i = 0; i < 200; i++) {
    const c = pool[Math.floor(rand() * pool.length)];
    if (
      Math.abs(c.length - w.letters.length) <= 1 &&
      editDistance([...c], [...w.letters]) >= 2
    ) {
      return c;
    }
  }
  return null;
});
const groups = ayahGroups(said);

/** The slice followed by `extra` copies of its quietest frame. */
function withQuietTail(cut, extra) {
  let q = 0;
  let low = Infinity;
  for (let t = 0; t < cut.frames; t++) {
    let s = 0;
    for (let b = 0; b < BINS; b++) {
      s += cut.data[t * BINS + b];
    }
    if (s < low) {
      low = s;
      q = t;
    }
  }
  const frames = cut.frames + extra;
  const data = new Float32Array(frames * BINS);
  data.set(cut.data.subarray(0, cut.frames * BINS));
  const row = cut.data.subarray(q * BINS, (q + 1) * BINS);
  for (let t = cut.frames; t < frames; t++) {
    data.set(row, t * BINS);
  }
  return {data, frames};
}
let runs = 0;
let ms = 0;
async function read(t0s, t1s, tail) {
  const startS = Math.max(0, Math.round(t0s * SR));
  const endS = Math.min(wave.length, Math.round(t1s * SR));
  let cut = sliceFrames(feats, startS, endS, wave.length);
  if (cut.frames < 16) {
    return null;
  }
  if (tail) {
    cut = withQuietTail(cut, tail);
  }
  const a = performance.now();
  const r = await model.runFrames(cut.data, cut.frames);
  ms += performance.now() - a;
  runs++;
  const rel = relativeTo(r.logp, r.frames);
  return {
    rel,
    frames: r.frames,
    am: argmaxPath(rel, r.frames),
    t0: startS / SR,
    t1: endS / SR,
  };
}
function evalWords(R, idx) {
  const ws = idx.map(i => tokensOf(said[i].letters));
  const al = alignFree(R.rel, R.frames, ws, {startFree: false, endFree: true});
  return {ws, al};
}
function emit(cond, R, idx, k, al, ws, extra) {
  const w = said[idx[k]];
  const a = al[k];
  if (a.start < 0) {
    return;
  }
  const g = greedySpan(R.am, a.start, a.end);
  const row = {
    cond,
    i: idx[k],
    key: `${w.surah}:${w.ayah}:${w.word}`,
    first: w.word === 0,
    last: w.word === w.total - 1,
    rep: w.repeat,
    dR: +(R.t1 - w.end).toFixed(3),
    dL: +(w.start - R.t0).toFixed(3),
    wr: idx.length - 1 - k,
    wl: k,
    n: ws[k].length,
    ed: editDistance(g, ws[k]),
    got: a.letters,
    sc: +a.score.toFixed(3),
    be: +(R.t0 + (a.end + 1) * FRAME - w.end).toFixed(3),
    ...extra,
  };
  if (alt[idx[k]]) {
    const ws2 = ws.slice();
    ws2[k] = tokensOf(alt[idx[k]]);
    const al2 = alignFree(R.rel, R.frames, ws2, {
      startFree: false,
      endFree: true,
    });
    const c = al2[k];
    // How much better the true text fits the whole window than the planted one.
    row.ctot = +(al.score - al2.score).toFixed(3);
    if (c.start >= 0) {
      row.cn = ws2[k].length;
      row.ced = editDistance(greedySpan(R.am, c.start, c.end), ws2[k]);
      row.csc = +c.score.toFixed(3);
      row.cgot = c.letters;
    } else {
      row.cnone = 1;
    }
  }
  fs.writeSync(out, JSON.stringify(row) + '\n');
}
for (let gi = 0; gi < groups.length; gi++) {
  const g = groups[gi];
  const aStart = said[g[0]].start;
  const aEnd = said[g[g.length - 1]].end;
  const prev = groups[gi - 1];
  const prevEnd = prev ? said[prev[prev.length - 1]].end : 0;
  const lead = Math.max(prevEnd, aStart - 0.2); // not into the ayah before
  const next = groups[gi + 1];
  const nextStart = next ? said[next[0]].start : wave.length / SR;
  const leftAt = first => (first === 0 ? lead : said[g[first]].start);
  // Condition A: a time grid, to the earlier of 2 s after the ayah and the end of the
  // next ayah's first word.
  const lastTick = Math.min(
    aEnd + 2.0,
    next ? said[next[0]].end : wave.length / SR,
  );
  for (let t = aStart + 0.72; t <= lastTick + 1e-9; t += HOP) {
    let first = 0;
    while (first < g.length - 1 && t - leftAt(first) > W) {
      first++;
    }
    const R = await read(leftAt(first), t, 0);
    if (!R) {
      continue;
    }
    const idx = g.slice(first);
    const {ws, al} = evalWords(R, idx);
    for (let k = 0; k < idx.length; k++) {
      if (said[idx[k]].end > t) {
        break; // not finished yet
      }
      emit('A', R, idx, k, al, ws, {
        cutMid: first > 0,
        into: +(t - aEnd).toFixed(2),
        pause: +(nextStart - aEnd).toFixed(2),
      });
    }
  }
  // Condition B: the right edge at each word's true end, bare or with a quiet tail.
  for (let k = 0; k < g.length; k++) {
    const tEnd = said[g[k]].end + 0.04;
    let first = 0;
    while (first < k && tEnd - leftAt(first) > W) {
      first++;
    }
    for (const tail of [0, 12]) {
      const R = await read(leftAt(first), tEnd, tail);
      if (!R) {
        continue;
      }
      const idx = g.slice(first, k + 1);
      const {ws, al} = evalWords(R, idx);
      for (let j = Math.max(0, idx.length - 3); j < idx.length; j++) {
        emit(tail ? 'Bq' : 'B0', R, idx, j, al, ws, {back: idx.length - 1 - j});
      }
    }
  }
}
console.log(
  JSON.stringify({
    rid,
    surah,
    W,
    HOP,
    runs,
    msPerRun: +(ms / runs).toFixed(1),
    words: said.length,
    ayat: groups.length,
  }),
);
