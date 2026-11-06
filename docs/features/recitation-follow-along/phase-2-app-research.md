# Phase 2 research: app integration

Date: 2026-10-15. Paths are relative to the repo root.

## Problems to fix before shipping

1. Name clash: "Follow Along" already means reciter timestamp sync
   (`data/onboardingPages.ts`, `components/sheets/FollowAlongSheet.tsx`, sheet
   id `'follow-along'`, `RecitersView.tsx:646`, `ReciterItem.showFollowAlong`).
   User-facing name for this feature: "Follow my recitation". Keep
   "follow-along" in code only.
2. List view, reading view and QCF never show the recited ayah:
   `ReadingPageView.tsx:312-317` and `ContinuousListView.tsx:~440` gate
   `isActive` on the mushaf player playing and read `usePlaybackVerseKeys()`;
   `QCFPage.tsx:159,298` reads `usePlaybackVerseKeys()`. Starting recitation
   stops the player, so none show the band. `ContinuousMushafView` gets the
   band but not the word tint.
3. iOS deactivation race: expo-audio `pause` calls `deactivateSession()` which
   `setActive(false)`s ~100 ms later if nothing plays
   (`expo-audio/ios/AudioModule.swift:243-248, 826-840`). `pauseQuranAudio()`
   runs right before `startMicStream()`, so the mic can die ~100 ms in while
   status still says listening.
4. Nothing notices a silent mic: react-native-audio-api pauses its engine on
   interruption and leaves it paused without `shouldResume`
   (`AudioEngine.mm:335-406`) and rebuilds on route change
   (`SystemNotificationManager.mm:184-232`). We never call
   `observeAudioInterruptions` or listen for `interruption` / `routeChange`.
5. `app/recitation-spike.tsx` is reachable in production via deep link.
6. Assets come from GitHub releases (R2 deferred by decision); the 75 MB is
   not in the Storage screen (`hooks/useStorageBreakdown.ts:36-52`) and
   `deleteRecitationAssets` is never called.

## 1. Settings

`store/mushafSettingsStore.ts`: zustand persist, `name: 'mushaf-settings'`,
`version: 18` (401-404). Opt-in boolean pattern from `showCommunityReflections`
(field 120, action 180, default 224, body 260-262, migration 497-500). Add
`showRecitationTracking` / `toggleRecitationTracking`, version 19 migration.
Remove the dev toggle (`devSettingsStore.ts`, `DevMenu.tsx`).

`components/MushafSettingsContent.tsx` is shared by the `mushaf-layout` sheet,
the Settings screen and the player sheet (`context: 'player'`). Toggle row
pattern at 1036-1050 (card, optionRow, Switch with shared trackColor, helper
text, extras under the switch when on). Add a RECITATION section after DIVINE
NAMES / Thematic Highlighting, before FONT, hidden for `context === 'player'`:
switch "Follow my recitation" plus, when on, a "Recognition model, 75 MB" row
with download state and remove (reuse `TranslationsContent.tsx:635-668`).

## 2. First run

Existing: What's New carousel (`components/modals/WhatsNewOnboarding`,
`data/onboardingPages.ts` with `minVersion`), explainer sheets
(`FollowAlongSheet`, `RewayatInfoSheet`), download-with-progress in
translations, `components/CircularProgress.tsx`. No permission priming exists.

Recommendation: a `recitation-intro` sheet on the first mic tap when the model
is missing or permission not granted. Copy: on-device, audio never leaves the
phone, 75 MB once. One button "Download and allow microphone": request
permission first (a denial avoids wasting 75 MB), then download with
`CircularProgress`. Closing the sheet keeps the download going; the bar mic
shows the ring. Check permission with `AudioManager.checkRecordingPermissions()`
and on `Denied` offer `Linking.openSettings()`. Announce via an
`onboardingPages.ts` entry.

## 3. Status in the bottom bar

`MushafPlayerBar.tsx` has error, idle and active layouts; text from
`formatPlaybackInfo` (`mushafPlayerStore.ts:1346-1355`). Proposed:

