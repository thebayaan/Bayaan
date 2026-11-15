/* eslint-env node, es2020 */
// Why the app and the stand-in differ on a mark. Plays each differing run again with its
// trace kept, and prints, for the word and its neighbours, what the stand-in knew beside
// what the app's trace says. Word positions and numbers only. Run after compare.mjs.
//   node scripts/second-look/repro/explain.mjs [tag]
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {OUT} from '../lib.mjs';

const tag = process.argv[2] ? `.${process.argv[2]}` : '';
const REPRO = path.join(OUT, 'repro');
const {differences} = JSON.parse(
  fs.readFileSync(path.join(REPRO, `compare${tag}.json`), 'utf8'),
);
const CFG = {
  off: 'J.none',
  s1: 'S1.P3',
  s2: 'S2.P4',
  s1s: 'S1.P3s',
  s2s: 'S2.P4s',
};
const bySuite = new Map();
for (const d of differences) {
  if (!bySuite.has(d.suite)) bySuite.set(d.suite, new Set());
  bySuite.get(d.suite).add(d.run);
}
const explainTag = `explain${tag.replace('.', '_')}`;
for (const [suite, runs] of bySuite) {
  const file = path.join(REPRO, `${suite}.${explainTag}.jsonl`);
  fs.rmSync(file, {force: true});
  execFileSync(
    'node',
    [
      path.join(path.dirname(new URL(import.meta.url).pathname), 'run.mjs'),
      '--suite',
      suite,
      '--tag',
      explainTag,
      '--trace',
      '1',
      '--only',
      [...runs].join(','),
    ],
    {
      stdio: 'ignore',
      env: {...process.env, ORT_THREADS: '1', ORT_ARENA: '0'},
    },
  );
  const traces = new Map(
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(l => {
        const r = JSON.parse(l);
        return [r.id, r];
      }),
  );
  const stands = new Map();
  for (const l of fs
    .readFileSync(path.join(OUT, 'marks', `${suite}.jsonl`), 'utf8')
    .split('\n')) {
    if (!l) continue;
    const m = /^\{"id":"([^"]+)"/.exec(l);
    if (m && runs.has(m[1])) stands.set(m[1], JSON.parse(l));
  }
  const seen = new Set();
  for (const d of differences) {
    if (d.suite !== suite) continue;
    const key = `${d.run}|${d.word}|${d.config}|${d.per}|${d.mode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const [s, a, w] = d.word.split(':').map(Number);
    const name = `${s}:${a} word ${w + 1}`;
    const stand = stands.get(d.run);
    const per = d.per === '-' ? '0.25' : d.per;
    const trace =
      traces.get(d.run)?.cfg[d.config]?.[per]?.[d.mode]?.trace ?? [];
    console.log(
      `\n=== ${suite} ${d.run} ${d.word}, ${d.config} ${d.per} ${d.mode}: ${d.side}`,
    );
    const row = stand?.cfg[CFG[d.config]][d.mode];
    console.log(
      ' stand-in checks:',
      JSON.stringify(row?.checks.filter(c => c.id === d.word)),
    );
    const feats = Object.entries(stand?.features.judge ?? {}).filter(([k]) =>
      k.startsWith(`${d.word}|`),
    );
    console.log(' stand-in first passes:', JSON.stringify(feats));
    for (const line of trace) {
      if (
        line.includes(name) ||
        /^engine (lost|idle|locate|completed)/.test(line)
      ) {
        console.log(`   ${line}`);
      }
    }
  }
}
