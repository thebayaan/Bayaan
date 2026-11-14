<!-- @ai-generated -->
# Word and root search of the Quran text

> Design written against `develop` at `b0a151ce` (2026-11-14) by a read-only design agent. Decisions that override it are in [README.md](README.md); where they disagree, README.md wins.

## Summary

Build-time index: a new script (`scripts/search/build-quran-search-db.ts`) combines the Hafs Digital Khatt words with the morphology in `irab-v1.db` into `assets/data/quran-search-v1.db` (about 1.4 MB). The file holds search spellings with postings (verse index, slot, tier, flags), plus roots and lemmas. FTS5 is not used.
One Uthmani-aware normaliser (`utils/search/quranText.ts`) shares its letter folds with `utils/search/normalize.ts`. It gives each word an imla'i spelling (dagger alif as alif, the silent waw of صلوة read as alif, ۧ as ي) and a rasm spelling. It also adds forms without proclitics (taken from the i'rab segmentation), forms without the article, and a hamza flag. Queries get the same folds plus hamza-seat variants.
A pure engine (`utils/search/quranSearch.ts`) matches any spelling exactly, matches the last word as a prefix (3+ letters) and matches consecutive phrases within one ayah, with an "all words" fallback. Ranking is exact > without proclitics > without article > prefix, then mushaf order.
Root search works with `root:` / `جذر:`, spaced letters (`ر ح م`), or a root suggestion row. Lemma chips group the results. The word view can embed `RootResults`.
UI: an "Ayahs" section with counts, highlighted snippets, paging, and empty and loading states, in the Search tab (phone list and iPad scope) and in MushafSearchView. Tapping a result opens the mushaf at the matched word's page, selects the verse, and flashes the words (a new word-flash layer on Digital Khatt pages).
Prototype on the real data: 89 of 89 fixture queries pass, every one of the 6,236 ayahs is found from its first 12 words, all 2,902 random pasted phrases are found, and the slowest query took 6.4 ms in Node.
Seams: an imla'i text and the other rewayat's spellings can be added to the same tables later. Places, word pictures and meaning search are not touched.

## Current state

### Search today (catalogue only)
- `utils/search/` is a name search for surahs and reciters. `normalizeSearchText` (`utils/search/normalize.ts:8-22`) strips marks at :13 and folds أإآٱ→ا, ى→ي, ة→ه at :15-18. `toSearchKey` (:29-41) folds ؤ→و and ئ→ي, drops ء (:35-37), and turns every non letter or digit into a space (:39). `createSearchIndex` (`utils/search/createSearchIndex.ts:206-256`) scores in-memory items through tiers (:13-21), with typo budgets (:184-195) and a wrong-keyboard retry (:245-255, `keyboardLayout.ts:59`). The adapters are `createSurahSearch`, `createReciterSearch` and `createCatalogSearch` (`utils/search/catalog.ts:20`, `:57`, `:148-169`). Nothing indexes verse text (`docs/research/surah-app-feature-gaps.md:189,191`).
- **The catalogue normaliser is not safe on Digital Khatt text.** Checked with `npx tsx`: `toSearchKey('عَرَبِيࣰّاۚ')` gives `'عربي ا'`, because U+08F0 open tanween falls to the :39 punctuation rule and splits the word. It also yields only rasm spellings: `ٱلصَّلَوٰةَ`→`الصلوه`, `إِبْرَٰهِـۧمَ`→`ابرهم`. Typed `الصلاة` or `ابراهيم` would therefore never match.
- **Search tab.** `app/(tabs)/(b.search)/index.tsx` owns `query` (:35). It comes from the iOS 26 `Stack.SearchBar` (:86-106, ref :59) or the Android `TextInput` (:129-144), and the screen renders `SearchView` (:165-174). `SearchView`:
  - debounces for 300 ms (`components/search/SearchView.tsx:59`, `:186-191`) and runs the catalogue search synchronously (:232-259);
  - renders a `FlatList` of surah and reciter rows (:590-642), or `TabletSearchResults` on iPad, but only when there are catalogue hits (:578-588);
  - pushes `/mushaf?surah` on a surah tap (:296-316), and keeps recent items for surahs and reciters only (:57, :61-65, :265-294);
  - colours its section header with `textSecondary` at 0.5 alpha (:504-512), below the 0.8 that iPad standards §12 requires.
- **iPad results.** `TabletSearchResults` has All / Reciters / Surahs scope chips (`components/search/TabletSearchResults.tsx:40`, `:136-148`). The All scope shows a top card, surahs and a reciters shelf (:234-280).
- **Mushaf search.** `MushafSearchView.parseSearchQuery` (`components/mushaf/MushafSearchView.tsx:187-338`) handles, in order: page N (:199-212), juz (:214-260), N:M (:262-287), plain numbers (:289-323), then `rankSurahs` (:325-334).
  - Results render in a `FlatList` (:1209-1241); `handleResultPress` (:702-748) sends verses through `navigateToTarget` (:675-689) to `onNavigateToVerse(verseKey, page, rewayah)`.
  - `mushafSearchVerses.ts` gives verse targets and labels in the rewayah on screen: `VerseTarget` (:50-59), `verseQueryTarget` (:93-108), `anchorTarget` (:117-132), `verseResultTexts` (:135-149).
  - History entries keep a Hafs verse, or an anchor plus rewayah (:114-133).
- **Plans.** The search plan's Phase 2 proposes FTS5 over an imla'i text (`docs/superpowers/plans/2026-10-12-search-overhaul.md:1624-1630`). RFC-012 and RFC-020 are about reciter filter chips (`docs/rfcs/020-search-filter-experience.md:20-98`). Ayahs are a result type, not a filter, so the two do not collide.

### Quran text sources (which one has word-level Hafs text with s:a:w)
- `data/quran.json`: 6,236 verse strings in the KFGQPC encoding, with the ayah number; read by `TranslationContent.tsx:36` and `TafseerContent.tsx:46`. Verse level only.
- `data/QPC V4 2.json`: 83,668 `s:a:w` entries of QCF V4 glyph codes (e.g. `"ﱁ"`). Glyph codes, not Unicode text.
- `data/wbw/wbw-en.db` `words`: 77,429 rows (`verse_key`, `position`, `text_uthmani` in QPC encoding, translation, transliteration, `audio_url`), in QUL numbering. Read by `services/wbw/WBWDataService.ts:28-91`.
- **`data/mushaf/digitalkhatt/digital-khatt-v2.db` `words(id, location 's:a:w', surah, ayah, word, text)`** has 83,668 rows: 77,432 Hafs word slots plus 6,236 verse markers (`۝١`). This is the word-level Hafs Unicode text with `s:a:w` locations, and it is what the mushaf draws (`DigitalKhattDataService.ts:28-38`, Hafs config :71-77, `parseWordInfo` :493-502, `getVerseWords` :1639-1645). The highest slot number is 129 (the 2:282 marker).
  - Slots differ from QUL in three verses. Digital Khatt splits «بعد ما» into two slots in 2:181 (slots 3-4), 8:6 (4-5) and 13:37 (8-9); `WBWVerseView.tsx:403-448` re-aligns them by text at runtime. 37:130:3 is a single slot that contains a space (`إِلْ يَاسِينَ`, `lineWordSpans.ts:13-16`).
  - Encoding facts the normaliser must handle:
    - Hamza is stored decomposed: U+0654 ×11,300 and U+0655 ×5,088, and no U+0623-U+0626 at all.
    - U+0653 maddah ×5,376 is a madd sign, not a hamza.
    - Dagger alif U+0670 ×9,726; small high yeh U+06E7 ×38; small waw and small yeh U+06E5/U+06E6; silent mark U+06DF ×3,988.
    - Open tanween U+08F0-U+08F3 ×6,644 and CGJ U+034F ×5.
    - ۞ ×199 and ۩ ×15 sit inside word text.
  - The seven non-Hafs words DBs keep the same slots and the same code points (plus one precomposed آ in al-Duri and al-Susi).

### Morphology in irab-v1.db
- `word_irab(verse_key, position, entries, agreed, morph)` has 77,429 rows in QUL numbering (`services/irab/IrabDataService.ts:64-85`). `morph` is JSON `[[labelId, valueId], ...]` into the `texts` table (`irabFormat.ts:83-103`).
  - `الجذر` holds the root as letters joined by spaces, with ء for hamza (`ر ح م`, `ء ل ه`; `scripts/irab/sarf.ts:23-57`, `:391-396`).
  - `الأصل المعجمي` holds the lemma in Uthmani spelling (`رَّحْمَٰن`), for verbs and nominals only (:398-400).
  - `وروده في القرآن` gives root and lemma counts over stems (:334-349, :469-479); `التعريف` gives definiteness (e.g. `معرفة بأل`).
- `entries` rows of kind `p` name each proclitic: الواو 9,594, اللام 3,847, الفاء 3,001, الباء 2,544, الهمزة 513, يا 361, الكاف 295, السين 119, ها 10, التاء 9.
- Coverage:
  - 49,967 words carry a root: 1,642 roots (1,602 of three letters, 40 of four).
  - 56,843 words carry a lemma: 4,784 lemma spellings and 4,656 root-and-lemma pairs. 109 words have a root but no lemma.
  - Per-root word counts equal the counts stated in the data for 1,641 of the roots. The exception is ء م م: 118 words against a stated 119, because 20:94 يَبْنَؤُمَّ holds two stems and the morph keeps only the main one.
  - No root-and-lemma pair is used by both a verb and a noun.
- The database opens lazily (`IrabDataService.ts:23-61`), and the version is in the file name (:14). The licence notice is at `THIRD_PARTY_LICENSES.md:92-110`.
- The word view shows root and lemma as plain text in `MorphTable` (`components/sheets/verse-actions/IrabContent.tsx:386-400`).

