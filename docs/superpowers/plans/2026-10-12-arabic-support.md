# Arabic Language Support (i18n + RTL) — Design & Plan

**Goal:** Bayaan can run fully in Arabic: every user-facing string is translated,
the layout mirrors right-to-left, Arabic data (surah names) is shown, numbers
use Arabic-Indic digits, and Arabic UI text renders in a proper Arabic font.

## Decisions

| Topic | Decision |
|---|---|
| RTL | Native mirroring via `I18nManager.forceRTL`. Changing language reloads the app. |
| Language selection | Follow the device language by default; in-app picker in Settings: System / English / العربية. |
| Coverage | All user-facing strings (screens, sheets, toasts, alerts, player, mushaf chrome, adhkar). |
| Content | Arabic surah names, Arabic-Indic digits, translated rewayah/style labels. Arabic reciter names are shown when the API provides `name_arabic` (optional field; backend work is out of scope). |
| Font | IBM Plex Sans Arabic (OFL), loaded under the existing `Manrope-*` aliases in Arabic mode. |

## Architecture

### `i18n/` module

- `i18n/language.ts` — language preference (`'system' | 'en' | 'ar'`) persisted in
  MMKV (synchronous, so it is readable at module-evaluation time, before any
  StyleSheet or component is created). `resolveLanguage()` maps preference +
  device locale (`expo-localization`) to `'en' | 'ar'`. `setLanguagePreference()`
  persists, calls `I18nManager.forceRTL`, and reloads with Expo's
  `reloadAppAsync` (also works without OTA updates), with Updates / dev reload
  fallbacks and a restart message if all supported reload paths fail.
- `i18n/index.ts` — initialises i18next synchronously with bundled JSON
  resources, `fallbackLng: 'en'`, and a global `arabicDigits` post-processor that
  converts ASCII digits in Arabic output to Arabic-Indic digits. The root layout
  performs RTL bootstrap after mounting: if `I18nManager.isRTL` disagrees with the resolved language
  (e.g. first launch on an Arabic device) it forces the direction and reloads
  once (guarded by an MMKV flag against reload loops).
- `i18n/locales/{en,ar}/<namespace>.json` — one file per feature area so
  translation work can be done in parallel without merge conflicts.
  Namespaces: `common`, `home`, `collection`, `settings`, `sheets`, `player`,
  `content`.
- `i18n/i18next.d.ts` — type augmentation so `t('settings:…')` keys are type-checked
  against the English resources.
- `i18n/format.ts` — `localizeDigits()`, `formatNumber()`, and
  `getSurahDisplayName()` for numbers/data rendered outside `t()`.
- `intl-pluralrules` polyfill — Hermes lacks `Intl.PluralRules`, which i18next
  needs for Arabic's six plural forms (`_zero/_one/_two/_few/_many/_other`).

### RTL handling

- Yoga mirrors `flexDirection: 'row'`, `margin/paddingLeft|Right`, and absolute
  `left/right` automatically once `I18nManager.isRTL` is true.
- `utils/rtl.ts` exports `isRTL`, `flipX` (a `scaleX: -1` transform for
  directional icons: chevrons, arrows, back buttons), and `forceLTR`
  (`direction: 'ltr'`). `appLayoutDirection` and React Navigation's
  `LocaleDirContext` explicitly set the root/component direction from the
  selected language, even when a retained native surface has stale constraints.
- Pinned to LTR (to keep current, already-correct behaviour):
  - Quran canvas geometry and facing-page spreads.
  - Media transport controls and progress sliders (platform guidelines: media
    playback controls are not mirrored).
- Horizontal FlatLists follow native direction so their scroll offsets and
  viewability calculations agree with their layout. Mushaf pagers invert only
  in English; Arabic already advances right-to-left. Dhikr pages inherit the
  app direction, including their child controls.
- `usePlayerScrollable` isolates the Gorhom vertical scroll viewport in LTR
  while restoring app direction on its content. Without this boundary,
  Fabric's RTL x-offset conversion can cause Gorhom's scroll-lock handler to
  call itself repeatedly and freeze startup with a restored player session.
- Quran Arabic text and Skia mushaf rendering are already RTL and unaffected.

### Fonts

`_layout.tsx` loads font files from `i18n/fonts.ts`. In Arabic mode the
`Manrope-*` aliases resolve to the matching IBM Plex Sans Arabic weight
(ExtraBold → Bold), so the ~560 existing `fontFamily: 'Manrope-…'` styles need
no changes. Plex Sans Arabic includes Latin glyphs, so English names still render.

### Native config

- iOS: `CFBundleLocalizations: ['en', 'ar']` so iOS reports Arabic as a supported
  app language (enables the per-app language setting in iOS Settings and makes
  native chrome — tab bar, nav bar, alerts — RTL when the system language is Arabic).
