/* eslint-env node, es2020 */
// The candidates for the cancel step, and what each does with a mark that falls due.
//   P1  the rule now in the app: -2 per letter on t-4.6..t+0.9
//   P2  the letter-slip rule on that slice, 2 left and 1 right context words
//   P3  the letter-slip rule on the judge's own first pass
//   P4  P3, skipped when the judge answered wrong or absent on the word
//   s   the phone switch set to skipped marks only: other marks are left alone
import {cancelAnswer, shippedAnswer} from './rule.mjs';

const CANCELS = ['none', 'P1', 'P2', 'P3', 'P4', 'P2s', 'P3s', 'P4s'];
const judges = [
  ['S1', 'S1', 0.48],
  ['S1h0', 'S1', 0],
  ['S2', 'S2', 0.48],
  ['S2h0', 'S2', 0],
];
export const CONFIGS = [
  {name: 'J.none', chain: 'J', hold: 0, cancel: 'none'},
  {name: 'J.P1', chain: 'J', hold: 0, cancel: 'P1'},
  {name: 'J.P2', chain: 'J', hold: 0, cancel: 'P2'},
  ...judges.flatMap(([chain, step, hold]) =>
    CANCELS.map(cancel => ({
      name: `${chain}.${cancel}`,
      chain,
      step,
      hold,
      cancel,
    })),
  ),
  // No veto, for comparison only: not a candidate.
  ...['N1', 'N2'].flatMap(chain =>
    ['none', 'P1', 'P2', 'P3', 'P4'].map(cancel => ({
      name: `${chain}.${cancel}`,
      chain,
      step: chain,
      hold: 0.48,
      cancel,
    })),
  ),
];

/**
 * What a candidate does with a due mark.
 * @param {string} cancel
 * @param {{kind: string}} q
 * @param {{junction: boolean, identified: boolean, ship?: object, judge?: object}} f the
 *   features known so far: ship on the slice now in the app, judge on the judge's slice
 * @returns {{ans: 'keep'|'cancel', x: number, need: 'ship'|'judge'|null}} x is the model
 *   runs on top of the judge's own; need names a feature not yet known
 */
export function decideCancel(cancel, q, f) {
  const keep = {ans: 'keep', x: 0, need: null};
  if (cancel === 'none' || f.junction) return keep;
  const base = cancel.replace(/s$/, '');
  if (cancel !== base && q.kind !== 'missed') return keep;
  if (base === 'P4' && f.identified) return keep;
  const onShip = base === 'P1' || base === 'P2';
  const feat = onShip ? f.ship : f.judge;
  if (feat === undefined)
    return {ans: 'keep', x: 0, need: onShip ? 'ship' : 'judge'};
  if (feat.failed) return keep;
  if (base === 'P1')
    return {ans: shippedAnswer(feat.perLetter), x: 1, need: null};
  const ans = cancelAnswer({first: feat.perLetter, gap: feat.gap});
  return {ans, x: (onShip ? 1 : 0) + (feat.padded ? 1 : 0), need: null};
}
