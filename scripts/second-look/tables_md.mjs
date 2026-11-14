/* eslint-env node, es2020 */
// The tables of RULE.md as markdown, from .out/second-look/tables.json and voices_combined.json.
//   node scripts/second-look/tables_md.mjs > .out/second-look/tables.md
import fs from 'node:fs';
import path from 'node:path';
import {OUT, VOICE_CONDS, W1INT_CONDS} from './lib.mjs';

const T = JSON.parse(fs.readFileSync(path.join(OUT, 'tables.json'), 'utf8'));
const VC = fs.existsSync(path.join(OUT, 'voices_combined.json'))
  ? JSON.parse(fs.readFileSync(path.join(OUT, 'voices_combined.json'), 'utf8'))
  : {};
const NOISY = VOICE_CONDS.filter(c => c !== 'none_0');
const out = [];
const table = (head, rows) => {
  out.push(`| ${head.join(' | ')} |`);
  out.push(`|${head.map(() => '---').join('|')}|`);
  for (const r of rows) out.push(`| ${r.join(' | ')} |`);
  out.push('');
};
const h = (s, source) => out.push(`### ${s}\n\nFrom: ${source}.\n`);
const TB = 'tables.mjs';
const name = {
  P1: 'P1 app today',
  P2: 'P2 own slice',
  P3: "P3 judge's pass",
  P4: 'P4 skip if identified',
};

function selection(step) {
  const S = T.selection[step];
  const cols = ['P1', 'P2', 'P3', 'P4'];
  const hold = `${S.P5.of} at hold 0`;
  const pick = (c, f) => f(S.metrics[c]);
  const row = (label, f, bestV) => [
    label,
    f(S.noCancel),
    ...cols.map(c => pick(c, f)),
    S.P5 ? f(S.P5.metrics) : '-',
    bestV,
  ];
  const rows = [
    row('real slips kept, of 66', m => m.slips, S.best.slips),
    row('pool dev false marks', m => m.pool, S.best.pool),
    ...['interior', 'last', 'first', 'close'].map(p =>
      row(`W1 ${p}, %`, m => m.w1[p], S.best.w1[p]),
    ),
    ...NOISY.map(v => row(`voices ${v}`, m => m.voices[v], S.best.voices[v])),
  ];
  const pm = c => T.runs.pool[`${step}.${c}`];
  const v5 = c => T.runs.voices_one_ar_5[`${step}.${c}`];
  rows.push([
    'model runs per mark, voices one_ar_5',
    1,
    ...cols.map(c => v5(c).perMark ?? '-'),
    T.runs.voices_one_ar_5[`${step}h0.${S.P5.of}`].perMark ?? '-',
    '',
  ]);
  rows.push([
    'model runs per mark, pool dev',
    1,
    ...cols.map(c => pm(c).perMark ?? '-'),
    T.runs.pool[`${step}h0.${S.P5.of}`].perMark ?? '-',
    '',
  ]);
  table(
    [
      'measure',
      'no cancel step',
      ...cols.map(c => name[c]),
      hold,
      'best of P1 to P4',
    ],
    rows,
  );
  out.push(
    `Outside the limits: ${cols.map(c => `${c}: ${S.why[c].length ? S.why[c].join('; ') : 'none'}`).join('. ')}.\n`,
  );
  out.push(
    `${S.P5.of} at hold 0: ${S.P5.why.length ? S.P5.why.join('; ') : 'none'}.\n`,
  );
  out.push(
    `The fixed rule picks: ${S.winner ?? 'none stands'}. Fewest limits missed: ${S.closest}.\n`,
  );
  const o = S.otherReading;
  out.push(
    `With the 10% read as a share of what today's rules show in each condition: ${o.winner ?? 'none stands'}. Outside the limits there: ${cols.map(c => `${c}: ${o.why[c].length ? o.why[c].join('; ') : 'none'}`).join('. ')}. ${o.P5.of} at hold 0: ${o.P5.why.length ? o.P5.why.join('; ') : 'none'}.\n`,
  );
}
h('Step 1: the selection', `${TB}, key selection.S1; rule in select.mjs`);
selection('S1');
h(
  'Step 2: the selection, same limits',
  `${TB}, key selection.S2; rule in select.mjs`,
);
selection('S2');

