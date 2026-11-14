/* eslint-env node, es2020 */
// Every table of SCOREBOARD.md, from .out/second-look/final/digest. Loads no model.
//   node scripts/second-look/final/score.mjs            everything but the held-out read
//   node scripts/second-look/final/score.mjs --heldout  the held-out read alone
// Writes tables.json or heldout.json beside the digests and prints the same as markdown.
// Columns: today is the committed rules on the committed engine. off, s1, s2 are the app's
// real modules on the patched engine: off with the second model switched off, s1 the default,
// s2 with the judge's Step 2. s1s and s2s have the phone switch at skipped marks only. A
// plain name assumes 0.25 s per second-model run; @0.6 assumes 0.6 s. Where the clip was
// played whole through the real stack, s1 is that real pass, not playback.
import fs from 'node:fs';
import path from 'node:path';
import {
  BENCH,
  FINAL,
  HELD_OUT_VOICES,
  TUNING_VOICES,
  cellOf,
} from './suites.mjs';
import {fmtP, fmtR, pigeonhole, q} from '../stats.mjs';

process.env.WORD_MARKS ??= path.join(FINAL, 'wordMarks.today.ts');
const {nearSet, exactId} = await import(path.join(BENCH, 'natural/score.mjs'));
const {labelOf} = await import('../quranmb_labels.mjs');

const heldOut = process.argv.includes('--heldout');
const BOOT = 2000;
const words = JSON.parse(
  fs.readFileSync(path.join(BENCH, '.out/natural/manifests/engine_words.json')),
);
const wordsOf = key => words[key];
const hasKey = key => key in words;

const read = name => {
  const f = path.join(FINAL, 'digest', `${name}.jsonl`);
  if (!fs.existsSync(f)) return [];
  return fs
    .readFileSync(f, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l));
};

// ----------------------------------------------------------------------- columns
const played = (r, cfg, per, mode) =>
  r.cfg?.[cfg]?.[cfg === 'off' ? '0.25' : per]?.[mode] ?? null;
function column(r, col, mode = 'app') {
  switch (col) {
    case 'today': {
      const list = r.today?.[mode];
      return list ? {shown: list, added: []} : null;
    }
    case 's1':
      return mode === 'app' ? r.real : played(r, 's1', '0.25', mode);
    case 's1@0.6':
      return played(r, 's1', '0.6', mode);
    case 's2':
      return played(r, 's2', '0.25', mode);
    case 's2@0.6':
      return played(r, 's2', '0.6', mode);
    case 's1s':
      return played(r, 's1s', '0.25', mode);
    case 's2s':
      return played(r, 's2s', '0.25', mode);
    case 'off':
      return played(r, 'off', '0.25', mode);
    case 'play s1':
      return played(r, 's1', '0.25', mode);
    default:
      throw new Error(col);
  }
}
const shownOf = (r, col, mode) => column(r, col, mode)?.shown ?? [];
const addedOf = (r, col, mode) => column(r, col, mode)?.added ?? [];
const FALSE_COLS = [
  'today',
  'off',
  's1',
  's1@0.6',
  's2',
  's2@0.6',
  's1s',
  's2s',
];
const CATCH_COLS = ['today', 'off', 's1', 's1@0.6', 's2', 's2@0.6'];

const T = {};
const out = [];
function table(key, title, headers, rows, note) {
  T[key] = {title, headers, rows, note};
  out.push(`\n### ${title}\n`);
  if (note) out.push(`${note}\n`);
  out.push(`| ${headers.join(' | ')} |`);
  out.push(`|${headers.map(() => '---').join('|')}|`);
  for (const row of rows) out.push(`| ${row.join(' | ')} |`);
}
const sum = (rows, f) => rows.reduce((x, r) => x + f(r), 0);
const rateCell = (rows, f, den, unitA, unitB) => {
  const est = pigeonhole(
    rows.map(r => ({a: unitA(r), b: unitB(r), num: f(r), den: den(r)})),
    BOOT,
  );
  return `${est.num}: ${fmtR(est)}`;
};
const pctCell = (rows, f, unitA, unitB) => {
  const est = pigeonhole(
    rows.map(r => ({a: unitA(r), b: unitB(r), num: f(r) ? 1 : 0, den: 1})),
    BOOT,
  );
  return `${fmtP(est)} (${est.num}/${est.den})`;
};
const byPassage = r => r.truth.block;
const byReciter = r => r.truth.reciter;
const byPair = r => r.truth.pair;

function latencyCell(rows, col, mode, exact, onset) {
  const xs = [];
  for (const r of rows) {
    const o = onset(r);
    if (o === null || o === undefined) continue;
    const m = shownOf(r, col, mode).find(x => x.id === exact(r));
    if (m) xs.push(m.a - o);
  }
  return xs.length ? `${q(xs, 0.5)} / ${q(xs, 0.9)} (${xs.length})` : '-';
}

