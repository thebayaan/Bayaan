/* eslint-env node, es2020 */
// Scores bench runs of real learner takes (make_takes.py) with the app's own
// mark rules, through replay2.mjs (WORD_MARKS=<file> replays other rules).
//
//   node scripts/recitation-bench/score_real.mjs [--runs .out/real2]
//     [--takes .out/takes] [--marks <file.jsonl>] [--json <summary.json>]
//     [dataset ...]
//
// A take is a professional reciter's lead-in (or a reader's own earlier
// ayat) followed by learner audio; its `segments` give each piece's time in
// the take and its ayah/word span. A shown mark (engine id s:a:w, 0-based)
// belongs to a learner segment when it sits inside that segment's span and
// was raised no earlier than 0.5 s before the segment started. It is then:
//   hit            on a labelled error word (manifest word w+1 exactly)
//   near           within one word of a labelled error word (a hit with
//                  +-1 tolerance, a false mark without)
//   false-correct  on a segment labelled correct
//   false-incorrect on a non-error word of a segment labelled incorrect
//   on-incorrect   on a segment labelled incorrect that has no word labels
//                  (retasy): neither hit nor false
//   unknown        on a segment without a label, or past its labelled ayah
//                  (sobolev extendsTo)
// Marks on a lead-in's words are `lead`; marks on no segment's words are
// `elsewhere`. Cold segments (a clip run alone from a surah's first word)
// are tallied in their own row.
//
// Prints per dataset: learner minutes (all, after the take's first lock, and
// judged: also the opening words the lock replays), marks by class,
// skipped-ayah flags (on an ayah the learner read, so false, or elsewhere),
// false marks that stay red per judged labelled learner minute (corrected
// ones apart), recall of labelled error words heard after the first lock by
// error class (exact and +-1), how many of those words were judged at all,
// the share of clips with a mark (clip-label sets), and whether each lead-in
// did its job (locked, cursor on the clip's first word, how its last word
// was judged). Extra rows: QuranMB clips whose text matched the Quran
// exactly, RetaSy's expert-labelled clips. Control takes (make_takes.py
// --control) score the same way: their continuation is labelled correct.
// Writes every shown mark with its class and features to --marks (default
// <runs>/marks.jsonl); --json writes the tallies.
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const {replayRun} = await import(path.join(HERE, 'replay2.mjs'));

const args = {datasets: []};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i];
  else args.datasets.push(a);
}
const RUNS = path.resolve(args.runs ?? path.join(HERE, '.out/real2'));
const TAKES = path.resolve(args.takes ?? path.join(HERE, '.out/takes'));
const MARKS = path.resolve(args.marks ?? path.join(RUNS, 'marks.jsonl'));
const DATASETS = args.datasets.length
  ? args.datasets
  : ['al-ikhlas', 'sobolev-errors', 'quranmb', 'retasy', 'qdat-bench'].filter(
      d => fs.existsSync(path.join(RUNS, d)),
    );
// Datasets whose 'incorrect' label has no word-level errors behind it.
const CLIP_LABEL_ONLY = new Set(['retasy', 'qdat-bench']);
const UNLOCK = new Set(['lost', 'idle', 'locateFailed', 'completed']);
const LOCK = new Set(['located', 'relocated']);
const TIME_SLACK = 0.5;

// ------------------------------------------------------------ word numbers

// Engine words per ayah, and the ayat where the engine splits a manifest
// word (make_takes.py's wordmap.json): elsewhere engine w is manifest w + 1.
const corpus = JSON.parse(
  fs.readFileSync(path.join(HERE, '.out/assets/zipformer_quran.json'), 'utf8'),
);
const engineWords = new Map();
for (const s of corpus.surahs)
  for (const a of s.ayahs) engineWords.set(`${s.n}:${a.n}`, a.w.length);
const wordmapFile = path.join(TAKES, 'wordmap.json');
const wordmap = fs.existsSync(wordmapFile)
  ? JSON.parse(fs.readFileSync(wordmapFile, 'utf8'))
  : {engineToManifest: {}, excluded: []};
