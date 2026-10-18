# Widgets Phase 3: Device Checklist Results

Plan: `docs/superpowers/plans/2026-10-11-widgets-phase-3.md` (Task 11).

Environment:
- iOS: iPhone 17 Pro simulator, iOS 26.2 ("Bayaan Widgets", B68030CC), Xcode 27, Release build via xcodebuild (build recipe), installed over the existing app (data and placed widgets kept). `DYLD_INSERT_LIBRARIES` cleared before launches.
- Android: Pixel_API_36 emulator (API 36, production image, no `adb root`), Release APK via `./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a` with a temporary versionCode bump (1160, then 1161 for the fix build; the installed app was already at 1159, so 1153 was refused as a downgrade). `build.gradle` restored after each build (`git diff` empty).
- Clock changes on Android: `adb shell cmd alarm set-time <ms>` works on the production image without root (after `settings put global auto_time 0`); automatic time restored at the end.
- Run date 2026-10-11 (day 20737), Sunday, from about 06:00 local. Expected Hijri: table row 283 = 30 Rabi al-Thani 1448. Expected coming up (vector 20737): Ramadan 120 days, Eid al-Fitr 149, Dhul Hijjah 208.
- Screenshots: `.superpowers/sdd/widgets-overnight/screens-3/`.

Status key: PASS, PARTIAL, FAIL, NOT RUN.

## iOS

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Recently Played medium and large | PARTIAL | After playing Al-Fatihah (Ahmad Al-Ajmy), Al-Baqarah (Alsudaes), Ali 'Imran (Mishary): three cards newest first, large shows reciter names. Card tap played that surah in place, app stayed in the background (Al-Fatihah resumed with Al-Ajmy). Note: the store keeps one card per reciter, so plays by the same reciter replace each other (three different surahs only show if they are by three reciters). Fresh install "Start listening" state NOT RUN: deleting the app would wipe the simulator's data and placed widgets; covered by `recentShelf` tests. |
| 2 | Library medium and large | PASS | Downloads by default: Al-Mulk and Al-Fatihah, "2 surahs". Edit widget, choose "Night": header with play button and "3 surahs". Header play started Al-Mulk with As-Sajdah and Ya-Sin up next. Ya-Sin card played Ya-Sin, up next Al-Mulk then As-Sajdah (wrap). Deleting "Night" in the app turned the widget into "Playlist unavailable / Edit the widget to choose another". |
| 3 | Bedtime small and medium | PASS | Small configured As-Sajdah, Abdulbasit Abdulsamad, 15 minutes, Rain ("As-Sajdah · 15 min · Rain"). App terminated, widget tapped at 06:27: As-Sajdah started from 0:09 with Abdulbasit, player sleep timer "15 minutes remaining", widget read "Sleep at 6:42 AM" about 14 s after the tap. Second tap at 06:28: "Sleep at 6:43 AM", surah restarted (0:09 again). Open check 1 (ambient on a cold start): the ambient sheet opened, but which sound was active could not be read from the accessibility tree and audio is not observable from the tooling; not conclusive. Medium (unconfigured) shows Al-Mulk, Mishary, 30 min. |
| 4 | Adhkar small and medium | PASS | 06:21: "Morning Adhkar / أذكار الصباح", featured dhikr in Scheherazade New, "24 adhkar". Cold start (app terminated) tap on the medium opened the Morning adhkar set (`bayaan://adhkar/<superId>`). Evening switch checked on Android (item 14). |
| 5 | Hijri Date small, Lock Screen inline and rectangular | PASS | Small: "30", "ربيع الآخر", "Rabi al-Thani 1448 AH" (table row 283). Inline: "30 Rabi al-Thani 1448". Rectangular: "30 Rabi al-Thani 1448 / Ramadan in 120 days" (vector 20737). |
| 6 | Occasion medium and large | PASS | No occasion today: medium "Coming up" Ramadan in 120 days, Eid al-Fitr in 149 days; large adds The Ten Days of Dhul Hijjah in 208 days. Tap without an occasion opens the app (no ayah URL by design). Not a Friday, so Jumu'ah Listen was checked on Android (item 13). SwiftUI previews not opened (no Xcode UI in this run). |
| 7 | Reciter of the Day small and medium | PASS | Bandar Balilah with photo on both sizes; medium rows Al-Fatihah, Al-Kahf, Ya-Sin. Small play started Al-Kahf with Bandar Balilah (his surah list). |
| 8 | Bayaan Now small and medium | PARTIAL | While playing: Continue Listening look (medium with "Recent" rows), play/pause toggled in place. Paused at 06:21: morning adhkar view (04:00 to 10:59). Smart Stack NOT RUN (relevance cannot be judged on a simulator, open check 3). |
| 9 | Regression | PASS | Continue Listening small pause in place; Lock Screen Live Activity play/pause; Control Center Play/Pause toggled Playing/Paused; Tasbeeh +1 (0 to 1) without opening the app; Quick Surah tap played Ar-Rahman with Abdulbasit. |
| 10 | Cold start playlist card | PASS | App terminated, Library "Night" As-Sajdah card tapped: the widget showed As-Sajdah playing within about 1 s (the first describe after the tap), well inside the 60 s window. |