// --------------------------------------------------------- correct recitation, voices
function poolTable(key, title, rows, note) {
  const cells = {
    dev: 'tuned on',
    test: 'read by the three fixes and the verifier, not by the cancel step',
    mixed: 'read by the verifier, not by the cancel step',
  };
  const list = [
    ...Object.keys(cells).map(c => [
      c,
      rows.filter(r => cellOf(r.truth) === c),
    ]),
    ['all', rows],
  ].filter(([, x]) => x.length);
  table(
    key,
    title,
    [
      'cell',
      'takes',
      'words',
      ...FALSE_COLS,
      'added (s1)',
      'red gone again (s1)',
      'junction (s1)',
      'red + added (s1)',
    ],
    list.map(([cell, x]) => [
      cell,
      x.length,
      sum(x, r => r.truth.words),
      ...FALSE_COLS.map(c =>
        rateCell(
          x,
          r => shownOf(r, c).length,
          r => r.truth.words,
          byPassage,
          byReciter,
        ),
      ),
      rateCell(
        x,
        r => addedOf(r, 's1').length,
        r => r.truth.words,
        byPassage,
        byReciter,
      ),
      sum(x, r => shownOf(r, 's1').filter(m => m.gone && !m.c).length),
      sum(x, r => shownOf(r, 's1').filter(m => r.fires.includes(m.id)).length),
      rateCell(
        x,
        r => shownOf(r, 's1').length + addedOf(r, 's1').length,
        r => r.truth.words,
        byPassage,
        byReciter,
      ),
    ]),
    note,
  );
}

function voicesTable(key, title, suites, note) {
  const rows = [];
  for (const [cond, name] of suites) {
    const x = read(name);
    if (!x.length) continue;
    const minutes = sum(x, r => r.seconds) / 60;
    rows.push([
      cond,
      `${x.length}, ${sum(x, r => r.truth.words)}, ${minutes.toFixed(0)}`,
      ...FALSE_COLS.map(c =>
        rateCell(
          x,
          r => shownOf(r, c).length,
          r => r.truth.words,
          byPassage,
          byReciter,
        ),
      ),
      rateCell(
        x,
        r => addedOf(r, 's1').length,
        r => r.truth.words,
        byPassage,
        byReciter,
      ),
      sum(x, r => r.fires.length),
      rateCell(
        x,
        r => shownOf(r, 's1').length + addedOf(r, 's1').length,
        r => r.truth.words,
        byPassage,
        byReciter,
      ),
      rateCell(
        x,
        r => shownOf(r, 'today').length,
        r => r.truth.words,
        byPassage,
        byReciter,
      ),
      (60 * sum(x, r => r.lost)) / minutes > 0
        ? ((60 * sum(x, r => r.lost)) / minutes).toFixed(1)
        : '0',
    ]);
  }
  table(
    key,
    title,
    [
      'condition',
      'takes, words, minutes',
      ...FALSE_COLS,
      'added (s1)',
      'junction fires',
      'red + added (s1)',
      'engine lost or idle an hour',
    ],
    rows.map(row => row.filter((_, i) => i !== row.length - 2)),
    note,
  );
}

function costTable(key, title, suites) {
  const rows = [];
  for (const [label, name] of suites) {
    const x = read(name);
    if (!x.length) continue;
    const minutes = sum(x, r => r.seconds) / 60;
    for (const [col, per] of [
      ['s1', '0.25'],
      ['s1', '0.6'],
      ['s2', '0.25'],
      ['s2', '0.6'],
    ]) {
      const stats = x.map(r => played(r, col, per, 'app')?.stats ?? {});
      const add = k => stats.reduce((n, s) => n + (s[k] ?? 0), 0);
      rows.push([
        label,
        `${col} at ${per} s`,
        minutes.toFixed(0),
        (add('wakes') / minutes).toFixed(2),
        (add('runs') / minutes).toFixed(2),
        add('first'),
        add('padded'),
        add('failed'),
        add('timeouts'),
        add('dropped'),
        Math.max(0, ...stats.map(s => s.queueMax ?? 0)),
        Math.max(
          0,
          ...x.map(r => played(r, col, per, 'app')?.stats?.runs ?? 0),
        ),
      ]);
    }
  }
  table(
    key,
    title,
    [
      'population',
      'setting',
      'minutes',
      'wakes a minute',
      'model runs a minute',
      'first passes',
      'padded looks',
      'failed open',
      'timeouts',
      'dropped',
      'queue max',
      'most runs in one take',
    ],
    rows,
  );
}

