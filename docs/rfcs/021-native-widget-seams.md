# RFC-021: Native widget and car seams

| Field  | Value      |
| ------ | ---------- |
| Status | Proposed   |
| Date   | 2026-10-11 |
| Author | Osman Saeday (requested by Omar Zarka, Qariah) |

## Summary

The native widgets (iOS WidgetKit, Lock Screen, Live Activity, Controls; Android Glance) and CarPlay / Android Auto shipped with Bayaan's identity baked into Swift, Kotlin and resources, and with no way to drop a widget. This RFC adds four seams, all derived from fork config (`app.config.js`, `config/branding.js`, `config/featureFlags.ts`, and a new `config/nativeWidgets.config.js`), so a fork changes config, not widget sources: the deep-link scheme, the brand name and mark, a per-widget on/off list (plus feature-flag derivation), and the surah artwork CDN base. Bayaan's default output is unchanged.

## Motivation

From Qariah's request:

- **Scheme.** Every widget URL was a `bayaan://` literal (e.g. `targets/widgets/Adhkar/AdhkarWidget.swift`, `modules/bayaan-widgets/.../AdhkarWidget.kt`). A fork with its own scheme got dead widget taps on Android (an explicit-package `ACTION_VIEW` for a scheme the app does not register).
- **Brand.** "Open Bayaan", "Bayaan Now", the Lock Screen and Control titles, the Hijri fallback, the CarPlay empty state, the Android Auto root title and the car notification all said "Bayaan". The starburst was code (`BayaanMark.swift`, `bayaan_mark.xml`).
- **Per-widget on/off.** Widgets and car ignored feature flags. Qariah hides adhkar and ambient audio, yet would still ship the Adhkar and Tasbeeh widgets and Bedtime's ambient picker.
- **Artwork.** `services/widgets/artworkNames.ts` hardcoded the surah card base while CarPlay already followed `branding.surahArtworkCdnBase`.

## Decision

### 1. Deep-link scheme (`app.config.js` `scheme`)

`plugins/withBayaanWidgets.js` reads `scheme` (the first entry when it is an array; invalid values fall back to `bayaan` with a warning) and writes:

| Platform | Output |
| --- | --- |
| iOS app | `BayaanURLScheme` in Info.plist |
| iOS widget extension | `BAYAAN_URL_SCHEME` build setting on `BayaanWidgetsExtension`; `targets/widgets/Info.plist` maps it to `BayaanURLScheme` |
| Android | `bayaan_widgets_url_scheme` in `android/app/src/main/res/values/bayaan_widgets.xml`, overriding the bayaan-widgets library default |

Swift builds every URL with `AppLinks.url(_:)` (`targets/widgets/_shared/AppIdentity.swift`), Kotlin with `AppLinks.url(context, path)` / `appLink(context, path)`. Both fall back to `"bayaan"` when the value is missing or invalid; that fallback is the only remaining scheme literal. The iOS edit runs in a finalized mod because `@bacons/apple-targets` rebuilds the widget target's build configurations in its own Xcode mod, and it edits `project.pbxproj` as text so the file's formatting is kept. CarPlay and Android Auto build no deep links. The internal `bayaan-widget://` data URIs on Android are PendingIntent keys for explicit intents, not deep links, and stay.

### 2. Brand name and mark

Runtime copy reads the app's display name:

