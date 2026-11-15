/* eslint-env node, es2020 */
// Writes this job's copies of the second-look tools, with only their paths changed, because
// those files are frozen and their imports and output paths cannot be changed from outside:
// importing replay_marks.mjs compiles a temporary file under .out/second-look, and
// judge_rows.mjs and eval_marks.mjs take their suite table and audio from ./lib.mjs. Every
// change below must match exactly once in the frozen file or this stops. Then it writes the
// diff of each copy against its original to .out/chatter/learners_built/copies.diff.
//   node chatter/learners_built_make_copies.mjs
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const LOOK = path.resolve(HERE, '../../second-look');
const OUT = path.resolve(HERE, '../.out/chatter/learners_built');

const JUDGE_IMPORTS = [
  ["'../recitation-bench/judge/fbank.mjs'", "'../judge/fbank.mjs'"],
  ["'../recitation-bench/judge/judge.mjs'", "'../judge/judge.mjs'"],
  ["} from './lib.mjs';", "} from './learners_built_lib.mjs';"],
];
const MODEL_IMPORT = [
  `import {
  loadModel,
  sliceFrames,
  MIN_FRAMES,
} from '../recitation-bench/judge/model.mjs';`,
  `import {sliceFrames, MIN_FRAMES} from '../judge/model.mjs';`,
];

const COPIES = {
  'replay_marks.mjs': {
    to: 'learners_built_replay.mjs',
    changes: [
      [
        "const BENCH = path.resolve(HERE, '../recitation-bench');",
        "const BENCH = path.resolve(HERE, '..');",
      ],
      [
        '`.out/second-look/wordMarks.${process.pid}.mjs`',
        '`.out/chatter/learners_built/wordMarks.${process.pid}.mjs`',
      ],
    ],
  },
  'chain.mjs': {
    to: 'learners_built_chain.mjs',
    changes: [
      ["'../recitation-bench/judge/policy.mjs'", "'../judge/policy.mjs'"],
      ["'./replay_marks.mjs'", "'./learners_built_replay.mjs'"],
    ],
  },
  'judge_rows.mjs': {
    to: 'learners_built_judge_rows.mjs',
    changes: [
      MODEL_IMPORT,
      ...JUDGE_IMPORTS,
      ["'./chain.mjs'", "'./learners_built_chain.mjs'"],
      ['  LEFT,\n', '  LEFT,\n  loadModel,\n'],
    ],
  },
  'eval_marks.mjs': {
    to: 'learners_built_eval_marks.mjs',
    changes: [
      MODEL_IMPORT,
      ...JUDGE_IMPORTS,
      ["'./cancel.mjs'", "'../../second-look/cancel.mjs'"],
      ["} from './chain.mjs';", "} from './learners_built_chain.mjs';"],
      ["'./replay_marks.mjs'", "'./learners_built_replay.mjs'"],
      ["} from './rule.mjs';", "} from '../../second-look/rule.mjs';"],
      ['  FIRST_WITHIN,\n', '  FIRST_WITHIN,\n  loadModel,\n'],
    ],
  },
};

let all = '';
for (const [from, {to, changes}] of Object.entries(COPIES)) {
  const original = path.join(LOOK, from);
  let text = fs.readFileSync(original, 'utf8');
  for (const [a, b] of changes) {
    const n = text.split(a).length - 1;
    if (n !== 1) throw new Error(`${from}: ${JSON.stringify(a)} matches ${n} times`);
    text = text.replace(a, () => b);
  }
  const file = path.join(HERE, to);
  fs.writeFileSync(file, text);
  const d = spawnSync('diff', ['-u', original, file], {encoding: 'utf8'});
  all += d.stdout
    .split(path.resolve(HERE, '../../..') + '/')
    .join('')
    .replace(/^(---|\+\+\+) (\S+)\t.*$/gm, '$1 $2');
  console.log(`${from} -> ${to}: ${changes.length} changes`);
}
fs.mkdirSync(OUT, {recursive: true});
fs.writeFileSync(path.join(OUT, 'copies.diff'), all);
