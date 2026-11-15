/* eslint-env node, es2020 */
// Scores the natural benchmark: every run a bench wrote for the W1, control,
// pool and W5 manifests, through the app's real mark rules (replay.mjs).
//
//   node natural/score.mjs --runs .out/natural/baseline/runs
//     [--out .out/natural/baseline] [--boot 2000] [--split dev|test]
//
// WORD_MARKS=<file> replays another version of the rules.
//
// Each catch is reported four ways, from what the app hears to what the engine
// says:
//   app     the marks the app shows: live verdicts through the real rules;
//   flush   plus the harness's end-of-input flush on the clip's last words;
//   carry   plus a correct next word, as when the reader carries on;
//   engine  the engine called the word wrong or skipped at some point, whatever
//           the rules then did.
// A mark on the word itself or on one next to it counts as a catch; `exact`
// counts the word itself. Any other mark is false.
//
// Intervals resample independent units two ways at once (pairs and reciters;
// passages and reciters), 95% percentile. A count of events is not a sample
// size: the pairs are.
//
// Writes under --out: scoreboard.json, scoreboard.md, events.jsonl (every W1
// event with the engine's verdicts), missed.jsonl and missed_summary.json (why
// each missed event was missed), pool_marks.jsonl (each false mark on the pool),
// by_pair.json.
import fs from 'node:fs';
import path from 'node:path';
import {marks, replay, shownFlags} from './replay.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT_ROOT = path.resolve(HERE, '../.out/natural');
const MAN = path.join(OUT_ROOT, 'manifests');
const MODES = ['app', 'flush', 'carry'];
const BAD = new Set(['wrong', 'skipped']);
const LOST_EVENTS = new Set(['lost', 'relocated', 'locateFailed']);

export function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, '')] = argv[i + 1];
  }
  return args;
}

// ------------------------------------------------------------ word bookkeeping

function loadEngineWords(file = path.join(MAN, 'engine_words.json')) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Words next to an event: a mark there is the event's, not a false one. */
export function nearSet(truth, words, nextKeyExists) {
  const key = truth.expectedKey;
  const out = new Set();
  const add = (k, w, n) => {
    if (w >= 0 && w < n) out.add(`${k}:${w}`);
  };
  const n = words(key);
  const [s, a] = key.split(':').map(Number);
  switch (truth.type) {
    case 'changed':
    case 'skipped':
      add(key, truth.target - 1, n);
      add(key, truth.target, n);
      add(key, truth.target + 1, n);
      break;
    case 'added':
      add(key, truth.target - 1, n);
      add(key, truth.target, n);
      break;
    case 'dropped_last':
      add(key, n - 2, n);
      add(key, n - 1, n);
      break;
    case 'added_last':
    case 'junction':
      add(key, n - 2, n);
      add(key, n - 1, n);
      if (nextKeyExists(`${s}:${a + 1}`)) out.add(`${s}:${a + 1}:0`);
      break;
    default:
      break;
  }
  return out;
}

export function exactId(truth, words) {
  const key = truth.expectedKey;
  if (truth.type === 'changed' || truth.type === 'skipped' || truth.type === 'trap') {
    return `${key}:${truth.target}`;
  }
  if (truth.type === 'dropped_last' || truth.type === 'junction') {
    return `${key}:${words(key) - 1}`;
  }
  return null;
}

// ------------------------------------------------------------------ statistics

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Point and 95% interval of Σnum/Σden, resampling two crossed units together.
 * rows: [{a, b, num, den}]. Returns {est, lo, hi, num, den, unitsA, unitsB}.
 */
export function pigeonhole(rows, boot, seed = 12345) {
  const num = rows.reduce((x, r) => x + r.num, 0);
  const den = rows.reduce((x, r) => x + r.den, 0);
  const as = [...new Set(rows.map(r => r.a))];
  const bs = [...new Set(rows.map(r => r.b))];
  const out = {
    est: den ? num / den : null,
    lo: null,
    hi: null,
    num,
    den,
    unitsA: as.length,
    unitsB: bs.length,
  };
  if (!rows.length || !den || !boot) return out;
  const ia = new Map(as.map((x, i) => [x, i]));
  const ib = new Map(bs.map((x, i) => [x, i]));
  const cells = new Map();
  for (const r of rows) {
    const k = ia.get(r.a) * bs.length + ib.get(r.b);
    const c = cells.get(k) ?? {a: ia.get(r.a), b: ib.get(r.b), num: 0, den: 0};
    c.num += r.num;
    c.den += r.den;
    cells.set(k, c);
  }
  const list = [...cells.values()];
  const rand = mulberry32(seed);
  const stats = [];
  const wa = new Int32Array(as.length);
  const wb = new Int32Array(bs.length);
  for (let i = 0; i < boot; i++) {
    wa.fill(0);
    wb.fill(0);
    for (let j = 0; j < as.length; j++) wa[Math.floor(rand() * as.length)]++;
    for (let j = 0; j < bs.length; j++) wb[Math.floor(rand() * bs.length)]++;
    let n = 0;
    let d = 0;
    for (const c of list) {
      const w = wa[c.a] * wb[c.b];
      if (w) {
        n += w * c.num;
        d += w * c.den;
      }
    }
    if (d > 0) stats.push(n / d);
  }
  stats.sort((x, y) => x - y);
  if (stats.length) {
    out.lo = stats[Math.floor(0.025 * stats.length)];
    out.hi = stats[Math.min(stats.length - 1, Math.floor(0.975 * stats.length))];
  }
  return out;
}

