# Foundations: the iPad shell under every listening screen

These are the problems that sit underneath every listening screen. Fixing a
single screen without fixing these will not make the app feel native on iPad,
so they come first in the roadmap ([00-overview.md](00-overview.md)).

Audit baseline: `develop` as of 2026-10-26.

---

## Current state

The app already has a tablet layer:

- `hooks/useResponsive.ts` exposes `isTablet` (any iPad, or shortest side
  >= 700pt) and `orientation`.
- `utils/scale.ts` and `utils/responsive.ts` cap size scaling at a 430pt
  "phone width" so iPad does not inflate.
- `components/tablet/TabletSidebar.tsx` replaces the tab bar with a leading
  sidebar (88pt icon rail in portrait, 240pt labeled sidebar in landscape) and
  docks the mini player (`TabletDockedPlayer`) in its footer.
- Every tab stack wraps its content in `MaxWidthContainer` (720pt cap).
- `components/player/v2/TabletPlayer.tsx` is a dedicated tablet Now Playing.

That is a solid starting point. The weaknesses below are about the layer being
incomplete, inconsistent, or switched off by configuration.

---

## Weaknesses

### Platform configuration

**F-01 · High · Landscape is unreachable on listening screens.**
`app/_layout.tsx:213-216` calls
`ScreenOrientation.lockAsync(PORTRAIT_UP)` on every device, including iPad.
Only `app/mushaf.tsx:105-112` unlocks, and it re-locks to portrait on exit.
The landscape code paths that already exist (240pt labeled sidebar, landscape
Now Playing) are therefore effectively unreachable from any listening screen.
Every iPad owner using a Magic Keyboard or a stand (landscape by default) is
forced to use the app sideways or detach the iPad.

**F-02 · High · Multitasking is disabled.**
`app.config.js:58` sets `UIRequiresFullScreen: true`. The app cannot be used in
Split View, Slide Over or Stage Manager, which is exactly how people listen
while doing something else on iPad (reading in Safari, taking notes). Apple
Music and Spotify both support every multitasking size. This flag is also what
lets the orientation lock (F-01) take effect on iPad.

**F-03 · Med · Device type is used as a layout switch.**
`useResponsive().isTablet` is true for any iPad (`hooks/useResponsive.ts:31-34`),
including a 320pt Slide Over window. Once F-02 is lifted, every
`isTablet ? tabletLayout : phoneLayout` branch will render the tablet layout in
windows narrower than a phone. Layout must be driven by **window width**, and
`isTablet` kept only for platform affordances (pointer, keyboard, popovers).

### Sizing and typography

**F-04 · High · Two competing scaling systems.**
About 190 files under `app/` and `components/` import `ScaledSheet` / `scale`
from `react-native-size-matters` directly, which scales from a 350pt guideline
width and inflates layouts roughly 2x on a 1024pt iPad. Only 15 files use the
capped `utils/scale.ts`. The result is that the same token (for example a
`16@s` padding) is a different size depending on which import a file happens
to use, and many iPad screens look like an enlarged phone.

**F-05 · Med · Theme typography is frozen at launch.**
`utils/themeUtils.ts:10-14` and `styles/theme.ts:10-13` compute `scale()` from
`Dimensions.get('window')` once at module load. Rotation or a window resize
never updates `theme.typography`, and the values depend on how the app happened
to launch.

**F-06 · Med · No type ramp for large screens.**
The theme exposes seven sizes (`headingSize` 30 down to `captionSize` 10), all
derived from phone scaling. There is no equivalent of the iOS text styles
(Large Title, Title 1-3, Headline, Body, Callout, Subhead, Footnote, Caption),
so each screen invents its own sizes. On iPad the result is small, dense body
text next to oversized headers.

**F-07 · Med · Dynamic Type is ignored.**
No component sets `maxFontSizeMultiplier` or reacts to the content size
category. Row layouts are built around fixed-size leading elements sized with
`moderateScale` (`components/TrackItem.tsx:270-271`,
`components/SurahItem.tsx:342-343`) and single-line titles, so large text
sizes truncate rather than reflow. iPad users read from further away
than phone users and raise text size more often.

### Layout

**F-08 · Med · One 720pt cap for every kind of content.**
`components/layout/MaxWidthContainer.tsx:30` caps all content at 720pt, and
every tab stack uses the default. That is right for running text, but it
leaves grids and shelves (reciter cards, playlists, browse tiles) in a narrow
column with 300pt+ of empty background on each side on a 13" iPad in
landscape (1376pt window minus 240pt sidebar). Apple Music and Spotify let
grids use the full width and only cap reading text.

**F-09 · Med · Sheets are phone bottom sheets.**
All 28 sheets in `components/sheets/` use `react-native-actions-sheet`
(`PlayerOptionsSheet.tsx:492`, `SurahOptionsSheet.tsx:298`, …) with no tablet
branch. On iPad they span the whole window width from the bottom edge, far
from the button that opened them. iPad HIG uses popovers anchored to the
source control for short menus and centered form sheets (at most 560pt wide)
for longer flows.

### Interaction

