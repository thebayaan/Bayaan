# Search Revamp Design

Date: 2026-05-14
Status: Draft, pending user review
Surfaces touched: `app/(tabs)/(b.search)/index.tsx`, `components/search/SearchView.tsx`, and supporting `services/search/*` (new)

## Overview

Revamp the main bottom-tab search to feel like Spotify (multi-entity discovery, personalized ranking, fast cross-type results) and quran.com (verse-by-text search, smart numeric navigation, transliteration tolerance). The new search unifies seven previously absent or buried entity types under a single ranking pipeline, a single tabbed UI, and a single set of personal signals.

`MushafSearchView` (in-reader) and `CollectionSearchModal` (in collection) are out of scope and stay as-is.

## Goals

1. Spotify-quality discovery: typing two characters surfaces the right thing across reciters, surahs, tracks, rewayat, adhkar, verses, names of Allah, playlists, and numeric refs.
2. Personalization that visibly responds to user behavior (loved, downloaded, recent plays) without ever needing a server round trip.
3. Verse-by-text search ("mercy", "no compulsion in religion") on-device, sub-100ms.
4. Arabic-aware matching: tashkeel-insensitive, alef variants folded, transliteration aliases recognized.
5. Telemetry foundation that lets us learn from real usage and tune later.

## Non-goals

1. Replacing `MushafSearchView` or `CollectionSearchModal`. They keep their narrower jobs.
2. Tafseer search. Deferred to a later phase once tafseer data is bundled (per ongoing translations and tafaseer plan).
3. Voice search.
4. Server-side popularity priors. Cold-start ranking is honest about being cold; personalization grows from local signals only.
5. Cross-device sync of personal signals. All personalization stays local.

## Searchable entities

Nine entity types feed one unified `RankedResult` stream.

| # | Entity | Data source | Key fields indexed |
|---|---|---|---|
| 1 | Reciters | API + bundled fallback (existing) | `name`, `arabic_name`, `translated_name`, `style`, `description`, `aliases` |
| 2 | Surahs | `data/surahData.ts` (114 rows) | `english_name`, `arabic_name`, `transliteration`, `revelation_type`, `number`, transliteration aliases |
| 3 | Tracks (surah-by-reciter) | Synthesized at query time | Composite of `reciter.name + surah.english_name` and Arabic counterpart |
| 4 | Rewayat | `data/rewayat.ts` (30 rows) | `displayName`, `name`, `description`, `teacher`, `student`, `aliases` |
| 5 | Adhkar categories | `data/adhkar.json` (~30 rows) | `title`, `broad_tags` |
| 6 | Adhkar items (individual dhikr) | nested inside `adhkar.json` | Arabic text, transliteration, English meaning, parent category title |
| 7 | Verses by text | New SQLite FTS5 index built from `Uthmani` + active translation | normalized Arabic, translation text, `surah:ayah` ref |
| 8 | Names of Allah (99) | New data file `data/asma.json` | `arabic`, `transliteration`, `meaning_en`, ordinal index |
| 9 | Playlists | existing collection store | `name`, item count, derived item names for deep matches |
| 10 | Numeric refs (virtual) | parser, not indexed | parsed at query time: `N:M`, `page N`, `juz N`, plain N |

Tafseer is excluded from scope.

## Ranking model

One formula across all entities:

```
finalScore = textualScore * (1 + personalBoost + contextualBoost)
```

### Textual score (0..1)

Tiered matcher, applied per field, max across fields used as the textual score for the candidate:

| Tier | Trigger | Score |
|---|---|---|
| Exact | normalized equality | 1.00 |
| Token prefix | any token in field starts with the query | 0.85 |
| Whole-word substring | query appears as a whole token | 0.70 |
| Fuzzy | Fuse v7 edit-distance match, threshold 0.4 | 0.40..0.60 |

Field weights are applied as a final multiplier on the field's tier score:

- Reciter: `name` 2.0, `arabic_name` 2.0, `translated_name` 1.5, `aliases` 1.5, `description` 0.7, `style` 0.5
- Surah: `english_name` 2.0, `arabic_name` 2.0, `transliteration` 1.8, `aliases` 1.8, `number` 1.0
- Rewayat: `displayName` 2.0, `name` 1.8, `aliases` 1.5, `description` 0.7
- Adhkar category: `title` 2.0, `broad_tags` 1.0
- Adhkar item: English meaning 2.0, Arabic 1.8, transliteration 1.5, parent category 0.5
- Verses: Arabic match 2.0, translation match 1.6
- Names: `arabic` 2.0, `transliteration` 1.8, `meaning_en` 1.6

The weighted tier score is then clamped to 1.0 before entering the multiplicative ranking formula.

### Multi-token queries

For queries with two or more tokens, every token must hit something. The candidate's textual score is the geometric mean of the per-token best scores. Tracks fall out of this naturally: a query like `mishary yasin` produces a high-scoring track candidate because both tokens hit (reciter name token, surah token).

### Personal boost (0..1)

Additive contributions, each independent, capped at 1.0 cumulatively:

| Signal | Boost | Source |
|---|---|---|
| Loved (favorite reciter, loved track) | +0.20 | existing loved store |
| Downloaded | +0.20 | existing download store |
| Played in last 7 days | +0.30 | new `playHistory` log |
| Plays in last 30 days, log-scaled | up to +0.40 | new `playHistory` log; `min(0.40, 0.1 * log2(1 + plays))` |
| Tapped recently from search | +0.30 | existing `recentSearches` store, expanded |
| Default reciter or default rewayat | +0.20 | mushaf settings store |

All personal data stays on device. Nothing is uploaded.

### Contextual boost (0..0.15, hard cap)

Additive, never large enough to flip the top result:

| Signal | Window | Boost target | Boost |
|---|---|---|---|
| Morning | Fajr to Dhuhr | category id 27 ("Morning"), Surah Al-Mulk | +0.10 |
| Evening | Maghrib to Isha | category "Evening", Surah Al-Mulk | +0.10 |
| Friday | all day Friday (Hijri-aware) | Surah Al-Kahf, surahs commonly recited Friday | +0.12 |
| Ramadan | Hijri month 9 | Juz/page refs, "Iftar" adhkar | +0.10 |

Sum capped at 0.15. Prayer times pulled from existing prayer-time service.

### Cold-start behavior

With personal and contextual boosts at zero, the formula collapses to `finalScore = textualScore`. Users with no history see a pure textual ranking. This is intentional. There are no baked-in global priors.

## Engine architecture

```
                ┌──────────────────────────────────────────┐
                │              Search UI                   │
                │   Layout C: dynamic tab bar + flat list  │
                └────────────────┬─────────────────────────┘
                                 │ debounced 200ms
                ┌────────────────▼─────────────────────────┐
                │         SearchOrchestrator               │
                │   parse intent, fan out, rank, slice     │
                └────┬────────────┬──────────────┬─────────┘
                     │            │              │
        ┌────────────▼┐  ┌────────▼────────┐ ┌───▼─────────┐
        │ EntityIndex │  │ VerseIndex      │ │ RefParser   │
        │ (tiered +   │  │ (SQLite FTS5,   │ │ (N:M, page, │
        │  Fuse v7    │  │  bundled)       │ │  juz, plain)│
        │  fallback)  │  └─────────────────┘ └─────────────┘
        └─────────────┘
                     │
        ┌────────────▼──────────────────────────┐
        │       PersonalSignalStore             │
        │  loved | downloads | playHistory |    │
        │  default reciter/rewayat | recents    │
        └───────────────────────────────────────┘
```

### Modules (new)

All under `services/search/`.

