# CarPlay and Android Auto Design

**Date:** 2026-10-08
**Status:** Implemented, synced with the build (see section 8)
**Branch:** `osmansaeday/carplay` (based on `origin/develop`, Expo SDK 56)
**Supersedes:** `docs/features/carplay-android-auto.md` (Feb 2026 plan, never built)

## 1. Goal

Ship CarPlay and Android Auto together, at a quality bar comparable to Spotify on the same platforms. Both platforms only allow system templates, so quality comes from four things:

1. Artwork on every tile (no blank squares).
2. Content ready the instant the car connects (no spinners, no empty tabs).
3. Personal, situational shelves on Home.
4. Playback and now-playing state that always match the phone.

### Decisions already made

| Decision | Choice |
|---|---|
| Audio engine | Keep `expo-audio`. Do not fork or replace it. |
| Platforms | CarPlay and Android Auto in the same release. |
| CarPlay entitlement | `com.apple.developer.carplay-audio` already approved for `com.bayaan.app`. |
| Browsing | Native, driven by a snapshot JS writes. |
| Playback | JS. Native sends play requests; `playerStore` and `ExpoAudioService` execute them. |

### Out of scope (v1)

- App Intents (`.audio.playAudio` schema). Siri "play" is covered by SiriKit `INPlayMediaIntent` (see Voice).
- Adhkar audio (separate player, `AdhkarAudioProvider`).
- Synced verse text on the car screen.
- Android Car App Library templated media (`MediaPlaybackTemplate`); still beta, not allowed on production tracks as of 2026-10-02.
- Android Automotive OS (built-in car OS) as a dedicated target.

## 2. Information architecture

Four browse tabs on both platforms (Android Auto caps root children at 4), plus search:

```
[ Home ]  [ Library ]  [ Reciters ]  [ Surahs ]  [ (search) ]
```

On CarPlay, search is a fifth, icon-only tab (`tabSystemItem = .search`, no title) whose first row is the Siri media cell (`CPAssistantCellConfiguration`, `.playMedia`), then recent plays. It exists only when the build has Siri. If a head unit allows only four tabs, Reciters gives way. Android Auto draws its own search icon and keyboard/voice search screen.

### Home

- **For right now**: big cards (CarPlay: `CPListImageRowItemCardElement`, iOS 26+; fallback image row): Resume (last played item at its saved position), then the situational picks (rules below), then Loved on shuffle (hidden if no loved tracks). Card title is what plays; the subtitle says why now for surahs ("Resume", "Bedtime", "Friday", "Up next") or the size for time-of-day playlists ("5 surahs"). Subtitles stay under about ten characters, the width a card shows.
- **Surprise me**: one untitled row right after For right now that plays Random Recitation, the same picks as the phone Home card (`pickRandomRecitations`: 15 surahs, each from a random reciter). Its artwork is the phone card's ribbon art.
- **Jump back in**: recently played, with progress (iOS `CPListItem.playbackProgress`; Android `COMPLETION_PERCENTAGE` extra). Includes recently played uploads whose recitation still exists; tapping one resumes that upload on its own at its saved position, like the phone's recent card. Resume plays the first Jump back in row. Items also carry `duration` (seconds); on iOS 26.4+ each row also gets a `CPPlaybackConfiguration` (elapsed time and duration), because `playbackProgress` alone drew no bar on an iOS 26 device.
- **On repeat**: surahs listened to on at least 2 of the last 30 days (at least a minute a day), from `LocalAggregationStore`, up to 8, as cards, each with the reciter the user last played it with (else the top reciter). `playCountStore` is never written by the app, so it is not used.
- **More from <top reciter>**: up to 8 well-known surahs (`POPULAR_SURAH_IDS`) the top reciter recites and the user has not played among their last 10, as cards. A new install sees it for the default reciter.
- **Your reciters**: favorite reciters, circular portraits (`CPListImageRowItemImageGridElement` circular, iOS 26+). The Library group is titled "Favorite reciters".
- **Your playlists**: user playlists, then system playlists.

Empty sections are omitted. A brand-new user sees For right now (situational picks only), Surprise me, More from <default reciter>, and system playlists. There is no khatmah section: the app has no user-facing khatmah to continue (only unused analytics plumbing).

### Situational rules

Computed in TypeScript (one implementation, both platforms) by a pure function `buildSituationalPicks(now, context)`:

