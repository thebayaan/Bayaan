/* eslint-env node, es2020 */
// The app's wrapper on real audio against the same clip's bench run.
import fs from 'node:fs';
import path from 'node:path';
const BENCH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..',
);
const S = path.join(BENCH, '.out/engine-stack');
const {replay} = await import(path.join(BENCH, 'natural/replay.mjs'));
const {marksOf} = await import(path.join(BENCH, 'added/lib.mjs'));
const words = JSON.parse(
  fs.readFileSync(
    path.join(BENCH, '.out/natural/manifests/engine_words.json'),
    'utf8',
  ),
);
const wordCount = (s, a) => words[`${s}:${a}`];
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
for (const [file, dir] of [
  ['wrap_pool.jsonl', 'on_pool'],
  ['wrap_w1.jsonl', 'on_w1'],
]) {
  let n = 0,
    sameV = 0,
    sameNews = 0,
    sameMarks = 0,
    marks = 0,
    sameAdded = 0,
    added = 0,
    firstDiffs = [],
    unsaid = 0;
  for (const line of fs.readFileSync(path.join(S, file), 'utf8').split('\n')) {
    if (!line) continue;
    const w = JSON.parse(line);
    const run = JSON.parse(
      fs.readFileSync(
        path.join(
          BENCH,
          '.out/engine-stack/runs',
          dir,
          `${w.id.replace(/[^\w.-]/g, '_')}.json`,
        ),
        'utf8',
      ),
    );
    n += 1;
    const b = run.vchanges
      .filter(c => !c.stop && c.from !== c.to)
      .map(c => `${c.t}|${c.id}|${c.to}`);
    const a = w.changes
      .filter(c => !c.repeat)
      .map(c => `${c.t}|${c.id}|${c.to}`);
    if (JSON.stringify(a) === JSON.stringify(b)) sameV += 1;
    else {
      const i = a.findIndex((x, k) => x !== b[k]);
      firstDiffs.push({
        id: w.id,
        i,
        a: a.slice(Math.max(0, i - 1), i + 2),
        b: b.slice(Math.max(0, i - 1), i + 2),
        lens: [a.length, b.length],
      });
    }
    const qb = quiet(run)
      .vchanges.filter(
        c => !c.stop && c.from === c.to && c.d?.junctionMissing != null,
      )
      .map(c => `${c.t}|${c.id}|${c.d.junctionMissing}`);
    const qa = w.changes
      .filter(c => c.repeat && c.junction !== null)
      .map(c => `${c.t}|${c.id}|${c.junction}`);
    if (JSON.stringify(qa) === JSON.stringify(qb)) sameNews += 1;
    else firstDiffs.push({id: w.id, news: {qa, qb}});
    unsaid += w.changes.filter(c => c.junction === true).length;
    const v = replay(quiet(run), {mode: 'app', wordCount}).visible;
    const ref = [...v.entries()]
      .map(([id, m]) => [id, m.kind, m.since, m.shownAt])
      .sort();
    const got = w.visible
      .map(([id, m]) => [id, m.kind, m.since, m.shownAt])
      .sort();
    marks += ref.length;
    if (JSON.stringify(ref) === JSON.stringify(got)) sameMarks += 1;
    else firstDiffs.push({id: w.id, marks: {ref, got}});
    const addedRef = [
      ...marksOf({...run, truth: run.clip.truth, id: run.clip.id}).values(),
    ]
      .filter(m => m.mode === 'live')
      .map(m => `${m.right}|${m.t}`)
      .sort();
    const addedGot = w.added.map(m => `${m.id}|${m.t}`).sort();
    added += addedRef.length;
    if (JSON.stringify(addedRef) === JSON.stringify(addedGot)) sameAdded += 1;
    else firstDiffs.push({id: w.id, added: {addedRef, addedGot}});
  }
  console.log(
    JSON.stringify({
      file,
      clips: n,
      verdictsSame: `${sameV}/${n}`,
      junctionNewsSame: `${sameNews}/${n}`,
      unsaidReported: unsaid,
      marksSame: `${sameMarks}/${n}`,
      marks,
      addedSame: `${sameAdded}/${n}`,
      added,
    }),
  );
  for (const d of firstDiffs.slice(0, 8))
    console.log('  ', JSON.stringify(d).slice(0, 600));
}
{
  let n = 0,
    marks = 0;
  const rows = [];
  for (const line of fs
    .readFileSync(path.join(S, 'wrap_added.jsonl'), 'utf8')
    .split('\n')) {
    if (!line) continue;
    const w = JSON.parse(line);
    n += 1;
    marks += w.added.length;
    rows.push([
      w.id.replace(/^added__/, ''),
      w.added.map(a => a.id),
      w.visible.map(([id]) => id),
    ]);
  }
  console.log(
    JSON.stringify({file: 'wrap_added.jsonl', clips: n, addedMarks: marks}),
  );
  for (const r of rows.filter(r => r[1].length).slice(0, 6))
    console.log('  ', JSON.stringify(r).slice(0, 200));
}
