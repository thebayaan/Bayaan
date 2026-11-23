/* eslint-env node, es2020 */
// Chooses the QuranMB takes of the test (LEARNERS.md) and writes them to
// .out/chatter/learners/clips.json: every take that holds a mark of the clean baseline,
// and a seeded random sample of the others up to about 300 minutes in all. The sample
// is drawn apart for incorrect and correct takes, in proportion to how many of the
// other takes carry each label, so it keeps their label mix.
//
//   node chatter/learners_clips.mjs
import fs from 'node:fs';
import path from 'node:path';
import {CLEAN_MARKS, MANIFEST, OUT, SR, mulberry, readJson, readJsonl} from './learners_lib.mjs';

const SEED = 20261106;
const TARGET_MINUTES = 300;

const seconds = clip => fs.statSync(clip.audio).size / 4 / SR;

function shuffled(items, seed) {
  const rand = mulberry(seed);
  const out = [...items].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const takes = readJson(MANIFEST);
const clean = readJsonl(CLEAN_MARKS).filter(m => m.ds === 'quranmb');
const marked = new Set(clean.map(m => m.run));
const fixed = takes.filter(c => marked.has(c.id));
const others = takes.filter(c => !marked.has(c.id));
const minutesOf = list => list.reduce((n, c) => n + seconds(c), 0) / 60;
const budget = TARGET_MINUTES - minutesOf(fixed);
const LABELS = ['incorrect', 'correct'];

// How many takes the budget holds at the other takes' mean length, split by label.
const wanted = Math.round((budget * 60) / ((minutesOf(others) * 60) / others.length));
const strata = {};
LABELS.forEach((label, i) => {
  const pool = others.filter(c => c.label === label);
  const n = Math.round((wanted * pool.length) / others.length);
  strata[label] = {pool, chosen: shuffled(pool, SEED + i).slice(0, n)};
});
// Up to about 300 minutes: a draw of long takes gives back its last incorrect ones.
const total = () => minutesOf(fixed) + LABELS.reduce((n, label) => n + minutesOf(strata[label].chosen), 0);
while (total() > TARGET_MINUTES) strata.incorrect.chosen.pop();
for (const label of LABELS) strata[label].weight = strata[label].pool.length / strata[label].chosen.length;

const clips = [
  ...fixed.map(c => ({id: c.id, label: c.label, seconds: +seconds(c).toFixed(2), stratum: 'marked', weight: 1})),
  ...LABELS.flatMap(label =>
    strata[label].chosen.map(c => ({
      id: c.id,
      label: c.label,
      seconds: +seconds(c).toFixed(2),
      stratum: 'sample',
      weight: strata[label].weight,
    })),
  ),
];
const listed = new Set(clips.map(c => c.id));
const kept = {};
for (const m of clean) {
  kept[m.label] ??= [0, 0];
  kept[m.label][1] += 1;
  if (listed.has(m.run)) kept[m.label][0] += 1;
}
const count = (list, label) => list.filter(c => c.label === label).length;
const summary = {
  seed: SEED,
  method:
    'every take holding a clean mark; then the first takes of a seeded shuffle of the others (mulberry32, seed + label index, sorted by id first), drawn per label in proportion to the labels of the other takes, as many as the 300-minute budget holds at their mean length',
  targetMinutes: TARGET_MINUTES,
  minutes: +(clips.reduce((n, c) => n + c.seconds, 0) / 60).toFixed(1),
  population: {takes: takes.length, incorrect: count(takes, 'incorrect'), correct: count(takes, 'correct'), minutes: +minutesOf(takes).toFixed(1)},
  marked: {takes: fixed.length, incorrect: count(fixed, 'incorrect'), correct: count(fixed, 'correct'), minutes: +minutesOf(fixed).toFixed(1)},
  others: {takes: others.length, incorrect: count(others, 'incorrect'), correct: count(others, 'correct'), minutes: +minutesOf(others).toFixed(1)},
  sample: {
    takes: strata.incorrect.chosen.length + strata.correct.chosen.length,
    incorrect: strata.incorrect.chosen.length,
    correct: strata.correct.chosen.length,
    minutes: +(minutesOf(strata.incorrect.chosen) + minutesOf(strata.correct.chosen)).toFixed(1),
    weightIncorrect: +strata.incorrect.weight.toFixed(4),
    weightCorrect: +strata.correct.weight.toFixed(4),
  },
  cleanMarksKept: kept,
};
fs.mkdirSync(OUT, {recursive: true});
fs.writeFileSync(path.join(OUT, 'clips.json'), JSON.stringify({...summary, clips}, null, 1));
console.log(JSON.stringify(summary, null, 1));
