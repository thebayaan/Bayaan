# 05 · Roadmap

The steps are ordered so that each PR is small, ships on its own, and leaves `compact` (phones, Slide Over) unchanged.

* "Depends" points to the app-wide migration plan in [ipad-standards §13](../ipad-standards.md#13-migration-plan) where a step needs shared work first.
* "Fixes" lists audit IDs from [01-audit.md](01-audit.md).

## Phase 0 · Correctness (days)

| # | PR | Fixes | Depends |
|---|---|---|---|
| 0.1 | Fix the surah-row VoiceOver hint ("Opens the reader") and add a *Play* `accessibilityAction` | E1 | — |
| 0.2 | Make `SHEET_HEIGHT` (`VerseActionsSheet.tsx:133`) and `MushafLayoutSheet` height reactive with `useWindowDimensions` | A2 | — |
| 0.3 | Feed `ReadingPageView` and `ContinuousListView` the measured pane width, centre them in a 680pt column, and pass `symmetric` edges on tablet | L1, L2, A2, Q2 | — |
| 0.4 | Stop re-locking portrait on reader exit on iPad, and reconcile `UIRequiresFullScreen` between `app.config.js` and `Info.plist` | A3, R7 | standards #1, #9 |
| 0.5 | Add labels and roles to the glass-header share and settings buttons, the verse-sheet gear, and the swatches, chips, steppers and toggles in reader settings | H2, V7, S3, S6 | — |
| 0.6 | Note rows: add *Open verse*. Make `/quran/{s}/{a}` open the reader at that verse | N4, E2 | — |
| 0.7 | Keep the pager aligned on every width change: key the paged lists on the measured container width + spread mode (not orientation), `scrollToIndex` the current page after `onLayout`, and give `ContinuousMushafView` single-page metrics in landscape | Q1, Q3 | — |
| 0.8 | Cap sheet height to the live window and make sheet content scroll, so verse actions and playback settings never push actions below the fold | Q4 | 0.2 |

## Phase 1 · Foundations (1–2 weeks)

| # | PR | Fixes | Depends |
|---|---|---|---|
| 1.1 | Move reading files from `react-native-size-matters` to `@/utils/scale`, in the reader chrome, `MushafPlayerBar`, `MushafSearchView` and the verse-actions sheets | A1, H1 | standards #3 |
| 1.2 | Size reading text in real points: drop `moderateScale(userSize)`; add the tablet size keys; use the standards' reading ranges | L3, D1, S3 | standards #4 |
| 1.3 | Route every study surface through reader settings: `SkiaVersePreview`, translation, tafsir, word detail, similar verses | V3, W2 | 1.2 |
| 1.4 | Replace `isTablet` branches in `getMushafLayout` with `widthClass` | A4 | standards #2 |
| 1.5 | Page fit-by-aspect with the 2.0× pitch floor; spread with a spine and mirrored labels | R1, R2, R3 | 1.4 |

## Phase 2 · Interaction model (2–4 weeks)

| # | PR | Fixes | Depends |
|---|---|---|---|
| 2.1 | Pane host in `components/mushaf/main.tsx`: leading and trailing slots, docked or overlay by width class, page re-fit on open | — | 1.5 |
| 2.2 | **Study pane** (Translation, Tafsir, Words, Notes, Similar) built from the existing `verse-actions/*` content components; verse selection drives it | V1, V4, V5, V6, W3, W4 | 2.1, 1.3 |
| 2.3 | **Contents pane** (Surahs, Juz, Saved and inline search), reusing `MushafSearchView` internals | X1–X5, E4 | 2.1 |
| 2.4 | "Aa" **settings popover** plus a continuous size slider; the Settings-tab version gets a live preview pane | S1, S2, S7, R8 | 1.2; a popover primitive (standards #6) |
| 2.5 | Toolbar redesign, audio capsule, page scrubber, auto-hide chrome | R4, R5, R6, H3, H4, P1a | 2.1 |

## Phase 3 · iPad-native input (1–2 weeks)

| # | PR | Fixes | Depends |
|---|---|---|---|
| 3.1 | Native key-command module, and the reader shortcut set from [04 §6](04-reading-standards.md#6-keyboard-pointer-and-pencil) | A5, X4 | standards #10 |
| 3.2 | Context menus (verse, word, rows) with previews; word popover | V2, W1 | a context-menu module |
| 3.3 | Hover effects, outer tap zones for page turns, anchored share popovers | V9, A5 | — |
| 3.4 | Note form sheet with ⌘↩, delete confirmation and undo; merge the two note UIs | N1, N2, N3 | popover/form-sheet primitive |

## Phase 4 · Polish

| # | PR | Fixes |
|---|---|---|
| 4.1 | Reading-theme token expansion: per-theme tajweed and highlight palettes, softer night text, secondary contrast, tajweed legend | S4, S5 |
| 4.2 | Several translations at once; optional Arabic-beside-translation layout | L4 |
| 4.3 | Compare view for similar verses | V8 |
| 4.4 | Range picker virtualisation and accessibility in the repeat and player options | P1b, P1c |
| 4.5 | Scenes: *Open in New Window*, Handoff of the current page and verse | E2 (extended) |
| 4.6 | Delete `components/BottomSheetModal.tsx` or adopt it as the compact fallback | A6 |

## How to verify each phase

* Run the [reading PR checklist](04-reading-standards.md#9-pr-checklist-for-reading-surfaces).
* Phases 1.5 and 2.x change geometry. Attach before and after screenshots at the four reference windows, and a phone screenshot that shows no change.
