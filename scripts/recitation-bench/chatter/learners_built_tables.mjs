/* eslint-env node, es2020 */
// Every number of .out/chatter/learners_built/report.md, from this job's marks and rows, the
// first test's rows and report.json, and the frozen QuranMB results. Loads no model. Writes
// .out/chatter/learners_built/tables.json.
//   node chatter/learners_built_tables.mjs [--boot 2000] [--shuffles 10000]
import fs from 'node:fs';
import path from 'node:path';
import {answer} from '../judge/policy.mjs';
import {labelOf} from '../../second-look/quranmb_labels.mjs';
import {BENCH, CONDS, LEARNERS, OUT, cursorSuiteOf, rowFile, suiteOf} from './learners_built_lib.mjs';
import {
  CLEAN_MARKS,
  MANIFEST,
  learnerSegment,
  loadClips,
  mulberry,
  readJson,
  readJsonl,
  segmentErrors,
  segmentOdds,
  speakerOf,
} from './learners_lib.mjs';
import {
  chainCost,
  ci,
  div,
  editKinds,
  lengthClass,
  makeDraws,
  oneWayDrawer,
  othersChanged,
  productDrawer,
  reachChance,
  readRowsText,
  readersOfTexts,
  shuffleChance,
  sub,
  sumOver,
  twoWayInterval,
  withinWord,
} from './learners_built_stats.mjs';

const arg = name => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const BOOT = Number(arg('boot') ?? 2000);
const SHUFFLES = Number(arg('shuffles') ?? 10000);
const STANDIN_SUITE = 'lb_parity';

// The chains asked for, in the order of the report, and the older rules beside them.
export const CHAINS = ['J.none', 'J.P1', 'S1.P3', 'S2.P4', 'S1h0.P3', 'N1.P3', 'S1.P3s'];
const OLDER = ['B', 'C'];
const SHOWN = [...CHAINS, ...OLDER];
const REFERENCE = 'S1.P3';
const ON = new Set(['hit', 'near', 'false-incorrect', 'false-correct']);
const LABEL_TESTS = {
  hit: r => r.label === 'hit',
  near: r => r.label === 'near',
  'false-incorrect': r => r.label === 'false-incorrect',
  'false-correct': r => r.label === 'false-correct',
  false: r => r.label === 'false-incorrect' || r.label === 'false-correct',
};
const pct = (a, b) => (b ? +((100 * a) / b).toFixed(1) : null);
const round = (x, d = 3) => (x === null || x === undefined || !Number.isFinite(x) ? null : +x.toFixed(d));
const point = (x, d = 3) => round(x, d);

// ------------------------------------------------------------------- takes and words

const clips = loadClips();
const allManifest = readJson(MANIFEST);
const speakers = [...new Set(clips.map(c => speakerOf(c.id)))].sort();
const spkIndex = new Map(speakers.map((s, i) => [s, i]));
const wordmap = readJson(path.join(BENCH, '.out/takes/wordmap.json'));
const split = wordmap.engineToManifest ?? {};
const toManifest = (s, a, w) => split[`${s}:${a}`]?.[w] ?? w + 1;
const index = readJson(path.join(BENCH, '.out/natural/judge/index.json'));

const wordKeys = new Map();
const tableMap = new Map();
const takes = new Map();
const textClasses = new Map();
for (const c of clips) {
  const seg = learnerSegment(c);
  const o = segmentOdds(seg);
  const si = spkIndex.get(speakerOf(c.id));
  for (const k of o.keys) {
    const wk = `${seg.surah}:${k}`;
    if (!wordKeys.has(wk)) wordKeys.set(wk, wordKeys.size);
    const wi = wordKeys.get(wk);
    const key = `${si}|${wi}|${c.label}|${c.weight}`;
    const row = tableMap.get(key) ?? {si, wi, n: 0, label: c.label, weight: c.weight};
    row.n += 1;
    tableMap.set(key, row);
  }
  const text = `${seg.surah}|${o.keys.join(',')}`;
  if (!textClasses.has(text)) {
    textClasses.set(
      text,
      o.keys.map(k => {
        const [a, w] = k.split(':').map(Number);
        const row = index.ayat[`${seg.surah}:${a}`]?.[w - 1];
        return lengthClass(row ? [...row.l].length : null);
      }),
    );
  }
  takes.set(c.id, {
    id: c.id,
    clip: c,
    seg,
    speaker: speakerOf(c.id),
    si,
    weight: c.weight,
    stratum: c.stratum,
    words: o.keys,
    wk: o.keys.map(k => `${seg.surah}:${k}`),
    errors: o.errors,
    kinds: editKinds(seg),
    text,
    seconds: c.seconds,
    from: Math.min(...c.segments.filter(g => !g.lead).map(g => g.start)) - 2,
  });
}
const table = [...tableMap.values()];
const nS = speakers.length;
const nW = wordKeys.size;
const listWords = table.reduce((n, r) => n + r.n, 0);
const wholeWords = table.reduce((n, r) => n + r.n * r.weight, 0);
const readers = readersOfTexts(
  allManifest.map(c => {
    const seg = learnerSegment(c);
    return {speaker: speakerOf(c.id), seg, errors: segmentErrors(seg)};
  }),
);

// The same draws as learners_report.mjs: same seed, same order.
const draws = makeDraws(nS, nW, BOOT, mulberry(20261107));
const product = productDrawer(draws);
const wordsWith = drawer => {
  const list = new Float64Array(drawer.boot);
  const whole = new Float64Array(drawer.boot);
  for (const r of table) {
    const w = drawer.wOf(r.si, r.wi);
    for (let b = 0; b < drawer.boot; b++) {
      list[b] += w[b] * r.n;
      whole[b] += w[b] * r.n * r.weight;
    }
  }
  return {list, whole};
};
const words = wordsWith(product);
const wt = r => r.weight;

