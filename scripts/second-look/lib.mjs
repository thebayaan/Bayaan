/* eslint-env node, es2020 */
// Which runs each population reads, the audio they heard, and where the judge's slice goes.
// Tuning data only: runs of test cells are never opened. The list comes from the manifests,
// and a run's file is read only after its cell has been checked there.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {takeWindow} from '../recitation-bench/chatter/mix.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
export const BENCH = path.resolve(HERE, '../recitation-bench');
export const OUT = path.join(BENCH, '.out/second-look');
const V = path.join(BENCH, '.out/natural/verify');
const J = path.join(BENCH, '.out/natural/junction');
const BASE = path.join(BENCH, '.out/natural/baseline/runs');
const MAN = path.join(BENCH, '.out/natural/manifests');
const SHIPPED = path.join(BENCH, '.out/chatter/runs/shipped');
export const SR = 16000;

const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const judgeC = readJson(path.join(BENCH, 'judge/judge_constants.json'));
const engineC = readJson(path.join(BENCH, 'judge/engine_constants.npl.json'));
export const LEFT = judgeC.leftWords.value;
export const RIGHT = judgeC.rightWords.value;
export const FIRST_WITHIN = judgeC.firstWithinFrames.value;
const D = judgeC.sliceSeconds.value;
const CUT = judgeC.cutSeconds.value;
const TAIL = judgeC.tailSeconds.value;
export const HOLD = engineC.holdSeconds.value;
const TRACKER_LAG = engineC.trackerLagSeconds.value;
const CURSOR_LAG = engineC.cursorLagSeconds.value;
const AFTER_PREVIOUS = engineC.afterPreviousSeconds.value;
const NO_PREVIOUS = engineC.noPreviousSeconds.value;
const MIN_SLICE = engineC.minSliceSeconds.value;
const WAKE_OK_GOP = engineC.wakeOkGop.value;

export const engineWords = readJson(path.join(MAN, 'engine_words.json'));
export const wordCount = (s, a) => engineWords[`${s}:${a}`] ?? undefined;
export const hasKey = key => key in engineWords;

export const VOICE_CONDS = [
  'none_0',
  'one_en_10',
  'one_ar_10',
  'crowd_10',
  'tv_ar_10',
  'rec_one_10',
  'one_en_5',
  'one_ar_5',
  'crowd_5',
  'tv_ar_5',
  'rec_one_5',
  'rec_same_5',
];
export const W1INT_CONDS = [
  'none_0',
  'one_ar_10',
  'one_ar_5',
  'crowd_5',
  'tv_ar_5',
];

/** A run's file name, as the bench writes it. */
export const fileOf = id => `${String(id).replace(/[^\w.-]/g, '_')}.json`;

const devDev = t =>
  t.reciterSplit === 'dev' && (t.pairSplit ?? t.blockSplit ?? 'dev') === 'dev';
const devReciter = t => t.reciterSplit === 'dev';
const rowFiles = (dir, prefix) =>
  fs
    .readdirSync(dir)
    .filter(f => f.startsWith(`${prefix}.`) && f.endsWith('.jsonl'))
    .map(f => path.join(dir, f));
const inDir = dir => id => path.join(dir, fileOf(id));

/**
 * dir: where the marks' run lives. plain: the run the judge's slices were placed from.
 * manifest and keep: the list of runs and the cell. rows48: rows a job before this one
 * wrote. flush: the suite uses the harness's end-of-input verdicts.
 */
