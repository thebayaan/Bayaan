/* eslint-env node, es2020 */
// A shown mark's class on a learner take, copied from ../recitation-bench/score_real.mjs so
// that marks a candidate adds get the same class as the 66 real slips. Engine word w is
// manifest word w + 1, except where the engine splits a word.
import fs from 'node:fs';
import path from 'node:path';
import {BENCH} from './lib.mjs';

const TIME_SLACK = 0.5;
const corpus = JSON.parse(
  fs.readFileSync(path.join(BENCH, '.out/assets/zipformer_quran.json'), 'utf8'),
);
const engineWords = new Map();
for (const s of corpus.surahs)
  for (const a of s.ayahs) engineWords.set(`${s.n}:${a.n}`, a.w.length);
const wordmap = JSON.parse(
  fs.readFileSync(path.join(BENCH, '.out/takes/wordmap.json'), 'utf8'),
);
const splitAyat = wordmap.engineToManifest ?? {};
const excludedAyat = new Set((wordmap.excluded ?? []).map(e => e.ayah));

const toManifest = (s, a, w) => splitAyat[`${s}:${a}`]?.[w] ?? w + 1;
function manifestWords(s, a) {
  const m = splitAyat[`${s}:${a}`];
  return m ? m[m.length - 1] : (engineWords.get(`${s}:${a}`) ?? 0);
}
const cmp = (a1, w1, a2, w2) => (a1 !== a2 ? a1 - a2 : w1 - w2);
function span(seg) {
  if (seg.extendsTo && seg.extendsTo > seg.ayahEnd) {
    return {
      surah: seg.surah,
      a0: seg.ayahStart,
      w0: seg.wordStart,
      a1: seg.extendsTo,
      w1: manifestWords(seg.surah, seg.extendsTo),
    };
  }
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
function errorWords(seg) {
  const out = new Set();
  const sp = span(seg);
  const add = word => {
    if (!word) return;
    let [s, a, w] = String(word).split(':').map(Number);
    if (s !== seg.surah) return;
    if (cmp(a, w, sp.a0, sp.w0) < 0) [a, w] = [sp.a0, sp.w0];
    if (cmp(a, w, seg.ayahEnd, seg.wordEnd) > 0)
      [a, w] = [seg.ayahEnd, seg.wordEnd];
    out.add(`${a}:${w}`);
  };
  for (const e of seg.errorWords ?? []) add(e.word);
  for (const e of seg.phonemeEdits ?? []) add(e.word);
  return out;
}

/** hit, near, false-correct, false-incorrect, lead, elsewhere, unknown or excluded. */
export function labelOf(segments, id, since) {
  const [s, a, w] = id.split(':').map(Number);
  const mw = toManifest(s, a, w);
  if (excludedAyat.has(`${s}:${a}`)) return 'excluded';
  const learner = segments.filter(g => !g.lead);
  const seg = learner
    .filter(g => since >= g.start - TIME_SLACK && inSpan(span(g), s, a, mw))
    .sort((x, y) => y.start - x.start)[0];
  if (!seg) {
    return segments.some(
      g => g.lead && since >= g.start - TIME_SLACK && inSpan(span(g), s, a, mw),
    )
      ? 'lead'
      : 'elsewhere';
  }
  if (a > seg.ayahEnd) return 'unknown';
  if (seg.label === 'correct') return 'false-correct';
  if (seg.label !== 'incorrect') return 'unknown';
  const errs = errorWords(seg);
  if (errs.has(`${a}:${mw}`)) return 'hit';
  const words = spanWords(span(seg));
  const i = words.findIndex(([x, y]) => x === a && y === mw);
  const near = [words[i - 1], words[i + 1]].find(
    p => p && errs.has(`${p[0]}:${p[1]}`),
  );
  return near ? 'near' : 'false-incorrect';
}
