#!/bin/bash
# The follower (bench.mjs, the app's flow, no timings given) on the held-out pool:
#   fix2/heldout/run_follower.sh <jobs> [quiet|noise]
# Writes .out/fix2/runs_heldout/<id>.json (quiet) or <id>.n10.json (noise: background
# speech from mix_speech.py at 10 dB through the bench's noise.sh, which also applies a
# 200-5000 Hz phone band). Clips with a run are skipped. The mixed audio is made next to
# the run and deleted after; noise.sh's own temporary files go under .out/fix2/tmp.
# REV=1 goes through the clips from the end (a second process can then start there).
# DRY=1 only lists each clip, whether its audio is there and whether it has a run.
set -uo pipefail
if [ $# -lt 1 ] || [ $# -gt 2 ] || { [ $# -eq 2 ] && [ "$2" != quiet ] && [ "$2" != noise ]; }; then
  echo 'usage: fix2/heldout/run_follower.sh <jobs> [quiet|noise]' >&2
  exit 2
fi
HERE="$(cd "$(dirname "$0")" && pwd)"
BENCH="$HERE/../.."
OUT="$BENCH/.out/fix2"
JOBS=$1; MODE=${2:-quiet}
bad_num() { case $1 in ''|*[!0-9]*) return 0 ;; esac; return 1; }
if bad_num "$JOBS"; then
  echo 'usage: fix2/heldout/run_follower.sh <jobs> [quiet|noise]' >&2
  exit 2
fi
SUF=""; [ "$MODE" = noise ] && SUF=".n10"
MANIFEST="$OUT/data/heldout_pool/manifest.json"
[ -s "$MANIFEST" ] || { echo "no manifest $MANIFEST (fix2/stage/stage_heldout.py)" >&2; exit 1; }
clips() {
  python3 -I -c "
import json, os, sys
cl = json.load(open(sys.argv[1]))['clips']
if os.environ.get('REV'):
    cl = cl[::-1]
for c in cl:
    print(c['id'], c['audio'])
" "$MANIFEST"
}
if [ -n "${DRY:-}" ]; then
  clips | while read -r ID AUDIO; do
    echo "$ID$SUF audio=$([ -s "$AUDIO" ] && echo yes || echo MISSING) run=$([ -s "$OUT/runs_heldout/$ID$SUF.json" ] && echo done || echo todo)"
  done
  exit 0
fi
mkdir -p "$OUT/runs_heldout" "$OUT/tmp"
one() {
  local ID=$1 AUDIO=$2
  local RUN="$OUT/runs_heldout/$ID$SUF.json"
  [ -s "$RUN" ] && return 0
  local A="$AUDIO"
  if [ -n "$SUF" ]; then
    A="$OUT/runs_heldout/$ID$SUF.f32"
    if ! { nice -n 10 python3 -I "$HERE/mix_speech.py" "$AUDIO" "$A.speech" "$ID" && TMPDIR="$OUT/tmp" nice -n 10 bash "$BENCH/noise.sh" "$AUDIO" "$A" babble 10 "$A.speech"; }; then
      echo "FAIL mix $ID"; rm -f "$A.speech" "$A"; return 0
    fi
    rm -f "$A.speech"
  fi
  ORT_THREADS=1 nice -n 10 node "$BENCH/bench.mjs" --audio "$A" --dwell 2 --json "$RUN" > /dev/null 2>&1 && echo "ok $ID$SUF" || echo "FAIL $ID$SUF"
  [ -n "$SUF" ] && rm -f "$A"
  return 0
}
export -f one; export HERE BENCH OUT SUF
clips | xargs -P "$JOBS" -L 1 bash -c 'one "$0" "$1"'
