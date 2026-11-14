#!/usr/bin/env node
// Builds data/mushaf/qcf/qcf-pages.json: the page and line layout of Mushaf
// 1440 (the KFGQPC 1441H Madinah print), word by word, with each word's
// glyph code in the QCF V4 page fonts.
//
// Sources:
//   - Glyph codes: data/mushaf/qcf/qpc-quran-script.db (QUL "QPC V2 Glyph
//     word-by-word"; the V4 page fonts map the same codes to the same words).
//   - Line breaks: the Quran Foundation API, mushaf 19 (QCF V4 tajweed), the
//     layout the V4 glyphs were drawn for. It differs from the 1421H layout
//     on about half the pages: e.g. a surah title that ended a 1421H page
//     opens the next page in 1441H, so the page before it has 15 lines.
//   - Short (centred) lines: the 1421H layout DB marks them; in 1441H the
//     same page and line is centred and ends on the same word (checked
//     below; on page 528 it starts one word later).
//
// The API joins بَعْدَ مَا into one word in 2:181, 8:6 and 13:37, which shifts
// its word numbers, so words are matched by glyph code, never by location.
//
// Run: node scripts/build-qcf-1441-layout.mjs [--cache-dir <dir>] [--offline]
//   --cache-dir  keep the API responses there (re-runs read them back)
//   --offline    use only the cached responses

import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const SCRIPT_DB = join(REPO_ROOT, 'data/mushaf/qcf/qpc-quran-script.db');
const LAYOUT_1421_DB = join(REPO_ROOT, 'data/mushaf/qcf/qpc-mushaf-layout.db');
const OUT_PATH = join(REPO_ROOT, 'data/mushaf/qcf/qcf-pages.json');

const TOTAL_PAGES = 604;
const LINES_PER_PAGE = 15;
const MUSHAF_V4 = 19;
const API = 'https://api.qurancdn.com/api/qdc/verses/by_page';

const args = process.argv.slice(2);
const argValue = name => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const CACHE_DIR = argValue('--cache-dir') ?? join(tmpdir(), 'qcf-1441-api');
const OFFLINE = args.includes('--offline');

const fail = message => {
  throw new Error(message);
};

