/* eslint-env node, es2020 */
// Scores clip_sim.mjs output into REPORT.md and report.json (numbers and surah:ayah:word
// only): twin events by kind of pair, place and voice group, twin controls, clips that
// may open with the basmala apart, the Al-Ikhlas dev half, and the strongest score tests
// on controls that did not end in a mark.
//
//   node fix2/clips/score_clips.mjs [--dir <dir>] [--sha <prefix>] [--subs 60]
//
// Reads twin.*.jsonl and ikhlas.*.jsonl in <dir> (default .out/fix2/clips) and writes the
// two reports there. When the files hold runs of more than one live check, --sha picks
// one. --subs must match the clip_sim.mjs run.
import fs from 'node:fs';
import path from 'node:path';
import {CLIPS, chosenPairs} from './clip_sim.mjs';
import {ayahWords, parseArgs, rng} from '../common.mjs';

const args = parseArgs();
const SUBS = Number(args.subs ?? 60);
const DIR = args.dir ?? CLIPS;

const readJsonl = f =>
  fs.existsSync(f)
    ? fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(l => JSON.parse(l))
    : [];
const files = fs.readdirSync(DIR);
const pick = prefix =>
  files
    .filter(f => f.startsWith(prefix) && f.endsWith('.jsonl'))
    .map(f => path.join(DIR, f));
const ofSha = r => !args.sha || r.sha.startsWith(args.sha);
const twin = pick('twin.').flatMap(readJsonl).filter(ofSha);
const ikhlas = pick('ikhlas.').flatMap(readJsonl).filter(ofSha);
const shas = [...new Set([...twin, ...ikhlas].map(r => r.sha))];
if (shas.length > 1) {
  console.error(
    `runs of ${shas.length} live checks in ${DIR}: pick one with --sha (${shas
      .map(s => s.slice(0, 8))
      .join(', ')})`,
  );
  process.exit(2);
}

const n0 = (k, n) =>
  n === 0
    ? 'n/a (0 runs)'
    : k === 0
      ? `0 of ${n} (95% upper bound ${(3 / n).toFixed(4)})`
      : `${k} of ${n} (${((k / n) * 100).toFixed(1)}%)`;
const per1k = (k, n) =>
  n === 0
    ? 'n/a'
    : k === 0
      ? `0 per 1,000 (0 of ${n}; 95% upper bound ${(3000 / n).toFixed(
          2,
        )} per 1,000)`
      : `${((1000 * k) / n).toFixed(2)} per 1,000 (${k} of ${n})`;
const quant = (xs, q) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return +s[
    Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))
  ].toFixed(2);
};
const idx = w => Number(w.split(':')[2]);
const ayahOf = w => w.split(':').slice(0, 2).join(':');
const bad = f => f.verdict !== 'fine';
const withoutLine = c => {
  const r = {...c};
  delete r.line;
  return r;
};

/** Per run: judged words of the text ayah, bad words (any ayah), first/last covered. */
function summarize(r) {
  const words = ayahWords(r.x).length;
  const judged = new Set(
    r.finals.filter(f => ayahOf(f.word) === r.x).map(f => idx(f.word)),
  );
  const badList = r.finals.filter(bad);
  return {
    words,
    judged: judged.size,
    first: judged.has(0),
    last: judged.has(words - 1),
    badList,
  };
}

const report = {sha: shas, made: new Date().toISOString(), subsChosen: SUBS};
const md = [];
md.push('# Live check on single-ayah clips (no follower)', '');
md.push(
  `Live check sha256 (reading, laying, check): ${shas.join(', ')}. Runs: twin ${
    twin.length
  }, ikhlas dev ${ikhlas.length}. Defaults only (no thresholds tuned).`,
  '',
);
md.push(
  `Twin voices run: ${[...new Set(twin.map(r => r.voice))].join(
    ', ',
  )}. Pairs: every spelling and indel pair, and ${SUBS} of 119 sub pairs chosen by seeded hash (chosenPairs in clip_sim.mjs, seed clips-2026-11-14). Clips with mayStartWithBasmala are kept out of the main tables.`,
  '',
);

