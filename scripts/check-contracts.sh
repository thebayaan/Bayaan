#!/usr/bin/env bash
# Compare the mobile copy of the content contract fixtures with the backend's.
#
# usage: scripts/check-contracts.sh <backend-checkout>
#        scripts/check-contracts.sh --ref <git-ref> <backend-repo>
#
# The first form diffs the backend working tree as checked out. The second
# reads contracts/content/v1 from <git-ref> in the backend repository (for
# example origin/main), whatever branch that checkout is on.
set -euo pipefail
usage="usage: $0 <backend-checkout> | --ref <git-ref> <backend-repo>"
MOBILE="$(cd "$(dirname "$0")/.." && pwd)/contracts/content/v1"
CONTRACTS=contracts/content/v1

if [ "${1:-}" = "--ref" ]; then
  REF="${2:?$usage}"
  BACKEND="${3:?$usage}"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  if ! git -C "$BACKEND" cat-file -e "$REF:$CONTRACTS" 2>/dev/null; then
    echo "no $CONTRACTS at $REF in $BACKEND" >&2
    exit 2
  fi
  git -C "$BACKEND" archive "$REF" "$CONTRACTS" | tar -x -C "$tmp"
  SOURCE="$tmp/$CONTRACTS"
else
  BACKEND="${1:?$usage}"
  SOURCE="$BACKEND/$CONTRACTS"
  if [ ! -d "$SOURCE" ]; then
    echo "no $CONTRACTS in $BACKEND" >&2
    exit 2
  fi
fi

diff -ru "$SOURCE" "$MOBILE" && echo "contracts in sync"
