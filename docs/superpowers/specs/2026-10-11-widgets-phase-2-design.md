# Widgets Phase 2 (iOS System Surfaces): Design Spec

**Date:** 2026-10-11
**Status:** Drafted while the owner was away; decisions are recorded as rulings (section 11) instead of open questions.
**Parent spec:** `docs/superpowers/specs/2026-10-08-widgets-design.md` (section 2 phasing, section 9 Phase 2 outline). Everything in the parent spec still applies unless a ruling here overrides it.
**Builds on:** Phase 1a and 1b (`docs/superpowers/plans/2026-10-08-widgets-phase-1a.md`, `docs/superpowers/plans/2026-10-10-widgets-phase-1b.md`), including the 1b binding decisions (Continue Listening look, surah cards, Digital Khatt).
**Platforms:** iOS only (Ruling P2-R17).

## 1. Goal

Put Bayaan on the iOS surfaces outside the Home Screen, reusing the Phase 1 plumbing (App Group snapshot, persisted command queue, `AudioPlaybackIntent`s in `targets/widgets/_shared/`):

1. **Live Activity + Dynamic Island** for the playing recitation: surah card, surah name, reciter, play/pause, timer-driven progress. An optional per-ayah layer shows the current ayah in Digital Khatt; it is built but ships off.
2. **Controls** (iOS 18 `ControlWidget`) for Control Center, the Lock Screen and the Action Button: play/pause, and "Play Surah" configured with a surah.
3. **Siri and Shortcuts** (`AppShortcutsProvider`): "Play Surah Al-Kahf in Bayaan", "Pause Bayaan", "Resume Bayaan".
4. **StandBy**: covered by the existing small widgets plus the Live Activity; no new widget kind.

## 2. Non-goals

- Android. Phase 2 is iOS-only per the roadmap; Android has no Live Activity, Control Center or App Shortcuts equivalents that fit this phase.
- Push updates and push-to-start for the Live Activity (needs an APNs sender, and the parent spec excludes any server-side component).
- Reciter phrases for Siri ("Play Alafasy in Bayaan"). Needs the catalog models in the app target; deferred (Ruling P2-R12).
- A user setting for the Live Activity. The mode is a code constant (Ruling P2-R1).
- Moving player creation to module scope (RFC-005), as in the parent spec.

## 3. Platform floors

| Surface | Floor | Why |
|---|---|---|
| App | iOS 16.4 | unchanged |
| Widget extension | iOS 17.0 | unchanged; renders the Live Activity |
| Live Activity | iOS 17.0 | the extension that renders it, and `Button(intent:)` in Live Activities, are iOS 17. The native start returns `unsupported` below 17 |
| Siri / App Shortcuts | iOS 17.0 | the intents are `AudioPlaybackIntent` (iOS 17) so they can start audio in the background |
| Controls | iOS 18.0 | `ControlWidget`; every type is `@available(iOS 18.0, *)` and the bundle adds them under `if #available(iOS 18.0, *)` |

Files in `targets/widgets/_shared/` compile into both the iOS 16.4 app and the iOS 17 extension, so every App Intents type there carries an availability attribute.

## 4. Architecture

```
player stores ──▶ syncWidgets.flushWidgetSnapshot ──▶ writeSnapshot + reloadWidgets   (Phase 1)
                          │
                          └──▶ noteSnapshotForLiveActivity(snapshot)                    (Phase 2)
                                   │  activityStateFromSnapshot + planActivity (pure)
                                   ▼
                          bayaan-widgets: start / update / endNowPlayingActivities
                                   │  NowPlayingActivityBridge (ActivityKit, module pod)
                                   ▼
                          ActivityKit ──▶ NowPlayingLiveActivity (widget extension)

ayah ticker (mode 'ayah' only) ── timestampService + setTimeout(next ayah) ──▶ setLiveActivityAyah

Live Activity button / Control / Siri ──▶ AudioPlaybackIntent in _shared (runs in the app process)
                                          └▶ WidgetCommandQueue ──▶ handleWidgetCommand (Phase 1)
```

Key properties:

- **One source of truth.** The Live Activity content state is derived from the same `WidgetSnapshot` the widgets get, at the same moment, by a pure function. No second subscription to the player store.
- **Commands are unchanged.** Every new entry point (Live Activity button, controls, Siri) produces an existing `WidgetCommand` (`setPlayback`, `playTrack`) through the existing queue, so `handleWidgetCommand`, its 60 s staleness window and its cold-start behavior apply as-is.
- **ActivityKit lives in the module pod.** The app's JS asks the `bayaan-widgets` module to start, update and end the activity. The module cannot see `_shared` (it is a separate pod), so the attributes type exists as two byte-identical files, one in the pod and one in the extension; a check script fails if they differ (Ruling P2-R4).

