/* eslint-env node, es2020 */
// Scores planted runs: what the live check caught and falsely marked, beside what the
// follower's own marks (today's rules, no second model) do on the same recitations.
//
//   node fix2/score_planted.mjs <tag> [--verbose 1] [--nowrite 1]
//
// Reads .out/fix2/planted/<tag>/<name>.s<seed>.json with the truth and follower run next
// to them in .out/fix2/planted, and writes .out/fix2/planted/<tag>/_score.json unless
// --nowrite 1 (summary.py reads batches that may still be running). A live
// mark counts for a mistake when it sits on the word or a neighbour; a mark on the ayah
// of a skipped ayah, or on the first three words of the ayah after it, is explained too.
import fs from 'node:fs';
import path from 'node:path';
import {BENCH, OUT, parseArgs} from './common.mjs';

const {scoreRun} = await import(path.join(BENCH, 'replay2.mjs'));
const args = parseArgs();
const tag = args._[0];
if (!tag) {
  console.error(
    'usage: node fix2/score_planted.mjs <tag> [--verbose 1] [--nowrite 1]',
  );
  process.exit(2);
}
const verbose = !!args.verbose;
const dir = path.join(OUT, 'planted');
const MISTAKES = [
  'wrong_word',
  'skip_word',
  'skip_first_word',
  'skip_last_word',
];
const HARMLESS = [
  'repeat_word',
  'restart_ayah',
  'skip_then_fix',
  'pause',
  'stretch_word',
];
const T = {};
const add = (k, f, n = 1) => {
  T[k] ??= {};
  T[k][f] = (T[k][f] ?? 0) + n;
};
const near = (bad, s, a, w) =>
  bad.filter(b => [-1, 0, 1].some(k => b.key === `${s}:${a}:${w + k}`));
const falseLive = [];
const falseBase = [];
const lat = [];
let files = 0;
let judged = 0;
let seconds = 0;
for (const f of fs.readdirSync(path.join(dir, tag)).sort()) {
  if (!/\.s\d+\.json$/.test(f)) {
    continue;
  }
  const stem = f.replace(/\.json$/, '');
  const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
  const sim = read(path.join(dir, tag, f));
  const truth = read(path.join(dir, `${stem}.truth.json`));
  const run = read(path.join(dir, `${stem}.run.json`));
  files += 1;
  judged += sim.judgedKeys;
  seconds += sim.seconds;
  // A skipped last word is only that when it was the ayah's last timed word.
  const events = truth.events.filter(
    e => e.type !== 'skip_last_word' || e.word === e.words,
  );
  const base = scoreRun(run, events);
  const bad = sim.bad;
  const explained = new Set();
  for (const e of events) {
    const [s, a] = e.key.split(':').map(Number);
    if (MISTAKES.includes(e.type)) {
      const exact = bad.filter(b => b.key === `${s}:${a}:${e.word - 1}`);
      const close = near(bad, s, a, e.word - 1);
      close.forEach(b => explained.add(b));
      add(e.type, 'n');
      if (exact.length) {
        add(e.type, 'liveExact');
      }
      if (close.length) {
        add(e.type, 'liveNear');
        const b = exact[0] ?? close[0];
        lat.push({
          type: e.type,
          s: +(b.t - (b.verdict === 'missed' ? b.from : b.to)).toFixed(2),
        });
      } else if (verbose) {
        console.log(
          `  missed by live: ${stem} ${e.type} ${e.key}:${e.word - 1}`,
        );
      }
    } else if (e.type === 'skip_ayah') {
      add(e.type, 'n');
      for (const b of bad) {
        const [s2, a2, w2] = b.key.split(':').map(Number);
        if (s2 === s && (a2 === a || (a2 === a + 1 && w2 < 3))) {
          explained.add(b);
        }
      }
    } else if (e.type === 'skip_then_fix') {
      add(e.type, 'n');
      const close = near(bad, s, a, e.word - 1);
      if (close.length) {
        add(e.type, 'markedFirstPass');
        close.forEach(b => explained.add(b));
      }
    } else {
      add(e.type, 'n');
    }
  }
  // The follower's own marks on the same events.
  for (const t of base.caught) {
    add(t, 'baseNear');
  }
  for (const m of base.falseMarks) {
    if (!m.corrected) {
      falseBase.push({file: stem, ...m});
    }
  }
  for (const b of bad) {
    if (explained.has(b)) {
      continue;
    }
    const [s, a] = b.key.split(':').map(Number);
    const on = events.find(e => e.key === `${s}:${a}`);
    falseLive.push({
      file: stem,
      key: b.key,
      verdict: b.verdict,
      share: b.share,
      gap: b.gap,
      on: on ? on.type : 'nothing',
    });
  }
}
const pct = (a, b) => (b ? `${((100 * (a ?? 0)) / b).toFixed(1)}%` : '-');
const num = (v, w) => String(v ?? 0).padStart(w);
console.log(
  `${tag}: ${files} recitations, ${(seconds / 3600).toFixed(
    2,
  )} h, ${judged} words judged by the live check`,
);
console.log(
  'event            n   live exact   live near   follower today (near)',
);
for (const t of [...MISTAKES, 'skip_ayah', ...HARMLESS]) {
  const r = T[t];
  if (!r) {
    continue;
  }
  if (MISTAKES.includes(t)) {
    console.log(
      `${t.padEnd(16)} ${num(r.n, 3)}   ${num(r.liveExact, 3)} ${pct(
        r.liveExact,
        r.n,
      ).padStart(6)}   ${num(r.liveNear, 3)} ${pct(r.liveNear, r.n).padStart(
        6,
      )}   ${num(r.baseNear, 3)} ${pct(r.baseNear, r.n).padStart(6)}`,
    );
  } else {
    const note =
      t === 'skip_then_fix'
        ? `first pass marked ${r.markedFirstPass ?? 0}`
        : t === 'skip_ayah'
          ? `follower caught ${r.baseNear ?? 0}`
          : '';
    console.log(`${t.padEnd(16)} ${num(r.n, 3)}   ${note}`);
  }
}
const countBy = list => {
  const out = {};
  for (const m of list) {
    out[m.on] = (out[m.on] ?? 0) + 1;
  }
  return out;
};
console.log(
  `live false marks: ${falseLive.length} = ${(
    (1000 * falseLive.length) /
    Math.max(1, judged)
  ).toFixed(2)} per 1,000 judged; by what they sit on: ${JSON.stringify(
    countBy(falseLive),
  )}`,
);
console.log(
  `follower false marks today: ${falseBase.length}; ${JSON.stringify(
    countBy(falseBase),
  )}`,
);
const ls = lat.map(l => l.s).sort((a, b) => a - b);
if (ls.length) {
  console.log(
    `time from the word to the live mark: median ${
      ls[Math.floor(ls.length / 2)]
    } s, p90 ${ls[Math.floor(ls.length * 0.9)]} s (n=${ls.length})`,
  );
}
if (verbose) {
  for (const m of falseLive) {
    console.log('  false', JSON.stringify(m));
  }
}
if (!args.nowrite) {
  fs.writeFileSync(
    path.join(dir, tag, '_score.json'),
    JSON.stringify({
      tag,
      files,
      judged,
      T,
      falseLive,
      falseBase: falseBase.length,
      lat,
    }),
  );
}
