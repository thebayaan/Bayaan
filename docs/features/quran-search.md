# Quran Word Search

> Search the Arabic text of the Quran by word, phrase or root, in the Search tab and in the mushaf search.

**Status:** v1 implemented on `wip/search`. Device verification (plan task 03 T12: profiling on a mid-range Android and an iPad, VoiceOver, Dynamic Type, screenshots) is still to do.
**Plan:** [docs/plans/2026-11-14-word-study/03-word-search.md](../plans/2026-11-14-word-study/03-word-search.md). Where it differs, the plan's [README](../plans/2026-11-14-word-study/README.md) decisions win.

---

## What it does

- **Words and phrases.** Type or paste Arabic: `الصلاة`, `ذلك الكتاب`, `يا أيها الذين آمنوا`, or a pasted Uthmani verse with its marks. Diacritics, tatweel, presentation forms and bidi marks do not matter, and everyday (imla'i) spellings find the Uthmani words (`الصلاة` finds ٱلصَّلَوٰةَ, `ابراهيم` finds إِبْرَٰهِـۧمَ).
- **Roots.** `root:رحم`, `جذر: ر ح م` or spaced letters `ر ح م` list every word of the root, grouped by lemma. A one-word query of 3-4 letters also suggests the roots it may spell ("Root ر ح م"); tapping the suggestion runs the root query.
- **Where:**
  - **Search tab.** An Ayahs section after the surah and reciter results. On iPad, an Ayahs scope chip with its count, an Ayahs section in All (4 ayahs and See all), and the Ayahs scope in a 680pt reading column.
  - **Mushaf search.** Ayah rows after the page, juz and verse commands, labelled in the rewayah on screen.
  - **Word view.** `RootResults` (`{root, initialLemma?, onVersePress}`) is the root screen the word view embeds (wired by the word-view track).
- **Opening a result.** The mushaf opens on the page of the first matched word, selects the verse holding it (in the rewayah on screen) and flashes the matched words for 3 seconds. The Search tab remembers the opened ayah in its recent searches; the mushaf search adds a history entry like a typed `2:255`.

### v1 decisions (plan README)

- **Hafs spellings only.** The results are the Hafs text, also when another rewayah is on screen (the results then say "Searched in the Hafs text"). The posting flag for other rewayat's spellings stays reserved.
- **Ranking:** relevance tiers, then mushaf order.
- **Matching:** the "all words in one ayah" fallback is on; the last word matches as a prefix from 3 letters; no typo tolerance and no Latin (transliterated) verse search.
- **Recents** store the opened verse, not the query.
- **Root counts** are word counts (see [Roots](#roots)).
- **No imla'i input in v1.** Every everyday spelling comes from the Uthmani text by rule. The build keeps an `--imlaei` seam for a later text.

---

## Module map

| Layer | Files |
|---|---|
| Spelling rules (index and query) | `utils/search/quranText.ts`, shared letter folds in `utils/search/normalize.ts` |
| Index format | `utils/search/quranIndexFormat.ts` (posting codes, base-36 deltas, verse indexes), `utils/quranWordPositions.ts` (Digital Khatt slot vs QUL word position) |
| Engine (pure) | `utils/search/quranSearch.ts` (`searchQuranText`, `matchedPositions`) |
| Build | `scripts/search/quranSearchIndex.ts` (pure builder and gates), `scripts/search/build-quran-search-db.ts` (CLI) |
| Asset | `assets/data/quran-search-v1.db` |
| Data service | `services/search/QuranSearchDataService.ts` (expo-sqlite, lazy) |
| Hooks | `hooks/useQuranSearch.ts` (`useQuranSearch`, `useQuranRootSearch`, `isQuranQuery`, `prefetchQuranSearch`) |
| Rows | `components/search/quran/` (`quranResultRows.ts` row model, `QuranResultRowView`, `VerseHitRow`, `RootLemmaChips`, `RootResults`, `RecentVerseRow`), `utils/search/verseSnippet.ts` |
| Surfaces | `components/search/SearchView.tsx`, `components/search/TabletSearchResults.tsx`, `app/(tabs)/(b.search)/index.tsx`, `components/mushaf/MushafSearchView.tsx`, `components/mushaf/mushafSearchVerses.ts` (`hitTarget`, `hitLabel`) |
| Word flash | `store/mushafWordFlashStore.ts`, `components/mushaf/skia/useWordFlashHighlights.ts`, `app/mushaf.tsx` (`words` param), `utils/quranLink.ts` (`quranHitLinkParams`), `DigitalKhattDataService.getPageForWord` |
| Strings | `reader:quranSearch.*`, `reader:search.placeholder` / `emptySubtitle`, `home:search.placeholder` |

---

## Spelling rules

The index holds, for every Hafs Digital Khatt word slot, the spellings a reader may type, all folded to one alphabet. The query side applies the same folds, so a typed or pasted word gives the key of one of them. `QURAN_TEXT_NORMALIZER_VERSION` (in `quranText.ts`, stored in the index `meta`) must be bumped, and the index rebuilt, whenever a rule changes; the freshness test fails otherwise.

### Index side (per slot)

1. Verse markers (`۝١`) are skipped. A slot with a space (37:130:3, إِلْ يَاسِينَ) stays one word.
2. **Prepare:** delete the maddah U+0653 before NFC (in Uthmani it is a madd sign; NFC would turn ا + maddah into a hamza آ), apply NFC (composes the decomposed hamza), delete ۞, ۩ and the grapheme joiner, write a final ىٰ as ى (عَلَىٰ → على), and restore the second lam of ٱلَّيْل, ٱلَّٰتِى / ٱلَّٰٓـِٔى and ٱلَّذَانِ / ٱلَّذَيْنِ (الليل, اللاتي, اللذان).
3. **Spellings** (all folded):
   - **imla'i:** the vocative يا written in full (يَٰقَوْمِ → ياقوم); ىٰ before a suffix as alif (هَدَىٰهُمْ → هداهم, ٱلتَّوْرَىٰةَ → التوراة); a bare waw before a dagger alif as alif (ٱلصَّلَوٰةَ → الصلاة, ٱلرِّبَوٰا۟ → الربا); every other dagger alif as alif; the small yeh ۧ as yeh (إِبْرَٰهِـۧمَ → ابراهيم); the small high noon as noon (نُـۨجِى → ننجي); a small waw or yeh spelled out except after the pronoun ه (يُحْيِۦ → يحيي, دَاوُۥدَ → داوود, but بِهِۦ → به); a yeh marked silent dropped (أَفَإِي۟ن → أفإن).
   - **imla'i alternates** for word-dependent conventions, kept beside the main spelling: a silent final alif kept by plural verbs and dropped elsewhere (قَالُوا۟ → قالوا; يَدْعُوا۟ → يدعو, أُو۟لُوا۟ → أولو); a silent alif inside a word dropped (مِا۟ئَةَ → مئة); a final hamza on waw with a silent alif read as أ or ء (يَبْدَؤُا۟ → يبدأ, جَزَٰٓؤُا۟ → جزاء); a final hamza and alif as hamza and alif maqsura (رَءَا → رأى); the plural waw after a hamza with its alif (جَآءُو → جاءوا); the imperative of سأل after ف or و with its alif (فَسْـَٔلْ → فاسأل).
   - **rasm:** the letters as drawn, small letters dropped (هَٰذَا → هذا, ٱلصَّلَوٰةَ → الصلوه).
   - **mixed:** for words with 2-3 dagger alifs, every other combination (ٱلسَّمَٰوَٰتِ → السموات and السماوت besides السماوات).
   - A spelling that comes only from the rasm or mixed rules is flagged `rasmOnly`.
4. **Fold** like the catalogue keys (`normalize.ts`): marks removed (harakat, shadda, sukun, U+0610-061A, U+06D6-06ED, open tanween U+08F0-08F3 and U+08D3-08FF, tatweel), ٱ أ إ آ → ا, ى ی → ي, ک → ك, ة → ه, ؤ → و, ئ → ي, ء dropped, spaces removed. The output alphabet is ا-غ and ف-ي without ة, ى or any hamza letter; a build gate checks it for every word of all 8 words DBs.
5. **Hamza flag:** set when the word holds ء, أ, إ, ؤ, ئ or a hamza sign.
6. **Without proclitics (tier 2):** the proclitics come from the i'rab segmentation (entries of kind `p`: و ف ب ل ك أ س يا ها ت), never from guessing, so وَجْهَ never gives جه. They are stripped from the Uthmani word in order, giving one spelling per prefix length (وَبِٱلْءَاخِرَةِ → بالاخره, الاخره). After a final ل the article alif comes back for definite words (لِلنَّاسِ → الناس, لِلَّهِ → الله). يا and ها are only stripped with their alif (هَلُمَّ is not ها + لُمَّ).
7. **Without the article (tier 1):** only for words the i'rab data calls `معرفة بأل` (never الله or the relative pronouns), and only when 2 letters remain (الرحمن → رحمن).
8. **Open taa:** a word drawn with ت whose lemma is spelled with ة elsewhere (رَحْمَتَ, ٱمْرَأَتُ) also gets the ة spelling (رحمة, امرأة).
9. Each slot keeps only its best tier per form.

### Query side

1. Delete U+0653, NFKC, Arabic-Indic and Persian digits to ASCII, bidi and zero-width characters removed, lowercase. An end-of-ayah sign with its number and ornate verse numbers are removed (pasted verses).
2. **Not a Quran query:** any digit, or no Arabic letter. So `2:255`, `صفحة 5`, `juz 30` and reciter names keep their old behaviour.
3. **Roots:** `root:` or `جذر:` (any UI language), or 3-4 spaced single letters that spell a known root. 2-5 single letters that are not a root join into one word (`ح م` finds 40:1, `ك ه ي ع ص` finds 19:1).
4. Split into words. A standalone يا or ها typed without a hamza, and إل, join the next word (يا أيها → ياايها, إل ياسين). آل and ال do not (آل فرعون is two words in the mushaf too).
5. Each word is prepared and folded with the imla'i rules, so pasted Uthmani gives its imla'i key.
6. **Hamza seats:** ؤ and ئ anywhere, and أ / إ after a word's first letter, are also tried without their seat letter (مسؤولا → مسوولا, مسولا; يسألونك → يسالونك, يسلونك), as the Uthmani text often writes that hamza on the line or on a tatweel. At most 2 seats, so at most 4 keys per word.
7. **Hamza requirement:** a word typed with a hamza only matches words with the hamza flag (ماء finds 59 ayahs, not every ما).
8. Caps: 24 words and 200 letters (marks are not counted, so a pasted verse is never cut inside a word).

### Scoring and order

- **Lookups:** one `SELECT ... WHERE form IN (...)` for every key of every word; the last word, from 3 letters, also gets a prefix range lookup (`form > key AND form < key + U+FFFF`, at most 4,000 forms). Postings are cached in a 64-entry LRU.
- **Word score:** exact 100 or prefix 60, plus tier × 10, minus 5 for `rasmOnly`.
- **Phrase:** consecutive slots inside one ayah, joined from the rarest word's slots by binary search. The phrase score is the lowest of its words; an ayah scores its best occurrence.
- **Fallback:** a query of 2 or more words with no phrase hit returns the ayahs holding every word, closest span first, with the note "No ayah has these words in this order. These ayahs have all of them:".
- **Order:** score descending, then mushaf order. The header shows ayahs and matches ("56 ayahs · 57 matches").

### Roots

- **Candidates** (`rootCandidates`): أ إ آ ء → ء; ا → ء, و or ي; ؤ → ء or و; ئ → ء or ي; ى → ي or و. Only the 1,642 roots of the index are kept (held in memory).
- **Lemmas:** chips show "All forms", each lemma with its word count, and "Other forms" for rooted words without a lemma; a chip filters the ayahs and the highlights.
- **Counts are word counts.** They equal the i'rab data's stated `وروده في القرآن` counts for every root except ء م م: the index has 118 words, the word view's morphology says 119. 20:94 يَبْنَؤُمَّ holds two stems in one word and is indexed under its main stem only. The build allowlists this one difference (`ROOT_COUNT_EXCEPTIONS`).

---

## The index asset

`assets/data/quran-search-v1.db`, 1,687,552 bytes, SQLite (no FTS5; text postings rather than BLOBs, so expo-sqlite, better-sqlite3 and node:sqlite read it alike).

| Table | Content |
|---|---|
| `meta` | `format`=1, `normalizer`=1, `dk_sha256`, `irab_sha256`, `content_sha256`, counts (`verses` 6,236, `words` 77,432, `forms` 21,140, `postings` 123,682, `roots` 1,642, `lemmas` 4,659), `complete`='1' written last |
| `forms` | `form` (folded spelling) → `postings` (base-36, first code absolute then deltas, comma-separated) |
| `roots` | `id`, `root` (exactly the i'rab الجذر text, `ر ح م`), `words`, `ayahs` |
| `lemmas` | `id`, `root_id`, `lemma` (the i'rab الأصل المعجمي text, NULL for words without one), `words`, `ayahs`, `postings` |

**Posting code:** `slot = verseIndex * 256 + position` (verse index 0..6235 in mushaf order, Digital Khatt slot 1..128), `code = slot * 32 + flags`. Flags: bits 0-1 tier (3 full, 2 without proclitics, 1 without the article), bit 2 hamza, bit 3 rasm only, bit 4 reserved (another rewayah's spelling, 0 in v1). Morphology attaches to the first Digital Khatt slot of a QUL word; the two differ only where «بعد ما» is drawn as two slots (2:181, 8:6, 13:37, `utils/quranWordPositions.ts`).

**Sources:** `data/mushaf/digitalkhatt/digital-khatt-v2.db` (Hafs words, sha256 `071c0f43...82a6`) and `assets/data/irab-v1.db` (QUL morphology from the Quranic Arabic Corpus, sha256 `0da1caf0...66c9`). Licences: Digital Khatt (OFL) and the Quranic Arabic Corpus (GPL, already shipped in irab-v1.db); see the "Quran word search index" section of `THIRD_PARTY_LICENSES.md`.

### Rebuild

```sh
npx tsx scripts/search/build-quran-search-db.ts            # write the DB (about 11 s)
npx tsx scripts/search/build-quran-search-db.ts --check    # verify the committed DB
npx tsx scripts/search/build-quran-search-db.ts --imlaei words.tsv --out x.db
```

Rebuild after any change to `quranText.ts`, `quranIndexFormat.ts`, the Digital Khatt Hafs words or irab-v1.db. `services/search/__tests__/quranSearchDb.test.ts` rebuilds the index in memory and fails, naming the command, when the committed file is stale.

**Build gates** (the script fails on any): exactly 6,236 verses and 77,432 words outside the markers, in `verseKeyAt` order; Digital Khatt and QUL word counts equal except at the three «بعد ما» slots; every word yields a spelling inside the alphabet (also for the 7 other words DBs); every i'rab row maps to a slot and every root count matches its stated count (except ء م م); every golden query passes (`utils/search/__fixtures__/quranSearchGolden.ts`, about 100 queries plus root rows); every verse is found by pasting its first 12 or fewer words.

**Runtime:** the data service copies the asset into the documents folder on first use and opens it; a copy whose `meta` lacks `complete='1'` (a kill during the copy) is deleted and copied again. `prefetchQuranSearch()` starts this when the Search tab or the mushaf search enters search mode.

### Seams

- **Imla'i text (`--imlaei <tsv>`):** one line per slot, `s:a:w<TAB>word`. Each word is folded with the query rules and added as an extra tier-3 spelling (not `rasmOnly`). Nothing changes at runtime or in the schema; a rebuilt file would ship as `quran-search-v2.db`. The text fed in needs its own licence check (as the rasm source in the word-study plan) and a `THIRD_PARTY_LICENSES.md` entry. v1 ships without it.
- **Other rewayat:** flag bit 4 is reserved for spellings from the other 7 words DBs (the slots are shared). Hits would then be labelled with that rewayah. Not built.

---

## Budgets and measurements

| Item | Budget | Measured |
|---|---|---|
| Asset | ≤ 2 MB | 1.69 MB (21,140 forms, 123,682 postings) |
| Build | ≤ 30 s | about 11 s (Node 22), also run in Jest by the freshness test |
| Query (SQL + join), ≤ 8 words | ≤ 50 ms p95 | Node (V8): 2,902 random pasted 1-4 word phrases, average 0.21 ms, max 4.5 ms; stress queries (الله, short prefixes) ≤ 1.4 ms. Hermes is expected 3-6x slower |
| First search (copy + open + roots) | ≤ 300 ms on a mid-range Android | not measured yet (T12) |
| First 10 rows painted | ≤ 150 ms | not measured yet (T12) |
| JS memory | ≤ 3 MB | roots map plus a 64-entry postings LRU; not profiled yet (T12) |
| Paging | 30 rows | 30 rows, "Show N more" adds 30 |

### QA

Measured against the KFGQPC imla'i text of the whole Quran (a local check, not committed; nothing derived from it is in the index):

- Single words typed in imla'i spelling: 99.86% found (99.01% before the word-dependent conventions above were added).
- The first 12 words of every verse typed in imla'i spelling: 98.57% of verses found as a phrase (96.33% before).
- Pasted Uthmani: every verse is found by its first 12 words (a build gate), and 2,902 random 1-4 word phrases were found with 0 misses.

### Known misses

Typed spellings that differ from the drawn word in a way no general rule covers. v1 does not find these ayahs (checked on the bundled index):

- Final alif versus alif maqsura, both ways: أقصى (28:20, drawn أَقْصَا), الأقصى (17:1), لدى (12:25, لَدَا), تترى (23:44, تَتْرَا), طغى (69:11, طَغَا); العلا (20:4, ٱلْعُلَى), الزنا (17:32, ٱلزِّنَىٰٓ), زكا (24:21, زَكَىٰ), يحيا (8:42, يَحْيَىٰ).
- يحيي and نحيي where the second yeh is not drawn (36:78, 36:12: يُحْىِ, نُحْىِ).
- Word-specific spellings: وملئه (7:103, وَمَلَإِي۟هِۦ), سأريكم (7:145, سَأُو۟رِيكُمْ), الأيكة at 26:176 (لْـَٔيْكَةِ; found at 15:78 and 50:14), بالوادي (20:12, بِٱلْوَادِ), عتوا (25:21, وَعَتَوْ), بأيكم (68:6, بِأَييِّكُمُ), بسطة and يبسط where the mushaf writes ص (7:69, 2:245), جمالات / جمالة (77:33, جِمَٰلَتٌ), ليسوءوا (17:7, لِيَسُۥٓـُٔوا۟).
- An open taa whose lemma is never written with ة elsewhere: معصية (58:8, وَمَعْصِيَتِ), فطرة (30:30, فِطْرَتَ).
- A pronoun suffix on a word that is not the last of the phrase: prefix matching applies to the last word only.

The plan's earlier list (داوود, الموءودة, لأذبحنه, مئة, بأيد) is found by the rules above.

---

## Surfaces

### Search tab (`SearchView`)

- The Quran search runs beside the catalogue on the same 300 ms debounced query, only for Quran queries. Latin queries behave as before; if a Latin query finds nothing in the catalogue and its keys spell Arabic on the Arabic keyboard layout (`swapKeyboardLayout`), the Quran search runs on those letters.
- Root queries skip the catalogue. The list is the catalogue rows, then the Ayahs rows: header with counts (and the Hafs or all-words note), root suggestions, 30 ayahs, "Show N more"; in root mode the root header, lemma chips and ayahs.
- The full empty state shows only when both searches are empty; for Arabic queries its hint reads "Try fewer words or another spelling".
- Tapping an ayah stores a `{type: 'verse', verseKey, positions, timestamp}` recent search (a book icon and "Al-Baqarah 2:255") and pushes `/mushaf` with `quranHitLinkParams`: `{surah, ayah, page, anchor: 'S:A:W', words: '3,4'}`.
- A root suggestion replaces the query: `index.tsx` sets its state and, on iOS 26, the native search bar text (`searchBarRef.setText`). The native bar may not report text set from code, which is why the state is set directly; check on device.
- iPad: the tablet results show when there are catalogue or Quran rows; root mode keeps the capped list in the 720pt column.

### Mushaf search (`MushafSearchView`)

- The page, juz, verse and surah commands stay instant. The Quran search waits for a 250 ms pause and never runs for a command (digits); a Quran query shows "Searching the Quran…" until its first results.
- Rows are labelled in the rewayah on screen (`hitTarget`, `hitLabel`): the Hafs verse, or the verse holding the first matched word ("Quraysh 106:5 · Warsh"); while that rewayah's verses load, the Hafs verse saying so ("Quraysh 106:4 · Hafs").
- A tap flashes the matched words, adds a history entry like a typed `N:M` (a Hafs verse, or the anchor and the rewayah), and opens the verse on the page of its first matched word. While the verses load it opens that page.

### Word flash

`useMushafWordFlashStore.show(verseKey, positions)` flashes Hafs slots for 3 s; `useWordFlashHighlights` bands them, in the recitation word colour, on the Digital Khatt pages that hold the verse (chained after the recitation highlights in `SkiaPage` and `ContinuousMushafView`; other pages keep their highlights object and do not re-render). Slots are shared by all 8 Digital Khatt texts, so the flash works in every rewayah; a blank slot paints nothing. Mushaf 1440 (QCF) and the list and reading views get the 3-second verse selection only.

`DigitalKhattDataService.getPageForWord(verseKey, position)` looks the slot itself up from the verse's first page (at most 3 pages). In the 15-line layout every page ends at the end of a verse, so it equals the verse's page for all 83,668 slots (checked by a test); the lookup keeps working for a layout where a verse runs on.

---

## Tests

| Area | Tests |
|---|---|
| Spelling rules, folds | `utils/search/__tests__/quranText.test.ts`, `normalize.test.ts` |
| Index format, positions | `utils/search/__tests__/quranIndexFormat.test.ts`, `utils/__tests__/quranWordPositions.test.ts` |
| Engine | `utils/search/__tests__/quranSearch.test.ts` (synthetic postings), `quranSearch.golden.test.ts` (bundled DB: golden queries, every verse by its first 12 words) |
| Asset freshness and gates | `services/search/__tests__/quranSearchDb.test.ts` |
| Data service | `services/search/__tests__/QuranSearchDataService.test.ts` |
| Hook, rows, components | `hooks/__tests__/useQuranSearch.test.tsx`, `components/search/quran/__tests__/*`, `utils/search/__tests__/verseSnippet.test.ts` |
| Surfaces | `components/search/__tests__/SearchView.quran.test.tsx`, `TabletSearchResults.test.tsx`, `components/mushaf/__tests__/MushafSearchView.units.test.tsx`, `mushafSearchVerses.test.ts` |
| Word flash | `components/mushaf/skia/__tests__/useWordFlashHighlights.test.tsx`, `components/mushaf/__tests__/MushafScreenAnchorFlash.test.tsx`, `utils/__tests__/quranLink.test.ts`, `services/mushaf/__tests__/DigitalKhattDataService.pageForWord.test.ts` |
