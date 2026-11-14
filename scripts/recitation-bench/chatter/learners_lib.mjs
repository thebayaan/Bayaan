/* eslint-env node, es2020 */
// Shared parts of the test of real slips under voices (LEARNERS.md): paths, the mix,
// the app's mark rules with what the second look reads from them, and the words and
// labels of a learner segment. No model here.
import crypto from 'node:crypto';
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {mixAtSnr, takeWindow, windowOffset} from './mix.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
export const BENCH = path.resolve(HERE, '..');
export const ROOT = path.resolve(BENCH, '../..');
export const OUT = process.env.LEARNERS_OUT ?? path.join(BENCH, '.out/chatter/learners');
// The engine every condition runs on: a copy, since node_modules may change under a
// long test. Its hash is the engine the clean baseline ran on.
export const PINNED_ENGINE = path.join(BENCH, '.out/chatter/learners/engine/dist');
export const BASELINE_ENGINE_SHA = 'dd826fc14f1b';
export const MANIFEST = path.join(BENCH, '.out/takes/quranmb/manifest.json');
export const CLEAN_MARKS = path.join(BENCH, '.out/real3/marks.jsonl');
export const CLEAN_RUNS = path.join(BENCH, '.out/real3/quranmb');
export const WORD_MARKS_SOURCE = path.join(ROOT, 'services/recitation/wordMarks.ts');
export const WORD_MARKS_FROZEN = path.join(OUT, 'wordMarks.frozen.ts');
export const SR = 16000;
export const CONDS = ['none:0', 'one_ar:10', 'crowd:10', 'rec_one:10', 'one_ar:5', 'crowd:5', 'rec_one:5'];

export const condName = cond => cond.replace(':', '_');
export const runRoot = cond => path.join(OUT, 'runs', condName(cond));
export const runDir = cond => path.join(runRoot(cond), 'quranmb');
export const marksFile = cond => path.join(OUT, `marks.${condName(cond)}.jsonl`);
export const rowsFile = cond => path.join(OUT, `rows.${condName(cond)}.jsonl`);
export const resultName = id => `${String(id).replace(/[^\w.-]/g, '_')}.json`;
export const speakerOf = id => id.split('/')[1].split('_')[0];
export const md5 = s => crypto.createHash('md5').update(s).digest('hex');
export const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

/** Rows of a JSONL file. A torn last line (a killed run) is left out. */
export function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      // a torn last line
    }
  }
  return out;
}

export function readF32(file) {
  return new Float32Array(new Uint8Array(fs.readFileSync(file)).buffer);
}

export function writeF32(file, x) {
  fs.writeFileSync(file, Buffer.from(x.buffer, x.byteOffset, x.byteLength));
}

export const hashF32 = x =>
  crypto.createHash('md5').update(Buffer.from(x.buffer, x.byteOffset, x.byteLength)).digest('hex');

export const sha256File = file =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** One hash over a folder's files, to notice an engine changed during the test. */
export function sha256Dir(dir) {
  const hash = crypto.createHash('sha256');
  const walk = d => {
    for (const name of fs.readdirSync(d).sort()) {
      const file = path.join(d, name);
      if (fs.statSync(file).isDirectory()) walk(file);
      else hash.update(name).update(fs.readFileSync(file));
    }
  };
  walk(dir);
  return hash.digest('hex');
}

// ------------------------------------------------------------ the machine

/** Swap in use and free disk: the limits this test runs under. */
export function machine() {
  const swap = execSync('sysctl -n vm.swapusage').toString();
  const usedMb = Number(/used = ([0-9.]+)M/.exec(swap)?.[1] ?? 1e9);
  const {bavail, bsize} = fs.statfsSync(BENCH);
  return {swapGb: +(usedMb / 1024).toFixed(2), freeGb: +((bavail * bsize) / 1e9).toFixed(1)};
}
export const withinLimits = m => m.swapGb <= 20 && m.freeGb >= 10;

