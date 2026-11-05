/* eslint-env node, es2020 */
// Scores multi-event bench runs (mutate2.py) with the app's own mark rules
// (services/recitation/wordMarks.ts, compiled here).
//
//   node scripts/recitation-bench/replay2.mjs <dir> [<dir> ...]
//
// Each <name>.json run may have a <name>.truth.json next to it; a run
// without one is a clean recitation, where every mark is false. Prints, per
// folder: mistakes caught by type, false marks by what they sit on (a
// harmless event such as a pause or a stretched word, or nothing), and the
// totals. WORD_MARKS=<file> replays another version of the rules.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../..');
const require = createRequire(import.meta.url);
const ts = require(path.join(ROOT, 'node_modules/typescript'));
const src = fs.readFileSync(
  process.env.WORD_MARKS ?? path.join(ROOT, 'services/recitation/wordMarks.ts'),
  'utf8',
);
const compiled = path.join(HERE, '.out/wordMarks.replay2.mjs');
fs.mkdirSync(path.dirname(compiled), {recursive: true});
fs.writeFileSync(
  compiled,
  ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText,
);
const marks = await import(`${compiled}?${Date.now()}`);
const UNLOCK = new Set(['lost', 'idle', 'locateFailed', 'completed']);

/** The marks the app would show for a run, plus its skipped-ayah flags. */
export function replayRun(run) {
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
  const byTime = new Map();
  for (const c of run.vchanges) {
    if (!locked(c.t)) continue;
    const [surah, ayah, word] = c.id.split(':').map(Number);
    const list = byTime.get(c.t) ?? [];
    list.push({
      surah,
      ayah,
      word,
      totalWords: totals.get(`${surah}:${ayah}`),
      state: c.to,
      ...(c.d ? {detail: c.d} : {}),
    });
    byTime.set(c.t, list);
  }
  let book = marks.emptyMarkBook();
  const shown = new Map();
  const confirmedAt = new Map();
  const corrected = new Set();
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
    if (byTime.has(t)) note(marks.applyVerdicts(book, byTime.get(t), ms), ms);
  }
  // (corrected is updated by applyVerdicts' corrected list in note())
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
  return {visible, skipped, corrected, confirmedAt};
}

/** Scores one run against its events (none for a clean recitation). */
export function scoreRun(run, events) {
  const {visible, skipped, corrected} = replayRun(run);
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
      on: on ? on.type : 'nothing',
      corrected: corrected.has(id),
    });
  }
  const mistakeAyat = new Set(
    events.filter(e => e.type === 'skip_ayah').map(e => e.key),
  );
  const falseFlags = [...skipped].filter(k => !mistakeAyat.has(k));
  return {caught, missed, falseMarks, falseFlags, fixedShown};
}

function tally(list) {
  const out = {};
  for (const x of list) out[x] = (out[x] ?? 0) + 1;
  return out;
}

const isMain = process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  for (const dir of process.argv.slice(2)) {
    const caught = [];
    const missed = [];
    const falseOn = [];
    let falseRed = 0;
    let fixedShown = 0;
    let falseFlags = 0;
    let runs = 0;
    let minutes = 0;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.endsWith('.json') || f.endsWith('.truth.json')) continue;
      const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (!run.vchanges) continue;
      const truthFile = path.join(dir, f.replace(/\.json$/, '.truth.json'));
      const events = fs.existsSync(truthFile)
        ? JSON.parse(fs.readFileSync(truthFile, 'utf8')).events
        : [];
      const r = scoreRun(run, events);
      caught.push(...r.caught);
      missed.push(...r.missed);
      falseOn.push(
        ...r.falseMarks.map(m => m.on + (m.corrected ? ' (corrected)' : '')),
      );
      falseRed += r.falseMarks.filter(m => !m.corrected).length;
      fixedShown += r.fixedShown.length;
      if (process.env.VERBOSE) {
        console.log(`  ${f}: missed ${JSON.stringify(r.missed)}`);
        for (const m of r.falseMarks)
          console.log(
            `    false ${m.id} at ${m.t?.toFixed?.(1)}s on ${m.on}${m.corrected ? ' (corrected)' : ''}`,
          );
      }
      falseFlags += r.falseFlags.length;
      runs += 1;
      const last = run.log.length ? run.log[run.log.length - 1].t : 0;
      minutes += last / 60;
    }
    const byType = {};
    for (const t of caught)
      byType[t] = [(byType[t]?.[0] ?? 0) + 1, byType[t]?.[1] ?? 0];
    for (const t of missed)
      byType[t] = [byType[t]?.[0] ?? 0, (byType[t]?.[1] ?? 0) + 1];
    console.log(
      `${path.basename(dir)}: ${runs} runs, ${minutes.toFixed(0)} min | ` +
        `caught ${caught.length}/${caught.length + missed.length} | ` +
        `false marks staying red ${falseRed} (${(falseRed / Math.max(1, minutes)).toFixed(2)}/min), ` +
        `later corrected ${falseOn.length - falseRed}, false skipped-ayah flags ${falseFlags} | ` +
        `fixed skips shown then corrected ${fixedShown}`,
    );
    console.log(
      `   caught by type: ${Object.entries(byType)
        .map(([t, [c, m]]) => `${t} ${c}/${c + m}`)
        .join(', ')}`,
    );
    console.log(`   false marks on: ${JSON.stringify(tally(falseOn))}`);
  }
}