### Opening the mushaf at an ayah; word highlight capability
- **Routes.** `/quran/[surah]/[ayah]` redirects to `/quran/[surah]?ayah` (`app/quran/[surah]/[ayah].tsx:8-13`). That route waits for the data, then redirects to `/mushaf` with `{surah, ayah, page}` (`app/quran/[surah].tsx:26-44`, `utils/quranLink.ts:12-44`).
- **Mushaf params.** `/mushaf` takes `surah | page | ayah | anchor` (`app/mushaf.tsx:55-66`). An `anchor` of 'S:A' or 'S:A:W' (a Hafs location) selects exactly the verse unit of the rewayah on screen that holds that slot (`selectionForAnchor`, `services/mushaf/MushafVerseMapService.ts:615-621`). The selection flashes for 3 s (`app/mushaf.tsx:165-212`).
- **Inside the reader.** `navigateToVerse(verseKey, page, rewayah)` (`components/mushaf/main.tsx:1139-1173`) turns the page and selects the verse for 3 s. Sheets navigate through `useMushafNavigationStore` (`store/mushafNavigationStore.ts:1-22`, consumed at `main.tsx:1100-1120`; for example `SimilarVersesContent.tsx:190-195`). The search overlay is mounted at `main.tsx:1561-1592`.
- **Word highlights exist on Digital Khatt pages:**
  - `LineHighlight` runs support band, underline and caret styles (`components/mushaf/skia/verseHighlightLayers.ts:42-51`).
  - `withRecitedWordRun(base, lines, source, verseKey, position, color, style)` (`recitedWord.ts:55-78`) adds a word run.
  - `useRecitationLineHighlights` uses it (`useRecitationLineHighlights.ts:27-223`, word band colour :94-96), and is called in `SkiaPage.tsx:787` and `ContinuousMushafView.tsx:643`.
  - Line spans carry Hafs verse keys and Hafs slot positions in every rewayah (`lineWordSpans.ts:1-28`, `:204-228`; `MushafVerseMapService.ts:222-226`).
  - QCF pages (`components/mushaf/qcf`) and the reading views have no word runs.
- **Result rows can reuse SkiaVerseText.** `SkiaVerseText` already tints character ranges with `getRectsForRange` (`SkiaVerseText.tsx:288-337`) and accepts an explicit `words` list (:85-91). `layoutWords` gives per-word character spans (`lineWordSpans.ts:130-136`).

### expo-sqlite and FTS5
- expo-sqlite 58.0.14 compiles FTS4 and FTS5 unless `expo.sqlite.enableFTS=false` (`node_modules/expo-sqlite/ios/ExpoSQLite.podspec:42-44`, `android/build.gradle:30-32`). The app uses the plugin with no options (`app.config.js:206`). No FTS table exists anywhere.
- Services import bundled DBs once with `importDatabaseFromAssetAsync` and read them with `getAllAsync` (`IrabDataService.ts:35-61`, `WBWDataService.ts:28-57`). `.db` is a Metro asset extension (`metro.config.js:13-14`).
- Tests read bundled DBs with better-sqlite3 (`services/irab/__tests__/irabDatabase.test.ts:7-21`) or with node:sqlite in the `*.alldbs` suites (`services/mushaf/__fixtures__/bundledDkSqlite.ts`; `.github/workflows/test.yml` runs Node 22 with `BAYAAN_OVERLAY_DB_DIR=bundled`). `test-utils/sqliteAdapter.ts` gives better-sqlite3 the expo-sqlite async API.
- CI runs Prettier, ESLint and tsc (`lint.yml`), Jest (`test.yml`), and the i18next-cli checks (`i18n.yml`).

## Design

## 0. Scope and shape
- **In scope:**
  - Arabic word and phrase search over the Hafs text.
  - Root search, with lemma grouping.
  - An Ayahs section in the Search tab (phone and iPad) and in the mushaf search.
  - Opening the mushaf at the matched words.
- **Out of scope (seams only):** places and word pictures (per the user), meaning, translation and tafsir search, Latin transliteration of verses, spellings of the other 7 rewayat, and an imla'i text.
- **Layers:**
  1. A build script produces an SQLite asset.
  2. A pure engine (async only for postings lookups).
  3. A lazily opened data service.
  4. One hook and one row model shared by three surfaces: the Search tab, MushafSearchView, and the word view sheet.
- **Why not extend `createSearchIndex` / `createCatalogSearch`?** They score about 300 in-memory items with fuzzy tiers. Quran text needs async postings over 77k words, exact Quranic spelling rules, positions for highlights, and no typo tier. So the engine is new, while the letter folds come from `normalize.ts`.

## 1. (a) Normalisation (one module, `utils/search/quranText.ts`)

### 1.1 Index side: per Hafs Digital Khatt slot, in this order
1. **Skip verse markers** (slot text starting with ۝ U+06DD). A slot with a space (37:130:3) stays one word; its space is removed in step 8.
2. **Delete U+0653 maddah, then NFC.** NFC composes the decomposed hamza (ا+ٔ→أ, و+ٔ→ؤ, ي+ٔ→ئ). Deleting the maddah first matters: in Uthmani it is a madd sign, and NFC would otherwise turn ا+ٓ into آ and invent a hamza (`مَآءً`, `فَلَآ`).
3. **Delete** ۞ U+06DE, ۩ U+06E9 and CGJ U+034F.
4. **ىٰ → ى** (`عَلَىٰ` → على).
5. **Vocative:** a word-initial ي, then harakat, then ٰ becomes يا (`يَٰقَوْمِ`, `يَٰٓأَيُّهَا`). The vocative alif is always written.
6. **Spellings:**
   - **imlaei:**
     - A bare و followed by ٰ (and optionally ا۟) becomes ا. This covers exactly 9 lemmas in Hafs: الصلاة, الزكاة, الحياة, مشكاة, مناة, النجاة, الغداة, صلاتك, الربا (`ٱلرِّبَوٰا۟`→الربا).
     - Every other ٰ becomes ا.
     - ۧ U+06E7 becomes ي (`إِبْرَٰهِـۧمَ`→ابراهيم, `ٱلنَّبِيِّـۧنَ`→النبيين).
   - **rasm:** ٰ and ۧ are deleted (هذا, ذلك, الرحمن, لكن, إله, أولئك, هؤلاء, الصلوة).
   - **mixed:** words with 2-3 dagger alifs also get every other combination (`ٱلسَّمَٰوَٰتِ` → السموات, السماوت). A spelling that comes only from rasm or mixed sets the `rasmOnly` flag.
7. **Delete marks:** U+0610-061A; U+064B-065F (harakat, shadda, sukun, and leftover U+0654/0655 such as the hamza on tatweel in `مَسْـُٔولًا`); U+0670; U+06D6-06ED (pause signs, ۥ ۦ, ۟ ۠ ۢ ۭ; the letter under ۟ is kept); U+08D3-08FF (open tanween); U+0640 tatweel.
8. **Fold letters exactly like the catalogue keys:** ٱ أ إ آ→ا; ى ی→ي; ک→ك; ة→ه; ؤ→و; ئ→ي; ء is deleted. Then delete spaces.
9. **Hamza flag:** set when the word had ء, أ, إ, ؤ, ئ, or U+0654/0655 after step 2.
10. **Without proclitics (tier 2):**
    - Strip, in order, the letters of the word's proclitics from irab `entries` of kind `p`: الواو→و, الفاء→ف, الباء→ب, اللام→ل, الكاف→ك, الهمزة→ا, السين→س, يا→يا (ي in a rasm spelling), ها→ها or ه, التاء→ت.
    - If the last stripped proclitic is ل and the word is definite (التعريف = معرفة بأل, or the lemma starts with ٱل), restore the article alif: للناس→الناس, للذين→الذين, لله→الله.
11. **Without article (tier 1):** only when التعريف is exactly `معرفة بأل` (never for Allah or the relative pronouns, which would turn الله into a "له" form). Strip a leading ال if at least 2 letters remain (الرحمن→رحمن, الارض→ارض).
12. **Output alphabet:** only ا-غ and ف-ي, without ة, ى, ء, أ, إ, آ, ؤ or ئ. A build gate checks this for every word of all 8 words DBs; the prototype found 0 violations.

### 1.2 Query side
1. Delete U+0653 before anything else. A typed آ is the precomposed U+0622 and keeps its hamza.
2. Apply NFKC (presentation forms), convert Arabic-Indic and Persian digits to ASCII, and remove bidi and zero-width characters (as `normalizeSearchText` does).
3. Apply index steps 3-8 with the imlaei rules, so pasted Uthmani gives its imlaei spelling. Lowercase, and turn punctuation into spaces.
4. A query with any digit, or with no Arabic letter, is not a Quran query. `2:255`, `صفحة 5`, `juz 30` and Latin names keep today's behaviour.
5. Split into tokens. A standalone يا, ها or ال (typed without ء) is joined to the next token (يا أيها→ياايها, إل ياسين→الياسين; DK Hafs has no standalone يا). Cap at 24 tokens and 200 characters.
6. **Hamza-seat variants:** every ؤ or ئ in a token is also tried without its seat (مسؤولا→مسوولا | مسولا, يستهزئون→يستهزيون | يستهزون, رؤوف→رووف | روف). At most 2 seats, so at most 4 keys per token.
7. **Hamza requirement:** a token typed with a hamza only matches words that have the hamza flag. So ماء finds 59 ayahs instead of 1,745 (ما).
8. Root syntax is covered in section 4.

