#!/usr/bin/env node
/**
 * Generates services/mushaf/mushafTables.generated.ts: the verse index (word
 * counts) and the page lines of the Mushaf (a code for each line). Both are
 * the same for every rewayah (this script checks that), so the app does not
 * read them from a database at load, and digital-khatt-15-lines.db is not
 * bundled. It stays in the repository as the source of the page lines.
 *
 *   node scripts/rewayah/gen-mushaf-tables.mjs           # rewrite the module
 *   node scripts/rewayah/gen-mushaf-tables.mjs --check   # exit 1 if it is stale
 *
 * Run it after a change of any of these DBs, then gen-manifest.mjs: the module
 * records the sha256 of each DB it was generated from, gen-manifest.mjs fails
 * when one of them changed (so every release build does, see package.json),
 * and the manifest keys the saved layouts on the sha256 of the module.
 * services/mushaf/__tests__/rewayahDataManifest.test.ts runs the check.
 *
 * Needs Node >= 22.13 (node:sqlite). No other dependency.
 */
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const ASSET_DIR = path.join(REPO_ROOT, 'data/mushaf/digitalkhatt');
const OUT_FILE = 'services/mushaf/mushafTables.generated.ts';
const LAYOUT_DB = 'digital-khatt-15-lines.db';
const WORDS_DBS = [
  'digital-khatt-v2.db',
  'dk_words_shouba.db',
  'dk_words_bazzi.db',
  'dk_words_qumbul.db',
  'dk_words_warsh.db',
  'dk_words_qaloon.db',
  'dk_words_doori.db',
  'dk_words_soosi.db',
];
// One character for each page line (mushafTables.ts decodes it): an ayah line
// of n words is letter n of the alphabet, upper case, or lower case when the
// line is centred.
const SURAH_NAME = '#';
const BASMALA = '*';
const MAX_LINE_WORDS = 26;

function fail(message) {
  console.error(`[gen-mushaf-tables] ${message}`);
  process.exit(1);
}

function readRows(file, sql) {
  const db = new DatabaseSync(path.join(ASSET_DIR, file), {readOnly: true});
  try {
    return db.prepare(sql).all();
  } finally {
    db.close();
  }
}

/** Word counts in verse order, and verses per surah. Checks the contract. */
function readVerseCounts(file) {
  const rows = readRows(
    file,
    'SELECT surah, ayah, MIN(id) AS first, MAX(id) AS last, COUNT(*) AS n FROM words GROUP BY surah, ayah ORDER BY first',
  );
  const wordCounts = [];
  const surahVerses = [];
  let expectedFirst = 1;
  for (const row of rows) {
    if (row.first !== expectedFirst || row.last - row.first + 1 !== row.n) {
      fail(`${file}: ${row.surah}:${row.ayah} is not one id range in order`);
    }
    if (row.ayah === 1) {
      if (row.surah !== surahVerses.length + 1) {
        fail(`${file}: surah ${row.surah} is out of order`);
      }
      surahVerses.push(0);
    }
    surahVerses[surahVerses.length - 1] += 1;
    if (row.ayah !== surahVerses[surahVerses.length - 1]) {
      fail(`${file}: ${row.surah}:${row.ayah} is out of order`);
    }
    wordCounts.push(row.n);
    expectedFirst = row.last + 1;
  }
  return {wordCounts, surahVerses};
}

// A value a line type does not have: '' in the layout DB.
const none = value => value === '' || value === null;

/**
 * One string of line codes for each page. The rest of a line follows from the
 * order, so this checks it: the pages and the lines on a page have no gaps,
 * the ayah lines hold the word ids one after the other from 1 to `wordTotal`,
 * and the surah name lines come in surah order, one for each surah.
 */