## Android

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 11 | Items 1 to 8 on Android | PARTIAL | Recently Played 3x2: Ya-Sin, Al-Falaq, Al-Kahf; Al-Kahf card opened the app and resumed Al-Kahf with Mohammad Saayed at its saved position. Library: Downloads (Al-Mulk, Al-Fatihah, "2 surahs"); "Change widget settings" picker (Downloads, Night) switched to Night with play button and "3 surahs"; Ya-Sin card opened the app and played Ya-Sin. Bedtime: menu dialog set As-Sajdah, 15 min, Rain; tap played As-Sajdah with the default reciter (Mishary), two media sessions playing (surah and rain), widget "Sleep at 7:15 AM" for a 07:00:57 tap. Reciter of the Day: Bandar Balilah photo. Adhkar: morning before 12:00 with all three dhikr lines (after the fix below). Hijri and Occasion match iOS. Bayaan Now: morning adhkar at 06:48, plain NowPlayingCard at 12:01. Bayaan Now medium, Adhkar medium, Reciter medium and Library delete-to-unavailable NOT RUN (emulator time budget). Observation: Recently Played on Android did not show the Bedtime play (Mishary card kept Ya-Sin); not investigated. |
| 12 | IcuHijri | PASS | Widget showed 30 Rabi al-Thani 1448 on 2026-10-11 (row 283), 25 Ramadan 1448 on 2027-03-04 (row 427) and 9 Dhu al-Qadah 1448 on 2027-04-16 (row 470 reads 1448/11/9). No difference from the table. |
| 13 | Occasion dates | PARTIAL | 2027-03-04 10:00 (first 2027 row with 9/25): Occasion "The Last Ten Nights, 25 Ramadan 1448" with Al-Qadr 97:2; Hijri Date "25 Ramadan 1448 AH / The Last Ten Nights"; Bayaan Now (not playing) showed the occasion. Friday 2027-04-16 10:00: "Jumu'ah, 9 Dhu al-Qadah 1448" with Al-Kahf 18:10. Listen opened the app with Al-Kahf (Mohammad Saayed) loaded but playback stayed at state NONE; likely the 2027 clock breaks TLS for streaming (the surah was not downloaded), so "plays from the start" was not confirmed. Medium Occasion Arabic renders as one small line in the 44 dp slot (readable but small); same 110 dp bucket pattern as the Adhkar fix, left as a follow-up. |
| 14 | Boundary refresh | PASS | Clock set to 11:57:30; Adhkar small showed morning at 11:58 and evening (أذكار المساء, "أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ") by 12:01 without opening the app; ContextClockReceiver re-armed for 15:00:01. Tapping it opened the Evening adhkar set. |
| 15 | Background sleep timer | PARTIAL | Bedtime 15 min tapped at 07:00:57 ("Sleep at 7:15 AM"), screen locked. Playback was STOPPED by 07:12 at position 8:44, which is the end of As-Sajdah (the only queued surah), so the surah ended before the timer; the timer itself could not be judged. Rerun with a surah longer than 15 minutes. |
| 16 | Resize and Reconfigure | PARTIAL | Library 3x2 to 3x4: large layout with captions rendered, no RemoteViews errors in logcat (no TransactionTooLarge for the app). Recently Played could not shrink below 2 rows; on this 4-column Pixel grid a 2-row widget is about 224 dp tall, so the 110 dp clip of the 52 dp medium tile was not reproducible (tiles looked fine). "Change widget settings" opens the pickers for Library and Bedtime. Other widgets not resized. |

### Fixes made during the run

- `280cd9ee` Show the whole dhikr on a 2x2 Android Adhkar and Bayaan Now. The 2x2 widgets rendered from the 110 dp bucket, so the Scheherazade bitmap was capped at 52 dp and the third line was cut in half. Added `WidgetSizes.SMALL_TALL` (110x180 dp) to both widgets' responsive sizes. Re-verified on the emulator: all three lines render on Bayaan Now (morning) and Adhkar (morning and evening).

### Open items

- Android sleep timer (open check 2): rerun with a surah longer than the timer.
- Jumu'ah Listen plays Al-Kahf from the start: confirm with real time on a Friday (or a downloaded Al-Kahf).
- Android Occasion medium Arabic is small in the 44 dp slot; a 180 dp bucket (as Ayah of the Day and now Adhkar use) would give it room.
- iOS Bedtime ambient on a cold start (open check 1) needs a listen on a device.
- Bayaan Now Smart Stack behaviour and relevance (open check 3) need a phone.
- Android Bayaan Now "Pause past track end" (final wave item) was not observed in this run.
- The ledger's 44 dp medium tile ruling: the clip was not reproducible on the Pixel launcher grid.
