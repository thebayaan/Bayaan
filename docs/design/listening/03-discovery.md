# Discovery (Home, Search, Browse, pickers)

How people find something to listen to: the Home shelves, the Search /
Explore tab, the two "Browse all" screens, the Surahs tab when used to start
audio, and the reciter / surah pickers that sit between a tap and playback.

Audit baseline: `develop` as of 2026-10-26. Shell-level problems (orientation
lock, `UIRequiresFullScreen`, size-matters inflation, the single 720pt cap,
width classes, the type ramp) live in [01-foundations.md](01-foundations.md)
and are referenced here as **F-xx**. Tokens, width classes, type roles and the
grid formula come from [ipad-standards.md](../ipad-standards.md) and are not
redefined here. Everything below assumes those
foundations land first; the landscape and Split View layouts are designed now
even though F-01 / F-02 make them unreachable today.

Scale factors used for the numbers in this document. `react-native-size-matters`
scales from the **short side** of the screen at module load, so a
`moderateScale(x)` value is the same in portrait and landscape:

| Device | Short side | `moderateScale` multiplier | `scale` multiplier |
|--------|-----------|-----------------------------|--------------------|
| iPhone 15 | 393 | 1.06x | 1.12x |
| iPad mini | 744 | 1.56x | 2.13x |
| iPad 11" | 834 | 1.69x | 2.38x |
| iPad 13" | 1032 | 1.97x | 2.95x |

---

## Screens covered

| Screen | Route | Files |
|--------|-------|-------|
| Home (Listen) | `app/(tabs)/(a.home)/index.tsx` | `components/RecitersView.tsx`, `components/hero/RecitersHero.tsx`, `HeroSection.tsx`, `BrowseAllHero.tsx`, `RandomRecitationHero.tsx`, `components/cards/{RecentReciterCard,CircularReciterCard,PlaylistCard,RewayatCard}.tsx`, `cards/recentCardStyles.ts`, `components/browse/BrowseReciterCard.tsx`, `components/adhkar/AdhkarBentoCard.tsx` |
| Search / Explore | `app/(tabs)/(b.search)/index.tsx` | `components/search/SearchView.tsx`, `components/search/ExploreView.tsx`, `components/ReciterItem.tsx`, `components/SurahItem.tsx`, `data/systemPlaylists.ts` |
| Browse all reciters | `(a.home)/browse-all.tsx`, `(b.search)/browse-all.tsx`, `*/reciter/browse.tsx` | `components/browse/BrowseReciters.tsx`, `BrowseGrid.tsx`, `BrowseReciterCard.tsx`, `FilterModal.tsx`, `components/SearchInput.tsx`, `components/Header.tsx` |
| Browse all surahs | `(a.home)/browse-all-surahs.tsx`, `(b.search)/browse-all-surahs.tsx` | `components/browse/BrowseSurahs.tsx`, `components/cards/SurahCard.tsx`, `SurahItem.tsx` |
| System playlist | `(b.search)/system-playlist/[id].tsx` | `components/system-playlist/SystemPlaylistDetail.tsx` (entry only; detail screen is covered by the collection doc) |
| Surahs tab (audio entry) | `app/(tabs)/(b.surahs)/index.tsx` | `components/SurahsView.tsx`, `SurahCard.tsx`, `SurahItem.tsx` |
| Pickers / sheets | `SheetManager.show('select-reciter' / 'home-card-options' / ...)` | `components/sheets/SelectReciterSheet.tsx`, `components/reciter-picker/ReciterPickerSheet.tsx`, `components/sheets/SurahOptionsSheet.tsx`, `components/sheets/DownloadOptionsSheet.tsx` |
| Stack shells | `(a.home)/_layout.tsx`, `(b.search)/_layout.tsx`, `(b.surahs)/_layout.tsx` | `components/layout/MaxWidthContainer.tsx` |

Unused files found in scope (no importers): `components/hero/ScrollingReciters.tsx`
(534 lines), `components/hero/BrowseAllReciters.tsx`, `components/SearchBar.tsx`,
`components/ScreenHeader.tsx`, `components/browse/CategoryScreen.tsx`,
`components/RecentActivityCard.tsx` (empty), `app/(tabs)/(a.home)/_styles.ts`,
`app/(tabs)/(b.search)/_styles.ts`.

---

## Current state

- **Home** is one vertical `ScrollView` (`RecitersView.tsx:772`) holding a hero
  block (an animated "Browse all" mosaic card plus a "Random recitation"
  ribbon) and up to 12 horizontal `FlatList` shelves configured by
  `branding.homeRowConfig`. Every card size is `moderateScale(n)` from
  size-matters, so on iPad cards grow ~1.7-2x and each shelf still shows about
  three items, exactly like the phone.
- **Search** is a native `Stack.SearchBar` (glass) or custom field (non-glass)
  over two cross-faded layers: `ExploreView` (a fixed two-column bento of 14
  tiles) and a single-column results list mixing reciters and surahs.
- **Browse all reciters** is a search field, a horizontal chip bar (qira'at
  teachers / students), a filter modal and a `LegendList` grid whose column
  count and card width are computed from the **window** width.
- **Browse all surahs** and the **Surahs tab** offer a card grid fixed at two
  columns and a list with Juz headers.
- **Pickers** are `react-native-actions-sheet` bottom sheets, full window
  width, 85% of the launch-time window height.
- The whole tab stack is wrapped in `MaxWidthContainer` at the default 720pt
  (`MaxWidthContainer.tsx:30`), so on a 13" in landscape the discovery UI is a
  720pt strip with ~208pt of empty background on each side (F-08).
- There is no hover, no keyboard command, no context menu, no
  `accessibilityRole="header"`, and no Reduce Motion handling in any of these
  files.

---

## Weaknesses

### Typography

