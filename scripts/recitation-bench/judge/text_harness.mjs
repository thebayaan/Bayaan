/* eslint-env node, es2020 */
// Calibration harness of the second judge. Nothing here reads engine output: word
// times come from quran-asr-small's own alignment (align_all.mjs), the expected
// text and alternatives from the official text (index.json). This is where the
// judge's margins may be set.
//
// For every word it tests, it plays what the app would hold at that moment: a
// rolling buffer of log-mel frames (the same frames the engine computes anyway)
// ending `delta` seconds after the word, `D` seconds long, over the recording or
// the recordings played in order, and scores the expected word against its
// alternatives in the ayah's text.
//
//   node judge/text_harness.mjs --suite pool|control|changed --split dev|test|all
//     --out file.jsonl [--shard i/n] [--every n] [--configs '[{"D":8,"delta":1.2,"left":2,"right":1}]']
//
// A configuration may also keep the slice inside the word's ayah, since the model
// learned on one ayah at a time and loses words when a slice spans two: `cut` starts
// it that many seconds before the ayah's first word, `tail` ends it that many
// seconds after the ayah's end. `pad` adds that many seconds of the slice's
// quietest frame after its end, as a reader's pause would.
//
// Suites, each from its natural-benchmark manifest:
//   pool     every recited word of a passage, against its own text;
//   control  every word of a whole recording, against its own text;
//   changed  the event's word of a recording of Y against the text of X, and the
//            spelling-only traps.
import fs from 'node:fs';
import path from 'node:path';
import {loadModel, readF32, sliceFrames, withQuietTail, MIN_FRAMES} from './model.mjs';
import {fbank} from './fbank.mjs';
import {judgeWord} from './judge.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, '../.out/natural/judge');
const MAN = path.join(HERE, '../.out/natural/manifests');
const SR = 16000;

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const suite = args.suite;
const split = args.split ?? 'dev';
const every = Number(args.every ?? 1);
const [iShard, nShard] = (args.shard ?? '0/1').split('/').map(Number);
const configs = JSON.parse(args.configs ?? '[{"D":8,"delta":1.2,"left":2,"right":1}]');

const index = JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8'));
const SPLITS = index.splits;
export const hafsToken = (key, e) => (SPLITS[key] !== undefined && e > SPLITS[key] ? e - 1 : e);

function loadAlign() {
  const map = new Map();
  for (const f of fs.readdirSync(path.join(OUT, 'align'))) {
    for (const line of fs.readFileSync(path.join(OUT, 'align', f), 'utf8').split('\n')) {
      if (!line) continue;
      const r = JSON.parse(line);
      map.set(`${r.slug}|${r.key}`, r);
    }
  }
  return map;
}

const alignments = loadAlign();
const lettersOf = key => index.ayat[key].map(x => x.l);
const altsOf = (key, j) => {
  const row = index.ayat[key][j];
  return {
    mut: row.m.map(id => index.types[id]),
    near: (index.near[row.s] ?? []).map(id => index.types[id]),
  };
};

const keep = truth => {
  if (split === 'all') return true;
  return truth.reciterSplit === split && (truth.pairSplit ?? truth.blockSplit ?? split) === split;
};

