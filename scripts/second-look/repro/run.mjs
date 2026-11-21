/* eslint-env node, es2020 */
// The app's real TypeScript modules under node with the real second model, on recorded
// runs, verdict to mark: the service, the mark rules, the queue, the scoring, the audio
// ring. The follower is played back from its recorded verdicts, its frames are the
// engine's own, and each model run takes the time the phone is assumed to take, on a
// clock moved by hand. Writes one line per run to .out/second-look/repro/<suite><tag>.jsonl;
// finished runs are skipped, so it resumes.
//   node scripts/second-look/repro/run.mjs --suite <name> [--seconds 0.25,0.6]
//     [--configs off,s1,s2,s1s,s2s] [--limit N] [--shard i/n] [--places end|known]
//     [--only id,id] [--trace 1] [--tag name]
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import crypto from 'node:crypto';
import {
  OUT,
  SUITES,
  audioOf,
  gate,
  suiteRunIds,
  tooHeavy,
  wordCount,
} from '../lib.mjs';
import {createClock} from './clock.mjs';
import {
  createPlaybackEngine,
  melFramesOf,
  placesFrom,
  playbackOf,
  restartChunks,
} from './engine.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2)
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const name = args.suite;
const suite = SUITES[name];
const RUNS = (args.seconds ?? '0.25,0.6').split(',').map(Number);
const CONFIGS = (args.configs ?? 'off,s1,s2,s1s,s2s').split(',');
const placesMode = args.places ?? 'end';
const tag = args.tag ? `.${args.tag}` : '';
const [iShard, nShard] = (args.shard ?? '0/1').split('/').map(Number);
const REPRO = path.join(OUT, 'repro');
const file = path.join(REPRO, `${name}${tag}.jsonl`);
fs.mkdirSync(REPRO, {recursive: true});
const done = new Set();
if (fs.existsSync(file)) {
  const good = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    try {
      done.add(JSON.parse(line).id);
      good.push(line);
    } catch {
      // a torn last line
    }
  }
  fs.writeFileSync(file, good.length ? `${good.join('\n')}\n` : '');
}
const only = args.only ? new Set(args.only.split(',')) : null;
const ids = suiteRunIds(name)
  .filter((_, i) => i % nShard === iShard)
  .filter(id => !done.has(id) && (!only || only.has(id)))
  .slice(0, Number(args.limit ?? Infinity));
if (!ids.length) {
  console.log(JSON.stringify({suite: name, runs: 0, note: 'nothing left'}));
  process.exit(0);
}

const clock = createClock();
globalThis.__vclock = clock;
const require = createRequire(path.join(OUT, '../../package.json'));
const ort = require('onnxruntime-node');
const REVISION = '004f898639f3127a74eac1b898a2cb3ef0b5268d';
let session = null;
let secondsPerRun = 0.25;
let outputs = new Map();
const totals = {modelRuns: 0, realRuns: 0, realMs: 0};
let traceLines = [];
// Each bundle holds its own engine, as an app holds one.
const engines = new Map();
let current = null;

globalThis.__repro = {
  mic: null,
  modelFile: path.join(OUT, `../natural/qas/hf_${REVISION}/model.int8.onnx`),
  assets: {modelPath: 'follower', corpusPath: 'corpus'},
  Tensor: ort.Tensor,
  trace: line => traceLines.push(line),
  createEngine: onEvent => {
    const engine = createPlaybackEngine(onEvent);
    engines.set(current, engine);
    return engine;
  },
  async createSession(file_, options) {
    session ??= await clock.realWork(
      ort.InferenceSession.create(file_, options),
    );
    return {
      run(feeds) {
        // The same frames give the same answer: runs of one clip share them.
        const key = crypto
          .createHash('md5')
          .update(
            Buffer.from(
              feeds.x.data.buffer,
              feeds.x.data.byteOffset,
              feeds.x.data.byteLength,
            ),
          )
          .digest('hex');
        let real = outputs.get(key);
        totals.modelRuns += 1;
        if (!real) {
          totals.realRuns += 1;
          const t0 = performance.now();
          real = clock.realWork(
            session.run(feeds).then(out => {
              totals.realMs += performance.now() - t0;
              return out;
            }),
          );
          outputs.set(key, real);
        }
        return new Promise((resolve, reject) => {
          clock.setTimeout(() => {
            real.then(resolve, reject);
          }, secondsPerRun * 1000);
        });
      },
      release: async () => undefined,
    };
  },
};

