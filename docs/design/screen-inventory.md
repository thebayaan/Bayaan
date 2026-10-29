# Screen inventory

Every screen, route and overlay surface in the app, on `develop` as of
2026-10-26. Use it as the checklist for any app-wide design work (iPad,
accessibility, theming, RTL) so no screen gets missed.

**Keep this file current.** When you add, remove or move a route under `app/`,
or register a new sheet in `components/sheets/sheets.tsx`, update the matching
table in the same PR.

Legend for **Area**, used to split design work:

- **Shell**: navigation chrome and app-wide layout.
- **Browse**: discovery, library and settings screens (home, search, surahs,
  collection, settings).
- **Reading**: Quran and adhkar text surfaces.
- **Listening**: player and playback surfaces.
- **Link**: a route that exists only to receive a deep link and redirect. It
  renders nothing (or a spinner) and needs no layout work.

## Navigation tree

```
app/_layout.tsx                      Root Stack (fade), PlayerHost, WhatsNewModal, DevMenu, SheetProvider
├── (tabs)/_layout.tsx               Tab shell: NativeTabs (iOS 26+ phone) | JS Tabs + floating pill (Android, older iOS)
│                                     | JS Tabs + TabletSidebar (any tablet)
│   ├── (a.home)/_layout.tsx         Stack, wrapped in MaxWidthContainer (720pt on tablet)
│   │   └── adhkar/_layout.tsx       Nested Stack
│   ├── (b.surahs)/_layout.tsx       Stack, MaxWidthContainer
│   ├── (b.search)/_layout.tsx       Stack with native search bar, MaxWidthContainer
│   ├── (c.collection)/_layout.tsx   Stack, MaxWidthContainer
│   └── (d.settings)/_layout.tsx     Stack, MaxWidthContainer
├── mushaf                           Full-screen reader (only screen that unlocks orientation)
├── adhkar-playing                   Link
├── player                           Link (expands the player sheet)
├── quran/[surah], quran/[surah]/[ayah], mushaf/[page], reciter/[slug]/[surah]   Link
└── +not-found
```

## Tab screens

### Home tab: `app/(tabs)/(a.home)/`

| Route | File | Main components | What it is | Area |
|---|---|---|---|---|
| `/` | `index.tsx` | `components/RecitersView` (`hero/RecitersHero`, `cards/*`, `adhkar/AdhkarBentoCard`) | Home feed: hero, then shelves for continue listening, new to Quran, favorites, featured reciters, adhkar, follow along, playlists, exclusives, tajweed, memorization, rewayat, from your collection | Browse |
| `/browse-all` | `browse-all.tsx` | `components/browse/BrowseReciters`, `BrowseGrid`, `FilterModal` | All reciters grid with filters | Browse |
| `/browse-all-surahs` | `browse-all-surahs.tsx` | `components/browse/BrowseSurahs` | All surahs browse | Browse |
| `/reciter/browse` | `reciter/browse.tsx` | `components/browse/*` | Reciter browse by category | Browse |
| `/reciter/[id]` | `reciter/[id].tsx` | `components/reciter-profile/*` | Reciter profile: hero, surah list, rewayat, uploads | Browse (listening-adjacent) |
| `/playlist/[id]` | `playlist/[id].tsx` | `components/playlist-detail/*` | User playlist detail | Browse |
| `/translations` | `translations.tsx` | `components/screens/TranslationsContent` | Translation picker/downloads | Browse |
| `/adhkar` | `adhkar/index.tsx` | `components/adhkar/*` (bento, category cards) | Adhkar home | Browse |
| `/adhkar/[superId]` | `adhkar/[superId]/index.tsx` | `DhikrListItem`, `PlayAllButton`, `AdhkarSessionPlayer` | Adhkar category list | Browse |
| `/adhkar/[superId]/[dhikrId]` | `adhkar/[superId]/[dhikrId].tsx` | `DhikrReader`, `TasbeehCounter`, `AdhkarArabicText` | Single dhikr reader | Reading |
| `/adhkar/saved` | `adhkar/saved/index.tsx` | `DhikrListItem` | Saved adhkar list | Browse |
| `/adhkar/saved/[dhikrId]` | `adhkar/saved/[dhikrId].tsx` | `DhikrReader` | Saved dhikr reader | Reading |

`(a.home)/_layout.tsx` also declares `settings/*` and `settings/account`
screens that have no files behind them. They are dead entries.

### Surahs tab: `app/(tabs)/(b.surahs)/`

| Route | File | Main components | What it is | Area |
|---|---|---|---|---|
| `/` | `index.tsx` | `components/SurahsView`, `SurahItem`, `SurahCard` | All 114 surahs (list/grid), entry to the Mushaf | Browse |

### Search tab: `app/(tabs)/(b.search)/`