if (heldOut) {
  const suites = HELD_OUT_VOICES.map(c => [c, `heldout_${c}`]);
  voicesTable(
    'heldout',
    'Voices behind correct recitation, held-out half (test reciters on test passages), false marks per 1,000 words',
    suites,
    'Read once, with the rule frozen. Intervals resample passages and reciters together.',
  );
  costTable(
    'heldoutCost',
    'Model runs on the held-out half',
    suites.map(([c, n]) => [c, n]),
  );
  // rec_one's voices are test reciters too: how much of each take hears the reader himself.
  const pool = JSON.parse(
    fs.readFileSync(path.join(BENCH, '.out/natural/manifests/pool.json')),
  );
  const voices = [
    ...new Set(
      pool
        .filter(c => c.truth.reciterSplit === 'test')
        .map(c => c.truth.reciter),
    ),
  ]
    .sort()
    .slice(0, 6);
  const x = read('heldout_rec_one_5');
  const EACH = 300;
  const TRACK = EACH * 6;
  const own = r => {
    const at = voices.indexOf(r.truth.reciter);
    if (at < 0 || !r.mix) return 0;
    const start = r.mix.offset / 16000;
    let seconds = 0;
    for (let t = 0; t < r.seconds; t += 1) {
      if (Math.floor(((start + t) % TRACK) / EACH) === at) seconds += 1;
    }
    return seconds;
  };
  const clean = x.filter(r => own(r) === 0);
  const some = x.filter(r => own(r) > 0);
  table(
    'heldoutSelf',
    'rec_one at 5 dB on the held-out half: takes whose background reciter is ever the reader himself',
    [
      'takes',
      'count',
      'words',
      'minutes with his own voice behind',
      'today',
      's1',
      's2',
      'added (s1)',
    ],
    [
      ['no overlap', clean, 'all'],
      ['some overlap', some, 'some'],
    ].map(([label, list]) => [
      label,
      list.length,
      sum(list, r => r.truth.words),
      (sum(list, r => own(r)) / 60).toFixed(1),
      list.length
        ? rateCell(
            list,
            r => shownOf(r, 'today').length,
            r => r.truth.words,
            byPassage,
            byReciter,
          )
        : '-',
      list.length
        ? rateCell(
            list,
            r => shownOf(r, 's1').length,
            r => r.truth.words,
            byPassage,
            byReciter,
          )
        : '-',
      list.length
        ? rateCell(
            list,
            r => shownOf(r, 's2').length,
            r => r.truth.words,
            byPassage,
            byReciter,
          )
        : '-',
      sum(list, r => addedOf(r, 's1').length),
    ]),
  );
  const parity = [];
  for (const [c, n] of suites) {
    const y = read(n);
    let same = 0;
    for (const r of y) {
      const a = shownOf(r, 's1')
        .map(m => m.id)
        .sort()
        .join();
      const b = shownOf(r, 'play s1')
        .map(m => m.id)
        .sort()
        .join();
      if (a === b) same += 1;
    }
    parity.push([c, y.length, same]);
  }
  table(
    'heldoutParity',
    'Real pass against playback at s1, same marks',
    ['condition', 'takes', 'same'],
    parity,
  );
  fs.writeFileSync(
    path.join(FINAL, 'heldout.json'),
    JSON.stringify(T, null, 1),
  );
  console.log(out.join('\n'));
  process.exit(0);
}

// ------------------------------------------------------------------------- the pool
const pool = read('pool');
poolTable(
  'pool',
  'False marks on correct recitation, the pool, per 1,000 words',
  pool,
  'Each cell is red marks ever shown, with the junction marks among them. Intervals resample passages and reciters together.',
);
{
  const inRestart = (r, id) => {
    const [s, a] = id.split(':');
    return (r.truth.ayat ?? []).some(
      x => x.key === `${s}:${a}` && x.restarts > 0,
    );
  };
  const restartWords = sum(pool, r =>
    (r.truth.ayat ?? []).reduce(
      (y, a) => y + (a.restarts > 0 ? a.words : 0),
      0,
    ),
  );
  const all = sum(pool, r => r.truth.words);
  table(
    'poolRestart',
    'The pool: marks by whether their ayah holds a natural restart',
    [
      'column',
      `ayat with a restart (${restartWords} words)`,
      `other ayat (${all - restartWords} words)`,
    ],
    FALSE_COLS.map(c => {
      const n = sum(
        pool,
        r => shownOf(r, c).filter(m => inRestart(r, m.id)).length,
      );
      const t = sum(pool, r => shownOf(r, c).length);
      return [c, n, t - n];
    }),
  );
  table(
    'poolLost',
    'The pool: the follower itself',
    ['hours', 'engine lost or idle events', 'an hour'],
    [
      [
        (sum(pool, r => r.seconds) / 3600).toFixed(1),
        sum(pool, r => r.lost),
        ((3600 * sum(pool, r => r.lost)) / sum(pool, r => r.seconds)).toFixed(
          2,
        ),
      ],
    ],
  );
}

// ---------------------------------------------------------------------------- W5
{
  const w5 = read('w5');
  const unit = r => r.truth.category;
  const rows = [];
  for (const [label, keep] of [
    ['dev reciters (tuned on)', r => r.truth.reciterSplit === 'dev'],
    [
      'test reciters (read by the fixes and the verifier)',
      r => r.truth.reciterSplit === 'test',
    ],
    ['all', () => true],
  ]) {
    const x = w5.filter(keep);
    rows.push([
      label,
      x.length,
      sum(x, r => r.truth.words),
      ...FALSE_COLS.map(c => sum(x, r => shownOf(r, c).length)),
      sum(x, r => addedOf(r, 's1').length),
    ]);
  }
  for (const cat of [...new Set(w5.map(r => r.truth.category))].sort()) {
    const x = w5.filter(r => r.truth.category === cat);
    rows.push([
      cat,
      x.length,
      sum(x, r => r.truth.words),
      ...FALSE_COLS.map(c => sum(x, r => shownOf(r, c).length)),
      sum(x, r => addedOf(r, 's1').length),
    ]);
  }
  table(
    'w5',
    'W5, the first cut: marks on correct recitation of hard places',
    ['set', 'runs', 'words', ...FALSE_COLS, 'added (s1)'],
    rows,
    `All W5, s1, per 1,000 words: ${rateCell(
      w5,
      r => shownOf(r, 's1').length,
      r => r.truth.words,
      unit,
      byReciter,
    )}. Today: ${rateCell(
      w5,
      r => shownOf(r, 'today').length,
      r => r.truth.words,
      unit,
      byReciter,
    )}.`,
  );
}

