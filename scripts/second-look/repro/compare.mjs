/* eslint-env node, es2020 */
// The app's real modules against the frozen rule's stand-in: the same marks, suite by
// suite, with sample sizes and intervals, and every mark on which the two differ. Reads
// .out/second-look/repro/<suite>.jsonl (run.mjs) and .out/second-look/marks/<suite>.jsonl
// (eval_marks.mjs). Loads no model. Writes .out/second-look/repro/compare.json.
//   node scripts/second-look/repro/compare.mjs [tag]
import fs from 'node:fs';
import path from 'node:path';
import {BENCH, OUT, VOICE_CONDS} from '../lib.mjs';
import {labelOf} from '../quranmb_labels.mjs';
import {fmtP, fmtR, pigeonhole, q} from '../stats.mjs';

const tag = process.argv[2] ? `.${process.argv[2]}` : '';
const BOOT = 2000;
const REPRO = path.join(OUT, 'repro');
const CFG = {
  off: 'J.none',
  s1: 'S1.P3',
  s2: 'S2.P4',
  s1s: 'S1.P3s',
  s2s: 'S2.P4s',
};
const lines = f =>
  fs.existsSync(f)
    ? fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(l => JSON.parse(l))
    : [];
const standIn = name => lines(path.join(OUT, 'marks', `${name}.jsonl`));
const repro = name =>
  new Map(lines(path.join(REPRO, `${name}${tag}.jsonl`)).map(r => [r.id, r]));

/** The rows of a suite both sides ran. */
function both(name, filter = () => true) {
  const app = repro(name);
  return standIn(name)
    .filter(filter)
    .filter(r => app.has(r.id))
    .map(r => ({stand: r, app: app.get(r.id)}));
}
const appShown = (row, c, per, mode = 'app') =>
  row.app.cfg[c]?.[c === 'off' ? Object.keys(row.app.cfg.off)[0] : per]?.[mode]
    ?.shown ?? [];
const standShown = (row, c, mode = 'app') => row.stand.cfg[CFG[c]][mode].shown;

const PERS = ['0.25', '0.6'];
const CONFIGS = ['off', 's1', 's2', 's1s', 's2s'];
/** A setting this tag ran at all. */
const ran = (rows, c, per) =>
  rows.some(r => (c === 'off' ? r.app.cfg.off : r.app.cfg[c]?.[per]));
const out = {differences: [], suites: {}};

/** Marks on which the two differ, and the machinery's own counts. */
function differ(name, rows, modes = ['app']) {
  const table = {};
  for (const c of CONFIGS) {
    for (const per of c === 'off' ? ['-'] : PERS) {
      if (!ran(rows, c, per)) continue;
      for (const mode of modes) {
        let onlyApp = 0;
        let onlyStand = 0;
        let appN = 0;
        let standN = 0;
        const counts = {
          wakes: 0,
          step2: 0,
          first: 0,
          padded: 0,
          runs: 0,
          shown: 0,
          cancelled: 0,
          failed: 0,
          timeouts: 0,
          dropped: 0,
          droppedStep2: 0,
          queueMax: 0,
        };
        for (const row of rows) {
          const a = new Set(appShown(row, c, per, mode).map(m => m.id));
          const b = new Set(standShown(row, c, mode).map(m => m.id));
          appN += a.size;
          standN += b.size;
          for (const id of a) {
            if (!b.has(id)) {
              onlyApp += 1;
              out.differences.push({
                suite: name,
                run: row.stand.id,
                word: id,
                config: c,
                per,
                mode,
                side: 'app only',
              });
            }
          }
          for (const id of b) {
            if (!a.has(id)) {
              onlyStand += 1;
              out.differences.push({
                suite: name,
                run: row.stand.id,
                word: id,
                config: c,
                per,
                mode,
                side: 'stand-in only',
              });
            }
          }
          const stats =
            row.app.cfg[c]?.[
              c === 'off' ? Object.keys(row.app.cfg.off)[0] : per
            ]?.[mode]?.stats ?? {};
          for (const k of Object.keys(counts)) {
            counts[k] =
              k === 'queueMax'
                ? Math.max(counts[k], stats[k] ?? 0)
                : counts[k] + (stats[k] ?? 0);
          }
        }
        table[`${c} ${per} ${mode}`] = {
          runs: rows.length,
          app: appN,
          standIn: standN,
          onlyApp,
          onlyStand,
          ...counts,
        };
      }
    }
  }
  const minutes = rows.reduce((x, r) => x + r.stand.seconds, 0) / 60;
  out.suites[name] = {...out.suites[name], marks: table, minutes};
  console.log(
    `\n## ${name}: ${rows.length} runs, ${minutes.toFixed(1)} minutes`,
  );
  console.log(
    '| config, s a run, mode | marks, app | stand-in | only app | only stand-in | wakes | step 2 | model runs | a minute | padded | shown | cancelled | failed open | timeouts | dropped | queue max |',
  );
  console.log(
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  );
  for (const [k, v] of Object.entries(table)) {
    console.log(
      `| ${k} | ${v.app} | ${v.standIn} | ${v.onlyApp} | ${v.onlyStand} | ${v.wakes} | ${v.step2} | ${v.runs} | ${(v.runs / minutes).toFixed(2)} | ${v.padded} | ${v.shown} | ${v.cancelled} | ${v.failed} | ${v.timeouts} | ${v.dropped} (${v.droppedStep2}) | ${v.queueMax} |`,
    );
  }
}

