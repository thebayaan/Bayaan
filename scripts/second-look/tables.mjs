/* eslint-env node, es2020 */
// Every number in RULE.md, from .out/second-look/marks/*.jsonl and the runs of the combined
// engine under voices. Loads no model. Writes .out/second-look/tables.json and prints a summary.
//   node scripts/second-look/tables.mjs [boot]
import fs from 'node:fs';
import path from 'node:path';
import {OUT, BENCH, SUITES, VOICE_CONDS, W1INT_CONDS} from './lib.mjs';
import {labelOf} from './quranmb_labels.mjs';
import {chooseWinner, failures} from './select.mjs';
import {fmtP, fmtR, pigeonhole, q} from './stats.mjs';

const BOOT = Number(process.argv[2] ?? 2000);
const NOISY = VOICE_CONDS.filter(c => c !== 'none_0');
const CANCELS = ['none', 'P1', 'P2', 'P3', 'P4', 'P2s', 'P3s', 'P4s'];
const CFGS = [
  'J.none',
  'J.P1',
  'J.P2',
  ...['S1', 'S1h0', 'S2', 'S2h0'].flatMap(j => CANCELS.map(c => `${j}.${c}`)),
  ...['N1', 'N2'].flatMap(j =>
    ['none', 'P1', 'P2', 'P3', 'P4'].map(c => `${j}.${c}`),
  ),
];
const read = name => {
  const f = path.join(OUT, 'marks', `${name}.jsonl`);
  if (!fs.existsSync(f)) return [];
  return fs
    .readFileSync(f, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l));
};
const shownIn = (row, cfg, mode = 'app') => row.cfg[cfg][mode].shown;
const pct = r => (r.est === null ? null : +(100 * r.est).toFixed(1));
const T = {};

// ------------------------------------------------------------------- QuranMB
{
  const rows = read('quranmb');
  const takes = new Map(
    JSON.parse(
      fs.readFileSync(
        path.join(BENCH, '.out/takes/quranmb/manifest.json'),
        'utf8',
      ),
    ).map(t => [t.id, t]),
  );
  const LABELS = ['hit', 'near', 'false-incorrect', 'false-correct'];
  // The marks with no judge and no cancel step are the base the 66 come from.
  const base = [];
  for (const r of rows) {
    for (const m of shownIn(r, 'J.none')) {
      const label = labelOf(takes.get(r.id).segments, m.id, m.s);
      if (LABELS.includes(label))
        base.push({
          run: r.id,
          id: m.id,
          label,
          spk: r.id.split('/')[1].split('_')[0],
        });
    }
  }
  const baseKeys = new Set(base.map(b => `${b.run}|${b.id}`));
  const byRun = new Map(rows.map(r => [r.id, r]));
  T.quranmb = {
    base: Object.fromEntries(
      LABELS.map(l => [l, base.filter(b => b.label === l).length]),
    ),
    speakers: new Set(base.map(b => b.spk)).size,
    cfg: {},
  };
  for (const cfg of CFGS) {
    const out = {};
    for (const l of LABELS) {
      const list = base.filter(b => b.label === l);
      const pts = list.map(b => ({
        a: b.id,
        b: b.spk,
        num: shownIn(byRun.get(b.run), cfg).some(m => m.id === b.id) ? 1 : 0,
        den: 1,
      }));
      const est = pigeonhole(pts, BOOT);
      out[l] = {kept: est.num, of: est.den, ci: fmtP(est)};
    }
    const added = {};
    for (const r of rows) {
      for (const m of shownIn(r, cfg)) {
        if (baseKeys.has(`${r.id}|${m.id}`)) continue;
        const label = labelOf(takes.get(r.id).segments, m.id, m.s);
        added[label] = (added[label] ?? 0) + 1;
      }
    }
    out.added = added;
    T.quranmb.cfg[cfg] = out;
  }
}

