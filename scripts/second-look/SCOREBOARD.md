# Scoreboard: the app as it stands, verdict to mark

The final numbers for the word marks, from the app's real code on 7 November 2026. Nothing
here has run on a phone. Nothing here changed a rule or a constant. The tables between
`table:` markers are written by `final/write_board.mjs` from `final/score.mjs`, so no number
in them was copied by hand.

## In one table

All voices are professional men in studio recordings unless the row says otherwise.
Intervals are 95%, resampling passages (or pairs, or events) together with reciters.
"Final" is the app's default: Step 1 of the judge with the letter-slip cancel step behind
it. "Step 2" is the same with the judge's Step 2 flag on. The verifier's row is the
independent check of the three fixes, its "corrected plus second look": Step 2 with the
second look that was in the app then (the -2 per letter rule).

| measure | sample | today | final | Step 2 | verifier |
|---|---|---|---|---|---|
| false marks on correct recitation, the pool, red plus added, per 1,000 words | 69,693 words, 357 takes, 20 reciters | 68: 0.98 [0.52, 1.46] | 7: 0.10 [0.01, 0.25] | 12 (9 red, 3 added) | 11: 0.16 [0.04, 0.34] |
| the same, test cell only | 18,038 words | 10: 0.55 | 4: 0.22 [0.00, 0.63] | 5 | 3 |
| W5, hard places, marks | 33,759 words | 52 | 6 | 8 | 7 |
| W1 words that do not differ, with the flush | 15,521 words | 50 | 3 | 7 | 3 (Step 2 alone) |
| changed word, W1 with the flush, exact word | 4,742 events, 119 pairs | 16.5% | 58.7% [50.7, 66.8] | 81.3% [74.9, 87.3] | 81.3% (Step 2), 59.6% (Step 1) |
| changed last word, live path | 269 runs, 38 pairs | 0.0% | 69.1% [54.6, 83.3] | 84.8% [75.4, 93.1] | 79.9% |
| changed first word, live path | 160 runs, 8 pairs | 1.3% | 14.4% [0.0, 40.5] | 76.9% [48.4, 97.0] | 70.0% |
| changed interior word, live path | 290 runs, 37 pairs | 48.3% | 47.2% [30.6, 65.0] | 78.6% [65.5, 90.3] | about 78.8% |
| left-out last word, natural sites | 961 runs, 49 sites | 14.5% | 98.8% [97.0, 99.9] | 98.8% | 98.8% |
| added word inside an ayah, place kept | 198 runs, 42 events, 4 reciters | none | 80.8% [65.7, 93.0] | 80.8% | 80.8% |
| added word, the app's flow with no help | 198 runs | none | 68.2% [52.0, 83.7] | 68.2% | 65.2% |
| QuranMB planted slips still marked, of today's 66 | 1,607 learner takes | 66 | 22, plus 4 new | 24, plus 12 new | not run |
| QuranMB false marks still marked, of today's 86 | the same | 86 | 4 | 6, plus 15 new | not run |
| voices, tuning half, another reciter on the same passage at 5 dB, red plus added | 9,880 words | 198: 20.04 | 85: 8.60 | 91 red, 8 added | not run |
| voices, held-out half, read once, red plus added, per 1,000 words: quiet / one Arabic voice 10 dB / crowd 10 dB / one Arabic voice 5 dB / crowd 5 dB / another reciter 5 dB | 49 takes, 9,093 words each | 0.55 / 1.76 / 1.43 / 6.93 / 6.82 / 15.73 | 0.33 / 0.33 / 0.33 / 3.30 / 2.64 / 8.69 | red alone: 0.33 / 0.66 / 0.55 / 3.63 / 3.30 / 7.81 | not run |
| second-model runs a minute, pool | 1,483 minutes | 0 | 0.25 | 2.78 | 0.62 and 3.18 wakes |

## How these numbers were made

- **The app's own code.** `final/build.mjs` bundles `RecitationTrackingService`, `wordMarks.ts`,
  `sessionRunner`, `secondLook/`, `secondJudge/` and `addedWord.ts` for node, with only the
  native edges swapped. The engine is `@tilawa/core` in `node_modules` (which is the pristine
  package with the working tree's patch, checked file by file), under the app's own wrapper
  `recitationEngine.ts`, so the options are the ones the app passes. The second model is the
  real quran-asr-small under onnxruntime-node, with the options `model.ts` passes.
- **Answers delayed as on a phone.** A clock moved by hand runs the app's timers. Each
  second-model run takes an assumed 0.25 s (plain column names) or 0.6 s (`@0.6`), while
  audio chunks keep arriving. These times are assumptions, not phone measurements.
- **Two ways through.** `final/real_pass.mjs` plays every clip through the whole real stack
  at the default setting and records what the wrapper reported. `final/play.mjs` plays that
  record through the other settings. On the same setting the two agree on the red marks of
  19,410 of 19,417 clips and on the added marks of all of them (the parity table at the
  end), so the other columns stand on the same footing.
- **Today.** The committed rules (`git show HEAD:services/recitation/wordMarks.ts`) on the
  committed engine (the pristine package with `git show HEAD:patches/@tilawa+core+0.4.0.patch`),
  through the bench's replay. Today's pool and W5 counts reproduce the baseline's 68 and 52.
- **The harness, where a suite needs one.** W1 clips, live last-word context runs, first-word
  runs and junction sites lock the tracker by hand, as `bench.mjs` does. The flush and the
  made-up next word exist only in the harness, so rows that use them are playback. Added-word
  events keep the place, as their own job did.
- **Units.** Catches are nearly all-or-nothing by pair, so pairs, sites and events are the
  real sample, not runs. Every interval resamples them together with reciters.

## The frozen rule

All 41 hashes in `.out/second-look/frozen.json` and the combined engine's copy matched at the
start, so nothing the rule rests on had moved since the freeze. One file moves now, by this
task: `chatter/run.mjs` gained `--half test` for the held-out read. Its test half writes its
clip list to `clips.test.json`, and the tuning half's list came out identical to the saved
`clips.json` (51 clips). The tuning cells' playback through the app (`repro/`) matched the
frozen stand-in, and so does this read: on the tuning cells the default's voices counts are
those of `RULE.md` give or take one to four marks a condition.

What is **not** what `RULE.md` names: the rule says to read the held-out half through
`repro/run.mjs`. This read goes further: through the app's real engine wrapper over the real
engine, not recorded bench verdicts, with `repro/`'s playback machinery reused for the other
settings.

## False marks on correct recitation

Every mark here is false: correct recitation read against its own text.

<!-- table:pool -->
Each cell is red marks ever shown, with the junction marks among them. Intervals resample passages and reciters together.

| cell | takes | words | today | off | s1 | s1@0.6 | s2 | s2@0.6 | s1s | s2s | added (s1) | red gone again (s1) | junction (s1) | red + added (s1) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| dev | 84 | 17474 | 27: 1.55 [0.65, 2.61] | 26: 1.49 [0.57, 2.55] | 0: 0.00 [0.00, 0.00] | 0: 0.00 [0.00, 0.00] | 2: 0.11 [0.00, 0.46] | 2: 0.11 [0.00, 0.46] | 3: 0.17 [0.00, 0.54] | 5: 0.29 [0.00, 0.88] | 0: 0.00 [0.00, 0.00] | 0 | 0 | 0: 0.00 [0.00, 0.00] |
| test | 96 | 18038 | 10: 0.55 [0.06, 1.35] | 9: 0.50 [0.04, 1.30] | 3: 0.17 [0.00, 0.54] | 3: 0.17 [0.00, 0.54] | 4: 0.22 [0.00, 0.63] | 4: 0.22 [0.00, 0.63] | 4: 0.22 [0.00, 0.67] | 5: 0.28 [0.00, 0.74] | 1: 0.06 [0.00, 0.30] | 0 | 0 | 4: 0.22 [0.00, 0.63] |
| mixed | 177 | 34181 | 31: 0.91 [0.36, 1.66] | 31: 0.91 [0.36, 1.66] | 1: 0.03 [0.00, 0.18] | 1: 0.03 [0.00, 0.18] | 3: 0.09 [0.00, 0.31] | 3: 0.09 [0.00, 0.31] | 3: 0.09 [0.00, 0.30] | 5: 0.15 [0.00, 0.41] | 2: 0.06 [0.00, 0.23] | 0 | 0 | 3: 0.09 [0.00, 0.29] |
| all | 357 | 69693 | 68: 0.98 [0.52, 1.46] | 66: 0.95 [0.49, 1.43] | 4: 0.06 [0.00, 0.17] | 4: 0.06 [0.00, 0.17] | 9: 0.13 [0.03, 0.29] | 9: 0.13 [0.03, 0.29] | 10: 0.14 [0.03, 0.31] | 15: 0.22 [0.05, 0.45] | 3: 0.04 [0.00, 0.16] | 0 | 0 | 7: 0.10 [0.01, 0.25] |
<!-- end -->

- The default leaves 4 red marks and 3 added marks in 69,693 words, against 68 today. Step 2
  leaves 9 red. The phone switch at "skipped marks only" leaves 10.
- The dev cell was tuned on. The test and mixed cells were read by the three fixes and the
  verifier, never by the cancel step's tuning, and they show the same picture (test 4 marks,
  mixed 3, red plus added).
- No junction mark and no red mark cleared by an added mark appears on the pool.
- Against the verifier's 11 (Step 2, old second look, plus added): Step 2 now gives 12, the
  default 7. The verifier's dev cell had 4 and now has 0 to 2, so the letter-slip rule does
  what it was tuned to do there, and the test and mixed cells move by one or two marks.

<!-- table:poolRestart -->
| column | ayat with a restart (20601 words) | other ayat (49092 words) |
|---|---|---|
| today | 44 | 24 |
| off | 43 | 23 |
| s1 | 3 | 1 |
| s1@0.6 | 3 | 1 |
| s2 | 6 | 3 |
| s2@0.6 | 6 | 3 |
| s1s | 7 | 3 |
| s2s | 10 | 5 |
<!-- end -->

<!-- table:poolLost -->
| hours | engine lost or idle events | an hour |
|---|---|---|
| 24.7 | 6 | 0.24 |
<!-- end -->

Most marks left still sit in ayat the reciter read twice. The follower itself loses the place
as often as it did (0.24 an hour, no bar met: the bar is once in 5 hours).

<!-- table:w5 -->
All W5, s1, per 1,000 words: 6: 0.18 [0.00, 0.70]. Today: 52: 1.54 [0.44, 4.05].

| set | runs | words | today | off | s1 | s1@0.6 | s2 | s2@0.6 | s1s | s2s | added (s1) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dev reciters (tuned on) | 1372 | 16620 | 32 | 32 | 4 | 4 | 6 | 6 | 9 | 10 | 0 |
| test reciters (read by the fixes and the verifier) | 1389 | 17139 | 20 | 20 | 2 | 2 | 2 | 2 | 3 | 3 | 0 |
| all | 2761 | 33759 | 52 | 52 | 6 | 6 | 8 | 8 | 12 | 13 | 0 |
| basmala | 20 | 80 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| madd_lazim | 570 | 11130 | 16 | 16 | 1 | 1 | 2 | 2 | 2 | 2 | 0 |
| midstart | 336 | 1899 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| muqattaat | 600 | 2060 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| options | 820 | 11180 | 6 | 6 | 1 | 1 | 1 | 1 | 2 | 2 | 0 |
| pause_over_3s | 40 | 1171 | 11 | 11 | 3 | 3 | 3 | 3 | 5 | 5 | 0 |
| sakta | 100 | 1120 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| silent_alif | 195 | 3099 | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 1 | 0 |
| written_form | 80 | 2020 | 17 | 17 | 1 | 1 | 2 | 2 | 2 | 3 | 0 |
<!-- end -->

