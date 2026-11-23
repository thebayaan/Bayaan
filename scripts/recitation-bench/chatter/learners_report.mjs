/* eslint-env node, es2020 */
// The tables of the test of real slips under voices (LEARNERS.md), from
// .out/chatter/learners/rows.<cond>.jsonl and the runs. Intervals resample speakers and
// words together: each draw counts a mark as many times as its speaker's draws times
// its word's draws, and the same for the words it is a rate over.
//
//   node chatter/learners_report.mjs [--boot 2000]
//
// Writes .out/chatter/learners/report.md and report.json.
import fs from 'node:fs';
import path from 'node:path';
import {
  CLEAN_MARKS,
  CONDS,
  MANIFEST,
  OUT,
  WORD_MARKS_FROZEN,
  aucOfSorted,
  condName,
  engineIds,
  learnerSegment,
  loadClips,
  mulberry,
  quantile,
  readJson,
  readJsonl,
  resultName,
  rowsFile,
  runDir,
  segmentOdds,
  speakerOf,
} from './learners_lib.mjs';

process.env.WORD_MARKS = WORD_MARKS_FROZEN;
const {replay} = await import('../natural/replay.mjs');

const arg = name => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const BOOT = Number(arg('boot') ?? 2000);
const RULES = ['A', 'B', 'C', 'D', 'E'];
const GROUPS = {
  hit: r => r.label === 'hit',
  near: r => r.label === 'near',
  'false-incorrect': r => r.label === 'false-incorrect',
  'false-correct': r => r.label === 'false-correct',
  false: r => r.label === 'false-incorrect' || r.label === 'false-correct',
};
const ON_LEARNER = new Set(['hit', 'near', 'false-incorrect', 'false-correct']);

// ------------------------------------------------------------ the clips and their words

const clips = loadClips();
const clipById = new Map(clips.map(c => [c.id, c]));
const speakers = [...new Set(clips.map(c => speakerOf(c.id)))].sort();
const spkIndex = new Map(speakers.map((s, i) => [s, i]));
const odds = new Map();
const wordKeys = new Map();
const tableMap = new Map();
for (const c of clips) {
  const seg = learnerSegment(c);
  const o = segmentOdds(seg);
  odds.set(c.id, o);
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
}
const table = [...tableMap.values()];
const listWords = table.reduce((n, r) => n + r.n, 0);
const wordsOfLabel = label => table.filter(r => r.label === label).reduce((n, r) => n + r.n, 0);
const nS = speakers.length;
const nW = wordKeys.size;

// The same draws for every condition, so conditions and rules compare pairwise.
const rand = mulberry(20261107);
const spkDraws = new Int16Array(BOOT * nS);
const wordDraws = new Int16Array(BOOT * nW);
for (let b = 0; b < BOOT; b++) {
  for (let i = 0; i < nS; i++) spkDraws[b * nS + Math.floor(rand() * nS)] += 1;
  for (let i = 0; i < nW; i++) wordDraws[b * nW + Math.floor(rand() * nW)] += 1;
}
const drawWeight = (b, si, wi) => spkDraws[b * nS + si] * wordDraws[b * nW + wi];

const wordsB = new Float64Array(BOOT);
const wordsWeightedB = new Float64Array(BOOT);
const wordsIncorrectB = new Float64Array(BOOT);
const wordsCorrectB = new Float64Array(BOOT);
for (let b = 0; b < BOOT; b++) {
  for (const r of table) {
    const w = drawWeight(b, r.si, r.wi) * r.n;
    wordsB[b] += w;
    wordsWeightedB[b] += w * r.weight;
    if (r.label === 'incorrect') wordsIncorrectB[b] += w;
    else wordsCorrectB[b] += w;
  }
}

function ci(values) {
  const v = [...values].filter(Number.isFinite).sort((x, y) => x - y);
  return v.length ? {lo: +quantile(v, 0.025).toFixed(3), hi: +quantile(v, 0.975).toFixed(3)} : null;
}
const div = (a, b, k = 1) => {
  const out = new Float64Array(BOOT);
  for (let i = 0; i < BOOT; i++) out[i] = b[i] ? (k * a[i]) / b[i] : NaN;
  return out;
};
const sub = (a, b) => {
  const out = new Float64Array(BOOT);
  for (let i = 0; i < BOOT; i++) out[i] = a[i] - b[i];
  return out;
};
const pct = (a, b) => (b ? +((100 * a) / b).toFixed(1) : null);

/** Sums over rows for each draw; rows carry their draws in `w`. */
function sum(rows, value = () => 1) {
  const out = new Float64Array(BOOT);
  for (const r of rows) {
    const v = value(r);
    if (!v) continue;
    for (let b = 0; b < BOOT; b++) out[b] += r.w[b] * v;
  }
  return out;
}

/** P(a hit scores lower than a false mark) + ties / 2, point estimate and draws. */
function aucOf(hits, falses, score) {
  const items = [];
  for (const r of hits) if (Number.isFinite(score(r))) items.push({s: score(r), pos: true, r});
  for (const r of falses) if (Number.isFinite(score(r))) items.push({s: score(r), pos: false, r});
  items.sort((x, y) => x.s - y.s);
  const point = aucOfSorted(items, () => 1);
  const draws = new Float64Array(BOOT);
  for (let b = 0; b < BOOT; b++) draws[b] = aucOfSorted(items, r => r.w[b]);
  return {auc: Number.isFinite(point) ? +point.toFixed(3) : null, ci: ci(draws), hits: items.filter(i => i.pos).length, falses: items.filter(i => !i.pos).length};
}

// ------------------------------------------------------------ the baseline's marks

const cleanAll = readJsonl(CLEAN_MARKS).filter(m => m.ds === 'quranmb' && clipById.has(m.run));
const cleanLabel = new Map(cleanAll.map(m => [`${m.run}|${m.id}`, m.label]));
const cleanWordsOf = new Map();
for (const m of cleanAll) {
  if (!ON_LEARNER.has(m.label)) continue;
  const list = cleanWordsOf.get(m.run) ?? new Set();
  list.add(m.word.split(':').slice(1).join(':'));
  cleanWordsOf.set(m.run, list);
}

