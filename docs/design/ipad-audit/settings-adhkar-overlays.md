# iPad audit: Settings, Adhkar lists, onboarding/modals, and overlays

> Scope: the Settings tab (`app/(tabs)/(d.settings)/*`, `components/settings/ThemePicker.tsx`, `components/MushafSettingsContent.tsx`, `components/ReadingThemeContent.tsx`, `components/screens/TranslationsContent.tsx`), the Adhkar list screens (`app/(tabs)/(a.home)/adhkar/index.tsx`, `[superId]/index.tsx`, `saved/index.tsx`, `components/AdhkarView.tsx`, `components/adhkar/*`), with only layout and navigation notes for the dhikr detail screens, plus onboarding and modals (`components/modals/*`, `app/+not-found.tsx`, `components/NetworkStatusMonitor.tsx`, `utils/toastUtils.ts`), and the action sheet system (`components/sheets/*`, `components/BottomSheetModal.tsx`).
> Method: code read only. No simulator was available in this Linux container, so pixel sizes are computed from the code. Date 2026-10-26.
> Proposals follow the [iPad standards](../ipad-standards.md), cited as §N: width classes §2, scaling §3, type ramp §4.1, margins §5.2, content widths §5.3, split views §6, input §7, sheets §8, accessibility §12. Where a proposal needs something the standard does not cover, it is listed under [Proposed changes to the standard](#proposed-changes-to-the-standard).

### How the numbers in this doc were computed

`react-native-size-matters` `moderateScale(x)` = `x + (x * shortSide/350 - x) * 0.5`. On iPad that comes to:

| Device (short side) | factor | `ms(10.5)` | `ms(13.5)` | `ms(24)` |
|---|---|---|---|---|
| iPad mini (744) | 1.56x | 16.4 | 21.1 | 37.5 |
| iPad Pro 11" (834) | 1.69x | 17.8 | 22.8 | 40.6 |
| iPad Pro 13" (1032) | 1.97x | 20.7 | 26.6 | 47.4 |

`verticalScale(x)` is not moderated: it scales by the full `longSide/680`, so 1.76x on an 11" and 2.0x on a 13". The capped helpers in `utils/scale.ts` and `theme.typography` keep phone sizes. **Not one file in this group uses them.** Every screen below is 1.7–2x phone size inside a 720pt column. Below, "11"" means iPad Pro 11" in portrait (834×1194, rail 88pt, content column 720pt).

Secondary text contrast, measured on the theme colors (`styles/colorSchemes.ts`):

| Token use | Light | Dark | WCAG AA (4.5:1) |
|---|---|---|---|
| `textSecondary` at alpha 0.45 (descriptions, used everywhere in Settings) | 2.67:1 | 2.64:1 | fail |
| `textSecondary` at alpha 0.5 (section headers) | 3.02:1 | 3.02:1 | fail |
| `text` at alpha 0.35 (ThemePicker labels when not selected) | 2.24:1 | 3.12:1 | fail |

---

## Summary

Top issues across the group, ranked:

1. **The Adhkar home grid falls apart on iPad (P0).** `AdhkarView` sizes its two-column grid from the *window* width (834–1032pt) with inflated padding. Inside a 720pt column two cards no longer fit. Each card wraps to its own row: one 372–461pt card per row, left-aligned, with an empty strip on the right (`components/AdhkarView.tsx:110-127`, `:230-234`). The dhikr reader pager has the same bug: pages are `Dimensions.get('window').width` wide inside the 720pt column, so about 114pt of every page is clipped and the text sits off-centre (`[superId]/[dhikrId].tsx:56,68,390,464`; `saved/[dhikrId].tsx:42,54,312,386`).
2. **All 28 action sheets are full-width phone bottom sheets on iPad, with fixed heights taken from the portrait window (P0/P1).** `SheetProvider` sits at the root (`app/_layout.tsx:503`). No sheet constrains its width or checks for a tablet. 11 sheets fix their height as a share of a module-scope `Dimensions` height (`*_HEIGHT = Dimensions.get('window').height * 0.6–1.0`). The sheets opened from the Mushaf (the only screen that rotates) are therefore taller than the screen in landscape (`VerseActionsSheet.tsx:133`, `MushafLayoutSheet.tsx:23,113`). They need to follow the §8 presentation policy. The Action sheets section below maps each representative sheet to its §8 presentation.
3. **Settings uses a phone layout scaled up 1.7–2x, where iPadOS uses a two-column Settings split view (P1).** The 720pt column has 23pt row titles, 18pt captions, about 97pt-tall rows and no large title (`(d.settings)/index.tsx:41` hides the header, and `:598-628` uses raw `moderateScale`). Native `Switch`es do not scale, and they are also shrunk to 0.8x (`:631-633`), so they look tiny next to the inflated text.
4. **Accessibility debt throughout: descriptions fail contrast, and icon buttons have no labels (P1).** Secondary text everywhere is `textSecondary` at alpha 0.45 (2.6:1). Settings rows, ThemePicker segments, reading-theme chips, the Adhkar header share button and the back button have no `accessibilityRole` or `accessibilityLabel`. None of these screens has hover, focus or keyboard support.
5. **Onboarding and overlays ignore iPad presentation norms (P1).** The What's New pager becomes a 710–829pt-wide card with 41–47pt titles (`WhatsNewOnboarding/index.tsx:56-60`). Its page width comes from a module-scope `Dimensions`. Offline state shows only as a toast that disappears (`NetworkStatusMonitor.tsx`). A broken link closes silently with no message (`app/+not-found.tsx`). Two components are dead code: `components/modals/WhatsNewModal.tsx` and `components/BottomSheetModal.tsx`.

Cross-cutting fix that unlocks most of this group: add the shared primitives `ListSection` / `ListRow` (inset grouped, §4.1 roles, hover/focus states per §7.2, a11y roles per §12), an `AppSheet` (§8 presentation by width class), and `useContainerWidth()`. Choose the layout from `widthClass` (§2), and size grid columns from the measured pane width (§10.1), never from module-scope `Dimensions`. Then migrate these screens to `utils/scale.ts` (§3).

---

## Settings root — `/(d.settings)`

**Files:** `app/(tabs)/(d.settings)/_layout.tsx`, `index.tsx`, `components/settings/ThemePicker.tsx`
**What it is:** the grouped list of settings: Appearance, Quran, Audio, App & Data, Feedback, About, Analytics, Developer.
**Current iPad behavior:** a single 720pt column centered between empty gutters. The stack header is hidden, so the screen has no title. Rows are inflated about 1.7x (22.8pt title, 18.6pt description, 20pt vertical padding), which makes each row about 97pt tall against 44–60pt in iPadOS Settings. Fewer than half the settings fit on one screen. Tapping a row pushes a full-screen detail, which replaces the list. Five rows open external links, marked with an icon.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Layout | No list/detail split. Every detail push replaces the list, so the user loses context, unlike iPadOS Settings, where the list stays visible. The 720pt cap leaves 234pt (11") or 312pt (13") of gutter that does nothing. | `_layout.tsx:20-78` (Stack inside `MaxWidthContainer`) | P1 |
| 2 | Typography | Every size uses raw `moderateScale`: section header 10.5 → 17.8pt, title 13.5 → 22.8pt, description 11 → 18.6pt. These are bigger than iPadOS Settings (17pt body, 13pt footnote) and out of step with capped `theme.typography`. | `index.tsx:86,566-628` | P1 |
| 3 | Visual | No screen title. `headerShown:false` and the scroll view starts at "Appearance". Every iPad list root has a large title. | `_layout.tsx:41`, `index.tsx:422-434` | P1 |
| 4 | UI | A native `Switch` (fixed 51×31pt) shrunk with `scale 0.8` sits next to text inflated 1.7x. It looks undersized and its hit area shrinks too. | `index.tsx:502-509,631-633` | P1 |
| 5 | Accessibility | Descriptions at 2.67:1 contrast. Rows are `Pressable` with no `accessibilityRole="button"`/`"link"`, and external links are not announced as such. | `index.tsx:446-451,622-628` | P1 |
| 6 | UI | ThemePicker buttons have no `accessibilityRole="radio"` or `accessibilityState`. Labels when not selected are at 0.35 alpha (2.2:1). It is also a second control for the same setting as the Reading Theme segmented control. | `ThemePicker.tsx:57-69,101-105`; `ReadingThemeContent.tsx:229-243` | P1 |
| 7 | Input | No hover highlight for pointer, no focus ring or arrow-key/Tab navigation for a hardware keyboard, and no ⌘, shortcut to open Settings. | whole file (no `onHoverIn`, no `focusable`) | P1 |
| 8 | Density | Every row has a two-line description ("Mushaf settings: Customize reading display"). iPadOS puts the current value on the right of the row (for example "English", "Hafs", "1.2 GB"), not a static caption. Rows show no current values at all. | `index.tsx:133-267,455-459` | P2 |
| 9 | Visual | Icons are 22pt × 1.69 = 37pt monochrome glyphs with no tile, so they look heavier than the text. The external-link glyph is 27pt. | `index.tsx:293-310,461-470` | P2 |
| 10 | Code health | `account` screen declared with no route file. | `_layout.tsx:60` | P2 |

### Proposed iPad design
**Reference:** iPadOS Settings (two-column split view, inset grouped lists), Apple Music Settings sheet for value rows.

- **List-detail split at `expanded`+ (§2, §6).** At 13" portrait (1024): sidebar 240, list 340, detail 444. At 11" landscape (1180): list 340, detail 600. At `large`: sidebar 280, list 380, detail ≥ 700. The list pane is 320–380pt, with `ListSection` cards and a `title1` "Settings" title (28pt Bold on tablet, §4.1). The detail pane holds the selected page, leading-aligned and capped at 640pt (§5.3). The selected row uses the selected token `Color(text).alpha(0.08)` and an `md` 12pt radius (§5.4). At `medium` (iPad mini and 11" portrait), keep push navigation, with content centered and capped at 640pt (§5.3) inside the 24pt page margin (§5.2). At `compact`, use the phone layout (§2.2).
- **Type (§4.1 roles, capped per §3):** row title `headline` 17pt, right-side value `callout` 15pt, section footer `footnote` 13pt, section header `overline` 12pt. Secondary text uses `textSecondary` at ≥ 0.8 alpha (§12; see the proposed change to the `overline` alpha). Row `minHeight` 44pt (52pt with a subtitle), so rows grow with Dynamic Type (§4.3). Group container radius `md` 12 (§5.4), `lg` 16pt row inset, section spacing 32pt (§5.2).
- **Rows show values instead of descriptions:** Language → "English"; Default reciter → name; Storage → used size; Translations → active translation. Descriptions move to footers below the section (13pt) where they are needed, for example the analytics explanation.
- **Icons:** a 28pt rounded-square tile (radius 7, `text` at alpha 0.06) holding an 18pt glyph, as in Settings. Keep Bayaan's monochrome style.
- **Appearance:** turn the 3-up ThemePicker into a single inset row with a native segmented control (System | Light | Dark), and add a row "Reading theme ›" right under it. Remove the duplicated segment from Reading Theme, or link the two clearly.
- **Pointer and keyboard (§7):** hover uses `Color(text).alpha(0.04)` on the row (§7.2). Rows are focusable, ↑/↓ moves the selection in the list pane, and Return opens. ⌘, opens Settings from anywhere. ⌘, is not in the §7.3 table, so it is listed under the proposed changes.

```
iPad landscape (1194 wide): rail 240 | list 320 | detail
┌────────┬──────────────────────────┬──────────────────────────────────────────┐
│ Home   │ Settings                 │  Mushaf                                   │
│ Search │                          │  ┌──── live preview (see Mushaf below) ──┐│
│ Library│ APPEARANCE               │  │       بِسْمِ ٱللَّهِ ...              ││
│▶Settings│┌────────────────────────┐│  └───────────────────────────────────────┘│
│        ││ Theme [Sys|Light|Dark] ││  VIEW                                     │
│        ││ Reading theme   Sepia ›││  ┌───────────────────────────────────────┐│
│        │└────────────────────────┘│  │ Mushaf pages                      ✓   ││
│        │ QURAN                    │  │ Verse list                            ││
│        │┌────────────────────────┐│  └───────────────────────────────────────┘│
│        ││▣ Mushaf           ›    ││  ...                                      │
│        ││▣ Translations  Saheeh ›││                                           │
│        │└────────────────────────┘│                                           │
│        │ AUDIO                    │                                           │
│        │┌────────────────────────┐│                                           │
│        ││▣ Default reciter Alafasy›│                                          │
│ ▶ mini ││▣ Reciter choice   Ask ›││                                           │
└────────┴──────────────────────────┴──────────────────────────────────────────┘
```

### Implementation notes
- Add `components/list/ListSection.tsx` + `ListRow.tsx` (title, value, icon tile, accessory: chevron, external, check, switch, segmented). Use capped `utils/scale.ts`, a11y roles, `onHoverIn/Out`, `focusable`. Every Settings screen, the Translations screen and the sheets can reuse them. **M**
- `(d.settings)/_layout.tsx`: at `widthClass` `expanded`+, render `<View row><SettingsList selected={segment}/><Stack/></View>`. Replace the stack-level 720 `MaxWidthContainer` with a per-screen 640 cap (§5.3). `useSegments()` drives the selection. Choose the detail pane's initial route (Mushaf) when nothing is selected. **L**
- `index.tsx`: header gets `headerLargeTitle` (or an in-content 34pt title on non-glass), and rows show value accessories. Remove the `scale 0.8` on the switches. **M**
- Delete the `account` stack entry, or add the route. **S**

---

## About — `/(d.settings)/about`

**Files:** `app/(tabs)/(d.settings)/about.tsx`
**What it is:** logo, version, tagline, mission text, feature list and a "Coming soon" list.
**Current iPad behavior:** a 203pt logo (120 × 1.69), 22pt body text at 2.6:1 contrast, and feature cards in one stack, all inside the 720 column with about 40pt side padding. The text measure is about 640pt (≈ 95 characters), which is too long to read comfortably.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Typography | Raw `moderateScale` everywhere (tagline 17 → 28.7pt, body 13 → 22pt), and the measure is longer than 75ch. | `about.tsx:141-223` | P1 |
| 2 | Accessibility | Body and descriptions at `textSecondary` alpha 0.45 (2.67:1). Section headers at alpha 0.5. | `about.tsx:183,198,220` | P1 |
| 3 | Content | "Coming soon" lists Translations, Word-by-word and Bookmarking, which have all shipped (the Translations screen and the WBW setting exist). This is stale content. | `about.tsx:27-33` | P2 |
| 4 | Layout | Seven feature cards stacked in one column on a 720pt canvas waste space. The bottom padding is hard-coded to 160 × 1.69 = 270pt instead of `useBottomInset`. | `about.tsx:96-105,153` | P2 |

### Proposed iPad design
**Reference:** App Store "About this app" or the Apple Music credits page. Logo 96pt, version `footnote`, tagline `title2` (22pt), prose as long-form reading text (`body` 16pt at 1.45×) at about 65 characters per line (§4.2, roughly 560pt), inside the 640pt settings cap (§5.3). Features become a 2-column grid of compact cards (`headline` title, `callout` body, 16pt gutter per §5.2) at `medium`+. Merge "Coming soon" into a short roadmap list, and remove shipped items. All body text uses `textSecondary` at full alpha (≥ 7:1).

### Implementation notes
- Switch to `utils/scale.ts` / `theme.typography`. Wrap the content in `maxWidth: 560, alignSelf: 'center'`. Use `useBottomInset`. **S**
- Fix the strings in `locales/*/settings.json` `about.comingSoon`. **S**

---

## Credits — `/(d.settings)/credits`

**Files:** `app/(tabs)/(d.settings)/credits.tsx`
**What it is:** grouped list of data, audio, font and open-source credits with external links.
**Current iPad behavior:** a good inset grouped structure, but the same 1.7x inflation (title 22.8pt, description 19.4pt at 2.67:1). The external-link glyph is grey at alpha 0.35. Rows work on a phone but feel bloated on iPad.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Typography | Raw `moderateScale`. Section headers are uppercased twice (`toUpperCase()` plus `textTransform`), which also breaks locale-aware casing. | `credits.tsx:198,269-275` | P1 |
| 2 | Accessibility | Rows with a link have no `accessibilityRole="link"` or hint. Rows without a link are still `Pressable` (disabled) and are announced as buttons. | `credits.tsx:204-212` | P1 |
| 3 | Input | No hover state on link rows. Links open in Safari, which leaves the app. iPad users expect an in-app `SFSafariViewController` (expo-web-browser) for credits. | `credits.tsx:177-181` | P2 |
| 4 | Duplication | Its own copy of the card, divider and section-header styles (same values as Settings root and Storage). | `credits.tsx:269-290` | P2 |

### Proposed iPad design
Same `ListSection`/`ListRow` as Settings: title 16pt, caption 14pt on 2 lines, a trailing `arrow.up.right` glyph at 14pt in `textSecondary`. In the split view it sits in the right pane, capped at 640pt. Open links with `WebBrowser.openBrowserAsync` (page sheet on iPad).

### Implementation notes
- Migrate to `ListRow` with `accessory="external"`. Use expo-web-browser. **S**

---

## Default reciter — `/(d.settings)/default-reciter`

**Files:** `app/(tabs)/(d.settings)/default-reciter.tsx`, `components/ReciterItem.tsx`, `components/SearchInput.tsx`
**What it is:** a card for the current reciter, a search field, and a results list of reciters with a complete Quran.
**Current iPad behavior:** the list is **empty until the user types**: `data={searchResults}`, and the empty state says only complete-Quran reciters are listed. On a 13" canvas that is a large empty page. The current-reciter card has a 122pt artwork and doubled horizontal insets (16 + 15 = 31pt × 1.69).

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | UX | You cannot browse. Nothing shows until you search, unlike Apple Music or Spotify, where you browse and search filters the list. | `default-reciter.tsx:52-60,132-144` | P1 |
| 2 | Layout | Insets stack up: `content.paddingHorizontal 16` plus `searchSection 15` plus `reciterList 15` plus the card's `marginHorizontal 15`. | `default-reciter.tsx:158-211` | P2 |
| 3 | UX | Selecting a reciter calls `router.back()`. In a split view this would close the pane. It should select in place with a checkmark. | `default-reciter.tsx:63-69` | P1 (with split) |
| 4 | Input | The search field gets no automatic focus or ⌘F, and there is no keyboard navigation through the results. | `default-reciter.tsx:115-129` | P2 |
| 5 | Typography | `verticalScale` (full 1.76x) is mixed with `moderateScale` (1.69x). | `default-reciter.tsx:4-8,164,189,205` | P2 |

### Proposed iPad design
**Reference:** Apple Music "Choose a station" / iPadOS Settings "Language & Region" picker. At the top, a 64pt current-reciter row in an inset card. Below it, a search field pinned in the navigation bar (`headerSearchBarOptions`). Then the full A–Z list of complete reciters, with an alphabetical index on the right edge and a check on the selected one. Rows are 56pt with 40pt artwork. In the split view, selecting updates in place. When pushed, it pops after 250ms so the user sees the check land.

### Implementation notes
- Seed `data` with `completeReciters` when the query is empty. Switch to `SectionList` by initial letter. Use `headerSearchBarOptions`. **M**

---

## Language — `/(d.settings)/language`

**Files:** `app/(tabs)/(d.settings)/language.tsx`
**What it is:** radio list: System plus each available language by endonym.
**Current iPad behavior:** each option is its own bordered card with an 8pt gap, not one grouped list. The cards are about 70pt tall with 22.8pt text. Selection uses `Alert.alert`, which is centered on iPad and acceptable.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | UI | Separate cards per option instead of a single inset grouped list. This is the pattern for radio lists in iOS. | `language.tsx:304-347,379-385` | P2 |
| 2 | Typography | Raw `moderateScale`. Subtitle and footnote at 2.67:1. | `language.tsx:358-420` | P1 |
| 3 | Accessibility | Good: `accessibilityRole="radio"` and `accessibilityState` are set. But `selected` should be `checked` for the radio role. | `language.tsx:310-311` | P2 |

### Proposed iPad design
A single `ListSection` with a footer note: rows 44pt, endonym 17pt, an English exonym as a 14pt value on the right ("العربية … Arabic"), and a trailing check. Put the restart note in the section footer, not above the list.

### Implementation notes
- Migrate to `ListRow accessory="check"`. Change the state to `checked`. **S**

---

## Mushaf settings — `/(d.settings)/mushaf-settings`

**Files:** `app/(tabs)/(d.settings)/mushaf-settings.tsx`, `components/MushafSettingsContent.tsx` (1,986 lines). The same content appears in `MushafLayoutSheet`.
**What it is:** view mode, scroll direction, page design, reading theme link, word-by-word, font sizes with a live sample, text weight, divine-name highlight, thematic highlight, reflections, font (renderer), tajweed, rewayah.
**Current iPad behavior:** one very long scroll of about 12 sections at 1.7x. The live Arabic sample sits *inside* the font-size card, so it scrolls out of view while the user changes the font, weight, tajweed or theme further down. Changes are never previewed next to their controls. `verticalScale` (1.76x) and `moderateScale` (1.69x) are mixed.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | UX | The preview is not persistent. The font, weight, tajweed, Allah-highlight and rewayah controls sit far below the only sample, so you cannot see the effect of a change. Tarteel and Quran.com both keep a preview pinned while you adjust. | `MushafSettingsContent.tsx:984-1000` (sample in font card), `:1063-1240` (other controls) | P1 |
| 2 | Layout | A single column of about 12 sections on a 720–1032pt canvas. A two-pane layout (preview + controls) fits well. | `MushafSettingsContent.tsx:723-1290` | P1 |
| 3 | Typography | Raw `moderateScale` and `verticalScale` everywhere: font size step buttons 32 → 54pt, labels 22.8pt, section headers 17.8pt. | `:13`, `:1687-1800` | P1 |
| 4 | UI | Single-choice lists (View, Scroll, Page design) are built as rows of checks with hand-drawn pill icons, repeated 6 times inline (about 150 lines). A segmented control or a visual picker (page thumbnails, like Apple Books "Themes & Settings") reads better on iPad. | `:731-885` | P2 |
| 5 | UI | The step buttons for font size have no `accessibilityLabel` ("Decrease Arabic size") and no `accessibilityValue`, and the control is not adjustable. | `:294-336` | P1 |
| 6 | Accessibility | Helper texts and sub-headers at alpha 0.45. | `:1711-1715,1790-1797` | P1 |
| 7 | Code | The sample uses `moderateScale(currentActualSize)` to match readers (`VerseItem.tsx:518`, `DhikrReader.tsx:132`). This is consistent today, but if the readers move to capped scaling the preview must move in the same change. | `:214,225` | P2 (coupling) |

### Proposed iPad design
**Reference:** Apple Books "Themes & Settings", Tarteel / Quran.com reading settings with a live preview.

- **Preview beside the controls when the pane allows it:** if the detail pane is ≥ 640pt (pushed at `expanded`+, or the split detail at `large`), put a **sticky live preview** on the left (40%, min 280pt). It shows Al-Fatiha 1–2 rendered with the current renderer, theme, tajweed, size and weight, plus a translation line when list mode is on. On the right, the controls scroll independently. In narrower panes (the split detail at `expanded`, and `medium`), the preview becomes a 200pt sticky header above the controls.
- **Controls regrouped into 5 sections:** *Layout* (View: Mushaf/List segmented; Scroll: Horizontal/Vertical segmented; Page: Fullscreen/Book thumbnails 120×160pt, shown only when relevant), *Text* (Arabic size slider with 7 steps + A/A glyphs, weight segmented, font picker as a row with value → pushes a picker), *Color* (reading theme row with swatch → Reading Theme, tajweed switch, divine-name highlight with color dots), *Word by word* (switch + two checks), *Rewayah* (row with value → picker).
- **Type (§4.1):** row `headline`, section `overline`, helper `footnote` in `textSecondary` at ≥ 0.8 alpha (§12).
- **Same component in the Mushaf** (`MushafLayoutSheet`): §8 makes Mushaf settings a **trailing side panel (360–400pt) at `expanded`+**, so the page stays visible. The page itself is the preview, so the preview block is hidden. At `medium`, §8 offers only a centered form sheet, which would cover the page. A 375pt popover anchored to the "Aa" button, as in Apple Books, is proposed instead under the proposed changes.

```
Settings split, right pane (≈ 634 wide in landscape) or full width when pushed
┌──────────────────────────┬───────────────────────────────────────┐
│  LIVE PREVIEW (sticky)   │  LAYOUT                               │
│ ┌──────────────────────┐ │  View        [ Mushaf | List ]        │
│ │  بِسْمِ ٱللَّهِ       │ │  Scroll      [ Horizontal | Vertical ]│
│ │  ٱلرَّحْمَٰنِ ٱلرَّحِيمِ │ │  Page        ▭ Fullscreen  ▯▯ Book    │
│ │  In the name of Allah│ │  TEXT                                 │
│ └──────────────────────┘ │  Arabic size  A ──●────── A           │
│  Theme: Sepia · DK V2    │  Weight      [ Normal | Bold ]        │
│                          │  Font        Digital Khatt V2      ›  │
│                          │  COLOR                                │
│                          │  Reading theme   ■ Sepia           ›  │
│                          │  Tajweed colors                  (●)  │
└──────────────────────────┴───────────────────────────────────────┘
```

### Implementation notes
- Split `MushafSettingsContent` into `MushafPreview` + section components (`LayoutSection`, `TextSection`, `ColorSection`, `WbwSection`, `RewayahSection`). Accept `variant: 'page' | 'popover'`. **L**
- Replace the repeated check-row blocks with `ListRow accessory="segmented"` (`@react-native-segmented-control/segmented-control` is already a dependency). **M**
- Make the font-size stepper `accessibilityRole="adjustable"` with `accessibilityActions` increment/decrement. **S**

---

## Reading theme — `/(d.settings)/reading-theme`

**Files:** `app/(tabs)/(d.settings)/reading-theme.tsx`, `components/ReadingThemeContent.tsx`
**What it is:** a Skia preview, a System/Light/Dark segment (which changes the **app** theme), and a grid of color chips.
**Current iPad behavior:** the preview is 406pt tall (`moderateScale(240)` at module scope). The chips are 60×72 → 101×122pt, with a `flexWrap` row and labels of `ms(8)` = 13.5pt. In 666pt of usable width that gives 5 chips per row, left-aligned with a ragged last row. A selected chip scales 1.06 and may clip against its neighbours.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Layout | A fixed-width chip grid in a wrapping row: ragged, left-aligned, columns not computed from the container. | `ReadingThemeContent.tsx:245-284,674-698` | P1 |
| 2 | UX | The segmented control changes the whole app's theme mode, which duplicates the Settings Appearance picker, and the disclosure text is easy to miss. Users expect "reading theme" to affect only the reader. | `:174-182,229-243`; `index.tsx:433` | P1 |
| 3 | Accessibility | The chips have no `accessibilityRole="radio"`, `accessibilityState` or label (the visible text is the theme name plus "ب"). Chip labels are 8pt on a phone. | `:256-282,695-698` | P1 |
| 4 | Typography | `PREVIEW_HEIGHT` is computed once at module load. The disclosure text is at alpha 0.45. | `:634,656-661` | P2 |
| 5 | Code | `onBack` prop accepted but unused. | `:81,86-88` | P2 |

### Proposed iPad design
**Reference:** Apple Books themes and Kindle color themes. A preview card of 280pt height (capped), spanning the column. Below it, theme tiles in a computed grid: `columns = floor((containerWidth + 16) / (120 + 16))`, which gives 5 at 720pt and 4 at 600pt. Tiles are 120×88pt, show a short "بسم الله" sample at 22pt and the name at 13pt, and the selected tile gets a 2pt ring in `text` color with no scaling. Group the tiles as "Light" and "Dark" sections, and always show both, so users can choose the dark-mode theme without switching modes. Replace the app-mode segment with a footnote link "App appearance follows Settings › Appearance".

### Implementation notes
- Measure the container with `onLayout` or `useContainerWidth()`. Show both theme lists. Drop the segment, or make it a filter that does not change the app mode. Add a11y. **M**

---

## Reciter choice — `/(d.settings)/reciter-choice`

**Files:** `app/(tabs)/(d.settings)/reciter-choice.tsx`
**What it is:** an "Ask every time" switch, and when it is off, a choice between Browse all and Use default.
**Current iPad behavior:** a switch row in a card, and two separate option cards with 68pt circle icons (40 × 1.69) and `check-circle`. Fine structurally, oversized on iPad.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | UI | The options are separate cards instead of one radio group. The icon circles add weight without meaning. | `:90-157,241-248` | P2 |
| 2 | Accessibility | The option `Pressable`s have no role or state. The switch has no label linked to its title. | `:94-101,73-80` | P1 |
| 3 | UX | Hiding the method section when "Ask every time" is on makes the layout jump. iOS shows dependent rows dimmed. | `:85` | P2 |
| 4 | Typography | Raw `moderateScale` and the 0.8 switch. | `:167-263` | P1 |

### Proposed iPad design
One `ListSection` "When playing a surah": the switch row "Ask every time". The next section, "Otherwise", holds 2 radio rows (Browse all reciters / Use default reciter → shows the default's name as its value). They are dimmed and disabled while "Ask" is on. Footer text explains the behavior.

### Implementation notes
- Migrate to `ListRow`. Keep both sections mounted and use the disabled state. **S**

---

## Storage — `/(d.settings)/storage`

**Files:** `app/(tabs)/(d.settings)/storage.tsx`
**What it is:** a stacked storage bar, a legend, "Remove all downloads" and "Clear cache".
**Current iPad behavior:** a 13.5pt bar and legend at 1.7x. The two destructive actions are filled **primary** buttons (inverted `text`/`background`), each in its own card with the text "Remove" or "Clear". Results come back through `Alert.alert` (centered, acceptable).

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | UI | The destructive actions look like primary CTAs. iOS uses red text rows ("Delete All Downloads") in a list. | `:312-335,682-691` | P1 |
| 2 | Visual | Hard-coded iOS system colors (`#34C759`, `#007AFF`, `#E5E5EA`) outside the theme. "Free" `#E5E5EA` is almost invisible on the light background `#f4f3ec`. | `:435-440` | P1 |
| 3 | UX | No per-item management. iPadOS Storage and Apple Music show the largest items (reciters, surahs) with a swipe to delete. Here it is all or nothing. | whole screen | P1 |
| 4 | Accessibility | The bar has no `accessibilityLabel` summary. The dots are color-only. | `:470-509` | P2 |
| 5 | State | `setIsClearing` is stored but never shown (no spinner, and the button can be tapped twice). | `:342` | P2 |

### Proposed iPad design
**Reference:** iPadOS Settings › General › iPad Storage, and Apple Music › Downloaded. Header: the total used by Bayaan (28pt) and the bar (10pt high, 5pt radius, theme-derived colors). Legend as a 2×2 grid on iPad. A "Downloads" list grouped by reciter (artwork 40pt, size as value, chevron → surahs), with Delete by swipe, context menu and Edit mode (§7.2: never swipe-only). Last, a separate section with red rows "Clear Cache" and "Remove All Downloads". Each asks for confirmation with an Alert (§8: destructive confirmations stay Alerts at every width class), and shows a spinner while running.

### Implementation notes
- Colors from `styles/colorSchemes.ts` (add `chart.*` tokens). Make the actions `ListRow destructive`. Add a downloads list from `downloadStore`. **M**

---

## Translations & Tafaseer — `/(d.settings)/translations` (also `/(a.home)/translations`)

**Files:** `components/screens/TranslationsContent.tsx` (1,183 lines)
**What it is:** a Translations/Tafaseer `TabSelector` in the header, then the active card, downloaded items and browse-by-language, as two layered FlashLists.
**Current iPad behavior:** grouped list cards at 1.7x. Hundreds of rows grouped by language, **with no search**. Delete is a 14 × 1.69 = 24pt `minus-circle` icon with `hitSlop 8`. The tab selector is `moderateScale(220)` = 372pt wide in the header.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | UX | No search or filter across a long multilingual list. Quran.com and Tarteel both have a search field in the translation picker. | `TranslationsContent.tsx:216-990` (no search) | P1 |
| 2 | Input | Delete is a tiny, low-contrast inline icon (alpha 0.25). No swipe-to-delete and no context menu. | `:782-797,869-884` | P1 |
| 3 | Layout | Two-pane fits: languages on the left, translations on the right, or at least a sticky language index. | `:944-983` | P2 |
| 4 | Accessibility | Rows show download state only with icons (arrow-down, dot). There is no `accessibilityHint` for "Download" vs "Select". | `:752-805` | P1 |
| 5 | Typography | Raw `moderateScale`, and the header segment is 372pt wide. | `:907-926,993-1180` | P2 |

### Proposed iPad design
**Reference:** Quran.com translation picker; iPadOS Settings › Keyboards › Add New Keyboard (search + grouped by language). `headerSearchBarOptions` searches name, author and language. Sections: "Selected" (with drag to reorder if multi-select ever lands), "Downloaded" (swipe or context menu Delete), "Available" grouped by language with a section index on the right edge. Rows are `minHeight` 52pt: name `headline`, author or native name `callout`, trailing state (Download ↓ / spinner + % / check). A native segmented control in the header, 240pt. Content is capped at 640pt (§5.3). Delete is reachable by swipe, context menu and an Edit button (§7.2). When the picker opens from the reader, §8 makes it a trailing side panel at `expanded`+.

### Implementation notes
- Add search filtering over `allRows`. Swipe actions (`react-native-gesture-handler` Swipeable) plus a context menu (see §Action sheets: Menu). Give the delete action a full row action. **M**

---

## What's New — `/(d.settings)/whats-new`

**Files:** `app/(tabs)/(d.settings)/whats-new.tsx`, `components/changelog/ChangelogContent.tsx`
**What it is:** the full changelog for the latest version.
**Current iPad behavior:** 40pt side padding, a 270pt bottom pad, only the latest version shown. Text runs across the 720 column.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | UX | Only the latest version. You cannot browse history (the data has every entry). | `whats-new.tsx:20-21` | P2 |
| 2 | Typography | Measure longer than 75ch. `moderateScale` padding. Styles are re-created on every render (no `useMemo`). | `:17,56-80` | P2 |

### Proposed iPad design
**Reference:** App Store "Version History". The latest version is expanded at the top (title 22pt, highlights as an icon list), followed by a list of previous versions (version + date, which expand inline). Content capped at 640pt (§5.3), with prose at a 60–75ch measure (§4.2).

### Implementation notes
- Map over `changelogData`, with the first item expanded. Use `maxWidth: 640`. **S**

---

## Adhkar home — `/(a.home)/adhkar`

**Files:** `app/(tabs)/(a.home)/adhkar/index.tsx`, `_layout.tsx`, `components/AdhkarView.tsx`, `components/adhkar/AdhkarBentoCard.tsx`, `components/hero/SavedAdhkarHero.tsx`, `components/adhkar/AdhkarNowPlayingCard.tsx`
**What it is:** an optional now-playing row, a saved-adhkar hero, then a 2-column image card grid for the main categories and a second grid for "Other".
**Current iPad behavior:** **broken grid.** On 11", `columnWidth = (834 − 2·scale(16) − ms(8)) / 2 = (834 − 76 − 13.5) / 2 ≈ 372pt`. The space actually available is `720 − 76 = 644pt`, and two cards need 758pt, so `flexWrap` puts one 372×232pt card per row. The cards are left-aligned, with 272pt of empty space on the right. On 13": one 461pt card per row. The categories become a long single column of oversized photos. Labels are 22pt. A 2-line title overflows the space reserved for the label, which was budgeted for one line.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Layout | Grid width from `useWindowDimensions().width` instead of the container. Inflated `scale()` padding. Columns are hard-coded to 2. | `AdhkarView.tsx:110-127` | **P0** |
| 2 | Layout | `CARD_GAP = moderateScale(8)` at module scope, so the gap is 13.5pt between cards on iPad. | `AdhkarView.tsx:26,233` | P2 |
| 3 | Visual | The label space is budgeted for 1 line (`LABEL_OVERHEAD`) but allows `numberOfLines={2}`, so long titles overlap the next row. 5pt image radius against 12–20pt elsewhere in the app. | `AdhkarBentoCard.tsx:29-32,72,126,132` | P1 |
| 4 | Code | The `onPress` prop is accepted but ignored (navigation goes through `Link`). `AdhkarView` passes `onPress` to every card, and `onCategoryPress` in `index.tsx` is dead. | `AdhkarBentoCard.tsx:35-39,77-83`; `index.tsx:9-14` | P2 |
| 5 | Input | No hover or lift effect on cards, and no context menu ("Play all", "Share", "Open"). | `AdhkarBentoCard.tsx:85-110` | P1 |
| 6 | UX | No search across adhkar. On iPad with a keyboard, ⌘F to find a dua is expected (Hisn al-Muslim apps have one). | whole screen | P2 |
| 7 | Typography | Section title "Other" is `moderateScale(20)` = 34pt Bold. The app's other section headers use `theme.typography.subheadingSize` (18pt). | `AdhkarView.tsx:224-229` | P1 |

### Proposed iPad design
**Reference:** Apple Music "Browse" category tiles; Spotify "Browse all" grid.

- This is a browse grid, so per §5.3 it has **no width cap**: remove it from the 720 column and use the full pane inside the §5.2 page margins (24 / 32 / 40) and gutters (16 / 20 / 24).
- Columns from the **measured pane width** with the §10.1 formula `max(2, floor((paneWidth + gutter) / (minCard + gutter)))`, with `minCard` 160pt. Results: `medium` 11" portrait (834 − 88 rail − 48 margins = 698) gives **4 columns** of about 162pt. `expanded` 11" landscape (1180 − 240 − 64 = 876) gives **4**, at about 204pt each. `large` 13" landscape (1366 − 280 − 80 = 1006) gives **5**. Images keep 3:2.
- Card: image radius about 6% of its edge, clamped 8–20 (§5.4), so about 10–12pt. Title in `callout` SemiBold, max 2 lines, with space reserved for 2 lines so rows align. Section title "Other" in `title2` (§4.1). Hover: a `Color(text).alpha(0.04)` overlay (§7.2). Long-press and secondary click: context menu with Open, Play all, Share (§7.2, §8).
- Now-playing row and Saved hero: in one row at `medium`+ (`flexDirection: row`, each `flex: 1`, height 120pt) instead of stacked.

```
`medium`, iPad Pro 11" portrait (pane 746, margins 24, 4 columns)
┌──────────────────────────────────────────────────────────────┐
│ ‹  Adhkar                                         🔍          │
│ ┌────────────── Now playing ─────┐ ┌──────── Saved (12) ────┐│
│ │ ▶ Morning adhkar · 3/24        │ │ ♥ Your saved adhkar  › ││
│ └────────────────────────────────┘ └────────────────────────┘│
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                   │
│ │  img   │ │  img   │ │  img   │ │  img   │                   │
│ └────────┘ └────────┘ └────────┘ └────────┘                   │
│ Morning    Evening    Sleep      Prayer                       │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                   │
│ ...                                                           │
│ Other                                                         │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                   │
└──────────────────────────────────────────────────────────────┘
```

### Implementation notes
- Add `hooks/useContainerWidth.ts` (an `onLayout`-based width, or a `MaxWidthContainer` context that publishes its inner width). Use it in `AdhkarView` with the §10.1 column formula and the §5.2 margins and gutters. Replace `scale()`/`moderateScale` with `utils/scale.ts`. **S** (fixes the P0). Lifting the 720 cap for this browse screen (§5.3, §13 step 5) is **M**, shared with the home audit.
- Bento card: reserve space for 2 label lines, 12pt radius, hover, a `Link.Menu` context menu. Remove the dead `onPress`. **S**
- Lay out the hero row horizontally on tablet. **S**

---

## Adhkar category list — `/(a.home)/adhkar/[superId]`

**Files:** `app/(tabs)/(a.home)/adhkar/[superId]/index.tsx`, `components/adhkar/DhikrListItem.tsx`, `CategorySectionHeader.tsx`, `PlayAllButton.tsx`, `AdhkarJumpPill.tsx`
**What it is:** a list (FlatList, or SectionList for multi-category) of "manuscript" cards (number, Arabic, translation, repeat count). Header with title and current section subtitle, share, and Play All.
**Current iPad behavior:** one column of full-width cards in the 720 column, each about 300–450pt tall (Arabic `ms(18)` ≈ 30pt with a 68pt line height, padding 34pt). About 2 cards per screen. Section headers are not sticky, so the section shows only in the header subtitle. The header buttons are custom `Pressable`s with no labels.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Density | One card per row, each tall. On iPad landscape (once unlocked) or 13" this wastes space. A list for scanning should show 4–6 items or use 2 columns. | `DhikrListItem.tsx:119-127,167-195` | P1 |
| 2 | Typography | The card Arabic size is fixed at `moderateScale(18)` and ignores the user's adhkar font size setting, which the reader honors (`DhikrReader.tsx:288`). Translation is italic at 22pt. | `DhikrListItem.tsx:26-27,171-195` | P1 |
| 3 | Navigation | No sticky section headers (`stickySectionHeadersEnabled={false}`), and no section index or jump-to-section. Long multi-category lists (Hisn al-Muslim) are hard to navigate. | `[superId]/index.tsx:705-711` | P1 |
| 4 | Accessibility | The custom back button (`headerLeft`) and the share button have no `accessibilityLabel` or role (the adhkar `_layout` back button has them, this one does not). | `[superId]/index.tsx:506-518,552-558` | P1 |
| 5 | Accessibility | The `DhikrListItem` `View` has `accessibilityRole="button"` inside a `Pressable` from `Link asChild`, which gives nested focusable elements. | `DhikrListItem.tsx:49-52`; `[superId]/index.tsx:595` | P2 |
| 6 | Input | No context menu on cards (Save, Copy, Share, Play from here). These exist only inside the reader. No hover. | `[superId]/index.tsx:580-614` | P1 |
| 7 | UI | The header subtitle (current section) is centered under the title in a transparent header. On iPad the header sits inside the 720 column, so the centered title is offset from the window center. | `[superId]/index.tsx:519-546` | P2 |
| 8 | Code | `removeClippedSubviews` on the FlatList combined with the `Link.AppleZoom` transitions is known to cause blank zoom sources. Verify on iPad. | `[superId]/index.tsx:696` | P2 |

### Proposed iPad design
**Reference:** Apple Music album track list combined with Quran.com's surah list (dense rows, play state, context menu).

- **Layout by width class (§2):** `compact` and `medium` keep the single column of manuscript cards. A dhikr card is reading content, so it stays within the 680pt reading column (§4.2, §5.3). At `expanded`+, use a **2-column masonry** of the same cards (FlashList `masonry`) in the full pane, with the §5.2 gutter (20 / 24) and margins (32 / 40). Each column then stays within a readable measure. Card Arabic follows the user's adhkar font size × 0.75 (min 22pt).
- A **header hero** like Apple Music's album header, instead of only a nav title: category image 160pt, title 28pt, count and section count 15pt, buttons **▶ Play all** (filled) and **Share** (tinted) under the title. The nav bar collapses to the title on scroll.
- **Sticky section headers** (15pt SemiBold, opaque background), and a **section jump menu** in the nav bar (a `list.bullet` button that opens a menu of sections).
- The current or playing card gets a 2pt `text`-alpha-0.5 leading bar plus `PlayingBars` (as now).
- Context menu on each card: Open, Play from here, Save/Unsave, Copy, Share.
- Keyboard (§7.3): Space plays or pauses the session, ↑/↓ moves focus between cards, Return opens.

```
`expanded`+ (2-column masonry; `compact`/`medium` show one column of the same cards)
┌──────────────────────────────────────────────────────────────┐
│ ‹                                              ☰ sections  ⇪ │
│ ┌──────┐  Morning Adhkar                                     │
│ │ img  │  24 adhkar · 3 sections                             │
│ └──────┘  [ ▶ Play all ]  [ Share ]                          │
│ UPON WAKING ───────────────────────────────── (sticky)       │
│ ┌──────────── 1 ────────────┐ ┌──────────── 2 ────────────┐  │
│ │  الْحَمْدُ لِلَّهِ الَّذِي ... │ │  لا إلهَ إلاّ اللّهُ ...     │  │
│ │  Praise is to Allah ...   │ │  None has the right ...   │  │
│ │           ×1              │ │           ×10             │  │
│ └───────────────────────────┘ └───────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Implementation notes
- Make `DhikrListItem` read `useAdhkarSettingsStore` font sizes, and give it a `compact` variant. Move it to `utils/scale.ts`. **S**
- Switch to FlashList `masonry` on tablet. Add the header hero component (reuse the collection or playlist hero pattern from the home audit). Use sticky headers. **M**
- Add a11y labels to the header buttons, and remove the inner `accessibilityRole` from the card. **S**

---

## Saved adhkar — `/(a.home)/adhkar/saved`

**Files:** `app/(tabs)/(a.home)/adhkar/saved/index.tsx`
**What it is:** a flat list of saved dhikr cards with Play All and an empty state.
**Current iPad behavior:** same cards as the category list. The empty state shows an 81pt bookmark icon with 27pt and 24pt text. There is no way to unsave or reorder from the list: you must open each reader.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | UX | No edit mode, swipe-to-remove or reorder (Apple Music playlists: Edit → drag and delete). | `saved/index.tsx:300-330` | P1 |
| 2 | Data | Loading restarts when `savedIds.size` changes and fetches each dhikr one at a time (`Promise.all` of `getDhikr`). Order is the saved order, with no sort options (recent / category). | `saved/index.tsx:84-111` | P2 |
| 3 | Visual | The empty state is centered in the full height with inflated type. There is no call to action ("Browse adhkar"). | `saved/index.tsx:332-345,370-389` | P2 |
| 4 | Input | No context menu, no drag and drop (dragging a dhikr to Notes or Messages as text would be natural on iPad). | `saved/index.tsx:300-330` | P2 |

### Proposed iPad design
**Reference:** Apple Music playlist with Edit mode. Header hero ("Saved", count, ▶ Play all, Edit). The same layout as the category list: one column below `expanded`, 2-column masonry at `expanded`+. In **Edit** mode it becomes a 1-column compact list with drag handles and delete controls (`react-native-draggable-flatlist` or a FlashList drag pattern). Card context menu: Open, Remove from saved, Copy, Share. Drag a card out of the app to give plain text (Arabic + translation + reference). Empty state: 48pt icon, 20pt title, 15pt body, and a "Browse adhkar" button.

### Implementation notes
- Add an `editing` state in the header and a swipe or context-menu Unsave. Use the shared masonry. **M**

---

## Dhikr reader (layout/navigation only) — `/(a.home)/adhkar/[superId]/[dhikrId]`, `/saved/[dhikrId]`

Typography is covered by the reading team. Layout and navigation findings:

| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Layout | Pager pages and `snapToInterval` use `Dimensions.get('window').width` (module scope): 834 or 1032pt pages inside a 720pt column. Each page is 114 or 312pt wider than the viewport, so the right side is clipped and the text is off-center. `getItemLayout` offsets don't match the paging width either. | `[superId]/[dhikrId].tsx:56,68,390-391,464`; `saved/[dhikrId].tsx:42,54,312-313,386` | **P0** |
| 2 | Layout | Module-scope width will also go stale when the orientation lock is lifted. Use `onLayout` width of the pager container. | same | P0 (with rotation) |
| 3 | Navigation | `fullScreenGestureEnabled: false` is right for the pager, but iPad users also expect ←/→ arrow keys and trackpad two-finger swipes to page. Neither is wired up. | `adhkar/_layout.tsx:72-80` | P1 |
| 4 | Layout | On iPad landscape (later), the reader should become a list/detail split: the category list on the left (320pt), the reader on the right, like Apple Notes or Mail. | n/a | P2 (future) |

Fix for #1: in both screens, measure `pageWidth` via `onLayout` on `listContainer`, and pass it to `renderItem`, `getItemLayout` and `snapToInterval`. **S**

---

## What's New onboarding (modal) — root overlay

**Files:** `components/modals/WhatsNewOnboarding/index.tsx`, `OnboardingPage.tsx`, `DotIndicator.tsx`; mounted at `app/_layout.tsx:540`. **Dead:** `components/modals/WhatsNewModal.tsx` (not imported anywhere; the root imports `WhatsNewOnboarding`).
**What it is:** a centered card with a horizontal pager of feature pages, dots, Skip and Next/Get Started.
**Current iPad behavior:** `modalWidth = min(window − ms(48), ms(420))`, which is 710pt on 11" and 829pt on 13", with `maxHeight = 0.72 × windowHeight` (860pt). Titles 41–47pt, icons 95–126pt, body 25pt. A huge card in the middle of the screen. Width and height are read once at module load.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Layout | Card size scales with `moderateScale(420)`, not with the 560pt sheet cap (§5.3, §8). It ends up nearly full-width on 13". | `index.tsx:56-60,173` | P1 |
| 2 | Layout | `SCREEN_WIDTH/HEIGHT` at module scope: stale after rotation or a window resize. | `index.tsx:40` | P1 |
| 3 | Typography | Everything uses raw `moderateScale` (title 24, body 15, icons 52–64). | `OnboardingPage.tsx:26-36,110-145` | P1 |
| 4 | UI | The primary action "Next / Get Started" is plain `textSecondary` text, not a button. It has low emphasis. | `index.tsx:219-231,278-288` | P1 |
| 5 | RTL | The Skip button is positioned with `right:` instead of `end:`, so it stays top-right in Arabic. | `index.tsx:262-268` | P2 |
| 6 | Input/A11y | No ←/→ or Return keyboard handling. The dots are not an adjustable control. No `accessibilityViewIsModal`. Skip and Next have no roles. | `index.tsx:177-231` | P1 |
| 7 | Code | `WhatsNewModal.tsx` (366 lines) is dead and has a hard-coded brand color `#8dc9d6` and `console.log` noise. | `WhatsNewModal.tsx:64-95,291` | P2 |

### Proposed iPad design
**Reference:** Apple's "What's New" welcome sheet (Notes, Freeform): a centered form sheet at `medium`+ of **560pt wide** (§5.3, §8) × about 640pt, with a `display` 34pt title, a list of 3–4 feature rows (a 44pt icon + `headline` title + `body` text). It is not a pager on iPad, since there is room to show everything at once. A filled primary "Continue" button 50pt high at the bottom. On phone, keep the pager. If we keep the pager everywhere, then at `medium`+: a fixed 560pt width, §4.1 type, ←/→ keys, a filled primary button, and Skip at `end`.

```
iPad (dimmed app behind)
            ┌────────────────────── 560 ──────────────────────┐
            │                                                  │
            │              What's new in Bayaan                │
            │                                                  │
            │   ▣  Mushaf 1440       Read the classic Madani…  │
            │   ▣  iPad layout       Two pages side by side…   │
            │   ▣  Ambient sounds    Rain, waves and more…     │
            │                                                  │
            │           [            Continue            ]     │
            └──────────────────────────────────────────────────┘
```

### Implementation notes
- Branch on `widthClass !== 'compact'` (§2.2) to a `WhatsNewSheet` list layout. Use `useWindowDimensions`. Use `utils/scale.ts`. Make the button primary. Change `right` → `end`. **M**
- Delete `components/modals/WhatsNewModal.tsx`. **S**

---

## Not found — `app/+not-found.tsx`

**What it is:** an unknown deep link silently pops back to the screen underneath (`useLeaveLinkRoute`).
**Current iPad behavior:** same as phone: the link does nothing visible.

| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | UX | No feedback when a link (old widget, shared URL, Handoff) fails. The user can't tell whether the tap registered. | `app/+not-found.tsx:4-7` | P2 |

**Proposal:** keep the silent pop, and add `showToast(t('app.linkUnavailable'), undefined, 'error')` in `onLeft`. **S**

---

## Network status and toasts — `components/NetworkStatusMonitor.tsx`, `utils/toastUtils.ts`

**What it is:** connectivity and API-health transitions fire native `burnt` toasts (top-center pill on iOS). There is no persistent indicator.
**Current iPad behavior:** the native toast renders well (system-sized, top-center of the window). Being native, it does not inflate.

| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | UX | Offline is **only** a toast that disappears. After it fades there is no sign on screens that need the network (Translations download, reciter browse, reflections). Apple Music shows a persistent "You're offline. Showing downloaded music" banner in the content. | `NetworkStatusMonitor.tsx:28-53` | P1 |
| 2 | Consistency | `RandomRecitationHero` defines its own `showToast` (Android-only `ToastAndroid`), which bypasses `utils/toastUtils`. On iOS those messages are dropped. | `components/hero/RandomRecitationHero.tsx:35-39` | P1 |
| 3 | A11y | Check that burnt toasts post an `announceForAccessibility`. If not, wrap `showToast` to call `AccessibilityInfo.announceForAccessibility(title)`. | `utils/toastUtils.ts:20-27` | P2 |

**Proposal:** keep `burnt` for transient confirmations ("Saved", "Copied"), and add an inline `OfflineBanner` (36pt, `text` alpha 0.06 background, 14pt) that network-dependent screens render at the top of their content while `!isOnline`. Policy for the standards doc: **toasts confirm, banners describe state, alerts ask.** Route every toast through `utils/toastUtils.showToast`. **S/M**

---

## Action sheets — `components/sheets/*` (28 sheets) and `components/BottomSheetModal.tsx`

**Files read:** `sheets.tsx` (registry), `SurahOptionsSheet`, `PlaybackSpeedSheet`, `CreatePlaylistSheet`, `SelectReciterSheet`, `VerseActionsSheet`, `MushafLayoutSheet`, `MushafPlayerOptionsSheet`, `BottomSheetModal`. Heights were checked in all sheets with grep.
**Current iPad behavior:** every sheet is a `react-native-actions-sheet` bottom sheet mounted through a root `SheetProvider` (`app/_layout.tsx:503`). That puts it outside the tablet shell, so the sheet spans the **full window width** (834–1366pt) and covers the sidebar too. None of the 28 files checks for a tablet or sets a `maxWidth`. Each one copies the same `sheetContainer` style (top radius 20, hairline border) and uses raw `moderateScale`, so rows are 1.7–2x. Eleven sheets use a fixed height `Dimensions.get('window').height × k`, read once at module load: AdhkarLayout, CreatePlaylist (0.6), SelectPlaylist (0.75), MushafLayout (0.82), DownloadOptions, PlayerOptions, RewayatInfo, SurahOptions, UploadOptions, VerseActions (0.85), OrganizeRecitation (1.0). The Mushaf rotates, so in iPad landscape `VerseActionsSheet` (0.85 × 1194 = 1015pt) and `MushafLayoutSheet` (979pt) are **taller than the 834pt screen**. A 12-character playlist name form takes 716pt of height. Surah info HTML renders at `contentWidth = window − 72` (about 760pt or more measure) (`SurahOptionsSheet.tsx:85,332`).

`components/BottomSheetModal.tsx` (gorhom) is **not imported anywhere**: dead code.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | UI/HIG | Full-width bottom sheets on iPad. HIG says to use popovers for transient choices tied to a control, and form sheets for tasks. A bottom sheet spanning 1194pt also puts the actions far from the button that opened them (Fitts's law, pointer travel). | `app/_layout.tsx:503`; every `<ActionSheet containerStyle={styles.sheetContainer}>` | P1 |
| 2 | Layout | Fixed heights computed once from the module-scope window height. In the Mushaf in landscape they overflow the screen. | `VerseActionsSheet.tsx:133,747`; `MushafLayoutSheet.tsx:23,113`; `PlayerOptionsSheet.tsx:54,575`; `SurahOptionsSheet.tsx:59,556`; `CreatePlaylistSheet.tsx:29,188`; `OrganizeRecitationSheet.tsx:57,1010` | **P0** (Mushaf landscape) |
| 3 | Typography | Raw `moderateScale` in every sheet. `MushafPlayerOptionsSheet` aliases it as `ms` from size-matters (not `utils/scale`). | `MushafPlayerOptionsSheet.tsx:16` | P1 |
| 4 | Input | No Esc / ⌘. dismissal, no focus trap, no hover. Sheets are not reachable as context menus on long-press or right-click. | all sheets | P1 |
| 5 | Code | The `sheetContainer`/`indicator` styles are copied about 28 times, and 2 sheet libraries are installed (actions-sheet + gorhom) with one of them unused. | e.g. `PlaybackSpeedSheet.tsx:72-80`, `SurahOptionsSheet.tsx:545-553`, `VerseActionsSheet.tsx:1205-1213` | P2 |
| 6 | Reading | Surah info and Rewayat info (long prose) render in a bottom sheet with a measure of the full window width. | `SurahOptionsSheet.tsx:332`; `RewayatInfoSheet.tsx:116,125` | P1 |

### Mapping to the §8 policy

§8 sets the presentation by width class. At `compact`, everything stays a bottom sheet, with an Alert for destructive confirmations. At `medium`+: a short action list (≤ 6 items) becomes a **popover or context menu** anchored to its trigger. A settings or content panel becomes a **centered form sheet (max 560pt)**, or a **trailing side panel (360–400pt)** when it relates to what is on screen. Reading-adjacent panels use the side panel at `expanded`+. Player sub-sheets become popovers. Every sheet dismisses on a tap outside, on Esc, and with a visible close control. Mapping of the sheets in this repo:

| Sheet | Content | `medium` | `expanded`+ | Note |
|---|---|---|---|---|
| `SurahOptionsSheet` (actions) | Short action list | Context menu / popover from "…" and long-press on the row | same | Has more than 6 items today (play, queue, download, love, playlist, share, info). Trim to ≤ 6 or use submenus. |
| `SurahOptionsSheet` (About surah) | Long prose | Form sheet 560 | Form sheet 560 | Prose measure 60–75ch (§4.2) instead of `window − 72` |
| `CollectionOptions`, `PlaylistContext`, `HomeCardOptions`, `AdhkarSessionOptions`, `AdhkarCopyOptions` | Short action list | Context menu / popover | same | Same actions on secondary click (§7.2) |
| `PlaybackSpeed`, `SleepTimer`, `AmbientSounds` | Player sub-sheet | Popover anchored to the button | same | §8 player rule |
| `PlayerOptions`, `MushafPlayerOptions`, `MushafRepeatOptions`, `FollowAlong` | Player sub-sheet / panel | Popover (≤ 400pt) | Popover | `MushafPlayerOptions` has accordions: if it grows past ~70% height, use a form sheet |
| `VerseActionsSheet`, `VerseNoteSheet` | Reading-adjacent | Form sheet 560 | **Trailing side panel 360–400** | §8 reading rule. Fixes the landscape overflow (`:133`). |
| `MushafLayoutSheet` (Mushaf settings + reading theme) | Reading-adjacent settings | Form sheet 560 per §8 (proposed: popover from "Aa", see below) | **Trailing side panel** | The page stays visible as the live preview |
| `WordDetailSheet` | Small, anchored to a word | Popover anchored to the word (proposed, see below) | same | §8 has no explicit rule for word-level detail |
| `CreatePlaylist`, `SelectPlaylist`, `AddToCollection`, `SelectReciter`, `MushafReciterPicker`, `DownloadOptions`, `UploadOptions`, `AdhkarLayout`, `RewayatInfo` | Settings or content panel, text input, long list | Form sheet 560 | Form sheet 560 | Fixed `SCREEN_HEIGHT × k` heights replaced by content height capped at 0.9 × window |
| `OrganizeRecitationSheet` | Multi-step task, full height | Form sheet 560 | Form sheet 560 (proposed: allow a large form sheet, see below) | |
| Destructive confirmations (Storage, delete translation/playlist) | | Alert | Alert | §8 |

Extra rules this group relies on. They are compatible with §8 and listed under the proposed changes where they are new:
1. A sheet that **acts on an item** is also that item's context menu (long-press and secondary click, §7.2).
2. A popover must stay anchored. If the source scrolls away or the window resizes, dismiss it (§11: snap, don't animate).
3. Never size a sheet from module-scope `Dimensions` (§2.2). Height = `min(contentHeight, 0.9 × windowHeight)` from `useWindowDimensions()`.
4. When a sheet opens, initial focus goes to its first control.

### Implementation notes
- **Phase 1 (S–M, fixes the P0; §13 step 6):** add `components/sheets/AppSheet.tsx`, wrapping `ActionSheet` with the shared chrome (`lg` 20 radius, §5.4). At `medium`+ it sets `containerStyle={{maxWidth: 560, width: '100%', alignSelf: 'center', borderRadius: 20, marginBottom: insets.bottom + 16}}` (check how the library centers it), and it takes heights from `useWindowDimensions`, capped at 0.9. It adds an Esc handler and a visible close button (§8). Migrate all 28 sheets to it, and delete the per-file `sheetContainer`/`indicator` styles and the module-scope `SCREEN_HEIGHT`/`SHEET_HEIGHT`.
- **Phase 2 (M):** context menus and popovers for short lists. Expo Router's `Link.Menu`/`Link.Preview` already fits the existing `Link.AppleZoom` usage for rows. For "…" buttons, use `@react-native-menu/menu` `MenuView` (`UIMenu`): it is pinned in `package.json` `overrides` but is not a dependency, so add it. One `buildSurahActions()` source feeds both the menu and the `compact` sheet.
- **Phase 3 (M–L):** form sheets as routes. Move task sheets to Expo Router routes with `presentation: 'formSheet'` (react-native-screens `UISheetPresentationController`, which renders centered on iPad with native keyboard handling and Esc), for example `app/(modals)/create-playlist.tsx`. Cap the content at 560pt.
- **Phase 4 (L):** an anchored `Popover` primitive (measure the trigger with `measureInWindow`, portal, arrow, flip and clamp, dismiss on tap outside, Esc or resize) for player sub-sheets and word detail. Add a `TrailingPanel` primitive (360–400pt, docked at the trailing edge of the reading pane) for verse actions, notes and Mushaf settings at `expanded`+.
- Delete `components/BottomSheetModal.tsx`, and remove `@gorhom/bottom-sheet` if the player sheet doesn't use it. **S**

---

## Proposed changes to the standard

Gaps or conflicts in [ipad-standards.md](../ipad-standards.md) found while writing this audit:

1. **§4.1 / §12 conflict on `overline` alpha.** §4.1 says section headers use `textSecondary` at 0.5 alpha. §12 says alpha below 0.55 on text is for decoration only. Measured contrast at 0.5 is 3.02:1 in both base themes (12pt needs 4.5:1). Proposal: `overline` uses `textSecondary` at **≥ 0.8 alpha** (≈ 6:1). Add a §12 rule that secondary *text* never goes below 0.8 alpha: descriptions everywhere in Settings are at 0.45, which is 2.6:1.
2. **§8: popover for reading settings at `medium`.** §8 offers only a centered form sheet (or a side panel at `expanded`+) for a settings panel. For Mushaf settings ("Aa") at `medium`, a form sheet covers the page that is the live preview. Proposal: allow a **popover (360–400pt) anchored to the trigger** for reading-adjacent settings panels at `medium`, as in Apple Books.
3. **§8: word and verse detail anchored to text.** Add: small detail about a tapped word (word-by-word meaning) is a **popover anchored to the word** at `medium`+. Verse actions follow the existing side-panel rule at `expanded`+.
4. **§8: action lists longer than 6 items.** `SurahOptionsSheet` has about 7–8 actions. Proposal: at `medium`+, use a context menu with **submenus or sections** (UIMenu supports both) instead of falling back to a sheet.
5. **§8: large form sheet.** Multi-step tasks (`OrganizeRecitationSheet`) need more than 560pt. Proposal: allow a "large form sheet" of 704pt × min(860, 90% height) for multi-step or two-column tasks.
6. **§8: item actions mirror context menus.** Add the rule: every sheet that acts on an item is also reachable as that item's context menu (long-press and secondary click). This links §7.2 and §8.
7. **§7.3: add ⌘, (Settings)** to the shortcut table, the standard iPadOS shortcut for an app's settings.
8. **New §: feedback surfaces.** Toasts confirm transient actions, inline banners describe persistent state (offline, stale cache), and Alerts ask for decisions. Every toast goes through `utils/toastUtils.showToast` (one bypass exists today in `RandomRecitationHero`).
9. **§10.1: `minCard` for category tiles.** The formula names reciter/playlist cards (160) and surah tiles (120). Proposal: list adhkar category and browse-category tiles explicitly at **160pt**.
10. **§5.3: masonry for reading cards.** Dhikr cards are reading content (680pt cap) but appear in a list. Proposal: at `expanded`+, reading-card lists may use 2 columns, each within a readable measure, instead of one 680pt column.
11. **New rule: one shared list primitive.** Settings-style screens MUST use `ListSection`/`ListRow` (44pt `minHeight`, `headline` title, value on the trailing side, roles and states set), and destructive actions are red text rows, never filled primary buttons.
