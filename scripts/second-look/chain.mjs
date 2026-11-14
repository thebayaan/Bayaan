/* eslint-env node, es2020 */
// The corrected chain before the cancel step: the junction's 'said' limited to skipped
// verdicts, junction marks past the judge, filters before the judge, and the judge's answer
// credited to its verdict's time, as the verifier's corrected rule does.
import {
  applyPolicy,
  woken,
  DEFAULTS,
} from '../recitation-bench/judge/policy.mjs';
import {marks} from './replay_marks.mjs';

const judgeSide = {
  mut: 3,
  altFit: 1,
  near: 99,
  fit: 2,
  absent: 10,
  vetoWrong: true,
  vetoSkipped: true,
  passLock: false,
};
export const POLICIES = {
  S1: {
    ...DEFAULTS,
    ...judgeSide,
    wakeOkGop: null,
    wakeOkNoGop: false,
    wakeUnsure: false,
  },
  S2: {
    ...DEFAULTS,
    ...judgeSide,
    wakeOkGop: -1.5,
    wakeOkNoGop: true,
    wakeUnsure: true,
  },
};
// The same with no veto, for comparison only: an answer of 'fits' changes nothing.
POLICIES.N1 = {...POLICIES.S1, vetoWrong: false, vetoSkipped: false};
POLICIES.N2 = {...POLICIES.S2, vetoWrong: false, vetoSkipped: false};

const UNLOCK = new Set(['lost', 'idle', 'locateFailed', 'completed']);
const LOCK = new Set(['located', 'relocated']);
const fire = c => c.d?.junctionMissing === true;
const said = c => c.d?.junctionMissing === false;

/** The junction's 'said' acts only on a skipped verdict and is not a new verdict. */
export function quiet(run) {
  const vchanges = run.vchanges
    .filter(c => !(said(c) && c.from === c.to && c.to !== 'skipped' && !c.stop))
    .map(c =>
      said(c) && c.to !== 'skipped'
        ? {...c, d: {...c.d, junctionMissing: undefined}}
        : c,
    );
  return {...run, vchanges};
}

/**
 * The live verdicts that may wake the judge, as `${id}|${t}`: heard while locked, not in
 * the chunk where the engine found the reader, not in a chunk the realignment rule drops,
 * and not a junction mark.
 */
export function keptWakes(run) {
  const log = run.log.filter(e => !e.stop);
  const spans = [];
  let start = null;
  for (const e of log) {
    if (e.type === 'word_progress' && start === null) start = e.t;
    else if (e.type === 'debug' && UNLOCK.has(e.event) && start !== null) {
      spans.push([start, e.t]);
      start = null;
    }
  }
  if (start !== null) spans.push([start, Infinity]);
  const locked = t => spans.some(([a, b]) => a <= t && t < b);
  const lockChunks = new Set(
    log
      .filter(e => e.type === 'debug' && LOCK.has(e.event) && e.at)
      .map(e => e.t),
  );
  const byTime = new Map();
  for (const c of run.vchanges) {
    if (c.stop || c.to === 'pending' || !locked(c.t)) continue;
    const list = byTime.get(c.t) ?? [];
    list.push(c);
    byTime.set(c.t, list);
  }
  const out = new Set();
  for (const [t, list] of byTime) {
    if (lockChunks.has(t)) continue;
    const ayat = new Set(list.map(c => c.id.split(':').slice(0, 2).join(':')));
    if (list.length >= marks.REALIGN_WORDS && ayat.size >= marks.REALIGN_AYAT)
      continue;
    for (const c of list) if (!fire(c)) out.add(`${c.id}|${c.t}`);
  }
  return out;
}

/**
 * The run with the judge's answers applied.
 * @param {Map<string, object>} rows the judge's rows by `${id}|${t}|${src}`
 * @param {'S1'|'S2'|'N1'|'N2'} step
 * @returns {{run: object, woke: number, changed: object[]}}
 */
export function correctedRun(run, rows, step, wordCount) {
  const q = quiet(run);
  const kept = keptWakes(q);
  const shown = new Map();
  for (const [k, r] of rows) {
    if (r.src !== 'live' || kept.has(`${r.id}|${r.t}`)) shown.set(k, r);
  }
  return applyPolicy(q, shown, POLICIES[step], wordCount);
}

/** How many live verdicts wake the judge, and how many distinct slices they need. */
export function liveWakes(run, rows, step, wordCount) {
  const q = quiet(run);
  const kept = keptWakes(q);
  const asked = new Set();
  const slices = new Set();
  for (const c of q.vchanges) {
    if (c.stop || !kept.has(`${c.id}|${c.t}`)) continue;
    const row = rows.get(`${c.id}|${c.t}|live`);
    if (!row) continue;
    const [s, a, w] = c.id.split(':').map(Number);
    const n = wordCount(s, a);
    const place = w === 0 ? 'first' : w === n - 1 ? 'last' : 'interior';
    if (!woken(c.to, c.d, place, POLICIES[step])) continue;
    asked.add(`${c.id}|${c.t}`);
    slices.add(row.slice.join());
  }
  return {wakes: asked.size, slices: slices.size};
}

/** A junction mark: exempt from the judge's veto and from the cancel step. */
export function junctionMark(run, id, due) {
  return run.vchanges.some(
    c => c.id === id && !c.stop && fire(c) && c.t <= due + 1e-6,
  );
}

/** Did the judge answer wrong or absent on this word from `since` until it fell due? */
export function identified(run, id, since, due) {
  const on = c => c.judge && c.d?.judged;
  const inSuspect = t => t >= since - 1e-6 && t <= due + 1e-6;
  if (run.vchanges.some(c => c.id === id && !c.stop && on(c) && inSuspect(c.t)))
    return true;
  return (run.flush?.verdicts ?? []).some(
    v => v.id === id && on(v) && inSuspect(run.summary.seconds),
  );
}
