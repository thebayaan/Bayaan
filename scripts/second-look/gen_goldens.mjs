/* eslint-env node, es2020 */
// Cuts the goldens the second look's port must reproduce, by running the plain
// JavaScript originals in scripts/recitation-bench/judge once on fixed inputs.
//
//   node scripts/second-look/gen_goldens.mjs          rewrites the fixtures
//   node scripts/second-look/gen_goldens.mjs --check  says whether they still hold
//
// fixtures/originals.json names the versions of the originals they came from.
//
// The port now follows the originals in full, firstWithin and the nothing score
// included: the frozen rule's slice stays inside the word's ayah, so both mean what
// they say there (services/recitation/secondLook/judge.ts). The originals are the
// judge's files, the letter-slip rule in rule.mjs, the answer in judge/policy.mjs and
// the slice in lib.mjs, which reads the bench's .out, so this needs that folder.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const JUDGE = path.resolve(HERE, '../recitation-bench/judge');
const FIXTURES = path.resolve(
  HERE,
  '../../services/recitation/secondLook/__tests__/fixtures',
);
const ORIGINALS = [
  '../recitation-bench/judge/fbank.mjs',
  '../recitation-bench/judge/ctc.mjs',
  '../recitation-bench/judge/judge.mjs',
  '../recitation-bench/judge/policy.mjs',
  '../recitation-bench/judge/model.mjs',
  '../recitation-bench/judge/judge_constants.json',
  '../recitation-bench/judge/engine_constants.npl.json',
  'rule.mjs',
  'cancel.mjs',
  'chain.mjs',
  'lib.mjs',
  'cancel_constants.npl.json',
];

const {fbank, numFrames, NUM_BINS} = await import(
  path.join(JUDGE, 'fbank.mjs')
);
const {relativeTo, prepare, scoreWord, scoreNothing, WORD} = await import(
  path.join(JUDGE, 'ctc.mjs')
);
const {judgeWord, tokensOf} = await import(path.join(JUDGE, 'judge.mjs'));
const {answer} = await import(path.join(JUDGE, 'policy.mjs'));
const {sliceFrames} = await import(path.join(JUDGE, 'model.mjs'));
const {firstPass, innerGap, paddedCut, cancelAnswer, CANCEL} = await import(
  path.join(HERE, 'rule.mjs')
);
const {POLICIES} = await import(path.join(HERE, 'chain.mjs'));
const {judgeSlice, wordCount} = await import(path.join(HERE, 'lib.mjs'));

// ---- The same helpers as test-utils/secondLookSignals.ts.
function testWave(n) {
  const out = new Float32Array(n);
  let seed = 12345;
  for (let i = 0; i < n; i++) {
    seed = (Math.imul(seed, 1103515245) + 12345) | 0;
    const noise = ((seed >>> 16) & 0x7fff) / 32768 - 0.5;
    const sway = 0.5 + 0.5 * Math.sin((2 * Math.PI * 3 * i) / 16000);
    out[i] =
      sway * 0.3 * Math.sin((2 * Math.PI * 220 * i) / 16000) +
      (1 - sway) * 0.2 * Math.sin((2 * Math.PI * 1760 * i) / 16000) +
      0.05 * noise;
  }
  return out;
}

const VOCAB = 31;
const SURE = -0.03045921;
const REST = -6.9077554;

function say(tokens, seedStart, quiet = 2) {
  const sequence = new Array(quiet).fill(0);
  for (const token of tokens) sequence.push(token, token, 0);
  for (let i = 0; i < quiet; i++) sequence.push(0);
  const logp = new Float32Array(sequence.length * VOCAB);
  let seed = seedStart;
  sequence.forEach((said, t) => {
    for (let v = 0; v < VOCAB; v++) {
      seed = (Math.imul(seed, 1103515245) + 12345) | 0;
      const noise = ((seed >>> 16) & 0x7fff) / 32768;
      logp[t * VOCAB + v] =
        v === said ? SURE - 0.25 * noise : REST + 1.5 * noise;
    }
  });
  return {logp, frames: sequence.length};
}

function join(words) {
  const out = [];
  words.forEach((word, i) => {
    if (i) out.push(WORD);
    out.push(...tokensOf(word));
  });
  return out;
}
// ----

