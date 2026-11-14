# Live check bench

The measurements behind the live check (`services/recitation/liveCheck`): the
second model reads the ayah being recited about twice a second and says, for each
word with enough audio after it, whether the written word was said. Nothing here
touches the app. Every command below runs from `scripts/recitation-bench`, and
everything downloaded or produced stays under `.out/fix2/` (git-ignored): audio,
manifests, follower runs, results.

Needs `node`, `python3`, `ffmpeg` and `curl`, the repo's `node_modules` (the
engine's `KaldiFbank` and `typescript`), and the second model at
`.out/natural/qas/` (see `judge/README.md`). `experiments/e1b_an.py` needs numpy.
Places are written `surah:ayah:word`, words 0-based, and no script prints Quran
text.

## The runtime

Every checker run goes through `judge/model.mjs` (by way of `model.mjs`, which
turns the runtime's memory arena off unless `ORT_ARENA` is set, as the app runs
it). On x86-64 the bench's own `onnxruntime-node` 1.24.3 spoils every 32nd output
row of the int8 model on some runs (rows 31, 63, 95 and so on: one letter at 0,
the rest near -4e5), and `judge/model.mjs` then stops with an error. 1.31.1 and
Python's onnxruntime 1.29.0 are clean with the same file. To run another install:

```sh
mkdir -p .out/fix2/ortnew && (cd .out/fix2/ortnew && npm init -y && npm install onnxruntime-node@1.31.1)
export ORT_NODE_DIR=$PWD/.out/fix2/ortnew     # an absolute path: scripts run from other folders
```

Nobody has checked 1.24.3 on arm64 (a Mac, or the phone's
onnxruntime-react-native). If it is broken there too, `judge/model.mjs` says so
on the first run. The follower's model has not been checked for the same fault.

Run one ONNX thread per process (`ORT_THREADS=1`, which the shell scripts set),
and on a shared machine `nice -n 10`.

## The check under test

`build_live.mjs` compiles `reading.ts`, `laying.ts` and `check.ts` from
`services/recitation/liveCheck` into `.out/fix2/live.build/<hash>/`, named by the
three files' sha256, which every result records. `--check <dir>` on `sim.mjs`
and `clip_sim.mjs` reads the three files from another folder. `run_sims.sh` and
`run_planted.sh` copy them into the run set's folder on its first call, so a run
set keeps the check it started with while the files change.

```sh
node fix2/build_live.mjs                                   # prints {file, sha}
node fix2/build_live.mjs --snapshot <dir> [<source dir>]   # copies the three .ts files
```

## One recitation

`sim.mjs` plays a staged Quran.com recitation through the live check as the app
would: the engine's own log-mel frames in 480 ms chunks, the follower's recorded
cursor and lock events, up to three model runs per chunk.

```sh
node fix2/sim.mjs 10_89 --keep 1 [--plant <seed>] [--trace 1] [--debug <file>] [--cfg '<json>']
python3 -I fix2/cover.py .out/fix2/sim/10_89.json [--detail]
```

`--plant` changes the text the check reads, not the audio: in about one ayah in
three, a word is replaced by another Quran word (`changed`), a word the reader
does not say is put in (`missed`), or a word the reader says is taken out
(`added`). `--kinds` limits it to some of these. `--cfg` overrides the check's
defaults (`LIVE_DEFAULTS` in `check.ts`) for one run. `--trace` writes a line per
model run, `--debug` the check's own trace lines. `--blind <json>` gives the check the
places listed in the file's `words` (the app's
`services/recitation/liveCheck/blindSpots.json`), which it never marks, as the app
does; without it no place is blind, and the result's `blind` field is left out.

### The cache of model outputs

`sim.mjs` keeps the model's output for each window in
`.out/fix2/cache/<key>.bin` and `<key>.idx.json`. The key is `--cachekey`, or the
name. A second run of the same audio reads every window from it, so a change to the
check's rules replays in seconds; its summary line counts the windows read as
`"cached"`. The result is the same file but for `msPerRun`. Other audio under the same
name (planted, mixed with speech) needs its own key: the scripts below use
`<name>.s<seed>` and `heldout.<id>[.n10]`. The index records which audio and which model
filled it, and a run with other audio or another model under that key stops with an
error. An index written before it recorded these is taken as it is, and gets them when a
run adds to it; a run that only reads never rewrites the index. `--nocache 1` neither
reads nor writes the cache.

One process at a time per key. Runs one after another share a key safely; two
processes writing the same key at once can lose or mix entries, so never run two
batches over the same files at the same time. `CACHE_PREFIX=<p>` on `run_sims.sh`,
`run_planted.sh`, `planted.sh`, `replay.sh`, `trace_planted.sh` and
`heldout/run_sims.sh` puts the keys under `<p>` (for example `CACHE_PREFIX=proof.`), so
a trial run never touches the usual keys.