W5 had 52 false marks today and has 6 under the default: 3 at pauses over 3 s, 1 on a madd
lazim word, 1 on an options site, 1 on a written-form word. The bar of no W5 mark is still not
met. No added mark appears in W5.

<!-- table:w1Other -->
A mark next to the event is the event's, as in the natural benchmark. Intervals resample pairs and reciters. These rows are playback, as the real pass plays no flush.

| cell | how | words | today | off | s1 | s2 | s1s |
|---|---|---|---|---|---|---|---|
| dev (tuned on) | clip alone | 3533 | 5: 1.42 [0.00, 5.20] | 5: 1.42 [0.00, 5.20] | 0: 0.00 [0.00, 0.00] | 0: 0.00 [0.00, 0.00] | 0: 0.00 [0.00, 0.00] |
| dev (tuned on) | flush and next word | 3533 | 21: 5.94 [0.00, 14.48] | 21: 5.94 [0.00, 14.48] | 0: 0.00 [0.00, 0.00] | 2: 0.57 [0.00, 2.75] | 0: 0.00 [0.00, 0.00] |
| test (read by the fixes and the verifier) | clip alone | 4222 | 3: 0.71 [0.00, 3.15] | 3: 0.71 [0.00, 3.15] | 0: 0.00 [0.00, 0.00] | 0: 0.00 [0.00, 0.00] | 0: 0.00 [0.00, 0.00] |
| test (read by the fixes and the verifier) | flush and next word | 4222 | 3: 0.71 [0.00, 3.15] | 3: 0.71 [0.00, 3.15] | 0: 0.00 [0.00, 0.00] | 0: 0.00 [0.00, 0.00] | 0: 0.00 [0.00, 0.00] |
| mixed (read by the verifier) | clip alone | 7766 | 12: 1.55 [0.00, 4.25] | 12: 1.55 [0.00, 4.25] | 0: 0.00 [0.00, 0.00] | 0: 0.00 [0.00, 0.00] | 0: 0.00 [0.00, 0.00] |
| mixed (read by the verifier) | flush and next word | 7766 | 26: 3.35 [0.46, 7.69] | 26: 3.35 [0.46, 7.69] | 3: 0.39 [0.00, 1.31] | 5: 0.64 [0.00, 1.95] | 3: 0.39 [0.00, 1.31] |
| all | clip alone | 15521 | 20: 1.29 [0.00, 3.49] | 20: 1.29 [0.00, 3.49] | 0: 0.00 [0.00, 0.00] | 0: 0.00 [0.00, 0.00] | 0: 0.00 [0.00, 0.00] |
| all | flush and next word | 15521 | 50: 3.22 [0.48, 6.96] | 50: 3.22 [0.48, 6.96] | 3: 0.19 [0.00, 0.66] | 7: 0.45 [0.00, 1.37] | 3: 0.19 [0.00, 0.66] |
<!-- end -->

<!-- table:w1Traps -->
| set | runs | words | today, clip alone | off, clip alone | s1, clip alone | s2, clip alone | s1s, clip alone | today, flush | s1, flush | s2, flush | added (s1) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| traps | 268 | 2396 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| controls | 3512 | 19546 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
<!-- end -->

With the clip alone, W1's words that do not differ get no mark under any setting. With the
flush and the made-up next word the default leaves 3 and Step 2 leaves 7, all on the second
word of the made-up next ayah (86:3 and 101:11). That word exists only in the harness: the
flush judges it as left out and the judge then calls it absent. It is a harness artefact, but
it is counted.

## Catches

These come from correct reciters read against another ayah's text. No real slip of a word is
among them.

### Changed words in W1

<!-- table:w1Carry -->
Intervals resample pairs and reciters together. dev was tuned on; test and mixed were read by the fixes and the verifier, not by the cancel step.

| cell | place | events, pairs | today | off | play s1 | s1@0.6 | s2 | s2@0.6 |
|---|---|---|---|---|---|---|---|---|
| all | all | 4742, 119 | 16.5% [10.3, 23.4] (784/4742) | 16.5% [10.3, 23.4] (784/4742) | 58.7% [50.7, 66.8] (2785/4742) | 58.7% [50.7, 66.8] (2785/4742) | 81.3% [74.9, 87.3] (3855/4742) | 81.3% [74.9, 87.3] (3855/4742) |
| all | interior | 1470, 37 | 52.3% [37.3, 68.3] (769/1470) | 52.3% [37.3, 68.3] (769/1470) | 49.6% [34.3, 65.3] (729/1470) | 49.6% [34.3, 65.3] (729/1470) | 86.6% [77.4, 94.4] (1273/1470) | 86.6% [77.4, 94.4] (1273/1470) |
| all | last | 2519, 63 | 0.6% [0.0, 1.9] (15/2519) | 0.6% [0.0, 1.9] (15/2519) | 81.6% [72.4, 89.8] (2056/2519) | 81.6% [72.4, 89.8] (2056/2519) | 99.2% [97.8, 100.0] (2498/2519) | 99.2% [97.8, 100.0] (2498/2519) |
| all | first | 753, 19 | 0.0% [0.0, 0.0] (0/753) | 0.0% [0.0, 0.0] (0/753) | 0.0% [0.0, 0.0] (0/753) | 0.0% [0.0, 0.0] (0/753) | 11.2% [2.8, 22.1] (84/753) | 11.2% [2.8, 22.1] (84/753) |
| all | close | 793, 20 | 0.0% [0.0, 0.0] (0/793) | 0.0% [0.0, 0.0] (0/793) | 0.0% [0.0, 0.0] (0/793) | 0.0% [0.0, 0.0] (0/793) | 52.0% [31.7, 72.1] (412/793) | 52.0% [31.7, 72.1] (412/793) |
| all | close interior | 280, 7 | 0.0% [0.0, 0.0] (0/280) | 0.0% [0.0, 0.0] (0/280) | 0.0% [0.0, 0.0] (0/280) | 0.0% [0.0, 0.0] (0/280) | 96.1% [90.7, 99.3] (269/280) | 96.1% [90.7, 99.3] (269/280) |
| all | close last | 120, 3 | 0.0% [0.0, 0.0] (0/120) | 0.0% [0.0, 0.0] (0/120) | 0.0% [0.0, 0.0] (0/120) | 0.0% [0.0, 0.0] (0/120) | 100.0% [100.0, 100.0] (120/120) | 100.0% [100.0, 100.0] (120/120) |
| all | close first | 393, 10 | 0.0% [0.0, 0.0] (0/393) | 0.0% [0.0, 0.0] (0/393) | 0.0% [0.0, 0.0] (0/393) | 0.0% [0.0, 0.0] (0/393) | 5.9% [0.0, 15.0] (23/393) | 5.9% [0.0, 15.0] (23/393) |
| dev | all | 1096, 55 | 6.3% [0.9, 12.8] (69/1096) | 6.3% [0.9, 12.8] (69/1096) | 52.2% [40.4, 64.7] (572/1096) | 52.2% [40.4, 64.7] (572/1096) | 78.9% [69.1, 88.3] (865/1096) | 78.9% [69.1, 88.3] (865/1096) |
| dev | interior | 217, 11 | 31.8% [9.1, 59.3] (69/217) | 31.8% [9.1, 59.3] (69/217) | 31.8% [9.1, 59.3] (69/217) | 31.8% [9.1, 59.3] (69/217) | 89.4% [76.7, 99.5] (194/217) | 89.4% [76.7, 99.5] (194/217) |
| dev | last | 660, 33 | 0.0% [0.0, 0.0] (0/660) | 0.0% [0.0, 0.0] (0/660) | 76.2% [63.5, 88.2] (503/660) | 76.2% [63.5, 88.2] (503/660) | 98.9% [96.8, 100.0] (653/660) | 98.9% [96.8, 100.0] (653/660) |
| dev | first | 219, 11 | 0.0% [0.0, 0.0] (0/219) | 0.0% [0.0, 0.0] (0/219) | 0.0% [0.0, 0.0] (0/219) | 0.0% [0.0, 0.0] (0/219) | 8.2% [0.0, 20.9] (18/219) | 8.2% [0.0, 20.9] (18/219) |
| dev | close | 239, 12 | 0.0% [0.0, 0.0] (0/239) | 0.0% [0.0, 0.0] (0/239) | 0.0% [0.0, 0.0] (0/239) | 0.0% [0.0, 0.0] (0/239) | 49.0% [23.3, 75.0] (117/239) | 49.0% [23.3, 75.0] (117/239) |
| test | all | 1275, 64 | 25.4% [15.2, 35.9] (324/1275) | 25.4% [15.2, 35.9] (324/1275) | 64.9% [53.7, 75.7] (828/1275) | 64.9% [53.7, 75.7] (828/1275) | 83.7% [75.6, 91.3] (1067/1275) | 83.7% [75.6, 91.3] (1067/1275) |
| test | interior | 518, 26 | 61.4% [43.8, 78.8] (318/518) | 61.4% [43.8, 78.8] (318/518) | 57.7% [39.4, 75.4] (299/518) | 57.7% [39.4, 75.4] (299/518) | 86.1% [73.2, 96.2] (446/518) | 86.1% [73.2, 96.2] (446/518) |
| test | last | 600, 30 | 1.0% [0.0, 3.5] (6/600) | 1.0% [0.0, 3.5] (6/600) | 88.2% [76.3, 98.3] (529/600) | 88.2% [76.3, 98.3] (529/600) | 100.0% [100.0, 100.0] (600/600) | 100.0% [100.0, 100.0] (600/600) |
| test | first | 157, 8 | 0.0% [0.0, 0.0] (0/157) | 0.0% [0.0, 0.0] (0/157) | 0.0% [0.0, 0.0] (0/157) | 0.0% [0.0, 0.0] (0/157) | 13.4% [0.0, 31.9] (21/157) | 13.4% [0.0, 31.9] (21/157) |
| test | close | 157, 8 | 0.0% [0.0, 0.0] (0/157) | 0.0% [0.0, 0.0] (0/157) | 0.0% [0.0, 0.0] (0/157) | 0.0% [0.0, 0.0] (0/157) | 57.3% [25.7, 88.6] (90/157) | 57.3% [25.7, 88.6] (90/157) |
| mixed | all | 2371, 119 | 16.5% [9.1, 24.9] (391/2371) | 16.5% [9.1, 24.9] (391/2371) | 58.4% [49.7, 67.2] (1385/2371) | 58.4% [49.7, 67.2] (1385/2371) | 81.1% [74.6, 87.3] (1923/2371) | 81.1% [74.6, 87.3] (1923/2371) |
| mixed | interior | 735, 37 | 52.0% [35.6, 68.6] (382/735) | 52.0% [35.6, 68.6] (382/735) | 49.1% [33.4, 65.5] (361/735) | 49.1% [33.4, 65.5] (361/735) | 86.1% [76.4, 94.2] (633/735) | 86.1% [76.4, 94.2] (633/735) |
| mixed | last | 1259, 63 | 0.7% [0.0, 2.4] (9/1259) | 0.7% [0.0, 2.4] (9/1259) | 81.3% [71.9, 90.4] (1024/1259) | 81.3% [71.9, 90.4] (1024/1259) | 98.9% [96.7, 100.0] (1245/1259) | 98.9% [96.7, 100.0] (1245/1259) |
| mixed | first | 377, 19 | 0.0% [0.0, 0.0] (0/377) | 0.0% [0.0, 0.0] (0/377) | 0.0% [0.0, 0.0] (0/377) | 0.0% [0.0, 0.0] (0/377) | 11.9% [3.2, 23.8] (45/377) | 11.9% [3.2, 23.8] (45/377) |
| mixed | close | 397, 20 | 0.0% [0.0, 0.0] (0/397) | 0.0% [0.0, 0.0] (0/397) | 0.0% [0.0, 0.0] (0/397) | 0.0% [0.0, 0.0] (0/397) | 51.6% [31.4, 71.9] (205/397) | 51.6% [31.4, 71.9] (205/397) |
<!-- end -->

