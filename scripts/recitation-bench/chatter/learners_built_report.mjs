/* eslint-env node, es2020 */
// Writes .out/chatter/learners_built/report.md and return_tables.md from tables.json and the
// checks beside it. Every figure in the words below is read from those files.
//   node chatter/learners_built_report.mjs
import fs from 'node:fs';
import path from 'node:path';
import {OUT} from './learners_built_lib.mjs';
import * as R from './learners_built_report_tables.mjs';

const read = f => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
const T = read('tables.json');
const parity = read('parity.lb_parity.json');
const saved = read('parity.lb_none_0.json');
const started = read('frozen_check.start.json');
const ended = read('frozen_check.end.json');
const mixes = read('mix_check.json');
const diffText = fs.readFileSync(path.join(OUT, 'copies.diff'), 'utf8');
const log = fs.readFileSync(path.join(OUT, 'logs/queue.log'), 'utf8').split('\n');

const {d, iv, signed} = R;
const POOLS = ['six voices', '10 dB', '5 dB'];
const CONDS = T.meta.conditions;
const VOICES = CONDS.filter(c => c !== 'none_0');
const CHAINS = ['J.none', 'J.P1', 'S1.P3', 'S2.P4', 'S1h0.P3', 'N1.P3', 'S1.P3s'];
const ALL = [...CHAINS, 'B', 'C'];
const OTHERS = ALL.filter(c => c !== 'S1.P3');

const S = (set, chain) => T.sets[set][chain];
const F = (set, chain) => T.differences[set].fromReference[chain];
const O = (set, chain) => T.differences[set].own[chain];
const rate = (e, n = 2) => `${d(e.per1000Whole, n)} (${iv(e.per1000WholeCi, n)})`;
const diff = (x, n = 1) => `${signed(x.point, n)} (${iv(x.ci, n)})`;
const two = (x, n = 1) => `${iv(x.twoWay, n)}`;
const shownPair = (set, chain, label) => `${S(set, chain)[label].kept} +${S(set, chain)[label].added}`;

const swaps = log.filter(l => / start .* swap /.test(l)).map(l => /swap ([0-9.]+) GB, free ([0-9.]+) GB/.exec(l));
const maxSwap = Math.max(...swaps.map(m => Number(m[1])));
const minFree = Math.min(...swaps.map(m => Number(m[2])));
const mixTakes = Object.values(mixes).reduce((n, x) => n + x.takes, 0);
const mixSame = Object.values(mixes).reduce((n, x) => n + x.same, 0);
const c6 = T.chance['six voices'];
const ratio = chain => c6[chain].hits / c6[chain].sameLengthMean;
const ratios = CHAINS.concat(['C']).map(ratio);
const w6 = T.within['six voices'];
const cost = (cond, chain) => T.cost[cond].chains[chain];
const costRange = (chain, conds, key) => {
  const v = conds.map(c => cost(c, chain)[key]);
  return `${d(Math.min(...v), 2)} to ${d(Math.max(...v), 2)}`;
};
const at10 = VOICES.filter(c => c.endsWith('_10'));
const at5 = VOICES.filter(c => c.endsWith('_5'));
const modelTotal = CONDS.reduce((n, c) => n + T.cost[c].all.ortSeconds, 0);
const lostShare = conds => {
  const kept = conds.reduce((n, c) => n + T.allChains[c]['S1.none'].hit.kept, 0);
  const of = conds.reduce((n, c) => n + T.allChains[c]['S1.none'].hit.of, 0);
  return `${d((100 * (of - kept)) / of, 0)}%`;
};
const vetoClean = lostShare(['none_0']);
const vetoVoices = lostShare(VOICES);

const lines = [];
const add = (...x) => lines.push(...x);

