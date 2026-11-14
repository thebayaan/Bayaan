/* eslint-env node, es2020 */
// node --test chatter/test_mix.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import {activeLevelDb, mixAtSnr, takeWindow, windowOffset} from './mix.mjs';

const SR = 16000;

/** A sine that plays for `on` seconds and rests for `off`, for `seconds`. */
function bursts(amp, freq, on, off, seconds) {
  const x = new Float32Array(seconds * SR);
  const period = (on + off) * SR;
  for (let i = 0; i < x.length; i++) {
    if (i % period < on * SR) x[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  }
  return x;
}

test('active level ignores the silence between bursts', () => {
  const x = bursts(0.1, 440, 1, 1, 20);
  const sineLevel = 20 * Math.log10(0.1 / Math.SQRT2);
  assert.ok(Math.abs(activeLevelDb(x) - sineLevel) < 0.3, `${activeLevelDb(x)}`);
});

test('active level does not move when the pauses get longer', () => {
  const short = activeLevelDb(bursts(0.1, 440, 1, 0.5, 30));
  const long = activeLevelDb(bursts(0.1, 440, 1, 4, 30));
  assert.ok(Math.abs(short - long) < 0.3, `${short} vs ${long}`);
});

test('mix reaches the requested level difference', () => {
  const speech = bursts(0.2, 300, 1, 1, 20);
  const chatter = bursts(0.05, 700, 0.7, 0.3, 20);
  for (const snr of [15, 10, 5, 0]) {
    const {gain} = mixAtSnr(speech, chatter, snr);
    const scaled = chatter.map(v => v * gain);
    const got = activeLevelDb(speech) - activeLevelDb(scaled);
    assert.ok(Math.abs(got - snr) < 0.1, `wanted ${snr}, got ${got}`);
  }
});

test('the recitation is only ever added to, never changed', () => {
  const speech = bursts(0.2, 300, 1, 1, 10);
  const chatter = bursts(0.05, 700, 0.7, 0.3, 10);
  const {mix, gain, scale} = mixAtSnr(speech, chatter, 10);
  assert.equal(scale, 1);
  for (let i = 0; i < speech.length; i += 97) {
    assert.ok(Math.abs(mix[i] - gain * chatter[i] - speech[i]) < 1e-6);
  }
});

test('a mix that would clip is scaled as a whole', () => {
  const speech = bursts(0.95, 300, 1, 1, 10);
  const chatter = bursts(0.9, 700, 1, 0, 10);
  const {mix, scale} = mixAtSnr(speech, chatter, 0);
  assert.ok(scale < 1);
  assert.ok(mix.reduce((peak, v) => Math.max(peak, Math.abs(v)), 0) <= 1);
});

test('no chatter returns the recitation sample for sample', () => {
  const speech = bursts(0.2, 300, 1, 1, 5);
  const {mix, gain, scale} = mixAtSnr(speech, null, 10);
  assert.equal(gain, 0);
  assert.equal(scale, 1);
  assert.deepEqual(Array.from(mix), Array.from(speech));
});

test('the window is repeatable, in range, and differs by clip and track', () => {
  const a = windowOffset('clip-a', 'one_ar', 100000);
  assert.equal(a, windowOffset('clip-a', 'one_ar', 100000));
  assert.ok(a >= 0 && a < 100000);
  assert.notEqual(a, windowOffset('clip-b', 'one_ar', 100000));
  assert.notEqual(a, windowOffset('clip-a', 'crowd', 100000));
});

test('a window past the end of the track wraps around', () => {
  const track = Float32Array.from([1, 2, 3, 4, 5]);
  assert.deepEqual(Array.from(takeWindow(track, 3, 4)), [4, 5, 1, 2]);
  assert.deepEqual(Array.from(takeWindow(track, 0, 12)), [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2]);
});
