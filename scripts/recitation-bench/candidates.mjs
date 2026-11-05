/* eslint-env node, es2020 */
// Every mark the app shows on bench runs, with its context and whether it
// was right, so candidate rules can be tried on the whole corpus at once.
//
//   node scripts/recitation-bench/candidates.mjs <dir>... > marks.jsonl
//
// One JSON line per shown mark (the app's current rules, via replay2.mjs):
// {run, id, t, state, d, label: 'true'|'false', on, corrected, features}.
// Features use only what the app knows at that moment, except the ones
// named "after" (for analysis of what a short wait would reveal).
import fs from 'node:fs';
import path from 'node:path';

const {replayRun, scoreRun} = await import(
  path.join(path.dirname(new URL(import.meta.url).pathname), 'replay2.mjs')
);
const UNLOCK = new Set(['lost', 'idle', 'locateFailed', 'completed']);

for (const dir of process.argv.slice(2)) {
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json') || f.endsWith('.truth.json')) continue;
    const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!run.vchanges) continue;
    const truthFile = path.join(dir, f.replace(/\.json$/, '.truth.json'));
    const events = fs.existsSync(truthFile)
      ? JSON.parse(fs.readFileSync(truthFile, 'utf8')).events
      : [];
    const {visible, confirmedAt} = replayRun(run);
    const scored = scoreRun(run, events);
    const falseById = new Map(scored.falseMarks.map(m => [m.id, m]));

    // Locks: the first word_progress after the start or an unlock event.
    const locks = [];
    let unlocked = true;
    for (const e of run.log) {
      if (e.type === 'word_progress' && unlocked) {
        locks.push({t: e.t, key: e.key, w: e.w});
        unlocked = false;
      } else if (e.type === 'debug' && UNLOCK.has(e.event)) unlocked = true;
    }
    const unlocks = run.log
      .filter(e => e.type === 'debug' && UNLOCK.has(e.event))
      .map(e => e.t);
    const progress = run.log.filter(e => e.type === 'word_progress');
    const totals = new Map();
    for (const c of run.vchanges) {
      const [s, a, w] = c.id.split(':').map(Number);
      totals.set(`${s}:${a}`, Math.max(totals.get(`${s}:${a}`) ?? 0, w + 1));
    }
    const chains = new Map();
    for (const c of run.vchanges) {
      const list = chains.get(c.id) ?? [];
      list.push(c);
      chains.set(c.id, list);
    }

    for (const [id, since] of visible) {
      const [s, a, w] = id.split(':').map(Number);
      const key = `${s}:${a}`;
      const first =
        (chains.get(id) ?? []).find(
          c => (c.to === 'wrong' || c.to === 'skipped') && c.t >= since - 0.01,
        ) ??
        (chains.get(id) ?? []).find(
          c => c.to === 'wrong' || c.to === 'skipped',
        );
      const lock = [...locks].reverse().find(l => l.t <= since + 1e-6);
      const [ls, la] = lock ? lock.key.split(':').map(Number) : [0, 0];
      const beforeLock =
        lock !== undefined &&
        ((ls === s && la === a && w < lock.w) || (ls === s && a < la));
      const visited = progress.some(
        p => p.t < since && p.key === key && p.w >= w,
      );
      const visitedExact = progress.some(
        p => p.t < since && p.key === key && p.w === w,
      );
      const nextUnlock = unlocks.find(u => u >= since);
      const prevUnlock = [...unlocks].reverse().find(u => u <= since);
      const neighbours = [...chains.entries()].filter(([id2, cs]) => {
        if (id2 === id) return false;
        const [s2, a2, w2] = id2.split(':').map(Number);
        return (
          s2 === s &&
          a2 === a &&
          Math.abs(w2 - w) <= 3 &&
          cs.some(
            c =>
              (c.to === 'wrong' || c.to === 'skipped') &&
              Math.abs(c.t - since) <= 2,
          )
        );
      }).length;
      const prevLast = `${s}:${a - 1}:${(totals.get(`${s}:${a - 1}`) ?? 0) - 1}`;
      const prevLastWrongNear = (chains.get(prevLast) ?? []).some(
        c => c.to === 'wrong' && Math.abs(c.t - since) <= 2,
      );
      const at = confirmedAt.get(id) ?? since;
      const unlockBeforeConfirm = unlocks.some(u => u >= since && u <= at);
      // Other words of this ayah within 3 that went bad from 2 s before the
      // suspect until it was confirmed: what the app knows at that moment.
      const neighboursAtConfirm = [...chains.entries()].filter(([id2, cs]) => {
        if (id2 === id) return false;
        const [s2, a2, w2] = id2.split(':').map(Number);
        return (
          s2 === s &&
          a2 === a &&
          Math.abs(w2 - w) <= 3 &&
          cs.some(
            c =>
              (c.to === 'wrong' || c.to === 'skipped') &&
              c.t >= since - 2 &&
              c.t <= at,
          )
        );
      }).length;
      const fm = falseById.get(id);
      console.log(
        JSON.stringify({
          run: `${path.basename(dir)}/${f}`,
          id,
          t: since,
          state: first?.to ?? null,
          d: first?.d ?? null,
          label: fm ? 'false' : 'true',
          on: fm?.on ?? null,
          corrected: fm?.corrected ?? false,
          features: {
            word: w,
            words: totals.get(key) ?? null,
            isLast: w === (totals.get(key) ?? 0) - 1,
            sinceLock: lock ? +(since - lock.t).toFixed(2) : null,
            beforeLock,
            visited,
            visitedExact,
            afterUnlockIn:
              nextUnlock !== undefined
                ? +(nextUnlock - since).toFixed(2)
                : null,
            sincePrevUnlock:
              prevUnlock !== undefined
                ? +(since - prevUnlock).toFixed(2)
                : null,
            neighbours,
            prevLastWrongNear,
            confirmDelay: +(at - since).toFixed(2),
            unlockBeforeConfirm,
            neighboursAtConfirm,
          },
        }),
      );
    }
  }
}
