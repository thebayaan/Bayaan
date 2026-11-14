#!/bin/zsh
# The held-out half's follower runs: test reciters on test passages, with voices behind,
# one condition at a time, mixed audio deleted after each. First on today's committed
# engine, then on the patched engine with the app's options. This prints no result.
#   scripts/second-look/final/run_heldout.sh
cd "$(dirname "$0")/../../recitation-bench" || exit 1
F=.out/second-look/final
CONDS=none:0,one_ar:10,crowd:10,one_ar:5,crowd:5,rec_one:5
export ORT_THREADS=1
TILAWA_DIST=$PWD/$F/engine_today/dist node chatter/run.mjs --half test \
  --variant final_test_today --conds $CONDS --minutes 17 --jobs 1 || exit 1
ENGINE_OPTS=$(cat $F/app_engine_opts.json) node chatter/run.mjs --half test \
  --variant final_test_app --conds $CONDS --minutes 17 --jobs 1 || exit 1
print finished-heldout-runs
