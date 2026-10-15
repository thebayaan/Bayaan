# Search Overhaul (Phase 1: Catalogue Search) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the six inconsistent surah/reciter matching implementations with one typo-tolerant, transliteration-aware, relevance-ranked engine, and route all nine search inputs through it.

**Architecture:** A dependency-free engine in `utils/search/` turns every searchable string into a normalized key, word tokens and a Latin consonant "skeleton", then scores each item through tiers (exact > prefix > word-prefix > substring > compact > skeleton > typo). Thin catalogue adapters (`utils/search/catalog.ts`) define surah and reciter fields and keep lazily built singleton indexes that rebuild when `RECITERS` is repopulated. Screens stop owning matching logic: they call `rankSurahs` / `rankReciters` (or `createSearchIndex` for non-catalogue lists) and render the ranked result.

**Tech Stack:** TypeScript (strict), React Native / Expo SDK 56, Jest (`jest-expo` preset). Removes `fuse.js`.

**Spec:** No separate spec. This plan implements the search audit delivered in chat on 2026-10-12 (verified at develop `6d0e9807`); its findings are restated in "Background" below so the plan stands alone. The engine design was prototyped and run against the real catalogue before this plan was written (results in "Prototype evidence").

## Background (from the audit)

Nine live search inputs, all mobile:

| # | Surface | File | Today |
|---|---|---|---|
| 1 | Home / Search tab | `components/search/SearchView.tsx` via `utils/catalogSearch.ts#createCatalogSearch` | Fuse.js; three reciter keys index nothing (`translated_name`, `description`, `style`); `useExtendedSearch` turns `!x` / `'x` into operators; rewayah names unsearchable |
| 2 | Browse Surahs | `components/browse/BrowseSurahs.tsx:212` | `matchesSurah` substring |
| 3 | Browse Reciters | `components/browse/BrowseReciters.tsx:271-283` | `matchesSearchText` substring |
| 4 | Mushaf reader search | `components/mushaf/MushafSearchView.tsx:318-329` | command parser, then `matchesSurah` |
| 5 | Settings > Default Reciter | `app/(tabs)/(d.settings)/default-reciter.tsx:38-52` | `toLowerCase().includes`, English only |
| 6 | Collection > Favorite reciters | `app/(tabs)/(c.collection)/collection/favorite-reciters.tsx:67-77` | `toLowerCase().includes`, UI-language name only |
| 7 | Reciter picker sheets (favorites + Mushaf) | `components/reciter-picker/ReciterPickerSheet.tsx#filterItems` | `matchesSearchText` |
| 8a | Organize upload, surah field | `components/sheets/OrganizeRecitationSheet.tsx:357` via `dataService.searchSurahs` | `matchesSurah` |
| 8b | Organize upload, reciter field | `components/sheets/OrganizeRecitationSheet.tsx:413-424` | `toLowerCase().includes`, untrimmed |
| 9 | Reciter profile surah search | `components/reciter-profile/ReciterProfile.tsx:428-437` | `toLowerCase().includes`, raw Arabic `includes`, no numbers |

