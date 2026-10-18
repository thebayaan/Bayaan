# Adhkar Session Widget Phase 1: Device Checklist Results

Plan: `docs/superpowers/plans/2026-10-12-adhkar-session-widget-phase-1.md` (Task 7).

Environment:
- Commit: `f2e39707` on `feat/adhkar-session-widget`.
- iOS: "Bayaan Widgets" simulator (B68030CC), iPhone 17 Pro, iOS 26.2, Xcode 27. Release build with the embedded JS bundle (`xcodebuild ... -configuration Release -sdk iphonesimulator`, incremental into the existing `trimdd` derived data), reinstalled (fresh data), widgets added from the gallery (search "Bayaan", pages 23 to 25 of 27).
- Android: Pixel_API_36 emulator (1080x2400, 420 dpi, Pixel launcher). Release APK with the embedded bundle: `./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease -Dorg.gradle.jvmargs="-Xmx6g -XX:MaxMetaspaceSize=2g"` (the first plain run failed with `OutOfMemoryError: Metaspace` in `:expo-updates:kspReleaseKotlin` plus lint worker failures). Reinstalled (fresh data).
- Run time: 2026-10-12, 20:34 to 21:05 local, so both platforms showed the Evening Adhkar session.
- Screenshots: `/private/tmp/claude-501/-Users-osmansaeday-orca-workspaces-Bayaan-widgets/c0503663-a396-4272-91ae-d9723ef577f3/scratchpad/adhkar-qa/` (file names below are relative to it).

Status key: PASS, PARTIAL, FAIL, NOT RUN.

## iOS

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Card 1: "1 of 24", no Prev, check in the counter | PASS | Medium and large both. `ios-01-card1-medium-large.png` |
| 2 | Next to card 2 (x3); ring 3, 2, 1, then card 3 | PASS | Ring went 3, 2, 1 and the third tap moved both widgets to "3 of 24". The widget redraw lags the tap by up to about a second. `ios-02-card2-ring2.png`, `ios-03-card3-dhikr77.png` |
| 3 | Prev from card 3 returns to card 2 with the ring at 3 | PASS | `ios-04-prev-card2-ring3.png` |
| 4 | Dhikr 77: medium opening, "…", caption; large full text unless `largeCut` | PASS | Medium shows the opening, ellipsis and "Read the rest in Bayaan →". Large: 77 has `largeCut: true`, shows the cut text and the caption. See the layout note in extra check 1. `ios-03-card3-dhikr77.png` |
| 5 | Body tap on card 3 opens the list at dhikr 77; card 1 opens at the top | PARTIAL | Card 3: opened the Evening list with dhikr 3 directly under the glass header, no "Open in Bayaan?" prompt, position unchanged 6 s later (`ios-06-deeplink-77-t6s.png`). Card 1 with the list freshly mounted: top (`ios-07-deeplink-card1-top-fresh.png`). Card 1 while the app was still on the same list (warm): stayed at dhikr 3 (`ios-07b-deeplink-card1-warm-stays-at-3.png`), see bug 3. |
| 6 | Finish, completed state, Start again; completion event | PASS | Completed state on both sizes (`ios-08-completed.png`); Start again returned to card 1 (`ios-09-start-again-card1.png`). Before opening the app the app group plist held `widgets.pendingEvents = [{"name":"adhkar_session_completed","props":{"dhikr_count":24,"duration_ms":298360,"category":"evening-adhkar"}}]`; after `launch-app` the key was gone (drained). PostHog live events not checked. Note: `xcrun simctl spawn ... defaults read group.com.bayaan.app widgets.pendingEvents` does not see the app group container; read `data/Containers/Shared/AppGroup/<uuid>/Library/Preferences/group.com.bayaan.app.plist` with `plutil -p` instead (the key contains a dot, so `plutil -extract` fails too). |
| 7 | Bayaan Now during adhkar hours shows the session; a tap updates both | NOT RUN | Run was at 20:45 to 20:48; Bayaan Now evening adhkar runs 15:00 to 19:59, so it showed listening (`ios-11-small-and-bayaan-now-2048.png`). No simulator clock control. The "tap updates both" half was confirmed between the medium and large Adhkar widgets (every tap on the medium updated the large). |
| 8 | Small widget unchanged, English title | PASS | "Evening Adhkar" title, single rotating dhikr, no session controls. `ios-11-small-and-bayaan-now-2048.png` |

