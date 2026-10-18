# Widgets Phase 1b (Configurable and Glance Widgets, Lock Screen) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Quick Surah, Pinned Reciter, Ayah of the Day, Continue Reading and Tasbeeh on iOS and Android, plus the iOS Lock Screen accessories, on top of the Phase 1a plumbing without regressing Continue Listening.

**Architecture:** The 1a snapshot stays as it is (version 1); 1b fills `tasbeeh` and adds three side channels: a `catalog.json` written by the app (reciters and tasbeeh adhkar for pickers), static `surahs.json` / `ayat.json` generated at dev time and bundled into both widget targets, and an "artwork requests" list that widgets write when a surah card or reciter photo they want is not cached, so the app caches it on its next run. iOS widgets are SwiftUI `AppIntentConfiguration` widgets with `AppEntity` pickers; Android widgets are Glance widgets with small configuration activities and Arabic rendered to bitmaps. Every widget uses the Continue Listening look.

**Tech Stack:** Expo SDK 56, RN 0.83, TypeScript strict, Jest (jest-expo), tsx + better-sqlite3 (generator script), Swift / SwiftUI / WidgetKit / AppIntents (iOS 17 extension), Kotlin / Jetpack Glance 1.1.1 / AlarmManager (Android).

**Spec:** `docs/superpowers/specs/2026-10-08-widgets-design.md` (sections 5.2 to 5.7, plus 4, 6, 7, 8 as they apply). Phase 1a plan for conventions: `docs/superpowers/plans/2026-10-08-widgets-phase-1a.md`. Spike: `docs/superpowers/spikes/2026-10-08-digital-khatt-coretext.md` (PASS).

**Binding decisions that override the spec:**

1. Every widget uses the Continue Listening look: fixed `#1C1C1E` surface on both platforms, the Bayaan mark (`BayaanLogo` / `R.drawable.bayaan_mark`) in the top-right, white text, round 30 pt/dp buttons. No light/dark variants for any widget.
2. Surah visuals are the CarPlay surah cards (`https://cdn.thebayaan.com/assets/car/surah/{id}.png`, cached as `surah-{id}.jpg`). They replace "surah glyph calligraphy" in Quick Surah (small and the medium 2x2 grid) and Continue Reading. A card that is not cached yet renders as a dark tile with the surah number and name. Card availability: the app always caches surahs 1, 18, 36, 56, 67 (Quick Surah defaults, Pinned Reciter fallback rows, Continue Reading empty state); every widget records the cards and reciter photos it wanted but did not find into a shared "artwork requests" list, and the app caches those on start and on every foreground.
3. Quran text (Ayah of the Day, Continue Reading opening words) is Digital Khatt (PostScript name `DigitalKhattNewMadinaRegular`). Dhikr text uses the in-app adhkar font, Scheherazade New (`ScheherazadeNew-Regular`).
4. Android taps that play go through `WidgetCommandActivity` (opens the app when JS is not alive). iOS plays in place via `AudioPlaybackIntent`.
5. Lock Screen accessories are iOS only.
6. Continue Listening must not break; its tests keep passing unchanged.

**Rulings on spec gaps and conflicts (made in this plan):**

- R1. Ayah of the Day uses a curated list of 390 verse keys (all at most 20 Digital Khatt words), not ~365. The index is `localDayNumber % 390`, where `localDayNumber` is days from 1970-01-01 to the local Gregorian date, so the cycle does not restart every January.
- R2. All day math uses the local Gregorian calendar explicitly (`Calendar(identifier: .gregorian)` / `GregorianCalendar`), never the device default calendar, because Muslim users often set a Hijri device calendar.
- R3. The default Tasbeeh dhikr is seed id `91`, "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ" (100 times). The seed has no plain SubhanAllah with a repeat count. The Tasbeeh catalog is every seed dhikr whose Arabic starts with "((", whose `repeat_count` is above 1 and whose cleaned text is at most 180 characters (13 adhkar).
- R4. The medium Tasbeeh reset button writes a pending `reset` entry (`{dhikrId, count: 0, day, reset: true}`); the app applies a reset then the later taps.
- R5. Pending tasbeeh taps are consumed on app start and every foreground (not on each snapshot write, because applying them is async SQLite work). Widgets display `snapshot count + pending` meanwhile.
- R6. Pinned Reciter without a configured reciter shows the default reciter. A configured reciter missing from the catalog shows "Reciter unavailable"; on Android a tap opens the picker, on iOS the second line reads "Edit the widget to choose another" (iOS widgets cannot open their own editor).
- R7. Pinned Reciter has no "open the app" area: the photo and play button send `playReciter`, rows send `playTrack`. No reciter landing route exists to deep link to.
- R8. Tasbeeh areas that open the app use `bayaan://adhkar` (there is no per-dhikr route outside saved adhkar).
- R9. Lock Screen rectangular and inline show a live `mm:ss` countdown while playing (static "12m left" text cannot update without reloads) and "12m left" while paused.
- R10. Native code keeps the `bayaan://` scheme hardcoded, following 1a's Continue Listening. Making the scheme a branding seam (spec 4.7) is a cross-widget change left for later.
- R11. `surahs.json` and `ayat.json` are generated by `npm run generate:widget-data` and committed (both platform copies), with a Jest test that fails when they drift from the source list.
- R12. SwiftUI previews are added for every new widget; Glance previews are not (1a has no `glance-preview` dependency). Android layouts are checked by screenshot in Task 12.
- R13. The Lock Screen listening accessory is a separate widget kind `ListeningAccessory` that reuses `ContinueListeningProvider` unchanged; the iOS module reloads it whenever JS reloads `ContinueListening`, so the TS `WidgetKind` list does not change.

## Global Constraints

