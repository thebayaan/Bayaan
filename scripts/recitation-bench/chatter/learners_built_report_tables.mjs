/* eslint-env node, es2020 */
// Renders the tables of the report from tables.json, as markdown. Reads nothing but what it is
// given. The report's words are in learners_built_report.mjs.

export const CHAIN_NAMES = {
  'J.none': 'today',
  'J.P1': "app's first version",
  'S1.P3': 'S1.P3, the default',
  'S2.P4': 'S2.P4, the flag',
  'S1h0.P3': 'S1h0.P3, decision 1',
  'N1.P3': 'N1.P3, decision 2',
  'S1.P3s': 'S1.P3s, the switch',
  B: 'older rule B',
  C: 'older rule C',
  A: 'first test, before any rule',
};
export const COND_NAMES = {
  none_0: 'none:0',
  one_ar_10: 'one_ar:10',
  crowd_10: 'crowd:10',
  rec_one_10: 'rec_one:10',
  one_ar_5: 'one_ar:5',
  crowd_5: 'crowd:5',
  rec_one_5: 'rec_one:5',
};
export const setName = s => COND_NAMES[s] ?? s;

export const d = (x, n = 1) => (x === null || x === undefined || !Number.isFinite(x) ? '-' : Number(x).toFixed(n));
const signed = (x, n = 1) => {
  if (x === null || x === undefined || !Number.isFinite(x)) return '-';
  const t = Number(x).toFixed(n);
  return x > 0 && Number(t) !== 0 ? `+${t}` : Number(t) === 0 ? (0).toFixed(n) : t;
};
export {signed};
export const iv = (x, n = 1) => (x ? `${d(x.lo, n)} to ${d(x.hi, n)}` : '-');
const count = e => `${e.kept}/${e.of}${e.added ? ` +${e.added}` : ''}`;
const rate = e => `${d(e.per1000Whole, 2)} (${iv(e.per1000WholeCi, 2)})`;

/** Does an interval leave out zero? */
const clear = x => (x ? x.lo > 0 || x.hi < 0 : false);
/** C: the 95% interval leaves out zero. T: only the plain two-way one does. I: inside both. */
export function reading(e) {
  if (!e) return '-';
  if (clear(e.ci)) return 'C';
  if (e.twoWay && clear(e.twoWay)) return 'T';
  return 'I';
}

export function mainTable(T, sets, chains) {
  const out = [
    '| Condition | Chain | Hits | /1,000 | Near | /1,000 | False-incorrect | /1,000 | False-correct | /1,000 | All false /1,000 |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const s of sets) {
    for (const c of chains) {
      const e = T.sets[s][c];
      out.push(
        `| ${setName(s)} | ${c} | ${count(e.hit)} | ${rate(e.hit)} | ${count(e.near)} | ${rate(e.near)} | ${count(e['false-incorrect'])} | ${rate(e['false-incorrect'])} | ${count(e['false-correct'])} | ${rate(e['false-correct'])} | ${rate(e.false)} |`,
      );
    }
  }
  return out.join('\n');
}

export function sharesTable(T, sets, chains) {
  const out = [
    '| Set | Chain | Hits kept, list | Hits kept, whole set (95%) | False kept, list | False kept, whole set (95%) | Hits minus false, points (95%) | The same, plain two-way | Near kept, whole set (95%) |',
    '|---|---|---|---|---|---|---|---|---|',
  ];
  for (const s of sets) {
    for (const c of chains) {
      const e = T.sets[s][c];
      const o = T.differences[s].own[c];
      out.push(
        `| ${setName(s)} | ${c} | ${e.hit.kept}/${e.hit.of} (${d(e.hit.shareList, 0)}%) | ${d(e.hit.shareWhole, 0)}% (${iv(e.hit.shareWholeCi, 0)}) | ${e.false.kept}/${e.false.of} (${d(e.false.shareList, 0)}%) | ${d(e.false.shareWhole, 0)}% (${iv(e.false.shareWholeCi, 0)}) | ${signed(o.separation.point, 0)} (${iv(o.separation.ci, 0)}) | ${iv(o.separation.twoWay, 0)} | ${d(e.near.shareWhole, 0)}% (${iv(e.near.shareWholeCi, 0)}) |`,
      );
    }
  }
  return out.join('\n');
}

