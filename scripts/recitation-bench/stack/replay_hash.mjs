/* eslint-env node, es2020 */
// natural/replay.mjs over saved runs: a hash of the visible marks, reasons and trail in
// all three modes, per folder. WORD_MARKS picks the rules; unset is services/.
//   node replay_hash.mjs <dir> [<dir> ...]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
for (const dir of process.argv.slice(2)) {
  const hash = crypto.createHash('sha256');
  const visibleOnly = crypto.createHash('sha256');
  let runs = 0,
    marks = 0;
  for (const f of fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort()) {
    const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const mode of ['app', 'flush', 'carry']) {
      const rep = replay(run, {mode, wordCount});
      hash.update(
        JSON.stringify({
          f,
          mode,
          visible: [...rep.visible],
          reasons: [...rep.reasons],
          trail: [...rep.trail],
        }),
      );
      visibleOnly.update(JSON.stringify({f, mode, visible: [...rep.visible]}));
      if (mode === 'app') marks += rep.visible.size;
    }
    runs += 1;
  }
  console.log(
    JSON.stringify({
      dir: path.relative(BENCH, dir),
      rules: process.env.WORD_MARKS ?? 'services',
      runs,
      appMarks: marks,
      all: hash.digest('hex'),
      visible: visibleOnly.digest('hex'),
    }),
  );
}