/** Tests: where a word was said in a stream, and which word of which text it is. */
function testsOf() {
  const out = [];
  if (suite === 'pool') {
    for (const c of JSON.parse(fs.readFileSync(path.join(MAN, 'pool.json'), 'utf8'))) {
      if (!keep(c.truth)) continue;
      const parts = [];
      let at = 0;
      for (const p of c.parts) {
        const a = alignments.get(`${c.truth.reciter}|${p.key}`);
        if (!a) throw new Error(`no alignment for ${c.truth.reciter} ${p.key}`);
        parts.push({audio: p.audio, key: p.key, start: at, a});
        at += a.seconds;
      }
      const words = [];
      for (const p of parts) {
        p.a.map.forEach((j, occ) => {
          const [t0, t1] = p.a.times[occ];
          words.push({
            run: c.id,
            suite: 'pool',
            reciter: c.truth.reciter,
            reciterSplit: c.truth.reciterSplit,
            unit: c.truth.block,
            unitSplit: c.truth.blockSplit,
            key: p.key,
            j,
            occ,
            restart: p.a.restarts > 0,
            n: index.ayat[p.key].length,
            t0: p.start + t0,
            t1: p.start + t1,
            ayahStart: p.start + p.a.times[0][0],
            ayahEnd: p.start + p.a.seconds,
          });
        });
      }
      out.push({id: c.id, parts: parts.map(p => ({audio: p.audio, start: p.start})), seconds: at, words});
    }
  } else if (suite === 'control') {
    for (const c of JSON.parse(fs.readFileSync(path.join(MAN, 'w1_control.json'), 'utf8'))) {
      if (!keep(c.truth)) continue;
      const a = alignments.get(`${c.truth.reciter}|${c.truth.audioKey}`);
      const words = a.map.map((j, occ) => ({
        run: c.id,
        suite: 'control',
        reciter: c.truth.reciter,
        reciterSplit: c.truth.reciterSplit,
        unit: c.truth.audioKey,
        key: c.truth.audioKey,
        j,
        occ,
        restart: a.restarts > 0,
        n: index.ayat[c.truth.audioKey].length,
        t0: a.times[occ][0],
        t1: a.times[occ][1],
        ayahStart: a.times[0][0],
        ayahEnd: a.seconds,
      }));
      out.push({id: c.id, parts: [{audio: c.audio, start: 0}], seconds: a.seconds, words});
    }
  } else if (suite === 'changed') {
    for (const c of JSON.parse(fs.readFileSync(path.join(MAN, 'w1.json'), 'utf8'))) {
      const t = c.truth;
      if (!keep(t) || (t.type !== 'changed' && t.type !== 'trap')) continue;
      const a = alignments.get(`${t.reciter}|${t.audioKey}`);
      const j = hafsToken(t.expectedKey, t.target);
      const occ = a.map.indexOf(j);
      if (occ < 0) throw new Error(`${c.id}: word not read`);
      const said = lettersOf(t.audioKey)[j];
      out.push({
        id: c.id,
        parts: [{audio: c.audio, start: 0}],
        seconds: a.seconds,
        words: [
          {
            run: c.id,
            suite: t.type,
            reciter: t.reciter,
            reciterSplit: t.reciterSplit,
            unit: t.pair,
            unitSplit: t.pairSplit,
            key: t.expectedKey,
            audioKey: t.audioKey,
            j,
            occ,
            close: t.close,
            textDistance: t.textDistance,
            position: t.position,
            n: index.ayat[t.expectedKey].length,
            said,
            t0: a.times[occ][0],
            t1: a.times[occ][1],
            ayahStart: a.times[0][0],
            ayahEnd: a.seconds,
          },
        ],
      });
    }
  } else {
    throw new Error('--suite pool|control|changed');
  }
  return out;
}

const streams = testsOf().filter((_, i) => i % nShard === iShard);
fs.mkdirSync(path.dirname(args.out), {recursive: true});
const out = fs.openSync(args.out, 'w');
const model = await loadModel();
let done = 0;
let slices = 0;
let msModel = 0;
let msScore = 0;
for (const s of streams) {
  const pieces = s.parts.map(p => readF32(p.audio));
  const audio = new Float32Array(pieces.reduce((x, y) => x + y.length, 0));
  let at = 0;
  for (const p of pieces) {
    audio.set(p, at);
    at += p.length;
  }
  const feats = fbank(audio);
  for (let w = 0; w < s.words.length; w += every) {
    const word = s.words[w];
    const words = lettersOf(word.key);
    const alts = altsOf(word.key, word.j);
    if (word.said && word.said !== words[word.j] && !alts.mut.includes(word.said)) {
      alts.extra = [word.said];
    }
    const results = [];
    const cache = new Map();
    for (const cfg of configs) {
      let endSec = word.t1 + cfg.delta;
      if (cfg.tail !== undefined) endSec = Math.min(endSec, word.ayahEnd + cfg.tail);
      const end = Math.min(audio.length, Math.round(endSec * SR));
      let start = Math.max(0, end - Math.round(cfg.D * SR));
      if (cfg.cut !== undefined) start = Math.max(start, Math.round((word.ayahStart - cfg.cut) * SR));
      start = Math.max(0, start);
      const key = `${start}:${end}:${cfg.pad ?? 0}`;
      let r = cache.get(key);
      if (!r) {
        const cut = sliceFrames(feats, start, end, audio.length);
        if (cut.frames < MIN_FRAMES) {
          results.push({cfg, tooShort: true, expected: 0, nothing: 0, mut: [], near: []});
          continue;
        }
        const padded = cfg.pad ? withQuietTail(cut, Math.round(cfg.pad * 100)) : cut;
        r = await model.runFrames(padded.data, padded.frames);
        cache.set(key, r);
        slices += 1;
        msModel += r.ortMs;
      }
      const t0 = performance.now();
      const verdict = judgeWord(r.logp, r.frames, words, word.j, alts, {
        leftWords: cfg.left,
        rightWords: cfg.right,
      });
      msScore += performance.now() - t0;
      // The true word's score, wherever it stood among the alternatives.
      results.push({cfg, ...verdict});
    }
    fs.writeSync(out, JSON.stringify({...word, r: results}) + '\n');
    done += 1;
  }
}
fs.closeSync(out);
console.log(
  JSON.stringify({suite, split, streams: streams.length, words: done, slices, msPerSlice: +(msModel / Math.max(1, slices)).toFixed(1), msPerScore: +(msScore / Math.max(1, done * configs.length)).toFixed(2)}),
);
