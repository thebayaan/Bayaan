/* eslint-env node, es2020 */
// What the second-look tools need to read these runs, from outside their frozen files: the
// frozen lib.mjs with this job's suites registered in its SUITES table, and these replaced
//   OUT, rowFile, loadRows   results go under .out/chatter/learners_built
//   gate                     this job's limits: swap at most 12 GB, free disk at least 15 GB
//   audioOf                  the mix as learners_run.mjs and mixOf make it, checked against the
//                            hash recorded for what the engine heard; a mismatch throws
//   loadModel                the same model, with its run time added up for the cost table
// Mixed audio exists only in memory. Nothing here writes outside learners_built.
import fs from 'node:fs';
import path from 'node:path';
import {loadModel as loadPlainModel} from '../judge/model.mjs';
import {BENCH, SUITES, fileOf, suiteRunIds} from '../../second-look/lib.mjs';
import {hashF32, machine, mixOf} from './learners_lib.mjs';

export * from '../../second-look/lib.mjs';

export const OUT = path.join(BENCH, '.out/chatter/learners_built');
export const LEARNERS = path.join(BENCH, '.out/chatter/learners');
export const RUNS = path.join(LEARNERS, 'runs');
export const PARITY_RUNS = path.join(OUT, 'parity_runs');
export const CONDS = [
  'none_0',
  'one_ar_10',
  'crowd_10',
  'rec_one_10',
  'one_ar_5',
  'crowd_5',
  'rec_one_5',
];
export const suiteOf = cond => `lb_${cond}`;
export const PARITY_SUITE = 'lb_parity';
// The same conditions with the tracker's word frames hidden, so that slices come from the
// cursor alone: how far the results lean on frames read from the end of the take.
export const CURSOR_RUNS = path.join(OUT, 'cursor_runs');
export const cursorSuiteOf = cond => `lb_cursor_${cond}`;

const inDir = dir => id => path.join(dir, fileOf(id));
function register(name, dir) {
  SUITES[name] = {
    dir: inDir(dir),
    plain: inDir(dir),
    list: dir,
    modes: ['app'],
    learnerOnly: true,
  };
}
for (const c of CONDS) register(suiteOf(c), path.join(RUNS, c, 'quranmb'));
register(PARITY_SUITE, PARITY_RUNS);
for (const c of CONDS) register(cursorSuiteOf(c), path.join(CURSOR_RUNS, c));

export const rowFile = (name, hold) =>
  path.join(OUT, 'rows', `${name}.h${Math.round(hold * 100)}.jsonl`);

/** lib.mjs's loadRows, reading this job's rows. */
export function loadRows(name, hold) {
  const ids = new Set(suiteRunIds(name));
  const file = rowFile(name, hold);
  const out = new Map();
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    const m = /^\{"run":"([^"]+)"/.exec(line);
    if (!m || !ids.has(m[1])) continue;
    let r;
    try {
      r = JSON.parse(line);
    } catch {
      continue;
    }
    let by = out.get(r.run);
    if (!by) out.set(r.run, (by = new Map()));
    by.set(`${r.id}|${r.t}|${r.src}`, r);
  }
  return out;
}

/** This job's limits. */
export const withinLimits = m => m.swapGb <= 12 && m.freeGb >= 15;

let lastGate = 0;
export async function gate(everyMs = 30000) {
  if (Date.now() - lastGate < everyMs) return;
  let m = machine();
  while (!withinLimits(m)) {
    await new Promise(r => setTimeout(r, 60000));
    m = machine();
  }
  lastGate = Date.now();
}

/**
 * The audio a saved run heard, rebuilt in memory, as learners_rules.mjs does it.
 * Stops on any difference from what the run recorded.
 */
export function audioOf(run) {
  const c = run.clip;
  const {mix, info} = mixOf(c.sourceAudio, c.id, `${c.mix.track}:${c.mix.snr}`);
  if (
    hashF32(mix) !== c.mix.md5 ||
    info.gain !== c.mix.gain ||
    info.scale !== c.mix.scale
  ) {
    throw new Error(`rebuilt mix differs from the one the engine heard: ${c.id}`);
  }
  return mix;
}

// ----------------------------------------------------------------------- the cost table

const started = Date.now();
const spent = {runs: 0, ms: 0, frames: 0};
const arg = name => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : null;
};

/** judge/model.mjs's model, adding up each run's onnxruntime time. */
export async function loadModel(...a) {
  const m = await loadPlainModel(...a);
  const plain = m.runFrames.bind(m);
  m.runFrames = async (data, frames) => {
    const r = await plain(data, frames);
    spent.runs += 1;
    spent.ms += r.ortMs;
    spent.frames += frames;
    return r;
  };
  return m;
}

// A tool run with --suite appends one line when it exits, a restart for memory included.
if (arg('suite')) {
  process.on('exit', code => {
    fs.mkdirSync(OUT, {recursive: true});
    fs.appendFileSync(
      path.join(OUT, 'timing.jsonl'),
      `${JSON.stringify({
        tool: path.basename(process.argv[1]),
        suite: arg('suite'),
        hold: arg('hold') === null ? null : Number(arg('hold')),
        code,
        runs: spent.runs,
        ortMs: +spent.ms.toFixed(1),
        melFrames: spent.frames,
        wallMs: Date.now() - started,
        at: new Date().toISOString(),
      })}\n`,
    );
  });
}