- Work in the worktree `/Users/osmansaeday/orca/workspaces/Bayaan/widgets`, branch `osmansaeday/widgets-1b`. PRs target `develop`. Conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`).
- Never use the em dash character anywhere (code, comments, copy, commits). Use a period, comma, colon or parentheses.
- Never use `theme.colors.primary` or any accent color. Widgets use only the fixed palette below.
- TypeScript strict. No `any`, no `as` casts unless unavoidable (JSON goes through type guards). Explicit parameter and return types. `function` keyword for pure functions. No classes in TS.
- Do not touch code outside the files each task names. Do not edit `targets/widgets/ContinueListening/*`, `continuelistening/*`, `PlaybackState.kt`, `OverrideExpiryWorker.kt`, `WidgetCommandActivity.kt` or any 1a test.
- Everything survives `npm run prebuild` (`expo prebuild --clean`). Never hand edit `ios/` or `android/`; commit regenerated output only when prebuild changes it.
- Widget extension deployment target iOS 17.0. Files in `targets/widgets/_shared/` also compile into the iOS 16.4 app, so App Intents there carry `@available(iOS 17.0, *)`. New extension-only Swift goes under `targets/widgets/Support/` or a per-widget folder, never `_shared/`.
- Palette (all widgets): background `#1C1C1E`; text white; secondary text white at 75%; tertiary white at 60%; tiles white at 15%; round button fill white at 18% (iOS) / `0x2EFFFFFF` (Android); round buttons 30 pt/dp with 12 pt bold SF Symbol or 18 dp icon; Bayaan mark top-right.
- Fonts: Quran text `DigitalKhattNewMadinaRegular` (iOS) / `fonts/DigitalKhattFont.otf` (Android bitmap); dhikr `ScheherazadeNew-Regular` / `fonts/ScheherazadeNew-Regular.ttf`; surah glyphs `icomoon` (iOS Lock Screen only). Quran text is centered or trailing-aligned, never justified (spike caveat).
- Widgets never touch the network. Images come only from the shared artwork dir (`widgets/artwork/` in the App Group on iOS, `filesDir/widgets/artwork` on Android).
- File name contracts: surah card `surah-{id}.jpg`; reciter photo `reciter-{sanitized id}.jpg` (`artworkFileName` in `services/widgets/buildSnapshot.ts`).
- Shared storage keys: iOS App Group defaults `widgets.pendingTasbeeh`, `widgets.artworkRequests`; file `widgets/catalog.json`. Android `bayaan_widgets` prefs keys `pendingTasbeeh`, `artworkRequests`, `catalog`, `config.<appWidgetId>`.
- Widget kind strings (must match `WidgetKind`): `QuickSurah`, `PinnedReciter`, `AyahOfTheDay`, `ContinueReading`, `Tasbeeh`; iOS-only `ListeningAccessory`.
- Commands that exist in this repo:
  - Typecheck: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`
  - Jest: `npx jest <path>` for one file, `npm run test:ci -- --silent` for all
  - Swift fixture and logic check: `npm run test:widget-fixtures`
  - Android unit tests: `cd android && ./gradlew :bayaan-widgets:testReleaseUnitTest`
  - Android build: `cd android && ./gradlew :app:assembleRelease`
  - iOS build (Xcode 27, no global `IPHONEOS_DEPLOYMENT_TARGET`, it drags the iOS 17 extension down; apply the local `expo-modules-jsi` Swift patch from project memory if the build stops there, never commit it): `xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20`
  - Format: `npx prettier --write <changed ts/tsx/js files>` (JSON and Markdown are in `.prettierignore`)
- Before calling any task done: typecheck and prettier pass clean, and the task's tests pass.
- Host memory is tight: do not boot an Android emulator before Task 12, and shut it down at the end of Task 12.

## Review Focus

1. **A configured surah or reciter whose artwork was never cached, and the app has not run since.** Expect a dark tile with the surah number and name (or reciter initials), no crash, and the real card after the next app open. Pinned by Task 4 `ArtworkRequestsJson.merge` and Task 3 `mergeRequests` tests, and Task 5 `configuredArtworkJobs` / `ensureConfiguredArtwork` tests.
2. **Tasbeeh taps around midnight, and taps from a day the app never consumed.** Expect the widget to show 0 after midnight and yesterday's pending taps never to reach the app. Pinned by Task 1 `planTasbeehOps` day test, Task 3 and Task 4 `tasbeehDisplayCount` vectors from `tasbeeh.pending.json`.
3. **Catalog missing (fresh install, app never opened) or from a future version.** Expect pickers to fall back to defaults, Tasbeeh to say "Open Bayaan to set up Tasbeeh", Quick Surah to still play with the default reciter. Pinned by Task 1 `isWidgetCatalog` future-version test, Task 3 Swift decode check, Task 4 `CatalogModels.decode` test.
4. **Device calendar set to Hijri, or a non-UTC time zone near midnight.** Expect the Gregorian local date to drive the ayah index and the tasbeeh day key on all three platforms. Pinned by Task 1 `dayMath` tests, Task 3 Swift vectors with an `America/New_York` zone, Task 4 `DayMath` vectors.
5. **Configured Pinned Reciter removed from the catalog, or never configured.** Expect "Reciter unavailable" for the first and the default reciter for the second. Pinned by Task 4 `PinnedReciterModel.resolve` tests.

---

## File Structure

```
data/widgets/ayah-of-the-day.json          curated verse keys (source list, 390 keys)
scripts/generate-widget-data.ts            writes surahs.json + ayat.json for both platforms
services/widgets/
  artworkNames.ts                          surahArtworkFileName / surahArtworkUrl (alias free)
  widgetStaticData.ts                      pure builders for surahs.json / ayat.json
  buildCatalog.ts                          reciters + tasbeeh adhkar -> WidgetCatalog; tasbeeh entries
  syncConfiguredWidgets.ts                 catalog writes, requested artwork, tasbeeh consumption
  __tests__/widgetStaticData.test.ts
  __tests__/buildCatalog.test.ts
  __tests__/syncConfiguredWidgets.test.ts
modules/bayaan-widgets/src/
  catalog.ts                               WidgetCatalog types + guard
  artworkRequests.ts                       WidgetArtworkRequests + parser
  dayMath.ts                               localDayNumber, ayahOfTheDayIndex
  tasbeeh.ts                               (modified) reset entries, planTasbeehOps
  __fixtures__/catalog.json                shared with Swift and Kotlin
  __fixtures__/tasbeeh.pending.json        shared with Swift and Kotlin
  __tests__/catalog.test.ts, artworkRequests.test.ts, dayMath.test.ts
targets/widgets/
  surahs.json, ayat.json                   generated
  Support/WidgetModels.swift               Codable catalog, static data, pending, requests
  Support/WidgetLogic.swift                day math, tasbeeh display, request merge, text helpers
  Support/WidgetStores.swift               CatalogStore, ArtworkFiles, ArtworkRequestStore, PendingTasbeehStore
  Support/StaticData.swift                 bundled surahs.json / ayat.json
  Support/WidgetChrome.swift               palette, fonts, SurahCard, ReciterPhoto, RoundIntentButton
  Support/Entities.swift                   SurahEntity, ReciterEntity, DhikrEntity
  QuickSurah/QuickSurahWidget.swift
  PinnedReciter/PinnedReciterWidget.swift
  AyahOfTheDay/AyahOfTheDayWidget.swift
  ContinueReading/ContinueReadingWidget.swift
  Tasbeeh/TasbeehWidget.swift
  LockScreen/ListeningAccessoryWidget.swift
modules/bayaan-widgets/android/src/main/
  assets/widgets/surahs.json, ayat.json    generated
  res/xml/*_info.xml, res/drawable/widget_scrim.xml, widget_reset.xml
  java/expo/modules/bayaanwidgets/
    CatalogModels.kt, StaticData.kt, DayMath.kt, TasbeehLogic.kt, ArtworkRequests.kt,
    WidgetConfig.kt, WidgetText.kt, TextFit.kt, ArabicBitmap.kt, RingBitmap.kt, GlanceState.kt
    ui/WidgetUi.kt, ui/ConfigPicker.kt
    quicksurah/, pinnedreciter/, ayahoftheday/, continuereading/, tasbeeh/
  ../test/java/expo/modules/bayaanwidgets/WidgetLogicTest.kt, WidgetDataTest.kt
```

Modified: `services/widgets/buildSnapshot.ts` (re-export names), `services/widgets/collectSnapshotInput.ts` (tasbeeh), `modules/bayaan-widgets/src/index.ts`, `NativeBayaanWidgets.ts`, `widgetKinds.ts` (PinnedReciter slice), `ios/BayaanWidgetsModule.swift`, `android/.../BayaanWidgetsModule.kt`, `WidgetStorage.kt`, `AndroidManifest.xml`, `strings.xml`, `targets/widgets/Info.plist`, `WidgetsBundle.swift`, `_shared/PlaybackIntents.swift`, `scripts/sync-widget-fonts.js`, `scripts/check-widget-fixtures.sh`, `.gitignore`, `package.json`, `app/_layout.tsx`.

Task order: 0 data generator, 1 module TS contracts, 2 iOS bridge additions + shared Swift, 3 Swift support layer, 4 Android support layer, 5 JS glue, 6 Quick Surah, 7 Pinned Reciter, 8 Ayah of the Day, 9 Continue Reading, 10 Tasbeeh, 11 iOS Lock Screen, 12 device verification. Native bridge functions land (Tasks 2 and 4) before JS calls them (Task 5), so the app never calls a missing native function.

---

### Task 0: Static widget data (surahs and Ayah of the Day)

Generates the static JSON both platforms bundle. Pure TS helpers carry the validation so Jest can test them; the script only does I/O.

**Files:**
- Create: `services/widgets/artworkNames.ts`, `services/widgets/widgetStaticData.ts`, `services/widgets/__tests__/widgetStaticData.test.ts`, `data/widgets/ayah-of-the-day.json`, `scripts/generate-widget-data.ts`
- Generated (committed): `targets/widgets/surahs.json`, `targets/widgets/ayat.json`, `modules/bayaan-widgets/android/src/main/assets/widgets/surahs.json`, `modules/bayaan-widgets/android/src/main/assets/widgets/ayat.json`
- Modify: `services/widgets/buildSnapshot.ts` (move the two surah artwork helpers out, re-export them), `package.json` (script)

**Interfaces:**
- Produces: `surahArtworkFileName(surahId: number): string`, `surahArtworkUrl(surahId: number): string` (still importable from `./buildSnapshot`); `StaticSurah {id, name, translatedName, glyph, artworkFile}`; `StaticAyah {key, surahId, ayah, surahName, arabic, translation}`; `cleanTranslation(raw: string): string`; `parseVerseKey(key: string): {surahId: number; ayah: number} | null`; `buildStaticSurahs(surahs: SurahSource[], glyphs: Record<number, string>): StaticSurah[]`; `buildStaticAyat(keys: string[], src: AyahSources): StaticAyah[]`; `MAX_AYAH_WORDS = 20`. JSON files are arrays of those shapes; Swift (`StaticSurah`, `StaticAyah` in Task 3) and Kotlin (Task 4) decode the same field names.

- [ ] **Step 1: Write the failing tests**

```ts
// services/widgets/__tests__/widgetStaticData.test.ts
import fs from 'fs';
import path from 'path';
import {
  buildStaticAyat,
  buildStaticSurahs,
  cleanTranslation,
  parseVerseKey,
  AyahSources,
  StaticAyah,
  StaticSurah,
} from '../widgetStaticData';
import {surahArtworkFileName} from '../buildSnapshot';

const root = path.resolve(__dirname, '../../..');

function readJson(rel: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function sources(overrides: Partial<AyahSources> = {}): AyahSources {
  return {
    words: () => ['قُلْ', 'هُوَ', 'ٱللَّهُ', 'أَحَدٌ', '۝١'],
    translation: () => 'Say, "He is Allāh,<sup foot_note="1">1</sup> One."',
    surahName: () => 'Al-Ikhlas',
    ...overrides,
  };
}

describe('cleanTranslation', () => {
  it('drops footnote markers and tags and collapses spaces', () => {
    expect(
      cleanTranslation('In the name of Allāh,<sup foot_note="226402">1</sup>  the <i>Merciful</i>.'),
    ).toBe('In the name of Allāh, the Merciful.');
  });
});

describe('parseVerseKey', () => {
  it('parses valid keys and rejects bad ones', () => {
    expect(parseVerseKey('2:255')).toEqual({surahId: 2, ayah: 255});
    expect(parseVerseKey('115:1')).toBeNull();
    expect(parseVerseKey('2:0')).toBeNull();
    expect(parseVerseKey('two')).toBeNull();
  });
});

describe('buildStaticSurahs', () => {
  it('maps names, glyphs and card file names', () => {
    const out = buildStaticSurahs(
      [{id: 18, name: 'Al-Kahf', translated_name_english: 'The Cave'}],
      {18: ''},
    );
    expect(out).toEqual([
      {
        id: 18,
        name: 'Al-Kahf',
        translatedName: 'The Cave',
        glyph: '',
        artworkFile: 'surah-18.jpg',
      },
    ]);
  });
});

describe('buildStaticAyat', () => {
  it('joins Digital Khatt words and cleans the translation', () => {
    const [a] = buildStaticAyat(['112:1'], sources());
    expect(a).toEqual({
      key: '112:1',
      surahId: 112,
      ayah: 1,
      surahName: 'Al-Ikhlas',
      arabic: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ ۝١',
      translation: 'Say, "He is Allāh, One."',
    });
  });

  it('rejects duplicates, long ayat and missing data', () => {
    expect(() => buildStaticAyat(['112:1', '112:1'], sources())).toThrow('duplicate');
    const long = Array.from({length: 22}, (_, i) => `w${i}`);
    expect(() => buildStaticAyat(['2:255'], sources({words: () => long}))).toThrow('max 20');
    expect(() => buildStaticAyat(['1:1'], sources({words: () => []}))).toThrow('Digital Khatt');
    expect(() => buildStaticAyat(['1:1'], sources({translation: () => undefined}))).toThrow('translation');
  });
});

describe('generated widget data', () => {
  const iosAyat = 'targets/widgets/ayat.json';
  const androidAyat = 'modules/bayaan-widgets/android/src/main/assets/widgets/ayat.json';
  const iosSurahs = 'targets/widgets/surahs.json';
  const androidSurahs = 'modules/bayaan-widgets/android/src/main/assets/widgets/surahs.json';

  it('is identical on both platforms', () => {
    expect(fs.readFileSync(path.join(root, iosAyat), 'utf8')).toBe(
      fs.readFileSync(path.join(root, androidAyat), 'utf8'),
    );
    expect(fs.readFileSync(path.join(root, iosSurahs), 'utf8')).toBe(
      fs.readFileSync(path.join(root, androidSurahs), 'utf8'),
    );
  });

  it('matches the source list (run npm run generate:widget-data after editing it)', () => {
    const keys = readJson('data/widgets/ayah-of-the-day.json');
    const ayat = readJson(iosAyat) as StaticAyah[];
    expect(ayat.map(a => a.key)).toEqual(keys);
    expect(ayat).toHaveLength(390);
    for (const a of ayat) {
      expect(a.arabic.split(' ').pop()?.startsWith('۝')).toBe(true);
      expect(a.translation.length).toBeGreaterThan(0);
    }
  });

  it('lists all 114 surahs with the card file name contract', () => {
    const surahs = readJson(iosSurahs) as StaticSurah[];
    expect(surahs).toHaveLength(114);
    surahs.forEach((s, i) => {
      expect(s.id).toBe(i + 1);
      expect(s.artworkFile).toBe(surahArtworkFileName(s.id));
      expect(s.glyph.length).toBe(1);
    });
  });
});
```

The two `as` casts read files this repo generates and the shape assertions right after validate them; they are test-only.

- [ ] **Step 2: Run to verify failure**

Run: `npx jest services/widgets/__tests__/widgetStaticData.test.ts`
Expected: FAIL, cannot find module `../widgetStaticData`.

- [ ] **Step 3: Move the surah artwork helpers into an alias-free module**

```ts
// services/widgets/artworkNames.ts
// File names in the shared artwork dir. No imports, so build scripts can use it.

// The dark surah cards shared with CarPlay and Android Auto (512 px PNGs).
const SURAH_ARTWORK_BASE = 'https://cdn.thebayaan.com/assets/car/surah/';

export function surahArtworkFileName(surahId: number): string {
  return `surah-${surahId}.jpg`;
}

export function surahArtworkUrl(surahId: number): string {
  return `${SURAH_ARTWORK_BASE}${surahId}.png`;
}
```

In `services/widgets/buildSnapshot.ts` delete the `SURAH_ARTWORK_BASE` constant, its comment, and the `surahArtworkFileName` and `surahArtworkUrl` functions, and add below the imports:

```ts
export {surahArtworkFileName, surahArtworkUrl} from './artworkNames';
```

Every existing import from `./buildSnapshot` (and the `jest.mock('../buildSnapshot')` in `syncWidgets.test.ts`) keeps working.

- [ ] **Step 4: Write the pure builders**

```ts
// services/widgets/widgetStaticData.ts
// Pure builders for the static JSON bundled into both widget targets.
// Imported by scripts/generate-widget-data.ts, so no '@/' imports here.
import {surahArtworkFileName} from './artworkNames';

export interface StaticSurah {
  id: number;
  name: string;
  translatedName: string;
  glyph: string; // surah_names.ttf ("icomoon") code point
  artworkFile: string;
}

export interface StaticAyah {
  key: string;
  surahId: number;
  ayah: number;
  surahName: string;
  arabic: string; // Digital Khatt words joined by spaces, ending with the ayah marker
  translation: string; // Saheeh International, footnotes removed
}

export interface SurahSource {
  id: number;
  name: string;
  translated_name_english: string;
}

export interface AyahSources {
  words: (surahId: number, ayah: number) => string[];
  translation: (key: string) => string | undefined;
  surahName: (surahId: number) => string | undefined;
}

// Short enough for the small widget at a readable size.
export const MAX_AYAH_WORDS = 20;

export function cleanTranslation(raw: string): string {
  return raw
    .replace(/<sup[^>]*>.*?<\/sup>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

export function parseVerseKey(
  key: string,
): {surahId: number; ayah: number} | null {
  const match = /^(\d{1,3}):(\d{1,3})$/.exec(key);
  if (!match) return null;
  const surahId = Number(match[1]);
  const ayah = Number(match[2]);
  if (surahId < 1 || surahId > 114 || ayah < 1) return null;
  return {surahId, ayah};
}

export function buildStaticSurahs(
  surahs: SurahSource[],
  glyphs: Record<number, string>,
): StaticSurah[] {
  return surahs.map(s => ({
    id: s.id,
    name: s.name,
    translatedName: s.translated_name_english,
    glyph: glyphs[s.id] ?? '',
    artworkFile: surahArtworkFileName(s.id),
  }));
}

export function buildStaticAyat(
  keys: string[],
  src: AyahSources,
): StaticAyah[] {
  const seen = new Set<string>();
  return keys.map(key => {
    if (seen.has(key)) throw new Error(`duplicate verse key ${key}`);
    seen.add(key);
    const parsed = parseVerseKey(key);
    if (!parsed) throw new Error(`bad verse key ${key}`);
    const words = src.words(parsed.surahId, parsed.ayah);
    if (words.length === 0) {
      throw new Error(`no Digital Khatt text for ${key}`);
    }
    // The last word is the end-of-ayah marker.
    const wordCount = words.length - 1;
    if (wordCount > MAX_AYAH_WORDS) {
      throw new Error(`${key} has ${wordCount} words, max ${MAX_AYAH_WORDS}`);
    }
    const translation = cleanTranslation(src.translation(key) ?? '');
    if (!translation) throw new Error(`no translation for ${key}`);
    const surahName = src.surahName(parsed.surahId);
    if (!surahName) throw new Error(`no surah name for ${key}`);
    return {
      key,
      surahId: parsed.surahId,
      ayah: parsed.ayah,
      surahName,
      arabic: words.join(' '),
      translation,
    };
  });
}
```

The space-before-punctuation rule covers footnote markers placed before a comma or period (`Allāh <sup>1</sup>,` becomes `Allāh,`).

- [ ] **Step 5: Add the curated source list**

Self-contained ayat of mercy, guidance, remembrance, duas and good news, each verified to be at most 20 words and to have a Saheeh translation. Mushaf order; consecutive days walk short runs such as Al-Ikhlas.

```json
[
  "1:2", "1:5", "2:45", "2:110", "2:115", "2:148", "2:152", "2:153", "2:155", "2:156",
  "2:163", "2:186", "2:195", "2:201", "2:218", "2:245", "2:269", "2:274", "2:277", "3:5",
  "3:8", "3:9", "3:16", "3:17", "3:18", "3:31", "3:53", "3:57", "3:74", "3:76",
  "3:92", "3:104", "3:114", "3:133", "3:134", "3:139", "3:147", "3:148", "3:160", "3:190",
  "3:193", "3:194", "3:200", "4:28", "4:69", "4:86", "4:99", "4:110", "4:124", "4:146",
  "4:147", "5:9", "6:17", "6:103", "6:127", "6:153", "6:162", "6:163", "7:23", "7:56",
  "7:96", "7:128", "7:180", "7:196", "7:199", "7:201", "7:205", "8:2", "8:28", "8:46",
  "9:51", "9:105", "9:116", "9:119", "9:129", "10:9", "10:25", "10:26", "10:57", "10:58",
  "10:62", "11:6", "11:11", "11:23", "11:90", "11:114", "11:115", "12:2", "12:86", "12:87",
  "12:92", "13:22", "13:24", "13:28", "13:29", "14:7", "14:23", "14:24", "14:34", "14:40",
  "14:41", "15:9", "15:49", "15:98", "15:99", "16:18", "16:30", "16:32", "16:53", "16:90",
  "16:96", "16:97", "16:120", "16:127", "16:128", "17:9", "17:19", "17:24", "17:53", "17:80",
  "17:82", "17:84", "18:10", "18:30", "18:46", "18:88", "18:107", "18:109", "19:65", "19:76",
  "19:96", "20:5", "20:8", "20:14", "20:25", "20:26", "20:46", "20:75", "20:76", "20:82",
  "20:114", "20:130", "21:35", "21:73", "21:83", "21:89", "21:94", "21:107", "22:24", "22:50",
  "22:75", "22:77", "23:61", "23:118", "24:52", "25:58", "25:63", "25:71", "25:74", "25:75",
  "25:76", "26:78", "26:79", "26:80", "26:81", "26:82", "26:83", "26:220", "27:62", "28:24",
  "28:83", "28:88", "29:7", "29:9", "29:58", "29:62", "29:64", "29:69", "30:21", "30:22",
  "30:38", "30:45", "31:8", "31:17", "31:18", "31:19", "31:22", "32:16", "32:17", "33:21",
  "33:41", "33:42", "33:43", "33:44", "33:47", "33:54", "33:56", "33:70", "33:71", "34:4",
  "35:2", "35:15", "35:28", "35:29", "35:30", "35:33", "35:34", "35:38", "36:11", "36:36",
  "36:55", "36:57", "36:58", "36:82", "36:83", "38:29", "39:1", "39:20", "39:53", "39:61",
  "39:73", "39:74", "40:8", "40:9", "40:13", "40:44", "40:55", "40:60", "40:65", "41:8",
  "41:30", "41:31", "41:32", "41:33", "41:34", "41:46", "42:11", "42:17", "42:19", "42:25",
  "42:26", "42:36", "43:3", "43:68", "43:69", "43:70", "43:71", "44:51", "44:57", "45:12",
  "45:30", "46:13", "46:16", "47:2", "47:7", "47:19", "47:24", "48:4", "48:5", "49:10",
  "49:13", "49:15", "50:8", "50:16", "50:31", "50:32", "50:33", "50:34", "51:15", "51:16",
  "51:17", "51:18", "51:49", "51:56", "51:58", "52:17", "52:21", "52:48", "53:39", "54:1",
  "54:17", "54:49", "54:54", "54:55", "55:1", "55:2", "55:3", "55:4", "55:13", "55:14",
  "55:27", "55:46", "55:60", "56:12", "56:26", "56:77", "57:3", "57:5", "57:19", "59:18",
  "59:22", "59:23", "59:24", "61:10", "61:11", "61:12", "61:13", "62:10", "64:3", "64:11",
  "64:13", "64:16", "65:5", "67:1", "67:2", "67:13", "67:14", "67:15", "68:4", "68:34",
  "69:24", "70:23", "71:10", "71:11", "71:12", "73:8", "73:9", "75:17", "76:6", "76:9",
  "76:12", "76:22", "77:41", "77:44", "78:31", "79:40", "79:41", "83:22", "83:28", "84:25",
  "85:11", "85:14", "87:1", "87:14", "87:15", "87:16", "87:17", "88:8", "88:9", "88:10",
  "89:14", "89:27", "89:28", "89:29", "89:30", "91:9", "92:5", "92:6", "92:7", "93:3",
  "93:4", "93:5", "93:11", "94:5", "94:6", "94:7", "94:8", "95:4", "95:6", "96:1",
  "96:3", "96:4", "96:5", "97:1", "97:3", "97:5", "98:7", "99:7", "101:6", "101:7",
  "108:1", "108:2", "109:6", "110:3", "112:1", "112:2", "112:3", "112:4", "113:1", "114:1"
]
```

Save as `data/widgets/ayah-of-the-day.json`.

- [ ] **Step 6: Write the generator script**

```ts
// scripts/generate-widget-data.ts
// Writes the static data bundled into both widget targets:
//   surahs.json  names, surah glyph code points, card file names
//   ayat.json    Ayah of the Day list with Digital Khatt text and Saheeh translation
// Run after editing data/widgets/ayah-of-the-day.json: npm run generate:widget-data
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import {SURAHS} from '../data/surahData';
import {surahGlyphMap} from '../utils/surahGlyphMap';
import {
  buildStaticAyat,
  buildStaticSurahs,
} from '../services/widgets/widgetStaticData';

const root = path.resolve(__dirname, '..');
const OUTPUT_DIRS = [
  'targets/widgets',
  'modules/bayaan-widgets/android/src/main/assets/widgets',
];

function readJson(rel: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string');
}

function textOf(row: unknown): string {
  return typeof row === 'object' &&
    row !== null &&
    'text' in row &&
    typeof row.text === 'string'
    ? row.text
    : '';
}

function saheehText(data: unknown, key: string): string | undefined {
  if (typeof data !== 'object' || data === null || !(key in data)) {
    return undefined;
  }
  const entry: unknown = Reflect.get(data, key);
  return typeof entry === 'object' &&
    entry !== null &&
    't' in entry &&
    typeof entry.t === 'string'
    ? entry.t
    : undefined;
}

function main(): void {
  const keys = readJson('data/widgets/ayah-of-the-day.json');
  if (!isStringArray(keys)) {
    throw new Error('ayah-of-the-day.json must be an array of verse keys');
  }
  const saheeh = readJson(
    'data/SaheehInternational.translation-with-footnote-tags.json',
  );
  const db = new Database(
    path.join(root, 'data/mushaf/digitalkhatt/digital-khatt-v2.db'),
    {readonly: true},
  );
  const wordsStmt = db.prepare(
    'SELECT text FROM words WHERE surah = ? AND ayah = ? ORDER BY word',
  );

  const ayat = buildStaticAyat(keys, {
    words: (surahId, ayah) =>
      wordsStmt.all(surahId, ayah).map(textOf).filter(Boolean),
    translation: key => saheehText(saheeh, key),
    surahName: surahId => SURAHS[surahId - 1]?.name,
  });
  const surahs = buildStaticSurahs(SURAHS, surahGlyphMap);
  db.close();

  for (const dir of OUTPUT_DIRS) {
    const abs = path.join(root, dir);
    fs.mkdirSync(abs, {recursive: true});
    fs.writeFileSync(path.join(abs, 'ayat.json'), `${JSON.stringify(ayat)}\n`);
    fs.writeFileSync(
      path.join(abs, 'surahs.json'),
      `${JSON.stringify(surahs)}\n`,
    );
  }
  console.log(
    `[generate-widget-data] ${ayat.length} ayat, ${surahs.length} surahs`,
  );
}

main();
```

Add to `package.json` scripts, after `"test:widget-fixtures"`:

```json
"generate:widget-data": "tsx scripts/generate-widget-data.ts",
```

- [ ] **Step 7: Generate and run the tests**

```bash
npm run generate:widget-data
npx jest services/widgets/__tests__/widgetStaticData.test.ts services/widgets/__tests__/buildSnapshot.test.ts services/widgets/__tests__/syncWidgets.test.ts
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
```
Expected: generator prints `390 ayat, 114 surahs`; all three suites PASS (the last two prove the helper move broke nothing); no type errors. `ls targets/widgets/*.json` shows both files (the folder is a synchronized group in the extension target, so they ship as bundle resources after the next prebuild).

- [ ] **Step 8: Commit**

```bash
npx prettier --write services/widgets/artworkNames.ts services/widgets/widgetStaticData.ts services/widgets/buildSnapshot.ts services/widgets/__tests__/widgetStaticData.test.ts scripts/generate-widget-data.ts
git add services/widgets data/widgets scripts/generate-widget-data.ts package.json targets/widgets/surahs.json targets/widgets/ayat.json modules/bayaan-widgets/android/src/main/assets/widgets
git commit -m "feat(widgets): generate static surah and ayah of the day data"
```

---

### Task 1: Module TS contracts (catalog, artwork requests, day math, tasbeeh resets)

**Files:**
- Create: `modules/bayaan-widgets/src/catalog.ts`, `modules/bayaan-widgets/src/artworkRequests.ts`, `modules/bayaan-widgets/src/dayMath.ts`, `modules/bayaan-widgets/src/__fixtures__/catalog.json`, `modules/bayaan-widgets/src/__fixtures__/tasbeeh.pending.json`, `modules/bayaan-widgets/src/__tests__/catalog.test.ts`, `modules/bayaan-widgets/src/__tests__/artworkRequests.test.ts`, `modules/bayaan-widgets/src/__tests__/dayMath.test.ts`
- Modify: `modules/bayaan-widgets/src/tasbeeh.ts`, `modules/bayaan-widgets/src/__tests__/tasbeeh.test.ts` (append cases only), `modules/bayaan-widgets/src/widgetKinds.ts` (PinnedReciter slice), `modules/bayaan-widgets/src/__tests__/widgetKinds.test.ts` (append one case), `modules/bayaan-widgets/src/NativeBayaanWidgets.ts`, `modules/bayaan-widgets/src/index.ts`

**Interfaces:**
- Produces: `WIDGET_CATALOG_VERSION = 1`; `WidgetCatalogReciter {id: string; name: string; artworkFile: string}`; `WidgetCatalogDhikr {id: string; arabic: string; translation: string | null; repeatCount: number}`; `WidgetCatalog {version: 1; reciters; adhkar}`; `isWidgetCatalog(value: unknown): value is WidgetCatalog`; `WidgetArtworkRequests {surahIds: number[]; reciterIds: string[]}`; `EMPTY_ARTWORK_REQUESTS`; `parseArtworkRequests(json: string): WidgetArtworkRequests`; `localDayNumber(date: Date): number`; `ayahOfTheDayIndex(date: Date, count: number): number`; `PendingTasbeeh.reset?: boolean`; `TasbeehOp {reset: boolean; increments: number}`; `planTasbeehOps(pending: PendingTasbeeh[], today: string): Record<string, TasbeehOp>`; JS API `writeCatalog(catalog: WidgetCatalog): void`, `readArtworkRequests(): WidgetArtworkRequests`. Native module gains `writeCatalog(json: string): void` and `readArtworkRequests(): string` (implemented in Tasks 2 and 4).

- [ ] **Step 1: Write the fixtures**

`modules/bayaan-widgets/src/__fixtures__/catalog.json`:

```json
{
  "version": 1,
  "reciters": [
    {"id": "r-alafasi", "name": "Mishary Alafasi", "artworkFile": "reciter-r-alafasi.jpg"},
    {"id": "r-sudais", "name": "Abdul Rahman Al-Sudais", "artworkFile": "reciter-r-sudais.jpg"}
  ],
  "adhkar": [
    {"id": "91", "arabic": "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", "translation": "How perfect Allah is and I praise Him.", "repeatCount": 100},
    {"id": "33", "arabic": "سُبْحانَ رَبِّيَ الْعَظِيمِ", "translation": null, "repeatCount": 3}
  ]
}
```

`modules/bayaan-widgets/src/__fixtures__/tasbeeh.pending.json` (a reset between taps, plus a tap from the previous day):

```json
[
  {"dhikrId": "91", "count": 3, "day": "2026-10-10"},
  {"dhikrId": "91", "count": 0, "day": "2026-10-10", "reset": true},
  {"dhikrId": "91", "count": 2, "day": "2026-10-10"},
  {"dhikrId": "96", "count": 5, "day": "2026-10-09"}
]
```

- [ ] **Step 2: Write the failing tests**

```ts
// modules/bayaan-widgets/src/__tests__/catalog.test.ts
import catalog from '../__fixtures__/catalog.json';
import {isWidgetCatalog, WIDGET_CATALOG_VERSION} from '../catalog';

describe('isWidgetCatalog', () => {
  it('accepts the shared fixture', () => {
    expect(isWidgetCatalog(catalog)).toBe(true);
  });

  it('rejects a future version', () => {
    expect(
      isWidgetCatalog({...catalog, version: WIDGET_CATALOG_VERSION + 1}),
    ).toBe(false);
  });

  it('rejects malformed entries', () => {
    expect(isWidgetCatalog({...catalog, reciters: [{id: 1}]})).toBe(false);
    expect(
      isWidgetCatalog({...catalog, adhkar: [{id: '91', arabic: 'x'}]}),
    ).toBe(false);
    expect(isWidgetCatalog(null)).toBe(false);
  });
});
```

```ts
// modules/bayaan-widgets/src/__tests__/artworkRequests.test.ts
import {EMPTY_ARTWORK_REQUESTS, parseArtworkRequests} from '../artworkRequests';

describe('parseArtworkRequests', () => {
  it('keeps valid, unique surah ids and reciter ids', () => {
    expect(
      parseArtworkRequests(
        JSON.stringify({
          surahIds: [18, 18, 0, 115, 2.5, '36', 36],
          reciterIds: ['r1', '', 'r1', 7, 'r2'],
        }),
      ),
    ).toEqual({surahIds: [18, 36], reciterIds: ['r1', 'r2']});
  });

  it('returns empty requests for garbage', () => {
    expect(parseArtworkRequests('nope')).toEqual(EMPTY_ARTWORK_REQUESTS);
    expect(parseArtworkRequests('[]')).toEqual(EMPTY_ARTWORK_REQUESTS);
    expect(parseArtworkRequests('{}')).toEqual(EMPTY_ARTWORK_REQUESTS);
  });
});
```

```ts
// modules/bayaan-widgets/src/__tests__/dayMath.test.ts
import {ayahOfTheDayIndex, localDayNumber} from '../dayMath';

// Same vectors as WidgetLogic.swift (check-widget-fixtures.sh) and DayMath.kt.
describe('localDayNumber', () => {
  it('counts days to the local calendar date', () => {
    expect(localDayNumber(new Date(1970, 0, 1, 12))).toBe(0);
    expect(localDayNumber(new Date(2026, 9, 10, 0, 1))).toBe(20736);
    expect(localDayNumber(new Date(2026, 9, 10, 23, 59))).toBe(20736);
    expect(localDayNumber(new Date(2026, 9, 11, 0, 1))).toBe(20737);
    expect(localDayNumber(new Date(2024, 1, 29, 12))).toBe(19782);
    expect(localDayNumber(new Date(1969, 11, 31, 12))).toBe(-1);
  });
});

describe('ayahOfTheDayIndex', () => {
  it('cycles through the list by day', () => {
    expect(ayahOfTheDayIndex(new Date(2026, 9, 10, 8), 390)).toBe(66);
    expect(ayahOfTheDayIndex(new Date(2026, 9, 11, 8), 390)).toBe(67);
    expect(ayahOfTheDayIndex(new Date(2024, 1, 29, 8), 390)).toBe(282);
    expect(ayahOfTheDayIndex(new Date(1969, 11, 31, 8), 390)).toBe(389);
  });

  it('returns -1 for an empty list', () => {
    expect(ayahOfTheDayIndex(new Date(2026, 9, 10), 0)).toBe(-1);
  });
});
```

Append to `modules/bayaan-widgets/src/__tests__/tasbeeh.test.ts` (keep the existing cases; extend the import list with `planTasbeehOps`):

```ts
import pendingFixture from '../__fixtures__/tasbeeh.pending.json';

describe('planTasbeehOps', () => {
  it('applies a reset, then the later taps, for today only', () => {
    const pending = parsePendingTasbeeh(JSON.stringify(pendingFixture));
    expect(pending).toHaveLength(4);
    expect(planTasbeehOps(pending, '2026-10-10')).toEqual({
      '91': {reset: true, increments: 2},
    });
  });

  it('sums taps without a reset', () => {
    expect(
      planTasbeehOps(
        [
          {dhikrId: 'a', count: 1, day: 'd'},
          {dhikrId: 'a', count: 4, day: 'd'},
          {dhikrId: 'b', count: 0, day: 'd'},
        ],
        'd',
      ),
    ).toEqual({a: {reset: false, increments: 5}});
  });
});

describe('parsePendingTasbeeh reset flag', () => {
  it('rejects a non boolean reset', () => {
    expect(
      parsePendingTasbeeh(
        JSON.stringify([{dhikrId: 'a', count: 0, day: 'd', reset: 'yes'}]),
      ),
    ).toEqual([]);
  });
});
```

Append to `modules/bayaan-widgets/src/__tests__/widgetKinds.test.ts` inside the `describe` block:

```ts
  it('reloads Pinned Reciter and Quick Surah when the default reciter changes', () => {
    const prev = base();
    const next = base();
    if (next.defaultReciter) next.defaultReciter.name = 'Someone Else';
    expect(changedWidgetKinds(prev, next)).toEqual([
      'ContinueListening',
      'QuickSurah',
      'PinnedReciter',
    ]);
  });
```

- [ ] **Step 3: Run to verify failure**

Run: `npx jest modules/bayaan-widgets`
Expected: FAIL: missing modules `../catalog`, `../artworkRequests`, `../dayMath`; `planTasbeehOps` not exported; the new widgetKinds case fails without `PinnedReciter`.

- [ ] **Step 4: Implement the contracts**

```ts
// modules/bayaan-widgets/src/catalog.ts
import {isNullableString, isRecord} from './guards';

export const WIDGET_CATALOG_VERSION = 1;

export interface WidgetCatalogReciter {
  id: string;
  name: string;
  artworkFile: string; // reciter-{id}.jpg; may not be cached yet
}

export interface WidgetCatalogDhikr {
  id: string;
  arabic: string;
  translation: string | null;
  repeatCount: number;
}

// Configuration pick lists. Written when reciters or adhkar change, not per snapshot.
export interface WidgetCatalog {
  version: typeof WIDGET_CATALOG_VERSION;
  reciters: WidgetCatalogReciter[];
  adhkar: WidgetCatalogDhikr[];
}

function isCatalogReciter(value: unknown): value is WidgetCatalogReciter {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.artworkFile === 'string'
  );
}

function isCatalogDhikr(value: unknown): value is WidgetCatalogDhikr {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.arabic === 'string' &&
    isNullableString(value.translation) &&
    typeof value.repeatCount === 'number'
  );
}

export function isWidgetCatalog(value: unknown): value is WidgetCatalog {
  return (
    isRecord(value) &&
    value.version === WIDGET_CATALOG_VERSION &&
    Array.isArray(value.reciters) &&
    value.reciters.every(isCatalogReciter) &&
    Array.isArray(value.adhkar) &&
    value.adhkar.every(isCatalogDhikr)
  );
}
```

```ts
// modules/bayaan-widgets/src/artworkRequests.ts
import {isRecord} from './guards';

// Artwork a widget wanted but did not find in the shared cache.
export interface WidgetArtworkRequests {
  surahIds: number[];
  reciterIds: string[];
}

export const EMPTY_ARTWORK_REQUESTS: WidgetArtworkRequests = {
  surahIds: [],
  reciterIds: [],
};

function isSurahId(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 114
  );
}

function isReciterId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function parseArtworkRequests(json: string): WidgetArtworkRequests {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return EMPTY_ARTWORK_REQUESTS;
  }
  if (!isRecord(parsed)) return EMPTY_ARTWORK_REQUESTS;
  const surahs: unknown[] = Array.isArray(parsed.surahIds)
    ? parsed.surahIds
    : [];
  const reciters: unknown[] = Array.isArray(parsed.reciterIds)
    ? parsed.reciterIds
    : [];
  return {
    surahIds: [...new Set(surahs.filter(isSurahId))],
    reciterIds: [...new Set(reciters.filter(isReciterId))],
  };
}
```

```ts
// modules/bayaan-widgets/src/dayMath.ts
const DAY_MS = 86_400_000;

// Days from 1970-01-01 to the local (Gregorian) calendar date of `date`.
// Mirrored by WidgetLogic.dayNumber (Swift) and DayMath.dayNumber (Kotlin).
export function localDayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS,
  );
}

// Index into ayat.json for the local date; -1 for an empty list.
export function ayahOfTheDayIndex(date: Date, count: number): number {
  if (count <= 0) return -1;
  const n = localDayNumber(date) % count;
  return n < 0 ? n + count : n;
}
```

In `modules/bayaan-widgets/src/tasbeeh.ts`, replace the `PendingTasbeeh` interface and `isPendingTasbeeh`, and add `planTasbeehOps` after `mergeTasbeehIncrements` (leave `localDayKey`, `mergeTasbeehIncrements` and `parsePendingTasbeeh` as they are):

```ts
export interface PendingTasbeeh {
  dhikrId: string;
  count: number;
  day: string; // YYYY-MM-DD local
  reset?: boolean; // the widget's reset button; count is 0
}

export interface TasbeehOp {
  reset: boolean;
  increments: number; // taps after the last reset
}

// What the app must apply per dhikr: an optional reset, then increments.
export function planTasbeehOps(
  pending: PendingTasbeeh[],
  today: string,
): Record<string, TasbeehOp> {
  const ops: Record<string, TasbeehOp> = {};
  for (const p of pending) {
    if (p.day !== today) continue;
    if (p.reset === true) {
      ops[p.dhikrId] = {reset: true, increments: 0};
      continue;
    }
    if (p.count <= 0) continue;
    const op = ops[p.dhikrId] ?? {reset: false, increments: 0};
    ops[p.dhikrId] = {reset: op.reset, increments: op.increments + p.count};
  }
  return ops;
}

function isPendingTasbeeh(value: unknown): value is PendingTasbeeh {
  return (
    typeof value === 'object' &&
    value !== null &&
    'dhikrId' in value &&
    'count' in value &&
    'day' in value &&
    typeof value.dhikrId === 'string' &&
    typeof value.count === 'number' &&
    typeof value.day === 'string' &&
    (!('reset' in value) || typeof value.reset === 'boolean')
  );
}
```

In `modules/bayaan-widgets/src/widgetKinds.ts`, change the `PinnedReciter` case of `sliceFor` (an unconfigured Pinned Reciter shows the default reciter):

```ts
    case 'PinnedReciter':
      return [s.reciterRecents, s.defaultReciter];
```

In `modules/bayaan-widgets/src/NativeBayaanWidgets.ts`, add to the interface after `hasArtwork`:

```ts
  writeCatalog(json: string): void;
  readArtworkRequests(): string;
```

In `modules/bayaan-widgets/src/index.ts`, add the imports and exports and two functions:

```ts
import type {WidgetCatalog} from './catalog';
import {
  EMPTY_ARTWORK_REQUESTS,
  parseArtworkRequests,
  type WidgetArtworkRequests,
} from './artworkRequests';

export * from './catalog';
export * from './artworkRequests';
export * from './dayMath';

export function writeCatalog(catalog: WidgetCatalog): void {
  NativeBayaanWidgets?.writeCatalog(JSON.stringify(catalog));
}

export function readArtworkRequests(): WidgetArtworkRequests {
  if (!NativeBayaanWidgets) return EMPTY_ARTWORK_REQUESTS;
  return parseArtworkRequests(NativeBayaanWidgets.readArtworkRequests());
}
```

- [ ] **Step 5: Run tests and typecheck**

```bash
npx jest modules/bayaan-widgets services/widgets
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
```
Expected: all PASS (existing 1a tests unchanged and green); no type errors.

- [ ] **Step 6: Commit**

```bash
npx prettier --write modules/bayaan-widgets/src
git add modules/bayaan-widgets/src
git commit -m "feat(widgets): add catalog, artwork request and day math contracts"
```

---
### Task 2: iOS bridge additions, playback intents and the dhikr font

**Files:**
- Modify: `modules/bayaan-widgets/ios/BayaanWidgetsModule.swift`, `targets/widgets/_shared/PlaybackIntents.swift`, `targets/widgets/Info.plist`, `scripts/sync-widget-fonts.js`, `.gitignore`

**Interfaces:**
- Consumes: JS `writeCatalog` / `readArtworkRequests` from Task 1.
- Produces: native `writeCatalog(json)` writes `<App Group>/widgets/catalog.json`; native `readArtworkRequests()` returns App Group defaults `widgets.artworkRequests` (or `"{}"`); `PlayTrackIntent(surahId:reciterId:rewayatId:ayah:)` with `ayah: Int? = nil`; `PlayReciterIntent(reciterId:)` (both `AudioPlaybackIntent`, run in the app process); font `ScheherazadeNew-Regular` registered in the extension; Android font asset `fonts/ScheherazadeNew-Regular.ttf`.

- [ ] **Step 1: Native functions in the iOS module**

In `modules/bayaan-widgets/ios/BayaanWidgetsModule.swift`, add inside `definition()` after the `takePendingTasbeeh` function:

```swift
    Function("writeCatalog") { (json: String) in
      guard let dir = widgetsDir() else { return }
      try? json.data(using: .utf8)?.write(
        to: dir.appendingPathComponent("catalog.json"), options: .atomic)
    }

    // Written by the widget extension (ArtworkRequestStore); read only, the
    // app skips files it already cached.
    Function("readArtworkRequests") { () -> String in
      guard let id = appGroupId(), let defaults = UserDefaults(suiteName: id) else { return "{}" }
      return defaults.string(forKey: "widgets.artworkRequests") ?? "{}"
    }
```

- [ ] **Step 2: Ayah parameter and a play-reciter intent**

In `targets/widgets/_shared/PlaybackIntents.swift`, replace the `PlayTrackIntent` struct with:

```swift
@available(iOS 17.0, *)
struct PlayTrackIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play Surah"
  static var isDiscoverable = false

  @Parameter(title: "Surah") var surahId: Int
  @Parameter(title: "Reciter") var reciterId: String?
  @Parameter(title: "Rewayah") var rewayatId: String?
  // Start from this ayah (Ayah of the Day); nil plays from the start.
  @Parameter(title: "Ayah") var ayah: Int?

  init() {}

  init(surahId: Int, reciterId: String?, rewayatId: String?, ayah: Int? = nil) {
    self.surahId = surahId
    self.reciterId = reciterId
    self.rewayatId = rewayatId
    self.ayah = ayah
  }

  func perform() async throws -> some IntentResult {
    WidgetCommandQueue.enqueue([
      "type": "playTrack",
      "surahId": surahId,
      "reciterId": reciterId ?? NSNull(),
      "rewayatId": rewayatId ?? NSNull(),
      "ayah": ayah ?? NSNull(),
    ])
    return .result()
  }
}

/// Resumes the reciter's last surah (Pinned Reciter).
@available(iOS 17.0, *)
struct PlayReciterIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play Reciter"
  static var isDiscoverable = false

  @Parameter(title: "Reciter") var reciterId: String

  init() {}

  init(reciterId: String) {
    self.reciterId = reciterId
  }

  func perform() async throws -> some IntentResult {
    WidgetCommandQueue.enqueue(["type": "playReciter", "reciterId": reciterId])
    return .result()
  }
}
```

Continue Listening's existing call sites (`PlayTrackIntent(surahId:reciterId:rewayatId:)`) compile unchanged through the default argument.

- [ ] **Step 3: Bundle the adhkar font in both widget targets**

In `scripts/sync-widget-fonts.js`, add two entries to `copies`:

```js
  [
    'assets/fonts/ScheherazadeNew-Regular.ttf',
    'targets/widgets/ScheherazadeNew-Regular.ttf',
  ],
  [
    'assets/fonts/ScheherazadeNew-Regular.ttf',
    'modules/bayaan-widgets/android/src/main/assets/fonts/ScheherazadeNew-Regular.ttf',
  ],
```

In `.gitignore`, under the "Widget extension font copies" block, add:

```
modules/bayaan-widgets/android/src/main/assets/fonts/ScheherazadeNew-Regular.ttf
```

(`targets/widgets/*.ttf` already covers the iOS copy.)

In `targets/widgets/Info.plist`, add to the `UIAppFonts` array:

```xml
    <string>ScheherazadeNew-Regular.ttf</string>
```

- [ ] **Step 4: Prebuild and build**

```bash
npm run prebuild
xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20
ls ios/build/dd/Build/Products/Release-iphonesimulator/Bayaan.app/PlugIns/*.appex | grep -E "ayat.json|surahs.json|Scheherazade"
```
Expected: `BUILD SUCCEEDED`; the last command lists `ayat.json`, `surahs.json` and `ScheherazadeNew-Regular.ttf` inside the extension bundle. If the JSON files are missing, the synchronized folder did not pick them up: re-run `npm run prebuild` and check `ios/Bayaan.xcodeproj/project.pbxproj` has no membership exception for them.

- [ ] **Step 5: Commit**

```bash
npx prettier --write scripts/sync-widget-fonts.js
git add modules/bayaan-widgets/ios/BayaanWidgetsModule.swift targets/widgets/_shared/PlaybackIntents.swift targets/widgets/Info.plist scripts/sync-widget-fonts.js .gitignore
git status --short ios android   # commit regenerated native output only if prebuild changed tracked files
git commit -m "feat(widgets): add catalog bridge, ayah and reciter play intents on iOS"
```

---

### Task 3: Swift support layer (models, logic, stores, chrome, entities)

**Files:**
- Create: `targets/widgets/Support/WidgetModels.swift`, `targets/widgets/Support/WidgetLogic.swift`, `targets/widgets/Support/WidgetStores.swift`, `targets/widgets/Support/StaticData.swift`, `targets/widgets/Support/WidgetChrome.swift`, `targets/widgets/Support/Entities.swift`
- Modify: `scripts/check-widget-fixtures.sh`

**Interfaces:**
- Consumes: `BayaanAppGroup`, `WidgetQueueLock` (`_shared/WidgetCommandQueue.swift`); `WidgetSnapshot`, `WidgetTasbeehEntry`, `WidgetReciter` (`_shared/WidgetSnapshot.swift`); `SnapshotStore.artwork(_:)`; `BayaanLogo`; fixtures from Task 1; generated JSON from Task 0.
- Produces (used by Tasks 6 to 10):
  - Models: `WidgetCatalog {version, reciters, adhkar; decode(_:); reciter(_ id: String?); dhikr(_ id: String)}`, `WidgetCatalogReciter {id, name, artworkFile}`, `WidgetCatalogDhikr {id, arabic, translation, repeatCount}`, `StaticSurah`, `StaticAyah`, `PendingTasbeeh {dhikrId, count, day, reset: Bool?}`, `ArtworkRequests {surahIds, reciterIds}`.
  - `WidgetLogic.dayNumber(_:timeZone:)`, `ayahIndex(_:count:timeZone:)`, `localDayKey(_:timeZone:)`, `nextMidnight(after:timeZone:)`, `tasbeehDisplayCount(entry:pending:dhikrId:today:)`, `tasbeehProgress(count:target:)`, `appendPending(_:dhikrId:day:reset:)`, `mergeRequests(_:surahIds:reciterIds:)`, `initials(_:)`, `reference(surahName:key:)`, `minutesLeftLabel(_:)`.
  - Stores: `CatalogStore.load() -> WidgetCatalog?`, `ArtworkFiles.exists(_:)`, `ArtworkRequestStore.recordMissing(surahs:reciterFiles:)`, `PendingTasbeehStore.read()`, `PendingTasbeehStore.add(dhikrId:reset:now:)`, `StaticData.surahs`, `StaticData.surah(_:)`, `StaticData.ayahOfTheDay(_:)`.
  - Views: `WidgetPalette.background`, `WidgetPalette.tile`, `WidgetFonts.quran(_:)`, `.dhikr(_:)`, `.surahGlyph(_:)`, `SurahCard(surah:size:)`, `ReciterPhoto(file:name:)`, `RoundGlyph(systemName:)`, `RoundIntentButton(intent:systemName:label:)`.
  - Entities: `SurahEntity`, `ReciterEntity`, `DhikrEntity` with string-search queries.

- [ ] **Step 1: Extend the Swift check script first (failing)**

Replace the body of `scripts/check-widget-fixtures.sh` after the `trap` line with:

```bash
fixtures="$root/modules/bayaan-widgets/src/__fixtures__"

cat "$root/targets/widgets/_shared/WidgetSnapshot.swift" \
    "$root/targets/widgets/Support/WidgetModels.swift" \
    "$root/targets/widgets/Support/WidgetLogic.swift" > "$tmp/decode-test.swift"
cat >> "$tmp/decode-test.swift" <<'SWIFT'
let dir = CommandLine.arguments[1]
let targetDir = CommandLine.arguments[2]
func load(_ path: String) -> Data { try! Data(contentsOf: URL(fileURLWithPath: path)) }

for name in ["snapshot.full.json", "snapshot.empty.json"] {
  precondition(WidgetSnapshot.decode(load("\(dir)/\(name)")) != nil, "failed to decode \(name)")
}
var bumped = try! String(contentsOfFile: "\(dir)/snapshot.full.json", encoding: .utf8)
bumped = bumped.replacingOccurrences(of: "\"version\": 1", with: "\"version\": 2")
precondition(WidgetSnapshot.decode(bumped.data(using: .utf8)!) == nil, "accepted future version")

// Catalog
let catalog = WidgetCatalog.decode(load("\(dir)/catalog.json"))
precondition(catalog?.reciters.count == 2 && catalog?.dhikr("33")?.translation == nil, "catalog decode")
var futureCatalog = try! String(contentsOfFile: "\(dir)/catalog.json", encoding: .utf8)
futureCatalog = futureCatalog.replacingOccurrences(of: "\"version\": 1", with: "\"version\": 2")
precondition(WidgetCatalog.decode(futureCatalog.data(using: .utf8)!) == nil, "accepted future catalog")

// Generated static data
let surahs = try! JSONDecoder().decode([StaticSurah].self, from: load("\(targetDir)/surahs.json"))
let ayat = try! JSONDecoder().decode([StaticAyah].self, from: load("\(targetDir)/ayat.json"))
precondition(surahs.count == 114 && surahs[17].artworkFile == "surah-18.jpg", "surahs.json")
precondition(ayat.count == 390, "ayat.json")
print("swift fixture decode: OK")

// Day math (same vectors as dayMath.test.ts and DayMath.kt)
let ny = TimeZone(identifier: "America/New_York")!
let utc = TimeZone(identifier: "UTC")!
let lateEvening = Date(timeIntervalSince1970: 1_791_689_400) // 2026-10-11T03:30Z = 23:30 on the 10th in New York
precondition(WidgetLogic.dayNumber(lateEvening, timeZone: ny) == 20736, "dayNumber NY")
precondition(WidgetLogic.dayNumber(lateEvening, timeZone: utc) == 20737, "dayNumber UTC")
precondition(WidgetLogic.ayahIndex(lateEvening, count: 390, timeZone: ny) == 66, "ayahIndex")
precondition(WidgetLogic.ayahIndex(Date(timeIntervalSince1970: -43_200), count: 390, timeZone: utc) == 389, "ayahIndex negative")
precondition(WidgetLogic.ayahIndex(lateEvening, count: 0, timeZone: ny) == -1, "ayahIndex empty")
precondition(WidgetLogic.localDayKey(lateEvening, timeZone: ny) == "2026-10-10", "localDayKey")
precondition(WidgetLogic.nextMidnight(after: lateEvening, timeZone: ny).timeIntervalSince1970 == 1_791_691_200, "nextMidnight")

// Tasbeeh display from the shared pending fixture
let pending = try! JSONDecoder().decode([PendingTasbeeh].self, from: load("\(dir)/tasbeeh.pending.json"))
let entry91 = WidgetTasbeehEntry(count: 12, target: 100, day: "2026-10-10")
precondition(WidgetLogic.tasbeehDisplayCount(entry: entry91, pending: pending, dhikrId: "91", today: "2026-10-10") == 2, "display after reset")
let entry96 = WidgetTasbeehEntry(count: 4, target: 100, day: "2026-10-10")
precondition(WidgetLogic.tasbeehDisplayCount(entry: entry96, pending: pending, dhikrId: "96", today: "2026-10-10") == 4, "old day pending ignored")
let staleEntry = WidgetTasbeehEntry(count: 30, target: 33, day: "2026-10-09")
precondition(WidgetLogic.tasbeehDisplayCount(entry: staleEntry, pending: [], dhikrId: "x", today: "2026-10-10") == 0, "new day starts at 0")
precondition(WidgetLogic.tasbeehProgress(count: 50, target: 100) == 0.5 && WidgetLogic.tasbeehProgress(count: 150, target: 100) == 1 && WidgetLogic.tasbeehProgress(count: 3, target: 0) == 0, "progress")

// Pending taps coalesce per dhikr and drop older days
var list = WidgetLogic.appendPending([PendingTasbeeh(dhikrId: "a", count: 9, day: "d0", reset: nil)], dhikrId: "a", day: "d1", reset: false)
list = WidgetLogic.appendPending(list, dhikrId: "a", day: "d1", reset: false)
list = WidgetLogic.appendPending(list, dhikrId: "a", day: "d1", reset: true)
list = WidgetLogic.appendPending(list, dhikrId: "a", day: "d1", reset: false)
precondition(list == [
  PendingTasbeeh(dhikrId: "a", count: 2, day: "d1", reset: nil),
  PendingTasbeeh(dhikrId: "a", count: 0, day: "d1", reset: true),
  PendingTasbeeh(dhikrId: "a", count: 1, day: "d1", reset: nil),
], "appendPending")

// Artwork requests: valid, unique, stable order, capped
let merged = WidgetLogic.mergeRequests(ArtworkRequests(surahIds: [36], reciterIds: ["r1"]), surahIds: [18, 36, 0, 115], reciterIds: ["r1", "", "r2"])
precondition(merged == ArtworkRequests(surahIds: [18, 36], reciterIds: ["r1", "r2"]), "mergeRequests")
let many = WidgetLogic.mergeRequests(.empty, surahIds: [], reciterIds: (1...60).map { "r\($0)" })
precondition(many.reciterIds.count == 50 && many.reciterIds.first == "r11", "mergeRequests cap")

// Text helpers
precondition(WidgetLogic.initials("Mishary Rashid Alafasy") == "MR" && WidgetLogic.initials("  ") == "", "initials")
precondition(WidgetLogic.reference(surahName: "Al-Kahf", key: "18:10") == "Al-Kahf 18:10", "reference")
precondition(WidgetLogic.minutesLeftLabel(61) == "2m left" && WidgetLogic.minutesLeftLabel(3_900) == "1h 5m left" && WidgetLogic.minutesLeftLabel(0) == "0m left", "minutesLeftLabel")
print("swift widget logic: OK")
SWIFT

swift "$tmp/decode-test.swift" "$fixtures" "$root/targets/widgets"
```

Run: `npm run test:widget-fixtures`
Expected: FAIL (Support files do not exist yet).

- [ ] **Step 2: Codable models (pure Foundation, compiled by the check script)**

```swift
// targets/widgets/Support/WidgetModels.swift
import Foundation

// catalog.json, written by the app (modules/bayaan-widgets/src/catalog.ts).
struct WidgetCatalogReciter: Codable, Hashable {
  let id: String
  let name: String
  let artworkFile: String
}

struct WidgetCatalogDhikr: Codable, Hashable {
  let id: String
  let arabic: String
  let translation: String?
  let repeatCount: Int
}

struct WidgetCatalog: Codable {
  static let supportedVersion = 1
  let version: Int
  let reciters: [WidgetCatalogReciter]
  let adhkar: [WidgetCatalogDhikr]

  static func decode(_ data: Data) -> WidgetCatalog? {
    guard let c = try? JSONDecoder().decode(WidgetCatalog.self, from: data),
          c.version == supportedVersion else { return nil }
    return c
  }

  func reciter(_ id: String?) -> WidgetCatalogReciter? {
    guard let id else { return nil }
    return reciters.first { $0.id == id }
  }

  func dhikr(_ id: String) -> WidgetCatalogDhikr? {
    adhkar.first { $0.id == id }
  }
}

// surahs.json and ayat.json, generated by scripts/generate-widget-data.ts.
struct StaticSurah: Codable, Hashable {
  let id: Int
  let name: String
  let translatedName: String
  let glyph: String
  let artworkFile: String
}

struct StaticAyah: Codable, Hashable {
  let key: String
  let surahId: Int
  let ayah: Int
  let surahName: String
  let arabic: String
  let translation: String
}

// One widget tap waiting for the app (PendingTasbeeh in tasbeeh.ts).
struct PendingTasbeeh: Codable, Hashable {
  let dhikrId: String
  let count: Int
  let day: String
  let reset: Bool?
}

// Artwork widgets wanted but did not find (artworkRequests.ts).
struct ArtworkRequests: Codable, Hashable {
  var surahIds: [Int]
  var reciterIds: [String]
  static let empty = ArtworkRequests(surahIds: [], reciterIds: [])
}
```

- [ ] **Step 3: Pure logic**

```swift
// targets/widgets/Support/WidgetLogic.swift
import Foundation

/// Pure helpers for the widgets, tested by scripts/check-widget-fixtures.sh.
/// Mirrors dayMath.ts / tasbeeh.ts (JS) and DayMath.kt / TasbeehLogic.kt /
/// ArtworkRequests.kt / WidgetText.kt (Android). Dates always use the
/// Gregorian calendar, whatever calendar the device is set to.
enum WidgetLogic {
  static let maxRequestedReciters = 50

  private static func gregorian(_ timeZone: TimeZone) -> Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    return calendar
  }

  /// Days from 1970-01-01 to the local calendar date of `date`.
  static func dayNumber(_ date: Date, timeZone: TimeZone = .current) -> Int {
    let parts = gregorian(timeZone).dateComponents([.year, .month, .day], from: date)
    let utcDate = gregorian(TimeZone(identifier: "UTC")!).date(
      from: DateComponents(year: parts.year, month: parts.month, day: parts.day)) ?? date
    return Int((utcDate.timeIntervalSince1970 / 86_400).rounded(.down))
  }

  static func ayahIndex(_ date: Date, count: Int, timeZone: TimeZone = .current) -> Int {
    guard count > 0 else { return -1 }
    let n = dayNumber(date, timeZone: timeZone) % count
    return n < 0 ? n + count : n
  }

  static func localDayKey(_ date: Date, timeZone: TimeZone = .current) -> String {
    let p = gregorian(timeZone).dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", p.year ?? 0, p.month ?? 0, p.day ?? 0)
  }

  static func nextMidnight(after date: Date, timeZone: TimeZone = .current) -> Date {
    let calendar = gregorian(timeZone)
    let start = calendar.startOfDay(for: date)
    return calendar.date(byAdding: .day, value: 1, to: start) ?? date.addingTimeInterval(86_400)
  }

  /// The snapshot's count for today, then pending widget taps in order.
  static func tasbeehDisplayCount(entry: WidgetTasbeehEntry?, pending: [PendingTasbeeh],
                                  dhikrId: String, today: String) -> Int {
    var count = entry?.day == today ? (entry?.count ?? 0) : 0
    for p in pending where p.dhikrId == dhikrId && p.day == today {
      if p.reset == true { count = 0 } else { count += max(0, p.count) }
    }
    return count
  }

  static func tasbeehProgress(count: Int, target: Int) -> Double {
    target > 0 ? min(1, Double(max(0, count)) / Double(target)) : 0
  }

  /// Adds one tap (or a reset), merging into the last entry when it is the
  /// same dhikr and day. Entries from earlier days are dropped: the app
  /// discards them anyway.
  static func appendPending(_ list: [PendingTasbeeh], dhikrId: String, day: String,
                            reset: Bool) -> [PendingTasbeeh] {
    var out = list.filter { $0.day == day }
    if !reset, let last = out.last, last.dhikrId == dhikrId, last.reset != true {
      out[out.count - 1] = PendingTasbeeh(dhikrId: dhikrId, count: last.count + 1, day: day, reset: nil)
    } else {
      out.append(PendingTasbeeh(dhikrId: dhikrId, count: reset ? 0 : 1, day: day, reset: reset ? true : nil))
    }
    return out
  }

  /// Valid, unique ids; existing order kept so repeated renders do not rewrite.
  static func mergeRequests(_ existing: ArtworkRequests, surahIds: [Int],
                            reciterIds: [String]) -> ArtworkRequests {
    let surahs = Array(Set(existing.surahIds + surahIds.filter { (1...114).contains($0) })).sorted()
    var reciters = existing.reciterIds
    for id in reciterIds where !id.isEmpty && !reciters.contains(id) { reciters.append(id) }
    return ArtworkRequests(surahIds: surahs, reciterIds: Array(reciters.suffix(maxRequestedReciters)))
  }

  static func initials(_ name: String) -> String {
    name.split(separator: " ").prefix(2).compactMap { $0.first.map { String($0).uppercased() } }.joined()
  }

  static func reference(surahName: String, key: String) -> String {
    "\(surahName) \(key)"
  }

  static func minutesLeftLabel(_ seconds: Double) -> String {
    let minutes = Int((max(0, seconds) / 60).rounded(.up))
    return minutes >= 60 ? "\(minutes / 60)h \(minutes % 60)m left" : "\(minutes)m left"
  }
}
```

- [ ] **Step 4: Run the check**

Run: `npm run test:widget-fixtures`
Expected: `swift fixture decode: OK` then `swift widget logic: OK`.

- [ ] **Step 5: Stores and static data (extension only)**

```swift
// targets/widgets/Support/WidgetStores.swift
import Foundation

enum CatalogStore {
  static func load() -> WidgetCatalog? {
    guard let url = BayaanAppGroup.widgetsDir?.appendingPathComponent("catalog.json"),
          let data = try? Data(contentsOf: url) else { return nil }
    return WidgetCatalog.decode(data)
  }
}

enum ArtworkFiles {
  static func exists(_ file: String?) -> Bool {
    guard let file, let dir = BayaanAppGroup.widgetsDir else { return false }
    return FileManager.default.fileExists(atPath: dir.appendingPathComponent("artwork/\(file)").path)
  }
}

/// Artwork a widget wanted but did not find. The app reads the list on start
/// and foreground and caches the files (syncConfiguredWidgets.ts).
enum ArtworkRequestStore {
  static let key = "widgets.artworkRequests"

  static func record(surahIds: [Int], reciterIds: [String]) {
    guard !surahIds.isEmpty || !reciterIds.isEmpty, let defaults = BayaanAppGroup.defaults else { return }
    WidgetQueueLock.withLock {
      let existing = defaults.string(forKey: key)
        .flatMap { try? JSONDecoder().decode(ArtworkRequests.self, from: Data($0.utf8)) } ?? .empty
      let merged = WidgetLogic.mergeRequests(existing, surahIds: surahIds, reciterIds: reciterIds)
      guard merged != existing, let data = try? JSONEncoder().encode(merged) else { return }
      defaults.set(String(decoding: data, as: UTF8.self), forKey: key)
    }
  }

  /// Records the surah cards and reciter photos (by reciter id) not cached yet.
  static func recordMissing(surahs: [StaticSurah], reciterFiles: [(id: String, file: String?)]) {
    record(
      surahIds: surahs.filter { !ArtworkFiles.exists($0.artworkFile) }.map(\.id),
      reciterIds: reciterFiles.filter { !ArtworkFiles.exists($0.file) }.map(\.id))
  }
}

/// Tasbeeh taps made on the widget, waiting for the app. The module's
/// takePendingTasbeeh reads and clears the same key under the same lock.
enum PendingTasbeehStore {
  static let key = "widgets.pendingTasbeeh"

  static func read() -> [PendingTasbeeh] {
    guard let raw = BayaanAppGroup.defaults?.string(forKey: key),
          let list = try? JSONDecoder().decode([PendingTasbeeh].self, from: Data(raw.utf8)) else { return [] }
    return list
  }

  static func add(dhikrId: String, reset: Bool, now: Date = .now) {
    guard let defaults = BayaanAppGroup.defaults else { return }
    WidgetQueueLock.withLock {
      let next = WidgetLogic.appendPending(read(), dhikrId: dhikrId,
                                           day: WidgetLogic.localDayKey(now), reset: reset)
      if let data = try? JSONEncoder().encode(next) {
        defaults.set(String(decoding: data, as: UTF8.self), forKey: key)
      }
    }
  }
}
```

```swift
// targets/widgets/Support/StaticData.swift
import Foundation

/// surahs.json and ayat.json bundled in the extension (generated by
/// scripts/generate-widget-data.ts).
enum StaticData {
  static let surahs: [StaticSurah] = load("surahs")
  static let ayat: [StaticAyah] = load("ayat")

  static func surah(_ id: Int) -> StaticSurah? {
    guard id >= 1, id <= surahs.count, surahs[id - 1].id == id else {
      return surahs.first { $0.id == id }
    }
    return surahs[id - 1]
  }

  static func ayahOfTheDay(_ date: Date) -> StaticAyah? {
    let index = WidgetLogic.ayahIndex(date, count: ayat.count)
    return index >= 0 ? ayat[index] : nil
  }

  private static func load<T: Decodable>(_ name: String) -> [T] {
    guard let url = Bundle.main.url(forResource: name, withExtension: "json"),
          let data = try? Data(contentsOf: url),
          let list = try? JSONDecoder().decode([T].self, from: data) else { return [] }
    return list
  }
}
```

- [ ] **Step 6: Shared chrome**

```swift
// targets/widgets/Support/WidgetChrome.swift
import AppIntents
import SwiftUI
import WidgetKit

/// The Continue Listening look, shared by every Phase 1b widget.
enum WidgetPalette {
  // Fixed near-black in both appearances (Continue Listening keeps its own
  // private copy of the same value).
  static let background = Color(red: 0x1C / 255, green: 0x1C / 255, blue: 0x1E / 255)
  static let tile = Color.white.opacity(0.15)
}

enum WidgetFonts {
  static func quran(_ size: CGFloat) -> Font { .custom("DigitalKhattNewMadinaRegular", size: size) }
  static func dhikr(_ size: CGFloat) -> Font { .custom("ScheherazadeNew-Regular", size: size) }
  static func surahGlyph(_ size: CGFloat) -> Font { .custom("icomoon", size: size) }
}

/// Cached artwork, kept full color on tinted Home Screens (iOS 18+).
struct CachedImage: View {
  let image: UIImage

  var body: some View {
    if #available(iOS 18.0, *) {
      Image(uiImage: image).resizable().widgetAccentedRenderingMode(.fullColor)
    } else {
      Image(uiImage: image).resizable()
    }
  }
}

/// The surah card when cached, else a dark tile with the number and name.
struct SurahCard: View {
  let surah: StaticSurah?
  let size: CGFloat

  var body: some View {
    Group {
      if let surah, let image = SnapshotStore.artwork(surah.artworkFile) {
        CachedImage(image: image).aspectRatio(1, contentMode: .fill)
      } else {
        ZStack {
          WidgetPalette.tile
          VStack(spacing: 1) {
            Text(surah.map { String($0.id) } ?? "")
              .font(.system(size: size * 0.32, weight: .bold, design: .rounded))
            if size >= 44, let surah {
              Text(surah.name).font(.system(size: 9, weight: .semibold))
                .lineLimit(1).minimumScaleFactor(0.7).padding(.horizontal, 3)
            }
          }
          .foregroundStyle(.white)
        }
      }
    }
    .frame(width: size, height: size)
    .clipShape(RoundedRectangle(cornerRadius: size * 0.16, style: .continuous))
    .accessibilityLabel(surah?.name ?? "")
  }
}

/// The reciter photo when cached, else initials on a dark tile. Fills its frame.
struct ReciterPhoto: View {
  let file: String?
  let name: String

  var body: some View {
    if let image = SnapshotStore.artwork(file) {
      CachedImage(image: image).aspectRatio(contentMode: .fill)
    } else {
      ZStack {
        WidgetPalette.tile
        Text(WidgetLogic.initials(name)).font(.title2.bold()).foregroundStyle(.white)
      }
    }
  }
}

/// The 30 pt round glyph of Continue Listening's play button.
struct RoundGlyph: View {
  let systemName: String

  var body: some View {
    Image(systemName: systemName)
      .font(.system(size: 12, weight: .bold))
      .foregroundStyle(.white)
      .frame(width: 30, height: 30)
      .background(.white.opacity(0.18), in: Circle())
  }
}

struct RoundIntentButton<I: AppIntent>: View {
  let intent: I
  let systemName: String
  let label: String

  var body: some View {
    Button(intent: intent) { RoundGlyph(systemName: systemName) }
      .buttonStyle(.plain)
      .accessibilityLabel(label)
  }
}
```

- [ ] **Step 7: Configuration entities**

```swift
// targets/widgets/Support/Entities.swift
import AppIntents
import Foundation

struct SurahEntity: AppEntity {
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Surah")
  static var defaultQuery = SurahEntityQuery()

  let id: Int
  let name: String

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(id). \(name)")
  }

  init(_ surah: StaticSurah) {
    id = surah.id
    name = surah.name
  }
}

struct SurahEntityQuery: EntityStringQuery {
  func entities(for identifiers: [Int]) async throws -> [SurahEntity] {
    identifiers.compactMap { StaticData.surah($0).map(SurahEntity.init) }
  }

  func suggestedEntities() async throws -> [SurahEntity] {
    StaticData.surahs.map(SurahEntity.init)
  }

  func entities(matching string: String) async throws -> [SurahEntity] {
    let q = string.lowercased().trimmingCharacters(in: .whitespaces)
    return StaticData.surahs.filter {
      $0.name.lowercased().contains(q) || $0.translatedName.lowercased().contains(q) || String($0.id) == q
    }.map(SurahEntity.init)
  }
}

struct ReciterEntity: AppEntity {
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Reciter")
  static var defaultQuery = ReciterEntityQuery()

  let id: String
  let name: String

  var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}

struct ReciterEntityQuery: EntityStringQuery {
  private var reciters: [WidgetCatalogReciter] { CatalogStore.load()?.reciters ?? [] }

  // Unknown ids stay resolvable so the widget can say the reciter is unavailable.
  func entities(for identifiers: [String]) async throws -> [ReciterEntity] {
    let all = reciters
    return identifiers.map { id in
      all.first { $0.id == id }.map { ReciterEntity(id: $0.id, name: $0.name) }
        ?? ReciterEntity(id: id, name: "Unavailable reciter")
    }
  }

  func suggestedEntities() async throws -> [ReciterEntity] {
    reciters.map { ReciterEntity(id: $0.id, name: $0.name) }
  }

  func entities(matching string: String) async throws -> [ReciterEntity] {
    let q = string.lowercased()
    return reciters.filter { $0.name.lowercased().contains(q) }
      .map { ReciterEntity(id: $0.id, name: $0.name) }
  }
}

struct DhikrEntity: AppEntity {
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Dhikr")
  static var defaultQuery = DhikrEntityQuery()

  let id: String
  let arabic: String
  let translation: String?

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(translation ?? arabic)", subtitle: "\(arabic)")
  }

  init(_ dhikr: WidgetCatalogDhikr) {
    id = dhikr.id
    arabic = dhikr.arabic
    translation = dhikr.translation
  }
}

struct DhikrEntityQuery: EntityStringQuery {
  private var adhkar: [WidgetCatalogDhikr] { CatalogStore.load()?.adhkar ?? [] }

  func entities(for identifiers: [String]) async throws -> [DhikrEntity] {
    let all = adhkar
    return identifiers.compactMap { id in all.first { $0.id == id }.map(DhikrEntity.init) }
  }

  func suggestedEntities() async throws -> [DhikrEntity] { adhkar.map(DhikrEntity.init) }

  func entities(matching string: String) async throws -> [DhikrEntity] {
    let q = string.lowercased()
    return adhkar.filter {
      $0.arabic.contains(string) || ($0.translation?.lowercased().contains(q) ?? false)
    }.map(DhikrEntity.init)
  }
}
```

- [ ] **Step 8: Build**

```bash
npm run test:widget-fixtures
xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20
```
Expected: both check lines OK; `BUILD SUCCEEDED` (new files are picked up by the synchronized `widgets` folder; no prebuild needed since `_shared/` gained no files).

- [ ] **Step 9: Commit**

```bash
git add targets/widgets/Support scripts/check-widget-fixtures.sh
git commit -m "feat(widgets): add the Swift support layer for configurable widgets"
```

---
### Task 4: Android support layer (storage, models, logic, Arabic bitmaps, shared Glance UI)

**Files (all under `modules/bayaan-widgets/android/src/`):**
- Create: `main/java/expo/modules/bayaanwidgets/CatalogModels.kt`, `StaticData.kt`, `DayMath.kt`, `TasbeehLogic.kt`, `ArtworkRequests.kt`, `WidgetConfig.kt`, `WidgetText.kt`, `TextFit.kt`, `ArabicBitmap.kt`, `RingBitmap.kt`, `GlanceState.kt`, `pinnedreciter/PinnedReciterModel.kt`, `ui/WidgetUi.kt`, `ui/ConfigPicker.kt`; `main/res/drawable/widget_scrim.xml`, `main/res/drawable/widget_reset.xml`; `test/java/expo/modules/bayaanwidgets/WidgetLogicTest.kt`, `test/java/expo/modules/bayaanwidgets/WidgetDataTest.kt`
- Modify: `main/java/expo/modules/bayaanwidgets/WidgetStorage.kt` (additions only), `main/java/expo/modules/bayaanwidgets/BayaanWidgetsModule.kt` (two functions and a push helper)

**Interfaces:**
- Consumes: `WidgetStorage`, `SnapshotModels`, `WidgetSnapshot`, `WidgetTasbeehEntry`, `WidgetCommandActivity.intent(context, command)`, `R.drawable.bayaan_mark` (1a); fixtures (Task 1); generated assets (Task 0); fonts (Task 2).
- Produces (used by Tasks 6 to 10):
  - `WidgetStorage.writeCatalog(context, json)`, `readCatalogJson(context): String?`, `readPendingTasbeehJson(context): String?`, `addPendingTasbeeh(context, dhikrId, day, reset)`, `writeConfig(context, appWidgetId, json)`, `readConfigJson(context, appWidgetId): String?`, `deleteConfigs(context, ids: IntArray)`, `recordArtworkRequests(context, surahIds: List<Int>, reciterIds: List<String>)`, `readArtworkRequestsJson(context): String`.
  - `CatalogModels.decode(json): WidgetCatalog?`, `WidgetCatalog.reciter(id: String?)`, `WidgetCatalog.dhikr(id)`, `CatalogReciter`, `CatalogDhikr`.
  - `StaticData.surahs(context)`, `surah(context, id)`, `ayahOfTheDay(context, nowMs, tz)`, `parseSurahs(json)`, `parseAyat(json)`, `StaticSurah`, `StaticAyah`.
  - `DayMath.dayNumber(nowMs, tz)`, `ayahIndex(nowMs, tz, count)`, `localDayKey(nowMs, tz)`, `nextLocalMidnightMs(nowMs, tz)`.
  - `TasbeehLogic.parse(json)`, `encode(list)`, `append(list, dhikrId, day, reset)`, `displayCount(entry, pending, dhikrId, today)`, `progress(count, target)`, `PendingTasbeehEntry`.
  - `ArtworkRequestsJson.decode/encode/merge`, `ArtworkRequests`.
  - `WidgetConfigJson.decodeQuickSurah/decodePinnedReciter/decodeTasbeeh/encode`, `QuickSurahConfig`, `PinnedReciterConfig`, `TasbeehConfig`, `WidgetConfigJson.QUICK_SURAH_DEFAULT_IDS`, `WidgetConfigJson.DEFAULT_DHIKR_ID`.
  - `WidgetText.initials(name)`, `WidgetText.reference(surahName, key)`.
  - `PinnedReciterModel.resolve(config, catalog, snapshot): PinnedReciterState`, `PinnedReciterState.Ready/Unavailable/Unset`, `PinnedRow`.
  - `ArabicBitmap.render(...)`, `ArabicBitmap.QURAN_FONT`, `ArabicBitmap.DHIKR_FONT`, `TextFit.largestFitting(...)`, `RingBitmap.render(...)`.
  - `GlanceState.stored(context, appWidgetId)`, `GlanceState.appWidgetId(context, glanceId)`, `GlanceState.current(prefs, fallback)`, `GlanceState.push(context, widget)`, `WidgetInputs`.
  - `ui`: `WidgetColors`, `WidgetSizes`, `Logo(height)`, `RoundButton(icon, description, action)`, `SurahCard(context, surah, sizeDp)`, `ReciterPhoto(context, reciterId, file, name, widthDp, heightDp, cornerDp)`, `ArabicText(...)`, `deepLink(context, url)`, `commandAction(context, command, key)`, `playTrackCommand(...)`, `playReciterCommand(id)`, `dpToPx(context, dp)`; `ConfigPicker.menu/pick`.
  - Module: `writeCatalog(json)`, `readArtworkRequests()`, private `push(widget)`.

- [ ] **Step 1: Write the failing tests**

```kotlin
// test/java/expo/modules/bayaanwidgets/WidgetLogicTest.kt
package expo.modules.bayaanwidgets

import expo.modules.bayaanwidgets.pinnedreciter.PinnedReciterModel
import expo.modules.bayaanwidgets.pinnedreciter.PinnedReciterState
import expo.modules.bayaanwidgets.pinnedreciter.PinnedRow
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.util.TimeZone

class WidgetLogicTest {
  private val ny = TimeZone.getTimeZone("America/New_York")
  private val utc = TimeZone.getTimeZone("UTC")
  private val lateEvening = 1_791_689_400_000L // 2026-10-11T03:30Z, 23:30 on the 10th in New York

  // Same vectors as dayMath.test.ts and check-widget-fixtures.sh.
  @Test fun dayMath() {
    assertEquals(20736L, DayMath.dayNumber(lateEvening, ny))
    assertEquals(20737L, DayMath.dayNumber(lateEvening, utc))
    assertEquals(66, DayMath.ayahIndex(lateEvening, ny, 390))
    assertEquals(282, DayMath.ayahIndex(1_709_208_000_000L, utc, 390))
    assertEquals(389, DayMath.ayahIndex(-43_200_000L, utc, 390))
    assertEquals(-1, DayMath.ayahIndex(lateEvening, ny, 0))
    assertEquals("2026-10-10", DayMath.localDayKey(lateEvening, ny))
    assertEquals(1_791_691_200_000L, DayMath.nextLocalMidnightMs(lateEvening, ny))
  }

  @Test fun tasbeehAppendCoalescesAndDropsOldDays() {
    var list = listOf(PendingTasbeehEntry("a", 9, "d0", false))
    list = TasbeehLogic.append(list, "a", "d1", reset = false)
    list = TasbeehLogic.append(list, "a", "d1", reset = false)
    list = TasbeehLogic.append(list, "a", "d1", reset = true)
    list = TasbeehLogic.append(list, "a", "d1", reset = false)
    assertEquals(
      listOf(
        PendingTasbeehEntry("a", 2, "d1", false),
        PendingTasbeehEntry("a", 0, "d1", true),
        PendingTasbeehEntry("a", 1, "d1", false),
      ),
      list,
    )
    assertEquals(list, TasbeehLogic.parse(TasbeehLogic.encode(list)))
  }

  @Test fun tasbeehProgress() {
    assertEquals(0.5f, TasbeehLogic.progress(50, 100), 0f)
    assertEquals(1f, TasbeehLogic.progress(150, 100), 0f)
    assertEquals(0f, TasbeehLogic.progress(3, 0), 0f)
  }

  @Test fun artworkRequestsMerge() {
    val merged = ArtworkRequestsJson.merge(ArtworkRequests(listOf(36), listOf("r1")), listOf(18, 36, 0, 115), listOf("r1", "", "r2"))
    assertEquals(ArtworkRequests(listOf(18, 36), listOf("r1", "r2")), merged)
    val many = ArtworkRequestsJson.merge(ArtworkRequests(emptyList(), emptyList()), emptyList(), (1..60).map { "r$it" })
    assertEquals(50, many.reciterIds.size)
    assertEquals("r11", many.reciterIds.first())
    assertEquals(merged, ArtworkRequestsJson.decode(ArtworkRequestsJson.encode(merged)))
    assertEquals(ArtworkRequests(emptyList(), emptyList()), ArtworkRequestsJson.decode("garbage"))
  }

  @Test fun quickSurahConfigDefaultsAndSanitizes() {
    assertEquals(QuickSurahConfig(listOf(18, 36, 67, 56), null), WidgetConfigJson.decodeQuickSurah(null))
    assertEquals(
      QuickSurahConfig(listOf(55, 36, 67, 56), "r1"),
      WidgetConfigJson.decodeQuickSurah("""{"surahIds":[55,0],"reciterId":"r1"}"""),
    )
    val c = QuickSurahConfig(listOf(1, 2, 3, 4), null)
    assertEquals(c, WidgetConfigJson.decodeQuickSurah(WidgetConfigJson.encode(c)))
    assertEquals("91", WidgetConfigJson.decodeTasbeeh("nope").dhikrId)
    assertEquals("96", WidgetConfigJson.decodeTasbeeh(WidgetConfigJson.encode(TasbeehConfig("96"))).dhikrId)
    assertNull(WidgetConfigJson.decodePinnedReciter("""{"reciterId":null}""").reciterId)
    assertEquals("r9", WidgetConfigJson.decodePinnedReciter(WidgetConfigJson.encode(PinnedReciterConfig("r9"))).reciterId)
  }

  @Test fun textHelpers() {
    assertEquals("MR", WidgetText.initials("Mishary Rashid Alafasy"))
    assertEquals("", WidgetText.initials("  "))
    assertEquals("Al-Kahf 18:10", WidgetText.reference("Al-Kahf", "18:10"))
  }

  @Test fun textFit() {
    assertEquals(20f, TextFit.largestFitting(30f, 10f, 2f) { it <= 20f }, 0f)
    assertEquals(10f, TextFit.largestFitting(30f, 10f, 2f) { false }, 0f)
    assertEquals(12f, TextFit.largestFitting(12f, 12f, 2f) { true }, 0f)
  }

  private val snapshot = SnapshotModels.decode(File("../src/__fixtures__/snapshot.full.json").readText())!!
  private val catalog = CatalogModels.decode(File("../src/__fixtures__/catalog.json").readText())!!

  @Test fun pinnedReciterResolve() {
    val track = snapshot.upNext.first()
    val withRecents = snapshot.copy(reciterRecents = mapOf("r-alafasi" to listOf(track)))
    assertEquals(
      PinnedReciterState.Ready("r-alafasi", "Mishary Alafasi", "reciter-r-alafasi.jpg", listOf(PinnedRow(36, "rw-1"))),
      PinnedReciterModel.resolve(PinnedReciterConfig("r-alafasi"), catalog, withRecents),
    )
    assertEquals(PinnedReciterState.Unavailable, PinnedReciterModel.resolve(PinnedReciterConfig("gone"), catalog, snapshot))
    assertEquals(
      PinnedReciterState.Ready("r-alafasi", "Mishary Alafasi", "reciter-r-alafasi.jpg", listOf(PinnedRow(1, null), PinnedRow(36, null), PinnedRow(67, null))),
      PinnedReciterModel.resolve(PinnedReciterConfig(null), catalog, snapshot),
    )
    assertEquals(PinnedReciterState.Unset, PinnedReciterModel.resolve(PinnedReciterConfig(null), null, snapshot.copy(defaultReciter = null)))
  }
}
```

```kotlin
// test/java/expo/modules/bayaanwidgets/WidgetDataTest.kt
package expo.modules.bayaanwidgets

import org.junit.Assert.*
import org.junit.Test
import java.io.File

class WidgetDataTest {
  private fun fixture(name: String) = File("../src/__fixtures__/$name").readText()

  @Test fun decodesCatalogAndRejectsFutureVersion() {
    val c = CatalogModels.decode(fixture("catalog.json"))
    assertNotNull(c)
    assertEquals(2, c!!.reciters.size)
    assertEquals("Mishary Alafasi", c.reciter("r-alafasi")!!.name)
    assertNull(c.reciter("missing"))
    assertNull(c.reciter(null))
    assertNull(c.dhikr("33")!!.translation)
    assertEquals(100, c.dhikr("91")!!.repeatCount)
    assertNull(CatalogModels.decode(fixture("catalog.json").replace("\"version\": 1", "\"version\": 2")))
    assertNull(CatalogModels.decode("nope"))
  }

  @Test fun tasbeehDisplayFromSharedFixture() {
    val pending = TasbeehLogic.parse(fixture("tasbeeh.pending.json"))
    assertEquals(4, pending.size)
    assertEquals(2, TasbeehLogic.displayCount(WidgetTasbeehEntry(12, 100, "2026-10-10"), pending, "91", "2026-10-10"))
    assertEquals(4, TasbeehLogic.displayCount(WidgetTasbeehEntry(4, 100, "2026-10-10"), pending, "96", "2026-10-10"))
    assertEquals(0, TasbeehLogic.displayCount(WidgetTasbeehEntry(30, 33, "2026-10-09"), emptyList(), "x", "2026-10-10"))
    assertEquals(0, TasbeehLogic.displayCount(null, emptyList(), "x", "2026-10-10"))
    assertTrue(TasbeehLogic.parse("garbage").isEmpty())
  }

  @Test fun parsesGeneratedStaticData() {
    val surahs = StaticData.parseSurahs(File("src/main/assets/widgets/surahs.json").readText())
    val ayat = StaticData.parseAyat(File("src/main/assets/widgets/ayat.json").readText())
    assertEquals(114, surahs.size)
    assertEquals("surah-18.jpg", surahs[17].artworkFile)
    assertEquals(390, ayat.size)
    assertTrue(ayat.all { it.arabic.isNotEmpty() && it.translation.isNotEmpty() })
  }
}
```

Run: `cd android && ./gradlew :bayaan-widgets:testReleaseUnitTest`
Expected: compilation FAILS (classes do not exist). Paths are relative to the module's `android/` dir, as in 1a's `SnapshotModelsTest`.

- [ ] **Step 2: Pure models and logic**

```kotlin
// main/java/expo/modules/bayaanwidgets/CatalogModels.kt
package expo.modules.bayaanwidgets

import org.json.JSONObject

data class CatalogReciter(val id: String, val name: String, val artworkFile: String)
data class CatalogDhikr(val id: String, val arabic: String, val translation: String?, val repeatCount: Int)

data class WidgetCatalog(val reciters: List<CatalogReciter>, val adhkar: List<CatalogDhikr>) {
  fun reciter(id: String?): CatalogReciter? = id?.let { wanted -> reciters.firstOrNull { it.id == wanted } }
  fun dhikr(id: String): CatalogDhikr? = adhkar.firstOrNull { it.id == id }
}

/** Decodes catalog.json (modules/bayaan-widgets/src/catalog.ts). */
object CatalogModels {
  const val VERSION = 1

