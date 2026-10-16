# Widgets Phase 1a: Device Checklist Results

Plan: `docs/superpowers/plans/2026-10-08-widgets-phase-1a.md` (Task 10).

Environment:
- iOS: iPhone 17 Pro simulator, iOS 26.2 ("Bayaan Widgets", B68030CC), Xcode 27. Release build via xcodebuild unless noted (the Debug dev client cannot run app JS on a background launch).
- Android: Pixel_API_36 emulator, API 36, Release APK via `./gradlew :app:assembleRelease`.
- The host was heavily loaded for part of the run (load average 200 to 800 from other sessions' builds), so absolute timings below are not representative of a phone.

Status key: PASS, PARTIAL, FAIL, PENDING.

## iOS

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | App killed, tap Play on small widget | PARTIAL | The widget side always works: the intent writes the optimistic override (icon flips at once), enqueues the command and iOS launches the app in the background within a second. Whether the command runs depends on how long JS boot takes in the background: a fresh install drained at +18 s and played. With a restored session, boot measured +75 s before `prepare()` started and +108 s to ready, past the 60 s command staleness window, so the command was dropped and the icon reverted after 61 s. Foreground cold boot of the same build is about 12 s. Needs a phone measurement before deciding between a longer window and the brief's `ForegroundContinuableIntent` fallback. |
| 2 | App alive in background, pause then play | PASS | Optimistic override flips both widgets within about 1.5 s of each tap; snapshot follows (paused at 280 s, then playing). No double toggle. A brief crossfade shows old and new time labels for one frame. |
| 3 | Tap an up-next row (medium) | PASS | Tapped Ali 'Imran in Saud Al-Shuraim's queue: jumped to that track (same reciter, same rewayah), queue kept (An-Nisa, Al-Ma'idah, Al-An'am up next). |
| 4 | Fresh install, no playback | PASS | Small and medium show surah of the day (Ar-Rahman) with the default reciter (Mishary Alafasy) and artwork. Medium right column is empty on a fresh install. |
| 5 | Play 3 minutes with widget visible | PASS | 0 snapshot writes and 1 timeline task in 180 s of playback; countdown and progress bar animate on their own. No reload loop. |
| 6 | Change theme in the app | PARTIAL | The snapshot picks up the theme within about 1 s. Continue Listening is now always dark by design (redesign `a4cd10d9`), so it looks the same in light and dark. |
| 7 | Artwork missing (offline proxy: cached files deleted) | PASS | Neutral tiles, layout intact, no crash; the app re-cached the artwork on its next snapshot and the widget showed it again. True airplane mode not reproduced on the simulator. |
| 8 | iOS 26 tinted and clear modes | PASS | Artwork stays full color in both; text readable on the tinted and glass backgrounds. |
| 10 | Deep links from cold start | PARTIAL | `mushaf/293` opens page 293. `quran/18?ayah=10` now opens page 294 (fixed). `mushaf/9999` falls back to page 1 with no crash. `player` opens the full player only when the app is already running (fixed); from a cold start it lands on Home with the sheet closed. |
| 11 | `npm run prebuild` (iOS) from clean reproduces a building project | PASS | Widget target, App Group, extension Info.plist and intents regenerate identically to the committed `ios/` (pbxproj compared with object IDs normalized). Other drift (versions, Sentry phase, EXUpdates, associated domains, ShareExtension attributes) predates this branch. Builds with the known local Xcode 27 workarounds only. Do not pass a global `IPHONEOS_DEPLOYMENT_TARGET`: it drags the iOS 17 extension down. |

### Fixes made during the run

- `3573bdcf` Pick a rewayah that has the surah when the widget sends none. The surah-of-the-day hero sends `rewayatId: null`; `createTrack` fell back to `rewayat[0]`, a 6-surah al-Duri rewayah for Mishary Alafasy without Ar-Rahman, so the widget queued a 404 URL.
- `722bc1aa` Fit the medium hero column inside the widget. It stacked about 170 pt into 130 pt and clipped the artwork; now uses the small widget's layout.
- `c7622081`, `ac5b39b0` Open `bayaan://quran/{surah}?ayah=N` at the ayah's page.
- `3c3627ed` Open the full player from `bayaan://player` while the app runs.

### Open items

- Item 1: background cold boot with a restored session can exceed the 60 s command window. Measure on a phone first. Since `5ae7d5c7` the drain also waits for the session restore, so a command that does run resumes at the saved position instead of 0.
- Item 10: `bayaan://player` from a cold start does not open the full player. The sheet renders nothing until the session is restored; waiting for the restore was tried and did not help, so the cause is not found yet.
- After the app is killed while playing, the widget keeps showing "playing" with a running countdown until the computed track end (M6 behavior), since no final snapshot is written.
- Debugging note: Argent sets `DYLD_INSERT_LIBRARIES` in the simulator's launchd environment, which stalled background launches inside Expo module registration for minutes. Clear it with `simctl spawn <udid> launchctl unsetenv DYLD_INSERT_LIBRARIES` before timing cold starts.

## Android

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | App not running, tap Play on the widget | PASS | Icon flips at once; the app opens and plays within about 9 s, resuming at the saved position (saved 0:22, resumed at 24.2 s). Required `e184d971` (broadcast receiver could not open the app on API 34+: I9 confirmed) and `5ae7d5c7` (command ran before the session restore and played from 0). |
| 2 | App alive in background, pause then play | PASS | Play and pause run in place (launcher stays in front), icon flips at once, media session follows. Required `624d55f6`: the first version of the activity brought the app forward on every pause. |
| 3 | Tap an up-next row (medium) | PASS | Opens the app and plays that surah with the same reciter and rewayah within about 2 s. Before `e184d971` a row tap while paused stalled until the app was opened, because React Native pauses JS timers in the background. Android row taps open the app by design (Ruling 24); iOS plays in place. |
| 4 | Fresh install | Not rerun | Shared JS path verified on iOS; reinstalling would remove the placed widget. |
| 5 | Playback with widget visible | PASS | Widget follows track changes while the app is backgrounded (An-Nahl to Al-Kahf, up-next list updated) after `e184d971` made the background flush immediate. Since the redesign, the pill shows a live countdown while playing and "N m left" while paused. |
| 6, 7 | Theme, missing artwork | Not rerun | Shared JS path verified on iOS. |
| 9 | Resize through all three sizes | PASS | 2x2 small, 3x2 medium (hero plus three up-next rows), 3x4 large (hero plus rows); layout switches cleanly each time. |
| 10 | Deep links | PASS | `quran/18?ayah=10` opens page 294; `player` from a cold start opens the full player (unlike iOS). |
| 11 | `npm run prebuild` (Android) from clean reproduces a building project | PASS | Widget receivers and manifest entries regenerate unchanged; Release build succeeds. Other drift (Sentry gradle line, versions, EXUpdates, App Links filter) predates this branch. |

### Fixes made during the Android run

- `e184d971` Route Android widget taps through a translucent `WidgetCommandActivity` instead of a broadcast receiver, and flush the widget snapshot immediately while the app is backgrounded (JS timers are paused there).
- `5ae7d5c7` Drain widget commands only after the session restore, so a cold-start Play resumes at the saved position. Shared code, so this also applies to iOS.
- `624d55f6` Keep Android play/pause in place while JS is alive.

### Android open items

- One "Bayaan isn't responding" (reason: no response to `onStartJob`, likely the icon-expiry WorkManager job) appeared while the mushaf page rendered after a deep link. The emulator logged ANRs in many processes during the run, including System UI, so this needs a look on a real phone before release.

## Redesign (`a4cd10d9`) and review fixes

Checked on the iOS simulator (iPhone 17 Pro) and the Android emulator (Pixel, API 36) after the redesign:

- Dark `#1C1C1E` background and the corner logo on every size.
- Paused pill reads "48m left" (iOS) and "29m left" (Android).
- Playing pill counts down live with no reload: 47:01 to 46:58 on iOS, 29:28 to 29:20 on Android (`Chronometer` through `AndroidRemoteViews` in a Glance `Row`, digits aligned with the icon).
- Thin progress bar animates on iOS; on Android it is static between pushes.

Review fixes after that run, not yet seen on a device:

- Android schedules a re-render at the computed track end (and after a reboot), so the countdown stops at zero instead of going negative when the app is gone.
- iOS medium art is 44 pt and the pill has layout priority with a 0.85 minimum text scale, so "1h 58m left" and hour countdowns fit on 390 pt and 375 pt phones.
- iOS small art is 40 pt with tighter spacing to fit the 120 pt content height of the smallest phones.
- The immediate background flush is Android only; iOS keeps the 1 s throttle.

## Carried items

| Item | Result | Notes |
|------|--------|-------|
| Optimistic override expires after 61 s | PASS (iOS) | Seen in item 1: when the command was dropped, the icon reverted to Play once the override expired. |
| I9: Android background activity launch on API 34+ | CONFIRMED, FIXED | The receiver's `startActivity` was blocked; fixed by `e184d971`. |
| Bitmap payload under RemoteViews limit | PASS | No `TransactionTooLarge` from Bayaan across all three sizes (the one failed binder in logcat was Google Play services). |
