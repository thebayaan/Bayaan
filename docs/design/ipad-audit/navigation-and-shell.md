# iPad audit: navigation and app shell

> Scope: the tab shell, sidebar, orientation, multitasking, the shared
> content-width wrapper, sizing infrastructure, pointer and keyboard input.
> Files read: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, every tab
> `_layout.tsx`, `components/tablet/*`, `components/layout/MaxWidthContainer.tsx`,
> `hooks/useResponsive.ts`, `utils/responsive.ts`, `utils/scale.ts`,
> `utils/themeUtils.ts`, `app.config.js`, `app/mushaf.tsx`. Date: 2026-10-26.
> Per-screen findings are in the sibling files of this folder. Rules referred
> to as §N live in [`../ipad-standards.md`](../ipad-standards.md); width classes
> (`compact` < 600, `medium` 600–899, `expanded` 900–1279, `large` ≥ 1280)
> are defined there in §2.

## Summary

1. **iPad is locked to portrait.** `app/_layout.tsx:213-216` calls
   `ScreenOrientation.lockAsync(PORTRAIT_UP)` on every device, and
   `app/mushaf.tsx:106-112` re-locks portrait when the reader closes. The
   landscape sidebar (`TabletSidebar`, 240pt with labels) and the landscape
   tablet player only ever appear inside the Mushaf flow. Rotating an iPad on
   a keyboard case, the most common way people use one, leaves the app
   sideways. **P0.**