  fun decode(json: String): WidgetCatalog? = try {
    val o = JSONObject(json)
    if (o.getInt("version") != VERSION) null else {
      val r = o.getJSONArray("reciters")
      val a = o.getJSONArray("adhkar")
      WidgetCatalog(
        (0 until r.length()).map { i ->
          r.getJSONObject(i).let { CatalogReciter(it.getString("id"), it.getString("name"), it.getString("artworkFile")) }
        },
        (0 until a.length()).map { i ->
          a.getJSONObject(i).let {
            CatalogDhikr(
              it.getString("id"), it.getString("arabic"),
              if (it.isNull("translation")) null else it.getString("translation"), it.getInt("repeatCount"),
            )
          }
        },
      )
    }
  } catch (e: Exception) { null }
}
```

```kotlin
// main/java/expo/modules/bayaanwidgets/StaticData.kt
package expo.modules.bayaanwidgets

import android.content.Context
import org.json.JSONArray
import java.util.TimeZone

data class StaticSurah(val id: Int, val name: String, val translatedName: String, val glyph: String, val artworkFile: String)
data class StaticAyah(val key: String, val surahId: Int, val ayah: Int, val surahName: String, val arabic: String, val translation: String)

/** surahs.json and ayat.json from assets/widgets (scripts/generate-widget-data.ts). */
object StaticData {
  @Volatile private var surahs: List<StaticSurah>? = null
  @Volatile private var ayat: List<StaticAyah>? = null

