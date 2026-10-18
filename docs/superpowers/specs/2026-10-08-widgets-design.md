# Widgets: Design Spec

**Date:** 2026-10-08
**Status:** Approved design, pending spec review
**Supersedes:** `docs/features/widgets.md` (catalog), `feature/widgets2.0` (expo-widgets attempt)
**Platforms:** iOS and Android, parity by default

## 1. Why this exists

Two earlier widget attempts never shipped because they did not look or feel right:

- Decoration (colored blobs, circles, accent chips) did the visual work instead of content.
- Several widgets showed data with nothing to do (e.g. Listening Stats).
- Only home screen widgets were considered, ignoring Lock Screen, Live Activities, Control Center and Siri.

Starting point is Apple Podcasts: artwork is the hero on a dark surface, and every widget either does something in one tap or is worth a two second glance. Bayaan extends that with its own content: reciter photos, Digital Khatt calligraphy and the mushaf.

### Design principles

1. Content is the design. No decorative shapes, chips or gratuitous gradients.
2. Every widget is either a one tap action or a glance worth having.
3. Listening widgets sit on a fixed near-black (#1C1C1E), like Podcasts and Spotify, so the reciter photo is the only color. Reading and ayah widgets use a quiet paper/ink palette that follows light/dark mode.
4. Quran text is always Digital Khatt. Surah names use the existing surah glyph font (`utils/surahGlyphMap.ts`).
5. One source of truth for data (a TS schema); native code on each platform only renders it.
6. iOS 26 tinted/clear modes are supported; artwork is marked full color.

## 2. Phasing

This spec fully specifies **Phase 1**. Later phases are outlined so Phase 1 infrastructure does not paint us into a corner; each gets its own spec.

| Phase | Scope |
|---|---|
| 1. Core | Continue Listening (S/M/L), Quick Surah, Pinned Reciter, Ayah of the Day, Continue Reading, Tasbeeh, iOS Lock Screen accessories. All shared plumbing. iOS + Android. |
| 2. iOS system surfaces | Live Activity + Dynamic Island with per-ayah synced text, Control Center / Action Button controls (iOS 18 ControlWidget), Siri / Shortcuts (AppShortcutsProvider), StandBy. |
| 3. Content and context | Recently Played shelf, Playlist / Downloads shelf, Bedtime (surah + sleep timer + ambient), Morning/Evening Adhkar, Occasion ayat, Hijri date, Reciter spotlight, "Bayaan Now" contextual smart widget. |
| 4. Needs new app features | Khatma progress, Daily wird, Hifz card (each needs tracking/goal features first), Streak heatmap, watchOS. |

## 3. Technology choice

**iOS:** SwiftUI widget extension managed by `@bacons/apple-targets` (v5). Chosen because it is the only option covering every phase: `AudioPlaybackIntent` buttons that run in the app process, `AppIntentConfiguration` with `AppEntity` pickers, ControlWidget, AppShortcutsProvider, ActivityKit, and custom fonts via `UIAppFonts`.

**Android:** Jetpack Glance (Kotlin) inside a local Expo module. Manifest entries merge from the module, so no config plugin is needed.

**Rejected:**

- `expo-widgets`: button actions run in the extension (cannot drive audio), no ControlWidget or Siri, primitive-only configuration, Android only in SDK 58 (prerelease). Same ceiling the previous attempt hit.
- Voltra: strong Live Activities, but buttons only emit JS events, no ControlWidget or Siri, and it would still need native code for the rest.
- `react-native-android-widget`: every interaction boots a headless JS bundle.

**Repo:** everything lives in this repo and survives `npm run prebuild` (`expo prebuild --clean`). Nothing is hand edited under `ios/` or `android/`.

**Prerequisites:** branch is on `origin/develop` (Expo SDK 56, app deployment target 16.4). The widget extension targets iOS 17.0; ControlWidget code is gated with `#available(iOS 18, *)`.

## 4. Architecture

### 4.1 Layout

```
modules/bayaan-widgets/            local Expo module (autolinked)
  src/snapshot.ts                  WidgetSnapshot types: the single source of truth
  src/index.ts                     writeSnapshot, writeCatalog, reloadWidgets,
                                   addCommandListener, drainCommands, consumeTasbeehIncrements
  src/__fixtures__/                JSON fixtures shared with Swift and Kotlin tests
  ios/                             Swift: App Group writer, WidgetCenter reload,
                                   command queue observer, artwork cache
  android/                         Kotlin: SharedPreferences writer, Glance widgets,
                                   receivers, configuration activities, Media3 controller
targets/widgets/                   apple-targets widget extension
  expo-target.config.js            reads App Group / bundle ids from app config
  *.swift                          timeline providers, SwiftUI views, configuration intents
  fonts/                           Digital Khatt OTF, surah glyph font
  ayat.json                        curated Ayah of the Day list (generated, see 5.4)
targets/_shared/                   Swift compiled into BOTH app and extension:
                                   Codable snapshot models, AppIntents, command queue
services/widgets/                  JS glue
  buildSnapshot.ts                 store state -> WidgetSnapshot (pure)
  syncWidgets.ts                   store subscriptions, debounce, write, selective reload
  handleWidgetCommand.ts           WidgetCommand -> player / adhkar actions
  artworkCache.ts                  downloads reciter artwork into shared storage
```

### 4.2 App to widget (state)

1. `syncWidgets` subscribes to `usePlayerStore`, `useRecentlyPlayedStore`, `useReciterStore`, `mushafSessionStore`, `useAdhkarStore` and the theme store.
2. On change, `buildSnapshot` produces a `WidgetSnapshot`. Writes are debounced (~1 s) and flushed immediately when the app moves to background.
3. The module writes JSON to the App Group container (`group.com.bayaan.app`, already provisioned for the share extension) on iOS and to SharedPreferences on Android.
4. Only widget kinds whose slice of the snapshot changed are reloaded (`WidgetCenter.reloadTimelines(ofKind:)` / `GlanceAppWidget.update`).
5. Artwork: `artworkCache` downloads each referenced reciter image once into shared storage (resized to widget scale). The snapshot references local file names only; widgets never touch the network.

MMKV is **not** shared with the extension: moving MMKV into the App Group would migrate all existing user storage and require multi-process mode in the extension.

### 4.3 Snapshot schema (sketch)

```ts
interface WidgetSnapshot {
  version: 1;
  generatedAt: number;            // epoch ms
  theme: 'light' | 'dark' | 'system';
  nowPlaying: {
    track: WidgetTrack;
    isPlaying: boolean;
    positionSec: number;          // at generatedAt
    durationSec: number;
  } | null;
  upNext: WidgetTrack[];          // max 3, from queue
  recent: WidgetTrack[];          // max 6, from recently played
  defaultReciter: WidgetReciter;
  reciterRecents: Record<string, WidgetTrack[]>; // reciterId -> last 3
  lastRead: { page: number; surahId: number; juz: number; openingText: string } | null;
  tasbeeh: Record<string, { count: number; target: number; day: string }>; // dhikrId
}

interface WidgetTrack {
  surahId: number;
  reciterId: string;
  reciterName: string;
  rewayatId?: string;
  artworkFile?: string;           // file name in shared storage
  isUserUpload: boolean;
}
```

A separate `catalog.json` holds the configuration pick lists: reciters (id, name, artworkFile; user uploads excluded) and adhkar usable for Tasbeeh (id, arabic, translation, repeatCount). It is written when the reciter list or adhkar data changes, not on every snapshot.

The exact field list is settled in the implementation plan; the shape above is binding in spirit (one versioned document, local files only, no derived per-platform fields).

### 4.4 Widget to app (commands)

```ts
type WidgetCommand =
  | { type: 'setPlayback'; playing: boolean }       // absolute target, from the rendered state
  | { type: 'playTrack'; surahId: number; reciterId?: string; rewayatId?: string; ayah?: number }
  | { type: 'playReciter'; reciterId: string };   // resume last surah with reciter
```

- **iOS:** buttons use `AudioPlaybackIntent`s defined in `targets/_shared/`, so `perform()` runs in the app process. The intent appends the command to a persisted queue in the App Group and posts a notification. If JS is alive, the module observes it and emits `onWidgetCommand`. If not, the app launches and `drainCommands()` runs once the player is mounted.
- **Android:** every tap starts a translucent `WidgetCommandActivity` (`PendingIntent.getActivity`), because a broadcast receiver cannot open the app on Android 14+. For `setPlayback`, it writes the optimistic override, then enqueues in place when JS is alive, else drives a Media3 `MediaController` bound to expo-audio's `AudioControlsService` when a session is loaded, else enqueues and opens the app. Other commands enqueue and open the app.
- Queued commands older than 60 s are dropped on drain.
- Widgets render play/pause optimistically after a tap.
- The player is currently created inside the `ExpoAudioProvider` component (`useAudioPlayer(null)`), so cold starts must wait for mount. `drainCommands` is called from `ExpoAudioProvider` after the player is ready. Moving player creation to module scope is out of scope here (tracked with RFC-005) but would shorten cold-start latency.

`handleWidgetCommand` reuses existing building blocks: `createTrack(reciter, surah, rewayatId)` from `utils/track.ts`, then `updateQueue([...], 0, startSec)` and `play()`. A missing `reciterId` means the default reciter; `ayah` is resolved to `startSec` via the ayah timestamp data, mirroring `app/reciter/[slug]/[surah].tsx`.

### 4.5 Tasbeeh writes

Tasbeeh counts live in SQLite (`adhkar.db`, `dhikr_counts`), which widgets cannot write. Widget taps increment a per-dhikr pending counter in shared storage (iOS: in-extension `AppIntent`, no app launch; Android: Glance `ActionCallback`, no JS). The widget displays `snapshot count + pending`. On foreground (and on snapshot write), the app calls `consumeTasbeehIncrements()`, applies them through `useAdhkarStore.incrementCount`, and the next snapshot zeroes pending. Pending counts carry their `day`; increments from a previous day are discarded, matching the app's daily reset.

### 4.6 Deep links

Taps that open a screen use the `bayaan://` scheme. Phase 1 makes these real:

| Link | Target |
|---|---|
| `bayaan://player` | open full player |
| `bayaan://mushaf/{page}` | `app/mushaf/[page].tsx`, currently a stub redirecting home; becomes a redirect into `app/mushaf.tsx` with `page` |
| `bayaan://quran/{surah}?ayah={n}` | `app/quran/[surah].tsx`, same treatment with `surah` / `ayah` |
| `bayaan://reciter/{slug}/{surah}?t={sec}` | existing working route |
| `bayaan://adhkar/...` | existing adhkar route for Tasbeeh widget |

The `/mushaf` and `/quran` stubs must keep working for Android App Link autoverification.

### 4.7 Branding seams (Qariah fork)

App Group id, bundle identifiers, URL scheme and widget display names come from `app.config.js` / brand config, read by `expo-target.config.js` and the module. Nothing brand specific is hardcoded in Swift or Kotlin.

## 5. Phase 1 widgets

All widgets support light and dark, except Continue Listening, which is always dark like the Podcasts and Spotify widgets. iOS families listed; Android equivalents are resizable Glance widgets with the same layouts at the nearest size buckets.

### 5.1 Continue Listening (small, medium, large)

```
 Small                 Medium
┌──────────────┐      ┌─────────────────────────────────┐
│ ┌────┐    ▶  │      │ ┌──────┐ Al-Kahf     │ ▪ Yasin    │
│ │art │       │      │ │ art  │ Alafasi     │ ▪ Al-Mulk  │
│ └────┘       │      │ └──────┘ ▶  ━━━━──   │ ▪ Ar-Rahman│
│ Al-Kahf      │      └─────────────────────────────────┘
│ ▶ ━━━━──     │
└──────────────┘
```

- Fixed near-black background on every size; the Bayaan mark sits in the top-right corner.
- Artwork is the surah card shared with CarPlay and Android Auto (`https://cdn.thebayaan.com/assets/car/surah/{id}.png`, dark variant), cached as `surah-{id}.jpg`. Until a card is cached, and for uploads, the reciter photo shows instead.
- Progress on every size: a thin Spotify-style bar on a faint track beside a round play/pause button. No time-left text (user decision, 2026-10-10).
- Small: the play button toggles in place; any other tap opens `bayaan://player`.
- Medium: right column shows `upNext`, falling back to `recent`. Tapping a row sends `playTrack`.
- Large: current item header, play button beside the progress bar, then up to 4 `upNext` rows (falling back to `recent`).
- iOS animates the bar with `ProgressView(timerInterval:)` while playing, without timeline reloads. Android's bar is a static value refreshed on state change, and the widget re-renders at the computed track end so the button flips back to play.
- Empty state: surah of the day (existing day-of-year logic in `ContinueReadingHero.tsx`, extracted to a util) with the default reciter.

### 5.2 Quick Surah (small, medium; configurable)

- Configuration: surah (required), reciter (optional, defaults to default reciter at play time).
- Small: surah name in surah glyph calligraphy, English name, small reciter avatar. Any tap sends `playTrack`.
- Medium: 2x2 grid of 4 configurable surahs, default Al-Kahf, Yasin, Al-Mulk, Al-Waqi'ah.
- iOS: `AppIntentConfiguration` with a `SurahEntity` (114 entries, static). Android: configuration activity.

### 5.3 Pinned Reciter (small, medium; configurable)

- Configuration: reciter, from `catalog.json` (`ReciterEntity` query on iOS, configuration activity on Android).
- Small: reciter photo full-bleed, name over a bottom scrim, play button sending `playReciter`.
- Medium: photo left; right shows `reciterRecents[reciterId]` (last 3), or popular surahs (Al-Fatiha, Yasin, Al-Mulk) if none. Rows send `playTrack`.
- Missing reciter (removed from catalog): "Reciter unavailable, tap to choose another".

### 5.4 Ayah of the Day (small, medium, large)

- Curated list of ~365 short ayat that fit widget sizes, stored as a source list of verse keys in the repo. A build script generates `ayat.json` with Digital Khatt text (from `digitalKhattDataService`) and Saheeh International translation (`getBundledTranslation`), bundled into the widget on both platforms.
- Selection is deterministic from the local date, so the widget changes at midnight without the app running. iOS timeline entry at next midnight; Android `AlarmManager` at midnight.
- Small: Arabic only. Medium: Arabic, translation, reference. Large: same with more room.
- **Listen** button sends `playTrack` with `ayah` and no `reciterId` (meaning default reciter). `handleWidgetCommand` resolves the start offset from the ayah timestamps for that reciter and plays from that ayah onward. Any other tap opens `bayaan://quran/{surah}?ayah={n}`.
- Translation is fixed to Saheeh International in Phase 1.
- If no timestamp is available for the default reciter, Listen starts at the surah beginning.

### 5.5 Continue Reading (small, medium)

- Small: large page number, surah name in calligraphy, juz below.
- Medium: same plus the page's opening words in Digital Khatt (truncated to fit) and "Continue reading".
- Tap opens `bayaan://mushaf/{page}`.
- Data: `mushafSessionStore.getLastReadPage()`; surah via `digitalKhattDataService.getPageToSurah()`; opening text via `mushafVerseMapService.getOrderedVerseKeysForPage` + `getVerseText`. A page to juz map is added (none exists today).
- Empty state: page 1, "Start reading".

### 5.6 Tasbeeh (small, medium; configurable)

- Configuration: dhikr from `catalog.json`, default SubhanAllah.
- Small: Arabic dhikr, large count, ring toward `repeatCount`. Whole widget is a button: +1 without opening the app (see 4.5).
- Medium: adds translation and a reset button.
- Dhikr text uses the same Arabic font as the in-app adhkar screen (not Quran text).

### 5.7 Lock Screen (iOS accessory families)

| Family | Content |
|---|---|
| Circular | Surah progress ring around surah glyph (Continue Listening) |
| Circular | Tasbeeh count + ring |
| Rectangular | Surah, reciter, time left |
| Rectangular | Last read page, surah |
| Inline | "Al-Kahf · 12m left" |

Lock Screen taps open the app (deep link); no in-place actions. Android has no Lock Screen widget equivalent.

## 6. Quran text rendering

- **iOS:** bundle `data/mushaf/digitalkhatt/DigitalKhattFont.otf` in the extension (`UIAppFonts`) and render with SwiftUI `Text` + `.font(.custom(...))`. Keeps text crisp at every family and tintable.
- **Spike first (gate):** compare CoreText shaping against Skia on ~30 ayat with dense marks. If CoreText output is wrong, fall back to PNGs prerendered in-app with the existing Skia capture path (`components/share/captureShareCard.ts`) into shared storage, per family and color scheme.
- **Android:** Glance has no custom fonts; render Arabic to a bitmap in Kotlin with `StaticLayout` + the OTF typeface (HarfBuzz shaping).

## 7. Edge cases

- **Empty states:** every widget has a meaningful default (5.1, 5.5, 5.6).
- **Cold start from a button:** queued, app launched, drained after player mount; 60 s expiry; optimistic UI.
- **Missing artwork:** bundled reciter image, then neutral tile with initials.
- **Schema mismatch:** native decoders that fail keep the last good snapshot, else the default state.
- **User uploads:** shown in Continue Listening, excluded from pickers.
- **Rewayah:** `rewayatId` carried through every command.
- **Android update budget:** no reliance on `updatePeriodMillis`; updates are pushed by the app; midnight alarm for Ayah of the Day.
- **Theme:** widgets follow the app's theme setting when explicit, else system. Continue Listening is the exception (always dark).

## 8. Testing

- **TS unit tests:** `buildSnapshot` (store states to snapshot), command queue (ordering, expiry, drain), tasbeeh increment merging (including day rollover), Ayah of the Day date selection, page to juz map.
- **Cross-platform fixtures:** JSON fixtures in `modules/bayaan-widgets/src/__fixtures__/` decoded by TS tests, a Swift test, and a Kotlin test.
- **Previews:** SwiftUI previews and Glance previews for every widget, size and state, light and dark. Used for design review before shipping.
- **Spike:** Digital Khatt shaping (section 6), done before widget UI work.
- **Manual device checklist:** cold-start play from a widget, tasbeeh while app is killed, midnight rollover, tinted/clear mode, Android resize, configuration flows, deep links.

## 9. Phase 2 to 4 outlines (not specified here)

- **Live Activity (Phase 2):** start from foreground on playback, update only on ayah change, progress via timer views. Highest risk: April 2026 forum reports of local updates from background audio apps stopping after ~30 s. Prototype on device before committing to per-ayah sync; fallback is surah-level plus progress. Starting an activity when playback began from a widget in background may need push-to-start.
- **ControlWidget / Siri (Phase 2):** reuse `targets/_shared/` intents and entities directly.
- **Bayaan Now (Phase 3):** composes Phase 1 to 3 views with time-of-day rules and Smart Stack relevance.
- **Phase 4:** blocked on new app features (khatma tracking, goals, hifz).

## 10. Out of scope

- Moving audio player creation to module scope (RFC-005).
- User-selectable translation in Ayah of the Day.
- Sharing MMKV with extensions.
- Any server-side component.
