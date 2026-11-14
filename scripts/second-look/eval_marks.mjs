/* eslint-env node, es2020 */
// Every candidate on every run of a suite, through the marks replay. The cancel step is asked
// when a mark falls due, so a cancelled word that goes bad again is asked again, as in the app.
// Writes one line per run to .out/second-look/marks/<suite>.jsonl; finished runs are skipped.
//   node scripts/second-look/eval_marks.mjs --suite <name> [--limit N --to file]
import fs from 'node:fs';
import path from 'node:path';
import {
  loadModel,
  sliceFrames,
  MIN_FRAMES,
} from '../recitation-bench/judge/model.mjs';
import {fbank} from '../recitation-bench/judge/fbank.mjs';
import {tokensOf} from '../recitation-bench/judge/judge.mjs';
import {CONFIGS, decideCancel} from './cancel.mjs';
import {
  correctedRun,
  identified,
  junctionMark,
  liveWakes,
  quiet,
} from './chain.mjs';
import {
  FIRST_WITHIN,
  HOLD,
  LEFT,
  OUT,
  RIGHT,
  SR,
  SUITES,
  audioOf,
  gate,
  hafsToken,
  judgeSlice,
  lettersOf,
  loadRows,
  placesOf,
  splitAyah,
  suiteRunIds,
  tooHeavy,
  wordCount,
} from './lib.mjs';
import {replay} from './replay_marks.mjs';
import {
  SHIPPED_SLICE,
  firstPass,
  innerGap,
  needsPaddedLook,
  paddedCut,
} from './rule.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2)
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const name = args.suite;
const suite = SUITES[name];
const count = wordCount;
const file = args.to ?? path.join(OUT, 'marks', `${name}.jsonl`);
fs.mkdirSync(path.dirname(file), {recursive: true});
const done = new Set();
if (fs.existsSync(file)) {
  const good = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    try {
      done.add(JSON.parse(line).id);
      good.push(line);
    } catch {
      // a torn last line
    }
  }
  fs.writeFileSync(file, good.length ? `${good.join('\n')}\n` : '');
}
const ids = suiteRunIds(name)
  .filter(id => !done.has(id))
  .slice(0, Number(args.limit ?? Infinity));
if (!ids.length) {
  console.log(JSON.stringify({suite: name, runs: 0, note: 'nothing left'}));
  process.exit(0);
}
const out = fs.openSync(file, 'a');
const rows = {[HOLD]: loadRows(name, HOLD), 0: loadRows(name, 0)};
let standIn = null;
if (suite.standIn) {
  const {withCheck} =
    await import('../recitation-bench/natural/junction/decision.mjs');
  const {loadCorpus} =
    await import('../recitation-bench/natural/junction/llr.mjs');
  const corpus = loadCorpus();
  standIn = run =>
    run.probe?.post
      ? withCheck(
          run,
          suite.standIn,
          {llrMissing: -7, fitNext: -4, fitLate: -20},
          corpus,
          {},
        )
      : run;
}
await gate(0);
let model = null;
const modelRuns = {ship: 0, judge: 0, padded: 0, mismatch: 0};

const lite = t => {
  if (!t) return {};
  const keys = [
    'type',
    'pair',
    'pairSplit',
    'reciter',
    'reciterSplit',
    'position',
    'close',
    'target',
    'expectedKey',
    'block',
    'blockSplit',
    'words',
    'category',
    'dataset',
    'control',
    'startWord',
    'wordStart',
    'wordEnd',
    'label',
  ];
  const out = Object.fromEntries(
    keys.filter(k => t[k] !== undefined).map(k => [k, t[k]]),
  );
  if (t.errors) out.errorIds = t.errors.map(e => e.id);
  return out;
};
/** The next word's onset in the audio, where the suite records it. */
function onsetOf(run) {
  const t = run.clip.truth;
  if (!t) return null;
  if (t.stamps)
    return t.stamps[String((t.target ?? -9) + 1)]?.[0] / 1000 || null;
  if (t.nextStartMs !== undefined && t.nextStartMs !== null)
    return t.nextStartMs / 1000;
  if (run.partsAt?.[1] && t.nextOnsetMs !== undefined)
    return run.partsAt[1].start + t.nextOnsetMs / 1000;
  return null;
}