2. **Multitasking is switched off.** `app.config.js:58` sets
   `UIRequiresFullScreen: true`, so Bayaan cannot run in Split View, Slide
   Over or Stage Manager. Listening while reading something else is a core
   use case for a recitation app. **P0** (it also blocks the "Designed for
   iPad" bar Apple uses in editorial picks).
3. **Layout is chosen by device, not by space.** `isTablet` is
   `Platform.isPad || shortestSide >= 700` (`hooks/useResponsive.ts:31-33`).
   Once multitasking is on, an iPad in a 320pt Slide Over window would still
   get the sidebar and the tablet player. Layout must key off the window
   width the app actually has. **P0 once #2 is fixed.**
4. **One 720pt column for everything.** Every tab stack is wrapped in
   `MaxWidthContainer` (default 720pt, e.g. `app/(tabs)/(a.home)/_layout.tsx:16`).
   That is right for a settings form and wrong for a reciter grid or a home
   feed: on a 13" iPad in landscape the content area is 1136pt wide and 416pt
   of it is empty gutter, and screens that size their grids from
   `useWindowDimensions()` compute widths for the wrong box. **P1.**
5. **UI inflates on iPad.** ~199 files call `react-native-size-matters`
   directly. It scales from a 350pt guideline, so on a 1024pt-wide window
   `moderateScale(16)` is ~31pt. `utils/scale.ts` caps this but only ~16 files
   use it, and `theme.typography` is capped separately (`utils/themeUtils.ts:12-14`)
   and frozen at module load. Result: some elements are phone-sized, others
   are 1.5–2x, often on the same screen. **P1.**
6. **No pointer, keyboard or context-menu support.** There is no `onHoverIn`,
   no `cursor` style, no key command and no `UIMenu` anywhere in `app/` or
   `components/`. A trackpad user gets no hover feedback; a keyboard user
   cannot press Space to pause or ⌘F to search. **P1.**

## Tab shell — `app/(tabs)/_layout.tsx`

**Files:** `app/(tabs)/_layout.tsx`, `components/tablet/TabletSidebar.tsx`,
`components/tablet/TabletDockedPlayer.tsx`.

**What it is:** on any tablet, `TabletTabs` swaps the iOS `NativeTabs` and
the Android floating pill for JS `Tabs` with a custom leading sidebar: an
88pt icon rail in portrait and a 240pt labeled sidebar in landscape, with a
docked mini player in the footer. It flips sides in RTL.

**Current iPad behavior:** because of the portrait lock, users only see the
88pt rail. It has five icons with 10pt labels, the logo, and an artwork-only
mini player at the bottom. The content column sits centered in the remaining
space.

### Weaknesses

| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Layout | Labeled sidebar unreachable outside the Mushaf because of the portrait lock | `app/_layout.tsx:213-216`, `TabletSidebar.tsx:~150` (`expanded = orientation === 'landscape'`) | P0 |
| 2 | Layout | Sidebar mode is tied to orientation, not width. A 13" iPad in portrait has 944pt of content next to an 88pt rail and could easily afford the labeled sidebar | `TabletSidebar.tsx:~150` | P1 |
| 3 | Typography | Rail labels are 10pt, below the 11pt minimum Apple recommends; inline labels are 14pt where iPadOS sidebars use 17pt body text | `TabletSidebar.tsx` `labelStacked.fontSize: 10`, `labelInline.fontSize: 14` | P1 |
| 4 | UX | The sidebar only mirrors the five phone tabs. On iPad, Apple Music and Spotify use the sidebar to reach library sections and pinned playlists in one tap. Here, Loved, Downloads, Bookmarks, Notes and Adhkar are two or three taps deep | `app/(tabs)/_layout.tsx` `TabletTabs` | P1 |
| 5 | UI | The portrait mini player is artwork-only (no title, no progress), so there's no way to tell what's playing or scrub without opening the full player | `TabletDockedPlayer.tsx` `expanded` prop, `TabletSidebar.tsx` footer | P1 |
| 6 | Visual | The sidebar is a slightly tinted panel with a hairline border. It doesn't use the iPadOS 26 floating glass sidebar treatment on glass devices, so the tablet shell looks older than the phone's NativeTabs | `TabletSidebar.tsx` `containerStyle` | P2 |
| 7 | Accessibility | Sidebar items are bare `Pressable`s with no `accessibilityRole="tab"`, no `accessibilityState={{selected}}` and no label for VoiceOver beyond the visible text; the logo isn't marked decorative | `TabletSidebar.tsx` `SidebarItem` | P1 |
| 8 | Input | No hover highlight on items (trackpad), no keyboard focus ring, no ⌘1–⌘5 | whole file | P1 |
| 9 | UX | Tapping the active item pops the stack (native-stack handles `tabPress`) but doesn't scroll to top; no screen uses `useScrollToTop` | `grep useScrollToTop` returns nothing | P2 |
| 10 | Visual | The brand row (logo + "Bayaan" 18pt) takes ~70pt at the top of every screen. In iPadOS sidebars the app title is the large title of the sidebar itself or omitted | `TabletSidebar.tsx` header | P2 |

### Proposed iPad design

Reference: **Apple Music and Podcasts on iPadOS**, which use the system
sidebar-adaptable tab bar. A floating tab bar shows at the top in compact
widths and expands into a full sidebar with library sections, and the user
can collapse it.

Two options, in order of preference:

**A. Native sidebar-adaptable tabs (preferred, evaluate first).** iPadOS 18+
`UITabBarController` has a `tabSidebar` mode that gives the floating tab bar,
the sidebar, user customization, keyboard navigation, pointer effects and
VoiceOver for free. Check whether the pinned `react-native-screens` 4.29 /
expo-router `NativeTabs` expose it (the iOS phone shell already uses
`NativeTabs`). If it does, use `NativeTabs` on iPad too and delete most of
`TabletSidebar`. Library sections become sidebar-only tab groups.

**B. Keep the JS sidebar and fix it.** If option A isn't available yet:

```
Landscape, 13" (1376pt, `large`). Labeled sidebar, 280pt.
┌────────────────────┬──────────────────────────────────────────────────────────┐
│ Bayaan        [⟨⟩] │  Home                                          (search)  │
│                    │                                                          │
│ ⌂  Home            │   ┌──────── Continue ────────┐ ┌──── Surah of the day ──┐ │
│ 📖 Quran           │   │                          │ │                        │ │
│ ⌕  Search          │   └──────────────────────────┘ └────────────────────────┘ │
│ ✦  Adhkar          │                                                          │
│                    │   Reciters                                      See all  │
│ LIBRARY            │   ◯  ◯  ◯  ◯  ◯  ◯  ◯                                     │
│ ♥  Loved           │                                                          │
│ ⤓  Downloads       │                                                          │
│ 🔖 Bookmarks       │                                                          │
│ ✎  Notes           │                                                          │
│ ♪  Playlists     ▸ │                                                          │
│ ★  Reciters        │                                                          │
│ ⬆  Uploads         │                                                          │
│                    ├──────────────────────────────────────────────────────────┤
│ ⚙  Settings        │ [art] Al-Kahf · Mishary Alafasy  ⏮ ⏯ ⏭  ━━━━●━━━━  2:31 │
└────────────────────┴──────────────────────────────────────────────────────────┘

Portrait, 11" (820pt, `medium`). Rail, 88pt. Now-playing bar spans the content area.
┌──────┬──────────────────────────────────────┐
│  ◉   │  Home                       (search) │
│  ⌂   │                                      │
│ Home │   …content…                          │
│  📖  │                                      │
│Quran │                                      │
│  ⌕   │                                      │
│Search│                                      │
│  ✦   │                                      │
│Adhkar│                                      │
│  ▤   │                                      │
│Library                                      │
│      ├──────────────────────────────────────┤
│  ⚙   │ [art] Al-Kahf · Alafasy   ⏯  ━━●━━   │
└──────┴──────────────────────────────────────┘
```

- **Mode by width class, not orientation** (§6). `compact` uses the phone
  shell with a bottom tab bar. `medium` shows the 88pt rail. `expanded` shows
  the 240pt labeled sidebar and `large` a 280pt one. That puts a 13" iPad in
  portrait (1024–1032pt) on the labeled sidebar. Add a collapse toggle
  (`⟨⟩`, ⌘⌥S) so readers can drop to the rail, and persist that choice.
- **Sections.** Top level: Home, Quran (today's "Surahs"), Search, Adhkar.
  A "Library" group lists Loved, Downloads, Bookmarks, Notes, Playlists
  (expandable to the user's playlists), Favorite reciters and Uploads, each
  routing straight into the existing `(c.collection)/collection/*` screen.
  Settings sits at the bottom. In rail mode the Library group collapses into
  one "Library" item that opens today's Collection hub.
- **Typography.** Expanded rows use Manrope-Medium 17pt (SemiBold when
  selected), 44pt row height, 12pt corner radius selection pill. Section
  headers use 13pt SemiBold uppercase at 55% opacity. Rail labels are 11pt
  minimum.
- **Now playing.** At `medium`, move the mini player out of the rail footer
  into a 64pt bar pinned to the bottom of the content area, spanning its full
  width, with artwork, title and reciter, transport controls and a progress
  hairline (§6, §10.3). This gives the rail layout a real mini player. At
  `expanded`+ the standard keeps it in the sidebar footer; the wireframe
  above shows the alternative (a full-width bar, as in Spotify on iPad),
  which frees the sidebar for the Library list. Pick one with the listening
  thread, which owns the player surfaces, and record it in §6.
- **Visual.** On glass devices render the sidebar as a floating inset panel
  (12pt from the window edges, 24pt radius, `GlassView`), matching the iOS 26
  phone tab bar.
- **Accessibility and input.** `accessibilityRole="tab"` and
  `accessibilityState.selected` on every item, hover highlight (§7.2) and `cursor: 'pointer'`, a visible focus ring for keyboard
  navigation, ⌘1–⌘5 to switch sections.

### Implementation notes

- Spike option A first: one afternoon on a branch with `NativeTabs` on iPad
  (S to find out, M to adopt).
- Option B: `TabletSidebar.tsx` gets a `mode: 'rail' | 'sidebar'` from
  `widthClass` (§2.3), a sections config, and
  navigation into nested collection routes (M). The now-playing bar becomes
  a new `components/tablet/TabletNowPlayingBar.tsx` rendered by `TabletTabs`
  under the scene (M, with the listening thread).
- Re-press to top: call `useScrollToTop(ref)` in each tab's root list (S).

## Orientation — `app/_layout.tsx`, `app/mushaf.tsx`

**Current behavior:** portrait lock everywhere on every device; Mushaf
unlocks on mount and re-locks portrait on unmount. The lock was added in
`6a6b3b12` to give iPhone a landscape Mushaf without making the rest of the
phone app rotate. It catches the iPad by accident.

| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Layout | iPad can't use the app in landscape outside the Mushaf | `app/_layout.tsx:213-216` | P0 |
| 2 | UX | Leaving the Mushaf in landscape snaps the whole iPad UI back to portrait while the device is still sideways | `app/mushaf.tsx:106-112` | P0 |
| 3 | Layout | `app.config.js` already lists all four iPad orientations; the runtime lock contradicts the plist | `app.config.js:74-79` | P1 |

**Proposed:** lock portrait on phones only. On iPad, never lock (Apple
expects iPad apps to support every orientation). The Mushaf's unlock/relock
becomes a phone-only branch too. This is §11's first rule and migration
step 1 in §13.

```ts
// app/_layout.tsx
useEffect(() => {
  if (!getIsTablet()) {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }
}, []);
```

Effort S. It depends on every tablet screen behaving in landscape, which is
what the rest of this audit is about. Ship it behind a dev setting first and
walk the inventory in landscape.

## Multitasking — `app.config.js`

| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | UX | No Split View, Slide Over or Stage Manager | `app.config.js:58` `UIRequiresFullScreen: true` | P0 |
| 2 | Layout | Code assumes window size is fixed at launch: `utils/themeUtils.ts:10-13` and `utils/constants.ts:5-8` read `Dimensions` once at module load; 24 files call `Dimensions.get` | as cited | P1 |
| 3 | Layout | `isTablet` is true for any iPad even in a 320pt window | `hooks/useResponsive.ts:31-33`, `utils/responsive.ts:38-41` | P0 when multitasking is on |

**Proposed:** remove `UIRequiresFullScreen` (§11; Apple deprecated the key in
iPadOS 26). Replace device checks with width classes (§2). Audit the 24
`Dimensions.get` call sites; anything that affects layout must come from
`useWindowDimensions()` or an `onLayout` measurement. Test at every Split View
width (see the standards doc's test matrix). Effort M, mostly testing.

## Layout classes (replacing `isTablet`)

Adopt the width classes in §2 and add `widthClass` to `useResponsive()` as
§2.3 describes. Keep `isTablet` only for decisions that are really about the
device (the orientation lock below, keyboard hints). Every branch in this
audit that reads `isTablet` for layout (`app/(tabs)/_layout.tsx`,
`TabletSidebar`, `MaxWidthContainer`, `PlayerBody`, `ExploreView`) should
switch to `widthClass`, with `compact` falling back to the phone shell.

## Content width — `MaxWidthContainer`

**Current behavior:** each tab's whole `Stack`, header included, renders in a
720pt centered column on any tablet.

| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Layout | Grids and feeds are capped at 720pt, wasting up to 416pt on a 13" iPad in landscape and up to 224pt in portrait | `MaxWidthContainer.tsx:28`, all five tab layouts | P1 |
| 2 | Layout | The native navigation bar sits inside the column, so its title and buttons float in the middle of the window rather than aligning with the content area edges | e.g. `app/(tabs)/(d.settings)/_layout.tsx:20` | P2 |
| 3 | Layout | Screens that compute sizes from `useWindowDimensions()` don't know about the 720pt cap or the sidebar width, so grids overflow or misalign | see per-screen audits | P1 |

**Proposed:** remove `MaxWidthContainer` from the stack layouts. Give each
screen a **content strategy** instead:

- **Fill** (grids, feeds, carousels, reciter profile): full content width
  inside the §5.2 page margins (24 / 32 / 40pt). Column count from the
  measured container width with the §10.1 formula.
- **Readable** (forms, settings detail, prose, about, credits, changelog):
  a centered column capped at 640pt (§5.3).
- **Split** (Settings, Library when it has a selection): list/detail with a
  320–380pt list pane and a detail pane of at least 420pt (§6, iPadOS
  Settings pattern).

`MaxWidthContainer` stays as the implementation of "Readable", used per
screen rather than per stack. Effort M, screen by screen.

## Sizing infrastructure

| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | Typography | `react-native-size-matters` inflates sizes on iPad; 199 files import it directly | `grep "from 'react-native-size-matters'"` | P1 |
| 2 | Typography | Three scaling systems disagree: raw `size-matters`, capped `utils/scale.ts`, capped `theme.typography`. Two adjacent texts can render at 16pt and 24pt | `utils/scale.ts`, `utils/themeUtils.ts:12-14` | P1 |
| 3 | Accessibility | Font sizes are computed numbers with no Dynamic Type mapping; layouts with fixed heights are not tested at larger text sizes | `utils/themeUtils.ts:48-56` | P1 |

**Proposed:**

1. Point every import at `@/utils/scale` with a codemod. It has the same
   API (`scale`, `verticalScale`, `moderateScale`, `s`, `vs`, `ms`), so phones
   don't change at all. `ScaledSheet` needs a small wrapper that uses the
   capped functions. Effort M (mechanical, big diff).
2. Add an ESLint `no-restricted-imports` rule banning
   `react-native-size-matters` outside `utils/scale.ts` so it can't regress
   (S).
3. Longer term: the fixed `theme.type` ramp in §4.1 replaces width scaling
   for text, and §4.3 covers Dynamic Type.

## Pointer, keyboard and context menus

Nothing exists today. Proposals, in order of value:

1. **Keyboard shortcuts** (P1). React Native has no built-in
   `UIKeyCommand` support; add a small local Expo module next to
   `modules/bayaan-car` that registers key commands on the root view
   controller and emits events. Holding ⌘ then shows them automatically in
   the iPadOS shortcut overlay (and in the iPadOS 26 menu bar).

   Use the shortcut set in §7.3, plus these shell shortcuts, which §7.3
   should absorb:

   | Shortcut | Action |
   |---|---|
   | ⌘, | Settings |
   | ⌘⌥S | Collapse / expand sidebar |
   | ⌘P | Open now playing |
   | ⌘[ | Back (same as Esc when nothing is presented) |

   The Mushaf's page-turn keys (←/→) belong to the reading thread.
2. **Hover** (P1). Every tappable card, row and sidebar item gets a hover
   state (`Pressable` `onHoverIn`/`onHoverOut` with the §7.2 4% overlay)
   and `cursor: 'pointer'`, which gives the system iPad pointer lift effect.
   Wrap this in one `Pressable` helper so it isn't re-done per component.
3. **Context menus** (P1). Long-press and right-click on surah rows, reciter
   cards, playlists, bookmarks and downloads should open a native `UIMenu`
   with the same actions the `surah-options`/`playlist-context` sheets offer.
   Use expo-router `Link.Menu`/`Link.Preview` where the item is a link, or a
   native menu component otherwise. Keep the sheets as the phone fallback.
4. **Drag and drop** (P2). Drag a surah or track onto a sidebar playlist to
   add it; drag to reorder queue and playlist items.

## Root stack and overlays

| # | Paradigm | Issue | Evidence | Severity |
|---|---|---|---|---|
| 1 | UX | Root stack uses `animation: 'fade'` for everything; on iPad the Mushaf pushes with a slide over the whole window (sidebar included), so the user loses navigation context while reading | `app/_layout.tsx:511`, `:522-535` | P2 (reading thread decides) |
| 2 | Visual | Dead `Stack.Screen` entries: `settings/*` and `settings/account` in the Home stack, `account` in Settings. No visible effect, but they mislead anyone reading the layout | `app/(tabs)/(a.home)/_layout.tsx:47-54`, `app/(tabs)/(d.settings)/_layout.tsx:60` | P2 |
| 3 | UI | All 28 action sheets render as full-width bottom sheets on iPad (see `settings-adhkar-overlays.md` for the presentation policy) | `components/sheets/*` | P1 |

## Android tablets

The same `isTablet` gate (shortest side ≥ 700dp) gives Android tablets the
sidebar, and the same portrait lock applies. Every recommendation above
applies to them, except that keyboard shortcuts come from
`onKeyDown` handling in `MainActivity` and context menus fall back to the
existing sheets.
