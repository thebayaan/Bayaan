# Quran Word Search

> Search the Arabic text of the Quran by word, phrase or root, in the Search tab and in the mushaf search.

**Status:** v1 implemented on `wip/search`. Device verification (plan task 03 T12: profiling on a mid-range Android and an iPad, VoiceOver, Dynamic Type, screenshots) is still to do.
**Plan:** [docs/plans/2026-11-14-word-study/03-word-search.md](../plans/2026-11-14-word-study/03-word-search.md). Where it differs, the plan's [README](../plans/2026-11-14-word-study/README.md) decisions win.

---

## What it does

- **Words and phrases.** Type or paste Arabic: `الصلاة`, `ذلك الكتاب`, `يا أيها الذين آمنوا`, or a pasted Uthmani verse with its marks. Diacritics, tatweel, presentation forms and bidi marks do not matter, and everyday (imla'i) spellings find the Uthmani words (`الصلاة` finds ٱلصَّلَوٰةَ, `ابراهيم` finds إِبْرَٰهِـۧمَ).
- **Roots.** `root:رحم`, `جذر: ر ح م` or spaced letters `ر ح م` list every word of the root, grouped by lemma. A one-word query of 3-4 letters also suggests the roots it may spell ("Root ر ح م"); tapping the suggestion runs the root query.
- **Surah openings.** Letters typed apart that spell one of the 14 openings (`ا ل م`, `ح م`, `ع س ق`, `ك ه ي ع ص`, or one letter: `ن`) find that opening, even when they also spell a root: `ا ل م` lists the six الم openings and suggests the root ء ل م. Typed apart before other words, they are that opening too (`ا ل ر تلك آيات الكتاب`). See [Surah openings](#surah-openings-al-muqattaat).
- **Surah beginnings.** A phrase that starts with an ayah of one word (an opening such as الم, حم or طه, or الرحمن, والعصر) runs on into the next ayah, which is listed: `الم ذلك الكتاب لا ريب فيه` finds 2:2, `حم تنزيل الكتاب` 40:2, 45:2 and 46:2. No other ayah boundary is crossed (see [Scoring and order](#scoring-and-order)).
- **One parse.** The data service alone parses a query, with the list of the index's roots, and every surface reads what the query is (text, root or neither) from its outcome, so `ر ح م` is a root query everywhere.
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
| Engine (pure) | `utils/search/quranSearch.ts` (`searchQuranText`, `matchedPositions`, `QURAN_ONE_WORD_AYAHS`) |
| Build | `scripts/search/quranSearchIndex.ts` (pure builder and gates), `scripts/search/build-quran-search-db.ts` (CLI) |
| Asset | `assets/data/quran-search-v1.db` (`QURAN_SEARCH_DB_NAME`); its sha256 is recorded in `services/search/__tests__/bundledDatabases.sha256.json` |
| Data service | `services/search/QuranSearchDataService.ts` (expo-sqlite, lazy; `search` parses each query once, with the root list; `isQuranQuery` and `mayBeRootQuery`, the checks that need no index) |
| Hooks | `hooks/useQuranSearch.ts` (`useQuranSearch`, `useQuranRootSearch`, `isQuranQuery` and `mayBeRootQuery` from the service, `prefetchQuranSearch`) |
| Rows | `components/search/quran/` (`quranResultRows.ts` row model with `isRootOutcome` and `showsOwnRows`, `QuranResultRowView`, `VerseHitRow`, `RootLemmaChips`, `RootResults`, `RecentVerseRow`), `utils/search/verseSnippet.ts` |
| Shared file names | `constants/bundledDatabases.ts` (`IRAB_DB_NAME`, the i'rab DB the build reads and `IrabDataService` opens) |
| Surfaces | `components/search/SearchView.tsx`, `components/search/TabletSearchResults.tsx`, `app/(tabs)/(b.search)/index.tsx`, `components/mushaf/MushafSearchView.tsx`, `components/mushaf/mushafSearchVerses.ts` (`hitTarget`, `hitLabel`) |
| Word flash | `store/mushafWordFlashStore.ts`, `components/mushaf/skia/useWordFlashHighlights.ts`, `app/mushaf.tsx` (`words` param; the flash in `MushafReader`), `hooks/useMushafOpenTarget.ts` (the page of the first matched word), `utils/search/quranHitParams.ts` (`quranHitOpenParams`, `parseFlashWords`), `DigitalKhattDataService.getPageForWord` |
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
2. **Not a Quran query:** any digit, or no Arabic letter. So `2:255`, `صفحة 5`, `juz 30` and reciter names keep their old behaviour. This never depends on the root list, so `isQuranQuery` (the service's check, used by the surfaces to leave commands alone) always agrees with `search`.
3. **Openings and roots:** `root:` or `جذر:` (any UI language) ask for a root. Single letters typed apart (2-5 of them, or one letter) that spell a surah opening are that opening (see [Surah openings](#surah-openings-al-muqattaat)), also before other words (`ا ل ر تلك آيات الكتاب` is `الر تلك آيات الكتاب`), as is a first word pasted with the maddah the mushaf draws over an opening (`الٓمٓ`); otherwise 3-4 of them that spell a known root are a root query (`ر ح م`). Other spaced letters join into one word. Only the data service holds the root list, so only it decides between a root and text; the surfaces take the kind from its outcome. `mayBeRootQuery` (the service's check without the root list: `root:`, or 3-4 letters typed apart that are no opening) says whether the answer may be a root; it holds for every root answer, and the surfaces hold their own rows for such a query until it answers.
4. Split into words. A standalone يا or ها typed without a hamza, and إل, join the next word (يا أيها → ياايها, إل ياسين). آل and ال do not (آل فرعون is two words in the mushaf too).
5. Each word is prepared and folded with the imla'i rules, so pasted Uthmani gives its imla'i key.
6. **Hamza seats:** ؤ and ئ anywhere, and أ / إ after a word's first letter, are also tried without their seat letter (مسؤولا → مسوولا, مسولا; يسألونك → يسالونك, يسلونك), as the Uthmani text often writes that hamza on the line or on a tatweel. At most 2 seats, so at most 4 keys per word.
7. **Hamza requirement:** a word typed with a hamza only matches words with the hamza flag (ماء finds 59 ayahs, not every ما). An opening (typed as letters, or pasted from the mushaf) only matches words without it (ا ل م finds الٓمٓ, not ألم).
8. Caps: 24 words and 200 letters (marks are not counted, so a pasted verse is never cut inside a word).

### Surah openings (al-muqatta'at)

The 14 distinct openings (`QURAN_OPENINGS` in `quranText.ts`) are الم (2:1, 3:1, 29:1, 30:1, 31:1, 32:1), المص (7:1), الر (10:1, 11:1, 12:1, 14:1, 15:1), المر (13:1), كهيعص (19:1), طه (20:1), طسم (26:1, 28:1), طس (27:1), يس (36:1), ص (38:1), حم (40:1 to 46:1), عسق (42:2, after حم in 42:1), ق (50:1) and ن (68:1). The Digital Khatt text draws each as one word in slot 1, with a maddah over the letters (الٓمٓ, عٓسٓقٓ) and sometimes a pause mark (الٓرۚ, صٓۚ); طه has no marks. The folds remove them, so every opening is indexed under its bare letters, without the hamza flag.

- **Letters typed apart** (`ا ل م`, `ح م`, `ك ه ي ع ص`, `ط س م`, `ي س`, `ع س ق`) or **one letter** (`ص`, `ق`, `ن`) that spell an opening are a text query for that opening, even when they spell a root. The token matches whole words only (no prefix forms) and only words without a hamza, so `ا ل م` lists exactly the six الم openings: not ألم ("did not") and not الملك. Typed with a hamza (`أ ل م`) the letters are not an opening and stay a root query (ء ل م).
- **The root stays one tap away.** The query's letters still give root suggestions: `ا ل م` shows "Root ء ل م" (73 ayahs) above the six ayahs.
- **Pasted from the mushaf**, an opening is that opening, alone or before words: the mushaf draws a maddah over its letters (الٓمٓ, حمٓ, نٓۚ), and no other word that spells an opening has one (ألم never does), so `الٓمٓ` lists the six الم openings like `ا ل م`. طه has no maddah, and only ever is the opening.
- **Typed as one word** (`الم`), an opening is an ordinary word: الم is also ألم typed without its hamza and, from 3 letters, the start of every word beginning with الم. It lists the six openings among the whole-word matches (2:1 first, then mushaf order, mixed with ألم), followed by the prefix matches (الملك). Typing the letters apart is the way to get the openings alone. حم, طه, يس, طسم, عسق and كهيعص find only their openings either way; الر and المص also list prefix matches after them; المر also finds المرء among its whole-word matches (2:102, 8:24, then 13:1, 78:40, 80:34), before its prefix matches.
- **Followed by words.** An opening that is an ayah of its own runs on into the next ayah ([Scoring and order](#scoring-and-order), Phrase): `الم ذلك الكتاب` finds 2:2, `حم عسق` 42:2 and `حم عسق كذلك يوحي` 42:3. The openings inside a longer first ayah (الر, المر, طس, ص, ق, ن) are found with their words as usual (`الر تلك آيات الكتاب` finds 10:1, 12:1 and 15:1).

### Scoring and order

- **Lookups:** one `SELECT ... WHERE form IN (...)` for every key of every word; the last word, from 3 letters, also gets a prefix range lookup (`form > key AND form < key + U+FFFF`, at most 4,000 forms), unless it is an opening (typed as letters, or pasted from the mushaf). Postings are cached in a 64-entry LRU.
- **Word score:** exact 100 or prefix 60, plus tier × 10, minus 5 for `rasmOnly`.
- **Phrase:** consecutive slots inside one ayah, joined from the rarest word's slots by binary search. The phrase score is the lowest of its words; an ayah scores its best occurrence.
- **Run-on phrase:** a phrase may also start on an ayah of one word (`QURAN_ONE_WORD_AYAHS` in `quranSearch.ts`, checked against the Digital Khatt words: the 20 ayahs that are an opening alone, الطور 52:1, الرحمن 55:1, مدهامتان 55:64, الحاقة 69:1, الفجر 89:1, الضحى 93:1, القارعة 101:1 and العصر 103:1), or on several in a row (حم عسق, 42:1-2), and go on with the first words of the next ayah of the surah. That ayah is the hit, with those words highlighted: `الم ذلك الكتاب لا ريب فيه` finds 2:2, `الرحمن علم القرآن` 55:2. The index keeps no verse lengths, so no other ayah boundary is crossed: `الحمد لله رب العالمين الرحمن الرحيم` (1:2-3) is not one phrase; search either ayah's words.
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
| `meta` | `format`=1, `normalizer`=2, `dk_words_sha256`, `irab_morph_sha256`, `content_sha256`, counts (`verses` 6,236, `words` 77,432, `forms` 21,143, `postings` 123,694, `roots` 1,642, `lemmas` 4,659), `complete`='1' written last |
| `forms` | `form` (folded spelling) → `postings` (base-36, first code absolute then deltas, comma-separated) |
| `roots` | `id`, `root` (exactly the i'rab الجذر text, `ر ح م`), `words`, `ayahs` |
| `lemmas` | `id`, `root_id`, `lemma` (the i'rab الأصل المعجمي text, NULL for words without one), `words`, `ayahs`, `postings` |

**Posting code:** `slot = verseIndex * 256 + position` (verse index 0..6235 in mushaf order, Digital Khatt slot 1..128), `code = slot * 32 + flags`. Flags: bits 0-1 tier (3 full, 2 without proclitics, 1 without the article), bit 2 hamza, bit 3 rasm only, bit 4 reserved (another rewayah's spelling, 0 in v1). Morphology attaches to the first Digital Khatt slot of a QUL word; the two differ only where «بعد ما» is drawn as two slots (2:181, 8:6, 13:37, `utils/quranWordPositions.ts`).

**Sources:** `data/mushaf/digitalkhatt/digital-khatt-v2.db` (Hafs words; `dk_words_sha256` is the sha256 of each word's location and text in id order, `dkWordsSha256`, not of the file, so a rewrite with the same rows leaves the index fresh: #489 rewrote the file when `words.id` became the primary key, and the hash stayed `5367410f...e6d9`) and the i'rab DB (`assets/data/irab-v1.db`, named by `IRAB_DB_NAME` in `constants/bundledDatabases.ts`: QUL morphology from the Quranic Arabic Corpus). Of the i'rab DB the index reads only each word's morphology: its proclitics, whether the article defines it, its lemma, its root and the root count the data states. `irab_morph_sha256` is the sha256 of exactly that, word by word in mushaf order (`irabMorphologySha256` in `scripts/search/quranSearchIndex.ts`), not of the file, so stripping the books' footnotes, rewording the i'rab prose, renumbering the texts or renaming the file leaves the index fresh. Licences: Digital Khatt (OFL) and the Quranic Arabic Corpus (GPL, already shipped in the i'rab DB); see the "Quran word search index" section of `THIRD_PARTY_LICENSES.md`.

### Rebuild

```sh
npx tsx scripts/search/build-quran-search-db.ts            # write the DB (about 9 s)
npx tsx scripts/search/build-quran-search-db.ts --check    # verify the committed DB
npx tsx scripts/search/build-quran-search-db.ts --imlaei words.tsv --out x.db
```

Rebuild after any change to `quranText.ts`, `quranIndexFormat.ts`, the Digital Khatt Hafs words or the morphology the index reads from the i'rab DB. The build is deterministic (the same sources give the same bytes). `services/search/__tests__/quranSearchDb.test.ts` rebuilds the index in memory and fails, naming the command, when the committed file is stale (a meta value differs, or the file has a meta key the build no longer writes); `--check` does the same. Changing only how queries are parsed (the openings, the root list) needs no rebuild and no normaliser bump: the index content stays the same.

**Build gates** (the script fails on any): exactly 6,236 verses and 77,432 words outside the markers, in `verseKeyAt` order; Digital Khatt and QUL word counts equal except at the three «بعد ما» slots; every word yields a spelling inside the alphabet (also for the 7 other words DBs); every i'rab row maps to a slot and every root count matches its stated count (except ء م م); every golden query passes (`utils/search/__fixtures__/quranSearchGolden.ts`: 135 text queries with the 14 openings, pasted openings and the run-on phrases, 10 root rows, 13 root suggestions and 9 query kinds, which the Jest suites also run on every surface); every verse is found by pasting its first 12 or fewer words.

**Runtime:** the data service copies the asset into the documents folder on first use and opens it; a copy whose `meta` lacks `complete='1'` (a kill during the copy) is deleted and copied again. `prefetchQuranSearch()` starts this when the Search tab or the mushaf search enters search mode.

**A phone keeps its copy by name.** `importDatabaseFromAssetAsync` does nothing when a database of that name exists (the service never passes `forceOverwrite`; checked in expo-sqlite 58's iOS and Android code), and the service only re-imports a copy that is incomplete or of another `format`. The same holds for `irab-v1.db` (`IrabDataService` re-imports only a copy without the `morph` column), `gharib-v1.db` and `rasm-v1.db` (`WordStudyDataService` re-imports only a copy of another `format`). So a rebuilt file must ship under a new name (`quran-search-v2.db`, with `QURAN_SEARCH_DB_NAME`, the `require()` and this doc). `services/search/__tests__/bundledDatabases.test.ts` enforces it for the four files:

- `bundledDatabases.sha256.json` records the sha256 of each under its versioned name, and the test fails when a file's bytes change while its name stays the same, saying to bump the version in the name and every reference or, while the file has never shipped, to update the record deliberately (it prints the `git tag --contains` command that lists the releases holding the file).
- Each name is versioned and is the file the app `require()`s.
- Each app service, run as on a first launch (an empty database folder, each asset its own id), opens and imports its database under the name of the asset it imports. A service that kept an old name (a rename that missed the name the service opens) would keep a phone's old copy, and fails here.
- Each service keeps an installed copy of that name rather than the new asset.

### Seams

- **Imla'i text (`--imlaei <tsv>`):** one line per slot, `s:a:w<TAB>word`. Each word is folded with the query rules and added as an extra tier-3 spelling (not `rasmOnly`). Nothing changes at runtime or in the schema; a rebuilt file would ship as `quran-search-v2.db`. The text fed in needs its own licence check (as the rasm source in the word-study plan) and a `THIRD_PARTY_LICENSES.md` entry. v1 ships without it.
- **Other rewayat:** flag bit 4 is reserved for spellings from the other 7 words DBs (the slots are shared). Hits would then be labelled with that rewayah. Not built.

---

## Budgets and measurements

| Item | Budget | Measured |
|---|---|---|
| Asset | ≤ 2 MB | 1.69 MB (21,143 forms, 123,694 postings) |
| Build | ≤ 30 s | about 9 s (Node 22), also run in Jest by the freshness test |
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
- What a query is comes from the Quran search's outcome, never from a parse in the tab: a query the outcome calls a root (`root:رحم`, `ر ح م`) skips the catalogue (no search, no analytics event), and on iPad keeps the list. Only a query whose answer may be a root (`mayBeRootQuery`: `root:`, or 3-4 letters typed apart that are no opening) makes the catalogue wait for that answer, with no catalogue rows meanwhile (never the last query's); every other query, Arabic or Latin, runs the catalogue at once, also while the index is still being imported (`showsOwnRows`).
- The list is the catalogue rows, then the Ayahs rows: header with counts (and the Hafs or all-words note), root suggestions, 30 ayahs, "Show N more"; in root mode the root header, lemma chips and ayahs. A lemma chip shows the corpus's homonym number in the app's digits (مَٰلِك2 reads مَٰلِك٢ in Arabic, as in Word Study); the chip still selects its lemma by id.
- The full empty state shows only when both searches are empty; for Arabic queries its hint reads "Try fewer words or another spelling".
- Tapping an ayah stores a `{type: 'verse', verseKey, positions, timestamp}` recent search (a book icon and "Al-Baqarah 2:255") and pushes `/mushaf` with `quranHitOpenParams`: `{surah, ayah, anchor: 'S:A:W', words: '3,4'}`, and no page: the reader opens the page of the first matched word once the Mushaf data is ready (`useMushafOpenTarget`), as it does for a saved verse.
- A root suggestion replaces the query: `index.tsx` sets its state and, on iOS 26, the native search bar text (`searchBarRef.setText`). The native bar may not report text set from code, which is why the state is set directly; check on device.
- iPad: the tablet results show when there are catalogue or Quran rows; root mode (the outcome on screen is a root, or a query that may be one waits for its answer) keeps the capped list in the 720pt column, so `TabletSearchResults` never gets root rows.

### Mushaf search (`MushafSearchView`)

- The page, juz, verse and surah commands stay instant. The Quran search waits for a 250 ms pause and never runs for a command (digits; the hook asks the service only when `isQuranQuery` says so); a Quran query shows "Searching the Quran…" until its first results.
- A query whose answer may be a root (`mayBeRootQuery`, as in the Search tab) holds its command results until the search of the typed query answers: a root lists its words only, anything else shows the commands above the ayahs. So `ن و ر` never shows An-Nur only to take it away. Every other query shows its commands at once (`showsOwnRows`).
- Rows are labelled in the rewayah on screen (`hitTarget`, `hitLabel`): the Hafs verse, or the verse holding the first matched word ("Quraysh 106:5 · Warsh"); while that rewayah's verses load, the Hafs verse saying so ("Quraysh 106:4 · Hafs").
- A tap flashes the matched words, adds a history entry like a typed `N:M` (a Hafs verse, or the anchor and the rewayah), and opens the verse on the page of its first matched word. While the verses load it opens that page.

### Word flash

`useMushafWordFlashStore.show(verseKey, positions)` flashes Hafs slots for 3 s; `useWordFlashHighlights` bands them, in the recitation word colour, on the Digital Khatt pages that hold the verse (chained after the recitation highlights in `SkiaPage` and in `MushafPageContent`, the page of the vertical `ContinuousMushafView`; other pages keep their highlights object and do not re-render). Slots are shared by all 8 Digital Khatt texts, so the flash works in every rewayah; a blank slot paints nothing. Mushaf 1440 (QCF) and the list and reading views get the 3-second verse selection only.

`DigitalKhattDataService.getPageForWord(verseKey, position)` looks the slot itself up from the verse's first page (at most 3 pages), from the verse index and the layout: a verse is one id range, so slot `position` is word id `first + position - 1`, and no word is read. In the 15-line layout every page ends at the end of a verse, so it equals the verse's page for all 83,668 slots (checked by a test); the lookup keeps working for a layout where a verse runs on: a test on a made-up layout, where a verse's last slots are on the next page, checks that they get that page.

---

## Tests

| Area | Tests |
|---|---|
| Spelling rules, folds | `utils/search/__tests__/quranText.test.ts`, `normalize.test.ts` |
| Index format, positions | `utils/search/__tests__/quranIndexFormat.test.ts`, `utils/__tests__/quranWordPositions.test.ts` |
| Engine | `utils/search/__tests__/quranSearch.test.ts` (synthetic postings, run-on phrases), `quranSearch.golden.test.ts` (bundled DB: golden queries with the openings and run-on phrases, the query kinds, `isQuranQuery` and `mayBeRootQuery` against `search`, every verse by its first 12 words) |
| Asset freshness and gates | `services/search/__tests__/quranSearchDb.test.ts` (also: the morphology fingerprint ignores the i'rab prose and text ids; the one-word ayahs match the Digital Khatt words), `services/search/__tests__/bundledDatabases.test.ts` (a bundled DB's bytes never change under its name; each service imports its database under the name of its asset and keeps an installed copy) |
| Data service | `services/search/__tests__/QuranSearchDataService.test.ts` |
| Hook, rows, components | `hooks/__tests__/useQuranSearch.test.tsx`, `components/search/quran/__tests__/*`, `utils/search/__tests__/verseSnippet.test.ts` |
| Surfaces | `components/search/__tests__/SearchView.quran.test.tsx`, `TabletSearchResults.test.tsx`, `quranSearchSurfaces.golden.test.tsx` (the real hook and service on the bundled index: `QURAN_KIND_FIXTURES` on the Search tab, phone and iPad, and the mushaf search), `components/mushaf/__tests__/MushafSearchView.units.test.tsx`, `mushafSearchVerses.test.ts` |
| Word flash | `components/mushaf/skia/__tests__/useWordFlashHighlights.test.tsx`, `components/mushaf/__tests__/MushafScreenAnchorFlash.test.tsx`, `components/mushaf/__tests__/MushafScreenSavedVerseOpen.test.tsx`, `utils/search/__tests__/quranHitParams.test.ts`, `services/mushaf/__tests__/DigitalKhattDataService.pageForWord.test.ts`, `DigitalKhattDataService.test.ts` (`getPageForWord` on a made-up layout, a verse that runs onto the next page included) |
