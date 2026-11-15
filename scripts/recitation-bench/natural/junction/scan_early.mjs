/* eslint-env node, es2020 */
// How early can the test decide? The cursor stays on the missing word while the next
// word's sounds are bent onto it, so waiting for it to cross comes late. This scores
// every chunk from the first verdict on the word before until the cursor is one chunk
// into the next ayah: both hypotheses, anchored on the first 3 or 5 tokens of the
// next word or all of it, and how well the hypothesis without the last word fits.
// Posteriors only; the tracker gives where the word before starts.
//
//   node natural/junction/scan_early.mjs <runs dir> <post dir> <out.jsonl> [target]
//
// With `target`, only the join on the clip's expected last word.
import fs from 'node:fs';
import path from 'node:path';
import {
  DumpPosteriors,
  LOOK_BACK_FRAMES,
  WAIT_FRAMES,
  beforeForms,
  encode,
  forcedLocal,
  junctionFree,
  loadCorpus,
  shortMadd,
} from './llr.mjs';

const [runsDir, postDir, outFile, target] = process.argv.slice(2);
const corpus = loadCorpus();
const out = fs.createWriteStream(outFile);
const r3 = x => (Number.isFinite(x) ? +x.toFixed(3) : null);
const CHUNK = 0.48;
let n = 0;
for (const f of fs.readdirSync(runsDir).filter(x => x.endsWith('.json'))) {
  const run = JSON.parse(fs.readFileSync(path.join(runsDir, f), 'utf8'));
  const pr = run.probe;
  if (!pr?.post || !fs.existsSync(path.join(postDir, pr.post))) continue;
  const post = new DumpPosteriors(fs.readFileSync(path.join(postDir, pr.post)), pr.epochs);
  const t = run.clip.truth;
  const wanted = target ? `${t.expectedKey}:${t.target}` : null;
  for (const j of pr.joins) {
    if (wanted && j.id !== wanted) continue;
    const m0 = j.snaps.find(x => x.m === 0);
    if (!m0) continue;
    const words = new Map(m0.words.map(w => [w.g, w]));
    let g0 = j.L - 1;
    while (g0 >= j.L - 3 && words.get(g0)?.from === undefined) g0--;
    const before = words.get(g0);
    if (before?.from === undefined) continue;
    post.setEpoch(m0.epoch);
    const trail = run.vchanges.filter(c => c.id === j.id && !c.stop);
    // From the first verdict on the word before: the cursor is on it by then.
    const beforeId = `${corpus.wordSurah[g0]}:${corpus.wordAyah[g0]}:${corpus.wordInAyah[g0]}`;
    const beforeTrail = run.vchanges.filter(c => c.id === beforeId && !c.stop && c.t <= m0.t);
    const first = beforeTrail.length ? beforeTrail.at(-1).t : trail.length ? trail[0].t : m0.t;
    let startT = Math.min(first, m0.t);
    for (const c of beforeTrail) {
      if (c.t >= m0.t - 6) {
        startT = Math.min(startT, c.t);
        break;
      }
    }
    const from = Math.max(post.firstFrame, before.ff - 1 - LOOK_BACK_FRAMES);
    const exp = corpus.wordPhonemes(j.L);
    const forms = [exp, shortMadd(exp)].filter((x, i, a) => a.indexOf(x) === i);
    const hyp = beforeForms(corpus, g0, j.L);
    const q = corpus.wordPhonemes(j.L + 1);
    const nL = encode(exp)?.length ?? 1;
    const steps = [];
    for (let k = Math.round((startT - m0.t) / CHUNK); k <= 1; k++) {
      const frames = m0.frames + k * WAIT_FRAMES;
      if (frames <= from || !post.has(from, frames)) continue;
      const row = {t: +(m0.t + k * CHUNK).toFixed(2), k};
      const seen = trail.filter(c => c.t <= row.t + 1e-6).at(-1);
      row.state = seen?.to ?? null;
      // The word before alone: what the next word's sounds add to the misfit.
      row.sc = r3(Math.max(...hyp.map(h => forcedLocal(post, encode(h), from, frames))));
      for (const [name, anchor] of [['a3', 3], ['a5', 5], ['all', null]]) {
        const {s1, s0} = junctionFree(post, hyp, forms, q, from, frames, anchor, true);
        row[name] = {llr: r3((s1 - s0) / nL), s0: r3(s0), s1: r3(s1)};
      }
      steps.push(row);
    }
    out.write(
      JSON.stringify({
        clip: run.clip.id,
        reciter: t.reciter,
        reciterSplit: t.reciterSplit,
        block: t.block ?? null,
        blockSplit: t.blockSplit ?? null,
        pair: t.pair ?? null,
        pairSplit: t.pairSplit ?? null,
        id: j.id,
        crossT: j.crossT,
        onset: run.partsAt?.[1] && t.nextOnsetMs !== undefined ? +(run.partsAt[1].start + t.nextOnsetMs / 1000).toFixed(3) : null,
        steps,
      }) + '\n',
    );
    n += 1;
  }
}
out.end();
console.log(`joins ${n}`);