| Route | File | Main components | What it is | Area |
|---|---|---|---|---|
| `/` | `index.tsx` | `components/search/ExploreView` (idle), `SearchView` (results) | Explore bento + search across surahs, reciters, verses | Browse |
| `/browse-all` | `browse-all.tsx` | `BrowseReciters` | Same as Home's | Browse |
| `/browse-all-surahs` | `browse-all-surahs.tsx` | `BrowseSurahs` | Same as Home's | Browse |
| `/reciter/browse` | `reciter/browse.tsx` | `components/browse/*` | Same as Home's | Browse |
| `/reciter/[id]` | `reciter/[id].tsx` | `components/reciter-profile/*` | Same as Home's | Browse |
| `/system-playlist/[id]` | `system-playlist/[id].tsx` | `components/system-playlist/*` | Curated playlist detail | Browse |

### Collection tab: `app/(tabs)/(c.collection)/`

| Route | File | Main components | What it is | Area |
|---|---|---|---|---|
| `/` | `index.tsx` | Inline in the route file (section links, counts) | Library hub: links to each section with counts | Browse |
| `/collection/loved` | `collection/loved.tsx` | `playlist-detail/LovedHeader`, `TrackItem`, `collection/CollectionStickyHeader` | Loved tracks | Browse |
| `/collection/favorite-reciters` | `collection/favorite-reciters.tsx` | `ReciterItem`, `SearchInput`, `CollectionStickyHeader` | Favorite reciters | Browse |
| `/collection/playlists` | `collection/playlists.tsx` | `PlaylistItem`, `CollectionStickyHeader` | User playlists | Browse |
| `/collection/downloads` | `collection/downloads.tsx` | `TrackItem`, `ReciterDownloadsListItem`, `CollectionStickyHeader` | Downloaded recitations | Browse |
| `/collection/reciter-downloads/[reciterId]` | `collection/reciter-downloads/[reciterId].tsx` | `reciter-downloads/ReciterDownloadsList` | Downloads for one reciter | Browse |
| `/collection/uploads` | `collection/uploads.tsx` | `ReciterImage`, `NowPlayingIndicator`, `CollectionStickyHeader` | User-imported audio | Browse |
| `/collection/bookmarks` | `collection/bookmarks.tsx` | `collection/BookmarkItem`, `CollectionStickyHeader` | Bookmarked verses | Browse |
| `/collection/notes` | `collection/notes.tsx` | `collection/NoteItem`, `CollectionStickyHeader` | Verse notes | Browse |
| `/playlist/[id]` | `playlist/[id].tsx` | `playlist-detail/*` | Same as Home's | Browse |
| `/reciter/[id]` | `reciter/[id].tsx` | `components/reciter-profile/*` | Same as Home's | Browse |

`components/CollectionView.tsx` and `components/collection/{CollectionGrid,
CollectionHeader,FilterBar,PlaylistModal,SectionHeader}.tsx` are not imported
anywhere; they are dead code.

### Settings tab: `app/(tabs)/(d.settings)/`

| Route | File | Main components | What it is | Area |
|---|---|---|---|---|
| `/` | `index.tsx` | `components/settings/ThemePicker` | Settings root | Browse |
| `/storage` | `storage.tsx` | `useStorageBreakdown` | Storage usage and cleanup | Browse |
| `/about` | `about.tsx` | `VersionDisplay` | About | Browse |
| `/credits` | `credits.tsx` | | Credits | Browse |
| `/mushaf-settings` | `mushaf-settings.tsx` | `MushafSettingsContent` | Mushaf display settings | Browse (reading-adjacent) |
| `/reading-theme` | `reading-theme.tsx` | `ReadingThemeContent` | Reading theme picker | Browse (reading-adjacent) |
| `/default-reciter` | `default-reciter.tsx` | `components/reciter-picker/*` | Default reciter | Browse |
| `/reciter-choice` | `reciter-choice.tsx` | | Reciter selection behaviour | Browse |
| `/translations` | `translations.tsx` | `TranslationsContent` | Translations (shared with Home) | Browse |
| `/language` | `language.tsx` | | App language | Browse |
| `/whats-new` | `whats-new.tsx` | `components/changelog/*` | Changelog | Browse |

`(d.settings)/_layout.tsx` also declares an `account` screen with no file.

## Root-stack screens

| Route | File | What it is | Area |
|---|---|---|---|
| `/mushaf` | `app/mushaf.tsx` (`components/mushaf/*`) | Mushaf / Quran reader, facing pages on iPad landscape | Reading |
| `/adhkar-playing` | `app/adhkar-playing.tsx` | Opens the playing dhikr (lock screen, Live Activity) | Link |
| `/player` | `app/player.tsx` | Expands the player sheet (widgets) | Link |
| `/quran/[surah]`, `/quran/[surah]/[ayah]` | `app/quran/*` | Canonical Quran URLs, redirect to `/mushaf` | Link |
| `/mushaf/[page]` | `app/mushaf/[page].tsx` | Canonical page URL, redirect to `/mushaf` | Link |
| `/reciter/[slug]/[surah]` | `app/reciter/[slug]/[surah].tsx` | Shared recitation link, starts playback | Link |
| `+not-found` | `app/+not-found.tsx` | 404 | Browse |