| Status | Row 1 | Row 2 |
|---|---|---|
| off | idle row, mic outline | |
| downloading | idle row, mic shows progress ring | |
| loading | idle row, spinner | |
| listening, no verse yet | Stop, filled mic, options | "Finding your place…" |
| listening, verse | same | "Ya-Sin 36:4" |
| error | idle row, toast (error preset) | |

Add `formatRecitationInfo` beside `formatPlaybackInfo`. Convert Hafs keys to
the shown numbering for non-Hafs mushafs, or limit to Hafs. The listening
layout must hide Play.

iOS 26 `Stack.Toolbar` (expo-router 56.2.7) supports Button, Menu, View,
Spacer, SearchBarSlot, plus Label/Icon/Badge in a Button. Button titles are
hidden when an icon is set, but `Stack.Toolbar.View` takes any React node. Add
a listening branch: stop | spacer | View with status text | spacer | options.
Show download progress as a Badge or View text. `MushafToolbar` returns null in
immersive mode: keep a stop control or exit immersive when listening starts.

## 4. Recited-ayat layer

Layers in `verseHighlightLayers.ts` (7-13, 134-217): diff tints, theme zebra,
bookmarks, colour highlights, playback band, selection. Add "recited" at 0.25
(above zebra, below bookmarks) through `PageHighlightLayersInput`,
`PageVerseLayerSources`, `unitKeyedVerseLayers` (map with
`unitKeysForHafsKeys`) and `computeUnitPageHighlightLayers`. Store a
`recitedVerseKeys` list with a comparable-id selector.

Renderers: SkiaPage and ContinuousMushafView use the shared helper;
ReadingPageView and ContinuousListView need `usePlaybackBand()` on the Hafs
path without the `isPlaying` gate plus an `isRecited` row prop (and
`extraData`); QCFPage has its own ad hoc ranges and should switch to
`usePlaybackBand().hafsKeys`. Tests: `verseUnitsEndToEnd` fixture, layer tests,
`mushafVerseUnits.alldbs.test.ts`. Perf: only subscribe a page to the recited
word when the verse is on that page.

## 5. Analytics

`services/analytics/events.ts` constants with typed props, `trackX()` wrappers,
consent-gated `capture`. Proposed: `recitation_tracking_started`, `_locked`
(time to lock, page hint matched), `_stopped` (duration, ayat followed, pages
turned, stop reason, rtf, max feed, load), `recitation_model_download_started /
_completed / _failed`, `recitation_tracking_error` (stage). Never send audio or
transcripts. Sentry for engine failures.

## 6. Android

In place: audio-api plugin with RECORD_AUDIO and no foreground service, FFmpeg
off, ORT patch pinned. Session calls are no-ops on Android. Risks: no audio
focus (ambient sounds reach the mic), permission "don't ask again" and a force
cast to `PermissionAwareActivity` (`MediaSessionManager.kt:118`), unknown RTF
on low-end ARM, engine never disposed (~70 MB plus arena), ORT AAR size and
16 KB page alignment, Burnt toasts drop the message on Android, no device run
yet.

## 7. Lifecycle

- Player starts while listening: Play is still visible; expo-audio would play
  through the speaker in playAndRecord and Tilawa would follow the reciter.
  Add a `'recitation'` source to `AudioCoordinator` and stop tracking from
  `mushafWillPlay` / `mainWillPlay` (covers CarPlay too).
- Audio already playing: wait out expo-audio's delayed deactivation (~150 ms)
  before starting the mic, or reactivate after start; pause ambient sounds.
- Interruptions (Siri, alarms): observe interruptions, stop on `began`; add a
  watchdog (no chunk for ~2 s means stop).
- Route change: reset or restart on device change; AirPods HFP input is
  8-16 kHz and hurts accuracy.
- audio-api tracks its own `isActive` and can go stale after expo-audio
  deactivates; check a second take after Quran audio played.
