#!/bin/bash
# Re-runs one planted file with the check's trace on, to see why a mistake was or was
# not marked:
#   fix2/trace_planted.sh <name> <seed> [extra sim.mjs args...]
# Needs the follower run .out/fix2/planted/<name>.s<seed>.run.json (planted.sh makes it).
# The audio is spliced again with mutate2.py and deleted after. The check comes from
# LIVE_SRC (default the repo's services/recitation/liveCheck), the model outputs from the
# cache key <name>.s<seed> (after CACHE_PREFIX if set). It runs with
# --cfg '{"probeSeconds":0.5}', as the planted batches do; a --cfg given here replaces it.
# Writes <name>.s<seed>.json (the sim result) and <name>.s<seed>.debug.txt (the trace)
# to TRACE_DIR (default .out/fix2/planted/dbg).
set -uo pipefail
if [ $# -lt 2 ]; then
  echo 'usage: fix2/trace_planted.sh <name> <seed> [extra sim.mjs args...]' >&2
  exit 2
fi
FIX2="$(cd "$(dirname "$0")" && pwd)"
BENCH="$FIX2/.."
OUT="$BENCH/.out/fix2"
N=$1; SEED=$2; shift 2
# A tag is a folder name under .out/fix2: never empty, never '.' or '..', no '/'.
bad_tag() { case $1 in ''|.*|*[!A-Za-z0-9._-]*) return 0 ;; esac; return 1; }
bad_num() { case $1 in ''|*[!0-9]*) return 0 ;; esac; return 1; }
if bad_tag "$N" || bad_num "$SEED"; then
  echo 'usage: fix2/trace_planted.sh <name> <seed> [extra sim.mjs args...]' >&2
  exit 2
fi
STEM="$N.s$SEED"
DIR=${TRACE_DIR:-$OUT/planted/dbg}
mkdir -p "$DIR"
RUN="$OUT/planted/$STEM.run.json"
[ -s "$RUN" ] || { echo "no follower run $RUN" >&2; exit 1; }
RID=${N%%_*}; SURAH=${N##*_}; B="$DIR/$STEM"
trap 'rm -f "$B.f32"' EXIT
nice -n 10 python3 -I "$BENCH/mutate2.py" "$OUT/qdc/$N.f32" "$OUT/qdc/$N.json" "$B.f32" "$B.truth.json" "$SEED$RID$SURAH" > /dev/null || { echo "FAIL mutate $STEM" >&2; exit 1; }
# Other audio would not be the batch's, and could fill a cache key made before the cache
# recorded its audio: stop.
cmp -s "$B.truth.json" "$OUT/planted/$STEM.truth.json" || { echo "TRUTH DIFFERS $STEM: the audio is not the batch's" >&2; exit 1; }
ORT_THREADS=1 nice -n 10 node "$FIX2/sim.mjs" "$N" --audio "$B.f32" --run "$RUN" --cachekey "${CACHE_PREFIX:-}$STEM" ${LIVE_SRC:+--check "$LIVE_SRC"} --keep 1 --cfg '{"probeSeconds":0.5}' --debug "$B.debug.txt" --out "$B.json" "$@" 2>&1 | tail -1
