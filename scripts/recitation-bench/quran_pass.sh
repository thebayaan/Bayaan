#!/bin/bash
# Whole-Quran clean pass for one reciter: every surah from Quran.com,
# through the app's flow, one JSON per surah in .out/quran/<reciter>/.
# Audio is fetched, run and deleted surah by surah. Used to find words the
# engine misjudges for everyone (systematic false marks and vowel flags).
#
#   scripts/recitation-bench/quran_pass.sh <reciter id> [first surah] [last surah]
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
RID=$1
FIRST=${2:-1}
LAST=${3:-114}
DEST="$HERE/.out/quran/$RID"
TMP="$HERE/.out/quran/tmp_$RID"
mkdir -p "$DEST" "$TMP"
for S in $(seq "$FIRST" "$LAST"); do
  [ -f "$DEST/$S.json" ] && continue
  T="$DEST/qdc_$S.json"
  [ -s "$T" ] || curl -sS -o "$T" "https://api.qurancdn.com/api/qdc/audio/reciters/$RID/audio_files?chapter=$S&segments=true"
  URL=$(python3 -I -c "import json,sys;print(json.load(open(sys.argv[1]))['audio_files'][0]['audio_url'])" "$T") || continue
  curl -sSL -o "$TMP/a.mp3" "$URL" && ffmpeg -loglevel error -y -i "$TMP/a.mp3" -ac 1 -ar 16000 -f f32le "$TMP/a.f32" &&
    node "$HERE/bench.mjs" --audio "$TMP/a.f32" --timings "$T" --dwell 2 --json "$DEST/$S.json" > /dev/null
  rm -f "$TMP/a.mp3" "$TMP/a.f32"
  echo "reciter $RID surah $S done"
done