<!-- table:w1App -->
Intervals resample pairs and reciters together. dev was tuned on; test and mixed were read by the fixes and the verifier, not by the cancel step.

| cell | place | events, pairs | today | off | s1 | s1@0.6 | s2 | s2@0.6 |
|---|---|---|---|---|---|---|---|---|
| all | all | 4742, 119 | 15.1% [8.9, 21.5] (715/4742) | 15.1% [8.9, 21.5] (715/4742) | 14.9% [8.8, 21.4] (707/4742) | 14.9% [8.8, 21.4] (707/4742) | 24.9% [17.8, 32.5] (1181/4742) | 24.9% [17.8, 32.5] (1181/4742) |
| all | interior | 1470, 37 | 48.6% [33.5, 64.8] (715/1470) | 48.6% [33.5, 64.8] (715/1470) | 48.1% [33.1, 64.4] (707/1470) | 48.1% [33.1, 64.4] (707/1470) | 74.6% [62.7, 87.3] (1097/1470) | 74.6% [62.7, 87.3] (1097/1470) |
| all | last | 2519, 63 | 0.0% [0.0, 0.0] (0/2519) | 0.0% [0.0, 0.0] (0/2519) | 0.0% [0.0, 0.0] (0/2519) | 0.0% [0.0, 0.0] (0/2519) | 0.0% [0.0, 0.0] (0/2519) | 0.0% [0.0, 0.0] (0/2519) |
| all | first | 753, 19 | 0.0% [0.0, 0.0] (0/753) | 0.0% [0.0, 0.0] (0/753) | 0.0% [0.0, 0.0] (0/753) | 0.0% [0.0, 0.0] (0/753) | 11.2% [2.8, 22.1] (84/753) | 11.2% [2.8, 22.1] (84/753) |
| all | close | 793, 20 | 0.0% [0.0, 0.0] (0/793) | 0.0% [0.0, 0.0] (0/793) | 0.0% [0.0, 0.0] (0/793) | 0.0% [0.0, 0.0] (0/793) | 27.1% [10.1, 46.3] (215/793) | 27.1% [10.1, 46.3] (215/793) |
| all | close interior | 280, 7 | 0.0% [0.0, 0.0] (0/280) | 0.0% [0.0, 0.0] (0/280) | 0.0% [0.0, 0.0] (0/280) | 0.0% [0.0, 0.0] (0/280) | 68.6% [28.6, 97.5] (192/280) | 68.6% [28.6, 97.5] (192/280) |
| all | close last | 120, 3 | 0.0% [0.0, 0.0] (0/120) | 0.0% [0.0, 0.0] (0/120) | 0.0% [0.0, 0.0] (0/120) | 0.0% [0.0, 0.0] (0/120) | 0.0% [0.0, 0.0] (0/120) | 0.0% [0.0, 0.0] (0/120) |
| all | close first | 393, 10 | 0.0% [0.0, 0.0] (0/393) | 0.0% [0.0, 0.0] (0/393) | 0.0% [0.0, 0.0] (0/393) | 0.0% [0.0, 0.0] (0/393) | 5.9% [0.0, 15.0] (23/393) | 5.9% [0.0, 15.0] (23/393) |
| dev | all | 1096, 55 | 6.3% [0.9, 12.8] (69/1096) | 6.3% [0.9, 12.8] (69/1096) | 6.3% [0.9, 12.8] (69/1096) | 6.3% [0.9, 12.8] (69/1096) | 17.5% [8.6, 27.0] (192/1096) | 17.5% [8.6, 27.0] (192/1096) |
| dev | interior | 217, 11 | 31.8% [9.1, 59.3] (69/217) | 31.8% [9.1, 59.3] (69/217) | 31.8% [9.1, 59.3] (69/217) | 31.8% [9.1, 59.3] (69/217) | 80.2% [60.7, 95.5] (174/217) | 80.2% [60.7, 95.5] (174/217) |
| dev | last | 660, 33 | 0.0% [0.0, 0.0] (0/660) | 0.0% [0.0, 0.0] (0/660) | 0.0% [0.0, 0.0] (0/660) | 0.0% [0.0, 0.0] (0/660) | 0.0% [0.0, 0.0] (0/660) | 0.0% [0.0, 0.0] (0/660) |
| dev | first | 219, 11 | 0.0% [0.0, 0.0] (0/219) | 0.0% [0.0, 0.0] (0/219) | 0.0% [0.0, 0.0] (0/219) | 0.0% [0.0, 0.0] (0/219) | 8.2% [0.0, 20.9] (18/219) | 8.2% [0.0, 20.9] (18/219) |
| dev | close | 239, 12 | 0.0% [0.0, 0.0] (0/239) | 0.0% [0.0, 0.0] (0/239) | 0.0% [0.0, 0.0] (0/239) | 0.0% [0.0, 0.0] (0/239) | 23.8% [0.0, 48.8] (57/239) | 23.8% [0.0, 48.8] (57/239) |
| test | all | 1275, 64 | 22.7% [12.6, 32.8] (289/1275) | 22.7% [12.6, 32.8] (289/1275) | 22.5% [12.5, 32.8] (287/1275) | 22.5% [12.5, 32.8] (287/1275) | 31.2% [20.5, 42.3] (398/1275) | 31.2% [20.5, 42.3] (398/1275) |
| test | interior | 518, 26 | 55.8% [36.6, 73.9] (289/518) | 55.8% [36.6, 73.9] (289/518) | 55.4% [36.3, 73.3] (287/518) | 55.4% [36.3, 73.3] (287/518) | 72.8% [55.8, 88.2] (377/518) | 72.8% [55.8, 88.2] (377/518) |
| test | last | 600, 30 | 0.0% [0.0, 0.0] (0/600) | 0.0% [0.0, 0.0] (0/600) | 0.0% [0.0, 0.0] (0/600) | 0.0% [0.0, 0.0] (0/600) | 0.0% [0.0, 0.0] (0/600) | 0.0% [0.0, 0.0] (0/600) |
| test | first | 157, 8 | 0.0% [0.0, 0.0] (0/157) | 0.0% [0.0, 0.0] (0/157) | 0.0% [0.0, 0.0] (0/157) | 0.0% [0.0, 0.0] (0/157) | 13.4% [0.0, 31.9] (21/157) | 13.4% [0.0, 31.9] (21/157) |
| test | close | 157, 8 | 0.0% [0.0, 0.0] (0/157) | 0.0% [0.0, 0.0] (0/157) | 0.0% [0.0, 0.0] (0/157) | 0.0% [0.0, 0.0] (0/157) | 31.8% [5.1, 65.0] (50/157) | 31.8% [5.1, 65.0] (50/157) |
| mixed | all | 2371, 119 | 15.1% [8.1, 23.2] (357/2371) | 15.1% [8.1, 23.2] (357/2371) | 14.8% [8.0, 22.7] (351/2371) | 14.8% [8.0, 22.7] (351/2371) | 24.9% [17.2, 33.3] (591/2371) | 24.9% [17.2, 33.3] (591/2371) |
| mixed | interior | 735, 37 | 48.6% [32.6, 65.7] (357/735) | 48.6% [32.6, 65.7] (357/735) | 47.8% [32.0, 64.5] (351/735) | 47.8% [32.0, 64.5] (351/735) | 74.3% [62.1, 87.0] (546/735) | 74.3% [62.1, 87.0] (546/735) |
| mixed | last | 1259, 63 | 0.0% [0.0, 0.0] (0/1259) | 0.0% [0.0, 0.0] (0/1259) | 0.0% [0.0, 0.0] (0/1259) | 0.0% [0.0, 0.0] (0/1259) | 0.0% [0.0, 0.0] (0/1259) | 0.0% [0.0, 0.0] (0/1259) |
| mixed | first | 377, 19 | 0.0% [0.0, 0.0] (0/377) | 0.0% [0.0, 0.0] (0/377) | 0.0% [0.0, 0.0] (0/377) | 0.0% [0.0, 0.0] (0/377) | 11.9% [3.2, 23.8] (45/377) | 11.9% [3.2, 23.8] (45/377) |
| mixed | close | 397, 20 | 0.0% [0.0, 0.0] (0/397) | 0.0% [0.0, 0.0] (0/397) | 0.0% [0.0, 0.0] (0/397) | 0.0% [0.0, 0.0] (0/397) | 27.2% [10.4, 47.2] (108/397) | 27.2% [10.4, 47.2] (108/397) |
<!-- end -->

<!-- table:w1Latency -->
| today | s1 | s1@0.6 | s2 | s2@0.6 |
|---|---|---|---|---|
| 1.9 / 2.65 (715) | 2 / 2.78 (707) | 2.27 / 3.06 (707) | 1.97 / 2.81 (1097) | 2.25 / 3.03 (1097) |
<!-- end -->

- With the flush, the default catches 58.7% of changed words and Step 2 81.3%, the verifier's
  own numbers (59.6% and 81.3%).
- **The default costs some interior catches.** With the flush, interior words go from 52.3%
  today to 49.6% (test cell 61.4% to 57.7%, mixed 52.0% to 49.1%; the dev cell, which was
  tuned on, does not move). From the clip alone 48.6% to 48.1%. The judge's veto and the
  cancel step drop a few true marks that today shows. Step 2 more than makes up for it.
- In W1, close pairs and first words are caught only by Step 2. On the live path Step 1
  catches 14% of first words.
- Latency still misses the bars of 1.5 s and 2.5 s: the default's interior marks show at a
  median 2.0 s and p90 2.78 s from the next word's onset.

<!-- table:w1Others -->
Small: 11 pairs of skipped words, 2 interior; 3 dropped-last pairs.

| event | events, pairs | today, clip | off, clip | s1, clip | s2, clip | today, flush | s1, flush | s2, flush |
|---|---|---|---|---|---|---|---|---|
| skipped, all | 214, 11 | 22.0% [4.8, 43.7] (47/214) | 22.0% [4.8, 43.7] (47/214) | 17.8% [3.3, 37.7] (38/214) | 17.8% [3.3, 37.7] (38/214) | 29.0% [8.9, 53.4] (62/214) | 20.1% [5.5, 39.6] (43/214) | 24.8% [6.8, 48.0] (53/214) |
| skipped, interior | 34, 2 | 55.9% [0.0, 100.0] (19/34) | 55.9% [0.0, 100.0] (19/34) | 55.9% [0.0, 100.0] (19/34) | 55.9% [0.0, 100.0] (19/34) | 100.0% [100.0, 100.0] (34/34) | 70.6% [16.7, 100.0] (24/34) | 100.0% [100.0, 100.0] (34/34) |
| dropped last, clip ends | 60, 3 | 0.0% [0.0, 0.0] (0/60) | 0.0% [0.0, 0.0] (0/60) | 0.0% [0.0, 0.0] (0/60) | 0.0% [0.0, 0.0] (0/60) | 0.0% [0.0, 0.0] (0/60) | 0.0% [0.0, 0.0] (0/60) | 0.0% [0.0, 0.0] (0/60) |
| junction, the one natural pair | 20, 1 | 75.0% [55.0, 90.0] (15/20) | 75.0% [55.0, 90.0] (15/20) | 75.0% [55.0, 90.0] (15/20) | 75.0% [55.0, 90.0] (15/20) | 75.0% [55.0, 90.0] (15/20) | 75.0% [55.0, 90.0] (15/20) | 75.0% [55.0, 90.0] (15/20) |
| added last | 20, 1 | 0.0% [0.0, 0.0] (0/20) | 0.0% [0.0, 0.0] (0/20) | 0.0% [0.0, 0.0] (0/20) | 0.0% [0.0, 0.0] (0/20) | 0.0% [0.0, 0.0] (0/20) | 0.0% [0.0, 0.0] (0/20) | 0.0% [0.0, 0.0] (0/20) |
<!-- end -->

