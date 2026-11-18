/* eslint-env node, es2020 */
// End-to-end evaluation harness: plays the engine's verdicts from a saved bench
// run and, for each verdict that could wake the second judge, scores the word on
// the slice the app would hold at that moment (a rolling buffer of the stream's
// log-mel frames). Engine output is in the loop here,
// so nothing about the judge's own margins is tuned from this file's output: it
// measures the rules, and it can tune only the engine-side trigger (which goes in
// an NPL file).
//
//   node judge/e2e_harness.mjs --suite w1|w1_control|pool|w5|learners --split dev|test|all
//     --out file.jsonl [--runs dir] [--hold 0.48] [--D 8] [--left 2] [--right 1] [--shard i/n]
//     [--cut 0.2] [--tail 0.2] [--pad 0] [--wide 1]
//
// The slice stays inside the word's ayah, as far as the engine knows where that is:
// it starts `cut` seconds before the ayah's first word, or just after the last word
// of the ayah before if that is earlier (a disputed first word can be placed late),
// and ends `tail` seconds after the next ayah's first word starts. Those places come
// from the tracker's frames for the word, read here from the run's end-of-take
// record (in the app they can be read at any moment); without them, from when the
// cursor first entered the ayah.
//
// --wide also scores verdicts well outside any trigger, to size what a trigger
// would miss.
import fs from 'node:fs';
import path from 'node:path';
import {loadModel, readF32, sliceFrames, withQuietTail, MIN_FRAMES} from './model.mjs';
import {fbank} from './fbank.mjs';
import {judgeWord} from './judge.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const JUDGE = path.join(HERE, '../.out/natural/judge');
const SR = 16000;
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const suite = args.suite;
const split = args.split ?? 'dev';
const hold = Number(args.hold ?? 0.48);
const D = Number(args.D ?? 8);
const left = Number(args.left ?? 2);
const right = Number(args.right ?? 1);
const cut = Number(args.cut ?? 0.2);
const tail = Number(args.tail ?? 0.2);
const pad = Number(args.pad ?? 0);
// The tracker's first frame of a word comes this long after the second model's first
// letter (median over the dev pool, engine_timing.mjs).
const TRACKER_LAG = 0.23;
// The cursor enters an ayah about this long after its first word starts.
const CURSOR_LAG = 1.5;
// A slice shorter than this means the places above were wrong for this word.
const MIN_SLICE = 1.5;
// After the last word of the ayah before, the tracker's end of it plus this.
const AFTER_PREVIOUS = 0.3;
// Without the ayah before, this much earlier than the first word's place.
const NO_PREVIOUS = 1.0;
const wide = args.wide === '1';
const [iShard, nShard] = (args.shard ?? '0/1').split('/').map(Number);
const runsDir = path.join(args.runs ?? path.join(HERE, '../.out/natural/baseline/runs'), suite);

const index = JSON.parse(fs.readFileSync(path.join(JUDGE, 'index.json'), 'utf8'));
const wordsOf = JSON.parse(fs.readFileSync(path.join(HERE, '../.out/natural/manifests/engine_words.json'), 'utf8'));
const SPLITS = index.splits;
const hafsToken = (key, e) => (SPLITS[key] !== undefined && e > SPLITS[key] ? e - 1 : e);
const altsOf = (key, j) => {
  const row = index.ayat[key][j];
  return {
    mut: row.m.map(id => index.types[id]),
    near: (index.near[row.s] ?? []).map(id => index.types[id]),
  };
};

/** The verdicts that might wake the judge. */
function wakes(c) {
  const state = c.to ?? c.state;
  if (state === 'pending') return false;
  if (state !== 'ok') return true;
  const gop = c.d?.gop;
  const distance = c.d?.distance;
  if (typeof gop === 'number') return gop <= (wide ? -0.5 : -1.5);
  return distance > 0;
}

function loadStream(clip) {
  if (!clip.parts) return readF32(clip.audio);
  const pieces = clip.parts.map(p => readF32(p.audio));
  const audio = new Float32Array(pieces.reduce((x, y) => x + y.length, 0));
  let at = 0;
  for (const p of pieces) {
    audio.set(p, at);
    at += p.length;
  }
  return audio;
}

const files = fs
  .readdirSync(runsDir)
  .filter(f => f.endsWith('.json'))
  .sort()
  .filter((_, i) => i % nShard === iShard);
