# UI review checklist (phone and iPad)

Run this before opening any PR that adds or changes UI. Paste the checked list into the PR's Testing section. Each item links to the rule in [ipad-standards.md](ipad-standards.md).

## Screenshots

Every UI change is shown as **before and after** simulator screenshots on a review page (an artifact page linked from the PR body), not only described. Nothing merges until the maintainer has looked at them.

- [ ] iPad Pro 13" portrait and landscape, before and after
- [ ] iPad mini (portrait, plus landscape if the layout changes there)
- [ ] One iPhone shot proving the phone layout is unchanged (compare it pixel by pixel with the before shot)
- [ ] Dark reading theme screenshot of at least one of the above
- [ ] If the change depends on window width: an unfolded iPhone Duo (669×951) or a `medium` iPad window

## Layout

- [ ] The iPad version looks like the phone version unless space or input needs a difference ([§1](ipad-standards.md#1-design-goals), goal 6)
- [ ] Layout is chosen from the window width class, not from `isTablet` alone ([§2](ipad-standards.md#2-width-classes-and-breakpoints)); breakpoints are only 600, 900 and 1280
- [ ] Sizes come from the window, never `Dimensions.get('screen')` ([§2.2](ipad-standards.md#22-rules))
- [ ] No layout values from `Dimensions.get()` at module scope; rotation updates the screen ([§2.2](ipad-standards.md#22-rules))
- [ ] Grids, column counts, and pagers are sized from their measured container, not the window ([§2.2](ipad-standards.md#22-rules))
- [ ] Reading and form content is width-capped; grids and shelves use the full width with more columns ([§5.3](ipad-standards.md#53-content-width))
- [ ] Page margins match the width class (`pageSpacing()`), and list rows are inset 24pt (32pt from 900pt) from the pane edge ([§5.2](ipad-standards.md#52-page-margins-and-gutters-by-width-class))
- [ ] A new stack screen is put in the right group of its stack's `capScreensExcept` list ([§5.3](ipad-standards.md#53-content-width))
- [ ] Nothing stretches edge to edge on a 13" landscape screen without a reason

## Sizing and type

- [ ] Scaling helpers come from `@/utils/scale` (ESLint enforces it); tablet-only sizes are plain points ([§3](ipad-standards.md#3-sizing-and-scaling))
- [ ] Font sizes come from the type ramp; no new one-off sizes ([§4](ipad-standards.md#4-typography))
- [ ] Spacing and radii come from the tokens ([§5](ipad-standards.md#5-spacing-and-layout-grid))
- [ ] Text still fits at the largest Dynamic Type size; rows grow instead of clipping ([§4.3](ipad-standards.md#43-dynamic-type-and-font-scaling))

## Interaction

- [ ] Every target is at least 44×44pt ([§7.1](ipad-standards.md#71-targets))
- [ ] Rows and buttons have a hover state through `useHover()`, not `onHoverIn`; long-press menus also open on right-click ([§7.2](ipad-standards.md#72-pointer-trackpad-and-mouse))
- [ ] New shortcuts go through a `keyCommands` layer, have a menu title, are gated on `keyCommandsSupported()`, and don't fire while typing ([§7.3](ipad-standards.md#73-hardware-keyboard))
- [ ] No swipe-only or long-press-only actions
- [ ] On tablets nothing is full screen or full width except the player, Mushaf reader and adhkar reader: short lists are menus, everything else is a centered card or dialog card ([§8](ipad-standards.md#8-sheets-menus-and-modals))
- [ ] `ActionSheet` comes from `AdaptiveActionSheet`, and sheet content is laid out from `useSheetWidth()`

## Orientation and multitasking

- [ ] Works in all four iPad orientations; scroll position, the reader's page and player state survive rotation and window resize ([§11](ipad-standards.md#11-orientation-and-multitasking))
- [ ] Orientation locks go through `usePhoneOrientation()`, never `ScreenOrientation.lockAsync`
- [ ] Short windows still work: the iPad mini in landscape is the tightest common case (sidebar, player, reader toolbar)
- [ ] Works at a compact width on iPad (⅓ Split View or a narrow Stage Manager window, once multitasking is enabled)

## Accessibility and RTL

- [ ] Icon-only buttons have `accessibilityLabel` (through `t()`) and `accessibilityRole` ([§12](ipad-standards.md#12-accessibility))
- [ ] Text contrast is at least 4.5:1 on every reading theme you touched
- [ ] Reduce Motion replaces large animations with fades
- [ ] Arabic UI language: layout mirrors correctly, including the sidebar
