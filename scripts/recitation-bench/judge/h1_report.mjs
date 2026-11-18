/* eslint-env node, es2020 */
// Reads text_harness.mjs output: for each configuration, what a margin catches on
// changed words against what it costs on correct words. Engine-free, so this is
// where the judge's own constants may be read off.
//
//   node judge/h1_report.mjs <dir with changed*.jsonl, pool*.jsonl, control*.jsonl>
//     [--t "0,2,4,..."] [--detail cfgIndex] [--boot 2000]
//
// Three statistics:
//   mut    best mutashabih alternative minus the expected word (nats);
//   near   best word within edit distance 2 minus the expected word;
//   fit    minus the expected word's own score, no alternative needed.
// `said out` scores a changed word with the word really said left out of both
// sets: a mistake the sets did not foresee.
import fs from 'node:fs';
import path from 'node:path';
import {pigeonhole} from '../natural/score.mjs';

const dir = process.argv[2];
const argOf = name => {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : null;
};
const THRESHOLDS = (argOf('--t') ?? '0,1,2,3,4,5,6,8,10,12,15,20,30,40').split(',').map(Number);
const boot = Number(argOf('--boot') ?? 0);

function read(prefix) {
  const rows = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.startsWith(prefix) || !f.endsWith('.jsonl')) continue;
    for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
      if (line) rows.push(JSON.parse(line));
    }
  }
  return rows;
}
const changedRows = read('changed');
const poolRows = read('pool');
const controlRows = read('control');
const first = changedRows[0] ?? poolRows[0] ?? controlRows[0];
const configs = first.r.map(x => x.cfg);
const name = c => `D${c.D} delta${c.delta} L${c.left} R${c.right}${c.cut !== undefined ? ` cut${c.cut}` : ''}${c.tail !== undefined ? ` tail${c.tail}` : ''}${c.pad ? ` pad${c.pad}` : ''}`;
const best = (list, skip) => {
  for (const x of list) if (x.a !== skip) return x.s;
  return -Infinity;
};
const margin = (r, set, skip) => (r.tooShort ? -Infinity : best(r[set], skip) - r.expected);
const position = row => row.position ?? (row.j === 0 ? 'first' : row.j === row.n - 1 ? 'last' : 'interior');
const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) : 'na');
const per = (n, d) => (d ? ((1000 * n) / d).toFixed(2) : 'na');
const count = (rows, i, test) => rows.reduce((x, row) => x + (test(row.r[i], row) ? 1 : 0), 0);

configs.forEach((cfg, i) => {
  const changed = changedRows.filter(r => r.suite === 'changed');
  const traps = changedRows.filter(r => r.suite === 'trap');
  const groups = {
    all: changed,
    interior: changed.filter(r => position(r) === 'interior'),
    last: changed.filter(r => position(r) === 'last'),
    first: changed.filter(r => position(r) === 'first'),
    close: changed.filter(r => r.close),
  };
  console.log(
    `\n== ${name(cfg)}: changed ${changed.length} (pairs ${new Set(changed.map(r => r.unit)).size}), traps ${traps.length}, pool words ${poolRows.length} (in restart ayat ${poolRows.filter(r => r.restart).length}), control words ${controlRows.length}`,
  );
  const table = (label, stat, usesSaidOut) => {
    console.log(`-- ${label}: margin | catch all/int/last/first/close${usesSaidOut ? ' | said out: all/int/last/close' : ''} | false pool n per1000 (restart n), control n per1000, traps n`);
    for (const t of THRESHOLDS) {
      const c = Object.entries(groups).map(([, rows]) => pct(count(rows, i, x => stat(x) >= t), rows.length));
      const out = usesSaidOut
        ? ['all', 'interior', 'last', 'close'].map(k => pct(count(groups[k], i, (x, row) => stat(x, row.said) >= t), groups[k].length)).join('/')
        : null;
      const fp = count(poolRows, i, x => stat(x) >= t);
      const fr = count(poolRows.filter(r => r.restart), i, x => stat(x) >= t);
      const fc = count(controlRows, i, x => stat(x) >= t);
      const ft = count(traps, i, x => stat(x) >= t);
      console.log(
        `${String(t).padStart(5)} | ${c.join('/')}${out ? ` | ${out}` : ''} | ${fp} ${per(fp, poolRows.length)} (${fr}), ${fc} ${per(fc, controlRows.length)}, ${ft}`,
      );
    }
  };
  // How often the expected word fails to fit a correct reading, by place.
  const placeOf = r => (r.j === 0 ? 'first' : r.j === r.n - 1 ? 'last' : r.j === 1 ? 'second' : 'interior');
  const fits = {};
  for (const p of ['first', 'second', 'interior', 'last']) {
    const rows = poolRows.filter(r => placeOf(r) === p && !r.restart);
    const at = t => pct(count(rows, i, x => x.expected <= -t), rows.length);
    fits[p] = `${rows.length}: ${at(5)}/${at(10)}/${at(20)}`;
  }
  console.log(`-- correct words scoring at or below -5/-10/-20 (%): ${JSON.stringify(fits)}`);
  table('mutashabih alternatives', (x, skip) => margin(x, 'mut', skip), true);
  table('near alternatives', (x, skip) => margin(x, 'near', skip), true);
  table('either set', (x, skip) => Math.max(margin(x, 'mut', skip), margin(x, 'near', skip)), true);
  table('fit alone', x => -x.expected, false);
});

