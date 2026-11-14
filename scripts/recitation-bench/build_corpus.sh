#!/bin/bash
# Large bench corpus: several reciters and surahs, each as a clean
# recitation and as recitations with many planted events (mutate2.py),
# run through the app's flow. Score with replay2.mjs.
#
#   scripts/recitation-bench/build_corpus.sh [out folder name] [parallel jobs]
#
# Needs bench.sh's model download. Audio is fetched from Quran.com and kept
# in .out/audio_<reciter>_<surah>.f32; planted variants are deleted after
# their run, only the run JSON and its .truth.json are kept.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/.out"
NAME=${1:-main}
JOBS=${2:-3}
DEST="$OUT/corpus/$NAME"
RECITERS="7 2 3 6 9 10 97 4 5"
SURAHS="67 78 36 55 89"
SEEDS="1 2"
DWELL=2
mkdir -p "$DEST"

one() {
  local RID=$1 SURAH=$2
  local T="$OUT/runs/qdc_${RID}_${SURAH}.json"
  [ "$SURAH" = 67 ] && [ -f "$OUT/runs/qdc_$RID.json" ] && T="$OUT/runs/qdc_$RID.json"
  [ -s "$T" ] || curl -sS -o "$T" "https://api.qurancdn.com/api/qdc/audio/reciters/$RID/audio_files?chapter=$SURAH&segments=true"
  local A="$OUT/audio_${RID}_${SURAH}"
  if [ ! -f "$A.f32" ]; then
    local URL
    URL=$(python3 -I -c "import json,sys;print(json.load(open(sys.argv[1]))['audio_files'][0]['audio_url'])" "$T")
    curl -sSL -o "$A.mp3" "$URL"
    ffmpeg -loglevel error -y -i "$A.mp3" -ac 1 -ar 16000 -f f32le "$A.f32"
  fi
  local AYAT
  AYAT=$(python3 -I -c "import json,sys;print(len(json.load(open(sys.argv[1]))['audio_files'][0]['verse_timings']))" "$T")
  local BASE="$DEST/${RID}_${SURAH}"
  [ -f "${BASE}_clean.json" ] || node "$HERE/bench.mjs" --audio "$A.f32" --timings "$T" --ayat "$AYAT" --dwell $DWELL --json "${BASE}_clean.json" > /dev/null
  for SEED in $SEEDS; do
    [ -f "${BASE}_s$SEED.json" ] && continue
    python3 -I "$HERE/mutate2.py" "$A.f32" "$T" "${BASE}_s$SEED.f32" "${BASE}_s$SEED.truth.json" "$SEED$RID$SURAH" > /dev/null
    node "$HERE/bench.mjs" --audio "${BASE}_s$SEED.f32" --ayat "$AYAT" --dwell $DWELL --json "${BASE}_s$SEED.json" > /dev/null
    rm -f "${BASE}_s$SEED.f32"
  done
  echo "done $RID $SURAH"
}
export -f one
export OUT DEST DWELL SEEDS HERE
for RID in $RECITERS; do for SURAH in $SURAHS; do echo "$RID $SURAH"; done; done |
  xargs -P "$JOBS" -L 1 bash -c 'one $0 $1'
node "$HERE/replay2.mjs" "$DEST"
