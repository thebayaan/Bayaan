/* eslint-env node, es2020 */
// Runs the live check on single-ayah clips with no follower: the check is told the
// reader is at the first word of the text's ayah, and the clip, with 2 s of its own
// quiet after it, is fed in 480 ms chunks as sim.mjs feeds a whole recitation.
//
//   node fix2/clips/clip_sim.mjs --set twin --voices <voice,...> [--subs <n>]
//       [--kinds control,event] [--basmala 0|1] [--limit <n>] [--minutes <n>]
//       [--check <liveCheck dir>] [--out <file>]
//   node fix2/clips/clip_sim.mjs --set ikhlas [--limit <n>] [...]
//
// twin: each twin-ayah recording against its own text ('control') and against its
// twin's text ('event'), from .out/fix2/data/twin_ayat (stage/stage_twin.py). Voices are
// the folder names under twin_ayat/audio. --subs runs that many of the sub pairs, chosen
// by a seeded hash; spelling and indel pairs always run. ikhlas: the dev half of
// .out/fix2/data/ikhlas only; the test half is never run.
//
// One JSON line per run, numbers and surah:ayah:word only, appended to
// .out/fix2/clips/<set>.<sha8>.jsonl (<sha8> names the live check's source). Runs whose
// id is already in the output file are skipped, so a stopped run resumes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {loadModel} from '../model.mjs';
import {buildLive} from '../build_live.mjs';
import {
  OUT,
  BINS,
  CHUNK,
  SR,
  ayahCount,
  ayahWords,
  engineFrames,
  parseArgs,
  readF32,
} from '../common.mjs';

export const CLIPS = path.join(OUT, 'clips');
export const DATA = path.join(OUT, 'data');
const TAIL_SECONDS = 2.0;
const QUIET_SECONDS = 0.2;
const FADE = 160; // 10 ms crossfades

/** The clip followed by 2 s of its own quietest 0.2 s, tiled with short crossfades. */
export function withTail(audio) {
  const win = Math.min(audio.length, Math.round(QUIET_SECONDS * SR));
  // Sliding energy over the clip, in 10 ms steps.
  const sq = new Float64Array(audio.length + 1);
  for (let i = 0; i < audio.length; i++) {
    sq[i + 1] = sq[i] + audio[i] * audio[i];
  }
  let best = 0;
  let bestE = Infinity;
  for (let s = 0; s + win <= audio.length; s += 160) {
    const e = sq[s + win] - sq[s];
    if (e < bestE) {
      bestE = e;
      best = s;
    }
  }
  const piece = audio.subarray(best, best + win);
  const fade = Math.min(
    FADE,
    Math.floor(piece.length / 4),
    Math.floor(audio.length / 4),
  );
  const tailLen = Math.round(TAIL_SECONDS * SR);
  // Tiles of the quiet piece, each overlapping the one before by `fade`.
  const tail = new Float32Array(tailLen + fade);
  for (let pos = 0, firstTile = true; pos < tail.length; firstTile = false) {
    const start = firstTile ? 0 : pos - fade;
    for (let i = 0; i < piece.length && start + i < tail.length; i++) {
      const at = start + i;
      if (!firstTile && i < fade) {
        const w = (i + 1) / (fade + 1);
        tail[at] = tail[at] * (1 - w) + piece[i] * w;
      } else {
        tail[at] = piece[i];
      }
    }
    pos = start + piece.length;
  }
  // The clip's last `fade` samples crossfade into the tail's first.
  const out = new Float32Array(audio.length + tailLen);
  out.set(audio, 0);
  for (let i = 0; i < fade; i++) {
    const at = audio.length - fade + i;
    const w = (i + 1) / (fade + 1);
    out[at] = audio[at] * (1 - w) + tail[i] * w;
  }
  out.set(tail.subarray(fade, fade + tailLen), audio.length);
  return out;
}

/**
 * One clip (a recording of some ayah) read against the official text of ayah x. With
 * `trace` (an array), every model run's opinions are pushed onto it.
 */