Queries that fail today and must pass after this plan: `husary`, `mishari`, `abdul basit`, `abd al basit`, `shuraym`, `minshawy`, `ghamidi`, `mishray` (typo), `al fatihah`, `alfatiha`, `yasin`, `yaseen`, `bqara`, `fatihha`, `المومنون`, `مومنون`, `الفاتحه` (in #9), `36` (in #9), `العفاسي` (in #5, #8b), `warsh` (in #1).

## Prototype evidence

The code blocks in Tasks 1-3 were extracted verbatim from this document and run in Node 25 against `data/reciters-fallback.json` (224 reciters), `data/reciterNamesAr.json` and all 114 surahs, replaying every assertion in Tasks 1-4 (the catalogue fields were replicated inline because `catalog.ts` imports app modules). Result: **0 failures**. `dossary` legitimately matches three Al-Dosari reciters equally, so its golden test asserts top-three membership. Mean cost: **4.6 to 6.6 ms per reciter search** in Node. Hermes on a mid-range Android phone is typically 3-6x slower, so Task 8 measures on device and the screens defer the query with `useDeferredValue`.

## Global Constraints

- TypeScript strict. No `any`. No `as` casts except `as const`. Prefer type guards.
- Explicit parameter and return types on every exported function. `function` keyword for pure functions. No classes.
- Mark AI-written code per `docs/contributing/ai-guidelines.md`: whole new files start with `// @ai-generated`; edits to existing files use `// @ai` (single line) or `// @ai-start` / `// @ai-end`.
- All user-facing copy goes through i18n (`i18n/locales/{en,ar}/*.json`); both locales updated together.
- Never use em dashes anywhere (code, comments, commits, PR text).
- Do not change display strings or Quran text: normalization applies only to search keys.
- `normalizeSearchText` keeps its current output exactly (the Mushaf command parser depends on `:` and `ء` surviving). New folding goes in `toSearchKey` only.
- Before each commit: `npx prettier --write <changed files>` and `npx tsc --noEmit` clean.
- Tests: `npx jest --watchAll=false <path>`.
- Branch: `osmansaeday/small-ui-fixes` (based on `origin/develop`). Conventional commits. PR targets `develop`.

## Review Focus

1. **Catalogue not loaded yet.** `RECITERS` starts empty and `services/dataService.ts:77` refills it in place with `splice`. A reciter index built before that must rebuild on the next query instead of returning nothing forever. Pinned in Task 4 (`rebuilds when RECITERS is repopulated in place`).
2. **One- and two-character queries.** Typing `m` must show prefix matches only, not every name containing an `m`. Pinned in Task 2 (`short queries only use prefix tiers`).
3. **Pasted punctuation and operators.** `'abd`, `!x`, `Al-Fatihah (1)`, `A'n Nafi'` must behave like their letters, never like query syntax. Pinned in Task 2 (`punctuation is ignored, never treated as syntax`).
4. **Invisible characters and other digit systems.** RTL marks, zero-width joiners, Arabic-Indic and Persian digits. Pinned in Task 1 (`toSearchKey` cases) and Task 4 (surah number cases).
5. **Huge pastes.** Someone pastes a whole verse or paragraph. Search must stay bounded and not throw. Pinned in Task 2 (`caps very long queries`).

---

## File Structure

| File | Responsibility |
|---|---|
| `utils/search/normalize.ts` (create) | `normalizeSearchText` (moved, unchanged), `toSearchKey`, `tokenize`, `latinSkeleton`, `ARTICLES` |
| `utils/search/fuzzy.ts` (create) | `damerauLevenshtein`, `maxEditsFor` |
| `utils/search/createSearchIndex.ts` (create) | generic tiered ranking engine |
| `utils/search/keyboardLayout.ts` (create) | Arabic/English keyboard-layout swap for "typed with the wrong keyboard" fallback |
| `utils/search/catalog.ts` (create) | surah and reciter field definitions, singletons, `rankSurahs`, `rankReciters`, `createCatalogSearch` |
| `data/searchAliases.ts` (create) | well-known alternate surah names |
| `utils/search/__tests__/*.test.ts` (create) | unit + golden tests |
| `utils/catalogSearch.ts` (delete in Task 7) | replaced by `utils/search/*` |
| `data/featuredReciters.ts` (modify) | export `FEATURED_RECITER_NAMES` for the ranking tie-breaker |
| 9 screen files (modify) | call the engine instead of owning matching |

---

### Task 0: Commit the reciter picker work already on this branch

The shared `ReciterPickerSheet` work (favorites sheet + Mushaf picker) is uncommitted on this branch and Task 6 edits it.

**Files:** already modified: `components/reciter-picker/ReciterPickerSheet.tsx`, `components/sheets/FavoriteRecitersSheet.tsx`, `components/sheets/MushafReciterPickerSheet.tsx`, `components/sheets/MushafPlayerOptionsSheet.tsx`, `components/sheets/sheets.tsx`, `store/mushafPlayerStore.ts`, `i18n/locales/{en,ar}/sheets.json`

- [ ] **Step 1: Install dependencies in this worktree** (it has no `node_modules`)

Run: `npm ci --no-audit --no-fund`
Expected: exits 0.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npx jest --watchAll=false i18n`
Expected: no type errors; i18n tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/reciter-picker components/sheets/FavoriteRecitersSheet.tsx components/sheets/MushafReciterPickerSheet.tsx components/sheets/MushafPlayerOptionsSheet.tsx components/sheets/sheets.tsx store/mushafPlayerStore.ts i18n/locales/en/sheets.json i18n/locales/ar/sheets.json
git commit -m "feat: shared reciter picker sheet for favorites and mushaf playback"
```

---

### Task 1: Normalization and fuzzy primitives

**Files:**
- Create: `utils/search/normalize.ts`
- Create: `utils/search/fuzzy.ts`
- Modify: `utils/catalogSearch.ts` (re-export `normalizeSearchText` from the new module so existing imports keep working until Task 7)
- Test: `utils/search/__tests__/normalize.test.ts`, `utils/search/__tests__/fuzzy.test.ts`

**Interfaces:**
- Produces:
  - `normalizeSearchText(text: string): string` (same output as today)
  - `toSearchKey(text: string): string`
  - `tokenize(key: string): string[]`
  - `latinSkeleton(token: string): string`
  - `ARTICLES: ReadonlySet<string>`
  - `damerauLevenshtein(a: string, b: string, max: number): number` (returns `max + 1` once the distance exceeds `max`)
  - `maxEditsFor(length: number): number`

- [ ] **Step 1: Write the failing tests**

`utils/search/__tests__/normalize.test.ts`:

```ts
// @ai-generated
import {
  latinSkeleton,
  normalizeSearchText,
  toSearchKey,
  tokenize,
} from '../normalize';

describe('normalizeSearchText (unchanged contract)', () => {
  it.each([
    ['٢:٢٥٥', '2:255'],
    ['صَفْحَة ٢٢', 'صفحه 22'],
    ['جُزْء ٣٠', 'جزء 30'],
    ['الأَجْزَاء', 'الاجزاء'],
    ['  Mishary   Alafasi ', 'mishary alafasi'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeSearchText(input)).toBe(expected);
  });
});

describe('toSearchKey', () => {
  it.each([
    ['Al-Fatihah', 'al fatihah'],
    ["Hafs A'n Assem", 'hafs an assem'],
    ['Ya’qub', 'yaqub'],
    ['Al-Fatihah (1)', 'al fatihah 1'],
    ['Abdulbāsiṭ', 'abdulbasit'],
    ['المؤمنون', 'المومنون'],
    ['شاطئ', 'شاطي'],
    ['النبإ', 'النبا'],
    ['سماء', 'سما'],
    ['\u200f١١٢\u200f', '112'],
    ['ع\u200cبد', 'عبد'],
    ["'abd", 'abd'],
    ['!x', 'x'],
    ['   ', ''],
  ])('%s -> %s', (input, expected) => {
    expect(toSearchKey(input)).toBe(expected);
  });
});

describe('tokenize', () => {
  it('splits keys on spaces and returns [] for empty keys', () => {
    expect(tokenize('al fatihah')).toEqual(['al', 'fatihah']);
    expect(tokenize('')).toEqual([]);
  });
});

describe('latinSkeleton', () => {
  it.each([
    ['hussary', 'husary'],
    ['hosary', 'husary'],
    ['mishary', 'mishari'],
    ['shuraim', 'shuraym'],
    ['minshawi', 'minshawy'],
    ['ghamdi', 'ghamidi'],
    ['abdulbasit', 'abdelbaset'],
    ['abdurrahman', 'abdalrahman'],
    ['alafasi', 'afasy'],
    ['qatami', 'katami'],
  ])('%s and %s share a skeleton', (a, b) => {
    expect(latinSkeleton(a)).toBe(latinSkeleton(b));
  });

  it('keeps the first letter even when it is a vowel', () => {
    expect(latinSkeleton('ajmy')).toBe('ajm');
    expect(latinSkeleton('yasin')).toBe('ysn');
  });

  it('leaves non-Latin tokens untouched', () => {
    expect(latinSkeleton('العفاسي')).toBe('العفاسي');
    expect(latinSkeleton('112')).toBe('112');
  });
});
```

`utils/search/__tests__/fuzzy.test.ts`:

```ts
// @ai-generated
import {damerauLevenshtein, maxEditsFor} from '../fuzzy';

describe('damerauLevenshtein', () => {
  it.each([
    ['mishary', 'mishary', 0],
    ['mishray', 'mishary', 1], // transposition
    ['fatiha', 'fatihah', 1], // insertion
    ['kahf', 'kahd', 1], // substitution
    ['baqara', 'bqara', 1], // deletion
  ])('%s vs %s = %i', (a, b, expected) => {
    expect(damerauLevenshtein(a, b, 3)).toBe(expected);
  });

  it('stops early and returns max + 1 when over budget', () => {
    expect(damerauLevenshtein('abcdef', 'uvwxyz', 2)).toBe(3);
    expect(damerauLevenshtein('a', 'abcdef', 2)).toBe(3);
  });
});

describe('maxEditsFor', () => {
  it.each([
    [1, 0],
    [3, 0],
    [4, 1],
    [6, 1],
    [7, 2],
    [20, 2],
  ])('length %i allows %i edits', (length, edits) => {
    expect(maxEditsFor(length)).toBe(edits);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest --watchAll=false utils/search`
Expected: FAIL with "Cannot find module '../normalize'" and "Cannot find module '../fuzzy'".

- [ ] **Step 3: Implement**

`utils/search/normalize.ts`:

```ts
// @ai-generated

/**
 * Display-safe normalization shared with the Mushaf command parser. Keeps
 * ':' and hamza so "2:255" and "جزء" still parse. Do not add folding here;
 * matching-only folding belongs in toSearchKey.
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىی]/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Matching key: normalizeSearchText plus Latin accent stripping, hamza
 * carrier folding, apostrophe removal and punctuation-to-space. Only ever
 * compared against other keys; never shown to the user.
 */
export function toSearchKey(text: string): string {
  return normalizeSearchText(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
    .replace(/\u200b|\u200c|\u200d|\ufeff/g, '')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/['’‘`´ʼʻ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function tokenize(key: string): string[] {
  return key ? key.split(' ') : [];
}

/** Romanized Arabic articles and name particles ignored by skeleton matching. */
export const ARTICLES: ReadonlySet<string> = new Set([
  'al',
  'el',
  'an',
  'ar',
  'as',
  'ash',
  'at',
  'ad',
  'az',
  'ul',
  'ibn',
  'bin',
  'ben',
]);

/**
 * Consonant skeleton of a romanized Arabic word, so transliteration variants
 * collide: hussary/husary/hosary -> "hsr", abdulbasit/abdelbaset -> "abdbst".
 * Steps: drop a glued "al"/"el" article, fold "abd + al/ul/el (+ sun letter)"
 * to "abd", keep the first letter, drop later vowels (and y), q -> k,
 * ph -> f, then collapse doubled letters. Non-Latin tokens pass through.
 */
export function latinSkeleton(token: string): string {
  if (!/^[a-z]+$/.test(token)) return token;
  let word = token;
  if (word.length > 4 && /^(al|el)/.test(word)) word = word.slice(2);
  word = word.replace(/^abd[uea]?[lrsnzdt]?(?=[a-z]{3}|$)/, 'abd');
  const first = word[0] === 'q' ? 'k' : word[0];
  const rest = word
    .slice(1)
    .replace(/ph/g, 'f')
    .replace(/q/g, 'k')
    .replace(/[aeiouy]/g, '');
  return (first + rest).replace(/(.)\1+/g, '$1');
}
```

`utils/search/fuzzy.ts`:

```ts
// @ai-generated

/**
 * Optimal-string-alignment Damerau-Levenshtein distance with an early exit:
 * returns max + 1 as soon as the distance is known to exceed max.
 */
export function damerauLevenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) rows.push([i]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Number.POSITIVE_INFINITY;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, rows[i - 2][j - 2] + 1);
      }
      rows[i][j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return max + 1;
  }
  return rows[a.length][b.length];
}