function readPageLines(wordTotal, surahTotal) {
  const rows = readRows(
    LAYOUT_DB,
    'SELECT * FROM pages ORDER BY page_number, line_number',
  );
  const pages = [];
  let lastWord = 0;
  let surah = 0;
  for (const row of rows) {
    const where = `page ${row.page_number}, line ${row.line_number}`;
    if (row.page_number === pages.length + 1) pages.push('');
    if (row.page_number !== pages.length) fail(`${where}: a page is missing`);
    if (row.line_number !== pages[pages.length - 1].length + 1) {
      fail(`${where}: a line is missing`);
    }
    let code;
    if (row.line_type === 'surah_name') {
      surah += 1;
      if (row.surah_number !== surah) fail(`${where}: not surah ${surah}`);
      if (!none(row.first_word_id) || !none(row.last_word_id)) {
        fail(`${where}: a surah name line has word ids`);
      }
      if (row.is_centered !== 1) fail(`${where}: is not centred`);
      code = SURAH_NAME;
    } else if (row.line_type === 'basmallah') {
      if (
        !none(row.first_word_id) ||
        !none(row.last_word_id) ||
        !none(row.surah_number)
      ) {
        fail(`${where}: a basmala line has a word id or a surah`);
      }
      if (row.is_centered !== 1) fail(`${where}: is not centred`);
      code = BASMALA;
    } else if (row.line_type === 'ayah') {
      const words = row.last_word_id - row.first_word_id + 1;
      if (row.first_word_id !== lastWord + 1) {
        fail(`${where}: does not start at word ${lastWord + 1}`);
      }
      if (!(words >= 1 && words <= MAX_LINE_WORDS)) {
        fail(`${where}: has ${words} words`);
      }
      if (!none(row.surah_number)) fail(`${where}: an ayah line has a surah`);
      if (row.is_centered !== 0 && row.is_centered !== 1) {
        fail(`${where}: is_centered is ${row.is_centered}`);
      }
      code = String.fromCharCode(
        (row.is_centered ? 'a' : 'A').charCodeAt(0) + words - 1,
      );
      lastWord = row.last_word_id;
    } else {
      fail(`${where}: unknown line type ${row.line_type}`);
    }
    pages[pages.length - 1] += code;
  }
  if (lastWord !== wordTotal) {
    fail(`the ayah lines end at word ${lastWord}, not ${wordTotal}`);
  }
  if (surah !== surahTotal) {
    fail(`${surah} surah name lines, not ${surahTotal}`);
  }
  return pages;
}

// Prettier's output for a number array: as many as fit in 80 columns.
function renderNumbers(name, values) {
  const lines = [`export const ${name}: readonly number[] = [`];
  let line = ' ';
  for (const value of values) {
    const next = `${line} ${value},`;
    if (next.length > 80) {
      lines.push(line);
      line = `  ${value},`;
    } else {
      line = next;
    }
  }
  lines.push(line, '];', '');
  return lines;
}

function sha256(file) {
  return createHash('sha256')
    .update(readFileSync(path.join(ASSET_DIR, file)))
    .digest('hex');
}

function render({wordCounts, surahVerses}, pages) {
  return [
    '// AUTO-GENERATED by scripts/rewayah/gen-mushaf-tables.mjs. Do not edit by hand.',
    '//',
    '// The verse index and the page lines of the Mushaf (the same for every',
    '// rewayah). services/mushaf/mushafTables.ts decodes them on first use.',
    '// Generated from these files (sha256); gen-manifest.mjs fails when one',
    '// of them changes:',
    ...[LAYOUT_DB, ...WORDS_DBS].map(file => `//   ${sha256(file)} ${file}`),
    '',
    ...renderNumbers('SURAH_VERSE_COUNTS', surahVerses),
    ...renderNumbers('VERSE_WORD_COUNTS', wordCounts),
    `// One string for each page, one character for each line: ${SURAH_NAME} a surah`,
    `// name, ${BASMALA} a basmala, letter n an ayah line of n words (lower case: centred).`,
    'export const PAGE_LINES: readonly string[] = [',
    ...pages.map(codes => `  '${codes}',`),
    '];',
    '',
  ].join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter(a => a !== '--check');
  if (unknown.length > 0) fail(`unknown argument(s): ${unknown.join(' ')}`);

  const verses = readVerseCounts(WORDS_DBS[0]);
  const reference = JSON.stringify(verses);
  for (const file of WORDS_DBS.slice(1)) {
    if (JSON.stringify(readVerseCounts(file)) !== reference) {
      fail(`${file}: its verse index differs from ${WORDS_DBS[0]}`);
    }
  }

  const wordTotal = verses.wordCounts.reduce((sum, n) => sum + n, 0);
  const pages = readPageLines(wordTotal, verses.surahVerses.length);
  const rendered = render(verses, pages);
  const outPath = path.join(REPO_ROOT, OUT_FILE);
  const existing = existsSync(outPath) ? readFileSync(outPath, 'utf8') : null;
  if (args.includes('--check')) {
    if (existing !== rendered) {
      fail(
        `${OUT_FILE} is stale. Run: node scripts/rewayah/gen-mushaf-tables.mjs`,
      );
    }
    console.log(`[gen-mushaf-tables] ${OUT_FILE} is up to date`);
    return;
  }
  if (existing === rendered) {
    console.log(`[gen-mushaf-tables] ${OUT_FILE} already up to date`);
    return;
  }
  writeFileSync(outPath, rendered);
  console.log(`[gen-mushaf-tables] wrote ${OUT_FILE}`);
}

main();
