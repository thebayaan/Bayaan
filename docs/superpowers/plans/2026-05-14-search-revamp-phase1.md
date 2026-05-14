# Search Revamp Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the foundation of the new tabbed search experience. Wire reciters, surahs, rewayat, adhkar categories, names of Allah, playlists, and numeric refs through a unified tiered+personal+contextual ranking pipeline. No verse search, no track synthesis, no play history yet (those are Phases 2-4).

**Architecture:** Pure-TS engine under `services/search/` made of small focused modules. A custom tiered matcher (exact > prefix > whole-word > fuzzy) with an in-house Arabic normalizer and transliteration alias map, falling back to the already-installed Fuse v7 only for fuzzy-tier matches. An orchestrator fans queries out to per-entity adapters, layers personal and contextual boosts, sorts by `finalScore = textualScore * (1 + personalBoost + contextualBoost)`, and produces a flat `RankedResult[]` plus a dynamic tab list. The new UI lives in `components/search/v2/` and replaces the existing `SearchView` only when PostHog flag `search.v2` is on.

**Tech Stack:** TypeScript (strict), React Native + Expo, Jest via jest-expo, Fuse.js v7, PostHog feature flags, Zustand stores (existing), AsyncStorage (existing recents).

**Spec:** `docs/superpowers/specs/2026-05-14-search-revamp-design.md`

**Scope deviation from spec:**
- Contextual signals in Phase 1 are clock-based only (morning window 5am-noon, evening 6pm-9pm, Friday from `Date.getDay()`). Prayer-time-aligned windows and Hijri-month-aware Ramadan boost are deferred to a Phase 4 polish task because no Hijri or prayer-time service exists in the codebase today.
- Track synthesis is Phase 3.
- Adhkar individual-item indexing is Phase 4 (Phase 1 only indexes categories).
- Verse search is Phase 2.

---

## File Map

New (all under `services/search/`):
- `types.ts` (shared types: `EntityType`, `RankedResult`, `Signal`, `RankingFeatures`)
- `normalize.ts` (text normalization, Arabic + Latin)
- `aliases.ts` (transliteration alias map)
- `refParser.ts` (numeric ref parsing, extracted from `MushafSearchView`)
- `entityIndex.ts` (tiered matcher + Fuse v7 fallback)
- `personalSignals.ts` (loved + downloads + recents + defaults)
- `contextualSignals.ts` (clock-based context)
- `orchestrator.ts` (top-level search)
- `telemetry.ts` (PostHog event wrappers)
- `index.ts` (public API)
- `adapters/reciter.ts`
- `adapters/surah.ts`
- `adapters/rewayat.ts`
- `adapters/adhkar.ts`
- `adapters/names.ts`
- `adapters/playlist.ts`

New tests (alongside source under `__tests__/`):
- `services/search/__tests__/normalize.test.ts`
- `services/search/__tests__/aliases.test.ts`
- `services/search/__tests__/refParser.test.ts`
- `services/search/__tests__/entityIndex.test.ts`
- `services/search/__tests__/personalSignals.test.ts`
- `services/search/__tests__/contextualSignals.test.ts`
- `services/search/__tests__/orchestrator.test.ts`
- `services/search/adapters/__tests__/<each>.test.ts`

New UI:
- `components/search/v2/SearchViewV2.tsx`
- `components/search/v2/TabBar.tsx`
- `components/search/v2/RankedResultRow.tsx`
- `components/search/v2/SignalIcon.tsx`

New data:
- `data/asma.json` (99 names of Allah)

New utilities:
- `utils/featureFlags.ts` (PostHog `isFeatureEnabled` wrapper)

Modified:
- `app/(tabs)/(b.search)/index.tsx` (gate v1 vs v2 by feature flag)
- `components/mushaf/MushafSearchView.tsx` (replace inline `parseSearchQuery` with shared `refParser`)

---

## Task 1: Project setup, types, feature flag

**Files:**
- Create: `services/search/types.ts`
- Create: `utils/featureFlags.ts`
- Create: `services/search/__tests__/types.test.ts` (smoke only)

- [ ] **Step 1: Create types.ts**

```ts
// services/search/types.ts
import type { Reciter } from '@/data/reciterData';
import type { Surah } from '@/data/surahData';
import type { Rewayat } from '@/data/rewayat';

export type EntityType =
  | 'reciter'
  | 'surah'
  | 'rewayat'
  | 'adhkar_category'
  | 'name_of_allah'
  | 'playlist'
  | 'numeric_ref';

export type Tier = 'exact' | 'prefix' | 'whole_word' | 'fuzzy';

export type Signal =
  | 'loved'
  | 'recent'
  | 'default'
  | 'morning'
  | 'evening'
  | 'friday';

export interface RankingFeatures {
  textualScore: number;       // 0..1
  personalBoost: number;      // 0..1
  contextualBoost: number;    // 0..0.15
  finalScore: number;         // textualScore * (1 + personalBoost + contextualBoost)
  tier: Tier;
  matchedField: string;
  matchedRange: [number, number] | null; // char indices into the displayed string
  signal: Signal | null;      // highest-priority single signal for display
}

export interface RankedResult {
  id: string;                 // stable per-entity composite, e.g. `reciter:42`, `surah:36`
  type: EntityType;
  title: string;              // displayable, original case + diacritics
  subtitle: string;
  arabicPreview?: string;
  badge?: string;
  artwork?: { kind: 'reciter' | 'surah' | 'rewayat' | 'adhkar' | 'name' | 'playlist' | 'verse'; label: string };
  features: RankingFeatures;
  payload:
    | { kind: 'reciter'; reciter: Reciter }
    | { kind: 'surah'; surah: Surah }
    | { kind: 'rewayat'; rewayat: Rewayat }
    | { kind: 'adhkar_category'; categoryId: string }
    | { kind: 'name_of_allah'; index: number }
    | { kind: 'playlist'; playlistId: string }
    | { kind: 'numeric_ref'; ref: NumericRef };
}

export type NumericRef =
  | { kind: 'verse'; surah: number; ayah: number; label: string }
  | { kind: 'page'; page: number; label: string }
  | { kind: 'juz'; juz: number; label: string }
  | { kind: 'surah'; surah: number; label: string };

export interface SearchRequest {
  query: string;
  now?: number; // injectable for tests
}

export interface SearchResponse {
  query: string;
  results: RankedResult[];        // flat list across all types, sorted by finalScore desc
  tabs: Array<{ type: EntityType | 'all'; label: string; count: number }>;
}
```

- [ ] **Step 2: Create featureFlags.ts**

```ts
// utils/featureFlags.ts
import { usePostHog } from 'posthog-react-native';
import { useEffect, useState } from 'react';

export type FlagKey = 'search.v2';

export function useFeatureFlag(key: FlagKey, fallback = false): boolean {
  const posthog = usePostHog();
  const [value, setValue] = useState<boolean>(fallback);

  useEffect(() => {
    if (!posthog) return;
    let cancelled = false;
    Promise.resolve(posthog.isFeatureEnabled(key)).then((v) => {
      if (!cancelled) setValue(Boolean(v));
    });
    return () => {
      cancelled = true;
    };
  }, [posthog, key]);

  return value;
}
```

- [ ] **Step 3: Smoke test for types and featureFlags**

```ts
// services/search/__tests__/types.test.ts
import type { RankedResult } from '../types';

describe('search types', () => {
  it('compiles a minimal RankedResult', () => {
    const r: RankedResult = {
      id: 'reciter:1',
      type: 'reciter',
      title: 'Test',
      subtitle: 'sub',
      features: {
        textualScore: 0.5,
        personalBoost: 0,
        contextualBoost: 0,
        finalScore: 0.5,
        tier: 'whole_word',
        matchedField: 'name',
        matchedRange: null,
        signal: null,
      },
      payload: { kind: 'reciter', reciter: { id: 1, name: 'Test' } as never },
    };
    expect(r.id).toBe('reciter:1');
  });
});
```

- [ ] **Step 4: Run the test**

Run: `npm test -- --runTestsByPath services/search/__tests__/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/search/types.ts services/search/__tests__/types.test.ts utils/featureFlags.ts
git commit -m "feat(search): add types and feature-flag wrapper"
```

---

## Task 2: Text normalizer

**Files:**
- Create: `services/search/normalize.ts`
- Create: `services/search/__tests__/normalize.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// services/search/__tests__/normalize.test.ts
import { normalize, tokenize } from '../normalize';

describe('normalize', () => {
  it('lowercases Latin', () => {
    expect(normalize('Yasin')).toBe('yasin');
  });

  it('strips Latin diacritics', () => {
    expect(normalize('Yāsīn')).toBe('yasin');
  });

  it('strips Arabic tashkeel', () => {
    expect(normalize('يَاسِين')).toBe('ياسين');
  });

  it('folds alef variants to ا', () => {
    expect(normalize('أحمد')).toBe('احمد');
    expect(normalize('إبراهيم')).toBe('ابراهيم');
    expect(normalize('آدم')).toBe('ادم');
  });

  it('folds ى to ي and ة to ه', () => {
    expect(normalize('مصطفى')).toBe('مصطفي');
    expect(normalize('فاطمة')).toBe('فاطمه');
  });

  it('collapses whitespace and trims', () => {
    expect(normalize('  Al   Fatihah ')).toBe('al fatihah');
  });
});

describe('tokenize', () => {
  it('splits on whitespace and punctuation', () => {
    expect(tokenize('Ya-Sin Surah')).toEqual(['ya', 'sin', 'surah']);
  });

  it('handles Arabic and Latin together', () => {
    expect(tokenize('Surah يس')).toEqual(['surah', 'يس']);
  });

  it('returns empty array for empty input', () => {
    expect(tokenize('')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- --runTestsByPath services/search/__tests__/normalize.test.ts`
Expected: FAIL ("Cannot find module '../normalize'")

- [ ] **Step 3: Implement normalize.ts**

```ts
// services/search/normalize.ts

const TASHKEEL_RE = /[ً-ْٰـ]/g; // fathatan..sukun, dagger alef, tatweel
const LATIN_DIACRITICS_RE = /[̀-ͯ]/g;

export function normalize(input: string): string {
  if (!input) return '';
  let s = input.normalize('NFD').replace(LATIN_DIACRITICS_RE, '');
  s = s.toLowerCase();
  s = s.replace(TASHKEEL_RE, '');
  s = s
    .replace(/[أإآ]/g, 'ا') // أإآ -> ا
    .replace(/ى/g, 'ي')               // ى -> ي
    .replace(/ة/g, 'ه');              // ة -> ه
  s = s.replace(/[^a-z0-9؀-ۿ\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function tokenize(input: string): string[] {
  const n = normalize(input);
  return n === '' ? [] : n.split(' ');
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `npm test -- --runTestsByPath services/search/__tests__/normalize.test.ts`
Expected: PASS for all cases.

- [ ] **Step 5: Commit**

```bash
git add services/search/normalize.ts services/search/__tests__/normalize.test.ts
git commit -m "feat(search): add Arabic+Latin text normalizer"
```

---

## Task 3: Transliteration alias map

**Files:**
- Create: `services/search/aliases.ts`
- Create: `services/search/__tests__/aliases.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// services/search/__tests__/aliases.test.ts
import { aliasesFor } from '../aliases';