### 1.3 Must-match examples (all verified on the real data with the prototype)
| Query | Uthmani word / spelling used | Expected ayahs (included) |
|---|---|---|
| الصلاة | ٱلصَّلَوٰةَ (imlaei) | 2:3, 2:43 (62 ayahs) |
| الصلوة | same (rasm) | 2:3 |
| الرحمن / الرحمان | ٱلرَّحْمَٰنِ (rasm / imlaei) | 1:1, 1:3, 55:1 (56) |
| رحمن | without article | 1:1 |
| ٱلرَّحْمَٰنِ (pasted), الرَّحْمَنِ, الرحمـن, ﺍﻟﺮﺣﻤﻦ, ‏الرحمن‏ | marks, tatweel, presentation forms, RLM | 1:1 |
| الكتاب | ٱلْكِتَٰبُ (imlaei) | 2:2 first |
| هذا / ذلك | هَٰذَا / ذَٰلِكَ (rasm) | 2:25 / 2:2 |
| ذلك الكتاب | rasm + imlaei in one phrase | 2:2 only |
| مالك | مَٰلِكِ, يَٰمَٰلِكُ (يا proclitic) | 1:4, 3:26, 43:77 |
| ملك | مَٰلِكِ (rasm), مَلِكِ | 1:4, 114:2 |
| يخادعون | يُخَٰدِعُونَ | 2:9, 4:142 |
| ابراهيم / إبراهيم | إِبْرَٰهِـۧمَ, إِبْرَٰهِيمَ | 2:124 first (63) |
| السماء | ٱلسَّمَآءِ (hamza) | 2:19, 2:22 |
| شيء / شئ | شَىْءٍ | 2:20 |
| ماء | مَآءً (hamza required) | 2:22 (59 ayahs, not ما) |
| يا أيها / ياأيها | يَٰٓأَيُّهَا | 2:21 (142) |
| يا أيها الذين آمنوا | phrase | 89 ayahs, 2:104 first |
| السموات / السماوات | ٱلسَّمَٰوَٰتِ (mixed / imlaei) | 2:164, 2:255 (183) |
| القرآن / هؤلاء / أولئك | ٱلْقُرْءَانُ / هَٰٓؤُلَآءِ / أُو۟لَٰٓئِكَ | 2:185 / 2:31 / 2:5 |
| مسؤولا / مسئولا | مَسْـُٔولًا (seat variants) | 17:34 |
| رؤوف | رَءُوفٌ, لَرَءُوفٌ | 2:143, 9:117 |
| الله / والله / لله | proclitics, article restored | 1:1 first / 2:19 / 1:2 |
| الناس / للناس / للذين | | 2:8, 114:1 / 2:185 / 2:226 |
| بسم الله الرحمن الرحيم | | exactly 1:1, 27:30 |
| الحمد لله رب العالمين | | exactly 1:2, 6:45, 10:10, 37:182, 39:75, 40:65 |
| فبأي آلاء ربكما تكذبان | | 31 ayahs from 55:13 |
| بعد ما | DK split slots | 2:181, 8:6, 13:37 |
| إل ياسين / الياسين | multi-token slot | 37:130 |
| الم / كهيعص / ن والقلم | muqatta'at | 2:1 first / 19:1 / 68:1 |
| الحياة الدنيا / الزكاة / مشكاة / الربا / النبيين | waw-alif, ۧ | 2:85 / 2:43 / 24:35 / 2:275 / 2:61 |

**Known misses (documented, not in v1):** داوود (Uthmani دَاوُۥدَ gives داود), الموءودة, لأذبحنه, مئة (`مِا۟ئَةَ` gives مايه), بأيد, and pronoun suffixes on non-final words of a phrase.

**Prototype results:** 89 of 89 fixture queries pass. All 6,236 ayahs are found by pasting their first 12 or fewer DK words. 2,902 random 1-4 word Uthmani phrases are found with 0 misses. The prototype scripts are in /tmp/claude-0/-home-user-Bayaan/b400d208-815d-5932-ac11-0912e7cd503a/scratchpad/proto/ (`quranKey.mjs`, `proto2.mjs`, `queries.json`); that is a scratch folder and may be cleared.

### 1.4 Imla'i seam
- The build script takes `--imlaei <tsv>`, with one line per DK slot: `s:a:w<TAB>imla'i word`.
- Each supplied word is folded with the query rules and added as an extra tier-3 spelling (`rasmOnly=0`).
- Nothing changes at runtime or in the schema. The rebuilt file ships as `quran-search-v2.db`.
- `QURAN_TEXT_NORMALIZER_VERSION` is stored in `meta`.

## 2. (b) Index: build time, SQLite asset
**Decision:** commit `assets/data/quran-search-v1.db`, built by `npx tsx scripts/search/build-quran-search-db.ts`. Other options and why they lose:
- **Runtime build.** The prototype needs about 1 s on Node 22 with the V8 JIT, including the DB reads, and needs irab-v1.db (a 20 MB import) plus the Hafs words in memory. On Hermes this would take seconds.
- **FTS5.** It is compiled in, but:
  1. Alternative spellings cannot share one token position without a C tokenizer (FTS5 colocated tokens). With one spelling per row, «ذلك الكتاب» (rasm + imlaei) fails.
  2. We need DK slot positions for highlights.
  3. A B-tree on `forms(form)` already answers exact and prefix lookups in under 1 ms.
  
  FTS5 stays the right tool for the planned translation and tafsir search.
- **JSON in the JS bundle.** It adds about 1.1 MB raw to every OTA update. SQLite follows the irab-v1.db precedent and avoids holding 19k strings in JS.

### 2.1 Schema (format 1)
```sql
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- format, normalizer, dk_sha256, irab_sha256, content_sha256, counts, complete='1' (written last)
CREATE TABLE forms (
  form TEXT PRIMARY KEY,   -- folded spelling (quranText.ts), letters only
  postings TEXT NOT NULL   -- packed codes ascending: first absolute, then deltas; base 36; comma-separated
) WITHOUT ROWID;
CREATE TABLE roots (
  id INTEGER PRIMARY KEY,
  root TEXT NOT NULL UNIQUE,   -- exactly irab's الجذر value, e.g. 'ر ح م'
  words INTEGER NOT NULL,
  ayahs INTEGER NOT NULL
);
CREATE TABLE lemmas (
  id INTEGER PRIMARY KEY,
  root_id INTEGER NOT NULL,    -- roots.id
  lemma TEXT,                  -- exactly irab's الأصل المعجمي value; NULL = rooted words without one (109)
  words INTEGER NOT NULL,
  ayahs INTEGER NOT NULL,
  postings TEXT NOT NULL       -- packed codes, flags 0
);
CREATE INDEX lemmas_by_root ON lemmas (root_id, words DESC);
```

**Posting code:**
- `slot = verseIndex * 256 + position`, where `verseIndex` runs 0..6235 in mushaf order and `position` is the DK Hafs slot 1..128.
- `code = slot * 32 + flags`, which stays below 2^26, so plain arithmetic is safe.
- Flags:
  - bits 0-1: tier (3 = full spelling, 2 = without proclitics, 1 = without article);
  - bit 2: hasHamza;
  - bit 3: rasmOnly;
  - bit 4: reserved, 0 in v1 (later: spelling of another rewayah; the slots are shared by all 8 DBs).
- Each slot keeps only its best tier per form.
- Morphology attaches to the first DK slot of a QUL word (the «بعد» of the three split «بعد ما»), through `utils/quranWordPositions.ts`.

**Text postings, not BLOBs:** they avoid typed-array alignment and endianness pitfalls across expo-sqlite, better-sqlite3 and node:sqlite, the DB stays inspectable, and the size is about the same.

### 2.2 Build gates (the script fails on any of them)
1. Exactly 6,236 verses, and 77,432 DK words outside the markers. The order matches `verseKeyAt` (computed from `data/surahData` `verses_count`).
2. DK and QUL word counts are equal in every verse except 2:181, 8:6 and 13:37. In each of those, the extra slot is «ما» right after «بعد», at the slots in `DK_SPLIT_SLOTS`.
3. Every word yields at least one spelling, and every spelling stays inside the output alphabet. The same check runs over all 7 other words DBs (future-proofing).
4. Every irab row maps to a slot. Per-root word counts equal the stated `وروده في القرآن` counts, except the allowlisted `ء م م` (20:94 holds two stems).
5. Every fixture in `utils/search/__fixtures__/quranSearchGolden.ts` passes, and every verse is found by its first 12 or fewer DK words.
6. `meta` records the sha256 of both sources, the normaliser version, the counts, a `content_sha256` over all rows in canonical order, and `complete='1'` last.

### 2.3 Budgets (77,429 words / 6,236 ayahs)
| Item | Budget | Measured (prototype, Node 22) |
|---|---|---|
| Asset | ≤ 2 MB | 1.42 MB: 19,384 forms (204 KB text), 117,065 postings, 1,642 roots, about 50k lemma postings |
| Build | ≤ 30 s (also run in the Jest staleness test) | about 1 s including DB reads |
| First search (import + open + 1,642 roots) | ≤ 300 ms on a mid-range Android | measure on device (asset copy of 1.4 MB) |
| Each later query (SQL + join) | ≤ 50 ms p95 for ≤ 8 words | join avg 0.1-0.3 ms, max 6.4 ms; SQL ≤ 0.7 ms for the widest 3-letter prefix «وال» (482 forms) |
| First 10 rows painted | ≤ 150 ms | measure on device |
| JS memory | ≤ 3 MB | roots map + LRU of 64 decoded postings lists |
| Paging | 30 rows per page | |

Hermes is 3-6x slower than V8 for this kind of loop (search plan, line 34), so the join stays well inside budget. Prefetch: call `quranSearchDataService.initialize()` when the Search tab or mushaf search enters search mode.

## 3. (c) Query handling, v1 scope, ranking

**Pipeline (`searchQuranText`):**
1. **Lookups.** One `SELECT form, postings FROM forms WHERE form IN (...)` fetches every key of every token. The last token, if it has 3 or more letters, also gets a prefix lookup per key: `SELECT form, postings FROM forms WHERE form > ?1 AND form < ?2 LIMIT 4000`, with `?2 = key + '￿'`. BINARY UTF-8 order equals the JS code-unit order for Arabic. Results go into an LRU keyed by (exact|prefix, key).
2. **Token maps.** Each token gets a map of slot → score. Codes without the hamza bit are skipped when the token needs a hamza. Score = exact 100 or prefix 60, plus tier×10, minus 5 when `rasmOnly`.
3. **Phrase.** Start from the token with the fewest slots. A hit of token j at slot s needs every token k at slot s−j+k; slots never cross a verse because the stride is 256. The phrase score is the minimum over its tokens.
4. **Group by verse.** `hit.matches` lists the occurrences as `{position, length}`; the verse score is the maximum over its occurrences.
5. **Fallback.** If a query of 2 or more words has no phrase hit, `kind: 'allWords'` returns the ayahs where every token matches somewhere, closest span first. The UI shows a note.
6. **Sort** by score descending, then by `verseIndex`. Totals: `ayahCount` and `occurrenceCount`.

