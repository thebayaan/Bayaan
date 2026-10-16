#!/usr/bin/env bash
# Generate golden SQLite databases by running the RELEASE database services
# (checked out at <tag>) through the test adapter in this working tree.
#
# usage: generate.sh <tag> [--first-launch] [--install]
#   --first-launch  stop after the first app launch (no simulated relaunch) and
#                   write to test-fixtures/golden/<tag>-first-launch. Rows keep
#                   the rewayah ids the release wrote (legacy slugs, NULL).
#   --install       also run npm ci in the release worktree (not needed today:
#                   the services only depend on expo-sqlite, which is mapped
#                   to the adapter).
set -euo pipefail
TAG="${1:?usage: generate.sh <tag> [--first-launch] [--install]}"
shift
FIRST_LAUNCH=0
INSTALL=0
for arg in "$@"; do
  case "$arg" in
    --first-launch) FIRST_LAUNCH=1 ;;
    --install) INSTALL=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done
ROOT="$(git rev-parse --show-toplevel)"
WORK="$(mktemp -d)/release"
OUT="$ROOT/test-fixtures/golden/$TAG"
if [ "$FIRST_LAUNCH" = 1 ]; then OUT="$OUT-first-launch"; fi

git -C "$ROOT" worktree add --detach "$WORK" "$TAG" >/dev/null
trap 'git -C "$ROOT" worktree remove --force "$WORK" >/dev/null 2>&1 || true; rmdir "$(dirname "$WORK")" 2>/dev/null || true' EXIT
if [ "$INSTALL" = 1 ]; then
  (cd "$WORK" && npm ci --ignore-scripts --no-audit --no-fund >/dev/null)
fi

mkdir -p "$OUT"
rm -f "$OUT"/*.db "$OUT/manifest.json"
GOLDEN_RELEASE_ROOT="$WORK" GOLDEN_OUT="$OUT" GOLDEN_TAG="$TAG" \
  GOLDEN_FIRST_LAUNCH="$FIRST_LAUNCH" \
  GOLDEN_COMMIT="$(git -C "$ROOT" rev-parse "$TAG^{commit}")" \
  npx jest --config "$ROOT/scripts/golden-dbs/jest.golden.config.js" --runInBand
echo "wrote $OUT"
