#!/usr/bin/env bash
# Drives the installed TV app through e2e/walk.txt with remote key presses and
# saves a screenshot after every step.
#
# usage: run-walk.sh <android|tvos> <out-dir> [device-id]
#   android: device-id is an adb serial (defaults to the only device)
#   tvos:    device-id is a booted Apple TV simulator UDID
#
# Fails if the app is not running at the end of the walk.
set -uo pipefail

PLATFORM=${1:?usage: run-walk.sh <android|tvos> <out-dir> [device-id]}
OUT_DIR=${2:?usage: run-walk.sh <android|tvos> <out-dir> [device-id]}
DEVICE=${3:-}
APP_ID=${APP_ID:-com.bayaan.tvsmoke}
WALK=${WALK:-$(dirname "$0")/walk.txt}

mkdir -p "$OUT_DIR/screens" "$OUT_DIR/logs"

adb_() {
  if [[ -n "$DEVICE" ]]; then adb -s "$DEVICE" "$@"; else adb "$@"; fi
}

# tvOS simulator remote presses go through idb as hardware keyboard HID
# usages: arrows move focus, Return selects, Escape is Menu (back), Space is
# play/pause.
tvos_hid() {
  case $1 in
    up) echo 82 ;;
    down) echo 81 ;;
    left) echo 80 ;;
    right) echo 79 ;;
    select) echo 40 ;;
    back) echo 41 ;;
    playpause) echo 44 ;;
  esac
}

android_keycode() {
  case $1 in
    up) echo KEYCODE_DPAD_UP ;;
    down) echo KEYCODE_DPAD_DOWN ;;
    left) echo KEYCODE_DPAD_LEFT ;;
    right) echo KEYCODE_DPAD_RIGHT ;;
    select) echo KEYCODE_DPAD_CENTER ;;
    back) echo KEYCODE_BACK ;;
    playpause) echo KEYCODE_MEDIA_PLAY_PAUSE ;;
  esac
}

launch_app() {
  if [[ $PLATFORM == android ]]; then
    adb_ shell monkey -p "$APP_ID" -c android.intent.category.LEANBACK_LAUNCHER 1 >/dev/null 2>&1 ||
      adb_ shell monkey -p "$APP_ID" 1 >/dev/null 2>&1
  else
    xcrun simctl launch "$DEVICE" "$APP_ID"
  fi
}

stop_app() {
  if [[ $PLATFORM == android ]]; then
    adb_ shell am force-stop "$APP_ID"
  else
    xcrun simctl terminate "$DEVICE" "$APP_ID" || true
  fi
}

app_running() {
  if [[ $PLATFORM == android ]]; then
    [[ -n "$(adb_ shell pidof "$APP_ID" | tr -d '\r')" ]]
  else
    xcrun simctl spawn "$DEVICE" launchctl list | grep -q "$APP_ID"
  fi
}

press() {
  local key=$1
  case $key in
    none) return ;;
    relaunch)
      stop_app
      sleep 2
      launch_app
      return
      ;;
    text:*)
      local word=${key#text:}
      if [[ $PLATFORM == android ]]; then
        adb_ shell input text "$word"
      else
        idb ui text --udid "$DEVICE" "$word"
      fi
      return
      ;;
  esac
  if [[ $PLATFORM == android ]]; then
    adb_ shell input keyevent "$(android_keycode "$key")"
  else
    idb ui key --udid "$DEVICE" "$(tvos_hid "$key")"
  fi
  sleep 1
}

screenshot() {
  local file="$OUT_DIR/screens/$1.png"
  if [[ $PLATFORM == android ]]; then
    adb_ exec-out screencap -p >"$file"
  else
    xcrun simctl io "$DEVICE" screenshot "$file" >/dev/null 2>&1
  fi
  [[ -s "$file" ]] && echo "screenshot: $1" || echo "screenshot $1 failed"
}

if [[ $PLATFORM == android ]]; then
  adb_ logcat -c
  adb_ logcat >"$OUT_DIR/logs/logcat.txt" 2>&1 &
else
  xcrun simctl spawn "$DEVICE" log stream --level debug --predicate "process == \"tvsmoke\"" \
    >"$OUT_DIR/logs/device.log" 2>&1 &
fi
LOG_PID=$!
trap 'kill $LOG_PID 2>/dev/null || true' EXIT

launch_app

while read -r name wait keys <&3; do
  [[ -z "$name" || "$name" == \#* ]] && continue
  for key in $keys; do
    press "$key"
  done
  sleep "$wait"
  screenshot "$name"
  if ! app_running; then
    echo "App stopped running after step $name"
    exit 1
  fi
done 3<"$WALK"

echo "Walk finished with the app still running"
