#!/usr/bin/env node
// Scans data/mushaf/qcf/qcf-pages.json for corruption produced by the
// api.quran.com line_number-with-code_v2 bug (issue #553) and similar
// data anomalies.
//
// Run: node scripts/detect-qcf-corruption.mjs
//      node scripts/detect-qcf-corruption.mjs --severity=high
//      node scripts/detect-qcf-corruption.mjs --json    (machine-readable)
//
// Symptoms checked (each contributes to a per-page severity score):
//
//   Hard signals (almost certainly broken — score +3 each):
//     1. Backwards codepoint jump within a line (PUA codepoints should
//        increase monotonically through the line).
//     2. Duplicate PUA codepoint across lines on the same page (each
//        codepoint maps to one glyph in the page-font; a duplicate
//        means two lines reference the same glyph, impossible).
//     3. Line spans 5+ distinct verses (typical line is 1–3 verses).
//     4. Verse range goes backwards across consecutive lines (line N+1's
//        first word location precedes line N's last).
//     5. Line numbers have an internal gap (e.g., page lists lines
//        1,2,4,5 — line 3 missing in the middle).
//     6. First word's verse:word position has unexpected jump (not
//        verse 1 word 1 AND not contiguous with previous page).
//
//   Soft signals (suspicious but might be normal — score +1 each):
//     7. Line has >16 codepoints (typical max is 12–13).
//     8. Duplicate verse:word location appears on multiple words.
//     9. Page has fewer lines than the typical 13–15. Pages 1, 2, and
//        last-juz short surah pages legitimately have fewer; others
//        with <12 lines warrant review.
//     10. First line number > 3 (could be normal for surah-start pages
//         but flag for review).
//
// Pages with score >= 3 are reported as candidates for refetch.

import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '../data/mushaf/qcf/qcf-pages.json');

const args = process.argv.slice(2);
const SEVERITY_FILTER = args.find(a => a.startsWith('--severity='))
  ?.split('=')[1]; // 'high' | 'all'
const JSON_OUTPUT = args.includes('--json');

const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));

const HIGH_CP_THRESHOLD = 16;
const TOO_MANY_VERSES_PER_LINE = 5;
const TOO_FEW_LINES_PER_PAGE = 12;

// Pages that legitimately have fewer than 12 lines because they're at
// natural short-content boundaries (Al-Fatiha, juz 30 multi-surah pages).
// These suppress only the "too-few-lines" soft signal — other corruption
// signals still fire normally.
const EXPECTED_SHORT_PAGES = new Set([
  1, 2, 596, 598, 599, 600, 601, 602, 603, 604,
]);

function parseLoc(loc) {
  const [s, v, w] = loc.split(':').map(Number);
  return {s, v, w};
}

function compareLoc(a, b) {
  if (a.s !== b.s) return a.s < b.s ? -1 : 1;
  if (a.v !== b.v) return a.v < b.v ? -1 : 1;
  return a.w === b.w ? 0 : a.w < b.w ? -1 : 1;
}

function fmtLoc(l) {
  return `${l.s}:${l.v}:${l.w}`;
}

const HARD = 3;
const SOFT = 1;

const findings = [];
let prevPageLastLoc = null;