// ------------------------------------------------------------------- pool and W5
const unit = t => t.block ?? t.category ?? 'x';
function falseTable(rows, words) {
  const out = {
    runs: rows.length,
    words: rows.reduce((x, r) => x + words(r), 0),
    minutes: +(rows.reduce((x, r) => x + r.seconds, 0) / 60).toFixed(1),
    cfg: {},
  };
  for (const cfg of CFGS) {
    const n = rows.reduce((x, r) => x + shownIn(r, cfg).length, 0);
    const est = pigeonhole(
      rows.map(r => ({
        a: unit(r.truth),
        b: r.truth.reciter,
        num: shownIn(r, cfg).length,
        den: words(r),
      })),
      BOOT,
    );
    out.cfg[cfg] = {marks: n, per1000: fmtR(est)};
  }
  return out;
}
{
  const rows = read('pool');
  T.pool = falseTable(rows, r => r.truth.words);
  T.pool.reciters = new Set(rows.map(r => r.truth.reciter)).size;
  T.pool.passages = new Set(rows.map(r => r.truth.block)).size;
  const w5 = read('w5');
  T.w5 = falseTable(w5, r => r.truth.words);
  T.w5.byCategory = {};
  for (const c of new Set(w5.map(r => r.truth.category))) {
    const list = w5.filter(r => r.truth.category === c);
    T.w5.byCategory[c] = Object.fromEntries(
      [
        'S1.none',
        'S1.P1',
        'S1.P2',
        'S1.P3',
        'S1.P4',
        'S2.none',
        'S2.P3',
        'S2.P4',
      ].map(k => [k, list.reduce((x, r) => x + shownIn(r, k).length, 0)]),
    );
    T.w5.byCategory[c].words = list.reduce((x, r) => x + r.truth.words, 0);
  }
}

// ------------------------------------------------------------------- catches by place
const exactOf = t => `${t.expectedKey}:${t.target}`;
const PLACES = {
  all: () => true,
  interior: t => t.position === 'interior',
  last: t => t.position === 'last',
  first: t => t.position === 'first',
  close: t => t.close,
  closeInterior: t => t.close && t.position === 'interior',
  closeLast: t => t.close && t.position === 'last',
  closeFirst: t => t.close && t.position === 'first',
};
function catchTable(rows, mode) {
  const out = {};
  for (const [p, f] of Object.entries(PLACES)) {
    const list = rows.filter(r => f(r.truth));
    if (!list.length) continue;
    const row = {
      events: list.length,
      pairs: new Set(list.map(r => r.truth.pair)).size,
      reciters: new Set(list.map(r => r.truth.reciter)).size,
      cfg: {},
    };
    for (const cfg of CFGS) {
      const est = pigeonhole(
        list.map(r => ({
          a: r.truth.pair,
          b: r.truth.reciter,
          num: shownIn(r, cfg, mode).some(m => m.id === exactOf(r.truth))
            ? 1
            : 0,
          den: 1,
        })),
        BOOT,
      );
      row.cfg[cfg] = {pct: pct(est), ci: fmtP(est), num: est.num};
    }
    out[p] = row;
  }
  return out;
}
{
  const w1 = read('w1').filter(r => r.truth.type === 'changed');
  T.w1 = {carry: catchTable(w1, 'carry'), app: catchTable(w1, 'app')};
  const live = read('live_last').filter(r => !r.truth.control);
  T.live = {};
  for (const type of ['carry_last_whole', 'carry_last_ctx', 'arrive_first'])
    T.live[type] = catchTable(
      live.filter(r => r.truth.type === type),
      'app',
    ).all;
  T.live.last = catchTable(
    live.filter(r => r.truth.position === 'last'),
    'app',
  ).all;
  const interior = read('interior');
  T.live.interior = catchTable(interior, 'app').all;
  T.live.closeInterior = catchTable(interior, 'app').close ?? null;
  const closePair = JSON.parse(
    fs.readFileSync(path.join(OUT, 'live_close.json'), 'utf8'),
  );
  const closeLive = live.filter(r => closePair[r.truth.pair]?.close);
  T.live.closeLast = closeLive.some(r => r.truth.position === 'last')
    ? catchTable(
        closeLive.filter(r => r.truth.position === 'last'),
        'app',
      ).all
    : null;
  T.live.closeFirst = closeLive.some(r => r.truth.position === 'first')
    ? catchTable(
        closeLive.filter(r => r.truth.position === 'first'),
        'app',
      ).all
    : null;
  const control = read('live_control');
  T.liveControl = {
    runs: control.length,
    cfg: Object.fromEntries(
      CFGS.map(c => [c, control.reduce((x, r) => x + shownIn(r, c).length, 0)]),
    ),
  };
  const w1Other = read('w1').filter(r =>
    ['changed', 'skipped', 'added'].includes(r.truth.type),
  );
  T.w1Unchanged = {};
  for (const mode of ['app', 'carry']) {
    T.w1Unchanged[mode] = Object.fromEntries(
      CFGS.map(c => [
        c,
        w1Other.reduce((x, r) => {
          const t = r.truth;
          return (
            x +
            shownIn(r, c, mode).filter(m => {
              const [s, a, w] = m.id.split(':').map(Number);
              return (
                `${s}:${a}` !== t.expectedKey || Math.abs(w - t.target) > 1
              );
            }).length
          );
        }, 0),
      ]),
    );
  }
}

