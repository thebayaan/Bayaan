/* eslint-env node, es2020 */
// replay2.mjs with experimental app-side rules on top, each behind an env
// toggle (all off: the same scores as replay2.mjs).
//
//   node scripts/recitation-bench/replay_exp.mjs <dir> [<dir> ...]
//
// HEALTH_GATE=held|lost|both   ignore wrong/skipped verdicts that arrive
//     while the tracker is held, lost, or either (runs from an engine with
//     trackingHealth(); bench.mjs records it in run.health)
// HEALTH_MODE=drop|defer       drop them (default), or hold them back and
//     pass the ones still standing once the tracker is healthy again,
//     tagged `late: true`
// LOCK_GATE=at|next|chunk      in the chunk of a debug located/relocated
//     event (verdicts judged from replayed audio), ignore wrong/skipped
//     verdicts on the located word and any word before it ('at', what the
//     rules' own dropLockArtifacts does), also the word after it ('next'),
//     or on every word of that chunk ('chunk')
// WRONG_MARGIN=x               a 'wrong' verdict needs margin >= x, else it
//     counts as 'unsure' (the engine's own substitution gate uses 0.65)
// WRONG_HEARD=lo:hi            and heardRatio within [lo, hi] (engine: 0.5:1.5)
// FLAG_GATE=seconds            the app-only stand-in for keepContextOnDefer:
//     for this long after an engine flag (auto-deferred, so the engine
//     restarts at the cursor), ignore wrong/skipped verdicts on the cursor
//     word and its two neighbours
// BATCH_GATE=n                ignore wrong/skipped verdicts that arrive in a
//     chunk where at least n words were judged at once across 3 or more
//     ayat (the tracker re-aligning a stretch it had left pending)
// WORD_MARKS=<file>            another version of the mark rules; its
//     applyVerdicts also gets, as a 4th argument, a lookup of each word's
//     latest verdict (stateOf(surah, ayah, word)), which the shipped rules
//     ignore
//
// Also exported: replayRun(run, opts) and scoreRun(run, events, opts), with
// opts {healthGate, healthMode, lockGate, wrongMargin, wrongHeard, flagGate,
// batchGate}.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../..');
const require = createRequire(import.meta.url);
const ts = require(path.join(ROOT, 'node_modules/typescript'));
const src = fs.readFileSync(
  process.env.WORD_MARKS ?? path.join(ROOT, 'services/recitation/wordMarks.ts'),
  'utf8',
);
// One compiled file per rules version, so runs with other rules never
// overwrite it.
const hash = crypto.createHash('sha1').update(src).digest('hex').slice(0, 12);
const compiled = path.join(HERE, `.out/tilawa-exp/wordMarks.${hash}.mjs`);
fs.mkdirSync(path.dirname(compiled), {recursive: true});
if (!fs.existsSync(compiled)) {
  fs.writeFileSync(
    compiled,
    ts.transpileModule(src, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
  );
}
const marks = await import(compiled);
const UNLOCK = new Set(['lost', 'idle', 'locateFailed', 'completed']);
const LOCKS = new Set(['located', 'relocated']);

export function envOptions(env = process.env) {
  const heard = env.WRONG_HEARD ? env.WRONG_HEARD.split(':').map(Number) : null;
  return {
    healthGate: env.HEALTH_GATE || null,
    healthMode: env.HEALTH_MODE || 'drop',
    lockGate: env.LOCK_GATE || null,
    wrongMargin: env.WRONG_MARGIN ? Number(env.WRONG_MARGIN) : null,
    wrongHeard: heard,
    flagGate: env.FLAG_GATE ? Number(env.FLAG_GATE) : null,
    batchGate: env.BATCH_GATE ? Number(env.BATCH_GATE) : null,
  };
}

const isBad = state => state === 'wrong' || state === 'skipped';

/** The tracker's health at each time, from run.health (null without it). */
function healthAt(run) {
  if (!run.health || !run.health.some(h => !h.none)) return null;
  const list = run.health;
  return t => {
    let h = null;
    for (const x of list) {
      if (x.t > t) break;
      h = x;
    }
    return h && !h.none ? h : {lost: false, held: false};
  };
}

/** The marks the app would show for a run, plus its skipped-ayah flags. */
export function replayRun(run, opts = envOptions()) {
  const spans = [];
  let start = null;
  for (const e of run.log) {
    if (e.type === 'word_progress' && start === null) start = e.t;
    else if (e.type === 'debug' && UNLOCK.has(e.event) && start !== null) {
      spans.push([start, e.t]);
      start = null;
    }
  }
  if (start !== null) spans.push([start, Infinity]);
  // As the service: an unlock lands before that chunk's verdicts.
  const locked = t => spans.some(([a, b]) => a <= t && t < b);
  const unlockTimes = run.log
    .filter(e => e.type === 'debug' && UNLOCK.has(e.event))
    .map(e => e.t);
  const totals = new Map();
  for (const c of run.vchanges) {
    const [s, a, w] = c.id.split(':').map(Number);
    totals.set(`${s}:${a}`, Math.max(totals.get(`${s}:${a}`) ?? 0, w + 1));
  }
  const totalOf = (s, a) => totals.get(`${s}:${a}`) ?? 0;
  // Lock chunks: the located word, by chunk time.
  const lockAt = new Map();
  for (const e of run.log) {
    if (e.type === 'debug' && LOCKS.has(e.event) && e.at) {
      const [s, a, w] = e.at.split(':').map(Number);
      lockAt.set(e.t, {surah: s, ayah: a, word: w});
    }
  }
  const before = (x, y) =>
    x.surah === y.surah &&
    (x.ayah < y.ayah || (x.ayah === y.ayah && x.word <= y.word));
  const nextWord = w => {
    const n = totalOf(w.surah, w.ayah);
    return w.word + 1 < n
      ? {surah: w.surah, ayah: w.ayah, word: w.word + 1}
      : {surah: w.surah, ayah: w.ayah + 1, word: 0};
  };
  const health = opts.healthGate ? healthAt(run) : null;
  const unhealthy = t => {
    if (!health) return false;
    const h = health(t);
    if (opts.healthGate === 'held') return !!h.held;
    if (opts.healthGate === 'lost') return !!h.lost;
    return !!h.held || !!h.lost;
  };
  const gated = {
    health: 0,
    lock: 0,
    evidence: 0,
    deferred: 0,
    flag: 0,
    batch: 0,
  };
  // BATCH_GATE: chunks where many words across several ayat were judged at once.
  const bigBatch = new Set();
  if (opts.batchGate) {
    const judged = new Map();
    for (const c of run.vchanges) {
      if (c.stop || c.to === 'pending') continue;
      const e = judged.get(c.t) ?? {n: 0, ayat: new Set()};
      e.n += 1;
      e.ayat.add(c.id.split(':').slice(0, 2).join(':'));
      judged.set(c.t, e);
    }
    for (const [t, e] of judged) {
      if (e.n >= opts.batchGate && e.ayat.size >= 3) bigBatch.add(t);
    }
  }
  // FLAG_GATE: each flag before stop, with the cursor word it was raised at.
  const flagWindows = [];
  if (opts.flagGate) {
    const stopAt = Math.min(
      ...run.vchanges.filter(c => c.stop).map(c => c.t),
      Infinity,
    );
    for (const fl of run.flags) {
      if (fl.t >= stopAt) continue;
      let cursor = null;
      for (const e of run.log) {
        if (e.t > fl.t) break;
        if (e.type === 'word_progress') cursor = e;
      }
      if (!cursor) continue;
      const [s, a] = cursor.key.split(':').map(Number);
      flagWindows.push({
        from: fl.t,
        to: fl.t + opts.flagGate,
        surah: s,
        ayah: a,
        word: cursor.w,
      });
    }
  }
  const nearFlag = (t, ch) =>
    flagWindows.some(
      f =>
        t >= f.from &&
        t <= f.to &&
        ch.surah === f.surah &&
        ((ch.ayah === f.ayah && Math.abs(ch.word - f.word) <= 1) ||
          (ch.ayah === f.ayah + 1 &&
            f.word + 1 >= totalOf(f.surah, f.ayah) &&
            ch.word === 0) ||
          (ch.ayah === f.ayah - 1 &&
            f.word === 0 &&
            ch.word === totalOf(ch.surah, ch.ayah) - 1)),
    );
  const byTime = new Map();
  // HEALTH_MODE=defer: bad verdicts held back, by word, until the tracker
  // is healthy again.
  const deferred = new Map();
  const healthTimes = health
    ? run.health.filter(h => !h.none).map(h => h.t)
    : [];
  const push = (t, change) => {
    const list = byTime.get(t) ?? [];
    list.push(change);
    byTime.set(t, list);
  };
  const changesInOrder = run.vchanges.filter(c => !c.stop);
  for (const c of changesInOrder) {
    // After stop() the app no longer hears verdicts.
    if (!locked(c.t)) continue;
    const [surah, ayah, word] = c.id.split(':').map(Number);
    const change = {
      surah,
      ayah,
      word,
      totalWords: totals.get(`${surah}:${ayah}`),
      state: c.to,
      ...(c.d ? {detail: c.d} : {}),
    };
    if (change.state === 'wrong' && c.d) {
      const m = c.d.margin;
      const hr = c.d.heardRatio;
      const weakMargin =
        opts.wrongMargin !== null &&
        opts.wrongMargin !== undefined &&
        !(typeof m === 'number' && m >= opts.wrongMargin);
      const oddHeard =
        opts.wrongHeard &&
        !(
          typeof hr === 'number' &&
          hr >= opts.wrongHeard[0] &&
          hr <= opts.wrongHeard[1]
        );
      if (weakMargin || oddHeard) {
        change.state = 'unsure';
        gated.evidence += 1;
      }
    }
    if (isBad(change.state) && bigBatch.has(c.t)) {
      gated.batch += 1;
      continue;
    }
    if (isBad(change.state) && flagWindows.length && nearFlag(c.t, change)) {
      gated.flag += 1;
      continue;
    }
    if (isBad(change.state) && opts.lockGate && lockAt.has(c.t)) {
      const at = lockAt.get(c.t);
      const hit =
        opts.lockGate === 'chunk' ||
        before(change, at) ||
        (opts.lockGate === 'next' &&
          (() => {
            const n = nextWord(at);
            return (
              change.surah === n.surah &&
              change.ayah === n.ayah &&
              change.word === n.word
            );
          })());
      if (hit) {
        gated.lock += 1;
        continue;
      }
    }
    if (opts.healthGate && health) {
      if (isBad(change.state) && unhealthy(c.t)) {
        gated.health += 1;
        if (opts.healthMode === 'defer')
          deferred.set(c.id, {...change, t0: c.t});
        continue;
      }
      // A later verdict on a held-back word replaces it.
      if (deferred.has(c.id)) deferred.delete(c.id);
    }
    push(c.t, change);
  }
  if (opts.healthMode === 'defer' && deferred.size) {
    // Release what is still bad at the first healthy, locked moment after
    // each word went bad (as reporting it then, if it has not changed).
    for (const [id, change] of deferred) {
      const t0 = change.t0;
      const release = healthTimes.find(
        t => t > t0 && !unhealthy(t) && locked(t),
      );
      if (release === undefined) continue;
      let now = null;
      for (const c of changesInOrder) {
        if (c.t > release) break;
        if (c.id === id) now = c.to;
      }
      if (now !== change.state) continue;
      const late = {...change, late: true};
      delete late.t0;
      push(release, late);
      gated.deferred += 1;
    }
  }
  let book = marks.emptyMarkBook();
  const shown = new Map();
  const confirmedAt = new Map();
  const corrected = new Set();
  const latest = new Map();
  const stateOf = (s, a, w) => latest.get(`${s}:${a}:${w}`);
  const note = (update, atMs) => {
    book = update.book;
    for (const m of update.confirmed) {
      const id = `${m.surah}:${m.ayah}:${m.word}`;
      if (!shown.has(id)) {
        shown.set(id, m.since / 1000);
        confirmedAt.set(id, atMs / 1000);
      }
      corrected.delete(id);
    }
    for (const m of update.corrected ?? []) {
      corrected.add(`${m.surah}:${m.ayah}:${m.word}`);
    }
  };
  const times = [...new Set([...byTime.keys(), ...unlockTimes])].sort(
    (x, y) => x - y,
  );
  const unlockAt = new Set(unlockTimes);
  for (const t of times) {
    const ms = t * 1000;
    for (
      let due = marks.nextConfirmAt(book);
      due !== null && due <= ms;
      due = marks.nextConfirmAt(book)
    ) {
      note(marks.confirmDue(book, due), due);
    }
    // The service drops pending suspects when the engine loses the reader
    // (rules without dropSuspects keep them).
    if (unlockAt.has(t) && marks.dropSuspects) book = marks.dropSuspects(book);
    if (byTime.has(t)) {
      // As replay2: the lock chunk's verdicts were judged from replayed
      // audio (rules without dropLockArtifacts take them as they are).
      const list = marks.dropLockArtifacts
        ? marks.dropLockArtifacts(byTime.get(t), lockAt.get(t) ?? null)
        : byTime.get(t);
      for (const c of list) {
        if (c.state !== 'pending')
          latest.set(`${c.surah}:${c.ayah}:${c.word}`, c.state);
      }
      note(marks.applyVerdicts(book, list, ms, stateOf), ms);
    }
  }
  for (
    let due = marks.nextConfirmAt(book);
    due !== null;
    due = marks.nextConfirmAt(book)
  ) {
    note(marks.confirmDue(book, due), due);
  }
  const skipped = new Set(
    run.flags.filter(f => f.kind === 'possible_skipped_ayah').map(f => f.key),
  );
  const visible = new Map();
  for (const [id, t] of shown) {
    const [s, a, w] = id.split(':').map(Number);
    if (skipped.has(`${s}:${a}`) || (w < 3 && skipped.has(`${s}:${a - 1}`))) {
      continue;
    }
    visible.set(id, t);
  }
  return {visible, skipped, corrected, confirmedAt, gated};
}

/** Scores one run against its events (none for a clean recitation). */
export function scoreRun(run, events, opts = envOptions()) {
  const {visible, skipped, corrected, confirmedAt, gated} = replayRun(
    run,
    opts,
  );
  const caught = [];
  const missed = [];
  const explained = new Set();
  for (const e of events.filter(x => x.mistake)) {
    const [s, a] = e.key.split(':').map(Number);
    if (e.type === 'skip_ayah') {
      (skipped.has(e.key) ? caught : missed).push(e.type);
      for (const id of visible.keys()) {
        const [s2, a2, w2] = id.split(':').map(Number);
        if (s2 === s && (a2 === a || (a2 === a + 1 && w2 < 3))) {
          explained.add(id);
        }
      }
      continue;
    }
    const near = [-1, 0, 1].map(k => `${s}:${a}:${e.word - 1 + k}`);
    const hit = near.filter(id => visible.has(id));
    hit.forEach(id => explained.add(id));
    (hit.length > 0 ? caught : missed).push(e.type);
  }
  // A skip the learner then fixed was a real slip on the first attempt:
  // marking it and then showing it corrected is right.
  const fixedShown = [];
  for (const e of events.filter(x => x.type === 'skip_then_fix')) {
    const [s, a] = e.key.split(':').map(Number);
    for (const k of [-1, 0, 1]) {
      const id = `${s}:${a}:${e.word - 1 + k}`;
      if (visible.has(id) && corrected.has(id)) {
        explained.add(id);
        fixedShown.push(id);
      }
    }
  }
  const falseMarks = [];
  for (const id of visible.keys()) {
    if (explained.has(id)) continue;
    const [s, a] = id.split(':').map(Number);
    const on = events.find(e => !e.mistake && e.key === `${s}:${a}`);
    falseMarks.push({
      id,
      t: visible.get(id),
      shownAt: confirmedAt.get(id),
      on: on ? on.type : 'nothing',
      corrected: corrected.has(id),
    });
  }
  const mistakeAyat = new Set(
    events.filter(e => e.type === 'skip_ayah').map(e => e.key),
  );
  const falseFlags = [...skipped].filter(k => !mistakeAyat.has(k));
  // Marks that point at a planted mistake.
  const rightMarks = [...explained]
    .filter(id => visible.has(id))
    .map(id => ({id, t: visible.get(id), shownAt: confirmedAt.get(id)}));
  return {
    caught,
    missed,
    falseMarks,
    falseFlags,
    fixedShown,
    gated,
    skippedFlags: skipped.size,
    rightMarks,
  };
}

function tally(list) {
  const out = {};
  for (const x of list) out[x] = (out[x] ?? 0) + 1;
  return out;
}

/** Folder totals for one set of options. */
export function scoreDir(dir, opts = envOptions(), filter = () => true) {
  const caught = [];
  const missed = [];
  const falseOn = [];
  let falseRed = 0;
  let fixedShown = 0;
  let falseFlags = 0;
  let skippedFlags = 0;
  let runs = 0;
  let minutes = 0;
  let cleanMinutes = 0;
  let cleanFalseRed = 0;
  const gated = {
    health: 0,
    lock: 0,
    evidence: 0,
    deferred: 0,
    flag: 0,
    batch: 0,
  };
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json') || f.endsWith('.truth.json')) continue;
    if (!filter(f)) continue;
    const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!run.vchanges) continue;
    const truthFile = path.join(dir, f.replace(/\.json$/, '.truth.json'));
    const events = fs.existsSync(truthFile)
      ? JSON.parse(fs.readFileSync(truthFile, 'utf8')).events
      : [];
    const r = scoreRun(run, events, opts);
    caught.push(...r.caught);
    missed.push(...r.missed);
    falseOn.push(
      ...r.falseMarks.map(m => m.on + (m.corrected ? ' (corrected)' : '')),
    );
    const red = r.falseMarks.filter(m => !m.corrected).length;
    falseRed += red;
    fixedShown += r.fixedShown.length;
    if (process.env.VERBOSE) {
      console.log(`  ${f}: missed ${JSON.stringify(r.missed)}`);
      for (const m of r.falseMarks)
        console.log(
          `    false ${m.id} at ${m.t?.toFixed?.(1)}s on ${m.on}${m.corrected ? ' (corrected)' : ''}`,
        );
    }
    falseFlags += r.falseFlags.length;
    skippedFlags += r.skippedFlags;
    for (const k of Object.keys(gated)) gated[k] += r.gated[k];
    runs += 1;
    const last = run.log.length ? run.log[run.log.length - 1].t : 0;
    minutes += last / 60;
    if (!events.length) {
      cleanMinutes += last / 60;
      cleanFalseRed += red;
    }
  }
  const byType = {};
  for (const t of caught)
    byType[t] = [(byType[t]?.[0] ?? 0) + 1, byType[t]?.[1] ?? 0];
  for (const t of missed)
    byType[t] = [byType[t]?.[0] ?? 0, (byType[t]?.[1] ?? 0) + 1];
  return {
    runs,
    minutes,
    caught: caught.length,
    planted: caught.length + missed.length,
    byType,
    falseRed,
    laterCorrected: falseOn.length - falseRed,
    falseOn: tally(falseOn),
    falseFlags,
    skippedFlags,
    fixedShown,
    cleanMinutes,
    cleanFalseRed,
    gated,
  };
}

export function printScore(name, s) {
  console.log(
    `${name}: ${s.runs} runs, ${s.minutes.toFixed(0)} min | ` +
      `caught ${s.caught}/${s.planted} | ` +
      `false marks staying red ${s.falseRed} (${(s.falseRed / Math.max(1, s.minutes)).toFixed(2)}/min), ` +
      `later corrected ${s.laterCorrected}, false skipped-ayah flags ${s.falseFlags} | ` +
      `fixed skips shown then corrected ${s.fixedShown}`,
  );
  console.log(
    `   caught by type: ${Object.entries(s.byType)
      .map(([t, [c, m]]) => `${t} ${c}/${c + m}`)
      .join(', ')}`,
  );
  console.log(`   false marks on: ${JSON.stringify(s.falseOn)}`);
  const g = Object.entries(s.gated).filter(([, n]) => n > 0);
  if (g.length)
    console.log(`   verdicts gated: ${JSON.stringify(Object.fromEntries(g))}`);
}

const isMain = process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  const opts = envOptions();
  for (const dir of process.argv.slice(2)) {
    printScore(path.basename(dir), scoreDir(dir, opts));
  }
}
