/* eslint-env node, es2020 */
// Recitation bench: runs the app's own @tilawa/core build (repo
// node_modules, patched) on 16 kHz mono float32 audio in the mic's 480 ms
// chunks, and writes what the reader would see: lock time, word follow lag
// against reference word timings, verse matches, correction flags and every
// per-word verdict change.
//
//   node scripts/recitation-bench/bench.mjs --audio a.f32 [--timings qdc.json]
//     [--flow app|correction|tracking] [--ayat N] [--dwell N] [--json out.json]
//
// --flow app (default) copies RecitationTrackingService: start tracking; at
// each lock switch to correction expecting the rest of the surah (--ayat);
// on idle/lost/locateFailed/completed go back to tracking near the last ayah.
// --flow correction expects ayat 1..N from the start; tracking never checks.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(HERE, '.out');
const SR = 16000;
const CHUNK = 7680; // 480 ms, as micStream

const require = createRequire(path.join(HERE, 'package.json'));
const ort = require('onnxruntime-node');
// The app's patch loads structural-index.json with Metro's require.
const tilawaDir = path.join(ROOT, 'node_modules/@tilawa/core/dist');
globalThis.require = createRequire(
  path.join(tilawaDir, 'recitation/session.js'),
);
const tilawa = await import(path.join(tilawaDir, 'index.js'));

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
}
const flow = args.flow ?? 'app';
const ayat = Number(args.ayat ?? 0);

function loadTimings(file) {
  if (!file) return null;
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const map = new Map();
  for (const v of j.audio_files[0].verse_timings) {
    map.set(
      v.verse_key,
      (v.segments ?? [])
        .filter(s => s.length >= 3)
        .map(([, st, en]) => ({start: st / 1000, end: en / 1000})),
    );
  }
  return map;
}

const audio = new Float32Array(fs.readFileSync(args.audio).buffer.slice(0));
const timings = loadTimings(args.timings);

const ortSession = await ort.InferenceSession.create(
  path.join(OUT, 'assets/zipformer_a0w_ep1_a05.int8.onnx'),
  {executionProviders: ['cpu']},
);
const timed = {
  async run(feeds) {
    const f = {};
    for (const [k, v] of Object.entries(feeds)) {
      f[k] =
        v instanceof ort.Tensor
          ? v
          : new ort.Tensor(
              v.data instanceof Float32Array
                ? 'float32'
                : v.data instanceof BigInt64Array
                  ? 'int64'
                  : 'int32',
              v.data,
              v.dims,
            );
    }
    const out = await ortSession.run(f);
    const r = {};
    for (const [k, v] of Object.entries(out))
      r[k] = {data: v.data, dims: v.dims, type: v.type};
    return r;
  },
};

let audioT = 0;
const log = [];
function pick(msg) {
  switch (msg.type) {
    case 'word_progress':
      return {
        type: msg.type,
        key: `${msg.surah}:${msg.ayah}`,
        w: msg.word_index,
        n: msg.total_words,
      };
    case 'verse_match':
      return {type: msg.type, key: `${msg.surah}:${msg.ayah}`};
    case 'debug':
      return {type: msg.type, event: msg.event};
    default:
      return {type: msg.type};
  }
}
const zs = await tilawa.createZipformerSession({
  session: timed,
  Tensor: ort.Tensor,
  corpus: JSON.parse(
    fs.readFileSync(path.join(OUT, 'assets/zipformer_quran.json'), 'utf8'),
  ),
  onEvent: msg => log.push({t: +audioT.toFixed(2), ...pick(msg)}),
  structural: flow === 'correction' ? undefined : false,
  enableFallback: false,
  debug: true,
  config: args.dwell ? {commitDwell: Number(args.dwell)} : undefined,
});

