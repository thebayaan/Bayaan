/* eslint-env node, es2020 */
// Dev only: every gap on correct text that passes the checks that need no scores,
// at loose fit cut-offs, with the model's scores, beside what true events scored.
import {DEFAULTS, features, marksOf, readPacked, inSplit, index} from './lib.mjs';
import {collapse, rejectReason} from './rule.mjs';

const P = {...DEFAULTS, fit: 0.4, fitLast: 0.5, noGap: 0, margin: 0, confirmSec: 0};
for (const suite of ['pool_dev_cand', 'w5_dev_cand', 'learners_cand']) {
  const rows = [];
  for (const r of readPacked(suite)) {
    for (const g of r.probe?.gaps ?? []) {
      const why = rejectReason(g, features(g, P), P);
      if (why) continue;
      rows.push({
        run: r.id.slice(-30),
        cat: r.truth.category ?? r.truth.dataset ?? '',
        label: r.truth.label ?? '',
        place: `${g.left}|${g.id}`,
        chars: g.chars,
        mode: g.mode,
        fit: [g.fitL, g.fitR],
        nog: g.noGap,
        tot: g.noGap === null ? null : +(g.noGap * g.tokens).toFixed(1),
        n: collapse(g.chars).length,
        m: g.margin,
        LR: [g.leftLast, g.rightLast],
        tw: [g.twiceL, g.twiceR],
        held: g.tLast ? +(g.tLast - g.t).toFixed(2) : null,
      });
    }
  }
  console.log(`-- ${suite}: ${rows.length}`);
  for (const x of rows) console.log(JSON.stringify(x));
}
// True events at the same cut-offs, by word.
const nat = [...readPacked('added_kept_dev'), ...readPacked('added_between_dev')].filter(r => inSplit(r.truth, 'dev'));
const seen = [];
for (const r of nat) {
  for (const g of r.probe?.gaps ?? []) {
    if (g.left !== r.truth.left || g.id !== r.truth.right) continue;
    if (rejectReason(g, features(g, P), P)) continue;
    seen.push({nog: g.noGap, tot: g.noGap * g.tokens, m: g.margin, fitL: g.fitL, fitR: g.fitR});
  }
}
const q = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2) : null;
};
const ps = [0.5, 0.75, 0.9, 0.95, 0.99, 1];
console.log('true gaps', seen.length, 'noGap per token at', ps, ps.map(p => q(seen.map(x => x.nog), p)));
console.log('  total', ps.map(p => q(seen.map(x => x.tot), p)));
console.log('  margin lowest', [0, 0.01, 0.05].map(p => q(seen.map(x => x.m), p)));
console.log('  fitL', ps.map(p => q(seen.map(x => x.fitL), p)), 'fitR', ps.map(p => q(seen.map(x => x.fitR), p)));
void marksOf;
void index;
