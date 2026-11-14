/* eslint-env node, es2020 */
// The vocabulary's heap, and its longest step, in a plain interpreter. Run live_order or
// rule_parity first: they compile addedWord.ts to the folder this reads.
//   node --jitless --expose-gc stack/vocab_mem.mjs
import fs from 'node:fs';
import path from 'node:path';
const BENCH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
);
const PORT = path.join(BENCH, '.out/engine-stack/port');
const {QuranCorpus} = await import(
  path.join(BENCH, '.out/engine-stack/dist/recitation/corpus.js')
);
const {buildVocab} = await import(path.join(PORT, 'addedWord.mjs'));
const corpus = new QuranCorpus(
  JSON.parse(
    fs.readFileSync(
      path.join(BENCH, '.out/assets/zipformer_quran.json'),
      'utf8',
    ),
  ),
);
// The first build warms the interpreter up; the second is the one measured.
await buildVocab(corpus, async () => undefined);
globalThis.gc();
const before = process.memoryUsage().heapUsed;
let last = performance.now();
const steps = [];
const t0 = last;
const vocab = await buildVocab(corpus, async () => {
  const n = performance.now();
  steps.push(n - last);
  last = n;
});
const total = performance.now() - t0;
globalThis.gc();
const after = process.memoryUsage().heapUsed;
steps.sort((a, b) => a - b);
console.log(
  JSON.stringify({
    words: corpus.wordCount,
    exact: vocab.exact.size,
    loose: vocab.loose.size,
    totalMs: +total.toFixed(1),
    steps: steps.length,
    medianStepMs: +steps[Math.floor(steps.length / 2)].toFixed(2),
    worstStepMs: +steps[steps.length - 1].toFixed(2),
    heapMB: +((after - before) / 1e6).toFixed(2),
  }),
);
