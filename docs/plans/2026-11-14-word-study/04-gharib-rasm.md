<!-- @ai-generated -->
# Arabic word meanings (gharib) and rasm: data and sections

> Design written against `develop` at `b0a151ce` (2026-11-14) by a read-only design agent. Decisions that override it are in [README.md](README.md); where they disagree, README.md wins.

## Summary

Gharib and rasm each get their own optional bundled DB: `assets/data/gharib-v1.db` and `assets/data/rasm-v1.db`. Both are built offline by `scripts/word-study/` from inputs pinned in `sources.lock.json`. Both are keyed by Hafs `s:a:w` in the app's word-by-word numbering, the same numbering as i'rab and as `WBWVerseView.onWordPress`.
The builds copy `scripts/irab/build-irab-db.ts`: SHA-256 input gate, alignment and output gates, a report file, `meta` and `texts` tables, `WITHOUT ROWID` tables.
Gharib: each book headword is matched against runs of whole words in the verse, trying stricter rules first (exact, then without alifs, then without attached prefixes/suffixes, then a loose form that must be unique). If that fails, the build tries up to 3 verses either side; anything still unmatched stays at verse level. A prototype on Quranpedia's 4-book meanings dump placed 96.7% of entries on words.
Rasm: the build first pairs the verse's words with the standard-spelling words (1:1, wasl 1:n, fasl n:1). It then compares letters and labels each difference as hadhf, ziyada, badal, hamz, wasl or fasl. A note is accepted when the mushaf's own small signs confirm it, when one of 4 named pattern rules covers it, or when it is in a hand-reviewed JSON file (the prototype left about 270 notes, about 4%, unmarked).
App side: `services/wordStudy/` holds a pure format module and a lazy service with `getVerse`, `getGharib(hafsLocation)` and `getRasm(hafsLocation)`. The service never rejects. `bundledWordStudy.ts` stays null until data ships, so nothing opens and both sections stay hidden.
UI: `GharibSection` and `RasmSection` sit in the word card in single-word mode, after morphology and readings, and render null when there is no data. Source lines come from bilingual source rows in the DB. There are 18 new `sheets:wordStudy.*` keys in English and Arabic.
No source is chosen. Candidates: classical gharib books on Quranpedia (contemporary ones need permission), Tanzil Simple (CC BY 3.0, but its terms forbid changing the text), QUL imla'i (no licence information), Quran.com `text_imlaei` (its developer terms forbid bundling) and MASAQ (CC BY 4.0, origin of its text to check).
Order of work: format, Arabic letter model, rasm module, gharib module, DB writers and CLIs, service, UI and strings, wiring into the word view, then a data-only drop-in once sources are chosen.

## Current state

**No Arabic word content beyond i'rab.** The gap list marks gharib and rasm as Missing (`docs/research/surah-app-feature-gaps.md:115`, `:118`) and wants both in one word view (`:84`, `:121`). The repo has no imla'i text (`:115`).

**Word texts and their numbering**
- `data/wbw/wbw-en.db`, table `words(verse_key, position, text_uthmani, text_indopak, translation, transliteration, audio_url)`: 77,429 Hafs words in 6,236 verses, in Quran.com's Uthmani spelling (1:4:1 `مَـٰلِكِ`, 2:3:5 `ٱلصَّلَوٰةَ`).
  - Fetched from api.quran.com v4 with `word_fields=text_uthmani,text_indopak` (`scripts/fetch-wbw-translations.js:21`, `:63-66`).
  - 55 words contain U+FFFD (`scripts/irab/build-irab-db.ts:540`, `:570`). None of them is in the three verses below.
- `data/mushaf/digitalkhatt/digital-khatt-v2.db`, table `words(id, location 's:a:w', surah, ayah, word, text)`: 83,668 rows, which is 77,432 words plus 6,236 verse-end markers.
  - Its numbering differs from wbw in exactly 2:181, 8:6 and 13:37: Digital Khatt (DK) splits `بَعْدَ مَا` into two words, wbw keeps one. The seven `dk_words_<id>.db` files share the DK numbering.
- `WBWVerseView` pairs DK words with wbw words by their text (`components/player/v2/PlayerContent/QuranView/WBWVerseView.tsx:404-449`) and reports the **wbw** position on tap (`:548`, `:650`). i'rab is keyed the same way: `word_irab(verse_key, position)` (`scripts/irab/build-irab-db.ts:638-645`).

**The word card that will host the sections: `components/sheets/verse-actions/IrabContent.tsx`**
- For each Hafs part it loads the i'rab, the app's words and the books in one `Promise.all` (`:112-149`, `:123-127`). It keeps `wordText` for every word except the damaged ones (`:128-133`).
- `renderWordCard` (`:206-251`) shows the i'rab entries and the agreed mark. The morphology table shows only in single-word mode (`:239`).
- There is one sources line, `irab.sources` (`:339`). The Books tab shows `nameAr`/`authorAr` and a "Read more" over 700 characters (`:446-517`).
- Arabic data is set in Scheherazade New (`:74-75`) and aligned to the physical right (`:80-81`).
- Three existing styles are below MUST rules:
  - secondary text at alpha 0.75 (`:522`) and the sources line at 0.55 (`:746`), against the ≥0.8 rule in `docs/design/ipad-standards.md:422`;
  - i'rab lines at 17/30 (`:655-656`), against the ≥2.0× Arabic line pitch rule (`:133`).
- `WordDetailSheet` is a separate view, opened by long-press in the wbw grid. It shows the word in the `Uthmani` font, transliteration, English and audio by position (`components/sheets/WordDetailSheet.tsx:83-90`, `:174-190`, `:268-275`).

**Bundled-DB pattern to copy: `services/irab/IrabDataService.ts`**
- File name carries the version, with `OLD_DB_NAMES` (`:9-15`).
- Opens on first use (`:23-33`). A readiness probe either passes or triggers delete plus `importDatabaseFromAssetAsync(require(asset))` (`:35-53`). The import does nothing when the file already exists (`node_modules/expo-sqlite/src/hooks.tsx:319-334`).
- Per-verse cache (`:63-85`); books are joined per verse (`:87-121`).
- Decoders never throw on bad rows (`services/irab/irabFormat.ts:55-103`). Helpers: `parseWordKey` (`:134`), `quotableWord` (`:142`).
- `.db` is already a Metro asset extension (`metro.config.js:12-14`).
- `AppInitializer` does not start i'rab; it starts only WBW (`services/AppInitializer.ts:439-448`).

**Build-script pattern to copy: `scripts/irab/build-irab-db.ts`**
- Header doc with usage and gates (`:1-24`), `--name` arguments (`:69-74`), app words read from `wbw-en.db` (`:426-433`).
- Letter skeleton (`:84-97`), a table of hand-reviewed exceptions (`:102`), and fixes that must apply or the build fails (`:237`).
- Reader for `.json` and `.json.gz` (`:383-389`); `cleanBookHtml` with a markup and link gate (`:391-414`).
- SHA-256 gate on inputs (`:448-453`), alignment gate (`:538-566`), report file through an env variable (`:623-624`).
- DB with `meta`, deduplicated `texts` (`:693-708`) and `WITHOUT ROWID` tables (`:638-664`).
- Quranpedia books loop that checks `book.id` and stores `license.version` (`:744-776`); `VACUUM` (`:781`); `require.main` guard (`:789`).
- `scripts/irab/masaq.ts:87-130` pairs two word lists by a loose skeleton (`:96`). It returns `null` for merged words, so it cannot report wasl/fasl groups.
- Pinning inputs and recording licence status: `scripts/rewayah/sources/sources.lock.json` and `SOURCES.md`. Scripts import pure app modules by relative path (`scripts/adhkar-content/write-data-fingerprint.ts:7`).

**Normaliser.** `utils/search/normalize.ts:29-41` `toSearchKey` is pure. It strips U+0610–061A, U+064B–065F, U+0670, U+06D6–06ED and tatweel. It folds أ إ آ ٱ to ا, ى to ي, ة to ه, ؤ to و, ئ to ي, and drops ء.

**Tests and CI**
- Pure script modules are tested in `scripts/__tests__` (for example `irabSarf.test.ts`) and decoders in `services/irab/__tests__/irabFormat.test.ts`.
- The committed DB is tested in `services/irab/__tests__/irabDatabase.test.ts` with better-sqlite3: completeness, sources in `meta`, no Latin or markup, references exist, reviewed lines.
- Jest uses jest-expo (`package.json:50-66`).
  - `test.yml` runs `npm run test:ci` on Node 22.
  - `lint.yml` runs `tsc --noEmit`, which covers `scripts/**` through the `tsconfig.json` include.
  - `i18n.yml` runs `extract --ci` and `lint`.
- `test-utils/mockExpoSqlite.ts:53-70` mocks only `openDatabaseAsync`. Sheet render tests mock the theme and the sheet ScrollView (`components/sheets/verse-actions/__tests__/WBWContent.preferences.test.tsx:5-35`).

