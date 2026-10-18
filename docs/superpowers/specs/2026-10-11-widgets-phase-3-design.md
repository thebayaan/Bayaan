# Widgets Phase 3 (Content and Context): Design Spec

**Date:** 2026-10-11
**Status:** Drafted while the owner was away; decisions are recorded as rulings (section 12) instead of open questions.
**Parent spec:** `docs/superpowers/specs/2026-10-08-widgets-design.md` (section 2 phasing row 3, section 9 "Bayaan Now"). Everything in the parent spec still applies unless a ruling here overrides it.
**Builds on:** Phase 1a and 1b plans (`docs/superpowers/plans/2026-10-08-widgets-phase-1a.md`, `docs/superpowers/plans/2026-10-10-widgets-phase-1b.md`) and the Phase 2 spec (`docs/superpowers/specs/2026-10-11-widgets-phase-2-design.md`), including the 1b binding decisions (Continue Listening look, surah cards, Digital Khatt, Scheherazade New for dhikr).
**Platforms:** iOS and Android, parity by default. iOS Lock Screen accessories and Smart Stack relevance are iOS only (P3-R15, P3-R14).

## 1. Goal

Add the "content and context" widgets from the roadmap on top of the Phase 1 plumbing, with one rule: a widget ships only when the app feature it depends on already exists, or when it needs nothing beyond curated static data and widget code (the same bar that pushed khatma, wird, hifz and streaks to Phase 4).

## 2. Feasibility audit (what exists in the app today)

Checked in the code on `osmansaeday/widgets-1b` (2026-10-11).

| Roadmap item | App feature it needs | Exists? | Evidence | Decision |
|---|---|---|---|---|
| Recently Played shelf | recently played list | Yes | `useRecentlyPlayedStore.recentTracks`, already in the snapshot as `recent` (6 items) | **Build** |
| Playlist / Downloads shelf | user playlists, downloads | Yes | `store/playlistsStore.ts` + `services/playlist/PlaylistService.ts` (SQLite, `UserPlaylist`, `PlaylistItem`); `services/player/store/downloadStore.ts` (`DownloadedSurah`, persisted); `createTrack` prefers local files | **Build** (one configurable widget, P3-R10) |
| Bedtime (surah + sleep timer + ambient) | sleep timer, ambient sounds | Yes | `usePlayerStore.setSleepTimer(minutes)` with `settings.sleepTimerEnd`; `SleepTimerSheet` offers 5/15/30/45/60; `store/ambientStore.ts` with 7 bundled sounds (`AMBIENT_SOUND_LIST`), ambient follows player play/pause in `ExpoAudioProvider` | **Build** |
| Morning/Evening Adhkar | adhkar data with morning and evening sets | Yes | `data/adhkar.json` category `27` (24 adhkar, Hisnul Muslim "morning and evening"); super categories `morning-adhkar` and `evening-adhkar` (both map to category 27) in `AdhkarDatabaseService.seedSuperCategories`; route `app/(tabs)/(a.home)/adhkar/[superId]` | **Build** (glance + deep link) |
| Occasion ayat | occasion calendar and ayat | No app data | no Ramadan, Dhul Hijjah, Jumu'ah or Laylat al-Qadr data anywhere in the app | **Build from curated static data** (like 1b's Ayah of the Day, P3-R7) |
| Hijri date | Hijri calendar | No app utility, OS has it | no Hijri code or library in the app; Foundation `Calendar(identifier: .islamicUmmAlQura)` and Android `android.icu.util.IslamicCalendar` (API 24, minSdk is 24) | **Build with OS calendars** (P3-R4) |
| Reciter spotlight | curated reciter list | Yes | `data/reciterCollections.ts`: `getFeaturedReciters()` ("Spotlight reciters chosen by Bayaan"), `getBayaanOriginalsReciters()`, `getTrendingReciters()`; deterministic order | **Build** |
| "Bayaan Now" smart widget | the views above plus time rules | Yes (composition) | Phase 1 and Phase 3 views; WidgetKit `TimelineEntryRelevance` | **Build** |

Deferred as "needs a new app feature" (same bar as Phase 4):

- **Adhkar progress ("7 of 24 done").** Morning and evening share the same 24 dhikr ids (category 27) and `dhikr_counts` is one daily counter per id, so a morning completion cannot be told apart from an evening one. Needs per-session completion tracking.
- **Playing adhkar audio from a widget.** "Play All" lives in `adhkarPlayAllStore` and the screen-mounted `AdhkarAudioProvider`; there is no headless adhkar playback path. Needs app work.
- **Prayer-time-aware windows (morning adhkar after Fajr, evening after Asr, Hijri day starting at Maghrib).** The app has no prayer time feature or location. Phase 3 uses fixed clock hours (P3-R5).
- **User Hijri day adjustment (+1/-1).** No app setting exists. Phase 3 shows plain Umm al-Qura (P3-R4).
- **"Sleep at end of surah".** The sleep timer only takes minutes.

