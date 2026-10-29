# Listening on iPad: audit and redesign

This folder audits every screen involved in **listening** (finding a recitation,
playing it, managing what plays next, and keeping it in the library) on iPad and
large tablets, and proposes a redesign benchmarked against **Apple Music** and
**Spotify** on iPad.

It builds on the project-wide rules in [ipad-standards.md](../ipad-standards.md)
and uses its vocabulary: width classes (`compact`, `medium`, `expanded`,
`large`), the type ramp, spacing and radius tokens. Where an audit disagrees
with a rule, it says so in a "Proposed changes to the standard" section; those
are collected [below](#proposed-changes-to-the-standard).

Audit baseline: `develop` on 2026-10-26. The findings come from reading the
code, with a `file:line` reference for each; sizes quoted in pt are computed
from the code and the reference window sizes in
[ipad-standards.md §2.1](../ipad-standards.md#21-classes). Line references
describe that baseline and will drift as the code changes.

> **Status on 2026-10-29.** Most of the roadmap below has since shipped in the
> iPad build PRs (#425–#448, #452). The docs are kept as the record of why each
> change was made and as the design reference for the remaining work. See
> [Status on develop](#status-on-develop-2026-10-29) for what simulator
> screenshots of `develop` confirmed, and [screenshots/](screenshots/README.md)
> for the captures.

## Documents

| Doc | Covers | Weakness IDs |
|-----|--------|--------------|
| [01-foundations.md](01-foundations.md) | The shell under every listening screen: orientation lock, multitasking, scaling, sheets, pointer, keyboard, accessibility baseline | F-01 to F-13 |
| [02-player.md](02-player.md) | Full player (tablet and phone), docked mini player, floating player, queue, and every sheet opened from the player | P-01 to P-37 |
| [03-discovery.md](03-discovery.md) | Home, Search / Explore, Browse all reciters and surahs, the Surahs tab as a way to start playback, pickers | D-01 to D-30 |
| [04-reciters-and-library.md](04-reciters-and-library.md) | Reciter profile, Library home, playlists, playlist detail, Loved, Downloads, reciter downloads, Uploads, favorite reciters, system playlists | L-01 to L-33 |

Each doc follows the same shape: screens covered, current state, weaknesses
grouped by paradigm (typography, visual, layout, interaction, accessibility,
platform integration) with severity, benchmark notes, the proposed design with
wireframes for each width class, and PR-sized implementation steps.

## The short version

Bayaan already has tablet groundwork: a leading sidebar, a docked mini player,
a two-column tablet player and a capped scaling helper. Three things keep it
from feeling like an iPad app:

1. **Configuration hides most of it.** The app is locked to portrait on every
   device and declares `UIRequiresFullScreen`, so landscape layouts are
   unreachable and Split View, Slide Over and Stage Manager are off
   (F-01, F-02). That is how most people use an iPad with a keyboard or a stand.
2. **It is a scaled-up phone.** About 190 files size with
   `react-native-size-matters`, which inflates text and controls 1.6–2.9× on
   iPad (F-04, P-01, D-01, L-01). A reciter's name renders at 63pt on a 13"
   iPad, while shelves still show three cards, as on a phone.
3. **The space goes unused.** One 720pt column holds everything, so grids
   don't gain columns, the Library has no list-and-detail split, and a 13"
   landscape window is 30–40% empty (F-08, D-12, L-13). In the player, the
   reciter catalog permanently takes 45% of landscape, and portrait squeezes
   the verses to phone width (P-14, P-15).

The redesign in one paragraph: layout follows **window width**, not device.
At `compact`, iPad windows get the phone app. At `medium`, the shell is an icon
rail, the mini player is a bar across the bottom of the content, grids reflow,
and the player stacks a reading column above a transport card. At `expanded`
and `large`, the shell is a labeled sidebar with the mini player docked in its
footer. The Library becomes a list-and-detail split. Reciter and playlist pages
get an artwork-led header with Play and Shuffle beside it and a column-based
track table. The player becomes two panes: Now Playing on the leading side, and
a switchable Text / Queue / Reciters pane on the trailing side (Apple Music's
lyrics and queue pattern). Menus become context menus and popovers, every card
and control gets hover, keyboard, VoiceOver and Dynamic Type support.

## Status on develop (2026-10-29)

Checked on iPad Pro 13" and iPad Air 11" simulators, portrait and landscape,
running `develop` at `ad520313`. Captures and notes: [screenshots/](screenshots/README.md).

| Finding | Status |
|---------|--------|
| F-01, F-02: portrait lock and `UIRequiresFullScreen` | Fixed. iPads rotate; the lock is phone-only |
| F-04, P-01, D-01, L-01: size-matters inflation | Fixed on the screens captured. The reciter name is ~34pt on 13", not 63pt |
| F-09, P-19, D-14: full-width bottom sheets | Fixed. Surah options and Add to Collection open as centred cards |
| D-10: Browse All grid overflows | Fixed. Not reproduced on 13" or 11" |
| D-16: "Choose a reciter for this surah" opens the profile | Fixed. It plays the surah and stays on the list |
| L-10: reciter pager clipped | Fixed for tab taps. Swipe snapping not re-tested |
| L-12: 150–230pt blank space at list ends | Fixed. About 60–80pt remains |
| P-14: portrait player squeezes the verses | Fixed. 13" portrait uses two panes; 11" portrait is one column with a floating control card |
| Play button circle on iPad (not in the audit) | Removed in #463 to match the phone |

New issues seen in the captures, not yet fixed:

- Browse All lists "Yasser Salamah" twice (13", end of list).
- On 11" portrait, Loved and playlist rows run to the right screen edge with no margin.
- Library screens in landscape sit in a column capped near 600pt, leaving wide empty sides on 13" (L-13 is only partly addressed).

Not yet captured: the speed, options and sleep-timer popovers, and Split View
or Stage Manager windows.

## Bugs found during the audit

These are defects on every device, not iPad design gaps. They are small, and
should ship first.

| ID | Bug | Where |
|----|-----|-------|
| D-16 | "Choose a reciter for this surah" opens the reciter's profile instead of playing, so the rewayah preference is never saved. `BrowseReciterCard` ignores its `onPress` prop and always wraps a `Link` | `components/browse/BrowseReciterCard.tsx:141-172` |
| D-10 | The Browse All reciters grid sizes columns from the window width, ignoring the sidebar and the 720pt column, so the last column overflows by 70–260pt on iPad | `components/browse/BrowseGrid.tsx:74-105` |
| L-10 | Reciter profile pages are sized to the window width but live in the 720pt column, so on iPad each page is clipped and swipes land mid-page | `components/reciter-profile/ReciterProfile.tsx:219, 1237` |
| L-12 | `useBottomInset` reserves a phone tab bar and mini player that don't exist on iPad, so lists end on 150–230pt of blank space | `hooks/useBottomInset.ts` |
| D-17 | Cards link to the Home tab's reciter route, so opening a reciter from Search jumps tabs and Back goes to the wrong place | `components/browse/BrowseReciterCard.tsx:141-144` |
| D-18 | Choosing the default reciter from search results opens `/player` without queueing the surah | `components/search/SearchView.tsx:318-323` |
| P-23 | On iPad the Follow Along button is disabled when unavailable, so its explainer sheet can never open | `components/player/v2/TabletPlayer.tsx:667-670`, `components/tablet/TabletPlayerControlsColumn.tsx:518-521` |
| P-29 | The iPad player, docked mini player and player header have no accessibility labels at all; the phone mini players do | `components/player/v2/TabletPlayer.tsx`, `components/tablet/*` |

## Roadmap

Each step is roughly one PR. Steps inside a phase can run in parallel. The
per-screen docs break each step down further.

### Phase 0: bugs (any time, no dependencies)

D-16, D-17, D-18, D-10, L-10, L-12, P-23 from the table above.

### Phase 1: foundations ([01-foundations.md](01-foundations.md), [ipad-standards.md §13](../ipad-standards.md#13-migration-plan))

1. `widthClass` in `useResponsive()`; sidebar style and tablet shell chosen
   by width class.
2. Per-content widths instead of the stack-level 720pt cap.
3. `theme.type` ramp and spacing / radius tokens.
4. Size-matters migration for the listening files listed in each doc.
5. Unlock iPad orientation, then remove `UIRequiresFullScreen`. Test at 320,
   375, 507, 678, 744, 834, 1024, 1180 and 1376pt windows.

### Phase 2: shared listening components

1. `useAdaptiveColumns(minCard)` implementing the §10.1 grid formula (D, L).
2. `Shelf` with peek, "See all" and correct `getItemLayout` (D-05, D-13, D-22).
3. `CollectionHero` (artwork, title, metadata, Play / Shuffle / more) (L-02, L-05, L-06).
4. `TrackTable` / `TrackRow` with width-dependent columns, hover, context
   menu and edit mode (L-08, L-14, L-22).
5. Shared player parts, so the full player isn't implemented three times (P-18).
6. A context-menu wrapper that falls back to the existing action sheet on
   phones (F-12, D-19, L-20).

### Phase 3: screens

1. Player: width-class switch, two-pane `expanded`/`large` with Text / Queue /
   Reciters, stacked `medium`, queue management, mini player bar (02-player).
2. Home, Explore and search results (03-discovery).
3. Reciter profile and playlist detail with the new header and table;
   Library split view; playlist editing (04-reciters-and-library).
4. Player sub-sheets as popovers and menus (P-19, P-26).

### Phase 4: platform polish

Keyboard shortcuts, hover everywhere, drag and drop between lists and
playlists, AirPlay route picker, Spotlight donation, and a final VoiceOver,
Dynamic Type and Reduce Motion pass on each screen.

## Proposed changes to the standard

Collected from the four docs. All twelve were accepted into
[ipad-standards.md](../ipad-standards.md) (#393), which also moved the start
of `large` from 1200pt to 1280pt.

| # | Section | Proposal | From |
|---|---------|----------|------|
| 1 | §7.3 | Seek with ← / → by **15s**, matching the on-screen skip buttons and VoiceOver steps, instead of 10s | 01, 02 |
| 2 | §10.4 | At `medium`, **stack** the player (reading column ≤680pt, transport card docked at the bottom) instead of the portrait split, which leaves the verses 409–459pt wide | 02 |
| 3 | §10.4 | Specify the math: leading column 40% clamped 380–520pt; artwork = min(column − 2×margin, 420, windowHeight − 420) so controls stay on-screen on iPad mini landscape; hiding chrome collapses the column rather than leaving it empty | 02 |
| 4 | §4.1 | Full-player track title at `expanded`+ uses `title2` (22pt), not `headline` | 02 |
| 5 | §6 | At `medium`, every tab screen reserves the mini player bar's height (`useMiniPlayerInset()`) | 02 |
| 6 | §10.1 | `minCard` 120pt for round avatar shelves; consider 150pt at `large` so a 13" landscape window gets 6 columns like Apple Music; 200pt for Library category tiles | 03, 04 |
| 7 | §4.1 | Allow SemiBold `callout` for card titles | 03 |
| 8 | §10.1 | Allow paging shelves without the peek on `expanded`+ when a pointer is present | 03 |
| 9 | §5.3 | Cap track and surah tables at 960pt | 04 |
| 10 | §10.2 | Side-by-side header from `medium` with 200pt artwork; allow a pinned hero column at `large` | 04 |
| 11 | §6 | The Library list pane holds categories plus playlists, not only playlists | 04 |
| 12 | §2.2 | MUST: horizontal pagers size pages from their measured container, never the window (L-10) | 04 |

## Checklist for listening PRs

In addition to [ipad-review-checklist.md](../ipad-review-checklist.md):

- [ ] Layout branches on `widthClass`, not `isTablet` or orientation.
- [ ] No new `react-native-size-matters` import; touched files are migrated.
- [ ] Grids and shelves compute columns from their container width; no
      `numColumns` constants and no `useWindowDimensions().width` for item sizes.
- [ ] Every card and row has a hover state, a context menu (long press and
      right click), and a combined VoiceOver label.
- [ ] Transport controls have labels, states (`selected` for repeat, shuffle,
      timer) and the scrubber is `adjustable`.
- [ ] Screens reserve space for the mini player via the shell-aware inset,
      not a hard-coded phone value.
- [ ] Screenshots attached for iPad portrait, landscape, and a `compact`
      window (⅓ Split View), plus the phone.
