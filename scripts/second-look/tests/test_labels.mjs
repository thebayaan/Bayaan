// A shown mark's class on a learner take must agree with the score the 66 real slips came
// from, on every stored mark. Reads .out/real3/marks.jsonl and the takes' manifest.
//   node --test scripts/second-look/tests/test_labels.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {BENCH} from '../lib.mjs';
import {labelOf} from '../quranmb_labels.mjs';

test('every stored QuranMB mark keeps its class', () => {
  const marks = fs
    .readFileSync(path.join(BENCH, '.out/real3/marks.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(l => JSON.parse(l))
    .filter(m => m.ds === 'quranmb');
  const takes = new Map(
    JSON.parse(
      fs.readFileSync(
        path.join(BENCH, '.out/takes/quranmb/manifest.json'),
        'utf8',
      ),
    ).map(t => [t.id, t]),
  );
  const tally = {};
  for (const m of marks) {
    const got = labelOf(takes.get(m.run).segments, m.id, m.t);
    assert.equal(got, m.label, `${m.run} ${m.id}`);
    tally[got] = (tally[got] ?? 0) + 1;
  }
  assert.deepEqual(tally, {
    'false-correct': 16,
    'false-incorrect': 70,
    hit: 66,
    near: 52,
    lead: 3,
  });
});
