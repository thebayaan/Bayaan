#!/usr/bin/env bash
# Repro for finding 1 of the review of PR 490 (RFC-023 step 3).
#
# Finding: the layout part of the data identity (LAYOUT_SOURCE_SHA256 in
# rewayahDataManifest.ts) is the hash of digital-khatt-15-lines.db, written by
# gen-manifest.mjs. The page lines the app ships are written by a different
# script, gen-mushaf-tables.mjs, and no release gate runs its --check. So a
# tree where the layout database changed but only the manifest was
# regenerated passes every release gate, and regenerating the tables later
# does not change the key.
#
# What it does: copies the working tree (tracked and untracked files, not the
# repro_490 files) into a temporary directory, links node_modules, flips
# is_centered on page 50, line 3 (an ayah line) of digital-khatt-15-lines.db
# there, runs only gen-manifest.mjs, then runs every gate. Finally it
# regenerates the tables and compares the layout key before and after. The
# checkout itself is never modified, and the copy is deleted on exit.
#
# Expected if the gap were closed: every release gate exits non zero, and
# regenerating the tables changes the layout key.
# Actual on the PR head: check:rewayah-manifest, eas-build-pre-install, the
# first step of ios:archive and the default Jest run all exit 0; only
# gen-mushaf-tables.mjs --check and the CI only alldbs suite fail; and the key
# stays the same after the tables are regenerated.
#
# Exit status: 1 when the finding reproduces, 0 when it does not.
# Needs Node >= 22.13 (node:sqlite), git, tar, and an installed node_modules.
# Takes a few minutes and about 1 GB of temporary disk space.
set -u

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/repro490.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

MANIFEST=services/mushaf/rewayahDataManifest.ts
TABLES=services/mushaf/mushafTables.generated.ts
LAYOUT_DB=data/mushaf/digitalkhatt/digital-khatt-15-lines.db

if [ ! -d "$REPO/node_modules" ]; then
  echo "node_modules is missing in $REPO; run npm ci first." >&2
  exit 2
fi

echo "Copying the working tree to $WORK (the checkout is not touched)."
(cd "$REPO" && git ls-files -z --cached --others --exclude-standard) |
  tr '\0' '\n' | grep -v -e '^node_modules$' -e 'repro_490_' | tr '\n' '\0' |
  (cd "$REPO" && tar --null --ignore-failed-read -T - -cf -) |
  tar -xf - -C "$WORK"
ln -s "$(cd "$REPO/node_modules" && pwd -P)" "$WORK/node_modules"
cd "$WORK" || exit 2

layout_key() { sed -n "s/^  '\([0-9a-f]\{64\}\)';$/\1/p" "$MANIFEST" | tail -1; }
file_sha() { sha256sum "$1" | cut -c1-16; }

KEY0="$(layout_key)"
TABLES0="$(file_sha "$TABLES")"

echo
echo "Step 1. Flip is_centered on page 50, line 3 of the layout database."
node --no-warnings - "$LAYOUT_DB" <<'NODE' || exit 2
const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync(process.argv[2]);
const where = 'WHERE page_number = 50 AND line_number = 3';
const before = db.prepare(`SELECT * FROM pages ${where}`).get();
if (!before || before.line_type !== 'ayah') throw new Error('page 50 line 3 is not an ayah line');
db.exec(`UPDATE pages SET is_centered = 1 - is_centered ${where}`);
const after = db.prepare(`SELECT * FROM pages ${where}`).get();
console.log(`  before: ${JSON.stringify({...before})}`);
console.log(`  after:  ${JSON.stringify({...after})}`);
db.close();
NODE

echo
echo "Step 2. Regenerate only the manifest."
node scripts/rewayah/gen-manifest.mjs | sed 's/^/  /' | head -1
KEY1="$(layout_key)"
echo "  LAYOUT_SOURCE_SHA256: ${KEY0:0:16}... -> ${KEY1:0:16}..."

echo
echo "Step 3. Run every gate (logs are summarised below each line)."
declare -a NAMES CODES WANT
gate() {
  local name="$1" want="$2"
  shift 2
  local log="$WORK/.gate.log"
  "$@" >"$log" 2>&1
  local code=$?
  NAMES+=("$name")
  CODES+=("$code")
  WANT+=("$want")
  printf '  exit %s  %s\n' "$code" "$name"
  grep -E '^(Tests:|Test Suites:)|●.*›|\[gen-(manifest|mushaf-tables)\]' "$log" |
    sort -u | head -6 | sed 's/^/           /'
}

gate 'npm run check:rewayah-manifest' release \
  npm run --silent check:rewayah-manifest
gate 'npm run eas-build-pre-install (every EAS build)' release \
  npm run --silent eas-build-pre-install
gate 'gen-manifest.mjs --check (first step of ios:archive and ios:archive:upload)' release \
  node scripts/rewayah/gen-manifest.mjs --check
gate 'npx jest services/mushaf without BAYAAN_OVERLAY_DB_DIR (a laptop run)' release \
  env -u BAYAAN_OVERLAY_DB_DIR npx jest services/mushaf -w 1 --ci
gate 'gen-mushaf-tables.mjs --check (not in any gate)' info \
  node scripts/rewayah/gen-mushaf-tables.mjs --check
gate 'BAYAAN_OVERLAY_DB_DIR=bundled jest mushafTables.alldbs (CI on a pull request)' info \
  env BAYAAN_OVERLAY_DB_DIR=bundled npx jest services/mushaf/__tests__/mushafTables.alldbs -w 1 --ci

echo
echo "Step 4. Regenerate the tables, as someone would after noticing."
node --no-warnings scripts/rewayah/gen-mushaf-tables.mjs | sed 's/^/  /'
node scripts/rewayah/gen-manifest.mjs >/dev/null
KEY2="$(layout_key)"
TABLES2="$(file_sha "$TABLES")"
echo "  $TABLES: ${TABLES0}... -> ${TABLES2}..."
echo "  LAYOUT_SOURCE_SHA256: ${KEY1:0:16}... -> ${KEY2:0:16}..."

echo
echo "Result"
REPRO=0
for i in "${!NAMES[@]}"; do
  if [ "${WANT[$i]}" = release ] && [ "${CODES[$i]}" = 0 ]; then
    echo "  REPRODUCED: '${NAMES[$i]}' passed with stale page lines (expected a non zero exit)."
    REPRO=1
  fi
done
if [ "$TABLES0" != "$TABLES2" ] && [ "$KEY1" = "$KEY2" ]; then
  echo "  REPRODUCED: the shipped page lines changed but the layout key did not,"
  echo "  so layouts saved under that key from the stale lines stay valid on phones."
  REPRO=1
fi
if [ "$REPRO" = 0 ]; then
  echo "  Not reproduced: every release gate failed and the key follows the tables."
fi
exit "$REPRO"
