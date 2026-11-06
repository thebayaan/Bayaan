/* eslint-env node, es2020 */
// Replays bench runs' verdict timelines through the app's own mark rules
// (services/recitation/wordMarks.ts, compiled here), so the numbers are the
// app's, not a re-implementation's.
//
//   node scripts/recitation-bench/replay.mjs <rundir> [<rundir> ...]
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../..');
const require = createRequire(import.meta.url);
const ts = require(path.join(ROOT, 'node_modules/typescript'));
// WORD_MARKS=<path> replays another version of the rules (e.g. the last
// commit's, for a before/after).
const src = fs.readFileSync(
  process.env.WORD_MARKS ?? path.join(ROOT, 'services/recitation/wordMarks.ts'),
  'utf8',
);
const out = path.join(HERE, '.out/wordMarks.mjs');
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(
  out,
  ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText,
);
const marks = await import(`${out}?${Date.now()}`);

const UNLOCK = new Set(['lost', 'idle', 'locateFailed', 'completed']);

/** Marks the app would show for one run: ids confirmed, in Tilawa indices. */
function replay(run) {
  // Locked spans, as RecitationTrackingService gates verdicts.
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
  const locked = t => spans.some(([a, b]) => a <= t && t <= b);

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
    });
    byTime.set(c.t, list);
  }
  let book = marks.emptyMarkBook();
  const shown = new Set();
  const note = update => {
    book = update.book;
    for (const m of update.confirmed)
      shown.add(`${m.surah}:${m.ayah}:${m.word}`);
  };
  for (const t of [...byTime.keys()].sort((x, y) => x - y)) {
    const ms = t * 1000;
    // The app's timer confirms due suspects before the next chunk lands.
    for (
      let due = marks.nextConfirmAt(book);
      due !== null && due <= ms;
      due = marks.nextConfirmAt(book)
    ) {
      note(marks.confirmDue(book, due));
    }
    note(marks.applyVerdicts(book, byTime.get(t), ms));
  }
  for (
    let due = marks.nextConfirmAt(book);
    due !== null;
    due = marks.nextConfirmAt(book)
  ) {
    note(marks.confirmDue(book, due));
  }
  const skipped = new Set(
    run.flags.filter(f => f.kind === 'possible_skipped_ayah').map(f => f.key),
  );
  // As shownMarks: words left to a skipped-ayah flag do not show.
  const visible = [...shown].filter(id => {
    const [s, a, w] = id.split(':').map(Number);
    return !(
      skipped.has(`${s}:${a}`) ||
      (w < 3 && skipped.has(`${s}:${a - 1}`))
    );
  });
  return {visible: new Set(visible), skipped};
}

for (const dir of process.argv.slice(2)) {
  let falseMarks = 0;
  let hit = 0;
  let total = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json') || f.startsWith('qdc_')) continue;
    const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const {visible, skipped} = replay(run);
    if (f.startsWith('clean_')) {
      falseMarks += visible.size + skipped.size;
      continue;
    }
    const [rid, name] = f.slice(0, -5).split('__');
    const cases = JSON.parse(
      fs.readFileSync(path.join(dir, `cases_${rid}`, 'cases.json'), 'utf8'),
    );
    for (const t of cases.find(c => c.name === name).truth) {
      total += 1;
      if (t.kind === 'skippedAyah') {
        hit += skipped.has(t.key) ? 1 : 0;
      } else {
        const [s, a] = t.key.split(':');
        hit += [-1, 0, 1].some(k => visible.has(`${s}:${a}:${t.word - 1 + k}`))
          ? 1
          : 0;
      }
    }
  }
  console.log(
    `${path.basename(dir)}: false marks ${falseMarks}, caught ${hit}/${total}`,
  );
}