  fun parseSurahs(json: String): List<StaticSurah> = try {
    val arr = JSONArray(json)
    (0 until arr.length()).map { i ->
      arr.getJSONObject(i).let {
        StaticSurah(it.getInt("id"), it.getString("name"), it.getString("translatedName"), it.getString("glyph"), it.getString("artworkFile"))
      }
    }
  } catch (e: Exception) { emptyList() }

  fun parseAyat(json: String): List<StaticAyah> = try {
    val arr = JSONArray(json)
    (0 until arr.length()).map { i ->
      arr.getJSONObject(i).let {
        StaticAyah(it.getString("key"), it.getInt("surahId"), it.getInt("ayah"), it.getString("surahName"), it.getString("arabic"), it.getString("translation"))
      }
    }
  } catch (e: Exception) { emptyList() }

  fun surahs(context: Context): List<StaticSurah> =
    surahs ?: parseSurahs(readAsset(context, "widgets/surahs.json") ?: "[]").also { if (it.isNotEmpty()) surahs = it }

  fun surah(context: Context, id: Int): StaticSurah? {
    val list = surahs(context)
    return list.getOrNull(id - 1)?.takeIf { it.id == id } ?: list.firstOrNull { it.id == id }
  }

  fun ayat(context: Context): List<StaticAyah> =
    ayat ?: parseAyat(readAsset(context, "widgets/ayat.json") ?: "[]").also { if (it.isNotEmpty()) ayat = it }

  fun ayahOfTheDay(context: Context, nowMs: Long, tz: TimeZone): StaticAyah? {
    val list = ayat(context)
    return list.getOrNull(DayMath.ayahIndex(nowMs, tz, list.size))
  }

  private fun readAsset(context: Context, path: String): String? = try {
    context.assets.open(path).bufferedReader().use { it.readText() }
  } catch (e: Exception) { null }
}
```

```kotlin
// main/java/expo/modules/bayaanwidgets/DayMath.kt
package expo.modules.bayaanwidgets

import java.util.Calendar
import java.util.GregorianCalendar
import java.util.Locale
import java.util.TimeZone

/**
 * Day arithmetic for the widgets. Always Gregorian, whatever calendar the
 * device uses. Mirrors dayMath.ts and WidgetLogic.swift.
 */
object DayMath {
  private const val DAY_MS = 86_400_000L

  private fun calendar(nowMs: Long, tz: TimeZone): Calendar =
    GregorianCalendar(tz, Locale.US).apply { timeInMillis = nowMs }

  /** Days from 1970-01-01 to the local calendar date of nowMs in tz. */
  fun dayNumber(nowMs: Long, tz: TimeZone): Long {
    val local = calendar(nowMs, tz)
    val utc = GregorianCalendar(TimeZone.getTimeZone("UTC"), Locale.US).apply {
      clear()
      set(local.get(Calendar.YEAR), local.get(Calendar.MONTH), local.get(Calendar.DAY_OF_MONTH))
    }
    return Math.floorDiv(utc.timeInMillis, DAY_MS)
  }

  fun ayahIndex(nowMs: Long, tz: TimeZone, count: Int): Int =
    if (count <= 0) -1 else Math.floorMod(dayNumber(nowMs, tz), count.toLong()).toInt()

  fun localDayKey(nowMs: Long, tz: TimeZone): String {
    val c = calendar(nowMs, tz)
    return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))
  }

  fun nextLocalMidnightMs(nowMs: Long, tz: TimeZone): Long =
    calendar(nowMs, tz).apply {
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
      add(Calendar.DAY_OF_MONTH, 1)
    }.timeInMillis
}
```

```kotlin
// main/java/expo/modules/bayaanwidgets/TasbeehLogic.kt
package expo.modules.bayaanwidgets

import org.json.JSONArray
import org.json.JSONObject

/** One widget tap waiting for the app (PendingTasbeeh in tasbeeh.ts). */
data class PendingTasbeehEntry(val dhikrId: String, val count: Int, val day: String, val reset: Boolean)

/** Mirrors WidgetLogic.swift's tasbeeh helpers. */
object TasbeehLogic {
  fun parse(json: String?): List<PendingTasbeehEntry> = try {
    if (json == null) emptyList() else {
      val arr = JSONArray(json)
      (0 until arr.length()).mapNotNull { i ->
        val o = arr.optJSONObject(i) ?: return@mapNotNull null
        if (!o.has("dhikrId") || !o.has("count") || !o.has("day")) null
        else PendingTasbeehEntry(o.getString("dhikrId"), o.getInt("count"), o.getString("day"), o.optBoolean("reset", false))
      }
    }
  } catch (e: Exception) { emptyList() }

  fun encode(list: List<PendingTasbeehEntry>): String {
    val arr = JSONArray()
    for (p in list) {
      val o = JSONObject().put("dhikrId", p.dhikrId).put("count", p.count).put("day", p.day)
      if (p.reset) o.put("reset", true)
      arr.put(o)
    }
    return arr.toString()
  }

  /** Adds a tap (or reset), merging into the last entry for the same dhikr and day; drops older days. */
  fun append(list: List<PendingTasbeehEntry>, dhikrId: String, day: String, reset: Boolean): List<PendingTasbeehEntry> {
    val out = list.filter { it.day == day }.toMutableList()
    val last = out.lastOrNull()
    if (!reset && last != null && last.dhikrId == dhikrId && !last.reset) {
      out[out.size - 1] = last.copy(count = last.count + 1)
    } else {
      out.add(PendingTasbeehEntry(dhikrId, if (reset) 0 else 1, day, reset))
    }
    return out
  }

  /** The snapshot's count for today, then pending taps in order. */
  fun displayCount(entry: WidgetTasbeehEntry?, pending: List<PendingTasbeehEntry>, dhikrId: String, today: String): Int {
    var count = if (entry != null && entry.day == today) entry.count else 0
    for (p in pending) {
      if (p.dhikrId != dhikrId || p.day != today) continue
      count = if (p.reset) 0 else count + maxOf(0, p.count)
    }
    return count
  }

  fun progress(count: Int, target: Int): Float =
    if (target <= 0) 0f else minOf(1f, maxOf(0, count).toFloat() / target)
}
```

```kotlin
// main/java/expo/modules/bayaanwidgets/ArtworkRequests.kt
package expo.modules.bayaanwidgets

import org.json.JSONArray
import org.json.JSONObject

/** Artwork widgets wanted but did not find (artworkRequests.ts). */
data class ArtworkRequests(val surahIds: List<Int>, val reciterIds: List<String>)

/** Mirrors WidgetLogic.mergeRequests on iOS. */
object ArtworkRequestsJson {
  const val MAX_RECITERS = 50

  fun decode(json: String?): ArtworkRequests = try {
    val o = JSONObject(json ?: "{}")
    val s = o.optJSONArray("surahIds") ?: JSONArray()
    val r = o.optJSONArray("reciterIds") ?: JSONArray()
    ArtworkRequests((0 until s.length()).map { s.getInt(it) }, (0 until r.length()).map { r.getString(it) })
  } catch (e: Exception) { ArtworkRequests(emptyList(), emptyList()) }

  fun encode(r: ArtworkRequests): String =
    JSONObject().put("surahIds", JSONArray(r.surahIds)).put("reciterIds", JSONArray(r.reciterIds)).toString()

  /** Valid, unique ids; existing order kept so repeated renders do not rewrite. */
  fun merge(existing: ArtworkRequests, surahIds: List<Int>, reciterIds: List<String>): ArtworkRequests {
    val surahs = (existing.surahIds + surahIds.filter { it in 1..114 }).distinct().sorted()
    val reciters = existing.reciterIds.toMutableList()
    for (id in reciterIds) if (id.isNotEmpty() && id !in reciters) reciters.add(id)
    return ArtworkRequests(surahs, reciters.takeLast(MAX_RECITERS))
  }
}
```

```kotlin
// main/java/expo/modules/bayaanwidgets/WidgetConfig.kt
package expo.modules.bayaanwidgets

import org.json.JSONArray
import org.json.JSONObject

data class QuickSurahConfig(val surahIds: List<Int>, val reciterId: String?)
data class PinnedReciterConfig(val reciterId: String?)
data class TasbeehConfig(val dhikrId: String)

/** Per-widget configuration stored under WidgetStorage config.<appWidgetId>. */
object WidgetConfigJson {
  /** Al-Kahf, Ya-Sin, Al-Mulk, Al-Waqi'ah. */
  val QUICK_SURAH_DEFAULT_IDS = listOf(18, 36, 67, 56)
  /** سُبْحَانَ اللَّهِ وَبِحَمْدِهِ, 100 times. */
  const val DEFAULT_DHIKR_ID = "91"

  private fun parse(json: String?): JSONObject? = try { json?.let { JSONObject(it) } } catch (e: Exception) { null }

  private fun JSONObject.stringOrNull(key: String): String? =
    if (!has(key) || isNull(key)) null else optString(key).takeIf { it.isNotEmpty() }

  fun decodeQuickSurah(json: String?): QuickSurahConfig {
    val o = parse(json)
    val arr = o?.optJSONArray("surahIds")
    val ids = QUICK_SURAH_DEFAULT_IDS.indices.map { i ->
      arr?.optInt(i, 0)?.takeIf { it in 1..114 } ?: QUICK_SURAH_DEFAULT_IDS[i]
    }
    return QuickSurahConfig(ids, o?.stringOrNull("reciterId"))
  }

  fun decodePinnedReciter(json: String?): PinnedReciterConfig = PinnedReciterConfig(parse(json)?.stringOrNull("reciterId"))

  fun decodeTasbeeh(json: String?): TasbeehConfig = TasbeehConfig(parse(json)?.stringOrNull("dhikrId") ?: DEFAULT_DHIKR_ID)

  fun encode(c: QuickSurahConfig): String =
    JSONObject().put("surahIds", JSONArray(c.surahIds)).put("reciterId", c.reciterId ?: JSONObject.NULL).toString()

  fun encode(c: PinnedReciterConfig): String = JSONObject().put("reciterId", c.reciterId ?: JSONObject.NULL).toString()

  fun encode(c: TasbeehConfig): String = JSONObject().put("dhikrId", c.dhikrId).toString()
}
```

```kotlin
// main/java/expo/modules/bayaanwidgets/WidgetText.kt
package expo.modules.bayaanwidgets

/** Small text helpers, mirrored by WidgetLogic.swift. */
object WidgetText {
  fun initials(name: String): String =
    name.split(' ').filter { it.isNotBlank() }.take(2).joinToString("") { it.first().uppercase() }

  fun reference(surahName: String, key: String): String = "$surahName $key"
}
```

```kotlin
// main/java/expo/modules/bayaanwidgets/TextFit.kt
package expo.modules.bayaanwidgets

object TextFit {
  /** Largest size from maxPx down to minPx, in stepPx steps, that fits; minPx when none does. */
  fun largestFitting(maxPx: Float, minPx: Float, stepPx: Float, fits: (Float) -> Boolean): Float {
    if (stepPx <= 0f || maxPx <= minPx) return minPx
    var px = maxPx
    while (px > minPx) {
      if (fits(px)) return px
      px -= stepPx
    }
    return minPx
  }
}
```

```kotlin
// main/java/expo/modules/bayaanwidgets/pinnedreciter/PinnedReciterModel.kt
package expo.modules.bayaanwidgets.pinnedreciter

import expo.modules.bayaanwidgets.PinnedReciterConfig
import expo.modules.bayaanwidgets.WidgetCatalog
import expo.modules.bayaanwidgets.WidgetSnapshot

data class PinnedRow(val surahId: Int, val rewayatId: String?)

sealed interface PinnedReciterState {
  data class Ready(val id: String, val name: String, val artworkFile: String?, val rows: List<PinnedRow>) : PinnedReciterState
  /** Configured reciter is no longer in the catalog. */
  object Unavailable : PinnedReciterState
  /** Nothing configured and no default reciter yet. */
  object Unset : PinnedReciterState
}

/** Mirrors PinnedReciterResolver in PinnedReciterWidget.swift. */
object PinnedReciterModel {
  /** Al-Fatihah, Ya-Sin, Al-Mulk. */
  val POPULAR_SURAHS = listOf(1, 36, 67)

  fun resolve(config: PinnedReciterConfig, catalog: WidgetCatalog?, snapshot: WidgetSnapshot?): PinnedReciterState {
    val configured = config.reciterId
    val (id, name, file) = if (configured != null) {
      val r = catalog?.reciter(configured) ?: return PinnedReciterState.Unavailable
      Triple(r.id, r.name, r.artworkFile)
    } else {
      val d = snapshot?.defaultReciter ?: return PinnedReciterState.Unset
      Triple(d.id, d.name, catalog?.reciter(d.id)?.artworkFile ?: d.artworkFile)
    }
    val recents = snapshot?.reciterRecents?.get(id).orEmpty()
      .filter { it.surahId in 1..114 }.take(3).map { PinnedRow(it.surahId, it.rewayatId) }
    return PinnedReciterState.Ready(id, name, file, recents.ifEmpty { POPULAR_SURAHS.map { PinnedRow(it, null) } })
  }
}
```

- [ ] **Step 3: Run the unit tests**

Run: `cd android && ./gradlew :bayaan-widgets:testReleaseUnitTest`
Expected: PASS. The two new test classes reference only Step 2 classes; 1a's `SnapshotModelsTest` and `PlaybackStateTest` stay green.

- [ ] **Step 4: Storage additions**

Add to `WidgetStorage` (keep everything that is there):

```kotlin
  private const val KEY_CATALOG = "catalog"
  private const val KEY_ARTWORK_REQUESTS = "artworkRequests"
  private fun configKey(appWidgetId: Int) = "config.$appWidgetId"

  fun writeCatalog(context: Context, json: String) = prefs(context).edit().putString(KEY_CATALOG, json).apply()

  fun readCatalogJson(context: Context): String? = prefs(context).getString(KEY_CATALOG, null)

  fun readPendingTasbeehJson(context: Context): String? = prefs(context).getString(KEY_TASBEEH, null)

  /** Same lock as take(), so a tap cannot interleave with the app's read-and-clear. */
  @Synchronized
  fun addPendingTasbeeh(context: Context, dhikrId: String, day: String, reset: Boolean) {
    val next = TasbeehLogic.append(TasbeehLogic.parse(readPendingTasbeehJson(context)), dhikrId, day, reset)
    prefs(context).edit().putString(KEY_TASBEEH, TasbeehLogic.encode(next)).commit()
  }

  fun writeConfig(context: Context, appWidgetId: Int, json: String) =
    prefs(context).edit().putString(configKey(appWidgetId), json).apply()

  fun readConfigJson(context: Context, appWidgetId: Int): String? = prefs(context).getString(configKey(appWidgetId), null)

  fun deleteConfigs(context: Context, appWidgetIds: IntArray) {
    val edit = prefs(context).edit()
    for (id in appWidgetIds) edit.remove(configKey(id))
    edit.apply()
  }

  /** Records artwork a widget wanted but did not find; writes only when the list changes. */
  @Synchronized
  fun recordArtworkRequests(context: Context, surahIds: List<Int>, reciterIds: List<String>) {
    if (surahIds.isEmpty() && reciterIds.isEmpty()) return
    val existing = ArtworkRequestsJson.decode(prefs(context).getString(KEY_ARTWORK_REQUESTS, null))
    val merged = ArtworkRequestsJson.merge(existing, surahIds, reciterIds)
    if (merged != existing) prefs(context).edit().putString(KEY_ARTWORK_REQUESTS, ArtworkRequestsJson.encode(merged)).apply()
  }

  fun readArtworkRequestsJson(context: Context): String = prefs(context).getString(KEY_ARTWORK_REQUESTS, null) ?: "{}"
```

- [ ] **Step 5: Bitmaps and Glance state**

```kotlin
// main/java/expo/modules/bayaanwidgets/ArabicBitmap.kt
package expo.modules.bayaanwidgets

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextDirectionHeuristics
import android.text.TextPaint
import android.text.TextUtils

/**
 * Glance cannot use custom fonts, so Arabic is drawn to a bitmap with
 * StaticLayout (HarfBuzz shaping) and shown as an image.
 */
object ArabicBitmap {
  const val QURAN_FONT = "fonts/DigitalKhattFont.otf"
  const val DHIKR_FONT = "fonts/ScheherazadeNew-Regular.ttf"
  private const val STEP_PX = 2f
  private val typefaces = HashMap<String, Typeface>()

  private fun typeface(context: Context, asset: String): Typeface? = synchronized(typefaces) {
    typefaces[asset] ?: runCatching { Typeface.createFromAsset(context.assets, asset) }.getOrNull()
      ?.also { typefaces[asset] = it }
  }

  /** Shrinks from maxTextPx toward minTextPx until the text fits; ellipsizes at minTextPx. */
  fun render(
    context: Context, text: String, fontAsset: String, widthPx: Int, maxHeightPx: Int,
    maxTextPx: Float, minTextPx: Float, color: Int, center: Boolean, maxLines: Int,
  ): Bitmap? {
    if (text.isBlank() || widthPx <= 0 || maxHeightPx <= 0) return null
    val face = typeface(context, fontAsset) ?: return null
    val paint = TextPaint(TextPaint.ANTI_ALIAS_FLAG).apply {
      typeface = face
      this.color = color
    }
    val alignment = if (center) Layout.Alignment.ALIGN_CENTER else Layout.Alignment.ALIGN_NORMAL
    fun layoutAt(px: Float): StaticLayout {
      paint.textSize = px
      return StaticLayout.Builder.obtain(text, 0, text.length, paint, widthPx)
        .setAlignment(alignment)
        .setTextDirection(TextDirectionHeuristics.RTL)
        .setMaxLines(maxLines)
        .setEllipsize(TextUtils.TruncateAt.END)
        .setIncludePad(true)
        .build()
    }
    val size = TextFit.largestFitting(maxTextPx, minTextPx, STEP_PX) { px ->
      val l = layoutAt(px)
      l.height <= maxHeightPx && l.getEllipsisCount(l.lineCount - 1) == 0
    }
    val layout = layoutAt(size)
    val bmp = Bitmap.createBitmap(widthPx, layout.height.coerceIn(1, maxHeightPx), Bitmap.Config.ARGB_8888)
    bmp.density = context.resources.displayMetrics.densityDpi
    layout.draw(Canvas(bmp))
    return bmp
  }
}
```

```kotlin
// main/java/expo/modules/bayaanwidgets/RingBitmap.kt
package expo.modules.bayaanwidgets

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF

/** Tasbeeh progress ring; Glance's CircularProgressIndicator is indeterminate only. */
object RingBitmap {
  fun render(sizePx: Int, strokePx: Float, progress: Float, color: Int, trackColor: Int): Bitmap {
    val bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    val inset = strokePx / 2f
    val rect = RectF(inset, inset, sizePx - inset, sizePx - inset)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE
      strokeWidth = strokePx
      strokeCap = Paint.Cap.ROUND
    }
    paint.color = trackColor
    canvas.drawArc(rect, 0f, 360f, false, paint)
    val sweep = 360f * progress.coerceIn(0f, 1f)
    if (sweep > 0f) {
      paint.color = color
      canvas.drawArc(rect, -90f, sweep, false, paint)
    }
    return bmp
  }
}
```

```kotlin
// main/java/expo/modules/bayaanwidgets/GlanceState.kt
package expo.modules.bayaanwidgets

import android.content.Context
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.glance.GlanceId
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.state.updateAppWidgetState

/** The stored inputs a Phase 1b widget composes from. */
data class WidgetInputs(
  val snapshotJson: String?, val catalogJson: String?, val configJson: String?, val pendingTasbeehJson: String?,
)

/**
 * A live Glance session recomposes only from its own state, so each push copies
 * the stored inputs into every instance's state (the approach Continue
 * Listening uses, generalized).
 */
object GlanceState {
  private val SNAPSHOT = stringPreferencesKey("snapshot")
  private val CATALOG = stringPreferencesKey("catalog")
  private val CONFIG = stringPreferencesKey("config")
  private val PENDING_TASBEEH = stringPreferencesKey("pendingTasbeeh")
  private val PUSHED_AT = longPreferencesKey("pushedAt")

  fun appWidgetId(context: Context, id: GlanceId): Int = GlanceAppWidgetManager(context).getAppWidgetId(id)

  fun stored(context: Context, appWidgetId: Int): WidgetInputs = WidgetInputs(
    WidgetStorage.readSnapshotJson(context), WidgetStorage.readCatalogJson(context),
    WidgetStorage.readConfigJson(context, appWidgetId), WidgetStorage.readPendingTasbeehJson(context),
  )

  /** State after the first push; the stored values before it. */
  fun current(prefs: Preferences, fallback: WidgetInputs): WidgetInputs =
    if (prefs[PUSHED_AT] == null) fallback
    else WidgetInputs(prefs[SNAPSHOT], prefs[CATALOG], prefs[CONFIG], prefs[PENDING_TASBEEH])

  suspend fun push(context: Context, widget: GlanceAppWidget) {
    val manager = GlanceAppWidgetManager(context)
    for (id in manager.getGlanceIds(widget.javaClass)) {
      val inputs = stored(context, manager.getAppWidgetId(id))
      updateAppWidgetState(context, id) { prefs ->
        put(prefs, SNAPSHOT, inputs.snapshotJson)
        put(prefs, CATALOG, inputs.catalogJson)
        put(prefs, CONFIG, inputs.configJson)
        put(prefs, PENDING_TASBEEH, inputs.pendingTasbeehJson)
        prefs[PUSHED_AT] = System.currentTimeMillis()
      }
      widget.update(context, id)
    }
  }

  private fun put(prefs: MutablePreferences, key: Preferences.Key<String>, value: String?) {
    if (value != null) prefs[key] = value else prefs.remove(key)
  }
}
```

- [ ] **Step 6: Shared Glance UI, picker and drawables**

```kotlin
// main/java/expo/modules/bayaanwidgets/ui/WidgetUi.kt
package expo.modules.bayaanwidgets.ui

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.TypedValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.height
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import expo.modules.bayaanwidgets.ArabicBitmap
import expo.modules.bayaanwidgets.R
import expo.modules.bayaanwidgets.StaticSurah
import expo.modules.bayaanwidgets.WidgetCommandActivity
import expo.modules.bayaanwidgets.WidgetStorage
import expo.modules.bayaanwidgets.WidgetText
import org.json.JSONObject
import java.io.File
import kotlin.math.roundToInt

/** The Continue Listening look, shared by the Phase 1b widgets. */
object WidgetColors {
  val BACKGROUND = ColorProvider(Color(0xFF1C1C1E))
  val WHITE = ColorProvider(Color.White)
  val SECONDARY = ColorProvider(Color(0xBFFFFFFF))
  val TERTIARY = ColorProvider(Color(0x99FFFFFF))
  val TILE = ColorProvider(Color(0x26FFFFFF))
  val BUTTON = ColorProvider(Color(0x2EFFFFFF))
}

object WidgetSizes {
  val SMALL = DpSize(110.dp, 110.dp)
  val MEDIUM = DpSize(250.dp, 110.dp)
  val LARGE = DpSize(250.dp, 250.dp)
}

fun dpToPx(context: Context, dp: Int): Int =
  maxOf(1, (dp * context.resources.displayMetrics.density).roundToInt())

/** Decodes at roughly the rendered pixel size to keep RemoteViews small. */
private fun decodeArtwork(file: File, px: Int): Bitmap? {
  val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
  BitmapFactory.decodeFile(file.path, bounds)
  if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
  var sample = 1
  while (minOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= px) sample *= 2
  val bmp = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return null
  if (bmp.width <= px && bmp.height <= px) return bmp
  val scale = px.toFloat() / maxOf(bmp.width, bmp.height)
  return Bitmap.createScaledBitmap(bmp, maxOf(1, (bmp.width * scale).roundToInt()), maxOf(1, (bmp.height * scale).roundToInt()), true)
}

/** A cached artwork file at about sizeDp, or null when it is not cached yet. */
fun loadArtwork(context: Context, file: String?, sizeDp: Int): Bitmap? =
  file?.let { File(WidgetStorage.artworkDir(context), it) }?.takeIf { it.exists() }
    ?.let { decodeArtwork(it, dpToPx(context, sizeDp)) }

fun deepLink(context: Context, url: String): Action =
  actionStartActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).setPackage(context.packageName))

/** Routes a command through WidgetCommandActivity; key keeps PendingIntents distinct. */
fun commandAction(context: Context, command: JSONObject, key: String): Action =
  actionStartActivity(WidgetCommandActivity.intent(context, command).setData(Uri.parse("bayaan-widget://$key")))

fun playTrackCommand(surahId: Int, reciterId: String?, rewayatId: String?, ayah: Int?): JSONObject =
  JSONObject().put("type", "playTrack").put("surahId", surahId)
    .put("reciterId", reciterId ?: JSONObject.NULL)
    .put("rewayatId", rewayatId ?: JSONObject.NULL)
    .put("ayah", ayah ?: JSONObject.NULL)

fun playReciterCommand(reciterId: String): JSONObject =
  JSONObject().put("type", "playReciter").put("reciterId", reciterId)

@Composable
fun Logo(height: Int) {
  Image(
    ImageProvider(R.drawable.bayaan_mark), contentDescription = null,
    modifier = GlanceModifier.width((height * 6 / 5).dp).height(height.dp),
  )
}

/** Round 30 dp button matching Continue Listening's play button. */
@Composable
fun RoundButton(icon: Int, description: String, action: Action) {
  Box(
    GlanceModifier.size(30.dp).background(WidgetColors.BUTTON).cornerRadius(15.dp).clickable(action),
    contentAlignment = Alignment.Center,
  ) {
    Image(ImageProvider(icon), contentDescription = description, modifier = GlanceModifier.size(18.dp))
  }
}

/** The surah card when cached, else a dark tile with the number and name (and a cache request). */
@Composable
fun SurahCard(context: Context, surah: StaticSurah?, sizeDp: Int) {
  val bmp = surah?.let { loadArtwork(context, it.artworkFile, sizeDp) }
  val corner = (sizeDp / 6).dp
  if (surah != null && bmp != null) {
    Image(
      ImageProvider(bmp), contentDescription = surah.name,
      modifier = GlanceModifier.size(sizeDp.dp).cornerRadius(corner), contentScale = ContentScale.Crop,
    )
    return
  }
  if (surah != null) WidgetStorage.recordArtworkRequests(context, listOf(surah.id), emptyList())
  Column(
    GlanceModifier.size(sizeDp.dp).background(WidgetColors.TILE).cornerRadius(corner),
    horizontalAlignment = Alignment.CenterHorizontally, verticalAlignment = Alignment.CenterVertically,
  ) {
    Text(surah?.id?.toString() ?: "", style = TextStyle(color = WidgetColors.WHITE, fontSize = (sizeDp / 3).sp, fontWeight = FontWeight.Bold))
    if (surah != null && sizeDp >= 44) {
      Text(surah.name, maxLines = 1, style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 9.sp, textAlign = TextAlign.Center))
    }
  }
}

/** The reciter photo when cached, else initials on a dark tile (and a cache request). */
@Composable
fun ReciterPhoto(context: Context, reciterId: String, file: String?, name: String, widthDp: Int, heightDp: Int, cornerDp: Int) {
  val bmp = loadArtwork(context, file, maxOf(widthDp, heightDp))
  val modifier = GlanceModifier.width(widthDp.dp).height(heightDp.dp).cornerRadius(cornerDp.dp)
  if (bmp != null) {
    Image(ImageProvider(bmp), contentDescription = name, modifier = modifier, contentScale = ContentScale.Crop)
    return
  }
  WidgetStorage.recordArtworkRequests(context, emptyList(), listOf(reciterId))
  Box(modifier.background(WidgetColors.TILE), contentAlignment = Alignment.Center) {
    Text(WidgetText.initials(name), style = TextStyle(color = WidgetColors.WHITE, fontSize = 20.sp, fontWeight = FontWeight.Bold))
  }
}

/** Arabic text drawn to a bitmap (Glance has no custom fonts). */
@Composable
fun ArabicText(
  context: Context, text: String, font: String, widthDp: Float, maxHeightDp: Float,
  maxSp: Float, minSp: Float, maxLines: Int, center: Boolean,
) {
  val metrics = context.resources.displayMetrics
  val widthPx = (widthDp * metrics.density).roundToInt()
  val heightPx = (maxHeightDp * metrics.density).roundToInt()
  val bmp = remember(text, font, widthPx, heightPx, maxSp, minSp, maxLines, center) {
    ArabicBitmap.render(
      context, text, font, widthPx, heightPx,
      TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, maxSp, metrics),
      TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, minSp, metrics),
      android.graphics.Color.WHITE, center, maxLines,
    )
  } ?: return
  Image(
    ImageProvider(bmp), contentDescription = text,
    modifier = GlanceModifier.width(widthDp.dp).height((bmp.height / metrics.density).dp),
    contentScale = ContentScale.Fit,
  )
}
```

```kotlin
// main/java/expo/modules/bayaanwidgets/ui/ConfigPicker.kt
package expo.modules.bayaanwidgets.ui

import android.app.Activity
import android.app.AlertDialog

/** Plain dialogs for the widget configuration activities. */
object ConfigPicker {
  private const val THEME = android.R.style.Theme_DeviceDefault_Dialog_Alert

  /** A list of settings rows with a Done button. */
  fun menu(activity: Activity, title: String, rows: List<String>, onPick: (Int) -> Unit, onDone: () -> Unit, onCancel: () -> Unit) {
    AlertDialog.Builder(activity, THEME)
      .setTitle(title)
      .setItems(rows.toTypedArray()) { _, which -> onPick(which) }
      .setPositiveButton("Done") { _, _ -> onDone() }
      .setOnCancelListener { onCancel() }
      .show()
  }

  fun pick(activity: Activity, title: String, items: List<String>, onPick: (Int) -> Unit, onCancel: () -> Unit) {
    AlertDialog.Builder(activity, THEME)
      .setTitle(title)
      .setItems(items.toTypedArray()) { _, which -> onPick(which) }
      .setOnCancelListener { onCancel() }
      .show()
  }
}
```

`main/res/drawable/widget_scrim.xml` (legibility scrim under the reciter name; Glance has no gradients):

```xml
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <gradient android:angle="90" android:startColor="#B3000000" android:centerColor="#33000000" android:endColor="#00000000" />
</shape>
```

`main/res/drawable/widget_reset.xml` (Material "refresh" glyph, white):

```xml
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#FFFFFFFF"
    android:pathData="M17.65,6.35C16.2,4.9 14.21,4 12,4c-4.42,0 -7.99,3.58 -7.99,8s3.57,8 7.99,8c3.73,0 6.84,-2.55 7.73,-6h-2.08c-0.82,2.33 -3.04,4 -5.65,4 -3.31,0 -6,-2.69 -6,-6s2.69,-6 6,-6c1.66,0 3.14,0.69 4.22,1.78L13,11h7V4l-2.35,2.35z" />
</vector>
```

- [ ] **Step 7: Module functions**

In `BayaanWidgetsModule.kt` add, inside `definition()` after `takePendingTasbeeh`:

```kotlin
    Function("writeCatalog") { json: String -> WidgetStorage.writeCatalog(context, json) }
    Function("readArtworkRequests") { WidgetStorage.readArtworkRequestsJson(context) }
```

and below `updateContinueListening()`:

```kotlin
  /** Pushes stored inputs into every instance of a Phase 1b widget. */
  private fun push(widget: GlanceAppWidget) {
    val ctx = context
    CoroutineScope(Dispatchers.Default).launch { runCatching { GlanceState.push(ctx, widget) } }
  }
