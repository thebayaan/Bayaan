#!/bin/bash
# Recitation bench: real Quran.com recitations, clean and with planted
# mistakes, through the app's recognition engine and mark rules.
#
#   scripts/recitation-bench/bench.sh [reciter ids...]   (default: 7 2 3 6)
#
# Needs ffmpeg, python3 and node. Everything downloaded or produced goes to
# scripts/recitation-bench/.out (git-ignored): the model and corpus (the same
# release files the app downloads), reciter audio and word timings from
# Quran.com, planted cases, and one JSON per run. Surah: Al-Mulk (67).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/.out"
SURAH=67
AYAT=30
DWELL=2 # as COMMIT_DWELL in services/recitation/recitationEngine.ts
RECITERS=("${@:-7 2 3 6}")
[ $# -eq 0 ] && RECITERS=(7 2 3 6)

MODEL_URL="https://github.com/yazinsai/tilawa/releases/download/zipformer-a0w-ep1-a0.5/zipformer_a0w_ep1_a05.int8.onnx"
CORPUS_URL="https://github.com/yazinsai/tilawa/releases/download/v0.3.0/zipformer_quran.json"

mkdir -p "$OUT/assets" "$OUT/runs"
[ -d "$HERE/node_modules/onnxruntime-node" ] || (cd "$HERE" && npm install --no-audit --no-fund --silent)
[ -f "$OUT/assets/zipformer_a0w_ep1_a05.int8.onnx" ] || curl -sSL -o "$OUT/assets/zipformer_a0w_ep1_a05.int8.onnx" "$MODEL_URL"
[ -f "$OUT/assets/zipformer_quran.json" ] || curl -sSL -o "$OUT/assets/zipformer_quran.json" "$CORPUS_URL"

RUNS="$OUT/runs"
for RID in "${RECITERS[@]}"; do
  T="$RUNS/qdc_$RID.json"
  [ -f "$T" ] || curl -sS -o "$T" "https://api.qurancdn.com/api/qdc/audio/reciters/$RID/audio_files?chapter=$SURAH&segments=true"
  A="$OUT/audio_${RID}_$SURAH"
  if [ ! -f "$A.f32" ]; then
    URL=$(python3 -I -c "import json,sys;print(json.load(open(sys.argv[1]))['audio_files'][0]['audio_url'])" "$T")
    curl -sSL -o "$A.mp3" "$URL"
    ffmpeg -loglevel error -y -i "$A.mp3" -ac 1 -ar 16000 -f f32le "$A.f32"
  fi
  python3 -I "$HERE/mutate.py" "$A.f32" "$T" "$RUNS/cases_$RID" > /dev/null
  node "$HERE/bench.mjs" --audio "$A.f32" --timings "$T" --ayat $AYAT --dwell $DWELL --json "$RUNS/clean_$RID.json" > /dev/null
  for C in $(python3 -I -c "import json,sys;print(' '.join(c['name'] for c in json.load(open(sys.argv[1]))))" "$RUNS/cases_$RID/cases.json"); do
    node "$HERE/bench.mjs" --audio "$RUNS/cases_$RID/$C.f32" --ayat $AYAT --dwell $DWELL --json "$RUNS/${RID}__$C.json" > /dev/null
  done
  echo "reciter $RID done"
done
python3 -I "$HERE/score.py" "$RUNS"
