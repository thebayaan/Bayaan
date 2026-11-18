/* eslint-env node, es2020 */
// Puts the tables score.mjs wrote into ../SCOREBOARD.md, between their markers, so no number
// is copied by hand:
//   <!-- table:pool -->
//   <!-- end -->
// A key with no table yet is left as it is.
//   node scripts/second-look/final/write_board.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {FINAL} from './suites.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BOARD = path.join(HERE, '../SCOREBOARD.md');
const T = {};
for (const f of ['tables.json', 'heldout.json']) {
  const file = path.join(FINAL, f);
  if (fs.existsSync(file)) Object.assign(T, JSON.parse(fs.readFileSync(file)));
}
const render = t =>
  [
    ...(t.note ? [t.note, ''] : []),
    `| ${t.headers.join(' | ')} |`,
    `|${t.headers.map(() => '---').join('|')}|`,
    ...t.rows.map(r => `| ${r.join(' | ')} |`),
  ].join('\n');
let text = fs.readFileSync(BOARD, 'utf8');
let filled = 0;
const left = [];
text = text.replace(
  /<!-- table:(\w+) -->[\s\S]*?<!-- end -->/g,
  (whole, key) => {
    if (!T[key]) {
      left.push(key);
      return whole;
    }
    filled += 1;
    return `<!-- table:${key} -->\n${render(T[key])}\n<!-- end -->`;
  },
);
fs.writeFileSync(BOARD, text);
console.log(JSON.stringify({filled, left}));
