#!/usr/bin/env bash
# Smoke test for the Vega build on a running Vega Virtual Device.
#
# Assumes the app is already installed and launched (vega run-app). Drives it
# with remote key presses, saves a screenshot after each step plus the device
# logs to <out-dir>, and fails if the app is no longer running at the end.
set -uo pipefail

APP_ID=com.bayaan.tvsmoke.main
OUT_DIR=${1:?usage: ci-smoke.sh <out-dir>}
mkdir -p "$OUT_DIR/screens" "$OUT_DIR/logs"

VDA=$(ls ~/vega/sdk/vega-sdk/*/*/bin/tools/vda | head -1)
SERIAL=$("$VDA" devices | awk '/^emulator-/ && $2 == "device" { print $1; exit }')
if [[ -z "$SERIAL" ]]; then
  echo "No running Vega Virtual Device found"
  "$VDA" devices
  exit 1
fi
echo "Using $SERIAL"

screenshot() {
  local dir
  dir=$(mktemp -d)
  if "$VDA" -s "$SERIAL" emu screenrecord screenshot "$dir" >/dev/null; then
    mv "$dir"/*.png "$OUT_DIR/screens/$1.png" && echo "screenshot: $1"
  else
    echo "screenshot $1 failed"
  fi
}

press() {
  for key in "$@"; do
    "$VDA" -s "$SERIAL" shell "inputd-cli button_press $key" >/dev/null 2>&1
    sleep 1
  done
}

app_running() {
  vega device is-app-running -d "$SERIAL" -a "$APP_ID" 2>&1 | tee -a "$OUT_DIR/logs/is-app-running.txt"
}

echo "inputd screen size: $("$VDA" -s "$SERIAL" shell inputd-cli get_screen_size 2>&1)"

# Give the JS bundle time to load and the first screen to render.
sleep 20
screenshot 01-launch
app_running

press KEY_DOWN KEY_ENTER
sleep 5
screenshot 02-after-select

press KEY_RIGHT KEY_RIGHT
screenshot 03-focus-moved

press KEY_ENTER
sleep 5
screenshot 04-detail

press KEY_ENTER
sleep 10
screenshot 05-playing

press KEY_PLAYPAUSE
sleep 2
screenshot 06-paused

press KEY_BACK
sleep 3
screenshot 07-back

vega device copy-logs -d "$SERIAL" -a system/var_log --dir "$OUT_DIR/logs" || echo "copy-logs failed"

if ! app_running | grep -qiE "is running|true"; then
  echo "App $APP_ID is not running at the end of the smoke test (crash?)"
  exit 1
fi
echo "App still running after the smoke test"