fs.mkdirSync(path.dirname(args.out), {recursive: true});
const out = fs.openSync(args.out, 'w');
const model = await loadModel();
let done = 0;
let slices = 0;
let ms = 0;
let scored = 0;
for (const f of files) {
  const run = JSON.parse(fs.readFileSync(path.join(runsDir, f), 'utf8'));
  const t = run.clip.truth;
  if (split !== 'all' && (t.reciterSplit !== split || (t.pairSplit ?? t.blockSplit ?? split) !== split)) continue;
  done += 1;
  const reqs = [];
  for (const c of run.vchanges) {
    if (c.stop || !wakes(c)) continue;
    reqs.push({id: c.id, t: c.t, state: c.to, d: c.d ?? null, src: 'live'});
  }
  const seconds = run.summary.seconds;
  for (const v of run.flush?.verdicts ?? []) {
    if (!v.newly || !wakes(v)) continue;
    reqs.push({id: v.id, t: seconds, state: v.state, d: v.d ?? null, src: 'flush'});
  }
  if (!reqs.length) continue;
  const audio = loadStream(run.clip);
  const feats = fbank(audio);
  const cache = new Map();
  const tracked = new Map((run.flush?.words ?? []).map(w => [w.id, w]));
  const cursorIn = new Map();
  for (const e of run.log) {
    if (e.type === 'word_progress' && !e.stop && !cursorIn.has(e.key)) cursorIn.set(e.key, e.t);
  }
  const ayahStart = key => {
    const w = tracked.get(`${key}:0`);
    if (w && w.from !== null) return w.from * 0.04 - TRACKER_LAG;
    return cursorIn.has(key) ? cursorIn.get(key) - CURSOR_LAG : null;
  };
  const sliceFrom = (s, a) => {
    const first = ayahStart(`${s}:${a}`);
    const n = wordsOf[`${s}:${a - 1}`];
    const prev = n ? tracked.get(`${s}:${a - 1}:${n - 1}`) : null;
    const after = prev && prev.to !== null ? prev.to * 0.04 + AFTER_PREVIOUS : null;
    if (first === null) return after;
    return after === null ? first - NO_PREVIOUS : Math.min(after, first - cut);
  };
  for (const q of reqs) {
    const [s, a, w] = q.id.split(':').map(Number);
    const key = `${s}:${a}`;
    if (!index.ayat[key]) continue;
    const j = hafsToken(key, w);
    let endSec = q.t + hold;
    const next = ayahStart(`${s}:${a + 1}`);
    if (next !== null && next > 0) endSec = Math.min(endSec, Math.max(q.t, next + tail));
    const end = Math.min(audio.length, Math.round(endSec * SR));
    let start = Math.max(0, end - Math.round(D * SR));
    const here = sliceFrom(s, a);
    if (here !== null) start = Math.max(start, Math.round(here * SR));
    if (end - start < MIN_SLICE * SR) start = Math.max(0, end - 3 * SR);
    start = Math.max(0, start);
    const ck = `${start}:${end}`;
    let r = cache.get(ck);
    if (!r) {
      const piece = sliceFrames(feats, start, end, audio.length);
      if (piece.frames < MIN_FRAMES) continue;
      const padded = pad ? withQuietTail(piece, Math.round(pad * 100)) : piece;
      r = await model.runFrames(padded.data, padded.frames);
      cache.set(ck, r);
      slices += 1;
      ms += r.ortMs;
    }
    const words = index.ayat[key].map(x => x.l);
    const verdict = judgeWord(r.logp, r.frames, words, j, altsOf(key, j), {leftWords: left, rightWords: right});
    scored += 1;
    fs.writeSync(
      out,
      JSON.stringify({
        run: run.clip.id,
        suite,
        reciter: t.reciter ?? t.speaker ?? null,
        id: q.id,
        t: q.t,
        src: q.src,
        state: q.state,
        gop: q.d?.gop ?? null,
        distance: q.d?.distance ?? null,
        heard: q.d?.heardRatio ?? null,
        slice: [+(start / SR).toFixed(2), +(end / SR).toFixed(2)],
        r: verdict,
      }) + '\n',
    );
  }
}
fs.closeSync(out);
console.log(JSON.stringify({suite, split, shard: iShard, runs: done, slices, scored, msPerSlice: +(ms / Math.max(1, slices)).toFixed(1)}));