// ------------------------------------------------------------ one condition

function analyse(cond) {
  const rows = readJsonl(rowsFile(cond));
  const out = {cond, rows: rows.length};
  // Words and clusters: marks on a learner word carry draws.
  for (const r of rows) {
    r.onLearner = ON_LEARNER.has(r.label);
    r.clean = cleanLabel.get(`${r.clip}|${r.id}`) ?? null;
    if (!r.onLearner) continue;
    const si = spkIndex.get(r.speaker);
    const wi = wordKeys.get(r.word);
    if (wi === undefined) throw new Error(`mark on a word outside its segment: ${r.key}`);
    r.w = new Float64Array(BOOT);
    for (let b = 0; b < BOOT; b++) r.w[b] = drawWeight(b, si, wi);
  }
  const learner = rows.filter(r => r.onLearner);
  const keptBy = rule => r => r.rules[rule] === 'keep';

  // Counts and rates.
  out.before = {};
  for (const r of rows) out.before[r.label] = (out.before[r.label] ?? 0) + 1;
  out.corrected = rows.filter(r => r.corrected).length;
  out.rules = {};
  for (const rule of RULES) {
    const entry = {};
    for (const [name, test] of Object.entries(GROUPS)) {
      const all = learner.filter(test);
      const kept = all.filter(keptBy(rule));
      const keptB = sum(kept);
      const allB = sum(all);
      const weighted = sum(kept, r => r.weight);
      const whole = kept.reduce((n, r) => n + r.weight, 0);
      const wholeWords = table.reduce((n, t) => n + t.n * t.weight, 0);
      entry[name] = {
        kept: kept.length,
        of: all.length,
        share: pct(kept.length, all.length),
        shareCi: ci(div(keptB, allB, 100)),
        per1000: +((1000 * kept.length) / listWords).toFixed(3),
        per1000Ci: ci(div(keptB, wordsB, 1000)),
        wholeSet: +((1000 * whole) / wholeWords).toFixed(3),
        wholeSetCi: ci(div(weighted, wordsWeightedB, 1000)),
      };
    }
    entry.lead = rows.filter(r => r.label === 'lead' && r.rules[rule] === 'keep').length;
    const keptHits = learner.filter(GROUPS.hit).filter(keptBy(rule));
    const keptFalse = learner.filter(GROUPS.false).filter(keptBy(rule));
    entry.hitsPerFalse = keptFalse.length ? +(keptHits.length / keptFalse.length).toFixed(2) : null;
    entry.hitsPerFalseCi = ci(div(sum(keptHits), sum(keptFalse)));
    out.rules[rule] = entry;
  }

  // Rates on each label's own words: false-correct over words of correct takes.
  const cor = learner.filter(GROUPS['false-correct']);
  const inc = learner.filter(GROUPS['false-incorrect']);
  out.ownWords = {};
  for (const rule of RULES) {
    out.ownWords[rule] = {
      falseCorrect: +((1000 * cor.filter(keptBy(rule)).length) / wordsOfLabel('correct')).toFixed(3),
      falseCorrectCi: ci(div(sum(cor.filter(keptBy(rule))), wordsCorrectB, 1000)),
      falseIncorrect: +((1000 * inc.filter(keptBy(rule)).length) / wordsOfLabel('incorrect')).toFixed(3),
      falseIncorrectCi: ci(div(sum(inc.filter(keptBy(rule))), wordsIncorrectB, 1000)),
    };
  }

  // The clean hits, under this voice.
  const cleanHits = cleanAll.filter(m => m.label === 'hit');
  const hits = learner.filter(GROUPS.hit);
  const surviving = hits.filter(r => r.clean === 'hit');
  const newHits = hits.filter(r => r.clean !== 'hit');
  const cleanHitRows = cleanHits.map(m => {
    const w = new Float64Array(BOOT);
    const si = spkIndex.get(speakerOf(m.run));
    const wi = wordKeys.get(m.word);
    for (let b = 0; b < BOOT; b++) w[b] = drawWeight(b, si, wi);
    return {w};
  });
  const cleanHitsB = sum(cleanHitRows);
  out.cleanHits = cleanHits.length;
  out.surviving = surviving.length;
  out.survivingShareCi = ci(div(sum(surviving), cleanHitsB, 100));
  out.newHits = newHits.length;
  out.newHitsPer1000 = +((1000 * newHits.length) / listWords).toFixed(3);
  out.newHitsPer1000Ci = ci(div(sum(newHits), wordsB, 1000));
  out.newHitsInSample = newHits.filter(r => r.stratum === 'sample').length;

  // How long the clean marks of other labels last, for comparison with the hits.
  out.persistence = {};
  const lasting = {};
  const cleanWeights = list =>
    list.map(m => {
      const w = new Float64Array(BOOT);
      const si = spkIndex.get(speakerOf(m.run));
      const wi = wordKeys.get(m.word);
      for (let b = 0; b < BOOT; b++) w[b] = drawWeight(b, si, wi);
      return {w};
    });
  for (const label of ['hit', 'near', 'false-incorrect', 'false-correct']) {
    const of = cleanAll.filter(m => m.label === label);
    const still = learner.filter(r => r.clean === label);
    lasting[label] = {still, of: cleanWeights(of)};
    out.persistence[label] = {
      still: still.length,
      of: of.length,
      share: pct(still.length, of.length),
      shareCi: ci(div(sum(still), sum(lasting[label].of), 100)),
    };
  }
  const falseStill = [...lasting['false-incorrect'].still, ...lasting['false-correct'].still];
  const falseOf = [...lasting['false-incorrect'].of, ...lasting['false-correct'].of];
  out.persistenceFalse = {
    still: falseStill.length,
    of: falseOf.length,
    share: pct(falseStill.length, falseOf.length),
    shareCi: ci(div(sum(falseStill), sum(falseOf), 100)),
  };
  out.persistenceHitMinusFalse = ci(sub(div(sum(lasting.hit.still), sum(lasting.hit.of), 100), div(sum(falseStill), sum(falseOf), 100)));

  // What each rule does to the surviving hits, the new hits and the false marks.
  const falses = learner.filter(GROUPS.false);
  const cleanFalse = falses.filter(r => r.clean);
  const newFalse = falses.filter(r => !r.clean);
  const shareOf = (list, rule) => div(sum(list.filter(keptBy(rule))), sum(list), 100);
  out.survivingKept = {};
  out.newHitsKept = {};
  out.cleanFalseKept = {};
  out.newFalseKept = {};
  for (const rule of RULES) {
    const entry = list => {
      const kept = list.filter(keptBy(rule)).length;
      return {kept, of: list.length, share: pct(kept, list.length), shareCi: ci(shareOf(list, rule))};
    };
    out.survivingKept[rule] = entry(surviving);
    out.newHitsKept[rule] = entry(newHits);
    out.cleanFalseKept[rule] = entry(cleanFalse);
    out.newFalseKept[rule] = entry(newFalse);
  }

  // Rule against rule, draw by draw.
  out.pairs = {};
  for (const [x, y] of [['C', 'B'], ['C', 'D'], ['D', 'B'], ['E', 'C'], ['E', 'D']]) {
    const hitsKept = rule => sum(hits.filter(keptBy(rule)));
    const falseKept = rule => sum(falses.filter(keptBy(rule)));
    out.pairs[`${x}-${y}`] = {
      survivingShare: ci(sub(shareOf(surviving, x), shareOf(surviving, y))),
      hitsPer1000: ci(sub(div(hitsKept(x), wordsB, 1000), div(hitsKept(y), wordsB, 1000))),
      falsePer1000: ci(sub(div(falseKept(x), wordsB, 1000), div(falseKept(y), wordsB, 1000))),
    };
  }

  // Chance: where a mark on an incorrect segment would land at random among its words.
  const onIncorrect = learner.filter(r => r.segLabel === 'incorrect');
  for (const r of onIncorrect) {
    const o = odds.get(r.clip);
    r.pHit = o.errors.size / o.keys.length;
    r.pNear = o.neighbour.size / o.keys.length;
    // A new mark is by definition on a word the clean run left unmarked.
    const taken = cleanWordsOf.get(r.clip) ?? new Set();
    const free = o.keys.filter(k => !taken.has(k));
    const freeErrors = free.filter(k => o.errors.has(k));
    r.pHitNew = free.length ? freeErrors.length / free.length : 0;
  }
  const newOnIncorrect = onIncorrect.filter(r => !r.clean);
  const total = (list, f) => list.reduce((n, r) => n + f(r), 0);
  const expectedNew = total(newOnIncorrect, r => r.pHitNew);
  const sdNew = Math.sqrt(total(newOnIncorrect, r => r.pHitNew * (1 - r.pHitNew)));
  const excessAll = sub(sum(onIncorrect.filter(GROUPS.hit)), sum(onIncorrect, r => r.pHit));
  const excessNew = sub(sum(newOnIncorrect.filter(GROUPS.hit)), sum(newOnIncorrect, r => r.pHitNew));
  const obsNew = newOnIncorrect.filter(GROUPS.hit).length;
  out.chance = {
    marksOnIncorrect: onIncorrect.length,
    hits: onIncorrect.filter(GROUPS.hit).length,
    expectedHits: +total(onIncorrect, r => r.pHit).toFixed(1),
    near: onIncorrect.filter(GROUPS.near).length,
    expectedNear: +total(onIncorrect, r => r.pNear).toFixed(1),
    excessHitsCi: ci(excessAll),
    newMarksOnIncorrect: newOnIncorrect.length,
    newHits: obsNew,
    expectedNewHits: +expectedNew.toFixed(1),
    expectedNewRange: [+(expectedNew - 1.96 * sdNew).toFixed(1), +(expectedNew + 1.96 * sdNew).toFixed(1)],
    excessNewHits: +(obsNew - expectedNew).toFixed(1),
    excessNewHitsCi: ci(excessNew),
  };

  // On the whole set: most takes are not listed, so their new hits count for more.
  out.wholeSet = {
    survivingHits: surviving.length,
    newHits: +newHits.reduce((n, r) => n + r.weight, 0).toFixed(1),
    chanceNewHits: +newOnIncorrect.reduce((n, r) => n + r.weight * r.pHitNew, 0).toFixed(1),
  };

  // After each rule: do the marks it keeps land on labelled words more than chance?
  out.afterRule = {};
  for (const rule of RULES) {
    const kept = onIncorrect.filter(keptBy(rule));
    const keptHits = kept.filter(GROUPS.hit);
    const expected = total(kept, r => r.pHit);
    out.afterRule[rule] = {
      marks: kept.length,
      hits: keptHits.length,
      expectedHits: +expected.toFixed(1),
      share: pct(keptHits.length, kept.length),
      chanceShare: pct(expected, kept.length),
      excess: +(keptHits.length - expected).toFixed(1),
      excessCi: ci(sub(sum(keptHits), sum(kept, r => r.pHit))),
    };
  }

  // Does -2 per letter tell hits from false marks here?
  const score = r => (r.app ? r.app.perLetter : null);
  out.auc = aucOf(hits, falses, score);
  out.aucSurviving = aucOf(surviving, falses, score);
  out.aucNewHits = aucOf(newHits, newFalse, score);
  out.aucExperimentSlice = aucOf(hits, falses, r => (r.exp ? r.exp.perLetter : null));

  // The first-verdict slice of the letter-slip experiment, as a check.
  out.atFirstVerdict = {};
  for (const rule of ['B', 'C']) {
    const keptAt = list => list.filter(r => r.atFirstVerdict[rule] === 'keep').length;
    out.atFirstVerdict[rule] = {
      hits: `${keptAt(hits)}/${hits.length}`,
      surviving: `${keptAt(surviving)}/${surviving.length}`,
      near: `${keptAt(learner.filter(GROUPS.near))}/${learner.filter(GROUPS.near).length}`,
      false: `${keptAt(falses)}/${falses.length}`,
    };
  }
  out.lookedAt = {
    noLook: rows.filter(r => !r.app).length,
    noFit: rows.filter(r => !r.fit || r.fit.expected === null).length,
    sinceIsLastBad: rows.filter(r => Math.abs(r.since - r.lastBad) < 1e-6).length,
    fitDiffersAtFirstVerdict: rows.filter(r => r.fitSince && r.fit && r.fit.expected >= -2 !== r.fitSince.expected >= -2).length,
    kinds: {missed: rows.filter(r => r.kind === 'missed').length, wrong: rows.filter(r => r.kind === 'wrong').length},
  };

  // The follower: how much of the learners it judged, and what became of the clean hits.
  const fates = {};
  const levels = [];
  let judged = 0;
  let ok = 0;
  let neverLocked = 0;
  let scaled = 0;
  let seconds = 0;
  let busy = 0;
  const rtfs = [];
  const cleanHitIds = new Map();
  for (const m of cleanHits) {
    const list = cleanHitIds.get(m.run) ?? [];
    list.push(m.id);
    cleanHitIds.set(m.run, list);
  }
  for (const c of clips) {
    const run = readJson(path.join(runDir(cond), resultName(c.id)));
    if (run.clip.mix.learnerSnrDb !== null) levels.push(run.clip.mix.learnerSnrDb);
    if (run.clip.mix.scale !== 1) scaled += 1;
    if (run.summary.firstLock === null) neverLocked += 1;
    seconds += run.summary.seconds;
    busy += run.summary.rtf * run.summary.seconds;
    rtfs.push(run.summary.rtf);
    const last = new Map();
    for (const v of run.vchanges) {
      if (!v.stop && v.to !== 'pending') last.set(v.id, v.to);
    }
    const seg = learnerSegment(c);
    for (const k of odds.get(c.id).keys) {
      const [a, mw] = k.split(':').map(Number);
      const states = engineIds(seg.surah, a, mw).map(id => last.get(id));
      if (states.some(Boolean)) judged += 1;
      if (states.includes('ok')) ok += 1;
    }
    const ids = cleanHitIds.get(c.id);
    if (!ids) continue;
    const marked = new Set(rows.filter(r => r.clip === c.id).map(r => r.id));
    const lost = ids.filter(id => !marked.has(id));
    if (!lost.length) continue;
    const rep = replay(run, {mode: 'app'});
    for (const id of lost) {
      const state = last.get(id);
      let fate;
      if (!state) fate = 'never judged';
      else if (state === 'ok' || state === 'unsure') fate = `judged ${state}`;
      else fate = `bad verdict, not shown: ${(rep.reasons.get(id) ?? ['left to a flag or no reason']).at(-1)}`;
      fates[fate] = (fates[fate] ?? 0) + 1;
    }
  }
  levels.sort((x, y) => x - y);
  rtfs.sort((x, y) => x - y);
  out.follower = {
    judgedShare: pct(judged, listWords),
    okShare: pct(ok, listWords),
    neverLocked,
    scaled,
    minutes: +(seconds / 60).toFixed(1),
    medianRtf: quantile(rtfs, 0.5),
    meanRtf: +(busy / seconds).toFixed(3),
  };
  out.lostHitFates = fates;
  const summary = readJson(path.join(OUT, `summary.${condName(cond)}.json`)).quranmb.main;
  const recall = summary.recall['(any)'];
  out.errorWords = {heard: recall.words, judged: recall.judged, judgedShare: pct(recall.judged, recall.words), caught: recall.hit};
  const lead = readJson(path.join(OUT, `summary.${condName(cond)}.json`)).quranmb.leadQuality;
  out.leadIn = {takes: lead.takes, cursorAtClip: lead.cursorAtClip, cursorNear: lead.cursorNear, lockedInLead: lead.lockedInLead, neverLocked: lead.neverLocked};
  out.learnerSnrDb = levels.length
    ? {p10: quantile(levels, 0.1), median: quantile(levels, 0.5), p90: quantile(levels, 0.9)}
    : null;
  Object.defineProperty(out, 'learner', {value: learner, enumerable: false});
  Object.defineProperty(out, 'cleanRows', {
    value: Object.fromEntries(Object.entries(lasting).map(([k, v]) => [k, v.of])),
    enumerable: false,
  });
  return out;
}

