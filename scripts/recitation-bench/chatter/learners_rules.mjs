/* eslint-env node, es2020 */
// Applies the frozen cancel rules to every mark of one condition, on that condition's
// audio (the mix, rebuilt in memory), with the real second model, and writes one row
// per mark to .out/chatter/learners/rows.<cond>.jsonl. Finished marks are skipped, so
// it resumes. One process at a time, one ONNX thread, the ONNX arena off.
//
//   node chatter/learners_rules.mjs --cond one_ar:10 [--limit-clips N]
//
// Each mark gets two looks: `app`, the slice the app has when the mark falls due
// (around the latest bad verdict, clipped to the audio fed so far: rules B, C and E),
// and `exp`, the letter-slip experiment's slice (around the first bad verdict, clipped
// to the take), which is what rule C's clean result was measured on.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  BENCH,
  OUT,
  appendTiming,
  condName,
  hashF32,
  loadClips,
  loadWordMarks,
  machine,
  marksFile,
  mixOf,
  readJson,
  readJsonl,
  replayDetail,
  resultName,
  rowsFile,
  runDir,
  speakerOf,
  waitForLimits,
} from './learners_lib.mjs';
import {fedSamples, fitConstants, fitSlice, look, ruleB, ruleC, ruleD, ruleE} from './learners_score.mjs';

const RESTART = 75;
const RSS_LIMIT = 1.3e9;
const isBad = state => state === 'wrong' || state === 'skipped';
const NO_ALTERNATIVES = {mut: [], near: []};

const arg = name => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};

