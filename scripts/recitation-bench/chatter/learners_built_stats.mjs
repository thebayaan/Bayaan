/* eslint-env node, es2020 */
// The logic of this job's tables, as plain functions with no file or model behind them, so
// that the test file can check each against small cases and against the figures it copies.

// ------------------------------------------------------------------- the parity gate

/** What differs between two takes' results: chains by name, and other result fields. */
export function diffTake(a, b, chains) {
  const out = {chains: [], fields: []};
  if (!a || !b) {
    out.fields.push(a ? 'missing here' : 'missing in the frozen file');
    return out;
  }
  for (const c of chains) {
    if (JSON.stringify(a.cfg[c]) !== JSON.stringify(b.cfg[c])) out.chains.push(c);
  }
  for (const k of ['seconds', 'onset', 'wakes', 'features']) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.fields.push(k);
  }
  return out;
}

/** A JSONL of the judge's rows, as `run|id|t|src`, for the runs named. Lines that do not parse are left out. */
export function readRowsText(text, runs) {
  const out = new Map();
  for (const line of text.split('\n')) {
    if (!line || !line.startsWith('{"run":')) continue;
    let r;
    try {
      r = JSON.parse(line);
    } catch {
      continue;
    }
    if (!runs || runs.has(r.run)) out.set(`${r.run}|${r.id}|${r.t}|${r.src}`, r);
  }
  return out;
}

const LABELS = ['hit', 'near', 'false-incorrect', 'false-correct'];

/**
 * tables.mjs's QuranMB block: the base is what J.none shows on a learner's words; a chain keeps
 * a base mark when it shows that word, and any other mark it shows is added.
 */
export function labelTable(rows, {label, chains, pigeonhole, fmtP, boot = 2000}) {
  const shown = (r, c) => r.cfg[c].app.shown;
  const base = [];
  for (const r of rows) {
    for (const m of shown(r, 'J.none')) {
      const l = label(r.id, m);
      if (LABELS.includes(l))
        base.push({run: r.id, id: m.id, label: l, spk: r.id.split('/')[1].split('_')[0]});
    }
  }
  const baseKeys = new Set(base.map(b => `${b.run}|${b.id}`));
  const byRun = new Map(rows.map(r => [r.id, r]));
  const out = {};
  for (const c of chains) {
    const row = {};
    for (const l of LABELS) {
      const pts = base
        .filter(b => b.label === l)
        .map(b => ({
          a: b.id,
          b: b.spk,
          num: shown(byRun.get(b.run), c).some(m => m.id === b.id) ? 1 : 0,
          den: 1,
        }));
      const est = pigeonhole(pts, boot);
      row[l] = {kept: est.num, of: est.den, ci: fmtP(est)};
    }
    const added = {};
    for (const r of rows) {
      for (const m of shown(r, c)) {
        if (baseKeys.has(`${r.id}|${m.id}`)) continue;
        const l = label(r.id, m);
        added[l] = (added[l] ?? 0) + 1;
      }
    }
    row.added = added;
    out[c] = row;
  }
  return out;
}

/** Cells that differ between two label tables. `withAdded` also compares added marks and intervals. */
export function compareTables(a, b, withAdded) {
  const differ = [];
  for (const c of Object.keys(a)) {
    for (const l of LABELS) {
      if (a[c][l].kept !== b[c][l].kept || a[c][l].of !== b[c][l].of)
        differ.push(`${c} ${l}: ${a[c][l].kept}/${a[c][l].of} against ${b[c][l].kept}/${b[c][l].of}`);
      else if (withAdded && a[c][l].ci !== b[c][l].ci)
        differ.push(`${c} ${l} interval: ${a[c][l].ci} against ${b[c][l].ci}`);
    }
    if (withAdded && JSON.stringify(sorted(a[c].added)) !== JSON.stringify(sorted(b[c].added)))
      differ.push(`${c} added: ${JSON.stringify(a[c].added)} against ${JSON.stringify(b[c].added)}`);
  }
  return {cells: differ.length, examples: differ.slice(0, 10)};
}
const sorted = o => Object.fromEntries(Object.entries(o).sort(([x], [y]) => (x < y ? -1 : 1)));

// ------------------------------------------------------------------- draws

/**
 * Speakers and words drawn with replacement, in the order learners_report.mjs draws them, so
 * that the same seed gives the same draws and intervals here are paired with its figures.
 */
export function makeDraws(nS, nW, boot, rand) {
  const spk = new Int16Array(boot * nS);
  const word = new Int16Array(boot * nW);
  for (let b = 0; b < boot; b++) {
    for (let i = 0; i < nS; i++) spk[b * nS + Math.floor(rand() * nS)] += 1;
    for (let i = 0; i < nW; i++) word[b * nW + Math.floor(rand() * nW)] += 1;
  }
  return {spk, word, nS, nW, boot};
}

