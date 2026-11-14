/* eslint-env node, es2020 */
// Packs a suite's raw runs into one JSONL with only what the added-word rule and
// the mark replay read, so the raw files can go:
//   node added/extract.mjs <runsDir> <out.jsonl>
import fs from 'node:fs';
import path from 'node:path';

const [dir, outFile] = process.argv.slice(2);
const out = fs.createWriteStream(outFile);
const r3 = x => (typeof x === 'number' ? +x.toFixed(3) : null);
// Lock changes, and the first word progress after each: replay.mjs needs no more.
const UNLOCK = new Set(['lost', 'idle', 'locateFailed', 'completed']);
function keepLog(log) {
  const out = [];
  let open = false;
  for (const e of log) {
    if (e.type === 'debug' && e.event) {
      out.push(e);
      if (!e.stop && UNLOCK.has(e.event)) open = false;
    } else if (e.type === 'word_progress' && !open) {
      out.push(e);
      open = true;
    }
  }
  return out;
}
let n = 0;
for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith('.json')) continue;
  const r = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
  const row = {
    id: r.clip?.id ?? name,
    truth: r.clip?.truth ?? null,
    expected: r.clip?.expected ?? null,
    summary: {seconds: r.summary?.seconds ?? null, firstLock: r.summary?.firstLock ?? null},
    partsAt: r.partsAt ?? null,
    // What natural/replay.mjs reads.
    log: keepLog(r.log ?? []),
    vchanges: (r.vchanges ?? [])
      .filter(c => !c.stop)
      .map(c => ({
        t: c.t,
        id: c.id,
        to: c.to,
        ...(c.d ? {d: {gop: r3(c.d.gop), heardRatio: r3(c.d.heardRatio), distance: r3(c.d.distance)}} : {}),
      })),
    flags: r.flags ?? [],
    health: (r.health ?? []).filter(h => h.lost || h.held).map(h => ({t: h.t, lost: !!h.lost, held: !!h.held})),
    probe: r.probe ?? null,
    transcript: r.flush?.transcript ?? null,
  };
  out.write(JSON.stringify(row) + '\n');
  n += 1;
}
out.end();
console.log(`${n} runs -> ${outFile}`);