/** Upper end of the exact 95% interval of a Poisson count (before clustering). */
export function poissonUpper(k) {
  let lo = k;
  let hi = k + 10 + 6 * Math.sqrt(k + 1);
  const below = m => {
    let term = Math.exp(-m);
    let sum = term;
    for (let i = 1; i <= k; i++) {
      term *= m / i;
      sum += term;
    }
    return sum;
  };
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (below(mid) > 0.025) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
function pct(xs, p) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

// ------------------------------------------------------------------ tracking

function lostPlace(run) {
  const out = {lost: 0, relocated: 0, locateFailed: 0, idleLost: 0, idleSilent: 0};
  for (const e of run.log) {
    if (e.stop || e.type !== 'debug') continue;
    if (e.event === 'idle') out[e.reason === 'lost' ? 'idleLost' : 'idleSilent']++;
    else if (LOST_EVENTS.has(e.event)) out[e.event]++;
  }
  // These recordings have no pause near 8 s, so a silent idle here is the engine
  // dropping the place while the reader goes on, not the reader stopping.
  out.total = out.lost + out.relocated + out.locateFailed + out.idleLost + out.idleSilent;
  return out;
}

/**
 * Times the cursor left what was being recited, judged from the recordings'
 * own order: an episode is at least minSec of cursor reports more than one ayah
 * from every ayah recited in the last four seconds.
 */
export function offTrackEpisodes(run, minSec = 3) {
  if (!run.partsAt?.length) return [];
  const parts = run.partsAt;
  const expected = (t, key) => {
    const [cs, ca] = key.split(':').map(Number);
    for (const p of parts) {
      if (p.end < t - 4 || p.start > t) continue;
      const [s, a] = p.key.split(':').map(Number);
      if (s === cs && Math.abs(a - ca) <= 1) return true;
    }
    return false;
  };
  const episodes = [];
  let start = null;
  let last = null;
  for (const e of run.log) {
    if (e.stop || e.type !== 'word_progress') continue;
    if (expected(e.t, e.key)) {
      if (start !== null && last - start >= minSec) episodes.push({from: start, to: last});
      start = null;
    } else {
      if (start === null) start = e.t;
      last = e.t;
    }
  }
  if (start !== null && last - start >= minSec) episodes.push({from: start, to: last});
  return episodes;
}

// --------------------------------------------------------------------- events

/** One W1 or control run, reduced to what the scoreboard and the steps after it need. */
export function scoreEvent(run, words, hasKey) {
  const truth = run.clip.truth;
  const near = nearSet(truth, words, hasKey);
  const exact = exactId(truth, words);
  const keyX = truth.expectedKey;
  const n = words(keyX);
  const reps = {};
  for (const mode of MODES) reps[mode] = replay(run, {mode, wordCount: (s, a) => words(`${s}:${a}`) ?? undefined});
  const row = {
    id: run.clip.id,
    suite: run.clip.suite,
    type: truth.type,
    pair: truth.pair ?? null,
    pairSplit: truth.pairSplit ?? null,
    reciter: truth.reciter,
    reciterSplit: truth.reciterSplit,
    audioKey: truth.audioKey,
    expectedKey: keyX,
    target: truth.target ?? null,
    position: truth.position ?? null,
    close: truth.close ?? null,
    textDistance: truth.textDistance ?? null,
    phonDistance: truth.phonDistance ?? null,
    short: truth.short ?? false,
    seconds: run.summary.seconds,
    words: n,
    caught: {},
    exact: {},
    marks: {},
    falseMarks: {},
    falseOnX: {},
  };
  // Words of X the recording reads, for the false-mark rate.
  const startWord = truth.startWord ?? 0;
  const recited = Math.max(0, n - startWord);
  const nearInX = [...near].filter(id => id.startsWith(`${keyX}:`)).length;
  row.unchangedWords = truth.type === 'junction' ? 0 : Math.max(0, recited - nearInX);
  for (const mode of MODES) {
    const {visible} = reps[mode];
    const list = [...visible.entries()].map(([id, m]) => ({
      id,
      kind: m.kind,
      since: m.since,
      shownAt: m.shownAt,
      corrected: m.corrected,
      viaFlush: m.viaFlush,
    }));
    row.marks[mode] = list;
    row.caught[mode] = list.some(m => near.has(m.id));
    row.exact[mode] = exact ? list.some(m => m.id === exact) : false;
    const falses = list.filter(m => !near.has(m.id));
    // Words before the shared text of a junction differ by construction.
    row.falseMarks[mode] = truth.type === 'junction' ? 0 : falses.length;
    row.falseOnX[mode] = falses.filter(m => m.id.startsWith(`${keyX}:`)).length;
  }
  // What the engine said about the event's word(s).
  const targetIds = [...(exact ? [exact] : near)];
  const carry = reps.carry;
  const trailOf = id => carry.trail.get(id) ?? [];
  const pendingLive = run.vchanges.some(c => !c.stop && targetIds.includes(c.id) && c.to === 'pending');
  row.verdicts = {};
  for (const id of near.size ? near : targetIds) row.verdicts[id] = trailOf(id);
  row.engineBad = targetIds.some(id => trailOf(id).some(v => BAD.has(v.state)));
  row.engineBadLive = targetIds.some(id => trailOf(id).some(v => BAD.has(v.state) && !v.flush));
  const flushOf = run.flush?.verdicts?.find(v => v.id === (exact ?? targetIds[0]));
  row.flushTarget = flushOf ? {state: flushOf.state, newly: flushOf.newly, d: flushOf.d} : null;
  const heardOf = run.flush?.words?.find(w => w.id === (exact ?? targetIds[0]));
  row.heardTarget = heardOf ? heardOf.heard : null;
  row.reasons = Object.fromEntries(
    MODES.map(m => [m, targetIds.flatMap(id => reps[m].reasons.get(id) ?? [])]),
  );
  row.miss = row.caught.carry ? null : missClass(targetIds, carry, pendingLive);
  // Flags in the end-of-take summary.
  const flags = shownFlags(run);
  row.flagged = flags.some(
    f =>
      f.key === keyX &&
      (f.shown === 'similarAyah' ||
        f.shown === 'skippedAyah' ||
        near.has(`${keyX}:${f.word}`)),
  );
  row.flags = flags.map(f => ({kind: f.shown, key: f.key, word: f.word, stop: !!f.stop}));
  // Where the tracker went.
  row.lost = lostPlace(run);
  row.leftAyah = run.log.some(e => {
    if (e.stop || e.type !== 'word_progress') return false;
    const [cs, ca] = e.key.split(':').map(Number);
    const [xs, xa] = keyX.split(':').map(Number);
    return cs !== xs || (ca !== xa && ca !== xa + 1);
  });
  row.firstLock = run.summary.firstLock;
  // Delay of the mark from the next word's start, for an interior word.
  row.latency = null;
  if (exact && truth.stamps && truth.target !== null) {
    const next = truth.stamps[String(truth.target + 1)];
    const mark = reps.app.visible.get(exact);
    if (mark && next) row.latency = +(mark.shownAt - next[0] / 1000).toFixed(3);
  }
  return row;
}

function missClass(targetIds, carry, pendingLive) {
  const trail = targetIds.flatMap(id => carry.trail.get(id) ?? []);
  if (!trail.length) return pendingLive ? 'pending_then_no_verdict' : 'no_verdict';
  const reasons = targetIds.flatMap(id => carry.reasons.get(id) ?? []);
  if (!trail.some(v => BAD.has(v.state))) {
    const last = trail[trail.length - 1].state;
    return last === 'ok' ? 'engine_ok' : 'engine_unsure';
  }
  if (reasons.length) return `rule_${reasons[reasons.length - 1]}`;
  const hidden = targetIds.some(id => carry.book.get(id)?.status === 'mistake');
  return hidden ? 'hidden_by_ayah_flag' : 'bad_but_no_mark';
}

function poolRow(run, words, tags) {
  const truth = run.clip.truth;
  const rep = replay(run, {mode: 'app', wordCount: (s, a) => words(`${s}:${a}`) ?? undefined});
  const carry = replay(run, {mode: 'carry', wordCount: (s, a) => words(`${s}:${a}`) ?? undefined});
  const judged = new Set(run.vchanges.filter(c => !c.stop && c.to !== 'pending').map(c => c.id));
  const restartAyat = new Set(truth.ayat.filter(a => a.restarts > 0).map(a => a.key));
  const pauseAyat = new Set(truth.ayat.filter(a => a.maxPauseMs >= 1000).map(a => a.key));
  const inRun = new Set(truth.ayat.map(a => a.key));
  const marksOut = [];
  for (const [id, m] of rep.visible) {
    const [s, a, w] = id.split(':').map(Number);
    const key = `${s}:${a}`;
    const change = [...run.vchanges].reverse().find(c => c.id === id && (c.to === 'wrong' || c.to === 'skipped'));
    const siteTags = Object.entries(tags)
      .filter(([, byKey]) => byKey[key]?.includes(w))
      .map(([tag]) => tag);
    marksOut.push({
      run: run.clip.id,
      reciter: truth.reciter,
      block: truth.block,
      id,
      kind: m.kind,
      since: m.since,
      corrected: m.corrected,
      position: w === 0 ? 'first' : w === words(key) - 1 ? 'last' : 'interior',
      restartAyah: restartAyat.has(key),
      pauseAyah: pauseAyat.has(key),
      outsideRun: !inRun.has(key),
      tags: siteTags,
      state: change?.to ?? null,
      d: change?.d ?? null,
    });
  }
  const flags = shownFlags(run);
  // The engine's last live verdict on every word, by place in the ayah: the
  // rate of bad verdicts the rules have to carry on correct words.
  const finalLive = new Map();
  const firstJudged = new Map();
  for (const c of run.vchanges) {
    if (c.stop) continue;
    finalLive.set(c.id, {state: c.to, d: c.d ?? null});
    if (c.to !== 'pending' && !firstJudged.has(c.id)) firstJudged.set(c.id, c.t);
  }
  const verdictStates = {first: {}, interior: {}, last: {}};
  for (const [id, v] of finalLive) {
    const [s, a, w] = id.split(':').map(Number);
    const n = words(`${s}:${a}`);
    if (!inRun.has(`${s}:${a}`)) continue;
    const place = w === 0 ? 'first' : w === n - 1 ? 'last' : 'interior';
    verdictStates[place][v.state] = (verdictStates[place][v.state] ?? 0) + 1;
  }
  // How long an ayah's last word waits for its verdict after the ayah ends.
  const lastWordDelays = [];
  const liveLast = [];
  const parts = run.partsAt ?? [];
  parts.forEach((part, i) => {
    const id = `${part.key}:${words(part.key) - 1}`;
    const at = firstJudged.get(id);
    if (at !== undefined && i < parts.length - 1) lastWordDelays.push(+(at - part.end).toFixed(2));
    const v = finalLive.get(id);
    if (v && i < parts.length - 1) {
      liveLast.push({reciter: truth.reciter, key: part.key, state: v.state, d: v.d});
    }
  });
  return {
    verdictStates,
    lastWordDelays,
    liveLast,
    id: run.clip.id,
    reciter: truth.reciter,
    reciterSplit: truth.reciterSplit,
    block: truth.block,
    blockSplit: truth.blockSplit,
    seconds: run.summary.seconds,
    words: truth.words,
    judgedWords: judged.size,
    wordsInRestartAyat: truth.ayat.filter(a => a.restarts > 0).reduce((x, a) => x + a.words, 0),
    wordsInPauseAyat: truth.ayat.filter(a => a.maxPauseMs >= 1000).reduce((x, a) => x + a.words, 0),
    marks: marksOut,
    falseMarks: rep.visible.size,
    falseMarksCarry: carry.visible.size,
    stayedRed: marksOut.filter(m => !m.corrected).length,
    flagsLive: flags.filter(f => !f.stop).length,
    flagsAtStop: flags.filter(f => f.stop).length,
    flags: flags.map(f => ({kind: f.shown, key: f.key, word: f.word, stop: !!f.stop, t: f.t})),
    lost: lostPlace(run),
    offTrack: offTrackEpisodes(run),
    firstLock: run.summary.firstLock,
    tagCounts: Object.fromEntries(
      Object.entries(tags).map(([tag, byKey]) => [
        tag,
        truth.ayat.reduce((x, a) => x + (byKey[a.key]?.length ?? 0), 0),
      ]),
    ),
  };
}

function w5Row(run, words, hasKey) {
  const truth = run.clip.truth;
  const count = (s, a) => words(`${s}:${a}`) ?? undefined;
  const rep = {};
  for (const mode of MODES) rep[mode] = replay(run, {mode, wordCount: count});
  const onSite = mode =>
    [...rep[mode].visible.keys()].filter(id => {
      const [s, a, w] = id.split(':').map(Number);
      return `${s}:${a}` === truth.audioKey && truth.sites.some(x => Math.abs(x - w) <= 1);
    }).length;
  return {
    id: run.clip.id,
    category: truth.category,
    key: truth.audioKey,
    reciter: truth.reciter,
    seconds: run.summary.seconds,
    words: truth.words,
    sites: truth.sites.length,
    restarts: truth.restarts,
    marks: Object.fromEntries(MODES.map(m => [m, rep[m].visible.size])),
    onSite: Object.fromEntries(MODES.map(m => [m, onSite(m)])),
    ids: [...rep.app.visible.keys()],
    idsCarry: [...rep.carry.visible.keys()],
    flags: shownFlags(run).length,
    lost: lostPlace(run),
    firstLock: run.summary.firstLock,
    locked: run.summary.firstLock !== null,
  };
}

function learnerRow(run, words) {
  const truth = run.clip.truth;
  const count = (s, a) => words(`${s}:${a}`) ?? undefined;
  const app = replay(run, {mode: 'app', wordCount: count}).visible;
  const carry = replay(run, {mode: 'carry', wordCount: count}).visible;
  const [xs, xa] = truth.expectedKey.split(':').map(Number);
  const near = (m, id) => {
    const [s, a, w] = id.split(':').map(Number);
    return [...m.keys()].some(k => {
      const [s2, a2, w2] = k.split(':').map(Number);
      return s === s2 && a === a2 && Math.abs(w - w2) <= 1;
    });
  };
  const n = words(truth.expectedKey);
  const recited = truth.wordEnd ? truth.wordEnd - (truth.wordStart ?? 0) : n;
  return {
    dataset: truth.dataset,
    label: truth.label,
    speaker: truth.speaker,
    key: truth.expectedKey,
    words: Math.max(1, recited),
    seconds: run.summary.seconds,
    judged: run.vchanges.some(c => !c.stop && c.to !== 'pending'),
    app: app.size,
    carry: carry.size,
    errors: truth.errors.map(e => ({class: e.class, id: e.id, app: near(app, e.id), carry: near(carry, e.id)})),
    otherSurah: [...app.keys()].filter(k => !k.startsWith(`${xs}:${xa}:`)).length,
  };
}

// --------------------------------------------------------------------- reading

function* runsIn(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    yield JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  }
}

