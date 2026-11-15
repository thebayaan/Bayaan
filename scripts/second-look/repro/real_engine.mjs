/* eslint-env node, es2020 */
// The same real app modules as run.mjs, with the real engine under them on real audio:
// recitationEngine.ts and @tilawa/core, so the first pass reads the real log-mel ring and
// the slice the real tracker's places as known at that moment. A few clips, to check what
// the playback stands in for; tuning cells only. Writes .out/second-look/repro/real.jsonl.
//   node scripts/second-look/repro/real_engine.mjs [--configs s1,s2] [--seconds 0.25]
//     [--pool 12] [--w1 40] [--live 24]
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {BENCH, OUT, SUITES, audioOf, gate, tooHeavy} from '../lib.mjs';
import {createClock} from './clock.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2)
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const CONFIGS = (args.configs ?? 's1,s2').split(',');
const PER = Number(args.seconds ?? 0.25);
const REPRO = path.join(OUT, 'repro');
const file = path.join(REPRO, args.out ?? 'real.jsonl');

const clock = createClock();
globalThis.__vclock = clock;
const require = createRequire(path.join(BENCH, 'package.json'));
const ort = require('onnxruntime-node');
const REVISION = '004f898639f3127a74eac1b898a2cb3ef0b5268d';
const SECOND = path.join(
  BENCH,
  `.out/natural/qas/hf_${REVISION}/model.int8.onnx`,
);
let traceLines = [];
const sessions = new Map();

globalThis.__repro = {
  mic: null,
  modelFile: SECOND,
  assets: {
    modelPath: path.join(BENCH, '.out/assets/zipformer_a0w_ep1_a05.int8.onnx'),
    corpusPath: path.join(BENCH, '.out/assets/zipformer_quran.json'),
  },
  readFile: f => fs.readFileSync(f, 'utf8'),
  Tensor: ort.Tensor,
  trace: line => traceLines.push(line),
  async createSession(model, options) {
    let session = sessions.get(model);
    if (!session) {
      session = await clock.realWork(
        ort.InferenceSession.create(model, {
          executionProviders: ['cpu'],
          intraOpNumThreads: 1,
          interOpNumThreads: 1,
          ...options,
        }),
      );
      sessions.set(model, session);
    }
    return {
      run(feeds) {
        const real = clock.realWork(session.run(feeds));
        if (model !== SECOND) return real;
        // The second model takes as long as the phone is assumed to.
        return new Promise((resolve, reject) => {
          clock.setTimeout(() => real.then(resolve, reject), PER * 1000);
        });
      },
      release: async () => undefined,
    };
  },
};

const apps = {};
for (const c of CONFIGS)
  apps[c] = await import(path.join(REPRO, `real.${c}.mjs`));
// Lets each app's engine finish building its vocabulary.

const clipsOf = (manifest, keep, n, sort) => {
  const rows = JSON.parse(fs.readFileSync(manifest, 'utf8')).filter(c =>
    keep(c.truth),
  );
  return (sort ? rows.sort(sort) : rows).slice(0, n);
};
const MAN = path.join(BENCH, '.out/natural/manifests');
const V = path.join(BENCH, '.out/natural/verify');
const words = (a, b) => a.truth.words - b.truth.words;
const CLIPS = [
  ...clipsOf(
    path.join(MAN, 'pool.json'),
    SUITES.pool.keep,
    Number(args.pool ?? 12),
    words,
  ),
  ...clipsOf(
    path.join(MAN, 'w1.json'),
    t => SUITES.w1.keep(t) && t.type === 'changed' && t.position === 'interior',
    Number(args.w1 ?? 40) / 2,
  ),
  ...clipsOf(
    path.join(MAN, 'w1.json'),
    t => SUITES.w1.keep(t) && t.type === 'changed' && t.position === 'last',
    Number(args.w1 ?? 40) / 2,
  ),
  ...clipsOf(
    path.join(V, 'live/live.json'),
    t => SUITES.live_last.keep(t) && t.type === 'carry_last_whole',
    Number(args.live ?? 24),
  ),
];

const CHUNK = 7680;
const SR = 16000;
const AFTER_END_S = 9;

async function take(app, clip, audio) {
  const {useRecitationTrackingStore: store} = app;
  traceLines = [];
  await app.startRecitationTracking(clip.hint ?? null);
  await clock.settle();
  // The engine builds its vocabulary in steps, off the long path.
  await clock.runTo(clock.now() + 2000);
  const startedAt = clock.now();
  const engine = app.secondJudgeEngine();
  if (clip.expected) {
    const {surah, ayah, ayahEnd, word} = clip.expected;
    engine.setMode('correction');
    engine.setExpected({surah, ayah, ayahEnd: ayahEnd ?? ayah + 9});
    engine.setStructural(true);
    await engine.correct('noop');
    await clock.settle();
    if (word) globalThis.__repro.session.engine.track(surah, ayah, word);
  }
  const shown = new Map();
  const unsubscribe = store.subscribe(state => {
    for (const m of state.marks) {
      const id = `${m.surah}:${m.ayah}:${m.word}`;
      if (m.kind !== 'added' && !shown.has(id)) {
        shown.set(id, {k: m.kind, a: (clock.now() - startedAt) / 1000});
      }
    }
  });
  let last = 0;
  for (let off = 0; off < audio.length; off += CHUNK) {
    const end = Math.min(off + CHUNK, audio.length);
    last = end / SR;
    clock.at(startedAt + Math.round(last * 1000), -1, () => {
      globalThis.__repro.mic(audio.subarray(off, end), SR);
    });
  }
  const endMs = startedAt + Math.round(last * 1000);
  for (let ms = 480; ms <= AFTER_END_S * 1000; ms += 480) {
    clock.at(endMs + ms, -1, () =>
      globalThis.__repro.mic(new Float32Array(0), SR),
    );
  }
  await clock.runTo(endMs + AFTER_END_S * 1000);
  unsubscribe();
  await app.stopRecitationTracking('user');
  await clock.settle();
  clock.clear();
  return {
    shown: [...shown].map(([id, m]) => ({id, ...m})),
    lines: traceLines.filter(l =>
      /^(judge|padded|check|checks this take|MARK|verdict)/.test(l),
    ),
  };
}

const done = new Set(
  fs.existsSync(file)
    ? fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(l => JSON.parse(l).id)
    : [],
);
const out = fs.openSync(file, 'a');
await gate(0);
let runs = 0;
for (const clip of CLIPS) {
  if (done.has(clip.id)) continue;
  await gate();
  if (tooHeavy()) {
    console.log(JSON.stringify({runs, note: 'restarting, rss limit'}));
    process.exit(75);
  }
  const audio = audioOf({clip});
  const cfg = {};
  for (const c of CONFIGS) cfg[c] = await take(apps[c], clip, audio);
  fs.writeSync(out, `${JSON.stringify({id: clip.id, cfg})}\n`);
  runs += 1;
  console.log(JSON.stringify({id: clip.id, runs}));
}
fs.closeSync(out);
process.exit(0);
