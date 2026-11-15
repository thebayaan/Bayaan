# Added words

A prototype of a mark for a word the reader said that is not in the text. Nothing
here ships: the engine change lives on a copy of the engine's dist under
`.out/added/core` (`TILAWA_DIST`), and the rule lives in `rule.mjs`.

## The signal

Between two neighbouring words, the engine copy takes everything heard from the
left word on and splits it into the left word, one unbroken run, and the right
word, ignoring what follows. Lengthened sounds count once. The run's sounds cost
next to nothing, so the right word cannot bend over the run's first sounds at less
than the run's price. Without this split an extra word is invisible: alignment
ties put it inside a neighbour's span (`للَااهَ` + `هُوَ` reads as a long, unsure
`للَااهَ`), and nothing in the verdicts names it.

The rule (`rejectReason` in `rule.mjs`) marks the run unless:

- it is not word-shaped: under three sounds, or no consonant or no vowel;
- either neighbour does not fit once the run is taken out;
- it is not one word of the Quran (`isWordInRun`), which stops fragments and
  garbled restarts, and other voices' speech;
- nearby text explains it (`explainedBy`): the next words begun early, whole words
  said again, the current word half said again, the tail of a word said again, or
  read on, stopped and gone back;
- it is the start of the isti'adha, the basmala, a takbir, the closing formula or
  amin (`phraseCost`);
- forcing the two words with no run costs the model too little (`noGap`): a run the
  decoder wrote but the audio does not insist on.

A run in the chunk where the tracker locks is not marked, and neither is anything
before the first word of a lock: a reader may start anywhere.

## Natural events

`pairs.py` finds where a recording of whole ayat reads words that stand side by side
in the official text elsewhere, with one word between them. No audio is cut and no
text changed: the recording plays whole against the other ayah's official text, as
in W1. Words are compared by how they sound (`mutashabih.text_key`).
`test_pairs.py` checks every event against the pinned text.

Classes:

- `interior`: the recording starts at a whole ayah inside the shared words.
- `interior_prefix`: its ayah starts before them, so the tracker first hears other
  words.
- `between`: the extra word falls between two ayat of the other text. All of these
  arrive through other words.

After the shared words the reader goes on with their own ayah. A reader who really
added a word would go on correctly, so most of these runs keep the place by harness
(`ENGINE_OPTS` in `go.sh`: no fallback to tracking, no idle). `added_app_*` runs the
app's flow with no help.

## Running

```sh
PY=<a venv with pyarrow>
python3 -I added/pairs.py plan
$PY -I added/stage.py .out/added/manifests/wanted.json
python3 -I added/pairs.py build
python3 -I added/test_pairs.py
node --test added/test_rule.mjs

# Offline screen of the natural benchmark's baseline runs: no model, a few minutes.
node added/replay_text.mjs pool --split dev
# What it held, and the natural events, through the model: see go.sh.
added/go.sh added_kept_dev added_between_dev pool_dev_cand ...
node added/score.mjs --split dev --show 1
```

`probe.mjs` is a `BENCH_PROBE`: it logs every gap with its scores. `go.sh` packs a
suite into `.out/added/packed/` and removes its raw runs, three processes at a time.

The offline screen keeps the machine's load down, and its claim is checked: a clip
it passes cannot get a mark at any score cut-off, so only held clips need the model.
On 12 takes it passed that went through the model anyway there was no mark, and
verdict changes matched the unpatched engine exactly.

## Constants

Frozen on dev (reciters and events both dev), then read once on test. All come from
this engine's output, so they belong in the NPL file that ships with the model. No
second model is involved.

| Constant | Value | Source |
|---|---:|---|
| `noGap` | -2 per token of the two words | dev: true events reach -2.46 at worst, the false runs left -1.70 |
| `fit` | 0.15 | the engine's own `okDistance`; checked on dev |
| `fitLast` | 0.4, an ayah's last word | the engine's own `unsureDistance`: a stop changes the word's end; checked on dev |
| `minSounds` | 3 | a word's shortest shape; `وَ` and `فَ` cannot be told from noise |
| `shortRun`, `backShort`, `aheadShort` | 5, 4, 2 | dev: a short run repeats only what is close |
| `back`, `ahead` | 12, 12 | dev: how far natural restarts reach |
| `tolShort`, `tolMid`, `midRun`, `tolLong` | 0.3, 1, 12, 0.3 per sound | dev: edit cost a repeat may carry |
| `twoPartsFrom` | 10 | dev: shorter runs cannot be two pieces |
| `GAP_RUN_COST`, `GAP_LOOK_AHEAD`, `GAP_MAX_REGION` | 0.05, 8, 200 | engine copy, mechanics of the split |

`.out/added/frozen.sha256` pins `rule.mjs` as it was when the test report was read. A
comment naming the numbers' licence was added after that, and nothing else changed.

Results: `.out/added/score_test/` is the one report on held-out data,
`score_dev/` and `score_all/` the others. `.out/added/verdicts.proposed.patch` is the
engine change with only what the rule reads; it gave the same marks as the prototype
on 48 of 48 clips.
