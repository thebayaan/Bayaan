# Real slips under voices

Measures what people talking or reciting nearby do to real slips: QuranMB learner takes
with a voice mixed behind them, through the follower and then each frozen rule for the
second model. The chatter test in `README.md` measures false marks on correct recitation;
this one measures the marks that land on labelled errors.

## Boundaries

- Test only. Nothing trains on these mixes and they are never played to anyone.
- The recitation is only added to, exactly as `run.mjs` does it (`mix.mjs`).
- Mixed audio exists only while its condition runs. The rule pass rebuilds a take's mix in
  memory and checks its hash against the one the engine heard.
- Quran text is never changed or shown. Rows hold word ids and scores, no spellings.
- Clip and speaker ids stay under `.out/`.

## Running

```sh
node chatter/learners_clips.mjs                       # writes clips.json
node --test chatter/learners_test.mjs

# One condition at a time. Check swap and free disk before each.
nice -n 10 node chatter/learners_run.mjs --cond none:0 --jobs 3
node chatter/learners_parity.mjs                      # must say "same": true
node chatter/learners_rules.mjs --cond none:0         # one process, ONNX arena off
node chatter/learners_repro.mjs [path/to/marks.feat.jsonl]

# Then, in this order: one_ar:10 crowd:10 rec_one:10 one_ar:5 crowd:5 rec_one:5
node chatter/learners_report.mjs                      # report.md, report.json
```

Everything lands in `.out/chatter/learners/`. Runs and rule passes resume. `run.mjs` is not
used because this set is takes with lead-ins, not the natural pool, but the mix is the same
code and the runs go through the same `natural/run_suite.mjs` and `bench.mjs`.

The engine is pinned: `learners_run.mjs` runs on `.out/chatter/learners/engine/dist` and stops
unless its hash starts `dd826fc14f1b`, the engine the baseline ran on (the pristine package plus
`patches/@tilawa+core+0.4.0.patch` at commit 1363726b). Put a copy there before the first run.
Another job can change `node_modules` during a long test, and did during this one.

## Clips

Every QuranMB take holding a mark of the clean baseline (`.out/real3/marks.jsonl`), so all 66
hits, 52 near, 70 false-incorrect, 16 false-correct and 3 lead-in marks, plus a seeded shuffle
of the other takes drawn per label in proportion to the other takes' labels, up to about 300
minutes. A take is a professional lead-in (about 25 s) and a learner clip (about 4 s), so 297
minutes hold 39 minutes of learners and about 2,900 learner words.

Because the list holds every take with a clean mark, plain rates at `none:0` are inflated and
voices look better than they are against them. The report's "whole set" rate weights each take
by its chance of being listed, which estimates all 1,607 takes.

## Labels

`score_real.mjs` itself, unedited, with one frozen copy of the mark rules for the whole test
(`wordMarks.frozen.ts`, the same as `services/recitation/wordMarks.ts` when the test started).

## The rules

Frozen. Nothing here chooses a threshold.

- **A**: no second look.
- **B**: `services/recitation/secondLook/`, as `scripts/second-look/after_verdict.mjs` reproduces
  it: t - 4.6 s to t + 0.9 s around the mark's latest bad verdict, clipped to the whole chunks
  fed when the mark falls due, cancel above -2 per letter.
- **C**: the letter-slip rule on that slice: keep at or below -6 per letter, or when a padded look
  (word +-0.3 s from the first pass's alignment, 1 s of digital silence each side, word scored
  alone with free frames) finds a spelling with one inner letter changed beating the written word
  by at least 3.34 nats. Otherwise cancel. A word with no inner letter survives only by -6.
- **D**: Fix 2's fit test: an interior wrong or a skipped mark goes when the word's total score is
  at or above -2, on `judge/e2e_harness.mjs`'s slice, with `judge/judge_constants.json` and
  `judge/engine_constants.npl.json` (left 2 words, right 0, up to 8 s, inside the ayah, one hold
  after the verdict, from the stream's log-mel frames). It reads the tracker's word frames at the
  end of the take, which is why the runs keep them. It is scored at the mark's latest bad verdict.
- **E**: B on `missed` marks only. Wrong marks stand.

With no look possible (under 1 s of audio, an ayah the engine splits), the mark stands, as in the
app. Each row also holds B and C on the experiment's slice: t at the first bad verdict, clipped
only by the take. Rule C's clean result was measured on that slice.

## Checks

- `none:0` against the baseline: 554 of 554 takes and 26,044 verdict changes identical, 207 of 207
  marks identical, end-of-take word frames included. So they change no verdict.
- The copied rule on the experiment's slice: 42 of 66 hits and 5 of 86 false marks, and every mark's
  score and gap equal to the experiment's stored values. B there: 19 of 66 and 26 of 86, AUC 0.51.
- Every decision re-derived from its row's scores in separate code: no mismatch.
- `crowd:5` and `rec_one:5` first ran while another job swapped the engine in `node_modules`, with
  its new options off. Rerun on the pinned engine: 554 of 554 takes, all marks and all rows identical.
  The first runs are kept in `.out/chatter/learners/unpinned/`.

## Results

`report.md` holds every table, `summary.md` the short ones. Six voices together, the same speakers
and words in each, so these are not independent counts:

| | Marks | B | C | D | E |
|---|---|---|---|---|---|
| Clean hits the follower still marks | 133 of 396 | 75 (56%) | 89 (67%) | 108 (81%) | 130 (98%) |
| New hits | 123 | 77 (63%) | 79 (64%) | 108 (88%) | 121 (98%) |
| False marks | 374 | 183 (49%) | 118 (32%) | 253 (68%) | 337 (90%) |

- Clean hits still marked, of 66: one voice 35, crowd 30, reciter 22 at 10 dB; 23, 9 and 14 at 5 dB.
- Of 263 lost hits, 3 were judged ok. 106 went bad with no correct next word within 3 s, 84 were
  judged unsure, 52 were never judged.
- New hits are what chance gives: 123 against 111.5 expected, interval spanning zero. Clean, the 66
  hits are not clearly above chance either (46.1 expected).
- -2 per letter never separates hits from false marks: AUC 0.53 to 0.60, every interval spanning 0.5.
- C is the only rule that clearly keeps slips more than false marks: 7 to 60 points on surviving hits,
  13 to 50 on marks the clean run never made.

## Limits

- QuranMB's errors are scripted and read in plain MSA. A rule built to find a changed letter suits
  them. This says nothing about natural slips.
- C was chosen on the clean marks of these takes. Its clean numbers are in-sample, and marks that
  last under a voice are the same marks. New marks are fairer, but share speakers and words.
- A hit may be chance: about a quarter of the words of an incorrect take carry a label.
- False marks are words with no scripted edit. A reader may still have slipped there.
- Learner stretches are about 4 s at the very end of a take, so the next-word rule has little to
  work with. Continuous recitation may lose fewer hits that way.
- The level is set over the whole take. On the learner's stretch the median is 0.6 to 1 dB above
  nominal, with about 3 dB either side. Clean recordings mixed digitally, not a phone in a room.
- Rule D is applied mark by mark at the latest bad verdict, not as a full replay of the policy,
  which could also add marks through the confusion rule.
