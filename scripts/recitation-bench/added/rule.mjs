/* eslint-env node, es2020 */
// The added-word rule, as pure functions over one gap record (added/probe.mjs).
// What a gap's chars look like, and whether nearby text explains them.
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const BENCH = path.resolve(HERE, '..');

export const SHORT_VOWELS = new Set(['َ', 'ُ', 'ِ']);
const LONG_VOWELS = new Set(['ا', 'ۥ', 'ۦ', 'ى']);
// Marks the model writes that are not sounds of their own.
const SIGNS = new Set(['ڇ', 'ؙ', 'ۣ', 'ٞ', 'ۜ', '۪', 'ـ']);

export function collapse(s) {
  let out = '';
  for (const c of s) {
    if (out.length === 0 || out[out.length - 1] !== c) out += c;
  }
  return out;
}

/** Sounds of a run, lengthened ones counted once. */
export function shape(chars) {
  const collapsed = [...collapse(chars)].filter(c => !SIGNS.has(c));
  let consonants = 0;
  let vowels = 0;
  for (const c of collapsed) {
    if (SHORT_VOWELS.has(c) || LONG_VOWELS.has(c)) vowels += 1;
    else consonants += 1;
  }
  return {sounds: collapsed.length, consonants, vowels};
}

/** A run that can be a word: a consonant and a vowel plus one more sound. */
export function wordShaped(chars, minSounds = 3) {
  const s = shape(chars);
  return s.sounds >= minSounds && s.consonants >= 1 && s.vowels >= 1;
}

const CANON = {'ۥ': 'و', 'ۦ': 'ي', 'ں': 'ن', '۾': 'م', 'ٱ': 'ا', 'ى': 'ي', 'أ': 'ء', 'إ': 'ء', 'آ': 'ء', 'ؤ': 'ء', 'ئ': 'ء', 'ٲ': 'ء'};

/** Sounds with spellings of one sound folded and lengths counted once. */
export function fold(s) {
  let out = '';
  for (const c0 of s) {
    if (SIGNS.has(c0)) continue;
    const c = CANON[c0] ?? c0;
    if (out.length === 0 || out[out.length - 1] !== c) out += c;
  }
  return out;
}

const dropFinalVowel = f => (f.length && SHORT_VOWELS.has(f[f.length - 1]) ? f.slice(0, -1) : f);

/** Every word of the corpus, folded: the words a run can be. */
export function buildVocab(words) {
  const exact = new Set();
  const loose = new Set();
  for (const w of words) {
    const f = fold(w.phon);
    exact.add(f);
    loose.add(dropFinalVowel(f));
  }
  return {exact, loose};
}

/** The run is one word of the Quran. A long word may differ in its final vowel,
 * as at a stop; short ones must match whole, or any fragment would pass. */
export function isRealWord(chars, vocab, looseFrom = 5) {
  const f = fold(chars);
  if (vocab.exact.has(f)) return true;
  return f.length >= looseFrom && vocab.loose.has(dropFinalVowel(f));
}

const NASALS = new Set(['ن', 'م']);

/**
 * The same, allowing for the edges a run can lose or gain: its first consonant
 * merged with the same consonant ending the left word (`prev`), so the run starts
 * on a vowel; or a nasal tail of the left word left in front of it.
 */
export function isWordInRun(chars, prev, vocab) {
  if (isRealWord(chars, vocab)) return true;
  const f = fold(chars);
  if (f.length && SHORT_VOWELS.has(f[0]) && prev && isRealWord(prev + chars, vocab)) return true;
  if (f.length >= 4 && NASALS.has(f[0]) && !SHORT_VOWELS.has(f[1]) && isRealWord(f.slice(1), vocab)) return true;
  return false;
}

/** Word lookups over the engine's corpus file (pinned; never changed). */
export function loadWords(corpusFile = path.join(BENCH, '.out/assets/zipformer_quran.json')) {
  const raw = JSON.parse(fs.readFileSync(corpusFile, 'utf8'));
  const index = new Map();
  const words = [];
  for (const s of raw.surahs) {
    for (const a of s.ayahs) {
      a.w.forEach((w, i) => {
        index.set(`${s.n}:${a.n}:${i}`, words.length);
        words.push({surah: s.n, ayah: a.n, word: i, phon: w[1], total: a.w.length});
      });
    }
  }
  return {index, words};
}

/**
 * Edit cost of parsing `gap` as (a prefix of `right`) then (a slice of `left`
 * starting at a word start, ending anywhere). That is what a reader going back
 * leaves: they read on past the word (the prefix), stopped, went back to a word
 * start, and read up to where they were. Either part may be empty.
 * `left` and `right` are arrays of word phonemes, nearest word last in `left`.
 */