// ---------------------------------------------------------------------------- W1
{
  const w1 = read('w1');
  const events = w1.filter(r => r.truth.type === 'changed');
  const exact = r => `${r.truth.expectedKey}:${r.truth.target}`;
  const unitWords = r => {
    const near = nearSet(r.truth, wordsOf, hasKey);
    const n = wordsOf(r.truth.expectedKey);
    const inX = [...near].filter(id =>
      id.startsWith(`${r.truth.expectedKey}:`),
    ).length;
    return {near, words: Math.max(0, n - (r.truth.startWord ?? 0) - inX)};
  };
  const others = w1.filter(r =>
    ['changed', 'skipped', 'added'].includes(r.truth.type),
  );
  const prepared = new Map(others.map(r => [r.id, unitWords(r)]));
  const falseCell = (x, c, mode) =>
    rateCell(
      x,
      r =>
        shownOf(r, c, mode).filter(m => !prepared.get(r.id).near.has(m.id))
          .length,
      r => prepared.get(r.id).words,
      byPair,
      byReciter,
    );
  const rows = [];
  for (const [label, keep] of [
    ['dev (tuned on)', r => cellOf(r.truth) === 'dev'],
    [
      'test (read by the fixes and the verifier)',
      r => cellOf(r.truth) === 'test',
    ],
    ['mixed (read by the verifier)', r => cellOf(r.truth) === 'mixed'],
    ['all', () => true],
  ]) {
    const x = others.filter(keep);
    for (const mode of ['app', 'carry']) {
      rows.push([
        label,
        mode === 'app' ? 'clip alone' : 'flush and next word',
        sum(x, r => prepared.get(r.id).words),
        ...['today', 'off', 'play s1', 's2', 's1s'].map(c =>
          falseCell(x, c, mode),
        ),
      ]);
    }
  }
  table(
    'w1Other',
    'W1: false marks on words that do not differ, per 1,000 words',
    ['cell', 'how', 'words', 'today', 'off', 's1', 's2', 's1s'],
    rows,
    "A mark next to the event is the event's, as in the natural benchmark. Intervals resample pairs and reciters. These rows are playback, as the real pass plays no flush.",
  );
  const traps = w1.filter(r => r.truth.type === 'trap');
  const control = read('w1_control');
  table(
    'w1Traps',
    'W1: spelling-only traps and each recording against its own text (controls), marks',
    [
      'set',
      'runs',
      'words',
      ...['today', 'off', 's1', 's2', 's1s'].map(c => `${c}, clip alone`),
      'today, flush',
      's1, flush',
      's2, flush',
      'added (s1)',
    ],
    [
      ['traps', traps],
      ['controls', control],
    ].map(([label, x]) => [
      label,
      x.length,
      sum(x, r => r.truth.words ?? wordsOf(r.truth.expectedKey) ?? 0),
      ...['today', 'off', 's1', 's2', 's1s'].map(c =>
        sum(x, r => shownOf(r, c).length),
      ),
      sum(x, r => shownOf(r, 'today', 'carry').length),
      sum(x, r => shownOf(r, 'play s1', 'carry').length),
      sum(x, r => shownOf(r, 's2', 'carry').length),
      sum(x, r => addedOf(r, 's1').length),
    ]),
  );
  const GROUPS = {
    all: () => true,
    interior: t => t.position === 'interior',
    last: t => t.position === 'last',
    first: t => t.position === 'first',
    close: t => t.close,
    'close interior': t => t.close && t.position === 'interior',
    'close last': t => t.close && t.position === 'last',
    'close first': t => t.close && t.position === 'first',
  };
  for (const [key, title, mode, cols] of [
    [
      'w1Carry',
      'W1 changed words, exact word, with the harness flush and a made-up next word',
      'carry',
      ['today', 'off', 'play s1', 's1@0.6', 's2', 's2@0.6'],
    ],
    [
      'w1App',
      'W1 changed words, exact word, from the clip alone (clips end on the last word, so last words read 0 here)',
      'app',
      ['today', 'off', 's1', 's1@0.6', 's2', 's2@0.6'],
    ],
  ]) {
    const rows2 = [];
    for (const cell of ['all', 'dev', 'test', 'mixed']) {
      const inCell = events.filter(
        r => cell === 'all' || cellOf(r.truth) === cell,
      );
      for (const [g, f] of Object.entries(GROUPS)) {
        if (
          cell !== 'all' &&
          !['all', 'interior', 'last', 'first', 'close'].includes(g)
        )
          continue;
        const x = inCell.filter(r => f(r.truth));
        if (!x.length) continue;
        rows2.push([
          cell,
          g,
          `${x.length}, ${new Set(x.map(byPair)).size}`,
          ...cols.map(c =>
            pctCell(
              x,
              r => shownOf(r, c, mode).some(m => m.id === exact(r)),
              byPair,
              byReciter,
            ),
          ),
        ]);
      }
    }
    table(
      key,
      title,
      ['cell', 'place', 'events, pairs', ...cols],
      rows2,
      'Intervals resample pairs and reciters together. dev was tuned on; test and mixed were read by the fixes and the verifier, not by the cancel step.',
    );
  }
  const stampOnset = r => {
    const s = r.truth.stamps?.[String(r.truth.target + 1)];
    return s ? s[0] / 1000 : null;
  };
  const interior = events.filter(r => r.truth.position === 'interior');
  table(
    'w1Latency',
    "W1 interior changed words, clip alone: from the next word's onset to the mark, median / p90 in seconds (marks)",
    ['today', 's1', 's1@0.6', 's2', 's2@0.6'],
    [
      ['today', 's1', 's1@0.6', 's2', 's2@0.6'].map(c =>
        latencyCell(interior, c, 'app', exact, stampOnset),
      ),
    ],
  );
  // Other W1 events.
  const rows3 = [];
  for (const [label, keep] of [
    ['skipped, all', t => t.type === 'skipped' && !t.short],
    [
      'skipped, interior',
      t => t.type === 'skipped' && !t.short && t.position === 'interior',
    ],
    ['dropped last, clip ends', t => t.type === 'dropped_last'],
    ['junction, the one natural pair', t => t.type === 'junction'],
    ['added last', t => t.type === 'added_last'],
  ]) {
    const x = w1.filter(r => keep(r.truth));
    if (!x.length) continue;
    const caught = (r, c, mode) => {
      const near = nearSet(r.truth, wordsOf, hasKey);
      return shownOf(r, c, mode).some(m => near.has(m.id));
    };
    rows3.push([
      label,
      `${x.length}, ${new Set(x.map(byPair)).size}`,
      ...['today', 'off', 's1', 's2'].map(c =>
        pctCell(x, r => caught(r, c, 'app'), byPair, byReciter),
      ),
      ...['today', 'play s1', 's2'].map(c =>
        pctCell(x, r => caught(r, c, 'carry'), byPair, byReciter),
      ),
    ]);
  }
  table(
    'w1Others',
    'W1: other events, a mark on the word or next to it',
    [
      'event',
      'events, pairs',
      'today, clip',
      'off, clip',
      's1, clip',
      's2, clip',
      'today, flush',
      's1, flush',
      's2, flush',
    ],
    rows3,
    'Small: 11 pairs of skipped words, 2 interior; 3 dropped-last pairs.',
  );
}

