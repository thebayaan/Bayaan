#!/usr/bin/env bash
# Runs the Maestro flows in .maestro/ on a fresh iOS simulator.
#
#   scripts/ci/run-sim-qa.sh <app.zip> [base.zip]
#
# With a base build, each .maestro/upgrade/<case>/ runs first: install the
# base, run before.yaml, install the app over it (keeping its data, like an
# App Store update), run after.yaml. Then the simulator is erased and every
# .maestro/flows/*.yaml runs on a clean install of the app.
#
# Screenshots land in $QA_OUT (default ./qa-output), one folder per flow.
# Exits non-zero if any flow failed, after running all of them.
set -euo pipefail

APP_ZIP=$1
BASE_ZIP=${2:-}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
OUT=${QA_OUT:-$PWD/qa-output}
WORK=$(mktemp -d)
FAILED=()

mkdir -p "$OUT"

unpack() {
  ditto -x -k "$1" "$WORK/$2"
  find "$WORK/$2" -maxdepth 1 -name '*.app' | head -1
}

APP=$(unpack "$APP_ZIP" app)
BASE=
[ -n "$BASE_ZIP" ] && BASE=$(unpack "$BASE_ZIP" base)

# Newest available iOS runtime, and an iPhone Pro (not Max) on it.
RUNTIME=$(xcrun simctl list runtimes -j |
  jq -r '[.runtimes[] | select(.platform == "iOS" and .isAvailable)] | last | .identifier')
DEVICE_TYPE=$(xcrun simctl list devicetypes -j |
  jq -r '[.devicetypes[] | select(.name | test("^iPhone [0-9]+ Pro$"))] | last | .identifier')
UDID=$(xcrun simctl create bayaan-qa "$DEVICE_TYPE" "$RUNTIME")
echo "Simulator $UDID ($DEVICE_TYPE, $RUNTIME)"
trap 'xcrun simctl shutdown "$UDID" >/dev/null 2>&1 || true; xcrun simctl delete "$UDID" >/dev/null 2>&1 || true' EXIT

boot() {
  xcrun simctl boot "$UDID" 2>/dev/null || true
  xcrun simctl bootstatus "$UDID" -b >/dev/null
}

erase() {
  xcrun simctl shutdown "$UDID" >/dev/null 2>&1 || true
  xcrun simctl erase "$UDID"
  boot
}

# run_flow <flow.yaml> <output name>
run_flow() {
  local dir="$OUT/$2"
  mkdir -p "$dir"
  echo "::group::$2"
  # takeScreenshot paths are relative to the working directory.
  if (cd "$dir" && maestro --device "$UDID" test --format junit --output "$dir/report.xml" \
      --test-output-dir "$dir/maestro" "$1"); then
    echo "::endgroup::"
  else
    echo "::endgroup::"
    echo "::error::Flow failed: $2"
    FAILED+=("$2")
  fi
}

boot

if [ -n "$BASE" ]; then
  for case_dir in "$ROOT"/.maestro/upgrade/*/; do
    [ -f "$case_dir/before.yaml" ] || continue
    name=upgrade-$(basename "$case_dir")
    erase
    xcrun simctl install "$UDID" "$BASE"
    run_flow "$case_dir/before.yaml" "$name/1-before"
    xcrun simctl terminate "$UDID" com.bayaan.app >/dev/null 2>&1 || true
    xcrun simctl install "$UDID" "$APP"
    run_flow "$case_dir/after.yaml" "$name/2-after"
  done
fi

for flow in "$ROOT"/.maestro/flows/*.yaml; do
  [ -f "$flow" ] || continue
  erase
  xcrun simctl install "$UDID" "$APP"
  run_flow "$flow" "$(basename "$flow" .yaml)"
done

if [ ${#FAILED[@]} -gt 0 ]; then
  echo "Failed flows: ${FAILED[*]}"
  exit 1
fi
echo "All flows passed."
