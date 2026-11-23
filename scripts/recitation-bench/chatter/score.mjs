/* eslint-env node, es2020 */
// Scores the chatter runs through the app's real mark rules, against the same
// clips with nothing behind them. Every clip is correct recitation, so every mark
// and every ayah flag is false. Words followed and places lost are reported beside
// them, since an app that stops following also stops marking.
//
//   node chatter/score.mjs [--variant shipped] [--against variant]
//
// Writes .out/chatter/scoreboard.<variant>.md and .json.
import fs from 'node:fs';
import path from 'node:path';
import {replay, shownFlags} from '../natural/replay.mjs';
import {offTrackEpisodes} from '../natural/score.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const BENCH = path.resolve(HERE, '..');
const OUT = path.join(BENCH, '.out/chatter');
const BASELINE = path.join(BENCH, '.out/natural/baseline/runs/pool');
const words = JSON.parse(
  fs.readFileSync(path.join(BENCH, '.out/natural/manifests/engine_words.json'), 'utf8'),
);
const wordCount = (s, a) => words[`${s}:${a}`];
const LOST = new Set(['lost', 'relocated', 'locateFailed']);

const arg = name => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};

function loadRuns(dir, only = null) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .filter(r => !only || only.has(r.clip.id));
}

export function lostCount(run) {
  let n = 0;
  for (const e of run.log) {
    if (e.stop || e.type !== 'debug') continue;
    if (LOST.has(e.event) || (e.event === 'idle' && e.reason === 'lost')) n++;
  }
  return n;
}

export function row(run) {
  const truth = run.clip.truth;
  const rep = replay(run, {mode: 'app', wordCount});
  const inRun = new Set(truth.ayat.map(a => a.key));
  const last = new Map();
  for (const c of run.vchanges) {
    if (!c.stop) last.set(c.id, c.to);
  }
  let judged = 0;
  let ok = 0;
  for (const [id, state] of last) {
    const [s, a] = id.split(':');
    if (!inRun.has(`${s}:${a}`) || state === 'pending') continue;
    judged++;
    if (state === 'ok') ok++;
  }
  const marks = [...rep.visible.values()];
  const flags = shownFlags(run).filter(f => !f.stop);
  const parts = run.partsAt ?? run.clip.partsAt;
  return {
    id: run.clip.id,
    reciter: truth.reciter,
    seconds: run.summary.seconds,
    words: truth.words,
    falseMarks: marks.length,
    stayedRed: marks.filter(m => !m.corrected).length,
    flags: flags.length,
    lost: lostCount(run),
    offTrack: offTrackEpisodes({...run, partsAt: parts}).length,
    judged,
    ok,
  };
}

/** Rows with one reciter's take resampled together, for a seeded 95% interval. */
export function interval(rows, rate, seed = 12345, rounds = 1000) {
  const reciters = [...new Set(rows.map(r => r.reciter))];
  let state = seed;
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const groups = new Map(reciters.map(n => [n, rows.filter(r => r.reciter === n)]));
  const out = [];
  for (let i = 0; i < rounds; i++) {
    const take = [];
    for (let k = 0; k < reciters.length; k++) {
      take.push(...groups.get(reciters[Math.floor(random() * reciters.length)]));
    }
    out.push(rate(take));
  }
  out.sort((a, b) => a - b);
  return [out[Math.floor(rounds * 0.025)], out[Math.floor(rounds * 0.975)]];
}

const sum = (rows, f) => rows.reduce((n, r) => n + f(r), 0);
const per1000 = rows => (1000 * sum(rows, r => r.falseMarks)) / Math.max(1, sum(rows, r => r.words));

function summary(name, rows) {
  const minutes = sum(rows, r => r.seconds) / 60;
  const [low, high] = rows.length ? interval(rows, per1000) : [0, 0];
  return {
    condition: name,
    takes: rows.length,
    minutes: +minutes.toFixed(1),
    words: sum(rows, r => r.words),
    falseMarks: sum(rows, r => r.falseMarks),
    stayedRed: sum(rows, r => r.stayedRed),
    per1000: +per1000(rows).toFixed(2),
    low: +low.toFixed(2),
    high: +high.toFixed(2),
    perMinute: +(sum(rows, r => r.falseMarks) / Math.max(1e-9, minutes)).toFixed(3),
    ayahFlags: sum(rows, r => r.flags),
    lostPerHour: +((60 * sum(rows, r => r.lost)) / Math.max(1e-9, minutes)).toFixed(1),
    offTrack: sum(rows, r => r.offTrack),
    followedPct: +((100 * sum(rows, r => r.judged)) / Math.max(1, sum(rows, r => r.words))).toFixed(1),
    okPct: +((100 * sum(rows, r => r.ok)) / Math.max(1, sum(rows, r => r.words))).toFixed(1),
  };
}