function summary(wave) {
  const {data, frames} = fbank(wave);
  const rowsAt = [
    ...new Set([0, 1, frames >> 1, frames - 2, frames - 1]),
  ].filter(t => t >= 0 && t < frames);
  const frameMeans = [];
  for (let t = 0; t < frames; t++) {
    let sum = 0;
    for (let b = 0; b < NUM_BINS; b++) sum += data[t * NUM_BINS + b];
    frameMeans.push(+(sum / NUM_BINS).toFixed(5));
  }
  const binMeans = [];
  for (let b = 0; b < NUM_BINS; b++) {
    let sum = 0;
    for (let t = 0; t < frames; t++) sum += data[t * NUM_BINS + b];
    binMeans.push(+(sum / Math.max(1, frames)).toFixed(5));
  }
  return {
    samples: wave.length,
    frames,
    numFrames: numFrames(wave.length),
    rows: Object.fromEntries(
      rowsAt.map(t => [
        t,
        Array.from(data.subarray(t * NUM_BINS, (t + 1) * NUM_BINS)).map(
          v => +v.toFixed(5),
        ),
      ]),
    ),
    frameMeans,
    binMeans,
  };
}

const whole = testWave(88000);
const fbankGolden = {
  fiveAndAHalfSeconds: summary(whole),
  oneSecondCutAnywhere: summary(whole.slice(12345, 12345 + 16000)),
  // Shorter than the 25 ms window: the reflection and the clamp at both ends.
  shorterThanOneWindow: summary(whole.slice(0, 100)),
  // Digital silence hits the log floor.
  silence: summary(new Float32Array(1600)),
  empty: summary(new Float32Array(0)),
  // Half a second of speech with a second of digital silence each side.
  paddedCut: summary(paddedCut(whole, 1, 1.1, whole.length)),
};

const SAYING = ['قال', 'نوح', 'رب'];
// Enough before an ayah's first word to put it well past frame 50.
const BEFORE = ['من', 'قبل', 'ان', 'الله', 'قال', 'نوح', 'رب', 'انه', 'كان'];
// The frozen rule's context: two words on the left, none on the right.
const FROZEN = {leftWords: 2, rightWords: 0, top: 3};
const CASES = [
  {name: 'the word said, inside its ayah', said: SAYING, words: SAYING, j: 1},
  {
    name: 'another word said',
    said: ['قال', 'لوط', 'رب'],
    words: SAYING,
    j: 1,
    mut: ['لوط', 'هود'],
  },
  {
    name: 'another word said, with none of the alternatives',
    said: ['قال', 'لوط', 'رب'],
    words: SAYING,
    j: 1,
    mut: ['هود', 'صلح'],
  },
  {
    name: 'the first word of the ayah',
    said: ['فانك', 'لمن'],
    words: ['انك', 'لمن'],
    j: 0,
  },
  {
    name: 'the last word of the ayah',
    said: ['سلم', 'عليهما'],
    words: ['سلم', 'عليه'],
    j: 1,
  },
  {name: 'a one-word ayah', said: ['الم'], words: ['الم'], j: 0},
  {
    name: 'frames outside the text',
    said: ['من', 'قبل', 'قال', 'نوح', 'رب', 'انه', 'كان'],
    words: SAYING,
    j: 1,
  },
  {name: 'a word left out', said: ['قال', 'رب'], words: SAYING, j: 1},
  {
    name: 'a last word left out, and the ayah ends there',
    said: ['قال', 'نوح'],
    words: SAYING,
    j: 2,
  },
  {
    name: 'a doubled letter',
    said: ['ربب', 'قال'],
    words: ['ربب', 'قال'],
    j: 0,
  },
  {
    name: 'alternatives, best three',
    said: ['قال', 'لوط', 'رب'],
    words: SAYING,
    j: 1,
    mut: ['لوط', 'هود', 'صلح', 'شعيب'],
  },
  {
    name: 'a smaller top',
    said: ['قال', 'لوط', 'رب'],
    words: SAYING,
    j: 1,
    mut: ['لوط', 'هود'],
    opts: {top: 1},
  },
  {
    name: 'one word of right context',
    said: ['قال', 'لوط', 'رب'],
    words: SAYING,
    j: 1,
    mut: ['لوط'],
    opts: {rightWords: 1},
  },
  {
    name: 'wider context',
    said: ['ان', 'الله', 'قال', 'نوح', 'رب', 'انه'],
    words: ['ان', 'الله', 'قال', 'نوح', 'رب', 'انه'],
    j: 3,
    opts: {leftWords: 3, rightWords: 2},
  },
  {
    name: 'a first word said within frame 50 of a long slice',
    said: ['انك', 'لمن', ...BEFORE],
    words: ['انك', 'لمن'],
    j: 0,
  },
  {
    name: 'a first word said past frame 50 of a long slice',
    said: [...BEFORE, 'انك', 'لمن'],
    words: ['انك', 'لمن'],
    j: 0,
  },
  {
    name: 'another first word said past frame 50 of a long slice',
    said: [...BEFORE, 'لوط', 'لمن'],
    words: ['انك', 'لمن'],
    j: 0,
    mut: ['لوط'],
  },
  {
    name: 'the second word of an ayah, past frame 50, is held to nothing',
    said: [...BEFORE, 'انك', 'لمن'],
    words: ['انك', 'لمن'],
    j: 1,
  },
];

