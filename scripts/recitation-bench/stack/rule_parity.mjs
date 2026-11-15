/* eslint-env node, es2020 */
// The TypeScript added-word rule against the bench's rule.mjs, on every gap the added-word
// job's runs recorded: same reason, gap by gap.
//   node rule_parity.mjs
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const BENCH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
);
const ROOT = path.resolve(BENCH, '../..');
const require = createRequire(path.join(ROOT, 'package.json'));
const ts = require('typescript');
const OUT = path.join(BENCH, '.out/engine-stack/port');
fs.mkdirSync(OUT, {recursive: true});
const src = fs
  .readFileSync(path.join(ROOT, 'services/recitation/addedWord.ts'), 'utf8')
  .replace(
    "from './followerConstants.npl.json'",
    `from '${path.join(OUT, 'constants.mjs')}'`,
  );
fs.writeFileSync(
  path.join(OUT, 'constants.mjs'),
  `export default ${fs.readFileSync(path.join(ROOT, 'services/recitation/followerConstants.npl.json'), 'utf8')}`,
);
fs.writeFileSync(
  path.join(OUT, 'addedWord.mjs'),
  ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText,
);
const port = await import(path.join(OUT, 'addedWord.mjs'));
const rule = await import(path.join(BENCH, 'added/rule.mjs'));
const {QuranCorpus} = await import(
  path.join(BENCH, '.out/engine-stack/dist/recitation/corpus.js')
);
const {costTable} = await import(
  path.join(BENCH, '.out/engine-stack/dist/recitation/phonemeCost.js')
);
const {readPacked, words, index} = await import(
  path.join(BENCH, 'added/lib.mjs')
);
const corpus = new QuranCorpus(
  JSON.parse(
    fs.readFileSync(
      path.join(BENCH, '.out/assets/zipformer_quran.json'),
      'utf8',
    ),
  ),
);
const table = costTable();
const vocabRule = rule.buildVocab(words);
const vocabPort = await port.buildVocab(corpus, async () => undefined);
const same = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
console.log(
  JSON.stringify({
    vocabExactSame: same(vocabRule.exact, vocabPort.exact),
    vocabLooseSame: same(vocabRule.loose, vocabPort.loose),
    exact: vocabPort.exact.size,
    loose: vocabPort.loose.size,
  }),
);
const ctx = {corpus, table, vocab: vocabPort};
const P = rule.DEFAULTS;
const cache = new Map();
const tally = {};
let gaps = 0,
  differ = 0,
  passed = 0,
  suites = 0;
const packedDir = path.join(BENCH, '.out/added/packed');
const names = fs
  .readdirSync(packedDir)
  .filter(n => n.endsWith('.jsonl.gz'))
  .map(n => n.replace('.jsonl.gz', ''));
for (const name of names) {
  suites += 1;
  for (const run of readPacked(name)) {
    for (const g of run.probe?.gaps ?? []) {
      const key = `${g.left}|${g.id}|${g.chars}|${g.prev}|${g.fitL}|${g.fitR}|${g.noGap}`;
      if (cache.has(key)) continue;
      cache.set(key, 1);
      gaps += 1;
      const tf = rule.textFeatures(g, words, index, table, P, vocabRule);
      const want = rule.rejectReason(g, tf, P);
      const [s, a, w] = g.left.split(':').map(Number);
      const [s2, a2, w2] = g.id.split(':').map(Number);
      const got = port.rejectReason(
        {...g, leftWord: corpus.wordIndex(s, a, w)},
        corpus.wordIndex(s2, a2, w2),
        ctx,
      );
      tally[want ?? 'pass'] = (tally[want ?? 'pass'] ?? 0) + 1;
      if (!want) passed += 1;
      if ((want ?? null) !== got) {
        differ += 1;
        if (differ <= 10)
          console.log(
            'DIFF',
            JSON.stringify({
              left: g.left,
              id: g.id,
              want,
              got,
              fitL: g.fitL,
              fitR: g.fitR,
              noGap: g.noGap,
              sounds: port.soundCount(g.chars),
            }),
          );
      }
    }
  }
}
console.log(
  JSON.stringify({suites, distinctGaps: gaps, differ, passed, tally}),
);
