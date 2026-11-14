/* eslint-env node, es2020 */
// One table per suite for score.mjs: each clip's truth with what today's rules, the real
// pass and each played setting showed. Reads the stream once and keeps only marks, counts
// and verdict strings, so scoring needs no large files. Loads no model.
//   node scripts/second-look/final/digest.mjs --suite <name>
// Writes .out/second-look/final/digest/<suite>.jsonl.
import fs from 'node:fs';
import path from 'node:path';
import {FINAL, SUITES} from './suites.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2)
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const name = args.suite;
const suite = SUITES[name];
const SR = 16000;
const CHUNK = 7680;

function* lines(file) {
  if (!fs.existsSync(file)) return;
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.alloc(1 << 22);
  let tail = [];
  for (;;) {
    const n = fs.readSync(fd, buffer, 0, buffer.length);
    if (!n) break;
    let start = 0;
    for (;;) {
      const nl = buffer.indexOf(10, start);
      if (nl < 0 || nl >= n) break;
      tail.push(Buffer.from(buffer.subarray(start, nl)));
      yield Buffer.concat(tail).toString();
      tail = [];
      start = nl + 1;
    }
    tail.push(Buffer.from(buffer.subarray(start, n)));
  }
  fs.closeSync(fd);
}
const filesOf = dir =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter(f => new RegExp(`^${name}\\.\\d+\\.jsonl$`).test(f))
        .sort()
        .map(f => path.join(dir, f))
    : [];

const today = new Map();
for (const f of [path.join(FINAL, 'today', `${name}.jsonl`)]) {
  for (const l of lines(f)) {
    const r = JSON.parse(l);
    today.set(r.id, r);
  }
}
const played = new Map();
for (const f of filesOf(path.join(FINAL, 'marks'))) {
  for (const l of lines(f)) {
    const r = JSON.parse(l);
    played.set(r.id, r.cfg);
  }
}
const clips = new Map(suite.clips().map(c => [c.id, c]));
const dir = path.join(FINAL, 'digest');
fs.mkdirSync(dir, {recursive: true});
const out = fs.openSync(path.join(dir, `${name}.jsonl`), 'w');
const parity = {
  clips: 0,
  verdictsToday: 0,
  verdictsLost: 0,
  clipsSameVerdicts: 0,
};
const LOST = new Set(['lost', 'relocated', 'locateFailed', 'idle']);
for (const f of filesOf(path.join(FINAL, 'stream'))) {
  for (const l of lines(f)) {
    const rec = JSON.parse(l);
    const clip = clips.get(rec.id);
    const fires = new Set();
    const said = new Set();
    let lost = 0;
    const verdicts = new Set();
    const chunkAt = k =>
      +(Math.min((k + 1) * CHUNK, Math.round(rec.seconds * SR)) / SR).toFixed(
        2,
      );
    for (const [k, m] of rec.msgs) {
      if (m.type === 'debug' && LOST.has(m.event)) lost += 1;
      if (m.type !== 'word_verdicts') continue;
      for (const c of m.changes) {
        const id = `${c.surah}:${c.ayah}:${c.word}`;
        if (c.detail?.junctionMissing === true) fires.add(id);
        if (c.detail?.junctionMissing === false) said.add(id);
        if (!c.repeat) verdicts.add(`${chunkAt(k)}|${id}|${c.state}`);
      }
    }
    const t = today.get(rec.id) ?? null;
    if (t?.verdicts) {
      parity.clips += 1;
      const missing = t.verdicts.filter(v => !verdicts.has(v));
      parity.verdictsToday += t.verdicts.length;
      parity.verdictsLost += missing.length;
      if (!missing.length) parity.clipsSameVerdicts += 1;
    }
    let partEnd = null;
    if (clip.parts?.length > 1) {
      partEnd = fs.statSync(clip.parts[0].audio).size / 4 / SR;
    }
    const {verdicts: _v, ...todayMarks} = t ?? {};
    fs.writeSync(
      out,
      `${JSON.stringify({
        id: rec.id,
        seconds: rec.seconds,
        truth: clip.truth ?? null,
        mix: clip.mix ?? null,
        segments: clip.segments ? true : undefined,
        partEnd,
        lost,
        fires: [...fires],
        said: [...said],
        afterEnd: rec.afterEnd,
        wallMs: rec.wallMs,
        real: {shown: rec.shown, added: rec.added, stats: rec.stats},
        today: t ? todayMarks : null,
        cfg: played.get(rec.id) ?? null,
      })}\n`,
    );
  }
}
fs.closeSync(out);
console.log(JSON.stringify({suite: name, ...parity}));
