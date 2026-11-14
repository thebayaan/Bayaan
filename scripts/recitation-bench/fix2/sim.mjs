/* eslint-env node, es2020 */
// Plays a staged recitation through the live check, tick by tick, as the app would:
// the engine's own log-mel frames in 480 ms chunks, the follower's recorded cursor and
// lock events, and up to three model runs per tick.
//
//   node fix2/sim.mjs <name> [--cfg '<json>'] [--plant <seed>] [--kinds changed,missed,added]
//       [--check <liveCheck dir>] [--audio <f32>] [--run <follower json>] [--out <file>]
//       [--tag <tag>] [--keep 1] [--trace 1|<file>] [--debug <file>] [--noenergy 1]
//       [--cachekey <key>] [--nocache 1] [--blind <json>]
//
// <name> is a file under .out/fix2/qdc (e.g. 7_67) with its follower run under
// .out/fix2/runs. The result goes to .out/fix2/sim/<name>[.p<seed>][.<tag>].json unless
// --out says otherwise. --plant alters the TEXT the check reads (the audio stays
// correct): in about one ayah in three one word is replaced by another Quran word
// ('changed'), a word is added to the text ('missed': the reader did not say it), or a
// word is taken out of the text ('added': the reader says a word the text lacks).
// --keep 1 lists the words judged fine, which pool_report.py and cover.py need. --trace
// writes one line per model run; --debug writes the check's own trace lines. Each probe
// line gets t, the audio time of its tick. --blind <json> passes the places listed in the
// file's "words" (the app's services/recitation/liveCheck/blindSpots.json) to the check,
// which never marks them, as the app does; without it no place is blind.
//
// The model's output for each window is kept in .out/fix2/cache/<key>.bin and
// <key>.idx.json (key: --cachekey, else <name>), so a rule change replays with no model
// run; --nocache 1 neither reads nor writes it. Other audio under the same name
// (planted, mixed) needs its own key. One process at a time per key: runs one after
// another share a key safely, two at once may lose or mix entries.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {loadModel, MODEL_DIR} from './model.mjs';
import {buildLive} from './build_live.mjs';
import {
  OUT,
  QDC,
  RUNS,
  BINS,
  CHUNK,
  SR,
  VOCAB,
  ayahWords,
  ayahCount,
  allKeys,
  editDistance,
  engineFrames,
  parseArgs,
  readF32,
  rng,
} from './common.mjs';

const args = parseArgs();
const name = args._[0];
if (!name) {
  console.error(
    'usage: node fix2/sim.mjs <name> [options]: see the top of sim.mjs',
  );
  process.exit(2);
}
const cfg = args.cfg ? JSON.parse(args.cfg) : {};
const built = buildLive(args.check);
const {createLiveCheck} = await import(built.file);

const audio = readF32(args.audio ?? path.join(QDC, `${name}.f32`));
const follower = JSON.parse(
  fs.readFileSync(args.run ?? path.join(RUNS, `${name}.json`), 'utf8'),
);
const {rows, upTo} = await engineFrames(audio);
const mel = new Float32Array(rows.length * BINS);
rows.forEach((row, i) => mel.set(row, i * BINS));