async function worker(cond) {
  const {loadModel, sliceFrames, MIN_FRAMES} = await import(path.join(BENCH, 'judge/model.mjs'));
  const {fbank} = await import(path.join(BENCH, 'judge/fbank.mjs'));
  const {judgeWord} = await import(path.join(BENCH, 'judge/judge.mjs'));
  const index = readJson(path.join(BENCH, '.out/natural/judge/index.json'));
  const wordsOf = readJson(path.join(BENCH, '.out/natural/manifests/engine_words.json'));
  const C = fitConstants(
    readJson(path.join(BENCH, 'judge/judge_constants.json')),
    readJson(path.join(BENCH, 'judge/engine_constants.npl.json')),
  );
  const SPLITS = index.splits;
  const hafsToken = (key, e) => (SPLITS[key] !== undefined && e > SPLITS[key] ? e - 1 : e);
  const rules = await loadWordMarks();
  const clips = new Map(loadClips().map(c => [c.id, c]));

  const marks = readJsonl(marksFile(cond));
  const rowsPath = rowsFile(cond);
  const old = readJsonl(rowsPath);
  // Rewrites a file a killed run left with a torn last line.
  fs.writeFileSync(rowsPath, old.length ? `${old.map(r => JSON.stringify(r)).join('\n')}\n` : '');
  const done = new Set(old.map(r => r.key));
  const fd = fs.openSync(rowsPath, 'a');
  const byRun = new Map();
  for (const m of marks) {
    const list = byRun.get(m.run) ?? [];
    list.push(m);
    byRun.set(m.run, list);
  }
  const model = await loadModel();
  let modelRuns = 0;
  let modelMs = 0;
  let written = 0;
  const started = Date.now();
  let lastGate = 0;
  let runs = [...byRun.keys()];
  if (arg('limit-clips')) runs = runs.slice(0, Number(arg('limit-clips')));
  for (const runId of runs) {
    const todo = byRun.get(runId).filter(m => !done.has(`${m.run}|${m.id}|${m.t}`));
    if (!todo.length) continue;
    if (Date.now() - lastGate > 15000) {
      await waitForLimits();
      lastGate = Date.now();
    }
    if (process.memoryUsage().rss > RSS_LIMIT) {
      console.log(`rss limit after ${written} marks, restarting`);
      process.exit(RESTART);
    }
    const clipInfo = clips.get(runId);
    const run = readJson(path.join(runDir(cond), resultName(runId)));
    const detail = replayDetail(run, rules);
    const {mix: wave, info} = mixOf(run.clip.sourceAudio, runId, cond);
    // The mix the engine heard, sample for sample.
    if (hashF32(wave) !== run.clip.mix.md5 || info.gain !== run.clip.mix.gain || info.scale !== run.clip.mix.scale) {
      throw new Error(`rebuilt mix differs from the one the engine heard: ${runId}`);
    }
    const cache = new Map();
    const once = async (key, make) => {
      if (!cache.has(key)) {
        const t0 = performance.now();
        cache.set(key, await make());
        modelRuns += 1;
        modelMs += performance.now() - t0;
      }
      return cache.get(key);
    };
    const slice = (a, b) => once(`s${a}:${b}`, () => model.run(wave.subarray(a, b)));
    const padded = (a, b, pad) =>
      once(`p${a}:${b}`, () => {
        const z = Math.round(pad * 16000);
        const input = new Float32Array(b - a + 2 * z);
        input.set(wave.subarray(a, b), z);
        return model.run(input);
      });
    let feats = null;
    const tracked = new Map((run.flush?.words ?? []).map(w => [w.id, w]));
    const cursorIn = new Map();
    for (const e of run.log) {
      if (e.type === 'word_progress' && !e.stop && !cursorIn.has(e.key)) cursorIn.set(e.key, e.t);
    }
    const fitAt = async (key, j, t, words) => {
      const {start, end} = fitSlice({key, t, length: wave.length, tracked, cursorIn, wordsOf, C});
      feats ??= fbank(wave);
      const piece = sliceFrames(feats, start, end, wave.length);
      if (piece.frames < MIN_FRAMES) return {from: start / 16000, to: end / 16000, frames: 0, expected: null, nothing: null};
      const r = await once(`f${start}:${end}`, () => model.runFrames(piece.data, piece.frames));
      const v = judgeWord(r.logp, r.frames, words, j, NO_ALTERNATIVES, {leftWords: C.leftWords, rightWords: C.rightWords});
      return {
        from: +(start / 16000).toFixed(4),
        to: +(end / 16000).toFixed(4),
        frames: r.frames,
        expected: v.expected,
        nothing: v.nothing,
      };
    };
    for (const m of todo) {
      const info2 = detail.get(m.id);
      if (!info2 || Math.abs(info2.since - m.t) > 1e-6 || Math.abs(info2.shownAt - m.confirmedAt) > 1e-6) {
        throw new Error(`replay differs from score_real: ${runId} ${m.id}`);
      }
      const [s, a, w] = m.id.split(':').map(Number);
      const key = `${s}:${a}`;
      const words = index.ayat[key]?.map(x => x.l) ?? null;
      // As the app: ayat where the engine splits a word have no letters.
      const letters = words && SPLITS[key] === undefined && w < words.length ? words : null;
      const bad = run.vchanges.filter(c => c.id === m.id && !c.stop && isBad(c.to) && c.t <= info2.shownAt);
      const verdict = bad.filter(c => c.t <= info2.lastBad + 1e-6).pop() ?? bad[bad.length - 1];
      const inStreak = bad.filter(c => c.t >= info2.since - 1e-6).length;
      const n = wordsOf[key];
      const place = w === 0 ? 'first' : w === n - 1 ? 'last' : 'interior';
      const limit = fedSamples(info2.shownAt, wave.length);
      const app = letters
        ? await look({limit, letters, j: w, t: info2.lastBad, slice, padded})
        : null;
      const exp = letters
        ? await look({limit: wave.length, letters, j: w, t: info2.since, slice, padded})
        : null;
      // Rule D scores the word in its ayah's text, split ayat included (hafsToken).
      const j = words ? hafsToken(key, w) : null;
      const fit = words && j < words.length ? await fitAt(key, j, info2.lastBad, words) : null;
      const fitSince = fit && Math.abs(info2.since - info2.lastBad) > 1e-6 ? await fitAt(key, j, info2.since, words) : null;
      const row = {
        key: `${m.run}|${m.id}|${m.t}`,
        cond,
        clip: m.run,
        speaker: speakerOf(m.run),
        stratum: clipInfo.stratum,
        weight: clipInfo.weight,
        id: m.id,
        word: m.word,
        since: info2.since,
        lastBad: info2.lastBad,
        shownAt: info2.shownAt,
        fed: limit / 16000,
        kind: info2.kind,
        state: verdict?.to ?? m.state,
        firstState: m.state,
        badInStreak: inStreak,
        gop: verdict?.d?.gop ?? null,
        distance: verdict?.d?.distance ?? null,
        heardRatio: verdict?.d?.heardRatio ?? null,
        place,
        label: m.label,
        errorClasses: m.errorClasses,
        segLabel: m.segment?.label ?? null,
        corrected: m.corrected,
        letters: letters ? [...letters[w]].length : null,
        app,
        exp,
        fit,
        fitSince,
        rules: {
          A: 'keep',
          B: ruleB(app),
          C: ruleC(app),
          D: ruleD(verdict?.to ?? m.state, place, fit?.expected, C.fit),
          E: ruleE(info2.kind, app),
        },
        atFirstVerdict: {B: ruleB(exp), C: ruleC(exp)},
      };
      fs.writeSync(fd, `${JSON.stringify(row)}\n`);
      written += 1;
    }
  }
  fs.closeSync(fd);
  appendTiming({
    stage: 'rules-worker',
    cond,
    written,
    modelRuns,
    msPerRun: modelRuns ? +(modelMs / modelRuns).toFixed(0) : null,
    wallSeconds: +((Date.now() - started) / 1000).toFixed(0),
    rssGb: +(process.memoryUsage().rss / 1e9).toFixed(2),
    at: new Date().toISOString(),
  });
  console.log(`${cond}: ${written} marks written, ${modelRuns} model runs`);
}

async function main() {
  const cond = arg('cond');
  if (!cond) throw new Error('usage: learners_rules.mjs --cond track:snr');
  if (process.argv.includes('--worker')) {
    await worker(cond);
    return;
  }
  const started = Date.now();
  const before = machine();
  for (;;) {
    const code = await new Promise(resolve => {
      const p = spawn(process.execPath, [...process.argv.slice(1), '--worker'], {
        env: {...process.env, ORT_THREADS: '1', ORT_ARENA: '0'},
        stdio: 'inherit',
      });
      for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => p.kill(signal));
      p.on('close', c => resolve(c));
    });
    if (code === RESTART) continue;
    if (code !== 0) process.exit(code ?? 1);
    break;
  }
  const rows = readJsonl(rowsFile(cond));
  const marks = readJsonl(marksFile(cond));
  appendTiming({
    stage: 'rules',
    cond,
    rows: rows.length,
    marks: marks.length,
    wallSeconds: +((Date.now() - started) / 1000).toFixed(0),
    before,
    after: machine(),
    at: new Date().toISOString(),
  });
  console.log(`${cond}: ${rows.length} rows of ${marks.length} marks, ${((Date.now() - started) / 1000).toFixed(0)} s`);
  if (!arg('limit-clips') && rows.length !== marks.length) process.exit(1);
}

await main();
