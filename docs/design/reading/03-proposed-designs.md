# 03 · Proposed designs: the iPad reader

This document describes the target. Each section names the audit items it fixes (see [01-audit.md](01-audit.md)) and the rule it implements (see [ipad-standards.md](../ipad-standards.md) and [04-reading-standards.md](04-reading-standards.md)).

Width classes follow [ipad-standards §2](../ipad-standards.md#2-width-classes-and-breakpoints):

| Class | Width |
|---|---|
| `compact` | < 600 |
| `medium` | 600–899 |
| `expanded` | 900–1279 |
| `large` | ≥ 1280 |

All values are in points.

---

## 1. The model: page in the middle, two collapsible panes

```
┌──────────────┬───────────────────────────────────────────┬────────────────┐
│  CONTENTS    │                                           │  STUDY         │
│  (leading)   │              PAGE  /  SPREAD              │  (trailing)    │
│              │                                           │                │
│  Surahs      │                                           │  2:255 ◀ ▶     │
│  Juz         │                                           │  [Trans|Tafsir │
│  Bookmarks   │                                           │   |Words|Note] │
│  Notes       │                                           │                │
│  Highlights  │                                           │  …680pt max…   │
│              │                                           │                │
│  ⌕ search    │                ━━━●━━━━━━  p.42 · Juz 3    │                │
└──────────────┴───────────────────────────────────────────┴────────────────┘
       300                         flexible                      380
```

* **Contents** (leading, 300pt) is navigation: where am I, and where can I go? It replaces the full-screen `MushafSearchView` overlay (fixes X1 and E4).
* **Study** (trailing, 380pt; drag to resize between 340 and 480) holds details about the **selected verse**: translation, tafsir, word by word, notes, similar verses and reflections. It replaces the 85% `VerseActionsSheet` study screens (fixes V1).
* The **page** keeps the remaining width and re-fits itself with the algorithm in §2. Opening a pane never covers the text on `expanded`+.

### 1.1 How the panes behave per width class

| Class | Contents | Study | Page |
|---|---|---|---|
| `compact` | Today's full-screen search overlay | Today's bottom sheet | Today's phone layout, unchanged |
| `medium` (iPad mini / 11" portrait, ½ Split View) | **Overlay** panel sliding over the leading edge with a dimmed scrim. Dismiss on tap-out or Esc. | **Overlay** panel over the trailing edge. The page shifts so the selected verse stays visible. | Single page, fit to window |
| `expanded` (13" portrait, 11" landscape) | Overlay | **Docked**. The page re-fits into the remaining width. | Landscape: spread when nothing is docked. If a docked pane would make each page narrower than 420pt, collapse to a single page (Apple Books behaviour). |
| `large` (13" landscape, external display) | **Docked** (or overlay if Study is also docked and the spread would drop under 420pt per page) | **Docked** | Spread whenever each page is ≥ 420pt; otherwise a single page |

Remember which panes were open in `mushafSettingsStore` (new keys: `contentsPaneOpen` and `studyPaneOpen`), separately per width class, so rotating doesn't fight the user.

### 1.2 Rotation and resize

* **Snap, don't animate** on resize ([ipad-standards §11](../ipad-standards.md#11-orientation-and-multitasking)).
* **Keep the current page** across a single-page ↔ spread switch. Today's `orientationKey` remount does this already; key it on `widthClass + spread` instead of orientation.
* **Keep the selected verse** in the Study pane across every change.

---

## 2. The page: fit by aspect, protect line spacing

Fixes R1, R2, and the stale constants in A2.

Today the page width is a hard cap (720 or 640), and the 15 lines are spread over whatever height is left. This proposal fits the page instead:

```ts
// inputs: pane width/height after chrome and safe area, spread: boolean
const PAGE_ASPECT = 1.62;        // text-block height / width, incl. labels (tune on device)
const MIN_PITCH_RATIO = 2.0;     // line pitch ≥ 2.0 × font size (tashkeel safety, matches phone 2.07)
const MAX_PAGE_WIDTH = 760;      // stop growing on external displays
const GAP = spread ? 0 : 0;      // spread pages meet at a spine (see §2.2)

let pageW = Math.min(
  (paneW - outerMargins) / (spread ? 2 : 1),
  (paneH - verticalChrome) / PAGE_ASPECT,
  MAX_PAGE_WIDTH,
);
// SkiaPage: fontSize ≈ contentWidth × 0.053
// shrink until the line pitch is safe
while (lineHeight(pageW) < MIN_PITCH_RATIO * fontSize(pageW)) pageW -= 4;
```

Once each page has its width, the leftover space becomes even margins, never stretched line spacing.

What this gives on real windows (≈, to confirm in the simulator):

| Window | Today | Proposed |
|---|---|---|
| 13" portrait 1032×1376 | 720 wide, ≈ 83pt line pitch, very airy | ≈ 760 wide (cap), pitch ≈ 2.1× font, extra height becomes top and bottom margin for labels |
| 11" landscape 1194×834 | Spread, ≈ 1.7× pitch | Spread at ≈ 470 per page, pitch ≥ 2.0× |
| iPad mini landscape 1133×744 | Spread, ≈ 1.5× pitch (crowded tashkeel) | Spread at ≈ 420 per page, or a single page if that is below the minimum |
| ½ Split View on 13" (≈ 678×1032) | 678 wide | ≈ 640, centred |

### 2.1 Labels live in the margins

Following [ipad-standards §9.1](../ipad-standards.md#91-mushaf):

* the **surah name** goes in the top outer corner;
* the **juz and hizb** go in the top inner corner;
* the **page number** goes at the bottom centre.

These are drawn in the reading theme's `textSecondary`, at `footnote` size (13pt), with tabular digits. On `expanded`+ they stay visible when chrome is hidden, the way a printed mushaf always shows them. This makes the header pill optional in immersive mode.

### 2.2 The spread

```
┌──────────────────────┬┬──────────────────────┐
│ Al-Baqarah      Juz 3 ││ Juz 3      Al-Baqarah │
│                      ││                      │
│   even page (left)   ││  odd page (right)    │
│                      ││                      │
│          42          ││          43          │
└──────────────────────┴┴──────────────────────┘
                       ▲ spine: 1pt hairline + 24pt soft gradient each side
```

* There is **no 12pt gap**. The pages share one frame and meet at a spine: a hairline in `border` plus a soft inner shadow at 6% `text` alpha (fixes R3).
* **Labels mirror outward.** Each page puts the surah name on its outer edge.
* **The book layout's asymmetric edge decoration moves to the outer edges** of the spread only.

### 2.3 Turning pages

| Input | Action |
|---|---|
| Swipe | Unchanged (horizontal paging, in mushaf direction) |
| Tap zones | The outer 15% of each side turns the page (pointer and Pencil friendly). Elsewhere, a tap toggles chrome. |
| Keyboard | ← / → turn the page in mushaf direction: → goes to the *previous* page in RTL reading order. Make this configurable; default to the physical-book direction. Space / ⇧Space step forward and back. |
| Trackpad | Two-finger horizontal swipe pages, with no extra work. |

---

## 3. Reader chrome on regular widths

Fixes R4, H1–H4 and R6.

```
 ‹  ▤                    ┌───────────────────────┐            ⌕   🔖   Aa   ⎘
                         │ Al-Baqarah ⌄          │
                         │ Page 42 · Juz 3 · Hafs│
                         └───────────────────────┘
```

**Toolbar layout.** Use the iOS 26 glass `Stack.Toolbar` and header where available; otherwise the same layout in our own bar, at a 44pt height. From leading to trailing:

| Control | Behaviour |
|---|---|
| Back | Back |
| ▤ Contents | Toggles the Contents pane (⌘⌥1) |
| Title pill | Surah ⌄ and its meta line. Tapping opens Contents, scrolled to the current surah. |
| ⌕ Search | Opens Contents with search focused (⌘F) |
| 🔖 Bookmark | Bookmarks the current page or verse, filled when bookmarked (⌘D) |
| Aa | Reader settings popover (⌘,) |
| ⎘ Study | Toggles the Study pane (⌘⌥2) |
| Share | Moves into the Study pane's verse menu and the page context menu, so the toolbar stays at 5 actions |

**Type.** The title is `headline` 17pt and the meta line is `footnote` 13pt, from `theme.type`, never `moderateScale` (fixes H1).

**Audio controls.** When audio is active, a centred **capsule** floats above the bottom edge, at most 560pt wide:

```
╭──────────────────────────────────────────────────────────────╮
│  ◀◀   ▶‖   ▶▶     Al-Baqarah 2:255 · Alafasy      ━━━━●━━━  ⋯ │
╰──────────────────────────────────────────────────────────────╯
```

* It shows reciter, verse and a hairline progress bar.
* ⋯ opens the player options as a **popover** (fixes H4 and P1a).
* It replaces both the full-width `MushafPlayerBar` and the long `Stack.Toolbar` in the active state.

**Page scrubber.** A scrubber appears with the chrome on `medium`+, along the bottom edge (Apple Books pattern, fixes R6):

* While dragging, it shows a tooltip such as `Al-Baqarah · Juz 3 · p. 42`.
* Juz boundaries are drawn as tick marks.
* Release jumps to the page.
* VoiceOver gets an `adjustable` role, stepping by page, with juz as a rotor.

**Immersive mode.** Tap toggles chrome, as today. Also:

* Chrome auto-hides 2.5s after a page turn when the setting "Hide controls while reading" is on. It defaults on for `expanded`+.
* Docked panes stay; only the toolbar, scrubber and capsule fade.

---

## 4. Contents pane (leading)

Fixes X1–X5, E3, E4 and N4.

```
┌──────────────────────────────┐
│ ⌕ Search surah, verse, page  │
├──────────────────────────────┤
│ [ Surahs | Juz | Saved ]     │   ← segmented
├──────────────────────────────┤
│ CONTINUE                     │
│  Al-Kahf · p. 293      2h ago│
│                              │
│ AL-BAQARAH            ● now  │   ← current surah pinned & tinted
│  1  Al-Fatiha     7 · p.1    │
│  2  Al-Baqarah  286 · p.2   ✓│
│  3  Āl ʿImrān   200 · p.50   │
│  …                           │
└──────────────────────────────┘
```

**Segments.**

| Segment | Content |
|---|---|
| **Surahs** | 114 rows: number, transliterated name, Arabic glyph name, verse count, start page. The current surah is highlighted and scrolled into view on open. |
| **Juz** | 30 juz, each expandable to its hizb and quarters, with start pages. |
| **Saved** | Bookmarks, notes and highlights, filterable by type. A note row opens its verse **and** shows the note in Study (fixes N4). |

**Search.** Search reuses `mushafSearchVerses.ts` and runs inline. Results are grouped by type, each with its own icon (surah, verse, page), and verse results show the Arabic snippet in the reader font (fixes X3).

**Rows.**

* 52pt minimum height.
* Hover highlight.
* Context menu: *Open*, *Play from here*, *Open in New Window* (once scenes ship), *Copy link*.
* VoiceOver reads each row as one element (fixes E1's pattern here).

**Keyboard.** ⌘F focuses search. ↑ / ↓ move through results, Return opens one, Esc clears and then closes.

**Navigation behaviour.** Selecting an item navigates the page and **keeps the pane open** when docked. In overlay mode the pane closes.

---

## 5. Study pane (trailing), replacing the verse sheet

Fixes V1–V9, W1–W4 and the reading-type parts of S5.

```
┌───────────────────────────────────┐
│ 2:255 · Āyat al-Kursī      ◀  ▶  ⋯│  ← ⋯ = verse menu (play, repeat, bookmark,
├───────────────────────────────────┤        highlight, copy, share…)
│ [Translation|Tafsir|Words|Notes|…]│  ← segmented; "…" = Similar, Reflections, Theme
├───────────────────────────────────┤
│  ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ …   │  ← reader font + arabicFontSize
│                                   │
│  Saheeh International        ⌄    │
│  Allah – there is no deity except │  ← translationFontSize, 1.55 lh,
│  Him, the Ever-Living, the …      │     selectable
│                                   │
│  + Add translation                │
└───────────────────────────────────┘
```

**Selection.**

* Tapping a verse **selects** it.
* The verse gets the selection tint, and Study (if open) follows the selection.
* With Study closed, a tap only selects. The verse menu stays on long-press or right-click (§6).
* A **"Follow recitation"** pin in ⋯ makes Study track the playing verse during audio.

**Content tabs.**

| Tab | Design |
|---|---|
| **Translation** | The selected translations stacked (1–3). Each header is a menu to switch or remove it. |
| **Tafsir** | A tafsir switcher menu in the header, rendered with `TafseerHtmlRenderer` driven by reader settings (Arabic in the reader's Naskh face at `arabicFontSize × 0.75`; Latin at `tafsir` reading size). Selectable. Next / previous verse with ← / → while the pane has focus. |
| **Words** | The WBW grid in the reader font, wrapping inside the pane. Tapping a word plays it and expands its details inline (replaces `WordDetailSheet` on `medium`+). |
| **Notes** | Inline editor. ⌘↩ saves. Delete asks to confirm, with an undo toast (fixes N1 and N2). |
| **Similar** | The list on top; tapping a match opens a **compare view**, showing both verses with the shared phrase highlighted, *without* leaving the current page. *Go to verse* is an explicit button (fixes V8). |

**Layout.**

* Inner padding is 20.
* Text never exceeds the pane width. When the pane is widened to 480, translation lines stay at about 60–70 characters.

**Share.** Share opens from ⋯ and anchors the system share popover to the ⋯ button (fixes V9). The share-card preview is capped at 560.

---

## 6. Verse and word interactions

| Gesture | `compact` (unchanged) | `medium`+ |
|---|---|---|
| Tap verse | Select + chrome toggle (today) | Select. Study follows. Chrome toggles only on a tap outside a verse. |
| Long-press / right-click verse | Verse actions sheet | **Context menu with a preview** of the verse: Play from here, Repeat…, Bookmark, Highlight ▸ (colour submenu), Add note, Copy ▸ (Arabic, translation, both), Share…, Open in Study ▸ (Translation, Tafsir, Words, Similar) |
| Tap word (WBW enabled) | Word detail sheet | **Popover anchored to the word**: word in the reader font at 44pt, transliteration, meaning, root, ▶ play, ‹ › to step through words |
| Hover (pointer) | n/a | The verse under the pointer gets a 4% `text` tint; the cursor becomes a highlight-lift on toolbar buttons |
| Drag-select | Unchanged | Unchanged. The selection feeds Copy and Share in the context menu. |
| Apple Pencil | n/a | Same as touch. Double-tap on Pencil 2 toggles chrome. Scribble works in the search field. |

Implementation note: React Native has no context-menu primitive. Use `react-native-ios-context-menu` or a small Expo module around `UIContextMenuInteraction` / `UIEditMenuInteraction`, and keep the Skia hit-testing (`SkiaPage.tsx:540-561`) as the source of the verse key.

---

## 7. Reader settings: the "Aa" popover

Fixes S1–S3, S6, S7 and R8.

On `medium`+ this is a popover anchored to **Aa**, 360pt wide, and the page updates live behind it. On `compact` it stays a bottom sheet, capped at 560 when it is wider than that.

```
┌────────────────────────────────────┐
│ [ Mushaf | Translation | Words ]   │  ← view (segmented)
│                                    │
│  ○  ○  ●  ○  ○  ○  ○      ☾ Auto ⌄ │  ← theme swatches (28pt, labelled), mode menu
│                                    │
│  A−  ━━━━━━━●━━━━━━━  A+     32    │  ← size slider (continuous); Mushaf: "Fit page" + zoom
│                                    │
│  Tajweed               [  ●]       │
│  Translation   Saheeh Intl.  ›     │
│  Scroll        [ Pages | Vertical ]│
│                                    │
│  More settings…                    │  ← pushes inside popover: script/font, rewayah,
└────────────────────────────────────┘     weight, divine-name highlight, thematic, WBW options
```

**Size control.**

* It becomes a continuous slider using the reading ranges in [ipad-standards §4.2](../ipad-standards.md#42-reading-type), in real points (fixes L3 and S3).
* ⌘+ / ⌘− adjust it (Apple Books parity).
* In Mushaf view the slider is replaced by **"Fit page"** (default) and a pinch-to-zoom hint, with one line explaining why the page has a fixed layout (fixes R8).

**Theme swatches.**

* Show all 7 themes for the current mode.
* Each swatch is labelled for VoiceOver ("Parchment, selected").
* Long-press opens the full theme screen.

**Separate sizes per device.** Sizes are stored separately for phone and tablet ([ipad-standards §4.2](../ipad-standards.md#42-reading-type)). New keys: `arabicFontSizeTablet` and `translationFontSizeTablet`.

**Settings tab version** (`/mushaf-settings`, `/reading-theme`):

* Same groups, in a 640pt form column ([ipad-standards §5.3](../ipad-standards.md#53-content-width)).
* On `expanded`+, a **live preview page** is pinned beside the form, in the detail pane of the Settings split view.

---

## 8. Translation and List mode

Fixes L1–L4 and B2.

```
            ┌──────────────── 680pt max ────────────────┐
            │                ﴿ ٢٥٥ ﴾                     │
            │   ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ۚ …     │
            │                                            │
            │   Allah – there is no deity except Him …   │  Saheeh
            │   Allah! There is no god but He …          │  Yusuf Ali
            └────────────────────────────────────────────┘
```

* **Column.** The reading column is centred at a maximum of 680pt (§5.3 of the standard). Both `ReadingPageView` and `ContinuousListView` take `MushafLayoutMetrics` / pane width instead of `SCREEN_WIDTH`.
* **Translations.** 1–3 translations are stacked under each verse, each with a small trailing source label.
* **Optional side-by-side.** On `expanded`+, with the setting *Arabic beside translation* enabled, the Arabic sits on the trailing side and the translation on the leading side, split 55/45 ([ipad-standards §9.2](../ipad-standards.md#92-verse-by-verse-and-translation-view)).
* **Verse numbers** use the mushaf end-of-verse glyph, not a pill.
* **Free space.** When the Study pane is docked, the column re-centres in the remaining width.

---

## 9. Typography for reading surfaces

Every reading text size comes from the reading scale, never from `moderateScale`.

| Text | Font | Size (tablet default) | Line height | Source |
|---|---|---|---|---|
| Mushaf page | DK V1/V2, IndoPak, QCF | Fit (§2) | Fit, ≥ 2.0× | `getMushafLayout` |
| List-mode Arabic | Reader font | 32 | 2.0× | `arabicFontSizeTablet` |
| Study pane Arabic | Reader font | `arabicFontSize × 0.85` | 2.0× | settings |
| Translation | Manrope Regular, or the language's face (IBM Plex Sans Arabic for Arabic, Noto Nastaliq for Urdu, etc.) | 18 | 1.55× | `translationFontSizeTablet` |
| Tafsir body | Same as translation; Arabic tafsir uses IBM Plex Sans Arabic | 18 | 1.6× | new `tafsirFontSize` |
| Quran quotes inside tafsir | Reader font | Body + 2 | 2.0× | — |
| Page labels | Manrope Medium, tabular digits | 13 (`footnote`) | — | `theme.type` |
| Chrome | `theme.type` ramp | — | — | [standards §4.1](../ipad-standards.md#41-ui-type-ramp) |

Retire `ScheherazadeNew` in tafsir and `'Uthmani'` in word detail, so there is one Quranic face per user setting (fixes V3 and W2).

---

## 10. Reading theme tokens

Fixes S4 and S5.

Extend each reading theme from 5 tokens to 11:

```ts
interface ReadingTheme {
  background; card; text; textSecondary; border;   // existing
  selection;        // verse selection tint (text @ 8–10%)
  playback;         // follow-along band
  divider;          // spine, rules
  tajweed: TajweedPalette;   // per-theme tuned tajweed colours (≥ 3:1 vs card)
  allahHighlight: string;    // per-theme tuned (≥ 4.5:1)
  pageEdge;         // book-layout edge
}
```

* **Tuned tajweed palettes.** The page and the preview must use the *same* palette (fixes S4). Each light theme gets a darkened set and each dark theme a lightened set, every colour ≥ 3:1 against `card`. Sand needs the most work.
* **Night text.** Dark default text goes from `#ffffff` to ≈ `#E8E6E1` (still ≥ 15:1) to reduce halation.
* **Secondary text.** Raise `textSecondary` in Dark Amber, Sage, Indigo and Sepia to ≥ 4.5:1.
* **Tajweed legend.** A legend sits behind an ⓘ in the settings popover and the Study pane.

---

## 11. Notes editor

Fixes N1–N3.

On `medium`+ the note editor is a **centred form sheet**, 560 wide.

* The verse preview sits on top, in the reader font, clamped to 3 lines.
* The text area grows to fill the sheet.
* The toolbar holds *Cancel* (Esc), *Delete* (with confirmation) and *Save* (⌘↩).
* There is one shared component for both entry points. It uses theme tokens for the destructive colour.

---

## 12. Adhkar reader

Fixes D1 and D2.

* Same reading scale and 680 column as List mode.
* The size control uses the same slider.
* On `expanded`+ the counter (`TasbeehCounter`) docks to the trailing side, so the text column never moves.

---

## 13. What stays exactly as it is on `compact`

Every phone and every compact iPad window (Slide Over, ⅓ Split View) keeps today's UI: bottom sheets, full-screen search overlay, phone page metrics. That is the regression-free baseline, and each step in the [roadmap](05-roadmap.md) must leave it untouched.