The default lowers skipped-word catches too (with the flush 29.0% to 20.1%, 11 pairs, 2 of
them interior). Too small to read more into, but it points the same way as the interior
cost.

### The live path

Real next-ayah audio, no flush, no made-up next word.

<!-- table:live -->
A pair read both ways is one unit. Reciters and word types overlap the earlier splits, so this tests the live path, not new voices. Last-word context and first-word runs use a hand lock on shared words.

| place | reciters | runs, pairs | today | off | s1 | s1@0.6 | s2 | s2@0.6 |
|---|---|---|---|---|---|---|---|---|
| last word, whole-ayah pairs | all | 159, 8 | 0.0% [0.0, 0.0] (0/159) | 2.5% [0.0, 11.0] (4/159) | 64.2% [39.4, 84.1] (102/159) | 64.2% [39.4, 84.1] (102/159) | 81.1% [67.3, 92.8] (129/159) | 81.1% [67.3, 92.8] (129/159) |
| last word, whole-ayah pairs | dev reciters | 80, 8 | 0.0% [0.0, 0.0] (0/80) | 2.5% [0.0, 13.8] (2/80) | 67.5% [42.3, 89.1] (54/80) | 67.5% [42.3, 89.1] (54/80) | 85.0% [67.1, 96.8] (68/80) | 85.0% [67.1, 96.8] (68/80) |
| last word, whole-ayah pairs | test reciters | 79, 8 | 0.0% [0.0, 0.0] (0/79) | 2.5% [0.0, 11.0] (2/79) | 60.8% [35.1, 83.9] (48/79) | 60.8% [35.1, 83.9] (48/79) | 77.2% [57.3, 93.9] (61/79) | 77.2% [57.3, 93.9] (61/79) |
| last word, shared closing words | all | 110, 30 | 0.0% [0.0, 0.0] (0/110) | 16.4% [2.2, 32.4] (18/110) | 76.4% [57.3, 92.4] (84/110) | 76.4% [57.3, 92.4] (84/110) | 90.0% [78.8, 98.0] (99/110) | 90.0% [78.8, 98.0] (99/110) |
| last word, shared closing words | dev reciters | 53, 27 | 0.0% [0.0, 0.0] (0/53) | 17.0% [0.0, 38.5] (9/53) | 73.6% [51.9, 94.0] (39/53) | 73.6% [51.9, 94.0] (39/53) | 86.8% [68.7, 100.0] (46/53) | 86.8% [68.7, 100.0] (46/53) |
| last word, shared closing words | test reciters | 57, 27 | 0.0% [0.0, 0.0] (0/57) | 15.8% [1.6, 36.0] (9/57) | 78.9% [55.4, 96.3] (45/57) | 78.9% [55.4, 96.3] (45/57) | 93.0% [76.1, 100.0] (53/57) | 93.0% [76.1, 100.0] (53/57) |
| last word, all | all | 269, 38 | 0.0% [0.0, 0.0] (0/269) | 8.2% [1.8, 18.4] (22/269) | 69.1% [54.6, 83.3] (186/269) | 69.1% [54.6, 83.3] (186/269) | 84.8% [75.4, 93.1] (228/269) | 84.8% [75.4, 93.1] (228/269) |
| last word, all | dev reciters | 133, 35 | 0.0% [0.0, 0.0] (0/133) | 8.3% [0.4, 20.2] (11/133) | 69.9% [52.5, 85.5] (93/133) | 69.9% [52.5, 85.5] (93/133) | 85.7% [73.3, 95.0] (114/133) | 85.7% [73.3, 95.0] (114/133) |
| last word, all | test reciters | 136, 35 | 0.0% [0.0, 0.0] (0/136) | 8.1% [1.4, 19.3] (11/136) | 68.4% [50.9, 85.5] (93/136) | 68.4% [50.9, 85.5] (93/136) | 83.8% [70.6, 95.6] (114/136) | 83.8% [70.6, 95.6] (114/136) |
| first word | all | 160, 8 | 1.3% [0.0, 5.0] (2/160) | 1.3% [0.0, 5.0] (2/160) | 14.4% [0.0, 40.5] (23/160) | 14.4% [0.0, 40.5] (23/160) | 76.9% [48.4, 97.0] (123/160) | 76.9% [48.4, 97.0] (123/160) |
| first word | dev reciters | 80, 8 | 2.5% [0.0, 9.1] (2/80) | 2.5% [0.0, 9.1] (2/80) | 15.0% [0.0, 42.2] (12/80) | 15.0% [0.0, 42.2] (12/80) | 75.0% [48.2, 96.8] (60/80) | 75.0% [48.2, 96.8] (60/80) |
| first word | test reciters | 80, 8 | 0.0% [0.0, 0.0] (0/80) | 0.0% [0.0, 0.0] (0/80) | 13.8% [0.0, 39.3] (11/80) | 13.8% [0.0, 39.3] (11/80) | 78.8% [51.7, 100.0] (63/80) | 78.8% [51.7, 100.0] (63/80) |
| interior | all | 290, 37 | 48.3% [31.3, 65.8] (140/290) | 48.3% [31.3, 65.8] (140/290) | 47.2% [30.6, 65.0] (137/290) | 47.2% [30.6, 65.0] (137/290) | 78.6% [65.5, 90.3] (228/290) | 78.6% [65.5, 90.3] (228/290) |
| interior | dev reciters | 144, 37 | 48.6% [29.4, 67.9] (70/144) | 48.6% [29.4, 67.9] (70/144) | 46.5% [27.9, 65.3] (67/144) | 46.5% [27.9, 65.3] (67/144) | 79.9% [65.7, 91.4] (115/144) | 79.9% [65.7, 91.4] (115/144) |
| interior | test reciters | 146, 37 | 47.9% [29.8, 67.9] (70/146) | 47.9% [29.8, 67.9] (70/146) | 47.9% [29.8, 67.9] (70/146) | 47.9% [29.8, 67.9] (70/146) | 77.4% [61.9, 90.8] (113/146) | 77.4% [61.9, 90.8] (113/146) |
| close interior | all | 55, 7 | 0.0% [0.0, 0.0] (0/55) | 0.0% [0.0, 0.0] (0/55) | 0.0% [0.0, 0.0] (0/55) | 0.0% [0.0, 0.0] (0/55) | 89.1% [73.4, 100.0] (49/55) | 89.1% [73.4, 100.0] (49/55) |
| close interior | dev reciters | 27, 7 | 0.0% [0.0, 0.0] (0/27) | 0.0% [0.0, 0.0] (0/27) | 0.0% [0.0, 0.0] (0/27) | 0.0% [0.0, 0.0] (0/27) | 92.6% [74.2, 100.0] (25/27) | 92.6% [74.2, 100.0] (25/27) |
| close interior | test reciters | 28, 7 | 0.0% [0.0, 0.0] (0/28) | 0.0% [0.0, 0.0] (0/28) | 0.0% [0.0, 0.0] (0/28) | 0.0% [0.0, 0.0] (0/28) | 85.7% [60.0, 100.0] (24/28) | 85.7% [60.0, 100.0] (24/28) |
<!-- end -->

<!-- table:liveLatency -->
| place | s1 | s1@0.6 | s2 | s2@0.6 |
|---|---|---|---|---|
| last word, whole-ayah pairs | 2.2 / 2.96 (102) | 2.37 / 3.11 (102) | 2.1 / 2.95 (129) | 2.32 / 2.95 (129) |
| last word, shared closing words | 2.01 / 2.6 (84) | 2.42 / 2.98 (84) | 1.97 / 2.62 (99) | 2.29 / 2.62 (99) |
| last word, all | 2.12 / 2.92 (186) | 2.38 / 3.05 (186) | 2.06 / 2.92 (228) | 2.3 / 2.92 (228) |
| first word | 3.85 / 4.9 (23) | 4.36 / 5.05 (23) | 3.7 / 4.85 (123) | 3.99 / 4.94 (123) |
| interior | - | - | - | - |
| close interior | - | - | - | - |
<!-- end -->

<!-- table:liveControl -->
| runs | on the said word, s1 | on the said word, s2 | today | off | s1 | s1@0.6 | s2 | s2@0.6 | s1s | s2s |
|---|---|---|---|---|---|---|---|---|---|---|
| 128 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
<!-- end -->

- Against the verifier's corrected plus second look: last word 84.8% against 79.9% under Step
  2, first word 76.9% against 70.0%. Both gaps come from the cancel step: at Step 2 the
  letter-slip rule leaves alone a mark the judge identified, where the old -2 rule cancelled
  edge words that fit it. Interior 78.6% against about 78.8%: no gap.
- The default's own figures match the verifier's Step 1 within a point or two: last word 69.1%
  against 69.9%, first word 14.4% against 16.3%, interior 47.2% against 48.3%.
- The interior suite records no next-word onset, so it has no latency here; W1's interior
  latency is above.

### A left-out last word

<!-- table:sites -->
Rig lost events are left out as the verifier did, except in the column that says so.

| cell | runs, sites | today | off | s1 | s2 | s1 with the rig's lost events kept (real pass) | junction fired |
|---|---|---|---|---|---|---|---|
| dev (version 2 tuned on) | 187, 19 | 4.8% [0.0, 16.0] (9/187) | 100.0% [100.0, 100.0] (187/187) | 100.0% [100.0, 100.0] (187/187) | 100.0% [100.0, 100.0] (187/187) | 100.0% [100.0, 100.0] (187/187) | 100.0% [100.0, 100.0] (187/187) |
| test (read before version 2 was fixed) | 293, 30 | 21.8% [8.4, 37.3] (64/293) | 99.7% [98.0, 100.0] (292/293) | 99.7% [98.0, 100.0] (292/293) | 99.7% [98.0, 100.0] (292/293) | 99.7% [98.0, 100.0] (292/293) | 99.7% [98.0, 100.0] (292/293) |
| mixed (read once on version 2; same sites) | 481, 49 | 13.7% [5.3, 23.9] (66/481) | 97.7% [94.1, 99.8] (470/481) | 97.7% [94.1, 99.8] (470/481) | 97.7% [94.1, 99.8] (470/481) | 97.7% [94.1, 99.8] (470/481) | 97.7% [94.1, 99.8] (470/481) |
| all | 961, 49 | 14.5% [5.9, 24.3] (139/961) | 98.8% [97.0, 99.9] (949/961) | 98.8% [97.0, 99.9] (949/961) | 98.8% [97.0, 99.9] (949/961) | 98.8% [97.0, 99.9] (949/961) | 98.8% [97.0, 99.9] (949/961) |
<!-- end -->

