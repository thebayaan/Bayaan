// scripts/adhkar-content/textPolish.ts
// Text polish for data/adhkar.json (2026-10-13): transliterations and
// instructions, 99 Names meanings, rows restored from hisnmuslim.com, rows
// and a category title corrected from published editions, Arabic and
// transliteration marker fixes and the meta totals. Every value comes from a JSON input next to this
// file; nothing is written here by hand. Every step is idempotent.
// No '@/' imports: tsx scripts import this file.
import translitJson from './translit.json';
import fitrahiveJson from './translitFitrahive.json';
import namesJson from './names.json';
import hisnmuslimJson from './hisnmuslimRows.json';
import markerJson from './markerFixes.json';
import translitMarkerJson from './translitMarkerFixes.json';
import rowFixesJson from './rowFixes.json';
import type {SeedFile, SeedRow} from './adhkarFixes';

export const NAMES_CATEGORY = 'names-of-allah';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function entriesOf(value: unknown, file: string): [string, unknown][] {
  if (!isRecord(value)) throw new Error(`${file} must be an object`);
  return Object.entries(value);
}

// ---- Inputs -----------------------------------------------------------------

/** "UNCHANGED" keeps the row's current instruction. */
export const UNCHANGED = 'UNCHANGED';

export interface TranslitEntry {
  transliteration: string | null;
  instruction: string | null;
  source: string;
  sourceUrl: string;
}

export interface FitrahiveEntry {
  transliteration: string;
  arabic: string;
  sourceUrl: string;
}

export interface NameEntry {
  meaning: string;
  transliteration: string;
  sourceUrl: string;
}

export interface SiteRow {
  arabic: string;
  translation: string;
  arabicUrl: string;
  englishUrl: string;
}

export interface MarkerFix {
  before: string;
  after: string;
}

export interface TranslationFix {
  translation: string;
  sourceUrl: string;
}

export interface CategoryTitleFix {
  title: string;
  sourceUrl: string;
}

export interface RowFixes {
  rows: Record<string, TranslationFix>;
  categories: Record<string, CategoryTitleFix>;
}

function parseTranslit(value: unknown): Record<string, TranslitEntry> {
  const out: Record<string, TranslitEntry> = {};
  for (const [id, entry] of entriesOf(value, 'translit.json')) {
    if (
      !isRecord(entry) ||
      !isNullableString(entry.transliteration) ||
      !isNullableString(entry.instruction) ||
      typeof entry.source !== 'string' ||
      typeof entry.sourceUrl !== 'string'
    ) {
      throw new Error(`translit.json: malformed row ${id}`);
    }
    out[id] = {
      transliteration: entry.transliteration,
      instruction: entry.instruction,
      source: entry.source,
      sourceUrl: entry.sourceUrl,
    };
  }
  return out;
}

function parseFitrahive(value: unknown): Record<string, FitrahiveEntry> {
  const out: Record<string, FitrahiveEntry> = {};
  for (const [id, entry] of entriesOf(value, 'translitFitrahive.json')) {
    if (
      !isRecord(entry) ||
      typeof entry.transliteration !== 'string' ||
      typeof entry.arabic !== 'string' ||
      typeof entry.sourceUrl !== 'string'
    ) {
      throw new Error(`translitFitrahive.json: malformed row ${id}`);
    }
    out[id] = {
      transliteration: entry.transliteration,
      arabic: entry.arabic,
      sourceUrl: entry.sourceUrl,
    };
  }
  return out;
}

function parseNames(value: unknown): Record<string, NameEntry> {
  const out: Record<string, NameEntry> = {};
  for (const [id, entry] of entriesOf(value, 'names.json')) {
    if (
      !isRecord(entry) ||
      typeof entry.meaning !== 'string' ||
      typeof entry.transliteration !== 'string' ||
      typeof entry.sourceUrl !== 'string'
    ) {
      throw new Error(`names.json: malformed row ${id}`);
    }
    out[id] = {
      meaning: entry.meaning,
      transliteration: entry.transliteration,
      sourceUrl: entry.sourceUrl,
    };
  }
  return out;
}

