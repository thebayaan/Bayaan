# iPad audit: Collection (Library) tab

> **Scope.** `app/(tabs)/(c.collection)/`: index, `collection/*`, `collection/reciter-downloads/[reciterId]`, `playlist/[id]` and `_layout.tsx`. Also `components/CollectionView.tsx`, `components/collection/*` and `hooks/useCollectionNativeHeader.tsx`, plus the shared pieces these screens render: `components/TrackItem.tsx`, `components/PlaylistItem.tsx`, `components/playlist-detail/{LovedHeader,PlaylistHeader,ReciterDownloadsHeader,PlaylistDetail}.tsx`, `components/reciter-downloads/ReciterDownloadsList.tsx`, `components/sheets/CollectionOptionsSheet.tsx` and `components/tablet/TabletSidebar.tsx`. `reciter/[id]` is audited elsewhere. Code read on 2026-10-26. No simulator was available (Linux container), so all findings come from reading the code.
>
> **Inflation numbers.** Raw `react-native-size-matters` `moderateScale` computes `ms(x) = x · (0.5 + shortSide/700)`. That is ×1.56 on iPad mini (744pt), ×1.67 on iPad and iPad Air 11" (820pt) and ×1.96 on 13" (1024pt).
>
> **Standards.** Proposals follow [the iPad standards](../ipad-standards.md) and [design system](../design-system.md). Rules are cited as §N. Layout is chosen by **width class**, which is based on window width (§2): `compact` < 600, `medium` 600–899, `expanded` 900–1279, `large` ≥ 1280. Margins and gutters follow §5.2 (24/16 at medium, 32/20 at expanded, 40/24 at large). Content widths follow §5.3 (grids uncapped, forms 640, sheets 560, reading 680). Text uses the §4.1 roles. Grid columns use the §10.1 formula `max(2, floor((pane + gutter) / (minCard + gutter)))` with `minCard` 160. Split views follow §6 (list 320–380, detail ≥ 420), and sheets follow the §8 policy.
>
> **Worked pane widths** (window minus shell from §6, minus page margins):
>
> | Window | Class | Shell | Content width | Grid columns (160 min) | List-detail split fits? |
> |---|---|---|---|---|---|
> | 744 (mini portrait) | medium | rail 88 | 608 | 3 (≈197pt) | no (656 < 320+420) |
> | 820 (11" portrait) | medium | rail 88 | 684 | 3 (≈217pt) | no (732 < 740) |
> | 1024 (13" portrait) | expanded | sidebar 240 | 720 | 4 (≈165pt) | yes (340 + 444) |
> | 1180 (11" landscape) | expanded | sidebar 240 | 876 | 4 (≈204pt) | yes (360 + 580) |
> | 1366 (13" landscape) | large | sidebar 280 | 1006 | 5 (≈187pt) | yes (380 + 706) |
>
> Today the app is portrait-locked and wraps every stack in a 720pt `MaxWidthContainer`. In practice iPad users therefore see `medium` (11", mini) or `expanded` (13" portrait) through a 720pt column. §11 and §5.3 remove both limits. The proposals below cover every class.

## Summary

1. **Every Library screen is the phone layout inflated 1.6–2×.** All 10 screens and their row components size rows, artwork, icons, hero headers and paddings with raw `moderateScale` from `react-native-size-matters`. This breaks §3. A 50pt track thumbnail becomes 84–98pt, the 17pt hero title becomes 28–33pt and the 46pt category tile becomes 77–90pt, while the native glass header title stays at a fixed 17pt (`hooks/useCollectionNativeHeader.tsx:39`). The result is about 6 rows per screen where Apple Music shows about 14, and type sizes that don't match within one screen. (P0)
2. **Library has no tablet structure.** It is a hub of 7 rows that pushes single-column lists. There are no sidebar sections, no grids, no library-wide search and no sort or filter. The list-detail split that §6 names explicitly for Collection ("playlists left, contents right") doesn't exist. Playlists, reciters, loved, downloads, uploads, bookmarks and notes are each a vertical phone list in a 720pt column (`index.tsx:177-219`). Apple Music on iPad puts the Library sections in the sidebar and uses grids for albums and artists. Spotify's "Your Library" uses filter chips and a list/grid toggle. (P1)
3. **Destructive bulk actions run with no confirmation (§8 requires an Alert).** These fire straight from a bottom sheet with no Alert and no undo (`CollectionOptionsSheet.tsx:84-86`):
   - "Remove all downloads" (`downloads.tsx:79`)
   - "Remove all uploads", which deletes the user's own imported audio files (`uploads.tsx:313` → `store/uploadsStore.ts:163-170`)
   - "Unlove all" (`loved.tsx:555`)
   - single bookmark and note deletes

   On iPad the sheet opens at the bottom edge, far from the `…` that opened it, which makes slips easy. (P0 for uploads, P1 for the rest)
4. **The hero header is copy-pasted 9 times and sized for a phone.** The same 64pt icon circle, 17pt title, 12pt subtitle and 42pt circle buttons appear in `LovedHeader`, `PlaylistHeader` and `ReciterDownloadsHeader`, and inline in favorite-reciters, playlists, downloads, uploads, bookmarks and notes. Bookmarks and notes use a 22pt title; the rest use 17pt. Each screen also keeps its own fake back button, sticky header and empty-state header for non-glass devices. On iPad this produces a small centered glyph in a wide column instead of the §10.2 two-column header (artwork next to title and Play/Shuffle). (P1)
5. **There is no pointer, keyboard, context-menu or drag-and-drop support (§7).**
   - Long-press opens a bottom sheet everywhere: TrackItem, PlaylistItem, BookmarkItem, NoteItem and ReciterItem.
   - There are no hover states and no ⌘F.
   - Playlists can't be reordered: `reorderPlaylistItems` exists (`hooks/usePlaylists.ts:27`) but no UI calls it.
   - Audio files can't be dropped onto Uploads.
   - Every list ends with `paddingBottom: moderateScale(65)`, a phone gap for the floating player. On tablet the mini player is docked (§10.3), so this becomes 109–128pt of dead space (`loved.tsx:95` and 6 sibling screens). (P1)

**Also noted:**
- **Dead code.** Nothing imports these files: `components/CollectionView.tsx`, `components/collection/{CollectionGrid,CollectionHeader,FilterBar,PlaylistModal,SectionHeader}.tsx`, `app/(tabs)/(c.collection)/_styles.ts` and `app/(tabs)/(c.collection)/collection/_styles.ts`. Delete them before the redesign so nobody "fixes" the wrong file.
- **Design-system conflicts.** The hub hard-codes seven hex accent colors (`index.tsx:81-148`), which breaks design-system principle 2 (monochrome chrome). The screens use `RNAnimated.FlatList`, while the design system's §8 says to prefer `FlashList`.
- **Stale inventory.** `docs/design/screen-inventory.md:83-89` describes the Library index as a "grid of sections and recent items" and says downloads uses `DownloadCard`, among other things. Both are out of date.

---

## Library hub: `/(c.collection)/` (index)

**Files:** `app/(tabs)/(c.collection)/index.tsx`, `app/(tabs)/(c.collection)/_layout.tsx`, `components/layout/MaxWidthContainer.tsx`, `components/tablet/TabletSidebar.tsx`

**What it is:** The Library landing page: an "Add to collection" bar and 7 category rows (Playlists, Reciters, Downloads, Loved, Bookmarks, Notes, Uploads), each with a count.

**Current iPad behavior:** A ScrollView in the 720pt column. Each row has a 77–90pt tinted icon tile, a 25–29pt label, a 20–24pt subtitle and a chevron. The 7 rows fill about 60% of an 11" portrait screen, and the rest is empty. The page shows no content at all (no playlists, no reciters, nothing recent), so on a large canvas the Library is just a navigation menu. The stack, including the native header, sits inside the 720pt column (`_layout.tsx:28`).

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Typography / Layout | Everything inflates (breaks §3). The icon tile goes from 46 to 77–90pt, the label from 15 to 25–29pt, the subtitle from 12 to 20–24pt, the chevron from 18 to 30pt and row padding from 8 to 13–16pt. | `index.tsx:6`, `index.tsx:276-297` | P0 |
| 2 | Layout & density | A list of links wastes the canvas (goal 1 in §1). Apple Music iPad puts these sections in the sidebar and fills the page with content, such as a "Recently Added" grid. | `index.tsx:177-219` | P1 |
| 3 | UX / IA | Every section costs a tap plus a push. The sub-sections are missing from `TabletSidebar`, even though the labeled sidebar at `expanded`+ is 240–280pt wide. | `TabletSidebar.tsx:198-215` (tabs only) | P1 |
| 4 | Visual design | Category colors are hard-coded hex values (`#6366F1`, `#10AC84`, `#FF6B6B`, `#F59E0B`, `#8B5CF6`, and `#3B82F6` used twice, for Reciters and Notes). This breaks design-system principle 2 (monochrome chrome), and two sections share the same blue. | `index.tsx:81-148` | P2 |
| 5 | UI components | "Add to collection" is a full-width ghost bar at 13pt sitting at the top of the page. Apple Music ("New Playlist") and Spotify ("+") put this action in the navigation bar as a `+` button. | `index.tsx:165-175`, `255-269` | P2 |
| 6 | Input | No hover, no keyboard focus and no context menu (for example "Play all Loved" or "Shuffle Downloads") (§7.2). | `index.tsx:180-183` | P2 |
| 7 | Accessibility | Rows have no `accessibilityRole`, the count is not part of the label, and the icons aren't hidden from VoiceOver (§12). | `index.tsx:180-217` | P2 |

### Proposed iPad design
**Reference:** Apple Music iPad Library (sidebar sections plus a "Recently Added" grid) and Spotify "Your Library" (chips, sort, list/grid toggle).

**IA decision: should Library's sub-sections live in the sidebar on iPad?** Yes at `expanded` and `large`, where §6 gives a labeled sidebar. No at `medium` (88pt rail) or `compact` (tab bar); there the hub page does the job.
- **Labeled sidebar (`expanded`+).** Under the tabs, add a collapsible **LIBRARY** group (`overline` header, §4.1) with Playlists, Reciters, Loved, Downloads, Uploads, Bookmarks and Notes. Below it, add a **PLAYLISTS** group that lists the user's playlists: up to 8, then "Show all". This mirrors Apple Music on iPadOS 18. Rows follow `TabletSidebar` styling: the selected row uses `Color(text).alpha(0.08)` and hover uses 0.04 (§7.2). Selecting a row navigates into the Collection stack with the Library tab focused. The standard has no sidebar sub-sections yet; see "Proposed changes to the standard".
- **Hub page at `medium`+** (replaces the 7-row list; page margin from §5.2):
  1. A screen title "Library" (`title1`, 28) and a `+` toolbar button. The button opens `add-to-collection` as a **popover anchored to the button**, since it is a short action list (§8).
  2. **Section shortcuts.** Shown at `medium` only, where there is no sidebar. Tiles go in 2 columns, or 3 when content width is ≥ 720. Each tile is a `minHeight` 60 row with a 32pt icon, a `headline` (17) label, a `footnote` (13) count and the §5.2 gutter. The surface is monochrome: card background `Color(text).alpha(0.04)`, `card` radius 14 (§5.4) and icons at `Color(text).alpha(0.7)`. At `expanded`+ the sidebar already lists the sections, so the tiles are hidden.
  3. A **Playlists shelf**: square `PlaylistArtwork` cards sized from the §10.1 column math with a visible peek, plus "See all" in `callout` and `textSecondary`.
  4. A **Favorite reciters shelf**: circular avatars on the same column math (reuse `CircularReciterCard`).
  5. A **Recently added grid**: loved, downloaded and uploaded items merged and sorted by date. Columns come from §10.1 (3 / 4 / 5 by class, see the table above). Each card is a 1:1 artwork (radius about 6% of edge, §5.4), a `headline` title and a `footnote` secondary line.
- Section titles use `title2` (22) with the §5.2 section spacing (32, or 40 at `large`). The hub is a grid and shelf surface, so it **must not** sit in the 720pt column (§5.3).

```
medium — 11" portrait, window 820 (rail 88 + 732 pane, margins 24)
┌────┬──────────────────────────────────────────────────────┐
│ ⌂  │ Library                                          [+] │
│ ⌕  │ ┌──────────────────────┐ ┌──────────────────────┐    │
│ ◉  │ │ ▣ Playlists    12    │ │ ◉ Reciters      8    │    │
│ ⚙  │ │ ♥ Loved        43    │ │ ↓ Downloads    61    │    │
│    │ │ 🔖 Bookmarks   19    │ │ ✎ Notes         7    │    │
│    │ │ 🎙 Uploads      4    │ └──────────────────────┘    │
│    │ └──────────────────────┘                             │
│    │ Playlists                                  See all › │
│    │ [■■■■■]  [■■■■■]  [■■■■■]  [■■ →  (3 cols + peek)    │
│    │ Favorite reciters                          See all › │
│    │ (●●●)    (●●●)    (●●●)    (● →                      │
│    │ Recently added                                       │
│    │ [■■■■■]  [■■■■■]  [■■■■■]                            │
├────┴──────────────────────────────────────────────────────┤
│ ▶ mini player docked across the content width (§6)       │
└───────────────────────────────────────────────────────────┘

expanded — 11" landscape, window 1180 (sidebar 240 + 940 pane, margins 32)
┌──────────────┬───────────────────────────────────────────────────────┐
│ Home         │ Library                                          [+]  │
│ Search       │ Playlists                                   See all › │
│ Library  ◀   │ [■■■■] [■■■■] [■■■■] [■■■■] [■ →                       │
│ Settings     │ Favorite reciters                           See all › │
│ LIBRARY      │ (●●) (●●) (●●) (●●) (● →                               │
│ ▣ Playlists  │ Recently added                                        │
│ ◉ Reciters   │ [■■■■] [■■■■] [■■■■] [■■■■]                            │
│ ♥ Loved      │ [■■■■] [■■■■] [■■■■] [■■■■]                            │
│ ↓ Downloads  │                                                       │
│ 🎙 Uploads   │  (no shortcut tiles: the sidebar lists the sections)  │
│ 🔖 Bookmarks │                                                       │
│ ✎ Notes      │                                                       │
│ PLAYLISTS    │                                                       │
│  Fajr mix    │                                                       │
│ [mini player]│                                                       │
└──────────────┴───────────────────────────────────────────────────────┘
```

### Implementation notes
- `index.tsx`: when `widthClass !== 'compact'`, render a `LibraryHomeTablet` built from the existing hooks (`usePlaylists`, `useFavoriteReciters`, `useLoved`, `useDownloads`, `useUploadsStore`). Use `@/utils/scale` and ramp tokens. (M)
- `components/tablet/TabletSidebar.tsx`: in labeled mode, add a LIBRARY section and a user-playlists section. (M)
- Replace the hex accents with monochrome tiles. If product wants colored glyphs, document them as an exception (see proposed changes). (S)
- Move "Add" into `headerRight` and open it as a popover at `medium`+. (S)
- Delete `components/CollectionView.tsx`. It is unused and hard-codes `numColumns={3}` (`CollectionView.tsx:110`). (S)

---

## Loved: `/collection/loved`

**Files:** `app/(tabs)/(c.collection)/collection/loved.tsx`, `components/playlist-detail/LovedHeader.tsx`, `components/TrackItem.tsx`, `components/collection/CollectionStickyHeader.tsx`, `hooks/useCollectionNativeHeader.tsx`

**What it is:** The user's loved surah recitations, with a Play/Shuffle header and an options menu (Download all, Unlove all).

**Current iPad behavior:** A heart sits centered in a 107–125pt double circle, above a 28pt title and 70–82pt Play/Shuffle squares. Below that is a list of `TrackItem` rows, each about 100–115pt tall, showing a thumbnail, surah name, reciter and rewayah. Rows show no duration, index or date. On a 720pt row, most of the width is empty space between the text and a 20%-wide `…` zone. Non-glass devices also show a floating back arrow that fades out while a duplicate sticky header fades in.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Layout & density | `TrackItem` inflates (breaks §3). The thumbnail goes from 50 to 84–98pt, the title from 14 to 23–27pt, the secondary line from 12 to 20–24pt and the rewayah from 10 to 17–20pt. About 6 rows fit on an 11" screen. | `TrackItem.tsx:263-318` | P0 |
| 2 | Typography | The hero title renders at 28–33pt, but the glass header title is a fixed 17pt, so the size jumps when the header collapses. The subtitle uses `text` instead of `textSecondary`. | `LovedHeader.tsx:128-142`, `useCollectionNativeHeader.tsx:38-40` | P1 |
| 3 | UX | "Unlove all" runs immediately with no confirmation (§8 requires an Alert). | `loved.tsx:544-556`, `hooks/useLoved.ts:88-90`, `CollectionOptionsSheet.tsx:84-86` | P1 |
| 4 | Visual design | The header is a generic glyph in a grey circle, not the §10.2 two-column header. Apple Music "Favorite Songs" and Spotify "Liked Songs" show large collection artwork beside the title. | `LovedHeader.tsx:41-57` | P1 |
| 5 | UI components | Rows don't use the wide screen: no duration, no date loved, no download column. Apple Music iPad song lists show Title / Artist / Album / Duration columns. | `TrackItem.tsx:160-245` | P1 |
| 6 | Layout | `paddingBottom: ms(65)` adds 109–128pt of dead space, even though the player is docked (§10.3). | `loved.tsx:95` | P2 |
| 7 | UX | There is no search, sort (date added / surah order / reciter) or reciter filter. | `loved.tsx:773-786` | P1 |
| 8 | Input | Long-press opens a bottom sheet instead of a context menu or secondary click. There is no hover and no Space, ⌘F or Return shortcut (§7). | `loved.tsx:664-665` | P1 |
| 9 | Chrome | Three header systems coexist: the native glass header, a fake back button (`loved.tsx:750-771`) and `CollectionStickyHeader`. The empty and loading states each duplicate the header again (`679-697`, `708-726`). | as cited | P2 |
| 10 | UX | Bulk download reports progress only through Alerts, with no inline progress. | `loved.tsx:412-504` | P2 |

### Proposed iPad design
**Reference:** The Apple Music iPad "Favorite Songs" playlist (§10.2).
- **Header, `medium`+.** Use two columns.
  - Artwork on the leading side: 200pt at `medium` and 240pt at `expanded`+ (§10.2), radius `lg` 20. The artwork is a monochrome tile, a `Color(text)` 0.06→0.14 gradient with a heart glyph at `Color(text).alpha(0.7)`. Don't use `primary` (design system principle 2).
  - Text column: eyebrow "PLAYLIST" (`overline`), title "Loved" (`display` 34) and meta "43 surahs · 18 h 20 min" (`callout` 15, `textSecondary`).
  - Actions: **Play** (primary button, `text` background with `background` label, 44pt tall, min width 140), **Shuffle** (tinted button, `Color(text).alpha(0.06)`) and a 44pt `…` that opens a popover menu (§8).
  - Spacing: `2xl` (24) between the artwork and the text column. The actions must stay visible without scrolling (§10.2).
- **List.** Rows use `minHeight` 60 (§4.3), a 44pt thumbnail with radius `sm` (8), a `headline` (17) title, a `callout` (15) reciter line, and trailing columns for a rewayah chip (`caption`), a download icon and a duration (`footnote`, tabular digits). The `…` hit area is 44×44. Hairlines are inset to the text start.
  - Hover adds `Color(text).alpha(0.04)` and overlays a ▶ on the artwork.
  - The now-playing row uses `NowPlayingIndicator`.
  - Use `FlashList` (design system §8).
- **Toolbar** under the header: a search field (max 360pt, ⌘F), a Sort menu and a reciter filter menu, both opened as popovers.
- **Confirmation.** "Unlove all" opens an Alert: "Remove 43 surahs from Loved?"

```
medium — window 820 (732 pane, margins 24)
┌───────────────────────────────────────────────────────────┐
│ ‹ Library                                             …   │
│ ┌──────────┐  PLAYLIST                                    │
│ │    ♥     │  Loved                                       │
│ │  200pt   │  43 surahs · 18 h 20 min                     │
│ │ mono art │  [ ▶ Play ]  [ ⤨ Shuffle ]   (…)             │
│ └──────────┘                                              │
│ [⌕ Search Loved      ]                 Sort ▾  Reciter ▾  │
│ ───────────────────────────────────────────────────────── │
│ [▪] Al-Kahf  الكهف          Mishary · Hafs    ↓  48:12  … │
│ [▪] Ya-Sin   يس             Sudais  · Hafs        17:03 … │
│ [▪] Al-Mulk  الملك          Husary  · Warsh   ↓   9:41  … │
│ … (≈12 rows visible)                                      │
└───────────────────────────────────────────────────────────┘
```

### Implementation notes
- Build one `CollectionHero` component: two columns at `medium`+ and centered at `compact`. It replaces `LovedHeader`, `PlaylistHeader`, `ReciterDownloadsHeader` and the 6 inline copies. Props: `artwork | icon`, `eyebrow`, `title`, `meta`, `actions[]`, `menu`. (M)
- Add a `TrackRow` variant of `TrackItem` with ramp sizes and optional `duration` and `addedAt` columns. Add `onHoverIn`/`onHoverOut`, plus a context menu with secondary click. (M)
- `loved.tsx`: add an Alert confirmation, replace `ms(65)` with `useBottomInset()`, and drop the fake back button and sticky header at `medium`+. (S)
- Build a shared `CollectionToolbar` (search, sort, filter chips, grid/list toggle) for Loved, Downloads, Uploads, Bookmarks and Notes. (M)

---

## Favorite reciters: `/collection/favorite-reciters`

**Files:** `app/(tabs)/(c.collection)/collection/favorite-reciters.tsx`, `components/ReciterItem.tsx`, `components/SearchInput.tsx`

**What it is:** The list of followed reciters, with an "Add reciters" bar, a search field you toggle open, and a remove action on each row.

**Current iPad behavior:** A centered profile-glyph hero, then a full-width "Add reciters" bar and a vertical `ReciterItem` list. The search toggle lives in the header on glass devices and floats absolutely positioned elsewhere.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Layout & density | The phone list ignores §10.1. Apple Music Artists and Spotify Artists use avatar grids. | `favorite-reciters.tsx:272-282`, `448-461` | P1 |
| 2 | Typography / Layout | The hero, add bar and empty state inflate: title 17 → 28–33pt, add-bar text 13 → 22–25pt. | `favorite-reciters.tsx:101-153` | P0 |
| 3 | UX | Search hides behind a toggle whose position depends on glass vs non-glass. iPad has room for an always-visible field, and ⌘F should focus it (§7.3). | `favorite-reciters.tsx:44-60`, `421-446`, `373-391` | P1 |
| 4 | UX | "Add reciters" opens a multi-select picker as a full-width bottom sheet. §8 calls for a centered form sheet (max 560) at `medium`+. | `favorite-reciters.tsx:248-250` | P1 |
| 5 | Input | There is no context menu (Play, Shuffle, View, Remove), no hover, and no reordering. | `favorite-reciters.tsx:252-279` | P2 |
| 6 | UX | Tapping a reciter pushes `/reciter/{id}` inside the 720pt column instead of using a split or the full width. | `favorite-reciters.tsx:241-246` | P2 |
| 7 | Accessibility | The search toggle and the fake back button have no labels (§12). | `favorite-reciters.tsx:46-58`, `410-417` | P2 |

### Proposed iPad design
**Reference:** Apple Music iPad Library › Artists in grid mode, and Spotify Library › Artists.
- **Title and toolbar.** The title "Reciters" uses `title1` (28). The toolbar holds `+` (a form sheet, max 560, §8), a Sort popover (Name / Recently added) and a list/grid toggle. The toggle choice persists per section in MMKV.
- **Search.** The search field is always visible: 44pt tall, `body` text, max 480pt.
- **Grid.** Columns follow §10.1 with `minCard` 160, giving 3, 4 or 5 columns by class (see the scope table). Measure the container with `onLayout`, never `useWindowDimensions` alone. Each cell has:
  - a circular 1:1 avatar (`ReciterImage`)
  - the name in `headline`, up to 2 lines, centered
  - the rewayah in `footnote`, `textSecondary`
  - on hover, a 0.04 tint and a ▶ button at the bottom trailing corner (the Spotify pattern)
- **Context menu.** Play, Shuffle, View reciter, and Remove from favorites (destructive).

```
medium — window 820
┌───────────────────────────────────────────────────────────┐
│ ‹ Library                                 ⇅  ▦/☰   [+]    │
│ Reciters                                                  │
│ [⌕ Search reciters                       ]                │
│   (●●●)          (●●●)          (●●●)                     │
│   Mishary        Sudais         Husary                    │
│   Hafs           Hafs           Warsh                     │
│   (●●●)          (●●●)          (●●●)                     │
└───────────────────────────────────────────────────────────┘
(expanded: 4 columns, large: 5 columns)
```

### Implementation notes
- Add a container-measured `ReciterGrid`, shared with the Search and Home audits. (M)
- At `medium`+, keep search always visible, put `+` in `headerRight`, and present the add flow as `presentation: 'formSheet'`. (M)
- Drop the duplicated hero. A `title1` screen title is enough here, as in Apple Music. (S)

---

## Playlists: `/collection/playlists`

**Files:** `app/(tabs)/(c.collection)/collection/playlists.tsx`, `components/PlaylistItem.tsx`, sheets `create-playlist` and `playlist-context`

**What it is:** The user's playlists, with a "Create new" bar. Each row shows a tinted playlist icon, the name, the item count and a `…` button.

**Current iPad behavior:** A hero glyph, a "Create new playlist" bar, then a list. The playlist "artwork" is an 84pt tinted square with a playlist icon (`PlaylistItem.tsx:59`, `107-114`), so every playlist looks the same apart from its tint.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Visual design | Playlists have no artwork identity. Apple Music and Spotify build a 2×2 mosaic from the first four items. | `PlaylistItem.tsx:49-90` | P1 |
| 2 | Layout & density | A single-column list. Apple Music Playlists on iPad uses a grid of square cards (§10.1). | `playlists.tsx:251-264`, `377-390` | P1 |
| 3 | IA | No list-detail split. §6 names "collection (playlists left, contents right)" as a split candidate. | `playlists.tsx:201-206` (push) | P1 |
| 4 | Typography | Raw `ms` inflation in `PlaylistItem` (art 50 → 84–98pt, name 14 → 23–27pt) and in the hero. | `PlaylistItem.tsx:103-141`, `playlists.tsx:74-126` | P0 |
| 5 | UX | Create and edit use full-width bottom sheets. §8 calls for a form sheet (≤ 560) or a popover anchored to `+`. | `playlists.tsx:211-218`, `242-249` | P1 |
| 6 | Input | Tracks can't be dragged from Loved, Downloads or Search onto a playlist. No context menu, no hover. | n/a | P2 |
| 7 | Code | `ListHeaderComponent` is declared as an inline component, so it remounts on every render. | `playlists.tsx:318-350` | P2 |

### Proposed iPad design
**Reference:** Apple Music iPad Library › Playlists. At `expanded`+, Apple Music's playlist sidebar plus detail.
- **`medium`: grid.**
  - The title uses `title1`. The toolbar holds `+` (a popover form anchored to the button, with name and swatches from `CreatePlaylistSheet`), Sort and the grid/list toggle.
  - Columns follow §10.1 with `minCard` 160: 3 columns at 820 and 4 columns at 1024 (13" portrait), if a grid is preferred over the split at that size.
  - Each card is a 1:1 `PlaylistArtwork` with radius about 6% of the edge (§5.4), a `headline` name and a `footnote` count.
  - The first cell is a dashed "New Playlist" card.
- **`expanded`+: list-detail split (§6).**
  - On the leading side, a 340pt pane (380 at `large`) holds playlist rows: 48pt mosaic thumbnail, `headline` name, `footnote` count, and the selected row at alpha 0.08.
  - On the trailing side, the detail shows that playlist's content (see Playlist detail). No push.
  - At `expanded`+ the sidebar's PLAYLISTS group selects into the same split.
- **Context menu.** Play, Shuffle, Rename, Change color, and Delete (confirmed with an Alert, §8).

```
medium — window 820 (grid)
┌───────────────────────────────────────────────────────────┐
│ ‹ Library                                  ⇅  ▦/☰   [+]   │
│ Playlists                                                 │
│ ┌ ─ ─ ─ ─ ┐  ┌─────────┐  ┌─────────┐                     │
│ │    +    │  │ ▪▪ │ ▪▪ │  │  ▪▪▪▪   │                     │
│ │   New   │  │ ▪▪ │ ▪▪ │  │  ▪▪▪▪   │                     │
│ └ ─ ─ ─ ─ ┘  └─────────┘  └─────────┘                     │
│              Fajr mix     Juz Amma                        │
│              12 surahs    37 surahs                       │
└───────────────────────────────────────────────────────────┘

expanded — window 1180 (sidebar 240, split 360 | 580)
┌────────────┬───────────────────┬──────────────────────────────┐
│ sidebar    │ Playlists     [+] │ [mosaic 240] PLAYLIST        │
│            │ ▣ Fajr mix   12 ◀ │              Fajr mix        │
│            │ ▣ Juz Amma   37   │              12 surahs · 6 h │
│            │ ▣ Ramadan     5   │              [▶ Play][⤨] (…) │
│            │                   │ 1 Al-Fatiha  Mishary   0:58 …│
│            │                   │ 2 Al-Kahf    Sudais   48:12 …│
└────────────┴───────────────────┴──────────────────────────────┘
```

### Implementation notes
- Add a `PlaylistArtwork` component (mosaic, or a monochrome fallback with the playlist tint on the glyph only). It needs the first 4 reciter IDs. (M)
- Add a `PlaylistGrid` that measures its container. (M)
- Add a `SplitView` primitive (`components/layout/`) per §6 and use it for Playlists, Bookmarks and Notes at `expanded`+. Coordinate with Settings, which uses the same pattern. (M)
- Present `create-playlist` as a popover or form sheet at `medium`+ (§8). (S/M)
- Make `ListHeaderComponent` an element. (S)

---

## Downloads: `/collection/downloads`

**Files:** `app/(tabs)/(c.collection)/collection/downloads.tsx`, `components/ReciterDownloadsListItem.tsx`, `components/TrackItem.tsx`, sheets `download-options` and `collection-options`

**What it is:** Offline recitations grouped by reciter. A reciter with more than one download becomes a group row that pushes reciter-downloads. The screen has Play all, Shuffle and a "Remove all" menu.

**Current iPad behavior:** A hero glyph and Play/Shuffle squares, followed by group rows and single `TrackItem` rows mixed in one list. The screen shows no storage figures, no sizes and no in-progress items.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | UX | "Remove all downloads" runs with no confirmation and no size shown (§8). | `downloads.tsx:67-84`, `CollectionOptionsSheet.tsx:84-86` | P0 |
| 2 | UX / IA | Two row types share one list (a reciter group and a single track), which makes the list hard to scan. | `downloads.tsx:282-310`, `590-622` | P1 |
| 3 | Information | File sizes and total storage never appear, although `DownloadedSurah.fileSize` exists (`loved.tsx:477`). | `downloads.tsx:538-541` | P1 |
| 4 | Typography / Layout | The hero and buttons inflate, and the hero is duplicated. | `downloads.tsx:108-252` | P0 |
| 5 | UX | No "in progress" section: only finished items appear. | `downloads.tsx:59` | P2 |
| 6 | Input | No multi-select Edit mode. The unused swipe styles in `_styles.ts:203-220` suggest swipe-to-delete was planned, but swipe-only would break §7.2. | as cited | P2 |

### Proposed iPad design
**Reference:** Apple Music Library › Downloaded, plus the iPad Storage usage bar in Settings.
- **Title and toolbar.** `title1` "Downloads". The toolbar holds Edit (multi-select), a Sort popover (Reciter / Surah / Size / Date) and `…` (Remove all, confirmed with an Alert that states the count and size).
- **Summary card.** Radius `card` 14 with card background alpha 0.04. It shows "61 surahs · 3.2 GB" in `headline`, a 4pt usage bar (radius `xs`) against free space with a `footnote` caption, and the Play and Shuffle buttons.
- **Segmented control** (`TabSelector`): `By reciter | All surahs`.
  - **By reciter** is a `ReciterGrid` (§10.1) whose caption gives the count and size.
  - **All surahs** is a `TrackRow` list with a size column. Rows remove through the `…` menu, context menu or Edit mode, with swipe as an extra (§7.2).
- **In progress.** This section appears only while downloads are active, with an inline `CircularProgress` and Cancel.

```
medium — window 820
┌───────────────────────────────────────────────────────────┐
│ ‹ Library                             Edit   ⇅   …        │
│ Downloads                                                 │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ 61 surahs · 3.2 GB              [▶ Play] [⤨ Shuffle]  │ │
│ │ ███████░░░░░░░░░░░░░░░░░░░░  3.2 GB of 41 GB free     │ │
│ └───────────────────────────────────────────────────────┘ │
│       [ By reciter | All surahs ]                         │
│   (●●●)          (●●●)          (●●●)                     │
│   Mishary        Sudais         Husary                    │
│   24 · 1.1 GB    12 · 640 MB    9 · 410 MB                │
└───────────────────────────────────────────────────────────┘
```

### Implementation notes
- `downloads.tsx`: add the confirmation, a storage summary (sum of `fileSize` plus free space from `expo-file-system`) and the segmented view. Drop the mixed rows. (M)
- Reuse `ReciterGrid` and `TrackRow`, and add an Edit/multi-select mode to `TrackRow`. (M)
- Delete the unused swipe styles in `collection/_styles.ts`. (S)

---

## Reciter downloads: `/collection/reciter-downloads/[reciterId]`

**Files:** `app/(tabs)/(c.collection)/collection/reciter-downloads/[reciterId].tsx`, `components/reciter-downloads/ReciterDownloadsList.tsx`, `components/playlist-detail/ReciterDownloadsHeader.tsx`, `components/SurahItem.tsx`

**What it is:** The downloaded surahs of one reciter, with a photo hero, Play/Shuffle and an options menu on each row.

**Current iPad behavior:** The reciter photo is 80pt in code but renders at 125–157pt. Below it are a title, buttons and a `SurahItem` list. The route forces `StatusBar barStyle="light-content"`.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Visual / Accessibility | The status bar is forced to `light-content`, so in light themes it is white on white and invisible (§12 contrast). | `reciter-downloads/[reciterId].tsx:15` | P0 |
| 2 | Typography / Layout | The header inflates: photo 80 → 125–157pt, title 17 → 28–33pt, buttons 42 → 66–82pt. The photo's 6pt radius reads as a thumbnail rather than a hero. | `ReciterDownloadsHeader.tsx:141-185` | P0 |
| 3 | Layout | Same phone list, with an `ms(65)` bottom pad. | `ReciterDownloadsList.tsx:86-103` | P2 |
| 4 | UX | Largely duplicates `reciter/[id]` with a different header style. It could be a "Downloaded only" filter on the reciter page instead. | `ReciterDownloadsList.tsx:412`, `474` | P2 |
| 5 | Input | No context menu, hover or multi-select. | `ReciterDownloadsList.tsx:344` | P2 |

### Proposed iPad design
**Reference:** The Apple Music iPad album page (§10.2).
- **Header.** Use `CollectionHero` in two columns: a circular reciter photo (200pt at `medium`, 240pt at `expanded`+), the eyebrow "DOWNLOADED" (`overline`), the name (`display` 34), meta "24 surahs · 1.1 GB · Hafs" (`callout`), and Play, Shuffle and `…` (Remove all, confirmed with an Alert).
- **Track list.** Use the album-style `TrackRow`: a leading surah number (`callout`, tabular, 28pt wide), a `headline` name with glyph, a trailing Arabic name, size and duration, and `…`. Rows have no per-row artwork, because the reciter is the same throughout.
- **Status bar.** Remove the forced StatusBar so `style="auto"` follows the theme.

### Implementation notes
- Delete `<StatusBar barStyle="light-content" />` at `[reciterId].tsx:15`. (S, do now)
- Replace `ReciterDownloadsHeader` with `CollectionHero`, and add an album variant to `TrackRow`. (M)
- Consider a "Downloaded" filter on `reciter/[id]` and coordinate with the reciter audit. (M)

---

## Uploads: `/collection/uploads`

**Files:** `app/(tabs)/(c.collection)/collection/uploads.tsx`, `utils/importAudio.ts`, `store/uploadsStore.ts`, sheets `upload-options` and `organize-recitation`

**What it is:** Audio the user imported (surah recitations, salah recordings, other), with Play all, Shuffle, Import, and an organize/options flow for each item.

**Current iPad behavior:** A hero, Play/Shuffle, an "Upload" bar, then a custom `UploadListItem` list (a near-copy of `TrackItem`) with tag chips.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | UX | "Remove all uploads" deletes every imported recording file with no confirmation. The files can't be recovered (§8). | `uploads.tsx:303-318`, `store/uploadsStore.ts:163-170` | P0 |
| 2 | Input | Files can't be dragged and dropped onto Uploads. This matters most once multitasking is enabled (§11). | `uploads.tsx:346-359` | P1 |
| 3 | Typography | Base sizes sit below the ramp: tags at 9pt, tertiary text at 10pt (the §4.1 floor is `caption` 11/12). Raw `ms` then inflates them to 15–20pt on iPad. | `uploads.tsx:830-896` | P1 |
| 4 | Code / consistency | `UploadListItem` re-implements `TrackItem`, and each row subscribes to the whole `queue.tracks` array. | `uploads.tsx:141-275` | P2 |
| 5 | UX | No filtering by type, recording type, category or "untagged", even though the data has all of these fields. | `uploads.tsx:94-131` | P1 |
| 6 | Layout | Duplicated hero and an `ms(65)` bottom pad. | `uploads.tsx:650-750` | P2 |

### Proposed iPad design
**Reference:** Spotify Local Files, Apple Music filter chips, and the Files app drop target.
- **Title and toolbar.** `title1` "Uploads". The toolbar holds Import (`+`), Sort and `…`. Remove all opens an Alert: "Delete 4 recordings? This removes the audio files from this iPad."
- **Filter chips.** `All · Surahs · Salah · Studio · Other · Untagged`. Chips are 32pt tall (44pt hit area), `callout` text, `pill` radius, background alpha 0.06 and alpha 0.08 when selected, with the gutter between them.
- **List.** An upload variant of `TrackRow`, with tag chips (`caption`) and a duration column. Untagged rows get an inline "Organize" button (a tinted button using text-derived alpha, not `primary`).
- **Drop target.** The whole list accepts audio drops. While dragging, a dashed 2pt outline (`Color(text).alpha(0.3)`, radius `card`) appears with the label "Drop audio to import".
- **Empty state.** A card centered at max 560pt with "Import from Files" (primary button) and "or drag audio files here".

### Implementation notes
- Add the confirmation now. Later, add a "Recently deleted" soft delete. (S, then M)
- Fold `UploadListItem` into `TrackRow`, and select only the current track id from the store. (M)
- Add the chips through `CollectionToolbar`. (S)
- Add a native drop interaction (a small Expo module wrapping `UIDropInteraction`). (L)

---

## Bookmarks: `/collection/bookmarks`

**Files:** `app/(tabs)/(c.collection)/collection/bookmarks.tsx`, `components/collection/BookmarkItem.tsx`, `components/collection/CollectionVersePreview.tsx`, `components/share/SkiaVersePreview.tsx`

**What it is:** Saved verses shown as cards. Each card has a top bar (verse pill, rewayah pill, surah glyph, `…`) and a Skia-rendered Arabic preview. Tapping a card opens the Mushaf.

**Current iPad behavior:** Cards span the full 720pt column with a 27–31pt margin and a 33–39pt radius. The chrome inflates (pill text about 20pt, glyph 37–43pt), but the Arabic stays at a fixed 22pt (`CollectionVersePreview.tsx:256`, `SkiaVersePreview.tsx:119`). The decoration therefore outweighs the Quran text. Tapping a card pushes the full-screen `/mushaf`, so the user leaves the list.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Typography / Visual | The hierarchy is inverted. Chrome inflates (pill 12 → 20–24pt, glyph 22 → 37–43pt, radius 20 → 33–39pt), but the Arabic stays at 22pt, well below the §4.2 tablet Quran default of 32. Tarteel and Quran.com make the Arabic the largest element. | `BookmarkItem.tsx:117-183`, `CollectionVersePreview.tsx:256` | P0 |
| 2 | Layout | The preview spans the whole card (about 650pt) and only 3–4 cards are visible. The reading column has no max width set (§4.2 says 680). | `BookmarkItem.tsx:97-105`, `180-183` | P1 |
| 3 | UX / IA | Opening a bookmark replaces the screen with the Mushaf, so browsing many bookmarks means opening and closing repeatedly. §6 calls for a split. | `bookmarks.tsx:106-131` | P1 |
| 4 | UX | No grouping (by surah or juz), no sort (Mushaf order / recent) and no search. | `bookmarks.tsx:70-91` | P1 |
| 5 | UX | Remove happens immediately, with no undo. | `bookmarks.tsx:99-103`, `146-151` | P2 |
| 6 | Typography | The hero title is 22 here and 17 on the other 7 screens. | `bookmarks.tsx:365-371` vs `favorite-reciters.tsx:122-129` | P2 |
| 7 | Input | Long-press opens a sheet. There is no context menu (Open, Play from here, Share, Copy, Remove), no hover and no ↑/↓ (§7). | `BookmarkItem.tsx:57-60`, `84-93` | P1 |
| 8 | Accessibility | The card has no combined label, and the Skia preview is invisible to VoiceOver (§12). | `BookmarkItem.tsx:57-106` | P1 |

### Proposed iPad design
**Reference:** Quran.com and Tarteel bookmark lists, combined with Apple Notes/Mail list-detail.
- **`medium`: single list, which fits the reading column.**
  - Cards sit in a centered column, max 680 wide (§4.2/§5.3).
  - The chrome uses ramp sizes: a `footnote` verse pill, a `caption` rewayah chip, a 24pt surah glyph, a 44pt `…` target and `card` radius 14.
  - The Arabic preview uses the user's tablet Quran size (default 32, §4.2), clamped to 3 lines.
  - Tapping still opens the Mushaf. Rows group by surah under `overline` sticky headers, with Sort and Search in the toolbar.
- **`expanded`+: list-detail split (§6).**
  - On the leading side, a 340pt list (380 at `large`) of compact rows: the surah glyph, "Al-Kahf · 18:10" (`headline`), a one-line Arabic snippet, the rewayah chip and the saved date (`footnote`). Rows sit under per-surah `overline` headers.
  - The trailing detail (≥ 420) shows the verse in context inside a 680-capped reading column:
    - the Arabic at the reading size (default 32)
    - the translation at 18 / 1.55× line height
    - the actions Open in Mushaf, Play from this ayah, Share and Remove (44pt buttons)
    - the previous and next ayah dimmed to 60%, as Tarteel does
- **Undo.** Remove shows a 4s undo toast.
- **Keyboard (§7.3).** ↑/↓ moves the selection, Return opens, ⌫ removes with undo, ⌘F searches.

```
medium — window 820 (single list, 680 reading column)
┌───────────────────────────────────────────────────────────┐
│ ‹ Library                                   ⇅   ⌕         │
│ Bookmarks                                                 │
│ AL-KAHF                                                   │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ 18:10 · Hafs ─────────── ۝ ─────────────────────  …  │  │
│ │      إِذْ أَوَى الْفِتْيَةُ إِلَى الْكَهْفِ فَقَالُوا…  (32pt)   │  │
│ └──────────────────────────────────────────────────────┘  │
│ YA-SIN                                                    │
│ ┌──────────────────────────────────────────────────────┐  │
└───────────────────────────────────────────────────────────┘

expanded — window 1180 (sidebar 240, split 360 | 580)
┌────────────┬──────────────────────────┬────────────────────────────┐
│ sidebar    │ Bookmarks        ⇅  ⌕    │   ﴿ إِذْ أَوَى الْفِتْيَةُ ... ﴾  │
│            │ AL-KAHF                  │      (Quran 32, Skia)      │
│            │ ▌۝ Al-Kahf · 18:10  Hafs │ "When the youths retreated │
│            │ │ إِذْ أَوَى الْفِتْيَةُ…       │  to the cave…" (18/1.55)   │
│            │ ۝ Al-Kahf · 18:65        │ [Open in Mushaf] [▶ Play]  │
│            │ YA-SIN                   │ [Share] [Remove]           │
│            │ ۝ Ya-Sin · 36:58  Warsh  │ …18:9 (dimmed) / 18:11 …   │
└────────────┴──────────────────────────┴────────────────────────────┘
```

### Implementation notes
- Use the shared `SplitView` (§6) at `expanded`+. (M)
- Add a `BookmarkRow` compact variant. Make `CollectionVersePreview` accept `fontSize` and `maxWidth`; today it hard-codes 22 (`CollectionVersePreview.tsx:256`) and 18/34 (`:235-239`). (M)
- Build the detail pane from `SkiaVerseText` and the translation services used by the player QuranView. (M)
- Add the undo toast via `utils/toastUtils.ts` (already imported at `bookmarks.tsx:30`). (S)
- Add an `accessibilityLabel` from `savedVerseLabel` plus the surah name. (S)

---

## Notes: `/collection/notes`

**Files:** `app/(tabs)/(c.collection)/collection/notes.tsx`, `components/collection/NoteItem.tsx`, sheet `verse-note`

**What it is:** Verse notes shown as cards: a top bar, the Arabic preview, and a 2-line italic centered preview of the note. Tapping a card opens the note for editing in the `verse-note` bottom sheet.

**Current iPad behavior:** The same card system as Bookmarks. The note text renders italic and centered at 22–25pt, clamped to 2 lines. Editing happens in a bottom sheet laid over the list, and there is no way to open the verse in the Mushaf.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Typography | The note preview is centered and italic. Personal writing reads badly centered, and the italic is a synthesized oblique because Manrope ships no italic. | `NoteItem.tsx:221-228` | P1 |
| 2 | UX / IA | Notes are edited in a full-width bottom sheet. §8 calls for a form sheet at `medium` and a trailing side panel or split detail at `expanded`+. | `notes.tsx:96-110` | P1 |
| 3 | UX | A note can't jump to its verse in the Mushaf. The options are only Edit and Delete. | `notes.tsx:113-139` | P1 |
| 4 | UX | Delete note runs immediately, with no confirmation or undo. | `notes.tsx:129-134` | P1 |
| 5 | Layout / Typography | The same inflated chrome and fixed 22pt Arabic as Bookmarks. | `NoteItem.tsx:145-220` | P0 |
| 6 | UX | Note text can't be searched, sorted or grouped. | `notes.tsx:297-310` | P1 |
| 7 | Input | No ⌘F, no ↑/↓, no Esc to close the editor, no context menu. | n/a | P2 |

### Proposed iPad design
**Reference:** Apple Notes on iPad, plus Tarteel reflections.
- **`medium`.** A single list, max 680. Each row shows "Al-Baqarah · 2:255" (`headline`), the first lines of the note (`body`, 2 lines, **leading-aligned, not italic**), a `footnote` date and a rewayah chip, with a search field at the top. Tapping a row opens the editor as a **form sheet, max 560** (§8).
- **`expanded`+.** Use the `SplitView`. On the leading side, the note list (340/380). The detail holds the verse card at the top (Arabic at the reading size, default 32), then an editable note body in a 680 reading column: `TextInput` multiline, 18pt at 1.6× line height, matching the §4.2 long-form defaults. The body autosaves and shows a "Saved" status. The toolbar holds Open in Mushaf, Share and Delete, with an Alert to confirm Delete.
- **Shared editor.** Phone sheet, tablet form sheet and split detail all render the same `VerseNoteEditor`.
- **Keyboard.** ⌘F searches, ↑/↓ moves through notes, Esc returns focus to the list.

```
expanded — window 1180 (sidebar 240, split 360 | 580)
┌────────────┬──────────────────────────┬────────────────────────────┐
│ sidebar    │ Notes            ⌕  ⇅    │ Open in Mushaf  Share  🗑   │
│            │ [⌕ Search notes     ]    │ ┌────────────────────────┐ │
│            │ Al-Baqarah · 2:255  Hafs │ │ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ…  │ │
│            │ Remember to recite after…│ │       (Quran 32)       │ │
│            │ Oct 21                   │ └────────────────────────┘ │
│            │ ──────────────────────── │ Remember to recite after   │
│            │ Al-Kahf · 18:10-12       │ every salah. The verse…    │
│            │ The youths sought refuge…│ (18 / 1.6, autosave)       │
└────────────┴──────────────────────────┴────────────────────────────┘
```

### Implementation notes
- Extract `VerseNoteEditor` from `components/sheets/VerseNoteSheet.tsx`. (M/L)
- In `NoteItem.tsx`, align the preview leading (`textAlign: 'auto'`) and drop the italic. Add a compact row variant. (S)
- Add "Open in Mushaf" through a shared `openSavedVerse()` util extracted from `bookmarks.tsx:106-131`. (S)
- Add delete confirmation and note-body search. (S)

---

## Playlist detail: `/(c.collection)/playlist/[id]`

**Files:** `app/(tabs)/(c.collection)/playlist/[id].tsx`, `components/playlist-detail/PlaylistDetail.tsx`, `components/playlist-detail/PlaylistHeader.tsx`, `components/TrackItem.tsx`

**What it is:** One user playlist: a header (icon, name, count, Play/Shuffle, options) above its tracks.

**Current iPad behavior:** The same centered-glyph hero and `TrackItem` list as Loved. While loading, the screen shows a bare "Loading" text with no header (`PlaylistDetail.tsx:425-431`). The tracks can't be reordered.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | UX | No reordering. `reorderPlaylistItems` is implemented (`hooks/usePlaylists.ts:27`, `services/playlist/PlaylistService.ts:131`), but no UI calls it. | `PlaylistDetail.tsx:404-451` | P1 |
| 2 | Visual design | No artwork: the same grey glyph circle as every other screen. | `PlaylistHeader.tsx:130-147` | P1 |
| 3 | Typography / Layout | The header and rows inflate, plus an `ms(65)` bottom pad. | `PlaylistHeader.tsx:108-185`, `PlaylistDetail.tsx:82` | P0 |
| 4 | UX | The loading state has no back affordance on non-glass devices (§6 requires one). An empty playlist shows a text line with no call to action. | `PlaylistDetail.tsx:425-444` | P2 |
| 5 | Input | No drag and drop, no context menu, no hover, no Space/Return. | `PlaylistDetail.tsx:412-421` | P2 |
| 6 | Code | A missing `id` renders `null`, leaving a blank screen. | `playlist/[id].tsx:8-10` | P2 |

### Proposed iPad design
**Reference:** The Apple Music iPad playlist page (§10.2).
- **Header.** A two-column `CollectionHero`: `PlaylistArtwork` (200 at `medium`, 240 at `expanded`+), eyebrow "PLAYLIST", the name (`display`; at `medium`+ tap to rename), meta "12 surahs · 6 h 4 min · Updated Oct 20" (`callout`), and Play, Shuffle and `…`.
- **Placement.** At `expanded`+ this is the detail pane of the Playlists split. At `medium` it is a pushed screen.
- **Edit mode.** The toolbar has an Edit toggle. In edit mode, rows show a leading `≡` handle (44pt target) and a trailing remove button. Dropping calls `reorderPlaylistItems`. A visible "Move up/down" menu item gives pointer and VoiceOver users the same capability (§7.2).
- **Rows.** `TrackRow` with duration, rewayah chip and download state.
- **Empty state.** An "Add surahs" button that opens a picker form sheet (max 560, §8).

### Implementation notes
- Build the reorder UI on `reorderPlaylistItems` (`react-native-draggable-flatlist` or a Reanimated sortable). (M)
- Replace `PlaylistHeader` with `CollectionHero` and `PlaylistArtwork`. (M)
- Add skeleton header, back button and call to action for the loading and empty states. Show an error state when `id` is missing. (S)

---

## Shared: `useCollectionNativeHeader` and header chrome

**Files:** `hooks/useCollectionNativeHeader.tsx`, `components/collection/CollectionStickyHeader.tsx`, `app/(tabs)/(c.collection)/_layout.tsx`

**What it is:** On glass devices (iOS 26+), the hook sets a native header and fades its title in after 80–120pt of scroll. On non-glass devices, each screen renders a fake back button plus `CollectionStickyHeader`.

**Current iPad behavior:** On glass devices, the header is transparent and the back title is empty (`headerBackTitle: ' '`, `_layout.tsx:20-22`). The title is a fixed 17pt `Animated.Text`. On non-glass devices, a Feather `arrow-left` and two header layers cross-fade.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | UX / HIG | No large titles: the hero acts as the title, at inflated and inconsistent sizes. The 120pt fade threshold is a phone value. The inflated hero is about 200pt tall, so the inline title appears while the hero is still visible. | `useCollectionNativeHeader.tsx:20`, `33-36` | P1 |
| 2 | UX | The back button shows no title. iPad has room for "‹ Library". | `_layout.tsx:20-22` | P2 |
| 3 | Visual | The non-glass path uses a Material `arrow-left` with a 36pt base hit area. | `CollectionStickyHeader.tsx:56-66`, `95-99` | P2 |
| 4 | Layout | The header sits inside the 720pt `MaxWidthContainer`, so the bar stops at the column edges. §5.3 says to move the cap into the screens. | `_layout.tsx:28` | P1 |
| 5 | Input / Accessibility | `headerRight` icons are bare `Pressable` + `Feather` with `hitSlop` 8. They have no hover state and no label (§7.2, §12). | `loved.tsx:569-580`, `favorite-reciters.tsx:44-60` | P2 |

### Proposed iPad design
- **Large titles.** Use native large titles at `medium`+ (`headerLargeTitle: true`, Manrope through `headerLargeTitleStyle`), and drop the title text from heroes that only repeat it. See the proposed changes about large-title size.
- **Container.** Remove `MaxWidthContainer` from `_layout.tsx` (§5.3). Grids then run full width inside the margins, and the list and reading screens apply their own caps (680 reading, 640 forms).
- **Back title.** At `medium`+, `headerBackTitle` shows the previous screen's title.
- **Header buttons.** One `HeaderIconButton` component: a 44×44 target, `accessibilityLabel` and role, `onHoverIn` 0.04 tint, and a `UIMenu` for `…`.
- **Fade threshold.** Derive it from the measured hero height.

### Implementation notes
- `hooks/useCollectionNativeHeader.tsx`: large title at `medium`+, measured threshold. (S/M)
- `_layout.tsx`: remove `MaxWidthContainer`, set the back title. (M, cross-cutting with the shell audit)
- Retire `CollectionStickyHeader` and the 9 fake back buttons by making the native header the default on non-glass devices too. (M)

---

## Components and cleanup for this tab

- **Create once:**
  - `CollectionHero` (§10.2)
  - `TrackRow`, with default, album-numbered, upload and edit/reorder variants
  - `ReciterGrid` and `PlaylistGrid` (§10.1, container-measured)
  - `PlaylistArtwork`
  - `CollectionToolbar` (search, sort, chips, grid/list toggle)
  - `SplitView` (§6)
  - `HeaderIconButton`
  - `VerseNoteEditor`
  - `openSavedVerse()`
- **Migrate:** every file in scope from `react-native-size-matters` to `@/utils/scale` and ramp roles (§3, §4.1), and `RNAnimated.FlatList` to `FlashList` where the scroll-driven header allows it.
- **Delete:**
  - `components/CollectionView.tsx`
  - `components/collection/{CollectionGrid,CollectionHeader,FilterBar,PlaylistModal,SectionHeader}.tsx`
  - both `_styles.ts` files in the collection route
  - the duplicated hero styles in 6 screens
  - the per-screen fake back headers and empty-state headers
- **Update:** `docs/design/screen-inventory.md:83-89`.

## Proposed changes to the standard

1. **Destructive actions.** §8 names an Alert for "destructive confirmation" but never says *when* one is required. Add: "**MUST** confirm any bulk or irreversible delete (remove all, delete files, unlove all) with an Alert that states the count, and the size where relevant. **SHOULD** give single-item removals a 4s undo toast instead of a confirm." Today's Library code violates this in 5 places.
2. **Sidebar sub-sections.** §6 defines the sidebar only as tab destinations. Add: "At `expanded`+ the labeled sidebar **MAY** show collapsible sub-sections under a tab (Library: Playlists, Reciters, Loved, Downloads, Uploads, Bookmarks, Notes; plus a user-playlists group, max 8 then 'Show all'), styled with the `overline` header and the selected/hover tokens. The rail (`medium`) shows tabs only." This is the Apple Music iPadOS 18 pattern.
3. **Header artwork size at `medium`.** §10.2 defines the two-column header only at `expanded`+ (240–280). At `medium` (684pt of content on 11"), a centered phone hero wastes space while a 240pt image squeezes the text column. Propose: "`medium`: two-column header with 200pt artwork."
4. **Large-title size.** §4.1 sets screen titles to `title1` 28, but iOS native large titles (`headerLargeTitle`) default to 34, the `display` size. Decide which applies to native large titles. The proposal is `display` 34 for native large titles, with `title1` 28 kept for custom in-content titles.
5. **Avatar grid density.** With `minCard` 160 (§10.1), the Reciters and Downloads › By reciter grids show only 3 avatars per row at 820pt. Apple Music shows about 4. Propose `minCard` 140 for circular reciter avatars in Library grids, which gives 4 at `medium` (684 content), 5 at 1180 and 6 at 1366. Keep 160 for square cards.
6. **Quran preview text in lists.** §4.2 covers reading views but not the Arabic previews in bookmark, note or search rows. Propose: "Inline verse previews use the user's Quran size × 0.8 (tablet default ≈ 26), max 3 lines; one-line snippets in dense rows use 20. Previews never exceed the 680 reading column."
7. **Accent colors on hub tiles.** The Library hub's per-section hex colors conflict with design-system principle 2. Either ban them (the default in this proposal is monochrome tiles) or add a documented `collectionAccent` palette in the design system's special-purpose palettes. Product needs to choose.
8. **Bottom padding for docked player.** Add to §10.3: "**MUST NOT** add fixed bottom padding for the floating player. Use `useBottomInset()`, which returns the right value for docked and floating players." Today 7 Library screens hard-code `moderateScale(65)`.
