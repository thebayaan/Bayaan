/* eslint-env node, es2020 */
// Tests of the natural scorer on made-up runs, and of its replay against
// replay2.mjs on existing runs.
//
//   node --test natural/test_score.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {replay, marks, ruleVerdict} from './replay.mjs';
import {
  exactId,
  nearSet,
  offTrackEpisodes,
  pigeonhole,
  poissonUpper,
  scoreEvent,
} from './score.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const WORDS = {'7:61': 8, '7:62': 6};
const words = k => WORDS[k];
const hasKey = k => k in WORDS;
const count = (s, a) => WORDS[`${s}:${a}`];

// A run in the app's correction state: lock at 1 s, words judged as listed.
function makeRun({changes = [], flush = null, log = [], flags = [], seconds = 10}) {
  return {
    summary: {seconds, firstLock: 1},
    log: [
      {t: 1, type: 'debug', event: 'located', at: '7:61:0'},
      {t: 1, type: 'word_progress', key: '7:61', w: 0, n: 8},
      ...log,
    ],
    flags,
    vchanges: changes,
    ...(flush ? {flush} : {}),
  };
}
const change = (t, w, to, d = {gop: -20, distance: 0.8, heardRatio: 1, margin: 1}, extra = {}) => ({
  t,
  id: `7:61:${w}`,
  from: 'pending',
  to,
  ...(to === 'pending' ? {} : {d}),
  ...extra,
});

test('a wrong interior word followed by a correct one becomes a mark', () => {
  const run = makeRun({
    changes: [change(3, 4, 'wrong'), change(3.48, 5, 'ok', {gop: 0})],
  });
  const {visible} = replay(run, {mode: 'app', wordCount: count});
  assert.deepEqual([...visible.keys()], ['7:61:4']);
  assert.equal(visible.get('7:61:4').viaFlush, false);
});

test('a wrong interior word nothing correct follows is dropped', () => {
  const run = makeRun({changes: [change(3, 4, 'wrong')]});
  const {visible, reasons} = replay(run, {mode: 'app', wordCount: count});
  assert.equal(visible.size, 0);
  assert.deepEqual(reasons.get('7:61:4'), ['not_followed']);
});

test('a wrong ayah-edge word is never a mark, with the reason recorded', () => {
  const run = makeRun({changes: [change(3, 7, 'wrong')]});
  const {visible, reasons} = replay(run, {mode: 'app', wordCount: count});
  assert.equal(visible.size, 0);
  assert.deepEqual(reasons.get('7:61:7'), ['ayah_edge']);
});

test('word counts come from the corpus, not the highest word reported', () => {
  // Word 4 is not the ayah's last word though no later word was reported.
  const run = makeRun({changes: [change(3, 4, 'wrong'), change(3.5, 3, 'ok', {gop: 0})]});
  const low = replay(run, {mode: 'app'});
  const real = replay(run, {mode: 'app', wordCount: count});
  assert.deepEqual(low.reasons.get('7:61:4'), ['ayah_edge']);
  assert.notDeepEqual(real.reasons.get('7:61:4'), ['ayah_edge']);
});

test('flush verdicts never reach the app mode', () => {
  const run = makeRun({
    changes: [change(3, 6, 'ok', {gop: 0}), change(3, 7, 'pending')],
    flush: {
      tracker: true,
      verdicts: [
        {flush: true, id: '7:61:7', state: 'skipped', live: 'pending', newly: true, d: {gop: null, heardRatio: 0, distance: 1}},
      ],
    },
  });
  for (const mode of ['app', 'flush']) {
    const {visible} = replay(run, {mode, wordCount: count});
    assert.equal(visible.size, 0, mode);
  }
  const carry = replay(run, {mode: 'carry', wordCount: count});
  assert.deepEqual([...carry.visible.keys()], ['7:61:7']);
  assert.equal(carry.visible.get('7:61:7').viaFlush, true);
  assert.equal(replay(run, {mode: 'app', wordCount: count}).trail.get('7:61:7'), undefined);
  assert.equal(carry.trail.get('7:61:7')[0].flush, true);
});