| Rule | Condition | Item |
|---|---|---|
| Friday Kahf | Thursday 18:00 through Friday 19:00 local time (approximates the sunnah window, Maghrib Thursday to Maghrib Friday) | Surah 18 by top reciter |
| Morning | 04:00 to 10:59 | System playlist `morning-reflections` |
| Afternoon | 11:00 to 16:59 | System playlist `quick-listen` |
| Evening | 17:00 to 20:59 | System playlist `evening-serenity` |
| Night | 21:00 to 03:59 | Surah 67 (Al-Mulk) by top reciter, then system playlist `evening-serenity` (no "before sleep" playlist exists) |
| Up next | Most recent recently-played item completed (progress >= 95%) and surah < 114 | Next surah, same reciter and rewayah |

- **Top reciter** = the most recently played reciter in `recentlyPlayedStore` (non-upload), else `useReciterStore.getState().defaultReciter`. `playCountStore` counts per surah, not per reciter, so it is not used.
- Rules are ordered as listed; at most 4 picks; duplicates removed.
- Card text stays short: the title is the surah or playlist name ("Al-Kahf", "Morning Reflections") and the subtitle is the reason ("Friday", "Morning", "Afternoon", "Evening", "Before sleep", "Up next"). The reciter shows on Now Playing.
- Time windows use the device's local clock. No prayer-time data exists in the app; these are fixed windows.

### Library

Loved, Playlists, Downloads (offline-only items; playable without network), Uploads, Favorite reciters. Every entry is always shown; an empty list shows "Nothing here yet".

- **Uploads** (list id `uploads`): the user's uploaded recitations in the phone's Uploads order (newest first). Title is the tagged surah's name, else the upload's title, else its file name without the extension. Subtitle matches the phone: the catalogue or custom reciter name, "Untagged" for an untagged upload, else the file name. When two rows would show the same title and subtitle, each gets its upload date appended ("Hazem Hassan · Mar 18, 2025"). Artwork is the surah card for a surah upload, else the Uploads icon tile. Tapping a row queues every upload from that row (`{ kind: 'uploads', startIndex }`) and records it in recently played, as the phone's Uploads screen does.

### Reciters

- A to Z, favorites first, circular portraits.
- Reciter with one rewayah: opens its surah list. More than one: opens a rewayah picker first.
- iOS 26.4+: reciter surah list uses the details header (`CPListTemplateDetailsHeader`, large reciter card above the list). Older iOS: plain list with the reciter as the first row.
- Surah lists respect `surah_list` for the rewayah (only available surahs shown).

### Surahs

- All 114 surahs (surah artwork tiles), grouped by the juz each starts in. A juz that starts no surah is folded into the previous group's title ("Juz 1–2", then "Juz 3"); the snapshot carries the title.
- Tapping a surah opens a short list with "Play with <top reciter>" and "Choose reciter" (not direct play). "Choose reciter" lists favorites first, then all reciters that have that surah.

### Now Playing

