<!-- @ai-generated -->
# Word Study: one word view inside the ayah selection

> Design written against `develop` at `b0a151ce` (2026-11-14) by a read-only design agent. Decisions that override it are in [README.md](README.md); where they disagree, README.md wins.

## Summary

The I'rab screen grows into the word view: a `words` screen of VerseActionsSheet titled Word Study / دراسة الكلمات, offered for one verse and for multi-verse selections, with tabs Words / الكلمات and I'rab books / كتب الإعراب.
Words tab: the grid of the current verse (cut to the selection's own words for another rewayah), with a fixed bottom bar (Previous / Next) that steps through every word of the selection, across verses. The bar follows the Quran's reading direction. Selections that span several verses also get verse chips.
Word card, top to bottom: header (the mushaf's own word, transliteration, English meaning, Play, reference), then Readings (all 8 rewayat grouped by reader, open by default when any differs, the selection's rewayah marked Current), I'rab, Morphology (a root chip that opens root search, the lemma, Show more), Arabic meaning, Rasm. A section with no data for the word is not drawn.
Another rewayah: all word data stays Hafs and is labelled with a Hafs chip and note; the Readings section shows how the selected rewayah reads the word.
WordDetailSheet is deleted. Long-pressing a word in a list or player word-by-word grid selects its verse and opens the verse sheet on that word (payload `initialScreen: 'words'` plus `word`).
A shared alignment between the mushaf's (DigitalKhatt) words and the word-by-word words gives each word its slot locations for the readings lookup. It also fixes today's mispaired grids in 25:42 and 27:26. Readings, gharib and rasm come through null-returning ports, so their sections stay hidden until the data lands.
Plan: 3 PRs and 12 tasks (2 optional), each with unit and component tests. The VerseItem Hafs golden file changes on purpose.

## Current state

### Verse actions sheet (`components/sheets/VerseActionsSheet.tsx`)
- Screens are an `ActiveScreen` union (:103-115) with title keys (:118-130). A sub-screen gets a back row titled from that map (:773-791) and the sheet takes 85% of the window height (:137, :758). `isFullScreen` screens get `flex: 1` (:745-751, :830-887).
- The selection is built once: `useVerseSelection` returns a `ReadyVerseSelection` (`components/share/rewayahVerseSelection.ts:85-116`) with `keys` in the shown rewayah's numbering, `hafsKeys`, and for another rewayah `units` plus `model`. A Hafs selection comes from the payload's Hafs keys (:165-188); another rewayah's from `unitKeys` or the Hafs-to-rewayah mapping (:191-260). The selection is memoized on content (`components/share/useVerseSelection.ts:33-60`). While another rewayah's units load or are refused, every screen is replaced by `SelectionPendingView` (:155-200, :824-829).
- The Explore card offers Tafseer, Theme, Word by Word and I'rab only for a single verse (`!isRange` at :1063, :1083, :1103-1138). The I'rab row is the only row without `accessibilityRole` (:1122-1136).
- The I'rab screen gets the Hafs `surahNumber` / `ayahNumber`, `rewayah`, and `unitStart` = the FIRST selected unit only (:323-329, :867-875).
- The payload (`components/sheets/sheets.tsx:190-219`) cannot open a screen directly. Closing the sheet clears both selection stores (:728-732).

### I'rab screen (`components/sheets/verse-actions/IrabContent.tsx`)
- Its parts are every Hafs verse holding the first unit (`wbwParts`, `verseUnitScreens.ts:151-161`). For each part it loads i'rab, word-by-word words and books one after another (:112-149).
- Text for in-line word references comes from the word-by-word `textUthmani`; damaged words are skipped (:128-133).
- Layout: tabs Words / Books with role `tab` (:257-270). One `WBWVerseView` per part with `selectOnTap` (:297-320). A 'Whole verse' / 'One word' toggle drawn in `theme.colors.primary`, with no role (:322-334, :593-602). The card of the selected word shows its entries, the agreed mark and the morphology table; the table is hidden in whole-verse mode (:206-251). References are tappable within the parts (:196-204, :360-383). Books tab at :446-517. Secondary text uses 0.75 alpha (:522).
- Missing: previous / next, a header with meaning, transliteration and audio, and readings. There is no test file for it.

### WordDetailSheet (`components/sheets/WordDetailSheet.tsx`)
- Registered as `word-detail` (`sheets.tsx:42, :90, :271-276`). It opens only from a long-press on a word in a list or player word-by-word grid (`VerseItem.tsx:428-438` for Hafs rows, `:443-450` for rewayah rows); the payload is a Hafs verse plus a word-by-word position.
- It draws the word-by-word `textUthmani` in the `'Uthmani'` face (being retired) at `moderateScale(36)` (:174-176, :268-275). 56 word-by-word words contain U+FFFD (for example 2:4:9 `قَبْ��ِكَ`) and show broken.
- Transliteration and meaning appear only when the grid settings are on (:28-31, :179-190). The English gloss is off by default in the Arabic UI.
- A play pill uses a hand-rolled expo-audio player (:92-152) and a qurancdn URL built from the word position (:83-90). A footer reads 'Verse 2:255 · Word 3 of 50' (:227-233).
- It has no link to the i'rab and no next / previous.

### Word grid (`components/player/v2/PlayerContent/QuranView/WBWVerseView.tsx`)
- It draws the Hafs DigitalKhatt words (`useRewayahWords(verseKey,'hafs')`, :377) and pairs them with word-by-word words in an inline loop that accumulates text (:404-465).
- I re-ran that loop over the bundled databases (read-only script): a DigitalKhatt slot position differs from the word-by-word position only in 2:181, 8:6 and 13:37, where DigitalKhatt splits بَعْدَ مَا into two slots.
- The loop mispairs two verses:
  - 25:42: word-by-word word 9 contains U+FFFD. From DigitalKhatt word 10 on, every Arabic word gets the previous word's gloss and position, and the ۝ marker is drawn as word 17.
  - 27:26: the word-by-word text `ٱلْعَظِيمِ ۩` ends with U+200F, so the marker is drawn inside word 8.
- `wordRange` cuts a Hafs verse down to a rewayah verse's slots (:99-104, :454-462). The canvas is one Pressable with no per-word accessibility (:738-746).
- WBWContent shows one grid per Hafs part; a long-press only highlights the word (`WBWContent.tsx:105-125, :152-157`).

### Data
- Word by word: `wbwDataService.getVerseWords` returns `[]` until the service is initialized (`services/wbw/WBWDataService.ts:64-69`). It is initialized at startup (`services/AppInitializer.ts:444`).
- I'rab: per Hafs verse, keyed by word-by-word position (`services/irab/IrabDataService.ts:63-85`). Morphology facts are Arabic label / value pairs (`irabFormat.ts:29-43`). `الجذر` is the root as spaced letters (1,642 roots, all 3 or 4 letters) and `الأصل المعجمي` is the lemma; `scripts/irab/sarf.ts:394-399` writes both. 20,586 words have no lemma.
- Readings data: `dk_words_<id>.db` keeps the Hafs slots. `<id>-diff.json` (format 2) marks whole-word variants (`major` / `mukhtalif`) and silah (`services/mushaf/RewayahDiffService.ts:41-56`, `components/sheets/rewayahDiffLegend.ts:10-17`). Some slots carry an inline verse marker (Warsh 1:7:4 is `عَلَي۟هِم۟ ۝٦`). Five word slots are blank because two Hafs words are written as one there (Warsh 15:7:1 is `لَّو۟مَا` and 15:7:2 is empty).
- Fonts: DigitalKhattV1 and V2 are registered for React Native `Text` (`AppInitializer.ts:376-389`). `getDkFontFamily` picks the face for a renderer and rewayah (`store/mushafSettingsStore.ts:82-91`). `SkiaVerseText` draws given words or a string and supports `textAlign` (`QuranView/SkiaVerseText.tsx:66-97`). The pattern for drawing short rewayah text is in `components/collection/CollectionVersePreview.tsx:120-160`.

### Tests and CI that touch this
- `components/sheets/__tests__/VerseActionsSheet.units.test.tsx` mocks IrabContent (:52) and presses "I'rab" (:475, :563). `VerseActionsSheet.playback.endToEnd.test.tsx:46`, `VerseActionsSheet.playback.endToEnd.alldbs.test.tsx:40` and `VerseActionsSheet.similarVerses.test.tsx:34` mock it too.
- `QuranView/__tests__/VerseItem.unitRow.test.tsx:503-513` expects `word-detail`. The Hafs golden file records it (`QuranView/__fixtures__/verseItemHafs.golden.json:1580`, scenario at `VerseItem.hafsGolden.test.tsx:239`). `sheetRegistry.test.ts:83-88` lists the retired verse sheets.
- CI: Jest on Node 22 (`.github/workflows/test.yml`), a blocking `tsc` (`lint.yml`), and a blocking `npm run i18n:check` (`i18n.yml`).

### Rules that bind the design
- On iPad, sheets are centered cards at most 560 wide and 760 tall (`components/sheets/AdaptiveActionSheet.tsx:30-34`).
- Reading standards: Quranic text only in the user's mushaf face, sized from `arabicFontSize` in points and never through `moderateScale` (`docs/design/reading/04-reading-standards.md:26-29`). Stepper buttons need a role, a label and a state (:93). Every number goes through `localizeDigits` (:102).
- iPad standards: 44pt targets (`docs/design/ipad-standards.md:244`), secondary text at 0.8 alpha or more (:422), and the reader's arrows follow the Mushaf's direction (:269).
- Strings today: `wordDetail.context` (en `i18n/locales/en/sheets.json:80-82`, ar `:92-94`), `verseActions.irab` (en :192, ar :216), and `irab.*` (en :404-424, ar :452-472).

## Design

## 0. Decisions at a glance

| | Decision |
|---|---|
| (a) Where | The I'rab screen becomes the word view. It is a `words` screen of `VerseActionsSheet`: the row and title are **Word Study / دراسة الكلمات**. It is offered for one verse **and** for multi-verse selections. Tabs: **Words / الكلمات** (the word view) and **I'rab books / كتب الإعراب** (today's Books tab). There is no new sheet and no new gesture on the mushaf page. |
| (b) Stepping | Tap a word in the grid, as today, or use a fixed bottom bar (Previous / Next) that walks every word of the whole selection in reading order, across verses. The grid shows the verse holding the current word; a selection of several verses also gets verse chips. **Another rewayah:** the Hafs words of the selected verses only, with all word data marked as Hafs; Readings marks the selection's rewayah. |
| (c) Layout | Header (word, transliteration, English meaning, Play, reference), then Readings, I'rab, Morphology (root chip, lemma, Show more), Arabic meaning, Rasm. Empty sections are not drawn. Whole-verse mode is today's list of every word's i'rab, each card headed by its word and meaning. |
| (d) WordDetailSheet | Deleted. Long-pressing a word in a list or player word-by-word grid opens `verse-actions` on the Word Study screen at that word, with the verse selected. |
| (e) States | Loading and error states per section; a section with no data is hidden. The step bar follows the Quran's direction. 44pt targets; every control has a role, a label and a state. The iPad card uses the phone layout. |
| (f) i18n | `verseActions.wordStudy` plus a `wordView.*` block (§7). `wordDetail.context`, `irab.tabWords` and `irab.tapWord` are removed. |
| (g) Tests | Pure model and alignment (including a test over the bundled databases), the data hooks, two component suites, updated sheet and VerseItem tests, and the intended change to the Hafs golden file. |

## 1. (a) Placement and naming

- **Why this screen.** It already has the grid, the per-word card, whole-verse mode and the Books tab. A new parallel screen would mean two word views. The I'rab row is renamed because the screen is now about the word: readings, meaning, audio, i'rab and morphology. I'rab stays one tap in, as a titled section and in the I'rab books tab.
- **`VerseActionsSheet.tsx` changes:**
  - `ActiveScreen`: `'irab'` becomes `'words'` (:103-115).
  - `SCREEN_TITLE_KEYS.words = 'verseActions.wordStudy'` (:118-130).
  - `'words'` joins `isFullScreen` (:745-751).
  - `handleIrab` becomes `handleWordStudy` (:463-465).
  - It renders `<WordStudyContent selection={readySelection} initialWord={wordTarget} onRootPress={handleRootPress} onBack={handleBack}/>` instead of IrabContent (:867-875), guarded by `readySelection &&` as community-reflections is.
- **The row** keeps the `file-tree-outline` icon and gains `accessibilityRole="button"`. It moves out of the `!isRange` group (:1103-1138). For one verse it follows Word by Word; for a range it is the second row of the Explore card, after Translation. The I'rab books tab shows the books of every Hafs verse in the selection, as it does today for a verse that spans two Hafs verses.

## 2. (b) Stepping word by word

- **The sequence** (`buildWordSequence`, §6) is built for each part from `selectionWordParts(selection)`. A part's words are the word-by-word words whose first DigitalKhatt slot lies in the part's `wordRange`, in reading order, without the verse-end marker. Each word knows:
  - its Hafs verse key and word-by-word position (the key of the i'rab, meaning and audio);
  - its DigitalKhatt slot locations 'S:A:W' (the readings key; two slots for بَعْدَ مَا in 2:181, 8:6 and 13:37);
  - its DigitalKhatt text (the header, and the references in i'rab text).
- **The grid** is one `WBWVerseView` for the current part, with `verseKey`, `wordRange`, `rewayah={selection.rewayah}` (it keeps its own Hafs notice), `selectOnTap`, `showTranslation={false}` and `selectedWordPosition`.
  - A tap selects that word.
  - In whole-verse mode a tap switches to one-word mode at that word, as today (`IrabContent.tsx:187-189`).
  - The grid wrapper is one accessible element labelled `wordView.gridLabel` with the hint `wordView.gridHint`, because the canvas has no per-word targets (`WBWVerseView.tsx:738-746`). The step bar is the accessible path to every word.
- **The step bar** sits outside the ScrollView at the bottom of the screen and holds `[Previous] [Word n of N] [Next]`.
  - It moves ±1 through the whole selection, crossing verses, and is disabled at either end (no wrap-around).
  - The counter uses `irab.wordOf` with n and total counted over the selection.
  - **Direction:** it follows the Quran text in both UI languages. Next is on the physical left with a left chevron and Previous on the right with a right chevron. The bar and the inside of each button use `ROW_FROM_RIGHT` (`IrabContent.tsx:81`), and the chevrons are not mirrored with `flipX`. This matches the reader, whose arrows follow the Mushaf's direction (`ipad-standards.md:269`), and the rule against mirroring the Quran page (`docs/i18n/README.md:112`).
  - Each button has role button, labels `wordView.previousWord` / `wordView.nextWord`, `accessibilityState.disabled`, a minimum 44×44pt target and 8pt spacing. It uses `useHover()` for the iPad pointer.
- **After a step:** if the card's top is above the viewport, scroll to it with `ScrollView.scrollTo`, animated unless Reduce Motion is on (`useReducedMotion`). Then announce `wordView.announce`: `AccessibilityInfo.announceForAccessibility` on iOS, and `accessibilityLiveRegion="polite"` on the counter for Android. A tap in the grid does not scroll.
- **Verse chips**, only when there are two or more parts:
  - A wrapping row in Quran order (`ROW_FROM_RIGHT`, the first verse at the physical right).
  - Labels: `localizeDigits('2:3')` in a Hafs range; `irab.hafsVerse` ('Hafs 103:2') for another rewayah.
  - A tap goes to the first word of that verse, or to that verse's list in whole-verse mode.
  - Role tab with selected state; 36pt tall with a 4pt vertical `hitSlop` (44pt in all), at least 44pt wide, 8pt gaps.
  - A horizontal scroller was rejected because of Android scroll-offset problems in RTL (`docs/i18n/README.md` §Right-to-left).
- **The first word** is `initialWord` (the payload's `word`, or a long-press in the Word by Word screen) when it is in the sequence, else the first word.
- **Another rewayah** (examples from the real Warsh slots in `services/mushaf/__fixtures__/verseUnitsFixture.json`):

  | Selection | Parts | Steps |
  |---|---|---|
  | Warsh 1:6 | Hafs 1:7, words 1-4, captioned 'Hafs 1:7', grid cut to those words | 4 |
  | Warsh 1:7 | Hafs 1:7, slots 5-10 | 5 (the marker is not a step) |
  | Warsh 1:6 + 1:7 | the whole of Hafs 1:7 | 9 |
  | Warsh 103:1 | Hafs 103:1 and 103:2, two chips | 5 |
  | Warsh 1:5 | Hafs 1:6, captioned | 3 |

  An i'rab reference to a word outside the sequence shows as a plain quoted word and cannot be tapped (`canOpen`, §6). Units that are still loading or were refused keep showing `SelectionPendingView`.

## 3. (c) The word card

```
┌ ‹ Word Study ───────────────────────────────┐
│ [ Words | I'rab books ]                      │
│ [Hafs 103:2] [Hafs 103:1]   (several only)   │
│ Word-by-word shown in Hafs   (other rewayat) │
│ ┌ grid of the current verse, word lifted ──┐ │
│ Tap a word to study it         (Whole verse) │
│ ┌──────────────────────────────────────────┐ │
│ │ [Hafs]        ٱلْإِنسَٰنَ                    │ │ header
│ │               l-insāna · 'man'           │ │
│ │       [▶ Play]   Hafs 103:2 · word 2     │ │
│ │ Meaning, audio, i'rab … are for Hafs.    │ │ (other rewayat)
│ ├ Readings          1 rewayah differs   ▴ ─┤ │
│ │ ASIM      Hafs              ٱلْإِنسَٰنَ   │ │
│ │ NAFI'     Warsh  Current  اَ۬لِانسَٰنَ [Word variant] │
│ ├ I'rab                        ✓       ▴ ─┤ │
│ ├ Morphology (ṣarf)                    ▴ ─┤ │
│ │ الجذر  [ء ن س ⌕]   الأصل المعجمي  إِنسَٰن │ │
│ │ Show more ▾                               │ │
│ ├ Arabic meaning   (hidden with no data)  ─┤ │
│ └ Rasm             (hidden with no data)  ─┘ │
│ sources footnote (irab.sources)              │
├──────────────────────────────────────────────┤
│ ‹ Next          Word 2 of 5        Previous › │ fixed step bar
└──────────────────────────────────────────────┘
```

- **Header** (always shown):
  - **The word:** the DigitalKhatt Hafs text of its slots, never the word-by-word `textUthmani`, so the 56 damaged entries are never shown. It is drawn with `SkiaVerseText` in `words` mode (the slots, `rewayah='hafs'`, `textAlign='center'`), in `getDkFontFamily(renderer,'hafs')` at `round(arabicFontSize × 1.4)` points (36 at the default setting, the size WordDetailSheet used). Tajweed, Allah-name highlight and text weight follow the settings, as in the grid. If `fontMgr` is null it falls back to React Native `Text` in `rnQuranFontFamily`. The wrapper has role header, `accessibilityLabel` = the plain text, and `accessibilityLanguage='ar'`.
  - **Transliteration** in italic and the **English meaning** in quotes, both with `writingDirection:'ltr'`. Both are always shown here, whatever the grid settings, because this view is where users look them up.
  - **The Play pill** uses `useWordAudio(wordAudioUrl(...))`. It shows `common:actions.play` / `pause` and `common:status.loading`, and `wordView.audioFailed` (tap again to retry). Role button, label `wordView.playWord`, `accessibilityState.busy` while loading, at least 44pt.
  - **The reference:** `wordView.wordRef` ('2:255 · word 3', or 'Hafs 1:7 · word 5' for another rewayah).
  - **Another rewayah:** a chip with `getShortLabel('hafs')` and the line `wordView.hafsNoteReadings`, or `wordView.hafsNote` when the Readings section is absent.
- **Readings** (`WordReadings.tsx`):
  - Eight rows grouped by reader (`READING_GROUPS`: Asim [Hafs, Shu'bah], Ibn Kathir [al-Bazzi, Qunbul], Nafi' [Warsh, Qalun], Abu 'Amr [al-Duri, al-Susi]), each with a reader overline.
  - Each row: `getShortLabel(id)`, then the word in `rnQuranFontFamily(renderer, id)` at `round(arabicFontSize × 0.85)` points with line height 2×, then a tag. The tags reuse `settings:mushafSettings.legendV2.labels.wordVariant` and `.silah`.
  - The row of `selection.rewayah` gets a Current tag and a fill of text at 0.06 alpha, so the state is not shown by colour alone.
  - An empty text shows '—' with `wordView.readings.blank`.
  - Footnote `wordView.readings.scope`: only the written text is compared; tashil, imala and taqlil are not marked.
  - Collapsed summary: `wordView.readings.same`, or the plural `wordView.readings.differ`.
  - The view never compares strings itself: `differsFromHafs` and the kind come from the readings data.
- **I'rab:** title `verseActions.irab`, then `IrabEntryList` (today's `EntryRow`s and agreed mark). If the i'rab database failed, `irab.loadFailed` shows inside the section and Morphology is hidden.
- **Morphology:** title `irab.morphology`.
  - The root row (`MORPH_ROOT_LABEL`) is a chip with a search glyph. It calls `onRootPress(rootSearchKey('م ل ك'))`, so `'ملك'`; role button, label `wordView.morphology.searchRoot`. With no `onRootPress` it is plain text.
  - Then the lemma row (`MORPH_LEMMA_LABEL`).
  - `common:actions.showMore` / `showLess` reveals the other facts in data order through `MorphTable`.
  - Labels are the data's Arabic labels, as today.
- **Arabic meaning (gharib):** title `wordView.gharib.title`. The text is in the i'rab prose style, followed by `wordView.source`.
- **Rasm:** title `wordView.rasm.title`. Shows `wordView.rasm.imlai` with the standard spelling in the DigitalKhatt face, the notes as a list, then `wordView.source`.
- **Opening and closing sections:**
  - Default state: Readings is open when any rewayah differs and closed otherwise; I'rab, Arabic meaning and Rasm are open; Morphology shows root and lemma with the other facts closed.
  - A user's toggle wins for the rest of that screen session. The state lives in component state and resets when the screen is left.
  - Each section header is a Pressable with role button, `accessibilityState.expanded`, a label of title plus summary, a minimum height of 44 and `useHover()`.
  - Gharib and Rasm have no header at all when there is no data.
- **Whole-verse mode** (the `irab.showAll` / `irab.showWord` pill, now in text-alpha tokens instead of `primary`):
  - One compact card per word of the current verse: the word (React Native `Text`, `rnQuranFontFamily`, `arabicFontSize × 0.85`), its English meaning and 'word n', then the i'rab entries and agreed mark. Morphology is hidden, as today.
  - A `wordView.readings.differChip` appears only if the optional `loadVerseReadingVariants` port returns data.
  - Tapping a card opens one-word mode at that word (role button, label `wordView.studyWord`).
  - The step bar is hidden; the chips switch verse.
  - Cards are drawn with `map`: one verse at most, 128 words in 2:282, the same as today's `showAll`.
- **Footer:** `irab.sources`.

## 4. (d) Unifying WordDetailSheet

- **Payload** (`sheets.tsx`):

  ```ts
  'verse-actions': SheetDefinition<{payload: {
    // ...existing fields
    /** Open on this screen instead of the action list. @ai */
    initialScreen?: 'words';
    /** With initialScreen: the word to open on (Hafs verse key + word-by-word position). @ai */
    word?: {verseKey: string; position: number};
  }}>;
  ```

- **`VerseActionsSheet.tsx`:**
  - `useState<ActiveScreen>(payload?.initialScreen === 'words' ? 'words' : null)`. The sheet component unmounts when hidden (`react-native-actions-sheet` `provider.js:174`), so this runs on every show.
  - `const [wordTarget, setWordTarget] = useState(payload?.word)`. The row clears it.
  - Back from a word that opened the sheet goes to that verse's action list, as for any screen.
- **`VerseItem.tsx`, Hafs rows** (`handleWordPress`, :428-438):
  - `setSelectedWordPosition(position)`, then `selectVerse(verseKey, surah, ayah)`.
  - Then `SheetManager.show('verse-actions', {payload: {...the long-press payload (:372-383), initialScreen: 'words', word: {verseKey, position}}})` with `.then(() => setSelectedWordPosition(null))`.
  - Build the long-press payload in one local helper so the long-press and options payloads stay byte-identical (golden file).
- **`VerseItem.tsx`, rewayah rows** (`handleUnitWordPress`, :443-450): `unitVerseActionsPayload(unitRow, source)` (`verseUnitRows.ts:415-430`) plus `initialScreen` and `word: {verseKey: word.hafsKey, position: word.position}`, with the selection as in `openUnitActions` (:343-358).
- **Deleted:**
  - `components/sheets/WordDetailSheet.tsx`;
  - its import, `registerSheet` call and payload type (`sheets.tsx:42, :90, :271-276`);
  - the i18n key `wordDetail.context`.
- `sheetRegistry.test.ts` adds `'word-detail'` to `VERSE_SHEETS_NOTHING_OPENS`, so it cannot come back unnoticed.
- **Optional (T10):** in the Word by Word screen, a long-press on a word calls `onOpenWord`, and the sheet switches to `words` at that word.

## 5. (e) States, RTL, phone and iPad, accessibility

| State | Shown |
|---|---|
| Another rewayah's verses are loading, refused or unnumbered | existing `SelectionPendingView` (`VerseActionsSheet.tsx:824-829`) |
| Verse words loading (word by word, Hafs DigitalKhatt, i'rab) | centered `ActivityIndicator` under the tabs (as `IrabContent.tsx:274-275`); no step bar |
| Word-by-word or Hafs words failed | `wordView.loadFailed` + `common:actions.tryAgain` |
| A part with no word-by-word words | `wordView.noWords` in place of its grid and card |
| I'rab failed | the I'rab section says `irab.loadFailed`; the other sections still work |
| Books | loaded the first time the tab opens (today they load up front, :126) |
| Readings loading / null / error | small spinner in its header / section hidden / `wordView.readings.loadFailed` + Try again |
| Gharib or rasm loading, null or error | hidden (an error only logs with `console.warn`) |

- **RTL.**
  - Chrome follows the app direction: tabs, section headers, labels, transliteration and meaning (both forced to `ltr`).
  - Arabic content sits on the physical right with `writingDirection:'rtl'`, using IrabContent's `RIGHT` and `ROW_FROM_RIGHT`: the word, i'rab, morphology, gharib, rasm and the reading words.
  - Navigation over the Quran text follows the text in both languages: the step bar, the chips and the grid.
  - Every visible number goes through `localizeDigits` (counter, chips, references).
- **Phone and iPad.** One layout everywhere. On phones it fills the sheet's 85% sub-screen height. On iPad it sits in the centered card, at most 560 wide and 760 tall, made by `AdaptiveActionSheet`. The step bar is the last child of the card and is never clipped. There is no window math or new breakpoint: the grid and Skia text measure their containers with `onLayout`.
  - **Type ramp:** callout 14 SemiBold for section titles, footnote 13 for the counter and reference, caption 11 for tags.
  - **Colours:** text alpha tokens only, never `primary` for chrome; secondary text at 0.8 alpha (IrabContent's 0.75 at :522 is raised).
  - **Line height:** at least 2× for Quran text.
  - **Dynamic Type:** chrome and reading-row text use React Native `Text` with font scaling on and rows using `minHeight`.
  - **Divergence:** the reading standards' 'Word detail: popover anchored to the word' (`04-reading-standards.md:55`) gives way to product decision 2; the word view moves with the verse sheet when the Study pane is built.
- **Accessibility:** every control above has a role, a label and a state. The selected word is stated in text (counter and announcement), not by highlight colour alone. VoiceOver reads the header word in Arabic. The canvas is one labelled element and the step bar reaches every word.

## 6. Data flow and APIs (TypeScript)

```ts
// services/wbw/wordAlignment.ts  (// @ai-generated)
export type DkSlot = Pick<DKWordInfo, 'text' | 'wordPositionInVerse'>;
export type WbwToken = Pick<WBWWord, 'position' | 'textUthmani'>;
export interface WordPair<D extends DkSlot, W extends WbwToken> { dk: D; wbw: W }
export interface DkWbwAlignment<D extends DkSlot, W extends WbwToken> {
  /** One entry per DigitalKhatt word slot, in order; a word drawn by two slots appears twice. */
  pairs: WordPair<D, W>[];
  /** The verse-end marker slot ('۝٧'); never paired with a word. */
  endMarker: D | null;
}
export function normalizeForMatch(text: string): string;   // diacritics, U+FFFD, U+200E/U+200F/U+061C out; spaces collapsed
export function isVerseEndMarker(text: string): boolean;   // parseVerseMarker(text) !== null (RewayahVerseUnits.ts:63)
export function alignDkWithWbw<D extends DkSlot, W extends WbwToken>(dk: readonly D[], wbw: readonly W[]): DkWbwAlignment<D, W>;
export function slotsByWbwPosition(pairs: readonly WordPair<DkSlot, WbwToken>[]): Map<number, number[]>;
```

How `alignDkWithWbw` works: take the marker slot out first. If the remaining word slots and the word-by-word words have the same count, pair them 1:1 in order (6,233 verses). Otherwise run today's accumulation loop on normalized text (2:181, 8:6, 13:37). Slots left over after the last word-by-word word pair with that last word. `WBWVerseView` (:404-465) calls it and keeps its `wordRange` cut.

```ts
// services/wbw/wordAudio.ts  (// @ai-generated; moved from WordDetailSheet.tsx:83-90)
export function wordAudioUrl(verseKey: string, position: number): string;
// hooks/useWordAudio.ts  (// @ai-generated)
export type WordAudioState = 'idle' | 'loading' | 'playing' | 'error';
export function useWordAudio(url: string | null): {state: WordAudioState; toggle: () => void};

// components/sheets/verse-actions/verseUnitScreens.ts  (extended, @ai-start/@ai-end)
export type WordPartCaption = 'none' | 'verse' | 'hafsVerse';
export interface WordStudyPart {
  verseKey: string;                          // Hafs verse whose words the part shows
  caption: WordPartCaption;                  // 'verse': '2:3' (Hafs range); 'hafsVerse': 'Hafs 1:7'
  wordRange?: {first: number; last: number}; // DigitalKhatt slot positions held; undefined = whole verse
}
export function selectionWordParts(selection: ReadyVerseSelection): WordStudyPart[];
```

How `selectionWordParts` works:
- **Hafs:** one part per key, captioned 'verse' when there are several.
- **Another rewayah:** take the slot range of the consecutive units, `units[0].firstWordId` to `last.lastWordId`, and intersect it with `model.hafsVerseWordRange(k)` (`RewayahVerseUnits.ts:523`) for each `k` in `hafsKeysOfUnits(units)` (:262). Set `wordRange` when the intersection is only part of the verse, and caption 'hafsVerse' unless the `wbwParts` plain rule (`verseUnitScreens.ts:154-156`) holds.

```ts
// components/sheets/verse-actions/wordStudy.ts  (// @ai-generated, pure)
export interface WordRef { verseKey: string; position: number }   // Hafs verse + word-by-word position
export interface StudyWord extends WordRef {
  index: number; part: number;
  slots: readonly string[];   // DigitalKhatt Hafs locations 'S:A:W'
  text: string;               // DigitalKhatt text of the slots, joined by ' '
}
export interface PartWords { dk: readonly DKWordInfo[]; wbw: readonly WBWWord[] }
export function buildWordSequence(parts: readonly WordStudyPart[], words: ReadonlyMap<string, PartWords>): StudyWord[];
export function indexOfWord(sequence: readonly StudyWord[], ref: WordRef | null | undefined): number; // -1 if absent
export function sameWord(a: WordRef, b: WordRef): boolean;
export interface MorphSummary { root: string | null; lemma: string | null; rest: readonly MorphFact[] }
export function summarizeMorph(facts: readonly MorphFact[]): MorphSummary;  // uses MORPH_ROOT_LABEL / MORPH_LEMMA_LABEL
export function rootSearchKey(root: string): string;                        // 'م ل ك' -> 'ملك'
export function rnQuranFontFamily(renderer: MushafRenderer, rewayah: RewayahId): 'DigitalKhattV1' | 'DigitalKhattV2'; // IndoPak -> V2 for RN Text
export type ReaderId = 'asim' | 'ibnKathir' | 'nafi' | 'abuAmr';
export const READING_GROUPS: readonly {reader: ReaderId; rewayat: readonly [RewayahId, RewayahId]}[];
export type SlotReadingKind = 'major' | 'mukhtalif' | 'silah';
/** What the readings API is assumed to return per slot (adapted in wordStudySources.ts if it differs). */
export interface SlotReading { rewayah: RewayahId; text: string; differsFromHafs: boolean; kind: SlotReadingKind | null }
export interface WordReadingRow { rewayah: RewayahId; text: string; differsFromHafs: boolean; tag: 'wordVariant' | 'silah' | null }
export function stripVerseMarkers(text: string): string;  // drops inline '۝N' tokens (Warsh 1:7:4)
export function mergeSlotReadings(perSlot: readonly (readonly SlotReading[])[], hafsText: string): WordReadingRow[];
export function countDiffering(rows: readonly WordReadingRow[]): number;

// services/irab/irabFormat.ts  (extended)
export const MORPH_ROOT_LABEL = 'الجذر';
export const MORPH_LEMMA_LABEL = 'الأصل المعجمي';

// components/sheets/verse-actions/wordStudySources.ts  (// @ai-generated)
// The ONLY file that imports the readings / gharib / rasm modules of the other designs.
// Each loader returns null when there is no data, so the section is not drawn.
export interface WordLocation { verseKey: string; position: number; slots: readonly string[] }
export interface GharibView { text: string; source: string }
export interface RasmView { imlai: string | null; notes: readonly string[]; source: string }
export function loadWordReadings(word: WordLocation): Promise<WordReadingRow[] | null>; // getWordReadings(slot) per slot -> mergeSlotReadings
export function loadWordGharib(word: WordLocation): Promise<GharibView | null>;        // getGharib(`${verseKey}:${position}`)
export function loadWordRasm(word: WordLocation): Promise<RasmView | null>;            // getRasm(`${verseKey}:${position}`)
export function loadVerseReadingVariants(hafsKey: string): Promise<ReadonlySet<number> | null>; // optional; word positions with variants

// components/sheets/verse-actions/useWordStudyData.ts  (// @ai-generated)
export interface PartData {
  part: WordStudyPart; words: PartWords;
  irab: readonly WordIrab[] | null;       // null: the i'rab failed to load
  wordText: ReadonlyMap<number, string>;   // quotableWord(DigitalKhatt text) by word-by-word position, for references
}
export type WordStudyData =
  | {status: 'loading'}
  | {status: 'error'; retry: () => void}
  | {status: 'ready'; parts: readonly PartData[]; sequence: readonly StudyWord[]};
export function useWordStudyData(parts: readonly WordStudyPart[]): WordStudyData;
export function useIrabBooks(verseKeys: readonly string[], enabled: boolean):
  {status: 'loading' | 'ready' | 'error'; books: ReadonlyMap<string, IrabBookPassages[]>};
export type SectionState<T> = {status: 'loading'} | {status: 'error'; retry: () => void} | {status: 'ready'; value: T | null};
export interface WordSections { readings: SectionState<WordReadingRow[]>; gharib: SectionState<GharibView>; rasm: SectionState<RasmView> }
export function useWordSections(word: StudyWord | null, neighbours?: readonly StudyWord[]): WordSections;
```

How the two data hooks work:
- `useWordStudyData` first awaits `wbwDataService.initialize()`, because `getVerseWords` returns `[]` before that. It then calls `digitalKhattDataService.ensureRewayahLoaded('hafs')` when `!isRewayahReady('hafs')`. After that, every part is loaded in parallel with `Promise.all`: `tryGetVerseWords(key,'hafs')`, `wbwDataService.getVerseWords` and `irabDataService.getVerse`. The effect is keyed on a content signature of the parts.
- `useWordSections` keeps a module-level cache of 64 words. A result for a word the user has already stepped past is dropped (request id). The neighbours are prefetched after the current word resolves.

```ts
// Components (all // @ai-generated)
export interface WordStudyContentProps {          // verse-actions/WordStudyContent.tsx
  selection: ReadyVerseSelection;
  initialWord?: WordRef;
  /** Root search entry (from the word / root search design); absent -> the root is plain text. */
  onRootPress?: (root: string) => void;
  onBack: () => void;
}
export type SectionId = 'readings' | 'irab' | 'morphology' | 'gharib' | 'rasm';
export interface WordCardProps {                  // verse-actions/WordCard.tsx
  word: StudyWord; wbw: WBWWord | undefined; irab: WordIrab | undefined | null;
  rewayah: RewayahId;                             // selection.rewayah (Hafs chip, Current row)
  sections: WordSections;
  wordTextOf: (verseKey: string, position: number) => string | undefined;
  canOpen: (ref: WordRef) => boolean; onRef: (ref: WordRef) => void;
  onRootPress?: (root: string) => void;
  expanded: Partial<Record<SectionId, boolean>>; onToggle: (id: SectionId) => void;
}
export interface WordReadingsProps { rows: readonly WordReadingRow[]; current: RewayahId } // verse-actions/WordReadings.tsx
```

- `IrabContent.tsx` keeps the i'rab drawing and exports it: `IrabEntryList` (today's `EntryRow`s and agreed mark), `MorphTable`, `IrabBooksTab` (today's `BooksTab`), `renderRefs` and `createIrabStyles`. Each takes a new `canOpen(verseKey, position)`. Its screen component is removed in T8.
- **Root search:** `VerseActionsSheet` passes `onRootPress` only when the search design exports its entry point (assumed `openRootSearch({root, source})`). The handler hides the sheet first, then calls it.

## 7. (f) i18n keys (namespace `sheets`; Arabic drafted, needs native review)

| Key | en | ar |
|---|---|---|
| verseActions.wordStudy | Word Study | دراسة الكلمات |
| wordView.tabWords | Words | الكلمات |
| wordView.tapWord | Tap a word to study it | اضغط على كلمة لدراستها |
| wordView.previous / next | Previous / Next | السابقة / التالية |
| wordView.previousWord / nextWord | Previous word / Next word | الكلمة السابقة / الكلمة التالية |
| wordView.announce | {{word}}, word {{n}} of {{total}} | {{word}}، الكلمة {{n}} من {{total}} |
| wordView.wordRef | {{verse}} · word {{n}} | {{verse}} · الكلمة {{n}} |
| wordView.gridLabel | Words of {{verse}} | كلمات {{verse}} |
| wordView.gridHint | Use Previous and Next to move between words | استخدم «السابقة» و«التالية» للتنقل بين الكلمات |
| wordView.hafsNote | Meaning, audio, i'rab and morphology are for Hafs. | المعنى والنطق والإعراب والصرف على رواية حفص. |
| wordView.hafsNoteReadings | Meaning, audio, i'rab and morphology are for Hafs. Readings shows {{rewayah}}. | المعنى والنطق والإعراب والصرف على رواية حفص، وفي «القراءات» رواية {{rewayah}}. |
| wordView.playWord | Play the word | تشغيل الكلمة |
| wordView.audioFailed | Couldn't play | تعذّر التشغيل |
| wordView.loadFailed | Couldn't load this verse's words. | تعذّر تحميل كلمات الآية. |
| wordView.noWords | Word data isn't available for this verse. | لا تتوفر بيانات الكلمات لهذه الآية. |
| wordView.studyWord | Study {{word}} | دراسة {{word}} |
| wordView.source | Source: {{source}} | المصدر: {{source}} |
| wordView.readings.title | Readings | القراءات |
| wordView.readings.same | Same text in every rewayah here | النص واحد في جميع الروايات المعروضة |
| wordView.readings.differ_one / _other | {{count}} rewayah differs from Hafs / {{count}} rewayat differ from Hafs | _zero لا تخالف رواية حفصًا · _one تخالف حفصًا رواية واحدة · _two تخالف حفصًا روايتان · _few تخالف حفصًا {{count}} روايات · _many تخالف حفصًا {{count}} رواية · _other تخالف حفصًا {{count}} رواية |
| wordView.readings.current | Current | الحالية |
| wordView.readings.blank | Not a separate word in this rewayah | ليست كلمة مستقلة في هذه الرواية |
| wordView.readings.readers.asim / ibnKathir / nafi / abuAmr | Asim / Ibn Kathir / Nafi' / Abu 'Amr | عاصم / ابن كثير / نافع / أبو عمرو |
| wordView.readings.scope | Compares each rewayah's written text: 8 rewayat of 4 of the 10 readers. Pronunciation rules such as tashil, imalah and taqlil are not marked. | تُقارَن الكلمة كما تُكتب في كل رواية: ثماني روايات لأربعة من القراء العشرة، ولا تُبيَّن أحكام الأداء كالتسهيل والإمالة والتقليل. |
| wordView.readings.loadFailed | Couldn't load the readings. | تعذّر تحميل القراءات. |
| wordView.readings.differChip (optional) | Readings differ | فيها خلاف |
| wordView.morphology.searchRoot | Search the root {{root}} | ابحث بالجذر {{root}} |
| wordView.gharib.title | Arabic meaning | معنى الكلمة |
| wordView.rasm.title | Rasm | الرسم |
| wordView.rasm.imlai | Standard spelling | الرسم الإملائي |

- **Changed:** `irab.tabBooks` in English becomes 'I'rab books' (the Arabic is already كتب الإعراب).
- **Removed** from both languages: `wordDetail.context`, `irab.tabWords`, `irab.tapWord`.
- **Reused:**
  - `irab.showAll`, `showWord`, `wordOf`, `wordN`, `hafsVerse`, `implied`, `agreed`, `loadFailed`, `sources`, `morphology`, and the books keys;
  - `verseActions.irab` (now the I'rab section title);
  - `common:actions.play`, `pause`, `showMore`, `showLess`, `tryAgain` and `common:status.loading`;
  - `settings:mushafSettings.legendV2.labels.*`;
  - `content:rewayah.short.*` through `getShortLabel`;
  - `player:verse.wbwHafsNotice` (in the grid).
- Components call `useTranslation(['sheets','common','settings'])`. Keys built at runtime (`readers.${id}`) are listed by `i18n:unused`, which is advisory only.

## 8. (g) Tests and CI

Tests follow the repo's patterns: react-test-renderer with `act`, `global.IS_REACT_ACT_ENVIRONMENT = true`, `jest.mock` of heavy modules recording props (`verseUnitScreens.render.test.tsx`), the real Warsh and Bazzi slots from `services/mushaf/__fixtures__/verseUnitsFixture.json`, and better-sqlite3 tests over bundled databases (`services/irab/__tests__/irabDatabase.test.ts`). The Arabic UI runs through `expo-localization` and `i18n.changeLanguage('ar')` (`WBWContent.preferences.test.tsx`). The suites are listed per task. CI gates: `npm run test:ci`, `npx tsc --noEmit`, `npm run i18n:check` and `npx jest i18n/`.

## 9. Files and PR slicing

- **PR 1** (no visible change except the fixed grids in 25:42 and 27:26): T1, T2, T3.
- **PR 2** (the Word Study screen): T4 to T8, plus the UI checklist with iPad and phone screenshots, before and after, in English and Arabic, and a dark theme.
- **PR 3** (one word view): T9, T11, and optionally T10 and T12.
- **New:**
  - `services/wbw/wordAlignment.ts`
  - `services/wbw/wordAudio.ts`
  - `hooks/useWordAudio.ts`
  - `components/sheets/verse-actions/wordStudy.ts`
  - `components/sheets/verse-actions/wordStudySources.ts`
  - `components/sheets/verse-actions/useWordStudyData.ts`
  - `components/sheets/verse-actions/WordStudyContent.tsx`
  - `components/sheets/verse-actions/WordCard.tsx`
  - `components/sheets/verse-actions/WordReadings.tsx`
  - their tests
- **Changed:**
  - `WBWVerseView.tsx`
  - `verseUnitScreens.ts`
  - `irabFormat.ts`
  - `IrabContent.tsx`
  - `VerseActionsSheet.tsx`
  - `sheets.tsx`
  - `VerseItem.tsx`
  - the en and ar `sheets.json`
  - the sheet and VerseItem tests
  - `verseItemHafs.golden.json` (regenerated)
  - `docs/design/screen-inventory.md`
- **Deleted:** `WordDetailSheet.tsx`.
- New files start with `// @ai-generated`; edits in existing files are wrapped in `// @ai-start` / `// @ai-end`.

## Tasks

### T1. Extract the DigitalKhatt / word-by-word word alignment into a pure module, fixing 25:42 and 27:26

Create services/wbw/wordAlignment.ts (// @ai-generated) with normalizeForMatch, isVerseEndMarker (parseVerseMarker, RewayahVerseUnits.ts:63), alignDkWithWbw and slotsByWbwPosition. Algorithm: take the verse-end marker slot out first; if the remaining DigitalKhatt word slots and the word-by-word words have the same count, pair them 1:1 in order; otherwise run today's accumulation loop (WBWVerseView.tsx:420-450) on normalized text (today's diacritics plus U+FFFD, U+200E, U+200F and U+061C removed, spaces collapsed). Slots left over after the last word-by-word word pair with that last word. In WBWVerseView.tsx, replace the inline loop and stripDiacritics (:143-150, :404-451) with a call, keeping the wordRange cut (:454-462) and the end-marker rendering. A read-only script over the bundled databases confirmed that pairing changes only for 25:42 and 27:26 (both fixes), that N:1 accumulation is needed only in 2:181, 8:6 and 13:37, and that no word-by-word word is left unpaired.

- **Files:** `services/wbw/wordAlignment.ts`, `services/wbw/__tests__/wordAlignment.test.ts`, `services/wbw/__tests__/wordAlignment.database.test.ts`, `components/player/v2/PlayerContent/QuranView/WBWVerseView.tsx`
- **Depends on:** none
- **Tests:** wordAlignment.test.ts: equal counts pair 1:1; the 2:181 shape (two slots, بَعْدَ and مَا, to one word-by-word word, later positions shifted by one); a word with ۩ + U+200F (27:26) and one with U+FFFD (25:42) stay 1:1 with the marker as endMarker; the marker is never paired; empty word-by-word input gives no pairs. wordAlignment.database.test.ts (better-sqlite3 on data/mushaf/digitalkhatt/digital-khatt-v2.db and data/wbw/wbw-en.db, as irabDatabase.test.ts does): in all 6,236 verses every word-by-word word is paired at least once, every verse's last slot is its endMarker, and slot and word-by-word positions differ exactly in 2:181, 8:6 and 13:37. The existing WBWVerseView.slice and WBWVerseView.selectOnTap suites pass unchanged.

### T2. Word audio URL helper and useWordAudio hook

Move the position-based qurancdn URL builder from WordDetailSheet.tsx:83-90, with its comment on word-only numbering, to services/wbw/wordAudio.ts as wordAudioUrl(verseKey, position). Add hooks/useWordAudio.ts (// @ai-generated): one expo-audio player at a time; the playbackStatusUpdate subscription is kept in a ref instead of monkey-patching remove (WordDetailSheet.tsx:138-146); stop and release on url change and on unmount; states idle / loading / playing / error. WordDetailSheet is left alone until T9.

- **Files:** `services/wbw/wordAudio.ts`, `services/wbw/__tests__/wordAudio.test.ts`, `hooks/useWordAudio.ts`, `hooks/__tests__/useWordAudio.test.tsx`
- **Depends on:** none
- **Tests:** wordAudio.test.ts: ('2:255', 3) gives https://audio.qurancdn.com/wbw/002_255_003.mp3, and a malformed key gives ''. useWordAudio.test.tsx with jest.mock('expo-audio'): toggle creates and plays, a second toggle pauses, didJustFinish returns to idle, a url change and unmount call pause, remove and the subscription's remove, and createAudioPlayer throwing gives 'error'.

### T3. Selection parts and the pure word model

verseUnitScreens.ts: add WordStudyPart and selectionWordParts(selection). Hafs: one part per selected key, captioned 'verse' when there are several. Another rewayah: intersect the consecutive units' slot range with hafsVerseWordRange (RewayahVerseUnits.ts:523) for each key of hafsKeysOfUnits (:262); set wordRange (DigitalKhatt positions) for a partial verse; caption 'hafsVerse' unless the wbwParts plain rule (:154-156) holds. New wordStudy.ts (// @ai-generated) with the §6 API: buildWordSequence, indexOfWord, sameWord, summarizeMorph, rootSearchKey, rnQuranFontFamily, READING_GROUPS, stripVerseMarkers, mergeSlotReadings (adds a Hafs row from StudyWord.text when the readings data has none) and countDiffering. irabFormat.ts: export MORPH_ROOT_LABEL and MORPH_LEMMA_LABEL, the labels scripts/irab/sarf.ts:394-399 writes.

- **Files:** `components/sheets/verse-actions/verseUnitScreens.ts`, `components/sheets/verse-actions/wordStudy.ts`, `services/irab/irabFormat.ts`, `components/sheets/verse-actions/__tests__/verseUnitScreens.test.ts`, `components/sheets/verse-actions/__tests__/wordStudy.test.ts`, `services/irab/__tests__/irabDatabase.test.ts`
- **Depends on:** T1
- **Tests:** verseUnitScreens.test.ts (real fixture slots): Hafs 2:255 gives [{2:255, none}]; Hafs [1:6, 1:7] gives two parts captioned 'verse'; Warsh 1:6 gives [{1:7, hafsVerse, {1,4}}]; Warsh 1:7 gives {5,10}; Warsh 1:6 + 1:7 gives the whole of 1:7; Warsh 103:1 gives 103:1 and 103:2, both whole; Warsh 1:5 gives [{1:6, hafsVerse}]; Bazzi 71:24 gives two partial parts. wordStudy.test.ts: Warsh 1:6 is 4 words with slots 1:7:1 to 1:7:4 and the DigitalKhatt texts; Warsh 1:7 is word-by-word words 5 to 9 without the marker; an N:1 verse gives slots ['2:181:3','2:181:4'] and later positions shifted; indexOfWord is -1 outside the sequence; summarizeMorph keeps the data order of the other facts; rootSearchKey('م ل ك') is 'ملك'; mergeSlotReadings joins two slots per rewayah, strips '۝٦', keeps '' for a blank slot, maps major and mukhtalif to 'wordVariant' ahead of 'silah', and keeps READING_GROUPS order; rnQuranFontFamily maps IndoPak to V2. irabDatabase.test.ts: every root value matches /^[ء-ي]( [ء-ي]){2,3}$/.

### T4. Data hooks and the readings / gharib / rasm port

wordStudySources.ts (// @ai-generated): WordLocation, GharibView, RasmView, loadWordReadings / loadWordGharib / loadWordRasm, and the optional loadVerseReadingVariants. It is the only file that imports the other designs' modules; until they land every loader returns null. Readings are fetched once per slot, then merged; gharib and rasm are keyed `${verseKey}:${position}`. useWordStudyData.ts (// @ai-generated): useWordStudyData(parts) awaits wbwDataService.initialize() and, when !isRewayahReady('hafs'), ensureRewayahLoaded('hafs'); it then loads every part in parallel (tryGetVerseWords(key,'hafs'), getVerseWords, irabDataService.getVerse with any failure recorded as irab: null), builds wordText (quotableWord of the DigitalKhatt text) and the sequence, and keys the effect on a content signature of the parts. useIrabBooks loads lazily. useWordSections keeps a 64-word cache, drops stale results by request id and prefetches the neighbours.

- **Files:** `components/sheets/verse-actions/wordStudySources.ts`, `components/sheets/verse-actions/useWordStudyData.ts`, `components/sheets/verse-actions/__tests__/useWordStudyData.test.tsx`
- **Depends on:** T3
- **Tests:** With mocked services: initialize and ensureRewayahLoaded are awaited before any read; parts load in parallel; an i'rab rejection still gives status 'ready' with irab null; a word-by-word or Hafs failure gives 'error' and retry reloads; an unchanged parts signature does not reload. useWordSections: loading, then ready(null) when the ports return null; a slow result for word A is ignored after stepping to B; a cached word does not call the ports again; a port rejection gives 'error' with a working retry; neighbours are prefetched once.

### T5. Turn IrabContent.tsx into exported i'rab building blocks

Export the i'rab drawing pieces: IrabEntryList (today's EntryRow list and agreed mark), MorphTable, IrabBooksTab (today's BooksTab), renderRefs and createIrabStyles. renderRefs, MorphTable and EntryRow take canOpen(verseKey, position): a reference outside the word sequence renders as a plain «word» with no onPress. Raise the shared secondary text alpha from 0.75 to 0.8 (:522). Keep the IrabContent screen export so the sheet still compiles until T8. Wrap edits in @ai-start / @ai-end.

- **Files:** `components/sheets/verse-actions/IrabContent.tsx`, `components/sheets/verse-actions/__tests__/irabBlocks.render.test.tsx`
- **Depends on:** T3
- **Tests:** irabBlocks.render.test.tsx: a reference with canOpen true is pressable and calls onRef with {verseKey, position}; with canOpen false it renders the quoted word with no onPress; an unknown word renders irab.wordN; MorphTable renders labels and values with the references filled in.

### T6. WordCard and WordReadings components

WordCard.tsx (// @ai-generated). Header: SkiaVerseText in words mode, textAlign center, round(arabicFontSize × 1.4) points, face from getDkFontFamily(renderer,'hafs'), tajweed, Allah-name highlight and weight from the settings, and an RN Text fallback in rnQuranFontFamily; transliteration and meaning with writingDirection ltr; the Play pill (useWordAudio); the reference; for another rewayah, the Hafs chip and hafsNote / hafsNoteReadings. Sections in the order Readings, I'rab (IrabEntryList), Morphology (root chip calling onRootPress(rootSearchKey), lemma, showMore / showLess revealing MorphTable of the other facts), Arabic meaning, Rasm. The collapsible section shell has role button, expanded state, a 44pt header and useHover(); empty sections are not drawn. WordReadings.tsx (// @ai-generated): rows grouped by READING_GROUPS, getShortLabel, RN Text in rnQuranFontFamily(renderer, id) at round(arabicFontSize × 0.85) with line height 2×, the legendV2 tags, a Current tag and fill, '—' with the blank caption, and the scope footnote. Add the wordView.* keys these use to en and ar sheets.json.

- **Files:** `components/sheets/verse-actions/WordCard.tsx`, `components/sheets/verse-actions/WordReadings.tsx`, `components/sheets/verse-actions/__tests__/WordCard.render.test.tsx`, `i18n/locales/en/sheets.json`, `i18n/locales/ar/sheets.json`
- **Depends on:** T2, T4, T5
- **Tests:** WordCard.render.test.tsx (SkiaVerseText and useWordAudio mocked to record props): for 2:4:9 the header draws the DigitalKhatt slot text, not the damaged word-by-word text; the Hafs chip and note show only for another rewayah, and hafsNote is used when readings are null; Play passes the right URL and shows its states. Readings: hidden when null; collapsed with readings.same when nothing differs; open with 8 rows in reader order when something differs, the selection's rewayah tagged Current, tags from the legend labels, and a blank text shown as '—' with its caption. I'rab: entries and agreed mark, or irab.loadFailed when irab is null. Morphology: pressing the root chip calls onRootPress('ملك'); without the prop the root is plain text; Show more reveals the other facts. Gharib and rasm: no title when null; text and 'Source: X' when present. Every section header exposes accessibilityState.expanded.

### T7. WordStudyContent screen (tabs, grid, verse chips, modes, step bar)

WordStudyContent.tsx (// @ai-generated): parts = useMemo(selectionWordParts(selection)); useWordStudyData; tabs Words / I'rab books (Books through useIrabBooks with enabled = the tab has been opened); verse chips when there are several parts (wrapping, ROW_FROM_RIGHT, role tab with selected state); the grid of the current part (WBWVerseView with selectOnTap, wordRange, rewayah, and a labelled wrapper); the hint and mode pill in alpha tokens; WordCard in one-word mode or compact cards in whole-verse mode; the irab.sources footer; and a fixed step bar outside the ScrollView (ROW_FROM_RIGHT, Next on the physical left, unmirrored chevrons, disabled at the ends, irab.wordOf counter with a polite live region). After a step: scroll to the card when its top is above the viewport (no animation under Reduce Motion) and announce wordView.announce. canOpen and onRef come from the sequence. Selection state is a WordRef, so it survives a recomputed sequence. Section expansion is component state: auto for Readings until the user toggles it.

- **Files:** `components/sheets/verse-actions/WordStudyContent.tsx`, `components/sheets/verse-actions/__tests__/WordStudyContent.render.test.tsx`, `i18n/locales/en/sheets.json`, `i18n/locales/ar/sheets.json`
- **Depends on:** T6
- **Tests:** WordStudyContent.render.test.tsx, mocking WBWVerseView and WordCard to record props and mocking the services, as verseUnitScreens.render.test.tsx does. Hafs 1:4: the grid gets selectOnTap and selectedWordPosition 1; the counter reads 'Word 1 of 3'; Next selects 2; Previous is disabled at 1 and Next at 3; initialWord {1:4, 3} opens on word 3; a grid tap selects. Hafs [1:6, 1:7]: two chips; Next from the last word of 1:6 switches the grid to 1:7 word 1. Warsh 1:6: one grid with wordRange {1,4}, rewayah 'warsh' and 4 steps; an i'rab reference to word 6 cannot be opened. Whole-verse mode lists the verse's words, and pressing one returns to one-word mode at that word. The Books tab loads only when opened. Loading shows a spinner; a failure shows wordView.loadFailed and Try again reloads. Arabic UI: Arabic strings and localized digits in the counter and chips. The step buttons expose role, label and disabled state.

### T8. Wire Word Study into VerseActionsSheet and replace the I'rab screen

VerseActionsSheet.tsx: ActiveScreen 'irab' becomes 'words' (:103-115), SCREEN_TITLE_KEYS.words is 'verseActions.wordStudy' (:118-130), 'words' joins isFullScreen (:745-751), handleWordStudy replaces handleIrab (:463-465), and WordStudyContent renders with selection={readySelection} (:867-875). The row moves out of the !isRange group (:1103-1138) and gains accessibilityRole. Initial state comes from payload.initialScreen and payload.word, with a wordTarget state. Pass onRootPress only when the search design's entry point exists (hide the sheet, then call it). sheets.tsx: add initialScreen and word to the verse-actions payload type. Delete the IrabContent screen export (the building blocks stay). Add the en and ar verseActions.wordStudy string, change the English irab.tabBooks to I'rab books, and remove irab.tabWords and irab.tapWord. Update the mocks in the other sheet suites.

- **Files:** `components/sheets/VerseActionsSheet.tsx`, `components/sheets/sheets.tsx`, `components/sheets/verse-actions/IrabContent.tsx`, `components/sheets/__tests__/VerseActionsSheet.units.test.tsx`, `components/sheets/__tests__/VerseActionsSheet.playback.endToEnd.test.tsx`, `components/sheets/__tests__/VerseActionsSheet.playback.endToEnd.alldbs.test.tsx`, `components/sheets/__tests__/VerseActionsSheet.similarVerses.test.tsx`, `i18n/locales/en/sheets.json`, `i18n/locales/ar/sheets.json`
- **Depends on:** T7
- **Tests:** VerseActionsSheet.units.test.tsx: mock '../verse-actions/WordStudyContent' instead of IrabContent; press 'Word Study' (was "I'rab" at :475 and :563). Hafs 2:255 gets selection.keys ['2:255']. Warsh unit 1:7 gets selection.units[0].key '1:7'. A Hafs range [2:1, 2:2] offers the row and passes both keys. A payload with {initialScreen:'words', word:{verseKey:'2:255', position:3}} renders WordStudyContent first with that initialWord, and the back row returns to the list. A pending Warsh selection shows SelectionPendingView. The other three sheet suites mock WordStudyContent. tsc: the payload type accepts the new fields; sheetRegistry.test.ts still passes.

### T9. Retire WordDetailSheet: a word long-press in a list or the player opens the verse sheet on that word

VerseItem.tsx: handleWordPress (:428-438) selects the verse and shows 'verse-actions' with the long-press payload (one shared local builder, so the long-press and options payloads stay identical) plus initialScreen 'words' and word {verseKey, position}; it clears the word highlight when the sheet closes. handleUnitWordPress (:443-450) uses unitVerseActionsPayload (verseUnitRows.ts:415-430) plus initialScreen and word {hafsKey, position}, and selects the unit as openUnitActions does (:343-358). Delete WordDetailSheet.tsx and its import, registration and payload type (sheets.tsx:42, :90, :271-276). Remove wordDetail.context from en and ar. Add 'word-detail' to VERSE_SHEETS_NOTHING_OPENS. Regenerate the Hafs golden file; this is an intended change.

- **Files:** `components/player/v2/PlayerContent/QuranView/VerseItem.tsx`, `components/sheets/WordDetailSheet.tsx`, `components/sheets/sheets.tsx`, `components/sheets/__tests__/sheetRegistry.test.ts`, `components/player/v2/PlayerContent/QuranView/__tests__/VerseItem.unitRow.test.tsx`, `components/player/v2/PlayerContent/QuranView/__fixtures__/verseItemHafs.golden.json`, `i18n/locales/en/sheets.json`, `i18n/locales/ar/sheets.json`
- **Depends on:** T8
- **Tests:** VerseItem.unitRow.test.tsx:503-513 now expects ['verse-actions', {payload: {...the Warsh 1:7 unit payload, initialScreen:'words', word:{verseKey:'1:7', position:6}}}] and the unit selected. Regenerate the golden with UPDATE_PLAYER_HAFS_GOLDEN=1 npx jest VerseItem.hafsGolden --watchAll=false; review that only the 'word by word, then a word pressed' scenario changes (sheets and selection) and say so in the PR. sheetRegistry.test.ts: 'word-detail' is neither opened nor registered. Run npm run i18n:check and npx jest i18n/.

### T10. (Optional) A long-press in the Word by Word screen opens Word Study on that word

WBWContent.tsx: add onOpenWord?: (word: WordRef) => void; when it is set, the grid's onWordPress calls it instead of toggling the highlight (:111-125). VerseActionsSheet sets wordTarget and switches to 'words'. A word outside the selection falls back to the first word.

- **Files:** `components/sheets/verse-actions/WBWContent.tsx`, `components/sheets/VerseActionsSheet.tsx`, `components/sheets/verse-actions/__tests__/WBWContent.preferences.test.tsx`
- **Depends on:** T8
- **Tests:** A long-press with onOpenWord calls it with {verseKey, position}, and without it still toggles the highlight. In the sheet suite, the Word by Word screen's onOpenWord leads to WordStudyContent with that initialWord.

### T11. Docs and final i18n cleanup

docs/design/screen-inventory.md: remove the word-detail row (:175) and note the Word Study screen under verse-actions (:173). Check that no removed key is still referenced, and that every wordView key has an ar value, including all six Arabic plural forms of readings.differ. Mark the Arabic as an AI draft for native review in the PR. Optionally update the word-level rows of docs/research/surah-app-feature-gaps.md to point at the new screen.

- **Files:** `docs/design/screen-inventory.md`, `i18n/locales/en/sheets.json`, `i18n/locales/ar/sheets.json`, `docs/research/surah-app-feature-gaps.md`
- **Depends on:** T9
- **Tests:** npm run i18n:check (blocking in CI); npx jest i18n/ (locale completeness, plural categories, placeholders); npx tsc --noEmit.

### T12. (Optional, iPad) Step words with the arrow keys

In WordStudyContent, call useKeyCommands (hooks/useKeyCommands.ts) while the Words tab is in one-word mode, gated on keyCommandsSupported(): left for the next word and right for the previous, following the Mushaf's direction (ipad-standards.md:269), in the 'reader' menu with the titles wordView.nextWord and wordView.previousWord.

- **Files:** `components/sheets/verse-actions/WordStudyContent.tsx`, `components/sheets/verse-actions/__tests__/WordStudyContent.render.test.tsx`
- **Depends on:** T7
- **Tests:** resetKeyCommandsForTests(true), render, then pressKeyForTests('left') selects the next word and pressKeyForTests('right') the previous; nothing is bound when keyCommandsSupported() is false or in whole-verse mode.

## Risks

- The readings, gharib and rasm APIs are designed elsewhere. I'rab, meaning and audio are keyed by word-by-word position, and readings by DigitalKhatt slot; the two differ only in 2:181, 8:6 and 13:37. If gharib or rasm is keyed by slot while the view passes the word-by-word location (or the reverse), words after بَعْدَ مَا in those verses show their neighbour's data. WordLocation carries both keys, and the adapter test must cover 2:181.
- The alignment refactor in WBWVerseView touches every word-by-word grid (player, list views, sheets). A read-only check over the bundled databases shows pairing changes only for 25:42 and 27:26, both fixes, and the database-wide test guards it, but a regression would show everywhere.
- Renaming the I'rab row to Word Study moves a learned entry point. Users looking for I'rab must find it one level down, and existing tests press "I'rab" (VerseActionsSheet.units.test.tsx:475, :563).
- Retiring WordDetailSheet replaces a small sheet with the 85%-height verse sheet, and a word long-press now also selects the verse. Users who opened it only to play a word get a heavier surface. The Hafs golden file changes on purpose; reviewers must check that only that scenario changes.
- Word Study is now offered for multi-verse selections, which the I'rab screen never was. A page-sized selection (up to ~40 verses) loads all parts' word-by-word words, Hafs words and i'rab up front. Only one grid is drawn at a time and the books load lazily, but loading time and memory need checking on an older phone.
- Skia text in the header, plus React Native Text in the reading rows, while stepping quickly: SkiaVerseText's paragraph disposal (utils/skiaDeferredDispose) must keep up. Rows are drawn only when Readings is open.
- The step bar follows the Quran's direction (Next on the left) in the English UI too. That goes against the i18n README's rule to mirror chevrons (docs/i18n/README.md:41) and may surprise English users; it needs UX sign-off with screenshots.
- The Readings summary compares written text from the diff files. Rules such as imala, taqlil, tashil and naql are not in that data, so 'same text' must never be worded as 'pronounced the same'; the scope footnote must stay.
- The verse sheet on iPad is a centered card that covers the page. That breaks the reading standard 'MUST NOT cover the verse being studied on expanded+' (04-reading-standards.md:62) and its word-detail popover row (:55), but Translation, Tafseer and I'rab do the same today; the docked Study pane is not built.
- The Arabic strings are AI drafts, including six plural forms. They need native review before merging (docs/i18n/README.md, Translating).
- If PR 2 merges before the readings data module, the most important section (readings) is hidden at launch. Sequence the readings data PR first, or ship them together.

## Open questions (answered in README.md)

- Name: is Word Study / دراسة الكلمات right, or should the row keep 'I'rab' in its label (for example Words & I'rab / الكلمات والإعراب) so I'rab stays easy to find?
- Step bar direction: follow the Quran text in both UI languages (Next on the physical left, as the reader's arrow keys do), or follow the UI direction in English?
- Gharib and rasm keys: will their data be keyed by word-by-word / Quran.com word position or by DigitalKhatt slot ('S:A:W')? They differ in 2:181, 8:6 and 13:37.
- What exactly does the readings API return: per-slot rows of {rewayah, text, differsFromHafs, kind}, or a different shape? Does it include Hafs? Does it strip inline verse markers itself? Will there be a verse-level variants call for the whole-verse 'Readings differ' chip?
- Root search entry point (from the word / root search design): which function does the sheet call, and where does root search open when the sheet was opened from the player (the Search tab, or the mushaf reader's search)?
- Should the header always show the transliteration and English meaning (as designed), or obey the word-by-word grid settings as WordDetailSheet did? The English gloss is off by default in the Arabic UI.
- Should section open / closed choices persist across sessions (a small preference in mushafSettingsStore), or reset each time the screen opens (as designed)?
- Should the Word by Word screen later merge into Word Study's whole-verse mode (with its translation and transliteration lines), leaving one fewer row? Kept separate here; T10 only links it.
- Attribution: where do gharib and rasm source names come from (a field in their data, as designed), and do their licences need entries in THIRD_PARTY_LICENSES.md and the Credits screen?
