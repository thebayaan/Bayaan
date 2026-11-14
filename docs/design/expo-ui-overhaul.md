# Expo UI overhaul

Status: Phase 1 in progress (2026-10-30). Builds on #476, which adopted `@expo/ui` for controls, picker menus, and tablet-only menus, popovers and dialogs.

#476 kept phones pixel-identical, so on an iPhone it changed little. This plan extends native system UI to phones and replaces the remaining hand-built controls. It deliberately overrides the README lesson "Phones stay pixel-identical" for the pieces below: phones and tablets now share the native menu and dialog behaviour.

## Rules for every phase

- **Theme bridge.** Every `Host` takes its colour scheme and layout direction from `useNativeTheme`, and tints with `theme.colors.text`. Never `theme.colors.primary` or an accent.
- **One switch per risky change.** `components/native/nativeMenus.ts` holds the kill switches (`phoneMenusEnabled`, `rowContextMenusEnabled`).
- **Web keeps today's components** wherever Expo UI has no web build (menus, context menus, confirmation dialogs). The universal `Switch`, `Slider`, `Picker` and `BottomSheet` have web builds. The TV app is not touched.
- **Check on device** for every adopted control: RTL order, VoiceOver labels, 44pt targets, reading themes in light and dark.
- **Jest** mocks `@expo/ui`; tests assert which path (menu or sheet) a screen takes.

## Phase 1: native interaction on phones

- [x] ••• options open as native menus on phones (iOS SwiftUI `Menu`, Android Compose dropdown): surah rows and cards, the full player, downloads, uploads, loved, notes, bookmarks, favourite reciters, collections, playlists, home cards, adhkar sessions. The menu models in `components/sheets/options/*` are shared with the sheets. Gate: `useNativeOptionsMenu`.
- [ ] ~~Long-press context menus on iPhone.~~ Tried and reverted: a context menu wraps the whole row in a `Host` that sizes it. The reciter page renders all 114 rows unvirtualized, so the hosts stalled layout (BAYAAN-7G, a 3 to 4 s hang) and lost their size when the tab was reattached, blanking the list. Long press on a row opens the sheet again. Revisit with a lighter approach (a host only for the pressed row).
- [x] Destructive confirmations (`confirmDestructive`) as a SwiftUI confirmation dialog on iPhone too, rising as an action sheet. Informational alerts stay `Alert.alert`, which is already the native alert.
- [x] A ••• button with a native menu laid over it must not keep its own `onPress`. Firing the sheet under an opening menu froze the screen (Playlists). Every item and header that takes `optionsMenu` now drops its press handler when one is present.
- [x] iPad reciter page: with row context menus it took long to settle after a tab switch (same unvirtualized list), so surah and track rows lost their long-press menus on iPad too (`listRowContextMenusEnabled`). Cards keep theirs, and every row's ••• is still a native menu.
- [ ] Not yet covered: Mushaf player options (`mushaf-player-options`) and the verse actions sheet, which mix toggles and navigation and need their own menu model.

## Phase 2: replace the remaining custom controls

- Player scrubber (`ProgressBar`, `PlayerParts`) to the Expo UI `Slider`, retiring `@react-native-community/slider`. Keep tap-to-seek and the follow-along scrubbing callbacks.
- `ActivityIndicator` (22 files) to `ProgressView`; download progress to a circular `ProgressView`.
- `Share.share` (3 sites) to `ShareLink` where the share starts from a visible button.
- Empty states (downloads, bookmarks, notes, search) to `ContentUnavailableView` on iOS.
- Liquid Glass (`glassEffect`) on the mini player and floating player controls on iOS 26, behind `USE_GLASS`.

## Phase 3: prototypes first

Each is a single-screen prototype, reviewed on device before it spreads.

- **Settings as a SwiftUI `Form`.** The earlier objection was that it ignores reading themes; SDK 58's `scrollContentBackground` and `listRowBackground` modifiers let rows take theme colours. Prototype on Storage or Reading theme, then the other settings routes.
- **Native sheets on phones** (`presentationDetents`, grabber, glass) for form-style sheets: create playlist, add to collection, verse note, follow along. iPad keeps its centred cards (`AdaptiveActionSheet`, ipad-standards §8).
- **Swipe actions** on rows (delete download, remove from queue or playlist). SwiftUI swipe actions only work inside a `List`, so this depends on the Form prototype.

## Delivery

One PR per phase, each stacked on the previous until #476 merges, then retargeted to `develop`. Each PR is installed on a phone before review.
