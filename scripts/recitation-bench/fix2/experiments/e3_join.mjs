/* eslint-env node, es2020 */
// E3: how should the window for the next ayah start when the reader goes straight on?
// For each pair of consecutive ayat that the checker reads cleanly whole, a window of up
// to 8 s starts (gapcut) 0.08 s before the next ayah's first letter, (pausecut) at the
// start of the quiet before it when there is 0.16 s or more, (tail1) at the previous
// ayah's last word or (tail2) at its last two words. The next ayah's first five words are
// scored by their greedy letters, bucketed by the quiet between the two ayat.
//
//   node fix2/experiments/e3_join.mjs <name> [...]
//
// <name> is a staged file under .out/fix2/qdc (e.g. 7_67). One line per scored word in
// .out/fix2/e3/<name>.jsonl; read them with e3_an.py.
import fs from 'node:fs';
import path from 'node:path';
import {loadModel} from '../model.mjs';
import {OUT, FRAME, alignFree, editDistance, greedySpan} from '../common.mjs';
import {W, cleanAyah, openStream, quietBefore} from './stream.mjs';

const names = process.argv.slice(2);
if (!names.length) {
  console.error('usage: node fix2/experiments/e3_join.mjs <name> [...]');
  process.exit(2);
}
const model = await loadModel();
fs.mkdirSync(path.join(OUT, 'e3'), {recursive: true});
for (const name of names) {
  const stream = await openStream(name, model);
  if (!stream) {
    continue;
  }
  const {said, groups, read} = stream;
  const out = fs.openSync(path.join(OUT, 'e3', `${name}.jsonl`), 'w');
  const write = row => fs.writeSync(out, JSON.stringify(row) + '\n');
  // Clean reads of whole ayat, one entry per group.
  const ref = [];
  for (const g of groups) {
    let r = null;
    if (!g.some(i => said[i].repeat) && g.length >= 3) {
      r = await cleanAyah(stream, g);
    }
    ref.push(r && r.clean ? r : null);
  }
  let n = 0;
  for (let gi = 0; gi + 1 < groups.length; gi++) {
    const A = ref[gi];
    const B = ref[gi + 1];
    if (!A || !B || A.ws.length < 3 || B.ws.length < 4) {
      continue;
    }
    n++;
    const q = quietBefore(stream, B.startMel[0], A.startMel[A.ws.length - 1]);
    const gap = q / 100;
    const test = async (kind, fromMel, lead) => {
      const X = await read(fromMel, Math.min(B.endMel, fromMel + W * 100));
      if (!X) {
        return;
      }
      const text = [...A.ws.slice(A.ws.length - lead), ...B.ws];
      const al = alignFree(X.rel, X.frames, text, {
        startFree: true,
        endFree: true,
      });
      for (let j = 0; j < Math.min(5, B.ws.length); j++) {
        const a = al[lead + j];
        const len = B.ws[j].length;
        if (a.start < 0) {
          write({kind, gap, pos: j, ed: len, n: len, none: 1});
          continue;
        }
        if ((X.frames - a.start) * FRAME < 2.5) {
          break;
        }
        const ed = editDistance(greedySpan(X.am, a.start, a.end), B.ws[j]);
        write({kind, gap, pos: j, ed, n: len, sc: +a.score.toFixed(2)});
      }
    };
    await test('gapcut', B.startMel[0] - 8, 0);
    if (q >= 16) {
      await test('pausecut', B.startMel[0] - Math.min(q, 40), 0);
    }
    await test('tail1', A.startMel[A.ws.length - 1] - 8, 1);
    await test('tail2', A.startMel[A.ws.length - 2] - 8, 2);
  }
  fs.closeSync(out);
  console.log(name, JSON.stringify({ayat: groups.length, joins: n}));
}