const splitAyat = wordmap.engineToManifest ?? {};
const excludedAyat = new Set((wordmap.excluded ?? []).map(e => e.ayah));

/** 1-based manifest word of engine word w (0-based). */
const toManifest = (s, a, w) => splitAyat[`${s}:${a}`]?.[w] ?? w + 1;
/** Engine words (0-based) that make up manifest word mw. */
function toEngine(s, a, mw) {
  const m = splitAyat[`${s}:${a}`];
  if (!m) return [mw - 1];
  return m.flatMap((x, i) => (x === mw ? [i] : []));
}
function manifestWords(s, a) {
  const m = splitAyat[`${s}:${a}`];
  return m ? m[m.length - 1] : engineWords.get(`${s}:${a}`) ?? 0;
}
const cmp = (a1, w1, a2, w2) => (a1 !== a2 ? a1 - a2 : w1 - w2);

/** The segment's span, extended past its labelled ayah when extendsTo. */
function span(seg) {
  if (seg.extendsTo && seg.extendsTo > seg.ayahEnd)
    return {
      surah: seg.surah,
      a0: seg.ayahStart,
      w0: seg.wordStart,
      a1: seg.extendsTo,
      w1: manifestWords(seg.surah, seg.extendsTo),
    };
  return {
    surah: seg.surah,
    a0: seg.ayahStart,
    w0: seg.wordStart,
    a1: seg.ayahEnd,
    w1: seg.wordEnd,
  };
}
const inSpan = (sp, s, a, mw) =>
  s === sp.surah &&
  cmp(a, mw, sp.a0, sp.w0) >= 0 &&
  cmp(a, mw, sp.a1, sp.w1) <= 0;

/** Words of a span in reading order, as [ayah, manifest word]. */
function spanWords(sp) {
  const out = [];
  for (let a = sp.a0; a <= sp.a1; a++) {
    const n = manifestWords(sp.surah, a);
    const from = a === sp.a0 ? sp.w0 : 1;
    const to = a === sp.a1 ? Math.min(sp.w1, n) : n;
    for (let w = from; w <= to; w++) out.push([a, w]);
  }
  return out;
}

// ------------------------------------------------------------ error labels

/**
 * Labelled error words of a learner segment: Map 'a:mw' -> Set of classes.
 * Words a little outside the span (quranmb's guess at a clip that starts or
 * ends mid-word) are moved to the span's edge.
 */
function errorWords(seg) {
  const out = new Map();
  const sp = span(seg);
  const add = (word, cls) => {
    if (!word) return;
    let [s, a, w] = String(word).split(':').map(Number);
    if (s !== seg.surah) return;
    if (cmp(a, w, sp.a0, sp.w0) < 0) [a, w] = [sp.a0, sp.w0];
    if (cmp(a, w, seg.ayahEnd, seg.wordEnd) > 0)
      [a, w] = [seg.ayahEnd, seg.wordEnd];
    const key = `${a}:${w}`;
    if (!out.has(key)) out.set(key, new Set());
    out.get(key).add(cls ?? 'unclassified');
  };
  for (const e of seg.errorWords ?? []) {
    if (Array.isArray(e.categories)) {
      for (const c of e.categories.length ? e.categories : ['unclassified'])
        add(e.word, c);
    } else add(e.word, e.class);
  }
  for (const e of seg.phonemeEdits ?? []) add(e.word, e.class);
  // Phoneme edits also summed up per word: only vowels changed, or a
  // consonant too (the app marks words, so a lone vowel slip is the harder case).
  if (seg.phonemeEdits)
    for (const classes of out.values())
      classes.add(
        [...classes].every(c => VOWEL_EDITS.has(c))
          ? '=vowel-only'
          : '=with-consonant',
      );
  return out;
}
const VOWEL_EDITS = new Set([
  'vowel',
  'vowelDeleted',
  'vowelInserted',
  'vowelLength',
  'vowelEmphasis',
]);

// ------------------------------------------------------------ features