const unit = t => t.block ?? t.category ?? 'x';
function falseRow(rows, words, c, per) {
  const est = side =>
    pigeonhole(
      rows.map(r => ({
        a: unit(r.stand.truth),
        b: r.stand.truth.reciter,
        num: side(r).length,
        den: words(r),
      })),
      BOOT,
    );
  const a = est(r => appShown(r, c, per));
  const b = est(r => standShown(r, c));
  return {
    words: rows.reduce((x, r) => x + words(r), 0),
    app: {marks: a.num, per1000: fmtR(a)},
    standIn: {marks: b.num, per1000: fmtR(b)},
  };
}
function falseTable(name, rows, words = r => r.stand.truth.words) {
  const t = {};
  for (const c of CONFIGS) {
    for (const per of c === 'off' ? ['-'] : PERS) {
      if (ran(rows, c, per)) t[`${c} ${per}`] = falseRow(rows, words, c, per);
    }
  }
  out.suites[name] = {...out.suites[name], falseMarks: t};
  console.log(
    `\nFalse marks per 1,000 words, ${rows.reduce((x, r) => x + words(r), 0)} words`,
  );
  console.log('| config, s a run | app | stand-in |');
  console.log('|---|---|---|');
  for (const [k, v] of Object.entries(t)) {
    console.log(
      `| ${k} | ${v.app.marks}: ${v.app.per1000} | ${v.standIn.marks}: ${v.standIn.per1000} |`,
    );
  }
}

const exactOf = t => `${t.expectedKey}:${t.target}`;
function catchRow(rows, c, per, mode) {
  const est = side =>
    pigeonhole(
      rows.map(r => ({
        a: r.stand.truth.pair,
        b: r.stand.truth.reciter,
        num: side(r).some(m => m.id === exactOf(r.stand.truth)) ? 1 : 0,
        den: 1,
      })),
      BOOT,
    );
  const a = est(r => appShown(r, c, per, mode));
  const b = est(r => standShown(r, c, mode));
  return {app: `${a.num}: ${fmtP(a)}`, standIn: `${b.num}: ${fmtP(b)}`};
}
function catchTable(title, name, rows, mode) {
  const t = {
    runs: rows.length,
    pairs: new Set(rows.map(r => r.stand.truth.pair)).size,
  };
  console.log(
    `\n${title}, ${mode}: ${t.runs} runs, ${t.pairs} pairs (marks on the exact word)`,
  );
  console.log('| config, s a run | app | stand-in |');
  console.log('|---|---|---|');
  for (const c of ['off', 's1', 's2']) {
    for (const per of c === 'off' ? ['-'] : PERS) {
      if (!ran(rows, c, per)) continue;
      const v = catchRow(rows, c, per, mode);
      t[`${c} ${per}`] = v;
      console.log(`| ${c} ${per} | ${v.app} | ${v.standIn} |`);
    }
  }
  out.suites[name] = {
    ...out.suites[name],
    [`catch ${title} ${mode}`]: t,
  };
}

