# The app against the frozen rule

`RULE.md` froze the rule on a stand-in: `eval_marks.mjs` applies the judge's answers at
their verdict's own time, reads the tracker's places from the end of the take, and asks
the cancel step at the moment a mark falls due. This folder runs what ships instead.

`build.mjs` bundles the app's real TypeScript for node: `RecitationTrackingService`, the
mark rules, `sessionRunner`, the queue in `secondLook/checkWord.ts`, the scoring, the table
of alternatives and the audio ring. It builds one bundle per setting of the switches, by
changing exactly those lines of `secondLook/config.ts`, and one with `SECOND_LOOK_ENABLED`
off. Only the native edges are swapped (`shims/native.mjs`). The second model is the real
one under onnxruntime-node, with the options `secondLook/model.ts` passes.

`run.mjs` plays a recorded run through it, verdict to mark (`engine.mjs`):

- the follower's verdicts and events come at the audio times it recorded them;
- its log-mel frames are the engine's own `KaldiFbank`, chunk by chunk, read through a ring
  of the same size as the engine's;
- `clock.mjs` moves the app's time by hand, and each model run takes the time the phone is
  assumed to take, 0.25 s or 0.6 s, while chunks go on arriving. The real runs are waited
  for before the clock moves on, so this machine's speed changes nothing;
- `--places known` reads the tracker's places as known at each moment, where a run kept
  them (`probe.framesLog`), rather than from the end of the take as the stand-in did;
- when the follower went idle or finished a surah, its features start again as the
  session's do, and word places and frames stay on one clock.

`compare.mjs` puts the marks beside the stand-in's, suite by suite, and lists every mark on
which they differ. `explain.mjs` plays each differing run again with its trace kept and
prints what each side knew about the word. Tuning cells only: no test cell of the pool or
W1 is read.

```sh
node scripts/second-look/repro/build.mjs real
node scripts/second-look/run_queue.mjs 2 <log> scripts/second-look/repro/jobs.json
node scripts/second-look/repro/compare.mjs > <report>
node scripts/second-look/repro/explain.mjs > <why>
```

`real_engine.mjs` runs the same modules with the real engine under them on a few clips: the
real log-mel ring, the tracker's places as known at that moment. `real_compare.mjs` puts
that beside the playback of the same clips (`run.mjs --trace 1 --tag realcheck --only ...`).

`frames_noise.mjs` measures how far the engine's frames move the judge's scores from those
on the bench's own feature recipe. `../check_port.mjs` fuzzes the port against the
originals; `../gen_goldens.mjs --check` and `../build_alternatives.mjs --check` say whether
the goldens and the table still hold.

Nothing here has run on a phone. The time per model run is an assumption, not a measure.