/** Context of a shown mark, as candidates.mjs computes it. */
function markFeatures(run, ctx, id, since, at) {
  const {locks, unlocks, progress, totals, chains} = ctx;
  const [s, a, w] = id.split(':').map(Number);
  const key = `${s}:${a}`;
  const lock = [...locks].reverse().find(l => l.t <= since + 1e-6);
  const [ls, la] = lock ? lock.key.split(':').map(Number) : [0, 0];
  const beforeLock =
    lock !== undefined &&
    ((ls === s && la === a && w < lock.w) || (ls === s && a < la));
  const visited = progress.some(p => p.t < since && p.key === key && p.w >= w);
  const visitedExact = progress.some(
    p => p.t < since && p.key === key && p.w === w,
  );
  const nextUnlock = unlocks.find(u => u >= since);
  const prevUnlock = [...unlocks].reverse().find(u => u <= since);
  const badNear = (id2, from, to) =>
    (chains.get(id2) ?? []).some(
      c => (c.to === 'wrong' || c.to === 'skipped') && c.t >= from && c.t <= to,
    );
  let neighbours = 0;
  let neighboursAtConfirm = 0;
  for (const id2 of chains.keys()) {
    if (id2 === id) continue;
    const [s2, a2, w2] = id2.split(':').map(Number);
    if (s2 !== s || a2 !== a || Math.abs(w2 - w) > 3) continue;
    if (badNear(id2, since - 2, since + 2)) neighbours += 1;
    if (badNear(id2, since - 2, at)) neighboursAtConfirm += 1;
  }
  const prevLast = `${s}:${a - 1}:${(totals.get(`${s}:${a - 1}`) ?? 0) - 1}`;
  const prevLastWrongNear = (chains.get(prevLast) ?? []).some(
    c => c.to === 'wrong' && Math.abs(c.t - since) <= 2,
  );
  const nextKey =
    w + 1 < (totals.get(key) ?? 0) ? `${key}:${w + 1}` : `${s}:${a + 1}:0`;
  let sat = false;
  let departedTo = null;
  for (const p of progress) {
    if (p.t > since) break;
    const pid = `${p.key}:${p.w}`;
    if (pid === id) sat = true;
    else if (sat && departedTo === null) departedTo = pid;
  }
  const lockT = lock ? lock.t : 0;
  const chain = chains.get(id) ?? [];
  const wentPending = chain.some(
    c => c.to === 'pending' && c.t >= lockT && c.t <= since,
  );
  const word0Bad = badNear(`${key}:0`, lockT, at);
  const TROUBLE = new Set(['lost', 'idle', 'locateFailed', 'relocated']);
  const lastTrouble = [...run.log]
    .reverse()
    .find(e => e.type === 'debug' && TROUBLE.has(e.event) && e.t <= since);
  const first =
    chain.find(
      c => (c.to === 'wrong' || c.to === 'skipped') && c.t >= since - 0.01,
    ) ?? chain.find(c => c.to === 'wrong' || c.to === 'skipped');
  const health = [...(run.health ?? [])].reverse().find(h => h.t <= since);
  return {
    first,
    features: {
      word: w,
      words: totals.get(key) ?? null,
      isLast: w === (totals.get(key) ?? 0) - 1,
      sinceLock: lock ? +(since - lock.t).toFixed(2) : null,
      // The mark's verdict came in the very chunk that locked (replayed audio).
      lockChunk: lock ? Math.abs(since - lock.t) < 0.01 : false,
      beforeLock,
      visited,
      visitedExact,
      afterUnlockIn:
        nextUnlock !== undefined ? +(nextUnlock - since).toFixed(2) : null,
      sincePrevUnlock:
        prevUnlock !== undefined ? +(since - prevUnlock).toFixed(2) : null,
      neighbours,
      prevLastWrongNear,
      confirmDelay: +(at - since).toFixed(2),
      fromState: first?.from ?? null,
      saidThenSkipped: sat && departedTo === nextKey,
      wentPending,
      word0Bad,
      sinceTrouble: lastTrouble ? +(since - lastTrouble.t).toFixed(2) : null,
      unlockBeforeConfirm: unlocks.some(u => u >= since && u <= at),
      neighboursAtConfirm,
      held: health ? !!health.held : null,
      lost: health ? !!health.lost : null,
    },
  };
}

