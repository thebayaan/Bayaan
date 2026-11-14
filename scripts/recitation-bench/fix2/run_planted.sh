#!/bin/bash
# Planted (spliced) recitations through the follower and the live check:
#   fix2/run_planted.sh <tag> <jobs> <seed> [extra sim.mjs args...]
# Files whose Quran.com word timings sit more than 0.3 s from the checker's own word
# times (.out/fix2/qdc_offsets.json, from offset_check.mjs) are left out: the splices would
# not fall on words. Surah 18 is left out for its length. The first call for a tag copies
# the live check's sources into .out/fix2/planted/<tag>/live (LIVE_SRC=<dir> to copy from
# elsewhere); ONLY=<regex> keeps only matching names. Finished files are skipped.
# CACHE_PREFIX is passed on to planted.sh. Score with score_planted.mjs.
set -uo pipefail
if [ $# -lt 3 ]; then
  echo 'usage: fix2/run_planted.sh <tag> <jobs> <seed> [extra sim.mjs args...]' >&2
  exit 2
fi
FIX2="$(cd "$(dirname "$0")" && pwd)"
OUT="$FIX2/../.out/fix2"
TAG=$1; JOBS=$2; SEED=$3; shift 3
# A tag is a folder name under .out/fix2: never empty, never '.' or '..', no '/'.
bad_tag() { case $1 in ''|.*|*[!A-Za-z0-9._-]*) return 0 ;; esac; return 1; }
bad_num() { case $1 in ''|*[!0-9]*) return 0 ;; esac; return 1; }
if bad_tag "$TAG" || bad_num "$JOBS" || bad_num "$SEED"; then
  echo 'usage: fix2/run_planted.sh <tag> <jobs> <seed> [extra sim.mjs args...]' >&2
  exit 2
fi
mkdir -p "$OUT/planted/$TAG"
[ -s "$OUT/planted/$TAG/live/check.ts" ] || node "$FIX2/build_live.mjs" --snapshot "$OUT/planted/$TAG/live" ${LIVE_SRC:+"$LIVE_SRC"}
NAMES=$(python3 -I -c "
import json,sys
o=json.load(open(sys.argv[1]))
print(' '.join(n for n,v in sorted(o.items()) if abs(v.get('endMed') or 0)<=0.3 and abs(v.get('startMed') or 0)<=0.3 and not n.endswith('_18')))" "$OUT/qdc_offsets.json")
export FIX2 TAG SEED CACHE_PREFIX
echo $NAMES | tr ' ' '\n' | grep -E "${ONLY:-.}" | xargs -P "$JOBS" -I{} bash -c '"$FIX2/planted.sh" {} "$SEED" "$TAG" "$@"' _ "$@"
