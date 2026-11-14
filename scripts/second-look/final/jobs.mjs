/* eslint-env node, es2020 */
// Writes the job lists of the final read for ../run_queue.mjs: the real pass and the
// playback of each suite, two shards each. The held-out suites go in their own lists, so
// nothing reads them before everything else is written down.
//   node scripts/second-look/final/jobs.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {FINAL, SUITES} from './suites.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const real = path.join(HERE, 'real_pass.mjs');
const play = path.join(HERE, 'play.mjs');
const ORDER = [
  'live_control',
  'live_last',
  'interior',
  'added_kept',
  'added_app',
  'sobolev_multi',
  'learners',
  'sites',
  'sites_control',
  'w1',
  'w1_control',
  'w5',
  'pool',
  'quranmb',
  ...Object.keys(SUITES).filter(s => s.startsWith('voices_')),
];
const held = Object.keys(SUITES).filter(s => s.startsWith('heldout_'));
const shards = (script, suites) =>
  suites.flatMap(s =>
    ['0/2', '1/2'].map(shard => [script, '--suite', s, '--shard', shard]),
  );
const write = (name, list) =>
  fs.writeFileSync(path.join(FINAL, name), JSON.stringify(list, null, 0));
write('jobs_real.json', shards(real, ORDER));
write('jobs_play.json', shards(play, ORDER));
write('jobs_real_heldout.json', shards(real, held));
write('jobs_play_heldout.json', shards(play, held));
console.log(ORDER.length, held.length);
