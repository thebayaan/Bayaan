/* eslint-env node, es2020 */
// One suite through the app's real stack on real audio: RecitationTrackingService,
// sessionRunner, recitationEngine.ts over @tilawa/core in node_modules with the options the
// app passes, the second model under onnxruntime-node, on a clock moved by hand with each
// second-model run taking the time the phone is assumed to take. For each clip it writes
// the marks that showed, and what the wrapper reported chunk by chunk, so play.mjs can play
// the other settings of the switches on the same follower. Finished clips are skipped.
//   node scripts/second-look/final/real_pass.mjs --suite <name> [--shard i/n]
//     [--config s1] [--seconds 0.25] [--limit N] [--only id,id] [--tag name]
// Where a suite locks the tracker by hand or starts on a named passage, this does what
// bench.mjs does (`expected`, `trackAt`, the flush) through the same session.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {audioOf, engineWords} from '../lib.mjs';
import {createClock} from '../repro/clock.mjs';
import {BENCH, FINAL, SUITES} from './suites.mjs';
import {checksOf, limitsOk, resumeAt} from './common.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2)
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const name = args.suite;
const suite = SUITES[name];
const CONFIG = args.config ?? 's1';
const PER = Number(args.seconds ?? 0.25);
const tag = args.tag ? `.${args.tag}` : '';
const [iShard, nShard] = (args.shard ?? '0/1').split('/').map(Number);
const STREAM = path.join(FINAL, 'stream');
fs.mkdirSync(STREAM, {recursive: true});
const file = path.join(STREAM, `${name}${tag}.${iShard}.jsonl`);

const SR = 16000;
const CHUNK = 7680;
const AFTER_END_S = 9;
const KEEP_MIC_MS = 480;
const RSS_LIMIT = 3e9;
const REVISION = '004f898639f3127a74eac1b898a2cb3ef0b5268d';
const SECOND = path.join(
  BENCH,
  `.out/natural/qas/hf_${REVISION}/model.int8.onnx`,
);
const STRUCTURAL = {ayahOrder: true, similarVerse: true, timing: 'stop'};
const TRACK_AT_HISTORY = 120;
const PASSAGE_AYAT = 10;

const surahLength = s => {
  let n = 1;
  while (engineWords[`${s}:${n + 1}`]) n += 1;
  return n;
};

const only = args.only ? new Set(args.only.split(',')) : null;
const {done, offset} = resumeAt(file);
if (fs.existsSync(file)) fs.truncateSync(file, offset);
const clips = suite
  .clips()
  .filter((_, i) => i % nShard === iShard)
  .filter(c => !done.has(c.id) && (!only || only.has(c.id)))
  .slice(0, Number(args.limit ?? Infinity));
if (!clips.length) {
  console.log(JSON.stringify({suite: name, runs: 0, note: 'nothing left'}));
  process.exit(0);
}