const STRUCT_ON = {ayahOrder: true, similarVerse: true};
const STRUCT_OFF = {ayahOrder: false, similarVerse: false};
let checking = flow === 'correction';
// As PASSAGE_AYAT and SLIDE_WITHIN in RecitationTrackingService.
const PASSAGE_AYAT = 10;
const SLIDE_WITHIN = 3;
let expectedSurah = 0;
let expectedEnd = 0;
let flowSeen = 0;
let lastKey = null;
if (flow === 'correction') {
  zs.setMode('correction');
  zs.setExpected({
    surah: Number(args.surah ?? 0) || undefined,
    ayah: 1,
    ayahEnd: ayat,
  });
} else {
  zs.setMode('tracking');
}
async function appFlow() {
  for (; flowSeen < log.length; flowSeen++) {
    const e = log[flowSeen];
    if (e.type === 'word_progress') {
      lastKey = e.key;
      if (!checking) {
        const [s, a] = e.key.split(':').map(Number);
        zs.setMode('correction');
        expectedSurah = s;
        expectedEnd = Math.max(a, Math.min(ayat, a + PASSAGE_AYAT - 1));
        zs.setExpected({surah: s, ayah: a, ayahEnd: expectedEnd});
        await zs.setStructural(STRUCT_ON);
        checking = true;
      }
    } else if (e.type === 'verse_match' && checking) {
      // As slidePassage in RecitationTrackingService.
      const [s, a] = e.key.split(':').map(Number);
      if (
        s === expectedSurah &&
        expectedEnd < ayat &&
        a > expectedEnd - SLIDE_WITHIN
      ) {
        const from = Math.max(1, a - 1);
        expectedEnd = Math.max(from, Math.min(ayat, from + PASSAGE_AYAT - 1));
        zs.setExpected({surah: s, ayah: from, ayahEnd: expectedEnd});
      }
    } else if (
      e.type === 'debug' &&
      checking &&
      ['idle', 'lost', 'locateFailed', 'completed'].includes(e.event)
    ) {
      zs.setMode('tracking');
      zs.setExpected(null);
      await zs.setStructural(STRUCT_OFF);
      if (lastKey) {
        const [s, a] = lastKey.split(':').map(Number);
        zs.setHint({surah: s, ayah: a});
      }
      checking = false;
    }
  }
}

// Open flags are deferred as the app does (review_later), and recorded.
const flags = [];
function drain() {
  for (let i = 0; i < 64 && zs.correction.state.phase !== 'idle'; i++) {
    const issue = zs.correction.state.issue;
    if (issue)
      flags.push({
        t: +audioT.toFixed(2),
        kind: issue.kind,
        key: `${issue.surah}:${issue.ayah}`,
        word: issue.word,
      });
    zs.correct('review_later');
  }
}

// Every verdict change of every word, by audio time.
const vstate = new Map();
const vchanges = [];
function trackVerdicts() {
  for (const v of zs.verdicts()) {
    const id = `${v.surah}:${v.ayah}:${v.word}`;
    if (vstate.get(id) !== v.state) {
      vchanges.push({
        t: +audioT.toFixed(2),
        id,
        from: vstate.get(id) ?? null,
        to: v.state,
      });
      vstate.set(id, v.state);
    }
  }
}

let busy = 0;
for (let off = 0; off < audio.length; off += CHUNK) {
  const chunk = audio.subarray(off, Math.min(off + CHUNK, audio.length));
  audioT = (off + chunk.length) / SR;
  const t = performance.now();
  await zs.feed(chunk);
  busy += performance.now() - t;
  drain();
  if (flow === 'app') await appFlow();
  trackVerdicts();
}
drain();
const stopStart = performance.now();
await zs.stop();
const stopMs = Math.round(performance.now() - stopStart);
drain();
trackVerdicts();

const lags = [];
const seen = new Set();
if (timings) {
  for (const e of log) {
    if (e.type !== 'word_progress' || seen.has(`${e.key}:${e.w}`)) continue;
    seen.add(`${e.key}:${e.w}`);
    const ref = timings.get(e.key);
    if (ref && ref.length === e.n && ref[e.w]) lags.push(e.t - ref[e.w].end);
  }
}
lags.sort((a, b) => a - b);
const summary = {
  audio: path.basename(args.audio),
  flow,
  dwell: args.dwell ?? 'default',
  rtf: +(busy / 1000 / (audio.length / SR)).toFixed(3),
  stopMs,
  firstLock: log.find(e => e.type === 'word_progress')?.t ?? null,
  verseMatches: log.filter(e => e.type === 'verse_match').map(e => e.key),
  lockChanges: log
    .filter(
      e =>
        e.type === 'debug' &&
        ['lost', 'relocated', 'locateFailed', 'idle', 'completed'].includes(
          e.event,
        ),
    )
    .map(e => `${e.t}s ${e.event}`),
  followLagP50: lags.length
    ? +lags[Math.floor(lags.length / 2)].toFixed(2)
    : null,
  flags,
};
const result = {summary, log, flags, vchanges};
if (args.json) fs.writeFileSync(args.json, JSON.stringify(result));
console.log(JSON.stringify(summary));