export function differenceTable(T, sets, chains) {
  const out = [
    '| Set | Chain minus S1.P3 | Hits kept, points (95%) | plain two-way | False kept, points (95%) | plain two-way | Hits shown /1,000 (95%) | plain two-way | False shown /1,000 (95%) | plain two-way | Reading of the four |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const s of sets) {
    for (const c of chains) {
      const f = T.differences[s].fromReference[c];
      if (!f) continue;
      out.push(
        `| ${setName(s)} | ${c} | ${signed(f.hitShare.point, 1)} (${iv(f.hitShare.ci, 1)}) | ${iv(f.hitShare.twoWay, 1)} | ${signed(f.falseShare.point, 1)} (${iv(f.falseShare.ci, 1)}) | ${iv(f.falseShare.twoWay, 1)} | ${signed(f.hitRate.point, 2)} (${iv(f.hitRate.ci, 2)}) | ${iv(f.hitRate.twoWay, 2)} | ${signed(f.falseRate.point, 2)} (${iv(f.falseRate.ci, 2)}) | ${iv(f.falseRate.twoWay, 2)} | ${reading(f.hitShare)} ${reading(f.falseShare)} ${reading(f.hitRate)} ${reading(f.falseRate)} |`,
      );
    }
  }
  return out.join('\n');
}

export function perConditionDifferenceTable(T, sets, chains) {
  const out = [
    '| Condition | Chain minus S1.P3 | Hits shown, list | Hits shown /1,000 (95%) | False shown, list | False shown /1,000 (95%) |',
    '|---|---|---|---|---|---|',
  ];
  for (const s of sets) {
    const ref = T.sets[s]['S1.P3'];
    for (const c of chains) {
      const f = T.differences[s].fromReference[c];
      const e = T.sets[s][c];
      out.push(
        `| ${setName(s)} | ${c} | ${e.hit.shown} against ${ref.hit.shown} | ${signed(f.hitRate.point, 2)} (${iv(f.hitRate.ci, 2)}) | ${e.false.shown} against ${ref.false.shown} | ${signed(f.falseRate.point, 2)} (${iv(f.falseRate.ci, 2)}) |`,
      );
    }
  }
  return out.join('\n');
}

