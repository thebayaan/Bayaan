/* eslint-env node, es2020 */
// Runs correct recitation with chatter behind it through the bench, one condition
// at a time. Mixed audio exists only while its condition runs, and finished clips
// are skipped, so it resumes.
//
//   node chatter/run.mjs --conds one_ar:10,tv_ar:5,none:0,alone:crowd [--jobs 3]
//       [--minutes 17] [--limit N] [--variant name] [--half dev|test]
//
// A condition is track:snr. none:0 feeds the recitation with nothing added and
// must match the natural baseline exactly. alone:<track> feeds chatter with no
// recitation at all. --variant keeps an engine variant's runs apart; TILAWA_DIST
// and ENGINE_OPTS pass through to bench.mjs. --half test reads test reciters on test
// passages rather than the tuning half: read it once, with its own --variant.
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {mixAtSnr, takeWindow, windowOffset} from './mix.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const BENCH = path.resolve(HERE, '..');
const OUT = path.join(BENCH, '.out/chatter');
const POOL = path.join(BENCH, '.out/natural/manifests/pool.json');
const SR = 16000;
const ALONE_WINDOWS = 6;
const ALONE_SECONDS = 180;
const MIN_FREE_BYTES = 8e9;
const SAME_PASSAGE_LEAD_SECONDS = 6;

const arg = name => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};

function readF32(file) {
  return new Float32Array(new Uint8Array(fs.readFileSync(file)).buffer);
}

function writeF32(file, x) {
  fs.writeFileSync(file, Buffer.from(x.buffer, x.byteOffset, x.byteLength));
}

const md5 = s => crypto.createHash('md5').update(s).digest('hex');
const clipSeconds = c =>
  c.parts.reduce((sum, p) => sum + fs.statSync(p.audio).size / 4 / SR, 0);

/**
 * One half of the pool: `half` reciters on `half` passages. The tuning half is 'dev'.
 * Each reciter gives clips in a fixed scattered order until `minutes` are reached.
 */
export function selectClips(pool, minutes, seconds = clipSeconds, half = 'dev') {
  const byReciter = new Map();
  for (const c of pool) {
    if (c.truth.reciterSplit !== half || c.truth.blockSplit !== half) continue;
    if (!byReciter.has(c.truth.reciter)) byReciter.set(c.truth.reciter, []);
    byReciter.get(c.truth.reciter).push(c);
  }
  const out = [];
  for (const clips of byReciter.values()) {
    let total = 0;
    for (const c of clips.sort((a, b) => (md5(a.id) < md5(b.id) ? -1 : 1))) {
      out.push(c);
      total += seconds(c);
      if (total >= minutes * 60) break;
    }
  }
  return out;
}

/** The tuning half's list is what score.mjs and build_reciters.py read. */
export const clipListName = half => (half === 'dev' ? 'clips.json' : `clips.${half}.json`);

const resultFile = (dir, id) => path.join(dir, `${String(id).replace(/[^\w.-]/g, '_')}.json`);

function concatParts(parts) {
  const pieces = parts.map(p => readF32(p.audio));
  const out = new Float32Array(pieces.reduce((n, p) => n + p.length, 0));
  const partsAt = [];
  let at = 0;
  pieces.forEach((p, i) => {
    out.set(p, at);
    partsAt.push({key: parts[i].key ?? null, start: at / SR, end: (at + p.length) / SR});
    at += p.length;
  });
  return {audio: out, partsAt};
}

