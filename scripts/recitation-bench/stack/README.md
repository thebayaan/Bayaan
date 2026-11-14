# Engine stack checks

The checks behind the engine patch (`patches/@tilawa+core+0.4.0.patch`) and the mark
rules for the three word fixes: the junction check, the second judge's answer and the
added-word mark. They read saved runs under `.out/natural/` and write under
`.out/engine-stack/`. The copy of the engine they test sits at `.out/engine-stack/dist`.

Bench parity, before any change to `node_modules`:

```sh
python3 -I stack/pick_parity.py $PWD
python3 -I stack/pick_more.py $PWD
stack/run_parity.sh       # pool and W1, options off and on
stack/run_parity2.sh      # junction sites, controls, last words, added words
python3 -I stack/parity_cmp.py $PWD         # against the baselines
node stack/stack_vs_verify.mjs              # against the prototype engines
```

`stack_probe.mjs` is the `BENCH_PROBE` of those runs: it reads the session as the app
would, and checks the log-mel ring against whole-stream features. `swap_dist.py` puts a
built copy into `node_modules` in one rename.

Mark rules, on saved runs, with no model and no audio:

- `replay_hash.mjs`: `natural/replay.mjs` over saved runs, as a hash. It must not move
  on runs with no junction, judge or added data.
- `junction_parity.mjs`: marks on the combined engine's runs under the junction rules.
  Run it once with `WORD_MARKS=.out/natural/verify/wordMarks.combined.ts` and once
  without, then compare the two files.
- `rule_parity.mjs`: `services/recitation/addedWord.ts` against `added/rule.mjs` on every
  gap the added-word job recorded.
- `live_order.mjs`: the rules in the order the app meets them, the judge's stored answer
  arriving about a second after its verdict, against the bench's replay. It also runs the
  added mark's clearing of its two neighbours.

`app_flow/` runs the app's own engine wrapper (`services/recitation/recitationEngine.ts`,
with the native edges swapped) on real audio and compares it with the bench run of the
same clip:

```sh
node stack/app_flow/build.cjs
M=.out/engine-stack/manifests
node .out/engine-stack/app_flow/run.mjs $PWD/$M/parity_pool.json .out/engine-stack/wrap_pool.jsonl
node .out/engine-stack/app_flow/run.mjs $PWD/$M/parity_w1.json .out/engine-stack/wrap_w1.jsonl
node .out/engine-stack/app_flow/run.mjs $PWD/$M/parity_added.json .out/engine-stack/wrap_added.jsonl
node stack/app_flow/cmp.mjs
```

`time_probe.mjs` (a `BENCH_PROBE`) and `vocab_mem.mjs` time the new parts on this machine.

None of this has run on a phone.