for (const page of data.pages) {
  const issues = [];
  let score = 0;
  const add = (kind, weight, detail) => {
    issues.push({kind, weight, detail});
    score += weight;
  };

  // Page-level: too few lines
  if (
    page.l.length < TOO_FEW_LINES_PER_PAGE &&
    !EXPECTED_SHORT_PAGES.has(page.p)
  ) {
    add(
      'too-few-lines',
      SOFT,
      `${page.l.length} lines (typical 13–15)`,
    );
  }

  // Page-level: gap in line numbering. Lines should be a contiguous
  // increasing sequence starting at some N (often 1, sometimes 2 or 3
  // on surah-start pages).
  const lineNumsSorted = page.l.map(l => l.n).sort((a, b) => a - b);
  for (let i = 1; i < lineNumsSorted.length; i++) {
    if (lineNumsSorted[i] !== lineNumsSorted[i - 1] + 1) {
      add(
        'line-number-gap',
        HARD,
        `lines jump from ${lineNumsSorted[i - 1]} to ${lineNumsSorted[i]}`,
      );
      break;
    }
  }

  // Page-level: leading lines missing without a likely surah-start reason.
  const firstLineNum = lineNumsSorted[0] ?? 0;
  if (firstLineNum > 3) {
    add(
      'missing-leading-lines',
      SOFT,
      `first line is ${firstLineNum}; expected 1–3`,
    );
  }

  // Per-page duplicate-codepoint detection (across all lines).
  const cpToLines = new Map();
  for (const line of page.l) {
    for (const word of line.w) {
      for (const c of word.c) {
        const cp = c.codePointAt(0);
        if (cp === 0x20) continue;
        if (!cpToLines.has(cp)) cpToLines.set(cp, new Set());
        cpToLines.get(cp).add(line.n);
      }
    }
  }
  const dupLines = [];
  for (const [cp, lines] of cpToLines) {
    if (lines.size > 1) {
      dupLines.push(
        `U+${cp.toString(16).toUpperCase()} on lines ${[...lines].join(',')}`,
      );
    }
  }
  if (dupLines.length > 0) {
    add(
      'duplicate-codepoint-across-lines',
      HARD,
      dupLines.slice(0, 4).join('; ') +
        (dupLines.length > 4 ? ` (+${dupLines.length - 4} more)` : ''),
    );
  }

  // Per-page duplicate verse:word location detection (different words
  // claiming the same location is data corruption).
  const locCount = new Map();
  for (const line of page.l) {
    for (const word of line.w) {
      locCount.set(word.l, (locCount.get(word.l) ?? 0) + 1);
    }
  }
  const dupLocs = [...locCount].filter(([, n]) => n > 1).map(([l]) => l);
  if (dupLocs.length > 0) {
    add(
      'duplicate-word-location',
      SOFT,
      dupLocs.slice(0, 4).join(', ') +
        (dupLocs.length > 4 ? ` (+${dupLocs.length - 4} more)` : ''),
    );
  }

  // Per-line checks
  let prevLineLastLoc = null;
  for (const line of page.l) {
    const cps = [];
    for (const word of line.w) {
      for (const c of word.c) cps.push(c.codePointAt(0));
    }

    // backwards codepoint jump within a line
    let prevPuaCp = null;
    for (const cp of cps) {
      if (cp === 0x20) continue;
      if (prevPuaCp !== null && cp < prevPuaCp) {
        add(
          'backwards-codepoint-jump',
          HARD,
          `line ${line.n}: U+${prevPuaCp.toString(16).toUpperCase()} → U+${cp.toString(16).toUpperCase()}`,
        );
        break;
      }
      prevPuaCp = cp;
    }

    if (cps.length > HIGH_CP_THRESHOLD) {
      add(
        'high-codepoint-count',
        SOFT,
        `line ${line.n}: ${cps.length} codepoints (typical max 12–13)`,
      );
    }

    // line covers too many verses
    const verseSet = new Set();
    for (const word of line.w) {
      const {s, v} = parseLoc(word.l);
      verseSet.add(`${s}:${v}`);
    }
    if (verseSet.size >= TOO_MANY_VERSES_PER_LINE) {
      add(
        'line-spans-many-verses',
        HARD,
        `line ${line.n}: ${verseSet.size} verses (${[...verseSet].slice(0, 4).join(', ')}${verseSet.size > 4 ? '...' : ''})`,
      );
    }

    // verse range goes backwards across lines
    if (line.w.length > 0) {
      const firstLoc = parseLoc(line.w[0].l);
      const lastLoc = parseLoc(line.w.at(-1).l);
      if (prevLineLastLoc && compareLoc(firstLoc, prevLineLastLoc) < 0) {
        add(
          'backwards-verse-range',
          HARD,
          `line ${line.n} starts at ${fmtLoc(firstLoc)} but previous line ended at ${fmtLoc(prevLineLastLoc)}`,
        );
      }
      prevLineLastLoc = lastLoc;
    }
  }

  // Cross-page check: page N's first word should be either a surah-start
  // (verse 1 word 1) OR the immediate successor of page N-1's last word.
  // Anything else means data is mis-aligned across pages.
  if (page.l.length > 0 && page.l[0].w.length > 0) {
    const firstLoc = parseLoc(page.l[0].w[0].l);
    if (prevPageLastLoc) {
      const isSurahStart = firstLoc.v === 1 && firstLoc.w === 1;
      const isContiguous =
        firstLoc.s === prevPageLastLoc.s &&
        ((firstLoc.v === prevPageLastLoc.v &&
          firstLoc.w === prevPageLastLoc.w + 1) ||
          (firstLoc.v === prevPageLastLoc.v + 1 && firstLoc.w === 1));
      // Also accept "next surah, verse 1" — surah boundary mid-page is ok
      const isNextSurahStart =
        firstLoc.s === prevPageLastLoc.s + 1 &&
        firstLoc.v === 1 &&
        firstLoc.w === 1;
      if (!isSurahStart && !isContiguous && !isNextSurahStart) {
        add(
          'page-boundary-discontinuity',
          HARD,
          `page starts at ${fmtLoc(firstLoc)} but previous page ended at ${fmtLoc(prevPageLastLoc)}`,
        );
      }
    }
  }

  // Update prevPageLastLoc for the next iteration
  if (page.l.length > 0 && page.l.at(-1).w.length > 0) {
    prevPageLastLoc = parseLoc(page.l.at(-1).w.at(-1).l);
  }

  if (issues.length > 0) {
    findings.push({page: page.p, score, issues});
  }
}

