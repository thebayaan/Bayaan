/* eslint-env node, es2020 */
// The JavaScript features against two references, on a real recording, a short
// slice and a stretch of digital silence.
//
//   PY=<venv with numpy and kaldi-native-fbank>/bin/python node --test judge/test_fbank.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fbank, NUM_BINS} from './fbank.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PY = process.env.PY;
// Any staged recording will do: the first reciter's second ayah.
const ROOT = path.join(HERE, '../.out/natural/audio');
const AUDIO = path.join(ROOT, fs.readdirSync(ROOT).sort()[0], '1_2.f32');

function compare(name, wave) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fbank-'));
  const input = path.join(dir, 'in.f32');
  fs.writeFileSync(input, Buffer.from(wave.buffer, wave.byteOffset, wave.byteLength));
  execFileSync(PY, ['-I', path.join(HERE, 'fbank_reference.py'), input, path.join(dir, 'out')]);
  const {data, frames} = fbank(wave);
  const out = {};
  for (const ref of ['numpy', 'knf']) {
    const buf = fs.readFileSync(path.join(dir, `out.${ref}.f32`));
    const r = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
    assert.equal(r.length, frames * NUM_BINS, `${name}: ${ref} frames`);
    let worst = 0;
    let sum = 0;
    for (let i = 0; i < r.length; i++) {
      const d = Math.abs(r[i] - data[i]);
      sum += d;
      if (d > worst) worst = d;
    }
    out[ref] = {worst, mean: sum / r.length};
  }
  fs.rmSync(dir, {recursive: true});
  console.log(name, frames, 'frames', JSON.stringify(out));
  return out;
}

// Log-mel values, so 0.005 is half a percent of energy, reached only by a rare bin
// near the floor, where float32 and float64 rounding differ. The mean stays far lower.
function assertClose(out) {
  for (const ref of ['numpy', 'knf']) {
    assert.ok(out[ref].worst < 5e-3, JSON.stringify(out));
    assert.ok(out[ref].mean < 2e-5, JSON.stringify(out));
  }
}

test('a whole recording', {skip: !PY}, () => {
  const buf = fs.readFileSync(AUDIO);
  const wave = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  const out = compare('recording', wave);
  assertClose(out);
});

test('a slice cut anywhere', {skip: !PY}, () => {
  const buf = fs.readFileSync(AUDIO);
  const wave = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  const out = compare('slice', wave.slice(12345, 12345 + 16000 * 2 + 77));
  assertClose(out);
});

test('digital silence hits the log floor', {skip: !PY}, () => {
  const wave = new Float32Array(16000);
  const out = compare('silence', wave);
  assert.ok(out.numpy.worst < 1e-5, JSON.stringify(out));
});