// ---------- Twin events ----------
const pairs = chosenPairs(SUBS);
const runById = new Map(twin.map(r => [`${r.voice}|${r.y}|${r.x}`, r]));
const voices = [...new Set(twin.map(r => r.voice))];
const groupOf = new Map(twin.map(r => [r.voice, r.group]));
const events = []; // one per (pair, voice, direction)
for (const p of pairs)
  for (const v of voices)
    for (const dir of ['y_on_x', 'x_on_y']) {
      const rec = dir === 'y_on_x' ? p.y : p.x,
        text = dir === 'y_on_x' ? p.x : p.y;
      const r = runById.get(`${v}|${rec}|${text}`);
      if (!r) continue;
      const d = text === p.x ? p.wordX : p.wordY;
      events.push({p, v, dir, r, d, group: groupOf.get(v), basmala: r.basmala});
    }
const mainEv = events.filter(e => !e.basmala),
  basEv = events.filter(e => e.basmala);

function subTable(evs, label) {
  const rows = [];
  const res = {};
  const cats = [
    ['all', () => true],
    ['first', e => e.p.place === 'first'],
    ['interior', e => e.p.place === 'interior'],
    ['last', e => e.p.place === 'last'],
    ...['dev', 'checker_heldout', 'heldout'].map(g => [g, e => e.group === g]),
  ];
  const lat = [],
    latNear = [];
  let falseElse = 0,
    wordsElse = 0;
  const falseList = [];
  for (const e of evs) {
    const inAyah = e.r.finals.filter(f => ayahOf(f.word) === e.r.x);
    const exact = inAyah.filter(f => bad(f) && idx(f.word) === e.d);
    const near = inAyah.filter(f => bad(f) && Math.abs(idx(f.word) - e.d) <= 1);
    e.exact = exact.length > 0;
    e.near = near.length > 0;
    if (exact.length) lat.push(Math.min(...exact.map(f => f.t - f.to)));
    if (near.length) latNear.push(Math.min(...near.map(f => f.t - f.to)));
    const words = ayahWords(e.r.x).length;
    wordsElse +=
      words - [e.d - 1, e.d, e.d + 1].filter(i => i >= 0 && i < words).length;
    const els = e.r.finals.filter(
      f =>
        bad(f) &&
        !(ayahOf(f.word) === e.r.x && Math.abs(idx(f.word) - e.d) <= 1),
    );
    const elsWords = new Set(els.map(f => f.word));
    falseElse += elsWords.size;
    for (const f of els)
      falseList.push({
        clip: e.r.clip,
        text: e.r.x,
        word: f.word,
        verdict: f.verdict,
        share: f.share,
        gap: f.gap,
      });
  }
  rows.push(
    `| ${label} | runs | caught exactly | caught near (word or neighbour) |`,
    '|---|---|---|---|',
  );
  for (const [name, fn] of cats) {
    const s = evs.filter(fn);
    const k = s.filter(e => e.exact).length,
      kn = s.filter(e => e.near).length;
    res[name] = {runs: s.length, exact: k, near: kn};
    rows.push(
      `| ${name} | ${s.length} | ${n0(k, s.length)} | ${n0(kn, s.length)} |`,
    );
  }
  res.latency = {
    exactN: lat.length,
    median: quant(lat, 0.5),
    p90: quant(lat, 0.9),
    nearN: latNear.length,
    nearMedian: quant(latNear, 0.5),
    nearP90: quant(latNear, 0.9),
  };
  res.falseElsewhere = {words: falseElse, of: wordsElse, list: falseList};
  rows.push(
    '',
    `Time from the word's own 'to' to the tick that first showed the final bad opinion (exact catches, n=${lat.length}): median ${res.latency.median} s, 90th pct ${res.latency.p90} s. Near catches (n=${latNear.length}): median ${res.latency.nearMedian} s, 90th pct ${res.latency.nearP90} s.`,
  );
  rows.push(
    '',
    `False bad opinions elsewhere in these event runs (not on the differing word or its neighbours, any ayah): ${per1k(
      falseElse,
      wordsElse,
    )} words of text outside the differing word and its neighbours.`,
  );
  return {rows, res};
}