/** Chatter alone: nothing is being recited, so anything followed is false. */
function aloneRow(run) {
  const progress = run.log.filter(e => e.type === 'word_progress' && !e.stop);
  const rep = replay(run, {mode: 'app', wordCount});
  const keys = new Set(progress.map(e => e.key));
  return {
    id: run.clip.id,
    track: run.clip.truth.track,
    seconds: run.summary.seconds,
    wordReports: progress.length,
    ayat: [...keys].slice(0, 12),
    marks: rep.visible.size,
    flags: shownFlags(run).filter(f => !f.stop).length,
  };
}

function parityCheck(rows) {
  const out = [];
  for (const run of rows) {
    const file = path.join(BASELINE, `${String(run.clip.id).replace(/[^\w.-]/g, '_')}.json`);
    if (!fs.existsSync(file)) continue;
    const base = JSON.parse(fs.readFileSync(file, 'utf8'));
    const same = JSON.stringify(base.vchanges) === JSON.stringify(run.vchanges);
    out.push({id: run.clip.id, same});
  }
  return out;
}

function main() {
  const variant = arg('variant') ?? 'shipped';
  const root = path.join(OUT, 'runs', variant);
  const clips = new Set(JSON.parse(fs.readFileSync(path.join(OUT, 'clips.json'), 'utf8')));
  const table = [];
  const baseRows = loadRuns(BASELINE, clips).map(row);
  table.push(summary('nothing behind (natural baseline)', baseRows));
  const alone = [];
  let parity = [];
  // A stopped run leaves its .shards_ folder behind; those hold inputs, not results.
  const conds = fs.existsSync(root)
    ? fs.readdirSync(root).filter(c => !c.startsWith('.')).sort()
    : [];
  for (const cond of conds) {
    const dir = path.join(root, cond);
    if (cond.startsWith('alone_')) {
      alone.push(...loadRuns(dir).map(aloneRow));
    } else if (cond.startsWith('none_')) {
      parity = parityCheck(loadRuns(dir));
    } else {
      table.push(summary(cond, loadRuns(dir, clips).map(row)));
    }
  }
  const out = [];
  out.push(`# Chatter behind correct recitation: ${variant}`, '');
  out.push(
    '| Condition | Takes | Min | Words | False marks | Per 1,000 (95% by reciter) | Per min | Ayah flags | Place lost per hour | Off track | Words judged | Words ok |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
  );
  for (const r of table) {
    out.push(
      `| ${r.condition} | ${r.takes} | ${r.minutes} | ${r.words} | ${r.falseMarks} | ${r.per1000} (${r.low}-${r.high}) | ${r.perMinute} | ${r.ayahFlags} | ${r.lostPerHour} | ${r.offTrack} | ${r.followedPct}% | ${r.okPct}% |`,
    );
  }
  if (parity.length) {
    const bad = parity.filter(p => !p.same);
    out.push('', `Harness check, nothing added against the baseline: ${parity.length - bad.length}/${parity.length} identical.`);
    for (const p of bad.slice(0, 5)) out.push(`- differs: ${p.id}`);
  }
  if (alone.length) {
    out.push('', '## Chatter with no recitation at all', '', '| Track | Windows | Min | Word reports | Marks | Ayah flags | Ayat followed |', '|---|---|---|---|---|---|---|');
    for (const track of [...new Set(alone.map(a => a.track))]) {
      const rows = alone.filter(a => a.track === track);
      const ayat = [...new Set(rows.flatMap(r => r.ayat))].slice(0, 10).join(' ');
      out.push(`| ${track} | ${rows.length} | ${(sum(rows, r => r.seconds) / 60).toFixed(0)} | ${sum(rows, r => r.wordReports)} | ${sum(rows, r => r.marks)} | ${sum(rows, r => r.flags)} | ${ayat} |`);
    }
  }
  const text = out.join('\n') + '\n';
  fs.writeFileSync(path.join(OUT, `scoreboard.${variant}.md`), text);
  fs.writeFileSync(path.join(OUT, `scoreboard.${variant}.json`), JSON.stringify({table, parity, alone}, null, 1));
  console.log(text);
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main();
}