// ------------------------------------------------------------------- marks

const evalFile = suite => path.join(OUT, 'marks', `${suite}.jsonl`);
const done = CONDS.filter(c => {
  const f = evalFile(suiteOf(c));
  return fs.existsSync(f) && readJsonl(f).length === clips.length;
});
const evalRows = new Map(done.map(c => [c, readJsonl(evalFile(suiteOf(c)))]));
const oldRows = new Map(done.map(c => [c, readJsonl(path.join(LEARNERS, `rows.${c}.jsonl`))]));

const cleanLabel = new Map();
for (const r of evalRows.get('none_0')) {
  const t = takes.get(r.id);
  for (const m of r.cfg['J.none'].app.shown) {
    const l = labelOf(t.clip.segments, m.id, m.s);
    if (ON.has(l)) cleanLabel.set(`${r.id}|${m.id}`, l);
  }
}

const enriched = new Map();
/** One labelled mark, with all that any table reads from it. Rows are shared across chains. */
function enrich(run, id, label) {
  const key = `${run}|${id}|${label}`;
  let e = enriched.get(key);
  if (e) return e;
  const t = takes.get(run);
  const [s, a, w] = id.split(':').map(Number);
  const k = `${a}:${toManifest(s, a, w)}`;
  const word = `${s}:${k}`;
  const wi = wordKeys.get(word);
  if (wi === undefined) throw new Error(`mark on a word outside its segment: ${key}`);
  const i = t.words.indexOf(k);
  const kind = t.kinds.get(k);
  const clean = cleanLabel.get(`${run}|${id}`) ?? null;
  e = {
    run,
    id,
    k,
    word,
    label,
    si: t.si,
    wi,
    weight: t.weight,
    stratum: t.stratum,
    i,
    words: t.words,
    errors: t.errors,
    text: t.text,
    segLabel: t.seg.label,
    clean,
    isNew: !clean,
    edit: kind ? (kind.vowelOnly ? 'vowels' : 'consonant') : null,
    othersChanged: othersChanged(readers, t.seg, t.speaker, k),
    pReach: i >= 0 ? reachChance({i, words: t.words, errors: t.errors}) : 0,
  };
  enriched.set(key, e);
  return e;
}

/** A chain's marks on one condition's learner words: base, those kept, those it added. */
function groupsOf(cond, chain, rowsOf = evalRows.get(cond)) {
  if (chain === 'A' || OLDER.includes(chain)) {
    const rows = oldRows.get(cond).filter(r => ON.has(r.label));
    const base = rows.map(r => enrich(r.clip, r.id, r.label));
    const kept = rows.filter(r => r.rules[chain] === 'keep').map(r => enrich(r.clip, r.id, r.label));
    return {base, kept, added: []};
  }
  const base = [];
  const kept = [];
  const added = [];
  for (const r of rowsOf) {
    const t = takes.get(r.id);
    const baseHere = new Map();
    for (const m of r.cfg['J.none'].app.shown) {
      const l = labelOf(t.clip.segments, m.id, m.s);
      baseHere.set(m.id, l);
      if (ON.has(l)) base.push(enrich(r.id, m.id, l));
    }
    for (const m of r.cfg[chain].app.shown) {
      const b = baseHere.get(m.id);
      if (b !== undefined && ON.has(b)) {
        kept.push(enrich(r.id, m.id, b));
      } else if (b === undefined) {
        const l = labelOf(t.clip.segments, m.id, m.s);
        if (ON.has(l)) added.push(enrich(r.id, m.id, l));
      }
    }
  }
  return {base, kept, added};
}

const groups = new Map();
for (const c of done) for (const ch of ['A', ...SHOWN]) groups.set(`${c}|${ch}`, groupsOf(c, ch));

const VOICES = done.filter(c => c !== 'none_0');
const SETS = {
  ...Object.fromEntries(done.map(c => [c, [c]])),
  'six voices': VOICES,
  '10 dB': VOICES.filter(c => c.endsWith('_10')),
  '5 dB': VOICES.filter(c => c.endsWith('_5')),
};
const POOLS = ['six voices', '10 dB', '5 dB'];
const merged = (set, chain) => {
  const out = {base: [], kept: [], added: []};
  for (const c of SETS[set]) {
    const g = groups.get(`${c}|${chain}`);
    out.base.push(...g.base);
    out.kept.push(...g.kept);
    out.added.push(...g.added);
  }
  return out;
};

// ------------------------------------------------------------------- counts, rates, shares

/** Whether the pooled sets' word denominators count once per condition. */
const wordFactor = set => SETS[set].length;

function labelEntry(g, test, set) {
  const base = g.base.filter(test);
  const kept = g.kept.filter(test);
  const added = g.added.filter(test);
  const shown = [...kept, ...added];
  const whole = list => list.reduce((n, r) => n + r.weight, 0);
  const f = wordFactor(set);
  const shownWhole = sumOver(shown, product, wt);
  return {
    kept: kept.length,
    of: base.length,
    added: added.length,
    shown: shown.length,
    shareList: pct(kept.length, base.length),
    shareWhole: pct(whole(kept), whole(base)),
    shareWholeCi: ci(div(sumOver(kept, product, wt), sumOver(base, product, wt), 100)),
    per1000List: point((1000 * shown.length) / (listWords * f)),
    per1000ListCi: ci(
      div(
        sumOver(shown, product),
        words.list.map(x => x * f),
        1000,
      ),
    ),
    per1000Whole: point((1000 * whole(shown)) / (wholeWords * f)),
    per1000WholeCi: ci(
      div(
        shownWhole,
        words.whole.map(x => x * f),
        1000,
      ),
    ),
    keptPer1000Whole: point((1000 * whole(kept)) / (wholeWords * f)),
    differentWords: new Set(shown.map(r => r.word)).size,
    differentReaders: new Set(shown.map(r => r.si)).size,
    mostFromOneReader: Math.max(0, ...Object.values(shown.reduce((m, r) => ({...m, [r.si]: (m[r.si] ?? 0) + 1}), {}))),
  };
}

