/* eslint-env node, es2020 */
// Runs a natural-benchmark manifest through bench.mjs, up to 8 processes at
// once, one ONNX thread each. Already finished clips are skipped, so it resumes.
//
//   node natural/run_suite.mjs <manifest.json> <outdir> [--jobs 8]
//       [--minutes-per-process 40]
//
// A bench process grows with every sound it hears, to about 3 GB over a long list,
// and swap comes out of the disk. So each process hears a limited amount of audio
// and the next one takes over, which does not change results: clips are independent.
//
// TILAWA_DIST and ENGINE_OPTS pass through to bench.mjs (an engine variant).
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const BENCH = path.resolve(HERE, '../bench.mjs');
const [manifestFile, outdir] = process.argv.slice(2);
if (!manifestFile || !outdir) {
  throw new Error('usage: run_suite.mjs <manifest.json> <outdir> [--jobs N]');
}
const jobsAt = process.argv.indexOf('--jobs');
const jobs = Math.min(8, Number(jobsAt > 0 ? process.argv[jobsAt + 1] : 8));
const minutesAt = process.argv.indexOf('--minutes-per-process');
const maxSeconds = 60 * Number(minutesAt > 0 ? process.argv[minutesAt + 1] : 40);
const clips = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
fs.mkdirSync(outdir, {recursive: true});
const done = new Set(fs.readdirSync(outdir));
const todo = clips.filter(
  c => !done.has(`${String(c.id).replace(/[^\w.-]/g, '_')}.json`),
);
console.log(`${clips.length} clips, ${todo.length} to run, ${jobs} processes`);
if (!todo.length) process.exit(0);
const shardDir = path.join(outdir, '..', `.shards_${path.basename(outdir)}`);
fs.mkdirSync(shardDir, {recursive: true});
const shards = Array.from({length: jobs}, () => []);
todo.forEach((c, i) => shards[i % jobs].push(c));

const clipSeconds = clip =>
  (clip.parts ?? [clip]).reduce(
    (sum, p) =>
      sum + (p.audio && fs.existsSync(p.audio) ? fs.statSync(p.audio).size / 4 / 16000 : 0),
    0,
  );

/** Splits a shard so that no process hears more than maxSeconds of audio. */
function batches(shard) {
  const out = [[]];
  let seconds = 0;
  for (const clip of shard) {
    const length = clipSeconds(clip);
    if (out[out.length - 1].length && seconds + length > maxSeconds) {
      out.push([]);
      seconds = 0;
    }
    out[out.length - 1].push(clip);
    seconds += length;
  }
  return out;
}

// Stopping this runner stops its processes too, so a restart can't run on top of
// orphans and run clips twice.
const children = new Set();
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    for (const child of children) child.kill(signal);
    process.exit(1);
  });
}

function runProcess(file, i) {
  return new Promise((resolve, reject) => {
    const p = spawn('node', [BENCH, '--list', file, '--outdir', outdir], {
      env: {...process.env, ORT_THREADS: '1'},
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    children.add(p);
    p.on('close', () => children.delete(p));
    p.stdout.on('data', d => {
      const line = String(d).trim();
      if (line) console.log(`[${i}] ${line}`);
    });
    p.on('close', code =>
      code === 0 ? resolve() : reject(new Error(`shard ${i} exited ${code}`)),
    );
  });
}

async function runShard(shard, i) {
  let n = 0;
  for (const batch of batches(shard)) {
    const file = path.join(shardDir, `${i}_${n++}.json`);
    fs.writeFileSync(file, JSON.stringify(batch));
    await runProcess(file, i);
  }
}

// One shard failing must not leave the others running with nothing watching them.
const results = await Promise.allSettled(shards.filter(s => s.length).map(runShard));
const failed = results.filter(r => r.status === 'rejected');
if (failed.length) {
  console.error(failed.map(r => r.reason.message).join('; '));
  process.exit(1);
}
fs.rmSync(shardDir, {recursive: true, force: true});
const missing = clips.filter(
  c => !fs.existsSync(path.join(outdir, `${String(c.id).replace(/[^\w.-]/g, '_')}.json`)),
);
console.log(`finished; ${missing.length} clips without a result`);
