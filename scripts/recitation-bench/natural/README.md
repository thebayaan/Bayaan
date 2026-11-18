# Natural word benchmark

Scores the app's word marks on unedited recordings and the official text. Nothing
here cuts, joins, stretches or mixes recitation audio. Everything downloaded or
produced stays in `.out/natural/` (git-ignored); tracked files hold no reciter
names, only hashes of the manifests that do (`pins.json`).

## Suites

- **W1.** An authentic recording of ayah Y against the official text of its twin
  X, where the two differ by one word. The event is in the text, not the audio.
  - 126 whole-ayah pairs differing by one substituted word: 66 at the last word,
    40 interior, 20 at the first word. Each pair runs both ways.
  - 7 of them differ only in spelling (same sound, by two filters that must
    agree): false-flag traps, where every mark is false.
  - 11 whole-ayah pairs differing by one word, both ways: read short against
    long is a skipped word, long against short an added one. Only 2 of the 11
    are interior; the rest are the first word. 9 more pairs with an ayah under
    four words are tagged `short` and not counted.
  - Dropped last word: 3 pairs, not 9. The 9 first proposed share a three-word ending,
    but in 6 the recording also differs earlier, so running them needs a cut.
    Those 6 are listed in `w1_pairs.json` (`endingOnly`) and never run. Of the 3,
    one is a whole-ayah pair; in two the recording is a whole ayah that matches a
    span of a longer one, and the take locks on that span's first word.
  - One natural junction: a recording that reads X without its last word and goes
    on into six words of X's next ayah. It also differs in X's first words.
- **W1 control.** The same recordings against their own text.
- **Pool.** Consecutive whole ayat of one surah in the app's flow from tracking,
  each passage read by two reciters. Every mark is false. QUA cut these clips from
  one continuous file, so feeding them in order gives back the recording, without
  the small gap QUA left at each join (usually under 100 ms; longer for a few
  reciters, and a gap over 5 s starts a new take). No filler is added.
- **W5, first cut.** Phenomena from tajweed references against their own text:
  muqatta'at, madd lazim, written-form traps, silent alif, saktas, transmitted
  Hafs options, long pauses inside an ayah, the basmala as ayah 1:1, and whole
  ayat started by search mid-surah. Idgham across words, restarts and pauses are
  scored on the pool, which has thousands of them.
  Not in this cut: isti'adha and the basmala outside 1:1 (QUA's rows start after
  them), pauses over 20 s (none inside an ayah among these reciters), and hadr (no
  fast reciter among them; `reciter_speed.json` gives a speed slice).
- **Learners.** Al-Ikhlas (dev half by participant; the test half stays unread)
  and sobolev's Hafs clips, each clip alone with its place known.

## Reciters

`select_reciters.py` keeps Hafs murattal mushafs on the MP3Quran, Way2Quran and
tvQuran channels whose reciter is on neither training list, by name, reviewed by
hand (`.out/natural/lists/aliases.json`), and that QUA published after the engine's
fine-tune staged its QUA data. So they are outside that mix, though the base
model's archive tier cannot be checked. `fingerprint.mjs` compares their recordings
with every Hafs folder on everyayah.com, to catch a recording under another name
(best-lag cosine of log-mel features on three ayat). Half of the reciters, pairs and passages
are marked `dev` and the rest `test` (`--split`); nothing has been tuned on either
yet.

QUA's rows keep what the reciter said, so about 17% of ayat read part of the ayah
twice, the natural stop-and-restart of a teacher's reading. W1 uses recordings
that read the ayah once; the pool keeps them all and scores them apart.

## Word numbers

`text.py` is the only tokenizer. The official Hafs file has 77,430 words and the
engine's corpus 77,433, because it splits one word in 15:7, 27:20 and 36:22.
`engine_word()` and `hafs_token()` map between them, and `test_natural.py` checks
them on every word. QUA's recited text maps to the official text on all 124,619
rows of these reciters once repeats are accounted for (`recited_map`).

## Harness