- CarPlay `CPNowPlayingTemplate.shared`:
  - Buttons: playback rate, repeat, love (`CPNowPlayingImageButton`).
  - `isUpNextButtonEnabled = true`: like Apple Music, a "Now playing" section (the current item, trailing playing indicator) then "Next"; the visible list updates live on skips and queue changes.
  - With ayah timestamps for the reciter, the subtitle reads "<reciter> · Ayah 12 of 110" while a car is connected (iOS through the lock screen metadata; Android Auto through the car bridge's now playing). Timestamps load per rewayah and surah when the track changes.
  - `isAlbumArtistButtonEnabled = true` (opens the reciter).
  - Transport from `MPRemoteCommandCenter`: `nextTrackCommand` and `previousTrackCommand` registered by `bayaan-car` (expo-audio registers play, pause, scrub, and 10s skip only).
- Android Auto: system player driven by our `MediaLibrarySession`; custom actions for speed and repeat; love as a custom action.

### Voice

**Android:** `onSearch` / `onGetSearchResult` and play-from-search on the library session, required by Android Auto quality guideline VC-1. Parses "surah name" and optional "by reciter name" against the snapshot (surah names in English transliteration and Arabic, reciter names).

**iOS (Siri):** SiriKit `INPlayMediaIntent`, handled in the app (no Intents extension). The plugin adds `INIntentsSupported` (`INPlayMediaIntent`), `INSupportedMediaCategories` (`INMediaCategoryGeneral`), the `com.apple.developer.siri` entitlement (plugin option `siri`, default `true`) and two AppDelegate methods that forward to `BayaanCarSiri`. `CarVoiceSearch` (pure Swift over the snapshot) resolves `mediaSearch`:
- Surah by English or Arabic name, translation ("the cave"), number ("surah 18") or a common spelling ("Yaseen", "Baqara", "Ikhlaas"), with an optional reciter ("by Mishary", or Siri's `artistName`). Without a reciter it uses the top reciter, then favorites, then any reciter that has the surah.
- Lists by title: playlists, Loved (also "favorites", "liked"), Downloads, Uploads ("my recitations"). "Shuffle" shuffles Loved.
- A reciter alone plays their latest Jump back in entry, else their first surah. Nothing named ("play Bayaan") resumes.
- Resolution answers with the best match; `handle` returns `.handleInApp`, and the app delegate sends the same play request a CarPlay tap sends, so a cold Siri launch plays once JS is ready. Reciter names and list titles are donated with `INVocabulary`, and `INMediaUserContext` reports the library size.

## 3. Artwork

- **Surahs:** R2 cards at `https://cdn.thebayaan.com/assets/car/surah/{id}.png` (dark) and `{id}-light.png` (light), 512px car variants with large names generated by `scripts/generate-surah-og-images.ts --car`. Variant follows the car's interface style (CarPlay `traitCollection.userInterfaceStyle`; Android Auto: dark). The base comes from the snapshot's `surahArtworkBase` (set by `branding.surahArtworkCdnBase`, https only); natives fall back to the Bayaan CDN when it is absent.
- **Reciters:** API `image_url` (https) first, then the bundled image from `utils/reciterImages.ts` (exported by JS into the snapshot as a local file URI), then a generated monogram tile (initials on a per-reciter color). Never transparent.
- **Library, Shuffle Loved and playlists:** `{ kind: 'icon', name, hex? }` tiles that match the app's Collection screen (Playlists, Reciters, Downloads, Uploads, Loved icons on a 15% tint of their colour, rounded square). `scripts/generate-car-icon-tiles.ts` renders them from the exact SVG paths in `components/Icons.tsx` into the iOS resource bundle `BayaanCarIcons` (`modules/bayaan-car/ios/icons`, light and dark variants) and Android `res/drawable-nodpi` (dark). A playlist (`name: 'playlist'`) is drawn on device: the white playlist glyph over the playlist's own colour. Icon names are allowlisted on both platforms.
- **Android artwork provider:** a hardened `ContentProvider` serves artwork to Android Auto. It validates keys strictly, fetches only https URLs present in the snapshot, applies timeouts, size caps and decode bounds, caps the disk cache, and renders monogram/color/icon tiles on demand (icon tiles come only from the allowlisted bundled drawables).
- **Native image cache:** source PNGs are about 700 KB each. Native downloads once, downscales to 256 px, stores in the app caches directory (iOS `Caches/bayaan-car/artwork/`, Android `cacheDir/bayaan-car/artwork/`), so artwork works offline after first fetch unless the OS purges caches. Approx 7 MB for all surah variants. Cache is populated lazily and also prefetched for Home items when the snapshot changes.

## 4. Architecture

```
JS (existing app)                        modules/bayaan-car (local Expo module)
-----------------                        --------------------------------------
recentlyPlayedStore, lovedStore,    -->  snapshot file (JSON, versioned, app private storage)
playlistsStore, downloadStore,           iOS: Application Support (app private storage, not the App Group)
playCountStore, favoriteReciters,        Android: filesDir
reciters (dataService)
   |  CarSnapshotService (debounced)     iOS: CarPlaySceneDelegate (Swift)
   v                                       templates built from snapshot
playerStore  <-- onPlayRequest ---------   iOS 26/27 features behind #available
   |          <-- onTransport (next/prev, Android: BayaanLibraryService (Kotlin)
   |              rate, repeat, love)       Media3 MediaLibraryService
   v                                        browse tree + search from snapshot
ExpoAudioService (expo-audio)
   |  CarNowPlayingBridge
   +-- now playing, queue, state ------> car Now Playing / Up Next / progress
```

### 4.1 Units

**`services/car/snapshot/buildCarSnapshot.ts`** (pure)
- Input: store states, reciters, surahs, system playlists, `now`.
- Output: `CarSnapshot` (typed, see 4.2).
- Includes `buildSituationalPicks`.
- No I/O. Fully unit tested.

**`services/car/CarSnapshotService.ts`**
- Subscribes to the relevant stores; on change, rebuilds and calls `BayaanCar.writeSnapshot(json)`.
- Debounced 2 s; also runs once on app start and when the app returns to foreground.
- Recently played changes count only when an entry's identity, order or progress tenth changes, so Jump back in bars follow playback without a rebuild per tick. A car request that resumes mid-surah keeps the entry's progress instead of resetting it to 0.
- Uploads changes count only when the uploads' ids, order or shown tags (title, surah, reciter, custom reciter names) change. AppInitializer loads uploads before the car starts; if that failed before loading, the service loads them itself.
- Situational picks depend on time, so it also rebuilds on a 15-minute timer while the car is connected (`BayaanCar.onCarConnectionChanged`).

**`services/car/CarPlaybackBridge.ts`**
- Listens to `onPlayRequest` and `onTransport` events from native.
- Converts a `CarPlayRequest` into a queue via existing `createTrack` / `createUserUploadTrack` / `updateQueue` / `playerStore` actions (the same path the phone UI uses), then starts playback.
- Pushes now-playing, including the queue summary, to native via `BayaanCar.setNowPlaying(...)` on `playerStore` changes.

**`modules/bayaan-car/`** (Expo module, iOS + Android)
- JS API: `writeSnapshot(json)`, `setNowPlaying(info)` (carries the queue), `markJsReady()`, events `onPlayRequest`, `onTransport`, `onCarConnectionChanged`.
- Holds play requests that arrive before `markJsReady()` and delivers them in order after. `markJsReady()` reports the connection state first, so JS applies car mode before a queued request loads a track.
- iOS: `CarPlaySceneDelegate`, `CarTemplateBuilder`, `CarArtworkCache`, remote command registration (next/previous) active only while a Bayaan track is loaded.
- Android: `BayaanLibraryService` (`MediaLibraryService`), `CarBrowseTree`, `CarArtworkCache`, forwarding player (see 4.4).

**`plugins/withBayaanCar.js`** (config plugin; must survive `prebuild --clean`)
- iOS:
  - Add `UIApplicationSceneManifest` with two scene configs: phone (`UIWindowSceneSessionRoleApplication`, `PhoneSceneDelegate`) and CarPlay (`CPTemplateApplicationSceneSessionRoleApplication`, `CarPlaySceneDelegate`).
  - Move window creation from `AppDelegate` into `BayaanCarSceneBridge`, adopted by `PhoneSceneDelegate`.
  - `UIApplicationSupportsMultipleScenes` = true. A second phone scene (iPad) is refused: the new session is destroyed and the primary window is untouched.
  - Add `com.apple.developer.carplay-audio` to entitlements. Option `carPlayAudioEntitlement` (default true) lets forks without the entitlement skip it.
- Android:
  - `res/xml/automotive_app_desc.xml` with `<uses name="media"/>`.
  - `com.google.android.gms.car.application` meta-data.
  - Service declaration for `BayaanLibraryService` with only the legacy `android.media.browse.MediaBrowserService` intent filter (the Media3 `MediaLibraryService` action is not exposed, which avoids a foreground-service crash on media button events), `foregroundServiceType="mediaPlayback"`. `onStartCommand` has a MEDIA_BUTTON safety net.
  - Android Auto pagination is honoured, with a 500 item cap per page.

### 4.2 Snapshot schema (v1)

```ts
interface CarSnapshot {
  version: 1;
  generatedAt: string; // ISO
  topReciterId: string | null;
  home: {
    sections: CarSection[];  // For right now, Surprise me, Jump back in, On repeat, More from, Your reciters, Your playlists
  };
  library: CarItem[];         // Loved, Playlists, Downloads, Uploads, Favorite reciters (browse entries, subtitled with counts)
  lists: Record<string, CarList>; // browse targets by id (loved, downloads, uploads, playlists, ...)
  reciters: CarReciter[];     // favorites first, then A to Z
  surahs: CarSurah[];         // 114
  juz: { number: number; surahIds: number[] }[];
  downloadedKeys: string[];   // reciter:rewayah:surah keys of completed downloads
  surahArtworkBase?: string;  // https, ends in '/'; natives default to the Bayaan CDN
}

interface CarItem {
  id: string;              // stable, used as media id
  title: string;
  subtitle?: string;
  artwork: CarArtwork;     // { kind: 'surah', surahId } | { kind: 'url', url } | { kind: 'file', uri } | { kind: 'color', hex, label } | { kind: 'icon', name, hex? }
  progress?: number;       // 0..1
  duration?: number;       // seconds, Jump back in only
  isDownloaded?: boolean;
  action: { kind: 'play'; request: CarPlayRequest } | { kind: 'browse'; target: CarBrowseTarget };
}

type CarPlayRequest =
  | { kind: 'surah'; reciterId: string; rewayatId: string; surahId: number; startAt?: number }
  | { kind: 'playlist'; playlistId: string; system: boolean; startIndex?: number }
  | { kind: 'loved'; shuffle?: boolean; startIndex?: number }
  | { kind: 'downloads'; startIndex?: number }
  | { kind: 'uploads'; startIndex?: number }
  | { kind: 'resume'; recitationId?: string } // recitationId: a Jump back in upload row
  | { kind: 'random' };                          // Random Recitation (Surprise me)
```

- Reciter surah lists are not pre-expanded per reciter (that would be thousands of items). Native builds them on demand from `reciters[].rewayat[].surahList` plus `surahs`.
- `version` lets native reject a snapshot it does not understand and keep the previous one.
- If no snapshot exists yet (first install, never opened), native shows a single "Open Bayaan on your phone to get started" row; Android Auto returns an empty root with the same message as an error state.

### 4.3 Cold start

- **iOS:** CarPlay connecting launches the app process. The AppDelegate no longer creates the window; `BayaanCarSceneBridge` starts React Native into a host window on whichever scene connects first (phone or CarPlay), so JS runs either way. Templates render from the snapshot immediately; play requests queue until `markJsReady()`.
  - The host window has no scene until a phone scene adopts it, and UIKit never lays such a window out, so the bridge lays it out on a timer; otherwise the safe area provider never reports insets and the React tree never mounts.
  - While CarPlay is foreground the app stays active even with the phone locked, but React Native's timers run from the phone screen's display link. A `RCTTiming` guard keeps timers in background (NSTimer) mode whenever no phone scene is foreground active.
  - `CPTemplateApplicationScene` gets an empty `windows` so `RCTAppearance.setColorScheme` (called at launch for a chosen theme) does not abort.
- **Android:** Android Auto binds `BayaanLibraryService` with no Activity. The service serves the browse tree from the snapshot immediately, and on a car connection `CarReactRoot`:
  - starts a headless React surface for `BayaanCarRoot` (`services/car/CarRoot.tsx`, registered in `entry.ts`), which runs `bootApp()` (the app's boot, shared with the phone layout and memoized per JS runtime) and mounts `ExpoAudioProvider` with no UI;
  - runs the `BayaanCarKeepAlive` headless JS task while a car is connected, because React Native pauses JS timers whenever no Activity is resumed (the player's load wait and the car bridge use timers).
  - The player is one module-level expo-audio player per JS runtime (never released). When the phone layout mounts its provider, the car root unmounts its own and the phone's takes over the same player; when the phone layout closes, the car root takes it back. Lock-screen sync is shared across the handover.
  - Play requests queue meanwhile; the gate waits up to 20 s for a headless cold boot (3 s with no runtime, 10 s for a booting phone app), then shows "Open Bayaan on your phone to get started" as a player error (plus a `SessionError`).

### 4.4 Android media session coexistence (risk)

expo-audio runs its own `MediaSessionService` (`AudioControlsService`) with a session that removes next/previous commands. Android Auto connects to the service declared for media browsing, which will be ours.

Plan:
- `BayaanLibraryService` hosts a `MediaLibrarySession` around a forwarding player (`SimpleBasePlayer`) that mirrors state pushed from JS (`setNowPlaying`, whose payload includes the queue) and forwards commands (play, pause, seek, next, previous, set rate) to JS as `onTransport` events.
- Only one notification: either expo-audio's or ours. Spike decides which (expo-audio's lock screen config is controlled from JS via `setActiveForLockScreen`).
- Background playback must keep working with the phone screen off and with Android Auto disconnected mid-playback.

**Fallback if the spike fails:** a minimal Android-only `patch-package` patch to expo-audio that exposes its `ExoPlayer` to our library session. Requires sign-off from the project owner before use.

### 4.5 iOS scene migration (risk)

Moving the phone app from an app-delegate window to scene-based lifecycle affects startup for every user. Must verify after the change:
- Splash screen, `expo-router` deep links (`bayaan://`, universal links), share extension handoff (`expo-share-intent`), notifications tap handling, `expo-screen-orientation`, `expo-updates`.

## 5. Implementation order

1. **Spike A (iOS scenes):** add scene manifest and `PhoneSceneDelegate` via the plugin; verify the checklist in 4.5. Throwaway CarPlay scene with one static list in the CarPlay Simulator.
2. **Spike B (Android session):** `BayaanLibraryService` with a hardcoded tree in the Desktop Head Unit; play through expo-audio from JS; verify single notification and background playback; verify cold start with app killed.
3. Snapshot types, `buildCarSnapshot`, situational rules, with unit tests.
4. `CarSnapshotService` and native snapshot reading on both platforms.
5. CarPlay templates (iOS 16.4 baseline, iOS 26 and iOS 27 enhancements behind `#available`).
6. Android browse tree, content styles, extras, search.
7. `CarPlaybackBridge`, now playing and queue sync, next/previous, rate, repeat, love.
8. Artwork cache on both platforms.
9. Polish pass on device and head unit.

If either spike fails, stop and revisit the design with the project owner before step 3.

## 6. Testing

- **Unit (Jest):** `buildCarSnapshot`, `buildSituationalPicks` (each rule, boundaries such as Thursday 17:59 vs 18:00 and Friday 19:00, empty stores), `CarPlayRequest` to queue conversion, search parsing.
- **iOS:** CarPlay Simulator (Device Hub, Xcode 27) on iOS 26 and iOS 27 runtimes; plus an older runtime (iOS 17 or 18) to check fallbacks.
- **Android:** Desktop Head Unit (DHU) against an emulator and a physical phone.
- **Manual scenarios:** cold start from car with app killed; connect mid-playback; disconnect mid-playback; airplane mode with downloads; switching light/dark in the car; empty-state new install; phone UI and car stay in sync when controlling from either.
- **Before release:** at least one real CarPlay and one real Android Auto head unit.
- `npx tsc --noEmit`, `npx prettier --write`, existing Jest suite pass.

## 7. Open items to resolve during implementation

- Juz grouping: a juz spans partial surahs; v1 lists the surahs that start in each juz (`data/juzData.ts`).
- Done: `docs/features/carplay-android-auto.md` points to this spec.

## 8. Deviations from the original draft

1. Top reciter comes from `recentlyPlayedStore`, not `playCountStore`.
2. The Night rule uses `evening-serenity`.
3. The snapshot lives in app private storage, not the App Group.
4. iOS React start goes through `BayaanCarSceneBridge`.
5. Item actions are wrapped (`play` or `browse`).
6. Surah tap opens "Play with <top reciter>" plus "Choose reciter".
7. The details header and `CPPlaybackConfiguration` are iOS 26.4 in the SDK, not 27. Jump back in sets `playbackProgress` and, on 26.4+, a `CPPlaybackConfiguration` from the item's `duration`.
8. iOS uses multiple scenes; a second phone scene on iPad is refused.
9. Android: legacy browser service action only, hardened artwork provider, pagination with a 500 cap.
10. Android Auto cold start runs a headless React surface (`BayaanCarRoot`), not just `ReactHost.start()` (which loads the bundle but mounts no tree), plus a keep-alive headless task so JS timers run with no resumed Activity. Verified on an emulator with no Activity: a car play request booted JS and played; the phone-layout handover is unit tested (`services/car/__tests__/CarRoot.test.tsx`) and needs a release-build device check.
11. No Quick start header: Home leads with the For right now cards (Resume, picks, Loved on shuffle), and Random Recitation is its own Surprise me row.
12. On repeat reads `LocalAggregationStore` daily listening, not `playCountStore`.
13. CarPlay search is an icon-only fifth tab with the Siri cell. A `CPBarButton` on a tab root does not render and a search tab stays inside the tab group; Apple Music's detached search circle is not public API.
14. The full list of implementation deviations (20 items) is in the PR description.