// Planted events: the text the check reads, altered.
const surahOf = Number(name.split('_')[1]);
const altered = new Map(); // "s:a" -> letters[]
const events = [];
if (args.plant !== undefined) {
  const rand = rng(
    Number(args.plant) * 7919 + surahOf * 31 + Number(name.split('_')[0]),
  );
  const pool = [];
  for (const k of allKeys().filter(key => /^(2|3|4|18|36|55|67):/.test(key))) {
    for (const w of ayahWords(k)) {
      pool.push(w);
    }
  }
  const pick = (letters, minDist) => {
    for (let i = 0; i < 400; i++) {
      const c = pool[Math.floor(rand() * pool.length)];
      if (
        Math.abs(c.length - letters.length) <= 1 &&
        editDistance([...c], [...letters]) >= minDist
      ) {
        return c;
      }
    }
    return null;
  };
  const kinds = args.kinds ? args.kinds.split(',') : null;
  for (let a = 1; a <= ayahCount(surahOf); a++) {
    const words = ayahWords(`${surahOf}:${a}`);
    if (!words || words.length < 4) {
      continue;
    }
    const r = rand();
    if (r > 0.45) {
      continue;
    }
    const kind = kinds
      ? kinds[Math.floor(rand() * kinds.length)]
      : r < 0.25
        ? 'changed'
        : r < 0.38
          ? 'missed'
          : 'added';
    // Place: first, last or interior in about 1:1:3.
    const p = rand();
    const text = [...words];
    if (kind === 'changed') {
      const w =
        p < 0.2
          ? 0
          : p < 0.4
            ? words.length - 1
            : 1 + Math.floor(rand() * (words.length - 2));
      const repl = pick(words[w], 2);
      if (!repl) {
        continue;
      }
      text[w] = repl;
      events.push({
        kind,
        key: `${surahOf}:${a}:${w}`,
        place: w === 0 ? 'first' : w === words.length - 1 ? 'last' : 'interior',
        letters: words[w].length,
      });
    } else if (kind === 'missed') {
      // A word the text has and the reader does not say: insert one before position w.
      const w =
        p < 0.2
          ? 0
          : p < 0.4
            ? words.length
            : 1 + Math.floor(rand() * (words.length - 1));
      const extra = pick(words[Math.min(w, words.length - 1)], 2);
      if (!extra) {
        continue;
      }
      text.splice(w, 0, extra);
      events.push({
        kind,
        key: `${surahOf}:${a}:${w}`,
        place: w === 0 ? 'first' : w === words.length ? 'last' : 'interior',
        letters: extra.length,
      });
    } else {
      // A word the reader says and the text lacks: take an interior word out.
      const w = 1 + Math.floor(rand() * (words.length - 2));
      text.splice(w, 1);
      events.push({
        kind,
        key: `${surahOf}:${a}:${w}`,
        place: 'interior',
        letters: words[w].length,
      });
    }
    altered.set(`${surahOf}:${a}`, text);
  }
}
const blind = new Set(
  args.blind ? JSON.parse(fs.readFileSync(args.blind, 'utf8')).words : [],
);
const deps = {
  letters: (s, a) => altered.get(`${s}:${a}`) ?? ayahWords(`${s}:${a}`),
  ayahCount,
  blind: (s, a, w) => blind.has(`${s}:${a}:${w}`),
};
const probes = [];
// The audio time of the tick being played, put on each probe line.
let nowT = 0;
const dbgFile = args.debug ? fs.openSync(args.debug, 'w') : null;
const check = createLiveCheck(deps, cfg, {
  probe: line => probes.push({...line, t: nowT}),
  trace: dbgFile ? line => fs.writeSync(dbgFile, line + '\n') : undefined,
});
const model = await loadModel();
const cache = openCache(
  args.cachekey ?? name,
  {
    _audio: crypto
      .createHash('sha256')
      .update(new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength))
      .digest('hex')
      .slice(0, 16),
    _model: path.basename(MODEL_DIR),
  },
  !!args.nocache,
);

/**
 * The on-disk cache of model outputs for one key. The index maps "from-to" (log-mel
 * frames) to [byte offset in the .bin, model frames]; its "_audio" and "_model" fields
 * say which recording and model filled it. A key filled from other audio or another
 * model stops the run. Indexes from before those fields are taken as they are, and get
 * them when this run adds an entry.
 */
