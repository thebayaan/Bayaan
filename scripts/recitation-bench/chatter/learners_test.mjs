/* eslint-env node, es2020 */
//   node --test chatter/learners_test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {mixAtSnr, takeWindow, windowOffset} from './mix.mjs';
import {prepare, relativeTo, scoreWord} from '../judge/ctc.mjs';
import {
  aucOfSorted,
  engineIds,
  mulberry,
  replayDetail,
  segmentErrors,
  segmentOdds,
  segmentWords,
  speakerOf,
} from './learners_lib.mjs';
import {
  FITS_ABOVE_PER_LETTER,
  MIN_SLICE_S,
  SLICE_AFTER_S,
  SLICE_BEFORE_S,
  alignIn,
  fedSamples,
  fitConstants,
  fitSlice,
  freeContext,
  innerSubGap,
  quantised,
  ruleB,
  ruleC,
  ruleD,
  ruleE,
} from './learners_score.mjs';

const VOCAB = 31;

function randomLogp(frames, seed) {
  const rand = mulberry(seed);
  const logp = new Float32Array(frames * VOCAB);
  for (let i = 0; i < logp.length; i++) logp[i] = -rand() * 12;
  return logp;
}

// Rule B is the app's first second look as it stood when this test ran. The app has since
// moved to scripts/second-look/RULE.md, so these stay pinned here rather than read from it.
test('rule B keeps the constants this test ran with', () => {
  assert.equal(FITS_ABOVE_PER_LETTER, -2);
  assert.equal(SLICE_BEFORE_S, 4.6);
  assert.equal(SLICE_AFTER_S, 0.9);
  assert.equal(MIN_SLICE_S, 1);
});

test('a mix is the recitation plus the window, repeatably', () => {
  const speech = new Float32Array(32000).map((_, i) => 0.1 * Math.sin(i / 20));
  const track = new Float32Array(50000).map((_, i) => 0.2 * Math.sin(i / 7));
  const offset = windowOffset('clip', 'one_ar', track.length);
  const once = mixAtSnr(speech, takeWindow(track, offset, speech.length), 10);
  const again = mixAtSnr(speech, takeWindow(track, windowOffset('clip', 'one_ar', track.length), speech.length), 10);
  assert.deepEqual(once.mix, again.mix);
  assert.equal(once.scale, 1);
  assert.ok(once.gain > 0);
  for (const i of [0, 1234, 31999]) {
    assert.ok(Math.abs(once.mix[i] - (speech[i] + once.gain * track[(offset + i) % track.length])) < 1e-6);
  }
});

test('the alignment scores what scoreWord scores, in a text and alone', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const frames = 40 + seed;
    const rel = relativeTo(randomLogp(frames, seed), frames);
    const tokens = [3, 7, 7, 12, 5].slice(0, 2 + (seed % 4));
    for (const p of [prepare(rel, frames, [9, 30], [30, 4, 2]), prepare(rel, frames, [], []), freeContext(rel, frames)]) {
      const expected = scoreWord(p, tokens);
      const al = alignIn(p, tokens);
      assert.ok(Math.abs(al.score - expected) < 1e-3, `seed ${seed}: ${al.score} v ${expected}`);
      assert.ok(al.ts[0] >= 0);
      for (let j = 1; j < tokens.length; j++) assert.ok(al.ts[j] > al.te[j - 1]);
    }
  }
});

test('a heard inner letter beats the written word, and two letters have no inner one', () => {
  const frames = 20;
  const logp = new Float32Array(frames * VOCAB).fill(-20);
  const said = [5, 11, 6];
  for (let t = 0; t < frames; t++) {
    const k = t >= 4 && t < 5 ? said[0] : t >= 8 && t < 9 ? said[1] : t >= 12 && t < 13 ? said[2] : 0;
    logp[t * VOCAB + k] = 0;
  }
  const rel = relativeTo(logp, frames);
  const free = freeContext(rel, frames);
  const written = [5, 12, 6];
  const gap = innerSubGap(free, written, scoreWord(free, written));
  assert.ok(gap <= -3.34, `gap ${gap}`);
  assert.equal(innerSubGap(free, [5, 6], scoreWord(free, [5, 6])), null);
});

