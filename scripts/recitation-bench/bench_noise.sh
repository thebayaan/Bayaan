#!/bin/bash
# Noise bench: the clean recitations and planted cases from bench.sh, with
# noise mixed in, through the app's flow, scored like bench.sh.
#
#   scripts/recitation-bench/bench_noise.sh <kind> <snr_db> [dwell]
#
# kind: none | pink | hum | babble (two other reciters behind the reader).
# Run bench.sh first: it fetches the model and audio and plants the cases.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/.out"
KIND=$1
SNR=$2
DWELL=${3:-2}
AYAT=30
RUNS="$OUT/runs"
COND="$OUT/noise/${KIND}_${SNR}db_dwell${DWELL}"
BABBLE="$OUT/noise/babble.f32"
mkdir -p "$COND"

for RID in 7 2 3 6; do
  cp "$RUNS/qdc_$RID.json" "$COND/"
  mkdir -p "$COND/cases_$RID"
  cp "$RUNS/cases_$RID/cases.json" "$COND/cases_$RID/"
  TMP="$COND/tmp_$RID.f32"
  "$HERE/noise.sh" "$OUT/audio_${RID}_67.f32" "$TMP" "$KIND" "$SNR" "$BABBLE"
  node "$HERE/bench.mjs" --audio "$TMP" --timings "$RUNS/qdc_$RID.json" --ayat $AYAT --dwell "$DWELL" --json "$COND/clean_$RID.json" > /dev/null
  for C in $(python3 -I -c "import json,sys;print(' '.join(c['name'] for c in json.load(open(sys.argv[1]))))" "$RUNS/cases_$RID/cases.json"); do
    "$HERE/noise.sh" "$RUNS/cases_$RID/$C.f32" "$TMP" "$KIND" "$SNR" "$BABBLE"
    node "$HERE/bench.mjs" --audio "$TMP" --ayat $AYAT --dwell "$DWELL" --json "$COND/${RID}__$C.json" > /dev/null
  done
  rm -f "$TMP"
done
echo "== $KIND ${SNR} dB, dwell $DWELL"
python3 -I "$HERE/score.py" "$COND"
