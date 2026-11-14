/* eslint-env node, es2020 */
// E2: where may a window start? For each ayah of 6 or more words that the checker reads
// cleanly whole, windows of up to 8 s start (ayah) at the ayah's start, (pause) inside a
// natural pause of 0.2 s or more before an interior word, or (word) just before an
// interior word with no pause before it. Each of the first six words that has at least
// 2.5 s of window after its start is scored by its greedy letters.
//
//   node fix2/experiments/e2_pause.mjs <name> [...]
//
// <name> is a staged file under .out/fix2/qdc (e.g. 7_67). One line per scored word in
// .out/fix2/e2/<name>.jsonl; read them with e2_an.py.
import fs from 'node:fs';
import path from 'node:path';
import {loadModel} from '../model.mjs';
import {OUT, FRAME, alignFree, editDistance, greedySpan} from '../common.mjs';
import {W, cleanAyah, openStream, quietBefore} from './stream.mjs';

const names = process.argv.slice(2);
if (!names.length) {
  console.error('usage: node fix2/experiments/e2_pause.mjs <name> [...]');
  process.exit(2);
}
const model = await loadModel();
fs.mkdirSync(path.join(OUT, 'e2'), {recursive: true});
for (const name of names) {
  const stream = await openStream(name, model);
  if (!stream) {
    continue;
  }
  const {said, groups, read} = stream;
  const out = fs.openSync(path.join(OUT, 'e2', `${name}.jsonl`), 'w');
  let nRef = 0;
  let nClean = 0;
  for (const g of groups) {
    if (g.some(i => said[i].repeat) || g.length < 6) {
      continue;
    }
    const ref = await cleanAyah(stream, g);
    if (!ref) {
      continue;
    }
    nRef++;
    if (!ref.clean) {
      continue;
    }
    nClean++;
    const {ws, startMel, endMel} = ref;
    const test = async (kind, k, fromMel) => {
      const X = await read(fromMel, Math.min(endMel, fromMel + W * 100));
      if (!X) {
        return;
      }
      const sub = ws.slice(k);
      const al = alignFree(X.rel, X.frames, sub, {
        startFree: false,
        endFree: true,
      });
      for (let j = 0; j < Math.min(6, sub.length); j++) {
        const a = al[j];
        // Only words wholly inside the window with at least 2.5 s after their start.
        if (a.start < 0 || (X.frames - a.start) * FRAME < 2.5) {
          break;
        }
        const w = said[g[k + j]];
        const ed = editDistance(greedySpan(X.am, a.start, a.end), sub[j]);
        const row = {
          kind,
          key: `${w.surah}:${w.ayah}:${w.word}`,
          pos: j,
          ed,
          n: sub[j].length,
          sc: +a.score.toFixed(2),
        };
        fs.writeSync(out, JSON.stringify(row) + '\n');
      }
    };
    for (let k = 2; k < g.length - 2; k++) {
      const q = quietBefore(stream, startMel[k], startMel[k - 1]);
      if (q >= 20) {
        await test('pause', k, startMel[k] - Math.min(q, 30));
      } else if (q <= 4 && k % 2 === 0) {
        await test('word', k, startMel[k] - 8);
      }
    }
    await test('ayah', 0, (ref.a0 - 0.25) * 100);
  }
  fs.closeSync(out);
  console.log(
    name,
    JSON.stringify({ayat: groups.length, read: nRef, clean: nClean}),
  );
}
