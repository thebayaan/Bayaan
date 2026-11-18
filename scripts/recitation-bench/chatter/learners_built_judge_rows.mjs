/* eslint-env node, es2020 */
// The second judge's answer on every verdict that may wake it, on the slice the app would
// hold, for populations and holds the earlier jobs did not run. The filters come first, so
// bursts never wake the model. Finished runs are skipped, so it resumes.
//   node scripts/second-look/judge_rows.mjs --suite <name> --hold 0.48|0
import fs from 'node:fs';
import path from 'node:path';
import {sliceFrames, MIN_FRAMES} from '../judge/model.mjs';
import {fbank} from '../judge/fbank.mjs';
import {judgeWord} from '../judge/judge.mjs';
import {keptWakes} from './learners_built_chain.mjs';
import {
  LEFT,
  loadModel,
  RIGHT,
  OUT,
  SR,
  SUITES,
  altsOf,
  audioOf,
  gate,
  hafsToken,
  judgeSlice,
  lettersOf,
  placesOf,
  rowFile,
  suiteRunIds,
  tooHeavy,
  wakesJudge,
} from './learners_built_lib.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2)
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const name = args.suite;
const hold = Number(args.hold);
const suite = SUITES[name];
const file = rowFile(name, hold);
fs.mkdirSync(path.dirname(file), {recursive: true});
const done = new Set();
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('{"done":')) {
      try {
        done.add(JSON.parse(line).done);
      } catch {
        // a torn last line
      }
    }
  }
}
const ids = suiteRunIds(name).filter(id => !done.has(id));
if (!ids.length) {
  console.log(
    JSON.stringify({suite: name, hold, runs: 0, note: 'nothing left'}),
  );
  process.exit(0);
}
const out = fs.openSync(file, 'a');
fs.writeSync(out, '\n');
await gate(0);
const model = await loadModel();
let runs = 0;
let slices = 0;
let scored = 0;
let ms = 0;
for (const id of ids) {
  await gate();
  if (tooHeavy()) {
    console.log(
      JSON.stringify({
        suite: name,
        hold,
        runs,
        slices,
        scored,
        note: 'restarting, rss limit',
      }),
    );
    process.exit(75);
  }
  const run = JSON.parse(fs.readFileSync(suite.plain(id), 'utf8'));
  const kept = keptWakes(run);
  // On a learner take only the learner's part; a lead-in's words are never counted.
  const from = suite.learnerOnly
    ? Math.min(...run.clip.segments.filter(g => !g.lead).map(g => g.start)) - 2
    : -Infinity;
  const reqs = [];
  for (const c of run.vchanges) {
    if (c.stop || c.t < from || !wakesJudge(c) || !kept.has(`${c.id}|${c.t}`))
      continue;
    reqs.push({id: c.id, t: c.t, state: c.to, d: c.d ?? null, src: 'live'});
  }
  if (suite.flush) {
    for (const v of run.flush?.verdicts ?? []) {
      if (v.newly && wakesJudge(v))
        reqs.push({
          id: v.id,
          t: run.summary.seconds,
          state: v.state,
          d: v.d ?? null,
          src: 'flush',
        });
    }
  }
  if (reqs.length) {
    const audio = audioOf(run);
    const feats = fbank(audio);
    const places = placesOf(run);
    const cache = new Map();
    for (const q of reqs) {
      const [s, a, w] = q.id.split(':').map(Number);
      const key = `${s}:${a}`;
      const words = lettersOf(key);
      if (!words) continue;
      const {start, end} = judgeSlice(places, q.id, q.t, hold, audio.length);
      const ck = `${start}:${end}`;
      let r = cache.get(ck);
      if (!r) {
        const piece = sliceFrames(feats, start, end, audio.length);
        if (piece.frames < MIN_FRAMES) continue;
        r = await model.runFrames(piece.data, piece.frames);
        cache.set(ck, r);
        slices += 1;
        ms += r.ortMs;
      }
      const j = hafsToken(key, w);
      const verdict = judgeWord(r.logp, r.frames, words, j, altsOf(key, j), {
        leftWords: LEFT,
        rightWords: RIGHT,
      });
      scored += 1;
      fs.writeSync(
        out,
        `${JSON.stringify({run: id, suite: name, id: q.id, t: q.t, src: q.src, state: q.state, gop: q.d?.gop ?? null, distance: q.d?.distance ?? null, heard: q.d?.heardRatio ?? null, slice: [+(start / SR).toFixed(2), +(end / SR).toFixed(2)], r: verdict})}\n`,
      );
    }
  }
  fs.writeSync(out, `${JSON.stringify({done: id})}\n`);
  runs += 1;
}
fs.closeSync(out);
console.log(
  JSON.stringify({
    suite: name,
    hold,
    runs,
    slices,
    scored,
    msPerSlice: +(ms / Math.max(1, slices)).toFixed(1),
    out: path.relative(OUT, file),
  }),
);
