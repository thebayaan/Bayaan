// The played-back follower keeps the clock the real session keeps across a restart.
//   node --test scripts/second-look/tests/test_repro_engine.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {melFramesOf, placesFrom, restartChunks} from '../repro/engine.mjs';

const CHUNK = 7680;
const wave = n =>
  Float32Array.from({length: n}, (_, i) =>
    Math.fround(0.2 * Math.sin(i * 0.05) * (1 + Math.sin(i * 0.0007))),
  );
const row = (mel, f) => mel.data.subarray(f * 80, (f + 1) * 80);

test('with no restart, the frames are one pass over the stream', () => {
  const mel = melFramesOf(wave(CHUNK * 4));
  assert.equal(mel.upTo[0], CHUNK / 160 - 1);
  assert.equal(mel.upTo[1], (2 * CHUNK) / 160 - 1);
});

test('a restart keeps the frame numbers, repeating the frame that spans it', () => {
  const audio = wave(CHUNK * 4);
  const whole = melFramesOf(audio);
  const mel = melFramesOf(audio, new Set([1]));
  const restart = (2 * CHUNK) / 160;
  assert.equal(mel.upTo[1], restart - 1);
  assert.equal(mel.upTo[2], restart + CHUNK / 160 - 1);
  // Before it, and from the second frame after it, nothing differs.
  assert.deepEqual([...row(mel, restart - 2)], [...row(whole, restart - 2)]);
  assert.deepEqual([...row(mel, restart + 1)], [...row(whole, restart + 1)]);
  // The frame that spanned it repeats the last one before it.
  assert.deepEqual([...row(mel, restart - 1)], [...row(mel, restart - 2)]);
});

test('restartChunks names the chunks whose events restart the decoder', () => {
  const playback = {
    events: [
      {messages: []},
      {messages: [{type: 'debug', event: 'idle'}]},
      {messages: [{type: 'debug', event: 'located'}]},
      {messages: [{type: 'debug', event: 'completed'}]},
    ],
  };
  assert.deepEqual([...restartChunks(playback)], [1, 3]);
});

test('word places known at a moment count from the restart before it', () => {
  const plain = {
    flush: {words: []},
    log: [{type: 'debug', event: 'idle', t: 10}],
  };
  const marks = {
    probe: {
      framesLog: [
        {t: 5, id: '2:1:0', f: 20, l: 30},
        {t: 12, id: '2:2:0', f: 25, l: 40},
      ],
    },
  };
  let now = 0;
  const clock = {now: () => now};
  const places = placesFrom(plain, marks, 'known', clock, 0);
  now = 20000;
  assert.deepEqual(places.wordFrames({surah: 2, ayah: 1, word: 0}), {
    from: 20,
    to: 30,
  });
  assert.deepEqual(places.wordFrames({surah: 2, ayah: 2, word: 0}), {
    from: 25 + 250,
    to: 40 + 250,
  });
});

test('word places from the end of the take count from its last restart', () => {
  const plain = {
    flush: {words: [{id: '2:2:0', from: 25, to: 40}]},
    log: [{type: 'debug', event: 'idle', t: 10}],
  };
  const places = placesFrom(plain, {}, 'end', {now: () => 0}, 0);
  assert.deepEqual(places.wordFrames({surah: 2, ayah: 2, word: 0}), {
    from: 275,
    to: 290,
  });
});