## Android

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Card 1 | PASS | 3x2 (MEDIUM_TALL bucket): "1 of 24", no Prev, check. `and-01-medium-card1.png` |
| 2 | Card 2 ring 3, 2, 1, then card 3 | PASS | `and-02-medium-card3.png` |
| 3 | Prev from card 3 to card 2, ring 3 | PASS | Accessibility label "Count, 3 left". |
| 4 | Dhikr 77 medium and large | PARTIAL | Medium: opening, "…", caption, two readable lines (`and-02-medium-card3.png`). Large (3x3): the Arabic is clipped mid-line, see bug 2 (`and-05-large-card3.png`, `and-05-large-crop.png`). |
| 5 | Body tap on card 3 / card 1 | PARTIAL | Card 3 opened the list with dhikr 3 directly under the header, settled (`and-06-deeplink-77.png`). Card 1 warm: stayed at dhikr 3 (`and-09-card1-warm-stays-at-3.png`, bug 3). Card 1 after leaving the screen: top (`and-10-card1-fresh-top.png`). |
| 6 | Finish, completed, Start again; event | PARTIAL | Completed (`and-07-completed.png`) and Start again to card 1 (`and-08-start-again-large-card1-clipped.png`) PASS. Event queue NOT RUN: the release APK is not debuggable (`run-as: package not debuggable`), so the SharedPreferences queue could not be read; covered by the JVM/unit tests only. |
| 7 | Bayaan Now during adhkar hours | NOT RUN | 21:00 local (bedtime window); no clock change made this run. |
| 8 | Small unchanged | PASS | 2x2 on first add: "Evening Adhkar", static dhikr. `and-12-small-2x2.png` |

## Extra checks from reviews

| # | Check | Result | Notes |
|---|-------|--------|-------|
| E1 | iOS medium fits: header, 3 lines at 18pt, cut caption, 34pt controls, nothing clipped | FAIL | Nothing is clipped, but the Arabic never gets more than one line. Measured from full resolution screenshots: a short uncut card (dhikr 97, 62 chars) renders at full 18pt on one line (`ios-10-card23-short.png`); uncut dhikr 78 (102 chars) is squeezed onto one line at about 13pt (`ios-05-card4-uncut.png`, `ios-05-medium-crop.png`); cut cards with the caption render at about 12pt and SwiftUI adds its own truncation after about 60 characters (`ios-01-medium-crop.png`). Cause: the medium content height is about 130pt after padding; header (about 30pt), caption (about 13pt), controls (34pt) and five 6pt VStack gaps leave about 23pt for the text with a caption and about 42pt without. A Digital Khatt line at 18pt needs about 37pt, so 3 lines at 18pt (about 111pt) cannot fit. See bug 1. |
| E2 | Android 110 dp compact layout (and Bayaan Now) and large with long translations | FAIL | Compact NOT RUN: on the Pixel launcher the Adhkar widget cannot be shrunk below 2 rows (`minHeight` 110 dp needs 2 cells), so the 110 dp bucket was not reachable (`and-13-min-height-2-rows.png`); Bayaan Now was outside adhkar hours. Large FAIL: bug 2. |
| E3 | Deep link lands the dhikr under the header; `onScrollToIndexFailed` settles | PASS | iOS glass header and Android both land dhikr 3 directly below the header with the previous card's footer just hidden; no repeated jumping (iOS rechecked after 6 s, Android `await-screen-idle` settled in 1.6 s). |
| E4 | Tap shortly after a period boundary | NOT RUN | Needs clock control; covered by the reducer vectors only. |

Observation (known data issue, not fixed here): the Evening session shows morning wording, for example card 3 starts "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ" and its translation "We have reached the morning", because both periods use the same category.

## Bugs found