const fmtPct = r =>
  r.est === null
    ? 'n/a'
    : `${(100 * r.est).toFixed(1)}%${r.lo !== null ? ` [${(100 * r.lo).toFixed(1)}, ${(100 * r.hi).toFixed(1)}]` : ''}`;
const fmtRate = r =>
  r.est === null
    ? 'n/a'
    : `${(1000 * r.est).toFixed(2)}${r.lo !== null ? ` [${(1000 * r.lo).toFixed(2)}, ${(1000 * r.hi).toFixed(2)}]` : ''}`;

async function main() {
  const args = parseArgs(process.argv);
  const runsDir = path.resolve(args.runs ?? path.join(OUT_ROOT, 'baseline/runs'));
  const outDir = path.resolve(args.out ?? path.dirname(runsDir));
  const boot = Number(args.boot ?? 2000);
  const split = args.split ?? null;
  fs.mkdirSync(outDir, {recursive: true});
  const engineWords = loadEngineWords();
  const words = key => engineWords[key];
  const hasKey = key => key in engineWords;
  const tags = JSON.parse(fs.readFileSync(path.join(MAN, 'w5_tags.json'), 'utf8'));
  const speed = JSON.parse(fs.readFileSync(path.join(MAN, 'reciter_speed.json'), 'utf8'));
  const keep = truth => {
    if (!split) return true;
    return truth.reciterSplit === split && (truth.pairSplit ?? truth.blockSplit ?? split) === split;
  };

  // Words the live verdicts judged, re-read by the flush: how far it moves them.
  const flushAgreement = {
    correctText: {words: 0, same: 0, moved: {}},
    otherText: {words: 0, same: 0, moved: {}},
  };
  const noteAgreement = (run, where) => {
    const a = flushAgreement[where];
    for (const v of run.flush?.verdicts ?? []) {
      if (v.newly) continue;
      a.words += 1;
      if (v.state === v.live) a.same += 1;
      else {
        const k = `${v.live} -> ${v.state}`;
        a.moved[k] = (a.moved[k] ?? 0) + 1;
      }
    }
  };
  const ev = [];
  const eventsOut = fs.openSync(path.join(outDir, 'events.jsonl'), 'w');
  for (const run of runsIn(path.join(runsDir, 'w1'))) {
    if (!keep(run.clip.truth)) continue;
    noteAgreement(run, 'otherText');
    const row = scoreEvent(run, words, hasKey);
    fs.writeSync(eventsOut, JSON.stringify(row) + '\n');
    ev.push(row);
  }
  fs.closeSync(eventsOut);
  const control = [];
  const lastWordControl = [];
  for (const run of runsIn(path.join(runsDir, 'w1_control'))) {
    if (!keep(run.clip.truth)) continue;
    noteAgreement(run, 'correctText');
    const row = scoreEvent(run, words, hasKey);
    control.push(row);
    const last = `${run.clip.truth.expectedKey}:${words(run.clip.truth.expectedKey) - 1}`;
    const v = run.flush?.verdicts?.find(x => x.id === last);
    lastWordControl.push({
      reciter: row.reciter,
      key: row.expectedKey,
      flushState: v ? v.state : null,
      newly: v ? v.newly : null,
      d: v ? v.d : null,
      heard: run.flush?.words?.find(w => w.id === last)?.heard ?? null,
    });
  }
  const pool = [];
  const poolMarks = fs.openSync(path.join(outDir, 'pool_marks.jsonl'), 'w');
  for (const run of runsIn(path.join(runsDir, 'pool'))) {
    if (!keep(run.clip.truth)) continue;
    const row = poolRow(run, words, tags);
    for (const m of row.marks) fs.writeSync(poolMarks, JSON.stringify(m) + '\n');
    pool.push(row);
  }
  fs.closeSync(poolMarks);
  const w5 = [];
  for (const run of runsIn(path.join(runsDir, 'w5'))) {
    if (!keep(run.clip.truth)) continue;
    w5.push(w5Row(run, words, hasKey));
  }

  const learners = [];
  for (const run of runsIn(path.join(runsDir, 'learners'))) {
    learners.push(learnerRow(run, words));
  }

  // ------------------------------------------------------------- W1 catches
  const types = {
    'changed: all': r => r.type === 'changed',
    'changed: first word': r => r.type === 'changed' && r.position === 'first',
    'changed: interior': r => r.type === 'changed' && r.position === 'interior',
    'changed: last word': r => r.type === 'changed' && r.position === 'last',
    'changed: close pairs (text distance 1-2)': r => r.type === 'changed' && r.close,
    'changed: close pairs, interior': r => r.type === 'changed' && r.close && r.position === 'interior',
    'changed: close pairs, last word': r => r.type === 'changed' && r.close && r.position === 'last',
    'changed: distance 1-2': r => r.type === 'changed' && r.textDistance <= 2,
    'changed: distance 3-4': r => r.type === 'changed' && r.textDistance >= 3 && r.textDistance <= 4,
    'changed: distance 5+': r => r.type === 'changed' && r.textDistance >= 5,
    'skipped word (11 pairs): all': r => r.type === 'skipped' && !r.short,
    'skipped word: first word': r => r.type === 'skipped' && !r.short && r.position === 'first',
    'skipped word: interior': r => r.type === 'skipped' && !r.short && r.position === 'interior',
    'skipped word: under-4-word ayat': r => r.type === 'skipped' && r.short,
    'added word (11 pairs): all': r => r.type === 'added' && !r.short,
    'added word: first word': r => r.type === 'added' && !r.short && r.position === 'first',
    'added word: interior': r => r.type === 'added' && !r.short && r.position === 'interior',
    'added word: under-4-word ayat': r => r.type === 'added' && r.short,
    'added last word': r => r.type === 'added_last',
    'dropped last word': r => r.type === 'dropped_last',
    'dropped last word, reader carries on (natural junction)': r => r.type === 'junction',
  };
  const rate = (rows, f) =>
    pigeonhole(rows.map(r => ({a: r.pair, b: r.reciter, num: f(r) ? 1 : 0, den: 1})), boot);
  const catches = {};
  for (const [name, test] of Object.entries(types)) {
    const rows = ev.filter(test);
    catches[name] = {
      events: rows.length,
      pairs: new Set(rows.map(r => r.pair)).size,
      reciters: new Set(rows.map(r => r.reciter)).size,
      app: rate(rows, r => r.caught.app),
      flush: rate(rows, r => r.caught.flush),
      carry: rate(rows, r => r.caught.carry),
      engine: rate(rows, r => r.engineBad),
      flagged: rate(rows, r => r.flagged),
      exactOfCaughtApp: pigeonhole(
        rows.filter(r => r.caught.app).map(r => ({a: r.pair, b: r.reciter, num: r.exact.app ? 1 : 0, den: 1})),
        boot,
      ),
      exactOfCaughtCarry: pigeonhole(
        rows.filter(r => r.caught.carry).map(r => ({a: r.pair, b: r.reciter, num: r.exact.carry ? 1 : 0, den: 1})),
        boot,
      ),
    };
  }

  // ------------------------------------------------------- false marks, W1
  const falseRate = (rows, mode) =>
    pigeonhole(rows.map(r => ({a: r.pair ?? r.expectedKey, b: r.reciter, num: r.falseMarks[mode], den: r.unchangedWords})), boot);
  const unchangedRows = ev.filter(r => ['changed', 'skipped', 'added'].includes(r.type));
  const traps = ev.filter(r => r.type === 'trap');
  const trapRows = traps.map(r => ({...r, unchangedWords: r.words}));
  const falseW1 = {
    unchangedWords: Object.fromEntries(MODES.map(m => [m, falseRate(unchangedRows, m)])),
    unchangedWordsCount: unchangedRows.reduce((x, r) => x + r.unchangedWords, 0),
    traps: {
      events: traps.length,
      pairs: new Set(traps.map(r => r.pair)).size,
      words: traps.reduce((x, r) => x + r.words, 0),
      ...Object.fromEntries(MODES.map(m => [m, falseRate(trapRows, m)])),
    },
    flagsOnTraps: traps.reduce((x, r) => x + r.flags.length, 0),
    flagsOnControl: control.reduce((x, r) => x + r.flags.length, 0),
    flagKindsOnControl: tallyList(control.flatMap(r => r.flags.map(f => `${f.kind}${f.stop ? ' at stop' : ' live'}`))),
    control: {
      runs: control.length,
      words: control.reduce((x, r) => x + r.words, 0),
      ...Object.fromEntries(
        MODES.map(m => [
          m,
          pigeonhole(control.map(r => ({a: r.expectedKey, b: r.reciter, num: r.marks[m].length, den: r.words})), boot),
        ]),
      ),
    },
  };

  // Flush verdicts on a correct last word against a changed one.
  const tally = (rows, get) => {
    const out = {};
    for (const r of rows) {
      const k = get(r) ?? 'none';
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  };
  const changedLast = ev.filter(r => r.type === 'changed' && r.position === 'last');
  const lastWord = {
    correct: tally(lastWordControl, r => (r.newly === false ? 'judged live' : r.flushState)),
    changed: tally(changedLast, r => (r.flushTarget?.newly === false ? 'judged live' : r.flushTarget?.state)),
    dropped: tally(ev.filter(r => r.type === 'dropped_last'), r => r.flushTarget?.state),
    distanceCorrect: quantiles(lastWordControl.map(r => r.d?.distance).filter(x => x !== null && x !== undefined)),
    distanceChanged: quantiles(changedLast.map(r => r.flushTarget?.d?.distance).filter(x => x !== null && x !== undefined)),
  };

  // What a distance cut on an ayah's last word would do: changed words caught at
  // the flush, against correct words crossing it at the flush and live.
  const liveLastD = pool.flatMap(r => r.liveLast).map(v => v.d?.distance).filter(x => typeof x === 'number');
  const correctD = lastWordControl.map(r => r.d?.distance).filter(x => typeof x === 'number');
  const changedD = changedLast.map(r => r.flushTarget?.d?.distance ?? null);
  lastWord.distanceCuts = [0.21, 0.25, 0.3, 0.35, 0.4].map(cut => ({
    cut,
    changedCaught: changedD.filter(x => x !== null && x >= cut).length / Math.max(1, changedD.length),
    changedEvents: changedD.length,
    correctAtFlush: correctD.filter(x => x >= cut).length / Math.max(1, correctD.length),
    correctAtFlushWords: correctD.length,
    correctLive: liveLastD.filter(x => x >= cut).length / Math.max(1, liveLastD.length),
    correctLiveWords: liveLastD.length,
  }));

  // The same recording's last word, judged live because the reader carried on
  // (pool) and judged by the flush because the clip ended (control).
  const flushByClip = new Map(lastWordControl.map(r => [`${r.reciter}|${r.key}`, r]));
  const flushVsLive = {pairs: 0, sameState: 0, table: {}};
  for (const v of pool.flatMap(r => r.liveLast)) {
    const f = flushByClip.get(`${v.reciter}|${v.key}`);
    if (!f || f.newly === false) continue;
    flushVsLive.pairs += 1;
    if (f.flushState === v.state) flushVsLive.sameState += 1;
    const k = `live ${v.state} / flush ${f.flushState ?? 'none'}`;
    flushVsLive.table[k] = (flushVsLive.table[k] ?? 0) + 1;
  }

  // -------------------------------------------------------------------- pool
  const sum = (rows, f) => rows.reduce((x, r) => x + f(r), 0);
  const poolHours = sum(pool, r => r.seconds) / 3600;
  const poolRate = (rows, f, den = r => r.words) =>
    pigeonhole(rows.map(r => ({a: r.block, b: r.reciter, num: f(r), den: den(r)})), boot);
  const poolOut = {
    takes: pool.length,
    passages: new Set(pool.map(r => r.block)).size,
    reciters: new Set(pool.map(r => r.reciter)).size,
    words: sum(pool, r => r.words),
    judgedWords: sum(pool, r => r.judgedWords),
    hours: poolHours,
    falseMarks: sum(pool, r => r.falseMarks),
    stayedRed: sum(pool, r => r.stayedRed),
    per1000: poolRate(pool, r => r.falseMarks),
    per1000StayedRed: poolRate(pool, r => r.stayedRed),
    per1000Carry: poolRate(pool, r => r.falseMarksCarry),
    poissonUpperPer1000: (1000 * poissonUpper(sum(pool, r => r.falseMarks))) / Math.max(1, sum(pool, r => r.words)),
    perMinute: sum(pool, r => r.falseMarks) / Math.max(1e-9, poolHours * 60),
    flagsLive: sum(pool, r => r.flagsLive),
    flagsAtStop: sum(pool, r => r.flagsAtStop),
    flagKinds: tallyList(pool.flatMap(r => r.flags.map(f => `${f.kind}${f.stop ? ' at stop' : ' live'}`))),
    firstLock: quantiles(pool.map(r => r.firstLock).filter(x => x !== null)),
    lost: {
      events: sum(pool, r => r.lost.total),
      perHour: sum(pool, r => r.lost.total) / Math.max(1e-9, poolHours),
      interval: pigeonhole(pool.map(r => ({a: r.block, b: r.reciter, num: r.lost.total, den: r.seconds / 3600})), boot),
      byKind: {
        lost: sum(pool, r => r.lost.lost),
        relocated: sum(pool, r => r.lost.relocated),
        locateFailed: sum(pool, r => r.lost.locateFailed),
        idleLost: sum(pool, r => r.lost.idleLost),
        idleSilent: sum(pool, r => r.lost.idleSilent),
      },
      offTrackEpisodes: sum(pool, r => r.offTrack.length),
    },
    restarts: {
      wordsInRestartAyat: sum(pool, r => r.wordsInRestartAyat),
      marksInRestartAyat: sum(pool, r => r.marks.filter(m => m.restartAyah).length),
      per1000InRestartAyat: poolRate(pool, r => r.marks.filter(m => m.restartAyah).length, r => r.wordsInRestartAyat),
      per1000Elsewhere: poolRate(
        pool,
        r => r.marks.filter(m => !m.restartAyah).length,
        r => r.words - r.wordsInRestartAyat,
      ),
    },
    byPosition: tally(pool.flatMap(r => r.marks), m => m.position),
    byKind: tally(pool.flatMap(r => r.marks), m => m.kind),
    verdictStates: mergeTallies(pool.map(r => r.verdictStates)),
    lastWordDelay: quantiles(pool.flatMap(r => r.lastWordDelays)),
    byTag: Object.fromEntries(
      Object.keys(tags).map(tag => [
        tag,
        {
          sites: sum(pool, r => r.tagCounts[tag] ?? 0),
          marks: sum(pool, r => r.marks.filter(m => m.tags.includes(tag)).length),
        },
      ]),
    ),
  };

  // ---------------------------------------------------------------------- W5
  const w5Out = {};
  for (const category of new Set(w5.map(r => r.category))) {
    const rows = w5.filter(r => r.category === category);
    w5Out[category] = {
      runs: rows.length,
      ayat: new Set(rows.map(r => r.key)).size,
      reciters: new Set(rows.map(r => r.reciter)).size,
      words: sum(rows, r => r.words),
      siteInstances: sum(rows, r => r.sites),
      marksApp: sum(rows, r => r.marks.app),
      marksCarry: sum(rows, r => r.marks.carry),
      onSiteApp: sum(rows, r => r.onSite.app),
      onSiteCarry: sum(rows, r => r.onSite.carry),
      runsWithRestart: rows.filter(r => r.restarts > 0).length,
      marksInRestartRuns: sum(rows.filter(r => r.restarts > 0), r => r.marks.app),
      per1000App: pigeonhole(rows.map(r => ({a: r.key, b: r.reciter, num: r.marks.app, den: r.words})), boot),
      per1000Carry: pigeonhole(rows.map(r => ({a: r.key, b: r.reciter, num: r.marks.carry, den: r.words})), boot),
      lockedRuns: rows.filter(r => r.locked).length,
      lostPlaceRuns: rows.filter(r => r.lost.total > 0).length,
      flags: sum(rows, r => r.flags),
      firstLockMedian: median(rows.map(r => r.firstLock).filter(x => x !== null)),
    };
  }
  const w5Worst = w5
    .filter(r => r.marks.app > 0)
    .map(r => ({id: r.id, category: r.category, key: r.key, ids: r.ids}));

  // ---------------------------------------------------------------- learners
  const learnerOut = {};
  for (const dataset of new Set(learners.map(r => r.dataset))) {
    const rows = learners.filter(r => r.dataset === dataset);
    const clean = rows.filter(r => (dataset === 'sobolev' ? r.label === 'unknown' : r.label === 'correct'));
    const errors = rows.flatMap(r => r.errors);
    const classes = {};
    for (const e of errors) {
      const c = (classes[e.class ?? 'unclassified'] ??= {words: 0, app: 0, carry: 0});
      c.words += 1;
      if (e.app) c.app += 1;
      if (e.carry) c.carry += 1;
    }
    learnerOut[dataset] = {
      clips: rows.length,
      speakers: new Set(rows.map(r => r.speaker)).size,
      minutes: sum(rows, r => r.seconds) / 60,
      judgedClips: rows.filter(r => r.judged).length,
      cleanClips: clean.length,
      cleanWords: sum(clean, r => r.words),
      cleanLabel: dataset === 'sobolev' ? 'no error recorded (not verified correct)' : 'expert label: correct',
      falsePer1000App: pigeonhole(clean.map(r => ({a: r.speaker, b: r.key, num: r.app, den: r.words})), boot),
      falsePer1000Carry: pigeonhole(clean.map(r => ({a: r.speaker, b: r.key, num: r.carry, den: r.words})), boot),
      labelledErrors: classes,
    };
  }

  // --------------------------------------------------------------- reciters
  const reciters = [...new Set([...ev, ...pool, ...control].map(r => r.reciter))].sort();
  const perReciterBoot = Math.min(boot, 500);
  const perReciter = reciters.map(name => {
    const mine = ev.filter(r => r.reciter === name);
    const p = pool.filter(r => r.reciter === name);
    const c = control.filter(r => r.reciter === name);
    const ch = mine.filter(r => r.type === 'changed');
    const catchOf = (rows, f) =>
      pigeonhole(rows.map(r => ({a: r.pair, b: name, num: f(r) ? 1 : 0, den: 1})), perReciterBoot);
    const unchanged = mine.filter(r => ['changed', 'skipped', 'added'].includes(r.type));
    const added = mine.filter(r => r.type === 'added' && !r.short);
    const dropped = mine.filter(r => r.type === 'dropped_last');
    const caught = ch.filter(r => r.caught.carry);
    return {
      reciter: name,
      split: (mine[0] ?? p[0] ?? c[0])?.reciterSplit ?? null,
      wordsPerSec: speed[name] ?? null,
      changedEvents: ch.length,
      changedApp: catchOf(ch, r => r.caught.app),
      changedCarry: catchOf(ch, r => r.caught.carry),
      changedEngine: catchOf(ch, r => r.engineBad),
      lastWordEngine: catchOf(ch.filter(r => r.position === 'last'), r => r.engineBad),
      lastWordCarry: catchOf(ch.filter(r => r.position === 'last'), r => r.caught.carry),
      closeApp: catchOf(ch.filter(r => r.close), r => r.caught.app),
      closeEngine: catchOf(ch.filter(r => r.close), r => r.engineBad),
      interiorApp: catchOf(ch.filter(r => r.position === 'interior'), r => r.caught.app),
      addedApp: catchOf(added, r => r.caught.app),
      addedEvents: added.length,
      droppedCarry: catchOf(dropped, r => r.caught.carry),
      droppedEvents: dropped.length,
      exactOfCaught: caught.length ? caught.filter(r => r.exact.carry).length / caught.length : null,
      w1Unchanged: pigeonhole(
        unchanged.map(r => ({a: r.pair, b: name, num: r.falseMarks.app, den: r.unchangedWords})),
        perReciterBoot,
      ),
      w1Runs: mine.length,
      w1RunsLost: mine.filter(r => r.lost.total > 0).length,
      poolWords: sum(p, r => r.words),
      poolHours: sum(p, r => r.seconds) / 3600,
      poolFalseMarks: sum(p, r => r.falseMarks),
      pool: pigeonhole(p.map(r => ({a: r.block, b: name, num: r.falseMarks, den: r.words})), perReciterBoot),
      poolLost: sum(p, r => r.lost.total),
      poolLostPerHour: sum(p, r => r.lost.total) / Math.max(1e-9, sum(p, r => r.seconds) / 3600),
      poolRestartWordShare: sum(p, r => r.wordsInRestartAyat) / Math.max(1, sum(p, r => r.words)),
      controlWords: sum(c, r => r.words),
      controlPer1000App: (1000 * sum(c, r => r.marks.app.length)) / Math.max(1, sum(c, r => r.words)),
      controlPer1000Carry: (1000 * sum(c, r => r.marks.carry.length)) / Math.max(1, sum(c, r => r.words)),
    };
  });

  // ---------------------------------------------------------------- misses
  const missed = ev.filter(r => r.miss && ['changed', 'skipped', 'added', 'added_last', 'dropped_last', 'junction'].includes(r.type));
  const missedOut = fs.openSync(path.join(outDir, 'missed.jsonl'), 'w');
  for (const r of missed) {
    fs.writeSync(
      missedOut,
      JSON.stringify({
        id: r.id,
        type: r.type,
        pair: r.pair,
        reciter: r.reciter,
        audioKey: r.audioKey,
        expectedKey: r.expectedKey,
        target: r.target,
        position: r.position,
        close: r.close,
        textDistance: r.textDistance,
        miss: r.miss,
        verdicts: r.verdicts,
        flushTarget: r.flushTarget,
        heardTarget: r.heardTarget,
        reasonsCarry: r.reasons.carry,
        marksElsewhere: r.marks.carry.map(m => m.id),
      }) + '\n',
    );
  }
  fs.closeSync(missedOut);
  // By event type and place, then by why: what the engine last said about the
  // word itself (the flush's verdict where the live ones left it unjudged).
  const missSummary = {};
  for (const r of missed) {
    const group = `${r.type}${r.position ? ` / ${r.position}` : ''}`;
    const g = (missSummary[group] ??= {events: 0, byClass: {}, classes: {}});
    g.events += 1;
    g.byClass[r.miss] = (g.byClass[r.miss] ?? 0) + 1;
    const own = r.target === null ? [] : (r.verdicts[`${r.expectedKey}:${r.target}`] ?? []);
    const last = own[own.length - 1]?.d ?? r.flushTarget?.d ?? null;
    if (last) (g.classes[r.miss] ??= []).push(last);
  }
  for (const g of Object.values(missSummary)) {
    const qs = (list, f) => quantiles(list.map(f).filter(x => x !== null && x !== undefined));
    g.verdictQuantiles = Object.fromEntries(
      Object.entries(g.classes).map(([name, list]) => [
        name,
        {
          n: list.length,
          distance: qs(list, d => d.distance),
          heardRatio: qs(list, d => d.heardRatio),
          margin: qs(list, d => d.margin),
          gop: qs(list, d => d.gop),
        },
      ]),
    );
    delete g.classes;
  }
  fs.writeFileSync(path.join(outDir, 'missed_summary.json'), JSON.stringify(missSummary, null, 1));

  // ---------------------------------------------------------- per pair table
  const byPair = {};
  for (const r of ev) {
    const p = (byPair[r.pair] ??= {events: 0, app: 0, carry: 0, engine: 0, type: r.type, position: r.position, close: r.close});
    p.events += 1;
    if (r.caught.app) p.app += 1;
    if (r.caught.carry) p.carry += 1;
    if (r.engineBad) p.engine += 1;
  }
  fs.writeFileSync(path.join(outDir, 'by_pair.json'), JSON.stringify(byPair, null, 0));

  const latencies = ev.map(r => r.latency).filter(x => x !== null);
  const lostEvents = {
    w1Runs: ev.length,
    runsWithLost: ev.filter(r => r.lost.total > 0).length,
    runsLeavingAyah: ev.filter(r => r.leftAyah).length,
    w1Hours: sum(ev, r => r.seconds) / 3600,
    w1Events: sum(ev, r => r.lost.total),
    controlRuns: control.length,
    controlRunsWithLost: control.filter(r => r.lost.total > 0).length,
    controlRunsLeavingAyah: control.filter(r => r.leftAyah).length,
    controlHours: sum(control, r => r.seconds) / 3600,
    controlEvents: sum(control, r => r.lost.total),
    byType: Object.fromEntries(
      [...new Set(ev.map(r => r.type))].map(t => [
        t,
        {runs: ev.filter(r => r.type === t).length, withLost: ev.filter(r => r.type === t && r.lost.total > 0).length},
      ]),
    ),
  };
  const scoreboard = {
    rules: process.env.WORD_MARKS ?? 'services/recitation/wordMarks.ts',
    split: split ?? 'all',
    boot,
    catches,
    falseW1,
    lastWord,
    flushVsLive,
    flushAgreement,
    pool: poolOut,
    learners: learnerOut,
    w5: w5Out,
    w5MarkedRuns: w5Worst.length,
    perReciter,
    latency: {
      events: latencies.length,
      medianSec: median(latencies),
      p90Sec: pct(latencies, 0.9),
    },
    lostEvents,
  };
  fs.writeFileSync(path.join(outDir, 'scoreboard.json'), JSON.stringify(scoreboard, null, 1));
  fs.writeFileSync(path.join(outDir, 'w5_marked.json'), JSON.stringify(w5Worst, null, 0));
  const md = renderMarkdown(scoreboard, missSummary);
  fs.writeFileSync(path.join(outDir, 'scoreboard.md'), md);
  console.log(md);
}

function tallyList(list) {
  const out = {};
  for (const x of list) out[x] = (out[x] ?? 0) + 1;
  return out;
}

function mergeTallies(list) {
  const out = {};
  for (const item of list) {
    for (const [group, counts] of Object.entries(item)) {
      out[group] ??= {};
      for (const [k, n] of Object.entries(counts)) out[group][k] = (out[group][k] ?? 0) + n;
    }
  }
  return out;
}

function quantiles(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const at = p => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return {n: s.length, p10: at(0.1), p50: at(0.5), p90: at(0.9)};
}

function renderMarkdown(b, missSummary) {
  const out = [];
  out.push(`# Natural word benchmark scoreboard`);
  out.push('');
  out.push(`Rules: ${b.rules}. Split: ${b.split}. Intervals: 95%, ${b.boot} resamples of pairs (or passages) and reciters together.`);
  out.push('');
  out.push('## Catches on W1 (authentic recording of Y against the official text of X)');
  out.push('');
  out.push('| Event | Events | Pairs | Reciters | Marks the app shows | + flush | + flush and carry-on | Engine said wrong/skipped | Flagged at stop |');
  out.push('|---|---:|---:|---:|---|---|---|---|---|');
  for (const [name, c] of Object.entries(b.catches)) {
    out.push(`| ${name} | ${c.events} | ${c.pairs} | ${c.reciters} | ${fmtPct(c.app)} | ${fmtPct(c.flush)} | ${fmtPct(c.carry)} | ${fmtPct(c.engine)} | ${fmtPct(c.flagged)} |`);
  }
  out.push('');
  const ca = b.catches['changed: all'];
  if (ca) out.push(`Exact word among caught changed words: marks the app shows ${fmtPct(ca.exactOfCaughtApp)} of ${ca.exactOfCaughtApp.den}; with flush and carry-on ${fmtPct(ca.exactOfCaughtCarry)} of ${ca.exactOfCaughtCarry.den}.`);
  out.push(`Latency of a shown mark from the next word's start (interior, exact): median ${b.latency.medianSec} s, 90th percentile ${b.latency.p90Sec} s, n=${b.latency.events}.`);
  out.push('');
  out.push('## False marks per 1,000 correct words');
  out.push('');
  out.push('| Set | Words | App | + flush | + flush and carry-on |');
  out.push('|---|---:|---|---|---|');
  const f = b.falseW1;
  out.push(`| Pool: whole ayat in order, ${b.pool.reciters} reciters, ${b.pool.passages} passages, ${b.pool.hours.toFixed(1)} h | ${b.pool.words} | ${fmtRate(b.pool.per1000)} | | ${fmtRate(b.pool.per1000Carry)} |`);
  out.push(`| W1, unchanged words of changed, skipped and added events | ${f.unchangedWordsCount} | ${fmtRate(f.unchangedWords.app)} | ${fmtRate(f.unchangedWords.flush)} | ${fmtRate(f.unchangedWords.carry)} |`);
  out.push(`| W1 traps: spelling-only pairs (${f.traps.pairs} pairs) | ${f.traps.words} | ${fmtRate(f.traps.app)} | ${fmtRate(f.traps.flush)} | ${fmtRate(f.traps.carry)} |`);
  out.push(`| W1 control: the same recordings against their own text | ${f.control.words} | ${fmtRate(f.control.app)} | ${fmtRate(f.control.flush)} | ${fmtRate(f.control.carry)} |`);
  out.push('');
  out.push(`Shown flags raised on correct text: ${f.flagsOnControl} on the ${f.control.runs} control runs ${JSON.stringify(f.flagKindsOnControl)}, ${f.flagsOnTraps} on the ${f.traps.events} trap runs.`);
  out.push('');
  const p = b.pool;
  out.push(`Pool: ${p.falseMarks} false marks in ${p.words} words (${p.judgedWords} judged), ${p.stayedRed} stayed red (${fmtRate(p.per1000StayedRed)} per 1,000), ${p.perMinute.toFixed(3)} per minute. Upper bound by exact Poisson before clustering: ${p.poissonUpperPer1000.toFixed(2)} per 1,000.`);
  out.push(`In ayat with a natural restart: ${p.restarts.marksInRestartAyat} marks in ${p.restarts.wordsInRestartAyat} words (${fmtRate(p.restarts.per1000InRestartAyat)} per 1,000); elsewhere ${fmtRate(p.restarts.per1000Elsewhere)}.`);
  out.push(`By word position: ${JSON.stringify(p.byPosition)}. By kind: ${JSON.stringify(p.byKind)}. Flags on the pool: ${p.flagsLive} live, ${p.flagsAtStop} at stop ${JSON.stringify(p.flagKinds)}. First lock, seconds: ${JSON.stringify(p.firstLock)}.`);
  out.push('');
  out.push('## Lost place');
  out.push('');
  const li = p.lost.interval;
  out.push(`Pool: ${p.lost.events} events in ${p.hours.toFixed(1)} h, ${p.lost.perHour.toFixed(2)} per hour [${li.lo?.toFixed(2)}, ${li.hi?.toFixed(2)}]; ${JSON.stringify(p.lost.byKind)}; cursor off the recited ayah for 3 s or more: ${p.lost.offTrackEpisodes} episodes.`);
  out.push(`W1: ${b.lostEvents.runsWithLost} of ${b.lostEvents.w1Runs} runs had a lost-place event (${JSON.stringify(b.lostEvents.byType)}); the cursor left X in ${b.lostEvents.runsLeavingAyah}. Control: ${b.lostEvents.controlRunsWithLost} of ${b.lostEvents.controlRuns}, cursor left the ayah in ${b.lostEvents.controlRunsLeavingAyah}.`);
  out.push('');
  out.push('## Last word at the flush: correct against changed');
  out.push('');
  out.push(`Correct recordings: ${JSON.stringify(b.lastWord.correct)}, distance ${JSON.stringify(b.lastWord.distanceCorrect)}.`);
  out.push(`Changed last word: ${JSON.stringify(b.lastWord.changed)}, distance ${JSON.stringify(b.lastWord.distanceChanged)}.`);
  out.push(`Dropped last word: ${JSON.stringify(b.lastWord.dropped)}.`);
  out.push(`Distance cuts on the last word: ${JSON.stringify(b.lastWord.distanceCuts.map(c => ({cut: c.cut, changed: +c.changedCaught.toFixed(3), correctFlush: +c.correctAtFlush.toFixed(4), correctLive: +c.correctLive.toFixed(4)})))}.`);
  out.push(`The same recording's last word live (reader carried on, pool) against the flush (clip ended, control): ${b.flushVsLive.pairs} words, same state ${b.flushVsLive.sameState}; ${JSON.stringify(b.flushVsLive.table)}.`);
  out.push(`Words already judged live, re-read by the flush, on correct text: ${b.flushAgreement.correctText.words}, same ${b.flushAgreement.correctText.same}; moved ${JSON.stringify(b.flushAgreement.correctText.moved)}. On W1's other text: ${b.flushAgreement.otherText.words}, same ${b.flushAgreement.otherText.same}; moved ${JSON.stringify(b.flushAgreement.otherText.moved)}.`);
  out.push(`In the pool an ayah's last word waits after the ayah's end, seconds: ${JSON.stringify(b.pool.lastWordDelay)}.`);
  out.push(`Final live verdicts on the pool's correct words by place: ${JSON.stringify(b.pool.verdictStates)}.`);
  out.push('');
  out.push('## W5, first cut: phenomena (every mark is false)');
  out.push('');
  out.push('| Category | Runs | Ayat | Words | Sites read | Marks, app | On site ±1 | Marks with flush and carry-on | On site ±1 | Per 1,000, app | Lost place runs | Runs with a restart | Marks in them |');
  out.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|');
  for (const [name, c] of Object.entries(b.w5)) {
    out.push(`| ${name} | ${c.runs} | ${c.ayat} | ${c.words} | ${c.siteInstances} | ${c.marksApp} | ${c.onSiteApp} | ${c.marksCarry} | ${c.onSiteCarry} | ${fmtRate(c.per1000App)} | ${c.lostPlaceRuns} | ${c.runsWithRestart} | ${c.marksInRestartRuns} |`);
  }
  for (const [tag, c] of Object.entries(p.byTag)) {
    out.push(`| ${tag}, in the pool | | | | ${c.sites} | ${c.marks} | | | | | | | |`);
  }
  out.push('');
  if (Object.keys(b.learners ?? {}).length) {
    out.push('## Learners, each clip alone with its place known (small, gold labels)');
    out.push('');
    for (const [name, c] of Object.entries(b.learners)) {
      out.push(`- ${name}: ${c.clips} clips, ${c.speakers} speakers, ${c.minutes.toFixed(0)} min. Clean clips (${c.cleanLabel}): ${c.cleanClips}, ${c.cleanWords} words, false marks per 1,000: app ${fmtRate(c.falsePer1000App)}, with flush and carry-on ${fmtRate(c.falsePer1000Carry)}. Labelled errors caught (app / carry-on of words): ${JSON.stringify(c.labelledErrors)}.`);
    }
    out.push('');
  }
  out.push('## Per reciter (worst first by pool false marks)');
  out.push('');
  out.push('Intervals here resample pairs or passages within the reciter.');
  out.push('');
  out.push('| Reciter | Split | Words/s | Changed: app | Changed: engine | Last word: engine | Close: app | Close: engine | Added: app | Exact | Pool per 1,000 | Pool false | Lost (pool, per h) | W1 unchanged per 1,000 | Control per 1,000 (app / carry) |');
  out.push('|---|---|---:|---|---|---|---|---|---|---:|---|---:|---:|---|---:|');
  for (const r of [...b.perReciter].sort((x, y) => (y.pool.est ?? 0) - (x.pool.est ?? 0))) {
    const pc = x => (x === null ? 'n/a' : `${(100 * x).toFixed(0)}%`);
    out.push(`| ${r.reciter} | ${r.split} | ${r.wordsPerSec} | ${fmtPct(r.changedApp)} | ${fmtPct(r.changedEngine)} | ${fmtPct(r.lastWordEngine)} | ${fmtPct(r.closeApp)} | ${fmtPct(r.closeEngine)} | ${fmtPct(r.addedApp)} | ${pc(r.exactOfCaught)} | ${fmtRate(r.pool)} | ${r.poolFalseMarks} | ${r.poolLost} (${r.poolLostPerHour.toFixed(2)}) | ${fmtRate(r.w1Unchanged)} | ${r.controlPer1000App.toFixed(2)} / ${r.controlPer1000Carry.toFixed(2)} |`);
  }
  out.push('');
  out.push('## Why missed events were missed (verdict on the event\'s word, carry-on replay)');
  out.push('');
  for (const [group, g] of Object.entries(missSummary).sort()) {
    out.push(`- ${group}: ${g.events} missed: ${JSON.stringify(g.byClass)}`);
    for (const [name, v] of Object.entries(g.verdictQuantiles)) {
      const q = x => (x ? `${x.p10}/${x.p50}/${x.p90}` : 'n/a');
      out.push(`  - ${name} (n=${v.n}), p10/p50/p90: distance ${q(v.distance)}, heard ratio ${q(v.heardRatio)}, margin ${q(v.margin)}, gop ${q(v.gop)}`);
    }
  }
  out.push('');
  return out.join('\n');
}

const isMain = process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) await main();
void marks;
