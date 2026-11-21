/* eslint-env node, es2020 */
// Compares the patched engine's own runs with the stand-in score_junction.mjs uses
// (the plain engine's runs plus the check computed on dumped posteriors): the
// check's decisions and scores on each join, and the marks the app rules show.
//
//   WORD_MARKS=.out/natural/junction/wordMarks.junction.ts \
//   node natural/junction/verify_inline.mjs --inline <dir> --plain <dir> --post <dir> --tau -5 --fit -8
import fs from 'node:fs';
import path from 'node:path';
import {replay} from '../replay.mjs';
import {DumpPosteriors, loadCorpus} from './llr.mjs';
import {decide, withCheck} from './decision.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const constants = {llrMissing: Number(args.tau), fitNext: Number(args.fit ?? -4), fitLate: Number(args['fit-late'] ?? -Infinity)};
const corpus = loadCorpus();
const engineWords = JSON.parse(
  fs.readFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../.out/natural/manifests/engine_words.json'), 'utf8'),
);
const wordCount = (s, a) => engineWords[`${s}:${a}`];

function offline(run, postDir) {
  const pr = run.probe;
  const post = new DumpPosteriors(fs.readFileSync(path.join(postDir, pr.post)), pr.epochs);
  const res = new Map();
  for (const j of pr.joins) {
    const got = decide(run, j, post, corpus, constants);
    if (got) res.set(j.id, got);
  }
  return res;
}

let takes = 0;
const out = {joinsCompared: 0, sameDecision: 0, onlyInline: 0, onlyOffline: 0, llrDiffMax: 0, llrDiffs: [], sameMarks: 0, differentMarks: []};
for (const f of fs.readdirSync(args.inline).filter(x => x.endsWith('.json'))) {
  const plainFile = path.join(args.plain, f);
  if (!fs.existsSync(plainFile)) continue;
  const inline = JSON.parse(fs.readFileSync(path.join(args.inline, f), 'utf8'));
  const plain = JSON.parse(fs.readFileSync(plainFile, 'utf8'));
  takes += 1;
  const off = offline(plain, args.post);
  const live = new Map();
  for (const c of inline.vchanges) {
    if (c.d?.junctionMissing === undefined || live.has(c.id)) continue;
    live.set(c.id, {llr: c.d.junction, missing: c.d.junctionMissing, t: c.t});
  }
  for (const [id, a] of off) {
    const b = live.get(id);
    if (!b) {
      out.onlyOffline += 1;
      continue;
    }
    out.joinsCompared += 1;
    if (a.missing === b.missing) out.sameDecision += 1;
    const d = Math.abs(a.llr - b.llr);
    out.llrDiffs.push(d);
    out.llrDiffMax = Math.max(out.llrDiffMax, d);
  }
  for (const id of live.keys()) if (!off.has(id)) out.onlyInline += 1;
  const marksInline = [...replay(inline, {mode: 'app', wordCount}).visible.keys()].sort().join(',');
  const marksOffline = [...replay(withCheck(plain, args.post, constants, corpus), {mode: 'app', wordCount}).visible.keys()]
    .sort()
    .join(',');
  if (marksInline === marksOffline) out.sameMarks += 1;
  else out.differentMarks.push({take: f, inline: marksInline, standIn: marksOffline});
}
out.takes = takes;
const s = [...out.llrDiffs].sort((a, b) => a - b);
out.llrDiffMedian = s.length ? s[Math.floor(s.length / 2)] : null;
out.llrDiffP99 = s.length ? s[Math.floor(0.99 * s.length)] : null;
delete out.llrDiffs;
console.log(JSON.stringify(out, null, 1));
