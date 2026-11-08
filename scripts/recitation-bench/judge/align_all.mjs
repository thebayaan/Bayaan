/* eslint-env node, es2020 */
// Runs quran-asr-small on every staged recording of the natural benchmark, whole
// and alone, and aligns what the reciter said (QUA's recited text in official
// letters) to find each word's time. No engine output anywhere in this file.
//
//   node judge/align_all.mjs [--shard i/n]
//
// Writes .out/natural/judge/align/<shard>.jsonl, one row per recording. Resumes,
// and stops itself at a memory limit, so run it until it prints `done`.
import fs from 'node:fs';
import path from 'node:path';
import {loadModel, loadTokens, greedy, readF32} from './model.mjs';
import {relativeTo, alignWords} from './ctc.mjs';
import {tokensOf} from './judge.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, '../.out/natural/judge');
const AUDIO = path.join(HERE, '../.out/natural/audio');
const [iShard, nShard] = (process.argv[process.argv.indexOf('--shard') + 1] ?? '0/1').split('/').map(Number);
const index = JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8'));
const recited = JSON.parse(fs.readFileSync(path.join(OUT, 'recited.json'), 'utf8'));
const FRAME = 0.04;
const MAX_RSS = 2.5 * 1024 ** 3;

const jobs = [];
for (const [slug, rows] of Object.entries(recited)) {
  for (const [key, row] of Object.entries(rows)) {
    if (row.map) jobs.push({slug, key, row});
  }
}
const mine = jobs.filter((_, i) => i % nShard === iShard);
fs.mkdirSync(path.join(OUT, 'align'), {recursive: true});
const outFile = path.join(OUT, 'align', `${iShard}.jsonl`);
const done = new Set();
if (fs.existsSync(outFile)) {
  for (const line of fs.readFileSync(outFile, 'utf8').split('\n')) {
    if (!line) continue;
    const r = JSON.parse(line);
    done.add(`${r.slug}|${r.key}`);
  }
}
const out = fs.openSync(outFile, 'a');
const model = await loadModel();
const tokens = loadTokens();
let n = 0;
for (const {slug, key, row} of mine) {
  if (done.has(`${slug}|${key}`)) continue;
  const [s, a] = key.split(':');
  const wave = readF32(path.join(AUDIO, slug, `${s}_${a}.f32`));
  const t0 = performance.now();
  const r = await model.run(wave);
  const ms = performance.now() - t0;
  const rel = relativeTo(r.logp, r.frames);
  const letters = index.ayat[key].map(x => x.l);
  const said = row.map.map(j => letters[j]);
  const words = alignWords(rel, r.frames, said.map(tokensOf));
  const g = greedy(r.logp, r.frames, tokens);
  fs.writeSync(
    out,
    JSON.stringify({
      slug,
      key,
      seconds: +(wave.length / 16000).toFixed(3),
      frames: r.frames,
      ms: +ms.toFixed(1),
      restarts: row.restarts,
      score: +words.score.toFixed(2),
      map: row.map,
      times: words.map(w => [+(w.start * FRAME).toFixed(2), +((w.end + 1) * FRAME).toFixed(2)]),
      greedy: g.text,
      said: said.join(' '),
    }) + '\n',
  );
  n += 1;
  if (n % 200 === 0) console.log(`shard ${iShard}: ${n}/${mine.length}`);
  // Long recordings grow the runtime's memory arena and it stays grown. Past the
  // limit, stop here; run again to carry on (finished recordings are skipped).
  if (process.memoryUsage().rss > MAX_RSS) {
    console.log(`shard ${iShard} stopping at ${n} new: memory limit, run again to resume`);
    process.exit(0);
  }
}
console.log(`shard ${iShard} done: ${n} new of ${mine.length}`);