function runContext(run) {
  const locks = [];
  let unlocked = true;
  for (const e of run.log) {
    if (e.type === 'word_progress' && unlocked) {
      locks.push({t: e.t, key: e.key, w: e.w});
      unlocked = false;
    } else if (e.type === 'debug' && UNLOCK.has(e.event)) unlocked = true;
  }
  const unlocks = run.log
    .filter(e => e.type === 'debug' && UNLOCK.has(e.event))
    .map(e => e.t);
  const progress = run.log.filter(e => e.type === 'word_progress');
  const totals = new Map();
  const chains = new Map();
  for (const c of run.vchanges) {
    const [s, a, w] = c.id.split(':').map(Number);
    totals.set(`${s}:${a}`, Math.max(totals.get(`${s}:${a}`) ?? 0, w + 1));
    const list = chains.get(c.id) ?? [];
    list.push(c);
    chains.set(c.id, list);
  }
  // Where the first lock landed: the located/relocated debug at that time.
  const firstLock = locks[0]?.t ?? null;
  const located =
    firstLock === null
      ? null
      : [...run.log]
          .reverse()
          .find(
            e =>
              e.type === 'debug' &&
              LOCK.has(e.event) &&
              e.at &&
              e.t <= firstLock,
          );
  let lockPos = null;
  if (located) {
    const [s, a, w] = located.at.split(':').map(Number);
    if ([s, a, w].every(Number.isFinite))
      lockPos = {surah: s, ayah: a, word: toManifest(s, a, w)};
  }
  // Locked spans, as replay2.mjs: verdicts outside them never reach the app.
  const spans = [];
  let from = null;
  for (const e of run.log) {
    if (e.type === 'word_progress' && from === null) from = e.t;
    else if (e.type === 'debug' && UNLOCK.has(e.event) && from !== null) {
      spans.push([from, e.t]);
      from = null;
    }
  }
  if (from !== null) spans.push([from, Infinity]);
  const locked = t => spans.some(([x, y]) => x <= t && t < y);
  return {locks, unlocks, progress, totals, chains, firstLock, lockPos, locked};
}

// ------------------------------------------------------------ scoring

function newTally() {
  return {
    takes: 0,
    learnerMin: 0,
    afterLockMin: 0,
    judgedMin: 0,
    labelledMin: 0,
    correctMin: 0,
    unknownMin: 0,
    leadMin: 0,
    marks: {},
    markedCorrected: {},
    recall: {},
    errorWordsTotal: 0,
    clips: {correct: [0, 0], incorrect: [0, 0], unknown: [0, 0]},
    skippedFlags: {},
    neverLocked: 0,
  };
}
const bump = (o, k, n = 1) => (o[k] = (o[k] ?? 0) + n);

/** Adds one take's tally into a running one. */
function merge(dst, src) {
  for (const [k, v] of Object.entries(src)) {
    if (typeof v === 'number') dst[k] += v;
    else if (k === 'recall') {
      for (const [c, r] of Object.entries(v)) {
        const d = (dst.recall[c] ??= {words: 0, judged: 0, hit: 0, hitNear: 0});
        for (const f of Object.keys(d)) d[f] += r[f];
      }
    } else if (k === 'clips') {
      for (const [c, [a, b]] of Object.entries(v)) {
        dst.clips[c][0] += a;
        dst.clips[c][1] += b;
      }
    } else for (const [c, n] of Object.entries(v)) bump(dst[k], c, n);
  }
}

/** Extra report rows a take also counts in. */
function subsets(ds, segs) {
  const learner = segs.filter(g => !g.lead);
  const out = [];
  // QuranMB clips whose reference phonemes matched the Quran text exactly
  // (fuzzy ones often start or end inside a word).
  if (ds === 'quranmb' && learner.every(g => g.textMatch?.type === 'exact'))
    out.push('text matched exactly');
  if (ds === 'retasy' && learner.every(g => g.golden))
    out.push('expert-labelled');
  return out;
}

