#!/usr/bin/env node
// Builds data/mushaf/qcf/qcf-pages.json from the QUL Tarteel datasets:
//
//   - data/mushaf/qcf/qpc-mushaf-layout.db (QUL "KFGQPC V2 Layout 1421H print")
//     → tables: pages (page_number, line_number, line_type, first_word_id,
//       last_word_id, surah_number), info
//
//   - data/mushaf/qcf/qpc-quran-script.db (QUL "QPC V2 Glyph word-by-word")
//     → table: words (id, location, surah, ayah, word, text)
//
// We only emit `ayah` lines into qcf-pages.json — surah_name and basmallah
// rendering is handled separately by QCFPage using DK page metadata and the
// hardcoded BASMALA_TEXT (page-1 font glyphs).
//
// Output shape matches our existing renderer's expectation:
//   {pages: [{p, l: [{n, w: [{c, l, t, f}]}]}]}
//
// Each word's `t` is 'e' (verse-end marker) if it is the highest-indexed
// word for its (surah, ayah), else 'w'. This mirrors the QF API's
// `char_type_name === 'end'` semantics our renderer already understands.
//
// Run: node scripts/build-qcf-from-qul.mjs

import {writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const LAYOUT_DB = join(REPO_ROOT, 'data/mushaf/qcf/qpc-mushaf-layout.db');
const SCRIPT_DB = join(REPO_ROOT, 'data/mushaf/qcf/qpc-quran-script.db');
const OUT_PATH = join(REPO_ROOT, 'data/mushaf/qcf/qcf-pages.json');

import {execFileSync} from 'node:child_process';

function sqlRows(db, sql) {
  // sqlite3 CLI with literal control-char separators (unlikely to appear in
  // Arabic text). Field separator 0x1f, row separator 0x1e.
  const out = execFileSync(
    'sqlite3',
    [
      '-bail',
      '-noheader',
      '-separator',
      '\x1f',
      '-newline',
      '\x1e',
      db,
    ],
    {input: sql, maxBuffer: 200 * 1024 * 1024},
  ).toString();

  if (!out) return [];
  return out
    .replace(/\x1e\n?$/, '')
    .split('\x1e')
    .filter(r => r.length > 0)
    .map(r => r.split('\x1f'));
}

function main() {
  console.log('reading layout...');
  const layoutRows = sqlRows(
    LAYOUT_DB,
    "SELECT page_number, line_number, line_type, COALESCE(first_word_id,''), COALESCE(last_word_id,'') FROM pages ORDER BY page_number, line_number",
  );
  console.log(`  ${layoutRows.length} layout rows`);

  console.log('reading words...');
  const wordRows = sqlRows(
    SCRIPT_DB,
    'SELECT id, location, surah, ayah, word, text FROM words ORDER BY id',
  );
  console.log(`  ${wordRows.length} word rows`);

  // Build word lookup by id.
  const wordById = new Map();
  // Track max-word-index per (surah, ayah) to identify verse-end markers.
  const maxWordPerVerse = new Map();
  for (const [id, location, surah, ayah, word, text] of wordRows) {
    const idN = Number(id);
    const surahN = Number(surah);
    const ayahN = Number(ayah);
    const wordN = Number(word);
    wordById.set(idN, {location, surah: surahN, ayah: ayahN, word: wordN, text});
    const key = `${surahN}:${ayahN}`;
    const cur = maxWordPerVerse.get(key) ?? 0;
    if (wordN > cur) maxWordPerVerse.set(key, wordN);
  }

  // Build per-page output
  const pagesMap = new Map();
  for (const row of layoutRows) {
    const [pageStr, lineStr, lineType, firstStr, lastStr] = row;
    const pageNumber = Number(pageStr);
    const lineNumber = Number(lineStr);

    if (!pagesMap.has(pageNumber))
      pagesMap.set(pageNumber, {p: pageNumber, l: []});

    // Only emit ayah lines into qcf-pages.json. surah_name + basmallah are
    // rendered by other code paths (SkiaSurahHeader + BASMALA_TEXT).
    if (lineType !== 'ayah') continue;

    if (!firstStr || !lastStr) continue;
    const first = Number(firstStr);
    const last = Number(lastStr);

    const lineWords = [];
    for (let id = first; id <= last; id++) {
      const w = wordById.get(id);
      if (!w) {
        console.warn(
          `! page ${pageNumber} line ${lineNumber}: missing word id ${id}`,
        );
        continue;
      }
      const isEnd =
        w.word === maxWordPerVerse.get(`${w.surah}:${w.ayah}`);
      lineWords.push({
        c: w.text,
        l: w.location,
        t: isEnd ? 'e' : 'w',
        f: '', // unused by current renderer
      });
    }

    pagesMap.get(pageNumber).l.push({n: lineNumber, w: lineWords});
  }

  // Sort pages
  const pages = [...pagesMap.values()].sort((a, b) => a.p - b.p);

  // Sanity: should be 604 pages
  if (pages.length !== 604) {
    console.warn(`! expected 604 pages, got ${pages.length}`);
  }

  const payload = {pages};
  const json = JSON.stringify(payload);
  writeFileSync(OUT_PATH, json);

  const totalWords = pages.reduce(
    (s, p) => s + p.l.reduce((s2, l) => s2 + l.w.length, 0),
    0,
  );
  console.log(`wrote ${OUT_PATH}`);
  console.log(`  ${json.length.toLocaleString()} bytes`);
  console.log(`  pages: ${pages.length}`);
  console.log(`  total words: ${totalWords}`);
}

main();
