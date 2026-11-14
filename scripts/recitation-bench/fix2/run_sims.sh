#!/bin/bash
# The live check over the staged clean pool:
#   fix2/run_sims.sh <tag> <jobs> [extra sim.mjs args...]
# Results in .out/fix2/sim/<tag>/<name>.json; finished ones are skipped. The first call
# for a tag copies the live check's three source files into .out/fix2/sim/<tag>/live, and
# every run of that tag uses the copy, so a tag keeps the check it started with.
# LIVE_SRC=<dir> copies from another folder; NAMES=<regex> keeps only matching names.
# Model outputs are cached under the key <name> (.out/fix2/cache); CACHE_PREFIX=<p> puts
# them under <p><name> instead, for runs that must not touch the usual keys.
set -uo pipefail
if [ $# -lt 2 ]; then
  echo 'usage: fix2/run_sims.sh <tag> <jobs> [extra sim.mjs args...]' >&2
  exit 2
fi
FIX2="$(cd "$(dirname "$0")" && pwd)"
OUT="$FIX2/../.out/fix2"
TAG=$1; JOBS=$2; shift 2
# A tag is a folder name under .out/fix2: never empty, never '.' or '..', no '/'.
bad_tag() { case $1 in ''|.*|*[!A-Za-z0-9._-]*) return 0 ;; esac; return 1; }
bad_num() { case $1 in ''|*[!0-9]*) return 0 ;; esac; return 1; }
if bad_tag "$TAG" || bad_num "$JOBS"; then
  echo 'usage: fix2/run_sims.sh <tag> <jobs> [extra sim.mjs args...]' >&2
  exit 2
fi
mkdir -p "$OUT/sim/$TAG"
[ -s "$OUT/sim/$TAG/live/check.ts" ] || node "$FIX2/build_live.mjs" --snapshot "$OUT/sim/$TAG/live" ${LIVE_SRC:+"$LIVE_SRC"}
one() {
  local N=$1; shift
  [ -s "$OUT/sim/$TAG/$N.json" ] && return 0
  [ -s "$OUT/runs/$N.json" ] || return 0
  ORT_THREADS=1 nice -n 10 node "$FIX2/sim.mjs" "$N" --check "$OUT/sim/$TAG/live" --keep 1 --cachekey "${CACHE_PREFIX:-}$N" --out "$OUT/sim/$TAG/$N.json" "$@" 2>&1 | tail -1
}
export -f one; export FIX2 OUT TAG CACHE_PREFIX
ls "$OUT/qdc/" | grep '\.f32$' | sed 's/\.f32$//' | grep -E "${NAMES:-.}" | xargs -P "$JOBS" -I{} bash -c 'one "$@"' _ {} "$@"
