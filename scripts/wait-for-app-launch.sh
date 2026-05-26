#!/usr/bin/env bash
#
# Boot-gate auto-detect: tails adb logcat and exits 0 when the app's
# JavaScript bundle finishes loading, or exits non-zero on timeout.
#
# Usage:
#   scripts/wait-for-app-launch.sh                 # default: 180s timeout
#   scripts/wait-for-app-launch.sh --timeout 300   # 5 minute timeout
#   scripts/wait-for-app-launch.sh --device emulator-5554
#
# Detection: matches RN's "Running application" log line, which fires after
# the JS bundle is loaded and the root component has mounted. Also matches
# Expo Go's "Expo Go is ready" line for prebuild-less workflows.
#
# Designed to be wrapped around `npm run android`:
#   npm run android & APP_PID=$!
#   scripts/wait-for-app-launch.sh && echo "boot-gate PASSED"

set -u

TIMEOUT=180
DEVICE_FLAG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --timeout)
      TIMEOUT="$2"; shift 2;;
    --device)
      DEVICE_FLAG="-s $2"; shift 2;;
    -h|--help)
      sed -n '2,18p' "$0"; exit 0;;
    *)
      echo "unknown arg: $1" >&2; exit 2;;
  esac
done

if ! command -v adb >/dev/null 2>&1; then
  echo "[wait-for-app-launch] adb not on PATH — install Android platform-tools." >&2
  exit 3
fi

# Clear logcat so we only match against post-launch output.
# shellcheck disable=SC2086
adb $DEVICE_FLAG logcat -c >/dev/null 2>&1 || true

START_EPOCH="$(date +%s)"
DEADLINE_EPOCH=$(( START_EPOCH + TIMEOUT ))

# Patterns that indicate a successful app launch.
# - "Running application 'main'" — RN bridge bundle done loading + mounted
# - "Expo Go is ready"            — Expo Go fallback
# - "App is ready"                — explicit log if the app emits one
PATTERNS='Running application|Expo Go is ready|App is ready'

# logcat -T 1 prints from "now" rather than the full ring buffer.
# shellcheck disable=SC2086
adb $DEVICE_FLAG logcat -T 1 2>/dev/null | while IFS= read -r line; do
  NOW="$(date +%s)"
  if (( NOW > DEADLINE_EPOCH )); then
    echo "[wait-for-app-launch] timed out after ${TIMEOUT}s without seeing launch" >&2
    exit 1
  fi
  if echo "$line" | grep -Eq "$PATTERNS"; then
    ELAPSED=$(( NOW - START_EPOCH ))
    echo "[wait-for-app-launch] launch detected after ${ELAPSED}s: $line"
    exit 0
  fi
done

# `adb logcat` exited (device unplugged?) — bubble up failure.
echo "[wait-for-app-launch] adb logcat stream ended unexpectedly" >&2
exit 4
