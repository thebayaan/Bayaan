# iPad audit: Search & Surahs tabs

> **Scope:** the Search tab root (`app/(tabs)/(b.search)/index.tsx`: Explore bento + search mode), the system playlist detail (`app/(tabs)/(b.search)/system-playlist/[id].tsx`) and the Surahs tab root (`app/(tabs)/(b.surahs)/index.tsx`). Reciter profile, `browse-all` and `browse-all-surahs` are covered in another audit.
> **Files read:** `app/(tabs)/_layout.tsx`, `app/(tabs)/(b.search)/{_layout,index,_styles}.tsx|ts`, `app/(tabs)/(b.search)/system-playlist/[id].tsx`, `app/(tabs)/(b.surahs)/{_layout,index}.tsx`, `components/search/{SearchView,ExploreView}.tsx`, `components/SearchBar.tsx`, `components/SearchInput.tsx`, `components/system-playlist/{SystemPlaylistDetail,SystemPlaylistHeader}.tsx`, `components/SurahsView.tsx`, `components/SurahItem.tsx`, `components/cards/SurahCard.tsx`, `components/hero/ContinueReadingHero.tsx`, `components/ReciterItem.tsx` (sizes only), `components/TrackItem.tsx` (sizes only), `components/tablet/TabletSidebar.tsx`, `components/layout/MaxWidthContainer.tsx`, `hooks/useBottomInset.ts`, `utils/scale.ts`, `data/systemPlaylists.ts`.
> **Date:** 2026-10-26. This is a static code audit. No simulator was available in this Linux container, so items marked *(verify)* still need a screenshot on an iPad (iPadOS 26) to confirm.

**Standards.** Proposals follow [the iPad standards](../ipad-standards.md) and cite rules as §N. Layout is chosen by **width class**, measured on window width (§2): `compact` < 600, `medium` 600–899, `expanded` 900–1279, `large` ≥ 1280. Page margins and gutters come from §5.2 (16/12, 24/16, 32/20, 40/24). Content widths come from §5.3: grids and search results uncapped, forms 640, sheets 560, reading 680. Text uses the §4.1 type roles. Grid columns use the §10.1 formula `columns = max(2, floor((paneWidth + gutter) / (minCard + gutter)))`, where `paneWidth` is the window width minus the sidebar (§6) minus the page margins.

**Worked pane widths used below** (sidebar 88 at `medium`, 240 at `expanded`, 280 at `large`, per §6):

| Example window | Class | Pane after sidebar and margins | Gutter |
|---|---|---|---|
| iPad Pro 11" portrait, 834 | medium | 834 − 88 − 48 = **698** | 16 |
| iPad Air 11" landscape, 1180 | expanded | 1180 − 240 − 64 = **876** | 20 |
| iPad Air 13" portrait, 1024 | expanded | 1024 − 240 − 64 = **720** | 20 |
| iPad Air 13" landscape, 1366 | large | 1366 − 280 − 80 = **1006** | 24 |

**What it looks like today.** In portrait on an 11" iPad, `MaxWidthContainer` caps every screen in this group at **720 pt**. In landscape (only possible once the orientation lock is lifted) it is still **720 pt, with ~117 pt of empty gutter on each side**. `react-native-size-matters` `moderateScale(x)` resolves to about **1.7x** on an 11" and **2.0x** on a 13" iPad. Plain `scale(x)` (full factor) resolves to about **2.4x / 2.9x**.

---

## Summary

1. **Every surface in this group keeps the phone layout inside a 720 pt column, with fonts and controls inflated by raw `moderateScale` (P0/P1).** Explore stays a fixed 2-column bento. Surah cards come 2 per row, which means 57 rows to scroll. Surah rows are a single full-width column. The playlist header is centred phone text. The 720 pt cap stops lines getting too long, but these are grid and browse surfaces, so the cap only shrinks them, and the 1.7–2x type inflation cancels out the density gained. See `ExploreView.tsx:305-317`, `SurahsView.tsx:86-94,352-360`, `SurahCard.tsx:208-212`, `SystemPlaylistHeader.tsx:212-228`.
2. **Search activation and state on tablet are unreliable (P1).** The native `Stack.SearchBar` is mounted and unmounted by a focus effect that only exists for the iOS 27 phone `UISearchTab` (`index.tsx:31-47`). On tablet the shell is the JS `TabletSidebar`, so that workaround does nothing useful. It also unmounts the bar every time a result is pushed, while `query` / `isSearchActive` stay set. On return you likely see results for a query the empty field no longer shows *(verify)*. Nothing focuses the field from the sidebar, and there is no ⌘F.
3. **Search results are one undifferentiated list (P1).** Surahs and reciters are interleaved by fuzzy score in a single phone-row column (`SearchView.tsx:345-365, 508-560`). There is no Top Result, no grouping, no scope control and no grid. Apple Music and Spotify on iPad both lead with a Top Result card and then group results by type.
4. **The Surahs tab is a phone index, not a Quran index (P1).** It has no title, no search or jump-to-surah, and no Juz view as a peer of Surah (Juz headers only appear in list mode with numeric sort, `SurahsView.tsx:83-84`). The hero is 150 pt × 1.7 ≈ 255 pt tall, fixed at import time (`ContinueReadingHero.tsx:16`). Sort is three loose pills plus an unlabelled grid/list glyph (`SurahsView.tsx:215-273`). Tarteel and Quran.com on iPad open on a dense multi-column Surah/Juz index with search at the top.
5. **No pointer, keyboard or context-menu affordances anywhere (P1).** On the Surahs tab, *tap opens the Mushaf and long-press starts audio* (`(b.surahs)/index.tsx:21-33`). That split is invisible, and with a trackpad it is effectively unreachable. Surah cards, bento tiles, search results and playlist rows have no hover state and no `contextMenu`. Every secondary action goes through bottom action sheets.

Also found (not iPad-specific, but in scope and worth fixing while here):
- In search mode, long-pressing a surah with the *use default reciter* setting **navigates to `/player` without starting playback** (`SearchView.tsx:318-323`). The Surahs tab correctly calls `playWithReciter` (`(b.surahs)/index.tsx:55-61`). The search path also has no `randomReciter` case, so it falls through to the sheet.
- `components/SearchBar.tsx` has no importers. It is dead code and should be deleted so nobody copies it.
- The Quick Listen and Juz Amma tiles set `subtitle` to the same i18n key as `title`, so the tile shows its name twice (`data/systemPlaylists.ts:72, 235`).

---

## Search tab: Explore (browse mode) — `/(tabs)/(b.search)`

