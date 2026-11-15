/* eslint-env node, es2020 */
// Recitation bench: runs the app's own @tilawa/core build (repo
// node_modules, patched) on 16 kHz mono float32 audio in the mic's 480 ms
// chunks, and writes what the reader would see: lock time, word follow lag
// against reference word timings, verse matches, correction flags and every
// per-word verdict change.
//
//   node scripts/recitation-bench/bench.mjs --audio a.f32 [--timings qdc.json]
//     [--flow app|correction|tracking] [--dwell N] [--json out.json]
//   node scripts/recitation-bench/bench.mjs --list manifest.json --outdir dir
//     [--dwell N] [--only correct|incorrect] [--limit N]
//
// TILAWA_DIST=<dir> loads another build of the engine (a patched copy), and
// ENGINE_OPTS='<json>' adds or overrides session options. As in the app,
// keepContextOnDefer and config.wholeWordAtCut are on unless ENGINE_OPTS turns
// them off (e.g. {"keepContextOnDefer":false,"config":{"wholeWordAtCut":false}}).
// The app also passes `junction`, `config.gapReport` and `config.cutAtJump`, from
// services/recitation/followerConstants.npl.json. Here they stay off unless
// ENGINE_OPTS passes them, so runs stay comparable with the saved baselines.
// ORT_THREADS=n caps the threads one bench uses.
// A manifest clip may carry `hint` ({surah, ayah}): the ayah on screen, which
// the app passes at the start of a take. It may also carry:
//   parts: [{audio, key}]   recordings fed one after another as one take, in
//                           the given order, untouched; the result's `partsAt`
//                           says when each ran (instead of `audio`);
//   expected: {surah, ayah, ayahEnd?, word?}
//                           start the take in the app's correction state with
//                           this passage (natural/README.md), not in tracking.
//                           ayahEnd defaults to the app's ten-ayah passage;
//                           `word` locks on that word of the ayah instead of
//                           the first (a recording that starts mid-ayah);
//   flush: true             harness-only end-of-input flush, see endFlush();
//   trackAt: {t, surah, ayah, word?, ayahEnd?}
//                           the model hears the recording from its start, but the
//                           tracker starts only when audio time t (seconds) is
//                           decoded, on that word, in the app's correction state,
//                           with the sounds heard since t: as a lock on that word
//                           (natural/junction/README.md).
// On one recording: --expected 7:61[-67] and --flush 1.
// BENCH_PROBE=<module> adds an observer of each run: its createProbe({zs})
// returns {start(id), setTime(t), afterChunk(), finish()}, and what finish()
// returns lands in the run's `probe`, with what an optional afterStop(tracer)
// returns once the decoder has flushed. Off by default.
//
// --flow app (default) copies RecitationTrackingService: start tracking; at
// each lock switch to correction expecting ten ayat from the lock, sliding
// forward as the reader nears the end; on idle/lost/locateFailed/completed go
// back to tracking near the last ayah. --flow correction expects the whole
// surah from the start (--surah). --list runs every clip of a dataset
// manifest ([{id, audio, label, ...}]) in one process, the engine reset
// between clips as between takes, and skips clips already done.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(HERE, '.out');
const SR = 16000;
const CHUNK = 7680; // 480 ms, as micStream

// Hafs ayah counts, as the app's SURAHS data (surahLength).
const AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111,
  110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45,
  83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55,
  78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20,
  56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21,
  11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];
if (AYAH_COUNTS.reduce((a, b) => a + b, 0) !== 6236) {
  throw new Error('ayah counts do not add up to 6236');
}
const surahLength = s => AYAH_COUNTS[s - 1] ?? 1;

const require = createRequire(path.join(HERE, 'package.json'));
const ort = require('onnxruntime-node');
// The app's patch loads structural-index.json with Metro's require.
const tilawaDir =
  process.env.TILAWA_DIST ?? path.join(ROOT, 'node_modules/@tilawa/core/dist');