<!-- table:sitesLatency -->
| s1 | s2 |
|---|---|
| 1.64 / 2.81 (949) | 1.64 / 2.81 (949) |
<!-- end -->

<!-- table:sitesControl -->
| runs, sites | junction fires on it | marks on it, today | off | s1 | s2 | other marks, s1 | added marks (s1) |
|---|---|---|---|---|---|---|---|
| 958, 49 | 0 | 0 | 0 | 0 | 0 | 1 | 2 |
<!-- end -->

- 98.8% at every setting, the verifier's number: junction marks skip the judge and the cancel
  step, as the rule says. The clean hold-out of this check is still version 1's 95.9% on the
  test split, read once; version 2 was fixed after that look and has no untouched site left.
- The site rig's tracker reports `lost` around the join because it locks with no history; the
  verifier left those events out. Keeping them changes nothing at the default.
- No junction mark fell on the 958 controls, where the same word is said.

### Added words

<!-- table:added -->
Test events, read by the fix's own report and the verifier. 4 reciters: too few to speak for voices.

| class | runs, events, reciters | caught | median / p90 s from the next word | runs with red on a neighbour: today | s1 | s2 | of s1, red cleared later |
|---|---|---|---|---|---|---|---|
| inside an ayah, recording starts in the shared words, place kept | 198, 42, 4 | 80.8% [65.7, 93.0] (160/198) | 1.67 / 2.69 | 5 | 0 | 4 | 0 |
| same, 2 or more shared words after | 35, 8, 4 | 100.0% [100.0, 100.0] (35/35) | 1.96 / 2.71 | 0 | 0 | 0 | 0 |
| recording starts on other words, place kept | 128, 31, 4 | 64.1% [46.9, 77.7] (82/128) | 1.67 / 2.62 | 13 | 4 | 7 | 0 |
| between two ayat, arrives through other words, place kept | 48, 17, 4 | 22.9% [1.6, 56.4] (11/48) | 2.41 / 2.64 | 1 | 0 | 0 | 0 |
| all classes, place kept | 374, 88, 4 | 67.6% [56.8, 77.9] (253/374) | 1.67 / 2.66 | 19 | 4 | 11 | 0 |
| inside an ayah, the app's flow, no help | 198, 42, 4 | 68.2% [52.0, 83.7] (135/198) | 1.72 / 3.33 | 3 | 0 | 4 | 0 |
<!-- end -->

<!-- table:addedFalse -->
| set | runs | words | added marks, s1 |
|---|---|---|---|
| pool, test cell | 96 | 18038 | 1: 0.06 [0.00, 0.30] |
| pool, all | 357 | 69693 | 3: 0.04 [0.00, 0.16] |
| W5 | 2761 | 33759 | 0: 0.00 [0.00, 0.00] |
| W1 controls | 3512 | 19546 | 0: 0.00 [0.00, 0.00] |
| junction controls | 958 | 18584 | 2: 0.11 [0.00, 0.54] |
| live controls | 128 | 432 | 0: 0.00 [0.00, 0.00] |
<!-- end -->

- Inside an ayah with the place kept: 80.8%, as the fix's report and the verifier said. With
  the app's flow and no help: 68.2%, against the verifier's 65.2%. That is 6 more runs of 198,
  inside the interval; this read goes through the app's real wrapper and service, where the
  earlier figure came from the bench's path.
- Red marks on the two correct words around an added word: today 5 runs of 198, the default
  0, Step 2 4. The clearing and the hold work in the app's flow.
- False added marks: 3 in 69,693 pool words, 0 in W5 and in W1's controls, 2 in the 958
  junction controls (one recording, the same place in 2:235, under two sites, as the verifier
  found).
- The 90% bar is not met, and 4 reciters are too few to speak for voices.

## Real slips

<!-- table:quranmb -->
Not held out: the two cancel thresholds were chosen on these marks. Intervals resample speakers and words.

| column | hit | near | false on a wrong clip | false on a correct clip | marks today did not show | added |
|---|---|---|---|---|---|---|
| today | 66/66 100.0% [100.0, 100.0] | 52/52 100.0% [100.0, 100.0] | 70/70 100.0% [100.0, 100.0] | 16/16 100.0% [100.0, 100.0] | {lead:3} | 0 |
| off | 66/66 100.0% [100.0, 100.0] | 52/52 100.0% [100.0, 100.0] | 70/70 100.0% [100.0, 100.0] | 16/16 100.0% [100.0, 100.0] | {hit:2,lead:3} | 1 |
| s1 | 22/66 33.3% [8.1, 61.5] | 8/52 15.4% [0.0, 36.7] | 3/70 4.3% [0.0, 16.0] | 1/16 6.3% [0.0, 21.6] | {hit:4,lead:4} | 1 |
| s1@0.6 | 22/66 33.3% [8.1, 61.5] | 8/52 15.4% [0.0, 36.7] | 3/70 4.3% [0.0, 16.0] | 1/16 6.3% [0.0, 21.6] | {hit:4,lead:4} | 1 |
| s2 | 24/66 36.4% [10.4, 64.8] | 8/52 15.4% [0.0, 36.7] | 5/70 7.1% [0.0, 20.3] | 1/16 6.3% [0.0, 21.6] | {near:5,hit:12,false-incorrect:14,lead:6,false-correct:1} | 1 |
| s2@0.6 | 24/66 36.4% [10.4, 64.8] | 8/52 15.4% [0.0, 36.7] | 5/70 7.1% [0.0, 20.3] | 1/16 6.3% [0.0, 21.6] | {near:5,hit:12,false-incorrect:14,lead:6,false-correct:1} | 1 |
| s1s | 38/66 57.6% [33.0, 80.4] | 17/52 32.7% [10.8, 58.7] | 23/70 32.9% [17.0, 51.7] | 6/16 37.5% [0.0, 76.2] | {near:1,hit:7,lead:4} | 1 |
| s2s | 39/66 59.1% [34.7, 81.8] | 17/52 32.7% [10.8, 58.7] | 23/70 32.9% [17.0, 51.7] | 6/16 37.5% [0.0, 76.2] | {near:5,hit:12,false-incorrect:14,lead:6,false-correct:1} | 1 |
<!-- end -->

- QuranMB holds learners' planted slips. It is not held out: the cancel step's two thresholds
  were chosen on these very marks. Of today's 66 real slips the default keeps 22 and adds 4
  new ones, of today's 86 false marks it keeps 4. `RULE.md` gave 23 and 4; 22 is what the
  learner-voices job found with the tracker's frames, as the app has them.
- The switch at "skipped marks only" keeps 38 real slips but also 29 false marks.
- Step 2 keeps 24 and adds 12 new real slips, with 14 new false marks on wrong clips and 1 on a
  correct clip, marks the cancel step may not touch at Step 2.
- 13 of the 26 slips the default shows sit on two words, so these are fewer cases than the
  counts suggest.

<!-- table:learners -->
Sobolev's clean clips are not verified correct. Al-Ikhlas is its dev half by participant; the test half stays unread.

| set | column | clips, speakers | marks on clips with no recorded error, in words | added marks there | labelled words with a mark on or next to them |
|---|---|---|---|---|---|
| sobolev | today | 451, 57 | 1 in 1840 | 0 | 0 of 52 |
| sobolev | off | 451, 57 | 1 in 1840 | 0 | 0 of 52 |
| sobolev | s1 | 451, 57 | 0 in 1840 | 0 | 0 of 52 |
| sobolev | s2 | 451, 57 | 2 in 1840 | 0 | 0 of 52 |
| sobolev | s1s | 451, 57 | 0 in 1840 | 0 | 0 of 52 |
| al-ikhlas | today | 787, 201 | 0 in 1248 | 0 | 0 of 675 |
| al-ikhlas | off | 787, 201 | 0 in 1248 | 0 | 0 of 675 |
| al-ikhlas | s1 | 787, 201 | 0 in 1248 | 0 | 0 of 675 |
| al-ikhlas | s2 | 787, 201 | 0 in 1248 | 0 | 0 of 675 |
| al-ikhlas | s1s | 787, 201 | 0 in 1248 | 0 | 0 of 675 |
<!-- end -->

<!-- table:sobolevMulti -->
| clips | junction fires | red marks, today | s1 | s2 | added, s1 |
|---|---|---|---|---|---|
| 103 | 0 | 1 | 0 | 2 | 0 |
<!-- end -->

The phone-recorded learner sets stay too small to certify anything: no labelled word is
marked under any setting, as before.

**Beside these: learners with voices behind them** (`.out/chatter/learners_built/report.md`,
a finished job, not rerun). Six voices pooled, the default keeps 55% of real slips (37 to 72)
and 33% of false marks (21 to 47): 5.94 slips and 6.94 false marks per 1,000 learner words,
against 2.67 and 0.48 on clean audio. It found hits above chance under every chain but no
higher above it than today's once word length is matched; its own review said that reading
rests on a ratio that can barely move, so it is unsettled. The switch at "skipped marks only"
added about two false marks per extra slip. Those numbers ran the frozen chain, not the app's
modules.

## Voices behind correct recitation, tuning half

<!-- table:voices -->
Tuned on: the rule was frozen on these. Voices pass through simulated rooms, so this ranks rules and predicts no phone. Intervals resample passages and reciters.

