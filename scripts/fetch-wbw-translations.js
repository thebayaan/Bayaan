#!/usr/bin/env node

/**
 * Fetches word-by-word translations from the Quran Foundation API (v4)
 * and builds a SQLite database for bundling in the app.
 *
 * Usage:
 *   node scripts/fetch-wbw-translations.js [--language en]
 *
 * Output:
 *   data/wbw/wbw-en.db   (SQLite database)
 *   data/wbw/wbw-en.json  (intermediate JSON, can be deleted)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ── Config ──────────────────────────────────────────────────────────

const API_BASE = 'https://api.quran.com/api/v4';
const TOTAL_CHAPTERS = 114;
const PER_PAGE = 50; // API max per request
const DELAY_MS = 300; // Be respectful to the API
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'wbw');

// Parse --language flag (default: en)
const langIdx = process.argv.indexOf('--language');
const LANGUAGE = langIdx !== -1 ? process.argv[langIdx + 1] : 'en';

// ── Helpers ─────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ── Fetch all words for a single chapter (handles pagination) ──────

async function fetchChapterWords(chapterNumber) {
  const words = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url =
      `${API_BASE}/verses/by_chapter/${chapterNumber}` +
      `?language=${LANGUAGE}&words=true&per_page=${PER_PAGE}&page=${page}` +
      `&word_fields=text_uthmani,text_indopak`;

    const json = await fetchJSON(url);
    totalPages = json.pagination.total_pages;

    for (const verse of json.verses) {
      for (const word of verse.words) {
        // Skip verse-end markers (٧, ٢, etc.)
        if (word.char_type_name !== 'word') continue;

        words.push({
          verse_key: verse.verse_key,
          position: word.position,
          text_uthmani: word.text_uthmani || '',
          text_indopak: word.text_indopak || '',
          translation: word.translation?.text || '',
          transliteration: word.transliteration?.text || '',
          audio_url: word.audio_url || '',
        });
      }
    }

    page++;
    if (page <= totalPages) await sleep(DELAY_MS);
  }

  return words;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nFetching word-by-word translations (language: ${LANGUAGE})`);
  console.log('─'.repeat(55));

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const allWords = [];
  const startTime = Date.now();

  for (let ch = 1; ch <= TOTAL_CHAPTERS; ch++) {
    process.stdout.write(`  Chapter ${String(ch).padStart(3)}/114 ...`);
    const words = await fetchChapterWords(ch);
    allWords.push(...words);
    console.log(` ${words.length} words`);
    if (ch < TOTAL_CHAPTERS) await sleep(DELAY_MS);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('─'.repeat(55));
  console.log(`  Total: ${allWords.length} words in ${elapsed}s\n`);

  // Save intermediate JSON
  const jsonPath = path.join(OUTPUT_DIR, `wbw-${LANGUAGE}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(allWords));
  console.log(`  JSON saved: ${jsonPath}`);

  // Build SQLite database using Python (built-in sqlite3)
  const dbPath = path.join(OUTPUT_DIR, `wbw-${LANGUAGE}.db`);
  buildSQLite(jsonPath, dbPath);

  console.log(`  SQLite saved: ${dbPath}`);
  console.log(
    `  Size: ${(fs.statSync(dbPath).size / 1024 / 1024).toFixed(2)} MB\n`,
  );

  // Print sample for verification
  console.log('  Sample (1:1):');
  const sample = allWords.filter(w => w.verse_key === '1:1');
  for (const w of sample) {
    console.log(
      `    [${w.position}] ${w.text_uthmani} → "${w.translation}" (${w.transliteration})`,
    );
  }
  console.log();
}

// ── SQLite builder (calls Python with execFileSync — no shell) ──────

function buildSQLite(jsonPath, dbPath) {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const pythonScript = `
import json, sqlite3, sys

with open(sys.argv[1], 'r') as f:
    words = json.load(f)

conn = sqlite3.connect(sys.argv[2])
c = conn.cursor()

c.execute('''
    CREATE TABLE words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        verse_key TEXT NOT NULL,
        position INTEGER NOT NULL,
        text_uthmani TEXT,
        text_indopak TEXT,
        translation TEXT NOT NULL,
        transliteration TEXT,
        audio_url TEXT
    )
''')

c.execute('CREATE INDEX idx_words_verse ON words (verse_key, position)')

c.executemany(
    'INSERT INTO words (verse_key, position, text_uthmani, text_indopak, translation, transliteration, audio_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [(w['verse_key'], w['position'], w['text_uthmani'], w['text_indopak'], w['translation'], w['transliteration'], w['audio_url']) for w in words]
)

conn.commit()
conn.close()
print(f'  Created SQLite with {len(words)} rows')
`;

  execFileSync('python3', ['-c', pythonScript, jsonPath, dbPath], {
    stdio: 'inherit',
  });
}

main().catch(err => {
  console.error('\nError:', err.message);
  process.exit(1);
});