const T = {
  meta: {
    boot: BOOT,
    shuffles: SHUFFLES,
    takes: clips.length,
    speakers: nS,
    differentWords: nW,
    listWords,
    wholeWords: round(wholeWords, 1),
    conditions: done,
    notRun: CONDS.filter(c => !done.includes(c)),
    chains: SHOWN,
    at: new Date().toISOString(),
  },
  sets: {},
  differences: {},
  chance: {},
  split: {},
  within: {},
  cost: {},
  checks: {},
};

for (const set of Object.keys(SETS)) {
  T.sets[set] = {};
  for (const chain of ['A', ...SHOWN]) {
    const g = merged(set, chain);
    const entry = {};
    for (const [name, test] of Object.entries(LABEL_TESTS)) entry[name] = labelEntry(g, test, set);
    T.sets[set][chain] = entry;
  }
}

// All chains, counts only, for anyone who wants a chain not listed here.
T.allChains = {};
for (const c of done) {
  const rows = evalRows.get(c);
  T.allChains[c] = {};
  for (const chain of Object.keys(rows[0].cfg)) {
    const g = groupsOf(c, chain, rows);
    T.allChains[c][chain] = Object.fromEntries(
      ['hit', 'near', 'false-incorrect', 'false-correct'].map(l => {
        const test = LABEL_TESTS[l];
        return [l, {kept: g.kept.filter(test).length, of: g.base.filter(test).length, added: g.added.filter(test).length}];
      }),
    );
  }
}

// ------------------------------------------------------------------- differences from S1.P3

/**
 * The draws behind a set's chain: shares of the base kept, on the whole set, and rates of what
 * it shows, per 1,000 words on the whole set.
 */
function claims(g, drawer, wordsWhole, f) {
  const hitsBase = g.base.filter(LABEL_TESTS.hit);
  const falseBase = g.base.filter(LABEL_TESTS.false);
  const nearBase = g.base.filter(LABEL_TESTS.near);
  const hitsKept = g.kept.filter(LABEL_TESTS.hit);
  const falseKept = g.kept.filter(LABEL_TESTS.false);
  const nearKept = g.kept.filter(LABEL_TESTS.near);
  const hitsShown = [...hitsKept, ...g.added.filter(LABEL_TESTS.hit)];
  const falseShown = [...falseKept, ...g.added.filter(LABEL_TESTS.false)];
  const nearShown = [...nearKept, ...g.added.filter(LABEL_TESTS.near)];
  const share = (kept, base) => div(sumOver(kept, drawer, wt), sumOver(base, drawer, wt), 100);
  const rate = shown => div(sumOver(shown, drawer, wt), wordsWhole.map(x => x * f), 1000);
  const hitShare = share(hitsKept, hitsBase);
  const falseShare = share(falseKept, falseBase);
  const newHit = r => r.clean !== 'hit';
  const newFalse = r => !r.clean;
  const newHitShare = share(hitsKept.filter(newHit), hitsBase.filter(newHit));
  const newFalseShare = share(falseKept.filter(newFalse), falseBase.filter(newFalse));
  return {
    hitShare,
    falseShare,
    nearShare: share(nearKept, nearBase),
    separation: sub(hitShare, falseShare),
    hitRate: rate(hitsShown),
    falseRate: rate(falseShown),
    nearRate: rate(nearShown),
    newHitShare,
    newFalseShare,
    newSeparation: sub(newHitShare, newFalseShare),
  };
}
const pointsOf = g => {
  const whole = list => list.reduce((n, r) => n + r.weight, 0);
  const share = (kept, base) => (whole(base) ? (100 * whole(kept)) / whole(base) : NaN);
  const f = LABEL_TESTS;
  const hitsBase = g.base.filter(f.hit);
  const falseBase = g.base.filter(f.false);
  const hitsKept = g.kept.filter(f.hit);
  const falseKept = g.kept.filter(f.false);
  const newHit = r => r.clean !== 'hit';
  const newFalse = r => !r.clean;
  const hitShare = share(hitsKept, hitsBase);
  const falseShare = share(falseKept, falseBase);
  const newHitShare = share(hitsKept.filter(newHit), hitsBase.filter(newHit));
  const newFalseShare = share(falseKept.filter(newFalse), falseBase.filter(newFalse));
  return {
    hitShare,
    falseShare,
    nearShare: share(g.kept.filter(f.near), g.base.filter(f.near)),
    separation: hitShare - falseShare,
    hitRate: whole([...hitsKept, ...g.added.filter(f.hit)]),
    falseRate: whole([...falseKept, ...g.added.filter(f.false)]),
    nearRate: whole([...g.kept.filter(f.near), ...g.added.filter(f.near)]),
    newHitShare,
    newFalseShare,
    newSeparation: newHitShare - newFalseShare,
  };
};
const RATE_CLAIMS = new Set(['hitRate', 'falseRate', 'nearRate']);
const pointClaims = (g, f) => {
  const p = pointsOf(g);
  for (const k of RATE_CLAIMS) p[k] = (1000 * p[k]) / (wholeWords * f);
  return p;
};