async function paddedStep(audio, word, f, ws, we, limit) {
  const tokens = tokensOf(word);
  const res = {
    perLetter: f.perLetter,
    ws: +ws.toFixed(3),
    we: +we.toFixed(3),
    padded: false,
    gap: null,
  };
  if (needsPaddedLook(f.perLetter, tokens.length)) {
    const cut = paddedCut(audio, ws, we, limit);
    // A word that barely reaches what has been heard: a failure, which shows the mark.
    if (!cut) return {...res, failed: 'short cut'};
    const {data, frames} = fbank(cut);
    const m = await model.runFrames(data, frames);
    modelRuns.padded += 1;
    res.padded = true;
    res.gap = innerGap(m.logp, m.frames, tokens);
  }
  return res;
}

async function shipFeatures(st, id, t, due) {
  const [s, a, w] = id.split(':').map(Number);
  const key = `${s}:${a}`;
  const words = lettersOf(key);
  if (!words || splitAyah(key) || !words[w]) return {failed: 'no letters'};
  const audio = st.audio();
  const end = Math.min(
    audio.length,
    Math.round(Math.min(t + SHIPPED_SLICE.after, due) * SR),
  );
  const start = Math.max(0, Math.round((t - SHIPPED_SLICE.before) * SR));
  if (end - start < SHIPPED_SLICE.least * SR) return {failed: 'short'};
  const {data, frames} = fbank(audio.subarray(start, end));
  const m = await model.runFrames(data, frames);
  modelRuns.ship += 1;
  const f = firstPass(m.logp, m.frames, words, w, {
    leftWords: 2,
    rightWords: 1,
  });
  if (!f) return {failed: 'no path'};
  return paddedStep(
    audio,
    words[w],
    f,
    start / SR + f.startFrame * 0.04,
    start / SR + (f.endFrame + 1) * 0.04,
    Math.round(due * SR),
  );
}

async function judgeFeatures(st, id, t, src, hold) {
  const [s, a, w] = id.split(':').map(Number);
  const key = `${s}:${a}`;
  const words = lettersOf(key);
  if (!words || splitAyah(key) || !words[w]) return {failed: 'no letters'};
  const audio = st.audio();
  const {start, end} = judgeSlice(st.places(), id, t, hold, audio.length);
  const piece = sliceFrames(st.feats(), start, end, audio.length);
  if (piece.frames < MIN_FRAMES) return {failed: 'short'};
  const r = await model.runFrames(piece.data, piece.frames);
  modelRuns.judge += 1;
  const f = firstPass(r.logp, r.frames, words, hafsToken(key, w), {
    leftWords: LEFT,
    rightWords: RIGHT,
    firstWithin: FIRST_WITHIN,
  });
  if (!f) return {failed: 'no path'};
  // The stored row was scored on the same slice: a difference means the slice moved.
  const row = st.rows[hold]?.get(`${id}|${t}|${src}`);
  if (row && Math.abs(f.expected - row.r.expected) > 0.002) {
    modelRuns.mismatch += 1;
    console.log(
      `mismatch ${st.id} ${id} t=${t} hold=${hold}: ${f.expected} against ${row.r.expected}`,
    );
  }
  const at = Math.round(start / 160) * 0.01;
  const limit = src === 'flush' ? audio.length : Math.round((t + hold) * SR);
  return paddedStep(
    audio,
    words[w],
    f,
    at + f.startFrame * 0.04,
    at + (f.endFrame + 1) * 0.04,
    limit,
  );
}

