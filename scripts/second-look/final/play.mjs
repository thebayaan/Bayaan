/* eslint-env node, es2020 */
// Plays what real_pass.mjs recorded through the app's real modules, once for each setting of
// the switches and each assumed time per second-model run: the service, the mark rules, the
// queue and the scoring, with the real second model. Its frames are the engine's own
// KaldiFbank, and each chunk's verdicts come just after any timer due at that moment.
// Writes one line per clip to .out/second-look/final/marks/<suite>.<i>.jsonl; it resumes.
//   node scripts/second-look/final/play.mjs --suite <name> [--shard i/n]
//     [--configs off,s1,s2,s1s,s2s] [--seconds 0.25,0.6] [--limit N] [--tag name]
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {audioOf, wordCount} from '../lib.mjs';
import {createClock} from '../repro/clock.mjs';
import {
  createPlaybackEngine,
  melFramesOf,
  restartChunks,
} from '../repro/engine.mjs';
import {BENCH, FINAL, SUITES} from './suites.mjs';
import {checksOf, limitsOk, placesOfStream, resumeAt} from './common.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2)
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const name = args.suite;
const suite = SUITES[name];
const RUNS = (args.seconds ?? '0.25,0.6').split(',').map(Number);
const CONFIGS = (args.configs ?? 'off,s1,s2,s1s,s2s').split(',');
const tag = args.tag ? `.${args.tag}` : '';
const [iShard, nShard] = (args.shard ?? '0/1').split('/').map(Number);
const MODES = [
  ...(suite.modes ?? ['app']),
  ...(suite.dropLost ? ['noLost'] : []),
];
const MARKS = path.join(FINAL, 'marks');
fs.mkdirSync(MARKS, {recursive: true});
const file = path.join(MARKS, `${name}${tag}.${iShard}.jsonl`);
const {done, offset} = resumeAt(file);
if (fs.existsSync(file)) fs.truncateSync(file, offset);

const SR = 16000;
const CHUNK = 7680;
const AFTER_END_S = 9;
const KEEP_MIC_MS = 480;
const RSS_LIMIT = 2e9;
const REVISION = '004f898639f3127a74eac1b898a2cb3ef0b5268d';
const LOST_OUT = new Set(['lost']);

const clock = createClock();
globalThis.__vclock = clock;
const require = createRequire(path.join(BENCH, 'package.json'));
const ort = require('onnxruntime-node');
let session = null;
let secondsPerRun = 0.25;
let outputs = new Map();
let traceLines = [];
const engines = new Map();
let current = null;

globalThis.__repro = {
  mic: null,
  modelFile: path.join(
    BENCH,
    `.out/natural/qas/hf_${REVISION}/model.int8.onnx`,
  ),
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
        // The same frames give the same answer: plays of one clip share them.
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
        if (!real) {
          real = clock.realWork(session.run(feeds));
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
  apps[c] = await import(path.join(FINAL, 'bundles', `app.${c}.mjs`));
}

/** What the wrapper reported on a clip, chunk by chunk, as the playback engine takes it. */
export function playbackOfStream(rec, dropLost) {
  const times = [];
  for (let i = 0; i < rec.chunks; i++) {
    times.push(Math.min((i + 1) * CHUNK, Math.round(rec.seconds * SR)) / SR);
  }
  const events = times.map(() => ({messages: [], changes: [], lock: null}));
  const last = times.length - 1;
  for (const [k, m] of rec.msgs) {
    const slot = events[Math.min(k, last)];
    if (m.type === 'word_verdicts') {
      slot.changes.push(...m.changes);
      if (m.lock) slot.lock = m.lock;
    } else if (m.type === 'debug') {
      if (dropLost && LOST_OUT.has(m.event)) continue;
      slot.messages.push({...m, at: 0, data: {}});
    } else if (m.type === 'word_progress') {
      slot.messages.push({...m, matched_indices: []});
    } else if (m.type === 'verse_match') {
      slot.messages.push({
        ...m,
        verse_text: '',
        surah_name: '',
        confidence: 1,
        surrounding_verses: [],
      });
    } else {
      slot.messages.push(m);
    }
  }
  return {times, events, stopFlags: rec.stopMsgs ?? []};
}

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
  const playback = mode === 'noLost' ? take.noLost : take.playback;
  let delivered = -1;
  engine.load({
    mel: take.mel,
    playback,
    places: placesOfStream(
      take.rec.frames,
      take.rec.msgs,
      playback.times,
      () => delivered,
    ),
  });
  const shown = new Map();
  const added = new Map();
  const unsubscribe = store.subscribe(state => {
    for (const m of state.marks) {
      const id = `${m.surah}:${m.ayah}:${m.word}`;
      const to = m.kind === 'added' ? added : shown;
      if (!to.has(id)) {
        to.set(id, {
          k: m.kind,
          s: (m.since - startedAt) / 1000,
          a: (clock.now() - startedAt) / 1000,
        });
      }
    }
  });
  const {times} = playback;
  const mic = chunk => globalThis.__repro.mic(chunk, SR);
  const audio = take.audio;
  times.forEach((t, k) => {
    const ms = startedAt + Math.round(t * 1000);
    clock.at(ms, -1, () => {
      mic(audio.subarray(k * CHUNK, Math.min((k + 1) * CHUNK, audio.length)));
    });
    clock.at(ms, 1, () => {
      delivered = k;
      engine.deliver(k, t);
    });
  });
  const endSeconds = times[times.length - 1] ?? 0;
  const endMs = startedAt + Math.round(endSeconds * 1000);
  if (mode === 'carry' || mode === 'flush') {
    const {seconds} = take.rec;
    clock.at(endMs, 2, () => {
      const batch = (take.rec.flush ?? []).map(v => {
        const [surah, ayah, word] = v.id.split(':').map(Number);
        return {
          surah,
          ayah,
          word,
          totalWords: wordCount(surah, ayah) ?? word + 1,
          state: v.state,
          detail: v.d,
        };
      });
      engine.deliverFlush(batch, playback.stopFlags, seconds);
    });
    if (mode === 'carry') {
      // A correct next word, as when the reader carries on into the next ayah: after the
      // ayat with a word still in doubt.
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
  }
  for (let ms = KEEP_MIC_MS; ms <= AFTER_END_S * 1000; ms += KEEP_MIC_MS) {
    clock.at(endMs + ms, -1, () => mic(new Float32Array(0)));
  }
  await clock.runTo(endMs + AFTER_END_S * 1000);
  const state = store.getState();
  const flags = new Set(
    state.flags
      .filter(f => f.kind === 'skippedAyah')
      .map(f => `${f.surah}:${f.ayah}`),
  );
  const corrected = new Set(
    state.marks
      .filter(m => m.status === 'corrected')
      .map(m => `${m.surah}:${m.ayah}:${m.word}`),
  );
  const standing = new Set(
    state.marks
      .filter(m => m.kind !== 'added')
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
      gone: standing.has(id) ? 0 : 1,
    });
  }
  return {
    shown: visible,
    added: [...added].map(([id, m]) => ({id, a: +m.a.toFixed(3)})),
    stats: checksOf(traceLines),
  };
}

