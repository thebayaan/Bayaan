#!/bin/zsh
# After the real pass: playback of every suite, then, once the held-out half's follower runs
# are in, the real pass and playback of the held-out half. Prints no result.
#   scripts/second-look/final/run_rest.sh
cd "$(dirname "$0")/../../recitation-bench" || exit 1
F=$PWD/.out/second-look/final
Q=../second-look/run_queue.mjs
until grep -q "queue done" $F/logs/real.log; do command sleep 30; done
node $Q 2 $F/logs/play.log $F/jobs_play.json
until grep -q finished-heldout-runs $F/logs/heldout_runs.log; do command sleep 30; done
node $Q 2 $F/logs/real_heldout.log $F/jobs_real_heldout.json
node $Q 2 $F/logs/play_heldout.log $F/jobs_play_heldout.json
print finished-rest