md.push('## Twin events: substitution pairs (type sub)', '');
const subMain = subTable(
  mainEv.filter(e => e.p.type === 'sub'),
  'sub',
);
md.push(...subMain.rows, '');
report.sub = subMain.res;
if (subMain.res.falseElsewhere.list.length) {
  md.push(
    'False bad opinions elsewhere (clip, text ayah, word, verdict, share, gap):',
    '',
  );
  for (const f of subMain.res.falseElsewhere.list)
    md.push(
      `- ${f.clip} vs ${f.text}: ${f.word} ${f.verdict} share ${f.share} gap ${f.gap}`,
    );
  md.push('');
}
// By direction and by voice.
md.push('Sub catches by voice (exact / near):', '');
for (const v of voices) {
  const s = mainEv.filter(e => e.p.type === 'sub' && e.v === v);
  md.push(
    `- ${v} (${groupOf.get(v)}): exact ${n0(
      s.filter(e => e.exact).length,
      s.length,
    )}, near ${n0(s.filter(e => e.near).length, s.length)}`,
  );
}
md.push('');
report.subByVoice = Object.fromEntries(
  voices.map(v => {
    const s = mainEv.filter(e => e.p.type === 'sub' && e.v === v);
    return [
      v,
      {
        runs: s.length,
        exact: s.filter(e => e.exact).length,
        near: s.filter(e => e.near).length,
      },
    ];
  }),
);

// Spelling pairs.
md.push('## Twin events: spelling-only pairs (every bad opinion is false)', '');
const sameLetters = p => ayahWords(p.x)[p.wordX] === ayahWords(p.y)[p.wordY];
const spel = mainEv.filter(e => e.p.type === 'spelling');
const spelRes = {};
for (const [name, fn] of [
  ['letters identical', e => sameLetters(e.p)],
  ['letters differ by one (said the same)', e => !sameLetters(e.p)],
]) {
  const s = spel.filter(fn);
  const badW = s.reduce(
    (a, e) => a + new Set(e.r.finals.filter(bad).map(f => f.word)).size,
    0,
  );
  const onD = s.filter(e =>
    e.r.finals.some(
      f => bad(f) && ayahOf(f.word) === e.r.x && idx(f.word) === e.d,
    ),
  ).length;
  const words = s.reduce((a, e) => a + ayahWords(e.r.x).length, 0);
  spelRes[name] = {
    runs: s.length,
    badWords: badW,
    words,
    runsBadOnWord: onD,
    pairs: [...new Set(s.map(e => e.p.id.replace(/^[^~]*~/, '')))],
  };
  md.push(
    `- ${name} (pairs ${spelRes[name].pairs.join(', ')}): ${
      s.length
    } runs, bad words ${per1k(
      badW,
      words,
    )} words of text; runs with a bad opinion on the spelling word: ${n0(
      onD,
      s.length,
    )}`,
  );
}
md.push('');
report.spelling = spelRes;