export function restartCost(gap, left, right, table) {
  const g = table.encode(gap);
  const R = table.encode(right.join(''));
  const Ltext = left.join('');
  const L = table.encode(Ltext);
  const starts = [];
  let at = 0;
  for (const w of left) {
    starts.push(at);
    at += w.length;
  }
  const isStart = new Uint8Array(L.length + 1);
  for (const s of starts) isStart[s] = 1;
  const n = g.length;
  // pr[j]: cost in the right text at position j; pl[j]: in the left text.
  let pr = new Float32Array(R.length + 1);
  let pl = new Float32Array(L.length + 1);
  pr[0] = 0;
  for (let j = 1; j <= R.length; j++) pr[j] = pr[j - 1] + 1;
  // Jumping to any word start of the left text costs nothing, from anywhere.
  const fill = (row, minR) => {
    for (let j = 0; j <= L.length; j++) row[j] = isStart[j] ? minR : Infinity;
    for (let j = 1; j <= L.length; j++) {
      if (row[j - 1] + 1 < row[j]) row[j] = row[j - 1] + 1;
    }
  };
  fill(pl, 0);
  for (let i = 1; i <= n; i++) {
    const nr = new Float32Array(R.length + 1);
    const nl = new Float32Array(L.length + 1);
    nr[0] = pr[0] + 1;
    for (let j = 1; j <= R.length; j++) {
      nr[j] = Math.min(pr[j - 1] + table.cost(g[i - 1], R[j - 1]), pr[j] + 1, nr[j - 1] + 1);
    }
    let minR = Infinity;
    for (let j = 0; j <= R.length; j++) if (nr[j] < minR) minR = nr[j];
    nl[0] = Math.min(pl[0] + 1, isStart[0] ? minR : Infinity);
    for (let j = 1; j <= L.length; j++) {
      let x = Math.min(pl[j - 1] + table.cost(g[i - 1], L[j - 1]), pl[j] + 1, nl[j - 1] + 1);
      if (isStart[j] && minR < x) x = minR;
      nl[j] = x;
    }
    pr = nr;
    pl = nl;
  }
  let best = Infinity;
  for (let j = 0; j <= R.length; j++) if (pr[j] < best) best = pr[j];
  for (let j = 0; j <= L.length; j++) if (pl[j] < best) best = pl[j];
  return best;
}

/**
 * Edit cost of `gap` against a stretch of `text` that ends exactly at its end,
 * starting anywhere: the tail of a word said again, an echo of what came just
 * before.
 */
export function echoCost(gap, text, table) {
  const g = table.encode([...gap].reverse().join(''));
  const t = table.encode([...text].reverse().join(''));
  const n = g.length;
  let prev = new Float32Array(t.length + 1);
  for (let j = 1; j <= t.length; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    const cur = new Float32Array(t.length + 1);
    cur[0] = i;
    for (let j = 1; j <= t.length; j++) {
      cur[j] = Math.min(prev[j - 1] + table.cost(g[i - 1], t[j - 1]), prev[j] + 1, cur[j - 1] + 1);
    }
    prev = cur;
  }
  let best = Infinity;
  for (let j = 0; j <= t.length; j++) if (prev[j] < best) best = prev[j];
  return best;
}

/** Phonemes around a gap. `back` and `ahead` count words, inside the surah. */
export function around(words, index, leftId, rightId, back, ahead) {
  const l = index.get(leftId);
  const r = index.get(rightId);
  const left = [];
  const surah = words[l].surah;
  for (let k = l; k >= 0 && l - k < back && words[k].surah === surah; k--) left.unshift(words[k].phon);
  const right = [];
  for (let k = r; k < words.length && k - r < ahead && words[k].surah === surah; k++) right.push(words[k].phon);
  return {left, right};
}

/** Phrases readers say that are not the text, in the engine's phonemes. */
export const NOT_TEXT_PHRASES = [
  'ءَعُۥۥذُبِللَااهِمِنَششَييطَاانِررَجِۦۦم', // isti'adha (the engine's own string)
  'بِسمِللَااهِررَحمَاانِررَحِۦۦۦۦم', // basmala (the engine's own string)
  'ءَللَااهُءَكبَر', // takbir
  'صَدَقَللَااهُلعَظِۦۦم', // said at the end of a reading
  'ءَاامِۦۦن', // after al-Fatiha
];

/** Lowest cost of `gap` against the start of one of the phrases, sounds counted
 * once, ending anywhere. */
export function phraseCost(gap, table) {
  let best = Infinity;
  const g = table.encode(collapse(gap));
  for (const phrase of NOT_TEXT_PHRASES) {
    const p = table.encode(collapse(phrase));
    let prev = new Float32Array(p.length + 1);
    for (let j = 1; j <= p.length; j++) prev[j] = j;
    for (let i = 1; i <= g.length; i++) {
      const cur = new Float32Array(p.length + 1);
      cur[0] = i;
      for (let j = 1; j <= p.length; j++) {
        cur[j] = Math.min(prev[j - 1] + table.cost(g[i - 1], p[j - 1]), prev[j] + 1, cur[j - 1] + 1);
      }
      prev = cur;
    }
    for (let j = 0; j <= p.length; j++) if (prev[j] < best) best = prev[j];
  }
  return best;
}

// ------------------------------------------------------------------- the rule

/**
 * Constants of the rule. Where each comes from is in added/README.md. They were tuned
 * on the follower's output, so these numbers are under the Quran-Lab NPL-1.2
 * (licenses/NPL-1.2.txt), not the repo's licence. The app reads its copy from
 * services/recitation/followerConstants.npl.json.
 */