/** Next word's onset in the audio, where the suite records it (eval_marks.mjs). */
function latencyTable(title, rows, mode = 'app') {
  console.log(
    `\nLatency from the next word's onset, ${title}: median / p90 in seconds`,
  );
  console.log(
    '| config, s a run | marks | app, by its own clock | stand-in, overlapping the wait |',
  );
  console.log('|---|---:|---|---|');
  // As tables.mjs reads the stand-in: the runs overlap the wait the mark already has.
  const standLatency = (row, c, per) => {
    const r = row.stand;
    const id = exactOf(r.truth);
    const m = r.cfg[CFG[c]][mode].shown.find(x => x.id === id);
    if (!m) return null;
    const check = r.cfg[CFG[c]][mode].checks
      .filter(x => x.id === id && x.ans === 'keep')
      .at(-1);
    const runs = check?.jx ? 0 : 1 + (check?.x ?? 0);
    return (
      Math.max(m.a, m.t + (runs ? 0.48 : 0) + runs * Number(per)) - r.onset
    );
  };
  for (const c of ['s1', 's2']) {
    for (const per of PERS) {
      if (!ran(rows, c, per)) continue;
      const app = [];
      const stand = [];
      for (const row of rows) {
        const onset = row.stand.onset;
        if (onset === null || onset === undefined) continue;
        const m = appShown(row, c, per, mode).find(
          x => x.id === exactOf(row.stand.truth),
        );
        if (m) app.push(m.a - onset);
        const s = standLatency(row, c, per);
        if (s !== null) stand.push(s);
      }
      console.log(
        `| ${c} ${per} | ${app.length} | ${q(app, 0.5)} / ${q(app, 0.9)} | ${q(stand, 0.5)} / ${q(stand, 0.9)} |`,
      );
    }
  }
}

// -------------------------------------------------------------------- QuranMB
{
  const rows = both('quranmb');
  if (rows.length) {
    differ('quranmb', rows);
    const takes = new Map(
      JSON.parse(
        fs.readFileSync(
          path.join(BENCH, '.out/takes/quranmb/manifest.json'),
          'utf8',
        ),
      ).map(t => [t.id, t]),
    );
    const LABELS = ['hit', 'near', 'false-incorrect', 'false-correct'];
    const base = [];
    for (const row of rows) {
      for (const m of standShown(row, 'off')) {
        const label = labelOf(takes.get(row.stand.id).segments, m.id, m.s);
        if (LABELS.includes(label)) {
          base.push({
            row,
            id: m.id,
            label,
            spk: row.stand.id.split('/')[1].split('_')[0],
          });
        }
      }
    }
    const baseKeys = new Set(base.map(b => `${b.row.stand.id}|${b.id}`));
    console.log(
      '\nQuranMB marks kept of the base, intervals resampling speakers and words',
    );
    console.log(
      '| config, s a run | hit, app | hit, stand-in | near | false-incorrect | false-correct | marks not in the base, app | stand-in |',
    );
    console.log('|---|---|---|---|---|---|---|---|');
    const t = {};
    for (const c of CONFIGS) {
      for (const per of c === 'off' ? ['-'] : PERS) {
        if (!ran(rows, c, per)) continue;
        const cell = (label, side) => {
          const list = base.filter(b => b.label === label);
          const est = pigeonhole(
            list.map(b => ({
              a: b.id,
              b: b.spk,
              num: side(b.row).some(m => m.id === b.id) ? 1 : 0,
              den: 1,
            })),
            BOOT,
          );
          return `${est.num}/${est.den} ${fmtP(est)}`;
        };
        const added = side => {
          const tally = {};
          for (const row of rows) {
            for (const m of side(row)) {
              if (baseKeys.has(`${row.stand.id}|${m.id}`)) continue;
              const label = labelOf(
                takes.get(row.stand.id).segments,
                m.id,
                m.s,
              );
              tally[label] = (tally[label] ?? 0) + 1;
            }
          }
          return JSON.stringify(tally);
        };
        const app = r => appShown(r, c, per);
        const stand = r => standShown(r, c);
        const row = {
          hit: cell('hit', app),
          hitStand: cell('hit', stand),
          near: `${cell('near', app)} / ${cell('near', stand)}`,
          falseIncorrect: `${cell('false-incorrect', app)} / ${cell('false-incorrect', stand)}`,
          falseCorrect: `${cell('false-correct', app)} / ${cell('false-correct', stand)}`,
          addedApp: added(app),
          addedStand: added(stand),
        };
        t[`${c} ${per}`] = row;
        console.log(
          `| ${c} ${per} | ${row.hit} | ${row.hitStand} | ${row.near} | ${row.falseIncorrect} | ${row.falseCorrect} | ${row.addedApp} | ${row.addedStand} |`,
        );
      }
    }
    out.suites.quranmb = {...out.suites.quranmb, kept: t};
  }
}

