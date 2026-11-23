# Search guidelines

**Status:** Standard (proposed 2026-11-23). Audit verified against the redesign branch of PR #555 at `490d54f3`, compared with `develop` at `29f387a4`.

Bayaan has more than a dozen places where you can type to find something. They do not all have to look or work the same: a verse picker is not the Search tab. But they must feel like one app. This doc sets the shared foundation (how text is matched, how a field behaves, how it looks) and says where a surface may differ and why.

Rules use **MUST**, **SHOULD** and **MAY**, as in [ipad-standards.md](ipad-standards.md). A MUST rule is a review blocker.

---

## 1. Where things stand

### 1.1 Every search surface

| # | Surface | File | Matching | Timing | Field | Entry |
|---|---|---|---|---|---|---|
| 1 | Search tab | `components/search/SearchView.tsx`, `app/(tabs)/(b.search)/index.tsx` | `createCatalogSearch` (ranker) + Quran text and roots (`useQuranSearch`) + keyboard-layout swap | 300 ms debounce | iOS glass: native `Stack.SearchBar`. Android: hand-built `TextInput` row | Always visible |
| 2 | Browse all surahs | `components/browse/BrowseSurahs.tsx` | `rankSurahs` | Every keystroke | iOS glass: `Stack.SearchBar`. Android: `SearchInput` | Always visible |
| 3 | Browse reciters | `components/browse/BrowseReciters.tsx` | `rankReciters` + filter chips | Every keystroke | `SearchInput` | Always visible |
| 4 | Surahs tab *(new in #555)* | `components/SurahsView.tsx` | **`matchesQuery` (substring)** | Every keystroke | `CollectionSearchField` | Header search button |
| 5 | Collection home *(new in #555)* | `app/(tabs)/(c.collection)/index.tsx`, `CollectionSearchResults.tsx` | **`matchesQuery`** + `matchesVerseRef` | `useDeferredValue` | `CollectionSearchField` | Header search button |
| 6 | Collection screens ×7 *(new in #555)*: bookmarks, notes, loved, downloads, playlists, uploads | `app/(tabs)/(c.collection)/collection/*.tsx` | **`matchesQuery`** (+ `matchesVerseRef` on bookmarks, notes) | Every keystroke | `CollectionSearchField` | Header search button |
| 7 | Collection › favourite reciters | `collection/favorite-reciters.tsx` | `rankReciters` | Every keystroke | `CollectionSearchField` | Header search button |
| 8 | Reciter page | `components/reciter-profile/ReciterProfile.tsx`, `components/SearchView/index.tsx` | `rankSurahs(query, available)` | Every keystroke | `SearchInput` in a full-screen overlay | Header search button |
| 9 | Mushaf search | `components/mushaf/MushafSearchView.tsx` | Own command parser (page, juz, `2:255`) + `rankSurahs` + `useQuranSearch` | 300 ms commands, 250 ms Quran text | `SearchInput` | Reader toolbar, autofocus |
| 10 | Verse / range picker | `components/sheets/mushaf-player/VersePicker.tsx` | `parseRangeQuery` (ranges, page, juz, "kursi") | Every keystroke | Raw `TextInput`, Ionicons | Always visible in sheet |
| 11 | Settings › default reciter | `app/(tabs)/(d.settings)/default-reciter.tsx` | `rankReciters` | Every keystroke | `SearchInput` | Always visible |
| 12 | Reciter picker sheets | `components/reciter-picker/ReciterPickerSheet.tsx` | `createSearchIndex` (own fields) | `useDeferredValue` | `SearchInput` | Always visible |
| 13 | Organise upload sheet (surah, reciter) | `components/sheets/OrganizeRecitationSheet.tsx` | `searchSurahs` → `rankSurahs`; `rankReciters` + `createSearchIndex` for custom reciters | Every keystroke | Raw `TextInput` ×2 | Inline form field |

Dead code: `components/SearchBar.tsx` is not imported anywhere.

### 1.2 What is already good

The October search overhaul (`docs/superpowers/plans/2026-10-12-search-overhaul.md`) built one engine in `utils/search/`, and most of `develop` uses it:

- **One normaliser.** `toSearchKey` folds Arabic letter variants (أ إ آ ٱ → ا, ى → ي, ة → ه), strips harakat, Quranic marks and tatweel, maps Arabic-Indic digits, strips Latin accents and punctuation.
- **One ranker.** `createSearchIndex` scores by tier: exact › prefix › word prefix › substring › compact (`alkahf`) › consonant skeleton (`husary` = `hussary` = `hosary`) › typo (Damerau-Levenshtein, 1 edit from 4 letters, 2 from 7).
- **Transliteration help.** Articles (`al`, `an`, `ash`…), filler words (`sheikh`, `qari`), long vowels (`noor` → `nur`), surah aliases and spellings, and a wrong-keyboard swap (`lklhf` typed on an Arabic layout).
- **Golden tests** for the engine and the Quran text search.

### 1.3 Where it breaks

**F1. PR #555 brings back the substring matcher.** The new Surahs tab and all Collection searches use `utils/collectionSearch.ts#matchesQuery`, a plain "every word is a substring" test. It skips the ranker, so the typo, skeleton and alias work from October does not reach them. Run against the real surah list and a reciter fixture:

| Query | Ranker (Browse surahs, reciter page, Search tab) | `matchesQuery` (Surahs tab, Collection) |
|---|---|---|
| `yaseen` | Ya-Sin | nothing |
| `bqara` | Al-Baqarah | nothing |
| `fatihha` | Al-Fatihah | nothing |
| `noor` | An-Nur | nothing |
| `surah 36` | Ya-Sin | nothing |
| `husary` | Al-Hussary | nothing |
| `mishari` | Alafasy | nothing |
| `afasi` | Alafasy | nothing |
| `abdul basit` | AbdulBaset AbdulSamad | nothing |
| `minshawy`, `ghamidi`, `shuraym` | found | nothing |
| `sheikh sudais` | Al-Sudais | nothing |

It also does not rank. The Surahs tab lists hits in the user's sort order, so `an` shows Ali 'Imran first, and Collection reciters are matched differently from the Favourite reciters screen one tap away (#7 uses the ranker).

**F2. Verse references work in some places only.** `2:255` works in Mushaf search (#9), the verse picker (#10) and Collection bookmarks and notes (#5, #6). It finds nothing in the Search tab (#1), where people are most likely to type it. Two parsers exist: the Mushaf one knows `page N`, `juz N`, `amma`, `N:M`; `parseRangeQuery` also knows ranges (`2:255-257`), `p 42`, `kursi`. `matchesVerseRef` is a third, prefix-only one (`2:25` matches `2:255`).

**F3. Five field components.** Native `Stack.SearchBar`; a hand-built Android row in the Search tab; `SearchInput` (Feather `x` to clear, custom `SearchIcon`); `CollectionSearchField` (Feather `x-circle`, Feather `search`, local text, result count); raw `TextInput`s with Ionicons in the verse picker and organise sheet. Heights, fills, radii, icons and clear glyphs differ, which is most of what makes screens feel "from different apps".

**F4. Three ways to start searching.** Always-visible field (Search tab, browse, settings, pickers); a header search button that turns the header into a field with Cancel (Collection, Surahs tab); a header search button that opens a full-screen overlay with the reciter's name over the field (reciter page). The reciter page and the Surahs tab show the same kind of list (surahs) and enter search differently.

**F5. Timing differs.** 300 ms debounce (Search tab, Mushaf), 250 ms (Mushaf Quran text), `useDeferredValue` (Collection home, reciter picker), and synchronous filtering everywhere else.

**F6. Empty and no-results states differ.** "No results found" + "Try different keywords" (Search tab); "Nothing matches “{query}”" (Collection); "No surahs found" (reciter page); "No reciters found" (settings); "No verses match. Try 2:255, mulk 1-10…" (verse picker); an empty list with no message (Browse surahs, Browse reciters, organise sheet). Only the verse picker teaches what you can type.

**F7. Recents are split.** The Search tab keeps 10 tapped results under `recentSearches`; Mushaf keeps its own 10 under `mushaf-search-history`; the reciter picker shows recent reciters. Nothing else remembers.

**F8. Keyboard handling differs.** Dismiss on drag exists on the Search tab, Mushaf, Collection, Browse reciters, settings and reciter page, but Browse surahs and the Surahs tab set no dismiss-on-drag of their own. Cancel clears and closes on header-button surfaces; always-visible fields only clear.

**F9. Sort vs relevance.** While searching, Browse surahs, the reciter page and the Search tab rank by relevance. The Surahs tab and Collection keep the screen's sort order.

---

## 2. The standard

### 2.1 Matching

- **S1 (MUST)** Every surface that matches surahs or reciters uses `rankSurahs` / `rankReciters` (pass `within` for a subset). Nothing else matches those entities.
- **S2 (MUST)** Any other list (playlists, notes, uploads, downloads, adhkar) matches through `createSearchIndex` with named fields and weights. Do not write `includes`, `toLowerCase().includes`, `matchesQuery` or a regex filter for user search.
- **S3 (MUST)** All text goes through `toSearchKey`. Display strings may use `normalizeSearchText`; never fold for display.
- **S4 (MUST)** While a query is active, results are in relevance order. The screen's sort applies only to the unfiltered list.
- **S5 (MUST)** A query that looks like a Quran reference (`2:255`, `2:255-257`, `page 42`, `juz 30`, `amma`, `kursi`, Arabic-Indic digits) is parsed by one shared parser and offered wherever verses, pages or juz can be opened: Search tab, Mushaf search, verse picker, bookmarks and notes.
- **S6 (SHOULD)** When a query finds nothing, try the keyboard-layout swap and `allowOneMissingWord` before showing no results.

### 2.2 Behaviour

- **B1 (MUST)** Local lists filter synchronously or with `useDeferredValue`. Async work (Quran text, roots, network) debounces at **250 ms**, one constant.
- **B2 (MUST)** The field keeps its own text (as `CollectionSearchField` does) so the cursor never jumps under a slow screen.
- **B3 (MUST)** `autoCorrect={false}`, `autoCapitalize="none"`, `returnKeyType="search"`, and the keyboard appearance follows the theme.
- **B4 (MUST)** Scrolling results dismisses the keyboard (`keyboardDismissMode="on-drag"`, or `blur()` on the native bar). Taps on results work with the keyboard up (`keyboardShouldPersistTaps="handled"`).
- **B5 (MUST)** Clear (×) empties the text and keeps focus. Cancel empties, blurs and leaves search mode. Fields that are always visible have no Cancel.
- **B6 (MUST)** Trim the query; a blank query shows the unfiltered list (or the surface's idle content), never "no results".
- **B7 (SHOULD)** Recents live in one store keyed by surface (`search:home`, `search:mushaf`), max 10, saved when a result is opened, not on every keystroke.

### 2.3 Look and entry

- **U1 (MUST)** One field component, `SearchField`, used everywhere except the native bar. Same height, fill, radius, `SearchIcon`, and the same clear glyph.
- **U2 (MUST)** Pick the entry by context:

  | Context | Entry | Example |
  |---|---|---|
  | Search is the screen's purpose | Always-visible field. iOS glass uses the native `Stack.SearchBar` | Search tab, Browse surahs/reciters, pickers, default reciter |
  | Search narrows a list that has its own header and actions | Header search button; the header becomes `SearchField` with Cancel, list stays in place | Collection, Surahs tab, **reciter page** |
  | Search is a mode inside a reader or sheet | Inline field, autofocus on open | Mushaf search, verse picker |

- **U3 (MUST)** Idle, no-recents and no-results use one `SearchEmptyState` (the ghost-row panel style of `CollectionEmptyPanel`). No-results reads "Nothing matches “{query}”" plus a context hint that shows what this field understands (for example "Try a surah, reciter or 2:255").
- **U4 (SHOULD)** When filtering a known list, show a count under the field ("3 of 24 bookmarks").
- **U5 (SHOULD)** A search that returns more than one kind of thing groups results into inset panels with a sentence-case header and a "See all N" row (as `CollectionSearchResults` does), with scope pills (All + one per group) under the field from first focus. Pills use one `SearchScopePills` component: text-colour fill when on.
- **U5b (MAY)** Attribute filter chips (Browse reciters: teacher, student, rewayah) combine with the query (AND) and stay visible while typing.
- **U6 (MUST)** Placeholders say what is searched: "Search surahs", "Search reciters", "Search bookmarks". The Search tab may say "Surahs, reciters, verses".

### 2.4 What may differ, per surface

| Surface | Quran text and roots | References | Recents | Pills | Count |
|---|---|---|---|---|---|
| Search tab | Yes | Yes | Yes | Scope | No |
| Mushaf search | Yes | Yes | Yes | No | No |
| Verse picker | No | Yes (ranges) | No | No | No |
| Collection home | No | Yes | No | Scope | Per section |
| Collection screens | No | Bookmarks, notes | No | No | Yes |
| Surahs tab, reciter page, Browse surahs | No | Surah number | No | No | No |
| Reciter lists and pickers | No | No | Picker only | Attribute chips on Browse | No |

---

## 3. How to maintain it

A recommendation for one follow-up refactor PR. Nothing here is built yet.

### 3.1 Shared code

```
utils/search/
  normalize.ts, fuzzy.ts, createSearchIndex.ts, catalog.ts   (exist)
  filterList.ts      rankList(items, query, fields): T[] on createSearchIndex,
                     memoised per items array; replaces collectionSearch.ts
  references.ts      parseQuranReference(query): one parser for 2:255, ranges,
                     page, juz, named verses; Mushaf, verse picker, Search tab
                     and Collection all call it
  constants.ts       SEARCH_DEBOUNCE_MS = 250, MAX_RECENTS = 10
hooks/
  useListSearch.ts   {query, setQuery, results, isSearching, clear}
                     for any local list (deferred, trimmed, relevance order)
  useRecentSearches.ts(surfaceKey)
components/search/
  SearchField.tsx        one field (grown from CollectionSearchField)
  SearchEmptyState.tsx   idle hint, no recents, no-results + hint (ghost-row panel)
  SearchScopePills.tsx   All + one pill per result group (from CollectionSearchResults)
  SearchResultGroup.tsx  inset panel, header, "See all N" row
```

`SearchInput`, `components/SearchBar.tsx`, `utils/collectionSearch.ts`, the Search tab's Android row and the raw `TextInput`s go away.

### 3.2 Tests

- **Cross-surface contract test.** One table of queries (`yaseen`, `bqara`, `noor`, `husary`, `afasi`, `abdul basit`, `المومنون`, `36`, `surah 36`, `2:255`) and the expected first hit. Run it through every matcher a surface uses. A new surface adds one line. This would have caught F1.
- **Reference parser golden test** covering everything the verse picker hint promises.
- **`SearchField` behaviour test:** clear keeps focus, Cancel blurs and clears, fast typing keeps cursor.
- **Lint guard.** An ESLint `no-restricted-syntax` rule (or a CI grep) that fails on `.toLowerCase().includes(` and on `TextInput` with `returnKeyType="search"` outside `components/search/`.

### 3.3 Review checklist for a PR that adds or changes a search

- [ ] Matching goes through `rankSurahs`, `rankReciters`, `rankList` or `createSearchIndex`.
- [ ] The surface is in the table in §1.1 and its row in §2.4 is right.
- [ ] Uses `SearchField` (or the native bar where §2.3 allows it).
- [ ] Entry pattern matches §2.3 U2.
- [ ] No-results uses `SearchEmptyState` with a hint for this context.
- [ ] Keyboard dismisses on drag; Clear and Cancel behave per B5.
- [ ] The contract test has a line for this surface.