/** How often a speaker-and-word cell counts in each draw: speakers times words. */
export function productDrawer({spk, word, nS, nW, boot}) {
  const cache = new Map();
  return {
    boot,
    wOf(si, wi) {
      const key = si * 100000 + wi;
      let w = cache.get(key);
      if (!w) {
        w = new Float64Array(boot);
        for (let b = 0; b < boot; b++) w[b] = spk[b * nS + si] * word[b * nW + wi];
        cache.set(key, w);
      }
      return w;
    },
  };
}

/** One-way draws for the plain two-way variance: speakers alone, words alone, or cells alone. */
export function oneWayDrawer(kind, {nS, nW, boot, cells, rand}) {
  const cache = new Map();
  const counts = n => {
    const d = new Float64Array(boot * n);
    for (let b = 0; b < boot; b++) for (let i = 0; i < n; i++) d[b * n + Math.floor(rand() * n)] += 1;
    return d;
  };
  const n = kind === 'speakers' ? nS : kind === 'words' ? nW : cells.size;
  const d = counts(n);
  const at = (si, wi) => {
    if (kind === 'speakers') return si;
    if (kind === 'words') return wi;
    const i = cells.get(si * 100000 + wi);
    if (i === undefined) throw new Error(`no cell ${si} ${wi}`);
    return i;
  };
  return {
    boot,
    wOf(si, wi) {
      const i = at(si, wi);
      let w = cache.get(i);
      if (!w) {
        w = new Float64Array(boot);
        for (let b = 0; b < boot; b++) w[b] = d[b * n + i];
        cache.set(i, w);
      }
      return w;
    },
  };
}

/** Each draw's sum over rows {si, wi}, each row counted value(row) times its draws. */
export function sumOver(rows, drawer, value = () => 1) {
  const out = new Float64Array(drawer.boot);
  for (const r of rows) {
    const v = value(r);
    if (!v) continue;
    const w = drawer.wOf(r.si, r.wi);
    for (let b = 0; b < out.length; b++) out[b] += w[b] * v;
  }
  return out;
}

export const quantile = (sorted, q) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];

/** The 95% interval of a draw's values, as learners_report.mjs takes it. */
export function ci(values) {
  const v = Array.from(values).filter(Number.isFinite).sort((x, y) => x - y);
  return v.length ? {lo: +quantile(v, 0.025).toFixed(3), hi: +quantile(v, 0.975).toFixed(3)} : null;
}
export const div = (a, b, k = 1) => a.map((x, i) => (b[i] ? (k * x) / b[i] : NaN));
export const sub = (a, b) => a.map((x, i) => x - b[i]);

/**
 * The plain two-way interval the independent check compares with: V(speakers) + V(words) -
 * V(cells), around the point estimate. The product of draws is wider than this.
 */
export function twoWayInterval(point, speakers, words, cells) {
  const sd = a => {
    const v = Array.from(a).filter(Number.isFinite);
    const m = v.reduce((x, y) => x + y, 0) / v.length;
    return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1));
  };
  const s = Math.sqrt(Math.max(0, sd(speakers) ** 2 + sd(words) ** 2 - sd(cells) ** 2));
  return {lo: +(point - 1.96 * s).toFixed(3), hi: +(point + 1.96 * s).toFixed(3)};
}

// ------------------------------------------------------------------- what the reader changed

const VOWEL_EDITS = new Set(['vowel', 'vowelDeleted', 'vowelInserted', 'vowelLength', 'vowelEmphasis']);
const before = (a, b, c, d) => a < c || (a === c && b < d);

/**
 * Per word of a segment, as 'a:w': did its phoneme edits touch only vowels? Edits outside the
 * segment are pulled to its nearest end, as the labels do.
 * @returns {Map<string, {vowelOnly: boolean, deleted: boolean, sub: boolean}>}
 */
export function editKinds(seg) {
  const m = new Map();
  for (const e of seg.phonemeEdits ?? []) {
    if (!e.word) continue;
    const [s, a0, w0] = e.word.split(':').map(Number);
    if (s !== seg.surah) continue;
    let a = a0;
    let w = w0;
    if (before(a, w, seg.ayahStart, seg.wordStart)) {
      a = seg.ayahStart;
      w = seg.wordStart;
    } else if (before(seg.ayahEnd, seg.wordEnd, a, w)) {
      a = seg.ayahEnd;
      w = seg.wordEnd;
    }
    const k = `${a}:${w}`;
    if (!m.has(k)) m.set(k, {vowelOnly: true, deleted: false, sub: false});
    const x = m.get(k);
    if (!VOWEL_EDITS.has(e.class)) x.vowelOnly = false;
    if (e.class === 'consonantDeleted') x.deleted = true;
    if (e.class === 'consonant' || e.class === 'vowelConsonantSwap') x.sub = true;
  }
  return m;
}