**Files:** `app/(tabs)/(b.search)/_layout.tsx`, `app/(tabs)/(b.search)/index.tsx`, `components/search/SearchView.tsx` (browse layer), `components/search/ExploreView.tsx`, `data/systemPlaylists.ts`, `app/(tabs)/_layout.tsx` (search tab comment, `TabletTabs`).
**What it is:** the Search tab's resting state. A 2-column masonry of 14 tiles (2 Browse All tiles + 12 system playlists) under a native search bar.
**Current iPad behavior:** `TabletTabs` renders JS `Tabs` with the sidebar. The search stack is wrapped in `MaxWidthContainer`, so the native header and its search bar live inside the 720 pt column. On glass devices (iPadOS 26) `index` shows a transparent header with an empty title and a `Stack.SearchBar placement="automatic"` with `hideNavigationBar`. `ExploreView` measures its own width on tablet, which is good, then lays out exactly two columns. Each tile is ~340 pt wide and `moderateScale(80)` ≈ 136–160 pt tall. On glass the tile colour is dropped entirely and the material carries the card, so the page is 14 near-identical grey glass slabs with a text label in the corner.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Layout & density | The column count is hard-coded at 2 whatever the width. The masonry is two fixed `left`/`right` stacks with an explicit order, so it cannot reflow to 3–5 columns. | `ExploreView.tsx:105-121, 305-317, 385-388`; `data/systemPlaylists.ts:31-33` (`column`, `order` baked into data) | P1 |
| 2 | Layout & density | A browse grid is boxed into the 720 pt reading column, leaving ~117 pt gutters on each side in landscape. Apple Music Browse runs edge to edge (minus margins) on iPad. | `(b.search)/_layout.tsx:23` | P1 |
| 3 | Sizing | Horizontal padding uses size-matters `scale()` (full factor, not moderate). `scale(16)` ≈ 38 pt on an 11" and 47 pt on a 13" iPad. Tile height, gap, radius and padding all use raw `moderateScale`. `CARD_GAP` and `OUTER_RADIUS` are computed once at module load. | `ExploreView.tsx:11, 30, 129, 306, 315, 320`; `tileInnerStyles` `:245, 261, 267` | P1 |
| 4 | Typography | Tile titles are `moderateScale(14/16)` ≈ 24–31 pt Bold, subtitles ≈ 20–24 pt. That is display size on a label tile, and inconsistent with `theme.typography` (capped at 430 pt) used elsewhere. | `ExploreView.tsx:148-149` | P1 |
| 5 | Visual design | With `USE_GLASS` the tile's `backgroundColor` is never used, so every tile is the same grey glass with no colour, artwork or icon. On a large canvas this reads as an empty wireframe. Apple Music, Spotify and Tarteel browse tiles all use colour plus artwork for wayfinding. | `ExploreView.tsx:142-145, 189-205` (colour only reaches the non-glass border) | P1 |
| 6 | Visual design | Duplicate text: Quick Listen and Juz Amma use their title key as the subtitle. | `data/systemPlaylists.ts:72, 235` | P2 |
| 7 | UX & interaction | No page title. The header title is `''`, so on iPad there is no "Search" large title anchoring the page. Apple Music iPad Search shows a large title, then the field, then "Browse Categories". | `(b.search)/_layout.tsx:38` | P2 |
| 8 | UX & interaction | Tiles mix two kinds of thing, *navigation* (Browse All Reciters/Surahs) and *content* (playlists), in one undifferentiated masonry with no section headers. | `ExploreView.tsx:46-100` | P2 |
| 9 | Input | Tiles are `Link` + `Pressable` with no hover effect (`onHoverIn` / pointer lift), no `contextMenu` (Play, Shuffle, Open) and no keyboard focus ring. | `ExploreView.tsx:189-227` | P1 |
| 10 | Accessibility | Tiles have no `accessibilityRole`/`accessibilityLabel`. VoiceOver reads the raw text and has no hint that the tile opens a playlist. | `ExploreView.tsx:191-224` | P2 |
| 11 | Layout | `tilesReady` blocks rendering on tablet until the first `onLayout`, so the first frame is blank. This is acceptable, but it disappears once layout is container-driven (see below). | `ExploreView.tsx:361, 384` | P2 |

### Proposed iPad design
**Reference pattern:** Apple Music iPad *Search → Browse Categories* grid, plus Spotify iPad *Browse all* colour tiles.

- **Remove the cap for this screen** (§5.3: grids and browse are uncapped and full width inside page margins). Take `MaxWidthContainer` off the Search stack layout (§5.3, migration step 5). Cap only the search field, at the forms width of **640 pt** (§5.3), leading-aligned.
- Replace the masonry with a **row-span grid**: fixed tile height and an optional "feature" tile spanning 2 columns, instead of 2 rows in a fixed column. Columns follow §10.1 with `minCard = 160` (playlist cards), over the measured pane width. Margins and gutters follow §5.2:

