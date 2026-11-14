/* eslint-env node, es2020 */
// The saved none_0 runs as the baseline runs were: the frozen QuranMB results read runs that
// hold no tracker frames and no stop flags on their log lines, so slices there come from the
// cursor. This writes each none_0 run with those two things taken out, under
// .out/chatter/learners_built/parity_runs, after checking the rest against the baseline run.
// Deleted once the parity check is done. It holds no audio. With --cursor it writes each
// condition's runs with the tracker's frames alone taken out, for the check on how far the
// results lean on those frames, under .out/chatter/learners_built/cursor_runs.
//   node chatter/learners_built_parity_input.mjs [--cursor]
import fs from 'node:fs';
import path from 'node:path';
import {BENCH, CONDS, CURSOR_RUNS, PARITY_RUNS, RUNS, fileOf} from './learners_built_lib.mjs';

const BASE = path.join(BENCH, '.out/real3/quranmb');
const FROM = path.join(RUNS, 'none_0/quranmb');
const LOG_FIELDS = ['t', 'type', 'event', 'at', 'w', 'n'];

/** A saved run with the tracker's frames and the stop flags taken out. */
export function asBaseline(run) {
  const {flush: _flush, ...rest} = run;
  return {
    ...rest,
    log: run.log.map(e => {
      const {stop: _stop, ...keep} = e;
      return keep;
    }),
  };
}

const logView = log =>
  JSON.stringify(
    log.map(e => [
      ...LOG_FIELDS.map(k => e[k] ?? null),
      e.type === 'word_progress' ? e.key : null,
    ]),
  );

if (process.argv.includes('--cursor')) {
  for (const c of CONDS) {
    const from = path.join(RUNS, c, 'quranmb');
    const to = path.join(CURSOR_RUNS, c);
    fs.mkdirSync(to, {recursive: true});
    const names = fs.readdirSync(from).filter(f => f.endsWith('.json'));
    for (const f of names) {
      const {flush: _flush, ...rest} = JSON.parse(fs.readFileSync(path.join(from, f), 'utf8'));
      fs.writeFileSync(path.join(to, f), JSON.stringify(rest));
    }
    console.log(JSON.stringify({cond: c, takes: names.length}));
  }
  process.exit(0);
}
fs.mkdirSync(PARITY_RUNS, {recursive: true});
const files = fs.readdirSync(FROM).filter(f => f.endsWith('.json')).sort();
let differs = 0;
for (const f of files) {
  const run = JSON.parse(fs.readFileSync(path.join(FROM, f), 'utf8'));
  const base = JSON.parse(fs.readFileSync(path.join(BASE, f), 'utf8'));
  const out = asBaseline(run);
  const same =
    JSON.stringify(out.vchanges) === JSON.stringify(base.vchanges) &&
    logView(out.log) === logView(base.log) &&
    out.summary.seconds === base.summary.seconds &&
    JSON.stringify(out.flags.map(x => [x.kind, x.key])) ===
      JSON.stringify(base.flags.map(x => [x.kind, x.key]));
  if (!same) {
    differs += 1;
    console.log(`differs from the baseline run: ${f}`);
  }
  if (f !== fileOf(run.clip.id)) throw new Error(`file name: ${f}`);
  fs.writeFileSync(path.join(PARITY_RUNS, f), JSON.stringify(out));
}
console.log(JSON.stringify({takes: files.length, differsFromBaseline: differs}));
if (differs) process.exitCode = 1;
