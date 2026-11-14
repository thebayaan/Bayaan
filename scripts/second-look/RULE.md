# The last check before a word turns red

Frozen on tuning data on 6 November 2026. Nothing here has run on a phone. The test cells of the pool and of W1, and the pool's test half under voices, were not read: a later step reads the held-out half once. This file changes nothing in the app. What changed after the freeze, when the app was reviewed against this rule, is at the end of the decisions below.

Words used here. The *follower* is the engine, @tilawa/core. The *judge* is the second model, quran-asr-small. *t* is the audio time of a word's latest bad verdict. A *real slip* is one of the 66 QuranMB marks that sit on a labelled error word.

## What was chosen

| | Step 1, the default | Step 2, behind its flag, off by default |
|---|---|---|
| Cancel step | the letter-slip rule on the judge's own first pass (candidate P3) | the same, skipped when the judge answered wrong or absent on the word (candidate P4) |
| Judge's hold | 0.48 s | 0.48 s |
| Model runs per mark | the judge's run, plus one padded run at most | the same |

**The selection gave no clean pass, so read this before relying on the choice.** The fixed limits are 3 of 66 real slips, 2 pool-dev false marks, 1 point of W1 catches at any place, and 10% of false marks in any voices condition at 10 dB or 5 dB. Before any result was read, `select.mjs` and its tests fixed the reading: each measure has its own best candidate, and the 10% is 10% of that best's marks. Read that way, no candidate stands in either step:

- Step 1: P3 misses one limit, tv_ar at 10 dB, with 10 false marks against P2's 8 (the limit is 8.8). P4 misses two, P2 eight, P1 twelve.
- Step 2: P4 misses three, all voices (tv_ar at 10 dB 12 against 8, one_ar at 5 dB 26 against 22, rec_same at 5 dB 86 against 75). P3 misses four, three of them W1 catches by 8 to 19 points. P2 misses eleven, P1 fifteen.

The freeze takes the candidate that misses the fewest limits. That tie-break is not in the fixed rule. It is a judgement call and needs a look.

The limit has a second natural reading: 10% of the false marks today's rules show in that condition, the way 3 of 66 counts against the base. This reading was added after the results were in, so it is reported, not used. It gives P3 for Step 1 and leaves P4 for Step 2 half a mark outside one limit. So P3 and P4 come out either way. **Only the hold depends on the reading**: see the first open decision.

## The rule, step by step

A word goes through these steps in this order. The follower never waits for any of them.

**0. Filters.** A verdict counts only if the follower is locked, it is not in the chunk where the follower found the reader, and it is not in a chunk that judges 11 or more words across 3 or more ayat. Other verdicts never wake a model.

**1. Junction check**, in the engine, on an ayah's last word (`natural/junction`, version 2). Unsaid: a `missed` mark, shown at once, and exempt from steps 2 and 4. Said: acts only on a `skipped` verdict, which stops being a slip, and is not reported as a new verdict.

**2. Judge.** One chunk after the verdict, on one slice.

- Wakes. Step 1: `wrong` and `skipped`. Step 2 also: `unsure`, `ok` with gop at or below -1.5, and `ok` with no gop and distance above 0.
- Slice end: the earlier of t + 0.48 s and the next ayah's first word's tracker frame - 0.23 s + 0.2 s, but not before t.
- Slice start: the later of end - 8 s and the ayah's start. The ayah's start is the earlier of the tracker's end of the ayah before + 0.3 s and the first word's tracker frame - 0.23 s - 0.2 s. With no ayah before, first word's frame - 0.23 s - 1 s. With no tracker frame for a first word, cursor entry - 1.5 s stands in for that frame - 0.23 s. A slice under 1.5 s means those places were wrong: use the last 3 s.
- Score: best CTC path relative to each frame's best token, so at most 0. Text: 2 words of left context, then the candidate, then a word separator with free frames, or blanks to the end. An ayah's first word must begin within 50 model frames of the slice's start. Candidates: the expected word and its mutashabih alternatives. No-word score: the left context directly followed by the next word.
- Answer: `wrong` when the best alternative beats the expected word by 3 nats or more and itself scores -1 or better. `absent` when the no-word score beats it by 10 or more and itself scores -1 or better. `fits` when the expected word scores -2 or better. Otherwise `neither`.
- Effect: `wrong` makes the word a suspect past the ayah-edge and gop-fits rules, whatever verdict woke the judge. `absent` on a `wrong` or `skipped` verdict makes it a missed suspect. `fits` on an interior `wrong` or on a `skipped` verdict drops it to unsure, with no mark: this is the veto. `neither` changes nothing.
- The answer counts from its verdict's time, so a next-word `ok` seen since the verdict is credited.

**3. Next-word rule and the 500 ms hold**, as in the frozen rules (`.out/natural/verify/wordMarks.combined.ts`): the word stays bad for 500 ms and one of its next 2 words is heard `ok` within 3 s. The confusion rule stays.

**4. The cancel step**, on each mark that falls due. It may start as soon as the judge has answered, so that its runs overlap the wait in step 3. The mark shows at the later of its due time and the answer.

1. A junction mark shows.
2. If the phone switch says skipped marks only, a mark of kind `wrong` shows.
3. **With Step 2 on only:** if the judge answered `wrong` or `absent` on this word since it became a suspect, the mark shows.
4. Take the judge's expected score on the slice of the latest bad verdict and divide by the word's letters. At or below **-6 per letter**, the mark shows.
5. A word under 3 letters has no inner letter: the mark is cancelled.
6. Otherwise, the padded look. On that same first pass, the word starts at its first letter's first frame and ends after the last frame its stretch holds, 40 ms a frame from the slice's start. Cut the audio from 0.3 s before that start to 0.3 s after that end, stopping at what has been heard at t + 0.48 s. Add 1 s of digital silence each side. Compute features and run the model. Score the written word alone, with free frames all round. For each inner letter (not the first, not the last), try each of the other letters of the 29. If the best such spelling beats the written word by **at least 3.34 nats**, the mark shows.
7. Otherwise the mark is cancelled: it becomes `noted`, is never shown, and still counts towards the confusion rule. A later bad verdict on the word can raise it again, and it is checked again.

Any failure or timeout shows the mark: no letters for the word (the three ayat the engine splits, 15:7, 27:20 and 36:22), no model, no path, or a cut under 0.2 s. Spellings tried here are lists of numbers inside the computation. They are never shown, logged as text or stored.