const judged = CASES.map(({mut = [], opts = {}, ...c}, i) => {
  const seed = 1000 + i;
  const {logp, frames} = say(join(c.said), seed);
  const full = {...FROZEN, ...opts};
  const verdict = judgeWord(logp, frames, c.words, c.j, {mut, near: []}, full);
  const pass = firstPass(logp, frames, c.words, c.j, {
    leftWords: full.leftWords,
    rightWords: full.rightWords,
    firstWithin: 50,
  });
  return {
    ...c,
    mut,
    opts: full,
    seed,
    frames,
    result: JSON.parse(JSON.stringify(verdict)),
    answer: answer({r: {...verdict, near: []}}, POLICIES.S1),
    pass,
  };
});

// The raw scores behind judgeWord, for one case, to full precision.
const {logp, frames} = say(join(SAYING), 77);
const rel = relativeTo(logp, frames);
const left = [...tokensOf('قال'), WORD];
const right = [WORD, ...tokensOf('رب')];
const prepared = prepare(rel, frames, left, right);
const noContext = prepare(rel, frames, [], []);
const raw = {
  seed: 77,
  frames,
  relSum: Array.from(rel).reduce((a, b) => a + b, 0),
  word: scoreWord(prepared, tokensOf('نوح')),
  other: scoreWord(prepared, tokensOf('لوط')),
  nothing: scoreNothing(prepared),
  exitL: Array.from(prepared.exitL),
  exitR: Array.from(prepared.exitR),
  exitRest: Array.from(prepared.exitRest),
  noContext: {
    word: scoreWord(noContext, tokensOf('نوح')),
    nothing: scoreNothing(noContext),
  },
};

// The judge's answer, around each of its limits.
const ANSWER_ROWS = [
  [-5, -5, [-1]],
  [-4.001, -5, [-1]],
  [-4, -5, [-1]],
  [-4, -5, [-1.001]],
  [-6, -5, [-3.5]],
  [-1.9, -5, [1.2]],
  [-11, -1, []],
  [-11, -1.001, []],
  [-10.999, -1, []],
  [-2, -1, []],
  [-2.001, -1, []],
  [-30, 0, [-1]],
  [0, 0, []],
];
const answers = ANSWER_ROWS.map(([expected, nothing, scores]) => ({
  expected,
  nothing,
  scores,
  answer: answer(
    {r: {expected, nothing, mut: scores.map(s => ({a: '', s})), near: []}},
    POLICIES.S1,
  ),
}));

// The padded look: the word alone with free frames round it.
const QUIET_FRAMES = 25;
const GAP_CASES = [
  {name: 'the word as written', said: ['ليجزي'], word: 'ليجزي'},
  {name: 'an inner letter changed', said: ['ليحزي'], word: 'ليجزي'},
  {name: 'the first letter changed', said: ['نيجزي'], word: 'ليجزي'},
  {name: 'the last letter changed', said: ['ليجزن'], word: 'ليجزي'},
  {name: 'a letter left out', said: ['ليزي'], word: 'ليجزي'},
  {name: 'three letters, the middle one changed', said: ['ربب'], word: 'راب'},
  {name: 'two letters', said: ['هو'], word: 'هو'},
];
const gaps = GAP_CASES.map((c, i) => {
  const seed = 2000 + i;
  const {logp: padded, frames: paddedFrames} = say(
    join(c.said),
    seed,
    QUIET_FRAMES,
  );
  return {
    ...c,
    seed,
    quiet: QUIET_FRAMES,
    frames: paddedFrames,
    gap: innerGap(padded, paddedFrames, tokensOf(c.word)),
  };
});