test('a wrong last word stays unmarked even with carry-on: the ayah-edge rule', () => {
  const run = makeRun({
    changes: [change(3, 7, 'pending')],
    flush: {
      tracker: true,
      verdicts: [{flush: true, id: '7:61:7', state: 'wrong', live: 'pending', newly: true, d: {distance: 0.8, heardRatio: 1, margin: 1, gop: null}}],
    },
  });
  const carry = replay(run, {mode: 'carry', wordCount: count});
  assert.equal(carry.visible.size, 0);
  assert.deepEqual(carry.reasons.get('7:61:7'), ['ayah_edge']);
});

test('flush leaves words the live verdicts judged alone', () => {
  const run = makeRun({
    changes: [change(3, 5, 'ok', {gop: 0})],
    flush: {
      tracker: true,
      verdicts: [{flush: true, id: '7:61:5', state: 'skipped', live: 'ok', newly: false, d: {gop: -20}}],
    },
  });
  const carry = replay(run, {mode: 'carry', wordCount: count});
  assert.equal(carry.visible.size, 0);
});

test('stop-time events are not what the app hears', () => {
  const run = makeRun({
    changes: [change(3, 4, 'wrong'), change(3.48, 5, 'ok', {gop: 0}), change(10, 6, 'wrong', undefined, {stop: true})],
    log: [{t: 10, type: 'debug', event: 'lost', stop: true}],
  });
  const {visible, trail} = replay(run, {mode: 'app', wordCount: count});
  assert.deepEqual([...visible.keys()], ['7:61:4']);
  assert.equal(trail.get('7:61:6'), undefined);
});

test('near words and exact words are per event type', () => {
  const changed = {type: 'changed', expectedKey: '7:61', target: 0};
  assert.deepEqual([...nearSet(changed, words, hasKey)], ['7:61:0', '7:61:1']);
  assert.equal(exactId(changed, words), '7:61:0');
  const last = {type: 'dropped_last', expectedKey: '7:61', target: 7};
  assert.deepEqual([...nearSet(last, words, hasKey)], ['7:61:6', '7:61:7']);
  assert.equal(exactId(last, words), '7:61:7');
  const added = {type: 'added', expectedKey: '7:61', target: 3};
  assert.deepEqual([...nearSet(added, words, hasKey)], ['7:61:2', '7:61:3']);
  assert.equal(exactId(added, words), null);
  const addedLast = {type: 'added_last', expectedKey: '7:61', target: null};
  assert.deepEqual([...nearSet(addedLast, words, hasKey)], ['7:61:6', '7:61:7', '7:62:0']);
  const trap = {type: 'trap', expectedKey: '7:61', target: 2};
  assert.equal(nearSet(trap, words, hasKey).size, 0);
  assert.equal(exactId(trap, words), '7:61:2');
});

function clipFor(truth) {
  return {
    clip: {
      id: 'x',
      suite: 'w1',
      truth: {reciter: 'r', reciterSplit: 'dev', pair: 'p', pairSplit: 'dev', audioKey: '7:62', expectedKey: '7:61', ...truth},
    },
  };
}

test('an event: a catch, an exact word, a false mark elsewhere', () => {
  const run = {
    ...makeRun({
      changes: [
        change(3, 4, 'wrong'),
        change(3.48, 5, 'ok', {gop: 0}),
        change(5, 2, 'wrong'),
        change(5.48, 3, 'ok', {gop: 0}),
      ],
    }),
    ...clipFor({type: 'changed', target: 4, position: 'interior', stamps: {5: [3000, 3400]}}),
  };
  const row = scoreEvent(run, words, hasKey);
  assert.equal(row.caught.app, true);
  assert.equal(row.exact.app, true);
  assert.equal(row.falseMarks.app, 1);
  assert.equal(row.unchangedWords, 8 - 3);
  assert.equal(row.miss, null);
  assert.ok(row.latency >= 0.4 && row.latency < 2);
});

test('a miss says what the engine said', () => {
  const ok = {
    ...makeRun({changes: [change(3, 4, 'ok', {gop: 0, distance: 0.1, heardRatio: 1, margin: 1})]}),
    ...clipFor({type: 'changed', target: 4, position: 'interior'}),
  };
  assert.equal(scoreEvent(ok, words, hasKey).miss, 'engine_ok');
  const unsure = {
    ...makeRun({changes: [change(3, 4, 'unsure', {gop: -2, distance: 0.3, heardRatio: 1, margin: 1})]}),
    ...clipFor({type: 'changed', target: 4, position: 'interior'}),
  };
  assert.equal(scoreEvent(unsure, words, hasKey).miss, 'engine_unsure');
  const wrongEdge = {
    ...makeRun({changes: [change(3, 7, 'wrong')]}),
    ...clipFor({type: 'changed', target: 7, position: 'last'}),
  };
  const row = scoreEvent(wrongEdge, words, hasKey);
  assert.equal(row.miss, 'rule_ayah_edge');
  assert.equal(row.engineBad, true);
  const none = {
    ...makeRun({changes: []}),
    ...clipFor({type: 'dropped_last', target: 7, position: 'last'}),
  };
  assert.equal(scoreEvent(none, words, hasKey).miss, 'no_verdict');
});

