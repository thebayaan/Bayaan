#!/usr/bin/env bash
# Generate golden SQLite databases by running the RELEASE database services
# (checked out at <tag>) through the test adapter in this working tree.
# Pass --install to also run npm ci in the release worktree (not needed today:
# the services only depend on expo-sqlite, which is mapped to the adapter).
set -euo pipefail
TAG="${1:?usage: generate.sh <tag> [--install]}"
ROOT="$(git rev-parse --show-toplevel)"
WORK="$(mktemp -d)/release"
OUT="$ROOT/test-fixtures/golden/$TAG"

git -C "$ROOT" worktree add --detach "$WORK" "$TAG" >/dev/null
trap 'git -C "$ROOT" worktree remove --force "$WORK" >/dev/null 2>&1 || true' EXIT
if [ "${2:-}" = "--install" ]; then
  (cd "$WORK" && npm ci --ignore-scripts --no-audit --no-fund >/dev/null)
fi

mkdir -p "$OUT"
rm -f "$OUT"/*.db "$OUT/manifest.json"
GOLDEN_RELEASE_ROOT="$WORK" GOLDEN_OUT="$OUT" GOLDEN_TAG="$TAG" \
  GOLDEN_COMMIT="$(git -C "$ROOT" rev-parse "$TAG^{commit}")" \
  npx jest --config "$ROOT/scripts/golden-dbs/jest.golden.config.js" --runInBand
echo "wrote $OUT"