```sh
node fix2/sim.mjs 10_89 --keep 1 --cachekey proof.10_89 --out .out/fix2/proof/10_89.json
```

Each probe line (a score test the check made) also carries `t`, the audio time of the
tick it came from.

### What the model reads in one window

`peek.mjs` runs the model on one window, given in log-mel frames as the trace lines and
plans give them, and prints the words it heard and the written words of the ayat named,
as letter numbers, with the energy of each model frame.

```sh
node fix2/peek.mjs 10_89 0 500 89:1 89:2 [--audio <f32>] [--check <dir>]
```

## The clean pool

Quran.com surah recordings with word timings, the follower's run on each, then
the live check. On a clean recitation every final mark is false.

```sh
fix2/stage_qdc.sh "7 2 3 6 9 10 97 4 5 161" "67 78 36 55 89 56 50"
fix2/stage_qdc.sh "7 10 161 5" "18"
fix2/run_follower.sh 2                        # .out/fix2/runs/<name>.json
node fix2/offset_check.mjs                    # .out/fix2/qdc_offsets.json
fix2/run_sims.sh <tag> 2                      # .out/fix2/sim/<tag>/<name>.json
python3 -I fix2/pool_report.py <tag>
python3 -I fix2/cover_by_place.py <tag>
```

`NAMES=<regex>` limits `run_follower.sh` and `run_sims.sh` to some files. The
report gives coverage (words of the text judged, and the first and last word of
each ayah), false marks per 1,000 judged words, and the 25 strongest score tests
that did not end in a mark. `cover_by_place.py` gives coverage per reciter by the
word's place in the ayah (first, middle, second to last, last) and the false marks.

`offset_check.mjs` compares the checker's own word times with Quran.com's. On
most files the median end differs by under 0.1 s. Some are far out (checker minus
Quran.com, median word end): reciter 7 surah 78 +2.68 s, reciter 5 surahs 55, 36
and 56 +1.18, +1.03 and +0.88 s, reciter 2 surahs 36, 55, 56 and 78 -0.31 to
-0.49 s. Anything that cuts audio or decides "this word is finished" from
Quran.com times is wrong on those files, so the planted runs and the experiments
skip them. Quran.com segments also keep natural repeats (for example 67:28:9-11
said twice).

## Planted mistakes

`mutate2.py` splices real mistakes into the audio at Quran.com word times
(skipped words, a word from elsewhere in the recording, skipped ayat) and
harmless events (repeats, restarts, pauses, stretched words). The follower runs on
the spliced audio, then the live check. The spliced audio is deleted afterwards.

```sh
fix2/run_planted.sh <tag> 2 <seed>            # or one file: fix2/planted.sh <name> <seed> <tag>
node fix2/score_planted.mjs <tag> [--verbose 1] [--nowrite 1]
python3 -I fix2/uncaught.py <tag> [wrong_word|skip_word|skip_first_word|skip_last_word]
```

A live mark counts for a mistake when it is on the word or a neighbour; the
follower's own marks (today's rules, `replay2.mjs`) are scored beside it on the
same recitations. `ONLY=<regex>` limits `run_planted.sh` to some files. Finished files
are skipped. When the follower run and truth of a file exist, `planted.sh` splices the
audio again (`mutate2.py` is deterministic by seed), checks the truth is unchanged and
runs only the check. `score_planted.mjs` writes `_score.json` next to the results unless
`--nowrite 1`. `uncaught.py` lists each mistake with no mark on its word or a neighbour,
with the check's last score tests there and their outcome (or "no look"), then counts
them by type, place and reason.

To see one planted file in detail, `trace_planted.sh` runs it again with the check's
trace on (`--debug`) and `probeSeconds` 0.5, from the cache. It needs the follower run
`planted.sh` kept, and writes `<name>.s<seed>.json` and `.debug.txt` to `TRACE_DIR`
(default `.out/fix2/planted/dbg`). `LIVE_SRC=<dir>` runs another copy of the check.
If the spliced audio's truth differs from the kept one it stops (`TRUTH DIFFERS`).

```sh
fix2/trace_planted.sh 10_89 1 [extra sim.mjs args...]
```

## Trying a rule change