| File | Responsibility |
|---|---|
| `normalize.ts` | Arabic + Latin text normalization. Strip tashkeel, fold ا/أ/إ/آ → ا, ى → ي, ة → ه, lowercase Latin, strip diacritics. Applied to both index and query. |
| `aliases.ts` | Hand-curated transliteration alias map (YAML loaded at build, frozen object at runtime). Examples: `surah_36: [yasin, yaseen, yāsīn, yaa-seen, ياسين, يس]`. |
| `entityIndex.ts` | Build inverted token map keyed by normalized tokens. Field-aware. Holds Fuse v7 instance for fuzzy fallback. Exposes `search(query, opts)`. |
| `verseIndex.ts` | SQLite FTS5 wrapper. Opens `assets/search/verses.db` on first call. Falls back to a rebuild against the current translation if the bundled translation does not match the user's active translation. |
| `refParser.ts` | Extracted from `MushafSearchView`. Pure function `parseRef(query) -> NumericRef[]`. Reused there too (small refactor). |
| `personalSignals.ts` | Aggregator. Reads from existing stores plus the new `playHistory`. Returns `PersonalBoost(candidate)` synchronously when possible. |
| `contextualSignals.ts` | Reads prayer times + Hijri date, returns `ContextualBoost(candidate)`. |
| `playHistoryStore.ts` | MMKV-backed rolling log. Schema below. Pruned on write. |
| `orchestrator.ts` | Top-level. Parses intent, fans out to indices, applies boosts, sorts, dedupes, slices into tabs. |
| `types.ts` | `RankedResult`, `EntityType`, `Signal`, `RankingFeatures`. |

### EntityIndex internals

For each entity row, tokenize each indexed field with the normalizer, populate `Map<token, Set<{ candidateId, field, fieldWeight }>>`. Lookup steps:

1. Tokenize the normalized query.
2. For each token, gather candidates whose field tokens exact-match or start-with the query token. Track tier per candidate.
3. Add Fuse v7 results for tokens that had no exact/prefix/substring hit, mark them as fuzzy tier.
4. Compute per-candidate textual score using the tier table and field weights.
5. Return candidates with textual score above a floor (default 0.2).

Build time: O(rows * fields * tokens). For ~1,300 rows this is sub-50ms cold. Lookup time: linear in unique candidates per token, typically under 10ms.

### VerseIndex schema

FTS5 virtual table:

```sql
CREATE VIRTUAL TABLE verses USING fts5(
  surah,        -- INTEGER, unindexed
  ayah,         -- INTEGER, unindexed
  arabic_norm,  -- normalized Arabic, indexed
  translation,  -- active translation text, indexed
  tokenize = 'unicode61 remove_diacritics 2'
);
```

Bundled `verses.db` built offline against Saheeh International (already pre-bundled, per memory). Rebuild triggered when active translation changes (one-time, runs in a worker, ~5s on physical iPhone).

### RefParser semantics

Returns at most three `NumericRef` candidates per query. Each has a target type (`verse`, `page`, `juz`, `surah`) and a label. Already partly implemented in `MushafSearchView`; extracting to a shared module is part of phase 1.

## Personal signal storage

One new store: `playHistoryStore`.

```ts
type PlayEvent = {
  trackId: string;       // `${reciterId}:${surahId}`
  reciterId: string;
  surahId: number;
  playedAt: number;      // epoch ms
};

// Stored as a single MMKV key holding a JSON array.
// Capped at 500 events or 60 days, whichever bound is hit first.
// Pruned on every write.
```

Write side: hook into the existing playback "started" event already wired up for PostHog (per memory the source field is always `'queue'`; not used here). Only the local store is updated.

Read side: `personalSignals.ts` reads the log on orchestrator init, builds an in-memory aggregate `{ trackId -> { last7: n, last30: n } }`. Invalidated and recomputed on each new play event. Cheap because the log is bounded.

All other personal signals come from existing stores. Nothing else new.

## UX

### Layout

Layout C: dynamic tab filter bar over a flat ranked list.

- Default tab `All`: flat list ordered by `finalScore` descending. No section headers, no hero.
- Type tabs appear in this order, only when at least one result exists for that type: `Jump to`, `Verses`, `Tracks`, `Reciters`, `Surahs`, `Rewayat`, `Adhkar`, `Names of Allah`, `Playlists`.
- Picking a type tab filters the flat list to that type. Order preserved.
- Tab bar is horizontally scrollable. The active tab is gold (`#d4af37`).

### Row anatomy

```
[artwork] [title]  [signal icon]            [badge]  [▶ play if applicable]
          [subtitle]
          [arabic preview if verse]
```

- Title and subtitle are normalized text with the matched substring highlighted (subtle gold underline, not a fill, to keep readable).
- Signal icon appears between title and badge, picked by priority: ♥ loved > ⏱ recent > ⭐ default > ☀ morning context > 🌙 evening context. One icon per row.
- Badge is type-specific: duration for tracks, "Hafs" style chip for reciters, etc.
- Play button only on tracks.

