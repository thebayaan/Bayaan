#!/bin/zsh
# Parity runs of the engine stack against the baselines. At most 3 bench processes.
B=$(cd "$(dirname "$0")/.." && pwd)
S=$B/stack
L=$B/.out/engine-stack/logs
mkdir -p $L
cd $B
export TILAWA_DIST=$B/.out/engine-stack/dist
export ORT_THREADS=1
OUT=$B/.out/engine-stack/runs
mkdir -p $OUT
# The app's own options, from the NPL file.
ON=$(node -p "const c = require('$B/../../services/recitation/followerConstants.npl.json'); JSON.stringify({junction: c.junction, config: {gapReport: c.gapReport, cutAtJump: c.engine.cutAtJump}})")
unset ENGINE_OPTS
unset BENCH_PROBE
node natural/run_suite.mjs .out/engine-stack/manifests/parity_w1.json $OUT/off_w1 --jobs 1 --minutes-per-process 20 > $L/off_w1.log 2>&1 &
ENGINE_OPTS=$ON BENCH_PROBE=$S/stack_probe.mjs node natural/run_suite.mjs .out/engine-stack/manifests/parity_w1.json $OUT/on_w1 --jobs 1 --minutes-per-process 20 > $L/on_w1.log 2>&1 &
wait
node natural/run_suite.mjs .out/engine-stack/manifests/parity_pool.json $OUT/off_pool --jobs 1 --minutes-per-process 20 > $L/off_pool.log 2>&1 &
ENGINE_OPTS=$ON BENCH_PROBE=$S/stack_probe.mjs node natural/run_suite.mjs .out/engine-stack/manifests/parity_pool.json $OUT/on_pool --jobs 2 --minutes-per-process 20 > $L/on_pool.log 2>&1 &
wait
echo finished > $L/parity.done
