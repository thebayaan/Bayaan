/* eslint-env node, es2020 */
// The app's port against the originals on made-up posteriors, far more of them than the
// goldens hold: services/recitation/secondLook/{ctc,judge,slice}.ts, compiled as they
// ship, against judge/judge.mjs, judge/policy.mjs, rule.mjs and lib.mjs. Loads no model.
//   node scripts/second-look/check_port.mjs [trials]
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(ROOT, 'scripts/recitation-bench/.out/second-look/repro');
fs.mkdirSync(OUT, {recursive: true});
const require = createRequire(path.join(ROOT, 'package.json'));
const esbuild = require('esbuild');
const entry = path.join(OUT, 'port_entry.ts');
fs.writeFileSync(
  entry,
  `export * from '${ROOT}/services/recitation/secondLook/ctc';
export * from '${ROOT}/services/recitation/secondLook/judge';
export * from '${ROOT}/services/recitation/secondLook/slice';
`,
);
const outfile = path.join(OUT, 'port.mjs');
await esbuild.build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'warning',
});
const port = await import(outfile);
const {judgeWord, tokensOf} = await import(
  path.join(ROOT, 'scripts/recitation-bench/judge/judge.mjs')
);
const {answer} = await import(
  path.join(ROOT, 'scripts/recitation-bench/judge/policy.mjs')
);
const {firstPass, innerGap, paddedCut} = await import(
  path.join(HERE, 'rule.mjs')
);
const {POLICIES} = await import(path.join(HERE, 'chain.mjs'));

const TRIALS = Number(process.argv[2] ?? 3000);
const VOCAB = 31;
const LETTERS = 'ءابتثجحخدذرزسشصضطظعغفقكلمنهوي';
let seed = 20261106;
const rand = () => {
  seed = (Math.imul(seed, 1103515245) + 12345) | 0;
  return ((seed >>> 16) & 0x7fff) / 32768;
};
const pick = n => Math.floor(rand() * n);
const word = () => {
  let out = '';
  const n = 1 + pick(7);
  for (let i = 0; i < n; i++) out += LETTERS[pick(29)];
  return out;
};
const differ = {judge: 0, pass: 0, answer: 0, gap: 0, cut: 0};
const samples = [];
const seen = (name, a, b, trial) => {
  differ[name] += 1;
  if (samples.length < 5) samples.push({name, trial, a, b});
};
const answers = {};
const wave = new Float32Array(48000).map((_, i) => Math.sin(i / 7) * 0.1);
for (let trial = 0; trial < TRIALS; trial++) {
  const n = 1 + pick(6);
  const words = Array.from({length: n}, word);
  const j = pick(n);
  const mut = Array.from({length: pick(5)}, word);
  // What was said: the text, or part of it, or something else, with some noise.
  const said = [];
  for (const w of words) {
    if (rand() < 0.75) said.push(rand() < 0.8 ? w : word());
  }
  if (rand() < 0.3) said.unshift(word(), word());
  const tokens = [];
  said.forEach((w, i) => {
    if (i) tokens.push(30);
    tokens.push(...tokensOf(w));
  });
  const sequence = new Array(pick(4)).fill(0);
  for (const t of tokens) {
    for (let k = 0; k <= pick(3); k++) sequence.push(t);
    if (rand() < 0.8) sequence.push(0);
  }
  for (let k = pick(70); k > 0; k--) sequence.push(0);
  const frames = Math.max(1, sequence.length);
  const logp = new Float32Array(frames * VOCAB);
  for (let t = 0; t < frames; t++) {
    for (let v = 0; v < VOCAB; v++) {
      logp[t * VOCAB + v] =
        v === sequence[t] ? -0.05 - rand() * 2 : -3 - rand() * 8;
    }
  }
  const opts = {leftWords: 2, rightWords: rand() < 0.8 ? 0 : 1, top: 3};
  const original = judgeWord(logp, frames, words, j, {mut, near: []}, opts);
  const mine = port.judgeWord(logp, frames, words, j, mut, opts);
  const score = r => r.mut.map(m => m.s);
  if (
    original.expected !== mine.expected ||
    original.nothing !== mine.nothing ||
    JSON.stringify(score(original)) !== JSON.stringify(score(mine))
  ) {
    seen('judge', original, mine, trial);
  }
  const pass = firstPass(logp, frames, words, j, {
    leftWords: opts.leftWords,
    rightWords: opts.rightWords,
    firstWithin: 50,
  });
  if (
    pass &&
    (pass.expected !== mine.exact ||
      pass.perLetter !== mine.perLetter ||
      pass.startFrame !== mine.startFrame ||
      pass.endFrame !== mine.endFrame)
  ) {
    seen('pass', pass, mine, trial);
  }
  if (!pass && mine.startFrame >= 0) seen('pass', pass, mine, trial);
  const a = answer({r: {...original, near: []}}, POLICIES.S1);
  answers[a] = (answers[a] ?? 0) + 1;
  if (a !== port.judgeAnswer(mine)) seen('answer', a, mine, trial);
  const written = tokensOf(words[j]);
  const g = innerGap(logp, frames, written);
  const h = port.innerGap(logp, frames, written);
  if (g !== h) seen('gap', g, h, trial);
  const from = rand() * 3;
  const to = from + rand();
  const limit = pick(60000);
  const cut = paddedCut(wave, from, to, limit);
  const range = port.paddedRange(from, to, limit, wave.length);
  const same =
    (cut === null && range === null) ||
    (cut !== null &&
      range !== null &&
      cut.length === range.end - range.start + 32000 &&
      port
        .withSilence(wave.subarray(range.start, range.end))
        .every((v, i) => v === cut[i]));
  if (!same) seen('cut', cut?.length, range, trial);
}
console.log(JSON.stringify({trials: TRIALS, answers, differ, samples}));
process.exit(Object.values(differ).some(Boolean) ? 1 : 0);
