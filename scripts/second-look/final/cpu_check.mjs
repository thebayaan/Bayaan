/* eslint-env node, es2020 */
// CPU time of one check, step by step, on real wakes: the app's own judge, features and
// scoring, and the real second model with the options model.ts passes, one thread. Audio is
// the pool's and the voices'; no result on it is read here, only how long the work takes.
// Under `node --jitless` the JavaScript runs interpreted, the closest stand-in this Mac has
// for a phone's Hermes. It is a stand-in: no phone has run this.
//   node --jitless scripts/second-look/final/cpu_check.mjs [--checks 80] > out.json
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {audioOf} from '../lib.mjs';
import {BENCH, FINAL, SUITES} from './suites.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const args = {};
for (let i = 2; i < process.argv.length; i += 2)
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const CHECKS = Number(args.checks ?? 80);
const require = createRequire(path.join(ROOT, 'package.json'));
const REVISION = '004f898639f3127a74eac1b898a2cb3ef0b5268d';

// Compiled ahead with the JIT on: see --build.
const bundle = path.join(FINAL, 'bundles', 'cpu.mjs');
if (args.build) {
  const esbuild = require('esbuild');
  const entry = path.join(FINAL, 'bundles', 'cpu_entry.ts');
  const dir = 'services/recitation/secondLook';
  fs.writeFileSync(
    entry,
    ['judge', 'fbank', 'slice', 'alternatives', 'ayahLetters']
      .map(m => `export * from '${ROOT}/${dir}/${m}';`)
      .join('\n'),
  );
  await esbuild.build({
    entryPoints: [entry],
    outfile: bundle,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'warning',
    banner: {
      js: "import {createRequire as __cr} from 'node:module'; const require = __cr(import.meta.url);",
    },
  });
  console.log('built');
  process.exit(0);
}
const app = await import(bundle);
const ort = createRequire(path.join(BENCH, 'package.json'))('onnxruntime-node');
const {KaldiFbank} = await import(
  path.join(ROOT, 'node_modules/@tilawa/core/dist/recitation/fbank.js')
);
const session = await ort.InferenceSession.create(
  path.join(BENCH, `.out/natural/qas/hf_${REVISION}/model.int8.onnx`),
  {
    executionProviders: ['cpu'],
    intraOpNumThreads: 1,
    interOpNumThreads: 1,
    enableCpuMemArena: false,
    enableMemPattern: false,
  },
);
const cpu = async fn => {
  const a = process.cpuUsage();
  const value = await fn();
  const b = process.cpuUsage(a);
  return {value, ms: (b.user + b.system) / 1000};
};
const run = async (data, frames) => {
  const lens = new BigInt64Array(1);
  lens[0] = BigInt(frames);
  const out = await session.run({
    x: new ort.Tensor('float32', data, [1, frames, app.NUM_BINS]),
    x_lens: new ort.Tensor('int64', lens, [1]),
  });
  const length = Number(out.log_probs_len.data[0]);
  return {
    logp: out.log_probs.data.slice(0, length * out.log_probs.dims[2]),
    frames: length,
  };
};

// Real wakes: bad verdicts of the real pass on a few suites, seeded, spread over the list.
const wakes = [];
for (const name of ['pool', 'voices_one_ar_5', 'voices_rec_one_5', 'quranmb']) {
  const dir = path.join(FINAL, 'stream');
  const clips = new Map(SUITES[name].clips().map(c => [c.id, c]));
  for (const f of fs.readdirSync(dir)) {
    if (!f.startsWith(`${name}.`) || !f.endsWith('.jsonl')) continue;
    for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
      if (!line) continue;
      const r = JSON.parse(line);
      for (const [k, m] of r.msgs) {
        if (m.type !== 'word_verdicts') continue;
        for (const c of m.changes) {
          if (c.state === 'wrong' || c.state === 'skipped') {
            wakes.push({clip: clips.get(r.id), t: (k + 1) * 0.48, c});
          }
        }
      }
    }
  }
}
let seed = 20261106;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
for (let i = wakes.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [wakes[i], wakes[j]] = [wakes[j], wakes[i]];
}
const rows = [];
for (const wake of wakes) {
  if (rows.length >= CHECKS) break;
  const {c, t} = wake;
  const letters = app.ayahLetters(c.surah, c.ayah);
  if (!letters?.[c.word]) continue;
  const audio = audioOf({clip: wake.clip});
  const end = Math.min(audio.length, Math.round((t + 0.48) * 16000));
  const start = Math.max(0, end - 8 * 16000);
  if (end - start < 2 * 16000) continue;
  // The app reads these from the engine's ring: not part of the check's work.
  const piece = audio.subarray(start, end);
  const fbank = new KaldiFbank();
  const rowsMel = fbank.acceptWaveform(piece);
  const mel = new Float32Array(rowsMel.length * 80);
  rowsMel.forEach((row, i) => mel.set(row, i * 80));
  const first = await cpu(() => run(mel, rowsMel.length));
  const alternatives = app.alternativesOf(c.surah, c.ayah, c.word);
  const judged = await cpu(async () =>
    app.judgeWord(
      first.value.logp,
      first.value.frames,
      letters,
      c.word,
      alternatives,
    ),
  );
  const row = {
    alternatives: alternatives.length,
    sliceSeconds: piece.length / 16000,
    firstModel: first.ms,
    judge: judged.ms,
  };
  const j = judged.value;
  if (j.startFrame >= 0) {
    const cutStart = Math.max(
      0,
      start + Math.floor((j.startFrame * 0.04 - 0.3) * 16000),
    );
    const cutEnd = Math.min(
      end,
      start + Math.ceil(((j.endFrame + 1) * 0.04 + 0.3) * 16000),
    );
    if (cutEnd - cutStart >= 0.2 * 16000 && letters[c.word].length >= 3) {
      const wave = app.withSilence(audio.subarray(cutStart, cutEnd));
      const features = await cpu(() => app.fbankInSteps(wave));
      const padded = await cpu(() =>
        run(features.value.data, features.value.frames),
      );
      const gap = await cpu(async () =>
        app.innerGap(
          padded.value.logp,
          padded.value.frames,
          app.tokensOf(letters[c.word]),
        ),
      );
      Object.assign(row, {
        cutSeconds: wave.length / 16000,
        paddedFeatures: features.ms,
        paddedModel: padded.ms,
        paddedGap: gap.ms,
      });
    }
  }
  rows.push(row);
}
const stat = key => {
  const xs = rows
    .map(r => r[key])
    .filter(x => x !== undefined)
    .sort((a, b) => a - b);
  return {
    n: xs.length,
    median: +xs[xs.length >> 1].toFixed(1),
    p90: +xs[Math.floor(0.9 * xs.length)].toFixed(1),
    max: +xs[xs.length - 1].toFixed(1),
  };
};
console.log(
  JSON.stringify(
    {
      jitless: process.execArgv.includes('--jitless'),
      checks: rows.length,
      alternatives: stat('alternatives'),
      sliceSeconds: stat('sliceSeconds'),
      firstPassModelMs: stat('firstModel'),
      firstPassScoringMs: stat('judge'),
      paddedFeaturesMs: stat('paddedFeatures'),
      paddedModelMs: stat('paddedModel'),
      paddedScoringMs: stat('paddedGap'),
      cutSeconds: stat('cutSeconds'),
    },
    null,
    1,
  ),
);
process.exit(0);