export const SUITES = {
  pool: {
    dir: inDir(path.join(V, 'runs/pool')),
    plain: inDir(path.join(BASE, 'pool')),
    manifest: path.join(MAN, 'pool.json'),
    keep: devDev,
    rows48: () => rowFiles(path.join(V, 'e2e_all'), 'pool'),
    modes: ['app'],
  },
  w5: {
    dir: id => {
      const a = path.join(J, 'runs/w5', fileOf(id));
      return fs.existsSync(a) ? a : path.join(BASE, 'w5', fileOf(id));
    },
    plain: inDir(path.join(BASE, 'w5')),
    manifest: path.join(MAN, 'w5.json'),
    keep: devReciter,
    rows48: () => rowFiles(path.join(V, 'e2e_all'), 'w5'),
    modes: ['app'],
    standIn: path.join(J, 'post/w5'),
  },
  w1: {
    dir: inDir(path.join(BASE, 'w1')),
    plain: inDir(path.join(BASE, 'w1')),
    manifest: path.join(MAN, 'w1.json'),
    keep: devDev,
    rows48: () => rowFiles(path.join(V, 'e2e_all'), 'w1'),
    modes: ['app', 'carry'],
    flush: true,
  },
  live_last: {
    dir: inDir(path.join(V, 'runs/live_last')),
    plain: inDir(path.join(V, 'runs_plain/live_last')),
    manifest: path.join(V, 'live/live.json'),
    keep: devReciter,
    rows48: () => [path.join(V, 'e2e_live_end/live_last.jsonl')],
    modes: ['app'],
  },
  live_control: {
    dir: inDir(path.join(V, 'runs/live_control')),
    plain: inDir(path.join(V, 'runs_plain/live_control')),
    manifest: path.join(V, 'live/control.json'),
    keep: devReciter,
    rows48: () => [path.join(V, 'e2e_live_end/live_control.jsonl')],
    modes: ['app'],
  },
  interior: {
    dir: inDir(path.join(V, 'runs_plain/interior')),
    plain: inDir(path.join(V, 'runs_plain/interior')),
    manifest: path.join(V, 'live/interior.json'),
    keep: devDev,
    rows48: () => [path.join(V, 'e2e_interior/interior.jsonl')],
    modes: ['app'],
  },
  sobolev: {
    dir: inDir(path.join(BASE, 'learners')),
    plain: inDir(path.join(BASE, 'learners')),
    manifest: path.join(MAN, 'learners.json'),
    keep: t => t.dataset === 'sobolev',
    rows48: () => rowFiles(path.join(V, 'e2e_all'), 'learners'),
    modes: ['app'],
  },
  quranmb: {
    dir: inDir(path.join(BENCH, '.out/real3/quranmb')),
    plain: inDir(path.join(BENCH, '.out/real3/quranmb')),
    list: path.join(BENCH, '.out/real3/quranmb'),
    modes: ['app'],
    learnerOnly: true,
  },
};
for (const c of VOICE_CONDS) {
  SUITES[`voices_${c}`] = {
    dir: inDir(path.join(SHIPPED, c)),
    plain: inDir(path.join(SHIPPED, c)),
    list: path.join(SHIPPED, c),
    modes: ['app'],
  };
}
for (const c of W1INT_CONDS) {
  const d = path.join(OUT, 'inputs/w1int', c);
  SUITES[`w1int_${c}`] = {
    dir: inDir(d),
    plain: inDir(d),
    list: d,
    modes: ['app', 'carry'],
    flush: true,
  };
}

/** The runs of a suite, with their truth when the manifest gives it. */
export function suiteRunIds(name, withTruth = false) {
  const s = SUITES[name];
  if (s.manifest) {
    const rows = readJson(s.manifest).filter(c => s.keep(c.truth));
    return withTruth
      ? rows.map(c => ({id: c.id, truth: c.truth}))
      : rows.map(c => c.id);
  }
  const files = fs
    .readdirSync(s.list)
    .filter(f => f.endsWith('.json'))
    .sort();
  return files.map(f => readJson(path.join(s.list, f)).clip.id);
}