// ------------------------------------------------------------------- voices
T.voices = {};
for (const c of VOICE_CONDS) {
  const rows = read(`voices_${c}`);
  if (rows.length) T.voices[c] = falseTable(rows, r => r.truth.words);
}
T.w1int = {};
for (const c of W1INT_CONDS) {
  const rows = read(`w1int_${c}`);
  if (!rows.length) continue;
  const out = {
    runs: rows.length,
    pairs: new Set(rows.map(r => r.truth.pair)).size,
    cfg: {},
  };
  for (const cfg of CFGS) {
    const est = pigeonhole(
      rows.map(r => ({
        a: r.truth.pair,
        b: r.truth.reciter,
        num: shownIn(r, cfg).some(m => m.id === exactOf(r.truth)) ? 1 : 0,
        den: 1,
      })),
      BOOT,
    );
    out.cfg[cfg] = {num: est.num, ci: fmtP(est)};
  }
  T.w1int[c] = out;
}

// ------------------------------------------------------------------- model runs
/** Over marks reaching the cancel step: the judge's run plus what the candidate adds. */
function runsPerMark(rows, cfg, mode = 'app') {
  const checks = rows.flatMap(r => r.cfg[cfg][mode].checks).filter(c => !c.jx);
  if (!checks.length) return null;
  const judge = cfg.startsWith('J') ? 0 : 1;
  return {
    marks: checks.length,
    perMark: +(
      judge +
      checks.reduce((x, c) => x + c.x, 0) / checks.length
    ).toFixed(2),
    cancelled: checks.filter(c => c.ans === 'cancel').length,
  };
}
function perMinute(rows, cfg) {
  const key = cfg.split('.')[0];
  const minutes = rows.reduce((x, r) => x + r.seconds, 0) / 60;
  const wakes = rows.reduce((x, r) => x + (r.wakes[key]?.wakes ?? 0), 0);
  const slices = rows.reduce((x, r) => x + (r.wakes[key]?.slices ?? 0), 0);
  const extra = rows.reduce(
    (x, r) => x + r.cfg[cfg].app.checks.reduce((y, c) => y + c.x, 0),
    0,
  );
  const suspects = rows.reduce((x, r) => x + r.cfg[cfg].app.suspects, 0);
  return {
    minutes: +minutes.toFixed(1),
    wakes,
    slices,
    extra,
    suspects,
    wakesPerMin: +(wakes / minutes).toFixed(2),
    slicesPerMin: +(slices / minutes).toFixed(2),
    runsPerMin: +((slices + extra) / minutes).toFixed(2),
    suspectsPerMin: +(suspects / minutes).toFixed(2),
  };
}
T.runs = {};
{
  const pops = {
    pool: read('pool'),
    w5: read('w5'),
    w1: read('w1'),
    quranmb: read('quranmb'),
    sobolev: read('sobolev'),
  };
  for (const c of NOISY) pops[`voices_${c}`] = read(`voices_${c}`);
  pops.voices_none_0 = read('voices_none_0');
  for (const [p, rows] of Object.entries(pops)) {
    if (!rows.length) continue;
    T.runs[p] = {};
    for (const cfg of CFGS)
      T.runs[p][cfg] = {...runsPerMark(rows, cfg), ...perMinute(rows, cfg)};
  }
}