**Sources and credits already recorded**
- `THIRD_PARTY_LICENSES.md:92-111`: Quranpedia dumps (version 2026-08-10) for the i'rab books, Quranic Arabic Corpus (GPL), Quranic Treebank (MIT), MASAQ (CC BY 4.0).
- `:166-177`: Tanzil's translation terms (non-commercial).
- `:48-52`: KFGQPC texts, with no licence on record.
- The Credits screen lists QUL, the Quran Foundation API, the Treebank, the Corpus, MASAQ and Quranpedia (`app/(tabs)/(d.settings)/credits.tsx:34-66`).
- The research doc describes QUL as a download-only hub suited to bundling (`docs/features/translations-tafaseer-research.md:24`, `:57-60`).

## Design

## 0. Ground rules

- **Key.** Every record points at a Hafs word as `HafsWordKey = "s:a:w"` in the **app's word-by-word numbering**: `data/wbw/wbw-en.db`, the i'rab numbering, and what `WBWVerseView` reports (`WBWVerseView.tsx:548,650`).
  - Digital Khatt and rewayah locations differ only in 2:181, 8:6 and 13:37, where DK splits `بَعْدَ مَا`.
  - Callers holding a DK location map it first, as `WBWVerseView.tsx:404-449` already does. The readings design must do the same.
