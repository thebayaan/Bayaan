/* eslint-env node, es2020 */
// Stands in for the patched engine on runs of the plain engine with the probe: when
// the check would decide on each join, and what, from the dumped posteriors, chunk by
// chunk as JunctionCheck does. verify_inline.mjs compares this with the patched engine
// itself. The probe records only joins the tracker crossed; at a natural site, where the
// text and the audio part after the next word's first sounds, the tracker may not
// cross, and `decideUncrossed` covers the site's own last word from the lock's time.
import fs from 'node:fs';
import path from 'node:path';
import {DumpPosteriors, WAIT_FRAMES, junctionTest, sameOpening} from './llr.mjs';

const CHUNK = 0.48;

/** The check on one join: {t, state, llr, missing}, or null when it never decides. */
export function decide(run, j, post, corpus, {llrMissing, fitNext, fitLate = -Infinity}, tested) {
  const m0 = j.snaps.find(x => x.m === 0);
  if (!m0) return null;
  const words = new Map(m0.words.map(w => [w.g, w]));
  let g0 = j.L - 1;
  while (g0 >= j.L - 3 && words.get(g0)?.from === undefined) g0--;
  const before = words.get(g0);
  if (before?.from === undefined) {
    if (tested) tested.noWindow += 1;
    return null;
  }
  post.setEpoch(m0.epoch);
  const from = Math.max(0, before.ff - 1);
  const m1 = j.snaps.find(x => x.m >= 1);
  const trail = run.vchanges.filter(c => c.id === j.id && !c.stop);
  const stateAt = t => trail.filter(c => c.t <= t + 1e-6).at(-1)?.to ?? null;
  // From when the cursor reached the word before: its last verdict change before
  // the crossing, within reach of a normal word.
  const beforeId = `${corpus.wordSurah[g0]}:${corpus.wordAyah[g0]}:${corpus.wordInAyah[g0]}`;
  const beforeTrail = run.vchanges.filter(c => c.id === beforeId && !c.stop && c.t <= m0.t && c.t >= m0.t - 6);
  const startT = beforeTrail.length ? beforeTrail[0].t : m0.t;
  const lastT = run.summary?.seconds ?? Infinity;
  const dueT = m1 && m1.t <= m0.t ? m0.t : m0.t + CHUNK;
  for (let k = Math.round((startT - m0.t) / CHUNK); ; k++) {
    const t = +(m0.t + k * CHUNK).toFixed(2);
    if (t > lastT + 0.01) return null;
    const to = Math.min(m0.frames + k * WAIT_FRAMES, post.lastRow - post.base);
    if (to <= from) continue;
    const state = stateAt(t);
    const settled = state !== null && state !== 'pending';
    const due = t >= dueT - 1e-6;
    if (due && state === 'ok') return null;
    if (!post.has(from, to)) {
      if (due && settled) return null;
      continue;
    }
    const final = due && settled;
    if (!final && sameOpening(corpus, j.L)) continue;
    const got = junctionTest(corpus, post, g0, j.L, from, to, final ? null : s0 => s0 >= fitNext);
    if (tested) tested.tests += 1;
    if (got.llr !== null) {
      if (tested) tested.full = (tested.full ?? 0) + 1;
      const missing = got.llr < llrMissing && (!final || got.s0 >= fitLate);
      if (missing || final) return {t, state, llr: got.llr, s0: got.s0, missing, early: !final, row: trail.filter(c => c.t <= t + 1e-6).at(-1) ?? null};
    }
    if (final) return null;
  }
}

/**
 * The early path alone on a site's last word when the tracker never crossed it: from
 * the first verdict on the word before, until the take ends. The word before starts
 * at the lock, which QUA's times placed; a decoder frame is 40 ms, one chunk behind.
 */
export function decideUncrossed(run, post, corpus, {llrMissing, fitNext}, tested) {
  if (run.clip.trackAt && sameOpening(corpus, corpus.ayahFirstWord(run.clip.trackAt.surah, run.clip.trackAt.ayah) + run.clip.truth.target)) return null;
  const at = run.clip.trackAt;
  const t = run.clip.truth;
  if (!at) return null;
  const L = corpus.ayahFirstWord(at.surah, at.ayah) + t.target;
  const g0 = L - 1;
  const id = `${at.surah}:${at.ayah}:${t.target}`;
  const beforeId = `${at.surah}:${at.ayah}:${t.target - 1}`;
  const firstSeen = run.vchanges.find(c => c.id === beforeId && !c.stop);
  if (!firstSeen) return null;
  post.setEpoch(0);
  const from = Math.max(0, Math.round(at.t * 25) - 1);
  const end = run.summary?.seconds ?? 0;
  for (let time = firstSeen.t; time <= end + 0.01; time = +(time + CHUNK).toFixed(2)) {
    const to = Math.min(Math.round(time / CHUNK) * WAIT_FRAMES - WAIT_FRAMES, post.lastRow - post.base);
    if (to <= from || !post.has(from, to)) continue;
    const got = junctionTest(corpus, post, g0, L, from, to, s0 => s0 >= fitNext);
    if (tested) tested.tests += 1;
    if (got.llr !== null && got.llr < llrMissing) {
      return {t: time, id, L, state: null, llr: got.llr, missing: true, early: true, row: null};
    }
  }
  return null;
}