// ------------------------------------------------------------------- latency
function latencies(rows, cfg, mode, R) {
  const hold = cfg.startsWith('J')
    ? 0
    : cfg.split('.')[0].endsWith('h0')
      ? 0
      : 0.48;
  const judge = cfg.startsWith('J') ? 0 : 1;
  const out = [];
  for (const r of rows) {
    if (r.onset === null || r.onset === undefined) continue;
    const id = exactOf(r.truth);
    const m = shownIn(r, cfg, mode).find(x => x.id === id);
    if (!m) continue;
    const c = r.cfg[cfg][mode].checks
      .filter(x => x.id === id && x.ans === 'keep')
      .at(-1);
    // A junction mark wakes no model; otherwise the runs overlap the wait the mark already has.
    const runs = c?.jx ? 0 : judge + (c?.x ?? 0);
    out.push(Math.max(m.a, m.t + (runs ? hold : 0) + runs * R) - r.onset);
  }
  return out;
}
{
  const w1 = read('w1').filter(r => r.truth.type === 'changed');
  const live = read('live_last').filter(r => !r.truth.control);
  const interior = read('interior');
  const sets = {
    'W1 interior, clip alone': [
      w1.filter(r => r.truth.position === 'interior'),
      'app',
    ],
    'live interior': [interior, 'app'],
    'live last word': [live.filter(r => r.truth.position === 'last'), 'app'],
    'live first word': [live.filter(r => r.truth.position === 'first'), 'app'],
  };
  T.latency = {};
  for (const [name, [rows, mode]] of Object.entries(sets)) {
    T.latency[name] = {};
    for (const cfg of CFGS) {
      const a = latencies(rows, cfg, mode, 0.25);
      const b = latencies(rows, cfg, mode, 0.6);
      T.latency[name][cfg] = {
        n: a.length,
        at025: [q(a, 0.5), q(a, 0.9)],
        at06: [q(b, 0.5), q(b, 0.9)],
      };
    }
  }
}

// ------------------------------------------------------------------- does the rule transfer?
{
  // With no veto, so that all base marks reach the cancel step, the rule on its measured slice
  // against the same rule on the judge's slice.
  const rows = read('quranmb');
  const takes = new Map(
    JSON.parse(
      fs.readFileSync(
        path.join(BENCH, '.out/takes/quranmb/manifest.json'),
        'utf8',
      ),
    ).map(t => [t.id, t]),
  );
  const tally = {};
  for (const r of rows) {
    for (const m of shownIn(r, 'J.none')) {
      const label = labelOf(takes.get(r.id).segments, m.id, m.s);
      if (!['hit', 'near', 'false-incorrect', 'false-correct'].includes(label))
        continue;
      const a = shownIn(r, 'N1.P2').some(x => x.id === m.id);
      const b = shownIn(r, 'N1.P3').some(x => x.id === m.id);
      const n = shownIn(r, 'N1.none').some(x => x.id === m.id);
      if (!n) continue;
      const t = (tally[label] ??= {
        both: 0,
        onlyMeasuredSlice: 0,
        onlyJudgeSlice: 0,
        neither: 0,
      });
      t[
        a && b
          ? 'both'
          : a
            ? 'onlyMeasuredSlice'
            : b
              ? 'onlyJudgeSlice'
              : 'neither'
      ] += 1;
    }
  }
  T.transfer = tally;
  // Where the two first passes put the word, and what they score it, on the same marks.
  const span = [];
  for (const r of rows) {
    const shipOf = new Map(
      r.cfg['N1.P2'].app.checks.map(c => [
        `${c.id}|${c.t}`,
        r.features.ship[c.sk],
      ]),
    );
    for (const c of r.cfg['N1.P3'].app.checks) {
      const a = shipOf.get(`${c.id}|${c.t}`);
      const b = r.features.judge[c.jk];
      if (a?.ws === undefined || b?.ws === undefined) continue;
      span.push({
        ds: Math.abs(a.ws - b.ws),
        de: Math.abs(a.we - b.we),
        a: a.perLetter,
        b: b.perLetter,
      });
    }
  }
  T.transferSpan = {
    marks: span.length,
    wordStartMedian: q(
      span.map(x => x.ds),
      0.5,
    ),
    wordStartP90: q(
      span.map(x => x.ds),
      0.9,
    ),
    wordEndMedian: q(
      span.map(x => x.de),
      0.5,
    ),
    wordEndP90: q(
      span.map(x => x.de),
      0.9,
    ),
    firstAtOrBelow6: {
      measuredSlice: span.filter(x => x.a <= -6).length,
      judgeSlice: span.filter(x => x.b <= -6).length,
      both: span.filter(x => x.a <= -6 && x.b <= -6).length,
    },
  };
  const sob = read('sobolev');
  const clean = sob.filter(
    r => r.truth.label === 'unknown' && r.truth.wordEnd !== undefined,
  );
  const words = clean.reduce(
    (x, r) => x + Math.max(1, r.truth.wordEnd - (r.truth.wordStart ?? 0)),
    0,
  );
  T.sobolev = {
    clips: sob.length,
    minutes: +(sob.reduce((x, r) => x + r.seconds, 0) / 60).toFixed(1),
    cleanClips: clean.length,
    cleanWords: words,
    cfg: {},
  };
  for (const cfg of CFGS) {
    T.sobolev.cfg[cfg] = {
      marksOnClean: clean.reduce((x, r) => x + shownIn(r, cfg).length, 0),
      labelledCaught: sob.reduce(
        (x, r) =>
          x +
          (r.truth.errorIds ?? []).filter(id =>
            shownIn(r, cfg).some(m => m.id === id),
          ).length,
        0,
      ),
    };
  }
  T.sobolev.labelled = sob.reduce(
    (x, r) => x + (r.truth.errorIds ?? []).length,
    0,
  );
}

