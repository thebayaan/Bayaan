# Bayaan design system (as built)

This is a description of the design system **as it exists in the code today**, so contributors can find the right token instead of inventing one. Where the code is inconsistent, that is called out under **Known debt**; the rules for fixing it live in [ipad-standards.md](ipad-standards.md).

Last surveyed against `develop` in October 2026.

---

## 1. Principles

These are the principles the existing UI follows. New work should keep them.

1. **Content first, chrome quiet.** The Quran text, reciter artwork, and playback controls carry the screen. Chrome (cards, dividers, icons) is drawn with low-alpha tints of the text color rather than brand color.
2. **Monochrome UI, user-chosen accent.** UI chrome is derived from `theme.colors.text` and `theme.colors.textSecondary`. `theme.colors.primary` is a user preference and is **not** used for chrome (see `CONTRIBUTING.md` → Design system).
3. **Reading themes drive the whole app.** The reading theme the user picks recolors every screen, not just the Mushaf.
4. **Calm motion.** Transitions are short and physical (the player morphs from the mini player; sheets slide). No decorative animation.
5. **One codebase, phone first, tablet adapted.** Phone layouts are the baseline; tablet layouts are opt-in branches gated on `useResponsive()`.

---

## 2. Theming

### Where themes come from

| Piece | File | Notes |
| --- | --- | --- |
| Live theme object | `utils/themeUtils.ts` → `createTheme()` | Used by `store/themeStore.ts`; read with `useTheme()` from `hooks/useTheme.ts` |
| Base light/dark palettes | `styles/colorSchemes.ts` | `lightColors`, `darkColors`, `primaryColors` |
| Reading themes | `constants/readingThemes.ts` | 7 light + 7 dark palettes that override `background`, `backgroundSecondary`, `text`, `textSecondary`, `card` |
| Reading-theme colors hook | `hooks/useReadingThemeColors.ts` | |

Always read colors from `useTheme().theme.colors`. Never import a palette file directly into a component, because it bypasses the user's reading theme.

### Theme shape

```ts
theme.colors       // background, backgroundSecondary, text, textSecondary, card,
                   // border, secondary, accent, tertiary, light, shadow, error, primary
theme.isDarkMode   // boolean
theme.fonts        // regular | medium | semiBold | bold | heading | light | extraLight | extraBold (all Manrope)
theme.typography   // headingSize 30, subheadingSize 18, bodySize 16, arabicSize 20,
                   // mediumSize 14, smallSize 12, captionSize 10 (scaled; barely used, see debt)
theme.spacing.unit // 7 (scaled; unused)
```

### Reading themes