// Plain two-way: one-way draws of speakers, words and cells, for the pooled differences only.
const cellIndex = new Map();
for (const r of table) {
  const key = r.si * 100000 + r.wi;
  if (!cellIndex.has(key)) cellIndex.set(key, cellIndex.size);
}
const oneWay = Object.fromEntries(
  [
    ['speakers', 91],
    ['words', 92],
    ['cells', 93],
  ].map(([kind, seed]) => {
    const drawer = oneWayDrawer(kind, {nS, nW, boot: BOOT, cells: cellIndex, rand: mulberry(seed)});
    return [kind, {drawer, words: wordsWith(drawer)}];
  }),
);

for (const set of Object.keys(SETS)) {
  const f = wordFactor(set);
  const pools = POOLS.includes(set);
  const product_ = Object.fromEntries(SHOWN.map(ch => [ch, claims(merged(set, ch), product, words.whole, f)]));
  const points = Object.fromEntries(SHOWN.map(ch => [ch, pointClaims(merged(set, ch), f)]));
  const ways = pools
    ? Object.fromEntries(
        Object.entries(oneWay).map(([kind, {drawer, words: w}]) => [
          kind,
          Object.fromEntries(SHOWN.map(ch => [ch, claims(merged(set, ch), drawer, w.whole, f)])),
        ]),
      )
    : null;
  const out = {own: {}, fromReference: {}};
  for (const ch of SHOWN) {
    out.own[ch] = {};
    for (const name of Object.keys(points[ch])) {
      out.own[ch][name] = {point: point(points[ch][name], 3), ci: ci(product_[ch][name])};
      if (ways) {
        out.own[ch][name].twoWay = twoWayInterval(
          points[ch][name],
          ways.speakers[ch][name],
          ways.words[ch][name],
          ways.cells[ch][name],
        );
      }
    }
    if (ch === REFERENCE) continue;
    out.fromReference[ch] = {};
    for (const name of Object.keys(points[ch])) {
      const d = points[ch][name] - points[REFERENCE][name];
      out.fromReference[ch][name] = {point: point(d, 3), ci: ci(sub(product_[ch][name], product_[REFERENCE][name]))};
      if (ways) {
        out.fromReference[ch][name].twoWay = twoWayInterval(
          d,
          sub(ways.speakers[ch][name], ways.speakers[REFERENCE][name]),
          sub(ways.words[ch][name], ways.words[REFERENCE][name]),
          sub(ways.cells[ch][name], ways.cells[REFERENCE][name]),
        );
      }
    }
  }
  T.differences[set] = out;
}

// ------------------------------------------------------------------- hits against chance

const onIncorrect = g => [...g.kept, ...g.added].filter(r => r.segLabel === 'incorrect');
const classOf = text => textClasses.get(text);
let seed = 4242;
for (const set of Object.keys(SETS)) {
  T.chance[set] = {};
  for (const chain of ['A', ...SHOWN]) {
    const rows = onIncorrect(merged(set, chain));
    const plain = shuffleChance(rows, {N: SHUFFLES, rand: mulberry(seed++)});
    const sameLength = shuffleChance(rows, {N: SHUFFLES, rand: mulberry(seed++), classOf});
    const hitsWhole = rows.filter(LABEL_TESTS.hit);
    const h = hitsWhole.reduce((n, r) => n + r.weight, 0);
    const e = rows.reduce((n, r) => n + r.weight * r.pReach, 0);
    const excess = sub(sumOver(hitsWhole, product, wt), sumOver(rows, product, r => r.weight * r.pReach));
    T.chance[set][chain] = {
      marks: rows.length,
      ...plain,
      sameLengthMean: sameLength.mean,
      sameLengthLo: sameLength.lo,
      sameLengthHi: sameLength.hi,
      sameLengthP: sameLength.p,
      sameLengthNewMean: sameLength.newMean,
      sameLengthNewP: sameLength.newP,
      wholeHits: round(h, 1),
      wholeChance: round(e, 1),
      wholeExcessCi: ci(excess),
    };
  }
}

// ------------------------------------------------------------------- what kind of word

for (const set of Object.keys(SETS)) {
  T.split[set] = {};
  for (const chain of ['A', ...SHOWN]) {
    const g = merged(set, chain);
    const part = (test, from) => ({
      kept: g.kept.filter(from).filter(test).length,
      of: g.base.filter(from).filter(test).length,
      added: g.added.filter(from).filter(test).length,
    });
    T.split[set][chain] = {
      hitConsonant: part(r => r.edit === 'consonant', LABEL_TESTS.hit),
      hitVowels: part(r => r.edit === 'vowels', LABEL_TESTS.hit),
      hitNoEditKind: part(r => r.edit === null, LABEL_TESTS.hit),
      falseOthersChanged: part(r => r.othersChanged, LABEL_TESTS.false),
      falseNobodyChanged: part(r => !r.othersChanged, LABEL_TESTS.false),
      survivingHits: part(r => r.clean === 'hit', LABEL_TESTS.hit),
      newHits: part(r => r.clean !== 'hit', LABEL_TESTS.hit),
      cleanFalse: part(r => !!r.clean, LABEL_TESTS.false),
      newFalse: part(r => !r.clean, LABEL_TESTS.false),
    };
  }
}

// ------------------------------------------------------------------- the same word, with and without the edit