// ------------------------------------------------------------------- all marks together
{
  // Red marks on the plain engine's runs, plus the combined engine's junction and added marks.
  // A shown added mark clears red on its two neighbours.
  const file = path.join(OUT, 'voices_combined.json');
  const VC = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : {};
  T.together = {};
  const together = (rows, vc, cfg) => {
    const added = vc.added ?? [];
    let red = 0;
    let cleared = 0;
    for (const r of rows) {
      const near = new Set(
        added.filter(a => a.run === r.id).flatMap(a => [a.left, a.right]),
      );
      for (const m of shownIn(r, cfg)) {
        red += 1;
        if (near.has(m.id)) cleared += 1;
      }
    }
    return {
      red,
      cleared,
      junction: vc.junctionMarksShown ?? 0,
      added: added.length,
      total: red - cleared + (vc.junctionMarksShown ?? 0) + added.length,
    };
  };
  for (const c of Object.keys(VC)) {
    if (c === 'pool_dev') continue;
    if (VC[c].runs !== VC[c].of) continue;
    const rows = read(`voices_${c}`);
    if (!rows.length) continue;
    T.together[c] = {
      words: VC[c].words,
      cfg: Object.fromEntries(CFGS.map(k => [k, together(rows, VC[c], k)])),
    };
  }
  if (VC.pool_dev) {
    const rows = read('pool');
    // The pool's runs are the combined engine's: junction marks are already among its red marks.
    T.together.pool_dev = {
      words: VC.pool_dev.words,
      cfg: Object.fromEntries(
        CFGS.map(k => [k, together(rows, VC.pool_dev, k)]),
      ),
    };
  }
}