function scoreTake(run, ds, out, marksOut) {
  const take = run.clip;
  const segs = take.segments ?? [];
  const {visible, skipped, corrected, confirmedAt} = replayRun(run);
  const ctx = runContext(run);
  const {firstLock, lockPos} = ctx;
  const cold = segs.some(g => !g.lead && g.cold);
  const T = newTally();
  T.takes += 1;
  if (firstLock === null) T.neverLocked += 1;
  // Skipped-ayah flags: on an ayah the learner read (false), one a lead-in
  // read, or neither.
  for (const key of skipped) {
    const [fs_, fa] = key.split(':').map(Number);
    const reads = g => {
      const sp = span(g);
      return fs_ === sp.surah && fa >= sp.a0 && fa <= sp.a1;
    };
    bump(
      T.skippedFlags,
      segs.some(g => !g.lead && reads(g))
        ? 'learner ayah'
        : segs.some(g => g.lead && reads(g))
        ? 'lead-in ayah'
        : 'other',
    );
  }

  // Learner time, and which of its words were heard after the first lock.
  const learner = segs.filter(g => !g.lead);
  const eligibleWord = (g, a, mw) => {
    if (firstLock === null) return false;
    if (g.start >= firstLock) return true;
    return (
      lockPos !== null &&
      lockPos.surah === g.surah &&
      cmp(a, mw, lockPos.ayah, lockPos.word) >= 0
    );
  };
  // Judged time: a segment heard after the first lock, or the part of it
  // from the lock's start word on (the lock replays buffered audio, so the
  // words of a take's opening ayah are judged too), by share of its words.
  const judgedShare = g => {
    if (firstLock === null) return 0;
    if (g.start >= firstLock) return 1;
    if (lockPos === null || lockPos.surah !== g.surah) return 0;
    const words = spanWords(span(g));
    const from = words.findIndex(
      ([a, w]) => cmp(a, w, lockPos.ayah, lockPos.word) >= 0,
    );
    return from < 0 ? 0 : (words.length - from) / words.length;
  };
  for (const g of learner) {
    const len = g.end - g.start;
    const after =
      firstLock === null
        ? 0
        : Math.max(0, g.end - Math.max(g.start, firstLock));
    const judged = (len * judgedShare(g)) / 60;
    T.learnerMin += len / 60;
    T.afterLockMin += after / 60;
    T.judgedMin += judged;
    // Time where a false mark can be told from a hit: correct segments, and
    // incorrect ones whose error words are labelled.
    if (
      g.label === 'correct' ||
      (g.label === 'incorrect' && !CLIP_LABEL_ONLY.has(ds))
    )
      T.labelledMin += judged;
    if (g.label === 'correct') T.correctMin += judged;
    if (g.label === 'unknown') T.unknownMin += judged;
  }
  for (const g of segs.filter(x => x.lead)) T.leadMin += (g.end - g.start) / 60;

  // Classify every shown mark.
  const markedBySeg = new Map();
  for (const [id, since] of visible) {
    const [s, a, w] = id.split(':').map(Number);
    const mw = toManifest(s, a, w);
    const cands = learner.filter(
      g => since >= g.start - TIME_SLACK && inSpan(span(g), s, a, mw),
    );
    const seg = cands.sort((x, y) => y.start - x.start)[0] ?? null;
    let cls;
    let classes = null;
    if (excludedAyat.has(`${s}:${a}`)) cls = 'excluded';
    else if (seg) {
      const errs = errorWords(seg);
      if (a > seg.ayahEnd) cls = 'unknown';
      else if (seg.label === 'correct') cls = 'false-correct';
      else if (seg.label === 'incorrect') {
        if (CLIP_LABEL_ONLY.has(ds)) cls = 'on-incorrect';
        else if (errs.has(`${a}:${mw}`)) {
          cls = 'hit';
          classes = [...errs.get(`${a}:${mw}`)];
        } else {
          const words = spanWords(span(seg));
          const i = words.findIndex(([x, y]) => x === a && y === mw);
          const near = [words[i - 1], words[i + 1]].find(
            p => p && errs.has(`${p[0]}:${p[1]}`),
          );
          if (near) {
            cls = 'near';
            classes = [...errs.get(`${near[0]}:${near[1]}`)];
          } else cls = 'false-incorrect';
        }
      } else cls = 'unknown';
      if (!markedBySeg.has(seg)) markedBySeg.set(seg, 0);
      markedBySeg.set(seg, markedBySeg.get(seg) + 1);
    } else if (
      segs.some(
        g =>
          g.lead && since >= g.start - TIME_SLACK && inSpan(span(g), s, a, mw),
      )
    ) {
      cls = 'lead';
    } else cls = 'elsewhere';
    const isCorrected = corrected.has(id);
    bump(T.marks, cls);
    if (isCorrected) bump(T.markedCorrected, cls);

    if (marksOut) {
      const at = confirmedAt.get(id) ?? since;
      const {first, features} = markFeatures(run, ctx, id, since, at);
      let segInfo = null;
      if (seg) {
        const words = spanWords(span(seg));
        const pos = words.findIndex(([x, y]) => x === a && y === mw);
        segInfo = {
          clipId: seg.clipId,
          label: seg.label,
          start: seg.start,
          end: seg.end,
          pos,
          words: words.length,
          first: pos === 0,
          last: pos === words.length - 1,
          sinceSegStart: +(since - seg.start).toFixed(2),
          afterSegEnd: +(since - seg.end).toFixed(2),
        };
      }
      marksOut.push(
        JSON.stringify({
          ds,
          run: take.id,
          id,
          word: `${s}:${a}:${mw}`,
          t: since,
          confirmedAt: at,
          state: first?.to ?? null,
          d: first?.d ?? null,
          label: cls,
          errorClasses: classes,
          corrected: isCorrected,
          cold,
          segment: segInfo,
          features: {
            ...features,
            sinceFirstLock:
              firstLock === null ? null : +(since - firstLock).toFixed(2),
          },
        }),
      );
    }
  }

  // Clips with at least one mark (clip-label sets read this).
  for (const g of learner) {
    const k = g.label in T.clips ? g.label : 'unknown';
    T.clips[k][1] += 1;
    if ((markedBySeg.get(g) ?? 0) > 0) T.clips[k][0] += 1;
  }

  // Recall of labelled error words heard after the first lock.
  const judged = new Set(
    run.vchanges
      .filter(c => !c.stop && c.to !== 'pending' && ctx.locked(c.t))
      .map(c => c.id),
  );
  for (const g of learner) {
    if (g.label !== 'incorrect') continue;
    const errs = errorWords(g);
    const words = spanWords(span(g));
    for (const [key, classes] of errs) {
      const [a, mw] = key.split(':').map(Number);
      if (excludedAyat.has(`${g.surah}:${a}`)) continue;
      T.errorWordsTotal += 1;
      if (!eligibleWord(g, a, mw)) continue;
      const ids = toEngine(g.surah, a, mw).map(w => `${g.surah}:${a}:${w}`);
      const hit = ids.some(id => visible.has(id));
      const i = words.findIndex(([x, y]) => x === a && y === mw);
      const nearIds = [words[i - 1], words[i + 1]]
        .filter(Boolean)
        .flatMap(([x, y]) =>
          toEngine(g.surah, x, y).map(w => `${g.surah}:${x}:${w}`),
        );
      const hitNear = hit || nearIds.some(id => visible.has(id));
      const wasJudged = ids.some(id => judged.has(id));
      for (const c of ['(any)', ...classes]) {
        const r = (T.recall[c] ??= {words: 0, judged: 0, hit: 0, hitNear: 0});
        r.words += 1;
        if (wasJudged) r.judged += 1;
        if (hit) r.hit += 1;
        if (hitNear) r.hitNear += 1;
      }
    }
  }

  // Did the lead-in do its job: locked before the learner, cursor at the
  // clip's first word (or the lead-in's last) when the learner starts?
  const leadIdx = segs.findIndex(g => g.lead && !g.bridge);
  if (leadIdx >= 0 && segs[leadIdx + 1] && !segs[leadIdx + 1].lead) {
    const lead = segs[leadIdx];
    const next = segs[leadIdx + 1];
    const q = out.leadQuality;
    q.takes += 1;
    if (firstLock === null) q.neverLocked += 1;
    else if (firstLock >= next.start) q.lockedInLearner += 1;
    else {
      q.lockedInLead += 1;
      const lostBefore = run.log.some(
        e => e.type === 'debug' && UNLOCK.has(e.event) && e.t < next.start,
      );
      if (lostBefore) q.unlockedBeforeLearner += 1;
      const p = [...ctx.progress].reverse().find(e => e.t <= next.start + 0.5);
      if (!p) q.cursorOff += 1;
      else {
        const [ps, pa] = p.key.split(':').map(Number);
        const pmw = toManifest(ps, pa, p.w);
        const want = [
          [lead.ayahEnd, lead.wordEnd],
          [next.ayahStart, next.wordStart],
        ];
        const words = [
          ...spanWords(span(lead)).slice(-3),
          ...spanWords(span(next)).slice(0, 2),
        ];
        const idx = words.findIndex(([x, y]) => x === pa && y === pmw);
        const leadEnd = words.findIndex(
          ([x, y]) => x === want[0][0] && y === want[0][1],
        );
        if (ps !== lead.surah || idx < 0) q.cursorOff += 1;
        else if (idx === leadEnd || idx === leadEnd + 1) q.cursorAtClip += 1;
        else q.cursorNear += 1;
      }
    }
    // The lead-in's last word is where the cut is: how it was last judged.
    const lastIds = toEngine(lead.surah, lead.ayahEnd, lead.wordEnd).map(
      w => `${lead.surah}:${lead.ayahEnd}:${w}`,
    );
    let state = 'never';
    for (const c of run.vchanges)
      if (!c.stop && lastIds.includes(c.id)) state = c.to;
    bump(q.lastLeadWord, state);
  }
  merge(cold ? out.cold : out.main, T);
  for (const name of subsets(ds, segs))
    merge((out.sub[name] ??= newTally()), T);
}

