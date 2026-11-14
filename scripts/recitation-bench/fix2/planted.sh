#!/bin/bash
# One planted recitation end to end:
#   fix2/planted.sh <name> <seed> <tag> [extra sim.mjs args...]
# mutate2.py splices events into the audio of .out/fix2/qdc/<name>.f32 (the reader really
# says them), the follower runs on it, then the live check, with the copy of the check in
# .out/fix2/planted/<tag>/live (run_planted.sh makes it; without it, the repo's files).
# Keeps the follower run, the truth and the sim result under .out/fix2/planted; deletes
# the spliced audio. A finished result is skipped. mutate2.py is deterministic by seed:
# when the truth and follower run exist, the audio is spliced again and the new truth
# must match the kept one. Model outputs are cached under the key <name>.s<seed>
# (CACHE_PREFIX=<p> makes it <p><name>.s<seed>).
set -uo pipefail
if [ $# -lt 3 ]; then
  echo 'usage: fix2/planted.sh <name> <seed> <tag> [extra sim.mjs args...]' >&2
  exit 2
fi
FIX2="$(cd "$(dirname "$0")" && pwd)"
BENCH="$FIX2/.."
OUT="$BENCH/.out/fix2"
N=$1; SEED=$2; TAG=$3; shift 3
# A tag is a folder name under .out/fix2: never empty, never '.' or '..', no '/'.
bad_tag() { case $1 in ''|.*|*[!A-Za-z0-9._-]*) return 0 ;; esac; return 1; }
bad_num() { case $1 in ''|*[!0-9]*) return 0 ;; esac; return 1; }
if bad_tag "$N" || bad_num "$SEED" || bad_tag "$TAG"; then
  echo 'usage: fix2/planted.sh <name> <seed> <tag> [extra sim.mjs args...]' >&2
  exit 2
fi
D="$OUT/planted"; mkdir -p "$D/$TAG"
STEM="${N}.s${SEED}"
B="$D/$STEM"
# The spliced audio and its truth while this file runs; one per tag and file.
T="$D/splice.$TAG.$STEM"
trap 'rm -f "$T.f32" "$T.truth.json"' EXIT
RID=${N%%_*}; SURAH=${N##*_}
[ -s "$D/$TAG/$STEM.json" ] && exit 0
LIVE=()
[ -s "$D/$TAG/live/check.ts" ] && LIVE=(--check "$D/$TAG/live")
nice -n 10 python3 -I "$BENCH/mutate2.py" "$OUT/qdc/$N.f32" "$OUT/qdc/$N.json" "$T.f32" "$T.truth.json" "$SEED$RID$SURAH" > /dev/null || { echo "FAIL mutate $STEM"; exit 0; }
if [ -s "$B.truth.json" ]; then
  cmp -s "$T.truth.json" "$B.truth.json" || { echo "TRUTH DIFFERS $STEM"; exit 0; }
else
  mv "$T.truth.json" "$B.truth.json"
fi
if [ ! -s "$B.run.json" ]; then
  ORT_THREADS=1 nice -n 10 node "$BENCH/bench.mjs" --audio "$T.f32" --dwell 2 --json "$B.run.json" > /dev/null 2>&1 || { echo "FAIL follower $STEM"; exit 0; }
fi
ORT_THREADS=1 nice -n 10 node "$FIX2/sim.mjs" "$N" --audio "$T.f32" --run "$B.run.json" ${LIVE[@]+"${LIVE[@]}"} --keep 1 --cachekey "${CACHE_PREFIX:-}$STEM" --out "$D/$TAG/$STEM.json" "$@" 2>&1 | tail -1
