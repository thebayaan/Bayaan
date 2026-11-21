#!/bin/sh
# Runs e2e_harness.mjs on one suite in several processes, one ONNX thread each.
#   judge/run_e2e.sh <suite> <split> <outdir> [processes] [extra harness options...]
suite=$1; split=$2; out=$3; procs=${4:-3}
shift 4
mkdir -p "$out"
i=0
while [ "$i" -lt "$procs" ]; do
  ORT_THREADS=1 node judge/e2e_harness.mjs --suite "$suite" --split "$split" --shard "$i/$procs" \
    --out "$out/$suite.$i.jsonl" "$@" > "$out/$suite.$i.log" 2>&1 &
  i=$((i + 1))
done
wait
cat "$out"/$suite.*.log