**F-10 · Med · No pointer support.**
No component in `app/` or `components/` uses hover (`onHoverIn`, a hover
style, or a pointer interaction). With a trackpad or Apple Pencil hover there
is no feedback on rows, cards or player controls.

**F-11 · Med · No keyboard shortcuts.**
No key commands are registered anywhere. Space to play or pause, arrow keys to
seek, Cmd+F for search and Cmd+1…5 for the sidebar sections are expected on an
iPad with a keyboard, and Apple Music supports all of them.

**F-12 · Med · No context menus.**
`react-native-ios-context-menu` 3.2.1 is a dependency, but no listening screen
uses it. Long press opens a bottom sheet instead of a native menu with a
preview, and right click with a trackpad does nothing.

### Accessibility

**F-13 · Med · Most controls are unlabeled.**
`accessibilityLabel` appears in 26 files, while 154 files render `Pressable` or
`TouchableOpacity`. Icon-only controls (player transport, more buttons,
download buttons) are read by VoiceOver as "button".

---

## Proposed foundations

The project-wide rules live in [ipad-standards.md](../ipad-standards.md). This
section maps each weakness to the rule that fixes it and adds only what is
specific to listening.

| ID | Fix | Standard |
|----|-----|----------|
| F-01 | Apply the root portrait lock only when `!isTablet`; make the re-lock in `app/mushaf.tsx` phone-only too | [§11](../ipad-standards.md#11-orientation-and-multitasking) |
| F-02 | Remove `UIRequiresFullScreen` from `app.config.js` (Apple deprecated it in iPadOS 26) | [§11](../ipad-standards.md#11-orientation-and-multitasking) |
| F-03 | Add `widthClass` to `useResponsive()`; layout branches switch from `isTablet` to width class | [§2](../ipad-standards.md#2-width-classes-and-breakpoints) |
| F-04, F-05 | `@/utils/scale` only; no module-scope `Dimensions` | [§3](../ipad-standards.md#3-sizing-and-scaling) |
| F-06 | `theme.type.<role>` ramp | [§4.1](../ipad-standards.md#41-ui-type-ramp) |
| F-07 | `minHeight` rows, `maxFontSizeMultiplier` on chrome only | [§4.3](../ipad-standards.md#43-dynamic-type-and-font-scaling) |
| F-08 | Per-content widths; grids uncapped | [§5.3](../ipad-standards.md#53-content-width) |
| F-09, F-12 | Popovers and context menus on `medium`+, 560pt form sheets | [§8](../ipad-standards.md#8-sheets-menus-and-modals) |
| F-10, F-11 | Hover states, secondary click, key commands | [§7](../ipad-standards.md#7-touch-pointer-keyboard) |
| F-13 | Labels, roles, grouping | [§12](../ipad-standards.md#12-accessibility) |

### Listening-specific additions

**Shell by width class.** The sidebar choice in `TabletSidebar.tsx:131`
(`expanded = orientation === 'landscape'`) moves to width class, so a 13"
iPad in portrait (1024pt, `expanded`) gets the labeled sidebar, and
`app/(tabs)/_layout.tsx` uses the phone shell for `compact` windows. At
`compact` on an iPad (Slide Over, ⅓ split) the phone mini player and tab bar
must appear, otherwise playback has no visible controls.

**Keyboard, listening subset.** On top of [§7.3](../ipad-standards.md#73-hardware-keyboard):

| Keys | Action |
|------|--------|
| ← / → | Seek back / forward 15s, matching the on-screen skip buttons (`SEEK_INTERVAL = 15` in `PlaybackControls/Controls.tsx:20`). The standard says 10s; this doc proposes 15s so keyboard and buttons agree |
| ⌘ ↑ / ⌘ ↓ | Previous / next item in the queue panel when it has focus |
| ⌘ Shift P | Open or close the full player |
| ⌘ D | Download the current surah |

Space must not toggle playback while a text input is focused.

**Progress bar accessibility.** The scrubber is an `adjustable` element with
`accessibilityValue` (`min`, `max`, `now`, and `text` such as
"1:23 of 4:56"). Increment and decrement seek 15s. Track rows read as one
element ("Al-Fatiha, Mishary Alafasy, 4 minutes, downloaded") with custom
actions for play next, add to playlist and download.

**Hover on media.** Cards show a play button on hover (Apple Music and
Spotify both do this), so pointer users can start playback without opening
the detail page. Rows show their "more" button on hover only on `expanded`+.

---

## Implementation order

1. Width classes in `useResponsive()`; switch `TabletSidebar` and
   `app/(tabs)/_layout.tsx` to them (no visible change while locked).
2. Per-content widths; remove the cap from the tab stack layouts.
3. Type ramp tokens in the theme.
4. Lift the orientation lock and `UIRequiresFullScreen` on iPad, and test
   every listening screen at 320, 375, 507, 678, 744, 834, 1024, 1180 and
   1376pt.
5. Popovers, context menus and form sheets for the listening sheets.
6. Key commands and hover.
7. Size-matters migration, listening screens first.
8. Accessibility pass alongside each screen redesign.
