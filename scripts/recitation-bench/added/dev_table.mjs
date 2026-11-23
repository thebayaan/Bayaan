/* eslint-env node, es2020 */
// Dev only: recall against constants, and why the event's own gap was refused.
import {DEFAULTS, features, inSplit, index, marksOf, readPacked} from './lib.mjs';
import {rejectReason, collapse} from './rule.mjs';

const natural = [...readPacked('added_kept_dev'), ...readPacked('added_between_dev')].filter(r => inSplit(r.truth, 'dev'));
const kinds = ['interior', 'interior_prefix', 'between'];
const hit = (run, P) => [...marksOf(run, P).values()].some(m => m.left === run.truth.left && m.right === run.truth.right);
const settings = [
  ['fit .15', {}],
  ['fit .25', {fit: 0.25}],
  ['fit .34', {fit: 0.34}],
  ['fit .40', {fit: 0.4}],
  ['fit .40, no word check', {fit: 0.4, realWord: false}],
];
for (const [label, set] of settings) {
  const P = {...DEFAULTS, ...set};
  const out = {};
  for (const k of kinds) {
    const mine = natural.filter(r => r.truth.kind === k);
    out[k] = `${mine.filter(r => hit(r, P)).length}/${mine.length}`;
  }
  console.log(label, JSON.stringify(out));
}
const P = {...DEFAULTS, fit: 0.4};
for (const k of kinds) {
  const why = {};
  const words = {};
  for (const r of natural.filter(x => x.truth.kind === k)) {
    if (hit(r, P)) continue;
    const t = r.truth;
    const gaps = (r.probe?.gaps ?? []).filter(g => g.left === t.left && g.id === t.right);
    let reason = 'no gap in that place';
    if (gaps.length) {
      const rs = gaps.map(g => rejectReason(g, features(g, P), P));
      reason = rs.find(x => x !== null) ?? 'lock chunk or not confirmed';
    } else if ((r.probe?.gaps ?? []).length === 0) reason = 'no gap at all';
    why[reason] = (why[reason] ?? 0) + 1;
    (words[reason] ??= new Set()).add(`${t.cluster} ${t.phon} @${t.right}`);
  }
  console.log(k, JSON.stringify(why));
  for (const [w, set] of Object.entries(words)) console.log('  ', w, [...set].slice(0, 14).join(' ; '));
}
// Score distribution on the gaps the rule marks.
const noGaps = [];
for (const r of natural) {
  for (const m of marksOf(r, P).values()) {
    if (m.left === r.truth.left && m.right === r.truth.right) {
      noGaps.push({nog: m.rec.noGap, tot: m.rec.noGap * m.rec.tokens, n: collapse(m.chars).length, margin: m.rec.margin});
    }
  }
}
const q = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2) : null;
};
console.log('marked events: noGap per token, quantiles .01 .05 .25 .5 .75 .95 .99', [0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99].map(p => q(noGaps.map(x => x.nog), p)));
console.log('total deficit, same quantiles', [0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99].map(p => q(noGaps.map(x => x.tot), p)));
console.log('margin .01 .05 .25', [0.01, 0.05, 0.25].map(p => q(noGaps.map(x => x.margin), p)));
void index;