const apps = {};
for (const c of CONFIGS) {
  apps[c] = await import(path.join(REPRO, `app.${c}.mjs`));
}

const CHUNK = 7680;
const SR = 16000;
// Enough for the last suspect to fall due and its check to finish, with no more words.
const AFTER_END_S = 9;
const KEEP_MIC_MS = 480;

function trail(lines) {
  const sum = lines.find(l => l.startsWith('checks this take:'));
  const out = {};
  if (sum) {
    for (const [key, re] of [
      ['wakes', /(\d+) wakes/],
      ['step2', /\((\d+) step 2 only\)/],
      ['first', /(\d+) first passes/],
      ['padded', /(\d+) padded looks/],
      ['runs', /(\d+) model runs/],
      ['shown', /(\d+) shown/],
      ['cancelled', /(\d+) cancelled/],
      ['failed', /(\d+) failed open/],
      ['timeouts', /(\d+) timeouts/],
      ['dropped', /(\d+) dropped/],
      ['droppedStep2', /dropped \((\d+) step 2\)/],
      ['queueMax', /queue max (\d+)/],
    ]) {
      out[key] = Number(re.exec(sum)?.[1] ?? 0);
    }
  }
  return out;
}

/** One take through the real app, on the clock. */
async function replayTake(config, take, mode) {
  const app = apps[config];
  current = config;
  const {useRecitationTrackingStore: store} = app;
  traceLines = [];
  clock.clear();
  await app.startRecitationTracking(take.hint);
  await clock.settle();
  const startedAt = clock.now();
  const engine = engines.get(config);
  engine.load({
    mel: take.mel,
    playback: take.playback,
    places: placesFrom(take.plain, take.run, placesMode, clock, startedAt),
  });
  // Every mark as it first shows, and its kind.
  const shown = new Map();
  const unsubscribe = store.subscribe(state => {
    for (const m of state.marks) {
      const id = `${m.surah}:${m.ayah}:${m.word}`;
      if (m.kind !== 'added' && !shown.has(id)) {
        shown.set(id, {
          k: m.kind,
          s: (m.since - startedAt) / 1000,
          a: (clock.now() - startedAt) / 1000,
        });
      }
    }
  });
  const {times} = take.playback;
  const mic = chunk => globalThis.__repro.mic(chunk, SR);
  const audio = take.audio;
  times.forEach((t, k) => {
    const ms = startedAt + Math.round(t * 1000);
    // The chunk reaches the engine, its frames are there; then whatever fell due on
    // the phone's clock; then what the engine made of the chunk.
    clock.at(ms, -1, () => {
      mic(audio.subarray(k * CHUNK, Math.min((k + 1) * CHUNK, audio.length)));
    });
    clock.at(ms, 1, () => engine.deliver(k, t));
  });
  const endSeconds = times[times.length - 1] ?? 0;
  const endMs = startedAt + Math.round(endSeconds * 1000);
  if (mode !== 'app') {
    const seconds = take.run.summary.seconds;
    clock.at(endMs, 2, () => {
      const batch = (take.run.flush?.verdicts ?? [])
        .filter(v => v.newly && v.state !== 'pending')
        .map(v => {
          const [surah, ayah, word] = v.id.split(':').map(Number);
          return {
            surah,
            ayah,
            word,
            totalWords: wordCount(surah, ayah) ?? word + 1,
            state: v.state,
            ...(v.d ? {detail: v.d} : {}),
          };
        });
      engine.deliverFlush(batch, take.playback.stopFlags, seconds);
    });
    // A correct next word, as when the reader carries on into the next ayah: after the
    // ayat with a word still in doubt, as the stand-in does after those with a suspect.
    clock.at(endMs + 1, 2, () => {
      const {book, judgeWaiting} = app.inDoubtForReplay();
      const ayat = new Set();
      for (const m of book.values()) {
        if (m.status === 'suspect') ayat.add(`${m.surah}:${m.ayah}`);
      }
      for (const v of judgeWaiting.values()) ayat.add(`${v.surah}:${v.ayah}`);
      const changes = [...ayat].map(key => {
        const [surah, ayah] = key.split(':').map(Number);
        return {
          surah,
          ayah: ayah + 1,
          word: 0,
          totalWords: wordCount(surah, ayah + 1) ?? 1,
          state: 'ok',
        };
      });
      engine.deliverFlush(changes, [], seconds + 0.001);
    });
  }
  // The mic stays open after the clip, with nothing in it.
  for (let ms = KEEP_MIC_MS; ms <= AFTER_END_S * 1000; ms += KEEP_MIC_MS) {
    clock.at(endMs + ms, -1, () => mic(new Float32Array(0)));
  }
  await clock.runTo(endMs + AFTER_END_S * 1000);
  const flags = new Set(
    store
      .getState()
      .flags.filter(f => f.kind === 'skippedAyah')
      .map(f => `${f.surah}:${f.ayah}`),
  );
  const corrected = new Set(
    store
      .getState()
      .marks.filter(m => m.status === 'corrected')
      .map(m => `${m.surah}:${m.ayah}:${m.word}`),
  );
  unsubscribe();
  await app.stopRecitationTracking('user');
  await clock.settle();
  clock.clear();
  const visible = [];
  for (const [id, m] of shown) {
    const [s, a, w] = id.split(':').map(Number);
    if (flags.has(`${s}:${a}`) || (w < 3 && flags.has(`${s}:${a - 1}`)))
      continue;
    visible.push({
      id,
      k: m.k,
      s: +m.s.toFixed(3),
      a: +m.a.toFixed(3),
      c: corrected.has(id) ? 1 : 0,
    });
  }
  const lines = traceLines;
  return {shown: visible, stats: trail(lines), lines};
}