## 5. Live Activity

### 5.1 Content state

One versionless Codable struct, identical in TS (`modules/bayaan-widgets/src/liveActivity.ts`) and Swift (`NowPlayingActivityState.swift`, two identical copies), decoded from a shared fixture by both:

| Field | Type | Meaning |
|---|---|---|
| `surahId` | number | 0 for user uploads without a surah |
| `surahName` | string | as in the snapshot track |
| `reciterName` | string | |
| `artworkFile` | string or null | file in the App Group artwork dir (surah card, else reciter photo, as in the snapshot) |
| `isPlaying` | bool | |
| `positionSec` | number | position at `anchorAt` |
| `durationSec` | number | |
| `rate` | number | playback speed |
| `anchorAt` | number | epoch ms at which `positionSec` was sampled (the snapshot's `generatedAt`) |
| `ayah` | object or null | `{number, count, text}`; only filled in `ayah` mode |

Derived on both sides with the same formulas as Continue Listening: `wallStart = anchorAt - position / rate`, `wallEnd = anchorAt + (duration - position) / rate` (position clamped to `[0, duration]`, non-positive or non-finite rate treated as 1). Progress and countdown are `ProgressView(timerInterval: wallStart...wallEnd)` and `Text(timerInterval: wallStart...wallEnd, countsDown: true)`, so the activity animates with no updates while playing.

Attributes: `struct NowPlayingAttributes: ActivityAttributes { typealias ContentState = NowPlayingActivityState }` with no static fields.

ActivityKit caps the content state at 4 KB. Everything except the ayah text is small; the ayah text is cut to 600 UTF-8 bytes at a word boundary (Ruling P2-R9).

### 5.2 Lifecycle

| Event | Action |
|---|---|
| JS starts (`startLiveActivitySync`, after `appIsReady`) | end every existing Bayaan activity (orphans of a previous process), then follow the rules below |
| Snapshot with `nowPlaying.isPlaying` and no live activity | start, unless this track is suppressed |
| Live activity and the visible state changed (track, artwork, play/pause, duration, rate, ayah, paused position) | update |
| Live activity, playing, anchor drift above 2 s (a seek) | update |
| Live activity, playing, normal progress ticks | nothing |
| `nowPlaying` null (queue cleared) or paused within 1 s of the end (last track finished) | end, dismissal `.immediate` |
| Start fails while the app is not active (`deferred`) | retry on the next foreground (AppState `active`) |
| Start fails for another reason (`disabled`, `error`, `invalid`, `unsupported`) | suppress this track; try again on the next track |
| Update finds no activity (the user swiped it away, or the system ended it) | suppress this track; start again on the next track |

`staleDate`: while playing, `wallEnd + 60 s`; while paused, `now + 15 min`. ActivityKit's own 8 hour limit still applies.

All native calls are serialized through one promise chain, so a start cannot race an update or an end, and rapid track changes collapse into updates of the one activity.

The JS side stores no activity id. The bridge always acts on the first Bayaan activity in `active` or `stale` state, and `start` updates instead of requesting when one exists, so a second activity cannot appear.

### 5.3 Updates and budget

Local updates only (`pushType: nil`). In `surah` mode the activity is updated on track change, play/pause, seek, rate change and artwork arrival: a handful per track. The parent spec's highest risk (local updates from a background audio app reportedly stop after about 30 s) mostly affects the `ayah` mode, which updates on every ayah. It cannot be measured on a simulator, so `ayah` mode stays off until the device prototype in the Phase 2 device checklist passes (Ruling P2-R1).

Updates flow through `flushWidgetSnapshot`, which is throttled to 1 s, so an activity can lag the player by up to 1 s. After a widget, Live Activity, control or Siri command, `drainWidgetCommands` already forces an immediate flush.

### 5.4 Presentation

Fixed palette from 1b: background `#1C1C1E` (`activityBackgroundTint`), white text, secondary white 75%, tertiary white 60%, round 30 pt play button (`RoundIntentButton` with `SetPlaybackIntent`), artwork from the shared artwork dir via 1a's `Artwork(file:size:)` (dark tile when missing), Bayaan mark top-right on the Lock Screen. Every tap outside the button opens `bayaan://player`. No theme or accent colors.

| Presentation | Content |
|---|---|
| Lock Screen / banner (also StandBy full screen, scaled by the system) | artwork 56 pt, surah name (headline), reciter (subheadline), play/pause; ayah block (3 lines) in `ayah` mode; linear progress with remaining-time countdown |
| Dynamic Island expanded | leading: artwork 52 pt; center: surah name and reciter; trailing: play/pause; bottom: ayah block (2 lines) in `ayah` mode, then the progress row |
| Dynamic Island compact | leading: artwork 22 pt; trailing: circular timer progress while playing, pause glyph while paused |
| Dynamic Island minimal | same as compact trailing |

Paused: static `ProgressView(value:)` and "Nm left" (`WidgetLogic.minutesLeftLabel`). The Live Activity shows a remaining-time countdown although the Home Screen widgets do not (Ruling P2-R18).

### 5.5 Per-ayah layer (ships off)

Mode constant `liveActivityMode(): 'off' | 'surah' | 'ayah'` in `services/widgets/live-activity/config.ts`, `surah` by default.

In `ayah` mode an ayah ticker:

1. loads ayah timestamps for the playing track with `timestampService.getTimestampsForSurah(rewayatId, surahId)` (not `useTimestampStore`, which only loads while the player sheet is mounted);
2. computes the position from the snapshot (`positionSec + elapsed * rate`), finds the current ayah with `binarySearchAyah`, and publishes `{number, count, text}` where `count` is the last timestamp's ayah number and `text` is `digitalKhattDataService.getVerseText` truncated to 600 UTF-8 bytes;
3. sleeps with `setTimeout` until the next ayah boundary (plus 50 ms), not polling;
4. restarts on every snapshot (track change, play/pause, seek) and publishes nothing for user uploads, tracks without a rewayah, or rewayat without timestamps.

The Lock Screen and expanded Dynamic Island render the ayah in Digital Khatt (`DigitalKhattNewMadinaRegular`, registered in the extension's `UIAppFonts`), right to left, centered, never justified, with "Ayah N of M" beneath. The view renders `ayah` whenever present, so flipping the constant is the only change needed once the prototype passes.

## 6. Controls (iOS 18)

| Kind | Type | Behavior |
|---|---|---|
| `PlaybackControl` | `ControlWidgetToggle` with `StaticControlConfiguration` | value = Continue Listening's effective playing state (snapshot plus optimistic override, `EffectivePlayback`); action `SetPlayingControlIntent` (`SetValueIntent` and `AudioPlaybackIntent`), which calls the same `PlaybackCommand.setPlaying` as `SetPlaybackIntent` |
| `PlaySurahControl` | `ControlWidgetButton` with `AppIntentControlConfiguration` (`PlaySurahControlConfig`, parameter `surah: SurahEntity?`) | plays the configured surah with the default reciter via `PlaySurahIntent`; Al-Kahf until configured; prompts for configuration when added |

`SetPlayingControlIntent` lives in `_shared` (must run in the app process). The configuration intent and the controls live in `targets/widgets/Controls/`. The app reloads `PlaybackControl` whenever it reloads Continue Listening (in the module's `reloadWidgets`), and `PlaybackCommand.setPlaying` reloads it after writing the optimistic override.

Action Button: users pick either control under Settings > Action Button > Controls; nothing extra is needed.

## 7. Siri and Shortcuts

- `BayaanAppShortcuts: AppShortcutsProvider` (iOS 17) lives **in the app target only**. A config plugin (`plugins/withAppShortcuts.js`) copies `plugins/app-shortcuts/BayaanAppShortcuts.swift` into `ios/Bayaan/` and adds it to the app target on every prebuild. It cannot go in `_shared`, because that would also declare App Shortcuts in the widget extension (Ruling P2-R12).
- Intents (all in `_shared`, `AudioPlaybackIntent`, iOS 17, discoverable):
  - `PlaySurahIntent(surah: SurahEntity)` enqueues `playTrack` with no reciter or rewayah (default reciter, rewayah picked by the existing fallback).
  - `PausePlaybackIntent` calls `PlaybackCommand.setPlaying(false)`.
  - `ResumePlaybackIntent` resumes the loaded track, else plays the most recent non-upload surah, else Continue Listening's suggestion (`upNext`), else does nothing (Ruling P2-R15).
- Phrases (each includes the app name, as App Shortcuts require):
  - "Play \(surah) in Bayaan", "Play Surah \(surah) in Bayaan", "Play \(surah) on Bayaan"
  - "Pause Bayaan", "Stop Bayaan"
  - "Resume Bayaan", "Continue Bayaan"
- `SurahEntity` moves from the extension (`Support/Entities.swift`) to `_shared/SurahEntity.swift` so the app can resolve it. Its data comes from a generated `_shared/SurahCatalog.swift` (114 id, name, translated name rows) written by `npm run generate:widget-data`, because `surahs.json` is bundled in the extension only. Its display title becomes the plain name ("Al-Kahf", subtitle "18 · The Cave") with spoken synonyms ("Al Kahf", "Kahf", "Surah Al-Kahf", "The Cave") so Siri can match it (Ruling P2-R13). Quick Surah's picker shows the new title; saved configurations keep working because the id is unchanged.
- The module calls `BayaanAppShortcuts.updateAppShortcutParameters()` on creation through the Objective-C runtime (`BayaanAppShortcutsRefresher`), since the pod cannot import app-target code.

Cold start: a Siri or control command while the app is not running behaves exactly like a widget tap in 1a (queued, app launched in the background, drained after session restore, dropped after 60 s). The 1a checklist measured background boots over 60 s on a loaded simulator; that open item applies here too.

## 8. StandBy

No new code (Ruling P2-R16). StandBy shows systemSmall widgets in pairs: every Bayaan small widget already draws a fixed `#1C1C1E` container background, which StandBy removes to black with no visual change, and artwork is content, not background. StandBy also shows the Live Activity full screen using the Lock Screen presentation. StandBy needs a charging phone in landscape and is not available on the simulator, so it is a real-phone check (night mode red tint included).

## 9. Data and file layout

```
modules/bayaan-widgets/
  src/liveActivity.ts                  content state types, guards, wall-time helpers
  src/__fixtures__/liveActivity.states.json   shared with Swift
  src/index.ts, NativeBayaanWidgets.ts start/update/endNowPlayingActivities, isLiveActivitySupported
  ios/NowPlayingActivityState.swift    copy A (identical to the extension copy)
  ios/NowPlayingAttributes.swift       copy A
  ios/NowPlayingActivityBridge.swift   ActivityKit start/update/end
  ios/BayaanWidgetsModule.swift        bridge functions, control reload, shortcut refresh
services/widgets/live-activity/
  config.ts                            liveActivityMode()
  planActivity.ts                      pure: snapshot -> state, plan, memory transitions
  syncLiveActivity.ts                  serialized native calls, AppState retry, orphan cleanup
  ayahLayer.ts                         pure: current ayah, next boundary, UTF-8 truncation
  ayahTicker.ts                        timer-driven ayah publisher (ayah mode only)
targets/widgets/
  LiveActivity/NowPlayingActivityState.swift, NowPlayingAttributes.swift   copy B
  LiveActivity/NowPlayingLiveActivity.swift                                views and previews
  Controls/PlaybackControls.swift                                          iOS 18 controls
  _shared/PlaybackIntents.swift        PlaybackCommand, PlaySurah/Pause/Resume, SetPlayingControlIntent
  _shared/PlaybackResume.swift         pure resume decision
  _shared/SurahEntity.swift, SurahSynonyms.swift, SurahCatalog.swift (generated)
plugins/withAppShortcuts.js, plugins/app-shortcuts/BayaanAppShortcuts.swift
scripts/check-widget-system-surfaces.sh   Swift checks (copies identical, fixture decode, logic vectors)
app.config.js                          NSSupportsLiveActivities, plugin registration
```

## 10. Testing

- **TS unit tests (Jest):** content state guard against the shared fixture; wall-time helpers; `activityStateFromSnapshot`; `planActivity` (start, update, none on ticks, seek drift, end, suppression, rapid track changes); memory transitions for every start result; `staleAtFor` at non-1x rates; `syncLiveActivity` with the native module mocked (orphan cleanup first, serialized calls, deferred retry on foreground, dismissal, Android no-op); ayah layer math (boundaries, rates, truncation); ayah ticker with fake timers; native wrapper result parsing; `SurahCatalog.swift` generation and drift.
- **Swift checks (`npm run test:widget-fixtures`):** the two copies of each shared ActivityKit file are byte-identical; the fixture decodes; wall-time vectors match TS; surah catalog and synonyms; resume decision vectors.
- **Builds:** `npm run prebuild` then the Release simulator `xcodebuild` from the 1b plan; the app's `Metadata.appintents` contains the shortcut phrases.
- **Simulator verification** ("Bayaan Widgets", iPhone 17 Pro, iOS 26.2, has a Dynamic Island): Live Activity on the Lock Screen and in the island (compact, minimal, expanded), play/pause from the activity, track change, end on queue clear, orphan cleanup after a relaunch, controls in Control Center, Shortcuts app listing and running the three shortcuts, Quick Surah picker regression.
- **Real phone only (open checks):** the `ayah` mode prototype (section 5.3), Siri voice recognition of transliterated surah names, Action Button, StandBy (including night mode), activity start after playback began from a widget or Siri with the app in the background, and the visual overlap with the system Now Playing controls (Ruling P2-R1).

## 11. Rulings

Format: what; why; cost if wrong.

- **P2-R1. Live Activity mode is a code constant, `surah` by default; `ayah` stays off until the device prototype passes.** Why: the background update limit cannot be measured on a simulator, and the surah-level activity needs only a handful of updates per track. Open product check: iOS already shows the system Now Playing card on the Lock Screen and in the Dynamic Island for audio apps, so a surah-level activity may look redundant next to it; if it does on a phone, set the mode to `off` (one line) until `ayah` mode is verified. Cost if wrong: a one-line change and an OTA update either way.
- **P2-R2. Only app JS starts the activity; no push-to-start.** A start that fails while the app is not active returns `deferred` and is retried on the next foreground. Why: push-to-start needs an APNs sender (server work the parent spec excludes), and starting from inside an intent is not possible because `_shared` intents also compile into the extension, where `Activity.request` is unavailable. Cost if wrong: users who only ever start playback from a widget, control or Siri see no activity until they open the app; adding a `LiveActivityIntent` path or push-to-start later does not change the content state or views.
- **P2-R3. The activity is driven from `flushWidgetSnapshot`, not a second store subscription.** Why: one derivation point keeps widgets and activity consistent and reuses the 1 s throttle and post-command flush. Cost if wrong: up to 1 s lag on play/pause from the in-app player; moving the hook to a direct store subscription is local to `syncLiveActivity.ts`.
- **P2-R4. `NowPlayingActivityState.swift` and `NowPlayingAttributes.swift` exist as two byte-identical copies (module pod and extension), enforced by `cmp` in `scripts/check-widget-system-surfaces.sh`.** Why: the pod cannot compile files outside its directory and cannot see `_shared`; ActivityKit pairs the app's and the extension's attributes by type name, as it does for every app whose app and extension are separate Swift modules. Cost if wrong: if pairing fails, the activity starts but renders nothing (caught in the simulator task); fallback is moving the bridge into the app target with the same plugin mechanism as the App Shortcuts file.
- **P2-R5. JS adopts or ends an activity left by a previous process.** On the first snapshot of a new process, a surviving Bayaan activity that shows the restored now-playing track (same surah, name and reciter key the policy uses) is adopted as live memory and kept up to date; any other surviving activity is ended, and so is one when no now-playing track is restored. Why: a paused activity outlives its process by design (P2-R7), and its own Play button relaunches the app in the background, so ending it at startup would remove the card the user just tapped; an activity for another track has no owner. Cost if wrong: a surviving activity for the restored track keeps its old content until the first update (about a second).
- **P2-R6. A dismissed activity is not resurrected for the same track, and a failed start (`disabled`, `error`) is not retried for the same track.** Why: respects the user's swipe and avoids a native call per snapshot when Live Activities are turned off. Cost if wrong: an activity the system ended for its own reasons stays gone until the next track.
- **P2-R7. End on queue cleared or when paused within 1 s of the end; a paused activity stays with `staleDate = now + 15 min`; a playing one has `staleDate = wallEnd + 60 s`.** Why: paused recitation is commonly resumed, and stale dates keep a killed app's activity from claiming to play forever. Cost if wrong: tuning two constants.
- **P2-R8. No optimistic Live Activity update on a button tap.** Why: the intent runs in `_shared`, which also compiles into the extension; the app updates the activity within about a second after the command drains. Cost if wrong: a visible delay of about a second on the activity's own button.
- **P2-R9. Ayah text is cut to 600 UTF-8 bytes at a word boundary with an ellipsis; 2 lines in the island, 3 on the Lock Screen; `count` is the last timestamp's ayah number; timestamps come from `timestampService`.** Why: stays far under the 4 KB content state cap; the timestamp store only loads while the player UI is mounted. Cost if wrong: long ayat show less text.
- **P2-R10. The play/pause control uses a new `SetPlayingControlIntent` (`SetValueIntent` + `AudioPlaybackIntent`) that calls the same `PlaybackCommand.setPlaying` as `SetPlaybackIntent`.** Why: `ControlWidgetToggle` requires a `SetValueIntent` with a `value` parameter, and changing `SetPlaybackIntent`'s parameter would break 1b widget buttons. Cost if wrong: none beyond one small type.
- **P2-R11. The Play Surah control is configured with a surah only and plays it with the default reciter; Al-Kahf until configured.** Why: `ReciterEntity` reads the extension-only catalog; a reciter parameter can be added later without migrating saved controls. Cost if wrong: users wanting a specific reciter use Quick Surah.
- **P2-R12. `AppShortcutsProvider` is app-target only, added by a config plugin; no reciter phrases.** Why: `_shared` would also put App Shortcuts in the widget extension, which is not an App Intents extension; reciter phrases need the catalog models and `ReciterEntity` in the app target. Cost if wrong: one plugin file to maintain; reciter phrases are a follow-up.
- **P2-R13. `SurahEntity` moves to `_shared` with a generated `SurahCatalog.swift`; its display title becomes the plain name with synonyms.** Why: Siri needs the entity in the app process, and "18. Al-Kahf" is not something people say. Cost if wrong: Quick Surah's picker rows read "Al-Kahf / 18 · The Cave" instead of "18. Al-Kahf".
- **P2-R14. Siri shortcuts and the Live Activity require iOS 17; controls require iOS 18.** Why: `AudioPlaybackIntent` (needed to start audio from the background) and the extension are iOS 17. Cost if wrong: iOS 16.4 to 16.x users get none of Phase 2.
- **P2-R15. "Resume Bayaan" with nothing loaded plays the most recent non-upload surah, else the surah-of-the-day suggestion, else does nothing.** Why: matches what Continue Listening's play button does with nothing loaded. Cost if wrong: one function.
- **P2-R16. StandBy gets no new code.** Why: small widgets already render on a near-black container background that StandBy removes without visual change; the Live Activity covers StandBy's full-screen mode. Cost if wrong: a follow-up adding `widgetRenderingMode` handling for night mode after a phone check.
- **P2-R17. Phase 2 is iOS only.** Why: roadmap. Cost if wrong: none now.
- **P2-R18. The Live Activity shows a remaining-time countdown; the Home Screen widgets keep their no-time-left decision.** Why: the activity is a glance at an active session where time left is the main question, and `Text(timerInterval:)` costs no updates. Cost if wrong: delete one `Text`.
- **P2-R19. Phase 2 work happens on `osmansaeday/widgets-2`, branched from `osmansaeday/widgets-1b` after 1b's device verification lands; the PR targets `develop` after 1b merges.** Why: Phase 2 edits 1b files (`Entities.swift`, `PlaybackIntents.swift`, `WidgetsBundle.swift`, the module). Cost if wrong: a rebase.

## 12. Open checks that need a real phone

1. `ayah` mode prototype: does the ayah line keep updating with the phone locked for 10 minutes, on battery and in Low Power Mode (protocol in the Phase 2 device checklist)?
2. Does the surah-level activity look redundant next to the system Now Playing card and island (P2-R1)?
3. Activity start when playback began from a widget, control or Siri with the app in the background (expected `deferred` until foreground, P2-R2).
4. Siri voice recognition of transliterated surah names ("Play Al Kahf in Bayaan", "Play Yasin in Bayaan").
5. Action Button with each control.
6. StandBy with small widgets and the Live Activity, including night mode.
7. Cold start from a control or Siri (inherits 1a open item 1, the 60 s command window).

## 13. Risks not resolved by this spec

- Background local update throttling for `ayah` mode (section 5.3); the fallback is the shipping default.
- ActivityKit pairing across the pod and extension copies (P2-R4), low likelihood, caught in the simulator task.
- `DisplayRepresentation(title:subtitle:synonyms:)` and `WidgetBundle` `if #available` for controls are taken from the SDK as understood; the builds in the plan will confirm, with fallbacks named in the tasks.
- Image size limits for Live Activity artwork: the cached artwork is a 300 px JPEG; if it fails to render in the activity, the dark tile shows and a smaller derivative is needed.
- Siri and control commands on a cold start inherit the 1a background boot time issue.
