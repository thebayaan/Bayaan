# 02 · Benchmarks: what good iPad reading looks like

These are the patterns we borrow, and why. The claims about other apps come from their public help pages and from using the products. They describe direction, not pixel specs. Re-check them against the current app versions before copying a detail.

Bayaan's own identity still wins: a quiet, monochrome UI, Manrope plus IBM Plex Sans Arabic chrome, DigitalKhatt and QCF mushaf rendering, and 14 reading themes ([design-system.md](../design-system.md)).

---

## Tarteel

Sources: [Layouts](https://tarteel.ai/blog/tarteel-tutorials-layouts-2/), [font size](https://support.tarteel.ai/en/articles/12414378-changing-font-size-adaptive-mode), [translations](https://support.tarteel.ai/en/articles/12414411-translations).

| Pattern | What it does | What we take |
|---|---|---|
| **Two reading layouts** | A 15-line Madinah mushaf that "resembles the physical mushaf", and an adaptive "Quran Text" layout whose Arabic size is user-controlled. | Same split. Our *Mushaf* and *List* modes map onto it, and font size only applies to the reflowing mode. Explain this in the UI instead of silently hiding the control (audit R8). |
| **Separate Arabic and translation sizes** | Two independent size controls. | We already store both (`arabicFontSize`, `translationFontSize`). Every reading panel must honour them (audit V3). |
| **Mushaf first, study second** | The page is the hero. Translation and tafsir are one step away, and audio follow-along highlights on the page. | The page never gets covered by a study surface on regular-width windows. |
| **Minimal chrome** | Chrome fades in and out around the page. | Keep tap-to-hide, and add auto-hide on page turn. |

## Quran.com (web and apps)

Source: [Build your personalized Quran experience](https://quran.com/explore/build-your-personalized-quran-experience).

| Pattern | What it does | What we take |
|---|---|---|
| **Reading tabs** | Verse by Verse, Arabic and Translation views, plus Word-by-Word. | Our view switch becomes a segmented control at the top of the reader settings popover. |
| **Several translations side by side** | Pick one or many. | Allow 1–3 translations stacked under each verse in List mode on `expanded`+ (audit L4). |
| **Scripts and themes** | Uthmani, IndoPak and Tajweed scripts. Light, Dark and Sepia themes, switched from the main navigation. | We already have more of both. Make them one tap away (the quick row in the settings popover). |
| **Tafsir as a wide reading surface** | On the web, tafsir opens as its own wide reading view with a tafsir switcher and next/previous verse. | Our Study inspector gets a tafsir switcher, next/previous verse, and a 680pt measure. |
| **Settings drawer** | Settings slide in from the side; the content stays visible. | On iPad the reader settings become a popover or trailing panel, never an 82% sheet. |

## Apple Books (the iPad reading reference)

| Pattern | What it does | What we take |
|---|---|---|
| **"Aa" popover** | Theme swatches, size − / +, font and layout options in a compact popover anchored to the button. The page updates live behind it. | Exactly this for the reader settings on `medium`+. |
| **Contents sidebar** | Table of contents, bookmarks and highlights in a sidebar beside the page, with the current location marked. | The **Contents** pane: surahs, juz, bookmarks, notes, highlights. |
| **Page scrubber** | A scrubber along the bottom edge with a page-number and chapter tooltip while dragging. | Page scrubber with surah, juz and page tooltip (audit R6). |
| **Two-page spread** | In landscape, with a soft spine shadow. | We already have the spread. Add a spine, mirrored outer labels and a shared frame (audit R3). |
| **Keyboard** | Arrow keys turn pages; ⌘F searches. | Full shortcut set (see [04 §6](04-reading-standards.md#6-keyboard-pointer-and-pencil)). |

## Apple HIG (iPadOS)

| Guideline | Where it applies |
|---|---|
| **Sidebars and inspectors.** A leading sidebar for navigation, a trailing inspector for details about the current selection. Both are collapsible and resizable within limits. | Contents pane (leading), Study pane (trailing). |
| **Popovers for short choices** at regular width, anchored to their source. They become sheets at compact width. | Verse actions, word detail, reader settings, player options, repeat. |
| **Form sheets for focused editing**, centred and about 540–700pt wide. | The note editor. |
| **Context menus** on long-press and secondary click, with a preview of the target. | Verse, word, surah row, bookmark and note rows. |
| **Readable content width.** Long text lines are hard to track; constrain the measure. | 680pt reading column (already the standard). |
| **Key commands, discoverable by holding ⌘.** | All reader actions. |
| **Pointer effects:** highlight or lift for tappable items. | Verses on hover, rows, toolbar buttons. |
| **Multitasking:** every layout must work at any window size. | Width classes, not `isTablet`. |

## What we deliberately *don't* copy

* **Infinite vertical scroll as the default.** Many Quran apps default to a reflowing scroll. Bayaan's identity is the faithful mushaf page, so page mode stays the default and vertical scroll stays an option.
* **Heavy colour chrome.** Tarteel and Quran.com lean on brand colour. Bayaan stays monochrome and lets the reading theme carry colour.
* **Ads, upsell or gamification surfaces** next to the text. The Study pane is for study only.
