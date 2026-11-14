/* eslint-env node, es2020 */
// Shared by the fix2 scripts: where things live, the checker's letters, the official
// text by surah:ayah, Quran.com word timings and a few small helpers.
import fs from 'node:fs';
import path from 'node:path';

export const HERE = path.dirname(new URL(import.meta.url).pathname);
export const BENCH = path.join(HERE, '..');
export const ROOT = path.join(BENCH, '../..');
// Everything downloaded or produced stays here (git-ignored).
export const OUT = path.join(BENCH, '.out/fix2');
export const QDC = path.join(OUT, 'qdc');
export const RUNS = path.join(OUT, 'runs');

export const VOCAB = 31;
export const BLANK = 0;
export const WORD = 30;
export const NONE = -1e30;
export const FRAME = 0.04;
export const BINS = 80;
export const SR = 16000;
// The engine's chunk: 480 ms of 16 kHz audio.
export const CHUNK = 7680;

// The checker's 29 letters, in token order (token 0 is the blank, 30 the word separator).
export const ALPHABET = 'ءابتثجحخدذرزسشصضطظعغفقكلمنهوي';
const ID = new Map([...ALPHABET].map((c, i) => [c, i + 1]));
const FOLD = {
  أ: 'ا',
  إ: 'ا',
  آ: 'ا',
  ٱ: 'ا',
  ٲ: 'ا',
  ٳ: 'ا',
  ى: 'ي',
  ئ: 'ي',
  ے: 'ي',
  ی: 'ي',
  ؤ: 'و',
  ة: 'ه',
  ک: 'ك',
};
export function lettersOf(word) {
  let out = '';
  for (const c of word) {
    const f = FOLD[c] ?? c;
    if (ALPHABET.includes(f)) {
      out += f;
    }
  }
  return out;
}
export const tokensOf = letters => [...letters].map(c => ID.get(c));

let textByKey = null;
let ayahCounts = null;
function loadText() {
  if (textByKey) {
    return;
  }
  textByKey = new Map();
  ayahCounts = new Array(114).fill(0);
  const raw = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data/quran.json'), 'utf8'),
  );
  for (const e of Object.values(raw)) {
    textByKey.set(e.verse_key, e.text);
    const s = e.surah_number - 1;
    ayahCounts[s] = Math.max(ayahCounts[s], e.ayah_number);
  }
}
/** The checker's letters of each word of an ayah ("s:a"), or null. */
export function ayahWords(key) {
  loadText();
  const t = textByKey.get(key);
  return t ? t.split(/\s+/).map(lettersOf).filter(Boolean) : null;
}
export function allKeys() {
  loadText();
  return [...textByKey.keys()];
}
/** Ayat in a surah (1-based surah number), 0 when there is no such surah. */
export function ayahCount(surah) {
  loadText();
  return ayahCounts[surah - 1] ?? 0;
}