```

with `import androidx.glance.appwidget.GlanceAppWidget`. Tasks 6 to 10 add one `when` branch each to `reloadWidgets`.

- [ ] **Step 8: Test and build**

```bash
npm run sync:widget-fonts
cd android && ./gradlew :bayaan-widgets:testReleaseUnitTest && ./gradlew :app:assembleRelease
```
Expected: all module unit tests PASS (new and 1a); release build succeeds (unused-function warning for `push` is fine).

- [ ] **Step 9: Commit**

```bash
git add modules/bayaan-widgets/android
git commit -m "feat(widgets): add the Android support layer for configurable widgets"
```

---
### Task 5: JS glue (catalog, requested artwork, tasbeeh consumption)

`syncWidgets.ts` and its tests stay untouched; the new behavior lives in `syncConfiguredWidgets.ts`, started next to `startWidgetSync`.

**Files:**
- Create: `services/widgets/buildCatalog.ts`, `services/widgets/syncConfiguredWidgets.ts`, `services/widgets/__tests__/buildCatalog.test.ts`, `services/widgets/__tests__/syncConfiguredWidgets.test.ts`
- Modify: `services/widgets/collectSnapshotInput.ts` (tasbeeh entries), `app/_layout.tsx` (start the new sync)

**Interfaces:**
- Consumes: Task 1 API (`writeCatalog`, `readArtworkRequests`, `planTasbeehOps`, `localDayKey`, `takePendingTasbeeh`, `cacheArtwork`, `hasArtwork`, `reloadWidgets`, `isWidgetsAvailable`); `flushWidgetSnapshot()` from `syncWidgets.ts`; `artworkFileName`, `surahArtworkFileName`, `surahArtworkUrl` from `buildSnapshot.ts`; `useAdhkarStore` (`dhikrCounts`, `incrementCount`, `resetCount`); `RECITERS`.
- Produces: `DEFAULT_TASBEEH_DHIKR_ID = '91'`; `tasbeehDisplayText(arabic: string): string | null`; `tasbeehTranslation(translation: string | null): string | null`; `seedAdhkar(seed: unknown): SeedDhikr[]`; `tasbeehAdhkar(seed: SeedDhikr[]): WidgetCatalogDhikr[]`; `TASBEEH_ADHKAR`; `buildCatalog(reciters: Reciter[], adhkar: WidgetCatalogDhikr[]): WidgetCatalog`; `buildTasbeehEntries(adhkar, counts: Record<string, number>, day: string): Record<string, WidgetTasbeehEntry>`; `ALWAYS_CACHED_SURAHS`; `configuredArtworkJobs(requests, isCached, reciterArtworkUrl): Map<string, string>`; `ensureConfiguredArtwork(): Promise<boolean>`; `syncCatalog(): void`; `consumeTasbeehIncrements(now?: Date): Promise<void>`; `startConfiguredWidgetSync(): () => void`.

- [ ] **Step 1: Write the failing tests**

```ts
// services/widgets/__tests__/buildCatalog.test.ts
import {isWidgetCatalog} from 'bayaan-widgets';
import type {Reciter} from '@/data/reciterData';
import {
  buildCatalog,
  buildTasbeehEntries,
  DEFAULT_TASBEEH_DHIKR_ID,
  seedAdhkar,
  tasbeehAdhkar,
  tasbeehDisplayText,
  tasbeehTranslation,
  TASBEEH_ADHKAR,
} from '../buildCatalog';

function reciter(id: string, name: string): Reciter {
  return {id, name, date: null, image_url: null, rewayat: []};
}

describe('tasbeehDisplayText', () => {
  it('keeps the dhikr inside the double brackets without counts', () => {
    expect(tasbeehDisplayText('((سُبْحَانَ اللَّهِ وَبِحَمْدِهِ)) (مائة مرَّةٍ).')).toBe(
      'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
    );
    expect(
      tasbeehDisplayText('((سُبْحَانَ اللَّهِ، وَاللَّهُ أَكْبَرُ (ثلاثاً وثلاثين) لاَ إِلَهَ إِلاَّ اللَّهُ))'),
    ).toBe('سُبْحَانَ اللَّهِ، وَاللَّهُ أَكْبَرُ لاَ إِلَهَ إِلاَّ اللَّهُ');
  });

  it('rejects narrations that do not start with the dhikr', () => {
    expect(tasbeehDisplayText('قَالَ صلى الله عليه وسلم مَنْ قَالَ: سُبْحَانَ اللَّهِ')).toBeNull();
    expect(tasbeehDisplayText('(بسم الله الرحمن الرحيم)')).toBeNull();
  });
});

describe('tasbeehTranslation', () => {
  it('drops wrapping brackets, counts and edge quotes', () => {
    expect(tasbeehTranslation('(How perfect Allah is and I praise Him.)(one hundred times)')).toBe(
      'How perfect Allah is and I praise Him.',
    );
    expect(tasbeehTranslation('(How perfect my Lord is, The Supreme.’(three times))')).toBe(
      'How perfect my Lord is, The Supreme.',
    );
    expect(
      tasbeehTranslation('‘I seek Allaah’s forgiveness and I turn to Him in repentance.’ [one hundred times a day]'),
    ).toBe('I seek Allaah’s forgiveness and I turn to Him in repentance.');
    expect(tasbeehTranslation(null)).toBeNull();
  });
});

describe('tasbeeh adhkar', () => {
  it('picks the 13 repeatable adhkar from the seed', () => {
    expect(TASBEEH_ADHKAR.map(d => d.id)).toEqual([
      '86', '87', '91', '92', '93', '94', '96', '97', '98', '33', '41', '69', '72',
    ]);
    expect(TASBEEH_ADHKAR.find(d => d.id === DEFAULT_TASBEEH_DHIKR_ID)).toEqual({
      id: '91',
      arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
      translation: 'How perfect Allah is and I praise Him.',
      repeatCount: 100,
    });
    TASBEEH_ADHKAR.forEach(d => expect(d.arabic.length).toBeLessThanOrEqual(180));
  });

  it('ignores malformed seed rows and single repeats', () => {
    expect(seedAdhkar({adhkar: [{id: 1}, 'x']})).toEqual([]);
    expect(seedAdhkar(null)).toEqual([]);
    expect(
      tasbeehAdhkar([{id: 'a', arabic: '((ذكر))', translation: null, repeat_count: 1}]),
    ).toEqual([]);
  });
});

describe('buildCatalog', () => {
  it('lists reciters by name with artwork file names and skips the placeholder', () => {
    const catalog = buildCatalog(
      [reciter('r2', 'Sudais'), reciter('', ''), reciter('r1', 'Alafasi')],
      TASBEEH_ADHKAR,
    );
    expect(isWidgetCatalog(catalog)).toBe(true);
    expect(catalog.reciters).toEqual([
      {id: 'r1', name: 'Alafasi', artworkFile: 'reciter-r1.jpg'},
      {id: 'r2', name: 'Sudais', artworkFile: 'reciter-r2.jpg'},
    ]);
    expect(catalog.adhkar).toBe(TASBEEH_ADHKAR);
  });
});

describe('buildTasbeehEntries', () => {
  it('gives every tasbeeh dhikr today’s count and its target', () => {
    const entries = buildTasbeehEntries(TASBEEH_ADHKAR.slice(0, 3), {'91': 12}, '2026-10-10');
    expect(entries).toEqual({
      '86': {count: 0, target: 3, day: '2026-10-10'},
      '87': {count: 0, target: 3, day: '2026-10-10'},
      '91': {count: 12, target: 100, day: '2026-10-10'},
    });
  });
});
```

```ts
// services/widgets/__tests__/syncConfiguredWidgets.test.ts
import type {PendingTasbeeh, WidgetArtworkRequests} from 'bayaan-widgets';
import type {Reciter} from '@/data/reciterData';

const mockWriteCatalog = jest.fn();
const mockReloadWidgets = jest.fn();
const mockCacheArtwork = jest.fn<Promise<boolean>, [string, string]>();
const mockCached = new Set<string>();
let mockRequests: WidgetArtworkRequests = {surahIds: [], reciterIds: []};
let mockPending: PendingTasbeeh[] = [];
const mockFlush = jest.fn();
const mockIncrement = jest.fn<Promise<number>, [string]>();
const mockReset = jest.fn<Promise<void>, [string]>();
const mockReciters: Reciter[] = [];
const mockUnsubs: jest.Mock[] = [];
const mockAppStateRemove = jest.fn();

function mockSubscribe(): jest.Mock {
  const unsub = jest.fn();
  mockUnsubs.push(unsub);
  return unsub;
}

jest.mock('bayaan-widgets', () => ({
  ...jest.requireActual('bayaan-widgets'),
  isWidgetsAvailable: () => true,
  writeCatalog: (c: unknown) => mockWriteCatalog(c),
  reloadWidgets: (k: unknown) => mockReloadWidgets(k),
  cacheArtwork: (u: string, f: string) => mockCacheArtwork(u, f),
  hasArtwork: (f: string) => mockCached.has(f),
  readArtworkRequests: () => mockRequests,
  takePendingTasbeeh: () => {
    const p = mockPending;
    mockPending = [];
    return p;
  },
}));
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const appState = {addEventListener: () => ({remove: mockAppStateRemove})};
  return new Proxy(actual, {
    get: (target, prop) => (prop === 'AppState' ? appState : target[prop]),
  });
});
jest.mock('@/data/reciterData', () => ({RECITERS: mockReciters}));
jest.mock('@/store/adhkarStore', () => ({
  useAdhkarStore: {
    getState: () => ({incrementCount: mockIncrement, resetCount: mockReset}),
    subscribe: () => mockSubscribe(),
  },
}));
jest.mock('@/store/reciterStore', () => ({
  useReciterStore: {subscribe: () => mockSubscribe()},
}));
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: (id: string) => mockReciters.find(r => r.id === id),
}));
jest.mock('@/utils/artworkUtils', () => ({
  getReciterArtwork: (r: Reciter) => r.image_url ?? 'data:image/png;base64,x',
}));
jest.mock('../syncWidgets', () => ({flushWidgetSnapshot: () => mockFlush()}));

type SyncModule = typeof import('../syncConfiguredWidgets');

function loadModule(): SyncModule {
  let mod: SyncModule | null = null;
  jest.isolateModules(() => {
    mod = require('../syncConfiguredWidgets');
  });
  if (!mod) throw new Error('module failed to load');
  return mod;
}

function reciter(id: string, imageUrl: string | null): Reciter {
  return {id, name: id.toUpperCase(), date: null, image_url: imageUrl, rewayat: []};
}

beforeEach(() => {
  mockWriteCatalog.mockReset();
  mockReloadWidgets.mockReset();
  mockCacheArtwork.mockReset();
  mockCacheArtwork.mockResolvedValue(true);
  mockCached.clear();
  mockRequests = {surahIds: [], reciterIds: []};
  mockPending = [];
  mockFlush.mockReset();
  mockIncrement.mockReset();
  mockIncrement.mockResolvedValue(1);
  mockReset.mockReset();
  mockReset.mockResolvedValue(undefined);
  mockReciters.length = 0;
  mockUnsubs.length = 0;
  mockAppStateRemove.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('configuredArtworkJobs', () => {
  it('always includes the default cards and skips cached files', () => {
    const {configuredArtworkJobs} = loadModule();
    mockCached.add('surah-1.jpg');
    const jobs = configuredArtworkJobs({surahIds: [], reciterIds: []}, f => mockCached.has(f), () => null);
    expect([...jobs.keys()]).toEqual(['surah-18.jpg', 'surah-36.jpg', 'surah-56.jpg', 'surah-67.jpg']);
    expect(jobs.get('surah-18.jpg')).toBe('https://cdn.thebayaan.com/assets/car/surah/18.png');
  });

  it('adds requested cards and reciter photos that have a URL', () => {
    const {configuredArtworkJobs} = loadModule();
    const jobs = configuredArtworkJobs(
      {surahIds: [55, 18], reciterIds: ['r1', 'r2']},
      () => false,
      id => (id === 'r1' ? 'https://x/r1.jpg' : null),
    );
    expect(jobs.get('surah-55.jpg')).toBe('https://cdn.thebayaan.com/assets/car/surah/55.png');
    expect(jobs.get('reciter-r1.jpg')).toBe('https://x/r1.jpg');
    expect(jobs.has('reciter-r2.jpg')).toBe(false);
    expect(jobs.size).toBe(7);
  });
});

describe('syncCatalog', () => {
  it('writes and reloads only when the catalog changes', () => {
    const sync = loadModule();
    mockReciters.push(reciter('r1', null));
    sync.syncCatalog();
    sync.syncCatalog();
    expect(mockWriteCatalog).toHaveBeenCalledTimes(1);
    expect(mockReloadWidgets).toHaveBeenCalledWith(['QuickSurah', 'PinnedReciter', 'Tasbeeh']);
    mockReciters.push(reciter('r2', null));
    sync.syncCatalog();
    expect(mockWriteCatalog).toHaveBeenCalledTimes(2);
  });
});

describe('ensureConfiguredArtwork', () => {
  it('caches requested files and reloads the artwork widgets once', async () => {
    const sync = loadModule();
    ['surah-1.jpg', 'surah-18.jpg', 'surah-36.jpg', 'surah-56.jpg', 'surah-67.jpg'].forEach(f => mockCached.add(f));
    mockReciters.push(reciter('r1', 'https://x/r1.jpg'));
    mockRequests = {surahIds: [55], reciterIds: ['r1']};
    await expect(sync.ensureConfiguredArtwork()).resolves.toBe(true);
    expect(mockCacheArtwork).toHaveBeenCalledWith('https://cdn.thebayaan.com/assets/car/surah/55.png', 'surah-55.jpg');
    expect(mockCacheArtwork).toHaveBeenCalledWith('https://x/r1.jpg', 'reciter-r1.jpg');
    expect(mockReloadWidgets).toHaveBeenCalledTimes(1);
    expect(mockReloadWidgets).toHaveBeenCalledWith(['QuickSurah', 'PinnedReciter', 'ContinueReading']);
  });

  it('does not reload or retry within the window when downloads fail', async () => {
    const sync = loadModule();
    mockCacheArtwork.mockResolvedValue(false);
    await expect(sync.ensureConfiguredArtwork()).resolves.toBe(false);
    const calls = mockCacheArtwork.mock.calls.length;
    await sync.ensureConfiguredArtwork();
    expect(mockCacheArtwork.mock.calls.length).toBe(calls);
    expect(mockReloadWidgets).not.toHaveBeenCalled();
  });
});

describe('consumeTasbeehIncrements', () => {
  it('applies a reset, then later taps, for today only, and flushes once', async () => {
    const sync = loadModule();
    mockPending = [
      {dhikrId: '91', count: 3, day: '2026-10-10'},
      {dhikrId: '91', count: 0, day: '2026-10-10', reset: true},
      {dhikrId: '91', count: 2, day: '2026-10-10'},
      {dhikrId: '96', count: 5, day: '2026-10-09'},
    ];
    await sync.consumeTasbeehIncrements(new Date(2026, 9, 10, 12));
    expect(mockReset).toHaveBeenCalledWith('91');
    expect(mockIncrement).toHaveBeenCalledTimes(2);
    expect(mockIncrement).not.toHaveBeenCalledWith('96');
    expect(mockReset.mock.invocationCallOrder[0]).toBeLessThan(mockIncrement.mock.invocationCallOrder[0]);
    expect(mockFlush).toHaveBeenCalledTimes(1);
  });

  it('does nothing when nothing is pending', async () => {
    const sync = loadModule();
    await sync.consumeTasbeehIncrements(new Date(2026, 9, 10, 12));
    expect(mockFlush).not.toHaveBeenCalled();
  });
});

describe('startConfiguredWidgetSync', () => {
  it('runs a first sync and removes its listeners on cleanup', async () => {
    const sync = loadModule();
    const stop = sync.startConfiguredWidgetSync();
    await new Promise(resolve => setImmediate(resolve));
    expect(mockWriteCatalog).toHaveBeenCalledTimes(1);
    stop();
    expect(mockUnsubs).toHaveLength(2);
    mockUnsubs.forEach(u => expect(u).toHaveBeenCalled());
    expect(mockAppStateRemove).toHaveBeenCalled();
  });
});
```

The `ensureConfiguredArtwork` download-failure case relies on the same 10 minute retry window as 1a's `syncWidgets`.

- [ ] **Step 2: Run to verify failure**

Run: `npx jest services/widgets/__tests__/buildCatalog.test.ts services/widgets/__tests__/syncConfiguredWidgets.test.ts`
Expected: FAIL, cannot find modules `../buildCatalog` and `../syncConfiguredWidgets`.

- [ ] **Step 3: Implement the catalog builder**

```ts
// services/widgets/buildCatalog.ts
import type {Reciter} from '@/data/reciterData';
import adhkarSeed from '@/data/adhkar.json';
import {
  WIDGET_CATALOG_VERSION,
  WidgetCatalog,
  WidgetCatalogDhikr,
  WidgetTasbeehEntry,
} from 'bayaan-widgets';
import {artworkFileName} from './buildSnapshot';

// سُبْحَانَ اللَّهِ وَبِحَمْدِهِ (100 times); the seed has no plain SubhanAllah with a count.
export const DEFAULT_TASBEEH_DHIKR_ID = '91';
const MAX_DHIKR_CHARS = 180;

export interface SeedDhikr {
  id: string;
  arabic: string;
  translation: string | null;
  repeat_count: number;
}

function isSeedDhikr(value: unknown): value is SeedDhikr {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'arabic' in value &&
    typeof value.arabic === 'string' &&
    'translation' in value &&
    (value.translation === null || typeof value.translation === 'string') &&
    'repeat_count' in value &&
    typeof value.repeat_count === 'number'
  );
}

export function seedAdhkar(seed: unknown): SeedDhikr[] {
  if (
    typeof seed !== 'object' ||
    seed === null ||
    !('adhkar' in seed) ||
    !Array.isArray(seed.adhkar)
  ) {
    return [];
  }
  const rows: unknown[] = seed.adhkar;
  return rows.filter(isSeedDhikr);
}

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

export function tasbeehAdhkar(seed: SeedDhikr[]): WidgetCatalogDhikr[] {
  const out: WidgetCatalogDhikr[] = [];
  for (const d of seed) {
    if (d.repeat_count <= 1) continue;
    const arabic = tasbeehDisplayText(d.arabic);
    if (!arabic || arabic.length > MAX_DHIKR_CHARS) continue;
    out.push({
      id: d.id,
      arabic,
      translation: tasbeehTranslation(d.translation),
      repeatCount: d.repeat_count,
    });
  }
  return out;
}

export const TASBEEH_ADHKAR: WidgetCatalogDhikr[] = tasbeehAdhkar(
  seedAdhkar(adhkarSeed),
);

export function buildCatalog(
  reciters: Reciter[],
  adhkar: WidgetCatalogDhikr[],
): WidgetCatalog {
  return {
    version: WIDGET_CATALOG_VERSION,
    reciters: reciters
      .filter(r => r.id !== '')
      .map(r => ({id: r.id, name: r.name, artworkFile: artworkFileName(r.id)}))
      .sort((a, b) => a.name.localeCompare(b.name)),
    adhkar,
  };
}

export function buildTasbeehEntries(
  adhkar: WidgetCatalogDhikr[],
  counts: Record<string, number>,
  day: string,
): Record<string, WidgetTasbeehEntry> {
  const entries: Record<string, WidgetTasbeehEntry> = {};
  for (const d of adhkar) {
    entries[d.id] = {count: counts[d.id] ?? 0, target: d.repeatCount, day};
  }
  return entries;
}
```

- [ ] **Step 4: Implement the configured-widget sync**

```ts
// services/widgets/syncConfiguredWidgets.ts
import {AppState} from 'react-native';
import {
  cacheArtwork,
  hasArtwork,
  isWidgetsAvailable,
  localDayKey,
  planTasbeehOps,
  readArtworkRequests,
  reloadWidgets,
  takePendingTasbeeh,
  writeCatalog,
  WidgetArtworkRequests,
  WidgetKind,
} from 'bayaan-widgets';
import {RECITERS} from '@/data/reciterData';
import {useAdhkarStore} from '@/store/adhkarStore';
import {useReciterStore} from '@/store/reciterStore';
import {getReciterByIdSync} from '@/services/dataService';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {
  artworkFileName,
  surahArtworkFileName,
  surahArtworkUrl,
} from './buildSnapshot';
import {buildCatalog, TASBEEH_ADHKAR} from './buildCatalog';
import {flushWidgetSnapshot} from './syncWidgets';

// Quick Surah defaults, Pinned Reciter's popular rows, Continue Reading's empty state.
export const ALWAYS_CACHED_SURAHS: readonly number[] = [1, 18, 36, 56, 67];
const CATALOG_KINDS: WidgetKind[] = ['QuickSurah', 'PinnedReciter', 'Tasbeeh'];
// Widgets showing artwork that the snapshot does not reference.
const ARTWORK_KINDS: WidgetKind[] = [
  'QuickSurah',
  'PinnedReciter',
  'ContinueReading',
];
const ARTWORK_RETRY_MS = 10 * 60 * 1000;

let lastCatalogJson: string | null = null;
let consuming = false;
const artworkFailures = new Map<string, number>();
const artworkInFlight = new Set<string>();

export function configuredArtworkJobs(
  requests: WidgetArtworkRequests,
  isCached: (file: string) => boolean,
  reciterArtworkUrl: (reciterId: string) => string | null,
): Map<string, string> {
  const jobs = new Map<string, string>();
  for (const id of new Set([...ALWAYS_CACHED_SURAHS, ...requests.surahIds])) {
    const file = surahArtworkFileName(id);
    if (!isCached(file)) jobs.set(file, surahArtworkUrl(id));
  }
  for (const id of requests.reciterIds) {
    const file = artworkFileName(id);
    if (isCached(file)) continue;
    const url = reciterArtworkUrl(id);
    if (url) jobs.set(file, url);
  }
  return jobs;
}

function reciterArtworkUrl(reciterId: string): string | null {
  const reciter = getReciterByIdSync(reciterId);
  if (!reciter) return null;
  const url = getReciterArtwork(reciter);
  return url.startsWith('data:') ? null : url;
}

export async function ensureConfiguredArtwork(): Promise<boolean> {
  let added = false;
  const jobs = configuredArtworkJobs(
    readArtworkRequests(),
    hasArtwork,
    reciterArtworkUrl,
  );
  for (const [file, url] of jobs) {
    const failedAt = artworkFailures.get(url);
    if (failedAt !== undefined && Date.now() - failedAt < ARTWORK_RETRY_MS) {
      continue;
    }
    if (artworkInFlight.has(url)) continue;
    artworkInFlight.add(url);
    try {
      if (await cacheArtwork(url, file)) {
        artworkFailures.delete(url);
        added = true;
      } else {
        artworkFailures.set(url, Date.now());
      }
    } catch (error) {
      artworkFailures.set(url, Date.now());
      console.error('[WidgetSync] Failed to cache configured artwork:', error);
    } finally {
      artworkInFlight.delete(url);
    }
  }
  if (added) reloadWidgets(ARTWORK_KINDS);
  return added;
}

export function syncCatalog(): void {
  try {
    const catalog = buildCatalog(RECITERS, TASBEEH_ADHKAR);
    const json = JSON.stringify(catalog);
    if (json === lastCatalogJson) return;
    writeCatalog(catalog);
    reloadWidgets(CATALOG_KINDS);
    lastCatalogJson = json;
  } catch (error) {
    console.error('[WidgetSync] Failed to write the widget catalog:', error);
  }
}

// Applies Tasbeeh taps made on the widget. One flush at the end instead of
// one per increment.
export async function consumeTasbeehIncrements(
  now: Date = new Date(),
): Promise<void> {
  if (consuming) return;
  consuming = true;
  let applied = false;
  try {
    const ops = planTasbeehOps(takePendingTasbeeh(), localDayKey(now));
    const store = useAdhkarStore.getState();
    for (const [dhikrId, op] of Object.entries(ops)) {
      if (op.reset) {
        await store.resetCount(dhikrId);
        applied = true;
      }
      for (let i = 0; i < op.increments; i++) {
        await store.incrementCount(dhikrId);
        applied = true;
      }
    }
  } catch (error) {
    console.error('[WidgetSync] Failed to apply widget tasbeeh taps:', error);
  } finally {
    consuming = false;
  }
  if (applied) flushWidgetSnapshot();
}

function refresh(): void {
  syncCatalog();
  void consumeTasbeehIncrements();
  ensureConfiguredArtwork().catch(error => {
    console.error('[WidgetSync] Configured artwork sync failed:', error);
  });
}

// Started by the root layout next to startWidgetSync.
export function startConfiguredWidgetSync(): () => void {
  if (!isWidgetsAvailable()) return () => undefined;
  refresh();
  const unsubs = [
    // RECITERS is filled in place; the default reciter refresh follows a load.
    useReciterStore.subscribe(() => syncCatalog()),
    useAdhkarStore.subscribe((state, prev) => {
      if (!consuming && state.dhikrCounts !== prev.dhikrCounts) {
        flushWidgetSnapshot();
      }
    }),
  ];
  const appState = AppState.addEventListener('change', state => {
    if (state === 'active') refresh();
  });
  return () => {
    unsubs.forEach(u => u());
    appState.remove();
  };
}
```

- [ ] **Step 5: Fill the snapshot's tasbeeh slice**

In `services/widgets/collectSnapshotInput.ts`:

1. Add imports:

```ts
import {useAdhkarStore} from '@/store/adhkarStore';
import {buildTasbeehEntries, TASBEEH_ADHKAR} from './buildCatalog';
```

and change `import {hasArtwork} from 'bayaan-widgets';` to `import {hasArtwork, localDayKey} from 'bayaan-widgets';`.

2. Replace the line `tasbeeh: {}, // filled in Plan 1b` with:

```ts
    tasbeeh: buildTasbeehEntries(
      TASBEEH_ADHKAR,
      useAdhkarStore.getState().dhikrCounts,
      localDayKey(now),
    ),
```

- [ ] **Step 6: Start it from the root layout**

In `app/_layout.tsx`, add after the `startWidgetSync` import:

```ts
import {startConfiguredWidgetSync} from '@/services/widgets/syncConfiguredWidgets';
```

and replace the widget effect:

```tsx
  // Start after init so the first snapshot sees the restored session and
  // stores instead of overwriting the widgets with an empty state.
  useEffect(() => {
    if (!appIsReady) return;
    const stopSnapshot = startWidgetSync();
    const stopConfigured = startConfiguredWidgetSync();
    return () => {
      stopSnapshot();
      stopConfigured();
    };
  }, [appIsReady]);
```

- [ ] **Step 7: Run tests and typecheck**

```bash
npx jest services/widgets modules/bayaan-widgets
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
```
Expected: all PASS, including 1a's untouched `syncWidgets`, `buildSnapshot`, `handleWidgetCommand` and `defaultDeps` suites; no type errors.

- [ ] **Step 8: Commit**

```bash
npx prettier --write services/widgets/buildCatalog.ts services/widgets/syncConfiguredWidgets.ts services/widgets/collectSnapshotInput.ts services/widgets/__tests__/buildCatalog.test.ts services/widgets/__tests__/syncConfiguredWidgets.test.ts app/_layout.tsx
git add services/widgets app/_layout.tsx
git commit -m "feat(widgets): sync the widget catalog, requested artwork and tasbeeh taps"
```

---
### Task 6: Quick Surah (iOS and Android)

Small: one surah, any tap plays it. Medium: a 2x2 grid of four surahs (defaults Al-Kahf, Ya-Sin, Al-Mulk, Al-Waqi'ah), each tile plays its surah. Reciter optional; unset means the default reciter at play time (`reciterId: null`).

**Files:**
- Create: `targets/widgets/QuickSurah/QuickSurahWidget.swift`; `modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/quicksurah/QuickSurahWidget.kt`, `QuickSurahReceiver.kt`, `QuickSurahConfigActivity.kt`; `modules/bayaan-widgets/android/src/main/res/xml/quick_surah_info.xml`
- Modify: `targets/widgets/WidgetsBundle.swift`, `modules/bayaan-widgets/android/src/main/AndroidManifest.xml`, `modules/bayaan-widgets/android/src/main/res/values/strings.xml`, `BayaanWidgetsModule.kt` (`reloadWidgets` branch)

**Interfaces:**
- Consumes: Task 2 `PlayTrackIntent`; Task 3 `SurahEntity`, `ReciterEntity`, `StaticData`, `CatalogStore`, `ArtworkRequestStore.recordMissing`, `SurahCard`, `ReciterPhoto`, `RoundGlyph`, `WidgetPalette`, `BayaanLogo`; Task 4 `GlanceState`, `WidgetConfigJson`, `QuickSurahConfig`, `CatalogModels`, `StaticData`, `ui.*`, `ConfigPicker`.
- Produces: iOS widget kind `QuickSurah` (`QuickSurahWidget`, `QuickSurahConfigIntent.defaultSurahIds`); Android `QuickSurahWidget`, `QuickSurahReceiver`, `QuickSurahConfigActivity`; JS `reloadWidgets(['QuickSurah'])` reaches both.

- [ ] **Step 1: iOS widget**

```swift
// targets/widgets/QuickSurah/QuickSurahWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

struct QuickSurahConfigIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "Quick Surah"
  static var description = IntentDescription("Play a surah in one tap.")
  /// Al-Kahf, Ya-Sin, Al-Mulk, Al-Waqi'ah.
  static let defaultSurahIds = [18, 36, 67, 56]

  @Parameter(title: "Surah") var surah: SurahEntity?
  @Parameter(title: "Second surah") var surah2: SurahEntity?
  @Parameter(title: "Third surah") var surah3: SurahEntity?
  @Parameter(title: "Fourth surah") var surah4: SurahEntity?
  @Parameter(title: "Reciter") var reciter: ReciterEntity?

  static var parameterSummary: some ParameterSummary {
    When(widgetFamily: .equalTo, .systemSmall) {
      Summary("Play \(\.$surah)") {
        \.$reciter
      }
    } otherwise: {
      Summary("Play \(\.$surah)") {
        \.$surah2
        \.$surah3
        \.$surah4
        \.$reciter
      }
    }
  }

  /// The four surahs with defaults in unset slots.
  var surahIds: [Int] {
    [surah, surah2, surah3, surah4].enumerated().map { $0.element?.id ?? Self.defaultSurahIds[$0.offset] }
  }
}

struct QuickSurahEntry: TimelineEntry {
  let date: Date
  let surahs: [StaticSurah]
  /// The configured reciter when it is still in the catalog; nil plays the default reciter.
  let reciter: WidgetCatalogReciter?
  let defaultReciter: WidgetReciter?
}

struct QuickSurahProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> QuickSurahEntry {
    QuickSurahEntry(date: .now, surahs: QuickSurahConfigIntent.defaultSurahIds.compactMap(StaticData.surah),
                    reciter: nil, defaultReciter: nil)
  }

  func snapshot(for configuration: QuickSurahConfigIntent, in context: Context) async -> QuickSurahEntry {
    entry(for: configuration)
  }

  func timeline(for configuration: QuickSurahConfigIntent, in context: Context) async -> Timeline<QuickSurahEntry> {
    let e = entry(for: configuration)
    let shown = context.family == .systemSmall ? Array(e.surahs.prefix(1)) : e.surahs
    let reciterFile = e.reciter.map { (id: $0.id, file: Optional($0.artworkFile)) }
    ArtworkRequestStore.recordMissing(surahs: shown, reciterFiles: reciterFile.map { [$0] } ?? [])
    // The app reloads this kind when the catalog, default reciter or artwork changes.
    return Timeline(entries: [e], policy: .never)
  }

  private func entry(for configuration: QuickSurahConfigIntent) -> QuickSurahEntry {
    QuickSurahEntry(
      date: .now,
      surahs: configuration.surahIds.compactMap(StaticData.surah),
      reciter: CatalogStore.load()?.reciter(configuration.reciter?.id),
      defaultReciter: SnapshotStore.load()?.defaultReciter)
  }
}

struct QuickSurahWidget: Widget {
  let kind = "QuickSurah"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: QuickSurahConfigIntent.self, provider: QuickSurahProvider()) { entry in
      QuickSurahView(entry: entry)
    }
    .configurationDisplayName("Quick Surah")
    .description("Play a favorite surah in one tap.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

struct QuickSurahView: View {
  @Environment(\.widgetFamily) private var family
  let entry: QuickSurahEntry

  private var reciterName: String { entry.reciter?.name ?? entry.defaultReciter?.name ?? "Default reciter" }
  private var reciterFile: String? { entry.reciter?.artworkFile ?? entry.defaultReciter?.artworkFile }

  var body: some View {
    Group {
      if let first = entry.surahs.first {
        if family == .systemSmall { small(first) } else { medium }
      } else {
        Text("Open Bayaan to set up").font(.caption.weight(.semibold))
      }
    }
    .foregroundStyle(.white)
    .containerBackground(for: .widget) { WidgetPalette.background }
  }

  private func intent(_ surah: StaticSurah) -> PlayTrackIntent {
    PlayTrackIntent(surahId: surah.id, reciterId: entry.reciter?.id, rewayatId: nil)
  }

  private func small(_ surah: StaticSurah) -> some View {
    Button(intent: intent(surah)) {
      VStack(alignment: .leading, spacing: 3) {
        HStack(alignment: .top) {
          SurahCard(surah: surah, size: 56)
          Spacer(minLength: 0)
          BayaanLogo(size: 14)
        }
        Spacer(minLength: 0)
        Text(surah.name).font(.headline).lineLimit(1)
        HStack(spacing: 6) {
          ReciterPhoto(file: reciterFile, name: reciterName)
            .frame(width: 18, height: 18).clipShape(Circle())
          Text(reciterName).font(.caption).opacity(0.75).lineLimit(1)
          Spacer(minLength: 0)
          RoundGlyph(systemName: "play.fill")
        }
      }
      .padding(14)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Play \(surah.name)")
  }

  private var medium: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Text(reciterName).font(.caption2.weight(.semibold)).opacity(0.6).lineLimit(1)
        Spacer(minLength: 0)
        BayaanLogo(size: 14)
      }
      Grid(horizontalSpacing: 10, verticalSpacing: 8) {
        GridRow { tile(0); tile(1) }
        GridRow { tile(2); tile(3) }
      }
      Spacer(minLength: 0)
    }
    .padding(12)
  }

  @ViewBuilder private func tile(_ index: Int) -> some View {
    if index < entry.surahs.count {
      let surah = entry.surahs[index]
      Button(intent: intent(surah)) {
        HStack(spacing: 8) {
          SurahCard(surah: surah, size: 38)
          Text(surah.name).font(.caption.weight(.semibold)).lineLimit(1)
          Spacer(minLength: 0)
        }
      }
      .buttonStyle(.plain)
      .frame(maxWidth: .infinity)
      .accessibilityLabel("Play \(surah.name)")
    } else {
      Color.clear.frame(height: 38)
    }
  }
}

#Preview("Small", as: .systemSmall) {
  QuickSurahWidget()
} timeline: {
  QuickSurahEntry(date: .now, surahs: [18].compactMap(StaticData.surah), reciter: nil,
                  defaultReciter: WidgetReciter(id: "r", name: "Mishary Alafasi", artworkFile: nil))
  QuickSurahEntry(date: .now, surahs: [], reciter: nil, defaultReciter: nil)
}

#Preview("Medium", as: .systemMedium) {
  QuickSurahWidget()
} timeline: {
  QuickSurahEntry(date: .now, surahs: QuickSurahConfigIntent.defaultSurahIds.compactMap(StaticData.surah),
                  reciter: nil, defaultReciter: WidgetReciter(id: "r", name: "Mishary Alafasi", artworkFile: nil))
}
```

In `targets/widgets/WidgetsBundle.swift`, add `QuickSurahWidget()` after `ContinueListeningWidget()`.

If `When(widgetFamily:)` does not compile on the installed SDK, delete the whole `parameterSummary` property (every parameter then shows for both sizes) and record it in the task report.

- [ ] **Step 2: Android widget**

```kotlin
// quicksurah/QuickSurahWidget.kt
package expo.modules.bayaanwidgets.quicksurah

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
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.RowScope
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import expo.modules.bayaanwidgets.CatalogModels
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.SnapshotModels
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.StaticSurah
import expo.modules.bayaanwidgets.WidgetConfigJson
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.ui.ReciterPhoto
import expo.modules.bayaanwidgets.ui.RoundButton
import expo.modules.bayaanwidgets.ui.SurahCard
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.commandAction
import expo.modules.bayaanwidgets.ui.playTrackCommand

class QuickSurahWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.SMALL, WidgetSizes.MEDIUM))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      val config = remember(inputs.configJson) { WidgetConfigJson.decodeQuickSurah(inputs.configJson) }
      val catalog = remember(inputs.catalogJson) { inputs.catalogJson?.let { CatalogModels.decode(it) } }
      val snapshot = remember(inputs.snapshotJson) { inputs.snapshotJson?.let { SnapshotModels.decode(it) } }
      val reciter = catalog?.reciter(config.reciterId)
      Content(
        context,
        surahs = config.surahIds.mapNotNull { StaticData.surah(context, it) },
        reciterId = reciter?.id,
        reciterName = reciter?.name ?: snapshot?.defaultReciter?.name ?: "Default reciter",
        photoId = reciter?.id ?: snapshot?.defaultReciter?.id,
        photoFile = reciter?.artworkFile ?: snapshot?.defaultReciter?.artworkFile,
      )
    }
  }

  @Composable
  private fun Content(
    context: Context, surahs: List<StaticSurah>, reciterId: String?, reciterName: String,
    photoId: String?, photoFile: String?,
  ) {
    val root = GlanceModifier.fillMaxSize().background(WidgetColors.BACKGROUND).cornerRadius(20.dp)
    val first = surahs.firstOrNull()
    if (first == null) {
      Box(root.padding(14.dp), contentAlignment = Alignment.Center) {
        Text("Open Bayaan to set up", style = TextStyle(color = WidgetColors.WHITE, fontWeight = FontWeight.Medium))
      }
      return
    }
    if (LocalSize.current.width >= WidgetSizes.MEDIUM.width) {
      Column(root.padding(12.dp)) {
        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
          Text(reciterName, maxLines = 1, style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp, fontWeight = FontWeight.Bold))
          Spacer(GlanceModifier.defaultWeight())
          Logo(14)
        }
        Spacer(GlanceModifier.height(8.dp))
        Row(GlanceModifier.fillMaxWidth()) { Tile(context, surahs.getOrNull(0), reciterId); Tile(context, surahs.getOrNull(1), reciterId) }
        Spacer(GlanceModifier.height(8.dp))
        Row(GlanceModifier.fillMaxWidth()) { Tile(context, surahs.getOrNull(2), reciterId); Tile(context, surahs.getOrNull(3), reciterId) }
      }
      return
    }
    val play = commandAction(context, playTrackCommand(first.id, reciterId, null, null), "quick/${first.id}/${reciterId ?: "default"}")
    Column(root.padding(14.dp).clickable(play)) {
      Row(GlanceModifier.fillMaxWidth()) {
        SurahCard(context, first, 52)
        Spacer(GlanceModifier.defaultWeight())
        Logo(14)
      }
      Spacer(GlanceModifier.defaultWeight())
      Text(first.name, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 15.sp, fontWeight = FontWeight.Bold))
      Spacer(GlanceModifier.height(4.dp))
      Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        if (photoId != null) {
          ReciterPhoto(context, photoId, photoFile, reciterName, 18, 18, 9)
          Spacer(GlanceModifier.width(6.dp))
        }
        Text(reciterName, maxLines = 1, modifier = GlanceModifier.defaultWeight(), style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp))
        RoundButton(android.R.drawable.ic_media_play, "Play ${first.name}", play)
      }
    }
  }

  @Composable
  private fun RowScope.Tile(context: Context, surah: StaticSurah?, reciterId: String?) {
    if (surah == null) {
      Spacer(GlanceModifier.defaultWeight())
      return
    }
    val play = commandAction(context, playTrackCommand(surah.id, reciterId, null, null), "quick/${surah.id}/${reciterId ?: "default"}")
    Row(GlanceModifier.defaultWeight().clickable(play), verticalAlignment = Alignment.CenterVertically) {
      SurahCard(context, surah, 36)
      Spacer(GlanceModifier.width(8.dp))
      Text(surah.name, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 13.sp, fontWeight = FontWeight.Bold))
    }
  }
}
```

```kotlin
// quicksurah/QuickSurahReceiver.kt
package expo.modules.bayaanwidgets.quicksurah

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import expo.modules.bayaanwidgets.WidgetStorage

class QuickSurahReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = QuickSurahWidget()

  override fun onDeleted(context: Context, appWidgetIds: IntArray) {
    super.onDeleted(context, appWidgetIds)
    WidgetStorage.deleteConfigs(context, appWidgetIds)
  }
}
```

```kotlin
// quicksurah/QuickSurahConfigActivity.kt
package expo.modules.bayaanwidgets.quicksurah

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import expo.modules.bayaanwidgets.CatalogModels
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.QuickSurahConfig
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.WidgetCatalog
import expo.modules.bayaanwidgets.WidgetConfigJson
import expo.modules.bayaanwidgets.WidgetStorage
import expo.modules.bayaanwidgets.ui.ConfigPicker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** Picks four surahs and an optional reciter. Opened at placement and from "Reconfigure". */
class QuickSurahConfigActivity : Activity() {
  private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID
  private lateinit var config: QuickSurahConfig
  private var catalog: WidgetCatalog? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    appWidgetId = intent?.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
      ?: AppWidgetManager.INVALID_APPWIDGET_ID
    setResult(RESULT_CANCELED, result())
    if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
      finish()
      return
    }
    config = WidgetConfigJson.decodeQuickSurah(WidgetStorage.readConfigJson(this, appWidgetId))
    catalog = WidgetStorage.readCatalogJson(this)?.let { CatalogModels.decode(it) }
    showMenu()
  }

  private fun result(): Intent = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)

  private fun surahLabel(id: Int): String = StaticData.surah(this, id)?.let { "${it.id}. ${it.name}" } ?: "$id"

  private fun reciterLabel(): String = catalog?.reciter(config.reciterId)?.name ?: "Default reciter"

  private fun showMenu() {
    val rows = config.surahIds.mapIndexed { i, id -> "Surah ${i + 1}: ${surahLabel(id)}" } + "Reciter: ${reciterLabel()}"
    ConfigPicker.menu(this, "Quick Surah", rows,
      onPick = { index -> if (index < config.surahIds.size) pickSurah(index) else pickReciter() },
      onDone = { save() },
      onCancel = { finish() })
  }

  private fun pickSurah(slot: Int) {
    val surahs = StaticData.surahs(this)
    ConfigPicker.pick(this, "Surah ${slot + 1}", surahs.map { "${it.id}. ${it.name}" },
      onPick = { i ->
        config = config.copy(surahIds = config.surahIds.toMutableList().also { it[slot] = surahs[i].id })
        showMenu()
      },
      onCancel = { showMenu() })
  }

  private fun pickReciter() {
    val reciters = catalog?.reciters.orEmpty()
    ConfigPicker.pick(this, "Reciter", listOf("Default reciter") + reciters.map { it.name },
      onPick = { i ->
        config = config.copy(reciterId = if (i == 0) null else reciters[i - 1].id)
        showMenu()
      },
      onCancel = { showMenu() })
  }

  private fun save() {
    WidgetStorage.writeConfig(this, appWidgetId, WidgetConfigJson.encode(config))
    setResult(RESULT_OK, result())
    val ctx = applicationContext
    CoroutineScope(Dispatchers.Default).launch { runCatching { GlanceState.push(ctx, QuickSurahWidget()) } }
    finish()
  }
}
```

`res/xml/quick_surah_info.xml`:

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/bayaan_widget_quick_surah_desc"
  android:minWidth="110dp"
  android:minHeight="110dp"
  android:targetCellWidth="2"
  android:targetCellHeight="2"
  android:maxResizeWidth="400dp"
  android:maxResizeHeight="200dp"
  android:resizeMode="horizontal|vertical"
  android:updatePeriodMillis="0"
  android:widgetCategory="home_screen"
  android:configure="expo.modules.bayaanwidgets.quicksurah.QuickSurahConfigActivity"
  android:widgetFeatures="reconfigurable|configuration_optional"
  android:initialLayout="@layout/glance_default_loading_layout" />
```

`strings.xml` additions:

```xml
  <string name="bayaan_widget_quick_surah_label">Quick Surah</string>
  <string name="bayaan_widget_quick_surah_desc">Play a favorite surah in one tap.</string>
```

`AndroidManifest.xml` additions inside `<application>`:

```xml
    <receiver
      android:name="expo.modules.bayaanwidgets.quicksurah.QuickSurahReceiver"
      android:exported="true"
      android:label="@string/bayaan_widget_quick_surah_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
      </intent-filter>
      <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/quick_surah_info" />
    </receiver>
    <activity
      android:name="expo.modules.bayaanwidgets.quicksurah.QuickSurahConfigActivity"
      android:exported="true"
      android:excludeFromRecents="true"
      android:taskAffinity=""
      android:theme="@android:style/Theme.Translucent.NoTitleBar">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_CONFIGURE" />
      </intent-filter>
    </activity>
```

In `BayaanWidgetsModule.reloadWidgets`, add the branch (import `expo.modules.bayaanwidgets.quicksurah.QuickSurahWidget`):

```kotlin
          "QuickSurah" -> push(QuickSurahWidget())
```

- [ ] **Step 3: Build both platforms**

```bash
npm run prebuild
xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20
cd android && ./gradlew :bayaan-widgets:testReleaseUnitTest && ./gradlew :app:assembleRelease
```
Expected: `BUILD SUCCEEDED`; Gradle tests pass and the release build succeeds. Open `QuickSurahWidget.swift` in Xcode and check both previews render (cards appear as dark numbered tiles in previews, since previews have no App Group artwork).

- [ ] **Step 4: Commit**

```bash
git add targets/widgets/QuickSurah targets/widgets/WidgetsBundle.swift modules/bayaan-widgets/android
git status --short ios android   # commit regenerated native output only if prebuild changed tracked files
git commit -m "feat(widgets): add the Quick Surah widget"
```

---

### Task 7: Pinned Reciter (iOS and Android)

Small: reciter photo full-bleed, name over a bottom scrim, round play button; any tap sends `playReciter`. Medium: photo with play button on the left; on the right the reciter's last three surahs from `reciterRecents`, or Al-Fatihah, Ya-Sin, Al-Mulk when there are none; rows send `playTrack` with the row's rewayah.

**Files:**
- Create: `targets/widgets/PinnedReciter/PinnedReciterWidget.swift`; `modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/pinnedreciter/PinnedReciterWidget.kt`, `PinnedReciterReceiver.kt`, `PinnedReciterConfigActivity.kt`; `modules/bayaan-widgets/android/src/main/res/xml/pinned_reciter_info.xml`
- Modify: `targets/widgets/WidgetsBundle.swift`, `AndroidManifest.xml`, `strings.xml`, `BayaanWidgetsModule.kt`

**Interfaces:**
- Consumes: Task 2 `PlayReciterIntent`, `PlayTrackIntent`; Task 3 `ReciterEntity`, `CatalogStore`, `StaticData`, `ArtworkRequestStore`, `ReciterPhoto`, `SurahCard`, `RoundGlyph`, `RoundIntentButton`; Task 4 `PinnedReciterModel.resolve`, `PinnedReciterState`, `PinnedRow`, `WidgetConfigJson`, `GlanceState`, `ui.*`, `ConfigPicker`.
- Produces: iOS kind `PinnedReciter`; `PinnedReciterResolver.resolve(reciterId:catalog:snapshot:)` (Swift mirror of the Kotlin model); Android `PinnedReciterWidget`, `PinnedReciterReceiver`, `PinnedReciterConfigActivity`.

- [ ] **Step 1: iOS widget**

```swift
// targets/widgets/PinnedReciter/PinnedReciterWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

struct PinnedReciterConfigIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "Pinned Reciter"
  static var description = IntentDescription("Play a favorite reciter in one tap.")

  @Parameter(title: "Reciter") var reciter: ReciterEntity?
}

struct PinnedRow: Hashable {
  let surah: StaticSurah
  let rewayatId: String?
}

enum PinnedReciterState: Hashable {
  case ready(id: String, name: String, artworkFile: String?, rows: [PinnedRow])
  /// The configured reciter is no longer in the catalog.
  case unavailable
  /// Nothing configured and no default reciter yet.
  case unset
}

/// Mirrors PinnedReciterModel.kt.
enum PinnedReciterResolver {
  /// Al-Fatihah, Ya-Sin, Al-Mulk.
  static let popularSurahIds = [1, 36, 67]

  static func resolve(reciterId: String?, catalog: WidgetCatalog?, snapshot: WidgetSnapshot?) -> PinnedReciterState {
    let id: String
    let name: String
    let file: String?
    if let reciterId {
      guard let r = catalog?.reciter(reciterId) else { return .unavailable }
      id = r.id
      name = r.name
      file = r.artworkFile
    } else {
      guard let d = snapshot?.defaultReciter else { return .unset }
      id = d.id
      name = d.name
      file = catalog?.reciter(d.id)?.artworkFile ?? d.artworkFile
    }
    let recents = (snapshot?.reciterRecents[id] ?? [])
      .compactMap { t in StaticData.surah(t.surahId).map { PinnedRow(surah: $0, rewayatId: t.rewayatId) } }
      .prefix(3)
    let rows = recents.isEmpty
      ? popularSurahIds.compactMap { StaticData.surah($0).map { PinnedRow(surah: $0, rewayatId: nil) } }
      : Array(recents)
    return .ready(id: id, name: name, artworkFile: file, rows: rows)
  }
}

struct PinnedReciterEntry: TimelineEntry {
  let date: Date
  let state: PinnedReciterState
}

struct PinnedReciterProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> PinnedReciterEntry {
    PinnedReciterEntry(date: .now, state: .ready(id: "", name: "Bayaan", artworkFile: nil, rows: []))
  }

  func snapshot(for configuration: PinnedReciterConfigIntent, in context: Context) async -> PinnedReciterEntry {
    entry(for: configuration)
  }

  func timeline(for configuration: PinnedReciterConfigIntent, in context: Context) async -> Timeline<PinnedReciterEntry> {
    let e = entry(for: configuration)
    if case let .ready(id, _, file, rows) = e.state {
      let surahs = context.family == .systemSmall ? [] : rows.map(\.surah)
      ArtworkRequestStore.recordMissing(surahs: surahs, reciterFiles: [(id: id, file: file)])
    }
    return Timeline(entries: [e], policy: .never)
  }

  private func entry(for configuration: PinnedReciterConfigIntent) -> PinnedReciterEntry {
    PinnedReciterEntry(date: .now, state: PinnedReciterResolver.resolve(
      reciterId: configuration.reciter?.id, catalog: CatalogStore.load(), snapshot: SnapshotStore.load()))
  }
}

