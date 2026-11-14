/* eslint-env node, es2020 */
// Bench probe (BENCH_PROBE=added/probe.mjs): logs the extra heard runs the engine
// copy under .out/added reports (`gap` on a word's verdict), once per run per
// tracker, with the scores of the words on both sides, for offline rule work.
const num = x => (typeof x === 'number' && Number.isFinite(x) ? +x.toFixed(3) : null);

const scores = v =>
  v
    ? {
        state: v.state,
        distance: num(v.distance),
        heardRatio: num(v.heardRatio),
        margin: num(v.margin),
        gop: num(v.gop),
        gopTwice: num(v.gopTwice),
        gopNone: num(v.gopNone),
        repGain: num(v.repGain),
        pairGop: num(v.pairGop),
      }
    : null;

const idOf = (c, g) => `${c.wordSurah[g]}:${c.wordAyah[g]}:${c.wordInAyah[g]}`;

export function createProbe({zs}) {
  let gaps = new Map();
  let locks = [];
  let lockIndex = -1;
  let lastTracer = null;
  let now = 0;

  function noteLock() {
    const tracer = zs.engine.tracer;
    if (!tracer || tracer === lastTracer) return;
    lastTracer = tracer;
    lockIndex += 1;
    const tk = tracer.tracker;
    locks.push({
      t: now,
      surah: tk.surah,
      start: idOf(tk.corpus, tk.firstWord + tk.localWordOfPos[Math.min(tk.startLocal, tk.len - 1)]),
      heardAtLock: tk.heard.length,
    });
  }

  function record(tracer, mode) {
    const out = tracer.lastOut;
    if (!out) return;
    const c = tracer.tracker.corpus;
    const byIndex = new Map(out.map(v => [v.wordIndex, v]));
    for (const v of out) {
      const g = v.gap;
      if (!g || v.state === 'pending') continue;
      const key = `${lockIndex}:${v.wordIndex}:${g.from}:${g.to}:${num(g.fitL)}:${num(g.fitR)}`;
      const left = byIndex.get(g.leftWord) ?? null;
      let rec = gaps.get(key);
      if (!rec) {
        rec = {
          lock: lockIndex,
          t: now,
          id: `${v.surah}:${v.ayah}:${v.word}`,
          left: idOf(c, g.leftWord),
          from: g.from,
          to: g.to,
          chars: g.chars,
          prev: g.prev ?? '',
          margin: num(g.margin),
          frameFrom: g.frameFrom,
          frameTo: g.frameTo,
          frames: g.frames ?? null,
          tokens: g.tokens ?? null,
          gapFrames: g.gapFrames ?? null,
          speech: g.speech ?? null,
          noGap: num(g.noGap),
          twiceL: num(g.twiceL),
          twiceR: num(g.twiceR),
          fitL: num(g.fitL),
          fitR: num(g.fitR),
          between: g.between,
          region: g.region,
          run: g.run,
          leftRun: g.leftRun,
          right0: scores(v),
          left0: scores(left),
          mode,
        };
        gaps.set(key, rec);
      }
      if (mode === 'live') rec.tLast = now;
      rec.rightLast = v.state;
      rec.leftLast = left ? left.state : null;
      if (mode === 'flush') rec.atFlush = true;
    }
  }

  return {
    start() {
      gaps = new Map();
      locks = [];
      lockIndex = -1;
      lastTracer = null;
      now = 0;
    },
    setTime(t) {
      now = t;
    },
    afterChunk() {
      noteLock();
      const tracer = zs.engine.tracer;
      if (tracer) record(tracer, 'live');
    },
    finish() {
      return {locks};
    },
    /** After the engine's stop(): the decoder's last sounds are in, as the
     * harness's flush reads them. */
    afterStop(tracerAtEnd) {
      const tracer = tracerAtEnd ?? zs.engine.tracer ?? lastTracer;
      let tail = null;
      let head = null;
      if (tracer) {
        tracer.verdicts(true);
        record(tracer, 'flush');
        const spans = tracer.lastSpans;
        const heard = tracer.tracker.heard;
        if (spans?.size) {
          const keys = [...spans.keys()].sort((a, b) => a - b);
          const text = (a, b) => heard.slice(a, b).map(h => h.ch).join('');
          const first = spans.get(keys[0]);
          const last = spans.get(keys[keys.length - 1]);
          if (first.from > 0) head = text(0, first.from);
          if (last.to < heard.length) tail = text(last.to, heard.length);
        }
      }
      return {gaps: [...gaps.values()], head, tail};
    },
  };
}