`replay.sh` runs every file a clean batch and a planted batch have finished through
the check's source in `LIVE_SRC` (default the repo's), into a new tag, from the cache:
no model runs when the batches filled it. A planted file's audio is spliced again, its
truth must match the kept one (else `TRUTH DIFFERS`), and the audio is deleted after.
`-` skips a side. Pass the same `--cfg` the batches ran with. Then compare the tags.
The lab's name `SRC` is still read when `LIVE_SRC` is not set. Tags are folder names:
letters, digits, `.`, `_` and `-`, not starting with `.`; the scripts refuse others.

```sh
LIVE_SRC=<dir> fix2/replay.sh <new tag> <clean tag|-> <planted tag|-> 2 --cfg '{"probeSeconds":0.5}'
python3 -I fix2/summary.py <tag> [<tag> ...]
python3 -I fix2/experiments/rule_an.py <clean tag> <planted tag> [--list RULE] [--events RULE]
```

`summary.py` prints one line per tag: clean files, false marks and coverage; planted
mistakes caught (on the word or a neighbour) out of those planted, by type; planted
false marks; and the median and 90th percentile time from the word to its mark. It
scores the planted side with `score_planted.mjs --nowrite 1`. `rule_an.py` is a what-if
on the probe lines of two batches (run with `probeSeconds` 0.5 or lower): for a list of
anchoring and ripeness rules, how many false marks and catches each would give. It
copies the check's gap need by hand, and the real check's later steps depend on its own
verdicts, so it is an estimate.

## Blind spots, noise on dev files, and both lanes together

```sh
python3 -I fix2/blind_spots.py <clean tag> [<tag> ...] [--write ../../services/recitation/liveCheck/blindSpots.json]
NAMES='^(2|5|7|10|161)_(67|78|89)$' fix2/run_dev_noise.sh <tag> 2 [extra sim.mjs args...]
node fix2/union_planted.mjs <planted tag>
```

`blind_spots.py` reads clean batches (run without `--blind`) and lists every place
called bad for two or more different reciters: the text sets those off, not the voice.
`--write` adds them to the app's list, which the check never marks. Places called bad
for one reciter are printed for review only. `run_dev_noise.sh` mixes background speech
into staged dev files at 10 dB (as the held-out scripts do), runs the follower on the
mix and then the check; the results read like a clean batch, so `summary.py` and
`cover_by_place.py` work on the tag. Tune on these, never on the held-out pool.
`union_planted.mjs` counts the planted mistakes caught by the live check, by the
follower's own marks, and by either: the app runs both.

## The held-out pool

