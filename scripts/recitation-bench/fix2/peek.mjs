/* eslint-env node, es2020 */
// What the checker model reads in one window of a staged recitation, as letter numbers
// (1-29 in the checker's table, common.mjs), never letters:
//
//   node fix2/peek.mjs <name> <from> <to> [<surah:ayah> ...] [--audio <f32>] [--check <dir>]
//
// <from> and <to> are log-mel frames (100 a second) of the engine's own features for
// .out/fix2/qdc/<name>.f32 (or --audio), as sim.mjs's plans and trace lines give them.
// Prints the words the model heard ([letter numbers]@first frame-frame its last letter
// first showed, in model frames of 40 ms from the window's start), the written words of
// each <surah:ayah> named, and the mean log-mel energy of each model frame. The reading
// comes from the check's reading.ts (--check <dir>, default the repo's liveCheck).
import path from 'node:path';
import {loadModel} from './model.mjs';
import {buildLive} from './build_live.mjs';
import {
  BINS,
  QDC,
  ayahWords,
  engineFrames,
  parseArgs,
  readF32,
  tokensOf,
} from './common.mjs';

const args = parseArgs();
const [name, fromS, toS, ...keys] = args._;
if (!name || !/^\d+$/.test(fromS ?? '') || !/^\d+$/.test(toS ?? '')) {
  console.error(
    'usage: node fix2/peek.mjs <name> <from> <to> [<surah:ayah> ...] [--audio <f32>] [--check <dir>]',
  );
  process.exit(2);
}
const built = buildLive(args.check);
const {read} = await import(path.join(path.dirname(built.file), 'reading.mjs'));
const audio = readF32(args.audio ?? path.join(QDC, `${name}.f32`));
const {rows} = await engineFrames(audio);
const from = Number(fromS);
const to = Math.min(Number(toS), rows.length);
if (from >= to) {
  console.error(`empty window: ${from}-${to} of ${rows.length} frames`);
  process.exit(2);
}
const mel = new Float32Array((to - from) * BINS);
for (let i = from; i < to; i++) {
  mel.set(rows[i], (i - from) * BINS);
}
const model = await loadModel();
const out = await model.runFrames(mel, to - from);
const r = read(out.logp, out.frames);
// Four log-mel frames to a model frame.
const energy = [];
for (let f = 0; f < out.frames; f++) {
  let sum = 0;
  let n = 0;
  for (let m = f * 4; m < Math.min((f + 1) * 4, to - from); m++) {
    for (let b = 0; b < BINS; b++) {
      sum += rows[from + m][b];
    }
    n += BINS;
  }
  energy.push(n ? sum / n : 0);
}
console.log(`window mel ${from}-${to} frames ${out.frames}`);
console.log(
  'heard:',
  r.words.map(h => `[${h.ids.join(',')}]@${h.from}-${h.at}`).join(' '),
);
for (const k of keys) {
  console.log(
    `written ${k}:`,
    (ayahWords(k) ?? []).map(w => `[${tokensOf(w).join(',')}]`).join(' '),
  );
}
console.log('energy:', energy.map(e => e.toFixed(0)).join(' '));