const dsu = new Map();
const find = x => {
  if (!dsu.has(x)) dsu.set(x, x);
  let r = x;
  while (dsu.get(r) !== r) r = dsu.get(r);
  dsu.set(x, r);
  return r;
};
for (const t of takes.values()) for (const k of t.wk) dsu.set(find(t.wk[0]), find(k));
const sampled = [...takes.values()].filter(t => t.stratum === 'sample');
let withinSeed = 777;
for (const set of POOLS) {
  T.within[set] = {};
  for (const chain of ['A', ...SHOWN]) {
    const items = [];
    for (const c of SETS[set]) {
      const g = groups.get(`${c}|${chain}`);
      const marked = new Set([...g.kept, ...g.added].map(r => `${r.run}|${r.k}`));
      for (const t of sampled) {
        t.words.slice(0, Math.max(0, t.words.length - 2)).forEach((k, i) => {
          items.push({
            word: t.wk[i],
            text: find(t.wk[i]),
            edit: t.errors.has(k),
            y: marked.has(`${t.id}|${k}`) ? 1 : 0,
          });
        });
      }
    }
    T.within[set][chain] = withinWord(items, {boot: 3000, rand: mulberry(withinSeed++)});
  }
}

// Clean audio on all 1,607 takes: the frozen file holds every chain there, on stand-in slices.
const frozenAll = readJsonl(path.join(BENCH, '.out/second-look/marks/quranmb.jsonl'));
{
  const manifestById = new Map(allManifest.map(c => [c.id, c]));
  T.within['clean, all 1,607 takes, stand-in slices'] = {};
  for (const chain of CHAINS) {
    const items = [];
    for (const r of frozenAll) {
      const c = manifestById.get(r.id);
      const seg = learnerSegment(c);
      const o = segmentOdds(seg);
      const marked = new Set();
      for (const m of r.cfg[chain].app.shown) {
        if (!ON.has(labelOf(c.segments, m.id, m.s))) continue;
        const [s, a, w] = m.id.split(':').map(Number);
        marked.add(`${a}:${toManifest(s, a, w)}`);
      }
      o.keys.slice(0, Math.max(0, o.keys.length - 2)).forEach(k => {
        items.push({
          word: `${seg.surah}:${k}`,
          text: `${seg.surah}:${k.split(':')[0]}`,
          edit: o.errors.has(k),
          y: marked.has(k) ? 1 : 0,
        });
      });
    }
    T.within['clean, all 1,607 takes, stand-in slices'][chain] = withinWord(items, {boot: 3000, rand: mulberry(withinSeed++)});
  }
  // How well the list's weights estimate the whole set, where the whole set is known.
  const fullWords = allManifest.reduce((n, c) => n + segmentOdds(learnerSegment(c)).keys.length, 0);
  const label = (r, m) => labelOf(manifestById.get(r.id).segments, m.id, m.s);
  const standin = readJsonl(evalFile(STANDIN_SUITE));
  T.weightsCheck = {fullWords, listWholeWords: round(wholeWords, 1), chains: {}};
  for (const chain of CHAINS) {
    const count = rows => {
      const out = {hit: 0, near: 0, false: 0, hitW: 0, nearW: 0, falseW: 0};
      for (const r of rows) {
        const w = takes.get(r.id)?.weight ?? 1;
        for (const m of r.cfg[chain].app.shown) {
          const l = label(r, m);
          if (l === 'hit' || l === 'near') {
            out[l] += 1;
            out[`${l}W`] += w;
          } else if (l === 'false-incorrect' || l === 'false-correct') {
            out.false += 1;
            out.falseW += w;
          }
        }
      }
      return out;
    };
    const full = count(frozenAll);
    const list = count(standin);
    T.weightsCheck.chains[chain] = {
      trueHits: full.hit,
      trueNear: full.near,
      trueFalse: full.false,
      estimatedHits: round(list.hitW, 1),
      estimatedNear: round(list.nearW, 1),
      estimatedFalse: round(list.falseW, 1),
      truePer1000: {hit: point((1000 * full.hit) / fullWords), false: point((1000 * full.false) / fullWords)},
      estimatedPer1000: {hit: point((1000 * list.hitW) / wholeWords), false: point((1000 * list.falseW) / wholeWords)},
    };
  }
}

// ------------------------------------------------------------------- slices from the cursor alone