h(
  'QuranMB: real slips and false marks kept, by chain (intervals resample speakers and words)',
  `${TB}, key quranmb`,
);
const LAB = ['hit', 'near', 'false-incorrect', 'false-correct'];
const qRow = c => [
  c,
  ...LAB.map(l => {
    const x = T.quranmb.cfg[c][l];
    return `${x.kept}/${x.of}, ${x.ci}`;
  }),
  Object.entries(T.quranmb.cfg[c].added)
    .filter(([k]) => LAB.includes(k))
    .map(([k, v]) => `${k} ${v}`)
    .join(', ') || '-',
];
table(
  ['chain', ...LAB, 'marks not in the base'],
  [
    'J.none',
    'J.P1',
    'J.P2',
    'S1.none',
    'S1.P1',
    'S1.P2',
    'S1.P3',
    'S1.P4',
    'S1h0.none',
    'S1h0.P3',
    'S1h0.P4',
    'S1.P3s',
    'S2.none',
    'S2.P1',
    'S2.P2',
    'S2.P3',
    'S2.P4',
    'S2h0.P4',
    'S2.P4s',
    'N1.none',
    'N1.P2',
    'N1.P3',
    'N1.P4',
    'N2.P3',
    'N2.P4',
  ].map(qRow),
);

h(
  'W1 dev: changed words, marked on the exact word (intervals resample pairs and reciters)',
  `${TB}, key w1`,
);
const places = [
  'all',
  'interior',
  'last',
  'first',
  'close',
  'closeInterior',
  'closeLast',
  'closeFirst',
];
const pick = [
  'J.none',
  'S1.none',
  'S1.P1',
  'S1.P2',
  'S1.P3',
  'S1.P4',
  'S1h0.P3',
  'S2.none',
  'S2.P1',
  'S2.P2',
  'S2.P3',
  'S2.P4',
  'S2h0.P4',
  'N1.P3',
  'N2.P4',
];
for (const mode of ['carry', 'app']) {
  out.push(
    mode === 'carry'
      ? 'With the harness flush and a made-up next word:\n'
      : 'From the clip alone, no flush (last words read 0 here):\n',
  );
  table(
    [
      'chain',
      ...places
        .filter(p => T.w1[mode][p])
        .map(
          p =>
            `${p} (${T.w1[mode][p].events} events, ${T.w1[mode][p].pairs} pairs)`,
        ),
    ],
    pick.map(c => [
      c,
      ...places.filter(p => T.w1[mode][p]).map(p => T.w1[mode][p].cfg[c].ci),
    ]),
  );
}

h(
  'Live path, dev reciters: real next-ayah audio, no flush, no made-up next word',
  `${TB}, keys live and liveControl; close pairs from live_close.py`,
);
const live = [
  'carry_last_whole',
  'carry_last_ctx',
  'last',
  'arrive_first',
  'interior',
  'closeInterior',
  'closeLast',
  'closeFirst',
];
table(
  [
    'chain',
    ...live
      .filter(k => T.live[k])
      .map(k => `${k} (${T.live[k].events} runs, ${T.live[k].pairs} pairs)`),
  ],
  pick.map(c => [
    c,
    ...live.filter(k => T.live[k]).map(k => T.live[k].cfg[c].ci),
  ]),
);
out.push(
  `Same-word controls, ${T.liveControl.runs} runs: ${pick.map(c => `${c} ${T.liveControl.cfg[c]}`).join(', ')}.\n`,
);

h('Pool dev and W5 dev: false marks', `${TB}, keys pool, w5 and w1Unchanged`);
out.push(
  `Pool dev: ${T.pool.words} words, ${T.pool.minutes} minutes, ${T.pool.passages} passages, ${T.pool.reciters} reciters. W5 dev: ${T.w5.words} words, ${T.w5.runs} runs.\n`,
);
table(
  [
    'chain',
    'pool dev marks',
    'per 1,000, interval resamples passages and reciters',
    'W5 dev marks',
    'W1 other words, app',
    'W1 other words, carry-on',
  ],
  pick.map(c => [
    c,
    T.pool.cfg[c].marks,
    T.pool.cfg[c].per1000,
    T.w5.cfg[c].marks,
    T.w1Unchanged.app[c],
    T.w1Unchanged.carry[c],
  ]),
);

h(
  'Voices behind correct recitation: false marks (9,880 words each, tuning half)',
  `${TB}, key voices`,
);
const vPick = [
  'J.none',
  'J.P1',
  'J.P2',
  'S1.none',
  'S1.P1',
  'S1.P2',
  'S1.P3',
  'S1.P4',
  'S1h0.P3',
  'S1.P3s',
  'S2.none',
  'S2.P3',
  'S2.P4',
  'S2h0.P4',
  'N1.P3',
];
table(
  ['condition', ...vPick],
  VOICE_CONDS.map(v => [v, ...vPick.map(c => T.voices[v].cfg[c].marks)]),
);
h(
  'The same per 1,000 words, with intervals, for the rule picked and for today',
  `${TB}, key voices`,
);
const winName = `S1.${T.selection.S1.winner ?? T.selection.S1.closest}`;
const winName2 = `S2.${T.selection.S2.winner ?? T.selection.S2.closest}`;
table(
  [
    'condition',
    'today (no judge, no cancel)',
    'app today (J.P1)',
    winName,
    winName2,
  ],
  VOICE_CONDS.map(v => [
    v,
    ...['J.none', 'J.P1', winName, winName2].map(
      c => `${T.voices[v].cfg[c].marks}: ${T.voices[v].cfg[c].per1000}`,
    ),
  ]),
);