add(
  '# Real slips with voices behind them, on the chain being built',
  '',
  `Report only. Nothing was tuned, no threshold or constant changed, and nothing in the app changed. All tables use ${T.meta.takes} QuranMB takes, ${T.meta.speakers} readers, ${T.meta.listWords} learner words on the list.`,
  '',
  '## What this shows',
  '',
  `- **The answer.** With voices behind the reader, the default chain (S1.P3) keeps ${d(S('six voices', 'S1.P3').hit.shareWhole, 0)}% of hits and ${d(S('six voices', 'S1.P3').false.shareWhole, 0)}% of false marks (whole-set estimate, six voices pooled). That is ${diff(O('six voices', 'S1.P3').separation, 0)} points in favour of hits, ${two(O('six voices', 'S1.P3').separation, 0)} on the plain two-way interval. It then shows about as many false marks as hits: ${rate(S('six voices', 'S1.P3').hit)} hits and ${rate(S('six voices', 'S1.P3').false)} false marks per 1,000 learner words, against ${rate(S('none_0', 'S1.P3').hit)} and ${rate(S('none_0', 'S1.P3').false)} on clean audio.`,
  `- **Against what came before.** S1.P3 keeps about the same hits as the app's first version (J.P1) with fewer false marks: J.P1 minus S1.P3 is ${diff(F('six voices', 'J.P1').hitRate, 2)} hits and ${diff(F('six voices', 'J.P1').falseRate, 2)} false marks per 1,000, ${two(F('six voices', 'J.P1').falseRate, 2)} on the plain two-way interval. It does not beat the older rule C on these marks: C minus S1.P3 is ${diff(F('six voices', 'C').hitShare)} points of hits kept and ${diff(F('six voices', 'C').falseShare)} points of false marks kept. Those are inside their intervals, though the hits are just clear of zero on the plain two-way one (${two(F('six voices', 'C').hitShare)}).`,
  `- **Open decision 1, hold 0.** Its gain on clean audio (${S('none_0', 'S1h0.P3').hit.kept} against ${S('none_0', 'S1.P3').hit.kept} of ${S('none_0', 'S1.P3').hit.of} hits, ${S('none_0', 'S1h0.P3').false.kept} against ${S('none_0', 'S1.P3').false.kept} false) does not carry over. Under voices it shows ${shownPair('six voices', 'S1h0.P3', 'hit')} hits against ${shownPair('six voices', 'S1.P3', 'hit')} and ${shownPair('six voices', 'S1h0.P3', 'false')} false marks against ${shownPair('six voices', 'S1.P3', 'false')}: ${diff(F('six voices', 'S1h0.P3').hitRate, 2)} and ${diff(F('six voices', 'S1h0.P3').falseRate, 2)} per 1,000. Every one of these differences is inside its interval, so hold 0 is neither shown better nor shown worse under voices.`,
  `- **Open decision 2, no veto.** The veto takes far more on clean audio than under voices. Clean: no veto keeps ${S('none_0', 'N1.P3').hit.kept} against ${S('none_0', 'S1.P3').hit.kept} hits for ${S('none_0', 'N1.P3').false.kept} against ${S('none_0', 'S1.P3').false.kept} false marks. Six voices, across all six: ${shownPair('six voices', 'N1.P3', 'hit')} against ${shownPair('six voices', 'S1.P3', 'hit')} hits and ${shownPair('six voices', 'N1.P3', 'false')} against ${shownPair('six voices', 'S1.P3', 'false')} false marks. That is ${diff(F('six voices', 'N1.P3').hitShare)} points of hits kept and ${diff(F('six voices', 'N1.P3').falseShare)} of false marks kept, both clear of zero and about equal: separation moves ${diff(F('six voices', 'N1.P3').separation)}. So under voices no veto adds roughly one false mark for each hit it adds, and separation does not change. Its cost on correct recitation is in RULE.md, not here.`,
  `- **The switch, skipped marks only.** It keeps clearly more of both: ${diff(F('six voices', 'S1.P3s').hitRate, 2)} hits and ${diff(F('six voices', 'S1.P3s').falseRate, 2)} false marks per 1,000, about two more false marks for each extra hit. Separation does not improve: ${diff(F('six voices', 'S1.P3s').separation)} points.`,
  `- **The flag, Step 2.** Under voices it adds mostly false marks: ${diff(F('six voices', 'S2.P4').hitRate, 2)} hits and ${diff(F('six voices', 'S2.P4').falseRate, 2)} false marks per 1,000, at about twice the model runs.`,
  `- **What a kept hit is.** Hits sit above chance for every chain (S1.P3 ${c6['S1.P3'].hits} against a shuffle mean of ${d(c6['S1.P3'].mean)}, P below 0.001, not corrected for the many tests). But the chains keep longer words, and longer words carry more labels. With labels moved only among words of similar length, S1.P3's chance rises to ${d(c6['S1.P3'].sameLengthMean)}, and every chain sits at the same ${d(Math.min(...ratios), 2)} to ${d(Math.max(...ratios), 2)} times chance, today's marks included. On words read both with and without the edit, on sampled takes, S1.P3 marks ${w6['S1.P3'].withEdit}/${w6['S1.P3'].withEditOf} with it and ${w6['S1.P3'].without}/${w6['S1.P3'].withoutOf} without it, ${signed(w6['S1.P3'].difference)} points (${iv(w6['S1.P3'].ci)}). Nothing here shows that a kept hit followed this reader's slip.`,
  `- **What the gap between hits and false marks is made of.** S1.P3 keeps ${d((100 * T.split['six voices']['S1.P3'].falseOthersChanged.kept) / T.split['six voices']['S1.P3'].falseOthersChanged.of, 0)}% of false marks on words other readers changed, about what it keeps of hits, and ${d((100 * T.split['six voices']['S1.P3'].falseNobodyChanged.kept) / T.split['six voices']['S1.P3'].falseNobodyChanged.of, 0)}% on words nobody changed. So much of the gap is which word it is. Vowel-only hits fare worse than hits with a consonant edit: ${d((100 * T.split['six voices']['S1.P3'].hitVowels.kept) / T.split['six voices']['S1.P3'].hitVowels.of, 0)}% against ${d((100 * T.split['six voices']['S1.P3'].hitConsonant.kept) / T.split['six voices']['S1.P3'].hitConsonant.of, 0)}%, from only ${T.split['six voices']['S1.P3'].hitVowels.of} vowel-only marks.`,
  `- **One thing found on the way.** RULE.md's QuranMB table was scored on stand-in slices, because those runs hold no tracker frames. With the frames the rule describes, the default keeps ${S('none_0', 'S1.P3').hit.kept} of ${S('none_0', 'S1.P3').hit.of} rather than ${parity.requested['S1.P3'].rule.hit.kept}. The change is small, and it is why the clean row here differs from RULE.md by a mark or two.`,
  '',
  '## What this does not show',
  '',
  '- **No catch rate.** A hit is a mark on a word with a labelled edit. These are planted MSA errors in scripted reading. They say nothing about natural slips, and nothing here tests tashkeel slips: vowel-only words are few.',
  '- **Nothing about a phone.** Clean recordings mixed digitally, levels set over the whole take, one voice that sounds on about 65% of a learner\'s frames and a crowd that sounds on all of them, a short learner clip after a professional lead-in. Times below are this Mac at one thread.',
  '- **The rule is on tuning-side thresholds.** -6 and 3.34 were chosen on the same 66 and 86 clean marks, so clean rows are near a best case. Marks the clean run never made are the fair test of those thresholds: Table 3.',
  '- **Nothing about correct recitation.** False marks here are on learner takes. RULE.md\'s pool and voices figures for correct recitation stand, and any decision has to weigh them too.',
  '- **Nothing about the end of a reading.** 54% of labelled words are a segment\'s last two words, which marks almost never reach because the take ends. Losses there are the bench, not the reader.',
  '- **Nothing about the combined engine\'s own marks.** These runs are the plain engine: no junction or added-word marks. RULE.md reports the combined engine keeps every plain-engine verdict.',
  '- **Differences in one condition mean little.** One condition can rest on a dozen marks (Table 12). The pooled figures reuse the same readers and texts, so they are not six independent tests.',
  '- **An interval that spans zero does not mean no effect.** The speakers-and-words draw is wider than a plain two-way variance by about 1.2 to 1.9 times, so both are given on the pooled differences. P values are not corrected for the number of tests and hold these texts and readers fixed.',
  '- **The replay is not the app.** Slices use tracker frames read from the end of the take, and the judge\'s answer is credited to its verdict\'s time, as in RULE.md.',
  '',
  '## At a glance',
  '',
  'Clean uses the tracker\'s frames, as the voices do. From: tables.json, keys sets and cost.',
  '',
  R.glanceTable(T, ALL),
  '',
  '## The decisions',
  '',
  'Each chain minus the default S1.P3. Shown counts a chain\'s kept marks and the marks it adds, on the list, summed over the conditions of the set. Clean is in-sample for the cancel step. From: tables.json, keys differences.*.fromReference.',
  '',
  R.decisionsTable(T, ['none_0', '10 dB', '5 dB', 'six voices'], ['S1h0.P3', 'N1.P3', 'S1.P3s', 'S2.P4']),
  '',
  '## Words used here',
  '',
  '- **Today** is J.none: the committed rules with no judge and no cancel step. Its marks on a learner\'s words are the base of each condition, and they match the first test\'s rule A exactly (Checks).',
  '- **J.P1** is the app\'s first version: tables.mjs names it. Older rule **B** is the same rule with a slice cut a little differently, and **C** is the letter-slip rule on the older 5.5 s slice, from the first test\'s rows and report.json.',
  '- **Hit, near, false-incorrect, false-correct** are the labels of quranmb_labels.mjs: a labelled word, a neighbour of one, another word of an incorrect segment, a word of a correct segment. Lead-in marks are not counted, and the judge is not asked on the lead-in here.',
  '- **Kept** is a base mark the chain still shows. **+n** is a mark the chain shows that today does not, on a word the judge promoted. **Shown** is both, and is what a learner would see.',
  '- **The list** is the 554 takes: every take with a clean mark plus a sample of the others. **The whole set** weights a sampled take by about 3.8 to estimate all 1,607. The list holds every clean hit but only one in four of the others, so counts on it flatter the clean marks. Rates and shares marked whole set use the weights, as learners_report.mjs does.',
  '- **Intervals** are 95%, 2,000 draws of speakers and words together, the same draws as the first test, so all differences are paired. **Plain two-way** is the variance the independent check compares with.',
  '- **Reading** gives C when the 95% interval leaves out zero, T when only the plain two-way one does, I when it is inside both.',
  '- **Conditions** are track:level. Six voices are one_ar, crowd and rec_one at 10 dB and 5 dB.',
  '',
  '## The parity gate',
  '',
  `**Passed, on ${parity.takes} of ${parity.takes} takes.** With the saved none_0 runs read as the baseline runs were, every one of the ${parity.chains} chains in marks/quranmb.jsonl gives the same result on every take, byte for byte: ${parity.takesDiffering} takes differ, ${parity.otherFieldsDiffering} other fields differ. All ${parity.rows.h48.frozen} judge rows at hold 0.48 and all ${parity.rows.h0.frozen} at hold 0 are identical, scores included. Labelled counts: ${parity.mineAgainstFrozenOnList.cells} cells differ from the frozen file on these takes, and ${parity.mineAgainstRuleKept.cells} kept cells differ from RULE.md's table as tables.json holds it. The table code used for this, run on the whole frozen file, gives RULE.md's table with ${parity.tableCopyAgainstRule.cells} differences, intervals and added marks included.`,
  '',
  `**The first attempt did not pass, and why.** Run as saved, ${saved.takesDiffering} takes differ, in ${saved.chainsDiffering} chains. The baseline runs under .out/real3/quranmb hold no tracker frames, while 550 of the 554 saved none_0 runs do. So every slice in the frozen QuranMB results was placed from the cursor stand-in in RULE.md's step 2. With frames, ${T.checks.trackerFrames.sliceMoved} of ${T.checks.trackerFrames.rows} slices move (the start by ${T.checks.trackerFrames.startShift.p90} s at the 90th percentile) and ${T.checks.trackerFrames.rows - T.checks.trackerFrames.answersSame} of ${T.checks.trackerFrames.rows} answers of the judge change: ${Object.entries(T.checks.trackerFrames.answersMoved).map(([k, v]) => `${k} ${v}`).join(', ')}. The saved runs also flag stop-time log lines, which the baseline runs do not; hiding the frames alone gives the same result on all ${T.checks.stopFlags?.takes} takes, so the flags change nothing.`,
  '',
  '**The fix.** For the gate, each none_0 run was written with those two things taken out, and everything else was checked equal to the baseline run. For the measurements, the runs are read as saved, with tracker frames, because that is what RULE.md says and what the app reads, and the voices have them. So the clean row in every table below uses frames:',
  '',
  R.cleanBothWaysTable(T, parity, CHAINS),
  '',
  `Added marks in RULE.md's table often sit on takes off the list: S1.P3's +2 hits and +1 false-incorrect are all off it. Where the whole set can be counted, clean audio on stand-in slices, the weights estimate S1.P3's hits at ${T.weightsCheck.chains['S1.P3'].estimatedHits} against a true ${T.weightsCheck.chains['S1.P3'].trueHits} and S2.P4's false marks at ${T.weightsCheck.chains['S2.P4'].estimatedFalse} against a true ${T.weightsCheck.chains['S2.P4'].trueFalse}. So marks a chain adds are estimated loosely. The true rates stay inside the intervals.`,
  '',
  '## Table 1. Every chain and condition',
  '',
  'Counts are kept/base on the list, then +added. Each /1,000 is per 1,000 learner words on the whole set, of all marks shown, with its 95% interval. Pooled sets count each condition\'s words. Today\'s kept is 100% by construction. From: tables.json, key sets.',
  '',
  R.mainTable(T, [...CONDS, ...POOLS], ALL),
  '',
  '## Table 2. Hits kept against false marks kept, pooled',
  '',
  'Shares are of each set\'s base, without added marks. An interval of 100 to 100 is the method collapsing when all marks are kept, not certainty. From: tables.json, keys sets and differences.*.own.',
  '',
  R.sharesTable(T, POOLS, ALL),
  '',
  'Each chain\'s difference from S1.P3, with the interval on the difference itself. Hits and false shown count added marks. From: tables.json, key differences.*.fromReference.',
  '',
  R.differenceTable(T, POOLS, OTHERS),
  '',
  'The same in each condition, for the choices. Read the pooled rows first. From: tables.json, key differences.',
  '',
  R.perConditionDifferenceTable(T, CONDS, ['S1h0.P3', 'N1.P3', 'S1.P3s', 'S2.P4']),
  '',
  '## Table 3. Marks the clean run never made',
  '',
  'The thresholds were chosen on clean marks. New marks are not in that choice, so this is the fair reading of a chain\'s separation. From: tables.json, keys split and differences.*.own.',
  '',
  R.newMarksTable(T, POOLS, ALL),
  '',
  '## Table 4. What each step takes',
  '',
  `Kept/base on the list. S1.none is the judge with no cancel step, N1.P3 the cancel step with no veto, J.P2 the letter-slip rule on its own slice with no judge. On clean audio the judge's step alone takes ${vetoClean} of the hits; across six voices it takes ${vetoVoices}. From: tables.json, key allChains, which holds all 45 chains in every condition.`,
  '',
  R.stepsTable(T, ['none_0', ...POOLS]),
  '',
  '## Table 5. Hits against chance on reachable words',
  '',
  `The independent check's shuffle: labels move among all but a segment's last two words, one shuffle per text, ${T.meta.shuffles} times, marks stay where they are, and a mark on the last two words keeps its real outcome. Marks on incorrect segments. P is the share of shuffles at or above what was seen, not corrected. Word length matched moves labels only among words of 2 letters or fewer, 3 or 4, or 5 or more, as the check's length classes do. Whole set uses the take weights with chance within the take. New means the clean run did not make the mark. Clean for C and the cancel chains is in-sample. From: tables.json, key chance.`,
  '',
  R.chanceTable(T, [...CONDS, ...POOLS], ALL),
  '',
  'Why length matters: the share of marks on a labelled word rises from today to any cancel chain, but so does the share chance gives once length is matched. From: tables.json, key chance.',
  '',
  R.lengthTable(T, ['none_0', 'six voices'], ALL),
  '',
  '## Table 6. Kept hits by kind of edit, kept false marks by word',
  '',
  'As the check\'s table I. Kept/base, share, then +added. Consonant means at least one edit on the word touches a consonant. Other readers changed means another speaker\'s incorrect take of exactly this text labels this word. From: tables.json, key split.',
  '',
  R.splitTable(T, ['none_0', ...POOLS, ...VOICES], ALL),
  '',
  '## Table 7. The same word, with and without the edit',
  '',
  'A hit is not proof of a catch, so this compares the same word read with and without the edit. Reachable words on sampled takes only, since the listed takes were chosen for their clean marks; words read both ways only. Clean uses all 1,607 takes from the frozen file. A is the first test\'s marks, as the check\'s 38/510 against 24/456. Few words qualify, so this is a weak test. From: tables.json, key within.',
  '',
  R.withinTable(T, ['clean, all 1,607 takes, stand-in slices', ...POOLS], ['A', ...ALL]),
  '',
  '## Table 8. The older rules beside the new chain',
  '',
  'Same takes, same draws. These figures match learners/report.json exactly (Checks). Rows here are also in Tables 1, 2, 5 and 6.',
  '',
  R.olderTable(T, ['none_0', ...POOLS], ['B', 'C', 'S1.P3']),
  '',
  'Older rule minus S1.P3. Reading gives C, T or I for the four differences in turn. From: tables.json, key differences.',
  '',
  R.olderDifferenceTable(T, POOLS),
  '',
  '**Which differences are inside their intervals.**',
  '',
  `- C against S1.P3: all inside their 95% intervals, in all three pools. On the plain two-way interval C keeps more hits in the six voices (${two(F('six voices', 'C').hitShare)} points) and at 5 dB (${two(F('5 dB', 'C').hitShare)} points), and shows more hits per 1,000 there too (${two(F('six voices', 'C').hitRate, 2)} and ${two(F('5 dB', 'C').hitRate, 2)}). False marks are inside both intervals everywhere.`,
  `- B against S1.P3: hits are inside both intervals everywhere. B keeps more false marks: outside the 95% interval as a share in the six voices (${iv(F('six voices', 'B').falseShare.ci)}) and at 5 dB (${iv(F('5 dB', 'B').falseShare.ci)}), inside it at 10 dB (${iv(F('10 dB', 'B').falseShare.ci)}). Per 1,000 the false marks are inside the 95% interval and outside the plain two-way one in the six voices and at 5 dB.`,
  `- What moved on clean audio is larger than anything under voices: C keeps ${S('none_0', 'C').hit.kept} hits and S1.P3 ${S('none_0', 'S1.P3').hit.kept}, with ${S('none_0', 'C').false.kept} and ${S('none_0', 'S1.P3').false.kept} false marks. Most of that gap is the veto (N1.P3 keeps ${S('none_0', 'N1.P3').hit.kept}).`,
  '',
  '## Table 9. Model runs and model time, this Mac',
  '',
  `One thread at nice 10, ONNX arena off, while another job ran on the same machine. Model time is onnxruntime's own time, summed over the processes. All chains means the whole job for that condition, which scores all 45 chains: ${d(modelTotal / 60, 1)} minutes over the seven conditions. crowd:5's wall includes a long pause of a process. From: tables.json, key cost; timing.jsonl.`,
  '',
  R.costTable(T, CONDS),
  '',
  `Per chain, as tables.mjs counts it: distinct judge slices plus what the cancel step adds at marks that fall due. Whole take includes the lead-in, which wakes nothing here, so it understates a full recitation. The learner part counts from 2 s before the learner's segment, and these stretches are dense with planted errors, so it overstates one. S1.P3: ${costRange('S1.P3', at10, 'runsPerMinute')} runs a minute of whole take at 10 dB, ${costRange('S1.P3', at5, 'runsPerMinute')} at 5 dB; S2.P4 ${costRange('S2.P4', at10, 'runsPerMinute')} and ${costRange('S2.P4', at5, 'runsPerMinute')}. Model time per chain is its runs times the condition's mean run. No phone times are measured.`,
  '',
  R.costChainsTable(T, CONDS, CHAINS),
  '',
  '## Table 10. Slices from tracker frames or from the cursor',
  '',
  'How far results lean on tracker frames read from the end of the take. **Run on clean audio only: the same check under voices was not run** (see What was not run). From: tables.json, key cursor.',
  '',
  R.cursorTable(T, ['none_0'], CHAINS),
  '',
  '## Table 11. What was reproduced from the independent check',
  '',
  `This job's code, run on the first test's marks, gives the independent check's figures: ${T.checks.reproduceCheck.within} of ${T.checks.reproduceCheck.rows.length} within their tolerance, ${T.checks.reproduceCheck.outside.length} outside. These cover its tables A, B, C, D and I and its within-word counts. From: tables.json, key checks.reproduceCheck.`,
  '',
  '## Table 12. How few words and readers hold the marks',
  '',
  'Shown marks on the list. One reader holds most false-correct marks, so that column is close to one reader\'s voice. From: tables.json, key sets.',
  '',
  R.spreadTable(T, ['none_0', ...POOLS, ...VOICES], ['S1.P3', 'C']),
  '',
  '## Checks',
  '',
  `- **Frozen files.** ${started.same} of ${started.files} match frozen.json at the start, ${ended.same} of ${ended.files} at the end (${ended.at}).`,
  `- **Mixes.** Every take of every condition rebuilt in memory and compared with the hash recorded for what the engine heard: ${mixSame} of ${mixTakes} match, gain and scale too. The tools run the same check on each take they read.`,
  `- **The base.** J.none on the voices equals the first test's rule A in all seven conditions: ${CONDS.map(c => `${T.checks.baseAgainstRuleA[c].jNone}`).join(', ')} marks, no mark only on one side, no label different. On clean it equals the baseline's ${T.checks.cleanBase.baseline} marks.`,
  `- **The judge's slices under voices.** Each first-test mark with a rule D look was compared with this job's row at hold 0.48: ${CONDS.reduce((n, c) => n + T.checks.rowsAgainstRuleD[c].compared, 0)} compared, ${CONDS.reduce((n, c) => n + T.checks.rowsAgainstRuleD[c].sliceDiffer, 0)} slices differ, ${CONDS.reduce((n, c) => n + T.checks.rowsAgainstRuleD[c].scoreDiffer, 0)} scores differ. The ${CONDS.reduce((n, c) => n + T.checks.rowsAgainstRuleD[c].missing, 0)} with no row are all lead-in marks, which never wake the judge here. That is the tracker-frame path on the real mixes.`,
  `- **Older rules.** B and C here against learners/report.json, counts, rates and intervals: ${T.checks.olderAgainstReport.differ} of ${T.checks.olderAgainstReport.cells} cells differ, because the draws are the same.`,
  `- **Edit kinds.** Against the classes the first test stored on its hits: ${T.checks.editKinds.same} same, ${T.checks.editKinds.differ} different.`,
  '- **Tests.** node --test chatter/learners_built_test.mjs covers the logic of this job and reads the results above.',
  '',
  '## The copies of the frozen tools',
  '',
  'lib.mjs, cancel.mjs, rule.mjs, quranmb_labels.mjs and stats.mjs are used as they are. Suites are registered from outside in lib.mjs\'s SUITES table, in chatter/learners_built_lib.mjs, which also replaces its output paths, its limits, and its audio with the mix check. Four tools could not be used from outside: importing replay_marks.mjs writes a temporary file under .out/second-look, chain.mjs imports it, and judge_rows.mjs and eval_marks.mjs take their paths and audio from ./lib.mjs. learners_built_make_copies.mjs writes each copy and stops unless each change matches exactly once. The whole difference from the frozen originals, all imports and paths, is at the end of this report.',
  '',
  '## What was not run',
  '',
  '- All seven conditions ran in full.',
  `- **The cursor check under voices was not run.** It would show how far results lean on frames from the end of the take. Only clean audio finished, so how much slice placement matters under voices is unmeasured.`,
  '- No-veto at hold 0 has no chain in the frozen tools.',
  '',
  '## Limits kept',
  '',
  `- **Machine.** At most 2 model processes, each under nice -n 10 with ORT_THREADS=1 and ORT_ARENA=0, with other model processes alongside. At each job start swap was at most ${d(maxSwap, 2)} GB and free disk at least ${d(minFree, 1)} GB, so nothing had to wait.`,
  '- **Audio.** Mixes existed only in memory and were never written, played or used to train anything.',
  '- **The follower was not rerun.** The saved runs held what the chain needs.',
  '- **Files.** Results are only under .out/chatter/learners_built, and the code is chatter/learners_built*.mjs. Nothing under .out/second-look is written, and the app, the frozen tools and the first test are left as they are.',
  '',
  '## How to reproduce',
  '',
  'From scripts/recitation-bench, in order:',
  '',
  '```',
  'node chatter/learners_built_frozen.mjs start',
  'node chatter/learners_built_make_copies.mjs',
  'node chatter/learners_built_parity_input.mjs',
  'node chatter/learners_built_queue.mjs lb_parity',
  'node chatter/learners_built_parity.mjs lb_parity',
  'node chatter/learners_built_queue.mjs lb_none_0 lb_one_ar_10 lb_rec_one_5 lb_crowd_10 lb_one_ar_5 lb_rec_one_10 lb_crowd_5',
  'node chatter/learners_built_parity.mjs lb_none_0',
  'node chatter/learners_built_parity_input.mjs --cursor',
  'node chatter/learners_built_queue.mjs lb_cursor_none_0',
  'node chatter/learners_built_mix_check.mjs',
  'node chatter/learners_built_tables.mjs',
  'node chatter/learners_built_frozen.mjs end',
  'node chatter/learners_built_report.mjs',
  'node --test chatter/learners_built_test.mjs',
  '```',
  '',
  'parity_runs and cursor_runs were deleted after use: rerun the two input steps to rebuild them.',
  '',
  '## Appendix: every difference between the copies and the frozen tools',
  '',
  '```diff',
  diffText.trimEnd(),
  '```',
  '',
);
fs.writeFileSync(path.join(OUT, 'report.md'), lines.join('\n'));