// ---------------------------------------------------------------------- live path
{
  const live = read('live_last');
  const interior = read('interior');
  const und = p => {
    const [k, a, b] = p.split('~');
    return `${k}~${[a, b].sort().join('~')}`;
  };
  const exact = r => `${r.truth.expectedKey}:${r.truth.target}`;
  const onset = r => {
    const t = r.truth;
    if (t.nextStartMs !== undefined && t.nextStartMs !== null)
      return t.nextStartMs / 1000;
    if (r.partEnd !== null && t.nextOnsetMs !== undefined)
      return r.partEnd + t.nextOnsetMs / 1000;
    return null;
  };
  const rows = [];
  const lat = [];
  const groups = [
    [
      'last word, whole-ayah pairs',
      live.filter(r => r.truth.type === 'carry_last_whole'),
    ],
    [
      'last word, shared closing words',
      live.filter(r => r.truth.type === 'carry_last_ctx'),
    ],
    ['last word, all', live.filter(r => r.truth.position === 'last')],
    ['first word', live.filter(r => r.truth.position === 'first')],
    ['interior', interior],
    ['close interior', interior.filter(r => r.truth.close)],
  ];
  for (const [label, all] of groups) {
    for (const [cell, keep] of [
      ['all', () => true],
      ['dev reciters', r => r.truth.reciterSplit === 'dev'],
      ['test reciters', r => r.truth.reciterSplit === 'test'],
    ]) {
      const x = all.filter(keep);
      if (!x.length) continue;
      const unit = r => und(r.truth.pair);
      rows.push([
        label,
        cell,
        `${x.length}, ${new Set(x.map(unit)).size}`,
        ...CATCH_COLS.map(c =>
          pctCell(
            x,
            r => shownOf(r, c).some(m => m.id === exact(r)),
            unit,
            byReciter,
          ),
        ),
      ]);
    }
    lat.push([
      label,
      ...['s1', 's1@0.6', 's2', 's2@0.6'].map(c =>
        latencyCell(all, c, 'app', exact, onset),
      ),
    ]);
  }
  table(
    'live',
    'Live path: real next-ayah audio, no flush, no made-up next word, exact word',
    ['place', 'reciters', 'runs, pairs', ...CATCH_COLS],
    rows,
    'A pair read both ways is one unit. Reciters and word types overlap the earlier splits, so this tests the live path, not new voices. Last-word context and first-word runs use a hand lock on shared words.',
  );
  table(
    'liveLatency',
    "Live path: from the next word's onset to the mark, median / p90 in seconds (marks)",
    ['place', 's1', 's1@0.6', 's2', 's2@0.6'],
    lat,
  );
  const control = read('live_control');
  table(
    'liveControl',
    'Live path controls: the same word actually said, marks anywhere in the run',
    ['runs', 'on the said word, s1', 'on the said word, s2', ...FALSE_COLS],
    [
      [
        control.length,
        sum(
          control,
          r => shownOf(r, 's1').filter(m => m.id === exact(r)).length,
        ),
        sum(
          control,
          r => shownOf(r, 's2').filter(m => m.id === exact(r)).length,
        ),
        ...FALSE_COLS.map(c => sum(control, r => shownOf(r, c).length)),
      ],
    ],
  );
}

