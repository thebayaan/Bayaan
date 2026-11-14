/* eslint-env node, es2020 */
// The app's mark rules in the order the app meets them: verdicts as they come, and the
// second judge's stored answer about a second later, through the pure functions the
// service calls. Against the bench's replay, which applies the answer at the verdict's
// own time. Saved runs and judge rows only: no model runs here.
//   node live_order.mjs [--delay 0.96]
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {standaloneMarks} from '../standaloneMarks.mjs';
const BENCH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
);
const ROOT = path.resolve(BENCH, '../..');
const V = path.join(BENCH, '.out/natural/verify');
const {POLICIES, applyPolicy, loadRows, pct, pigeonhole, replay, wordCount} =
  await import(path.join(V, 'combine_lib.mjs'));
const {answer, woken} = await import(path.join(BENCH, 'judge/policy.mjs'));
const require = createRequire(path.join(ROOT, 'package.json'));
const ts = require('typescript');
const OUT = path.join(BENCH, '.out/engine-stack/port');
fs.mkdirSync(OUT, {recursive: true});
const compiled = path.join(OUT, `wordMarks.live.${process.pid}.mjs`);
fs.writeFileSync(
  compiled,
  ts.transpileModule(
    standaloneMarks(
      fs.readFileSync(
        path.join(ROOT, 'services/recitation/wordMarks.ts'),
        'utf8',
      ),
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText,
);
const rules = await import(compiled);
fs.unlinkSync(compiled);
const delayAt = process.argv.indexOf('--delay');
const DELAY = delayAt > 0 ? Number(process.argv[delayAt + 1]) : 0.96;
const count = (s, a) => wordCount(s, a) ?? undefined;
const UNLOCK = new Set(['lost', 'idle', 'locateFailed', 'completed']);
const LOCK = new Set(['located', 'relocated']);
const placeOf = (w, n) =>
  w === 0 ? 'first' : w === n - 1 ? 'last' : 'interior';
const quiet = run => ({
  ...run,
  vchanges: run.vchanges
    .filter(
      c =>
        !(
          c.d?.junctionMissing === false &&
          c.from === c.to &&
          c.to !== 'skipped' &&
          !c.stop
        ),
    )
    .map(c =>
      c.d?.junctionMissing === false && c.to !== 'skipped'
        ? {...c, d: {...c.d, junctionMissing: undefined}}
        : c,
    ),
});

/** The marks the app would show, answers applied as they arrive. */
function live(run, rows, P, added = []) {
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
  const unlockTimes = new Set(
    log.filter(e => e.type === 'debug' && UNLOCK.has(e.event)).map(e => e.t),
  );
  const lockAt = new Map();
  for (const e of log) {
    if (e.type === 'debug' && LOCK.has(e.event) && e.at) {
      const [surah, ayah, word] = e.at.split(':').map(Number);
      lockAt.set(e.t, {surah, ayah, word});
    }
  }
  const byTime = new Map();
  for (const c of quiet(run).vchanges) {
    if (c.stop || !locked(c.t)) continue;
    const [surah, ayah, word] = c.id.split(':').map(Number);
    const list = byTime.get(c.t) ?? [];
    const d = c.d ?? null;
    list.push({
      surah,
      ayah,
      word,
      totalWords: count(surah, ayah),
      state: c.to,
      ...(d ? {detail: d} : {}),
      ...(c.from === c.to ? {repeat: true} : {}),
      rowKey: `${c.id}|${c.t}|live`,
    });
    byTime.set(c.t, list);
  }
  for (const m of added) {
    const [surah, ayah, word] = m.right.split(':').map(Number);
    const [ls, la, lw] = m.left.split(':').map(Number);
    const list = byTime.get(m.t) ?? [];
    list.push({
      surah,
      ayah,
      word,
      totalWords: count(surah, ayah),
      state: 'ok',
      repeat: true,
      addedBefore: {sounds: 0, noGap: 0, left: {surah: ls, ayah: la, word: lw}},
    });
    byTime.set(m.t, list);
  }
  let book = rules.emptyMarkBook();
  let seen = [];
  let pending = [];
  const shown = new Map();
  const corrected = new Set();
  const key = m => `${m.surah}:${m.ayah}:${m.word}`;
  const noteUpdate = (update, ms) => {
    book = update.book;
    for (const m of update.confirmed) {
      if (m.kind === 'added') continue;
      if (!shown.has(key(m)))
        shown.set(key(m), {
          since: m.since / 1000,
          shownAt: ms / 1000,
          kind: m.kind,
        });
      corrected.delete(key(m));
    }
    for (const m of update.corrected ?? []) corrected.add(key(m));
  };
  const advance = limit => {
    for (;;) {
      const due = rules.nextConfirmAt(book);
      const ans = pending.length ? pending[0].at : null;
      if (due !== null && due <= limit && (ans === null || due <= ans)) {
        noteUpdate(rules.confirmDue(book, due), due);
      } else if (ans !== null && ans <= limit) {
        const p = pending.shift();
        book = rules.applyJudgeAnswer(book, p.verdict, p.say, seen);
      } else {
        return;
      }
    }
  };
  const times = [...new Set([...byTime.keys(), ...unlockTimes])].sort(
    (x, y) => x - y,
  );
  for (const t of times) {
    const ms = t * 1000;
    advance(ms);
    if (unlockTimes.has(t)) {
      book = rules.dropSuspects(book);
      pending = [];
      seen = [];
    }
    const batch = byTime.get(t);
    if (!batch) continue;
    const lock = lockAt.get(t) ?? null;
    const filtered = rules.dropRealignment(
      rules.dropLockArtifacts(batch, lock),
    );
    noteUpdate(rules.applyVerdicts(book, filtered, ms), ms);
    seen = rules.rememberVerdicts(seen, filtered, ms);
    if (rules.isFilteredChunk(batch, lock) || !P) continue;
    for (const c of filtered) {
      if (c.repeat || c.detail?.junctionMissing === true) continue;
      const place = placeOf(c.word, c.totalWords);
      if (!woken(c.state, c.detail, place, P)) continue;
      const row = rows.get(c.rowKey);
      if (!row) continue;
      book = rules.holdForJudge(book, c, ms);
      pending.push({
        at: ms + DELAY * 1000,
        say: answer(row, P),
        verdict: {
          surah: c.surah,
          ayah: c.ayah,
          word: c.word,
          totalWords: c.totalWords,
          state: c.state,
          at: ms,
        },
      });
      pending.sort((x, y) => x.at - y.at);
    }
  }
  advance(Infinity);
  const skipped = new Set(
    (run.flags ?? [])
      .filter(f => !f.stop && f.kind === 'possible_skipped_ayah')
      .map(f => f.key),
  );
  const flagged = id => {
    const [s, a, w] = id.split(':').map(Number);
    return skipped.has(`${s}:${a}`) || (w < 3 && skipped.has(`${s}:${a - 1}`));
  };
  for (const id of [...shown.keys()]) if (flagged(id)) shown.delete(id);
  shown.atEnd = new Set(
    rules
      .shownMarks(book, skipped)
      .filter(m => m.kind !== 'added' && m.status === 'mistake')
      .map(key),
  );
  shown.addedAtEnd = rules
    .shownMarks(book, skipped)
    .filter(m => m.kind === 'added')
    .map(key);
  return shown;
}

const refMarks = (run, rows, P) =>
  new Map(
    replay(P ? applyPolicy(quiet(run), rows, P, wordCount).run : quiet(run), {
      mode: 'app',
      wordCount: count,
    }).visible,
  );
const delayed = (run, rows, P, by) => {
  const a = applyPolicy(quiet(run), rows, P, wordCount).run;
  const moved = {
    ...a,
    vchanges: [
      ...a.vchanges.map(c =>
        c.judge && !c.stop ? {...c, t: +(c.t + by).toFixed(2)} : c,
      ),
    ].sort((x, y) => x.t - y.t),
  };
  return new Map(replay(moved, {mode: 'app', wordCount: count}).visible);
};
function table(name, list) {
  const f = k => {
    const r = pct(
      pigeonhole(
        list.map(x => ({a: x.pair, b: x.reciter, num: x[k], den: 1})),
        1000,
      ),
    );
    return `${r.est}% [${r.lo}, ${r.hi}] (${r.num}/${r.den})`;
  };
  console.log(
    JSON.stringify({
      set: name,
      runs: list.length,
      pairs: new Set(list.map(x => x.pair)).size,
      'replay at verdict time': f('now'),
      'naive delay': f('naive'),
      'app order': f('mine'),
      'differ runs': list.filter(x => x.now !== x.mine).length,
    }),
  );
}
function scoreSet(dir, rowsAll, filter, P = POLICIES.stage2, comb = null) {
  const out = [];
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    const plain = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (filter && !filter(plain)) continue;
    const t = plain.clip.truth;
    const rows = rowsAll.get(plain.clip.id) ?? new Map();
    const run =
      comb && fs.existsSync(path.join(comb, f))
        ? JSON.parse(fs.readFileSync(path.join(comb, f), 'utf8'))
        : plain;
    const exact = `${t.expectedKey}:${t.target}`;
    const now = refMarks(run, rows, P);
    const mine = live(run, rows, P);
    const naive = delayed(run, rows, P, DELAY);
    const extraNow = [...now.keys()].filter(k => k !== exact).length;
    const extraMine = [...mine.keys()].filter(k => k !== exact).length;
    out.push({
      id: plain.clip.id,
      type: t.type,
      position: t.position,
      pair: t.pair ?? t.block,
      reciter: t.reciter,
      now: now.has(exact) ? 1 : 0,
      naive: naive.has(exact) ? 1 : 0,
      mine: mine.has(exact) ? 1 : 0,
      extraNow,
      extraMine,
    });
  }
  return out;
}
const R = path.join(BENCH, '.out/natural/baseline/runs');
const rowsAll = loadRows([
  path.join(V, 'e2e_all'),
  path.join(V, 'e2e_live_end'),
  path.join(V, 'e2e_interior'),
]);
const w1 = scoreSet(
  path.join(R, 'w1'),
  rowsAll,
  run =>
    run.clip.truth.type === 'changed' && run.clip.truth.position === 'interior',
);
table('W1 changed interior, Step 2', w1);
const interior = scoreSet(path.join(V, 'runs_plain/interior'), rowsAll, null);
table('live interior, Step 2', interior);
const last = scoreSet(
  path.join(V, 'runs_plain/live_last'),
  rowsAll,
  null,
  POLICIES.stage2,
  path.join(V, 'runs/live_last'),
);
for (const type of ['carry_last_whole', 'carry_last_ctx', 'arrive_first'])
  table(
    `${type}, Step 2, junction on`,
    last.filter(r => r.type === type),
  );
const last1 = scoreSet(
  path.join(V, 'runs_plain/live_last'),
  rowsAll,
  null,
  POLICIES.stage1,
  path.join(V, 'runs/live_last'),
);
for (const type of ['carry_last_whole', 'carry_last_ctx', 'arrive_first'])
  table(
    `${type}, Step 1, junction on`,
    last1.filter(r => r.type === type),
  );
// False marks on correct recitation: the combined engine's pool with its judge rows.
const rowsPool = loadRows([
  path.join(V, 'e2e_all'),
  path.join(BENCH, '.out/natural/judge/e2e_dev/h048x'),
  path.join(BENCH, '.out/natural/judge/e2e_test/h048x'),
]);
for (const [name, P] of [
  ['Step 2', POLICIES.stage2],
  ['Step 1', POLICIES.stage1],
]) {
  let words = 0,
    now = 0,
    mine = 0,
    none = 0,
    same = 0,
    runs = 0;
  const onlyNow = [];
  const onlyMine = [];
  for (const f of fs.readdirSync(path.join(V, 'runs/pool')).sort()) {
    if (!f.endsWith('.json')) continue;
    const run = JSON.parse(
      fs.readFileSync(path.join(V, 'runs/pool', f), 'utf8'),
    );
    const rows = rowsPool.get(run.clip.id) ?? new Map();
    words += run.clip.truth.words;
    const a = refMarks(run, rows, P);
    const b = live(run, rows, P);
    const c = live(run, rows, null);
    now += a.size;
    mine += b.size;
    none += c.size;
    runs += 1;
    if ([...a.keys()].sort().join() === [...b.keys()].sort().join()) same += 1;
    for (const k of a.keys())
      if (!b.has(k)) onlyNow.push(`${run.clip.id}|${k}`);
    for (const k of b.keys())
      if (!a.has(k)) onlyMine.push(`${run.clip.id}|${k}`);
  }
  console.log(
    JSON.stringify({
      set: `pool false marks, ${name}, junction on`,
      takes: runs,
      words,
      'replay at verdict time': now,
      'app order': mine,
      'no judge': none,
      'same marks': `${same}/${runs}`,
      onlyReplay: onlyNow.length,
      onlyAppOrder: onlyMine.length,
    }),
  );
}

// The neighbour clearing, built: natural added words on the combined engine.
{
  const {marksOf} = await import(path.join(BENCH, 'added/lib.mjs'));
  const rowsAdded = loadRows([path.join(V, 'e2e_added')]);
  const dir = path.join(V, 'runs/added_test');
  const out = [];
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const t = run.clip.truth;
    const rows = rowsAdded.get(run.clip.id) ?? new Map();
    const all = [
      ...marksOf({...run, truth: t, id: run.clip.id}).values(),
    ].filter(m => m.mode === 'live');
    const nb = [t.left, t.right];
    const row = {
      kind: t.kind,
      cluster: t.cluster,
      reciter: t.reciter,
      hit: all.some(m => m.left === t.left && m.right === t.right) ? 1 : 0,
    };
    for (const [name, P] of [
      ['today', null],
      ['s1', POLICIES.stage1],
      ['s2', POLICIES.stage2],
    ]) {
      const without = live(run, rows, P);
      const withAdded = live(run, rows, P, all);
      row[`${name}Without`] = nb.some(x => without.atEnd.has(x)) ? 1 : 0;
      row[`${name}With`] = nb.some(x => withAdded.atEnd.has(x)) ? 1 : 0;
      row[`${name}WithEver`] = nb.some(x => withAdded.has(x)) ? 1 : 0;
      row[`${name}HitWithRed`] =
        row.hit && nb.some(x => withAdded.atEnd.has(x)) ? 1 : 0;
    }
    out.push(row);
  }
  for (const kind of ['interior', 'interior_prefix', 'between']) {
    const list = out.filter(r => r.kind === kind);
    const n = k => list.reduce((x, r) => x + r[k], 0);
    console.log(
      JSON.stringify({
        set: `added ${kind}`,
        runs: list.length,
        events: new Set(list.map(r => r.cluster)).size,
        addedMarksOnEvent: n('hit'),
        'red on neighbours at the end, no added mark': {
          today: n('todayWithout'),
          s1: n('s1Without'),
          s2: n('s2Without'),
        },
        'with the clearing': {
          today: n('todayWith'),
          s1: n('s1With'),
          s2: n('s2With'),
        },
        'red ever shown on them, with the clearing': {
          today: n('todayWithEver'),
          s1: n('s1WithEver'),
          s2: n('s2WithEver'),
        },
      }),
    );
  }
}