h(
  'W1 interior changed words with voices behind (dev, 217 runs, clip alone)',
  `${TB}, key w1int`,
);
const wPick = [
  'J.none',
  'J.P1',
  'J.P2',
  'S1.none',
  'S1.P3',
  'S1.P4',
  'S1h0.P3',
  'S2.none',
  'S2.P3',
  'S2.P4',
  'N1.P3',
];
table(
  ['condition', ...wPick],
  W1INT_CONDS.map(v => [
    v,
    ...wPick.map(c => `${T.w1int[v].cfg[c].num} ${T.w1int[v].cfg[c].ci}`),
  ]),
);

h(
  'Combined engine under voices: false junction fires and false added marks',
  'voices_combined.mjs',
);
table(
  [
    'condition',
    'runs',
    'words',
    'verdicts of the plain engine lost',
    'junction fires',
    'per 1,000',
    'added marks',
    'per 1,000',
  ],
  Object.entries(VC)
    .filter(([c]) => c !== 'pool_dev')
    .map(([c, r]) => [
      c,
      r.runs,
      r.words,
      c === 'none_0'
        ? `${r.verdictsLostAgainstBaseline} against the pool baseline, ${r.verdictsLostAgainstShipped} against the voices run, of ${r.verdictsInShipped}`
        : `${r.verdictsLostAgainstShipped} of ${r.verdictsInShipped}`,
      r.junctionFires,
      r.junctionFiresPer1000,
      r.addedMarks,
      r.addedPer1000,
    ]),
);
if (VC.pool_dev)
  out.push(
    `Pool dev on the same engine, no voices, ${VC.pool_dev.words} words: ${VC.pool_dev.junctionFires} junction fires, ${VC.pool_dev.addedMarks} added marks.\n`,
  );

if (T.together) {
  h(
    'All marks together: red after the cancel step, junction and added marks, with an added mark clearing red on its two neighbours',
    `${TB}, key together`,
  );
  table(
    [
      'condition',
      'words',
      ...[winName, winName2].flatMap(c => [
        `${c} red`,
        'cleared',
        'junction',
        'added',
        'total',
        'per 1,000',
      ]),
    ],
    Object.entries(T.together).map(([k, v]) => [
      k,
      v.words,
      ...[winName, winName2].flatMap(c => {
        const x = v.cfg[c];
        return [
          x.red,
          x.cleared,
          x.junction,
          x.added,
          x.total,
          ((1000 * x.total) / v.words).toFixed(2),
        ];
      }),
    ]),
  );
}

h(
  'Model runs per minute, for the rule picked (judge slices plus padded runs)',
  `${TB}, key runs`,
);
const rRow = (p, c) => {
  const x = T.runs[p]?.[c];
  return x
    ? [
        `${x.minutes}`,
        x.wakesPerMin,
        x.slicesPerMin,
        x.runsPerMin,
        +(x.slicesPerMin + x.suspectsPerMin).toFixed(2),
        x.marks ?? 0,
        x.perMark ?? '-',
      ]
    : ['-', '-', '-', '-', '-', '-', '-'];
};
const pops = [
  'pool',
  'sobolev',
  'voices_none_0',
  ...NOISY.map(v => `voices_${v}`),
];
for (const c of [winName, winName2]) {
  out.push(`${c}:\n`);
  table(
    [
      'population',
      'minutes',
      'wakes a minute',
      'distinct judge slices a minute',
      'model runs a minute, padded look at show time',
      'at most, padded look on every suspect',
      'marks checked',
      'model runs per mark',
    ],
    pops.map(p => [p, ...rRow(p, c)]),
  );
}