/** A segment's exact place, the unit "other readers of that text" is read over. */
export const spanKey = g => `${g.surah}:${g.ayahStart}:${g.wordStart}:${g.ayahEnd}:${g.wordEnd}`;

/**
 * Who changed which word: per text, the incorrect takes' speakers and labelled words.
 * @param {{speaker: string, seg: object, errors: Set<string>}[]} takes
 */
export function readersOfTexts(takes) {
  const by = new Map();
  for (const t of takes) {
    if (t.seg.label !== 'incorrect') continue;
    const k = spanKey(t.seg);
    if (!by.has(k)) by.set(k, []);
    by.get(k).push({speaker: t.speaker, errors: t.errors});
  }
  return by;
}

/** Did any other reader of this text change this word? */
export function othersChanged(by, seg, speaker, k) {
  return (by.get(spanKey(seg)) ?? []).some(o => o.speaker !== speaker && o.errors.has(k));
}

// ------------------------------------------------------------------- chance

/** Letters of a word, in the classes the check matches on. */
export const lengthClass = n => (n === null || n === undefined ? 'x' : n <= 2 ? 's' : n <= 4 ? 'm' : 'l');

/** The within-take chance of one mark on the words marks reach: all but the last two. */
export function reachChance({i, words, errors}) {
  const n = words.length;
  const reach = words.slice(0, Math.max(0, n - 2));
  if (i < n - 2 && reach.length) return reach.filter(k => errors.has(k)).length / reach.length;
  return errors.has(words[i]) ? 1 : 0;
}

function shuffleInPlace(a, rand) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const x = a[i];
    a[i] = a[j];
    a[j] = x;
  }
}

/**
 * The check's shuffle (R3): labels move among the words marks reach, one shuffle per text, the
 * marks stay where they are, and a mark on the last two words keeps its real outcome.
 * `classOf(text)` gives, when wanted, a class per reachable place: labels then move only within
 * a class, which keeps word length matched.
 * @param {{text: string, i: number, words: string[], errors: Set<string>, isNew: boolean}[]} rows
 * @returns {{hits, mean, lo, hi, p, newHits, newMean, newLo, newHi, newP}}
 */
export function shuffleChance(rows, {N = 10000, rand, classOf = null}) {
  const groups = new Map();
  let hits = 0;
  let newHits = 0;
  for (const r of rows) {
    if (!groups.has(r.text)) groups.set(r.text, []);
    groups.get(r.text).push(r);
    if (r.errors.has(r.words[r.i])) {
      hits += 1;
      if (r.isNew) newHits += 1;
    }
  }
  const list = [...groups.entries()].map(([text, rs]) => {
    const n = rs[0].words.length - 2;
    const places = Array.from({length: Math.max(0, n)}, (_, i) => i);
    const sets = [];
    if (classOf) {
      const cls = classOf(text);
      const byClass = new Map();
      for (const p of places) {
        if (!byClass.has(cls[p])) byClass.set(cls[p], []);
        byClass.get(cls[p]).push(p);
      }
      sets.push(...byClass.values());
    } else sets.push(places);
    return {rs, n, sets};
  });
  const all = new Int32Array(N);
  const fresh = new Int32Array(N);
  for (let s = 0; s < N; s++) {
    let h = 0;
    let hn = 0;
    for (const {rs, n, sets} of list) {
      const pi = new Int32Array(Math.max(0, n));
      for (const set of sets) {
        const moved = set.slice();
        shuffleInPlace(moved, rand);
        set.forEach((p, idx) => {
          pi[p] = moved[idx];
        });
      }
      for (const r of rs) {
        const from = r.i < n ? r.words[pi[r.i]] : r.words[r.i];
        if (r.errors.has(from)) {
          h += 1;
          if (r.isNew) hn += 1;
        }
      }
    }
    all[s] = h;
    fresh[s] = hn;
  }
  const read = (arr, seen) => {
    const sorted = Array.from(arr).sort((a, b) => a - b);
    return {
      mean: +(sorted.reduce((x, y) => x + y, 0) / N).toFixed(2),
      lo: quantile(sorted, 0.025),
      hi: quantile(sorted, 0.975),
      p: +(sorted.filter(x => x >= seen).length / N).toFixed(4),
    };
  };
  const a = read(all, hits);
  const b = read(fresh, newHits);
  return {hits, ...a, newHits, newMean: b.mean, newLo: b.lo, newHi: b.hi, newP: b.p};
}