- **The app never shows data's Quran text as the mushaf text** (same rule as i'rab, `irabFormat.ts:1-10`).
  - The Uthmani spelling on screen is always the app's own word (`quotableWord(textUthmani)`, `IrabContent.tsx:128-133`).
  - Data supplies only two Quran-text strings: the standard (imla'i) spelling, labelled "Standard", and a gharib book's headword for entries that could not be placed, shown as the book's own text (as the Books tab already does).
- **Two independent files.** Gharib and rasm come from different sources and licences and may ship at different times.
  - Each has its own DB, lock entry and version: `assets/data/gharib-v1.db` and `assets/data/rasm-v1.db`.
  - One service reads both. Neither goes into `irab-v1.db`: it is 20.8 MB, and rebuilding it needs the treebank and MASAQ.
- **Nothing ships until a source is chosen.** `services/wordStudy/bundledWordStudy.ts` holds `null` for both files.
  - The service then returns empty results without touching SQLite, and both sections render nothing.
  - Dropping data in later means: build the DB, set the constant to `require(asset)`, add the DB tests and credits.
- **Evidence.** I downloaded nothing. The numbers below come from throwaway prototypes I ran on files that already sat in this session's scratchpad, downloaded by an earlier step.
  - Those files are Quranpedia `meanings.json.gz` (version 2026-11-14), Quranpedia `tafsir-book-*` dumps, Quran.com v4 word pages with `text_imlaei`, Tanzil Simple, and QUL and Quran Foundation pages.
  - They are not in the repo and were not checked against the publishers. Read the numbers as indicative and re-check everything on the real download.

## 1. Gharib (Arabic word meanings)

### 1.1 Per-word record (app side)
```ts
// services/wordStudy/wordStudyFormat.ts  (// @ai-generated; pure, also imported by scripts)
export type HafsWordKey = string; // "s:a:w", wbw numbering
export type WordStudyKind = 'gharib' | 'rasm';
export interface WordStudySource {
  id: number; kind: WordStudyKind; ord: number;        // ord: display order chosen by the team
  nameAr: string; nameEn: string; authorAr: string; authorEn: string;
  viaAr: string; viaEn: string;                         // e.g. «الموسوعة القرآنية (quranpedia.net)»
  url: string; version: string;
}
export interface GharibEntry {
  source: WordStudySource;
  verseKey: string;
  ord: number;                      // the entry's order inside its book
  span: [number, number] | null;    // first..last word explained; null = verse level (not placed)
  headword: string;                 // as printed in the book; shown only for verse-level entries
  gloss: string;                    // Arabic explanation
  note: string;                     // '' when none
  part: string; page: string;       // '' when the source has none (the meanings dump has none)
}
```

### 1.2 Input format
- **Intermediate record.** Each adapter produces `GharibInput`. A `jsonl` adapter accepts the same record one per line, so any future source can be converted by a one-off script.
```ts
export interface GharibInput { surah: number; ayah: number; sourceId: number; ord: number;
  headword: string; gloss: string; note?: string; part?: string; page?: string }
// jsonl line: {"s":2,"a":2,"source":<id>,"headword":"…","gloss":"…","note":"","part":"","page":""}
```
- **`quranpedia-meanings` adapter.** Reads the ayah-service dump "غريب القرآن — معاني كلمات كلِّ آية".
  - Shape seen in the local copy: `{license:{version,…}, schema:'/v1/ayah/{surah}/{ayah}/meanings', data:[{surah, ayah, meanings:[{book_info:{id,name,author,…}, words:[{text, meaning}]}]}]}`. The entries are already split.
  - The adapter checks `schema`, keeps only the locked book ids, and numbers `ord` in file order.
  - The local copy holds 4 books, 20,244 pairs over 4,799 of the 6,236 verses:
    - 327 Ibn al-Ha'im, *al-Tibyan fi Tafsir Gharib al-Qur'an*
    - 208 Ibn al-Jawzi, *Tadhkirat al-Arib*
    - 491 al-Khudayri, *al-Siraj* (2008)
    - 1424 Makhluf, *Kalimat al-Qur'an*
  - Median gloss length is 17–48 characters; the longest is 1,411. One Makhluf gloss has markup.
- **`quranpedia-book` adapter.** Reads `tafsir-book-<id>.json.gz`, the same `{book, license, ayahs:[{surah, ayah, content:[{text, part, page}]}]}` shape that `build-irab-db.ts:744-776` already reads.
  - Book passages must be split into entries by a per-book splitter, `GHARIB_SPLITTERS: Record<number, (html) => {headword, gloss}[]>`.
  - The splitter runs on the HTML before `cleanBookHtml` (`build-irab-db.ts:391`), because the headword markers are markup. Markers seen in the local copies:
    - `<span class="book-ayah …">﴿…﴾</span>`: al-Sijistani, *Nuzhat al-Qulub*, 27760
    - `(…)` after a number: Ibn Qutaybah, *Gharib al-Qur'an*, 341
    - `" … "`: Ibn al-Ha'im, 27784
    - `headword: gloss<br>`: 2013
  - What each item's `ayahs` field means must be checked; it may give the verses a passage covers.

### 1.3 Placing headwords on words (`scripts/word-study/gharib.ts`)
For each verse, entries are processed in book order. A headword is compared with every run of 1 to n+2 consecutive words (n = the headword's word count), with spaces ignored, so `لاريب فيه` matches `لَا رَيْبَ فِيهِ`. The first rule that gives a candidate wins:

| Tier | Comparison | Prototype share (4 books) |
|---|---|---|
| 1 | `matchKey`: `toSearchKey(plene(x))`, no spaces. `plene` turns وٰ into ا, ىٰ inside a word into ا, and any other ٰ into ا, so `ٱلصَّلَوٰةَ` = الصلاة and `مَـٰلِكِ` = مالك. The span is also tried without `plene`, so `ذَٰلِكَ` = ذلك | 87.8% |
| 2 | Tier-1 keys with every ا removed (`ٱلْكِتَـٰبُ`/الكتاب, `أَزْوَٰجٌ`/أزواج) | 1.4% |
| 3 | Tier-2 keys after removing one proclitic (و ف ب ل ك س، ال، وال، فال، بال، كال، لل) and/or one enclitic pronoun (ه ها هم هما هن ك كم كما كن نا ني ي) on either side; the remaining stem must have at least 2 letters | 5.2% |
| 4 | `looseKey`: no ا و ي ى and no hamza seats, final ة/ت/ه folded together, doubled letters merged. Accepted only if the key has at least 3 letters and the match is unique in the verse | 1.4% |
| moved | Tiers 1–3 in a verse up to 3 before or after, in the same surah. Quranpedia maps passages to verses coarsely; the i'rab Books tab already says a passage "can also cover the verses around it" | 0.8% |
| verse level | None of the above: stored with `word_from = word_to = NULL`. Examples: reading variants quoted as headwords (أمرنا/آمرنا), explanations placed in the headword field, entries keyed to the wrong surah | 3.3% |

- **Ambiguity.** In 1.3% of entries the winning tier gives more than one candidate. Take the first span that starts after the previous placed entry of the same source in that verse; otherwise take the first span. Every ambiguous placement goes into the report.
- **Verse-level share per book:** al-Khudayri 0.9%, Ibn al-Ha'im 1.7%, Makhluf 3.6%, Ibn al-Jawzi 6.5%.
- **Hand placements.** `scripts/word-study/gharib-reviewed.json` (`{"__format":1,"entries":{"<sourceId> <s:a> <matchKey(headword)>":{"span":"2:2:3-5"}|{"verseLevel":true}}}`) sets tier 5. The key does not depend on the dump's `ord`.
- **Damaged words.** The 55 words with U+FFFD in wbw-en.db take their text from `digital-khatt-v2.db` at the same location (none is in the three split verses).

### 1.4 Schema: `assets/data/gharib-v1.db`
```sql
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- format=1, kind=gharib, app_words=77429, input_<file>_sha256, source_<id>_version, source_<id>_placed
CREATE TABLE sources (id INTEGER PRIMARY KEY, ord INTEGER NOT NULL,
  name_ar TEXT NOT NULL, name_en TEXT NOT NULL, author_ar TEXT NOT NULL, author_en TEXT NOT NULL,
  via_ar TEXT NOT NULL, via_en TEXT NOT NULL, url TEXT NOT NULL, version TEXT NOT NULL);
CREATE TABLE texts (id INTEGER PRIMARY KEY, text TEXT NOT NULL);       -- id 0 = '' (as build-irab-db.ts:708)
CREATE TABLE gharib (
  verse_key TEXT NOT NULL, source_id INTEGER NOT NULL, ord INTEGER NOT NULL,
  word_from INTEGER, word_to INTEGER,                                   -- NULL = verse level
  tier INTEGER NOT NULL,                                                -- 0 verse level, 1-4, 5 hand-placed
  headword_id INTEGER NOT NULL, gloss_id INTEGER NOT NULL, note_id INTEGER NOT NULL,
  part TEXT NOT NULL, page TEXT NOT NULL,
  PRIMARY KEY (verse_key, source_id, ord)) WITHOUT ROWID;
```
- An entry placed in a neighbouring verse is stored under that verse. `ord` is per book, so the key stays unique.
- Size from the prototype: about 2.5 MB for all four books, about 1 MB for two.

### 1.5 Build script: `scripts/word-study/build-gharib-db.ts` (`// @ai-generated`)
```ts
/** Builds assets/data/gharib-v<N>.db.
 *   npx tsx scripts/word-study/build-gharib-db.ts --input <file> [--input <file>…] \
 *     [--out assets/data/gharib-v1.db] [--report <file>]
 * Each input must be locked in scripts/word-study/sources.lock.json (adapter, version, SHA-256,
 * book ids to keep, bilingual names, display order, minPlaced). Gates (the build fails):
 *  - an input whose SHA-256 is not the locked one (as build-irab-db.ts:448-453);
 *  - a gloss/headword/note with markup, a link, Latin letters or U+FFFD (as :391-414, :693-697);
 *  - a span outside its verse's words in data/wbw/wbw-en.db;
 *  - a book whose placed share (tiers 1-5 + moved) is below its locked minPlaced (the prototype
 *    suggests 0.93).  --report lists ambiguous, moved, tier-4 and verse-level entries for review. */
function main(): void {
  const lock = readLock(path.join(__dirname, 'sources.lock.json'));
  const inputs = argAll('input').map(f => checkedInput(f, lock.gharib));   // SHA-256 gate
  const words = readAppWords(root);           // wbw-en.db + DK text for U+FFFD words
  const entries = inputs.flatMap(readGharibInput);
  const placed = placeAll(entries, words, readReviewed('gharib-reviewed.json'));
  gateGharib(placed, lock);  writeGharibReport(arg('report', ''), placed);
  writeGharibDb(arg('out', defaultOut), sourceRows(lock), placed, gharibMeta(lock, inputs, placed));
}
if (require.main === module) main();
```

### 1.6 Service API
`getGharib(hafsLocation)` returns the entries whose span covers the word, ordered by source, then by book order. `[]` hides the section. `getVerse` also returns the verse-level entries (see §4 for where they show).

Per-verse query:
```sql
SELECT g.source_id, g.ord, g.word_from, g.word_to, h.text AS headword, x.text AS gloss, n.text AS note, g.part, g.page
  FROM gharib g JOIN sources s ON s.id = g.source_id
  JOIN texts h ON h.id = g.headword_id JOIN texts x ON x.id = g.gloss_id JOIN texts n ON n.id = g.note_id
 WHERE g.verse_key = ? ORDER BY s.ord, g.ord;
```

## 2. Rasm

### 2.1 What an entry shows
- The word's standard (imla'i) spelling next to the app's Uthmani word, with the differing letters of the standard spelling highlighted.
- One line per difference, labelled in Arabic with the classical terms: الحذف (hadhf), الزيادة (ziyada), البدل (badal), الهمز (hamz), الوصل (wasl), الفصل (fasl).
- Only units with at least one note are stored, so words spelled the same way show no section. A unit is one word, or the words written apart in a fasl case.

### 2.2 Letter model: `rasmLetters(word)` in `scripts/word-study/arabic.ts`

| Sign in the Uthmani word | Meaning for the comparison |
|---|---|
| ٰ U+0670 on a consonant or tatweel | Deleted alif: confirms a hadhf of ا |
| ٰ directly on و, with no vowel of its own | Alif written as waw: confirms badal ا→و. Compare `أَزْوَٰجٌ`, where the و has a fatha, so it is a hadhf |
| ٰ on ى inside a word | Alif written as ya: confirms badal ا→ى. At the end of a word ىٰ is also the standard spelling (`عَلَىٰ`) |
| ۥ U+06E5, ۦ U+06E6, ۧ U+06E7, ۨ U+06E8 | Small waw, ya, ya, nun: confirms a hadhf of that letter. After ه they mark ṣila (`هُۥ`, `بِهِۦ`) and match nothing |
| ۟ U+06DF, ۠ U+06E0 on a letter | Written but not read: confirms a ziyada |
| ۜ U+06DC or ۣ U+06E3 on ص | Read as س: confirms badal س→ص |
| ء, or ـٔ (tatweel + U+0654) | Hamza with no seat: not a rasm letter. Stored as «ء» for display |
| أ إ آ ؤ ئ | Seat letter plus a hamza flag |
| Harakat, waqf marks U+06D6–06DC, ۞, ۩, tatweel; dots on ي/ى | Ignored (the rasm has no dots) |

Counts in wbw-en.db:

| Sign | Words |
|---|---|
| tatweel+ٰ | 5,787 |
| ٰ elsewhere | 809 |
| ۟ | 3,970 |
| ىٰ | 2,240 |
| وٰ | 749 |
| ـٔ | 772 |
| ۥ after ه | 1,228 |
| ۦ after ه | 935 |
| ۥ elsewhere | 29 |
| ۦ elsewhere | 22 |
| ۧ | 38 |
| ۠ | 66 |
| ۜ | 7 |
| ۨ | 1 |
| ۣ | 1 |

### 2.3 Deriving notes: `scripts/word-study/rasm.ts`

**A. Group the verse.** `groupVerse(uthmani: string[], standard: string[]): WordGroup[] | null`.
- Standard tokens are split on spaces, because a word-level source can hold «يَا أَيُّهَا» in one slot.
- A dynamic programme allows 1:1, 1:2, 1:3, 2:1 and 2:2 groups when `looseKey` of both sides is equal, and prefers 1:1.
- `null` means the verse cannot be paired, and the build fails listing such verses.
- Word-level sources go through this too. In the Quran.com copy, 60:1 and 71:2 split يا differently from every other verse, which shifts all later positions.
- A group that is one mushaf word against several standard words is **wasl**. Several mushaf words against one standard word is **fasl**.

**B. Diff the letters.** `diffGroup(g): DerivedNote[]` aligns the mushaf letters with the standard letters (spaces removed) by weighted edit distance:
- equal letters cost 0; known badal pairs 0.6; other substitutions 1.2;
- a standard letter missing from the mushaf costs 1, or 0.5 if the matching small letter sits in that gap, or 0.6 if it is a hamza seat;
- a mushaf letter missing from the standard spelling costs 1, or 0.7 if it carries ۟ or ۠.

Each edit is then classified:

| Edit (standard → mushaf) | Kind | Confirmed ("marked") when | Examples (standard spelling from the local Quran.com copy) |
|---|---|---|---|
| Letter missing in the mushaf | hadhf | The matching small letter is there | 1:4:1 مَـٰلِكِ/مَالِكِ; 2:251:5 دَاوُۥدُ/دَاوُودُ; 2:124:3 إِبْرَٰهِـۧمَ/إِبْرَاهِيمَ (ا and ي); 21:88:7 نُـۨجِى/نُنجِي |
| Extra letter in the mushaf | ziyada | The letter carries ۟ or ۠ | 18:23:3 لِشَا۟ىْءٍ/لِشَيْءٍ; 51:47:3 بِأَيْي۟دٍ/بِأَيْدٍ; 7:145:18 سَأُو۟رِيكُمْ/سَأُرِيكُمْ |
| ا↔و, ا↔ى, س↔ص (also ة↔ت, ن↔ا) | badal | The sign in 2.2 is there | 2:3:5 ٱلصَّلَوٰةَ/الصَّلَاةَ; 2:29:13 فَسَوَّىٰهُنَّ/فَسَوَّاهُنَّ; 2:245:14 وَيَبْصُۜطُ/وَيَبْسُطُ |
| Any edit touching a hamza or its seat | hamz | Always | 2:14:16 مُسْتَهْزِءُونَ/مُسْتَهْزِئُونَ; 2:108:4 تَسْـَٔلُوا۟/تَسْأَلُوا; 12:5:5 رُءْيَاكَ/رُؤْيَاكَ |
| 1:n group | wasl | Always listed in the report | 2:21:1 يَـٰٓأَيُّهَا/يَا أَيُّهَا (plus a hadhf ا); 20:94:2 يَبْنَؤُمَّ/يَا ابْنَ أُمَّ; 3:66:1 هَـٰٓأَنتُمْ; 72:16:1 وَأَلَّوِ |
| n:1 group | fasl | Always reviewed | None in the prototype: the source keeps the mushaf's word division |
| Any other substitution | (none) | The build fails until the word is reviewed | 12:25:9 لَدَا/لَدَى |
| Only harakat, dots, or the hamza form on the same seat (ءا/آ), or a dagger alif the standard text also keeps | no note | (no review) | 2:9:4 ءَامَنُوا۟/آمَنُوا; 2:2:1 ذَٰلِكَ |

**C. Decide whether to trust each note.** A note is kept when it is:
- confirmed by its sign (marked);
- covered by a named pattern rule:
  - `lamAssimilated`: ٱلَّيْل, ٱلَّـٰتِى, ٱلَّذَانِ give hadhf ل (89 cases in the prototype);
  - `alifAfterWawJama`: فَآءُو, بَآءُو, جَآءُو give hadhf ا (33);
  - `doubleYa`: يُحْىِ, يَسْتَحْىِ give hadhf ي (48);
  - `wawAlifRiba`: ٱلرِّبَوٰا۟ gives badal ا→و plus ziyada ا (48 cases that the plain costs mis-split);
- or listed in `scripts/word-study/rasm-reviewed.json`:
```json
{"__format":1,"words":{"12:25:9":{"notes":[["b","ى","ا",-1,-1]],"why":"لدا الباب"},
                       "5:52:12":{"skip":true,"why":"the app's word has a space inside: دَآئِرَ ةٌۭ"}}}
```
  A reviewed entry can replace a word's notes or skip the word. If a reviewed word's derived notes change, the build fails, as `MISSING_YA_MUTAKALLIM` does (`build-irab-db.ts:237`). Any other note stops the build, which prints the list.

**D. Write.** Only groups with at least one note become rows.

**Prototype result** (Quran.com word-level imla'i vs wbw-en.db):
- 6,907 of 77,429 words (8.9%) get at least one note. Notes by kind:

| Kind | Notes |
|---|---|
| hadhf | 5,815 |
| badal | 517 |
| hamz | 498 |
| wasl | 365 (339 of them the vocative يا) |
| ziyada | 160 |

- About 270 notes (4%) are unmarked. About 220 fall under the four rules above; about 50 need hand review.
- **Limitation:** the standard texts available keep the mushaf spelling in several classical categories, so those produce no notes. Examples: ta maftuha بَقِيَّتُ (11:86), word division فَمَالِ (4:78), وَيْكَأَنَّ (28:82), بَعْدَ مَا (2:181), and the alif for nun in لَنَسْفَعًا (96:15). Covering them needs a curated list from a rasm reference, which the reviewed-file format supports (see open questions).
- The UI therefore speaks of differences from "the standard spelling", not of rasm doctrine.

### 2.4 Schema: `assets/data/rasm-v1.db`
```sql
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- format=1, kind=rasm, source_id, input_sha256, notice (verbatim notice when the licence requires one),
-- app_words, rows, notes_marked, notes_rule, notes_reviewed
CREATE TABLE sources (… same columns as in gharib-v1.db …);
CREATE TABLE rasm (
  verse_key TEXT NOT NULL, word_from INTEGER NOT NULL, word_to INTEGER NOT NULL,   -- to > from only for fasl
  imlaei TEXT NOT NULL,          -- the source's spelling of the unit, waqf/hizb marks removed, NFC
  notes TEXT NOT NULL,           -- JSON [[code, standard, mushaf, markFrom, markTo], …]
  reviewed INTEGER NOT NULL,     -- 1 when the unit is in rasm-reviewed.json
  PRIMARY KEY (verse_key, word_from)) WITHOUT ROWID;
```
- Kind codes: `h` hadhf, `z` ziyada, `b` badal, `m` hamz, `w` wasl, `f` fasl.
- `standard` and `mushaf` hold display letters from a fixed set {ا و ى ي ء أ إ آ ؤ ئ ة ت س ص ن ل}, so the UI never draws a kashida form.
- `mark` is a range of UTF-16 offsets into `imlaei`; `-1,-1` means nothing to highlight (always the case for ziyada).
- Size estimate: under 0.6 MB.

### 2.5 Build script: `scripts/word-study/build-rasm-db.ts`
```text
npx tsx scripts/word-study/build-rasm-db.ts --input <file> [--out assets/data/rasm-v1.db] [--report <file>]
```
- **Adapter** (named in the lock):
  - `tanzil`: `s|a|text` lines. Skips the `#` licence block, drops the basmala that opens N:1 for every surah except 1 and 9 (the prototype found 5,768 verses pairing 1:1), and drops waqf marks.
  - `words-json`: `{"s:a:w": "…"}`, then regrouped per verse.
- **Gates:** SHA-256 of the input; every app word in exactly one group; every note marked, covered by a rule or reviewed; `imlaei` free of markup, Latin and U+FFFD; every `mark` inside `imlaei` and on a letter.
- **Report:** wasl/fasl groups, regrouped verses, unreviewed notes.

### 2.6 Service API (both kinds)
```ts
// services/wordStudy/wordStudyFormat.ts (continued)
export type RasmKind = 'hadhf' | 'ziyada' | 'badal' | 'hamz' | 'wasl' | 'fasl';
export interface RasmNote { kind: RasmKind; standard: string; mushaf: string; mark: [number, number] | null }
export interface WordRasm { source: WordStudySource; verseKey: string; from: number; to: number;
  imlaei: string; notes: RasmNote[]; reviewed: boolean }
export interface VerseWordStudy { verseKey: string; gharib: GharibEntry[]; rasm: WordRasm[] }
export const RASM_KIND_CODE: Readonly<Record<RasmKind, string>>;   // single source of truth for the build too
export function emptyVerseStudy(verseKey: string): VerseWordStudy;
export function decodeRasmNotes(json: string): RasmNote[];          // skips bad JSON and unknown codes
export function encodeRasmNotes(notes: readonly RasmNote[]): string;
export function gharibForWord(verse: VerseWordStudy, position: number): GharibEntry[];
export function verseLevelGharib(verse: VerseWordStudy): GharibEntry[];
export function rasmForWord(verse: VerseWordStudy, position: number): WordRasm | null;

// services/wordStudy/bundledWordStudy.ts  (// @ai-generated)
export interface BundledDb { name: string; assetId: number; old: readonly string[] }
/** null until that data ships (scripts/word-study/SOURCES.md). A new build ships under a new name. */
export const BUNDLED_WORD_STUDY: Readonly<{gharib: BundledDb | null; rasm: BundledDb | null}> =
  {gharib: null, rasm: null};
// drop-in: gharib: {name: 'gharib-v1.db', assetId: require('../../assets/data/gharib-v1.db'), old: []}

// services/wordStudy/WordStudyDataService.ts  (// @ai-generated)
export class WordStudyDataService {
  constructor(dbs?: {gharib: BundledDb | null; rasm: BundledDb | null});
  /** Whether this build ships the kind. No I/O. */
  ships(kind: WordStudyKind): boolean;
  /** Gharib entries and rasm units of a Hafs verse, cached per verse. Never rejects: a kind that does
   *  not ship, or fails to open, reads as empty (a failed open is retried on the next call). */
  getVerse(verseKey: string): Promise<VerseWordStudy>;
  getGharib(hafsLocation: HafsWordKey): Promise<GharibEntry[]>;     // [] hides the section
  getRasm(hafsLocation: HafsWordKey): Promise<WordRasm | null>;     // null hides the section
}
export const wordStudyDataService: WordStudyDataService;
```
- **Opening** follows `IrabDataService.open` (`:35-53`), one lazy handle per file:
  - open the file and probe `SELECT value FROM meta WHERE key='format'`;
  - if the value is not `'1'`: close, delete, `importDatabaseFromAssetAsync(name, {assetId})`, then delete the `old` names;
  - load `sources` once.
- **Not opened at app start.** Like i'rab, the service is not registered in `AppInitializer`.
- **Wrappers.** `getGharib` and `getRasm` call `parseWordKey` (`irabFormat.ts:134`), then `getVerse`, then the pure lookups.

**How the word view calls it.** It adds the service to the existing per-part load in `IrabContent.tsx:123-127` (or the word view file from the word-view design), so the sections arrive with the card and show no spinner of their own:
```ts
const [words, appWords, verseBooks, study] = await Promise.all([
  irabDataService.getVerse(part.verseKey), wbwDataService.getVerseWords(part.verseKey),
  irabDataService.getBooks(part.verseKey), wordStudyDataService.getVerse(part.verseKey)]);
map.set(part.verseKey, {words, wordText, study});   // VerseData (:68-72) gains `study`
```
Other callers use `getGharib('2:255:3')` / `getRasm('2:255:3')`: `WordDetailSheet` if it survives, or search results.

## 3. Candidate sources (none chosen)

| For | Candidate | Licence known | Team must confirm |
|---|---|---|---|
| Gharib | Quranpedia `meanings.json.gz`: 4 books, pre-split (327 Ibn al-Ha'im, d. 815 AH; 208 Ibn al-Jawzi, d. 597 AH; 491 al-Khudayri, *al-Siraj*, 2008; 1424 Makhluf, *Kalimat al-Qur'an*). Quranpedia is already a credited source (`THIRD_PARTY_LICENSES.md:108-111`, `credits.tsx:63-65`) | The dump's `license` object (local copy): free inside apps with no attribution required; republishing "in full or in part as a downloadable database/dataset" requires crediting Quranpedia.net with a link and the dump version; "translations and contemporary works remain the property of their authors and publishers" | Permission for al-Khudayri and Makhluf, or use only the classical books. Whether the edited editions (tahqiq: ed. Dahi Abd al-Baqi for Ibn al-Ha'im, ed. Tariq Fathi al-Sayyid for Ibn al-Jawzi) add editors' text. Whether a DB committed to the public AGPL repo counts as republishing (record the link and version in `meta`, `THIRD_PARTY_LICENSES` and Credits) |
| Gharib | Quranpedia `tafsir-book-<id>` passages of classical gharib books: Ibn Qutaybah (341), al-Sijistani (27760), Abu Ubayda's *Majaz* (27769), Zayd b. Ali (27764). The same shape the i'rab build already reads | Same | A splitter per book; text quality (the passage form of Ibn al-Jawzi, 27761, looked damaged in the local copy) |
| Gharib | QUL (`credits.tsx:39`) or the Quran Foundation API (`:44`) | Per resource on QUL; Quran Foundation developer terms (local copy) | Whether either has an Arabic word-meaning resource at all |
| Rasm | Tanzil Simple, verse-level | Header (local copy): CC BY 3.0, "verbatim copies … CHANGING IT IS NOT ALLOWED", name Tanzil with a link, keep the notice in derived files. Tanzil's translation terms in `THIRD_PARTY_LICENSES.md:166-177` are a different thing | Whether storing per-word excerpts (only the words that differ, marks dropped) counts as a change. Put the notice in `meta.notice` and in `THIRD_PARTY_LICENSES` |
| Rasm | Quran.com v4 word field `text_imlaei`: same positions as wbw-en.db, and the same API wbw-en.db came from (`fetch-wbw-translations.js:21,64-66`) | Developer terms (local copy): content may not be stored longer than a week except through Content Sync, and Content Sync "does not itself authorize distributing a prepackaged database or build-time bundle" | Written permission. These terms may also bear on the existing `data/wbw/wbw-en.db` |
| Rasm | QUL "Imlaei script – Word by Word" and "Imlaei simple" | The QUL page says "We don't have copyright information for this resource" | Ask Tarteel/QUL. Locations are probably in DK numbering (map the three verses) |
| Rasm | MASAQ `Word` column: CC BY 4.0, already a pinned input of the i'rab build (`masaq.ts:16`), spells صراط with alif (`:96`) | CC BY 4.0 (adaptation allowed with attribution) | Whether it is a full imla'i spelling with harakat; whether it derives from Tanzil (then Tanzil's terms may apply); its own tokenisation (`masaq.ts:83-85`) |

## 4. UI sections in the word view

**Placement.** Both sections go in the per-word card in single-word mode, after morphology and readings, in this order: gharib, then rasm (product decision 2). Like the morphology table (`IrabContent.tsx:239`), they are hidden in whole-verse mode.

**Empty-state rule.**
- `GharibSection` returns `null` when `gharibForWord(study, position)` is empty.
- `RasmSection` returns `null` when `rasmForWord(study, position)` is null, or when the service read as empty or failed.
- Unlike `irab.noBooks`, there is no "no data" text: missing data is the normal state for many words, and for every word until a source ships.
```tsx
// components/sheets/verse-actions/word-study/GharibSection.tsx  (// @ai-generated)
interface GharibSectionProps { entries: GharibEntry[]; position: number;
  wordTextOf: (position: number) => string | undefined }   // app words of the same verse
export const GharibSection: React.FC<GharibSectionProps>;
// components/sheets/verse-actions/word-study/RasmSection.tsx  (// @ai-generated)
interface RasmSectionProps { rasm: WordRasm | null;
  uthmani: string | undefined }   // app text of the unit (word_from..word_to); damaged words left out
export const RasmSection: React.FC<RasmSectionProps>;
```

**GharibSection layout.**
- Title: `wordStudy.gharib.title`.
- One block per entry, ordered by source `ord`, then by entry `ord`:
  - When the span covers more than one word, the block starts with «…» built from the app's words (template literal, as `IrabContent.tsx:372` does), then the gloss.
  - Under the gloss, the book line `${nameAr} — ${authorAr}` (Arabic data in every language, as the Books tab shows it).
  - A gloss over 400 characters is cut, with `common:actions.showMore`/`showLess` (existing keys) and `hitSlop` to reach 44 pt.
- At the end, once per distinct `via`: `wordStudy.gharib.sources` with `{source: isolate(pickBilingualText(viaAr, viaEn))}`.

**RasmSection layout.**
- Title: `wordStudy.rasm.title`.
- Two label/value rows that follow the app direction:
  - `wordStudy.rasm.uthmani`: the app's unit text. The row is left out for damaged words.
  - `wordStudy.rasm.imlaei`: `imlaei`, with each `mark` range in `theme.colors.primary` (contrast to be checked on every reading theme). Colour is never the only signal: the note lines name the same letters.
- One line per note: the bold kind label, then `: ` as an expression (as `IrabContent.tsx:437`), then `t('wordStudy.rasm.note.<kind>', {letter|standard|mushaf: isolate(\`«${x}»\`)})`. Literal keys go through a `switch`, so the static extractor sees them.
- At the end: `wordStudy.rasm.sources`.

**Styles: MUST rules.**
- Scaling from `@/utils/scale` (`moderateScale` only).
- Arabic data (gloss, words, `imlaei`) in `ScheherazadeNew-Regular`/`-SemiBold` as in `IrabContent.tsx:74-75`, never a UI font. Size from the tafsir reading scale (16 phone, 18 tablet), line height at least 2.0× (`ipad-standards.md:133`), `writingDirection: 'rtl'`, glosses aligned to the physical right (`IrabContent.tsx:80`).
- Titles and labels in the `Manrope-*` families, which `i18n/fonts.ts` maps to IBM Plex Sans Arabic in Arabic. Titles at the ramp's `callout` SemiBold role (14/15 pt), as the ramp prescribes for card titles. Book and source lines at the `footnote` role.
- All secondary text at alpha 0.8 or more (`:422`). Do not reuse `styles.sources` or `secondary` from IrabContent (0.55 and 0.75).
- Containers reuse the morphology block's look (`IrabContent.tsx:689-695`: `text` alpha 0.04 fill, radius 10).
- No fixed heights; no `allowFontScaling={false}`.
- No width maths, so the sections work inside the centered sheet card on iPad at any width class. `useSheetWidth` is not needed.

**New helpers.**
- `utils/rtl.ts`: `export const isolate = (s: string) => \`⁨${s}⁩\`` (FSI/PDI, per `docs/i18n/README.md`, mixed-direction strings).
- `i18n/format.ts`: `export function pickBilingualText(ar: string, en: string, language = currentLanguage): string`. It uses the existing `usesArabicContent` (`:35-37`) and falls back to Arabic when `en` is empty.

**Verse-level gharib entries** are never shown in the word card. `verseLevelGharib` lets the Books tab show a per-book card with every entry of the verse, written «headword»: gloss as book text (optional task T10).

## 5. Strings (`i18n/locales/{en,ar}/sheets.json`, new top-level `wordStudy`)

Every placeholder appears in both languages.

| Key | English | Arabic |
|---|---|---|
| gharib.title | Arabic meaning (gharīb) | معنى الكلمة |
| gharib.sources | Text from {{source}}. | النص من {{source}}. |
| rasm.title | Spelling (rasm) | الرسم |
| rasm.uthmani | Mushaf | العثماني |
| rasm.imlaei | Standard | الإملائي |
| rasm.kind.hadhf | Omitted (ḥadhf) | الحذف |
| rasm.kind.ziyada | Added (ziyādah) | الزيادة |
| rasm.kind.badal | Substituted (badal) | البدل |
| rasm.kind.hamz | Hamza (hamz) | الهمز |
| rasm.kind.wasl | Joined (waṣl) | الوصل |
| rasm.kind.fasl | Separated (faṣl) | الفصل |
| rasm.note.hadhf | {{letter}} is not written in the mushaf. | حُذفت {{letter}} في رسم المصحف. |
| rasm.note.ziyada | The mushaf writes an extra {{letter}}. | زِيدت {{letter}} في رسم المصحف. |
| rasm.note.badal | {{standard}} is written as {{mushaf}} in the mushaf. | رُسمت {{standard}} في المصحف على صورة {{mushaf}}. |
| rasm.note.hamz | The hamza is written {{mushaf}} in the mushaf and {{standard}} in the standard spelling. | رُسمت الهمزة في المصحف {{mushaf}}، وفي الإملاء {{standard}}. |
| rasm.note.wasl | Written as one word in the mushaf; the standard spelling separates it. | كُتبت في المصحف كلمةً واحدة، وتُفصل في الإملاء. |
| rasm.note.fasl | Written apart in the mushaf; the standard spelling joins the words. | كُتبت في المصحف مفصولة، وتُوصل في الإملاء. |
| rasm.sources | Standard spelling from {{source}}. The differences come from comparing it letter by letter with the mushaf's spelling; unusual cases were checked by hand. Shown for the Hafs text. | الرسم الإملائي من {{source}}. والفروق مستخرجة بمقابلته بالرسم العثماني حرفًا حرفًا، وما شذّ منها رُوجع يدويًا. على رواية حفص. |

- `{{letter}}`, `{{standard}}` and `{{mushaf}}` arrive already wrapped as `isolate('«ا»')`.
- When data ships, the Credits description keys in `settings.json` (`credits.items.quranpedia`, plus a new item for the rasm source) change in English and Arabic.

## 6. Tests

| File | Covers | Fixtures |
|---|---|---|
| `services/wordStudy/__tests__/wordStudyFormat.test.ts` | encode/decode round trip; bad JSON and unknown codes skipped; `-1` gives `mark: null`; `gharibForWord` covers spans and excludes verse level; `rasmForWord` covers both words of a fasl unit | inline |
| `scripts/__tests__/wordStudyArabic.test.ts` | `rasmLetters` hints (وٰ vs وَٰ, ۟, ـٔ, ۥ after ه ignored); `matchKey` equalities (ٱلصَّلَوٰةَ=الصلاة, مَـٰلِكِ=مالك, ذَٰلِكَ=ذلك); `looseKey` | hand-typed words |
| `scripts/__tests__/wordStudyRasm.test.ts` | every example row of the §2.3 table, including the 2:25:30 hadhf-not-badal case and the no-note rows; the four pattern rules; unreviewed detection; `groupVerse` (يا fusion, 20:94, a shifted verse regrouped, a synthetic أَن لَّآ↔ألّا fasl, unpairable gives null); `readTanzil` (comment block, basmala, waqf marks) | hand-typed |
| `scripts/__tests__/wordStudyGharib.test.ts` | tiers 1–4; multi-word spans; `لاريب فيه`; clitics; a moved entry; verse-level fallback; ambiguity rule; book order; `readQuranpediaMeanings` (schema check, book filter); each splitter marker style | 2-verse JSON with invented glosses (no copied text) |
| `scripts/__tests__/wordStudyDb.test.ts` | `writeGharibDb` and `writeRasmDb` into `os.tmpdir()` (per-run root, `test-utils/jestGlobalSetup.js`), read back with better-sqlite3: schema, primary keys, `texts` id 0 and dedupe, `meta` keys; decoded with the app decoders | tiny rows |
| `services/wordStudy/__tests__/WordStudyDataService.test.ts` | nothing ships: empty results and `openDatabaseAsync` never called; ships: imported once, queried, cached per verse; stale `meta.format`: delete and reimport, then old names deleted; open failure: empty, then retried; wrappers; wbw numbering (a key in 2:181 after بَعْدَ مَا) | DBs written by the T5 writers; expo-sqlite via the extended `test-utils/mockExpoSqlite.ts` |
| `components/sheets/verse-actions/__tests__/wordStudySections.test.tsx` | `null` when empty; title, «span» only for multi-word spans, book line, source line; rasm rows, kind labels, sentences; English and Arabic (`i18n.changeLanguage('ar')`); show more/less | mocks as in `WBWContent.preferences.test.tsx:5-35` |
| At drop-in: `services/wordStudy/__tests__/gharibDatabase.test.ts`, `rasmDatabase.test.ts` | Modelled on `irabDatabase.test.ts`: every span or unit is a real word of wbw-en.db; no markup, Latin or U+FFFD; `meta` has url, version and SHA-256; row counts pinned; reviewed lines (rasm 1:4:1 [hadhf ا], 2:3:5 [badal ا→و], 2:25:30 [hadhf ا], no row for 2:9:4; gharib spans on 1:4 and 2:2 for the chosen books) | the committed assets |

- **CI.** Everything runs in the existing Test workflow (`npm run test:ci`). Scripts are type-checked by `lint.yml`'s `tsc`, and keys by `i18n.yml`. No workflow changes.
- **The CLIs are not run in CI**, because their inputs are not committed (same as `build-irab-db.ts`). Their logic lives in the tested modules; `main()` stays thin glue.

## 7. Drop-in checklist (when a source is chosen)

1. Record the source in `scripts/word-study/sources.lock.json` and `SOURCES.md`: URL, version, SHA-256, licence or permission, bilingual names, display order, `minPlaced`.
2. Run the build and read the report. Fill `gharib-reviewed.json` / `rasm-reviewed.json` until the gates pass.
3. Point `BUNDLED_WORD_STUDY.<kind>` at `require('../../assets/data/<kind>-v1.db')`. A later rebuild becomes `-v2` with `old: ['<kind>-v1.db']`.
4. Add the DB test (§6).
5. Update `THIRD_PARTY_LICENSES.md` with a section modelled on `:92-111` (include the Tanzil notice if Tanzil is used), and add Credits items in `credits.tsx` and `settings.json` (English and Arabic).
6. Attach iPad and iPhone screenshots of a word with each kind of note (`docs/design/ipad-review-checklist.md`).

## Tasks

### T1. Word-study format module (types, codes, decoders, lookups)

Create the pure module both the app and the build scripts import. It holds:
- HafsWordKey, documented as wbw numbering; the DK numbering differs at 2:181, 8:6, 13:37;
- WordStudySource, GharibEntry, RasmKind, RasmNote, WordRasm, VerseWordStudy;
- RASM_KIND_CODE (h/z/b/m/w/f), emptyVerseStudy, decodeRasmNotes / encodeRasmNotes (5-tuples; skip bad JSON and unknown codes, like irabFormat.ts:55-103);
- gharibForWord (span coverage, verse level excluded), verseLevelGharib, rasmForWord (from <= p <= to).
No React Native imports. Header `// @ai-generated`.

- **Files:** `services/wordStudy/wordStudyFormat.ts`, `services/wordStudy/__tests__/wordStudyFormat.test.ts`
- **Depends on:** none
- **Tests:** wordStudyFormat.test.ts:
- encode/decode round trip;
- '[["q",...]]' and 'not json' give [];
- mark -1 gives null;
- span coverage at the edges;
- fasl unit found from both words;
- verse-level entries excluded from gharibForWord.

### T2. Arabic letter model and matching keys for the builds

In scripts/word-study/arabic.ts:
- rasmLetters(word): letters with base, raw, hamza flag, zaid flag (۟/۠) and hints (waw/ya-for-alif, seen); gaps with small letters and seatless hamza. Use the sign table of design §2.2.
- plene(uthmani): وٰ→ا, ىٰ inside a word→ا, other ٰ→ا.
- matchKey = toSearchKey(plene(x)) without spaces, importing utils/search/normalize.ts:29 by relative path.
- alifFreeKey; looseKey (no ا و ي ى and no hamza seats, final ة/ت/ه folded, doubled letters merged).
- PROCLITICS and ENCLITICS lists.

- **Files:** `scripts/word-study/arabic.ts`, `scripts/__tests__/wordStudyArabic.test.ts`
- **Depends on:** none
- **Tests:** wordStudyArabic.test.ts:
- matchKey('ٱلصَّلَوٰةَ') === matchKey('الصَّلَاةَ');
- matchKey('مَـٰلِكِ') === matchKey('مالك');
- the non-plene key of 'ذَٰلِكَ' === matchKey('ذلك');
- rasmLetters('أَزْوَٰجٌ') has no waw-for-alif hint, rasmLetters('ٱلصَّلَوٰةَ') has one;
- ۟ sets zaid on 'لِشَا۟ىْءٍ';
- ۥ after ه in 'إِنَّهُۥ' adds no hint;
- looseKey('وَيَسْتَنۢبِـُٔونَكَ') matches after the proclitic is removed.

### T3. Rasm derivation module, pattern rules and reviewed-list format

In scripts/word-study/rasm.ts:
- groupVerse(uthmani[], standard[]): a dynamic programme over 1:1, 1:2, 1:3, 2:1 and 2:2 groups with looseKey equality; returns null when the verse cannot be paired.
- diffGroup(group): weighted edit distance, the classification table of design §2.3, and marked / rule / reviewed status per note.
- Pattern rules: lamAssimilated, alifAfterWawJama, doubleYa, wawAlifRiba.
- readTanzil: skip the # block, drop the basmala of N:1 for surahs 2–114 except 9, drop waqf marks.
- readWordJson.
- applyReviewed against rasm-reviewed.json: replace or skip; fail when a reviewed word's derived notes change.
Ship rasm-reviewed.json with {"__format":1,"words":{}}.

- **Files:** `scripts/word-study/rasm.ts`, `scripts/word-study/rasm-reviewed.json`, `scripts/__tests__/wordStudyRasm.test.ts`
- **Depends on:** T1, T2
- **Tests:** wordStudyRasm.test.ts:
- every example row of the design §2.3 table, with hand-typed standard spellings, including 2:25:30 أَزْوَٰجٌ = hadhf, not badal;
- no-note cases 2:9:4 and 2:2:1;
- each pattern rule;
- an unmarked unknown substitution reported as unreviewed;
- groupVerse: يَـٰٓأَيُّهَا vs ['يَا','أَيُّهَا'] gives one wasl group; يَبْنَؤُمَّ vs 'يَا ابْنَ أُمَّ' gives 1:3; a shifted word-level verse is regrouped; a synthetic ['أَن','لَّآ'] vs ['أَلَّا'] gives fasl; an unpairable verse gives null;
- readTanzil on a 3-line fixture with a # block and a basmala.

### T4. Gharib placement module, adapters and splitters

In scripts/word-study/gharib.ts:
- GharibInput.
- Adapters: readQuranpediaMeanings (check schema '/v1/ayah/{surah}/{ayah}/meanings', keep the locked book ids, ord in file order); readQuranpediaBook with a GHARIB_SPLITTERS registry run on the HTML before cleanBookHtml (reuse scripts/irab/build-irab-db.ts:391 for the gloss); readJsonl.
- placeVerseEntries: tiers 1–4; moved = tiers 1–3 within ±3 verses of the same surah; verse-level fallback; ambiguity rule = first candidate after the previous placed entry.
- Hand placements from gharib-reviewed.json (tier 5).
- DK text for wbw words containing U+FFFD.
Ship gharib-reviewed.json with {"__format":1,"entries":{}}.

- **Files:** `scripts/word-study/gharib.ts`, `scripts/word-study/gharib-reviewed.json`, `scripts/__tests__/wordStudyGharib.test.ts`
- **Depends on:** T2
- **Tests:** wordStudyGharib.test.ts, using inline verses (1:4, 2:2, 2:3, 2:5, 10:53) and invented glosses:
- 'يَوْمِ الدِّينِ' gives 2–3 at tier 1;
- 'وَيُقِيمُونَ الصَّلاةَ' gives 4–5;
- 'لا رَيْبَ فِيهِ' and 'لاريب فيه' give 3–5;
- 'الغيب' on 'بِٱلْغَيْبِ' gives tier 3;
- 'يستنبئونك' gives tier 4;
- an entry keyed 2:5 that only matches 2:2 is moved;
- 'وهي القيامة' stays verse level;
- a duplicated word follows the ambiguity rule;
- readQuranpediaMeanings filters books and rejects a wrong schema;
- each splitter style splits its fixture.

### T5. DB writers, build CLIs, sources lock and README

scripts/word-study/db.ts:
- DDL constants and writeGharibDb / writeRasmDb with better-sqlite3, mirroring build-irab-db.ts:631-781: journal_mode DELETE, meta, texts with id 0 = '', WITHOUT ROWID tables, VACUUM.
- Rasm notes encoded with encodeRasmNotes from T1.

build-gharib-db.ts and build-rasm-db.ts:
- thin main() under a require.main guard, with --input, --out and --report arguments;
- the SHA-256 gate against sources.lock.json;
- the gates of design §1.5 and §2.5;
- a report file.

sources.lock.json starts as {"__format":1,"gharib":[],"rasm":null}, so the CLIs refuse to run until a source is locked.

README.md documents usage, inputs, gates and the drop-in steps. SOURCES.md lists the candidates and their licence status from design §3 (not chosen), on the model of scripts/rewayah/sources/SOURCES.md.

- **Files:** `scripts/word-study/db.ts`, `scripts/word-study/build-gharib-db.ts`, `scripts/word-study/build-rasm-db.ts`, `scripts/word-study/sources.lock.json`, `scripts/word-study/README.md`, `scripts/word-study/SOURCES.md`, `scripts/__tests__/wordStudyDb.test.ts`
- **Depends on:** T1, T3, T4
- **Tests:** wordStudyDb.test.ts writes a 3-verse gharib DB and a 3-unit rasm DB to os.tmpdir() and reads them back with better-sqlite3. It checks:
- the table set, primary keys and WITHOUT ROWID;
- texts dedupe and id 0;
- the meta keys;
- that rows decode with services/wordStudy/wordStudyFormat.ts.
The CLIs are not run in CI (inputs are not committed), as with build-irab-db.ts.

### T6. Bundled-DB table and WordStudyDataService

bundledWordStudy.ts: BUNDLED_WORD_STUDY = {gharib: null, rasm: null}.

WordStudyDataService:
- one lazy handle per file, modelled on IrabDataService.ts:23-61: probe meta.format, else delete, importDatabaseFromAssetAsync, then delete the `old` names;
- sources loaded once; a per-verse cache that never stores a failure;
- getVerse never rejects; getGharib / getRasm built on parseWordKey (irabFormat.ts:134);
- ships(kind); constructor injection for tests; queries of design §1.6 and §2.4.

Extend test-utils/mockExpoSqlite.ts with importDatabaseFromAssetAsync (copies a registered fixture file into databaseDir(), a no-op when the file exists, as in expo-sqlite), deleteDatabaseAsync and registerAssetFile(assetId, file). Wrap the additions in @ai-start/@ai-end.

- **Files:** `services/wordStudy/bundledWordStudy.ts`, `services/wordStudy/WordStudyDataService.ts`, `services/wordStudy/__tests__/WordStudyDataService.test.ts`, `test-utils/mockExpoSqlite.ts`, `test-utils/__tests__/mockExpoSqlite.test.ts`
- **Depends on:** T1, T5
- **Tests:** WordStudyDataService.test.ts uses fixture DBs written with T5 writers in beforeAll and jest.mock('expo-sqlite') over the extended mock. Cases:
- nulls give emptyVerseStudy and no openDatabaseAsync call;
- imported once and cached per verse;
- a format mismatch triggers a reimport and deletes the old names;
- an open failure gives empty, and the next call retries;
- getGharib('1:4:2') returns a span entry;
- getRasm('2:3:5') returns badal;
- getRasm('2:9:4') returns null.
mockExpoSqlite.test.ts covers the import no-op and delete.

### T7. GharibSection, RasmSection, helpers and en/ar strings

Build the two components as in design §4. They return null when empty, use Scheherazade for Arabic data with line height at least 2.0×, put UI text through t(), keep secondary text at alpha 0.8 or more, reuse common:actions.showMore/showLess, and resolve kind keys through a literal switch.

Add:
- isolate() to utils/rtl.ts;
- pickBilingualText() to i18n/format.ts (wrapped in @ai markers);
- the 18 wordStudy keys of design §5 to both sheets.json files.

Run npm run i18n:check and npx jest i18n/. Follow docs/design/ipad-review-checklist.md.

- **Files:** `components/sheets/verse-actions/word-study/GharibSection.tsx`, `components/sheets/verse-actions/word-study/RasmSection.tsx`, `utils/rtl.ts`, `i18n/format.ts`, `i18n/__tests__/format.test.ts`, `i18n/locales/en/sheets.json`, `i18n/locales/ar/sheets.json`, `components/sheets/verse-actions/__tests__/wordStudySections.test.tsx`
- **Depends on:** T1
- **Tests:** wordStudySections.test.tsx, with react-test-renderer and the mocks from WBWContent.preferences.test.tsx:
- null for [] and for null;
- gharib title, gloss and book line; «span» only for spans longer than one word; the sources line uses the via picked by language;
- the rasm Mushaf and Standard rows; the Mushaf row left out without app text; one line per note with the kind label;
- English and Arabic (i18n.changeLanguage('ar')), with letters wrapped in FSI/PDI;
- show more/less above 400 characters.
format.test.ts covers pickBilingualText for en, ar, and an empty English value.

### T8. Wire the sections into the word view

In the word view (IrabContent.tsx, or the file the word-view design creates):
- add wordStudyDataService.getVerse(part.verseKey) to the per-part Promise.all at :123-127;
- add `study` to VerseData at :68-72;
- in renderWordCard (:206-251), single-word mode only, after morphology and readings, render GharibSection with gharibForWord(study, word.position) and wordTextOf, then RasmSection with rasmForWord and the unit's app text (join wordText for from..to).
Wrap the edits in @ai-start/@ai-end. If the word-view PR lands first, add both to its list of sections instead. Attach iPad and iPhone screenshots from a dev build using a local fixture DB, and show the hidden state with the shipped nulls.

- **Files:** `components/sheets/verse-actions/IrabContent.tsx`, `components/sheets/verse-actions/__tests__/IrabContent.wordStudy.test.tsx`
- **Depends on:** T6, T7
- **Tests:** IrabContent.wordStudy.test.tsx mocks irabDataService, wbwDataService, wordStudyDataService and WBWVerseView. It checks:
- the sections appear for the selected word only when there is data;
- they disappear in whole-verse mode;
- a getVerse that resolves empty leaves the i'rab card unchanged;
- selecting another word of the same verse makes no new service call (cache).

### T9. Data drop-in once sources are chosen (data-only PR)

Lock the chosen inputs (SHA-256, version, licence or permission, bilingual names, order, minPlaced). Run the build CLIs, review the reports, and fill the reviewed JSON files until the gates pass. Commit assets/data/gharib-v1.db and/or rasm-v1.db. Point BUNDLED_WORD_STUDY at them. Add the DB tests. Update THIRD_PARTY_LICENSES.md with sections modelled on :92-111; for Tanzil, include the verbatim notice and the link. Update Credits in credits.tsx and settings.json (en/ar), and record the licence status in SOURCES.md.

- **Files:** `assets/data/gharib-v1.db`, `assets/data/rasm-v1.db`, `services/wordStudy/bundledWordStudy.ts`, `services/wordStudy/__tests__/gharibDatabase.test.ts`, `services/wordStudy/__tests__/rasmDatabase.test.ts`, `scripts/word-study/sources.lock.json`, `scripts/word-study/SOURCES.md`, `scripts/word-study/gharib-reviewed.json`, `scripts/word-study/rasm-reviewed.json`, `THIRD_PARTY_LICENSES.md`, `app/(tabs)/(d.settings)/credits.tsx`, `i18n/locales/en/settings.json`, `i18n/locales/ar/settings.json`
- **Depends on:** T5, T6, T8
- **Tests:** gharibDatabase.test.ts and rasmDatabase.test.ts, modelled on irabDatabase.test.ts:
- every span or unit is an existing wbw-en.db word;
- no markup, Latin or U+FFFD in texts;
- meta has url, version and SHA-256, plus the notice when required;
- row counts are pinned;
- reviewed lines hold: rasm 1:4:1 [hadhf ا], 2:3:5 [badal ا→و], 2:25:30 [hadhf ا], no row for 2:9:4; gharib spans on 1:4 and 2:2 for the chosen books.
A manual pass of the screenshots against the UI review checklist.

### T10. Optional: verse-level gharib in the Books tab; qiraatan note

(a) BooksTab (IrabContent.tsx:446-517) gets one card per gharib source from verseLevelGharib or study.gharib, written «headword»: gloss as book text. This needs the decision on the Arabic tab label كتب الإعراب.
(b) A seventh rasm kind 'qiraatan' (ما فيه قراءتان): a Hafs word whose undotted letter skeleton (ignoring dots and small letters) equals a different reading's word in one of the dk_words_<id>.db files (DK locations mapped to wbw), for example 1:4:1 مالك/ملك and 2:9:6 يخدعون/يخادعون. It needs scholarly review and new strings.

- **Files:** `components/sheets/verse-actions/IrabContent.tsx`, `scripts/word-study/rasm.ts`, `services/wordStudy/wordStudyFormat.ts`, `i18n/locales/en/sheets.json`, `i18n/locales/ar/sheets.json`
- **Depends on:** T8, T9
- **Tests:** (a) A render test that the Books tab lists verse-level entries per source.
(b) wordStudyRasm.test.ts cases for 1:4:1 and 2:9:6 against inline rewayah words, and a word whose readings differ in more than the skeleton (no note).

## Risks

- Licences block shipping. No candidate is cleared for bundling.
- Quranpedia's own licence keeps contemporary works with their owners (al-Khudayri 2008, Makhluf, al-Kawari), and dataset republishing needs credit plus the dump version.
- Tanzil's text terms forbid changing the text, and per-word excerpts with marks stripped may count as a change.
- QUL lists no copyright for its imla'i script.
- Quran Foundation developer terms forbid prepackaged bundles of its content without a written licence.
- MASAQ's text may derive from Tanzil.
- The Quran Foundation developer terms (local copy) may also apply to the existing data/wbw/wbw-en.db, which scripts/fetch-wbw-translations.js fetched from api.quran.com. This is outside this topic but worth a legal check.
- Wrong word attribution of a gloss would mislead a reader about Quranic meaning. Ambiguous (1.3%), moved (0.8%) and loose-tier (1.4%) placements must be reviewed from the report. If review capacity is short, keep tier 4 and moved entries at verse level.
- Rasm notes describe differences from the chosen standard text, not classical rasm doctrine. The available standard texts keep ta maftuha, most wasl/fasl and the tanwin alif, so those notes are missing. The UI wording must stay 'standard spelling', and a scholar should review before release.
- Scheherazade New must render every Uthmani small sign used (U+06DF, U+06E0, U+06E5–U+06E8, U+06DC, U+06E3) and show highlighted ranges correctly. It also looks different from the Digital Khatt glyphs at the top of the word view, which may confuse readers. Check on device.
- Existing IrabContent styles break MUST rules: secondary alpha 0.75 and 0.55 (:522, :746) and Arabic line pitch 1.76× (:655-656). The new sections must not copy them. Fixing them changes i'rab visuals, which conflicts with the phones-pixel-identical lesson in docs/design/README.md, so coordinate with the word-view PR.
- Numbering mismatch: rewayah and DK locations differ from wbw positions in 2:181, 8:6 and 13:37. A caller passing a DK 's:a:w' gets the wrong word after بَعْدَ مَا. The API documents wbw numbering and a test pins it.
- Source drift: Quranpedia corrects its dumps continuously and Tanzil updates its text. A rebuild on a new version can move placements or notes. SHA-256 pins, pinned row counts and the reviewed-lines tests catch it; plan a re-review on every refresh.
- The 55 wbw words with U+FFFD need DK text in the build, and the app shows no Uthmani row for them. The app's word 5:52:12 'دَآئِرَ ةٌۭ' has a space inside it and would read as a fake wasl unless skipped.
- Coverage: Quranpedia's meanings cover 4,799 of 6,236 verses, so many words will have no gharib section. That is by design, but users may read the gap as missing content.
- The evidence comes from local, unverified copies of downloads made earlier in this session, outside this task. The percentages and counts are indicative and must be re-measured on the official downloads.
- Merge conflicts: T8 edits IrabContent.tsx, which the word-view and readings designs also change. Keep the T8 diff small, or land it inside the word-view PR.

## Open questions (answered in README.md)

- Which gharib source or sources and books?
- Classical only (Ibn al-Ha'im, Ibn al-Jawzi, Ibn Qutaybah, al-Sijistani), or also contemporary (al-Khudayri's al-Siraj, Makhluf's Kalimat al-Qur'an), which need permission?
- How many books per word, and in what order?
- Which standard (imla'i) text for rasm?
- Ask Tanzil whether per-word excerpts are acceptable, seek written permission from Quran Foundation or QUL, or evaluate MASAQ's Word column (CC BY 4.0)?
- Should rasm cover the classical categories the standard texts don't expose (ta maftuha, the full wasl/fasl list, the alif for nun)? That needs a curated list from a rasm reference such as al-Dani's al-Muqni' or Abu Dawud's Mukhtasar al-Tabyin. Who reviews it?
- Should a 'ما فيه قراءتان' rasm note be derived from the bundled rewayat words DBs (T10b), linking rasm to the per-word readings?
- Where should verse-level gharib entries show (T10a, the Books tab)? If there, should the Arabic tab label 'كتب الإعراب' change?
- Should loose-tier (tier 4) and neighbour-verse placements show on words, or stay at verse level until reviewed?
- Section titles: should they use the UI font as specified here, or Scheherazade like the existing morphTitle (IrabContent.tsx:696-703)? Does the word-view PR fix IrabContent's alpha and line-height MUST violations?
- Should the normalisation used here (plene, looseKey, clitic stripping) move to utils/search/normalize.ts so the word-search design shares it?
- Should WordDetailSheet also show these sections if it survives the word-view redesign, or should it just open the word view?
- Should the Arabic section name be 'معنى الكلمة' or the classical 'الغريب' / 'غريب القرآن'? Should gharib glosses later feed an Arabic meaning search?