describe('aliases', () => {
  it('returns surah aliases by number', () => {
    expect(aliasesFor('surah', 36)).toEqual(
      expect.arrayContaining(['yasin', 'yaseen', 'يس']),
    );
  });

  it('returns surah aliases for Al-Fatihah', () => {
    expect(aliasesFor('surah', 1)).toEqual(
      expect.arrayContaining(['fatiha', 'fateha', 'fatihah', 'الفاتحه']),
    );
  });

  it('returns empty array when no aliases are registered', () => {
    expect(aliasesFor('surah', 999)).toEqual([]);
  });

  it('returns rewayat aliases', () => {
    expect(aliasesFor('rewayat', 'hafs-an-assem')).toEqual(
      expect.arrayContaining(['hafs', 'حفص']),
    );
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- --runTestsByPath services/search/__tests__/aliases.test.ts`
Expected: FAIL ("Cannot find module '../aliases'")

- [ ] **Step 3: Implement aliases.ts**

```ts
// services/search/aliases.ts
import { normalize } from './normalize';

type AliasKey = 'surah' | 'rewayat' | 'reciter' | 'name';
type AliasId = number | string;

const RAW_SURAH_ALIASES: Record<number, string[]> = {
  1: ['fatiha', 'fateha', 'fatihah', 'الفاتحه', 'opening'],
  2: ['baqarah', 'baqara', 'البقره', 'cow'],
  18: ['kahf', 'الكهف', 'cave'],
  36: ['yasin', 'yaseen', 'يس', 'ya-sin', 'yāsīn'],
  55: ['rahman', 'rehman', 'الرحمن'],
  56: ['waqiah', 'waqia', 'الواقعه'],
  67: ['mulk', 'الملك', 'sovereignty'],
  112: ['ikhlas', 'ikhlaas', 'الاخلاص', 'sincerity'],
  113: ['falaq', 'الفلق', 'daybreak'],
  114: ['nas', 'naas', 'الناس', 'mankind'],
};

const RAW_REWAYAT_ALIASES: Record<string, string[]> = {
  'hafs-an-assem': ['hafs', 'حفص', 'asim'],
  'warsh-an-nafi': ['warsh', 'ورش', 'nafi'],
  'qaloon-an-nafi': ['qaloon', 'qalun', 'قالون'],
  'al-douri-an-abi-amro': ['douri', 'duri', 'الدوري'],
};

const RAW_NAME_ALIASES: Record<number, string[]> = {
  1: ['rahman', 'rehman', 'merciful', 'most merciful', 'الرحمن'],
  2: ['rahim', 'raheem', 'bestower of mercy', 'الرحيم'],
};

function buildIndex<K extends AliasKey>(
  raw: Record<string | number, string[]>,
): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const [id, list] of Object.entries(raw)) {
    m.set(`${id}`, list.map(normalize));
  }
  return m;
}

const SURAH = buildIndex('surah', RAW_SURAH_ALIASES);
const REWAYAT = buildIndex('rewayat', RAW_REWAYAT_ALIASES);
const NAMES = buildIndex('name', RAW_NAME_ALIASES);

export function aliasesFor(key: AliasKey, id: AliasId): string[] {
  switch (key) {
    case 'surah':
      return SURAH.get(`${id}`) ?? [];
    case 'rewayat':
      return REWAYAT.get(`${id}`) ?? [];
    case 'name':
      return NAMES.get(`${id}`) ?? [];
    case 'reciter':
      return [];
  }
}
```

Note: the surah, rewayat, and name alias maps above are intentionally seeded with the highest-traffic entries. Expand them iteratively in follow-up commits as you observe real queries via telemetry.

- [ ] **Step 4: Run and confirm pass**

Run: `npm test -- --runTestsByPath services/search/__tests__/aliases.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/search/aliases.ts services/search/__tests__/aliases.test.ts
git commit -m "feat(search): add transliteration alias map for surahs and rewayat"
```

---

## Task 4: Extract numeric ref parser from MushafSearchView

**Files:**
- Create: `services/search/refParser.ts`
- Create: `services/search/__tests__/refParser.test.ts`
- Modify: `components/mushaf/MushafSearchView.tsx` (replace inline parser with shared module)

- [ ] **Step 1: Write failing tests**

```ts
// services/search/__tests__/refParser.test.ts
import { parseRef } from '../refParser';

describe('parseRef', () => {
  it('parses a verse reference', () => {
    const refs = parseRef('2:255');
    expect(refs).toEqual([{ kind: 'verse', surah: 2, ayah: 255, label: 'Al-Baqarah 2:255' }]);
  });

  it('parses page references', () => {
    expect(parseRef('page 100')).toEqual([{ kind: 'page', page: 100, label: 'Page 100' }]);
    expect(parseRef('pg 1')).toEqual([{ kind: 'page', page: 1, label: 'Page 1' }]);
  });

  it('parses juz references', () => {
    expect(parseRef('juz 30')).toEqual([{ kind: 'juz', juz: 30, label: 'Juz 30' }]);
    expect(parseRef('amma')).toEqual([{ kind: 'juz', juz: 30, label: 'Juz 30 (Amma)' }]);
    expect(parseRef('tabarak')).toEqual([{ kind: 'juz', juz: 29, label: 'Juz 29 (Tabarak)' }]);
  });

  it('parses plain numbers as multi-candidate', () => {
    const refs = parseRef('30');
    expect(refs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'surah', surah: 30 }),
        expect.objectContaining({ kind: 'juz', juz: 30 }),
        expect.objectContaining({ kind: 'page', page: 30 }),
      ]),
    );
  });

  it('rejects out-of-range numbers', () => {
    expect(parseRef('999')).toEqual([]);
  });

  it('returns empty for non-numeric input', () => {
    expect(parseRef('Yasin')).toEqual([]);
  });

  it('rejects invalid verse refs', () => {
    expect(parseRef('999:1')).toEqual([]);
    expect(parseRef('1:999')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- --runTestsByPath services/search/__tests__/refParser.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement refParser.ts**

Use `SURAHS` from `data/surahData.ts` for the surah name lookup and the per-surah ayah count.

```ts
// services/search/refParser.ts
import { SURAHS } from '@/data/surahData';
import type { NumericRef } from './types';

const PAGE_RE = /^(?:page|pg)\s+(\d{1,3})$/i;
const JUZ_RE = /^(?:juz|jz|j)\s+(\d{1,2})$/i;
const VERSE_RE = /^(\d{1,3}):(\d{1,3})$/;
const PLAIN_NUM_RE = /^(\d{1,3})$/;

function surahLabel(num: number): string {
  const s = SURAHS.find((x) => x.id === num);
  return s ? `${s.translated_name_english} ${num}` : `Surah ${num}`;
}

export function parseRef(input: string): NumericRef[] {
  const q = input.trim().toLowerCase();
  if (!q) return [];

  if (q === 'amma') return [{ kind: 'juz', juz: 30, label: 'Juz 30 (Amma)' }];
  if (q === 'tabarak') return [{ kind: 'juz', juz: 29, label: 'Juz 29 (Tabarak)' }];

  const verse = q.match(VERSE_RE);
  if (verse) {
    const s = Number(verse[1]);
    const a = Number(verse[2]);
    const surah = SURAHS.find((x) => x.id === s);
    if (!surah || a < 1 || a > surah.total_verses) return [];
    return [{ kind: 'verse', surah: s, ayah: a, label: `${surah.translated_name_english} ${s}:${a}` }];
  }

  const page = q.match(PAGE_RE);
  if (page) {
    const p = Number(page[1]);
    if (p < 1 || p > 604) return [];
    return [{ kind: 'page', page: p, label: `Page ${p}` }];
  }

  const juz = q.match(JUZ_RE);
  if (juz) {
    const j = Number(juz[1]);
    if (j < 1 || j > 30) return [];
    return [{ kind: 'juz', juz: j, label: `Juz ${j}` }];
  }

  const plain = q.match(PLAIN_NUM_RE);
  if (plain) {
    const n = Number(plain[1]);
    const out: NumericRef[] = [];
    if (n >= 1 && n <= 114) out.push({ kind: 'surah', surah: n, label: surahLabel(n) });
    if (n >= 1 && n <= 30) out.push({ kind: 'juz', juz: n, label: `Juz ${n}` });
    if (n >= 1 && n <= 604) out.push({ kind: 'page', page: n, label: `Page ${n}` });
    return out;
  }

  return [];
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `npm test -- --runTestsByPath services/search/__tests__/refParser.test.ts`
Expected: PASS.

- [ ] **Step 5: Replace inline parser in MushafSearchView**

Open `components/mushaf/MushafSearchView.tsx`. Find the `parseSearchQuery` function (lines 92-220 per the recon). Replace its body with a call to `parseRef` from `@/services/search/refParser` and map its output back to whatever shape `MushafSearchView` consumes downstream. Keep all existing call sites intact; only the parser internals change.

Concretely:
1. Import `parseRef` and `NumericRef` at the top of `MushafSearchView.tsx`.
2. Replace the body of `parseSearchQuery` with a small adapter that calls `parseRef(query)` and converts each `NumericRef` into the local result shape used by `MushafSearchView`. Delete the now-unused regex constants and helpers inside `parseSearchQuery`.

- [ ] **Step 6: Manual smoke test mushaf search**

Run the app, open the mushaf, tap search, try queries: `2:255`, `page 100`, `juz 30`, `amma`, `tabarak`, `30`, `Yasin`. All should behave exactly as before (this is a refactor, not a behavior change). If anything regresses, revert this step before committing.

- [ ] **Step 7: Commit**

```bash
git add services/search/refParser.ts services/search/__tests__/refParser.test.ts components/mushaf/MushafSearchView.tsx
git commit -m "refactor(search): extract numeric ref parser into shared module"
```

---

## Task 5: EntityIndex (build side)

**Files:**
- Create: `services/search/entityIndex.ts`
- Create: `services/search/__tests__/entityIndex.test.ts`

- [ ] **Step 1: Write the failing test for build + exact match**

```ts
// services/search/__tests__/entityIndex.test.ts
import { createEntityIndex } from '../entityIndex';

interface TestRow {
  id: string;
  name: string;
  arabic_name: string;
  aliases?: string[];
}

const fields: Array<{ key: keyof TestRow | 'aliases'; weight: number }> = [
  { key: 'name', weight: 2 },
  { key: 'arabic_name', weight: 2 },
  { key: 'aliases', weight: 1.5 },
];

const rows: TestRow[] = [
  { id: 'r1', name: 'Mishary Alafasy', arabic_name: 'مشاري العفاسي' },
  { id: 'r2', name: 'Yasser Ad-Dossari', arabic_name: 'ياسر الدوسري' },
  { id: 's36', name: 'Ya-Sin', arabic_name: 'يس', aliases: ['yaseen', 'yāsīn'] },
];

describe('entityIndex build + match', () => {
  const idx = createEntityIndex({
    rows,
    idOf: (r) => r.id,
    fields,
    valueOf: (r, k) => (k === 'aliases' ? r.aliases ?? [] : (r[k as keyof TestRow] as string | undefined)),
  });

  it('returns exact tier for exact match', () => {
    const hits = idx.search('Ya-Sin');
    const top = hits.find((h) => h.id === 's36');
    expect(top?.tier).toBe('exact');
    expect(top?.textualScore).toBeCloseTo(1.0);
  });

  it('returns prefix tier for prefix match', () => {
    const hits = idx.search('Mish');
    const top = hits.find((h) => h.id === 'r1');
    expect(top?.tier).toBe('prefix');
    expect(top?.textualScore).toBeGreaterThan(0.84);
    expect(top?.textualScore).toBeLessThan(0.91);
  });

  it('matches Arabic-normalized', () => {
    const hits = idx.search('ياسر');
    expect(hits.find((h) => h.id === 'r2')).toBeDefined();
  });

  it('matches via aliases field', () => {
    const hits = idx.search('Yāsīn');
    expect(hits.find((h) => h.id === 's36')).toBeDefined();
  });

  it('filters below the floor', () => {
    const hits = idx.search('xyzqq');
    expect(hits).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- --runTestsByPath services/search/__tests__/entityIndex.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement entityIndex.ts**

```ts
// services/search/entityIndex.ts
import Fuse from 'fuse.js';
import { normalize, tokenize } from './normalize';
import type { Tier } from './types';

export interface FieldSpec<Row, K extends string = string> {
  key: K;
  weight: number;
}

export interface EntityIndexOptions<Row> {
  rows: Row[];
  idOf: (row: Row) => string;
  fields: Array<FieldSpec<Row>>;
  valueOf: (row: Row, key: string) => string | string[] | number | undefined;
  floor?: number; // textualScore below which results are dropped (default 0.2)
}

export interface EntityHit {
  id: string;
  textualScore: number;
  tier: Tier;
  matchedField: string;
  matchedRange: [number, number] | null;
}

interface TokenIndexEntry {
  id: string;
  field: string;
  fieldWeight: number;
  originalToken: string;       // normalized token from the field
  fullValue: string;           // normalized full field value
  range: [number, number];     // index of token start..end inside displayed value (best-effort)
}

const TIER_SCORE: Record<Tier, number> = {
  exact: 1.0,
  prefix: 0.85,
  whole_word: 0.7,
  fuzzy: 0.5,
};

function tierFor(query: string, token: string): Tier | null {
  if (token === query) return 'exact';
  if (token.startsWith(query)) return 'prefix';
  return null;
}

export function createEntityIndex<Row>(opts: EntityIndexOptions<Row>) {
  const floor = opts.floor ?? 0.2;
  const tokenMap = new Map<string, TokenIndexEntry[]>();
  const docsForFuse: Array<{ id: string; field: string; value: string; weight: number }> = [];

  for (const row of opts.rows) {
    const id = opts.idOf(row);
    for (const spec of opts.fields) {
      const raw = opts.valueOf(row, spec.key);
      const values =
        raw == null ? [] : Array.isArray(raw) ? raw.map(String) : [String(raw)];
      for (const v of values) {
        const normFull = normalize(v);
        if (!normFull) continue;
        docsForFuse.push({ id, field: spec.key, value: normFull, weight: spec.weight });
        for (const tok of tokenize(v)) {
          const arr = tokenMap.get(tok) ?? [];
          const start = normFull.indexOf(tok);
          arr.push({
            id,
            field: spec.key,
            fieldWeight: spec.weight,
            originalToken: tok,
            fullValue: normFull,
            range: [Math.max(0, start), Math.max(0, start) + tok.length],
          });
          tokenMap.set(tok, arr);
        }
      }
    }
  }

  const fuse = new Fuse(docsForFuse, {
    keys: ['value'],
    includeScore: true,
    threshold: 0.4,
    distance: 200,
    minMatchCharLength: 2,
    ignoreLocation: true,
  });

  function searchSingleToken(qTok: string): EntityHit[] {
    const perId = new Map<string, EntityHit>();

    // Tier 1+2: exact and prefix from inverted index
    for (const [tok, entries] of tokenMap) {
      const t = tierFor(qTok, tok);
      if (!t) continue;
      for (const e of entries) {
        const fieldScore = Math.min(1, TIER_SCORE[t] * e.fieldWeight);
        const cur = perId.get(e.id);
        if (!cur || fieldScore > cur.textualScore) {
          perId.set(e.id, {
            id: e.id,
            textualScore: fieldScore,
            tier: t,
            matchedField: e.field,
            matchedRange: e.range,
          });
        }
      }
    }

    // Tier 3: whole_word substring (qTok appears mid-string)
    if (perId.size === 0) {
      for (const [, entries] of tokenMap) {
        for (const e of entries) {
          if (e.fullValue.includes(qTok) && !e.originalToken.startsWith(qTok)) {
            const fieldScore = Math.min(1, TIER_SCORE.whole_word * e.fieldWeight);
            const cur = perId.get(e.id);
            if (!cur || fieldScore > cur.textualScore) {
              perId.set(e.id, {
                id: e.id,
                textualScore: fieldScore,
                tier: 'whole_word',
                matchedField: e.field,
                matchedRange: e.range,
              });
            }
          }
        }
      }
    }

    // Tier 4: fuzzy via Fuse
    if (perId.size === 0) {
      const fuseHits = fuse.search(qTok);
      for (const h of fuseHits) {
        const fScore = h.score ?? 0.5;
        const tierScore = TIER_SCORE.fuzzy * (1 - fScore);
        const fieldScore = Math.min(1, tierScore * h.item.weight);
        const cur = perId.get(h.item.id);
        if (!cur || fieldScore > cur.textualScore) {
          perId.set(h.item.id, {
            id: h.item.id,
            textualScore: fieldScore,
            tier: 'fuzzy',
            matchedField: h.item.field,
            matchedRange: null,
          });
        }
      }
    }

    return [...perId.values()];
  }

  function search(query: string): EntityHit[] {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];

    if (tokens.length === 1) {
      return searchSingleToken(tokens[0]).filter((h) => h.textualScore >= floor);
    }

    const perToken = tokens.map(searchSingleToken);
    const idCounts = new Map<string, EntityHit[]>();
    for (const list of perToken) {
      for (const h of list) {
        const arr = idCounts.get(h.id) ?? [];
        arr.push(h);
        idCounts.set(h.id, arr);
      }
    }

    const out: EntityHit[] = [];
    for (const [id, hits] of idCounts) {
      if (hits.length < tokens.length) continue; // every token must hit
      const product = hits.reduce((p, h) => p * h.textualScore, 1);
      const geo = Math.pow(product, 1 / hits.length);
      if (geo < floor) continue;
      const best = hits.reduce((a, b) => (a.textualScore >= b.textualScore ? a : b));
      out.push({ ...best, textualScore: geo });
    }
    return out;
  }

  return { search };
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `npm test -- --runTestsByPath services/search/__tests__/entityIndex.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/search/entityIndex.ts services/search/__tests__/entityIndex.test.ts
git commit -m "feat(search): add tiered entity index with Fuse v7 fuzzy fallback"
```

---

## Task 6: Reciter adapter

**Files:**
- Create: `services/search/adapters/reciter.ts`
- Create: `services/search/adapters/__tests__/reciter.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// services/search/adapters/__tests__/reciter.test.ts
import { buildReciterIndex, reciterToResult } from '../reciter';
import type { Reciter } from '@/data/reciterData';

const fixtures: Reciter[] = [
  { id: 1, name: 'Mishary Rashid Alafasy', arabic_name: 'مشاري راشد العفاسي', translated_name: 'Mishary', style: 'murattal', description: 'Kuwaiti reciter', rewayat: [] } as unknown as Reciter,
  { id: 2, name: 'AbdulRahman Sudais', arabic_name: 'عبد الرحمن السديس', translated_name: 'Sudais', style: 'murattal', description: '', rewayat: [] } as unknown as Reciter,
];

describe('reciter adapter', () => {
  const idx = buildReciterIndex(fixtures);

  it('matches by name prefix', () => {
    const hits = idx.search('Mish');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].id).toBe('reciter:1');
  });

  it('matches by Arabic name', () => {
    const hits = idx.search('السديس');
    expect(hits[0].id).toBe('reciter:2');
  });

  it('reciterToResult produces a RankedResult shape', () => {
    const r = reciterToResult(fixtures[0], {
      textualScore: 0.8, personalBoost: 0, contextualBoost: 0,
      finalScore: 0.8, tier: 'prefix', matchedField: 'name', matchedRange: [0, 4], signal: null,
    });
    expect(r.id).toBe('reciter:1');
    expect(r.type).toBe('reciter');
    expect(r.title).toBe('Mishary Rashid Alafasy');
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- --runTestsByPath services/search/adapters/__tests__/reciter.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement reciter.ts**

```ts
// services/search/adapters/reciter.ts
import type { Reciter } from '@/data/reciterData';
import { createEntityIndex, type EntityHit } from '../entityIndex';
import type { RankedResult, RankingFeatures } from '../types';

const FIELDS = [
  { key: 'name', weight: 2.0 },
  { key: 'arabic_name', weight: 2.0 },
  { key: 'translated_name', weight: 1.5 },
  { key: 'description', weight: 0.7 },
  { key: 'style', weight: 0.5 },
];

export function buildReciterIndex(reciters: Reciter[]) {
  const idx = createEntityIndex<Reciter>({
    rows: reciters,
    idOf: (r) => `reciter:${r.id}`,
    fields: FIELDS,
    valueOf: (r, k) => (r as unknown as Record<string, string | undefined>)[k],
  });
  return {
    search: (q: string): EntityHit[] => idx.search(q),
    byId: new Map(reciters.map((r) => [`reciter:${r.id}`, r])),
  };
}

export function reciterToResult(r: Reciter, features: RankingFeatures): RankedResult {
  const initials = r.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return {
    id: `reciter:${r.id}`,
    type: 'reciter',
    title: r.name,
    subtitle: `${(r.rewayat ?? []).length} narration${(r.rewayat ?? []).length === 1 ? '' : 's'} - ${r.style ?? 'murattal'}`,
    artwork: { kind: 'reciter', label: initials },
    features,
    payload: { kind: 'reciter', reciter: r },
  };
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `npm test -- --runTestsByPath services/search/adapters/__tests__/reciter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/search/adapters/reciter.ts services/search/adapters/__tests__/reciter.test.ts
git commit -m "feat(search): add reciter adapter"
```

---

## Task 7: Surah adapter

**Files:**
- Create: `services/search/adapters/surah.ts`
- Create: `services/search/adapters/__tests__/surah.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// services/search/adapters/__tests__/surah.test.ts
import { buildSurahIndex, surahToResult } from '../surah';
import { SURAHS } from '@/data/surahData';

describe('surah adapter', () => {
  const idx = buildSurahIndex(SURAHS);

  it('matches Al-Fatihah by name', () => {
    const hits = idx.search('fatiha');
    expect(hits[0].id).toBe('surah:1');
  });

  it('matches Yasin via alias', () => {
    const hits = idx.search('yaseen');
    expect(hits[0].id).toBe('surah:36');
  });

  it('matches Ya-Sin by Arabic', () => {
    const hits = idx.search('يس');
    expect(hits[0].id).toBe('surah:36');
  });

  it('surahToResult produces correct shape', () => {
    const surah = SURAHS.find((s) => s.id === 36)!;
    const r = surahToResult(surah, {
      textualScore: 1, personalBoost: 0, contextualBoost: 0,
      finalScore: 1, tier: 'exact', matchedField: 'english_name', matchedRange: [0, 5], signal: null,
    });
    expect(r.type).toBe('surah');
    expect(r.title).toContain('Ya');
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- --runTestsByPath services/search/adapters/__tests__/surah.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement surah.ts**

```ts
// services/search/adapters/surah.ts
import { SURAHS, type Surah } from '@/data/surahData';
import { createEntityIndex, type EntityHit } from '../entityIndex';
import { aliasesFor } from '../aliases';
import type { RankedResult, RankingFeatures } from '../types';

const FIELDS = [
  { key: 'translated_name_english', weight: 2.0 },
  { key: 'name_arabic', weight: 2.0 },
  { key: 'name', weight: 1.8 },
  { key: 'aliases', weight: 1.8 },
  { key: 'id', weight: 1.0 },
  { key: 'revelation_type', weight: 0.5 },
];

export function buildSurahIndex(surahs: Surah[]) {
  const idx = createEntityIndex<Surah>({
    rows: surahs,
    idOf: (s) => `surah:${s.id}`,
    fields: FIELDS,
    valueOf: (s, k) => {
      if (k === 'aliases') return aliasesFor('surah', s.id);
      if (k === 'id') return String(s.id);
      return (s as unknown as Record<string, string | undefined>)[k];
    },
  });
  return {
    search: (q: string): EntityHit[] => idx.search(q),
    byId: new Map(surahs.map((s) => [`surah:${s.id}`, s])),
  };
}

export function surahToResult(s: Surah, features: RankingFeatures): RankedResult {
  return {
    id: `surah:${s.id}`,
    type: 'surah',
    title: s.translated_name_english ?? s.name,
    subtitle: `Chapter ${s.id} - ${s.total_verses} verses - ${s.revelation_type}`,
    arabicPreview: s.name_arabic,
    artwork: { kind: 'surah', label: String(s.id) },
    features,
    payload: { kind: 'surah', surah: s },
  };
}

export { SURAHS };
```

- [ ] **Step 4: Run and confirm pass**

Run: `npm test -- --runTestsByPath services/search/adapters/__tests__/surah.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/search/adapters/surah.ts services/search/adapters/__tests__/surah.test.ts
git commit -m "feat(search): add surah adapter with alias expansion"
```

---

## Task 8: Rewayat adapter

**Files:**
- Create: `services/search/adapters/rewayat.ts`
- Create: `services/search/adapters/__tests__/rewayat.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// services/search/adapters/__tests__/rewayat.test.ts
import { buildRewayatIndex, rewayatToResult } from '../rewayat';
import { REWAYAT_REGISTRY } from '@/data/rewayat';

describe('rewayat adapter', () => {
  const idx = buildRewayatIndex(REWAYAT_REGISTRY);

  it('matches Hafs', () => {
    const hits = idx.search('hafs');
    expect(hits[0].id).toBe('rewayat:hafs-an-assem');
  });

  it('matches by Arabic alias', () => {
    const hits = idx.search('حفص');
    expect(hits[0].id).toBe('rewayat:hafs-an-assem');
  });

  it('rewayatToResult produces correct shape', () => {
    const hafs = REWAYAT_REGISTRY.find((r) => r.id === 'hafs-an-assem')!;
    const r = rewayatToResult(hafs, {
      textualScore: 1, personalBoost: 0, contextualBoost: 0,
      finalScore: 1, tier: 'exact', matchedField: 'displayName', matchedRange: null, signal: null,
    });
    expect(r.type).toBe('rewayat');
    expect(r.title).toBe('Hafs');
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- --runTestsByPath services/search/adapters/__tests__/rewayat.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement rewayat.ts**

```ts
// services/search/adapters/rewayat.ts
import { type Rewayat } from '@/data/rewayat';
import { createEntityIndex, type EntityHit } from '../entityIndex';
import { aliasesFor } from '../aliases';
import type { RankedResult, RankingFeatures } from '../types';

const FIELDS = [
  { key: 'displayName', weight: 2.0 },
  { key: 'name', weight: 1.8 },
  { key: 'aliases', weight: 1.5 },
  { key: 'teacher', weight: 0.8 },
  { key: 'student', weight: 0.8 },
  { key: 'description', weight: 0.7 },
];

export function buildRewayatIndex(rows: Rewayat[]) {
  const idx = createEntityIndex<Rewayat>({
    rows,
    idOf: (r) => `rewayat:${r.id}`,
    fields: FIELDS,
    valueOf: (r, k) => {
      if (k === 'aliases') return aliasesFor('rewayat', r.id);
      return (r as unknown as Record<string, string | undefined>)[k];
    },
  });
  return {
    search: (q: string): EntityHit[] => idx.search(q),
    byId: new Map(rows.map((r) => [`rewayat:${r.id}`, r])),
  };
}

export function rewayatToResult(r: Rewayat, features: RankingFeatures): RankedResult {
  return {
    id: `rewayat:${r.id}`,
    type: 'rewayat',
    title: r.displayName,
    subtitle: r.description,
    artwork: { kind: 'rewayat', label: r.displayName.slice(0, 2) },
    features,
    payload: { kind: 'rewayat', rewayat: r },
  };
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `npm test -- --runTestsByPath services/search/adapters/__tests__/rewayat.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/search/adapters/rewayat.ts services/search/adapters/__tests__/rewayat.test.ts
git commit -m "feat(search): add rewayat adapter"
```

---

## Task 9: Adhkar category adapter

**Files:**
- Create: `services/search/adapters/adhkar.ts`
- Create: `services/search/adapters/__tests__/adhkar.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// services/search/adapters/__tests__/adhkar.test.ts
import { buildAdhkarCategoryIndex, adhkarCategoryToResult, loadAdhkarCategories } from '../adhkar';

describe('adhkar category adapter', () => {
  const cats = loadAdhkarCategories();
  const idx = buildAdhkarCategoryIndex(cats);

  it('matches morning', () => {
    const hits = idx.search('morning');
    expect(hits.length).toBeGreaterThan(0);
    const top = idx.byId.get(hits[0].id);
    expect(top?.title.toLowerCase()).toContain('morning');
  });

  it('matches by tag', () => {
    const hits = idx.search('daily');
    expect(hits.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- --runTestsByPath services/search/adapters/__tests__/adhkar.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement adhkar.ts**

```ts
// services/search/adapters/adhkar.ts
import adhkarRaw from '@/data/adhkar.json';
import { createEntityIndex, type EntityHit } from '../entityIndex';
import type { RankedResult, RankingFeatures } from '../types';

export interface AdhkarCategory {
  id: string;
  title: string;
  audio_url?: string;
  broad_tags?: string[];
  dhikr_count?: number;
}

export function loadAdhkarCategories(): AdhkarCategory[] {
  const data = adhkarRaw as { categories?: AdhkarCategory[] } | AdhkarCategory[];
  return Array.isArray(data) ? data : data.categories ?? [];
}

const FIELDS = [
  { key: 'title', weight: 2.0 },
  { key: 'broad_tags', weight: 1.0 },
];

export function buildAdhkarCategoryIndex(rows: AdhkarCategory[]) {
  const idx = createEntityIndex<AdhkarCategory>({
    rows,
    idOf: (c) => `adhkar:${c.id}`,
    fields: FIELDS,
    valueOf: (c, k) => {
      if (k === 'broad_tags') return c.broad_tags ?? [];
      return (c as unknown as Record<string, string | undefined>)[k];
    },
  });
  return {
    search: (q: string): EntityHit[] => idx.search(q),
    byId: new Map(rows.map((c) => [`adhkar:${c.id}`, c])),
  };
}

export function adhkarCategoryToResult(c: AdhkarCategory, features: RankingFeatures): RankedResult {
  return {
    id: `adhkar:${c.id}`,
    type: 'adhkar_category',
    title: c.title,
    subtitle: `${c.dhikr_count ?? 0} adhkar`,
    artwork: { kind: 'adhkar', label: c.title[0] ?? '?' },
    features,
    payload: { kind: 'adhkar_category', categoryId: c.id },
  };
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `npm test -- --runTestsByPath services/search/adapters/__tests__/adhkar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/search/adapters/adhkar.ts services/search/adapters/__tests__/adhkar.test.ts
git commit -m "feat(search): add adhkar category adapter"
```

---

## Task 10: Names of Allah adapter (and seed data)

**Files:**
- Create: `data/asma.json`
- Create: `services/search/adapters/names.ts`
- Create: `services/search/adapters/__tests__/names.test.ts`

- [ ] **Step 1: Create the data file**

Seed `data/asma.json` with the 99 names. For brevity here, include the first 5 plus structure; the remaining 94 should be filled from a canonical authoritative source (e.g., `quran.com`'s name list, license-permitting). Treat completing this dataset as part of the same task.

```json
[
  { "index": 1,  "arabic": "الرَّحْمَٰنُ", "transliteration": "Ar-Rahman",  "meaning_en": "The Most Merciful" },
  { "index": 2,  "arabic": "الرَّحِيمُ",   "transliteration": "Ar-Rahim",   "meaning_en": "The Bestower of Mercy" },
  { "index": 3,  "arabic": "الْمَلِكُ",     "transliteration": "Al-Malik",   "meaning_en": "The King" },
  { "index": 4,  "arabic": "الْقُدُّوسُ",   "transliteration": "Al-Quddus",  "meaning_en": "The Holy" },
  { "index": 5,  "arabic": "السَّلَامُ",   "transliteration": "As-Salam",   "meaning_en": "The Source of Peace" }
]
```

The implementer must complete all 99 entries before committing this task.

- [ ] **Step 2: Write failing test**

```ts
// services/search/adapters/__tests__/names.test.ts
import { buildNamesIndex, loadAsma } from '../names';

describe('names adapter', () => {
  const rows = loadAsma();
  const idx = buildNamesIndex(rows);

  it('seeds at least 99 entries', () => {
    expect(rows.length).toBeGreaterThanOrEqual(99);
  });

  it('matches Ar-Rahman by transliteration', () => {
    const hits = idx.search('Rahman');
    expect(hits[0].id).toBe('name:1');
  });

  it('matches by Arabic', () => {
    const hits = idx.search('الرحمن');
    expect(hits[0].id).toBe('name:1');
  });

  it('matches by meaning', () => {
    const hits = idx.search('merciful');
    expect(hits.find((h) => h.id === 'name:1')).toBeDefined();
  });
});
```

- [ ] **Step 3: Run and confirm failure**

Run: `npm test -- --runTestsByPath services/search/adapters/__tests__/names.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement names.ts**

```ts
// services/search/adapters/names.ts
import asmaRaw from '@/data/asma.json';
import { createEntityIndex, type EntityHit } from '../entityIndex';
import type { RankedResult, RankingFeatures } from '../types';

export interface NameOfAllah {
  index: number;
  arabic: string;
  transliteration: string;
  meaning_en: string;
}

export function loadAsma(): NameOfAllah[] {
  return asmaRaw as NameOfAllah[];
}

const FIELDS = [
  { key: 'arabic', weight: 2.0 },
  { key: 'transliteration', weight: 1.8 },
  { key: 'meaning_en', weight: 1.6 },
];

export function buildNamesIndex(rows: NameOfAllah[]) {
  const idx = createEntityIndex<NameOfAllah>({
    rows,
    idOf: (n) => `name:${n.index}`,
    fields: FIELDS,
    valueOf: (n, k) => (n as unknown as Record<string, string | undefined>)[k],
  });
  return {
    search: (q: string): EntityHit[] => idx.search(q),
    byId: new Map(rows.map((n) => [`name:${n.index}`, n])),
  };
}

export function nameToResult(n: NameOfAllah, features: RankingFeatures): RankedResult {
  return {
    id: `name:${n.index}`,
    type: 'name_of_allah',
    title: `${n.transliteration} - ${n.meaning_en}`,
    subtitle: `Beautiful Name ${n.index} of 99`,
    arabicPreview: n.arabic,
    artwork: { kind: 'name', label: String(n.index) },
    features,
    payload: { kind: 'name_of_allah', index: n.index },
  };
}
```

- [ ] **Step 5: Run and confirm pass**

Run: `npm test -- --runTestsByPath services/search/adapters/__tests__/names.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add data/asma.json services/search/adapters/names.ts services/search/adapters/__tests__/names.test.ts
git commit -m "feat(search): add 99 names of Allah dataset and adapter"
```

---

## Task 11: Playlist adapter

**Files:**
- Create: `services/search/adapters/playlist.ts`
- Create: `services/search/adapters/__tests__/playlist.test.ts`

The playlist source store lives at `services/player/store/` (specific file determined by inspecting collection imports in `CollectionSearchModal`). The adapter wraps whatever public read API exists.

- [ ] **Step 1: Identify the playlist read API**

Open `components/collection/CollectionSearchModal.tsx`, find how it reads playlists, and capture the function name + module path. Use that as the source for the adapter.

- [ ] **Step 2: Write failing test**

```ts
// services/search/adapters/__tests__/playlist.test.ts
import { buildPlaylistIndex, playlistToResult } from '../playlist';

interface PL { id: string; name: string; itemCount: number }

describe('playlist adapter', () => {
  const rows: PL[] = [
    { id: 'system:loved', name: 'Loved tracks', itemCount: 14 },
    { id: 'user:abc', name: 'Friday playlist', itemCount: 6 },
  ];
  const idx = buildPlaylistIndex(rows);

  it('matches by name', () => {
    const hits = idx.search('Friday');
    expect(hits[0].id).toBe('playlist:user:abc');
  });

  it('playlistToResult shape', () => {
    const r = playlistToResult(rows[0], {
      textualScore: 1, personalBoost: 0, contextualBoost: 0,
      finalScore: 1, tier: 'exact', matchedField: 'name', matchedRange: null, signal: null,
    });
    expect(r.type).toBe('playlist');
    expect(r.title).toBe('Loved tracks');
  });
});
```

- [ ] **Step 3: Run and confirm failure**

Run: `npm test -- --runTestsByPath services/search/adapters/__tests__/playlist.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement playlist.ts**

```ts
// services/search/adapters/playlist.ts
import { createEntityIndex, type EntityHit } from '../entityIndex';
import type { RankedResult, RankingFeatures } from '../types';

export interface PlaylistSummary {
  id: string;
  name: string;
  itemCount: number;
}

const FIELDS = [{ key: 'name', weight: 2.0 }];

export function buildPlaylistIndex(rows: PlaylistSummary[]) {
  const idx = createEntityIndex<PlaylistSummary>({
    rows,
    idOf: (p) => `playlist:${p.id}`,
    fields: FIELDS,
    valueOf: (p, k) => (p as unknown as Record<string, string | undefined>)[k],
  });
  return {
    search: (q: string): EntityHit[] => idx.search(q),
    byId: new Map(rows.map((p) => [`playlist:${p.id}`, p])),
  };
}

export function playlistToResult(p: PlaylistSummary, features: RankingFeatures): RankedResult {
  return {
    id: `playlist:${p.id}`,
    type: 'playlist',
    title: p.name,
    subtitle: `${p.itemCount} item${p.itemCount === 1 ? '' : 's'}`,
    artwork: { kind: 'playlist', label: p.name[0]?.toUpperCase() ?? 'P' },
    features,
    payload: { kind: 'playlist', playlistId: p.id },
  };
}
```

- [ ] **Step 5: Run and confirm pass**

Run: `npm test -- --runTestsByPath services/search/adapters/__tests__/playlist.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/search/adapters/playlist.ts services/search/adapters/__tests__/playlist.test.ts
git commit -m "feat(search): add playlist adapter"
```

---

## Task 12: Personal signals

**Files:**
- Create: `services/search/personalSignals.ts`
- Create: `services/search/__tests__/personalSignals.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// services/search/__tests__/personalSignals.test.ts
import { computePersonalBoost } from '../personalSignals';

describe('computePersonalBoost', () => {
  it('returns 0 when no signals match', () => {
    const ctx = {
      lovedReciterIds: new Set<number>(),
      lovedTrackIds: new Set<string>(),
      downloadedTrackIds: new Set<string>(),
      defaultReciterId: null,
      defaultRewayatId: null,
      recentResultIds: new Set<string>(),
    };
    expect(computePersonalBoost('reciter:1', ctx).boost).toBe(0);
  });

  it('applies loved reciter boost of 0.20', () => {
    const ctx = {
      lovedReciterIds: new Set([1]),
      lovedTrackIds: new Set<string>(),
      downloadedTrackIds: new Set<string>(),
      defaultReciterId: null,
      defaultRewayatId: null,
      recentResultIds: new Set<string>(),
    };
    const out = computePersonalBoost('reciter:1', ctx);
    expect(out.boost).toBeCloseTo(0.2);
    expect(out.signal).toBe('loved');
  });

  it('applies default reciter boost of 0.20', () => {
    const ctx = {
      lovedReciterIds: new Set<number>(),
      lovedTrackIds: new Set<string>(),
      downloadedTrackIds: new Set<string>(),
      defaultReciterId: 5,
      defaultRewayatId: null,
      recentResultIds: new Set<string>(),
    };
    const out = computePersonalBoost('reciter:5', ctx);
    expect(out.boost).toBeCloseTo(0.2);
    expect(out.signal).toBe('default');
  });

  it('applies recent search boost of 0.30', () => {
    const ctx = {
      lovedReciterIds: new Set<number>(),
      lovedTrackIds: new Set<string>(),
      downloadedTrackIds: new Set<string>(),
      defaultReciterId: null,
      defaultRewayatId: null,
      recentResultIds: new Set(['surah:36']),
    };
    const out = computePersonalBoost('surah:36', ctx);
    expect(out.boost).toBeCloseTo(0.3);
    expect(out.signal).toBe('recent');
  });

  it('sums multiple signals and caps total at 1.0', () => {
    const ctx = {
      lovedReciterIds: new Set([1]),
      lovedTrackIds: new Set<string>(),
      downloadedTrackIds: new Set<string>(),
      defaultReciterId: 1,
      defaultRewayatId: null,
      recentResultIds: new Set(['reciter:1']),
    };
    const out = computePersonalBoost('reciter:1', ctx);
    expect(out.boost).toBeCloseTo(0.7); // 0.2 + 0.2 + 0.3
    expect(out.signal).toBe('loved'); // priority: loved > recent > default
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- --runTestsByPath services/search/__tests__/personalSignals.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement personalSignals.ts**

```ts
// services/search/personalSignals.ts
import type { Signal } from './types';

export interface PersonalContext {
  lovedReciterIds: Set<number>;
  lovedTrackIds: Set<string>;        // `${reciterId}:${surahId}` (used in Phase 3)
  downloadedTrackIds: Set<string>;   // `${reciterId}:${surahId}` (used in Phase 3)
  defaultReciterId: number | null;
  defaultRewayatId: string | null;
  recentResultIds: Set<string>;      // full result ids, e.g. `surah:36`
}

const WEIGHTS = {
  loved: 0.2,
  downloaded: 0.2,
  recent: 0.3,
  default: 0.2,
};

export function computePersonalBoost(
  resultId: string,
  ctx: PersonalContext,
): { boost: number; signal: Signal | null } {
  let boost = 0;
  let signal: Signal | null = null;

  // Recent first (high priority signal but mid-weight)
  if (ctx.recentResultIds.has(resultId)) {
    boost += WEIGHTS.recent;
    signal = 'recent';
  }

  // Loved: applies to reciters and (in Phase 3) tracks
  if (resultId.startsWith('reciter:')) {
    const numericId = Number(resultId.slice('reciter:'.length));
    if (ctx.lovedReciterIds.has(numericId)) {
      boost += WEIGHTS.loved;
      signal = 'loved';
    }
    if (ctx.defaultReciterId === numericId) {
      boost += WEIGHTS.default;
      if (!signal) signal = 'default';
    }
  }

  if (resultId.startsWith('rewayat:') && ctx.defaultRewayatId === resultId.slice('rewayat:'.length)) {
    boost += WEIGHTS.default;
    if (!signal) signal = 'default';
  }

  return { boost: Math.min(1.0, boost), signal };
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `npm test -- --runTestsByPath services/search/__tests__/personalSignals.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/search/personalSignals.ts services/search/__tests__/personalSignals.test.ts
git commit -m "feat(search): add personal signal computation (loved, recent, default)"
```

---

## Task 13: Contextual signals (clock-based only)

**Files:**
- Create: `services/search/contextualSignals.ts`
- Create: `services/search/__tests__/contextualSignals.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// services/search/__tests__/contextualSignals.test.ts
import { computeContextualBoost } from '../contextualSignals';

const MONDAY_9AM = new Date(2026, 4, 11, 9, 0).getTime();   // Mon May 11 2026 09:00
const FRIDAY_2PM = new Date(2026, 4, 15, 14, 0).getTime();  // Fri May 15 2026 14:00
const MONDAY_7PM = new Date(2026, 4, 11, 19, 0).getTime();  // Mon May 11 2026 19:00

describe('computeContextualBoost', () => {
  it('boosts morning adhkar at 9am', () => {
    const out = computeContextualBoost('adhkar:27', { now: MONDAY_9AM });
    expect(out.boost).toBeCloseTo(0.1);
    expect(out.signal).toBe('morning');
  });

  it('boosts evening adhkar at 7pm', () => {
    const out = computeContextualBoost('adhkar:28', { now: MONDAY_7PM });
    expect(out.boost).toBeCloseTo(0.1);
    expect(out.signal).toBe('evening');
  });

  it('boosts Al-Kahf on Friday', () => {
    const out = computeContextualBoost('surah:18', { now: FRIDAY_2PM });
    expect(out.boost).toBeCloseTo(0.12);
    expect(out.signal).toBe('friday');
  });

  it('caps cumulative boost at 0.15', () => {
    // adhkar:27 happens to ALSO be morning on Friday: shouldn't exceed cap
    const fridayMorn = new Date(2026, 4, 15, 9, 0).getTime();
    const out = computeContextualBoost('adhkar:27', { now: fridayMorn });
    expect(out.boost).toBeLessThanOrEqual(0.15);
  });

  it('returns 0 when no contextual rule matches', () => {
    const out = computeContextualBoost('reciter:1', { now: MONDAY_9AM });
    expect(out.boost).toBe(0);
    expect(out.signal).toBeNull();
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- --runTestsByPath services/search/__tests__/contextualSignals.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement contextualSignals.ts**

The morning adhkar category id and evening adhkar category id are pulled from `data/adhkar.json`. The exploration noted `id: "27"` for "Words of remembrance for morning and evening". For Phase 1 hardcode the known category ids that are morning/evening. If the data file has separate morning and evening categories, capture both. If a single category covers both, boost it under whichever window matches.

```ts
// services/search/contextualSignals.ts
import type { Signal } from './types';

const MORNING_START = 5;
const MORNING_END = 12;
const EVENING_START = 18;
const EVENING_END = 21;

const MORNING_ADHKAR_IDS = new Set(['27']);     // "Words of remembrance for morning and evening" category
const EVENING_ADHKAR_IDS = new Set(['27']);
const FRIDAY_SURAH_IDS = new Set([18]);          // Al-Kahf

export interface ContextualOptions {
  now?: number;
}

export function computeContextualBoost(
  resultId: string,
  opts: ContextualOptions = {},
): { boost: number; signal: Signal | null } {
  const date = new Date(opts.now ?? Date.now());
  const hour = date.getHours();
  const isFriday = date.getDay() === 5;
  const isMorning = hour >= MORNING_START && hour < MORNING_END;
  const isEvening = hour >= EVENING_START && hour < EVENING_END;

  let boost = 0;
  let signal: Signal | null = null;

  if (resultId.startsWith('adhkar:')) {
    const id = resultId.slice('adhkar:'.length);
    if (isMorning && MORNING_ADHKAR_IDS.has(id)) {
      boost += 0.1;
      signal = 'morning';
    } else if (isEvening && EVENING_ADHKAR_IDS.has(id)) {
      boost += 0.1;
      signal = 'evening';
    }
  }

  if (resultId.startsWith('surah:')) {
    const id = Number(resultId.slice('surah:'.length));
    if (isFriday && FRIDAY_SURAH_IDS.has(id)) {
      boost += 0.12;
      if (!signal) signal = 'friday';
    }
  }

  return { boost: Math.min(0.15, boost), signal };
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `npm test -- --runTestsByPath services/search/__tests__/contextualSignals.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/search/contextualSignals.ts services/search/__tests__/contextualSignals.test.ts
git commit -m "feat(search): add clock-based contextual boost (morning, evening, Friday)"
```

---

## Task 14: Search orchestrator

**Files:**
- Create: `services/search/orchestrator.ts`
- Create: `services/search/__tests__/orchestrator.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// services/search/__tests__/orchestrator.test.ts
import { createOrchestrator } from '../orchestrator';
import { SURAHS } from '@/data/surahData';
import { REWAYAT_REGISTRY } from '@/data/rewayat';
import { loadAsma } from '../adapters/names';
import { loadAdhkarCategories } from '../adapters/adhkar';

const reciters = [
  { id: 1, name: 'Mishary Alafasy', arabic_name: 'مشاري العفاسي', style: 'murattal', rewayat: [] },
  { id: 2, name: 'AbdulRahman Sudais', arabic_name: 'عبد الرحمن السديس', style: 'murattal', rewayat: [] },
] as unknown as import('@/data/reciterData').Reciter[];

const personalCtx = {
  lovedReciterIds: new Set<number>(),
  lovedTrackIds: new Set<string>(),
  downloadedTrackIds: new Set<string>(),
  defaultReciterId: null,
  defaultRewayatId: null,
  recentResultIds: new Set<string>(),
};

const NEUTRAL_TIME = new Date(2026, 4, 11, 14, 0).getTime(); // Mon May 11 2026 14:00

const orch = createOrchestrator({
  reciters,
  surahs: SURAHS,
  rewayat: REWAYAT_REGISTRY,
  adhkarCategories: loadAdhkarCategories(),
  names: loadAsma(),
  playlists: [],
  personalCtxProvider: () => personalCtx,
});

describe('orchestrator', () => {
  it('returns empty results for empty query', () => {
    const res = orch.search({ query: '', now: NEUTRAL_TIME });
    expect(res.results).toEqual([]);
    expect(res.tabs).toEqual([]);
  });

  it('returns surah hit for "yasin"', () => {
    const res = orch.search({ query: 'yasin', now: NEUTRAL_TIME });
    const top = res.results[0];
    expect(top.type).toBe('surah');
    expect(top.id).toBe('surah:36');
  });

  it('produces a numeric_ref result for "2:255"', () => {
    const res = orch.search({ query: '2:255', now: NEUTRAL_TIME });
    expect(res.results.some((r) => r.type === 'numeric_ref')).toBe(true);
  });

  it('orders results by finalScore descending', () => {
    const res = orch.search({ query: 'al', now: NEUTRAL_TIME });
    for (let i = 1; i < res.results.length; i++) {
      expect(res.results[i - 1].features.finalScore).toBeGreaterThanOrEqual(
        res.results[i].features.finalScore,
      );
    }
  });

  it('builds dynamic tabs only for types present in results', () => {
    const res = orch.search({ query: 'hafs', now: NEUTRAL_TIME });
    const tabTypes = res.tabs.map((t) => t.type);
    expect(tabTypes[0]).toBe('all');
    expect(tabTypes).toContain('rewayat');
    expect(tabTypes).not.toContain('numeric_ref');
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- --runTestsByPath services/search/__tests__/orchestrator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement orchestrator.ts**

```ts
// services/search/orchestrator.ts
import type { Reciter } from '@/data/reciterData';
import type { Surah } from '@/data/surahData';
import type { Rewayat } from '@/data/rewayat';
import { buildReciterIndex, reciterToResult } from './adapters/reciter';
import { buildSurahIndex, surahToResult } from './adapters/surah';
import { buildRewayatIndex, rewayatToResult } from './adapters/rewayat';
import { buildAdhkarCategoryIndex, adhkarCategoryToResult, type AdhkarCategory } from './adapters/adhkar';
import { buildNamesIndex, nameToResult, type NameOfAllah } from './adapters/names';
import { buildPlaylistIndex, playlistToResult, type PlaylistSummary } from './adapters/playlist';
import { parseRef } from './refParser';
import { computePersonalBoost, type PersonalContext } from './personalSignals';
import { computeContextualBoost } from './contextualSignals';
import type {
  RankedResult,
  SearchRequest,
  SearchResponse,
  EntityType,
} from './types';

export interface OrchestratorDeps {
  reciters: Reciter[];
  surahs: Surah[];
  rewayat: Rewayat[];
  adhkarCategories: AdhkarCategory[];
  names: NameOfAllah[];
  playlists: PlaylistSummary[];
  personalCtxProvider: () => PersonalContext;
}

const TAB_LABELS: Record<EntityType | 'all', string> = {
  all: 'All',
  numeric_ref: 'Jump to',
  reciter: 'Reciters',
  surah: 'Surahs',
  rewayat: 'Rewayat',
  adhkar_category: 'Adhkar',
  name_of_allah: 'Names of Allah',
  playlist: 'Playlists',
};

const TAB_ORDER: Array<EntityType | 'all'> = [
  'all',
  'numeric_ref',
  'reciter',
  'surah',
  'rewayat',
  'adhkar_category',
  'name_of_allah',
  'playlist',
];

export function createOrchestrator(deps: OrchestratorDeps) {
  const recIdx = buildReciterIndex(deps.reciters);
  const surahIdx = buildSurahIndex(deps.surahs);
  const rewIdx = buildRewayatIndex(deps.rewayat);
  const adhkarIdx = buildAdhkarCategoryIndex(deps.adhkarCategories);
  const namesIdx = buildNamesIndex(deps.names);
  const playlistIdx = buildPlaylistIndex(deps.playlists);

  function search(req: SearchRequest): SearchResponse {
    const q = req.query.trim();
    if (!q) return { query: q, results: [], tabs: [] };

    const ctx = deps.personalCtxProvider();
    const now = req.now ?? Date.now();
    const accum: RankedResult[] = [];

    function pushWithBoosts<T>(
      hits: ReturnType<typeof recIdx.search>,
      byId: Map<string, T>,
      toResult: (item: T, features: RankedResult['features']) => RankedResult,
    ) {
      for (const h of hits) {
        const item = byId.get(h.id);
        if (!item) continue;
        const personal = computePersonalBoost(h.id, ctx);
        const contextual = computeContextualBoost(h.id, { now });
        const final = h.textualScore * (1 + personal.boost + contextual.boost);
        accum.push(
          toResult(item, {
            textualScore: h.textualScore,
            personalBoost: personal.boost,
            contextualBoost: contextual.boost,
            finalScore: final,
            tier: h.tier,
            matchedField: h.matchedField,
            matchedRange: h.matchedRange,
            signal: personal.signal ?? contextual.signal,
          }),
        );
      }
    }

    pushWithBoosts(recIdx.search(q), recIdx.byId, reciterToResult);
    pushWithBoosts(surahIdx.search(q), surahIdx.byId, surahToResult);
    pushWithBoosts(rewIdx.search(q), rewIdx.byId, rewayatToResult);
    pushWithBoosts(adhkarIdx.search(q), adhkarIdx.byId, adhkarCategoryToResult);
    pushWithBoosts(namesIdx.search(q), namesIdx.byId, nameToResult);
    pushWithBoosts(playlistIdx.search(q), playlistIdx.byId, playlistToResult);

    // Numeric refs: not indexed, derived per-query
    const refs = parseRef(q);
    for (const ref of refs) {
      const features = {
        textualScore: 1.0,
        personalBoost: 0,
        contextualBoost: 0,
        finalScore: 1.0,
        tier: 'exact' as const,
        matchedField: 'ref',
        matchedRange: null,
        signal: null,
      };
      accum.push({
        id: `ref:${JSON.stringify(ref)}`,
        type: 'numeric_ref',
        title: ref.label,
        subtitle:
          ref.kind === 'verse'
            ? 'Open in mushaf'
            : ref.kind === 'page'
            ? 'Open page in mushaf'
            : ref.kind === 'juz'
            ? 'Open juz in mushaf'
            : 'Open surah in mushaf',
        artwork: { kind: 'verse', label: ref.kind === 'verse' ? `${ref.surah}:${ref.ayah}` : String((ref as { page?: number; juz?: number; surah?: number }).page ?? (ref as { juz?: number }).juz ?? (ref as { surah?: number }).surah) },
        features,
        payload: { kind: 'numeric_ref', ref },
      });
    }

    accum.sort((a, b) => b.features.finalScore - a.features.finalScore);

    const counts = new Map<EntityType, number>();
    for (const r of accum) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
    const tabs = TAB_ORDER.flatMap((t) => {
      if (t === 'all') return [{ type: t, label: TAB_LABELS[t], count: accum.length }];
      const c = counts.get(t as EntityType) ?? 0;
      return c > 0 ? [{ type: t, label: TAB_LABELS[t], count: c }] : [];
    });

    return { query: q, results: accum, tabs };
  }

  return { search };
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `npm test -- --runTestsByPath services/search/__tests__/orchestrator.test.ts`
Expected: PASS.

- [ ] **Step 5: Snapshot test for a representative query set**

Add to the bottom of `orchestrator.test.ts`:

```ts
describe('orchestrator snapshots', () => {
  for (const q of ['yas', 'fatiha', 'hafs', '2:255', 'page 100', 'amma']) {
    it(`stable ranking for "${q}"`, () => {
      const res = orch.search({ query: q, now: NEUTRAL_TIME });
      const shape = res.results.slice(0, 5).map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        tier: r.features.tier,
      }));
      expect(shape).toMatchSnapshot();
    });
  }
});
```

Run: `npm test -- --runTestsByPath services/search/__tests__/orchestrator.test.ts`. The first run writes snapshots. Inspect them manually before committing to make sure they look reasonable (e.g., `yas` produces surah:36 at the top, `hafs` produces rewayat:hafs-an-assem near the top).

- [ ] **Step 6: Commit**

```bash
git add services/search/orchestrator.ts services/search/__tests__/orchestrator.test.ts services/search/__tests__/__snapshots__
git commit -m "feat(search): add orchestrator with multi-entity ranking and dynamic tabs"
```

---

## Task 15: Telemetry events

**Files:**
- Create: `services/search/telemetry.ts`

- [ ] **Step 1: Implement telemetry.ts**

```ts
// services/search/telemetry.ts
import { analyticsService } from '@/services/analytics/AnalyticsService';
import type { EntityType, Signal, Tier } from './types';

function hasArabic(s: string): boolean {
  return /[؀-ۿ]/.test(s);
}

function hasNumeric(s: string): boolean {
  return /\d/.test(s);
}

export function trackSearchQuery(query: string, tabActive: EntityType | 'all') {
  analyticsService.capture('search_query', {
    query_length: query.length,
    has_arabic: hasArabic(query),
    has_numeric: hasNumeric(query),
    tab_active: tabActive,
  });
}

export function trackResultTapped(args: {
  entityType: EntityType;
  position: number;
  score: number;
  tier: Tier;
  signal: Signal | null;
  queryLength: number;
  tabActive: EntityType | 'all';
}) {
  analyticsService.capture('search_result_tapped', {
    entity_type: args.entityType,
    position: args.position,
    score: args.score,
    tier: args.tier,
    signal: args.signal,
    query_length: args.queryLength,
    tab_active: args.tabActive,
  });
}

export function trackDismissed(hadResults: boolean, queryLength: number) {
  analyticsService.capture('search_dismissed', {
    had_results: hadResults,
    query_length: queryLength,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add services/search/telemetry.ts
git commit -m "feat(search): add PostHog telemetry events for v2 search"
```

---

## Task 16: SignalIcon UI component

**Files:**
- Create: `components/search/v2/SignalIcon.tsx`

- [ ] **Step 1: Implement SignalIcon.tsx**

```tsx
// components/search/v2/SignalIcon.tsx
import { Text, View, StyleSheet } from 'react-native';
import type { Signal } from '@/services/search/types';

const GLYPH: Record<Signal, string> = {
  loved: '♥',
  recent: '⏱',
  default: '★',
  morning: '☀',
  evening: '☾',
  friday: 'F',
};

export function SignalIcon({ signal }: { signal: Signal | null }) {
  if (!signal) return null;
  return (
    <View accessibilityLabel={signal} style={styles.box}>
      <Text style={styles.glyph}>{GLYPH[signal]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginLeft: 6, opacity: 0.75 },
  glyph: { color: '#d4af37', fontSize: 12, fontWeight: '600' },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/search/v2/SignalIcon.tsx
git commit -m "feat(search): add SignalIcon component"
```

---

## Task 17: TabBar UI component

**Files:**
- Create: `components/search/v2/TabBar.tsx`

- [ ] **Step 1: Implement TabBar.tsx**

```tsx
// components/search/v2/TabBar.tsx
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EntityType } from '@/services/search/types';

export interface Tab {
  type: EntityType | 'all';
  label: string;
  count: number;
}

interface Props {
  tabs: Tab[];
  active: EntityType | 'all';
  onChange: (t: EntityType | 'all') => void;
}

export function TabBar({ tabs, active, onChange }: Props) {
  if (tabs.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {tabs.map((t) => {
        const isActive = t.type === active;
        return (
          <Pressable
            key={t.type}
            onPress={() => onChange(t.type)}
            style={[styles.chip, isActive && styles.chipActive]}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>{t.label}</Text>
            {t.count > 0 && t.type !== 'all' && (
              <View style={styles.countBox}>
                <Text style={styles.countText}>{t.count}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#141414',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipActive: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
  label: { color: '#8e8e93', fontSize: 12, fontWeight: '600' },
  labelActive: { color: '#0a0a0a' },
  countBox: { backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  countText: { fontSize: 10, color: '#0a0a0a', fontWeight: '700' },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/search/v2/TabBar.tsx
git commit -m "feat(search): add TabBar component"
```

---

## Task 18: RankedResultRow UI component

**Files:**
- Create: `components/search/v2/RankedResultRow.tsx`

- [ ] **Step 1: Implement RankedResultRow.tsx**

```tsx
// components/search/v2/RankedResultRow.tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RankedResult } from '@/services/search/types';
import { SignalIcon } from './SignalIcon';

interface Props {
  result: RankedResult;
  onPress: (r: RankedResult) => void;
}

export function RankedResultRow({ result, onPress }: Props) {
  return (
    <Pressable onPress={() => onPress(result)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      {result.artwork && (
        <View style={[styles.art, styles[`art_${result.artwork.kind}` as const]]}>
          <Text style={styles.artText}>{result.artwork.label}</Text>
        </View>
      )}
      <View style={styles.meta}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {result.title}
          </Text>
          <SignalIcon signal={result.features.signal} />
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {result.subtitle}
        </Text>
        {result.arabicPreview && (
          <Text style={styles.arabic} numberOfLines={1}>
            {result.arabicPreview}
          </Text>
        )}
      </View>
      {result.badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{result.badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  art: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1c1c1e' },
  art_reciter: { borderRadius: 22 },
  art_surah: {},
  art_rewayat: {},
  art_adhkar: {},
  art_name: {},
  art_playlist: {},
  art_verse: {},
  artText: { color: '#d4af37', fontWeight: '700', fontSize: 14 },
  meta: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { color: '#f5f5f7', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  subtitle: { color: '#8e8e93', fontSize: 12, marginTop: 2 },
  arabic: { color: '#cbb87a', fontSize: 14, marginTop: 4, textAlign: 'right' },
  badge: { backgroundColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  badgeText: { color: '#8e8e93', fontSize: 10, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/search/v2/RankedResultRow.tsx
git commit -m "feat(search): add RankedResultRow component"
```

---

## Task 19: SearchViewV2

**Files:**
- Create: `components/search/v2/SearchViewV2.tsx`

- [ ] **Step 1: Implement SearchViewV2.tsx**

```tsx
// components/search/v2/SearchViewV2.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { useLovedStore } from '@/services/player/store/lovedStore';
import { useFavoriteRecitersStore } from '@/store/favoriteRecitersStore';
import { useReciterStore } from '@/store/reciterStore';
import { getAllReciters } from '@/services/dataService';
import { SURAHS } from '@/data/surahData';
import { REWAYAT_REGISTRY } from '@/data/rewayat';
import { loadAdhkarCategories } from '@/services/search/adapters/adhkar';
import { loadAsma } from '@/services/search/adapters/names';
import { createOrchestrator } from '@/services/search/orchestrator';
import type {
  EntityType,
  RankedResult,
  SearchResponse,
} from '@/services/search/types';
import type { PersonalContext } from '@/services/search/personalSignals';
import { trackDismissed, trackResultTapped, trackSearchQuery } from '@/services/search/telemetry';
import { TabBar } from './TabBar';
import { RankedResultRow } from './RankedResultRow';

interface Props {
  query: string;
  isSearchActive: boolean;
  onResultPress: (r: RankedResult) => void;
}

const DEBOUNCE_MS = 200;

export function SearchViewV2({ query, isSearchActive, onResultPress }: Props) {
  const [reciters, setReciters] = useState<Awaited<ReturnType<typeof getAllReciters>>>([]);
  useEffect(() => {
    getAllReciters().then(setReciters);
  }, []);

  const favoriteReciterIds = useFavoriteRecitersStore((s) => new Set(s.favoriteReciters));
  const lovedReciterIds = useLovedStore((s) => {
    const set = new Set<number>();
    for (const t of s.lovedTracks ?? []) set.add(t.reciterId);
    return set;
  });
  const defaultReciter = useReciterStore((s) => s.defaultReciter);

  const personalCtxProvider = useCallback((): PersonalContext => ({
    lovedReciterIds: new Set([...favoriteReciterIds, ...lovedReciterIds]),
    lovedTrackIds: new Set<string>(),
    downloadedTrackIds: new Set<string>(),
    defaultReciterId: defaultReciter?.id ?? null,
    defaultRewayatId: null,
    recentResultIds: new Set<string>(),
  }), [favoriteReciterIds, lovedReciterIds, defaultReciter?.id]);

  const orchestrator = useMemo(
    () =>
      createOrchestrator({
        reciters,
        surahs: SURAHS,
        rewayat: REWAYAT_REGISTRY,
        adhkarCategories: loadAdhkarCategories(),
        names: loadAsma(),
        playlists: [],
        personalCtxProvider,
      }),
    [reciters, personalCtxProvider],
  );

  const [response, setResponse] = useState<SearchResponse>({ query: '', results: [], tabs: [] });
  const [activeTab, setActiveTab] = useState<EntityType | 'all'>('all');
  const [computing, setComputing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!query.trim()) {
      setResponse({ query: '', results: [], tabs: [] });
      return;
    }
    setComputing(true);
    timer.current = setTimeout(() => {
      const res = orchestrator.search({ query });
      setResponse(res);
      setActiveTab((cur) => (res.tabs.some((t) => t.type === cur) ? cur : 'all'));
      setComputing(false);
      trackSearchQuery(query, activeTab);
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, orchestrator]);

  useEffect(() => {
    return () => {
      if (!isSearchActive && query) {
        trackDismissed(response.results.length > 0, query.length);
      }
    };
  }, [isSearchActive, query, response.results.length]);

  const visible = useMemo(() => {
    if (activeTab === 'all') return response.results;
    return response.results.filter((r) => r.type === activeTab);
  }, [activeTab, response.results]);

  const handlePress = useCallback(
    (r: RankedResult) => {
      const position = visible.findIndex((x) => x.id === r.id);
      trackResultTapped({
        entityType: r.type,
        position,
        score: r.features.finalScore,
        tier: r.features.tier,
        signal: r.features.signal,
        queryLength: query.length,
        tabActive: activeTab,
      });
      onResultPress(r);
    },
    [visible, query.length, activeTab, onResultPress],
  );

  if (!query.trim()) return null;

  return (
    <View style={styles.container}>
      <TabBar tabs={response.tabs} active={activeTab} onChange={setActiveTab} />
      {computing && (
        <View style={styles.loading}>
          <ActivityIndicator color="#d4af37" />
        </View>
      )}
      <FlatList
        data={visible}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <RankedResultRow result={item} onPress={handlePress} />}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { paddingVertical: 6, alignItems: 'center' },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/search/v2/SearchViewV2.tsx
git commit -m "feat(search): add SearchViewV2 wiring orchestrator + tabs + telemetry"
```

---

## Task 20: Feature-flag gate on (b.search)/index.tsx

**Files:**
- Modify: `app/(tabs)/(b.search)/index.tsx`

- [ ] **Step 1: Read the current file**

Open `app/(tabs)/(b.search)/index.tsx` and locate the `<SearchView />` render. Note the props it receives (`onClose`, `visible`, `query`, `isSearchActive`, `skipTopInset?`).

- [ ] **Step 2: Replace the render with a flag-gated branch**

```tsx
// app/(tabs)/(b.search)/index.tsx (only the relevant render shown)
import { SearchView } from '@/components/search/SearchView';
import { SearchViewV2 } from '@/components/search/v2/SearchViewV2';
import { useFeatureFlag } from '@/utils/featureFlags';
import { useRouter } from 'expo-router';
// ...existing imports

export default function SearchTabScreen() {
  const flagOn = useFeatureFlag('search.v2', false);
  const router = useRouter();
  // existing query/isSearchActive state

  if (flagOn) {
    return (
      <SearchViewV2
        query={query}
        isSearchActive={isSearchActive}
        onResultPress={(r) => {
          switch (r.payload.kind) {
            case 'reciter':
              router.push(`/reciter/${r.payload.reciter.id}`);
              return;
            case 'surah':
              router.push(`/surah/${r.payload.surah.id}`);
              return;
            case 'rewayat':
              router.push(`/rewayat/${r.payload.rewayat.id}`);
              return;
            case 'adhkar_category':
              router.push(`/adhkar/${r.payload.categoryId}`);
              return;
            case 'name_of_allah':
              router.push(`/names/${r.payload.index}`);
              return;
            case 'playlist':
              router.push(`/playlist/${r.payload.playlistId}`);
              return;
            case 'numeric_ref': {
              const ref = r.payload.ref;
              const params =
                ref.kind === 'verse'
                  ? { surah: ref.surah, ayah: ref.ayah }
                  : ref.kind === 'page'
                  ? { page: ref.page }
                  : ref.kind === 'juz'
                  ? { juz: ref.juz }
                  : { surah: ref.surah };
              router.push({ pathname: '/mushaf', params });
              return;
            }
          }
        }}
      />
    );
  }

  return (
    <SearchView
      query={query}
      isSearchActive={isSearchActive}
      onClose={() => router.back()}
      visible
    />
  );
}
```

The implementer must open `components/search/SearchView.tsx`, find each navigation branch (reciter tap, surah tap, recent tap, etc.), and replicate them inside the `onResultPress` callback above using the corresponding `RankedResult.payload.kind` discriminant.

- [ ] **Step 3: Manual smoke test, flag OFF**

In PostHog, ensure `search.v2` is off for your user. Launch the app, navigate to search, confirm the existing v1 search renders unchanged.

- [ ] **Step 4: Manual smoke test, flag ON**

Turn on `search.v2` for your user in PostHog. Reload the app. Type `yasin`, `hafs`, `2:255`, `morning`, `mishary` and confirm the new tabbed list renders, tabs appear/disappear based on results, and tapping each result type navigates to the right place.

- [ ] **Step 5: Run typecheck and prettier**

Run: `npx tsc --noEmit`
Expected: zero errors.

Run: `npx prettier --write components/search/v2 services/search app/(tabs)/(b.search)/index.tsx`
Expected: formatted in place.

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/\(b.search\)/index.tsx
git commit -m "feat(search): gate v1/v2 search by search.v2 PostHog flag"
```

---

## Task 21: Integration test the full pipeline

**Files:**
- Create: `services/search/__tests__/integration.test.ts`

- [ ] **Step 1: Write the integration test**

```ts
// services/search/__tests__/integration.test.ts
import { createOrchestrator } from '../orchestrator';
import { SURAHS } from '@/data/surahData';
import { REWAYAT_REGISTRY } from '@/data/rewayat';
import { loadAdhkarCategories } from '../adapters/adhkar';
import { loadAsma } from '../adapters/names';
import type { Reciter } from '@/data/reciterData';

const reciters: Reciter[] = [
  { id: 1, name: 'Mishary Alafasy', arabic_name: 'مشاري العفاسي', style: 'murattal', rewayat: [] },
  { id: 2, name: 'Yasser Ad-Dossari', arabic_name: 'ياسر الدوسري', style: 'murattal', rewayat: [] },
  { id: 3, name: 'Sudais', arabic_name: 'السديس', style: 'murattal', rewayat: [] },
] as unknown as Reciter[];

function make(ctxOverride: Partial<import('../personalSignals').PersonalContext> = {}) {
  const base = {
    lovedReciterIds: new Set<number>(),
    lovedTrackIds: new Set<string>(),
    downloadedTrackIds: new Set<string>(),
    defaultReciterId: null,
    defaultRewayatId: null,
    recentResultIds: new Set<string>(),
  };
  return createOrchestrator({
    reciters,
    surahs: SURAHS,
    rewayat: REWAYAT_REGISTRY,
    adhkarCategories: loadAdhkarCategories(),
    names: loadAsma(),
    playlists: [],
    personalCtxProvider: () => ({ ...base, ...ctxOverride }),
  });
}

const T = new Date(2026, 4, 11, 14, 0).getTime(); // Mon afternoon, no contextual boost

describe('integration: personal signal flips ordering', () => {
  it('puts loved reciter above an equally-textual cold match', () => {
    const cold = make();
    const warm = make({ lovedReciterIds: new Set([3]) }); // Sudais loved

    // pick a query both reciters match by prefix
    const qCold = cold.search({ query: 's', now: T });
    const qWarm = warm.search({ query: 's', now: T });

    const coldOrder = qCold.results.filter((r) => r.type === 'reciter').map((r) => r.id);
    const warmOrder = qWarm.results.filter((r) => r.type === 'reciter').map((r) => r.id);
    expect(coldOrder).not.toEqual(warmOrder);
    expect(warmOrder[0]).toBe('reciter:3');
  });
});

describe('integration: contextual signal nudges Friday', () => {
  it('puts Al-Kahf higher on Friday for a query that matches multiple surahs', () => {
    const friday = new Date(2026, 4, 15, 14, 0).getTime();
    const orch = make();
    const a = orch.search({ query: 'al', now: T }).results.findIndex((r) => r.id === 'surah:18');
    const b = orch.search({ query: 'al', now: friday }).results.findIndex((r) => r.id === 'surah:18');
    expect(b).toBeLessThanOrEqual(a);
  });
});
```

- [ ] **Step 2: Run and confirm pass**

Run: `npm test -- --runTestsByPath services/search/__tests__/integration.test.ts`
Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: zero failures across the project. If unrelated tests are flaky, isolate before assuming Phase 1 broke them.

- [ ] **Step 4: Commit**

```bash
git add services/search/__tests__/integration.test.ts
git commit -m "test(search): integration tests for personal and contextual ranking"
```

---

## Task 22: Final QA pass and PR

- [ ] **Step 1: Manual end-to-end QA on physical device**

Build to a physical iOS device with Hermes. Confirm:
- Flag OFF: search unchanged from prior behavior.
- Flag ON: typing latency feels responsive (debounce 200ms is barely perceptible). Tabs appear/disappear correctly. Tapping each result type navigates correctly. Loved reciter shows the ♥ signal icon when matched. Friday morning shows a `☀`/`F` icon on Al-Kahf if it surfaces.

- [ ] **Step 2: Run typecheck + prettier on full diff**

Run: `npx tsc --noEmit`
Expected: zero errors.

Run: `npx prettier --write $(git diff --name-only origin/develop...HEAD | grep -E '\.(ts|tsx|json)$')`
Expected: clean.

- [ ] **Step 3: Push branch and open PR**

```bash
git push -u origin feat/search-revamp
gh pr create --base develop --title "feat(search): Phase 1 - unified tabbed search foundation" --body "$(cat <<'EOF'
## Summary
- Adds a new tabbed search experience under `components/search/v2/`, gated by PostHog flag `search.v2`.
- Foundational engine (`services/search/`) covering reciters, surahs, rewayat, adhkar categories, names of Allah, playlists, and numeric refs.
- Tiered textual matcher with Arabic normalization and transliteration alias map, with Fuse v7 as a fuzzy fallback.
- Personal signal layer (loved, default reciter, recents) and clock-based contextual layer (morning, evening, Friday).
- Telemetry events laid in for future ranking tuning.

## Out of scope (later phases)
- Verse-by-text search (Phase 2)
- Track synthesis + play history (Phase 3)
- Adhkar individual-item search, prayer-time / Hijri-aware context, recents type migration (Phase 4)

## Test plan
- [ ] All unit and integration tests pass (`npm test`).
- [ ] Manual QA on iOS device with flag OFF: existing search unchanged.
- [ ] Manual QA on iOS device with flag ON: tab bar, dynamic tabs, signal icons, debounce feel responsive.
- [ ] `npx tsc --noEmit` clean.

Spec: docs/superpowers/specs/2026-05-14-search-revamp-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review checklist

After this plan is written, verify:

1. **Spec coverage:** every entity in the spec (reciters, surahs, rewayat, adhkar categories, names, playlists, numeric refs) has a task. Verses/tracks/dhikr items are explicitly out of scope and documented as later phases. Ranking formula, Arabic normalization, alias map, personal signals, contextual signals (clock-based subset), telemetry events, Layout C UI, and feature flag are all covered.
2. **Placeholder scan:** Task 20 step 2 explicitly defers the per-type navigation mapping to the implementer rather than inlining it because that requires reading existing call sites verbatim. Mark this clearly so reviewers know the engineer must complete it before committing the task.
3. **Type consistency:** `RankedResult`, `RankingFeatures`, `PersonalContext`, `EntityHit`, and `NumericRef` are defined in Task 1 and used consistently in all later tasks. Adapter `byId` maps use the same id format (`reciter:1`, `surah:36`, etc.). Tier names (`exact`, `prefix`, `whole_word`, `fuzzy`) are consistent across normalize, entityIndex, and types.
