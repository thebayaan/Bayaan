/* eslint-env node, es2020 */
// The follower, played back: a recorded run's verdicts and events at the audio times it
// reported them, and its real log-mel frames from the engine's own KaldiFbank. It answers
// what recitationEngine.ts answers, so the app above it cannot tell.
import {createRequire} from 'node:module';
import path from 'node:path';
import {BENCH, placesOf, restartsOf, wordCount} from '../lib.mjs';
import {quiet} from '../chain.mjs';

const ROOT = path.resolve(BENCH, '../..');
const {pathToFileURL} = createRequire(import.meta.url)('node:url');
const {KaldiFbank} = await import(
  pathToFileURL(
    path.join(ROOT, 'node_modules/@tilawa/core/dist/recitation/fbank.js'),
  ).href
);

const CHUNK = 7680;
const SR = 16000;
const BINS = 80;
// As much as the engine's own ring holds.
const HELD = 1000;
const LOCK = new Set(['located', 'relocated']);
const RESTART = new Set(['idle', 'completed']);

/**
 * The engine's own log-mel frames for this audio, chunk by chunk. At the end of a chunk
 * in `restarts` the features start again, as the session's do, and the frame that spans
 * the restart repeats the last one.
 */
export function melFramesOf(audio, restarts = new Set()) {
  const fbank = new KaldiFbank();
  const rows = [];
  const upTo = [];
  let frames = 0;
  let chunk = 0;
  for (let off = 0; off < audio.length; off += CHUNK) {
    const end = Math.min(off + CHUNK, audio.length);
    for (const row of fbank.acceptWaveform(audio.subarray(off, end))) {
      rows.push(row);
      frames += 1;
    }
    upTo.push(frames);
    if (restarts.has(chunk)) {
      fbank.reset();
      const next = Math.round(end / 160);
      while (frames > 0 && frames < next) {
        rows.push(rows[frames - 1]);
        frames += 1;
      }
    }
    chunk += 1;
  }
  const heardFrames = frames;
  for (const row of fbank.inputFinished()) {
    rows.push(row);
    frames += 1;
  }
  const data = new Float32Array(frames * BINS);
  rows.forEach((row, i) => data.set(row, i * BINS));
  return {data, frames, upTo, heardFrames};
}

/** The chunks at whose end the decoder started again. */
export function restartChunks(playback) {
  const out = new Set();
  playback.events.forEach((slot, i) => {
    if (slot.messages.some(m => m.type === 'debug' && RESTART.has(m.event))) {
      out.add(i);
    }
  });
  return out;
}

/** What the run reported, by chunk: its events, then its verdicts, as the wrapper would. */
export function playbackOf(run, audioLength) {
  const log = run.log.filter(e => !e.stop);
  const chunkOf = new Map();
  const times = [];
  for (let off = 0; off < audioLength; off += CHUNK) {
    const t = Math.min(off + CHUNK, audioLength) / SR;
    chunkOf.set(+t.toFixed(2), times.length);
    times.push(t);
  }
  const lastChunk = times.length - 1;
  const at = t =>
    chunkOf.get(t) ?? Math.min(lastChunk, Math.ceil(t / 0.48) - 1);
  const events = times.map(() => ({messages: [], changes: [], lock: null}));
  for (const e of log) {
    const slot = events[Math.max(0, at(e.t))];
    if (!slot) continue;
    if (e.type === 'word_progress') {
      const [surah, ayah] = e.key.split(':').map(Number);
      slot.messages.push({
        type: 'word_progress',
        surah,
        ayah,
        word_index: e.w,
        total_words: e.n,
        matched_indices: [],
      });
    } else if (e.type === 'debug') {
      slot.messages.push({type: 'debug', event: e.event, at: 0, data: {}});
      if (LOCK.has(e.event) && e.at) {
        const [surah, ayah, word] = e.at.split(':').map(Number);
        slot.lock = {surah, ayah, word};
      }
    } else if (e.type === 'verse_match') {
      const [surah, ayah] = e.key.split(':').map(Number);
      slot.messages.push({
        type: 'verse_match',
        surah,
        ayah,
        verse_text: '',
        surah_name: '',
        confidence: 1,
        surrounding_verses: [],
      });
    }
  }
  const flagMessage = f => {
    const [surah, ayah] = f.key.split(':').map(Number);
    return {
      type: 'correction',
      state: {
        phase: 'error',
        issue: {
          surah,
          ayah,
          word: f.word,
          wordIndex: f.word,
          kind: f.kind,
          source: f.source === 'word' ? undefined : f.source,
        },
        resume: null,
        attempt: 0,
        outcome: null,
      },
      totalWords: wordCount(surah, ayah) ?? 1,
    };
  };
  for (const f of run.flags ?? []) {
    if (f.stop) continue;
    const slot = events[Math.max(0, at(f.t))];
    if (slot) slot.messages.push(flagMessage(f));
  }
  for (const c of quiet(run).vchanges) {
    if (c.stop) continue;
    const slot = events[Math.max(0, at(c.t))];
    if (!slot) continue;
    const [surah, ayah, word] = c.id.split(':').map(Number);
    slot.changes.push({
      surah,
      ayah,
      word,
      totalWords: wordCount(surah, ayah) ?? word + 1,
      state: c.to,
      ...(c.d ? {detail: c.d} : {}),
      ...(c.from === c.to ? {repeat: true} : {}),
    });
  }
  return {
    times,
    events,
    stopFlags: (run.flags ?? []).filter(f => f.stop).map(flagMessage),
  };
}