// The same chains with the tracker's frames hidden: how far the results lean on frames read from
// the end of the take. The frozen QuranMB table was made this way, because its runs hold no frames.
{
  const cursorDone = done.filter(c => {
    const f = evalFile(cursorSuiteOf(c));
    return fs.existsSync(f) && readJsonl(f).length === clips.length;
  });
  T.cursor = {conditions: cursorDone, sets: {}};
  if (cursorDone.length) {
    const cg = new Map();
    for (const c of cursorDone) {
      const rows = readJsonl(evalFile(cursorSuiteOf(c)));
      for (const ch of CHAINS) cg.set(`${c}|${ch}`, groupsOf(c, ch, rows));
    }
    const cursorMerged = (set, chain) => {
      const out = {base: [], kept: [], added: []};
      for (const c of SETS[set]) {
        const g = cg.get(`${c}|${chain}`);
        if (!g) return null;
        out.base.push(...g.base);
        out.kept.push(...g.kept);
        out.added.push(...g.added);
      }
      return out;
    };
    for (const set of Object.keys(SETS)) {
      if (!SETS[set].every(c => cursorDone.includes(c))) continue;
      const f = wordFactor(set);
      T.cursor.sets[set] = {};
      const claimsOf = Object.fromEntries(CHAINS.map(ch => [ch, claims(cursorMerged(set, ch), product, words.whole, f)]));
      const pointsOfSet = Object.fromEntries(CHAINS.map(ch => [ch, pointClaims(cursorMerged(set, ch), f)]));
      for (const ch of CHAINS) {
        const g = cursorMerged(set, ch);
        const entry = {};
        for (const name of ['hit', 'near', 'false']) {
          const test = LABEL_TESTS[name];
          entry[name] = {kept: g.kept.filter(test).length, of: g.base.filter(test).length, added: g.added.filter(test).length};
        }
        entry.hitRate = {point: point(pointsOfSet[ch].hitRate), ci: ci(claimsOf[ch].hitRate)};
        entry.falseRate = {point: point(pointsOfSet[ch].falseRate), ci: ci(claimsOf[ch].falseRate)};
        const frames = claims(merged(set, ch), product, words.whole, f);
        const framesPoint = pointClaims(merged(set, ch), f);
        entry.minusFrames = {
          hitRate: {point: point(pointsOfSet[ch].hitRate - framesPoint.hitRate), ci: ci(sub(claimsOf[ch].hitRate, frames.hitRate))},
          falseRate: {point: point(pointsOfSet[ch].falseRate - framesPoint.falseRate), ci: ci(sub(claimsOf[ch].falseRate, frames.falseRate))},
        };
        if (ch !== REFERENCE) {
          entry.minusReference = {
            hitRate: {point: point(pointsOfSet[ch].hitRate - pointsOfSet[REFERENCE].hitRate), ci: ci(sub(claimsOf[ch].hitRate, claimsOf[REFERENCE].hitRate))},
            falseRate: {point: point(pointsOfSet[ch].falseRate - pointsOfSet[REFERENCE].falseRate), ci: ci(sub(claimsOf[ch].falseRate, claimsOf[REFERENCE].falseRate))},
            hitShare: {point: point(pointsOfSet[ch].hitShare - pointsOfSet[REFERENCE].hitShare, 1), ci: ci(sub(claimsOf[ch].hitShare, claimsOf[REFERENCE].hitShare))},
            falseShare: {point: point(pointsOfSet[ch].falseShare - pointsOfSet[REFERENCE].falseShare, 1), ci: ci(sub(claimsOf[ch].falseShare, claimsOf[REFERENCE].falseShare))},
          };
        }
        T.cursor.sets[set][ch] = entry;
      }
    }
  }
}

// ------------------------------------------------------------------- what it cost here

const timing = readJsonl(path.join(OUT, 'timing.jsonl'));
const learnerFrom = id => takes.get(id).from;
for (const c of done) {
  const rows = evalRows.get(c);
  const lines = timing.filter(t => t.suite === suiteOf(c));
  const part = list => ({
    runs: list.reduce((n, t) => n + t.runs, 0),
    ortSeconds: +(list.reduce((n, t) => n + t.ortMs, 0) / 1000).toFixed(1),
    wallSeconds: +(list.reduce((n, t) => n + t.wallMs, 0) / 1000).toFixed(1),
    processes: list.length,
  });
  const rowsPart = lines.filter(t => t.tool === 'learners_built_judge_rows.mjs');
  const evalPart = lines.filter(t => t.tool === 'learners_built_eval_marks.mjs');
  const all = part(lines);
  const rp = part(rowsPart);
  T.cost[c] = {
    rows: rp,
    eval: part(evalPart),
    all,
    msPerRun: all.runs ? +((1000 * all.ortSeconds) / all.runs).toFixed(1) : null,
    msPerJudgeRun: rp.runs ? +((1000 * rp.ortSeconds) / rp.runs).toFixed(1) : null,
    chains: Object.fromEntries(CHAINS.map(ch => [ch, chainCost(rows, ch, learnerFrom)])),
  };
}

// ------------------------------------------------------------------- checks on this job's own reading

// The base here against the first test's rule A, the same follower runs through the older replay.
T.checks.baseAgainstRuleA = {};
for (const c of done) {
  const g = groups.get(`${c}|A`);
  const j = groups.get(`${c}|J.none`);
  const a = new Map(g.base.map(r => [`${r.run}|${r.id}`, r.label]));
  const b = new Map(j.base.map(r => [`${r.run}|${r.id}`, r.label]));
  const onlyA = {};
  const onlyJ = {};
  let labelDiffer = 0;
  for (const [k, l] of a) {
    if (!b.has(k)) onlyA[l] = (onlyA[l] ?? 0) + 1;
    else if (b.get(k) !== l) labelDiffer += 1;
  }
  for (const [k, l] of b) if (!a.has(k)) onlyJ[l] = (onlyJ[l] ?? 0) + 1;
  T.checks.baseAgainstRuleA[c] = {ruleA: a.size, jNone: b.size, onlyA, onlyJ, labelDiffer};
}

// The judge's rows here against the first test's rule D, which read the same slice on the same mix.
T.checks.rowsAgainstRuleD = {};
for (const c of done) {
  const mine = readRowsText(fs.readFileSync(rowFile(suiteOf(c), 0.48), 'utf8'));
  let compared = 0;
  let missing = 0;
  const missingBy = {};
  let sliceDiffer = 0;
  let scoreDiffer = 0;
  let worst = 0;
  for (const r of oldRows.get(c)) {
    if (!r.fit || r.fit.expected === null || !r.fit.frames) continue;
    const t = Math.round(r.lastBad * 100) / 100;
    const row = mine.get(`${r.clip}|${r.id}|${t}|live`);
    if (!row) {
      missing += 1;
      missingBy[r.label] = (missingBy[r.label] ?? 0) + 1;
      continue;
    }
    compared += 1;
    if (Math.abs(row.slice[0] - r.fit.from) > 0.0051 || Math.abs(row.slice[1] - r.fit.to) > 0.0051) sliceDiffer += 1;
    const d = Math.abs(row.r.expected - r.fit.expected);
    worst = Math.max(worst, d);
    if (d > 0.002) scoreDiffer += 1;
  }
  T.checks.rowsAgainstRuleD[c] = {compared, missing, missingBy, sliceDiffer, scoreDiffer, worstScoreDifference: +worst.toFixed(4)};
}

