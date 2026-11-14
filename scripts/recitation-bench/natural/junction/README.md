# Junction check: a skipped last word

A prototype for one question: the reader leaves out an ayah's last word and carries
on into the next ayah. Can the app tell? Nothing here ships. `services/`,
`node_modules` and `patches/` stay untouched; the engine experiment is a copy under
`.out/natural/junction/dist` (`make_dist.mjs`), and the mark rules a generated copy
(`make_marks.mjs`, for `WORD_MARKS`).

## Why it is missed today

The tracker bends the next ayah's first sounds onto the missing word, so the engine
calls it `wrong`, and `wordMarks.ts` ignores `wrong` on an ayah's edge, where it is
nearly always the reader joining two ayat.

## The check

While the cursor is on an ayah's last two words, and until one chunk after it enters
the next ayah, find the best CTC fit of two hypotheses in the frames from 3 s before
the word before the last word up to what has been decoded:

    word before + last word + next word's first sounds     (h1)
    word before + next word's first sounds                 (h0)

Each path may start and stop at any frame, so audio outside the fit costs nothing: the
tracker's own idea of where these words sit is the part it gets wrong here. The
difference per token of the last word is `llr`. The word is unsaid when h0 fits and
`llr` is under its threshold (early: the tracker has not crossed yet; off when the two
words open alike), or, at the end of that stretch, when the word's verdict is settled
and not `ok`, `llr` is under the threshold and h0 fits at least loosely (late). It uses
the frames the session already keeps in correction mode and the engine's tokenizer; no
other model runs.
Hypotheses exist only inside the computation and are never shown.

## True events, from the official text only

No audio is cut, joined, stretched or mixed, and no text is changed.

- **Natural sites** (`sites.py`). X ends `... c L` and the ayah after X opens with d.
  Y ends with c and the ayah after Y also opens with d. A reader of Y and its next
  ayah says `c d`, what X sounds like without L. The live run feeds those two
  recordings, as QUA cut them from one file, against X's official text, the tracker
  locked on c when c starts (`trackAt` in `bench.mjs`), since what comes before c
  differs. Each site has a control: the same reciter reading X and its next ayah
  against their own text, locked on the same word.
- **Text-side events** (`ending_twins.py`, `interior_events.py`, `scan_phantom.mjs`).
  The test alone, with no tracker, on the pool's posteriors: a real join where the
  reader said c and X's official text has `c L`; a place inside an ayah where the
  reader says `c d` and X reads `c L | d`; a real join where the reader said another
  last word than X's.

## False events

Every join of the correct-recitation pool (`../manifests.py`), the controls, and W5's
clips that reach a next ayah.

## Splits

Sites and text-side events split by the last word itself (`sites.type_split`), so dev
and test share no last-word type; reciters and pool passages use the benchmark's
splits. `analyze.py` and `score_junction.mjs` refuse `--split test` until
`.out/natural/junction/frozen.json` exists.

## Running

```sh
python3 -I natural/junction/sites.py plan
$PY -I natural/stage_audio.py .out/natural/junction/manifests/wanted.json --jobs 2
python3 -I natural/junction/sites.py build
python3 -I natural/junction/ending_twins.py
python3 -I natural/junction/interior_events.py
python3 -I natural/junction/test_junction.py
node natural/junction/make_dist.mjs
node natural/junction/make_marks.mjs

J=.out/natural/junction
export BENCH_PROBE=natural/junction/probe.mjs
JUNCTION_POST_DIR=$J/post/pool node natural/run_suite.mjs .out/natural/manifests/pool.json $J/runs/pool
JUNCTION_POST_DIR=$J/post/live node natural/run_suite.mjs $J/manifests/junction_live.json $J/runs/live
JUNCTION_POST_DIR=$J/post/control node natural/run_suite.mjs $J/manifests/junction_control.json $J/runs/control

mkdir -p $J/scan
node natural/junction/scan_joins.mjs $J/runs/pool $J/post/pool $J/scan/pool.jsonl
node natural/junction/scan_joins.mjs $J/runs/live $J/post/live $J/scan/live.jsonl
node natural/junction/scan_joins.mjs $J/runs/control $J/post/control $J/scan/control.jsonl
node natural/junction/scan_phantom.mjs $J/runs/pool $J/post/pool $J/scan/phantom.jsonl
$PY -I natural/junction/analyze.py --split dev

WORD_MARKS=$J/wordMarks.junction.current.ts node natural/junction/score_junction.mjs \
  --runs $J/runs --post $J/post --tau <llr> --fit <nats> --fit-late <nats> --split dev
```

When the machine is short on memory, `run_gated.py` starts the same runs in short
batches under limits on bench processes, free disk and swap.

The first version's constants are in `.out/natural/junction/frozen.json`, written before
the test look, with that version's files under `frozen_v1/`. `frozen_v2.json` holds the
amended rule, written after that look and before reading the mixed cells (dev reciters
on test passages or last-word types, and the reverse), which `--split mixed` scores.
`chain_v2.sh` under `.out/natural/junction/` runs it through the patched engine. Tests: `test_junction.py` (every word a site or text-side event names against
the pinned text, and word numbers) and `node --test natural/junction/test_check.mjs`.

`probe.mjs` observes a bench run (`BENCH_PROBE`) and changes nothing the engine does;
`JUNCTION_POST_DIR` keeps each take's CTC log-probabilities, about 6 KB per second.
`score_junction.mjs --tau` stands in for the patched engine from those dumps
(`decision.mjs`), and `verify_inline.mjs` compares the two on a sample. `--alt` replays a
simpler rule on the same path, and `wordMarks.noedge.ts` drops the edge rule outright.
`make_marks.mjs` builds on today's `services/recitation/wordMarks.ts` into
`wordMarks.junction.current.ts`; the scores in `frozen*.json` used the copy under
`frozen_v1/`, from before that file gained the second look, with the same marks.
`scan_early.mjs` scores every chunk before the crossing; `scan_end.mjs` scores the end of
a take. A site's tracker has no history at its lock, so its cost rate reports `lost`
around the join, which the app would not; the scorer leaves those events out of the
replay unless `--keep-lost 1`. To run the patched engine itself:
`TILAWA_DIST=$J/dist ENGINE_OPTS='{"junction":{"llrMissing":<llr>,"fitNext":<nats>,"fitLate":<nats>}}'`.