// ------------------------------------------------------------------- hold 0 against 0.48
{
  // The same candidate at the two holds, run by run, so that the interval is on the difference.
  const fmtDiff = r =>
    r.est === null
      ? '-'
      : `${r.num > 0 ? '+' : ''}${r.num} marks, ${(1000 * r.est).toFixed(2)} [${(1000 * (r.lo ?? 0)).toFixed(2)}, ${(1000 * (r.hi ?? 0)).toFixed(2)}] per 1,000`;
  const level = (conds, a, b) => {
    const pts = conds.flatMap(c =>
      read(`voices_${c}`).map(r => ({
        a: r.truth.block,
        b: r.truth.reciter,
        num: shownIn(r, a).length - shownIn(r, b).length,
        den: r.truth.words,
      })),
    );
    return fmtDiff(pigeonhole(pts, BOOT));
  };
  const rows = read('quranmb');
  const takes = new Map(
    JSON.parse(
      fs.readFileSync(
        path.join(BENCH, '.out/takes/quranmb/manifest.json'),
        'utf8',
      ),
    ).map(t => [t.id, t]),
  );
  const learner = (a, b, labels) => {
    const pts = [];
    for (const r of rows) {
      for (const m of shownIn(r, 'J.none')) {
        if (!labels.includes(labelOf(takes.get(r.id).segments, m.id, m.s)))
          continue;
        const has = c => (shownIn(r, c).some(x => x.id === m.id) ? 1 : 0);
        pts.push({
          a: m.id,
          b: r.id.split('/')[1].split('_')[0],
          num: has(a) - has(b),
          den: 1,
        });
      }
    }
    const e = pigeonhole(pts, BOOT);
    return `${e.num > 0 ? '+' : ''}${e.num} of ${e.den} [${((e.lo ?? 0) * e.den).toFixed(1)}, ${((e.hi ?? 0) * e.den).toFixed(1)}]`;
  };
  const pair = (a, b) => ({
    voices10dB: level(
      NOISY.filter(c => c.endsWith('_10')),
      a,
      b,
    ),
    voices5dB: level(
      NOISY.filter(c => c.endsWith('_5')),
      a,
      b,
    ),
    realSlips: learner(a, b, ['hit']),
    near: learner(a, b, ['near']),
    learnerFalse: learner(a, b, ['false-incorrect', 'false-correct']),
    pool: T.pool.cfg[a].marks - T.pool.cfg[b].marks,
    w5: T.w5.cfg[a].marks - T.w5.cfg[b].marks,
  });
  T.compare = {
    holdZeroStep1: pair('S1h0.P3', 'S1.P3'),
    holdZeroStep2: pair('S2h0.P4', 'S2.P4'),
    noVetoStep1: pair('N1.P3', 'S1.P3'),
    p4AgainstP3Step1: pair('S1.P4', 'S1.P3'),
  };
}

// ------------------------------------------------------------------- the selection
function metrics(j, c) {
  const k = `${j}.${c}`;
  return {
    slips: T.quranmb.cfg[k].hit.kept,
    pool: T.pool.cfg[k].marks,
    w1: Object.fromEntries(
      ['interior', 'last', 'first', 'close'].map(p => [
        p,
        T.w1.carry[p].cfg[k].pct,
      ]),
    ),
    voices: Object.fromEntries(NOISY.map(v => [v, T.voices[v].cfg[k].marks])),
  };
}
if (
  T.pool.runs &&
  T.quranmb.base.hit &&
  Object.keys(T.voices).length === VOICE_CONDS.length
) {
  T.selection = {};
  for (const step of ['S1', 'S2']) {
    const cands = Object.fromEntries(
      ['P1', 'P2', 'P3', 'P4'].map(c => [c, metrics(step, c)]),
    );
    const {best, why, winner, closest} = chooseWinner(cands);
    const out = {
      metrics: cands,
      noCancel: metrics(step, 'none'),
      best,
      why,
      winner,
      closest,
    };
    const pick = winner ?? closest;
    const h0 = metrics(`${step}h0`, pick);
    out.P5 = {of: pick, metrics: h0, why: failures(h0, best)};
    // The same limits with the 10% read as a share of what today's rules show in each condition.
    const today = metrics('J', 'none').voices;
    const other = chooseWinner(cands, today);
    out.otherReading = {
      why: other.why,
      winner: other.winner,
      P5: {
        of: other.winner ?? other.closest,
        why: failures(
          metrics(`${step}h0`, other.winner ?? other.closest),
          best,
          today,
        ),
      },
    };
    T.selection[step] = out;
  }
}

fs.writeFileSync(path.join(OUT, 'tables.json'), JSON.stringify(T, null, 1));
console.log(JSON.stringify(T.selection ?? 'no selection yet', null, 1));
void SUITES;
