# The final read

The numbers in `../SCOREBOARD.md`, from the app's real code as it stands, verdict to mark.
Nothing here changes a rule or a constant.

- `build.mjs` bundles the app's real modules for node, once per setting of the switches in
  `secondLook/config.ts`. `real.*` hold the app's own engine wrapper over `@tilawa/core` in
  `node_modules`, with the options the app passes. `app.*` take a recorded follower.
- `real_pass.mjs` plays a suite through the whole real stack at the default setting, with the
  second model taking an assumed 0.25 s a run on a clock moved by hand. It keeps the marks
  and what the wrapper reported, chunk by chunk (`.out/second-look/final/stream/`).
- `play.mjs` plays that record through the other settings, and at 0.6 s a run, with the real
  second model (`marks/`). Real pass and playback are compared clip by clip.
- `run_today.sh` runs today's committed engine (the pristine package with the patch at HEAD)
  on the suites with no saved run of it. `today.mjs` replays the committed rules on those
  runs and on the natural benchmark's baselines.
- `run_heldout.sh` is the one held-out read's follower runs, through `chatter/run.mjs --half
  test`, kept apart by `--variant`. `score.mjs --heldout` is the only thing that reads them.
- `digest.mjs` joins it all per suite; `score.mjs` writes every table; `write_board.mjs` puts
  them into `SCOREBOARD.md`. `cpu_check.mjs` times one check.

```sh
node scripts/second-look/final/build.mjs
node scripts/second-look/final/jobs.mjs
node scripts/second-look/run_queue.mjs 2 <log> .out/second-look/final/jobs_real.json
scripts/second-look/final/run_today.sh
node scripts/second-look/run_queue.mjs 2 <log> .out/second-look/final/jobs_play.json
```

`.out/second-look/final/wordMarks.today.ts` is `git show HEAD:services/recitation/wordMarks.ts`,
and `engine_today/` the pristine package with `git show HEAD:patches/@tilawa+core+0.4.0.patch`.
At most 3 bench and 2 model processes, one thread each; a real pass counts as both.

Nothing here has run on a phone. The time per model run is an assumption, not a measure.
