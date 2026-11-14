#!/bin/bash
# Resumable download of the Al-Ikhlas zip (Mendeley, CC BY 4.0) + sha256 check.
set -euo pipefail
D="$(cd "$(dirname "$0")/../.." && pwd)/.out/fix2/data"
Z=$D/_dl/ikhlas/ikhlas.zip
URL=https://data.mendeley.com/public-files/datasets/sxtmmr6mvk/files/ec1b3a42-700d-4424-b6cd-6844828f4637/file_downloaded
SHA=de8042ac8cc137e83fdcdbed375a24bd51f873c94f7f2cca1e39c60b188c0068
mkdir -p "$(dirname $Z)"
if [ -f $D/_dl/ikhlas/.verified ]; then echo already verified; exit 0; fi
for i in 1 2 3 4 5; do
  curl -sSL --fail --retry 4 --retry-delay 5 -C - -o "$Z" "$URL" && break || sleep $((i*10))
done
sz=$(stat -c %s "$Z"); echo size $sz
[ "$sz" = 439820286 ] || { echo bad size; exit 1; }
echo "$SHA  $Z" | sha256sum -c - && touch $D/_dl/ikhlas/.verified
