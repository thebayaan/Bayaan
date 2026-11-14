/* eslint-env node, es2020 */
// The engine stack's own runs against the prototype engines' runs on the same clips:
// every verdict with its junction result, every place read through wordFrames, and the
// added marks the rule gives from each engine's gap report.
import fs from 'node:fs';
import path from 'node:path';
const BENCH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
);
const {marksOf} = await import(path.join(BENCH, 'added/lib.mjs'));
const R = path.join(BENCH, '.out/engine-stack/runs');
const V = path.join(BENCH, '.out/natural/verify/runs');
const J = path.join(BENCH, '.out/natural/junction/v2/final_check');
const J1 = path.join(BENCH, '.out/natural/junction/v2/check');
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clean = c => {
  const out = {t: c.t, id: c.id, from: c.from, to: c.to, stop: c.stop ?? false};
  if (c.d) {
    out.d = {...c.d};
    if (out.d.junctionMissing === undefined || out.d.junctionMissing === null) {
      delete out.d.junction;
      delete out.d.junctionMissing;
    }
  }
  return out;
};
for (const [mine, others] of [
  ['on_pool', [path.join(V, 'pool')]],
  ['on_sites', [path.join(J, 'live')]],
  ['on_control', [path.join(V, 'control')]],
  ['on_added', [path.join(V, 'added_test')]],
  ['on_w1', [path.join(J1, 'w1')]],
  ['on_last', [path.join(V, 'live_last')]],
]) {
  const dir = path.join(R, mine);
  if (!fs.existsSync(dir)) continue;
  let n = 0,
    missing = 0,
    vSame = 0,
    framesSame = 0,
    framesEntries = 0,
    framesCompared = 0,
    addedSame = 0,
    addedMarks = 0,
    llr = 0,
    unsaid = 0;
  const diffs = [];
  for (const f of fs
    .readdirSync(dir)
    .filter(x => x.endsWith('.json'))
    .sort()) {
    const other = others.map(d => path.join(d, f)).find(p => fs.existsSync(p));
    if (!other) {
      missing += 1;
      continue;
    }
    n += 1;
    const a = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const b = JSON.parse(fs.readFileSync(other, 'utf8'));
    const va = a.vchanges.map(clean);
    const vb = b.vchanges.map(clean);
    if (eq(va, vb)) vSame += 1;
    else {
      const i = va.findIndex((x, k) => !eq(x, vb[k]));
      diffs.push({
        f,
        kind: 'vchanges',
        i,
        a: va[i],
        b: vb[i],
        lens: [va.length, vb.length],
      });
    }
    for (const c of a.vchanges) {
      if (c.d?.junction !== undefined && c.d?.junction !== null) llr += 1;
      if (c.d?.junctionMissing === true) unsaid += 1;
    }
    if (b.probe?.framesLog) {
      framesCompared += 1;
      const fa = a.probe.framesLog;
      const fb = b.probe.framesLog;
      framesEntries += fb.length;
      if (eq(fa, fb)) framesSame += 1;
      else {
        const i = fa.findIndex((x, k) => !eq(x, fb[k]));
        diffs.push({
          f,
          kind: 'frames',
          i,
          a: fa[i],
          b: fb[i],
          lens: [fa.length, fb.length],
        });
      }
    }
    if (b.probe?.gaps) {
      const m = r =>
        [...marksOf(r).values()]
          .filter(x => x.mode === 'live')
          .map(x => `${x.left}|${x.right}|${x.t}`)
          .sort();
      const ma = m(a);
      const mb = m(b);
      addedMarks += mb.length;
      if (eq(ma, mb)) addedSame += 1;
      else diffs.push({f, kind: 'added', a: ma, b: mb});
    }
  }
  console.log(
    JSON.stringify({
      set: mine,
      clips: n,
      noOther: missing,
      verdictsIdentical: `${vSame}/${n}`,
      junctionRows: llr,
      unsaidRows: unsaid,
      placesIdentical: `${framesSame}/${framesCompared}`,
      placeEntries: framesEntries,
      addedIdentical: `${addedSame}/${framesCompared}`,
      addedMarks,
    }),
  );
  for (const d of diffs.slice(0, 6))
    console.log('  ', JSON.stringify(d).slice(0, 700));
}