`bench.mjs` gained three clip options, all off by default: `expected` starts a
take in the app's correction state on a chosen passage, `parts` feeds recordings
in order, and `flush` adds the end-of-input flush below. Its default runs give the
same results as before, with extra tags on flags and events. The junction prototype
(`junction/README.md`) adds `trackAt` and `BENCH_PROBE`, also off by default.

### End-of-input flush

A clip's last word cannot be judged the way the app judges it. The app reads
verdicts unsettled (`session.verdicts()`), where the word under the cursor stays
pending until two sounds of a later word arrive, and it ignores whatever the
engine does after `stop()`. So a clip that ends leaves its last word unjudged.

With `flush`, after the engine's own `stop()` (its 2 s tail and decoder flush) the
harness asks the tracker that followed the clip for settled verdicts and stores
them in the run's `flush` block, never in `vchanges`. Each carries `flush: true`.
`newly` says the live verdicts left that word pending or unreported; only those
reach a replay. Replay reports three levels, so flushed marks can always be told
from what the app hears:

| Mode | Adds | Reachable in the app today? |
|---|---|---|
| `app` | nothing: live verdicts through the real rules | yes |
| `flush` | the flush's verdicts as a last chunk at the end of the audio | no |
| `carry` | plus a correct next word, as when the reader goes on | the next word yes, the verdict no |

How the flush differs from the live app:

- Settled alignment: no dwell, the cursor word is judged, and the last stretch is
  aligned through the end of the ayah (`anchorAyahEnd`), which can move sounds
  between the last words.
- No right neighbour, so no GOP on the last word: only distance, margin and
  heard ratio. Live, the last word has the next ayah's first word on its right.
- A word with no sounds at the very end gets no verdict at all: `skipped` needs a
  later word, so a dropped last word shows as nothing rather than as `skipped`.
- Digital silence in the tail, where a phone has room tone.
- The wordMarks rules still apply: `wrong` on an ayah's last word is dropped, and a
  suspect needs a correct next word, so `flush` alone adds no last-word mark.

`score.mjs` measures the distance directly: the same recording's last word judged
live in the pool and by the flush in the control, and how often the flush moves
words already judged live.

## Running

```sh
PY=<a venv with pyarrow>
$PY -I natural/select_reciters.py     # needs .out/natural/lists/ (see below)
$PY -I natural/stage_meta.py
python3 -I natural/mutashabih.py
python3 -I natural/manifests.py plan
$PY -I natural/stage_audio.py .out/natural/manifests/wanted.json
python3 -I natural/manifests.py build
python3 -I natural/test_natural.py
node --test natural/test_score.mjs

M=.out/natural/manifests; R=.out/natural/baseline/runs
for s in w1 w1_control pool w5 learners; do
  node natural/run_suite.mjs $M/$s.json $R/$s
done
node natural/score.mjs --runs $R
```

`.out/natural/lists/` holds QUA's catalog (`catalog.json`), the EveryAyah folder
and reciter names (`everyayah.json`), the Muaalem reciters (`muaalem.json`) and
the hand-reviewed spellings (`aliases.json`). `run_suite.mjs` runs up to 8
processes with one ONNX thread each and resumes, starting a fresh process every 40 minutes of audio. `TILAWA_DIST` and `ENGINE_OPTS`
pass through for engine variants; `WORD_MARKS=<file>` replays other rules.
`riwayah_diff.py` is the ported riwayah diff for W2 and T2, unused by this baseline.

## What the scorer writes

Under `--out`: `scoreboard.md` and `.json`; `events.jsonl`, every W1 event with
the engine's verdict trail on the event's words, marks in each mode, what the
tracker heard and which rules stopped it; `missed.jsonl` and `missed_summary.json`,
why each miss was missed; `pool_marks.jsonl`, each false mark on the pool; and
`by_pair.json`, `w5_marked.json`, `provenance.json`. Each run's raw output (`runs/<suite>/<clip>.json`) keeps every
verdict change with its scores, the flush block with per-word heard phonemes and
frames, flags, events and chunk levels.

A catch is a mark on the event's word or one next to it; `exact` counts the word
itself. Intervals resample pairs (or passages) and reciters together: 95%,
percentile, from a two-way bootstrap. Raw event counts are not sample sizes.