struct PinnedReciterWidget: Widget {
  let kind = "PinnedReciter"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: PinnedReciterConfigIntent.self, provider: PinnedReciterProvider()) { entry in
      PinnedReciterView(entry: entry)
    }
    .configurationDisplayName("Pinned Reciter")
    .description("Play a favorite reciter in one tap.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

struct PinnedReciterView: View {
  @Environment(\.widgetFamily) private var family
  let entry: PinnedReciterEntry

  var body: some View {
    Group {
      switch entry.state {
      case let .ready(id, name, file, rows):
        if family == .systemSmall {
          small(id: id, name: name, file: file)
        } else {
          medium(id: id, name: name, file: file, rows: rows)
        }
      case .unavailable:
        message("Reciter unavailable", "Edit the widget to choose another")
      case .unset:
        message("Choose a reciter", "Edit the widget to pick one")
      }
    }
    .foregroundStyle(.white)
    .containerBackground(for: .widget) { WidgetPalette.background }
  }

  private func small(id: String, name: String, file: String?) -> some View {
    Button(intent: PlayReciterIntent(reciterId: id)) {
      ZStack(alignment: .bottomLeading) {
        ReciterPhoto(file: file, name: name)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .clipped()
        LinearGradient(colors: [.clear, .black.opacity(0.7)], startPoint: .center, endPoint: .bottom)
        HStack(alignment: .bottom) {
          Text(name).font(.headline).lineLimit(2)
          Spacer(minLength: 4)
          RoundGlyph(systemName: "play.fill")
        }
        .padding(12)
      }
      .overlay(alignment: .topTrailing) { BayaanLogo(size: 14).padding(12) }
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Play \(name)")
  }

  private func medium(id: String, name: String, file: String?, rows: [PinnedRow]) -> some View {
    HStack(spacing: 12) {
      ZStack(alignment: .bottomLeading) {
        ReciterPhoto(file: file, name: name)
          .frame(width: 106, height: 106)
          .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        RoundIntentButton(intent: PlayReciterIntent(reciterId: id), systemName: "play.fill", label: "Play \(name)")
          .padding(8)
      }
      VStack(alignment: .leading, spacing: 6) {
        HStack {
          Text(name).font(.subheadline.bold()).lineLimit(1)
          Spacer(minLength: 0)
          BayaanLogo(size: 14)
        }
        ForEach(rows, id: \.self) { row in
          Button(intent: PlayTrackIntent(surahId: row.surah.id, reciterId: id, rewayatId: row.rewayatId)) {
            HStack(spacing: 8) {
              SurahCard(surah: row.surah, size: 24)
              Text(row.surah.name).font(.caption.weight(.semibold)).lineLimit(1)
              Spacer(minLength: 0)
            }
          }
          .buttonStyle(.plain)
          .accessibilityLabel("Play \(row.surah.name)")
        }
        Spacer(minLength: 0)
      }
    }
    .padding(12)
  }

  private func message(_ title: String, _ detail: String) -> some View {
    VStack(spacing: 6) {
      BayaanLogo(size: 20)
      Text(title).font(.caption.weight(.semibold)).multilineTextAlignment(.center)
      Text(detail).font(.caption2).opacity(0.7).multilineTextAlignment(.center)
    }
    .padding(12)
  }
}

#Preview("Small", as: .systemSmall) {
  PinnedReciterWidget()
} timeline: {
  PinnedReciterEntry(date: .now, state: .ready(id: "r", name: "Mishary Alafasi", artworkFile: nil, rows: []))
  PinnedReciterEntry(date: .now, state: .unavailable)
}

#Preview("Medium", as: .systemMedium) {
  PinnedReciterWidget()
} timeline: {
  PinnedReciterEntry(date: .now, state: .ready(
    id: "r", name: "Mishary Alafasi", artworkFile: nil,
    rows: PinnedReciterResolver.popularSurahIds.compactMap { StaticData.surah($0).map { PinnedRow(surah: $0, rewayatId: nil) } }))
  PinnedReciterEntry(date: .now, state: .unset)
}
```

Add `PinnedReciterWidget()` to `WidgetsBundle`.

- [ ] **Step 2: Android widget**

```kotlin
// pinnedreciter/PinnedReciterWidget.kt
package expo.modules.bayaanwidgets.pinnedreciter

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
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
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
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import expo.modules.bayaanwidgets.CatalogModels
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.R
import expo.modules.bayaanwidgets.SnapshotModels
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.WidgetConfigJson
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.ui.ReciterPhoto
import expo.modules.bayaanwidgets.ui.RoundButton
import expo.modules.bayaanwidgets.ui.SurahCard
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.commandAction
import expo.modules.bayaanwidgets.ui.playReciterCommand
import expo.modules.bayaanwidgets.ui.playTrackCommand

class PinnedReciterWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.SMALL, WidgetSizes.MEDIUM))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val appWidgetId = GlanceState.appWidgetId(context, id)
    val stored = GlanceState.stored(context, appWidgetId)
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      val state = remember(inputs) {
        PinnedReciterModel.resolve(
          WidgetConfigJson.decodePinnedReciter(inputs.configJson),
          inputs.catalogJson?.let { CatalogModels.decode(it) },
          inputs.snapshotJson?.let { SnapshotModels.decode(it) },
        )
      }
      Content(context, appWidgetId, state)
    }
  }

  @Composable
  private fun Content(context: Context, appWidgetId: Int, state: PinnedReciterState) {
    val root = GlanceModifier.fillMaxSize().background(WidgetColors.BACKGROUND).cornerRadius(20.dp)
    when (state) {
      is PinnedReciterState.Ready ->
        if (LocalSize.current.width >= WidgetSizes.MEDIUM.width) Medium(context, state, root) else Small(context, state, root)
      PinnedReciterState.Unavailable -> Message(context, appWidgetId, root, "Reciter unavailable", "Tap to choose another")
      PinnedReciterState.Unset -> Message(context, appWidgetId, root, "Choose a reciter", "Tap to pick one")
    }
  }

  @Composable
  private fun Small(context: Context, state: PinnedReciterState.Ready, root: GlanceModifier) {
    val play = commandAction(context, playReciterCommand(state.id), "reciter/${state.id}")
    val size = LocalSize.current
    Box(root.clickable(play)) {
      ReciterPhoto(context, state.id, state.artworkFile, state.name, size.width.value.toInt(), size.height.value.toInt(), 20)
      Image(
        ImageProvider(R.drawable.widget_scrim), contentDescription = null,
        modifier = GlanceModifier.fillMaxSize(), contentScale = ContentScale.FillBounds,
      )
      Column(GlanceModifier.fillMaxSize().padding(12.dp)) {
        Row(GlanceModifier.fillMaxWidth()) {
          Spacer(GlanceModifier.defaultWeight())
          Logo(14)
        }
        Spacer(GlanceModifier.defaultWeight())
        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
          Text(state.name, maxLines = 2, modifier = GlanceModifier.defaultWeight(),
            style = TextStyle(color = WidgetColors.WHITE, fontSize = 15.sp, fontWeight = FontWeight.Bold))
          RoundButton(android.R.drawable.ic_media_play, "Play ${state.name}", play)
        }
      }
    }
  }

  @Composable
  private fun Medium(context: Context, state: PinnedReciterState.Ready, root: GlanceModifier) {
    val play = commandAction(context, playReciterCommand(state.id), "reciter/${state.id}")
    Row(root.padding(12.dp)) {
      Box(GlanceModifier.width(86.dp).fillMaxHeight().clickable(play), contentAlignment = Alignment.BottomStart) {
        ReciterPhoto(context, state.id, state.artworkFile, state.name, 86, 86, 14)
        Box(GlanceModifier.padding(6.dp)) { RoundButton(android.R.drawable.ic_media_play, "Play ${state.name}", play) }
      }
      Spacer(GlanceModifier.width(12.dp))
      Column(GlanceModifier.defaultWeight().fillMaxHeight()) {
        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
          Text(state.name, maxLines = 1, modifier = GlanceModifier.defaultWeight(),
            style = TextStyle(color = WidgetColors.WHITE, fontSize = 14.sp, fontWeight = FontWeight.Bold))
          Logo(14)
        }
        state.rows.forEach { row ->
          val surah = StaticData.surah(context, row.surahId) ?: return@forEach
          val action = commandAction(context, playTrackCommand(row.surahId, state.id, row.rewayatId, null),
            "reciter/${state.id}/${row.surahId}/${row.rewayatId ?: "any"}")
          Row(GlanceModifier.fillMaxWidth().padding(top = 6.dp).clickable(action), verticalAlignment = Alignment.CenterVertically) {
            SurahCard(context, surah, 24)
            Spacer(GlanceModifier.width(8.dp))
            Text(surah.name, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 13.sp, fontWeight = FontWeight.Medium))
          }
        }
      }
    }
  }

  @Composable
  private fun Message(context: Context, appWidgetId: Int, root: GlanceModifier, title: String, detail: String) {
    val configure = actionStartActivity(
      Intent(context, PinnedReciterConfigActivity::class.java)
        .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        .setData(Uri.parse("bayaan-widget://configure/reciter/$appWidgetId")),
    )
    Column(
      root.padding(12.dp).clickable(configure),
      horizontalAlignment = Alignment.CenterHorizontally, verticalAlignment = Alignment.CenterVertically,
    ) {
      Logo(20)
      Spacer(GlanceModifier.height(6.dp))
      Text(title, style = TextStyle(color = WidgetColors.WHITE, fontSize = 13.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center))
      Text(detail, style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp, textAlign = TextAlign.Center))
    }
  }
}
```

```kotlin
// pinnedreciter/PinnedReciterReceiver.kt
package expo.modules.bayaanwidgets.pinnedreciter

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import expo.modules.bayaanwidgets.WidgetStorage

class PinnedReciterReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = PinnedReciterWidget()

  override fun onDeleted(context: Context, appWidgetIds: IntArray) {
    super.onDeleted(context, appWidgetIds)
    WidgetStorage.deleteConfigs(context, appWidgetIds)
  }
}
```

```kotlin
// pinnedreciter/PinnedReciterConfigActivity.kt
package expo.modules.bayaanwidgets.pinnedreciter

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import expo.modules.bayaanwidgets.CatalogModels
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.PinnedReciterConfig
import expo.modules.bayaanwidgets.WidgetConfigJson
import expo.modules.bayaanwidgets.WidgetStorage
import expo.modules.bayaanwidgets.ui.ConfigPicker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** Picks the pinned reciter from the catalog; "Default reciter" clears it. */
class PinnedReciterConfigActivity : Activity() {
  private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    appWidgetId = intent?.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
      ?: AppWidgetManager.INVALID_APPWIDGET_ID
    setResult(RESULT_CANCELED, result())
    if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
      finish()
      return
    }
    val reciters = WidgetStorage.readCatalogJson(this)?.let { CatalogModels.decode(it) }?.reciters.orEmpty()
    if (reciters.isEmpty()) {
      // Fresh install: the app has not written the catalog yet. Keep the default reciter.
      Toast.makeText(this, "Open Bayaan once to load reciters", Toast.LENGTH_LONG).show()
      save(PinnedReciterConfig(null))
      return
    }
    ConfigPicker.pick(this, "Pinned Reciter", listOf("Default reciter") + reciters.map { it.name },
      onPick = { i -> save(PinnedReciterConfig(if (i == 0) null else reciters[i - 1].id)) },
      onCancel = { finish() })
  }

  private fun result(): Intent = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)

  private fun save(config: PinnedReciterConfig) {
    WidgetStorage.writeConfig(this, appWidgetId, WidgetConfigJson.encode(config))
    setResult(RESULT_OK, result())
    val ctx = applicationContext
    CoroutineScope(Dispatchers.Default).launch { runCatching { GlanceState.push(ctx, PinnedReciterWidget()) } }
    finish()
  }
}
```

`res/xml/pinned_reciter_info.xml`: same as `quick_surah_info.xml` with `android:description="@string/bayaan_widget_pinned_reciter_desc"` and `android:configure="expo.modules.bayaanwidgets.pinnedreciter.PinnedReciterConfigActivity"`:

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/bayaan_widget_pinned_reciter_desc"
  android:minWidth="110dp"
  android:minHeight="110dp"
  android:targetCellWidth="2"
  android:targetCellHeight="2"
  android:maxResizeWidth="400dp"
  android:maxResizeHeight="200dp"
  android:resizeMode="horizontal|vertical"
  android:updatePeriodMillis="0"
  android:widgetCategory="home_screen"
  android:configure="expo.modules.bayaanwidgets.pinnedreciter.PinnedReciterConfigActivity"
  android:widgetFeatures="reconfigurable|configuration_optional"
  android:initialLayout="@layout/glance_default_loading_layout" />
```

`strings.xml`:

```xml
  <string name="bayaan_widget_pinned_reciter_label">Pinned Reciter</string>
  <string name="bayaan_widget_pinned_reciter_desc">Play a favorite reciter in one tap.</string>
```

`AndroidManifest.xml` (inside `<application>`):

```xml
    <receiver
      android:name="expo.modules.bayaanwidgets.pinnedreciter.PinnedReciterReceiver"
      android:exported="true"
      android:label="@string/bayaan_widget_pinned_reciter_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
      </intent-filter>
      <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/pinned_reciter_info" />
    </receiver>
    <activity
      android:name="expo.modules.bayaanwidgets.pinnedreciter.PinnedReciterConfigActivity"
      android:exported="true"
      android:excludeFromRecents="true"
      android:taskAffinity=""
      android:theme="@android:style/Theme.Translucent.NoTitleBar">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_CONFIGURE" />
      </intent-filter>
    </activity>
```

`BayaanWidgetsModule.reloadWidgets` branch (import `expo.modules.bayaanwidgets.pinnedreciter.PinnedReciterWidget`):

```kotlin
          "PinnedReciter" -> push(PinnedReciterWidget())
```

- [ ] **Step 3: Build both platforms**

```bash
npm run prebuild
xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20
cd android && ./gradlew :bayaan-widgets:testReleaseUnitTest && ./gradlew :app:assembleRelease
```
Expected: `BUILD SUCCEEDED`; tests pass (including `pinnedReciterResolve`); release build succeeds.