// Cutting the audio for the padded look, on a stream of 3 s.
const STREAM = 48000;
const CUT_CASES = [
  {name: 'a word well inside what was heard', from: 1, to: 1.5, limit: STREAM},
  {name: 'stops at what was heard at the hold', from: 1, to: 1.5, limit: 26000},
  {name: 'stops at the end of the stream', from: 2.5, to: 2.9, limit: 60000},
  {
    name: 'starts at the start of the stream',
    from: 0.1,
    to: 0.4,
    limit: STREAM,
  },
  {name: 'too short: a failure', from: 2, to: 2.1, limit: 27000},
  {name: 'nothing left: a failure', from: 2, to: 2.1, limit: 20000},
];
const stream = testWave(STREAM);
const cuts = CUT_CASES.map(c => {
  const out = paddedCut(stream, c.from, c.to, c.limit);
  const m = CANCEL.marginSeconds;
  return {
    ...c,
    cut: out
      ? {
          start: Math.max(0, Math.floor((c.from - m) * 16000)),
          samples: out.length - 2 * CANCEL.silenceSeconds * 16000,
          length: out.length,
        }
      : null,
  };
});

// What the letter-slip rule says, around its limits.
const CANCEL_ROWS = [
  [-6, null],
  [-6.001, null],
  [-5.999, null],
  [-5.999, -3.34],
  [-5.999, -3.341],
  [-5.999, -3.339],
  [-0.5, -4],
  [-0.5, 2],
  [null, null],
];
const cancels = CANCEL_ROWS.map(([first, gap]) => ({
  first,
  gap,
  answer: cancelAnswer({first, gap}),
}));

// Where the judge's slice goes, in samples and in log-mel frames.
const PREVIOUS_LAST = `2:4:${wordCount(2, 4) - 1}`;
const ENGINE_COUNTS = {'2:4': wordCount(2, 4), '2:5': wordCount(2, 5)};
const SLICE_CASES = [
  {
    name: 'a word in an ayah that started 5 s ago, the ayah before known',
    id: '2:5:6',
    t: 20,
    tracked: {'2:5:0': 375, [PREVIOUS_LAST]: 370},
  },
  {
    name: 'a word 12 s into a long ayah: 8 s at most',
    id: '2:5:9',
    t: 27.04,
    tracked: {'2:5:0': 375, [PREVIOUS_LAST]: 370},
  },
  {
    name: 'the next ayah known: the slice stops soon after its first word',
    id: '2:5:10',
    t: 20,
    tracked: {'2:5:0': 375, [PREVIOUS_LAST]: 370, '2:6:0': 505},
  },
  {
    name: 'the next ayah known well before the verdict: not before the verdict',
    id: '2:5:10',
    t: 20,
    tracked: {'2:5:0': 375, [PREVIOUS_LAST]: 370, '2:6:0': 400},
  },
  {
    name: 'no ayah before, as at a surah start',
    id: '1:1:2',
    t: 6,
    tracked: {'1:1:0': 75},
  },
  {
    name: 'the tracker has no first word: the cursor stands in',
    id: '2:5:4',
    t: 20,
    tracked: {[PREVIOUS_LAST]: 370},
    cursor: {'2:5': 16.5},
  },
  {
    name: 'the tracker has neither: the end of the ayah before alone',
    id: '2:5:4',
    t: 20,
    tracked: {[PREVIOUS_LAST]: 370},
  },
  {name: 'no places at all: 8 s back', id: '2:5:4', t: 20, tracked: {}},
  {
    name: 'a slice under 1.5 s: the last 3 s',
    id: '2:5:0',
    t: 20,
    hold: 0.48,
    tracked: {'2:5:0': 490, [PREVIOUS_LAST]: 480},
  },
  {
    name: 'past the end of what was heard',
    id: '2:5:4',
    t: 20,
    length: 20.2 * 16000,
    tracked: {'2:5:0': 375},
  },
  {
    name: 'the start of the stream',
    id: '1:1:0',
    t: 1.44,
    tracked: {'1:1:0': 10},
  },
];
const slices = SLICE_CASES.map(c => {
  const length = c.length ?? 60 * 16000;
  const tracked = new Map(
    Object.entries(c.tracked).map(([id, from]) => [id, {id, from, to: from}]),
  );
  const cursorIn = new Map(Object.entries(c.cursor ?? {}));
  const {start, end} = judgeSlice({tracked, cursorIn}, c.id, c.t, 0.48, length);
  const feats = {
    data: new Float32Array(numFrames(length) * NUM_BINS),
    frames: numFrames(length),
  };
  const piece = sliceFrames(feats, start, end, length + 1);
  return {
    ...c,
    length,
    start,
    end,
    first: Math.max(0, Math.round(start / 160)),
    frames: piece.frames,
  };
});