## Persistent overlays (not routes)

| Surface | File | What it is | Area |
|---|---|---|---|
| Player sheet | `components/player/v2/PlayerSheet` via `PlayerHost` in `app/_layout.tsx`; tablet layout in `components/player/v2/TabletPlayer.tsx`, `components/tablet/TabletPlayer*Column.tsx` | Full-screen now playing | Listening |
| Mini player (iOS phone) | `components/player/v2/MiniPlayer` in `NativeTabs.BottomAccessory` | | Listening |
| Floating player (Android / older iOS phone) | `components/player/v2/FloatingPlayer` | | Listening |
| Docked player (tablet) | `components/tablet/TabletDockedPlayer.tsx` in the sidebar footer | | Listening + Shell |
| Tablet sidebar | `components/tablet/TabletSidebar.tsx` | Rail (portrait) / sidebar (landscape) | Shell |
| Bottom tab bar (Android / older iOS) | `components/BottomTabBar.tsx` | | Shell |
| What's New / onboarding | `components/modals/WhatsNewOnboarding/*` (exports `WhatsNewModal`) | | Browse |
| Network banner | `components/NetworkStatusMonitor.tsx` | | Shell |
| Dev menu | `components/DevMenu.tsx` | Dev builds only | — |

## Action sheets

Registered in `components/sheets/sheets.tsx` (`react-native-actions-sheet`),
opened with `SheetManager.show('<id>')`.

| Sheet id | Component | Opened from | Area |
|---|---|---|---|
| `surah-options` | `SurahOptionsSheet` | Surah rows, reciter profile | Browse |
| `rewayat-info` | `RewayatInfoSheet` | Reciter profile | Browse |
| `favorite-reciters` | `FavoriteRecitersSheet` | Home, collection | Browse |
| `select-reciter` | `SelectReciterSheet` | Surah play flows | Browse |
| `select-playlist` | `SelectPlaylistSheet` | Add to playlist | Browse |
| `create-playlist` | `CreatePlaylistSheet` | Playlists | Browse |
| `playlist-context` | `PlaylistContextSheet` | Playlist rows | Browse |
| `add-to-collection` | `AddToCollectionSheet` | Track/surah actions | Browse |
| `collection-options` | `CollectionOptionsSheet` | Collection | Browse |
| `download-options` | `DownloadOptionsSheet` | Downloads | Browse |
| `upload-options` | `UploadOptionsSheet` | Uploads | Browse |
| `organize-recitation` | `OrganizeRecitationSheet` | Uploads | Browse |
| `home-card-options` | `HomeCardOptionsSheet` | Home cards | Browse |
| `player-options` | `PlayerOptionsSheet` | Player | Listening |
| `playback-speed` | `PlaybackSpeedSheet` | Player | Listening |
| `sleep-timer` | `SleepTimerSheet` | Player | Listening |
| `ambient-sounds` | `AmbientSoundsSheet` | Player | Listening |
| `follow-along` | `FollowAlongSheet` | Player | Listening |
| `adhkar-session-options` | `AdhkarSessionOptionsSheet` | Adhkar session player | Listening |
| `mushaf-layout` | `MushafLayoutSheet` | Mushaf | Reading |
| `mushaf-player-options` | `MushafPlayerOptionsSheet` | Mushaf | Reading |
| `mushaf-reciter-picker` | `MushafReciterPickerSheet` | Mushaf | Reading |
| `mushaf-repeat-options` | `MushafRepeatOptionsSheet` | Mushaf | Reading |
| `verse-actions` | `VerseActionsSheet` (`verse-actions/*`) | Mushaf, player Quran view | Reading |
| `verse-note` | `VerseNoteSheet` | Verse actions | Reading |
| `word-detail` | `WordDetailSheet` | Mushaf word tap | Reading |
| `adhkar-layout` | `AdhkarLayoutSheet` | Dhikr reader | Reading |
| `adhkar-copy-options` | `AdhkarCopyOptionsSheet` | Dhikr reader | Reading |

`components/browse/FilterModal.tsx` is a modal outside the sheet registry.
`components/BottomSheetModal.tsx`, `components/modals/WhatsNewModal.tsx` and
`components/SearchBar.tsx` are not imported anywhere.

## Counts

- 49 route files plus 8 layouts: 40 Browse (including the reciter, browse
  and playlist screens that repeat across tab stacks, and `+not-found`),
  3 Reading, 6 Link.
- 28 registered action sheets, 1 standalone modal.
- 4 persistent player surfaces, 2 navigation chromes (sidebar, tab bar).
