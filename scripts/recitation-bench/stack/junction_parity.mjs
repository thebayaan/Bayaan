/* eslint-env node, es2020 */
// Marks on the verifier's combined-engine runs under the junction part of the rules, with
// its 'said' correction. WORD_MARKS picks the rules. One line per run, in order.
//   WORD_MARKS=<file> node junction_parity.mjs <out.jsonl> <dir> [<dir> ...]
import fs from 'node:fs';
import path from 'node:path';
const BENCH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
);
const {replay} = await import(path.join(BENCH, 'natural/replay.mjs'));
const words = JSON.parse(
  fs.readFileSync(
    path.join(BENCH, '.out/natural/manifests/engine_words.json'),
    'utf8',
  ),
);
const wordCount = (s, a) => words[`${s}:${a}`];
// As combine_rows.mjs: 'said' only on skipped verdicts, no new verdict when nothing changed.
const quiet = run => ({
  ...run,
  vchanges: run.vchanges
    .filter(
      c =>
        !(
          c.d?.junctionMissing === false &&
          c.from === c.to &&
          c.to !== 'skipped' &&
          !c.stop
        ),
    )
    .map(c =>
      c.d?.junctionMissing === false && c.to !== 'skipped'
        ? {...c, d: {...c.d, junctionMissing: undefined}}
        : c,
    ),
});
const [out, ...dirs] = process.argv.slice(2);
const fd = fs.openSync(out, 'w');
let runs = 0,
  marks = 0,
  unsaid = 0;
for (const dir of dirs) {
  for (const f of fs
    .readdirSync(dir)
    .filter(n => n.endsWith('.json'))
    .sort()) {
    const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const {visible} = replay(quiet(run), {mode: 'app', wordCount});
    const rows = [...visible].map(([id, m]) => [
      id,
      m.kind,
      m.since,
      m.shownAt,
      m.corrected,
    ]);
    fs.writeSync(
      fd,
      JSON.stringify({f: `${path.basename(dir)}/${f}`, rows}) + '\n',
    );
    runs += 1;
    marks += rows.length;
    unsaid +=
      run.vchanges.filter(
        c => c.d?.junctionMissing === true && !c.stop && c.from !== 'ok',
      ).length > 0
        ? 1
        : 0;
  }
}
fs.closeSync(fd);
console.log(
  JSON.stringify({
    rules: process.env.WORD_MARKS ?? 'services',
    runs,
    marks,
    runsWithUnsaid: unsaid,
  }),
);