/** Holds this process until the machine is within its limits. */
export async function waitForLimits(say = console.log) {
  let m = machine();
  let waited = 0;
  while (!withinLimits(m)) {
    if (waited % 300 === 0) say(`waiting: swap ${m.swapGb} GB, free disk ${m.freeGb} GB`);
    await new Promise(resolve => setTimeout(resolve, 30000));
    waited += 30;
    m = machine();
  }
  return m;
}

export function appendTiming(entry) {
  fs.mkdirSync(OUT, {recursive: true});
  fs.appendFileSync(path.join(OUT, 'timing.jsonl'), `${JSON.stringify(entry)}\n`);
}

// ------------------------------------------------------------ clips and the mix

/** The chosen clips, whole, in the order of the list. */
export function loadClips() {
  const list = readJson(path.join(OUT, 'clips.json'));
  const byId = new Map(readJson(MANIFEST).map(c => [c.id, c]));
  return list.clips.map(c => ({...byId.get(c.id), stratum: c.stratum, weight: c.weight}));
}

const tracks = new Map();
export function trackOf(name) {
  if (!tracks.has(name)) tracks.set(name, readF32(path.join(BENCH, '.out/chatter/tracks', `${name}.f32`)));
  return tracks.get(name);
}

/**
 * A take with a track behind it, as chatter/run.mjs makes it. Deterministic: the
 * same call gives the same samples whenever it runs.
 * @returns {{audio: Float32Array, window: Float32Array|null, mix: Float32Array,
 *   info: {track: string, snr: number, offset: number, gain: number, scale: number}}}
 */
export function mixOf(audioFile, id, cond) {
  const [track, snrText] = cond.split(':');
  const snr = Number(snrText);
  const audio = readF32(audioFile);
  const noise = track === 'none' ? null : trackOf(track);
  const offset = noise ? windowOffset(id, track, noise.length) : 0;
  const window = noise ? takeWindow(noise, offset, audio.length) : null;
  const {mix, gain, scale} = mixAtSnr(audio, window, snr);
  return {audio, window, mix, info: {track, snr, offset, gain, scale}};
}

// ------------------------------------------------------------ the app's mark rules

const require = createRequire(import.meta.url);

/** Keeps one copy of the mark rules for the whole test. */
export function freezeWordMarks() {
  fs.mkdirSync(OUT, {recursive: true});
  if (!fs.existsSync(WORD_MARKS_FROZEN)) fs.copyFileSync(WORD_MARKS_SOURCE, WORD_MARKS_FROZEN);
  return sha256File(WORD_MARKS_FROZEN);
}

export async function loadWordMarks() {
  const ts = require(path.join(ROOT, 'node_modules/typescript'));
  const compiled = path.join(OUT, `wordMarks.frozen.${process.pid}.mjs`);
  fs.writeFileSync(
    compiled,
    ts.transpileModule(fs.readFileSync(WORD_MARKS_FROZEN, 'utf8'), {
      compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020},
    }).outputText,
  );
  const marks = await import(compiled);
  fs.unlinkSync(compiled);
  return marks;
}

const UNLOCK = new Set(['lost', 'idle', 'locateFailed', 'completed']);
const LOCK = new Set(['located', 'relocated']);

/**
 * replay2.mjs's replayRun, which score_real.mjs labels with, keeping also what the
 * second look reads from a mark when it falls due: its kind and its latest bad
 * verdict. learners_rules.mjs checks that it gives the marks score_real.mjs gives.
 * @returns {Map<string, {since: number, shownAt: number, kind: string, lastBad: number}>}
 */
