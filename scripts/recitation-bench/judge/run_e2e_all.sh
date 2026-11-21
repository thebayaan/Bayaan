#!/bin/sh
# All main suites of the end-to-end harness, one after another, three processes each.
#   judge/run_e2e_all.sh <split> <outdir> [harness options...]
split=$1; out=$2
shift 2
for suite in w1 pool w1_control; do
  judge/run_e2e.sh "$suite" "$split" "$out" 3 "$@"
done
