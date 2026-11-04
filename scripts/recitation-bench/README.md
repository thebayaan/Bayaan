# Recitation bench

Runs the app's own recognition engine (`@tilawa/core`, patched, from the repo's
`node_modules`) on real recitations, clean and with planted mistakes, and scores
the result with the same rules the app uses to mark words
(`services/recitation/wordMarks.ts`).

```sh
scripts/recitation-bench/bench.sh            # reciters 7 2 3 6 (Quran.com ids)
scripts/recitation-bench/bench.sh 9 97       # any reciters with word timings
```

Needs `node`, `python3` and `ffmpeg`. The first run installs `onnxruntime-node`
here and downloads the model and corpus the app downloads, then each reciter's
Al-Mulk recitation and word timings from Quran.com. Everything downloaded or
produced stays in `.out/` (git-ignored).

## What it does

1. **Plants mistakes** (`mutate.py`) by cutting and splicing the audio at the
   word timings: a skipped ayah, skipped words (inside an ayah, first, last), a
   wrong word, ayat out of order, and three things that are not mistakes (a
   repeated word, a restarted ayah, a skipped word then the ayah redone).
2. **Runs the engine** (`bench.mjs`) in 480 ms chunks, as the mic delivers them,
   following the app's flow: tracking until it locks, then checking the rest of
   the surah, and back to tracking whenever it loses the reader.
3. **Scores** (`score.py`): false marks on the clean recitation, planted
   mistakes caught, and how long after a word ends its verdict lands.

## Limits

These are expert reciters in studio audio with clean cuts. Learners hesitate,
cut words short and mispronounce, so expect more false marks on real learners.
Splicing cannot plant vowel or letter mistakes.
