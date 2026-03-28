#!/bin/bash
# =============================================================
# Supabase Storage → Cloudflare R2 Migration Script
# =============================================================
# Copies all audio files from Supabase Storage to Cloudflare R2.
#
# Bucket structure (designed for future expansion):
#   bayaan-audio/
#   ├── reciters/          ← reciter audio (this migration)
#   │   └── {name}/
#   │       └── {001-114}.mp3
#   ├── ambient/           ← future: ambient sounds
#   └── adhkar/            ← future: adhkar audio
#
# Prerequisites:
#   - AWS CLI installed (works with R2's S3-compatible API)
#   - .env.r2 file with credentials (see below)
#
# Usage:
#   chmod +x scripts/migrate-to-r2.sh
#   ./scripts/migrate-to-r2.sh
# =============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env.r2"

# ── Load credentials ──────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Missing $ENV_FILE"
  echo ""
  echo "Create it with:"
  echo "  R2_ACCOUNT_ID=your-cloudflare-account-id"
  echo "  R2_ACCESS_KEY_ID=your-r2-access-key-id"
  echo "  R2_SECRET_ACCESS_KEY=your-r2-secret-access-key"
  echo "  SUPABASE_URL=https://tncrklrswaounqmirayh.supabase.co"
  echo "  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

# ── Config ────────────────────────────────────────────────────
R2_BUCKET="bayaan-audio"
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
SUPABASE_STORAGE_URL="${SUPABASE_URL}/storage/v1"
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "🚀 Supabase → R2 Migration"
echo "   Bucket: $R2_BUCKET"
echo "   Endpoint: $R2_ENDPOINT"
echo "   Temp dir: $TEMP_DIR"
echo ""

# ── Configure AWS CLI for R2 ──────────────────────────────────
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"

# ── Step 1: Create R2 bucket (idempotent) ─────────────────────
echo "📦 Creating R2 bucket '$R2_BUCKET'..."
if aws s3api head-bucket --bucket "$R2_BUCKET" --endpoint-url "$R2_ENDPOINT" 2>/dev/null; then
  echo "   Bucket already exists, skipping."
else
  aws s3api create-bucket --bucket "$R2_BUCKET" --endpoint-url "$R2_ENDPOINT"
  echo "   ✅ Bucket created."
fi
echo ""

# ── Step 2: List all reciter folders from Supabase ────────────
echo "📂 Listing reciter folders from Supabase..."
FOLDERS=$(curl -s "${SUPABASE_STORAGE_URL}/object/list/quran-audio" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"prefix":"reciters/","limit":500,"offset":0}' \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data:
    name = item.get('name', '')
    # Folders have no metadata.mimetype or have id=null
    if name and not name.endswith('.mp3'):
        print(name)
")

FOLDER_COUNT=$(echo "$FOLDERS" | grep -c . || true)
echo "   Found $FOLDER_COUNT reciter folders."
echo ""

# ── Step 3: Migrate each reciter ──────────────────────────────
TOTAL_FILES=0
FAILED_FILES=0

for FOLDER in $FOLDERS; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🎙️  Migrating: reciters/$FOLDER"

  # List files in this folder
  FILES=$(curl -s "${SUPABASE_STORAGE_URL}/object/list/quran-audio" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"prefix\":\"reciters/${FOLDER}/\",\"limit\":200,\"offset\":0}" \
    | python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data:
    name = item.get('name', '')
    if name and '.' in name:
        print(name)
")

  FILE_COUNT=$(echo "$FILES" | grep -c . || true)
  echo "   Found $FILE_COUNT files."

  if [ "$FILE_COUNT" -eq 0 ]; then
    echo "   ⚠️  No files found, skipping."
    continue
  fi

  # Check if already migrated (spot-check first file)
  FIRST_FILE=$(echo "$FILES" | head -1)
  R2_KEY="reciters/${FOLDER}/${FIRST_FILE}"
  if aws s3api head-object --bucket "$R2_BUCKET" --key "$R2_KEY" --endpoint-url "$R2_ENDPOINT" 2>/dev/null; then
    echo "   ⏭️  Already migrated (${FIRST_FILE} exists in R2), skipping."
    TOTAL_FILES=$((TOTAL_FILES + FILE_COUNT))
    continue
  fi

  # Download and upload each file
  FOLDER_DIR="$TEMP_DIR/$FOLDER"
  mkdir -p "$FOLDER_DIR"

  CURRENT=0
  for FILE in $FILES; do
    CURRENT=$((CURRENT + 1))
    SUPABASE_FILE_URL="${SUPABASE_URL}/storage/v1/object/public/quran-audio/reciters/${FOLDER}/${FILE}"
    LOCAL_PATH="${FOLDER_DIR}/${FILE}"
    R2_KEY="reciters/${FOLDER}/${FILE}"

    # Download from Supabase (public URL, no auth needed)
    printf "   [%d/%d] %s ... " "$CURRENT" "$FILE_COUNT" "$FILE"

    if curl -sf -o "$LOCAL_PATH" "$SUPABASE_FILE_URL"; then
      # Upload to R2
      if aws s3 cp "$LOCAL_PATH" "s3://${R2_BUCKET}/${R2_KEY}" \
        --endpoint-url "$R2_ENDPOINT" \
        --content-type "audio/mpeg" \
        --quiet 2>/dev/null; then
        echo "✅"
        TOTAL_FILES=$((TOTAL_FILES + 1))
      else
        echo "❌ upload failed"
        FAILED_FILES=$((FAILED_FILES + 1))
      fi
      # Clean up immediately to save disk space
      rm -f "$LOCAL_PATH"
    else
      echo "❌ download failed"
      FAILED_FILES=$((FAILED_FILES + 1))
    fi
  done

  # Clean up folder
  rm -rf "$FOLDER_DIR"
  echo ""
done

# ── Summary ───────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Migration complete!"
echo "   Total files: $TOTAL_FILES"
echo "   Failed: $FAILED_FILES"
echo ""
echo "📋 Verify with:"
echo "   aws s3 ls s3://$R2_BUCKET/reciters/ --endpoint-url $R2_ENDPOINT"
echo ""
echo "🌐 Public access URL pattern (after enabling public access):"
echo "   https://pub-<hash>.r2.dev/reciters/{folder}/{surah}.mp3"
echo "   Or with custom domain: https://cdn.bayaan.app/reciters/{folder}/{surah}.mp3"