Light: `default` (#f4f3ec), `parchment`, `white`, `sage`, `rose`, `cool`, `sand`.
Dark: `dark-default` (#050b10), `dark-sepia`, `oled`, `dark-sage`, `charcoal`, `indigo`, `dark-amber`.

Every color you draw must look right on all fourteen. Test at least `default`, `parchment`, `oled`, and `dark-amber` when you add a surface.

---

## 3. Color tokens

The alpha-based system from `CONTRIBUTING.md`, using the `color` package:

| Token | Value | Usage |
| --- | --- | --- |
| Card background | `Color(text).alpha(0.04)` | Surface backgrounds |
| Card border | `Color(text).alpha(0.06)` | 1px borders |
| Divider | `Color(text).alpha(0.06)` | Hairline separators |
| Pressed state | `Color(text).alpha(0.06)` | Pressable feedback |
| Selected / active row | `Color(text).alpha(0.08)` | Sidebar active item (`TabletSidebar`) |
| Inactive icon / label | `Color(text).alpha(0.55)` | Unfocused sidebar and tab items |
| Icon | `Color(text).alpha(0.7)` | Secondary icons |
| Option label | `Color(text).alpha(0.85)` | Row labels |
| Section header | `Color(textSecondary).alpha(0.5)` | ALL CAPS labels. Fails contrast (about 3:1); new code uses 0.8 or more per [ipad-standards.md §12](ipad-standards.md#12-accessibility) |
| Primary button bg | `text` | Action buttons |
| Primary button text | `background` | Button labels |
| Error | `theme.colors.error` | Destructive actions and errors only |

Special-purpose palettes live in `constants/tajweedColors.ts`, `constants/mushafAllahHighlight.ts`, and `constants/adhkarColors.ts`. Use them only in their own feature.

`constants/Colors.ts` is the Expo template's leftover palette and is not part of the system. Do not use it.

---

## 4. Typography

### Typefaces

| Family | Files | Use |
| --- | --- | --- |
| **Manrope** (ExtraLight → ExtraBold) | `assets/fonts/Manrope-*.ttf` | All Latin UI text |
| **IBM Plex Sans Arabic** | `assets/fonts/IBMPlexSansArabic-*.ttf` | Arabic UI text (localized chrome) |
| **Scheherazade New** | `assets/fonts/ScheherazadeNew-*.ttf` | Arabic body text outside the Mushaf |
| **Uthmani / UthmanicHafs** | `assets/fonts/Uthmani.otf`, `UthmanicHafs1Ver18.ttf` | Quran text in list views |
| **DigitalKhatt** (Skia) | `services/mushaf/` | Mushaf page rendering; see `docs/features/digital-khatt/` |
| **Surah name glyphs** | `surah_names.ttf`, `surah_names_2.ttf` | Calligraphic surah titles (`constants/surahNameGlyphs.ts`) |

Use `theme.fonts.*` rather than string literals where you can. In practice about 500 call sites hardcode `'Manrope-SemiBold'` and friends; that works, but is harder to change.

### Sizes in use

Measured from `fontSize:` call sites in `app/` and `components/` (base values before scaling):

| Size (pt) | Uses | Typical role |
| --- | --- | --- |
| 9–11 | ~125 | Badges, captions, metadata |
| 12–13 | ~205 | Secondary labels, section headers |
| 14–15 | ~150 | Row titles, body |
| 16–18 | ~140 | Emphasized body, list titles, subheadings |
| 20–24 | ~50 | Screen and card headings |
| 28–30 | ~5 | Large titles |

Weights: SemiBold is the default for titles and labels, Medium for secondary text, Regular for body, Bold for headings. There is no named type ramp yet; [ipad-standards.md §4](ipad-standards.md#4-typography) defines one.

---

## 5. Spacing, radii, icons

Values measured across `app/` and `components/` (base values, usually wrapped in `moderateScale`):

| Kind | Most used values | Read as |
| --- | --- | --- |
| Padding | 16, 20, 14, 8, 12, 10, 6, 4, 24, 32 | Roughly a 4pt grid with 14/10/6 outliers |
| Border radius | 12, 8, 14, 20, 10, 16, 28, 6, 4, 32 | 14 is the documented card radius; 12 is the most common |
| Icon size | 20, 18, 16, 22, 24, 14, 30, 48 | 20 for row and toolbar icons, 24 for primary actions |

Card pattern (from `CONTRIBUTING.md`):

```tsx
{
  backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
  borderWidth: 1,
  borderColor: Color(theme.colors.text).alpha(0.06).toString(),
  borderRadius: moderateScale(14),
  overflow: 'hidden',
}
```

Reference implementations: `components/sheets/MushafSettingsContent.tsx`, `components/sheets/VerseActionsSheet.tsx`.

---

## 6. Size scaling

Every file scales through `@/utils/scale` (since #425). It exports the same API as `react-native-size-matters` (`scale`, `verticalScale`, `moderateScale`, `moderateVerticalScale`, `s`, `vs`, `ms`, `mvs`, and `ScaledSheet` with the `'16@s'` string units). On phones the values are identical to the library's. On tablets it scales as a 430×932 large phone in any orientation, so 15pt body text draws at about 16.7pt instead of about 30pt.

An ESLint `no-restricted-imports` rule blocks `react-native-size-matters`. The package stays installed only as the reference in `utils/__tests__/scale.test.ts`.

Constants live in `utils/responsive.ts`: `TABLET_BREAKPOINT = 600` (shortest window side; was 700 before #448) and `PHONE_SCALE_CAP = 430`. Sizes are read once at launch, so they don't change when an iPhone Duo folds or unfolds.

See [ipad-standards.md §3](ipad-standards.md#3-sizing-and-scaling).

---

## 7. Responsive building blocks

| Piece | File | What it does |
| --- | --- | --- |
| `useResponsive()` | `hooks/useResponsive.ts` | Live `width`, `height`, `shortestSide`, `orientation`, `isTablet`, `isPhone`, `scaleWidth`. Re-renders on rotation |
| Static helpers | `utils/responsive.ts` | `getIsTablet()`, `getShortestSide()`, `getScaleWidth()` for non-component code |
| `MaxWidthContainer`, `capScreensExcept` | `components/layout/MaxWidthContainer.tsx` | Centers children in a capped column (default 720pt) on tablet; no-op on phone. Each tab stack passes `capScreensExcept([...])` as its `screenLayout`, so grid screens take the whole pane and the rest stay capped (Settings uses 640pt) |
| Grid and page math | `utils/gridLayout.ts` | `computeGridLayout()` and `computeShelfLayout()` give columns and card widths from the measured pane; `pageSpacing(windowWidth)` gives the margin and gutter (24/16, 32/20 from 900pt, 40/24 from 1280pt) |
| Tablet shell | `app/(tabs)/_layout.tsx` → `TabletTabs` | Leading sidebar replaces the tab bar on tablet |
| `TabletSidebar` | `components/tablet/TabletSidebar.tsx`, `sidebarNav.ts` | 88pt icon rail below 900pt, labeled sidebar from 900pt (240pt, 280pt from 1280pt) with Collection's sections; folds to the rail and remembers it; docks the mini player; flips side for RTL; ⌘1–5 and ⌘F |
| `TabletDockedPlayer` | `components/tablet/TabletDockedPlayer.tsx` | Mini player inside the sidebar |
| Tablet full player | `components/player/v2/tablet/` (`TabletPlayerLayout`, `PlayerParts`, `playerMetrics`) | Below 900pt: one pane with a floating transport card. From 900pt: Now Playing column plus a Text / Queue / Reciters pane |
| Reading column | `components/player/v2/PlayerContent/QuranView/index.tsx` | Caps the verse column at 680pt on tablet |
| Sheets | `components/sheets/AdaptiveActionSheet.tsx` | Phones: library bottom sheet. Tablets: centered card (560×760 max) or, with `tabletPresentation="menu"`, a 340pt menu anchored to the last touch (`utils/lastTouch.ts`). `useSheetWidth()` for content |
| Dialog card | `components/layout/TabletDialog.tsx` | Centered card for modal routes on tablet (Translations, reciter filter, Mushaf search, surah picker); stays above the keyboard |
| Orientation | `hooks/usePhoneOrientation.ts` | Portrait lock and the reader's free rotation, on phones only |
| Pointer and keyboard | `hooks/useHover.ts`, `services/keyboard/keyCommands.ts`, `modules/bayaan-keyboard` | Hover through W3C pointer events; layered key commands shown in the iPadOS menu bar (iPad only, needs a native build) |

---

## 8. Core components

Prefer these over building new ones:

| Need | Use |
| --- | --- |
| Button | `components/Button.tsx` (`small` / `medium` / `large`) |
| Screen header | `components/ScreenHeader.tsx`, `components/Header.tsx`, `hooks/useCollectionNativeHeader.tsx` |
| Search | `components/SearchBar.tsx`, `components/SearchInput.tsx` |
| Segmented tabs | `components/TabSelector.tsx` |
| Toggle | `components/Toggle.tsx` |
| List rows | `SurahItem`, `ReciterItem`, `TrackItem`, `PlaylistItem` in `components/` |
| Sheets | `react-native-actions-sheet` (`SheetManager`) with content in `components/sheets/`, always imported through `components/sheets/AdaptiveActionSheet`; `components/BottomSheetModal.tsx` |
| Blur surface | `components/FrostedView.tsx` (iOS blur, Android solid card); `hooks/useGlassProps.ts` for liquid glass |
| Images | `expo-image`, and `components/ReciterImage.tsx` for reciter art |
| Lists | `@shopify/flash-list` (`FlashList`) |
| Press feedback | `Pressable` with the pressed-state token (never `TouchableOpacity`) |

---

## 9. Known debt

Each of these has a matching rule in [ipad-standards.md](ipad-standards.md). This list was written on 2026-10-26; the notes in brackets say where things stand after the iPad build (2026-10-29), and [ipad-standards.md §13](ipad-standards.md#13-migration-plan) has the full status.

1. **Uncapped scaling.** About 190 files import `react-native-size-matters`, so most of the app renders 1.7–2× larger on iPad than intended. This is the main cause of the "everything looks too big" feel. *(Fixed in #425.)*
2. **Device-based layout.** `isTablet` is true for every iPad regardless of window size, so once multitasking is enabled a 320pt Slide Over window would get the tablet layout. *(Still open: tablet layouts use 900pt lines inside `isTablet`, but there is no `widthClass` yet.)*
3. **Portrait lock on iPad.** `app/_layout.tsx` calls `ScreenOrientation.lockAsync(PORTRAIT_UP)` on every device, and only `app/mushaf.tsx` unlocks it. The landscape branches in `TabletSidebar`, `PlayerBody`, and `TabletPlayer` are therefore unreachable outside the Mushaf screen, even though `Info.plist` declares all four iPad orientations. *(Fixed in #446: locks are phone-only through `usePhoneOrientation`.)*
4. **No multitasking.** `app.config.js` sets `UIRequiresFullScreen: true`, which opts out of Split View, Slide Over, and Stage Manager. Apple deprecated this key in iPadOS 26. *(Fixed in #446: `false`, matching `Info.plist`.)*
5. **Two `createTheme` copies.** `styles/theme.ts` and `utils/themeUtils.ts` both define it, and both read `Dimensions` once at module load. `utils/themeUtils.ts` is the live one.
6. **No type ramp.** `theme.typography` is used in two places; sizes are hardcoded per component. *(Still open.)*
7. **One-size column cap.** `MaxWidthContainer` caps every tab at 720pt, including grids and browse shelves that should use the full width in landscape. *(Mostly fixed in #428 and the screen PRs; see §7.)*
8. **Thin accessibility coverage.** About 60 `accessibilityLabel`s across the app, no `maxFontSizeMultiplier` policy, and no reduce-motion handling outside a handful of files. *(Partly fixed: player, reader and surah row labels in #408, #412, #413, #415.)*
9. **No pointer or keyboard support.** No hover states and no hardware keyboard shortcuts. *(Partly fixed in #447: shortcuts, and hover on the sidebar.)*