// ------------------------------------------------------------------- the same word, with and without the edit

/**
 * The check's within-word comparison: over words read both with and without an edit, the share
 * marked each way and the mean difference within a word, in points, with an interval that
 * resamples texts.
 * @param {{word: string, text: string, edit: boolean, y: 0|1}[]} items
 */
export function withinWord(items, {boot = 3000, rand}) {
  const byWord = new Map();
  for (const it of items) {
    if (!byWord.has(it.word)) byWord.set(it.word, []);
    byWord.get(it.word).push(it);
  }
  const pairs = [];
  for (const [word, list] of byWord) {
    const e = list.filter(x => x.edit);
    const n = list.filter(x => !x.edit);
    if (e.length && n.length) pairs.push({word, text: list[0].text, e, n});
  }
  const sum = l => l.reduce((a, x) => a + x.y, 0);
  const diff = list => {
    let d = 0;
    for (const p of list) d += sum(p.e) / p.e.length - sum(p.n) / p.n.length;
    return list.length ? (100 * d) / list.length : NaN;
  };
  const allE = pairs.flatMap(p => p.e);
  const allN = pairs.flatMap(p => p.n);
  const texts = [...new Set(pairs.map(p => p.text))];
  const byText = new Map(texts.map(t => [t, pairs.filter(p => p.text === t)]));
  const vals = [];
  for (let b = 0; b < boot; b++) {
    const pick = [];
    for (let i = 0; i < texts.length; i++) pick.push(...byText.get(texts[Math.floor(rand() * texts.length)]));
    const v = diff(pick);
    if (Number.isFinite(v)) vals.push(v);
  }
  vals.sort((x, y) => x - y);
  return {
    words: pairs.length,
    texts: texts.length,
    withEdit: sum(allE),
    withEditOf: allE.length,
    without: sum(allN),
    withoutOf: allN.length,
    difference: +diff(pairs).toFixed(1),
    ci: vals.length ? {lo: +quantile(vals, 0.025).toFixed(1), hi: +quantile(vals, 0.975).toFixed(1)} : null,
  };
}

// ------------------------------------------------------------------- model runs

/**
 * What a chain costs on a condition, from its eval rows, as tables.mjs's perMinute reads it:
 * distinct judge slices plus the runs each cancel check adds. `learnerFrom(id)` is when a take's
 * learner stretch may wake the judge: the lead-in never does here, so a second rate reads only
 * the audio from there on, and only the checks of marks on that stretch.
 */
export function chainCost(rows, chain, learnerFrom) {
  const key = chain.split('.')[0].replace(/^N/, 'S');
  const wakeKey = key === 'J' ? null : key;
  let seconds = 0;
  let learnerSeconds = 0;
  let wakes = 0;
  let slices = 0;
  let extra = 0;
  let extraLearner = 0;
  let suspects = 0;
  for (const r of rows) {
    const from = learnerFrom(r.id);
    seconds += r.seconds;
    learnerSeconds += r.seconds - Math.max(0, from);
    if (wakeKey) {
      wakes += r.wakes[wakeKey]?.wakes ?? 0;
      slices += r.wakes[wakeKey]?.slices ?? 0;
    }
    const app = r.cfg[chain].app;
    suspects += app.suspects;
    for (const c of app.checks) {
      extra += c.x;
      if (c.t >= from) extraLearner += c.x;
    }
  }
  const per = (n, s) => +((60 * n) / s).toFixed(2);
  return {
    minutes: +(seconds / 60).toFixed(1),
    learnerMinutes: +(learnerSeconds / 60).toFixed(1),
    wakes,
    slices,
    extra,
    extraLearner,
    suspects,
    runs: slices + extra,
    runsLearner: slices + extraLearner,
    runsPerMinute: per(slices + extra, seconds),
    runsPerLearnerMinute: per(slices + extraLearner, learnerSeconds),
    atMostPerMinute: per(slices + suspects, seconds),
  };
}

// ------------------------------------------------------------------- the queue

/** The jobs of the suites in order: a suite's chains need both of its holds. */
export function jobsOf(names) {
  return names.flatMap(s => [
    {id: `${s}:h48`, args: ['learners_built_judge_rows.mjs', '--suite', s, '--hold', '0.48'], after: []},
    {id: `${s}:h0`, args: ['learners_built_judge_rows.mjs', '--suite', s, '--hold', '0'], after: []},
    {id: `${s}:eval`, args: ['learners_built_eval_marks.mjs', '--suite', s], after: [`${s}:h48`, `${s}:h0`]},
  ]);
}