**D-01 · High · Discovery text is inflated by size-matters and has no
hierarchy on iPad.** Every text style in scope uses size-matters
`moderateScale`, so on an 11" iPad section titles are 30pt
(`RecitersView.tsx:825-828`, `moderateScale(18)`), reciter-card names 18.6pt
(`BrowseReciterCard.tsx:56-63`), Explore tile titles 23.7pt
(`ExploreView.tsx:148`), search-result names 23.7pt (`ReciterItem.tsx:134-139`),
surah row titles 22pt (`SurahItem.tsx:357-361`). The result reads like a phone
screenshot zoomed to 170%; there is no large title and section headers are
only ~1.6x body, compared with Apple Music's 34 / 22 / 17 / 13 ramp. Fixed by
the [§4.1](../ipad-standards.md#41-ui-type-ramp) ramp plus the per-element
mapping in "Proposed design".

**D-02 · Med · Sub-minimum text on phones, oversized on iPad.** Several
labels sit below Apple's 11pt floor on phones and become oddly large on iPad:
`recentCardStyles.ts:86` (`moderateScale(7.5)`), `PlaylistCard.tsx:88` (8.5),
`CircularReciterCard.tsx:100` (8.5), `BrowseAllHero.tsx:345` and
`RandomRecitationHero.tsx:169` (9, uppercase), `BrowseReciterCard.tsx:65` (9),
`RewayatCard.tsx:127` (9), `SurahItem.tsx:395` (9), `SearchView.tsx:592`
(10.5, uppercase "RECENT SEARCHES"). `caption` (11 phone / 12 tablet) is the
minimum ([§4.1](../ipad-standards.md#41-ui-type-ramp)).

**D-03 · Med · No Dynamic Type, and fixed boxes would clip it.** No
`allowFontScaling` / `maxFontSizeMultiplier` policy anywhere in scope (F-07),
and text lives in fixed-size containers: card heights are set explicitly
(`RecitersView.tsx:290-331`, `BrowseGrid.tsx:99`), name lines are
`numberOfLines={1}` (`BrowseReciterCard.tsx:124`), and the Explore tiles are a
fixed `ROW_HEIGHT_UNIT` (`ExploreView.tsx:27`, `:315`). With accessibility
sizes, titles truncate to a few characters.

**D-04 · Low · Mixed unit systems inside one component.**
`CircularReciterCard.tsx:56-60` uses raw sizes (64pt avatar) while its labels
and padding use `moderateScale` (`:69`, `:94`), so on iPad the avatar stays
64pt but the name is 17.7pt in a 74pt-wide box and truncates after ~5
characters. `ExploreView.tsx:306` uses size-matters `scale()` (2.38x) for
padding, giving 38pt / 47pt gutters on 11" / 13".

### Visual

**D-05 · High · Phone-density shelves.** Shelf cards are
`moderateScale(120x140)` / `(140x160)` / `(130x110)` / `(110x110)` / `(140x100)`
(`RecitersView.tsx:290-331`, `:804-805`) and recent cards
`moderateScale(120)` (`recentCardStyles.ts:8`). On an 11" iPad that is
203x237pt cards; inside the 720pt column a shelf shows ~3.2 items, on 13"
landscape ~2.7. The phone shows ~2.8. Apple Music on iPad shows 5-6 items per
shelf in portrait and 7-8 in landscape; Spotify about the same. The iPad
gives no more content than the phone, only bigger pictures.

**D-06 · Med · Hero block is a 254pt-tall banner on iPad.**
`BrowseAllHero.tsx:68` (`CARD_HEIGHT = moderateScale(150)`) and
`RandomRecitationHero.tsx:46-47,114` stack vertically (`HeroSection.tsx:22-29`)
and together take ~400pt before the first shelf on an 11", while both are
navigation affordances, not content. In landscape (once F-01 is fixed) the
first shelf would start at ~50% of the screen height.

**D-07 · Med · Explore tiles lose their color on iOS 26.** System playlists
carry a `backgroundColor` (`data/systemPlaylists.ts`), but the glass path
renders every tile as the same neutral `GlassView` and ignores it
(`ExploreView.tsx:189-205`); color only survives as a 1.5pt border in the
non-glass fallback (`:208-226`). Fourteen identical grey slabs with no imagery
give the Explore grid nothing to scan. Spotify and Apple Music category tiles
are identified by color and artwork first, text second.

**D-08 · Med · Search results are phone list rows stretched across 720pt.**
`ReciterItem.tsx:116-129` gives 84pt avatars and ~110pt rows on 11";
`SurahItem.tsx:332-334` makes the options column 20% of the row (up to 118pt).
Reciters and surahs are interleaved in one list with no section headers
(`SearchView.tsx:345-365`), so a result like "Yasin" shows surah rows and
reciter rows with different shapes in arbitrary order.

**D-09 · Low · Low-contrast secondary text.** "Clear", "See more", chip
labels and counts use `textSecondary` at 50% alpha (`RecitersView.tsx:387`,
`:664`, `BrowseReciters.tsx:789`, `:805`); empty-state copy uses 35% and 20%
(`SearchView.tsx:486-500`, `:538-554`). In dark mode `#B0B0B0` at 50% over
`#050b10` is roughly 2.9:1, and at 20% roughly 1.5:1, below WCAG AA (4.5:1).

### Layout

**D-10 · High · Browse grid overflows its container on every iPad.**
`BrowseGrid.tsx:74-105` computes columns and card width from
`useWindowDimensions().width`, not from the space the grid actually has (the
window minus the sidebar, capped at 720pt). It also subtracts
`moderateScale(16)` for padding (`:95`) while the container pads
`moderateScale(10)` on each side (`:36`). Worked numbers, portrait:

| Device | Window | Columns | Card width | Row width | Space available | Overflow |
|--------|--------|---------|-----------|-----------|-----------------|----------|
| iPad mini | 744 | 3 | 229 | 719 | 625 | 94pt |
| iPad 11" | 834 | 4 | 189 | 756 | 686 | 70pt |
| iPad 13" | 1032 | 4 | 235 | 941 | 681 | 260pt |

The right-hand column is cut off or pushed off-screen. `ExploreView.tsx:284-302`
already solved this with `onLayout`; `BrowseGrid` did not. The same
window-width assumption appears in the sheets' `RenderHtml` `contentWidth`
(`SurahOptionsSheet.tsx:332`, `DownloadOptionsSheet.tsx:212`).

**D-11 · High · Fixed column counts that never reflow.** Explore is a
hard-coded two-column masonry with each tile's column assigned in data
(`ExploreView.tsx:105-121`, `:413-420`). The surah card grid is two columns in
both places (`BrowseSurahs.tsx:549`, `:137` `width: '48%'`;
`SurahsView.tsx:37-46` pairs surahs, `:359` `'48%'`). Shelves are always
horizontal `FlatList`s (`RecitersView.tsx:135`). On a 13" landscape window
these produce two 340pt-wide surah cards per row, or a two-column Explore grid
of 14 tiles in a 720pt strip.

**D-12 · Med · 720pt cap leaves 30-40% of a large iPad empty.** All three
stack layouts wrap in the default `MaxWidthContainer`
(`(a.home)/_layout.tsx:16`, `(b.search)/_layout.tsx:23`,
`(b.surahs)/_layout.tsx:6`). On 13" landscape (1376pt, 240pt sidebar) the
content is 720 of 1136pt; grids and shelves are exactly what should use the
full width (F-08). The cap is right for reading text, wrong for discovery.

**D-13 · Med · Shelf `getItemLayout` lies about item sizes.**
`RecitersView.tsx:149-179` hard-codes lengths of 80 / 200 / 140 / 130 / 120pt
while the rendered items are `moderateScale` widths plus an 8pt-scaled gap
(203 + 13.5 = 216.5pt for a default card on 11"; 135.5pt on iPhone). Combined
with `removeClippedSubviews` (`:145`) and `windowSize={3}` (`:147`), fast
scrolling in a wide window shows blank slots, and any `scrollToIndex` lands on
the wrong card.

**D-14 · Med · Sheets are phone-width and launch-height.**
`ReciterPickerSheet.tsx:189,198`, `SurahOptionsSheet.tsx:59,556`,
`DownloadOptionsSheet.tsx:35,362` fix height to 85% of
`Dimensions.get('window').height` read once at module load (wrong after
rotation or any multitasking resize) and span the full window width. "About
this surah" text in `SurahOptionsSheet` runs 1,100pt-long lines on a 13"
landscape. `FilterModal.tsx:310-313` is a transparent full-screen slide-up
`Modal` (F-09).

**D-15 · Low · Split View / Stage Manager will break the widths.** Once
F-02 is lifted: `isTablet` stays true in a 320pt Slide Over window, so
`ExploreView.tsx:282-302` takes the tablet path and `MaxWidthContainer`
still wraps; `BrowseGrid` enforces `Math.max(3, ...)` columns (`:80`), so a
1/3 split (~320pt) gets three ~85pt cards with 18pt names; size-matters values
stay at full-iPad scale in a 320pt window (an 84pt avatar, 30pt section
titles). The hero mosaic (`BrowseAllHero.tsx:246`) always renders 20 animated
columns regardless of width.

### Interaction

**D-16 · High · "Pick a reciter for this surah" opens the profile instead
of playing.** `BrowseReciters.handleReciterPress` plays the surah and pops when
`surahId` is set (`BrowseReciters.tsx:472-490`), and it is passed to the grid
(`:703-705`). But `BrowseReciterCard` never wires its `onPress` prop: it wraps
the `Pressable` in a `<Link>` to the reciter profile (`BrowseReciterCard.tsx:141-172`).
So the "browse all" branch of the default-reciter setting
(`BrowseSurahs.tsx:292-303`, `SearchView.tsx:305-317`) navigates to a profile,
and the rewayah preference write at `BrowseReciters.tsx:466-469` never runs.
Affects phone too.

**D-17 · Med · Discovery links jump across tabs.** Cards hard-code
`/(tabs)/(a.home)/reciter/[id]` (`BrowseReciterCard.tsx:141-144`,
`CircularReciterCard.tsx:192-196`, `RecentReciterCard.tsx:298-302`,
`BrowseReciters.tsx:496`). Opening a reciter from Search > Browse all switches
the sidebar selection to Home and pushes onto the Home stack; Back then
returns to Home, not to the grid the user came from. On iPad, where the
sidebar shows the selected section at all times, this is very visible.

**D-18 · Med · Playing a surah is hidden behind long press.** In the Surahs
tab and in search results a tap opens the Mushaf (`(b.surahs)/index.tsx:21-29`,
`SearchView.tsx:282-286`) and audio is on long press only
(`(b.surahs)/index.tsx:32-`, `SearchView.tsx:292-343`). There is no visible
play affordance, no hint, and with a trackpad "long press" means click-and-hold
(right click does nothing). In `SearchView.tsx:318-323` the `useDefault`
branch pushes `/player` without queueing the surah, unlike the same branch in
`BrowseSurahs.tsx:304-310` which calls `playWithReciter`.

**D-19 · Med · Long press opens bottom sheets, not context menus.** Card
options (`RecentReciterCard.tsx:226-238` -> `home-card-options`), surah options
and reciter options all use full-width action sheets. On iPad these should be
native context menus with a preview, reachable by long press and secondary
click (F-12). `react-native-ios-context-menu` is already a dependency.

**D-20 · Med · No pointer affordances.** No `onHoverIn/Out` on any card, row,
chip or hero in scope; shelves cannot be paged with a trackpad except by
two-finger horizontal scroll, which most mouse users don't have. Apple Music
shows "<  >" paging buttons on shelf headers on hover (F-10).

**D-21 · Med · No keyboard path into search.** Nothing registers Cmd+F; the
Search tab's field mounts only after focus (`(b.search)/index.tsx:41-47`) and
Browse screens have their own fields (`BrowseReciters.tsx:569`,
`BrowseSurahs.tsx:490`). Return in results does nothing useful (no "open first
result"), and arrow keys cannot move through results (F-11).

**D-22 · Low · Missing "See all" on most shelves.** Only the adhkar shelf has
"See more" (`RecitersView.tsx:657-671`). Featured, Tajweed, Memorization,
Follow-along and Exclusives shelves are capped at 8-10 items
(`RecitersView.tsx:513-532`) with no way to see the rest; the Apple Music /
Spotify pattern is a tappable section title with a chevron that opens a grid.

**D-23 · Low · Whole-screen `TouchableWithoutFeedback`.**
`BrowseReciters.tsx:547` wraps the entire screen to dismiss the keyboard. It
swallows the first tap after typing, interferes with pointer hover routing, and
is redundant with `keyboardShouldPersistTaps` / `onScrollBeginDrag` already on
the grid (`:707-708`).

**D-24 · Low · Random recitation gives no feedback on iOS.** `showToast` is
Android-only (`RandomRecitationHero.tsx:35-39`); on iPad the card does a
haptic (iPads have no Taptic Engine) and then nothing visible until audio
starts.

### Accessibility

**D-25 · High · Cards and heroes have no roles or labels.** None of
`BrowseReciterCard`, `CircularReciterCard`, `RecentReciterCard`,
`PlaylistCard`, `RewayatCard`, `BrowseAllHero`, `RandomRecitationHero` or
`ExploreView` tiles sets `accessibilityRole`, `accessibilityLabel` or
`accessibilityHint` (grep finds zero in those files). `RecentReciterCard`
exposes two separate focus targets per card (image -> profile at `:298-323`,
bottom zone -> resume at `:333-345`), and the image target has no text at all.
`SearchInput.tsx:125-130` clear button and `BrowseReciters.tsx:589-600` filter
button are icon-only and unlabeled.

**D-26 · Med · No headings for VoiceOver rotor.** Shelf titles
(`RecitersView.tsx:378-380`, `:654-656`), search section titles
(`SearchView.tsx:433-443`) and Juz headers (`BrowseSurahs.tsx:369-384`) are
plain `Text`. VoiceOver users cannot jump shelf to shelf, which on a 12-shelf
Home is the main way to navigate.

**D-27 · Med · Animations ignore Reduce Motion.** `BrowseAllHero.tsx:154-166`
runs 20 infinite `withRepeat` column animations; chips animate with
`FadeIn/FadeOut/LinearTransition` (`BrowseReciters.tsx:612-616`); cards use
press springs. None check `useReducedMotion()` (only `AdhkarSessionCard` does).

### Platform integration

**D-28 · Med · Search is not wired to the system search model.** The search
tab uses `placement="automatic"` (`(b.search)/index.tsx:60-79`) and
`hideNavigationBar`; on iPad there is no scope bar (All / Reciters / Surahs),
no search suggestions/tokens, and no Spotlight / `NSUserActivity` donation for
reciters or surahs, so "Mishary" in Spotlight never opens the app. Apple Music
indexes artists and offers scopes ("Apple Music / Your Library").

**D-29 · Low · No drag and drop.** Reciter, surah and playlist cards cannot be
dragged (into a playlist, to another app as a share link, or into Notes).
iPad users expect at least "drag a surah onto a playlist".

**D-30 · Low · No large title or screen identity on Home.** Home hides the
header (`(a.home)/index.tsx:10-12`) and has no title, so with the sidebar
showing "Home" there is no matching heading in content. Apple Music and
Spotify both start the page with a large title.

---

## Benchmark notes

- **Apple Music, iPad (iPadOS 18/26).** Sidebar navigation; Home / Listen Now
  starts with a 34pt large title, then a "Top Picks" row of large cards (about
  2.5 visible in portrait, 3.5 in landscape) and regular shelves whose
  item count grows with width (5 visible on 11" portrait, 7 on 13" landscape)
  with no partial "peek". Section titles are tappable with a chevron. On hover
  the shelf header shows paging arrows. Browse grids reflow 2 -> 6 columns.
  Long press / right click opens a context menu with a preview.
- **Spotify, iPad.** "Your Library" can be a persistent left panel; Home is
  shelves of square art; Search opens on a "Browse all" grid of colored
  category tiles with tilted artwork that reflows 2 -> 3 -> 4 -> 6 columns.
  Results are sectioned: a large "Top result" card beside a short "Songs"
  list, then shelves per entity type (Artists as circles, Albums as squares).
- **Tarteel / Quran.com (listening side).** Reciter lists use circular
  portraits with 1-2 line names; surah lists show number, name, Arabic glyph,
  verse count, and an explicit play button per row.
- **Apple HIG (iPad).** Use the full width with adaptive columns; keep 44pt
  targets; support pointer hover, context menus, keyboard shortcuts with
  discoverability titles; prefer popovers/form sheets to full-width sheets;
  respect Dynamic Type and Reduce Motion.

---

## Proposed design

### Shared rules for all discovery screens

These apply the project standard; they do not redefine it. Width classes,
margins, gutters, type roles, content widths and the column formula come from
[ipad-standards.md](../ipad-standards.md):
[§2.1 width classes](../ipad-standards.md#21-classes),
[§4.1 type ramp](../ipad-standards.md#41-ui-type-ramp),
[§5.2 margins and gutters](../ipad-standards.md#52-page-margins-and-gutters-by-width-class),
[§5.3 content width](../ipad-standards.md#53-content-width),
[§10.1 grid columns](../ipad-standards.md#101-browse-home-search).

**Containers.** Home, Explore, Browse grids, shelves and search results take
the full pane width inside page margins, with no cap
([§5.3](../ipad-standards.md#53-content-width)). The stack-level
`MaxWidthContainer` in the three `_layout.tsx` files goes away (D-12). Sheets
are capped at 560pt; long text inside them (About this surah) uses the 680pt
reading measure.

**Sizing.** Tablet code paths use plain points from this document and the
standard's tokens, not `moderateScale`
([§3](../ipad-standards.md#3-sizing-and-scaling)). Phones keep today's values
via `utils/scale.ts`.

**Column math.** Every grid and shelf uses the
[§10.1](../ipad-standards.md#101-browse-home-search) formula on the **pane
width** (the screen's own `onLayout` width minus page margins, never the
window width):

`columns = max(2, floor((paneWidth + gutter) / (minCard + gutter)))`,
`itemWidth = (paneWidth - (columns - 1) * gutter) / columns`

with `minCard` = 160pt for reciter / playlist / recent cards and Explore
tiles, 120pt for surah tiles. A hook `useAdaptiveColumns(minCard)` returns
`{columns, itemWidth, gutter, margin}` so every screen agrees. Worked values
(sidebar widths from [§6](../ipad-standards.md#6-navigation-and-app-shell)):

| Window | Class | Sidebar | Margin / gutter | Pane | Reciter cols (160) | Surah cols (120) | Circular cols (120, proposed) |
|---|---|---|---|---|---|---|---|
| iPhone 15, Slide Over (375) | compact | none | 16 / 12 | 343 | phone shelves; grid 2 x 166 | 2 | phone |
| 13" 1/2 split (678) | medium | 88 rail | 24 / 16 | 542 | 3 x 170 | 4 | 4 |
| iPad mini portrait (744) | medium | 88 rail | 24 / 16 | 608 | 3 x 192 | 4 | 4 |
| iPad Pro 11" portrait (834) | medium | 88 rail | 24 / 16 | 698 | 4 x 162 | 5 | 5 |
| iPad 13" portrait (1032) | expanded | 240 | 32 / 20 | 728 | 4 x 167 | 5 | 5 |
| iPad 11" landscape (1194) | expanded | 240 | 32 / 20 | 890 | 5 x 162 | 6 | 6 |
| iPad 13" landscape (1376) | large | 280 | 40 / 24 | 1016 | 5 x 184 | 7 | 7 |

Shelves size their items from the same math so they line up with any grid
below them, and the next item peeks into the trailing page margin
([§10.1](../ipad-standards.md#101-browse-home-search)). Shelves snap per item
(`snapToInterval = itemWidth + gutter`, `decelerationRate="fast"`).
"Large" cards (Exclusives, hero row, top result) span 2 columns.

**Type mapping** to [§4.1](../ipad-standards.md#41-ui-type-ramp) roles
(tablet sizes shown):

| Element | Today (11") | Role |
|---|---|---|
| Screen title (Home, Search, Browse) | none / native header | `title1` 28 |
| Hero title (Browse-all and Random cards) | 23.7 | `title2` 22 |
| Shelf / section title | 30.4 | `title2` 22, tappable with chevron |
| Card title (reciter, playlist, tile) | 18.6 | `callout` 15 (SemiBold, see proposed changes), up to 2 lines |
| Card subtitle (rewayah, count) | 15.2 | `footnote` 13 |
| List row title | 22-24 | `headline` 17 |
| List row secondary | 18.6-20 | `callout` 15 |
| Hero label ("ALL RECITERS"), "Recent searches" | 15-18 | `overline` 12 |
| Badge, chip, "See all", "Clear" | 13-22 | `footnote` 13 / `caption` 12 |

Actionable text ("Clear", "See all", chip labels, result counts) uses
`textSecondary` at full alpha, not 0.5; the standard reserves alpha < 0.55
for decoration ([§12](../ipad-standards.md#12-accessibility)) (D-09).

Cards and rows use `minHeight`, never `height`; only the art has a fixed
aspect ratio (1:1 for reciter portraits), so Dynamic Type grows the text
block (D-03). Card radius `card` 14, artwork radius per
[§5.4](../ipad-standards.md#54-radii).

**Interaction kit** (reused everywhere below):

- Hover per [§7.2](../ipad-standards.md#72-pointer-trackpad-and-mouse): rows
  and cards get the pressed-state token at half strength
  (`Color(text).alpha(0.04)`); shelf headers additionally show two 28pt
  circular chevron buttons (44pt hit area) that page the shelf by one page of
  columns (D-20).
- Context menu on long press and secondary click (D-19), via one
  `<ItemContextMenu item={...}>` wrapper around `react-native-ios-context-menu`,
  phone fallback to the existing sheets. Menus per item type:
  - Reciter: Play random surah, Open, Add to favorites / Remove, Share.
  - Surah: Play (default reciter), Play with... (opens picker), Read in Mushaf,
    Download, Add to playlist, About this surah.
  - Recent item: Resume, Go to reciter, Remove from recents.
- `accessibilityRole` + a single combined label per card, e.g.
  "Mishary Alafasy, Hafs an Asim, follow-along available, button"; custom
  `accessibilityActions` mirror the context-menu actions (D-25). Section
  titles get `accessibilityRole="header"` (D-26).
- `useReducedMotion()` disables the mosaic, chip layout transitions and press
  springs (D-27).
- Navigation targets use the **current** tab's stack, via a helper
  `useTabRoute('reciter/[id]')` that resolves `/(tabs)/(<current>)/reciter/[id]`
  (D-17).

### Home (Listen)

Structure, top to bottom: `title1` screen title "Home" with the account / settings
button trailing (D-30); hero row; Continue listening; then the configured
shelves. The `branding.homeRowConfig` ordering is unchanged.

**Hero row (D-06).** On `medium`+ the two heroes sit side by side at a fixed
176pt height (200pt at `large`): `BrowseAllHero` and `RandomRecitationHero`
split the pane 1:1 at `medium` and 2:1 at `expanded`+. The
mosaic keeps its tile animation but at 12-14 columns sized to the card width,
paused under Reduce Motion and when off-screen. Random gets a visible
"Finding a recitation..." state inline in the card (spinner replaces the
label) instead of an Android-only toast (D-24).

**Shelves (D-05, D-11, D-13, D-22).** One shared `Shelf` component replaces
`MemoizedFlatList`: header row (title2, chevron, hover paging buttons,
optional trailing "Clear") and a horizontal list using `useAdaptiveColumns`.
Card kinds:

| Shelf | Card | `minCard` | Columns (mini / 11" P / 13" P / 11" L / 13" L) | Shape |
|---|---|---|---|---|
| Continue listening | `RecentReciterCard` | 160 | 3 / 4 / 4 / 5 / 5 | art 1:1, name, surah, progress bar |
| Featured, New to Quran, Tajweed, Memorization, Follow along, Collection | `BrowseReciterCard` | 160 | 3 / 4 / 4 / 5 / 5 | art 1:1 + 2-line text block |
| Playlists | `PlaylistCard` | 160 | 3 / 4 / 4 / 5 / 5 | 1:1 |
| Exclusives | `BrowseReciterCard` large | 160, span 2 | 1.5 / 2 / 2 / 2.5 / 2.5 (peeking) | art 4:3, name overlaid |
| Favorites | `CircularReciterCard` | 120 (proposed) | 4 / 5 / 5 / 6 / 7 | avatar = itemWidth - 16, name below |
| Rewayat, Adhkar | `RewayatCard`, `AdhkarBentoCard` | 160 | 3 / 4 / 4 / 5 / 5 | 16:10 |

`getItemLayout` is computed from the same `itemWidth + gutter` the hook returns.
Every reciter shelf gets "See all", which pushes the existing
`reciter/browse` route with the collection as a param (new `collection`
filter in `BrowseReciters`), so no new screen is needed.

Portrait, iPad Pro 11" (`medium`, 88pt rail, margin 24, pane 698pt, 4 x 162pt):

```
+----+------------------------------------------------------------+
|    | Home                                                 (o)   |
| [] |                                                            |
|    | +-------------------------------------+ +----------------+ |
| () | | ALL RECITERS  (mosaic)              | | RANDOM          | |
|    | | Every voice, one tap            >   | | Surprise me  >  | |
| <> | +-------------------------------------+ +----------------+ |
|    |                                                            |
|    | Continue listening  >                   [<][>]     Clear   |
|    | +-----+ +-----+ +-----+ +-----+ +-                         |
|    | | art | | art | | art | | art | |  4 x 162pt + peek       |
|    | |Name | |Name | |Name | |Name | |                          |
|    | |Surah| |Surah| |Surah| |Surah| |                          |
|    | |==---| |=----| |===--| |====-| |                          |
|    | +-----+ +-----+ +-----+ +-----+ +-                         |
|    | Featured reciters  >                                       |
|    | +-----+ +-----+ +-----+ +-----+ +-  4 x 162pt              |
|    | | art | | art | | art | | art |                            |
|    | |Name | |Name | |Name | |Name |                            |
|    | |Hafs | |Warsh| |Hafs | |Hafs |                            |
|    | +-----+ +-----+ +-----+ +-----+                            |
|[mini player in rail footer]                                     |
+----+------------------------------------------------------------+
```

Landscape, iPad 13" (`large`, 280pt sidebar, margin 40, pane 1016pt, 5 x 184pt):

```
+-------------+-------------------------------------------------------------------------+
| Bayaan      | Home                                                              (o)   |
| > Home      | +--------------------------------------------+ +----------------------+ |
|   Search    | | ALL RECITERS (mosaic)                      | | RANDOM               | |
|   Surahs    | | The full collection                    >   | | Surprise me      >   | |
|   Library   | +--------------------------------------------+ +----------------------+ |
|   Settings  | Continue listening >                                   [<][>]  Clear   |
|             | +------+ +------+ +------+ +------+ +------+ +-  5 x 184pt + peek     |
|             | | art  | | art  | | art  | | art  | | art  |                           |
|             | +------+ +------+ +------+ +------+ +------+                           |
|             | Favorites >                                                            |
|             |  (o)  (o)  (o)  (o)  (o)  (o)  (o)                7 avatars             |
|             | Featured reciters >                                     [<][>]         |
|             | +------+ +------+ +------+ +------+ +------+ +-  5 x 184pt             |
|             | | art  | | art  | | art  | | art  | | art  | |                         |
|             | +------+ +------+ +------+ +------+ +------+ +-                         |
| [docked     |                                                                         |
|  player]    |                                                                         |
+-------------+-------------------------------------------------------------------------+
```

Compact (Slide Over / 1/3 split, ~320-375pt): today's phone layout,
phone tab bar and floating mini player (F-03). Heroes stack, shelves peek.

Fixes D-01, D-02, D-05, D-06, D-13, D-20, D-22, D-24, D-25, D-26, D-27, D-30.

### Search / Explore

**Idle state: Explore grid (D-07, D-11).** Replace the two-column bento with
a reflowing grid (`useAdaptiveColumns(160)`: 2 compact, 3-5 on iPad per the
worked table).
First row: two feature tiles "All reciters" and "All surahs", each spanning
half the row, 120pt tall (96pt compact). Then the system playlists as uniform
tiles, aspect 1.6:1 (e.g. 167x104pt at 4 columns on 13" portrait). Each tile
is filled with the playlist's `backgroundColor` at 85% (glass: `GlassView`
`tintColor` set to that color), title in `headline` white, subtitle
`footnote` white 80%, and a 64pt reciter portrait or glyph tilted 20 degrees
in the trailing bottom corner (the Spotify device). `heightMultiplier` and
`column` in `data/systemPlaylists.ts` are kept only for the compact layout.
Above the grid, a "Recent searches" row of up to 6 chips when there are any.

**Typing state: sectioned results (D-08, D-21, D-28).** Under the search
field, a segmented control "All | Reciters | Surahs" (`caption` labels, 32pt
tall). In "All":

- `expanded`+: two columns. Leading: "Top result" card (the highest-ranked
  entity; 280pt tall, 120pt art, name in `title1`, type label, 52pt play
  button). Trailing: "Surahs" list, first 4 matches as 56pt rows.
- Below, full width: "Reciters" shelf of circular avatars
  (`CircularReciterCard`, circular-shelf columns), then "More surahs" as a
  2-column list of 56pt rows.
- `medium`: single column in the same order.
- Compact: today's single list, but grouped with section headers.

Rows on tablet: surah row = 44pt glyph / number, title `headline`, meaning
`callout`, trailing 44pt play button and a "more" button that opens the
surah context menu. Reciter row = 48pt avatar, name `headline`, rewayah
`callout`. Row `minHeight` 56pt; rows group their content into one
VoiceOver element. Results take the full pane width (no cap,
[§5.3](../ipad-standards.md#53-content-width)).

Tap behavior for surahs in search: tap plays with the default-reciter logic
that `BrowseSurahs` already implements (`playWithReciter`), fixing the
`/player` bug in D-18; "Read in Mushaf" is the second context-menu action and
a trailing book icon. (Product decision: the Surahs tab can keep tap = read;
see below.)

Keyboard: Cmd+F focuses the field from anywhere in the Search stack (and
switches to the Search tab from elsewhere); Down arrow moves into results;
Return opens the focused result; Esc clears. The bar keeps
`placement="automatic"` but registers `scopeButtonTitles` for the segmented
scopes where `react-native-screens` supports it, falling back to the custom
control.

Spotlight: donate an `NSUserActivity` (or `expo-spotlight`-style index) for
each reciter profile and surah opened, so system search reaches them.

Portrait, iPad 11" (results, single column):

```
+----+------------------------------------------------------------+
|    | Search                                                     |
|    | [Q  yasin                                         (x)]     |
|    | [  All  |  Reciters  |  Surahs  ]                          |
|    | Top result                                                 |
|    | +--------------------------------------------------------+ |
|    | | [glyph]  Ya-Sin  36            Surah · 83 verses  (>)  | |
|    | +--------------------------------------------------------+ |
|    | Surahs                                                     |
|    |  36  Ya-Sin           Ya Sin · Makkah       (>)  (...)     |
|    | ---------------------------------------------------------- |
|    | Reciters                                         [<][>]    |
|    |  (o)   (o)   (o)   (o)   (o)   (o)                         |
+----+------------------------------------------------------------+
```

Landscape, iPad 13" (`large`, two columns, full pane width):

```
+-------------+-----------------------------------------------------------------+
| ...sidebar  | Search                                                          |
|             | [Q  mishary                                              (x)]   |
|             | [ All | Reciters | Surahs ]                                     |
|             | Top result                     Surahs                           |
|             | +----------------------+       1  Al-Fatiha        (>) (...)    |
|             | |  (portrait 120)      |       ---------------------------      |
|             | |  Mishary Alafasy     |       18 Al-Kahf          (>) (...)    |
|             | |  Reciter      (>)    |       ---------------------------      |
|             | +----------------------+       36 Ya-Sin           (>) (...)    |
|             | Reciters                                          [<][>]       |
|             |  (o)  (o)  (o)  (o)  (o)  (o)  (o)  (o)                         |
+-------------+-----------------------------------------------------------------+
```

Idle Explore, iPad 13" landscape (5 columns):

```
| Search                                                                 |
| [Q  Reciters, surahs...                                         ]      |
| +------------------------------+ +----------------------------------+  |
| | All reciters               > | | All surahs                     > |  |
| +------------------------------+ +----------------------------------+  |
| +--------+ +--------+ +--------+ +--------+ +--------+                 |
| |Morning | |Quick   | |Heart   | |Stories | |Protect.|   colored,     |
| |   [img]| |   [img]| |   [img]| |   [img]| |   [img]|   1.6:1        |
| +--------+ +--------+ +--------+ +--------+ +--------+                 |
```

Fixes D-07, D-08, D-11, D-18 (search side), D-21, D-28, D-09 (empty-state
copy moves to `textSecondary` 100%).

### Browse all reciters (and "Choose a reciter for this surah")

- `BrowseGrid` measures its own width with `onLayout` (same pattern as
  `ExploreView.tsx:289-302`), uses `useAdaptiveColumns(160)`
  (3-5 columns on iPad, see the worked table), drops the `Math.max(3, ...)` floor (2 columns in
  compact), and uses the class gutter as the one gap value for both the math and the
  container (D-10, D-15).
- `LegendList` gets `numColumns` instead of the hand-built row arrays, so
  recycling works per item.
- `BrowseReciterCard` calls `onPress` when given and only falls back to the
  `Link` when it is not (D-16). The `Link` target comes from `useTabRoute`
  (D-17).
- Header area on tablet: one row with the search field (max 480pt),
  a filter button that opens a **popover** anchored to it (FilterModal
  content, 360pt wide, per [§8](../ipad-standards.md#8-sheets-menus-and-modals))
  instead of the slide-up modal (D-14), and the result count trailing. Chips
  stay a single horizontal row, but on `expanded`+ they wrap
  to at most two lines so the whole qira'at set is visible without scrolling.
- Remove the screen-wide `TouchableWithoutFeedback` (D-23).
- In "choose a reciter for surah X" mode (`surahId` set), the title becomes
  "Choose a reciter · Ya-Sin" and each card shows a 32pt play badge on the art
  so it is clear that a tap plays.

```
iPad Pro 11" portrait (pane 698, 4 columns of 162pt)
| < Browse all                                                 |
| [Q Search reciters               ] [=]          212 reciters |
| (All) (Nafi') (Ibn Kathir) (Abu Amr) (Ibn Amir) (Asim) ...   |
| +-----+ +-----+ +-----+ +-----+                              |
| | art | | art | | art | | art |                              |
| |Name | |Name | |Name | |Name |                              |
| +-----+ +-----+ +-----+ +-----+                              |
```

Fixes D-10, D-14 (filter), D-15, D-16, D-17, D-23.

### Browse all surahs and Surahs tab (audio entry)

- Card grid columns from `useAdaptiveColumns(120)`: 4-7 on iPad (mini 4,
  11" portrait 5, 11" landscape 6, 13" landscape 7); `SurahCard` becomes width-driven with a 1:1 aspect (today it fixes
  `moderateScale(120)` boxes, `SurahCard.tsx:209-210`). Juz headers span the
  full row.
- List mode at `expanded`+: two-column list (surahs flow down column one then
  column two within each Juz), 56pt rows, each with a trailing play button.
  This turns 114 rows into ~57 per screen-height pass on a 13" landscape.
- Only the active mode is mounted (today both `FlatList`s are mounted and one
  is hidden, `BrowseSurahs.tsx:534-578`).
- Surahs tab keeps tap = open Mushaf (it is the reading tab), but on tablet
  adds the visible trailing play button and the surah context menu, removing
  the long-press-only audio path (D-18). The same `SurahItem` prop
  (`showPlayButton`) serves the search results.

```
iPad 13" landscape, list mode
| Surahs                          [1-114 | 114-1 | Revelation]  [grid] |
| JUZ 1                                                                 |
|  1  Al-Fatiha     7 verses  (>)  (...) |  2  Al-Baqarah 286   (>) (...)|
| JUZ 30                                                                |
| 78  An-Naba      40 verses  (>)  (...) | 79  An-Nazi'at  46   (>) (...)|
```

Fixes D-11, D-18 (Surahs tab).

### Pickers and options

- `select-reciter`, `ReciterPickerSheet` and `FilterModal` present as
  centered **form sheets** on `medium`+ per
  [§8](../ipad-standards.md#8-sheets-menus-and-modals): max 560pt wide, height
  `min(620, window - 2*48)`, recomputed from `useWindowDimensions()` rather
  than module-level `Dimensions` (D-14). The reciter picker inside shows the
  search field focused, a favorites row of circular avatars, then 56pt rows.
- `SurahOptionsSheet`, `DownloadOptionsSheet` and `home-card-options` action
  lists become context menus on tablet (D-19). "About this surah" opens a
  form sheet whose `RenderHtml` `contentWidth` is the measured sheet width
  minus padding (never the window width).
- Compact widths keep every existing sheet unchanged.

### Platform extras (lower priority)

- Drag and drop (D-29): reciter and surah cards provide a drag item (deep
  link URL + title) via `react-native-draggable`-style native module or
  `expo-drag-drop` when stable; first drop target is a playlist row in the
  Library.
- Pull to refresh on Home reshuffles session-seeded shelves (`sessionSeed`,
  `RecitersView.tsx:458`), which gives the gesture a meaning.

---

## Implementation notes

Ordered, PR-sized. Steps 1-3 are bug fixes that help phones too and can ship
before the foundations work; the rest assume `widthClass` in `useResponsive()`, the `theme.type` ramp,
the spacing tokens and per-content widths
([ipad-standards.md §13](../ipad-standards.md#13-migration-plan) steps 2, 4,
5) plus F-04 (scaling).

1. **Fix reciter pick-to-play and tab-relative links** (D-16, D-17).
   `components/browse/BrowseReciterCard.tsx` (call `onPress` when provided),
   new `hooks/useTabRoute.ts`, update `CircularReciterCard.tsx`,
   `RecentReciterCard.tsx`, `BrowseReciters.tsx:496`. Test: Surahs -> long
   press -> default "browse all" -> tap reciter plays and pops.
2. **Fix `BrowseGrid` sizing** (D-10, D-15). `components/browse/BrowseGrid.tsx`:
   measure with `onLayout`, single gap constant, `numColumns` on `LegendList`,
   drop the 3-column floor. Remove `TouchableWithoutFeedback` from
   `BrowseReciters.tsx:547` (D-23).
3. **Fix search surah default-reciter path** (D-18 bug).
   `components/search/SearchView.tsx:318-323` uses `useReciterSelection().playWithReciter`
   like `BrowseSurahs.tsx:304-310`.
4. **`useAdaptiveColumns(minCard)` hook** implementing the
   [§10.1](../ipad-standards.md#101-browse-home-search) formula on a measured
   pane width, returning class margin and gutter from
   [§5.2](../ipad-standards.md#52-page-margins-and-gutters-by-width-class).
   New `hooks/useAdaptiveColumns.ts` + unit tests reproducing the worked
   table (windows 375, 678, 744, 834, 1032, 1194, 1376).
5. **`Shelf` component and Home shelves** (D-05, D-13, D-20, D-22, D-26).
   New `components/shelf/Shelf.tsx` (header, chevron, hover paging, snapping,
   computed `getItemLayout`); replace `MemoizedFlatList`/`Section` in
   `components/RecitersView.tsx`; make card components width-driven
   (`BrowseReciterCard`, `CircularReciterCard`, `RecentReciterCard` +
   `recentCardStyles.ts`, `PlaylistCard`, `RewayatCard`, `AdhkarBentoCard`).
   Add a `collection` param to `reciter/browse` for "See all".
6. **Home header and hero row** (D-06, D-24, D-27, D-30).
   `components/hero/RecitersHero.tsx`, `HeroSection.tsx`, `BrowseAllHero.tsx`
   (width-driven column count, Reduce Motion, pause off-screen),
   `RandomRecitationHero.tsx` (inline loading state). Large title in
   `RecitersView.tsx`. Switch `(a.home)/_layout.tsx` to per-screen
   content widths and drop the stack-level `MaxWidthContainer`
   ([§5.3](../ipad-standards.md#53-content-width), F-08).
7. **Explore grid** (D-07, D-11). `components/search/ExploreView.tsx`:
   reflowing grid, feature row, color + art tiles; keep the bento for compact.
   Optional art field in `data/systemPlaylists.ts`.
8. **Sectioned search results** (D-08, D-21, D-28). `SearchView.tsx`
   (sections, scopes, top result), `SurahItem.tsx` (`showPlayButton`,
   tablet row sizes), `ReciterItem.tsx` (tablet sizes), Cmd+F and arrow keys
   via the F-11 key-command module, `(b.search)/index.tsx`.
9. **Surah grids and two-column list** (D-11, D-18). `BrowseSurahs.tsx`,
   `SurahsView.tsx`, `SurahCard.tsx`; mount only the active mode.
10. **Context menus and form sheets** (D-14, D-19). New
    `components/menus/ItemContextMenu.tsx`; tablet presentation for
    `SelectReciterSheet.tsx`, `ReciterPickerSheet.tsx`, `FilterModal.tsx`
    (popover), `SurahOptionsSheet.tsx`, `DownloadOptionsSheet.tsx`
    (replace module-level `SCREEN_HEIGHT`).
11. **Accessibility pass** (D-09, D-25, D-26, D-27). Roles, combined labels,
    custom actions, header roles, contrast tokens (`textSecondary` at 100%
    for actionable text), `useReducedMotion` in chips and press springs.
    Merge `RecentReciterCard`'s two targets into one element with actions.
12. **Typography migration** (D-01-D-04) for every file in "Screens covered",
    as part of the F-04 size-matters batches: replace `moderateScale` with ramp
    tokens on tablet, raise sub-11pt labels to `caption`.
13. **Delete dead code**: `ScrollingReciters.tsx`, `BrowseAllReciters.tsx`,
    `SearchBar.tsx`, `ScreenHeader.tsx`, `browse/CategoryScreen.tsx`
    (and `browse/CategoryCard.tsx` if nothing else imports it),
    `RecentActivityCard.tsx`, both unused `_styles.ts` files.
14. **Later**: Spotlight donation (D-28), drag and drop (D-29), pull to
    refresh reshuffle.

Verification for each step: simulator screenshots at iPad mini portrait,
11" portrait and landscape, 13" portrait and landscape, and (after F-02)
Split View 1/3, 1/2, 2/3 and a 600pt Stage Manager window; VoiceOver rotor
pass over Home headings; Reduce Motion on.

---

## Proposed changes to the standard

1. **Add `minCard` = 120pt for circular avatar shelves** (Favorites, reciters
   in search results) to [§10.1](../ipad-standards.md#101-browse-home-search).
   Avatars carry no text block inside the art, so at 160pt they read too large
   next to square cards; Apple Music uses ~120-130pt artist circles.
2. **Allow a SemiBold weight on `callout` for card titles** in
   [§4.1](../ipad-standards.md#41-ui-type-ramp), or add a `cardTitle` role
   (15/20 SemiBold). `headline` (17) is too large for 160-190pt cards with
   2-line reciter names; `callout` is Medium, which is too weak against the
   `footnote` subtitle.
3. **Allow paging shelves without peek on `expanded`+ when a pointer is
   present.** [§10.1](../ipad-standards.md#101-browse-home-search) asks for a
   peek. With items aligned to the grid, the peek falls in the page margin
   (24-40pt), which works; but Apple Music on iPad pages whole columns and
   shows hover chevrons instead. Suggest: peek is the default, paging plus
   hover chevrons is a MAY.
4. **Consider `minCard` 150pt at `large`.** With 160pt, a 13" landscape
   window gets only 5 reciter columns (184pt each), the same count as an 11"
   in landscape; Apple Music shows 6-7. A slightly smaller minimum at
   `large` would add a column without dropping below the 140pt artwork floor.

