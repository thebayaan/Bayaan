/* eslint-env node, es2020 */
// The junction test, on a take's CTC log-probabilities (probe.mjs dumps them, or
// the live FramePosteriors): does the audio over the join read better as
// 'word before + last word + next opening' or as 'word before + next opening'?
// Uses the engine's own forced alignment and tokenizer. Hypotheses exist only
// inside this computation; nothing here is shown or stored as text.
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
export const BENCH = path.resolve(HERE, '../..');
export const ROOT = path.resolve(BENCH, '../..');
const DIST = process.env.TILAWA_DIST ?? path.join(ROOT, 'node_modules/@tilawa/core/dist');
const posteriors = await import(path.join(DIST, 'recitation/posteriors.js'));
const verdicts = await import(path.join(DIST, 'recitation/verdicts.js'));
const corpusMod = await import(path.join(DIST, 'recitation/corpus.js'));
export const {encodePhonemes, forcedLogLik, freeLogLik} = posteriors;
export const {pausalPhonemes} = verdicts;
// The check itself, from the patched copy (make_dist.mjs).
const check = await import(path.join(BENCH, '.out/natural/junction/dist/recitation/junction.js'));
export const {
  ANCHOR_TOKENS,
  LOOK_BACK_FRAMES,
  WAIT_FRAMES,
  encode,
  shortMadd,
  forcedFreeTail,
  forcedLocal,
  junctionFree,
  beforeForms,
  junctionTest,
  sameOpening,
} = check;

const {costTable} = await import(path.join(DIST, 'recitation/phonemeCost.js'));
const {weightedLevenshtein} = await import(path.join(DIST, 'recitation/alignment.js'));
const table = costTable();
/** The engine's weighted edit distance between two phoneme strings. */
export const editDistance = (a, b) =>
  weightedLevenshtein(table.encode(a), table.encode(b), table);

const CLASSES = 251;

export function loadCorpus() {
  const raw = JSON.parse(
    fs.readFileSync(path.join(BENCH, '.out/assets/zipformer_quran.json'), 'utf8'),
  );
  return new corpusMod.QuranCorpus(raw);
}

/** FramePosteriors over a probe dump, in one epoch's decoder frames. */
export class DumpPosteriors {
  constructor(buf, epochs, epoch = 0) {
    this.buf = buf;
    this.rows = buf.length / CLASSES;
    this.epochs = epochs;
    this.setEpoch(epoch);
  }

  setEpoch(epoch) {
    const e = this.epochs[epoch];
    this.base = e.row - e.firstFrame;
    this.lastRow = epoch + 1 < this.epochs.length ? this.epochs[epoch + 1].row : this.rows;
    this.firstRow = e.row;
  }

  get firstFrame() {
    return this.firstRow - this.base;
  }

  has(from, to) {
    return from + this.base >= this.firstRow && to + this.base <= this.lastRow && from <= to;
  }

  logp(frame, id) {
    return -this.buf[(frame + this.base) * CLASSES + id] / 10;
  }

  bestLogp(frame) {
    const row = (frame + this.base) * CLASSES;
    let b = 255;
    for (let k = 0; k < CLASSES; k++) if (this.buf[row + k] < b) b = this.buf[row + k];
    return -b / 10;
  }

  argmax(frame) {
    const row = (frame + this.base) * CLASSES;
    let b = 255;
    let arg = 0;
    for (let k = 0; k < CLASSES; k++) {
      if (this.buf[row + k] < b) {
        b = this.buf[row + k];
        arg = k;
      }
    }
    return arg;
  }
}

function bestOver(post, list, from, to) {
  let best = -Infinity;
  for (const ids of list) {
    if (!ids) continue;
    const ll = forcedLogLik(post, ids, from, to);
    if (ll > best) best = ll;
  }
  return best;
}

/**
 * Log-likelihood over frames [from, to) with the last word and without it, for
 * every reading of the word before it and of the last word. Word boundaries are
 * tokenized both jointly and apart: a token can straddle a join when the reader
 * runs on, and cannot when he stops.
 * @param {string[]} before phoneme strings of the words before the last word's
 *   place, oldest first; the final one may have a pausal reading
 * @param {string[]} lastForms readings of the last word
 * @param {string} after phoneme string of the next words
 */
export function junctionScores(post, before, lastForms, after, from, to) {
  const withLast = [];
  const without = [];
  for (const b of before) {
    const encB = encode(b);
    const encA = encode(after);
    if (!encB || !encA) continue;
    without.push(encode(b + after), [...encB, ...encA]);
    for (const l of lastForms) {
      const encBL = encode(b + l);
      if (!encBL) continue;
      withLast.push(encode(b + l + after), [...encBL, ...encA]);
    }
  }
  const ll1 = bestOver(post, withLast, from, to);
  const ll0 = bestOver(post, without, from, to);
  return {ll1, ll0};
}
