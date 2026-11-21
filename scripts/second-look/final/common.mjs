/* eslint-env node, es2020 */
// What the final read's scripts share: resuming a stream, the machine's limits, the take's
// summary line, and the places a recorded take knew at each chunk.
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import {FINAL} from './suites.mjs';

/** The clips a stream file already holds, and where its finished lines end. */
export function resumeAt(file) {
  const done = new Set();
  let offset = 0;
  const sidecar = `${file}.done`;
  if (fs.existsSync(sidecar)) {
    for (const line of fs.readFileSync(sidecar, 'utf8').split('\n')) {
      const [id, end] = line.split('\t');
      if (!end) continue;
      done.add(id);
      offset = Number(end);
    }
  }
  return {done, offset};
}

/** Swap under 20 GB and at least 10 GB of disk free. */
export function limitsOk() {
  const used = Number(
    /used = ([0-9.]+)M/.exec(
      execSync('sysctl -n vm.swapusage').toString(),
    )?.[1] ?? 1e9,
  );
  const free = Number(
    execSync(`df -g ${FINAL} | tail -1`).toString().trim().split(/\s+/)[3],
  );
  return used < 20000 && free >= 10;
}

/** The numbers of the take's last trace line about its checks. */
export function checksOf(lines) {
  const sum = lines.find(l => l.startsWith('checks this take:'));
  const out = {};
  if (!sum) return out;
  for (const [key, re] of [
    ['wakes', /(\d+) wakes/],
    ['step2', /\((\d+) step 2 only\)/],
    ['first', /(\d+) first passes/],
    ['padded', /(\d+) padded looks/],
    ['runs', /(\d+) model runs/],
    ['shown', /(\d+) shown/],
    ['cancelled', /(\d+) cancelled/],
    ['failed', /(\d+) failed open/],
    ['timeouts', /(\d+) timeouts/],
    ['dropped', /(\d+) dropped/],
    ['droppedStep2', /dropped \((\d+) step 2\)/],
    ['queueMax', /queue max (\d+)/],
  ]) {
    out[key] = Number(re.exec(sum)?.[1] ?? 0);
  }
  return out;
}

/**
 * What the follower knew at each chunk: a word's frames as logged up to the chunk the app
 * has heard, and when the cursor first entered an ayah.
 * @param {Record<string, [number, number|null, number|null][]>} frames
 * @param {[number, object][]} msgs
 * @param {number[]} times - Seconds at the end of each chunk
 * @param {() => number} heardChunk - The last chunk delivered, or -1
 */
export function placesOfStream(frames, msgs, times, heardChunk) {
  const entered = new Map();
  for (const [k, m] of msgs) {
    if (m.type !== 'word_progress') continue;
    const key = `${m.surah}:${m.ayah}`;
    if (!entered.has(key)) entered.set(key, k);
  }
  return {
    wordFrames({surah, ayah, word}) {
      const list = frames[`${surah}:${ayah}:${word}`];
      if (!list) return null;
      const upTo = heardChunk();
      let found = null;
      for (const e of list) {
        if (e[0] > upTo) break;
        found = e;
      }
      return found && found[1] !== null ? {from: found[1], to: found[2]} : null;
    },
    ayahEnteredAt(surah, ayah) {
      const k = entered.get(`${surah}:${ayah}`);
      return k !== undefined && k <= heardChunk() ? times[k] : null;
    },
  };
}