function openCache(key, stamp, off) {
  let hits = 0;
  let misses = 0;
  if (off) {
    return {
      get: () => null,
      put: (from, to, out) => {
        misses += 1;
        return out;
      },
      close: () => ({hits, misses}),
    };
  }
  const dir = path.join(OUT, 'cache');
  fs.mkdirSync(dir, {recursive: true});
  const idxFile = path.join(dir, `${key}.idx.json`);
  const binFile = path.join(dir, `${key}.bin`);
  let idx = {};
  if (fs.existsSync(idxFile) && fs.existsSync(binFile)) {
    try {
      idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
    } catch {
      idx = {};
    }
  }
  if (!Object.keys(idx).some(k => !k.startsWith('_'))) {
    // No usable index: start the key afresh.
    idx = {};
    fs.rmSync(binFile, {force: true});
  }
  // A stamp missing from an older index is written with the first new entry, so a run
  // that only reads never rewrites the index.
  let dirty = false;
  for (const [k, v] of Object.entries(stamp)) {
    if (idx[k] === undefined) {
      idx[k] = v;
    } else if (idx[k] !== v) {
      console.error(
        `cache key ${key} was filled with other ${k.slice(1)} (${
          idx[k]
        }, now ${v}); ` + 'pass another --cachekey, or --nocache 1',
      );
      process.exit(1);
    }
  }
  const fd = fs.openSync(binFile, 'a+');
  let size = fs.fstatSync(fd).size;
  return {
    get(from, to) {
      const e = idx[`${from}-${to}`];
      const bytes = e ? e[1] * VOCAB * 4 : 0;
      if (!e || e[0] + bytes > size) {
        return null;
      }
      const buf = Buffer.alloc(bytes);
      if (fs.readSync(fd, buf, 0, bytes, e[0]) !== bytes) {
        return null;
      }
      hits += 1;
      return {
        logp: new Float32Array(buf.buffer, buf.byteOffset, e[1] * VOCAB),
        frames: e[1],
      };
    },
    put(from, to, out) {
      misses += 1;
      const bytes = out.frames * VOCAB * 4;
      const buf = Buffer.from(out.logp.buffer, out.logp.byteOffset, bytes);
      // The file is opened for appending, so this lands at its end. Read the end again
      // first: then even a second process on the key (not supported) can lose entries,
      // but hardly ever point one at another window's output.
      size = fs.fstatSync(fd).size;
      fs.writeSync(fd, buf, 0, bytes);
      idx[`${from}-${to}`] = [size, out.frames];
      size += bytes;
      dirty = true;
      return out;
    },
    close() {
      fs.closeSync(fd);
      if (dirty) {
        // Written whole and renamed, so a later run never reads half an index.
        const tmp = `${idxFile}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(idx));
        fs.renameSync(tmp, idxFile);
      }
      return {hits, misses};
    },
  };
}

fs.mkdirSync(path.join(OUT, 'sim'), {recursive: true});
const traceFile = args.trace
  ? args.trace === '1'
    ? path.join(OUT, 'sim', `${name}.trace.txt`)
    : args.trace
  : null;
const trace = traceFile ? fs.openSync(traceFile, 'w') : null;

// Follower events, fed in by the end time of each chunk.
const log = follower.log.filter(
  e => e.type === 'word_progress' || e.type === 'debug',
);
const UNLOCK = new Set(['lost', 'idle', 'locateFailed', 'completed']);
let li = 0;
const finals = new Map();
let runs = 0;
let ms = 0;
let melSeconds = 0;
for (let c = 0; c < upTo.length; c++) {
  const t = Math.min(audio.length, (c + 1) * CHUNK) / SR;
  nowT = +t.toFixed(2);
  while (li < log.length && log[li].t <= t + 1e-6) {
    const e = log[li++];
    if (e.type === 'word_progress') {
      const [s, a] = e.key.split(':').map(Number);
      check.setPlace({surah: s, ayah: a, word: e.w, totalWords: e.n});
    } else if (e.event === 'located' || e.event === 'relocated') {
      const at = (e.at ?? e.to ?? '').split(':').map(Number);
      if (at.length === 3) {
        check.relocated({surah: at[0], ayah: at[1], word: at[2]}, e.t);
      }
    } else if (UNLOCK.has(e.event)) {
      check.lost();
    }
  }
  // Up to three windows for the same audio: the long one, the short one that watches
  // for the next ayah, and an ayah's last look.
  for (let n = 0; n < 3; n++) {
    const plan = check.plan(upTo[c]);
    if (!plan) {
      break;
    }
    const frames = plan.to - plan.from;
    const t0 = performance.now();
    const out =
      cache.get(plan.from, plan.to) ??
      cache.put(
        plan.from,
        plan.to,
        await model.runFrames(
          mel.subarray(plan.from * BINS, plan.to * BINS),
          frames,
        ),
      );
    ms += performance.now() - t0;
    runs += 1;
    melSeconds += frames / 100;
    const energy = new Float32Array(frames);
    for (let f = 0; f < frames; f++) {
      let sum = 0;
      const at = (plan.from + f) * BINS;
      for (let b = 0; b < BINS; b++) {
        sum += mel[at + b];
      }
      energy[f] = sum / BINS;
    }
    const opinions = check.step(
      plan,
      out.logp,
      out.frames,
      args.noenergy ? undefined : energy,
    );
    if (trace) {
      const shown = opinions
        .filter(o => o.verdict !== 'fine')
        .map(
          o =>
            `${o.surah}:${o.ayah}:${o.word}#${o.evidence.reading} ${o.verdict}${
              o.final ? '!' : '?'
            } sh=${o.evidence.letterShare.toFixed(
              2,
            )} gap=${o.evidence.gap.toFixed(1)}`,
        );
      fs.writeSync(
        trace,
        `${t.toFixed(2)} plan ${plan.from}-${plan.to} (${(frames / 100).toFixed(
          1,
        )}s) ${shown.join(' | ')}\n`,
      );
    }
    for (const o of opinions) {
      const id = `${o.surah}:${o.ayah}:${o.word}#${o.evidence.reading}`;
      if (!o.final || finals.has(id)) {
        continue;
      }
      finals.set(id, {
        key: `${o.surah}:${o.ayah}:${o.word}`,
        reading: o.evidence.reading,
        verdict: o.verdict,
        t: +t.toFixed(2),
        share: +o.evidence.letterShare.toFixed(3),
        gap: +o.evidence.gap.toFixed(2),
        from: +o.evidence.audioFrom.toFixed(2),
        to: +o.evidence.audioTo.toFixed(2),
      });
    }
  }
}
if (trace) {
  fs.closeSync(trace);
}
if (dbgFile) {
  fs.closeSync(dbgFile);
}
const cached = cache.close();
const list = [...finals.values()];
const result = {
  name,
  sha: built.sha.slice(0, 12),
  seconds: +(audio.length / SR).toFixed(1),
  plant: args.plant ?? null,
  cfg,
  // How many places --blind listed (left out without it).
  blind: args.blind ? blind.size : undefined,
  runs,
  msPerRun: +(ms / Math.max(1, runs)).toFixed(1),
  meanWindow: +(melSeconds / Math.max(1, runs)).toFixed(2),
  judged: list.length,
  fine: list.filter(f => f.verdict === 'fine').length,
  bad: list.filter(f => f.verdict !== 'fine'),
  judgedKeys: [...new Set(list.map(f => f.key))].length,
  events,
  probes,
  fineKeys: args.keep
    ? list.filter(f => f.verdict === 'fine').map(f => f.key)
    : undefined,
};
const outFile =
  args.out ??
  path.join(
    OUT,
    'sim',
    `${name}${args.plant !== undefined ? `.p${args.plant}` : ''}${
      args.tag ? `.${args.tag}` : ''
    }.json`,
  );
fs.mkdirSync(path.dirname(outFile), {recursive: true});
fs.writeFileSync(outFile, JSON.stringify(result));
console.log(
  JSON.stringify({
    name,
    cached: cached.hits,
    seconds: result.seconds,
    runs,
    msPerRun: result.msPerRun,
    meanWindow: result.meanWindow,
    judgedKeys: result.judgedKeys,
    fine: result.fine,
    bad: result.bad.length,
    events: events.length,
    probes: probes.length,
  }),
);
