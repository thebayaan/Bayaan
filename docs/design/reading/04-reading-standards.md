# 04 · Reading standards

These are the rules for any PR that touches a **reading surface**: the mushaf reader, list/translation mode, verse and word study, notes, reader settings, reading themes, in-reader search, and the adhkar reader.

The rules **extend** [ipad-standards.md](../ipad-standards.md); they don't replace it. Where both cover a topic, the app-wide standard is the base and this file adds reading-specific detail. The keywords **MUST**, **SHOULD** and **MAY** mean the same as there. A MUST is a review blocker.

---

## 1. Windows, not devices

* **MUST** pick reading layouts from `widthClass` ([standards §2](../ipad-standards.md#2-width-classes-and-breakpoints)), not `isTablet`. A Slide Over window on an iPad is `compact` and gets the phone reader.
* **MUST NOT** read `Dimensions.get()` at module scope in reading code. This forbids new `SCREEN_WIDTH`, `SCREEN_HEIGHT` and `SHEET_HEIGHT` constants, and new uses of the legacy constants in `components/mushaf/constants.ts:135-164`. Pass `MushafLayoutMetrics` or the measured pane size down instead.
* **MUST** keep the current page, the selected verse, and the open study tab across rotation, resize, and spread ↔ single-page switches.
* **MUST** keep the app's orientation and multitasking settings consistent between `app.config.js` and `ios/Bayaan/Info.plist`. The reader **MUST NOT** re-lock orientation on exit on iPad.

## 2. The page

* **MUST** fit the whole mushaf page in its pane without scrolling, preserving the page aspect. Leftover space becomes margin, never extra line spacing ([03 §2](03-proposed-designs.md#2-the-page-fit-by-aspect-protect-line-spacing)).
* **MUST** keep line pitch at least **2.0× font size** on every window. Check tashkeel on page 2 and page 50 (dense marks) on iPad mini landscape before merging page-geometry changes.
* **SHOULD** show a two-page spread only when each page is at least 420pt wide, with the odd page on the right and a shared spine.
* **SHOULD** draw surah, juz and page labels in the page margins in the theme's `textSecondary`, so they survive immersive mode.
* **MUST NOT** draw chrome over the text block while chrome is visible. Panes and bars sit beside or outside it, or the page re-fits.

## 3. Reading text

* **MUST** size reading text from the user's reading settings (`arabicFontSize`, `translationFontSize`, and their tablet variants). This applies everywhere reading text appears: list mode, the Study pane, previews, tafsir, word detail, the share card preview, and adhkar.
* **MUST NOT** pass reading sizes through `moderateScale` (or any width-based scale). They are real points.
* **MUST** keep reading text inside a **680pt** column, or the pane's width if that is narrower. Long-form Latin text aims for 60–75 characters per line.
* **MUST** render Quranic text only in the user's selected mushaf face (DK V1, DK V2, IndoPak, QCF) or its matching Naskh fallback. Never use a UI font, and don't introduce another Quranic face (`ScheherazadeNew` and `'Uthmani'` are being retired).
* **SHOULD** make translation, tafsir and notes text selectable.
* **SHOULD** use the reading line heights: Arabic 2.0×, translation 1.55×, tafsir 1.6×.

## 4. Colour and themes

* **MUST** take every colour on a reading surface from the active reading theme. This includes selection, playback band, tajweed and highlight colours, so no hex values in components.
* **MUST** meet these contrast minimums against the theme's `card` / `background`:

  | Element | Minimum contrast |
  |---|---|
  | Body and secondary text | 4.5:1 |
  | Tajweed colours and the Allah-name highlight | 3:1 |
  | Page labels | 4.5:1 |

  Check WCAG contrast on all 14 themes when changing a palette.
* **MUST** draw the settings preview with exactly the same palette as the page.

## 5. Secondary surfaces

These follow [standards §8](../ipad-standards.md#8-sheets-menus-and-modals), with these reading-specific placements:

| Surface | `compact` | `medium` | `expanded`+ |
|---|---|---|---|
| Verse study (translation, tafsir, WBW, notes, similar) | Bottom sheet | Trailing overlay pane | **Docked trailing Study pane** |
| Verse action list | Bottom sheet | Context menu (long-press / right-click) | Context menu |
| Word detail | Bottom sheet | Popover anchored to the word | Popover |
| Reader settings | Bottom sheet (≤ 560 wide) | "Aa" popover | "Aa" popover |
| Contents / search | Full-screen overlay | Leading overlay pane | Docked leading pane (`large`) or overlay |
| Note editor | Bottom sheet | Form sheet, 560 wide | Form sheet |
| Player options, repeat, reciter picker | Bottom sheet | Popover from the capsule's ⋯ | Popover |
| Share | System sheet | System share popover **anchored** to its control | Same |

* **MUST NOT** cover the verse being studied on `expanded`+.
* **MUST** dismiss every overlay with Esc, a tap outside, and a visible close control.
* **MUST NOT** add new full-width `react-native-actions-sheet` sheets for reading without a `medium`+ presentation.

## 6. Keyboard, pointer and Pencil

The app-wide shortcut table lives in [standards §7.3](../ipad-standards.md#73-hardware-keyboard). While the reader has focus, it **overrides** the app-wide meaning of Space and ← / → (which are play/pause and seek elsewhere) with the bindings below. Every action **MUST** also be reachable by touch.

| Keys | Action |
|---|---|
| ← / → | Previous / next page in mushaf direction (Study focused: previous / next verse) |
| Space / ⇧Space | Next / previous page |
| ⌘F | Search (opens Contents) |
| ⌘D | Bookmark current verse or page |
| ⌘, | Reader settings popover |
| ⌘+ / ⌘− / ⌘0 | Reading size up / down / reset (Mushaf: zoom) |
| ⌘⌥1 / ⌘⌥2 | Toggle Contents / Study pane |
| ⌘G | Go to page… |
| ⌘C | Copy selected verse(s) |
| Return | Open the selected search result |
| Esc | Close the topmost overlay, then leave search, then leave immersive |
| ⌥Space | Play / pause recitation (Space is page turn inside the reader) |

* **SHOULD** give verses a hover tint (`text` at 4%) and toolbar buttons the system highlight effect.
* **MUST** offer a right-click context menu wherever long-press does something.
* **SHOULD** turn pages with taps in the outer 15% of the page, for Pencil and pointer users.

## 7. Accessibility

On top of [standards §12](../ipad-standards.md#12-accessibility):

* **MUST** give every swatch, theme chip, stepper button, toggle and check-mark row a role, a label and a state. For example, "Parchment, selected", or the font-size control as `adjustable` with increment and decrement actions.
* **MUST** keep VoiceOver hints true to the action. A surah row that opens the reader says so; play goes in an `accessibilityActions` entry.
* **SHOULD** expose the page as a sequence of verse elements (surah:ayah plus a translation, if one is enabled), with a rotor for surah and juz.
* **MUST NOT** convey state by colour alone. Highlights, bookmarks and tajweed get text equivalents in VoiceOver labels.
* **MUST** honour Dynamic Type in list mode, the Study pane and notes. The fixed-layout mushaf page is exempt, and gets zoom instead.

## 8. RTL and numerals

* **MUST** keep page geometry in physical book coordinates (`direction: 'ltr'` on the page container, as today) while chrome follows `appLayoutDirection`.
* **MUST** run every visible number (page, juz, verse, counts) through `localizeDigits`.
* **SHOULD** mirror panes in RTL UI: Contents goes on the right and Study on the left.

## 9. PR checklist for reading surfaces

In addition to [ipad-review-checklist.md](../ipad-review-checklist.md):

- [ ] Screenshots on iPad mini landscape, 11" portrait, 13" landscape (spread), and one `compact` iPad window.
- [ ] Rotated mid-read: same page, same selected verse, nothing clipped.
- [ ] No new `moderateScale` on reading text; no new module-level `Dimensions`.
- [ ] Reading text follows the size settings; the column is ≤ 680pt.
- [ ] Tajweed and highlights checked on Sand, White, OLED and Dark Amber.
- [ ] Every new control has a label, role and state, and a keyboard path.
- [ ] Phone (`compact`) layout is pixel-identical, or the diff is explained.