export function replayDetail(run, marks) {
  const spans = [];
  let start = null;
  for (const e of run.log) {
    if (e.type === 'word_progress' && start === null) start = e.t;
    else if (e.type === 'debug' && UNLOCK.has(e.event) && start !== null) {
      spans.push([start, e.t]);
      start = null;
    }
  }
  if (start !== null) spans.push([start, Infinity]);
  const locked = t => spans.some(([a, b]) => a <= t && t < b);
  const unlockTimes = run.log.filter(e => e.type === 'debug' && UNLOCK.has(e.event)).map(e => e.t);
  const totals = new Map();
  for (const c of run.vchanges) {
    const [s, a, w] = c.id.split(':').map(Number);
    totals.set(`${s}:${a}`, Math.max(totals.get(`${s}:${a}`) ?? 0, w + 1));
  }
  const lockAt = new Map();
  for (const e of run.log) {
    if (e.type === 'debug' && LOCK.has(e.event) && e.at) {
      const [surah, ayah, word] = e.at.split(':').map(Number);
      lockAt.set(e.t, {surah, ayah, word});
    }
  }
  const byTime = new Map();
  for (const c of run.vchanges) {
    if (c.stop || !locked(c.t)) continue;
    const [surah, ayah, word] = c.id.split(':').map(Number);
    const list = byTime.get(c.t) ?? [];
    list.push({surah, ayah, word, totalWords: totals.get(`${surah}:${ayah}`), state: c.to, ...(c.d ? {detail: c.d} : {})});
    byTime.set(c.t, list);
  }
  let book = marks.emptyMarkBook();
  const shown = new Map();
  const note = (update, atMs) => {
    book = update.book;
    for (const m of update.confirmed) {
      const id = `${m.surah}:${m.ayah}:${m.word}`;
      if (!shown.has(id)) {
        shown.set(id, {since: m.since / 1000, shownAt: atMs / 1000, kind: m.kind, lastBad: m.lastBadAt / 1000});
      }
    }
  };
  const times = [...new Set([...byTime.keys(), ...unlockTimes])].sort((x, y) => x - y);
  const unlockAt = new Set(unlockTimes);
  for (const t of times) {
    const ms = t * 1000;
    for (let due = marks.nextConfirmAt(book); due !== null && due <= ms; due = marks.nextConfirmAt(book)) {
      note(marks.confirmDue(book, due), due);
    }
    if (unlockAt.has(t) && marks.dropSuspects) book = marks.dropSuspects(book);
    if (byTime.has(t)) {
      let batch = byTime.get(t);
      if (marks.dropLockArtifacts) batch = marks.dropLockArtifacts(batch, lockAt.get(t) ?? null);
      if (marks.dropRealignment) batch = marks.dropRealignment(batch);
      note(marks.applyVerdicts(book, batch, ms), ms);
    }
  }
  for (let due = marks.nextConfirmAt(book); due !== null; due = marks.nextConfirmAt(book)) {
    note(marks.confirmDue(book, due), due);
  }
  const skipped = new Set(run.flags.filter(f => f.kind === 'possible_skipped_ayah').map(f => f.key));
  const visible = new Map();
  for (const [id, info] of shown) {
    const [s, a, w] = id.split(':').map(Number);
    if (skipped.has(`${s}:${a}`) || (w < 3 && skipped.has(`${s}:${a - 1}`))) continue;
    visible.set(id, info);
  }
  return visible;
}

// ------------------------------------------------------------ words and labels

// score_real.mjs's word numbers and error words, with the same arithmetic, so a
// word here is the word its labels mean.
const corpus = readJson(path.join(BENCH, '.out/assets/zipformer_quran.json'));
const engineWords = new Map();
for (const s of corpus.surahs) for (const a of s.ayahs) engineWords.set(`${s.n}:${a.n}`, a.w.length);
const wordmap = readJson(path.join(BENCH, '.out/takes/wordmap.json'));
const splitAyat = wordmap.engineToManifest ?? {};