/** Where the tracker put words, and when the cursor came in, as this run knew them. */
export function placesFrom(plainRun, marksRun, mode, clock, startedAt) {
  const seconds = () => (clock.now() - startedAt) / 1000;
  const {tracked} = placesOf(plainRun);
  const cursorIn = new Map();
  for (const e of plainRun.log) {
    if (e.type === 'word_progress' && !e.stop && !cursorIn.has(e.key)) {
      cursorIn.set(e.key, e.t);
    }
  }
  const log = marksRun.probe?.framesLog;
  if (mode === 'known' && log) {
    // As known at each moment, where the run kept it: ayah edges only. The run kept
    // them counted from the decoder's restart before each moment.
    const restarts = restartsOf(plainRun);
    const baseAt = t => 25 * (restarts.filter(r => r <= t + 1e-6).at(-1) ?? 0);
    return {
      wordFrames({surah, ayah, word}) {
        const id = `${surah}:${ayah}:${word}`;
        let found = null;
        for (const e of log) {
          if (e.t > seconds() + 1e-6) break;
          if (e.id === id && e.f !== null && e.l !== null) found = e;
        }
        if (!found) return null;
        const base = baseAt(found.t);
        return {from: found.f + base, to: found.l + base};
      },
      ayahEnteredAt(surah, ayah) {
        const t = cursorIn.get(`${surah}:${ayah}`);
        return t !== undefined && t <= seconds() + 1e-6 ? t : null;
      },
    };
  }
  // From the end of the take, as the bench's stand-in read them.
  return {
    wordFrames({surah, ayah, word}) {
      const w = tracked.get(`${surah}:${ayah}:${word}`);
      return w && w.from !== null && w.to !== null
        ? {from: w.from, to: w.to}
        : null;
    },
    ayahEnteredAt(surah, ayah) {
      return cursorIn.get(`${surah}:${ayah}`) ?? null;
    },
  };
}

/** The RecitationEngine the app holds, for one take at a time. */
export function createPlaybackEngine(onEvent) {
  let take = null;
  let chunk = -1;
  let melEnd = 0;
  const engine = {
    /** A new take's recording. */
    load(next) {
      take = next;
      chunk = -1;
      melEnd = 0;
    },
    /** The chunk's frames are there as soon as the engine starts on it. */
    feed(pcm) {
      if (!take || pcm.length === 0) return;
      chunk += 1;
      melEnd = take.mel.upTo[chunk] ?? melEnd;
    },
    /** The chunk's events, once the engine has been through it. */
    deliver(index, audioTime) {
      const {messages, changes, lock} = take.playback.events[index];
      for (const message of messages) onEvent(message);
      if (changes.length) {
        onEvent({
          type: 'word_verdicts',
          changes,
          audioTime,
          ...(lock ? {lock} : {}),
        });
      }
    },
    /** The harness's end-of-input verdicts, as one last chunk. */
    deliverFlush(changes, flags, audioTime) {
      melEnd = take.mel.frames;
      for (const flag of flags) onEvent(flag);
      if (changes.length) {
        onEvent({type: 'word_verdicts', changes, audioTime});
      }
    },
    stop: async () => [],
    reset: () => undefined,
    setHint: () => undefined,
    setMode: () => undefined,
    setExpected: () => undefined,
    setStructural: () => undefined,
    correct: async () => [],
    readMelFrames(from, to) {
      const first = Math.max(from, Math.max(0, melEnd - HELD));
      const frames = Math.max(0, Math.min(to, melEnd) - first);
      return {
        first,
        frames,
        data: take.mel.data.slice(first * BINS, (first + frames) * BINS),
      };
    },
    wordFrames: word => take.places.wordFrames(word),
    ayahEnteredAt: (surah, ayah) => take.places.ayahEnteredAt(surah, ayah),
    wordCount: (surah, ayah) => wordCount(surah, ayah) ?? 0,
    getStats: () => ({
      audioSeconds: 0,
      busyMs: 0,
      ortMs: 0,
      maxFeedMs: 0,
      backlog: 0,
      loadMs: 0,
      chunks: 0,
      lastError: null,
    }),
    dispose: async () => undefined,
  };
  return engine;
}
