/* eslint-env node, es2020 */
// Offline screen, no model: feeds what the bench's baseline run heard back through
// the tracker, stepping a few sounds at a time, and lists the gaps that pass every
// check that does not need the model's scores (shape, fit, nearby text, phrases).
// A clip with no such gap cannot get an added-word mark, at any score cut-off, so
// only clips with one need the model run again.
//   node added/replay_text.mjs <suite> [--step 4] [--part i/n] [--split dev|test]
// Reads .out/natural/baseline/runs/<suite>; writes under .out/added/screen/.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DEFAULTS, buildVocab, loadWords, rejectReason, textFeatures, wordShaped} from './rule.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const BENCH = path.resolve(HERE, '..');
const DIST = path.join(BENCH, '.out/added/core/dist/recitation');
const load = f => import(pathToFileURL(path.join(DIST, f)));
const {costTable} = await load('phonemeCost.js');
const {Tracker} = await load('tracker.js');
const {VerdictTracer} = await load('verdicts.js');
const {QuranCorpus} = await load('corpus.js');
const {DEFAULT_CONFIG} = await load('config.js');
const table = costTable();
const corpus = new QuranCorpus(JSON.parse(fs.readFileSync(path.join(BENCH, '.out/assets/zipformer_quran.json'), 'utf8')));
const {words, index} = loadWords();
const vocab = buildVocab(words);
const CFG = {...DEFAULT_CONFIG, commitDwell: 2, wholeWordAtCut: true};

const suite = process.argv[2];
const args = {};
for (let i = 3; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const step = Number(args.step ?? 4);
// Looser than the rule, so tuning within these cut-offs needs no second screen.
const SCREEN = {...DEFAULTS, fit: 0.4, fitLast: 0.5, ...(args.set ? JSON.parse(args.set) : {})};
const [part, parts] = (args.part ?? '0/1').split('/').map(Number);
const dir = path.join(BENCH, '.out/natural/baseline/runs', suite);
const outDir = path.join(BENCH, '.out/added/screen');
fs.mkdirSync(outDir, {recursive: true});
const split = args.split ?? 'all';
const tag = split === 'all' ? '' : `.${split}`;
const out = fs.createWriteStream(path.join(outDir, `${suite}${tag}.${part}.jsonl`));
const inSplit = t => {
  if (split === 'all' || !t) return true;
  const rec = t.reciterSplit;
  const unit = t.pairSplit ?? t.blockSplit;
  return (rec === undefined || rec === split) && (unit === undefined || unit === split);
};

const idOf = g => `${corpus.wordSurah[g]}:${corpus.wordAyah[g]}:${corpus.wordInAyah[g]}`;
const LOCK = new Set(['located', 'relocated']);
const names = fs.readdirSync(dir).filter(n => n.endsWith('.json')).sort();
let done = 0;
let withGap = 0;
for (let n = 0; n < names.length; n++) {
  if (n % parts !== part) continue;
  const r = JSON.parse(fs.readFileSync(path.join(dir, names[n]), 'utf8'));
  if (!inSplit(r.clip?.truth)) continue;
  const text = r.flush?.transcript ?? '';
  // The tracker the flush read, and where it started.
  const locks = (r.log ?? []).filter(e => e.type === 'debug' && !e.stop && LOCK.has(e.event) && e.at);
  const unlocks = (r.log ?? []).filter(e => e.type === 'debug' && !e.stop && ['idle', 'completed'].includes(e.event)).length;
  let start = null;
  if (locks.length) {
    const [s, a, w] = locks[locks.length - 1].at.split(':').map(Number);
    start = corpus.wordIndex(s, a, w);
  } else if (r.clip?.expected) {
    const e = r.clip.expected;
    start = corpus.wordIndex(e.surah, e.ayah, e.word ?? 0);
  }
  const row = {id: r.clip?.id ?? names[n], truth: r.clip?.truth ?? null, chars: text.length, locks: locks.length, unlocks, candidates: [], rejected: {}};
  if (start !== null && text.length) {
    const surah = corpus.wordSurah[start];
    const tracker = new Tracker(corpus, table, surah, start, CFG);
    const tracer = new VerdictTracer(tracker, table, CFG);
    const chars = [...text].map((ch, i) => ({ch, frame: i * 3, margin: 1}));
    const seen = new Map();
    for (let i = 0; i < chars.length; i += step) {
      tracker.feed(chars.slice(i, i + step));
      const vs = tracer.verdicts(i + step >= chars.length);
      for (const v of vs) {
        const g = v.gap;
        if (!g || v.state === 'pending') continue;
        const left = idOf(g.leftWord);
        const right = `${v.surah}:${v.ayah}:${v.word}`;
        const key = `${left}|${right}|${g.chars}`;
        if (seen.has(key)) continue;
        seen.set(key, true);
        const rec = {left, id: right, chars: g.chars, prev: g.prev, fitL: g.fitL, fitR: g.fitR, noGap: -99, margin: 1};
        const tf = textFeatures(rec, words, index, table, SCREEN, vocab);
        const why = rejectReason(rec, tf, SCREEN);
        row.rejected[why ?? 'pass'] = (row.rejected[why ?? 'pass'] ?? 0) + 1;
        if (!why) row.candidates.push({left, right, chars: g.chars, fit: [+g.fitL.toFixed(3), +g.fitR.toFixed(3)], at: i});
      }
    }
  }
  if (row.candidates.length) withGap += 1;
  out.write(JSON.stringify(row) + '\n');
  done += 1;
  if (done % 200 === 0) console.log(done, 'runs,', withGap, 'with a candidate');
}
out.end();
console.log(`${suite} part ${part}/${parts}: ${done} runs, ${withGap} with a candidate`);
void wordShaped;
