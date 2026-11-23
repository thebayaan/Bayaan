# 01 · Audit: reading surfaces on iPad

All references are to `develop` at `2566b5c8`. Severity tags (P0/P1/P2) are defined in the [README](README.md#severity-legend-used-across-these-docs).

Sizes marked ≈ are computed from code. Device short sides: iPad mini 744pt, iPad 11" 834pt, iPad Pro 13" 1032pt.

---

## A. Foundations: problems every reading surface inherits

### A1. Size scaling inflates everything on iPad · P0

* About 45 reading-related files use `moderateScale` / `ScaledSheet` from `react-native-size-matters` directly, including `components/mushaf/main.tsx` (31 calls), `MushafPlayerBar.tsx` (36), `VerseActionsSheet.tsx` (45), `MushafSettingsContent.tsx` (130), `TafseerContent.tsx` (54) and `SimilarVersesContent.tsx` (60).
* The library scales from `shortSide / 350`, so `moderateScale(s) ≈ s × 1.56` on iPad mini, `× 1.69` on 11" and `× 1.97` on 13".
  * The reader's header title `moderateScale(16)` renders at **≈ 31pt** on a 13" iPad.
  * A `moderateScale(11)` caption renders at ≈ 22pt.
  * The 52pt player bar becomes ≈ 100pt.
* The capped helpers already exist in `utils/scale.ts` (cap at `PHONE_SCALE_CAP = 430`, `utils/responsive.ts:22`). Its own header comment calls the uncapped library "the root cause of the 'everything looks too big' iPad complaints", but no reading surface has migrated to it.
* Theme typography (`styles/theme.ts:13-14`) *is* capped. The result is two scaling systems on one screen: capped Manrope titles next to inflated `moderateScale` labels.
* Both systems read `Dimensions` once at module load. Neither one reacts to Split View, Slide Over or Stage Manager resizes.

### A2. Module-level dimension snapshots · P0

These values are frozen at import time and are wrong after rotation, in Split View, and in Stage Manager:

| Where | Snapshot | Effect |
|---|---|---|
| `components/mushaf/reading/ReadingPageView.tsx:206-209, 464-465` | `SCREEN_WIDTH`, `SCREEN_HEIGHT` | List/translation page mode lays out at launch width. In landscape the text runs edge to edge (≈ 1376pt, roughly 150 Latin characters per line). After rotation the page is the wrong size. |
| `components/mushaf/reading/ContinuousListView.tsx:353` | `SCREEN_WIDTH - moderateScale(16)` | Same problem for the vertical list mode. No reading-column cap. |
| `components/sheets/VerseActionsSheet.tsx:133` | `SHEET_HEIGHT = window.height * 0.85` | The study sheet is sized for the launch orientation. Launch in portrait (1376pt tall) and rotate, and the sheet is taller than the landscape window. |
| `components/sheets/MushafLayoutSheet.tsx:23, 113` | `SCREEN_HEIGHT * 0.82` | Same problem for the reader settings sheet. |
| `components/mushaf/constants.ts:135-164` | `SCREEN_*`, `CONTENT_*`, `PAGE_PADDING_*` | Legacy phone constants. `SkiaPage`/`QCFPage` fall back to them when props are missing. The comment at `:146-147` still says `facingPages` is "currently always false"; that is stale, because it is live in landscape. |

### A3. Orientation and multitasking config · P0

* `app.config.js:58` sets `UIRequiresFullScreen: true`. The committed `ios/Bayaan/Info.plist:139-140` says `false`, with `UIApplicationSupportsMultipleScenes: true` (`:104-105`). Whichever one ships decides whether Split View, Slide Over and Stage Manager exist at all. The two need to agree; see the [standards](04-reading-standards.md#1-windows-not-devices).
* `app/_layout.tsx:213-216` locks the **whole app to portrait**. `app/mushaf.tsx:105-113` unlocks only while the reader is open and **re-locks portrait on exit**.
  * On an iPad sitting in a landscape keyboard case, leaving the reader rotates the app to portrait.
  * If multitasking is enabled, iPadOS ignores the lock and the browse screens rotate anyway. Those paths were never designed for landscape.
* **Simulator check (develop, current dev build):** the built `Info.plist` has `UIRequiresFullScreen=false`. Stage Manager windowing works, and the Home, Surahs and Settings tabs all rotate despite the portrait lock. So multitasking is effectively on today, and every reading surface must already cope with arbitrary window sizes (see Q1–Q3).

### A4. `isTablet` means device, not window · P1

`hooks/useResponsive.ts:31-33` and `utils/responsive.ts:37-41` return `isTablet = true` for any iPad window, including a 320pt Slide Over panel. Today this means:

* A 1/3 Split View window gets the 24pt tablet page padding and the tablet sidebar.
* A 1/3 Split View window *doesn't* get the phone mushaf path it actually needs.

There is no compact/regular size class.

### A5. No hardware-keyboard, pointer or context-menu support · P1

The repo has no key commands, no `onHoverIn`/pointer effects, no context menus and no drag-and-drop. The `onDragStart` hits in `SkiaPage.tsx:592` and `ContinuousMushafView.tsx:462` are verse drag-to-select, not drag-and-drop. That rules out:

* arrow or space page turns
* ⌘F to search
* Esc to close a sheet
* ⌘B to bookmark
* hover highlight on verses or rows
* right-click verse menus

### A6. Every secondary surface is a full-width bottom sheet · P1

* All reading sheets are `react-native-actions-sheet` sheets registered in `components/sheets/sheets.tsx`. None sets `maxWidth`, anchors to its source, or becomes a popover or form sheet on iPad.
* `components/BottomSheetModal.tsx` (`@gorhom/bottom-sheet`) is imported nowhere. It is dead code.

### A7. Dynamic Type and VoiceOver · P1

* Skia-rendered Arabic (pages, `SkiaVerseText`, previews) ignores the system text size. That is acceptable for the fixed-layout mushaf page, but not for the translation, tafsir and list modes.
* Manrope labels scale with Dynamic Type *on top of* the ≈ 1.7–2× inflation, with no `maxFontSizeMultiplier`.
* Role, label and state coverage is good in `MushafPlayerBar` and the reader header. It is absent in most sheets; see the screens below.

---

## B. Screen by screen

### B1. Mushaf reader, page mode (`app/mushaf.tsx`, `components/mushaf/main.tsx`, `skia/SkiaPage.tsx`, `qcf/QCFPage.tsx`)

**Works today**

* Page width is capped (720pt portrait, 640pt per page in landscape; `constants.ts:232-239`).
* Landscape shows a two-page spread with the right page odd (`main.tsx:355-470`).
* The page is laid out from the measured container (`main.tsx:619-650`).
* The list remounts on orientation change to avoid offset drift (`:606-613`).
* Single tablet pages get symmetric edges (`:191-202`).

| # | Weakness | Sev |
|---|---|---|
| R1 | **Portrait wastes the screen and stretches line spacing.** On a 13" iPad (1032×1376) the page is 720pt wide, which leaves ≈ 156pt of empty margin on each side. The 15 lines are then spread over ≈ 1250pt of height (≈ 83pt pitch for ≈ 36pt glyphs). The page reads as sparse and taller than any printed mushaf (printed aspect ≈ 1:1.45, this is ≈ 1:1.74). | P1 |
| R2 | **Landscape compresses line spacing on smaller iPads.** iPad mini landscape gives a page ≈ 560pt wide and ≈ 640pt of content height, so the line pitch is ≈ 1.5× font size. The phone landscape path deliberately keeps ≥ 2.1× "so harakat never overlap" (`constants.ts:325-327`), but the tablet path has no such floor. Verify for tashkeel collisions on iPad mini and 11" landscape. | P1 |
| R3 | **The spread has no spine.** It is two cards with a 12pt gap (`constants.ts:367`). There is no gutter shading, no shared baseline frame, and the page number and juz labels are not mirrored outward the way a printed mushaf has them. | P2 |
| R4 | **Chrome is phone chrome.** The non-glass header and the `MushafPlayerBar` span the full width (`main.tsx:1312-1454`, `bottomBar` `:1537-1543`). On a 13" landscape screen, search and options sit about 1300pt apart, and the header type is inflated (A1). | P1 |
| R5 | **The tap-to-hide immersive mode is the only way to declutter.** There is no persistent "focus" toggle and no auto-hide on page turn. Chrome reappears on any tap, including taps meant for a verse. | P2 |
| R6 | **There is no page scrubber, thumbnail strip, or "go to page" field.** Reaching page 400 from page 10 means search, or a long swipe. | P1 |
| R7 | **The orientation re-lock on exit** (A3) means the reader is the only landscape-friendly place in the app. | P0 |
| R8 | **Page font size cannot change in page mode.** The size control is hidden unless `viewMode === 'list'` (`MushafSettingsContent.tsx:981`), and nothing explains why. That is acceptable for a fixed-layout mushaf, but on iPad it needs a "page fit" or zoom option and an explanation. | P2 |

### B2. Mushaf reader, list/translation mode (`reading/ReadingPageView.tsx`, `reading/ContinuousListView.tsx`)

| # | Weakness | Sev |
|---|---|---|
| L1 | **There is no reading column.** Width comes from the frozen `SCREEN_WIDTH` (A2). On landscape iPad, Arabic and translation run the full screen width. The in-player Quran view already caps at 680pt (`components/player/v2/PlayerContent/QuranView/index.tsx:250`); the reader does not. | P0 |
| L2 | **No metrics are passed.** Neither view receives `MushafLayoutMetrics`, so rotation, Split View and the page-edge symmetry fix (`ReadingPageView.tsx:437-441` never passes `symmetric`) don't apply. | P1 |
| L3 | **Font sizes are `moderateScale(userSize)`.** The user's 10–46pt stepper (`store/mushafSettingsStore.ts:16-24`) becomes ≈ 17–78pt on 11", in 7pt jumps. The scale follows the device, not the reader's choice. | P1 |
| L4 | **Only one translation at a time** (`selectedTranslationId: string`, `mushafSettingsStore.ts:156`). Quran.com shows several side by side; on a wide screen that is the natural use of space. | P2 |

### B3. Reader header and toolbar (`app/mushaf.tsx:251-415`, `main.tsx:799-920`)

| # | Weakness | Sev |
|---|---|---|
| H1 | The iOS 26 `Stack.Toolbar` is good native chrome, but its title button uses `moderateScale` for the glass pill (`main.tsx:822-860`), so the pill is ≈ 2× on iPad. | P1 |
| H2 | **The share and settings icons in the glass header have no `accessibilityLabel` or role** (`main.tsx:880-899`). The non-glass header has them. | P1 |
| H3 | **There is no bookmark button in the chrome.** Bookmarking is only reachable via verse long-press. Tarteel and Apple Books both put it one tap away. | P2 |
| H4 | **Toolbar play opens a bottom sheet** (`mushaf-player-options`) instead of a popover anchored to the button. | P1 |

### B4. Verse actions and study sheets (`components/sheets/VerseActionsSheet.tsx` + `verse-actions/*`)

| # | Weakness | Sev |
|---|---|---|
| V1 | **The study screens hide the verse being studied.** Translation, Tafseer, Theme, WBW and Reflections open at 85% height (`:133, 747`). The page and its context disappear behind the backdrop, and there is no side-by-side mode. | P1 |
| V2 | **The root menu has 14 rows stretched edge to edge** (`:909-1194`, `option` style `:1259-1270`). On iPad this belongs in a context menu or a ≈ 320pt popover anchored to the verse. | P1 |
| V3 | **The study text ignores reader settings.** The Arabic preview is a hard-coded `fontSize={22}` (`components/share/SkiaVersePreview.tsx:119`). Translation is a fixed `moderateScale(15)/24` (`TranslationContent.tsx:424-433`) and ignores `translationFontSize`. Tafsir uses ScheherazadeNew 18/34 and Manrope 15/26 (`TafseerHtmlRenderer.tsx:86-141`), a different face from the page. | P1 |
| V4 | **Tafsir and translation text have no measure cap.** In 13" landscape a tafsir paragraph runs about 1290pt wide, roughly 100+ characters per line. | P1 |
| V5 | **Text is not selectable**, so you can't copy part of a tafsir or translation. | P2 |
| V6 | **Plain RN `ScrollView` inside the sheet** (`TafseerContent.tsx:6`, `TranslationContent.tsx:2`). Scrolling and drag-to-dismiss conflict with a trackpad. | P2 |
| V7 | **Missing labels and roles.** The settings gear has no label (`:782-801`), the option rows have no `accessibilityRole`, and the verse reference is at 50% alpha (`:1237-1240`). | P1 |
| V8 | **Similar verses throws away the comparison.** Tapping a match calls `navigateToVerse` + `hideAll` (`SimilarVersesContent.tsx:197-198`), when it should be a compare view. | P2 |
| V9 | **Share has no anchor.** `Share.share` / `Sharing.shareAsync` (`ShareContent.tsx:202, 254`) pass no anchor, so the iPad share popover isn't attached to its control. The share preview is also `screenWidth − 48`, about 1290pt wide in landscape. | P1 |

### B5. Word detail (`components/sheets/WordDetailSheet.tsx`) and word-by-word (`verse-actions/WBWContent.tsx`)

| # | Weakness | Sev |
|---|---|---|
| W1 | **A full-width sheet for one word.** On iPad this should be a popover anchored to the tapped word. | P1 |
| W2 | **The Arabic ignores the reader's font.** It is hard-coded `'Uthmani'` at `moderateScale(36)` (`:272-273`), not the reader's renderer, rewayah font or size. | P1 |
| W3 | **No next/previous word**, so studying a verse word by word means reopening the sheet each time. | P2 |
| W4 | **WBW tiles flow across the full width** with `moderateScale(4)` padding (`WBWContent.tsx:180`). The renderer is hard-coded to Hafs (`:80`). | P2 |

### B6. Notes (`VerseNoteSheet.tsx`, `verse-actions/NoteContent.tsx`)

| # | Weakness | Sev |
|---|---|---|
| N1 | **The editor is a full-width bottom sheet.** It sits under the software keyboard with no hardware-keyboard affordances: no ⌘↩ to save, no Esc to cancel. The HIG uses a centred form sheet for this. | P1 |
| N2 | **Delete is immediate**, with no confirmation and no undo (`VerseNoteSheet.tsx:238-247`). | P1 |
| N3 | **Two divergent note UIs.** One uses theme fonts and the other uses literal Manrope names. The destructive colour is hard-coded `#ff4444`. | P2 |
| N4 | **No way to open a note's verse.** `collection/notes.tsx:96-136` only offers edit and delete. | P1 |

### B7. Reader settings (`MushafLayoutSheet.tsx`, `MushafSettingsContent.tsx`, `ReadingThemeContent.tsx`)

| # | Weakness | Sev |
|---|---|---|
| S1 | **Settings cover the page.** The sheet is full width and 82% tall, so you can't see a theme or size change land on the page. Apple Books and Tarteel use an "Aa" popover with the page live behind it (benchmark). | P1 |
| S2 | **One long list of check-mark rows.** View mode, scroll direction, page design, theme, WBW, sizes, weight, divine names, thematic highlighting, tajweed, font and rewayah are all stacked, with no segmented controls and no quick row. | P1 |
| S3 | **The 1–10 stepper has 4pt steps × uncapped scale** (L3) and no continuous slider. The +/− buttons have no labels or `adjustable` role (`MushafSettingsContent.tsx:293-335`). | P1 |
| S4 | **Tajweed colours aren't tuned per theme on the page.** `SkiaLine.tsx:193` paints raw `tajweedColors`, while the settings sample lightens them for dark mode (`MushafSettingsContent.tsx:111-125`), so the preview lies. On Sand (`#f0d59a`), Qalqalah `#57CFFF` measures 1.25:1 contrast. There is no tajweed legend. | P1 |
| S5 | **Reading themes have only 5 tokens** (`constants/readingThemes.ts:13-19`): no selection, highlight, divider or tajweed set. Dark-default is pure `#fff` on `#050b10` (19.8:1), which is harsh for night reading. Secondary text in dark amber, sage and sepia sits at 4.0–4.6:1. | P2 |
| S6 | **Unlabelled controls.** Theme chips, check-mark rows, Allah-highlight swatches and the custom tajweed toggle have no role or state for VoiceOver. | P1 |
| S7 | **Nothing tablet-specific in the settings.** The Settings-tab versions sit in the 720pt `MaxWidthContainer`, but nothing uses the space: no two-column layout, and the theme chips (60×72) wrap like phone UI. | P2 |

### B8. In-reader search and index (`components/mushaf/MushafSearchView.tsx`, `BookmarkChips.tsx`)

| # | Weakness | Sev |
|---|---|---|
| X1 | **Search replaces the page.** The overlay mounts full-screen (`main.tsx:1458-1469`), so you lose your place visually while browsing. Benchmark: Apple Books shows a contents sidebar beside the page. | P1 |
| X2 | **Rows stretch the full window** (FlashList `:1078`, FlatList `:1193`), with no width cap and no grid. | P1 |
| X3 | **Results all look alike.** Every result type shows the same search icon (`:350`). The empty state is drawn at 20–35% alpha. Rows and "Clear" have no roles. | P2 |
| X4 | **No keyboard support:** no ⌘F, no Esc to close, no arrow keys through results. | P1 |
| X5 | **Bookmark and recent chips are stale and limited.** They scroll horizontally on a wide screen, are cached at module level, and refresh only on mount (`BookmarkChips.tsx:63-71`). They have no context menu to remove them. | P2 |

### B9. Reader audio (`MushafPlayerBar.tsx`, `MushafPlayerOptionsSheet.tsx`, `MushafRepeatOptionsSheet.tsx`, `MushafReciterPickerSheet.tsx`)

Listening patterns belong to the listening docs. Only reader-specific issues are listed here.

| # | Weakness | Sev |
|---|---|---|
| P1a | **The bar is minimal.** It has no progress, elapsed time or reciter, and its verse label is `moderateScale(11)` on one line. | P2 |
| P1b | **The options and repeat sheets have zero accessibility props.** The accordions have no expanded state and the steppers have no labels. | P1 |
| P1c | **The range picker renders everything.** It shows 114 surahs and up to 286 ayah chips with no virtualisation, inside an accordion capped at `moderateScale(240)`. | P2 |

### B10. Surahs tab and entry points (`app/(tabs)/(b.surahs)/index.tsx`, `SurahsView.tsx`, `SurahItem.tsx`, `app/quran/*`, `app/mushaf/[page].tsx`)

| # | Weakness | Sev |
|---|---|---|
| E1 | **The VoiceOver hint is wrong.** It says "Tap to play Surah" (`SurahItem.tsx:193`, `i18n/locales/en/home.json:124`), but tapping opens the reader. Long-press plays, and it is a hidden gesture with no context menu or `accessibilityActions`. | P0 |
| E2 | **The verse deep link goes to Home.** `/quran/{s}/{a}` redirects to Home (`app/quran/[surah]/[ayah].tsx`), so a universal link or Handoff to a verse never opens it. | P1 |
| E3 | **The layout doesn't use the iPad width.** It is a 720pt single column with ≈ 200pt of dead space per side in landscape, and the card mode is fixed at 2 columns (`SurahsView.tsx:37-47, 359`). There is no juz index or jump bar. | P2 |
| E4 | **The sidebar is gone in the reader.** The tablet sidebar disappears in the reader (root stack), so nothing persists between browse and read. | P1 |

### B11. Adhkar reader (`components/adhkar/DhikrReader.tsx`)

Tagged *Reading* in the screen inventory. It shares the reading typography rules.

| # | Weakness | Sev |
|---|---|---|
| D1 | **Font sizes are `moderateScale(arabicFontSize / translationFontSize)`** (`:132, 165, 183, 288-294`), which gives the same uncapped inflation as L3. | P1 |
| D2 | **The reading measure depends on the Home stack.** The 720pt cap comes only from the Home stack's `MaxWidthContainer`, not from a reading-column rule. That is fine today, but it is fragile. | P2 |

## B12. Verified in the iPad simulator

Captured on `develop` (`2566b5c8`) on iPad Pro 13" (M4) and iPad mini (A17 Pro) simulators with iOS 26.2: 54 screenshots, portrait, landscape and a resized Stage Manager window. These confirm most of the code findings above and add the bugs below. Screenshot file names are given where known, so the same views can be captured again.

| # | Finding | Evidence | Sev |
|---|---|---|---|
| Q1 | **The horizontal pager loses page alignment whenever its width changes.** After portrait → landscape → portrait, two half-pages show split down the middle. Rotating back shows pages 4–5 instead of 3–4. Switching List → Mushaf in landscape leaves the spread offset by about a third of a page with a third page peeking in. A Stage Manager resize leaves a grey gap mid-screen and cuts off the next page. Each one only recovers after a manual swipe. **Cause:** the list remounts only on an orientation flip (`orientationKey`, `main.tsx:606-613`), so a resize or a view-mode switch keeps the old pixel offset under new item widths; and on rotation the first frame lays out from window dims before `onLayout` reports the container (`:636-640`). | `13in-portrait-mushaf-after-rotate-from-landscape`, `13in-landscape-mushaf-spread-misaligned-p4-5-after-rotate`, `13in-landscape-mushaf-misaligned-after-list-to-mushaf`, `13in-landscape-windowed-resized-pager-misaligned` | P0 |
| Q2 | **List view in landscape is clipped.** It shows as two pages side by side, each clipped at the left, with Arabic and translation cut mid-word and the surah header cut on the right. This is L1/A2 in practice: `ReadingPageView` is sized from the launch-time `SCREEN_WIDTH` (portrait), while the FlatList pages by `metrics.screenWidth` (landscape). | `13in-landscape-list-view-translation`, `…-settled` | P0 |
| Q3 | **Vertical-scroll Mushaf in landscape is a single page shoved to the left,** with roughly 45% of the screen empty on the right and the surah header frame cut off at the top-left. **Cause:** `ContinuousMushafView` receives the landscape *facing-pages* metrics and offsets its single page by the spread's `pageOffsetX` (`ContinuousMushafView.tsx:95-105`). | `13in-landscape-mushaf-vertical-scroll` | P0 |
| Q4 | **Sheets overflow in landscape.** The verse actions sheet fills the screen and *Copy* / *Share* sit below the fold, on both 13" and mini. In Playback Settings, *Play each verse* is pushed off the bottom and the Play button floats over the content. Rows stretch about 1300pt, with check marks and chevrons far from their labels. | `mini-landscape-verse-actions-sheet` and the 13" landscape verse-actions and playback-settings captures | P0 |
| Q5 | **Tafsir and translation are phone layouts at tablet scale.** Body text runs about 1300pt per line, the Arabic verse is a tiny single line at the far right, and the verse pill floats in the centre. In portrait the Prev/Next footer is clipped at the bottom edge with two thirds of the sheet empty above it. The mini in landscape clips *Next*. | `13in-landscape-verse-tafseer`, `13in-landscape-verse-translation`, `13in-portrait-verse-translation`, and the mini landscape tafseer capture | P1 |
| Q6 | **The word-by-word sheet is nearly empty.** One short row of words with gloss text of about 9pt, in a sheet that is about 85% empty. In landscape the row is centred with huge gutters. Tapping a word in Mushaf view does nothing, so word study is only reachable through verse actions. | `13in-portrait-verse-word-by-word`, `13in-landscape-verse-word-by-word` | P1 |
| Q7 | **Portrait page 2 floats in the middle third** of the screen with large empty bands above and below (R1 in practice). With chrome visible, the floating title pill overlaps the first line of text. | `13in-portrait-mushaf-p2`, `13in-portrait-mushaf-p3` | P1 |
| Q8 | **Spread labels are tiny.** The landscape spread itself looks right (a proper RTL spread, best seen in immersive mode). With chrome shown, the page-number labels are about 8pt and the toolbar buttons sit in the far corners. On iPad mini the spread's Arabic is about 10–11pt, which is small for sustained reading. | `13in-landscape-mushaf-spread-p3-4-immersive` and the mini landscape spread | P1 |
| Q9 | **In-reader search wastes the screen:** one result row at the top of a blank full-screen page, and the "Find surahs, verses…" hint is tiny. | `13in-landscape-reader-search-results`, `13in-portrait-reader-search-results` | P1 |
| Q10 | **The share popover is anchored mid-screen,** not to the share button (V9 in practice). | `13in-portrait-reader-share-popover` | P1 |
| Q11 | **Theme settings don't fit.** Theme swatches wrap 4 + 3 with dead space, the live preview frame is cropped, and the "Changing appearance mode" note is small grey text. | 13" portrait and landscape reading-theme captures | P2 |
| Q12 | **The Surahs tab doesn't use the width.** The column is capped at about 640pt with a big empty margin in landscape. List rows are small (≈ 15pt titles), and the grid has only 2 columns even at 13". | `13in-landscape-surahs-grid`, `13in-landscape-surahs-list`, `13in-portrait-surahs-list` | P2 |

**Status on `develop` after the iPad stack (#430–#447, Oct 29).** These were checked in the code but not captured again:

| Item | Status |
|---|---|
| Q1 | **Addressed by #444.** The paged lists remount per layout through `readerListKey(mode, width)` instead of per orientation. #447 also stops List view from using the spread index. |
| Q2 | **Likely addressed.** `ReadingPageView` and `ContinuousListView` now take the measured width and have a 680pt column (#444). Clipping in landscape List view still needs a screenshot. |
| Q3 | **Addressed by #444.** The vertical mushaf gets its own `scrollMetrics` and is centred. |
| Q4 | **Partly addressed.** The verse sheet height now reads `useWindowDimensions` at render, which also fixes A2's `SHEET_HEIGHT`. #430 made iPad sheets into popovers and centred cards. Landscape overflow still needs checking. |

Not captured: the audio bar while playing. The timestamps CDN reset the TLS handshake from the capture machine (curl fails too), so every reciter showed "Playback unavailable". That is a network/CDN issue, not an iPad layout bug.

---

## C. Count

| Severity | Foundations (A) | Screens (B1–B11) | Simulator (B12) | Total |
|---|---|---|---|---|
| P0 | 3 (A1, A2, A3) | 3 (R7, L1, E1) | 4 (Q1–Q4) | 10 |
| P1 | 4 (A4–A7) | 32 | 6 | 42 |
| P2 | 0 | 19 | 2 | 21 |
