/* eslint-env node, es2020 */
// Observer of a bench run for the junction experiment (BENCH_PROBE, bench.mjs).
// It changes nothing the engine does. For each take it records:
//
// - every crossing from one ayah into the next the tracker follows: what the
//   tracker heard on the words around the join, each time the cursor reaches the
//   next ayah's first, second, third and fourth word, with the verdicts then;
// - with JUNCTION_POST_DIR set, the take's CTC log-probabilities as one file of
//   uint8 rows (251 classes; value = round(-logp * 10), clipped at 255, so 0.1
//   nat steps down to -25.5), for scoring hypotheses offline. A decoder reset
//   starts a new epoch: `epochs` maps its frames to rows of the file.
import fs from 'node:fs';
import path from 'node:path';

const CLASSES = 251;
const POST_DIR = process.env.JUNCTION_POST_DIR ?? null;
const NEXT_WORDS = 4;
const LEFT_WORDS = 3;

const r3 = x => (typeof x === 'number' ? +x.toFixed(3) : null);

export function createProbe({zs}) {
  const post = zs.posteriors;
  const corpus = zs.corpus;
  let take = null;

  const origPush = post.push.bind(post);
  post.push = (logProbs, frames, firstFrame) => {
    if (take) capture(logProbs, frames, firstFrame);
    origPush(logProbs, frames, firstFrame);
  };

  function capture(logProbs, frames, firstFrame) {
    if (firstFrame !== take.nextFrame) {
      take.epochs.push({row: take.rows, firstFrame, t: take.t});
    }
    take.nextFrame = firstFrame + frames;
    take.rows += frames;
    if (!POST_DIR) return;
    const n = frames * CLASSES;
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const v = Math.round(-logProbs[i] * 10);
      out[i] = v > 255 ? 255 : v < 0 ? 0 : v;
    }
    take.chunks.push(out);
  }

  function spansNow(tracer) {
    const t = tracer.tracker;
    const segs = tracer.segment(t.trail);
    const spans = new Map();
    for (const seg of segs.slice(-4)) {
      for (const [w, sp] of tracer.alignSegment(seg)) spans.set(w, sp);
    }
    return spans;
  }

  function wordRow(t, spans, g, verdicts) {
    const w = g - t.firstWord;
    const sp = spans.get(w);
    const row = {g};
    if (sp && sp.to > sp.from) {
      row.from = sp.from;
      row.to = sp.to;
      row.run = sp.run;
      row.ff = t.heard[sp.from].frame;
      row.lf = t.heard[sp.to - 1].frame;
      row.ch = t.heard
        .slice(sp.from, sp.to)
        .map(h => h.ch)
        .join('');
    }
    const v = verdicts.get(g);
    if (v) {
      row.state = v.state;
      row.distance = r3(v.distance);
      row.heardRatio = r3(v.heardRatio);
      row.margin = r3(v.margin);
      row.gop = r3(v.gop);
      row.gopNone = r3(v.gopNone);
      row.gopTwice = r3(v.gopTwice);
    }
    return row;
  }

  function snapshot(tracer, L, m) {
    const t = tracer.tracker;
    const spans = spansNow(tracer);
    const verdicts = new Map(
      tracer.verdicts(false).map(v => [v.wordIndex, v]),
    );
    const words = [];
    for (let g = L - LEFT_WORDS; g <= L + NEXT_WORDS; g++) {
      if (g >= t.firstWord && g < t.endWord) {
        words.push(wordRow(t, spans, g, verdicts));
      }
    }
    const first = words.find(x => x.from !== undefined)?.from ?? 0;
    const heardAll = t.heard.slice(first);
    return {
      m,
      t: +take.t.toFixed(2),
      frames: zs.decoder.framesDecoded,
      epoch: take.epochs.length - 1,
      lost: !!t.lost,
      rate: r3(t.costRate(zs.cfg.holdWindow)),
      words,
      hc: heardAll.map(h => h.ch).join('\u0001'),
      hf: heardAll.map(h => h.frame),
    };
  }

  function observe() {
    const tracer = zs.engine.tracer;
    const t = zs.engine.tracker;
    if (!tracer || !t || zs.engine.state !== 'tracking' || !t.heard.length) return;
    if (take.lastTracker !== t) {
      take.lastTracker = t;
      take.seq += 1;
      take.minCursor = Infinity;
      take.joins.forEach(j => (j.open = false));
    }
    const cw = t.cursorWordIndex;
    take.minCursor = Math.min(take.minCursor, cw);
    // Joins passed by this tracker, from the cursor back over the next-word span.
    for (const j of take.joins) {
      if (!j.open) continue;
      for (const s of j.pending.slice()) {
        if (cw >= j.L + 1 + s) {
          j.snaps.push(snapshot(tracer, j.L, s));
          j.pending.splice(j.pending.indexOf(s), 1);
        }
      }
      if (!j.pending.length) j.open = false;
    }
    const s = corpus.wordSurah[cw];
    const a = corpus.wordAyah[cw];
    if (a <= 1) return;
    // The join into the ayah holding the cursor, and into any ayah it passed.
    // A lock that started after a join never followed it.
    for (let ay = a; ay >= 2; ay--) {
      const first = corpus.ayahFirstWord(s, ay);
      const L = first - 1;
      if (L < take.minCursor) break;
      const key = `${take.seq}:${L}`;
      if (take.seenJoin.has(key)) break;
      take.seenJoin.add(key);
      const join = {
        L,
        id: `${corpus.wordSurah[L]}:${corpus.wordAyah[L]}:${corpus.wordInAyah[L]}`,
        tracker: take.seq,
        crossT: +take.t.toFixed(2),
        open: true,
        pending: [0, 1, 2, 3],
        snaps: [],
      };
      for (const m of join.pending.slice()) {
        if (cw >= L + 1 + m) {
          join.snaps.push(snapshot(tracer, L, m));
          join.pending.splice(join.pending.indexOf(m), 1);
        }
      }
      take.joins.push(join);
    }
  }

  return {
    start(id) {
      take = {
        id,
        t: 0,
        rows: 0,
        nextFrame: null,
        epochs: [],
        chunks: [],
        joins: [],
        seenJoin: new Set(),
        seq: 0,
        lastTracker: null,
        minCursor: Infinity,
        checkTests: zs.junction?.tests ?? 0,
        checkMs: zs.junction?.ms ?? 0,
      };
    },
    setTime(t) {
      if (take) take.t = t;
    },
    afterChunk() {
      if (take) observe();
    },
    finish() {
      if (!take) return null;
      const out = {
        rows: take.rows,
        epochs: take.epochs,
        joins: take.joins.map(({open, pending, ...j}) => j),
      };
      if (zs.junction) {
        out.check = {tests: zs.junction.tests - take.checkTests, ms: +(zs.junction.ms - take.checkMs).toFixed(2)};
      }
      // Where the take stops: the words around the end of the ayah under the cursor.
      const tracer = zs.engine.tracer;
      const t = zs.engine.tracker;
      if (tracer && t && zs.engine.state === 'tracking' && t.heard.length) {
        const cw = t.cursorWordIndex;
        const s = corpus.wordSurah[cw];
        const a = corpus.wordAyah[cw];
        const L = corpus.ayahFirstWord(s, a) + corpus.ayahWordCount(s, a) - 1;
        out.end = {
          L,
          id: `${s}:${a}:${corpus.wordInAyah[L]}`,
          cursor: cw,
          ...snapshot(tracer, L, -1),
        };
      }
      if (POST_DIR) {
        fs.mkdirSync(POST_DIR, {recursive: true});
        const name = `${String(take.id).replace(/[^\w.-]/g, '_')}.u8`;
        const file = path.join(POST_DIR, name);
        const fd = fs.openSync(file, 'w');
        for (const c of take.chunks) fs.writeSync(fd, c);
        fs.closeSync(fd);
        out.post = name;
      }
      take = null;
      return out;
    },
  };
}
