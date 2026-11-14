/* eslint-env node, es2020 */
// Text-side true events on correct recitation, scored by the junction test alone:
// no tracker, since the expected text is not what the tracker followed.
//
// - ending: a real join where the reader said c and went on, and X's official
//   text has 'c L' there (ending_twins.py).
// - interior: a place inside an ayah where the reader says 'c d' and X reads
//   'c L | d' across its end (interior_events.py): a reader going straight on.
// - changed: a real join where the reader said W as the last word and X's official
//   text, otherwise the same ayah, has L: a changed word, not a left-out one.
//
//   node natural/junction/scan_phantom.mjs <runs dir> <post dir> <out.jsonl>
import fs from 'node:fs';
import path from 'node:path';
import {
  ANCHOR_TOKENS,
  BENCH,
  DumpPosteriors,
  LOOK_BACK_FRAMES,
  encode,
  junctionFree,
  loadCorpus,
  pausalPhonemes,
  shortMadd,
  WAIT_FRAMES,
} from './llr.mjs';

const [runsDir, postDir, outFile] = process.argv.slice(2);
const corpus = loadCorpus();
const J = path.join(BENCH, '.out/natural/junction');
const twins = JSON.parse(fs.readFileSync(path.join(J, 'ending_twins.json'), 'utf8'));
const inner = JSON.parse(fs.readFileSync(path.join(J, 'interior_events.json'), 'utf8'));
const out = fs.createWriteStream(outFile);
const r3 = x => (Number.isFinite(x) ? +x.toFixed(3) : null);
const engineWord = (key, w) => {
  const [s, a] = key.split(':').map(Number);
  return corpus.ayahFirstWord(s, a) + w;
};
const nextLabel = g => corpus.wordPhonemes(g);

function formsBefore(gReal, gTwin) {
  const list = new Set();
  for (const g of [gReal, gTwin]) {
    const ph = corpus.wordPhonemes(g);
    list.add(ph);
    const atEnd =
      corpus.wordInAyah[g] === corpus.ayahWordCount(corpus.wordSurah[g], corpus.wordAyah[g]) - 1;
    const p = pausalPhonemes(ph, corpus.plain[g], atEnd);
    if (p) list.add(p);
  }
  return [...list];
}

function test(post, gReal, gL, after, from, to) {
  const exp = corpus.wordPhonemes(gL);
  const forms = [exp, shortMadd(exp)].filter((x, i, a) => a.indexOf(x) === i);
  const before = formsBefore(gReal, gL - 1);
  const nL = encode(exp)?.length ?? 1;
  const out = {nL};
  // The free-tail test from the word before, and the local fit with its lookback.
  const free = junctionFree(post, before, forms, after, from, to);
  out.llrFree = r3((free.s1 - free.s0) / nL);
  for (const back of [50, 75]) {
    const start = Math.max(post.firstFrame ?? 0, from - back);
    const {s1, s0} = junctionFree(post, before, forms, after, start, to, null, true);
    out[`llrB${back}`] = r3((s1 - s0) / nL);
  }
  // The check as it runs: anchored on the next word's first sounds.
  {
    const start = Math.max(post.firstFrame ?? 0, from - LOOK_BACK_FRAMES);
    const {s1, s0} = junctionFree(post, before, forms, after, start, to, ANCHOR_TOKENS, true);
    out.llr = r3((s1 - s0) / nL);
    out.s0 = r3(s0);
  }
  return out;
}

let n = 0;
const write = row => {
  out.write(JSON.stringify(row) + '\n');
  n += 1;
};
for (const f of fs.readdirSync(runsDir).filter(x => x.endsWith('.json'))) {
  const run = JSON.parse(fs.readFileSync(path.join(runsDir, f), 'utf8'));
  const pr = run.probe;
  if (!pr?.post || !fs.existsSync(path.join(postDir, pr.post))) continue;
  const post = new DumpPosteriors(fs.readFileSync(path.join(postDir, pr.post)), pr.epochs);
  const truth = run.clip.truth;
  const base = {
    clip: run.clip.id,
    reciter: truth.reciter,
    reciterSplit: truth.reciterSplit,
    block: truth.block,
    blockSplit: truth.blockSplit,
  };
  for (const j of pr.joins) {
    const key = j.id.split(':').slice(0, 2).join(':');
    const events = twins.endings[key];
    if (!events) continue;
    const s = j.snaps.find(x => x.m === 0);
    if (!s) continue;
    post.setEpoch(s.epoch);
    const c = s.words.find(w => w.g === j.L);
    if (c?.from === undefined) continue;
    const from = Math.max(0, c.ff - 1);
    const stop = s.frames + WAIT_FRAMES;
    if (!post.has(from, stop) || stop <= from) continue;
    for (const e of events) {
      const gL = engineWord(e.x, e.engineLast);
      write({
        ...base,
        kind: 'ending',
        join: j.id,
        x: e.x,
        word: e.word,
        typeSplit: e.split,
        frames: stop - from,
        ...test(post, j.L, gL, nextLabel(j.L + 1), from, stop),
      });
    }
  }
  for (const j of pr.joins) {
    const key = j.id.split(':').slice(0, 2).join(':');
    const events = twins.changed[key];
    if (!events) continue;
    const s = j.snaps.find(x => x.m === 0);
    if (!s) continue;
    post.setEpoch(s.epoch);
    const c = s.words.find(w => w.g === j.L - 1);
    if (c?.from === undefined) continue;
    const from = Math.max(0, c.ff - 1);
    const stop = s.frames + WAIT_FRAMES;
    if (!post.has(from, stop) || stop <= from) continue;
    for (const e of events) {
      const gL = engineWord(e.x, e.engineLast);
      write({
        ...base,
        kind: 'changed',
        join: j.id,
        x: e.x,
        word: e.word,
        typeSplit: e.split,
        frames: stop - from,
        ...test(post, j.L - 1, gL, nextLabel(j.L + 1), from, stop),
      });
    }
  }
  // Interior: QUA's times, in rows of the whole dump.
  const flat = new DumpPosteriors(fs.readFileSync(path.join(postDir, pr.post)), [{row: 0, firstFrame: 0}]);
  for (const e of inner[run.clip.id] ?? []) {
    const start = run.partsAt[e.part].start;
    const from = Math.max(0, Math.round((start + e.cStartMs / 1000) * 25) - 8);
    const to = Math.min(flat.rows, Math.round((start + e.dEndMs / 1000) * 25) + 12);
    if (to <= from) continue;
    const [s, a] = e.key.split(':').map(Number);
    const gC = corpus.ayahFirstWord(s, a) + e.c;
    const gL = engineWord(e.x, e.engineLast);
    write({
      ...base,
      kind: 'interior',
      join: `${e.key}:${e.c}`,
      x: e.x,
      word: e.word,
      typeSplit: e.split,
      frames: to - from,
      ...test(flat, gC, gL, nextLabel(gC + 1), from, to),
    });
  }
}
out.end();
console.log(`scored ${n}`);
