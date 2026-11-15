/* eslint-env node, es2020 */
// none:0 against the clean baseline, take by take and mark by mark: the same verdicts,
// flags and labelled marks, or the harness is wrong. bench.mjs has gained fields since
// the baseline ran (`source` on flags, `stop` and more detail on log entries), so flags
// and logs are compared on the fields the baseline has.
//
//   node chatter/learners_parity.mjs [--limit N]
import fs from 'node:fs';
import path from 'node:path';
import {CLEAN_MARKS, CLEAN_RUNS, OUT, loadClips, marksFile, readJson, readJsonl, resultName, runDir} from './learners_lib.mjs';

const at = process.argv.indexOf('--limit');
const COND = 'none:0';
let clips = loadClips();
if (at > 0) clips = clips.slice(0, Number(process.argv[at + 1]));
const dir = runDir(COND);
const present = clips.filter(c => fs.existsSync(path.join(dir, resultName(c.id))));
const ids = new Set(present.map(c => c.id));
const problems = [];
let verdicts = 0;
const flagsView = flags => flags.map(({source: _s, stop: _t, ...f}) => f);
const logView = log =>
  log.map(({stop: _t, reason: _r, ...e}) => (e.type === 'correction' ? {t: e.t, type: e.type} : e));
for (const clip of present) {
  const mine = readJson(path.join(dir, resultName(clip.id)));
  const base = readJson(path.join(CLEAN_RUNS, resultName(clip.id)));
  verdicts += base.vchanges.length;
  if (JSON.stringify(mine.vchanges) !== JSON.stringify(base.vchanges)) problems.push({clip: clip.id, what: 'vchanges'});
  if (JSON.stringify(flagsView(mine.flags)) !== JSON.stringify(flagsView(base.flags))) problems.push({clip: clip.id, what: 'flags'});
  if (JSON.stringify(logView(mine.log)) !== JSON.stringify(logView(base.log))) problems.push({clip: clip.id, what: 'log'});
  if (JSON.stringify(mine.health) !== JSON.stringify(base.health)) problems.push({clip: clip.id, what: 'health'});
  if (JSON.stringify(mine.finalVerdicts) !== JSON.stringify(base.finalVerdicts)) problems.push({clip: clip.id, what: 'finalVerdicts'});
  if (JSON.stringify(mine.levels) !== JSON.stringify(base.levels)) problems.push({clip: clip.id, what: 'levels'});
}
const FIELDS = ['run', 'id', 'word', 't', 'confirmedAt', 'state', 'd', 'label', 'errorClasses', 'corrected', 'cold', 'segment', 'features'];
const view = m => JSON.stringify(FIELDS.map(f => m[f]));
const cleanMarks = readJsonl(CLEAN_MARKS).filter(m => m.ds === 'quranmb' && ids.has(m.run));
const myMarks = readJsonl(marksFile(COND)).filter(m => ids.has(m.run));
const a = new Set(cleanMarks.map(view));
const b = new Set(myMarks.map(view));
const onlyClean = [...a].filter(x => !b.has(x));
const onlyMine = [...b].filter(x => !a.has(x));
const byLabel = {};
for (const m of myMarks) byLabel[m.label] = (byLabel[m.label] ?? 0) + 1;
const out = {
  takesCompared: present.length,
  takesListed: clips.length,
  verdictChanges: verdicts,
  takesDiffering: problems.length,
  marksClean: cleanMarks.length,
  marksHere: myMarks.length,
  marksOnlyInClean: onlyClean.length,
  marksOnlyHere: onlyMine.length,
  byLabel,
  same: problems.length === 0 && onlyClean.length === 0 && onlyMine.length === 0,
  problems: problems.slice(0, 20),
};
fs.writeFileSync(path.join(OUT, 'parity.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
if (!out.same) process.exit(1);