- Android already declares `android:supportsRtl="true"`.
- `expo-localization` plugin registers supported locales only. Do not set
  `supportsRTL` or `forcesRTL`: those static options overwrite the persisted
  in-app preference on iOS startup. See [Expo dynamic RTL guidance](https://docs.expo.dev/guides/localization/#overriding-rtl-settings).
- Requires a new native build (new native module + Info.plist change).

## Known limitations

- Tabs retain their existing platform design and mirror in Arabic. The iOS
  native tab controller uses SDK 57's supported
  `unstable_nativeProps={{direction: appDirection}}`, placing Home on the right
  and the separate Search tab on the left. No Screens patch is needed. The custom
  tab row follows app direction, and the tablet rail moves to the leading side.
  The native tab shell keeps LTR Yoga coordinates to prevent clipping its
  mini-player accessory; screens and player content use app direction.
  OS dialogs still follow the system/per-app language.
- Reciter names use API Arabic names or the bundled Arabic name map, then
  fall back to the original name when neither is available.
- Arabic mode opens the Tafaseer catalogue tab first and places Arabic editions
  before other downloads/languages. The reader selector also sorts Arabic first.
  Edition titles and language labels are localized, including existing downloads;
  saved selections and the source text remain unchanged.
- Changelog / "What's New" release notes and long-form content (tafsir, about page
  prose that comes from data files) are not translated in this pass.

## Implementation tasks

1. **Infrastructure** (lead): deps, `i18n/` module, fonts, RTL bootstrap,
   `utils/rtl.ts`, `i18n/format.ts`, `common` namespace, tabs labels,
   language picker screen in Settings, native config, parity test.
2. **String extraction** (parallel workers, disjoint file ownership; each owns
   its namespace JSON files):
   - `home`: home/search/surahs tabs, hero, browse, cards, search, top-level list components.
   - `collection`: collection tab, playlists, system playlists, downloads, uploads.
   - `settings`: settings screens, settings components, modals, changelog shell.
   - `sheets`: `components/sheets/**`.
   - `player`: player, mushaf chrome, quran reader, reciter profile, adhkar.
   - `content`: user-facing strings in `hooks/`, `utils/`, `services/`, `data/`
     (toasts, alerts, categories, onboarding, rewayah/style labels), tablet sidebar,
     bottom tab bar.
   Each worker also applies `flipX` to directional icons, `forceLTR` where
   needed, and `localizeDigits`/`getSurahDisplayName` for rendered data in its files.
3. **Verification** (lead): `tsc` (no new errors vs baseline), ESLint on touched
   files, Jest locale parity test (same keys + same `{{placeholders}}` in en/ar),
   grep for remaining hardcoded JSX strings.

## Testing

- `i18n/__tests__/locales.test.ts`: every namespace has identical key sets in en and
  ar (accounting for Arabic plural suffixes), identical interpolation variables,
  and no empty values.
- `i18n/__tests__/format.test.ts`: digit localisation and surah name selection.
- `utils/__tests__/catalogSearch.test.ts`: Arabic/Persian numeric lookup,
  diacritics and spelling variants, spaced reciter names, English matching,
  and preservation of original display text. Browse Surahs now has a connected
  native iOS search field and a search field on other platforms.
- `i18n/__tests__/language.test.ts`: switching both directions, System language
  changes between launches, stale native flags, recovery of disabled style
  mirroring, reload fallback, and reload-loop prevention.
- `hooks/__tests__/usePlayerScrollable.test.tsx`: locks scroll coordinates to
  LTR in both languages while preserving content direction and list props.
- iOS simulator verification: restored player startup, Arabic → English →
  Arabic reloads, native direction flags, mirrored screen layouts, and the
  original native tab design.
- Native-tab follow-up: built and installed on the iOS 26.5 simulator. Verified
  English tab order, Arabic Home on the right/Search on the left after an
  in-app language change, the expanded Search field, tab switching, and the
  regular mini-player accessory. The language picker uses a plain checkmark.
  TypeScript and touched-file ESLint checks passed (existing warnings only).
- Remaining device QA: Android and iPad, physical swipe/paging gestures, and
  Arabic text clipping with accessibility font sizes.

## SDK 57 integration verification

The Arabic branch includes the Expo SDK 57 upgrade (PR #345): Expo 57.0.28,
React Native 0.86.3, Router 57.0.25 and Screens 4.26.0. Conflicts preserve the
new rewayah verse units, bookmark/note anchors, download guards, sharing and
individually accessible player controls. Display formatting translates their
labels without changing stored verse numbers or playback state.

- TypeScript passes with Node 24 and an 8 GB heap.
- Full Jest run with `BAYAAN_OVERLAY_DB_DIR=bundled`: 195 suites and 2,430 tests
  pass; one suite / two tests remain skipped by the existing configuration.
- Both iOS and Android production bundles export successfully.
- The signed Debug iOS simulator build passes with Xcode 26.5. CarPlay artwork
  sizing uses the supported card-element API so the iOS 27 SDK is not required.
- iOS 26.5 simulator checks confirm Arabic and English native tab placement,
  language reloads, the plain selection tick, the mini-player accessory, and
  the expanded Arabic player. The running native version is React Native 0.86.3.
- Android and tablet visual checks remain outstanding.

Jest initializes the real English translation resources and mocks native MMKV
storage. Language-specific tests keep their own storage and direction mocks.
