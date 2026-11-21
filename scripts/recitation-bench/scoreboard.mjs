/* eslint-env node, es2020 */
// One line per test set for the current mark rules (or WORD_MARKS=<file>):
// planted mistakes caught and false marks that stay red, on every set that
// exists under .out/.
//
//   node scripts/recitation-bench/scoreboard.mjs [corpus suffix]
//
// The suffix picks engine variants, e.g. `fix_all` reads .out/corpus/fix_all
// and .out/corpus/fix_all_noise_babble5 when they exist.
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, '.out');
const {replayRun, scoreRun} = await import(path.join(HERE, 'replay2.mjs'));

function score(dir) {
  let runs = 0;
  let minutes = 0;
  let caught = 0;
  let total = 0;
  let falseRed = 0;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json') || f.endsWith('.truth.json') || f.startsWith('qdc')) {
      continue;
    }
    const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!run.vchanges) continue;
    const truth = path.join(dir, f.replace(/\.json$/, '.truth.json'));
    const events = fs.existsSync(truth)
      ? JSON.parse(fs.readFileSync(truth, 'utf8')).events
      : [];
    const r = scoreRun(run, events);
    runs += 1;
    minutes += (run.summary?.seconds ?? run.log.at(-1)?.t ?? 0) / 60;
    caught += r.caught.length;
    total += r.caught.length + r.missed.length;
    falseRed += r.falseMarks.filter(m => !m.corrected).length;
  }
  return {runs, minutes, caught, total, falseRed};
}

const suffix = process.argv[2] ?? null;
const sets = suffix
  ? [
      [`planted (${suffix})`, `corpus/${suffix}`],
      ...['babble10', 'babble5', 'pink10', 'hum10'].map(n => [
        `noise ${n} (${suffix})`,
        `corpus/${suffix}_noise_${n}`,
      ]),
    ]
  : [
      ['planted, 9 reciters x 5 surahs', 'corpus/main'],
      ['  same 36 recitations, no noise', 'corpus/sub_clean'],
      ['  with chatter at 10 dB', 'corpus/noise_babble10'],
      ['  with chatter at 5 dB', 'corpus/noise_babble5'],
      ['  with fan-like noise 10 dB', 'corpus/noise_pink10'],
      ['  with hum 10 dB', 'corpus/noise_hum10'],
      ['clean, started mid-surah', 'midstart'],
      ['clean, 2:6-2:9 starts and held madd', 'baq7'],
      ['clean, whole Quran reciter 6', 'quran/6'],
      ['clean, whole Quran reciter 9', 'quran/9'],
    ];
for (const [name, rel] of sets) {
  const dir = path.join(OUT, rel);
  if (!fs.existsSync(dir)) continue;
  const s = score(dir);
  if (!s.runs) continue;
  const caught = s.total ? `caught ${s.caught}/${s.total}` : 'no planted mistakes';
  console.log(
    `${name.padEnd(38)} ${String(s.runs).padStart(4)} runs ${String(Math.round(s.minutes)).padStart(5)} min | ${caught.padEnd(20)} | false red ${String(s.falseRed).padStart(4)} (${(s.falseRed / Math.max(1, s.minutes)).toFixed(2)}/min)`,
  );
}
