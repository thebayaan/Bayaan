#!/usr/bin/env bash
# Drives the installed TV app through e2e/walk.txt with remote key presses and
# saves a screenshot after every step.
#
# usage: run-walk.sh <android|tvos> <out-dir> [device-id]
#   android: device-id is an adb serial (defaults to the only device)
#   tvos:    device-id is a booted Apple TV simulator UDID
#
# Fails if the app is not running at the end of the walk.
#
# A key can carry a repeat count: "up*7" presses Up seven times (1 to 30;
# arrows, select, back and playpause only).
#
# DRY_RUN=1 run-walk.sh <android|tvos> [out-dir]
#   Checks walk.txt and prints every step's key presses (as the device would
#   get them) without touching a device. Exits non-zero on a malformed line
#   or an unknown key.
#
# "hold" is a long press of OK (Select held for HOLD_SECONDS, default 1.5):
# React Native fires onLongPress after 500 ms of a held press on both
# platforms (tvOS: its select long-press recognizer; Android: the JS timer
# between the press-in on key down and the press-out on key up).
set -uo pipefail

PLATFORM=${1:?usage: run-walk.sh <android|tvos> <out-dir> [device-id]}
DRY_RUN=${DRY_RUN:-0}
if [[ $DRY_RUN == 1 ]]; then
  OUT_DIR=${2:-}
else
  OUT_DIR=${2:?usage: run-walk.sh <android|tvos> <out-dir> [device-id]}
fi
DEVICE=${3:-}
APP_ID=${APP_ID:-com.bayaan.tvsmoke}
WALK=${WALK:-$(dirname "$0")/walk.txt}
HOLD_SECONDS=${HOLD_SECONDS:-1.5}

case $PLATFORM in
  android | tvos) ;;
  *)
    echo "unknown platform: $PLATFORM (android or tvos)" >&2
    exit 2
    ;;
esac

[[ $DRY_RUN == 1 ]] || mkdir -p "$OUT_DIR/screens" "$OUT_DIR/logs"

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

# The walk's key tokens with repeats spelled out ("up*3" -> up up up). A
# repeat on a key that can't take one is left as is, so valid_key rejects it.
expand_keys() {
  local tok key n i
  for tok in "$@"; do
    if [[ $tok =~ ^(up|down|left|right|select|back|playpause)\*([0-9]+)$ ]] &&
      ((10#${BASH_REMATCH[2]} >= 1 && 10#${BASH_REMATCH[2]} <= 30)); then
      key=${BASH_REMATCH[1]}
      n=$((10#${BASH_REMATCH[2]}))
      for ((i = 0; i < n; i++)); do echo "$key"; done
    else
      echo "$tok"
    fi
  done
}

# Whether a token is something press() knows.
valid_key() {
  case $1 in
    up | down | left | right | select | back | playpause | hold | none | relaunch) return 0 ;;
    text:?*) return 0 ;;
    *) return 1 ;;
  esac
}

# How Android holds OK, picked once per run (see hold_android):
#   duration  `input keyevent --duration <ms>` (Android 14+ shell)
#   longpress `input keyevent --longpress`, which holds the key for the
#             system long-press timeout; the runner first raises that
#             timeout to HOLD_SECONDS so the hold outlasts React Native's
#             500 ms long press (Android 12+ defaults to 400 ms)
#   emu       the emulator console (key down, sync, sleep, key up, sync),
#             only if the settings write is refused
ANDROID_HOLD=${ANDROID_HOLD:-}

pick_android_hold() {
  local ms
  ms=$(awk -v s="$HOLD_SECONDS" 'BEGIN { printf "%d", s * 1000 }')
  if adb_ shell input 2>&1 | grep -q -- '--duration'; then
    ANDROID_HOLD=duration
  elif adb_ shell settings put secure long_press_timeout "$ms" >/dev/null 2>&1 &&
    [[ "$(adb_ shell settings get secure long_press_timeout | tr -d '\r')" == "$ms" ]]; then
    ANDROID_HOLD=longpress
  elif [[ "$(adb_ get-serialno 2>/dev/null | tr -d '\r')" == emulator-* ]]; then
    ANDROID_HOLD=emu
  else
    ANDROID_HOLD=longpress
  fi
  echo "android hold: $ANDROID_HOLD"
}

hold_android() {
  [[ -n $ANDROID_HOLD ]] || pick_android_hold
  local ms
  ms=$(awk -v s="$HOLD_SECONDS" 'BEGIN { printf "%d", s * 1000 }')
  case $ANDROID_HOLD in
    duration)
      adb_ shell input keyevent --duration "$ms" KEYCODE_DPAD_CENTER
      ;;
    emu)
      # KEY_ENTER reaches the app as KEYCODE_ENTER, which React Native and
      # Android's views treat exactly like DPAD_CENTER (select).
      # Each event needs a SYN_REPORT, or the guest only sees the key once
      # the next report arrives (down and up together: a plain OK).
      if adb_ emu event send EV_KEY:KEY_ENTER:1 EV_SYN:0:0 >/dev/null 2>&1; then
        sleep "$HOLD_SECONDS"
        adb_ emu event send EV_KEY:KEY_ENTER:0 EV_SYN:0:0 >/dev/null 2>&1
      else
        echo "emulator console unavailable; falling back to --longpress"
        ANDROID_HOLD=longpress
        adb_ shell input keyevent --longpress KEYCODE_DPAD_CENTER
      fi
      ;;
    *)
      adb_ shell input keyevent --longpress KEYCODE_DPAD_CENTER
      ;;
  esac
}