1. iOS medium Arabic is one line at 12 to 13pt for most cards (E1). Budget changes cannot fix the cut cards because the text is height bound, not width bound. Needs a layout change in `AdhkarSessionView.swift` (for example less vertical chrome on medium, or a smaller Khatt line height) before the medium budget can be calibrated.
2. Android large clips the Arabic bitmap mid-line on long cards (dhikr 75 and 77 at 3x3, 266x344 dp). `AdhkarSessionContent` sizes the text from `LocalSize`, which is the Responsive bucket (LARGE 250x250), not the real widget size, so the Arabic gets about 52 dp (250 minus padding, header, translation lines, caption and controls). `ArabicBitmap.render` then draws the 420-char text at the minimum size into that height and the overflow is cut off instead of ending on a whole line with an ellipsis. Visible as two lines plus the tops of a third (`and-05-large-crop.png`), with empty space above and below.
3. A widget link without `?dhikr` (card 1, completed) does not scroll the list to the top when the adhkar screen is already open on the same set; it keeps the previous position. Same for a repeated link to the same dhikr after the user scrolled (the `scrolledTo` ref blocks it). Both platforms. `app/(tabs)/(a.home)/adhkar/[superId]/index.tsx`.

## Budget calibration

No change. `SESSION_MEDIUM_CHARS` stays 110 and `SESSION_LARGE_CHARS` stays 420.

- Medium: uncut cards around 100 chars render at about 13pt on iOS, just under the 14pt line, so the rule says lower. But lowering to about 80 would turn every 80 to 110 char card into a cut card, and cut cards render smaller (about 12pt, height bound by the caption). Android medium (MEDIUM_TALL) shows two readable lines at 110. The fix is the iOS layout (bug 1); recalibrate after it.
- Large: iOS large shows 415 to 419 char cards on 5 to 6 lines at about 14 to 15pt with the translation and caption (`ios-01-large-crop.png`), so 420 fits iOS. Android large cannot show it, but that is bug 2 (bucket sizing and clipping), not the budget.

## Verification

| Command | Result |
|---------|--------|
| `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit` | PASS (exit 0) |
| `npx jest services/widgets modules/bayaan-widgets/src plugins` | PASS (34 suites, 313 tests) |
| `bash scripts/check-widget-content.sh` | PASS (exit 0) |
| `npm run test:widget-fixtures` | PASS (exit 0) |
| `cd android && ./gradlew :bayaan-widgets:testDebugUnitTest` | PASS (run with `-Dorg.gradle.jvmargs="-Xmx4g -XX:MaxMetaspaceSize=1g"`) |
| iOS Release iphonesimulator xcodebuild at `f2e39707` | PASS (BUILD SUCCEEDED, derived data `trimdd`) |

## Fix wave (bugs 1 to 3)

Run 2026-10-12, 21:20 to 21:41 local (Evening session), same devices. iOS: Release iphonesimulator build (`SENTRY_DISABLE_AUTO_UPLOAD=true`, the sentry-cli upload failed on the network), installed in place so the placed widgets stayed. Android: release APK as above; the emulator held a newer version code, so the app was reinstalled and the Adhkar widget re-added (3x2 medium, then 3x3 large). Screenshots: `/private/tmp/claude-501/-Users-osmansaeday-orca-workspaces-Bayaan-widgets/c0503663-a396-4272-91ae-d9723ef577f3/scratchpad/adhkar-qa/fix/` (`interim-*` files are from the 110 and 140 budget runs).

| Bug | Check | Result | Notes |
|-----|-------|--------|-------|
| 1 | iOS medium: 2 readable lines on short, ~100 char and cut cards | PASS | Medium has no progress bar and the hint sits in the controls row. Every card renders at the full 18pt: cut 75 and 77 on two lines with the hint (`ios-b1-card3-cut77-b120-crop.png`), uncut 86 (117 chars) on two lines (`ios-b1-card12-uncut86-117-b120-crop.png`), uncut 78 (102 chars) on two lines (`ios-b1-interim-card4-uncut78-budget110.png`), short 97 on one line (`ios-b1-card23-short97-b120-crop.png`). At a 140 budget iOS still held two lines at 18pt (`ios-b1-interim-card7-uncut81-139chars-crop.png`). Large unchanged. |
| 1 | Android medium (3x2) same cards | PASS | Same arrangement, two lines max. Cut 75 and 77 (114 and 116 chars), uncut 78 (102), short 97: all at the 18sp start size (bitmap 194 px tall); uncut 86 (117 chars) one 2 px step smaller (187 px), still above 16sp (`and-b1-*-crop.png`). At a 140 budget the 134 char card shrank to about 15.8sp (`and-b1-interim-card1-budget140-crop.png`), so Android 3x2 sets the budget. The hint truncates with an ellipsis when Prev is shown. Compact (110 dp) still NOT RUN: the Pixel launcher will not size the widget below 2 rows. |
| 2 | Android large (3x3) on 75 and 77 ends on whole lines | PASS | With `SizeMode.Exact` the session gets the real 266x344 dp, so both cards show their full large text on 5 lines with the translation and caption, nothing clipped (`and-b2-large-id75-crop.png`, `and-b2-large-id77-crop.png`). When text still cannot fit at the minimum size the bitmap now drops lines and ends on an ellipsis. Small Android widget keeps its Responsive bucket sizing. |
| 3 | Warm links on an open list: different dhikr, and card 1 (no `?dhikr`) | PASS | iOS: open at card 4, link to card 5 scrolled to 5 (`ios-b3-warm-different-dhikr-79.png`), then the card 1 link scrolled to the top (`ios-b3-warm-card1-link-top.png`). Android: cold link to card 3 (`and-b3-cold-dhikr77-card3.png`), warm card 4 (`and-b3-warm-different-dhikr78-card4.png`), warm card 1 to the top (`and-b3-warm-card1-link-top.png`). An identical repeated link was not retested. |