/** The voices pooled: the same speakers and words in every condition, so the same draws. */
function pooled(name, results) {
  const rows = results.flatMap(r => r.learner);
  const keptBy = rule => r => r.rules[rule] === 'keep';
  const hits = rows.filter(GROUPS.hit);
  const groups = {
    surviving: hits.filter(r => r.clean === 'hit'),
    newHits: hits.filter(r => r.clean !== 'hit'),
    false: rows.filter(GROUPS.false),
    newFalse: rows.filter(GROUPS.false).filter(r => !r.clean),
    near: rows.filter(GROUPS.near),
  };
  const shareOf = (list, rule) => div(sum(list.filter(keptBy(rule))), sum(list), 100);
  const out = {name, conditions: results.map(r => r.cond), groups: {}};
  for (const [g, list] of Object.entries(groups)) {
    out.groups[g] = {of: list.length};
    for (const rule of RULES) {
      const kept = list.filter(keptBy(rule)).length;
      out.groups[g][rule] = {kept, share: pct(kept, list.length), shareCi: ci(shareOf(list, rule))};
    }
  }
  out.pairs = {};
  for (const [x, y] of [['C', 'B'], ['C', 'D'], ['D', 'B'], ['E', 'C']]) {
    out.pairs[`${x}-${y}`] = {};
    for (const g of ['surviving', 'newHits', 'false', 'newFalse']) {
      out.pairs[`${x}-${y}`][g] = ci(sub(shareOf(groups[g], x), shareOf(groups[g], y)));
    }
  }
  // Each rule's own separation: hits kept against false marks kept, in points.
  out.separation = {};
  for (const rule of ['B', 'C', 'D', 'E']) {
    out.separation[rule] = {
      newHitsMinusNewFalse: ci(sub(shareOf(groups.newHits, rule), shareOf(groups.newFalse, rule))),
      survivingMinusFalse: ci(sub(shareOf(groups.surviving, rule), shareOf(groups.false, rule))),
    };
  }
  const cleanOf = label => results.flatMap(r => r.cleanRows[label]);
  const stillOf = labels => rows.filter(r => labels.includes(r.clean));
  const hitLast = div(sum(stillOf(['hit'])), sum(cleanOf('hit')), 100);
  const falseLast = div(sum(stillOf(['false-incorrect', 'false-correct'])), sum([...cleanOf('false-incorrect'), ...cleanOf('false-correct')]), 100);
  out.persistence = {
    hit: {still: stillOf(['hit']).length, of: cleanOf('hit').length, share: pct(stillOf(['hit']).length, cleanOf('hit').length), shareCi: ci(hitLast)},
    false: {
      still: stillOf(['false-incorrect', 'false-correct']).length,
      of: cleanOf('false-incorrect').length + cleanOf('false-correct').length,
      share: pct(stillOf(['false-incorrect', 'false-correct']).length, cleanOf('false-incorrect').length + cleanOf('false-correct').length),
      shareCi: ci(falseLast),
    },
    hitMinusFalse: ci(sub(hitLast, falseLast)),
  };
  const newOn = rows.filter(r => r.segLabel === 'incorrect' && !r.clean);
  out.newHits = {
    observed: newOn.filter(GROUPS.hit).length,
    chance: +newOn.reduce((n, r) => n + r.pHitNew, 0).toFixed(1),
    excessCi: ci(sub(sum(newOn.filter(GROUPS.hit)), sum(newOn, r => r.pHitNew))),
  };
  const score = r => (r.app ? r.app.perLetter : null);
  out.auc = aucOf(hits, groups.false, score);
  return out;
}

