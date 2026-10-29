# iPad audit: Home tab

> Scope: every route in `app/(tabs)/(a.home)/` except `adhkar/*` (audited separately): home feed, browse-all reciters, browse-all surahs, reciter/browse, reciter/[id], playlist/[id], translations, plus the Home stack layout. The Search and Collection tabs reuse `BrowseReciters`, `BrowseSurahs`, `ReciterProfile` and `PlaylistDetail`, so this file covers those components for every tab.
>
> Files read: `app/(tabs)/(a.home)/{_layout,_styles,index,browse-all,browse-all-surahs,translations}.tsx`, `reciter/{[id],browse,_styles}.tsx`, `playlist/[id].tsx`; `components/RecitersView.tsx`; `components/hero/{RecitersHero,HeroSection,BrowseAllHero,RandomRecitationHero,ContinueReadingHero,SurahOfTheDay}.tsx`; `components/cards/{BrowseReciterCard (in browse/),CircularReciterCard,RecentReciterCard,recentCardStyles,RewayatCard,PlaylistCard,SurahCard}.tsx`; `components/browse/{BrowseReciters,BrowseGrid,BrowseSurahs,FilterModal}.tsx`; `components/reciter-profile/**` (ReciterProfile, ReciterHeader, ActionButtons, RewayatTabBar, SurahList, SearchView, NavigationButtons, styles, README); `components/playlist-detail/{PlaylistDetail,PlaylistHeader}.tsx`; `hooks/useCollectionNativeHeader.ts`; `components/screens/TranslationsContent.tsx`; `components/SurahItem.tsx`, `components/TrackItem.tsx`; `components/layout/MaxWidthContainer.tsx`, `utils/scale.ts`, `utils/themeUtils.ts`, `hooks/useResponsive.ts`.
>
> Date: 2026-10-26. Method: code reading only. I could not run the simulator from this Linux container, so pixel values below come from the scaling formulas and have not been checked against screenshots.
>
> **Standards:** the proposals follow [../ipad-standards.md](../ipad-standards.md) and cite it as §N:
> - width classes by **window** width (§2): `compact` <600, `medium` 600–899, `expanded` 900–1279, `large` ≥1280
> - page margins and gutters (§5.2)
> - content widths (§5.3)
> - type-ramp roles (§4.1)
> - the column formula (§10.1)
> - the sheet policy (§8)
>
> Where this audit needs something the standard lacks, see [Proposed changes to the standard](#proposed-changes-to-the-standard) at the end.
>
> **Shell assumed in the numbers below (§6):** `medium` has an 88pt rail, `expanded` a 240pt sidebar, `large` a 280pt sidebar. The pane is the window minus the shell minus 2× the page margin.
>
> **Brief vs. repo:** `RecentActivityCard`, named in the brief and in `docs/design/screen-inventory.md:46`, does not exist anywhere in the repo. The home feed has no Continue Reading, Surah of the Day or Saved Adhkar hero either. Those heroes live on the Surahs and Adhkar tabs. The real feed is described below, and the inventory row should be corrected.

### How the inflation numbers were computed

`react-native-size-matters` `moderateScale(x)` = `x * (1 + shortSide/350) / 2`. Because of the global portrait lock, the short side is the window width.

| Device (portrait window) | factor | Content column (window minus 88pt rail, capped at 720) |
|---|---|---|
| iPhone 15 (393) | 1.06x | 393 |
| iPad Air / Pro 11" (820–834) | **1.69x** | 720 |
| iPad Pro 13" (1024–1032) | **1.96x** | 720 |

None of the screens in this group read `theme.typography`. Only `BrowseGrid` imports the capped `utils/scale.ts`, and it uses it for one padding value. So every font, card, button and padding in the group inflates 1.7–2x on iPad, inside a column that does not grow. The scaling is the same everywhere, but it is the wrong scaling.

---

## Summary (top 5 across the group, ranked)

1. **P0: Width math uses the window width, not the 720pt column, so content overflows and clips.**
   - `BrowseGrid` computes columns and card width from `useWindowDimensions().width` (`components/browse/BrowseGrid.tsx:74-105`). Each row is 70pt (11") to 250pt (13") wider than the column, so the right-hand cards are cut off on every browse-reciters screen in all three tabs.
   - The reciter profile's horizontal rewayat pager sizes each page as `width: screenWidth` (`ReciterProfile.tsx:1237`). It also scrolls and snaps by `index*screenWidth` (`:264-271, :891, :917, :931, :970`) and positions the tab indicator with the same value (`RewayatTabBar.tsx:73,92,109,129`). Inside a 720pt `pagingEnabled` ScrollView, pages are 114–304pt too wide: the right edge of every surah row is clipped (including the `…` options button at `SurahItem.tsx:288`), swipes land between pages, and the indicator drifts.
2. **P0/P1: Everything is 1.7–2x oversized.**
   - Section titles go from 18pt to 30–35pt (`RecitersView.tsx:826`).
   - The reciter name goes from 32pt to 54–63pt (`ReciterHeader/index.tsx:111`).
   - The Play All button grows from 50pt to 85–98pt tall and spans the whole column (`ActionButtons/index.tsx:192`).
   - Home shelf cards grow from 120×140 to 203×237 (`RecitersView.tsx:330-331`), so only about 3.2 cards fit in a row.
   - The home hero grows from 150pt to 254–294pt tall (`BrowseAllHero.tsx:68`).
   - Many base sizes are also below Apple's 11pt minimum (7.5, 8.5, 9pt), so moving to the capped scale without raising them would make text illegible on iPad (the §4.1 ramp fixes this: `caption` 11–12 is the floor).
3. **P1: Phone layouts in a narrow column, plus the portrait lock.**
   - The 720pt cap (`_layout.tsx:16`) leaves 100–300pt gutters around browse grids that should use the full width (Apple Music and Spotify use edge-to-edge shelves with 20–40pt margins). This breaks §5.3.
   - Nothing adapts by width: no two-pane profile, no multi-column lists, and `BrowseSurahs` card view is hard-coded to 2 columns (`BrowseSurahs.tsx:549`).
   - Because of the global portrait lock and `UIRequiresFullScreen`, iPad users can't get a landscape or split layout at all. Every landscape wireframe below assumes those two restrictions are lifted.
4. **P1: Navigation and header bugs on the Home stack.**
   - 8 stale `Stack.Screen` entries point at files that don't exist (`_layout.tsx:47-54`).
   - `browse-all-surahs` is not declared, so on non-glass devices (iPadOS < 26) the stack default `headerShown: true` (`_layout.tsx:19`) draws a transparent native header titled "browse-all-surahs" on top of `BrowseSurahs`' custom `Header` (`BrowseSurahs.tsx:500`).
   - `playlist/[id]` shows the native back button on non-glass devices while `PlaylistHeader` draws its own (`PlaylistHeader.tsx:42-53`). Likely a double back button; needs checking on iPadOS 18.
   - Translations opened from the Mushaf verse sheet is pushed onto the *Home* tab (`VerseActionsSheet.tsx:788`), which switches tabs away from reading. It also duplicates `(d.settings)/translations.tsx`.
5. **P1: No iPad input or accessibility support.**
   - No hover state on any card, no context menus: long-press opens a bottom action sheet (`RecentReciterCard.tsx:226-238`, `PlaylistDetail.tsx:313`), and shelf reciter cards have no long-press at all (`RecitersView.tsx:286-334`).
   - No keyboard shortcuts (⌘F for search, arrow keys in grids, Space to play).
   - Filters open as a full-width slide-up `Modal` at 82% height instead of a 560 form sheet or side panel (§8) (`FilterModal.tsx:108, 310-314`).
   - Zero `accessibilityLabel`/`accessibilityRole` props across the heroes, `PlaylistHeader`, `NavigationButtons`, the `BrowseSurahs` sort and view toggles, and the reciter-profile header share/search icons (`ReciterProfile.tsx:311-336`).
   - Translations keeps the hidden list at `opacity: 0` (`TranslationsContent.tsx:947-985`), so VoiceOver reads both lists.

---

## Home stack layout: `app/(tabs)/(a.home)/_layout.tsx`

**Files:** `_layout.tsx`, `_styles.ts`, `reciter/_styles.ts`
**What it is:** the Stack for the Home tab, wrapped in `MaxWidthContainer`.
**Current iPad behavior:** every Home screen, including the native header, sits in a centered 720pt column. On a 1024pt-wide 13" iPad in portrait, that is a 720pt column next to an 88pt rail with 108pt of empty space on each side.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| L1 | Code health | 8 stale routes (`settings/index`, `storage`, `about`, `credits`, `mushaf-settings`, `default-reciter`, `reciter-choice`, `account`) have no files under `(a.home)/`. Settings moved to `(d.settings)`, and `account` exists in no tab at all (`(d.settings)/_layout.tsx:60` is stale too). Expo Router warns in dev, and readers are misled. | `_layout.tsx:47-54` | P2 |
| L2 | Navigation | `browse-all-surahs` is not declared. It inherits `headerShown: true` and `headerTransparent`, so on non-glass devices a native header with the raw route name draws over the custom `Header`. The Search tab declares it correctly (`(b.search)/_layout.tsx:64`). | `_layout.tsx:17-23`; `BrowseSurahs.tsx:193-198` (sets options on glass only) | P0 (non-glass) |
| L3 | Navigation | `playlist/[id]` uses `{title: ''}` with the header still shown on non-glass, while `PlaylistHeader` renders its own back arrow when `!USE_GLASS`, so there are two back affordances. | `_layout.tsx:45`; `PlaylistHeader.tsx:42-53`; `useCollectionNativeHeader.ts:26` (no-op on non-glass) | P1 |
| L4 | Layout | One 720pt column for everything. Grids, shelves and the profile get the same cap as text lists. | `_layout.tsx:16`; `MaxWidthContainer.tsx:125` | P1 |
| L5 | Code health | `(a.home)/_styles.ts` and `reciter/_styles.ts` are unused: nothing imports them. They contain `Dimensions.get('window')` at module load (`reciter/_styles.ts:9`), a pattern that would break on resize if someone revived it. | grep shows no importers | P2 |

### Proposed iPad design
- Delete L1's 8 entries. Declare `browse-all-surahs` with the same `USE_GLASS ? {...} : {headerShown:false}` pattern as `browse-all`. Make `playlist/[id]` use `headerShown: USE_GLASS` to match `reciter/[id]`.
- Remove `MaxWidthContainer` from this stack layout (§5.3 MUST NOT for grids and shelves) and apply caps per screen:
  - **Uncapped** (§5.3, inside the §5.2 margins): home, browse reciters, browse surahs, reciter profile, playlist.
  - **Form width 640** (§5.3): translations.
- Two values must not be confused:
  - The **width class** comes from the window (§2.1).
  - The **pane width** that feeds the §10.1 column formula is what is left after the shell and margins.

  Provide the pane width from one place (`usePaneWidth()`, measured with `onLayout` on the screen root), so no grid reads `useWindowDimensions().width` as its own width again. That mistake is the root of B1 and R1.

### Implementation notes
- `_layout.tsx`: remove stale entries, declare `browse-all-surahs`, fix the playlist header, drop the stack-level `MaxWidthContainer` (standard migration step 5, §13). **S**
- Add `widthClass` to `useResponsive()` (§2.3). Add `usePaneWidth()`, plus `useGridColumns({minCard})` implementing §10.1 with the §5.2 gutter for the current class. **M**
- Delete `(a.home)/_styles.ts` and `(a.home)/reciter/_styles.ts`. **S**

---

## Home feed: `/` (index)

**Files:** `index.tsx`, `components/RecitersView.tsx`, `hero/{RecitersHero,HeroSection,BrowseAllHero,RandomRecitationHero}.tsx`, `cards/{RecentReciterCard,recentCardStyles,CircularReciterCard,PlaylistCard,RewayatCard}.tsx`, `browse/BrowseReciterCard.tsx`, `adhkar/AdhkarBentoCard`, `adhkar/AdhkarNowPlayingCard`
**What it is:** the listening home, like Apple Music "Home" or Spotify Home: a "Browse all" mosaic hero and a "Random recitation" ribbon, followed by up to 12 horizontal shelves (Continue Listening, New to Quran, Favorites, Featured, Adhkar, Follow Along, Playlists, Exclusives, Tajweed, Memorization, Rewayat, From your Collection).

**Current iPad behavior:** the screen has no title or header (`index.tsx:11`). The two heroes stack full-width in the 720 column at 254pt and 127pt tall (11") with tiny labels. Each shelf shows about 3.2 cards of 203×237pt with 18.6pt names (11"). The favourites row is the exception: its avatars stay 64pt (raw numbers) while their names inflate to 17.7pt in a 74pt-wide label, so names truncate after 3–4 characters. Shelves only scroll by touch swipe, with no arrows or paging, and there are no hover or context menus.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| H1 | Typography | Section titles `moderateScale(18)` reach 30–35pt, almost the size of a large title, while card text inflates to only 16–20pt, so the hierarchy reads badly. Clear and See More links are 13pt base at 50% alpha. | `RecitersView.tsx:825-836` | P1 |
| H2 | Typography / Accessibility | Base sizes far below the 11pt HIG minimum: time remaining 7.5pt, surah 9.5pt, hero label 9pt, card subtitles 8.5–9pt, playlist name 10pt. On iPad, inflation hides this; on phone, or once capped, they are illegible. Text sits at 45–50% alpha, which likely fails 4.5:1 contrast in light mode (not measured). | `recentCardStyles.ts:65,86`; `BrowseAllHero.tsx:345`; `RandomRecitationHero.tsx:528,536`; `BrowseReciterCard.tsx:65`; `CircularReciterCard.tsx:286`; `PlaylistCard.tsx:638,643`; `RewayatCard.tsx:527` | P1 |
| H3 | Layout | Shelf card sizes come from `moderateScale` in a fixed 720 column, so only about 3 items are visible. Apple Music on iPad shows 5–6 per shelf in portrait. | `RecitersView.tsx:290-331`; `recentCardStyles.ts:8` | P1 |
| H4 | Layout / Bug | The favourites row mixes raw sizes (avatar `sizeMap.medium = 64`) with scaled text (`moderateScale(10.5)` name in an `imageSize + moderateScale(6)` box), so avatars look tiny and names truncate hard on iPad. | `CircularReciterCard.tsx:241-248, 255, 280-283` | P1 |
| H5 | Performance / Bug | `getItemLayout` hard-codes lengths (circular 80, recent 200, default 140) that ignore real widths (203–237pt on iPad, plus the gap). With `windowSize={3}` and `removeClippedSubviews`, the list mis-predicts offsets, so cards can render blank while scrolling. This is worse on iPad, where the error is largest. | `RecitersView.tsx:145-179` | P1 |
| H6 | Layout | Heroes stack full-width: a 720×254 mosaic plus a 720×127 ribbon take about 400pt before any content (11"). Apple Music iPad puts 2–3 featured tiles side by side. | `HeroSection.tsx:42-57`; `BrowseAllHero.tsx:68`; `RandomRecitationHero.tsx:473` | P1 |
| H7 | Visual | No screen title. Apple Music and Spotify on iPad open Home with a large title ("Home") or a greeting, and the iPad sidebar already labels the tab, but the page itself has no anchor. On glass devices the header is hidden. | `index.tsx:10-12` | P2 |
| H8 | UX | The random-recitation hero gives no feedback on iOS: `showToast` only fires on Android, so tapping just starts audio somewhere. | `RandomRecitationHero.tsx:35-39, 81` | P2 |
| H9 | Input | No hover lift or highlight on any card. No context menu: Continue Listening long-press opens the `home-card-options` bottom sheet, and other shelf cards have no secondary action at all. No shelf paging arrows for trackpad users (Apple Music shows ‹ › on hover). | `RecentReciterCard.tsx:226-238`; `RecitersView.tsx:275-334` (no `onLongPress`) | P1 |
| H10 | Accessibility | Heroes, rewayat, playlist and reciter cards have no `accessibilityRole` or `accessibilityLabel`. The recent card has two adjacent pressables (image goes to the profile, bottom resumes) with no labels and a disabled `Slider` that VoiceOver may announce. Fixed card heights clip text at larger Dynamic Type sizes. | `BrowseAllHero.tsx:263-309`; `RandomRecitationHero.tsx:124-143`; `RecentReciterCard.tsx:289-382`; `BrowseReciterCard.tsx:166-171` | P1 |
| H11 | Navigation | Every card links to `/(tabs)/(a.home)/reciter/[id]` by absolute path, so in the Search or Collection tab, tapping a reciter card jumps to the Home tab's stack. | `BrowseReciterCard.tsx:141-144`; `CircularReciterCard.tsx:378-381`; `RecentReciterCard.tsx:299-301`; `RewayatCard.tsx:39`; `PlaylistCard.tsx:678-681` | P1 |
| H12 | Visual | Each shelf has its own card style: square tinted tiles for playlists, text tiles for rewayat, portrait photo tiles for reciters, circles for favourites, bento tiles for adhkar. On a big canvas this reads as noise. Apple Music keeps shelf types to a few strict aspect ratios. | `RecitersView.tsx:229-334` | P2 |

### Proposed iPad design

Reference: **Apple Music iPad "Home" and "Browse"** shelves, plus **Spotify iPad Home** for the "jump back in" grid.

- **Width:** uncapped (§5.3). Section titles and the first shelf item align to the §5.2 page margin (24 / 32 / 40 for medium / expanded / large). Shelves bleed past the trailing margin, so the next card peeks (§10.1).
- **Screen title** "Home" in `title1` (§4.1: 28pt tablet) on non-glass devices; `headerLargeTitle` on glass. See the proposed changes for whether the home and browse roots should use `display` instead.
- **Hero row** (`medium`+): one row 180pt tall. `BrowseAllHero` takes 2/3 of the width and `RandomRecitationHero` takes 1/3, radius `lg` 20 (§5.4).
  - Labels: `overline`.
  - Titles: `title2` (22).
  - `compact` keeps the phone stack.
- **"Jump back in" (Continue Listening):**
  - `medium`: a horizontal shelf sized by the column math below.
  - `expanded`+: a 2-row grid of *horizontal* resume tiles, like Spotify's "Recently played" grid, with 3 columns at `expanded` and 4 at `large`:

    | element | style |
    |---|---|
    | artwork | 64pt, radius `sm` |
    | reciter | `headline` |
    | surah | `footnote` |
    | progress bar | — |
    | remaining time | `caption` |

    Reuse `RecentReciterCard` logic with a new `layout="row"` variant.
- **Shelves:** item width = the §10.1 column width for `minCard` 160, so shelf cards line up with any grid below. That gives `colW = (pane - (cols-1)·gutter) / cols`, with the gutter from §5.2.

| window (shell) | class | pane | cols | item width | circle avatars visible |
|---|---|---|---|---|---|
| iPad mini portrait 744 (rail 88) | medium | 608 | 3 | ≈192 | 6 |
| 11" portrait 834 (rail 88) | medium | 698 | 4 | ≈163 | 7 |
| 13" portrait 1024 (sidebar 240) | expanded | 720 | 4 | ≈165 | 7 |
| 11" landscape 1210 (sidebar 240) | expanded | 906 | 5 | ≈165 | 9 |
| 13" landscape 1366 (sidebar 280) | large | 1006 | 5 | ≈182 | 10 |

  Artwork stays within the §10.1 range (140–200). Use `snapToInterval = colW + gutter` so a trackpad or flick lands on whole cards. Show ‹ › paging buttons beside the section's "See all" when a pointer hovers over the shelf.
- **Type (§4.1 roles):**

  | role | element |
  |---|---|
  | `title2` (22) | section titles |
  | `callout` (15) | card title (see the proposed changes for a SemiBold variant) |
  | `footnote` (13) | card subtitle |
  | `caption` (12) | progress time and badges |
  | `overline` | hero eyebrows |

  Every sub-11pt size listed in H2 goes away. Card subtitles use `textSecondary` at full strength, not 0.5 alpha (§12 contrast).
- **Shelf card set:** normalize to three shapes.
  - Square artwork (reciter, playlist): 1:1 image, radius about 6% of the edge (§5.4), with title and subtitle *below* the card as in Apple Music.
  - Circle: favourites, avatar 96pt.
  - Wide text tile: rewayat and adhkar at 1.6:1, radius `card` 14.
- **Interaction:**
  - Hover uses the §7.2 token (`Color(text).alpha(0.04)`). Glass devices may add the system lift.
  - Secondary actions are a context menu on `medium`+ (§8), opened by long-press or secondary click (§7.2): Play, Shuffle, Add to Queue, Favorite, Go to Reciter, Share. `home-card-options` stays the `compact` bottom sheet.
  - Random hero: show a transient "Playing Al-Mulk · Alafasy" banner.

```
iPad landscape (window 1210, class expanded, sidebar 240, margin 32, pane ≈ 906)
┌────────┬──────────────────────────────────────────────────────────────┐
│Sidebar │ Home                                                (title1 28)  │
│        │ ┌───────────────────────────────────────┐ ┌────────────────┐ │
│ Home • │ │  EXPLORE        (mosaic)              │ │ RANDOM         │ │
│ Surahs │ │  Every voice, one tap            ›    │ │ Surprise me  ▶ │ │
│ Search │ └───────────────────────────────────────┘ └────────────────┘ │ 180
│ Collec │ Jump back in                                     Clear       │
│ Setti  │ ┌────────────────┐┌────────────────┐┌────────────────┐       │
│        │ │▢ Alafasy       ││▢ Husary        ││▢ Minshawi      │       │
│        │ │  Al-Kahf ▬▬─ 4m││  Yasin ▬──  12m││  Mulk ▬▬▬─ 1m  │       │
│        │ ├────────────────┤├────────────────┤├────────────────┤       │ 2×3
│        │ │▢ …             ││▢ …             ││▢ …             │       │
│        │ └────────────────┘└────────────────┘└────────────────┘       │
│        │ Featured reciters                                   ‹  ›     │
│        │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌──   5 cols + peek  │
│        │ │ img │ │ img │ │ img │ │ img │ │ img │ │                  │
│        │ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └──                │
│        │ Name    Name    Name    Name    Name   (callout/footnote)   │
│ ▶ mini │ Your favourites   ◯ ◯ ◯ ◯ ◯ ◯ ◯ ◯ ◯                           │
└────────┴──────────────────────────────────────────────────────────────┘
```
Portrait, 11" (`medium`, rail 88, pane 698): same order. "Jump back in" is a shelf, and reciter shelves show 4 columns plus a peek.

### Implementation notes
- `RecitersView.tsx`: take `usePaneWidth()` and `useGridColumns({minCard:160})`, size items per variant, and fix `getItemLayout` to use `colW + gutter` (or drop it). Add the `title1` screen title. **M**
- `HeroSection.tsx` / `RecitersHero.tsx`: add a row layout at `medium`+, a fixed 180pt height, and ramp type. **S**
- `RecentReciterCard.tsx` and `recentCardStyles.ts`: add a `layout="row"` variant, move to `@/utils/scale` (§3) and the ramp, add a11y labels ("Resume Al-Kahf by Alafasy, 4 minutes left"). **M**
- `CircularReciterCard.tsx`, `BrowseReciterCard.tsx`, `PlaylistCard.tsx`, `RewayatCard.tsx`: switch to `@/utils/scale` and the ramp, put the title below the artwork, add an `href` prop (or tab-relative route) instead of hard-coded `(a.home)`, add hover and context menus. **M** each, **L** total.
- `RandomRecitationHero.tsx`: iOS feedback, a11y label. **S**

---

## Browse all reciters: `/browse-all` and `/reciter/browse`

**Files:** `browse-all.tsx`, `reciter/browse.tsx`, `components/browse/{BrowseReciters,BrowseGrid,BrowseReciterCard,FilterModal}.tsx`. Also used by `(b.search)/browse-all.tsx` and `(b.search)/reciter/browse`.
**What it is:** a searchable, filterable grid of every reciter, with a qirāʾah/rāwī chip hierarchy and an advanced filter modal. In `surahId` mode (from Surahs or the "pick a reciter" flow), tapping a card plays immediately and goes back.
**Current iPad behavior:** the column count comes from the window width (`floor(834/203) = 4`) and so does the card width (189pt), but the cards render in a 720pt column with 17pt side padding: 4×189 + 3×17 = 807pt in 686pt of space. The row uses `space-between` with fixed-width children, so the 4th card overflows and is clipped (on 13": 933pt in 681pt, so the 4th card is entirely off-screen and the 3rd is cut). The search field is an inline phone field. On glass devices it sits below the native header instead of in it. The filter button opens a full-width bottom sheet.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| B1 | Layout / Bug | Columns and item width use `useWindowDimensions().width`. The padding is also inconsistent: `gridContainer.paddingHorizontal = moderateScale(10)` (20 total) vs `totalHorizontalPadding = moderateScale(16)`, so even phones overflow by about 4pt. | `BrowseGrid.tsx:74-81, 94-105, 36` | **P0** |
| B2 | Layout | `Math.max(3, …)` with a `moderateScale(120)` minimum means at most 4 large cards, while Apple Music's artist grid shows 5–7. Cards are 1.2:1 portrait with an 18.6pt name. | `BrowseGrid.tsx:79-80, 99` | P1 |
| B3 | Performance | `React.memo` compares only `reciters.length`, so a filter change that yields the same count (e.g. switching rāwī) won't re-render the grid. That is a stale-results bug on any device. | `BrowseGrid.tsx:181-188` | P1 |
| B4 | UI | Search is an in-content `SearchInput` instead of the native header search (`Stack.SearchBar` is already used in `BrowseSurahs.tsx:489`). The filter icon button has no a11y label. The whole screen is wrapped in `TouchableWithoutFeedback` to dismiss the keyboard, which interferes with VoiceOver focus. | `BrowseReciters.tsx:547, 569-601` | P1 |
| B5 | Input | `FilterModal` is an RN `Modal` sliding a full-width sheet to 82% height. On iPad it should be a 560pt form sheet or a trailing side panel (§8). | `FilterModal.tsx:103-109, 310-314` | P1 |
| B6 | UX | `surahId` mode: tapping a card *plays immediately and pops* (`router.back()`). On iPad, where the user is often in a two-pane mental model, this is surprising and gives no confirmation. Apple Music's "Play next/Play" is explicit. | `BrowseReciters.tsx:472-493` | P2 |
| B7 | Typography | Chips are 12pt base (20pt on iPad) at 50% alpha. The "ʿan" separator uses Amiri italic 14pt, mixing scripts and weights. | `BrowseReciters.tsx:786-830` | P2 |
| B8 | Input | No ⌘F to focus search, no arrow-key grid navigation, no hover on cards, no context menu (Favorite / Play random surah / Share). | — | P1 |

### Proposed iPad design

Reference: **Apple Music iPad "Artists" grid / Spotify iPad search "Browse all"**. Filters follow the §8 panel policy.

- Uncapped width (§5.3), inside the §5.2 margins. Columns come from §10.1 with `minCard` 160 and the class gutter, computed on the pane width, never the window:

| window (shell) | class | pane | columns | card width |
|---|---|---|---|---|
| phone | compact | — | 3 (unchanged) | — |
| iPad mini portrait 744 (rail 88) | medium | 608 | 3 | ≈192 |
| 11" portrait 834 (rail 88) | medium | 698 | 4 | ≈163 |
| 13" portrait 1024 (sidebar 240) | expanded | 720 | 4 | ≈165 |
| 11" landscape 1210 (sidebar 240) | expanded | 906 | 5 | ≈165 |
| 13" landscape 1366 (sidebar 280) | large | 1006 | 5 | ≈182 |

  Cards are a 1:1 photo (radius about 6% of the edge, §5.4). The name (`callout`, 2 lines, see the proposed changes for SemiBold) and the rewayah summary (`footnote`) sit **below** the image, not inside a tinted box. Rows are built by `LegendList numColumns`, not hand-made row arrays.
- **Header:**
  - On glass: native large-title "Reciters" with `Stack.SearchBar` (`hideWhenScrolling={false}` on iPad) and a `headerRight` filter button (SF `line.3.horizontal.decrease.circle`, `accessibilityLabel` "Filters", with a badge showing the active filter count).
  - On non-glass: the same layout in the custom header.
  - ⌘F focuses search (§7.3).
- **Chips:** a sticky toolbar row under the header, horizontal scroll, `callout` (15) text, 44pt hit area (§7.1) on a 32pt visual. The selected chip is filled (`text` background, `background` text, the primary-button tokens). Keep the teacher → student hierarchy.
- **Filters (§8):** these are a settings or content panel that relates to what is on screen.
  - `medium`: a centered form sheet, max 560.
  - `expanded`+: a trailing side panel (360–400pt), with the grid reflowing to the remaining pane and filters applied live with no Apply button.
  - `compact`: keep the bottom sheet.
- **Result line:** "42 reciters · Clear all" right-aligned in the chip row instead of a separate row.
- **surahId mode:** keep tap-to-play, but show the card's play badge on hover/focus and a toast "Playing Al-Kahf · Alafasy". The title becomes "Choose a reciter for Al-Kahf".

```
iPad landscape (window 1210, expanded, sidebar 240, pane ≈ 906; 4 columns while the 360pt filter panel is open)
┌────────┬──────────────────────────────────────────────────────────────┐
│Sidebar │ ‹ Reciters                          [🔍 Search reciters ] [⚟2]│
│        │ [All] [Nafiʿ] [Ibn Kathir] [Abu ʿAmr] [ʿAsim] …   42 · Clear │
│        │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│        │ │ img  │ │ img  │ │ img  │ │ img  │ │ img  │ │ img  │ (5 col)│
│        │ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘        │
│        │ Alafasy  Husary   Minshawi Sudais   Shuraim  Ajmi            │
│        │ Hafs     3 rewayat Hafs    Hafs     Hafs     Hafs            │
│        │ ┌──────┐ …          ┃ Filters (side panel 360, §8)  ✕  ┃ │
│        │                     ┃ Style   ▢ Murattal ▢ Mujawwad    ┃ │
│        │                     ┃ Rewayah ▢ Hafs ▢ Warsh …         ┃ │
│        │                     ┃ Sort    Featured ▾               ┃ │
└────────┴──────────────────────────────────────────────────────────────┘
```

### Implementation notes
- `BrowseGrid.tsx`: replace the window math with `useGridColumns`, use `LegendList numColumns`, and fix the memo comparator to compare the `reciters` reference. **M**
- `BrowseReciterCard.tsx`: add a `variant="grid"` with the title below, the capped scale, and hover and context menus. **M**
- `BrowseReciters.tsx`: move search into the native header on glass, add an a11y label to the filter button, remove the screen-wide `TouchableWithoutFeedback` (use `keyboardDismissMode="on-drag"`), add ⌘F with a `UIKeyCommand` bridge or `react-native-key-command`. **M**
- `FilterModal.tsx`: render by width class (§8): bottom sheet at `compact`, 560 form sheet at `medium`, trailing side panel at `expanded`+. **M**

---

## Browse all surahs: `/browse-all-surahs`

**Files:** `browse-all-surahs.tsx`, `components/browse/BrowseSurahs.tsx`, `cards/SurahCard.tsx`, `SurahItem.tsx`. Also `(b.search)/browse-all-surahs`.
**What it is:** an index of all 114 surahs for *listening*, with a card or list toggle, sort (asc/desc/revelation), Juz headers in list mode, and search. Tapping a surah resolves a reciter via settings: sheet, browse, default reciter or random.
**Current iPad behavior:**
- Card view is always 2 columns at `width: '48%'` (cards about 320×203pt in the 720 column) with a 44pt Arabic glyph.
- List view is single-column, with rows of about 76pt and 22pt names.
- Juz headers scroll away; they are not sticky.
- On non-glass devices, a stray native header titled with the route name overlaps the custom header (L2).
- Both lists stay mounted (`display:none`), so 2×114 rows exist at once.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| S1 | Layout | Card grid is fixed at `numColumns={2}` and `width:'48%'`, regardless of width. | `BrowseSurahs.tsx:549, 137` | P1 |
| S2 | Navigation | Undeclared route draws a native header over the custom one on non-glass (see L2). | `_layout.tsx`; `BrowseSurahs.tsx:500` | P0 (non-glass) |
| S3 | UX | No sticky Juz headers and no section index scrubber. Quran.com, Tarteel and Contacts-style indexes let you jump to Juz 30 in one gesture; here it takes about 6 screens of scrolling. | `BrowseSurahs.tsx:229-276, 561-579` (FlatList, no `stickyHeaderIndices`) | P1 |
| S4 | Performance | Both FlatLists are mounted and toggled with `display:none`. `useStyles()` calls `ScaledSheet.create` on every render, and in every `ItemSeparator`. | `BrowseSurahs.tsx:532-580, 54-57, 168` | P2 |
| S5 | Accessibility | Sort buttons and the view-mode toggle have no labels, roles or selected state. The toggle is icon-only. | `BrowseSurahs.tsx:393-454` | P1 |
| S6 | Navigation | `router.push({pathname:'./reciter/browse'})` is a relative push. It works per-stack but is fragile and inconsistent with the absolute `(a.home)` links elsewhere. | `BrowseSurahs.tsx:292-302` | P2 |
| S7 | Input | No hover, no context menu (Play with default reciter / Choose reciter / Open in Mushaf), no type-to-jump ("36" goes to Yasin) on a hardware keyboard. | — | P2 |

### Proposed iPad design

Reference: **Quran.com / Tarteel surah index** (segmented Surah | Juz | Revelation) and **iOS section index** (Contacts/Music "Songs" A–Z scrubber).

- Uncapped width (§5.3), with the §5.2 margins.
- **Header:**
  - A `title1` "Surahs" title and native search (⌘F, §7.3).
  - A toolbar row with a segmented control `[Surah | Juz | Revelation]`. This replaces the asc/desc/revelation buttons; "Descending" moves into a "Sort ▾" pull-down menu (§8, a short action list becomes a menu on `medium`+).
  - A grid/list view toggle at the far right with an `accessibilityLabel` (§12).
- **List mode** (default on `medium`+):
  - At `expanded`+, a **2-column list**. Rows have a 56pt `minHeight` (§4.3) and carry:
    - the number badge
    - the transliterated name (`headline`)
    - English meaning plus verse count (`footnote`)
    - the Arabic glyph name (28pt `SurahNames`, a glyph font outside the UI ramp) trailing
  - Juz headers use `overline` and are sticky (`stickyHeaderIndices`, or SectionList).
  - A right-edge **Juz scrubber 1–30** appears at `medium`+, with 44pt-wide hit areas (§7.1).
- **Card mode:** §10.1 with `minCard` 120 (surah tiles):

| window (shell) | class | pane | columns |
|---|---|---|---|
| iPad mini portrait 744 | medium | 608 | 4 |
| 11" portrait 834 | medium | 698 | 5 |
| 13" portrait 1024 | expanded | 720 | 5 |
| 11" landscape 1210 | expanded | 906 | 6 |
| 13" landscape 1366 | large | 1006 | 7 |

  Tile aspect ratio about 1:1.1. The glyph sits on top, then the name (`callout`) and meta (`caption`).
- **Context menu per row:** Play (default reciter), Choose reciter…, Open in Mushaf, Add to playlist.
- **Type-to-select:** when a hardware keyboard is attached, typing digits jumps to that surah number. This is not in §7.3; see the proposed changes.

```
iPad landscape (window 1210, expanded, pane ≈ 906): 2-column list
┌────┬───────────────────────────────────────────────────────────┐
│ sb │ Surahs                               [🔍 Search surahs   ]│
│    │ [ Surah | Juz | Revelation ]          Sort ▾    ☰ / ▦     │
│    │ JUZ 1 ───────────────────────────────────────────── (sticky)│
│    │ ① Al-Fatihah  The Opening · 7     ﭑ │ ② Al-Baqarah … ﭒ  │1
│    │ JUZ 3 ──────────────────────────────────────────────     │2
│    │ ③ Ali ʿImran  Family of ʿImran ﭓ │ ④ An-Nisaʾ …    ﭔ   │…
│    │ …                                                        │30
└────┴───────────────────────────────────────────────────────────┘
```

### Implementation notes
- `BrowseSurahs.tsx`:
  - Mount only the active list.
  - Memoize styles.
  - Add a sticky-header SectionList, or `FlashList` with `stickyHeaderIndices`.
  - Make columns width-driven, add the segmented control, add a11y labels.
  - **M–L**
- New `components/browse/SectionIndexScrubber.tsx` (tablet only; reusable for the Surahs tab). **M**
- `SurahItem.tsx`, `SurahCard.tsx`: capped scale and the ramp. **M**

---

## Reciter profile: `/reciter/[id]`

**Files:** `reciter/[id].tsx`, `components/reciter-profile/{ReciterProfile, components/ReciterHeader, ActionButtons, RewayatTabBar, SurahList, SearchView, NavigationButtons, UploadsTabContent, styles}`. Also the Search and Collection tabs' `reciter/[id]`.
**What it is:** an artist page. Avatar, name and counts; Play All, Shuffle, Favorite and Download All; a sticky rewayah tab bar with sort, loved filter and view toggle; a horizontally paged list of surahs per rewayah (plus "My uploads"); a search overlay.
**Current iPad behavior (11"):**
- **Header:** an 81pt avatar, a 20pt meta line, and a **54pt ExtraBold name** (63pt on 13").
- **Action buttons:** Play All is a full-width, 85pt-tall slab. The Shuffle, Favorite and Download pills are each 74pt tall.
- **Rewayah pager:** pages are 834pt wide inside a 720pt pager, so each surah row's right 114pt is clipped. That hides the download and loved indicators and the `…` button.
- **Swiping:** swipes snap to multiples of 720 while page content sits at multiples of 834, so after one swipe the left 114pt of the previous rewayah is visible.
- **Tab indicator:** interpolates on 834 steps and drifts.
- **Rendering:** all 114 rows render un-virtualized inside the outer ScrollView, for each visited tab.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| R1 | Layout / Bug | Pager page width, initial offset, `scrollTo`, page detection and indicator ranges all use window `screenWidth`, not the pager's width. | `ReciterProfile.tsx:219, 264-271, 891, 917, 931, 970, 1117, 1237`; `RewayatTabBar.tsx:73, 92, 109, 129, 143` | **P0** |
| R2 | Typography | Name `moderateScale(32)` with line height 38 grows to 54/64pt. The meta is only 12pt base. There is no middle step in the hierarchy. | `ReciterHeader/index.tsx:104-117` | P1 |
| R3 | UI | Play All is a full-width 50pt-base slab, plus a row of three 44pt-base pills, each stretched across the column. Apple Music and Spotify use two compact pills (Play, Shuffle) and icon buttons for secondary actions. | `ActionButtons/index.tsx:186-225` | P1 |
| R4 | Layout | The header is phone-shaped: a small avatar beside the meta, the name below, everything left-aligned in 720pt with no artwork moment. iPad artist pages lead with a large image and a two-column arrangement. | `ReciterHeader/index.tsx:64-82` | P1 |
| R5 | UX / Input | A swipe pager for rewayat inside a vertical ScrollView competes with the sidebar edge-swipe and trackpad scrolling. On iPad, the tab bar alone (tap or ⌘1–9) is the expected pattern (Apple Music artist sections, Spotify tabs). | `ReciterProfile.tsx:1215-1283` | P1 |
| R6 | Performance | Inline lists render every surah without virtualization (`visibleSurahs.map`, `visibleData.map`), and visited tabs stay mounted. A 4-rewayah reciter mounts 400+ rows. Item heights are larger on iPad, but the row count is the same. | `SurahList/index.tsx:300-344`; `ReciterProfile.tsx:1233-1279` | P2 |
| R7 | Accessibility | Header share/search icons (glass) and `NavigationButtons` (non-glass) have no labels. Sort buttons have no selected state. The loved-filter heart and view toggle are unlabeled. | `ReciterProfile.tsx:303-336, 1124-1201`; `NavigationButtons/index.tsx` (no a11y props) | P1 |
| R8 | UI | Search opens a full-screen overlay (`StyleSheet.absoluteFill`) that hides the profile. The iPad pattern is a header search field that filters in place. | `ReciterProfile.tsx:1371-1402`; `SearchView/index.tsx` | P2 |
| R9 | Input | Surah rows' `…` opens the `surah-options` bottom sheet. No context menu, no hover row highlight, no drag of a surah to a playlist in the sidebar. | `ReciterProfile.tsx:1263-1272` | P1 |
| R10 | Docs | `components/reciter-profile/README.md` describes a folder layout (`components/ReciterProfile/`) and props (`showFavorites`) that no longer exist. | `README.md:4-21, 41-46` | P2 |

### Proposed iPad design

Reference: **Apple Music iPad artist and album page** (artwork left, title block right, track table below) and **Spotify iPad artist page** (Play and Shuffle pills, compact secondary icons).

- Uncapped width (§5.3), §5.2 margins. Primary actions stay visible without scrolling (§10.2 MUST).
- **`compact`:** keep the phone design, with the R1 pager fix.
- **`medium`+, album-header layout** (§10.2 asks for it at `expanded`+; this audit also proposes it for `medium`, see the proposed changes):
  - **Header row:** avatar on the leading side, **200pt** at `medium` and **240pt** at `expanded`, **280pt** at `large` (§10.2), radius `lg` 20. Beside it:
    - eyebrow "RECITER" (`overline`)
    - name (`display`, 34 on tablet, 2 lines)
    - meta "114 surahs · 3 rewayat" (`callout`, `textSecondary`)
    - a button row:

    | button | style |
    |---|---|
    | **▶ Play** | primary-button tokens (`text` background), `pill` radius, 44pt tall, min width 140, label `callout` |
    | **⤨ Shuffle** | card-background tint, `pill` radius, 44pt tall |
    | ☆ Favorite (§10.2 "Follow") | 44pt circular icon button with an `accessibilityLabel` |
    | ↓ Download all | 44pt circular icon button with an `accessibilityLabel` |
    | ⋯ More (Share, Go to rewayah info) | 44pt circular icon button with an `accessibilityLabel`; opens a context menu (§8) |

  - **Sticky toolbar:**
    - Leading: rewayah tabs (segmented style, `callout`).
    - Trailing: one "Sort ▾" pull-down menu instead of three buttons (§8), plus the loved and view toggles, each with an `accessibilityLabel` and `accessibilityState` (§12).
    - On glass, an in-place header search field filters the list instead of the overlay.
  - **Track table** below the header at **full pane width** (§10.2), list view:

    | column | width / style |
    |---|---|
    | # | 40pt |
    | surah name (`headline`) + translation (`footnote`) | flex |
    | Arabic glyph | 120 |
    | ↓ / ♥ state icons | 64 |
    | ⋯ | 44 |

    Rows are 56pt `minHeight` with the §7.2 hover token. Each row is one VoiceOver element (§12). Card view: §10.1 with `minCard` 120.
- **Rewayat switching:** tab taps only, no horizontal pager, at `medium`+. This also satisfies §7.2 (no swipe-only functionality). ⌘[ / ⌘] cycle tabs (not in §7.3; see the proposed changes). On `compact` the pager stays, with its width taken from `onLayout` of the pager itself.
- **Optional landscape two-pane** (the first wireframe below): a sticky leading 300pt artist panel with tracks scrolling beside it. This departs from §10.2's "tracks below at full width" and is offered in the proposed changes, not as the default.

```
OPTIONAL: iPad landscape two-pane (window 1210, expanded, sidebar 240), see the proposed changes
┌────────┬───────────────────┬─────────────────────────────────────────┐
│Sidebar │ ┌───────────────┐ │ [Hafs] [Warsh] [Qalun] [Uploads]  Sort▾ ♥ ▦│
│        │ │               │ │ #  Surah                    ﭑ   ↓♥   ⋯ │
│        │ │   avatar 260  │ │ 1  Al-Fatihah  The Opening  ﭑ   ↓    ⋯ │
│        │ │               │ │ 2  Al-Baqarah  The Cow      ﭒ   ↓ ♥  ⋯ │
│        │ └───────────────┘ │ 3  Ali ʿImran  Family of…   ﭓ        ⋯ │
│        │ RECITER           │ 4  An-Nisaʾ    The Women    ﭔ        ⋯ │
│        │ Mishary Alafasy   │ …  (56pt rows, hover highlight,        │
│        │ 114 surahs · 3 rw │     right-click / long-press → menu)   │
│        │ [▶ Play        ]  │                                         │
│        │ [⤨ Shuffle     ]  │                                         │
│        │  ☆   ↓   ⋯        │                                         │
└────────┴───────────────────┴─────────────────────────────────────────┘
          sticky 300pt panel     independent scroll
```
```
DEFAULT (§10.2): iPad portrait 11" (medium, rail 88, pane ≈ 698). Expanded is the same with a 240 avatar.
┌────┬───────────────────────────────────────────────────────┐
│rail│ ┌────────┐  RECITER                                   │
│    │ │avatar  │  Mishary Alafasy         (display 34)      │
│    │ │ 200    │  114 surahs · 3 rewayat                    │
│    │ └────────┘  [▶ Play] [⤨ Shuffle]  ☆  ↓  ⋯             │
│    │ [Hafs] [Warsh] [Qalun] [Uploads]        Sort▾  ♥  ▦    │ sticky
│    │ #  Surah                         ﭑ        ↓♥    ⋯      │
│    │ 1  Al-Fatihah   The Opening      ﭑ        ↓     ⋯      │
└────┴───────────────────────────────────────────────────────┘
```

### Implementation notes
- **Immediate P0 fix (S):** measure the pager with `onLayout` (`pagerWidth`) and replace every `screenWidth` in `ReciterProfile.tsx` and `RewayatTabBar.tsx` with it. Extend `utils/pagerLayout.ts` and its test.
- `ReciterHeader`: add a `layout: 'stacked' | 'album'` chosen by width class (§2), plus `'panel'` only if the optional two-pane is accepted; ramp type (§4.1). **M**
- `ActionButtons`: pill and icon variants, with tooltips through `accessibilityLabel`. **M**
- `ReciterProfile.tsx`: `medium`+ branch with the album header, tab-only switching, a virtualized `FlashList` per active tab (unmount inactive tabs on tablet), header search in place of the overlay. **L**
- Context menu on `SurahItem` (shared with Surahs and Search). **M**
- Rewrite `README.md`. **S**

---

## Playlist detail: `/playlist/[id]`

**Files:** `playlist/[id].tsx`, `components/playlist-detail/{PlaylistDetail,PlaylistHeader}.tsx`, `components/TrackItem.tsx`, `hooks/useCollectionNativeHeader.ts`, `components/collection/CollectionStickyHeader`. Also `(c.collection)/playlist/[id]`.
**What it is:** a user playlist. Centered icon, title, count; ⋯ / Play / Shuffle circle buttons; a FlatList of `TrackItem`s; options through bottom sheets.
**Current iPad behavior:**
- **Header:** a 108pt icon circle with a generic glyph instead of artwork, a 29pt title and centered 71pt circle buttons in a 720 column.
- **Rows:** 85pt artwork and 24–27pt text.
- **No reordering:** no drag reorder or edit mode, and the playlist does not refresh if edited elsewhere (it loads once on mount).
- **Non-glass:** a likely double back button (L3).

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| P1 | Layout | A centered phone header: generic `PlaylistIcon` in a 64pt-base circle with buttons beneath. It doesn't use the playlist colour or the reciters' artwork (Apple Music uses a 2×2 artwork mosaic). | `PlaylistHeader.tsx:56-101, 133-145` | P1 |
| P2 | UX | No reordering, no multi-select, no edit mode. "Remove" is only reachable through each row's options sheet. | `PlaylistDetail.tsx:185-195, 351-379` | P1 |
| P3 | Input | No drag and drop: you can't reorder by dragging, drop surahs from a reciter page or the sidebar, or drag rows out. Hardware keyboard: no Space to play, no ⌫ to remove. | — | P1 |
| P4 | Accessibility | Play, Shuffle and ⋯ circle buttons (header and `headerRight`) have no labels or roles. | `PlaylistHeader.tsx:74-98`; `PlaylistDetail.tsx:331-342` | P1 |
| P5 | UI | Options and edit go through stacked bottom sheets (`playlist-context` then `create-playlist`). On iPad: a pull-down menu from ⋯ and a form sheet for edit. | `PlaylistDetail.tsx:269-321` | P2 |
| P6 | Bug | `handleShowTrackOptions` deps `[addToQueue]` omit `handleRemoveFromPlaylist`, so remove can call a stale closure after edits. The loading state is plain text "Loading…". | `PlaylistDetail.tsx:351-379, 424-429` | P2 |
| P7 | Navigation | Double back affordance on non-glass (L3). | `_layout.tsx:45`; `PlaylistHeader.tsx:42-53` | P1 |

### Proposed iPad design

Reference: **Apple Music iPad playlist page**.

- Uncapped width (§5.3). The same §10.2 album-header grammar as the reciter profile, so the two pages read as one system.
  - **Artwork:** 200pt at `medium`, 240 at `expanded`, 280 at `large`, on the leading side. It is a mosaic of the first four reciter images over the playlist colour; the fallback is the `PlaylistIcon` on a colour gradient.
  - **Beside it:**
    - eyebrow "PLAYLIST" (`overline`)
    - title (`display`)
    - meta "12 surahs · 3h 20m" (`callout`)
    - `[▶ Play] [⤨ Shuffle]` pills
    - a ⋯ menu (§8 context menu on `medium`+): Edit, Rename/Colour, Delete. Delete confirms with an Alert, per §8.
  - **Edit and rename:** "Rename/Colour" opens `create-playlist` as a 560pt form sheet (§8), not a stacked bottom sheet.
- **Track table:**

  | column | width |
  |---|---|
  | drag handle (edit mode only) | 32 |
  | # | 40 |
  | artwork | 44 |
  | surah name + reciter | flex |
  | rewayah | 160, wide only |
  | duration | 64 |
  | ⋯ | 44 |

  Rows are 56pt `minHeight`: `headline` title, `footnote` reciter. The table is full pane width (§10.2). An **Edit** button in the header puts the table into reorder mode (`react-native-draggable-flatlist` / `react-native-reorderable-list`). Swipe left to remove is only a shortcut: Remove is also in the row menu and in edit mode (§7.2 MUST NOT be swipe-only).
- **Context menu on each row:** Play, Play Next, Add to Queue, Go to Reciter, Remove from Playlist. On pointer devices, a right-click opens the same menu.
- **Drop target:** accept dragged surahs from reciter or surah lists (iPadOS drag and drop via `react-native-draglist` or a native module; phase 2).

```
iPad portrait
┌────┬────────────────────────────────────────────────────┐
│rail│ ┌──┬──┐  PLAYLIST                                  │
│    │ │▢ │▢ │  Morning recitations     (display 34)      │
│    │ ├──┼──┤  12 surahs · 3h 20m                        │
│    │ │▢ │▢ │  [▶ Play] [⤨ Shuffle]     ⋯ (menu)  Edit    │
│    │ └──┴──┘                                            │
│    │ ≡ 1 ▢ Al-Mulk      Alafasy        Hafs   9:12   ⋯   │
│    │ ≡ 2 ▢ Yasin        Minshawi       Hafs  14:05   ⋯   │
└────┴────────────────────────────────────────────────────┘
```

### Implementation notes
- `PlaylistHeader.tsx`: album layout on tablet, mosaic artwork component, a11y labels. **M**
- `PlaylistDetail.tsx`: reorderable list plus edit mode, context menus, fix the stale deps, skeleton loading, subscribe to playlist changes. **L**
- `_layout.tsx`: `headerShown: USE_GLASS` for `playlist/[id]`. **S**
- Shared new `components/layout/AlbumHeader.tsx` used by the playlist, the reciter profile, Loved and Downloads headers (`LovedHeader.tsx`, `ReciterDownloadsHeader.tsx`). **M**

---

## Translations and tafāsīr: `/translations`

**Files:** `translations.tsx`, `components/screens/TranslationsContent.tsx`. Duplicate route: `(d.settings)/translations.tsx`.
**What it is:** pick and download the active translation or tafsīr. A header segmented `TabSelector` switches Translations and Tafaseer; inset-grouped "Available" rows come first, then rows grouped by language with download arrows. It is reached from Settings and, from the Mushaf, through the verse actions sheet.
**Current iPad behavior:**
- **Width:** a 720pt column of inset-grouped rows with no maximum reading measure.
- **Text:** 22pt row names (11"); language headers at 17.7pt uppercase.
- **Header control:** the TabSelector is 372pt wide in the header title slot.
- **Long list:** 100+ editions with no search.
- **Selection:** a small 13pt dot marks the active edition.
- **From the Mushaf:** tapping the gear in the verse sheet closes the sheet, hides the player, and pushes this screen onto the **Home** tab stack, so the reader leaves the Mushaf entirely.

### Weaknesses
| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| T1 | Navigation / UX | Opened from the Mushaf, it pushes `/(tabs)/(a.home)/translations`, which switches tab and loses reading context. On iPad it should be a side panel or form sheet over the Mushaf (§8). Tarteel and Quran.com keep the page visible. | `VerseActionsSheet.tsx:782-789`; `TafseerContent.tsx:243` | P1 |
| T2 | Accessibility | The inactive list is hidden with `opacity: 0` plus `pointerEvents:'none'` but stays in the accessibility tree, so VoiceOver reads both lists. | `TranslationsContent.tsx:944-985` | P1 |
| T3 | UX | No search or filter over 100+ editions across about 40 languages. Settings → Language on iOS and the Quran.com translation picker both have search. | `TranslationsContent.tsx:385-470` | P1 |
| T4 | UI | The active edition is marked by an 8pt-base dot. iOS lists use a trailing checkmark. Delete is a 14pt minus-circle icon button with no label, rather than swipe-to-delete or an Edit mode. | `TranslationsContent.tsx:785-802, 1155-1158` | P2 |
| T5 | Typography | Section headers 10.5pt base, row meta 11.5pt, count 10pt, all inflating unevenly. TabSelector width `moderateScale(220)`. | `TranslationsContent.tsx:1012, 1029, 1036, 1063, 923` | P2 |
| T6 | Layout | A 720pt measure for a settings-style list. The App Store and Settings on iPad use readable widths (about 600–680) or a split view. | `_layout.tsx:16` | P2 |
| T7 | Code health | Two routes render the same screen (Home and Settings). Only one should exist. | `translations.tsx:1`; `(d.settings)/translations.tsx` | P2 |

### Proposed iPad design

Reference: **iOS Settings → General → Language & Region list** and **Quran.com translation picker**.

- **Single source route.** Keep it under Settings, and present it according to §8 (the translations picker is reading-adjacent):
  - From the **Mushaf** at `expanded`+: a **trailing side panel** (360–400pt), so the page stays visible. Choosing an edition updates the open page live.
  - From the **Mushaf** at `medium`: a centered **form sheet, max 560** with a Done button.
  - From the **Settings** stack: a normal push, with the list at the §5.3 form width of **640**, centered, or leading in the split-view detail pane (§6).
  - At `compact`: today's behavior, with no tab switch.
- **Header:**
  - Title "Translations".
  - Segmented control `[Translations | Tafāsīr]` as a toolbar under the nav bar, 280pt wide, `pill` radius.
  - Native search field: "Search language or translator" (⌘F, §7.3).
- **Sections:**
  1. **Active**: one row with a checkmark.
  2. **Downloaded**: Edit button, with swipe-to-delete only as a shortcut (§7.2).
  3. **By language**: sticky `overline` headers. Check their contrast against all 14 reading themes (§12).
  4. At `medium`+ in the 640 form column, a right-edge A–Z language index.
- **Rows:** `minHeight` 52.
  - English name in `headline`.
  - Native name in `footnote` `textSecondary`, with `writingDirection` per language.
  - Trailing: a ✓, a ↓ download button (44pt target, §7.1, labelled "Download Sahih International"), or a progress ring.
- Only the active segment's list is mounted, or the hidden one gets `accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"` (§12).

```
iPad form sheet over Mushaf (medium, 560 wide, §8). At expanded+ the same content is a trailing side panel
┌──────────────────────────────────────────────┐
│ Cancel        Translations             Done  │
│        [ Translations | Tafāsīr ]            │
│ [🔍 Search language or translator          ] │
│ ACTIVE                                       │
│ ┌──────────────────────────────────────────┐ │
│ │ Sahih International        English   ✓  │ │
│ └──────────────────────────────────────────┘ │
│ DOWNLOADED                            Edit   │
│ │ Muhammad Asad              English      │  │
│ ENGLISH · 12                                 │
│ │ Pickthall                              ↓ │ │
│ URDU · 9                                     │
│ │ Jalandhry          جالندھری             ↓ │ │
└──────────────────────────────────────────────┘
```

### Implementation notes
- Delete `(a.home)/translations.tsx`. Point `VerseActionsSheet.tsx:788` and `TafseerContent.tsx:243` at a Mushaf-level panel: a side panel at `expanded`+, a 560 form sheet at `medium`, both rendering `TranslationsContent`. This should share whatever side-panel host the Mushaf audit proposes for tafsir and verse actions (§8). **M**
- `TranslationsContent.tsx`: mount only the active list, add search filtering, sticky headers, checkmark, Edit mode plus swipe-to-delete, `@/utils/scale` (§3) and ramp roles (§4.1), a11y labels. **M**

---

## Standards applied, and proposed changes to the standard

### How this audit maps to the standard
| Audit finding | Rule it violates in the current code |
|---|---|
| B1, R1: layout sized from the window inside a narrower column | §10.1 (columns from the pane width); §2.2 (read sizes live) |
| H1–H3, R2–R3, T5: 1.7–2x inflation, sub-11pt text | §3 (`@/utils/scale` only); §4.1 (ramp; no sizes outside it) |
| L4, H3, B2: 720 cap on grids and shelves | §5.3 MUST NOT |
| B5, P5, T1, H9, R9: bottom sheets on iPad | §8 |
| H9, B8, S7, R9, P3: no hover, secondary click or shortcuts | §7.2, §7.3 |
| H10, R7, P4, S5, T2: missing labels, VoiceOver reads hidden list | §12 |
| L3, P7: double back affordance | §6 (visible back affordance) |
| R5: swipe pager | §7.2 (no swipe-only functionality) |

### Proposed changes to the standard

1. **§10.1 / §2.2: say where "paneWidth" comes from.** Width *classes* are correctly read from the window, but the two P0 bugs in this group (B1, R1) are both caused by using the *window* width as the *pane* width. Proposed MUST:
   > Grids, pagers and shelves size themselves from the measured pane (`onLayout`, or a `usePaneWidth()` context that the shell provides), never from `useWindowDimensions().width`.

   §2.2's "read sizes with `useWindowDimensions()`" should be scoped to choosing the class.
2. **§10.1: define how shelves use the column math.** Proposed rule:
   - Shelf item width = the grid column width for the same `minCard`.
   - The shelf's first item aligns to the page margin and the shelf bleeds past the trailing margin (that is the peek).
   - `snapToInterval = colW + gutter`.
   - Also add a `minCard` for circular avatars (proposed: 96pt avatar, which gives 7 visible at 11" portrait).
3. **§4.1: allow a weight variant per role.** Card and grid titles need `callout` size (15) at SemiBold, but the ramp fixes `callout` at Medium. Proposed: each role may take one heavier weight (`callout.emphasis` = SemiBold) without becoming a new size. Otherwise card titles would have to jump to `headline` (17), which is too big for a 160pt card.
4. **§4.1: say which role a tab-root screen title uses.** Apple Music and Spotify on iPad use about 34pt large titles on Home and Browse roots, while §4.1 makes `title1` (28) the screen title and `display` (34) the hero title. This audit uses `title1`. Recommend stating explicitly: "tab-root titles use `title1`; glass devices use the native large title, which is 34".
5. **§10.2: extend the album header to `medium`, and size it.** §10.2 starts the two-column header at `expanded`. On an 11" iPad in portrait (`medium`, 834pt), the phone header looks as broken as it does wider up (R2–R4). Proposed:
   - The album header applies from `medium` up.
   - Artwork is 200pt at `medium`, 240 at `expanded`, 280 at `large`.
6. **§10.2: optional sticky artist panel in landscape.** Apple Music's iPad album view in landscape keeps the artwork and actions in a fixed leading column while tracks scroll beside it. This conflicts with §10.2's "tracks below at full width". Proposed MAY:
   > At `expanded`+ landscape with height < 900pt, a detail page may use a sticky leading 300pt panel (artwork, title, actions) with tracks in the trailing pane.

   This keeps primary actions visible on short 11" landscape windows (§10.2 MUST), where the header otherwise scrolls them away.
7. **§7.3: add shortcuts this group needs.**

   | Keys | Action |
   |---|---|
   | ⌘[ / ⌘] | Previous / next sub-tab (rewayah tabs, Translations ↔ Tafāsīr) |
   | Digits typed in a surah list or grid | Jump to that surah number |
   | Return on a focused card | Open it |

8. **§8: say where filters go.** A filter panel is neither "a short action list" nor obviously "a content panel". Proposed:
   - Filter panels for a grid on screen use the trailing side panel at `expanded`+ (the grid reflows) and the 560 form sheet at `medium`.
   - Apply filters live, with no Apply button.
9. **§6: list-detail for reciter browse.** §6 suggests a list-detail split for "reciter browse at `expanded`+". A 320–380pt list pane cannot hold the reciter *grid*. Proposed clarification:
   - Browse stays a full-width grid that pushes the profile.
   - A split only applies to the Collection tab's list-style reciter lists.
10. **New rule (§6 or §2): shared screens must not hard-code a tab path.** Cards hard-code `/(tabs)/(a.home)/…` (H11), so Search and Collection jump to the Home tab. Proposed MUST:
    > Shared components take an `href` builder or use tab-relative routes.
11. **§12: state that layered or hidden views must be removed from the accessibility tree** (T2): `opacity: 0` is not hidden for VoiceOver.
