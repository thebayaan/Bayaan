#!/bin/bash
# The planted-mistake corpus (as build_corpus.sh, same seeds and truth) with
# noise mixed in, for scoring catches and false marks under noise:
#
#   scripts/recitation-bench/build_noise_corpus.sh <kind> <snr dB> [jobs]
#
# kind: babble | pink | hum (noise.sh). Writes .out/corpus/noise_<kind><snr>/,
# or .out/corpus/$NAME/ when NAME is set (e.g. to keep an engine variant's
# runs apart). Uses 9 reciters x surahs 67 78, clean and seed 1. Audio is
# deleted after each run. Honours TILAWA_DIST / ENGINE_OPTS / ORT_THREADS like
# bench.mjs.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/.out"
KIND=$1
SNR=$2
JOBS=${3:-3}
NAME=${NAME:-noise_${KIND}${SNR}}
DEST="$OUT/corpus/$NAME"
mkdir -p "$DEST"
one() {
  local RID=$1 SURAH=$2 VAR=$3
  local T="$OUT/runs/qdc_${RID}_${SURAH}.json"
  [ -f "$T" ] || T="$OUT/runs/qdc_$RID.json"
  local BASE="$DEST/${RID}_${SURAH}_${VAR}"
  [ -f "$BASE.json" ] && return 0
  local SRC="$OUT/audio_${RID}_${SURAH}.f32"
  if [ "$VAR" != clean ]; then
    local SEED=${VAR#s}
    python3 -I "$HERE/mutate2.py" "$SRC" "$T" "$BASE.src.f32" "$BASE.truth.json" "$SEED$RID$SURAH" > /dev/null
    SRC="$BASE.src.f32"
  fi
  "$HERE/noise.sh" "$SRC" "$BASE.f32" "$KIND" "$SNR" "$OUT/noise/babble.f32"
  node "$HERE/bench.mjs" --audio "$BASE.f32" --dwell 2 --json "$BASE.json" > /dev/null
  rm -f "$BASE.f32" "$BASE.src.f32"
  echo "done $RID $SURAH $VAR"
}
export -f one
export OUT DEST HERE KIND SNR
for RID in 7 2 3 6 9 10 97 4 5; do for SURAH in 67 78; do for VAR in clean s1; do
  echo "$RID $SURAH $VAR"; done; done; done | xargs -P "$JOBS" -L 1 bash -c 'one $0 $1 $2'