h(
  "Latency from the next word's onset, median / p90 in seconds",
  `${TB}, key latency`,
);
const lat = Object.keys(T.latency).filter(k => k !== 'live interior');
table(
  [
    'chain',
    ...lat.flatMap(k => [`${k}: marks`, 'at 0.25 s a run', 'at 0.6 s a run']),
  ],
  [
    'J.none',
    'S1.P1',
    'S1.P3',
    'S1h0.P3',
    'S1.P4',
    'S2.P1',
    'S2.P4',
    'S2h0.P4',
  ].map(c => [
    c,
    ...lat.flatMap(k => [
      T.latency[k][c].n,
      T.latency[k][c].at025.join(' / '),
      T.latency[k][c].at06.join(' / '),
    ]),
  ]),
);
out.push(
  `The live interior suite's dev runs record no next-word onset, so it has no latency here.\n`,
);

h(
  'The phone switch: what the cancel step may cancel',
  `${TB}, keys quranmb, pool, w1 and voices, chains ending in s`,
);
const sw = (name, a, b) => [name, a, b];
const swRows = [];
for (const [lab, all, skip] of [
  ['Step 1', winName, winName.replace(/P(\d)$/, 'P$1s')],
  ['Step 2', winName2, winName2.replace(/P(\d)$/, 'P$1s')],
]) {
  swRows.push(
    sw(
      `${lab}: real slips kept of 66`,
      T.quranmb.cfg[all].hit.kept,
      T.quranmb.cfg[skip].hit.kept,
    ),
  );
  swRows.push(
    sw(
      `${lab}: learner false marks kept of 86`,
      T.quranmb.cfg[all]['false-incorrect'].kept +
        T.quranmb.cfg[all]['false-correct'].kept,
      T.quranmb.cfg[skip]['false-incorrect'].kept +
        T.quranmb.cfg[skip]['false-correct'].kept,
    ),
  );
  swRows.push(
    sw(
      `${lab}: pool dev false marks`,
      T.pool.cfg[all].marks,
      T.pool.cfg[skip].marks,
    ),
  );
  for (const p of ['interior', 'last', 'first', 'close'])
    swRows.push(
      sw(
        `${lab}: W1 ${p}`,
        T.w1.carry[p].cfg[all].ci,
        T.w1.carry[p].cfg[skip].ci,
      ),
    );
  for (const v of NOISY)
    swRows.push(
      sw(
        `${lab}: ${v} false marks`,
        T.voices[v].cfg[all].marks,
        T.voices[v].cfg[skip].marks,
      ),
    );
}
table(['measure', 'all marks', 'skipped marks only'], swRows);

h(
  "Does the rule carry over to the judge's slice? QuranMB marks, no veto in front",
  `${TB}, keys transfer and transferSpan`,
);
table(
  [
    'class',
    'kept on both',
    'only on its measured slice',
    "only on the judge's slice",
    'cancelled on both',
  ],
  Object.entries(T.transfer).map(([l, t]) => [
    l,
    t.both,
    t.onlyMeasuredSlice,
    t.onlyJudgeSlice,
    t.neither,
  ]),
);

out.push(
  `On the same ${T.transferSpan.marks} marks the two first passes put the word's start ${T.transferSpan.wordStartMedian} s apart at the median (p90 ${T.transferSpan.wordStartP90}) and its end ${T.transferSpan.wordEndMedian} s apart (p90 ${T.transferSpan.wordEndP90}). At or below -6 per letter: ${T.transferSpan.firstAtOrBelow6.measuredSlice} on its measured slice, ${T.transferSpan.firstAtOrBelow6.judgeSlice} on the judge's, ${T.transferSpan.firstAtOrBelow6.both} on both.\n`,
);

h(
  'Paired differences, each interval on the difference itself',
  `${TB}, key compare`,
);
const cmpRows = Object.entries(T.compare).map(([k, v]) => [
  k,
  v.realSlips,
  v.near,
  v.learnerFalse,
  v.pool,
  v.w5,
  v.voices10dB,
  v.voices5dB,
]);
table(
  [
    'first minus second',
    'real slips',
    'near',
    'learner false marks',
    'pool dev marks',
    'W5 dev marks',
    'voices at 10 dB',
    'voices at 5 dB',
  ],
  cmpRows,
);

h('Sobolev, phone recordings, each clip alone', `${TB}, key sobolev`);
out.push(
  `${T.sobolev.clips} clips, ${T.sobolev.minutes} minutes. Clips with no recorded error: ${T.sobolev.cleanClips}, ${T.sobolev.cleanWords} words. Labelled words: ${T.sobolev.labelled}.\n`,
);
table(
  ['chain', 'marks on clean clips', 'labelled words marked'],
  ['J.none', 'S1.P1', winName, winName2, 'N1.P3'].map(c => [
    c,
    T.sobolev.cfg[c].marksOnClean,
    T.sobolev.cfg[c].labelledCaught,
  ]),
);
console.log(out.join('\n'));