export async function runClip(
  model,
  createLiveCheck,
  {audioFile, x, trace = null},
) {
  const [sx, ax] = x.split(':').map(Number);
  const raw = readF32(audioFile);
  const audio = withTail(raw);
  const {rows, upTo} = await engineFrames(audio);
  const mel = new Float32Array(rows.length * BINS);
  rows.forEach((row, i) => mel.set(row, i * BINS));
  const deps = {letters: (s, a) => ayahWords(`${s}:${a}`), ayahCount};
  const probes = [];
  const check = createLiveCheck(deps, {}, {probe: line => probes.push(line)});
  const totalWords = ayahWords(x).length;
  check.relocated({surah: sx, ayah: ax, word: 0}, 0);
  check.setPlace({surah: sx, ayah: ax, word: 0, totalWords});
  const finals = new Map();
  let runs = 0;
  for (let c = 0; c < upTo.length; c++) {
    const t = Math.min(audio.length, (c + 1) * CHUNK) / SR;
    for (let n = 0; n < 3; n++) {
      const plan = check.plan(upTo[c]);
      if (!plan) {
        break;
      }
      const frames = plan.to - plan.from;
      const out = await model.runFrames(
        mel.subarray(plan.from * BINS, plan.to * BINS),
        frames,
      );
      runs += 1;
      const energy = new Float32Array(frames);
      for (let f = 0; f < frames; f++) {
        let sum = 0;
        const at = (plan.from + f) * BINS;
        for (let b = 0; b < BINS; b++) {
          sum += mel[at + b];
        }
        energy[f] = sum / BINS;
      }
      const opinions = check.step(plan, out.logp, out.frames, energy);
      if (trace) {
        trace.push({
          t: +t.toFixed(2),
          plan: [plan.from, plan.to],
          ops: opinions.map(o => ({
            w: `${o.surah}:${o.ayah}:${o.word}`,
            r: o.evidence.reading,
            v: o.verdict,
            f: o.final,
            sh: +o.evidence.letterShare.toFixed(3),
            gap: +o.evidence.gap.toFixed(2),
          })),
        });
      }
      for (const o of opinions) {
        const id = `${o.surah}:${o.ayah}:${o.word}#${o.evidence.reading}`;
        if (!o.final || finals.has(id)) {
          continue;
        }
        finals.set(id, {
          word: `${o.surah}:${o.ayah}:${o.word}`,
          reading: o.evidence.reading,
          verdict: o.verdict,
          t: +t.toFixed(2),
          share: +o.evidence.letterShare.toFixed(3),
          gap: +o.evidence.gap.toFixed(2),
          from: +o.evidence.audioFrom.toFixed(2),
          to: +o.evidence.audioTo.toFixed(2),
        });
      }
    }
  }
  return {
    seconds: +(raw.length / SR).toFixed(3),
    runs,
    finals: [...finals.values()],
    probes,
  };
}

const key = (s, a) => `${s}:${a}`;

/**
 * The pairs run: every spelling and indel pair, and `subs` of the sub pairs chosen by a
 * seeded hash order (sha256(seed + '|' + pair id), smallest first).
 */
export function chosenPairs(subs = Infinity, seed = 'clips-2026-11-14') {
  const pairs = JSON.parse(
    fs.readFileSync(path.join(DATA, 'twin_ayat/pairs.json'), 'utf8'),
  );
  const h = id =>
    crypto.createHash('sha256').update(`${seed}|${id}`).digest('hex');
  const keep = new Set(
    pairs
      .filter(p => p.type === 'sub')
      .sort((a, b) => (h(a.id) < h(b.id) ? -1 : 1))
      .slice(0, subs)
      .map(p => p.id),
  );
  return pairs.filter(p => p.type !== 'sub' || keep.has(p.id));
}