Budget: `SESSION_MEDIUM_CHARS` 110 to 120 (the most Android 3x2 holds on two lines at 16sp or more; iOS medium holds more). `SESSION_LARGE_CHARS` stays 420.

## Final review fixes (I1 to I4, a11y, extras)

Run 2026-10-12, 22:15 to 22:28 local. Commits `9ae92be6`, `b5175310`, `c418542c`, `f9ef7fc0`. Screenshots: `/private/tmp/claude-501/-Users-osmansaeday-orca-workspaces-Bayaan-widgets/c0503663-a396-4272-91ae-d9723ef577f3/scratchpad/adhkar-qa/final/`.

Environment: this session's process could not reach CoreSimulatorService (`Unable to lookup com.apple.CoreSimulator.CoreSimulatorService in the bootstrap`, `confstr DARWIN_USER_CACHE_DIR: Input/output error`), so `xcodebuild` aborted (exit 134) before compiling and no simulator was reachable, also with the sandbox off. The windowed emulator also aborted; Pixel_API_36 ran headless (`emulator -no-window`). Android used a release APK made debuggable for this run only through a Gradle init script outside the repo (`android.buildTypes.release.debuggable = true`), so `run-as` could read SharedPreferences and MMKV.

| # | Check | Result | Notes |
|---|-------|--------|-------|
| I1/I3 | Android: completing a session on the widget queues one event; the app drains it once | PASS | Before launch: `pendingEvents = [{"name":"adhkar_session_completed","props":{"category":"evening-adhkar","duration_ms":2650723,"dhikr_count":24},"completedAtMs":1791868707633}]` (`and-i3-prefs-before-launch.txt`, `and-i3-completed.png`). After the first launch the key is gone and the analytics aggregate for 2026-10-12 reads `"adhkarSessions":1` (`and-i3-aggregation-after-launch1.txt`). PostHog was opted in and its persisted queue was empty (already flushed); live PostHog events were not checked. |
| I1/I3 | Second launch does not resend | PASS | After a restart: still no `pendingEvents`, still `"adhkarSessions":1` (`and-i3-aggregation-after-launch2.txt`). |
| I2 | Completion time travels with the event | PASS (Android) | `completedAtMs` present in the queued event above; drain-day crediting is covered by Jest (`AnalyticsService.test.ts`, `syncConfiguredWidgets.test.ts`). |
| I4 | Android Bayaan Now in adhkar hours | PASS after fix | Clock set to 08:00 (`cmd alarm set-time`, automatic time off, restored afterwards). At 3x2 the compact layout was usable but drew one small Arabic line in a 180 dp cell (`and-i4-now-3x2-compact-card1-crop.png`). Taps on Bayaan Now updated the Adhkar widget and the reverse (`and-i4-adhkar-follows-now-card2-2left.png`, `and-i4-now-follows-adhkar-1left.png`). After adding `MEDIUM_TALL` to Bayaan Now's sizes it shows the medium session with two lines at full size (`and-i4-now-3x2-mediumtall-card2-crop.png`) and counting moves on (`and-i4-now-mediumtall-count-to-card3.png`). Listening at 13:00 and bedtime at 22:00 keep their layouts (`and-i4-now-3x2-mediumtall-listening-1300.png`, `and-i4-now-3x2-mediumtall-bedtime-2200.png`). The 110 dp compact layout itself is still not reachable on the Pixel launcher. |
| I4 | iOS Bayaan Now in adhkar hours | NOT RUN | Host time 22:00 to 22:30, outside both windows, and the simulator was unreachable from this session. |
| A11y | Once-said ring label | PASS (Android) | `Said once, next` on a once-said card in both the Adhkar widget and Bayaan Now (`and-a11y-said-once-next-morning-card1.png`). iOS uses the same string; not device checked. |
| Extras | Android gallery description, iOS small fallback | PASS (code) | Gallery: "Go through the adhkar for this time of day." The small iOS family never renders the session view. iOS checked by type checking all widget extension sources with `swiftc -typecheck` against the iPhoneSimulator SDK (0 errors). |