if (findings.length === 0) {
  console.log('No corruption signals found across all 604 pages.');
  process.exit(0);
}

// Sort by severity
findings.sort((a, b) => b.score - a.score);

const filtered =
  SEVERITY_FILTER === 'high' ? findings.filter(f => f.score >= HARD) : findings;

if (JSON_OUTPUT) {
  console.log(JSON.stringify(filtered, null, 2));
  process.exit(0);
}

const SEVERE_PAGES = filtered.filter(f => f.score >= 6).map(f => f.page);
const HARD_PAGES = filtered.filter(f => f.score >= HARD && f.score < 6).map(f => f.page);
const SOFT_PAGES = filtered.filter(f => f.score < HARD).map(f => f.page);

console.log(`Found ${filtered.length} suspect page(s).\n`);

console.log(
  `Severe (score ≥ 6): ${SEVERE_PAGES.length} pages — ${SEVERE_PAGES.join(', ') || '(none)'}`,
);
console.log(
  `Hard   (score 3–5): ${HARD_PAGES.length} pages — ${HARD_PAGES.join(', ') || '(none)'}`,
);
console.log(
  `Soft   (score 1–2): ${SOFT_PAGES.length} pages — ${SOFT_PAGES.join(', ') || '(none)'}`,
);
console.log();

for (const {page, score, issues} of filtered) {
  const tier = score >= 6 ? 'SEVERE' : score >= HARD ? 'HARD' : 'SOFT';
  console.log(`=== PAGE ${page}  [${tier}, score ${score}] ===`);
  const byKind = {};
  for (const i of issues) {
    byKind[i.kind] = byKind[i.kind] || [];
    byKind[i.kind].push(i.detail);
  }
  for (const [kind, details] of Object.entries(byKind)) {
    console.log(`  [${kind}]`);
    for (const d of details) console.log(`    - ${d}`);
  }
  console.log();
}

console.log(
  `---\nTotal: ${filtered.length} suspect pages (severe ${SEVERE_PAGES.length}, hard ${HARD_PAGES.length}, soft ${SOFT_PAGES.length}).`,
);
console.log(
  'Run with --severity=high to see only score>=3 (hard signal) pages.',
);
console.log('Run with --json for machine-readable output.');