- [ ] **Step 4: Commit**

```bash
git add targets/widgets/PinnedReciter targets/widgets/WidgetsBundle.swift modules/bayaan-widgets/android
git status --short ios android   # commit regenerated native output only if prebuild changed tracked files
git commit -m "feat(widgets): add the Pinned Reciter widget"
```

---
### Task 8: Ayah of the Day (iOS and Android)

The ayah comes from bundled `ayat.json` by `localDayNumber % count`, so the widget changes at midnight without the app. Small: Arabic only. Medium and large: Listen button, reference, Arabic, translation. Listen sends `playTrack` with the ayah and no reciter (default reciter; `handleWidgetCommand` already resolves the start from timestamps and falls back to 0). Any other tap opens `bayaan://quran/{surah}?ayah={n}`.

**Files:**
- Create: `targets/widgets/AyahOfTheDay/AyahOfTheDayWidget.swift`; `modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/ayahoftheday/AyahOfTheDayWidget.kt`, `AyahOfTheDayReceiver.kt`, `MidnightReceiver.kt`; `modules/bayaan-widgets/android/src/main/res/xml/ayah_of_the_day_info.xml`
- Modify: `targets/widgets/WidgetsBundle.swift`, `AndroidManifest.xml`, `strings.xml`, `BayaanWidgetsModule.kt`

**Interfaces:**
- Consumes: `StaticData.ayahOfTheDay`, `WidgetLogic.nextMidnight`, `WidgetLogic.reference`, `WidgetFonts.quran`, `RoundIntentButton`, `PlayTrackIntent(…, ayah:)` (iOS); `StaticData.ayahOfTheDay`, `DayMath.nextLocalMidnightMs`, `ArabicText`, `ArabicBitmap.QURAN_FONT`, `GlanceState.push` (Android).
- Produces: iOS kind `AyahOfTheDay`; Android `AyahOfTheDayWidget`, `AyahOfTheDayReceiver`, `MidnightReceiver.schedule(context)`, `MidnightReceiver.cancelIfUnused(context)` (Task 10 adds Tasbeeh to its refresh).

- [ ] **Step 1: iOS widget**

```swift
// targets/widgets/AyahOfTheDay/AyahOfTheDayWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

struct AyahOfTheDayEntry: TimelineEntry {
  let date: Date
  let ayah: StaticAyah?
}

struct AyahOfTheDayProvider: TimelineProvider {
  func placeholder(in context: Context) -> AyahOfTheDayEntry {
    AyahOfTheDayEntry(date: .now, ayah: StaticData.ayahOfTheDay(.now))
  }

  func getSnapshot(in context: Context, completion: @escaping (AyahOfTheDayEntry) -> Void) {
    completion(placeholder(in: context))
  }

  // Today's ayah now and tomorrow's at midnight; then WidgetKit asks again.
  func getTimeline(in context: Context, completion: @escaping (Timeline<AyahOfTheDayEntry>) -> Void) {
    let now = Date.now
    let midnight = WidgetLogic.nextMidnight(after: now)
    completion(Timeline(entries: [
      AyahOfTheDayEntry(date: now, ayah: StaticData.ayahOfTheDay(now)),
      AyahOfTheDayEntry(date: midnight, ayah: StaticData.ayahOfTheDay(midnight)),
    ], policy: .atEnd))
  }
}

struct AyahOfTheDayWidget: Widget {
  let kind = "AyahOfTheDay"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: AyahOfTheDayProvider()) { entry in
      AyahOfTheDayView(entry: entry)
    }
    .configurationDisplayName("Ayah of the Day")
    .description("A new ayah every day, in Digital Khatt.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}

struct AyahOfTheDayView: View {
  @Environment(\.widgetFamily) private var family
  let entry: AyahOfTheDayEntry

  var body: some View {
    Group {
      if let ayah = entry.ayah {
        content(ayah)
      } else {
        Text("Open Bayaan").font(.caption.weight(.semibold))
      }
    }
    .foregroundStyle(.white)
    .containerBackground(for: .widget) { WidgetPalette.background }
    .widgetURL(entry.ayah.flatMap { URL(string: "bayaan://quran/\($0.surahId)?ayah=\($0.ayah)") })
  }

  @ViewBuilder private func content(_ ayah: StaticAyah) -> some View {
    switch family {
    case .systemSmall:
      VStack(spacing: 4) {
        HStack { Spacer(minLength: 0); BayaanLogo(size: 12) }
        Spacer(minLength: 0)
        arabic(ayah, size: 26, lines: 4)
        Spacer(minLength: 0)
      }
      .padding(12)
    case .systemMedium:
      VStack(alignment: .leading, spacing: 6) {
        header(ayah)
        arabic(ayah, size: 24, lines: 2)
        Text(ayah.translation).font(.caption).opacity(0.8).lineLimit(2).minimumScaleFactor(0.85)
      }
      .padding(14)
    default:
      VStack(alignment: .leading, spacing: 12) {
        header(ayah)
        Spacer(minLength: 0)
        arabic(ayah, size: 32, lines: 6)
        Text(ayah.translation).font(.subheadline).opacity(0.85).lineLimit(5)
        Spacer(minLength: 0)
      }
      .padding(16)
    }
  }

  private func header(_ ayah: StaticAyah) -> some View {
    HStack(spacing: 8) {
      RoundIntentButton(intent: PlayTrackIntent(surahId: ayah.surahId, reciterId: nil, rewayatId: nil, ayah: ayah.ayah),
                        systemName: "play.fill", label: "Listen")
      Text(WidgetLogic.reference(surahName: ayah.surahName, key: ayah.key))
        .font(.caption.weight(.semibold)).opacity(0.75).lineLimit(1)
      Spacer(minLength: 0)
      BayaanLogo(size: 14)
    }
  }

  // Centered and ragged, never justified (Digital Khatt spike caveat).
  private func arabic(_ ayah: StaticAyah, size: CGFloat, lines: Int) -> some View {
    Text(ayah.arabic)
      .font(WidgetFonts.quran(size))
      .multilineTextAlignment(.center)
      .lineLimit(lines)
      .minimumScaleFactor(0.4)
      .frame(maxWidth: .infinity)
      .environment(\.layoutDirection, .rightToLeft)
  }
}

#Preview("Small", as: .systemSmall) {
  AyahOfTheDayWidget()
} timeline: {
  AyahOfTheDayEntry(date: .now, ayah: StaticData.ayat.first { $0.key == "94:6" })
}

#Preview("Medium", as: .systemMedium) {
  AyahOfTheDayWidget()
} timeline: {
  AyahOfTheDayEntry(date: .now, ayah: StaticData.ayat.first { $0.key == "2:152" })
}

#Preview("Large", as: .systemLarge) {
  AyahOfTheDayWidget()
} timeline: {
  AyahOfTheDayEntry(date: .now, ayah: StaticData.ayat.first { $0.key == "39:53" })
  AyahOfTheDayEntry(date: .now, ayah: nil)
}
```

Add `AyahOfTheDayWidget()` to `WidgetsBundle`.

- [ ] **Step 2: Android widget and midnight refresh**

```kotlin
// ayahoftheday/AyahOfTheDayWidget.kt
package expo.modules.bayaanwidgets.ayahoftheday

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalSize
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
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
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.StaticAyah
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.WidgetText
import expo.modules.bayaanwidgets.ui.ArabicText
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.ui.RoundButton
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.commandAction
import expo.modules.bayaanwidgets.ui.deepLink
import expo.modules.bayaanwidgets.ui.playTrackCommand
import java.util.TimeZone

class AyahOfTheDayWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.SMALL, WidgetSizes.MEDIUM, WidgetSizes.LARGE))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    provideContent {
      // Read state so a midnight push recomposes; the ayah itself depends only on today's date.
      GlanceState.current(currentState(), stored)
      Content(context, StaticData.ayahOfTheDay(context, System.currentTimeMillis(), TimeZone.getDefault()))
    }
  }

  @Composable
  private fun Content(context: Context, ayah: StaticAyah?) {
    val size = LocalSize.current
    val root = GlanceModifier.fillMaxSize().background(WidgetColors.BACKGROUND).cornerRadius(20.dp)
    if (ayah == null) {
      Box(root, contentAlignment = Alignment.Center) {
        Text("Open Bayaan", style = TextStyle(color = WidgetColors.WHITE, fontWeight = FontWeight.Medium))
      }
      return
    }
    val open = deepLink(context, "bayaan://quran/${ayah.surahId}?ayah=${ayah.ayah}")
    val listen = commandAction(context, playTrackCommand(ayah.surahId, null, null, ayah.ayah), "ayah/${ayah.key}")
    val width = size.width.value
    when {
      size.height >= WidgetSizes.LARGE.height -> Column(root.padding(16.dp).clickable(open)) {
        Header(ayah, listen)
        Spacer(GlanceModifier.defaultWeight())
        ArabicText(context, ayah.arabic, ArabicBitmap.QURAN_FONT, width - 32, 130f, 32f, 14f, 6, center = true)
        Spacer(GlanceModifier.height(12.dp))
        Text(ayah.translation, maxLines = 5, style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 14.sp))
        Spacer(GlanceModifier.defaultWeight())
      }
      size.width >= WidgetSizes.MEDIUM.width -> Column(root.padding(14.dp).clickable(open)) {
        Header(ayah, listen)
        Spacer(GlanceModifier.height(6.dp))
        ArabicText(context, ayah.arabic, ArabicBitmap.QURAN_FONT, width - 28, 44f, 24f, 12f, 2, center = true)
        Spacer(GlanceModifier.height(4.dp))
        Text(ayah.translation, maxLines = 2, style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp))
      }
      else -> Column(root.padding(12.dp).clickable(open), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(GlanceModifier.fillMaxWidth()) {
          Spacer(GlanceModifier.defaultWeight())
          Logo(12)
        }
        Spacer(GlanceModifier.defaultWeight())
        ArabicText(context, ayah.arabic, ArabicBitmap.QURAN_FONT, width - 24, size.height.value - 24 - 20, 26f, 12f, 4, center = true)
        Spacer(GlanceModifier.defaultWeight())
      }
    }
  }

  @Composable
  private fun Header(ayah: StaticAyah, listen: Action) {
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      RoundButton(android.R.drawable.ic_media_play, "Listen", listen)
      Spacer(GlanceModifier.width(8.dp))
      Text(WidgetText.reference(ayah.surahName, ayah.key), maxLines = 1,
        style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 12.sp, fontWeight = FontWeight.Bold))
      Spacer(GlanceModifier.defaultWeight())
      Logo(14)
    }
  }
}
```

```kotlin
// ayahoftheday/MidnightReceiver.kt
package expo.modules.bayaanwidgets.ayahoftheday

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import expo.modules.bayaanwidgets.DayMath
import expo.modules.bayaanwidgets.GlanceState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.TimeZone

/**
 * Re-renders the date-driven widgets just after local midnight. Inexact and
 * permission free (setAndAllowWhileIdle); spec 7: no reliance on updatePeriodMillis.
 */
class MidnightReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pending = goAsync()
    val app = context.applicationContext
    CoroutineScope(Dispatchers.Default).launch {
      try {
        runCatching { GlanceState.push(app, AyahOfTheDayWidget()) }
      } finally {
        if (hasWidgets(app)) schedule(app)
        pending.finish()
      }
    }
  }

  companion object {
    // Providers whose content changes at midnight. Task 10 adds TasbeehReceiver.
    private val PROVIDERS: List<Class<*>> = listOf(AyahOfTheDayReceiver::class.java)

    fun hasWidgets(context: Context): Boolean {
      val manager = AppWidgetManager.getInstance(context)
      return PROVIDERS.any { manager.getAppWidgetIds(ComponentName(context, it)).isNotEmpty() }
    }

    fun schedule(context: Context) {
      val alarms = context.getSystemService(AlarmManager::class.java) ?: return
      val at = DayMath.nextLocalMidnightMs(System.currentTimeMillis(), TimeZone.getDefault()) + 1_000
      alarms.setAndAllowWhileIdle(AlarmManager.RTC, at, pendingIntent(context))
    }

    fun cancelIfUnused(context: Context) {
      if (hasWidgets(context)) return
      context.getSystemService(AlarmManager::class.java)?.cancel(pendingIntent(context))
    }

    private fun pendingIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
      context, 0, Intent(context, MidnightReceiver::class.java),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
  }
}
```

```kotlin
// ayahoftheday/AyahOfTheDayReceiver.kt
package expo.modules.bayaanwidgets.ayahoftheday

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver

class AyahOfTheDayReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = AyahOfTheDayWidget()

  // Also runs after a reboot, which clears alarms.
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    super.onUpdate(context, appWidgetManager, appWidgetIds)
    MidnightReceiver.schedule(context)
  }

  override fun onDisabled(context: Context) {
    super.onDisabled(context)
    MidnightReceiver.cancelIfUnused(context)
  }
}
```

`res/xml/ayah_of_the_day_info.xml` (no configuration):

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/bayaan_widget_ayah_desc"
  android:minWidth="110dp"
  android:minHeight="110dp"
  android:targetCellWidth="3"
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
  <string name="bayaan_widget_ayah_label">Ayah of the Day</string>
  <string name="bayaan_widget_ayah_desc">A new ayah every day, in Digital Khatt.</string>
```

`AndroidManifest.xml`:

```xml
    <receiver
      android:name="expo.modules.bayaanwidgets.ayahoftheday.AyahOfTheDayReceiver"
      android:exported="true"
      android:label="@string/bayaan_widget_ayah_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
      </intent-filter>
      <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/ayah_of_the_day_info" />
    </receiver>
    <receiver
      android:name="expo.modules.bayaanwidgets.ayahoftheday.MidnightReceiver"
      android:exported="false" />
```

`BayaanWidgetsModule.reloadWidgets` branch (import `expo.modules.bayaanwidgets.ayahoftheday.AyahOfTheDayWidget`); JS never reloads this kind today (`changedWidgetKinds` slice is `null`), but the branch keeps the mapping complete:

```kotlin
          "AyahOfTheDay" -> push(AyahOfTheDayWidget())
```

- [ ] **Step 3: Build both platforms**

```bash
npm run prebuild
xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20
cd android && ./gradlew :bayaan-widgets:testReleaseUnitTest && ./gradlew :app:assembleRelease
```
Expected: `BUILD SUCCEEDED`; tests pass; release build succeeds. Check the three previews in Xcode: Arabic renders in Digital Khatt (ornamented ayah medallion at the end), never clipped mid-word.

- [ ] **Step 4: Commit**

```bash
git add targets/widgets/AyahOfTheDay targets/widgets/WidgetsBundle.swift modules/bayaan-widgets/android
git status --short ios android   # commit regenerated native output only if prebuild changed tracked files
git commit -m "feat(widgets): add the Ayah of the Day widget"
```

---

### Task 9: Continue Reading (iOS and Android)

Small: surah card, large page number, surah name, juz. Medium adds the page's opening words in Digital Khatt and "Continue reading". Tap opens `bayaan://mushaf/{page}`. Empty state: page 1, Al-Fatihah, "Start reading". Data is the 1a snapshot's `lastRead` (already built from `mushafSessionStore`, the page to surah and juz maps, and the opening words). The app flushes the snapshot when it goes to the background, which captures the page just read.

**Files:**
- Create: `targets/widgets/ContinueReading/ContinueReadingWidget.swift`; `modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/continuereading/ContinueReadingWidget.kt`, `ContinueReadingReceiver.kt`; `modules/bayaan-widgets/android/src/main/res/xml/continue_reading_info.xml`
- Modify: `targets/widgets/WidgetsBundle.swift`, `AndroidManifest.xml`, `strings.xml`, `BayaanWidgetsModule.kt`

**Interfaces:**
- Consumes: `SnapshotStore.load()?.lastRead` (`WidgetLastRead {page, surahId, surahName, juz, openingText}`), `StaticData.surah`, `SurahCard`, `ArtworkRequestStore.recordMissing`, `WidgetFonts.quran` (iOS); `GlanceState`, `SnapshotModels`, `SurahCard`, `ArabicText`, `deepLink` (Android).
- Produces: iOS kind `ContinueReading` with `ContinueReadingView` handling `.systemSmall` and `.systemMedium` (Task 11 adds `.accessoryRectangular`); Android `ContinueReadingWidget`.

- [ ] **Step 1: iOS widget**

```swift
// targets/widgets/ContinueReading/ContinueReadingWidget.swift
import SwiftUI
import WidgetKit

struct ContinueReadingEntry: TimelineEntry {
  let date: Date
  let lastRead: WidgetLastRead?
}

struct ContinueReadingProvider: TimelineProvider {
  func placeholder(in context: Context) -> ContinueReadingEntry {
    ContinueReadingEntry(date: .now, lastRead: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (ContinueReadingEntry) -> Void) {
    completion(ContinueReadingEntry(date: .now, lastRead: SnapshotStore.load()?.lastRead))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ContinueReadingEntry>) -> Void) {
    let lastRead = SnapshotStore.load()?.lastRead
    if let surah = StaticData.surah(lastRead?.surahId ?? 1) {
      ArtworkRequestStore.recordMissing(surahs: [surah], reciterFiles: [])
    }
    completion(Timeline(entries: [ContinueReadingEntry(date: .now, lastRead: lastRead)], policy: .never))
  }
}

struct ContinueReadingWidget: Widget {
  let kind = "ContinueReading"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ContinueReadingProvider()) { entry in
      ContinueReadingView(entry: entry)
    }
    .configurationDisplayName("Continue Reading")
    .description("Return to the page you were reading.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

struct ContinueReadingView: View {
  @Environment(\.widgetFamily) private var family
  let entry: ContinueReadingEntry

  private var page: Int { entry.lastRead?.page ?? 1 }
  private var surah: StaticSurah? { StaticData.surah(entry.lastRead?.surahId ?? 1) }
  private var surahName: String { entry.lastRead?.surahName ?? surah?.name ?? "Al-Fatihah" }
  private var detail: String { entry.lastRead.map { "Juz \($0.juz)" } ?? "Start reading" }

  var body: some View {
    content
      .foregroundStyle(.white)
      .containerBackground(for: .widget) { WidgetPalette.background }
      .widgetURL(URL(string: "bayaan://mushaf/\(page)"))
  }

  @ViewBuilder private var content: some View {
    if family == .systemMedium {
      HStack(spacing: 14) {
        pageColumn(showLogo: false)
        VStack(alignment: .trailing, spacing: 6) {
          BayaanLogo(size: 14)
          Spacer(minLength: 0)
          if let opening = entry.lastRead?.openingText, !opening.isEmpty {
            Text(opening)
              .font(WidgetFonts.quran(22))
              .multilineTextAlignment(.trailing)
              .lineLimit(2)
              .minimumScaleFactor(0.5)
              .environment(\.layoutDirection, .rightToLeft)
              .frame(maxWidth: .infinity, alignment: .trailing)
          }
          Text(entry.lastRead == nil ? "Start reading" : "Continue reading")
            .font(.caption.weight(.semibold)).opacity(0.75)
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
      }
      .padding(14)
    } else {
      pageColumn(showLogo: true).padding(14)
    }
  }

  private func pageColumn(showLogo: Bool) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack(alignment: .top) {
        SurahCard(surah: surah, size: 44)
        if showLogo {
          Spacer(minLength: 0)
          BayaanLogo(size: 14)
        }
      }
      Spacer(minLength: 0)
      Text("\(page)").font(.system(size: 34, weight: .bold, design: .rounded)).minimumScaleFactor(0.7)
      Text(surahName).font(.caption.weight(.semibold)).lineLimit(1)
      Text(detail).font(.caption2).opacity(0.7).lineLimit(1)
    }
  }
}

#Preview("Small", as: .systemSmall) {
  ContinueReadingWidget()
} timeline: {
  ContinueReadingEntry(date: .now, lastRead: WidgetLastRead(page: 293, surahId: 18, surahName: "Al-Kahf", juz: 15, openingText: "ٱلْحَمْدُ لِلَّهِ ٱلَّذِىٓ أَنزَلَ"))
  ContinueReadingEntry(date: .now, lastRead: nil)
}

#Preview("Medium", as: .systemMedium) {
  ContinueReadingWidget()
} timeline: {
  ContinueReadingEntry(date: .now, lastRead: WidgetLastRead(page: 293, surahId: 18, surahName: "Al-Kahf", juz: 15, openingText: "ٱلْحَمْدُ لِلَّهِ ٱلَّذِىٓ أَنزَلَ"))
  ContinueReadingEntry(date: .now, lastRead: nil)
}
```

Add `ContinueReadingWidget()` to `WidgetsBundle`.

- [ ] **Step 2: Android widget**

```kotlin
// continuereading/ContinueReadingWidget.kt
package expo.modules.bayaanwidgets.continuereading

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
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
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
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.SnapshotModels
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.WidgetLastRead
import expo.modules.bayaanwidgets.ui.ArabicText
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.ui.SurahCard
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.deepLink

class ContinueReadingWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.SMALL, WidgetSizes.MEDIUM))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      val lastRead = remember(inputs.snapshotJson) { inputs.snapshotJson?.let { SnapshotModels.decode(it) }?.lastRead }
      Content(context, lastRead)
    }
  }

  @Composable
  private fun Content(context: Context, lastRead: WidgetLastRead?) {
    val size = LocalSize.current
    val page = lastRead?.page ?: 1
    val root = GlanceModifier.fillMaxSize().background(WidgetColors.BACKGROUND).cornerRadius(20.dp)
      .padding(14.dp).clickable(deepLink(context, "bayaan://mushaf/$page"))
    if (size.width >= WidgetSizes.MEDIUM.width) {
      Row(root) {
        PageColumn(context, lastRead, showLogo = false, GlanceModifier.width(110.dp).fillMaxHeight())
        Spacer(GlanceModifier.width(14.dp))
        Column(GlanceModifier.defaultWeight().fillMaxHeight(), horizontalAlignment = Alignment.End) {
          Logo(14)
          Spacer(GlanceModifier.defaultWeight())
          val opening = lastRead?.openingText.orEmpty()
          if (opening.isNotEmpty()) {
            ArabicText(context, opening, ArabicBitmap.QURAN_FONT, size.width.value - 28 - 14 - 110, 50f, 22f, 12f, 2, center = false)
            Spacer(GlanceModifier.height(4.dp))
          }
          Text(if (lastRead == null) "Start reading" else "Continue reading", maxLines = 1,
            style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp, fontWeight = FontWeight.Bold))
        }
      }
    } else {
      PageColumn(context, lastRead, showLogo = true, root)
    }
  }

  @Composable
  private fun PageColumn(context: Context, lastRead: WidgetLastRead?, showLogo: Boolean, modifier: GlanceModifier) {
    val surah = StaticData.surah(context, lastRead?.surahId ?: 1)
    Column(modifier) {
      Row(GlanceModifier.fillMaxWidth()) {
        SurahCard(context, surah, 44)
        if (showLogo) {
          Spacer(GlanceModifier.defaultWeight())
          Logo(14)
        }
      }
      Spacer(GlanceModifier.defaultWeight())
      Text("${lastRead?.page ?: 1}", style = TextStyle(color = WidgetColors.WHITE, fontSize = 30.sp, fontWeight = FontWeight.Bold))
      Text(lastRead?.surahName ?: surah?.name ?: "Al-Fatihah", maxLines = 1,
        style = TextStyle(color = WidgetColors.WHITE, fontSize = 12.sp, fontWeight = FontWeight.Bold))
      Text(lastRead?.let { "Juz ${it.juz}" } ?: "Start reading", maxLines = 1,
        style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp))
    }
  }
}
```

```kotlin
// continuereading/ContinueReadingReceiver.kt
package expo.modules.bayaanwidgets.continuereading

import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver

class ContinueReadingReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = ContinueReadingWidget()
}
```

`res/xml/continue_reading_info.xml`:

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/bayaan_widget_continue_reading_desc"
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

`strings.xml`:

```xml
  <string name="bayaan_widget_continue_reading_label">Continue Reading</string>
  <string name="bayaan_widget_continue_reading_desc">Return to the page you were reading.</string>
```

`AndroidManifest.xml`:

```xml
    <receiver
      android:name="expo.modules.bayaanwidgets.continuereading.ContinueReadingReceiver"
      android:exported="true"
      android:label="@string/bayaan_widget_continue_reading_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
      </intent-filter>
      <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/continue_reading_info" />
    </receiver>
```

`BayaanWidgetsModule.reloadWidgets` branch (import `expo.modules.bayaanwidgets.continuereading.ContinueReadingWidget`):

```kotlin
          "ContinueReading" -> push(ContinueReadingWidget())
```

- [ ] **Step 3: Build both platforms**

```bash
npm run prebuild
xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20
cd android && ./gradlew :bayaan-widgets:testReleaseUnitTest && ./gradlew :app:assembleRelease
```
Expected: `BUILD SUCCEEDED`; tests pass; release build succeeds.

- [ ] **Step 4: Commit**

```bash
git add targets/widgets/ContinueReading targets/widgets/WidgetsBundle.swift modules/bayaan-widgets/android
git status --short ios android   # commit regenerated native output only if prebuild changed tracked files
git commit -m "feat(widgets): add the Continue Reading widget"
```

---
### Task 10: Tasbeeh (iOS and Android)

Small: the dhikr in Scheherazade New, the count inside a ring toward `repeatCount`; the whole widget is a +1 button. Medium: the ring is the +1 button, plus translation and a round reset button; the rest opens `bayaan://adhkar`. Taps never open the app: iOS runs a plain `AppIntent` in the extension, Android a Glance `ActionCallback`; both append to the pending list (Tasks 3 and 4) and the widget shows `snapshot count + pending`. The app applies the taps on its next start or foreground (Task 5). At midnight the count shows 0.

**Files:**
- Create: `targets/widgets/Tasbeeh/TasbeehWidget.swift`; `modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/tasbeeh/TasbeehWidget.kt`, `TasbeehActions.kt`, `TasbeehReceiver.kt`, `TasbeehConfigActivity.kt`; `modules/bayaan-widgets/android/src/main/res/xml/tasbeeh_info.xml`
- Modify: `targets/widgets/WidgetsBundle.swift`, `ayahoftheday/MidnightReceiver.kt` (add Tasbeeh), `AndroidManifest.xml`, `strings.xml`, `BayaanWidgetsModule.kt`

**Interfaces:**
- Consumes: `DhikrEntity`, `CatalogStore`, `PendingTasbeehStore.read/add`, `WidgetLogic.tasbeehDisplayCount/tasbeehProgress/localDayKey/nextMidnight`, `WidgetFonts.dhikr`, `RoundIntentButton`, `RoundGlyph` (iOS); `WidgetConfigJson.decodeTasbeeh`, `CatalogModels`, `TasbeehLogic`, `DayMath.localDayKey`, `WidgetStorage.addPendingTasbeeh`, `RingBitmap`, `ArabicText`, `ArabicBitmap.DHIKR_FONT`, `GlanceState`, `MidnightReceiver` (Android).
- Produces: iOS kind `Tasbeeh` with `TasbeehView` (Task 11 adds `.accessoryCircular`), `TasbeehEntry {date, dhikr, count}`, `IncrementTasbeehIntent(dhikrId:)`, `ResetTasbeehIntent(dhikrId:)`, `TasbeehRing(count:target:size:)`; Android `TasbeehWidget`, `IncrementTasbeehAction`, `ResetTasbeehAction`, `TasbeehReceiver`, `TasbeehConfigActivity`.

- [ ] **Step 1: iOS widget and in-extension intents**

```swift
// targets/widgets/Tasbeeh/TasbeehWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

/// +1 without opening the app: a plain AppIntent runs in the extension.
struct IncrementTasbeehIntent: AppIntent {
  static var title: LocalizedStringResource = "Count Dhikr"
  static var isDiscoverable = false

  @Parameter(title: "Dhikr") var dhikrId: String

  init() {}

  init(dhikrId: String) {
    self.dhikrId = dhikrId
  }

  func perform() async throws -> some IntentResult {
    PendingTasbeehStore.add(dhikrId: dhikrId, reset: false)
    return .result()
  }
}

struct ResetTasbeehIntent: AppIntent {
  static var title: LocalizedStringResource = "Reset Dhikr"
  static var isDiscoverable = false

  @Parameter(title: "Dhikr") var dhikrId: String

  init() {}

  init(dhikrId: String) {
    self.dhikrId = dhikrId
  }

  func perform() async throws -> some IntentResult {
    PendingTasbeehStore.add(dhikrId: dhikrId, reset: true)
    return .result()
  }
}

struct TasbeehConfigIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "Tasbeeh"
  static var description = IntentDescription("Count a dhikr from the Home Screen.")
  /// سُبْحَانَ اللَّهِ وَبِحَمْدِهِ, 100 times (DEFAULT_TASBEEH_DHIKR_ID in buildCatalog.ts).
  static let defaultDhikrId = "91"

  @Parameter(title: "Dhikr") var dhikr: DhikrEntity?
}

struct TasbeehEntry: TimelineEntry {
  let date: Date
  let dhikr: WidgetCatalogDhikr?
  let count: Int
}

struct TasbeehProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> TasbeehEntry {
    TasbeehEntry(date: .now, dhikr: nil, count: 0)
  }

  func snapshot(for configuration: TasbeehConfigIntent, in context: Context) async -> TasbeehEntry {
    entry(for: configuration, at: .now)
  }

  // A second entry at midnight shows the new day's count (0) without a reload.
  func timeline(for configuration: TasbeehConfigIntent, in context: Context) async -> Timeline<TasbeehEntry> {
    let now = Date.now
    let midnight = WidgetLogic.nextMidnight(after: now)
    return Timeline(entries: [entry(for: configuration, at: now), entry(for: configuration, at: midnight)],
                    policy: .atEnd)
  }

  private func entry(for configuration: TasbeehConfigIntent, at date: Date) -> TasbeehEntry {
    let catalog = CatalogStore.load()
    let dhikr = catalog?.dhikr(configuration.dhikr?.id ?? TasbeehConfigIntent.defaultDhikrId)
      ?? catalog?.dhikr(TasbeehConfigIntent.defaultDhikrId)
    guard let dhikr else { return TasbeehEntry(date: date, dhikr: nil, count: 0) }
    let count = WidgetLogic.tasbeehDisplayCount(
      entry: SnapshotStore.load()?.tasbeeh[dhikr.id], pending: PendingTasbeehStore.read(),
      dhikrId: dhikr.id, today: WidgetLogic.localDayKey(date))
    return TasbeehEntry(date: date, dhikr: dhikr, count: count)
  }
}

struct TasbeehWidget: Widget {
  let kind = "Tasbeeh"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: TasbeehConfigIntent.self, provider: TasbeehProvider()) { entry in
      TasbeehView(entry: entry)
    }
    .configurationDisplayName("Tasbeeh")
    .description("Count a dhikr without opening the app.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

struct TasbeehRing: View {
  let count: Int
  let target: Int
  let size: CGFloat

  var body: some View {
    ZStack {
      Circle().stroke(.white.opacity(0.2), lineWidth: 5)
      Circle()
        .trim(from: 0, to: WidgetLogic.tasbeehProgress(count: count, target: target))
        .stroke(.white, style: StrokeStyle(lineWidth: 5, lineCap: .round))
        .rotationEffect(.degrees(-90))
      VStack(spacing: 0) {
        Text("\(count)").font(.system(size: size * 0.3, weight: .bold, design: .rounded)).minimumScaleFactor(0.5)
        Text("/ \(target)").font(.system(size: size * 0.13, weight: .medium)).opacity(0.6)
      }
      .padding(8)
    }
    .frame(width: size, height: size)
  }
}

struct TasbeehView: View {
  @Environment(\.widgetFamily) private var family
  let entry: TasbeehEntry

  var body: some View {
    Group {
      if let dhikr = entry.dhikr {
        if family == .systemSmall { small(dhikr) } else { medium(dhikr) }
      } else {
        VStack(spacing: 6) {
          BayaanLogo(size: 20)
          Text("Open Bayaan to set up Tasbeeh").font(.caption.weight(.semibold)).multilineTextAlignment(.center)
        }
        .padding(12)
      }
    }
    .foregroundStyle(.white)
    .containerBackground(for: .widget) { WidgetPalette.background }
    .widgetURL(URL(string: "bayaan://adhkar"))
  }

  private func dhikrText(_ dhikr: WidgetCatalogDhikr, size: CGFloat, alignment: TextAlignment) -> some View {
    Text(dhikr.arabic)
      .font(WidgetFonts.dhikr(size))
      .multilineTextAlignment(alignment)
      .lineLimit(2)
      .minimumScaleFactor(0.6)
      .environment(\.layoutDirection, .rightToLeft)
  }

  private func small(_ dhikr: WidgetCatalogDhikr) -> some View {
    Button(intent: IncrementTasbeehIntent(dhikrId: dhikr.id)) {
      VStack(spacing: 4) {
        HStack { Spacer(minLength: 0); BayaanLogo(size: 12) }
        dhikrText(dhikr, size: 17, alignment: .center)
        Spacer(minLength: 0)
        TasbeehRing(count: entry.count, target: dhikr.repeatCount, size: 64)
      }
      .padding(12)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Count, \(entry.count) of \(dhikr.repeatCount)")
  }

  private func medium(_ dhikr: WidgetCatalogDhikr) -> some View {
    HStack(spacing: 14) {
      Button(intent: IncrementTasbeehIntent(dhikrId: dhikr.id)) {
        TasbeehRing(count: entry.count, target: dhikr.repeatCount, size: 100)
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Count, \(entry.count) of \(dhikr.repeatCount)")
      VStack(alignment: .trailing, spacing: 6) {
        HStack {
          RoundIntentButton(intent: ResetTasbeehIntent(dhikrId: dhikr.id), systemName: "arrow.counterclockwise", label: "Reset")
          Spacer(minLength: 0)
          BayaanLogo(size: 14)
        }
        Spacer(minLength: 0)
        dhikrText(dhikr, size: 20, alignment: .trailing)
          .frame(maxWidth: .infinity, alignment: .trailing)
        if let translation = dhikr.translation {
          Text(translation).font(.caption2).opacity(0.7).lineLimit(2).multilineTextAlignment(.trailing)
        }
      }
      .frame(maxWidth: .infinity)
    }
    .padding(14)
  }
}

#Preview("Small", as: .systemSmall) {
  TasbeehWidget()
} timeline: {
  TasbeehEntry(date: .now, dhikr: WidgetCatalogDhikr(id: "91", arabic: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", translation: "How perfect Allah is and I praise Him.", repeatCount: 100), count: 42)
  TasbeehEntry(date: .now, dhikr: nil, count: 0)
}

#Preview("Medium", as: .systemMedium) {
  TasbeehWidget()
} timeline: {
  TasbeehEntry(date: .now, dhikr: WidgetCatalogDhikr(id: "91", arabic: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", translation: "How perfect Allah is and I praise Him.", repeatCount: 100), count: 100)
}
```