- iOS widgets: `AppBrand.name` (the extension's `CFBundleDisplayName`, which apple-targets sets from `app.config.js` `name`, then `CFBundleName`, then `"Bayaan"`).
- CarPlay: `CarBrand.name` from the main app bundle.
- Android widgets: `AppBrand.name(context)`, the application label (`@string/app_name`, from `name`).
- Android Auto: `CarBrand.name`, loaded from the application label when the library service starts.

Static Android resources that carry the brand (`bayaan_widget_now_label`, "Bayaan Now") are generated from `name` by the plugin. Wording is otherwise unchanged ("Open Bayaan" becomes "Open <name>").

App Intent titles and descriptions in `targets/widgets/_shared/PlaybackIntents.swift` ("Play or Pause Bayaan" and three descriptions) stay literal: App Intents metadata is extracted at compile time and must be constant. They are `LocalizedStringResource` keys, so a fork overrides them with a `Localizable.xcstrings` (or `.strings`) entry in the app and widget targets, keyed by the English text.

Mark:

- iOS: `BayaanLogo` draws a `BrandMark` image when the widget asset catalog has one, else the vector `BayaanMark`. A fork adds `targets/widgets/Assets.xcassets/BrandMark.imageset/` with a single-color PDF or SVG (Preserve Vector Data on); it renders as a template in the same white at the same 6:5 frame.
- Android: views use `R.drawable.bayaan_mark`. A fork adds `android/app/src/main/res/drawable/bayaan_mark.xml` (vector, 600 x 500 viewport, white), which overrides the library drawable by name.

### 3. Per-widget on/off (`config/nativeWidgets.config.js` plus feature flags)

```js
// config/nativeWidgets.config.js (plain CJS, no imports; typed by nativeWidgets.config.d.ts)
module.exports = {widgets: undefined};
```

The list lives in its own dependency-free file, not in `branding.js`: the plugin runs in Node at prebuild, and a fork's `branding.js` may require TS/TSX for its runtime values (`listenTabTopComponent`, providers), which Node cannot load. The plugin never loads `branding.js`. `config/nativeWidgets.js` (CJS, no imports, typed by `nativeWidgets.d.ts`) holds the ids and `resolveNativeWidgets(widgets, flags)`. A surface ships when the list includes it (absent list = all; unknown ids are ignored, with a warning at prebuild) and every flag it needs is on:

| Flag off | Effect |
| --- | --- |
| `adhkar` | Adhkar and Tasbeeh widgets removed; Bayaan Now's adhkar cards fall back to listening |
| `sleepTimer` | Bedtime widget removed; Bayaan Now's bedtime card falls back to listening |
| `ambientAudioOverlay` | Bedtime keeps working without its ambient option (iOS parameter compiled out, Android menu row hidden, stored sounds ignored, the app ignores a stale command's sound) |
| `userUploads` | CarPlay / Android Auto lose the Library "Uploads" row and list |

No control, Live Activity or App Shortcut depends on adhkar or ambient audio, so none follows those flags; each can still be listed out by id (`PlaybackControl`, `PlaySurahControl`, `LiveActivity`, `ListeningAccessory`). The car has no adhkar or ambient surfaces.

Ids: `ContinueListening`, `ContinueReading`, `QuickSurah`, `PinnedReciter`, `AyahOfTheDay`, `Tasbeeh`, `RecentlyPlayed`, `LibraryShelf`, `Bedtime`, `ReciterSpotlight`, `Adhkar`, `HijriDate`, `Occasion`, `BayaanNow`, and iOS-only `ListeningAccessory`, `LiveActivity`, `PlaybackControl`, `PlaySurahControl`.

Enforcement:

- **iOS (build time).** The plugin reads `nativeWidgets.config.js` and `featureFlags.ts` (transpiled with `typescript`, its imports resolved from `config/`) lazily, only when a native mod runs, so `npx expo config` / `expo start` never touch them, and adds `BAYAAN_NO_WIDGET_<ID>` / `BAYAAN_NO_FEATURE_<FEATURE>` to the widget target's `SWIFT_ACTIVE_COMPILATION_CONDITIONS`. `WidgetsBundle.swift` and `ContentWidgets.swift` wrap each widget in `#if !BAYAAN_NO_WIDGET_<ID>` (verified to compile at the iOS 17 deployment target, including an empty nested bundle). The default config defines nothing, so the committed project is unchanged.
- **Android (picker).** The plugin writes `bayaan_widget_enabled_<id>` and `bayaan_widgets_feature_<feature>` booleans. The library manifest sets `android:enabled="@bool/bayaan_widget_enabled_<id>"` on each receiver and its config activity, so a disabled widget never appears in the picker. Library defaults are all `true`.
- **JS (runtime).** `services/widgets/enabledWidgets.ts` resolves the same list. Sync skips reloads for disabled kinds (except `ContinueListening`, kept while the Lock Screen widget or play/pause control ships, because native reloads refresh those through it), never starts a Live Activity when `LiveActivity` is listed out (`liveActivityMode()` is `'off'`; there is no in-app Live Activity setting to hide), writes no Tasbeeh entries or catalog adhkar without Tasbeeh, builds no spotlight without Reciter of the Day, and reads no playlists without the Library widget.

`contextRules.ts`, `ContentLogic.swift` and `ContentLogic.kt` take optional `adhkar` / `bedtime` arguments for Bayaan Now (default on); the shared vectors are unchanged and each platform has tests for the gated cases.

### 4. Surah artwork (`branding.surahArtworkCdnBase`)

`utils/surahArtworkBase.ts` holds `DEFAULT_SURAH_ARTWORK_BASE` (`https://cdn.thebayaan.com/assets/car/surah/`) and `normalizeSurahArtworkBase` (https only, trailing slash added, else the default). The car snapshot and the widgets (`services/widgets/surahArtwork.ts`) share it, so one field moves both. `branding.d.ts` now documents the real default (it said `og-images/surah/`).

## Fork override instructions

1. **Scheme.** Set `scheme` in `app.config.js`. Run prebuild (or mirror the plugin output in hand-maintained native trees: `BayaanURLScheme` in `ios/<App>/Info.plist`, `BAYAAN_URL_SCHEME = <scheme>;` in both `BayaanWidgetsExtension` build configurations, and `bayaan_widgets_url_scheme` in `android/app/src/main/res/values/bayaan_widgets.xml`). The Share Extension needs nothing extra after prebuild: `expo-share-intent` regenerates `ios/ShareExtension/ShareViewController.swift` from `scheme` (its `shareProtocol` and `<scheme>ShareKey`). A hand-maintained tree must edit those two constants.
2. **Name.** Set `name` in `app.config.js`. Widgets, CarPlay and Android Auto pick it up from the display name and app label; the plugin regenerates `bayaan_widget_now_label`. For the four App Intent strings, add `Localizable.xcstrings` entries keyed by the English text.
3. **Mark.** iOS: add `targets/widgets/Assets.xcassets/BrandMark.imageset` (single-color PDF or SVG). Android: add `android/app/src/main/res/drawable/bayaan_mark.xml`.
4. **Widgets.** In `config/nativeWidgets.config.js` (plain CJS, keep it import-free), set `widgets: [...]` to the ids to ship; turning off `adhkar`, `sleepTimer` or `ambientAudioOverlay` in `config/featureFlags.ts` applies on top. Rebuild natively (prebuild runs the plugin).
5. **Artwork.** Set `surahArtworkCdnBase` in `config/branding.js` to an https base serving `{id}.png` and `{id}-light.png`.

## Alternatives considered

- **Plain `if` in `WidgetBundleBuilder` on a generated Swift constant.** Rejected: the choice is build-time anyway, and a runtime constant cannot change App Intents metadata, which is extracted at compile time. Compilation conditions can, e.g. a fork without ambient audio ships a Bedtime configuration intent with no ambient parameter. (A compiled-out widget's own intents, such as Tasbeeh's, still compile; they are `isDiscoverable = false`, so nothing surfaces them.)
- **A list in `branding.js` or `featureFlags.ts`.** Rejected: the plugin needs a file Node can load at prebuild without app code. `branding.js` may carry fork components and providers, and `featureFlags.ts` is booleans by convention (RFC-007). Feature flags still drive the defaults.
- **Writing the scheme into `targets/widgets/Info.plist` at prebuild.** Rejected: it would rewrite a tracked source file on every fork prebuild. A build setting keeps the source fixed.
- **Reading the scheme from the host app's `CFBundleURLTypes` in the extension.** Rejected: the order of URL types is not a contract (Expo adds `exp+<slug>`).
- **Android manifest placeholders.** Rejected: an Expo local module cannot see app `manifestPlaceholders` cleanly, while resource overrides by name are standard library behaviour and also serve the Kotlin code.

## Consequences

- **Positive:** one config change rebrands and trims every native surface; Qariah drops adhkar and ambient with flags it already sets.
- **Neutral:** Bayaan's output is byte-identical except the two `BAYAAN_URL_SCHEME = bayaan;` lines, the `BayaanURLScheme` Info.plist keys and the generated `bayaan_widgets.xml`, all of which are committed.
- **Negative / risks:** the widget list and the flags are build-time for native code; changing them needs a new native build. Hand-maintained native trees must mirror the plugin output (the plugin's tests compare its default output with the committed files).

## How we'll know it worked

- `plugins/__tests__/withBayaanWidgets.test.js` proves the default config leaves the committed `project.pbxproj` and `bayaan_widgets.xml` unchanged, and that a fork config writes the scheme, conditions and booleans.
- A fork build with `adhkar` and `ambientAudioOverlay` off compiles without the Adhkar and Tasbeeh widgets and lists neither in the Android picker.
- `git grep 'bayaan://' -- '*.swift' '*.kt'` returns nothing.

## Open questions

- Should `widgets` also gate the car (e.g. hide the car entirely)? Today the car follows only `userUploads`.
