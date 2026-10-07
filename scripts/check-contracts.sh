#!/usr/bin/env bash
# Usage: scripts/check-contracts.sh <path-to-bayaan-backend-checkout>
set -euo pipefail
BACKEND="${1:?path to bayaan-backend checkout}"
diff -ru "$BACKEND/contracts/content/v1" "$(git rev-parse --show-toplevel)/contracts/content/v1" && echo "contracts in sync"