function* streamLines() {
  const dir = path.join(FINAL, 'stream');
  const own = new RegExp(`^${name}${tag.replace('.', '\\.')}\\.\\d+\\.jsonl$`);
  const parts = fs
    .readdirSync(dir)
    .filter(f => own.test(f))
    .sort();
  for (const part of parts) {
    const fd = fs.openSync(path.join(dir, part), 'r');
    const buffer = Buffer.alloc(1 << 22);
    let tail = [];
    for (;;) {
      const n = fs.readSync(fd, buffer, 0, buffer.length);
      if (!n) break;
      let start = 0;
      for (;;) {
        const nl = buffer.indexOf(10, start);
        if (nl < 0 || nl >= n) break;
        tail.push(Buffer.from(buffer.subarray(start, nl)));
        yield Buffer.concat(tail);
        tail = [];
        start = nl + 1;
      }
      tail.push(Buffer.from(buffer.subarray(start, n)));
    }
    fs.closeSync(fd);
  }
}

const clips = new Map(suite.clips().map(c => [c.id, c]));
const out = fs.openSync(file, 'a');
const sidecar = fs.openSync(`${file}.done`, 'a');
let at = offset;
let runs = 0;
let index = -1;
const limit = Number(args.limit ?? Infinity);
for (const raw of streamLines()) {
  index += 1;
  if (index % nShard !== iShard) continue;
  const head = /^\{"id":"([^"]+)"/.exec(raw.subarray(0, 400).toString());
  if (done.has(head[1])) continue;
  if (runs >= limit) break;
  while (!limitsOk()) {
    await new Promise(resolve => {
      globalThis.setTimeout(resolve, 60000);
    });
  }
  if (process.memoryUsage().rss > RSS_LIMIT) {
    console.log(
      JSON.stringify({suite: name, runs, note: 'restarting, rss limit'}),
    );
    process.exit(75);
  }
  const rec = JSON.parse(raw.toString());
  const clip = clips.get(rec.id);
  const audio = audioOf({clip});
  const playback = playbackOfStream(rec, false);
  const take = {
    rec,
    audio,
    hint: clip.hint ?? null,
    playback,
    noLost: suite.dropLost ? playbackOfStream(rec, true) : null,
    mel: melFramesOf(audio, restartChunks(playback)),
  };
  outputs = new Map();
  const result = {};
  for (const c of CONFIGS) {
    result[c] = {};
    for (const per of c === 'off' ? [RUNS[0]] : RUNS) {
      secondsPerRun = per;
      result[c][per] = {};
      for (const mode of MODES) {
        result[c][per][mode] = await replayTake(c, take, mode);
      }
    }
  }
  const line = `${JSON.stringify({id: rec.id, seconds: rec.seconds, cfg: result})}\n`;
  fs.writeSync(out, line);
  at += Buffer.byteLength(line);
  fs.writeSync(sidecar, `${rec.id}\t${at}\n`);
  runs += 1;
  if (runs % 200 === 0) {
    console.log(JSON.stringify({suite: name, shard: iShard, runs}));
  }
}
console.log(
  JSON.stringify({
    suite: name,
    shard: iShard,
    runs,
    rss: +(process.memoryUsage().rss / 1e9).toFixed(2),
  }),
);
process.exit(0);
