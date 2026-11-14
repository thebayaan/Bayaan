<!-- @ai-generated -->
# Surah app vs Bayaan: feature gap list

**Date:** 2026-11-14
**Baseline:** `develop` at `b0a151ce` (includes #495 i'rab, #505 recitation, and #513, which removed the unfinished Hifz screens)
**Scope:** features only. Where content would come from (data sources, licences) is out of scope.
**Surah:** "Surah – Quran with Tafsir" (iOS id1615829761, surahapp.com, web.surahapp.com), by the Tafsir Center for Quranic Studies. Its content is all rights reserved, and nothing here copies it.

This lists every Surah feature we know of and checks each one against Bayaan's `develop`. Study content comes first, then everything else. Each row says what Bayaan has today, with file evidence, what is missing, and where the feature would fit in Bayaan's existing UI.

**Status key**

- **Has**: a user on a `develop` build can do it today.
- **Partial**: some of it is there, e.g. English only, no view of its own, or data shipped without UI. "Inside tafsir text only" means the content shows up only as passages inside a general tafsir.
- **In progress**: not on `develop`, but code exists on an unmerged branch or PR, or was merged and then pulled back.
- **Missing**: nothing on `develop` and no code in progress. If a plan doc exists, the row names it.

## Summary

Of 79 Surah features, Bayaan has 33, has part of 22, has 3 in progress and is missing 21.

**Biggest gaps in study content**

1. **Al-Mukhtasar tafsir is missing.** It is one of Surah's two headline tafsirs, and Surah also uses it for tafsir search and for surah objectives. Bayaan's 20-edition catalogue has Muyassar, Ibn Kathir, Sa'di, Baghawi, Tabari, Qurtubi and Wasit, but not al-Mukhtasar.
2. **Word level is the thinnest area.** Bayaan has word i'rab and morphology (#495), English meanings and word audio. It has no Arabic gharib, rasm, pictures or places, and no per-word readings view (only whole-mushaf rewayah switching with tinted differences). There is also no single word view: `WordDetailSheet` and the I'rab word card are separate, and a tap on a word on a mushaf page opens neither.
3. **Ayah level is missing several dedicated views.** There is no asbab al-nuzul view and no ayah virtues (both appear only inside Ibn Kathir's text). There is no explanation of the ayah's tajweed rules (colours only), no fawa'id, and no video reflections.
4. **Surah level is English prose behind audio menus.** "About {surah}" has names, period of revelation and themes in English, but it is reachable only from audio surfaces, never from the Surahs tab or the reader. There is no Arabic, and no structured names, virtues, objectives, Makki/Madani study or comparison of the ayah-counting schools.
5. **Page benefits and the topic index are missing.** QUL passage themes exist per verse and as highlighting, but there is no category tree.

**Biggest gaps elsewhere**

1. **Search the Quran text by word is missing.** Search matches only surah and reciter names, and the mushaf search parses only references such as "2:255", "page 5" and "juz 30". Root, meaning and tafsir search are missing too. Full-text search exists only as "Phase 2" of the search overhaul plan.
2. **Plans:**
   - Memorization plans: pulled back from `develop` by #513.
   - Reading plans / khatma: missing.
   - Worksheets: missing.
   - Statistics: recorded on the device but never shown.
   - Reminders and notifications: missing.
3. **Account and sync are in progress only on unmerged `feature/qf-integration`,** as a Quran.com login, not Apple/Google sign-in. Nothing on `develop`.
4. **Smaller gaps:**
   - No highlights list.
   - No PDF sharing, and no choice of what to include when sharing.
   - No per-item "report a mistake".
   - Feature requests are an external link.
   - Reading: no auto-scroll, no hizb index (juz only), no vowel-mark colouring.
   - No desktop app.

**Where Bayaan is already ahead of what Surah lists:**
- 224 reciters in the bundled fallback list, against Surah's 60+.
- Tasmee' with mistake marks and practice (iOS).
- 8 rewayat in the mushaf.
- I'rab for every word, plus two classical i'rab books.
- Similar verses and shared phrases.
- 117 downloadable translations.

### Changes since the brief

- **`develop` has moved:** it is at `b0a151ce`, not `52508d94`.
  - Recitation PR #505 is merged: follow-along with mistake marks, practice, "Which ayah?" and recite-to-search (all iOS, Hafs).
  - #513 then removed the unfinished Hifz screens (plan, setup, page heatmap, history, quiz, similar-ayat drill). Their code is readable at `387d7f74`.
- **Things the brief listed "to check" that Bayaan already has:**
  - i'rab of all of an ayah's words in one view
  - two-page landscape on tablets
  - vertical scrolling
  - a quick navigator
  - voice search (iOS)
  - a web app (the separate repo thebayaan/bayaan-web)
- **Things the brief listed "to check" that turned out missing or partial:**
  - word search of the Quran text
  - root search (roots are shown per word, not searchable)
  - meaning search
  - auto-scroll
  - a hizb index
  - Apple/Google sign-in (only a Quran.com login, unmerged)

## Where the gaps would go in Bayaan's UI

- **Verse actions sheet** (`components/sheets/VerseActionsSheet.tsx`, `ActiveScreen` union at :103):
  - New screens next to Tafseer and I'rab: asbab al-nuzul, the ayah's tajweed rules, per-word readings (qira'at + tawjih), fawa'id.
  - A "Report a mistake" action and a share button in the sub-screen header.
  - Al-Mukhtasar needs only one more entry in `data/availableTafaseer.ts`.
- **Word view** (`components/sheets/WordDetailSheet.tsx`):
  - Make it the single word hub: i'rab and morphology from `services/irab`, Arabic gharib, rasm, readings, places, pictures.
  - Open it from a word tap on mushaf pages (`components/mushaf/skia/SkiaPage.tsx:647`), which today opens nothing.
- **About {surah}** (`components/sheets/SurahOptionsSheet.tsx:158`, copy-pasted into `PlayerOptionsSheet`, `DownloadOptionsSheet` and `UploadOptionsSheet`):
  - Extract it into one component.
  - Open it from the mushaf header and the Surahs tab.
  - Give it structured sections: names, virtues, objectives, Makki/Madani, counting schools.
- **Mushaf reader:**
  - A page-level sheet from the reader chrome (`components/mushaf/main.tsx`, `app/mushaf.tsx`) for page benefits.
  - An auto-scroll control.
  - Hizb and quarter rows in `components/mushaf/MushafSearchView.tsx`.
  - Vowel-mark colouring and a tajweed legend in Mushaf settings (`components/MushafSettingsContent.tsx`).
- **Search** (`components/search/SearchView.tsx`, `utils/search/catalog.ts`, `components/mushaf/MushafSearchView.tsx`):
  - Verse text search first, then root, meaning and tafsir scopes.
  - A Topics tile in Explore (`components/search/ExploreView.tsx`).
- **Collection tab** (`app/(tabs)/(c.collection)/index.tsx`): a Highlights list and a Stats/Activity entry.
- **Home** (`homeRowConfig`, `config/branding.js:39`): the memorization (Hifz) card back, and a khatma / reading-plan card.
- **Settings** (`components/settings/settingsItems.ts`):
  - Notifications, Account (`feature/qf-integration`), and Back up & restore.
  - An in-app suggestions screen behind "Feature Requests".

## Study content

### Word level

| Surah feature | Level | Bayaan status + evidence | What's missing | Where it fits in Bayaan's UI |
|---|---|---|---|---|
| Word i'rab (`eerab-word`) | Word | **Has.** Verse actions › I'rab › Words: tap a word for its Arabic i'rab (all 77,429 Hafs words), with alternatives (وجه آخر) and an "agreed" mark.<br>`components/sheets/verse-actions/IrabContent.tsx:206`, `services/irab/IrabDataService.ts:63` | Reached only through the verse sheet: a tap on a word on a mushaf page doesn't open it, and `WordDetailSheet` doesn't link to it. Hafs only. | Already the `irab` screen of `VerseActionsSheet` (`components/sheets/VerseActionsSheet.tsx:867`); also link it from the word view (see "One word view"). |
| Word morphology (`word-tasreef`) | Word | **Has.** A "Morphology (ṣarf)" table on every word card: part of speech, root, lemma, wazn (verbs), voice, person, case/mood, number/gender, derivation, occurrence counts.<br>`components/sheets/verse-actions/IrabContent.tsx:386`, `services/irab/irabFormat.ts:82` | Nouns get no wazn of their own and there is no conjugation table. The table is hidden in whole-verse mode. | Already in the I'rab word card (`IrabContent.tsx:386`). |
| Word root and its occurrences | Word | **Partial.** The morphology table names the root (الجذر) and lemma, with Quran-wide counts. 49,967 words carry a root (1,642 roots).<br>`components/sheets/verse-actions/IrabContent.tsx:386`, `scripts/irab/sarf.ts:333` | The root is plain text: nothing lists its other occurrences, and there is no root search. | A tappable root row opening an occurrences screen next to `phrases` in `VerseActionsSheet` (`:103`). Root search is in the Search section below. |
| Readings of each word (`word-qeraat`) | Word | **Partial.** The whole mushaf can switch to 7 non-Hafs rewayat. "Show Differences" (on by default) tints words read differently from Hafs, with a legend.<br>`components/MushafSettingsContent.tsx:1451`, `services/mushaf/RewayahDiffService.ts:341` | No per-word readings view: a word's variants and their readers are never listed together. Only one rewayah is compared with Hafs at a time, and 4 of the 10 readers are covered. | A `readings` screen next to `irab` in `VerseActionsSheet` (`:103`), also opened by tapping a tinted word on the page (`components/mushaf/skia/SkiaPage.tsx:647`). |
| Explanation of the readings (`tawjih-qiraat`) | Word | **Partial.** The I'rab Books tab (al-'Ukbari, al-Nahhas) often explains variant readings inside its verse passages (e.g. 1:4 مَلِك / مالك).<br>`components/sheets/verse-actions/IrabContent.tsx:446` | Nothing per reading or per word: the explanation sits inside verse-level book pages, Arabic only, mixing canonical and shadh readings. | Per-reading notes in the readings screen above, linking to the passage in the Books tab (`IrabContent.tsx:446`). |
| Word rasm (`wordrasm`) | Word | **Missing.** Text is Uthmani (DigitalKhatt/QPC) or IndoPak only. There is no imla'i form and no rasm notes. | The imla'i spelling and rasm notes (deleted, added or substituted letters, joined and separated words). | A rasm row in the word view (`components/sheets/WordDetailSheet.tsx`) or the I'rab word card (`IrabContent.tsx:206`). |
| Pictures that explain words (`word-pic`) | Word | **Missing.** No word images anywhere. | Images for selected words (animals, plants, objects). | An image block in the word view (`WordDetailSheet.tsx`). |
| Places in the Quran (`amaaken-words`) | Word | **Missing.** The morphology only labels such names اسم علم (proper noun). | Place information, locations, and a list of places. | A place card in the word view, plus a "Places" tile in Search › Explore (`components/search/ExploreView.tsx`). |
| Arabic word meanings / gharib (`meaning-word`) | Word | **Missing.** Words have only an English gloss, and the Arabic tafsirs work per verse. In the Arabic UI the word sheet shows no meaning by default, because the English gloss is off there. | An Arabic explanation of unfamiliar words. | An Arabic meaning line in `WordDetailSheet.tsx` and in the I'rab word card. |
| English word meaning | Word | **Has.** An English gloss for every Hafs word (`data/wbw/wbw-en.db`), shown in Verse actions › Word by Word, in the list-view and player readers when Word by Word is on, and in `WordDetailSheet`.<br>`services/wbw/WBWDataService.ts:64`, `components/sheets/WordDetailSheet.tsx:185` | Not shown on mushaf page views, and off by default in the Arabic UI. | Already in `components/sheets/verse-actions/WBWContent.tsx` and `WordDetailSheet.tsx`, with the toggle in Mushaf settings › Word by Word (`components/MushafSettingsContent.tsx:1114`). |
| Play a single word | Word | **Has.** Long-press a word in the word-by-word grid (list view or player) to open `WordDetailSheet`, then Play (streamed).<br>`components/sheets/WordDetailSheet.tsx:83` | Not available from mushaf page views or the Verse-actions word grids. Needs list view with Word by Word on, and streams only. | Already in `WordDetailSheet.tsx:192`; a Play action could be added to word selection in `WBWContent` and `IrabContent`. |
| One word view with all word content (Surah's word page) | Word | **Partial.** Two separate views: `WordDetailSheet` (Arabic, transliteration, English, audio; long-press in list view) and the I'rab word card (i'rab and morphology, reached through the verse sheet).<br>`components/sheets/WordDetailSheet.tsx:173`, `components/sheets/verse-actions/IrabContent.tsx:206` | The two don't link to each other, and a tap on a word on a mushaf page opens neither. No readings, places, pictures or rasm. | Grow `WordDetailSheet` into the word hub (i'rab and morphology from `services/irab/IrabDataService.ts`, later readings, rasm, places, pictures) and open it from a word tap on the page (`SkiaPage.tsx:647`). |

### Ayah level

| Surah feature | Level | Bayaan status + evidence | What's missing | Where it fits in Bayaan's UI |
|---|---|---|---|---|
| Tafsir Ibn Kathir (`tafsir-katheer`) | Ayah | **Has.** The Arabic Ibn Kathir (Quran.com id 14) is downloadable. The English Ibn Kathir (Abridged) is pre-installed and is the default in every UI language.<br>`data/availableTafaseer.ts:77`, `services/tafseer/TafseerDbService.ts:322` | The Arabic edition is the full text, not abridged, and needs a download plus a manual switch. | Already in Verse actions › Tafseer (`components/sheets/verse-actions/TafseerContent.tsx`); downloads in Settings › Translations › Tafaseer (`components/screens/TranslationsContent.tsx`). |
| Tafsir al-Sa'di (`tafsir-saadi`) | Ayah | **Has.** Arabic (id 91) and Russian (id 170) editions, downloadable.<br>`data/availableTafaseer.ts:127` | Not pre-installed. | Same as Ibn Kathir. |
| Al-Mukhtasar fi al-Tafsir (`tafsir-mokhtasar`) | Ayah | **Missing.** Not in the 20-edition catalogue, not bundled, and on no branch.<br>`data/availableTafaseer.ts` | The whole edition, one of Surah's two headline tafsirs. The Arabic UI labels the English Ibn Kathir "تفسير ابن كثير (مختصر)"; that is not al-Mukhtasar. | One more entry in `data/availableTafaseer.ts`; it then appears in the Tafaseer tab and the Tafseer picker (`TafseerContent.tsx`). |
| Al-Tafsir al-Muyassar | Ayah | **Has.** Arabic, id 16, downloadable.<br>`data/availableTafaseer.ts:37` | Not bundled; the English Ibn Kathir stays the default. | Same as Ibn Kathir. |
| Further tafsirs Surah names (Baghawi, Tabari, `w-moyassar`) | Ayah | **Partial.** Baghawi (id 94) and Tabari (id 15) are downloadable, as are al-Qurtubi and al-Wasit.<br>`data/availableTafaseer.ts:87`, `data/availableTafaseer.ts:147` | Nothing matches `w-moyassar`. If that turns out to be al-Muyassar itself, this row is Has. | Catalogue entries in `data/availableTafaseer.ts`. |
| Change tafsir | Ayah | **Has.** A picker over downloaded editions in the Tafseer screen, and a manager for 20 editions in 6 languages. Read offline from SQLite.<br>`components/sheets/verse-actions/TafseerContent.tsx:256` | No side-by-side comparison (Surah doesn't list one either). | Already in `TafseerContent.tsx:256` and `TranslationsContent.tsx`. |
| Ayah i'rab from a book (`eerab-aya`) | Ayah | **Has.** I'rab › Classical books: the ayah's passages from al-'Ukbari's التبيان في إعراب القرآن and al-Nahhas's إعراب القرآن, offline, for 6,127 of 6,236 ayahs.<br>`components/sheets/verse-actions/IrabContent.tsx:446`, `assets/data/irab-v1.db` | Different books (not النهج القويم). Passages are whole book pages, and 109 ayahs have none (mostly al-Shu'ara and al-Saffat). | Already in the Books tab of `IrabContent.tsx`. |
| I'rab of every word of the ayah in one view (`eerab-word-aya`) | Ayah | **Has.** I'rab › Words › "Whole verse" lists every word's i'rab in one scroll.<br>`components/sheets/verse-actions/IrabContent.tsx:101` | The morphology table is hidden in that mode. | Already in `IrabContent.tsx` (toggle at :323). |
| Asbab al-nuzul (`ayat-nozool`) | Ayah | **Partial, inside tafsir text only.** No asbab feature. The pre-installed English Ibn Kathir reports occasions of revelation inside its commentary (about 10 explicit headings, 126 passages saying "revealed about…"), and so do the downloadable Arabic tafsirs.<br>`data/ibn-kathir-tafseer-compact.json`, `services/AppInitializer.ts:433` | A dedicated per-ayah view from a curated book, shown only on ayahs that have an occasion. Nothing marks which ayahs have one. | A new `asbab` screen in `VerseActionsSheet` (`:103`) with a row beside Tafseer (`:1072`), shown only when the ayah has an entry. |
| The ayah's tajweed rules explained (`tajweed-aya`) | Ayah | **Partial.** Tajweed colouring from per-letter data with 19 rule classes, on pages and in the word grids. The rule names never reach the user.<br>`utils/tajweedLoader.ts:38`, `constants/tajweedColors.ts:2` | No legend, no tap-to-explain, and no per-ayah list of the rules in its words. A colour legend (with no per-ayah list) exists only on the unmerged `claude/mushaf-options-redesign`. | A `tajweed` screen in `VerseActionsSheet` next to `wbw`/`irab` that reuses the per-letter rule map, plus a legend by the Tajweed toggle (`components/MushafSettingsContent.tsx:1377`). |
| Virtues of specific ayahs | Ayah | **Partial, inside tafsir text only.** The pre-installed English Ibn Kathir has virtue sections with hadith (e.g. "The Virtue of Ayat Al-Kursi" at 2:255; 81 virtue headings across 47 surahs), plus a few adhkar notes.<br>`data/ibn-kathir-tafseer-compact.json` | A dedicated, curated virtues section, discoverable from the ayah. English only unless an Arabic tafsir is downloaded. | A virtues block in `VerseActionsSheet` (`:103`); surah virtues go in About {surah} (see Surah level). |
| Benefits per ayah (`fwaed_qassim`) | Ayah | **Missing.** The nearest things are the QUL passage-theme titles (Theme screen) and the Community Reflections row, which is off because no provider is configured.<br>`components/sheets/VerseActionsSheet.tsx:1143`, `config/branding.js:53` | Short lessons (fawa'id) per ayah. | A `benefits` screen in the Explore card of `VerseActionsSheet`, next to the gated Community Reflections row (`:1143`). |
| Video reflections (`taamolatvideo`) | Ayah | **Missing.** No video anywhere and no video player dependency. Moments (draft PR #387) is audio clips. | Reflection videos per ayah, and a video player. | A video screen in `VerseActionsSheet`, or video cards in the Moments feed if #387 lands. |
| Translations and changing translation | Ayah | **Has.** Two bundled English translations (Saheeh International with footnotes, The Clear Quran) and 117 downloadable editions in 48 languages. The Translation screen stacks the installed ones.<br>`data/availableTranslations.ts`, `components/sheets/verse-actions/TranslationContent.tsx` | Footnotes for Saheeh only. Editions with footnotes come with the translations engine on the unmerged `feature/qf-integration`. | Already in `TranslationContent.tsx` and Settings › Translations. |

### Page level

| Surah feature | Level | Bayaan status + evidence | What's missing | Where it fits in Bayaan's UI |
|---|---|---|---|---|
| Benefits for each mushaf page (`fawaed-page`) | Page | **Missing.** The reader chrome has no page-level study content; all study content is per verse or per word.<br>`components/mushaf/main.tsx:833`, `app/mushaf.tsx:426` | Per-page lessons: no data, no sheet, no entry point. | A "Benefits" button in the reader chrome (iOS 26 header next to Share page, `components/mushaf/main.tsx:927`, or the toolbar, `app/mushaf.tsx:426`) opening a page sheet keyed by page, like `getThemesForPage` (`services/mushaf/ThemeDataService.ts:75`). |

### Surah level

| Surah feature | Level | Bayaan status + evidence | What's missing | Where it fits in Bayaan's UI |
|---|---|---|---|---|
| Surah names (`asmaa-sowar`) | Surah | **Partial.** One name and an English meaning per surah. 13 surahs have alternate names used only for search, and the English About {surah} gives a second name for about 12. The English Ibn Kathir lists al-Fatiha's names with sources at 1:1.<br>`data/searchAliases.ts:3`, `data/surahInfo.json` | No per-surah list of all names with sources; the aliases are never shown, and nothing is in Arabic. | A "Names" section at the top of About {surah} (`components/sheets/SurahOptionsSheet.tsx:158`), seeded from `data/searchAliases.ts`. |
| Virtues of surahs (`fadael-sowar`) | Surah | **Partial, inside tafsir text only.** The English Ibn Kathir opens about 28 surahs with a "Virtues of …" section (hadith in Arabic and English, with collectors, sometimes a grading), and About {surah} adds a few.<br>`data/ibn-kathir-tafseer-compact.json`, `services/tafseer/TafseerDbService.ts:316` | No surah-level virtues view, and about two thirds of surahs have no virtues text. Grading is incidental, and the text is English only. | A graded "Virtues" section in About {surah} (`SurahOptionsSheet.tsx:158`), or at least a link from it to the ayah-1 tafsir. |
| Surah objectives (`maqased-sowar`) | Surah | **Partial.** The English About {surah} has a theme section (prose) for 109 of 114 surahs.<br>`data/surahInfo.json`, `components/sheets/SurahOptionsSheet.tsx:181` | No concise, structured objectives and nothing in Arabic; 5 surahs have no theme section. | An "Objectives" block at the top of About {surah}. |
| Makki / Madani and its study (`nozool-sowar`, `makiyu_madaniu_Falih`) | Surah | **Partial.** A Makkah/Madinah chip on surah rows and cards (Arabic too), sorting by revelation order, and English prose on the period of revelation.<br>`components/SurahItem.tsx:197`, `data/surahData.json` | No study: no exceptions, no opinions on disputed surahs, and the revelation-order number is never shown. For 8 surahs the tafsir heading contradicts the chip with no explanation. | The label is already on `SurahItem` and `SurahCard`; the study fits a "Revelation" section in About {surah}. |
| Ayah counting across the schools (`adad_ayat-sowar`, `_fn`) | Surah | **Partial.** Each of the 8 rewayat is numbered by its own count (Kufi 6236, Makki 6220, Madani al-Akhir 6214, al-Duri/al-Susi 6217), with per-surah verse-end maps shipped.<br>`docs/features/rewayat.md:15`, `services/mushaf/RewayahVerseMapService.ts:10` | No per-surah comparison of the schools and no list of disputed ayah ends; Shami is not covered. Surah lists always show the Hafs count. | A "Verse count by school" section in About {surah}, built from `data/mushaf/digitalkhatt/*-versemap.json`, and the counting system named in the rewayah picker (`components/MushafSettingsContent.tsx:1484`). |
| Surah introduction / info page | Surah | **Partial.** An English About {surah} (Name, Period of Revelation, Theme…) for all 114 surahs, opened from surah options in reciter profiles, playlists, Loved, downloads and the full player.<br>`components/sheets/SurahOptionsSheet.tsx:158`, `components/sheets/PlayerOptionsSheet.tsx:33` | Not reachable from the Surahs tab, Browse All Surahs or the mushaf reader. English even in the Arabic UI, with no structured facts block. The view is copy-pasted into 4 sheets. | Extract About {surah} into one component and open it from the mushaf header (`components/mushaf/main.tsx`) and Surahs tab rows (`components/SurahsView.tsx`). It is the natural home for every surah-level row above. |

### Whole Quran

| Surah feature | Level | Bayaan status + evidence | What's missing | Where it fits in Bayaan's UI |
|---|---|---|---|---|
| Topic index (التفسير الموضوعي, 18 categories) | Whole Quran | **Missing.** Only a flat list of 1,051 English QUL passage themes (one per verse range), seen one verse at a time, plus a few unused surah collections in `data/categories.ts`.<br>`services/mushaf/ThemeDataService.ts:31`, `data/quran-themes.json` | No category tree, no subtopics, no browsing down to ayahs, and nothing in Arabic. | A "Topics" tile in Search › Explore (`components/search/ExploreView.tsx`) opening category, subtopic and ayah screens whose rows open `app/quran/[surah]/[ayah].tsx`. |
| Topic divisions of the whole Quran | Whole Quran | **Partial.** "Thematic Highlighting" (off by default) tints alternating QUL passages while reading, and Verse actions › Theme shows the passage title and range.<br>`store/mushafSettingsStore.ts:117`, `components/MushafSettingsContent.tsx:1298` | Titles are English only and not drawn on the page, and there is no list of a page's or surah's passages. | Already in Mushaf settings and the Theme screen (`VerseActionsSheet.tsx:1092`); inline titles would go in the page renderers (`components/mushaf/skia/SkiaPage.tsx:720`). |
| Encyclopedia (Surahpedia) links | All levels | **Missing.** Quranpedia appears only as a data credit (Credits, and the I'rab Books source line).<br>`app/(tabs)/(d.settings)/credits.tsx:63` | "Learn more" links from a word, ayah, page or surah. | Link rows in `WordDetailSheet`, `VerseActionsSheet`, About {surah} and the page sheet. |

## Everything else

### Reading and navigation

| Surah feature | Level | Bayaan status + evidence | What's missing | Where it fits in Bayaan's UI |
|---|---|---|---|---|
| Mushaf presentations (Surah: 7) | Reading | **Has.** 4 scripts (Madani 1405, Madani 1421, IndoPak, Mushaf 1440 beta), plus 7 non-Hafs rewayat texts, Mushaf or List view, and a Book or Fullscreen page design.<br>`components/MushafSettingsContent.tsx:135`, `store/mushafSettingsStore.ts:34` | 4 prints to Surah's 7, all on the Madani 604-page layout. An unused IndoPak 610-page layout is already in the repo (`data/mushaf/legacy/indopak/`). | Already in the FONT list of `MushafSettingsContent.tsx` (Settings › Mushaf settings and the reader sheet). |
| Two-page landscape on tablets | Reading | **Has.** A tablet in landscape shows facing pages automatically, for every script; iPad keys turn a whole spread.<br>`components/mushaf/constants.ts:255`, `components/mushaf/main.tsx:468` | No setting to keep a single page. Android tablets stay portrait because of the manifest lock, unless the OS overrides it. | Already in the reader pager (`components/mushaf/main.tsx:1302`). |
| Vertical scrolling | Reading | **Has.** Scroll Direction › Vertical, for mushaf pages and List view.<br>`components/MushafSettingsContent.tsx:975` | Mushaf 1440 falls back to the 1421 font in vertical mode. | Already in `MushafSettingsContent.tsx:975`. |
| Variable-speed auto-scroll | Reading | **Missing.** The reader moves by itself only with audio or recitation follow-along.<br>`hooks/useMushafAutoPageTurn.ts:1` | Timed auto-scroll for silent reading, with a speed control. | A play/speed control in the reader chrome (`components/mushaf/MushafPlayerBar.tsx`, or the iOS toolbar in `app/mushaf.tsx`) driving the vertical views, with the default speed in Mushaf settings. |
| Hizb index | Reading | **Partial.** Juz only: "juz" in the reader's search lists all 30 juz, and pages show the juz number. The ۞ marks are drawn without numbers.<br>`components/mushaf/MushafSearchView.tsx:214` | No hizb (60) or quarter (240) index, no "hizb N" command, and no hizb number on pages. `HIZB_START_PAGES` and `getHizbForPage` exist but nothing calls them. | Hizb and quarter rows under each juz in the reader navigator (`MushafSearchView.tsx:214`), using `components/mushaf/constants.ts:510`. |
| Quick navigator to any page / juz | Reading | **Has.** Tap the surah title (or Search) to open `MushafSearchView`: "page N", "juz N", "S:V" or a plain number (Arabic too), with recent and bookmark chips.<br>`components/mushaf/MushafSearchView.tsx:187` | No page slider or scrubber; you type. | Already in `MushafSearchView.tsx`. |
| Fullscreen | Reading | **Has.** A tap on the page hides the header, toolbar, player bar and status bar.<br>`components/mushaf/main.tsx:713` | No persistent fullscreen setting and no auto-hide. | Already in `components/mushaf/main.tsx` (`toggleImmersive`). |
| Tajweed colours in reading mode | Reading | **Has.** A "Tajweed Coloring" toggle in the reader sheet and in Settings › Mushaf settings, for pages, vertical scroll and list view.<br>`store/mushafSettingsStore.ts:116`, `components/MushafSettingsContent.tsx:1377` | Hafs only, and no colour legend on `develop`. | Already in `MushafSettingsContent.tsx`. |
| Vowel-mark (حركات) colouring | Reading | **Missing.** The only colour options are tajweed, rewayah differences and the Allah-name highlight.<br>`components/mushaf/skia/pageOverlays.ts:63` | A harakat colour toggle and colour choice. | A toggle with swatches next to Tajweed Coloring (`MushafSettingsContent.tsx:1379`), drawn through the Skia per-character colour maps. DigitalKhatt scripts only, because Mushaf 1440 draws whole-word glyphs. |
| Night mode, full black, themes | Settings | **Has.** App Light/Dark/Auto, plus 14 reading themes (7 light, 7 dark, including True Black for OLED).<br>`constants/readingThemes.ts:29`, `components/settings/ThemePicker.tsx:14` | True Black covers only the reader and the player. | Already in Settings › Mushaf settings › Reading Theme and the reader sheet. |
| App language | Settings | **Has.** English and Arabic (full RTL).<br>`i18n/languages.ts:13`, `app/(tabs)/(d.settings)/language.tsx:22` | Two languages; French and Amharic drafts are on unmerged branches. | Already in Settings › Language. |

### Search

| Surah feature | Level | Bayaan status + evidence | What's missing | Where it fits in Bayaan's UI |
|---|---|---|---|---|
| Search the Quran text by word | Search | **Missing.** The Search tab matches only surah and reciter names. The mushaf search parses only surah names, numbers, "page N", "juz N" and "N:M".<br>`utils/search/catalog.ts:141`, `components/mushaf/MushafSearchView.tsx:187` | Word and phrase search over the Arabic text: an index, a results list, tashkeel-insensitive matching and hit highlighting. Planned only: `docs/superpowers/plans/2026-10-12-search-overhaul.md:1624` (Phase 2, FTS5 over imla'i text). | A "Verses" section in Search results (`components/search/SearchView.tsx` via `utils/search/catalog.ts`) and a verse-text branch in the mushaf search parser (`MushafSearchView.tsx:187`). |
| Search by voice | Search | **Has (iOS).** Search tab › "Recite to search" opens "Which ayah?": on-device recognition (one-time 111 MB download) that names the ayah and keeps following.<br>`components/search/ReciteToSearchRow.tsx:22`, `services/recitation/recitationAvailability.ts:8` | iOS and Hafs only. It identifies recitation, not spoken questions, and isn't in the reader's search. | Already in the Search tab (`components/search/SearchView.tsx:500`); a mic row could be added to `MushafSearchView`. |
| Search by root | Search | **Partial.** Roots and lemmas, with counts, show per word in the I'rab morphology table, and the data covers the whole Quran.<br>`components/sheets/verse-actions/IrabContent.tsx:239`, `assets/data/irab-v1.db` | No root or lemma search and no occurrences list. | A tappable root in the morphology table opening its occurrences, and root queries ("ر ح م") in the Search tab. |
| Search by meaning | Search | **Missing.** No search looks in translations, tafsir or themes, and there is no semantic search.<br>`services/translation/TranslationDbService.ts:44` | Meaning or topic search in any language. The bundled translations and 1,051 QUL themes (861 with keywords nothing reads) could seed it. | A "Verses by meaning" section in the Search tab querying translations (`utils/translationLookup.ts`, `TranslationDbService`) and themes (`ThemeDataService`). |
| Search through tafsir (Surah: via Al-Mukhtasar) | Search | **Missing.** Tafsir is read one verse at a time; nothing searches tafsir text.<br>`services/tafseer/TafseerDbService.ts:70` | Tafsir text search that finds ayahs. No plan covers it. | A "Tafsir" scope in the Search tab or the mushaf search over downloaded editions (`TafseerDbService.ts`), each hit opening the Tafseer screen. |

### Audio and recitation

| Surah feature | Level | Bayaan status + evidence | What's missing | Where it fits in Bayaan's UI |
|---|---|---|---|---|
| 60+ reciters (incl. mp3quran) | Audio | **Has.** The Bayaan API catalogue, with a bundled fallback of 224 reciters and 268 recitations (264 mp3quran sets), 18 rewayah labels, and style and rewayah filters.<br>`data/reciters-fallback.json`, `services/dataService.ts:98` | Nothing. | Already in Home › Browse reciters, reciter profiles, and Collection › Favourite reciters. |
| Playback speed | Audio | **Has.** 7 steps from 0.5x to 2x, in the player and in the mushaf Playback Settings.<br>`constants/playback.ts:3`, `components/sheets/PlaybackSpeedSheet.tsx:17` | No custom values. | Already in the player controls and `components/sheets/MushafPlayerOptionsSheet.tsx:589`. |
| Repeat | Audio | **Has.** A mushaf range (can cross surahs) with per-verse and per-range repeat (1, 2, 3 or loop), the verse sheet's Repeat, and player repeat one/all.<br>`components/sheets/MushafPlayerOptionsSheet.tsx:616`, `store/mushafPlayerStore.ts:795` | Counts stop at 3 before Loop (open PR #480 adds 5, 10 and ∞), and there is no pause between repetitions. | Already in `MushafPlayerOptionsSheet.tsx` and `VerseActionsSheet.tsx:958`. |
| Play at word / ayah / page / surah level | Audio | **Has.** Word (`WordDetailSheet`), ayah (verse sheet), page (mushaf bar Play, or a range that defaults to the page), surah (player), and any range.<br>`components/sheets/VerseActionsSheet.tsx:935`, `components/mushaf/MushafPlayerBar.tsx:107` | No one-tap page/surah/juz presets (PR #480 adds them). Word audio needs list view with Word by Word on, and words aren't highlighted during recitation. | Already in the `VerseActionsSheet` Listen card and `MushafPlayerOptionsSheet.tsx:479`. |
| Use all features while listening | Audio | **Has.** Background audio, lock-screen controls and a mini/floating player. In the mushaf, audio keeps playing while you open tafsir, i'rab and so on; the playing ayah is highlighted and pages turn.<br>`components/player/v2/MiniPlayer/index.tsx`, `components/mushaf/skia/playbackBand.ts` | After leaving the mushaf, its audio has no in-app mini player, only lock-screen controls. | Already there; a mushaf mini bar would extend `MiniPlayer`. |
| Download manager | Audio | **Has.** Download a surah, a reciter's whole rewayah (with progress and cancel), playlists or Loved. Collection › Downloads and Settings › Storage manage them.<br>`app/(tabs)/(c.collection)/collection/downloads.tsx:85` | The mushaf's verse-synced player always streams. No list of downloads in progress, and no pause/resume. | Already in Collection › Downloads and Settings › Storage; offline mushaf audio would go in `utils/mushafAudioUtils.ts`. |
| Live recitation recognition (tasmee') | Audio | **Has (iOS).** The mushaf mic follows your recitation on the device (one-time 111 MB download), highlights and turns pages, and marks words you may have skipped or changed, with a summary, retry, practice and a hide-text mode.<br>`components/mushaf/RecitationMicButton.tsx:110`, `services/recitation/recitationAvailability.ts:8` | iOS and Hafs only, with no tajweed or harakat checking. Recitation history is recorded but can't be viewed (the Hifz history was pulled). | Already in the mushaf bar mic and Settings › Mushaf settings › Recitation. |
| Change reciter | Audio | **Has.** Mushaf Playback Settings › Reciter (a searchable picker of reciters with timings), and a default reciter in Settings.<br>`components/sheets/MushafPlayerOptionsSheet.tsx:563` | The change takes effect on Play and restarts from the start verse. | Already in `MushafPlayerOptionsSheet.tsx`; PR #480 redesigns it. |

### Memorization, plans and statistics

| Surah feature | Level | Bayaan status + evidence | What's missing | Where it fits in Bayaan's UI |
|---|---|---|---|---|
| Memorization plans with smart reminders | Plans | **In progress (pulled back).** The Hifz coach from #505 (sabaq/sabqi/manzil, spaced repetition from the recitation log) was removed by #513 (`ea8373d6`); its code is at `387d7f74:services/hifz/plan.ts`. There are no reminders anywhere: `expo-notifications` is installed but never called. | No plan on `develop`, and no reminders at all (the removed Hifz never had them). | Restore the Home "Memorize" card (a `hifz` row in `homeRowConfig`, `config/branding.js:39`) opening `app/(tabs)/(a.home)/hifz/`, with reminders under a new Settings › Notifications. |
| Self-testing | Plans | **Partial (iOS).** Recite with "Hide text" on: words appear only as you recite them. A summary of possible mistakes offers Retry, which opens a practice sheet that hides the ayah and checks your recitation.<br>`app/mushaf.tsx:377`, `components/sheets/RecitationPracticeSheet.tsx:80` | No structured test (the quiz and the look-alike drill left with #513), and no score or history. iOS, Hafs and Digital Khatt pages only. | The mushaf chrome today; a quiz would come back in the Hifz hub (`app/(tabs)/(a.home)/hifz/quiz.tsx` at `387d7f74`) or as a "Test yourself" item in surah options (`components/sheets/options/surahOptions.tsx`). |
| Quran plans by surahs / juz / pages (khatma) | Plans | **Missing.** Only "Continue Reading" (last page). A khatma model exists in `services/analytics/LocalAggregationStore.ts:141`, but nothing starts or shows it. | Plans by surahs, juz or pages, a daily portion, progress and completion. | A khatma/plan card on Home (`homeRowConfig`) and next to Continue Reading on the Surahs tab (`components/hero/ContinueReadingHero.tsx`), built on the khatma model. |
| Worksheets (أوراق العمل) | Plans | **Missing.** Nothing comparable, and no plan doc. | Study worksheets or exercises. | A per-surah entry in surah options (`components/sheets/SurahOptionsSheet.tsx`) or an exercises screen in `VerseActionsSheet`. |
| Statistics (احصائيات) | Plans | **Partial: data only, no UI.** The device records daily listening per surah and reciter, pages read, tasbeeh counts and (iOS) every recitation take. Nothing shows them; only the CarPlay "On Repeat" shelf reads them.<br>`services/analytics/LocalAggregationStore.ts:10`, `services/recitation/RecitationLogDatabase.ts` | No stats, streaks, goals or charts. The Hifz history and page heatmap left with #513. | A Stats/Activity screen from a Home card or a Collection category (`app/(tabs)/(c.collection)/index.tsx:74`). |

### Personal data

| Surah feature | Level | Bayaan status + evidence | What's missing | Where it fits in Bayaan's UI |
|---|---|---|---|---|
| Bookmarks | Personal | **Has.** Bookmark an ayah or range from the verse sheet. They are listed in Collection › Bookmarks, shown as chips in the mushaf search, and tinted on Digital Khatt pages.<br>`components/sheets/VerseActionsSheet.tsx:332`, `app/(tabs)/(c.collection)/collection/bookmarks.tsx` | Device only (sync is on the unmerged `feature/qf-integration`). No mark on Mushaf 1440 pages, and no page bookmarks. | Already there. |
| Notes | Personal | **Has.** Several notes per ayah, listed in Collection › Notes, with edit and delete.<br>`components/sheets/VerseActionsSheet.tsx:379`, `app/(tabs)/(c.collection)/collection/notes.tsx:70` | Device only, not marked on mushaf pages, and not searchable. | Already there. |
| Highlights and a highlights list | Personal | **Partial.** 5 highlight colours from the verse sheet, drawn on Digital Khatt pages.<br>`components/sheets/verse-actions/HighlightContent.tsx:23` | No list of highlights: Collection has only Bookmarks and Notes, and the database reads highlights one surah at a time. Not drawn on Mushaf 1440, the list layout or the player. | A Highlights category in the Collection tab (`app/(tabs)/(c.collection)/index.tsx:74`) opening a `collection/highlights.tsx` modelled on `bookmarks.tsx`, with a `getAllHighlights` query (`services/database/VerseAnnotationDatabaseService.ts:690`). |

### Sharing and feedback

| Surah feature | Level | Bayaan status + evidence | What's missing | Where it fits in Bayaan's UI |
|---|---|---|---|---|
| Share as image | Sharing | **Has.** Verse actions › Share › "Share as Image": a 1080px card with the surah header, optional basmala and watermark; ranges work.<br>`components/sheets/verse-actions/ShareContent.tsx:191`, `components/share/ShareCardPreview.tsx:111` | One design, Arabic only (no translation or study content). Story templates exist only on an unmerged April branch. | Already in `ShareContent.tsx`. |
| Share as vowelled text | Sharing | **Has.** "Share as Text" and Copy give fully vowelled Uthmani text (following the shown rewayah), the translation and a citation.<br>`components/sheets/verse-actions/ShareContent.tsx:210`, `components/sheets/VerseActionsSheet.tsx:384` | No Arabic-only option (the translation is always added). With the default Saheeh translation the copied text includes raw `<sup foot_note>` tags (see Side findings). | Already in `ShareContent.tsx` and the Copy row. |
| Share as PDF | Sharing | **Missing.** No PDF or print anywhere, and no PDF library. | PDF export of ayahs, ranges, tafsir or i'rab. | A "Share as PDF" button beside Image / Text / Link in `ShareContent.tsx:394`. |
| Share with or without content | Sharing | **Partial.** Text and Copy always include the translation; the image card toggles only basmala and watermark. The study screens (tafsir, i'rab…) have no share or copy.<br>`components/sheets/verse-actions/ShareContent.tsx:174`, `ShareContent.tsx:376` | No choice of what to include (Arabic only, translation, tafsir, i'rab, word by word), and no sharing from study screens. | Content checkboxes in `ShareContent` (the `AdhkarCopyOptionsSheet` pattern), plus a share button in the `VerseActionsSheet` sub-screen header (`:792`). |
| Report a content error | Feedback | **Missing.** No report action on any content screen, only the generic Settings rows (external support page, GitHub).<br>`components/sheets/VerseActionsSheet.tsx:773` | Per-item reports that carry the verse key and edition. | A "Report a mistake" action in the `VerseActionsSheet` sub-screen header (`:773`) and in `WordDetailSheet`, prefilled and sent to `branding.supportUrl`. |
| Feature voting / suggestions with attachments (رأيك يهمنا) | Feedback | **Partial.** Settings › Feedback › "Feature Requests" opens the same external support page as Help.<br>`components/settings/settingsItems.ts:116` | No in-app form, list, voting or attachments. | An in-app suggestions and voting screen behind the Feature Requests row. |

### Account, sync and notifications

| Surah feature | Level | Bayaan status + evidence | What's missing | Where it fits in Bayaan's UI |
|---|---|---|---|---|
| Sign in with Apple / Google | Account | **In progress (as a Quran.com login).** Nothing on `develop`: no auth and no Account section (`docs/architecture/auth-removal.md:1`). The unmerged `feature/qf-integration` (PR #320 into that branch) adds Quran.Foundation sign-in (`components/auth/QfAccountCard.tsx`) behind `EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED`. | No native Apple or Google sign-in on any branch. | An Account section in Settings (`app/(tabs)/(d.settings)/index.tsx`), where the branch mounts `QfAccountCard`. |
| Backup and auto-sync | Account | **In progress.** Nothing on `develop` (`docs/features/cloud-sync.md:3`: "Planned"). `feature/qf-integration` syncs bookmarks, notes, highlights, playlists, favourites and settings with a Quran.com account. RFC-022 local backup (PR #363) is docs only. | No backup or sync on `develop`; the QF sync needs a Quran.com account and a build flag. | Sync status in the Settings account card, and "Back up & restore" in Settings › App & Data (`components/settings/settingsItems.ts:82`). |
| Notifications | Account | **Missing.** Nothing schedules or handles a notification. Only unused groundwork ships (`utils/notificationUtils.ts:10`, `config/featureFlags.ts:17`), plus a design spec on the unmerged `osmansaeday/notifications`. | Reminders (reading, adhkar, goals), push announcements and a notifications screen. | Settings › Notifications (a new `app/(tabs)/(d.settings)/notifications.tsx`) plus reminder bells on adhkar, as the spec proposes. |

### Platforms

| Surah feature | Level | Bayaan status + evidence | What's missing | Where it fits in Bayaan's UI |
|---|---|---|---|---|
| Web app | Platform | **Has (separate repo).** thebayaan/bayaan-web at app.thebayaan.com (Next.js); the app's share links open it.<br>`docs/features/recitation-follow-along/phase-4-research.md:13`, `config/branding.js:23` | Its features were not compared, because its code isn't in this repo. | Outside this repo. |
| Windows desktop app | Platform | **Missing.** iPhone, iPad and Android only; Mac Catalyst is off, and there is no Electron or Tauri target.<br>`ios/Podfile:65` | An installable desktop app. | The cheapest route is the web app as a PWA (planned in `docs/features/web-app.md:441`). |

## Side findings

Things found while checking that are worth a ticket of their own:

- **Copy pastes raw footnote markup.** With the default Saheeh International translation, Copy and "Share as Text" paste raw `<sup foot_note="…">` tags, because the copy path uses `getTranslationTextRaw` (`utils/translationLookup.ts:147`, called from `components/sheets/VerseActionsSheet.tsx:285`). The checking agent counted 1,613 of 6,236 verses carrying such tags.
- **Data and helpers that ship but nothing uses:**
  - `HIZB_START_PAGES` / `getHizbForPage` (`components/mushaf/constants.ts:510`)
  - the khatma model in `services/analytics/LocalAggregationStore.ts:141`
  - the `mushaf-repeat-options` sheet (registered at `components/sheets/sheets.tsx:83`, never opened)
  - `utils/notificationUtils.ts` and the `pushNotifications` flag
- **The About {surah} view is copy-pasted** into `SurahOptionsSheet`, `PlayerOptionsSheet`, `DownloadOptionsSheet` and `UploadOptionsSheet`. Extract it before adding surah-level content.

## How this was checked

- **Surah's feature list:** the brief's own research (API projects, web-app routes and labels, App Store listing). The App Store page could not be re-read from the checking environment.
- **Checking:** each feature group was checked against `develop` by one agent, then re-checked by a second agent told to disprove every status. That agent searched again in English and Arabic for "missing" rows, and confirmed that "has" rows are reachable in the UI and not dev-only or flagged off.
- **Final pass:** two more agents checked coverage and consistency across groups.
- **In-progress work:** open PRs and unmerged branches were inspected for code, not just docs.
- **Limits:**
  - Surah's own content was not opened, so differences inside a feature (e.g. which morphology fields Surah shows) are not compared.
  - The web app at app.thebayaan.com lives in another repo and was not compared.