// The older rules' figures here against report.json: same rows, same draws, so they must match.
{
  const report = readJson(path.join(LEARNERS, 'report.json'));
  const by = new Map(report.results.map(r => [r.cond.replace(':', '_'), r]));
  const differ = [];
  let cells = 0;
  for (const c of done) {
    for (const rule of OLDER) {
      for (const name of Object.keys(LABEL_TESTS)) {
        const a = by.get(c).rules[rule][name];
        const b = T.sets[c][rule][name];
        const pairs = [
          ['kept', a.kept, b.kept],
          ['of', a.of, b.of],
          ['wholeSet', a.wholeSet, b.per1000Whole],
          ['wholeSetLo', a.wholeSetCi?.lo, b.per1000WholeCi?.lo],
          ['wholeSetHi', a.wholeSetCi?.hi, b.per1000WholeCi?.hi],
          ['per1000', a.per1000, b.per1000List],
          ['per1000Lo', a.per1000Ci?.lo, b.per1000ListCi?.lo],
          ['per1000Hi', a.per1000Ci?.hi, b.per1000ListCi?.hi],
        ];
        for (const [what, x, y] of pairs) {
          cells += 1;
          if (x !== y) differ.push(`${c} ${rule} ${name} ${what}: ${x} against ${y}`);
        }
      }
    }
  }
  T.checks.olderAgainstReport = {cells, differ: differ.length, examples: differ.slice(0, 8)};
}

// This job's edit kinds against the classes the first test stored on its rows.
{
  let same = 0;
  const differ = [];
  for (const c of done) {
    for (const r of oldRows.get(c)) {
      if (r.label !== 'hit' || !r.errorClasses) continue;
      const stored = r.errorClasses.includes('=vowel-only') ? 'vowels' : 'consonant';
      const here = enrich(r.clip, r.id, r.label).edit;
      if (stored === here) same += 1;
      else differ.push(`${c} ${r.clip} ${r.id}: stored ${stored}, here ${here}`);
    }
  }
  T.checks.editKinds = {same, differ: differ.length, examples: differ.slice(0, 5)};
}

// Where tracker frames move the judge's slices on clean audio, against the frozen rows.
{
  const list = new Set(clips.map(c => c.id));
  const frozen = readRowsText(fs.readFileSync(path.join(BENCH, '.out/second-look/rows/quranmb.h48.jsonl'), 'utf8'), list);
  const mine = readRowsText(fs.readFileSync(rowFile(suiteOf('none_0'), 0.48), 'utf8'), list);
  const P = {mut: 3, altFit: 1, near: 99, fit: 2, absent: 10};
  const starts = [];
  const ends = [];
  const moved = {};
  let same = 0;
  let sliceMoved = 0;
  for (const [k, a] of frozen) {
    const b = mine.get(k);
    if (!b) continue;
    starts.push(b.slice[0] - a.slice[0]);
    ends.push(b.slice[1] - a.slice[1]);
    if (a.slice[0] !== b.slice[0] || a.slice[1] !== b.slice[1]) sliceMoved += 1;
    const x = answer(a, P);
    const y = answer(b, P);
    if (x === y) same += 1;
    else moved[`${x} to ${y}`] = (moved[`${x} to ${y}`] ?? 0) + 1;
  }
  const at = (v, q) => [...v].sort((x, y) => x - y)[Math.min(v.length - 1, Math.floor(v.length * q))];
  T.checks.trackerFrames = {
    rows: starts.length,
    sliceMoved,
    answersSame: same,
    answersMoved: moved,
    startShift: {p10: round(at(starts, 0.1), 2), median: round(at(starts, 0.5), 2), p90: round(at(starts, 0.9), 2)},
    endShift: {p10: round(at(ends, 0.1), 2), median: round(at(ends, 0.5), 2), p90: round(at(ends, 0.9), 2)},
  };
}

// Stop flags: the cursor run of none_0 keeps them and the parity run does not; nothing else differs.
{
  const f = evalFile(cursorSuiteOf('none_0'));
  if (fs.existsSync(f)) {
    const a = new Map(readJsonl(evalFile(STANDIN_SUITE)).map(r => [r.id, r]));
    const chains = Object.keys(evalRows.get('none_0')[0].cfg);
    let takesDiffering = 0;
    for (const r of readJsonl(f)) {
      if (chains.some(c => JSON.stringify(a.get(r.id).cfg[c]) !== JSON.stringify(r.cfg[c]))) takesDiffering += 1;
    }
    T.checks.stopFlags = {takes: a.size, chains: chains.length, takesDiffering};
  }
}

// J.none on the clean marks of the baseline.
{
  const base = readJsonl(CLEAN_MARKS).filter(m => m.ds === 'quranmb' && takes.has(m.run) && ON.has(m.label));
  let same = 0;
  for (const m of base) if (cleanLabel.get(`${m.run}|${m.id}`) === m.label) same += 1;
  T.checks.cleanBase = {baseline: base.length, jNone: cleanLabel.size, same};
}