// Indel pairs.
md.push('## Twin events: indel pairs (x is the longer ayah)', '');
report.indel = {};
for (const short of [false, true]) {
  const name = short ? 'short_indel' : 'indel';
  const ps = pairs.filter(p => p.type === 'indel' && !!p.short === short);
  md.push(
    `### ${name}: ${ps.length} pairs (${ps
      .map(p => p.id.replace(/^[^~]*~/, ''))
      .join(', ')})`,
    '',
  );
  const s = mainEv.filter(e => e.p.type === 'indel' && !!e.p.short === short);
  const missing = s.filter(e => e.dir === 'y_on_x'); // short recording, long text: expect missed on wordX
  const extra = s.filter(e => e.dir === 'x_on_y'); // long recording, short text: extra word said at wordY
  const ex = missing.filter(e =>
    e.r.finals.some(
      f => bad(f) && ayahOf(f.word) === e.r.x && idx(f.word) === e.p.wordX,
    ),
  ).length;
  const exMissed = missing.filter(e =>
    e.r.finals.some(
      f =>
        f.verdict === 'missed' &&
        ayahOf(f.word) === e.r.x &&
        idx(f.word) === e.p.wordX,
    ),
  ).length;
  const nr = missing.filter(e =>
    e.r.finals.some(
      f =>
        bad(f) &&
        ayahOf(f.word) === e.r.x &&
        Math.abs(idx(f.word) - e.p.wordX) <= 1,
    ),
  ).length;
  let nb = 0,
    nbWords = 0,
    elseBad = 0,
    elseWords = 0;
  for (const e of extra) {
    const w = ayahWords(e.r.x).length;
    const nbrs = [e.p.wordY - 1, e.p.wordY].filter(i => i >= 0 && i < w);
    nbWords += nbrs.length;
    elseWords += w - nbrs.length;
    const b = new Set(e.r.finals.filter(f => bad(f)).map(f => f.word));
    for (const k of b)
      if (ayahOf(k) === e.r.x && nbrs.includes(idx(k))) nb++;
      else elseBad++;
  }
  md.push(
    `- word not said (short recording, long text): bad on the word ${n0(
      ex,
      missing.length,
    )}; of those 'missed' ${exMissed}; word or neighbour ${n0(
      nr,
      missing.length,
    )}`,
  );
  md.push(
    `- extra word said (long recording, short text): bad opinions on the neighbours ${per1k(
      nb,
      nbWords,
    )} neighbour words; elsewhere ${per1k(elseBad, elseWords)} words`,
    '',
  );
  report.indel[name] = {
    pairs: ps.length,
    missingRuns: missing.length,
    caught: ex,
    caughtMissed: exMissed,
    near: nr,
    extraRuns: extra.length,
    neighbourBad: nb,
    neighbourWords: nbWords,
    elseBad,
    elseWords,
  };
}

// ---------- Twin controls ----------
function controlRates(runs, label) {
  let judged = 0,
    words = 0,
    badW = 0,
    first = 0,
    last = 0;
  const list = [];
  for (const r of runs) {
    const s = summarize(r);
    judged += s.judged;
    words += s.words;
    first += s.first;
    last += s.last;
    const bw = new Map();
    for (const f of s.badList) if (!bw.has(f.word)) bw.set(f.word, f);
    badW += bw.size;
    for (const f of bw.values())
      list.push({
        clip: r.clip,
        text: r.x,
        word: f.word,
        verdict: f.verdict,
        share: f.share,
        gap: f.gap,
      });
  }
  return {
    label,
    runs: runs.length,
    words,
    judged,
    bad: badW,
    first,
    last,
    list,
    line: `| ${label} | ${runs.length} | ${per1k(badW, judged)} | ${per1k(
      badW,
      words,
    )} | ${n0(judged, words)} | ${n0(first, runs.length)} | ${n0(
      last,
      runs.length,
    )} |`,
  };
}
md.push('## Twin controls (each recording against its own text)', '');
const ctl = twin.filter(r => r.kind === 'control');
const ctlMain = ctl.filter(r => !r.basmala);
md.push(
  '| group | runs | false bad per 1,000 words judged | per 1,000 words of text | coverage (words judged) | first word judged | last word judged |',
  '|---|---|---|---|---|---|---|',
);
report.controls = {};
for (const [g, fn] of [
  ['all', () => true],
  ['dev', r => r.group === 'dev'],
  ['checker_heldout', r => r.group === 'checker_heldout'],
  ['heldout', r => r.group === 'heldout'],
]) {
  const c = controlRates(ctlMain.filter(fn), g);
  md.push(c.line);
  const rest = withoutLine(c);
  report.controls[g] = rest;
}
md.push('');
const warnRuns = ctlMain.filter(r => r.warning);
if (warnRuns.length)
  md.push(
    `(${
      warnRuns.length
    } control runs are ZH clips flagged with a word-count warning; they are included above. Bad words in them: ${
      controlRates(warnRuns, 'w').bad
    }.)`,
    '',
  );
