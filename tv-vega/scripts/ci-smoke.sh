#!/usr/bin/env bash
# Smoke test for the Vega build on a running Vega Virtual Device.
#
# Assumes the app is already installed. Streams device logs, launches the app,
# drives it with remote key presses, saves a screenshot after each step plus a
# diagnostic bundle to <out-dir>, and fails if the app is not running at the end.
#
# SMOKE_APP_ID overrides the app (CI uses it for a Hello World control app), and
# SMOKE_KEYS=0 skips the remote key presses.
set -uo pipefail

APP_ID=${SMOKE_APP_ID:-com.bayaan.tvsmoke.main}
OUT_DIR=${1:?usage: ci-smoke.sh <out-dir>}
mkdir -p "$OUT_DIR/screens" "$OUT_DIR/logs"

VDA=$(ls ~/vega/sdk/vega-sdk/*/*/bin/tools/vda | head -1)
timeout 300 "$VDA" wait-for-device
SERIAL=$("$VDA" devices | awk '/^emulator-/ && $2 == "device" { print $1; exit }')
if [[ -z "$SERIAL" ]]; then
  echo "No running Vega Virtual Device found"
  "$VDA" devices
  exit 1
fi
CONSOLE_PORT=${SERIAL#emulator-}
echo "Using $SERIAL (console port $CONSOLE_PORT)"

# vda has no `emu` command, so talk to the emulator console directly.
screenshot() {
  local dir token
  dir=$(mktemp -d)
  token=$(cat ~/.emulator_console_auth_token 2>/dev/null || true)
  {
    [[ -n "$token" ]] && echo "auth $token"
    echo "screenrecord screenshot $dir"
    sleep 3
    echo "quit"
  } | nc -q 5 localhost "$CONSOLE_PORT" >/dev/null 2>&1
  if compgen -G "$dir/*.png" >/dev/null; then
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

collect_diagnostics() {
  kill "$LOG_PID" 2>/dev/null || true
  mkdir -p "$OUT_DIR/doctor"
  vega device doctor -d "$SERIAL" --dir "$OUT_DIR/doctor" -a "${APP_ID%.main}" || echo "doctor failed"
}

"$VDA" -s "$SERIAL" shell "loggingctl log -f" >"$OUT_DIR/logs/device.log" 2>&1 &
LOG_PID=$!
trap collect_diagnostics EXIT

echo "inputd screen size: $("$VDA" -s "$SERIAL" shell inputd-cli get_screen_size 2>&1)"

# Launching right after install can fail ("App could not be determined",
# "reading 'trim'") while the package registers, so retry for a while.
launched=false
for attempt in $(seq 1 12); do
  if vega device launch-app -d "$SERIAL" -a "$APP_ID"; then
    launched=true
    break
  fi
  echo "Launch attempt $attempt failed, retrying"
  sleep 10
done
if [[ "$launched" != true ]]; then
  echo "Could not launch $APP_ID"
  exit 1
fi

for second in 5 10 15; do
  sleep 5
  screenshot "00-launch-${second}s"
  app_running
done

if [[ "${SMOKE_KEYS:-1}" == 0 ]]; then
  app_running | grep -qi "is not running" && exit 1
  exit 0
fi

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

if app_running | grep -qi "is not running"; then
  echo "App $APP_ID is not running at the end of the smoke test (crash?)"
  exit 1
fi
echo "App still running after the smoke test"