## iOS final round

Run 2026-10-12, 23:11 to 23:30 local, on `b57fe3d0`. Screenshots and plist dumps: `/private/tmp/claude-501/-Users-osmansaeday-orca-workspaces-Bayaan-widgets/c0503663-a396-4272-91ae-d9723ef577f3/scratchpad/adhkar-qa/ios-final/`.

Environment: after a Mac restart CoreSimulatorService was reachable again. Clean Release build for the simulator into fresh derived data (`xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -derivedDataPath <scratchpad>/iosdd SENTRY_DISABLE_AUTO_UPLOAD=true build`): BUILD SUCCEEDED on the first try, no Pods deployment target patch and no RNSVG retry needed. Installed over the existing app on "Bayaan Widgets" (B68030CC) with `xcrun simctl install`, so the app data and the widgets already on the home screen were kept (the session was at card 3 of the Evening Adhkar).

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Full build; medium and large render and count | PASS | Prev on the medium moved both widgets from card 3 to card 2 with "Count, 3 left" (`ios-f1-prev-card2-ring3.png`); two ring taps on the medium took both to "Count, 1 left" (`ios-f1-card2-count-1left-both.png`); a ring tap on the large moved both to card 3 (`ios-f1-large-ring-to-card3.png`). |
| 2 | Once-said ring label reads "Said once, next" | PASS | `describe` on card 3 (repeat 1): `AXButton "Said once, next"` on both the large and the medium. The old extension snapshot read `AXButton "Done"` before the new build was picked up (`ios-f2-describe-card3.txt`, `ios-f2-card3-said-once-next.png`). Repeat cards read "Count, N left". |
| 3 | Small widget: featured dhikr, English title, never the session view | PASS | "Evening Adhkar" title with a single featured dhikr and no controls, both while the session was in progress (`ios-f3-small-featured-and-bayaan-now-bedtime-2327.png`) and after it was completed (`ios-f3-small-featured-while-session-completed-2329.png`). |
| 4 | Finish on the widget; event queued once, drained once | PASS | Next through to card 24 (`ios-f4-card24.png`), one more Next showed the completed state on both sizes (`ios-f4-completed.png`). Before opening the app the app group plist held exactly one event: `widgets.pendingEvents = [{"props":{"dhikr_count":24,"category":"evening-adhkar","duration_ms":7442505},"completedAtMs":1791872927167.186,"name":"adhkar_session_completed"}]` (`ios-f4-plist-before-launch.txt`). After `launch-app` and about 10 s the key was gone (`ios-f4-plist-after-launch1.txt`). After `restart-app` still no `pendingEvents` (`ios-f4-plist-after-relaunch.txt`). The large `duration_ms` is because the session was started in an earlier round (`startedAtMs` 1791865484661). PostHog receipt and the iOS local aggregate were not checked. |
| 5 | iOS Bayaan Now in adhkar mode | PASS | 2026-10-13 04:10 on the "Bayaan Widgets" simulator (Debug build of this branch merged with fix/adhkar-content, so the morning list has 23 items). Bayaan Now medium, which showed Bedtime at 03:27, switched to the morning session at 04:10: "Morning Adhkar, 1 of 23", Ayat al-Kursi cut with "Read the rest in Bayaan" and the once-said check (`ios-i4-now-morning-card1-0410.png`). One tap on the check moved it to 2 of 23 with the counter at 3 (`ios-i4-now-card2-after-tap.png`); the large and medium Adhkar widgets on the next page showed 2 of 23 with 3 left (`ios-i4-adhkar-follows-now-card2.png`). Screenshots in the adhkar-content worktree under .superpowers/scratch/adhkar-qa/. |
