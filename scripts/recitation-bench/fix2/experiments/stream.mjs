/* eslint-env node, es2020 */
// What E2 and E3 share: a staged Quran.com file as the engine's log-mel frames, a
// speech/quiet threshold on frame energy, the Quran.com timing offset, and a reader of
// any span of frames, as the app would cut it.
import fs from 'node:fs';
import path from 'node:path';
import {
  OUT,
  QDC,
  BINS,
  alignFree,
  argmaxPath,
  ayahGroups,
  editDistance,
  engineFrames,
  greedySpan,
  loadQdc,
  readF32,
  relativeTo,
  tokensOf,
} from '../common.mjs';

/** Files whose Quran.com word ends sit further than this from the checker's are skipped. */
export const MAX_OFFSET = 0.35;
// Window length in seconds.
export const W = 8;

/**
 * The stream of one staged file, or null (with a line on stdout) when its timing offset
 * is too large. `read(m0, m1)` runs the checker on mel frames [m0, m1).
 */
export async function openStream(name, model) {
  const offsets = JSON.parse(
    fs.readFileSync(path.join(OUT, 'qdc_offsets.json'), 'utf8'),
  );
  const off = offsets[name]?.endMed ?? 0;
  if (Math.abs(off) > MAX_OFFSET) {
    console.log(name, 'skipped: timing offset', off);
    return null;
  }
  const base = path.join(QDC, name);
  const said = loadQdc(`${base}.json`);
  const {rows} = await engineFrames(readF32(`${base}.f32`));
  const total = rows.length;
  const energy = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    let s = 0;
    for (let b = 0; b < BINS; b++) {
      s += rows[i][b];
    }
    energy[i] = s / BINS;
  }
  // Quiet: under 30% of the way from the 5th to the 95th percentile of frame energy.
  const sorted = Float32Array.from(energy).sort();
  const lo = sorted[Math.floor(total * 0.05)];
  const hi = sorted[Math.floor(total * 0.95)];
  const quiet = lo + 0.3 * (hi - lo);
  const read = async (m0, m1) => {
    m0 = Math.max(0, Math.round(m0));
    m1 = Math.min(total, Math.round(m1));
    if (m1 - m0 < 40) {
      return null;
    }
    const mel = new Float32Array((m1 - m0) * BINS);
    for (let i = m0; i < m1; i++) {
      mel.set(rows[i], (i - m0) * BINS);
    }
    const r = await model.runFrames(mel, m1 - m0);
    const rel = relativeTo(r.logp, r.frames);
    return {rel, frames: r.frames, am: argmaxPath(rel, r.frames), m0};
  };
  return {said, groups: ayahGroups(said), off, energy, quiet, read};
}

/**
 * The whole ayah read from the quiet before it to the quiet after it; null when it is
 * over 28 s or too short to read. `clean` says whether every word's greedy letters equal
 * its written letters; a clean ayah also has its words' tokens, each word's first letter
 * in stream mel frames, and the mel frame where the ayah's audio ends.
 */
export async function cleanAyah(stream, g) {
  const {said, off, read} = stream;
  const a0 = said[g[0]].start + off;
  const a1 = said[g[g.length - 1]].end + off;
  if (a1 - a0 > 28) {
    return null;
  }
  const R = await read((a0 - 0.25) * 100, (a1 + 0.3) * 100);
  if (!R) {
    return null;
  }
  const ws = g.map(i => tokensOf(said[i].letters));
  const al = alignFree(R.rel, R.frames, ws, {startFree: false, endFree: false});
  const clean = al.every(
    (a, k) =>
      a.start >= 0 &&
      editDistance(greedySpan(R.am, a.start, a.end), ws[k]) === 0,
  );
  if (!clean) {
    return {clean};
  }
  // One checker frame is four mel frames.
  return {
    clean,
    ws,
    startMel: al.map(a => R.m0 + a.start * 4),
    endMel: (a1 + 0.3) * 100,
    a0,
  };
}

/** Quiet mel frames just before `at` (4 frames back), counted back to `floor`. */
export function quietBefore(stream, at, floor) {
  let q = 0;
  for (let f = at - 4; f >= floor && stream.energy[f] < stream.quiet; f--) {
    q++;
  }
  return q;
}
