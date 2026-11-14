/* eslint-env node, es2020 */
// Runs one condition of the test of real slips under voices through the bench, the
// way the clean baseline was run (same engine, same options), and labels its marks
// with score_real.mjs itself. Mixed audio exists only while the condition runs, and
// finished takes are skipped, so it resumes.
//
//   node chatter/learners_run.mjs --cond one_ar:10 [--jobs 3] [--limit N]
//
// A condition is track:snr, as in chatter/README.md. Takes also keep the tracker's
// word frames at their end (`flush`), which rule D's slice reads. That is written
// after the take's verdicts are done; none:0 shows it changes none of them.
//
// The engine is a pinned copy of the one the baseline ran on (TILAWA_DIST), so another
// job changing node_modules cannot change a condition halfway through. The run stops
// if the copy is not that engine.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {activeLevelDb} from './mix.mjs';
import {
  BASELINE_ENGINE_SHA,
  BENCH,
  OUT,
  PINNED_ENGINE,
  ROOT,
  SR,
  WORD_MARKS_FROZEN,
  appendTiming,
  condName,
  freezeWordMarks,
  hashF32,
  learnerSegment,
  loadClips,
  machine,
  marksFile,
  md5,
  mixOf,
  resultName,
  runDir,
  runRoot,
  sha256Dir,
  sha256File,
  withinLimits,
  writeF32,
} from './learners_lib.mjs';

const arg = name => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};

/** The level difference on the learner's own stretch, which the take-wide mix sets only roughly. */
function learnerSnr(clip, audio, window, gain) {
  if (!window) return null;
  const seg = learnerSegment(clip);
  const a = Math.round(seg.start * SR);
  const b = Math.round(seg.end * SR);
  const speech = activeLevelDb(audio.subarray(a, b));
  const voice = activeLevelDb(window.subarray(a, b)) + 20 * Math.log10(gain);
  return Number.isFinite(speech - voice) ? +(speech - voice).toFixed(2) : null;
}

function buildManifest(cond, clips, mixDir, dir) {
  const manifest = [];
  for (const clip of clips) {
    if (fs.existsSync(path.join(dir, resultName(clip.id)))) continue;
    const {audio, window, mix, info} = mixOf(clip.audio, clip.id, cond);
    const file = path.join(mixDir, `${md5(clip.id)}.f32`);
    writeF32(file, mix);
    const {stratum: _stratum, weight: _weight, ...rest} = clip;
    manifest.push({
      ...rest,
      audio: file,
      sourceAudio: clip.audio,
      flush: true,
      mix: {...info, md5: hashF32(mix), learnerSnrDb: learnerSnr(clip, audio, window, info.gain)},
    });
  }
  return manifest;
}

function child(command, args, env, stdout) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, {env: {...process.env, ...env}, stdio: ['ignore', stdout, 'inherit']});
    for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => p.kill(signal));
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`${path.basename(args[0])} exited ${code}`))));
  });
}

async function main() {
  const cond = arg('cond');
  if (!cond) throw new Error('usage: learners_run.mjs --cond track:snr [--jobs 3] [--limit N]');
  const jobs = Math.min(3, Number(arg('jobs') ?? 3));
  const before = machine();
  if (!withinLimits(before)) {
    console.error(`not starting ${cond}: swap ${before.swapGb} GB, free disk ${before.freeGb} GB`);
    process.exit(2);
  }
  if (process.env.ENGINE_OPTS || process.env.BENCH_PROBE) throw new Error('this test runs the engine with its plain options');
  const dist = process.env.TILAWA_DIST ?? PINNED_ENGINE;
  const engineSha = sha256Dir(dist);
  if (!engineSha.startsWith(BASELINE_ENGINE_SHA)) throw new Error(`not the baseline's engine: ${dist} is ${engineSha}`);
  const wordMarksSha = freezeWordMarks();
  let clips = loadClips();
  if (arg('limit')) clips = clips.slice(0, Number(arg('limit')));
  const name = condName(cond);
  const dir = runDir(cond);
  const mixDir = path.join(OUT, 'mix', name);
  fs.mkdirSync(dir, {recursive: true});
  fs.mkdirSync(mixDir, {recursive: true});
  const startedAt = Date.now();
  const manifest = buildManifest(cond, clips, mixDir, dir);
  const log = fs.openSync(path.join(OUT, `bench.${name}.log`), 'a');
  if (manifest.length) {
    const file = path.join(mixDir, 'manifest.json');
    fs.writeFileSync(file, JSON.stringify(manifest));
    await child('node', [path.join(BENCH, 'natural/run_suite.mjs'), file, dir, '--jobs', String(jobs)], {ORT_THREADS: '1', TILAWA_DIST: dist}, log);
  }
  fs.rmSync(mixDir, {recursive: true, force: true});
  const benchSeconds = (Date.now() - startedAt) / 1000;
  await child(
    'node',
    [path.join(BENCH, 'score_real.mjs'), '--runs', runRoot(cond), '--marks', marksFile(cond), '--json', path.join(OUT, `summary.${name}.json`), 'quranmb'],
    {WORD_MARKS: WORD_MARKS_FROZEN},
    fs.openSync(path.join(OUT, `score.${name}.txt`), 'w'),
  );
  const done = clips.filter(c => fs.existsSync(path.join(dir, resultName(c.id)))).length;
  appendTiming({
    stage: 'bench',
    cond,
    takes: manifest.length,
    done,
    of: clips.length,
    minutes: +(manifest.reduce((n, c) => n + c.seconds, 0) / 60).toFixed(1),
    wallSeconds: +benchSeconds.toFixed(0),
    jobs,
    before,
    after: machine(),
    at: new Date().toISOString(),
    wordMarksSha,
    wordMarksSourceSha: sha256File(path.join(ROOT, 'services/recitation/wordMarks.ts')),
    benchSha: sha256File(path.join(BENCH, 'bench.mjs')),
    engineSha: sha256Dir(dist),
    engineDist: dist,
    nodeModulesEngineSha: sha256Dir(path.join(ROOT, 'node_modules/@tilawa/core/dist')),
  });
  console.log(`${cond}: ${done}/${clips.length} takes, ${benchSeconds.toFixed(0)} s`);
  if (done !== clips.length) process.exit(1);
}

await main();
