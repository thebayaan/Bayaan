/* eslint-env node, es2020 */
// node --test scripts/second-look/final/test_common.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {checksOf, placesOfStream, resumeAt} from './common.mjs';
import {cellOf} from './suites.mjs';

test('a word is known only from the chunk that logged it', () => {
  let heard = -1;
  const places = placesOfStream(
    {
      '2:3:0': [
        [4, 10, 20],
        [6, 11, 21],
      ],
    },
    [],
    [],
    () => heard,
  );
  const word = {surah: 2, ayah: 3, word: 0};
  assert.equal(places.wordFrames(word), null);
  heard = 3;
  assert.equal(places.wordFrames(word), null);
  heard = 4;
  assert.deepEqual(places.wordFrames(word), {from: 10, to: 20});
  heard = 9;
  assert.deepEqual(places.wordFrames(word), {from: 11, to: 21});
});

test('a word the trackers lost again reads as unknown', () => {
  const places = placesOfStream(
    {
      '2:3:0': [
        [1, 10, 20],
        [2, null, null],
      ],
    },
    [],
    [],
    () => 5,
  );
  assert.equal(places.wordFrames({surah: 2, ayah: 3, word: 0}), null);
});

test('the cursor enters an ayah at the end of its first chunk there', () => {
  let heard = 0;
  const msgs = [
    [1, {type: 'word_progress', surah: 2, ayah: 3}],
    [2, {type: 'word_progress', surah: 2, ayah: 3}],
  ];
  const places = placesOfStream({}, msgs, [0.48, 0.96, 1.44], () => heard);
  assert.equal(places.ayahEnteredAt(2, 3), null);
  heard = 2;
  assert.equal(places.ayahEnteredAt(2, 3), 0.96);
  assert.equal(places.ayahEnteredAt(2, 4), null);
});

test('a stream resumes after its last finished line, not a torn one', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'final-'));
  const file = path.join(dir, 's.jsonl');
  assert.deepEqual(resumeAt(file).offset, 0);
  fs.writeFileSync(`${file}.done`, 'a\t10\nb\t25\n');
  const {done, offset} = resumeAt(file);
  assert.deepEqual([...done], ['a', 'b']);
  assert.equal(offset, 25);
  fs.rmSync(dir, {recursive: true});
});

test('the take summary line gives its counts', () => {
  const stats = checksOf([
    'other',
    'checks this take: 7 wakes (2 step 2 only), 5 first passes (1 not needed), 3 padded looks, 8 model runs; first pass median 1 max 2 ms, padded median 3 max 4 ms; 2 shown, 1 cancelled, 0 failed open; 0 timeouts, 1 dropped (1 step 2), queue max 4; follower backlog now 0 max 0',
  ]);
  assert.equal(stats.wakes, 7);
  assert.equal(stats.step2, 2);
  assert.equal(stats.runs, 8);
  assert.equal(stats.padded, 3);
  assert.equal(stats.droppedStep2, 1);
  assert.equal(stats.queueMax, 4);
});

test('cells: same split on both sides or mixed', () => {
  assert.equal(cellOf({reciterSplit: 'dev', blockSplit: 'dev'}), 'dev');
  assert.equal(cellOf({reciterSplit: 'test', pairSplit: 'test'}), 'test');
  assert.equal(cellOf({reciterSplit: 'dev', pairSplit: 'test'}), 'mixed');
  assert.equal(cellOf({reciterSplit: 'test'}), 'test');
});