// ---------------------------------------------------------------- left-out last word
{
  const sites = read('sites');
  const control = read('sites_control');
  const exact = r => `${r.truth.expectedKey}:${r.truth.target}`;
  const onset = r =>
    r.partEnd !== null && r.truth.nextOnsetMs !== undefined
      ? r.partEnd + r.truth.nextOnsetMs / 1000
      : null;
  const COLS = ['today', 'off', 'play s1', 's2'];
  const rows = [];
  for (const [cell, keep] of [
    ['dev (version 2 tuned on)', r => cellOf(r.truth) === 'dev'],
    ['test (read before version 2 was fixed)', r => cellOf(r.truth) === 'test'],
    [
      'mixed (read once on version 2; same sites)',
      r => cellOf(r.truth) === 'mixed',
    ],
    ['all', () => true],
  ]) {
    const x = sites.filter(keep);
    rows.push([
      cell,
      `${x.length}, ${new Set(x.map(byPair)).size}`,
      ...COLS.map(c =>
        pctCell(
          x,
          r => shownOf(r, c, 'noLost').some(m => m.id === exact(r)),
          byPair,
          byReciter,
        ),
      ),
      pctCell(
        x,
        r => shownOf(r, 's1').some(m => m.id === exact(r)),
        byPair,
        byReciter,
      ),
      pctCell(x, r => r.fires.includes(exact(r)), byPair, byReciter),
    ]);
  }
  table(
    'sites',
    'Left-out last word at natural sites, mark on the exact word (hand lock on the word before)',
    [
      'cell',
      'runs, sites',
      'today',
      'off',
      's1',
      's2',
      "s1 with the rig's lost events kept (real pass)",
      'junction fired',
    ],
    rows,
    'Rig lost events are left out as the verifier did, except in the column that says so.',
  );
  table(
    'sitesLatency',
    "Left-out last word: from the next word's onset to the mark, median / p90 in seconds (marks)",
    ['s1', 's2'],
    [
      [
        latencyCell(sites, 'play s1', 'noLost', exact, onset),
        latencyCell(sites, 's2', 'noLost', exact, onset),
      ],
    ],
  );
  table(
    'sitesControl',
    'Left-out last word controls: the same last word said',
    [
      'runs, sites',
      'junction fires on it',
      'marks on it, today',
      'off',
      's1',
      's2',
      'other marks, s1',
      'added marks (s1)',
    ],
    [
      [
        `${control.length}, ${new Set(control.map(byPair)).size}`,
        sum(control, r => (r.fires.includes(exact(r)) ? 1 : 0)),
        ...['today', 'off', 'play s1', 's2'].map(c =>
          sum(
            control,
            r => shownOf(r, c, 'noLost').filter(m => m.id === exact(r)).length,
          ),
        ),
        sum(
          control,
          r =>
            shownOf(r, 'play s1', 'noLost').filter(m => m.id !== exact(r))
              .length,
        ),
        sum(control, r => addedOf(r, 's1').length),
      ],
    ],
  );
}

