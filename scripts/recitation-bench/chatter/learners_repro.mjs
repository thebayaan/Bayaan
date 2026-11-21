/* eslint-env node, es2020 */
// Checks the copied rules on none:0 against the letter-slip experiment's clean result:
// rule C keeps 42 of 66 hits and 5 of 86 false marks, on the experiment's own slice.
// Given the experiment's feature rows, it also compares mark by mark.
//
//   node chatter/learners_repro.mjs [path/to/marks.feat.jsonl]
import fs from 'node:fs';
import path from 'node:path';
import {OUT, readJsonl, rowsFile} from './learners_lib.mjs';

const rows = readJsonl(rowsFile('none:0'));
const group = (r, g) => (g === 'false' ? r.label.startsWith('false') : r.label === g);
const count = (get, g) => {
  const of = rows.filter(r => group(r, g));
  return `${of.filter(r => get(r) === 'keep').length}/${of.length}`;
};
const table = {};
const views = {
  'B on the app slice': r => r.rules.B,
  'C on the app slice': r => r.rules.C,
  'D': r => r.rules.D,
  'E on the app slice': r => r.rules.E,
  'B on the experiment slice': r => r.atFirstVerdict.B,
  'C on the experiment slice': r => r.atFirstVerdict.C,
};
for (const [name, get] of Object.entries(views)) {
  table[name] = {hit: count(get, 'hit'), near: count(get, 'near'), false: count(get, 'false')};
}
const out = {
  marks: rows.length,
  table,
  sameFirstAndLastBad: rows.filter(r => Math.abs(r.since - r.lastBad) < 1e-6).length,
  moreThanOneBadVerdict: rows.filter(r => r.badInStreak > 1).length,
  appSliceEndsEarlier: rows.filter(r => r.app && r.exp && r.app.to < r.exp.to).length,
  decisionsDiffer: {
    B: rows.filter(r => r.rules.B !== r.atFirstVerdict.B).length,
    C: rows.filter(r => r.rules.C !== r.atFirstVerdict.C).length,
  },
  quantisationChangesC: rows.filter(r => {
    if (!r.exp) return false;
    const by = g => r.exp.perLetterQ <= -6 || (Number.isFinite(g) && g <= -3.34);
    return by(r.exp.gapSub) !== by(r.exp.gapSubRaw);
  }).length,
};
const feat = process.argv[2];
if (feat) {
  const stored = new Map();
  for (const line of fs.readFileSync(feat, 'utf8').split('\n')) {
    if (!line) continue;
    const r = JSON.parse(line);
    if (r.ds === 'quranmb') stored.set(r.key, r);
  }
  let compared = 0;
  let worstPerLetter = 0;
  let worstGap = 0;
  const misses = [];
  for (const r of rows) {
    const s = stored.get(r.key);
    if (!s) {
      misses.push(r.key);
      continue;
    }
    compared += 1;
    if (r.exp) {
      worstPerLetter = Math.max(worstPerLetter, Math.abs(r.exp.perLetterQ - s.f_perLetter));
      if (Number.isFinite(s.p30f_gapSub) || Number.isFinite(r.exp.gapSub)) {
        worstGap = Math.max(worstGap, Math.abs((r.exp.gapSub ?? 1e9) - (s.p30f_gapSub ?? 1e9)));
      }
    }
  }
  out.againstExperiment = {storedRows: stored.size, compared, notStored: misses.length, worstPerLetter, worstGap};
}
fs.writeFileSync(path.join(OUT, 'repro.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
