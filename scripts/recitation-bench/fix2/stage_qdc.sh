#!/bin/bash
# Stages Quran.com surah audio with word timings:
#   fix2/stage_qdc.sh "<reciter ids>" "<surahs>"
# Writes .out/fix2/qdc/<rid>_<surah>.f32 (16 kHz mono float32) and <rid>_<surah>.json
# (the timings). Files already there are kept. Three downloads at a time.
set -uo pipefail
if [ $# -lt 2 ]; then
  echo 'usage: fix2/stage_qdc.sh "<reciter ids>" "<surahs>"' >&2
  exit 2
fi
D="$(cd "$(dirname "$0")/.." && pwd)/.out/fix2/qdc"
mkdir -p "$D"
one() {
  local RID=$1 S=$2 T="$D/${1}_${2}.json" A="$D/${1}_${2}"
  [ -s "$T" ] || curl -sS --fail --retry 4 --retry-delay 2 -o "$T" "https://api.qurancdn.com/api/qdc/audio/reciters/$RID/audio_files?chapter=$S&segments=true" || { echo "FAIL timings $RID $S"; rm -f "$T"; return 0; }
  if [ ! -s "$A.f32" ]; then
    local URL
    URL=$(python3 -I -c "import json,sys;print(json.load(open(sys.argv[1]))['audio_files'][0]['audio_url'])" "$T") || { echo "FAIL url $RID $S"; return 0; }
    curl -sSL --fail --retry 4 --retry-delay 2 -o "$A.mp3" "$URL" || { echo "FAIL audio $RID $S"; rm -f "$A.mp3"; return 0; }
    nice -n 10 ffmpeg -nostdin -loglevel error -y -i "$A.mp3" -ac 1 -ar 16000 -f f32le "$A.f32.tmp" && mv "$A.f32.tmp" "$A.f32"
    rm -f "$A.mp3"
  fi
  echo "ok $RID $S"
}
export -f one; export D
for RID in $1; do for S in $2; do echo "$RID $S"; done; done | xargs -P 3 -L 1 bash -c 'one $0 $1'