// ---------------------------------------------------------------------- added words
{
  const kept = read('added_kept');
  const app = read('added_app');
  const byCluster = r => r.truth.cluster;
  const onset = r => {
    const t = r.truth;
    if (!t.wordStampMs) return null;
    return (
      (t.cluster && r.partEnd !== null && t.kind === 'between'
        ? r.partEnd
        : 0) +
      t.wordStampMs[1] / 1000
    );
  };
  const rows = [];
  for (const [label, x] of [
    [
      'inside an ayah, recording starts in the shared words, place kept',
      kept.filter(r => r.truth.kind === 'interior'),
    ],
    [
      'same, 2 or more shared words after',
      kept.filter(r => r.truth.kind === 'interior' && r.truth.rightWords >= 2),
    ],
    [
      'recording starts on other words, place kept',
      kept.filter(r => r.truth.kind === 'interior_prefix'),
    ],
    [
      'between two ayat, arrives through other words, place kept',
      kept.filter(r => r.truth.kind === 'between'),
    ],
    ['all classes, place kept', kept],
    ["inside an ayah, the app's flow, no help", app],
  ]) {
    if (!x.length) continue;
    const hit = r => addedOf(r, 's1').some(a => a.id === r.truth.right);
    const lats = x.flatMap(r => {
      const m = addedOf(r, 's1').find(a => a.id === r.truth.right);
      const o = onset(r);
      return m && o !== null ? [m.a - o] : [];
    });
    const red = c =>
      sum(x, r =>
        shownOf(r, c).some(m => m.id === r.truth.left || m.id === r.truth.right)
          ? 1
          : 0,
      );
    rows.push([
      label,
      `${x.length}, ${new Set(x.map(byCluster)).size}, ${new Set(x.map(byReciter)).size}`,
      pctCell(x, hit, byCluster, byReciter),
      lats.length ? `${q(lats, 0.5)} / ${q(lats, 0.9)}` : '-',
      red('today'),
      red('s1'),
      red('s2'),
      sum(x, r =>
        shownOf(r, 's1').some(
          m =>
            (m.id === r.truth.left || m.id === r.truth.right) && m.gone && !m.c,
        )
          ? 1
          : 0,
      ),
    ]);
  }
  table(
    'added',
    'Added word, natural test events, mark in the exact gap',
    [
      'class',
      'runs, events, reciters',
      'caught',
      'median / p90 s from the next word',
      'runs with red on a neighbour: today',
      's1',
      's2',
      'of s1, red cleared later',
    ],
    rows,
    "Test events, read by the fix's own report and the verifier. 4 reciters: too few to speak for voices.",
  );
  const falseRows = [];
  const poolRows = read('pool');
  for (const [label, x, unit, den] of [
    [
      'pool, test cell',
      poolRows.filter(r => cellOf(r.truth) === 'test'),
      byPassage,
      r => r.truth.words,
    ],
    ['pool, all', poolRows, byPassage, r => r.truth.words],
    ['W5', read('w5'), r => r.truth.category, r => r.truth.words],
    ['W1 controls', read('w1_control'), byPair, r => r.truth.words ?? 0],
    [
      'junction controls',
      read('sites_control'),
      byPair,
      r => wordsOf(r.truth.expectedKey) ?? 0,
    ],
    [
      'live controls',
      read('live_control'),
      byPair,
      r => wordsOf(r.truth.expectedKey) ?? 0,
    ],
  ]) {
    falseRows.push([
      label,
      x.length,
      sum(x, den),
      rateCell(x, r => addedOf(r, 's1').length, den, unit, byReciter),
    ]);
  }
  table(
    'addedFalse',
    'Added word: false added marks on correct recitation, per 1,000 words',
    ['set', 'runs', 'words', 'added marks, s1'],
    falseRows,
  );
}