Follower runs and check runs on the held-out pool, quiet or with background speech:
the speech set mixed in at 10 dB by `heldout/mix_speech.py` (clips in an order seeded
by the clip's id) and the bench's `noise.sh` (which also applies a 200-5000 Hz phone
band). The mixed audio is made again for each step and deleted after. Report only:
never tune on these results.

```sh
fix2/heldout/run_follower.sh 2 [quiet|noise]          # .out/fix2/runs_heldout/<id>[.n10].json
fix2/heldout/run_sims.sh <tag> 2 <quiet|noise>        # .out/fix2/sim_heldout/<tag>/<id>[.n10].json
python3 -I fix2/heldout/report.py <tag> [quiet|noise]
```

`DRY=1` makes either script only list the clips and what each has done. `REV=1` makes
`run_follower.sh` start from the last clip, so a second process can work from the other
end. `run_sims.sh` copies the check into `<tag>/live` on its first call, from
`LIVE_SRC` (or the lab's `SRC`). `report.py` gives per voice the clips, hours, words of the clips' ayat,
words judged, coverage and false marks (every clip is a correct recitation).

## Single-ayah clips

`clips/clip_sim.mjs` runs the live check with no follower on one ayah at a time:
the check is told the reader is at the ayah's first word, and the clip gets 2 s of
its own quietest audio after it.

```sh
node fix2/clips/clip_sim.mjs --set twin --voices Alafasy_64kbps,Hani_Rifai_192kbps --subs 60
node fix2/clips/clip_sim.mjs --set ikhlas
node fix2/clips/score_clips.mjs [--sha <prefix>] --subs 60
```

- twin: whole-ayah recordings of ayat that differ from a twin by one word. Each
  recording is read against its own text (a control) and against its twin's text
  (an event the reader did not make, but the text says they did). Events are
  look-alike changes: a substituted word, a spelling-only difference that must
  never be marked, or a word missing on one side.
- ikhlas: the dev half of the Al-Ikhlas set only. The test half is never run.

Runs go to `.out/fix2/clips/<set>.<hash>.jsonl` and resume where they stopped;
`score_clips.mjs` writes `REPORT.md` and `report.json` next to them.

On 14 Nov, with the check as committed (bench hash `677013d2`, defaults), 6 twin
voices and the 790 Al-Ikhlas dev clips:

| | runs | result |
|---|---|---|
| twin sub events, all | 690 | changed word marked 47.1% (first 22.5%, interior 75.0%, last 40.7%) |
| by voice group | 230 each | dev 54.3%, checker-held-out 53.0%, held-out 33.9% |
| spelling-only events | 84 | 0 marks |
| indel events, a word in the text the reader did not say | 108 | 8 marked |
| indel events, a word said that the text lacks | 102 | 0 marks on the 114 neighbouring words |
| twin controls | 714 | 0 false marks in 3,725 judged words; first word judged 97.5%, last 77.2% |
| Al-Ikhlas correct clips | 344 | 0 false marks in 1,108 judged words (95% upper bound 2.7 per 1,000) |

A caught substitution was marked a median 2.24 s after the word ended (90th
percentile 2.72 s). An earlier lab copy with a 6-nat bar and looser rules (sha256
1179d279) caught 67.2% of the sub events (95.8% inside the ayah) and left 3 false
marks in 3,837 control words and 1 in 1,125 Al-Ikhlas words: the higher bar and the
rules added since trade those catches for the false marks.

Cut just before the next ayah's first letter, the window read the first four
words of that ayah right in every case, whatever the quiet.

Cost on a 2.1 GHz Xeon, one thread, int8 model, arena off, onnxruntime 1.31.1:
50-70 ms per run for 4-5 s windows, 105 ms for 8 s.

## Results on 14 Nov

The check as committed, defaults, `--blind` with the app's list. Dev files are the
ones the rules were tuned on; validation files decided which options stayed; the
held-out pool was run once after the check was frozen.

| set | files | false marks | per 1,000 judged | judged |
|---|---|---|---|---|
| dev, clean (`NAMES='_(67|78|89|55|56)$'`) | 50 | 0 of 11,239 | 0.00 | 81.8% |
| validation, clean (surahs 18, 36, 50) | 24 | 0 of 15,524 | 0.00 | 89.5% |
| dev with speech at 10 dB (`run_dev_noise.sh`) | 15 | 1 of 2,356 | 0.42 | 73.3% |
| held-out pool, quiet | 60 | 12 of 25,114 | 0.48 | 89.3% |
| held-out pool, speech at 10 dB | 60 | 50 of 20,343 | 2.46 | 72.3% |

Planted mistakes (28 files, seed 1, surahs 67, 78, 89), a mark on the word or a
neighbour, from `score_planted.mjs` and `union_planted.mjs`:

| mistake | n | live check | follower today | either |
|---|---|---|---|---|
| wrong_word | 33 | 15 | 25 | 27 |
| skip_word | 53 | 40 | 49 | 51 |
| skip_first_word | 15 | 3 | 11 | 12 |
| skip_last_word | 15 | 0 | 7 | 7 |

Live false marks on those files: 0. Follower false marks: 17. Time from the word to
the live mark: median 2.49 s, 90th percentile 3.82 s.

The 15-nat bar was set on 15 noisy dev recitations by 5 voices. On the held-out voices
it did not hold with background speech (2.46 against 0.42), so that set was too small
to set a bar for noise.

How the bar and the options were chosen (same files, replayed from the cache):

| change | dev noise false marks | planted wrong / skip | clean dev and validation |
|---|---|---|---|
| gap bar 6 nats | 17 of 2,332 | 18 / 40 | 0, and 2 on one blind-spot word |
| 10 | 9 of 2,362 | 17 / 40 | 0 |
| 12 | 4 of 2,358 | 17 / 40 | 0 |
| **15** | **1 of 2,356** | **15 / 40** | **0** |
| 20 | 1 of 2,356 | 13 / 39 | 0 |

Judging a word 1 s after the next word instead of 2 s: 8 false marks in 15,526
validation words, against 2 without it (both on the blind-spot word, at the 6-nat bar). Trusting the first word of an ayah found
with no pause: 2 in 11,437 dev words. Both are off. Judging the second word there,
judging the last two words of an ayah left with no pause, and finding an ayah begun
at its second word after a pause: no false mark on dev or validation, and on.

## What has not been measured

- Phones. No check has run on a device, so there are no timings, no memory
  figures and no answer on whether onnxruntime-react-native 1.24.3 on arm64 has
  the row fault.
- Other noise than background speech at 10 dB (fan, hum, a louder room).
- sobolev and qdat_bench: staged and checked, but no live check has run on them.
- The whole mushaf for blind spots: eight surahs were swept.
- The gated sets (TLOG, QUA, QuranMB labels): not downloaded.
- Learners' real slips. Planted changes are other Quran words or spliced studio
  audio; the only ordinary voices measured are the Al-Ikhlas dev half.
