# iPad and large-screen standards

These are the rules every screen in Bayaan follows on iPad and large Android tablets. They exist so the app feels like it was designed for the iPad, the way Tarteel and Quran.com feel for reading and Apple Music and Spotify feel for listening, without losing Bayaan's own quiet, monochrome look ([design-system.md](design-system.md)).

**How to read this document**

- **MUST**: a review blocker. Do not merge UI that breaks it.
- **SHOULD**: the default. Diverge only with a reason written in the PR.
- **MAY**: allowed, at your judgment.
- Rules apply to new and changed code. Existing code is migrated screen by screen; the migration status lives in [§13](#13-migration-plan).
- **Built:** a note under a rule that says what `develop` does today and which PR did it. Written on 2026-10-29 from the iPad build PRs (#425–#466) and their simulator checks. Problems found during the build that no PR has fixed yet are in [§14](#14-known-open-issues).

---

## 1. Design goals

1. **Use the space, don't stretch the phone.** A tablet screen should show more (a second pane, more columns, a larger page), not the phone layout scaled up or a narrow phone column floating in empty space.
2. **Reading is a book, listening is a music app.** Reading surfaces follow book and Mushaf conventions (Tarteel, Quran.com, Apple Books). Listening surfaces follow Apple Music and Spotify on iPad.
3. **Layout follows the window, not the device.** iPadOS windows can be any size. Decide layout from the current window width.
4. **Every input works.** Touch, Apple Pencil, trackpad or mouse, and a hardware keyboard.
5. **Same identity everywhere.** Tokens, type, color, and motion are the same on phone and tablet; only density and arrangement change.
6. **Match the phone unless the iPad needs something different.** A control looks the same on iPad as on the phone. Change it only when the iPad needs it for space (more columns, a second pane) or input (pointer, keyboard). Restyling a control for iPad alone, such as the tinted circle the first iPad player put behind play/pause, makes the two apps feel like different products. That circle was removed in #463.

---

## 2. Width classes and breakpoints

### 2.1 Classes

Layout decisions use **width classes** computed from the **window** width (`useWindowDimensions().width`), never from device model.

| Class | Window width | Typical windows |
| --- | --- | --- |
| `compact` | < 600pt | Every phone; iPad Slide Over; ⅓ Split View; narrow Stage Manager windows |
| `medium` | 600–899pt | iPad mini and 11" in portrait (744–834); ½ Split View on 13" |
| `expanded` | 900–1279pt | 11" in landscape (1180–1210); 13" in portrait (1024–1032) |
| `large` | ≥ 1280pt | 13" in landscape (1366–1376); large Stage Manager windows; external displays |

The `large` breakpoint sits at 1280 so every 11" iPad in landscape (up to 1210pt) gets the same class, and only 13" landscape and bigger windows are `large`.

Reference sizes (portrait width × height, in points): iPad mini 744×1133, iPad / iPad Air 11" 820×1180, iPad Pro 11" 834×1210, iPad Air 13" 1024×1366, iPad Pro 13" 1032×1376. iPhone Duo (measured on the Xcode 27.1 simulator): folded 466×678 (`compact`, a phone), unfolded 669×951 (`medium`, gets the tablet layouts, like an iPad mini). The largest iPhone is 440pt on its short side.

### 2.2 Rules

- **MUST** choose layout (columns, panes, sidebar style, sheet style) from the width class. `isTablet` answers "is this device an iPad", not "how wide is my window".
- **MUST** read sizes with `useWindowDimensions()` or `useResponsive()` inside components, so layout updates on rotation and resize. Never compute layout from `Dimensions.get()` at module scope.
- **MUST** use the **window** size, never the screen size. `Dimensions.get('screen')` on an unfolded iPhone Duo still reports the folded 466×678, and on iPad it ignores Split View and Stage Manager.
- **MUST** size grids, column counts, and horizontal pagers from their **measured container** (`onLayout`), never from the window. The class comes from the window; the math comes from the pane the content actually sits in, after the sidebar, split panes, and margins. Window-based math is what caused the clipping bugs found in the audits.
- **MAY** use `isTablet` for device capabilities only: hardware keyboard hints, Pencil, default font size for Quran text.
- **SHOULD** use height too where it matters: an `expanded` window shorter than 700pt (landscape 11") should not stack two tall panels vertically.
- `compact` on an iPad **MUST** render the phone layout and stay fully functional.

### 2.3 Implementation

Add the class to `useResponsive()` so there is one source:

```ts
// hooks/useResponsive.ts
export type WidthClass = 'compact' | 'medium' | 'expanded' | 'large';

export const WIDTH_BREAKPOINTS = {medium: 600, expanded: 900, large: 1280} as const;

export function getWidthClass(width: number): WidthClass {
  if (width >= WIDTH_BREAKPOINTS.large) return 'large';
  if (width >= WIDTH_BREAKPOINTS.expanded) return 'expanded';
  if (width >= WIDTH_BREAKPOINTS.medium) return 'medium';
  return 'compact';
}
// useResponsive() returns {..., widthClass, isRegularWidth: widthClass !== 'compact'}
```

`TABLET_BREAKPOINT` (shortest side of the window) stays as the device test behind `isTablet`.

**Built:**

- `TABLET_BREAKPOINT` is **600**, the start of `medium` and Android's `sw600dp` line (#448, was 700). Every iPhone and the folded Duo stay phones; the unfolded Duo and every iPad are tablets. "Phones stay pixel-identical" means every window whose short side is under 600pt.
- `widthClass` is **not** in `useResponsive()` yet. The tablet screens use the same lines through local constants instead: `pageSpacing(windowWidth)` in `utils/gridLayout.ts` for margins and gutters, and a 900pt constant per component for the `expanded` layouts (`SIDEBAR_MIN_WINDOW`, `PLAYER_EXPANDED_MIN_WIDTH`, `TWO_COLUMN_MIN_WIDTH`, `DHIKR_PAIRS_MIN_WIDTH`, `EXPANDED_MIN_WIDTH` in the browse and reciter screens, and an inline `>= 900` in `TrackItem`, `ReciterProfile` and `TabletCollectionHome`). **SHOULD** replace these with `getWidthClass()` when it lands, and **MUST NOT** add a new breakpoint value other than 600, 900 and 1280.
- Grids and shelves take their columns from the measured pane through `computeGridLayout()` and `computeShelfLayout()` in `utils/gridLayout.ts` (#428, #429). Use them rather than writing new column math.

---

## 3. Sizing and scaling

The phone UI was scaled with `react-native-size-matters`, which multiplies sizes by roughly 1.7–2× on iPad. Tablet UI must be sized in real points, with density added through layout instead.

- **MUST** import scaling helpers from `@/utils/scale`, never from `react-native-size-matters`. On tablets they scale as a 430×932 large phone in any orientation, so 15pt body text draws at about 16.7pt instead of about 30pt.
- **SHOULD NOT** use `ScaledSheet` string units (`'16@s'`, `'12@vs'`) in new code. Use `StyleSheet.create` with `moderateScale()` from `@/utils/scale`. Existing `ScaledSheet` code is fine: `@/utils/scale` exports a `ScaledSheet` with the same units.
- **MUST NOT** use `verticalScale` for font sizes, icon sizes, or hit targets. It depends on screen height, which changes with orientation.
- **SHOULD** express tablet-only dimensions (pane widths, column minimums, max widths, page margins) as plain points from the tokens below, not scaled values. Every tablet layout in #428–#445 does this.

**Built (#425):** every import now points at `@/utils/scale`, and an ESLint `no-restricted-imports` rule blocks `react-native-size-matters`. The package stays installed only because `utils/__tests__/scale.test.ts` uses it to prove phone sizes did not change (six phone sizes, 320–440pt, iOS and Android). A grid whose minimum card width was scaled gains columns on iPad, because the width is no longer doubled.

---

## 4. Typography

### 4.1 UI type ramp

One named ramp for all UI text. Phone sizes match today's most common values; tablet sizes add density through a modest step rather than scaling. Values are in points **before** Dynamic Type.

| Role | Phone | Tablet (`medium`+) | Weight | Use |
| --- | --- | --- | --- | --- |
| `display` | 28 | 34 | Bold | Hero titles (reciter profile name, surah header) |
| `title1` | 24 | 28 | Bold | Screen titles |
| `title2` | 20 | 22 | SemiBold | Section titles, card headings |
| `headline` | 17 | 17 | SemiBold | List row titles, player track title (`compact`, `medium`); the full player title uses `title2` at `expanded`+ |
| `body` | 15 | 16 | Regular | Paragraphs, descriptions |
| `callout` | 14 | 15 | Medium (SemiBold for card titles) | Secondary row text, buttons, card titles |
| `footnote` | 13 | 13 | Medium | Metadata, timestamps |
| `caption` | 11 | 12 | Medium | Badges, tiny labels |
| `overline` | 12 | 12 | SemiBold, uppercase, +0.5 letter spacing | Section headers (`textSecondary` at 0.8 alpha or more; see §12) |

Rules:

- **SHOULD** use a ramp role in new code. Add the ramp to the theme as `theme.type.<role>` returning `{fontFamily, fontSize, lineHeight}` and replace `theme.typography`, which is barely used.
- **MUST NOT** introduce a font size outside the ramp for UI chrome. Quran and translation text use the reading scale below.
- **SHOULD** set `lineHeight` at about 1.3× for titles and 1.45× for body.
- Latin UI is Manrope; Arabic UI is IBM Plex Sans Arabic. **MUST NOT** render Quranic text in a UI font.

### 4.2 Reading type

Reading text is user-sized. Tablet defaults are larger because the device is held further away and the column is wider.

| Text | Phone default | Tablet default | Line height | User range |
| --- | --- | --- | --- | --- |
| Quran (verse-by-verse list) | 26 | 32 | 2.0× minimum | 20–48 |
| Translation | 15 | 18 | 1.55× | 13–26 |
| Transliteration | 14 | 16 | 1.5×, italic | 12–22 |
| Tafsir and long-form | 16 | 18 | 1.6× | 14–26 |

- **MUST** keep reading text inside a readable column: **max 680pt** for verse-by-verse and translation views (matches `QuranView`), about 60–75 Latin characters per line for long-form.
- **MUST** size the Mushaf page to fit the available pane, not with a font size; see [§9.1](#91-mushaf).
- **MUST** keep Arabic line pitch at least **2.0× the font size** in every reading surface, the Mushaf page included, so tashkeel never collides.
- **SHOULD** persist reading sizes separately for phone and tablet, so a size chosen on iPad does not shrink the phone.

### 4.3 Dynamic Type and font scaling

- **MUST NOT** set `allowFontScaling={false}` on body, list, or reading text.
- **SHOULD** set `maxFontSizeMultiplier` on dense chrome only (tab and sidebar labels, badges, player time labels): 1.3 for chrome, 1.6 for list rows.
- **MUST** let rows grow in height with larger text. Do not give text rows fixed heights; use `minHeight`.

---

## 5. Spacing and layout grid

### 5.1 Spacing scale (4pt grid)

| Token | pt | Use |
| --- | --- | --- |
| `xxs` | 2 | Hairline nudges |
| `xs` | 4 | Icon-to-label inside a chip |
| `sm` | 8 | Between related elements |
| `md` | 12 | Inside rows and cards |
| `lg` | 16 | Card padding, phone page margin |
| `xl` | 20 | Between groups |
| `2xl` | 24 | Section spacing, tablet page margin |
| `3xl` | 32 | Large section spacing |
| `4xl` | 48 | Hero spacing |

**SHOULD** use these instead of 10, 14, 15, 6 in new code.

### 5.2 Page margins and gutters by width class

| | compact | medium | expanded | large |
| --- | --- | --- | --- | --- |
| Page margin (leading/trailing) | 16 | 24 | 32 | 40 |
| Grid gutter | 12 | 16 | 20 | 24 |
| Section spacing | 24 | 32 | 32 | 40 |

Margins are measured inside the safe area and after the sidebar. `pageSpacing(windowWidth)` in `utils/gridLayout.ts` returns the margin and gutter for `medium` and up.

- **MUST** inset list rows from the pane edge by the page margin on tablets: 24pt below 900pt, 32pt from 900pt, with a 12pt row radius for the pressed and hover fill. A row that runs into the screen edge looks unfinished, and on 11" portrait the 720pt column is as wide as the pane, so the column alone does not inset it. `TrackItem` does this since #464 (Loved, playlists, downloads); new row components follow the same numbers. Phones and compact iPad windows keep their phone insets.

### 5.3 Content width

Width caps depend on the kind of content, not one number for the whole app.

| Content | Max width | Alignment |
| --- | --- | --- |
| Reading column (verses, translation, tafsir) | 680 | Centered |
| Forms and settings lists | 640 | Centered, or leading in a split view detail pane |
| Track and surah tables | 960 | Leading-aligned with the header |
| Sheets and dialogs | 560 | Centered |
| Grids, shelves, browse, search results | No cap; add columns | Full width inside page margins |
| Player | Pane-based ([§10](#10-listening-surfaces)) | |

- **MUST NOT** wrap grids and horizontal shelves in a 720pt `MaxWidthContainer`. Give them the full width and more columns.
- **SHOULD** move the `MaxWidthContainer` from the tab stack layouts into the screens that hold reading or form content.

**Built (#428 onward):** each tab stack caps screens one at a time through `screenLayout` and `capScreensExcept` in `components/layout/MaxWidthContainer.tsx`. Grids, shelves and hero layouts take the whole pane (Home, Search/Explore, Browse all reciters, the reciter page in the Home and Search stacks, the Quran tab, Library home, Adhkar home, and Adhkar lists from 900pt). Detail and list screens stay in the 720pt column for now, including Library sub-lists and the Collection tab's reciter page, and Settings pages sit in a 640pt column. When you add a screen to a stack, decide which group it belongs in. Two branches that both edit a `capScreensExcept` list were the most common merge conflict during the build.

### 5.4 Radii

| Token | pt | Use |
| --- | --- | --- |
| `xs` | 4 | Progress bars, tiny chips |
| `sm` | 8 | Thumbnails in rows, small buttons |
| `md` | 12 | Inputs, list group containers |
| `card` | 14 | Cards (the documented card radius) |
| `lg` | 20 | Sheets, large artwork, player artwork |
| `pill` | 999 | Pills, segmented controls, circular buttons |

Artwork radius scales with artwork size: about 6% of the edge length, clamped to 8–20.

---

## 6. Navigation and app shell

The shell, home, search, collection, settings, and adhkar audits are in [ipad-audit/README.md](ipad-audit/README.md); every screen is listed in [screen-inventory.md](screen-inventory.md).

Pattern: Apple Music and Spotify on iPad use a leading sidebar with the mini player docked at the bottom, and a content area that can split into list and detail.

| Width class | Shell |
| --- | --- |
| `compact` | Phone tab bar (native tabs on iOS, floating pill on Android) and floating mini player |
| `medium` | Icon rail (88pt) with labels under icons; mini player docked at the bottom of the content area spanning its width |
| `expanded`, `large` | Labeled sidebar (240pt; 280pt at `large`) with the mini player docked in the sidebar footer |

Rules:

- **MUST** keep the sidebar on the leading edge and flip it for RTL (already done in `TabletSidebar`).
- **MUST** keep the current tab's navigation stack when the sidebar collapses or expands on resize.
- **SHOULD** use list-detail split views where the phone pushes a detail screen from a list: settings (list left, page right), collection (playlists left, contents right), and reciter browse at `expanded`+. Detail pane minimum 420pt, list pane 320–380pt.
- **SHOULD** let the user collapse the labeled sidebar to the rail (Apple Music behavior), and remember the choice.
- **MAY** show sub-sections under Collection in the labeled sidebar at `expanded`+ (Loved, Downloads, Playlists, and a group of the user's playlists), as Apple Music does. In a list-detail Collection layout, the list pane holds these categories plus playlists, not only playlists.
- **MUST** focus the search field when Search is chosen in the sidebar.
- **MUST** reserve the docked mini player's height at the bottom of every tab screen at `medium` with `useBottomInset()` (or the mini-player inset it provides). Never add fixed padding for the floating player on tablet.
- **MUST NOT** hard-code a tab route in a shared component; navigate relative to the current tab's stack so the component works under every tab.
- **MUST** keep a visible back affordance in every pushed detail screen; do not rely on the swipe-back gesture alone.
- **MUST** keep every sidebar item reachable when the window is short. On the iPad mini in landscape the labeled sidebar is taller than the window, so it scrolls and flashes its scroll indicator when the list doesn't fit (#445). Don't let a cut-off row look like the end of the list.

**Built (#440, #445):**

- The sidebar is the 88pt icon rail below 900pt and the labeled sidebar from 900pt (240pt, 280pt from 1280pt). The labeled sidebar folds to the rail and remembers the choice. It lists Collection's sections (Loved, Downloads, Bookmarks, Notes, Playlists, Reciters, Uploads) under a Collection header, Adhkar as its own item, and Settings at the bottom. Logic lives in `components/tablet/sidebarNav.ts`.
- A sidebar section opens as the first screen of its stack. Set a nested stack through the tab's params, because a nested stack's state only reaches the tab bar once it changes.
- Settings is a list-detail split from 900pt: a 340pt list with the selected page beside it, Mushaf settings first. Pages opened from inside a page (Reading theme) still push with a back button. Below 900pt, Settings pushes as on the phone but with iPad-sized rows (28pt icon tile, full-size switches).

---

## 7. Touch, pointer, keyboard

### 7.1 Targets

- **MUST** give every interactive element a hit area of at least **44×44pt** (Apple HIG). Use `hitSlop` when the visual is smaller.
- **SHOULD** use 48×48pt for primary playback controls and 64pt for the play/pause button in the full player. The 64pt is the tap target, not a visible circle: the iPad play button is the bare icon, as on the phone (#463, see goal 6).
- **MUST** space adjacent targets at least 8pt apart.

### 7.2 Pointer (trackpad and mouse)

- **SHOULD** give tappable rows, cards, and toolbar buttons a hover state with `useHover()` from `hooks/useHover.ts`: the pressed-state token at half strength (`Color(text).alpha(0.04)`). Hover shows under a pointer only, never after a tap.
- **MUST NOT** use `Pressable`'s `onHoverIn` / `onHoverOut`. They need a React Native C++ feature flag that is off. `useHover()` uses W3C pointer events (`onPointerEnter` / `onPointerLeave`), which the `bayaan-keyboard` module turns on at launch on iPad, and ignores touches. **Built:** only the sidebar items and its fold button have hover so far (#447); lists, cards and buttons elsewhere, and secondary click, are still to do.
- **SHOULD** support secondary click (right-click) wherever long-press opens a menu.
- **MUST NOT** make long-press the only path to an action. Every long-press menu item is also reachable from a visible button (a ••• button on the row or in the toolbar).
- **MUST NOT** hide functionality behind swipe-only gestures; give a visible button or menu item too (pointer users cannot swipe comfortably).

### 7.3 Hardware keyboard

Shortcuts shipped in #447 through a local Expo module, `modules/bayaan-keyboard` (`UIKeyCommand` plus the iPadOS menu bar). They need an App Store build that includes the module; older builds skip them because the JS checks the module is there before every call. The table is app-wide; a screen MAY override a key while it shows, and the reader does so as listed in [reading/04-reading-standards.md §6](reading/04-reading-standards.md).

| Keys | Action | Where | Status |
| --- | --- | --- | --- |
| Space | Play / pause | App-wide (Playback menu) | Shipped |
| ⌘ ← / ⌘ → | Previous / next track. ⌘← restarts the track when more than 3s in, as the back button does | App-wide | Shipped |
| Esc | Close the sheet on top, else the full player, else the Translations dialog | App-wide | Shipped |
| ⌘ 1–5 | Home, Surahs, Search, Adhkar, Collection (presses the sidebar item, so it behaves like a tap) | Sidebar (Go menu) | Shipped |
| ⌘ F | Open Search with the cursor in the field. Menu title "Find a Surah or Reciter" | Sidebar; reader search inside the reader | Shipped |
| ← / → | Seek 15s, matching the skip buttons | Full player | Shipped |
| ⌘ L | Toggle Follow Along | Full player | Shipped |
| Space / ⇧Space, ← / → | Next / previous page or spread; the arrows follow the Mushaf's direction, so ← is the next page | Reader (Mushaf menu) | Shipped |
| ⌥ Space | Play / pause the recitation; opens playback options when nothing is loaded | Reader | Shipped |
| ⌘D, ⌘,, ⌘+ / ⌘−, ⌘G, ⌘C, ⌘⌥1 / ⌘⌥2 | Bookmark, settings, text size, go to page, copy verse, reader view modes | Reader | Not built |

- **MUST** keep text inputs working with a hardware keyboard: Return submits search, Tab moves focus.
- **MUST** refuse keys without ⌘ (Space, arrows) while a text field is being edited, so typing a space in Search types a space. `services/keyboard/keyCommands.ts` does this for every binding.
- **MUST** register shortcuts through the layers in `services/keyboard/keyCommands.ts`. The layer added last wins a key and gives it back when it unmounts; the app-wide layer always sits underneath. The reader and the full player override the app-wide keys this way, the full player beats the reader when it is open over it, and the sidebar's Go keys are off while the reader or another full-screen page is on top.
- **MUST** give every shortcut a menu title, so it shows in the iPadOS menu bar, and make the menu item do exactly what the key does.
- **MUST** gate new keyboard UI on `keyCommandsSupported()` (iPad only). Phones and Android register nothing.
- **MUST** keep the committed `AppDelegate.swift` equal to the output of `plugins/withBayaanKeyboard.js`, so a prebuild keeps the shortcuts; a test checks this.

---

## 8. Sheets, menus, and modals

Full-width bottom sheets look like a phone app on a 13" screen.

**The iPad presentation rule** (decided 2026-10-27, built in #427, #430, #431, #433): on a tablet nothing is a full-screen modal or a full-width sheet, and nothing rises from the bottom edge. The only full-screen surfaces are the immersive ones: the full player, the Mushaf reader and the adhkar reader. Everything else is one of these:

| Kind | Use for | How it looks | Built with |
| --- | --- | --- | --- |
| **Menu** (popover) | Short action lists: surah, upload, download, player, collection, playlist, home card and adhkar options, adhkar copy, playback speed, sleep timer, ambient sounds, Add to Collection on the Collection tab | 340pt wide, 24pt from the tap that opened it so it clears the button. Opens away from the nearer side edge, below the tap if it fits and above if not, 24pt from the window edges. A tap in the middle third of the window centers the menu under it. Lighter dim than a card | `AdaptiveActionSheet` with `tabletPresentation="menu"`. The anchor is the last touch, recorded by the root view in `utils/lastTouch.ts`, so call sites pass nothing. With no recent touch it falls back to a card |
| **Card** (centered form sheet) | Forms, pickers and longer content: the default for every sheet | Centered, at most 560pt wide and 760pt tall (taller content scrolls inside), all corners rounded, no drag handle, closed by a tap outside | `AdaptiveActionSheet` (the default) |
| **Dialog card** | Screens that are routes or modals rather than sheets: Translations, the reciter filter (640pt), Mushaf search, the surah picker | Same look as a card over a dimmed screen; moves up and shrinks to stay above the keyboard | `components/layout/TabletDialog.tsx`; Translations is a `transparentModal` route on iPad |
| **Alert** | Destructive confirmations | System alert | `Alert` |

| Width class | Short action list (≤ 6 items) | Settings or content panel | Destructive confirmation |
| --- | --- | --- | --- |
| `compact` | Bottom sheet | Bottom sheet | Alert |
| `medium`+ | Menu anchored to the trigger | Centered card, max 560pt wide; or a trailing side panel (360–400pt) when the content relates to what is on screen (not built yet) | Alert |

- **MUST** import `ActionSheet` from `components/sheets/AdaptiveActionSheet`, never from `react-native-actions-sheet` directly. ESLint blocks the library's default import outside the wrapper. Phones get the library bottom sheet unchanged.
- **MUST** lay out sheet content from the sheet's width (`useSheetWidth()`), not the window's, so text such as the surah info HTML wraps inside the card.
- **MUST** keep a menu open, hidden under the sheet its item opens (Add to Collection from a menu), and close it when that sheet closes. A sheet shown from inside another one renders in that sheet's provider and closes with it.
- **MUST** switch a menu to a card when its content grows into a reading panel (the "Learn about this surah" item in the surah, upload, download and player menus).
- **MUST** cap sheet width at 560pt and center it on `medium`+ when a bottom sheet is still used.
- **SHOULD** show reading-adjacent panels (tafsir, notes, verse actions, translations picker, Mushaf settings) as a trailing side panel on `expanded`+, so the page stays visible. This is how Tarteel and Quran.com handle tafsir on wide screens.
- **SHOULD** show player sub-sheets (speed, sleep timer, ambient) as popovers anchored to their button on `medium`+.
- **SHOULD** show reading settings as a popover anchored to its button from `medium` up.
- **SHOULD** split menus with more than 6 items into sections or submenus.
- **MAY** use a large form sheet (max 704pt wide) for multi-step tasks such as creating a playlist or importing uploads.
- **SHOULD** make each item's action sheet double as that item's context menu (long-press and right-click), with the same items in the same order.
- **SHOULD** show filter panels (browse filters, search scopes) as a trailing side panel at `expanded`+ and as a form sheet at `medium`.
- **MUST** confirm bulk or irreversible deletes (delete a playlist, clear downloads, remove an upload) with an Alert. **SHOULD** use an undo toast instead of an Alert for single, reversible removals (unlove a track, remove one item from a queue or playlist).
- **MUST** dismiss with a tap outside, the Esc key, and a visible close control.

---

## 9. Reading surfaces

Benchmarks: Tarteel (iPad), Quran.com, Apple Books.

The detailed reading audit, benchmarks, designs, and reader-specific rules are in [reading/](reading/README.md); [reading/04-reading-standards.md](reading/04-reading-standards.md) extends this section and [§8](#8-sheets-menus-and-modals).

### 9.1 Mushaf

- **MUST** fit the whole page in the pane at portrait, without scrolling, preserving the page aspect ratio.
- **SHOULD** show a **two-page spread** in landscape at `expanded`+ when each page can be at least 420pt wide: the odd (lower) page on the right, the even page on the left, as in a printed Mushaf. `components/mushaf/main.tsx` already does this on iPad landscape; keep it, and gate it on width class once §2 lands. Fall back to a single centered page with generous side margins otherwise.
- **SHOULD** keep page turns as horizontal paging in Mushaf direction, with tap zones on the outer 15% of each side for pointer and Pencil users.
- **MUST** hide chrome on tap and restore it on a second tap; chrome must not cover the text while hidden.
- **SHOULD** use the page's outer margins on wide screens for the surah name, juz, and page number rather than overlay bars.
- **MUST** keep the reader's page when the layout changes under it (§11):
  - **Rotation into a spread.** A spread reports its first (odd) page as visible. Keep the current page when the visible spread contains it, so page 2 → landscape → portrait comes back to page 2, not page 1 (#466).
  - **Window resize.** Key each paged list on what it shows and its item width, never the height, so a Stage Manager resize or a switch between single pages and spreads remounts at the right offset, and the keyboard doesn't remount it (#444, `readerListKey`).
  - **List and Mushaf views.** Don't reuse the Mushaf's spread index for the list view; the list opens on the spread's first page with a matching header (#444, #447).
- **MUST** size the list and translation pages from the measured pane with the text in a centered column of at most 680pt, and give the vertical Mushaf in landscape one centered page (#444).
- **MUST NOT** let a status bar tap scroll the reader to page 1 on iPad. On the iPad mini in landscape the reader's toolbar sits close enough to the status bar that tapping its settings button triggered it (#444).

### 9.2 Verse-by-verse and translation view

- **MUST** cap the column at 680pt and center it (already in `QuranView`).
- **SHOULD** at `expanded`+, show Arabic and translation side by side (Arabic on the trailing side in LTR UI, 55/45 split) only if the user enables it; the default stays stacked, which reads better for most users.
- **SHOULD** use the free space beside the column for a persistent tafsir or notes panel ([§8](#8-sheets-menus-and-modals)) instead of leaving it empty.

### 9.3 Follow-along while listening

- **MUST** keep the active ayah highlighted and scrolled into the comfortable reading zone (top third), and stop auto-scroll when the user scrolls manually, with a "jump to current" control.

---

## 10. Listening surfaces

Benchmarks: Apple Music and Spotify on iPad. The listening audit, wireframes per width class, and implementation steps are in [listening/00-overview.md](listening/00-overview.md).

### 10.1 Browse, home, search

- **MUST** derive grid columns from available width: `columns = max(2, floor((paneWidth + gutter) / (minCard + gutter)))`, with `paneWidth` measured as in [§2.2](#22-rules). `minCard` is 160pt for reciter and playlist cards (150pt at `large`, so a 13" landscape window gets six columns as in Apple Music), 120pt for surah tiles and round avatar shelves, and 200pt for Library category tiles.
- **SHOULD** use horizontal shelves with a visible partial next card (peek) and a "See all" link, with shelf items sized from the same column math so they line up with grids below. **MAY** drop the peek and page whole columns at `expanded`+ when a pointer is present, with arrow buttons on the shelf header.
- **SHOULD** show artwork at a minimum of 140pt and up to 200pt on `large`.

**Built (#428, #429, #432, #434, #435, #437, #441, #442):**

- Home shelves fit whole cards plus 30% of the next one (5 cards on the 13", 4 on the 11", 3 on the mini), at each card's phone aspect ratio; the library and random heroes sit side by side, 2:1.
- Browse all reciters: 160pt minimum cards with 16pt gutters, a header row with the search field (up to 480pt), the filter button and a count, and filter chips that wrap instead of scrolling.
- Explore: the two Browse All tiles side by side, then the system playlists as 1.6:1 tiles with columns from the pane, in the phone's reading order.
- Search results: All / Reciters / Surahs scope chips, a top result card beside the next four surahs, a reciter shelf, and a play button on every surah row.
- Quran tab: the card grid adds phone-sized columns; the list view flows into columns at least 300pt wide (one on the mini, two on 11" and 13"), with each juz filling its own rows so the sticky headers stay. Continue listening sits beside Continue reading.
- Library home: tinted category tiles in a grid from the pane, and a shelf of the user's playlists. Adhkar home: 160pt cards, at least two columns.
- **MUST** draw a measured grid only after it has measured (#424), so it never flashes at the window's column count.

### 10.2 Reciter and playlist detail

- **SHOULD** from `medium` up, use a two-column header: artwork on the leading side (200pt at `medium`, 240–280pt at `expanded`+), with the title, metadata, and primary actions (Play, Shuffle, Download, Follow) beside it, and tracks below (capped as in [§5.3](#53-content-width)).
- **MAY** pin the header as a leading column at `large`, with the tracks scrolling beside it.
- **MUST** keep primary actions visible without scrolling.

**Built (#436):** the reciter page spans the pane. Its hero puts the round photo (240pt from 900pt, 200pt below) beside the name, with Play all, Shuffle, and round Favorite and Download buttons. Once the list is at least 720pt wide, surah rows become a table with Revelation and Verses columns under a pinned header; card mode adds columns to fit. Adhkar lists and Saved show two cards per row from 900pt, with the cards in a row sharing their height (#443).

### 10.3 Mini player

- **MUST** stay visible on every tab screen and dock as described in [§6](#6-navigation-and-app-shell); it does not float over content on tablet.
- **SHOULD** expose play/pause, next, and a progress hairline; tap opens the full player.

### 10.4 Full player

| Window | Layout |
| --- | --- |
| `medium` | Stacked: the text in a reading column (≤ 680pt) with the transport card docked at the bottom. This replaces the current portrait split, which leaves the verses only 409–459pt wide |
| `expanded`+ | Two panes: artwork and controls on the leading side, and a switchable trailing pane for Mushaf / follow-along text, queue, or reciter list (Apple Music's lyrics/queue pattern) |
| `compact` | Phone player |

- **MUST** keep transport controls in the same place across the pane switch.
- **SHOULD** use a segmented control at the top of the trailing pane to switch between Text, Queue, and Reciters, instead of separate sheets.
- **SHOULD** size the leading column at 40% of the window, clamped to 380–520pt, and the artwork at `min(column − 2 × margin, 420, windowHeight − 420)` so the controls stay on screen on iPad mini in landscape.
- **SHOULD** collapse the leading column when the user hides chrome, rather than leaving it empty.
- **MUST** keep the transport looking like the phone's: play/pause is the bare icon with a 64pt target, with no tinted circle behind it (#463).
- **MUST** show the track's ••• once, beside its title (in the Now Playing column and on the transport card), not again in the bars above.

**Built (#438, #439, #452, #463):** the layout comes from the window width, not the device or orientation.

- **Below 900pt** (iPad mini, 11" portrait, unfolded Duo): a top bar with close, the pane switcher and the reading tools; the pane at full width in the 680pt reading column; and a floating transport card (up to 680pt) at the bottom.
- **From 900pt** (13" portrait, every landscape iPad): a Now Playing column on the leading side (40% of the window, 380–520pt) with artwork, title, reciter, rewayah chip, scrubber, transport and listening tools, and a trailing pane that switches between Text, Queue and Reciters.
- Verse taps don't hide the controls on iPad, because the controls never cover the text.
- The Queue pane has Up Next with a count, Repeat and Shuffle chips (the Repeat chip names its mode), Clear (no confirmation, as in Apple Music), drag to reorder, a ••• menu and long press on each row, VoiceOver Move up / Move down actions, and played tracks behind a disclosure row that scrolls into view when opened.
- The parts are shared in `components/player/v2/tablet/` (`TabletPlayerLayout`, `PlayerParts`, `playerMetrics`). Phones keep `PlayerContent`.

---

## 11. Orientation and multitasking

- **MUST** support all four orientations on iPad and keep phones portrait-locked.
- **MUST** lock orientation only through `usePhoneOrientation()` (`hooks/usePhoneOrientation.ts`): `'portrait'` for the app root, `'free'` for a screen that may turn on phones (the Mushaf reader). It does nothing on tablets. **MUST NOT** call `ScreenOrientation.lockAsync` directly: a lock on leaving the reader used to turn an iPad held in landscape back to portrait (#446).
- **MUST** preserve scroll position, current page, and player state across rotation and window resize. The Mushaf rules for this are in [§9.1](#91-mushaf).
- **MUST** keep `UIRequiresFullScreen: false` in `app.config.js`, matching `ios/Bayaan/Info.plist`, so a prebuild does not turn multitasking off (#446). Apple deprecated the key in iPadOS 26 and plans to ignore it, so every layout must work at any window width anyway. iPadOS ignores orientation locks while multitasking is on, which is why iPads already turned freely before #446.
- **MUST** handle `isTablet` changing while the app runs. Folding or unfolding an iPhone Duo resizes the window and swaps phone and tablet layouts; the selected tab survives the swap (checked on the Duo simulator). Code that decides something once at launch (scaling, orientation locks, key commands gated on `Platform.isPad`) breaks there.
- **MUST** test each screen at `compact` width on an iPad (⅓ Split View or a narrow Stage Manager window) once multitasking is enabled.
- **MUST NOT** animate layout changes on resize; snap to the new layout.

---

## 12. Accessibility

- **MUST** give every icon-only button an `accessibilityLabel` (via `t()`) and an `accessibilityRole`.
- **MUST** meet WCAG AA contrast: 4.5:1 for text under 18pt, 3:1 for large text and icons. Secondary text (metadata, section headers, inactive labels) **MUST** use at least 0.8 alpha of `text` or `textSecondary`; the old 0.5 section-header token measures about 3:1 and fails. Lower alphas are for decoration only (borders, fills, dividers).
- **MUST** respect Reduce Motion (`useReducedMotion` from Reanimated): replace the player morph and page-curl animations with fades.
- **SHOULD** group row content for VoiceOver (`accessible` on the row with a combined label) so a surah row reads as one item.
- **SHOULD** make the reading order match visual order in split views (leading pane first).
- **MUST** keep RTL correct: use `start`/`end` (not `left`/`right`) for margins and positions, and mirror directional icons.

---

## 13. Migration plan

Ordered by impact. Each step is its own PR and updates this table. Statuses checked against `develop` on 2026-10-29.

| # | Change | Rule | Status |
| --- | --- | --- | --- |
| 1 | Unlock iPad orientation (portrait lock only on phones) | §11 | **Done** (#446, `usePhoneOrientation`) |
| 2 | Add `widthClass` to `useResponsive()` and switch tablet branches to it | §2 | **Partly.** `TABLET_BREAKPOINT` is 600 (#448) and `pageSpacing()` covers margins, but there is no `widthClass` yet; screens use local 900pt constants ([§2.3](#23-implementation)) |
| 3 | Move scaling imports to `@/utils/scale`, shared components first (`Button`, rows, headers, sheets) | §3 | **Done** (#425): every import moved, ESLint blocks the library |
| 4 | Add `theme.type` ramp and spacing/radius tokens | §4, §5 | Not started. Tablet screens use the ramp and token values as plain numbers |
| 5 | Replace stack-level `MaxWidthContainer` with per-content widths; widen grids | §5.3, §10.1 | **Mostly done** (#428, #429, #432, #434–#437, #441–#443). Detail and list screens still use the 720pt column ([§5.3](#53-content-width)) |
| 6 | Width-capped sheets, popovers for player sub-sheets, side panels for reading | §8 | **Done except side panels** (#427, #430, #431, #433, #439): cards, menus and dialog cards. Trailing side panels for tafsir and verse actions are not built |
| 7 | Mushaf two-page spread in landscape | §9.1 | **Done**, and it keeps the page on rotate and resize (#444, #466). Gate is still `isTablet` plus landscape, not width class |
| 8 | Full player: stacked layout at `medium`, switchable trailing pane at `expanded`+ | §10.4 | **Done** (#438, #439, #452, #463) |
| 9 | Remove `UIRequiresFullScreen`; verify compact iPad windows | §11 | **Config done** (#446, set to `false`). Compact iPad windows (Slide Over, ⅓ Split View) not yet checked screen by screen |
| 10 | Hover states, secondary click, keyboard shortcuts | §7 | **Partly** (#447): shortcuts shipped (need a new App Store build); hover on the sidebar only; no secondary click |
| 11 | Accessibility pass: labels, contrast, reduce motion | §12 | **Partly** (#408, #412, #413, #415): player, reader and surah row labels. Contrast and reduce motion not started |
| 12 | Settings list-detail split and iPad rows | §6 | **Done** (#440) |
| 13 | Collection sections in the sidebar; foldable sidebar | §6 | **Done** (#445) |
| 14 | Unfolded iPhone Duo gets the tablet layouts | §2 | **Done** (#448). Duo rotation in the reader is draft #449, waiting for a real device |
| 15 | Reader fixes: Translations returns to the reader; Similar Verses reachable in landscape | §8, §9 | In review (draft #453) |

Screen-level audits and proposals live in [README.md → Audits and proposals](README.md#audits-and-proposals).

---

## 14. Known open issues

Problems found on the simulators during the build (2026-10-27 to 2026-10-29) that no merged PR fixes yet. Fix them in their own PRs and move each one to §13 or delete it when it lands.

| Area | Issue | Devices |
| --- | --- | --- |
| Reader | Translations opened from the Mushaf returns to the wrong place, and the landscape verse card has no Similar Verses row | iPad (draft #453) |
| Reader | Mushaf rotation on an unfolded iPhone Duo; the simulator can't rotate the Duo, so it needs a real device | Duo (draft #449) |
| Quran tab | No search field with Surah / Juz scopes yet; hover play on tiles waits for wider pointer work | iPad |
| Queue | Restoring a persisted queue can lose the played history: a 114-track queue three tracks in came back as 113 tracks with tracks 1–3 moved to the end, and no Played row | iPad, probably phones too |
| Browse | With the Asim chip on, the student chip row shows a stray italic "A'n" and a gap | All |
| Navigation | Choosing a reciter from the Surahs tab lands on Home after it plays, because `(b.surahs)/index.tsx` pushes a Home-stack route (breaks §6 "don't hard-code a tab route") | All |
| Accessibility | The dhikr reader's heading reads "[superId]/[dhikrId]" in VoiceOver, and its share icon has no label | All |
| Reader | Right after the reader turns to landscape on iPhone, the first page is blank until one swipe | iPhone |
| Reader | Sticky juz headers slide under the status bar on iOS 26. Left alone because phones must stay identical | iPhone |
| Sizing | `utils/scale.ts` reads the window once at launch, so sizes don't update when an iPhone Duo folds or unfolds | Duo |