// ------------------------------------------------------------ report

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(0)}%` : '-');
const rate = (n, min) => (min > 0 ? (n / min).toFixed(2) : '-');

function report(name, T, ds) {
  const m = T.marks;
  const c = T.markedCorrected;
  const n = k => m[k] ?? 0;
  const red = k => (m[k] ?? 0) - (c[k] ?? 0);
  const falseAll = n('false-correct') + n('false-incorrect');
  const falseRed = red('false-correct') + red('false-incorrect');
  const lines = [];
  lines.push(
    `${name}: ${T.takes} takes (${
      T.neverLocked
    } never locked) | learner ${T.learnerMin.toFixed(1)} min, ` +
      `${T.afterLockMin.toFixed(1)} after the first lock, ${T.judgedMin.toFixed(
        1,
      )} judged (with the lock's replay; ` +
      `labelled ${T.labelledMin.toFixed(1)}, unknown ${T.unknownMin.toFixed(
        1,
      )}) | lead-in ${T.leadMin.toFixed(1)} min`,
  );
  lines.push(
    `   learner-word marks: hit ${n('hit')}, near(+-1) ${n(
      'near',
    )}, false ${falseAll} ` +
      `(on correct ${n('false-correct')}, non-error word of incorrect ${n(
        'false-incorrect',
      )}), ` +
      `on incorrect clip ${n('on-incorrect')}, unknown ${n('unknown')} | ` +
      `lead-in ${n('lead')} (${rate(
        n('lead'),
        T.leadMin,
      )}/lead-min), elsewhere ${n('elsewhere')}` +
      (n('excluded') ? `, excluded ayat ${n('excluded')}` : '') +
      ` | skipped-ayah flags ${JSON.stringify(T.skippedFlags)}`,
  );
  const falseNear = falseRed + red('near');
  lines.push(
    `   false marks staying red ${falseRed} = ${rate(
      falseRed,
      T.labelledMin,
    )}/judged labelled learner-min ` +
      `(+-1 counted false: ${falseNear} = ${rate(
        falseNear,
        T.labelledMin,
      )}/min), ` +
      `later corrected ${falseAll - falseRed}` +
      (T.correctMin > 0
        ? ` | on correct segments: ${red('false-correct')} = ${rate(
            red('false-correct'),
            T.correctMin,
          )}/correct-min`
        : '') +
      (T.unknownMin > 0
        ? ` | unknown-label marks ${red('unknown')} = ${rate(
            red('unknown'),
            T.unknownMin,
          )}/unknown-min`
        : ''),
  );
  const recallKeys = Object.keys(T.recall).sort((x, y) =>
    x === '(any)'
      ? -1
      : y === '(any)'
      ? 1
      : T.recall[y].words - T.recall[x].words,
  );
  if (recallKeys.length) {
    lines.push(
      `   recall (error words heard after the first lock: caught exact / +-1 / judged at all), ${T.errorWordsTotal} labelled in all:`,
    );
    for (const k of recallKeys) {
      const r = T.recall[k];
      lines.push(
        `      ${k.padEnd(20)} ${String(r.words).padStart(5)} words: ${
          r.hit
        } (${pct(r.hit, r.words)}) / ` +
          `${r.hitNear} (${pct(r.hitNear, r.words)}) / judged ${
            r.judged
          } (${pct(r.judged, r.words)})`,
      );
    }
  }
  const cl = T.clips;
  if (CLIP_LABEL_ONLY.has(ds) || ds === 'retasy')
    lines.push(
      `   clips with a mark: correct ${cl.correct[0]}/${cl.correct[1]} (${pct(
        ...cl.correct,
      )}), ` +
        `incorrect ${cl.incorrect[0]}/${cl.incorrect[1]} (${pct(
          ...cl.incorrect,
        )}), ` +
        `unknown ${cl.unknown[0]}/${cl.unknown[1]} (${pct(...cl.unknown)})`,
    );
  return lines.join('\n');
}