Smart Stack relevance: iOS has `TimelineEntryRelevance` (score and duration per timeline entry, iOS 14+), which Phase 3 uses. The iOS 26 RelevanceKit / `RelevanceConfiguration` widget relevance is watchOS only, so it does not apply. **Android has no equivalent**: Glance and AppWidgetManager expose no API to rank a widget inside a launcher stack. Bayaan Now on Android switches content by the same time rules but nothing promotes it.

## 3. Widgets in scope

| Kind | Families (iOS) | Android | Config | Main action |
|---|---|---|---|---|
| `RecentlyPlayed` | medium, large | resizable, medium and large buckets | none | tile tap resumes that track (`playTrack`) |
| `LibraryShelf` | medium, large | same | source: Downloads (default) or one playlist | tile tap plays; playlist header button plays all (`playPlaylist`) |
| `Bedtime` | small, medium | small and medium | surah (Al-Mulk), reciter (default), minutes (30), ambient (Off) | one tap starts the surah, the sleep timer and ambient (`startBedtime`) |
| `Adhkar` | small, medium | same | none | opens the morning or evening adhkar set |
| `HijriDate` | small, accessoryInline, accessoryRectangular | small | none | glance |
| `Occasion` | medium, large | medium and large | none | Listen plays the occasion ayah (`playTrack` with ayah) |
| `ReciterSpotlight` | small, medium | small and medium | none | play the reciter (`playReciter`), rows play a surah |
| `BayaanNow` | small, medium | small and medium | none | whatever the composed view does |

Every widget uses the Continue Listening look: fixed `#1C1C1E` surface, Bayaan mark top-right, white text (secondary 75%, tertiary 60%), round 30 pt/dp buttons, surah cards (`surah-{id}.jpg`, dark tile fallback) as surah artwork, reciter photos (`reciter-{id}.jpg`, initials fallback) for reciters. No time-left text on any home screen widget. Quran text is Digital Khatt (`DigitalKhattNewMadinaRegular` on iOS, `fonts/DigitalKhattFont.otf` through `ArabicBitmap` on Android), centered, never justified. Dhikr text and Arabic month and occasion names use Scheherazade New. No theme or accent colors, and user playlist colors are ignored (P3-R10).

## 4. Architecture

```
                          (Phase 1, unchanged)
player / recent / reciter stores ──▶ flushWidgetSnapshot ──▶ snapshot.json ──▶ Phase 1 widgets
                                         │                                 └▶ RecentlyPlayed, Bedtime, BayaanNow
                                         └▶ snapshot listener (syncContentWidgets): changedContentKindsForSnapshot

                          (Phase 3, new)
playlists (SQLite) / downloads / player settings.sleepTimerEnd / reciters
        ──▶ syncContentWidgets ──▶ buildContent (pure) ──▶ content.json ──▶ LibraryShelf, ReciterSpotlight,
                                                                              Bedtime, BayaanNow
generate-widget-data (dev time) ──▶ adhkar-periods.json, occasions.json (bundled) ──▶ Adhkar, Occasion,
                                                                                       HijriDate, BayaanNow
OS calendar (Umm al-Qura, Gregorian) ──▶ ContentLogic (Swift) / ContentLogic + IcuHijri (Kotlin)

widget taps ──▶ existing command queue ──▶ handleWidgetCommand
                 playTrack / playReciter / setPlayback (existing)
                 playPlaylist / startBedtime (new) ──▶ contentCommands.ts
```

Key properties:

- **One new side document, no Phase 1 contract changes.** Phase 3 app data goes in a new versioned `content.json` (`WidgetContent`, section 5.1) instead of new snapshot or catalog fields, so the 1a/1b decoders, fixtures and tests stay untouched (P3-R2).
- **Separate kind list.** Phase 3 kinds are a new `ContentWidgetKind` union with their own change detection (`contentKinds.ts`); `widgetKinds.ts` and its tests are not modified (P3-R3). `reloadWidgets` accepts both unions.
- **Rules live in one reference implementation.** Time-of-day, occasion and Bayaan Now rules are written once in TS (`modules/bayaan-widgets/src/contextRules.ts`) and mirrored in Swift and Kotlin, pinned by shared fixture vectors (`context.vectors.json`, `next-occasions.vectors.json`) and a Hijri conversion table (`hijri.table.json`) generated from Foundation. JS itself never computes Hijri dates; widgets do it natively so they change at midnight without the app.
- **Commands go through the existing queue.** iOS taps use `AudioPlaybackIntent`s in a new `_shared/ContentIntents.swift` (runs in the app process). Android taps use the existing `WidgetCommandActivity`, which already queues any non-`setPlayback` command and opens the app; it is not edited. `selectFreshCommands` already treats every non-`setPlayback` command as a play command, so "last play wins" covers the new ones.
- **Date-driven refresh.** iOS timelines carry entries at every context boundary for 24 hours. Android uses a new `ContextClockReceiver` (inexact `setAndAllowWhileIdle`, same as 1b's `MidnightReceiver`, which stays untouched) to re-render at the next boundary.

## 5. Data

### 5.1 `content.json` (`WidgetContent`, version 1)

Written by the app (iOS App Group `widgets/content.json`, Android `bayaan_widgets` prefs key `content`) whenever its content changes, compared without `generatedAt`.

| Field | Type | Meaning |
|---|---|---|
| `version` | 1 | future versions are rejected by every decoder (widgets then show their no-content state) |
| `generatedAt` | number | epoch ms |
| `downloads` | `WidgetShelfItem[]` | completed downloads, newest first, max 8 |
| `downloadCount` | number | all completed downloads |
| `playlists` | `WidgetPlaylist[]` | max 20, most recently updated first; each with `id`, `name`, `itemCount` (all items) and `items` (first 8 non-upload items in playlist order) |
| `spotlight` | `WidgetSpotlightReciter[]` | rotation list: `id`, `name`, `artworkFile` (`reciter-{id}.jpg`), `surahIds` (up to 3 of 1, 18, 36, 67, 55, 56 that the reciter has) |
| `sleepTimerEndsAt` | number or null | `usePlayerStore.settings.sleepTimerEnd`; a value in the past means no timer |

`WidgetShelfItem`: `surahId` (1 to 114), `surahName`, `reciterId`, `reciterName`, `rewayatId` (or null), `itemId` (playlist item id, null for downloads).

### 5.2 Generated static data (dev time, committed, both platforms)

`npm run generate:widget-data` additionally writes, next to `surahs.json` and `ayat.json`:

- `adhkar-periods.json`: `{morning, evening}`, each `{period, superId, title, arabicTitle, count, featured[]}`. `count` is the number of category 27 adhkar (24). `featured` comes from the curated source `data/widgets/adhkar-periods.json`: dhikr ids from category 27 whose text is short and correct for that period (morning adds 95 "عِلْماً نَافِعاً", evening adds 97 "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ"; the "أصبحنا / أمسينا" adhkar are excluded because the seed only carries the morning wording). Text is cleaned with the same rules as 1b's Tasbeeh catalog (`tasbeehDisplayText`, `tasbeehTranslation`, moved to `services/widgets/dhikrText.ts`, P3-R20).
- `occasions.json`: `{months[12], occasions[]}`. `months` has the English and Arabic month names. Each occasion has `id`, `name`, `arabicName`, `listenSurahId` (Al-Kahf for Jumu'ah, else null) and `ayat` built exactly like Ayah of the Day (`buildStaticAyat`: Digital Khatt words, Saheeh International, at most 20 words) from the curated source `data/widgets/occasions.json`.

A Jest drift test fails when the generated files differ from what the sources produce, as in 1b.

### 5.3 Hijri dates

- Calendar: Umm al-Qura. iOS `Calendar(identifier: .islamicUmmAlQura)`; Android `android.icu.util.IslamicCalendar` with `CalculationType.ISLAMIC_UMALQURA`. JVM unit tests use `java.time.chrono.HijrahDate` (also Umm al-Qura) as the converter.
- Input is always the local **Gregorian** day number (`WidgetLogic.dayNumber` / `DayMath.dayNumber`, 1b R2), converted at 12:00 UTC of that day, so a device set to a Hijri or other calendar, or a time zone far from UTC, cannot shift the result.
- The Hijri day changes at local midnight, not at Maghrib.
- **Variance caveat:** Umm al-Qura is a computed calendar. Countries and communities that start months by local moon sighting are often one day off from it, occasionally two, mostly at the start of Ramadan, Shawwal and Dhul Hijjah. The widgets show Umm al-Qura without adjustment (P3-R4); the Occasion widget's windows move with it.
- Weekday (for Jumu'ah) is the Gregorian weekday, Sunday = 1, Friday = 6.

### 5.4 Occasions

| Id | Name | Window (Umm al-Qura) | Ayat (source keys) | Listen |
|---|---|---|---|---|
| `eidFitr` | Eid al-Fitr / عيد الفطر | 1 to 3 Shawwal | 10:58, 87:14, 87:15 | from the ayah |
| `arafah` | Day of Arafah / يوم عرفة | 9 Dhul Hijjah | 2:199, 2:201 | from the ayah |
| `eidAdha` | Eid al-Adha / عيد الأضحى | 10 to 13 Dhul Hijjah | 108:1, 108:2, 108:3 | from the ayah |
| `lastTen` | The Last Ten Nights / العشر الأواخر | 21 to 30 Ramadan | 97:1 to 97:5, 44:3 | from the ayah |
| `ramadan` | Ramadan / رمضان | 1 to 20 Ramadan | 2:183, 2:186, 97:1, 97:3 | from the ayah |
| `dhulHijjah` | The Ten Days of Dhul Hijjah / عشر ذي الحجة | 1 to 8 Dhul Hijjah | 89:1, 89:2, 22:27 | from the ayah |
| `ashura` | Ashura / عاشوراء | 9 and 10 Muharram | 26:62, 26:63 | from the ayah |
| `jumuah` | Jumu'ah / الجمعة | Friday, 00:00 to 17:59 local | 18:10, 18:1 | Surah Al-Kahf from the start |

Priority is the table order; the Hijri windows do not overlap, and Jumu'ah only applies when no Hijri window does. The ayah shown is `ayat[dayNumber % ayat.count]`. "Coming up" anchors: Ramadan (9/1), Eid al-Fitr (10/1), Dhul Hijjah (12/1), Day of Arafah (12/9), Eid al-Adha (12/10), Ashura (1/10), found by scanning forward day by day up to 400 days.

### 5.5 Time rules

All hours are local, from the Gregorian calendar.

| Rule | Value |
|---|---|
| Adhkar period | morning 04:00 to 11:59, evening otherwise |
| Bayaan Now | playing: listening; else an occasion today: occasion; else 04:00 to 10:59 morning adhkar; 15:00 to 19:59 evening adhkar; 21:00 to 03:59 bedtime; else listening |
| Relevance (Bayaan Now) | listening while playing 1.0, occasion 0.8, adhkar 0.7, bedtime 0.6, idle listening 0.2 |
| Relevance (single widgets) | Adhkar 0.7 inside 04:00 to 10:59 or 15:00 to 19:59, else 0.2; Occasion and HijriDate 0.8 on an occasion, else 0.1; Bedtime 0.6 from 21:00 to 03:59, else 0.1 |
| Context boundaries | 00:00, 04:00, 11:00, 12:00, 15:00, 18:00, 20:00, 21:00 |

## 6. Widget behavior

### 6.1 Recently Played (medium, large)

- Tracks: `snapshot.recent` without uploads and without surah 0, max 4 (medium) or 6 (large).
- Medium: header "Recently Played", 4 surah cards in a row. Large: 2 rows of 3 cards with the reciter name under each.
- Tap on a card: `playTrack(surahId, reciterId, rewayatId, ayah: nil)`, which resumes at the saved position (existing `findRecent` path). Background tap opens `bayaan://player`.
- Empty (fresh install): header "Start listening" and Al-Fatihah, Al-Kahf, Ya-Sin, Al-Mulk with the default reciter. No snapshot at all: "Open Bayaan".

### 6.2 Library Shelf (medium, large; configurable)

- Source: Downloads (default) or a playlist. iOS: `AppIntentConfiguration` with `LibrarySourceEntity` (`downloads` or `playlist:<id>`, suggestions from `content.json`). Android: configuration activity with the same list.
- Downloads: header "Downloads" and "N surahs", up to 4 (medium) or 8 (large) cards; a card plays with `playTrack` (createTrack picks the local file). Background tap opens `bayaan://collection/downloads`. No downloads: "No downloads yet".
- Playlist: header with the playlist name, "N surahs" and a round play button (`playPlaylist(id, itemId: nil)`); a card sends `playPlaylist(id, itemId)`, which queues the whole playlist starting at that item, wrapping around, like `PlaylistDetail.handleSurahPress`. Upload items are not shown as cards but are played by the app. Background tap opens `bayaan://collection/playlists`.
- Playlist deleted: "Playlist unavailable" with "Edit the widget to choose another" (iOS) or "Tap to choose another" (Android, opens the picker).
- No `content.json` yet: "Open Bayaan to load your library".

### 6.3 Bedtime (small, medium; configurable)

- Configuration: surah (default 67 Al-Mulk), reciter (default reciter), minutes (15, 30, 45, 60; default 30), ambient (Off, Rain, Forest, Ocean, Stream, Thunder, Fireplace, Wind; default Off).
- Small: surah card, "Bedtime", "Al-Mulk · 30 min", round moon button. Medium: larger card, surah name, reciter, "30 min · Rain", moon button.
- Whole widget is the action: `startBedtime(surahId, reciterId, sleepMinutes, ambient)`. The app plays the surah **from the beginning** with the chosen reciter (the default reciter when none is chosen or the chosen one is gone), calls `setSleepTimer(minutes)` (replacing any running timer), then, unless ambient is Off, calls `useAmbientStore.setSound(sound)`, which enables ambient and fades it in. Off leaves the ambient setting as it is.
- While `sleepTimerEndsAt` is in the future the subtitle reads "Sleep at 23:40" (`Text(date, style: .time)` on iOS, formatted clock time on Android). A clock time, not a countdown, so no reloads are needed. An iOS timeline entry at `sleepTimerEndsAt` reverts the subtitle.

### 6.4 Adhkar (small, medium)

- Period by local hour (section 5.5). Data from `adhkar-periods.json`.
- Small: Arabic period title ("أذكار الصباح" / "أذكار المساء") in Scheherazade New, today's featured dhikr (3 lines), Bayaan mark.
- Medium: English title and Arabic title, featured dhikr (2 lines), its translation (1 line), "×3" repeat count when above 1, "24 adhkar".
- Featured dhikr: `featured[dayNumber % featured.count]` for the period.
- Tap opens `bayaan://adhkar/morning-adhkar` or `bayaan://adhkar/evening-adhkar`. No progress and no audio (section 2 deferrals).

### 6.5 Hijri Date (small; iOS also accessoryInline and accessoryRectangular)

- Small: Arabic month name (Scheherazade New) top-left, mark top-right, large day number, "Rabi al-Thani 1448 AH", and the occasion name when today has one. Tap opens the app.
- Lock Screen inline: "29 Rabi al-Thani 1448". Rectangular: the date, then the occasion name or "Ramadan in 23 days". Lock Screen taps open the app.
- Timeline: today and next midnight (iOS); `ContextClockReceiver` on Android.

### 6.6 Occasion (medium, large)

- Occasion today: header with the occasion name and the Hijri date, the ayah in Digital Khatt, the Saheeh translation (2 lines medium, 4 lines large), a round Listen button. Listen sends `playTrack(surahId, nil, nil, ayah)` (default reciter, plays from the ayah onward), or for Jumu'ah `playTrack(18, nil, nil, nil)`. Tap elsewhere opens `bayaan://quran/{surah}?ayah={n}`.
- No occasion: header with the Hijri date, "Coming up" and the next 2 (medium) or 3 (large) occasions with "in N days" ("Tomorrow" for 1). Tap opens the app.

### 6.7 Reciter Spotlight (small, medium)

- Today's reciter: `content.spotlight[dayNumber % count]`. The list is `getFeaturedReciters()`, then `getBayaanOriginalsReciters()`, then `getTrendingReciters()`, deduplicated in that order, without uploads (P3-R12).
- Small: photo full-bleed under the 1b scrim, "Reciter of the Day", name, play button (`playReciter`, resumes their last surah or Al-Fatihah).
- Medium: photo left with play button, name, "Reciter of the Day", up to 3 surah rows (`playTrack(surahId, reciterId, nil, nil)`).
- The app caches every spotlight photo; widgets also record missing photos as artwork requests (1b mechanism). No content: "Open Bayaan to meet today's reciter".

### 6.8 Bayaan Now (small, medium)

Composition, not new UI. The mode comes from section 5.5.

| Mode | iOS view | Android view |
|---|---|---|
| listening | `ContinueListeningView` (1a, reused as is, with the optimistic playback override) | `NowPlayingCard` (new, Phase 3): surah card, surah and reciter, play/pause or play button |
| occasion | small: `HijriDateView`; medium: `OccasionView` | small: Hijri small content; medium: Occasion content |
| morningAdhkar / eveningAdhkar | `AdhkarView` | Adhkar content |
| bedtime | `BedtimeView` with the default configuration (Al-Mulk, default reciter, 30 min, ambient Off) | Bedtime content with the same default |

- iOS timeline: entries at now, at every context boundary in the next 24 hours, and at the playing track's computed end; each entry carries `TimelineEntryRelevance(score:duration:)` until the next entry. The app reloads Bayaan Now when Continue Listening's slice, `recent` or `sleepTimerEndsAt` changes.
- Android: `ContextClockReceiver` re-renders at each boundary; the app pushes on the same changes. No relevance (none exists).
- Android uses `NowPlayingCard` because 1a's Continue Listening composables are private and 1a files are not edited (P3-R13). Its play button sends `setPlayback` through `WidgetCommandActivity`; it does not render the optimistic override, so its icon updates on the next app snapshot (about a second when the app is alive).

## 7. Commands

```ts
type WidgetCommand =
  | ...existing
  | {type: 'playPlaylist'; playlistId: string; itemId: string | null}
  | {type: 'startBedtime'; surahId: number; reciterId: string | null;
     sleepMinutes: number;              // integer 1 to 240
     ambient: WidgetAmbientSound | null} // 'rain' | 'forest' | 'ocean' | 'stream' | 'thunder' | 'fireplace' | 'wind'
```

- `playPlaylist`: reads the playlist's items with `playlistService.getPlaylistItems`, builds tracks like `PlaylistDetail` (uploads through `useUploadsStore` + `createUserUploadTrack`, others through `createTrack`), rotates so `itemId` is first (unknown or null `itemId` starts at the first item), `updateQueue(tracks, 0)` then `play()`. A missing or empty playlist does nothing.
- `startBedtime`: resolves the reciter (a null id, or a configured reciter no longer in the catalog, means the default reciter), plays the surah from 0 through the existing `playSurah` helper (exported from `handleWidgetCommand.ts`, now returning whether it started), then the sleep timer, then ambient (section 6.3). If the surah cannot start (no reciter at all, unknown surah), the timer and ambient are not touched.
- `handleWidgetCommand` reaches both through a dynamic `import('./contentCommands')`, so the Phase 1 handler and its tests do not load the playlist database or the ambient store.
- The TS list of ambient sounds is pinned to `AMBIENT_SOUND_LIST` by a test.

## 8. File layout

```
data/widgets/adhkar-periods.json, data/widgets/occasions.json     curated sources
scripts/generate-widget-data.ts                                   (modified) also writes adhkar-periods.json, occasions.json
scripts/generate-hijri-table.swift                                Foundation Umm al-Qura table for 2026 to 2028
scripts/generate-context-vectors.ts                               next-occasions vectors from the TS reference
scripts/check-widget-content.sh                                   Swift decode + logic checks (chained into test:widget-fixtures)
services/widgets/
  dhikrText.ts                       tasbeehDisplayText, tasbeehTranslation (moved from buildCatalog.ts, re-exported there)
  widgetStaticData.ts                (modified) buildAdhkarPeriods, buildOccasionData
  buildContent.ts                    pure: app state -> WidgetContent
  contentCommands.ts                 playPlaylist, startBedtime
  syncContentWidgets.ts              content writes, reloads, artwork, subscriptions
  syncWidgets.ts                     (modified) addSnapshotListener hook; syncContentWidgets reloads Phase 3 kinds from it
  handleWidgetCommand.ts             (modified) routes the new commands, exports playSurah
modules/bayaan-widgets/src/
  content.ts, contentKinds.ts, contextRules.ts, commands.ts (modified), index.ts / NativeBayaanWidgets.ts (modified)
  __fixtures__/content.full.json, hijri.table.json, context.vectors.json, next-occasions.vectors.json
modules/bayaan-widgets/ios/BayaanWidgetsModule.swift              (modified) writeContent
targets/widgets/
  _shared/ContentIntents.swift       PlayPlaylistIntent, StartBedtimeIntent
  Support/ContentModels.swift, ContentLogic.swift, ContentStores.swift, ContentEntities.swift, ContentChrome.swift
  RecentlyPlayed/, LibraryShelf/, Bedtime/, Adhkar/, Hijri/ (HijriDate + Occasion), Spotlight/, BayaanNow/
  ContentWidgets.swift               nested WidgetBundle (P3-R16)
  adhkar-periods.json, occasions.json (generated)
modules/bayaan-widgets/android/src/main/
  java/.../ContentModels.kt, ContentLogic.kt, ContentConfig.kt, IcuHijri.kt, ContextClockReceiver.kt, ui/ContentUi.kt
  java/.../recentlyplayed/, libraryshelf/, bedtime/, adhkar/, hijri/, spotlight/, bayaannow/
  (modified) WidgetStorage.kt, GlanceState.kt, BayaanWidgetsModule.kt, AndroidManifest.xml, strings.xml
  assets/widgets/adhkar-periods.json, occasions.json (generated)
app/_layout.tsx                      (modified) starts syncContentWidgets
```

## 9. Edge cases

- **No `content.json` (app not opened since the update) or a future version:** Library and Spotlight show "Open Bayaan ..."; Bedtime works with its configuration and simply shows no sleep time; Adhkar, Hijri, Occasion never depend on it.
- **Playlist deleted, emptied, or only uploads:** "Playlist unavailable" for deleted; an empty card row with "Open the playlist in Bayaan" for no non-upload items; play-all still plays uploads.
- **Stale `sleepTimerEndsAt`** (app killed while a timer ran; the interval does not survive a restart): any value at or before now is treated as no timer.
- **Device calendar set to Hijri, or a non-UTC zone near midnight:** Gregorian day number in, Umm al-Qura out (section 5.3).
- **Dates outside the converter's range or a converter failure:** Hijri views show nothing for the date line and the Occasion widget shows only "Open Bayaan"; no crash.
- **Missing artwork:** dark tile / initials, plus an artwork request, as in 1b.
- **Bedtime while something else plays or a timer runs:** the configured surah replaces the queue; the new timer replaces the old.
- **Cold start from a tap:** queued, app launched, drained after session restore, 60 s expiry (1a behavior).

## 10. Testing

- **Jest:** content guard against `content.full.json` (and future version rejected); new command guards; `changedContentKindsForSnapshot` / `ForContent`; context rules against `context.vectors.json`; `nextOccasions` against the Hijri table and the committed vectors (drift test); static data builders and generated file drift; `buildContent`; `contentCommands` with mocked deps; `syncContentWidgets` with the native module mocked; `AMBIENT_SOUND_LIST` parity.
- **Swift (`npm run test:widget-fixtures`):** `content.full.json` decode and future version; generated `adhkar-periods.json` and `occasions.json` decode; Foundation Umm al-Qura equals `hijri.table.json` for every row; rule vectors; next-occasion vectors; library resolver and recent shelf cases.
- **Kotlin (`./gradlew :bayaan-widgets:testReleaseUnitTest`):** the same decode, rule and vector checks, with `java.time.chrono.HijrahDate` compared against the table.
- **SwiftUI previews** for every new widget and family; Android checked by screenshot (1b R12).
- **Device:** section 11 of the plan's last task (iOS simulator, then Android emulator booted only for that step).

## 11. Open checks that need a device or a phone

1. Bedtime started from a widget with the app not running: does ambient start alongside the surah when the app is launched in the background (iOS)? (simulator check, then phone)
2. Android: does the sleep timer fire with the app in the background? The timer is a JS `setInterval` and Android pauses JS timers in the background (noted in `syncWidgets.ts`); this is an existing app behavior that Bedtime inherits (P3-R9).
3. Does the Smart Stack rotate Bayaan Now in at the expected times? Relevance is a hint; only a phone used over days shows it.
4. Android `android.icu` Umm al-Qura agrees with Foundation on the device for today's date.

## 12. Rulings

Format: what; why; cost if wrong.

- **P3-R1. All eight roadmap items ship; five sub-features are deferred (section 2).** Why: each item's base feature exists or needs only curated data; the deferred parts each need app work (session tracking, headless adhkar audio, prayer times, a Hijri adjustment setting, end-of-surah timer). Cost if wrong: a deferred part can be added later without changing the Phase 3 contracts.
- **P3-R2. Phase 3 app data lives in a new `content.json` (`WidgetContent` v1), not in the snapshot or catalog.** Why: adding fields to `WidgetSnapshot` or `WidgetCatalog` touches 1a/1b decoders and tests on three platforms; content changes on its own triggers (playlists, downloads, sleep timer, reciter load). Cost if wrong: one more file and bridge function per platform; merging it later is mechanical.
- **P3-R3. Phase 3 kinds are a separate `ContentWidgetKind` list with separate change detection; `reloadWidgets` accepts both.** Why: keeps `widgetKinds.ts` and its "reloads everything / exact list" tests unchanged. Cost if wrong: two small functions instead of one.
- **P3-R4. Hijri dates use Umm al-Qura (iOS `.islamicUmmAlQura`, Android `android.icu` `ISLAMIC_UMALQURA`), from the Gregorian local day number, changing at local midnight, with no user adjustment.** Why: Umm al-Qura is the usual computed calendar and both OSes ship it; the app has no setting to offset it and no prayer times for a Maghrib boundary. Cost if wrong: users following local sighting see a date (and occasion windows) one day off near month starts; an adjustment setting is an app feature for later, and the logic already takes the day number as input.
- **P3-R5. Time windows are fixed clock hours (section 5.5).** Why: the app has no prayer times or location. Cost if wrong: windows feel early or late at high latitudes and across seasons; the hours are constants in one TS file and two mirrors pinned by vectors.
- **P3-R6. Occasions are the eight in section 5.4 with those windows; Jumu'ah ends at 18:00; Laylat al-Qadr is shown as the last ten nights; no Islamic New Year or Mawlid.** Why: well-established occasions with clear Quranic connections; Mawlid observance is contested and the new year has no specific practice. Cost if wrong: editing a window table (three mirrors, one vector file).
- **P3-R7. Occasion ayat are curated in `data/widgets/occasions.json` and generated like Ayah of the Day (at most 20 words).** Why: the app has no occasion data; reusing the 1b generator keeps Digital Khatt text and translations consistent. Cost if wrong: editing the source list and regenerating.
- **P3-R8. The Adhkar widget is a glance plus a deep link: period title, a daily featured dhikr from a curated list, the set's size. No progress, no audio.** Why: progress and audio need app work (section 2). Cost if wrong: a later version adds progress once per-session tracking exists.
- **P3-R9. Bedtime uses the app's existing sleep timer and ambient store unchanged: it starts the surah from the beginning, replaces any running timer, and an ambient choice becomes the app's current ambient sound (Off leaves it alone).** Why: the ambient store has no session-scoped override and `isEnabled` already resets on every launch; restarting the surah is what "bedtime" means. Known inherited limitation: the timer is a JS interval, which Android pauses in the background. Cost if wrong: on Android the timer may not stop playback with the screen off; the fix belongs in the player (native timer), not in the widget.
- **P3-R10. Playlists and Downloads are one configurable `LibraryShelf` widget; uploads are not shown as cards but are played by `playPlaylist`; a card starts the whole playlist at that item; at most 20 playlists of 8 cards are exported; playlist colors are ignored.** Why: one widget with a source picker is simpler than two near-identical kinds; the cap keeps `content.json` small; colors would break the fixed look. Cost if wrong: a second kind later reuses the same views.
- **P3-R11. Recently Played excludes uploads and resumes tracks at their saved position.** Why: `playTrack` cannot address uploads (surah id 1 to 114 only); resuming matches the in-app recent cards. Cost if wrong: uploads need a new command.
- **P3-R12. Reciter Spotlight rotates daily through featured, then Bayaan Originals, then trending reciters (deduplicated); play is `playReciter`; rows are up to 3 popular surahs the reciter has; all spotlight photos are cached.** Why: `reciterCollections.ts` already curates these lists in a stable order; caching about 20 photos (about 30 KB each) avoids dark tiles. Cost if wrong: changing the list function.
- **P3-R13. Bayaan Now composes existing views by mode (section 6.8); on Android the listening mode uses a new `NowPlayingCard` without optimistic state.** Why: the parent spec asks for composition; 1a's Android composables are private and 1a files are off limits. Cost if wrong: a small visual difference between platforms in one mode.
- **P3-R14. Relevance uses `TimelineEntryRelevance` on Bayaan Now, Adhkar, Hijri Date, Occasion and Bedtime; no RelevanceKit, no intent donation; Android has none.** Why: RelevanceKit widget relevance is watchOS only; donation would need app-target code. Cost if wrong: Smart Stack promotes Bayaan less often than hoped; scores are constants.
- **P3-R15. Hijri Date adds iOS Lock Screen inline and rectangular families; Android gets the home screen small widget only.** Why: same as 1b R5 (Android has no Lock Screen widgets). Cost if wrong: none.
- **P3-R16. Phase 3 widgets are grouped in a nested `ContentWidgets: WidgetBundle`, included from `BayaanWidgetsBundle` as `ContentWidgets().body`.** Why: a `WidgetBundleBuilder` takes at most 10 children and Phase 2 brings the main bundle to 10. Cost if wrong: if the nested `.body` does not compile, split into two nested bundles of fewer widgets each, the same pattern.
- **P3-R17. New commands `playPlaylist` and `startBedtime`; iOS intents live in a new `_shared/ContentIntents.swift`; Android reuses `WidgetCommandActivity` unchanged.** Why: Phase 2 rewrites `PlaybackIntents.swift`, so a separate file avoids conflicts; the activity already queues any non-`setPlayback` command and opens the app. Cost if wrong: none beyond one file.
- **P3-R18. Android date-driven widgets refresh through a new `ContextClockReceiver` at the next context boundary; 1b's `MidnightReceiver` is untouched.** Why: Phase 3 needs more than midnight (adhkar and Bayaan Now switch during the day). Cost if wrong: two inexact alarms instead of one.
- **P3-R19. Phase 3 work happens on `osmansaeday/widgets-3`, branched from `osmansaeday/widgets-2` after Phase 2's device verification; the PR targets `develop` after Phase 2 merges.** Why: Phase 3 edits files Phase 2 also edits (`WidgetsBundle.swift`, `syncWidgets.ts`, `generate-widget-data.ts`, `package.json`) and its Bedtime picker uses Phase 2's `_shared/SurahEntity.swift`. Cost if wrong: a rebase.
- **P3-R20. `tasbeehDisplayText` and `tasbeehTranslation` move to `services/widgets/dhikrText.ts` (no `@/` imports) and are re-exported from `buildCatalog.ts`.** Why: the generator script cannot import `buildCatalog.ts` (it imports the native module); 1b behavior and tests are unchanged. Cost if wrong: none.
- **P3-R21. Tap targets: shelves open their collection routes (`bayaan://collection/downloads`, `bayaan://collection/playlists`) or the player; Occasion opens the ayah in the reader; Hijri Date opens the app.** Why: `/playlist/[id]` exists in two tab groups, so a per-playlist link would be ambiguous. Cost if wrong: one URL per widget.

## 13. Risks not resolved by this spec

- Android JS timers pause in the background, so the existing sleep timer may not stop playback there (P3-R9, open check 2).
- Ambient plus recitation started by a background launch from an `AudioPlaybackIntent` is untested; if ambient does not start, Bedtime still plays the surah and sets the timer.
- The Umm al-Qura sanity anchor (1 Ramadan 1447 = 2026-02-18) and agreement between Foundation, `java.time` and `android.icu` are assumed; the table check and the device check catch a mismatch.
- `TimelineEntryRelevance` is a hint with opaque effect; it cannot be verified on a simulator.
- `ContentWidgets().body` nesting and the 10-child builder limit are taken from the SDK as understood (fallback in P3-R16).
- Large Glance layouts with 8 card bitmaps plus text may approach the RemoteViews size limit; cards are decoded at rendered size (1b `loadArtwork`), and the large Library layout drops captions if the limit is hit.
- A cold-start `playPlaylist` needs the SQLite playlists database open within the 60 s command window; it inherits 1a's background boot time open item.
