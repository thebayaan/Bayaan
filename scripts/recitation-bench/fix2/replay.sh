#!/bin/bash
# Replays every file a clean batch and a planted batch have finished through a copy of
# the live check, from the cache of model outputs, so a rule change needs no model run:
#   fix2/replay.sh <new tag> <clean tag|-> <planted tag|-> <jobs> [extra sim.mjs args...]
# Clean files .out/fix2/sim/<clean tag>/<name>.json are replayed into
# .out/fix2/sim/<new tag>/, planted files .out/fix2/planted/<planted tag>/<name>.s<seed>.json
# into .out/fix2/planted/<new tag>/ ("-" skips a side). Finished files are skipped. The
# first call for a tag copies the check's three source files into <new tag>/live from
# LIVE_SRC (default the repo's services/recitation/liveCheck). The cache keys are those
# run_sims.sh and planted.sh use: <name> and <name>.s<seed>, after CACHE_PREFIX if set.
# For a planted file the spliced audio is made again with mutate2.py (deterministic by
# seed), its truth must match the kept one, and the audio is deleted after. The follower
# runs are the ones kept in .out/fix2/runs and .out/fix2/planted. Pass the same --cfg the
# batches ran with if only the check's source is meant to change.
set -uo pipefail
if [ $# -lt 4 ]; then
  echo 'usage: fix2/replay.sh <new tag> <clean tag|-> <planted tag|-> <jobs> [extra sim.mjs args...]' >&2
  exit 2
fi
FIX2="$(cd "$(dirname "$0")" && pwd)"
BENCH="$FIX2/.."
OUT="$BENCH/.out/fix2"
TAG=$1; CLEAN=$2; PLANTED=$3; JOBS=$4; shift 4
# A tag is a folder name under .out/fix2: never empty, never '.' or '..', no '/'.
bad_tag() { case $1 in ''|.*|*[!A-Za-z0-9._-]*) return 0 ;; esac; return 1; }
bad_num() { case $1 in ''|*[!0-9]*) return 0 ;; esac; return 1; }
if bad_tag "$TAG" || { [ "$CLEAN" != - ] && bad_tag "$CLEAN"; } || { [ "$PLANTED" != - ] && bad_tag "$PLANTED"; } || bad_num "$JOBS"; then
  echo 'usage: fix2/replay.sh <new tag> <clean tag|-> <planted tag|-> <jobs> [extra sim.mjs args...]' >&2
  exit 2
fi
if [ -z "${LIVE_SRC:-}" ] && [ -n "${SRC:-}" ]; then
  echo "note: SRC is read as LIVE_SRC" >&2
  LIVE_SRC=$SRC
fi
# Both sides are checked before anything is made.
for SIDE in sim:"$CLEAN" planted:"$PLANTED"; do
  DIR=${SIDE%%:*}; FROM=${SIDE#*:}
  [ "$FROM" = "-" ] && continue
  [ -d "$OUT/$DIR/$FROM" ] || { echo "no batch $OUT/$DIR/$FROM" >&2; exit 2; }
  [ "$FROM" = "$TAG" ] && { echo "the new tag must differ from $FROM" >&2; exit 2; }
done
for SIDE in sim:"$CLEAN" planted:"$PLANTED"; do
  DIR=${SIDE%%:*}; FROM=${SIDE#*:}
  [ "$FROM" = "-" ] && continue
  mkdir -p "$OUT/$DIR/$TAG"
  [ -s "$OUT/$DIR/$TAG/live/check.ts" ] || node "$FIX2/build_live.mjs" --snapshot "$OUT/$DIR/$TAG/live" ${LIVE_SRC:+"$LIVE_SRC"}
done
clean() {
  local N=$1; shift
  [ -s "$OUT/sim/$TAG/$N.json" ] && return 0
  [ -s "$OUT/runs/$N.json" ] || { echo "FAIL no follower run $N"; return 0; }
  ORT_THREADS=1 nice -n 10 node "$FIX2/sim.mjs" "$N" --check "$OUT/sim/$TAG/live" --keep 1 --cachekey "${CACHE_PREFIX:-}$N" --out "$OUT/sim/$TAG/$N.json" "$@" 2>&1 | tail -1
}
planted() {
  local STEM=$1; shift
  local N=${STEM%%.s*}; local SEED=${STEM##*.s}
  local RID=${N%%_*}; local SURAH=${N##*_}
  local D="$OUT/planted"
  local B="$D/replay.$TAG.$STEM"
  [ -s "$D/$TAG/$STEM.json" ] && return 0
  [ -s "$D/$STEM.run.json" ] || { echo "FAIL no follower run $STEM"; return 0; }
  nice -n 10 python3 -I "$BENCH/mutate2.py" "$OUT/qdc/$N.f32" "$OUT/qdc/$N.json" "$B.f32" "$B.truth.json" "$SEED$RID$SURAH" > /dev/null || { echo "FAIL mutate $STEM"; rm -f "$B.f32" "$B.truth.json"; return 0; }
  if cmp -s "$B.truth.json" "$D/$STEM.truth.json"; then
    ORT_THREADS=1 nice -n 10 node "$FIX2/sim.mjs" "$N" --audio "$B.f32" --run "$D/$STEM.run.json" --cachekey "${CACHE_PREFIX:-}$STEM" --check "$D/$TAG/live" --keep 1 --out "$D/$TAG/$STEM.json" "$@" 2>&1 | tail -1
  else
    echo "TRUTH DIFFERS $STEM"
  fi
  rm -f "$B.f32" "$B.truth.json"
}
export -f clean planted; export FIX2 BENCH OUT TAG CACHE_PREFIX
{
  [ "$CLEAN" != "-" ] && ls "$OUT/sim/$CLEAN/" | grep '\.json$' | sed 's/\.json$//' | sed 's/^/clean /'
  [ "$PLANTED" != "-" ] && ls "$OUT/planted/$PLANTED/" | grep -E '\.s[0-9]+\.json$' | sed 's/\.json$//' | sed 's/^/planted /'
} | xargs -P "$JOBS" -I{} bash -c 'line=$1; shift; set -- $line "$@"; kind=$1; name=$2; shift 2; $kind "$name" "$@"' _ {} "$@"
count() { [ "$1" = "-" ] && echo 0 || ls "$OUT/$2/$TAG" | grep -cE "$3"; }
echo "done $TAG: $(count "$CLEAN" sim '\.json$') clean, $(count "$PLANTED" planted '\.s[0-9]+\.json$') planted"
