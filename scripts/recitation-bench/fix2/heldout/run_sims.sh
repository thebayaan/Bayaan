#!/bin/bash
# The live check on the held-out pool (voices never used for tuning: report only):
#   fix2/heldout/run_sims.sh <tag> <jobs> <quiet|noise> [extra sim.mjs args...]
# Needs the follower's runs from run_follower.sh in the same mode. Writes
# .out/fix2/sim_heldout/<tag>/<id>.json (quiet) or <id>.n10.json (noise, mixed again
# exactly as run_follower.sh mixes it, and deleted after). Finished clips are skipped.
# The first call for a tag copies the check's three source files into
# .out/fix2/sim_heldout/<tag>/live from LIVE_SRC (default the repo's
# services/recitation/liveCheck). Model outputs are cached under the key
# heldout.<id>[.n10] (after CACHE_PREFIX if set). DRY=1 only lists each clip, whether its
# audio and follower run are there and whether it is done. Report with report.py.
set -uo pipefail
if [ $# -lt 3 ] || { [ "$3" != quiet ] && [ "$3" != noise ]; }; then
  echo 'usage: fix2/heldout/run_sims.sh <tag> <jobs> <quiet|noise> [extra sim.mjs args...]' >&2
  exit 2
fi
HERE="$(cd "$(dirname "$0")" && pwd)"
FIX2="$HERE/.."
BENCH="$FIX2/.."
OUT="$BENCH/.out/fix2"
TAG=$1; JOBS=$2; MODE=$3; shift 3
# A tag is a folder name under .out/fix2: never empty, never '.' or '..', no '/'.
bad_tag() { case $1 in ''|.*|*[!A-Za-z0-9._-]*) return 0 ;; esac; return 1; }
bad_num() { case $1 in ''|*[!0-9]*) return 0 ;; esac; return 1; }
if bad_tag "$TAG" || bad_num "$JOBS"; then
  echo 'usage: fix2/heldout/run_sims.sh <tag> <jobs> <quiet|noise> [extra sim.mjs args...]' >&2
  exit 2
fi
SUF=""; [ "$MODE" = noise ] && SUF=".n10"
D="$OUT/sim_heldout/$TAG"
MANIFEST="$OUT/data/heldout_pool/manifest.json"
[ -s "$MANIFEST" ] || { echo "no manifest $MANIFEST (fix2/stage/stage_heldout.py)" >&2; exit 1; }
clips() {
  python3 -I -c "
import json, sys
for c in json.load(open(sys.argv[1]))['clips']:
    print(c['id'], c['audio'])
" "$MANIFEST"
}
if [ -n "${DRY:-}" ]; then
  clips | while read -r ID AUDIO; do
    echo "$ID$SUF audio=$([ -s "$AUDIO" ] && echo yes || echo MISSING) run=$([ -s "$OUT/runs_heldout/$ID$SUF.json" ] && echo yes || echo MISSING) sim=$([ -s "$D/$ID$SUF.json" ] && echo done || echo todo)"
  done
  exit 0
fi
# The lab's run_heldout_sims.sh read SRC: still taken when LIVE_SRC is not set.
if [ -z "${LIVE_SRC:-}" ] && [ -n "${SRC:-}" ]; then
  echo "note: SRC is read as LIVE_SRC" >&2
  LIVE_SRC=$SRC
fi
mkdir -p "$D" "$OUT/tmp"
[ -s "$D/live/check.ts" ] || node "$FIX2/build_live.mjs" --snapshot "$D/live" ${LIVE_SRC:+"$LIVE_SRC"}
one() {
  local ID=$1 AUDIO=$2; shift 2
  local RES="$D/$ID$SUF.json" RUN="$OUT/runs_heldout/$ID$SUF.json"
  [ -s "$RES" ] && return 0
  [ -s "$RUN" ] || { echo "no follower run for $ID$SUF"; return 0; }
  local A="$AUDIO"
  if [ -n "$SUF" ]; then
    A="$D/$ID$SUF.f32"
    if ! { nice -n 10 python3 -I "$HERE/mix_speech.py" "$AUDIO" "$A.speech" "$ID" && TMPDIR="$OUT/tmp" nice -n 10 bash "$BENCH/noise.sh" "$AUDIO" "$A" babble 10 "$A.speech"; }; then
      echo "FAIL mix $ID"; rm -f "$A.speech" "$A"; return 0
    fi
    rm -f "$A.speech"
  fi
  ORT_THREADS=1 nice -n 10 node "$FIX2/sim.mjs" "$ID" --audio "$A" --run "$RUN" --cachekey "${CACHE_PREFIX:-}heldout.$ID$SUF" --check "$D/live" --keep 1 --out "$RES" "$@" 2>&1 | tail -1
  [ -n "$SUF" ] && rm -f "$A"
  return 0
}
export -f one; export HERE FIX2 BENCH OUT D SUF CACHE_PREFIX
clips | xargs -P "$JOBS" -I{} bash -c 'line=$1; shift; set -- $line "$@"; one "$@"' _ {} "$@"
if [ -n "$SUF" ]; then
  echo "done $TAG $MODE: $(ls "$D" | grep -c '\.n10\.json$')"
else
  echo "done $TAG $MODE: $(ls "$D" | grep '\.json$' | grep -vc '\.n10\.json$')"
fi
