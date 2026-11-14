#!/bin/bash
# The follower (bench.mjs, the app's flow) over staged Quran.com files:
#   fix2/run_follower.sh [<jobs>=2]
# Writes .out/fix2/runs/<name>.json for every .out/fix2/qdc/<name>.f32 that has none yet.
# NAMES=<regex> keeps only matching names.
set -uo pipefail
BENCH="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$BENCH/.out/fix2"
JOBS=${1:-2}
mkdir -p "$OUT/runs"
one() {
  local N=$1 A="$OUT/qdc/$1"
  [ -s "$OUT/runs/$N.json" ] && return 0
  local AYAT
  AYAT=$(python3 -I -c "import json,sys;print(len(json.load(open(sys.argv[1]))['audio_files'][0]['verse_timings']))" "$A.json")
  ORT_THREADS=1 nice -n 10 node "$BENCH/bench.mjs" --audio "$A.f32" --timings "$A.json" --ayat "$AYAT" --dwell 2 --json "$OUT/runs/$N.json" > /dev/null 2>&1 && echo "ok $N" || echo "FAIL $N"
}
export -f one; export BENCH OUT
ls "$OUT/qdc/" | grep '\.f32$' | sed 's/\.f32$//' | grep -E "${NAMES:-.}" | xargs -P "$JOBS" -L 1 bash -c 'one $0'
