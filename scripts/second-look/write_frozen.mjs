/* eslint-env node, es2020 */
// Records the sha256 of every file the frozen rule and its numbers rest on.
//   node scripts/second-look/write_frozen.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {BENCH, OUT} from './lib.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const sha = f =>
  crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const own = [
  'rule.mjs',
  'cancel.mjs',
  'chain.mjs',
  'lib.mjs',
  'replay_marks.mjs',
  'quranmb_labels.mjs',
  'select.mjs',
  'stats.mjs',
  'cancel_constants.npl.json',
  'judge_rows.mjs',
  'eval_marks.mjs',
  'tables.mjs',
  'voices_combined.mjs',
  'check_earlier.mjs',
  'check_rule_port.mjs',
  'live_close.py',
  'tables_md.mjs',
  'write_frozen.mjs',
  'run_voices_combined.sh',
  'run_queue.mjs',
  'run_all.sh',
  'jobs_rows.json',
  'jobs_eval.json',
  'RULE.md',
];
const bench = [
  'judge/ctc.mjs',
  'judge/judge.mjs',
  'judge/policy.mjs',
  'judge/model.mjs',
  'judge/fbank.mjs',
  'judge/judge_constants.json',
  'judge/engine_constants.npl.json',
  'added/rule.mjs',
  'added/lib.mjs',
  'natural/junction/decision.mjs',
  'natural/junction/llr.mjs',
  'chatter/mix.mjs',
  'chatter/run.mjs',
  '.out/natural/verify/wordMarks.combined.ts',
  '.out/natural/verify/probe.mjs',
  '.out/natural/judge/index.json',
  '.out/natural/qas/hf_004f898639f3127a74eac1b898a2cb3ef0b5268d/model.int8.onnx',
];
function distHash(dir) {
  const h = crypto.createHash('sha256');
  const walk = d => {
    for (const n of fs.readdirSync(d).sort()) {
      const f = path.join(d, n);
      if (fs.statSync(f).isDirectory()) walk(f);
      else h.update(`${path.relative(dir, f)}\n`).update(fs.readFileSync(f));
    }
  };
  walk(dir);
  return h.digest('hex');
}
const out = {
  rule: {
    step1: {cancel: 'P3', holdSeconds: 0.48},
    step2: {cancel: 'P4', holdSeconds: 0.48},
    switch: {
      cancelMay: ['all marks', 'skipped marks only'],
      default: 'all marks',
      chains: 'P3s and P4s in cancel.mjs',
    },
    constants: 'cancel_constants.npl.json',
    selection:
      'No candidate stood under the limits as select.mjs reads them. The freeze takes the candidate that misses the fewest limits. See RULE.md.',
  },
  note: 'The frozen rule is rule.mjs, cancel.mjs (candidate named in RULE.md) and chain.mjs with these constants. Nothing was tuned here; the test cells of the pool and W1 were never read.',
  own: Object.fromEntries(
    own
      .filter(f => fs.existsSync(path.join(HERE, f)))
      .map(f => [f, sha(path.join(HERE, f))]),
  ),
  bench: Object.fromEntries(bench.map(f => [f, sha(path.join(BENCH, f))])),
  combinedEngineDist: distHash(path.join(BENCH, '.out/natural/verify/dist')),
};
fs.writeFileSync(path.join(OUT, 'frozen.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