let runs = 0;
let lastWrite = 0;
for (const id of ids) {
  await gate();
  if (tooHeavy()) {
    console.log(
      JSON.stringify({
        suite: name,
        runs,
        ...modelRuns,
        note: 'restarting, rss limit',
      }),
    );
    process.exit(75);
  }
  const raw = JSON.parse(fs.readFileSync(suite.dir(id), 'utf8'));
  const base = standIn ? standIn(raw) : raw;
  const r48 = rows[HOLD].get(id) ?? new Map();
  const r0 = rows[0].get(id) ?? new Map();
  const chains = {
    J: {run: quiet(base)},
    S1: correctedRun(base, r48, 'S1', count),
    S1h0: correctedRun(base, r0, 'S1', count),
    S2: correctedRun(base, r48, 'S2', count),
    S2h0: correctedRun(base, r0, 'S2', count),
    N1: correctedRun(base, r48, 'N1', count),
    N2: correctedRun(base, r48, 'N2', count),
  };
  let audio = null;
  let feats = null;
  let places = null;
  const st = {
    id,
    rows: {[HOLD]: r48, 0: r0},
    audio: () => (audio ??= audioOf(base)),
    feats: () => (feats ??= fbank(st.audio())),
    places: () =>
      (places ??= placesOf(
        JSON.parse(fs.readFileSync(suite.plain(id), 'utf8')),
      )),
  };
  const ship = new Map();
  const judge = new Map();
  const seconds = base.summary.seconds;
  let result;
  for (;;) {
    const pending = new Map();
    result = {};
    for (const cfg of CONFIGS) {
      const chain = chains[cfg.chain];
      result[cfg.name] = {};
      for (const mode of suite.modes) {
        const checks = [];
        const decide = q => {
          const src =
            Math.abs(q.t - seconds) < 1e-6 &&
            st.rows[cfg.hold]?.has(`${q.id}|${seconds}|flush`)
              ? 'flush'
              : 'live';
          const shipKey = `${q.id}|${q.t}|${Math.min(q.t + SHIPPED_SLICE.after, q.due).toFixed(3)}`;
          const judgeKey = `${q.id}|${q.t}|${src}|${cfg.hold}`;
          const junction = junctionMark(chain.run, q.id, q.due);
          const known = identified(chain.run, q.id, q.since, q.due);
          const d = decideCancel(cfg.cancel, q, {
            junction,
            identified: known,
            ship: ship.get(shipKey),
            judge: judge.get(judgeKey),
          });
          if (d.need === 'ship')
            pending.set(`s|${shipKey}`, () =>
              shipFeatures(st, q.id, q.t, q.due).then(v =>
                ship.set(shipKey, v),
              ),
            );
          if (d.need === 'judge')
            pending.set(`j|${judgeKey}`, () =>
              judgeFeatures(st, q.id, q.t, src, cfg.hold).then(v =>
                judge.set(judgeKey, v),
              ),
            );
          checks.push({
            id: q.id,
            t: q.t,
            due: +q.due.toFixed(3),
            k: q.kind,
            ans: d.ans,
            x: d.x,
            jx: junction ? 1 : 0,
            known: known ? 1 : 0,
            sk: shipKey,
            jk: judgeKey,
          });
          return d.ans;
        };
        const {visible, suspects} = replay(chain.run, {
          mode,
          wordCount: count,
          decide,
        });
        const shown = [...visible.entries()].map(([k, m]) => ({
          id: k,
          k: m.kind,
          s: +m.since.toFixed(3),
          a: +m.shownAt.toFixed(3),
          t: m.lastBadAt,
          c: m.corrected ? 1 : 0,
        }));
        result[cfg.name][mode] = {shown, checks, suspects};
      }
    }
    if (!pending.size) break;
    if (!model) model = await loadModel();
    for (const fn of pending.values()) await fn();
  }
  const wakes = {};
  for (const [k, step, rr] of [
    ['S1', 'S1', r48],
    ['S1h0', 'S1', r0],
    ['S2', 'S2', r48],
    ['S2h0', 'S2', r0],
  ])
    wakes[k] = liveWakes(base, rr, step, count);
  const features = {
    ship: Object.fromEntries(ship),
    judge: Object.fromEntries(judge),
  };
  fs.writeSync(
    out,
    `${JSON.stringify({id, truth: lite(raw.clip.truth), seconds, onset: onsetOf(raw), cond: raw.clip.mix ?? null, wakes, features, cfg: result})}\n`,
  );
  runs += 1;
  if (runs - lastWrite >= 200) {
    lastWrite = runs;
    console.log(JSON.stringify({suite: name, runs, ...modelRuns}));
  }
}
fs.closeSync(out);
console.log(
  JSON.stringify({
    suite: name,
    runs,
    ...modelRuns,
    rss: +(process.memoryUsage().rss / 1e9).toFixed(2),
  }),
);