| condition | takes, words, minutes | today | off | s1 | s1@0.6 | s2 | s2@0.6 | s1s | s2s | added (s1) | junction fires | red + added (s1) | engine lost or idle an hour |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| none_0 | 51, 9880, 203 | 15: 1.52 [0.40, 3.08] | 15: 1.52 [0.40, 3.08] | 0: 0.00 [0.00, 0.00] | 0: 0.00 [0.00, 0.00] | 0: 0.00 [0.00, 0.00] | 0: 0.00 [0.00, 0.00] | 1: 0.10 [0.00, 0.56] | 1: 0.10 [0.00, 0.56] | 0: 0.00 [0.00, 0.00] | 0 | 0: 0.00 [0.00, 0.00] | 0 |
| one_en_10 | 51, 9880, 203 | 24: 2.43 [0.72, 4.76] | 24: 2.43 [0.72, 4.76] | 4: 0.40 [0.00, 1.27] | 4: 0.40 [0.00, 1.27] | 5: 0.51 [0.00, 1.39] | 5: 0.51 [0.00, 1.39] | 6: 0.61 [0.00, 1.62] | 7: 0.71 [0.00, 1.69] | 1: 0.10 [0.00, 0.59] | 0 | 5: 0.51 [0.00, 1.43] | 0.6 |
| one_ar_10 | 51, 9880, 203 | 25: 2.53 [0.98, 4.66] | 25: 2.53 [0.98, 4.66] | 2: 0.20 [0.00, 0.78] | 2: 0.20 [0.00, 0.78] | 3: 0.30 [0.00, 1.10] | 3: 0.30 [0.00, 1.10] | 6: 0.61 [0.00, 1.65] | 7: 0.71 [0.00, 1.79] | 3: 0.30 [0.00, 0.96] | 0 | 5: 0.51 [0.00, 1.65] | 0.9 |
| crowd_10 | 51, 9880, 203 | 29: 2.94 [1.17, 6.08] | 29: 2.94 [1.17, 6.08] | 3: 0.30 [0.00, 1.46] | 3: 0.30 [0.00, 1.46] | 3: 0.30 [0.00, 1.46] | 3: 0.30 [0.00, 1.46] | 6: 0.61 [0.00, 2.89] | 6: 0.61 [0.00, 2.89] | 4: 0.40 [0.00, 1.53] | 0 | 7: 0.71 [0.00, 2.29] | 0.3 |
| tv_ar_10 | 51, 9880, 203 | 35: 3.54 [1.33, 6.34] | 35: 3.54 [1.33, 6.34] | 10: 1.01 [0.10, 2.23] | 11: 1.11 [0.18, 2.36] | 11: 1.11 [0.15, 2.33] | 12: 1.21 [0.22, 2.42] | 14: 1.42 [0.24, 3.01] | 15: 1.52 [0.30, 3.12] | 2: 0.20 [0.00, 0.92] | 0 | 12: 1.21 [0.23, 2.59] | 1.8 |
| rec_one_10 | 51, 9880, 203 | 33: 3.34 [1.25, 6.31] | 33: 3.34 [1.25, 6.31] | 3: 0.30 [0.00, 1.02] | 3: 0.30 [0.00, 1.02] | 3: 0.30 [0.00, 1.02] | 3: 0.30 [0.00, 1.02] | 7: 0.71 [0.00, 2.29] | 7: 0.71 [0.00, 2.29] | 2: 0.20 [0.00, 0.80] | 0 | 5: 0.51 [0.00, 1.57] | 0.9 |
| one_en_5 | 51, 9880, 203 | 48: 4.86 [2.27, 9.20] | 48: 4.86 [2.27, 9.20] | 11: 1.11 [0.00, 3.56] | 11: 1.11 [0.00, 3.56] | 13: 1.32 [0.12, 3.69] | 13: 1.32 [0.12, 3.69] | 23: 2.33 [0.61, 5.26] | 25: 2.53 [0.83, 5.38] | 0: 0.00 [0.00, 0.00] | 0 | 11: 1.11 [0.00, 3.56] | 1.2 |
| one_ar_5 | 51, 9880, 203 | 64: 6.48 [2.93, 10.84] | 63: 6.38 [2.93, 10.48] | 21: 2.13 [0.34, 4.40] | 21: 2.13 [0.34, 4.40] | 26: 2.63 [0.62, 5.20] | 26: 2.63 [0.62, 5.20] | 35: 3.54 [0.86, 6.88] | 39: 3.95 [1.10, 7.48] | 5: 0.51 [0.00, 1.33] | 0 | 26: 2.63 [0.66, 5.13] | 1.5 |
| crowd_5 | 51, 9880, 203 | 70: 7.09 [3.33, 12.03] | 68: 6.88 [3.30, 11.64] | 19: 1.92 [0.46, 3.90] | 20: 2.02 [0.50, 4.08] | 23: 2.33 [0.75, 4.45] | 24: 2.43 [0.80, 4.52] | 38: 3.85 [1.32, 7.18] | 41: 4.15 [1.53, 7.45] | 6: 0.61 [0.00, 1.45] | 0 | 25: 2.53 [0.71, 4.77] | 2.1 |
| tv_ar_5 | 51, 9880, 203 | 71: 7.19 [3.90, 11.49] | 71: 7.19 [3.90, 11.49] | 18: 1.82 [0.50, 3.61] | 20: 2.02 [0.58, 3.87] | 24: 2.43 [0.86, 4.37] | 25: 2.53 [0.88, 4.43] | 45: 4.55 [1.95, 8.10] | 50: 5.06 [2.35, 8.78] | 3: 0.30 [0.00, 1.05] | 0 | 21: 2.13 [0.72, 3.90] | 12.1 |
| rec_one_5 | 51, 9880, 203 | 159: 16.09 [8.68, 25.87] | 157: 15.89 [8.46, 25.59] | 49: 4.96 [2.09, 9.32] | 49: 4.96 [2.09, 9.32] | 52: 5.26 [2.30, 9.84] | 52: 5.26 [2.30, 9.84] | 96: 9.72 [4.23, 17.98] | 99: 10.02 [4.30, 18.77] | 12: 1.21 [0.25, 2.64] | 0 | 61: 6.17 [2.71, 10.78] | 10.3 |
| rec_same_5 | 51, 9880, 203 | 198: 20.04 [7.07, 38.93] | 199: 20.14 [7.28, 39.01] | 77: 7.79 [2.04, 16.38] | 77: 7.79 [2.04, 16.12] | 91: 9.21 [2.57, 18.65] | 91: 9.21 [2.57, 18.42] | 132: 13.36 [3.80, 28.18] | 143: 14.47 [4.35, 29.26] | 8: 0.81 [0.00, 2.49] | 3 | 85: 8.60 [2.35, 17.61] | 14.5 |
<!-- end -->

- These are the conditions the rule was frozen on, so they are not held out.
- Red marks under the default: 0 in quiet, 0.2 to 1.0 per 1,000 at 10 dB, 1.1 to 2.1 at 5 dB
  with speech behind, and 5.0 and 7.8 with another reciter behind at 5 dB. Today shows 1.5,
  2.4 to 3.5, 4.9 to 7.2, and 16.1 and 20.0.
- Added marks grow with the voices, up to 1.21 per 1,000 with another reciter at 5 dB. At 10
  dB with one Arabic voice or a crowd they outnumber the red marks left (3 against 2, 4
  against 3).
- No junction mark fires under voices except 3 with the same passage read 6 s ahead at 5 dB.

## The held-out read

Written down before it was read: the pool's test half (10 test reciters on test passages, 49
takes, 197.5 minutes) with voices behind, which no job had read under voices. The same takes
with nothing behind them are part of the pool's test cell, read before. Conditions
none:0, one_ar:10, crowd:10, one_ar:5, crowd:5 and rec_one:5, 17 minutes per reciter, through
`chatter/run.mjs --half test` once on today's committed engine and once on the app's, kept
apart by `--variant`, then through the app's real stack and playback. The main figure is the
default's false marks per 1,000 words, red plus added, beside today's on the same clips.
`rec_one`'s voices are 6 test reciters, so a reader can have his own voice behind him (on
another passage); the read reports takes with and without that overlap.

What it showed, whichever way it fell:

- **Quiet:** the default shows 3 false marks in 9,093 words (0.33 [0.00, 1.04] per 1,000)
  against 5 today. This row is not new: the 49 takes are part of the pool's test cell, and
  these are the same 3 marks as there. On the tuning half quiet gave 0 against 15, so quiet
  is not as clean as the tuning half made it look.
- **10 dB:** 3 marks in each condition (0.33), against 16 and 13 today. This holds up.
- **5 dB:** one Arabic voice 30 (3.30 [0.76, 7.09]) against 63 today, a crowd 24 (2.64) against
  62, another reciter 79 (8.69 [4.27, 14.69]) against 143. The default removes 56% to 65% of
  red marks here, against 67% to 73% on the tuning half: still a large cut, but smaller than
  tuned.
- **Added marks** with another reciter behind at 5 dB double: 24 (2.64 per 1,000) against 12
  (1.21) on the tuning half. They are 24 of the 79 marks left there.
- **The follower** loses the place far more often here with voices at 5 dB: 7.6 and 19.7 times
  an hour with a crowd and with another reciter, against 2.1 and 10.3 on the tuning half.
- The bar of at most 1 false mark per 1,000 words is met in quiet and at 10 dB, and missed at
  5 dB in every condition.
- Real pass and playback gave the same marks on all 294 takes.

<!-- table:heldout -->
Read once, with the rule frozen. Intervals resample passages and reciters together.

| condition | takes, words, minutes | today | off | s1 | s1@0.6 | s2 | s2@0.6 | s1s | s2s | added (s1) | junction fires | red + added (s1) | engine lost or idle an hour |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| none_0 | 49, 9093, 197 | 5: 0.55 [0.00, 1.51] | 5: 0.55 [0.00, 1.51] | 3: 0.33 [0.00, 1.04] | 3: 0.33 [0.00, 1.04] | 3: 0.33 [0.00, 1.04] | 3: 0.33 [0.00, 1.04] | 3: 0.33 [0.00, 1.04] | 3: 0.33 [0.00, 1.04] | 0: 0.00 [0.00, 0.00] | 0 | 3: 0.33 [0.00, 1.04] | 0 |
| one_ar_10 | 49, 9093, 197 | 16: 1.76 [0.47, 3.61] | 16: 1.76 [0.47, 3.61] | 2: 0.22 [0.00, 0.93] | 2: 0.22 [0.00, 0.93] | 6: 0.66 [0.00, 1.74] | 6: 0.66 [0.00, 1.74] | 5: 0.55 [0.00, 1.49] | 9: 0.99 [0.00, 2.44] | 1: 0.11 [0.00, 0.60] | 0 | 3: 0.33 [0.00, 1.04] | 0 |
| crowd_10 | 49, 9093, 197 | 13: 1.43 [0.34, 2.98] | 13: 1.43 [0.34, 2.98] | 3: 0.33 [0.00, 1.46] | 3: 0.33 [0.00, 1.46] | 5: 0.55 [0.00, 1.73] | 5: 0.55 [0.00, 1.73] | 6: 0.66 [0.00, 1.95] | 8: 0.88 [0.00, 2.17] | 0: 0.00 [0.00, 0.00] | 0 | 3: 0.33 [0.00, 1.46] | 0.9 |
| one_ar_5 | 49, 9093, 197 | 63: 6.93 [1.65, 15.23] | 63: 6.93 [1.65, 15.23] | 28: 3.08 [0.67, 6.80] | 27: 2.97 [0.67, 6.55] | 33: 3.63 [1.28, 7.32] | 32: 3.52 [1.24, 7.09] | 46: 5.06 [1.19, 11.75] | 51: 5.61 [1.90, 12.00] | 2: 0.22 [0.00, 0.86] | 1 | 30: 3.30 [0.76, 7.09] | 2.4 |
| crowd_5 | 49, 9093, 197 | 62: 6.82 [1.29, 14.77] | 62: 6.82 [1.29, 14.77] | 22: 2.42 [0.23, 5.60] | 22: 2.42 [0.23, 5.60] | 30: 3.30 [0.41, 7.74] | 30: 3.30 [0.41, 7.74] | 43: 4.73 [0.54, 10.57] | 50: 5.50 [0.76, 12.04] | 2: 0.22 [0.00, 0.82] | 0 | 24: 2.64 [0.23, 6.20] | 7.6 |
| rec_one_5 | 49, 9093, 197 | 143: 15.73 [6.97, 26.32] | 140: 15.40 [6.62, 25.76] | 55: 6.05 [2.42, 10.88] | 56: 6.16 [2.46, 11.02] | 71: 7.81 [3.44, 13.47] | 71: 7.81 [3.48, 13.19] | 93: 10.23 [3.92, 18.95] | 108: 11.88 [4.90, 21.11] | 24: 2.64 [1.06, 4.50] | 0 | 79: 8.69 [4.27, 14.69] | 19.7 |
<!-- end -->

<!-- table:heldoutSelf -->
| takes | count | words | minutes with his own voice behind | today | s1 | s2 | added (s1) |
|---|---|---|---|---|---|---|---|
| no overlap | 42 | 7384 | 0.0 | 102: 13.81 [5.92, 23.34] | 38: 5.15 [2.30, 9.46] | 48: 6.50 [2.99, 10.82] | 19 |
| some overlap | 7 | 1709 | 11.8 | 41: 23.99 [5.21, 45.49] | 17: 9.95 [0.00, 21.76] | 23: 13.46 [0.00, 27.11] | 5 |
<!-- end -->