/** Run list for a set. Each: {id, clip, voice, group, x, y, audioFile, kind, basmala, ...}. */
export function jobsFor(set, voices, subs = Infinity) {
  if (set === 'twin') {
    const man = JSON.parse(
      fs.readFileSync(path.join(DATA, 'twin_ayat/manifest.json'), 'utf8'),
    ).clips;
    const pairs = chosenPairs(subs);
    const byVK = new Map();
    for (const c of man) {
      byVK.set(`${c.reciter.split(':')[1]}|${key(c.surah, c.ayahStart)}`, c);
    }
    const jobs = new Map();
    const add = (voice, rec, text, kind) => {
      const c = byVK.get(`${voice}|${rec}`);
      if (!c) {
        throw new Error(`no clip ${voice} ${rec}`);
      }
      const id = `twin|${voice}|${rec}|${text}`;
      if (!jobs.has(id)) {
        jobs.set(id, {
          id,
          clip: c.id,
          voice,
          group: c.group,
          x: text,
          y: rec,
          audioFile: c.audio,
          kind,
          basmala: !!c.extra.mayStartWithBasmala,
          warning: c.extra.warning ? 1 : 0,
        });
      }
    };
    // Controls first, so a run stopped early still has its baseline, then events.
    for (const v of voices) {
      for (const p of pairs) {
        add(v, p.x, p.x, 'control');
        add(v, p.y, p.y, 'control');
      }
    }
    for (const v of voices) {
      for (const p of pairs) {
        add(v, p.y, p.x, 'event');
        add(v, p.x, p.y, 'event');
      }
    }
    return [...jobs.values()];
  }
  if (set === 'ikhlas') {
    const man = JSON.parse(
      fs.readFileSync(path.join(DATA, 'ikhlas/manifest.json'), 'utf8'),
    ).clips;
    // The dev half only. The test half is never touched.
    return man
      .filter(c => c.extra.half === 'dev')
      .map(c => ({
        id: `ikhlas|${c.id}`,
        clip: c.id,
        voice: c.extra.speaker,
        group: 'ordinary',
        x: key(c.surah, c.ayahStart),
        y: key(c.surah, c.ayahStart),
        audioFile: c.audio,
        kind: c.label,
        basmala: false,
        errorWords: c.extra.errorWords ?? [],
        errorClasses: c.extra.errorClasses ?? [],
      }));
  }
  throw new Error(`unknown set ${set}: twin or ikhlas`);
}

async function main() {
  const args = parseArgs();
  const set = args.set;
  if (!set) {
    console.error(
      'usage: node fix2/clips/clip_sim.mjs --set twin|ikhlas [options]: see the top of clip_sim.mjs',
    );
    process.exit(2);
  }
  const built = buildLive(args.check);
  const {createLiveCheck} = await import(built.file);
  const sha = built.sha;
  const voices = (args.voices ?? '').split(',').filter(Boolean);
  let jobs = jobsFor(set, voices, Number(args.subs ?? Infinity));
  if (args.kinds) {
    jobs = jobs.filter(j => args.kinds.split(',').includes(j.kind));
  }
  if (args.basmala !== undefined) {
    jobs = jobs.filter(j => j.basmala === (args.basmala === '1'));
  }
  fs.mkdirSync(CLIPS, {recursive: true});
  const outFile =
    args.out ?? path.join(CLIPS, `${set}.${sha.slice(0, 8)}.jsonl`);
  const done = new Set();
  if (fs.existsSync(outFile)) {
    for (const line of fs.readFileSync(outFile, 'utf8').split('\n')) {
      if (line) {
        done.add(JSON.parse(line).id);
      }
    }
  }
  const todo = jobs
    .filter(j => !done.has(j.id))
    .slice(0, Number(args.limit ?? Infinity));
  const deadline = args.minutes
    ? Date.now() + Number(args.minutes) * 60000
    : Infinity;
  console.log(
    JSON.stringify({
      set,
      sha: sha.slice(0, 8),
      jobs: jobs.length,
      done: done.size,
      todo: todo.length,
    }),
  );
  const model = await loadModel();
  const t0 = Date.now();
  let n = 0;
  for (const j of todo) {
    if (Date.now() > deadline) {
      break;
    }
    const r = await runClip(model, createLiveCheck, {
      audioFile: j.audioFile,
      x: j.x,
    });
    const meta = {...j};
    delete meta.audioFile;
    fs.appendFileSync(
      outFile,
      JSON.stringify({...meta, set, sha, ...r}) + '\n',
    );
    n++;
    if (n % 50 === 0) {
      console.log(
        `${n}/${todo.length} ${((Date.now() - t0) / n).toFixed(0)} ms/run`,
      );
    }
  }
  console.log(
    JSON.stringify({ran: n, sec: ((Date.now() - t0) / 1000).toFixed(1)}),
  );
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