export const DEFAULTS = {
  realWord: true,
  minSounds: 3,
  fit: 0.15,
  fitLast: 0.4,
  noGap: -2,
  margin: 0,
  // How far back and ahead a short run (up to shortRun sounds) may repeat.
  shortRun: 5,
  backShort: 4,
  aheadShort: 2,
  back: 12,
  ahead: 12,
  // Edit cost a repeat may carry: short runs almost none, long ones in proportion.
  tolShort: 0.3,
  tolMid: 1,
  midRun: 12,
  tolLong: 0.3,
  // A run this long may be two pieces: read on, gone back.
  twoPartsFrom: 10,
  confirmSec: 0,
};

function squeezeAll(list) {
  return list.map(collapse);
}

/** The most edit cost a repeat of n sounds may carry. */
export function tolerance(n, P = DEFAULTS) {
  if (n <= P.shortRun) return P.tolShort;
  if (n <= P.midRun) return P.tolMid;
  return P.tolLong * n;
}

/**
 * Lowest cost of `gap` against a stretch of the words that starts at a word start.
 * `wholeWords`: the stretch must also end at a word's end.
 */
export function sliceCost(gap, wordsList, table, wholeWords = false) {
  const g = table.encode(gap);
  const text = wordsList.join('');
  const t = table.encode(text);
  const isStart = new Uint8Array(t.length + 1);
  const isEnd = new Uint8Array(t.length + 1);
  let at = 0;
  for (const w of wordsList) {
    isStart[at] = 1;
    at += w.length;
    isEnd[at] = 1;
  }
  let prev = new Float32Array(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = isStart[j] ? 0 : j === 0 ? 0 : prev[j - 1] + 1;
  for (let i = 1; i <= g.length; i++) {
    const cur = new Float32Array(t.length + 1);
    cur[0] = i;
    for (let j = 1; j <= t.length; j++) {
      cur[j] = Math.min(prev[j - 1] + table.cost(g[i - 1], t[j - 1]), prev[j] + 1, cur[j - 1] + 1);
    }
    prev = cur;
  }
  let best = Infinity;
  for (let j = 0; j <= t.length; j++) {
    if ((!wholeWords || isEnd[j]) && prev[j] < best) best = prev[j];
  }
  return best;
}

/** Lowest cost of `gap` against the start of `text`, ending anywhere. */
export function prefixCost(gap, text, table) {
  return sliceCost(gap, [text], table);
}

/** What nearby text explains a run, if anything: 'repeat', 'echo' or 'restart'. */
export function explainedBy(chars, words, index, leftId, rightId, table, P = DEFAULTS) {
  const gap = collapse(chars);
  const n = gap.length;
  const tol = tolerance(n, P);
  const short = n <= P.shortRun;
  const near = around(words, index, leftId, rightId, short ? P.backShort : P.back, short ? P.aheadShort : P.ahead);
  const left = squeezeAll(near.left);
  const right = squeezeAll(near.right);
  const leftWord = left[left.length - 1] ?? '';
  // The next words begun early: a stutter, or read on before going back.
  if (prefixCost(gap, right.join(''), table) <= tol) return 'repeat';
  // Whole words said again, or the current word half said again.
  if (sliceCost(gap, left, table, short) <= tol) return 'repeat';
  if (prefixCost(gap, leftWord, table) <= tol) return 'repeat';
  // The tail of what came just before, said again.
  if (echoCost(gap, short ? leftWord : left.join(''), table) <= tol) return 'echo';
  // Read on, stopped, went back.
  if (n >= P.twoPartsFrom && restartCost(gap, left, right, table) <= tol) return 'restart';
  return null;
}

/** Text features of a gap, which depend on few of the constants. */
export function textFeatures(g, words, index, table, P = DEFAULTS, vocab = null) {
  const li = index.get(g.left);
  const ri = index.get(g.id);
  return {
    real: vocab ? isWordInRun(g.chars, g.prev ?? '', vocab) : null,
    explained: explainedBy(g.chars, words, index, g.left, g.id, table, P),
    phrase: phraseCost(g.chars, table),
    leftLast: words[li].word === words[li].total - 1,
    rightLast: words[ri].word === words[ri].total - 1,
    between: words[li].ayah !== words[ri].ayah,
  };
}

/** Why a gap is not an added word, or null if the rule marks it. */
export function rejectReason(g, tf, P = DEFAULTS) {
  if (!wordShaped(g.chars, P.minSounds)) return 'shape';
  if (g.fitL > (tf.leftLast ? P.fitLast : P.fit) || g.fitR > (tf.rightLast ? P.fitLast : P.fit)) return 'fit';
  if (P.realWord && !tf.real) return 'not_a_word';
  if (g.noGap === null || g.noGap === undefined) return 'no_scores';
  if (g.noGap > P.noGap) return 'no_evidence';
  if (g.margin < P.margin) return 'margin';
  if (tf.explained) return tf.explained;
  if (tf.phrase <= tolerance(collapse(g.chars).length, P)) return 'phrase';
  return null;
}