export function newMarksTable(T, sets, chains) {
  const out = [
    '| Set | Chain | Clean hits still kept | New hits kept | New hits kept, whole set (95%) | False marks also made clean, kept | New false marks kept | New false kept, whole set (95%) | New hits minus new false, points (95%) | plain two-way |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  const cell = x => `${x.kept}/${x.of}${x.of ? ` (${d((100 * x.kept) / x.of, 0)}%)` : ''}`;
  for (const s of sets) {
    for (const c of chains) {
      const p = T.split[s][c];
      const o = T.differences[s].own[c];
      out.push(
        `| ${setName(s)} | ${c} | ${cell(p.survivingHits)} | ${cell(p.newHits)} | ${d(o.newHitShare.point, 0)}% (${iv(o.newHitShare.ci, 0)}) | ${cell(p.cleanFalse)} | ${cell(p.newFalse)} | ${d(o.newFalseShare.point, 0)}% (${iv(o.newFalseShare.ci, 0)}) | ${signed(o.newSeparation.point, 0)} (${iv(o.newSeparation.ci, 0)}) | ${iv(o.newSeparation.twoWay, 0)} |`,
      );
    }
  }
  return out.join('\n');
}

export function chanceTable(T, sets, chains) {
  const out = [
    '| Set | Chain | Marks on incorrect segments | Hits | Shuffle mean (95%) | P | Word length matched: mean, P | New hits | Shuffle mean (95%) | P | Whole set: hits against chance (95% of the excess) |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  const p = x => (x < 0.001 ? '<0.001' : d(x, 3));
  for (const s of sets) {
    for (const c of chains) {
      const e = T.chance[s][c];
      const wholeExcess = e.wholeHits - e.wholeChance;
      out.push(
        `| ${setName(s)} | ${c} | ${e.marks} | ${e.hits} | ${d(e.mean)} (${e.lo} to ${e.hi}) | ${p(e.p)} | ${d(e.sameLengthMean)}, ${p(e.sameLengthP)} | ${e.newHits} | ${d(e.newMean)} (${e.newLo} to ${e.newHi}) | ${p(e.newP)} | ${d(e.wholeHits, 0)} against ${d(e.wholeChance, 0)}: ${signed(wholeExcess, 0)} (${iv(e.wholeExcessCi, 0)}) |`,
      );
    }
  }
  return out.join('\n');
}

export function splitTable(T, sets, chains) {
  const out = [
    '| Set | Chain | Hits with a consonant edit | Hits, vowels only | False, word other readers changed | False, word nobody changed |',
    '|---|---|---|---|---|---|',
  ];
  const cell = x => `${x.kept}/${x.of}${x.of ? ` (${d((100 * x.kept) / x.of, 0)}%)` : ''}${x.added ? ` +${x.added}` : ''}`;
  for (const s of sets) {
    for (const c of chains) {
      const p = T.split[s][c];
      out.push(
        `| ${setName(s)} | ${c} | ${cell(p.hitConsonant)} | ${cell(p.hitVowels)} | ${cell(p.falseOthersChanged)} | ${cell(p.falseNobodyChanged)} |`,
      );
    }
  }
  return out.join('\n');
}

export function withinTable(T, sets, chains) {
  const out = [
    '| Set | Chain | Words read both ways | With the edit | Same words, no edit | Within-word difference, points (95%, texts resampled) |',
    '|---|---|---|---|---|---|',
  ];
  for (const s of sets) {
    for (const c of chains) {
      const e = T.within[s]?.[c];
      if (!e) continue;
      const pc = (a, b) => (b ? ` (${d((100 * a) / b, 1)}%)` : '');
      out.push(
        `| ${setName(s)} | ${c} | ${e.words} | ${e.withEdit}/${e.withEditOf}${pc(e.withEdit, e.withEditOf)} | ${e.without}/${e.withoutOf}${pc(e.without, e.withoutOf)} | ${signed(e.difference, 1)} (${iv(e.ci, 1)}) |`,
      );
    }
  }
  return out.join('\n');
}

export function costTable(T, conds) {
  const out = [
    '| Condition | Model runs, all chains | Model time, all chains, s | Of it, judge rows at both holds | Mean ms a run | Wall of all its processes, s |',
    '|---|---|---|---|---|---|',
  ];
  for (const c of conds) {
    const e = T.cost[c];
    out.push(
      `| ${setName(c)} | ${e.all.runs} | ${d(e.all.ortSeconds, 1)} | ${e.rows.runs} runs, ${d(e.rows.ortSeconds, 1)} s | ${d(e.msPerRun, 1)} | ${d(e.all.wallSeconds, 0)} |`,
    );
  }
  return out.join('\n');
}

export function costChainsTable(T, conds, chains) {
  const out = [
    '| Condition | Chain | Slices | Added by the cancel step | Runs a minute of whole take | Runs a minute of the learner part | At most a minute, padded look on every suspect | Model time this chain needs, s |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const c of conds) {
    for (const ch of chains) {
      const e = T.cost[c].chains[ch];
      const seconds = (e.runs * (T.cost[c].msPerRun ?? 0)) / 1000;
      out.push(
        `| ${setName(c)} | ${ch} | ${e.slices} | ${e.extra} | ${d(e.runsPerMinute, 2)} | ${d(e.runsPerLearnerMinute, 2)} | ${d(e.atMostPerMinute, 2)} | ${d(seconds, 1)} |`,
      );
    }
  }
  return out.join('\n');
}

export function olderTable(T, sets, chains) {
  const out = [
    '| Set | Rule | Hits | Hits /1,000 (95%) | Near | Near /1,000 (95%) | False | False /1,000 (95%) |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const s of sets) {
    for (const c of chains) {
      const e = T.sets[s][c];
      const cnt = x => `${x.kept}/${x.of}${x.added ? ` +${x.added}` : ''}`;
      out.push(
        `| ${setName(s)} | ${c} | ${cnt(e.hit)} | ${rate(e.hit)} | ${cnt(e.near)} | ${rate(e.near)} | ${cnt(e.false)} | ${rate(e.false)} |`,
      );
    }
  }
  return out.join('\n');
}

export function olderDifferenceTable(T, sets) {
  const out = [
    '| Set | Older rule minus S1.P3 | Hits kept, points (95%) | plain two-way | False kept, points (95%) | plain two-way | Hits /1,000 (95%) | plain two-way | False /1,000 (95%) | plain two-way | Reading of the four |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const s of sets) {
    for (const c of ['B', 'C']) {
      const f = T.differences[s].fromReference[c];
      out.push(
        `| ${setName(s)} | ${c} | ${signed(f.hitShare.point, 1)} (${iv(f.hitShare.ci, 1)}) | ${iv(f.hitShare.twoWay, 1)} | ${signed(f.falseShare.point, 1)} (${iv(f.falseShare.ci, 1)}) | ${iv(f.falseShare.twoWay, 1)} | ${signed(f.hitRate.point, 2)} (${iv(f.hitRate.ci, 2)}) | ${iv(f.hitRate.twoWay, 2)} | ${signed(f.falseRate.point, 2)} (${iv(f.falseRate.ci, 2)}) | ${iv(f.falseRate.twoWay, 2)} | ${reading(f.hitShare)} ${reading(f.falseShare)} ${reading(f.hitRate)} ${reading(f.falseRate)} |`,
      );
    }
  }
  return out.join('\n');
}

export function spreadTable(T, sets, chains) {
  const out = [
    '| Set | Chain | Hits shown | Different words | Different readers | Most from one reader | False-correct shown | Most from one reader |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const s of sets) {
    for (const c of chains) {
      const e = T.sets[s][c];
      const fc = e['false-correct'];
      out.push(
        `| ${setName(s)} | ${c} | ${e.hit.shown} | ${e.hit.differentWords} | ${e.hit.differentReaders} | ${e.hit.mostFromOneReader} | ${fc.shown} | ${fc.mostFromOneReader} |`,
      );
    }
  }
  return out.join('\n');
}

export function stepsTable(T, sets) {
  const sum = (s, chain, labels) => {
    const conds = s === 'six voices' ? T.meta.conditions.filter(c => c !== 'none_0') : s === '10 dB' ? T.meta.conditions.filter(c => c.endsWith('_10')) : s === '5 dB' ? T.meta.conditions.filter(c => c.endsWith('_5')) : [s];
    let kept = 0;
    let of = 0;
    for (const c of conds) {
      for (const l of labels) {
        kept += T.allChains[c][chain][l].kept;
        of += T.allChains[c][chain][l].of;
      }
    }
    return `${kept}/${of}`;
  };
  const CH = ['S1.none', 'N1.P3', 'J.P2', 'S1.P3', 'S1h0.none', 'S1h0.P3'];
  const out = [
    `| Set | Marks | ${CH.join(' | ')} |`,
    `|---|---|${CH.map(() => '---').join('|')}|`,
  ];
  for (const s of sets) {
    out.push(`| ${setName(s)} | hits | ${CH.map(c => sum(s, c, ['hit'])).join(' | ')} |`);
    out.push(`| ${setName(s)} | false | ${CH.map(c => sum(s, c, ['false-incorrect', 'false-correct'])).join(' | ')} |`);
  }
  return out.join('\n');
}

export function cursorTable(T, sets, chains) {
  const out = [
    '| Set | Chain | Hits, cursor slices | Hits, tracker frames | False, cursor slices | False, tracker frames | Cursor minus frames: hits /1,000 (95%) | false /1,000 (95%) | Under cursor slices, chain minus S1.P3: hits /1,000 (95%) | false /1,000 (95%) |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  const cnt = x => `${x.kept}/${x.of}${x.added ? ` +${x.added}` : ''}`;
  for (const s of sets) {
    if (!T.cursor.sets[s]) continue;
    for (const c of chains) {
      const e = T.cursor.sets[s][c];
      const f = T.sets[s][c];
      const m = e.minusReference;
      out.push(
        `| ${setName(s)} | ${c} | ${cnt(e.hit)} | ${cnt(f.hit)} | ${cnt(e.false)} | ${cnt(f.false)} | ${signed(e.minusFrames.hitRate.point, 2)} (${iv(e.minusFrames.hitRate.ci, 2)}) | ${signed(e.minusFrames.falseRate.point, 2)} (${iv(e.minusFrames.falseRate.ci, 2)}) | ${m ? `${signed(m.hitRate.point, 2)} (${iv(m.hitRate.ci, 2)})` : '-'} | ${m ? `${signed(m.falseRate.point, 2)} (${iv(m.falseRate.ci, 2)})` : '-'} |`,
      );
    }
  }
  return out.join('\n');
}

export function glanceTable(T, chains) {
  const voices = T.meta.conditions.filter(c => c !== 'none_0');
  const out = [
    '| Chain | Clean: hits, false on the list | Clean: hits, false /1,000 | Six voices: hits, false kept, whole set | Six voices: hits, false /1,000 | Hits per false mark, six voices | Model runs a minute of the learner part, clean, voices |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const c of chains) {
    const a = T.sets.none_0[c];
    const v = T.sets['six voices'][c];
    const ratio = v.false.per1000Whole ? v.hit.per1000Whole / v.false.per1000Whole : NaN;
    let cost = '-';
    if (T.cost.none_0.chains[c]) {
      const runs = voices.reduce((n, x) => n + T.cost[x].chains[c].runsLearner, 0);
      const minutes = voices.reduce((n, x) => n + T.cost[x].chains[c].learnerMinutes, 0);
      cost = `${d(T.cost.none_0.chains[c].runsPerLearnerMinute, 1)}, ${d(runs / minutes, 1)}`;
    }
    out.push(
      `| ${c} | ${a.hit.shown}, ${a.false.shown} | ${d(a.hit.per1000Whole, 2)}, ${d(a.false.per1000Whole, 2)} | ${d(v.hit.shareWhole, 0)}%, ${d(v.false.shareWhole, 0)}% | ${d(v.hit.per1000Whole, 2)}, ${d(v.false.per1000Whole, 2)} | ${d(ratio, 2)} | ${cost} |`,
    );
  }
  return out.join('\n');
}

export function decisionsTable(T, sets, chains) {
  const out = [
    '| Choice | Set | Hits shown: it against S1.P3 | False shown: it against S1.P3 | Hits kept, points (95%) | False kept, points (95%) | Hits /1,000 (95%) | False /1,000 (95%) |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const c of chains) {
    for (const s of sets) {
      const f = T.differences[s].fromReference[c];
      const e = T.sets[s][c];
      const r = T.sets[s]['S1.P3'];
      out.push(
        `| ${CHAIN_NAMES[c]} | ${setName(s)} | ${e.hit.shown} against ${r.hit.shown} | ${e.false.shown} against ${r.false.shown} | ${signed(f.hitShare.point, 1)} (${iv(f.hitShare.ci, 1)}) | ${signed(f.falseShare.point, 1)} (${iv(f.falseShare.ci, 1)}) | ${signed(f.hitRate.point, 2)} (${iv(f.hitRate.ci, 2)}) | ${signed(f.falseRate.point, 2)} (${iv(f.falseRate.ci, 2)}) |`,
      );
    }
  }
  return out.join('\n');
}

export function cleanBothWaysTable(T, parity, chains) {
  const out = [
    '| Chain | Hits, RULE.md slices | Hits, tracker frames | Near, RULE.md slices | Near, tracker frames | False, RULE.md slices | False, tracker frames |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const c of chains) {
    const a = parity.requested[c].mine;
    const b = T.sets.none_0[c];
    out.push(
      `| ${c} | ${a.hit.kept}/${a.hit.of} | ${b.hit.kept}/${b.hit.of} | ${a.near.kept}/${a.near.of} | ${b.near.kept}/${b.near.of} | ${a['false-incorrect'].kept + a['false-correct'].kept}/${a['false-incorrect'].of + a['false-correct'].of} | ${b.false.kept}/${b.false.of} |`,
    );
  }
  return out.join('\n');
}

export function lengthTable(T, sets, chains) {
  const out = [
    '| Set | Chain | Share of marks on a labelled word | Share by chance, any reachable word | Share by chance, same length class | Hits against same-length chance |',
    '|---|---|---|---|---|---|',
  ];
  for (const s of sets) {
    for (const c of chains) {
      const e = T.chance[s][c];
      out.push(
        `| ${setName(s)} | ${c} | ${d((100 * e.hits) / e.marks, 0)}% | ${d((100 * e.mean) / e.marks, 0)}% | ${d((100 * e.sameLengthMean) / e.marks, 0)}% | ${d(e.hits / e.sameLengthMean, 2)} times |`,
      );
    }
  }
  return out.join('\n');
}

// A compact form of the same numbers, for the job's return value.
const short = (x, n = 2) => (x ? `${d(x.lo, n)}..${d(x.hi, n)}` : '-');
export function compactMain(T, sets, chains) {
  const out = ['| Set | Chain | Hits | Near | F-inc | F-cor | Hits /1k | Near /1k | F-inc /1k | F-cor /1k |', '|---|---|---|---|---|---|---|---|---|---|'];
  const r = e => `${d(e.per1000Whole, 1)} (${short(e.per1000WholeCi, 1)})`;
  for (const s of sets) {
    for (const c of chains) {
      const e = T.sets[s][c];
      out.push(`| ${setName(s)} | ${c} | ${count(e.hit)} | ${count(e.near)} | ${count(e['false-incorrect'])} | ${count(e['false-correct'])} | ${r(e.hit)} | ${r(e.near)} | ${r(e['false-incorrect'])} | ${r(e['false-correct'])} |`);
    }
  }
  return out.join('\n');
}
export function compactPools(T, sets, chains) {
  const out = ['| Set | Chain | Hits kept: list, whole (95%) | False kept: list, whole (95%) | Hits minus false pts (95%) | Minus S1.P3: hits kept pts | false kept pts | hits /1k | false /1k |', '|---|---|---|---|---|---|---|---|---|'];
  for (const s of sets) {
    for (const c of chains) {
      const e = T.sets[s][c];
      const o = T.differences[s].own[c];
      const f = T.differences[s].fromReference[c];
      const dd = (x, n) => (f ? `${signed(x.point, n)} (${short(x.ci, n)})` : '-');
      out.push(`| ${setName(s)} | ${c} | ${d(e.hit.shareList, 0)}%, ${d(e.hit.shareWhole, 0)}% (${short(e.hit.shareWholeCi, 0)}) | ${d(e.false.shareList, 0)}%, ${d(e.false.shareWhole, 0)}% (${short(e.false.shareWholeCi, 0)}) | ${signed(o.separation.point, 0)} (${short(o.separation.ci, 0)}) | ${f ? dd(f.hitShare, 1) : '-'} | ${f ? dd(f.falseShare, 1) : '-'} | ${f ? dd(f.hitRate, 2) : '-'} | ${f ? dd(f.falseRate, 2) : '-'} |`);
    }
  }
  return out.join('\n');
}
export function compactChance(T, sets, chains, kind) {
  const out = [`| Set | ${chains.join(' | ')} |`, `|---|${chains.map(() => '---').join('|')}|`];
  const p = x => (x < 0.001 ? '<.001' : d(x, 3).replace(/^0/, ''));
  for (const s of sets) {
    out.push(`| ${setName(s)} | ${chains.map(c => {
      const e = T.chance[s][c];
      if (kind === 'all') return `${e.hits} v ${d(e.mean)} (${p(e.p)})`;
      if (kind === 'length') return `${e.hits} v ${d(e.sameLengthMean)} (${p(e.sameLengthP)})`;
      return `${e.newHits} v ${d(e.newMean)} (${p(e.newP)})`;
    }).join(' | ')} |`);
  }
  return out.join('\n');
}
export function compactSplit(T, sets, chains) {
  const out = ['| Set | Chain | Hits, consonant | Hits, vowels only | False, others changed | False, nobody changed |', '|---|---|---|---|---|---|'];
  const cell = x => `${x.kept}/${x.of}${x.added ? ` +${x.added}` : ''}`;
  for (const s of sets) {
    for (const c of chains) {
      const p = T.split[s][c];
      out.push(`| ${setName(s)} | ${c} | ${cell(p.hitConsonant)} | ${cell(p.hitVowels)} | ${cell(p.falseOthersChanged)} | ${cell(p.falseNobodyChanged)} |`);
    }
  }
  return out.join('\n');
}
export function compactCost(T, conds, chains) {
  const out = [`| Condition | Model runs | Model time s | ms a run | ${chains.join(' | ')} |`, `|---|---|---|---|${chains.map(() => '---').join('|')}|`];
  for (const c of conds) {
    const e = T.cost[c];
    out.push(`| ${setName(c)} | ${e.all.runs} | ${d(e.all.ortSeconds, 0)} | ${d(e.msPerRun, 0)} | ${chains.map(ch => `${d(e.chains[ch].runsPerMinute, 2)}, ${d(e.chains[ch].runsPerLearnerMinute, 1)}`).join(' | ')} |`);
  }
  return out.join('\n');
}