/** Words as said in a Quran.com surah file, in order, repeats kept. Times in seconds. */
export function loadQdc(file) {
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  const out = [];
  let odd = 0;
  for (const v of d.audio_files[0].verse_timings) {
    const words = ayahWords(v.verse_key);
    const [s, a] = v.verse_key.split(':').map(Number);
    let prev = 0;
    for (const seg of v.segments) {
      if (seg.length !== 3) {
        odd++;
        continue;
      }
      const [n, from, to] = seg;
      if (n < 1 || n > words.length || to <= from) {
        odd++;
        continue;
      }
      out.push({
        surah: s,
        ayah: a,
        word: n - 1,
        total: words.length,
        letters: words[n - 1],
        start: from / 1000,
        end: to / 1000,
        repeat: n <= prev,
      });
      prev = n;
    }
  }
  out.odd = odd;
  return out;
}
/** Runs of said words with the same ayah, as lists of indices into `said`. */
export function ayahGroups(said) {
  const groups = [];
  for (let i = 0; i < said.length; i++) {
    const g = groups[groups.length - 1];
    if (g && said[g[0]].ayah === said[i].ayah) {
      g.push(i);
    } else {
      groups.push([i]);
    }
  }
  return groups;
}
export function readF32(file) {
  const buf = fs.readFileSync(file);
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
}
/** The engine's own log-mel frames for a whole recording, fed in 480 ms chunks. */
export async function engineFrames(audio) {
  const {KaldiFbank} = await import(
    path.join(ROOT, 'node_modules/@tilawa/core/dist/recitation/fbank.js')
  );
  const fbank = new KaldiFbank();
  const rows = [];
  // upTo[c]: frames ready once chunk c has been fed.
  const upTo = [];
  for (let off = 0; off < audio.length; off += CHUNK) {
    const chunk = audio.subarray(off, Math.min(off + CHUNK, audio.length));
    for (const row of fbank.acceptWaveform(chunk)) {
      rows.push(row);
    }
    upTo.push(rows.length);
  }
  return {rows, upTo};
}
/** Log-probabilities relative to each frame's best token, so the best is 0. */
export function relativeTo(logp, frames) {
  const rel = new Float32Array(frames * VOCAB);
  for (let t = 0; t < frames; t++) {
    const row = t * VOCAB;
    let best = -Infinity;
    for (let k = 0; k < VOCAB; k++) {
      if (logp[row + k] > best) {
        best = logp[row + k];
      }
    }
    for (let k = 0; k < VOCAB; k++) {
      rel[row + k] = logp[row + k] - best;
    }
  }
  return rel;
}
/** Per-frame argmax token. */
export function argmaxPath(rel, frames) {
  const out = new Uint8Array(frames);
  for (let t = 0; t < frames; t++) {
    let b = 0;
    let bv = -Infinity;
    for (let k = 0; k < VOCAB; k++) {
      if (rel[t * VOCAB + k] > bv) {
        bv = rel[t * VOCAB + k];
        b = k;
      }
    }
    out[t] = b;
  }
  return out;
}
/** Greedy letters of frames [from, to]: collapsed, blanks and separators dropped. */
export function greedySpan(am, from, to) {
  const ids = [];
  let prev = from > 0 ? am[from - 1] : -1;
  for (let t = from; t <= to; t++) {
    const k = am[t];
    if (k !== BLANK && k !== prev && k !== WORD) {
      ids.push(k);
    }
    prev = k;
  }
  return ids;
}
export function editDistance(a, b) {
  const n = a.length;
  const m = b.length;
  let prev = new Uint16Array(m + 1);
  let cur = new Uint16Array(m + 1);
  for (let j = 0; j <= m; j++) {
    prev[j] = j;
  }
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    for (let j = 1; j <= m; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[m];
}
/**
 * Viterbi alignment of a word sequence where the path may start and end anywhere in
 * the text (the window cuts the recitation at both ends). Returns per word its first
 * frame, last frame (blanks after its last letter included, separator excluded), the
 * path score inside that span and how many of its letters the path visits; the whole
 * path's score is on the array as `score`. opts.startFree / endFree default true; with
 * false the path must start at the first token (after optional blanks) / end on the
 * last one.
 */
export function alignFree(rel, frames, words, opts = {}) {
  const {startFree = true, endFree = true} = opts;
  const tokens = [];
  const wordOf = [];
  words.forEach((w, i) => {
    if (i > 0) {
      tokens.push(WORD);
      wordOf.push(-1);
    }
    for (const t of w) {
      tokens.push(t);
      wordOf.push(i);
    }
  });
  const m = tokens.length;
  // State 2j is token j, 2j+1 the blank after it, 2m the blanks before the text.
  const S = 2 * m + 1;
  const back = new Int32Array(frames * S);
  let cur = new Float64Array(S).fill(NONE);
  let nxt = new Float64Array(S);
  {
    const blank = rel[BLANK];
    cur[2 * m] = blank;
    back[2 * m] = -1;
    for (let j = 0; j < m; j++) {
      if (startFree || j === 0) {
        cur[2 * j] = rel[tokens[j]];
        back[2 * j] = -1;
      }
      if (startFree) {
        cur[2 * j + 1] = blank;
        back[2 * j + 1] = -1;
      }
    }
  }
  for (let t = 1; t < frames; t++) {
    const row = t * VOCAB;
    const blank = rel[row + BLANK];
    nxt.fill(NONE);
    nxt[2 * m] = cur[2 * m] + blank;
    back[t * S + 2 * m] = 2 * m;
    for (let j = 0; j < m; j++) {
      const tk = 2 * j;
      const bl = tk + 1;
      let best = cur[tk];
      let from = tk;
      if (j === 0) {
        if (cur[2 * m] > best) {
          best = cur[2 * m];
          from = 2 * m;
        }
      } else {
        if (cur[tk - 1] > best) {
          best = cur[tk - 1];
          from = tk - 1;
        }
        if (tokens[j] !== tokens[j - 1] && cur[tk - 2] > best) {
          best = cur[tk - 2];
          from = tk - 2;
        }
      }
      if (best > NONE) {
        nxt[tk] = best + rel[row + tokens[j]];
        back[t * S + tk] = from;
      }
      let stay = cur[tk];
      let sfrom = tk;
      if (cur[bl] > stay) {
        stay = cur[bl];
        sfrom = bl;
      }
      if (stay > NONE) {
        nxt[bl] = stay + blank;
        back[t * S + bl] = sfrom;
      }
    }
    [cur, nxt] = [nxt, cur];
  }
  let state = -1;
  let score = NONE;
  if (endFree) {
    for (let s = 0; s < S; s++) {
      if (cur[s] > score) {
        score = cur[s];
        state = s;
      }
    }
  } else {
    state = cur[2 * m - 2] > cur[2 * m - 1] ? 2 * m - 2 : 2 * m - 1;
    score = cur[state];
  }
  const out = words.map(() => ({start: -1, end: -1, score: 0, letters: 0}));
  // Token index on the path per frame; -1 for the blanks before the text, -2-j for the
  // blank after token j.
  const pathTok = new Int16Array(frames).fill(-1);
  for (let t = frames - 1; t >= 0 && state >= 0; t--) {
    if (state < 2 * m) {
      const j = Math.floor(state / 2);
      pathTok[t] = state % 2 === 0 ? j : -2 - j;
    }
    state = back[t * S + state];
  }
  const seenTok = new Set();
  for (let t = 0; t < frames; t++) {
    const p = pathTok[t];
    if (p === -1) {
      continue;
    }
    const j = p >= 0 ? p : -2 - p;
    const w = wordOf[j];
    if (w < 0) {
      continue; // on a separator or the blank after it
    }
    if (out[w].start < 0) {
      out[w].start = t;
    }
    out[w].end = t;
    out[w].score +=
      p >= 0 ? rel[t * VOCAB + tokens[j]] : rel[t * VOCAB + BLANK];
    if (p >= 0 && !seenTok.has(j)) {
      seenTok.add(j);
      out[w].letters += 1;
    }
  }
  out.score = score;
  return out;
}
/* eslint-disable no-bitwise -- a 32-bit integer hash by design */
/** A small seeded generator (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* eslint-enable no-bitwise */
/** --name value pairs and bare words from argv. */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = {_: []};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      args[a.slice(2)] = argv[++i];
    } else {
      args._.push(a);
    }
  }
  return args;
}
