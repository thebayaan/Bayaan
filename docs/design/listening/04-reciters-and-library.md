# Reciter profile and Library

This doc audits and redesigns the reciter profile and the Library (Collection tab) listening
screens on iPad.

**Shared vocabulary.** The doc uses the terms of [ipad-standards.md](../ipad-standards.md) and
does not redefine them:

- width classes `compact` / `medium` / `expanded` / `large`
  ([§2](../ipad-standards.md#2-width-classes-and-breakpoints))
- type roles ([§4.1](../ipad-standards.md#41-ui-type-ramp))
- spacing, margins and radii ([§5](../ipad-standards.md#5-spacing-and-layout-grid))
- content widths ([§5.3](../ipad-standards.md#53-content-width))
- the shell and list-detail split ([§6](../ipad-standards.md#6-navigation-and-app-shell))
- sheets and menus ([§8](../ipad-standards.md#8-sheets-menus-and-modals))
- the grid formula ([§10.1](../ipad-standards.md#101-browse-home-search))
- the detail header ([§10.2](../ipad-standards.md#102-reciter-and-playlist-detail))

**Shell findings.** These are analysed in [`01-foundations.md`](./01-foundations.md) and only
referenced here:

- **F-01:** the iPad is portrait-locked by `ScreenOrientation.lockAsync` in `app/_layout.tsx`.
- **F-02:** `UIRequiresFullScreen` is set.
- **F-04:** size-matters scaling.
- **F-08:** a single 720pt cap.

The designs still cover landscape and multitasking, because both will be unlocked
([§11](../ipad-standards.md#11-orientation-and-multitasking)).

**Out of scope.** The reading screens in the Library (`collection/bookmarks.tsx`,
`collection/notes.tsx`) are covered elsewhere.

## Screens covered

| Screen | Route | Files |
|--------|-------|-------|
| Reciter profile | `(a.home)/reciter/[id]`, `(c.collection)/reciter/[id]` | `app/(tabs)/(a.home)/reciter/[id].tsx`, `app/(tabs)/(c.collection)/reciter/[id].tsx`, `components/reciter-profile/ReciterProfile.tsx`, `components/reciter-profile/components/*` (ReciterHeader, ActionButtons, RewayatTabBar, SurahList, SearchView, NavigationButtons, StickyHeader, UploadsTabContent, UploadCard), `components/reciter-profile/styles/index.ts`, `components/SurahItem.tsx`, `components/cards/SurahCard.tsx` |
| Surah-by-reciter deep link | `app/reciter/[slug]/[surah].tsx` | Same file. It has no UI: it builds a track, starts playback and `router.replace`s to Home |
| Library home | `(c.collection)/index` | `app/(tabs)/(c.collection)/index.tsx`, `app/(tabs)/(c.collection)/_layout.tsx` |
| Playlists | `collection/playlists` | `app/(tabs)/(c.collection)/collection/playlists.tsx`, `components/PlaylistItem.tsx` |
| Playlist detail | `playlist/[id]` (Home and Library stacks) | `app/(tabs)/(c.collection)/playlist/[id].tsx`, `components/playlist-detail/PlaylistDetail.tsx`, `PlaylistHeader.tsx` |
| Loved | `collection/loved` | `app/(tabs)/(c.collection)/collection/loved.tsx`, `components/playlist-detail/LovedHeader.tsx`, `components/TrackItem.tsx` |
| Downloads | `collection/downloads` | `app/(tabs)/(c.collection)/collection/downloads.tsx`, `components/ReciterDownloadsListItem.tsx`, `components/TrackItem.tsx` |
| Reciter downloads | `collection/reciter-downloads/[reciterId]` | `app/(tabs)/(c.collection)/collection/reciter-downloads/[reciterId].tsx`, `components/reciter-downloads/ReciterDownloadsList.tsx`, `components/playlist-detail/ReciterDownloadsHeader.tsx` |
| Uploads | `collection/uploads` | `app/(tabs)/(c.collection)/collection/uploads.tsx`, `components/sheets/UploadOptionsSheet.tsx` |
| Favorite reciters | `collection/favorite-reciters` | `app/(tabs)/(c.collection)/collection/favorite-reciters.tsx`, `components/ReciterItem.tsx` |
| System playlist | `(b.search)/system-playlist/[id]` | `components/system-playlist/SystemPlaylistDetail.tsx`, `SystemPlaylistHeader.tsx` |
| Shared | | `hooks/useCollectionNativeHeader.tsx`, `components/collection/CollectionStickyHeader.tsx`, `hooks/useBottomInset.ts`, `components/layout/MaxWidthContainer.tsx` |
| Dead code (unused) | | `components/collection/CollectionGrid.tsx`, `FilterBar.tsx`, `PlaylistModal.tsx`, `CollectionHeader.tsx`, `components/CollectionCard.tsx`, `components/CollectionView.tsx`, `app/(tabs)/(a.home)/reciter/_styles.ts`, `app/(tabs)/(c.collection)/reciter/_styles.ts`, `app/(tabs)/(c.collection)/collection/_styles.ts` |

## Current state

**Shell.** Every screen is the phone layout inside `MaxWidthContainer` at its 720pt default
(`app/(tabs)/(c.collection)/_layout.tsx:28`, `app/(tabs)/(a.home)/_layout.tsx:16`). No file in
scope imports `useResponsive` or checks `isTablet`.

**Sizing.** All sizing goes through `react-native-size-matters`. Its `moderateScale(x)` equals
`x * (0.5 + w/700)`, where `w` is the short screen side. That is about 1.56× on iPad mini, 1.69×
on 11" and 1.97× on 13".

**Reciter profile.** One vertical `ScrollView` holds a collapsing header, then a sticky rewayah
tab bar and sort row. Below them is a horizontal pager with one page per rewayah plus "My
uploads". Each page is sized to the **window** width.

**Library.** The home is a list of seven category rows. Each row pushes a screen with:

- a centred icon hero
- round action buttons
- a `FlatList` of phone rows

**Header duplication.** The same header pattern is copied into at least eight files.

**Missing interactions.** Options are bottom action sheets. There are no context menus, hover
states, key commands, multi-select or drag to reorder.

## Weaknesses

Severity: **High** breaks layout or a core task on iPad; **Med** clearly
worse than platform peers; **Low** polish.

### Typography

**L-01 · High · Text is inflated 1.6-2x by size-matters.** Row titles,
metadata and headers all use `moderateScale` from `react-native-size-matters`,
not the capped `utils/scale.ts` (F-04). Examples: reciter name 32pt →
63pt on 13" (`components/reciter-profile/components/ReciterHeader/index.tsx:111`);
surah row title 13pt (`components/SurahItem.tsx:358`); track row title 14pt
and reciter 12pt (`components/TrackItem.tsx:283`, `:298`); category label
15pt (`app/(tabs)/(c.collection)/index.tsx:291`); playlist row 14pt
(`components/PlaylistItem.tsx:121`). Every file in scope imports
size-matters; none uses `utils/scale.ts`.

**L-02 · Med · Inverted hierarchy in collection headers.** Library detail
titles are 17pt (`components/playlist-detail/PlaylistHeader.tsx:150`,
`LovedHeader.tsx:129`, `ReciterDownloadsHeader.tsx:161`,
`collection/playlists.tsx:96`, `favorite-reciters.tsx:123`) while the
reciter profile name is 32pt and the system playlist title 24pt
(`components/system-playlist/SystemPlaylistHeader.tsx:213`). The same
role ("collection title") has three sizes, and the Library one is smaller
than the iOS `headline` row text it sits above once scaled.

**L-03 · Med · Metadata below legibility on a held-away device.** 8-11pt
base sizes for badges and secondary text: location badge 9pt
(`components/SurahItem.tsx:395`), upload card tag 8pt
(`components/reciter-profile/components/UploadCard.tsx:142`), search filter
9pt (`components/reciter-profile/components/SearchView/index.tsx:285`),
system playlist badge 11pt (`SystemPlaylistHeader.tsx:206`). These map to
no type-ramp token and do not honor Dynamic Type (F-07).

**L-04 · Low · Hard-coded header title style.** The glass header title is
fixed 17pt `Manrope-SemiBold` (`hooks/useCollectionNativeHeader.tsx:38-39`),
which is right for iOS, but every content title next to it is scaled, so the
nav title is visibly smaller than the in-content title it replaces on scroll.

### Visual

**L-05 · Med · No artwork on collection headers.** Playlists, Loved,
Downloads, Uploads and Favorite reciters use a 64pt circle with a 30pt glyph
as the hero (`PlaylistHeader.tsx:133-144`, `LovedHeader.tsx:112-123`,
`collection/playlists.tsx:75-88`). On a 720pt column this is a small dot
above a wide empty band. Apple Music and Spotify lead with a 200-260pt
square artwork; the app already has reciter photos, surah gradient meshes
(`components/cards/SurahCard.tsx:206`) and playlist colors to build one.

**L-06 · Med · Reciter header is undersized and left-heavy.** The reciter
photo is a 48pt thumbnail beside the meta line
(`ReciterHeader/index.tsx:99-103`), then a full-width 50pt "Play all" bar
and three equal outline buttons (`ActionButtons/index.tsx:191-220`). On
iPad that is a 720pt-wide black slab (scaled to 85pt tall on 13"), with the
person the page is about shown smaller than a list row's thumbnail.

**L-07 · Med · Card mode leaves dead space.** Card view is a fixed two
columns at `width: '48%'` (`SurahList/index.tsx:392`, `:385-389`;
`SearchView/index.tsx:306`; `UploadsTabContent.tsx:525`) but `SurahCard`
draws a fixed `moderateScale(120)` square (`components/cards/SurahCard.tsx:209-210`).
On a 720pt page each cell is ~345pt wide holding a ~203pt card: two lonely
tiles per row and a 140pt gap. `UploadCard` has the same fixed 120pt width
(`UploadCard.tsx:85`).

**L-08 · Low · Row surfaces differ per screen.** `TrackItem` paints
`theme.colors.card` behind every row (`components/TrackItem.tsx:161`);
`SurahItem`, `PlaylistItem` and `ReciterItem` are transparent. Loved and
Downloads therefore look like stacked tiles while the reciter list looks
like a table, for the same kind of content.

**L-09 · Low · Category colors are hard-coded.** Library home icons use
literal hexes (`#6366F1`, `#3B82F6` twice, `#10AC84`, `#FF6B6B`, `#F59E0B`,
`#8B5CF6`) at `app/(tabs)/(c.collection)/index.tsx:81-147`, outside
`styles/colorSchemes.ts`, and "Reciters" and "Notes" share a color.
`ActionButtons` hard-codes `GOLD_COLOR` (`ActionButtons/index.tsx:14`).

### Layout

**L-10 · High · Reciter pager is sized to the window, not its container.**
Pages are `width: screenWidth` from `useWindowDimensions`
(`ReciterProfile.tsx:219`, `:1237`), and tab switches scroll to
`tabIndex * screenWidth` (`:891`), with page index derived from
`offsetX / screenWidth` (`:917`, `:931`) and the initial offset
(`:258-275`, `:970`). The pager actually lives in the 720pt
`MaxWidthContainer` column. On 11" portrait each page is 834pt inside a
720pt viewport: the right 114pt of every row (the "more" button and loved /
download icons in `SurahItem`'s `optionsZone`) is clipped, and
`pagingEnabled` snaps at 720pt multiples, so a swipe lands mid-page. In
landscape (once F-01 is lifted) the page is 1194pt in a 720pt viewport. The
tab indicator interpolation uses the same wrong width
(`RewayatTabBar.tsx:73`, `:92`, `:109`, `:129`). The `pagerLayout` test
(`components/reciter-profile/__tests__/pagerLayout.test.ts`) only covers the
initial-page check.

**L-11 · High · Content height assumes the window.** `contentMinHeight =
screenHeight - stickyHeight` (`ReciterProfile.tsx:1011`) and the uploads
page caps itself to it (`:1209-1214`). In Split View or Stage Manager the
window, not the screen, must drive this; with F-02 lifted the value is
already right only because `useWindowDimensions` is used, but any change to
the container (sidebar, docked player) breaks it. Measure the container with
`onLayout` instead.

**L-12 · High · Bottom padding reserves a phone tab bar and mini player.**
`useBottomInset()` adds 49pt tab bar + 64pt mini player on iOS
(`hooks/useBottomInset.ts:11-14`, `:31-35`) with no tablet branch, but iPad
has no bottom tab bar and docks the mini player in the sidebar
(`components/tablet/TabletDockedPlayer.tsx:24`). Library screens add a
further fixed `moderateScale(65)` (`collection/loved.tsx:95`,
`components/reciter-downloads/ReciterDownloadsList.tsx:93`) or
`moderateScale(100)` (`SystemPlaylistDetail.tsx:194`). Lists end on
~150-230pt of blank space on iPad. The standard docks the mini player in the
sidebar footer at `expanded`+ but at the bottom of the content area at
`medium` ([§6](../ipad-standards.md#6-navigation-and-app-shell)), so the
inset must come from the shell, per width class.

**L-13 · High · No use of width beyond 720pt, and no two-pane Library.**
In landscape (~950pt content on 11", ~1090pt on 13") the Library is a 720pt
list of seven rows centred in empty canvas
(`app/(tabs)/(c.collection)/index.tsx:178-219`), and every category is a
full push. Apple Music shows Library sections in the sidebar with the
selected list beside it; Spotify shows Your Library as a panel. Here, going
from Loved to Downloads is back + tap + wait for a push animation.

**L-14 · Med · Track rows have no columns.** Rows stack title, reciter and
rewayah in one cell (`TrackItem.tsx:175-217`; `SurahItem.tsx:178-281`). Data
for useful columns exists but is never shown: `fileSize` and
`downloadDate` on downloads (`services/player/store/downloadStore.ts:72-73`),
`addedAt` on playlist items (`services/playlist/PlaylistService.ts:90`),
loved `timestamp` (`hooks/useLoved.ts:10`), verse count and revelation
place on surahs. Downloads shows no per-item or total storage size at all.

**L-15 · Med · Phone header geometry.** Collection headers pad the top with
`insets.top + moderateScale(40)` on non-glass iOS
(`PlaylistHeader.tsx:116`, `LovedHeader.tsx:102`,
`ReciterDownloadsHeader.tsx:134`, `SystemPlaylistHeader.tsx:175`), the
reciter header with `insets.top + moderateScale(50)`
(`ReciterHeader/index.tsx:51`), and floating back buttons sit at phone offsets
(`top: insets.top, left: moderateScale(15)` in
`NavigationButtons/index.tsx:39-40`; `insets.top + moderateScale(10)` in
`PlaylistHeader.tsx:123-124`). Header
title reveal thresholds are fixed scroll offsets (`threshold = 120` in
`hooks/useCollectionNativeHeader.tsx:20`; `inputRange: [80, 120]` in
`collection/loved.tsx:756`, `downloads.tsx:632`, `uploads.tsx:606`) while
the header they track is scaled ~1.7-2x, so the title appears long before
or after the in-content title scrolls away.

**L-16 · Med · Native header is trapped in the 720pt column.** The stacks
sit inside `MaxWidthContainer` (`app/(tabs)/(c.collection)/_layout.tsx:28`,
`app/(tabs)/(a.home)/_layout.tsx:16`), so the glass navigation bar, back
button and header-right share / search icons
(`ReciterProfile.tsx:299-337`) float in the middle of the screen instead of
spanning the detail area as UIKit navigation bars do.

**L-17 · Med · Fixed column counts.** `SearchView` uses `numColumns={2}` for
cards (`SearchView/index.tsx:208`), `UploadsTabContent` `numColumns={2}`
(`UploadsTabContent.tsx:464`). The unused `CollectionGrid` computes columns
from `useWindowDimensions` (`components/collection/CollectionGrid.tsx:121-150`),
which would repeat L-10 if revived; `CollectionView` hard-codes
`numColumns={3}` (`components/CollectionView.tsx:110`).

**L-18 · Low · Sort / filter row is phone-shaped.** Three text chips
(A-Z, Z-A, revelation), a heart and a grid toggle in a 40pt row
(`ReciterProfile.tsx:1120-1203`, `styles/index.ts:20-30`). On iPad the
standard is a single "Sort" pull-down menu and a view toggle in the toolbar.

**L-19 · Low · Full lists render non-virtualized.** Inline `SurahList`
maps every surah into the outer `ScrollView` once expanded
(`SurahList/index.tsx:301-330`), for each visited rewayah page. With 114
rows at 85pt each per page, memory grows per visited tab; acceptable on a
phone, wasteful on a large canvas that shows more rows at once.

### Interaction

**L-20 · High · No context menus; actions only via bottom sheets.** Every
row's long press and "more" button opens a bottom action sheet
(`ReciterProfile.tsx:1264` `surah-options`;
`collection/playlists.tsx:229` `playlist-context`;
`favorite-reciters.tsx:254` `collection-options`;
`loved.tsx:665`, `downloads.tsx:600`, `:619`). On iPad the sheet spans the
whole window bottom, far from the row that opened it, and right-click does
nothing (F-12). No sheet sets a max width
(`components/sheets/UploadOptionsSheet.tsx:422-429`).

**L-21 · High · Playlists cannot be reordered or bulk-edited.** The store
already exposes `reorderPlaylistItems` (`hooks/usePlaylists.ts:27`,
`services/playlist/PlaylistService.ts:131`) and
`react-native-draggable-flatlist` is a dependency (`package.json:122`), but
`PlaylistDetail` renders a plain `FlatList` (`PlaylistDetail.tsx:435`) with no
edit mode. There is no multi-select anywhere (remove several loved items,
delete several downloads, add several surahs to a playlist).

**L-22 · Med · No hover or pointer states.** None of the row or button
`Pressable`s in scope use `onHoverIn/Out`; pressed feedback is opacity only
(`ActionButtons/index.tsx:227-229`). With a trackpad there is no indication
of what is clickable (F-10).

**L-23 · Med · Search is a full-screen overlay.** Tapping search replaces the
profile with `SearchView` laid over it (`ReciterProfile.tsx:1356-1357`,
`SearchView/index.tsx:165`) and hides the back button
(`ReciterProfile.tsx:298`). On iPad, search belongs in the toolbar and
filters the visible list in place; Cmd+F (F-11) should focus it.

**L-24 · Med · Duplicate entry points to the same reciter.** The reciter
profile is registered in both the Home and Library stacks
(`app/(tabs)/(a.home)/reciter/[id].tsx`, `app/(tabs)/(c.collection)/reciter/[id].tsx`),
and the Library copy drops `rewayatId`
(`app/(tabs)/(c.collection)/reciter/[id].tsx:7-10`) while the Home copy drops
`showFavorites`. A favorite reciter opened from the Library cannot land on a
specific rewayah.

**L-25 · Low · Surah deep link gives no visual landing.**
`app/reciter/[slug]/[surah].tsx` replaces to Home and opens the player after a
timeout. On iPad, with a persistent sidebar, the natural landing is the
reciter profile with the row highlighted and the player opened.

### Accessibility

**L-26 · High · Icon-only controls are unlabeled.** Across the 20 files in
scope only two `accessibilityLabel`s exist outside `SurahItem`, both in
`ActionButtons`. Unlabeled: share and search
(`ReciterProfile.tsx:309-335`), sort chips without role or selected state
(`:1123-1165`), loved filter toggle (`:1170-1190`), view mode toggle
(`:1191-1199`), header circle buttons for options / play / shuffle
(`LovedHeader.tsx:63`, `:72`, `:81`; `PlaylistHeader.tsx:77`, `:86`, `:95`;
`ReciterDownloadsHeader.tsx:95`, `:104`, `:113`;
`collection/downloads.tsx:549`, `:563`, `:578`;
`collection/uploads.tsx:530`, `:544`, `:559`;
`SystemPlaylistHeader.tsx:131`, `:143`), track row and "more" zone
(`TrackItem.tsx:163`, `:225`), playlist "more" (`PlaylistItem.tsx:70`),
category rows (`app/(tabs)/(c.collection)/index.tsx:180`).

**L-27 · Med · Hard-coded English a11y strings.** `getDownloadAllLabel`
returns literal English (`ActionButtons/index.tsx:72-76`) and the favorite
button's label never changes to "Favorited"
(`ActionButtons/index.tsx:144`).

**L-28 · Med · Motion ignores Reduce Motion.** The surah list skeleton loops
a pulse forever (`ReciterProfile.tsx:137-153`), the loved filter heart
springs (`ReciterProfile.tsx:1179`), the system playlist buttons animate
(`SystemPlaylistHeader.tsx:130-145`). No file in scope reads
`AccessibilityInfo.isReduceMotionEnabled` or Reanimated's
`useReducedMotion`.

**L-29 · Med · Rows have fixed heights or fixed sub-element sizes.** The
sort row is `height: moderateScale(40)` (`styles/index.ts:21`), the glyph
box `60x45` (`SurahItem.tsx:342-343`), the action buttons `height` 50 / 44
(`ActionButtons/index.tsx:192`, `:211`). With Dynamic Type (F-07) text will
clip. Use `minHeight`.

### Platform integration

**L-30 · High · Multitasking widths are not designed.** Once F-02 is lifted,
a ⅓ Split View (320-375pt) still reports `isTablet`, so the 88pt rail
stays and leaves ~232-287pt for content, with size-matters still scaling
from the launch screen size (size-matters reads `Dimensions` once at
import). Every screen here must render the phone layout under `compact`
([§2.2](../ipad-standards.md#22-rules)) and the redesigned layout above it.

**L-31 · Med · No drag and drop.** Surah rows, tracks and playlists cannot be
dragged onto a playlist in the sidebar or between apps, and Uploads cannot
accept audio files dropped from Files. Both are standard iPad behaviours
for a library (Music accepts drops on playlists).

**L-32 · Low · No keyboard focus or shortcuts on lists.** No arrow-key
navigation, Return to play, Delete to remove, Cmd+A in edit mode (F-11).

**L-33 · Low · Documentation drift.** `docs/features/reciter-profile.md:3-24`
describes a `components/ReciterProfile/` and `SearchHeader/` that do not
exist and never mentions the pager, uploads tab or tablet behavior. Six
unused collection components and three unused `_styles.ts` files (one using
`Dimensions.get('window')` at module load,
`app/(tabs)/(c.collection)/reciter/_styles.ts:9`) invite copy-paste of
phone-era patterns.

## Benchmark notes

- **Apple Music, iPad.**
  - The artist page has a large name, a Play pill and a "···" menu.
  - In landscape, the album page puts 260pt artwork on the leading side, with title, artist,
    Play and Shuffle beside it.
  - The track table has `#`, title, duration and "···" columns, and hovering a row shows play in
    place of the number.
  - In the Library, sections and user playlists live in the sidebar and replace the detail
    without a push.
  - Playlists edit in place, with drag handles and Cmd/Shift multi-select.
- **Spotify, iPad.**
  - The playlist header has 232pt artwork, a type label, a display title, the count and
    duration, and play / shuffle / download / "···" buttons.
  - Rows are 56pt, with columns `#`, title + artist, album, date added and duration.
  - Your Library has filter chips, a sort menu and a grid / list toggle.
- **Tarteel and Quran.com.** Surah rows show the Arabic name, meaning, verse count and revelation
  place, with the download state trailing. `SurahItem`'s calligraphy glyph is Bayaan's
  equivalent of track artwork.
- **iPad HIG.**
  - Bars span the detail area, and menus anchor to their source.
  - Editable lists support drag and drop and multi-select.
  - Targets are at least 44x44pt, and pointer hover highlights them.

## Proposed design

### Conventions

**Content width `cw`.** `cw` is the width right of the sidebar or rail. It is measured with
`onLayout`, never taken from `useWindowDimensions`. Columns are computed from `cw`; the overall
structure (split or not, sheet or menu) comes from the width class. Margins `m` and gutters `g`
come from [§5.2](../ipad-standards.md#52-page-margins-and-gutters-by-width-class), and the shell
from [§6](../ipad-standards.md#6-navigation-and-app-shell).

| Window | Class | Shell | `cw` | `m` / `g` | Grid cols, 160pt cards | Grid cols, 120pt surah tiles |
|--------|-------|-------|------|-----------|------------------------|------------------------------|
| ⅓ Split View, Slide Over | compact | Phone tab bar | 320-375 | 16 / 12 | phone | phone |
| ½ Split View on 13" | medium | 88pt rail | ~590 | 24 / 16 | 3 | 4 |
| iPad mini portrait (744) | medium | 88pt rail | 656 | 24 / 16 | 3 | 4 |
| 11" portrait (820-834) | medium | 88pt rail | 732-746 | 24 / 16 | 4 (3 at 820) | 5 |
| 13" portrait (1024-1032) | expanded | 240pt sidebar | 784-792 | 32 / 20 | 4 | 5 |
| 11" landscape (1180-1210) | expanded | 240pt sidebar | 940-970 | 32 / 20 | 5 (4 at 1180) | 6 |
| 13" landscape (1366-1376) | large | 280pt sidebar | 1086-1096 | 40 / 24 | 5 | 7 |

The column counts use the [§10.1](../ipad-standards.md#101-browse-home-search) formula,
`columns = max(2, floor((cw - 2m + g) / (minCard + g)))`. Inside the Library split, `cw` is the
detail pane width (600pt on 11" landscape, which gives 3 columns of 160pt cards).

**Other conventions:**

- **Sizes.** Tablet sizes are plain points ([§3](../ipad-standards.md#3-sizing-and-scaling)).
  `compact` keeps today's phone layout, re-sized with `@/utils/scale`.
- **Radii** ([§5.4](../ipad-standards.md#54-radii)). Artwork radius is about 6% of the edge:
  12 at 200pt, 14 at 240pt, 17 at 280pt. Row thumbnails use `sm`, cards use `card` (14), buttons
  use `pill`.
- **Hover.** `Color(text).alpha(0.04)` ([§7.2](../ipad-standards.md#72-pointer-trackpad-and-mouse)).
- **Menus** ([§8](../ipad-standards.md#8-sheets-menus-and-modals)). On `medium`+, short action
  lists are context menus or popovers anchored to the trigger. Longer flows are form sheets up to
  560pt wide.
- **New components**, in `components/listening/`: `CollectionHero`, `TrackTable`/`TrackRow`,
  `LibraryGrid`, `ListToolbar` and `LibraryNavPane`. Under `compact`, each falls back to the phone
  component it replaces.

### Shared: `CollectionHero` (replaces 8 header copies)

Fixes L-02, L-05, L-06, L-15 and L-26. It implements
[§10.2](../ipad-standards.md#102-reciter-and-playlist-detail).

```
medium+ : artwork leading                                         compact: stacked, centred
+----------------------------------------------------------------+  +------------------------+
|  +------------+   PLAYLIST                     (overline)      |  |     +----------+       |
|  |  artwork   |   Morning Recitations          (title1 28)     |  |     | art 160  |       |
|  | 200 / 240  |   12 surahs · 3 h 10 m · Updated 2 d (footnote)|  |     +----------+       |
|  |   / 280    |   [ > Play ] [ x Shuffle ]  (⬇)  (···)         |  |  Morning Recitations   |
|  +------------+                                                |  |  [>Play] [xShuffle](···)|
+----------------------------------------------------------------+  +------------------------+
```

**Artwork size.** The size depends on the width class:

| Class | Size | Radius |
|-------|------|--------|
| compact | 160pt | 10 |
| medium | 200pt | 12 |
| expanded | 240pt | 14 |
| large | 280pt | 17 |

The `medium` size is a proposed extension; see "Proposed changes to the standard" at the end.

**Artwork source per screen:**

- **Reciter:** the reciter photo (`ReciterImage`), drawn as a circle, as on Apple Music artist
  pages.
- **Playlist:** a 2x2 mosaic of the first four distinct reciter photos. If there are fewer, it
  falls back to the `SurahCard` gradient mesh (`paletteForSurah`,
  `components/cards/SurahCard.tsx:206`) tinted with the playlist color.
- **Loved:** a heart on a `theme.colors.error` gradient, from 85% to 55%.
- **Downloads:** a download glyph on a primary-color gradient.
- **Reciter downloads:** the reciter photo with a download badge.
- **Uploads:** a microphone on `backgroundSecondary` with a primary tint.
- **System playlist:** the mesh palette of its first surah.

**Text.** The eyebrow is `overline`. The title is `title1`, 2 lines max; reciter names use
`display` (34). The meta line is `footnote` in `textSecondary`, dot-separated: count, total
duration (already computed for system playlists, `SystemPlaylistDetail.tsx:657-659`), and total
size for Downloads.

**Actions row.** The row is 44pt tall with an `sm` gap, and it is always visible without
scrolling.

- **Play:** a filled pill, at least 120pt wide. It keeps today's `theme.colors.text` fill
  (`ActionButtons/index.tsx:191-199`), with the label in `callout` Bold.
- **Shuffle:** the same pill in outline, using `text` at 16% alpha.
- **Icon buttons:** 44x44 circles for favorite (reciter) and download-all with
  `CircularProgress`.
- **"···":** opens an anchored context menu.

**Scroll behaviour.** The hero scrolls away as the list header. The glass nav bar fades the title
in when the bottom of the measured hero title passes under it. This replaces the fixed `120` and
`[80, 120]` thresholds.

### Shared: `TrackTable` and `TrackRow`

Fixes L-08, L-14, L-19, L-20, L-22, L-26, L-29 and L-32.

One row component serves surah lists (reciter profile), track lists (playlist, loved, downloads,
reciter downloads, system playlist) and uploads. Which columns appear depends on `cw`:

| Column | Width | Shown when | Content |
|--------|-------|------------|---------|
| Index | 56pt | always | Surah number in `footnote` with tabular figures. On reciter pages, the surah glyph instead (`SurahNames` font, 22pt, in a 44x44 box). On hover, a play glyph; while playing, `NowPlayingIndicator` |
| Title | flex, min 220pt | always | `headline` title. Second line in `footnote`: the reciter (track lists) or the meaning (reciter pages) |
| Rewayah | 160pt | `cw >= 860` and the list mixes rewayat | `footnote` |
| Context | 120pt | `cw >= 720` | Reciter page: "Makki · 7 verses". Downloads: file size. Playlist: date added. Loved: date loved |
| Status | 32pt | always | Download state, loved heart |
| More | 44pt | always | "···". On hover with a pointer; always visible on touch |

```
11" landscape, Playlist detail (cw 954, m 32)
 #   TITLE                                REWAYAH            ADDED        ⬇  ···
 ──────────────────────────────────────────────────────────────────────────────
 1   Al-Fatiha · Mishary Alafasy          Hafs 'an 'Asim     2 Oct        ⬇  ···
 ▶   Al-Kahf · Maher Al-Muaiqly  ← hover  Warsh 'an Nafi'    28 Sep       ⬇  ···
 ▮▮  Ya-Sin                      ← playing: primary 8% tint, GradientText title
iPad mini portrait (cw 656): #  |  Title (2 lines)  |  ⬇  |  ···      compact: today's rows
```

**Row:**

- `minHeight` is 60pt, with 8pt vertical padding and the page margin `m` on both sides.
- Hairline separators are inset to the title column. Rows have no `card` background (L-08).
- Rows stretch to the pane. Above 960pt, the extra width goes to the Title column only (see
  "Proposed changes to the standard").

**Column headers.** At `cw >= 720`, an `overline` header row sticks under the toolbar. Clicking a
header sorts by that column.

**Edit mode.** A 24pt checkbox replaces the index. With a pointer, Cmd-click and Shift-click
extend the selection.

**Context menu.** It opens on long press or secondary click. The items are the same as today's
`surah-options` and `track-options` sheets, which stay as the `compact` fallback:

- Play, Play next, Add to queue
- Add to playlist ▸ (submenu)
- Love / Unlove, Download / Remove download
- Go to reciter, Share, About surah

**VoiceOver** ([§12](../ipad-standards.md#12-accessibility)):

- Each row is one element, labelled "{title}, {subtitle}, {context}, {status}".
- Rows have `accessibilityActions` for play next, add to playlist, download and love.
- The "···" button is labelled "More options for {title}".

**Performance.** The table is virtualized with `FlashList` (2.0.2 is already a dependency).

### Shared: `ListToolbar`

Fixes L-18 and L-23.

```
[ Hafs | Warsh | Qalun | My uploads ]          (⌕ Search surahs     )  [Sort ▾]  [♥]  [▦/☰]
```

The toolbar is a 52pt sticky bar under the nav bar. Every target is 44x44.

- **Leading:** a pill-style segmented control for the rewayat or Library filters.
- **Trailing:**
  - a 240pt inline search field (`callout`), which filters the current page in place
  - a Sort pull-down: a native menu from `react-native-ios-context-menu`, with a checkmark on the
    active option
  - a Loved-only toggle (`accessibilityState.selected`)
  - a grid / list toggle
- **Keyboard:** Cmd+F focuses the search field and Esc clears it
  ([§7.3](../ipad-standards.md#73-hardware-keyboard)).
- **Compact:** today's controls row and full-screen `SearchView` stay.

### Reciter profile

Fixes L-01, L-06, L-07, L-10, L-11, L-16, L-17, L-18, L-23, L-24 and L-28.

```
expanded / large (13" portrait, 11" and 13" landscape)
+-------------------------------------------------------------------------------+
| <                                                       [share] [···]         |  nav bar spans pane
|   +---------+   RECITER                                         (overline)    |
|   |  photo  |   Mishary Rashid Alafasy                         (display 34)   |
|   |  240 ⌀  |   114 surahs · 4 rewayat · Murattal              (footnote)     |
|   +---------+   [ > Play all ] [ x Shuffle ]  (☆)  (⬇ 34%)  (···)            |
| [Hafs 'an 'Asim | Warsh | Qalun | My uploads]  (⌕ Search  ) [Sort ▾] [♥] [☰]  |  sticky ListToolbar
|  #    TITLE                        REVELATION        VERSES         ⬇   ···   |
|  ۞    Al-Fatiha · The Opener       Makki             7              ⬇   ···   |
|  ۞    Al-Baqarah · The Cow         Madani            286                ···   |
+-------------------------------------------------------------------------------+
```

**Medium** (mini and 11" portrait, ½ split):

- The photo is 200pt and the name is in `display`.
- If the icon buttons don't fit, they wrap under the pills.
- Revelation and Verses move into the subtitle line: "The Opener · Makki · 7 verses".

**Card mode.** Card mode uses `LibraryGrid` with surah tiles (`minCard` 120, 4-7 columns).
`SurahCard` fills its cell instead of drawing a fixed `moderateScale(120)` square. The same grid
replaces `numColumns={2}` in `SearchView` and `UploadsTabContent`.

**Pager:**

- Measure the viewport with `onLayout` and store it as `pageWidth`. Use it everywhere
  `screenWidth` is used today: `ReciterProfile.tsx:264-271`, `:891`, `:917`, `:931`, `:970` and
  `:1237`, plus the `screenWidth` prop of `RewayatTabBar`.
- When `pageWidth` changes, snap to the active page without animation
  ([§11](../ipad-standards.md#11-orientation-and-multitasking)).
- At `expanded`+, set `scrollEnabled={false}` and switch rewayat only from the toolbar. On a wide
  table, a sideways swipe is more likely an accident, and Apple Music has no such gesture.

**Uploads tab.** It uses `TrackTable`, with "Recording type · verses 1-20" in the Context column.
The toolbar gets an "Upload" button, and audio files dropped on the list start an upload (L-31).

**Routes.** One parameter contract for both reciter routes: `rewayatId`, `showFavorites` and
`highlightSurah` (L-24). On `medium`+, `app/reciter/[slug]/[surah].tsx` pushes the profile with
the row highlighted, then opens the player (L-25).

**Compact:** today's screen, re-sized with `@/utils/scale`.

### Library home

Fixes L-09, L-13, L-16 and L-30. It implements the collection list-detail split from
[§6](../ipad-standards.md#6-navigation-and-app-shell).

**Expanded / large: list-detail split.** The list pane is 340pt. The detail pane is 444pt on 13"
portrait, 600pt on 11" landscape and 756pt on 13" landscape, so it always meets the 420pt minimum.

```
11" landscape: sidebar 240 | library pane 340 | detail ~600
+----------+------------------------+--------------------------------------+
| Home     | Library          [+]   |  +-------+  COLLECTION               |
| Search   | LISTENING              |  |   ♥   |  Loved                    |
| Library• |  ♫ Playlists       12  |  |  240  |  48 surahs · 6 h 12 m     |
| Mushaf   |  ☺ Reciters         9  |  +-------+  [>Play] [xShuffle] (···) |
|          |  ⬇ Downloads       34  |  ----------------------------------- |
|          |  ♥ Loved •         48  |   #  TITLE              ADDED    ··· |
|          |  🎙 Uploads          5  |   1  Al-Mulk            Today    ··· |
|          | READING                |   2  Ar-Rahman          2 Oct    ··· |
|          |  🔖 Bookmarks  ✎ Notes  |                                      |
| [mini    | PLAYLISTS              |                                      |
|  player] |  ▪ Fajr  8  ▪ Commute  |                                      |
+----------+------------------------+--------------------------------------+
```

**The pane:**

- Background is `backgroundSecondary`, with a hairline trailing border in `border`.
- Section headers are `overline` with 24pt above them.
- Rows have a 44pt `minHeight`, a 28x28 icon tile (radius `sm`) in the category tint, the label
  in `callout` SemiBold, and the count in `footnote`.
- The selected row gets a 14% primary-color fill with radius `md`. Hover uses the 4% overlay.

**Playlists.** User playlists are listed in the pane, as in the Apple Music sidebar. Each one is a
drop target (L-31) and has a context menu: Play, Shuffle, Rename, Delete.

**Adding items.** The "+" opens `add-to-collection` as a form sheet. It replaces the full-width
"Add to collection" bar (`app/(tabs)/(c.collection)/index.tsx:165-175`).

**Navigation:**

- Selecting a pane row replaces the detail without a push animation.
- Pushes inside the detail stay in the detail pane, which shows its own back button.
- The pane opens on the last-used row, or on Playlists the first time.

**Category colors.** Move them into `styles/colorSchemes.ts` as `theme.colors.category.*`, and
give Reciters and Notes different colors (L-09).

**Medium: single pane.** The home becomes a 3-column tile grid followed by a playlists shelf with
peek. Tiles use `minCard` 200 (proposed), `minHeight` 88, radius `card` and a 12% category tint.

```
11" portrait (cw 746)
  Library                                                    [+]
  [ ♫ Playlists 12 ] [ ☺ Reciters 9 ] [ ⬇ Downloads 34 ]
  [ ♥ Loved 48     ] [ 🎙 Uploads 5  ] [ 🔖 Bookmarks 21 ]
  Playlists (title2)                                  See all
  [art][art][art][art]   ← shelf sized from the 160pt grid math
```

**Compact:** today's list.

**Build.** In `app/(tabs)/(c.collection)/_layout.tsx`, render `LibraryNavPane` next to `<Stack>`
at `expanded`+; the pane drives the stack with `router.replace`. Drop the stack-level
`MaxWidthContainer` ([§5.3](../ipad-standards.md#53-content-width)) so the nav bar spans the
detail pane (L-16).

### Playlists

Fixes L-05, L-17, L-20 and L-21.

- **Header:** a large title. The `ListToolbar` has a "New playlist" pill, a Sort menu (Recently
  added, Name, Recently played) and a grid / list toggle.
- **Grid** (the default on `medium`+): `LibraryGrid` with `minCard` 160.
  - Artwork is square, radius `card`.
  - The title is `headline` (1 line) and the count is `footnote`.
  - Hover adds the 4% overlay and a 1.02 lift.
- **List mode:** `PlaylistItem` takes the `TrackRow` metrics (60pt rows, 48pt artwork, radius
  `sm`).
- **Edit mode:** multi-select with bulk delete. Drag to reorder once playlist order is persisted.
- **Context menu:** Play, Shuffle, Rename, Change color, and Delete (destructive, confirmed with
  an alert).
- **Empty state:** centred, at most 360pt wide, with a 96pt illustration, `title2`, `body` and a
  primary pill.

### Playlist detail

Fixes L-05, L-14, L-21 and L-26.

**Hero.** `CollectionHero` with the mosaic artwork.

- **Meta:** "N surahs · duration · Updated {relative}".
- **Actions:** Play, Shuffle, Download all, and "···" (Rename, Change color, Edit, Delete).

**Table.** `TrackTable`, with date added (`addedAt`) in the Context column.

**Edit mode:**

- Rows get a leading checkbox and a trailing 44x44 drag handle.
- Reorder uses `react-native-draggable-flatlist` and calls `reorderPlaylistItems`
  (`hooks/usePlaylists.ts:27`) on drop.
- The toolbar shows "Select all", "Remove (n)" and "Done". The Delete key removes the selection.
- "Move to top" and "Move to bottom" in the context menu cover pointer users, who can't drag
  easily ([§7.2](../ipad-standards.md#72-pointer-trackpad-and-mouse)).

**Drops.** Surah and track rows dropped on the table are appended to the playlist.

**Pinned hero.** At `large`, and at `expanded` landscape when the Library pane is hidden, the
hero becomes a pinned leading column (280pt artwork + 2 × `m`) while the table scrolls, as on
Apple Music album pages:

```
13" landscape, full width (cw 1096)
+-----------------------------+------------------------------------------------+
| [   mosaic 280            ] |  #  TITLE                     ADDED       ···  |
| PLAYLIST                    |  1  Al-Mulk · Saad Al-Ghamdi  Today       ···  |
| Night recitations           |  2  Ar-Rahman · Abdul Basit   2 Oct       ···  |
| 12 surahs · 2 h 05 m        |  3  Al-Waqiah · Mishary       2 Oct       ···  |
| [>Play] [xShuffle] (···)    |                                                |
+-----------------------------+------------------------------------------------+
```

The same layout applies to Loved, Downloads, Reciter downloads, Uploads and System playlist.
Inside the Library split (detail pane 444-756pt), the hero stays stacked above the table.

### Loved

Fixes L-05, L-08, L-14 and L-21.

- **Hero:** heart gradient. Actions: Play, Shuffle, and "···" (Download all, Add all to playlist).
- **Toolbar:** segments "All" and "By reciter". Sort by Recently loved, Surah or Reciter.
  Search.
- **Table:** `TrackTable`, with the date loved (`timestamp`) in the Context column.
- **Edit mode:** multi-select with Unlove (n), Add to playlist and Download.

### Downloads and Reciter downloads

Fixes L-12, L-14, L-20 and L-21.

- **Hero:**
  - The meta line shows the total size from `fileSize` ("34 surahs · 1.2 GB").
  - "···" holds "Remove all" (confirmed with an alert) and "Manage storage", which links to
    `settings/storage`.
- **Segments:** "Reciters" (grouped, the default) and "Surahs" (flat).
- **Reciters segment:** a `LibraryGrid` (`minCard` 160) of reciter tiles. Each tile shows a
  circular photo, the name in `headline`, and "12 surahs · 340 MB" in `footnote`. A tile pushes
  Reciter downloads: a reciter-photo hero over `TrackTable`.
- **Surahs segment:** `TrackTable`, with the size in the Context column. Sort by size, date or
  surah. Edit mode adds "Remove downloads (n · 210 MB)".
- **In-progress downloads:** `CircularProgress` in the status column, and Cancel in the context
  menu.

### Uploads

Fixes L-14, L-20 and L-31.

- **Hero:** the microphone tile. The first action is an "Upload" pill that opens the document
  picker, then Play, Shuffle and "···".
- **Table:** `TrackTable`.
  - The Context column holds the recording-type or category tag and the verse range. Today these
    are inline pills (`collection/uploads.tsx:220-238`).
  - A Reciter column appears at `cw >= 860`.
- **Drops:** audio files dropped from Files onto the list, or onto the Uploads row in the pane,
  start the picker flow. That flow presents `organize-recitation` as a form sheet.
- **Options:** `UploadOptionsSheet` (`components/sheets/UploadOptionsSheet.tsx:422-429`) splits
  in two. Its short action list becomes a context menu. "About surah" becomes a form sheet up to
  560pt wide.

### Favorite reciters

Fixes L-05, L-17 and L-20.

- **Header:** a large title, "Reciters". The toolbar has "Add reciters" (opens the picker as a
  form sheet), search, sort, and a grid / list toggle.
- **Grid** (default on `medium`+, `minCard` 160): a circular photo, the name in `headline`
  (centred), and the rewayah in `footnote`.
- **Context menu:** Play all, Shuffle, Go to reciter, Remove from favorites.
- **Edit mode:** multi-select remove.

### System playlist

Fixes L-02, L-05, L-12 and L-14.

- **Hero:** `CollectionHero` with the first surah's mesh. The "Curated" badge becomes the
  `overline` eyebrow. The description is `body`, 3 lines max, followed by "More".
- **`surah-only` playlists:**
  - The reciter choice moves into the hero, as a "Reciter: {name} ▾" pull-down beside Play.
  - Rows use `TrackTable`: glyph index, title + meaning, verse count.
  - Hover play and row tap replace the custom "Play" pill (`SystemPlaylistDetail.tsx:598-626`).

### Compact widths (⅓ Split View, Slide Over, narrow Stage Manager)

Under `compact`, every screen renders its phone layout with `@/utils/scale` sizing and the phone
tab bar ([§2.2](../ipad-standards.md#22-rules)). Each new component falls back:

| Component | Compact fallback |
|-----------|------------------|
| Library split | The list only |
| `ListToolbar` | Today's controls row |
| `CollectionHero` | Stacked, 160pt artwork |
| `TrackTable` | Today's two-line rows |
| Context menus | Today's bottom sheets |

Test at 320, 375, 507 and 678pt windows.

## Implementation notes

Each step is roughly one PR. Steps 1-2 are pure fixes and can ship before the orientation unlock.

1. **Fix the reciter pager width (L-10, L-11).** In
   `components/reciter-profile/ReciterProfile.tsx`, measure the pager container with `onLayout`
   into `pageWidth`; replace every `screenWidth` use (`:264-271`, `:891`, `:908`, `:917`, `:931`,
   `:951`, `:970-975`, `:1117`, `:1237`) and `screenHeight` (`:1011`) with measured values; pass
   `pageWidth` to `RewayatTabBar.tsx`. Re-scroll on width change. Extend
   `components/reciter-profile/__tests__/pagerLayout.test.ts` with page-index math for non-window
   widths.
2. **Shell-aware bottom inset (L-12).** `hooks/useBottomInset.ts`: on `medium` return
   `insets.bottom` + docked mini player height; on `expanded`+ return `insets.bottom + 16` (player
   in the sidebar footer, [§6](../ipad-standards.md#6-navigation-and-app-shell)). Remove the extra
   `moderateScale(65|100)` paddings in `collection/loved.tsx:95`, `ReciterDownloadsList.tsx:93`,
   `SystemPlaylistDetail.tsx:194`, `PlaylistDetail.tsx:82` in favour of `useBottomInset()`.
3. **Size-matters migration for this scope (L-01, L-03, L-29).** Switch the files in "Screens
   covered" to `@/utils/scale` and `theme.type.<role>`
   ([§3](../ipad-standards.md#3-sizing-and-scaling),
   [§4.1](../ipad-standards.md#41-ui-type-ramp)); `height` → `minHeight` on rows and buttons
   ([§4.3](../ipad-standards.md#43-dynamic-type-and-font-scaling)).
4. **Accessibility pass (L-26, L-27, L-28).** Labels, roles and states for every control listed
   under L-26; translate `ActionButtons` labels; `useReducedMotion()` gates the skeleton pulse,
   heart spring and `SystemPlaylistHeader` button animations.
5. **Delete dead code (L-33).** Remove `components/collection/CollectionGrid.tsx`,
   `FilterBar.tsx`, `PlaylistModal.tsx`, `CollectionHeader.tsx`, `components/CollectionCard.tsx`,
   `components/CollectionView.tsx`, the three unused `_styles.ts` files, and their tests
   (`components/collection/__tests__/collectionItems.units.test.tsx` covers some). Rewrite
   `docs/features/reciter-profile.md` to match the real tree.
6. **`CollectionHero` (L-02, L-05, L-06, L-15).** New `components/listening/CollectionHero.tsx`;
   migrate `PlaylistHeader`, `LovedHeader`, `ReciterDownloadsHeader`, `SystemPlaylistHeader`, the
   inline headers in `collection/downloads.tsx`, `uploads.tsx`, `playlists.tsx`,
   `favorite-reciters.tsx`, and `ReciterHeader` + `ActionButtons`. Replace fixed scroll thresholds
   in `hooks/useCollectionNativeHeader.tsx` with a measured `titleBottom`.
7. **`TrackTable` / `TrackRow` (L-08, L-14, L-19, L-22).** New
   `components/listening/TrackTable.tsx` on FlashList with column config per screen; hover via
   `onHoverIn/Out`. Adopt in Playlist detail, Loved, Downloads, Reciter downloads, System
   playlist, Uploads; then in the reciter `SurahList` (replace inline rendering).
8. **Context menus (L-20).** Wrap `TrackRow`, playlist cards and reciter tiles in a `ContextMenu`
   built on `react-native-ios-context-menu` 3.2.1 (F-12), reusing the action lists from the
   `surah-options`, `track-options`, `playlist-context` and `collection-options` sheets so the
   sheets stay the `compact` fallback.
9. **`ListToolbar` and reciter profile redesign (L-07, L-16, L-17, L-18, L-23).** New
   `components/listening/ListToolbar.tsx`; side-by-side hero; inline search; Sort menu;
   `LibraryGrid` (new `components/listening/LibraryGrid.tsx`, columns from measured width) for
   card mode in `SurahList`, `SearchView`, `UploadsTabContent`. Move the `MaxWidthContainer` out
   of `(a.home)/_layout.tsx` and `(c.collection)/_layout.tsx` into the screens that need a cap
   ([§5.3](../ipad-standards.md#53-content-width)) so the nav bar spans the pane.
10. **Unify reciter routes (L-24, L-25).** One param contract (`rewayatId`, `showFavorites`,
    `highlightSurah`) for both `reciter/[id].tsx` files; on tablet,
    `app/reciter/[slug]/[surah].tsx` pushes the profile and opens the player.
11. **Library split view (L-09, L-13).** `LibraryNavPane` in
    `app/(tabs)/(c.collection)/_layout.tsx`, category tints in `styles/colorSchemes.ts`, tile grid
    for `medium`, playlists in the pane.
12. **Playlist editing (L-21).** Edit mode with `react-native-draggable-flatlist` and
    `reorderPlaylistItems`; multi-select in Playlists, Loved, Downloads, Favorite reciters.
13. **Drag and drop (L-31).** Drag sources on `TrackRow`, drop targets on playlist rows in the
    Library pane and on Uploads (needs a native module or `react-native-draggable` bridge to
    `UIDragInteraction` / `UIDropInteraction`; scope separately).
14. **Keyboard (L-32).** List-level key commands on top of F-11: arrows move focus, Return plays,
    Space play / pause, Delete removes in edit mode, Cmd+A selects all, Cmd+F focuses the toolbar
    search.

Testing for every step: iPad mini, 11" and 13" simulators in both orientations (after F-01), and
window widths 320, 375, 507, 678, 744, 834, 1024, 1180, 1376pt (after F-02), in light and dark
with at least two primary colors, VoiceOver on, and Larger Text at AX3.

## Proposed changes to the standard

Suggested changes to [ipad-standards.md](../ipad-standards.md):

1. **§5.3: cap track and surah tables.** Rows fill the pane, but beyond 960pt only the Title
   column grows, so trailing columns stay within 960pt of the leading edge. Without this, a
   1096pt row puts the title 700pt away from its "···" button.
2. **§10.2: use the side-by-side header at `medium`, with 200pt artwork.** A stacked, centred
   header at 656-746pt pushes the first track below the fold on iPad mini.
3. **§10.2: allow a pinned hero column.** At `large`, and at `expanded` without a list pane, let
   the hero stay as a leading column while the table scrolls, as on Apple Music album pages.
4. **§10.1: add `minCard` 200 for Library category tiles.** At 160pt, the label and count
   truncate in some languages.
5. **§6: put Library categories in the collection list pane, with playlists as a section below
   them**, as Apple Music does. A pane with only playlists leaves no place for Loved, Downloads
   and Uploads.
6. **§2.2: add a MUST rule.** Horizontal pagers size pages from their measured container, never
   from the window width. L-10 shows what goes wrong otherwise.
