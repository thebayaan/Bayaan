/* eslint-env node, es2020 */
// A copy of ../recitation-bench/natural/replay.mjs with one addition: the cancel step,
// asked when a mark falls due (`decide`). It reads the frozen copy of the rules under
// .out/natural/verify, never services/. The original's notes:
//
// Replays one bench run through the app's own mark rules
// (compiled; WORD_MARKS=<file> tries another version), as replay2.mjs does, with three
// differences:
//
// - word counts come from the engine's corpus, as the app gets them, not from
//   the highest word the run happened to report;
// - stop-time events are left out, since the app has stopped listening by then;
// - it can add the harness's end-of-input flush, in three modes:
//     app    what the app hears: live verdicts only;
//     flush  plus the flush's verdicts on words the live ones left unjudged, as
//            one last chunk at the end of the audio;
//     carry  plus a correct next word after that, as when the reader carries on
//            into the next ayah instead of the clip ending. Only then can the
//            next-word rule pass for a clip's last words.
//
// It also records why each bad verdict did or did not become a mark.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const BENCH = path.resolve(HERE, '..');
const ROOT = path.resolve(BENCH, '../..');
const require = createRequire(import.meta.url);
const ts = require(path.join(ROOT, 'node_modules/typescript'));

const src = fs.readFileSync(
  process.env.WORD_MARKS ??
    path.join(BENCH, '.out/natural/verify/wordMarks.combined.ts'),
  'utf8',
);
const compiled = path.join(
  BENCH,
  `.out/chatter/learners_built/wordMarks.${process.pid}.mjs`,
);
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
export const marks = await import(compiled);
fs.unlinkSync(compiled);

const UNLOCK = new Set(['lost', 'idle', 'locateFailed', 'completed']);
const LOCK = new Set(['located', 'relocated']);
const isBad = state => state === 'wrong' || state === 'skipped';

/** Why the rules let a bad verdict go, or null if it can become a suspect. */
export function ruleVerdict(change) {
  const gop = change.detail?.gop;
  if (change.state === 'skipped') {
    if (typeof gop === 'number' && gop > marks.SKIP_FITS_GOP) return 'gop_fits';
    if (
      change.word === 0 &&
      typeof gop !== 'number' &&
      (change.detail?.heardRatio ?? 0) > marks.FIRST_SKIP_HEARD
    ) {
      return 'first_word_heard';
    }
    return null;
  }
  if (change.state === 'wrong') {
    if (change.word <= 0 || change.word >= change.totalWords - 1) {
      return 'ayah_edge';
    }
    if (typeof gop === 'number' && gop > marks.WRONG_FITS_GOP)
      return 'gop_fits';
    return null;
  }
  return null;
}

/**
 * The marks the app would show for a run.
 * @param {object} run a bench result
 * @param {object} opts
 * @param {string} opts.mode 'app', 'flush' or 'carry'
 * @param {(s: number, a: number) => number} [opts.wordCount] the engine's word
 *   count of an ayah; left out, it is replay2's highest reported word
 * @param {(q: {id: string, t: number, due: number, since: number, kind: string}) => string}
 *   [opts.decide] the cancel step: 'cancel' sends the due mark to noted, never shown;
 *   t is its latest bad verdict. A later bad verdict can raise the word again.
 * @returns {{visible: Map, skipped: Set, reasons: Map, trail: Map}} `visible`
 *   holds id -> {since, shownAt, kind, corrected, viaFlush}; `reasons` holds
 *   id -> rule names that kept a bad verdict from showing; `trail` holds every
 *   verdict the replay saw per word.
 */