test('a junction does not count the words its recording reads differently', () => {
  const run = {
    ...makeRun({
      changes: [change(2, 1, 'wrong'), change(2.48, 2, 'ok', {gop: 0})],
    }),
    ...clipFor({type: 'junction', target: 7, position: 'last'}),
  };
  const row = scoreEvent(run, words, hasKey);
  assert.equal(row.falseMarks.app, 0);
  assert.equal(row.unchangedWords, 0);
});

test('off-track needs three seconds away from what was recited', () => {
  const run = {
    partsAt: [
      {key: '2:5', start: 0, end: 10},
      {key: '2:6', start: 10, end: 20},
    ],
    log: [
      {t: 5, type: 'word_progress', key: '2:5'},
      {t: 12, type: 'word_progress', key: '2:40'},
      {t: 13, type: 'word_progress', key: '2:40'},
      {t: 16, type: 'word_progress', key: '2:6'},
    ],
  };
  assert.deepEqual(offTrackEpisodes(run), []);
  run.log[2].t = 15.5;
  assert.deepEqual(offTrackEpisodes(run), [{from: 12, to: 15.5}]);
});

test('the interval covers the rate and widens when one unit carries it', () => {
  const even = [];
  for (let p = 0; p < 40; p++) {
    for (let r = 0; r < 20; r++) even.push({a: p, b: r, num: p % 2, den: 1});
  }
  const a = pigeonhole(even, 500);
  assert.equal(a.est, 0.5);
  assert.ok(a.lo < 0.5 && a.hi > 0.5);
  const oneReciter = even.map(x => ({...x, num: x.b === 0 ? 1 : 0}));
  const b = pigeonhole(oneReciter, 500);
  assert.equal(b.est, 0.05);
  assert.ok(b.hi > 0.1);
});

test('no resampling on an empty set', () => {
  assert.deepEqual(pigeonhole([], 100).est, null);
});

test('Poisson upper bound', () => {
  assert.ok(Math.abs(poissonUpper(0) - 3.69) < 0.01);
  assert.ok(Math.abs(poissonUpper(10) - 18.39) < 0.02);
});

test('the rule names follow the shipped constants', () => {
  assert.equal(ruleVerdict({state: 'skipped', word: 3, totalWords: 8, detail: {gop: -1}}), 'gop_fits');
  assert.equal(ruleVerdict({state: 'skipped', word: 3, totalWords: 8, detail: {gop: -20}}), null);
  assert.equal(ruleVerdict({state: 'wrong', word: 3, totalWords: 8, detail: {gop: -0.5}}), 'gop_fits');
  assert.equal(ruleVerdict({state: 'wrong', word: 0, totalWords: 8, detail: {gop: -20}}), 'ayah_edge');
  assert.equal(ruleVerdict({state: 'skipped', word: 0, totalWords: 8, detail: {heardRatio: 0.5}}), 'first_word_heard');
  assert.equal(marks.NEXT_OK_WINDOW_MS, 3000);
});

test('agrees with replay2.mjs on existing runs', async t => {
  const dir = path.resolve(HERE, '../.out/corpus/main');
  if (!fs.existsSync(dir)) return t.skip('no bench runs here');
  const {replayRun} = await import('../replay2.mjs');
  const files = fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.json') && !f.endsWith('.truth.json'))
    .slice(0, 30);
  let marksSeen = 0;
  for (const f of files) {
    const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!run.vchanges) continue;
    const a = replayRun(run);
    const b = replay(run, {mode: 'app'});
    assert.deepEqual([...b.visible.keys()].sort(), [...a.visible.keys()].sort(), f);
    marksSeen += a.visible.size;
  }
  assert.ok(marksSeen > 0);
});