# idb's `ui key` sends the HID usage down, waits --duration seconds, then
# up, so the simulator sees a held Select (Return).
hold_tvos() {
  if ! idb ui key --udid "$DEVICE" --duration "$HOLD_SECONDS" "$(tvos_hid select)"; then
    echo "hold failed: idb ui key --duration is unavailable" >&2
  fi
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
    # Not grep -q: it exits on the first match, launchctl then dies of
    # SIGPIPE, and pipefail turns that into "not running".
    xcrun simctl spawn "$DEVICE" launchctl list | grep "$APP_ID" >/dev/null
  fi
}

press() {
  local key=$1
  case $key in
    none) return ;;
    hold)
      if [[ $PLATFORM == android ]]; then hold_android; else hold_tvos; fi
      sleep 1
      return
      ;;
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

# Dry run: check the walk and print what each step presses, then stop.
if [[ $DRY_RUN == 1 ]]; then
  errors=0
  steps=0
  declare -A seen=()
  lineno=0
  while IFS= read -r line || [[ -n $line ]]; do
    lineno=$((lineno + 1))
    read -r name wait keys <<<"$line"
    [[ -z "${name:-}" || "$name" == \#* ]] && continue
    steps=$((steps + 1))
    if ! [[ ${wait:-} =~ ^[0-9]+([.][0-9]+)?$ ]]; then
      echo "line $lineno ($name): wait '${wait:-}' is not a number" >&2
      errors=$((errors + 1))
    fi
    if [[ -z ${keys:-} ]]; then
      echo "line $lineno ($name): no keys (use none)" >&2
      errors=$((errors + 1))
    fi
    if [[ -n ${seen[$name]:-} ]]; then
      echo "line $lineno ($name): duplicate step name (line ${seen[$name]})" >&2
      errors=$((errors + 1))
    fi
    seen[$name]=$lineno
    out=()
    # read -a, not word splitting: a repeat's "*" must never glob.
    toks=()
    read -ra toks <<<"${keys:-}"
    expanded=()
    while IFS= read -r key; do expanded+=("$key"); done < <(expand_keys ${toks[@]+"${toks[@]}"})
    for key in ${expanded[@]+"${expanded[@]}"}; do
      if ! valid_key "$key"; then
        echo "line $lineno ($name): unknown key '$key'" >&2
        errors=$((errors + 1))
        continue
      fi
      case $key in
        none | relaunch | text:*) out+=("$key") ;;
        hold)
          if [[ $PLATFORM == android ]]; then
            out+=("hold(DPAD_CENTER ${HOLD_SECONDS}s)")
          else
            out+=("hold(hid $(tvos_hid select) ${HOLD_SECONDS}s)")
          fi
          ;;
        *)
          if [[ $PLATFORM == android ]]; then
            out+=("$(android_keycode "$key")")
          else
            out+=("hid:$(tvos_hid "$key")")
          fi
          ;;
      esac
    done
    printf '%-34s wait %-3s %s\n' "$name" "${wait:-?}" "${out[*]}"
  done <"$WALK"
  echo "$steps steps, $errors errors"
  ((errors == 0))
  exit
fi

if [[ $PLATFORM == android ]]; then
  adb_ logcat -c
  adb_ logcat >"$OUT_DIR/logs/logcat.txt" 2>&1 &
else
  xcrun simctl spawn "$DEVICE" log stream --level debug --predicate "process == \"tvsmoke\"" \
    >"$OUT_DIR/logs/device.log" 2>&1 &
fi
LOG_PID=$!
trap 'kill $LOG_PID 2>/dev/null || true' EXIT

STOPPED=()
launch_app

while read -r name wait keys <&3; do
  [[ -z "$name" || "$name" == \#* ]] && continue
  # read -a, not word splitting: a repeat's "*" must never glob. Built
  # with a read loop (not mapfile) for the macOS runner's bash.
  toks=()
  read -ra toks <<<"$keys"
  expanded=()
  while IFS= read -r key; do expanded+=("$key"); done < <(expand_keys ${toks[@]+"${toks[@]}"})
  for key in ${expanded[@]+"${expanded[@]}"}; do
    if ! valid_key "$key"; then
      echo "step $name: unknown key '$key' skipped (check with DRY_RUN=1)"
      continue
    fi
    press "$key"
  done
  sleep "$wait"
  screenshot "$name"
  if ! app_running; then
    # Keep walking so one crash doesn't hide the rest of the app, but fail the
    # run at the end.
    echo "App stopped running after step $name"
    STOPPED+=("$name")
    if [[ $PLATFORM == tvos ]]; then
      xcrun simctl bootstatus "$DEVICE" -b >/dev/null 2>&1
      sleep 20
    fi
    launch_app
    sleep 15
  fi
done 3<"$WALK"

if ((${#STOPPED[@]} > 0)); then
  echo "App stopped running after: ${STOPPED[*]}"
  exit 1
fi
echo "Walk finished with the app still running"