**v1 decisions:**
- **Proclitics and article.** Any query word matches with or without proclitics (و ف ب ل ك س أ يا ها ت) and with or without ال. The proclitics come from the i'rab segmentation, so there is no guessing and no junk forms such as وجه→جه. The match is asymmetric: a query word with ال only matches definite words, and a query word with و only matches words with و.
- **Prefix.** Only the last word, and only from 3 letters. This gives feedback while typing and covers pronoun suffixes in that position (كتاب finds كتابه).
- **Phrases.** Consecutive words inside one ayah.
- **Not in v1:** suffix stripping inside a phrase, typo tolerance (Quran search should be exact; the catalogue's fuzzy tier is not reused), matches across ayah boundaries, other rewayat, an imla'i text, and Latin transliteration.

## 4. (d) Root search
**Inputs:**
1. **Explicit:** `root:رحم`, `root: ر ح م`, `جذر:رحم`, matching `/^\s*(root|جذر)\s*[:：]\s*/i`. Both keywords are accepted in every UI language.
2. **Spaced letters:** 3-4 one-letter tokens (`ر ح م`) are a root query when they match a known root. 2-5 single letters that are not a root are joined into one text token (`ح م` finds حم at 40:1; `ك ه ي ع ص` finds 19:1).
3. **Suggestion:** a one-token text query of 3-4 letters also looks up root candidates. Each known candidate gives a "Root ر ح م" row above the verse results; tapping it sets the query to `root:ر ح م`.
4. **From the word view:** the irab root value is used as is (`roots.root` equals the الجذر text). An optional lemma (`lemmas.lemma` equals الأصل المعجمي) preselects a chip.

**Candidate expansion (`rootCandidates`)** uses the query folds, except:
- أ, إ, آ and ء become ء;
- ا or ٱ becomes ء, و or ي;
- ؤ becomes ء or و;
- ئ becomes ء or ي;
- ى becomes ي or و.

Only roots that exist (1,642, held in memory) are kept. Verified examples:
- رحم → ر ح م: 339 words in 313 ayahs, 9 lemmas (رَّحِيم 116, رَحْمَة 114, رَّحْمَٰن 57, رَّحِمَ 28, أَرْحَام 12);
- اله or أله → ء ل ه: 2,851;
- رأي or راى → ر ء ي: 328;
- سما → س م و: 381;
- دعا → د ع و: 212;
- قول → ق و ل: 1,722;
- شيء → ش ي ء: 519;
- أمن → ء م ن: 879;
- كتب → ك ت ب: 319, 7 lemmas.

**Lemma grouping:**
- One query loads every lemma of the root: `SELECT id, lemma, words, ayahs, postings FROM lemmas WHERE root_id = ? ORDER BY words DESC`.
- Lemma chips show "All forms 339", then each lemma with its count. Lemma text is Quranic, so it is drawn in the `Uthmani` font. The 109 words without a lemma go under an "Other forms" chip.
- Selecting a chip filters the verse list. Rows highlight the words of the root, or of the selected lemma.
- The header reads "Root ر ح م · 339 words in 313 ayahs".

## 5. New and changed APIs (TypeScript)
```ts
// utils/search/normalize.ts (extend; normalizeSearchText/toSearchKey outputs unchanged except that U+034F and U+08D3-08FF are now removed instead of becoming spaces)
export const ARABIC_MARKS: RegExp; // /[͏ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ]/g
export function foldArabicLetters(text: string): string;  // ٱأإآ→ا, ىی→ي, ک→ك, ة→ه
export function foldHamzaCarriers(text: string): string;  // ؤ→و, ئ→ي, ء→''

// utils/search/quranText.ts (@ai-generated)
export const QURAN_TEXT_NORMALIZER_VERSION = 1;
export interface QuranWordSpellings {
  imlaei: string; rasm: string; mixed: readonly string[]; hasHamza: boolean;
}
export function quranWordSpellings(uthmani: string): QuranWordSpellings;
export type QuranProclitic = 'wa' | 'fa' | 'bi' | 'li' | 'ka' | 'sa' | 'hamza' | 'ya' | 'ha' | 'ta';
export function procliticOfIrabLabel(label: string): QuranProclitic | null;
export function stripProclitics(spelling: string, proclitics: readonly QuranProclitic[], definite: boolean): string | null;
export function stripArticle(spelling: string): string | null;
export interface QuranQueryToken { keys: readonly string[]; needsHamza: boolean; }
export type ParsedQuranQuery =
  | {kind: 'none'}
  | {kind: 'text'; tokens: readonly QuranQueryToken[]; rootLetters: string | null}
  | {kind: 'root'; letters: string; explicit: boolean};
export function parseQuranQuery(query: string): ParsedQuranQuery;
export function rootCandidates(letters: string, isKnownRoot: (root: string) => boolean): string[];
export function rootQuery(root: string, keyword?: string): string; // 'root:ر ح م'

// utils/quranWordPositions.ts (@ai-generated): DK slot <-> QUL word position
export const DK_SPLIT_SLOTS: Readonly<Record<string, number>>; // {'2:181': 4, '8:6': 5, '13:37': 9}
export function dkToQulPosition(verseKey: string, dkPosition: number): number;
export function qulToDkPositions(verseKey: string, qulPosition: number): readonly number[];

// utils/search/quranIndexFormat.ts (@ai-generated)
export const QURAN_SEARCH_DB_NAME = 'quran-search-v1.db';
export const QURAN_VERSE_COUNT = 6236;
export const QURAN_TIER = {withoutArticle: 1, withoutProclitics: 2, full: 3} as const;
export interface QuranPosting { verseIndex: number; position: number; tier: 1 | 2 | 3; hasHamza: boolean; rasmOnly: boolean; }
export function packPosting(posting: QuranPosting): number;
export function unpackPosting(code: number): QuranPosting;
export function encodePostings(codes: readonly number[]): string;
export function decodePostings(text: string): number[];
export function verseKeyAt(verseIndex: number): string;       // 0 → '1:1', 7 → '2:1', 6235 → '114:6'
export function verseIndexOf(verseKey: string): number | null;

// utils/search/quranSearch.ts (@ai-generated): pure engine
export interface QuranPostingSource {
  exact(forms: readonly string[]): Promise<ReadonlyMap<string, readonly number[]>>;
  prefix(prefix: string, limit: number): Promise<ReadonlyMap<string, readonly number[]>>;
}
export interface QuranMatch { position: number; length: number; }
export interface QuranVerseHit {
  verseIndex: number; verseKey: string; matches: readonly QuranMatch[]; score: number;
}
export interface QuranTextResult {
  kind: 'phrase' | 'allWords'; hits: readonly QuranVerseHit[]; ayahCount: number; occurrenceCount: number;
}
export function searchQuranText(tokens: readonly QuranQueryToken[], source: QuranPostingSource): Promise<QuranTextResult>;
export function joinPhrase(tokenSlots: readonly ReadonlyMap<number, number>[]): QuranVerseHit[]; // exported for tests
export function matchedPositions(hit: QuranVerseHit): number[];

// services/search/QuranSearchDataService.ts (@ai-generated)
export interface QuranRoot { id: number; root: string; words: number; ayahs: number; }
export interface QuranLemma { id: number; rootId: number; lemma: string | null; words: number; ayahs: number; }
export interface RootSearchResult {
  root: QuranRoot; lemmas: readonly QuranLemma[];
  hits(lemmaId: number | null): readonly QuranVerseHit[]; // null = all forms; memoised
}
export type QuranSearchOutcome =
  | {kind: 'none'}
  | {kind: 'text'; result: QuranTextResult; rootSuggestions: readonly QuranRoot[]}
  | {kind: 'root'; letters: string; candidates: readonly QuranRoot[]; result: RootSearchResult | null};
export interface QuranSearchDb {
  getAllAsync<T>(sql: string, ...params: (string | number)[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: (string | number)[]): Promise<T | null>;
}
export interface QuranSearchDataService extends QuranPostingSource {
  initialize(): Promise<void>;
  findRoot(root: string): QuranRoot | null;        // after initialize
  rootSearch(rootId: number): Promise<RootSearchResult>;
  search(query: string): Promise<QuranSearchOutcome>;
}
export function createQuranSearchDataService(open: () => Promise<QuranSearchDb>): QuranSearchDataService;
export const quranSearchDataService: QuranSearchDataService; // expo-sqlite; imports the asset on first use, re-imports when meta.complete != '1'

// hooks/useQuranSearch.ts (@ai-generated)
export type QuranSearchState =
  | {status: 'idle'} | {status: 'searching'; previous: QuranSearchOutcome | null}
  | {status: 'done'; outcome: QuranSearchOutcome} | {status: 'error'};
export function useQuranSearch(query: string, options?: {enabled?: boolean}): QuranSearchState; // drops stale responses
export function useQuranRootSearch(root: string | null): {status: 'loading' | 'done' | 'missing' | 'error'; result: RootSearchResult | null};

// utils/search/verseSnippet.ts (@ai-generated)
export interface VerseSnippet<T extends {text: string; wordPositionInVerse: number}> {
  words: readonly T[]; cutStart: boolean; cutEnd: boolean;
  highlights: readonly {start: number; end: number}[]; // inclusive char ranges in layoutWords(words).text
}
export function verseSnippet<T extends {text: string; wordPositionInVerse: number}>(
  words: readonly T[], positions: readonly number[], maxWords?: number /* 20 */): VerseSnippet<T>;

// components/search/quran/quranResultRows.ts (@ai-generated)
export type QuranResultRow =
  | {type: 'quran-loading'; key: string} | {type: 'quran-error'; key: string}
  | {type: 'quran-header'; key: string; ayahCount: number; matchCount: number; note: 'none' | 'hafs' | 'allWords'}
  | {type: 'quran-root-suggestion'; key: string; root: QuranRoot}
  | {type: 'quran-root-header'; key: string; root: QuranRoot}
  | {type: 'quran-lemmas'; key: string; root: QuranRoot; lemmas: readonly QuranLemma[]; selected: number | null}
  | {type: 'quran-verse'; key: string; hit: QuranVerseHit}
  | {type: 'quran-more'; key: string; remaining: number}
  | {type: 'quran-empty'; key: string; query: string; root: boolean};
export function quranResultRows(state: QuranSearchState, view: {
  shown: number; selectedLemma: number | null; hafsNote: boolean; query: string; includeEmpty: boolean;
}): QuranResultRow[];

// components/search/quran/VerseHitRow.tsx, QuranResultRowView.tsx, RootLemmaChips.tsx, RootResults.tsx
interface VerseHitRowProps { hit: QuranVerseHit; label?: string; onPress: (hit: QuranVerseHit) => void; }
interface QuranResultRowViewProps {
  row: QuranResultRow; verseLabel?: (hit: QuranVerseHit) => string;
  onVersePress: (hit: QuranVerseHit) => void; onRootPress: (root: QuranRoot) => void;
  onLemmaPress: (lemmaId: number | null) => void; onShowMore: () => void;
}
interface RootResultsProps { root: string; initialLemma?: string; onVersePress: (hit: QuranVerseHit) => void; }

// SkiaVerseText.tsx (extend)
highlightRanges?: readonly {start: number; end: number}[]; // inclusive, drawn like diffBgRects
highlightColor?: string;

// store/mushafWordFlashStore.ts (@ai-generated)
export interface WordFlash { verseKey: string; positions: readonly number[]; id: number; }
export const useMushafWordFlashStore: UseBoundStore<StoreApi<{
  flash: WordFlash | null; show(verseKey: string, positions: readonly number[], ms?: number): void; clear(): void;
}>>; // default 3000 ms, like the verse flash
// components/mushaf/skia/useWordFlashHighlights.ts (@ai-generated)
export function useWordFlashHighlights(pageNumber: number, pageLines: readonly DKLine[], base: LineHighlightMap,
  textColor: string, isDarkMode: boolean): LineHighlightMap;

// services/mushaf/DigitalKhattDataService.ts (extend)
getPageForWord(verseKey: string, position: number): number | undefined; // page of that Hafs slot (verses span pages)
// utils/quranLink.ts (extend)
export function quranHitLinkParams(verseKey: string, positions: readonly number[],
  pageForWord: (verseKey: string, position: number) => number | undefined):
  QuranLinkParams & {anchor: string; words: string};
// app/mushaf.tsx MushafScreenParams (extend)
words?: string; // DK slots of Hafs verse surah:ayah to flash, comma-separated: '3,4'

// scripts/search/quranSearchIndex.ts (@ai-generated): pure builder shared by the CLI and the staleness test
export interface QuranSearchIndexInput {
  dkWords: readonly {location: string; text: string}[];
  irabRows: readonly {verseKey: string; position: number; entries: string; morph: string}[];
  irabTexts: readonly string[]; imlaei?: ReadonlyMap<string, string>;
}
export interface QuranSearchIndexContent {
  forms: ReadonlyMap<string, readonly number[]>; roots: readonly QuranRoot[];
  lemmas: readonly (QuranLemma & {codes: readonly number[]})[]; meta: Readonly<Record<string, string>>;
}
export function buildQuranSearchIndex(input: QuranSearchIndexInput): QuranSearchIndexContent; // throws on a failed gate
```

## 6. (e) UI

### 6.1 Search tab, phone (`SearchView`)
- The Quran search runs alongside the catalogue search on the same 300 ms debounced query, only when `parseQuranQuery` is not `none`. Latin queries behave exactly as today.
- If a Latin query finds nothing in the catalogue and `swapKeyboardLayout` gives Arabic, the verse search runs on the swapped text.
- Root queries skip the catalogue search.
- List data: `[catalogue rows] + quranResultRows(...)`. The `FlatList` stays (see risks), with a `kind` switch in `renderItem`.
- **Ayahs section**, in order:
  1. Header: `common:terms.ayahs` in the overline style, `textSecondary` at 0.8 alpha or more, plus "56 ayahs · 57 matches".
  2. Optional note ("Searched in the Hafs text" when another rewayah is active; the all-words note).
  3. Root suggestion rows.
  4. 30 `VerseHitRow`s.
  5. "Show 26 more", which adds 30.
- A loading row shows while the search runs (the first query also imports the DB). An error row reads "Couldn't search the Quran text."
- **Empty:** the existing full empty state appears only when the catalogue and the Quran search are both empty; for Arabic queries the hint changes to "Try fewer words or another spelling".
- **VerseHitRow:**
  - Pressable, `minHeight` 44, phone padding 16, pressed fill `text` at 0.06.
  - Header: `getSurahDisplayName` plus `localizeDigits('2:255')` in callout SemiBold, and a match-count badge when the ayah has more than one match.
  - Snippet: `useRewayahWords(verseKey, 'hafs')`, then `verseSnippet` (whole ayah up to 20 words, otherwise a window starting 5 words before the first match), drawn by `SkiaVerseText` at 22 pt in `getDkFontFamily(renderer, 'hafs')` with `highlightRanges`.
  - Highlight colour `Color(text).alpha(dark ? 0.22 : 0.25)`, the same as the recitation word band.
  - A "…" before or after a cut snippet, via `reader:quranSearch.ellipsis`, in the UI font.
  - Accessibility: `accessibilityRole="button"`, `accessibilityLabel = t('quranSearch.hitLabel', {verse, text})` using the plain DK snippet text, `accessibilityHint = t('quranSearch.hitHint')`.
- **Tap:**
  1. Save a recent item `{type: 'verse', verseKey, positions, timestamp}`. `RecentSearchItem` becomes a union; the row shows a book icon and "Al-Baqarah 2:255".
  2. Push `/mushaf` with `quranHitLinkParams(...)`: `{surah, ayah, page (page of the first matched slot), anchor 'S:A:W', words}`.
- **Root suggestion tap:** `index.tsx` gets `onQueryChange(q)`. It sets state and calls `searchBarRef.current?.setText(q)` on glass (`SearchBarCommands.setText` exists); Android's `TextInput` is controlled. The query becomes `root:ر ح م` and the list switches to root rows: root header, lemma chips, verses.
- Placeholder: "Search surahs, reciters or ayahs".

### 6.2 Search tab, iPad (`TabletSearchResults`)
- New props:
  ```ts
  quranRows: readonly QuranResultRow[];
  onQuranRowAction: Omit<QuranResultRowViewProps, 'row'>;
  ```
- A new scope `'ayahs'`: chip `common:terms.ayahs` with the ayah count.
- The All scope adds an Ayahs section after the top result and surahs: the first 4 rows plus "See all", which switches to the Ayahs scope. The Ayahs scope shows the paged list in a column of at most 680 pt (reading-text rule §4.2).
- `SearchView` renders the tablet results when `searchResults.length > 0 || quranRows.length > 0`. Root mode on iPad uses the same capped list as the phone.
- Rows are inset 24 pt below a 900 pt window and 32 pt from 900 pt, with a 12 pt pressed and hover radius. Hover comes from `useHover()`. Targets are at least 44 pt.

### 6.3 Mushaf search (`MushafSearchView`)
- `parseSearchQuery` is unchanged. A new `useQuranSearch(debouncedQuery)` uses its own 250 ms debounce, so commands stay instant.
- The `FlatList` data becomes `[command results] + quranResultRows`.
- Row labels come from the rewayah on screen:
  - Hafs: `hafsTarget` and `verseResultTexts`.
  - Another rewayah: `anchorTarget('S:A:W', shown)`, and `verseResultTexts` gives "Al-Baqarah 2:254 · Warsh". While its verse units load, the label is the Hafs key with "· Hafs".
  - The header note reads "Searched in the Hafs text".
- **Tap:**
  1. `useMushafWordFlashStore.show(verseKey, positions)`.
  2. A history entry exactly like the N:M case: a Hafs verse, or the anchor plus rewayah (`MushafSearchView.tsx:717-733`).
  3. `navigateToTarget(target)` with the page from `getPageForWord`.
- Root mode works through the typed `root:` query or the suggestion row, which calls `setSearchQuery`.
- Placeholder: "Search surahs, ayahs, pages, or juz…".
- No browse-mode changes.

### 6.4 Word view contract (for the word-view design)
- The الجذر row renders `<RootResults root={morph.root} initialLemma={morph.lemma} onVersePress={...}/>` as a sub-screen of `VerseActionsSheet`. It uses a FlashList and works from both the player and the mushaf.
- Verse taps:
  - Mushaf origin: `useMushafNavigationStore.navigateToVerse(hafsKey, page)` plus a word flash, then `SheetManager.hideAll()` (the `SimilarVersesContent.tsx:190-195` precedent).
  - Otherwise: `router.push('/mushaf', quranHitLinkParams(...))`.
- `rootQuery(root)` gives the canonical `root:` string for any surface that wants to open search instead.

### 6.5 Word flash in the mushaf
- `useWordFlashHighlights` chains after `useRecitationLineHighlights` in `SkiaPage.tsx:787` and `ContinuousMushafView.tsx:643`.
- It selects a value-comparable id only when the flashed Hafs verse is on the page (`getOrderedVerseKeysForPage`), then adds `withRecitedWordRun(..., 'band')` for each position.
- Slots keep Hafs positions in every rewayah, so the flash works on all 8 DK texts. A blank slot paints nothing.
- `app/mushaf.tsx` reads the `words` param in its flash effect (:165-212) and calls `show`. The verse selection is unchanged.
- QCF pages and the list/reading views show the verse selection only.

### 6.6 Strings
Namespace `reader` unless marked; plurals follow the CLDR categories.

| Key | en | ar |
|---|---|---|
| quranSearch.ayahCount_one / _other | {{count}} ayah / {{count}} ayahs | _zero لا آيات; _one آية واحدة; _two آيتان; _few {{count}} آيات; _many {{count}} آية; _other {{count}} آية |
| quranSearch.matchCount_one / _other | {{count}} match / {{count}} matches | _zero لا مواضع; _one موضع واحد; _two موضعان; _few {{count}} مواضع; _many {{count}} موضعًا; _other {{count}} موضع |
| quranSearch.summary | {{ayahs}} · {{matches}} | {{ayahs}} · {{matches}} |
| quranSearch.hafsNote | Searched in the Hafs text | البحث في نص رواية حفص |
| quranSearch.allWordsNote | No ayah has these words in this order. These ayahs have all of them: | لا توجد آية فيها هذه الكلمات بهذا الترتيب، وهذه آيات فيها كلها: |
| quranSearch.searching | Searching the Quran… | جارٍ البحث في القرآن… |
| quranSearch.loadFailed | Couldn't search the Quran text. | تعذّر البحث في نص القرآن. |
| quranSearch.noAyahs | No ayah contains “{{query}}” | لا توجد آية فيها «{{query}}» |
| quranSearch.noAyahsHint | Try fewer words or another spelling | جرّب كلمات أقل أو إملاءً آخر |
| quranSearch.hitLabel | {{verse}}: {{text}} | {{verse}}: {{text}} |
| quranSearch.hitHint | Opens the ayah in the Mushaf | يفتح الآية في المصحف |
| quranSearch.showMore_one / _other | Show {{count}} more | _zero لا مزيد; _one عرض آية أخرى; _two عرض آيتين أخريين; _few عرض {{count}} آيات أخرى; _many عرض {{count}} آية أخرى; _other عرض {{count}} آية أخرى |
| quranSearch.ellipsis | … | … |
| quranSearch.rootKeyword | root | جذر |
| quranSearch.rootSuggestion | Root {{root}} | الجذر {{root}} |
| quranSearch.rootSuggestionHint | Every word from this root | كل الكلمات من هذا الجذر |
| quranSearch.rootTitle | Root {{root}} | الجذر {{root}} |
| quranSearch.wordCount_one / _other | {{count}} word / {{count}} words | _zero لا كلمات; _one كلمة واحدة; _two كلمتان; _few {{count}} كلمات; _many {{count}} كلمة; _other {{count}} كلمة |
| quranSearch.rootSummary | {{words}} in {{ayahs}} | {{words}} في {{ayahs}} |
| quranSearch.allForms | All forms | كل الصيغ |
| quranSearch.otherForms | Other forms | صيغ أخرى |
| quranSearch.noRoot | No root “{{root}}” in the Quran | لا يوجد الجذر «{{root}}» في القرآن |
| quranSearch.lemmaChip (a11y) | {{lemma}}, {{words}} | {{lemma}}، {{words}} |
| home:search.placeholder (changed) | Search surahs, reciters or ayahs | ابحث عن سورة أو قارئ أو آية |
| reader:search.placeholder (changed) | Search surahs, ayahs, pages, or juz… | ابحث عن سورة أو آية أو صفحة أو جزء… |
| reader:search.emptySubtitle (changed) | Find words of the Quran, surahs, pages, or juz | ابحث عن كلمات القرآن والسور والصفحات والأجزاء |

Reused keys: `common:terms.ayahs` (section and scope title), `common:actions.showMore`, `common:status.noResults`, `home:search.noResultsHint`.

Root letters, lemmas and verse text are data, not locale strings. Digits go through `localizeDigits`. Direction uses start/end, and the chevron on the suggestion row uses `flipX`.

## 7. (f) Tests
- **Normaliser unit tables (`quranText.test.ts`):**
  - Uthmani to spellings: ٱلصَّلَوٰةَ→{الصلاه, الصلوه}; ٱلرَّحْمَٰنِ→{الرحمان, الرحمن}; ٱلْكِتَٰبُ→{الكتاب, الكتب}; هَٰذَا→{هاذا, هذا}; ذَٰلِكَ→{ذالك, ذلك}; مَٰلِكِ→{مالك, ملك}; يُخَٰدِعُونَ→{يخادعون, يخدعون}; إِبْرَٰهِـۧمَ→{ابراهيم, ابرهم}; ٱلسَّمَٰوَٰتِ→{السماوات, السموت, السموات, السماوت}; ٱلرِّبَوٰا۟→{الربا, الربوا}; يَٰقَوْمِ→{ياقوم}; يَٰٓأَيُّهَا→{ياايها}; عَلَىٰ→{علي}; ٱلْقُرْءَانُ→{القران}; مَسْـُٔولًا→{مسولا}; عَرَبِيࣰّاۚ→{عربيا} (not split); إِلْ يَاسِينَ→{الياسين}.
  - Hamza flags: مَآءً has a hamza; فَلَآ does not.
  - Proclitics and article: وَبِٱلْءَاخِرَةِ→بالاخره→الاخره→اخره; لِلَّهِ→الله; لِلنَّاسِ→الناس; Allah and ٱلَّذِينَ get no article-free form.
  - Queries: digits and Latin give `none`; يا أيها merges into one token; ماء needs a hamza; مسؤولا gives 2 keys; the root syntaxes parse; `rootCandidates` gives the outputs listed in section 4.
- **Golden table:** shared fixture file used by the build gate and Jest. It holds the section 1.3 rows plus exact counts where they are stable: 2 for بسم الله الرحمن الرحيم, 6 for الحمد لله رب العالمين, 31 for فبأي آلاء ربكما تكذبان, 89 for يا أيها الذين آمنوا. It also holds top-1 expectations (2:2 for الكتاب, 1:1 for الله, 2:124 for ابراهيم) and root rows (ر ح م 339 words, 313 ayahs, 9 lemmas, top lemma رَّحِيم 116; ك ت ب 319; ء ل ه 2,851).
- **Whole-Quran check:** every verse is found by its first 12 or fewer DK words, under 5 s in Node.
- **Freshness:** a Jest test re-runs `buildQuranSearchIndex` from the sources (better-sqlite3) and compares `content_sha256` with the committed DB's `meta`, so it fails after a normaliser or irab change that was not rebuilt. An alphabet check runs over all 8 words DBs.

## 8. Files
- **Create:**
  - Engine and data: `utils/search/quranText.ts`, `utils/search/quranIndexFormat.ts`, `utils/search/quranSearch.ts`, `utils/search/verseSnippet.ts`, `utils/quranWordPositions.ts`, `utils/search/__fixtures__/quranSearchGolden.ts`, `scripts/search/quranSearchIndex.ts`, `scripts/search/build-quran-search-db.ts`, `assets/data/quran-search-v1.db` (generated), `services/search/QuranSearchDataService.ts`, `hooks/useQuranSearch.ts`.
  - UI: `components/search/quran/{quranResultRows.ts, VerseHitRow.tsx, QuranResultRowView.tsx, RootLemmaChips.tsx, RootResults.tsx}`, `store/mushafWordFlashStore.ts`, `components/mushaf/skia/useWordFlashHighlights.ts`.
  - Docs: `docs/features/quran-search.md`.
- **Change:**
  - Search and normalisation: `utils/search/normalize.ts`, `utils/quranLink.ts`.
  - Mushaf data and display: `services/mushaf/DigitalKhattDataService.ts` (getPageForWord), `components/player/v2/PlayerContent/QuranView/SkiaVerseText.tsx`, `components/mushaf/skia/SkiaPage.tsx`, `components/mushaf/skia/ContinuousMushafView.tsx`, `app/mushaf.tsx`.
  - Search surfaces: `components/search/SearchView.tsx`, `components/search/TabletSearchResults.tsx`, `app/(tabs)/(b.search)/index.tsx`, `components/mushaf/MushafSearchView.tsx`, `components/mushaf/mushafSearchVerses.ts`.
  - Strings: `i18n/locales/{en,ar}/{reader,home}.json`.
  - Docs and notices: `THIRD_PARTY_LICENSES.md`, `docs/design/screen-inventory.md`.
  - Optional analytics: `services/analytics/events.ts`.
- **Markers:** new whole files start with `// @ai-generated`; edits to existing files use `// @ai` or `// @ai-start` / `// @ai-end`. No em dashes.

## Tasks

### T1. Shared Arabic folds + Uthmani-aware Quran normaliser

Extract ARABIC_MARKS (adding U+034F and U+08D3-08FF), foldArabicLetters and foldHamzaCarriers from normalizeSearchText/toSearchKey. Their outputs stay unchanged, except that these marks are now removed instead of splitting a word. Create utils/search/quranText.ts with quranWordSpellings (rules 1.1 steps 1-9), procliticOfIrabLabel, stripProclitics (including restoring the article alif after ل), stripArticle (only for معرفة بأل), parseQuranQuery (rules 1.2: maddah deleted before NFKC, imlaei rules for pasted text, يا/ها/ال merge, hamza-seat variants, needsHamza, digits or no Arabic letter give none, root syntax and spaced letters), rootCandidates, rootQuery, and QURAN_TEXT_NORMALIZER_VERSION.

- **Files:** `utils/search/normalize.ts`, `utils/search/quranText.ts`, `utils/search/__tests__/quranText.test.ts`, `utils/search/__tests__/normalize.test.ts`
- **Depends on:** none
- **Tests:** quranText.test.ts holds the tables in design section 7: Uthmani to spellings, hamza flags, proclitic and article stripping, query keys, merges, seat variants, the hamza requirement, root parsing and candidates. normalize.test.ts gains a case for U+08F0 inside a word (عَرَبِيࣰّا gives one token). The existing normalize.test.ts and golden.test.ts pass unchanged.

### T2. Index format codec and DK<->QUL word positions

utils/search/quranIndexFormat.ts: packPosting and unpackPosting (slot = verseIndex*256 + position; code = slot*32 + flags), encodePostings and decodePostings (delta, base 36, comma-separated), verseKeyAt and verseIndexOf built from SURAHS verses_count, and constants. utils/quranWordPositions.ts: DK_SPLIT_SLOTS for 2:181, 8:6 and 13:37, with dkToQulPosition and qulToDkPositions (the build uses them, and the word view can reuse them).

- **Files:** `utils/search/quranIndexFormat.ts`, `utils/quranWordPositions.ts`, `utils/search/__tests__/quranIndexFormat.test.ts`, `utils/__tests__/quranWordPositions.test.ts`
- **Depends on:** none
- **Tests:** Round trips for pack/unpack and encode/decode, including empty lists and large deltas. verseKeyAt(0)='1:1', verseKeyAt(7)='2:1', verseKeyAt(6235)='114:6', verseIndexOf('2:255')=261, and verseIndexOf('115:1')=null. DK<->QUL maps for 2:181 (DK 3 and 4 map to QUL 3; DK 5 maps to QUL 4), 8:6 and 13:37, and the identity elsewhere. A better-sqlite3 check that per-verse DK and QUL counts differ only in those three verses.

### T3. Build script, committed asset, licence notice, freshness test

scripts/search/quranSearchIndex.ts holds the pure buildQuranSearchIndex(input) with every gate from design section 2.2. scripts/search/build-quran-search-db.ts is the CLI (better-sqlite3): it reads digital-khatt-v2.db and irab-v1.db, takes an optional --imlaei tsv, and writes the schema from section 2.1 to assets/data/quran-search-v1.db, with meta written last. Run it and commit the DB (about 1.4 MB). utils/search/__fixtures__/quranSearchGolden.ts holds the fixture table shared by the build gate and Jest. THIRD_PARTY_LICENSES.md gets a 'Quran word search index' section: derived from Digital Khatt (OFL) and irab-v1.db (QAC GPL morphology).

- **Files:** `scripts/search/quranSearchIndex.ts`, `scripts/search/build-quran-search-db.ts`, `assets/data/quran-search-v1.db`, `utils/search/__fixtures__/quranSearchGolden.ts`, `THIRD_PARTY_LICENSES.md`, `services/search/__tests__/quranSearchDb.test.ts`
- **Depends on:** T1, T2
- **Tests:** quranSearchDb.test.ts (better-sqlite3, like services/irab/__tests__/irabDatabase.test.ts) checks that the schema and meta keys exist with complete='1' and the source sha256s match the current files. It rebuilds the index in memory from the sources and compares content_sha256 with the committed meta (stale DB means the test fails, with the rebuild command in the message). It also checks that the forms use only the folded alphabet, that there are 1,642 roots, that per-root counts equal irab's stated counts except the allowlisted ء م م, and that every word of the 7 non-Hafs words DBs normalises into the alphabet.

### T4. Pure Quran text search engine

utils/search/quranSearch.ts implements searchQuranText from design section 3: batched exact lookups, a prefix lookup on the last token when it has 3 or more letters, token slot maps with scores (exact 100 or prefix 60, plus tier×10, minus 5 for rasmOnly), the hamza filter, a phrase join anchored on the smallest token set, verse grouping with matches, the all-words fallback, the ranking, and the totals. Also joinPhrase and matchedPositions.

- **Files:** `utils/search/quranSearch.ts`, `utils/search/__tests__/quranSearch.test.ts`, `utils/search/__tests__/quranSearch.golden.test.ts`
- **Depends on:** T1, T2, T3
- **Tests:** quranSearch.test.ts uses a synthetic in-memory QuranPostingSource. It covers: phrases need consecutive slots in the same verse (no crossing at the 256 stride); exact ranks above clitic-free, above article-free, above prefix; rasmOnly gets the -5; prefix applies only to the last token and only from 3 letters; a token that needs a hamza skips codes without the hamza bit; the all-words fallback and its span ranking; ties sort in mushaf order; the 24-token cap. quranSearch.golden.test.ts runs the fixture table and the whole-Quran first-12-words check against assets/data/quran-search-v1.db through test-utils/sqliteAdapter, using the T5 factory.

### T5. QuranSearchDataService (expo-sqlite, lazy)

services/search/QuranSearchDataService.ts provides createQuranSearchDataService(open) and a default instance. The default instance imports assets/data/quran-search-v1.db on first use, the way IrabDataService does, and deletes and re-imports the copy when meta.complete is not '1'. It loads the roots into a Map at initialize, implements QuranPostingSource with an LRU of 64 entries, rootSearch (one lemmas query, memoised hits per lemma), and search(query), which wraps parseQuranQuery with the text or root paths and the root suggestions.

- **Files:** `services/search/QuranSearchDataService.ts`, `services/search/__tests__/QuranSearchDataService.test.ts`
- **Depends on:** T2, T3, T4
- **Tests:** The factory runs on the real asset with test-utils/sqliteAdapter. Checks: search('الحمد لله') returns 23 ayahs with 1:2 first; search('root:رحم') returns 9 lemmas and hits(null) covers 313 ayahs; search('رحم') returns a text result with a ر ح م root suggestion; search('2:255') and search('husary') return none; the LRU avoids a second SQL call (spy on getAllAsync); an incomplete copy (fake opener whose meta lacks complete) triggers the re-import path.

### T6. useQuranSearch hook and the shared row model

hooks/useQuranSearch.ts: useQuranSearch(query, {enabled}) returns idle, searching (keeping the previous outcome), done or error, and drops stale responses by request id. useQuranRootSearch(root) serves the word view. components/search/quran/quranResultRows.ts maps a state and the view options to QuranResultRow[]: header with counts and note, root suggestions, root header and lemma chips, verses sliced by `shown`, more, empty, loading, error.

- **Files:** `hooks/useQuranSearch.ts`, `hooks/__tests__/useQuranSearch.test.tsx`, `components/search/quran/quranResultRows.ts`, `components/search/quran/__tests__/quranResultRows.test.ts`
- **Depends on:** T4, T5
- **Tests:** Hook (data service mocked): Latin, digit and empty queries stay idle with no service call; an older slow response arriving after a newer one is ignored; an error becomes the error state. Row model: header counts; the hafs note only when asked; the all-words note; 30-row paging and remaining counts; root mode orders header, chips, then verses; a selected lemma filters hits; the empty row only when includeEmpty.

### T7. Result row components: VerseHitRow, row view, lemma chips, RootResults; SkiaVerseText highlights

SkiaVerseText gains optional highlightRanges and highlightColor props, drawn like diffBgRects with getRectsForRange. utils/search/verseSnippet.ts builds the window of at most 20 words around the matches and their character ranges from layoutWords. Components:
- VerseHitRow: Hafs words from useRewayahWords, Skia snippet in the DK Hafs font at 22 pt, header with match badge, ellipsis via i18n, accessibility label and hint, useHover, minHeight 44, tablet insets.
- QuranResultRowView: renders every row type.
- RootLemmaChips: chips like the TabletSearchResults scope chips, lemma text in the Uthmani font, accessibilityRole tab with selected state.
- RootResults: a standalone FlashList for the word view sheet.
All new reader strings in en and ar.

- **Files:** `components/player/v2/PlayerContent/QuranView/SkiaVerseText.tsx`, `utils/search/verseSnippet.ts`, `utils/search/__tests__/verseSnippet.test.ts`, `components/search/quran/VerseHitRow.tsx`, `components/search/quran/QuranResultRowView.tsx`, `components/search/quran/RootLemmaChips.tsx`, `components/search/quran/RootResults.tsx`, `components/search/quran/__tests__/VerseHitRow.test.tsx`, `components/search/quran/__tests__/RootResults.test.tsx`, `i18n/locales/en/reader.json`, `i18n/locales/ar/reader.json`
- **Depends on:** T2, T6
- **Tests:** verseSnippet on real DK words (2:282 with 128 words: window, cutStart and cutEnd; 1:1 whole; highlights equal the layoutWords spans of the matched slots; a multi-token slot such as 37:130:3 is highlighted whole). VerseHitRow with SkiaVerseText mocked: the header text, the accessibility label containing the snippet text, onPress receives the hit, highlightRanges are passed. RootResults with useQuranRootSearch mocked: chips render the counts, tapping a lemma filters rows, the missing state shows noRoot. The i18n locale tests (npx jest i18n/) and npm run i18n:check pass.

### T8. Word flash on Digital Khatt pages + /mushaf words param + page of a slot

store/mushafWordFlashStore.ts holds show(verseKey, positions, 3000 ms) and clear, with one module-level timer. components/mushaf/skia/useWordFlashHighlights.ts selects the flash only when its Hafs verse is on the page, then adds withRecitedWordRun bands in the recitation word colour. Chain it after useRecitationLineHighlights in SkiaPage.tsx:787 and ContinuousMushafView.tsx:643. Add DigitalKhattDataService.getPageForWord(verseKey, position): start at getPageForVerse and scan at most 3 pages of lines. In app/mushaf.tsx, add the `words` param to MushafScreenParams and call show() in the flash effect (:165-212), clearing it on unmount. Add quranHitLinkParams to utils/quranLink.ts.

- **Files:** `store/mushafWordFlashStore.ts`, `components/mushaf/skia/useWordFlashHighlights.ts`, `components/mushaf/skia/SkiaPage.tsx`, `components/mushaf/skia/ContinuousMushafView.tsx`, `services/mushaf/DigitalKhattDataService.ts`, `app/mushaf.tsx`, `utils/quranLink.ts`, `components/mushaf/skia/__tests__/useWordFlashHighlights.test.ts`, `components/mushaf/__tests__/MushafScreenAnchorFlash.test.tsx`, `utils/__tests__/quranLink.test.ts`, `services/mushaf/__tests__/DigitalKhattDataService.test.ts`
- **Depends on:** T2
- **Tests:** Hook (pattern of recitedWord.test.ts): runs land on the right line and character span for the flashed slots; nothing changes for other pages, and the base map identity is kept; the flash clears after 3 s with fake timers. MushafScreenAnchorFlash: words='3,4' with surah and ayah calls show('S:A', [3,4]) and clears on unmount. quranLink: quranHitLinkParams gives anchor 'S:A:W' for the first slot and the page of that slot. DigitalKhattDataService: getPageForWord returns the second page for a late slot of a verse that spans two pages (2:282) and undefined before initialisation.

### T9. Search tab: Ayahs section, root mode, recents, iPad scope

SearchView: run useQuranSearch on the debounced query; skip the catalogue for root queries; use the keyboard-swap fallback for Latin queries with no catalogue hit; append quranResultRows to the list data; manage paging and the selected lemma (reset on query change); tapping a verse saves a 'verse' recent item and pushes /mushaf with quranHitLinkParams; the root suggestion calls onQueryChange(rootQuery(root)); show the tablet branch when there are catalogue or quran rows; use the Quran empty hint for Arabic queries; new section headers at 0.8 alpha or more. index.tsx: pass onQueryChange (setQuery plus searchBarRef.setText) and change the placeholder value. TabletSearchResults: quranRows and onQuranRowAction props, an 'ayahs' scope chip with its count, an All-scope Ayahs section (4 rows plus See all), and the Ayahs scope in a 680 pt column.

- **Files:** `components/search/SearchView.tsx`, `components/search/TabletSearchResults.tsx`, `app/(tabs)/(b.search)/index.tsx`, `i18n/locales/en/home.json`, `i18n/locales/ar/home.json`, `components/search/__tests__/TabletSearchResults.test.tsx`, `components/search/__tests__/SearchView.quran.test.tsx`
- **Depends on:** T6, T7, T8
- **Tests:** TabletSearchResults.test.tsx (extended; quranRows defaults to [] so the existing cases keep passing): the Ayahs chip shows its count; All shows the Ayahs section with See all, which switches scope; the Ayahs scope lists every row. SearchView.quran.test.tsx (with useQuranSearch, the catalogue, expo-router and AsyncStorage mocked): an Arabic query renders catalogue rows, then the Ayahs header, then verse rows; a Latin query renders no Ayahs section and leaves the quran search disabled; a root query hides catalogue rows; tapping a verse pushes /mushaf with surah, ayah, page, anchor and words, and stores a verse recent; the empty state appears only when both are empty. Manual: the phone layout is unchanged for Latin queries.

### T10. Mushaf search: Ayahs section, rewayah-aware labels, history, word flash

MushafSearchView: useQuranSearch with a 250 ms debounce on searchQuery (commands stay synchronous); append quranResultRows to the FlatList data; row labels in the shown rewayah via a new hitTarget helper in mushafSearchVerses.ts (hafsTarget, or anchorTarget('S:A:W', shown), falling back to the Hafs key with a Hafs label); the Hafs note when the shown rewayah is not Hafs. On tap: flash the words, add a history entry like the N:M case, and call navigateToTarget with the page from getPageForWord. The root suggestion sets the query. Change the placeholder and empty-subtitle values.

- **Files:** `components/mushaf/MushafSearchView.tsx`, `components/mushaf/mushafSearchVerses.ts`, `i18n/locales/en/reader.json`, `i18n/locales/ar/reader.json`, `components/mushaf/__tests__/MushafSearchView.units.test.tsx`, `components/mushaf/__tests__/mushafSearchVerses.test.ts`
- **Depends on:** T6, T7, T8
- **Tests:** mushafSearchVerses.test.ts: hitTarget with Hafs on screen gives the Hafs target; with Warsh on screen and units ready it gives the unit holding the slot (fixture units), and null while the units load. MushafSearchView.units.test.tsx (useQuranSearch mocked): an Arabic query shows verse rows after the command rows; with Hafs on screen a tap calls onNavigateToVerse(hafsKey, page) and stores {type:'verse', surahId, verse}; with Warsh on screen it calls onNavigateToVerse(unitKey, page, 'warsh') and stores the anchor and rewayah; the flash store receives the positions; 'page 5' and '2:255' do not enable the quran search.

### T11. Docs, inventory, optional analytics

docs/features/quran-search.md covers the rules, the asset format, the rebuild command, the imla'i and rewayat seams, the known misses and the budgets. Add rows to docs/design/screen-inventory.md for Search › Ayahs and Root results. Optional: SearchPerformedProps gains surface ('search_tab' | 'mushaf') and kind ('catalog' | 'quran_text' | 'quran_root'), fired once per completed Quran search; update docs/features/analytics.md.

- **Files:** `docs/features/quran-search.md`, `docs/design/screen-inventory.md`, `services/analytics/events.ts`, `docs/features/analytics.md`
- **Depends on:** T9, T10
- **Tests:** npx tsc --noEmit, npm run lint, npx prettier --check, npm run i18n:check; analytics unit tests (if present) still pass with the optional fields.

### T12. Device verification and UI review

On a mid-range Android device and an iPad, profile against the budgets in section 2.3: first search including the import, p95 query, first rows painted, memory. Walk the fixture queries on both surfaces, in Hafs and Warsh, and in Mushaf 1440 (QCF: verse selection only). Check RTL in the Arabic UI, VoiceOver labels, Dynamic Type growth, and hover on iPad. Attach the screenshots the UI review checklist requires (iPad Pro portrait and landscape, iPad mini, an unchanged iPhone shot for a Latin query, a dark theme shot).

- **Files:** `docs/features/quran-search.md`
- **Depends on:** T9, T10, T11
- **Tests:** Manual plus profiler. Record the numbers in the PR. If p95 is over budget, raise the LRU size, move initialize() earlier (on focus), or lower the page size.

## Risks

- The imla'i spelling is approximated by rules. Some typed spellings won't match: داوود, الموءودة, لأذبحنه, مئة, بأيد, and pronoun suffixes on non-final words of a phrase. Rasm and article-free forms also add some false positives (الكتب finds ٱلْكِتَٰبُ; ملك finds مَلِك, مُلْك and مَلَك). Mitigations: ranking (rasmOnly −5, exact before stripped), the golden table, and the --imlaei seam.
- Dropping ء everywhere (needed so typed and Uthmani hamza seats agree) merges some words. The hamza-required rule stops a typed ماء from matching ما. A query typed without hamza still matches every hamza homograph (ما finds ماء as well), which slightly inflates counts.
- Proclitic stripping and the root and lemma data depend on the irab-v1.db segmentation. Rebuilding irab without rebuilding the search DB would desync them; the freshness test (content_sha256 plus source sha256s) is the guard.
- One word with two stems (20:94 يَبْنَؤُمَّ) indexes only its main stem's root. Root ء م م therefore shows 118 words while the word view's morphology says «١١٩ مرة», a visible mismatch.
- DK slots differ from QUL in 2:181, 8:6 and 13:37. Highlights use DK slots and the word view uses QUL positions. The mapping table is verified by a build gate, but any future DK or QUL data change must update it.
- Each verse row renders a Skia paragraph. Very common words (الله: 1,826 ayahs) depend on paging (30 rows) and FlatList virtualisation. Hermes timings are not measured yet (the prototype ran on V8).
- SearchView and MushafSearchView keep their FlatLists to keep the diff and the existing tests small. CONTRIBUTING prefers FlashList, so reviewers may ask for a migration.
- Setting the native iOS 26 search bar text programmatically (searchBarRef.setText for the root suggestion) may not fire onChangeText. index.tsx must also set its own state, and this needs checking on device.
- Results show the Hafs text even when another rewayah is on screen. Spellings unique to another rewayah are not found in v1, which may surprise Warsh readers given how much the user cares about readings.
- The word flash is painted on Digital Khatt pages only. Mushaf 1440 (QCF) and the list and reading views get the 3-second verse selection, not the word.
- First use imports a 1.4 MB file into the documents folder (storage duplicated with the bundle). A kill during the import is handled by meta.complete, but this path is only covered by a fake-opener test.
- Licensing: the index derives from Digital Khatt (OFL) and Quranic Arabic Corpus morphology (GPL, already shipped in irab-v1.db). It needs its own THIRD_PARTY_LICENSES.md entry.

## Open questions (answered in README.md)

- Should text search also match the other 7 rewayat's spellings (reserved flag bit 4, forms built from dk_words_<id>.db slot texts), so that a hit on, say, Warsh's يُخَٰدِعُونَ at 2:9:6 is labelled 'in Warsh'? This would tie search to product decision 3. It is designed as a seam, not built.
- Default order: relevance tiers then mushaf order (proposed), or always mushaf order with an 'exact form only' toggle?
- Is the 'all words in one ayah' fallback wanted in v1, or should a phrase with no exact hit just show the empty state?
- Last-word prefix matching from 3 letters (proposed). Should it need 4 letters, or an explicit '*', to cut noise such as الم returning 1,075 ayahs?
- Search tab recents: store the opened verse (proposed, matches today's 'things you opened' semantics), or the query text so it can be re-run?
- Word view: show root results inside the VerseActionsSheet (proposed, works from the player and the mushaf), or jump to the mushaf search with a root: query?
- Root counts: show irab's stem counts (ء م م 119) or our word counts (118)? Proposed: word counts, plus a note in docs/features/quran-search.md.
- Typo tolerance and Latin transliteration search of verses (e.g. 'bismillah') are out of v1. Should they be planned with the meaning and translation search work (FTS5)?
- Which imla'i text (if any) should feed the --imlaei seam once a source is chosen? Its licence needs the same check as the gharib and rasm sources.