function manifestWords(s, a) {
  const m = splitAyat[`${s}:${a}`];
  return m ? m[m.length - 1] : engineWords.get(`${s}:${a}`) ?? 0;
}
const cmp = (a1, w1, a2, w2) => (a1 !== a2 ? a1 - a2 : w1 - w2);

function span(seg) {
  if (seg.extendsTo && seg.extendsTo > seg.ayahEnd) {
    return {surah: seg.surah, a0: seg.ayahStart, w0: seg.wordStart, a1: seg.extendsTo, w1: manifestWords(seg.surah, seg.extendsTo)};
  }
  return {surah: seg.surah, a0: seg.ayahStart, w0: seg.wordStart, a1: seg.ayahEnd, w1: seg.wordEnd};
}

/** The engine's word ids that make up a manifest word. */
export function engineIds(s, a, mw) {
  const m = splitAyat[`${s}:${a}`];
  if (!m) return [`${s}:${a}:${mw - 1}`];
  return m.flatMap((x, i) => (x === mw ? [`${s}:${a}:${i}`] : []));
}

/** Words of a segment in reading order, as [ayah, manifest word]. */
export function segmentWords(seg) {
  const sp = span(seg);
  const out = [];
  for (let a = sp.a0; a <= sp.a1; a++) {
    const n = manifestWords(sp.surah, a);
    const from = a === sp.a0 ? sp.w0 : 1;
    const to = a === sp.a1 ? Math.min(sp.w1, n) : n;
    for (let w = from; w <= to; w++) out.push([a, w]);
  }
  return out;
}

/** Labelled error words of a segment, as a set of 'a:mw'. */
export function segmentErrors(seg) {
  const out = new Set();
  const sp = span(seg);
  const add = word => {
    if (!word) return;
    let [s, a, w] = String(word).split(':').map(Number);
    if (s !== seg.surah) return;
    if (cmp(a, w, sp.a0, sp.w0) < 0) [a, w] = [sp.a0, sp.w0];
    if (cmp(a, w, seg.ayahEnd, seg.wordEnd) > 0) [a, w] = [seg.ayahEnd, seg.wordEnd];
    out.add(`${a}:${w}`);
  };
  for (const e of seg.errorWords ?? []) add(e.word);
  for (const e of seg.phonemeEdits ?? []) add(e.word);
  return out;
}

/** The learner segment of a QuranMB take (each has exactly one). */
export const learnerSegment = clip => clip.segments.find(g => !g.lead);

/** Numbers that say how likely a word of this segment is to carry a label. */
export function segmentOdds(seg) {
  const words = segmentWords(seg);
  const errors = segmentErrors(seg);
  const keys = words.map(([a, w]) => `${a}:${w}`);
  const neighbour = new Set();
  keys.forEach((k, i) => {
    if (errors.has(k)) return;
    if ((i > 0 && errors.has(keys[i - 1])) || (i + 1 < keys.length && errors.has(keys[i + 1]))) neighbour.add(k);
  });
  return {keys, errors, neighbour};
}

// ------------------------------------------------------------ statistics

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * P(a hit scores lower than a false mark) + ties / 2. `items` are in ascending score,
 * each {s, pos, r}; `weightOf(r)` says how often a row counts in this draw.
 */
export function aucOfSorted(items, weightOf) {
  let negTotal = 0;
  let posTotal = 0;
  for (const it of items) {
    if (it.pos) posTotal += weightOf(it.r);
    else negTotal += weightOf(it.r);
  }
  if (!posTotal || !negTotal) return NaN;
  let negAbove = negTotal;
  let wins = 0;
  for (let i = 0; i < items.length; ) {
    let p = 0;
    let n = 0;
    let j = i;
    for (; j < items.length && items[j].s === items[i].s; j++) {
      if (items[j].pos) p += weightOf(items[j].r);
      else n += weightOf(items[j].r);
    }
    negAbove -= n;
    wins += p * (negAbove + n / 2);
    i = j;
  }
  return wins / (posTotal * negTotal);
}

export const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
