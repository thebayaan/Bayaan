/* eslint-env node, es2020 */
// The numbers behind the second look as it first went in, the rule RULE.md calls P1:
// what it does to the marks the app would show, on bench runs already made. The app has
// since moved on to the frozen rule; this stays to reproduce RULE.md's comparison.
//
// No engine runs. Each run goes through the app's mark rules (natural/replay.mjs).
// Each mark gets the slice the app then had, t - 4.6 s to t + 0.9 s clipped to the
// whole chunks fed when the mark falls due, scored on quran-asr-small by the judge
// in scripts/recitation-bench/judge the way the port then scored it: firstWithin off.
// Above -2 per letter the mark is cancelled; with no score it stays, as in the app.
// A second column shows the same marks with the judge's default firstWithin, the
// rule that port left out.
//
//   NV=<folder> node scripts/second-look/after_verdict.mjs \
//     shipped/none_0 shipped/one_ar_10 shipped/crowd_10 shipped/one_ar_5 \
//     w1int/none_0 w1int/one_ar_5
//
// shipped/<condition> reads the bench's .out/chatter/runs/shipped (chatter/run.mjs):
// correct recitation, so every mark is false. <set>/<condition> reads
// $NV/runs/<set>/<condition>: W1's clips run the same way, so a mark on the changed
// or skipped word is a catch. config.ts's w1int is W1's changed words inside an
// ayah; w1 has the rest, with the only first words that get marked.
//
// OUT=<file> also writes one row per mark. REPLAY=<file> takes another copy of
// natural/replay.mjs, which compiles the mark rules into the bench's .out.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.resolve(HERE, '../recitation-bench');
const OUT = path.join(BENCH, '.out');
const {NV} = process.env;

const SR = 16000;
const CHUNK = 0.48;
const SLICE_BEFORE_S = 4.6;
const SLICE_AFTER_S = 0.9;
const FITS_ABOVE_PER_LETTER = -2;
const NO_ALTERNATIVES = {mut: [], near: []};

const {replay} = await import(
  process.env.REPLAY ?? path.join(BENCH, 'natural/replay.mjs')
);
const {loadModel} = await import(path.join(BENCH, 'judge/model.mjs'));
const {judgeWord} = await import(path.join(BENCH, 'judge/judge.mjs'));
const {takeWindow} = await import(path.join(BENCH, 'chatter/mix.mjs'));

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const readF32 = file =>
  new Float32Array(new Uint8Array(fs.readFileSync(file)).buffer);

const words = readJson(path.join(OUT, 'natural/manifests/engine_words.json'));
const wordCount = (s, a) => words[`${s}:${a}`];
const index = readJson(path.join(OUT, 'natural/judge/index.json'));
const clipsOf = name =>
  new Map(
    readJson(path.join(OUT, 'natural/manifests', name)).map(c => [c.id, c]),
  );
const pool = clipsOf('pool.json');
const w1 = clipsOf('w1.json');
const tracks = {};
const track = name =>
  (tracks[name] ??= readF32(path.join(OUT, 'chatter/tracks', `${name}.f32`)));
const model = await loadModel();

// Ayahs where the engine splits a word: the app has no letters for them.
const SPLIT = new Set(['15:7', '27:20', '36:22']);

function audioOf(run, table) {
  const clip = table.get(run.clip.id);
  const pieces = (clip.parts ?? [{audio: clip.audio}]).map(p =>
    readF32(p.audio),
  );
  const reader = new Float32Array(pieces.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const piece of pieces) {
    reader.set(piece, at);
    at += piece.length;
  }
  const {mix} = run.clip;
  if (!mix || !mix.gain || mix.track === 'none') return reader;
  const noise = takeWindow(track(mix.track), mix.offset, reader.length);
  const out = new Float32Array(reader.length);
  for (let i = 0; i < out.length; i++) {
    out[i] = (reader[i] + mix.gain * noise[i]) * mix.scale;
  }
  return out;
}

