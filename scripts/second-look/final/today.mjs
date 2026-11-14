/* eslint-env node, es2020 */
// Today's marks: the committed rules (git show HEAD:services/recitation/wordMarks.ts) on
// the committed engine's runs, through the bench's replay. Loads no model.
//   WORD_MARKS=.out/second-look/final/wordMarks.today.ts \
//     node scripts/second-look/final/today.mjs --suite <name>
// Writes one line per clip to .out/second-look/final/today/<suite>.jsonl.
import fs from 'node:fs';
import path from 'node:path';
import {BENCH, FINAL, SUITES, TODAY_RUNS, fileOf} from './suites.mjs';

if (!process.env.WORD_MARKS?.endsWith('wordMarks.today.ts'))
  throw new Error('WORD_MARKS must name the committed rules');
const {replay} = await import(path.join(BENCH, 'natural/replay.mjs'));

const args = {};
for (let i = 2; i < process.argv.length; i += 2)
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const name = args.suite;
const suite = SUITES[name];
const words = JSON.parse(
  fs.readFileSync(path.join(BENCH, '.out/natural/manifests/engine_words.json')),
);
const wordCount = (s, a) => words[`${s}:${a}`];
const MODES = [...(suite.modes ?? ['app'])];
const dir = path.join(FINAL, 'today');
fs.mkdirSync(dir, {recursive: true});
const out = fs.openSync(path.join(dir, `${name}.jsonl`), 'w');
let missing = 0;
let runs = 0;
const shownOf = visible =>
  [...visible.entries()].map(([id, m]) => ({
    id,
    k: m.kind,
    s: +m.since.toFixed(3),
    a: +m.shownAt.toFixed(3),
    c: m.corrected ? 1 : 0,
  }));
for (const clip of suite.clips()) {
  const file = suite.today
    ? suite.today(clip.id)
    : path.join(TODAY_RUNS, name, fileOf(clip.id));
  if (!fs.existsSync(file)) {
    missing += 1;
    continue;
  }
  const run = JSON.parse(fs.readFileSync(file, 'utf8'));
  const row = {id: clip.id, seconds: run.summary.seconds};
  for (const mode of MODES)
    row[mode] = shownOf(replay(run, {mode, wordCount}).visible);
  if (suite.dropLost) {
    const noLost = {
      ...run,
      log: run.log.filter(e => !(e.type === 'debug' && e.event === 'lost')),
    };
    row.noLost = shownOf(replay(noLost, {mode: 'app', wordCount}).visible);
  }
  // Verdicts as the app's first chunk would see them, to compare with the app's engine.
  row.verdicts = run.vchanges
    .filter(c => !c.stop)
    .map(c => `${c.t}|${c.id}|${c.to}`);
  fs.writeSync(out, `${JSON.stringify(row)}\n`);
  runs += 1;
}
fs.closeSync(out);
console.log(JSON.stringify({suite: name, runs, missing}));