<!-- table:heldoutCost -->
| population | setting | minutes | wakes a minute | model runs a minute | first passes | padded looks | failed open | timeouts | dropped | queue max | most runs in one take |
|---|---|---|---|---|---|---|---|---|---|---|---|
| none_0 | s1 at 0.25 s | 197 | 0.11 | 0.11 | 20 | 3 | 0 | 0 | 0 | 1 | 5 |
| none_0 | s1 at 0.6 s | 197 | 0.11 | 0.11 | 20 | 2 | 0 | 0 | 0 | 1 | 4 |
| none_0 | s2 at 0.25 s | 197 | 2.74 | 2.73 | 539 | 2 | 0 | 0 | 0 | 1 | 37 |
| none_0 | s2 at 0.6 s | 197 | 2.74 | 2.73 | 539 | 2 | 0 | 0 | 0 | 1 | 37 |
| one_ar_10 | s1 at 0.25 s | 197 | 0.35 | 0.35 | 68 | 14 | 0 | 0 | 0 | 1 | 8 |
| one_ar_10 | s1 at 0.6 s | 197 | 0.35 | 0.33 | 68 | 10 | 0 | 0 | 0 | 1 | 8 |
| one_ar_10 | s2 at 0.25 s | 197 | 3.58 | 3.51 | 705 | 12 | 0 | 0 | 0 | 1 | 44 |
| one_ar_10 | s2 at 0.6 s | 197 | 3.58 | 3.48 | 703 | 9 | 0 | 0 | 0 | 1 | 44 |
| crowd_10 | s1 at 0.25 s | 197 | 0.41 | 0.42 | 79 | 13 | 0 | 0 | 0 | 1 | 8 |
| crowd_10 | s1 at 0.6 s | 197 | 0.41 | 0.39 | 75 | 11 | 0 | 0 | 0 | 1 | 8 |
| crowd_10 | s2 at 0.25 s | 197 | 3.93 | 3.90 | 775 | 12 | 0 | 0 | 0 | 1 | 52 |
| crowd_10 | s2 at 0.6 s | 197 | 3.93 | 3.88 | 769 | 11 | 0 | 0 | 0 | 2 | 52 |
| one_ar_5 | s1 at 0.25 s | 197 | 1.26 | 1.49 | 240 | 82 | 0 | 0 | 0 | 3 | 69 |
| one_ar_5 | s1 at 0.6 s | 197 | 1.26 | 1.38 | 225 | 68 | 0 | 10 | 0 | 4 | 59 |
| one_ar_5 | s2 at 0.25 s | 197 | 6.15 | 6.24 | 1199 | 80 | 0 | 0 | 0 | 3 | 137 |
| one_ar_5 | s2 at 0.6 s | 197 | 6.15 | 6.08 | 1173 | 66 | 0 | 11 | 0 | 4 | 125 |
| crowd_5 | s1 at 0.25 s | 197 | 1.05 | 1.30 | 205 | 58 | 0 | 0 | 0 | 1 | 56 |
| crowd_5 | s1 at 0.6 s | 197 | 1.05 | 1.26 | 201 | 54 | 0 | 0 | 0 | 1 | 55 |
| crowd_5 | s2 at 0.25 s | 197 | 6.56 | 6.64 | 1292 | 50 | 0 | 0 | 0 | 1 | 171 |
| crowd_5 | s2 at 0.6 s | 197 | 6.56 | 6.59 | 1284 | 47 | 0 | 0 | 0 | 2 | 167 |
| rec_one_5 | s1 at 0.25 s | 197 | 3.01 | 3.50 | 561 | 159 | 0 | 0 | 0 | 4 | 88 |
| rec_one_5 | s1 at 0.6 s | 197 | 3.01 | 3.24 | 538 | 126 | 1 | 1 | 2 | 4 | 79 |
| rec_one_5 | s2 at 0.25 s | 197 | 10.29 | 10.46 | 1978 | 145 | 0 | 0 | 0 | 4 | 169 |
| rec_one_5 | s2 at 0.6 s | 197 | 10.29 | 10.11 | 1930 | 117 | 1 | 1 | 2 | 4 | 161 |
<!-- end -->

<!-- table:heldoutParity -->
| condition | takes | same |
|---|---|---|
| none_0 | 49 | 49 |
| one_ar_10 | 49 | 49 |
| crowd_10 | 49 | 49 |
| one_ar_5 | 49 | 49 |
| crowd_5 | 49 | 49 |
| rec_one_5 | 49 | 49 |
<!-- end -->

In 7 of the 49 takes with another reciter behind, the background was for a while the reader
himself on another passage (11.8 minutes in all). Leaving those takes out changes the rate a
little, not the picture.

## Cost

<!-- table:cost -->
| population | setting | minutes | wakes a minute | model runs a minute | first passes | padded looks | failed open | timeouts | dropped | queue max | most runs in one take |
|---|---|---|---|---|---|---|---|---|---|---|---|
| pool | s1 at 0.25 s | 1483 | 0.25 | 0.25 | 370 | 39 | 0 | 0 | 0 | 3 | 10 |
| pool | s1 at 0.6 s | 1483 | 0.25 | 0.24 | 357 | 28 | 0 | 6 | 0 | 3 | 10 |
| pool | s2 at 0.25 s | 1483 | 2.80 | 2.78 | 4152 | 34 | 0 | 0 | 0 | 3 | 60 |
| pool | s2 at 0.6 s | 1483 | 2.80 | 2.76 | 4125 | 24 | 0 | 6 | 0 | 3 | 59 |
| W5 | s1 at 0.25 s | 801 | 0.24 | 0.26 | 189 | 36 | 0 | 1 | 0 | 1 | 12 |
| W5 | s1 at 0.6 s | 801 | 0.24 | 0.24 | 184 | 23 | 0 | 0 | 0 | 1 | 7 |
| W5 | s2 at 0.25 s | 801 | 1.07 | 1.07 | 855 | 32 | 0 | 1 | 0 | 1 | 13 |
| W5 | s2 at 0.6 s | 801 | 1.07 | 1.04 | 845 | 19 | 0 | 0 | 0 | 1 | 11 |
| Sobolev and Al-Ikhlas | s1 at 0.25 s | 88 | 1.51 | 0.93 | 114 | 7 | 0 | 0 | 0 | 2 | 4 |
| Sobolev and Al-Ikhlas | s1 at 0.6 s | 88 | 1.51 | 0.84 | 99 | 6 | 0 | 0 | 0 | 2 | 4 |
| Sobolev and Al-Ikhlas | s2 at 0.25 s | 88 | 3.19 | 2.53 | 258 | 6 | 0 | 0 | 0 | 2 | 9 |
| Sobolev and Al-Ikhlas | s2 at 0.6 s | 88 | 3.19 | 2.41 | 240 | 5 | 0 | 0 | 0 | 3 | 9 |
| QuranMB | s1 at 0.25 s | 817 | 0.62 | 0.73 | 504 | 149 | 0 | 0 | 0 | 2 | 6 |
| QuranMB | s1 at 0.6 s | 817 | 0.62 | 0.73 | 501 | 149 | 0 | 1 | 0 | 2 | 6 |
| QuranMB | s2 at 0.25 s | 817 | 3.38 | 3.29 | 2757 | 130 | 0 | 0 | 0 | 2 | 8 |
| QuranMB | s2 at 0.6 s | 817 | 3.38 | 3.26 | 2732 | 130 | 0 | 2 | 0 | 2 | 8 |
| none_0 | s1 at 0.25 s | 203 | 0.43 | 0.41 | 87 | 7 | 0 | 0 | 0 | 1 | 10 |
| none_0 | s1 at 0.6 s | 203 | 0.43 | 0.40 | 86 | 6 | 0 | 0 | 0 | 1 | 10 |
| none_0 | s2 at 0.25 s | 203 | 3.38 | 3.31 | 686 | 7 | 0 | 0 | 0 | 1 | 60 |
| none_0 | s2 at 0.6 s | 203 | 3.38 | 3.28 | 679 | 6 | 0 | 0 | 0 | 2 | 59 |
| one_ar_10 | s1 at 0.25 s | 203 | 0.66 | 0.67 | 134 | 17 | 0 | 0 | 0 | 1 | 18 |
| one_ar_10 | s1 at 0.6 s | 203 | 0.66 | 0.64 | 131 | 14 | 1 | 1 | 0 | 3 | 18 |
| one_ar_10 | s2 at 0.25 s | 203 | 4.24 | 4.12 | 860 | 14 | 0 | 0 | 0 | 2 | 78 |
| one_ar_10 | s2 at 0.6 s | 203 | 4.24 | 4.08 | 852 | 11 | 0 | 1 | 0 | 2 | 77 |
| crowd_10 | s1 at 0.25 s | 203 | 0.80 | 0.79 | 163 | 23 | 0 | 0 | 0 | 1 | 16 |
| crowd_10 | s1 at 0.6 s | 203 | 0.80 | 0.77 | 161 | 21 | 0 | 0 | 0 | 1 | 15 |
| crowd_10 | s2 at 0.25 s | 203 | 4.60 | 4.49 | 933 | 20 | 0 | 0 | 0 | 1 | 67 |
| crowd_10 | s2 at 0.6 s | 203 | 4.60 | 4.45 | 926 | 18 | 0 | 0 | 0 | 2 | 66 |
| one_ar_5 | s1 at 0.25 s | 203 | 1.02 | 1.20 | 207 | 45 | 0 | 0 | 0 | 1 | 24 |
| one_ar_5 | s1 at 0.6 s | 203 | 1.02 | 1.16 | 204 | 41 | 0 | 0 | 0 | 1 | 23 |
| one_ar_5 | s2 at 0.25 s | 203 | 5.79 | 5.80 | 1172 | 38 | 0 | 0 | 0 | 1 | 90 |
| one_ar_5 | s2 at 0.6 s | 203 | 5.79 | 5.75 | 1164 | 36 | 0 | 0 | 0 | 2 | 89 |
| crowd_5 | s1 at 0.25 s | 203 | 1.30 | 1.51 | 260 | 61 | 0 | 0 | 0 | 2 | 27 |
| crowd_5 | s1 at 0.6 s | 203 | 1.30 | 1.45 | 256 | 53 | 0 | 0 | 0 | 3 | 26 |
| crowd_5 | s2 at 0.25 s | 203 | 7.00 | 7.00 | 1413 | 55 | 0 | 0 | 0 | 2 | 102 |
| crowd_5 | s2 at 0.6 s | 203 | 7.00 | 6.90 | 1395 | 48 | 0 | 1 | 0 | 3 | 100 |
| tv_ar_5 | s1 at 0.25 s | 203 | 1.46 | 1.77 | 291 | 90 | 0 | 0 | 0 | 2 | 25 |
| tv_ar_5 | s1 at 0.6 s | 203 | 1.46 | 1.66 | 276 | 81 | 0 | 0 | 0 | 2 | 24 |
| tv_ar_5 | s2 at 0.25 s | 203 | 6.31 | 6.43 | 1270 | 83 | 0 | 0 | 0 | 2 | 87 |
| tv_ar_5 | s2 at 0.6 s | 203 | 6.31 | 6.27 | 1242 | 74 | 0 | 0 | 0 | 3 | 87 |
| rec_one_5 | s1 at 0.25 s | 203 | 2.54 | 3.01 | 505 | 138 | 0 | 0 | 1 | 4 | 74 |
| rec_one_5 | s1 at 0.6 s | 203 | 2.54 | 2.86 | 488 | 117 | 0 | 7 | 4 | 4 | 68 |
| rec_one_5 | s2 at 0.25 s | 203 | 8.89 | 9.16 | 1787 | 136 | 0 | 0 | 1 | 4 | 171 |
| rec_one_5 | s2 at 0.6 s | 203 | 8.89 | 8.94 | 1754 | 115 | 0 | 6 | 7 | 4 | 163 |
| rec_same_5 | s1 at 0.25 s | 203 | 4.16 | 4.38 | 768 | 260 | 1 | 3 | 7 | 6 | 223 |
| rec_same_5 | s1 at 0.6 s | 203 | 4.16 | 4.01 | 704 | 214 | 3 | 53 | 12 | 7 | 203 |
| rec_same_5 | s2 at 0.25 s | 203 | 11.47 | 11.14 | 2227 | 244 | 1 | 6 | 8 | 6 | 354 |
| rec_same_5 | s2 at 0.6 s | 203 | 11.47 | 10.72 | 2128 | 200 | 3 | 62 | 24 | 6 | 330 |
<!-- end -->

