# iPad Reading Experience

> **Status:** Audit + proposal, written 2026-10-26 against `develop`. Since then the iPad build has fixed the sizing (#425), the orientation and `UIRequiresFullScreen` drift (#446), sheets and the Translations and Mushaf search dialogs (#427–#433), keeping the page on resize and rotation (#444, #466) and the reader's keyboard shortcuts (#447). The audit is kept as the record of why; current status is in [ipad-standards.md §13](../ipad-standards.md#13-migration-plan) and open issues in [§14](../ipad-standards.md#14-known-open-issues).
> **Scope:** Every surface involved in *reading* the Quran (and the adhkar reader, which shares its typography) on iPad and large tablets: portrait, landscape, Split View, Slide Over and Stage Manager.
> **Builds on:** [ipad-standards.md](../ipad-standards.md) (width classes, scaling, type ramp, sheets, keyboard) and [screen-inventory.md](../screen-inventory.md) (every route and sheet, tagged by area). This folder adds the reading-specific audit, designs and rules. The listening counterpart lives in `docs/design/listening/`.

## Documents

| # | Doc | What it is for |
|---|-----|----------------|
| 01 | [Audit](01-audit.md) | Every weakness found, per screen, with `file:line` evidence and severity |
| 02 | [Benchmarks](02-benchmarks.md) | What Tarteel, Quran.com, Apple Books and the iPad HIG do, and what we borrow |
| 03 | [Proposed designs](03-proposed-designs.md) | The target iPad reading experience, screen by screen, with wireframes and specs |
| 04 | [Reading standards](04-reading-standards.md) | **The rules.** Reading-specific MUST/SHOULD rules on top of `ipad-standards.md`, plus the reading PR checklist |
| 05 | [Roadmap](05-roadmap.md) | Ordered, PR-sized implementation plan |

## The short version

The reader already does a few iPad things right: it caps page width, shows two facing pages in landscape, measures its real container, and remounts cleanly on rotation. Everything *around* the page is a phone UI blown up:

1. **Sizes inflate about 1.7x to 2x on iPad.** Nearly every reading surface imports `moderateScale` straight from `react-native-size-matters`, which scales from the device's short side. The capped helpers in `utils/scale.ts` exist but the reading code doesn't use them.
2. **Every secondary surface is a full-width bottom sheet.** That covers verse actions, tafsir, translation, word detail, notes, reader settings, player options and repeat. On a 13" screen they span up to 1376pt and cover 82–85% of the page you are studying.
3. **There is no study layout.** You can't read tafsir or translation next to the page; Apple's guidance calls for an inspector column here, and that is the core gap against Tarteel / Quran.com.
4. **Navigation disappears while reading.** The tablet sidebar lives in `(tabs)` and the reader is a root stack screen. Search and the surah index replace the page instead of sitting beside it.
5. **There is no keyboard, pointer or context-menu support.** No arrow-key page turns, no ⌘F, no Esc, no hover, no right-click menus.
6. **Translation and list modes use a frozen module-level `SCREEN_WIDTH`.** Text runs the full screen width, around 150 characters per line in landscape, and doesn't follow rotation or Split View.
7. **Multitasking config has drifted.** `app.config.js` sets `UIRequiresFullScreen: true` and the committed `Info.plist` says `false`, while the app locks itself to portrait outside the reader.
8. **The pager breaks whenever its width changes.** Confirmed in the simulator: rotating, resizing a Stage Manager window, or switching List → Mushaf leaves half-pages or the wrong spread on screen until you swipe. List mode in landscape is clipped mid-word, and vertical Mushaf in landscape sits shoved to the left ([01 §B12](01-audit.md#b12-verified-in-the-ipad-simulator)).

The target experience is in [03-proposed-designs.md](03-proposed-designs.md). In short: a **three-pane reader**. The page (or two-page spread) sits in the centre. A collapsible **Contents** sidebar on the leading edge holds surahs, juz, bookmarks and notes. A collapsible **Study** inspector on the trailing edge holds translation, tafsir, word by word, notes and similar verses. Popovers replace sheets for short choices, everything has a keyboard shortcut, and it all collapses gracefully to today's phone UI in compact windows.

## Severity legend used across these docs

| Tag | Meaning |
|-----|---------|
| **P0** | Broken or clearly wrong on iPad today (layout bug, wrong behaviour, a11y blocker) |
| **P1** | Works, but well below Tarteel / Quran.com / HIG expectations |
| **P2** | Polish, or consistency with the rest of the design system |

## Method

* Code read on `develop` at `2566b5c8` for every file the screen inventory tags *Reading*, plus the reader's entry points and settings.
* Sizes marked "≈" are computed from the code (for example `react-native-size-matters` v0.4: `moderateScale(s) = s + (s·shortSide/350 − s)·0.5`). Section B12 of the audit adds findings from 54 simulator screenshots (iPad Pro 13" and iPad mini, iOS 26.2) that confirm the main code findings.
* Benchmark claims are from public product docs and product knowledge and are labelled as such. They describe direction, not pixel specs.
