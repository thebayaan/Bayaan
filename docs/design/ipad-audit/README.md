# iPad audit: navigation, shell and browse screens

A screen-by-screen review of how Bayaan behaves on iPad today, for every
screen that is not a reading or listening surface. Each file lists weaknesses
with `path:line` evidence and a proposed iPad design that follows
[`../ipad-standards.md`](../ipad-standards.md) (cited as §N). The full list of
screens is in [`../screen-inventory.md`](../screen-inventory.md).

Written 2026-10-26 against `develop`. It is a code audit: sizes are worked
out from the scaling formulas, not measured on a device, and a few findings
are marked *(verify)* where only a simulator can confirm them.

> **Status on 2026-10-29.** Most of the proposals here have shipped in the
> iPad build PRs (#425–#448): real-point sizing, phone-only orientation locks,
> full-pane grids, cards and menus instead of sheets, the Settings split, the
> sidebar's Collection sections, keyboard shortcuts and the 600pt tablet line.
> The files below describe the 2026-10-26 baseline and are kept as the record
> of why. Current status is in
> [ipad-standards.md §13](../ipad-standards.md#13-migration-plan) and open
> issues in [§14](../ipad-standards.md#14-known-open-issues).

| File | Covers |
|---|---|
| [navigation-and-shell.md](navigation-and-shell.md) | Tab shell and sidebar, orientation, multitasking, content width, sizing infrastructure, pointer, keyboard, context menus |
| [home.md](home.md) | Home feed, browse reciters and surahs, reciter profile, playlist detail, translations |
| [search-and-surahs.md](search-and-surahs.md) | Search (explore and results), system playlists, Surahs tab |
| [collection.md](collection.md) | Library hub and all eight Library sub-screens |
| [settings-adhkar-overlays.md](settings-adhkar-overlays.md) | All Settings screens, Adhkar lists, onboarding, toasts and banners, and all 28 action sheets |

## What's wrong, in one paragraph

On iPad, Bayaan is the phone app inside a 720pt column. It's locked to
portrait and can't run beside another app. Most sizes come from
`react-native-size-matters`, which makes text and controls 1.7–2x larger on
iPad while the column stays the same width, so screens show less than an
iPhone Pro Max. Several grids and pagers measure the whole window instead of
the column they sit in and get clipped. Every secondary action is a
full-width bottom sheet, and there is no hover, keyboard or context-menu
support anywhere.

## P0 issues (broken or clipped today)

| Issue | Where | Audit |
|---|---|---|
| Portrait lock on iPad; leaving the Mushaf in landscape snaps the UI back to portrait | `app/_layout.tsx:213-216`, `app/mushaf.tsx:106-112` | navigation-and-shell |
| No Split View, Slide Over or Stage Manager | `app.config.js:58` | navigation-and-shell |
| Browse-reciters grid sized from the window, so the right-hand cards are clipped in all three tabs | `components/browse/BrowseGrid.tsx:74-105` | home |
| Reciter profile rewayah pager pages are 114–304pt too wide: rows and the `…` button are clipped, swipes stop between pages | `components/reciter-profile/ReciterProfile.tsx:219, 1237` | home |
| Adhkar home grid collapses to one left-aligned card per row | `components/AdhkarView.tsx:110-127` | settings-adhkar-overlays |
| Dhikr reader pages are clipped and off-centre | `app/(tabs)/(a.home)/adhkar/[superId]/[dhikrId].tsx:56,68` | settings-adhkar-overlays |
| Sheets opened from the rotating Mushaf are taller than the screen in landscape | `components/sheets/VerseActionsSheet.tsx:133`, `MushafLayoutSheet.tsx:23` | settings-adhkar-overlays |
| "Remove all uploads" permanently deletes the user's imported audio with no confirmation | `app/(tabs)/(c.collection)/collection/uploads.tsx:313`, `store/uploadsStore.ts:163-170` | collection |
| Status bar is white on white in light themes on the reciter-downloads screen | `app/(tabs)/(c.collection)/collection/reciter-downloads/[reciterId].tsx:15` | collection |

## Roadmap

Ordered so each step unblocks the next. Steps line up with the migration
plan in §13 of the standard; the extra steps here are specific to these
screens. Each step is meant to be its own PR.

**Phase 0: quick fixes (S each, no design decisions needed)**

1. Confirm destructive bulk actions (remove all uploads and downloads, unlove
   all) with an Alert that states the count.
2. Delete the forced `light-content` status bar on reciter downloads.
3. Remove the dead `Stack.Screen` entries (`settings/*`, `account`) and
   declare `browse-all-surahs` in the Home stack.
4. Delete dead code: `components/CollectionView.tsx`,
   `components/collection/{CollectionGrid,CollectionHeader,FilterBar,PlaylistModal,SectionHeader}.tsx`,
   `components/SearchBar.tsx`, `components/modals/WhatsNewModal.tsx`,
   `components/BottomSheetModal.tsx`, and the unused `_styles.ts` files in the
   Collection stack.
5. Fix the non-iPad bugs listed below.

**Phase 1: foundations (§13 steps 1–3)**

6. Add `widthClass` to `useResponsive()` and a `useContainerWidth()` (or
   `onLayout`) helper for grid math. Fix the three window-measured layouts
   (BrowseGrid, reciter profile pager, AdhkarView, dhikr pager) to use the
   measured container. This alone fixes four P0s.
7. Point every `react-native-size-matters` import at `@/utils/scale`
   (codemod) and ban the direct import with ESLint. Raise the sub-11pt base
   sizes onto the §4.1 ramp in the same pass.
8. Unlock orientation on iPad, behind a dev setting until every screen in the
   inventory has been walked in landscape.

**Phase 2: shell (§13 steps 2, 5, 9)**

9. Spike `NativeTabs` sidebar-adaptable mode on iPad. If it isn't available,
   rework `TabletSidebar` per navigation-and-shell.md: mode by width class,
   Library sections, 11pt minimum labels, accessibility roles, hover.
10. Replace the stack-level `MaxWidthContainer` with per-screen content
    strategies (fill, readable, split).
11. Remove `UIRequiresFullScreen` and test every screen at `compact` width on
    an iPad.

**Phase 3: shared components**

12. `AppSheet` wrapper: 560pt cap, live height, Esc to close, presentation by
    width class (§8). Then move sheets over in the order given in
    settings-adhkar-overlays.md.
13. `ListSection` / `ListRow` for Settings-style screens.
14. A shared hoverable, context-menu-capable pressable for cards and rows
    (§7.2), used by every card in `components/cards` and every row component.
15. A shared collection hero / two-column detail header (§10.2), replacing the
    nine copies in Library, playlist and loved screens.

**Phase 4: screens** (any order, each one audit section)

16. Settings list/detail split at `expanded`+.
17. Library: sidebar sections, grids for reciters and playlists, list/detail
    for playlists, bookmarks and notes.
18. Home feed and browse: full-width shelves and grids with §10.1 columns.
19. Search: Top Result and grouped results, focus on sidebar select, ⌘F.
20. Surahs tab: multi-column Surah/Juz index with jump-to-surah.
21. Reciter and playlist detail: two-column header.
22. Onboarding: 560pt form-sheet card.

**Phase 5: input**

23. Keyboard shortcuts module (`UIKeyCommand`), shortcut set from §7.3.
24. Drag and drop: surahs onto playlists, reorder playlists (the store method
    already exists), drop audio files onto Uploads.

## Bugs found along the way (not iPad-specific)

| Bug | Evidence |
|---|---|
| Long-pressing a surah in search with "use default reciter" opens the player without starting playback; the random-reciter option is missing | `components/search/SearchView.tsx:318-334` |
| Shared cards hard-code `/(tabs)/(a.home)/…` routes, so tapping a reciter in Search or Library jumps to the Home tab | see home.md |
| Translations opened from the Mushaf pushes onto the Home tab, pulling the reader out of the Mushaf | `components/sheets/VerseActionsSheet.tsx:788` |
| `BrowseGrid` memo compares only the list length, so two filters with the same result count show stale results | see home.md |
| Wrong hard-coded `getItemLayout` lengths in `RecitersView` can render blank cards while scrolling | see home.md |
| Starting a system playlist from row *n* wraps back to the first surah after the last; shuffle is biased | see search-and-surahs.md |
| Quick Listen and Juz Amma tiles show their name twice | `data/systemPlaylists.ts:72, 235` |
| `useHeaderHeight` is called inside a condition (hooks rule) | `components/reciter-profile/ReciterProfile.tsx:221` |
| `RandomRecitationHero` bypasses `showToast`, so its messages never show on iOS | see settings-adhkar-overlays.md |
| `useBottomInset` adds tab-bar and floating-player space on tablet, where neither exists; Library screens also hard-code `moderateScale(65)` bottom padding | see search-and-surahs.md, collection.md |
| VoiceOver reads the hidden list on Translations (kept at `opacity: 0`) | `components/screens/TranslationsContent.tsx:947-985` |

## Proposed changes to the standard

Each audit ends with gaps or conflicts it found in `ipad-standards.md`. The
ten below were all adopted into the standard in #393 (`large` now starts at
1280pt, so every 11" iPad in landscape is `expanded`). They are kept here as
the record of why each rule exists:

1. **§2.1 table vs breakpoints.** iPad Pro 11" in landscape is 1210pt, which
   was `large` by the old 1200 breakpoint, though the table listed it under
   `expanded`. Resolved by moving the breakpoint to 1280.
2. **Grids measure their pane, not the window.** §10.1 uses `paneWidth` while
   §2.2 says to read the window. Say explicitly: the class comes from the
   window, grid math from the measured container. Window-based grid math is
   exactly what caused the P0 clipping bugs.
3. **Destructive confirmation.** §8 names an Alert but not when it's
   required. Proposed: MUST confirm bulk or irreversible deletes; SHOULD use
   an undo toast for single removals.
4. **Contrast of secondary text.** §4.1 puts `overline` at 0.5 alpha, which
   §12 calls decoration-only (measured ~3:1). Proposed: secondary text at
   0.8 alpha or more.
5. **Sidebar sub-sections.** Allow Library sections and a user-playlists group
   in the labeled sidebar at `expanded`+ (Apple Music pattern).
6. **Two-column detail header from `medium`** with 200pt artwork, not only
   from `expanded`.
7. **Sheet policy gaps (§8):** anchored popover for reading settings at
   `medium`, submenus for menus over 6 items, a 704pt large form sheet for
   multi-step tasks, every item sheet doubles as that item's context menu,
   and where filter panels go.
8. **Long-press is never the only path** to an action (§7.2), and Search in the
   sidebar must focus the field.
9. **Bottom insets per shell (§10.3):** never add fixed padding for the
   floating player on tablet; use `useBottomInset()`.
10. **Shared components must not hard-code a tab route.**

Smaller proposals not yet decided (avatar `minCard` 140, multi-column row lists, Arabic
preview sizes in rows, extra shortcuts, a feedback-surfaces rule, color from
artwork) are in each file's last section.