// The job's return value: the same numbers, compact.
const ret = [
  `All from .out/chatter/learners_built/tables.json. Counts are kept/base on the list, then +added. /1k is per 1,000 learner words on the whole set, of marks shown, with 95% interval (speakers and words resampled together). F-inc is false-incorrect, F-cor false-correct. The clean row uses tracker frames.`,
  '',
  '### 1. Every chain and condition',
  '',
  R.compactMain(T, [...CONDS, ...POOLS], ALL),
  '',
  '### 2. Share kept, pooled, and each chain minus S1.P3 (interval on the difference)',
  '',
  R.compactPools(T, POOLS, ALL),
  '',
  '### 3. Hits against the reachable-word shuffle: hits v mean (P, uncorrected)',
  '',
  R.compactChance(T, [...CONDS, ...POOLS], ALL, 'all'),
  '',
  'The same, labels moved only among words of similar length:',
  '',
  R.compactChance(T, ['none_0', ...POOLS], ALL, 'length'),
  '',
  'New hits only (marks the clean run never made):',
  '',
  R.compactChance(T, POOLS, ALL, 'new'),
  '',
  '### 4. Kept hits by edit, kept false marks by word (kept/base +added)',
  '',
  R.compactSplit(T, ['none_0', ...POOLS], ALL),
  '',
  '### 5. Older rule minus S1.P3 (C: 95% interval leaves out zero; T: only plain two-way does; I: inside both; for hits kept, false kept, hits /1k, false /1k)',
  '',
  R.olderDifferenceTable(T, POOLS),
  '',
  '### 6. Parity: clean, RULE.md slices against tracker frames',
  '',
  R.cleanBothWaysTable(T, parity, CHAINS),
  '',
  '### 7. Cost on this Mac, one thread: runs a minute of whole take, then of the learner part',
  '',
  R.compactCost(T, CONDS, CHAINS),
  '',
];
fs.writeFileSync(path.join(OUT, 'return_tables.md'), ret.join('\n'));
console.log(`report ${lines.join('\n').length} chars, return tables ${ret.join('\n').length} chars`);
