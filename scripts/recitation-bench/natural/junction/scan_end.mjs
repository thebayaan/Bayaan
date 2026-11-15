/* eslint-env node, es2020 */
// The end of a take: the reader stopped with the cursor on an ayah's last two
// words. Over the frames from the word before the last word to the end of the
// audio, 'word before + last word' against 'word before'. No next word anchors
// this one, so the window is fixed: audio after the word before counts against
// leaving the last word out.
//
//   node natural/junction/scan_end.mjs <runs dir> <post dir> <out.jsonl>
import fs from 'node:fs';
import path from 'node:path';
import {
  DumpPosteriors,
  beforeForms,
  encode,
  forcedLogLik,
  loadCorpus,
  shortMadd,
} from './llr.mjs';

const [runsDir, postDir, outFile] = process.argv.slice(2);
const corpus = loadCorpus();
const out = fs.createWriteStream(outFile);
const best = (post, list, a, b) =>
  Math.max(...list.filter(Boolean).map(ids => forcedLogLik(post, ids, a, b)));
let n = 0;
for (const f of fs.readdirSync(runsDir).filter(x => x.endsWith('.json'))) {
  const run = JSON.parse(fs.readFileSync(path.join(runsDir, f), 'utf8'));
  const e = run.probe?.end;
  const t = run.clip.truth;
  if (!e || !run.probe.post) continue;
  const file = path.join(postDir, run.probe.post);
  if (!fs.existsSync(file)) continue;
  const row = {
    clip: run.clip.id,
    type: t.type,
    pair: t.pair ?? t.audioKey,
    pairSplit: t.pairSplit ?? null,
    reciter: t.reciter,
    reciterSplit: t.reciterSplit,
    id: e.id,
    atEnd: e.cursor >= e.L - 1,
  };
  const words = new Map(e.words.map(w => [w.g, w]));
  const c = words.get(e.L - 1);
  const last = words.get(e.L);
  row.state = last?.state ?? null;
  row.heard = last?.ch ?? '';
  if (row.atEnd && c?.from !== undefined) {
    const post = new DumpPosteriors(fs.readFileSync(file), run.probe.epochs, e.epoch);
    const from = Math.max(0, c.ff - 1);
    const to = post.lastRow - post.base;
    if (post.has(from, to) && to > from) {
      const exp = corpus.wordPhonemes(e.L);
      const forms = [exp, shortMadd(exp)].filter((x, i, a) => a.indexOf(x) === i);
      const before = beforeForms(corpus, e.L - 1, e.L);
      const with1 = [];
      const with0 = [];
      for (const b of before) {
        with0.push(encode(b));
        for (const l of forms) with1.push(encode(b + l));
      }
      const nL = encode(exp)?.length ?? 1;
      row.llr = +((best(post, with1, from, to) - best(post, with0, from, to)) / nL).toFixed(3);
      row.frames = to - from;
    }
  }
  out.write(JSON.stringify(row) + '\n');
  n += 1;
}
out.end();
console.log(`scored ${n}`);
