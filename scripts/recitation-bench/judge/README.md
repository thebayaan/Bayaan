# Second judge prototype

A second speech model, quran-asr-small (MIT, 36 MB int8 ONNX), double-checks a word
the engine disputes before it turns red. Nothing here touches the app, the engine or
its patch. Everything downloaded or produced stays under `.out/natural/`.

## Model

Pinned at revision `004f898639f3127a74eac1b898a2cb3ef0b5268d`, under
`.out/natural/qas/` (`source.json` there has the address, the file hash and the
licence). Weights load as ONNX only; the repository's Python is read, never run.

- Input: `x` [N, T, 80] float32 log-mel, `x_lens` [N] int64. Output: `log_probs`
  [N, T', 31], `log_probs_len`. One output frame is 40 ms.
- Features (`fbank.mjs`): 25 ms povey window, 10 ms shift, DC removal, pre-emphasis
  0.97, 512-point FFT without the Nyquist bin, 80 mel bins from 20 to 7600 Hz, log
  floored at the float32 epsilon, no dither, edges reflected. The same recipe as the
  engine's own `KaldiFbank`, so the app can read the engine's frames instead of
  running a second FFT (`feature_reuse.mjs`).
- Alphabet: 29 letters and a word separator, Uthmani spelling, no vowels. Two words
  with the same letters cannot be told apart.
- It learned on one ayah at a time. A slice spanning two ayat loses words, so a slice
  must stay inside the word's ayah. It also knows the text by heart: the bench's
  mistakes are all real Quran words, so nothing here shows it hears a slip that makes
  no Quran word.

## Text

`letters.py` holds the model's letter recipe and the sound key, read from the pinned
official file only. `build_index.py` writes `.out/natural/judge/index.json`:
each word's letters, its mutashabih alternatives (words that follow the same two
words, or come before the same two words, anywhere in the text) and its near words
(within edit distance 2 of the sound key). Two spellings of one sound are never
alternatives. `recited.py` maps QUA's recited text, repeats kept, to official token
numbers. `test_letters.py` has the exact-match tests.

## Scoring

`ctc.mjs` scores a candidate inside its ayah's text: left context, the candidate, and
free frames beyond the text, relative to each frame's best token, so a score is at
most 0. `judge.mjs` compares the expected word with its alternatives. Neither file
uses any Node or browser API.

## Two harnesses, kept apart

NPL-1.2 keeps constants tuned on the engine's output in an NPL file, so:

- `text_harness.mjs` calibrates the judge's margins. No engine output: word times come
  from the second model's own alignment (`align_all.mjs`), the text from `index.json`.
- `e2e_harness.mjs` plays saved engine verdicts and scores the word on the slice the
  app would hold. It measures the rules; it can tune only the engine-side trigger.

`judge_constants.json` and `engine_constants.npl.json` list the frozen rule's
constants by side, with where each came from. One exception: the end-to-end dev sweep
had been seen when the alternative's margin of 3 was fixed, so that number is treated as
NPL, and the app reads it from its NPL file. The verifier's comparison on dev, Step 2:
margin 4 takes W1 from 78.9% to 78.6% and interior from 89.4% to 87.6%, and is identical
on test (`.out/natural/verify/cmp_*_stage2*.json`). `policy.mjs` turns the judge's answer
into verdicts. `wordMarks.judge.ts` is a replay-only copy of the app's rules with two
small hooks. `sweep.mjs` gives point estimates, `compare.mjs` gives one policy against
the baseline with intervals, and `write_runs.mjs` writes rewritten runs for
`natural/score.mjs`.

## Running

```sh
PY=<venv with numpy and kaldi-native-fbank>/bin/python
python3 -I judge/test_letters.py
python3 -I judge/build_index.py
python3 -I judge/recited.py
PY=$PY node --test judge/test_fbank.mjs
node --test judge/test_ctc.mjs judge/test_policy.mjs

# One ONNX thread each. Long recordings take the most memory.
ORT_THREADS=1 node judge/align_all.mjs --shard 0/3     # until it prints `done`
python3 -I judge/cer.py dev

C='[{"D":8,"delta":2.0,"left":2,"right":0,"cut":0.2,"tail":0.2}]'
O=.out/natural/judge/h1_dev
judge/run_text.sh changed dev $O 1 "$C" 3
judge/run_text.sh control dev $O 1 "$C" 3
judge/run_text.sh pool dev $O 1 "$C" 3
node judge/h1_report.mjs $O

ORT_THREADS=1 node judge/e2e_harness.mjs --suite pool --split dev --out <dir>/pool.0.jsonl --shard 0/3
node judge/sweep.mjs --rows <dir> --split dev --policies <policies.json>
node judge/compare.mjs --rows <dir> --policy <policy.json> --split dev
ORT_THREADS=1 node judge/timing.mjs
```

At most three of these harness processes at once, one ONNX thread each: `run_text.sh`,
`run_e2e.sh` and `run_e2e_all.sh` take the count. `feature_reuse.mjs`, `memory.mjs`,
`phone_check.mjs`, `onnx_ops.py`, `trigger_rates.mjs`, `wake_check.mjs`,
`verdict_delay.mjs`, `engine_timing.mjs`, `miss_reasons.mjs`, `false_detail.mjs`,
`pool_marks.mjs`, `skip_detail.mjs`, `learner_marks.mjs` and `debug_rows.mjs` are
one-off measurements, each described at its top.
