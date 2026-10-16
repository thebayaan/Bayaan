# Widgets Phase 3 (Content and Context) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Recently Played, Library Shelf (Downloads or a playlist), Bedtime, Adhkar, Hijri Date, Occasion, Reciter Spotlight and the Bayaan Now smart widget on iOS and Android, on top of the Phase 1 and Phase 2 widget plumbing.

**Architecture:** App data the new widgets need (downloads, playlists, spotlight reciters, sleep timer end) goes into a new versioned side document, `content.json`, written by a new `syncContentWidgets` service; adhkar and occasion data is generated at dev time and bundled; Hijri dates come from the OS Umm al-Qura calendar inside the widgets. Time and occasion rules are written once in TS (`contextRules.ts`) and mirrored in Swift and Kotlin, pinned by shared fixture vectors. Two new commands (`playPlaylist`, `startBedtime`) ride the existing command queue; Bayaan Now composes the other widgets' views by time of day, with `TimelineEntryRelevance` on iOS.

**Tech Stack:** Expo SDK 56, RN 0.83, TypeScript strict, Jest (jest-expo), tsx + better-sqlite3 (generator), Swift / SwiftUI / WidgetKit / AppIntents (iOS 17 extension, iOS 16.4 app), Foundation `Calendar(identifier: .islamicUmmAlQura)`, Kotlin / Jetpack Glance 1.1.1 / AlarmManager / `android.icu.util.IslamicCalendar` (Android), `java.time.chrono.HijrahDate` (JVM unit tests only).

**Spec:** `docs/superpowers/specs/2026-10-11-widgets-phase-3-design.md` (rulings P3-R1 to P3-R21 in its section 12). Parent spec: `docs/superpowers/specs/2026-10-08-widgets-design.md`. Conventions and the shared code this plan builds on: `docs/superpowers/plans/2026-10-10-widgets-phase-1b.md` and `docs/superpowers/plans/2026-10-11-widgets-phase-2.md`.

**Before Task 1:** Phase 2's device verification task must have landed on `osmansaeday/widgets-2`. Create a new worktree for branch `osmansaeday/widgets-3` from `osmansaeday/widgets-2` (superpowers:using-git-worktrees; never switch branches in the shared `widgets` worktree, other agents use it), run `npm ci` in it, copy the spec to `docs/superpowers/specs/2026-10-11-widgets-phase-3-design.md` and this plan to `docs/superpowers/plans/2026-10-11-widgets-phase-3.md`, and commit them with `git commit -m "docs: add widgets phase 3 spec and plan"`. All commands below run from that worktree's root. Confirm Phase 2's state before starting: `targets/widgets/_shared/SurahEntity.swift` exists, `package.json` `test:widget-fixtures` chains `scripts/check-widget-system-surfaces.sh`, and `WidgetsBundle.swift` lists the Live Activity and controls. If any is missing, stop and report: this plan assumes them.

## Global Constraints

- Branch `osmansaeday/widgets-3`; PRs target `develop` after Phase 2 merges (P3-R19). Conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`).
- Never use the em dash character anywhere (code, comments, copy, commits). Use a period, comma, colon or parentheses.
- Never use `theme.colors.primary` or any accent color. Palette (all widgets): background `#1C1C1E` (`WidgetPalette.background` / `WidgetColors.BACKGROUND`); text white; secondary white 75% (`0xBFFFFFFF`); tertiary white 60% (`0x99FFFFFF`); tiles white 15%; round buttons 30 pt/dp (`RoundIntentButton` / `RoundButton`); Bayaan mark top-right (`BayaanLogo` / `Logo`). User playlist colors are ignored.
- No time-left text on home screen widgets. The Bedtime sleep time is a clock time ("Sleep at 23:40"), not a countdown.
- Fonts: Quran text `WidgetFonts.quran` (`DigitalKhattNewMadinaRegular`) / `ArabicBitmap.QURAN_FONT`, centered, never justified; dhikr, Arabic month names and Arabic occasion names `WidgetFonts.dhikr` (`ScheherazadeNew-Regular`) / `ArabicBitmap.DHIKR_FONT`.
- Dates: day numbers, hours and weekdays always from the Gregorian calendar (`WidgetLogic.dayNumber`, `DayMath.dayNumber`, explicit `Calendar(identifier: .gregorian)` / `GregorianCalendar`). Hijri dates always from Umm al-Qura (`.islamicUmmAlQura` / `IslamicCalendar.CalculationType.ISLAMIC_UMALQURA`), converted from the local Gregorian day number at 12:00 UTC.
- TypeScript strict. No `any`, no `as` casts in non-test code (JSON goes through type guards). Explicit parameter and return types. `function` keyword for pure functions. No classes in TS.
- Do not edit `targets/widgets/ContinueListening/*`, `continuelistening/*`, `PlaybackState.kt`, `OverrideExpiryWorker.kt`, `WidgetCommandActivity.kt`, `MidnightReceiver.kt`, `widgetKinds.ts`, `snapshot.ts`, `catalog.ts`, any Phase 1 or Phase 2 test, or Phase 2's `_shared/PlaybackIntents.swift`. Reuse `ContinueListeningView`, `ContinueListeningEntry`, `EffectivePlayback`, `PlaybackOverrideStore` read-only.
- Files in `targets/widgets/_shared/` compile into the iOS 16.4 app and the iOS 17 extension: every App Intents type there carries `@available(iOS 17.0, *)`. Extension-only Swift goes in `targets/widgets/Support/` or a per-widget folder.
- Everything survives `npm run prebuild` (`expo prebuild --clean`). Never hand edit `ios/` or `android/`. Adding a file under `targets/widgets/` or `modules/bayaan-widgets/ios/` requires `npm run prebuild` before an iOS build. Commit regenerated native output only when prebuild changes tracked files.
- Widget kind strings (TS `ContentWidgetKind`, Swift `kind`, Android reload cases): `RecentlyPlayed`, `LibraryShelf`, `Bedtime`, `Adhkar`, `HijriDate`, `Occasion`, `ReciterSpotlight`, `BayaanNow`.
- Shared storage: iOS App Group file `widgets/content.json`; Android `bayaan_widgets` prefs key `content`; per-widget Android config under the existing `config.<appWidgetId>` keys.
- Commands that exist in this repo:
  - Typecheck: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`
  - Jest: `npx jest <path>` for one file or folder, `npm run test:ci -- --silent` for all
  - Swift fixture and logic checks: `npm run test:widget-fixtures`
  - Regenerate static widget data: `npm run generate:widget-data`
  - Regenerate Hijri and rule vectors (added in Task 3): `npm run generate:widget-vectors`
  - Prebuild: `npm run prebuild`
  - Android unit tests: `cd android && ./gradlew :bayaan-widgets:testReleaseUnitTest && cd ..`
  - Android build: `cd android && ./gradlew :app:assembleRelease && cd ..`
  - iOS build (Xcode 27; no global `IPHONEOS_DEPLOYMENT_TARGET`, it drags the iOS 17 extension down; apply the local `expo-modules-jsi` Swift patch from project memory if the build stops there, never commit it): `xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20`
  - Format: `npx prettier --write <changed ts/tsx/js files>` (JSON and Markdown are in `.prettierignore`)
- Before calling any task done: typecheck and prettier pass clean, and the task's tests pass.
- Host memory is tight: one `xcodebuild` or Gradle build at a time; no simulator or emulator interaction before Task 11; boot the Android emulator only in Task 11 and shut it down at the end of it.

## Review Focus

1. **Device calendar set to Hijri, or a time zone far from UTC near midnight.** Expect the Hijri date, the occasion and the adhkar period to follow the local Gregorian date and hour on all three platforms. Pinned by Task 3 `contextRules` vectors and the `America/New_York` / `Asia/Tokyo` cases added to Task 4 (Swift) and Task 5 (Kotlin).
2. **A configured playlist that was deleted, or that holds only uploads.** Expect "Playlist unavailable" for the first and "Open the playlist in Bayaan" with a working play-all button for the second, never a crash or an empty widget. Pinned by the `library` resolver cases in Tasks 4 and 5 (`playlist_2` in `content.full.json` has no cards) and the `playPlaylist` uploads test in Task 6.
3. **`content.json` missing (app not opened since the update) or from a future version.** Expect Library and Spotlight to say "Open Bayaan ...", Bedtime to keep working from its configuration, and Adhkar, Hijri Date and Occasion to be unaffected. Pinned by the content guard and decode tests in Tasks 2, 4 and 5 and the `noContent` resolver cases.
4. **A stale sleep timer end (app killed while a timer ran) or Bedtime tapped while a timer already runs.** Expect a past `sleepTimerEndsAt` to read as "no timer", and a new tap to replace the running timer and restart the configured surah. Pinned by `sleepActive` vectors (Tasks 3 to 5), `buildContent` "drops a past timer" (Task 6) and `startBedtime` tests (Task 6).
5. **A playlist card whose item was removed after the last content write, or a tap with no item at all.** Expect the playlist to play from its first item. Pinned by `rotateToItem` and `playPlaylist` tests in Task 6.

---

## File Structure

```
data/widgets/adhkar-periods.json            curated featured adhkar per period (source)
data/widgets/occasions.json                 curated occasion names and verse keys (source)
scripts/generate-widget-data.ts             (modified) also writes adhkar-periods.json, occasions.json
scripts/generate-hijri-table.swift          Foundation Umm al-Qura table, 2026-01-01 to 2028-12-31
scripts/generate-context-vectors.ts         next-occasions vectors from the TS reference
scripts/check-widget-content.sh             Phase 3 Swift checks
services/widgets/
  dhikrText.ts                              tasbeehDisplayText, tasbeehTranslation (moved, P3-R20)
  buildCatalog.ts                           (modified) imports and re-exports dhikrText
  widgetStaticData.ts                       (modified) adhkar period and occasion builders
  buildContent.ts                           pure: app state -> WidgetContent
  contentCommands.ts                        playPlaylist, startBedtime, runContentCommand
  syncContentWidgets.ts                     writes content.json, reloads, caches artwork
  syncWidgets.ts                            (modified) reloads Phase 3 kinds on snapshot changes
  handleWidgetCommand.ts                    (modified) routes new commands, exports playSurah
  __tests__/contentStaticData.test.ts, ambientSounds.test.ts, buildContent.test.ts,
  __tests__/contentCommands.test.ts, contentRouting.test.ts, syncContentWidgets.test.ts
modules/bayaan-widgets/src/
  content.ts                                WidgetContent types + guard
  contentKinds.ts                           ContentWidgetKind + change detection
  contextRules.ts                           time, occasion, Bayaan Now rules; Hijri table helpers
  commands.ts                               (modified) playPlaylist, startBedtime
  index.ts, NativeBayaanWidgets.ts          (modified) writeContent, wider reloadWidgets
  __fixtures__/content.full.json, context.vectors.json, hijri.table.json, next-occasions.vectors.json
  __tests__/content.test.ts, contentKinds.test.ts, contentCommandGuards.test.ts, contextRules.test.ts
modules/bayaan-widgets/ios/BayaanWidgetsModule.swift   (modified) writeContent
targets/widgets/
  adhkar-periods.json, occasions.json       generated
  _shared/ContentIntents.swift              PlayPlaylistIntent, StartBedtimeIntent
  Support/ContentModels.swift               Codable content, adhkar periods, occasions, HijriDate
  Support/ContentLogic.swift                rules, Hijri, resolvers, text helpers (pure Foundation)
  Support/ContentStores.swift               ContentStore, ContentStaticData
  Support/ContentEntities.swift             LibrarySourceEntity, SleepMinutesOption, AmbientOption
  Support/ContentChrome.swift               ShelfHeader, SurahTileButton, ContentMessage
  RecentlyPlayed/RecentlyPlayedWidget.swift
  LibraryShelf/LibraryShelfWidget.swift
  Bedtime/BedtimeWidget.swift
  Spotlight/ReciterSpotlightWidget.swift
  Adhkar/AdhkarWidget.swift
  Hijri/HijriDateWidget.swift, Hijri/OccasionWidget.swift
  BayaanNow/BayaanNowWidget.swift
  ContentWidgets.swift                      nested WidgetBundle (P3-R16)
  WidgetsBundle.swift                       (modified) includes ContentWidgets().body
modules/bayaan-widgets/android/src/main/
  assets/widgets/adhkar-periods.json, occasions.json   generated
  res/xml/{recently_played,library_shelf,bedtime,adhkar,hijri_date,occasion,reciter_spotlight,bayaan_now}_info.xml
  res/drawable/widget_moon.xml
  java/expo/modules/bayaanwidgets/
    ContentModels.kt, ContentLogic.kt, ContentConfig.kt, IcuHijri.kt, ContextClockReceiver.kt
    ui/ContentUi.kt
    recentlyplayed/, libraryshelf/, bedtime/, spotlight/, adhkar/, hijri/, bayaannow/
    (modified) WidgetStorage.kt, GlanceState.kt, BayaanWidgetsModule.kt
  AndroidManifest.xml, res/values/strings.xml          (modified)
modules/bayaan-widgets/android/src/test/java/expo/modules/bayaanwidgets/ContentLogicTest.kt
app/_layout.tsx                              (modified) starts syncContentWidgets
package.json                                 (modified) test:widget-fixtures chain, generate:widget-vectors
```

Task order: 1 static data, 2 TS contracts, 3 rules and vectors, 4 iOS bridge and Swift support, 5 Android support, 6 JS glue, 7 Recently Played and Library Shelf, 8 Bedtime and Reciter Spotlight, 9 Adhkar, Hijri Date and Occasion, 10 Bayaan Now, 11 device verification. Native `writeContent` lands (Tasks 4 and 5) before JS calls it (Task 6). Android reload cases and `ContextClockReceiver` targets are added by the widget task that creates each widget, so every task compiles on its own.

---

### Task 1: Static content data (adhkar periods and occasions)

**Files:**
- Create: `data/widgets/adhkar-periods.json`, `data/widgets/occasions.json`, `services/widgets/dhikrText.ts`, `services/widgets/__tests__/contentStaticData.test.ts`
- Modify: `services/widgets/buildCatalog.ts`, `services/widgets/widgetStaticData.ts`, `scripts/generate-widget-data.ts`
- Generated (commit): `targets/widgets/adhkar-periods.json`, `targets/widgets/occasions.json`, `modules/bayaan-widgets/android/src/main/assets/widgets/adhkar-periods.json`, `modules/bayaan-widgets/android/src/main/assets/widgets/occasions.json`

**Interfaces:**
- Consumes: `buildStaticAyat(keys, src)`, `AyahSources`, `StaticAyah` from `widgetStaticData.ts` (1b).
- Produces (later tasks rely on these JSON shapes and names):
  - `adhkar-periods.json`: `{"morning": AdhkarPeriodData, "evening": AdhkarPeriodData}` with `AdhkarPeriodData = {period: 'morning' | 'evening', superId: string, title: string, arabicTitle: string, count: number, featured: {id: string, arabic: string, translation: string | null, repeatCount: number}[]}`
  - `occasions.json`: `{"months": {number, name, arabic}[12], "occasions": {id, name, arabicName, listenSurahId: number | null, ayat: StaticAyah[]}[8]}`; occasion ids exactly `eidFitr, arafah, eidAdha, lastTen, ramadan, dhulHijjah, ashura, jumuah`
  - `services/widgets/dhikrText.ts`: `tasbeehDisplayText(arabic: string): string | null`, `tasbeehTranslation(translation: string | null): string | null`

- [ ] **Step 1: Write the curated sources**

`data/widgets/adhkar-periods.json` (ids are `data/adhkar.json` category 27 entries; 95 is said in the morning, 97 in the evening; the "أصبحنا / أمسينا" entries are excluded because the seed carries only the morning wording):

```json
{
  "morning": {
    "superId": "morning-adhkar",
    "title": "Morning Adhkar",
    "arabicTitle": "أذكار الصباح",
    "categoryId": "27",
    "featured": ["83", "86", "87", "88", "91", "92", "94", "95", "96", "98"]
  },
  "evening": {
    "superId": "evening-adhkar",
    "title": "Evening Adhkar",
    "arabicTitle": "أذكار المساء",
    "categoryId": "27",
    "featured": ["83", "86", "87", "88", "91", "92", "94", "96", "97", "98"]
  }
}
```

`data/widgets/occasions.json` (order is display priority; windows live in code, Task 3):

```json
{
  "months": [
    {"number": 1, "name": "Muharram", "arabic": "محرم"},
    {"number": 2, "name": "Safar", "arabic": "صفر"},
    {"number": 3, "name": "Rabi al-Awwal", "arabic": "ربيع الأول"},
    {"number": 4, "name": "Rabi al-Thani", "arabic": "ربيع الآخر"},
    {"number": 5, "name": "Jumada al-Ula", "arabic": "جمادى الأولى"},
    {"number": 6, "name": "Jumada al-Akhirah", "arabic": "جمادى الآخرة"},
    {"number": 7, "name": "Rajab", "arabic": "رجب"},
    {"number": 8, "name": "Sha'ban", "arabic": "شعبان"},
    {"number": 9, "name": "Ramadan", "arabic": "رمضان"},
    {"number": 10, "name": "Shawwal", "arabic": "شوال"},
    {"number": 11, "name": "Dhu al-Qadah", "arabic": "ذو القعدة"},
    {"number": 12, "name": "Dhu al-Hijjah", "arabic": "ذو الحجة"}
  ],
  "occasions": [
    {"id": "eidFitr", "name": "Eid al-Fitr", "arabicName": "عيد الفطر", "listenSurahId": null, "keys": ["10:58", "87:14", "87:15"]},
    {"id": "arafah", "name": "Day of Arafah", "arabicName": "يوم عرفة", "listenSurahId": null, "keys": ["2:199", "2:201"]},
    {"id": "eidAdha", "name": "Eid al-Adha", "arabicName": "عيد الأضحى", "listenSurahId": null, "keys": ["108:1", "108:2", "108:3"]},
    {"id": "lastTen", "name": "The Last Ten Nights", "arabicName": "العشر الأواخر", "listenSurahId": null, "keys": ["97:1", "97:2", "97:3", "97:4", "97:5", "44:3"]},
    {"id": "ramadan", "name": "Ramadan", "arabicName": "رمضان", "listenSurahId": null, "keys": ["2:183", "2:186", "97:1", "97:3"]},
    {"id": "dhulHijjah", "name": "The Ten Days of Dhul Hijjah", "arabicName": "عشر ذي الحجة", "listenSurahId": null, "keys": ["89:1", "89:2", "22:27"]},
    {"id": "ashura", "name": "Ashura", "arabicName": "عاشوراء", "listenSurahId": null, "keys": ["26:62", "26:63"]},
    {"id": "jumuah", "name": "Jumu'ah", "arabicName": "الجمعة", "listenSurahId": 18, "keys": ["18:10", "18:1"]}
  ]
}
```

- [ ] **Step 2: Move the dhikr text helpers**

Create `services/widgets/dhikrText.ts` by moving `withoutParentheticals`, `firstGroup`, `tasbeehDisplayText` and `tasbeehTranslation` out of `services/widgets/buildCatalog.ts` unchanged:

```ts
// services/widgets/dhikrText.ts
// Dhikr text cleanup shared by the Tasbeeh catalog and the generated adhkar
// data. Imported by scripts/generate-widget-data.ts, so no '@/' imports here.

function withoutParentheticals(text: string): string {
  return text
    .replace(/\([^()]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Content of the first balanced (...) group, or the text itself.
function firstGroup(text: string): string {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth += 1;
    if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) return text.slice(1, i);
    }
  }
  return text;
}

// The dhikr itself: the text inside (( )) without counts like (ثلاثاً).
export function tasbeehDisplayText(arabic: string): string | null {
  const text = arabic.trim();
  const end = text.lastIndexOf('))');
  if (!text.startsWith('((') || end <= 2) return null;
  const inner = withoutParentheticals(text.slice(2, end)).replace(
    /[\s.،,:]+$/,
    '',
  );
  return inner || null;
}

export function tasbeehTranslation(translation: string | null): string | null {
  if (translation === null) return null;
  let text = translation.trim();
  if (text.startsWith('(')) text = firstGroup(text);
  const cleaned = withoutParentheticals(text)
    .replace(/^[‘’'"]+|[‘’'"]+$/g, '')
    .trim();
  return cleaned || null;
}
```

In `services/widgets/buildCatalog.ts`, delete those four functions and add below the existing imports:

```ts
import {tasbeehDisplayText, tasbeehTranslation} from './dhikrText';

export {tasbeehDisplayText, tasbeehTranslation} from './dhikrText';
```

Run: `npx jest services/widgets/__tests__/buildCatalog.test.ts`
Expected: PASS (unchanged 1b tests).

- [ ] **Step 3: Write the failing builder tests**

```ts
// services/widgets/__tests__/contentStaticData.test.ts
import fs from 'fs';
import path from 'path';
import {
  AdhkarPeriodSource,
  AdhkarSeedRow,
  AyahSources,
  buildAdhkarPeriods,
  buildOccasionData,
  isAdhkarPeriodSources,
  isOccasionsSource,
  OccasionsSource,
  OCCASION_IDS,
  parseAdhkarSeed,
} from '../widgetStaticData';

const root = path.resolve(__dirname, '../../..');

function readJson(rel: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

const seed: AdhkarSeedRow[] = [
  {id: '1', category_id: '27', arabic: '((سُبْحَانَ اللَّهِ)) (ثلاثاً).', translation: "'Glory be to Allah.'", repeat_count: 3},
  {id: '2', category_id: '27', arabic: '((الْحَمْدُ لِلَّهِ))', translation: null, repeat_count: 1},
  {id: '3', category_id: '28', arabic: '((بِاسْمِكَ))', translation: null, repeat_count: 1},
  {id: '4', category_id: '27', arabic: 'no brackets here', translation: null, repeat_count: 1},
];

function periods(morning: string[], evening: string[]): Record<'morning' | 'evening', AdhkarPeriodSource> {
  return {
    morning: {superId: 'morning-adhkar', title: 'Morning Adhkar', arabicTitle: 'أذكار الصباح', categoryId: '27', featured: morning},
    evening: {superId: 'evening-adhkar', title: 'Evening Adhkar', arabicTitle: 'أذكار المساء', categoryId: '27', featured: evening},
  };
}

const ayahSources: AyahSources = {
  words: () => ['قُلْ', 'هُوَ', '۝١'],
  translation: () => 'Say, He.',
  surahName: () => 'Al-Ikhlas',
};

function occasionsSource(): OccasionsSource {
  return {
    months: Array.from({length: 12}, (_, i) => ({number: i + 1, name: `M${i + 1}`, arabic: `م${i + 1}`})),
    occasions: OCCASION_IDS.map(id => ({id, name: id, arabicName: id, listenSurahId: id === 'jumuah' ? 18 : null, keys: ['112:1']})),
  };
}

describe('buildAdhkarPeriods', () => {
  it('cleans featured adhkar and counts the category', () => {
    const out = buildAdhkarPeriods(periods(['1'], ['2', '1']), seed);
    expect(out.morning).toEqual({
      period: 'morning',
      superId: 'morning-adhkar',
      title: 'Morning Adhkar',
      arabicTitle: 'أذكار الصباح',
      count: 3,
      featured: [{id: '1', arabic: 'سُبْحَانَ اللَّهِ', translation: 'Glory be to Allah.', repeatCount: 3}],
    });
    expect(out.evening.featured.map(f => f.id)).toEqual(['2', '1']);
    expect(out.evening.featured[0].translation).toBeNull();
  });

  it('rejects ids outside the category, text without (( )), and empty lists', () => {
    expect(() => buildAdhkarPeriods(periods(['3'], ['1']), seed)).toThrow('not in category 27');
    expect(() => buildAdhkarPeriods(periods(['4'], ['1']), seed)).toThrow('no (( )) text');
    expect(() => buildAdhkarPeriods(periods([], ['1']), seed)).toThrow('no featured adhkar');
  });

  it('rejects text longer than 180 characters', () => {
    const long = [...seed, {id: '9', category_id: '27', arabic: `((${'ا'.repeat(181)}))`, translation: null, repeat_count: 1}];
    expect(() => buildAdhkarPeriods(periods(['9'], ['1']), long)).toThrow('too long');
  });
});

describe('buildOccasionData', () => {
  it('builds every occasion with its ayat', () => {
    const out = buildOccasionData(occasionsSource(), ayahSources);
    expect(out.months).toHaveLength(12);
    expect(out.occasions.map(o => o.id)).toEqual([...OCCASION_IDS]);
    expect(out.occasions[7].listenSurahId).toBe(18);
    expect(out.occasions[0].ayat[0]).toEqual({
      key: '112:1', surahId: 112, ayah: 1, surahName: 'Al-Ikhlas', arabic: 'قُلْ هُوَ ۝١', translation: 'Say, He.',
    });
  });

  it('requires 12 months in order and exactly the known occasion ids', () => {
    const badMonths = {...occasionsSource(), months: occasionsSource().months.slice(1)};
    expect(() => buildOccasionData(badMonths, ayahSources)).toThrow('months');
    const missing = {...occasionsSource(), occasions: occasionsSource().occasions.slice(1)};
    expect(() => buildOccasionData(missing, ayahSources)).toThrow('occasions must be exactly');
  });
});

describe('source guards', () => {
  it('accept the committed sources and reject junk', () => {
    expect(isAdhkarPeriodSources(readJson('data/widgets/adhkar-periods.json'))).toBe(true);
    expect(isOccasionsSource(readJson('data/widgets/occasions.json'))).toBe(true);
    expect(isAdhkarPeriodSources({morning: {}})).toBe(false);
    expect(isOccasionsSource({months: [], occasions: [{id: 1}]})).toBe(false);
    expect(parseAdhkarSeed(readJson('data/adhkar.json')).length).toBeGreaterThan(400);
    expect(parseAdhkarSeed({adhkar: 'nope'})).toEqual([]);
  });
});

describe('generated content data', () => {
  const ios = 'targets/widgets';
  const android = 'modules/bayaan-widgets/android/src/main/assets/widgets';

  it('is identical on both platforms', () => {
    for (const name of ['adhkar-periods.json', 'occasions.json']) {
      expect(fs.readFileSync(path.join(root, ios, name), 'utf8')).toBe(
        fs.readFileSync(path.join(root, android, name), 'utf8'),
      );
    }
  });

  it('matches the sources (run npm run generate:widget-data after editing them)', () => {
    const source = readJson('data/widgets/adhkar-periods.json');
    if (!isAdhkarPeriodSources(source)) throw new Error('bad adhkar source');
    const expected = buildAdhkarPeriods(source, parseAdhkarSeed(readJson('data/adhkar.json')));
    expect(readJson(`${ios}/adhkar-periods.json`)).toEqual(expected);
    expect(expected.morning.count).toBe(24);

    const occ = readJson('data/widgets/occasions.json');
    if (!isOccasionsSource(occ)) throw new Error('bad occasions source');
    const generated = readJson(`${ios}/occasions.json`) as {
      months: unknown[];
      occasions: {id: string; ayat: {key: string; arabic: string}[]}[];
    };
    expect(generated.months).toEqual(occ.months);
    expect(generated.occasions.map(o => [o.id, o.ayat.map(a => a.key)])).toEqual(
      occ.occasions.map(o => [o.id, o.keys]),
    );
    for (const o of generated.occasions) {
      for (const a of o.ayat) expect(a.arabic.split(' ').pop()?.startsWith('۝')).toBe(true);
    }
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx jest services/widgets/__tests__/contentStaticData.test.ts`
Expected: FAIL with "buildAdhkarPeriods is not a function" (or a TS error that the exports do not exist).

- [ ] **Step 5: Add the builders**

Append to `services/widgets/widgetStaticData.ts` (keep its existing contents; add the import at the top next to the existing one):

```ts
import {tasbeehDisplayText, tasbeehTranslation} from './dhikrText';
```

```ts
// ---- Phase 3: adhkar periods and occasions -------------------------------

export type AdhkarPeriodName = 'morning' | 'evening';

export interface FeaturedDhikr {
  id: string;
  arabic: string;
  translation: string | null;
  repeatCount: number;
}

export interface AdhkarPeriodData {
  period: AdhkarPeriodName;
  superId: string;
  title: string;
  arabicTitle: string;
  count: number; // adhkar in the category
  featured: FeaturedDhikr[];
}

export interface AdhkarPeriods {
  morning: AdhkarPeriodData;
  evening: AdhkarPeriodData;
}

export interface AdhkarPeriodSource {
  superId: string;
  title: string;
  arabicTitle: string;
  categoryId: string;
  featured: string[];
}

export interface AdhkarSeedRow {
  id: string;
  category_id: string;
  arabic: string;
  translation: string | null;
  repeat_count: number;
}

export interface HijriMonthName {
  number: number;
  name: string;
  arabic: string;
}

export interface OccasionSource {
  id: string;
  name: string;
  arabicName: string;
  listenSurahId: number | null;
  keys: string[];
}

export interface OccasionsSource {
  months: HijriMonthName[];
  occasions: OccasionSource[];
}

export interface OccasionInfo {
  id: string;
  name: string;
  arabicName: string;
  listenSurahId: number | null;
  ayat: StaticAyah[];
}

export interface OccasionData {
  months: HijriMonthName[];
  occasions: OccasionInfo[];
}

export const MAX_FEATURED_DHIKR_CHARS = 180;
// Same ids and order as OCCASION_WINDOWS + jumuah in contextRules.ts.
export const OCCASION_IDS = [
  'eidFitr',
  'arafah',
  'eidAdha',
  'lastTen',
  'ramadan',
  'dhulHijjah',
  'ashura',
  'jumuah',
] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string');
}

function isPeriodSource(value: unknown): value is AdhkarPeriodSource {
  return (
    isObject(value) &&
    typeof value.superId === 'string' &&
    typeof value.title === 'string' &&
    typeof value.arabicTitle === 'string' &&
    typeof value.categoryId === 'string' &&
    isStringList(value.featured)
  );
}

export function isAdhkarPeriodSources(
  value: unknown,
): value is Record<AdhkarPeriodName, AdhkarPeriodSource> {
  return (
    isObject(value) &&
    isPeriodSource(value.morning) &&
    isPeriodSource(value.evening)
  );
}

function isSeedRow(value: unknown): value is AdhkarSeedRow {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.category_id === 'string' &&
    typeof value.arabic === 'string' &&
    (value.translation === null || typeof value.translation === 'string') &&
    typeof value.repeat_count === 'number'
  );
}

export function parseAdhkarSeed(seed: unknown): AdhkarSeedRow[] {
  if (!isObject(seed) || !Array.isArray(seed.adhkar)) return [];
  const rows: unknown[] = seed.adhkar;
  return rows.filter(isSeedRow);
}

function isMonth(value: unknown): value is HijriMonthName {
  return (
    isObject(value) &&
    typeof value.number === 'number' &&
    typeof value.name === 'string' &&
    typeof value.arabic === 'string'
  );
}

function isOccasionSource(value: unknown): value is OccasionSource {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.arabicName === 'string' &&
    (value.listenSurahId === null || typeof value.listenSurahId === 'number') &&
    isStringList(value.keys)
  );
}

export function isOccasionsSource(value: unknown): value is OccasionsSource {
  return (
    isObject(value) &&
    Array.isArray(value.months) &&
    value.months.every(isMonth) &&
    Array.isArray(value.occasions) &&
    value.occasions.every(isOccasionSource)
  );
}

export function buildAdhkarPeriods(
  source: Record<AdhkarPeriodName, AdhkarPeriodSource>,
  seed: AdhkarSeedRow[],
): AdhkarPeriods {
  function period(name: AdhkarPeriodName): AdhkarPeriodData {
    const src = source[name];
    const inCategory = seed.filter(d => d.category_id === src.categoryId);
    if (src.featured.length === 0) {
      throw new Error(`${name} has no featured adhkar`);
    }
    const featured = src.featured.map(id => {
      const row = inCategory.find(d => d.id === id);
      if (!row) {
        throw new Error(`${name}: dhikr ${id} is not in category ${src.categoryId}`);
      }
      const arabic = tasbeehDisplayText(row.arabic);
      if (!arabic) throw new Error(`${name}: dhikr ${id} has no (( )) text`);
      if (arabic.length > MAX_FEATURED_DHIKR_CHARS) {
        throw new Error(`${name}: dhikr ${id} is too long`);
      }
      return {
        id,
        arabic,
        translation: tasbeehTranslation(row.translation),
        repeatCount: row.repeat_count,
      };
    });
    return {
      period: name,
      superId: src.superId,
      title: src.title,
      arabicTitle: src.arabicTitle,
      count: inCategory.length,
      featured,
    };
  }
  return {morning: period('morning'), evening: period('evening')};
}

export function buildOccasionData(
  source: OccasionsSource,
  src: AyahSources,
): OccasionData {
  if (
    source.months.length !== 12 ||
    source.months.some((m, i) => m.number !== i + 1)
  ) {
    throw new Error('months must list 1 to 12 in order');
  }
  const ids = source.occasions.map(o => o.id);
  if (JSON.stringify(ids) !== JSON.stringify(OCCASION_IDS)) {
    throw new Error(`occasions must be exactly ${OCCASION_IDS.join(', ')}`);
  }
  return {
    months: source.months,
    occasions: source.occasions.map(o => ({
      id: o.id,
      name: o.name,
      arabicName: o.arabicName,
      listenSurahId: o.listenSurahId,
      ayat: buildStaticAyat(o.keys, src),
    })),
  };
}
```

- [ ] **Step 6: Run the unit tests**

Run: `npx jest services/widgets/__tests__/contentStaticData.test.ts -t "buildAdhkarPeriods|buildOccasionData|source guards"`
Expected: PASS (the "generated content data" tests still fail until Step 8).

- [ ] **Step 7: Extend the generator**

In `scripts/generate-widget-data.ts`:

1. Update the header comment's file list with:
```ts
//   adhkar-periods.json  morning and evening adhkar with a curated featured list
//   occasions.json       Hijri month names and occasion ayat (Digital Khatt + Saheeh)
```
2. Extend the import from `../services/widgets/widgetStaticData` with `buildAdhkarPeriods, buildOccasionData, isAdhkarPeriodSources, isOccasionsSource, parseAdhkarSeed`.
3. In `main()`, the existing `buildStaticAyat(keys, {...})` call passes an inline sources object. Pull it into a constant just above that call and pass the constant, so the occasions reuse it:
```ts
  const ayahSources = {
    words: (surahId: number, ayah: number) =>
      wordsStmt.all(surahId, ayah).map(textOf).filter(Boolean),
    translation: (key: string) => saheehText(saheeh, key),
    surahName: (surahId: number) => SURAHS[surahId - 1]?.name,
  };
  const ayat = buildStaticAyat(keys, ayahSources);
```
4. Directly after `const surahs = buildStaticSurahs(SURAHS, surahGlyphMap);` add:
```ts
  const periodSource = readJson('data/widgets/adhkar-periods.json');
  if (!isAdhkarPeriodSources(periodSource)) {
    throw new Error('data/widgets/adhkar-periods.json is malformed');
  }
  const adhkarPeriods = buildAdhkarPeriods(
    periodSource,
    parseAdhkarSeed(readJson('data/adhkar.json')),
  );
  const occasionSource = readJson('data/widgets/occasions.json');
  if (!isOccasionsSource(occasionSource)) {
    throw new Error('data/widgets/occasions.json is malformed');
  }
  const occasions = buildOccasionData(occasionSource, ayahSources);
```
5. Inside the `for (const dir of OUTPUT_DIRS)` loop, after the `surahs.json` write, add:
```ts
    fs.writeFileSync(
      path.join(abs, 'adhkar-periods.json'),
      `${JSON.stringify(adhkarPeriods)}\n`,
    );
    fs.writeFileSync(
      path.join(abs, 'occasions.json'),
      `${JSON.stringify(occasions)}\n`,
    );
```
6. Replace the final `console.log` with:
```ts
  console.log(
    `[generate-widget-data] ${ayat.length} ayat, ${surahs.length} surahs, ${occasions.occasions.length} occasions, 2 adhkar periods`,
  );
```
Leave any Phase 2 output (for example `SurahCatalog.swift`) as it is.

- [ ] **Step 8: Generate and run all tests**

Run: `npm run generate:widget-data`
Expected: `[generate-widget-data] 390 ayat, 114 surahs, 8 occasions, 2 adhkar periods`. If it throws `<key> has N words, max 20`, delete that key from its list in `data/widgets/occasions.json` (every list keeps at least two keys) and rerun; if it throws for an adhkar id, remove that id from `data/widgets/adhkar-periods.json`. Do not raise `MAX_AYAH_WORDS`.

Run: `npx jest services/widgets/__tests__/contentStaticData.test.ts services/widgets/__tests__/widgetStaticData.test.ts services/widgets/__tests__/buildCatalog.test.ts`
Expected: PASS.

Run: `git status --short` and confirm the only regenerated files are the four new JSON files (plus any Phase 2 generated file left byte-identical).

- [ ] **Step 9: Typecheck, format, commit**

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
npx prettier --write services/widgets/dhikrText.ts services/widgets/buildCatalog.ts services/widgets/widgetStaticData.ts services/widgets/__tests__/contentStaticData.test.ts scripts/generate-widget-data.ts
git add data/widgets/adhkar-periods.json data/widgets/occasions.json services/widgets/dhikrText.ts services/widgets/buildCatalog.ts services/widgets/widgetStaticData.ts services/widgets/__tests__/contentStaticData.test.ts scripts/generate-widget-data.ts targets/widgets/adhkar-periods.json targets/widgets/occasions.json modules/bayaan-widgets/android/src/main/assets/widgets/adhkar-periods.json modules/bayaan-widgets/android/src/main/assets/widgets/occasions.json
git commit -m "feat(widgets): generate adhkar period and occasion data"
```

---
### Task 2: Module TS contracts (content document, commands, content kinds)

**Files:**
- Create: `modules/bayaan-widgets/src/content.ts`, `modules/bayaan-widgets/src/contentKinds.ts`, `modules/bayaan-widgets/src/__fixtures__/content.full.json`, `modules/bayaan-widgets/src/__tests__/content.test.ts`, `modules/bayaan-widgets/src/__tests__/contentKinds.test.ts`, `modules/bayaan-widgets/src/__tests__/contentCommandGuards.test.ts`, `services/widgets/__tests__/ambientSounds.test.ts`
- Modify: `modules/bayaan-widgets/src/commands.ts`, `modules/bayaan-widgets/src/index.ts`, `modules/bayaan-widgets/src/NativeBayaanWidgets.ts`

**Interfaces:**
- Consumes: `isRecord`, `isNullableString` (`guards.ts`); `changedWidgetKinds`, `WidgetKind` (`widgetKinds.ts`); `WidgetSnapshot` (`snapshot.ts`).
- Produces:
  - `content.ts`: `WIDGET_CONTENT_VERSION = 1`, `SHELF_ITEM_LIMIT = 8`, `PLAYLIST_LIMIT = 20`, types `WidgetShelfItem`, `WidgetPlaylist`, `WidgetSpotlightReciter`, `WidgetContent`, guard `isWidgetContent(value: unknown): value is WidgetContent`
  - `commands.ts`: `WIDGET_AMBIENT_SOUNDS` (`readonly ['rain','forest','ocean','stream','thunder','fireplace','wind']`), `type WidgetAmbientSound`, new `WidgetCommand` members `{type: 'playPlaylist'; playlistId: string; itemId: string | null}` and `{type: 'startBedtime'; surahId: number; reciterId: string | null; sleepMinutes: number; ambient: WidgetAmbientSound | null}`
  - `contentKinds.ts`: `type ContentWidgetKind`, `ALL_CONTENT_WIDGET_KINDS`, `changedContentKindsForSnapshot(prev: WidgetSnapshot | null, next: WidgetSnapshot): ContentWidgetKind[]`, `changedContentKindsForContent(prev: WidgetContent | null, next: WidgetContent): ContentWidgetKind[]`
  - `index.ts`: `writeContent(content: WidgetContent): void`, `reloadWidgets(kinds: ReadonlyArray<WidgetKind | ContentWidgetKind>): void`
  - Native interface: `writeContent(json: string): void` (implemented in Tasks 4 and 5)
  - Fixture `content.full.json` (used by Swift and Kotlin tests in Tasks 4 and 5)

- [ ] **Step 1: Write the shared fixture**

`modules/bayaan-widgets/src/__fixtures__/content.full.json` (keep `"version": 1` spelled with one space; native tests replace that exact text):

```json
{
  "version": 1,
  "generatedAt": 1791460800000,
  "downloads": [
    {"surahId": 67, "surahName": "Al-Mulk", "reciterId": "r-alafasi", "reciterName": "Mishary Alafasi", "rewayatId": "rw-1", "itemId": null},
    {"surahId": 18, "surahName": "Al-Kahf", "reciterId": "r-minshawi", "reciterName": "Mohammed Siddiq Al-Minshawi", "rewayatId": "rw-9", "itemId": null}
  ],
  "downloadCount": 12,
  "playlists": [
    {
      "id": "playlist_1",
      "name": "Night",
      "itemCount": 3,
      "items": [
        {"surahId": 67, "surahName": "Al-Mulk", "reciterId": "r-alafasi", "reciterName": "Mishary Alafasi", "rewayatId": null, "itemId": "item_1"},
        {"surahId": 32, "surahName": "As-Sajdah", "reciterId": "r-alafasi", "reciterName": "Mishary Alafasi", "rewayatId": null, "itemId": "item_2"}
      ]
    },
    {"id": "playlist_2", "name": "Uploads only", "itemCount": 2, "items": []}
  ],
  "spotlight": [
    {"id": "r-basfar", "name": "Albaraa Basfar", "artworkFile": "reciter-r-basfar.jpg", "surahIds": [1, 18, 36]},
    {"id": "r-balilah", "name": "Bandar Balilah", "artworkFile": "reciter-r-balilah.jpg", "surahIds": [1]}
  ],
  "sleepTimerEndsAt": 1791462600000
}
```

- [ ] **Step 2: Write the failing tests**

```ts
// modules/bayaan-widgets/src/__tests__/content.test.ts
import content from '../__fixtures__/content.full.json';
import {isWidgetContent, WIDGET_CONTENT_VERSION} from '../content';

describe('isWidgetContent', () => {
  it('accepts the shared fixture', () => {
    expect(isWidgetContent(content)).toBe(true);
  });

  it('accepts no sleep timer', () => {
    expect(isWidgetContent({...content, sleepTimerEndsAt: null})).toBe(true);
  });

  it('rejects a future version', () => {
    expect(isWidgetContent({...content, version: WIDGET_CONTENT_VERSION + 1})).toBe(false);
  });

  it('rejects malformed entries', () => {
    expect(isWidgetContent({...content, downloads: [{surahId: '67'}]})).toBe(false);
    expect(isWidgetContent({...content, playlists: [{id: 'p', name: 'n', itemCount: 1, items: [{}]}]})).toBe(false);
    expect(isWidgetContent({...content, spotlight: [{id: 'r', name: 'n', artworkFile: 'f', surahIds: ['1']}]})).toBe(false);
    expect(isWidgetContent({...content, sleepTimerEndsAt: 'soon'})).toBe(false);
    expect(isWidgetContent(null)).toBe(false);
  });
});
```

```ts
// modules/bayaan-widgets/src/__tests__/contentCommandGuards.test.ts
import {isWidgetCommand, parseQueuedCommands, selectFreshCommands} from '../commands';

describe('Phase 3 command guards', () => {
  it('accepts playPlaylist with or without an item', () => {
    expect(isWidgetCommand({type: 'playPlaylist', playlistId: 'playlist_1', itemId: 'item_2'})).toBe(true);
    expect(isWidgetCommand({type: 'playPlaylist', playlistId: 'playlist_1', itemId: null})).toBe(true);
    expect(isWidgetCommand({type: 'playPlaylist', playlistId: '', itemId: null})).toBe(false);
    expect(isWidgetCommand({type: 'playPlaylist', playlistId: 'p'})).toBe(false);
  });

  it('accepts startBedtime with valid values only', () => {
    const ok = {type: 'startBedtime', surahId: 67, reciterId: null, sleepMinutes: 30, ambient: 'rain'};
    expect(isWidgetCommand(ok)).toBe(true);
    expect(isWidgetCommand({...ok, ambient: null, reciterId: 'r1'})).toBe(true);
    expect(isWidgetCommand({...ok, ambient: 'waves'})).toBe(false);
    expect(isWidgetCommand({...ok, surahId: 115})).toBe(false);
    expect(isWidgetCommand({...ok, sleepMinutes: 0})).toBe(false);
    expect(isWidgetCommand({...ok, sleepMinutes: 241})).toBe(false);
    expect(isWidgetCommand({...ok, sleepMinutes: 12.5})).toBe(false);
  });

  it('treats the new commands as play commands (last play wins)', () => {
    const queued = parseQueuedCommands(JSON.stringify([
      {command: {type: 'playTrack', surahId: 1, reciterId: null, rewayatId: null, ayah: null}, enqueuedAt: 1},
      {command: {type: 'startBedtime', surahId: 67, reciterId: null, sleepMinutes: 30, ambient: null}, enqueuedAt: 2},
    ]));
    expect(selectFreshCommands(queued, 3)).toEqual([
      {type: 'startBedtime', surahId: 67, reciterId: null, sleepMinutes: 30, ambient: null},
    ]);
  });
});
```

```ts
// modules/bayaan-widgets/src/__tests__/contentKinds.test.ts
import snapshotFull from '../__fixtures__/snapshot.full.json';
import contentFull from '../__fixtures__/content.full.json';
import type {WidgetSnapshot} from '../snapshot';
import type {WidgetContent} from '../content';
import {
  ALL_CONTENT_WIDGET_KINDS,
  changedContentKindsForContent,
  changedContentKindsForSnapshot,
} from '../contentKinds';

function snap(): WidgetSnapshot {
  return structuredClone(snapshotFull) as WidgetSnapshot;
}

function content(): WidgetContent {
  return structuredClone(contentFull) as WidgetContent;
}

describe('changedContentKindsForSnapshot', () => {
  it('reloads every snapshot-driven kind on the first write', () => {
    expect(changedContentKindsForSnapshot(null, snap())).toEqual(['RecentlyPlayed', 'Bedtime', 'BayaanNow']);
  });

  it('ignores playback ticks', () => {
    const prev = snap();
    const next = snap();
    next.generatedAt += 1_000;
    if (next.nowPlaying) next.nowPlaying.positionSec += 1;
    expect(changedContentKindsForSnapshot(prev, next)).toEqual([]);
  });

  it('reloads Bayaan Now when Continue Listening would reload', () => {
    const next = snap();
    if (next.nowPlaying) next.nowPlaying.isPlaying = false;
    expect(changedContentKindsForSnapshot(snap(), next)).toEqual(['BayaanNow']);
  });

  it('reloads Recently Played and Bayaan Now when recent changes', () => {
    const next = snap();
    next.recent = [...next.upNext];
    expect(changedContentKindsForSnapshot(snap(), next)).toEqual(['RecentlyPlayed', 'BayaanNow']);
  });

  it('reloads Recently Played and Bedtime when the default reciter changes', () => {
    const next = snap();
    if (next.defaultReciter) next.defaultReciter.name = 'Someone Else';
    expect(changedContentKindsForSnapshot(snap(), next)).toEqual(['RecentlyPlayed', 'Bedtime', 'BayaanNow']);
  });
});

describe('changedContentKindsForContent', () => {
  it('reloads every content-driven kind on the first write', () => {
    expect(changedContentKindsForContent(null, content())).toEqual(['LibraryShelf', 'ReciterSpotlight', 'Bedtime', 'BayaanNow']);
  });

  it('ignores generatedAt', () => {
    const next = content();
    next.generatedAt += 60_000;
    expect(changedContentKindsForContent(content(), next)).toEqual([]);
  });

  it('maps each slice to its kinds', () => {
    const lib = content();
    lib.downloadCount += 1;
    expect(changedContentKindsForContent(content(), lib)).toEqual(['LibraryShelf']);
    const spot = content();
    spot.spotlight = spot.spotlight.slice(1);
    expect(changedContentKindsForContent(content(), spot)).toEqual(['ReciterSpotlight']);
    const sleep = content();
    sleep.sleepTimerEndsAt = null;
    expect(changedContentKindsForContent(content(), sleep)).toEqual(['Bedtime', 'BayaanNow']);
  });

  it('lists eight kinds', () => {
    expect(ALL_CONTENT_WIDGET_KINDS).toHaveLength(8);
  });
});
```

```ts
// services/widgets/__tests__/ambientSounds.test.ts
import {WIDGET_AMBIENT_SOUNDS} from 'bayaan-widgets';
import {AMBIENT_SOUND_LIST} from '@/types/ambient';

it('widget ambient sounds match the app list', () => {
  expect([...WIDGET_AMBIENT_SOUNDS].sort()).toEqual([...AMBIENT_SOUND_LIST].sort());
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest modules/bayaan-widgets/src/__tests__/content.test.ts modules/bayaan-widgets/src/__tests__/contentKinds.test.ts modules/bayaan-widgets/src/__tests__/contentCommandGuards.test.ts services/widgets/__tests__/ambientSounds.test.ts`
Expected: FAIL with "Cannot find module '../content'" and missing exports.

- [ ] **Step 4: Write `content.ts`**

```ts
// modules/bayaan-widgets/src/content.ts
import {isNullableString, isRecord} from './guards';

export const WIDGET_CONTENT_VERSION = 1;
export const SHELF_ITEM_LIMIT = 8;
export const PLAYLIST_LIMIT = 20;

export interface WidgetShelfItem {
  surahId: number; // 1 to 114
  surahName: string;
  reciterId: string;
  reciterName: string;
  rewayatId: string | null;
  itemId: string | null; // playlist item id; null for downloads
}

export interface WidgetPlaylist {
  id: string;
  name: string;
  itemCount: number; // every item, uploads included
  items: WidgetShelfItem[]; // first SHELF_ITEM_LIMIT non-upload items, in order
}

export interface WidgetSpotlightReciter {
  id: string;
  name: string;
  artworkFile: string; // reciter-{id}.jpg; may not be cached yet
  surahIds: number[]; // up to 3 popular surahs the reciter has
}

// Phase 3 side document (content.json). Written when its content changes.
export interface WidgetContent {
  version: typeof WIDGET_CONTENT_VERSION;
  generatedAt: number;
  downloads: WidgetShelfItem[]; // completed, newest first
  downloadCount: number;
  playlists: WidgetPlaylist[];
  spotlight: WidgetSpotlightReciter[];
  sleepTimerEndsAt: number | null; // epoch ms
}

function isShelfItem(value: unknown): value is WidgetShelfItem {
  return (
    isRecord(value) &&
    typeof value.surahId === 'number' &&
    typeof value.surahName === 'string' &&
    typeof value.reciterId === 'string' &&
    typeof value.reciterName === 'string' &&
    isNullableString(value.rewayatId) &&
    isNullableString(value.itemId)
  );
}

function isShelfList(value: unknown): value is WidgetShelfItem[] {
  return Array.isArray(value) && value.every(isShelfItem);
}

function isPlaylist(value: unknown): value is WidgetPlaylist {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.itemCount === 'number' &&
    isShelfList(value.items)
  );
}

function isSpotlight(value: unknown): value is WidgetSpotlightReciter {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.artworkFile === 'string' &&
    Array.isArray(value.surahIds) &&
    value.surahIds.every(n => typeof n === 'number')
  );
}

export function isWidgetContent(value: unknown): value is WidgetContent {
  return (
    isRecord(value) &&
    value.version === WIDGET_CONTENT_VERSION &&
    typeof value.generatedAt === 'number' &&
    isShelfList(value.downloads) &&
    typeof value.downloadCount === 'number' &&
    Array.isArray(value.playlists) &&
    value.playlists.every(isPlaylist) &&
    Array.isArray(value.spotlight) &&
    value.spotlight.every(isSpotlight) &&
    (value.sleepTimerEndsAt === null ||
      typeof value.sleepTimerEndsAt === 'number')
  );
}
```

- [ ] **Step 5: Extend `commands.ts`**

Add above `export type WidgetCommand`:

```ts
export const WIDGET_AMBIENT_SOUNDS = [
  'rain',
  'forest',
  'ocean',
  'stream',
  'thunder',
  'fireplace',
  'wind',
] as const;

export type WidgetAmbientSound = (typeof WIDGET_AMBIENT_SOUNDS)[number];

const MAX_SLEEP_MINUTES = 240;

function isAmbientSound(value: unknown): value is WidgetAmbientSound {
  return WIDGET_AMBIENT_SOUNDS.some(s => s === value);
}
```

Extend the `WidgetCommand` union with two members after `playReciter`:

```ts
  | {type: 'playReciter'; reciterId: string}
  // Queue a playlist starting at itemId (null: the first item).
  | {type: 'playPlaylist'; playlistId: string; itemId: string | null}
  // Play a surah from the start, set the sleep timer, optionally start ambient.
  | {
      type: 'startBedtime';
      surahId: number;
      reciterId: string | null; // null means default reciter
      sleepMinutes: number;
      ambient: WidgetAmbientSound | null; // null leaves ambient alone
    };
```

Add two cases to the `switch (value.type)` in `isWidgetCommand`, before `default`:

```ts
    case 'playPlaylist':
      return (
        typeof value.playlistId === 'string' &&
        value.playlistId.length > 0 &&
        isNullableString(value.itemId)
      );
    case 'startBedtime':
      return (
        typeof value.surahId === 'number' &&
        Number.isInteger(value.surahId) &&
        value.surahId >= 1 &&
        value.surahId <= 114 &&
        isNullableString(value.reciterId) &&
        typeof value.sleepMinutes === 'number' &&
        Number.isInteger(value.sleepMinutes) &&
        value.sleepMinutes >= 1 &&
        value.sleepMinutes <= MAX_SLEEP_MINUTES &&
        (value.ambient === null || isAmbientSound(value.ambient))
      );
```

- [ ] **Step 6: Write `contentKinds.ts`**

```ts
// modules/bayaan-widgets/src/contentKinds.ts
// Phase 3 widget kinds and their change detection. Kept apart from
// widgetKinds.ts so the Phase 1 lists and tests stay as they are.
import type {WidgetSnapshot} from './snapshot';
import type {WidgetContent} from './content';
import {changedWidgetKinds} from './widgetKinds';

export type ContentWidgetKind =
  | 'RecentlyPlayed'
  | 'LibraryShelf'
  | 'Bedtime'
  | 'Adhkar'
  | 'HijriDate'
  | 'Occasion'
  | 'ReciterSpotlight'
  | 'BayaanNow';

export const ALL_CONTENT_WIDGET_KINDS: readonly ContentWidgetKind[] = [
  'RecentlyPlayed',
  'LibraryShelf',
  'Bedtime',
  'Adhkar',
  'HijriDate',
  'Occasion',
  'ReciterSpotlight',
  'BayaanNow',
];

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Adhkar, HijriDate and Occasion depend only on the date: never reloaded here.
export function changedContentKindsForSnapshot(
  prev: WidgetSnapshot | null,
  next: WidgetSnapshot,
): ContentWidgetKind[] {
  if (!prev) return ['RecentlyPlayed', 'Bedtime', 'BayaanNow'];
  const recentChanged = !same(prev.recent, next.recent);
  const reciterChanged = !same(prev.defaultReciter, next.defaultReciter);
  const kinds: ContentWidgetKind[] = [];
  if (recentChanged || reciterChanged) kinds.push('RecentlyPlayed');
  if (reciterChanged) kinds.push('Bedtime');
  if (
    recentChanged ||
    changedWidgetKinds(prev, next).includes('ContinueListening')
  ) {
    kinds.push('BayaanNow');
  }
  return kinds;
}

export function changedContentKindsForContent(
  prev: WidgetContent | null,
  next: WidgetContent,
): ContentWidgetKind[] {
  if (!prev) return ['LibraryShelf', 'ReciterSpotlight', 'Bedtime', 'BayaanNow'];
  const kinds: ContentWidgetKind[] = [];
  if (
    !same(
      [prev.downloads, prev.downloadCount, prev.playlists],
      [next.downloads, next.downloadCount, next.playlists],
    )
  ) {
    kinds.push('LibraryShelf');
  }
  if (!same(prev.spotlight, next.spotlight)) kinds.push('ReciterSpotlight');
  if (prev.sleepTimerEndsAt !== next.sleepTimerEndsAt) {
    kinds.push('Bedtime', 'BayaanNow');
  }
  return kinds;
}
```

Note: the default reciter test expects `['RecentlyPlayed', 'Bedtime', 'BayaanNow']` because a default reciter change also reloads Continue Listening (1b `sliceFor`), which reloads Bayaan Now.

- [ ] **Step 7: Wire the module entry points**

In `modules/bayaan-widgets/src/NativeBayaanWidgets.ts`, add to `NativeBayaanWidgetsModule` after `readArtworkRequests(): string;`:

```ts
  writeContent(json: string): void;
```

In `modules/bayaan-widgets/src/index.ts`:

```ts
import type {WidgetContent} from './content';
import type {ContentWidgetKind} from './contentKinds';
```

add to the `export *` block:

```ts
export * from './content';
export * from './contentKinds';
```

replace `reloadWidgets` with:

```ts
export function reloadWidgets(
  kinds: ReadonlyArray<WidgetKind | ContentWidgetKind>,
): void {
  if (kinds.length === 0) return;
  NativeBayaanWidgets?.reloadWidgets([...kinds]);
}
```

and add after `writeCatalog`:

```ts
export function writeContent(content: WidgetContent): void {
  NativeBayaanWidgets?.writeContent(JSON.stringify(content));
}
```

- [ ] **Step 8: Run the tests**

Run: `npx jest modules/bayaan-widgets services/widgets/__tests__/ambientSounds.test.ts`
Expected: PASS, including the unchanged Phase 1 module tests.

- [ ] **Step 9: Typecheck, format, commit**

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
npx prettier --write modules/bayaan-widgets/src/content.ts modules/bayaan-widgets/src/contentKinds.ts modules/bayaan-widgets/src/commands.ts modules/bayaan-widgets/src/index.ts modules/bayaan-widgets/src/NativeBayaanWidgets.ts modules/bayaan-widgets/src/__tests__/content.test.ts modules/bayaan-widgets/src/__tests__/contentKinds.test.ts modules/bayaan-widgets/src/__tests__/contentCommandGuards.test.ts services/widgets/__tests__/ambientSounds.test.ts
git add modules/bayaan-widgets/src/content.ts modules/bayaan-widgets/src/contentKinds.ts modules/bayaan-widgets/src/commands.ts modules/bayaan-widgets/src/index.ts modules/bayaan-widgets/src/NativeBayaanWidgets.ts modules/bayaan-widgets/src/__fixtures__/content.full.json modules/bayaan-widgets/src/__tests__/content.test.ts modules/bayaan-widgets/src/__tests__/contentKinds.test.ts modules/bayaan-widgets/src/__tests__/contentCommandGuards.test.ts services/widgets/__tests__/ambientSounds.test.ts
git commit -m "feat(widgets): add the content document, bedtime and playlist commands"
```

---

### Task 3: Context rules, Hijri table and shared vectors

**Files:**
- Create: `modules/bayaan-widgets/src/contextRules.ts`, `modules/bayaan-widgets/src/__tests__/contextRules.test.ts`, `modules/bayaan-widgets/src/__fixtures__/context.vectors.json`, `scripts/generate-hijri-table.swift`, `scripts/generate-context-vectors.ts`
- Generated (commit): `modules/bayaan-widgets/src/__fixtures__/hijri.table.json`, `modules/bayaan-widgets/src/__fixtures__/next-occasions.vectors.json`
- Modify: `modules/bayaan-widgets/src/index.ts` (export), `package.json` (`generate:widget-vectors`)

**Interfaces:**
- Consumes: `isRecord` (`guards.ts`); `targets/widgets/occasions.json` (Task 1, read by a test).
- Produces (Swift `ContentLogic` and Kotlin `ContentLogic` mirror these names in their own casing):
  - `type HijriDate = {year; month; day}`, `type OccasionId`, `type AdhkarPeriod = 'morning' | 'evening'`, `type BayaanNowMode = 'listening' | 'occasion' | 'morningAdhkar' | 'eveningAdhkar' | 'bedtime'`, `type UpcomingOccasion = {id: OccasionId; days: number}`
  - constants `FRIDAY = 6`, `JUMUAH_END_HOUR = 18`, `CONTEXT_BOUNDARY_HOURS = [0, 4, 11, 12, 15, 18, 20, 21]`, `NEXT_OCCASION_HORIZON_DAYS = 400`, `OCCASION_WINDOWS`, `UPCOMING_ANCHORS`
  - `adhkarPeriod(hour)`, `occasionFor(hijri | null, weekday, hour)`, `bayaanNowMode(hour, isPlaying, occasion)`, `bayaanNowRelevance(mode, isPlaying)`, `adhkarRelevance(hour)`, `occasionRelevance(occasion)`, `bedtimeRelevance(hour)`, `nextBoundaryMinutes(minutesSinceMidnight)`, `nextOccasions(today, hijriOf, count, horizon?)`, `sleepTimerActive(endsAt, now)`
  - Hijri table helpers `parseHijriTable(value: unknown): HijriTable | null`, `hijriLookup(table): (dayNumber: number) => HijriDate | null`, `buildNextOccasionVectors(table, count = 3): NextOccasionVector[]`, `NEXT_OCCASION_VECTOR_DAYS = [20454, 20501, 20502, 20737, 20819]`
  - Fixtures: `context.vectors.json`, `hijri.table.json` (`{"from": 20454, "rows": [[y, m, d], ...]}` for day numbers 20454 to 21549, 2026-01-01 to 2028-12-31), `next-occasions.vectors.json` (`{"count": 3, "cases": [{"today", "expect": [{"id", "days"}]}]}`)

- [ ] **Step 1: Write the Hijri table generator and generate the table**

```swift
// scripts/generate-hijri-table.swift
// Writes the Umm al-Qura date for every local day number from 2026-01-01 to
// 2028-12-31, read at 12:00 UTC, as JSON on stdout. The TS, Swift and Kotlin
// rule tests all check against this table.
// Run: npm run generate:widget-vectors
import Foundation

var islamic = Calendar(identifier: .islamicUmmAlQura)
islamic.timeZone = TimeZone(identifier: "UTC")!
let from = 20454 // 2026-01-01
let to = 21549 // 2028-12-31
var rows: [String] = []
for day in from...to {
  let date = Date(timeIntervalSince1970: Double(day) * 86_400 + 43_200)
  let c = islamic.dateComponents([.year, .month, .day], from: date)
  rows.append("[\(c.year!),\(c.month!),\(c.day!)]")
}
// Anchor: 1 Ramadan 1447 is Wednesday 18 February 2026 (day 20502) in Umm al-Qura.
// If this fails, check the calendar identifier; do not edit the anchor without an official source.
precondition(rows[20502 - from] == "[1447,9,1]", "unexpected Umm al-Qura conversion: \(rows[20502 - from])")
print("{\"from\":\(from),\"rows\":[\(rows.joined(separator: ","))]}")
```

Add to `package.json` `scripts` (next to `generate:widget-data`):

```json
    "generate:widget-vectors": "swift scripts/generate-hijri-table.swift > modules/bayaan-widgets/src/__fixtures__/hijri.table.json && tsx scripts/generate-context-vectors.ts",
```

Run only the first half for now: `swift scripts/generate-hijri-table.swift > modules/bayaan-widgets/src/__fixtures__/hijri.table.json && head -c 120 modules/bayaan-widgets/src/__fixtures__/hijri.table.json`
Expected: output starts with `{"from":20454,"rows":[[1447,7,` and the command exits 0.

- [ ] **Step 2: Write the rule vectors (hand-authored, pure inputs)**

`modules/bayaan-widgets/src/__fixtures__/context.vectors.json`:

```json
{
  "adhkarPeriod": [[0, "evening"], [3, "evening"], [4, "morning"], [11, "morning"], [12, "evening"], [23, "evening"]],
  "occasion": [
    {"hijri": [1447, 9, 1], "weekday": 4, "hour": 10, "expect": "ramadan"},
    {"hijri": [1447, 9, 20], "weekday": 2, "hour": 23, "expect": "ramadan"},
    {"hijri": [1447, 9, 21], "weekday": 3, "hour": 0, "expect": "lastTen"},
    {"hijri": [1447, 9, 30], "weekday": 6, "hour": 12, "expect": "lastTen"},
    {"hijri": [1447, 10, 1], "weekday": 6, "hour": 9, "expect": "eidFitr"},
    {"hijri": [1447, 10, 3], "weekday": 1, "hour": 9, "expect": "eidFitr"},
    {"hijri": [1447, 10, 4], "weekday": 6, "hour": 17, "expect": "jumuah"},
    {"hijri": [1447, 10, 4], "weekday": 6, "hour": 18, "expect": null},
    {"hijri": [1447, 12, 1], "weekday": 1, "hour": 8, "expect": "dhulHijjah"},
    {"hijri": [1447, 12, 8], "weekday": 1, "hour": 8, "expect": "dhulHijjah"},
    {"hijri": [1447, 12, 9], "weekday": 2, "hour": 8, "expect": "arafah"},
    {"hijri": [1447, 12, 10], "weekday": 3, "hour": 8, "expect": "eidAdha"},
    {"hijri": [1447, 12, 13], "weekday": 6, "hour": 8, "expect": "eidAdha"},
    {"hijri": [1447, 12, 14], "weekday": 7, "hour": 8, "expect": null},
    {"hijri": [1448, 1, 9], "weekday": 1, "hour": 8, "expect": "ashura"},
    {"hijri": [1448, 1, 10], "weekday": 6, "hour": 8, "expect": "ashura"},
    {"hijri": [1448, 4, 29], "weekday": 1, "hour": 8, "expect": null},
    {"hijri": null, "weekday": 6, "hour": 8, "expect": "jumuah"},
    {"hijri": null, "weekday": 5, "hour": 8, "expect": null}
  ],
  "mode": [
    {"hour": 9, "playing": true, "occasion": "ramadan", "expect": "listening", "relevance": 1.0},
    {"hour": 22, "playing": true, "occasion": null, "expect": "listening", "relevance": 1.0},
    {"hour": 9, "playing": false, "occasion": "jumuah", "expect": "occasion", "relevance": 0.8},
    {"hour": 4, "playing": false, "occasion": null, "expect": "morningAdhkar", "relevance": 0.7},
    {"hour": 10, "playing": false, "occasion": null, "expect": "morningAdhkar", "relevance": 0.7},
    {"hour": 11, "playing": false, "occasion": null, "expect": "listening", "relevance": 0.2},
    {"hour": 14, "playing": false, "occasion": null, "expect": "listening", "relevance": 0.2},
    {"hour": 15, "playing": false, "occasion": null, "expect": "eveningAdhkar", "relevance": 0.7},
    {"hour": 19, "playing": false, "occasion": null, "expect": "eveningAdhkar", "relevance": 0.7},
    {"hour": 20, "playing": false, "occasion": null, "expect": "listening", "relevance": 0.2},
    {"hour": 21, "playing": false, "occasion": null, "expect": "bedtime", "relevance": 0.6},
    {"hour": 0, "playing": false, "occasion": null, "expect": "bedtime", "relevance": 0.6},
    {"hour": 3, "playing": false, "occasion": null, "expect": "bedtime", "relevance": 0.6}
  ],
  "adhkarRelevance": [[3, 0.2], [4, 0.7], [10, 0.7], [11, 0.2], [15, 0.7], [19, 0.7], [20, 0.2]],
  "occasionRelevance": [["ramadan", 0.8], [null, 0.1]],
  "bedtimeRelevance": [[20, 0.1], [21, 0.6], [3, 0.6], [4, 0.1]],
  "nextBoundary": [[0, 240], [239.5, 240], [240, 660], [700, 720], [720, 900], [1000, 1080], [1100, 1200], [1230, 1260], [1300, 1440], [1439.9, 1440]],
  "sleepActive": [[null, 1000, false], [999, 1000, false], [1000, 1000, false], [1001, 1000, true]]
}
```

- [ ] **Step 3: Write the failing tests**

```ts
// modules/bayaan-widgets/src/__tests__/contextRules.test.ts
import fs from 'fs';
import path from 'path';
import vectors from '../__fixtures__/context.vectors.json';
import tableJson from '../__fixtures__/hijri.table.json';
import committedNext from '../__fixtures__/next-occasions.vectors.json';
import {
  adhkarPeriod,
  adhkarRelevance,
  BayaanNowMode,
  bayaanNowMode,
  bayaanNowRelevance,
  bedtimeRelevance,
  buildNextOccasionVectors,
  HijriDate,
  hijriLookup,
  nextBoundaryMinutes,
  nextOccasions,
  OCCASION_WINDOWS,
  OccasionId,
  occasionFor,
  occasionRelevance,
  parseHijriTable,
  sleepTimerActive,
} from '../contextRules';

type Triple = [number, number, number];

function hijri(t: Triple | null): HijriDate | null {
  return t ? {year: t[0], month: t[1], day: t[2]} : null;
}

const table = parseHijriTable(tableJson);
if (!table) throw new Error('hijri.table.json is malformed');
const lookup = hijriLookup(table);

describe('adhkarPeriod', () => {
  it.each(vectors.adhkarPeriod as [number, string][])('hour %d is %s', (hour, expected) => {
    expect(adhkarPeriod(hour)).toBe(expected);
  });
});

describe('occasionFor', () => {
  it.each(vectors.occasion as {hijri: Triple | null; weekday: number; hour: number; expect: string | null}[])(
    '%j',
    v => {
      expect(occasionFor(hijri(v.hijri), v.weekday, v.hour)).toBe(v.expect);
    },
  );

  it('has generated data for every occasion id', () => {
    const file = path.resolve(__dirname, '../../../../targets/widgets/occasions.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8')) as {occasions: {id: string}[]};
    const ids = data.occasions.map(o => o.id);
    expect(ids).toEqual([...OCCASION_WINDOWS.map(w => w.id), 'jumuah']);
  });
});

describe('Bayaan Now', () => {
  it.each(vectors.mode as {hour: number; playing: boolean; occasion: OccasionId | null; expect: BayaanNowMode; relevance: number}[])(
    '%j',
    v => {
      const mode = bayaanNowMode(v.hour, v.playing, v.occasion);
      expect(mode).toBe(v.expect);
      expect(bayaanNowRelevance(mode, v.playing)).toBeCloseTo(v.relevance);
    },
  );
});

describe('single widget relevance', () => {
  it('matches the vectors', () => {
    for (const [hour, r] of vectors.adhkarRelevance as [number, number][]) expect(adhkarRelevance(hour)).toBeCloseTo(r);
    for (const [o, r] of vectors.occasionRelevance as [OccasionId | null, number][]) expect(occasionRelevance(o)).toBeCloseTo(r);
    for (const [hour, r] of vectors.bedtimeRelevance as [number, number][]) expect(bedtimeRelevance(hour)).toBeCloseTo(r);
  });
});

describe('nextBoundaryMinutes', () => {
  it.each(vectors.nextBoundary as [number, number][])('%d -> %d', (m, expected) => {
    expect(nextBoundaryMinutes(m)).toBe(expected);
  });
});

describe('sleepTimerActive', () => {
  it.each(vectors.sleepActive as [number | null, number, boolean][])('%j at %d is %s', (endsAt, now, expected) => {
    expect(sleepTimerActive(endsAt, now)).toBe(expected);
  });
});

describe('Hijri table', () => {
  it('covers 2026 to 2028 with the Umm al-Qura anchor', () => {
    expect(table.from).toBe(20454);
    expect(table.rows).toHaveLength(1096);
    expect(lookup(20502)).toEqual({year: 1447, month: 9, day: 1});
    expect(lookup(20453)).toBeNull();
    expect(lookup(21550)).toBeNull();
  });

  it('rejects malformed tables', () => {
    expect(parseHijriTable({from: 1, rows: [[1, 2]]})).toBeNull();
    expect(parseHijriTable(null)).toBeNull();
  });
});

describe('nextOccasions', () => {
  it('finds each anchor on the first matching day after today', () => {
    const today = 20454;
    const found = nextOccasions(today, lookup, 6);
    expect(found).toHaveLength(6);
    for (const o of found) {
      const h = lookup(today + o.days);
      if (!h) throw new Error(`no table row for ${today + o.days}`);
      expect(occasionAnchorHit(o.id, h)).toBe(true);
      for (let d = 1; d < o.days; d++) {
        const earlier = lookup(today + d);
        if (earlier) expect(occasionAnchorHit(o.id, earlier)).toBe(false);
      }
    }
    expect([...found].sort((a, b) => a.days - b.days)).toEqual(found);
  });

  it('never reports today and stops when the converter runs out', () => {
    expect(nextOccasions(20502, lookup, 6).every(o => o.days >= 1)).toBe(true);
    expect(nextOccasions(21540, lookup, 6).length).toBeLessThan(6);
  });

  it('matches the committed vectors (run npm run generate:widget-vectors after changing rules)', () => {
    expect(buildNextOccasionVectors(table)).toEqual(committedNext.cases);
    expect(committedNext.count).toBe(3);
  });
});

function occasionAnchorHit(id: OccasionId, h: HijriDate): boolean {
  const anchors: Record<string, [number, number]> = {
    ramadan: [9, 1], eidFitr: [10, 1], dhulHijjah: [12, 1], arafah: [12, 9], eidAdha: [12, 10], ashura: [1, 10],
  };
  const a = anchors[id];
  return a !== undefined && a[0] === h.month && a[1] === h.day;
}
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx jest modules/bayaan-widgets/src/__tests__/contextRules.test.ts`
Expected: FAIL with "Cannot find module '../contextRules'" (and the missing `next-occasions.vectors.json`).

- [ ] **Step 5: Write `contextRules.ts`**

```ts
// modules/bayaan-widgets/src/contextRules.ts
// Reference implementation of the Phase 3 time, occasion and Bayaan Now
// rules. Mirrored by ContentLogic.swift and ContentLogic.kt; shared vectors in
// __fixtures__/context.vectors.json and next-occasions.vectors.json. Hours and
// weekdays are local Gregorian; Hijri dates are Umm al-Qura and come from the
// platform calendar (or hijri.table.json in tests).
import {isRecord} from './guards';

export interface HijriDate {
  year: number;
  month: number;
  day: number;
}

export type OccasionId =
  | 'eidFitr'
  | 'arafah'
  | 'eidAdha'
  | 'lastTen'
  | 'ramadan'
  | 'dhulHijjah'
  | 'ashura'
  | 'jumuah';

export type AdhkarPeriod = 'morning' | 'evening';

export type BayaanNowMode =
  | 'listening'
  | 'occasion'
  | 'morningAdhkar'
  | 'eveningAdhkar'
  | 'bedtime';

export interface UpcomingOccasion {
  id: OccasionId;
  days: number;
}

/** Gregorian weekday numbering shared with Foundation and java.util.Calendar: Sunday = 1. */
export const FRIDAY = 6;
export const JUMUAH_END_HOUR = 18;
export const CONTEXT_BOUNDARY_HOURS: readonly number[] = [
  0, 4, 11, 12, 15, 18, 20, 21,
];
export const NEXT_OCCASION_HORIZON_DAYS = 400;

interface OccasionWindow {
  id: OccasionId;
  month: number;
  from: number;
  to: number;
}

// Priority order. The Hijri windows do not overlap; Jumu'ah applies only
// when none matches.
export const OCCASION_WINDOWS: readonly OccasionWindow[] = [
  {id: 'eidFitr', month: 10, from: 1, to: 3},
  {id: 'arafah', month: 12, from: 9, to: 9},
  {id: 'eidAdha', month: 12, from: 10, to: 13},
  {id: 'lastTen', month: 9, from: 21, to: 30},
  {id: 'ramadan', month: 9, from: 1, to: 20},
  {id: 'dhulHijjah', month: 12, from: 1, to: 8},
  {id: 'ashura', month: 1, from: 9, to: 10},
];

export const UPCOMING_ANCHORS: readonly {
  id: OccasionId;
  month: number;
  day: number;
}[] = [
  {id: 'ramadan', month: 9, day: 1},
  {id: 'eidFitr', month: 10, day: 1},
  {id: 'dhulHijjah', month: 12, day: 1},
  {id: 'arafah', month: 12, day: 9},
  {id: 'eidAdha', month: 12, day: 10},
  {id: 'ashura', month: 1, day: 10},
];

export function adhkarPeriod(hour: number): AdhkarPeriod {
  return hour >= 4 && hour < 12 ? 'morning' : 'evening';
}

export function occasionFor(
  hijri: HijriDate | null,
  weekday: number,
  hour: number,
): OccasionId | null {
  const hit = hijri
    ? OCCASION_WINDOWS.find(
        w => w.month === hijri.month && hijri.day >= w.from && hijri.day <= w.to,
      )
    : undefined;
  if (hit) return hit.id;
  return weekday === FRIDAY && hour < JUMUAH_END_HOUR ? 'jumuah' : null;
}

export function bayaanNowMode(
  hour: number,
  isPlaying: boolean,
  occasion: OccasionId | null,
): BayaanNowMode {
  if (isPlaying) return 'listening';
  if (occasion !== null) return 'occasion';
  if (hour >= 4 && hour < 11) return 'morningAdhkar';
  if (hour >= 15 && hour < 20) return 'eveningAdhkar';
  if (hour >= 21 || hour < 4) return 'bedtime';
  return 'listening';
}

export function bayaanNowRelevance(
  mode: BayaanNowMode,
  isPlaying: boolean,
): number {
  switch (mode) {
    case 'listening':
      return isPlaying ? 1 : 0.2;
    case 'occasion':
      return 0.8;
    case 'morningAdhkar':
    case 'eveningAdhkar':
      return 0.7;
    case 'bedtime':
      return 0.6;
  }
}

export function adhkarRelevance(hour: number): number {
  return (hour >= 4 && hour < 11) || (hour >= 15 && hour < 20) ? 0.7 : 0.2;
}

export function occasionRelevance(occasion: OccasionId | null): number {
  return occasion !== null ? 0.8 : 0.1;
}

export function bedtimeRelevance(hour: number): number {
  return hour >= 21 || hour < 4 ? 0.6 : 0.1;
}

/** Minutes since local midnight of the next boundary; 1440 is the next midnight. */
export function nextBoundaryMinutes(minutesSinceMidnight: number): number {
  for (const h of CONTEXT_BOUNDARY_HOURS) {
    if (h * 60 > minutesSinceMidnight) return h * 60;
  }
  return 1440;
}

/** Scans forward day by day; stops early when the converter returns null. */
export function nextOccasions(
  today: number,
  hijriOf: (dayNumber: number) => HijriDate | null,
  count: number,
  horizon: number = NEXT_OCCASION_HORIZON_DAYS,
): UpcomingOccasion[] {
  const found: UpcomingOccasion[] = [];
  for (
    let d = 1;
    d <= horizon && found.length < UPCOMING_ANCHORS.length;
    d++
  ) {
    const h = hijriOf(today + d);
    if (!h) break;
    for (const a of UPCOMING_ANCHORS) {
      if (
        a.month === h.month &&
        a.day === h.day &&
        !found.some(f => f.id === a.id)
      ) {
        found.push({id: a.id, days: d});
      }
    }
  }
  return found.slice(0, count);
}

export function sleepTimerActive(endsAt: number | null, now: number): boolean {
  return endsAt !== null && endsAt > now;
}

// ---- Hijri table (tests and vector generation) ----------------------------

export interface HijriTable {
  from: number;
  rows: [number, number, number][];
}

function isTriple(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every(n => typeof n === 'number')
  );
}

export function parseHijriTable(value: unknown): HijriTable | null {
  if (!isRecord(value) || typeof value.from !== 'number') return null;
  if (!Array.isArray(value.rows) || !value.rows.every(isTriple)) return null;
  return {from: value.from, rows: value.rows};
}

export function hijriLookup(
  table: HijriTable,
): (dayNumber: number) => HijriDate | null {
  return dayNumber => {
    const row = table.rows[dayNumber - table.from];
    return row ? {year: row[0], month: row[1], day: row[2]} : null;
  };
}

export interface NextOccasionVector {
  today: number;
  expect: UpcomingOccasion[];
}

// 2026-01-01, 2026-02-17 (eve of Ramadan), 2026-02-18 (1 Ramadan), 2026-10-11, 2027-01-01.
export const NEXT_OCCASION_VECTOR_DAYS: readonly number[] = [
  20454, 20501, 20502, 20737, 20819,
];

export function buildNextOccasionVectors(
  table: HijriTable,
  count = 3,
): NextOccasionVector[] {
  const lookup = hijriLookup(table);
  return NEXT_OCCASION_VECTOR_DAYS.map(today => ({
    today,
    expect: nextOccasions(today, lookup, count),
  }));
}
```

Note: anchors are found in scan order, so `found` is already sorted by days.

- [ ] **Step 6: Write the vector generator and generate**

```ts
// scripts/generate-context-vectors.ts
// Writes next-occasions.vectors.json from the TS reference rules and the
// committed Hijri table. Swift and Kotlin tests compare against it.
// Run: npm run generate:widget-vectors
import fs from 'fs';
import path from 'path';
import {
  buildNextOccasionVectors,
  parseHijriTable,
} from '../modules/bayaan-widgets/src/contextRules';

const dir = path.resolve(__dirname, '../modules/bayaan-widgets/src/__fixtures__');
const table = parseHijriTable(
  JSON.parse(fs.readFileSync(path.join(dir, 'hijri.table.json'), 'utf8')),
);
if (!table) throw new Error('hijri.table.json is malformed');
const out = {count: 3, cases: buildNextOccasionVectors(table, 3)};
fs.writeFileSync(
  path.join(dir, 'next-occasions.vectors.json'),
  `${JSON.stringify(out, null, 2)}\n`,
);
console.log(`[generate-context-vectors] ${out.cases.length} cases`);
```

Run: `npm run generate:widget-vectors`
Expected: `[generate-context-vectors] 5 cases`. Open `next-occasions.vectors.json` and sanity check one case by hand: for `"today": 20501` (17 February 2026) the first entry is `{"id": "ramadan", "days": 1}`.

Add to `modules/bayaan-widgets/src/index.ts`: `export * from './contextRules';`

- [ ] **Step 7: Run the tests**

Run: `npx jest modules/bayaan-widgets/src/__tests__/contextRules.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck, format, commit**

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
npx prettier --write modules/bayaan-widgets/src/contextRules.ts modules/bayaan-widgets/src/index.ts modules/bayaan-widgets/src/__tests__/contextRules.test.ts scripts/generate-context-vectors.ts
git add modules/bayaan-widgets/src/contextRules.ts modules/bayaan-widgets/src/index.ts modules/bayaan-widgets/src/__tests__/contextRules.test.ts modules/bayaan-widgets/src/__fixtures__/context.vectors.json modules/bayaan-widgets/src/__fixtures__/hijri.table.json modules/bayaan-widgets/src/__fixtures__/next-occasions.vectors.json scripts/generate-hijri-table.swift scripts/generate-context-vectors.ts package.json
git commit -m "feat(widgets): add context rules with Umm al-Qura vectors"
```

---
### Task 4: iOS bridge, content intents and the Swift support layer

**Files:**
- Modify: `modules/bayaan-widgets/ios/BayaanWidgetsModule.swift`, `package.json` (`test:widget-fixtures`)
- Create: `targets/widgets/_shared/ContentIntents.swift`, `targets/widgets/Support/ContentModels.swift`, `targets/widgets/Support/ContentLogic.swift`, `targets/widgets/Support/ContentStores.swift`, `targets/widgets/Support/ContentEntities.swift`, `targets/widgets/Support/ContentChrome.swift`, `scripts/check-widget-content.sh`

**Interfaces:**
- Consumes: `WidgetCommandQueue.enqueue(_:)`, `BayaanAppGroup.widgetsDir` (`_shared`, 1a); `WidgetLogic.dayNumber/ayahIndex` (1b); `StaticAyah`, `StaticData.surah(_:)`, `SurahCard`, `WidgetFonts`, `WidgetPalette`, `BayaanLogo` (1b); fixtures from Tasks 1 to 3.
- Produces (Swift names used by Tasks 7 to 10):
  - Native module function `writeContent(json)` writing `widgets/content.json`
  - `PlayPlaylistIntent(playlistId: String, itemId: String?)`, `StartBedtimeIntent(surahId: Int, reciterId: String?, sleepMinutes: Int, ambient: String?)` (both `AudioPlaybackIntent`, `@available(iOS 17.0, *)`)
  - Models: `WidgetShelfItem`, `WidgetPlaylist`, `WidgetSpotlightReciter`, `WidgetContent` (`decode(_:)`, `playlist(_:)`), `FeaturedDhikr`, `AdhkarPeriodData`, `AdhkarPeriods` (`data(for:)`), `HijriMonthName`, `OccasionInfo`, `OccasionData` (`occasion(_:)`, `month(_:)`), `HijriDate`
  - `enum AdhkarPeriod { morning, evening }`, `enum BayaanNowMode { listening, occasion, morningAdhkar, eveningAdhkar, bedtime }`, `struct UpcomingOccasion { id, days }`
  - `ContentLogic`: `hour(_:timeZone:)`, `weekday(_:timeZone:)`, `hijri(dayNumber:)`, `hijri(_:timeZone:)`, `adhkarPeriod(hour:)`, `occasion(hijri:weekday:hour:)`, `occasion(at:timeZone:)`, `mode(hour:isPlaying:occasion:)`, `relevance(mode:isPlaying:)`, `adhkarRelevance(hour:)`, `occasionRelevance(_:)`, `bedtimeRelevance(hour:)`, `nextBoundaryMinutes(after:)`, `boundaries(after:within:timeZone:)`, `nextOccasions(today:count:horizon:hijriOf:)`, `sleepActive(endsAt:now:)`
  - `ContentResolvers`: `recentShelf(_:limit:) -> RecentShelf`, `library(sourceId:content:) -> LibraryShelfState`, `spotlight(_:date:timeZone:)`; `ContentText`: `hijriLine`, `daysLabel`, `surahCount`, `repeatLabel`
  - `ContentStore.load()`, `ContentStaticData.adhkar`, `ContentStaticData.occasions`
  - `LibrarySourceEntity` (+ query), `SleepMinutesOption`, `AmbientOption`
  - Views: `ShelfHeader`, `SurahTileButton`, `ContentMessage`, `DhikrText`; `TimelineEntryRelevance.scored(_:from:until:)`

- [ ] **Step 1: Write the failing Swift check**

Create `scripts/check-widget-content.sh` and make it executable (`chmod +x scripts/check-widget-content.sh`):

```bash
#!/usr/bin/env bash
# Phase 3 Swift checks: content.json and the generated adhkar and occasion data
# decode with the extension's models; Umm al-Qura conversion, rules and
# resolvers match the vectors shared with contextRules.test.ts and ContentLogicTest.kt.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fixtures="$root/modules/bayaan-widgets/src/__fixtures__"

cat "$root/targets/widgets/_shared/WidgetSnapshot.swift" \
    "$root/targets/widgets/Support/WidgetModels.swift" \
    "$root/targets/widgets/Support/WidgetLogic.swift" \
    "$root/targets/widgets/Support/ContentModels.swift" \
    "$root/targets/widgets/Support/ContentLogic.swift" > "$tmp/content-test.swift"
cat >> "$tmp/content-test.swift" <<'SWIFT'
let dir = CommandLine.arguments[1]
let targetDir = CommandLine.arguments[2]
func load(_ path: String) -> Data { try! Data(contentsOf: URL(fileURLWithPath: path)) }
func json(_ path: String) -> Any { try! JSONSerialization.jsonObject(with: load(path)) }
func close(_ a: Float, _ b: Double) -> Bool { abs(Double(a) - b) < 1e-6 }

// content.json
let content = WidgetContent.decode(load("\(dir)/content.full.json"))
precondition(content?.downloads.count == 2 && content?.downloadCount == 12, "content downloads")
precondition(content?.playlist("playlist_1")?.items.map(\.itemId) == ["item_1", "item_2"], "content playlist items")
precondition(content?.playlist("playlist_1")?.items.first?.rewayatId == nil, "content null rewayat")
precondition(content?.spotlight.first?.surahIds == [1, 18, 36] && content?.sleepTimerEndsAt == 1_791_462_600_000, "content spotlight and timer")
var future = try! String(contentsOfFile: "\(dir)/content.full.json", encoding: .utf8)
future = future.replacingOccurrences(of: "\"version\": 1", with: "\"version\": 2")
precondition(WidgetContent.decode(future.data(using: .utf8)!) == nil, "accepted future content")
precondition(WidgetContent.decode(Data("nope".utf8)) == nil, "accepted junk content")

// Generated static data
let adhkar = try! JSONDecoder().decode(AdhkarPeriods.self, from: load("\(targetDir)/adhkar-periods.json"))
precondition(adhkar.morning.count == 24 && adhkar.morning.superId == "morning-adhkar" && adhkar.evening.superId == "evening-adhkar", "adhkar periods")
precondition(adhkar.data(for: .evening).featured.contains { $0.id == "97" } && !adhkar.morning.featured.contains { $0.id == "97" }, "adhkar featured split")
let occasions = try! JSONDecoder().decode(OccasionData.self, from: load("\(targetDir)/occasions.json"))
precondition(occasions.months.count == 12 && occasions.month(9)?.name == "Ramadan", "months")
precondition(occasions.occasions.map(\.id) == ["eidFitr", "arafah", "eidAdha", "lastTen", "ramadan", "dhulHijjah", "ashura", "jumuah"], "occasion ids")
precondition(occasions.occasion("jumuah")?.listenSurahId == 18 && occasions.occasion("ramadan")?.ayat.isEmpty == false, "occasion details")
print("swift content decode: OK")

// Umm al-Qura conversion equals the committed table
let table = json("\(dir)/hijri.table.json") as! [String: Any]
let from = table["from"] as! Int
let rows = table["rows"] as! [[Int]]
for (i, row) in rows.enumerated() {
  precondition(ContentLogic.hijri(dayNumber: from + i) == HijriDate(year: row[0], month: row[1], day: row[2]),
               "hijri mismatch at day \(from + i)")
}
func tableHijri(_ day: Int) -> HijriDate? {
  let i = day - from
  guard i >= 0, i < rows.count else { return nil }
  return HijriDate(year: rows[i][0], month: rows[i][1], day: rows[i][2])
}

// Rule vectors
let v = json("\(dir)/context.vectors.json") as! [String: Any]
for pair in v["adhkarPeriod"] as! [[Any]] {
  precondition(ContentLogic.adhkarPeriod(hour: pair[0] as! Int).rawValue == pair[1] as! String, "adhkarPeriod \(pair)")
}
for c in v["occasion"] as! [[String: Any]] {
  let h = (c["hijri"] as? [Int]).map { HijriDate(year: $0[0], month: $0[1], day: $0[2]) }
  let got = ContentLogic.occasion(hijri: h, weekday: c["weekday"] as! Int, hour: c["hour"] as! Int)
  precondition(got == c["expect"] as? String, "occasion \(c)")
}
for c in v["mode"] as! [[String: Any]] {
  let playing = c["playing"] as! Bool
  let mode = ContentLogic.mode(hour: c["hour"] as! Int, isPlaying: playing, occasion: c["occasion"] as? String)
  precondition(mode.rawValue == c["expect"] as! String, "mode \(c)")
  precondition(close(ContentLogic.relevance(mode: mode, isPlaying: playing), c["relevance"] as! Double), "relevance \(c)")
}
for p in v["adhkarRelevance"] as! [[Any]] { precondition(close(ContentLogic.adhkarRelevance(hour: p[0] as! Int), p[1] as! Double), "adhkarRelevance \(p)") }
for p in v["occasionRelevance"] as! [[Any]] { precondition(close(ContentLogic.occasionRelevance(p[0] as? String), p[1] as! Double), "occasionRelevance \(p)") }
for p in v["bedtimeRelevance"] as! [[Any]] { precondition(close(ContentLogic.bedtimeRelevance(hour: p[0] as! Int), p[1] as! Double), "bedtimeRelevance \(p)") }
for p in v["nextBoundary"] as! [[Double]] { precondition(ContentLogic.nextBoundaryMinutes(after: p[0]) == Int(p[1]), "nextBoundary \(p)") }
for c in v["sleepActive"] as! [[Any]] {
  let now = Date(timeIntervalSince1970: (c[1] as! Double) / 1000)
  precondition(ContentLogic.sleepActive(endsAt: c[0] as? Double, now: now) == c[2] as! Bool, "sleepActive \(c)")
}

// Next occasions: Foundation and the table both give the committed vectors
let nv = json("\(dir)/next-occasions.vectors.json") as! [String: Any]
let count = nv["count"] as! Int
for c in nv["cases"] as! [[String: Any]] {
  let today = c["today"] as! Int
  let expect = (c["expect"] as! [[String: Any]]).map { UpcomingOccasion(id: $0["id"] as! String, days: $0["days"] as! Int) }
  precondition(ContentLogic.nextOccasions(today: today, count: count, hijriOf: ContentLogic.hijri(dayNumber:)) == expect, "nextOccasions \(today)")
  precondition(ContentLogic.nextOccasions(today: today, count: count, hijriOf: tableHijri) == expect, "nextOccasions table \(today)")
}

// Time zones: 2026-02-19T03:30Z is 22:30 Wednesday 18 Feb in New York (1 Ramadan 1447)
// and 12:30 Thursday 19 Feb in Tokyo (the next Hijri day).
let ny = TimeZone(identifier: "America/New_York")!
let tokyo = TimeZone(identifier: "Asia/Tokyo")!
let instant = Date(timeIntervalSince1970: 1_771_471_800)
precondition(ContentLogic.hijri(instant, timeZone: ny) == HijriDate(year: 1447, month: 9, day: 1), "hijri NY")
precondition(ContentLogic.hijri(instant, timeZone: tokyo) == tableHijri(20503), "hijri Tokyo")
precondition(ContentLogic.hour(instant, timeZone: ny) == 22 && ContentLogic.weekday(instant, timeZone: ny) == 4, "NY hour and weekday")
precondition(ContentLogic.hour(instant, timeZone: tokyo) == 12 && ContentLogic.weekday(instant, timeZone: tokyo) == 5, "Tokyo hour and weekday")
precondition(ContentLogic.occasion(at: instant, timeZone: ny) == "ramadan", "occasion NY")
let b = ContentLogic.boundaries(after: instant, timeZone: ny)
precondition(b.count == 8 && ContentLogic.hour(b[0], timeZone: ny) == 0 && ContentLogic.hour(b[7], timeZone: ny) == 21, "boundaries")

// Resolvers
let full = WidgetSnapshot.decode(load("\(dir)/snapshot.full.json"))!
func withRecent(_ recent: [WidgetTrack], _ reciter: WidgetReciter?) -> WidgetSnapshot {
  WidgetSnapshot(version: full.version, generatedAt: full.generatedAt, theme: full.theme, nowPlaying: nil,
                 upNext: [], recent: recent, defaultReciter: reciter, reciterRecents: [:], lastRead: nil, tasbeeh: [:])
}
let upload = WidgetTrack(surahId: 0, surahName: "Talk", reciterId: "me", reciterName: "Me", rewayatId: nil, artworkFile: nil, isUserUpload: true)
let kahf = full.nowPlaying!.track
let shelf = ContentResolvers.recentShelf(withRecent([upload, kahf], full.defaultReciter))
precondition(shelf.tracks == [kahf] && !shelf.isSuggestion, "recent filters uploads")
let suggestion = ContentResolvers.recentShelf(withRecent([upload], full.defaultReciter), limit: 4)
precondition(suggestion.isSuggestion && suggestion.tracks.map(\.surahId) == [1, 18, 36, 67]
             && suggestion.tracks.allSatisfy { $0.reciterId == "r-alafasi" }, "recent suggestion")
precondition(ContentResolvers.recentShelf(withRecent([], nil)).tracks.isEmpty, "recent empty")
precondition(ContentResolvers.recentShelf(nil).tracks.isEmpty, "recent no snapshot")
let cf = content!
precondition(ContentResolvers.library(sourceId: nil, content: cf) == .downloads(items: cf.downloads, count: 12), "library default")
precondition(ContentResolvers.library(sourceId: "downloads", content: cf) == .downloads(items: cf.downloads, count: 12), "library downloads")
precondition(ContentResolvers.library(sourceId: "playlist:playlist_1", content: cf) == .playlist(cf.playlist("playlist_1")!), "library playlist")
precondition(ContentResolvers.library(sourceId: "playlist:playlist_2", content: cf) == .playlist(cf.playlist("playlist_2")!), "library uploads-only playlist")
precondition(ContentResolvers.library(sourceId: "playlist:gone", content: cf) == .playlistUnavailable, "library gone")
precondition(ContentResolvers.library(sourceId: "playlist:playlist_1", content: nil) == .noContent, "library no content")
let utc = TimeZone(identifier: "UTC")!
// Day 20737 is odd, so the second spotlight reciter.
precondition(ContentResolvers.spotlight(cf, date: Date(timeIntervalSince1970: 20737 * 86_400 + 3_600), timeZone: utc)?.id == "r-balilah", "spotlight rotation")
precondition(ContentResolvers.spotlight(nil, date: instant) == nil, "spotlight none")

// Text
precondition(ContentText.hijriLine(HijriDate(year: 1448, month: 4, day: 29), months: occasions.months) == "29 Rabi al-Thani 1448", "hijriLine")
precondition(ContentText.daysLabel(1) == "Tomorrow" && ContentText.daysLabel(23) == "in 23 days", "daysLabel")
precondition(ContentText.surahCount(1) == "1 surah" && ContentText.surahCount(12) == "12 surahs", "surahCount")
precondition(ContentText.repeatLabel(1) == nil && ContentText.repeatLabel(3) == "×3", "repeatLabel")
print("swift content logic: OK")
SWIFT

swift "$tmp/content-test.swift" "$fixtures" "$root/targets/widgets"
```

In `package.json`, append the new script to the existing `test:widget-fixtures` chain (after Phase 2 it reads `bash scripts/check-widget-fixtures.sh && bash scripts/check-widget-system-surfaces.sh`):

```json
    "test:widget-fixtures": "bash scripts/check-widget-fixtures.sh && bash scripts/check-widget-system-surfaces.sh && bash scripts/check-widget-content.sh",
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bash scripts/check-widget-content.sh`
Expected: FAIL with `cat: .../Support/ContentModels.swift: No such file or directory`.

- [ ] **Step 3: Write `ContentModels.swift`**

```swift
// targets/widgets/Support/ContentModels.swift
import Foundation

// content.json, written by the app (modules/bayaan-widgets/src/content.ts).
struct WidgetShelfItem: Codable, Hashable {
  let surahId: Int
  let surahName: String
  let reciterId: String
  let reciterName: String
  let rewayatId: String?
  let itemId: String?
}

struct WidgetPlaylist: Codable, Hashable {
  let id: String
  let name: String
  let itemCount: Int
  let items: [WidgetShelfItem]
}

struct WidgetSpotlightReciter: Codable, Hashable {
  let id: String
  let name: String
  let artworkFile: String
  let surahIds: [Int]
}

struct WidgetContent: Codable {
  static let supportedVersion = 1
  let version: Int
  let generatedAt: Double
  let downloads: [WidgetShelfItem]
  let downloadCount: Int
  let playlists: [WidgetPlaylist]
  let spotlight: [WidgetSpotlightReciter]
  let sleepTimerEndsAt: Double?

  static func decode(_ data: Data) -> WidgetContent? {
    guard let c = try? JSONDecoder().decode(WidgetContent.self, from: data),
          c.version == supportedVersion else { return nil }
    return c
  }

  func playlist(_ id: String) -> WidgetPlaylist? {
    playlists.first { $0.id == id }
  }
}

// adhkar-periods.json and occasions.json, generated by scripts/generate-widget-data.ts.
struct FeaturedDhikr: Codable, Hashable {
  let id: String
  let arabic: String
  let translation: String?
  let repeatCount: Int
}

struct AdhkarPeriodData: Codable, Hashable {
  let period: String
  let superId: String
  let title: String
  let arabicTitle: String
  let count: Int
  let featured: [FeaturedDhikr]
}

struct AdhkarPeriods: Codable {
  let morning: AdhkarPeriodData
  let evening: AdhkarPeriodData

  func data(for period: AdhkarPeriod) -> AdhkarPeriodData {
    period == .morning ? morning : evening
  }
}

struct HijriMonthName: Codable, Hashable {
  let number: Int
  let name: String
  let arabic: String
}

struct OccasionInfo: Codable, Hashable {
  let id: String
  let name: String
  let arabicName: String
  let listenSurahId: Int?
  let ayat: [StaticAyah]
}

struct OccasionData: Codable {
  let months: [HijriMonthName]
  let occasions: [OccasionInfo]

  func occasion(_ id: String?) -> OccasionInfo? {
    guard let id else { return nil }
    return occasions.first { $0.id == id }
  }

  func month(_ number: Int) -> HijriMonthName? {
    months.first { $0.number == number }
  }
}

struct HijriDate: Hashable {
  let year: Int
  let month: Int
  let day: Int
}
```

- [ ] **Step 4: Write `ContentLogic.swift`**

```swift
// targets/widgets/Support/ContentLogic.swift
import Foundation

enum AdhkarPeriod: String {
  case morning, evening
}

enum BayaanNowMode: String {
  case listening, occasion, morningAdhkar, eveningAdhkar, bedtime
}

struct UpcomingOccasion: Hashable {
  let id: String
  let days: Int
}

/// Phase 3 rules, tested by scripts/check-widget-content.sh. Mirrors
/// contextRules.ts (JS) and ContentLogic.kt (Android). Hours and weekdays use
/// the Gregorian calendar; Hijri dates use Umm al-Qura from the local
/// Gregorian day number, whatever calendar the device is set to.
enum ContentLogic {
  static let friday = 6
  static let jumuahEndHour = 18
  static let boundaryHours = [0, 4, 11, 12, 15, 18, 20, 21]
  static let nextOccasionHorizon = 400

  // Priority order; the Hijri windows do not overlap.
  private static let windows: [(id: String, month: Int, from: Int, to: Int)] = [
    ("eidFitr", 10, 1, 3), ("arafah", 12, 9, 9), ("eidAdha", 12, 10, 13), ("lastTen", 9, 21, 30),
    ("ramadan", 9, 1, 20), ("dhulHijjah", 12, 1, 8), ("ashura", 1, 9, 10),
  ]

  static let upcomingAnchors: [(id: String, month: Int, day: Int)] = [
    ("ramadan", 9, 1), ("eidFitr", 10, 1), ("dhulHijjah", 12, 1),
    ("arafah", 12, 9), ("eidAdha", 12, 10), ("ashura", 1, 10),
  ]

  private static func gregorian(_ timeZone: TimeZone) -> Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    return calendar
  }

  static func hour(_ date: Date, timeZone: TimeZone = .current) -> Int {
    gregorian(timeZone).component(.hour, from: date)
  }

  /// Sunday = 1, Friday = 6.
  static func weekday(_ date: Date, timeZone: TimeZone = .current) -> Int {
    gregorian(timeZone).component(.weekday, from: date)
  }

  /// Umm al-Qura date of a local Gregorian day number, read at 12:00 UTC.
  static func hijri(dayNumber: Int) -> HijriDate? {
    guard let utc = TimeZone(identifier: "UTC") else { return nil }
    var calendar = Calendar(identifier: .islamicUmmAlQura)
    calendar.timeZone = utc
    let noon = Date(timeIntervalSince1970: Double(dayNumber) * 86_400 + 43_200)
    let c = calendar.dateComponents([.year, .month, .day], from: noon)
    guard let y = c.year, let m = c.month, let d = c.day else { return nil }
    return HijriDate(year: y, month: m, day: d)
  }

  static func hijri(_ date: Date, timeZone: TimeZone = .current) -> HijriDate? {
    hijri(dayNumber: WidgetLogic.dayNumber(date, timeZone: timeZone))
  }

  static func adhkarPeriod(hour: Int) -> AdhkarPeriod {
    hour >= 4 && hour < 12 ? .morning : .evening
  }

  static func occasion(hijri: HijriDate?, weekday: Int, hour: Int) -> String? {
    if let h = hijri, let w = windows.first(where: { $0.month == h.month && h.day >= $0.from && h.day <= $0.to }) {
      return w.id
    }
    return weekday == friday && hour < jumuahEndHour ? "jumuah" : nil
  }

  static func occasion(at date: Date, timeZone: TimeZone = .current) -> String? {
    occasion(hijri: hijri(date, timeZone: timeZone), weekday: weekday(date, timeZone: timeZone),
             hour: hour(date, timeZone: timeZone))
  }

  static func mode(hour: Int, isPlaying: Bool, occasion: String?) -> BayaanNowMode {
    if isPlaying { return .listening }
    if occasion != nil { return .occasion }
    if hour >= 4 && hour < 11 { return .morningAdhkar }
    if hour >= 15 && hour < 20 { return .eveningAdhkar }
    if hour >= 21 || hour < 4 { return .bedtime }
    return .listening
  }

  static func relevance(mode: BayaanNowMode, isPlaying: Bool) -> Float {
    switch mode {
    case .listening: return isPlaying ? 1 : 0.2
    case .occasion: return 0.8
    case .morningAdhkar, .eveningAdhkar: return 0.7
    case .bedtime: return 0.6
    }
  }

  static func adhkarRelevance(hour: Int) -> Float {
    (hour >= 4 && hour < 11) || (hour >= 15 && hour < 20) ? 0.7 : 0.2
  }

  static func occasionRelevance(_ occasion: String?) -> Float {
    occasion != nil ? 0.8 : 0.1
  }

  static func bedtimeRelevance(hour: Int) -> Float {
    hour >= 21 || hour < 4 ? 0.6 : 0.1
  }

  /// Minutes since local midnight of the next boundary; 1440 is the next midnight.
  static func nextBoundaryMinutes(after minutes: Double) -> Int {
    for h in boundaryHours where Double(h * 60) > minutes { return h * 60 }
    return 1440
  }

  /// Local boundary times strictly after `date` and at most `within` seconds later.
  static func boundaries(after date: Date, within: TimeInterval = 86_400, timeZone: TimeZone = .current) -> [Date] {
    let calendar = gregorian(timeZone)
    let today = calendar.startOfDay(for: date)
    var out: [Date] = []
    for offset in 0...1 {
      guard let day = calendar.date(byAdding: .day, value: offset, to: today) else { continue }
      for h in boundaryHours {
        guard let d = calendar.date(bySettingHour: h, minute: 0, second: 0, of: day) else { continue }
        if d > date && d.timeIntervalSince(date) <= within { out.append(d) }
      }
    }
    return out.sorted()
  }

  /// Scans forward day by day; stops early when the converter returns nil.
  static func nextOccasions(today: Int, count: Int, horizon: Int = nextOccasionHorizon,
                            hijriOf: (Int) -> HijriDate?) -> [UpcomingOccasion] {
    var found: [UpcomingOccasion] = []
    var d = 1
    while d <= horizon && found.count < upcomingAnchors.count {
      guard let h = hijriOf(today + d) else { break }
      for a in upcomingAnchors where a.month == h.month && a.day == h.day && !found.contains(where: { $0.id == a.id }) {
        found.append(UpcomingOccasion(id: a.id, days: d))
      }
      d += 1
    }
    return Array(found.prefix(count))
  }

  static func sleepActive(endsAt: Double?, now: Date) -> Bool {
    guard let endsAt else { return false }
    return endsAt > now.timeIntervalSince1970 * 1000
  }
}

struct RecentShelf {
  let tracks: [WidgetTrack]
  /// True when the tracks are the popular-surah suggestion, not real history.
  let isSuggestion: Bool
}

enum LibraryShelfState: Hashable {
  case downloads(items: [WidgetShelfItem], count: Int)
  case playlist(WidgetPlaylist)
  case playlistUnavailable
  case noContent
}

/// Mirrors ContentLogic.kt (recentShelf, library, spotlight).
enum ContentResolvers {
  /// Al-Fatihah, Al-Kahf, Ya-Sin, Al-Mulk.
  static let popularSurahIds = [1, 18, 36, 67]
  static let downloadsSourceId = "downloads"
  static let playlistPrefix = "playlist:"

  static func recentShelf(_ snapshot: WidgetSnapshot?, limit: Int = 6) -> RecentShelf {
    guard let s = snapshot else { return RecentShelf(tracks: [], isSuggestion: false) }
    let real = s.recent.filter { !$0.isUserUpload && (1...114).contains($0.surahId) }
    if !real.isEmpty { return RecentShelf(tracks: Array(real.prefix(limit)), isSuggestion: false) }
    guard let d = s.defaultReciter else { return RecentShelf(tracks: [], isSuggestion: false) }
    let tracks = popularSurahIds.prefix(limit).map {
      WidgetTrack(surahId: $0, surahName: "", reciterId: d.id, reciterName: d.name,
                  rewayatId: nil, artworkFile: nil, isUserUpload: false)
    }
    return RecentShelf(tracks: tracks, isSuggestion: true)
  }

  static func library(sourceId: String?, content: WidgetContent?) -> LibraryShelfState {
    guard let content else { return .noContent }
    guard let sourceId, sourceId.hasPrefix(playlistPrefix) else {
      return .downloads(items: content.downloads, count: content.downloadCount)
    }
    let id = String(sourceId.dropFirst(playlistPrefix.count))
    return content.playlist(id).map { .playlist($0) } ?? .playlistUnavailable
  }

  static func spotlight(_ content: WidgetContent?, date: Date, timeZone: TimeZone = .current) -> WidgetSpotlightReciter? {
    guard let list = content?.spotlight, !list.isEmpty else { return nil }
    let i = WidgetLogic.ayahIndex(date, count: list.count, timeZone: timeZone)
    return i >= 0 ? list[i] : nil
  }
}

/// Mirrors ContentLogic.kt text helpers.
enum ContentText {
  static func hijriLine(_ h: HijriDate, months: [HijriMonthName]) -> String {
    let name = months.first { $0.number == h.month }?.name ?? String(h.month)
    return "\(h.day) \(name) \(h.year)"
  }

  static func daysLabel(_ days: Int) -> String {
    days == 1 ? "Tomorrow" : "in \(days) days"
  }

  static func surahCount(_ n: Int) -> String {
    n == 1 ? "1 surah" : "\(n) surahs"
  }

  static func repeatLabel(_ n: Int) -> String? {
    n > 1 ? "×\(n)" : nil
  }
}
```

- [ ] **Step 5: Run the check**

Run: `bash scripts/check-widget-content.sh`
Expected: `swift content decode: OK` then `swift content logic: OK`. A `hijri mismatch` means `ContentLogic.hijri` and the generator disagree: they must use the same identifier and the same 12:00 UTC instant.

- [ ] **Step 6: Write the stores, entities, chrome and intents**

```swift
// targets/widgets/Support/ContentStores.swift
import Foundation

enum ContentStore {
  static func load() -> WidgetContent? {
    guard let url = BayaanAppGroup.widgetsDir?.appendingPathComponent("content.json"),
          let data = try? Data(contentsOf: url) else { return nil }
    return WidgetContent.decode(data)
  }
}

/// adhkar-periods.json and occasions.json bundled in the extension.
enum ContentStaticData {
  static let adhkar: AdhkarPeriods? = load("adhkar-periods")
  static let occasions: OccasionData? = load("occasions")

  private static func load<T: Decodable>(_ name: String) -> T? {
    guard let url = Bundle.main.url(forResource: name, withExtension: "json"),
          let data = try? Data(contentsOf: url) else { return nil }
    return try? JSONDecoder().decode(T.self, from: data)
  }
}
```

```swift
// targets/widgets/Support/ContentEntities.swift
import AppIntents
import Foundation

/// Library Shelf source: Downloads, or one playlist from content.json.
struct LibrarySourceEntity: AppEntity {
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Library")
  static var defaultQuery = LibrarySourceQuery()

  let id: String
  let title: String

  var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(title)") }

  static let downloads = LibrarySourceEntity(id: ContentResolvers.downloadsSourceId, title: "Downloads")
}

struct LibrarySourceQuery: EntityQuery {
  private func all() -> [LibrarySourceEntity] {
    [.downloads] + (ContentStore.load()?.playlists ?? []).map {
      LibrarySourceEntity(id: ContentResolvers.playlistPrefix + $0.id, title: $0.name)
    }
  }

  // Unknown ids stay resolvable so the widget can say the playlist is gone.
  func entities(for identifiers: [String]) async throws -> [LibrarySourceEntity] {
    let list = all()
    return identifiers.map { id in
      list.first { $0.id == id } ?? LibrarySourceEntity(id: id, title: "Unavailable playlist")
    }
  }

  func suggestedEntities() async throws -> [LibrarySourceEntity] { all() }

  func defaultResult() async -> LibrarySourceEntity? { .downloads }
}

enum SleepMinutesOption: String, AppEnum {
  case m15 = "15", m30 = "30", m45 = "45", m60 = "60"

  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Sleep timer")
  static var caseDisplayRepresentations: [SleepMinutesOption: DisplayRepresentation] = [
    .m15: "15 minutes", .m30: "30 minutes", .m45: "45 minutes", .m60: "60 minutes",
  ]

  var minutes: Int { Int(rawValue) ?? 30 }
}

/// Raw values match WIDGET_AMBIENT_SOUNDS in commands.ts; off sends null.
enum AmbientOption: String, AppEnum {
  case off, rain, forest, ocean, stream, thunder, fireplace, wind

  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Ambient sound")
  static var caseDisplayRepresentations: [AmbientOption: DisplayRepresentation] = [
    .off: "Off", .rain: "Rain", .forest: "Forest", .ocean: "Ocean", .stream: "Stream",
    .thunder: "Thunder", .fireplace: "Fireplace", .wind: "Wind",
  ]

  var commandValue: String? { self == .off ? nil : rawValue }
  var label: String? { self == .off ? nil : rawValue.prefix(1).uppercased() + rawValue.dropFirst() }
}
```

```swift
// targets/widgets/Support/ContentChrome.swift
import AppIntents
import SwiftUI
import WidgetKit

/// Shelf title row: optional leading control, title and detail, Bayaan mark.
struct ShelfHeader<Leading: View>: View {
  let title: String
  var detail: String? = nil
  @ViewBuilder var leading: () -> Leading

  var body: some View {
    HStack(spacing: 8) {
      leading()
      VStack(alignment: .leading, spacing: 1) {
        Text(title).font(.subheadline.weight(.bold)).lineLimit(1)
        if let detail { Text(detail).font(.caption2).opacity(0.6).lineLimit(1) }
      }
      Spacer(minLength: 0)
      BayaanLogo(size: 14)
    }
  }
}

extension ShelfHeader where Leading == EmptyView {
  init(title: String, detail: String? = nil) {
    self.init(title: title, detail: detail) { EmptyView() }
  }
}

/// A surah card that runs an intent when tapped, with an optional caption.
struct SurahTileButton<I: AppIntent>: View {
  let surahId: Int
  let size: CGFloat
  let intent: I
  var caption: String? = nil

  var body: some View {
    Button(intent: intent) {
      VStack(spacing: 3) {
        SurahCard(surah: StaticData.surah(surahId), size: size)
        if let caption {
          Text(caption).font(.caption2.weight(.medium)).opacity(0.75).lineLimit(1).frame(width: size)
        }
      }
    }
    .buttonStyle(.plain)
    .accessibilityLabel(StaticData.surah(surahId)?.name ?? "")
  }
}

/// Centered message for empty and unavailable states.
struct ContentMessage: View {
  let title: String
  var detail: String? = nil

  var body: some View {
    VStack(spacing: 4) {
      BayaanLogo(size: 18)
      Text(title).font(.caption.weight(.bold)).multilineTextAlignment(.center)
      if let detail {
        Text(detail).font(.caption2).opacity(0.6).multilineTextAlignment(.center)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .padding(12)
  }
}

/// Dhikr and Arabic labels in Scheherazade New (not Quran text).
struct DhikrText: View {
  let text: String
  let size: CGFloat
  let lines: Int
  var alignment: TextAlignment = .center

  var body: some View {
    Text(text)
      .font(WidgetFonts.dhikr(size))
      .multilineTextAlignment(alignment)
      .lineLimit(lines)
      .minimumScaleFactor(0.5)
      .environment(\.layoutDirection, .rightToLeft)
  }
}

extension TimelineEntryRelevance {
  /// Relevance that lasts until the next entry (one hour when there is none).
  static func scored(_ score: Float, from date: Date, until next: Date?) -> TimelineEntryRelevance {
    TimelineEntryRelevance(score: score, duration: max(60, (next ?? date.addingTimeInterval(3_600)).timeIntervalSince(date)))
  }
}
```

```swift
// targets/widgets/_shared/ContentIntents.swift
import AppIntents
import Foundation

// AudioPlaybackIntents run in the app process, like PlayTrackIntent. They
// only enqueue a command; services/widgets/contentCommands.ts does the work.

/// Queues a playlist starting at an item (Library Shelf).
@available(iOS 17.0, *)
struct PlayPlaylistIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play Playlist"
  static var isDiscoverable = false

  @Parameter(title: "Playlist") var playlistId: String
  @Parameter(title: "Item") var itemId: String?

  init() {}

  init(playlistId: String, itemId: String?) {
    self.playlistId = playlistId
    self.itemId = itemId
  }

  func perform() async throws -> some IntentResult {
    WidgetCommandQueue.enqueue([
      "type": "playPlaylist",
      "playlistId": playlistId,
      "itemId": itemId ?? NSNull(),
    ])
    return .result()
  }
}

/// Plays a surah from the start, sets the sleep timer, optionally starts ambient (Bedtime).
@available(iOS 17.0, *)
struct StartBedtimeIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Start Bedtime"
  static var isDiscoverable = false

  @Parameter(title: "Surah") var surahId: Int
  @Parameter(title: "Reciter") var reciterId: String?
  @Parameter(title: "Minutes") var sleepMinutes: Int
  @Parameter(title: "Ambient") var ambient: String?

  init() {}

  init(surahId: Int, reciterId: String?, sleepMinutes: Int, ambient: String?) {
    self.surahId = surahId
    self.reciterId = reciterId
    self.sleepMinutes = sleepMinutes
    self.ambient = ambient
  }

  func perform() async throws -> some IntentResult {
    WidgetCommandQueue.enqueue([
      "type": "startBedtime",
      "surahId": surahId,
      "reciterId": reciterId ?? NSNull(),
      "sleepMinutes": sleepMinutes,
      "ambient": ambient ?? NSNull(),
    ])
    return .result()
  }
}
```

- [ ] **Step 7: Add `writeContent` to the iOS module**

In `modules/bayaan-widgets/ios/BayaanWidgetsModule.swift`, directly after the `Function("writeCatalog")` block, add:

```swift
    Function("writeContent") { (json: String) in
      guard let dir = widgetsDir() else { return }
      try? json.data(using: .utf8)?.write(
        to: dir.appendingPathComponent("content.json"), options: .atomic)
    }
```

- [ ] **Step 8: Build to verify the shared and extension code compiles**

```bash
npm run test:widget-fixtures
npm run prebuild
xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20
```
Expected: all three Swift checks print OK; the build ends with `** BUILD SUCCEEDED **`. If `AppEnum` rejects the `String` raw values, change nothing else and report: both enums are already `String`-backed, the shape Apple documents.

- [ ] **Step 9: Commit**

```bash
git add scripts/check-widget-content.sh package.json targets/widgets/_shared/ContentIntents.swift targets/widgets/Support/ContentModels.swift targets/widgets/Support/ContentLogic.swift targets/widgets/Support/ContentStores.swift targets/widgets/Support/ContentEntities.swift targets/widgets/Support/ContentChrome.swift modules/bayaan-widgets/ios/BayaanWidgetsModule.swift
git status --short ios/   # commit regenerated ios/ files only if prebuild changed tracked ones
git commit -m "feat(widgets): add the iOS content bridge, intents and support layer"
```

---
### Task 5: Android support layer (content storage, models, rules, Hijri, clock)

**Files:**
- Create: `modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/ContentModels.kt`, `ContentLogic.kt`, `ContentConfig.kt`, `IcuHijri.kt`, `ContextClockReceiver.kt`, `ui/ContentUi.kt`; `modules/bayaan-widgets/android/src/test/java/expo/modules/bayaanwidgets/ContentLogicTest.kt`
- Modify: `WidgetStorage.kt`, `GlanceState.kt`, `BayaanWidgetsModule.kt`, `modules/bayaan-widgets/android/src/main/AndroidManifest.xml`

**Interfaces:**
- Consumes: `DayMath.dayNumber/ayahIndex`, `StaticData`, `StaticAyah`, `WidgetSnapshot`, `WidgetTrack`, `SnapshotModels` (1a/1b); `ui.WidgetColors`, `Logo`, `SurahCard` (1b); fixtures from Tasks 1 to 3.
- Produces (Kotlin names used by Tasks 7 to 10):
  - `WidgetStorage.writeContent(context, json)`, `WidgetStorage.readContentJson(context): String?`; module function `writeContent(json)`
  - `WidgetInputs.contentJson: String?` (new last field, default null), carried by `GlanceState.stored/current/push`
  - Models `WidgetShelfItem`, `WidgetPlaylist`, `WidgetSpotlightReciter`, `WidgetContent` (`playlist(id)`), `FeaturedDhikr`, `AdhkarPeriodData`, `AdhkarPeriods` (`of(period)`), `HijriMonthName`, `OccasionInfo`, `OccasionData` (`occasion(id)`, `month(n)`), `HijriDate`; `ContentModels.decodeContent/decodeAdhkarPeriods/decodeOccasions`; `ContentStaticData.adhkar(context)`, `ContentStaticData.occasions(context)`
  - `enum class AdhkarPeriod { MORNING, EVENING }`, `enum class BayaanNowMode(val wire: String)`, `data class UpcomingOccasion(id, days)`, `fun interface HijriOf { fun at(dayNumber: Long): HijriDate? }`, `RecentShelf`, `sealed class LibraryShelfState { Downloads, Playlist, PlaylistUnavailable, NoContent }`
  - `ContentLogic`: `hour`, `weekday`, `hijri(nowMs, tz, hijriOf)`, `adhkarPeriod`, `occasion`, `occasionAt`, `mode`, `nextBoundaryMinutes`, `nextBoundaryMs`, `nextOccasions`, `sleepActive`, `recentShelf`, `library`, `spotlight`, `hijriLine`, `daysLabel`, `surahCount`, `repeatLabel`
  - `IcuHijri : HijriOf` (android.icu Umm al-Qura)
  - `ContentConfigJson`: `LibraryShelfConfig`, `BedtimeConfig`, `decodeLibraryShelf`, `decodeBedtime`, `encode(...)`, `BEDTIME_MINUTES`, `AMBIENT_SOUNDS`, `DEFAULT_BEDTIME`, `ambientLabel`
  - `ContextClockReceiver` with `TARGETS: List<ClockTarget>` (empty here; widget tasks add entries), `schedule(context)`, `cancelIfUnused(context)`
  - `ui`: `ShelfHeader(title, detail, leading?)`, `SurahTile(context, surahId, sizeDp, action, caption?)`, `ContentMessage(modifier, title, detail)`, `contentRoot()`, `clockTime(context, epochMs)`

- [ ] **Step 1: Write the failing Kotlin test**

```kotlin
// test/java/expo/modules/bayaanwidgets/ContentLogicTest.kt
package expo.modules.bayaanwidgets

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.time.LocalDate
import java.time.chrono.HijrahDate
import java.time.temporal.ChronoField
import java.util.TimeZone

class ContentLogicTest {
  private fun fixture(name: String) = File("../src/__fixtures__/$name").readText()
  private fun asset(name: String) = File("src/main/assets/widgets/$name").readText()

  // java.time's Hijrah calendar is Umm al-Qura. Devices use android.icu (IcuHijri), which the JVM lacks.
  private val javaHijri = HijriOf { day ->
    val h = HijrahDate.from(LocalDate.ofEpochDay(day))
    HijriDate(h.get(ChronoField.YEAR), h.get(ChronoField.MONTH_OF_YEAR), h.get(ChronoField.DAY_OF_MONTH))
  }

  private val table = JSONObject(fixture("hijri.table.json"))
  private val from = table.getLong("from")
  private val rows = table.getJSONArray("rows")
  private val tableHijri = HijriOf { day ->
    val i = (day - from).toInt()
    if (i < 0 || i >= rows.length()) null else rows.getJSONArray(i).let { HijriDate(it.getInt(0), it.getInt(1), it.getInt(2)) }
  }

  private val content = ContentModels.decodeContent(fixture("content.full.json"))!!

  @Test fun decodesContentAndRejectsFutureVersion() {
    assertEquals(2, content.downloads.size)
    assertEquals(12, content.downloadCount)
    assertEquals(listOf("item_1", "item_2"), content.playlist("playlist_1")!!.items.map { it.itemId })
    assertNull(content.playlist("playlist_1")!!.items[0].rewayatId)
    assertEquals(listOf(1, 18, 36), content.spotlight[0].surahIds)
    assertEquals(1_791_462_600_000L, content.sleepTimerEndsAt)
    assertNull(ContentModels.decodeContent(fixture("content.full.json").replace("\"version\": 1", "\"version\": 2")))
    assertNull(ContentModels.decodeContent("nope"))
    assertNull(ContentModels.decodeContent(fixture("content.full.json").replace("\"sleepTimerEndsAt\": 1791462600000", "\"sleepTimerEndsAt\": null"))!!.sleepTimerEndsAt)
  }

  @Test fun parsesGeneratedStaticData() {
    val adhkar = ContentModels.decodeAdhkarPeriods(asset("adhkar-periods.json"))!!
    assertEquals(24, adhkar.morning.count)
    assertEquals("evening-adhkar", adhkar.of(AdhkarPeriod.EVENING).superId)
    assertTrue(adhkar.evening.featured.any { it.id == "97" } && adhkar.morning.featured.none { it.id == "97" })
    val occasions = ContentModels.decodeOccasions(asset("occasions.json"))!!
    assertEquals(12, occasions.months.size)
    assertEquals(listOf("eidFitr", "arafah", "eidAdha", "lastTen", "ramadan", "dhulHijjah", "ashura", "jumuah"), occasions.occasions.map { it.id })
    assertEquals(18, occasions.occasion("jumuah")!!.listenSurahId)
    assertTrue(occasions.occasions.all { o -> o.ayat.isNotEmpty() && o.ayat.all { it.arabic.isNotEmpty() && it.translation.isNotEmpty() } })
  }

  @Test fun javaUmmAlQuraMatchesTheTable() {
    for (i in 0 until rows.length()) assertEquals("day ${from + i}", tableHijri.at(from + i), javaHijri.at(from + i))
    assertEquals(HijriDate(1447, 9, 1), tableHijri.at(20502))
  }

  @Test fun ruleVectors() {
    val v = JSONObject(fixture("context.vectors.json"))
    v.getJSONArray("adhkarPeriod").let { a ->
      for (i in 0 until a.length()) {
        val p = a.getJSONArray(i)
        assertEquals("$p", p.getString(1), ContentLogic.adhkarPeriod(p.getInt(0)).name.lowercase())
      }
    }
    v.getJSONArray("occasion").let { a ->
      for (i in 0 until a.length()) {
        val c = a.getJSONObject(i)
        val h = if (c.isNull("hijri")) null else c.getJSONArray("hijri").let { HijriDate(it.getInt(0), it.getInt(1), it.getInt(2)) }
        val expect = if (c.isNull("expect")) null else c.getString("expect")
        assertEquals("$c", expect, ContentLogic.occasion(h, c.getInt("weekday"), c.getInt("hour")))
      }
    }
    v.getJSONArray("mode").let { a ->
      for (i in 0 until a.length()) {
        val c = a.getJSONObject(i)
        val occasion = if (c.isNull("occasion")) null else c.getString("occasion")
        assertEquals("$c", c.getString("expect"), ContentLogic.mode(c.getInt("hour"), c.getBoolean("playing"), occasion).wire)
      }
    }
    v.getJSONArray("nextBoundary").let { a ->
      for (i in 0 until a.length()) {
        val p = a.getJSONArray(i)
        assertEquals("$p", p.getInt(1), ContentLogic.nextBoundaryMinutes(p.getDouble(0)))
      }
    }
    v.getJSONArray("sleepActive").let { a ->
      for (i in 0 until a.length()) {
        val p = a.getJSONArray(i)
        val endsAt = if (p.isNull(0)) null else p.getLong(0)
        assertEquals("$p", p.getBoolean(2), ContentLogic.sleepActive(endsAt, p.getLong(1)))
      }
    }
  }

  @Test fun nextOccasionVectors() {
    val nv = JSONObject(fixture("next-occasions.vectors.json"))
    val count = nv.getInt("count")
    val cases = nv.getJSONArray("cases")
    for (i in 0 until cases.length()) {
      val c = cases.getJSONObject(i)
      val today = c.getLong("today")
      val e = c.getJSONArray("expect")
      val expect = (0 until e.length()).map { e.getJSONObject(it).let { o -> UpcomingOccasion(o.getString("id"), o.getInt("days")) } }
      assertEquals("table $today", expect, ContentLogic.nextOccasions(today, count, tableHijri))
      assertEquals("java $today", expect, ContentLogic.nextOccasions(today, count, javaHijri))
    }
  }

  @Test fun timeZones() {
    // 2026-02-19T03:30Z: 22:30 Wednesday 18 Feb in New York (1 Ramadan 1447), 12:30 Thursday 19 Feb in Tokyo.
    val now = 1_771_471_800_000L
    val ny = TimeZone.getTimeZone("America/New_York")
    val tokyo = TimeZone.getTimeZone("Asia/Tokyo")
    assertEquals(HijriDate(1447, 9, 1), ContentLogic.hijri(now, ny, tableHijri))
    assertEquals(tableHijri.at(20503), ContentLogic.hijri(now, tokyo, tableHijri))
    assertEquals(22, ContentLogic.hour(now, ny))
    assertEquals(4, ContentLogic.weekday(now, ny))
    assertEquals(12, ContentLogic.hour(now, tokyo))
    assertEquals(5, ContentLogic.weekday(now, tokyo))
    assertEquals("ramadan", ContentLogic.occasionAt(now, ny, tableHijri))
    assertEquals(1_771_477_200_000L, ContentLogic.nextBoundaryMs(now, ny)) // 00:00 Thursday in New York
  }

  @Test fun resolvers() {
    val full = SnapshotModels.decode(fixture("snapshot.full.json"))!!
    val upload = WidgetTrack(0, "Talk", "me", "Me", null, null, true)
    val kahf = full.nowPlaying!!.track
    val shelf = ContentLogic.recentShelf(full.copy(nowPlaying = null, recent = listOf(upload, kahf)))
    assertEquals(listOf(kahf), shelf.tracks)
    assertFalse(shelf.isSuggestion)
    val suggestion = ContentLogic.recentShelf(full.copy(recent = listOf(upload)), 4)
    assertTrue(suggestion.isSuggestion)
    assertEquals(listOf(1, 18, 36, 67), suggestion.tracks.map { it.surahId })
    assertTrue(suggestion.tracks.all { it.reciterId == "r-alafasi" })
    assertTrue(ContentLogic.recentShelf(full.copy(recent = emptyList(), defaultReciter = null)).tracks.isEmpty())
    assertTrue(ContentLogic.recentShelf(null).tracks.isEmpty())

    assertEquals(LibraryShelfState.Downloads(content.downloads, 12), ContentLogic.library(null, content))
    assertEquals(LibraryShelfState.Downloads(content.downloads, 12), ContentLogic.library("downloads", content))
    assertEquals(LibraryShelfState.Playlist(content.playlist("playlist_1")!!), ContentLogic.library("playlist:playlist_1", content))
    assertEquals(LibraryShelfState.Playlist(content.playlist("playlist_2")!!), ContentLogic.library("playlist:playlist_2", content))
    assertEquals(LibraryShelfState.PlaylistUnavailable, ContentLogic.library("playlist:gone", content))
    assertEquals(LibraryShelfState.NoContent, ContentLogic.library("playlist:playlist_1", null))

    val utc = TimeZone.getTimeZone("UTC")
    assertEquals("r-balilah", ContentLogic.spotlight(content, 20737L * 86_400_000L + 3_600_000L, utc)!!.id) // odd day: second entry
    assertNull(ContentLogic.spotlight(null, 0L, utc))
  }

  @Test fun configsDefaultAndSanitize() {
    assertEquals(ContentConfigJson.DEFAULT_BEDTIME, ContentConfigJson.decodeBedtime(null))
    assertEquals(
      BedtimeConfig(67, "r1", 30, null),
      ContentConfigJson.decodeBedtime("""{"surahId":200,"reciterId":"r1","minutes":7,"ambient":"waves"}"""),
    )
    val custom = BedtimeConfig(36, null, 45, "rain")
    assertEquals(custom, ContentConfigJson.decodeBedtime(ContentConfigJson.encode(custom)))
    assertEquals("downloads", ContentConfigJson.decodeLibraryShelf(null).sourceId)
    assertEquals("playlist:p1", ContentConfigJson.decodeLibraryShelf(ContentConfigJson.encode(LibraryShelfConfig("playlist:p1"))).sourceId)
    assertEquals("Off", ContentConfigJson.ambientLabel(null))
    assertEquals("Fireplace", ContentConfigJson.ambientLabel("fireplace"))
  }

  @Test fun textHelpers() {
    val months = ContentModels.decodeOccasions(asset("occasions.json"))!!.months
    assertEquals("29 Rabi al-Thani 1448", ContentLogic.hijriLine(HijriDate(1448, 4, 29), months))
    assertEquals("Tomorrow", ContentLogic.daysLabel(1))
    assertEquals("in 23 days", ContentLogic.daysLabel(23))
    assertEquals("1 surah", ContentLogic.surahCount(1))
    assertEquals("12 surahs", ContentLogic.surahCount(12))
    assertNull(ContentLogic.repeatLabel(1))
    assertEquals("×3", ContentLogic.repeatLabel(3))
  }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd android && ./gradlew :bayaan-widgets:testReleaseUnitTest --tests '*ContentLogicTest*' && cd ..`
Expected: FAIL at compile time with unresolved references (`ContentModels`, `HijriOf`, ...).

- [ ] **Step 3: Write `ContentModels.kt`**

```kotlin
// main/java/expo/modules/bayaanwidgets/ContentModels.kt
package expo.modules.bayaanwidgets

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class WidgetShelfItem(
  val surahId: Int, val surahName: String, val reciterId: String, val reciterName: String,
  val rewayatId: String?, val itemId: String?,
)
data class WidgetPlaylist(val id: String, val name: String, val itemCount: Int, val items: List<WidgetShelfItem>)
data class WidgetSpotlightReciter(val id: String, val name: String, val artworkFile: String, val surahIds: List<Int>)
data class WidgetContent(
  val generatedAt: Long, val downloads: List<WidgetShelfItem>, val downloadCount: Int,
  val playlists: List<WidgetPlaylist>, val spotlight: List<WidgetSpotlightReciter>, val sleepTimerEndsAt: Long?,
) {
  fun playlist(id: String): WidgetPlaylist? = playlists.firstOrNull { it.id == id }
}

data class FeaturedDhikr(val id: String, val arabic: String, val translation: String?, val repeatCount: Int)
data class AdhkarPeriodData(
  val period: String, val superId: String, val title: String, val arabicTitle: String, val count: Int,
  val featured: List<FeaturedDhikr>,
)
data class AdhkarPeriods(val morning: AdhkarPeriodData, val evening: AdhkarPeriodData) {
  fun of(period: AdhkarPeriod): AdhkarPeriodData = if (period == AdhkarPeriod.MORNING) morning else evening
}
data class HijriMonthName(val number: Int, val name: String, val arabic: String)
data class OccasionInfo(val id: String, val name: String, val arabicName: String, val listenSurahId: Int?, val ayat: List<StaticAyah>)
data class OccasionData(val months: List<HijriMonthName>, val occasions: List<OccasionInfo>) {
  fun occasion(id: String?): OccasionInfo? = id?.let { wanted -> occasions.firstOrNull { it.id == wanted } }
  fun month(number: Int): HijriMonthName? = months.firstOrNull { it.number == number }
}
data class HijriDate(val year: Int, val month: Int, val day: Int)

/** Decoders for content.json (content.ts) and the generated adhkar and occasion data. */
object ContentModels {
  const val VERSION = 1

  private fun JSONObject.stringOrNull(key: String): String? = if (!has(key) || isNull(key)) null else getString(key)
  private fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }
  private fun JSONArray.ints(): List<Int> = (0 until length()).map { getInt(it) }

  private fun item(o: JSONObject) = WidgetShelfItem(
    o.getInt("surahId"), o.getString("surahName"), o.getString("reciterId"), o.getString("reciterName"),
    o.stringOrNull("rewayatId"), o.stringOrNull("itemId"),
  )

  /** Null for malformed JSON or another version. */
  fun decodeContent(json: String): WidgetContent? = try {
    val o = JSONObject(json)
    if (o.getInt("version") != VERSION) null else WidgetContent(
      o.getLong("generatedAt"),
      o.getJSONArray("downloads").objects().map(::item),
      o.getInt("downloadCount"),
      o.getJSONArray("playlists").objects().map { p ->
        WidgetPlaylist(p.getString("id"), p.getString("name"), p.getInt("itemCount"), p.getJSONArray("items").objects().map(::item))
      },
      o.getJSONArray("spotlight").objects().map { s ->
        WidgetSpotlightReciter(s.getString("id"), s.getString("name"), s.getString("artworkFile"), s.getJSONArray("surahIds").ints())
      },
      if (o.isNull("sleepTimerEndsAt")) null else o.getLong("sleepTimerEndsAt"),
    )
  } catch (e: Exception) { null }

  private fun period(o: JSONObject) = AdhkarPeriodData(
    o.getString("period"), o.getString("superId"), o.getString("title"), o.getString("arabicTitle"), o.getInt("count"),
    o.getJSONArray("featured").objects().map {
      FeaturedDhikr(it.getString("id"), it.getString("arabic"), it.stringOrNull("translation"), it.getInt("repeatCount"))
    },
  )

  fun decodeAdhkarPeriods(json: String): AdhkarPeriods? = try {
    val o = JSONObject(json)
    AdhkarPeriods(period(o.getJSONObject("morning")), period(o.getJSONObject("evening")))
  } catch (e: Exception) { null }

  fun decodeOccasions(json: String): OccasionData? = try {
    val o = JSONObject(json)
    OccasionData(
      o.getJSONArray("months").objects().map { HijriMonthName(it.getInt("number"), it.getString("name"), it.getString("arabic")) },
      o.getJSONArray("occasions").objects().map { x ->
        OccasionInfo(
          x.getString("id"), x.getString("name"), x.getString("arabicName"),
          if (x.isNull("listenSurahId")) null else x.getInt("listenSurahId"),
          StaticData.parseAyat(x.getJSONArray("ayat").toString()),
        )
      },
    )
  } catch (e: Exception) { null }
}

/** adhkar-periods.json and occasions.json from assets/widgets (scripts/generate-widget-data.ts). */
object ContentStaticData {
  @Volatile private var adhkar: AdhkarPeriods? = null
  @Volatile private var occasions: OccasionData? = null

  fun adhkar(context: Context): AdhkarPeriods? =
    adhkar ?: readAsset(context, "widgets/adhkar-periods.json")?.let { ContentModels.decodeAdhkarPeriods(it) }?.also { adhkar = it }

  fun occasions(context: Context): OccasionData? =
    occasions ?: readAsset(context, "widgets/occasions.json")?.let { ContentModels.decodeOccasions(it) }?.also { occasions = it }

  private fun readAsset(context: Context, path: String): String? = try {
    context.assets.open(path).bufferedReader().use { it.readText() }
  } catch (e: Exception) { null }
}
```

- [ ] **Step 4: Write `ContentLogic.kt`, `ContentConfig.kt` and `IcuHijri.kt`**

```kotlin
// main/java/expo/modules/bayaanwidgets/ContentLogic.kt
package expo.modules.bayaanwidgets

import java.util.Calendar
import java.util.GregorianCalendar
import java.util.Locale
import java.util.TimeZone

enum class AdhkarPeriod { MORNING, EVENING }

enum class BayaanNowMode(val wire: String) {
  LISTENING("listening"), OCCASION("occasion"), MORNING_ADHKAR("morningAdhkar"),
  EVENING_ADHKAR("eveningAdhkar"), BEDTIME("bedtime"),
}

data class UpcomingOccasion(val id: String, val days: Int)

/** Converts a local Gregorian day number (DayMath.dayNumber) to an Umm al-Qura date. */
fun interface HijriOf {
  fun at(dayNumber: Long): HijriDate?
}

data class RecentShelf(val tracks: List<WidgetTrack>, val isSuggestion: Boolean)

sealed class LibraryShelfState {
  data class Downloads(val items: List<WidgetShelfItem>, val count: Int) : LibraryShelfState()
  data class Playlist(val playlist: WidgetPlaylist) : LibraryShelfState()
  object PlaylistUnavailable : LibraryShelfState()
  object NoContent : LibraryShelfState()
}

/**
 * Phase 3 rules. Mirrors contextRules.ts and ContentLogic.swift. Hours and
 * weekdays are Gregorian whatever calendar the device uses. Relevance scores
 * are iOS only: Android has no Smart Stack.
 */
object ContentLogic {
  const val FRIDAY = 6
  const val JUMUAH_END_HOUR = 18
  const val NEXT_OCCASION_HORIZON = 400
  val BOUNDARY_HOURS = listOf(0, 4, 11, 12, 15, 18, 20, 21)
  /** Al-Fatihah, Al-Kahf, Ya-Sin, Al-Mulk. */
  val POPULAR_SURAH_IDS = listOf(1, 18, 36, 67)
  const val DOWNLOADS = "downloads"
  const val PLAYLIST_PREFIX = "playlist:"

  private data class Window(val id: String, val month: Int, val from: Int, val to: Int)
  // Priority order; the Hijri windows do not overlap.
  private val WINDOWS = listOf(
    Window("eidFitr", 10, 1, 3), Window("arafah", 12, 9, 9), Window("eidAdha", 12, 10, 13),
    Window("lastTen", 9, 21, 30), Window("ramadan", 9, 1, 20), Window("dhulHijjah", 12, 1, 8),
    Window("ashura", 1, 9, 10),
  )

  private data class Anchor(val id: String, val month: Int, val day: Int)
  private val ANCHORS = listOf(
    Anchor("ramadan", 9, 1), Anchor("eidFitr", 10, 1), Anchor("dhulHijjah", 12, 1),
    Anchor("arafah", 12, 9), Anchor("eidAdha", 12, 10), Anchor("ashura", 1, 10),
  )

  private fun calendar(nowMs: Long, tz: TimeZone): Calendar =
    GregorianCalendar(tz, Locale.US).apply { timeInMillis = nowMs }

  fun hour(nowMs: Long, tz: TimeZone): Int = calendar(nowMs, tz).get(Calendar.HOUR_OF_DAY)

  /** Sunday = 1, Friday = 6. */
  fun weekday(nowMs: Long, tz: TimeZone): Int = calendar(nowMs, tz).get(Calendar.DAY_OF_WEEK)

  fun hijri(nowMs: Long, tz: TimeZone, hijriOf: HijriOf): HijriDate? = hijriOf.at(DayMath.dayNumber(nowMs, tz))

  fun adhkarPeriod(hour: Int): AdhkarPeriod = if (hour in 4..11) AdhkarPeriod.MORNING else AdhkarPeriod.EVENING

  fun occasion(hijri: HijriDate?, weekday: Int, hour: Int): String? {
    val hit = hijri?.let { h -> WINDOWS.firstOrNull { it.month == h.month && h.day in it.from..it.to } }
    if (hit != null) return hit.id
    return if (weekday == FRIDAY && hour < JUMUAH_END_HOUR) "jumuah" else null
  }

  fun occasionAt(nowMs: Long, tz: TimeZone, hijriOf: HijriOf): String? =
    occasion(hijri(nowMs, tz, hijriOf), weekday(nowMs, tz), hour(nowMs, tz))

  fun mode(hour: Int, isPlaying: Boolean, occasion: String?): BayaanNowMode = when {
    isPlaying -> BayaanNowMode.LISTENING
    occasion != null -> BayaanNowMode.OCCASION
    hour in 4..10 -> BayaanNowMode.MORNING_ADHKAR
    hour in 15..19 -> BayaanNowMode.EVENING_ADHKAR
    hour >= 21 || hour < 4 -> BayaanNowMode.BEDTIME
    else -> BayaanNowMode.LISTENING
  }

  /** Minutes since local midnight of the next boundary; 1440 is the next midnight. */
  fun nextBoundaryMinutes(minutes: Double): Int = BOUNDARY_HOURS.firstOrNull { it * 60 > minutes }?.let { it * 60 } ?: 1440

  fun nextBoundaryMs(nowMs: Long, tz: TimeZone): Long {
    val c = calendar(nowMs, tz)
    val minutes = c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE) + c.get(Calendar.SECOND) / 60.0
    val next = nextBoundaryMinutes(minutes)
    c.set(Calendar.HOUR_OF_DAY, 0)
    c.set(Calendar.MINUTE, 0)
    c.set(Calendar.SECOND, 0)
    c.set(Calendar.MILLISECOND, 0)
    if (next >= 1440) c.add(Calendar.DAY_OF_MONTH, 1) else c.set(Calendar.HOUR_OF_DAY, next / 60)
    return c.timeInMillis
  }

  /** Scans forward day by day; stops early when the converter returns null. */
  fun nextOccasions(today: Long, count: Int, hijriOf: HijriOf, horizon: Int = NEXT_OCCASION_HORIZON): List<UpcomingOccasion> {
    val found = mutableListOf<UpcomingOccasion>()
    var d = 1
    while (d <= horizon && found.size < ANCHORS.size) {
      val h = hijriOf.at(today + d) ?: break
      for (a in ANCHORS) {
        if (a.month == h.month && a.day == h.day && found.none { it.id == a.id }) found.add(UpcomingOccasion(a.id, d))
      }
      d++
    }
    return found.take(count)
  }

  fun sleepActive(endsAt: Long?, nowMs: Long): Boolean = endsAt != null && endsAt > nowMs

  fun recentShelf(snapshot: WidgetSnapshot?, limit: Int = 6): RecentShelf {
    val s = snapshot ?: return RecentShelf(emptyList(), false)
    val real = s.recent.filter { !it.isUserUpload && it.surahId in 1..114 }
    if (real.isNotEmpty()) return RecentShelf(real.take(limit), false)
    val d = s.defaultReciter ?: return RecentShelf(emptyList(), false)
    return RecentShelf(POPULAR_SURAH_IDS.take(limit).map { WidgetTrack(it, "", d.id, d.name, null, null, false) }, true)
  }

  fun library(sourceId: String?, content: WidgetContent?): LibraryShelfState {
    val c = content ?: return LibraryShelfState.NoContent
    if (sourceId == null || !sourceId.startsWith(PLAYLIST_PREFIX)) return LibraryShelfState.Downloads(c.downloads, c.downloadCount)
    return c.playlist(sourceId.removePrefix(PLAYLIST_PREFIX))?.let { LibraryShelfState.Playlist(it) } ?: LibraryShelfState.PlaylistUnavailable
  }

  fun spotlight(content: WidgetContent?, nowMs: Long, tz: TimeZone): WidgetSpotlightReciter? {
    val list = content?.spotlight?.takeIf { it.isNotEmpty() } ?: return null
    return list.getOrNull(DayMath.ayahIndex(nowMs, tz, list.size))
  }

  fun hijriLine(h: HijriDate, months: List<HijriMonthName>): String =
    "${h.day} ${months.firstOrNull { it.number == h.month }?.name ?: h.month.toString()} ${h.year}"

  fun daysLabel(days: Int): String = if (days == 1) "Tomorrow" else "in $days days"

  fun surahCount(n: Int): String = if (n == 1) "1 surah" else "$n surahs"

  fun repeatLabel(n: Int): String? = if (n > 1) "×$n" else null
}
```

```kotlin
// main/java/expo/modules/bayaanwidgets/ContentConfig.kt
package expo.modules.bayaanwidgets

import org.json.JSONObject

data class LibraryShelfConfig(val sourceId: String)
data class BedtimeConfig(val surahId: Int, val reciterId: String?, val minutes: Int, val ambient: String?)

/** Phase 3 per-widget configuration, stored under WidgetStorage config.<appWidgetId>. */
object ContentConfigJson {
  const val DEFAULT_BEDTIME_SURAH = 67
  const val DEFAULT_BEDTIME_MINUTES = 30
  val BEDTIME_MINUTES = listOf(15, 30, 45, 60)
  /** Same values as WIDGET_AMBIENT_SOUNDS in commands.ts. */
  val AMBIENT_SOUNDS = listOf("rain", "forest", "ocean", "stream", "thunder", "fireplace", "wind")
  val DEFAULT_BEDTIME = BedtimeConfig(DEFAULT_BEDTIME_SURAH, null, DEFAULT_BEDTIME_MINUTES, null)

  private fun parse(json: String?): JSONObject? = try { json?.let { JSONObject(it) } } catch (e: Exception) { null }

  private fun JSONObject.stringOrNull(key: String): String? =
    if (!has(key) || isNull(key)) null else optString(key).takeIf { it.isNotEmpty() }

  fun decodeLibraryShelf(json: String?): LibraryShelfConfig =
    LibraryShelfConfig(parse(json)?.stringOrNull("sourceId") ?: ContentLogic.DOWNLOADS)

  fun encode(c: LibraryShelfConfig): String = JSONObject().put("sourceId", c.sourceId).toString()

  fun decodeBedtime(json: String?): BedtimeConfig {
    val o = parse(json) ?: return DEFAULT_BEDTIME
    val surah = o.optInt("surahId", DEFAULT_BEDTIME_SURAH).takeIf { it in 1..114 } ?: DEFAULT_BEDTIME_SURAH
    val minutes = o.optInt("minutes", DEFAULT_BEDTIME_MINUTES).takeIf { it in BEDTIME_MINUTES } ?: DEFAULT_BEDTIME_MINUTES
    return BedtimeConfig(surah, o.stringOrNull("reciterId"), minutes, o.stringOrNull("ambient")?.takeIf { it in AMBIENT_SOUNDS })
  }

  fun encode(c: BedtimeConfig): String = JSONObject()
    .put("surahId", c.surahId).put("reciterId", c.reciterId ?: JSONObject.NULL)
    .put("minutes", c.minutes).put("ambient", c.ambient ?: JSONObject.NULL).toString()

  fun ambientLabel(sound: String?): String = sound?.replaceFirstChar { it.uppercase() } ?: "Off"
}
```

```kotlin
// main/java/expo/modules/bayaanwidgets/IcuHijri.kt
package expo.modules.bayaanwidgets

import android.icu.util.IslamicCalendar
import android.icu.util.ULocale
import android.icu.util.TimeZone as IcuTimeZone

/**
 * Umm al-Qura through android.icu (API 24, minSdk 24). The JVM unit tests use
 * java.time's HijrahDate against the same table; the device check in the plan's
 * last task compares this on a real Android runtime.
 */
object IcuHijri : HijriOf {
  override fun at(dayNumber: Long): HijriDate? = runCatching {
    val cal = IslamicCalendar(IcuTimeZone.getTimeZone("UTC"), ULocale.ENGLISH)
    cal.setCalculationType(IslamicCalendar.CalculationType.ISLAMIC_UMALQURA)
    cal.timeInMillis = dayNumber * 86_400_000L + 43_200_000L
    HijriDate(cal.get(IslamicCalendar.YEAR), cal.get(IslamicCalendar.MONTH) + 1, cal.get(IslamicCalendar.DAY_OF_MONTH))
  }.getOrNull()
}
```

- [ ] **Step 5: Run the Kotlin test**

Run: `cd android && ./gradlew :bayaan-widgets:testReleaseUnitTest --tests '*ContentLogicTest*' && cd ..`
Expected: PASS. If only `javaUmmAlQuraMatchesTheTable` fails on a few days, java.time and Foundation disagree on those months: keep the test (it documents the mismatch), record the failing days, and continue; Task 11 checks `IcuHijri` on the emulator for today's date. Do not change the table.

- [ ] **Step 6: Storage, Glance state, module, clock receiver, shared UI**

In `WidgetStorage.kt` add next to the other keys and functions:

```kotlin
  private const val KEY_CONTENT = "content"

  fun writeContent(context: Context, json: String) = prefs(context).edit().putString(KEY_CONTENT, json).apply()

  fun readContentJson(context: Context): String? = prefs(context).getString(KEY_CONTENT, null)
```

In `GlanceState.kt`:
- `data class WidgetInputs(...)` gets a last field `val contentJson: String? = null`.
- add `private val CONTENT = stringPreferencesKey("content")`;
- `stored(...)` passes `WidgetStorage.readContentJson(context)` as the fifth argument;
- `current(...)` returns `WidgetInputs(prefs[SNAPSHOT], prefs[CATALOG], prefs[CONFIG], prefs[PENDING_TASBEEH], prefs[CONTENT])` after the first push;
- `push(...)` adds `put(prefs, CONTENT, inputs.contentJson)`.

In `BayaanWidgetsModule.kt`, after `Function("writeCatalog")` add:

```kotlin
    Function("writeContent") { json: String -> WidgetStorage.writeContent(context, json) }
```

```kotlin
// main/java/expo/modules/bayaanwidgets/ContextClockReceiver.kt
package expo.modules.bayaanwidgets

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import androidx.glance.appwidget.GlanceAppWidget
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.TimeZone

/** A Phase 3 widget whose content changes at context boundaries. */
class ClockTarget(val receiver: Class<*>, val widget: () -> GlanceAppWidget)

/**
 * Re-renders the date and time driven Phase 3 widgets at the next context
 * boundary (00:00, 04:00, 11:00, 12:00, 15:00, 18:00, 20:00, 21:00). Inexact
 * and permission free, like MidnightReceiver.
 */
class ContextClockReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pending = goAsync()
    val app = context.applicationContext
    CoroutineScope(Dispatchers.Default).launch {
      try {
        for (t in TARGETS) runCatching { GlanceState.push(app, t.widget()) }
      } finally {
        if (hasWidgets(app)) schedule(app)
        pending.finish()
      }
    }
  }

  companion object {
    // Each Phase 3 widget task adds its entry here.
    val TARGETS: List<ClockTarget> = listOf()

    fun hasWidgets(context: Context): Boolean {
      val manager = AppWidgetManager.getInstance(context)
      return TARGETS.any { manager.getAppWidgetIds(ComponentName(context, it.receiver)).isNotEmpty() }
    }

    fun schedule(context: Context) {
      val alarms = context.getSystemService(AlarmManager::class.java) ?: return
      val at = ContentLogic.nextBoundaryMs(System.currentTimeMillis(), TimeZone.getDefault()) + 1_000
      alarms.setAndAllowWhileIdle(AlarmManager.RTC, at, pendingIntent(context))
    }

    fun cancelIfUnused(context: Context) {
      if (hasWidgets(context)) return
      context.getSystemService(AlarmManager::class.java)?.cancel(pendingIntent(context))
    }

    private fun pendingIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
      context, 1, Intent(context, ContextClockReceiver::class.java),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
  }
}
```

In `AndroidManifest.xml`, inside `<application>`, after the `MidnightReceiver` entry:

```xml
    <receiver
      android:name="expo.modules.bayaanwidgets.ContextClockReceiver"
      android:exported="false" />
```

```kotlin
// main/java/expo/modules/bayaanwidgets/ui/ContentUi.kt
package expo.modules.bayaanwidgets.ui

import android.content.Context
import android.text.format.DateFormat
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import expo.modules.bayaanwidgets.StaticData
import java.util.Date

/** The rounded near-black root every Phase 3 widget draws on. */
fun contentRoot(): GlanceModifier = GlanceModifier.fillMaxSize().background(WidgetColors.BACKGROUND).cornerRadius(20.dp)

/** Shelf title row: optional leading button, title and detail, Bayaan mark. */
@Composable
fun ShelfHeader(title: String, detail: String?, leading: (@Composable () -> Unit)? = null) {
  Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
    if (leading != null) {
      leading()
      Spacer(GlanceModifier.width(8.dp))
    }
    Column(GlanceModifier.defaultWeight()) {
      Text(title, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 14.sp, fontWeight = FontWeight.Bold))
      if (detail != null) Text(detail, maxLines = 1, style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp))
    }
    Logo(14)
  }
}

/** A surah card that runs an action when tapped, with an optional caption. */
@Composable
fun SurahTile(context: Context, surahId: Int, sizeDp: Int, action: Action, caption: String? = null) {
  Column(GlanceModifier.clickable(action), horizontalAlignment = Alignment.CenterHorizontally) {
    SurahCard(context, StaticData.surah(context, surahId), sizeDp)
    if (caption != null) {
      Text(caption, maxLines = 1, modifier = GlanceModifier.width(sizeDp.dp),
        style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 10.sp, textAlign = TextAlign.Center))
    }
  }
}

/** Centered message for empty and unavailable states. */
@Composable
fun ContentMessage(modifier: GlanceModifier, title: String, detail: String?) {
  Column(modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalAlignment = Alignment.CenterVertically) {
    Logo(18)
    Spacer(GlanceModifier.height(6.dp))
    Text(title, style = TextStyle(color = WidgetColors.WHITE, fontSize = 13.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center))
    if (detail != null) Text(detail, style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp, textAlign = TextAlign.Center))
  }
}

/** Local clock time in the user's 12/24 hour setting, for "Sleep at 23:40". */
fun clockTime(context: Context, epochMs: Long): String = DateFormat.getTimeFormat(context).format(Date(epochMs))
```

- [ ] **Step 7: Run all Android unit tests and build**

```bash
cd android && ./gradlew :bayaan-widgets:testReleaseUnitTest && ./gradlew :app:assembleRelease && cd ..
```
Expected: BUILD SUCCESSFUL for both; the 1b tests still pass.

- [ ] **Step 8: Commit**

```bash
git add modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/ContentModels.kt modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/ContentLogic.kt modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/ContentConfig.kt modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/IcuHijri.kt modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/ContextClockReceiver.kt modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/ui/ContentUi.kt modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/WidgetStorage.kt modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/GlanceState.kt modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/BayaanWidgetsModule.kt modules/bayaan-widgets/android/src/main/AndroidManifest.xml modules/bayaan-widgets/android/src/test/java/expo/modules/bayaanwidgets/ContentLogicTest.kt
git commit -m "feat(widgets): add the Android content layer with Umm al-Qura rules"
```

---
### Task 6: JS glue (content builder, sync, commands)

**Files:**
- Create: `services/widgets/buildContent.ts`, `services/widgets/contentCommands.ts`, `services/widgets/syncContentWidgets.ts`, `services/widgets/__tests__/buildContent.test.ts`, `services/widgets/__tests__/contentCommands.test.ts`, `services/widgets/__tests__/contentRouting.test.ts`, `services/widgets/__tests__/syncContentWidgets.test.ts`, `services/widgets/__tests__/snapshotListeners.test.ts`
- Modify: `services/widgets/handleWidgetCommand.ts`, `services/widgets/syncWidgets.ts`, `app/_layout.tsx`

**Interfaces:**
- Consumes: `WidgetContent`, `PLAYLIST_LIMIT`, `SHELF_ITEM_LIMIT`, `WIDGET_CONTENT_VERSION`, `writeContent`, `reloadWidgets`, `changedContentKindsForContent`, `changedContentKindsForSnapshot`, `WidgetCommand` (Task 2); native `writeContent` (Tasks 4 and 5); `artworkFileName`, `surahArtworkFileName`, `surahArtworkUrl` (`buildSnapshot.ts`); `CommandDeps`, `defaultDeps` (`handleWidgetCommand.ts`).
- Produces:
  - `buildContent(input: ContentInput): WidgetContent`, `spotlightSurahIds(reciter: Reciter): number[]`, `type PlaylistWithItems = {playlist: UserPlaylist; items: PlaylistItem[]}`
  - `contentCommands.ts`: `rotateToItem<T>(entries: {itemId: string; value: T}[], itemId: string | null): T[]`, `playPlaylist(cmd, deps)`, `startBedtime(cmd, deps)`, `runContentCommand(cmd, playSurahFromStart, deps?)`, `defaultContentDeps(playSurahFromStart)`, `interface ContentCommandDeps`
  - `handleWidgetCommand.ts`: `export async function playSurah(reciter, surahId, rewayatId, ayah, deps): Promise<boolean>`; cases `playPlaylist` and `startBedtime`
  - `syncWidgets.ts`: `addSnapshotListener(listener: (prev: WidgetSnapshot | null, next: WidgetSnapshot) => void): () => void`
  - `syncContentWidgets.ts`: `startContentWidgetSync(): () => void`, `flushContent(reloadPlaylists?: boolean): Promise<void>`, `contentArtworkJobs(...)`, `spotlightReciters()`, `resetContentSync()` (tests only)

- [ ] **Step 1: Write the failing `buildContent` test**

```ts
// services/widgets/__tests__/buildContent.test.ts
import type {DownloadedSurah} from '@/services/player/store/downloadStore';
import type {PlaylistItem, UserPlaylist} from '@/services/database/DatabaseService';
import type {Reciter} from '@/data/reciterData';
import {isWidgetContent} from 'bayaan-widgets';
import {buildContent, ContentInput, spotlightSurahIds} from '../buildContent';

function download(o: Partial<DownloadedSurah>): DownloadedSurah {
  return {reciterId: 'r1', surahId: '67', rewayatId: 'rw1', filePath: '/x', fileSize: 1, downloadDate: 1, status: 'completed', ...o};
}

function reciter(id: string, surahList: (number | null)[]): Reciter {
  return {
    id, name: `Reciter ${id}`, date: null, image_url: null,
    rewayat: [{id: `${id}-rw`, reciter_id: id, name: 'Hafs', style: 'murattal', server: '', surah_total: surahList.length, surah_list: surahList, source_type: 'r2', created_at: ''}],
  };
}

function playlist(id: string, updatedAt: number): UserPlaylist {
  return {id, name: `List ${id}`, color: '#000000', createdAt: 0, updatedAt, itemCount: 0};
}

function item(id: string, surahId: string, orderIndex: number, extra: Partial<PlaylistItem> = {}): PlaylistItem {
  return {id, playlistId: 'p', surahId, reciterId: 'r1', orderIndex, addedAt: 0, ...extra};
}

const base: ContentInput = {
  now: 1_000,
  downloads: [],
  playlists: [],
  spotlight: [],
  sleepTimerEnd: null,
  surahName: id => (id >= 1 && id <= 114 ? `Surah ${id}` : null),
  reciterName: id => (id === 'gone' ? null : `Name ${id}`),
};

describe('buildContent', () => {
  it('keeps completed downloads, newest first, capped at 8', () => {
    const downloads = [
      download({surahId: '1', downloadDate: 5}),
      download({surahId: '2', downloadDate: 9, rewayatId: ''}),
      download({surahId: '3', downloadDate: 7, status: 'downloading'}),
      download({surahId: '999', downloadDate: 8}),
      ...Array.from({length: 10}, (_, i) => download({surahId: String(10 + i), downloadDate: i})),
    ];
    const out = buildContent({...base, downloads});
    expect(out.downloads[0]).toEqual({surahId: 2, surahName: 'Surah 2', reciterId: 'r1', reciterName: 'Name r1', rewayatId: null, itemId: null});
    expect(out.downloads.map(d => d.surahId).slice(0, 2)).toEqual([2, 1]);
    expect(out.downloads).toHaveLength(8);
    expect(out.downloadCount).toBe(13);
  });

  it('orders playlists by last update, items by order, skipping uploads', () => {
    const playlists = [
      {playlist: playlist('old', 1), items: [item('a', '1', 0)]},
      {playlist: playlist('new', 9), items: [item('c', '36', 2), item('u', '0', 1, {userRecitationId: 'up1'}), item('b', '18', 0, {rewayatId: 'rw2', reciterId: 'gone'})]},
    ];
    const out = buildContent({...base, playlists});
    expect(out.playlists.map(p => p.id)).toEqual(['new', 'old']);
    expect(out.playlists[0]).toEqual({
      id: 'new', name: 'List new', itemCount: 3,
      items: [
        {surahId: 18, surahName: 'Surah 18', reciterId: 'gone', reciterName: '', rewayatId: 'rw2', itemId: 'b'},
        {surahId: 36, surahName: 'Surah 36', reciterId: 'r1', reciterName: 'Name r1', rewayatId: null, itemId: 'c'},
      ],
    });
  });

  it('caps playlists at 20 and cards at 8', () => {
    const playlists = Array.from({length: 25}, (_, i) => ({
      playlist: playlist(`p${i}`, i),
      items: Array.from({length: 12}, (_, j) => item(`i${j}`, String(j + 1), j)),
    }));
    const out = buildContent({...base, playlists});
    expect(out.playlists).toHaveLength(20);
    expect(out.playlists[0].items).toHaveLength(8);
    expect(out.playlists[0].itemCount).toBe(12);
  });

  it('dedupes spotlight reciters and lists the popular surahs they have', () => {
    const a = reciter('a', [1, 2, 18, 36, 67, null]);
    const b = reciter('b', [114]);
    const out = buildContent({...base, spotlight: [a, b, a, reciter('', [1])]});
    expect(out.spotlight).toEqual([
      {id: 'a', name: 'Reciter a', artworkFile: 'reciter-a.jpg', surahIds: [1, 18, 36]},
      {id: 'b', name: 'Reciter b', artworkFile: 'reciter-b.jpg', surahIds: []},
    ]);
    expect(spotlightSurahIds(reciter('c', [56, 55]))).toEqual([55, 56]);
  });

  it('keeps a future sleep timer and drops a past one', () => {
    expect(buildContent({...base, sleepTimerEnd: 5_000}).sleepTimerEndsAt).toBe(5_000);
    expect(buildContent({...base, sleepTimerEnd: 500}).sleepTimerEndsAt).toBeNull();
  });

  it('produces a valid content document', () => {
    expect(isWidgetContent(buildContent(base))).toBe(true);
  });
});
```

Run: `npx jest services/widgets/__tests__/buildContent.test.ts`
Expected: FAIL with "Cannot find module '../buildContent'".

- [ ] **Step 2: Write `buildContent.ts`**

```ts
// services/widgets/buildContent.ts
import type {DownloadedSurah} from '@/services/player/store/downloadStore';
import type {PlaylistItem, UserPlaylist} from '@/services/database/DatabaseService';
import type {Reciter} from '@/data/reciterData';
import {
  PLAYLIST_LIMIT,
  SHELF_ITEM_LIMIT,
  WIDGET_CONTENT_VERSION,
  WidgetContent,
  WidgetPlaylist,
  WidgetShelfItem,
  WidgetSpotlightReciter,
} from 'bayaan-widgets';
import {artworkFileName} from './buildSnapshot';

/** Surahs a spotlight row may offer, in order; up to three that the reciter has. */
export const SPOTLIGHT_SURAH_CANDIDATES: readonly number[] = [1, 18, 36, 67, 55, 56];
const SPOTLIGHT_SURAH_LIMIT = 3;

export interface PlaylistWithItems {
  playlist: UserPlaylist;
  items: PlaylistItem[];
}

export interface ContentInput {
  now: number;
  downloads: DownloadedSurah[];
  playlists: PlaylistWithItems[];
  spotlight: Reciter[];
  sleepTimerEnd: number | null;
  surahName: (surahId: number) => string | null;
  reciterName: (reciterId: string) => string | null;
}

function shelfItem(
  rawSurahId: string,
  reciterId: string,
  rewayatId: string | null,
  itemId: string | null,
  input: ContentInput,
): WidgetShelfItem | null {
  const surahId = Number.parseInt(rawSurahId, 10);
  if (!Number.isInteger(surahId) || surahId < 1 || surahId > 114) return null;
  const surahName = input.surahName(surahId);
  if (!surahName) return null;
  return {
    surahId,
    surahName,
    reciterId,
    reciterName: input.reciterName(reciterId) ?? '',
    rewayatId,
    itemId,
  };
}

function isItem(value: WidgetShelfItem | null): value is WidgetShelfItem {
  return value !== null;
}

export function spotlightSurahIds(reciter: Reciter): number[] {
  const available = new Set<number>();
  for (const r of reciter.rewayat) {
    for (const n of r.surah_list) if (n !== null) available.add(n);
  }
  return SPOTLIGHT_SURAH_CANDIDATES.filter(id => available.has(id)).slice(
    0,
    SPOTLIGHT_SURAH_LIMIT,
  );
}

function buildPlaylist(p: PlaylistWithItems, input: ContentInput): WidgetPlaylist {
  return {
    id: p.playlist.id,
    name: p.playlist.name,
    itemCount: p.items.length,
    items: [...p.items]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .filter(i => !i.userRecitationId)
      .map(i => shelfItem(i.surahId, i.reciterId, i.rewayatId ?? null, i.id, input))
      .filter(isItem)
      .slice(0, SHELF_ITEM_LIMIT),
  };
}

export function buildContent(input: ContentInput): WidgetContent {
  const completed = input.downloads
    .filter(d => d.status === 'completed')
    .sort((a, b) => b.downloadDate - a.downloadDate);
  const seen = new Set<string>();
  const spotlight: WidgetSpotlightReciter[] = [];
  for (const r of input.spotlight) {
    if (r.id === '' || seen.has(r.id)) continue;
    seen.add(r.id);
    spotlight.push({
      id: r.id,
      name: r.name,
      artworkFile: artworkFileName(r.id),
      surahIds: spotlightSurahIds(r),
    });
  }
  return {
    version: WIDGET_CONTENT_VERSION,
    generatedAt: input.now,
    downloads: completed
      .map(d => shelfItem(d.surahId, d.reciterId, d.rewayatId || null, null, input))
      .filter(isItem)
      .slice(0, SHELF_ITEM_LIMIT),
    downloadCount: completed.length,
    playlists: [...input.playlists]
      .sort((a, b) => b.playlist.updatedAt - a.playlist.updatedAt)
      .slice(0, PLAYLIST_LIMIT)
      .map(p => buildPlaylist(p, input)),
    spotlight,
    sleepTimerEndsAt:
      input.sleepTimerEnd !== null && input.sleepTimerEnd > input.now
        ? input.sleepTimerEnd
        : null,
  };
}
```

Run: `npx jest services/widgets/__tests__/buildContent.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing command tests**

```ts
// services/widgets/__tests__/contentCommands.test.ts
import type {Reciter} from '@/data/reciterData';
import type {PlaylistItem} from '@/services/database/DatabaseService';
import type {Track} from '@/types/audio';
import {
  ContentCommandDeps,
  playPlaylist,
  rotateToItem,
  runContentCommand,
  startBedtime,
} from '../contentCommands';

jest.mock('@/services/playlist/PlaylistService', () => ({playlistService: {}}));
jest.mock('@/store/uploadsStore', () => ({useUploadsStore: {getState: () => ({recitations: []})}}));
jest.mock('@/utils/track', () => ({createTrack: jest.fn(), createUserUploadTrack: jest.fn()}));
jest.mock('@/services/dataService', () => ({getReciterByIdSync: jest.fn(), getSurahById: jest.fn()}));
jest.mock('@/services/player/store/playerStore', () => ({usePlayerStore: {}}));
jest.mock('@/store/reciterStore', () => ({useReciterStore: {}}));
jest.mock('@/store/ambientStore', () => ({useAmbientStore: {}}));

const alafasi = {id: 'r1', name: 'Alafasi', rewayat: []} as unknown as Reciter;
const minshawi = {id: 'r2', name: 'Minshawi', rewayat: []} as unknown as Reciter;

function track(id: string): Track {
  return {id, url: '', title: id, artist: '', reciterId: 'r1', reciterName: 'R', surahId: id} as Track;
}

function item(id: string, orderIndex: number, extra: Partial<PlaylistItem> = {}): PlaylistItem {
  return {id, playlistId: 'p', surahId: '1', reciterId: 'r1', orderIndex, addedAt: 0, ...extra};
}

function deps(overrides: Partial<ContentCommandDeps> = {}): ContentCommandDeps & {log: string[]} {
  const log: string[] = [];
  return {
    log,
    playlistItems: jest.fn(async () => []),
    trackForItem: jest.fn(async (i: PlaylistItem) => track(i.id)),
    playTracks: jest.fn(async (tracks: Track[]) => {
      log.push(`play:${tracks.map(t => t.id).join(',')}`);
    }),
    getReciter: jest.fn((id: string) => (id === 'r2' ? minshawi : undefined)),
    getDefaultReciter: jest.fn(() => alafasi),
    playSurahFromStart: jest.fn(async (r: Reciter, s: number) => {
      log.push(`surah:${r.id}:${s}`);
      return true;
    }),
    setSleepTimer: jest.fn((m: number) => {
      log.push(`timer:${m}`);
    }),
    startAmbient: jest.fn((sound: string) => {
      log.push(`ambient:${sound}`);
    }),
    ...overrides,
  };
}

describe('rotateToItem', () => {
  const entries = [{itemId: 'a', value: 1}, {itemId: 'b', value: 2}, {itemId: 'c', value: 3}];
  it('starts at the item and wraps around', () => {
    expect(rotateToItem(entries, 'b')).toEqual([2, 3, 1]);
  });
  it('starts at the first item for a missing or null id', () => {
    expect(rotateToItem(entries, 'gone')).toEqual([1, 2, 3]);
    expect(rotateToItem(entries, null)).toEqual([1, 2, 3]);
  });
});

describe('playPlaylist', () => {
  it('queues the playlist in order starting at the tapped item', async () => {
    const d = deps({playlistItems: jest.fn(async () => [item('c', 2), item('a', 0), item('b', 1)])});
    await playPlaylist({type: 'playPlaylist', playlistId: 'p', itemId: 'b'}, d);
    expect(d.log).toEqual(['play:b,c,a']);
  });

  it('skips items that cannot be played and still starts at the first playable one', async () => {
    const d = deps({
      playlistItems: jest.fn(async () => [item('a', 0), item('b', 1), item('c', 2)]),
      trackForItem: jest.fn(async (i: PlaylistItem) => (i.id === 'b' ? null : track(i.id))),
    });
    await playPlaylist({type: 'playPlaylist', playlistId: 'p', itemId: 'b'}, d);
    expect(d.log).toEqual(['play:a,c']);
  });

  it('plays uploads through trackForItem', async () => {
    const d = deps({playlistItems: jest.fn(async () => [item('u', 0, {userRecitationId: 'up1'})])});
    await playPlaylist({type: 'playPlaylist', playlistId: 'p', itemId: null}, d);
    expect(d.trackForItem).toHaveBeenCalledWith(expect.objectContaining({userRecitationId: 'up1'}));
    expect(d.log).toEqual(['play:u']);
  });

  it('does nothing for an empty or missing playlist', async () => {
    const d = deps();
    await playPlaylist({type: 'playPlaylist', playlistId: 'gone', itemId: null}, d);
    expect(d.playTracks).not.toHaveBeenCalled();
  });
});

describe('startBedtime', () => {
  it('plays from the start, then sets the timer, then starts ambient', async () => {
    const d = deps();
    await startBedtime({type: 'startBedtime', surahId: 67, reciterId: 'r2', sleepMinutes: 30, ambient: 'rain'}, d);
    expect(d.log).toEqual(['surah:r2:67', 'timer:30', 'ambient:rain']);
  });

  it('uses the default reciter when none is set or the set one is gone', async () => {
    const d = deps();
    await startBedtime({type: 'startBedtime', surahId: 67, reciterId: null, sleepMinutes: 15, ambient: null}, d);
    await startBedtime({type: 'startBedtime', surahId: 67, reciterId: 'gone', sleepMinutes: 15, ambient: null}, d);
    expect(d.log).toEqual(['surah:r1:67', 'timer:15', 'surah:r1:67', 'timer:15']);
    expect(d.startAmbient).not.toHaveBeenCalled();
  });

  it('leaves the timer and ambient alone when the surah cannot start', async () => {
    const noReciter = deps({getDefaultReciter: jest.fn(() => null)});
    await startBedtime({type: 'startBedtime', surahId: 67, reciterId: null, sleepMinutes: 30, ambient: 'rain'}, noReciter);
    expect(noReciter.log).toEqual([]);
    const failed = deps({playSurahFromStart: jest.fn(async () => false)});
    await startBedtime({type: 'startBedtime', surahId: 67, reciterId: null, sleepMinutes: 30, ambient: 'rain'}, failed);
    expect(failed.setSleepTimer).not.toHaveBeenCalled();
    expect(failed.startAmbient).not.toHaveBeenCalled();
  });
});

describe('runContentCommand', () => {
  it('dispatches by type', async () => {
    const d = deps({playlistItems: jest.fn(async () => [item('a', 0)])});
    await runContentCommand({type: 'playPlaylist', playlistId: 'p', itemId: null}, jest.fn(), d);
    await runContentCommand({type: 'startBedtime', surahId: 36, reciterId: null, sleepMinutes: 45, ambient: null}, jest.fn(), d);
    expect(d.log).toEqual(['play:a', 'surah:r1:36', 'timer:45']);
  });
});
```

```ts
// services/widgets/__tests__/contentRouting.test.ts
import type {Reciter} from '@/data/reciterData';
import type {WidgetCommand} from 'bayaan-widgets';
import {CommandDeps, handleWidgetCommand} from '../handleWidgetCommand';

const mockRun = jest.fn<Promise<void>, [WidgetCommand, (r: Reciter, s: number) => Promise<boolean>]>();

jest.mock('../contentCommands', () => ({
  runContentCommand: (c: WidgetCommand, play: (r: Reciter, s: number) => Promise<boolean>) => mockRun(c, play),
}));
jest.mock('@/utils/track', () => ({
  createTrack: jest.fn(async (_r: unknown, surah: {id: number}) => ({id: `x-${surah.id}`, surahId: String(surah.id), rewayatId: 'rw1'})),
}));
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: () => undefined,
  getSurahById: jest.fn((id: number) => (id === 999 ? undefined : {id})),
}));
jest.mock('@/store/reciterStore', () => ({useReciterStore: {}}));
jest.mock('@/services/player/store/playerStore', () => ({usePlayerStore: {}}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({useRecentlyPlayedStore: {}}));
jest.mock('@/services/timestamps/TimestampService', () => ({timestampService: {}}));
jest.mock('@/services/audio/ExpoAudioService', () => ({expoAudioService: {}}));
jest.mock('@/services/player/utils/resumeRecent', () => ({resumeRecent: jest.fn()}));
jest.mock('@/services/player/utils/restoreSession', () => ({pendingRestoreLoad: jest.fn()}));

const reciter = {id: 'r1', name: 'R', rewayat: [{id: 'rw1', surah_list: [67], surah_total: 1}]} as unknown as Reciter;

function fakeDeps(): CommandDeps {
  return {
    playTracks: jest.fn(async () => undefined),
    ayahStartSec: jest.fn(async () => 12),
  } as unknown as CommandDeps;
}

it('routes playPlaylist and startBedtime to contentCommands', async () => {
  const deps = fakeDeps();
  const playlist: WidgetCommand = {type: 'playPlaylist', playlistId: 'p', itemId: null};
  const bedtime: WidgetCommand = {type: 'startBedtime', surahId: 67, reciterId: null, sleepMinutes: 30, ambient: null};
  await handleWidgetCommand(playlist, deps);
  await handleWidgetCommand(bedtime, deps);
  expect(mockRun.mock.calls.map(c => c[0])).toEqual([playlist, bedtime]);
});

it('passes a play-from-start function that starts at 0 and reports success', async () => {
  const deps = fakeDeps();
  await handleWidgetCommand({type: 'startBedtime', surahId: 67, reciterId: null, sleepMinutes: 30, ambient: null}, deps);
  const play = mockRun.mock.calls[mockRun.mock.calls.length - 1][1];
  await expect(play(reciter, 67)).resolves.toBe(true);
  expect(deps.playTracks).toHaveBeenCalledWith([expect.objectContaining({surahId: '67'})], 0);
  await expect(play(reciter, 999)).resolves.toBe(false);
});
```

Run: `npx jest services/widgets/__tests__/contentCommands.test.ts services/widgets/__tests__/contentRouting.test.ts`
Expected: FAIL with "Cannot find module '../contentCommands'".

- [ ] **Step 4: Write `contentCommands.ts` and route the commands**

```ts
// services/widgets/contentCommands.ts
// Handlers for the Phase 3 widget commands. handleWidgetCommand loads this
// module with a dynamic import, so the Phase 1 handler does not pull in the
// playlist database or the ambient store.
import type {Track} from '@/types/audio';
import type {Reciter} from '@/data/reciterData';
import type {PlaylistItem} from '@/services/database/DatabaseService';
import type {WidgetAmbientSound, WidgetCommand} from 'bayaan-widgets';
import {playlistService} from '@/services/playlist/PlaylistService';
import {useUploadsStore} from '@/store/uploadsStore';
import {createTrack, createUserUploadTrack} from '@/utils/track';
import {getReciterByIdSync, getSurahById} from '@/services/dataService';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useReciterStore} from '@/store/reciterStore';
import {useAmbientStore} from '@/store/ambientStore';

export type PlayPlaylistCommand = Extract<WidgetCommand, {type: 'playPlaylist'}>;
export type StartBedtimeCommand = Extract<WidgetCommand, {type: 'startBedtime'}>;
export type ContentCommand = PlayPlaylistCommand | StartBedtimeCommand;
export type PlaySurahFromStart = (reciter: Reciter, surahId: number) => Promise<boolean>;

export interface ContentCommandDeps {
  playlistItems: (playlistId: string) => Promise<PlaylistItem[]>;
  trackForItem: (item: PlaylistItem) => Promise<Track | null>;
  playTracks: (tracks: Track[], startIndex: number) => Promise<void>;
  getReciter: (id: string) => Reciter | undefined;
  getDefaultReciter: () => Reciter | null;
  playSurahFromStart: PlaySurahFromStart;
  setSleepTimer: (minutes: number) => void;
  startAmbient: (sound: WidgetAmbientSound) => void;
}

/** Puts the tapped item first and wraps the rest, like PlaylistDetail.handleSurahPress. */
export function rotateToItem<T>(
  entries: {itemId: string; value: T}[],
  itemId: string | null,
): T[] {
  const found = itemId === null ? -1 : entries.findIndex(e => e.itemId === itemId);
  const start = found < 0 ? 0 : found;
  return [...entries.slice(start), ...entries.slice(0, start)].map(e => e.value);
}

export async function playPlaylist(
  cmd: PlayPlaylistCommand,
  deps: ContentCommandDeps,
): Promise<void> {
  const items = [...(await deps.playlistItems(cmd.playlistId))].sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
  const built: {itemId: string; value: Track}[] = [];
  for (const item of items) {
    const track = await deps.trackForItem(item);
    if (track) built.push({itemId: item.id, value: track});
  }
  if (built.length === 0) return;
  await deps.playTracks(rotateToItem(built, cmd.itemId), 0);
}

export async function startBedtime(
  cmd: StartBedtimeCommand,
  deps: ContentCommandDeps,
): Promise<void> {
  const chosen = cmd.reciterId ? deps.getReciter(cmd.reciterId) : undefined;
  const reciter = chosen ?? deps.getDefaultReciter();
  if (!reciter) return;
  if (!(await deps.playSurahFromStart(reciter, cmd.surahId))) return;
  deps.setSleepTimer(cmd.sleepMinutes);
  if (cmd.ambient) deps.startAmbient(cmd.ambient);
}

export function defaultContentDeps(
  playSurahFromStart: PlaySurahFromStart,
): ContentCommandDeps {
  return {
    playlistItems: id => playlistService.getPlaylistItems(id),
    trackForItem: async item => {
      if (item.userRecitationId) {
        const upload = useUploadsStore
          .getState()
          .recitations.find(r => r.id === item.userRecitationId);
        return upload ? createUserUploadTrack(upload) : null;
      }
      const reciter = getReciterByIdSync(item.reciterId);
      const surah = getSurahById(Number.parseInt(item.surahId, 10));
      if (!reciter || !surah) return null;
      return createTrack(reciter, surah, item.rewayatId);
    },
    playTracks: async (tracks, startIndex) => {
      const store = usePlayerStore.getState();
      await store.updateQueue(tracks, startIndex);
      await store.play();
    },
    getReciter: id => getReciterByIdSync(id),
    getDefaultReciter: () => {
      const r = useReciterStore.getState().defaultReciter;
      return r.id === '' ? null : r;
    },
    playSurahFromStart,
    setSleepTimer: minutes => usePlayerStore.getState().setSleepTimer(minutes),
    // setSound stops any current ambient, enables ambient and fades the new sound in.
    startAmbient: sound => useAmbientStore.getState().setSound(sound),
  };
}

export async function runContentCommand(
  cmd: ContentCommand,
  playSurahFromStart: PlaySurahFromStart,
  deps: ContentCommandDeps = defaultContentDeps(playSurahFromStart),
): Promise<void> {
  if (cmd.type === 'playPlaylist') {
    await playPlaylist(cmd, deps);
    return;
  }
  await startBedtime(cmd, deps);
}
```

In `services/widgets/handleWidgetCommand.ts`:

1. Change `async function playSurah(...): Promise<void>` to an exported function that reports whether it started:

```ts
export async function playSurah(
  reciter: Reciter,
  surahId: number,
  rewayatId: string | null,
  ayah: number | null,
  deps: CommandDeps,
): Promise<boolean> {
  const surah = getSurahById(surahId);
  if (!surah) return false;
  const track = await createTrack(
    reciter,
    surah,
    rewayatId ?? rewayatForSurah(reciter, surahId),
  );
  const resolvedRewayat = track.rewayatId ?? reciter.rewayat[0]?.id;
  const startSec =
    ayah !== null && resolvedRewayat
      ? (await deps.ayahStartSec(resolvedRewayat, surahId, ayah)) ?? 0
      : 0;
  await deps.playTracks([track], startSec);
  return true;
}
```

2. Add two cases at the end of the `switch (command.type)` in `handleWidgetCommand`:

```ts
    case 'playPlaylist':
    case 'startBedtime': {
      const {runContentCommand} = await import('./contentCommands');
      await runContentCommand(command, (reciter, surahId) =>
        playSurah(reciter, surahId, null, null, deps),
      );
      return;
    }
```

Run: `npx jest services/widgets/__tests__/contentCommands.test.ts services/widgets/__tests__/contentRouting.test.ts services/widgets/__tests__/handleWidgetCommand.test.ts services/widgets/__tests__/defaultDeps.test.ts`
Expected: PASS (the Phase 1 handler tests are unchanged).

If Jest cannot run the dynamic `import('./contentCommands')` (an ES module VM error), do not switch to `require`. Instead add to `handleWidgetCommand.ts` a module-level `let contentRunner: ContentRunner | null = null` with `export function setContentCommandRunner(runner: ContentRunner): void`, call `contentRunner?.(command, ...)` in the two cases, and register it at the top level of `syncContentWidgets.ts` (`setContentCommandRunner(runContentCommand)`), which `app/_layout.tsx` imports at startup, before any drain. Update `contentRouting.test.ts` to call `setContentCommandRunner(mockRun)` instead of mocking the module.

- [ ] **Step 5: Add the snapshot listener hook to `syncWidgets.ts`**

Write the failing test first:

```ts
// services/widgets/__tests__/snapshotListeners.test.ts
const mockWrite = jest.fn();
const mockReload = jest.fn();
const mockBuild = jest.fn();

jest.mock('bayaan-widgets', () => ({
  changedWidgetKinds: (prev: unknown) => (prev ? [] : ['ContinueListening']),
  isWidgetsAvailable: () => true,
  reloadWidgets: (k: unknown) => mockReload(k),
  writeSnapshot: (s: unknown) => mockWrite(s),
  cacheArtwork: jest.fn(async () => false),
  hasArtwork: () => true,
  addWidgetCommandListener: jest.fn(() => ({remove: jest.fn()})),
  takeQueuedCommands: () => [],
  selectFreshCommands: () => [],
}));
jest.mock('@/services/player/store/playerStore', () => ({usePlayerStore: {subscribe: jest.fn()}}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({useRecentlyPlayedStore: {subscribe: jest.fn()}}));
jest.mock('@/store/reciterStore', () => ({useReciterStore: {subscribe: jest.fn()}}));
jest.mock('@/store/themeStore', () => ({useThemeStore: {subscribe: jest.fn()}}));
jest.mock('@/services/dataService', () => ({getReciterByIdSync: () => undefined}));
jest.mock('@/utils/artworkUtils', () => ({getReciterArtwork: () => ''}));
jest.mock('../buildSnapshot', () => ({
  buildSnapshot: () => mockBuild(),
  artworkFileName: (id: string) => `reciter-${id}.jpg`,
  cardSurahId: () => null,
  surahArtworkFileName: (id: number) => `surah-${id}.jpg`,
  surahArtworkUrl: (id: number) => `https://cdn/surah/${id}.png`,
}));
jest.mock('../collectSnapshotInput', () => ({collectSnapshotInput: () => ({})}));
jest.mock('../handleWidgetCommand', () => ({handleWidgetCommand: jest.fn()}));

import {addSnapshotListener, flushWidgetSnapshot} from '../syncWidgets';

const snapshot = (n: number): unknown => ({generatedAt: n, nowPlaying: null, upNext: [], recent: [], defaultReciter: null});

it('tells listeners about each written snapshot with the previous one', () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const seen: unknown[][] = [];
  const remove = addSnapshotListener((prev, next) => seen.push([prev, next]));
  const throwing = addSnapshotListener(() => {
    throw new Error('listener failed');
  });
  mockBuild.mockReturnValueOnce(snapshot(1));
  flushWidgetSnapshot();
  mockBuild.mockReturnValueOnce(snapshot(2));
  flushWidgetSnapshot(true);
  expect(seen).toEqual([
    [null, snapshot(1)],
    [snapshot(1), snapshot(2)],
  ]);
  expect(mockWrite).toHaveBeenCalledTimes(2);
  remove();
  throwing();
  mockBuild.mockReturnValueOnce(snapshot(3));
  flushWidgetSnapshot(true);
  expect(seen).toHaveLength(2);
});
```

Run: `npx jest services/widgets/__tests__/snapshotListeners.test.ts`
Expected: FAIL with "addSnapshotListener is not a function".

In `services/widgets/syncWidgets.ts`, add below the module-level `let` declarations:

```ts
type SnapshotListener = (
  prev: WidgetSnapshot | null,
  next: WidgetSnapshot,
) => void;
const snapshotListeners = new Set<SnapshotListener>();

// Phase 3 widgets reload from the same written snapshots (syncContentWidgets).
export function addSnapshotListener(listener: SnapshotListener): () => void {
  snapshotListeners.add(listener);
  return () => {
    snapshotListeners.delete(listener);
  };
}

function notifySnapshotListeners(
  prev: WidgetSnapshot | null,
  next: WidgetSnapshot,
): void {
  for (const listener of snapshotListeners) {
    try {
      listener(prev, next);
    } catch (error) {
      console.error('[WidgetSync] Snapshot listener failed:', error);
    }
  }
}
```

and inside `flushWidgetSnapshot`, capture the previous snapshot before the diff and notify right after it is replaced (leave any Phase 2 call in place):

```ts
    const next = buildSnapshot(collectSnapshotInput(new Date()));
    const prev = lastSnapshot;
    const changed = changedWidgetKinds(prev, next);
```

```ts
    lastSnapshot = next;
    notifySnapshotListeners(prev, next);
```

Run: `npx jest services/widgets/__tests__/snapshotListeners.test.ts services/widgets/__tests__/syncWidgets.test.ts`
Expected: PASS (the 1b `syncWidgets` tests are unchanged; no listener is registered there).

- [ ] **Step 6: Write the failing content sync test**

```ts
// services/widgets/__tests__/syncContentWidgets.test.ts
import type {WidgetContent} from 'bayaan-widgets';
import type {DownloadedSurah} from '@/services/player/store/downloadStore';

const mockWriteContent = jest.fn();
const mockReload = jest.fn();
const mockCacheArtwork = jest.fn<Promise<boolean>, [string, string]>(async () => true);
const mockCached = new Set<string>();
let mockDownloads: DownloadedSurah[] = [];
let mockSleepEnd: number | null = null;
const mockGetAll = jest.fn();
const mockGetItems = jest.fn();

jest.mock('bayaan-widgets', () => ({
  ...jest.requireActual('bayaan-widgets'),
  isWidgetsAvailable: () => true,
  writeContent: (c: unknown) => mockWriteContent(c),
  reloadWidgets: (k: unknown) => mockReload(k),
  cacheArtwork: (u: string, f: string) => mockCacheArtwork(u, f),
  hasArtwork: (f: string) => mockCached.has(f),
}));
jest.mock('react-native', () => ({AppState: {addEventListener: () => ({remove: jest.fn()})}}));
jest.mock('@/services/player/store/downloadStore', () => ({
  useDownloadStore: {getState: () => ({downloads: mockDownloads}), subscribe: jest.fn(() => jest.fn())},
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {getState: () => ({settings: {sleepTimerEnd: mockSleepEnd}}), subscribe: jest.fn(() => jest.fn())},
}));
jest.mock('@/store/playlistsStore', () => ({usePlaylistsStore: {subscribe: jest.fn(() => jest.fn())}}));
jest.mock('@/store/reciterStore', () => ({useReciterStore: {subscribe: jest.fn(() => jest.fn())}}));
jest.mock('@/services/playlist/PlaylistService', () => ({
  playlistService: {getAllPlaylists: () => mockGetAll(), getPlaylistItems: (id: string) => mockGetItems(id)},
}));
jest.mock('@/data/reciterCollections', () => ({
  getFeaturedReciters: () => [{id: 'r-basfar', name: 'Albaraa Basfar', date: null, image_url: null, rewayat: []}],
  getBayaanOriginalsReciters: () => [],
  getTrendingReciters: () => [],
}));
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: (id: string) => ({id, name: `Name ${id}`, rewayat: []}),
  getSurahById: (id: number) => ({id, name: `Surah ${id}`}),
}));
jest.mock('@/utils/artworkUtils', () => ({
  getReciterArtwork: (r: {id: string}) => (r.id === 'inline' ? 'data:image/png;base64,x' : `https://img/${r.id}.jpg`),
}));
jest.mock('../syncWidgets', () => ({addSnapshotListener: jest.fn(() => jest.fn())}));

import {contentArtworkJobs, flushContent, resetContentSync} from '../syncContentWidgets';

function download(surahId: string, date: number): DownloadedSurah {
  return {reciterId: 'r1', surahId, rewayatId: 'rw', filePath: '', fileSize: 1, downloadDate: date, status: 'completed'};
}

beforeEach(() => {
  resetContentSync();
  mockWriteContent.mockReset();
  mockReload.mockReset();
  mockCacheArtwork.mockClear();
  mockCached.clear();
  mockDownloads = [download('67', 2)];
  mockSleepEnd = null;
  mockGetAll.mockReset().mockResolvedValue([{id: 'p1', name: 'Night', color: '#000', createdAt: 0, updatedAt: 1, itemCount: 1}]);
  mockGetItems.mockReset().mockResolvedValue([{id: 'i1', playlistId: 'p1', surahId: '36', reciterId: 'r1', orderIndex: 0, addedAt: 0}]);
});

it('writes content and reloads every content kind on the first flush', async () => {
  await flushContent(true);
  const written: WidgetContent = mockWriteContent.mock.calls[0][0];
  expect(written.downloads.map(d => d.surahId)).toEqual([67]);
  expect(written.playlists[0].items.map(i => i.itemId)).toEqual(['i1']);
  expect(written.spotlight.map(s => s.id)).toEqual(['r-basfar']);
  expect(mockReload).toHaveBeenNthCalledWith(1, ['LibraryShelf', 'ReciterSpotlight', 'Bedtime', 'BayaanNow']);
});

it('writes nothing when nothing changed, and reloads only what changed', async () => {
  mockCached.add('surah-67.jpg').add('surah-36.jpg').add('reciter-r-basfar.jpg');
  await flushContent(true);
  mockWriteContent.mockClear();
  mockReload.mockClear();
  await flushContent();
  expect(mockWriteContent).not.toHaveBeenCalled();
  mockSleepEnd = Date.now() + 60_000;
  await flushContent();
  expect(mockReload).toHaveBeenCalledWith(['Bedtime', 'BayaanNow']);
});

it('keeps the last playlists when reading them fails', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await flushContent(true);
  mockGetAll.mockRejectedValueOnce(new Error('db closed'));
  mockDownloads = [download('67', 2), download('18', 3)];
  await flushContent(true);
  const latest: WidgetContent = mockWriteContent.mock.calls[mockWriteContent.mock.calls.length - 1][0];
  expect(latest.playlists.map(p => p.id)).toEqual(['p1']);
  expect(latest.downloads.map(d => d.surahId)).toEqual([18, 67]);
});

it('caches missing cards and spotlight photos, skipping cached files and inline images', () => {
  const content: WidgetContent = {
    version: 1, generatedAt: 0, downloadCount: 1, sleepTimerEndsAt: null,
    downloads: [{surahId: 67, surahName: 'Al-Mulk', reciterId: 'r1', reciterName: '', rewayatId: null, itemId: null}],
    playlists: [{id: 'p', name: 'n', itemCount: 1, items: [{surahId: 36, surahName: 'Ya-Sin', reciterId: 'r1', reciterName: '', rewayatId: null, itemId: 'i'}]}],
    spotlight: [
      {id: 'r-a', name: 'A', artworkFile: 'reciter-r-a.jpg', surahIds: []},
      {id: 'inline', name: 'B', artworkFile: 'reciter-inline.jpg', surahIds: []},
      {id: 'r-c', name: 'C', artworkFile: 'reciter-r-c.jpg', surahIds: []},
    ],
  };
  const cached = new Set(['surah-36.jpg', 'reciter-r-c.jpg']);
  const jobs = contentArtworkJobs(content, f => cached.has(f), id => (id === 'inline' ? null : `https://img/${id}.jpg`));
  expect([...jobs.entries()]).toEqual([
    ['surah-67.jpg', 'https://cdn.thebayaan.com/assets/car/surah/67.png'],
    ['reciter-r-a.jpg', 'https://img/r-a.jpg'],
  ]);
});
```

Note: the last test relies on the real `surahArtworkUrl` (`buildSnapshot.ts` re-exports it from `artworkNames.ts`); if `artworkNames.ts` builds the URL differently, use its exact output in the expectation.

Run: `npx jest services/widgets/__tests__/syncContentWidgets.test.ts`
Expected: FAIL with "Cannot find module '../syncContentWidgets'".

- [ ] **Step 7: Write `syncContentWidgets.ts`**

```ts
// services/widgets/syncContentWidgets.ts
import {AppState} from 'react-native';
import {
  cacheArtwork,
  changedContentKindsForContent,
  changedContentKindsForSnapshot,
  ContentWidgetKind,
  hasArtwork,
  isWidgetsAvailable,
  PLAYLIST_LIMIT,
  reloadWidgets,
  writeContent,
  WidgetContent,
} from 'bayaan-widgets';
import type {Reciter} from '@/data/reciterData';
import {
  getBayaanOriginalsReciters,
  getFeaturedReciters,
  getTrendingReciters,
} from '@/data/reciterCollections';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {usePlaylistsStore} from '@/store/playlistsStore';
import {useReciterStore} from '@/store/reciterStore';
import {playlistService} from '@/services/playlist/PlaylistService';
import {getReciterByIdSync, getSurahById} from '@/services/dataService';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {buildContent, PlaylistWithItems} from './buildContent';
import {surahArtworkFileName, surahArtworkUrl} from './buildSnapshot';
import {addSnapshotListener} from './syncWidgets';

const DEBOUNCE_MS = 1000;
const ARTWORK_RETRY_MS = 10 * 60 * 1000;
// Widgets showing artwork that arrives after the content write.
const ARTWORK_KINDS: ContentWidgetKind[] = ['LibraryShelf', 'ReciterSpotlight', 'BayaanNow'];

let lastContent: WidgetContent | null = null;
let cachedPlaylists: PlaylistWithItems[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> | null = null;
let again = false;
let pendingPlaylists = false;
const artworkFailures = new Map<string, number>();

/** For tests: forget everything written so far. */
export function resetContentSync(): void {
  lastContent = null;
  cachedPlaylists = [];
  if (timer) clearTimeout(timer);
  timer = null;
  flushing = null;
  again = false;
  pendingPlaylists = false;
  artworkFailures.clear();
}

export function spotlightReciters(): Reciter[] {
  return [
    ...getFeaturedReciters(),
    ...getBayaanOriginalsReciters(),
    ...getTrendingReciters(),
  ];
}

export function contentArtworkJobs(
  content: WidgetContent,
  isCached: (file: string) => boolean,
  reciterArtworkUrl: (reciterId: string) => string | null,
): Map<string, string> {
  const jobs = new Map<string, string>();
  const surahIds = new Set<number>([
    ...content.downloads.map(i => i.surahId),
    ...content.playlists.flatMap(p => p.items.map(i => i.surahId)),
  ]);
  for (const id of surahIds) {
    const file = surahArtworkFileName(id);
    if (!isCached(file)) jobs.set(file, surahArtworkUrl(id));
  }
  for (const r of content.spotlight) {
    if (isCached(r.artworkFile)) continue;
    const url = reciterArtworkUrl(r.id);
    if (url) jobs.set(r.artworkFile, url);
  }
  return jobs;
}

function reciterArtworkUrl(reciterId: string): string | null {
  const reciter = getReciterByIdSync(reciterId);
  if (!reciter) return null;
  const url = getReciterArtwork(reciter);
  return url.startsWith('data:') ? null : url;
}

async function cacheContentArtwork(content: WidgetContent): Promise<boolean> {
  let added = false;
  for (const [file, url] of contentArtworkJobs(content, hasArtwork, reciterArtworkUrl)) {
    const failedAt = artworkFailures.get(url);
    if (failedAt !== undefined && Date.now() - failedAt < ARTWORK_RETRY_MS) {
      continue;
    }
    try {
      if (await cacheArtwork(url, file)) {
        artworkFailures.delete(url);
        added = true;
      } else {
        artworkFailures.set(url, Date.now());
      }
    } catch (error) {
      artworkFailures.set(url, Date.now());
      console.error('[WidgetSync] Failed to cache content artwork:', error);
    }
  }
  return added;
}

async function loadPlaylists(): Promise<PlaylistWithItems[]> {
  const all = await playlistService.getAllPlaylists();
  const recent = [...all]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, PLAYLIST_LIMIT);
  return Promise.all(
    recent.map(async playlist => ({
      playlist,
      items: await playlistService.getPlaylistItems(playlist.id),
    })),
  );
}

async function flushOnce(reloadPlaylists: boolean): Promise<void> {
  if (reloadPlaylists) {
    try {
      cachedPlaylists = await loadPlaylists();
    } catch (error) {
      console.error('[WidgetSync] Failed to read playlists for widgets:', error);
    }
  }
  const next = buildContent({
    now: Date.now(),
    downloads: useDownloadStore.getState().downloads,
    playlists: cachedPlaylists,
    spotlight: spotlightReciters(),
    sleepTimerEnd: usePlayerStore.getState().settings.sleepTimerEnd,
    surahName: id => getSurahById(id)?.name ?? null,
    reciterName: id => getReciterByIdSync(id)?.name ?? null,
  });
  const kinds = changedContentKindsForContent(lastContent, next);
  if (kinds.length > 0) {
    writeContent(next);
    reloadWidgets(kinds);
    lastContent = next;
  }
  if (lastContent && (await cacheContentArtwork(lastContent))) {
    reloadWidgets(ARTWORK_KINDS);
  }
}

// Serialized: a flush requested while one runs runs once more afterwards.
export function flushContent(reloadPlaylists = false): Promise<void> {
  pendingPlaylists = pendingPlaylists || reloadPlaylists;
  if (flushing) {
    again = true;
    return flushing;
  }
  const run = async (): Promise<void> => {
    try {
      do {
        again = false;
        const reload = pendingPlaylists;
        pendingPlaylists = false;
        try {
          await flushOnce(reload);
        } catch (error) {
          console.error('[WidgetSync] Failed to flush widget content:', error);
        }
      } while (again);
    } finally {
      flushing = null;
    }
  };
  flushing = run();
  return flushing;
}

function schedule(reloadPlaylists = false): void {
  pendingPlaylists = pendingPlaylists || reloadPlaylists;
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flushContent();
  }, DEBOUNCE_MS);
}

// Started by the root layout next to startWidgetSync.
export function startContentWidgetSync(): () => void {
  if (!isWidgetsAvailable()) return () => undefined;
  void flushContent(true);
  const unsubs = [
    addSnapshotListener((prev, next) => {
      const kinds = changedContentKindsForSnapshot(prev, next);
      if (kinds.length > 0) reloadWidgets(kinds);
    }),
    useDownloadStore.subscribe((state, prev) => {
      if (state.downloads !== prev.downloads) schedule();
    }),
    usePlaylistsStore.subscribe((state, prev) => {
      if (state.playlists !== prev.playlists) schedule(true);
    }),
    // Not debounced: Android pauses JS timers in the background.
    usePlayerStore.subscribe((state, prev) => {
      if (state.settings.sleepTimerEnd !== prev.settings.sleepTimerEnd) {
        void flushContent();
      }
    }),
    // RECITERS fills in place after the catalog loads; the spotlight follows.
    useReciterStore.subscribe(() => schedule()),
  ];
  const appState = AppState.addEventListener('change', state => {
    if (state === 'active') void flushContent(true);
  });
  return () => {
    unsubs.forEach(u => u());
    appState.remove();
    if (timer) clearTimeout(timer);
    timer = null;
  };
}
```

Run: `npx jest services/widgets/__tests__/syncContentWidgets.test.ts`
Expected: PASS.

- [ ] **Step 8: Start the sync from the root layout**

In `app/_layout.tsx`, add the import next to the other widget imports:

```ts
import {startContentWidgetSync} from '@/services/widgets/syncContentWidgets';
```

and extend the `appIsReady` effect:

```ts
    const stopSnapshot = startWidgetSync();
    const stopConfigured = startConfiguredWidgetSync();
    const stopContent = startContentWidgetSync();
    return () => {
      stopSnapshot();
      stopConfigured();
      stopContent();
    };
```

(Keep any Phase 2 start call in the same effect as it is.)

- [ ] **Step 9: Run everything, typecheck, format, commit**

```bash
npm run test:ci -- --silent
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
npx prettier --write services/widgets/buildContent.ts services/widgets/contentCommands.ts services/widgets/syncContentWidgets.ts services/widgets/handleWidgetCommand.ts services/widgets/syncWidgets.ts app/_layout.tsx services/widgets/__tests__/buildContent.test.ts services/widgets/__tests__/contentCommands.test.ts services/widgets/__tests__/contentRouting.test.ts services/widgets/__tests__/syncContentWidgets.test.ts services/widgets/__tests__/snapshotListeners.test.ts
git add services/widgets/buildContent.ts services/widgets/contentCommands.ts services/widgets/syncContentWidgets.ts services/widgets/handleWidgetCommand.ts services/widgets/syncWidgets.ts app/_layout.tsx services/widgets/__tests__/buildContent.test.ts services/widgets/__tests__/contentCommands.test.ts services/widgets/__tests__/contentRouting.test.ts services/widgets/__tests__/syncContentWidgets.test.ts services/widgets/__tests__/snapshotListeners.test.ts
git commit -m "feat(widgets): write widget content and handle playlist and bedtime taps"
```

---
### Task 7: Recently Played and Library Shelf (iOS and Android)

**Files:**
- Create (iOS): `targets/widgets/RecentlyPlayed/RecentlyPlayedWidget.swift`, `targets/widgets/LibraryShelf/LibraryShelfWidget.swift`, `targets/widgets/ContentWidgets.swift`
- Modify (iOS): `targets/widgets/WidgetsBundle.swift`
- Create (Android): `java/expo/modules/bayaanwidgets/recentlyplayed/RecentlyPlayedWidget.kt`, `recentlyplayed/RecentlyPlayedReceiver.kt`, `libraryshelf/LibraryShelfWidget.kt`, `libraryshelf/LibraryShelfReceiver.kt`, `libraryshelf/LibraryShelfConfigActivity.kt`, `res/xml/recently_played_info.xml`, `res/xml/library_shelf_info.xml`
- Modify (Android): `ui/ContentUi.kt`, `BayaanWidgetsModule.kt`, `AndroidManifest.xml`, `res/values/strings.xml`

**Interfaces:**
- Consumes: Task 4 (`ContentResolvers.recentShelf/library`, `ContentStore`, `LibrarySourceEntity`, `PlayPlaylistIntent`, `ShelfHeader`, `SurahTileButton`, `ContentMessage`, `ContentText.surahCount`); Task 5 (`ContentLogic.recentShelf/library`, `ContentModels.decodeContent`, `ContentConfigJson`, `ShelfHeader`, `SurahTile`, `ContentMessage`, `contentRoot`); 1b (`PlayTrackIntent`, `RoundIntentButton`, `ArtworkRequestStore`, `commandAction`, `playTrackCommand`, `deepLink`, `recordMissingArtwork`, `RoundButton`, `ConfigPicker`).
- Produces: widget kinds `RecentlyPlayed`, `LibraryShelf`; `ContentWidgets: WidgetBundle` (later tasks add their widgets to it); Android `playPlaylistCommand(playlistId: String, itemId: String?): JSONObject` in `ui/ContentUi.kt`.

- [ ] **Step 1: iOS Recently Played**

```swift
// targets/widgets/RecentlyPlayed/RecentlyPlayedWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

struct RecentlyPlayedEntry: TimelineEntry {
  let date: Date
  let shelf: RecentShelf
}

struct RecentlyPlayedProvider: TimelineProvider {
  func placeholder(in context: Context) -> RecentlyPlayedEntry {
    RecentlyPlayedEntry(date: .now, shelf: RecentShelf(tracks: [], isSuggestion: false))
  }

  func getSnapshot(in context: Context, completion: @escaping (RecentlyPlayedEntry) -> Void) {
    completion(entry(context))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<RecentlyPlayedEntry>) -> Void) {
    let e = entry(context)
    ArtworkRequestStore.recordMissing(surahs: e.shelf.tracks.compactMap { StaticData.surah($0.surahId) }, reciterFiles: [])
    // The app reloads this kind when recent plays or the default reciter change.
    completion(Timeline(entries: [e], policy: .never))
  }

  private func entry(_ context: Context) -> RecentlyPlayedEntry {
    RecentlyPlayedEntry(date: .now, shelf: ContentResolvers.recentShelf(
      SnapshotStore.load(), limit: context.family == .systemLarge ? 6 : 4))
  }
}

struct RecentlyPlayedWidget: Widget {
  let kind = "RecentlyPlayed"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: RecentlyPlayedProvider()) { entry in
      RecentlyPlayedView(entry: entry)
    }
    .configurationDisplayName("Recently Played")
    .description("Jump back into what you listened to.")
    .supportedFamilies([.systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}

struct RecentlyPlayedView: View {
  @Environment(\.widgetFamily) private var family
  let entry: RecentlyPlayedEntry

  var body: some View {
    Group {
      if entry.shelf.tracks.isEmpty {
        ContentMessage(title: "Open Bayaan", detail: "Your recent surahs show here")
      } else {
        VStack(alignment: .leading, spacing: 10) {
          ShelfHeader(title: entry.shelf.isSuggestion ? "Start listening" : "Recently Played")
          if family == .systemLarge { large } else { medium }
          Spacer(minLength: 0)
        }
        .padding(14)
      }
    }
    .foregroundStyle(.white)
    .containerBackground(for: .widget) { WidgetPalette.background }
    .widgetURL(URL(string: "bayaan://player"))
  }

  private func intent(_ t: WidgetTrack) -> PlayTrackIntent {
    PlayTrackIntent(surahId: t.surahId, reciterId: t.reciterId, rewayatId: t.rewayatId)
  }

  private var medium: some View {
    HStack(spacing: 8) {
      ForEach(Array(entry.shelf.tracks.prefix(4).enumerated()), id: \.offset) { _, t in
        SurahTileButton(surahId: t.surahId, size: 62, intent: intent(t)).frame(maxWidth: .infinity)
      }
    }
  }

  private var large: some View {
    let tracks = Array(entry.shelf.tracks.prefix(6))
    return VStack(spacing: 12) {
      ForEach(0..<2, id: \.self) { row in
        HStack(spacing: 10) {
          ForEach(0..<3, id: \.self) { col in
            let i = row * 3 + col
            if i < tracks.count {
              SurahTileButton(surahId: tracks[i].surahId, size: 84, intent: intent(tracks[i]), caption: tracks[i].reciterName)
                .frame(maxWidth: .infinity)
            } else {
              Color.clear.frame(maxWidth: .infinity, maxHeight: 1)
            }
          }
        }
      }
    }
  }
}

private let previewTracks = [18, 36, 67, 55, 56, 1].map {
  WidgetTrack(surahId: $0, surahName: "", reciterId: "r", reciterName: "Mishary Alafasi",
              rewayatId: nil, artworkFile: nil, isUserUpload: false)
}

#Preview("Medium", as: .systemMedium) {
  RecentlyPlayedWidget()
} timeline: {
  RecentlyPlayedEntry(date: .now, shelf: RecentShelf(tracks: previewTracks, isSuggestion: false))
  RecentlyPlayedEntry(date: .now, shelf: RecentShelf(tracks: Array(previewTracks.prefix(4)), isSuggestion: true))
}

#Preview("Large", as: .systemLarge) {
  RecentlyPlayedWidget()
} timeline: {
  RecentlyPlayedEntry(date: .now, shelf: RecentShelf(tracks: previewTracks, isSuggestion: false))
  RecentlyPlayedEntry(date: .now, shelf: RecentShelf(tracks: [], isSuggestion: false))
}
```

- [ ] **Step 2: iOS Library Shelf**

```swift
// targets/widgets/LibraryShelf/LibraryShelfWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

struct LibraryShelfConfigIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "Library Shelf"
  static var description = IntentDescription("Your downloads or a playlist, one tap away.")

  @Parameter(title: "Show") var source: LibrarySourceEntity?
}

struct LibraryShelfEntry: TimelineEntry {
  let date: Date
  let state: LibraryShelfState
}

struct LibraryShelfProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> LibraryShelfEntry {
    LibraryShelfEntry(date: .now, state: .downloads(items: [], count: 0))
  }

  func snapshot(for configuration: LibraryShelfConfigIntent, in context: Context) async -> LibraryShelfEntry {
    entry(configuration)
  }

  func timeline(for configuration: LibraryShelfConfigIntent, in context: Context) async -> Timeline<LibraryShelfEntry> {
    let e = entry(configuration)
    let items: [WidgetShelfItem]
    switch e.state {
    case let .downloads(list, _): items = list
    case let .playlist(p): items = p.items
    case .playlistUnavailable, .noContent: items = []
    }
    ArtworkRequestStore.recordMissing(surahs: items.compactMap { StaticData.surah($0.surahId) }, reciterFiles: [])
    // The app reloads this kind when downloads or playlists change.
    return Timeline(entries: [e], policy: .never)
  }

  private func entry(_ configuration: LibraryShelfConfigIntent) -> LibraryShelfEntry {
    LibraryShelfEntry(date: .now, state: ContentResolvers.library(sourceId: configuration.source?.id, content: ContentStore.load()))
  }
}

struct LibraryShelfWidget: Widget {
  let kind = "LibraryShelf"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: LibraryShelfConfigIntent.self, provider: LibraryShelfProvider()) { entry in
      LibraryShelfView(entry: entry)
    }
    .configurationDisplayName("Library")
    .description("Your downloads or a playlist, one tap away.")
    .supportedFamilies([.systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}

struct LibraryShelfView: View {
  @Environment(\.widgetFamily) private var family
  let entry: LibraryShelfEntry

  private var isLarge: Bool { family == .systemLarge }

  var body: some View {
    Group {
      switch entry.state {
      case let .downloads(items, count):
        if items.isEmpty {
          ContentMessage(title: "No downloads yet", detail: "Downloaded surahs show here")
        } else {
          shelf(ShelfHeader(title: "Downloads", detail: ContentText.surahCount(count)), items: items) {
            PlayTrackIntent(surahId: $0.surahId, reciterId: $0.reciterId, rewayatId: $0.rewayatId)
          }
        }
      case let .playlist(p):
        let header = ShelfHeader(title: p.name, detail: ContentText.surahCount(p.itemCount)) {
          RoundIntentButton(intent: PlayPlaylistIntent(playlistId: p.id, itemId: nil), systemName: "play.fill", label: "Play \(p.name)")
        }
        if p.items.isEmpty {
          VStack(alignment: .leading, spacing: 10) {
            header
            Spacer(minLength: 0)
            Text("Open the playlist in Bayaan").font(.caption).opacity(0.6)
            Spacer(minLength: 0)
          }
          .padding(14)
        } else {
          shelf(header, items: p.items) { PlayPlaylistIntent(playlistId: p.id, itemId: $0.itemId) }
        }
      case .playlistUnavailable:
        ContentMessage(title: "Playlist unavailable", detail: "Edit the widget to choose another")
      case .noContent:
        ContentMessage(title: "Open Bayaan", detail: "to load your library")
      }
    }
    .foregroundStyle(.white)
    .containerBackground(for: .widget) { WidgetPalette.background }
    .widgetURL(url)
  }

  private var url: URL? {
    switch entry.state {
    case .downloads: return URL(string: "bayaan://collection/downloads")
    case .playlist, .playlistUnavailable: return URL(string: "bayaan://collection/playlists")
    case .noContent: return nil
    }
  }

  private func shelf<H: View, I: AppIntent>(_ header: H, items: [WidgetShelfItem],
                                             intent: @escaping (WidgetShelfItem) -> I) -> some View {
    let shown = Array(items.prefix(isLarge ? 8 : 4))
    let rows = (shown.count + 3) / 4
    return VStack(alignment: .leading, spacing: 10) {
      header
      ForEach(0..<rows, id: \.self) { row in
        HStack(spacing: 8) {
          ForEach(0..<4, id: \.self) { col in
            let i = row * 4 + col
            if i < shown.count {
              SurahTileButton(surahId: shown[i].surahId, size: isLarge ? 62 : 58, intent: intent(shown[i]),
                              caption: isLarge ? shown[i].surahName : nil)
                .frame(maxWidth: .infinity)
            } else {
              Color.clear.frame(maxWidth: .infinity, maxHeight: 1)
            }
          }
        }
      }
      Spacer(minLength: 0)
    }
    .padding(14)
  }
}

private let previewItems = [67, 18, 36, 55, 56, 1, 112, 114].map {
  WidgetShelfItem(surahId: $0, surahName: StaticData.surah($0)?.name ?? "", reciterId: "r",
                  reciterName: "Mishary Alafasi", rewayatId: nil, itemId: "i\($0)")
}

#Preview("Medium", as: .systemMedium) {
  LibraryShelfWidget()
} timeline: {
  LibraryShelfEntry(date: .now, state: .downloads(items: previewItems, count: 12))
  LibraryShelfEntry(date: .now, state: .playlist(WidgetPlaylist(id: "p", name: "Night", itemCount: 3, items: Array(previewItems.prefix(3)))))
  LibraryShelfEntry(date: .now, state: .playlist(WidgetPlaylist(id: "u", name: "Uploads only", itemCount: 2, items: [])))
  LibraryShelfEntry(date: .now, state: .playlistUnavailable)
}

#Preview("Large", as: .systemLarge) {
  LibraryShelfWidget()
} timeline: {
  LibraryShelfEntry(date: .now, state: .downloads(items: previewItems, count: 12))
  LibraryShelfEntry(date: .now, state: .noContent)
}
```

- [ ] **Step 3: The nested bundle**

```swift
// targets/widgets/ContentWidgets.swift
import SwiftUI
import WidgetKit

/// Phase 3 widgets, nested because a WidgetBundleBuilder takes at most 10 children (P3-R16).
struct ContentWidgets: WidgetBundle {
  var body: some Widget {
    RecentlyPlayedWidget()
    LibraryShelfWidget()
  }
}
```

In `targets/widgets/WidgetsBundle.swift`, add as the last line of `body` (after Phase 2's entries):

```swift
    ContentWidgets().body
```

- [ ] **Step 4: iOS build**

```bash
npm run prebuild
xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20
```
Expected: `** BUILD SUCCEEDED **`. If the compiler rejects `ContentWidgets().body` inside the main bundle, replace that line with the two widgets listed directly only if the main bundle still has room (count its children); otherwise split the main bundle's existing children into a second nested bundle the same way and report it (P3-R16).

- [ ] **Step 5: Android shared command helper**

Append to `ui/ContentUi.kt` (add `import org.json.JSONObject`):

```kotlin
fun playPlaylistCommand(playlistId: String, itemId: String?): JSONObject =
  JSONObject().put("type", "playPlaylist").put("playlistId", playlistId).put("itemId", itemId ?: JSONObject.NULL)
```

- [ ] **Step 6: Android Recently Played**

```kotlin
// recentlyplayed/RecentlyPlayedWidget.kt
package expo.modules.bayaanwidgets.recentlyplayed

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import expo.modules.bayaanwidgets.ContentLogic
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.RecentShelf
import expo.modules.bayaanwidgets.SnapshotModels
import expo.modules.bayaanwidgets.WidgetInputs
import expo.modules.bayaanwidgets.ui.ContentMessage
import expo.modules.bayaanwidgets.ui.ShelfHeader
import expo.modules.bayaanwidgets.ui.SurahTile
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.commandAction
import expo.modules.bayaanwidgets.ui.contentRoot
import expo.modules.bayaanwidgets.ui.deepLink
import expo.modules.bayaanwidgets.ui.playTrackCommand
import expo.modules.bayaanwidgets.ui.recordMissingArtwork

class RecentlyPlayedWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.MEDIUM, WidgetSizes.LARGE))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    recordMissingArtwork(context, shelf(stored).tracks.map { it.surahId }, emptyList())
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      val shelf = remember(inputs) { shelf(inputs) }
      Content(context, shelf)
    }
  }

  private fun shelf(inputs: WidgetInputs): RecentShelf =
    ContentLogic.recentShelf(inputs.snapshotJson?.let { SnapshotModels.decode(it) })

  @Composable
  private fun Content(context: Context, shelf: RecentShelf) {
    val large = LocalSize.current.height >= WidgetSizes.LARGE.height
    val root = contentRoot().clickable(deepLink(context, "bayaan://player"))
    if (shelf.tracks.isEmpty()) {
      ContentMessage(root, "Open Bayaan", "Your recent surahs show here")
      return
    }
    Column(root.padding(14.dp)) {
      ShelfHeader(if (shelf.isSuggestion) "Start listening" else "Recently Played", null)
      Spacer(GlanceModifier.height(10.dp))
      shelf.tracks.take(if (large) 6 else 4).chunked(if (large) 3 else 4).forEach { row ->
        Row(GlanceModifier.fillMaxWidth().padding(bottom = 8.dp)) {
          row.forEachIndexed { i, t ->
            if (i > 0) Spacer(GlanceModifier.defaultWeight())
            val action = commandAction(context, playTrackCommand(t.surahId, t.reciterId, t.rewayatId, null),
              "recent/${t.surahId}/${t.reciterId}/${t.rewayatId ?: "any"}")
            SurahTile(context, t.surahId, if (large) 60 else 52, action, if (large) t.reciterName else null)
          }
        }
      }
    }
  }
}
```

```kotlin
// recentlyplayed/RecentlyPlayedReceiver.kt
package expo.modules.bayaanwidgets.recentlyplayed

import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver

class RecentlyPlayedReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = RecentlyPlayedWidget()
}
```

`res/xml/recently_played_info.xml`:

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/bayaan_widget_recently_played_desc"
  android:minWidth="250dp"
  android:minHeight="110dp"
  android:targetCellWidth="4"
  android:targetCellHeight="2"
  android:maxResizeWidth="400dp"
  android:maxResizeHeight="400dp"
  android:resizeMode="horizontal|vertical"
  android:updatePeriodMillis="0"
  android:widgetCategory="home_screen"
  android:initialLayout="@layout/glance_default_loading_layout" />
```

- [ ] **Step 7: Android Library Shelf**

```kotlin
// libraryshelf/LibraryShelfWidget.kt
package expo.modules.bayaanwidgets.libraryshelf

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalSize
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import expo.modules.bayaanwidgets.ContentConfigJson
import expo.modules.bayaanwidgets.ContentLogic
import expo.modules.bayaanwidgets.ContentModels
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.LibraryShelfState
import expo.modules.bayaanwidgets.WidgetInputs
import expo.modules.bayaanwidgets.WidgetShelfItem
import expo.modules.bayaanwidgets.ui.ContentMessage
import expo.modules.bayaanwidgets.ui.RoundButton
import expo.modules.bayaanwidgets.ui.ShelfHeader
import expo.modules.bayaanwidgets.ui.SurahTile
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.commandAction
import expo.modules.bayaanwidgets.ui.contentRoot
import expo.modules.bayaanwidgets.ui.deepLink
import expo.modules.bayaanwidgets.ui.playPlaylistCommand
import expo.modules.bayaanwidgets.ui.playTrackCommand
import expo.modules.bayaanwidgets.ui.recordMissingArtwork

class LibraryShelfWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.MEDIUM, WidgetSizes.LARGE))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val appWidgetId = GlanceState.appWidgetId(context, id)
    val stored = GlanceState.stored(context, appWidgetId)
    recordMissingArtwork(context, items(resolve(stored)).map { it.surahId }, emptyList())
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      val state = remember(inputs) { resolve(inputs) }
      Content(context, appWidgetId, state)
    }
  }

  private fun resolve(inputs: WidgetInputs): LibraryShelfState = ContentLogic.library(
    ContentConfigJson.decodeLibraryShelf(inputs.configJson).sourceId,
    inputs.contentJson?.let { ContentModels.decodeContent(it) },
  )

  private fun items(state: LibraryShelfState): List<WidgetShelfItem> = when (state) {
    is LibraryShelfState.Downloads -> state.items
    is LibraryShelfState.Playlist -> state.playlist.items
    else -> emptyList()
  }

  private fun configure(context: Context, appWidgetId: Int): Action = actionStartActivity(
    Intent(context, LibraryShelfConfigActivity::class.java)
      .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
      .setData(Uri.parse("bayaan-widget://configure/library/$appWidgetId")),
  )

  @Composable
  private fun Content(context: Context, appWidgetId: Int, state: LibraryShelfState) {
    val large = LocalSize.current.height >= WidgetSizes.LARGE.height
    when (state) {
      is LibraryShelfState.Downloads -> {
        val root = contentRoot().clickable(deepLink(context, "bayaan://collection/downloads"))
        if (state.items.isEmpty()) {
          ContentMessage(root, "No downloads yet", "Downloaded surahs show here")
          return
        }
        Shelf(context, root, large, { ShelfHeader("Downloads", ContentLogic.surahCount(state.count)) }, state.items) { item ->
          commandAction(context, playTrackCommand(item.surahId, item.reciterId, item.rewayatId, null),
            "library/downloads/${item.surahId}/${item.reciterId}/${item.rewayatId ?: "any"}")
        }
      }
      is LibraryShelfState.Playlist -> {
        val p = state.playlist
        val root = contentRoot().clickable(deepLink(context, "bayaan://collection/playlists"))
        val playAll = commandAction(context, playPlaylistCommand(p.id, null), "library/playlist/${p.id}")
        val header: @Composable () -> Unit = {
          ShelfHeader(p.name, ContentLogic.surahCount(p.itemCount)) { RoundButton(android.R.drawable.ic_media_play, "Play ${p.name}", playAll) }
        }
        if (p.items.isEmpty()) {
          Column(root.padding(14.dp)) {
            header()
            Spacer(GlanceModifier.defaultWeight())
            Text("Open the playlist in Bayaan", style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 12.sp))
            Spacer(GlanceModifier.defaultWeight())
          }
          return
        }
        Shelf(context, root, large, header, p.items) { item ->
          commandAction(context, playPlaylistCommand(p.id, item.itemId), "library/playlist/${p.id}/${item.itemId}")
        }
      }
      LibraryShelfState.PlaylistUnavailable ->
        ContentMessage(contentRoot().clickable(configure(context, appWidgetId)), "Playlist unavailable", "Tap to choose another")
      LibraryShelfState.NoContent -> ContentMessage(contentRoot(), "Open Bayaan", "to load your library")
    }
  }

  @Composable
  private fun Shelf(
    context: Context, root: GlanceModifier, large: Boolean, header: @Composable () -> Unit,
    items: List<WidgetShelfItem>, action: (WidgetShelfItem) -> Action,
  ) {
    Column(root.padding(14.dp)) {
      header()
      Spacer(GlanceModifier.height(10.dp))
      items.take(if (large) 8 else 4).chunked(4).forEach { row ->
        Row(GlanceModifier.fillMaxWidth().padding(bottom = 8.dp)) {
          row.forEachIndexed { i, item ->
            if (i > 0) Spacer(GlanceModifier.defaultWeight())
            SurahTile(context, item.surahId, if (large) 48 else 52, action(item), if (large) item.surahName else null)
          }
        }
      }
    }
  }
}
```

```kotlin
// libraryshelf/LibraryShelfReceiver.kt
package expo.modules.bayaanwidgets.libraryshelf

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import expo.modules.bayaanwidgets.WidgetStorage

class LibraryShelfReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = LibraryShelfWidget()

  override fun onDeleted(context: Context, appWidgetIds: IntArray) {
    super.onDeleted(context, appWidgetIds)
    WidgetStorage.deleteConfigs(context, appWidgetIds)
  }
}
```

```kotlin
// libraryshelf/LibraryShelfConfigActivity.kt
package expo.modules.bayaanwidgets.libraryshelf

import android.app.Activity
import android.os.Bundle
import expo.modules.bayaanwidgets.ContentConfigJson
import expo.modules.bayaanwidgets.ContentLogic
import expo.modules.bayaanwidgets.ContentModels
import expo.modules.bayaanwidgets.LibraryShelfConfig
import expo.modules.bayaanwidgets.WidgetStorage
import expo.modules.bayaanwidgets.ui.ConfigPicker

/** Picks Downloads or a playlist from content.json. */
class LibraryShelfConfigActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val appWidgetId = ConfigPicker.begin(this) ?: return
    val playlists = WidgetStorage.readContentJson(this)?.let { ContentModels.decodeContent(it) }?.playlists.orEmpty()
    ConfigPicker.pick(this, "Library", listOf("Downloads") + playlists.map { it.name },
      onPick = { i ->
        val source = if (i == 0) ContentLogic.DOWNLOADS else ContentLogic.PLAYLIST_PREFIX + playlists[i - 1].id
        ConfigPicker.save(this, appWidgetId, ContentConfigJson.encode(LibraryShelfConfig(source)), LibraryShelfWidget())
      },
      onCancel = { finish() })
  }
}
```

`res/xml/library_shelf_info.xml`:

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/bayaan_widget_library_shelf_desc"
  android:minWidth="250dp"
  android:minHeight="110dp"
  android:targetCellWidth="4"
  android:targetCellHeight="2"
  android:maxResizeWidth="400dp"
  android:maxResizeHeight="400dp"
  android:resizeMode="horizontal|vertical"
  android:updatePeriodMillis="0"
  android:widgetCategory="home_screen"
  android:configure="expo.modules.bayaanwidgets.libraryshelf.LibraryShelfConfigActivity"
  android:widgetFeatures="reconfigurable|configuration_optional"
  android:initialLayout="@layout/glance_default_loading_layout" />
```

- [ ] **Step 8: Register on Android**

`strings.xml`, before `</resources>`:

```xml
  <string name="bayaan_widget_recently_played_label">Recently Played</string>
  <string name="bayaan_widget_recently_played_desc">Jump back into what you listened to.</string>
  <string name="bayaan_widget_library_shelf_label">Library</string>
  <string name="bayaan_widget_library_shelf_desc">Your downloads or a playlist, one tap away.</string>
```

`AndroidManifest.xml`, inside `<application>`:

```xml
    <receiver
      android:name="expo.modules.bayaanwidgets.recentlyplayed.RecentlyPlayedReceiver"
      android:exported="true"
      android:label="@string/bayaan_widget_recently_played_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
      </intent-filter>
      <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/recently_played_info" />
    </receiver>
    <receiver
      android:name="expo.modules.bayaanwidgets.libraryshelf.LibraryShelfReceiver"
      android:exported="true"
      android:label="@string/bayaan_widget_library_shelf_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
      </intent-filter>
      <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/library_shelf_info" />
    </receiver>
    <activity
      android:name="expo.modules.bayaanwidgets.libraryshelf.LibraryShelfConfigActivity"
      android:exported="true"
      android:excludeFromRecents="true"
      android:taskAffinity=""
      android:theme="@android:style/Theme.Translucent.NoTitleBar">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_CONFIGURE" />
      </intent-filter>
    </activity>
```

`BayaanWidgetsModule.kt`: add the imports and two cases to the `when (kind)` in `reloadWidgets`:

```kotlin
import expo.modules.bayaanwidgets.libraryshelf.LibraryShelfWidget
import expo.modules.bayaanwidgets.recentlyplayed.RecentlyPlayedWidget
```

```kotlin
          "RecentlyPlayed" -> push(RecentlyPlayedWidget())
          "LibraryShelf" -> push(LibraryShelfWidget())
```

- [ ] **Step 9: Build Android and commit**

```bash
cd android && ./gradlew :bayaan-widgets:testReleaseUnitTest && ./gradlew :app:assembleRelease && cd ..
git add targets/widgets/RecentlyPlayed/RecentlyPlayedWidget.swift targets/widgets/LibraryShelf/LibraryShelfWidget.swift targets/widgets/ContentWidgets.swift targets/widgets/WidgetsBundle.swift modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/recentlyplayed modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/libraryshelf modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/ui/ContentUi.kt modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/BayaanWidgetsModule.kt modules/bayaan-widgets/android/src/main/AndroidManifest.xml modules/bayaan-widgets/android/src/main/res/values/strings.xml modules/bayaan-widgets/android/src/main/res/xml/recently_played_info.xml modules/bayaan-widgets/android/src/main/res/xml/library_shelf_info.xml
git commit -m "feat(widgets): add the Recently Played and Library widgets"
```

---
### Task 8: Bedtime and Reciter Spotlight (iOS and Android)

**Files:**
- Create (iOS): `targets/widgets/Bedtime/BedtimeWidget.swift`, `targets/widgets/Spotlight/ReciterSpotlightWidget.swift`
- Modify (iOS): `targets/widgets/ContentWidgets.swift`
- Create (Android): `java/expo/modules/bayaanwidgets/bedtime/BedtimeWidget.kt`, `bedtime/BedtimeReceiver.kt`, `bedtime/BedtimeConfigActivity.kt`, `spotlight/ReciterSpotlightWidget.kt`, `spotlight/ReciterSpotlightReceiver.kt`, `res/xml/bedtime_info.xml`, `res/xml/reciter_spotlight_info.xml`, `res/drawable/widget_moon.xml`
- Modify (Android): `ui/ContentUi.kt`, `ContextClockReceiver.kt`, `BayaanWidgetsModule.kt`, `AndroidManifest.xml`, `res/values/strings.xml`

**Interfaces:**
- Consumes: Task 4 (`StartBedtimeIntent`, `SleepMinutesOption`, `AmbientOption`, `ContentLogic.sleepActive/bedtimeRelevance/boundaries/hour`, `ContentResolvers.spotlight`, `ContentStore`, `TimelineEntryRelevance.scored`, `ContentMessage`); Phase 2 `SurahEntity` (`_shared/SurahEntity.swift`); 1b `ReciterEntity`, `CatalogStore`, `SurahCard`, `ReciterPhoto`, `RoundGlyph`, `RoundIntentButton`, `PlayReciterIntent`, `PlayTrackIntent`, `WidgetLogic.nextMidnight`; Task 5 (`ContentConfigJson`, `BedtimeConfig`, `ContentLogic.spotlight/sleepActive`, `ClockTarget`, `clockTime`, `contentRoot`).
- Produces: kinds `Bedtime`, `ReciterSpotlight`; iOS `BedtimeSettings` (`BedtimeSettings.default(reciterName:)`), `BedtimeEntry.make(at:settings:content:next:)`, `BedtimeView(entry:)` (used by Bayaan Now); Android `@Composable fun BedtimeContent(context, config: BedtimeConfig, inputs: WidgetInputs)` (used by Bayaan Now), `startBedtimeCommand(config: BedtimeConfig): JSONObject`.

- [ ] **Step 1: iOS Bedtime**

```swift
// targets/widgets/Bedtime/BedtimeWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

struct BedtimeConfigIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "Bedtime"
  static var description = IntentDescription("Fall asleep to a surah with a sleep timer.")

  @Parameter(title: "Surah") var surah: SurahEntity?
  @Parameter(title: "Reciter") var reciter: ReciterEntity?
  @Parameter(title: "Sleep timer", default: .m30) var minutes: SleepMinutesOption
  @Parameter(title: "Ambient sound", default: .off) var ambient: AmbientOption
}

struct BedtimeSettings: Hashable {
  let surahId: Int
  let reciterId: String?
  let reciterName: String?
  let minutes: Int
  let ambient: AmbientOption

  /// Al-Mulk, default reciter, 30 minutes, no ambient (also Bayaan Now's bedtime card).
  static func `default`(reciterName: String?) -> BedtimeSettings {
    BedtimeSettings(surahId: 67, reciterId: nil, reciterName: reciterName, minutes: 30, ambient: .off)
  }
}

struct BedtimeEntry: TimelineEntry {
  let date: Date
  let settings: BedtimeSettings
  let sleepEndsAt: Date?
  let relevance: TimelineEntryRelevance?

  static func make(at date: Date, settings: BedtimeSettings, content: WidgetContent?, next: Date?) -> BedtimeEntry {
    let endsAt = content?.sleepTimerEndsAt
    return BedtimeEntry(
      date: date, settings: settings,
      sleepEndsAt: ContentLogic.sleepActive(endsAt: endsAt, now: date) ? endsAt.map { Date(timeIntervalSince1970: $0 / 1000) } : nil,
      relevance: .scored(ContentLogic.bedtimeRelevance(hour: ContentLogic.hour(date)), from: date, until: next))
  }
}

struct BedtimeProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> BedtimeEntry {
    BedtimeEntry(date: .now, settings: .default(reciterName: nil), sleepEndsAt: nil, relevance: nil)
  }

  func snapshot(for configuration: BedtimeConfigIntent, in context: Context) async -> BedtimeEntry {
    BedtimeEntry.make(at: .now, settings: settings(configuration), content: ContentStore.load(), next: nil)
  }

  // Entries at each context boundary (relevance changes at 21:00 and 04:00) and
  // when a running sleep timer ends; the app reloads on content changes.
  func timeline(for configuration: BedtimeConfigIntent, in context: Context) async -> Timeline<BedtimeEntry> {
    let s = settings(configuration)
    let content = ContentStore.load()
    ArtworkRequestStore.recordMissing(surahs: [StaticData.surah(s.surahId)].compactMap { $0 }, reciterFiles: [])
    let now = Date.now
    var dates = [now] + ContentLogic.boundaries(after: now)
    if let end = content?.sleepTimerEndsAt.map({ Date(timeIntervalSince1970: $0 / 1000) }), end > now {
      dates.append(end)
    }
    dates.sort()
    let entries = dates.enumerated().map { i, d in
      BedtimeEntry.make(at: d, settings: s, content: content, next: i + 1 < dates.count ? dates[i + 1] : nil)
    }
    return Timeline(entries: entries, policy: .atEnd)
  }

  private func settings(_ c: BedtimeConfigIntent) -> BedtimeSettings {
    let configured = CatalogStore.load()?.reciter(c.reciter?.id)?.name
    return BedtimeSettings(surahId: c.surah?.id ?? 67, reciterId: c.reciter?.id,
                           reciterName: configured ?? SnapshotStore.load()?.defaultReciter?.name,
                           minutes: c.minutes.minutes, ambient: c.ambient)
  }
}

struct BedtimeWidget: Widget {
  let kind = "Bedtime"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: BedtimeConfigIntent.self, provider: BedtimeProvider()) { entry in
      BedtimeView(entry: entry)
    }
    .configurationDisplayName("Bedtime")
    .description("Fall asleep to a surah with a sleep timer.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

struct BedtimeView: View {
  @Environment(\.widgetFamily) private var family
  let entry: BedtimeEntry

  private var surah: StaticSurah? { StaticData.surah(entry.settings.surahId) }

  private var intent: StartBedtimeIntent {
    StartBedtimeIntent(surahId: entry.settings.surahId, reciterId: entry.settings.reciterId,
                       sleepMinutes: entry.settings.minutes, ambient: entry.settings.ambient.commandValue)
  }

  private var detail: String {
    ["\(entry.settings.minutes) min", entry.settings.ambient.label].compactMap { $0 }.joined(separator: " · ")
  }

  var body: some View {
    // The whole widget is the action.
    Button(intent: intent) { content }
      .buttonStyle(.plain)
      .accessibilityLabel("Start bedtime with \(surah?.name ?? "")")
      .foregroundStyle(.white)
      .containerBackground(for: .widget) { WidgetPalette.background }
  }

  @ViewBuilder private var content: some View {
    if family == .systemSmall {
      VStack(alignment: .leading, spacing: 6) {
        HStack(alignment: .top) {
          SurahCard(surah: surah, size: 54)
          Spacer(minLength: 0)
          BayaanLogo(size: 12)
        }
        Spacer(minLength: 0)
        Text("Bedtime").font(.headline)
        HStack(alignment: .bottom) {
          subtitle.font(.caption).opacity(0.75).lineLimit(2)
          Spacer(minLength: 4)
          RoundGlyph(systemName: "moon.zzz.fill")
        }
      }
      .padding(12)
    } else {
      HStack(spacing: 12) {
        SurahCard(surah: surah, size: 96)
        VStack(alignment: .leading, spacing: 3) {
          HStack {
            Text("Bedtime").font(.caption.weight(.semibold)).opacity(0.6)
            Spacer(minLength: 0)
            BayaanLogo(size: 14)
          }
          Text(surah?.name ?? "").font(.headline).lineLimit(1)
          if let reciter = entry.settings.reciterName {
            Text(reciter).font(.subheadline).opacity(0.75).lineLimit(1)
          }
          Spacer(minLength: 0)
          HStack(alignment: .bottom) {
            subtitle.font(.caption).opacity(0.75).lineLimit(1)
            Spacer(minLength: 4)
            RoundGlyph(systemName: "moon.zzz.fill")
          }
        }
      }
      .padding(14)
    }
  }

  @ViewBuilder private var subtitle: some View {
    if let end = entry.sleepEndsAt {
      Text("Sleep at \(end, style: .time)")
    } else if family == .systemSmall {
      Text("\(surah?.name ?? "") · \(detail)")
    } else {
      Text(detail)
    }
  }
}

#Preview("Small", as: .systemSmall) {
  BedtimeWidget()
} timeline: {
  BedtimeEntry(date: .now, settings: .default(reciterName: "Mishary Alafasi"), sleepEndsAt: nil, relevance: nil)
  BedtimeEntry(date: .now, settings: .default(reciterName: "Mishary Alafasi"), sleepEndsAt: .now.addingTimeInterval(1_800), relevance: nil)
}

#Preview("Medium", as: .systemMedium) {
  BedtimeWidget()
} timeline: {
  BedtimeEntry(date: .now, settings: BedtimeSettings(surahId: 32, reciterId: "r", reciterName: "Mishary Alafasi", minutes: 45, ambient: .rain), sleepEndsAt: nil, relevance: nil)
}
```

- [ ] **Step 2: iOS Reciter Spotlight**

```swift
// targets/widgets/Spotlight/ReciterSpotlightWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

struct ReciterSpotlightEntry: TimelineEntry {
  let date: Date
  let reciter: WidgetSpotlightReciter?
}

struct ReciterSpotlightProvider: TimelineProvider {
  func placeholder(in context: Context) -> ReciterSpotlightEntry {
    ReciterSpotlightEntry(date: .now, reciter: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (ReciterSpotlightEntry) -> Void) {
    completion(ReciterSpotlightEntry(date: .now, reciter: ContentResolvers.spotlight(ContentStore.load(), date: .now)))
  }

  // Today's reciter now and tomorrow's at midnight; the app reloads when the list changes.
  func getTimeline(in context: Context, completion: @escaping (Timeline<ReciterSpotlightEntry>) -> Void) {
    let content = ContentStore.load()
    let now = Date.now
    let midnight = WidgetLogic.nextMidnight(after: now)
    let today = ContentResolvers.spotlight(content, date: now)
    if let r = today {
      let rows = context.family == .systemSmall ? [] : r.surahIds.compactMap { StaticData.surah($0) }
      ArtworkRequestStore.recordMissing(surahs: rows, reciterFiles: [(id: r.id, file: r.artworkFile)])
    }
    completion(Timeline(entries: [
      ReciterSpotlightEntry(date: now, reciter: today),
      ReciterSpotlightEntry(date: midnight, reciter: ContentResolvers.spotlight(content, date: midnight)),
    ], policy: .atEnd))
  }
}

struct ReciterSpotlightWidget: Widget {
  let kind = "ReciterSpotlight"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ReciterSpotlightProvider()) { entry in
      ReciterSpotlightView(entry: entry)
    }
    .configurationDisplayName("Reciter of the Day")
    .description("Meet a new reciter every day.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

struct ReciterSpotlightView: View {
  @Environment(\.widgetFamily) private var family
  let entry: ReciterSpotlightEntry

  var body: some View {
    Group {
      if let r = entry.reciter {
        if family == .systemSmall { small(r) } else { medium(r) }
      } else {
        ContentMessage(title: "Open Bayaan", detail: "to meet today's reciter")
      }
    }
    .foregroundStyle(.white)
    .containerBackground(for: .widget) { WidgetPalette.background }
  }

  private func small(_ r: WidgetSpotlightReciter) -> some View {
    Button(intent: PlayReciterIntent(reciterId: r.id)) {
      ZStack(alignment: .bottomLeading) {
        ReciterPhoto(file: r.artworkFile, name: r.name)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .clipped()
        LinearGradient(colors: [.clear, .black.opacity(0.7)], startPoint: .center, endPoint: .bottom)
        VStack(alignment: .leading, spacing: 2) {
          Text("Reciter of the Day").font(.caption2.weight(.semibold)).opacity(0.75)
          HStack(alignment: .bottom) {
            Text(r.name).font(.headline).lineLimit(2)
            Spacer(minLength: 4)
            RoundGlyph(systemName: "play.fill")
          }
        }
        .padding(12)
      }
      .overlay(alignment: .topTrailing) { BayaanLogo(size: 14).padding(12) }
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Play \(r.name)")
  }

  private func medium(_ r: WidgetSpotlightReciter) -> some View {
    HStack(spacing: 12) {
      ZStack(alignment: .bottomLeading) {
        ReciterPhoto(file: r.artworkFile, name: r.name)
          .frame(width: 106, height: 106)
          .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        RoundIntentButton(intent: PlayReciterIntent(reciterId: r.id), systemName: "play.fill", label: "Play \(r.name)")
          .padding(8)
      }
      VStack(alignment: .leading, spacing: 6) {
        HStack(alignment: .top) {
          VStack(alignment: .leading, spacing: 1) {
            Text("Reciter of the Day").font(.caption2.weight(.semibold)).opacity(0.6)
            Text(r.name).font(.subheadline.bold()).lineLimit(1)
          }
          Spacer(minLength: 0)
          BayaanLogo(size: 14)
        }
        ForEach(r.surahIds, id: \.self) { id in
          if let surah = StaticData.surah(id) {
            Button(intent: PlayTrackIntent(surahId: id, reciterId: r.id, rewayatId: nil)) {
              HStack(spacing: 8) {
                SurahCard(surah: surah, size: 24)
                Text(surah.name).font(.caption.weight(.semibold)).lineLimit(1)
                Spacer(minLength: 0)
              }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Play \(surah.name)")
          }
        }
        Spacer(minLength: 0)
      }
    }
    .padding(12)
  }
}

private let previewReciter = WidgetSpotlightReciter(id: "r", name: "Albaraa Basfar", artworkFile: "reciter-r.jpg", surahIds: [1, 18, 36])

#Preview("Small", as: .systemSmall) {
  ReciterSpotlightWidget()
} timeline: {
  ReciterSpotlightEntry(date: .now, reciter: previewReciter)
  ReciterSpotlightEntry(date: .now, reciter: nil)
}

#Preview("Medium", as: .systemMedium) {
  ReciterSpotlightWidget()
} timeline: {
  ReciterSpotlightEntry(date: .now, reciter: previewReciter)
}
```

In `targets/widgets/ContentWidgets.swift`, add to `body` after `LibraryShelfWidget()`:

```swift
    BedtimeWidget()
    ReciterSpotlightWidget()
```

- [ ] **Step 3: iOS build**

```bash
npm run prebuild
xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20
```
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 4: Android Bedtime**

`res/drawable/widget_moon.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#FFFFFFFF"
    android:pathData="M12.34,2.02C6.59,1.82 2,6.42 2,12c0,5.52 4.48,10 10,10c3.71,0 6.93,-2.02 8.66,-5.02C13.15,16.73 8.57,8.55 12.34,2.02z" />
</vector>
```

Append to `ui/ContentUi.kt` (add `import expo.modules.bayaanwidgets.BedtimeConfig`):

```kotlin
fun startBedtimeCommand(c: BedtimeConfig): JSONObject =
  JSONObject().put("type", "startBedtime").put("surahId", c.surahId)
    .put("reciterId", c.reciterId ?: JSONObject.NULL)
    .put("sleepMinutes", c.minutes)
    .put("ambient", c.ambient ?: JSONObject.NULL)
```

```kotlin
// bedtime/BedtimeWidget.kt
package expo.modules.bayaanwidgets.bedtime

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import expo.modules.bayaanwidgets.BedtimeConfig
import expo.modules.bayaanwidgets.CatalogModels
import expo.modules.bayaanwidgets.ContentConfigJson
import expo.modules.bayaanwidgets.ContentLogic
import expo.modules.bayaanwidgets.ContentModels
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.R
import expo.modules.bayaanwidgets.SnapshotModels
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.WidgetInputs
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.ui.RoundButton
import expo.modules.bayaanwidgets.ui.SurahCard
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.clockTime
import expo.modules.bayaanwidgets.ui.commandAction
import expo.modules.bayaanwidgets.ui.contentRoot
import expo.modules.bayaanwidgets.ui.recordMissingArtwork
import expo.modules.bayaanwidgets.ui.startBedtimeCommand

class BedtimeWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.SMALL, WidgetSizes.MEDIUM))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    recordMissingArtwork(context, listOf(ContentConfigJson.decodeBedtime(stored.configJson).surahId), emptyList())
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      BedtimeContent(context, ContentConfigJson.decodeBedtime(inputs.configJson), inputs)
    }
  }
}

/** The Bedtime widget body; Bayaan Now shows it with ContentConfigJson.DEFAULT_BEDTIME. */
@Composable
fun BedtimeContent(context: Context, config: BedtimeConfig, inputs: WidgetInputs) {
  val content = remember(inputs.contentJson) { inputs.contentJson?.let { ContentModels.decodeContent(it) } }
  val catalog = remember(inputs.catalogJson) { inputs.catalogJson?.let { CatalogModels.decode(it) } }
  val snapshot = remember(inputs.snapshotJson) { inputs.snapshotJson?.let { SnapshotModels.decode(it) } }
  val surah = StaticData.surah(context, config.surahId)
  val reciterName = catalog?.reciter(config.reciterId)?.name ?: snapshot?.defaultReciter?.name
  val sleepAt = content?.sleepTimerEndsAt?.takeIf { ContentLogic.sleepActive(it, System.currentTimeMillis()) }
  val detail = listOfNotNull("${config.minutes} min", config.ambient?.let { ContentConfigJson.ambientLabel(it) }).joinToString(" · ")
  val action = commandAction(context, startBedtimeCommand(config),
    "bedtime/${config.surahId}/${config.reciterId ?: "default"}/${config.minutes}/${config.ambient ?: "off"}")
  val small = LocalSize.current.width < WidgetSizes.MEDIUM.width
  val subtitle = sleepAt?.let { "Sleep at ${clockTime(context, it)}" } ?: if (small) "${surah?.name ?: ""} · $detail" else detail
  val root = contentRoot().clickable(action)
  if (small) {
    Column(root.padding(12.dp)) {
      Row(GlanceModifier.fillMaxWidth()) {
        SurahCard(context, surah, 54)
        Spacer(GlanceModifier.defaultWeight())
        Logo(12)
      }
      Spacer(GlanceModifier.defaultWeight())
      Text("Bedtime", style = TextStyle(color = WidgetColors.WHITE, fontSize = 15.sp, fontWeight = FontWeight.Bold))
      Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
        Text(subtitle, maxLines = 2, modifier = GlanceModifier.defaultWeight(),
          style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 11.sp))
        RoundButton(R.drawable.widget_moon, "Start bedtime", action)
      }
    }
    return
  }
  Row(root.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
    SurahCard(context, surah, 96)
    Spacer(GlanceModifier.width(12.dp))
    Column(GlanceModifier.defaultWeight()) {
      Row(GlanceModifier.fillMaxWidth()) {
        Text("Bedtime", modifier = GlanceModifier.defaultWeight(),
          style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp, fontWeight = FontWeight.Bold))
        Logo(14)
      }
      Text(surah?.name ?: "", maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 15.sp, fontWeight = FontWeight.Bold))
      if (reciterName != null) {
        Text(reciterName, maxLines = 1, style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 13.sp))
      }
      Spacer(GlanceModifier.height(6.dp))
      Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
        Text(subtitle, maxLines = 1, modifier = GlanceModifier.defaultWeight(),
          style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp))
        RoundButton(R.drawable.widget_moon, "Start bedtime", action)
      }
    }
  }
}
```

```kotlin
// bedtime/BedtimeReceiver.kt
package expo.modules.bayaanwidgets.bedtime

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import expo.modules.bayaanwidgets.WidgetStorage

class BedtimeReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = BedtimeWidget()

  override fun onDeleted(context: Context, appWidgetIds: IntArray) {
    super.onDeleted(context, appWidgetIds)
    WidgetStorage.deleteConfigs(context, appWidgetIds)
  }
}
```

```kotlin
// bedtime/BedtimeConfigActivity.kt
package expo.modules.bayaanwidgets.bedtime

import android.app.Activity
import android.os.Bundle
import expo.modules.bayaanwidgets.BedtimeConfig
import expo.modules.bayaanwidgets.CatalogModels
import expo.modules.bayaanwidgets.ContentConfigJson
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.WidgetCatalog
import expo.modules.bayaanwidgets.WidgetStorage
import expo.modules.bayaanwidgets.ui.ConfigPicker

/** Picks the surah, reciter, sleep minutes and ambient sound. */
class BedtimeConfigActivity : Activity() {
  private var appWidgetId = 0
  private lateinit var config: BedtimeConfig
  private var catalog: WidgetCatalog? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    appWidgetId = ConfigPicker.begin(this) ?: return
    config = ContentConfigJson.decodeBedtime(WidgetStorage.readConfigJson(this, appWidgetId))
    catalog = WidgetStorage.readCatalogJson(this)?.let { CatalogModels.decode(it) }
    showMenu()
  }

  private fun showMenu() {
    val surah = StaticData.surah(this, config.surahId)?.let { "${it.id}. ${it.name}" } ?: "${config.surahId}"
    val reciter = catalog?.reciter(config.reciterId)?.name ?: "Default reciter"
    val rows = listOf(
      "Surah: $surah", "Reciter: $reciter", "Sleep timer: ${config.minutes} min",
      "Ambient: ${ContentConfigJson.ambientLabel(config.ambient)}",
    )
    ConfigPicker.menu(this, "Bedtime", rows,
      onPick = { index ->
        when (index) {
          0 -> pickSurah()
          1 -> pickReciter()
          2 -> pickMinutes()
          else -> pickAmbient()
        }
      },
      onDone = { ConfigPicker.save(this, appWidgetId, ContentConfigJson.encode(config), BedtimeWidget()) },
      onCancel = { finish() })
  }

  private fun pickSurah() {
    val surahs = StaticData.surahs(this)
    ConfigPicker.pick(this, "Surah", surahs.map { "${it.id}. ${it.name}" },
      onPick = { i -> config = config.copy(surahId = surahs[i].id); showMenu() }, onCancel = { showMenu() })
  }

  private fun pickReciter() {
    val reciters = catalog?.reciters.orEmpty()
    ConfigPicker.pick(this, "Reciter", listOf("Default reciter") + reciters.map { it.name },
      onPick = { i -> config = config.copy(reciterId = if (i == 0) null else reciters[i - 1].id); showMenu() },
      onCancel = { showMenu() })
  }

  private fun pickMinutes() {
    val options = ContentConfigJson.BEDTIME_MINUTES
    ConfigPicker.pick(this, "Sleep timer", options.map { "$it minutes" },
      onPick = { i -> config = config.copy(minutes = options[i]); showMenu() }, onCancel = { showMenu() })
  }

  private fun pickAmbient() {
    val options = listOf<String?>(null) + ContentConfigJson.AMBIENT_SOUNDS
    ConfigPicker.pick(this, "Ambient sound", options.map { ContentConfigJson.ambientLabel(it) },
      onPick = { i -> config = config.copy(ambient = options[i]); showMenu() }, onCancel = { showMenu() })
  }
}
```

`res/xml/bedtime_info.xml`:

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/bayaan_widget_bedtime_desc"
  android:minWidth="110dp"
  android:minHeight="110dp"
  android:targetCellWidth="2"
  android:targetCellHeight="2"
  android:maxResizeWidth="400dp"
  android:maxResizeHeight="200dp"
  android:resizeMode="horizontal|vertical"
  android:updatePeriodMillis="0"
  android:widgetCategory="home_screen"
  android:configure="expo.modules.bayaanwidgets.bedtime.BedtimeConfigActivity"
  android:widgetFeatures="reconfigurable|configuration_optional"
  android:initialLayout="@layout/glance_default_loading_layout" />
```

- [ ] **Step 5: Android Reciter Spotlight**

```kotlin
// spotlight/ReciterSpotlightWidget.kt
package expo.modules.bayaanwidgets.spotlight

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import expo.modules.bayaanwidgets.ContentLogic
import expo.modules.bayaanwidgets.ContentModels
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.R
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.WidgetInputs
import expo.modules.bayaanwidgets.WidgetSpotlightReciter
import expo.modules.bayaanwidgets.ui.ContentMessage
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.ui.ReciterPhoto
import expo.modules.bayaanwidgets.ui.RoundButton
import expo.modules.bayaanwidgets.ui.SurahCard
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.commandAction
import expo.modules.bayaanwidgets.ui.contentRoot
import expo.modules.bayaanwidgets.ui.playReciterCommand
import expo.modules.bayaanwidgets.ui.playTrackCommand
import expo.modules.bayaanwidgets.ui.recordMissingArtwork
import java.util.TimeZone

class ReciterSpotlightWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.SMALL, WidgetSizes.MEDIUM))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    resolve(stored)?.let { recordMissingArtwork(context, it.surahIds, listOf(it.id to it.artworkFile)) }
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      val reciter = remember(inputs) { resolve(inputs) }
      Content(context, reciter)
    }
  }

  // ContextClockReceiver pushes at midnight, so "today" is re-read then.
  private fun resolve(inputs: WidgetInputs): WidgetSpotlightReciter? = ContentLogic.spotlight(
    inputs.contentJson?.let { ContentModels.decodeContent(it) }, System.currentTimeMillis(), TimeZone.getDefault(),
  )

  @Composable
  private fun Content(context: Context, r: WidgetSpotlightReciter?) {
    if (r == null) {
      ContentMessage(contentRoot(), "Open Bayaan", "to meet today's reciter")
      return
    }
    val play = commandAction(context, playReciterCommand(r.id), "spotlight/${r.id}")
    if (LocalSize.current.width < WidgetSizes.MEDIUM.width) {
      val size = LocalSize.current
      Box(contentRoot().clickable(play)) {
        ReciterPhoto(context, r.artworkFile, r.name, size.width.value.toInt(), size.height.value.toInt(), 20)
        Image(ImageProvider(R.drawable.widget_scrim), contentDescription = null,
          modifier = GlanceModifier.fillMaxSize(), contentScale = ContentScale.FillBounds)
        Column(GlanceModifier.fillMaxSize().padding(12.dp)) {
          Row(GlanceModifier.fillMaxWidth()) {
            Spacer(GlanceModifier.defaultWeight())
            Logo(14)
          }
          Spacer(GlanceModifier.defaultWeight())
          Text("Reciter of the Day", style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 10.sp, fontWeight = FontWeight.Bold))
          Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
            Text(r.name, maxLines = 2, modifier = GlanceModifier.defaultWeight(),
              style = TextStyle(color = WidgetColors.WHITE, fontSize = 15.sp, fontWeight = FontWeight.Bold))
            RoundButton(android.R.drawable.ic_media_play, "Play ${r.name}", play)
          }
        }
      }
      return
    }
    Row(contentRoot().padding(12.dp)) {
      Box(GlanceModifier.width(86.dp).fillMaxHeight().clickable(play), contentAlignment = Alignment.BottomStart) {
        ReciterPhoto(context, r.artworkFile, r.name, 86, 86, 14)
        Box(GlanceModifier.padding(6.dp)) { RoundButton(android.R.drawable.ic_media_play, "Play ${r.name}", play) }
      }
      Spacer(GlanceModifier.width(12.dp))
      Column(GlanceModifier.defaultWeight().fillMaxHeight()) {
        Row(GlanceModifier.fillMaxWidth()) {
          Column(GlanceModifier.defaultWeight()) {
            Text("Reciter of the Day", style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 10.sp, fontWeight = FontWeight.Bold))
            Text(r.name, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 14.sp, fontWeight = FontWeight.Bold))
          }
          Logo(14)
        }
        r.surahIds.forEach { id ->
          val surah = StaticData.surah(context, id) ?: return@forEach
          val action = commandAction(context, playTrackCommand(id, r.id, null, null), "spotlight/${r.id}/$id")
          Row(GlanceModifier.fillMaxWidth().padding(top = 6.dp).clickable(action), verticalAlignment = Alignment.CenterVertically) {
            SurahCard(context, surah, 24)
            Spacer(GlanceModifier.width(8.dp))
            Text(surah.name, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 13.sp, fontWeight = FontWeight.Medium))
          }
        }
      }
    }
  }
}
```

```kotlin
// spotlight/ReciterSpotlightReceiver.kt
package expo.modules.bayaanwidgets.spotlight

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import expo.modules.bayaanwidgets.ContextClockReceiver

class ReciterSpotlightReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = ReciterSpotlightWidget()

  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    super.onUpdate(context, appWidgetManager, appWidgetIds)
    ContextClockReceiver.schedule(context)
  }

  override fun onDisabled(context: Context) {
    super.onDisabled(context)
    ContextClockReceiver.cancelIfUnused(context)
  }
}
```

`res/xml/reciter_spotlight_info.xml`:

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/bayaan_widget_spotlight_desc"
  android:minWidth="110dp"
  android:minHeight="110dp"
  android:targetCellWidth="2"
  android:targetCellHeight="2"
  android:maxResizeWidth="400dp"
  android:maxResizeHeight="200dp"
  android:resizeMode="horizontal|vertical"
  android:updatePeriodMillis="0"
  android:widgetCategory="home_screen"
  android:initialLayout="@layout/glance_default_loading_layout" />
```

In `ContextClockReceiver.kt`, replace `val TARGETS: List<ClockTarget> = listOf()` with:

```kotlin
    val TARGETS: List<ClockTarget> = listOf(
      ClockTarget(ReciterSpotlightReceiver::class.java) { ReciterSpotlightWidget() },
    )
```

and add the imports `expo.modules.bayaanwidgets.spotlight.ReciterSpotlightReceiver` and `expo.modules.bayaanwidgets.spotlight.ReciterSpotlightWidget`.

- [ ] **Step 6: Register on Android**

`strings.xml`:

```xml
  <string name="bayaan_widget_bedtime_label">Bedtime</string>
  <string name="bayaan_widget_bedtime_desc">Fall asleep to a surah with a sleep timer.</string>
  <string name="bayaan_widget_spotlight_label">Reciter of the Day</string>
  <string name="bayaan_widget_spotlight_desc">Meet a new reciter every day.</string>
```

`AndroidManifest.xml`, inside `<application>`:

```xml
    <receiver
      android:name="expo.modules.bayaanwidgets.bedtime.BedtimeReceiver"
      android:exported="true"
      android:label="@string/bayaan_widget_bedtime_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
      </intent-filter>
      <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/bedtime_info" />
    </receiver>
    <activity
      android:name="expo.modules.bayaanwidgets.bedtime.BedtimeConfigActivity"
      android:exported="true"
      android:excludeFromRecents="true"
      android:taskAffinity=""
      android:theme="@android:style/Theme.Translucent.NoTitleBar">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_CONFIGURE" />
      </intent-filter>
    </activity>
    <receiver
      android:name="expo.modules.bayaanwidgets.spotlight.ReciterSpotlightReceiver"
      android:exported="true"
      android:label="@string/bayaan_widget_spotlight_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
      </intent-filter>
      <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/reciter_spotlight_info" />
    </receiver>
```

`BayaanWidgetsModule.kt` imports and reload cases:

```kotlin
import expo.modules.bayaanwidgets.bedtime.BedtimeWidget
import expo.modules.bayaanwidgets.spotlight.ReciterSpotlightWidget
```

```kotlin
          "Bedtime" -> push(BedtimeWidget())
          "ReciterSpotlight" -> push(ReciterSpotlightWidget())
```

- [ ] **Step 7: Build Android and commit**

```bash
cd android && ./gradlew :bayaan-widgets:testReleaseUnitTest && ./gradlew :app:assembleRelease && cd ..
git add targets/widgets/Bedtime/BedtimeWidget.swift targets/widgets/Spotlight/ReciterSpotlightWidget.swift targets/widgets/ContentWidgets.swift modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/bedtime modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/spotlight modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/ui/ContentUi.kt modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/ContextClockReceiver.kt modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/BayaanWidgetsModule.kt modules/bayaan-widgets/android/src/main/AndroidManifest.xml modules/bayaan-widgets/android/src/main/res/values/strings.xml modules/bayaan-widgets/android/src/main/res/xml/bedtime_info.xml modules/bayaan-widgets/android/src/main/res/xml/reciter_spotlight_info.xml modules/bayaan-widgets/android/src/main/res/drawable/widget_moon.xml
git commit -m "feat(widgets): add the Bedtime and Reciter of the Day widgets"
```

---
### Task 9: Adhkar, Hijri Date and Occasion (iOS and Android)

**Files:**
- Create (iOS): `targets/widgets/Adhkar/AdhkarWidget.swift`, `targets/widgets/Hijri/HijriDateWidget.swift`, `targets/widgets/Hijri/OccasionWidget.swift`
- Modify (iOS): `targets/widgets/ContentWidgets.swift`
- Create (Android): `java/expo/modules/bayaanwidgets/adhkar/AdhkarWidget.kt`, `adhkar/AdhkarReceiver.kt`, `hijri/HijriDateWidget.kt`, `hijri/HijriDateReceiver.kt`, `hijri/OccasionWidget.kt`, `hijri/OccasionReceiver.kt`, `res/xml/adhkar_info.xml`, `res/xml/hijri_date_info.xml`, `res/xml/occasion_info.xml`
- Modify (Android): `ContextClockReceiver.kt`, `BayaanWidgetsModule.kt`, `AndroidManifest.xml`, `res/values/strings.xml`

**Interfaces:**
- Consumes: Task 4 (`ContentStaticData`, `ContentLogic.hour/adhkarPeriod/occasion(at:)/hijri/nextOccasions/boundaries/adhkarRelevance/occasionRelevance`, `ContentText`, `DhikrText`, `ContentMessage`, `TimelineEntryRelevance.scored`); Task 5 (`ContentStaticData`, `ContentLogic`, `IcuHijri`, `ClockTarget`, `contentRoot`, `ContentMessage`); 1b (`WidgetLogic.ayahIndex/dayNumber/reference`, `WidgetFonts`, `RoundIntentButton`, `PlayTrackIntent`, `ArabicText`, `ArabicBitmap`, `DayMath`, `commandAction`, `playTrackCommand`, `deepLink`, `RoundButton`, `Logo`).
- Produces: kinds `Adhkar`, `HijriDate`, `Occasion`; iOS `AdhkarEntry.make(at:next:)` + `AdhkarView`, `HijriDateEntry.make(at:next:)` + `HijriDateView`, `OccasionEntry.make(at:next:)` + `OccasionView`; `ContentTimeline.dates(from:)`; Android `@Composable AdhkarContent(context, nowMs)`, `HijriSmallContent(context, nowMs)`, `OccasionContent(context, nowMs)` (all used by Bayaan Now).

- [ ] **Step 1: iOS Adhkar**

```swift
// targets/widgets/Adhkar/AdhkarWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

/// Entry dates for date-driven widgets: now, then every context boundary in the next 24 hours.
enum ContentTimeline {
  static func dates(from now: Date) -> [Date] { [now] + ContentLogic.boundaries(after: now) }

  static func entries<E>(from now: Date, make: (Date, Date?) -> E) -> [E] {
    let dates = dates(from: now)
    return dates.enumerated().map { i, d in make(d, i + 1 < dates.count ? dates[i + 1] : nil) }
  }
}

struct AdhkarEntry: TimelineEntry {
  let date: Date
  let data: AdhkarPeriodData?
  let featured: FeaturedDhikr?
  let relevance: TimelineEntryRelevance?

  static func make(at date: Date, next: Date?) -> AdhkarEntry {
    let hour = ContentLogic.hour(date)
    let data = ContentStaticData.adhkar?.data(for: ContentLogic.adhkarPeriod(hour: hour))
    let featured = data.flatMap { d -> FeaturedDhikr? in
      let i = WidgetLogic.ayahIndex(date, count: d.featured.count)
      return i >= 0 ? d.featured[i] : nil
    }
    return AdhkarEntry(date: date, data: data, featured: featured,
                       relevance: .scored(ContentLogic.adhkarRelevance(hour: hour), from: date, until: next))
  }
}

struct AdhkarProvider: TimelineProvider {
  func placeholder(in context: Context) -> AdhkarEntry { AdhkarEntry.make(at: .now, next: nil) }

  func getSnapshot(in context: Context, completion: @escaping (AdhkarEntry) -> Void) {
    completion(AdhkarEntry.make(at: .now, next: nil))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<AdhkarEntry>) -> Void) {
    completion(Timeline(entries: ContentTimeline.entries(from: .now, make: AdhkarEntry.make), policy: .atEnd))
  }
}

struct AdhkarWidget: Widget {
  let kind = "Adhkar"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: AdhkarProvider()) { entry in
      AdhkarView(entry: entry)
    }
    .configurationDisplayName("Morning & Evening Adhkar")
    .description("The adhkar for this time of day.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

struct AdhkarView: View {
  @Environment(\.widgetFamily) private var family
  let entry: AdhkarEntry

  var body: some View {
    Group {
      if let data = entry.data, let dhikr = entry.featured {
        if family == .systemSmall { small(data, dhikr) } else { medium(data, dhikr) }
      } else {
        ContentMessage(title: "Open Bayaan")
      }
    }
    .foregroundStyle(.white)
    .containerBackground(for: .widget) { WidgetPalette.background }
    .widgetURL(entry.data.flatMap { URL(string: "bayaan://adhkar/\($0.superId)") })
  }

  private func small(_ data: AdhkarPeriodData, _ dhikr: FeaturedDhikr) -> some View {
    VStack(spacing: 6) {
      HStack {
        Text(data.arabicTitle).font(WidgetFonts.dhikr(15)).opacity(0.75).lineLimit(1)
        Spacer(minLength: 0)
        BayaanLogo(size: 12)
      }
      Spacer(minLength: 0)
      DhikrText(text: dhikr.arabic, size: 22, lines: 3).frame(maxWidth: .infinity)
      Spacer(minLength: 0)
    }
    .padding(12)
  }

  private func medium(_ data: AdhkarPeriodData, _ dhikr: FeaturedDhikr) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(data.title).font(.subheadline.weight(.bold)).lineLimit(1)
        Text(data.arabicTitle).font(WidgetFonts.dhikr(14)).opacity(0.6).lineLimit(1)
        Spacer(minLength: 0)
        BayaanLogo(size: 14)
      }
      Spacer(minLength: 0)
      DhikrText(text: dhikr.arabic, size: 22, lines: 2).frame(maxWidth: .infinity)
      if let translation = dhikr.translation {
        Text(translation).font(.caption).opacity(0.75).lineLimit(1)
      }
      Spacer(minLength: 0)
      HStack {
        if let r = ContentText.repeatLabel(dhikr.repeatCount) {
          Text(r).font(.caption2.weight(.bold)).opacity(0.6)
        }
        Spacer(minLength: 0)
        Text("\(data.count) adhkar").font(.caption2.weight(.semibold)).opacity(0.6)
      }
    }
    .padding(14)
  }
}

#Preview("Small", as: .systemSmall) {
  AdhkarWidget()
} timeline: {
  AdhkarEntry.make(at: .now, next: nil)
}

#Preview("Medium", as: .systemMedium) {
  AdhkarWidget()
} timeline: {
  AdhkarEntry.make(at: .now, next: nil)
  AdhkarEntry(date: .now, data: nil, featured: nil, relevance: nil)
}
```

- [ ] **Step 2: iOS Hijri Date**

```swift
// targets/widgets/Hijri/HijriDateWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

struct HijriDateEntry: TimelineEntry {
  let date: Date
  let hijri: HijriDate?
  let occasion: OccasionInfo?
  let upcoming: UpcomingOccasion?
  let relevance: TimelineEntryRelevance?

  static func make(at date: Date, next: Date?) -> HijriDateEntry {
    let id = ContentLogic.occasion(at: date)
    let upcoming = ContentLogic.nextOccasions(today: WidgetLogic.dayNumber(date), count: 1,
                                              hijriOf: ContentLogic.hijri(dayNumber:)).first
    return HijriDateEntry(date: date, hijri: ContentLogic.hijri(date),
                          occasion: ContentStaticData.occasions?.occasion(id), upcoming: upcoming,
                          relevance: .scored(ContentLogic.occasionRelevance(id), from: date, until: next))
  }
}

struct HijriDateProvider: TimelineProvider {
  func placeholder(in context: Context) -> HijriDateEntry { HijriDateEntry.make(at: .now, next: nil) }

  func getSnapshot(in context: Context, completion: @escaping (HijriDateEntry) -> Void) {
    completion(HijriDateEntry.make(at: .now, next: nil))
  }

  // Boundaries include midnight (new date) and 18:00 (end of Jumu'ah).
  func getTimeline(in context: Context, completion: @escaping (Timeline<HijriDateEntry>) -> Void) {
    completion(Timeline(entries: ContentTimeline.entries(from: .now, make: HijriDateEntry.make), policy: .atEnd))
  }
}

struct HijriDateWidget: Widget {
  let kind = "HijriDate"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: HijriDateProvider()) { entry in
      HijriDateView(entry: entry)
    }
    .configurationDisplayName("Hijri Date")
    .description("Today's date in the Umm al-Qura calendar.")
    .supportedFamilies([.systemSmall, .accessoryInline, .accessoryRectangular])
    .contentMarginsDisabled()
  }
}

struct HijriDateView: View {
  @Environment(\.widgetFamily) private var family
  let entry: HijriDateEntry

  private var months: [HijriMonthName] { ContentStaticData.occasions?.months ?? [] }
  private var line: String { entry.hijri.map { ContentText.hijriLine($0, months: months) } ?? "Bayaan" }

  var body: some View {
    switch family {
    case .accessoryInline:
      Text(line).containerBackground(for: .widget) { Color.clear }
    case .accessoryRectangular:
      VStack(alignment: .leading, spacing: 1) {
        Text(line).font(.headline).lineLimit(1).minimumScaleFactor(0.8)
        if let o = entry.occasion {
          Text(o.name).font(.caption).lineLimit(1)
        } else if let u = entry.upcoming, let name = ContentStaticData.occasions?.occasion(u.id)?.name {
          Text("\(name) \(ContentText.daysLabel(u.days))").font(.caption).lineLimit(1)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .containerBackground(for: .widget) { Color.clear }
    default:
      small
    }
  }

  private var small: some View {
    let month = entry.hijri.flatMap { h in months.first { $0.number == h.month } }
    return VStack(alignment: .leading, spacing: 2) {
      HStack(alignment: .top) {
        Text(month?.arabic ?? "").font(WidgetFonts.dhikr(16)).opacity(0.75).lineLimit(1)
        Spacer(minLength: 0)
        BayaanLogo(size: 12)
      }
      Spacer(minLength: 0)
      if let h = entry.hijri {
        Text(String(h.day)).font(.system(size: 44, weight: .bold, design: .rounded))
        Text("\(month?.name ?? "") \(String(h.year)) AH")
          .font(.caption.weight(.semibold)).opacity(0.75).lineLimit(1).minimumScaleFactor(0.8)
      } else {
        Text("Open Bayaan").font(.caption.weight(.semibold))
      }
      if let o = entry.occasion {
        Text(o.name).font(.caption2.weight(.bold)).lineLimit(1).padding(.top, 2)
      }
    }
    .padding(12)
    .foregroundStyle(.white)
    .containerBackground(for: .widget) { WidgetPalette.background }
  }
}

#Preview("Small", as: .systemSmall) {
  HijriDateWidget()
} timeline: {
  HijriDateEntry.make(at: .now, next: nil)
}

#Preview("Inline", as: .accessoryInline) {
  HijriDateWidget()
} timeline: {
  HijriDateEntry.make(at: .now, next: nil)
}

#Preview("Rectangular", as: .accessoryRectangular) {
  HijriDateWidget()
} timeline: {
  HijriDateEntry.make(at: .now, next: nil)
}
```

- [ ] **Step 3: iOS Occasion**

```swift
// targets/widgets/Hijri/OccasionWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

struct OccasionEntry: TimelineEntry {
  let date: Date
  let hijri: HijriDate?
  let occasion: OccasionInfo?
  let ayah: StaticAyah?
  let upcoming: [UpcomingOccasion]
  let relevance: TimelineEntryRelevance?

  static func make(at date: Date, next: Date?) -> OccasionEntry {
    let id = ContentLogic.occasion(at: date)
    let occasion = ContentStaticData.occasions?.occasion(id)
    let ayah = occasion.flatMap { o -> StaticAyah? in
      let i = WidgetLogic.ayahIndex(date, count: o.ayat.count)
      return i >= 0 ? o.ayat[i] : nil
    }
    let upcoming = ContentLogic.nextOccasions(today: WidgetLogic.dayNumber(date), count: 3,
                                              hijriOf: ContentLogic.hijri(dayNumber:))
    return OccasionEntry(date: date, hijri: ContentLogic.hijri(date), occasion: occasion, ayah: ayah,
                         upcoming: upcoming,
                         relevance: .scored(ContentLogic.occasionRelevance(id), from: date, until: next))
  }
}

struct OccasionProvider: TimelineProvider {
  func placeholder(in context: Context) -> OccasionEntry { OccasionEntry.make(at: .now, next: nil) }

  func getSnapshot(in context: Context, completion: @escaping (OccasionEntry) -> Void) {
    completion(OccasionEntry.make(at: .now, next: nil))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<OccasionEntry>) -> Void) {
    completion(Timeline(entries: ContentTimeline.entries(from: .now, make: OccasionEntry.make), policy: .atEnd))
  }
}

struct OccasionWidget: Widget {
  let kind = "Occasion"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: OccasionProvider()) { entry in
      OccasionView(entry: entry)
    }
    .configurationDisplayName("Occasions")
    .description("Ayat for Ramadan, Dhul Hijjah, Jumu'ah and more.")
    .supportedFamilies([.systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}

struct OccasionView: View {
  @Environment(\.widgetFamily) private var family
  let entry: OccasionEntry

  private var data: OccasionData? { ContentStaticData.occasions }
  private var isLarge: Bool { family == .systemLarge }
  private var hijriText: String { entry.hijri.map { ContentText.hijriLine($0, months: data?.months ?? []) } ?? "" }

  var body: some View {
    Group {
      if let o = entry.occasion, let ayah = entry.ayah {
        occasionBody(o, ayah)
      } else if entry.hijri != nil {
        upcomingBody
      } else {
        ContentMessage(title: "Open Bayaan")
      }
    }
    .foregroundStyle(.white)
    .containerBackground(for: .widget) { WidgetPalette.background }
    .widgetURL(entry.occasion == nil ? nil : entry.ayah.flatMap { URL(string: "bayaan://quran/\($0.surahId)?ayah=\($0.ayah)") })
  }

  // Jumu'ah plays Surah Al-Kahf from the start; other occasions play from the ayah onward.
  private func listen(_ o: OccasionInfo, _ a: StaticAyah) -> PlayTrackIntent {
    if let surah = o.listenSurahId { return PlayTrackIntent(surahId: surah, reciterId: nil, rewayatId: nil) }
    return PlayTrackIntent(surahId: a.surahId, reciterId: nil, rewayatId: nil, ayah: a.ayah)
  }

  private func occasionBody(_ o: OccasionInfo, _ a: StaticAyah) -> some View {
    VStack(alignment: .leading, spacing: isLarge ? 12 : 6) {
      HStack(spacing: 8) {
        RoundIntentButton(intent: listen(o, a), systemName: "play.fill", label: o.listenSurahId == nil ? "Listen" : "Listen to Al-Kahf")
        VStack(alignment: .leading, spacing: 1) {
          Text(o.name).font(.subheadline.weight(.bold)).lineLimit(1)
          Text(hijriText).font(.caption2).opacity(0.6).lineLimit(1)
        }
        Spacer(minLength: 0)
        BayaanLogo(size: 14)
      }
      if isLarge { Spacer(minLength: 0) }
      // Centered and ragged, never justified (Digital Khatt spike caveat).
      Text(a.arabic)
        .font(WidgetFonts.quran(isLarge ? 32 : 24))
        .multilineTextAlignment(.center)
        .lineLimit(isLarge ? 6 : 2)
        .minimumScaleFactor(0.4)
        .frame(maxWidth: .infinity)
        .environment(\.layoutDirection, .rightToLeft)
      Text(a.translation).font(isLarge ? .subheadline : .caption).opacity(0.8)
        .lineLimit(isLarge ? 4 : 2).minimumScaleFactor(0.85)
      if isLarge {
        Text(WidgetLogic.reference(surahName: a.surahName, key: a.key)).font(.caption2.weight(.semibold)).opacity(0.6)
        Spacer(minLength: 0)
      }
    }
    .padding(isLarge ? 16 : 14)
  }

  private var upcomingBody: some View {
    let month = entry.hijri.flatMap { h in data?.month(h.month) }
    return VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 1) {
          Text(hijriText).font(.headline).lineLimit(1)
          Text(month?.arabic ?? "").font(WidgetFonts.dhikr(14)).opacity(0.6)
        }
        Spacer(minLength: 0)
        BayaanLogo(size: 14)
      }
      Text("Coming up").font(.caption.weight(.semibold)).opacity(0.6)
      ForEach(Array(entry.upcoming.prefix(isLarge ? 3 : 2)), id: \.self) { u in
        HStack {
          Text(data?.occasion(u.id)?.name ?? u.id).font(.subheadline.weight(.semibold)).lineLimit(1)
          Spacer(minLength: 0)
          Text(ContentText.daysLabel(u.days)).font(.caption).opacity(0.75)
        }
      }
      Spacer(minLength: 0)
    }
    .padding(14)
  }
}

#Preview("Medium", as: .systemMedium) {
  OccasionWidget()
} timeline: {
  OccasionEntry.make(at: .now, next: nil)
  OccasionEntry(date: .now, hijri: HijriDate(year: 1447, month: 9, day: 27),
                occasion: ContentStaticData.occasions?.occasion("lastTen"),
                ayah: ContentStaticData.occasions?.occasion("lastTen")?.ayat.first, upcoming: [], relevance: nil)
}

#Preview("Large", as: .systemLarge) {
  OccasionWidget()
} timeline: {
  OccasionEntry(date: .now, hijri: HijriDate(year: 1448, month: 4, day: 30),
                occasion: ContentStaticData.occasions?.occasion("jumuah"),
                ayah: ContentStaticData.occasions?.occasion("jumuah")?.ayat.first, upcoming: [], relevance: nil)
  OccasionEntry.make(at: .now, next: nil)
}
```

In `targets/widgets/ContentWidgets.swift`, add after `ReciterSpotlightWidget()`:

```swift
    AdhkarWidget()
    HijriDateWidget()
    OccasionWidget()
```

- [ ] **Step 4: iOS build**

```bash
npm run prebuild
xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20
```
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 5: Android Adhkar**

```kotlin
// adhkar/AdhkarWidget.kt
package expo.modules.bayaanwidgets.adhkar

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import expo.modules.bayaanwidgets.ArabicBitmap
import expo.modules.bayaanwidgets.ContentLogic
import expo.modules.bayaanwidgets.ContentStaticData
import expo.modules.bayaanwidgets.DayMath
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.ui.ArabicText
import expo.modules.bayaanwidgets.ui.ContentMessage
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.contentRoot
import expo.modules.bayaanwidgets.ui.deepLink
import java.util.TimeZone

class AdhkarWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.SMALL, WidgetSizes.MEDIUM))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    provideContent {
      // Read state so a ContextClockReceiver push recomposes; the content depends only on the time.
      GlanceState.current(currentState(), stored)
      AdhkarContent(context, System.currentTimeMillis())
    }
  }
}

/** The Adhkar widget body; also Bayaan Now's adhkar modes. */
@Composable
fun AdhkarContent(context: Context, nowMs: Long) {
  val tz = TimeZone.getDefault()
  val data = ContentStaticData.adhkar(context)?.of(ContentLogic.adhkarPeriod(ContentLogic.hour(nowMs, tz)))
  val dhikr = data?.featured?.getOrNull(DayMath.ayahIndex(nowMs, tz, data.featured.size))
  if (data == null || dhikr == null) {
    ContentMessage(contentRoot(), "Open Bayaan", null)
    return
  }
  val size = LocalSize.current
  val width = size.width.value
  val root = contentRoot().clickable(deepLink(context, "bayaan://adhkar/${data.superId}"))
  if (size.width < WidgetSizes.MEDIUM.width) {
    Column(root.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
      Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        ArabicText(context, data.arabicTitle, ArabicBitmap.DHIKR_FONT, width - 24 - 22, 22f, 15f, 10f, 1, center = true)
        Logo(12)
      }
      Spacer(GlanceModifier.defaultWeight())
      ArabicText(context, dhikr.arabic, ArabicBitmap.DHIKR_FONT, width - 24, size.height.value - 24 - 34, 22f, 11f, 3, center = true)
      Spacer(GlanceModifier.defaultWeight())
    }
    return
  }
  Column(root.padding(14.dp)) {
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      Text(data.title, maxLines = 1, modifier = GlanceModifier.defaultWeight(),
        style = TextStyle(color = WidgetColors.WHITE, fontSize = 14.sp, fontWeight = FontWeight.Bold))
      Logo(14)
    }
    Spacer(GlanceModifier.defaultWeight())
    ArabicText(context, dhikr.arabic, ArabicBitmap.DHIKR_FONT, width - 28, 50f, 22f, 11f, 2, center = true)
    if (dhikr.translation != null) {
      Text(dhikr.translation, maxLines = 1, style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp))
    }
    Spacer(GlanceModifier.defaultWeight())
    Row(GlanceModifier.fillMaxWidth()) {
      Text(ContentLogic.repeatLabel(dhikr.repeatCount) ?: "", style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp, fontWeight = FontWeight.Bold))
      Spacer(GlanceModifier.defaultWeight())
      Text("${data.count} adhkar", style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp, fontWeight = FontWeight.Bold))
    }
  }
}
```

```kotlin
// adhkar/AdhkarReceiver.kt
package expo.modules.bayaanwidgets.adhkar

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import expo.modules.bayaanwidgets.ContextClockReceiver

class AdhkarReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = AdhkarWidget()

  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    super.onUpdate(context, appWidgetManager, appWidgetIds)
    ContextClockReceiver.schedule(context)
  }

  override fun onDisabled(context: Context) {
    super.onDisabled(context)
    ContextClockReceiver.cancelIfUnused(context)
  }
}
```

- [ ] **Step 6: Android Hijri Date and Occasion**

```kotlin
// hijri/HijriDateWidget.kt
package expo.modules.bayaanwidgets.hijri

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import expo.modules.bayaanwidgets.ArabicBitmap
import expo.modules.bayaanwidgets.ContentLogic
import expo.modules.bayaanwidgets.ContentStaticData
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.IcuHijri
import expo.modules.bayaanwidgets.ui.ArabicText
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.contentRoot
import java.util.TimeZone

class HijriDateWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.SMALL))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    provideContent {
      GlanceState.current(currentState(), stored)
      HijriSmallContent(context, System.currentTimeMillis())
    }
  }
}

/** The small Hijri date; also Bayaan Now's small occasion mode. Tapping opens the app (launcher default). */
@Composable
fun HijriSmallContent(context: Context, nowMs: Long) {
  val tz = TimeZone.getDefault()
  val data = ContentStaticData.occasions(context)
  val hijri = ContentLogic.hijri(nowMs, tz, IcuHijri)
  val month = hijri?.let { data?.month(it.month) }
  val occasion = data?.occasion(ContentLogic.occasionAt(nowMs, tz, IcuHijri))
  Column(contentRoot().padding(12.dp)) {
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      if (month != null) ArabicText(context, month.arabic, ArabicBitmap.DHIKR_FONT, 72f, 22f, 15f, 10f, 1, center = false)
      Spacer(GlanceModifier.defaultWeight())
      Logo(12)
    }
    Spacer(GlanceModifier.defaultWeight())
    if (hijri == null) {
      Text("Open Bayaan", style = TextStyle(color = WidgetColors.WHITE, fontSize = 12.sp, fontWeight = FontWeight.Bold))
    } else {
      Text(hijri.day.toString(), style = TextStyle(color = WidgetColors.WHITE, fontSize = 40.sp, fontWeight = FontWeight.Bold))
      Text("${month?.name ?: ""} ${hijri.year} AH", maxLines = 1, style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp))
    }
    if (occasion != null) {
      Text(occasion.name, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 11.sp, fontWeight = FontWeight.Bold))
    }
  }
}
```

```kotlin
// hijri/OccasionWidget.kt
package expo.modules.bayaanwidgets.hijri

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import expo.modules.bayaanwidgets.ArabicBitmap
import expo.modules.bayaanwidgets.ContentLogic
import expo.modules.bayaanwidgets.ContentStaticData
import expo.modules.bayaanwidgets.DayMath
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.IcuHijri
import expo.modules.bayaanwidgets.ui.ArabicText
import expo.modules.bayaanwidgets.ui.ContentMessage
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.ui.RoundButton
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.commandAction
import expo.modules.bayaanwidgets.ui.contentRoot
import expo.modules.bayaanwidgets.ui.deepLink
import expo.modules.bayaanwidgets.ui.playTrackCommand
import java.util.TimeZone

class OccasionWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.MEDIUM, WidgetSizes.LARGE))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    provideContent {
      GlanceState.current(currentState(), stored)
      OccasionContent(context, System.currentTimeMillis())
    }
  }
}

/** The Occasion widget body; also Bayaan Now's medium occasion mode. */
@Composable
fun OccasionContent(context: Context, nowMs: Long) {
  val tz = TimeZone.getDefault()
  val data = ContentStaticData.occasions(context)
  val hijri = ContentLogic.hijri(nowMs, tz, IcuHijri)
  if (data == null || hijri == null) {
    ContentMessage(contentRoot(), "Open Bayaan", null)
    return
  }
  val size = LocalSize.current
  val large = size.height >= WidgetSizes.LARGE.height
  val hijriText = ContentLogic.hijriLine(hijri, data.months)
  val occasion = data.occasion(ContentLogic.occasionAt(nowMs, tz, IcuHijri))
  val ayah = occasion?.ayat?.getOrNull(DayMath.ayahIndex(nowMs, tz, occasion.ayat.size))
  if (occasion != null && ayah != null) {
    // Jumu'ah plays Surah Al-Kahf from the start; other occasions play from the ayah onward.
    val command = occasion.listenSurahId?.let { playTrackCommand(it, null, null, null) }
      ?: playTrackCommand(ayah.surahId, null, null, ayah.ayah)
    val listen = commandAction(context, command, "occasion/${occasion.id}/${ayah.key}")
    val open = deepLink(context, "bayaan://quran/${ayah.surahId}?ayah=${ayah.ayah}")
    val pad = if (large) 16 else 14
    Column(contentRoot().padding(pad.dp).clickable(open)) {
      Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        RoundButton(android.R.drawable.ic_media_play, "Listen", listen)
        Spacer(GlanceModifier.width(8.dp))
        Column(GlanceModifier.defaultWeight()) {
          Text(occasion.name, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 14.sp, fontWeight = FontWeight.Bold))
          Text(hijriText, maxLines = 1, style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp))
        }
        Logo(14)
      }
      if (large) Spacer(GlanceModifier.defaultWeight()) else Spacer(GlanceModifier.height(6.dp))
      ArabicText(context, ayah.arabic, ArabicBitmap.QURAN_FONT, size.width.value - pad * 2,
        if (large) 130f else 44f, if (large) 32f else 24f, 12f, if (large) 6 else 2, center = true)
      Spacer(GlanceModifier.height(4.dp))
      Text(ayah.translation, maxLines = if (large) 4 else 2,
        style = TextStyle(color = WidgetColors.SECONDARY, fontSize = if (large) 14.sp else 12.sp))
      if (large) Spacer(GlanceModifier.defaultWeight())
    }
    return
  }
  val upcoming = ContentLogic.nextOccasions(DayMath.dayNumber(nowMs, tz), if (large) 3 else 2, IcuHijri)
  Column(contentRoot().padding(14.dp)) {
    Row(GlanceModifier.fillMaxWidth()) {
      Text(hijriText, maxLines = 1, modifier = GlanceModifier.defaultWeight(),
        style = TextStyle(color = WidgetColors.WHITE, fontSize = 15.sp, fontWeight = FontWeight.Bold))
      Logo(14)
    }
    Spacer(GlanceModifier.height(8.dp))
    Text("Coming up", style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp, fontWeight = FontWeight.Bold))
    upcoming.forEach { u ->
      Row(GlanceModifier.fillMaxWidth().padding(top = 6.dp)) {
        Text(data.occasion(u.id)?.name ?: u.id, maxLines = 1, modifier = GlanceModifier.defaultWeight(),
          style = TextStyle(color = WidgetColors.WHITE, fontSize = 13.sp, fontWeight = FontWeight.Medium))
        Text(ContentLogic.daysLabel(u.days), style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp))
      }
    }
  }
}
```

```kotlin
// hijri/HijriDateReceiver.kt
package expo.modules.bayaanwidgets.hijri

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import expo.modules.bayaanwidgets.ContextClockReceiver

class HijriDateReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = HijriDateWidget()

  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    super.onUpdate(context, appWidgetManager, appWidgetIds)
    ContextClockReceiver.schedule(context)
  }

  override fun onDisabled(context: Context) {
    super.onDisabled(context)
    ContextClockReceiver.cancelIfUnused(context)
  }
}
```

```kotlin
// hijri/OccasionReceiver.kt
package expo.modules.bayaanwidgets.hijri

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import expo.modules.bayaanwidgets.ContextClockReceiver

class OccasionReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = OccasionWidget()

  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    super.onUpdate(context, appWidgetManager, appWidgetIds)
    ContextClockReceiver.schedule(context)
  }

  override fun onDisabled(context: Context) {
    super.onDisabled(context)
    ContextClockReceiver.cancelIfUnused(context)
  }
}
```

- [ ] **Step 7: Register on Android**

Widget info files:

`res/xml/adhkar_info.xml`:

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/bayaan_widget_adhkar_desc"
  android:minWidth="110dp"
  android:minHeight="110dp"
  android:targetCellWidth="2"
  android:targetCellHeight="2"
  android:maxResizeWidth="400dp"
  android:maxResizeHeight="200dp"
  android:resizeMode="horizontal|vertical"
  android:updatePeriodMillis="0"
  android:widgetCategory="home_screen"
  android:initialLayout="@layout/glance_default_loading_layout" />
```

`res/xml/hijri_date_info.xml`:

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/bayaan_widget_hijri_desc"
  android:minWidth="110dp"
  android:minHeight="110dp"
  android:targetCellWidth="2"
  android:targetCellHeight="2"
  android:maxResizeWidth="200dp"
  android:maxResizeHeight="200dp"
  android:resizeMode="horizontal|vertical"
  android:updatePeriodMillis="0"
  android:widgetCategory="home_screen"
  android:initialLayout="@layout/glance_default_loading_layout" />
```

`res/xml/occasion_info.xml`:

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/bayaan_widget_occasion_desc"
  android:minWidth="250dp"
  android:minHeight="110dp"
  android:targetCellWidth="4"
  android:targetCellHeight="2"
  android:maxResizeWidth="400dp"
  android:maxResizeHeight="400dp"
  android:resizeMode="horizontal|vertical"
  android:updatePeriodMillis="0"
  android:widgetCategory="home_screen"
  android:initialLayout="@layout/glance_default_loading_layout" />
```

`strings.xml`:

```xml
  <string name="bayaan_widget_adhkar_label">Morning &amp; Evening Adhkar</string>
  <string name="bayaan_widget_adhkar_desc">The adhkar for this time of day.</string>
  <string name="bayaan_widget_hijri_label">Hijri Date</string>
  <string name="bayaan_widget_hijri_desc">Today\'s date in the Umm al-Qura calendar.</string>
  <string name="bayaan_widget_occasion_label">Occasions</string>
  <string name="bayaan_widget_occasion_desc">Ayat for Ramadan, Dhul Hijjah, Jumu\'ah and more.</string>
```

`AndroidManifest.xml`, inside `<application>`:

```xml
    <receiver
      android:name="expo.modules.bayaanwidgets.adhkar.AdhkarReceiver"
      android:exported="true"
      android:label="@string/bayaan_widget_adhkar_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
      </intent-filter>
      <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/adhkar_info" />
    </receiver>
    <receiver
      android:name="expo.modules.bayaanwidgets.hijri.HijriDateReceiver"
      android:exported="true"
      android:label="@string/bayaan_widget_hijri_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
      </intent-filter>
      <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/hijri_date_info" />
    </receiver>
    <receiver
      android:name="expo.modules.bayaanwidgets.hijri.OccasionReceiver"
      android:exported="true"
      android:label="@string/bayaan_widget_occasion_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
      </intent-filter>
      <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/occasion_info" />
    </receiver>
```

`ContextClockReceiver.kt`: add three entries to `TARGETS` (and their imports from `expo.modules.bayaanwidgets.adhkar` and `expo.modules.bayaanwidgets.hijri`):

```kotlin
      ClockTarget(AdhkarReceiver::class.java) { AdhkarWidget() },
      ClockTarget(HijriDateReceiver::class.java) { HijriDateWidget() },
      ClockTarget(OccasionReceiver::class.java) { OccasionWidget() },
```

`BayaanWidgetsModule.kt` imports and reload cases (the app never reloads these for data, but a theme or catalog-wide reload must reach them):

```kotlin
import expo.modules.bayaanwidgets.adhkar.AdhkarWidget
import expo.modules.bayaanwidgets.hijri.HijriDateWidget
import expo.modules.bayaanwidgets.hijri.OccasionWidget
```

```kotlin
          "Adhkar" -> push(AdhkarWidget())
          "HijriDate" -> push(HijriDateWidget())
          "Occasion" -> push(OccasionWidget())
```

- [ ] **Step 8: Build Android and commit**

```bash
cd android && ./gradlew :bayaan-widgets:testReleaseUnitTest && ./gradlew :app:assembleRelease && cd ..
git add targets/widgets/Adhkar/AdhkarWidget.swift targets/widgets/Hijri/HijriDateWidget.swift targets/widgets/Hijri/OccasionWidget.swift targets/widgets/ContentWidgets.swift modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/adhkar modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/hijri modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/ContextClockReceiver.kt modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/BayaanWidgetsModule.kt modules/bayaan-widgets/android/src/main/AndroidManifest.xml modules/bayaan-widgets/android/src/main/res/values/strings.xml modules/bayaan-widgets/android/src/main/res/xml/adhkar_info.xml modules/bayaan-widgets/android/src/main/res/xml/hijri_date_info.xml modules/bayaan-widgets/android/src/main/res/xml/occasion_info.xml
git commit -m "feat(widgets): add the Adhkar, Hijri Date and Occasion widgets"
```

---
### Task 10: Bayaan Now (iOS and Android)

**Files:**
- Create (iOS): `targets/widgets/BayaanNow/BayaanNowWidget.swift`
- Modify (iOS): `targets/widgets/ContentWidgets.swift`
- Create (Android): `java/expo/modules/bayaanwidgets/bayaannow/BayaanNowWidget.kt`, `bayaannow/BayaanNowReceiver.kt`, `res/xml/bayaan_now_info.xml`
- Modify (Android): `ContentLogic.kt` (`playingAt`), `test/.../ContentLogicTest.kt`, `ContextClockReceiver.kt`, `BayaanWidgetsModule.kt`, `AndroidManifest.xml`, `res/values/strings.xml`

**Interfaces:**
- Consumes: iOS `ContinueListeningView`, `ContinueListeningEntry`, `EffectivePlayback`, `PlaybackOverrideStore` (1a, read-only); `AdhkarView`/`AdhkarEntry.make`, `HijriDateView`/`HijriDateEntry.make`, `OccasionView`/`OccasionEntry.make`, `ContentTimeline` (Task 9); `BedtimeView`/`BedtimeEntry.make`/`BedtimeSettings.default(reciterName:)` (Task 8); `ContentLogic.mode/relevance/occasion(at:)/hour` (Task 4). Android `AdhkarContent`, `HijriSmallContent`, `OccasionContent` (Task 9), `BedtimeContent` (Task 8), `ContentConfigJson.DEFAULT_BEDTIME`, `ContentLogic.mode/occasionAt`, `IcuHijri` (Task 5).
- Produces: kind `BayaanNow`; Kotlin `ContentLogic.playingAt(snapshot: WidgetSnapshot?, nowMs: Long): Boolean`; `@Composable NowPlayingCard(context, snapshot, nowMs)`.

- [ ] **Step 1: Write the failing Kotlin test for `playingAt`**

Add to `ContentLogicTest.kt`:

```kotlin
  @Test fun playingAtFollowsTheComputedTrackEnd() {
    val full = SnapshotModels.decode(fixture("snapshot.full.json"))!!
    // generatedAt 1791460800000, playing at 120.5 s of 1800 s, rate 1: ends 1679.5 s later.
    assertTrue(ContentLogic.playingAt(full, full.generatedAt + 1_000))
    assertFalse(ContentLogic.playingAt(full, full.generatedAt + 1_680_000))
    assertFalse(ContentLogic.playingAt(full.copy(nowPlaying = full.nowPlaying!!.copy(isPlaying = false)), full.generatedAt))
    assertTrue(ContentLogic.playingAt(full.copy(nowPlaying = full.nowPlaying!!.copy(rate = 2.0)), full.generatedAt + 839_000))
    assertFalse(ContentLogic.playingAt(full.copy(nowPlaying = full.nowPlaying!!.copy(rate = 2.0)), full.generatedAt + 840_000))
    assertFalse(ContentLogic.playingAt(null, 0L))
  }
```

Run: `cd android && ./gradlew :bayaan-widgets:testReleaseUnitTest --tests '*ContentLogicTest*' && cd ..`
Expected: FAIL with "Unresolved reference: playingAt".

- [ ] **Step 2: Add `playingAt`**

In `ContentLogic.kt`, inside `object ContentLogic`:

```kotlin
  /**
   * Whether the snapshot's track is still playing at nowMs (playing, and not past
   * generatedAt + remaining / rate). Bayaan Now only; it ignores the tap override.
   */
  fun playingAt(snapshot: WidgetSnapshot?, nowMs: Long): Boolean {
    val np = snapshot?.nowPlaying ?: return false
    if (!np.isPlaying) return false
    val rate = if (np.rate > 0 && np.rate.isFinite()) np.rate else 1.0
    val remainingMs = ((np.durationSec - np.positionSec).coerceAtLeast(0.0) / rate * 1000).toLong()
    return nowMs < snapshot.generatedAt + remainingMs
  }
```

Run the test again. Expected: PASS.

- [ ] **Step 3: iOS Bayaan Now**

```swift
// targets/widgets/BayaanNow/BayaanNowWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

struct BayaanNowEntry: TimelineEntry {
  let date: Date
  let mode: BayaanNowMode
  let snapshot: WidgetSnapshot?
  let override: PlaybackOverride?
  let content: WidgetContent?
  let relevance: TimelineEntryRelevance?
}

struct BayaanNowProvider: TimelineProvider {
  func placeholder(in context: Context) -> BayaanNowEntry {
    BayaanNowEntry(date: .now, mode: .listening, snapshot: nil, override: nil, content: nil, relevance: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (BayaanNowEntry) -> Void) {
    completion(entries(from: .now)[0])
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<BayaanNowEntry>) -> Void) {
    completion(Timeline(entries: entries(from: .now), policy: .atEnd))
  }

  /// Now, every context boundary in the next 24 hours, and the playing track's computed end.
  /// The app reloads this kind when Continue Listening's slice, recent plays or the sleep timer change.
  func entries(from now: Date) -> [BayaanNowEntry] {
    let snapshot = SnapshotStore.load()
    let override = PlaybackOverrideStore.read()
    let content = ContentStore.load()
    func playback(at date: Date) -> EffectivePlayback? {
      guard let s = snapshot, let np = s.nowPlaying else { return nil }
      return EffectivePlayback(nowPlaying: np, generatedAt: s.generatedAt, override: override, now: date)
    }
    var dates = ContentTimeline.dates(from: now)
    if let p = playback(at: now), p.isPlaying, p.end > now { dates.append(p.end) }
    dates.sort()
    return dates.enumerated().map { i, d in
      let playing = playback(at: d)?.isPlaying ?? false
      let mode = ContentLogic.mode(hour: ContentLogic.hour(d), isPlaying: playing, occasion: ContentLogic.occasion(at: d))
      return BayaanNowEntry(
        date: d, mode: mode, snapshot: snapshot, override: override, content: content,
        relevance: .scored(ContentLogic.relevance(mode: mode, isPlaying: playing), from: d,
                           until: i + 1 < dates.count ? dates[i + 1] : nil))
    }
  }
}

struct BayaanNowWidget: Widget {
  let kind = "BayaanNow"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: BayaanNowProvider()) { entry in
      BayaanNowView(entry: entry)
    }
    .configurationDisplayName("Bayaan Now")
    .description("What fits this moment: listening, adhkar, occasions or bedtime.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

/// Composes the other widgets' views by mode (spec 6.8); each sets its own background and link.
struct BayaanNowView: View {
  @Environment(\.widgetFamily) private var family
  let entry: BayaanNowEntry

  var body: some View {
    switch entry.mode {
    case .listening:
      ContinueListeningView(entry: ContinueListeningEntry(date: entry.date, snapshot: entry.snapshot, override: entry.override))
    case .occasion:
      if family == .systemSmall {
        HijriDateView(entry: HijriDateEntry.make(at: entry.date, next: nil))
      } else {
        OccasionView(entry: OccasionEntry.make(at: entry.date, next: nil))
      }
    case .morningAdhkar, .eveningAdhkar:
      AdhkarView(entry: AdhkarEntry.make(at: entry.date, next: nil))
    case .bedtime:
      BedtimeView(entry: BedtimeEntry.make(
        at: entry.date, settings: .default(reciterName: entry.snapshot?.defaultReciter?.name),
        content: entry.content, next: nil))
    }
  }
}

#Preview("Small", as: .systemSmall) {
  BayaanNowWidget()
} timeline: {
  BayaanNowEntry(date: .now, mode: .listening, snapshot: nil, override: nil, content: nil, relevance: nil)
  BayaanNowEntry(date: .now, mode: .morningAdhkar, snapshot: nil, override: nil, content: nil, relevance: nil)
  BayaanNowEntry(date: .now, mode: .occasion, snapshot: nil, override: nil, content: nil, relevance: nil)
  BayaanNowEntry(date: .now, mode: .bedtime, snapshot: nil, override: nil, content: nil, relevance: nil)
}

#Preview("Medium", as: .systemMedium) {
  BayaanNowWidget()
} timeline: {
  BayaanNowEntry(date: .now, mode: .eveningAdhkar, snapshot: nil, override: nil, content: nil, relevance: nil)
  BayaanNowEntry(date: .now, mode: .occasion, snapshot: nil, override: nil, content: nil, relevance: nil)
  BayaanNowEntry(date: .now, mode: .bedtime, snapshot: nil, override: nil, content: nil, relevance: nil)
}
```

In `targets/widgets/ContentWidgets.swift`, add after `OccasionWidget()`:

```swift
    BayaanNowWidget()
```

- [ ] **Step 4: iOS build**

```bash
npm run prebuild
xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20
```
Expected: `** BUILD SUCCEEDED **`. `ContentWidgets` now has 8 children (limit 10).

- [ ] **Step 5: Android Bayaan Now**

```kotlin
// bayaannow/BayaanNowWidget.kt
package expo.modules.bayaanwidgets.bayaannow

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import expo.modules.bayaanwidgets.BayaanNowMode
import expo.modules.bayaanwidgets.ContentConfigJson
import expo.modules.bayaanwidgets.ContentLogic
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.IcuHijri
import expo.modules.bayaanwidgets.SnapshotModels
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.WidgetInputs
import expo.modules.bayaanwidgets.WidgetSnapshot
import expo.modules.bayaanwidgets.adhkar.AdhkarContent
import expo.modules.bayaanwidgets.bedtime.BedtimeContent
import expo.modules.bayaanwidgets.hijri.HijriSmallContent
import expo.modules.bayaanwidgets.hijri.OccasionContent
import expo.modules.bayaanwidgets.ui.ContentMessage
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.ui.ReciterPhoto
import expo.modules.bayaanwidgets.ui.RoundButton
import expo.modules.bayaanwidgets.ui.SurahCard
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.commandAction
import expo.modules.bayaanwidgets.ui.contentRoot
import expo.modules.bayaanwidgets.ui.deepLink
import expo.modules.bayaanwidgets.ui.playTrackCommand
import expo.modules.bayaanwidgets.ui.recordMissingArtwork
import org.json.JSONObject
import java.util.TimeZone

class BayaanNowWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.SMALL, WidgetSizes.MEDIUM))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    val snapshot = stored.snapshotJson?.let { SnapshotModels.decode(it) }
    val track = snapshot?.nowPlaying?.track ?: snapshot?.recent?.firstOrNull() ?: snapshot?.upNext?.firstOrNull()
    recordMissingArtwork(context, listOfNotNull(track?.surahId?.takeIf { it in 1..114 }, ContentConfigJson.DEFAULT_BEDTIME_SURAH), emptyList())
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      Content(context, inputs)
    }
  }

  @Composable
  private fun Content(context: Context, inputs: WidgetInputs) {
    val now = System.currentTimeMillis()
    val tz = TimeZone.getDefault()
    val snapshot = remember(inputs.snapshotJson) { inputs.snapshotJson?.let { SnapshotModels.decode(it) } }
    val playing = ContentLogic.playingAt(snapshot, now)
    val mode = ContentLogic.mode(ContentLogic.hour(now, tz), playing, ContentLogic.occasionAt(now, tz, IcuHijri))
    val small = LocalSize.current.width < WidgetSizes.MEDIUM.width
    when (mode) {
      BayaanNowMode.LISTENING -> NowPlayingCard(context, snapshot, now)
      BayaanNowMode.OCCASION -> if (small) HijriSmallContent(context, now) else OccasionContent(context, now)
      BayaanNowMode.MORNING_ADHKAR, BayaanNowMode.EVENING_ADHKAR -> AdhkarContent(context, now)
      BayaanNowMode.BEDTIME -> BedtimeContent(context, ContentConfigJson.DEFAULT_BEDTIME, inputs)
    }
  }
}

/**
 * Bayaan Now's listening card. 1a's Continue Listening composables are private
 * and off limits (P3-R13), so this is a plain card: artwork, titles and a play
 * or pause button. It renders the snapshot state without the tap override.
 */
@Composable
fun NowPlayingCard(context: Context, snapshot: WidgetSnapshot?, nowMs: Long) {
  val np = snapshot?.nowPlaying
  val track = np?.track ?: snapshot?.recent?.firstOrNull() ?: snapshot?.upNext?.firstOrNull()
  val root = contentRoot().clickable(deepLink(context, "bayaan://player"))
  if (track == null) {
    ContentMessage(root, "Open Bayaan", "Start listening")
    return
  }
  val playing = ContentLogic.playingAt(snapshot, nowMs)
  val action = when {
    np != null -> commandAction(context, JSONObject().put("type", "setPlayback").put("playing", !playing), "now/playback/${!playing}")
    track.isUserUpload || track.surahId !in 1..114 -> deepLink(context, "bayaan://player")
    else -> commandAction(context, playTrackCommand(track.surahId, track.reciterId, track.rewayatId, null),
      "now/play/${track.surahId}/${track.reciterId}/${track.rewayatId ?: "any"}")
  }
  val icon = if (playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
  val label = if (playing) "Pause" else "Play"
  val surah = if (track.isUserUpload) null else StaticData.surah(context, track.surahId)
  val small = LocalSize.current.width < WidgetSizes.MEDIUM.width
  val art = if (small) 64 else 96

  @Composable
  fun Art() {
    if (surah != null) SurahCard(context, surah, art) else ReciterPhoto(context, track.artworkFile, track.reciterName, art, art, art / 6)
  }

  if (small) {
    Column(root.padding(12.dp)) {
      Row(GlanceModifier.fillMaxWidth()) {
        Art()
        Spacer(GlanceModifier.defaultWeight())
        Logo(12)
      }
      Spacer(GlanceModifier.defaultWeight())
      Text(track.surahName, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 14.sp, fontWeight = FontWeight.Bold))
      Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
        Text(track.reciterName, maxLines = 1, modifier = GlanceModifier.defaultWeight(),
          style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 11.sp))
        RoundButton(icon, label, action)
      }
    }
    return
  }
  Row(root.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
    Art()
    Spacer(GlanceModifier.width(12.dp))
    Column(GlanceModifier.defaultWeight()) {
      Row(GlanceModifier.fillMaxWidth()) {
        Text(if (playing) "Now playing" else "Continue listening", modifier = GlanceModifier.defaultWeight(),
          style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp, fontWeight = FontWeight.Bold))
        Logo(14)
      }
      Text(track.surahName, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 15.sp, fontWeight = FontWeight.Bold))
      Text(track.reciterName, maxLines = 1, style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 13.sp))
      Spacer(GlanceModifier.height(6.dp))
      Row(GlanceModifier.fillMaxWidth()) {
        Spacer(GlanceModifier.defaultWeight())
        RoundButton(icon, label, action)
      }
    }
  }
}
```

```kotlin
// bayaannow/BayaanNowReceiver.kt
package expo.modules.bayaanwidgets.bayaannow

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import expo.modules.bayaanwidgets.ContextClockReceiver

class BayaanNowReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = BayaanNowWidget()

  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    super.onUpdate(context, appWidgetManager, appWidgetIds)
    ContextClockReceiver.schedule(context)
  }

  override fun onDisabled(context: Context) {
    super.onDisabled(context)
    ContextClockReceiver.cancelIfUnused(context)
  }
}
```

`res/xml/bayaan_now_info.xml`:

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/bayaan_widget_now_desc"
  android:minWidth="110dp"
  android:minHeight="110dp"
  android:targetCellWidth="4"
  android:targetCellHeight="2"
  android:maxResizeWidth="400dp"
  android:maxResizeHeight="200dp"
  android:resizeMode="horizontal|vertical"
  android:updatePeriodMillis="0"
  android:widgetCategory="home_screen"
  android:initialLayout="@layout/glance_default_loading_layout" />
```

- [ ] **Step 6: Register on Android**

`strings.xml`:

```xml
  <string name="bayaan_widget_now_label">Bayaan Now</string>
  <string name="bayaan_widget_now_desc">What fits this moment: listening, adhkar, occasions or bedtime.</string>
```

`AndroidManifest.xml`, inside `<application>`:

```xml
    <receiver
      android:name="expo.modules.bayaanwidgets.bayaannow.BayaanNowReceiver"
      android:exported="true"
      android:label="@string/bayaan_widget_now_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
      </intent-filter>
      <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/bayaan_now_info" />
    </receiver>
```

`ContextClockReceiver.kt`, add to `TARGETS` (import from `expo.modules.bayaanwidgets.bayaannow`):

```kotlin
      ClockTarget(BayaanNowReceiver::class.java) { BayaanNowWidget() },
```

`BayaanWidgetsModule.kt`:

```kotlin
import expo.modules.bayaanwidgets.bayaannow.BayaanNowWidget
```

```kotlin
          "BayaanNow" -> push(BayaanNowWidget())
```

- [ ] **Step 7: Full local verification and commit**

```bash
npm run test:ci -- --silent
npm run test:widget-fixtures
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
cd android && ./gradlew :bayaan-widgets:testReleaseUnitTest && ./gradlew :app:assembleRelease && cd ..
git add targets/widgets/BayaanNow/BayaanNowWidget.swift targets/widgets/ContentWidgets.swift modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/bayaannow modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/ContentLogic.kt modules/bayaan-widgets/android/src/test/java/expo/modules/bayaanwidgets/ContentLogicTest.kt modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/ContextClockReceiver.kt modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/BayaanWidgetsModule.kt modules/bayaan-widgets/android/src/main/AndroidManifest.xml modules/bayaan-widgets/android/src/main/res/values/strings.xml modules/bayaan-widgets/android/src/main/res/xml/bayaan_now_info.xml
git commit -m "feat(widgets): add the Bayaan Now smart widget"
```

---

### Task 11: Device verification and wrap-up

Use the argent MCP tools for all simulator and emulator interaction (read `argent-device-interact` first; take tap coordinates from the element tree, never from screenshot pixels). Release builds only: the Debug dev client cannot run app JS on a background launch. Today's local day number (2026-10-11) is 20737; use `hijri.table.json` row `20737 - 20454` for the expected Hijri date of any other day.

**Files:**
- Create: `docs/superpowers/plans/2026-10-11-widgets-phase-3-device-checklist.md` (results; same table format as the 1b checklist: item, platform, result PASS / PARTIAL / FAIL, notes)

- [ ] **Step 1: iOS run on the "Bayaan Widgets" simulator (B68030CC-7E5B-4127-BE07-EFA327BE6680)**

Build Release (Global Constraints command), install with argent `reinstall-app` or `xcrun simctl install B68030CC-7E5B-4127-BE07-EFA327BE6680 ios/build/dd/Build/Products/Release-iphonesimulator/Bayaan.app`, clear `DYLD_INSERT_LIBRARIES` before timing cold starts (`xcrun simctl spawn B68030CC-7E5B-4127-BE07-EFA327BE6680 launchctl unsetenv DYLD_INSERT_LIBRARIES`), launch, then set up: play three different surahs, download two surahs, create a playlist "Night" with Al-Mulk, As-Sajdah and Ya-Sin, open the adhkar screen once, background the app. Record each item:

1. Recently Played medium and large: the three surahs as cards (newest first), large shows reciter names; a card tap resumes that surah in place at its saved position. With a fresh install (delete and reinstall, open once): "Start listening" with Al-Fatihah, Al-Kahf, Ya-Sin, Al-Mulk.
2. Library medium and large: Downloads by default with the two downloads and "2 surahs". Edit the widget, choose "Night": header with play button and "3 surahs"; header play starts Al-Mulk; tapping the Ya-Sin card plays Ya-Sin then wraps to Al-Mulk and As-Sajdah (check the queue in the player). Delete "Night" in the app: the widget shows "Playlist unavailable".
3. Bedtime small and medium: configure As-Sajdah, a reciter, 15 minutes, Rain. Swipe the app away and tap the widget: As-Sajdah starts from 0:00 with that reciter, rain is audible, the player shows a sleep timer of about 15 minutes, and within a few seconds the widget reads "Sleep at HH:MM" (15 minutes from the tap). Tap again: the timer restarts (new time), the surah restarts. Note whether ambient started on the cold start (open check 1 in the spec).
4. Adhkar small and medium: "أذكار الصباح" before 12:00, "أذكار المساء" after; featured dhikr renders in Scheherazade New; a tap opens the matching adhkar set, including from a cold start.
5. Hijri Date small, Lock Screen inline and rectangular: the date equals table row 283 (`20737 - 20454`) of `hijri.table.json` for 2026-10-11 (or the row for the current day); the rectangular shows the next occasion with a day count matching `next-occasions.vectors.json` case `20737` when run on that day.
6. Occasion medium and large: without an occasion, "Coming up" lists Ramadan and the next anchor with day counts. Check the occasion layouts in the SwiftUI previews (Jumu'ah, Last Ten Nights) and, if the run day is a Friday before 18:00, on the widget: Listen plays Al-Kahf from the start; elsewhere the tap opens the reader at the ayah.
7. Reciter of the Day small and medium: photo (or initials before caching, then the photo after the next foreground), name, play resumes the reciter; medium rows play surahs the reciter has.
8. Bayaan Now small and medium: while playing it shows Continue Listening with a working play/pause; pause and wait for the reload: it shows the view for the current hour (morning adhkar 04:00 to 10:59, evening adhkar 15:00 to 19:59, bedtime 21:00 to 03:59, listening otherwise; occasion first if today has one). Add Bayaan Now to a Smart Stack with two other widgets and note what it shows; relevance cannot be judged on a simulator (spec open check 3).
9. Regression: Continue Listening play/pause in place, Quick Surah tap, Tasbeeh +1, the Phase 2 Live Activity and Control Center play/pause still work.
10. Cold start: with the app swiped away, tap a Library playlist card; record whether playback starts within the 60 s command window and how long it took.

- [ ] **Step 2: Android run (boot only now, shut down after)**

Boot the `Pixel_API_36` AVD with argent `boot-device` (`avdName: "Pixel_API_36"`), build `cd android && ./gradlew :app:assembleRelease && cd ..`, install `android/app/build/outputs/apk/release/app-release.apk` with `adb -s <serial> install -r`, repeat the Step 1 setup, then:

11. Repeat items 1 to 8 on Android. Differences by design: play taps open the app (`WidgetCommandActivity`), configuration happens in the dialog activities (Library picker; Bedtime menu with Surah, Reciter, Sleep timer, Ambient), Arabic is a bitmap, Bayaan Now's listening mode is the plain `NowPlayingCard` (no progress, no optimistic icon), and there is no Smart Stack.
12. `IcuHijri` check: the Hijri Date widget's date equals the table row for today (this is the only `android.icu` check; record any difference).
13. Occasion dates with root: `adb -s <serial> root`, `adb -s <serial> shell settings put global auto_time 0`. Find in `hijri.table.json` the first row in 2027 with month 9 and day 25 (its Gregorian date is `20454 + row index` days after 1970-01-01), set the emulator to 10:00 that day (`adb -s <serial> shell date MMDDhhmmCCYY.ss`, toybox format), and wait for the next push (or remove and re-add the widgets): Occasion shows "The Last Ten Nights" with a Surah Al-Qadr or Ad-Dukhan ayah, Hijri Date shows "25 Ramadan 1448", Bayaan Now (not playing) shows the occasion. Then set a Friday at 10:00 outside any Hijri window: Jumu'ah with an Al-Kahf ayah; Listen opens the app and plays Al-Kahf from the start. Restore with `adb -s <serial> shell settings put global auto_time 1`.
14. Boundary refresh: set the clock to 11:59 and wait past 12:00: the Adhkar widget switches from morning to evening without opening the app (`ContextClockReceiver`).
15. Android sleep timer in the background (spec open check 2): configure Bedtime with 15 minutes (the shortest option), tap it, lock the screen, and record whether playback stops at the time shown. A failure here is the existing player timer, not the widget; record it and file it, do not fix it in this branch.
16. Resize each widget through its sizes; layouts switch cleanly. Long-press "Reconfigure" opens the pickers for Library and Bedtime.

Then shut the emulator down: `adb -s <serial> emu kill`.

- [ ] **Step 3: Fix failures** with superpowers:systematic-debugging, one commit per fix. Known fallbacks: nested bundle (P3-R16, Task 7 Step 4); dynamic import routing (Task 6 Step 4 note); if the large Glance layouts exceed the RemoteViews size limit, drop the large Library captions first.

- [ ] **Step 4: Final checks**

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
npm run test:ci -- --silent
npm run test:widget-fixtures
cd android && ./gradlew :bayaan-widgets:testReleaseUnitTest && cd ..
npx prettier --check $(git diff --name-only origin/develop... | grep -E '\.(ts|tsx|js)$')
git diff --name-only origin/develop... | xargs grep -ln $'\xe2\x80\x94' || echo "no em dashes"
git diff origin/develop... -- targets/widgets/ContinueListening modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/continuelistening modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/WidgetCommandActivity.kt modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/ayahoftheday/MidnightReceiver.kt modules/bayaan-widgets/src/widgetKinds.ts | wc -l
```
Expected: all clean; the em dash line prints `no em dashes`; the last command prints `0` for Phase 3's own commits (compare against the Phase 2 branch, `git diff osmansaeday/widgets-2... -- <same paths> | wc -l`, if `origin/develop` does not yet contain Phase 2).

- [ ] **Step 5: Commit the checklist**

```bash
git add docs/superpowers/plans/2026-10-11-widgets-phase-3-device-checklist.md
git commit -m "docs: record widgets phase 3 device verification"
```

Then use superpowers:finishing-a-development-branch (PR targets `develop` after Phase 2 merges).

---

## Spec coverage

| Spec item | Task |
|---|---|
| 2 Feasibility audit and deferrals (no code for deferred parts) | spec only; deferrals are absences checked in review |
| 3 Widget list, families, Continue Listening look, fonts, no time-left text | 7, 8, 9, 10 |
| 4 One side document, separate kind list, rules mirrored with vectors, commands through the queue, date-driven refresh | 2, 3, 4, 5, 6 |
| 5.1 `content.json` fields, caps, past timer as null | 2, 6 |
| 5.2 Generated adhkar periods and occasions, drift test, dhikr text reuse | 1 |
| 5.3 Umm al-Qura from the Gregorian day number, midnight boundary, variance caveat (copy only), Friday weekday | 3, 4, 5, 9 |
| 5.4 Occasion windows, priority, ayah rotation, Jumu'ah Listen, coming-up anchors | 1, 3, 4, 5, 9 |
| 5.5 Time rules, relevance scores, boundaries | 3, 4, 5, 8, 9, 10 |
| 6.1 Recently Played | 4, 5, 7 |
| 6.2 Library Shelf (downloads, playlists, unavailable, no content, collection links) | 4, 5, 6, 7 |
| 6.3 Bedtime (configuration, from-the-start play, timer, ambient, "Sleep at") | 2, 4, 5, 6, 8 |
| 6.4 Adhkar | 1, 4, 5, 9 |
| 6.5 Hijri Date (small, Lock Screen inline and rectangular) | 4, 5, 9 |
| 6.6 Occasion | 1, 4, 5, 9 |
| 6.7 Reciter Spotlight (rotation list, cached photos, rows) | 4, 5, 6, 8 |
| 6.8 Bayaan Now (modes, composition, relevance, Android card) | 3, 4, 5, 10 |
| 7 Commands (`playPlaylist`, `startBedtime`, ambient list parity, dynamic import) | 2, 4, 6 |
| 8 File layout | all |
| 9 Edge cases | Review Focus items; 2, 4, 5, 6, 7, 8 |
| 10 Testing | 1 to 6 (Jest, Swift, Kotlin), 7 to 10 (previews, builds), 11 (device) |
| 11 Open device checks | 11 (items 3, 8, 12, 15) |
| 12 Rulings P3-R1 to P3-R21 | applied across tasks; P3-R16 fallback in 7, P3-R19 in "Before Task 1" |

## Self-review notes

- Spec coverage: every section maps to a task above; deferred features have no task by design.
- Placeholder scan: no "TBD"/"TODO"; every code step carries code; the two conditional fallbacks (nested bundle, dynamic import) name the exact replacement.
- Type consistency checked across tasks: `ContentResolvers.library(sourceId:content:)` / `ContentLogic.library(sourceId, content)`; `LibraryShelfState` cases; `BedtimeSettings.default(reciterName:)`; `BedtimeEntry.make(at:settings:content:next:)`; `AdhkarEntry.make(at:next:)`, `HijriDateEntry.make(at:next:)`, `OccasionEntry.make(at:next:)`; `ContentTimeline.dates(from:)` / `entries(from:make:)`; Kotlin `AdhkarContent`, `HijriSmallContent`, `OccasionContent`, `BedtimeContent`, `NowPlayingCard`; command field names `playlistId`, `itemId`, `surahId`, `reciterId`, `sleepMinutes`, `ambient` identical in TS guards, Swift intents and Kotlin builders.
- Review Focus: each item names its pinning tests; items 1 and 4 added time zone and stale timer cases to Tasks 3 to 6.