/** Adds the check's results to a probe run, as the patched engine would. */
export function withCheck(run, postDir, constants, corpus, tested = {tests: 0, missing: 0, joins: 0, noWindow: 0, early: 0, decided: 0}) {
  const pr = run.probe;
  if (!pr?.post) return run;
  const file = path.join(postDir, pr.post);
  if (!fs.existsSync(file)) throw new Error(`no posteriors: ${file}`);
  const post = new DumpPosteriors(fs.readFileSync(file), pr.epochs);
  const order = id => {
    const [a, b, c] = id.split(':').map(Number);
    return corpus.ayahFirstWord(a, b) + c;
  };
  let merged = run.vchanges;
  for (const j of pr.joins) {
    tested.joins += 1;
    const got = decide(run, j, post, corpus, constants, tested);
    if (!got) continue;
    tested.decided += 1;
    if (got.missing) tested.missing += 1;
    if (got.early) tested.early += 1;
    const d = got.row?.d ?? {};
    const entry = {
      t: got.t,
      id: j.id,
      from: got.state,
      to: got.missing ? 'skipped' : (got.state ?? 'unsure'),
      d: {...d, junction: +got.llr.toFixed(3), junctionMissing: got.missing},
    };
    // A word found unsaid stays so until it is heard 'ok'.
    merged = merged.filter(c => {
      if (c.id !== j.id || c.stop || c.t <= got.t + 1e-6 || !got.missing) return true;
      return c.to === 'ok';
    });
    let i = merged.findIndex(c => !c.stop && (c.t > got.t || (c.t === got.t && order(c.id) > j.L)));
    if (i < 0) i = merged.findIndex(c => c.stop);
    if (i < 0) i = merged.length;
    merged = [...merged.slice(0, i), entry, ...merged.slice(i)];
  }
  // A site's own last word, when the tracker never crossed it.
  const truth = run.clip.truth;
  if (run.clip.trackAt && truth.type === 'junction' && !pr.joins.some(j => j.id === `${truth.expectedKey}:${truth.target}`)) {
    const got = decideUncrossed(run, post, corpus, constants, tested);
    if (got) {
      tested.decided += 1;
      tested.missing += 1;
      tested.early += 1;
      tested.uncrossed = (tested.uncrossed ?? 0) + 1;
      const entry = {t: got.t, id: got.id, from: null, to: 'skipped', d: {junction: +got.llr.toFixed(3), junctionMissing: true}};
      merged = merged.filter(c => c.id !== got.id || c.stop || c.t <= got.t + 1e-6 || c.to === 'ok');
      let i = merged.findIndex(c => !c.stop && (c.t > got.t || (c.t === got.t && order(c.id) > got.L)));
      if (i < 0) i = merged.findIndex(c => c.stop);
      if (i < 0) i = merged.length;
      merged = [...merged.slice(0, i), entry, ...merged.slice(i)];
    }
  }
  return merged === run.vchanges ? run : {...run, vchanges: merged};
}

const VOWELISH = new Set(['\u064e', '\u064f', '\u0650', 'ا', 'ۥ', 'ۦ', 'ـ', 'ؙ', 'ۜ', '۪']);
const consonants = ph => [...ph].filter(c => !VOWELISH.has(c));

/** Share of the word's distinct consonants among the sounds heard on it. */
export function consonantsHeard(expected, heard) {
  const want = [...new Set(consonants(expected))];
  const got = new Set(consonants(heard));
  return want.length ? want.filter(c => got.has(c)).length / want.length : 0;
}

/**
 * Simpler alternatives, on the same path into the marks: when the cursor has passed
 * the next ayah's first word and the last word's verdict is settled and not 'ok',
 * `rule(row, expected)` on what the tracker heard on it decides, with no posteriors.
 */
export function withSimpleRule(run, rule, corpus) {
  const pr = run.probe;
  if (!pr) return run;
  const order = id => {
    const [a, b, c] = id.split(':').map(Number);
    return corpus.ayahFirstWord(a, b) + c;
  };
  let merged = run.vchanges;
  for (const j of pr.joins) {
    const snap = j.snaps.find(x => x.m >= 1 && x.words.find(w => w.g === j.L)?.state && x.words.find(w => w.g === j.L).state !== 'pending');
    if (!snap) continue;
    const row = snap.words.find(w => w.g === j.L);
    if (row.state === 'ok') continue;
    const missing = rule(row, corpus.wordPhonemes(j.L));
    const entry = {
      t: snap.t,
      id: j.id,
      from: row.state,
      to: missing ? 'skipped' : row.state,
      d: {junctionMissing: missing, heardRatio: row.heardRatio, distance: row.distance, gop: row.gop},
    };
    merged = merged.filter(c => c.id !== j.id || c.stop || c.t <= snap.t + 1e-6 || !missing || c.to === 'ok');
    let i = merged.findIndex(c => !c.stop && (c.t > snap.t || (c.t === snap.t && order(c.id) > j.L)));
    if (i < 0) i = merged.findIndex(c => c.stop);
    if (i < 0) i = merged.length;
    merged = [...merged.slice(0, i), entry, ...merged.slice(i)];
  }
  return merged === run.vchanges ? run : {...run, vchanges: merged};
}
