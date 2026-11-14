#!/bin/bash
# Staged dev recitations with background speech at 10 dB: the follower, then the live
# check, on the mixed audio (heldout/mix_speech.py and the bench's noise.sh).
#   fix2/run_dev_noise.sh <tag> <jobs> [extra sim.mjs args...]     (NAMES=<regex> picks files)
# Writes .out/fix2/runs_noise/<name>.n10.json (the follower's run, kept) and
# .out/fix2/sim/<tag>/<name>.json, named as a clean file so the reports read it. The
# mixed audio is deleted after each file. The first call for a tag copies the check's
# source into sim/<tag>/live from LIVE_SRC (default the repo's
# services/recitation/liveCheck). Model outputs are cached under noise.<name>.
set -uo pipefail
if [ $# -lt 2 ]; then
  echo 'usage: fix2/run_dev_noise.sh <tag> <jobs> [extra sim.mjs args...]' >&2
  exit 2
fi
HERE="$(cd "$(dirname "$0")" && pwd)"
BENCH="$HERE/.."
OUT="$BENCH/.out/fix2"
TAG=$1; JOBS=$2; shift 2
case $TAG in ''|.*|*[!A-Za-z0-9._-]*) echo 'bad tag' >&2; exit 2 ;; esac
case $JOBS in ''|*[!0-9]*) echo 'bad job count' >&2; exit 2 ;; esac
LIVE_SRC=${LIVE_SRC:-$BENCH/../../services/recitation/liveCheck}
mkdir -p "$OUT/runs_noise" "$OUT/sim/$TAG/live"
[ -s "$OUT/sim/$TAG/live/check.ts" ] || cp "$LIVE_SRC/"{reading,laying,check,types}.ts "$OUT/sim/$TAG/live/"
one() {
  local N=$1; shift
  local RESULT="$OUT/sim/$TAG/$N.json" RUN="$OUT/runs_noise/$N.n10.json" A="$OUT/runs_noise/$N.$TAG.f32"
  [ -s "$RESULT" ] && return 0
  python3 -I "$HERE/heldout/mix_speech.py" "$OUT/qdc/$N.f32" "$A.babble" "$N" \
    && bash "$BENCH/noise.sh" "$OUT/qdc/$N.f32" "$A" babble 10 "$A.babble" \
    || { echo "FAIL mix $N"; rm -f "$A.babble" "$A"; return 0; }
  rm -f "$A.babble"
  if [ ! -s "$RUN" ]; then
    ORT_THREADS=1 nice -n 5 node "$BENCH/bench.mjs" --audio "$A" --dwell 2 --json "$RUN" > /dev/null 2>&1 \
      || { echo "FAIL follower $N"; rm -f "$A"; return 0; }
  fi
  ORT_THREADS=1 nice -n 5 node "$HERE/sim.mjs" "$N" --audio "$A" --run "$RUN" --cachekey "${CACHE_PREFIX:-}noise.$N" \
    --check "$OUT/sim/$TAG/live" --keep 1 --out "$RESULT" "$@" 2>&1 | tail -1
  rm -f "$A"
}
export -f one; export HERE BENCH OUT TAG
ls "$OUT/qdc/" | grep '\.f32$' | sed 's/\.f32$//' | grep -E "${NAMES:-.}" | xargs -P "$JOBS" -I{} bash -c 'one "$@"' _ {} "$@"
echo "done $TAG"