const engineOpts = process.env.ENGINE_OPTS
  ? JSON.parse(process.env.ENGINE_OPTS)
  : {};
globalThis.require = createRequire(
  path.join(tilawaDir, 'recitation/session.js'),
);
const tilawa = await import(path.join(tilawaDir, 'index.js'));

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
}
const flow = args.flow ?? 'app';
const flushArg = args.flush !== undefined && args.flush !== '0';

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

const ortSession = await ort.InferenceSession.create(
  path.join(OUT, 'assets/zipformer_a0w_ep1_a05.int8.onnx'),
  {
    executionProviders: ['cpu'],
    // ORT_THREADS=n caps ORT's threads, to run several benches at once.
    ...(process.env.ORT_THREADS
      ? {
          intraOpNumThreads: Number(process.env.ORT_THREADS),
          interOpNumThreads: 1,
        }
      : {}),
  },
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

// Per-clip state, reset by runClip.
let audioT = 0;
let log = [];
let flags = [];
let vchanges = [];
const vstate = new Map();
const vjunction = new Map();
// Tracker health changes (engines that expose trackingHealth()).
let health = [];
let lastHealth = null;
// RMS level of each 480 ms chunk, as the app's mic would measure it.
let levels = [];
// Changes after stop() never reach the app (recitationEngine.stop does not
// report verdicts), so the replay skips them.
let stopped = false;
// Each word's last verdict before stop(), for the end-of-input flush.
const liveState = new Map();

function trackHealth() {
  const h =
    typeof zs.trackingHealth === 'function' ? zs.trackingHealth() : null;
  const key = h ? `${h.lost}:${h.held}` : 'none';
  if (key !== lastHealth) {
    health.push({
      t: +audioT.toFixed(2),
      ...(h
        ? {lost: !!h.lost, held: !!h.held, rate: +(h.rate ?? 0).toFixed(3)}
        : {none: true}),
    });
    lastHealth = key;
  }
}

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
    case 'correction': {
      // Flags in the order the app hears them (its skipped-ayah rule).
      const issue = msg.state?.issue;
      return {
        type: msg.type,
        phase: msg.state?.phase,
        ...(issue
          ? {
              kind: issue.kind,
              key: `${issue.surah}:${issue.ayah}`,
              word: issue.word,
              source: issue.source ?? 'word',
            }
          : {}),
      };
    }
    case 'debug': {
      // Where a lock landed (located/relocated carry the hit word).
      const d = msg.data ?? {};
      const at =
        typeof d.surah === 'number'
          ? {at: `${d.surah}:${d.ayah}:${d.word}`}
          : d.to && typeof d.to.surah === 'number'
            ? {at: `${d.to.surah}:${d.to.ayah}:${d.to.word}`}
            : {};
      return {
        type: msg.type,
        event: msg.event,
        ...at,
        ...(d.reason ? {reason: d.reason} : {}),
      };
    }
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
  onEvent: msg =>
    log.push({
      t: +audioT.toFixed(2),
      ...pick(msg),
      // Stop-time events: the app has stopped listening by then.
      ...(stopped ? {stop: true} : {}),
    }),
  structural: flow === 'correction' ? undefined : false,
  enableFallback: false,
  debug: true,
  // The app's engine options (recitationEngine.ts).
  keepContextOnDefer: true,
  ...engineOpts,
  config: {
    wholeWordAtCut: true,
    // The app's commitDwell (recitationEngine.ts COMMIT_DWELL).
    commitDwell: Number(args.dwell ?? 2),
    ...(engineOpts.config ?? {}),
  },
});

const probe = process.env.BENCH_PROBE
  ? (await import(path.resolve(process.env.BENCH_PROBE))).createProbe({zs})
  : null;

