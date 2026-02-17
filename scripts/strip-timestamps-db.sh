#!/bin/bash
# Generates a stripped timestamps.db from the full source DB.
# Removes: segments column, ayah_audio tables, qul source data.
#
# Usage: bash scripts/strip-timestamps-db.sh /path/to/full/timestamps.db

set -euo pipefail

SOURCE="${1:?Usage: $0 <path-to-full-timestamps.db>}"
OUTPUT="assets/data/timestamps.db"

if [ ! -f "$SOURCE" ]; then
  echo "Error: source DB not found at $SOURCE"
  exit 1
fi

rm -f "$OUTPUT"

# Create empty schema (no segments column, no ayah_audio tables)
sqlite3 "$OUTPUT" <<'SQL'
CREATE TABLE timestamp_meta (
  rewayat_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'qurancom',
  audio_source TEXT NOT NULL DEFAULT 'quranicaudio',
  version INTEGER NOT NULL DEFAULT 1,
  total_ayahs INTEGER NOT NULL,
  has_word_segments INTEGER NOT NULL DEFAULT 0,
  audio_url_pattern TEXT,
  url_padding TEXT NOT NULL DEFAULT 'padded'
);
CREATE TABLE ayah_timestamps (
  rewayat_id TEXT NOT NULL,
  surah_number INTEGER NOT NULL,
  ayah_number INTEGER NOT NULL,
  timestamp_from INTEGER NOT NULL,
  timestamp_to INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  PRIMARY KEY (rewayat_id, surah_number, ayah_number)
);
CREATE INDEX idx_timestamps_surah ON ayah_timestamps(rewayat_id, surah_number);
SQL

# Copy only qurancom data (no segments, no qul, no ayah_audio)
sqlite3 "$OUTPUT" "
  ATTACH DATABASE '$SOURCE' AS src;

  INSERT INTO timestamp_meta
    SELECT rewayat_id, slug, source, audio_source, version, total_ayahs, 0, audio_url_pattern, url_padding
    FROM src.timestamp_meta WHERE source = 'qurancom';

  INSERT INTO ayah_timestamps
    SELECT rewayat_id, surah_number, ayah_number, timestamp_from, timestamp_to, duration_ms
    FROM src.ayah_timestamps
    WHERE rewayat_id IN (SELECT rewayat_id FROM src.timestamp_meta WHERE source = 'qurancom');

  DETACH src;
  VACUUM;
"

# Set schema version so the app knows this is v2
sqlite3 "$OUTPUT" "PRAGMA user_version = 2;"

# Produce gzipped copy for git
gzip -kf "$OUTPUT"

echo "Done:"
echo "  DB:  $(du -sh "$OUTPUT")"
echo "  GZ:  $(du -sh "$OUTPUT.gz")"
echo "  Meta rows:      $(sqlite3 "$OUTPUT" 'SELECT count(*) FROM timestamp_meta')"
echo "  Timestamp rows: $(sqlite3 "$OUTPUT" 'SELECT count(*) FROM ayah_timestamps')"
