/* eslint-env node, es2020 */
// Does rule.mjs give the letter-slip experiment's own numbers? Reads the experiment's stored
// log-probabilities (0.01 nat steps) and features; loads no model.
//   node scripts/second-look/check_rule_port.mjs <experiment out dir>
import fs from 'node:fs';
import path from 'node:path';
import {firstPass, innerGap, cancelAnswer} from './rule.mjs';
import {tokensOf} from '../recitation-bench/judge/judge.mjs';

const OUTDIR = process.argv[2];
const BENCH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../recitation-bench',
);
const index = JSON.parse(
  fs.readFileSync(path.join(BENCH, '.out/natural/judge/index.json'), 'utf8'),
);
const VOCAB = 31;
const reader = name => {
  const fd = fs.openSync(path.join(OUTDIR, `${name}.bin`), 'r');
  return (at, frames) => {
    const bytes = frames * VOCAB * 2;
    const b = Buffer.allocUnsafe(bytes);
    fs.readSync(fd, b, 0, bytes, at);
    const i16 = new Int16Array(
      b.buffer.slice(b.byteOffset, b.byteOffset + bytes),
    );
    return Float32Array.from(i16, v => v / 100);
  };
};
const rowsOf = name =>
  fs
    .readFileSync(path.join(OUTDIR, `${name}.jsonl`), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l));
for (const name of ['marks', 'pro']) {
  const rows = rowsOf(name);
  const x = new Map(rowsOf(`${name}_x`).map(r => [r.key, r]));
  const feat = new Map(rowsOf(`${name}.feat`).map(r => [r.key, r]));
  const read = reader(name);
  const readX = reader(`${name}_x`);
  let n = 0;
  let firstOff = 0;
  let gapOff = 0;
  let spanOff = 0;
  let answerOff = 0;
  let worstFirst = 0;
  let worstGap = 0;
  for (const r of rows) {
    const [s, a] = r.id.split(':');
    const words = index.ayat[`${s}:${a}`].map(w => w.l);
    const logp = read(r.at, r.frames);
    const f = firstPass(logp, r.frames, words, r.j, {
      leftWords: 2,
      rightWords: 1,
    });
    const stored = feat.get(r.key);
    const c = x.get(r.key)?.cuts?.p30;
    const tokens = tokensOf(r.L);
    const gap = c ? innerGap(readX(c.at, c.frames), c.frames, tokens) : null;
    n += 1;
    const dF = Math.abs(f.perLetter - stored.f_perLetter);
    worstFirst = Math.max(worstFirst, dF);
    if (dF > 0.002) firstOff += 1;
    if (f.startFrame !== r.ts[0] || f.endFrame !== r.exit) spanOff += 1;
    if (Number.isFinite(stored.p30f_gapSub)) {
      const dG = Math.abs(gap - stored.p30f_gapSub);
      worstGap = Math.max(worstGap, dG);
      if (dG > 0.002) gapOff += 1;
    } else if (gap !== null) gapOff += 1;
    const theirs =
      stored.f_perLetter <= -6 ||
      (Number.isFinite(stored.p30f_gapSub) && stored.p30f_gapSub <= -3.34)
        ? 'keep'
        : 'cancel';
    if (cancelAnswer({first: f.perLetter, gap}) !== theirs) answerOff += 1;
  }
  console.log(
    JSON.stringify({
      set: name,
      rows: n,
      firstOff,
      gapOff,
      spanOff,
      answerOff,
      worstFirst: +worstFirst.toFixed(4),
      worstGap: +worstGap.toFixed(4),
    }),
  );
}
