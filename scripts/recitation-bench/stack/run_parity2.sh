#!/bin/zsh
B=$(cd "$(dirname "$0")/.." && pwd)
S=$B/stack
L=$B/.out/engine-stack/logs
mkdir -p $L
cd $B
export TILAWA_DIST=$B/.out/engine-stack/dist
export ORT_THREADS=1
export BENCH_PROBE=$S/stack_probe.mjs
OUT=$B/.out/engine-stack/runs
# The app's own options, from the NPL file.
C=$B/../../services/recitation/followerConstants.npl.json
J="\"junction\":$(node -p "JSON.stringify(require('$C').junction)")"
G="\"gapReport\":$(node -p "JSON.stringify(require('$C').gapReport)")"
export ENGINE_OPTS="{$J,\"config\":{$G}}"
node natural/run_suite.mjs .out/engine-stack/manifests/parity_sites.json $OUT/on_sites --jobs 1 --minutes-per-process 20 > $L/on_sites.log 2>&1 &
node natural/run_suite.mjs .out/engine-stack/manifests/parity_control.json $OUT/on_control --jobs 1 --minutes-per-process 20 > $L/on_control.log 2>&1 &
node natural/run_suite.mjs .out/engine-stack/manifests/parity_last.json $OUT/on_last --jobs 1 --minutes-per-process 20 > $L/on_last.log 2>&1 &
wait
export ENGINE_OPTS="{\"stayOnSurah\":true,$J,\"config\":{\"idleFrames\":100000,\"lostRate\":9,$G}}"
node natural/run_suite.mjs .out/engine-stack/manifests/parity_added.json $OUT/on_added --jobs 3 --minutes-per-process 20 > $L/on_added.log 2>&1
echo finished > $L/parity2.done