md.push(
  'False bad opinions in controls (clip, word, verdict, share, gap):',
  '',
);
for (const f of report.controls.all.list)
  md.push(`- ${f.clip}: ${f.word} ${f.verdict} share ${f.share} gap ${f.gap}`);
if (!report.controls.all.list.length) md.push('- none');
md.push('');

// ---------- Basmala table ----------
md.push(
  '## Clips that may start with the basmala (ayah 1 of a surah), apart',
  '',
);
const basCtl = controlRates(
  ctl.filter(r => r.basmala),
  'controls',
);
md.push(
  '| set | runs | false bad per 1,000 judged | per 1,000 text | coverage | first | last |',
  '|---|---|---|---|---|---|---|',
  basCtl.line,
  '',
);
const basSub = basEv.filter(e => e.p.type !== 'indel');
const basInd = basEv.filter(e => e.p.type === 'indel');
const exactOf = e =>
  e.r.finals.some(
    f => bad(f) && ayahOf(f.word) === e.r.x && idx(f.word) === e.d,
  );
md.push(
  `Event runs whose recording is such a clip: sub/spelling ${
    basSub.length
  } (bad on the differing word ${basSub.filter(exactOf).length}); indel ${
    basInd.length
  } (bad on the stated word ${basInd.filter(exactOf).length}).`,
  '',
);
report.basmala = {
  controls: withoutLine(basCtl),
  subRuns: basSub.length,
  subExact: basSub.filter(exactOf).length,
  indelRuns: basInd.length,
  indelExact: basInd.filter(exactOf).length,
};

// ---------- Al-Ikhlas dev ----------
md.push(
  '## Al-Ikhlas, dev half only (the test half was not run or opened)',
  '',
);
const ikC = ikhlas.filter(r => r.kind === 'correct'),
  ikF = ikhlas.filter(r => r.kind === 'incorrect');
const spk = rs => new Set(rs.map(r => r.voice)).size;
md.push(
  '| label | speakers | runs | false bad per 1,000 words judged | per 1,000 words of text | coverage | first | last |',
  '|---|---|---|---|---|---|---|---|',
);
const ikCR = controlRates(ikC, 'correct'),
  ikFR = controlRates(ikF, 'incorrect');
md.push(
  ikCR.line.replace('| correct |', `| correct | ${spk(ikC)} |`),
  ikFR.line.replace('| incorrect |', `| incorrect | ${spk(ikF)} |`),
  '',
);
// Speaker-clustered bootstrap.
function boot(runs, seed = 1) {
  const bySpk = new Map();
  for (const r of runs) {
    const s = summarize(r);
    const b = new Set(s.badList.map(f => f.word)).size;
    const a = bySpk.get(r.voice) ?? {bad: 0, words: 0, judged: 0};
    a.bad += b;
    a.words += s.words;
    a.judged += s.judged;
    bySpk.set(r.voice, a);
  }
  const list = [...bySpk.values()];
  const rand = rng(seed);
  const rt = [],
    rj = [];
  for (let i = 0; i < 1000; i++) {
    let b = 0,
      w = 0,
      j = 0;
    for (let k = 0; k < list.length; k++) {
      const x = list[Math.floor(rand() * list.length)];
      b += x.bad;
      w += x.words;
      j += x.judged;
    }
    rt.push((1000 * b) / Math.max(1, w));
    rj.push((1000 * b) / Math.max(1, j));
  }
  return {
    speakers: list.length,
    perText: [quant(rt, 0.025), quant(rt, 0.975)],
    perJudged: [quant(rj, 0.025), quant(rj, 0.975)],
  };
}
const bC = boot(ikC),
  bF = boot(ikF);
