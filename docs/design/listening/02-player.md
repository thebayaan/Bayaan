# Player (Now Playing, mini player, queue)

Scope: everything the user sees while audio plays. That is the docked mini
player, the full-screen player in each orientation, the queue, and the
sheets opened from the player. The verse text inside the player (QuranView)
is covered by the reading docs. This doc only treats it as a layout region.

This doc follows the project standard, [ipad-standards.md](../ipad-standards.md).
That standard defines:

- width classes: `compact` < 600, `medium` 600-899, `expanded` 900-1279, `large` ≥ 1280 ([§2](../ipad-standards.md#2-width-classes-and-breakpoints))
- the type ramp roles ([§4](../ipad-standards.md#4-typography))
- spacing, margin and radius tokens ([§5](../ipad-standards.md#5-spacing-and-layout-grid))
- sheets and popovers ([§8](../ipad-standards.md#8-sheets-menus-and-modals))
- the mini and full player rules ([§10.3-10.4](../ipad-standards.md#10-listening-surfaces))

This doc uses those terms and does not redefine them. Findings shared with
other screens are referenced by their IDs in `01-foundations.md`:

- F-01 and F-02: orientation lock and full-screen requirement
- F-03: device used as layout switch
- F-04: two scaling systems
- F-06 and F-07: type ramp and Dynamic Type
- F-09: sheets
- F-10, F-11 and F-12: pointer, keyboard and context menus
- F-13: labels

Where this doc disagrees with the standard, it says so in
[Proposed changes to the standard](#proposed-changes-to-the-standard).

Numbers in this doc:

- `utils/scale.ts` `moderateScale(x)` on any iPad = **1.114 × x**: the width
  is capped at 430, so `scale` = 430/350 = 1.229 and `ms` = x + 0.229x/2.
- `react-native-size-matters` `moderateScale(x)` reads the screen's short side
  once, at module load. That gives **2.13×** (mini, 744), **2.38×** (11",
  834) or **2.93×** (13", 1024) for `scale`, so `ms(16)` is 25 / 27 / 31pt.
- Window widths used: mini 744×1133 (`medium` portrait, `expanded` landscape),
  11" 834×1194 (`medium` / `expanded`), 13" 1024×1366 (`expanded` / `large`).

---

## Screens covered

| Surface | Files |
|---|---|
| Mini player docked in the sidebar (rail and labeled) | `components/tablet/TabletDockedPlayer.tsx`, `components/tablet/TabletSidebar.tsx`, `components/player/v2/useMiniPlayerAnchor.ts` |
| Phone mini players (FloatingPlayer: Android pill; MiniPlayer: iOS bottom accessory) | `components/player/v2/FloatingPlayer/index.tsx`, `components/player/v2/MiniPlayer/index.tsx`, `app/(tabs)/_layout.tsx` |
| Full player host, morph and dismiss | `components/player/v2/PlayerHost.tsx`, `PlayerSurface/index.tsx`, `PlayerSurface/SurfaceScrollable.tsx`, `PlayerDismissContext.tsx`, `app/_layout.tsx` (mounts `<PlayerHost/>`), `app/player.tsx` (deep link) |
| Layout switch for the full player | `components/player/v2/PlayerBody.tsx` |
| Full player, iPad portrait | `PlayerBody.tsx` (split) → `TabletPlayer.tsx` (`bodyOnly`) + `components/tablet/TabletPlayerControlsColumn.tsx` |
| Full player, iPad landscape | `PlayerBody.tsx` (split) → `TabletPlayer.tsx` (sidebar or dock-card variant) + `components/tablet/TabletPlayerReciterColumn.tsx` |
| Full player, phone (and every `compact` iPad window in future) | `components/player/v2/PlayerContent/index.tsx`, `TrackInfo.tsx`, `PlaybackControls/*`, `ControlButtons/index.tsx` |
| Header (close, surah name, options) | `components/player/v2/PlayerContent/Header.tsx` |
| Queue | `components/player/v2/PlayerContent/QueueList.tsx` |
| Verse pane (layout only) | `components/player/v2/PlayerContent/QuranView/index.tsx`, `UploadPlaceholder.tsx` |
| Sheets from the player | `components/sheets/PlayerOptionsSheet.tsx`, `PlaybackSpeedSheet.tsx`, `SleepTimerSheet.tsx`, `AmbientSoundsSheet.tsx`, `FollowAlongSheet.tsx`, `MushafLayoutSheet.tsx` (reading doc). Also `AdhkarSessionOptionsSheet.tsx`, opened from the adhkar session card (`components/adhkar/AdhkarSessionCard.tsx:69`) |
| Reciter pickers (not opened from the player) | `components/sheets/SelectReciterSheet.tsx` opens from Search and Browse (`components/search/SearchView.tsx:299`, `components/browse/BrowseSurahs.tsx:284`). `components/reciter-picker/ReciterPickerSheet.tsx` opens from the Mushaf only (`MushafReciterPickerSheet.tsx:9`). From the player, the reciter is changed through the landscape reciter column instead. Both pickers import size-matters (`SelectReciterSheet.tsx:4`, `ReciterPickerSheet.tsx:12`) and get the P-01 fix in the same batch. |

---

## Current state

- **Shell.** On iPad (`isTablet`, which is always true on iPad, split view included) the tab bar is
  replaced by `TabletSidebar`: an 88pt rail in portrait and a 240pt labeled sidebar in landscape. The rail or sidebar is
  picked by orientation (`TabletSidebar.tsx:131`). When a track is loaded, the
  footer holds `TabletDockedPlayer`. The compact variant is a 56pt card with
  40pt art and a 28pt play button. The expanded variant is a row with art,
  title, artist and play. `FloatingPlayer` and `MiniPlayer` never mount on iPad
  (`FloatingPlayer/index.tsx:62-63`, `app/(tabs)/_layout.tsx:257`).
- **Opening.** A tap on the docked player calls `expandPlayerSheet()`. `PlayerSurface`
  morphs from the dock's measured rect to full screen. The player covers the
  sidebar, much like Apple Music's full-screen Now Playing. Swipe-up to open is
  disabled in the sidebar (`TabletDockedPlayer.tsx:57`). To dismiss, drag
  the header or the controls, or tap the close pill.
- **Portrait (every iPad).** `PlayerBody` splits the screen 11:9. The verse pane
  (`TabletPlayer bodyOnly`) is on the left. `TabletPlayerControlsColumn` is on the right: header,
  223pt artwork, title, heart, scrubber, transport and a 7-icon tools row.
  The queue button swaps the verse pane for the queue.
- **Landscape.** This only happens after visiting the Mushaf, because the app locks to
  portrait (F-01). With a reciter, `PlayerBody` splits 11:9 again and the right
  column (max 560pt) shows the reciter's catalog (`TabletPlayerReciterColumn`). In the left pane, `TabletPlayer`
  uses a 360pt control sidebar next to the verses when the pane is at least 680pt wide.
  Otherwise it uses the phone-like "header + verses + floating dock card" stack.
- **Sheets.** Speed, sleep timer, ambient, follow-along and options are
  `react-native-actions-sheet` bottom sheets. They span the full width and are styled with
  size-matters.
- **Platform.** The lock screen shows Now Playing (`services/audio/LockScreenService.ts`) and
  remote commands are native. There are no key commands, hover effects, context
  menus or AirPlay picker.

---

## Weaknesses

### Typography

**P-01 · High · Every sheet opened from the player is inflated 2.1-2.9×.**
All of them import `react-native-size-matters` and `ScaledSheet`, so on an 11"
the 18pt sheet title renders at about 30pt, 16pt option labels at about 27pt and radii at 34pt.
Because the scale is computed from the screen at load, it stays inflated in a split-view window.
`components/sheets/PlayerOptionsSheet.tsx:10`, `PlaybackSpeedSheet.tsx:3`,
`SleepTimerSheet.tsx:3`, `AmbientSoundsSheet.tsx:3`, `FollowAlongSheet.tsx:3`,
`AdhkarSessionOptionsSheet.tsx:10`. (F-04)

**P-02 · Med · Tablet player typography is phone sizes ×1.11 with no ramp,
duplicated in two files.** Title 22.3 / artist 15.6 / rewayah 12.3 / time
12.3pt, all from `moderateScale` literals, with hierarchy carried partly by opacity
(artist `opacity: 0.75`). `TabletPlayer.tsx:925-980`,
`TabletPlayerControlsColumn.tsx:582-629`. (F-06)

**P-03 · Med · Elapsed and remaining times are not tabular.** Manrope digits are
proportional, so the time labels shift width every second. `TabletPlayer.tsx:977-980`,
`TabletPlayerControlsColumn.tsx:626-629`. There is no `fontVariant: ['tabular-nums']`.

**P-04 · Med · Dynamic Type breaks fixed boxes.** Text scales (RN default) inside
fixed-size containers. The "15" seek label is absolutely positioned with
`lineHeight: 11` (`TabletPlayer.tsx:1013-1019`). The speed label ("1.75x") sits in
a fixed 49pt square (`TabletPlayer.tsx:1035-1045, 629-631`). Every title is
`numberOfLines={1}`. There is no `maxFontSizeMultiplier` on chrome. (F-07)

**P-05 · Low · Tablet header controls get smaller than phone.** `Header.tsx:41-48`
uses `isTablet ? 15 : 18` for icons and `isTablet ? 36 : 44` for pills, which comes to 40pt on iPad.
The QCF surah glyph is capped at 192pt wide.

**P-06 · Low · Docked mini player uses 11pt captions.** The subtitle is 11pt
(`TabletDockedPlayer.tsx:190-193`). The tablet floor is 12pt `caption` and
`footnote` 13 is meant for metadata ([§4.1](../ipad-standards.md#41-ui-type-ramp)).

### Visual

**P-07 · Med · Artwork does not scale with its column.** It is a fixed
`moderateScale(200)` = 223pt in the 360pt landscape sidebar
(`TabletPlayer.tsx:718`) and in the portrait controls column, which is 335-461pt wide
(`TabletPlayerControlsColumn.tsx:570-575`). In Apple Music, Spotify and Tarteel
on iPad, the artwork or hero fills the column width.

**P-08 · Med · Two-tone player.** The verse pane and controls use the reading theme
(`TabletPlayer.tsx:691`, `TabletPlayerControlsColumn.tsx:284`). The reciter column
uses `theme.colors.background` (`TabletPlayerReciterColumn.tsx:229`), and so does the surface
(`PlayerSurface/index.tsx:388`). With a sepia or green reading theme,
the right third of the screen is a different color.

**P-09 · Low · Glass over opaque.** The controls column paints the opaque reading
background, then a 4% tint, then a GlassView or FrostedView
(`TabletPlayerControlsColumn.tsx:284-290`; same in `TabletPlayer.tsx:702-707`).
There is nothing behind the glass to blur, so the material costs a native view and adds nothing.

**P-10 · Low · Hard-coded colors.** The loved heart is `'red'` (`TabletPlayer.tsx:501`,
`TabletPlayerControlsColumn.tsx:346`). The adhkar stop icon is `#ff4444`
(`AdhkarSessionOptionsSheet.tsx:52`). The reciter column has a 10-color surah palette inline
(`TabletPlayerReciterColumn.tsx:136-150`). `theme.colors.error` and the
primary color go unused.

**P-11 · Low · Scrubber has no resting affordance.** The thumb is transparent unless
dragging (`TabletPlayer.tsx:521`). That works on touch, but with a pointer
there is no hover growth or knob to aim at.

**P-12 · Low · Docked player artwork differs from Now Playing.** It passes only
`reciterName` (`TabletDockedPlayer.tsx:87-90, 112-115`), while Now Playing passes
`imageUrl={currentTrack.artwork}` (`TabletPlayer.tsx:448-450`). Uploads with custom
art show different images in the two places. The dock also shows no progress.

### Layout

**P-13 · High · Layout is chosen by device and orientation, not width.**
`PlayerBody.tsx:207-211` (`isTablet && orientation`), `TabletPlayer.tsx:128-129`
(`orientation === 'landscape' && paneWidth >= 680`), `Header.tsx:36-48`,
`TabletSidebar.tsx:131`. Once F-02 lifts full-screen:
- *Split 1/3 (~320-375pt, "portrait")*: an 11:9 split puts the verses in ~190pt.
  The controls column is ~165pt but must fit 223pt art and 7×49pt tools (343pt). The
  tools overflow and overlap, and the header pills collide with the 192pt glyph canvas.
- *Split 1/2 on 13" (683×1024)*: verses get 376pt and controls get 307pt.
- *Stage Manager 900×600*: "landscape" means the reciter column (405pt) is shown and
  the left 495pt pane falls back to the dock card.
(F-03)

**P-14 · High · Portrait squeezes reading into phone width.** The 11:9 split
(`PlayerBody.tsx:283-294`) gives the verses 459pt on an 11" (409pt on mini,
563pt on 13"), about an iPhone Pro Max. Meanwhile the 375pt controls column is mostly
empty below the tools row. The main task while listening is following the verses.
[§10.4](../ipad-standards.md#104-full-player) currently endorses this split for
`medium`. See [Proposed changes to the standard](#proposed-changes-to-the-standard).

**P-15 · High · Landscape differs by device and gives the space to the catalog.**
On 11" landscape (1194) the left pane is 657pt, below the 680 threshold, so it gets the
stacked dock-card layout. On 13" (1366) it gets three columns:
360 controls | 446 verses | 560 reciter catalog. The reciter catalog
(`PlayerBody.tsx:208-209, 265-268`) always takes 45%. The queue, the thing
Spotify and Apple Music put in that slot, instead *replaces the verses*
(`TabletPlayer.tsx:379-383`).

**P-16 · Med · Immersive mode leaves empty columns.** A verse tap fades the chrome
to opacity 0 but keeps its layout space: the 360pt sidebar
(`TabletPlayer.tsx:231-239, 704-706`) and the portrait controls column
(`TabletPlayerControlsColumn.tsx:129-137, 286-288`). The verses do not grow.

**P-17 · Med · First-frame relayout.** `leftPaneWidth` is undefined until
`onLayout` (`PlayerBody.tsx:28-30, 198-200`), so `TabletPlayer` first lays out
against the window width (`TabletPlayer.tsx:124`) and can flip variants on frame 2
during the morph.

**P-18 · Med · Three copies of the player UI.** `TabletPlayer.tsx:427-683` and
`TabletPlayerControlsColumn.tsx:300-537` are near-identical: transport, scrubber,
tools, heart, reciter fetch effect (`:245-265` / `:143-163`), `formatTime`
(`:94-102` / `:76-84`) and the style sheets. The phone has a third
implementation (`PlaybackControls/`, `ControlButtons/`). Each fix (a11y, hover,
tabular digits) has to land 2-3 times, and they have already drifted.

**P-19 · Med · Sheets are laid out for phones.** All sheets are full-width ActionSheets (F-09).
Specific breakages:
- `PlayerOptionsSheet.tsx:526` sizes surah-info HTML to `window width − 72`.
- `PlayerOptionsSheet.tsx:54, 575` freezes `SCREEN_HEIGHT` at module load, so it is wrong after rotation.
- `AmbientSoundsSheet.tsx:457` sound cards are `47%` wide, which makes them about 560pt tiles on landscape.
- `FollowAlongSheet.tsx:106` list `maxHeight: ms(400)` is about 676pt.

**P-20 · Low · Magic numbers.** `SIDEBAR_WIDTH = 360` and the `+ 320` threshold
(`TabletPlayer.tsx:92, 129`), `maxWidth: 560` and `flex: 11/9`
(`PlayerBody.tsx:284, 291-293`), dock `maxHeight: ms(360)` (`TabletPlayer.tsx:873`).
None of these come from tokens.

### Interaction

**P-21 · High · No real queue management.** There is no reorder, although
`moveInQueue` exists (`hooks/usePlayerActions.ts:35`, `playerStore.ts:662`) and
`react-native-draggable-flatlist` is a dependency. Rows have no context menu
(Play next / Go to reciter / Download), no "Clear Up Next" and no swipe to delete
(`QueueList.tsx:145-239`). Tapping a surah in the landscape reciter
column silently replaces the whole queue (`TabletPlayerReciterColumn.tsx:160-191`),
and there is no Play Next or Add to Queue.

**P-22 · Med · No pressed or hover state on primary controls.** Transport, tools
and heart Pressables have static styles (`TabletPlayer.tsx:539-681`,
`TabletPlayerControlsColumn.tsx:382-535`), so a tap or pointer hover gives no feedback. (F-10)

**P-23 · Med · Follow Along explainer is unreachable on iPad.** The tool is
`disabled={!followAlongAvailable}` (`TabletPlayer.tsx:667-670`,
`TabletPlayerControlsColumn.tsx:518-521`). `PlayerBody.tsx:138-141` would open
`FollowAlongSheet` exactly in the unavailable case, but the press never fires.
On iPad the button is dimmed with no explanation.

**P-24 · Med · Docked mini player is thin.**
- Nested Pressables: play is inside the expand Pressable (`TabletDockedPlayer.tsx:83-103, 108-138`).
- The rail play target is 28pt + 8 slop and the icon is 16pt (`:160-165, 98-100`).
- No next or skip, no progress, no long-press or right-click menu, no keyboard focus.
- The labeled variant leaves the full 240pt width to title text that is 13pt.

**P-25 · Med · Dismissal relies on gestures.** The only button is the 40pt close pill
(P-05). There is no Esc, which [§8](../ipad-standards.md#8-sheets-menus-and-modals) requires. The drag-to-dismiss is attached to whole columns
(`TabletPlayer.tsx:693`, `TabletPlayerControlsColumn.tsx:276`), so a pointer user has no
discoverable way to dismiss except that pill.

**P-26 · Low · Discrete choices are modal sheets.**
- Speed (7 values) and sleep timer (5 values) take a full sheet.
- Repeat cycles three states from one icon (`TabletPlayer.tsx:353-358`), and only a background tint shows the state.
- `PlaybackSpeedSheet.tsx:51` has a dead pressed state: `pressed && !currentSpeed`, where `currentSpeed` is always truthy.
- The sleep timer has no "End of surah" option (`SleepTimerSheet.tsx:15`).

**P-27 · Low · A reading control sits among the listening tools.** Mushaf layout
(`options-outline`, `TabletPlayer.tsx:616-622`) is next to speed and repeat, and a
second "options" glyph (…) sits in the header.

**P-28 · Low · Adhkar session options is a full sheet for one action.**
`AdhkarSessionOptionsSheet.tsx:31-58` presents one destructive "Stop session" row.

### Accessibility

**P-29 · High · The iPad player is unlabeled.** `accessibilityLabel` appears
**zero** times in `TabletPlayer.tsx`, `TabletPlayerControlsColumn.tsx`,
`TabletDockedPlayer.tsx` and `Header.tsx`. VoiceOver reads the transport, all 7 tools,
heart, close and options as "button" or nothing. The phone mini players are labeled
(`MiniPlayer/index.tsx:81-84, 111-116`; `FloatingPlayer/index.tsx:128-130,
152-157`), so iPad is a regression from phone. (F-13)

**P-30 · High · No states and no adjustable scrubber.** Toggles (repeat, timer,
ambient, follow, queue, love) have no `accessibilityState`. The `Slider`
(`TabletPlayer.tsx:510-522`) has no label, no `accessibilityValue` text ("1:23 of
4:56") and no increment/decrement step. The speed and timer options
(`PlaybackSpeedSheet.tsx:46-61`, `SleepTimerSheet.tsx:75-90`) and ambient cards
do not expose `selected`.

**P-31 · Med · Low-contrast secondary text.** Estimated below 4.5:1 for 11-13pt:
- Docked subtitle is `textSecondary` at 55% (`TabletDockedPlayer.tsx:77-79`).
- Options-sheet subtitle is at 50% (`PlayerOptionsSheet.tsx:601`).
- The rewayah line is `textSecondary` × 0.85 opacity (`TabletPlayer.tsx:944-950`).
- Disabled controls are at 0.35.

**P-32 · Low · Reduce Motion is partial.** The surface honors it
(`PlayerSurface/index.tsx:72, 105-107, 288-296`). The love spring
(`TabletPlayer.tsx:282-284`) and the 250ms chrome fades do not.

### Platform integration

**P-33 · High · Landscape and multitasking are unreachable.** See F-01/F-02
(`app/_layout.tsx:215` locks portrait on all devices, `app.config.js:58`
`UIRequiresFullScreen`). Both landscape player variants are effectively dead,
untested code today, and lifting the lock exposes P-13.

**P-34 · Med · No keyboard control.** Space does not play or pause, and there are no
arrow-key seeks and no Esc to close (F-11). For an audio app used with a Magic Keyboard,
this is the most noticed gap.

**P-35 · Med · No pointer or context-menu integration.** There are no hover effects, and
`react-native-ios-context-menu@3.2.1` is unused on the docked player, queue rows
and the "…" button (F-10, F-12).

**P-36 · Low · No AirPlay route picker.** Nothing in `components/` or `services/`
references AirPlay or `AVRoutePickerView`. Apple Music and Spotify both put the route
button on Now Playing.

**P-37 · Low · Phone players will inflate in `compact` iPad windows.** When F-03
routes Slide Over and 1/3 windows to the phone shell, `FloatingPlayer`
(`FloatingPlayer/index.tsx:6, 88, 163-226`) and the phone `PlayerContent`
(`PlayerContent/index.tsx:20`, `TrackInfo.tsx:8`, `PlaybackControls/Controls.tsx:3`,
`ProgressBar.tsx:4`, `PlaybackControls/index.tsx:3`, `ControlButtons/index.tsx:13`)
will render at size-matters' iPad scale (2.4×) inside a 320pt window.

---

## Benchmark notes

- **Apple Music, iPad.**
  - Full-screen Now Playing covers the sidebar.
  - Landscape: large artwork (about 40% of the width) with title, scrubber and transport stacked
    under it on the leading side. Lyrics or "Playing Next" fill the trailing side
    when toggled, and the artwork stays put.
  - Portrait: stacked, with lyrics or the queue replacing the artwork area.
  - Bottom row: lyrics, AirPlay, queue.
  - The queue has a drag handle on every row, plus Shuffle / Repeat / Autoplay chips at its top.
  - Long-press anywhere gives a context menu.
  - Space plays and pauses; ⌘←/→ skip.
  - The mini player is a compact bar showing artwork, title, play/pause and next, with
    progress drawn along its edge.
- **Spotify, iPad.**
  - A persistent Now Playing bar runs along the bottom of the content.
  - In landscape, a toggleable right panel (~340pt) shows "Now playing" (art, credits,
    "Next in queue" preview) or the full queue.
  - Full-screen Now Playing has art on the leading side and a queue/lyrics card on the trailing side.
  - The Connect / device button sits next to the queue.
- **Tarteel / Quran.com, iPad.** The Mushaf is the hero. Audio controls form a
  slim bar at the bottom of the reading pane, with the current ayah highlighted and
  follow-along on by default. The reading column is capped (about 700pt) and centered, never squeezed.
- **Takeaways for Bayaan.**
  - The verses play the role that lyrics play in Apple Music. In wide windows,
    artwork, metadata and transport go in the leading column. The trailing pane
    switches between Text, Queue and Reciters, as
    [§10.4](../ipad-standards.md#104-full-player) prescribes. The reciter catalog is
    one of those tabs, not a permanent column.
  - In `medium` portrait, Apple Music and Tarteel both stack: one reading column
    with a transport bar or card below it.

---


## Proposed design

Layout comes from the **window width class**
([§2](../ipad-standards.md#2-width-classes-and-breakpoints)). The full player is
full-screen, so this is the window width, not a measured pane. That removes P-17.
Orientation is never consulted.

| Class | Windows | Shell mini player ([§6](../ipad-standards.md#6-navigation-and-app-shell)) | Full player |
|---|---|---|---|
| `compact` < 600 | Slide Over, ⅓ split, narrow Stage Manager | Phone accessory / pill | Phone `PlayerContent`, migrated to `utils/scale` (P-37) |
| `medium` 600-899 | mini and 11" portrait, ½ split on 13" | **Bottom bar across the content area**, next to the 88pt rail | **Stacked**: top bar + reading column + transport card *(differs from §10.4, see the last section)* |
| `expanded` 900-1279 | 11" landscape, 13" portrait, mini landscape | Card in the 240pt sidebar footer | **Two panes**: Now Playing column + switchable trailing pane (Text / Queue / Reciters) |
| `large` ≥ 1280 | 13" landscape, big Stage Manager windows | Card in the 280pt sidebar footer | Same two panes, wider margins |

Tokens used below are all from the standard:

- Type roles ([§4.1](../ipad-standards.md#41-ui-type-ramp)): tablet `title2` 22, `headline` 17, `callout` 15, `footnote` 13, `caption` 12.
- Spacing ([§5.1](../ipad-standards.md#51-spacing-scale-4pt-grid)): `sm` 8, `md` 12, `lg` 16, `2xl` 24, `3xl` 32.
- Page margins ([§5.2](../ipad-standards.md#52-page-margins-and-gutters-by-width-class)): `medium` 24, `expanded` 32, `large` 40.
- Radii ([§5.4](../ipad-standards.md#54-radii)): `sm` 8, `card` 14, `lg` 20, `pill`. Artwork uses 6% of its edge, clamped to 8-20.
- Reading column: 680 ([§5.3](../ipad-standards.md#53-content-width)).

The tablet player uses plain points, not `moderateScale`
([§3](../ipad-standards.md#3-sizing-and-scaling)). It paints one surface,
`readingColors.background`, plus at most a 4% tint (P-08, P-09). The active accent is
`theme.colors.primary` and destructive actions use `theme.colors.error` (P-10). Hover is
`Color(text).alpha(0.04)` ([§7.2](../ipad-standards.md#72-pointer-trackpad-and-mouse)).

### Shared building blocks (fixes P-18, enables everything else)

New directory `components/player/v2/parts/`:

| Component / hook | Replaces | Spec |
|---|---|---|
| `usePlayerTransport()` | handlers duplicated in both tablet files | Optimistic play/pause with rollback, prev/next with `isLastTrack`, ±`SEEK_INTERVAL` seek, slider seek state, repeat cycle, `isTimerActive` |
| `useCurrentRewayat()` | duplicated `getReciterById` effects | `{rewayat, label}` |
| `NowPlayingArtwork` | `renderTrackMeta` art branch ×2 | `size` prop, radius = clamp(6% × size, 8, 20), `borderCurve: continuous`, shadow `0/8/24` at 0.18 (dark 0.4). Microphone placeholder for uploads. Always passes `imageUrl` (P-12) |
| `TrackMeta` | `renderTrackMeta` | `variant: 'column' | 'row'`. Column: title `title2`, max 2 lines, leading-aligned, with heart and "…" trailing (Apple Music). Row: title `headline`. Reciter `callout` in `textSecondary` at full alpha. Rewayah as a `caption` chip (P-02, P-31) |
| `Scrubber` | `renderScrubber` ×2 | 44pt touch height. Track 4pt (radius `xs`), 8pt while dragging or hovering. Thumb visible on hover or drag. Times `footnote`, `tabular-nums`, `maxFontSizeMultiplier 1.3`. `adjustable` for VoiceOver (P-03, P-11, P-30) |
| `TransportRow` | `renderTransport` ×2 | −15 (48) · prev (48) · **play 64** circle (8% text fill) · next (48) · +15 (48), gaps ≥ `sm` ([§7.1](../ipad-standards.md#71-targets)). Pressed scale 0.92, hover overlay (P-22). `forceLTR` kept. Glyphs 22 (seek, skip) and 30 (play) |
| `PlayerToolButton` | 7 inline tool Pressables ×2 | 44×44 minimum. Props `label`, `selected` (12% primary fill + primary glyph), `disabledReason` (stays pressable and opens the explainer, P-23), `menu` / `popover` (anchored content, P-26). Glyph 20 |
| `PaneSwitcher` | the queue toggle | Segmented control, `pill` radius, 36h, `callout`: **Text · Queue · Reciters**. Reciters is hidden for uploads without a reciter. Selection persists in `playerStore.ui.pane` |
| `PlayerTopBar` | `Header` on tablet | 52h. Close 44 (chevron.down) leading. Trailing: follow-along ◎ and Aa (Text pane only), then "…". The `isTablet` size branch in `Header.tsx` is deleted (P-05) |

### Surface 1: mini player

**`medium`: bottom bar in the content area** ([§6](../ipad-standards.md#6-navigation-and-app-shell),
[§10.3](../ipad-standards.md#103-mini-player)). It replaces the 56pt rail card (P-24).

```
┌─88─┬──────────────────────────── content (746 on 11") ───────────────────────────┐
│rail│                                                                             │
│    │  … tab screen content (bottom inset = bar height) …                         │
│    ├▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░┤ 2pt progress (primary / 12%)
│    │ ┌────┐ Al-Baqarah               ⏮48  ( ▶ 48 )  ⏭48            (≡)  (…)     │ 64h + safe bottom
│    │ │ 44 │ Mishary Alafasy                                                     │ art 44 r8; headline / footnote
│    │ └────┘                                                                     │ margins 24
└────┴────────────────────────────────────────────────────────────────────────────┘
```

- The leading area (art + text) opens the full player on the last pane. ≡ opens it on
  **Queue**, and "…" is the track context menu (F-12).
- Material: glass (`USE_GLASS`) or `FrostedView` over the content, with a hairline top border.
  Every tab screen gets the bar height as bottom content inset through a shared
  `useMiniPlayerInset()`. Lists must not end under the bar.
- Below 700pt (½ split on 13", 683) the ≡ button and prev drop out. Play, next and
  "…" remain.

**`expanded` / `large`: card in the sidebar footer** (240 / 280pt sidebar):

```
┌──────────────── 224 / 264 ──────────────┐
│▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔░░░░░░░░░░░░░░░░░░░░░░░│ 2pt progress along the top edge
│ ┌────┐  Al-Baqarah                      │ art 44 r8 · title callout SemiBold 15
│ │ 44 │  Mishary Alafasy                 │ reciter footnote 13, textSecondary 100%
│ └────┘                                  │
│       ⏮ 44       ( ▶ 48 )       ⏭ 44    │ transport row, centered
└─────────────────────────────────────────┘  radius card 14, padding md 12, ≈ 124h
```

- Use one outer `View` with sibling Pressables (no nesting). Each one is labeled, and the expand area
  has the hint "Opens Now Playing" (P-24, P-29).
- Long press or secondary click opens the menu: Play/Pause, Next, Previous, Sleep timer ▸,
  Go to reciter, Open Up Next ([§7.2](../ipad-standards.md#72-pointer-trackpad-and-mouse)).
- The morph anchor (`useMiniPlayerAnchor`) moves with the bar or card. Radius = 14 for the card
  and 0 for the bar.

### Surface 2: full player, `medium` (mini and 11" portrait, ½ split)

```
┌─────────────────────────────── 834 ───────────────────────────────┐
│ (⌄)              [ Text | Queue | Reciters ]          (◎)(Aa)(…)  │ PlayerTopBar 52 + safe top
├───────────────────────────────────────────────────────────────────┤
│        ┌────────── reading column ≤ 680, centered ─────────┐      │ margins 24
│        │  ۞ ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ …   (active ayah)        │      │ QuranView parentContentWidth
│        │  …                                                │      │ = min(width − 48, 680)
│        └───────────────────────────────────────────────────┘      │
│                                                                   │
│     ┌──────────────────── transport card ≤ 680 ─────────────┐     │ radius lg 20, glass
│     │ ┌──────┐ Al-Baqarah                          (♥) (…)  │     │ art 64 · TrackMeta row
│     │ │  64  │ Mishary Alafasy · Hafs · Murattal            │     │
│     │ └──────┘                                              │     │
│     │ 1:23 ━━━━━━━━━━━━━━━━━●─────────────────────── -4:56  │     │ Scrubber 44h
│     │ (1×)(⟲)        ⏪  ⏮   ( ▶ 64 )   ⏭  ⏩         (☾)(♒)  │     │ tools flank the transport
│     └───────────────────────────────────────────────────────┘     │ ≈ 228h, bottom margin 24 + safe
└───────────────────────────────────────────────────────────────────┘
```

- The pane switcher swaps only the reading region (Text → `QuranView`, Queue →
  `QueueList`, Reciters → catalog). The card never moves
  ([§10.4](../ipad-standards.md#104-full-player) MUST).
- Reading tools (◎, Aa) sit in the top bar beside the pane they affect. Listening tools
  (speed, repeat, sleep timer, ambient) sit in the card (P-27). On mini (744) the flanking
  tools wrap to a fourth row under the transport, and the card grows to about 276h.
- **Immersive** (verse tap): the card slides into a 56pt capsule (art 40, title, play)
  centered at the bottom, and the top bar fades. With Reduce Motion this is a cross-fade (P-16, P-32).
- Fixes P-14: the reading column goes from 459 to 680pt on 11".

### Surface 3: full player, `expanded` / `large`

Now Playing column = 40% of the window, clamped to 380-520pt. Artwork =
`min(column − 2 × margin, 420, windowHeight − 420)`. The height term keeps the
transport on-screen on mini landscape (744 high).

| Window | Column | Artwork | Trailing pane | Reading column |
|---|---|---|---|---|
| mini landscape 1133×744 | 453 | 324 | 680 | 616 (pane − 2×32) |
| 11" landscape 1194×834 | 478 | 414 | 716 | 652 |
| 13" portrait 1024×1366 | 410 | 346 | 614 | 550 |
| 13" landscape 1366×1024 | 520 (clamped) | 420 | 846 | 680 |

```
┌──────────── 478 ────────────┬───────────────────── 716 ─────────────────────┐
│ (⌄)                     (…) │      [ Text | Queue | Reciters ]      (◎)(Aa) │ bars 52
│                             │                                               │
│  ┌───────────────────────┐  │    ┌──────── reading column ≤ 680 ─────────┐  │
│  │                       │  │    │                                       │  │
│  │    artwork 414 r20    │  │    │   Text: QuranView (follow-along)      │  │
│  │                       │  │    │   Queue: QueueList variant="pane"     │  │
│  └───────────────────────┘  │    │   Reciters: ReciterCatalogPanel       │  │
│  Al-Baqarah        (♥) (…)  │    │                                       │  │ title2 22
│  Mishary Alafasy            │    │                                       │  │ callout 15
│  [Hafs · Murattal]          │    │                                       │  │ caption chip
│  1:23 ━━━━━━━━━●──── -4:56  │    │                                       │  │
│   ⏪   ⏮   ( ▶ 64 )   ⏭   ⏩  │    │                                       │  │
│  (1×)  (⟲)  (☾)  (♒)  (⌂)   │    └───────────────────────────────────────┘  │ ⌂ = AirPlay (P-36)
└─────────────────────────────┴───────────────────────────────────────────────┘
```

- This replaces both landscape variants and the portrait split (P-13, P-15). It is the same
  at 11" and 13", and the reciter catalog becomes the **Reciters** tab.
- The column content is vertically centered and scrolls only when it is short. The background
  is `readingColors.background` + a 4% tint from the artwork's dominant color (or
  `primary`), with no glass (P-08, P-09). A hairline divider runs on the trailing edge (leading in RTL).
- **Immersive** (verse tap on Text): the column collapses to 0 over 250ms (instant with
  Reduce Motion). The reading column centers in the full width, and the Surface 2 capsule
  appears at the bottom. A second tap restores the column (P-16).
- Height-aware ([§2.2](../ipad-standards.md#22-rules)): below 700pt of window height the
  tools row moves into the "…" overflow before the artwork shrinks under 280.

### Surface 4: Queue and Reciters panes

- **Queue** (`QueueList`, P-21):
  - **Header.** `title2` "Up Next" with a `footnote` count, a **Clear** text button
    (removes everything after `currentIndex`), and Repeat and Shuffle chips (Apple Music). The 28pt
    `headerTitle` is dropped on tablet.
  - **Rows.** `minHeight` 60 ([§4.3](../ipad-standards.md#43-dynamic-type-and-font-scaling)),
    art 44 r8 (current: 52), title `headline`, subtitle `footnote`, overline section headers.
  - **Reorder.** A trailing drag handle (≡, 44×44) uses
    `react-native-draggable-flatlist` and calls `moveInQueue(from, to)`. Pointer drag works
    the same. VoiceOver gets "Move up" and "Move down" custom actions.
  - **Menu.** Long press or secondary click: Play now, Play next, Move to top, Remove,
    Go to reciter, Download. Swipe-to-remove is touch-only, and the menu covers it for pointer users
    ([§7.2](../ipad-standards.md#72-pointer-trackpad-and-mouse)).
  - **Played section.** Collapsed behind a disclosure row by default.
- **Reciters** (today's `TabletPlayerReciterColumn` content → `ReciterCatalogPanel`):
  rewayah chips + `SurahList` on `readingColors`. A tap on a surah runs *Play now*
  and shows an "Undo" toast with the previous queue. The menu adds Play next and Add
  to Up Next (P-21).

### Surface 5: phone players in `compact` iPad windows

- These use the phone shell and phone design unchanged
  ([§2.2](../ipad-standards.md#22-rules)). The work is migrating every size-matters import
  in P-37 to `utils/scale`, so a 320pt Slide Over window matches an iPhone.
- `FloatingPlayer`'s `!isTablet` gate becomes `widthClass === 'compact'`, so Android
  tablets in split screen get the pill. Swipe-up-to-open stays compact-only.

### Surface 6: sheets and menus from the player

Presentation follows [§8](../ipad-standards.md#8-sheets-menus-and-modals) (F-09): popovers
for player sub-sheets, menus for short lists, and form sheets ≤ 560 for content. Sheets stay as
they are on `compact`.

| Sheet | `medium`+ design | Fixes |
|---|---|---|
| `PlayerOptionsSheet` | "…" becomes a native menu (≤ 6 items): Download (progress in the title), Add to collection, Love, Share, Go to reciter, About this surah. Uploads get Edit details instead of Download. "About this surah" opens a **form sheet** 560w × ≤ 620h with `RenderHtml contentWidth = 560 − 48` and height from `useWindowDimensions` | P-01, P-19 |
| `PlaybackSpeedSheet` | `PlayerToolButton` menu, 0.5×-2× with a checkmark. Compact keeps the sheet: fix `pressed && !currentSpeed` (`:51`) and add `selected` | P-26, P-30 |
| `SleepTimerSheet` | Menu: Off, 5, 15, 30, 45, 60 min, **End of surah**. The active title shows "Stops in 12 min", and the tool shows a `caption` countdown | P-26 |
| `AmbientSoundsSheet` | **Popover** 360w anchored to the tool: 3-column grid of 104pt tiles (glyph 32 + `footnote`), volume slider 44h. Keeps the `onBeforeClose` "stop if only sampling" behavior | P-01, P-19 |
| `FollowAlongSheet` | **Popover** 360w × ≤ 480h from ◎, shown when it is pressed while unavailable (`disabledReason`) | P-23 |
| `MushafLayoutSheet` | Popover from Aa. Contents are in the reading doc | P-27 |
| `AdhkarSessionOptionsSheet` | Menu on the adhkar card's "…": one destructive "Stop session" item in `theme.colors.error` | P-28, P-10 |
| `SelectReciterSheet`, `ReciterPickerSheet` | Not opened from the player. They become form sheets ≤ 560 per §8, and get the size-matters migration in the same PR | P-01 |

### Keyboard, pointer, platform (P-34, P-35, P-36)

- Keys: the standard's table ([§7.3](../ipad-standards.md#73-hardware-keyboard)), registered while
  a track is loaded:
  - Space: play / pause
  - ⌘← / ⌘→: previous / next track
  - ← / →: seek (see the interval note in the last section)
  - ⌘L: follow-along
  - Esc, in order: close popover → exit immersive → close Now Playing. This chain lives
    in `PlayerHost.tsx`, beside the Android back handler, with the same precedence.
- Pointer: every `TransportRow`, `PlayerToolButton`, queue row and mini player gets hover.
  The scrubber reveals its thumb on hover.
- AirPlay: an iOS-only Expo module wrapping `AVRoutePickerView` (44×44, tint
  `text`, active `primary`). It sits in the tools row on `expanded`+ and in the "…" menu on `medium`.
- Lock screen: already handled by `LockScreenService`. Verify that upload artwork is sent.

### Accessibility spec (P-29, P-30, P-31, P-32)

- **Labels** through `t('player:a11y.*')`: Play, Pause, Previous track, Next track, Back 15
  seconds, Forward 15 seconds, "Playback speed, 1.25×", "Repeat, off / all / one",
  "Sleep timer, 12 minutes left", "Ambient sound, Rain", Follow along, Close player, More
  options, and Text / Queue / Reciters (as tabs, `accessibilityRole="tab"`).
- **States.** `{selected}` on toggles. `{disabled}` plus a hint with `disabledReason`.
  `{checked}` on love.
- **Scrubber.** `adjustable`, with `accessibilityValue.text` "1:23 of 4:56" and ±15s steps.
- **Reading order.** The leading column comes first and reads "Now playing, Al-Baqarah, Mishary
  Alafasy" ([§12](../ipad-standards.md#12-accessibility)).
- **Contrast.** No text below 0.55 alpha. Disabled is 0.45 plus the hint.
- **Reduce Motion.** The love bounce, chrome fades and column collapse become instant or fades.

---

## Implementation notes

These are ordered and sized for one PR each. Steps 1-3 are invisible on today's
portrait-locked iPad and can land before F-01/F-02. Each step updates
`docs/features/player.md` (new "Tablet layouts" section that links here) and the
standard's [§13](../ipad-standards.md#13-migration-plan) status table.

1. **Extract shared parts (P-18).**
   - Add `components/player/v2/parts/*` (table above) and `utils/formatTime.ts`.
   - Rebuild `TabletPlayer.tsx` and `TabletPlayerControlsColumn.tsx` on them with no visual change.
   - Unit-test `usePlayerTransport` (rollback, last-track guard).
2. **Accessibility pass (P-29, P-30, P-31, P-23).**
   - Labels, states, the adjustable scrubber and `disabledReason` in `parts/`.
   - Same pass in `TabletDockedPlayer.tsx` (un-nest the Pressables, pass `imageUrl`) and `Header.tsx`.
   - Add `player:a11y.*` keys in every locale.
3. **Sheet sizing (P-01, P-19).**
   - Migrate size-matters to `@/utils/scale` in `PlayerOptionsSheet`, `PlaybackSpeedSheet`,
     `SleepTimerSheet`, `AmbientSoundsSheet`, `FollowAlongSheet`,
     `AdhkarSessionOptionsSheet`, `SelectReciterSheet` and `ReciterPickerSheet`.
   - Fix `PlaybackSpeedSheet.tsx:51` and the module-scope `SCREEN_HEIGHT`.
   - Cap the width at 560 on `medium`+ ([§8](../ipad-standards.md#8-sheets-menus-and-modals) MUST).
4. **Width-class switch (P-13, P-17, P-20).** Needs `widthClass` from
   [§2.3](../ipad-standards.md#23-implementation).
   - In `PlayerBody.tsx`, route `compact` → `PlayerContent`, `medium` → stacked, and
     `expanded`/`large` → two panes.
   - Delete `leftPaneWidth`/`onLayout`, `SIDEBAR_WIDTH`, `flex: 11/9`, `maxWidth: 560` and
     the `orientation` reads.
   - Put the constants in `components/player/v2/layout.ts`
     (`NOW_PLAYING_COL = {ratio: 0.4, min: 380, max: 520}`, `ARTWORK_MAX = 420`,
     `READING_MAX = 680`, `TRANSPORT_CARD_MAX = 680`).
5. **Two-pane `expanded`/`large` (P-07, P-08, P-09, P-15, P-16).**
   - `NowPlayingColumn.tsx`, `PaneSwitcher.tsx`, and `playerStore.ui.pane`.
   - Rename `TabletPlayerReciterColumn` → `ReciterCatalogPanel` on `readingColors`.
   - Column collapse for immersive.
6. **Stacked `medium` (P-14, P-27).**
   - `PlayerTopBar`, the transport card and the immersive capsule.
   - Retire `TabletPlayerControlsColumn.tsx` and `TabletPlayer`'s `bodyOnly` path.
7. **Queue management (P-21).**
   - In `QueueList.tsx`: `variant` prop, `react-native-draggable-flatlist` → `moveInQueue`,
     a `clearUpNext` action in `playerStore`, row menus via `react-native-ios-context-menu`,
     and VoiceOver move actions.
   - Undo toast for Play now in Reciters.
8. **Mini players (P-24, P-06, P-12).**
   - `medium` bottom bar (new `components/tablet/TabletNowPlayingBar.tsx`, mounted by
     `TabletTabs` in `app/(tabs)/_layout.tsx`) plus `useMiniPlayerInset()` for tab screens.
   - Sidebar footer card redesign in `TabletDockedPlayer.tsx`.
   - Sidebar style switches on width class, not orientation (`TabletSidebar.tsx:131`).
9. **Menus and popovers (P-26, P-28, Surface 6).** Needs the
   F-09/F-12 primitives. Covers speed, sleep timer ("End of surah" sets `sleepTimerEnd` to
   the track end), ambient and follow-along popovers, the "…" track menu, and the adhkar stop menu.
10. **Keyboard and pointer (P-34, P-35, P-22).** Built on the F-11 `UIKeyCommand` module, with hover
    in all parts and the Esc chain in `PlayerHost.tsx`.
11. **AirPlay (P-36).** Add `modules/route-picker` (iOS only, no-op elsewhere).
12. **Compact phone players (P-37).**
    - Migrate `FloatingPlayer`, `PlayerContent`, `TrackInfo`, `PlaybackControls/*` and
      `ControlButtons` to `@/utils/scale`.
    - Change the `FloatingPlayer` gate to `widthClass === 'compact'`.
13. **Verification matrix.** For mini/11"/13" in both orientations, ⅓ / ½ / ⅔ splits, and
    Stage Manager windows of 900×600 and 1180×800, check:
    - the morph from the bar and the card
    - immersive in and out
    - pane switching (transport must not move)
    - VoiceOver order
    - AX3 Dynamic Type
    - Reduce Motion
    - sepia and dark reading themes (one surface color)

### Player-specific rules (extend the standard; for code review)

- **MUST** build transport, scrubber and tool UI only from `components/player/v2/parts/`.
- **MUST** use `PlayerToolButton` for icon-only player controls: label, `selected`, 44pt,
  pressed and hover.
- **MUST** have the full player paint one surface color, `readingColors.background` (tints ≤ 4%).
  Glass goes only over content that can show through.
- **MUST NOT** consult `orientation` for player layout.

---

## Proposed changes to the standard

1. **§10.4 `medium` row: stack, don't split.** The current portrait split leaves the
   text pane at 409pt (mini), 459pt (11") or 376pt (½ split on 13") after the controls
   column takes its share. That is phone width for the primary task, while the controls
   column sits mostly empty (P-14). Apple Music and Tarteel stack in portrait.
   - *Proposed row:* "`medium`: one reading column (≤ 680, centered) with the pane
     switcher in the top bar and a transport card (≤ 680) docked at the bottom."
   - *If the split is kept:* use a fixed 320pt controls column (artwork 272) instead of 11:9,
     which gives the text 424pt on mini and 514pt on 11". Below 760pt, fall back to the stacked layout.
2. **§10.4: specify the column and artwork math.** Add "leading column 40% of the window,
   clamped 380-520pt" and "artwork = min(column − 2×margin, 420, windowHeight − 420)".
   The 420 cap alone does not keep the transport on-screen on mini landscape (744pt high).
   Also add immersive: "hiding chrome collapses the leading column; it never leaves an empty pane."
3. **§4.1 `headline` as "player track title".** That fits the mini player and the
   transport card. For the full-player column at `expanded`+ (art ≥ 324pt), the title should be
   `title2` (22). At 17pt under 414pt artwork the hierarchy collapses (Apple Music uses
   about 22-24pt there).
4. **§7.3 ← / → "seek 10s (listening)".** The player's on-screen skip and its label are
   15s (`SEEK_INTERVAL` in `TabletPlayer.tsx:91`). Use one interval for keys,
   buttons and VoiceOver steps: either change the rule to 15s, or change `SEEK_INTERVAL` and
   the "15" glyph label to 10.
5. **§6 `medium` mini player bar: add an inset rule.** Docking the bar "spanning
   the content area" needs a MUST that every tab screen reserves its height
   (`useMiniPlayerInset()`). Otherwise lists end under it.
