#!/usr/bin/env bash
# Finds which Vega dependency stops an app from launching.
#
# Builds Amazon's Hello World once per variant: plain, plus one variant per
# @amazon-devices module that tv-vega uses (at tv-vega's installed version),
# plus one with tv-vega's manifest. Then installs and launches each on the
# running Vega Virtual Device and reports whether it is still running.
#
# Usage: ci-probe-modules.sh <work-dir> <out-dir>
set -uo pipefail

WORK=${1:?usage: ci-probe-modules.sh <work-dir> <out-dir>}
OUT=${2:?usage: ci-probe-modules.sh <work-dir> <out-dir>}
TV_VEGA=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$WORK" "$OUT"

MODULES=(
  expo-image
  react-native-svg
  shopify__flash-list
  react-native-w3cmedia
  kepler-media-controls
  react-native-async-storage__async-storage
)

installed_version() {
  node -p "require('$TV_VEGA/node_modules/@amazon-devices/$1/package.json').version"
}

make_variant() {
  local name=$1 pkg=com.bayaan.probe${1//[^a-z0-9]/}
  local dir=$WORK/$name
  vega project generate -t helloWorld -n "probe" --packageId "$pkg" -o "$dir" >/dev/null
  echo "$pkg" >"$dir/.probe-pkg"
}

build_variant() {
  local dir=$WORK/$1
  (cd "$dir" && npm install --legacy-peer-deps --no-audit --no-fund >"$OUT/install-$1.log" 2>&1 && npm run build:release >"$OUT/build-$1.log" 2>&1) ||
    echo "build failed: $1"
}

make_variant plain

for module in "${MODULES[@]}"; do
  make_variant "$module"
  dir=$WORK/$module
  version=$(installed_version "$module")
  (cd "$dir" && npm install --legacy-peer-deps --no-audit --no-fund "@amazon-devices/$module@$version" >/dev/null 2>&1) ||
    echo "npm install failed: $module@$version"
  # A side-effect import is enough to bundle the module and its manifest needs.
  printf "import '@amazon-devices/%s';\n%s" "$module" "$(cat "$dir/index.js")" >"$dir/index.js"
done

make_variant manifest
sed "s/com\.bayaan\.tvsmoke/com.bayaan.probemanifest/g" "$TV_VEGA/manifest.toml" >"$WORK/manifest/manifest.toml"

for dir in "$WORK"/*/; do
  build_variant "$(basename "$dir")"
done

VDA=$(ls ~/vega/sdk/vega-sdk/*/*/bin/tools/vda | head -1)
: >"$OUT/results.txt"
for dir in "$WORK"/*/; do
  name=$(basename "$dir")
  pkg=$(cat "$dir/.probe-pkg")
  vpkg=$(find "$dir/build" -path '*x86_64/Release/*.vpkg' 2>/dev/null | head -1)
  if [[ -z "$vpkg" ]]; then
    echo "$name: no vpkg (build failed)" | tee -a "$OUT/results.txt"
    continue
  fi
  timeout 300 vega device install-app -p "$vpkg" >/dev/null 2>&1
  timeout 120 "$VDA" wait-for-device
  sleep 5
  vega device launch-app -a "$pkg.main" >/dev/null 2>&1 || {
    sleep 10
    vega device launch-app -a "$pkg.main" >/dev/null 2>&1
  }
  sleep 15
  status=$(vega device is-app-running -a "$pkg.main" 2>&1 | tail -1)
  echo "$name: $status" | tee -a "$OUT/results.txt"
  vega device terminate-app -a "$pkg.main" >/dev/null 2>&1 || true
done