function parseSiteRows(value: unknown): Record<string, SiteRow> {
  const out: Record<string, SiteRow> = {};
  for (const [id, entry] of entriesOf(value, 'hisnmuslimRows.json')) {
    if (
      !isRecord(entry) ||
      typeof entry.arabic !== 'string' ||
      typeof entry.translation !== 'string' ||
      typeof entry.arabicUrl !== 'string' ||
      typeof entry.englishUrl !== 'string'
    ) {
      throw new Error(`hisnmuslimRows.json: malformed row ${id}`);
    }
    out[id] = {
      arabic: entry.arabic,
      translation: entry.translation,
      arabicUrl: entry.arabicUrl,
      englishUrl: entry.englishUrl,
    };
  }
  return out;
}

function parseMarkerFixes(
  value: unknown,
  file: string,
): Record<string, MarkerFix> {
  const out: Record<string, MarkerFix> = {};
  for (const [id, entry] of entriesOf(value, file)) {
    if (
      !isRecord(entry) ||
      typeof entry.before !== 'string' ||
      typeof entry.after !== 'string'
    ) {
      throw new Error(`${file}: malformed row ${id}`);
    }
    out[id] = {before: entry.before, after: entry.after};
  }
  return out;
}

function parseRowFixes(value: unknown): RowFixes {
  if (!isRecord(value)) throw new Error('rowFixes.json must be an object');
  const rows: Record<string, TranslationFix> = {};
  for (const [id, entry] of entriesOf(value.rows, 'rowFixes.json rows')) {
    if (
      !isRecord(entry) ||
      typeof entry.translation !== 'string' ||
      typeof entry.sourceUrl !== 'string'
    ) {
      throw new Error(`rowFixes.json: malformed row ${id}`);
    }
    rows[id] = {translation: entry.translation, sourceUrl: entry.sourceUrl};
  }
  const categories: Record<string, CategoryTitleFix> = {};
  for (const [id, entry] of entriesOf(
    value.categories,
    'rowFixes.json categories',
  )) {
    if (
      !isRecord(entry) ||
      typeof entry.title !== 'string' ||
      typeof entry.sourceUrl !== 'string'
    ) {
      throw new Error(`rowFixes.json: malformed category ${id}`);
    }
    categories[id] = {title: entry.title, sourceUrl: entry.sourceUrl};
  }
  return {rows, categories};
}

export const TRANSLITERATIONS = parseTranslit(translitJson);
export const FITRAHIVE_ALTERNATIVES = parseFitrahive(fitrahiveJson);
export const NAME_MEANINGS = parseNames(namesJson);
export const SITE_ROWS = parseSiteRows(hisnmuslimJson);
export const MARKER_FIXES = parseMarkerFixes(markerJson, 'markerFixes.json');
export const TRANSLIT_MARKER_FIXES = parseMarkerFixes(
  translitMarkerJson,
  'translitMarkerFixes.json',
);
export const ROW_FIXES = parseRowFixes(rowFixesJson);

// ---- Transliterations ---------------------------------------------------------

// Rows whose research value is unusable (77 drifts into the evening wording,
// 125 is another dua's English, the evening 80/81 forms have
// no published transliteration). They take the MIT fitrahive value only when
// its Arabic has the same words as the row's (same letter skeleton, see
// arabicSkeleton); otherwise null.
export const FITRAHIVE_RULED_IDS: readonly string[] = [
  '77',
  '125',
  'evening-80',
  'evening-81',
];

// Row 133's translation already holds the source's English (adhkarFixes
// TEXT_FIXES); copying it into the instruction too would show it twice.
export const KEEP_INSTRUCTION_IDS: readonly string[] = ['133'];