md.push(
  `Speaker-clustered bootstrap (1,000 resamples of speakers, seed 1), 95% interval: correct clips ${bC.perText[0]} to ${bC.perText[1]} per 1,000 words of text, ${bC.perJudged[0]} to ${bC.perJudged[1]} per 1,000 judged (${bC.speakers} speakers); incorrect clips ${bF.perText[0]} to ${bF.perText[1]} per 1,000 words of text (${bF.speakers} speakers).`,
  '',
);
// Incorrect clips: do bad opinions fall on the labelled error words?
let onErr = 0,
  offErr = 0;
for (const r of ikF)
  for (const w of new Set(r.finals.filter(bad).map(f => f.word)))
    (r.errorWords ?? []).includes(idx(w) + 1) ? onErr++ : offErr++;
md.push(
  `Incorrect clips (labelled tajweed/vowel errors, which a letters-only model is not expected to mark): bad words on a labelled error word ${onErr}, elsewhere ${offErr}.`,
  '',
);
md.push(
  'Bad opinions on Al-Ikhlas dev (clip, label, word, verdict, share, gap):',
  '',
);
for (const [lab, rs] of [
  ['correct', ikCR.list],
  ['incorrect', ikFR.list],
])
  for (const f of rs)
    md.push(
      `- ${f.clip} (${lab}): ${f.word} ${f.verdict} share ${f.share} gap ${f.gap}`,
    );
md.push('');
report.ikhlas = {
  correct: withoutLine(ikCR),
  incorrect: withoutLine(ikFR),
  speakersCorrect: spk(ikC),
  speakersIncorrect: spk(ikF),
  bootCorrect: bC,
  bootIncorrect: bF,
  incorrectOnErrorWord: onErr,
  incorrectElsewhere: offErr,
};

// ---------- Strongest probes on controls ----------
md.push(
  '## The 30 strongest probe lines on control runs (words NOT finally marked)',
  '',
);
const probeRows = [];
for (const r of [...ctl, ...ikC]) {
  const marked = new Set(
    r.finals.filter(bad).map(f => `${f.word}#${f.reading}`),
  );
  const best = new Map();
  for (const p of r.probes) {
    const id = `${p.key}#${p.reading}`;
    if (marked.has(id)) continue;
    if (!best.has(id) || p.gap > best.get(id).gap) best.set(id, p);
  }
  for (const p of best.values())
    probeRows.push({clip: r.clip, set: r.set, ...p});
}
probeRows.sort((a, b) => b.gap - a.gap);
const top = probeRows.slice(0, 30);
md.push(
  `Probe lines on control runs, unmarked words: ${probeRows.length} (word, reading) with at least one probe; strongest 30 by gap:`,
  '',
);
md.push(
  '| clip | word | kind | letters | share | gap | after s | over | anchored | outcome | closing | final |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|',
);
for (const p of top)
  md.push(
    `| ${p.clip} | ${p.key} | ${p.kind} | ${p.letters} | ${(+p.share).toFixed(
      3,
    )} | ${(+p.gap).toFixed(2)} | ${(+p.after).toFixed(2)} | ${p.over} | ${
      p.anchored
    } | ${p.outcome} | ${p.closing} | ${p.final} |`,
  );
md.push('');
report.topProbes = top;

fs.writeFileSync(
  path.join(DIR, 'report.json'),
  JSON.stringify(report, null, 1),
);
fs.writeFileSync(path.join(DIR, 'REPORT.md'), md.join('\n'));
console.log(md.join('\n'));