/** Typo budget per query token, by length (Spotify/Algolia-style). */
export function maxEditsFor(length: number): number {
  if (length < 4) return 0;
  if (length < 7) return 1;
  return 2;
}
```

In `utils/catalogSearch.ts`, delete the local `normalizeSearchText` function body and replace it with a re-export at the top of the file:

```ts
export {normalizeSearchText} from '@/utils/search/normalize'; // @ai
import {normalizeSearchText} from '@/utils/search/normalize'; // @ai
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest --watchAll=false utils/search utils/__tests__/catalogSearch.test.ts`
Expected: PASS (the existing catalogSearch suite still passes, proving the move changed nothing).

- [ ] **Step 5: Format, typecheck, commit**

```bash
npx prettier --write utils/search utils/catalogSearch.ts
npx tsc --noEmit
git add utils/search utils/catalogSearch.ts
git commit -m "feat(search): add search-key normalization, latin skeleton and edit distance"
```

---

### Task 2: Tiered ranking engine

**Files:**
- Create: `utils/search/createSearchIndex.ts`
- Test: `utils/search/__tests__/createSearchIndex.test.ts`

**Interfaces:**
- Consumes: everything from Task 1.
- Produces:

```ts
export interface SearchField<T> {
  get: (item: T) => string | readonly string[];
  weight: number; // 0..1
}
export interface SearchIndexOptions<T> {
  fields: readonly SearchField<T>[];
  boost?: (item: T) => number; // small tie-breaker, keep <= 1
  keyboardFallback?: boolean; // used from Task 3
}
export interface SearchHit<T> {
  item: T;
  score: number; // higher is better
}
export interface SearchIndex<T> {
  search(query: string, limit?: number): SearchHit<T>[];
}
export const TIER: {exact: 100; prefix: 90; wordPrefix: 80; substring: 60; compact: 55; skeleton: 45; fuzzy: 30};
export const MAX_QUERY_LENGTH = 100;
export function createSearchIndex<T>(items: readonly T[], options: SearchIndexOptions<T>): SearchIndex<T>;
```

**Scoring rules (what the tests pin):**
- Whole-field tiers per field: exact key match 100, field starts with query 90, substring 60, space-insensitive substring 55, skeleton match at a word boundary 45 minus 2 per edit (max minus 10). Substring and compact tiers need a 3+ character query; skeleton needs 3+ characters and a 2+ letter skeleton.
- Token tiers, so words can match across fields (`husary warsh` = name + rewayah): each query token takes its best match over all field tokens (exact 100, word prefix 80, skeleton 45 minus distance penalty, typo 30 minus 5 per edit within `maxEditsFor`). The last token is matched as a prefix (typeahead). Item token score = the weakest token.
- Item score = max(best whole-field score x weight, token score) + boost. Ties keep input order.

- [ ] **Step 1: Write the failing tests**

```ts
// @ai-generated
import {MAX_QUERY_LENGTH, TIER, createSearchIndex} from '../createSearchIndex';

interface Thing {
  id: number;
  name: string;
  tags: string[];
}

const things: Thing[] = [
  {id: 1, name: 'Mishary Alafasi', tags: ['Hafs']},
  {id: 2, name: 'Mahmoud Khalil Al-Hussary', tags: ['Warsh', 'Hafs']},
  {id: 3, name: 'Abdullah Al-Mishal', tags: []},
  {id: 4, name: 'Saud Al-Shuraim', tags: []},
  {id: 5, name: 'Khalid Al-Shoraimy', tags: []},
  {id: 6, name: 'Maher Al Meaqli', tags: []},
];

const index = createSearchIndex(things, {
  fields: [
    {get: t => t.name, weight: 1},
    {get: t => t.tags, weight: 0.6},
  ],
});

function ids(query: string, limit?: number): number[] {
  return index.search(query, limit).map(hit => hit.item.id);
}