/** Arabic letters only, with alef, ya and ta marbuta forms folded. */
export function arabicSkeleton(text: string): string {
  return text
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[^ء-ي]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

export function ruledTransliteration(row: SeedRow): string | null {
  const alternative = FITRAHIVE_ALTERNATIVES[row.id];
  if (!alternative) return null;
  return arabicSkeleton(alternative.arabic) === arabicSkeleton(row.arabic)
    ? alternative.transliteration
    : null;
}

export function applyTransliterations(seed: SeedFile): SeedFile {
  const ruled = new Set(FITRAHIVE_RULED_IDS);
  const keepInstruction = new Set(KEEP_INSTRUCTION_IDS);
  const seen = new Set<string>();
  const adhkar = seed.adhkar.map(row => {
    if (row.category_id === NAMES_CATEGORY) return row;
    const entry = TRANSLITERATIONS[row.id];
    if (!entry) throw new Error(`translit.json has no row ${row.id}`);
    seen.add(row.id);
    const instruction =
      entry.instruction === UNCHANGED || keepInstruction.has(row.id)
        ? row.instruction
        : entry.instruction;
    return {
      ...row,
      transliteration: ruled.has(row.id)
        ? ruledTransliteration(row)
        : entry.transliteration,
      instruction,
    };
  });
  const unknown = Object.keys(TRANSLITERATIONS).filter(id => !seen.has(id));
  if (unknown.length > 0) {
    throw new Error(`translit.json has unknown rows: ${unknown.join(', ')}`);
  }
  return {...seed, adhkar};
}

// ---- 99 Names -------------------------------------------------------------------

// The source's romanization replaces ours only where ours is broken.
export const NAME_SOURCE_TRANSLITERATION_IDS: readonly string[] = ['name-91'];
// Instructions holding a stray translation (name-50 is French) instead of
// guidance.
export const NAME_STRAY_INSTRUCTION_IDS: readonly string[] = ['name-50'];

/** Trimmed, with the one apostrophe most rows use (straight). */
export function tidyNameTransliteration(value: string): string {
  return value.replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
}

/** Drops scrape escapes (a backslash before a quote, name-6). */
export function unescapeQuotes(value: string | null): string | null {
  return value === null ? null : value.replace(/\\(["'])/g, '$1');
}

const QURAN_REFERENCES = /^(.*?)\s*\|\s*Quran:\s*(.*)$/s;
const REFERENCE = /\(\s*(\d+\s*:\s*\d+(?:\s*-\s*\d+)?)\s*\)/g;

/**
 * "text | Quran: (2:163) (3: 31)" becomes "text\nQuran: 2:163, 3:31".
 * Rows without the " | Quran:" part, or with a reference that is not
 * s:a or s:a-b, are returned unchanged.
 */
// Digit typos in the source references (name-8, Al-Aziz: 4:158 and 48:7
// both end "Exalted in Might, Wise").
const REFERENCE_TYPOS: ReadonlyArray<readonly [string, string]> = [
  ['(4:15 8)', '(4:158)'],
  ['(4 8:7)', '(48:7)'],
];

export function tidyQuranReferences(instruction: string | null): string | null {
  if (instruction === null) return null;
  const fixed = REFERENCE_TYPOS.reduce(
    (text, [typo, ref]) => text.replace(typo, ref),
    instruction,
  );
  const match = QURAN_REFERENCES.exec(fixed);
  if (!match) return instruction;
  const text = match[1].replace(/ {2,}/g, ' ').trim();
  const rest = match[2].trim();
  if (rest.replace(REFERENCE, '').trim() !== '') return instruction;
  const refs: string[] = [];
  for (const ref of rest.matchAll(REFERENCE)) {
    const clean = ref[1].replace(/\s+/g, '');
    if (!refs.includes(clean)) refs.push(clean);
  }
  if (refs.length === 0) return instruction;
  return `${text}\nQuran: ${refs.join(', ')}`;
}

export function applyNameFixes(seed: SeedFile): SeedFile {
  const fromSource = new Set(NAME_SOURCE_TRANSLITERATION_IDS);
  const stray = new Set(NAME_STRAY_INSTRUCTION_IDS);
  return {
    ...seed,
    adhkar: seed.adhkar.map(row => {
      if (row.category_id !== NAMES_CATEGORY) return row;
      const entry = NAME_MEANINGS[row.id];
      if (!entry) throw new Error(`names.json has no row ${row.id}`);
      return {
        ...row,
        translation: entry.meaning,
        transliteration: fromSource.has(row.id)
          ? entry.transliteration
          : tidyNameTransliteration(row.transliteration ?? ''),
        instruction: stray.has(row.id)
          ? null
          : tidyQuranReferences(unescapeQuotes(row.instruction)),
      };
    }),
  };
}

// ---- Rows restored from hisnmuslim.com --------------------------------------------

export function applySiteRows(seed: SeedFile): SeedFile {
  return {
    ...seed,
    adhkar: seed.adhkar.map(row => {
      const site = SITE_ROWS[row.id];
      if (!site) return row;
      return {...row, arabic: site.arabic, translation: site.translation};
    }),
  };
}

// ---- Rows and a category title from published editions -------------------------

export function applyRowFixes(seed: SeedFile): SeedFile {
  const {rows, categories} = ROW_FIXES;
  return {
    ...seed,
    categories: seed.categories.map(category =>
      Object.hasOwn(categories, category.id)
        ? {...category, title: categories[category.id].title}
        : category,
    ),
    adhkar: seed.adhkar.map(row => {
      const translation = Object.hasOwn(rows, row.id)
        ? rows[row.id].translation
        : row.translation;
      const categoryName = Object.hasOwn(categories, row.category_id)
        ? categories[row.category_id].title
        : row.category_name;
      return {...row, translation, category_name: categoryName};
    }),
  };
}

// ---- Markers ------------------------------------------------------------------------

const MARKS = /[()[\]﴾﴿]/g;

/** Text with (( )), ( ), [ ], ﴿ ﴾ and spacing removed. */
export function withoutMarkers(text: string): string {
  return text.replace(MARKS, '').replace(/\s+/g, ' ').trim();
}

/**
 * The letters and punctuation of a text, without markers (with the { } of
 * the transliterations), commas and whitespace, so a fix may turn a gloss's
 * parentheses into commas (row 238) but never change a letter.
 */
export function markerFreeText(text: string): string {
  return text.replace(/[()[\]{}﴾﴿،,\s]/g, '');
}

export function applyMarkerFixes(seed: SeedFile): SeedFile {
  return {
    ...seed,
    adhkar: seed.adhkar.map(row => {
      const fix = MARKER_FIXES[row.id];
      if (!fix || row.arabic === fix.after) return row;
      if (row.arabic !== fix.before) {
        throw new Error(`marker fix for ${row.id} no longer matches its text`);
      }
      if (markerFreeText(fix.before) !== markerFreeText(fix.after)) {
        throw new Error(`marker fix for ${row.id} changes more than markers`);
      }
      return {...row, arabic: fix.after};
    }),
  };
}

// Transliterations take the Arabic marks so parseAdhkarArabic can render
// them: (( )) around the words to say, counts and placeholders outside.
export function applyTranslitMarkerFixes(seed: SeedFile): SeedFile {
  return {
    ...seed,
    adhkar: seed.adhkar.map(row => {
      const fix = TRANSLIT_MARKER_FIXES[row.id];
      if (!fix || row.transliteration === fix.after) return row;
      if (row.transliteration !== fix.before) {
        throw new Error(
          `transliteration marker fix for ${row.id} no longer matches its text`,
        );
      }
      if (markerFreeText(fix.before) !== markerFreeText(fix.after)) {
        throw new Error(
          `transliteration marker fix for ${row.id} changes more than markers`,
        );
      }
      return {...row, transliteration: fix.after};
    }),
  };
}

// ---- Meta ----------------------------------------------------------------------------

export function updateMetaTotals(seed: SeedFile): SeedFile {
  if (!isRecord(seed.meta)) return seed;
  return {
    ...seed,
    meta: {
      ...seed.meta,
      total_categories: seed.categories.length,
      total_duas: seed.adhkar.length,
    },
  };
}
