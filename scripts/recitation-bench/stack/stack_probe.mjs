/* eslint-env node, es2020 */
// Bench probe for the engine stack: records what the app would read from the patched
// session at each chunk, and checks the log-mel ring against whole-stream features.
//   BENCH_PROBE=<this> TILAWA_DIST=.out/engine-stack/dist node bench.mjs ...
import path from 'node:path';
const BENCH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
);
const {KaldiFbank} = await import(
  path.join(process.env.TILAWA_DIST, 'recitation/fbank.js')
);
const {fbank} = await import(path.join(BENCH, 'judge/fbank.mjs'));
const num = x =>
  typeof x === 'number' && Number.isFinite(x) ? +x.toFixed(3) : null;

export function createProbe({zs}) {
  let pieces = [];
  let framesLog = [];
  let gaps = new Map();
  let locks = [];
  let reads = [];
  let lockIndex = -1;
  let lastTracer = null;
  let now = 0;
  let lastOut = [];
  let seen = new Map();
  const origVerdicts = zs.verdicts.bind(zs);
  zs.verdicts = () => {
    lastOut = origVerdicts();
    return lastOut;
  };
  const origFeed = zs.feed.bind(zs);
  zs.feed = pcm => {
    pieces.push(pcm.slice());
    return origFeed(pcm);
  };
  let chunk = 0;
  return {
    start() {
      pieces = [];
      framesLog = [];
      gaps = new Map();
      locks = [];
      reads = [];
      lockIndex = -1;
      lastTracer = null;
      now = 0;
      lastOut = [];
      seen = new Map();
      chunk = 0;
    },
    setTime(t) {
      now = t;
    },
    afterChunk() {
      chunk += 1;
      const tracer = zs.engine.tracer;
      if (tracer && tracer !== lastTracer) {
        lastTracer = tracer;
        lockIndex += 1;
        seen.clear();
        locks.push({t: now});
      }
      for (const v of lastOut) {
        const g = v.gap;
        if (!g || v.state === 'pending') continue;
        const key = `${lockIndex}:${v.wordIndex}:${g.from}:${g.to}:${num(g.fitL)}:${num(g.fitR)}`;
        if (!gaps.has(key)) {
          const c = zs.corpus;
          gaps.set(key, {
            lock: lockIndex,
            t: now,
            id: `${v.surah}:${v.ayah}:${v.word}`,
            left: `${c.wordSurah[g.leftWord]}:${c.wordAyah[g.leftWord]}:${c.wordInAyah[g.leftWord]}`,
            from: g.from,
            to: g.to,
            chars: g.chars,
            prev: g.prev,
            noGap: num(g.noGap),
            fitL: num(g.fitL),
            fitR: num(g.fitR),
            mode: 'live',
          });
        }
      }
      if (tracer) {
        const spans = tracer.lastSpans;
        const t = tracer.tracker;
        const c = t.corpus;
        for (const [w, sp] of spans) {
          if (!(sp.to > sp.from)) continue;
          const g = t.firstWord + w;
          const inAyah = c.wordInAyah[g];
          const total = c.ayahWordCount(c.wordSurah[g], c.wordAyah[g]);
          if (inAyah !== 0 && inAyah !== total - 1) continue;
          const id = `${c.wordSurah[g]}:${c.wordAyah[g]}:${inAyah}`;
          const got = zs.wordFrames(c.wordSurah[g], c.wordAyah[g], inAyah);
          const key = got ? `${got.from}:${got.to}` : 'null';
          if (seen.get(id) === key) continue;
          seen.set(id, key);
          framesLog.push({
            t: +now.toFixed(2),
            id,
            f: got?.from ?? null,
            l: got?.to ?? null,
            lock: lockIndex,
          });
        }
      }
      // A read of the last 8 s every 10 chunks, as the second model would make.
      if (chunk % 10 === 0) {
        const end = Math.floor((pieces.length * 7680 - 280) / 160) + 1;
        reads.push(zs.readMelFrames(end - 800, end));
      }
    },
    finish() {
      const total = pieces.reduce((n, p) => n + p.length, 0);
      const audio = new Float32Array(total);
      let at = 0;
      for (const p of pieces) {
        audio.set(p, at);
        at += p.length;
      }
      const whole = new KaldiFbank().acceptWaveform(audio);
      const judge = fbank(audio);
      let compared = 0;
      let exact = 0;
      let worstKaldi = 0;
      let worstJudge = 0;
      let meanJudge = 0;
      let framesRead = 0;
      for (const r of reads) {
        for (let f = 0; f < r.frames; f++) {
          framesRead += 1;
          const row = r.data.subarray(f * 80, (f + 1) * 80);
          const k = whole[r.first + f];
          for (let b = 0; b < 80; b++) {
            compared += 1;
            const d = Math.abs(row[b] - k[b]);
            if (d === 0) exact += 1;
            if (d > worstKaldi) worstKaldi = d;
            const j = Math.abs(row[b] - judge.data[(r.first + f) * 80 + b]);
            meanJudge += j;
            if (j > worstJudge) worstJudge = j;
          }
        }
      }
      return {
        locks,
        framesLog,
        gaps: [...gaps.values()],
        mel: {
          reads: reads.length,
          framesRead,
          compared,
          exact,
          worstKaldi,
          worstJudge,
          meanJudge: compared ? meanJudge / compared : 0,
          firstFrames: reads.slice(0, 2).map(r => [r.first, r.frames]),
        },
      };
    },
  };
}