// Words behind false alarms and misses, for the first configuration, so spelling
// variants of one sound can be found by eye. Dev data only.
const detail = argOf('--detail');
if (detail !== null) {
  const i = Number(detail);
  const T = Number(argOf('--dt') ?? 8);
  const tally = new Map();
  for (const row of [...poolRows, ...controlRows]) {
    const r = row.r[i];
    const list = [...r.mut.map(x => ['m', x]), ...r.near.map(x => ['n', x])];
    for (const [kind, x] of list) {
      if (x.s - r.expected >= T) {
        const k = `${row.key}:${row.j} ${kind} alt=${x.a}`;
        const e = tally.get(k) ?? {n: 0, margin: 0, reciters: new Set(), restart: 0};
        e.n += 1;
        e.margin = Math.max(e.margin, x.s - r.expected);
        e.reciters.add(row.reciter);
        if (row.restart) e.restart += 1;
        tally.set(k, e);
      }
    }
  }
  const sorted = [...tally.entries()].sort((a, b) => b[1].n - a[1].n || b[1].margin - a[1].margin);
  console.log(`\nfalse alarms at margin ${T}: ${sorted.length} word+alternative combinations`);
  for (const [k, e] of sorted.slice(0, 80)) {
    console.log(`${k} n=${e.n} reciters=${e.reciters.size} restart=${e.restart} max=${e.margin.toFixed(1)}`);
  }
  const miss = changedRows.filter(r => r.suite === 'changed' && Math.max(margin(r.r[i], 'mut'), margin(r.r[i], 'near')) < T);
  const byPair = new Map();
  for (const row of miss) {
    const e = byPair.get(row.unit) ?? {n: 0, sum: 0, said: row.said, exp: row.key, pos: position(row)};
    e.n += 1;
    e.sum += Math.max(margin(row.r[i], 'mut'), margin(row.r[i], 'near'));
    byPair.set(row.unit, e);
  }
  console.log(`\nmisses at margin ${T}: ${miss.length} events on ${byPair.size} pairs`);
  for (const [k, e] of [...byPair.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`${k} ${e.pos} said=${e.said} n=${e.n} mean margin=${(e.sum / e.n).toFixed(1)}`);
  }
}

if (boot) {
  const i = Number(detail ?? 0);
  const T = Number(argOf('--bt') ?? 8);
  const stat = x => Math.max(margin(x, 'mut'), margin(x, 'near'));
  const rows = changedRows.filter(r => r.suite === 'changed');
  const c = pigeonhole(rows.map(r => ({a: r.unit, b: r.reciter, num: stat(r.r[i]) >= T ? 1 : 0, den: 1})), boot);
  const p = pigeonhole(poolRows.map(r => ({a: r.unit, b: r.reciter, num: stat(r.r[i]) >= T ? 1 : 0, den: 1})), boot);
  console.log(`\nintervals at margin ${T}: catch ${JSON.stringify(c)}; pool false ${JSON.stringify(p)}`);
}
