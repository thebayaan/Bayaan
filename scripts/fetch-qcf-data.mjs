#!/usr/bin/env node
// Fetches per-page word/glyph mapping for QCF V2 mushaf rendering from the
// Quran Foundation public API. Output: data/mushaf/qcf/qcf-pages.json
//
// Run: node scripts/fetch-qcf-data.mjs
// Re-run only when KFGQPC publishes a new QCF V2 revision.

import {writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const OUT_PATH = join(REPO_ROOT, 'data/mushaf/qcf/qcf-pages.json');

const BASE = 'https://api.quran.com/api/v4';
const FIELDS = ['code_v2', 'text_qpc_hafs', 'location', 'char_type_name'].join(
  ',',
);
const TOTAL_PAGES = 604;
const CONCURRENCY = 8;

async function fetchPage(page) {
  const url = `${BASE}/verses/by_page/${page}?words=true&word_fields=${FIELDS}&mushaf=2&per_page=300`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`page ${page}: HTTP ${res.status}`);
  const json = await res.json();

  const linesMap = new Map();
  for (const verse of json.verses) {
    for (const w of verse.words) {
      const ln = w.line_number;
      if (!linesMap.has(ln)) linesMap.set(ln, []);
      linesMap.get(ln).push({
        c: w.code_v2,
        l: w.location,
        t: w.char_type_name === 'end' ? 'e' : 'w',
        f: w.text_qpc_hafs,
      });
    }
  }

  const lines = [...linesMap.keys()]
    .sort((a, b) => a - b)
    .map(ln => ({n: ln, w: linesMap.get(ln)}));

  return {p: page, l: lines};
}

async function main() {
  mkdirSync(dirname(OUT_PATH), {recursive: true});

  const out = new Array(TOTAL_PAGES);
  let done = 0;

  async function worker(queue) {
    while (queue.length) {
      const page = queue.shift();
      try {
        out[page - 1] = await fetchPage(page);
      } catch (e) {
        console.error(`! page ${page}:`, e.message);
        process.exitCode = 1;
        return;
      }
      done++;
      if (done % 25 === 0 || done === TOTAL_PAGES) {
        process.stderr.write(`  fetched ${done}/${TOTAL_PAGES}\n`);
      }
    }
  }

  const queue = Array.from({length: TOTAL_PAGES}, (_, i) => i + 1);
  const workers = Array.from({length: CONCURRENCY}, () => worker(queue));
  await Promise.all(workers);

  if (out.some(x => !x)) {
    console.error('! some pages failed to fetch; aborting write');
    process.exit(1);
  }

  // Compact format: {pages: [{p, l: [{n, w: [{c,l,t,f}, ...]}, ...]}, ...]}
  const payload = {pages: out};
  writeFileSync(OUT_PATH, JSON.stringify(payload));
  const bytes = JSON.stringify(payload).length;
  console.log(`wrote ${OUT_PATH}`);
  console.log(`  ${bytes.toLocaleString()} bytes (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`  pages: ${out.length}`);
  console.log(
    `  total words: ${out.reduce((s, p) => s + p.l.reduce((s2, l) => s2 + l.w.length, 0), 0)}`,
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
