/* eslint-env node, es2020 */
// Shared reading and scoring helpers for the added-word work.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {DEFAULTS, buildVocab, loadWords, rejectReason, textFeatures} from './rule.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
export const BENCH = path.resolve(HERE, '..');
const {costTable} = await import(pathToFileURL(path.join(BENCH, '.out/added/core/dist/recitation/phonemeCost.js')));
export const table = costTable();
export const {words, index} = loadWords();
export const vocab = buildVocab(words);

export function readPacked(suite) {
  const file = path.join(BENCH, `.out/added/packed/${suite}.jsonl.gz`);
  if (!fs.existsSync(file)) {
    // A suite still running: whatever has finished.
    const dir = path.join(BENCH, `.out/added/runs/${suite}`);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(n => n.endsWith('.json')).map(n => {
      const r = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));
      return {...r, id: r.clip?.id ?? n, truth: r.clip?.truth ?? null, expected: r.clip?.expected ?? null};
    });
  }
  const text = zlib.gunzipSync(fs.readFileSync(file)).toString('utf8');
  return text.split('\n').filter(Boolean).map(l => JSON.parse(l));
}

/** dev or test on both crossed units; `all` keeps everything. */
export function inSplit(truth, split) {
  if (split === 'all') return true;
  const rec = truth.reciterSplit;
  const unit = truth.pairSplit ?? truth.blockSplit;
  return (rec === undefined || rec === split) && (unit === undefined || unit === split);
}

const cache = new Map();
export function features(g, P = DEFAULTS) {
  const key = `${P.realWord}|${g.left}|${g.id}|${g.chars}|${P.back}|${P.ahead}|${P.backShort}|${P.aheadShort}|${P.tolShort}|${P.tolMid}|${P.tolLong}|${P.shortRun}|${P.midRun}|${P.twoPartsFrom}`;
  let tf = cache.get(key);
  if (!tf) {
    tf = textFeatures(g, words, index, table, P, vocab);
    cache.set(key, tf);
  }
  return tf;
}


/**
 * The added-word marks of one run: id -> {left, right, t, chars, mode, rec}.
 * mode 'live' is what the app could show during the take; 'flush' needs the
 * harness's end-of-input flush. Rejected gaps count in `funnel`.
 */
export {DEFAULTS};

export function marksOf(run, P = DEFAULTS, funnel = null) {
  const out = new Map();
  const gaps = run.probe?.gaps ?? [];
  const locks = run.probe?.locks ?? [];
  const byPlace = new Map();
  for (const g of gaps) {
    const tf = features(g, P);
    let why = rejectReason(g, tf, P);
    if (!why && g.mode === 'live' && locks[g.lock] && g.t <= locks[g.lock].t) why = 'lock_chunk';
    if (funnel) funnel[why ?? 'pass'] = (funnel[why ?? 'pass'] ?? 0) + 1;
    if (why) continue;
    const place = `${g.lock}|${g.left}|${g.id}`;
    const list = byPlace.get(place) ?? [];
    list.push(g);
    byPlace.set(place, list);
  }
  for (const list of byPlace.values()) {
    list.sort((a, b) => (a.t === null ? Infinity : a.t) - (b.t === null ? Infinity : b.t));
    const live = list.filter(g => g.mode === 'live');
    const held = live.find(
      g => (g.tLast ?? g.t) - g.t >= P.confirmSec || list.some(h => h !== g && h.t > g.t),
    );
    const first = held ?? null;
    const g = first ?? list[0];
    const mode = first ? 'live' : 'flush';
    const key = `${g.left}|${g.id}`;
    const prior = out.get(key);
    if (!prior || (prior.mode === 'flush' && mode === 'live')) {
      out.set(key, {left: g.left, right: g.id, t: mode === 'live' ? g.t : run.summary?.seconds ?? null, chars: g.chars, mode, rec: g});
    }
  }
  return out;
}


function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Σnum/Σden with a 95% interval resampling two crossed units together. */
export function twoWay(rows, boot = 2000, seed = 12345) {
  const num = rows.reduce((x, r) => x + r.num, 0);
  const den = rows.reduce((x, r) => x + r.den, 0);
  const as = [...new Set(rows.map(r => r.a))];
  const bs = [...new Set(rows.map(r => r.b))];
  const res = {est: den ? num / den : null, lo: null, hi: null, num, den, unitsA: as.length, unitsB: bs.length};
  if (!rows.length || !den || !boot) return res;
  const ia = new Map(as.map((x, i) => [x, i]));
  const ib = new Map(bs.map((x, i) => [x, i]));
  const cells = new Map();
  for (const r of rows) {
    const k = ia.get(r.a) * bs.length + ib.get(r.b);
    const c = cells.get(k) ?? {a: ia.get(r.a), b: ib.get(r.b), num: 0, den: 0};
    c.num += r.num;
    c.den += r.den;
    cells.set(k, c);
  }
  const list = [...cells.values()];
  const rand = mulberry32(seed);
  const stats = [];
  const wa = new Int32Array(as.length);
  const wb = new Int32Array(bs.length);
  for (let i = 0; i < boot; i++) {
    wa.fill(0);
    wb.fill(0);
    for (let j = 0; j < as.length; j++) wa[Math.floor(rand() * as.length)]++;
    for (let j = 0; j < bs.length; j++) wb[Math.floor(rand() * bs.length)]++;
    let n = 0;
    let d = 0;
    for (const c of list) {
      const w = wa[c.a] * wb[c.b];
      if (w) {
        n += w * c.num;
        d += w * c.den;
      }
    }
    if (d > 0) stats.push(n / d);
  }
  stats.sort((x, y) => x - y);
  if (stats.length) {
    res.lo = stats[Math.floor(0.025 * stats.length)];
    res.hi = stats[Math.min(stats.length - 1, Math.floor(0.975 * stats.length))];
  }
  return res;
}
