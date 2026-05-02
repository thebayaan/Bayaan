#!/usr/bin/env node
// Fetches per-page word/glyph mapping for QCF V2 mushaf rendering from
// the Quran Foundation public API. Output: data/mushaf/qcf/qcf-pages.json
//
// Run: node scripts/fetch-qcf-data.mjs
// Re-run only when KFGQPC publishes a new QCF V2 revision.
//
// Why two API calls per page AND per-word page filtering:
//   api.quran.com has TWO compounding bugs in the by-page endpoint:
//
//   Bug 1 (issue #553): requesting `code_v2` together with `line_number`
//   in the same `word_fields` set returns wrong line_number values on
//   dozens of pages. Workaround: split into two requests, never combine
//   those fields.
//
//   Bug 2: the by-page endpoint sometimes includes words from verses
//   that don't actually belong on that page. Each word still carries a
//   correct per-word `page_number` field — but the by-page grouping is
//   sloppy. Workaround: filter to only keep words whose `page_number`
//   matches the requested page.
//
//   Combined fix:
//     pass 1 — line_number + location + char_type_name + text_qpc_hafs
//              + page_number  (correct line numbers; can verify the
//              word truly belongs on this page)
//     pass 2 — code_v2 + location  (correct codepoints; merge by location)
//   Drop any word from pass 1 whose page_number != requested page.

import {writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const OUT_PATH = join(REPO_ROOT, 'data/mushaf/qcf/qcf-pages.json');

const BASE = 'https://api.quran.com/api/v4';
const TOTAL_PAGES = 604;
const CONCURRENCY = 8;

async function fetchPage(page) {
  const url1 = `${BASE}/verses/by_page/${page}?words=true&word_fields=line_number,location,char_type_name,text_qpc_hafs,page_number&mushaf=2&per_page=300`;
  const url2 = `${BASE}/verses/by_page/${page}?words=true&word_fields=code_v2,location,page_number&mushaf=2&per_page=300`;

  const [res1, res2] = await Promise.all([fetch(url1), fetch(url2)]);
  if (!res1.ok) throw new Error(`page ${page}: HTTP ${res1.status} (pass 1)`);
  if (!res2.ok) throw new Error(`page ${page}: HTTP ${res2.status} (pass 2)`);
  const [json1, json2] = await Promise.all([res1.json(), res2.json()]);

  // Build location -> code_v2 lookup from pass 2. Only include words
  // whose per-word page_number matches the requested page (drops
  // off-page words returned by the buggy by-page grouping).
  const codeByLocation = new Map();
  for (const verse of json2.verses) {
    for (const w of verse.words) {
      if (w.page_number !== page) continue;
      codeByLocation.set(w.location, w.code_v2);
    }
  }

  // Group pass-1 words by line, attach the matching code_v2. Same
  // per-word page_number filter applies.
  const linesMap = new Map();
  for (const verse of json1.verses) {
    for (const w of verse.words) {
      if (w.page_number !== page) continue;
      const ln = w.line_number;
      if (!linesMap.has(ln)) linesMap.set(ln, []);
      linesMap.get(ln).push({
        c: codeByLocation.get(w.location) ?? '',
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