// ------------------------------------------------------------------- pool dev
{
  const rows = both('pool');
  if (rows.length) {
    differ('pool', rows);
    falseTable('pool', rows);
  }
}

// ------------------------------------------------------------------- W1 dev
{
  const rows = both('w1');
  if (rows.length) {
    differ('w1', rows, ['app', 'carry']);
    const changed = rows.filter(r => r.stand.truth.type === 'changed');
    const PLACES = {
      all: () => true,
      interior: t => t.position === 'interior',
      last: t => t.position === 'last',
      first: t => t.position === 'first',
      close: t => t.close,
    };
    for (const [place, f] of Object.entries(PLACES)) {
      const list = changed.filter(r => f(r.stand.truth));
      catchTable(`W1 ${place}`, 'w1', list, 'carry');
      catchTable(`W1 ${place}`, 'w1', list, 'app');
    }
    latencyTable(
      'W1 interior, clip alone',
      changed.filter(r => r.stand.truth.position === 'interior'),
    );
  }
}

// ------------------------------------------------------------------ live path dev
{
  const last = both('live_last', r => !r.stand?.truth?.control);
  const rows = last.filter(r => !r.stand.truth.control);
  if (rows.length) {
    differ('live_last', rows);
    for (const type of ['carry_last_whole', 'carry_last_ctx', 'arrive_first']) {
      catchTable(
        `live ${type}`,
        'live_last',
        rows.filter(r => r.stand.truth.type === type),
        'app',
      );
    }
    catchTable(
      'live last word',
      'live_last',
      rows.filter(r => r.stand.truth.position === 'last'),
      'app',
    );
    latencyTable(
      'live last word',
      rows.filter(r => r.stand.truth.position === 'last'),
    );
    latencyTable(
      'live first word',
      rows.filter(r => r.stand.truth.position === 'first'),
    );
  }
  const interior = both('interior');
  if (interior.length) {
    differ('interior', interior);
    catchTable('live interior', 'interior', interior, 'app');
  }
  const control = both('live_control');
  if (control.length) differ('live_control', control);
}

// ----------------------------------------------------------- chatter tuning conditions
{
  console.log(
    '\n## Voices behind correct recitation: false marks, tuning half',
  );
  const t = {};
  for (const cond of VOICE_CONDS) {
    const name = `voices_${cond}`;
    const rows = both(name);
    if (!rows.length) continue;
    differ(name, rows);
    falseTable(name, rows);
    t[cond] = rows.length;
  }
}
{
  const rows = both('sobolev');
  if (rows.length) differ('sobolev', rows);
}

const bySide = {};
for (const d of out.differences) {
  const k = `${d.suite} ${d.config} ${d.per} ${d.mode}: ${d.side}`;
  bySide[k] = (bySide[k] ?? 0) + 1;
}
out.differenceCounts = bySide;
fs.writeFileSync(path.join(REPRO, `compare${tag}.json`), JSON.stringify(out));
console.log(`\n## Every difference: ${out.differences.length} marks`);
for (const d of out.differences) {
  console.log(
    `${d.suite} | ${d.run} | ${d.word} | ${d.config} ${d.per} ${d.mode} | ${d.side}`,
  );
}
