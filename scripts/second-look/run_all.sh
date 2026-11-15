#!/bin/zsh
# Every number in RULE.md, in order, on tuning data only. Resumes: finished runs are skipped.
# At most 2 model processes and 3 bench processes. Downloads nothing, changes no tracked file.
S=${0:A:h}
B=$S/../recitation-bench
L=$B/.out/second-look/logs
cd $S/../..
$S/run_voices_combined.sh >> $L/voices_combined.log 2>&1
node $S/run_queue.mjs 2 $L/rows.log $S/jobs_rows.json
node $S/run_queue.mjs 2 $L/eval.log $S/jobs_eval.json
python3 -I $S/live_close.py
node $S/voices_combined.mjs
node $S/tables.mjs
node $S/check_earlier.mjs
node $S/tables_md.mjs > $B/.out/second-look/tables.md
node $S/write_frozen.mjs
