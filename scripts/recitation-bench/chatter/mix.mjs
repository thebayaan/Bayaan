/* eslint-env node, es2020 */
// Adds chatter behind a recitation at a chosen level difference. The recitation
// is only added to: no cut, fade, filter, echo or speed change. A mix that would
// clip is scaled down as a whole.
import crypto from 'node:crypto';

const FRAME = 320; // 20 ms at 16 kHz

/**
 * Mean level of the frames that hold sound, in dB. Long pauses would otherwise
 * make a reciter look quieter, and level differences would mean little.
 */
export function activeLevelDb(x) {
  const energy = [];
  for (let start = 0; start + FRAME <= x.length; start += FRAME) {
    let sum = 0;
    for (let i = start; i < start + FRAME; i++) sum += x[i] * x[i];
    energy.push(sum / FRAME);
  }
  if (!energy.length) return -Infinity;
  const sorted = [...energy].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.95)] * 1e-3;
  const loud = energy.filter(e => e > 0 && e >= floor);
  if (!loud.length) return -Infinity;
  return 10 * Math.log10(loud.reduce((a, b) => a + b, 0) / loud.length);
}

/** @returns {{mix: Float32Array, gain: number, scale: number}} */
export function mixAtSnr(speech, chatter, snrDb) {
  if (!chatter) return {mix: speech, gain: 0, scale: 1};
  const gain =
    10 ** ((activeLevelDb(speech) - snrDb - activeLevelDb(chatter)) / 20);
  const mix = new Float32Array(speech.length);
  let peak = 0;
  for (let i = 0; i < speech.length; i++) {
    mix[i] = speech[i] + gain * chatter[i];
    peak = Math.max(peak, Math.abs(mix[i]));
  }
  let scale = 1;
  if (peak > 1) {
    scale = 0.99 / peak;
    for (let i = 0; i < mix.length; i++) mix[i] *= scale;
  }
  return {mix, gain, scale};
}

/** Where a clip's chatter starts: repeatable, and different per clip and track. */
export function windowOffset(id, track, trackLength) {
  const hash = crypto.createHash('md5').update(`${id}|${track}`).digest();
  return hash.readUIntBE(0, 6) % trackLength;
}

/** n samples of the track from offset, wrapping past its end. */
export function takeWindow(track, offset, n) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = track[(offset + i) % track.length];
  return out;
}