// The independent check's figures for the first test's marks, which this job's code must reproduce
// on those marks. Its shuffles and draws used other seeds, so its figures match within their noise.
{
  const CHECK = {
    allHits: {none_0: [66, 44.5], one_ar_10: [63, 39.7], crowd_10: [45, 23.9], rec_one_10: [40, 28.7], one_ar_5: [53, 37.3], crowd_5: [20, 12.5], rec_one_5: [35, 25.6], 'six voices': [256, 167.9]},
    newHits: {one_ar_10: [28, 18.9], crowd_10: [15, 10.7], rec_one_10: [18, 16.7], one_ar_5: [30, 23.9], crowd_5: [11, 8.3], rec_one_5: [21, 17.4], 'six voices': [123, 95.9]},
    ruleCHits: {none_0: [41, 19.3], one_ar_10: [38, 18.7], crowd_10: [25, 11.2], rec_one_10: [26, 13.8], one_ar_5: [35, 21.8], crowd_5: [16, 7.7], rec_one_5: [28, 17.9]},
    wholeSet: {
      A: {none_0: [8.0, 10.4], one_ar_10: [14.1, 17.4], crowd_10: [9.2, 16.0], rec_one_10: [9.3, 18.2], one_ar_5: [14.2, 28.3], crowd_5: [5.8, 15.9], rec_one_5: [9.7, 18.3]},
      B: {none_0: [2.7, 2.8], one_ar_10: [8.0, 6.9], crowd_10: [5.2, 6.6], rec_one_10: [5.4, 7.6], one_ar_5: [9.5, 16.1], crowd_5: [2.8, 7.7], rec_one_5: [6.3, 12.2]},
      C: {none_0: [5.0, 0.6], one_ar_10: [7.7, 4.2], crowd_10: [4.0, 2.5], rec_one_10: [5.9, 5.2], one_ar_5: [10.4, 11.6], crowd_5: [4.7, 5.2], rec_one_5: [7.5, 8.6]},
    },
    pooledShares: {B: {hit: [60, 41, 76], false: [50, 40, 61]}, C: {hit: [64, 50, 78], false: [33, 22, 44]}},
    within: {'six voices': [38, 510, 24, 456, 1.8], clean: [46, 726, 34, 878, 1.8]},
  };
  const rows = [];
  const add = (what, want, got, tolerance) =>
    rows.push({what, check: want, here: got, within: tolerance === undefined || got === null ? null : Math.abs(want - got) <= tolerance});
  for (const [set, [h, m]] of Object.entries(CHECK.allHits)) {
    if (!T.chance[set]) continue;
    add(`hits, ${set}`, h, T.chance[set].A.hits, 0);
    add(`shuffle mean, ${set}`, m, T.chance[set].A.mean, set === 'six voices' ? 2 : 1);
  }
  for (const [set, [h, m]] of Object.entries(CHECK.newHits)) {
    if (!T.chance[set]) continue;
    add(`new hits, ${set}`, h, T.chance[set].A.newHits, 0);
    add(`new-hit shuffle mean, ${set}`, m, T.chance[set].A.newMean, set === 'six voices' ? 2 : 1);
  }
  for (const [set, [h, m]] of Object.entries(CHECK.ruleCHits)) {
    if (!T.chance[set]) continue;
    add(`rule C hits, ${set}`, h, T.chance[set].C.hits, 0);
    add(`rule C shuffle mean, ${set}`, m, T.chance[set].C.mean, 1);
  }
  for (const [rule, by] of Object.entries(CHECK.wholeSet)) {
    for (const [set, [h, f]] of Object.entries(by)) {
      if (!T.sets[set]) continue;
      add(`rule ${rule} hits /1,000 whole set, ${set}`, h, round(T.sets[set][rule].hit.per1000Whole, 1), 0.101);
      add(`rule ${rule} false /1,000 whole set, ${set}`, f, round(T.sets[set][rule].false.per1000Whole, 1), 0.101);
    }
  }
  if (T.sets['six voices']) {
    for (const [rule, v] of Object.entries(CHECK.pooledShares)) {
      const e = T.sets['six voices'][rule];
      add(`rule ${rule} hits kept %, six voices, whole set`, v.hit[0], round(e.hit.shareWhole, 0), 0.51);
      add(`rule ${rule} false kept %, six voices, whole set`, v.false[0], round(e.false.shareWhole, 0), 0.51);
      add(`rule ${rule} hits kept, interval low`, v.hit[1], round(e.hit.shareWholeCi.lo, 0), 3);
      add(`rule ${rule} hits kept, interval high`, v.hit[2], round(e.hit.shareWholeCi.hi, 0), 3);
      add(`rule ${rule} false kept, interval low`, v.false[1], round(e.false.shareWholeCi.lo, 0), 3);
      add(`rule ${rule} false kept, interval high`, v.false[2], round(e.false.shareWholeCi.hi, 0), 3);
    }
    const w = T.within['six voices'].A;
    const [a, b, c2, d2, diff] = CHECK.within['six voices'];
    add('within word, six voices, marked with the edit', a, w.withEdit, 0);
    add('within word, six voices, read with the edit', b, w.withEditOf, 0);
    add('within word, six voices, marked without', c2, w.without, 0);
    add('within word, six voices, read without', d2, w.withoutOf, 0);
    add('within word, six voices, difference', diff, w.difference, 0.051);
  }
  const wc = T.within['clean, all 1,607 takes, stand-in slices']['J.none'];
  const [a, b, c2, d2, diff] = CHECK.within.clean;
  add('within word, clean, marked with the edit', a, wc.withEdit, 0);
  add('within word, clean, read with the edit', b, wc.withEditOf, 0);
  add('within word, clean, marked without', c2, wc.without, 0);
  add('within word, clean, read without', d2, wc.withoutOf, 0);
  add('within word, clean, difference', diff, wc.difference, 0.051);
  T.checks.reproduceCheck = {rows, within: rows.filter(r => r.within === true).length, outside: rows.filter(r => r.within === false)};
}

fs.writeFileSync(path.join(OUT, 'tables.json'), JSON.stringify(T, null, 1));
console.log(`conditions ${done.join(', ')}; ${Object.keys(T.sets).length} sets`);