// The frozen constants, so the port's copies can be held to them.
const constantsOf = name =>
  JSON.parse(fs.readFileSync(path.join(HERE, name), 'utf8'));
const judgeConstants = constantsOf(
  '../recitation-bench/judge/judge_constants.json',
);
const engineConstants = constantsOf(
  '../recitation-bench/judge/engine_constants.npl.json',
);
const constants = {
  judge: {
    altFit: judgeConstants.altFit.value,
    fit: judgeConstants.fit.value,
    absentMargin: judgeConstants.absent.value,
    leftWords: judgeConstants.leftWords.value,
    rightWords: judgeConstants.rightWords.value,
    sliceSeconds: judgeConstants.sliceSeconds.value,
    cutSeconds: judgeConstants.cutSeconds.value,
    tailSeconds: judgeConstants.tailSeconds.value,
    firstWithinFrames: judgeConstants.firstWithinFrames.value,
  },
  follower: {
    altMargin: judgeConstants.mut.value,
    wakeOkGop: engineConstants.wakeOkGop.value,
    wakeOkNoGop: engineConstants.wakeOkNoGop.value,
    holdSeconds: engineConstants.holdSeconds.value,
    trackerLagSeconds: engineConstants.trackerLagSeconds.value,
    cursorLagSeconds: engineConstants.cursorLagSeconds.value,
    afterPreviousSeconds: engineConstants.afterPreviousSeconds.value,
    noPreviousSeconds: engineConstants.noPreviousSeconds.value,
    minSliceSeconds: engineConstants.minSliceSeconds.value,
  },
  cancel: {
    keepFirstPerLetter: CANCEL.keepFirstPerLetter,
    keepGap: CANCEL.keepGap,
    marginSeconds: CANCEL.marginSeconds,
    silenceSeconds: CANCEL.silenceSeconds,
  },
};

const hashes = Object.fromEntries(
  ORIGINALS.map(name => [
    path.relative(path.resolve(HERE, '../..'), path.join(HERE, name)),
    crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(HERE, name)))
      .digest('hex'),
  ]),
);

const goldens = {
  'fbankGolden.json': JSON.stringify(fbankGolden),
  'judgeGolden.json': JSON.stringify({cases: judged, raw, answers}),
  'cancelGolden.json': JSON.stringify({gaps, cuts, cancels, stream: STREAM}),
  'sliceGolden.json': JSON.stringify({
    counts: ENGINE_COUNTS,
    slices,
    constants,
  }),
};
const originals = `${JSON.stringify(hashes, null, 2)}\n`;

function differences(was, now, at = '') {
  if (
    typeof was !== 'object' ||
    typeof now !== 'object' ||
    was === null ||
    now === null
  ) {
    return was === now ? [] : [`${at}: ${was} -> ${now}`];
  }
  return [...new Set([...Object.keys(was), ...Object.keys(now)])].flatMap(key =>
    differences(was[key], now[key], `${at}/${key}`),
  );
}

if (process.argv.includes('--check')) {
  let stale = false;
  for (const [file, content] of Object.entries(goldens)) {
    const found = differences(
      JSON.parse(fs.readFileSync(path.join(FIXTURES, file), 'utf8')),
      JSON.parse(content),
    );
    console.log(
      `${file}: ${found.length ? `${found.length} values differ` : 'holds'}`,
    );
    for (const line of found.slice(0, 20)) console.log(`  ${line}`);
    stale ||= found.length > 0;
  }
  const named = fs.readFileSync(path.join(FIXTURES, 'originals.json'), 'utf8');
  if (named !== originals) {
    console.log('originals.json: the originals changed since the last cut');
  }
  process.exit(stale ? 1 : 0);
}

for (const [file, content] of Object.entries(goldens)) {
  fs.writeFileSync(path.join(FIXTURES, file), content);
}
fs.writeFileSync(path.join(FIXTURES, 'originals.json'), originals);
for (const c of judged) {
  console.log(
    c.name.padEnd(60),
    String(c.frames).padStart(4),
    c.result.expected,
    c.result.nothing,
    c.answer,
  );
}
for (const c of gaps) console.log(c.name.padEnd(60), c.frames, c.gap);
for (const c of cuts) console.log(c.name.padEnd(60), JSON.stringify(c.cut));
for (const c of slices) {
  console.log(c.name.padEnd(70), c.start / 16000, c.end / 16000, c.frames);
}