const marksOut = [];
const summary = {};
for (const ds of DATASETS) {
  const dir = path.join(RUNS, ds);
  const out = {
    main: newTally(),
    cold: newTally(),
    sub: {},
    leadQuality: {
      takes: 0,
      neverLocked: 0,
      lockedInLearner: 0,
      lockedInLead: 0,
      unlockedBeforeLearner: 0,
      cursorAtClip: 0,
      cursorNear: 0,
      cursorOff: 0,
      lastLeadWord: {},
    },
  };
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!run.vchanges || !run.clip?.segments) continue;
    scoreTake(run, ds, out, marksOut);
  }
  console.log(report(ds, out.main, ds));
  if (out.cold.takes) console.log(report(`${ds} (cold)`, out.cold, ds));
  for (const [name, T] of Object.entries(out.sub))
    console.log(report(`${ds} (${name}, cold included)`, T, ds));
  const q = out.leadQuality;
  if (q.takes)
    console.log(
      `   lead-ins: ${q.takes} | locked in the lead-in ${q.lockedInLead} (${pct(
        q.lockedInLead,
        q.takes,
      )}), ` +
        `only in the learner clip ${q.lockedInLearner}, never ${q.neverLocked} | ` +
        `unlocked again before the learner ${q.unlockedBeforeLearner} | cursor at the clip's first word ` +
        `${q.cursorAtClip}, within 2 words ${q.cursorNear}, elsewhere ${q.cursorOff} | ` +
        `lead-in's last word last judged ${JSON.stringify(q.lastLeadWord)}`,
    );
  summary[ds] = out;
}
fs.mkdirSync(path.dirname(MARKS), {recursive: true});
fs.writeFileSync(MARKS, marksOut.join('\n') + (marksOut.length ? '\n' : ''));
console.log(`${marksOut.length} shown marks -> ${MARKS}`);
if (args.json)
  fs.writeFileSync(path.resolve(args.json), JSON.stringify(summary, null, 1));