function mixManifest(cond, clips, mixDir, runDir) {
  const [track, snrText] = cond.split(':');
  const samePassage = track === 'rec_same';
  const shared =
    track === 'none' || samePassage ? null : readF32(path.join(OUT, 'tracks', `${track}.f32`));
  const snr = Number(snrText);
  const manifest = [];
  for (const clip of clips) {
    if (fs.existsSync(resultFile(runDir, clip.id))) continue;
    const {audio, partsAt} = concatParts(clip.parts);
    // The same passage by another reciter, a few seconds ahead of the reader.
    const noise = samePassage
      ? readF32(path.join(OUT, 'tracks', 'same', `${md5(clip.id)}.f32`))
      : shared;
    const offset = samePassage
      ? SAME_PASSAGE_LEAD_SECONDS * SR
      : noise
        ? windowOffset(clip.id, track, noise.length)
        : 0;
    const window = noise ? takeWindow(noise, offset, audio.length) : null;
    const {mix, gain, scale} = mixAtSnr(audio, window, snr);
    const file = path.join(mixDir, `${md5(clip.id)}.f32`);
    writeF32(file, mix);
    const {parts: _parts, ...rest} = clip;
    manifest.push({...rest, audio: file, partsAt, mix: {track, snr, offset, gain, scale}});
  }
  return manifest;
}

function aloneManifest(track, mixDir, runDir) {
  const noise = readF32(path.join(OUT, 'tracks', `${track}.f32`));
  const manifest = [];
  for (let i = 0; i < ALONE_WINDOWS; i++) {
    const id = `alone__${track}__${i}`;
    if (fs.existsSync(resultFile(runDir, id))) continue;
    const offset = windowOffset(id, track, noise.length);
    const file = path.join(mixDir, `${md5(id)}.f32`);
    writeF32(file, takeWindow(noise, offset, ALONE_SECONDS * SR));
    manifest.push({
      id,
      audio: file,
      suite: 'alone',
      truth: {type: 'alone', track},
      mix: {track, offset},
    });
  }
  return manifest;
}

function runSuite(manifestFile, runDir, jobs) {
  return new Promise((resolve, reject) => {
    const p = spawn(
      'node',
      [path.join(BENCH, 'natural/run_suite.mjs'), manifestFile, runDir, '--jobs', String(jobs)],
      {stdio: ['ignore', 'ignore', 'inherit']},
    );
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`suite exited ${code}`))));
  });
}

async function main() {
  const conds = (arg('conds') ?? '').split(',').filter(Boolean);
  if (!conds.length) throw new Error('usage: run.mjs --conds track:snr,... (see the top of this file)');
  const jobs = Number(arg('jobs') ?? 3);
  const pool = JSON.parse(fs.readFileSync(POOL, 'utf8'));
  const half = arg('half') ?? 'dev';
  let clips = selectClips(pool, Number(arg('minutes') ?? 17), clipSeconds, half);
  if (arg('limit')) clips = clips.slice(0, Number(arg('limit')));
  const root = path.join(OUT, 'runs', arg('variant') ?? 'shipped');
  fs.writeFileSync(path.join(OUT, clipListName(half)), JSON.stringify(clips.map(c => c.id), null, 1));
  console.log(`${clips.length} clips, ${(clips.reduce((n, c) => n + clipSeconds(c), 0) / 60).toFixed(0)} min`);
  for (const cond of conds) {
    const {bavail, bsize} = fs.statfsSync(OUT);
    if (bavail * bsize < MIN_FREE_BYTES) {
      throw new Error(`stopping before ${cond}: under ${MIN_FREE_BYTES / 1e9} GB of disk free`);
    }
    const name = cond.replace(':', '_');
    const runDir = path.join(root, name);
    const mixDir = path.join(OUT, 'mix', name);
    fs.mkdirSync(runDir, {recursive: true});
    fs.mkdirSync(mixDir, {recursive: true});
    const manifest = cond.startsWith('alone:')
      ? aloneManifest(cond.split(':')[1], mixDir, runDir)
      : mixManifest(cond, clips, mixDir, runDir);
    if (manifest.length) {
      const file = path.join(mixDir, 'manifest.json');
      fs.writeFileSync(file, JSON.stringify(manifest));
      await runSuite(file, runDir, jobs);
    }
    fs.rmSync(mixDir, {recursive: true, force: true});
    console.log(`${cond} done`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  await main();
}