const STRUCT_ON = {ayahOrder: true, similarVerse: true};
const STRUCT_OFF = {ayahOrder: false, similarVerse: false};
// As PASSAGE_AYAT and SLIDE_WITHIN in RecitationTrackingService.
const PASSAGE_AYAT = 10;
const SLIDE_WITHIN = 3;
let checking = false;
let expectedSurah = 0;
let expectedEnd = 0;
let flowSeen = 0;
let lastKey = null;
// Ayat the take flagged as skipped (the service ignores their matches).
const skippedKeys = new Set();

async function appFlow() {
  for (; flowSeen < log.length; flowSeen++) {
    const e = log[flowSeen];
    if (e.type === 'word_progress') {
      lastKey = e.key;
      if (!checking) {
        const [s, a] = e.key.split(':').map(Number);
        zs.setMode('correction');
        expectedSurah = s;
        expectedEnd = Math.max(
          a,
          Math.min(surahLength(s), a + PASSAGE_AYAT - 1),
        );
        zs.setExpected({surah: s, ayah: a, ayahEnd: expectedEnd});
        await zs.setStructural(STRUCT_ON);
        checking = true;
      }
    } else if (
      e.type === 'correction' &&
      e.phase === 'error' &&
      e.kind === 'possible_skipped_ayah'
    ) {
      skippedKeys.add(e.key);
    } else if (e.type === 'verse_match' && checking) {
      // As the service: a match on an ayah flagged as skipped is ignored.
      if (skippedKeys.has(e.key)) continue;
      // As slidePassage in RecitationTrackingService.
      const [s, a] = e.key.split(':').map(Number);
      if (
        s === expectedSurah &&
        expectedEnd < surahLength(s) &&
        a > expectedEnd - SLIDE_WITHIN
      ) {
        const from = Math.max(1, a - 1);
        expectedEnd = Math.max(
          from,
          Math.min(surahLength(s), from + PASSAGE_AYAT - 1),
        );
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
function drain() {
  for (let i = 0; i < 64 && zs.correction.state.phase !== 'idle'; i++) {
    const issue = zs.correction.state.issue;
    if (issue)
      flags.push({
        t: +audioT.toFixed(2),
        kind: issue.kind,
        key: `${issue.surah}:${issue.ayah}`,
        word: issue.word,
        source: issue.source ?? 'word',
        ...(stopped ? {stop: true} : {}),
      });
    zs.correct('review_later');
  }
}

// Every verdict change of every word, by audio time.
function trackVerdicts() {
  for (const v of zs.verdicts()) {
    const id = `${v.surah}:${v.ayah}:${v.word}`;
    // A patched engine's junction check can add its result without a new state.
    if (vstate.get(id) !== v.state || vjunction.get(id) !== v.junctionMissing) {
      const change = {
        t: +audioT.toFixed(2),
        id,
        from: vstate.get(id) ?? null,
        to: v.state,
      };
      // The engine's scores behind every verdict (noise vs slips, letter
      // and vowel recall); pending ones are provisional and left out.
      if (v.state !== 'pending') {
        const r = x => (typeof x === 'number' ? +x.toFixed(3) : null);
        change.d = {
          distance: r(v.distance),
          heardRatio: r(v.heardRatio),
          margin: r(v.margin),
          gop: r(v.gop),
          gopNone: r(v.gopNone),
          gopTwice: r(v.gopTwice),
          vowelErrors: v.vowelErrors ?? null,
          vowelMargin: r(v.vowelMargin),
          slip: r(v.slip),
          ...(v.vowelDetails ? {vowels: v.vowelDetails} : {}),
          ...(v.junctionMissing !== undefined
            ? {junction: r(v.junction), junctionMissing: v.junctionMissing}
            : {}),
        };
      }
      if (stopped) change.stop = true;
      else liveState.set(id, v.state);
      vchanges.push(change);
      vstate.set(id, v.state);
      vjunction.set(id, v.junctionMissing);
    }
  }
}

/**
 * Harness-only end-of-input flush, so a clip's last word can be judged. The
 * app never does this: it reads verdicts unsettled, where the word the cursor
 * is on stays pending until sounds of a later word arrive, and it stops
 * listening at stop(). After the engine's own stop() (its 2 s tail and decoder
 * flush) this asks the tracker that followed the clip for settled verdicts: no
 * dwell, cursor word judged, last stretch aligned through the ayah's end.
 * Returned apart from vchanges, each verdict tagged `flush`, so nothing here
 * can pass for what the app heard. `newly` marks words the live verdicts left
 * pending or never reported.
 */
function endFlush(tracer) {
  if (!tracer) return {tailSec: 2, tracker: false, verdicts: [], words: []};
  const r = x => (typeof x === 'number' ? +x.toFixed(3) : null);
  const verdicts = tracer.verdicts(true).map(v => {
    const id = `${v.surah}:${v.ayah}:${v.word}`;
    const live = liveState.get(id) ?? null;
    return {
      flush: true,
      id,
      state: v.state,
      live,
      newly: live === null || live === 'pending',
      d: {
        distance: r(v.distance),
        heardRatio: r(v.heardRatio),
        margin: r(v.margin),
        gop: r(v.gop),
        gopNone: r(v.gopNone),
        gopTwice: r(v.gopTwice),
        vowelErrors: v.vowelErrors ?? null,
        vowelMargin: r(v.vowelMargin),
      },
    };
  });
  return {
    tailSec: 2,
    tracker: true,
    verdicts,
    words: heardWords(tracer),
    transcript: tracer.tracker.heard.map(h => h.ch).join(''),
  };
}

/**
 * What the tracker heard on each word at the end of the take, by the settled
 * alignment the verdicts use: the phonemes and their decoder frames (25 a
 * second). Reads the tracer without changing it.
 */
function heardWords(tracer) {
  const t = tracer.tracker;
  const segs = tracer.segment(t.trail);
  if (tracer.anchorAyahEnd > 0 && segs.length) {
    const last = segs[segs.length - 1];
    const end = tracer.ayahEndCell(last.refTo);
    if (end > last.refTo) last.refTo = end;
  }
  const spans = new Map();
  for (const seg of segs) {
    for (const [w, sp] of tracer.alignSegment(seg)) spans.set(w, sp);
  }
  const c = t.corpus;
  return [...spans.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([w, sp]) => {
      const g = t.firstWord + w;
      return {
        id: `${c.wordSurah[g]}:${c.wordAyah[g]}:${c.wordInAyah[g]}`,
        heard: t.heard
          .slice(sp.from, sp.to)
          .map(h => h.ch)
          .join(''),
        from: t.heard[sp.from]?.frame ?? null,
        to: t.heard[sp.to - 1]?.frame ?? null,
        run: sp.run,
      };
    });
}

/** One recording, or several played in order as one take. */
function loadAudio(audioPath, parts) {
  const read = file => new Float32Array(fs.readFileSync(file).buffer.slice(0));
  if (!parts) return {audio: read(audioPath), partsAt: null};
  const pieces = parts.map(p => read(p.audio));
  const audio = new Float32Array(pieces.reduce((n, x) => n + x.length, 0));
  const partsAt = [];
  let at = 0;
  pieces.forEach((piece, i) => {
    audio.set(piece, at);
    partsAt.push({
      key: parts[i].key ?? null,
      start: +(at / SR).toFixed(3),
      end: +((at + piece.length) / SR).toFixed(3),
    });
    at += piece.length;
  });
  return {audio, partsAt};
}

const TRACK_AT_HISTORY = 120; // cfg.lostWindow: the window the lost rate looks over
/** A clip's `trackAt`: the app's correction state, locked on a word now. */
async function trackFrom({t, surah: s, ayah: a, word = 0, ayahEnd}) {
  delete zs.engine.feedSearching;
  expectedSurah = s;
  expectedEnd =
    ayahEnd ?? Math.max(a, Math.min(surahLength(s), a + PASSAGE_AYAT - 1));
  checking = true;
  zs.setMode('correction');
  zs.setExpected({surah: s, ayah: a, ayahEnd: expectedEnd});
  await zs.setStructural(STRUCT_ON);
  const from = Math.floor(t * 25) - 1;
  const replay = zs.engine.buffer.filter(c => c.frame >= from);
  const events = zs.engine.lock(
    zs.corpus.wordIndex(s, a, word),
    replay,
    'located',
  );
  // In the app the reader has been followed up to here, so the tracker's cost rate
  // has this much clean history behind it, not the few sounds since this lock.
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

/** Runs one recitation through the engine, fresh as a new take. */
async function runClip(audioPath, timingsPath, hint = null, opts = {}) {
  const {audio, partsAt} = loadAudio(audioPath, opts.parts);
  const timings = loadTimings(timingsPath);
  zs.reset();
  probe?.start(opts.id ?? audioPath ?? 'parts');
  zs.setHint(hint);
  zs.setExpected(null);
  await zs.setStructural(STRUCT_OFF);
  audioT = 0;
  log = [];
  flags = [];
  vchanges = [];
  vstate.clear();
  vjunction.clear();
  liveState.clear();
  health = [];
  lastHealth = null;
  levels = [];
  stopped = false;
  flowSeen = 0;
  lastKey = null;
  skippedKeys.clear();
  checking = flow === 'correction';
  if (opts.expected) {
    // The app's correction state with a chosen passage, as startCorrection
    // leaves it after a lock, then the app flow from there on.
    const {surah: s, ayah: a} = opts.expected;
    expectedSurah = s;
    expectedEnd =
      opts.expected.ayahEnd ??
      Math.max(a, Math.min(surahLength(s), a + PASSAGE_AYAT - 1));
    checking = true;
    zs.setMode('correction');
    zs.setExpected({surah: s, ayah: a, ayahEnd: expectedEnd});
    await zs.setStructural(STRUCT_ON);
    if (opts.expected.word) zs.engine.track(s, a, opts.expected.word);
  } else if (flow === 'correction') {
    const s = Number(args.surah ?? 0) || 1;
    zs.setMode('correction');
    zs.setExpected({surah: s, ayah: 1, ayahEnd: surahLength(s)});
    await zs.setStructural(STRUCT_ON);
  } else {
    zs.setMode('tracking');
  }

  let waiting = opts.trackAt ?? null;
  if (waiting) {
    // Until then the model hears the recording and the tracker waits.
    checking = false;
    zs.setMode('tracking');
    zs.engine.feedSearching = () => [];
  }

  let busy = 0;
  // The tracker that followed the take: completed and idle drop it mid-stop.
  let lastTracer = null;
  for (let off = 0; off < audio.length; off += CHUNK) {
    const chunk = audio.subarray(off, Math.min(off + CHUNK, audio.length));
    audioT = (off + chunk.length) / SR;
    probe?.setTime(audioT);
    let energy = 0;
    for (let i = 0; i < chunk.length; i++) energy += chunk[i] * chunk[i];
    levels.push(+Math.sqrt(energy / Math.max(1, chunk.length)).toPrecision(3));
    const t = performance.now();
    await zs.feed(chunk);
    busy += performance.now() - t;
    drain();
    if (waiting && zs.decoder.framesDecoded >= (waiting.t + 0.32) * 25) {
      await trackFrom(waiting);
      waiting = null;
    }
    if (flow === 'app' || opts.expected) await appFlow();
    trackVerdicts();
    trackHealth();
    probe?.afterChunk();
    lastTracer = zs.engine.tracer ?? lastTracer;
  }
  drain();
  // The last state of every word the app saw, with its scores.
  const finalVerdicts = zs.verdicts().map(v => ({
    id: `${v.surah}:${v.ayah}:${v.word}`,
    state: v.state,
    distance: typeof v.distance === 'number' ? +v.distance.toFixed(3) : null,
    gop: typeof v.gop === 'number' ? +v.gop.toFixed(3) : null,
    margin: typeof v.margin === 'number' ? +v.margin.toFixed(3) : null,
    heardRatio:
      typeof v.heardRatio === 'number' ? +v.heardRatio.toFixed(3) : null,
    vowelErrors: v.vowelErrors ?? null,
    vowelMargin:
      typeof v.vowelMargin === 'number' ? +v.vowelMargin.toFixed(3) : null,
    ...(v.vowelDetails ? {vowels: v.vowelDetails} : {}),
  }));
  // The tracker at the end of the audio. An engine that just finished the
  // surah dropped it inside this take's last chunks; one that was searching
  // has none, and the flush then judges nothing.
  const tracerAtEnd =
    zs.engine.tracer ??
    (log.findLast(
      e =>
        e.type === 'debug' &&
        ['located', 'relocated', 'idle', 'locateFailed', 'completed'].includes(
          e.event,
        ),
    )?.event === 'completed'
      ? lastTracer
      : null);
  const probeResult = probe?.finish();
  stopped = true;
  const stopStart = performance.now();
  await zs.stop();
  const stopMs = Math.round(performance.now() - stopStart);
  drain();
  trackVerdicts();
  const flush = opts.flush ? endFlush(tracerAtEnd) : undefined;
  const probeAfterStop = probe?.afterStop?.(tracerAtEnd);

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
    audio: audioPath ? path.basename(audioPath) : 'parts',
    seconds: +(audio.length / SR).toFixed(2),
    flow,
    dwell: Number(args.dwell ?? 2),
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
  return {
    summary,
    log,
    flags,
    vchanges,
    health,
    finalVerdicts,
    levels,
    ...(partsAt ? {partsAt} : {}),
    ...(flush ? {flush} : {}),
    ...(probeResult ? {probe: {...probeResult, ...probeAfterStop}} : {}),
  };
}

if (args.list) {
  const manifest = JSON.parse(fs.readFileSync(args.list, 'utf8'));
  const outdir = args.outdir;
  fs.mkdirSync(outdir, {recursive: true});
  let todo = manifest.filter(c => !args.only || c.label === args.only);
  if (args.limit) todo = todo.slice(0, Number(args.limit));
  let done = 0;
  for (const clip of todo) {
    const out = path.join(
      outdir,
      `${String(clip.id).replace(/[^\w.-]/g, '_')}.json`,
    );
    done += 1;
    if (fs.existsSync(out)) continue;
    try {
      const result = await runClip(clip.audio, null, clip.hint ?? null, {
        parts: clip.parts,
        expected: clip.expected,
        flush: clip.flush ?? flushArg,
        id: clip.id,
        trackAt: clip.trackAt,
      });
      result.clip = clip;
      // Written whole or not at all: a killed run must not leave a file that
      // looks finished.
      fs.writeFileSync(`${out}.tmp`, JSON.stringify(result));
      fs.renameSync(`${out}.tmp`, out);
    } catch (error) {
      console.error(`clip ${clip.id} failed: ${error.message}`);
    }
    if (done % 50 === 0) console.log(`${done}/${todo.length}`);
  }
  console.log(`done ${todo.length}`);
} else {
  const result = await runClip(
    args.audio,
    args.timings,
    args.hint
      ? {
          surah: Number(args.hint.split(':')[0]),
          ayah: Number(args.hint.split(':')[1]),
        }
      : null,
    {
      flush: flushArg,
      ...(args.expected
        ? (() => {
            const [s, range] = args.expected.split(':');
            const [a, end] = range.split('-').map(Number);
            return {
              expected: {
                surah: Number(s),
                ayah: a,
                ...(end ? {ayahEnd: end} : {}),
              },
            };
          })()
        : {}),
    },
  );
  if (args.json) fs.writeFileSync(args.json, JSON.stringify(result));
  console.log(JSON.stringify(result.summary));
}