test('stored logs round to 0.01 nat and floor at -320', () => {
  const q = quantised(Float32Array.from([-1.23456, -500, 0]));
  assert.ok(Math.abs(q[0] + 1.23) < 1e-6);
  assert.ok(Math.abs(q[1] + 320) < 1e-3);
  assert.equal(q[2], 0);
});

test('the rules at their thresholds', () => {
  assert.equal(ruleB(null), 'keep');
  assert.equal(ruleB({perLetter: -2}), 'keep');
  assert.equal(ruleB({perLetter: -1.999}), 'cancel');
  assert.equal(ruleC(null), 'keep');
  assert.equal(ruleC({perLetterQ: -6, gapSub: null}), 'keep');
  assert.equal(ruleC({perLetterQ: -5.999, gapSub: null}), 'cancel');
  assert.equal(ruleC({perLetterQ: -1, gapSub: -3.34}), 'keep');
  assert.equal(ruleC({perLetterQ: -1, gapSub: -3.339}), 'cancel');
  assert.equal(ruleE('wrong', {perLetter: 0}), 'keep');
  assert.equal(ruleE('missed', {perLetter: 0}), 'cancel');
  assert.equal(ruleE('missed', null), 'keep');
  assert.equal(ruleD('wrong', 'interior', -2, 2), 'cancel');
  assert.equal(ruleD('wrong', 'interior', -2.001, 2), 'keep');
  assert.equal(ruleD('wrong', 'first', 0, 2), 'keep');
  assert.equal(ruleD('wrong', 'last', 0, 2), 'keep');
  assert.equal(ruleD('skipped', 'first', 0, 2), 'cancel');
  assert.equal(ruleD('skipped', 'interior', null, 2), 'keep');
});

test('the audio fed when a mark falls due is whole chunks, within the take', () => {
  assert.equal(fedSamples(35.06, 16000 * 60), Math.round(35.04 * 16000));
  assert.equal(fedSamples(0.48, 16000 * 60), Math.round(0.48 * 16000));
  assert.equal(fedSamples(100, 16000 * 2), 32000);
});

const C = fitConstants(
  {
    fit: {value: 2},
    leftWords: {value: 2},
    rightWords: {value: 0},
    sliceSeconds: {value: 8},
    cutSeconds: {value: 0.2},
    tailSeconds: {value: 0.2},
    firstWithinFrames: {value: 50},
  },
  {
    holdSeconds: {value: 0.48},
    trackerLagSeconds: {value: 0.23},
    cursorLagSeconds: {value: 1.5},
    afterPreviousSeconds: {value: 0.3},
    noPreviousSeconds: {value: 1},
    minSliceSeconds: {value: 1.5},
  },
);

test('rule D\'s slice stays inside the ayah, as the harness puts it', () => {
  const words = {'2:3': 5, '2:4': 6, '2:5': 7};
  const length = 16000 * 100;
  // The tracker knows this ayah's first word and the end of the ayah before.
  const tracked = new Map([
    ['2:4:0', {from: 500, to: 510}], // 20 s
    ['2:3:4', {from: 480, to: 490}], // ends 19.6 s
  ]);
  const inside = fitSlice({key: '2:4', t: 24, length, tracked, cursorIn: new Map(), wordsOf: words, C});
  assert.equal(inside.end, Math.round(24.48 * 16000));
  // min(19.6 + 0.3, 20 - 0.23 - 0.2) = 19.57
  assert.equal(inside.start, Math.round(19.57 * 16000));
  // Up to 8 s.
  const long = fitSlice({key: '2:4', t: 40, length, tracked, cursorIn: new Map(), wordsOf: words, C});
  assert.equal(long.end - long.start, 8 * 16000);
  // Ends just after the next ayah starts, never before the verdict.
  const nextKnown = new Map([...tracked, ['2:5:0', {from: 610, to: 620}]]); // 24.17 s
  const ends = fitSlice({key: '2:4', t: 24, length, tracked: nextKnown, cursorIn: new Map(), wordsOf: words, C});
  assert.equal(ends.end, Math.round((24.4 - 0.23 + 0.2) * 16000));
  const notBefore = fitSlice({key: '2:4', t: 25, length, tracked: nextKnown, cursorIn: new Map(), wordsOf: words, C});
  assert.equal(notBefore.end, 25 * 16000);
  // Without tracker frames, from the cursor; a slice too short becomes the last 3 s.
  const cursor = fitSlice({key: '2:4', t: 24, length, tracked: new Map(), cursorIn: new Map([['2:4', 20]]), wordsOf: words, C});
  assert.equal(cursor.start, Math.round((20 - 1.5 - 1) * 16000));
  const none = fitSlice({key: '2:4', t: 24, length, tracked: new Map(), cursorIn: new Map(), wordsOf: words, C});
  assert.equal(none.end - none.start, 8 * 16000);
  const short = fitSlice({key: '2:4', t: 21, length, tracked: new Map([['2:4:0', {from: 525, to: 530}]]), cursorIn: new Map(), wordsOf: words, C});
  assert.ok(short.end - short.start >= 1.5 * 16000);
});