describe('createSearchIndex', () => {
  it('returns [] for empty and whitespace queries', () => {
    expect(index.search('')).toEqual([]);
    expect(index.search('   ')).toEqual([]);
  });

  it('scores an exact name highest', () => {
    expect(index.search('mishary alafasi')[0]).toEqual({
      item: things[0],
      score: TIER.exact,
    });
  });

  it('ranks prefix above typo matches', () => {
    expect(ids('mish')).toEqual([1, 3]);
  });

  it('tolerates transliteration variants', () => {
    expect(ids('husary')[0]).toBe(2);
    expect(ids('afasy')[0]).toBe(1);
  });

  it('prefers the closer spelling among skeleton matches', () => {
    expect(ids('shuraym').slice(0, 2)).toEqual([4, 5]);
  });

  it('tolerates a transposition typo', () => {
    expect(ids('mishray')[0]).toBe(1);
  });

  it('matches words across fields', () => {
    expect(ids('husary warsh')).toEqual([2]);
  });

  it('short queries only use prefix tiers', () => {
    // Names starting with "m" (90) beat a later word starting with "m" (80);
    // "Shuraim" contains an "m" but not at a word start, so it is excluded.
    expect(ids('m')).toEqual([1, 2, 6, 3]);
    expect(ids('ai')).toEqual([]);
  });

  it('punctuation is ignored, never treated as syntax', () => {
    expect(ids("'mishary")[0]).toBe(1);
    expect(ids('!mishary')[0]).toBe(1);
    expect(ids('mishary (alafasi)')[0]).toBe(1);
  });

  it('caps very long queries', () => {
    const long = 'mishary '.repeat(500);
    expect(() => index.search(long)).not.toThrow();
    expect(MAX_QUERY_LENGTH).toBe(100);
  });

  it('respects limit and keeps input order on ties', () => {
    expect(ids('hafs')).toEqual([1, 2]);
    expect(ids('hafs', 1)).toEqual([1]);
  });

  it('applies boost as a tie-breaker', () => {
    const boosted = createSearchIndex(things, {
      fields: [{get: t => t.tags, weight: 1}],
      boost: t => (t.id === 2 ? 1 : 0),
    });
    expect(boosted.search('hafs').map(hit => hit.item.id)).toEqual([2, 1]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest --watchAll=false utils/search/__tests__/createSearchIndex.test.ts`
Expected: FAIL, "Cannot find module '../createSearchIndex'".

- [ ] **Step 3: Implement** `utils/search/createSearchIndex.ts`

```ts
// @ai-generated
import {damerauLevenshtein, maxEditsFor} from './fuzzy';
import {ARTICLES, latinSkeleton, toSearchKey, tokenize} from './normalize';

export const TIER = {
  exact: 100,
  prefix: 90,
  wordPrefix: 80,
  substring: 60,
  compact: 55,
  skeleton: 45,
  fuzzy: 30,
} as const;

export const MAX_QUERY_LENGTH = 100;

export interface SearchField<T> {
  get: (item: T) => string | readonly string[];
  weight: number;
}

export interface SearchIndexOptions<T> {
  fields: readonly SearchField<T>[];
  boost?: (item: T) => number;
  keyboardFallback?: boolean;
}

export interface SearchHit<T> {
  item: T;
  score: number;
}

export interface SearchIndex<T> {
  search(query: string, limit?: number): SearchHit<T>[];
}

interface PreparedField {
  key: string;
  compact: string;
  tokens: string[];
  tokenSkeletons: string[];
  skeletonSuffixes: string[];
  // Raw text from the same token boundary as skeletonSuffixes, used to
  // penalise skeleton matches by real spelling distance.
  rawSuffixes: string[];
  weight: number;
}

interface PreparedItem<T> {
  item: T;
  index: number;
  fields: PreparedField[];
  boost: number;
}

interface PreparedQuery {
  key: string;
  tokens: string[];
  compact: string;
  skeleton: string;
}

function prepareField(text: string, weight: number): PreparedField {
  const key = toSearchKey(text);
  const tokens = tokenize(key);
  const content = tokens.filter(token => !ARTICLES.has(token));
  const skeleton = content.map(latinSkeleton);
  return {
    key,
    compact: tokens.join(''),
    tokens,
    tokenSkeletons: tokens.map(token =>
      ARTICLES.has(token) ? '' : latinSkeleton(token),
    ),
    skeletonSuffixes: skeleton.map((_, i) => skeleton.slice(i).join('')),
    rawSuffixes: content.map((_, i) => content.slice(i).join('')),
    weight,
  };
}

function prepareQuery(query: string): PreparedQuery {
  const key = toSearchKey(query.slice(0, MAX_QUERY_LENGTH));
  const tokens = tokenize(key);
  return {
    key,
    tokens,
    compact: tokens.join(''),
    skeleton: tokens
      .filter(token => !ARTICLES.has(token))
      .map(latinSkeleton)
      .join(''),
  };
}

function scoreWholeField(field: PreparedField, query: PreparedQuery): number {
  if (!field.key) return 0;
  if (field.key === query.key) return TIER.exact;
  if (field.key.startsWith(query.key)) return TIER.prefix;
  if (query.compact.length < 3) return 0;
  if (field.key.includes(query.key)) return TIER.substring;
  if (field.compact.includes(query.compact)) return TIER.compact;
  if (query.skeleton.length < 2) return 0;
  let best = 0;
  field.skeletonSuffixes.forEach((suffix, i) => {
    if (!suffix.startsWith(query.skeleton)) return;
    const raw = field.rawSuffixes[i].slice(0, query.compact.length + 2);
    const distance = damerauLevenshtein(query.compact, raw, 5);
    best = Math.max(best, TIER.skeleton - Math.min(10, 2 * distance));
  });
  return best;
}

function scoreToken(
  fields: readonly PreparedField[],
  token: string,
  isLast: boolean,
): number {
  const tokenSkeleton = latinSkeleton(token);
  const maxEdits = maxEditsFor(token.length);
  let best = 0;
  for (const field of fields) {
    for (let t = 0; t < field.tokens.length; t++) {
      const fieldToken = field.tokens[t];
      let tier = 0;
      if (fieldToken === token) {
        tier = TIER.exact;
      } else if (fieldToken.startsWith(token)) {
        tier = TIER.wordPrefix;
      } else if (
        token.length >= 3 &&
        tokenSkeleton.length >= 2 &&
        field.tokenSkeletons[t].startsWith(tokenSkeleton)
      ) {
        // Closer spellings rank first among skeleton matches.
        const distance = damerauLevenshtein(token, fieldToken, 5);
        tier = TIER.skeleton - Math.min(10, 2 * distance);
      } else if (
        maxEdits > 0 &&
        // Typos rarely hit both leading letters; this skips most DL work.
        (token[0] === fieldToken[0] || token[1] === fieldToken[1])
      ) {
        const target =
          isLast && fieldToken.length > token.length
            ? fieldToken.slice(0, token.length)
            : fieldToken;
        const distance = damerauLevenshtein(token, target, maxEdits);
        if (distance <= maxEdits) tier = TIER.fuzzy - 5 * distance;
      }
      best = Math.max(best, tier * field.weight);
    }
  }
  return best;
}

function toTexts(value: string | readonly string[]): readonly string[] {
  return typeof value === 'string' ? [value] : value;
}

export function createSearchIndex<T>(
  items: readonly T[],
  options: SearchIndexOptions<T>,
): SearchIndex<T> {
  const prepared: PreparedItem<T>[] = items.map((item, index) => ({
    item,
    index,
    boost: options.boost?.(item) ?? 0,
    fields: options.fields.flatMap(field =>
      toTexts(field.get(item))
        .filter(text => text.length > 0)
        .map(text => prepareField(text, field.weight)),
    ),
  }));

  function run(query: PreparedQuery, limit: number): SearchHit<T>[] {
    if (!query.key) return [];
    const hits: (SearchHit<T> & {index: number})[] = [];
    for (const entry of prepared) {
      let score = 0;
      for (const field of entry.fields) {
        score = Math.max(score, scoreWholeField(field, query) * field.weight);
      }
      const tokenScores = query.tokens.map((token, i) =>
        scoreToken(entry.fields, token, i === query.tokens.length - 1),
      );
      score = Math.max(score, Math.min(...tokenScores));
      if (score > 0) {
        hits.push({item: entry.item, score: score + entry.boost, index: entry.index});
      }
    }
    hits.sort((a, b) => b.score - a.score || a.index - b.index);
    return hits.slice(0, limit).map(({item, score}) => ({item, score}));
  }

  return {
    search(query: string, limit: number = Number.POSITIVE_INFINITY): SearchHit<T>[] {
      return run(prepareQuery(query), limit);
    },
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest --watchAll=false utils/search`
Expected: PASS. If `short queries only use prefix tiers` lists a different order, fix the engine, not the test: `m` must return only names with a word starting with "m", in input order among equal scores.

- [ ] **Step 5: Format, typecheck, commit**

```bash
npx prettier --write utils/search
npx tsc --noEmit
git add utils/search
git commit -m "feat(search): add tiered relevance ranking engine"
```

---

### Task 3: Wrong-keyboard fallback

Users switch between Arabic and English keyboards constantly. Typing "الفاتحة" with the English layout active produces `hgthjpm`. When a query has zero results, retry it mapped through the other layout (Google and Tarteel both do this).

**Files:**
- Create: `utils/search/keyboardLayout.ts`
- Modify: `utils/search/createSearchIndex.ts` (`search` method)
- Test: `utils/search/__tests__/keyboardLayout.test.ts`

**Interfaces:**
- Produces: `swapKeyboardLayout(query: string): string | null` (null when the query is under 3 characters or mixes scripts). `SearchIndexOptions.keyboardFallback` defaults to true.

- [ ] **Step 1: Write the failing test**

```ts
// @ai-generated
import {swapKeyboardLayout} from '../keyboardLayout';
import {createSearchIndex} from '../createSearchIndex';

describe('swapKeyboardLayout', () => {
  it('maps English-layout keystrokes to Arabic', () => {
    expect(swapKeyboardLayout('hgthjpm')).toBe('الفاتحة');
    expect(swapKeyboardLayout('hgfrvm')).toBe('البقرة');
  });

  it('maps Arabic-layout keystrokes to English', () => {
    expect(swapKeyboardLayout('ةهساشقغ')).toBe('mishary');
  });

  it('returns null for short or mixed-script input', () => {
    expect(swapKeyboardLayout('hg')).toBeNull();
    expect(swapKeyboardLayout('abc الف')).toBeNull();
  });
});

describe('keyboard fallback in search', () => {
  const index = createSearchIndex(
    [
      {name: 'Al-Fatihah', arabic: 'الفاتحة'},
      {name: 'Mishary Alafasi', arabic: 'مشاري العفاسي'},
    ],
    {
      fields: [
        {get: item => item.name, weight: 1},
        {get: item => item.arabic, weight: 1},
      ],
    },
  );

  it('retries with the other layout only when nothing matched', () => {
    expect(index.search('hgthjpm')[0]?.item.name).toBe('Al-Fatihah');
    expect(index.search('ةهساشقغ')[0]?.item.name).toBe('Mishary Alafasi');
  });

  it('can be disabled', () => {
    const strict = createSearchIndex([{name: 'الفاتحة'}], {
      fields: [{get: item => item.name, weight: 1}],
      keyboardFallback: false,
    });
    expect(strict.search('hgthjpm')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest --watchAll=false utils/search/__tests__/keyboardLayout.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement** `utils/search/keyboardLayout.ts`

```ts
// @ai-generated

// Standard Arabic (101) layout, unshifted keys. "b" produces the lam-alef
// ligature as two letters.
const LATIN_TO_ARABIC: Readonly<Record<string, string>> = {
  '`': 'ذ', q: 'ض', w: 'ص', e: 'ث', r: 'ق', t: 'ف', y: 'غ', u: 'ع',
  i: 'ه', o: 'خ', p: 'ح', '[': 'ج', ']': 'د', a: 'ش', s: 'س', d: 'ي',
  f: 'ب', g: 'ل', h: 'ا', j: 'ت', k: 'ن', l: 'م', ';': 'ك', "'": 'ط',
  z: 'ئ', x: 'ء', c: 'ؤ', v: 'ر', b: 'لا', n: 'ى', m: 'ة', ',': 'و',
  '.': 'ز', '/': 'ظ',
};

const ARABIC_TO_LATIN: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(LATIN_TO_ARABIC)
    .filter(([, arabic]) => arabic.length === 1)
    .map(([latin, arabic]) => [arabic, latin]),
);

const HAS_ARABIC = /[؀-ۿ]/;
const HAS_LATIN = /[a-z]/i;

function mapChars(text: string, table: Readonly<Record<string, string>>): string {
  return [...text].map(char => table[char] ?? char).join('');
}

/** The same keystrokes typed on the other layout, or null if not applicable. */
export function swapKeyboardLayout(query: string): string | null {
  const text = query.trim().toLowerCase();
  if (text.replace(/\s/g, '').length < 3) return null;
  const arabic = HAS_ARABIC.test(text);
  const latin = HAS_LATIN.test(text);
  if (arabic === latin) return null;
  return arabic ? mapChars(text, ARABIC_TO_LATIN) : mapChars(text, LATIN_TO_ARABIC);
}
```

In `utils/search/createSearchIndex.ts`, add the import and replace the returned `search` method:

```ts
import {swapKeyboardLayout} from './keyboardLayout'; // @ai
```

```ts
  return {
    search(query: string, limit: number = Number.POSITIVE_INFINITY): SearchHit<T>[] {
      const hits = run(prepareQuery(query), limit);
      if (hits.length > 0 || options.keyboardFallback === false) return hits;
      const swapped = swapKeyboardLayout(query);
      return swapped ? run(prepareQuery(swapped), limit) : hits;
    },
  };
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest --watchAll=false utils/search`
Expected: PASS.

- [ ] **Step 5: Format, typecheck, commit**

```bash
npx prettier --write utils/search
npx tsc --noEmit
git add utils/search
git commit -m "feat(search): retry zero-result queries on the other keyboard layout"
```

---

### Task 4: Catalogue adapters, aliases and the golden corpus

**Files:**
- Create: `utils/search/catalog.ts`
- Create: `data/searchAliases.ts`
- Modify: `data/featuredReciters.ts` (export the name list)
- Test: `utils/search/__tests__/catalog.test.ts`, `utils/search/__tests__/golden.test.ts`

**Interfaces:**
- Consumes: `createSearchIndex`, `SearchIndex`, `SearchHit` (Task 2); `normalizeSearchText`, `toSearchKey` (Task 1).
- Produces:

```ts
export function createSurahSearch(surahs: readonly Surah[]): SearchIndex<Surah>;
export function createReciterSearch(reciters: readonly Reciter[]): SearchIndex<Reciter>;
export function rankSurahs(query: string, within?: readonly Surah[]): readonly Surah[];
export function rankReciters(query: string, within?: readonly Reciter[]): readonly Reciter[];
export interface CatalogSearchResult { type: 'surah' | 'reciter'; item: Surah | Reciter; score: number }
export function createCatalogSearch(reciters: readonly Reciter[], surahs: readonly Surah[]): {search(query: string): CatalogSearchResult[]};
export const SURAH_ALIASES: Readonly<Record<number, readonly string[]>>; // data/searchAliases.ts
export const FEATURED_RECITER_NAMES: readonly string[]; // data/featuredReciters.ts
```

`rankSurahs` / `rankReciters` return items in relevance order; with an empty query they return `within` (or the full catalogue) unchanged. `within` restricts results to that subset without building a new index.

- [ ] **Step 1: Export the featured list**

In `data/featuredReciters.ts` line 3, change `const FEATURED_RECITER_NAMES = [` to:

```ts
export const FEATURED_RECITER_NAMES: readonly string[] = [ // @ai
```

- [ ] **Step 2: Write the failing tests**

`utils/search/__tests__/catalog.test.ts`:

```ts
// @ai-generated
import {SURAHS} from '@/data/surahData';
import {RECITERS, type Reciter} from '@/data/reciterData';
import reciterData from '@/data/reciters-fallback.json';
import {
  createCatalogSearch,
  rankReciters,
  rankSurahs,
} from '../catalog';

const reciters: Reciter[] = reciterData;
const ALAFASI = 'b3bca7d8-b004-4511-b46e-f3527f6b1f67';

afterEach(() => {
  RECITERS.splice(0, RECITERS.length);
});

describe('rankSurahs', () => {
  it.each(['112', '١١٢', '۱۱۲', ' ١١٢ ', '\u200f١١٢\u200f', 'surah 112', 'سورة ١١٢'])(
    'treats %s as surah number 112',
    query => {
      expect(rankSurahs(query).map(s => s.id)).toEqual([112]);
    },
  );

  it.each(['0', '115', '999'])('returns nothing for out-of-range %s', query => {
    expect(rankSurahs(query)).toEqual([]);
  });

  it('returns the input unchanged for an empty query', () => {
    expect(rankSurahs('')).toBe(SURAHS);
    const subset = SURAHS.slice(0, 3);
    expect(rankSurahs('  ', subset)).toBe(subset);
  });

  it('restricts results to the given subset', () => {
    const subset = SURAHS.filter(s => s.id !== 1);
    expect(rankSurahs('fatiha', subset).map(s => s.id)).not.toContain(1);
  });

  it('finds surahs by alias', () => {
    expect(rankSurahs('amma')[0].id).toBe(78);
    expect(rankSurahs('tabarak')[0].id).toBe(67);
  });

  it('keeps original objects for display', () => {
    expect(rankSurahs('ال عمران')[0]).toBe(SURAHS[2]);
  });
});

describe('rankReciters', () => {
  it('rebuilds when RECITERS is repopulated in place', () => {
    expect(rankReciters('alafasi')).toEqual([]);
    RECITERS.splice(0, RECITERS.length, ...reciters);
    expect(rankReciters('alafasi')[0].id).toBe(ALAFASI);
  });

  it('searches Arabic names and rewayah names', () => {
    RECITERS.splice(0, RECITERS.length, ...reciters);
    expect(rankReciters('العفاسي')[0].id).toBe(ALAFASI);
    expect(rankReciters('warsh').length).toBeGreaterThan(0);
  });

  it('restricts results to the given subset', () => {
    RECITERS.splice(0, RECITERS.length, ...reciters);
    const subset = reciters.filter(r => r.id !== ALAFASI);
    expect(rankReciters('alafasi', subset).map(r => r.id)).not.toContain(ALAFASI);
  });
});

describe('createCatalogSearch (Home)', () => {
  const search = createCatalogSearch(reciters, SURAHS);

  it('merges surahs and reciters by score, best first', () => {
    const results = search.search('al');
    const scores = results.map(r => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('returns only the surah for a number', () => {
    expect(search.search('36')).toEqual([
      {type: 'surah', item: SURAHS[35], score: 100},
    ]);
  });
});
```

`utils/search/__tests__/golden.test.ts` (the regression corpus; add every real failing query reported by users here):

```ts
// @ai-generated
import {SURAHS} from '@/data/surahData';
import type {Reciter} from '@/data/reciterData';
import reciterData from '@/data/reciters-fallback.json';
import {createReciterSearch, createSurahSearch} from '../catalog';

const catalogue: Reciter[] = reciterData;
const reciters = createReciterSearch(catalogue);
const surahs = createSurahSearch(SURAHS);

const HUSSARY = '3aed26b2-eb4a-4daf-be85-34284d37bc57';
const ALAFASI = 'b3bca7d8-b004-4511-b46e-f3527f6b1f67';
const ABDULBASIT = '2821b3d7-ef99-49b2-9f45-bac57f8c3235';
const SHURAIM = '6c20bbf9-3c31-43ee-a70f-52ee3b53e098';
const MINSHAWI = 'b5acd08c-b023-4bf3-b806-f1b8c12d6d33';
const GHAMDI = '7cba5656-9d0a-4db8-b40c-878947bd5307';
const MEAQLI = '06c3f79f-02d9-42e8-9e9b-c6f355648305';
const AJMY = '0499ceb5-320e-4bf3-af9a-a5a6ea84d1e5';
const QATAMI = 'bcaade68-f0c8-4d6b-b3b6-725515bbd952';
const YASSER_DOSARI = 'c0f887a2-a6a8-4538-8244-1550dc34793d';

describe('golden reciter queries (top result)', () => {
  it.each([
    ['husary', HUSSARY],
    ['hosary', HUSSARY],
    ['الحصري', HUSSARY],
    ['husary warsh', HUSSARY],
    ['mishari', ALAFASI],
    ['mishray', ALAFASI],
    ['afasy', ALAFASI],
    ['mishary alafasi', ALAFASI],
    ['العفاسي', ALAFASI],
    ['عفاسي', ALAFASI],
    ['ةهساشقغ', ALAFASI],
    ['abdul basit', ABDULBASIT],
    ['abd al basit', ABDULBASIT],
    ['abdelbaset', ABDULBASIT],
    ['عبد الباسط', ABDULBASIT],
    ['shuraym', SHURAIM],
    ['minshawy', MINSHAWI],
    ['ghamidi', GHAMDI],
    ['muaiqly', MEAQLI],
    ['ajami', AJMY],
    ['qatami', QATAMI],
  ])('%s', (query, id) => {
    expect(reciters.search(query)[0]?.item.id).toBe(id);
  });

  it('dossary returns Yasser Al-Dosari among the top three', () => {
    const top = reciters.search('dossary', 3).map(hit => hit.item.id);
    expect(top).toContain(YASSER_DOSARI);
  });
});

describe('golden surah queries (top result)', () => {
  it.each([
    ['al fatihah', 1],
    ['alfatiha', 1],
    ['fatiha', 1],
    ['fatihha', 1],
    ['الفاتحه', 1],
    ['الْفَاتِحَة', 1],
    ['hgthjpm', 1],
    ['the opener', 1],
    ['baqara', 2],
    ['bqara', 2],
    ['the cow', 2],
    ['ال عمران', 3],
    ['kahf', 18],
    ['taha', 20],
    ['مومنون', 23],
    ['المومنون', 23],
    ['yasin', 36],
    ['yaseen', 36],
    ['ya sin', 36],
    ['يس', 36],
    ['rahman', 55],
    ['mulk', 67],
    ['النبأ', 78],
    ['الضحي', 93],
    ['ikhlas', 112],
  ])('%s', (query, id) => {
    expect(surahs.search(query)[0]?.item.id).toBe(id);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx jest --watchAll=false utils/search`
Expected: FAIL, "Cannot find module '../catalog'".

Note on the JSON import: `data/reciters-fallback.json` matches the `Reciter` shape (verified 2026-10-12), so the plain annotation `const catalogue: Reciter[] = reciterData;` should type-check. If `tsc` rejects it because a JSON field infers as `null`, write a type guard `isReciter(value: unknown): value is Reciter` in `test-utils/` and filter with it; do not use `as`.

- [ ] **Step 4: Implement**

`data/searchAliases.ts` (well-known alternate surah names, English and Arabic):

```ts
// @ai-generated
/** Alternate names people actually search with, keyed by surah id. */
export const SURAH_ALIASES: Readonly<Record<number, readonly string[]>> = {
  1: ['Al-Hamd', 'Umm al-Kitab', 'The Opening', 'الحمد', 'أم الكتاب'],
  9: ["Bara'ah", 'براءة'],
  17: ["Bani Isra'il", 'بني إسرائيل'],
  40: ["Al-Mu'min", 'المؤمن'],
  41: ['Ha-Mim Sajdah', 'حم السجدة'],
  47: ['Al-Qital', 'القتال'],
  76: ['Ad-Dahr', 'الدهر'],
  78: ['Amma', 'عم'],
  67: ['Tabarak', 'تبارك'],
  94: ['Alam Nashrah', 'الانشراح'],
  111: ['Al-Lahab', 'Tabbat', 'اللهب', 'تبت'],
  112: ['At-Tawhid', 'التوحيد'],
};
```

`utils/search/catalog.ts`:

```ts
// @ai-generated
import {SURAHS, type Surah} from '@/data/surahData';
import {RECITERS, type Reciter} from '@/data/reciterData';
import {SURAH_ALIASES} from '@/data/searchAliases';
import {FEATURED_RECITER_NAMES} from '@/data/featuredReciters';
import {getReciterDisplayName} from '@/i18n/format';
import {getDisplayLabelFromName} from '@/services/rewayah/RewayahIdentity';
import {
  createSearchIndex,
  TIER,
  type SearchHit,
  type SearchIndex,
} from './createSearchIndex';
import {toSearchKey} from './normalize';

// "surah 36", "sura yasin", "سورة يس": the prefix word carries no meaning.
const SURAH_PREFIX = /^(surah|surat|sura|soorah|سوره|سورت)\s+/;
const FEATURED = new Set(FEATURED_RECITER_NAMES);

export function createSurahSearch(surahs: readonly Surah[]): SearchIndex<Surah> {
  const index = createSearchIndex(surahs, {
    fields: [
      {get: surah => surah.name, weight: 1},
      {get: surah => surah.name_arabic, weight: 1},
      {get: surah => surah.translated_name_english, weight: 0.8},
      {get: surah => SURAH_ALIASES[surah.id] ?? [], weight: 0.9},
    ],
  });
  return {
    search(query: string, limit?: number): SearchHit<Surah>[] {
      const key = toSearchKey(query).replace(SURAH_PREFIX, '');
      if (/^\d+$/.test(key)) {
        const surah = surahs.find(item => item.id === Number(key));
        return surah ? [{item: surah, score: TIER.exact}] : [];
      }
      return index.search(key, limit);
    },
  };
}

export function createReciterSearch(
  reciters: readonly Reciter[],
): SearchIndex<Reciter> {
  return createSearchIndex(reciters, {
    fields: [
      {get: reciter => reciter.name, weight: 1},
      {get: reciter => getReciterDisplayName(reciter, 'ar'), weight: 1},
      {get: reciter => reciter.rewayat.map(r => r.name), weight: 0.6},
      {
        get: reciter => reciter.rewayat.map(r => getDisplayLabelFromName(r.name)),
        weight: 0.6,
      },
      {get: reciter => reciter.rewayat.map(r => r.style), weight: 0.4},
    ],
    boost: reciter => (FEATURED.has(reciter.name) ? 1 : 0),
  });
}

let surahIndex: SearchIndex<Surah> | null = null;

function getSurahIndex(): SearchIndex<Surah> {
  surahIndex ??= createSurahSearch(SURAHS);
  return surahIndex;
}

// RECITERS is filled in place by dataService (splice), possibly after the
// first query. Rebuild whenever its identity signature changes.
let reciterIndex: SearchIndex<Reciter> | null = null;
let reciterSignature = '';

function getReciterIndex(): SearchIndex<Reciter> {
  const signature = `${RECITERS.length}:${RECITERS[0]?.id ?? ''}:${RECITERS[RECITERS.length - 1]?.id ?? ''}`;
  if (!reciterIndex || signature !== reciterSignature) {
    reciterIndex = createReciterSearch(RECITERS);
    reciterSignature = signature;
  }
  return reciterIndex;
}

function restrict<T extends {id: number | string}>(
  hits: readonly SearchHit<T>[],
  within: readonly T[] | undefined,
): T[] {
  if (!within) return hits.map(hit => hit.item);
  const allowed = new Set(within.map(item => item.id));
  return hits.filter(hit => allowed.has(hit.item.id)).map(hit => hit.item);
}

export function rankSurahs(
  query: string,
  within?: readonly Surah[],
): readonly Surah[] {
  if (!query.trim()) return within ?? SURAHS;
  return restrict(getSurahIndex().search(query), within);
}

export function rankReciters(
  query: string,
  within?: readonly Reciter[],
): readonly Reciter[] {
  if (!query.trim()) return within ?? RECITERS;
  return restrict(getReciterIndex().search(query), within);
}

export interface CatalogSearchResult {
  type: 'surah' | 'reciter';
  item: Surah | Reciter;
  score: number;
}

/** Home search: surahs and reciters merged by relevance (higher is better). */
export function createCatalogSearch(
  reciters: readonly Reciter[],
  surahs: readonly Surah[],
): {search(query: string): CatalogSearchResult[]} {
  const surahSearch = createSurahSearch(surahs);
  const reciterSearch = createReciterSearch(reciters);
  return {
    search(query: string): CatalogSearchResult[] {
      const surahHits = surahSearch.search(query);
      // A bare number is a surah reference; reciters never match digits.
      if (/^\d+$/.test(toSearchKey(query))) {
        return surahHits.map(hit => ({type: 'surah' as const, ...hit}));
      }
      return [
        ...surahHits.map(hit => ({type: 'surah' as const, ...hit})),
        ...reciterSearch
          .search(query)
          .map(hit => ({type: 'reciter' as const, ...hit})),
      ].sort((a, b) => b.score - a.score);
    },
  };
}
```

Both `rank*` functions return `readonly` arrays so an empty query can hand back the caller's own array (identity, no copy) without a cast. Screens that need a mutable array spread it: `[...rankSurahs(q)]`.

- [ ] **Step 5: Run to verify pass**

Run: `npx jest --watchAll=false utils/search utils/__tests__/catalogSearch.test.ts`
Expected: PASS. If a golden case fails, adjust weights or skeleton rules in Tasks 1-2 and rerun every suite; never delete a golden case to make it pass.

- [ ] **Step 6: Format, typecheck, commit**

```bash
npx prettier --write utils/search data/searchAliases.ts data/featuredReciters.ts
npx tsc --noEmit
git add utils/search data/searchAliases.ts data/featuredReciters.ts
git commit -m "feat(search): catalogue adapters, surah aliases and golden query corpus"
```

---

### Task 5: Home search on the new engine

**Files:**
- Modify: `components/search/SearchView.tsx:21-23` (import) and `:182-184` (call)
- Modify: `utils/__tests__/catalogSearch.test.ts` (point at the new module; Fuse scores are gone)

**Interfaces:**
- Consumes: `createCatalogSearch(reciters, surahs)`, `CatalogSearchResult` from `@/utils/search/catalog`.

- [ ] **Step 1: Update the existing test to the new contract**

In `utils/__tests__/catalogSearch.test.ts`:
- Replace the import block with:

```ts
import {createCatalogSearch} from '@/utils/search/catalog'; // @ai
import {matchesSearchText, matchesSurah, normalizeSearchText} from '../catalogSearch';
```

- Replace the `createCatalogSearch(...)` construction with `const search = createCatalogSearch(reciters as Reciter[], SURAHS);` and delete the now-unused `arabicNames`/`names` lines. (Keep the existing `reciters as Reciter[]` line exactly as it is today; Task 7 replaces this file.)
- In the `finds only Al-Ikhlas` case change `score: 0` to `score: 100`.

- [ ] **Step 2: Run to verify the old suite passes against the new engine**

Run: `npx jest --watchAll=false utils/__tests__/catalogSearch.test.ts`
Expected: PASS.

- [ ] **Step 3: Switch SearchView**

```ts
// components/search/SearchView.tsx, replace the createCatalogSearch import
import {createCatalogSearch} from '@/utils/search/catalog'; // @ai
```

```ts
        setCatalogSearch(createCatalogSearch(reciterData, surahData)); // @ai
```

Keep `searchResults` rendering as is: it reads `type` and `item`, never `score`.

- [ ] **Step 4: Typecheck, format, commit**

```bash
npx prettier --write components/search/SearchView.tsx utils/__tests__/catalogSearch.test.ts
npx tsc --noEmit
git add components/search/SearchView.tsx utils/__tests__/catalogSearch.test.ts
git commit -m "feat(search): move home search onto the ranked catalogue engine"
```

---

### Task 6: Route every other surface through the engine

When a query is present, results are shown in relevance order (Spotify / quran.com behaviour). The screen's own sort applies only with an empty query.

**Files:**
- Modify: `components/browse/BrowseSurahs.tsx:208-225`
- Modify: `components/mushaf/MushafSearchView.tsx:318-329`
- Modify: `services/dataService.ts:136-140` (`searchSurahs`, used by Organize surah field)
- Modify: `components/reciter-profile/ReciterProfile.tsx:428-445`
- Modify: `components/browse/BrowseReciters.tsx:271-283` and `:340-352`
- Modify: `app/(tabs)/(d.settings)/default-reciter.tsx:38-52`
- Modify: `app/(tabs)/(c.collection)/collection/favorite-reciters.tsx:67-77`
- Modify: `components/reciter-picker/ReciterPickerSheet.tsx` (`filterItems`)
- Modify: `components/sheets/OrganizeRecitationSheet.tsx:413-424`

**Interfaces:**
- Consumes: `rankSurahs`, `rankReciters` (Task 4), `createSearchIndex` (Task 2).

- [ ] **Step 1: Browse Surahs** (replace the `displaySurahs` memo body)

```ts
  // @ai-start
  const displaySurahs = useMemo(() => {
    if (searchQuery.trim()) return [...rankSurahs(searchQuery)];
    const result = [...SURAHS];
    switch (sortOption) {
      case 'asc':
        return result.sort((a, b) => a.id - b.id);
      case 'desc':
        return result.sort((a, b) => b.id - a.id);
      case 'revelation':
        return result.sort((a, b) => a.revelation_order - b.revelation_order);
      default:
        return result;
    }
  }, [searchQuery, sortOption]);
  // @ai-end
```

Replace `import {matchesSurah} from '@/utils/catalogSearch';` with `import {rankSurahs} from '@/utils/search/catalog'; // @ai`. Keep the existing memo dependency list if it has more entries than the two above.

- [ ] **Step 2: Mushaf reader search** (step 5 of the parser)

```ts
  // 5. Ranked match on surah names // @ai
  for (const surah of rankSurahs(q)) { // @ai
    results.push({
      type: 'surah',
      surah,
      primary: getSurahDisplayName(surah),
      secondary: surahSecondaryLabel(surah),
    });
  }
```

Change the import to `import {normalizeSearchText} from '@/utils/search/normalize';` plus `import {rankSurahs} from '@/utils/search/catalog';` (both `// @ai`). The numeric and command branches above step 5 already returned for digits, so `rankSurahs` only sees names here.

- [ ] **Step 3: Organize surah field**

```ts
// @ai-start
export function searchSurahs(query: string): Surah[] {
  return [...rankSurahs(query)];
}
// @ai-end
```

Import `rankSurahs` from `@/utils/search/catalog` in `services/dataService.ts`; remove `matchesSurah` from its `catalogSearch` import.

- [ ] **Step 4: Reciter profile surah search** (replace steps 3 and 4 in `getFilteredSurahsForRewayat`)

```ts
      // 3. Search ranks by relevance; sorting only applies without a query // @ai-start
      if (searchQuery.trim()) return [...rankSurahs(searchQuery, available)];

      // 4. Sort
      return [...available].sort((a, b) => {
        if (sortOption === 'asc') return a.id - b.id;
        if (sortOption === 'desc') return b.id - a.id;
        if (sortOption === 'revelation')
          return a.revelation_order - b.revelation_order;
        return 0;
      });
      // @ai-end
```

- [ ] **Step 5: Browse Reciters**

Replace the search filter block (`if (searchQuery.trim()) { ... }` at :271-283) with:

```ts
    // @ai-start
    const searchRank = searchQuery.trim()
      ? new Map(rankReciters(searchQuery).map((reciter, i) => [reciter.id, i]))
      : null;
    if (searchRank) {
      result = result.filter(reciter => searchRank.has(reciter.id));
    }
    // @ai-end
```

and make the final sort respect it (replace the `result.sort(...)` call at :343-351):

```ts
    result.sort((a, b) => {
      // @ai-start
      if (searchRank) {
        return (searchRank.get(a.id) ?? 0) - (searchRank.get(b.id) ?? 0);
      }
      // @ai-end
      if (featuredIds.has(a.id) && !featuredIds.has(b.id)) return -1;
      if (!featuredIds.has(a.id) && featuredIds.has(b.id)) return 1;
      const aHasImage = hasImage(a);
      const bHasImage = hasImage(b);
      if (aHasImage && !bHasImage) return -1;
      if (!aHasImage && bHasImage) return 1;
      return a.name.localeCompare(b.name);
    });
```

Swap the `normalizeSearchText, matchesSearchText` import for `import {rankReciters} from '@/utils/search/catalog'; // @ai`.

- [ ] **Step 6: Settings > Default Reciter**

```ts
  // @ai-start
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setSearchResults(
        query.trim()
          ? [...rankReciters(query, RECITERS.filter(hasCompleteQuran))]
          : [],
      );
    },
    [hasCompleteQuran],
  );
  // @ai-end
```

- [ ] **Step 7: Collection > Favorite reciters screen**

```ts
  // @ai-start
  const filteredReciters = useMemo(
    () => [...rankReciters(searchQuery, favoriteReciters)],
    [favoriteReciters, searchQuery],
  );
  // @ai-end
```

- [ ] **Step 8: Reciter picker sheets** (`components/reciter-picker/ReciterPickerSheet.tsx`)

Replace `filterItems` and its memo with an index built once per item list:

```ts
const PICKER_FIELDS: readonly SearchField<ReciterPickerItem>[] = [
  {get: item => item.name, weight: 1},
  {get: item => item.searchTerms, weight: 0.9},
];
```

```ts
  const searchIndex = useMemo(
    () => createSearchIndex(items, {fields: PICKER_FIELDS}),
    [items],
  );
  const deferredQuery = useDeferredValue(searchQuery);
  const filteredItems = useMemo(
    () =>
      deferredQuery.trim()
        ? searchIndex.search(deferredQuery).map(hit => hit.item)
        : items,
    [items, searchIndex, deferredQuery],
  );
```

Imports: `useDeferredValue` from `react`; `createSearchIndex, type SearchField` from `@/utils/search/createSearchIndex`; drop `matchesSearchText`.

- [ ] **Step 9: Organize upload, reciter field**

```ts
  // @ai-start
  const customReciterIndex = useMemo(
    () =>
      createSearchIndex(customReciters, {
        fields: [{get: reciter => reciter.name, weight: 1}],
      }),
    [customReciters],
  );

  const reciterResults = useMemo(() => {
    if (!reciterQuery.trim()) return {system: [], custom: []};
    return {
      system: rankReciters(reciterQuery).slice(0, 5),
      custom: customReciterIndex
        .search(reciterQuery, 3)
        .map(hit => hit.item),
    };
  }, [reciterQuery, customReciterIndex]);
  // @ai-end
```

- [ ] **Step 10: Typecheck, run all tests, format, commit**

```bash
npx tsc --noEmit
npx jest --watchAll=false
npx prettier --write components/browse/BrowseSurahs.tsx components/mushaf/MushafSearchView.tsx services/dataService.ts components/reciter-profile/ReciterProfile.tsx components/browse/BrowseReciters.tsx "app/(tabs)/(d.settings)/default-reciter.tsx" "app/(tabs)/(c.collection)/collection/favorite-reciters.tsx" components/reciter-picker/ReciterPickerSheet.tsx components/sheets/OrganizeRecitationSheet.tsx
git add -A components app services
git commit -m "feat(search): rank every surah and reciter search with the shared engine"
```

Expected: tsc clean, full Jest suite green.

---

### Task 7: Remove the old search code and Fuse

**Files:**
- Delete: `utils/catalogSearch.ts`, `utils/__tests__/catalogSearch.test.ts` (its cases now live in `utils/search/__tests__/*`)
- Delete (dead, verified unrendered in the audit): `components/ReciterBrowse.tsx`, `components/collection/CollectionSearchModal.tsx`, `components/reciter-profile/components/SearchHeader/index.tsx`
- Modify: `services/dataService.ts` (delete unused `filterReciters` and `searchReciters`)
- Modify: `package.json`, `package-lock.json` (remove `fuse.js`)

- [ ] **Step 1: Prove each deletion has no importers**

Run:
```bash
for s in "utils/catalogSearch" "ReciterBrowse'" "CollectionSearchModal" "SearchHeader'" "filterReciters" "searchReciters" "fuse.js"; do echo "== $s"; grep -rn "$s" app components hooks services utils store --include='*.ts' --include='*.tsx' | grep -v __tests__; done
```
Expected: only the definitions themselves (and `SearchHeader` inside its own folder). Any other hit: migrate that caller first (same pattern as Task 6) before deleting.

- [ ] **Step 2: Delete and uninstall**

```bash
git rm utils/catalogSearch.ts utils/__tests__/catalogSearch.test.ts components/ReciterBrowse.tsx components/collection/CollectionSearchModal.tsx components/reciter-profile/components/SearchHeader/index.tsx
npm uninstall fuse.js
```

Delete `filterReciters` and `searchReciters` from `services/dataService.ts` along with now-unused imports.

- [ ] **Step 3: Verify, commit**

```bash
npx tsc --noEmit
npx jest --watchAll=false
npx prettier --write services/dataService.ts
git add -A
git commit -m "chore(search): remove fuse.js, legacy matchers and dead search components"
```

---

### Task 8: Verify on device (behaviour + speed)

Visible UI behaviour changed, so verify in the running app (argent; read `argent-react-native-app-workflow` and `argent-device-interact` first). Per project memory, prefer the PR #333 cloud simulator build if local `expo run:ios` is broken on Xcode 27.

- [ ] **Step 1: Walk each surface** and type: `husary`, `yaseen`, `hgthjpm`, `m`, `36`, `العفاسي`.
  - Home: `husary` shows Al-Hussary first; `36` shows only Ya-Sin; `hgthjpm` shows Al-Fatihah.
  - Browse Surahs, Mushaf search, Reciter profile: `yaseen` shows Ya-Sin first; `36` works in all three.
  - Browse Reciters, Default Reciter, Favorites screen, Favorites sheet, Mushaf picker, Organize: `husary` and `العفاسي` match.
  - `m` on Browse Reciters shows only names with a word starting with M.
- [ ] **Step 2: Measure**: with `argent-react-native-profiler`, record typing `mishari alafasi` into Browse Reciters on an Android emulator. Pass: no JS frame over 16 ms attributed to `createSearchIndex`. If it fails, add a `limit` to screens that render only the top N, and move index preparation off the first keystroke by calling `rankReciters('a')` once after `appBoot` finishes.
- [ ] **Step 3: Record the result** in the PR description (screens checked, profiler numbers).

---

## Phase 2 and 3 roadmap (separate plans, not part of this one)

These need their own specs; listed so Phase 1 decisions do not block them.

**Phase 2: Verse search (the core of quran.com and Tarteel).** Today nothing searches Quran text or translations.
- Build a SQLite FTS5 index at first launch (or ship it prebuilt in `assets/data/`) over a diacritic-free Imlaei text, keyed by `verse_key`, with the same `toSearchKey` folding applied to both index and query so `الرحمن الرحيم` matches regardless of tashkeel.
- Index downloaded translations in the same FTS5 table family (`TranslationDbService` already stores `verse_key` + `text`).
- Root and lemma search ("all forms of ر ح م") from the Quranic Arabic Corpus morphology data; check its licence against `project_translations_tafaseer_licensing` first.
- Tolerant verse lookup: trigram index so a half-remembered or misspelled phrase still finds the ayah (Tarteel's "search by what you remember").
- Results grouped Spotify-style: Top result, Surahs, Verses, Reciters; tapping a verse opens the Mushaf at that ayah (the reader already supports `N:M` navigation).

**Phase 3: Experience and learning.**
- Popularity-ranked results: replace the static featured boost with per-reciter play counts exported from PostHog (`playback_started`, `reciter_id` is 100% covered per the Wrapped readiness audit), refreshed with the app's data version.
- Zero-result telemetry: add `surface` to `trackSearchPerformed` and fire it from every surface (debounced), then feed real failing queries into `golden.test.ts`.
- Matched-text highlighting in results, "Did you mean" when the top hit is a typo-tier match, recent searches beyond Home.
- Arabizi input (`3afasy`, `7ussary`: 3=ع, 7=ح, 2=ء, 5=خ, 9=ق) as a second fallback after the keyboard swap.
- Arabic-to-Latin bridge so an Arabic query matches reciters that only have English names (transliterate the query's consonants into the Latin skeleton alphabet).
- Voice search (Tarteel): on-device speech recognition feeding the same engine; recite-to-find for verses once Phase 2 exists.