const out = fs.openSync(file, 'a');
await gate(0);
let runs = 0;
for (const id of ids) {
  await gate();
  if (tooHeavy()) {
    console.log(
      JSON.stringify({
        suite: name,
        runs,
        ...totals,
        note: 'restarting, rss limit',
      }),
    );
    process.exit(75);
  }
  const run = JSON.parse(fs.readFileSync(suite.dir(id), 'utf8'));
  const plain = JSON.parse(fs.readFileSync(suite.plain(id), 'utf8'));
  const audio = audioOf(run);
  const playback = playbackOf(run, audio.length);
  const take = {
    run,
    plain,
    audio,
    hint: run.clip.hint ?? null,
    mel: melFramesOf(audio, restartChunks(playback)),
    playback,
  };
  outputs = new Map();
  const result = {};
  for (const c of CONFIGS) {
    result[c] = {};
    for (const per of c === 'off' ? [RUNS[0]] : RUNS) {
      secondsPerRun = per;
      result[c][per] = {};
      for (const mode of suite.modes) {
        const {shown, stats, lines} = await replayTake(c, take, mode);
        result[c][per][mode] = {shown, stats};
        if (args.trace) result[c][per][mode].trace = lines;
      }
    }
  }
  fs.writeSync(
    out,
    `${JSON.stringify({id, seconds: run.summary.seconds, cfg: result})}\n`,
  );
  runs += 1;
  if (runs % 100 === 0) {
    console.log(JSON.stringify({suite: name, runs, of: ids.length, ...totals}));
  }
}
fs.closeSync(out);
console.log(
  JSON.stringify({
    suite: name,
    runs,
    ...totals,
    msPerRealRun: +(totals.realMs / Math.max(1, totals.realRuns)).toFixed(1),
    rss: +(process.memoryUsage().rss / 1e9).toFixed(2),
  }),
);
process.exit(0);