### Empty state (no query)

Unchanged from today: `Recent searches` chips followed by `ExploreView` bento grid.

`recentSearches` is migrated to support all new entity types (currently only `surah` and `reciter`). Old entries remain readable.

### Loading state

Debounce 200ms. While computing, render a thin line shimmer at the top of the result list. Verse FTS5 lookup is the slowest leg (around 30ms on device); everything else is single-digit ms.

### Highlight rendering

Normalized matching, displayed text is the original (with diacritics). Highlights are derived by mapping normalized-index ranges back to the original string using a tiny offset map kept per indexed field.

## Telemetry

Three new PostHog events:

| Event | Properties |
|---|---|
| `search_query` | `query_length`, `has_arabic`, `has_numeric`, `tab_active` |
| `search_result_tapped` | `entity_type`, `position`, `score`, `signal`, `query_length`, `tab_active` |
| `search_dismissed` | `had_results`, `query_length` |

No raw query strings. No PII. Lays groundwork for future learned popularity priors if we change our minds on global ranking.

## Phasing

Each phase ships independently behind a feature flag `search.v2` (PostHog).

1. **Phase 1, foundation.** `normalize.ts`, `aliases.ts`, `entityIndex.ts`, `refParser.ts` extraction, `personalSignals.ts` (loved + downloads + recents + defaults; no playHistory yet), `contextualSignals.ts`, `orchestrator.ts`. Layout C UI. Wires reciters, surahs, rewayat, adhkar (categories only), names of Allah, numeric refs, playlists. Ships without tracks, without individual dhikr items, without verses.
2. **Phase 2, verse search.** Build script for `verses.db`. SQLite FTS5 wiring via `verseIndex.ts`. Translation-change rebuild. New `Verses` tab. Highlighting in verse rows.
3. **Phase 3, tracks and play history.** `playHistoryStore.ts`. Hook into playback events. Personal boost factoring plays-in-7d and plays-in-30d. Track synthesis in the orchestrator. New `Tracks` tab.
4. **Phase 4, adhkar items and polish.** Individual dhikr indexing. Contextual signals tuning. Telemetry events. Recents UX migration to include new types.

Each phase is mergeable and shippable on its own.

## Testing

| Layer | Approach |
|---|---|
| Normalizer, alias map | Unit tests with table-driven fixtures (Arabic with and without tashkeel, alef variants, transliteration variants). |
| Tiered matcher | Unit tests on `EntityIndex.search`. Cover each tier explicitly. |
| Ref parser | Unit tests for `N:M`, `page N`, `juz N`, plain N, alias forms (`amma`, `tabarak`). |
| Ranking formula | Unit tests with handcrafted candidates and fixed personal/contextual inputs. Assert ordering. |
| Orchestrator | Snapshot tests: `query -> [ids in order]`. Fixture: the six chips from the mockup, plus three typo variants and three Arabic-script queries. |
| Verse FTS5 | Integration test with a small fixture DB. Asserts ordering and highlight ranges. |
| Personal signals | Integration test with seeded `playHistory` of varying recency. Asserts that loved + downloaded + recent-played track outranks an equally-textual cold match. |
| Performance | Manual physical-device pass on iPhone with Hermes. Target: under 100ms from keystroke to rendered list at 200ms debounce. |

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| FTS5 index size bloats the bundle | Saheeh translation is small; build script outputs ~3MB. Confirm in phase 2. If too large, build at first launch instead. |
| Arabic normalization edge cases | Comprehensive fixture file populated with real user queries from the future telemetry. Until then, populated with known forms from `surahData.ts`. |
| Personal boost lets one-time taps dominate | Log scaling on 30-day plays plus the 7-day boost being capped at +0.30 keeps a single play from pinning a candidate to the top. |
| Feature flag state during phased rollout | `search.v2` flag wraps the entire new `SearchView`; off state renders the existing component unchanged. Easy rollback. |
| Contextual signals confusing users ("why is this here?") | Hard cap of 0.15. The contextual signal icon (☀/🌙) on the row makes the reason visible. |

## Open questions

None at design time. Specific weight values and the floor threshold are tunable through telemetry post-launch; the design encodes defaults that can be revisited without rewrites.
