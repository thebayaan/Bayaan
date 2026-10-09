#!/usr/bin/env bash
# Finds which Vega dependency stops an app from launching.
#
# Builds launch probes: Amazon's Hello World plain and with every
# @amazon-devices module tv-vega uses (at tv-vega's installed versions), and
# tv-vega itself with a trivial entry point and with only storage hydration.
# Then installs and launches each on the running Vega Virtual Device and
# reports whether it is still running. (Each module alone, and tv-vega's
# manifest alone, already launched fine.)
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
  if [[ -f "$dir/.probe-dir" ]]; then
    (cd "$(cat "$dir/.probe-dir")" && npm run build:release >"$OUT/build-$1.log" 2>&1) || echo "build failed: $1"
    return
  fi
  (cd "$dir" && npm install --legacy-peer-deps --no-audit --no-fund >"$OUT/install-$1.log" 2>&1 && npm run build:release >"$OUT/build-$1.log" 2>&1) ||
    echo "build failed: $1"
}

make_variant plain

# Every module at once, matching Bayaan's set of system bundles.
make_variant all-modules
dir=$WORK/all-modules
specs=()
for module in "${MODULES[@]}"; do
  specs+=("@amazon-devices/$module@$(installed_version "$module")")
  printf "import '@amazon-devices/%s';\n%s" "$module" "$(cat "$dir/index.js")" >"$dir/index.js"
done
(cd "$dir" && npm install --legacy-peer-deps --no-audit --no-fund "${specs[@]}" >/dev/null 2>&1) ||
  echo "npm install failed: all-modules"

# tv-vega itself with a replaced entry point. Copies sit next to tv-vega so
# its Metro config still finds the repo root.
make_host_variant() {
  local name=$1 pkg=com.bayaan.probe${1//[^a-z0-9]/}
  local dir
  dir="$(dirname "$TV_VEGA")/tv-vega-probe-$name"
  rm -rf "$dir"
  cp -a "$TV_VEGA" "$dir"
  rm -rf "$dir/build"
  sed -i "s/com\.bayaan\.tvsmoke/$pkg/g" "$dir/manifest.toml" "$dir/app.json"
  cat >"$dir/index.js"
  mkdir -p "$WORK/$name"
  echo "$pkg" >"$WORK/$name/.probe-pkg"
  echo "$dir" >"$WORK/$name/.probe-dir"
}

make_host_variant host-trivial <<'JS'
import React from 'react';
import {AppRegistry, View} from 'react-native';
import {name as appName} from './app.json';

function Root() {
  return React.createElement(View, {style: {flex: 1, backgroundColor: '#11181f'}});
}

AppRegistry.registerComponent(appName, () => Root);
JS

make_host_variant host-hydrate <<'JS'
import React, {useEffect, useState} from 'react';
import {AppRegistry, View} from 'react-native';
import {hydrateStorage} from '../tv-app/services/storage';
import {name as appName} from './app.json';

function Root() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    hydrateStorage().finally(() => setReady(true));
  }, []);
  return React.createElement(View, {style: {flex: 1, backgroundColor: ready ? '#11181f' : '#000'}});
}

AppRegistry.registerComponent(appName, () => Root);
JS

for dir in "$WORK"/*/; do
  build_variant "$(basename "$dir")"
done

VDA=$(ls ~/vega/sdk/vega-sdk/*/*/bin/tools/vda | head -1)
: >"$OUT/results.txt"
for dir in "$WORK"/*/; do
  name=$(basename "$dir")
  pkg=$(cat "$dir/.probe-pkg")
  build_dir=$dir
  [[ -f "$dir/.probe-dir" ]] && build_dir=$(cat "$dir/.probe-dir")
  vpkg=$(find "$build_dir/build" -path '*x86_64/Release/*.vpkg' 2>/dev/null | head -1)
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
