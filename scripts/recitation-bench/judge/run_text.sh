#!/bin/sh
# Runs text_harness.mjs on one suite in several processes, one ONNX thread each.
#   judge/run_text.sh <suite> <split> <outdir> <every> '<configs json>' [processes]
suite=$1; split=$2; out=$3; every=$4; configs=$5; procs=${6:-4}
mkdir -p "$out"
i=0
while [ "$i" -lt "$procs" ]; do
  ORT_THREADS=1 node judge/text_harness.mjs --suite "$suite" --split "$split" --every "$every" \
    --configs "$configs" --shard "$i/$procs" --out "$out/$suite.$i.jsonl" > "$out/$suite.$i.log" 2>&1 &
  i=$((i + 1))
done
wait
cat "$out"/$suite.*.log