test('words, errors and the odds of a segment', () => {
  const seg = {
    surah: 2,
    ayahStart: 2,
    ayahEnd: 2,
    wordStart: 2,
    wordEnd: 6,
    phonemeEdits: [{word: '2:2:4', class: 'vowel'}, {word: '2:2:1', class: 'consonant'}, {word: '2:2:9', class: 'vowel'}],
  };
  assert.deepEqual(segmentWords(seg), [[2, 2], [2, 3], [2, 4], [2, 5], [2, 6]]);
  // Words outside the span move to its edge, as score_real.mjs moves them.
  assert.deepEqual([...segmentErrors(seg)].sort(), ['2:2', '2:4', '2:6']);
  const o = segmentOdds(seg);
  assert.equal(o.errors.size / o.keys.length, 3 / 5);
  assert.deepEqual([...o.neighbour].sort(), ['2:3', '2:5']);
  assert.deepEqual(engineIds(2, 2, 4), ['2:2:3']);
  assert.deepEqual(engineIds(15, 7, 1), ['15:7:0', '15:7:1']);
  assert.equal(speakerOf('quranmb/a_b'), 'a');
});

test('the AUC counts a hit below a false mark, and ties as a half', () => {
  const auc = (hits, falses) =>
    aucOfSorted(
      [...hits.map(([s, n]) => ({s, pos: true, r: n})), ...falses.map(([s, n]) => ({s, pos: false, r: n}))].sort((x, y) => x.s - y.s),
      n => n,
    );
  assert.equal(auc([[-5, 1]], [[-1, 1]]), 1);
  assert.equal(auc([[-1, 1]], [[-5, 1]]), 0);
  assert.equal(auc([[-1, 2]], [[-1, 3]]), 0.5);
  assert.equal(auc([[-5, 1], [-1, 1]], [[-3, 1]]), 0.5);
  assert.equal(auc([[-5, 3], [-1, 1]], [[-3, 1]]), 0.75);
  assert.ok(Number.isNaN(auc([], [[-3, 1]])));
});

test('the replay gives a mark its kind and its latest bad verdict', async () => {
  const rules = {
    emptyMarkBook: () => new Map(),
    nextConfirmAt: book => {
      for (const m of book.values()) if (m.status === 'suspect') return m.since + 500;
      return null;
    },
    confirmDue: (book, now) => {
      const next = new Map(book);
      const confirmed = [];
      for (const [k, m] of book) {
        if (m.status === 'suspect' && now >= m.since + 500) {
          next.set(k, {...m, status: 'mistake'});
          confirmed.push(m);
        }
      }
      return {book: next, confirmed};
    },
    applyVerdicts: (book, batch, now) => {
      const next = new Map(book);
      for (const c of batch) {
        if (c.state !== 'wrong' && c.state !== 'skipped') continue;
        const k = `${c.surah}:${c.ayah}:${c.word}`;
        next.set(k, {surah: c.surah, ayah: c.ayah, word: c.word, kind: c.state === 'wrong' ? 'wrong' : 'missed', status: 'suspect', since: book.get(k)?.since ?? now, lastBadAt: now});
      }
      return {book: next, confirmed: []};
    },
  };
  const run = {
    log: [{type: 'word_progress', t: 1}],
    flags: [],
    vchanges: [
      {t: 2, id: '1:1:1', to: 'wrong'},
      {t: 2.4, id: '1:1:1', to: 'skipped'},
    ],
  };
  const out = replayDetail(run, rules);
  assert.deepEqual(out.get('1:1:1'), {since: 2, shownAt: 2.5, kind: 'missed', lastBad: 2.4});
});