// -------------------------------------------------------------------------- learners
{
  const qmb = read('quranmb');
  const takes = new Map(
    JSON.parse(
      fs.readFileSync(path.join(BENCH, '.out/takes/quranmb/manifest.json')),
    ).map(t => [t.id, t]),
  );
  const LABELS = ['hit', 'near', 'false-incorrect', 'false-correct'];
  const base = [];
  for (const r of qmb) {
    for (const m of shownOf(r, 'today')) {
      const label = labelOf(takes.get(r.id).segments, m.id, m.s);
      if (LABELS.includes(label))
        base.push({r, id: m.id, label, spk: r.id.split('/')[1].split('_')[0]});
    }
  }
  const baseKeys = new Set(base.map(b => `${b.r.id}|${b.id}`));
  const rows = [];
  for (const c of [
    'today',
    'off',
    's1',
    's1@0.6',
    's2',
    's2@0.6',
    's1s',
    's2s',
  ]) {
    const cell = label => {
      const list = base.filter(b => b.label === label);
      const est = pigeonhole(
        list.map(b => ({
          a: b.id,
          b: b.spk,
          num: shownOf(b.r, c).some(m => m.id === b.id) ? 1 : 0,
          den: 1,
        })),
        BOOT,
      );
      return `${est.num}/${est.den} ${fmtP(est)}`;
    };
    const tally = {};
    for (const r of qmb) {
      for (const m of shownOf(r, c)) {
        if (baseKeys.has(`${r.id}|${m.id}`)) continue;
        const label = labelOf(takes.get(r.id).segments, m.id, m.s);
        tally[label] = (tally[label] ?? 0) + 1;
      }
    }
    rows.push([
      c,
      ...LABELS.map(cell),
      JSON.stringify(tally).replace(/"/g, ''),
      sum(qmb, r => addedOf(r, c).length),
    ]);
  }
  table(
    'quranmb',
    `QuranMB, planted slips read by learners (${qmb.length} takes, ${(sum(qmb, r => r.seconds) / 3600).toFixed(1)} h): marks kept of today's`,
    [
      'column',
      'hit',
      'near',
      'false on a wrong clip',
      'false on a correct clip',
      'marks today did not show',
      'added',
    ],
    rows,
    'Not held out: the two cancel thresholds were chosen on these marks. Intervals resample speakers and words.',
  );
  const learners = read('learners');
  const lrows = [];
  for (const dataset of ['sobolev', 'al-ikhlas']) {
    const x = learners.filter(r => r.truth.dataset === dataset);
    const clean = x.filter(r =>
      dataset === 'sobolev'
        ? r.truth.label === 'unknown'
        : r.truth.label === 'correct',
    );
    const wordsIn = r =>
      Math.max(
        1,
        r.truth.wordEnd
          ? r.truth.wordEnd - (r.truth.wordStart ?? 0)
          : wordsOf(r.truth.expectedKey),
      );
    const near = (list, id) => {
      const [s, a, w] = id.split(':').map(Number);
      return list.some(m => {
        const [s2, a2, w2] = m.id.split(':').map(Number);
        return s === s2 && a === a2 && Math.abs(w - w2) <= 1;
      });
    };
    for (const c of ['today', 'off', 's1', 's2', 's1s']) {
      const errors = x.flatMap(r =>
        r.truth.errors.map(e => ({e, list: shownOf(r, c)})),
      );
      lrows.push([
        dataset,
        c,
        `${x.length}, ${new Set(x.map(r => r.truth.speaker)).size}`,
        `${sum(clean, r => shownOf(r, c).length)} in ${sum(clean, wordsIn)}`,
        sum(clean, r => addedOf(r, c).length),
        `${errors.filter(z => near(z.list, z.e.id)).length} of ${errors.length}`,
      ]);
    }
  }
  table(
    'learners',
    'Learners on phones, each clip alone (small, report only)',
    [
      'set',
      'column',
      'clips, speakers',
      'marks on clips with no recorded error, in words',
      'added marks there',
      'labelled words with a mark on or next to them',
    ],
    lrows,
    "Sobolev's clean clips are not verified correct. Al-Ikhlas is its dev half by participant; the test half stays unread.",
  );
  const multi = read('sobolev_multi');
  table(
    'sobolevMulti',
    'Sobolev clips that cross an ayah',
    ['clips', 'junction fires', 'red marks, today', 's1', 's2', 'added, s1'],
    [
      [
        multi.length,
        sum(multi, r => r.fires.length),
        sum(multi, r => shownOf(r, 'today').length),
        sum(multi, r => shownOf(r, 's1').length),
        sum(multi, r => shownOf(r, 's2').length),
        sum(multi, r => addedOf(r, 's1').length),
      ],
    ],
  );
}

// -------------------------------------------------------------------------- voices
voicesTable(
  'voices',
  'Voices behind correct recitation, tuning half (10 dev reciters on dev passages), false marks per 1,000 words',
  TUNING_VOICES.map(c => [c, `voices_${c}`]),
  'Tuned on: the rule was frozen on these. Voices pass through simulated rooms, so this ranks rules and predicts no phone. Intervals resample passages and reciters.',
);

// ---------------------------------------------------------------------------- cost
costTable('cost', 'Second-model runs: how often, and whether the queue held', [
  ['pool', 'pool'],
  ['W5', 'w5'],
  ['Sobolev and Al-Ikhlas', 'learners'],
  ['QuranMB', 'quranmb'],
  ...[
    'none_0',
    'one_ar_10',
    'crowd_10',
    'one_ar_5',
    'crowd_5',
    'tv_ar_5',
    'rec_one_5',
    'rec_same_5',
  ].map(c => [c, `voices_${c}`]),
]);

// -------------------------------------------------------------------------- parity
{
  const rows = [];
  const names = [
    'pool',
    'w1',
    'w1_control',
    'w5',
    'learners',
    'quranmb',
    'live_last',
    'live_control',
    'interior',
    'sites',
    'sites_control',
    'added_kept',
    'added_app',
    'sobolev_multi',
    ...TUNING_VOICES.map(c => `voices_${c}`),
  ];
  for (const name of names) {
    const x = read(name);
    if (!x.length) continue;
    let same = 0;
    let onlyReal = 0;
    let onlyPlay = 0;
    let addedSame = 0;
    const list = [];
    for (const r of x) {
      const a = new Set(shownOf(r, 's1').map(m => m.id));
      const b = new Set(shownOf(r, 'play s1').map(m => m.id));
      const ra = [...a].filter(i => !b.has(i));
      const rb = [...b].filter(i => !a.has(i));
      onlyReal += ra.length;
      onlyPlay += rb.length;
      if (!ra.length && !rb.length) same += 1;
      else list.push(r.id);
      if (
        addedOf(r, 's1')
          .map(m => m.id)
          .sort()
          .join() ===
        addedOf(r, 'play s1')
          .map(m => m.id)
          .sort()
          .join()
      )
        addedSame += 1;
    }
    const stat = k => sum(x, r => r.real.stats?.[k] ?? 0);
    rows.push([
      name,
      x.length,
      same,
      onlyReal,
      onlyPlay,
      addedSame,
      sum(x, r => shownOf(r, 's1').length),
      stat('wakes'),
      stat('runs'),
      stat('failed'),
      stat('timeouts'),
      stat('dropped'),
      (sum(x, r => r.wallMs) / 1000 / sum(x, r => r.seconds)).toFixed(3),
      sum(x, r => r.afterEnd),
    ]);
  }
  table(
    'parity',
    'Real stack against playback at s1, 0.25 s a run',
    [
      'suite',
      'clips',
      'same red marks',
      'marks only in the real pass',
      'only in playback',
      'same added marks',
      'red marks, real',
      'wakes, real',
      'model runs, real',
      'failed open, real',
      'timeouts, real',
      'dropped, real',
      'real time per second of audio on this Mac',
      'wrapper messages after the audio ended',
    ],
    rows,
  );
}
fs.writeFileSync(path.join(FINAL, 'tables.json'), JSON.stringify(T, null, 1));
console.log(out.join('\n'));
