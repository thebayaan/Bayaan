// The suites' plumbing: the mix rebuilt in memory, the judge's slice, and which runs a
// suite may read.
//   node --test scripts/second-look/tests/test_lib.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {mixAtSnr, takeWindow} from '../../recitation-bench/chatter/mix.mjs';
import {
  SUITES,
  fileOf,
  judgeSlice,
  placesOf,
  rebuildMix,
  suiteRunIds,
  wakesJudge,
} from '../lib.mjs';

const speechLike = (n, seed) => {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++)
    out[i] = 0.3 * Math.sin(i * 0.01 * seed) * (i % 3200 < 2400 ? 1 : 0.01);
  return out;
};

test('the mix rebuilt from its record equals the mix the run heard, clipping scale included', () => {
  const reader = speechLike(16000, 3);
  const track = speechLike(24000, 7);
  const offset = 20000;
  const {mix, gain, scale} = mixAtSnr(
    reader,
    takeWindow(track, offset, reader.length),
    -12,
  );
  assert.ok(scale < 1, 'the case must scale');
  const again = rebuildMix(reader, track, {track: 'x', offset, gain, scale});
  assert.deepEqual([...again], [...mix]);
});

test('no track, or no gain, is the reader alone', () => {
  const reader = speechLike(1000, 3);
  assert.equal(
    rebuildMix(reader, null, {track: 'none', gain: 0, scale: 1}),
    reader,
  );
});

const flushed = {
  flush: {
    words: [
      {id: '2:3:0', from: 100, to: 110},
      {id: '2:3:4', from: 200, to: 220},
      {id: '2:4:0', from: 250, to: 260},
    ],
  },
  log: [{type: 'word_progress', key: '2:5', t: 30}],
  summary: {seconds: 60},
};

test("the judge's slice: inside the ayah, ending one chunk after the verdict", () => {
  const places = placesOf(flushed);
  const {start, end} = judgeSlice(places, '2:3:2', 7, 0.48, 60 * 16000);
  // Tracker's first word at frame 100, minus the lag, the cut and no ayah before it.
  assert.equal(start, Math.round((100 * 0.04 - 0.23 - 1) * 16000));
  assert.equal(end, Math.round(7.48 * 16000));
});

test("the judge's slice stops at the next ayah, but not before the verdict", () => {
  const places = placesOf(flushed);
  const next = 250 * 0.04 - 0.23;
  const late = judgeSlice(places, '2:3:4', next + 1, 0.48, 60 * 16000);
  assert.equal(late.end, Math.round((next + 1) * 16000));
  const early = judgeSlice(places, '2:3:4', next - 0.4, 0.48, 60 * 16000);
  assert.equal(early.end, Math.round((next + 0.08) * 16000));
});

test('hold 0 ends the slice at the verdict', () => {
  const places = placesOf(flushed);
  assert.equal(judgeSlice(places, '2:3:2', 7, 0, 60 * 16000).end, 7 * 16000);
});

test('with no tracker frames the slice starts from when the cursor came in', () => {
  const places = placesOf({...flushed, flush: undefined});
  const {start} = judgeSlice(places, '2:5:1', 32, 0.48, 60 * 16000);
  assert.equal(start, Math.round((30 - 1.5 - 1) * 16000));
});

test('a slice too short means the places were wrong: the last 3 s', () => {
  const places = placesOf(flushed);
  const {start, end} = judgeSlice(places, '2:3:2', 3, 0.48, 60 * 16000);
  assert.equal(end, Math.round(3.48 * 16000));
  assert.equal(start, end - 3 * 16000);
});

test('what wakes the judge at all: Step 2 is the widest', () => {
  assert.equal(wakesJudge({to: 'pending'}), false);
  assert.equal(wakesJudge({to: 'wrong'}), true);
  assert.equal(wakesJudge({to: 'skipped'}), true);
  assert.equal(wakesJudge({to: 'unsure'}), true);
  assert.equal(wakesJudge({to: 'ok', d: {gop: -1.5}}), true);
  assert.equal(wakesJudge({to: 'ok', d: {gop: -1.4}}), false);
  assert.equal(wakesJudge({to: 'ok', d: {gop: null, distance: 0.2}}), true);
  assert.equal(wakesJudge({to: 'ok', d: {gop: null, distance: 0}}), false);
});

test('file names follow the runner: anything but word characters, dots and dashes', () => {
  assert.equal(fileOf('quranmb/00000_00001'), 'quranmb_00000_00001.json');
});

test('tuning data only: no suite lists a run from a test cell', () => {
  for (const name of ['pool', 'w1', 'interior']) {
    for (const row of suiteRunIds(name, true)) {
      assert.equal(row.truth.reciterSplit, 'dev', row.id);
      assert.equal(row.truth.pairSplit ?? row.truth.blockSplit, 'dev', row.id);
    }
  }
  for (const name of ['w5', 'live_last', 'live_control']) {
    for (const row of suiteRunIds(name, true))
      assert.equal(row.truth.reciterSplit, 'dev', row.id);
  }
});

test('every suite says what its rows and modes are', () => {
  for (const [name, s] of Object.entries(SUITES)) {
    assert.ok(Array.isArray(s.modes), name);
    assert.ok(typeof s.dir === 'function' || typeof s.dir === 'string', name);
  }
});

test("the tracker's frames count from the decoder's last restart", () => {
  const run = {
    flush: {words: [{id: '5:116:0', from: 50, to: 60}]},
    log: [
      {type: 'word_progress', key: '5:116', t: 1},
      {type: 'debug', event: 'located', t: 1},
      {type: 'debug', event: 'idle', t: 29.76},
      {type: 'debug', event: 'located', t: 35.04},
      {type: 'debug', event: 'idle', t: 90, stop: true},
    ],
  };
  const {tracked} = placesOf(run);
  const word = tracked.get('5:116:0');
  assert.equal(word.from, 50 + 29.76 * 25);
  assert.equal(word.to, 60 + 29.76 * 25);
});

test('a surah finished at the end: the tracker kept is from before that restart', () => {
  const run = {
    flush: {words: [{id: '1:7:0', from: 50, to: 60}]},
    log: [
      {type: 'debug', event: 'idle', t: 10},
      {type: 'debug', event: 'located', t: 12},
      {type: 'debug', event: 'completed', t: 40},
    ],
  };
  assert.equal(placesOf(run).tracked.get('1:7:0').from, 50 + 10 * 25);
});

test('with no restart, the frames are as they were', () => {
  const run = {
    flush: {words: [{id: '1:7:0', from: 50, to: 60}]},
    log: [{type: 'debug', event: 'located', t: 2}],
  };
  assert.equal(placesOf(run).tracked.get('1:7:0').from, 50);
});
