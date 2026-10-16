# Widgets Phase 1b: Device Checklist Results

Plan: `docs/superpowers/plans/2026-10-10-widgets-phase-1b.md` (Task 12).

Environment:
- iOS: iPhone 17 Pro simulator, iOS 26.2 ("Bayaan Widgets", B68030CC), Xcode 27, Release build via xcodebuild, installed over the existing app (data and placed widgets kept). `DYLD_INSERT_LIBRARIES` cleared before launches.
- Android: Pixel_API_36 emulator (API 36, production image, no `adb root`), Release APK via `./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a` with a temporary versionCode bump (restored after each build).
- Run date 2026-10-11 local, so Ayah of the Day index 67 (Al-Anfal 8:2); the next day is index 68 (8:28).
- Screenshots: `.superpowers/sdd/widgets-overnight/screens-1b/`.

Status key: PASS, PARTIAL, FAIL, NOT RUN.

## iOS

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Quick Surah small | PASS | Edit sheet set Ar-Rahman and Abdulbasit Abdulsamad. Before the app ran the card was the dark tile with "55" and the name; after opening and backgrounding the app the card art showed. Tap played Ar-Rahman with Abdulbasit in place (widget flipped to pause, app stayed in the background). |
| 2 | Quick Surah medium | PASS | Defaults Al-Kahf, Ya-Sin, Al-Mulk, Al-Waqi'ah with the default reciter (Mishary Alafasi). Al-Mulk tap played Al-Mulk with Mishary. Edit sheet: small shows Surah and Reciter only; medium shows all five parameters (`When(widgetFamily:)` works, no fallback needed). |
| 3 | Pinned Reciter small and medium | PASS | Photo and name over the scrim. Small configured to Saud Al-Shuraim: play resumed his last surah (Ali 'Imran). Unconfigured medium showed the default reciter (Mishary) with his recent row (Al-Mulk); the row tap played Al-Mulk with Mishary. Rewayah carry-over was not distinguishable on this data. |
| 4 | Ayah of the Day small, medium, large | PARTIAL | Digital Khatt renders like the mushaf (marks, ayah medallion), centered, not clipped, on all three sizes. Reference and Saheeh translation match index 67 (8:2). Listen opened playback of Al-Anfal with the default reciter; whether it started at ayah 2 was not measured. Tap elsewhere opened the mushaf at page 177 with 8:2. |
| 5 | Continue Reading small and medium | PARTIAL | Page 293, Juz 15, opening words "وَبِٱلْحَقِّ أَنزَلْنَٰهُ..." in Digital Khatt; tap opens page 293. After delete and reinstall: page 1, Al-Fatihah, "Start reading". The surah label reads Al-Isra (the surah of the page's first ayah, 17:105) where the brief and the in-app mushaf header say Al-Kahf. Not changed: needs a product call on which surah labels a page. |
| 6 | Tasbeeh small and medium | PASS | App killed, +1 tapped five times on medium (0 to 5) and twice on small (to 7): the count rose on each tap and the app did not open. Reset (medium) showed 0. Opening the app consumed the pending taps: the app's snapshot held 4 for dhikr 91 after a reset plus four taps, matching the widget, and the widget did not jump. Opening the app from the widget body first landed on the restored mushaf instead of adhkar: fixed by `0fa659fe` and re-verified (cold start now lands on Adhkar). Small tap precedence (Task 10): a tap on the +1 ring counts without opening the app. |
| 7 | Lock Screen accessories | PARTIAL | Added Now Listening inline, circular and rectangular, Tasbeeh circular and Continue Reading rectangular. Inline and rectangular show "Al-Anfal · 26m left" when paused. Taps: listening opens the player, Tasbeeh opens Adhkar, Continue Reading opens the mushaf page. The circular ring's progress was not observed to advance over a 100 s window on the simulator lock screen (it read about 4 to 5% throughout); not conclusive either way, so the static-Gauge fallback was not applied. |
| 8 | Continue Listening regression | PASS | Play/pause in place; up-next row tap jumped to Ar-Rahman with the same reciter; after reinstall the widget showed the surah of the day (Al-Hadid, Mishary) with an empty right column. |
| 9 | iOS 26 tinted and clear modes | PASS | Reciter photos and surah cards stay full color in tinted and clear; Arabic and Latin text legible. |

## Android

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 10 | Items 1 to 6 on Android | PARTIAL | Quick Surah: dialog config (Ar-Rahman, Abdulbasit), play opens the app and plays; medium four tiles, both rows visible at 3x2 (Task 6 clipping concern not seen). Pinned Reciter small: unconfigured shows the default reciter; configured Abdulbasit, play opened the app and played Al-Falaq (his last surah). Pinned Reciter medium NOT RUN: no free 3-column row on the test page and launcher drag did not work through the tooling. Ayah of the Day: bitmap Digital Khatt matches the in-app mushaf glyphs and medallion; Listen opened the app and played Al-Anfal with the default reciter; body tap opened page 177. Continue Reading: page 293, Juz 15, opening words, tap opens 293 (same Al-Isra label as iOS). Tasbeeh: +1 five times without opening the app, Reset to 0, Scheherazade New dhikr text renders cleanly; body tap opens Adhkar (Task 10 nested clickable OK). |
| 11 | Resize and Reconfigure | PARTIAL | Quick Surah 2x2 to 3x2 and back, Tasbeeh 2x2 to 3x2, Ayah of the Day 2x2, 3x2 and 3x4, Continue Reading 2x2 and 3x2: layouts switch cleanly. Pinned Reciter not resized (see 10). "Change widget settings" opened the picker for Quick Surah and Pinned Reciter; the button is present on Tasbeeh. |
| 12 | Midnight | PASS | `adb root` is not available on this production image, so the clock was set to 23:59 through Settings > Date & time with automatic time off. At 00:01 Ayah of the Day showed 8:28 (index 68) and Tasbeeh showed 0; the MidnightReceiver alarm was re-armed for the following midnight. Automatic time restored afterwards. |
| 13 | Pinned Reciter "Reciter unavailable" | PASS | Covered by `pinnedReciterResolve` and the iOS preview (not producible on a release build without editing app data). |

### Fixes made during the run

- `0fa659fe` Keep the deep-link target on cold start. The mushaf session restore pushed `/mushaf` on every cold start, hiding the screen a widget tap had opened (Tasbeeh opened the mushaf, not Adhkar). Now skipped when the launch has an initial URL. Restore without a URL re-verified.
- `c87f71e6` Reload the artwork widgets when snapshot artwork lands. A surah card cached for Continue Listening could be the one Quick Surah, Pinned Reciter or Continue Reading was waiting on, but only snapshot kinds were reloaded. Unit test added.
- `7166cafa` Redraw Android artwork widgets on every push. Compose skipped the card when inputs were unchanged, so a push after new artwork kept the numbered placeholder. Keyed on the push time; re-verified (Continue Reading card filled in after the app cached it).
- `8da14821`, `e7281026` Fit the whole ayah on 2-row Android Ayah of the Day. The 3x2 and 2x2 widgets rendered from the 110 dp buckets and ellipsized the Arabic after a few words. Added 180 dp tall buckets, up to three lines (medium) and six lines with a 10 sp floor (small).

### Open items

- Continue Reading surah label for pages that start mid-surah (Al-Isra vs Al-Kahf on page 293): product decision.
- Lock Screen circular ring animation not confirmed on the simulator; check on a phone before deciding on the static Gauge fallback.
- Android Pinned Reciter medium layout not seen on device.
- Android small Ayah of the Day was checked with 8:2 (179 characters); the longest curated ayah is 237 characters and may still ellipsize at the 10 sp floor on a 2x2.
- Listen from Ayah of the Day: start position at the ayah not measured on either platform.
- The Tasbeeh accessoryCircular unconfigured state (Task 11 minor) was not reproduced; the placed accessory showed the default dhikr.