**5. Added-word mark**, separate, with no model (`added/README.md`). It clears red suspects and marks on its two neighbours, and holds back a red mark on them that arrives after it. The clearing is arithmetic in the tables here, and it cleared no mark in any voices condition below. In the app both reach 6 s either way from the added mark (the next-word window plus the judge's wait), so a slip on a later reading of those words still shows, and a word already corrected is left alone.

**Switches.** What the cancel step may cancel, all marks or skipped marks only, default all: `CANCEL_MAY_CANCEL` in `services/recitation/secondLook/config.ts` sets it for a build, and on a development build the owner can choose on the phone, on the hidden spike screen (`bayaan://recitation-spike`), which is saved and counts from the next take. A release build has no such screen. The judge's step, 1 or 2, default 1: `JUDGE_STEP` in the same file, a build-time constant.

Executable form: `rule.mjs` for the scoring and the answer, `cancel.mjs` (`P3`, `P4`, and `P3s`, `P4s` for the switch), `chain.mjs` for steps 0 to 2, `replay_marks.mjs` for steps 3 and 4 in the replay. The sha256 of each is in `.out/second-look/frozen.json`.

## Every constant, its source, and its licence side

NPL-1.2 side means tuned on the follower's output, so it goes in a separate, clearly NPL file with the model, not in the app's own code. App side means set on quran-asr-small and the official text alone.

| Constant | Value | Source | Side and file |
|---|---|---|---|
| keep at or below, per letter | -6 | letter-slip experiment, chosen on the follower's marks, none of them held out | NPL: `cancel_constants.npl.json` |
| keep if a spelling beats by | 3.34 nats | the same | NPL: `cancel_constants.npl.json` |
| padded margin | 0.3 s | the same: the cut that separated marks best | NPL: `cancel_constants.npl.json` |
| padded silence | 1 s | the same: a choice, not varied | NPL: `cancel_constants.npl.json` |
| cut too short, a failure | 0.2 s | mechanics, from the experiment's code | NPL: `cancel_constants.npl.json` when ported |
| least letters for a padded look | 3 | follows from "inner letter" | no tuning |
| alternative margin | 3 nats | text harness on dev, but fixed after the end-to-end sweep on dev had been seen | NPL: `followerConstants.npl.json`, and labelled in `judge/judge_constants.json` |
| alternative fit; no-word margin; word fits | 1; 10; 2 nats | text harness on dev, no follower output | App: `judge/judge_constants.json` |
| left words; right words | 2; 0, and 1 for the no-word score | the same | App: `judge/judge_constants.json` |
| slice; cut; tail; first word within | 8 s; 0.2 s; 0.2 s; 50 frames | the same | App: `judge/judge_constants.json` |
| near words | off | dev and test: no exact catch gained | App: `judge/judge_constants.json` |
| wake list; ok gop; ok no gop | wrong, skipped, unsure; -1.5; on | sweep on dev with follower output | NPL: `judge/engine_constants.npl.json` |
| hold | 0.48 s | the same | NPL: `judge/engine_constants.npl.json` |
| tracker lag; cursor lag | 0.23 s; 1.5 s | follower's timing on dev | NPL: `judge/engine_constants.npl.json` |
| after previous; no previous; least slice | 0.3 s; 1 s; 1.5 s | design around the tracker | NPL: `judge/engine_constants.npl.json` |
| judge's mark in the lock chunk | stays dropped | learner clips on dev | NPL: `judge/engine_constants.npl.json` |
| junction: llr; early fit; late fit | -7; -4; -20 | dev, on the follower's output | NPL: `.out/natural/junction/frozen_v2.json` |
| junction: look back; anchor; wait; words back | 75 frames; 3 tokens; 12 frames; 3 | the same | NPL: `natural/junction/engine_junction.js` |
| added word: every constant | table in `added/README.md` | dev, on the follower's output | NPL |
| hold on a mark; next-word window; next words | 500 ms; 3 s; 2 | bench, on the follower's output | NPL: `followerConstants.npl.json`, section `marks` |
| skip fits gop; wrong fits gop; first skip heard; confused neighbours, span, window; realign words, ayat; after skip | -5; -1; 0.1; 3, 3, 2 s; 11, 3; 3 | the same | NPL: the same section |
| commit dwell | 2 | five reciters with planted mistakes, on the follower's output | NPL: the same file, section `engine` |

Retired by this rule: -2 per letter, t-4.6..t+0.9, and the 1 s least slice of the second look now in the app. They were set on the follower's marks too, so they sit on the NPL side while they remain.

Whether scoring quran-asr-small on the follower's marks reaches it under NPL-1.2 is still an open question for the owner. No NPL output enters any label of a non-NPL model here: nothing was trained.

## Decisions still open, before the held-out read

**1. Hold 0 for Step 1.** It keeps 32 real slips rather than 23: +9 of 66, [-1.9, 22.5] on the difference. It shows the same 214 false marks over the 11 voices conditions, 0.00 per 1,000 difference at 10 dB [-0.23, 0.19] and at 5 dB [-0.40, 0.41]. Pool dev stays 0, W5 dev stays 4, and W1 is the same. It misses 4 limits on the fixed reading (one_ar 10 dB 3 against 1, tv_ar 10 dB 9 against 8, one_en 5 dB 13 against 11, tv_ar 5 dB 22 against 18) and none on the second reading. So it was not adopted. It is one constant to change. It does not show marks half a second sooner: on the live path the last word's median moves 0.17 s at 0.25 s a run and 0.25 s at 0.6 s a run, and the interior median does not move at 0.25 s a run, because the next-word rule sets the wait. With no cancel step behind it, hold 0 is worse (W5 dev 13 against 9, one_ar 10 dB 12 against 6), so it leans on this cancel step.

**2. The judge's veto takes real slips before the cancel step sees them.** At hold 0.48 it removes 29 of the 66. With no veto, P3 keeps 37 rather than 23: +14 of 66, [3.8, 26.6]. The cost is +2 pool-dev marks and more marks under voices: +9 at 10 dB (0.18 [0.00, 0.47] per 1,000) and +34 at 5 dB (0.57 [0.30, 0.87]). This is not one of the listed candidates, and nothing was tuned, so it is reported only. No-veto at hold 0 was not run.

**3. Fix 1 needs no gate on this evidence. Fix 3 does, unless the owner accepts its false marks.** The combined engine kept every plain-engine verdict in all 6 conditions, with 0 lost of 19,565 on none:0 against the baseline. Junction fires: 0 in 59,280 words, at 5 dB too. Added marks, all false: 0 quiet, then 0.30, 0.40, 0.51, 0.61 and 1.21 per 1,000 as the voices grow. At 10 dB they outnumber the red marks left (3 and 4 added against 1 and 3 red). One place gives 5 of the 30. The gate itself is not designed or measured here.

**4. Step 2 stays behind its flag.** P4 keeps every promoted catch, but on learner takes it adds 14 false-incorrect and 1 false-correct marks for 7 more real hits, marks the cancel step may not touch. P3 would cancel most of those, but costs W1 interior 89.4% to 70.5% and live first word 76.3% to 31.3%.

**5. The cancel step's two thresholds rest on QuranMB.** -6 and -3.34 were chosen on its 66 and 86 marks. QuranMB's licence for this use, and that of its ground truth, is not yet confirmed. So before any release the owner must confirm both and record them, or have both numbers derived again on data whose licence allows it, and measured again.

**6. The NPL file ships inside the app for now.** `followerConstants.npl.json` is imported by app code, so it goes into the JavaScript bundle with no licence file beside it. It should be delivered with the model, under the model's licence. That needs a place to host the file and a decision on what runs until it arrives: the mark rules read it now too. Known gap for test builds; it must close before a public release.

**7. The alternative's margin.** Kept at 3 and moved to the NPL side, so no number here moves. Margin 4 would avoid the question of having seen the sweep. The verifier's table on dev, Step 2: W1 all 78.9% to 78.6%, W1 interior 89.4% to 87.6%, identical on test.

**8. An added mark does not clear when the reader goes back and reads the place cleanly.** The caret stays, and the take is saved with it as a mistake, where a red mark would become corrected. To clear it needs the engine's gap report on that later pass. Not built: the owner chooses.

**9. Whether the tables of how the follower writes sounds in `addedWord.ts` (`SIGNS`, `CANON`) belong on the NPL side.** Not settled.

### What changed after the freeze

The app was reviewed against this rule and these changes followed. None changes a threshold. `.out/second-look/frozen.json` was written again after them, and the pins from the freeze are kept in `frozen.before-review.json`. Only `lib.mjs`, `replay_marks.mjs`, this file, `added/rule.mjs` (a comment) and `judge/judge_constants.json` (wording) differ.

- Log-mel frames and tracker frames now stay on one clock when the engine goes idle or finishes a surah. Before this, every check after such an event failed open, or read the wrong audio. No number here moves: W5's 1,372 tuning clips played through the app's real modules with the real second model give 4 marks at Step 1 and 6 at Step 2, the tables' counts, 3 of the 4 at pauses over 3 s and 1 at 24:31. That is playback under node at an assumed 0.25 s a run, not a phone. `lib.mjs` and `repro/` now count the saved runs' frames on the same clock, but the stored rows were cut before this, so read the held-out half through `repro/run.mjs`.
- A word left out and found by the junction check now shows at once even when the word was already a suspect waiting for the judge.
- A later bad verdict on a word stands against a `fits` about an older one. The junction check's `said` no longer drops a word the judge has called absent: this event occurs 0 times on the pool and on W5's 121 clips with a next ayah, so no number here moves.
- An added mark's clearing and hold now reach 6 s, and a corrected word is never cleared. `stack/live_order.mjs` gives the same output as before on every suite it reads.
- A suspect now waits up to 3 s for the judge rather than 2.5 s, the most the judge can take: the hold, a late chunk and its time limit.
- At a stop, what is due by its own rules shows, as no answer can come now.
- The numbers tuned on the follower's output that sat in the app's own code moved to the NPL file. `stack/replay_hash.mjs` gives the same hash on all 13,757 saved runs.
- A forward jump of more than 10,000 places in the text now starts a new stretch of alignment, and the last stretch is aligned once a chunk with two rows of costs in memory. Under Hermes on a Mac, on one take that reads 2:20-22, 2:233-234 and 2:52-53: the worst JS task after start-up falls from 3 to 4 s to 151 ms, tasks over 100 ms from 68 or more to 2, and peak footprint from 1.8 GB to 849 MB. Against the runs before it: on the 13 clips of the voices conditions with 25 or more words skipped at once, and one more, verdicts, log, flags and marks are the same on all 14. On samples of the pool, W1, the junction controls and the live last words (66 clips) nothing changes. Where the audio leaves the text on purpose it can: 2 of 24 junction site clips, with the same 24 fires and 28 marks against 27, and 6 of 36 added-word clips, with the same 17 marks. The 961 site runs and 374 added runs were not rerun.
- Played through the final app modules with the real second model, on the same recorded verdicts, at an assumed 0.25 s a run, these suites show the same marks at both steps as before all this: pool dev (84 takes, 0 and 2), QuranMB (1,607, 42 and 71), live last word (213, 124 and 203), live interior (42, 21 and 44), one_ar at 5 dB (51, 21 and 26). Recorded verdicts cannot show the cut at a long jump: that is the item above.
- The first pass reads the engine's frames, not `judge/fbank.mjs`'s, so the app's scores differ slightly from the rows these tables rest on. On 1,473 stored rows on 1,084 tuning slices (pool, W1 sample, W5, QuranMB, one_ar_5, live last word), scores moved over 0.1 nats on 659 rows, by up to 5.38. The judge's answer changes on 9 of 1,473 (0.61%), 5 of them towards `fits`. The -6 decision changes on 1. The padded decision changes on 5 of 928 (0.54%), since the first pass places the word differently. These are 9 and 5 events, too few to say more. Do the held-out read through `repro/run.mjs`, which uses the engine's frames, not through stored rows, and expect at least this much movement on a phone.

## The numbers in plain words

All tuning data. Today means the committed rules with no judge and no cancel step. App today adds the second look now in the working tree.

**False marks on correct recitation, Step 1 rule against today and against the app today:**

- Pool dev, 17,474 words: 26, 7, then **0**. Zero here is an exact bound of about 0.21 per 1,000 before clustering.
- W5 dev, 16,620 words: 32, 6, then **4**: 3 at pauses over 3 s, 1 on a written-form word in 24:31.
- Voices, 9,880 words each, per 1,000: quiet 1.52, 0.51, then **0.00**. At 10 dB, today 2.43 to 3.54, app today 0.51 to 1.72, then **0.10 to 1.01**. At 5 dB, today 4.86 to 20.04, app today 2.63 to 12.04, then **1.11 to 7.39**.

**Real slips on QuranMB.** Of 66: today 66, app today 22, Step 1 with the P1 baseline 20, then **23** [10.1%, 60.7%], plus 2 new hits. Learner false marks, of 86: 86, 23, 13, then **4**, plus 1 new. The letter-slip rule alone keeps 41 of the 66. Most of the gap to 23 is the veto (open decision 2).

**Catches, dev only.** The rule costs Step 1 nothing on W1 with the flush: interior 31.8%, last 76.2%. Live path: last word 69.9% [53.8, 85.3] on 133 runs, first word 15.0% [0.0, 35.7] on 80 runs, interior 31.0% [2.7, 63.4] on 42 runs. Step 2 with P4: W1 interior 89.4%, last 98.9%, close 49.0%, first 8.2%. Live path: last 85.7%, first 76.3%, interior 85.7%. Under voices, W1 interior keeps its catches: Step 1 about 31%, Step 2 76.5% to 80.6%.

**Does the rule carry over to the judge's slice?** Mostly. With no veto in front, 36 real slips stay on both slices, 5 only on its measured slice and 1 only on the judge's. False marks: 4 on both, 1 only on each. P3 then beats P2 on false marks, probably because the judge's slice stays inside the ayah (pool dev 0 against 2, 5 dB voices 195 against 239).

**Cost, assumed and not measured on a phone.** Step 1: 0.36 model runs a minute on pool dev, 1.54 on the phone-recorded clips, 0.39 quiet, 0.59 to 0.79 at 10 dB, 0.88 to 3.69 at 5 dB. Those count a padded run only at marks that fall due. If the padded look starts as soon as the judge answers, as the overlap below needs, it could run on every suspect: at most 0.46 on the pool, 3.44 on the phone clips, 5.72 at the worst 5 dB condition. Step 2: 3.17 on the pool, 4.66 on the phone clips, 3.29 to 10.54 under voices.

**Latency from the next word's onset, median / p90, the runs overlapping the wait.** Step 1: last word 2.09 / 2.72 s at 0.25 s a run, 2.34 / 2.94 s at 0.6 s. Interior 2.13 / 3.56 s and 2.34 / 3.82 s. First word 3.64 / 4.90 s and 4.28 / 5.25 s. The bars of 1.5 s and 2.5 s are still missed.

**The phone switch.** Skipped marks only keeps 37 real slips rather than 23 but also 31 learner false marks rather than 4, and at 5 dB about twice the false marks. W1 catches do not move.

## What was not run, and how far to trust this

- No phone. Times per run are assumptions, and iPhone memory is unmeasured.
- The thresholds -6 and -3.34 were chosen on the same 66 and 86 QuranMB marks, and on overlapping professional and W1 marks. So the QuranMB rows here are near a best case. The held-out half holds no real slips, so it cannot check them. The 66 hits come from 29 words and 17 speakers, with planted errors in plain reading, and the intervals are wide.
- The readers are professional men in studio recordings, and the voices behind them pass through simulated rooms. So this ranks rules and does not predict a phone.
- All catches come from correct reciters read against another ayah's text. On the phone-recorded learner clips no labelled word is marked, under any rule here (0 of 52).
- Junction natural sites (961 runs) and natural added-word events were not rerun. Junction marks pass every candidate by construction. W1 controls were not rerun; the verifier found 0 marks there.
- The replay stands in for the app: the judge's answer is credited to its verdict's time, slices use the tracker's frames from the end of the take, and the padded look is timed by assumption. The bench's rows match the verifier's where they should (below), but none of this order of events has run live.
- Counts in the voices conditions are small at 10 dB, so a limit of 10% can turn on one mark.

**Checks that passed.**

- `check_rule_port.mjs`: `rule.mjs` gives the experiment's own scores and decisions on 1,076 stored rows, 0 different.
- `check_earlier.mjs`: W1 dev, pool dev, W5 dev and live dev match the verifier's numbers exactly, and voices with the second look alone give the report's 15 to 5, 25 to 7, 29 to 5 and 64 to 33. QuranMB gives 22 and 41 against the reports' 19 and 42, because here the slice follows the latest bad verdict and is cut at what the app would hold.
- `eval_marks.mjs` re-scored each mark's first pass against the stored judge row: 0 differences across all populations. A rerun of one suite gave identical output.
- `node --test scripts/second-look/tests/test_*.mjs`: 64 pass. Each test file was seen failing before its code existed or changed.

## How to reproduce

`scripts/second-look/run_all.sh`, from any folder. It resumes, starts at most 3 bench and 2 model processes, and waits while swap is above 20 GB or free disk under 10 GB. Rows: `judge_rows.mjs`. Marks: `eval_marks.mjs`. Tables: `tables.mjs`, `tables_md.mjs`. Combined engine: `run_voices_combined.sh`, `voices_combined.mjs`. Chain names below: `J` no judge, `S1` and `S2` the corrected steps at hold 0.48 s, `S1h0` and `S2h0` at hold 0, `N1` and `N2` with no veto, for comparison only. After the dot: `none` no cancel step, `P1` to `P4` the candidates, and a final `s` the switch at skipped marks only.

## The tables

### Step 1: the selection

From: tables.mjs, key selection.S1; rule in select.mjs.

| measure | no cancel step | P1 app today | P2 own slice | P3 judge's pass | P4 skip if identified | P3 at hold 0 | best of P1 to P4 |
|---|---|---|---|---|---|---|---|
| real slips kept, of 66 | 37 | 20 | 26 | 23 | 24 | 32 | 26 |
| pool dev false marks | 6 | 3 | 2 | 0 | 1 | 0 | 0 |
| W1 interior, % | 31.8 | 31.8 | 31.8 | 31.8 | 31.8 | 31.8 | 31.8 |
| W1 last, % | 76.2 | 76.2 | 75.8 | 76.2 | 76.2 | 76.2 | 76.2 |
| W1 first, % | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| W1 close, % | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| voices one_en_10 | 8 | 5 | 7 | 4 | 4 | 4 | 4 |
| voices one_ar_10 | 6 | 2 | 1 | 1 | 1 | 3 | 1 |
| voices crowd_10 | 9 | 3 | 4 | 3 | 3 | 3 | 3 |
| voices tv_ar_10 | 18 | 13 | 8 | 10 | 12 | 9 | 8 |
| voices rec_one_10 | 5 | 3 | 2 | 1 | 1 | 0 | 1 |
| voices one_en_5 | 26 | 20 | 12 | 11 | 12 | 13 | 11 |
| voices one_ar_5 | 40 | 28 | 25 | 21 | 24 | 22 | 21 |
| voices crowd_5 | 43 | 27 | 27 | 20 | 22 | 22 | 20 |
| voices tv_ar_5 | 48 | 35 | 26 | 18 | 19 | 22 | 18 |
| voices rec_one_5 | 104 | 82 | 62 | 52 | 52 | 45 | 52 |
| voices rec_same_5 | 145 | 109 | 87 | 73 | 78 | 71 | 73 |
| model runs per mark, voices one_ar_5 | 1 | 2 | 2.6 | 1.69 | 1.62 | 1.66 |  |
| model runs per mark, pool dev | 1 | 2 | 2.67 | 1.83 | 1.67 | 1.86 |  |

Outside the limits: P1: slips 20 against 26; pool 3 against 0; voices one_en_10 5 against 4; voices one_ar_10 2 against 1; voices tv_ar_10 13 against 8; voices rec_one_10 3 against 1; voices one_en_5 20 against 11; voices one_ar_5 28 against 21; voices crowd_5 27 against 20; voices tv_ar_5 35 against 18; voices rec_one_5 82 against 52; voices rec_same_5 109 against 73. P2: voices one_en_10 7 against 4; voices crowd_10 4 against 3; voices rec_one_10 2 against 1; voices one_ar_5 25 against 21; voices crowd_5 27 against 20; voices tv_ar_5 26 against 18; voices rec_one_5 62 against 52; voices rec_same_5 87 against 73. P3: voices tv_ar_10 10 against 8. P4: voices tv_ar_10 12 against 8; voices one_ar_5 24 against 21.

P3 at hold 0: voices one_ar_10 3 against 1; voices tv_ar_10 9 against 8; voices one_en_5 13 against 11; voices tv_ar_5 22 against 18.

The fixed rule picks: none stands. Fewest limits missed: P3.

With the 10% read as a share of what today's rules show in each condition: P3. Outside the limits there: P1: slips 20 against 26; pool 3 against 0; voices tv_ar_10 13 against 8; voices one_en_5 20 against 11; voices one_ar_5 28 against 21; voices tv_ar_5 35 against 18; voices rec_one_5 82 against 52; voices rec_same_5 109 against 73. P2: voices one_en_10 7 against 4; voices tv_ar_5 26 against 18. P3: none. P4: voices tv_ar_10 12 against 8. P3 at hold 0: none.

### Step 2: the selection, same limits

From: tables.mjs, key selection.S2; rule in select.mjs.

| measure | no cancel step | P1 app today | P2 own slice | P3 judge's pass | P4 skip if identified | P4 at hold 0 | best of P1 to P4 |
|---|---|---|---|---|---|---|---|
| real slips kept, of 66 | 37 | 20 | 26 | 23 | 24 | 33 | 26 |
| pool dev false marks | 7 | 4 | 3 | 1 | 2 | 1 | 1 |
| W1 interior, % | 89.4 | 83.9 | 70 | 70.5 | 89.4 | 88.5 | 89.4 |
| W1 last, % | 98.9 | 95.5 | 98.5 | 98.9 | 98.9 | 98.9 | 98.9 |
| W1 first, % | 8.2 | 8.2 | 0.9 | 0 | 8.2 | 8.2 | 8.2 |
| W1 close, % | 49 | 34.7 | 33.1 | 33.1 | 49 | 48.5 | 49 |
| voices one_en_10 | 9 | 6 | 8 | 5 | 5 | 4 | 5 |
| voices one_ar_10 | 6 | 2 | 1 | 1 | 1 | 5 | 1 |
| voices crowd_10 | 9 | 3 | 4 | 3 | 3 | 4 | 3 |
| voices tv_ar_10 | 18 | 13 | 8 | 10 | 12 | 12 | 8 |
| voices rec_one_10 | 5 | 3 | 2 | 1 | 1 | 0 | 1 |
| voices one_en_5 | 28 | 21 | 14 | 13 | 14 | 20 | 13 |
| voices one_ar_5 | 42 | 28 | 26 | 22 | 26 | 31 | 22 |
| voices crowd_5 | 45 | 28 | 29 | 22 | 24 | 29 | 22 |
| voices tv_ar_5 | 51 | 36 | 27 | 20 | 22 | 27 | 20 |
| voices rec_one_5 | 107 | 84 | 63 | 53 | 56 | 51 | 53 |
| voices rec_same_5 | 153 | 111 | 89 | 75 | 86 | 87 | 75 |
| model runs per mark, voices one_ar_5 | 1 | 2 | 2.61 | 1.7 | 1.59 | 1.51 |  |
| model runs per mark, pool dev | 1 | 2 | 2.71 | 1.86 | 1.57 | 1.71 |  |

Outside the limits: P1: slips 20 against 26; pool 4 against 1; W1 interior 83.9 against 89.4; W1 last 95.5 against 98.9; W1 close 34.7 against 49; voices one_en_10 6 against 5; voices one_ar_10 2 against 1; voices tv_ar_10 13 against 8; voices rec_one_10 3 against 1; voices one_en_5 21 against 13; voices one_ar_5 28 against 22; voices crowd_5 28 against 22; voices tv_ar_5 36 against 20; voices rec_one_5 84 against 53; voices rec_same_5 111 against 75. P2: W1 interior 70 against 89.4; W1 first 0.9 against 8.2; W1 close 33.1 against 49; voices one_en_10 8 against 5; voices crowd_10 4 against 3; voices rec_one_10 2 against 1; voices one_ar_5 26 against 22; voices crowd_5 29 against 22; voices tv_ar_5 27 against 20; voices rec_one_5 63 against 53; voices rec_same_5 89 against 75. P3: W1 interior 70.5 against 89.4; W1 first 0 against 8.2; W1 close 33.1 against 49; voices tv_ar_10 10 against 8. P4: voices tv_ar_10 12 against 8; voices one_ar_5 26 against 22; voices rec_same_5 86 against 75.

P4 at hold 0: voices one_ar_10 5 against 1; voices crowd_10 4 against 3; voices tv_ar_10 12 against 8; voices one_en_5 20 against 13; voices one_ar_5 31 against 22; voices crowd_5 29 against 22; voices tv_ar_5 27 against 20; voices rec_same_5 87 against 75.

The fixed rule picks: none stands. Fewest limits missed: P4.

With the 10% read as a share of what today's rules show in each condition: none stands. Outside the limits there: P1: slips 20 against 26; pool 4 against 1; W1 interior 83.9 against 89.4; W1 last 95.5 against 98.9; W1 close 34.7 against 49; voices tv_ar_10 13 against 8; voices one_en_5 21 against 13; voices tv_ar_5 36 against 20; voices rec_one_5 84 against 53; voices rec_same_5 111 against 75. P2: W1 interior 70 against 89.4; W1 first 0.9 against 8.2; W1 close 33.1 against 49; voices one_en_10 8 against 5. P3: W1 interior 70.5 against 89.4; W1 first 0 against 8.2; W1 close 33.1 against 49. P4: voices tv_ar_10 12 against 8. P4 at hold 0: voices one_ar_10 5 against 1; voices tv_ar_10 12 against 8; voices one_en_5 20 against 13; voices one_ar_5 31 against 22.

### QuranMB: real slips and false marks kept, by chain (intervals resample speakers and words)

From: tables.mjs, key quranmb.

| chain | hit | near | false-incorrect | false-correct | marks not in the base |
|---|---|---|---|---|---|
| J.none | 66/66, 100.0% [100.0, 100.0] | 52/52, 100.0% [100.0, 100.0] | 70/70, 100.0% [100.0, 100.0] | 16/16, 100.0% [100.0, 100.0] | - |
| J.P1 | 22/66, 33.3% [9.5, 60.0] | 15/52, 28.8% [10.0, 57.1] | 18/70, 25.7% [9.1, 48.8] | 5/16, 31.3% [0.0, 75.0] | - |
| J.P2 | 41/66, 62.1% [40.0, 83.3] | 14/52, 26.9% [6.7, 59.6] | 4/70, 5.7% [0.0, 18.7] | 1/16, 6.3% [0.0, 23.1] | - |
| S1.none | 37/66, 56.1% [30.6, 81.4] | 16/52, 30.8% [9.1, 57.1] | 26/70, 37.1% [20.7, 56.3] | 7/16, 43.8% [0.0, 78.9] | near 2, hit 5, false-incorrect 1 |
| S1.P1 | 20/66, 30.3% [7.3, 57.4] | 12/52, 23.1% [4.5, 51.3] | 9/70, 12.9% [2.4, 29.9] | 4/16, 25.0% [0.0, 71.4] | false-incorrect 1, near 1, hit 1 |
| S1.P2 | 26/66, 39.4% [14.3, 65.8] | 6/52, 11.5% [0.0, 31.7] | 3/70, 4.3% [0.0, 16.1] | 1/16, 6.3% [0.0, 23.1] | hit 5 |
| S1.P3 | 23/66, 34.8% [10.1, 60.7] | 7/52, 13.5% [0.0, 34.3] | 3/70, 4.3% [0.0, 15.1] | 1/16, 6.3% [0.0, 23.1] | false-incorrect 1, hit 2 |
| S1.P4 | 24/66, 36.4% [11.3, 62.8] | 7/52, 13.5% [0.0, 34.3] | 4/70, 5.7% [0.0, 17.6] | 1/16, 6.3% [0.0, 23.1] | near 2, hit 4, false-incorrect 1 |
| S1h0.none | 47/66, 71.2% [49.0, 90.4] | 28/52, 53.8% [30.2, 79.2] | 26/70, 37.1% [17.7, 59.0] | 8/16, 50.0% [0.0, 100.0] | false-incorrect 1, near 2, hit 2 |
| S1h0.P3 | 32/66, 48.5% [24.1, 69.9] | 13/52, 25.0% [7.3, 51.0] | 3/70, 4.3% [0.0, 15.4] | 1/16, 6.3% [0.0, 23.1] | false-incorrect 1, hit 1 |
| S1h0.P4 | 33/66, 50.0% [25.0, 71.7] | 14/52, 26.9% [8.3, 51.6] | 4/70, 5.7% [0.0, 17.2] | 1/16, 6.3% [0.0, 23.1] | false-incorrect 1, near 2, hit 1 |
| S1.P3s | 37/66, 56.1% [30.6, 81.4] | 16/52, 30.8% [9.1, 57.1] | 24/70, 34.3% [18.9, 53.9] | 7/16, 43.8% [0.0, 78.9] | near 1, hit 4, false-incorrect 1 |
| S2.none | 37/66, 56.1% [30.6, 81.4] | 16/52, 30.8% [9.1, 57.1] | 26/70, 37.1% [20.7, 56.3] | 7/16, 43.8% [0.0, 78.9] | near 6, false-incorrect 14, hit 8, false-correct 1 |
| S2.P1 | 20/66, 30.3% [7.3, 57.4] | 12/52, 23.1% [4.5, 51.3] | 9/70, 12.9% [2.4, 29.9] | 4/16, 25.0% [0.0, 71.4] | near 4, false-incorrect 12, hit 1, false-correct 1 |
| S2.P2 | 26/66, 39.4% [14.3, 65.8] | 6/52, 11.5% [0.0, 31.7] | 3/70, 4.3% [0.0, 16.1] | 1/16, 6.3% [0.0, 23.1] | false-incorrect 6, hit 7 |
| S2.P3 | 23/66, 34.8% [10.1, 60.7] | 7/52, 13.5% [0.0, 34.3] | 3/70, 4.3% [0.0, 15.1] | 1/16, 6.3% [0.0, 23.1] | false-incorrect 1, hit 4 |
| S2.P4 | 24/66, 36.4% [11.3, 62.8] | 7/52, 13.5% [0.0, 34.3] | 4/70, 5.7% [0.0, 17.6] | 1/16, 6.3% [0.0, 23.1] | near 6, false-incorrect 14, hit 7, false-correct 1 |
| S2h0.P4 | 33/66, 50.0% [25.0, 71.7] | 14/52, 26.9% [8.3, 51.6] | 4/70, 5.7% [0.0, 17.2] | 1/16, 6.3% [0.0, 23.1] | near 7, false-incorrect 14, hit 5, false-correct 2 |
| S2.P4s | 37/66, 56.1% [30.6, 81.4] | 16/52, 30.8% [9.1, 57.1] | 24/70, 34.3% [18.9, 53.9] | 7/16, 43.8% [0.0, 78.9] | near 6, false-incorrect 14, hit 7, false-correct 1 |
| N1.none | 66/66, 100.0% [100.0, 100.0] | 52/52, 100.0% [100.0, 100.0] | 70/70, 100.0% [100.0, 100.0] | 16/16, 100.0% [100.0, 100.0] | near 2, hit 4, false-incorrect 1 |
| N1.P2 | 41/66, 62.1% [40.0, 83.3] | 14/52, 26.9% [6.7, 59.6] | 4/70, 5.7% [0.0, 18.7] | 1/16, 6.3% [0.0, 23.1] | hit 4 |
| N1.P3 | 37/66, 56.1% [30.1, 78.0] | 13/52, 25.0% [5.9, 53.3] | 4/70, 5.7% [0.0, 18.2] | 1/16, 6.3% [0.0, 23.1] | false-incorrect 1, hit 2 |
| N1.P4 | 38/66, 57.6% [30.7, 79.5] | 13/52, 25.0% [5.9, 53.3] | 5/70, 7.1% [0.0, 20.0] | 1/16, 6.3% [0.0, 23.1] | near 2, hit 4, false-incorrect 1 |
| N2.P3 | 37/66, 56.1% [30.1, 78.0] | 13/52, 25.0% [5.9, 53.3] | 4/70, 5.7% [0.0, 18.2] | 1/16, 6.3% [0.0, 23.1] | false-incorrect 1, hit 4 |
| N2.P4 | 38/66, 57.6% [30.7, 79.5] | 13/52, 25.0% [5.9, 53.3] | 5/70, 7.1% [0.0, 20.0] | 1/16, 6.3% [0.0, 23.1] | near 6, false-incorrect 14, hit 7, false-correct 1 |

### W1 dev: changed words, marked on the exact word (intervals resample pairs and reciters)

From: tables.mjs, key w1.

With the harness flush and a made-up next word:

| chain | all (1096 events, 55 pairs) | interior (217 events, 11 pairs) | last (660 events, 33 pairs) | first (219 events, 11 pairs) | close (239 events, 12 pairs) | closeInterior (80 events, 4 pairs) | closeLast (40 events, 2 pairs) | closeFirst (119 events, 6 pairs) |
|---|---|---|---|---|---|---|---|---|
| J.none | 6.3% [0.9, 12.9] | 31.8% [9.1, 59.3] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| S1.none | 52.2% [40.4, 64.7] | 31.8% [9.1, 59.3] | 76.2% [63.3, 88.5] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| S1.P1 | 52.2% [40.4, 64.7] | 31.8% [9.1, 59.3] | 76.2% [63.3, 88.5] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| S1.P2 | 51.9% [40.2, 64.4] | 31.8% [9.1, 59.3] | 75.8% [63.2, 87.7] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| S1.P3 | 52.2% [40.4, 64.7] | 31.8% [9.1, 59.3] | 76.2% [63.3, 88.5] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| S1.P4 | 52.2% [40.4, 64.7] | 31.8% [9.1, 59.3] | 76.2% [63.3, 88.5] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| S1h0.P3 | 52.2% [40.4, 64.7] | 31.8% [9.1, 59.3] | 76.2% [63.3, 88.5] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| S2.none | 78.9% [69.4, 88.2] | 89.4% [76.6, 100.0] | 98.9% [96.8, 100.0] | 8.2% [0.0, 20.0] | 49.0% [23.3, 75.3] | 96.3% [87.5, 100.0] | 100.0% [100.0, 100.0] | 0.0% [0.0, 0.0] |
| S2.P1 | 75.7% [66.0, 85.5] | 83.9% [70.9, 95.3] | 95.5% [89.8, 99.7] | 8.2% [0.0, 20.0] | 34.7% [12.6, 59.0] | 82.5% [60.0, 100.0] | 42.5% [30.0, 50.0] | 0.0% [0.0, 0.0] |
| S2.P2 | 73.4% [62.3, 84.2] | 70.0% [45.5, 91.5] | 98.5% [96.1, 99.8] | 0.9% [0.0, 4.1] | 33.1% [8.3, 58.3] | 48.8% [0.0, 100.0] | 100.0% [100.0, 100.0] | 0.0% [0.0, 0.0] |
| S2.P3 | 73.5% [62.3, 84.4] | 70.5% [45.5, 91.6] | 98.9% [96.8, 100.0] | 0.0% [0.0, 0.0] | 33.1% [8.3, 58.3] | 48.8% [0.0, 100.0] | 100.0% [100.0, 100.0] | 0.0% [0.0, 0.0] |
| S2.P4 | 78.9% [69.4, 88.2] | 89.4% [76.6, 100.0] | 98.9% [96.8, 100.0] | 8.2% [0.0, 20.0] | 49.0% [23.3, 75.3] | 96.3% [87.5, 100.0] | 100.0% [100.0, 100.0] | 0.0% [0.0, 0.0] |
| S2h0.P4 | 78.7% [69.3, 88.1] | 88.5% [75.9, 99.1] | 98.9% [96.8, 100.0] | 8.2% [0.0, 20.0] | 48.5% [22.8, 75.3] | 95.0% [86.3, 100.0] | 100.0% [100.0, 100.0] | 0.0% [0.0, 0.0] |
| N1.P3 | 52.2% [40.4, 64.7] | 31.8% [9.1, 59.3] | 76.2% [63.3, 88.5] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| N2.P4 | 78.9% [69.4, 88.2] | 89.4% [76.6, 100.0] | 98.9% [96.8, 100.0] | 8.2% [0.0, 20.0] | 49.0% [23.3, 75.3] | 96.3% [87.5, 100.0] | 100.0% [100.0, 100.0] | 0.0% [0.0, 0.0] |

From the clip alone, no flush (last words read 0 here):

| chain | all (1096 events, 55 pairs) | interior (217 events, 11 pairs) | last (660 events, 33 pairs) | first (219 events, 11 pairs) | close (239 events, 12 pairs) | closeInterior (80 events, 4 pairs) | closeLast (40 events, 2 pairs) | closeFirst (119 events, 6 pairs) |
|---|---|---|---|---|---|---|---|---|
| J.none | 6.3% [0.9, 12.9] | 31.8% [9.1, 59.3] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| S1.none | 6.3% [0.9, 12.9] | 31.8% [9.1, 59.3] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| S1.P1 | 6.3% [0.9, 12.9] | 31.8% [9.1, 59.3] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| S1.P2 | 6.3% [0.9, 12.9] | 31.8% [9.1, 59.3] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| S1.P3 | 6.3% [0.9, 12.9] | 31.8% [9.1, 59.3] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| S1.P4 | 6.3% [0.9, 12.9] | 31.8% [9.1, 59.3] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| S1h0.P3 | 6.3% [0.9, 12.9] | 31.8% [9.1, 59.3] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| S2.none | 17.5% [8.7, 27.1] | 80.2% [60.9, 95.5] | 0.0% [0.0, 0.0] | 8.2% [0.0, 20.0] | 23.8% [0.0, 50.0] | 71.3% [23.8, 100.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| S2.P1 | 17.3% [8.7, 26.8] | 79.3% [59.9, 95.3] | 0.0% [0.0, 0.0] | 8.2% [0.0, 20.0] | 23.4% [0.0, 49.1] | 70.0% [22.5, 100.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| S2.P2 | 12.2% [4.8, 20.7] | 60.8% [36.1, 85.5] | 0.0% [0.0, 0.0] | 0.9% [0.0, 4.1] | 7.9% [0.0, 25.0] | 23.8% [0.0, 75.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| S2.P3 | 12.1% [4.6, 20.7] | 61.3% [36.4, 85.7] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 7.9% [0.0, 25.0] | 23.8% [0.0, 75.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| S2.P4 | 17.5% [8.7, 27.1] | 80.2% [60.9, 95.5] | 0.0% [0.0, 0.0] | 8.2% [0.0, 20.0] | 23.8% [0.0, 50.0] | 71.3% [23.8, 100.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| S2h0.P4 | 17.4% [8.7, 26.9] | 79.7% [60.1, 95.4] | 0.0% [0.0, 0.0] | 8.2% [0.0, 20.0] | 23.8% [0.0, 50.0] | 71.3% [23.8, 100.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| N1.P3 | 6.3% [0.9, 12.9] | 31.8% [9.1, 59.3] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| N2.P4 | 17.5% [8.7, 27.1] | 80.2% [60.9, 95.5] | 0.0% [0.0, 0.0] | 8.2% [0.0, 20.0] | 23.8% [0.0, 50.0] | 71.3% [23.8, 100.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |

### Live path, dev reciters: real next-ayah audio, no flush, no made-up next word

From: tables.mjs, keys live and liveControl; close pairs from live_close.py.

| chain | carry_last_whole (80 runs, 16 pairs) | carry_last_ctx (53 runs, 34 pairs) | last (133 runs, 50 pairs) | arrive_first (80 runs, 16 pairs) | interior (42 runs, 11 pairs) | closeInterior (16 runs, 4 pairs) | closeLast (18 runs, 7 pairs) | closeFirst (10 runs, 2 pairs) |
|---|---|---|---|---|---|---|---|---|
| J.none | 2.5% [0.0, 10.7] | 17.0% [2.4, 36.7] | 8.3% [0.9, 18.3] | 2.5% [0.0, 10.7] | 31.0% [2.7, 63.4] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| S1.none | 67.5% [43.6, 89.0] | 73.6% [51.6, 91.9] | 69.9% [53.8, 85.3] | 17.5% [1.4, 38.2] | 31.0% [2.7, 63.4] | 0.0% [0.0, 0.0] | 5.6% [0.0, 36.4] | 0.0% [0.0, 0.0] |
| S1.P1 | 67.5% [43.6, 89.0] | 67.9% [46.2, 88.0] | 67.7% [51.3, 82.8] | 17.5% [1.4, 38.2] | 31.0% [2.7, 63.4] | 0.0% [0.0, 0.0] | 5.6% [0.0, 36.4] | 0.0% [0.0, 0.0] |
| S1.P2 | 66.3% [42.9, 88.0] | 62.3% [41.2, 82.5] | 64.7% [47.7, 80.7] | 13.8% [0.0, 31.3] | 31.0% [2.7, 63.4] | 0.0% [0.0, 0.0] | 5.6% [0.0, 36.4] | 0.0% [0.0, 0.0] |
| S1.P3 | 67.5% [43.6, 89.0] | 73.6% [51.6, 91.9] | 69.9% [53.8, 85.3] | 15.0% [0.0, 35.7] | 31.0% [2.7, 63.4] | 0.0% [0.0, 0.0] | 5.6% [0.0, 36.4] | 0.0% [0.0, 0.0] |
| S1.P4 | 67.5% [43.6, 89.0] | 73.6% [51.6, 91.9] | 69.9% [53.8, 85.3] | 17.5% [1.4, 38.2] | 31.0% [2.7, 63.4] | 0.0% [0.0, 0.0] | 5.6% [0.0, 36.4] | 0.0% [0.0, 0.0] |
| S1h0.P3 | 67.5% [43.6, 89.0] | 73.6% [51.6, 91.9] | 69.9% [53.8, 85.3] | 13.8% [0.0, 34.8] | 31.0% [2.7, 63.4] | 0.0% [0.0, 0.0] | 5.6% [0.0, 36.4] | 0.0% [0.0, 0.0] |
| S2.none | 85.0% [67.0, 97.4] | 86.8% [69.2, 100.0] | 85.7% [73.8, 95.5] | 76.3% [53.4, 94.3] | 85.7% [65.4, 100.0] | 87.5% [59.1, 100.0] | 77.8% [38.1, 100.0] | 70.0% [28.6, 100.0] |
| S2.P1 | 78.8% [59.1, 94.7] | 81.1% [59.6, 96.0] | 79.7% [65.8, 91.4] | 67.5% [44.1, 88.8] | 83.3% [60.3, 98.0] | 81.3% [42.9, 100.0] | 50.0% [9.1, 100.0] | 0.0% [0.0, 0.0] |
| S2.P2 | 72.5% [50.6, 91.4] | 71.7% [50.0, 90.0] | 72.2% [56.0, 87.3] | 40.0% [19.4, 62.7] | 66.7% [35.5, 92.9] | 43.8% [0.0, 100.0] | 16.7% [0.0, 60.0] | 0.0% [0.0, 0.0] |
| S2.P3 | 73.8% [51.8, 92.8] | 84.9% [65.5, 98.1] | 78.2% [62.7, 91.8] | 31.3% [9.2, 55.4] | 66.7% [35.5, 92.9] | 43.8% [0.0, 100.0] | 22.2% [0.0, 71.4] | 0.0% [0.0, 0.0] |
| S2.P4 | 85.0% [67.0, 97.4] | 86.8% [69.2, 100.0] | 85.7% [73.8, 95.5] | 76.3% [53.4, 94.3] | 85.7% [65.4, 100.0] | 87.5% [59.1, 100.0] | 77.8% [38.1, 100.0] | 70.0% [28.6, 100.0] |
| S2h0.P4 | 85.0% [67.0, 97.4] | 86.8% [69.2, 100.0] | 85.7% [73.8, 95.5] | 76.3% [53.4, 94.3] | 83.3% [60.3, 98.0] | 81.3% [42.9, 100.0] | 77.8% [38.1, 100.0] | 70.0% [28.6, 100.0] |
| N1.P3 | 67.5% [43.6, 89.0] | 73.6% [51.6, 91.9] | 69.9% [53.8, 85.3] | 15.0% [0.0, 35.7] | 31.0% [2.7, 63.4] | 0.0% [0.0, 0.0] | 5.6% [0.0, 36.4] | 0.0% [0.0, 0.0] |
| N2.P4 | 85.0% [67.0, 97.4] | 86.8% [69.2, 100.0] | 85.7% [73.8, 95.5] | 76.3% [53.4, 94.3] | 85.7% [65.4, 100.0] | 87.5% [59.1, 100.0] | 77.8% [38.1, 100.0] | 70.0% [28.6, 100.0] |

Same-word controls, 64 runs: J.none 0, S1.none 0, S1.P1 0, S1.P2 0, S1.P3 0, S1.P4 0, S1h0.P3 0, S2.none 0, S2.P1 0, S2.P2 0, S2.P3 0, S2.P4 0, S2h0.P4 0, N1.P3 0, N2.P4 0.

### Pool dev and W5 dev: false marks

From: tables.mjs, keys pool, w5 and w1Unchanged.

Pool dev: 17474 words, 366.7 minutes, 58 passages, 10 reciters. W5 dev: 16620 words, 1372 runs.

| chain | pool dev marks | per 1,000, interval resamples passages and reciters | W5 dev marks | W1 other words, app | W1 other words, carry-on |
|---|---|---|---|---|---|
| J.none | 26 | 1.49 [0.64, 2.59] | 32 | 5 | 21 |
| S1.none | 6 | 0.34 [0.00, 0.92] | 9 | 0 | 0 |
| S1.P1 | 3 | 0.17 [0.00, 0.54] | 4 | 0 | 0 |
| S1.P2 | 2 | 0.11 [0.00, 0.42] | 3 | 0 | 0 |
| S1.P3 | 0 | 0.00 [0.00, 0.00] | 4 | 0 | 0 |
| S1.P4 | 1 | 0.06 [0.00, 0.34] | 5 | 0 | 0 |
| S1h0.P3 | 0 | 0.00 [0.00, 0.00] | 4 | 0 | 0 |
| S2.none | 7 | 0.40 [0.00, 1.05] | 10 | 0 | 0 |
| S2.P1 | 4 | 0.23 [0.00, 0.75] | 5 | 0 | 0 |
| S2.P2 | 3 | 0.17 [0.00, 0.68] | 4 | 0 | 0 |
| S2.P3 | 1 | 0.06 [0.00, 0.29] | 5 | 0 | 0 |
| S2.P4 | 2 | 0.11 [0.00, 0.44] | 6 | 0 | 0 |
| S2h0.P4 | 1 | 0.06 [0.00, 0.34] | 7 | 0 | 0 |
| N1.P3 | 2 | 0.11 [0.00, 0.69] | 4 | 0 | 0 |
| N2.P4 | 4 | 0.23 [0.00, 0.80] | 6 | 0 | 0 |

### Voices behind correct recitation: false marks (9,880 words each, tuning half)

From: tables.mjs, key voices.

| condition | J.none | J.P1 | J.P2 | S1.none | S1.P1 | S1.P2 | S1.P3 | S1.P4 | S1h0.P3 | S1.P3s | S2.none | S2.P3 | S2.P4 | S2h0.P4 | N1.P3 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| none_0 | 15 | 5 | 4 | 3 | 2 | 1 | 0 | 0 | 0 | 1 | 3 | 0 | 0 | 0 | 1 |
| one_en_10 | 24 | 9 | 10 | 8 | 5 | 7 | 4 | 4 | 4 | 6 | 9 | 5 | 5 | 4 | 6 |
| one_ar_10 | 25 | 7 | 7 | 6 | 2 | 1 | 1 | 1 | 3 | 5 | 6 | 1 | 1 | 5 | 3 |
| crowd_10 | 29 | 5 | 6 | 9 | 3 | 4 | 3 | 3 | 3 | 6 | 9 | 3 | 3 | 4 | 5 |
| tv_ar_10 | 35 | 17 | 10 | 18 | 13 | 8 | 10 | 12 | 9 | 13 | 18 | 10 | 12 | 12 | 11 |
| rec_one_10 | 33 | 8 | 6 | 5 | 3 | 2 | 1 | 1 | 0 | 3 | 5 | 1 | 1 | 0 | 3 |
| one_en_5 | 48 | 26 | 19 | 26 | 20 | 12 | 11 | 12 | 13 | 23 | 28 | 13 | 14 | 20 | 16 |
| one_ar_5 | 64 | 33 | 29 | 40 | 28 | 25 | 21 | 24 | 22 | 36 | 42 | 22 | 26 | 31 | 25 |
| crowd_5 | 70 | 37 | 37 | 43 | 27 | 27 | 20 | 22 | 22 | 42 | 45 | 22 | 24 | 29 | 28 |
| tv_ar_5 | 71 | 43 | 30 | 48 | 35 | 26 | 18 | 19 | 22 | 45 | 51 | 20 | 22 | 27 | 19 |
| rec_one_5 | 159 | 95 | 76 | 104 | 82 | 62 | 52 | 52 | 45 | 101 | 107 | 53 | 56 | 51 | 59 |
| rec_same_5 | 198 | 119 | 103 | 145 | 109 | 87 | 73 | 78 | 71 | 134 | 153 | 75 | 86 | 87 | 82 |

### The same per 1,000 words, with intervals, for the rule picked and for today

From: tables.mjs, key voices.

| condition | today (no judge, no cancel) | app today (J.P1) | S1.P3 | S2.P4 |
|---|---|---|---|---|
| none_0 | 15: 1.52 [0.40, 3.12] | 5: 0.51 [0.00, 1.24] | 0: 0.00 [0.00, 0.00] | 0: 0.00 [0.00, 0.00] |
| one_en_10 | 24: 2.43 [0.68, 4.86] | 9: 0.91 [0.16, 1.95] | 4: 0.40 [0.00, 1.26] | 5: 0.51 [0.00, 1.34] |
| one_ar_10 | 25: 2.53 [1.00, 4.54] | 7: 0.71 [0.00, 1.52] | 1: 0.10 [0.00, 0.55] | 1: 0.10 [0.00, 0.55] |
| crowd_10 | 29: 2.94 [1.18, 5.87] | 5: 0.51 [0.00, 1.47] | 3: 0.30 [0.00, 1.33] | 3: 0.30 [0.00, 1.33] |
| tv_ar_10 | 35: 3.54 [1.49, 6.36] | 17: 1.72 [0.41, 3.84] | 10: 1.01 [0.13, 2.23] | 12: 1.21 [0.20, 2.48] |
| rec_one_10 | 33: 3.34 [1.23, 6.08] | 8: 0.81 [0.00, 1.84] | 1: 0.10 [0.00, 0.57] | 1: 0.10 [0.00, 0.57] |
| one_en_5 | 48: 4.86 [2.26, 8.54] | 26: 2.63 [0.80, 5.68] | 11: 1.11 [0.00, 3.34] | 14: 1.42 [0.18, 3.67] |
| one_ar_5 | 64: 6.48 [2.91, 10.58] | 33: 3.34 [0.87, 6.51] | 21: 2.13 [0.33, 4.36] | 26: 2.63 [0.60, 5.11] |
| crowd_5 | 70: 7.09 [3.40, 11.89] | 37: 3.74 [1.54, 6.86] | 20: 2.02 [0.42, 4.20] | 24: 2.43 [0.77, 4.61] |
| tv_ar_5 | 71: 7.19 [3.97, 11.22] | 43: 4.35 [1.80, 7.57] | 18: 1.82 [0.49, 3.86] | 22: 2.23 [0.77, 4.23] |
| rec_one_5 | 159: 16.09 [8.75, 25.66] | 95: 9.62 [4.03, 17.29] | 52: 5.26 [2.40, 9.55] | 56: 5.67 [2.70, 10.16] |
| rec_same_5 | 198: 20.04 [7.90, 37.74] | 119: 12.04 [3.78, 24.43] | 73: 7.39 [2.05, 15.46] | 86: 8.70 [2.67, 17.31] |

### W1 interior changed words with voices behind (dev, 217 runs, clip alone)

From: tables.mjs, key w1int.

| condition | J.none | J.P1 | J.P2 | S1.none | S1.P3 | S1.P4 | S1h0.P3 | S2.none | S2.P3 | S2.P4 | N1.P3 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| none_0 | 69 31.8% [9.1, 59.1] | 69 31.8% [9.1, 59.1] | 69 31.8% [9.1, 59.1] | 69 31.8% [9.1, 59.1] | 69 31.8% [9.1, 59.1] | 69 31.8% [9.1, 59.1] | 69 31.8% [9.1, 59.1] | 174 80.2% [58.7, 97.2] | 133 61.3% [35.0, 84.5] | 174 80.2% [58.7, 97.2] | 69 31.8% [9.1, 59.1] |
| one_ar_10 | 70 32.3% [9.1, 59.4] | 70 32.3% [9.1, 59.4] | 69 31.8% [9.1, 59.1] | 70 32.3% [9.1, 59.4] | 69 31.8% [9.1, 59.1] | 70 32.3% [9.1, 59.4] | 70 32.3% [9.1, 59.4] | 175 80.6% [59.1, 97.2] | 130 59.9% [33.8, 83.0] | 175 80.6% [59.1, 97.2] | 69 31.8% [9.1, 59.1] |
| one_ar_5 | 68 31.3% [8.5, 58.6] | 68 31.3% [8.5, 58.6] | 67 30.9% [8.2, 58.2] | 68 31.3% [8.5, 58.6] | 67 30.9% [8.3, 58.3] | 68 31.3% [8.5, 58.6] | 67 30.9% [8.3, 58.3] | 166 76.5% [56.6, 93.1] | 118 54.4% [30.5, 76.9] | 166 76.5% [56.6, 93.1] | 67 30.9% [8.3, 58.3] |
| crowd_5 | 68 31.3% [8.4, 58.7] | 68 31.3% [8.4, 58.7] | 68 31.3% [8.4, 58.7] | 68 31.3% [8.4, 58.7] | 68 31.3% [8.4, 58.7] | 68 31.3% [8.4, 58.7] | 68 31.3% [8.4, 58.7] | 166 76.5% [56.4, 94.0] | 112 51.6% [28.4, 74.5] | 166 76.5% [56.4, 94.0] | 68 31.3% [8.4, 58.7] |
| tv_ar_5 | 68 31.3% [8.5, 58.6] | 68 31.3% [8.5, 58.6] | 68 31.3% [8.5, 58.6] | 68 31.3% [8.5, 58.6] | 68 31.3% [8.5, 58.6] | 68 31.3% [8.5, 58.6] | 68 31.3% [8.5, 58.6] | 166 76.5% [56.2, 93.4] | 119 54.8% [30.1, 77.8] | 166 76.5% [56.2, 93.4] | 68 31.3% [8.5, 58.6] |

### Combined engine under voices: false junction fires and false added marks

From: voices_combined.mjs.

| condition | runs | words | verdicts of the plain engine lost | junction fires | per 1,000 | added marks | per 1,000 |
|---|---|---|---|---|---|---|---|
| none_0 | 51 | 9880 | 0 against the pool baseline, 0 against the voices run, of 19565 | 0 | 0.00 [0.00, 0.00] | 0 | 0.00 [0.00, 0.00] |
| one_ar_10 | 51 | 9880 | 0 of 19571 | 0 | 0.00 [0.00, 0.00] | 3 | 0.30 [0.00, 1.03] |
| crowd_10 | 51 | 9880 | 0 of 19534 | 0 | 0.00 [0.00, 0.00] | 4 | 0.40 [0.00, 1.48] |
| one_ar_5 | 51 | 9880 | 0 of 19650 | 0 | 0.00 [0.00, 0.00] | 5 | 0.51 [0.00, 1.30] |
| crowd_5 | 51 | 9880 | 0 of 19617 | 0 | 0.00 [0.00, 0.00] | 6 | 0.61 [0.00, 1.46] |
| rec_one_5 | 51 | 9880 | 0 of 22500 | 0 | 0.00 [0.00, 0.00] | 12 | 1.21 [0.28, 2.64] |

Pool dev on the same engine, no voices, 17474 words: 0 junction fires, 0 added marks.

### All marks together: red after the cancel step, junction and added marks, with an added mark clearing red on its two neighbours

From: tables.mjs, key together.

| condition | words | S1.P3 red | cleared | junction | added | total | per 1,000 | S2.P4 red | cleared | junction | added | total | per 1,000 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| none_0 | 9880 | 0 | 0 | 0 | 0 | 0 | 0.00 | 0 | 0 | 0 | 0 | 0 | 0.00 |
| one_ar_10 | 9880 | 1 | 0 | 0 | 3 | 4 | 0.40 | 1 | 0 | 0 | 3 | 4 | 0.40 |
| crowd_10 | 9880 | 3 | 0 | 0 | 4 | 7 | 0.71 | 3 | 0 | 0 | 4 | 7 | 0.71 |
| one_ar_5 | 9880 | 21 | 0 | 0 | 5 | 26 | 2.63 | 26 | 0 | 0 | 5 | 31 | 3.14 |
| crowd_5 | 9880 | 20 | 0 | 0 | 6 | 26 | 2.63 | 24 | 0 | 0 | 6 | 30 | 3.04 |
| rec_one_5 | 9880 | 52 | 0 | 0 | 12 | 64 | 6.48 | 56 | 0 | 0 | 12 | 68 | 6.88 |
| pool_dev | 17474 | 0 | 0 | 0 | 0 | 0 | 0.00 | 2 | 0 | 0 | 0 | 2 | 0.11 |

### Model runs per minute, for the rule picked (judge slices plus padded runs)

From: tables.mjs, key runs.

S1.P3:

| population | minutes | wakes a minute | distinct judge slices a minute | model runs a minute, padded look at show time | at most, padded look on every suspect | marks checked | model runs per mark |
|---|---|---|---|---|---|---|---|
| pool | 366.7 | 0.39 | 0.35 | 0.36 | 0.46 | 6 | 1.83 |
| sobolev | 46.8 | 2.8 | 1.52 | 1.54 | 3.44 | 1 | 2 |
| voices_none_0 | 203.2 | 0.43 | 0.37 | 0.39 | 0.47 | 3 | 2 |
| voices_one_en_10 | 203.2 | 0.63 | 0.55 | 0.59 | 0.7 | 11 | 1.82 |
| voices_one_ar_10 | 203.2 | 0.66 | 0.59 | 0.62 | 0.77 | 8 | 1.75 |
| voices_crowd_10 | 203.2 | 0.8 | 0.67 | 0.72 | 0.91 | 10 | 2 |
| voices_tv_ar_10 | 203.2 | 0.8 | 0.68 | 0.75 | 0.98 | 18 | 1.78 |
| voices_rec_one_10 | 203.2 | 0.84 | 0.77 | 0.79 | 0.92 | 5 | 2 |
| voices_one_en_5 | 203.2 | 0.88 | 0.78 | 0.88 | 1.07 | 26 | 1.73 |
| voices_one_ar_5 | 203.2 | 1.02 | 0.98 | 1.12 | 1.41 | 42 | 1.69 |
| voices_crowd_5 | 203.2 | 1.3 | 1.21 | 1.38 | 1.7 | 43 | 1.79 |
| voices_tv_ar_5 | 203.2 | 1.46 | 1.32 | 1.53 | 2.04 | 49 | 1.84 |
| voices_rec_one_5 | 203.2 | 2.54 | 2.37 | 2.71 | 3.56 | 106 | 1.66 |
| voices_rec_same_5 | 203.2 | 4.16 | 3.15 | 3.69 | 5.72 | 147 | 1.73 |

S2.P4:

| population | minutes | wakes a minute | distinct judge slices a minute | model runs a minute, padded look at show time | at most, padded look on every suspect | marks checked | model runs per mark |
|---|---|---|---|---|---|---|---|
| pool | 366.7 | 3.25 | 3.16 | 3.17 | 3.27 | 7 | 1.57 |
| sobolev | 46.8 | 6.01 | 4.66 | 4.66 | 6.61 | 2 | 1 |
| voices_none_0 | 203.2 | 3.38 | 3.27 | 3.29 | 3.37 | 3 | 2 |
| voices_one_en_10 | 203.2 | 4.26 | 4.08 | 4.12 | 4.24 | 12 | 1.67 |
| voices_one_ar_10 | 203.2 | 4.24 | 4.06 | 4.09 | 4.24 | 8 | 1.75 |
| voices_crowd_10 | 203.2 | 4.6 | 4.4 | 4.45 | 4.64 | 10 | 2 |
| voices_tv_ar_10 | 203.2 | 4.44 | 4.23 | 4.29 | 4.53 | 18 | 1.61 |
| voices_rec_one_10 | 203.2 | 4.58 | 4.43 | 4.45 | 4.58 | 5 | 1.8 |
| voices_one_en_5 | 203.2 | 5.85 | 5.66 | 5.75 | 5.97 | 28 | 1.64 |
| voices_one_ar_5 | 203.2 | 5.79 | 5.64 | 5.77 | 6.08 | 44 | 1.59 |
| voices_crowd_5 | 203.2 | 7 | 6.76 | 6.91 | 7.26 | 45 | 1.69 |
| voices_tv_ar_5 | 203.2 | 6.31 | 6.04 | 6.22 | 6.79 | 52 | 1.71 |
| voices_rec_one_5 | 203.2 | 8.9 | 8.57 | 8.9 | 9.8 | 109 | 1.62 |
| voices_rec_same_5 | 203.2 | 11.48 | 10.06 | 10.54 | 12.68 | 155 | 1.63 |

### Latency from the next word's onset, median / p90 in seconds

From: tables.mjs, key latency.

| chain | W1 interior, clip alone: marks | at 0.25 s a run | at 0.6 s a run | live last word: marks | at 0.25 s a run | at 0.6 s a run | live first word: marks | at 0.25 s a run | at 0.6 s a run |
|---|---|---|---|---|---|---|---|---|---|
| J.none | 69 | 2.13 / 3.41 | 2.13 / 3.41 | 11 | 1.54 / 1.73 | 1.54 / 1.73 | 2 | 4.98 / 4.98 | 4.98 / 4.98 |
| S1.P1 | 69 | 2.25 / 3.76 | 2.86 / 4.42 | 90 | 2.22 / 2.77 | 2.84 / 3.1 | 14 | 3.83 / 5.45 | 4.53 / 5.85 |
| S1.P3 | 69 | 2.13 / 3.56 | 2.34 / 3.82 | 93 | 2.09 / 2.72 | 2.34 / 2.94 | 12 | 3.64 / 4.9 | 4.28 / 5.25 |
| S1h0.P3 | 69 | 2.13 / 3.41 | 2.13 / 3.51 | 93 | 1.92 / 2.72 | 2.09 / 2.72 | 11 | 3.35 / 4.67 | 3.76 / 4.77 |
| S1.P4 | 69 | 2.13 / 3.56 | 2.33 / 3.82 | 93 | 2.05 / 2.72 | 2.3 / 2.72 | 14 | 3.6 / 5.28 | 3.95 / 5.45 |
| S2.P1 | 172 | 2.17 / 2.91 | 2.84 / 3.49 | 106 | 2.22 / 2.77 | 2.84 / 3.07 | 54 | 3.85 / 4.98 | 4.53 / 5.22 |
| S2.P4 | 174 | 1.96 / 2.77 | 2.26 / 3.01 | 114 | 2.04 / 2.73 | 2.3 / 2.73 | 61 | 3.58 / 4.56 | 3.89 / 4.58 |
| S2h0.P4 | 173 | 1.81 / 2.77 | 1.88 / 2.77 | 114 | 1.89 / 2.73 | 1.94 / 2.73 | 61 | 3.37 / 4.56 | 3.47 / 4.56 |

The live interior suite's dev runs record no next-word onset, so it has no latency here.

### The phone switch: what the cancel step may cancel

From: tables.mjs, keys quranmb, pool, w1 and voices, chains ending in s.

| measure | all marks | skipped marks only |
|---|---|---|
| Step 1: real slips kept of 66 | 23 | 37 |
| Step 1: learner false marks kept of 86 | 4 | 31 |
| Step 1: pool dev false marks | 0 | 3 |
| Step 1: W1 interior | 31.8% [9.1, 59.3] | 31.8% [9.1, 59.3] |
| Step 1: W1 last | 76.2% [63.3, 88.5] | 76.2% [63.3, 88.5] |
| Step 1: W1 first | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| Step 1: W1 close | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] |
| Step 1: one_en_10 false marks | 4 | 6 |
| Step 1: one_ar_10 false marks | 1 | 5 |
| Step 1: crowd_10 false marks | 3 | 6 |
| Step 1: tv_ar_10 false marks | 10 | 13 |
| Step 1: rec_one_10 false marks | 1 | 3 |
| Step 1: one_en_5 false marks | 11 | 23 |
| Step 1: one_ar_5 false marks | 21 | 36 |
| Step 1: crowd_5 false marks | 20 | 42 |
| Step 1: tv_ar_5 false marks | 18 | 45 |
| Step 1: rec_one_5 false marks | 52 | 101 |
| Step 1: rec_same_5 false marks | 73 | 134 |
| Step 2: real slips kept of 66 | 24 | 37 |
| Step 2: learner false marks kept of 86 | 5 | 31 |
| Step 2: pool dev false marks | 2 | 5 |
| Step 2: W1 interior | 89.4% [76.6, 100.0] | 89.4% [76.6, 100.0] |
| Step 2: W1 last | 98.9% [96.8, 100.0] | 98.9% [96.8, 100.0] |
| Step 2: W1 first | 8.2% [0.0, 20.0] | 8.2% [0.0, 20.0] |
| Step 2: W1 close | 49.0% [23.3, 75.3] | 49.0% [23.3, 75.3] |
| Step 2: one_en_10 false marks | 5 | 7 |
| Step 2: one_ar_10 false marks | 1 | 5 |
| Step 2: crowd_10 false marks | 3 | 6 |
| Step 2: tv_ar_10 false marks | 12 | 15 |
| Step 2: rec_one_10 false marks | 1 | 3 |
| Step 2: one_en_5 false marks | 14 | 26 |
| Step 2: one_ar_5 false marks | 26 | 40 |
| Step 2: crowd_5 false marks | 24 | 44 |
| Step 2: tv_ar_5 false marks | 22 | 48 |
| Step 2: rec_one_5 false marks | 56 | 104 |
| Step 2: rec_same_5 false marks | 86 | 144 |

### Does the rule carry over to the judge's slice? QuranMB marks, no veto in front

From: tables.mjs, keys transfer and transferSpan.

| class | kept on both | only on its measured slice | only on the judge's slice | cancelled on both |
|---|---|---|---|---|
| false-incorrect | 3 | 1 | 1 | 65 |
| hit | 36 | 5 | 1 | 24 |
| near | 10 | 4 | 3 | 35 |
| false-correct | 1 | 0 | 0 | 15 |

On the same 220 marks the two first passes put the word's start 0.02 s apart at the median (p90 4.92) and its end 0.02 s apart (p90 5). At or below -6 per letter: 4 on its measured slice, 11 on the judge's, 4 on both.

### Paired differences, each interval on the difference itself

From: tables.mjs, key compare.

| first minus second | real slips | near | learner false marks | pool dev marks | W5 dev marks | voices at 10 dB | voices at 5 dB |
|---|---|---|---|---|---|---|---|
| holdZeroStep1 | +9 of 66 [-1.9, 22.5] | +6 of 52 [-1.3, 16.0] | 0 of 86 [-5.4, 5.7] | 0 | 0 | 0 marks, 0.00 [-0.23, 0.19] per 1,000 | 0 marks, 0.00 [-0.40, 0.41] per 1,000 |
| holdZeroStep2 | +9 of 66 [-1.8, 22.3] | +7 of 52 [-0.7, 16.9] | 0 of 86 [-5.4, 5.7] | -1 | 1 | +3 marks, 0.06 [-0.23, 0.41] per 1,000 | +17 marks, 0.29 [-0.11, 0.77] per 1,000 |
| noVetoStep1 | +14 of 66 [3.8, 26.6] | +6 of 52 [0.0, 16.8] | +1 of 86 [0.0, 6.0] | 2 | 0 | +9 marks, 0.18 [0.00, 0.47] per 1,000 | +34 marks, 0.57 [0.30, 0.87] per 1,000 |
| p4AgainstP3Step1 | +1 of 66 [0.0, 5.5] | 0 of 52 [0.0, 0.0] | +1 of 86 [0.0, 5.9] | 1 | 1 | +2 marks, 0.04 [0.00, 0.16] per 1,000 | +12 marks, 0.20 [0.04, 0.42] per 1,000 |

### Sobolev, phone recordings, each clip alone

From: tables.mjs, key sobolev.

451 clips, 46.8 minutes. Clips with no recorded error: 405, 1840 words. Labelled words: 52.

| chain | marks on clean clips | labelled words marked |
|---|---|---|
| J.none | 1 | 0 |
| S1.P1 | 1 | 0 |
| S1.P3 | 0 | 0 |
| S2.P4 | 2 | 0 |
| N1.P3 | 0 | 0 |
