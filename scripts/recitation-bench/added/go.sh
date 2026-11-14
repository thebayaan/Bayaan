#!/bin/sh
# Runs suites with the engine copy and the gap probe, three processes at a time,
# packs each into one JSONL under .out/added/packed and removes its raw runs.
#   added/go.sh pool_dev added w1_sub
cd "$(dirname "$0")/.." || exit 1
BENCH=$(pwd)
export BENCH_PROBE="$BENCH/added/probe.mjs"
export TILAWA_DIST="$BENCH/.out/added/core/dist"
export ORT_THREADS=1
mkdir -p .out/added/runs .out/added/packed
for s in "$@"; do
  M=.out/added/manifests/$s.json
  [ -f "$M" ] || M=.out/natural/manifests/$s.json
  R=.out/added/runs/$s
  case "$s" in
    # The reader goes on with other words after the event, or arrives through
    # them. A reader who carried on would not lose the place, so the harness
    # keeps it: no fallback to tracking, no idle. See added/pairs.py.
    added_kept*|added_between*)
      export ENGINE_OPTS='{"stayOnSurah":true,"config":{"idleFrames":100000,"lostRate":9}}' ;;
    *) unset ENGINE_OPTS ;;
  esac
  echo "== $s $(date +%H:%M:%S)"
  node natural/run_suite.mjs "$M" "$R" --jobs 3 | tail -2
  node added/extract.mjs "$R" ".out/added/packed/$s.jsonl" && rm -rf "$R"
  gzip -f ".out/added/packed/$s.jsonl"
  echo "== $s done $(date +%H:%M:%S)"
done