// ------------------------------------------------------------ tables

const done = CONDS.filter(c => readJsonl(rowsFile(c)).length > 0);
const results = done.map(analyse);
const voices = results.filter(r => r.cond !== 'none:0');
const pools = voices.length
  ? [
      pooled('all six voices', voices),
      pooled('10 dB', voices.filter(r => r.cond.endsWith(':10'))),
      pooled('5 dB', voices.filter(r => r.cond.endsWith(':5'))),
    ]
  : [];
const timing = readJsonl(path.join(OUT, 'timing.jsonl'));
const wallOf = (cond, stage) =>
  timing.filter(t => t.cond === cond && t.stage === stage).reduce((n, t) => n + t.wallSeconds, 0);
const iv = x => (x ? `${x.lo} to ${x.hi}` : '-');
const lines = [];
const list = readJson(path.join(OUT, 'clips.json'));
lines.push('# Real slips under voices', '');
lines.push(
  `List: ${clips.length} takes, ${list.minutes} min, ${speakers.length} speakers, ${listWords} learner words (${wordsOfLabel('incorrect')} on incorrect takes, ${wordsOfLabel('correct')} on correct takes), ${nW} different words.`,
  `Every take with a clean mark (${list.marked.takes}, ${list.marked.minutes} min) plus ${list.sample.takes} sampled (${list.sample.incorrect} incorrect, ${list.sample.correct} correct): ${list.method}. Seed ${list.seed}.`,
  `Clean marks kept: ${Object.entries(list.cleanMarksKept).map(([k, [a, b]]) => `${k} ${a}/${b}`).join(', ')}.`,
  `Intervals: 95%, ${BOOT} draws of speakers and words together. "Whole set" weights each take by its chance of being listed, so it estimates all ${list.population.takes} takes; the plain rate is inflated at none:0 because the list holds every take with a clean mark.`,
  '',
);
lines.push('## What the follower marks, before any rule', '');
lines.push('| Condition | Hits | Near | False-incorrect | False-correct | Lead-in | Elsewhere | Hits /1,000 | False /1,000 | False /1,000, whole set | Learner words judged | Words ok | Error words judged | Takes never locked | Cursor on the first learner word | Mixes scaled down | Learner SNR dB (p10, median, p90) |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  const b = r.before;
  const A = r.rules.A;
  lines.push(
    `| ${r.cond} | ${b.hit ?? 0} | ${b.near ?? 0} | ${b['false-incorrect'] ?? 0} | ${b['false-correct'] ?? 0} | ${b.lead ?? 0} | ${b.elsewhere ?? 0} | ${A.hit.per1000} (${iv(A.hit.per1000Ci)}) | ${A.false.per1000} (${iv(A.false.per1000Ci)}) | ${A.false.wholeSet} (${iv(A.false.wholeSetCi)}) | ${r.follower.judgedShare}% | ${r.follower.okShare}% | ${r.errorWords.judgedShare}% | ${r.follower.neverLocked} | ${r.leadIn.cursorAtClip}/${r.leadIn.takes} | ${r.follower.scaled} | ${r.learnerSnrDb ? `${r.learnerSnrDb.p10}, ${r.learnerSnrDb.median}, ${r.learnerSnrDb.p90}` : '-'} |`,
  );
}
lines.push('', '## Marks kept, per condition and rule', '');
lines.push('A today, B as built (-2 per letter), C letter-slip, D fit test (total >= -2), E B on skipped only.', '');
lines.push('| Condition | Rule | Hits | Near | False-incorrect | False-correct | Hits /1,000 | Near /1,000 | False /1,000 | False /1,000, whole set | Hits /1,000, whole set | Hits per false mark | Lead-in marks kept |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  for (const rule of RULES) {
    const e = r.rules[rule];
    lines.push(
      `| ${r.cond} | ${rule} | ${e.hit.kept}/${e.hit.of} | ${e.near.kept}/${e.near.of} | ${e['false-incorrect'].kept}/${e['false-incorrect'].of} | ${e['false-correct'].kept}/${e['false-correct'].of} | ${e.hit.per1000} (${iv(e.hit.per1000Ci)}) | ${e.near.per1000} (${iv(e.near.per1000Ci)}) | ${e.false.per1000} (${iv(e.false.per1000Ci)}) | ${e.false.wholeSet} (${iv(e.false.wholeSetCi)}) | ${e.hit.wholeSet} (${iv(e.hit.wholeSetCi)}) | ${e.hitsPerFalse ?? '-'} (${iv(e.hitsPerFalseCi)}) | ${e.lead} |`,
    );
  }
}
lines.push('', '## The 66 clean hits, and new hits against chance', '');
lines.push('Chance: each mark on an incorrect segment landing at random among its segment\'s words; a new mark among the words the clean run left unmarked.', '');
lines.push('| Condition | Clean hits still marked (share %, 95%) | New hits | New hits /1,000 | Of them in sampled takes | New marks on incorrect segments | Chance new hits (range) | New hits above chance (95%) | All hits | Chance all hits | All hits above chance (95%) |', '|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  const c = r.chance;
  lines.push(
    `| ${r.cond} | ${r.surviving}/${r.cleanHits} (${iv(r.survivingShareCi)}) | ${r.newHits} | ${r.newHitsPer1000} (${iv(r.newHitsPer1000Ci)}) | ${r.newHitsInSample} | ${c.newMarksOnIncorrect} | ${c.expectedNewHits} (${c.expectedNewRange.join(' to ')}) | ${c.excessNewHits} (${iv(c.excessNewHitsCi)}) | ${c.hits} | ${c.expectedHits} | ${(c.hits - c.expectedHits).toFixed(1)} (${iv(c.excessHitsCi)}) |`,
  );
}
lines.push('', 'How long clean marks of each kind last under each voice (a clean false mark is a word the follower already disliked):', '');
lines.push('| Condition | Hits | Near | False-incorrect | False-correct | All false | Hits minus false, points |', '|---|---|---|---|---|---|---|');
for (const r of results) {
  const p = r.persistence;
  const cell = e => `${e.still}/${e.of} (${e.share}%, ${iv(e.shareCi)})`;
  lines.push(`| ${r.cond} | ${cell(p.hit)} | ${cell(p.near)} | ${cell(p['false-incorrect'])} | ${cell(p['false-correct'])} | ${cell(r.persistenceFalse)} | ${iv(r.persistenceHitMinusFalse)} |`);
}
lines.push('', 'What became of the clean hits the follower no longer marks:', '');
lines.push('| Condition | Lost hits by what happened |', '|---|---|');
for (const r of results) {
  lines.push(`| ${r.cond} | ${Object.entries(r.lostHitFates).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k}: ${v}`).join('; ') || '-'} |`);
}
lines.push('', '## Of the hits that survive the follower, how many each rule keeps', '');
lines.push('Share with its 95% interval in brackets.', '');
lines.push('| Condition | Surviving | A | B | C | D | E |', '|---|---|---|---|---|---|---|');
for (const r of results) {
  const k = r.survivingKept;
  const cell = e => `${e.kept} (${e.share ?? '-'}%, ${iv(e.shareCi)})`;
  lines.push(`| ${r.cond} | ${r.surviving} | ${cell(k.A)} | ${cell(k.B)} | ${cell(k.C)} | ${cell(k.D)} | ${cell(k.E)} |`);
}
lines.push('', 'Do the marks a rule keeps land on labelled words more than chance would? Marks on incorrect segments only.', '');
lines.push('| Condition | Rule | Marks | Hits | Share on a labelled word | Chance share | Hits above chance (95%) |', '|---|---|---|---|---|---|---|');
for (const r of results) {
  for (const rule of RULES) {
    const e = r.afterRule[rule];
    lines.push(`| ${r.cond} | ${rule} | ${e.marks} | ${e.hits} | ${e.share}% | ${e.chanceShare}% | ${e.excess} (${iv(e.excessCi)}) |`);
  }
}
lines.push('', 'The same for marks the clean run never made, which no rule was chosen on:', '');
lines.push('| Condition | Group | Marks | B | C | D | E |', '|---|---|---|---|---|---|---|');
for (const r of results) {
  if (r.cond === 'none:0') continue;
  const cell = e => `${e.kept} (${e.share ?? '-'}%, ${iv(e.shareCi)})`;
  lines.push(`| ${r.cond} | new hits | ${r.newHitsKept.A.of} | ${cell(r.newHitsKept.B)} | ${cell(r.newHitsKept.C)} | ${cell(r.newHitsKept.D)} | ${cell(r.newHitsKept.E)} |`);
  lines.push(`| ${r.cond} | new false marks | ${r.newFalseKept.A.of} | ${cell(r.newFalseKept.B)} | ${cell(r.newFalseKept.C)} | ${cell(r.newFalseKept.D)} | ${cell(r.newFalseKept.E)} |`);
  lines.push(`| ${r.cond} | false marks also made clean | ${r.cleanFalseKept.A.of} | ${cell(r.cleanFalseKept.B)} | ${cell(r.cleanFalseKept.C)} | ${cell(r.cleanFalseKept.D)} | ${cell(r.cleanFalseKept.E)} |`);
}
lines.push('', 'Rule against rule, draw by draw (95% interval of the difference; an interval that excludes 0 is a difference this sample can see):', '');
lines.push('| Condition | Pair | Surviving hits kept, points | Hits /1,000 | False /1,000 |', '|---|---|---|---|---|');
for (const r of results) {
  for (const [pair, v] of Object.entries(r.pairs)) {
    lines.push(`| ${r.cond} | ${pair} | ${iv(v.survivingShare)} | ${iv(v.hitsPer1000)} | ${iv(v.falsePer1000)} |`);
  }
}
if (pools.length) {
  lines.push('', '## The voices pooled', '');
  lines.push('The same speakers and words in every condition, resampled with the same draws, so these are not independent conditions added up. Shares in %, with their 95% interval.', '');
  lines.push('| Pool | Group | Marks | B | C | D | E |', '|---|---|---|---|---|---|---|');
  const cell = e => `${e.kept} (${e.share}%, ${iv(e.shareCi)})`;
  const NAMES = {surviving: 'surviving clean hits', newHits: 'new hits', false: 'all false marks', newFalse: 'new false marks', near: 'near'};
  for (const p of pools) {
    for (const [g, name] of Object.entries(NAMES)) {
      const e = p.groups[g];
      lines.push(`| ${p.name} | ${name} | ${e.of} | ${cell(e.B)} | ${cell(e.C)} | ${cell(e.D)} | ${cell(e.E)} |`);
    }
  }
  lines.push('', 'Differences between rules, in points of the share kept (95%):', '');
  lines.push('| Pool | Pair | Surviving hits | New hits | All false marks | New false marks |', '|---|---|---|---|---|---|');
  for (const p of pools) {
    for (const [pair, v] of Object.entries(p.pairs)) {
      lines.push(`| ${p.name} | ${pair} | ${iv(v.surviving)} | ${iv(v.newHits)} | ${iv(v.false)} | ${iv(v.newFalse)} |`);
    }
  }
  lines.push('', 'Does a rule treat real slips and false marks differently? Share of hits kept minus share of false marks kept, in points (95%):', '');
  lines.push('| Pool | Rule | Surviving hits minus all false marks | New hits minus new false marks |', '|---|---|---|---|');
  for (const p of pools) {
    for (const [rule, v] of Object.entries(p.separation)) {
      lines.push(`| ${p.name} | ${rule} | ${iv(v.survivingMinusFalse)} | ${iv(v.newHitsMinusNewFalse)} |`);
    }
  }
  lines.push('', '| Pool | Clean hits still marked | Clean false marks still marked | Hits minus false, points | New hits | Chance new hits | Above chance (95%) | AUC, all hits against all false marks |', '|---|---|---|---|---|---|---|---|');
  for (const p of pools) {
    const q = p.persistence;
    lines.push(`| ${p.name} | ${q.hit.still}/${q.hit.of} (${q.hit.share}%, ${iv(q.hit.shareCi)}) | ${q.false.still}/${q.false.of} (${q.false.share}%, ${iv(q.false.shareCi)}) | ${iv(q.hitMinusFalse)} | ${p.newHits.observed} | ${p.newHits.chance} | ${iv(p.newHits.excessCi)} | ${p.auc.auc} (${iv(p.auc.ci)}; ${p.auc.hits} v ${p.auc.falses}) |`);
  }
}
lines.push('', '## Does -2 per letter tell hits from false marks?', '');
lines.push('AUC: the chance a hit scores lower per letter than a false mark. 0.5 is no separation.', '');
lines.push('| Condition | All hits against all false marks | Surviving hits against all false marks | New hits against new false marks | All, on the experiment\'s slice |', '|---|---|---|---|---|');
for (const r of results) {
  const cell = a => `${a.auc ?? '-'} (${iv(a.ci)}; ${a.hits} v ${a.falses})`;
  lines.push(`| ${r.cond} | ${cell(r.auc)} | ${cell(r.aucSurviving)} | ${cell(r.aucNewHits)} | ${cell(r.aucExperimentSlice)} |`);
}
lines.push('', '## Checks and cost', '');
lines.push('| Condition | Bench wall, min | Rules wall, min | Median bench rtf per process | Marks | No first look | First verdict is the latest | B and C on the experiment\'s slice (hits, near, false) |', '|---|---|---|---|---|---|---|---|');
for (const r of results) {
  const af = r.atFirstVerdict;
  lines.push(
    `| ${r.cond} | ${(wallOf(r.cond, 'bench') / 60).toFixed(1)} | ${(wallOf(r.cond, 'rules') / 60).toFixed(1)} | ${r.follower.medianRtf} | ${r.rows} | ${r.lookedAt.noLook} | ${r.lookedAt.sinceIsLastBad} | B ${af.B.hits}, ${af.B.near}, ${af.B.false}; C ${af.C.hits}, ${af.C.near}, ${af.C.false} |`,
  );
}
lines.push('');
const text = lines.join('\n');
fs.writeFileSync(path.join(OUT, 'report.md'), text);

// The same numbers, shorter, for reading in one go.
const d1 = x => (x === null || x === undefined ? '-' : Number(x).toFixed(1));
const d0 = x => (x === null || x === undefined ? '-' : Number(x).toFixed(0));
const r1 = x => (x ? `${d1(x.lo)} to ${d1(x.hi)}` : '-');
const r0 = x => (x ? `${d0(x.lo)} to ${d0(x.hi)}` : '-');
const short = [];
short.push('Marks kept per condition and rule, on the list. /1,000 is per 1,000 learner words, with its 95% interval. Whole set estimates all takes.', '');
short.push('| Condition | Rule | Hits | Near | False-incorrect | False-correct | Hits /1,000 | Near /1,000 | False-incorrect /1,000 | False-correct /1,000 | All false /1,000 | All false /1,000, whole set |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  for (const rule of RULES) {
    const e = r.rules[rule];
    short.push(
      `| ${r.cond} | ${rule} | ${e.hit.kept}/${e.hit.of} | ${e.near.kept}/${e.near.of} | ${e['false-incorrect'].kept}/${e['false-incorrect'].of} | ${e['false-correct'].kept}/${e['false-correct'].of} | ${d1(e.hit.per1000)} (${r1(e.hit.per1000Ci)}) | ${d1(e.near.per1000)} (${r1(e.near.per1000Ci)}) | ${d1(e['false-incorrect'].per1000)} (${r1(e['false-incorrect'].per1000Ci)}) | ${d1(e['false-correct'].per1000)} (${r1(e['false-correct'].per1000Ci)}) | ${d1(e.false.per1000)} (${r1(e.false.per1000Ci)}) | ${d1(e.false.wholeSet)} (${r1(e.false.wholeSetCi)}) |`,
    );
  }
}
short.push('', 'The 66 clean hits and new hits. Chance: a mark landing at random among its segment\'s words (a new mark, among the words the clean run left unmarked).', '');
short.push('| Condition | Clean hits still marked (%, 95%) | Clean false marks still marked (%, 95%) | New hits | Chance new hits (range) | New hits above chance (95%) | New hits on the whole set (chance) | All hits | Chance all hits | All hits above chance (95%) | Learner SNR median dB |', '|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  const c = r.chance;
  const pf = r.persistenceFalse;
  short.push(
    `| ${r.cond} | ${r.surviving}/${r.cleanHits} (${d0((100 * r.surviving) / r.cleanHits)}%, ${r0(r.survivingShareCi)}) | ${pf.still}/${pf.of} (${d0(pf.share)}%, ${r0(pf.shareCi)}) | ${r.newHits} | ${d1(c.expectedNewHits)} (${c.expectedNewRange.map(d1).join(' to ')}) | ${d1(c.excessNewHits)} (${r1(c.excessNewHitsCi)}) | ${d1(r.wholeSet.newHits)} (${d1(r.wholeSet.chanceNewHits)}) | ${c.hits} | ${d1(c.expectedHits)} | ${d1(c.hits - c.expectedHits)} (${r1(c.excessHitsCi)}) | ${r.learnerSnrDb ? r.learnerSnrDb.median : '-'} |`,
  );
}
short.push('', 'Of the hits that survive the follower, how many each rule keeps (%, 95%), and all false marks kept.', '');
short.push('| Condition | Surviving | B | C | D | E | False marks | B | C | D | E |', '|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  const cell = e => `${e.kept} (${d0(e.share)}%, ${r0(e.shareCi)})`;
  const k = r.survivingKept;
  const f = r.rules;
  const fc = rule => `${f[rule].false.kept} (${d0(f[rule].false.share)}%, ${r0(f[rule].false.shareCi)})`;
  short.push(`| ${r.cond} | ${r.surviving} | ${cell(k.B)} | ${cell(k.C)} | ${cell(k.D)} | ${cell(k.E)} | ${f.A.false.of} | ${fc('B')} | ${fc('C')} | ${fc('D')} | ${fc('E')} |`);
}
short.push('', 'Hits kept above chance, after each rule (95%). Marks on incorrect segments.', '');
short.push('| Condition | A | B | C | D | E |', '|---|---|---|---|---|---|');
for (const r of results) {
  const cell = rule => `${d1(r.afterRule[rule].excess)} (${r1(r.afterRule[rule].excessCi)})`;
  short.push(`| ${r.cond} | ${cell('A')} | ${cell('B')} | ${cell('C')} | ${cell('D')} | ${cell('E')} |`);
}
if (pools.length) {
  short.push('', 'The voices pooled: the same speakers and words in every condition, so not independent conditions added up. Share kept (%, 95%).', '');
  short.push('| Pool | Group | Marks | B | C | D | E |', '|---|---|---|---|---|---|---|');
  const NAMES = {surviving: 'surviving clean hits', newHits: 'new hits', false: 'all false marks', newFalse: 'new false marks'};
  const cell = e => `${e.kept} (${d0(e.share)}%, ${r0(e.shareCi)})`;
  for (const p of pools) {
    for (const [g, name] of Object.entries(NAMES)) {
      const e = p.groups[g];
      short.push(`| ${p.name} | ${name} | ${e.of} | ${cell(e.B)} | ${cell(e.C)} | ${cell(e.D)} | ${cell(e.E)} |`);
    }
  }
  const all = pools[0];
  short.push('', `All six voices, differences in points of the share kept (95%): ${Object.entries(all.pairs).map(([pair, v]) => `${pair}: surviving hits ${r0(v.surviving)}, new hits ${r0(v.newHits)}, false marks ${r0(v.false)}`).join('; ')}.`);
  short.push('', `All six voices, share of hits kept minus share of false marks kept (95%): ${Object.entries(all.separation).map(([rule, v]) => `${rule}: surviving ${r0(v.survivingMinusFalse)}, new ${r0(v.newHitsMinusNewFalse)}`).join('; ')}.`);
}
short.push('', '-2 per letter, hits against false marks (AUC, 95%). 0.5 is no separation.', '');
short.push('| Condition | All hits v all false | Surviving hits v all false | New hits v new false |', '|---|---|---|---|');
for (const r of results) {
  const cell = a => (a.auc === null ? '-' : `${a.auc} (${a.ci.lo.toFixed(2)} to ${a.ci.hi.toFixed(2)}; ${a.hits} v ${a.falses})`);
  short.push(`| ${r.cond} | ${cell(r.auc)} | ${cell(r.aucSurviving)} | ${cell(r.aucNewHits)} |`);
}
short.push('', 'What became of the clean hits no longer marked, all six voices:', '');
const fates = {};
for (const r of voices) for (const [k, v] of Object.entries(r.lostHitFates)) fates[k] = (fates[k] ?? 0) + v;
short.push(Object.entries(fates).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k}: ${v}`).join('; ') || '-');
short.push('', 'Cost, on a loaded Mac (3 bench processes, then 1 second-model process):', '');
short.push('| Condition | Bench wall, min | Rules wall, min | Marks |', '|---|---|---|---|');
for (const r of results) short.push(`| ${r.cond} | ${(wallOf(r.cond, 'bench') / 60).toFixed(1)} | ${(wallOf(r.cond, 'rules') / 60).toFixed(1)} | ${r.rows} |`);
short.push('');
fs.writeFileSync(path.join(OUT, 'summary.md'), short.join('\n'));
fs.writeFileSync(
  path.join(OUT, 'report.json'),
  JSON.stringify({boot: BOOT, listWords, words: {incorrect: wordsOfLabel('incorrect'), correct: wordsOfLabel('correct')}, speakers: nS, differentWords: nW, results, pools}, null, 1),
);
console.log(text);
console.log(`manifest ${path.basename(MANIFEST)}; conditions ${done.map(condName).join(', ')}`);