/** The judge's rows of a suite at one hold: run -> `${id}|${t}|${src}` -> row. */
export function loadRows(name, hold) {
  const s = SUITES[name];
  const ids = new Set(suiteRunIds(name));
  const files = hold === HOLD && s.rows48 ? s.rows48() : [rowFile(name, hold)];
  const out = new Map();
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      if (!line) continue;
      // Rows of other cells stay unparsed.
      const m = /^\{"run":"([^"]+)"/.exec(line);
      if (!m || !ids.has(m[1])) continue;
      let r;
      try {
        r = JSON.parse(line);
      } catch {
        continue;
      }
      let by = out.get(r.run);
      if (!by) out.set(r.run, (by = new Map()));
      by.set(`${r.id}|${r.t}|${r.src}`, r);
    }
  }
  return out;
}

export const rowFile = (name, hold) =>
  path.join(OUT, 'rows', `${name}.h${Math.round(hold * 100)}.jsonl`);

// ------------------------------------------------------------------- the judge's slice

/** The word's letter index: the engine splits three words the official text keeps whole. */
const index = readJson(path.join(BENCH, '.out/natural/judge/index.json'));
export const lettersOf = key => index.ayat[key]?.map(x => x.l) ?? null;
export const splitAyah = key => index.splits[key] !== undefined;
export const hafsToken = (key, e) =>
  index.splits[key] !== undefined && e > index.splits[key] ? e - 1 : e;
export const altsOf = (key, j) => ({
  mut: index.ayat[key][j].m.map(id => index.types[id]),
  near: [],
});

/** What wakes the judge at all: Step 2's list, the widest. */
export function wakesJudge(c) {
  const state = c.to ?? c.state;
  if (state === 'pending') return false;
  if (state !== 'ok') return true;
  const gop = c.d?.gop;
  if (typeof gop === 'number') return gop <= WAKE_OK_GOP;
  return c.d?.distance > 0;
}

const RESTARTS = new Set(['idle', 'completed']);

/**
 * Seconds of the decoder's restarts in a run: the tracker's frames in a saved run count
 * from 0 at each, while audio time goes on. The app reads them on one clock.
 */
export function restartsOf(run) {
  return run.log
    .filter(e => e.type === 'debug' && !e.stop && RESTARTS.has(e.event))
    .map(e => e.t);
}

/** Where the frames of the tracker a run ended with count from, in seconds. */
function endTrackerBase(run) {
  const restarts = restartsOf(run);
  const events = run.log.filter(e => e.type === 'debug' && !e.stop);
  // A surah finished at the very end: the bench's flush keeps the tracker from before it.
  const finished = events[events.length - 1]?.event === 'completed';
  return (finished ? restarts[restarts.length - 2] : restarts.at(-1)) ?? 0;
}

/** Where the tracker put words, from the end of the take, and when the cursor came in. */
export function placesOf(run) {
  const base = Math.round(endTrackerBase(run) * 25 * 100) / 100;
  const tracked = new Map(
    (run.flush?.words ?? []).map(w => [
      w.id,
      {
        ...w,
        from: w.from === null ? null : w.from + base,
        to: w.to === null ? null : w.to + base,
      },
    ]),
  );
  const cursorIn = new Map();
  for (const e of run.log) {
    if (e.type === 'word_progress' && !e.stop && !cursorIn.has(e.key))
      cursorIn.set(e.key, e.t);
  }
  return {tracked, cursorIn};
}

/** The judge's slice in samples: inside the word's ayah, up to 8 s, as the harness cut it. */
export function judgeSlice({tracked, cursorIn}, id, t, hold, audioLength) {
  const ayahStart = key => {
    const w = tracked.get(`${key}:0`);
    if (w && w.from !== null) return w.from * 0.04 - TRACKER_LAG;
    return cursorIn.has(key) ? cursorIn.get(key) - CURSOR_LAG : null;
  };
  const sliceFrom = (s, a) => {
    const first = ayahStart(`${s}:${a}`);
    const n = engineWords[`${s}:${a - 1}`];
    const prev = n ? tracked.get(`${s}:${a - 1}:${n - 1}`) : null;
    const after =
      prev && prev.to !== null ? prev.to * 0.04 + AFTER_PREVIOUS : null;
    if (first === null) return after;
    return after === null ? first - NO_PREVIOUS : Math.min(after, first - CUT);
  };
  const [s, a] = id.split(':').map(Number);
  let endSec = t + hold;
  const next = ayahStart(`${s}:${a + 1}`);
  if (next !== null && next > 0)
    endSec = Math.min(endSec, Math.max(t, next + TAIL));
  const end = Math.min(audioLength, Math.round(endSec * SR));
  let start = Math.max(0, end - Math.round(D * SR));
  const here = sliceFrom(s, a);
  if (here !== null) start = Math.max(start, Math.round(here * SR));
  if (end - start < MIN_SLICE * SR) start = Math.max(0, end - 3 * SR);
  return {start: Math.max(0, start), end};
}