| Width class | Example pane | Gutter | Margin | Columns (§10.1) | Tile width |
|---|---|---|---|---|---|
| compact | phone | 12 | 16 | 2 | — |
| medium | 698 (11" portrait) | 16 | 24 | 4 | ~162 |
| expanded | 720–876 (13" portrait, 11" Air landscape) | 20 | 32 | 4 | 165–204 |
| large | 1006 (13" landscape) | 24 | 40 | 5 | ~182 |

- Tile height is **112 pt** (the feature tile is 112 pt high and spans 2 columns), in plain points (§3). Use the `card` radius, 14 (§5.4). Title is `headline` (17 SemiBold), subtitle is `footnote` (13 Medium, `textSecondary`) (§4.1).
- **Bring the colour back** on the artwork, not on the chrome. Tint the glass with `tile.backgroundColor` at 25–35% (glass `tintColor`, or a `LinearGradient` underlay at 0.35 alpha beneath the GlassView). Add a decorative mark in the bottom-trailing corner: reuse `SurahGradientMesh` keyed by the playlist's first surah, or an icon per category, rotated 20° and cropped by the card, Spotify style. The monochrome-chrome principle doesn't cover this case yet; see *Proposed changes to the standard*.
- Split into two sections with `title2` headers (§4.1), separated by the section spacing for the width class (§5.2): **Browse** (All Reciters and All Surahs as two 2-span tiles) and **Curated playlists** (the 12 system playlists).
- At `medium`+, show a `title1` "Search" title (§4.1) above the search field.
- Hover is the §7.2 tint (`Color(text).alpha(0.04)`). Secondary click opens the same context menu as long-press (§7.2): Play, Shuffle, Open.

`large`, 13" landscape (window 1366, sidebar 280, pane 1006, 5 columns, uncapped):
```
┌──────────┬──────────────────────────────────────────────────────────────────┐
│  Bayaan  │  Search                                                          │
│ ⌂ Home   │  ┌──────────────────────────────────────────┐                    │
│ ☰ Surahs │  │ ⌕  Reciters, surahs…              ⌘F      │                    │
│ ⌕ Search │  └──────────────────────────────────────────┘                    │
│ ♡ Collect│  Browse                                                          │
│ ⚙ Setting│  ┌───────────────────────────┐ ┌───────────────────────────┐     │
│          │  │ All Reciters          🎙   │ │ All Surahs            ۞    │     │
│          │  └───────────────────────────┘ └───────────────────────────┘     │
│          │  Curated playlists                                               │
│          │  ┌────────────┐┌────────────┐┌────────────┐┌────────────┐┌─────┐ │
│          │  │Morning     ││Quick       ││Heart       ││Evening     ││Fri… │ │
│          │  │Reflections◐││Listen     ◑││Softeners  ◒││Serenity   ◓││     │ │
│          │  └────────────┘└────────────┘└────────────┘└────────────┘└─────┘ │
│          │  ┌─────────────────────────┐┌────────────┐┌────────────┐┌─────┐  │
│ ▶ mini   │  │Bayaan Essentials (2-span)││Juz Amma    ││Focus       ││ …   │  │
└──────────┴──────────────────────────────────────────────────────────────────┘
```
`medium`, 11" portrait (pane 698, 4 columns): the same layout. The Browse row is two 2-span tiles, which fill the 4 columns exactly.

### Implementation notes
- `components/search/ExploreView.tsx`: drop `createExplicitLayout` and the `column`/`order` stacks. Use a `FlatList numColumns` (key on the column count), or a flex-wrap container with computed widths from the existing `onLayout` measurement. Swap `scale`/`moderateScale` imports for `@/utils/scale` (§3) and the §4.1 roles. Compute columns with §10.1. Add `accessibilityRole="link"` and labels (§12). **M**
- `data/systemPlaylists.ts`: replace `column`/`order`/`heightMultiplier` with `featured?: boolean` (2-span) plus array order. Fix the duplicate subtitles. **S**
- `app/(tabs)/(b.search)/_layout.tsx`: remove the stack-level `MaxWidthContainer` (§5.3). Wrap only the search field in a 640 pt cap. Show a `title1` title on the index screen at `medium`+. **S**
- Hover and context menus: build a shared `PressableCard` (hover lift + `contextMenu` via `react-native-ios-context-menu` or `expo-router` `Link.Menu`/`Link.Preview` where available). It should be reused by SurahCard and playlist tiles. **M** (shared infra)

---

## Search tab: search mode (recent + results) — `/(tabs)/(b.search)` with the field active

**Files:** `app/(tabs)/(b.search)/index.tsx`, `components/search/SearchView.tsx`, `components/SurahItem.tsx`, `components/ReciterItem.tsx`, `app/(tabs)/_layout.tsx:103-136`, `components/tablet/TabletSidebar.tsx:141-157`, `app/(tabs)/(b.search)/_styles.ts`, `components/SearchBar.tsx`, `components/SearchInput.tsx`.
**What it is:** the overlay that cross-fades in when the native search bar is focused. It shows recent searches when the query is empty and fuzzy results (surahs + reciters) otherwise.
**Current iPad behavior:** search on tablet is driven by the same `Stack.SearchBar` as on phone. The `UISearchTab` / `automaticallyActivatesSearch` setup lives only in `IOSTabs` (phone NativeTabs). On tablet `TabletTabs` is a plain JS `Tabs`, so none of it applies, yet the iOS 27 focus-effect mount/unmount workaround still runs. Tapping **Search** in the sidebar shows Explore with the field unfocused. Tapping it again does nothing to the field (`handlePress` only navigates when the tab isn't focused). Results render as a single column of phone `SurahItem` / `ReciterItem` rows across the 720 pt column, with raw `moderateScale` sizing. On non-glass iPads (iPadOS < 26) a hand-built `TextInput` row is used instead, also inflated (`height: moderateScale(42)` ≈ 71–82 pt).

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | UX & interaction | The search-bar mount/unmount workaround runs on tablet even though the tablet shell has no `UISearchTab`. Because unmount happens on *every* blur (including pushing a reciter or opening the Mushaf from a result), the native field comes back empty while `query` and `isSearchActive` still hold the old values. The user probably sees stale results under an empty field and can't clear them without typing *(verify)*. | `index.tsx:41-47, 59-80` (cleanup only flips `searchBarMounted`, never resets `query`) | P1 |
| 2 | UX & interaction | Nothing activates search on tablet. Selecting the Search item, or re-selecting it, does not focus the field. There is no ⌘F / ⌘K key command. Apple Music, Spotify and the HIG all treat search in an iPad sidebar as "select → field focused, keyboard or hardware keyboard ready". | `TabletSidebar.tsx:141-157`; `app/(tabs)/_layout.tsx:233-235` (no `role`/listener on tablet) | P1 |
| 3 | Layout & density | Results are one interleaved list ranked by score. Surahs and reciters alternate, with no Top Result, no type sections and no scope filter. On a 700–1000 pt pane this wastes width and makes scanning slow. | `SearchView.tsx:345-365, 508-512` | P1 |
| 4 | UX & interaction | The keyboard listener pads list bottoms by the full `keyboardHeight`. On iPad with a hardware keyboard (shortcut bar only) or the floating or split keyboard, the reported height is wrong or small, and the phone assumption that results sit above a big keyboard doesn't hold. | `SearchView.tsx:97-114, 427, 515` | P2 |
| 5 | Visual design / A11y | Empty-state copy uses `textSecondary` at 0.35 and **0.2** alpha, and the icon at 0.12. The subtitle fails WCAG contrast badly, and on a big iPad screen the faint text floats at `paddingTop: '35%'` of a tall view (~400 pt down). | `SearchView.tsx:474-504, 526-556, 611-616` | P1 |
| 6 | Typography | Section label `moderateScale(10.5)` uppercase ≈ 18–21 pt, and "Clear" `moderateScale(11)`. Result rows use `SurahItem` 13 → 22–25 pt Bold and `ReciterItem` avatars 50 → 85–98 pt. This is phone hierarchy at 2x, and mixed with any theme-typography text it looks uneven. | `SearchView.tsx:591-600`; `SurahItem.tsx:357-372`; `ReciterItem.tsx:116-141` | P1 |
| 7 | UI components | Non-glass iPads get a hand-rolled search row (Feather icon, `TextInput`, text Cancel) instead of the shared `SearchInput`. Three implementations now exist (`index.tsx` inline, `SearchInput`, and the dead `SearchBar.tsx`). | `index.tsx:81-137`; `components/SearchBar.tsx` (no importers) | P2 |
| 8 | UX | Recent searches are capped at 10, all one type of row, with no per-item remove (swipe or ✕). On iPad with a pointer there's no hover-revealed ✕ either. | `SearchView.tsx:45, 430-472` | P2 |
| 9 | UX (bug) | Long-pressing a surah with the "use default reciter" setting pushes `/player` without playing. The `randomReciter` case is missing, unlike the Surahs tab. | `SearchView.tsx:318-334` vs `(b.surahs)/index.tsx:55-72` | P1 |
| 10 | Input | Results have no arrow-key navigation, no Return to open the top hit and no Escape to cancel. Rows have no hover highlight and no context menu (Play with default reciter / Choose reciter / Open Mushaf / Add to queue). The audio action hides behind long-press. | `SearchView.tsx:345-391`; `SurahItem.tsx:180-193` | P1 |
| 11 | Scope | Only catalogue search (names). Tarteel and Quran.com let you type an ayah reference (`2:255`) or words from the text and jump to the verse. On iPad, with a hardware keyboard, this is the expected power path. | `utils/search/catalog` usage `SearchView.tsx:180, 216` | P2 (feature) |

### Proposed iPad design
**Reference pattern:** Apple Music iPad search results (Top Result card + type sections + scope chips), Spotify iPad (filter chips "Reciters · Surahs"), Quran.com's ayah-reference jump.

- **Activation.** On tablet: (a) selecting the Search tab from the sidebar focuses the field after the transition; (b) re-selecting Search while it is already focused re-focuses the field and selects its text; (c) **⌘F** switches to the Search tab and focuses the field from anywhere (§7.3). Gate the iOS 27 focus-effect workaround on the shell: run it only under the phone NativeTabs shell, which today is `!isTablet` and becomes `compact` once §6 selects the shell by width class. Keep the bar mounted under the sidebar shell. Return submits and opens the top hit (§7.3 MUST).
- **State.** When the bar unmounts, or when the screen regains focus with an empty native field, reset `query`/`isSearchActive`. Better still, keep the bar mounted and drive its text from state (`ref.setText`) so the field and results never disagree.
- **Field.** Max width 640 pt (forms width, §5.3), leading-aligned under the `title1` title. Native height, which is at least 44 pt (§7.1). Placeholder "Reciters, surahs, or 2:255".
- **Results layout** (`medium`+). The results are uncapped, full width inside the §5.2 margins (§5.3):
  - Row 1: a **Top Result** card spanning 2 grid columns, 160 pt tall. It shows a 96 pt reciter avatar or a surah glyph on a `SurahGradientMesh`, the name as `title2`, a type label as `footnote`, and an inline ▶ Play capsule. Next to it, filling the remaining columns, are **Surahs**: the first 4 matching surahs as compact rows (`headline` + `footnote`, `minHeight` 56, §4.3).
  - Then **Reciters** as a horizontal shelf with a peek (§10.1). Items are sized from the §10.1 column math with `minCard = 160`, so they line up with the grid above: circular avatar plus name, with a "See all" link. Then **More surahs** as a multi-column row list (2 columns at a 698–876 pane, 3 at 1006; the row-list rule is a proposed addition, see the last section).
  - Scope chips under the field: *All · Reciters · Surahs*. They become segmented filters once the user wants one type.
- **Recent searches.** Up to 20, shown as the same multi-column row list at `medium`+. Each row gets a trailing ✕ that is always visible on pointer and on touch. Swipe-to-delete is an extra, never the only path (§7.2 MUST NOT). The section header uses `overline` (§4.1). "Clear" becomes a `callout` text button with a 44 pt hit area (§7.1).
- **Empty state.** Vertically centred in the visible area above the keyboard. Title `headline` at `textSecondary`, subtitle `body` at `textSecondary`. Text alpha stays ≥ 0.55 to meet AA contrast (§12).
- **Keyboard.** ↑/↓ move the highlighted result, Return opens it, ⌘Return plays it with the default reciter, and Esc clears and then cancels (§7.3; ↑/↓ and ⌘Return in search are proposed additions).
- **Context menu on every result**, opened by long-press or secondary click (§7.2): Open in Mushaf · Play (default reciter) · Play with… · Add to queue · Go to reciter. At `medium`+, "Play with…" opens the reciter picker as a centred form sheet capped at 560 pt (§8, content panel), not a bottom sheet.

`large`, 13" landscape (results for "rah"):
```
┌──────────┬──────────────────────────────────────────────────────────────────┐
│ sidebar  │  Search                                                          │
│          │  ┌───────────────────────────────────────┐  Cancel               │
│          │  │ ⌕ rah                              ✕  │                       │
│          │  └───────────────────────────────────────┘                       │
│          │  ( All ) ( Reciters ) ( Surahs )                                 │
│          │  Top result                         Surahs                       │
│          │  ┌───────────────────────────┐      55  Ar-Rahman   78 ayahs  ⋯  │
│          │  │  ۞ (mesh)                 │      17  Al-Isra     111 ayahs ⋯  │
│          │  │  Ar-Rahman   Surah · 55   │      ...                          │
│          │  │  [▶ Play]  [📖 Read]       │                                   │
│          │  └───────────────────────────┘                                   │
│          │  Reciters                                                        │
│          │   ( ◯ )   ( ◯ )   ( ◯ )   ( ◯ )   ( ◯ )   ( ◯ )  →               │
│          │  Abdul Rahman…  Ar-Rahmani …                                     │
└──────────┴──────────────────────────────────────────────────────────────────┘
```
`medium`, 11" portrait (pane 698, 4 columns): Top Result spans 2 columns with Surahs in the other 2, then the Reciters shelf (4 visible plus a peek), then More surahs in 2 columns.

### Implementation notes
- `app/(tabs)/(b.search)/index.tsx`: gate the `searchBarMounted` effect on the NativeTabs shell (see above). Reset state when the bar unmounts. Expose a focus handle (`Stack.SearchBar` `ref` → `focus()`), triggered by a `tabPress` listener (`navigation.getParent()?.addListener('tabPress', …)`) and by a key command. **S–M**
- `components/tablet/TabletSidebar.tsx`: emit `tabPress` even when already focused (it already does) and make sure the search screen listens for it. Keep pop-to-top as the first re-tap if the stack is deep. **S**
- `components/search/SearchView.tsx`: group `searchResults` by type, render a sectioned layout on tablet (`SectionList` or a `ScrollView` with shelves), build a `TopResultCard` (new component under `components/search/`), fix the empty-state contrast (§12), port sizes to `@/utils/scale` (§3) and the §4.1 roles, and fix the `useDefault`/`randomReciter` long-press cases by reusing `useReciterSelection` as the Surahs tab does. **M–L**
- Non-glass search row: replace the inline row in `index.tsx` with `SearchInput`. Delete `components/SearchBar.tsx`. **S**
- Key commands: there is no infra yet. Build the `UIKeyCommand` module §7.3 calls for, plus a `useKeyCommands` hook (shared with the other audits; migration step 10). **M**
- Ayah-reference jump (`\d+:\d+` → `/mushaf?surah=&ayah=`): a cheap first step before full-text search. **S**

---

## System playlist detail — `/(tabs)/(b.search)/system-playlist/[id]`

**Files:** `app/(tabs)/(b.search)/system-playlist/[id].tsx`, `components/system-playlist/SystemPlaylistDetail.tsx`, `components/system-playlist/SystemPlaylistHeader.tsx`, `components/TrackItem.tsx`, `components/collection/CollectionStickyHeader.tsx`, `app/(tabs)/(b.search)/_layout.tsx:81-98`.
**What it is:** the curated playlist page. A header (badge, title, description, count, duration, Shuffle and Play buttons) over a list of surahs. Surah-only playlists use an auto-picked reciter; fully curated ones use `TrackItem` rows.
**Current iPad behavior:** inside the 720 pt column, the header is a centred stack of phone text, all inflated: the title is `moderateScale(24)` ≈ 41–47 pt and the description ≈ 24–27 pt with a ~680 pt line length. There is **no artwork**. The 42 pt square Shuffle/Play icons (≈ 71–82 pt after scaling) are pushed right, with an empty placeholder on the left. Surah-only rows repeat "with {reciter}" on every line and show a fake "Play" pill that is not a separate control. The glass header puts the back chevron at the left edge of the 720 pt column rather than at the screen edge.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Visual design | No artwork or visual identity. The playlist's own `backgroundColor` isn't used on this page at all, so the header is plain text on the background. Apple Music and Spotify playlist pages on iPad are built around a 250–300 pt artwork square. | `SystemPlaylistHeader.tsx:87-119`; `data/systemPlaylists.ts:28` (unused here) | P1 |
| 2 | Layout & density | The centred, single-column phone header stretches inside 720 pt. iPad convention (Apple Music album/playlist) is artwork leading, metadata and actions trailing, left-aligned. | `SystemPlaylistHeader.tsx:172-194, 212-234` | P1 |
| 3 | Typography | Title ≈ 41–47 pt, description ≈ 24–27 pt with `lineHeight` ≈ 34–39, badge ≈ 19–22 pt, all from raw `moderateScale`. There is no max measure on the description. | `SystemPlaylistHeader.tsx:205-234` | P1 |
| 4 | UI components | Shuffle and Play are unlabelled icon squares (radius 12, ~71–82 pt after scaling), right-aligned against a `leftPlaceholder`. Apple Music iPad uses two labelled capsule buttons ("▶ Play", "⇄ Shuffle") about 44 pt tall, under the title. | `SystemPlaylistHeader.tsx:121-159, 245-266` | P1 |
| 5 | UX | Surah-only rows repeat "with {reciter}" on every row, the reciter is auto-picked (the first featured reciter with full coverage) and **can't be changed**. The trailing "Play" pill looks like a button but is just part of the row. | `SystemPlaylistDetail.tsx:93-130, 598-626` | P1 |
| 6 | Layout | Rows are full-width single-line phone rows. On iPad, Apple Music shows the track list as a table (#, title, artist, duration, ⋯) with hairline separators, and it fits easily in a 700–1000 pt pane. | `SystemPlaylistDetail.tsx:207-247, 634-644`; `TrackItem.tsx:263-316` | P2 |
| 7 | UX | Playing from row *n* builds a rotated queue (`n…end, 0…n-1`), so after the last surah playback wraps to the first. Apple Music starts at *n* and lets "previous" go back. | `SystemPlaylistDetail.tsx:339-342, 384-387` | P2 |
| 8 | UX | Shuffle uses `sort(() => Math.random() - 0.5)`, which is a biased shuffle. Over 6–40 items users notice the repeats. | `SystemPlaylistDetail.tsx:474` | P2 |
| 9 | Visual design | The loading state is a bare "Loading…" string at `marginTop 40×1.7`. There is no skeleton, so the page flashes empty, then the header and rows. | `SystemPlaylistDetail.tsx:702-708` | P2 |
| 10 | Layout | List bottom padding is `moderateScale(100)` (≈ 170–196 pt) on tablet, where there is no bottom tab bar or floating player (the player is docked in the sidebar). | `SystemPlaylistDetail.tsx:193-195` | P2 |
| 11 | Input | Rows have no hover, no context menu (Play next / Add to queue / Open in Mushaf / Choose reciter) and no keyboard Space=Play / Return=play row. Options go only through the `surah-options` bottom sheet. | `SystemPlaylistDetail.tsx:569-587, 600-602` | P1 |
| 12 | Code health | `useHeaderHeight()` is called conditionally (`isGlass ? useHeaderHeight() : 0`). It is stable at runtime, but it breaks the hooks rules and will trip lint and the compiler. | `SystemPlaylistDetail.tsx:166` | P2 |

### Proposed iPad design
**Reference pattern:** Apple Music iPad playlist/album page (artwork-leading header, labelled Play/Shuffle capsules, table track list), Spotify iPad playlist (colour-washed header from the artwork).

- **Artwork.** Generate a square cover: **240 pt** at `expanded`, **280 pt** at `large` (§10.2), and 200 pt at `medium` (a proposed addition, see the last section). Corner radius is about 6% of the edge, so 12–17 pt (§5.4). Draw a `LinearGradient` from `playlist.backgroundColor` to its darkened variant with a `SurahGradientMesh` overlay, the playlist title in `title2` ExtraBold, and the "Curated" badge in the bottom corner. The same cover becomes the Explore tile art, which ties the two screens together.
- **Header** (`expanded`+ per §10.2, and `medium` as proposed): an HStack with the artwork leading and 24 pt (`2xl`) spacing. The trailing VStack is leading-aligned:
  - badge `CURATED BY BAYAAN` as `overline`
  - title as `display` (34 pt at tablet, §4.1), 2 lines max
  - description as `body` (16), `textSecondary`, max width 520 pt, 3 lines with "more"
  - meta line as `footnote`: "12 surahs · 1 h 40 m"
  - action row: **[▶ Play]**, a filled capsule (`text` background, `background` label, 48 pt high per §7.1 primary playback, min 120 pt wide) + **[⇄ Shuffle]**, a tinted capsule + a trailing `⋯` button. The actions stay visible without scrolling (§10.2 MUST). At `medium`+, `⋯` opens a popover or context menu anchored to the button (§8, short action list): Add all to queue, Download all, Share.
- **Header wash.** A top-of-page gradient from `playlist.backgroundColor` at 0.25 alpha, fading to the background over 320 pt, behind the transparent glass header. Colour is used here as artwork, not chrome (see the last section).
- **Reciter choice for surah-only playlists.** Move it into the header as a chip: "Reciter: Mishary Alafasy ▾". At `medium`+, tapping it opens the reciter picker as a centred form sheet capped at 560 pt (§8, content panel). Remove the per-row "with …" line.
- **Track table.** Rows have `minHeight` 56 (§4.3) and these columns: `#` (32 pt, tabular digits); surah name as `headline` with the meaning beneath as `footnote` in `textSecondary`; the Makki/Madani glyph; ayah count or duration (trailing-aligned, `footnote`, tabular); and `⋯`. Hovering a row applies the §7.2 tint and replaces `#` with ▶ (Apple Music behaviour). Secondary click opens the row's context menu (§7.2). The currently playing row shows the `NowPlayingIndicator` in the `#` slot.
- **Width.** The track table runs full width inside the §5.2 page margins, below the header (§10.2). The header wash runs edge to edge.
- **Queue semantics.** Start at row *n* without rotating. Use Fisher–Yates for shuffle.

`expanded` / `large` (e.g. 13" landscape, 280 pt artwork):
```
┌──────────┬───────────────────────────────────────────────────────────────┐
│ sidebar  │ ‹                     (glass header; title fades in on scroll) │
│          │ ┌──────────────┐   CURATED BY BAYAAN                           │
│          │ │              │   Morning Reflections                         │
│          │ │  gradient +  │   Start the day with Al-Fatihah, Ad-Duha…     │
│          │ │  mesh cover  │   6 surahs · 24 min                           │
│          │ │              │   Reciter: Mishary Alafasy ▾                  │
│          │ └──────────────┘   [ ▶ Play ]  [ ⇄ Shuffle ]   ⋯               │
│          │ ────────────────────────────────────────────────────────────  │
│          │  #   Surah                          Place   Ayahs        ⋯    │
│          │  1   Al-Fatihah · The Opener          ☪       7          ⋯    │
│          │  93  Ad-Duha · The Morning Hours      ☪      11          ⋯    │
│          │  ...                                                          │
└──────────┴───────────────────────────────────────────────────────────────┘
```
`medium` (11" portrait, pane 698): the same HStack with a 200 pt artwork. At `compact`, fall back to today's centred phone header (§2.2).

### Implementation notes
- `components/system-playlist/SystemPlaylistHeader.tsx`: branch on `widthClass !== 'compact'` (§2.2), not on `isTablet`, for the artwork + HStack. Use labelled capsule buttons. Move all sizes to the §4.1 roles and `@/utils/scale` (§3). **M**
- New `components/system-playlist/SystemPlaylistArtwork.tsx`, reused by `ExploreView` tiles. **S–M**
- `components/system-playlist/SystemPlaylistDetail.tsx`: add a reciter chip that opens a form-sheet picker (§8), a row component with `#`/hover-play, drop the per-row reciter line and the fake pill, fix queue rotation and shuffle, hoist `useHeaderHeight` out of the ternary, and use `useBottomInset` (made tablet-aware) instead of `moderateScale(100)`. **M**
- `hooks/useBottomInset.ts`: make it follow the §6 shell. At `medium`, return the height of the mini player docked under the content area plus `insets.bottom`. At `expanded`+, where the player sits in the sidebar footer, return `insets.bottom` + 16. Today it always adds the phone tab bar and accessory (49 + 64). This fix also benefits the Surahs and search screens. **S**

---

## Surahs tab — `/(tabs)/(b.surahs)`

**Files:** `app/(tabs)/(b.surahs)/_layout.tsx`, `app/(tabs)/(b.surahs)/index.tsx`, `components/SurahsView.tsx`, `components/SurahItem.tsx`, `components/cards/SurahCard.tsx`, `components/hero/ContinueReadingHero.tsx`.
**What it is:** the Quran index. A "Continue Reading / Surah of the Day" hero, sort pills (1→114, 114→1, revelation order) and a card/list toggle, then all 114 surahs. Tap opens the Mushaf, long-press starts audio.
**Current iPad behavior:** the 720 pt column has no header or title (`headerShown: false`). The hero is ~255–295 pt tall (`moderateScale(150)` frozen at import). Card mode shows **2 cards per row** at `width: '48%'` (≈ 330 pt wide) but a scaled height of `moderateScale(120)` ≈ 205–235 pt, so 57 rows of wide, non-square cards with inflated text. List mode is a single column of phone rows (glyph box 60×45 → ~100×76 pt, name 13 → 22–25 pt) with sticky Juz headers only for numeric sorts.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Layout & density | Card mode is hard-coded to pairs (`groupSurahsIntoPairs`, `width: '48%'`). That gives 2 columns on any iPad, 57 rows to scroll, and huge cards. Tarteel/Quran.com iPad show 3–4 columns of surah cells, Apple Music grids 4–6. | `SurahsView.tsx:37-47, 86-94, 166-187, 352-360` | P0 |
| 2 | Visual design | `SurahCard` height comes from `moderateScale(120)` and width from the parent's `48%`. The card is a non-square ~330 × 210 pt slab whose `SurahGradientMesh` is drawn on a 120×120 viewBox, and the glyph/name/meaning text (26 / 12 / 9 → ~44 / 20 / 15 pt) floats in the middle. Corner badges keep phone offsets. | `SurahCard.tsx:208-212, 221-252, 359-364` | P1 |
| 3 | Layout & density | List mode is one column of 100%-wide rows at 720 pt with the text block hugging the left. On iPad, Quran indexes use 2–3 columns of rows (Quran.com web/tablet index uses 3). | `SurahsView.tsx:190-196`; `SurahItem.tsx:319-351` | P1 |
| 4 | Typography | Mixed inflation: the row name `moderateScale(13)` is Bold ≈ 22–25 pt, the secondary line 11 → 19–22 pt, and the location badge 9 → 15–18 pt, while the Juz header 12 → 20–24 pt. Sort pills are 12 → 20–24 pt. Nothing uses `theme.typography`. | `SurahItem.tsx:357-398`; `SurahsView.tsx:344-348, 366-371` | P1 |
| 5 | Layout | The hero height `moderateScale(150)` is a module constant (computed once, never responsive). At ~255–295 pt it takes a third of the portrait viewport before any surah shows. Its padding is `moderateScale(16)` ≈ 27–31 pt. | `ContinueReadingHero.tsx:16, 52-55, 60` | P1 |
| 6 | UX & interaction | **Hidden primary audio action.** Tap = read and long-press = listen, with no visible affordance. With a trackpad or mouse, long-press means click-and-hold, which iPad users won't guess. There is no context menu, no ▶ button and no hover hint. | `(b.surahs)/index.tsx:21-33`; `SurahsView.tsx:178-181, 191-195`; `SurahItem.tsx:180-183` | P1 |
| 7 | UX | No title, no search and no jump. On a 114-item index you can't type "36" or "Yasin". Tarteel and Quran.com put a search field at the top of the index, and with a hardware keyboard type-to-select is expected. | `(b.surahs)/_layout.tsx:14-19`; `(b.surahs)/index.tsx:17-19` | P1 |
| 8 | UX | Juz is not a peer view. Juz headers appear only in list mode and only for the asc/desc sorts, and disappear in card mode or revelation order. Quran apps offer *Surah · Juz* (often *· Page / Hizb*) as a segmented control. | `SurahsView.tsx:83-84, 95-116` | P2 |
| 9 | UI components | The sort control is three tinted text pills with 14 pt icons (≈ 24 pt), and the view toggle is a bare 16 pt glyph with `padding: moderateScale(6)` and no label or selected state. HIG on iPad: a pull-down `Menu` for sort ("Sort: Surah number ▾") and a segmented control for grid/list, in the nav bar trailing area. | `SurahsView.tsx:215-273, 336-351` | P2 |
| 10 | Accessibility | Sort pills and the view toggle have no `accessibilityRole`, `accessibilityState={{selected}}` or label. The toggle is announced as nothing at all. `SurahCard` has no accessibility label (only `SurahItem` does). | `SurahsView.tsx:232-272`; `SurahCard.tsx:492-523` | P1 |
| 11 | Layout | Sticky Juz headers inside a FlashList with `contentInsetAdjustmentBehavior="automatic"` and no nav bar on tablet may stick under the status bar region *(verify)*. Non-glass tablets also pad the bottom by 49 + 64 pt for a tab bar and mini player that aren't there. | `SurahsView.tsx:291-310`; `hooks/useBottomInset.ts:31-37` | P2 |
| 12 | Input | No hover on cards or rows, no focus ring, no arrow-key grid navigation. `TouchableOpacity`, not `Pressable`, is used in the non-glass card path. | `SurahCard.tsx:506-523`; `SurahItem.tsx:180` | P2 |

### Proposed iPad design
**Reference pattern:** Tarteel iPad surah index (search on top, Surah/Juz tabs, dense rows), Quran.com tablet index (3-column surah grid), Apple Music Library grid (adaptive columns, hover lift, context menus).

- **Header** (`medium`+). A `title1` title, **"Quran"** or "Surahs" (§4.1). A native search field (`Stack.SearchBar`), capped at 640 pt (§5.3), filtering locally by number, transliteration, Arabic and meaning. Trailing toolbar items: a sort **pull-down menu** (a popover/context menu per §8: Surah number ↑ / ↓ / Revelation order) and a **grid/list segmented control**. Every control gets a 44 pt hit area (§7.1) and a role/label (§12).
- **Segmented scope** under the title: **Surah · Juz** (Juz shows 30 cells, each listing the surahs it starts). Juz section headers (`overline`, §4.1) work in every view mode.
- **Hero.** A fixed **176 pt** height in plain points (§3), computed in render, not at module scope (§2.2). At `medium`+, show a **2-up** row: *Continue Reading* (Mushaf page and surah, primary) and *Continue Listening* (last reciter + surah, with ▶), mirroring Tarteel's "resume" strip. The two cards split the pane with the §5.2 gutter.
- **Grid mode.** Square surah tiles. Columns follow §10.1 with `minCard = 120` (surah tiles), and gutters and margins follow §5.2. The grid is uncapped (§5.3):

| Width class | Example pane | Gutter | Columns (§10.1) | Tile edge |
|---|---|---|---|---|
| compact | phone | 12 | 2 (today's phone layout) | — |
| medium | 698 (11" portrait) | 16 | 5 | ~127 |
| expanded | 720 (13" portrait) / 876 (11" Air landscape) | 20 | 5 / 6 | ~128 / ~129 |
| large | 1006 (13" landscape) | 24 | 7 | ~123 |

  Tiles are **square** (`aspectRatio: 1`) with the `card` radius, 14 (§5.4). The glyph is 30 pt `SurahNames`. The transliteration is `callout` (15) SemiBold, 1 line. The meaning is `caption` (12) in `textSecondary`. The number badge is `caption`, tabular, top-leading, and the Makki/Madani glyph is 14 pt top-trailing. The mesh viewBox matches the tile.
- **List mode.** A multi-column row list: 2 columns at a 698–876 pane and 3 at 1006, using the row-list rule proposed in the last section (min row width 300). It runs column-major, so 1–38 | 39–76 | 77–114 reads like an index. Rows have `minHeight` 60 (§4.3): the number in a 36 pt rosette (`footnote`, tabular), the name as `headline`, the meaning + ayah count as `footnote` in `textSecondary`, and a 24 pt glyph trailing. Hairline separators are inset to the text. Each row is one VoiceOver element (§12).
- **Visible audio affordance.** On hover, rows and tiles get the §7.2 tint and a ▶ button fades in at the trailing edge. On touch, long-press opens a context menu, and secondary click opens the same menu (§7.2): **Read in Mushaf · Play · Play with… · Add to queue · Download**. Audio is therefore always reachable from a visible menu, never only by holding (§7.2).
- **Keyboard.** ⌘F focuses the index search (§7.3). Typing digits jumps to that surah, arrow keys move the focus ring, Return opens the Mushaf, and Space plays (§7.3; digit-jump and arrow focus in grids are proposed additions).
- **Width.** No cap in either mode (§5.3: grids are uncapped, and the row list is a browse surface, not a reading column). Remove the stack-level `MaxWidthContainer`.

`expanded`, 11" Air landscape (pane 876, grid mode, 6 columns; 5 drawn):
```
┌──────────┬───────────────────────────────────────────────────────────────┐
│ sidebar  │ Quran                                   [Sort ▾]  [▦ | ☰]      │
│          │ ┌───────────────────────────────────┐                          │
│          │ │ ⌕ Surah name, number, or meaning  │   ( Surah | Juz )        │
│          │ └───────────────────────────────────┘                          │
│          │ ┌─────────────────────────────┐ ┌─────────────────────────────┐│
│          │ │ Continue reading            │ │ Continue listening      ▶   ││
│          │ │ Al-Kahf · page 296          │ │ Al-Mulk · Alafasy           ││
│          │ └─────────────────────────────┘ └─────────────────────────────┘│
│          │ JUZ 1                                                          │
│          │ ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐                        │
│          │ │1   ☪ ││2   ☪ ││3   ☪ ││4   ☪ ││5   ☪ │  (square cells,       │
│          │ │ glyph││ glyph││ glyph││ glyph││ glyph│   hover ▶ trailing)   │
│          │ │Fatiha││Baqara││Imran ││Nisa  ││Maida │                        │
│          │ └──────┘└──────┘└──────┘└──────┘└──────┘                        │
└──────────┴───────────────────────────────────────────────────────────────┘
```
`medium`, 11" portrait (pane 698, list mode, 2 columns):
```
┌────┬──────────────────────────────────────────────────────┐
│rail│ Quran                              [Sort ▾] [▦ | ☰]   │
│    │ ⌕ Search surahs                   ( Surah | Juz )     │
│    │ [ Continue reading ]  [ Continue listening ▶ ]        │
│    │ JUZ 1                                                 │
│    │ (1) Al-Fatihah    ☪ 7   │ (39) Az-Zumar     ☪ 75      │
│    │ (2) Al-Baqarah    ☾ 286 │ (40) Ghafir       ☪ 85      │
│    │ ...                     │ ...                         │
└────┴──────────────────────────────────────────────────────┘
```

### Implementation notes
- `components/SurahsView.tsx`: replace `groupSurahsIntoPairs` with `FlashList numColumns={cols}`, where `cols` comes from the §10.1 formula over the pane width (window width from `useResponsive()` minus the sidebar and the §5.2 margins; or `onLayout`, see the last section). Key the list by `cols`. Move Juz headers into card mode (FlashList supports full-span header items via `overrideItemLayout`). Add a Surah/Juz scope. Move sort to a native menu and the toggle to a segmented control with a11y roles (§12). Port sizes to the §4.1 roles. **L**
- `components/cards/SurahCard.tsx`: accept a `size` (cell edge) prop. Use `aspectRatio: 1` instead of `moderateScale(120)` and match the mesh viewBox. Swap to `Pressable` everywhere. Add `accessibilityLabel`/`Hint` (§12), the §7.2 hover tint with ▶, and a context menu (via the shared `PressableCard`). Phone callers keep today's default size. **M**
- `components/SurahItem.tsx`: add a tablet row variant (`minHeight` 60, §4.1 roles) and hover/context-menu support. It is shared with search results, recent searches and reciter profiles, so coordinate with the reciter-profile audit. **M**
- `components/hero/ContinueReadingHero.tsx`: compute the height in render (§2.2): 176 pt at `medium`+, `@/utils/scale` on phone. Add the 2-up layout with a *Continue Listening* card fed from `recentlyPlayedStore`. **S–M**
- `app/(tabs)/(b.surahs)/_layout.tsx` + `index.tsx`: at `medium`+, show the header with a `title1` title, `Stack.SearchBar` and toolbar items. Remove the stack-level `MaxWidthContainer` (§5.3). **S**
- `hooks/useBottomInset.ts`: follow the §6 shell (see the system playlist notes). **S**

---

## Proposed changes to the standard

These are things [the iPad standards](../ipad-standards.md) lack or contradict, found while aligning this audit:

1. **The §2.1 table disagrees with its own breakpoints.** It lists 11" landscape (1180–1210) under `expanded`, but iPad Pro 11" landscape is 1210 ≥ 1200, so `getWidthClass` returns `large`. Either move the `large` breakpoint to 1240, or list Pro 11" landscape under `large`. That matters here because the sidebar width (240 vs 280) and the margins change the column counts. *Adopted: `large` now starts at 1280.*
2. **§10.1 measures `paneWidth`, but §2.2 says to read the window.** Grids need the *pane* width (window − sidebar − margins), and in split views that is not derivable from the window alone. Add a `useContentWidth()` helper (or `onLayout` measurement, as `ExploreView` already does) and say explicitly that grid math uses it, while the *class* still comes from the window.
3. **Add a multi-column row-list rule** to §10.1. Long uniform lists (surah index, search results, recent searches) should flow into `columns = max(1, floor((paneWidth + gutter) / (300 + gutter)))` columns, column-major for ordered indexes. The standard currently only covers card grids.
4. **§10.2 starts the two-column detail header at `expanded`.** At `medium` (pane ~698) a 200 pt artwork + metadata HStack fits comfortably and matches Apple Music in iPad portrait. Proposal: allow it from `medium` with 200 pt artwork.
5. **Colour from content.** design-system.md §1 says chrome is monochrome. Playlist and surah artwork (tile tint, cover gradient, header wash) use `playlist.backgroundColor` / `SurahGradientMesh`. Add a rule that colour is allowed in *artwork and artwork-derived washes* (alpha ≤ 0.35 behind text), never in controls, and that it must pass §12 contrast on all 14 reading themes.
6. **Search activation rule** for §7.3 / §6. Selecting Search in the sidebar MUST focus the field. Re-selecting it re-focuses the field and selects its text. Field text and result state MUST stay in sync across navigation.
7. **Additional shortcuts** for the §7.3 table: ↑/↓ + Return + ⌘Return in search results, Esc to clear then cancel search, and type-to-jump (digits) in the surah index.
8. **Long-press is never the only path to a primary action.** Add this to §7.2 next to the swipe rule. Every long-press action must also be in a visible menu (context menu / `⋯`) and reachable by secondary click.
9. **design-system.md §8 lists `components/SearchBar.tsx` as a core component**, but it has no importers. Remove it from the table (and the file). The canonical search controls are the native `Stack.SearchBar` and `SearchInput`.
10. **§3 should ban size-matters `scale()` outright** for spacing, not just route imports. `ExploreView` uses full-factor `scale(16)` (≈ 38–47 pt on iPad) for padding, which is worse than `moderateScale`.
11. **`useBottomInset` per shell.** §6 and §10.3 define where the mini player docks but not the scroll inset. Add: at `medium`, the docked player height + safe area; at `expanded`+, the safe area only. Never add the phone tab-bar height on tablet.
