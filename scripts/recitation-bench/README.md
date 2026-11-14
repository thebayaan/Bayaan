# Recitation bench

Runs the app's own recognition engine (`@tilawa/core`, patched, from the repo's
`node_modules`) on recitations, and scores what the reader would see with the
same rules the app uses to mark words (`services/recitation/wordMarks.ts`).

Needs `node`, `python3` and `ffmpeg`. The first run of `bench.sh` installs
`onnxruntime-node` here and downloads the model and corpus the app downloads.
Recitations and word timings come from Quran.com. Everything downloaded or
produced stays in `.out/` (git-ignored).

On x86-64, the `onnxruntime-node` 1.24.3 installed here returns garbage in some of
the second model's output rows on some runs, so `judge/model.mjs` stops with an
error naming the row whenever a log-probability falls below -1000. Set
`ORT_NODE_DIR` to a directory holding `node_modules/onnxruntime-node` to run
another install instead, for example
`ORT_NODE_DIR=.out/fix2/ortnew node judge/smoke.mjs .out/runs/smoke_67_1.f32` for
1.31.1. Without it the bench uses its own install, as before.

The live word check (`services/recitation/liveCheck`) has its own bench in `fix2/`:
see `fix2/README.md` and `docs/features/recitation-live-check.md`.

## Running the engine

`bench.mjs` feeds 16 kHz mono float32 audio in 480 ms chunks, as the mic
delivers them, and follows the app's flow (`RecitationTrackingService`):
tracking until it locks, then checking a ten-ayah passage that slides forward,
and back to tracking whenever the engine loses the reader. It writes what the
app saw: the engine's events, flags, every word's verdict changes with the
engine's scores (`d`: distance, heardRatio, margin, gop, vowel fields),
tracker health, chunk levels, and each word's last verdict.

```sh
node bench.mjs --audio a.f32 [--timings qdc.json] [--hint 67:3] --json out.json
node bench.mjs --list manifest.json --outdir dir     # every clip of a set
```

- `--hint s:a` (or a clip's `hint`) is the ayah on screen, which the app passes
  at the start of a take.
- `TILAWA_DIST=<dir>` loads another build of the engine (a patched copy), and
  `ENGINE_OPTS='<json>'` adds or overrides session options.
- As in the app, the engine judges a word after two more sounds
  (`commitDwell` 2; `--dwell N` changes it), keeps its tracker across a
  deferred flag (`keepContextOnDefer: true`) and judges a word split by a
  segment cut from all its sounds (`config.wholeWordAtCut: true`). The app
  flow also ignores a match on an ayah already flagged as skipped. `ENGINE_OPTS` can turn either
  off, e.g. `{"keepContextOnDefer":false,"config":{"wholeWordAtCut":false}}`
  for the engine as it was before.
- A manifest clip may carry `expected` (start in the app's correction state on a
  chosen passage), `parts` (recordings fed in order) and `flush` (the harness's
  end-of-input flush, kept apart and tagged): see `natural/README.md`.
- `ORT_THREADS=1` runs single-threaded: about five times less CPU per run, so
  several benches can run at once.
- Verdict changes after `stop()` are tagged `stop`; the app never hears them.
- `gap_rule_check.mjs` checks the patched engine without the model: one
  skipped ayah raises one flag, though the tracker kept across the flag still
  matches that ayah from the next one's audio (`TILAWA_DIST` checks another
  build).

## Test sets

- `build_corpus.sh <name> [jobs]`: nine reciters x five surahs, each clean and
  with two seeds of planted events (`mutate2.py`). Each recitation carries
  about one event every few ayat: real mistakes (a skipped word, first or last
  word, a wrong word, a skipped ayah) and harmless ones a learner makes
  (repeating a word, restarting an ayah, a skip redone, a long pause, a held
  word). Events are made by cutting and splicing the reciter's audio at the
  word timings, written next to each run as `.truth.json`. The spliced audio is
  deleted after each run.
- `build_noise_corpus.sh <babble|pink|hum> <snr dB>`: the same planted
  recitations (two surahs, clean and one seed) with noise mixed in
  (`noise.sh`), in `corpus/noise_<kind><snr>`, or `corpus/$NAME` when `NAME`
  is set.
- `midstart.py`: a clean recitation cut to start mid-surah, at a chosen ayah
  and word, as when a reader opens a page and starts there. Every mark on it is
  false.
- `quran_pass.sh <reciter>`: the whole Quran by one reciter, surah by surah, to
  find words the engine misjudges for everyone.
- `bench.sh [reciters]`: the first, smaller bench: Al-Mulk with one planted
  mistake per case (`mutate.py`), scored by `score.py`.

## Scoring

- `replay2.mjs <dir>...`: replays each run through the app's own mark rules
  (compiled from `wordMarks.ts`; `WORD_MARKS=<file>` tries another version) and
  prints mistakes caught by type, false marks by what they sit on, and false
  skipped-ayah flags.
- `candidates.mjs <dir>...`: one line per shown mark with its context, for
  trying rule changes on the whole set at once.

## Natural benchmark

`natural/` scores the marks on unedited recordings and the official text:
mutashabihat, correct-recitation pools and recitation phenomena. New baselines go
there. See `natural/README.md`.

## Engine patch and mark rules

`stack/` holds the checks behind the engine patch and the mark rules for the
junction check, the second judge's answer and the added-word mark. See
`stack/README.md`.

## Limits

The planted sets are expert reciters in studio audio with clean cuts. Learners
hesitate, cut words short and mispronounce, so expect more false marks on real
learners. Splicing cannot plant vowel or letter mistakes.
