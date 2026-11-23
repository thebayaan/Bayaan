/* eslint-env node, es2020 */
// Scores every recorded join of a set of probe runs with the junction test and
// the simpler signals, into one JSON-lines file for the analysis.
//
//   node natural/junction/scan_joins.mjs <runs dir> <post dir> <out.jsonl>
import fs from 'node:fs';
import path from 'node:path';
import {
  DumpPosteriors,
  beforeForms,
  editDistance,
  encode,
  freeLogLik,
  junctionFree,
  junctionScores,
  loadCorpus,
  shortMadd,
} from './llr.mjs';

const [runsDir, postDir, outFile] = process.argv.slice(2);
const corpus = loadCorpus();
const out = fs.createWriteStream(outFile);
const SNAPS = [0, 1, 2, 3];
const r3 = x => (Number.isFinite(x) ? +x.toFixed(3) : null);

/** Base letters of a phoneme string: what can be heard as a consonant. */
const VOWELISH = new Set(['َ', 'ُ', 'ِ', 'ا', 'ۥ', 'ۦ', 'ـ', 'ؙ', 'ۜ', '۪']);
function consonants(ph) {
  return [...ph].filter(c => !VOWELISH.has(c));
}

/** Word-order overlap of the word's consonants with what was heard on it. */
function consonantHits(expected, heard) {
  const want = [...new Set(consonants(expected))];
  const got = new Set(consonants(heard));
  return want.length ? want.filter(c => got.has(c)).length / want.length : 0;
}

function score(post, snap, L) {
  const words = new Map(snap.words.map(w => [w.g, w]));
  const row = words.get(L);
  // The nearest earlier word that was heard, back to three words.
  let g0 = L - 1;
  while (g0 >= L - 3 && !words.get(g0)?.from && words.get(g0)?.from !== 0) g0--;
  const hasBefore = g0 >= L - 3 && words.get(g0)?.from !== undefined;
  // The next words the cursor is past, and where the following one starts.
  const m = snap.m;
  let lastQ = L + m;
  const next = words.get(L + 1 + m);
  const res = {
    m,
    t: snap.t,
    state: row?.state ?? null,
    distance: row?.distance ?? null,
    heardRatio: row?.heardRatio ?? null,
    gop: row?.gop ?? null,
    gopNone: row?.gopNone ?? null,
    heard: row?.ch ?? '',
    heardFrames: row?.from !== undefined ? row.lf - row.ff + 1 : 0,
    rate: snap.rate,
    lost: snap.lost,
    runs: new Set(snap.words.filter(w => w.run !== undefined).map(w => w.run)).size,
  };
  const expected = corpus.wordPhonemes(L);
  res.hits = +consonantHits(expected, row?.ch ?? '').toFixed(3);
  if (!hasBefore) return {...res, noBefore: true};
  const beforeRow = words.get(g0);
  const from = Math.max(0, beforeRow.ff - 1);
  let to = next?.ff;
  if (to === undefined) {
    const end = words.get(lastQ);
    if (end?.lf === undefined) return {...res, noNext: true};
    to = end.lf + 6;
  }
  to = Math.min(to, snap.frames);
  if (!post.has(from, to) || to <= from) return {...res, noFrames: true};
  const before = beforeForms(corpus, g0, L);
  let after = '';
  for (let g = L + 1; g <= lastQ; g++) after += corpus.wordPhonemes(g);
  const nL = encode(expected)?.length ?? 1;
  const forms = [expected, shortMadd(expected)].filter((x, i, a) => a.indexOf(x) === i);
  const {ll1, ll0} = junctionScores(post, before, forms, after, from, to);
  const strict = junctionScores(post, before, [expected], after, from, to);
  const free = freeLogLik(post, from, to);
  // Free tail over everything decoded so far: the next word (or two), or at the
  // crossing only the first sounds of the next word.
  const end = Math.min(snap.frames, post.lastFrame ?? snap.frames);
  const free2 = {};
  if (post.has(from, end)) {
    const q1 = corpus.wordPhonemes(L + 1);
    const q2 = L + 2 < corpus.wordCount ? q1 + corpus.wordPhonemes(L + 2) : q1;
    const variants = {a3: [q1, 3], q1: [q1, null], q2: [q2, null]};
    for (const [name, [tail, anchor]] of Object.entries(variants)) {
      const {s1, s0} = junctionFree(post, before, forms, tail, from, end, anchor);
      free2[name] = {
        llr: r3((s1 - s0) / nL),
        s1: r3(s1 / nL),
        s0: r3(s0 / nL),
      };
    }
  }
  // Anywhere in a longer stretch before the word before: the path may start and
  // stop at any frame.
  const local = {};
  for (const back of [0, 25, 50, 75]) {
    const start = Math.max(post.firstFrame ?? 0, from - back);
    if (!post.has(start, end)) continue;
    const {s1, s0} = junctionFree(post, before, forms, corpus.wordPhonemes(L + 1), start, end, null, true);
    local[`b${back}`] = {llr: r3((s1 - s0) / nL), s1: r3(s1 / nL), s0: r3(s0 / nL)};
  }
  // An earlier look: at the crossing and one or two chunks after it, the next
  // word's first sounds as the anchor. Frames past the snapshot are read from the
  // dump, as they would be heard by then.
  const early = {};
  if (m === 0) {
    const q1 = corpus.wordPhonemes(L + 1);
    for (const dt of [0, 12, 24]) {
      const stop = snap.frames + dt;
      if (!post.has(from, stop)) continue;
      const start = Math.max(post.firstFrame ?? 0, from - 50);
      if (!post.has(start, stop)) continue;
      for (const anchor of [3, 5]) {
        const {s1, s0} = junctionFree(post, before, forms, q1, start, stop, anchor, true);
        early[`d${dt}a${anchor}`] = r3((s1 - s0) / nL);
      }
    }
  }
  // The same comparison on the decoded sounds alone, no posteriors: how much
  // closer the sounds heard over the join are to the text without the last word.
  const chars = snap.hc.split('\u0001');
  const heardNow = chars.filter((_, i) => snap.hf[i] >= from && snap.hf[i] < to).join('');
  const dWith = Math.min(...before.map(b => editDistance(heardNow, b + expected + after)));
  const dWithout = Math.min(...before.map(b => editDistance(heardNow, b + after)));
  const symbolic = expected.length ? (dWith - dWithout) / [...expected].length : 0;
  // The gap between the word before and the next word, in frames.
  const q0 = words.get(L + 1);
  const gapFrames = q0?.ff !== undefined && beforeRow.lf !== undefined ? q0.ff - beforeRow.lf : null;
  return {
    ...res,
    nL,
    from,
    to,
    ll1: r3(ll1),
    ll0: r3(ll0),
    llr: r3((ll1 - ll0) / nL),
    llrStrict: r3((strict.ll1 - strict.ll0) / nL),
    fit1: r3((ll1 - free) / Math.max(1, to - from)),
    fit0: r3((ll0 - free) / Math.max(1, to - from)),
    gapFrames,
    symbolic: r3(symbolic),
    free: free2,
    local,
    ...(m === 0 ? {early} : {}),
  };
}