Add `TasbeehWidget()` to `WidgetsBundle`.

- [ ] **Step 2: Android widget, actions, configuration**

```kotlin
// tasbeeh/TasbeehActions.kt
package expo.modules.bayaanwidgets.tasbeeh

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback
import expo.modules.bayaanwidgets.DayMath
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.WidgetStorage
import java.util.TimeZone

object TasbeehActions {
  val DHIKR_ID = ActionParameters.Key<String>("dhikrId")
}

private suspend fun record(context: Context, parameters: ActionParameters, reset: Boolean) {
  val dhikrId = parameters[TasbeehActions.DHIKR_ID] ?: return
  WidgetStorage.addPendingTasbeeh(context, dhikrId, DayMath.localDayKey(System.currentTimeMillis(), TimeZone.getDefault()), reset)
  GlanceState.push(context, TasbeehWidget())
}

/** +1 in place: runs in the app process without JS or an activity. */
class IncrementTasbeehAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) =
    record(context, parameters, reset = false)
}

class ResetTasbeehAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) =
    record(context, parameters, reset = true)
}
```

```kotlin
// tasbeeh/TasbeehWidget.kt
package expo.modules.bayaanwidgets.tasbeeh

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
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import expo.modules.bayaanwidgets.ArabicBitmap
import expo.modules.bayaanwidgets.CatalogDhikr
import expo.modules.bayaanwidgets.CatalogModels
import expo.modules.bayaanwidgets.DayMath
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.R
import expo.modules.bayaanwidgets.RingBitmap
import expo.modules.bayaanwidgets.SnapshotModels
import expo.modules.bayaanwidgets.TasbeehLogic
import expo.modules.bayaanwidgets.WidgetConfigJson
import expo.modules.bayaanwidgets.WidgetInputs
import expo.modules.bayaanwidgets.ui.ArabicText
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.ui.RoundButton
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.deepLink
import expo.modules.bayaanwidgets.ui.dpToPx
import java.util.TimeZone

class TasbeehWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.SMALL, WidgetSizes.MEDIUM))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      Content(context, inputs)
    }
  }

  @Composable
  private fun Content(context: Context, inputs: WidgetInputs) {
    val root = GlanceModifier.fillMaxSize().background(WidgetColors.BACKGROUND).cornerRadius(20.dp)
    val catalog = remember(inputs.catalogJson) { inputs.catalogJson?.let { CatalogModels.decode(it) } }
    val config = WidgetConfigJson.decodeTasbeeh(inputs.configJson)
    val dhikr = catalog?.dhikr(config.dhikrId) ?: catalog?.dhikr(WidgetConfigJson.DEFAULT_DHIKR_ID)
    if (dhikr == null) {
      Column(root.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalAlignment = Alignment.CenterVertically) {
        Logo(20)
        Spacer(GlanceModifier.height(6.dp))
        Text("Open Bayaan to set up Tasbeeh", style = TextStyle(color = WidgetColors.WHITE, fontSize = 12.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center))
      }
      return
    }
    val snapshot = remember(inputs.snapshotJson) { inputs.snapshotJson?.let { SnapshotModels.decode(it) } }
    val count = TasbeehLogic.displayCount(
      snapshot?.tasbeeh?.get(dhikr.id), TasbeehLogic.parse(inputs.pendingTasbeehJson), dhikr.id,
      DayMath.localDayKey(System.currentTimeMillis(), TimeZone.getDefault()),
    )
    val increment = actionRunCallback<IncrementTasbeehAction>(actionParametersOf(TasbeehActions.DHIKR_ID to dhikr.id))
    val size = LocalSize.current
    if (size.width >= WidgetSizes.MEDIUM.width) {
      val reset = actionRunCallback<ResetTasbeehAction>(actionParametersOf(TasbeehActions.DHIKR_ID to dhikr.id))
      Row(root.padding(14.dp).clickable(deepLink(context, "bayaan://adhkar")), verticalAlignment = Alignment.CenterVertically) {
        Box(GlanceModifier.clickable(increment)) { Ring(context, count, dhikr.repeatCount, 84) }
        Spacer(GlanceModifier.width(14.dp))
        Column(GlanceModifier.defaultWeight().fillMaxHeight(), horizontalAlignment = Alignment.End) {
          Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            RoundButton(R.drawable.widget_reset, "Reset", reset)
            Spacer(GlanceModifier.defaultWeight())
            Logo(14)
          }
          Spacer(GlanceModifier.defaultWeight())
          ArabicText(context, dhikr.arabic, ArabicBitmap.DHIKR_FONT, size.width.value - 28 - 14 - 84, 44f, 20f, 12f, 2, center = false)
          Translation(dhikr)
        }
      }
      return
    }
    Column(root.padding(12.dp).clickable(increment), horizontalAlignment = Alignment.CenterHorizontally) {
      Row(GlanceModifier.fillMaxWidth()) {
        Spacer(GlanceModifier.defaultWeight())
        Logo(12)
      }
      ArabicText(context, dhikr.arabic, ArabicBitmap.DHIKR_FONT, size.width.value - 24, 34f, 17f, 10f, 2, center = true)
      Spacer(GlanceModifier.defaultWeight())
      Ring(context, count, dhikr.repeatCount, 60)
    }
  }

  @Composable
  private fun Translation(dhikr: CatalogDhikr) {
    val translation = dhikr.translation ?: return
    Text(translation, maxLines = 2, style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp, textAlign = TextAlign.End))
  }

  @Composable
  private fun Ring(context: Context, count: Int, target: Int, sizeDp: Int) {
    val px = dpToPx(context, sizeDp)
    val bmp = remember(count, target, px) {
      RingBitmap.render(px, px * 0.07f, TasbeehLogic.progress(count, target), android.graphics.Color.WHITE, 0x33FFFFFF)
    }
    Box(GlanceModifier.size(sizeDp.dp), contentAlignment = Alignment.Center) {
      Image(ImageProvider(bmp), contentDescription = "Count, $count of $target", modifier = GlanceModifier.fillMaxSize())
      Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text("$count", style = TextStyle(color = WidgetColors.WHITE, fontSize = (sizeDp * 0.28f).sp, fontWeight = FontWeight.Bold))
        Text("/ $target", style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 10.sp))
      }
    }
  }
}
```

```kotlin
// tasbeeh/TasbeehReceiver.kt
package expo.modules.bayaanwidgets.tasbeeh

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import expo.modules.bayaanwidgets.WidgetStorage
import expo.modules.bayaanwidgets.ayahoftheday.MidnightReceiver

class TasbeehReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = TasbeehWidget()

  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    super.onUpdate(context, appWidgetManager, appWidgetIds)
    MidnightReceiver.schedule(context)
  }

  override fun onDeleted(context: Context, appWidgetIds: IntArray) {
    super.onDeleted(context, appWidgetIds)
    WidgetStorage.deleteConfigs(context, appWidgetIds)
  }

  override fun onDisabled(context: Context) {
    super.onDisabled(context)
    MidnightReceiver.cancelIfUnused(context)
  }
}
```

```kotlin
// tasbeeh/TasbeehConfigActivity.kt
package expo.modules.bayaanwidgets.tasbeeh

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import expo.modules.bayaanwidgets.CatalogModels
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.TasbeehConfig
import expo.modules.bayaanwidgets.WidgetConfigJson
import expo.modules.bayaanwidgets.WidgetStorage
import expo.modules.bayaanwidgets.ui.ConfigPicker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** Picks the dhikr from the catalog. */
class TasbeehConfigActivity : Activity() {
  private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    appWidgetId = intent?.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
      ?: AppWidgetManager.INVALID_APPWIDGET_ID
    setResult(RESULT_CANCELED, result())
    if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
      finish()
      return
    }
    val adhkar = WidgetStorage.readCatalogJson(this)?.let { CatalogModels.decode(it) }?.adhkar.orEmpty()
    if (adhkar.isEmpty()) {
      Toast.makeText(this, "Open Bayaan once to load adhkar", Toast.LENGTH_LONG).show()
      save(TasbeehConfig(WidgetConfigJson.DEFAULT_DHIKR_ID))
      return
    }
    ConfigPicker.pick(this, "Tasbeeh", adhkar.map { "${it.arabic} (${it.repeatCount})" },
      onPick = { i -> save(TasbeehConfig(adhkar[i].id)) },
      onCancel = { finish() })
  }

  private fun result(): Intent = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)

  private fun save(config: TasbeehConfig) {
    WidgetStorage.writeConfig(this, appWidgetId, WidgetConfigJson.encode(config))
    setResult(RESULT_OK, result())
    val ctx = applicationContext
    CoroutineScope(Dispatchers.Default).launch { runCatching { GlanceState.push(ctx, TasbeehWidget()) } }
    finish()
  }
}
```

In `ayahoftheday/MidnightReceiver.kt`: change `PROVIDERS` to

```kotlin
    private val PROVIDERS: List<Class<*>> = listOf(AyahOfTheDayReceiver::class.java, TasbeehReceiver::class.java)
```

(delete the "Task 10 adds TasbeehReceiver." comment), add `runCatching { GlanceState.push(app, TasbeehWidget()) }` after the Ayah push in `onReceive`, and import `expo.modules.bayaanwidgets.tasbeeh.TasbeehReceiver` and `expo.modules.bayaanwidgets.tasbeeh.TasbeehWidget`.

`res/xml/tasbeeh_info.xml`:

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/bayaan_widget_tasbeeh_desc"
  android:minWidth="110dp"
  android:minHeight="110dp"
  android:targetCellWidth="2"
  android:targetCellHeight="2"
  android:maxResizeWidth="400dp"
  android:maxResizeHeight="200dp"
  android:resizeMode="horizontal|vertical"
  android:updatePeriodMillis="0"
  android:widgetCategory="home_screen"
  android:configure="expo.modules.bayaanwidgets.tasbeeh.TasbeehConfigActivity"
  android:widgetFeatures="reconfigurable|configuration_optional"
  android:initialLayout="@layout/glance_default_loading_layout" />
```

`strings.xml`:

```xml
  <string name="bayaan_widget_tasbeeh_label">Tasbeeh</string>
  <string name="bayaan_widget_tasbeeh_desc">Count a dhikr without opening the app.</string>
```

`AndroidManifest.xml`:

```xml
    <receiver
      android:name="expo.modules.bayaanwidgets.tasbeeh.TasbeehReceiver"
      android:exported="true"
      android:label="@string/bayaan_widget_tasbeeh_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
      </intent-filter>
      <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/tasbeeh_info" />
    </receiver>
    <activity
      android:name="expo.modules.bayaanwidgets.tasbeeh.TasbeehConfigActivity"
      android:exported="true"
      android:excludeFromRecents="true"
      android:taskAffinity=""
      android:theme="@android:style/Theme.Translucent.NoTitleBar">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_CONFIGURE" />
      </intent-filter>
    </activity>
```

(Glance's own manifest already declares the `ActionCallbackBroadcastReceiver` that runs `actionRunCallback`.)

`BayaanWidgetsModule.reloadWidgets` branch (import `expo.modules.bayaanwidgets.tasbeeh.TasbeehWidget`):

```kotlin
          "Tasbeeh" -> push(TasbeehWidget())
```

- [ ] **Step 3: Build both platforms and check the logic suites**

```bash
npm run prebuild
npm run test:widget-fixtures
xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20
cd android && ./gradlew :bayaan-widgets:testReleaseUnitTest && ./gradlew :app:assembleRelease
```
Expected: both Swift check lines OK; `BUILD SUCCEEDED`; Gradle tests pass; release build succeeds.

- [ ] **Step 4: Commit**

```bash
git add targets/widgets/Tasbeeh targets/widgets/WidgetsBundle.swift modules/bayaan-widgets/android
git status --short ios android   # commit regenerated native output only if prebuild changed tracked files
git commit -m "feat(widgets): add the Tasbeeh widget"
```

---

### Task 11: iOS Lock Screen accessories

| Family | Widget | Content |
|---|---|---|
| Circular | Listening (new kind `ListeningAccessory`) | progress ring around the surah glyph |
| Rectangular | Listening | surah, reciter, time left |
| Inline | Listening | "Al-Kahf · 12m left" |
| Circular | Tasbeeh (added family) | count and ring |
| Rectangular | Continue Reading (added family) | page, surah, juz |

Lock Screen taps only open the app: `bayaan://player`, `bayaan://adhkar`, `bayaan://mushaf/{page}`. `ListeningAccessory` reuses `ContinueListeningProvider` and `ContinueListeningEntry` unchanged.

**Files:**
- Create: `targets/widgets/LockScreen/ListeningAccessoryWidget.swift`
- Modify: `targets/widgets/WidgetsBundle.swift`, `targets/widgets/Tasbeeh/TasbeehWidget.swift`, `targets/widgets/ContinueReading/ContinueReadingWidget.swift`, `targets/widgets/_shared/PlaybackIntents.swift` (one reload line), `modules/bayaan-widgets/ios/BayaanWidgetsModule.swift` (reload mapping)

**Interfaces:**
- Consumes: `ContinueListeningProvider`, `ContinueListeningEntry.playback` (`EffectivePlayback.isPlaying/positionSec/durationSec/trackStart/end/remainingWallSec`), `StaticData.surah(_:).glyph`, `WidgetFonts.surahGlyph`, `WidgetLogic.minutesLeftLabel`, `WidgetLogic.tasbeehProgress`, `BayaanLogo`.
- Produces: iOS kind `ListeningAccessory`; native reload of `ContinueListening` also reloads `ListeningAccessory`.

- [ ] **Step 1: Listening accessory widget**

```swift
// targets/widgets/LockScreen/ListeningAccessoryWidget.swift
import SwiftUI
import WidgetKit

/// Lock Screen listening accessories. Reuses Continue Listening's provider,
/// so it follows the same snapshot, override and track-end entries.
struct ListeningAccessoryWidget: Widget {
  let kind = "ListeningAccessory"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ContinueListeningProvider()) { entry in
      ListeningAccessoryView(entry: entry)
    }
    .configurationDisplayName("Now Listening")
    .description("Your recitation on the Lock Screen.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}

struct ListeningAccessoryView: View {
  @Environment(\.widgetFamily) private var family
  let entry: ContinueListeningEntry

  private var track: WidgetTrack? {
    entry.snapshot?.nowPlaying?.track ?? entry.snapshot?.recent.first
  }

  var body: some View {
    content
      .containerBackground(for: .widget) {
        if family == .accessoryCircular { AccessoryWidgetBackground() } else { Color.clear }
      }
      .widgetURL(URL(string: "bayaan://player"))
  }

  @ViewBuilder private var content: some View {
    switch family {
    case .accessoryCircular: circular
    case .accessoryRectangular: rectangular
    default: inline
    }
  }

  @ViewBuilder private func glyph(_ track: WidgetTrack) -> some View {
    if let surah = StaticData.surah(track.surahId), !track.isUserUpload {
      Text(surah.glyph).font(WidgetFonts.surahGlyph(22)).minimumScaleFactor(0.5)
    } else {
      Image(systemName: "waveform")
    }
  }

  @ViewBuilder private var circular: some View {
    if let track, let p = entry.playback, p.durationSec > 0 {
      if p.isPlaying {
        ProgressView(timerInterval: p.trackStart...p.end, countsDown: false) {
          EmptyView()
        } currentValueLabel: {
          glyph(track)
        }
        .progressViewStyle(.circular)
      } else {
        Gauge(value: p.positionSec, in: 0...p.durationSec) {
          EmptyView()
        } currentValueLabel: {
          glyph(track)
        }
        .gaugeStyle(.accessoryCircularCapacity)
      }
    } else if let track {
      glyph(track)
    } else {
      BayaanLogo(size: 18)
    }
  }

  @ViewBuilder private var rectangular: some View {
    if let track {
      VStack(alignment: .leading, spacing: 1) {
        Text(track.surahName).font(.headline).lineLimit(1).widgetAccentable()
        Text(track.reciterName).font(.caption).lineLimit(1)
        if let p = entry.playback {
          timeLeft(p).font(.caption).monospacedDigit()
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    } else {
      VStack(alignment: .leading) {
        Text("Bayaan").font(.headline)
        Text("Start listening").font(.caption)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  @ViewBuilder private var inline: some View {
    if let track, let p = entry.playback {
      if p.isPlaying {
        Text("\(track.surahName) · \(Text(timerInterval: entry.date...p.end, countsDown: true))")
      } else {
        Text("\(track.surahName) · \(WidgetLogic.minutesLeftLabel(p.remainingWallSec))")
      }
    } else if let track {
      Text(track.surahName)
    } else {
      Text("Bayaan")
    }
  }

  // Live countdown while playing (static text cannot update without reloads).
  @ViewBuilder private func timeLeft(_ p: EffectivePlayback) -> some View {
    if p.isPlaying {
      Text(timerInterval: entry.date...p.end, countsDown: true)
    } else {
      Text(WidgetLogic.minutesLeftLabel(p.remainingWallSec))
    }
  }
}

// Inline copy of the playing state in modules/bayaan-widgets/src/__fixtures__/snapshot.full.json.
private let accessoryPreviewSnapshot = WidgetSnapshot.decode(Data(#"""
{"version":1,"generatedAt":1791460800000,"theme":"dark","nowPlaying":{"track":{"surahId":18,"surahName":"Al-Kahf","reciterId":"r","reciterName":"Mishary Alafasi","rewayatId":null,"artworkFile":null,"isUserUpload":false},"isPlaying":false,"positionSec":600,"durationSec":1800,"rate":1},"upNext":[],"recent":[],"defaultReciter":null,"reciterRecents":{},"lastRead":null,"tasbeeh":{}}
"""#.utf8))

#Preview("Circular", as: .accessoryCircular) {
  ListeningAccessoryWidget()
} timeline: {
  ContinueListeningEntry(date: .now, snapshot: accessoryPreviewSnapshot)
  ContinueListeningEntry(date: .now, snapshot: nil)
}

#Preview("Rectangular", as: .accessoryRectangular) {
  ListeningAccessoryWidget()
} timeline: {
  ContinueListeningEntry(date: .now, snapshot: accessoryPreviewSnapshot)
  ContinueListeningEntry(date: .now, snapshot: nil)
}

#Preview("Inline", as: .accessoryInline) {
  ListeningAccessoryWidget()
} timeline: {
  ContinueListeningEntry(date: .now, snapshot: accessoryPreviewSnapshot)
}
```

Add `ListeningAccessoryWidget()` to `WidgetsBundle`.

- [ ] **Step 2: Reload it with Continue Listening**

In `modules/bayaan-widgets/ios/BayaanWidgetsModule.swift`, replace the `reloadWidgets` function with:

```swift
    // ListeningAccessory reads the same snapshot slice as ContinueListening.
    Function("reloadWidgets") { (kinds: [String]) in
      for kind in kinds {
        WidgetCenter.shared.reloadTimelines(ofKind: kind)
        if kind == "ContinueListening" {
          WidgetCenter.shared.reloadTimelines(ofKind: "ListeningAccessory")
        }
      }
    }
```

In `targets/widgets/_shared/PlaybackIntents.swift`, in `SetPlaybackIntent.perform()`, add after the `reloadTimelines(ofKind: "ContinueListening")` line:

```swift
    WidgetCenter.shared.reloadTimelines(ofKind: "ListeningAccessory")
```

- [ ] **Step 3: Tasbeeh circular**

In `targets/widgets/Tasbeeh/TasbeehWidget.swift`:

1. In `TasbeehWidget`, change `.supportedFamilies([.systemSmall, .systemMedium])` to `.supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular])`.
2. In `TasbeehView.body`, replace the `if family == .systemSmall { small(dhikr) } else { medium(dhikr) }` line with:

```swift
        switch family {
        case .accessoryCircular: circular(dhikr)
        case .systemSmall: small(dhikr)
        default: medium(dhikr)
        }
```

3. Replace `.containerBackground(for: .widget) { WidgetPalette.background }` in `TasbeehView.body` with:

```swift
    .containerBackground(for: .widget) {
      if family == .accessoryCircular { AccessoryWidgetBackground() } else { WidgetPalette.background }
    }
```

4. Add to `TasbeehView`:

```swift
  // Lock Screen: no buttons, the tap opens the adhkar screen.
  private func circular(_ dhikr: WidgetCatalogDhikr) -> some View {
    Gauge(value: WidgetLogic.tasbeehProgress(count: entry.count, target: dhikr.repeatCount)) {
      EmptyView()
    } currentValueLabel: {
      Text("\(entry.count)").font(.system(.body, design: .rounded).weight(.bold)).minimumScaleFactor(0.5)
    }
    .gaugeStyle(.accessoryCircularCapacity)
  }
```

5. Add a preview:

```swift
#Preview("Lock Screen", as: .accessoryCircular) {
  TasbeehWidget()
} timeline: {
  TasbeehEntry(date: .now, dhikr: WidgetCatalogDhikr(id: "33", arabic: "سُبْحانَ رَبِّيَ الْعَظِيمِ", translation: nil, repeatCount: 3), count: 2)
}
```

- [ ] **Step 4: Continue Reading rectangular**

In `targets/widgets/ContinueReading/ContinueReadingWidget.swift`:

1. Change `.supportedFamilies([.systemSmall, .systemMedium])` to `.supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])`.
2. In `ContinueReadingView.content`, insert before `if family == .systemMedium {`:

```swift
    if family == .accessoryRectangular {
      VStack(alignment: .leading, spacing: 1) {
        Text("Page \(page)").font(.headline).widgetAccentable()
        Text(entry.lastRead.map { "\(surahName) · Juz \($0.juz)" } ?? "Start reading").font(.caption).lineLimit(1)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    } else if family == .systemMedium {
```

and change the original `if family == .systemMedium {` line into that `else if` (the rest of the chain stays).

3. In `ContinueReadingView.body`, replace `.containerBackground(for: .widget) { WidgetPalette.background }` with:

```swift
      .containerBackground(for: .widget) {
        if family == .accessoryRectangular { Color.clear } else { WidgetPalette.background }
      }
```

4. Add a preview:

```swift
#Preview("Lock Screen", as: .accessoryRectangular) {
  ContinueReadingWidget()
} timeline: {
  ContinueReadingEntry(date: .now, lastRead: WidgetLastRead(page: 293, surahId: 18, surahName: "Al-Kahf", juz: 15, openingText: ""))
}
```

- [ ] **Step 5: Build and check previews**

```bash
npm run prebuild
xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20
npm run test:ci -- --silent
```
Expected: `BUILD SUCCEEDED`; all Jest suites pass. Look at every accessory preview in Xcode (paused state shows "Al-Kahf · 20m left"). If the circular `ProgressView(timerInterval:)` does not animate on the Lock Screen in Task 12, replace it with the static `Gauge` branch for both states and record it.

- [ ] **Step 6: Commit**

```bash
git add targets/widgets modules/bayaan-widgets/ios/BayaanWidgetsModule.swift
git status --short ios   # commit regenerated native output only if prebuild changed tracked files
git commit -m "feat(widgets): add iOS Lock Screen accessories"
```

---
### Task 12: Device verification and wrap-up

Modeled on 1a's Task 10. Use the argent MCP tools for all simulator and emulator interaction (read `argent-device-interact` first; take tap coordinates from the element tree, never from screenshot pixels). Release builds: the Debug dev client cannot run app JS on a background launch.

**Files:**
- Create: `docs/superpowers/plans/2026-10-10-widgets-phase-1b-device-checklist.md` (results, same table format as the 1a checklist)

- [ ] **Step 1: iOS run on the "Bayaan Widgets" simulator (B68030CC-7E5B-4127-BE07-EFA327BE6680)**

Build Release (Global Constraints command), install with argent `reinstall-app` or `xcrun simctl install B68030CC-7E5B-4127-BE07-EFA327BE6680 ios/build/dd/Build/Products/Release-iphonesimulator/Bayaan.app`, clear `DYLD_INSERT_LIBRARIES` before timing cold starts (`xcrun simctl spawn B68030CC-7E5B-4127-BE07-EFA327BE6680 launchctl unsetenv DYLD_INSERT_LIBRARIES`, per the 1a checklist), launch, play any surah once, open the mushaf to page 293, open the adhkar screen once, then background the app. Record PASS / PARTIAL / FAIL with notes for each:

1. Quick Surah small: add, edit, choose Ar-Rahman and a reciter. Before the app runs again the card is a dark tile with "55" and the name; after opening the app and backgrounding it, the card shows. Tap plays Ar-Rahman with that reciter in place.
2. Quick Surah medium: defaults show Al-Kahf, Ya-Sin, Al-Mulk, Al-Waqi'ah cards; tapping Al-Mulk plays it with the default reciter. The edit sheet shows only Surah and Reciter for small, all five parameters for medium.
3. Pinned Reciter small and medium: photo, name over the scrim, play resumes the reciter's last surah; medium rows play with their rewayah; an unconfigured widget shows the default reciter.
4. Ayah of the Day small, medium, large: Digital Khatt renders like the in-app mushaf for the same ayah (marks, ayah medallion), centered, not clipped; translation and reference correct for today's index; Listen plays from that ayah with the default reciter; tapping elsewhere opens the mushaf at the ayah.
5. Continue Reading small and medium: page 293, Al-Kahf, Juz 15, opening words in Digital Khatt; tap opens page 293. After deleting and reinstalling the app: page 1, Al-Fatihah, "Start reading".
6. Tasbeeh small and medium: swipe the app away, tap +1 five times: the count rises each tap and the app does not open. Reset (medium) shows 0. Open the app: the adhkar counter for that dhikr matches the widget, and the widget does not jump.
7. Lock Screen: add the three listening accessories, Tasbeeh circular and Continue Reading rectangular. Ring and countdown move while playing; paused shows "Nm left"; taps open the player, adhkar and the mushaf page.
8. Continue Listening regression: play/pause in place, up-next row tap, empty state, as in 1a items 2 to 4.
9. iOS 26 tinted and clear modes: cards and photos stay full color; text legible.

- [ ] **Step 2: Android run (boot only now, shut down after)**

Boot the `Pixel_API_36` AVD with argent `boot-device` (`avdName: "Pixel_API_36"`), build `cd android && ./gradlew :app:assembleRelease`, install `android/app/build/outputs/apk/release/app-release.apk` with `adb -s <serial> install -r`, run the same setup as Step 1, then:

10. Repeat items 1 to 6 on Android. Differences by design: play taps open the app (Ruling: `WidgetCommandActivity`), configuration happens in the dialog activity, Arabic is a bitmap. Check the bitmap Arabic against the in-app mushaf (Digital Khatt through StaticLayout was not spiked) and against Scheherazade New for Tasbeeh.
11. Resize each widget through its sizes; layouts switch cleanly. Long-press "Reconfigure" opens the picker for Quick Surah, Pinned Reciter and Tasbeeh.
12. Midnight: `adb -s <serial> root`, `adb -s <serial> shell settings put global auto_time 0`, `adb -s <serial> shell date 101023592026.00` (toybox `MMDDhhmmCCYY.ss`, sets 23:59), wait past midnight: Ayah of the Day moves to the next index and Tasbeeh shows 0 (MidnightReceiver). Restore with `adb -s <serial> shell settings put global auto_time 1`.
13. Pinned Reciter "Reciter unavailable" cannot be produced on a release build without editing app data: mark it "covered by `pinnedReciterResolve` and the iOS preview".

Then shut the emulator down: `adb -s <serial> emu kill`.

- [ ] **Step 3: Fix failures** with superpowers:systematic-debugging, one commit per fix. Known fallbacks: drop `parameterSummary` if `When(widgetFamily:)` misbehaves (Task 6); static `Gauge` if the circular timer progress does not animate (Task 11).

- [ ] **Step 4: Final checks**

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
npm run test:ci -- --silent
npm run test:widget-fixtures
cd android && ./gradlew :bayaan-widgets:testReleaseUnitTest && cd ..
npx prettier --check $(git diff --name-only origin/develop... | grep -E '\.(ts|tsx|js)$')
git diff --name-only origin/develop... | xargs grep -ln $'\xe2\x80\x94' || echo "no em dashes"
```
Expected: all clean; the last line prints `no em dashes`.

- [ ] **Step 5: Commit the checklist**

```bash
git add docs/superpowers/plans/2026-10-10-widgets-phase-1b-device-checklist.md
git commit -m "docs: record widgets phase 1b device verification"
```

Then use superpowers:finishing-a-development-branch (PR targets `develop`).

---

## Spec coverage

| Spec item | Task |
|---|---|
| 5.2 Quick Surah (small, medium 2x2, configurable surah and optional reciter, SurahEntity, Android config activity) | 3, 4, 6 |
| 5.3 Pinned Reciter (photo, scrim, playReciter, recents or popular rows, unavailable state, ReciterEntity) | 3, 4, 7 |
| 5.4 Ayah of the Day (curated list, generated ayat.json with Digital Khatt and Saheeh, date selection, midnight on both platforms, Listen with ayah, deep link, timestamp fallback already in handleWidgetCommand) | 0, 1, 3, 4, 8 |
| 5.5 Continue Reading (page, surah, juz, opening words, mushaf deep link, empty state) | 9 (data from 1a) |
| 5.6 Tasbeeh (configurable dhikr, ring, +1 without the app, medium reset, adhkar font) | 1, 3, 4, 5, 10 |
| 5.7 Lock Screen accessories (five variants, taps open the app) | 11 |
| 4.3 catalog.json | 1, 2, 4, 5 |
| 4.5 Tasbeeh writes (pending counter, day discard, consumption) | 1, 3, 4, 5, 10 |
| 4.6 Deep links (`player`, `mushaf/{page}`, `quran/{surah}?ayah=`, `adhkar`) | 8, 9, 10, 11 (routes from 1a) |
| 4.7 Branding seams | Ruling R10 (scheme stays hardcoded like 1a); App Group derived as in 1a |
| 6 Quran text rendering (SwiftUI Text + Digital Khatt; Android StaticLayout bitmaps) | 2, 3, 4, 8, 9 |
| 7 Edge cases (empty states, missing artwork, schema mismatch, uploads excluded from pickers, rewayah carried, update budget) | 3, 4, 5, 6 to 10 |
| 8 Testing (TS units, shared fixtures in TS/Swift/Kotlin, SwiftUI previews, device checklist) | 0, 1, 3, 4, 5, 6 to 12 |
