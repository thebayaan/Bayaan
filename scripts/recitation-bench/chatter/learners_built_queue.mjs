/* eslint-env node, es2020 */
// Runs the judge's rows at both holds and then the chains for the named suites: at most 2
// processes at a time, each under nice -n 10 with one ONNX thread and the arena off. A process
// that exits 75 hit its memory limit and starts again; it resumes where it stopped. Waits
// before each job while swap is above 12 GB or free disk under 15 GB. A job that fails, a mix
// hash that differs for one, stops its condition and leaves the others running.
//   node chatter/learners_built_queue.mjs <suite> [<suite> ...]
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {machine} from './learners_lib.mjs';
import {OUT, SUITES, withinLimits} from './learners_built_lib.mjs';
import {jobsOf} from './learners_built_stats.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const WORKERS = 2;
const suites = process.argv.slice(2);
for (const s of suites) if (!SUITES[s]) throw new Error(`no suite ${s}`);

fs.mkdirSync(path.join(OUT, 'logs'), {recursive: true});
const log = fs.createWriteStream(path.join(OUT, 'logs/queue.log'), {flags: 'a'});
const say = line => {
  const text = `${new Date().toISOString()} ${line}`;
  log.write(`${text}\n`);
  console.log(text);
};

const jobs = jobsOf(suites);
const state = new Map(jobs.map(j => [j.id, 'waiting']));
const children = new Set();
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    for (const c of children) c.kill(signal);
    process.exit(1);
  });
}
const env = {...process.env, ORT_THREADS: '1', ORT_ARENA: '0'};
delete env.WORD_MARKS;
delete env.LEARNERS_OUT;

const once = job =>
  new Promise(resolve => {
    const [tool, ...rest] = job.args;
    const p = spawn('nice', ['-n', '10', 'node', path.join(HERE, tool), ...rest], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.add(p);
    p.stdout.on('data', d => log.write(d));
    p.stderr.on('data', d => log.write(d));
    p.on('close', code => {
      children.delete(p);
      resolve(code);
    });
  });

async function waitForLimits() {
  let m = machine();
  let told = false;
  while (!withinLimits(m)) {
    if (!told) say(`waiting: swap ${m.swapGb} GB, free disk ${m.freeGb} GB`);
    told = true;
    await new Promise(r => setTimeout(r, 30000));
    m = machine();
  }
  return m;
}

function nextJob() {
  for (const j of jobs) {
    if (state.get(j.id) !== 'waiting') continue;
    if (j.after.some(a => state.get(a) === 'failed')) {
      state.set(j.id, 'failed');
      say(`skip ${j.id}: a job it needs failed`);
      continue;
    }
    if (j.after.every(a => state.get(a) === 'done')) return j;
  }
  return null;
}
const unfinished = () =>
  jobs.some(j => ['waiting', 'running'].includes(state.get(j.id)));

async function worker() {
  while (unfinished()) {
    const j = nextJob();
    if (!j) {
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
    state.set(j.id, 'running');
    const m = await waitForLimits();
    say(`start ${j.id} swap ${m.swapGb} GB, free ${m.freeGb} GB`);
    let code = await once(j);
    while (code === 75) code = await once(j);
    state.set(j.id, code === 0 ? 'done' : 'failed');
    say(`end ${j.id} ${code}`);
  }
}
await Promise.all(Array.from({length: WORKERS}, worker));
const failed = jobs.filter(j => state.get(j.id) === 'failed').map(j => j.id);
say(failed.length ? `queue done, failed: ${failed.join(', ')}` : 'queue done, 0 failed');
log.end();
if (failed.length) process.exitCode = 1;