// ------------------------------------------------------------------------- the audio

function readF32(file) {
  const b = fs.readFileSync(file);
  return new Float32Array(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.length),
  );
}

/** The mix a run heard, from its record: the two steps of mixAtSnr, in memory only. */
export function rebuildMix(reader, track, mix) {
  if (!mix || mix.track === 'none' || !mix.gain) return reader;
  const noise = takeWindow(track, mix.offset, reader.length);
  const out = new Float32Array(reader.length);
  for (let i = 0; i < out.length; i++) out[i] = reader[i] + mix.gain * noise[i];
  if (mix.scale !== 1) for (let i = 0; i < out.length; i++) out[i] *= mix.scale;
  return out;
}

const manifests = new Map();
function clipIn(id) {
  const file = String(id).startsWith('pool')
    ? path.join(MAN, 'pool.json')
    : path.join(MAN, 'w1.json');
  if (!manifests.has(file))
    manifests.set(file, new Map(readJson(file).map(c => [c.id, c])));
  return manifests.get(file).get(id);
}
const tracks = new Map();
function trackFor(mix, id) {
  if (mix.track === 'rec_same') {
    const md5 = crypto.createHash('md5').update(id).digest('hex');
    return readF32(path.join(BENCH, '.out/chatter/tracks/same', `${md5}.f32`));
  }
  if (!tracks.has(mix.track))
    tracks.set(
      mix.track,
      readF32(path.join(BENCH, '.out/chatter/tracks', `${mix.track}.f32`)),
    );
  return tracks.get(mix.track);
}

/** The audio a run heard. Mixed audio exists only in memory. */
export function audioOf(run) {
  const clip = run.clip;
  const source = clip.mix ? clipIn(clip.id) : clip;
  const parts = source.parts ?? [{audio: source.audio}];
  const pieces = parts.map(p => readF32(p.audio));
  const reader = new Float32Array(pieces.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of pieces) {
    reader.set(p, at);
    at += p.length;
  }
  if (!clip.mix || clip.mix.track === 'none' || !clip.mix.gain) return reader;
  return rebuildMix(reader, trackFor(clip.mix, clip.id), clip.mix);
}

// ------------------------------------------------------------------------- the machine

import {execSync} from 'node:child_process';
function limits() {
  const used = Number(
    /used = ([0-9.]+)M/.exec(
      execSync('sysctl -n vm.swapusage').toString(),
    )?.[1] ?? 1e9,
  );
  const free = Number(
    execSync(`df -g ${BENCH}/.out | tail -1`).toString().trim().split(/\s+/)[3],
  );
  return {ok: used < 20000 && free >= 10, used, free};
}
let lastGate = 0;
/** Holds this process while swap is above 20 GB or free disk under 10 GB. */
export async function gate(everyMs = 30000) {
  if (Date.now() - lastGate < everyMs) return;
  let s = limits();
  while (!s.ok) {
    await new Promise(r => setTimeout(r, 60000));
    s = limits();
  }
  lastGate = Date.now();
}
/** Past this, the process exits with 75 and the queue starts it again; finished runs stay. */
export const tooHeavy = () => process.memoryUsage().rss > 1.5e9;
