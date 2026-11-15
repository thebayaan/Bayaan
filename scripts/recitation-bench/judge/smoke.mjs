/* eslint-env node, es2020 */
// First look: inputs, outputs and the greedy text of a few recordings.
import path from 'node:path';
import {loadModel, loadTokens, greedy, readF32} from './model.mjs';
const m = await loadModel();
console.log('inputs', m.session.inputNames, 'outputs', m.session.outputNames);
const tokens = loadTokens();
for (const file of process.argv.slice(2)) {
  const wave = readF32(file);
  const r = await m.run(wave);
  const g = greedy(r.logp, r.frames, tokens);
  console.log(
    path.basename(file),
    `${(wave.length / 16000).toFixed(2)}s frames=${r.frames} feat=${r.featureMs.toFixed(1)}ms ort=${r.ortMs.toFixed(1)}ms`,
    g.text,
  );
}