const locationKey = location => location.split(':').map(Number);
const compareLocations = (a, b) => {
  const x = locationKey(a);
  const y = locationKey(b);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

async function fetchPage(page) {
  const file = join(CACHE_DIR, `p${page}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  if (OFFLINE) fail(`page ${page}: not cached in ${CACHE_DIR}`);
  const url = `${API}/${page}?words=true&mushaf=${MUSHAF_V4}&per_page=all&word_fields=line_number,page_number,location`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      writeFileSync(file, JSON.stringify(json));
      return json;
    } catch (error) {
      if (attempt >= 4) fail(`page ${page}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

async function fetchAllPages() {
  mkdirSync(CACHE_DIR, {recursive: true});
  const responses = new Array(TOTAL_PAGES + 1);
  let next = 1;
  const worker = async () => {
    while (next <= TOTAL_PAGES) {
      const page = next++;
      responses[page] = await fetchPage(page);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return responses;
}

function readWords() {
  const db = new DatabaseSync(SCRIPT_DB, {readOnly: true});
  const rows = db
    .prepare('SELECT id, location, text FROM words ORDER BY id')
    .all();
  db.close();
  if (rows.length !== 83668) fail(`expected 83668 words, got ${rows.length}`);
  return rows.map(row => ({
    id: Number(row.id),
    location: row.location,
    code: row.text,
  }));
}

function readCentred1421() {
  const db = new DatabaseSync(LAYOUT_1421_DB, {readOnly: true});
  const rows = db
    .prepare(
      "SELECT page_number, line_number, last_word_id FROM pages WHERE is_centered = 1 AND line_type = 'ayah'",
    )
    .all();
  db.close();
  return rows.map(row => ({
    page: Number(row.page_number),
    line: Number(row.line_number),
    lastWordId: Number(row.last_word_id),
  }));
}

/** Each of our words with the 1441H line it sits on, page by page. */
function assignLines(words, responses) {
  const byLocation = new Map(words.map(word => [word.location, word]));
  const pages = [];
  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const apiWords = responses[page].verses
      .flatMap(verse => verse.words)
      .filter(word => word.page_number === page)
      .sort((a, b) => compareLocations(a.location, b.location));
    // The API's glyph stream for the page, one entry per glyph code.
    const stream = [];
    for (const word of apiWords) {
      for (const char of word.text) {
        if (char !== ' ') stream.push({char, line: word.line_number});
      }
    }
    // Our words of the page: the API never moves a word to another page, so
    // its first and last words bound ours.
    const first = byLocation.get(apiWords[0].location);
    const lastApi = apiWords[apiWords.length - 1].location;
    const pageWords = [];
    for (let id = first.id; id <= words.length; id++) {
      const word = words[id - 1];
      const [surah, ayah] = locationKey(word.location);
      const [lastSurah, lastAyah] = locationKey(lastApi);
      if (surah > lastSurah || (surah === lastSurah && ayah > lastAyah)) break;
      pageWords.push(word);
    }
    let position = 0;
    const lines = new Map();
    for (const word of pageWords) {
      const chars = [...word.code];
      let line = null;
      for (const char of chars) {
        const entry = stream[position++];
        if (!entry || entry.char !== char) {
          fail(`page ${page}: glyph codes differ at ${word.location}`);
        }
        if (line !== null && entry.line !== line) {
          fail(`page ${page}: ${word.location} spans two lines`);
        }
        line = entry.line;
      }
      if (!lines.has(line)) lines.set(line, []);
      lines.get(line).push(word);
    }
    if (position !== stream.length) {
      fail(`page ${page}: ${stream.length - position} API glyphs left over`);
    }
    pages.push({page, lines});
  }
  return pages;
}

/** The page's lines with their kinds, in order. */
function buildPageLines({page, lines}, centred) {
  const numbers = [...lines.keys()].sort((a, b) => a - b);
  const ayahLine = (n, words) => {
    const line = {n, k: 'a'};
    if (page <= 2 || centred.has(`${page}:${n}`)) line.c = 1;
    line.w = words.map(word => [word.id, word.location, word.code]);
    return line;
  };
  const out = [];
  if (page <= 2) {
    // The two opening pages sit in a frame: the print centres them. They
    // keep the 1421H structure: title, (basmala), then their ayah lines.
    out.push({n: 1, k: 's', s: page});
    if (page === 2) out.push({n: 2, k: 'b', s: 2});
    for (const n of numbers) out.push(ayahLine(out.length + 1, lines.get(n)));
    return out;
  }
  let expected = 1;
  for (const n of numbers) {
    const words = lines.get(n);
    const gap = n - expected;
    if (gap > 0) {
      const [surah, ayah, word] = locationKey(words[0].location);
      if (ayah !== 1 || word !== 1) {
        fail(`page ${page}: empty lines before ${words[0].location}`);
      }
      if (gap === 2) {
        out.push({n: expected, k: 's', s: surah});
        out.push({n: expected + 1, k: 'b', s: surah});
      } else if (gap === 1 && surah === 9) {
        // At-Tawbah opens without a basmala.
        out.push({n: expected, k: 's', s: surah});
      } else {
        fail(`page ${page}: ${gap} empty lines before surah ${surah}`);
      }
    }
    out.push(ayahLine(n, words));
    expected = n + 1;
  }
  if (out.length !== LINES_PER_PAGE) {
    fail(`page ${page}: ${out.length} lines (expected ${LINES_PER_PAGE})`);
  }
  return out;
}

async function main() {
  console.log(`API cache: ${CACHE_DIR}${OFFLINE ? ' (offline)' : ''}`);
  const words = readWords();
  const responses = await fetchAllPages();
  const assigned = assignLines(words, responses);

  // The 1421H layout's centred ayah lines (beyond the two opening pages) must
  // be centred lines in 1441H too: same page and line number, same last word.
  const centred = new Set();
  for (const {page, line, lastWordId} of readCentred1421()) {
    if (page <= 2) continue;
    const lineWords = assigned[page - 1].lines.get(line);
    if (!lineWords || lineWords[lineWords.length - 1].id !== lastWordId) {
      fail(`centred line ${page}:${line} differs in the 1441H layout`);
    }
    centred.add(`${page}:${line}`);
  }

  const pages = assigned.map(entry => ({
    p: entry.page,
    l: buildPageLines(entry, centred),
  }));

  // Every word exactly once, in reading order.
  const ids = pages.flatMap(p =>
    p.l.flatMap(line => (line.w ?? []).map(([id]) => id)),
  );
  ids.forEach((id, index) => {
    if (id !== index + 1) fail(`word order breaks at index ${index} (${id})`);
  });
  if (ids.length !== words.length) fail('not every word is placed');

  const payload = {
    format: 2,
    layout: 'KFGQPC V4 layout (1441H print)',
    pages,
  };
  writeFileSync(OUT_PATH, JSON.stringify(payload));
  const changed = pages.filter(p =>
    p.l.some(line => line.k !== 'a' && line.n === LINES_PER_PAGE),
  ).length;
  console.log(`wrote ${OUT_PATH}`);
  console.log(`  pages: ${pages.length}, words: ${ids.length}`);
  console.log(`  centred lines: ${centred.size + 13} (13 on pages 1-2)`);
  console.log(`  pages ending on a title: ${changed}`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
