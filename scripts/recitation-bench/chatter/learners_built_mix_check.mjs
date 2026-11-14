/* eslint-env node, es2020 */
// Rebuilds every take's audio of every condition in memory, as the tools do, and checks it
// against the hash recorded for what the engine heard. Loads no model, keeps no audio. The tools
// run the same check on each take they read audio from; this covers the takes they never needed.
//   node chatter/learners_built_mix_check.mjs
import fs from 'node:fs';
import path from 'node:path';
import {CONDS, OUT, RUNS, audioOf} from './learners_built_lib.mjs';

const out = {};
for (const c of CONDS) {
  const dir = path.join(RUNS, c, 'quranmb');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  let same = 0;
  const differ = [];
  for (const f of files) {
    const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    try {
      audioOf(run);
      same += 1;
    } catch (e) {
      differ.push(`${f}: ${e.message}`);
    }
  }
  out[c] = {takes: files.length, same, differ: differ.length, examples: differ.slice(0, 3)};
  console.log(JSON.stringify({cond: c, ...out[c]}));
}
fs.writeFileSync(path.join(OUT, 'mix_check.json'), JSON.stringify(out, null, 1));
