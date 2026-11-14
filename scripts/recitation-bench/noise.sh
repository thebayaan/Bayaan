#!/bin/bash
# noise.sh <in.f32> <out.f32> <pink|hum|babble> <snr_db> [babble.f32]
# Mixes noise into 16 kHz mono f32 speech at a given signal-to-noise ratio
# (speech mean level minus noise mean level, as ffmpeg's volumedetect
# measures them), then applies a phone-mic band (200-5000 Hz).
set -euo pipefail
IN=$1; OUT=$2; KIND=$3; SNR=$4; BABBLE=${5:-}
if [ "$KIND" = none ]; then cp "$IN" "$OUT"; exit 0; fi
SR=16000
mean_db() { ffmpeg -hide_banner -nostats -f f32le -ar $SR -ac 1 -i "$1" -af volumedetect -f null - 2>&1 | sed -n 's/.*mean_volume: \(-*[0-9.]*\) dB/\1/p'; }
DUR=$(python3 -I -c "import os,sys;print(os.path.getsize(sys.argv[1])/4/$SR)" "$IN")
TMP=$(mktemp -d "${TMPDIR:-/tmp}/noise.XXXXXX")
case $KIND in
  pink) ffmpeg -loglevel error -y -f lavfi -i "anoisesrc=color=pink:amplitude=0.3:sample_rate=$SR:duration=$DUR" -ac 1 -f f32le "$TMP/n.f32" ;;
  hum) ffmpeg -loglevel error -y -f lavfi -i "anoisesrc=color=brown:amplitude=0.5:sample_rate=$SR:duration=$DUR" -f lavfi -i "sine=frequency=100:sample_rate=$SR:duration=$DUR" -filter_complex "[0][1]amix=inputs=2:normalize=0" -ac 1 -f f32le "$TMP/n.f32" ;;
  babble) ffmpeg -loglevel error -y -stream_loop -1 -f f32le -ar $SR -ac 1 -i "$BABBLE" -t "$DUR" -ac 1 -f f32le "$TMP/n.f32" ;;
  *) echo "unknown noise $KIND"; exit 1 ;;
esac
S=$(mean_db "$IN"); N=$(mean_db "$TMP/n.f32")
GAIN=$(python3 -I -c "import sys;print(float(sys.argv[1])-float(sys.argv[2])-float(sys.argv[3]))" "$S" "$SNR" "$N")
ffmpeg -loglevel error -y -f f32le -ar $SR -ac 1 -i "$IN" -f f32le -ar $SR -ac 1 -i "$TMP/n.f32" \
  -filter_complex "[1]volume=${GAIN}dB[n];[0][n]amix=inputs=2:duration=first:normalize=0,highpass=f=200,lowpass=f=5000" \
  -ac 1 -ar $SR -f f32le "$OUT"
rm -rf "$TMP"