- At Step 1 the second model runs about 0.25 times a minute on the pool and on W5, 0.4 in
  quiet with the tuning voices, 0.7 to 0.8 at 10 dB and 1.2 to 1.8 at 5 dB with speech behind,
  3.0 and 4.4 with another reciter behind at 5 dB, 0.7 on QuranMB and 0.9 on the
  phone-recorded learner clips. Step 2 runs it 1.1 to 11 times a minute.
- The verifier counted 0.62 wakes a minute at Step 1 on the pool, driven by bursts. The app
  wakes the judge only after the lock-chunk and realignment filters, and the bursts are gone:
  0.25.
- At an assumed 0.6 s a run the queue starts to give way with another reciter at 5 dB: 53
  timeouts and 12 dropped slices at Step 1 with the same passage behind. A timeout shows the
  mark unchecked, so the cost is lost benefit, not a hidden mark.

CPU time of one check, as the closest stand-in this Mac has for a phone (`node --jitless`, the
JavaScript interpreted; the model is native either way). It is a stand-in, not a phone.

| step | runs as | jitless: median / p90 / max ms | with the JIT | checks |
|---|---|---|---|---|
| first pass: the model on an 8 s slice | native ONNX, one thread | 42 / 48 / 62 | 43 / 50 / 70 | 80 |
| first pass: scoring the word and its alternatives (median 0, p90 8, max 47 alternatives) | JavaScript | 1.3 / 2.5 / 7.4 | 0.3 / 1.1 / 3.1 | 80 |
| padded look: features of the cut (median 3.1 s with its silence) | JavaScript | 57 / 70 / 139 | 8.8 / 11 / 16 | 64 |
| padded look: the model | native ONNX, one thread | 17 / 21 / 46 | 16 / 20 / 39 | 64 |
| padded look: scoring spellings with one inner letter changed | JavaScript | 3.5 / 7.0 / 15.8 | 0.3 / 0.7 / 2.7 | 64 |

The checks are 80 real wakes of the real pass (pool, two voice conditions, QuranMB), seeded
and spread over the list (`final/cpu_check.mjs`, results in `.out/second-look/final/cpu_*.json`).
So one check costs about 44 ms of CPU on this Mac, and about 77 ms more when the padded look
runs, which on the pool is one check in nine. At the default's 0.25 to 4.4 runs a minute that
is under half a second of CPU a minute here. A phone is slower by a factor nobody has
measured. The sample holds no word with the longest alternative lists (up to 212); an
earlier job measured 32 ms of jitless scoring at 200. Reading the engine's frames for a slice
is a copy and is not timed here.

## Parity

<!-- table:parity -->
| suite | clips | same red marks | marks only in the real pass | only in playback | same added marks | red marks, real | wakes, real | model runs, real | failed open, real | timeouts, real | dropped, real | real time per second of audio on this Mac | wrapper messages after the audio ended |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pool | 357 | 357 | 0 | 0 | 357 | 4 | 374 | 306 | 0 | 0 | 0 | 0.030 | 0 |
| w1 | 5889 | 5889 | 0 | 0 | 5889 | 770 | 1561 | 1514 | 0 | 0 | 0 | 0.099 | 1 |
| w1_control | 3512 | 3512 | 0 | 0 | 3512 | 0 | 0 | 0 | 0 | 0 | 0 | 0.208 | 0 |
| w5 | 2761 | 2761 | 0 | 0 | 2761 | 6 | 189 | 153 | 0 | 1 | 0 | 1.649 | 0 |
| learners | 1238 | 1238 | 0 | 0 | 1238 | 0 | 133 | 55 | 0 | 0 | 0 | 0.040 | 0 |
| quranmb | 1607 | 1607 | 0 | 0 | 1607 | 42 | 506 | 552 | 0 | 0 | 0 | 0.029 | 0 |
| live_last | 429 | 429 | 0 | 0 | 429 | 245 | 949 | 743 | 0 | 0 | 0 | 0.037 | 0 |
| live_control | 128 | 128 | 0 | 0 | 128 | 0 | 5 | 5 | 0 | 0 | 0 | 0.035 | 0 |
| interior | 290 | 290 | 0 | 0 | 290 | 181 | 1106 | 846 | 0 | 0 | 0 | 0.041 | 0 |
| sites | 961 | 955 | 6 | 0 | 961 | 1125 | 11925 | 5437 | 2 | 220 | 149 | 0.167 | 26 |
| sites_control | 958 | 958 | 0 | 0 | 958 | 1 | 141 | 117 | 0 | 0 | 0 | 0.043 | 0 |
| added_kept | 374 | 374 | 0 | 0 | 374 | 126 | 4972 | 3602 | 4 | 102 | 67 | 0.058 | 0 |
| added_app | 198 | 198 | 0 | 0 | 198 | 14 | 288 | 198 | 0 | 0 | 0 | 0.039 | 0 |
| sobolev_multi | 103 | 103 | 0 | 0 | 103 | 0 | 123 | 48 | 0 | 0 | 0 | 0.035 | 0 |
| voices_none_0 | 51 | 51 | 0 | 0 | 51 | 0 | 87 | 72 | 0 | 0 | 0 | 0.030 | 0 |
| voices_one_en_10 | 51 | 51 | 0 | 0 | 51 | 4 | 128 | 112 | 0 | 0 | 0 | 0.031 | 0 |
| voices_one_ar_10 | 51 | 51 | 0 | 0 | 51 | 2 | 135 | 121 | 0 | 0 | 0 | 0.031 | 0 |
| voices_crowd_10 | 51 | 51 | 0 | 0 | 51 | 3 | 163 | 144 | 0 | 0 | 0 | 0.031 | 0 |
| voices_tv_ar_10 | 51 | 51 | 0 | 0 | 51 | 10 | 162 | 161 | 0 | 0 | 0 | 0.031 | 0 |
| voices_rec_one_10 | 51 | 51 | 0 | 0 | 51 | 3 | 171 | 155 | 0 | 0 | 0 | 0.031 | 0 |
| voices_one_en_5 | 51 | 51 | 0 | 0 | 51 | 11 | 179 | 169 | 0 | 0 | 0 | 0.031 | 0 |
| voices_one_ar_5 | 51 | 51 | 0 | 0 | 51 | 21 | 208 | 218 | 0 | 0 | 0 | 0.031 | 0 |
| voices_crowd_5 | 51 | 51 | 0 | 0 | 51 | 19 | 264 | 284 | 0 | 0 | 0 | 0.030 | 0 |
| voices_tv_ar_5 | 51 | 50 | 0 | 1 | 51 | 18 | 296 | 320 | 0 | 0 | 0 | 0.029 | 0 |
| voices_rec_one_5 | 51 | 51 | 0 | 0 | 51 | 49 | 517 | 558 | 0 | 0 | 1 | 0.029 | 0 |
| voices_rec_same_5 | 51 | 51 | 0 | 0 | 51 | 77 | 845 | 813 | 1 | 3 | 7 | 0.029 | 0 |
<!-- end -->

- The real stack and its playback agree on every red mark but 6 on the junction sites and 1
  under TV at 5 dB, and on every added mark. At Step 2 the real stack was also run on the
  live last-word suite, the live interior suite and one Arabic voice at 5 dB: 768 of 769
  clips gave the same red marks as playback, all gave the same added marks. The 6 on the sites follow from verdicts the
  wrapper still reported after the clip's audio ended, while the rig keeps the mic open with
  nothing in it; playback has no such chunks. A phone always has audio.
- The app's engine kept today's engine's verdicts on every clip of the pool, W5, W1's
  controls, the learners and the voices: 0 lost. On W1 it differs on 25 of 48,898 verdicts
  (15 clips), on QuranMB on 1. Where the audio leaves the text on purpose
  (junction sites, live last-word context runs, added-word events) the junction check and the
  cut at long jumps change verdicts, as they should.
- The "real time" column is wall time and includes the hours this Mac slept during W5, W1's
  controls and the sites (macOS sleep and dark wake, from `pmset -g log`). Awake suites run at
  0.03 to 0.06 of real time on this Mac. Not a phone figure.

## What is held out, and what is not

- **Held out, read once:** voices behind the pool's test half (the six conditions above).
- **Read before by other rule versions, never by the cancel step's tuning:** the pool's test
  and mixed cells, W1's test and mixed cells, W5's test reciters, the live suites' test
  reciters, the junction sites' test and mixed cells, the added-word test events.
- **Tuned on:** the pool's and W1's dev cells, W5's dev reciters, the live suites' dev
  reciters, the voices' tuning half, the junction check's dev sites, the added-word dev
  events, and QuranMB, on which the cancel step's thresholds were chosen. Those two thresholds
  still need the owner's decision on QuranMB's licence before any release
  (`RULE.md`, open decision 5).
- All jobs read the natural benchmark's all-data baseline before tuning.

## What is untested

- **Phones.** Nothing here ran on a phone: no iPhone time, memory, heat or Hermes. Every time
  per model run is assumed. `PHONE_TEST.md` is the checklist for the first session.
- **Women and children.** Every reciter here is an adult man.
- **Real slips in real rooms.** Every catch comes from a correct reciter read against another
  ayah's text, and every voice behind the reader came through a simulated room. QuranMB's
  slips are planted and read in quiet; Sobolev's are real but too few, and none is marked.
- Slips that make no Quran word, or lie outside an alternative set; added phrases; an added
  word before a lock's first word; a reader who stops for good after the word before a
  left-out last word; between-ayah added words beyond 48 runs.

## Problems found

No bug in the app's mark rules or second look showed itself: real stack and playback agree,
and every count that should reproduce does. What did show:

1. **The default costs a few true catches** (interior changed words with the flush 52.3% to
   49.6%, skipped words 29.0% to 20.1%). A cost of the judge's veto and the cancel step, not a
   bug, and it is in the numbers above.
2. **The queue gives way at 0.6 s a run under the worst voices** (above). A phone that slow
   would show more marks unchecked there.
3. **The harness, not the app:** the made-up next ayah's second word draws the only W1 false
   marks with the flush; the site rig's empty chunks after the audio let the wrapper report a
   few more verdicts. Both are counted and named where they occur.
4. **Two slips in this read's own scripts, caught before any number was taken:** a reader of
   stream files picked up two one-clip timing tries, and the restart table first counted every
   ayah as a restart. Both were fixed and the tables made again.

## How to reproduce

See `final/README.md`. The runs and records are under `.out/second-look/final/` (git-ignored).
The held-out half's runs are `.out/chatter/runs/final_test_today` and `final_test_app`; their
mixed audio was deleted after each condition.