let n = 0;
const files = fs.readdirSync(runsDir).filter(f => f.endsWith('.json'));
for (const f of files) {
  const run = JSON.parse(fs.readFileSync(path.join(runsDir, f), 'utf8'));
  const pr = run.probe;
  if (!pr?.post) continue;
  const postPath = path.join(postDir, pr.post);
  if (!fs.existsSync(postPath)) continue;
  const buf = fs.readFileSync(postPath);
  const post = new DumpPosteriors(buf, pr.epochs);
  const truth = run.clip.truth;
  // Every verdict the live replay would have seen on this word.
  const trail = new Map();
  for (const c of run.vchanges) {
    if (c.stop) continue;
    const list = trail.get(c.id) ?? [];
    list.push(c);
    trail.set(c.id, list);
  }
  for (const j of pr.joins) {
    const rows = [];
    for (const s of j.snaps) {
      if (!SNAPS.includes(s.m)) continue;
      post.setEpoch(s.epoch);
      rows.push(score(post, s, j.L));
    }
    const tr = (trail.get(j.id) ?? []).map(c => ({t: c.t, to: c.to, gop: c.d?.gop ?? null, heardRatio: c.d?.heardRatio ?? null, distance: c.d?.distance ?? null}));
    out.write(
      JSON.stringify({
        clip: run.clip.id,
        reciter: truth.reciter,
        reciterSplit: truth.reciterSplit,
        blockSplit: truth.blockSplit ?? null,
        block: truth.block ?? null,
        pairSplit: truth.pairSplit ?? null,
        pair: truth.pair ?? null,
        type: truth.type,
        id: j.id,
        L: j.L,
        tracker: j.tracker,
        crossT: j.crossT,
        trail: tr,
        snaps: rows,
      }) + '\n',
    );
    n += 1;
  }
}
out.end();
console.log(`joins ${n} from ${files.length} runs`);
