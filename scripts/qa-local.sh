#!/usr/bin/env bash
# Runs the Maestro flows in .maestro/ on this Mac instead of GitHub Actions.
#
#   scripts/qa-local.sh <ref> [--upgrade-from <older ref>]
#       Build Release simulator apps of the ref(s) here, then run the flows.
#   scripts/qa-local.sh --from-run <run id>
#       Reuse the apps a sim-builds.yml run uploaded, then run the flows.
#
# Builds use one throwaway checkout under $QA_LOCAL_DIR (default
# ~/Library/Caches/bayaan-qa-local), kept between runs so node_modules, Pods
# and DerivedData are reused. Built apps are cached by commit, so re-running a
# ref you already built skips straight to the flows. Screenshots land in
# $QA_LOCAL_DIR/qa-output/<timestamp>.
#
# Needs Xcode, CocoaPods, jq, gh (for --from-run) and Maestro
# (curl -fsSL https://get.maestro.mobile.dev | bash).
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
DIR=${QA_LOCAL_DIR:-$HOME/Library/Caches/bayaan-qa-local}
SRC=$DIR/src
APPS=$DIR/apps
mkdir -p "$APPS"

usage() {
  sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
}

REF=
FROM=
RUN=
while [ $# -gt 0 ]; do
  case $1 in
    --upgrade-from) FROM=${2:?}; shift 2 ;;
    --from-run) RUN=${2:?}; shift 2 ;;
    -h | --help) usage ;;
    -*) usage ;;
    *) REF=$1; shift ;;
  esac
done
[ -n "$REF" ] || [ -n "$RUN" ] || usage

# Swift 6.3 (Xcode 27) rejects a C function pointer picked by a ternary in
# expo-modules-jsi 56.0.x. Rewrite it as an if/else; a no-op once fixed upstream.
patch_expo_modules_jsi() {
  local f=$SRC/node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/JavaScriptRuntime.swift
  [ -f "$f" ] || return 0
  perl -0pi -e 's/let callbacks = expo\.HostObjectCallbacks\(context, getter, set == nil \? nil : setter, propertyNamesGetter, deallocate\)/let callbacks: expo.HostObjectCallbacks\n    if set == nil {\n      callbacks = expo.HostObjectCallbacks(context, getter, nil, propertyNamesGetter, deallocate)\n    } else {\n      callbacks = expo.HostObjectCallbacks(context, getter, setter, propertyNamesGetter, deallocate)\n    }/' "$f"
}

# build <ref>: prints the path of a zipped Release simulator app for the ref.
build() {
  local sha
  sha=$(git -C "$ROOT" rev-parse --verify "$1^{commit}" 2>/dev/null) || {
    git -C "$ROOT" fetch -q origin "$1" && sha=$(git -C "$ROOT" rev-parse FETCH_HEAD)
  }
  local zip=$APPS/$sha.zip
  if [ -f "$zip" ]; then
    echo "Using cached build of $1 ($sha)" >&2
    echo "$zip"
    return
  fi
  echo "Building $1 ($sha)" >&2

  if [ ! -d "$SRC" ]; then
    git -C "$ROOT" worktree add --detach "$SRC" "$sha" >&2
  else
    git -C "$SRC" checkout -q --detach --force "$sha"
  fi

  # Reinstall only when the lockfiles changed since the last build.
  local npm_key pod_key
  npm_key=$(shasum "$SRC/package-lock.json" | cut -d' ' -f1)
  if [ "$(cat "$DIR/.npm-key" 2>/dev/null)" != "$npm_key" ]; then
    (cd "$SRC" && npm ci --no-audit --no-fund) >&2
    echo "$npm_key" > "$DIR/.npm-key"
    rm -f "$DIR/.pod-key"
  fi
  patch_expo_modules_jsi
  pod_key=$(cat "$SRC/ios/Podfile.lock" "$SRC/package-lock.json" | shasum | cut -d' ' -f1)
  if [ "$(cat "$DIR/.pod-key" 2>/dev/null)" != "$pod_key" ]; then
    (cd "$SRC/ios" && pod install) >&2
    echo "$pod_key" > "$DIR/.pod-key"
  fi

  local log=$DIR/build-$sha.log
  echo "xcodebuild log: $log" >&2
  # IPHONEOS_DEPLOYMENT_TARGET: Xcode 27 rejects pods that target < iOS 15.
  (cd "$SRC" && EXPO_PUBLIC_ANALYTICS_ENABLED=false SENTRY_DISABLE_AUTO_UPLOAD=true xcodebuild \
    -workspace ios/Bayaan.xcworkspace \
    -scheme Bayaan \
    -configuration Release \
    -sdk iphonesimulator \
    -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath "$DIR/DerivedData" \
    ARCHS=arm64 ONLY_ACTIVE_ARCH=YES IPHONEOS_DEPLOYMENT_TARGET=16.4 \
    CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM= PROVISIONING_PROFILE_SPECIFIER= \
    COMPILER_INDEX_STORE_ENABLE=NO \
    build >"$log" 2>&1) || {
    grep -E 'error:' "$log" | head -20 >&2
    echo "Build of $1 failed; see $log" >&2
    exit 1
  }
  ditto -c -k --keepParent "$DIR/DerivedData/Build/Products/Release-iphonesimulator/Bayaan.app" "$zip"
  echo "$zip"
}

if [ -n "$RUN" ]; then
  dl=$DIR/run-$RUN
  if [ ! -d "$dl/ios-sim-app" ]; then
    rm -rf "$dl"
    gh run download "$RUN" --repo thebayaan/Bayaan --pattern 'ios-sim-*' --dir "$dl"
  fi
  APP_ZIP=$dl/ios-sim-app/Bayaan-ios-sim.zip
  BASE_ZIP=
  [ -f "$dl/ios-sim-base/Bayaan-ios-sim.zip" ] && BASE_ZIP=$dl/ios-sim-base/Bayaan-ios-sim.zip
else
  APP_ZIP=$(build "$REF")
  BASE_ZIP=
  [ -n "$FROM" ] && BASE_ZIP=$(build "$FROM")
fi

export QA_OUT=${QA_OUT:-$DIR/qa-output/$(date +%Y%m%d-%H%M%S)}
export MAESTRO_DRIVER_STARTUP_TIMEOUT=${MAESTRO_DRIVER_STARTUP_TIMEOUT:-300000}
export MAESTRO_CLI_NO_ANALYTICS=1
echo "Screenshots: $QA_OUT"
"$ROOT/scripts/ci/run-sim-qa.sh" "$APP_ZIP" $BASE_ZIP