/** Per letter, firstWithin off and on; null when the app would not check. */
async function scores(wave, letters, j, t, fed) {
  const from = Math.max(0, Math.floor((t - SLICE_BEFORE_S) * SR));
  const to = Math.min(
    wave.length,
    Math.ceil((t + SLICE_AFTER_S) * SR),
    Math.round(fed * SR),
  );
  if (to - from < SR) return {score: null, withFirstWithin: null};
  const {logp, frames} = await model.run(wave.subarray(from, to));
  const perLetter = opts =>
    +(
      judgeWord(logp, frames, letters, j, NO_ALTERNATIVES, opts).expected /
      [...letters[j]].length
    ).toFixed(3);
  return {
    score: perLetter({firstWithin: frames}),
    withFirstWithin: perLetter({}),
  };
}

async function scoreMark(run, wave, id, info) {
  const [s, a, w] = id.split(':').map(Number);
  const key = `${s}:${a}`;
  const letters = index.ayat[key]?.map(x => x.l);
  const bad = run.vchanges.filter(
    c => c.id === id && (c.to === 'wrong' || c.to === 'skipped') && !c.stop,
  );
  if (SPLIT.has(key) || !letters || w >= letters.length || !bad.length) {
    return {score: null, withFirstWithin: null};
  }
  // The latest bad verdict so far, and the audio fed so far: whole chunks.
  const {t} = bad.filter(c => c.t <= info.shownAt).pop() ?? bad[bad.length - 1];
  const fed = Math.min(
    wave.length / SR,
    Math.floor(info.shownAt / CHUNK + 1e-9) * CHUNK,
  );
  return {t, fed, ...(await scores(wave, letters, w, t, fed))};
}

const stays = score => score === null || score <= FITS_ABOVE_PER_LETTER;
const rows = [];
for (const spec of process.argv.slice(2)) {
  const [set, condition] = spec.split('/');
  const isFalse = set === 'shipped';
  const dir = isFalse
    ? path.join(OUT, 'chatter/runs/shipped', condition)
    : path.join(NV, 'runs', set, condition);
  let reciterWords = 0;
  const marks = [];
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const run = readJson(path.join(dir, file));
    reciterWords += run.clip.truth.words ?? 0;
    const {visible} = replay(run, {mode: 'app', wordCount});
    if (!visible.size) continue;
    const {truth} = run.clip;
    if (isFalse) {
      const wave = audioOf(run, pool);
      for (const [id, info] of visible) {
        marks.push({
          id,
          run: run.clip.id,
          position: null,
          ...(await scoreMark(run, wave, id, info)),
        });
      }
    } else if (truth.type === 'changed' || truth.type === 'skipped') {
      const id = `${truth.expectedKey}:${truth.target}`;
      if (!visible.has(id)) continue;
      marks.push({
        id,
        run: run.clip.id,
        position: truth.position,
        ...(await scoreMark(run, audioOf(run, w1), id, visible.get(id))),
      });
    }
  }
  const stayed = key => marks.filter(m => stays(m[key])).length;
  const rate = n => ((1000 * n) / Math.max(1, reciterWords)).toFixed(2);
  rows.push(...marks.map(m => ({spec, ...m})));
  console.log(
    isFalse
      ? `${spec.padEnd(20)} ${marks.length} false marks in ${reciterWords} words: ${rate(marks.length)} per 1,000 -> ${rate(stayed('score'))} (${stayed('score')} stay), with firstWithin ${rate(stayed('withFirstWithin'))} (${stayed('withFirstWithin')} stay)`
      : `${spec.padEnd(20)} ${marks.length} catches: ${stayed('score')} stay, with firstWithin ${stayed('withFirstWithin')} stay`,
  );
  for (const position of ['first', 'interior', 'last']) {
    const some = marks.filter(m => m.position === position);
    if (!some.length) continue;
    const kept = some.filter(m => stays(m.score)).length;
    console.log(`  ${position}: ${some.length} catches, ${kept} stay`);
  }
}
if (process.env.OUT) {
  fs.writeFileSync(
    process.env.OUT,
    `${rows.map(r => JSON.stringify(r)).join('\n')}\n`,
  );
}
