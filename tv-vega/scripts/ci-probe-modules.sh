#!/usr/bin/env bash
# Finds which Vega dependency stops an app from launching.
#
# Builds launch probes: Amazon's Hello World as a baseline, and tv-vega with
# entry points that load progressively more of the shared app. Then installs
# and launches each on the running Vega Virtual Device and reports whether it
# is still running. (Earlier rounds ruled out each module alone, all modules
# together, tv-vega's manifest, and the tv-vega host with storage hydration.)
#
# Usage: ci-probe-modules.sh <work-dir> <out-dir>
set -uo pipefail

WORK=${1:?usage: ci-probe-modules.sh <work-dir> <out-dir>}
OUT=${2:?usage: ci-probe-modules.sh <work-dir> <out-dir>}
TV_VEGA=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$WORK" "$OUT"

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

# Bisect the shared app: each variant hydrates storage, then renders one
# piece of what the Router shows first. (Rendering the Router crashes; loading
# App, the providers, and the audio engine do not.)
make_host_variant onboarding <<'JS'
import React, {useEffect, useState} from 'react';
import {AppRegistry, Text, View} from 'react-native';
import {hydrateStorage} from '../tv-app/services/storage';
import {name as appName} from './app.json';

const h = React.createElement;
const box = {width: 400, height: 400};

function load() {
  return require('../tv-app/screens/OnboardingScreen').OnboardingScreen;
}

function Root() {
  const [Body, setBody] = useState(null);
  useEffect(() => {
    hydrateStorage().finally(() => setBody(() => load()));
  }, []);
  return Body ? React.createElement(Body) : null;
}

AppRegistry.registerComponent(appName, () => Root);
JS

make_host_variant home <<'JS'
import React, {useEffect, useState} from 'react';
import {AppRegistry, Text, View} from 'react-native';
import {hydrateStorage} from '../tv-app/services/storage';
import {name as appName} from './app.json';

const h = React.createElement;
const box = {width: 400, height: 400};

function load() {
  return require('../tv-app/screens/HomeScreen').HomeScreen;
}

function Root() {
  const [Body, setBody] = useState(null);
  useEffect(() => {
    hydrateStorage().finally(() => setBody(() => load()));
  }, []);
  return Body ? React.createElement(Body) : null;
}

AppRegistry.registerComponent(appName, () => Root);
JS

make_host_variant img-local <<'JS'
import React, {useEffect, useState} from 'react';
import {AppRegistry, Text, View} from 'react-native';
import {hydrateStorage} from '../tv-app/services/storage';
import {name as appName} from './app.json';

const h = React.createElement;
const box = {width: 400, height: 400};

function load() {
  const {Image} = require('expo-image');
  const asset = require('../assets/images/icon.png');
  return () => h(Image, {source: asset, style: box});
}

function Root() {
  const [Body, setBody] = useState(null);
  useEffect(() => {
    hydrateStorage().finally(() => setBody(() => load()));
  }, []);
  return Body ? React.createElement(Body) : null;
}

AppRegistry.registerComponent(appName, () => Root);
JS

make_host_variant img-remote <<'JS'
import React, {useEffect, useState} from 'react';
import {AppRegistry, Text, View} from 'react-native';
import {hydrateStorage} from '../tv-app/services/storage';
import {name as appName} from './app.json';

const h = React.createElement;
const box = {width: 400, height: 400};

function load() {
  const {Image} = require('expo-image');
  return () => h(Image, {source: {uri: 'https://picsum.photos/400'}, style: box});
}

function Root() {
  const [Body, setBody] = useState(null);
  useEffect(() => {
    hydrateStorage().finally(() => setBody(() => load()));
  }, []);
  return Body ? React.createElement(Body) : null;
}

AppRegistry.registerComponent(appName, () => Root);
JS

make_host_variant font <<'JS'
import React, {useEffect, useState} from 'react';
import {AppRegistry, Text, View} from 'react-native';
import {hydrateStorage} from '../tv-app/services/storage';
import {name as appName} from './app.json';

const h = React.createElement;
const box = {width: 400, height: 400};

function load() {
  return () => h(Text, {style: {fontFamily: 'Manrope-Bold', fontSize: 40, color: '#fff'}}, 'Bayaan');
}

function Root() {
  const [Body, setBody] = useState(null);
  useEffect(() => {
    hydrateStorage().finally(() => setBody(() => load()));
  }, []);
  return Body ? React.createElement(Body) : null;
}

AppRegistry.registerComponent(appName, () => Root);
JS

make_host_variant button <<'JS'
import React, {useEffect, useState} from 'react';
import {AppRegistry, Text, View} from 'react-native';
import {hydrateStorage} from '../tv-app/services/storage';
import {name as appName} from './app.json';

const h = React.createElement;
const box = {width: 400, height: 400};

function load() {
  const {FocusableButton} = require('../tv-app/components/primitives/FocusableButton');
  return () => h(FocusableButton, {onPress: () => {}, hasTVPreferredFocus: true}, h(Text, null, 'Go'));
}

function Root() {
  const [Body, setBody] = useState(null);
  useEffect(() => {
    hydrateStorage().finally(() => setBody(() => load()));
  }, []);
  return Body ? React.createElement(Body) : null;
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
