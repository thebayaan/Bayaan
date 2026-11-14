/* eslint-env node, es2020 */
// Do the replays here give the numbers earlier jobs reported, where they should? Reads
// .out/second-look/tables.json and only the dev cells of the verifier's scoreboard.
//   node scripts/second-look/check_earlier.mjs
import fs from 'node:fs';
import path from 'node:path';
import {BENCH, OUT} from './lib.mjs';

const T = JSON.parse(fs.readFileSync(path.join(OUT, 'tables.json'), 'utf8'));
const V = path.join(BENCH, '.out/natural/verify');
const board = JSON.parse(
  fs.readFileSync(path.join(V, 'scoreboard.json'), 'utf8'),
);
const out = {};
const pctOf = s => Number(/^([0-9.]+)%/.exec(s)?.[1]);
const countOf = s => Number(/^([0-9]+):/.exec(s)?.[1]);

out.w1Dev = {};
for (const place of ['all', 'interior', 'last', 'first', 'close']) {
  const b = board.changed.dev[place];
  const mine = T.w1.carry[place];
  out.w1Dev[place] = {
    events: [b.events, mine.events],
    today: [pctOf(b['today.carry']), mine.cfg['J.none'].pct],
    step1: [pctOf(b['S1.carry']), mine.cfg['S1.none'].pct],
    step2: [pctOf(b['S2.carry']), mine.cfg['S2.none'].pct],
  };
}
const dev = board.pool.dev;
out.poolDev = {
  words: [dev.words, T.pool.words],
  today: [countOf(dev.Jf), T.pool.cfg['J.none'].marks],
  step1: [countOf(dev.JS1f), T.pool.cfg['S1.none'].marks],
  step2: [countOf(dev.JS2f), T.pool.cfg['S2.none'].marks],
};
const w5 = board.w5.dev;
out.w5Dev = {
  words: [w5.words, T.w5.words],
  today: [w5.Jf, T.w5.cfg['J.none'].marks],
  step1: [w5.JS1f, T.w5.cfg['S1.none'].marks],
  step2: [w5.JS2f, T.w5.cfg['S2.none'].marks],
};
const liveRows = JSON.parse(
  fs.readFileSync(path.join(V, 'runs_plain/live_last.rows.json'), 'utf8'),
).filter(r => r.split === 'dev' && !r.control);
out.liveDev = {};
for (const type of ['carry_last_whole', 'carry_last_ctx', 'arrive_first']) {
  const list = liveRows.filter(r => r.type === type);
  const sum = k => list.reduce((x, r) => x + (r[k]?.hit ?? 0), 0);
  out.liveDev[type] = {
    runs: [list.length, T.live[type].events],
    step1: [sum('JS1fixed'), T.live[type].cfg['S1.none'].num],
    step2: [sum('JS2fixed'), T.live[type].cfg['S2.none'].num],
  };
}
// The second look's own report, marks with no judge behind them.
out.voicesSecondLook = {
  note: 'report: before and after the second look now in the app, this replay asks again when a cancelled word goes bad again',
  none_0: {
    report: [15, 5],
    here: [
      T.voices.none_0.cfg['J.none'].marks,
      T.voices.none_0.cfg['J.P1'].marks,
    ],
  },
  one_ar_10: {
    report: [25, 7],
    here: [
      T.voices.one_ar_10.cfg['J.none'].marks,
      T.voices.one_ar_10.cfg['J.P1'].marks,
    ],
  },
  crowd_10: {
    report: [29, 5],
    here: [
      T.voices.crowd_10.cfg['J.none'].marks,
      T.voices.crowd_10.cfg['J.P1'].marks,
    ],
  },
  one_ar_5: {
    report: [64, 33],
    here: [
      T.voices.one_ar_5.cfg['J.none'].marks,
      T.voices.one_ar_5.cfg['J.P1'].marks,
    ],
  },
};
// The letter-slip report, QuranMB, with no judge: its slices ran from the first bad verdict and
// here from the latest, cut to what the app would hold when the mark falls due.
const q = T.quranmb.cfg;
const line = (c, l) => `${q[c][l].kept}/${q[c][l].of}`;
out.quranmbExperiment = {
  shipped: {
    report: {
      hit: '19/66',
      'false-incorrect': '19/70',
      'false-correct': '7/16',
      near: '14/52',
    },
    here: Object.fromEntries(
      ['hit', 'false-incorrect', 'false-correct', 'near'].map(l => [
        l,
        line('J.P1', l),
      ]),
    ),
  },
  rule: {
    report: {
      hit: '42/66',
      'false-incorrect': '4/70',
      'false-correct': '1/16',
      near: '12/52',
    },
    here: Object.fromEntries(
      ['hit', 'false-incorrect', 'false-correct', 'near'].map(l => [
        l,
        line('J.P2', l),
      ]),
    ),
  },
};
fs.writeFileSync(
  path.join(OUT, 'check_earlier.json'),
  JSON.stringify(out, null, 1),
);
console.log(JSON.stringify(out, null, 1));