export function replay(
  run,
  {mode = 'app', wordCount = null, decide = null} = {},
) {
  const log = run.log.filter(e => !e.stop);
  const spans = [];
  let start = null;
  for (const e of log) {
    if (e.type === 'word_progress' && start === null) start = e.t;
    else if (e.type === 'debug' && UNLOCK.has(e.event) && start !== null) {
      spans.push([start, e.t]);
      start = null;
    }
  }
  if (start !== null) spans.push([start, Infinity]);
  const locked = t => spans.some(([a, b]) => a <= t && t < b);
  const unlockTimes = log
    .filter(e => e.type === 'debug' && UNLOCK.has(e.event))
    .map(e => e.t);

  const highest = new Map();
  for (const c of run.vchanges) {
    const [s, a, w] = c.id.split(':').map(Number);
    highest.set(`${s}:${a}`, Math.max(highest.get(`${s}:${a}`) ?? 0, w + 1));
  }
  const total = wordCount ?? ((s, a) => highest.get(`${s}:${a}`));

  const lockAt = new Map();
  for (const e of log) {
    if (e.type === 'debug' && LOCK.has(e.event) && e.at) {
      const [surah, ayah, word] = e.at.split(':').map(Number);
      lockAt.set(e.t, {surah, ayah, word});
    }
  }

  const reasons = new Map();
  const trail = new Map();
  const reason = (id, why) => {
    const list = reasons.get(id) ?? [];
    list.push(why);
    reasons.set(id, list);
  };
  const seen = (id, entry) => {
    const list = trail.get(id) ?? [];
    list.push(entry);
    trail.set(id, list);
  };

  const byTime = new Map();
  for (const c of run.vchanges) {
    if (c.stop) continue;
    const [surah, ayah, word] = c.id.split(':').map(Number);
    if (c.to !== 'pending') {
      seen(c.id, {t: c.t, state: c.to, ...(c.d ? {d: c.d} : {})});
    }
    if (!locked(c.t)) {
      if (isBad(c.to)) reason(c.id, 'not_locked');
      continue;
    }
    const list = byTime.get(c.t) ?? [];
    list.push({
      surah,
      ayah,
      word,
      totalWords: total(surah, ayah),
      state: c.to,
      ...(c.d ? {detail: c.d} : {}),
    });
    byTime.set(c.t, list);
  }

  let book = marks.emptyMarkBook();
  const shown = new Map();
  const corrected = new Set();
  const key = c => `${c.surah}:${c.ayah}:${c.word}`;

  let suspects = 0;
  const note = (update, atMs, viaFlush = false) => {
    const before = book;
    book = update.book;
    for (const [id, m] of book) {
      if (m.status === 'suspect' && before.get(id)?.status !== 'suspect')
        suspects += 1;
    }
    for (const m of update.confirmed) {
      const id = key(m);
      const t = Math.round(m.lastBadAt / 10) / 100;
      if (
        decide?.({
          id,
          t,
          due: atMs / 1000,
          since: m.since / 1000,
          kind: m.kind,
        }) === 'cancel'
      ) {
        const next = new Map(book);
        next.set(id, {...m, status: 'noted'});
        book = next;
        continue;
      }
      if (!shown.has(id)) {
        shown.set(id, {
          since: m.since / 1000,
          shownAt: atMs / 1000,
          kind: m.kind,
          viaFlush,
          lastBadAt: t,
        });
      }
      corrected.delete(id);
    }
    for (const m of update.corrected ?? []) corrected.add(key(m));
    // Suspects the confirm step dropped: not followed in time, or confusion.
    for (const [id, m] of book) {
      const was = before.get(id);
      if (was?.status === 'suspect' && m.status === 'noted') {
        if (update.isConfirm) {
          reason(
            id,
            was.followedAt === undefined ? 'not_followed' : 'confused',
          );
        } else {
          reason(id, 'flipped_back');
        }
      }
    }
  };
  const confirm = (book0, at) => ({
    ...marks.confirmDue(book0, at),
    isConfirm: true,
  });
  const runDue = (limitMs, viaFlush = false) => {
    for (
      let due = marks.nextConfirmAt(book);
      due !== null && due <= limitMs;
      due = marks.nextConfirmAt(book)
    ) {
      note(confirm(book, due), due, viaFlush);
    }
  };
  const applyBatch = (batch, ms, lock, viaFlush = false) => {
    let filtered = batch;
    if (marks.dropLockArtifacts) {
      filtered = marks.dropLockArtifacts(filtered, lock);
      for (const c of batch) {
        if (isBad(c.state) && !filtered.includes(c))
          reason(key(c), 'lock_chunk');
      }
    }
    if (marks.dropRealignment) {
      const after = marks.dropRealignment(filtered);
      for (const c of filtered) {
        if (isBad(c.state) && !after.includes(c)) reason(key(c), 'realignment');
      }
      filtered = after;
    }
    for (const c of filtered) {
      if (!isBad(c.state)) continue;
      const why = ruleVerdict(c);
      if (why) reason(key(c), why);
    }
    note(marks.applyVerdicts(book, filtered, ms), ms, viaFlush);
  };

  const times = [...new Set([...byTime.keys(), ...unlockTimes])].sort(
    (x, y) => x - y,
  );
  const unlockAt = new Set(unlockTimes);
  for (const t of times) {
    const ms = t * 1000;
    runDue(ms);
    if (unlockAt.has(t) && marks.dropSuspects) {
      const before = book;
      book = marks.dropSuspects(book);
      for (const [id, m] of book) {
        if (before.get(id)?.status === 'suspect' && m.status === 'noted') {
          reason(id, 'dropped_when_lost');
        }
      }
    }
    if (byTime.has(t)) applyBatch(byTime.get(t), ms, lockAt.get(t) ?? null);
  }

  // The harness's flush, tagged everywhere it can reach a mark.
  if (mode !== 'app' && run.flush?.verdicts?.length) {
    const endMs = (run.summary?.seconds ?? 0) * 1000;
    runDue(endMs);
    const batch = [];
    for (const v of run.flush.verdicts) {
      if (!v.newly || v.state === 'pending') continue;
      const [surah, ayah, word] = v.id.split(':').map(Number);
      seen(v.id, {t: endMs / 1000, state: v.state, flush: true, d: v.d});
      batch.push({
        surah,
        ayah,
        word,
        totalWords: total(surah, ayah),
        state: v.state,
        detail: v.d,
      });
    }
    if (batch.length) applyBatch(batch, endMs, null, true);
    if (mode === 'carry') {
      const ayat = new Set(
        [...book.values()]
          .filter(m => m.status === 'suspect')
          .map(m => `${m.surah}:${m.ayah}`),
      );
      for (const k of ayat) {
        const [surah, ayah] = k.split(':').map(Number);
        note(
          marks.applyVerdicts(
            book,
            [
              {
                surah,
                ayah: ayah + 1,
                word: 0,
                totalWords: total(surah, ayah + 1) ?? 1,
                state: 'ok',
              },
            ],
            endMs + 1,
          ),
          endMs + 1,
          true,
        );
      }
    }
    runDue(Infinity, true);
  } else {
    runDue(Infinity);
  }

  const flags = (run.flags ?? []).filter(f => mode !== 'app' || !f.stop);
  const skipped = new Set(
    flags.filter(f => f.kind === 'possible_skipped_ayah').map(f => f.key),
  );
  const visible = new Map();
  for (const [id, info] of shown) {
    const [s, a, w] = id.split(':').map(Number);
    if (skipped.has(`${s}:${a}`) || (w < 3 && skipped.has(`${s}:${a - 1}`))) {
      continue;
    }
    visible.set(id, {...info, corrected: corrected.has(id)});
  }
  return {visible, skipped, reasons, trail, book, suspects};
}

/** Flags the app shows in its end-of-take summary (flags.ts), from a run. */
export function shownFlags(run) {
  const out = [];
  for (const f of run.flags ?? []) {
    let kind = null;
    if (f.kind === 'possible_skipped_ayah') kind = 'skippedAyah';
    else if (f.kind === 'possible_omission') kind = 'skippedWord';
    else if (f.kind === 'possible_substitution') {
      kind = f.source === 'similar_verse' ? 'similarAyah' : 'differentWord';
    }
    if (kind) out.push({...f, shown: kind});
  }
  return out;
}
