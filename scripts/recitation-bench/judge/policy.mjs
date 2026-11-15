/* eslint-env es2020 */
// How the second judge's answer changes a saved run's verdicts, so the app's own
// mark rules can replay it (with wordMarks.judge.ts). Nothing else in a run moves.
//
// Constants come from two places, kept apart because of NPL-1.2:
//   judge side (P.mut, P.near, P.fit): set on quran-asr-small and official text
//     only, in text_harness.mjs. These can sit with the app's own code.
//   engine side (P.okGop, P.lastDistance, P.firstDistance, ...): which of the
//     engine's verdicts wake the judge. Tuned on the engine's output, so they
//     belong in the NPL constants file with the model.

export const DEFAULTS = {
  // Judge side.
  mut: 4, // a mutashabih alternative must beat the expected word by this (nats)
  near: 10, // a near word must beat it by this
  altFit: 1, // and the alternative must itself score at least -altFit
  fit: 2, // the expected word 'fits' when its score is at least -fit
  absent: 99, // 'no word here' must beat the expected word by this
  // What wakes the judge, engine side.
  wakeUnsure: true,
  wakeOkGop: -3, // an ok word with gop at or below this; null turns it off
  wakeOkNoGop: true, // an ok first or last word heard with some distance
  edgeUnsureDistance: 0, // on first and last words, unsure needs this distance
  // What the answer may do.
  vetoWrong: false, // a wrong word the judge says fits is not a slip
  requireConfirm: false, // a wrong word needs the judge's agreement
  vetoSkipped: false, // a skipped word the judge says fits was said
  passLock: true, // a confirmed word counts in the lock chunk too
};

export function margins(row) {
  const r = row.r;
  const mut = r.mut.length ? r.mut[0].s - r.expected : -Infinity;
  const near = r.near.length ? r.near[0].s - r.expected : -Infinity;
  return {mut, near};
}

/**
 * What the judge says: 'wrong' (another word was said), 'absent' (no word was said
 * here), 'fits' or 'neither'.
 */
export function answer(row, P) {
  const {mut, near} = margins(row);
  const fitsItself = list => list.length > 0 && list[0].s >= -P.altFit;
  if ((mut >= P.mut && fitsItself(row.r.mut)) || (near >= P.near && fitsItself(row.r.near))) return 'wrong';
  if (row.r.nothing - row.r.expected >= P.absent && row.r.nothing >= -P.altFit) return 'absent';
  if (row.r.expected >= -P.fit) return 'fits';
  return 'neither';
}

function edgeOf(id, wordCount) {
  const [s, a, w] = id.split(':').map(Number);
  const n = wordCount(s, a);
  return w === 0 ? 'first' : w === n - 1 ? 'last' : 'interior';
}

/** Does this verdict wake the judge under these constants? */
export function woken(state, d, place, P) {
  if (state === 'wrong' || state === 'skipped') return true;
  if (state === 'unsure') {
    if (!P.wakeUnsure) return false;
    if (place === 'interior') return true;
    return (d?.distance ?? 0) >= P.edgeUnsureDistance;
  }
  if (state === 'ok') {
    const gop = d?.gop;
    if (typeof gop === 'number') return P.wakeOkGop !== null && gop <= P.wakeOkGop;
    return P.wakeOkNoGop && (d?.distance ?? 0) > 0;
  }
  return false;
}

/** The verdict after the judge: {state, judged, passLock} or null to leave it. */
export function judged(state, d, place, row, P) {
  if (!row || !woken(state, d, place, P)) return null;
  const say = answer(row, P);
  // Another word stands here, whatever the engine called it.
  if (say === 'wrong') return {state: 'wrong', judged: true, passLock: P.passLock};
  if (say === 'absent' && (state === 'wrong' || state === 'skipped')) {
    return {state: 'skipped', judged: true, passLock: P.passLock};
  }
  if (state === 'wrong' && place === 'interior' && (P.requireConfirm || (P.vetoWrong && say === 'fits'))) {
    return {state: 'unsure'};
  }
  if (state === 'skipped' && P.vetoSkipped && say === 'fits') return {state: 'unsure'};
  return null;
}

/**
 * @param {object} run a saved bench run
 * @param {Map<string, object>} rows judge rows of this run by `${id}|${t}|${src}`
 * @param {object} P constants
 * @param {(s: number, a: number) => number} wordCount
 * @returns {{run: object, runs: number, changed: object[]}} the run with rewritten
 *   verdicts, how many slices the judge ran, and what it changed
 */
export function applyPolicy(run, rows, P, wordCount) {
  let woke = 0;
  const changed = [];
  const asked = new Set();
  const vchanges = run.vchanges.map(c => {
    if (c.stop || c.to === 'pending') return c;
    const row = rows.get(`${c.id}|${c.t}|live`);
    const place = edgeOf(c.id, wordCount);
    if (woken(c.to, c.d, place, P) && row) {
      const key = `${c.id}|${c.t}`;
      if (!asked.has(key)) {
        asked.add(key);
        woke += 1;
      }
    }
    const verdict = judged(c.to, c.d, place, row, P);
    if (!verdict) return c;
    changed.push({id: c.id, t: c.t, from: c.to, to: verdict.state, src: 'live'});
    return {
      ...c,
      to: verdict.state,
      judge: true,
      d: {...(c.d ?? {}), judged: !!verdict.judged, passLock: !!verdict.passLock},
    };
  });
  let flush = run.flush;
  if (flush?.verdicts?.length) {
    const seconds = run.summary.seconds;
    flush = {
      ...flush,
      verdicts: flush.verdicts.map(v => {
        if (!v.newly) return v;
        const row = rows.get(`${v.id}|${seconds}|flush`);
        const place = edgeOf(v.id, wordCount);
        if (woken(v.state, v.d, place, P) && row) woke += 1;
        const verdict = judged(v.state, v.d, place, row, P);
        if (!verdict) return v;
        changed.push({id: v.id, t: seconds, from: v.state, to: verdict.state, src: 'flush'});
        return {
          ...v,
          state: verdict.state,
          judge: true,
          d: {...(v.d ?? {}), judged: !!verdict.judged, passLock: !!verdict.passLock},
        };
      }),
    };
  }
  return {run: {...run, vchanges, flush}, woke, changed};
}
