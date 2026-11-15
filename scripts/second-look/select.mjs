/* eslint-env node, es2020 */
// The selection rule, as fixed in the task before any result was read. A candidate stands if
// it is no worse than the best candidate by more than: 3 of the 66 real slips kept, 2 pool-dev
// false marks, 1 point of W1 catches at any place, or 10% of the false marks in any voices
// condition at 10 dB or 5 dB. Each measure has its own best. Among those that stand, the fewest
// model runs per mark win: P4, then P3, then P2.
export const LIMITS = {slips: 3, pool: 2, w1Points: 1, voicesShare: 0.1};
const ORDER = ['P4', 'P3', 'P2'];

export function bestOf(cands) {
  const list = Object.values(cands);
  const best = {
    slips: Math.max(...list.map(c => c.slips)),
    pool: Math.min(...list.map(c => c.pool)),
    w1: {},
    voices: {},
  };
  for (const k of Object.keys(list[0].w1))
    best.w1[k] = Math.max(...list.map(c => c.w1[k]));
  for (const k of Object.keys(list[0].voices))
    best.voices[k] = Math.min(...list.map(c => c.voices[k]));
  return best;
}

/**
 * What keeps this candidate from standing, in words. `today`, when given, reads the 10% as a
 * share of what today's rules show in that condition rather than of the best candidate's marks.
 */
export function failures(c, best, today = null) {
  const out = [];
  if (c.slips < best.slips - LIMITS.slips)
    out.push(`slips ${c.slips} against ${best.slips}`);
  if (c.pool > best.pool + LIMITS.pool)
    out.push(`pool ${c.pool} against ${best.pool}`);
  for (const [k, v] of Object.entries(c.w1)) {
    if (v < best.w1[k] - LIMITS.w1Points)
      out.push(`W1 ${k} ${v} against ${best.w1[k]}`);
  }
  for (const [k, v] of Object.entries(c.voices)) {
    const slack = LIMITS.voicesShare * (today ? today[k] : best.voices[k]);
    if (v > best.voices[k] + slack + 1e-9)
      out.push(`voices ${k} ${v} against ${best.voices[k]}`);
  }
  return out;
}

export function chooseWinner(cands, today = null) {
  const best = bestOf(cands);
  const why = Object.fromEntries(
    Object.entries(cands).map(([k, c]) => [k, failures(c, best, today)]),
  );
  const winner = ORDER.find(k => why[k].length === 0) ?? null;
  // If none stands: not part of the fixed rule, the one that misses the fewest limits.
  const closest = [...ORDER].sort((a, b) => why[a].length - why[b].length)[0];
  return {best, why, winner, closest};
}