const clock = createClock();
globalThis.__vclock = clock;
const require = createRequire(path.join(BENCH, 'package.json'));
const ort = require('onnxruntime-node');
const sessions = new Map();
let traceLines = [];
let sink = null;

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
  engineExtra: suite.extra ?? null,
  tap: msg => sink?.(msg),
  afterFeed: null,
  async createSession(model, options) {
    let session = sessions.get(model);
    if (!session) {
      session = await clock.realWork(
        ort.InferenceSession.create(model, {
          executionProviders: ['cpu'],
          intraOpNumThreads: 1,
          interOpNumThreads: 1,
          enableCpuMemArena: false,
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

const app = await import(path.join(FINAL, 'bundles', `real.${CONFIG}.mjs`));
const {useRecitationTrackingStore: store} = app;

/** What playback needs of a message, in the order the wrapper gave it. */
function slim(msg) {
  switch (msg.type) {
    case 'word_verdicts':
      return msg;
    case 'word_progress':
      return {
        type: msg.type,
        surah: msg.surah,
        ayah: msg.ayah,
        word_index: msg.word_index,
        total_words: msg.total_words,
      };
    case 'verse_match':
      return {type: msg.type, surah: msg.surah, ayah: msg.ayah};
    case 'debug':
      return {type: msg.type, event: msg.event};
    case 'correction':
      return {type: msg.type, state: msg.state, totalWords: msg.totalWords};
    default:
      return null;
  }
}

/** A clip's `trackAt`: the app's correction state, locked on a word now. */
async function trackFrom(zs, {t, surah: s, ayah: a, word = 0, ayahEnd}) {
  delete zs.engine.feedSearching;
  const passage = {
    surah: s,
    ayah: a,
    ayahEnd:
      ayahEnd ?? Math.max(a, Math.min(surahLength(s), a + PASSAGE_AYAT - 1)),
  };
  app.correctionForReplay(passage);
  zs.setMode('correction');
  zs.setExpected(passage);
  await zs.setStructural(STRUCTURAL);
  const from = Math.floor(t * 25) - 1;
  const replay = zs.engine.buffer.filter(c => c.frame >= from);
  const events = zs.engine.lock(
    zs.corpus.wordIndex(s, a, word),
    replay,
    'located',
  );
  // In the app the reader has been followed up to here, so the tracker's cost rate has
  // this much clean history behind it, not the few sounds since this lock.
  const tracker = zs.engine.tracker;
  tracker.costRate = (window = zs.cfg.lostWindow) => {
    const n = tracker.costs.length;
    if (!n) return 0;
    const w = Math.min(window, n + TRACK_AT_HISTORY);
    const before = n - w > 0 ? tracker.costs[n - w - 1] : 0;
    return (tracker.costs[n - 1] - before) / w;
  };
  zs.dispatch(events.flatMap(ev => zs.handle(ev)));
}

/** The flush of bench.mjs, kept apart from what the app heard. */
function endFlush(tracer, liveState) {
  if (!tracer) return [];
  const r = x => (typeof x === 'number' ? x : null);
  const out = [];
  for (const v of tracer.verdicts(true)) {
    if (v.state === 'pending') continue;
    const id = `${v.surah}:${v.ayah}:${v.word}`;
    const live = liveState.get(id) ?? null;
    if (live !== null && live !== 'pending') continue;
    out.push({
      id,
      state: v.state,
      d: {
        gop: r(v.gop),
        heardRatio: r(v.heardRatio),
        distance: r(v.distance),
      },
    });
  }
  return out;
}

let first = true;
async function take(clip, audio) {
  const startedWall = performance.now();
  traceLines = [];
  const rec = {
    id: clip.id,
    seconds: audio.length / SR,
    chunks: Math.ceil(audio.length / CHUNK),
    msgs: [],
    stopMsgs: [],
    frames: {},
    afterEnd: 0,
  };
  let k = 0;
  let audioOver = false;
  let stopping = false;
  const liveState = new Map();
  let lastEngineEvent = null;
  sink = msg => {
    const s = slim(msg);
    if (!s) return;
    if (stopping) {
      if (s.type === 'correction') rec.stopMsgs.push(s);
      return;
    }
    if (audioOver) rec.afterEnd += 1;
    rec.msgs.push([k, s]);
    if (s.type === 'word_verdicts') {
      for (const c of s.changes)
        liveState.set(`${c.surah}:${c.ayah}:${c.word}`, c.state);
    }
    if (
      s.type === 'debug' &&
      ['located', 'relocated', 'idle', 'locateFailed', 'completed'].includes(
        s.event,
      )
    ) {
      lastEngineEvent = s.event;
    }
  };
  await app.startRecitationTracking(clip.hint ?? null);
  await clock.settle();
  if (first) {
    // The wrapper builds its vocabulary in steps after the load.
    await clock.runTo(clock.now() + 2000);
    first = false;
  }
  const startedAt = clock.now();
  const zs = globalThis.__repro.session;
  const engine = app.secondJudgeEngine();
  if (clip.expected) {
    const {surah: s, ayah: a} = clip.expected;
    const passage = {
      surah: s,
      ayah: a,
      ayahEnd:
        clip.expected.ayahEnd ??
        Math.max(a, Math.min(surahLength(s), a + PASSAGE_AYAT - 1)),
    };
    app.correctionForReplay(passage);
    engine.setMode('correction');
    engine.setExpected(passage);
    engine.setStructural(true);
    await clock.settle();
    if (clip.expected.word) zs.engine.track(s, a, clip.expected.word);
  }
  let waiting = clip.trackAt ?? null;
  // Until then the model hears the recording and the tracker waits.
  if (waiting) zs.engine.feedSearching = () => [];
  globalThis.__repro.afterFeed = async session => {
    if (waiting && session.decoder.framesDecoded >= (waiting.t + 0.32) * 25) {
      const at = waiting;
      waiting = null;
      await trackFrom(session, at);
    }
  };
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
  const seenEdges = new Set();
  const lastFrames = new Map();
  let lastTracer = null;
  const noteFrames = () => {
    for (const tracer of zs.spanTracers ?? []) {
      const t = tracer.tracker;
      const c = t.corpus;
      for (const w of tracer.lastSpans.keys()) {
        const g = t.firstWord + w;
        const inAyah = c.wordInAyah[g];
        if (
          inAyah === 0 ||
          inAyah === c.ayahWordCount(c.wordSurah[g], c.wordAyah[g]) - 1
        ) {
          seenEdges.add(`${c.wordSurah[g]}:${c.wordAyah[g]}:${inAyah}`);
        }
      }
    }
    for (const id of seenEdges) {
      const [s, a, w] = id.split(':').map(Number);
      const got = zs.wordFrames(s, a, w);
      const key = got ? `${got.from}:${got.to}` : 'null';
      if (lastFrames.get(id) === key) continue;
      lastFrames.set(id, key);
      (rec.frames[id] ??= []).push([k, got?.from ?? null, got?.to ?? null]);
    }
    lastTracer = zs.engine.tracer ?? lastTracer;
  };
  let lastSeconds = 0;
  for (let off = 0, i = 0; off < audio.length; off += CHUNK, i += 1) {
    const end = Math.min(off + CHUNK, audio.length);
    lastSeconds = end / SR;
    const ms = startedAt + Math.round(lastSeconds * 1000);
    clock.at(ms, -1, () => {
      k = i;
      globalThis.__repro.mic(audio.subarray(off, end), SR);
    });
    clock.at(ms, 0, noteFrames);
  }
  const endMs = startedAt + Math.round(lastSeconds * 1000);
  let tracerAtEnd = null;
  clock.at(endMs, 0, () => {
    tracerAtEnd =
      zs.engine.tracer ?? (lastEngineEvent === 'completed' ? lastTracer : null);
    audioOver = true;
  });
  for (let ms = KEEP_MIC_MS; ms <= AFTER_END_S * 1000; ms += KEEP_MIC_MS) {
    clock.at(endMs + ms, -1, () =>
      globalThis.__repro.mic(new Float32Array(0), SR),
    );
  }
  await clock.runTo(endMs + AFTER_END_S * 1000);
  const flagged = new Set(
    store
      .getState()
      .flags.filter(f => f.kind === 'skippedAyah')
      .map(f => `${f.surah}:${f.ayah}`),
  );
  const onPage = store.getState().marks;
  const corrected = new Set(
    onPage
      .filter(m => m.status === 'corrected')
      .map(m => `${m.surah}:${m.ayah}:${m.word}`),
  );
  const standing = new Set(
    onPage
      .filter(m => m.kind !== 'added')
      .map(m => `${m.surah}:${m.ayah}:${m.word}`),
  );
  unsubscribe();
  stopping = true;
  await app.stopRecitationTracking('user');
  await clock.settle();
  clock.clear();
  sink = null;
  globalThis.__repro.afterFeed = null;
  if (suite.flush) rec.flush = endFlush(tracerAtEnd, liveState);
  const notFlagged = id => {
    const [s, a, w] = id.split(':').map(Number);
    return !(
      flagged.has(`${s}:${a}`) ||
      (w < 3 && flagged.has(`${s}:${a - 1}`))
    );
  };
  rec.shown = [...shown]
    .filter(([id]) => notFlagged(id))
    .map(([id, m]) => ({
      id,
      k: m.k,
      s: +m.s.toFixed(3),
      a: +m.a.toFixed(3),
      c: corrected.has(id) ? 1 : 0,
      gone: standing.has(id) ? 0 : 1,
    }));
  rec.added = [...added].map(([id, m]) => ({id, a: +m.a.toFixed(3)}));
  rec.stats = checksOf(traceLines);
  rec.wallMs = Math.round(performance.now() - startedWall);
  return rec;
}

const out = fs.openSync(file, 'a');
const sidecar = fs.openSync(`${file}.done`, 'a');
let at = offset;
let runs = 0;
let heard = 0;
let wall = 0;
for (const clip of clips) {
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
  const audio = audioOf({clip});
  const rec = await take(clip, audio);
  const line = `${JSON.stringify(rec)}\n`;
  fs.writeSync(out, line);
  at += Buffer.byteLength(line);
  fs.writeSync(sidecar, `${clip.id}\t${at}\n`);
  runs += 1;
  heard += rec.seconds;
  wall += rec.wallMs;
  if (runs % 100 === 0) {
    console.log(
      JSON.stringify({
        suite: name,
        shard: iShard,
        runs,
        of: clips.length,
        rtf: +(wall / 1000 / heard).toFixed(3),
      }),
    );
  }
}
console.log(
  JSON.stringify({
    suite: name,
    shard: iShard,
    runs,
    rtf: +(wall / 1000 / Math.max(1, heard)).toFixed(3),
    rss: +(process.memoryUsage().rss / 1e9).toFixed(2),
  }),
);
process.exit(0);
