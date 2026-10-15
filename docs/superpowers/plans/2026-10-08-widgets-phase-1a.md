# Widgets Phase 1a (Foundations + Continue Listening) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the shared widget plumbing (snapshot bridge, command queue, deep links, iOS extension target, Android Glance host) and prove it end to end with the Continue Listening widget (S/M/L) on iOS and Android.

**Architecture:** A local Expo module `modules/bayaan-widgets` owns a TS snapshot schema and the native bridge (App Group JSON on iOS, SharedPreferences on Android, reload triggers, persisted command queue). iOS widgets are SwiftUI in `targets/widgets/` managed by `@bacons/apple-targets`; App Intents shared with the app live in `targets/widgets/_shared/`. Android widgets are Jetpack Glance inside the same module. JS glue in `services/widgets/` builds snapshots from existing stores and executes widget commands on the player.

**Tech Stack:** Expo SDK 56, RN 0.83, TypeScript strict, Jest (jest-expo), Swift 6 / SwiftUI / WidgetKit / AppIntents (iOS 17+ extension), Kotlin / Jetpack Glance 1.1 / Media3 1.9 (Android).

**Spec:** `docs/superpowers/specs/2026-10-08-widgets-design.md`

**Scope note:** Phase 1 of the spec is split into two plans. This plan (1a) delivers spec sections 3, 4 (all), 5.1, 6 (spike + iOS/Android font plumbing), 7 and 8 as they apply to Continue Listening. Plan 1b (written after 1a lands, reusing what 1a proves on device) delivers 5.2 to 5.7: Quick Surah, Pinned Reciter, Ayah of the Day, Continue Reading, Tasbeeh widgets, configuration pickers, catalog file, and Lock Screen accessories. The snapshot schema in this plan is complete for all Phase 1 widgets so 1b does not churn it.

## Global Constraints

- Branch `osmansaeday/widgets`, based on `origin/develop`. PRs target `develop`. Conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`).
- Never use the em dash character anywhere (code, comments, copy, commits).
- TypeScript strict. No `any`. No `as` casts unless unavoidable (JSON parsing goes through type guards). Explicit parameter and return types. `function` keyword for pure functions. No classes in TS.
- Everything survives `npm run prebuild` (`expo prebuild --clean`). Never hand edit `ios/` or `android/`; commit regenerated output only when prebuild changes it.
- Widget extension deployment target: iOS 17.0. App deployment target stays 16.4.
- App Group id: `group.com.bayaan.app` (already provisioned). Read it at runtime from the `BayaanAppGroup` Info.plist key, never hardcoded in Swift.
- Quran text in widgets uses Digital Khatt (`data/mushaf/digitalkhatt/DigitalKhattFont.otf`). Surah names use `assets/fonts/surah_names.ttf`.
- Widgets never touch the network. All images come from shared storage.
- Before calling a task done: `npx tsc --noEmit` and `npx prettier --write <changed files>` pass clean.
- Xcode 27: `expo run:ios` is broken. Build with `xcodebuild` (see Task 7 Step 8).

## Review Focus

1. **App killed, user taps Play on the widget.** Expect: app process wakes, the command is executed once the player mounts, audio starts within a few seconds; no double play if JS was already alive. Pinned by Task 3 (queue tests) and Task 10 device checklist item 1.
2. **Snapshot written every second while audio plays.** Expect: no widget reload storm; reloads only on track change, play/pause, or queue change. Pinned by Task 4 `changedWidgetKinds` tests.
3. **Fresh install, nothing ever played, reciter catalog not loaded yet.** Expect: widget shows surah of the day with the default reciter, or a neutral empty state if the default reciter is the empty placeholder (`id: ''`). Pinned by Task 4 `buildSnapshot` tests.
4. **Corrupt or future-version snapshot JSON.** Expect: native decoders fall back to last good or empty state; JS guards reject malformed commands from native. Pinned by Task 3 `isWidgetCommand` tests and Task 2 fixture tests.
5. **User upload is the current track.** Expect: shown with its title and the uploader-provided reciter name, `surahId` 0 handled, no crash in pickers. Pinned by Task 4 test.

---

## File Structure

```
modules/bayaan-widgets/
  package.json                         module manifest (autolinked as local module)
  expo-module.config.json              registers Swift and Kotlin modules
  src/
    index.ts                           public JS API (native calls + pure re-exports)
    snapshot.ts                        WidgetSnapshot / WidgetTrack types + version
    commands.ts                        WidgetCommand types, isWidgetCommand, selectFreshCommands
    tasbeeh.ts                         PendingTasbeeh types, mergeTasbeehIncrements, localDayKey
    widgetKinds.ts                     WidgetKind list, changedWidgetKinds
    NativeBayaanWidgets.ts             requireOptionalNativeModule binding (null in Jest/web)
    __fixtures__/snapshot.full.json    shared fixture (TS, Swift, Kotlin decode it)
    __fixtures__/snapshot.empty.json
    __tests__/*.test.ts
  ios/
    BayaanWidgets.podspec
    BayaanWidgetsModule.swift          Expo module: writeSnapshot, reload, queue, events, artwork
  android/
    build.gradle
    src/main/AndroidManifest.xml       widget receivers + command receiver
    src/main/res/xml/continue_listening_info.xml
    src/main/java/expo/modules/bayaanwidgets/
      BayaanWidgetsModule.kt
      WidgetStorage.kt                 SharedPreferences + files, command queue
      SnapshotModels.kt                kotlinx-free JSON decoding (org.json)
      CommandReceiver.kt               widget button broadcasts
      ArtworkStore.kt                  download/resize/tint
      ArabicBitmap.kt                  StaticLayout text rendering (used in 1b, font plumbing now)
      continuelistening/ContinueListeningWidget.kt
      continuelistening/ContinueListeningReceiver.kt
    src/test/java/expo/modules/bayaanwidgets/SnapshotModelsTest.kt
targets/widgets/
  expo-target.config.js
  Info.plist                           BayaanAppGroup key, UIAppFonts
  DigitalKhattFont.otf                 copied by script, see Task 7
  surah_names.ttf
  WidgetsBundle.swift                  @main WidgetBundle
  SnapshotStore.swift                  reads snapshot JSON + artwork from App Group
  ArtworkTint.swift                    CoreImage average color, cached
  ContinueListening/ContinueListeningWidget.swift
  ContinueListening/ContinueListeningViews.swift
  _shared/
    WidgetSnapshot.swift               Codable models (app + extension)
    WidgetCommandQueue.swift           App Group queue + in-process notification
    PlaybackIntents.swift              TogglePlaybackIntent, PlayTrackIntent (AudioPlaybackIntent)
services/widgets/
  buildSnapshot.ts                     pure: SnapshotInput -> WidgetSnapshot
  collectSnapshotInput.ts              reads stores -> SnapshotInput
  syncWidgets.ts                       subscriptions, debounce, write, reload, artwork
  handleWidgetCommand.ts               WidgetCommand -> player
  __tests__/buildSnapshot.test.ts
  __tests__/handleWidgetCommand.test.ts
utils/quranPages.ts                    getJuzForPage, getSurahOfTheDay (extracted)
utils/__tests__/quranPages.test.ts
app/player.tsx                         bayaan://player deep link
app/mushaf/[page].tsx                  stub -> real redirect
app/quran/[surah].tsx                  stub -> real redirect
scripts/sync-widget-fonts.js           copies fonts into targets/widgets
docs/superpowers/spikes/2026-10-08-digital-khatt-coretext.md
```

Modified: `app.config.js` (plugin, entitlements, BayaanAppGroup Info.plist key), `services/audio/ExpoAudioProvider.tsx` (drain commands after player connects), `app/_layout.tsx` (start widget sync), `components/hero/ContinueReadingHero.tsx` (use extracted util), `package.json` (`@bacons/apple-targets`, `bayaan-widgets` local dep, `sync:widget-fonts` script).

---

### Task 0: Install, baseline, and Digital Khatt CoreText spike

The spike gates how Quran text is rendered on iOS (spec section 6). Continue Listening shows no Quran text, so a negative result does not block this plan; it changes Plan 1b.

**Files:**
- Create: `docs/superpowers/spikes/2026-10-08-digital-khatt-coretext.md`
- Scratch (not committed): `$SCRATCH/dk-spike/`

- [ ] **Step 1: Install dependencies and confirm baseline**

```bash
npm ci
npx tsc --noEmit
npm run test:ci -- --silent
```
Expected: all three succeed. Record any pre-existing failures in the task report; do not fix them.

- [ ] **Step 2: Pick 30 dense ayat**

Use these verse keys (long marks, stacked harakat, small high letters, sajda, waqf signs): `2:255 2:282 3:7 4:12 4:176 5:3 6:151 7:54 9:30 11:44 12:4 17:1 18:109 20:39 24:35 27:30 33:56 36:82 39:23 48:29 55:13 57:4 59:22 59:23 59:24 67:1 73:20 96:1 108:1 112:1`.

- [ ] **Step 3: Export the Digital Khatt text for those keys**

`digitalKhattDataService` needs the RN SQLite runtime, so read the bundled DB directly:

```bash
ls data/mushaf/digitalkhatt/*.db
sqlite3 data/mushaf/digitalkhatt/<words db> ".schema"
```
Find the table holding word text by verse key, then export one line per verse to `$SCRATCH/dk-spike/ayat.txt` with `sqlite3 -separator ' ' ... "SELECT group_concat(text, ' ') FROM ... WHERE verse_key = '2:255' ORDER BY word_index"` for each key (loop in bash). Confirm the output matches what the app renders for 1:1 by eye.

- [ ] **Step 4: Render with CoreText (macOS uses the same shaping engine as iOS)**

Create `$SCRATCH/dk-spike/render.swift`:

```swift
import AppKit
import CoreText

let fontURL = URL(fileURLWithPath: CommandLine.arguments[1]) as CFURL
let lines = try String(contentsOfFile: CommandLine.arguments[2], encoding: .utf8)
  .split(separator: "\n").map(String.init)
let outDir = CommandLine.arguments[3]
CTFontManagerRegisterFontsForURL(fontURL, .process, nil)
let descs = CTFontManagerCreateFontDescriptorsFromURL(fontURL) as! [CTFontDescriptor]
let font = CTFontCreateWithFontDescriptor(descs[0], 44, nil)

for (i, line) in lines.enumerated() {
  let para = NSMutableParagraphStyle()
  para.baseWritingDirection = .rightToLeft
  para.alignment = .right
  let attr = NSAttributedString(string: line, attributes: [
    .font: font, .paragraphStyle: para, .foregroundColor: NSColor.black,
  ])
  let size = NSSize(width: 1400, height: 1200)
  let image = NSImage(size: size)
  image.lockFocus()
  NSColor.white.setFill(); NSRect(origin: .zero, size: size).fill()
  attr.draw(with: NSRect(x: 20, y: 20, width: 1360, height: 1160),
            options: [.usesLineFragmentOrigin])
  image.unlockFocus()
  let rep = NSBitmapImageRep(data: image.tiffRepresentation!)!
  try rep.representation(using: .png, properties: [:])!
    .write(to: URL(fileURLWithPath: "\(outDir)/coretext-\(i).png"))
}
```

Run: `swift $SCRATCH/dk-spike/render.swift data/mushaf/digitalkhatt/DigitalKhattFont.otf $SCRATCH/dk-spike/ayat.txt $SCRATCH/dk-spike/out`

- [ ] **Step 5: Render the reference with HarfBuzz (what Skia uses)**

```bash
brew list harfbuzz >/dev/null 2>&1 || brew install harfbuzz
i=0; while IFS= read -r line; do
  hb-view --font-size=44 --margin=20 -o $SCRATCH/dk-spike/out/hb-$i.png \
    data/mushaf/digitalkhatt/DigitalKhattFont.otf "$line"; i=$((i+1)); done < $SCRATCH/dk-spike/ayat.txt
```

- [ ] **Step 6: Compare and decide**

View each pair (Read tool on the PNGs). Check: mark placement, ligatures, kashida/justification glyphs, waqf signs, small high letters. Write `docs/superpowers/spikes/2026-10-08-digital-khatt-coretext.md` with: method, 3 representative side-by-side image observations (describe, do not commit images), verdict **PASS** (CoreText shaping matches HarfBuzz on all 30) or **FAIL** (list the broken keys and symptoms). Verdict decides Plan 1b: PASS means SwiftUI `Text` with the custom font; FAIL means prerendered PNGs via Skia.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/spikes/2026-10-08-digital-khatt-coretext.md
git commit -m "docs: record Digital Khatt CoreText shaping spike"
```

---

### Task 1: Pure page and day utilities

**Files:**
- Create: `utils/quranPages.ts`, `utils/__tests__/quranPages.test.ts`
- Modify: `components/hero/ContinueReadingHero.tsx:10-25`

**Interfaces:**
- Produces: `getJuzForPage(page: number): number`, `getSurahOfTheDay(date: Date): Surah`, `getSurahForPage(page: number): Surah | undefined`

- [ ] **Step 1: Write the failing tests**

```ts
// utils/__tests__/quranPages.test.ts
import {getJuzForPage, getSurahOfTheDay, getSurahForPage} from '../quranPages';

describe('getJuzForPage', () => {
  it.each([
    [1, 1],
    [21, 1],
    [22, 2],
    [281, 14],
    [282, 15],
    [581, 29],
    [582, 30],
    [604, 30],
  ])('page %i is in juz %i', (page, juz) => {
    expect(getJuzForPage(page)).toBe(juz);
  });

  it('clamps out of range pages', () => {
    expect(getJuzForPage(0)).toBe(1);
    expect(getJuzForPage(999)).toBe(30);
  });
});

describe('getSurahOfTheDay', () => {
  it('is deterministic for a date', () => {
    const d = new Date(2026, 9, 8);
    expect(getSurahOfTheDay(d).id).toBe(getSurahOfTheDay(new Date(2026, 9, 8, 23, 59)).id);
  });

  it('changes day to day', () => {
    expect(getSurahOfTheDay(new Date(2026, 9, 8)).id).not.toBe(
      getSurahOfTheDay(new Date(2026, 9, 9)).id,
    );
  });
});

describe('getSurahForPage', () => {
  it('maps page 1 to Al-Fatiha and 604 to An-Nas', () => {
    expect(getSurahForPage(1)?.id).toBe(1);
    expect(getSurahForPage(604)?.id).toBeGreaterThanOrEqual(112);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest utils/__tests__/quranPages.test.ts`
Expected: FAIL, cannot find module `../quranPages`.

- [ ] **Step 3: Implement**

```ts
// utils/quranPages.ts
import {SURAHS, Surah} from '@/data/surahData';

// First page of each juz in the 604-page Madani layout used by Digital Khatt.
const JUZ_START_PAGES: readonly number[] = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302,
  322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

export function getJuzForPage(page: number): number {
  let juz = 1;
  for (let i = 0; i < JUZ_START_PAGES.length; i++) {
    if (page >= JUZ_START_PAGES[i]) juz = i + 1;
  }
  return juz;
}

export function getSurahOfTheDay(date: Date): Surah {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24),
  );
  return SURAHS[dayOfYear % 114];
}

export function getSurahForPage(page: number): Surah | undefined {
  return SURAHS.find(s => {
    const [start, end] = s.pages.split('-').map(Number);
    return page >= start && page <= end;
  });
}
```

- [ ] **Step 4: Point the hero at the util**

In `components/hero/ContinueReadingHero.tsx`, delete the local `getSurahOfTheDay` and `getSurahForPage` functions (lines 10 to 25), add `import {getSurahOfTheDay, getSurahForPage} from '@/utils/quranPages';`, and change each `getSurahOfTheDay()` call to `getSurahOfTheDay(new Date())`.

- [ ] **Step 5: Run tests, typecheck**

Run: `npx jest utils/__tests__/quranPages.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
npx prettier --write utils/quranPages.ts utils/__tests__/quranPages.test.ts components/hero/ContinueReadingHero.tsx
git add utils/quranPages.ts utils/__tests__/quranPages.test.ts components/hero/ContinueReadingHero.tsx
git commit -m "refactor: extract page and surah-of-the-day utils for widgets"
```

---

### Task 2: Module scaffold and snapshot schema with shared fixtures

**Files:**
- Create: `modules/bayaan-widgets/package.json`, `modules/bayaan-widgets/expo-module.config.json`, `modules/bayaan-widgets/src/snapshot.ts`, `modules/bayaan-widgets/src/__fixtures__/snapshot.full.json`, `modules/bayaan-widgets/src/__fixtures__/snapshot.empty.json`, `modules/bayaan-widgets/src/__tests__/snapshot.test.ts`
- Modify: `package.json` (dependency `"bayaan-widgets": "file:./modules/bayaan-widgets"`), `tsconfig.json` only if `modules/` is excluded

**Interfaces:**
- Produces: types `WidgetSnapshot`, `WidgetTrack`, `WidgetReciter`, `WidgetNowPlaying`, `WidgetLastRead`, `WidgetTasbeehEntry`, `WidgetThemeMode`; const `WIDGET_SNAPSHOT_VERSION = 1`; guard `isWidgetSnapshot(value: unknown): value is WidgetSnapshot`.

- [ ] **Step 1: Scaffold manifests**

```json
// modules/bayaan-widgets/package.json
{
  "name": "bayaan-widgets",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts"
}
```

```json
// modules/bayaan-widgets/expo-module.config.json
{
  "platforms": ["apple", "android"],
  "apple": {"modules": ["BayaanWidgetsModule"]},
  "android": {"modules": ["expo.modules.bayaanwidgets.BayaanWidgetsModule"]}
}
```

Add `"bayaan-widgets": "file:./modules/bayaan-widgets"` to root `dependencies`, then `npm install`. Expo autolinking also discovers `modules/*` without the dependency; the dependency makes `import ... from 'bayaan-widgets'` resolve.

- [ ] **Step 2: Write the fixtures**

`snapshot.full.json`:

```json
{
  "version": 1,
  "generatedAt": 1791460800000,
  "theme": "dark",
  "nowPlaying": {
    "track": {
      "surahId": 18,
      "surahName": "Al-Kahf",
      "reciterId": "r-alafasi",
      "reciterName": "Mishary Alafasi",
      "rewayatId": "rw-1",
      "artworkFile": "reciter-r-alafasi.jpg",
      "isUserUpload": false
    },
    "isPlaying": true,
    "positionSec": 120.5,
    "durationSec": 1800
  },
  "upNext": [
    {
      "surahId": 36,
      "surahName": "Ya-Sin",
      "reciterId": "r-alafasi",
      "reciterName": "Mishary Alafasi",
      "rewayatId": "rw-1",
      "artworkFile": "reciter-r-alafasi.jpg",
      "isUserUpload": false
    }
  ],
  "recent": [],
  "defaultReciter": {
    "id": "r-alafasi",
    "name": "Mishary Alafasi",
    "artworkFile": "reciter-r-alafasi.jpg"
  },
  "reciterRecents": {},
  "lastRead": {
    "page": 293,
    "surahId": 18,
    "surahName": "Al-Kahf",
    "juz": 15,
    "openingText": "ٱلْحَمْدُ لِلَّهِ"
  },
  "tasbeeh": {
    "tasbeeh-subhanallah": {"count": 12, "target": 33, "day": "2026-10-08"}
  }
}
```

`snapshot.empty.json`:

```json
{
  "version": 1,
  "generatedAt": 1791460800000,
  "theme": "system",
  "nowPlaying": null,
  "upNext": [],
  "recent": [],
  "defaultReciter": null,
  "reciterRecents": {},
  "lastRead": null,
  "tasbeeh": {}
}
```

- [ ] **Step 3: Write the failing test**

```ts
// modules/bayaan-widgets/src/__tests__/snapshot.test.ts
import full from '../__fixtures__/snapshot.full.json';
import empty from '../__fixtures__/snapshot.empty.json';
import {isWidgetSnapshot, WIDGET_SNAPSHOT_VERSION} from '../snapshot';

describe('isWidgetSnapshot', () => {
  it('accepts the shared fixtures', () => {
    expect(isWidgetSnapshot(full)).toBe(true);
    expect(isWidgetSnapshot(empty)).toBe(true);
  });

  it('rejects a future version', () => {
    expect(isWidgetSnapshot({...full, version: WIDGET_SNAPSHOT_VERSION + 1})).toBe(false);
  });

  it('rejects a malformed track', () => {
    const bad = {...full, upNext: [{surahId: '18'}]};
    expect(isWidgetSnapshot(bad)).toBe(false);
  });

  it('rejects non objects', () => {
    expect(isWidgetSnapshot(null)).toBe(false);
    expect(isWidgetSnapshot('x')).toBe(false);
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npx jest modules/bayaan-widgets/src/__tests__/snapshot.test.ts`
Expected: FAIL, cannot find module `../snapshot`.

- [ ] **Step 5: Implement**

```ts
// modules/bayaan-widgets/src/snapshot.ts
export const WIDGET_SNAPSHOT_VERSION = 1;

export type WidgetThemeMode = 'light' | 'dark' | 'system';

export interface WidgetTrack {
  surahId: number; // 0 for user uploads without a surah
  surahName: string;
  reciterId: string;
  reciterName: string;
  rewayatId: string | null;
  artworkFile: string | null; // file name inside shared artwork dir
  isUserUpload: boolean;
}

export interface WidgetReciter {
  id: string;
  name: string;
  artworkFile: string | null;
}

export interface WidgetNowPlaying {
  track: WidgetTrack;
  isPlaying: boolean;
  positionSec: number; // at generatedAt
  durationSec: number;
}

export interface WidgetLastRead {
  page: number;
  surahId: number;
  surahName: string;
  juz: number;
  openingText: string;
}

export interface WidgetTasbeehEntry {
  count: number;
  target: number;
  day: string; // YYYY-MM-DD local
}

export interface WidgetSnapshot {
  version: typeof WIDGET_SNAPSHOT_VERSION;
  generatedAt: number;
  theme: WidgetThemeMode;
  nowPlaying: WidgetNowPlaying | null;
  upNext: WidgetTrack[];
  recent: WidgetTrack[];
  defaultReciter: WidgetReciter | null;
  reciterRecents: Record<string, WidgetTrack[]>;
  lastRead: WidgetLastRead | null;
  tasbeeh: Record<string, WidgetTasbeehEntry>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export function isWidgetTrack(value: unknown): value is WidgetTrack {
  return (
    isRecord(value) &&
    typeof value.surahId === 'number' &&
    typeof value.surahName === 'string' &&
    typeof value.reciterId === 'string' &&
    typeof value.reciterName === 'string' &&
    isNullableString(value.rewayatId) &&
    isNullableString(value.artworkFile) &&
    typeof value.isUserUpload === 'boolean'
  );
}

function isTrackList(value: unknown): value is WidgetTrack[] {
  return Array.isArray(value) && value.every(isWidgetTrack);
}

function isReciter(value: unknown): value is WidgetReciter {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isNullableString(value.artworkFile)
  );
}

function isNowPlaying(value: unknown): value is WidgetNowPlaying {
  return (
    isRecord(value) &&
    isWidgetTrack(value.track) &&
    typeof value.isPlaying === 'boolean' &&
    typeof value.positionSec === 'number' &&
    typeof value.durationSec === 'number'
  );
}

function isLastRead(value: unknown): value is WidgetLastRead {
  return (
    isRecord(value) &&
    typeof value.page === 'number' &&
    typeof value.surahId === 'number' &&
    typeof value.surahName === 'string' &&
    typeof value.juz === 'number' &&
    typeof value.openingText === 'string'
  );
}

function isTasbeehEntry(value: unknown): value is WidgetTasbeehEntry {
  return (
    isRecord(value) &&
    typeof value.count === 'number' &&
    typeof value.target === 'number' &&
    typeof value.day === 'string'
  );
}

export function isWidgetSnapshot(value: unknown): value is WidgetSnapshot {
  if (!isRecord(value)) return false;
  if (value.version !== WIDGET_SNAPSHOT_VERSION) return false;
  if (typeof value.generatedAt !== 'number') return false;
  if (value.theme !== 'light' && value.theme !== 'dark' && value.theme !== 'system') {
    return false;
  }
  if (value.nowPlaying !== null && !isNowPlaying(value.nowPlaying)) return false;
  if (!isTrackList(value.upNext) || !isTrackList(value.recent)) return false;
  if (value.defaultReciter !== null && !isReciter(value.defaultReciter)) return false;
  if (!isRecord(value.reciterRecents)) return false;
  if (!Object.values(value.reciterRecents).every(isTrackList)) return false;
  if (value.lastRead !== null && !isLastRead(value.lastRead)) return false;
  if (!isRecord(value.tasbeeh)) return false;
  return Object.values(value.tasbeeh).every(isTasbeehEntry);
}
```

If Jest cannot import JSON, confirm `resolveJsonModule` is on in `tsconfig.json` (jest-expo handles `.json` natively).

- [ ] **Step 6: Run tests**

Run: `npx jest modules/bayaan-widgets && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npx prettier --write modules/bayaan-widgets package.json
git add modules/bayaan-widgets package.json package-lock.json
git commit -m "feat(widgets): add bayaan-widgets module with snapshot schema"
```

---

### Task 3: Command and tasbeeh queue logic (pure TS)

**Files:**
- Create: `modules/bayaan-widgets/src/commands.ts`, `modules/bayaan-widgets/src/tasbeeh.ts`, `modules/bayaan-widgets/src/__tests__/commands.test.ts`, `modules/bayaan-widgets/src/__tests__/tasbeeh.test.ts`

**Interfaces:**
- Produces:
  - `type WidgetCommand = {type: 'togglePlayback'} | {type: 'playTrack'; surahId: number; reciterId: string | null; rewayatId: string | null; ayah: number | null} | {type: 'playReciter'; reciterId: string}`
  - `interface QueuedWidgetCommand {command: WidgetCommand; enqueuedAt: number}`
  - `isWidgetCommand(value: unknown): value is WidgetCommand`
  - `parseQueuedCommands(json: string): QueuedWidgetCommand[]`
  - `selectFreshCommands(queued: QueuedWidgetCommand[], now: number, maxAgeMs?: number): WidgetCommand[]` (default 60000)
  - `interface PendingTasbeeh {dhikrId: string; count: number; day: string}`
  - `localDayKey(date: Date): string`
  - `mergeTasbeehIncrements(pending: PendingTasbeeh[], today: string): Record<string, number>`
  - `parsePendingTasbeeh(json: string): PendingTasbeeh[]`

Native queue JSON format (both platforms write exactly this): `[{"command": {...}, "enqueuedAt": 1791460800000}]`. Pending tasbeeh JSON: `[{"dhikrId": "...", "count": 3, "day": "2026-10-08"}]`.

- [ ] **Step 1: Write the failing tests**

```ts
// modules/bayaan-widgets/src/__tests__/commands.test.ts
import {
  isWidgetCommand,
  parseQueuedCommands,
  selectFreshCommands,
  QueuedWidgetCommand,
} from '../commands';

const NOW = 1_791_460_800_000;

describe('isWidgetCommand', () => {
  it('accepts each command shape', () => {
    expect(isWidgetCommand({type: 'togglePlayback'})).toBe(true);
    expect(
      isWidgetCommand({type: 'playTrack', surahId: 18, reciterId: null, rewayatId: null, ayah: 10}),
    ).toBe(true);
    expect(isWidgetCommand({type: 'playReciter', reciterId: 'r1'})).toBe(true);
  });

  it('rejects unknown types and bad fields', () => {
    expect(isWidgetCommand({type: 'deleteEverything'})).toBe(false);
    expect(isWidgetCommand({type: 'playTrack', surahId: 0, reciterId: null, rewayatId: null, ayah: null})).toBe(false);
    expect(isWidgetCommand({type: 'playTrack', surahId: 115, reciterId: null, rewayatId: null, ayah: null})).toBe(false);
    expect(isWidgetCommand({type: 'playReciter', reciterId: ''})).toBe(false);
    expect(isWidgetCommand(null)).toBe(false);
  });
});

describe('parseQueuedCommands', () => {
  it('returns [] for invalid JSON', () => {
    expect(parseQueuedCommands('not json')).toEqual([]);
    expect(parseQueuedCommands('{}')).toEqual([]);
  });

  it('drops malformed entries but keeps valid ones', () => {
    const json = JSON.stringify([
      {command: {type: 'togglePlayback'}, enqueuedAt: NOW},
      {command: {type: 'nope'}, enqueuedAt: NOW},
      {command: {type: 'togglePlayback'}},
    ]);
    expect(parseQueuedCommands(json)).toHaveLength(1);
  });
});

describe('selectFreshCommands', () => {
  it('drops commands older than 60s and orders oldest first', () => {
    const queued: QueuedWidgetCommand[] = [
      {command: {type: 'playReciter', reciterId: 'b'}, enqueuedAt: NOW - 1_000},
      {command: {type: 'togglePlayback'}, enqueuedAt: NOW - 61_000},
      {command: {type: 'playReciter', reciterId: 'a'}, enqueuedAt: NOW - 5_000},
    ];
    expect(selectFreshCommands(queued, NOW)).toEqual([
      {type: 'playReciter', reciterId: 'a'},
      {type: 'playReciter', reciterId: 'b'},
    ]);
  });

  it('collapses consecutive togglePlayback pairs so a double tap is a no-op', () => {
    const queued: QueuedWidgetCommand[] = [
      {command: {type: 'togglePlayback'}, enqueuedAt: NOW - 3_000},
      {command: {type: 'togglePlayback'}, enqueuedAt: NOW - 2_000},
    ];
    expect(selectFreshCommands(queued, NOW)).toEqual([]);
  });

  it('when a play command exists, only the last play command survives', () => {
    const queued: QueuedWidgetCommand[] = [
      {command: {type: 'playReciter', reciterId: 'a'}, enqueuedAt: NOW - 3_000},
      {command: {type: 'togglePlayback'}, enqueuedAt: NOW - 2_000},
      {command: {type: 'playReciter', reciterId: 'b'}, enqueuedAt: NOW - 1_000},
    ];
    expect(selectFreshCommands(queued, NOW)).toEqual([{type: 'playReciter', reciterId: 'b'}]);
  });
});
```

```ts
// modules/bayaan-widgets/src/__tests__/tasbeeh.test.ts
import {localDayKey, mergeTasbeehIncrements, parsePendingTasbeeh} from '../tasbeeh';

describe('localDayKey', () => {
  it('formats local date with zero padding', () => {
    expect(localDayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('mergeTasbeehIncrements', () => {
  it('sums increments per dhikr for today only', () => {
    expect(
      mergeTasbeehIncrements(
        [
          {dhikrId: 'a', count: 3, day: '2026-10-08'},
          {dhikrId: 'a', count: 2, day: '2026-10-08'},
          {dhikrId: 'b', count: 9, day: '2026-10-07'},
          {dhikrId: 'c', count: -4, day: '2026-10-08'},
        ],
        '2026-10-08',
      ),
    ).toEqual({a: 5});
  });
});

describe('parsePendingTasbeeh', () => {
  it('ignores malformed json and entries', () => {
    expect(parsePendingTasbeeh('x')).toEqual([]);
    expect(parsePendingTasbeeh(JSON.stringify([{dhikrId: 'a', count: 1}]))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest modules/bayaan-widgets/src/__tests__/commands.test.ts modules/bayaan-widgets/src/__tests__/tasbeeh.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement commands.ts**

```ts
// modules/bayaan-widgets/src/commands.ts
export type WidgetCommand =
  | {type: 'togglePlayback'}
  | {
      type: 'playTrack';
      surahId: number;
      reciterId: string | null; // null means default reciter
      rewayatId: string | null;
      ayah: number | null; // start from this ayah when timestamps exist
    }
  | {type: 'playReciter'; reciterId: string};

export interface QueuedWidgetCommand {
  command: WidgetCommand;
  enqueuedAt: number;
}

const DEFAULT_MAX_AGE_MS = 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export function isWidgetCommand(value: unknown): value is WidgetCommand {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case 'togglePlayback':
      return true;
    case 'playTrack':
      return (
        typeof value.surahId === 'number' &&
        Number.isInteger(value.surahId) &&
        value.surahId >= 1 &&
        value.surahId <= 114 &&
        isNullableString(value.reciterId) &&
        isNullableString(value.rewayatId) &&
        (value.ayah === null ||
          (typeof value.ayah === 'number' && Number.isInteger(value.ayah) && value.ayah >= 1))
      );
    case 'playReciter':
      return typeof value.reciterId === 'string' && value.reciterId.length > 0;
    default:
      return false;
  }
}

function isQueuedCommand(value: unknown): value is QueuedWidgetCommand {
  return (
    isRecord(value) &&
    typeof value.enqueuedAt === 'number' &&
    isWidgetCommand(value.command)
  );
}

export function parseQueuedCommands(json: string): QueuedWidgetCommand[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isQueuedCommand);
}

export function selectFreshCommands(
  queued: QueuedWidgetCommand[],
  now: number,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): WidgetCommand[] {
  const fresh = queued
    .filter(q => now - q.enqueuedAt <= maxAgeMs)
    .sort((a, b) => a.enqueuedAt - b.enqueuedAt)
    .map(q => q.command);

  const plays = fresh.filter(c => c.type !== 'togglePlayback');
  if (plays.length > 0) return [plays[plays.length - 1]];

  return fresh.length % 2 === 1 ? [{type: 'togglePlayback'}] : [];
}
```

- [ ] **Step 4: Implement tasbeeh.ts**

```ts
// modules/bayaan-widgets/src/tasbeeh.ts
export interface PendingTasbeeh {
  dhikrId: string;
  count: number;
  day: string; // YYYY-MM-DD local
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function mergeTasbeehIncrements(
  pending: PendingTasbeeh[],
  today: string,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const p of pending) {
    if (p.day !== today || p.count <= 0) continue;
    totals[p.dhikrId] = (totals[p.dhikrId] ?? 0) + p.count;
  }
  return totals;
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
    typeof value.day === 'string'
  );
}

export function parsePendingTasbeeh(json: string): PendingTasbeeh[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  return Array.isArray(parsed) ? parsed.filter(isPendingTasbeeh) : [];
}
```

- [ ] **Step 5: Run tests**

Run: `npx jest modules/bayaan-widgets && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npx prettier --write modules/bayaan-widgets/src
git add modules/bayaan-widgets/src
git commit -m "feat(widgets): add command queue and tasbeeh merge logic"
```

---

### Task 4: Snapshot builder and change detection

**Files:**
- Create: `modules/bayaan-widgets/src/widgetKinds.ts`, `modules/bayaan-widgets/src/__tests__/widgetKinds.test.ts`, `services/widgets/buildSnapshot.ts`, `services/widgets/__tests__/buildSnapshot.test.ts`

**Interfaces:**
- Consumes: `WidgetSnapshot`, `WidgetTrack` (Task 2); `getJuzForPage`, `getSurahForPage` (Task 1); `Track` from `@/types/audio`; `RecentlyPlayedTrack` from `@/services/player/store/recentlyPlayedStore`; `Reciter` from `@/data/reciterData`.
- Produces:
  - `type WidgetKind = 'ContinueListening' | 'QuickSurah' | 'PinnedReciter' | 'AyahOfTheDay' | 'ContinueReading' | 'Tasbeeh'`
  - `ALL_WIDGET_KINDS: readonly WidgetKind[]`
  - `changedWidgetKinds(prev: WidgetSnapshot | null, next: WidgetSnapshot): WidgetKind[]`
  - `interface SnapshotInput { now: number; theme: WidgetThemeMode; queueTracks: Track[]; currentIndex: number; isPlaying: boolean; positionSec: number; durationSec: number; recentTracks: RecentlyPlayedTrack[]; defaultReciter: Reciter | null; lastReadPage: number | null; openingTextForPage: (page: number) => string; tasbeeh: Record<string, WidgetTasbeehEntry>; artworkFileFor: (reciterId: string) => string | null; surahOfTheDayId: number }`
  - `buildSnapshot(input: SnapshotInput): WidgetSnapshot`
  - `artworkFileName(reciterId: string): string` returns `reciter-${sanitized}.jpg`

- [ ] **Step 1: Write the failing widgetKinds test**

```ts
// modules/bayaan-widgets/src/__tests__/widgetKinds.test.ts
import full from '../__fixtures__/snapshot.full.json';
import {changedWidgetKinds} from '../widgetKinds';
import {isWidgetSnapshot, WidgetSnapshot} from '../snapshot';

function base(): WidgetSnapshot {
  if (!isWidgetSnapshot(full)) throw new Error('fixture invalid');
  return structuredClone(full);
}

describe('changedWidgetKinds', () => {
  it('reports every kind on first write', () => {
    expect(changedWidgetKinds(null, base())).toHaveLength(6);
  });

  it('ignores position ticks while playing', () => {
    const prev = base();
    const next = base();
    next.generatedAt += 5_000;
    if (next.nowPlaying) next.nowPlaying.positionSec += 5;
    expect(changedWidgetKinds(prev, next)).toEqual([]);
  });

  it('reloads Continue Listening on pause', () => {
    const prev = base();
    const next = base();
    if (next.nowPlaying) next.nowPlaying.isPlaying = false;
    expect(changedWidgetKinds(prev, next)).toEqual(['ContinueListening']);
  });

  it('reloads Continue Reading only when last read changes', () => {
    const prev = base();
    const next = base();
    if (next.lastRead) next.lastRead.page = 294;
    expect(changedWidgetKinds(prev, next)).toEqual(['ContinueReading']);
  });

  it('theme change reloads everything', () => {
    const prev = base();
    const next = {...base(), theme: 'light' as const};
    expect(changedWidgetKinds(prev, next)).toHaveLength(6);
  });
});
```

`structuredClone` exists in Node 18+. If the jest environment lacks it, use `JSON.parse(JSON.stringify(full))` inside the guard.

- [ ] **Step 2: Implement widgetKinds.ts**

```ts
// modules/bayaan-widgets/src/widgetKinds.ts
import {WidgetSnapshot} from './snapshot';

export type WidgetKind =
  | 'ContinueListening'
  | 'QuickSurah'
  | 'PinnedReciter'
  | 'AyahOfTheDay'
  | 'ContinueReading'
  | 'Tasbeeh';

export const ALL_WIDGET_KINDS: readonly WidgetKind[] = [
  'ContinueListening',
  'QuickSurah',
  'PinnedReciter',
  'AyahOfTheDay',
  'ContinueReading',
  'Tasbeeh',
];

// Position is excluded while playing: widgets animate it from
// generatedAt + positionSec, so ticks must not trigger reloads.
function nowPlayingKey(s: WidgetSnapshot): unknown {
  const np = s.nowPlaying;
  if (!np) return null;
  return {
    track: np.track,
    isPlaying: np.isPlaying,
    durationSec: Math.round(np.durationSec),
    pausedAt: np.isPlaying ? null : Math.round(np.positionSec),
  };
}

function sliceFor(kind: WidgetKind, s: WidgetSnapshot): unknown {
  switch (kind) {
    case 'ContinueListening':
      return [nowPlayingKey(s), s.upNext, s.recent, s.defaultReciter];
    case 'QuickSurah':
      return s.defaultReciter;
    case 'PinnedReciter':
      return s.reciterRecents;
    case 'AyahOfTheDay':
      return null;
    case 'ContinueReading':
      return s.lastRead;
    case 'Tasbeeh':
      return s.tasbeeh;
  }
}

export function changedWidgetKinds(
  prev: WidgetSnapshot | null,
  next: WidgetSnapshot,
): WidgetKind[] {
  if (!prev || prev.theme !== next.theme) return [...ALL_WIDGET_KINDS];
  return ALL_WIDGET_KINDS.filter(
    kind => JSON.stringify(sliceFor(kind, prev)) !== JSON.stringify(sliceFor(kind, next)),
  );
}
```

- [ ] **Step 3: Write the failing buildSnapshot test**

```ts
// services/widgets/__tests__/buildSnapshot.test.ts
import {buildSnapshot, artworkFileName, SnapshotInput} from '../buildSnapshot';
import {isWidgetSnapshot} from 'bayaan-widgets/src/snapshot';
import type {Track} from '@/types/audio';
import type {Reciter} from '@/data/reciterData';
import type {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';
import {SURAHS} from '@/data/surahData';

const reciter: Reciter = {
  id: 'r1',
  name: 'Mishary Alafasi',
  date: null,
  image_url: 'https://example.com/a.jpg',
  rewayat: [],
};

function track(surahId: number, extra: Partial<Track> = {}): Track {
  return {
    id: `r1-${surahId}`,
    url: 'https://example.com/a.mp3',
    title: SURAHS[surahId - 1].name,
    artist: reciter.name,
    reciterId: 'r1',
    reciterName: reciter.name,
    surahId: String(surahId),
    rewayatId: 'rw1',
    ...extra,
  };
}

function input(overrides: Partial<SnapshotInput> = {}): SnapshotInput {
  return {
    now: 1_791_460_800_000,
    theme: 'system',
    queueTracks: [],
    currentIndex: 0,
    isPlaying: false,
    positionSec: 0,
    durationSec: 0,
    recentTracks: [],
    defaultReciter: reciter,
    lastReadPage: null,
    openingTextForPage: () => 'opening',
    tasbeeh: {},
    artworkFileFor: id => artworkFileName(id),
    surahOfTheDayId: 36,
    ...overrides,
  };
}

describe('buildSnapshot', () => {
  it('produces a valid snapshot on a fresh install', () => {
    const snap = buildSnapshot(input());
    expect(isWidgetSnapshot(snap)).toBe(true);
    expect(snap.nowPlaying).toBeNull();
    expect(snap.lastRead).toBeNull();
    // Empty state hint: surah of the day with default reciter
    expect(snap.recent).toEqual([]);
    expect(snap.upNext[0]?.surahId).toBe(36);
  });

  it('treats the empty placeholder reciter as no default reciter', () => {
    const placeholder: Reciter = {id: '', name: '', date: null, image_url: null, rewayat: []};
    const snap = buildSnapshot(input({defaultReciter: placeholder}));
    expect(snap.defaultReciter).toBeNull();
    expect(snap.upNext).toEqual([]);
  });

  it('maps the current track, next 3 tracks and playback state', () => {
    const snap = buildSnapshot(
      input({
        queueTracks: [track(18), track(36), track(67), track(55), track(56)],
        currentIndex: 0,
        isPlaying: true,
        positionSec: 120,
        durationSec: 1800,
      }),
    );
    expect(snap.nowPlaying?.track.surahId).toBe(18);
    expect(snap.nowPlaying?.isPlaying).toBe(true);
    expect(snap.upNext.map(t => t.surahId)).toEqual([36, 67, 55]);
    expect(snap.nowPlaying?.track.artworkFile).toBe('reciter-r1.jpg');
  });

  it('handles a user upload without a surah', () => {
    const upload = track(1, {surahId: undefined, isUserUpload: true, title: 'My recitation'});
    const snap = buildSnapshot(input({queueTracks: [upload]}));
    expect(snap.nowPlaying?.track.surahId).toBe(0);
    expect(snap.nowPlaying?.track.surahName).toBe('My recitation');
    expect(snap.nowPlaying?.track.isUserUpload).toBe(true);
  });

  it('maps recents (max 6) and per reciter recents (max 3)', () => {
    const recent: RecentlyPlayedTrack[] = [1, 2, 3, 4, 5, 6, 7].map(id => ({
      reciter,
      surah: SURAHS[id - 1],
      rewayatId: 'rw1',
      progress: 0.5,
      duration: 100,
      timestamp: 1000 - id,
    }));
    const snap = buildSnapshot(input({recentTracks: recent}));
    expect(snap.recent).toHaveLength(6);
    expect(snap.reciterRecents.r1.map(t => t.surahId)).toEqual([1, 2, 3]);
  });

  it('builds last read with juz and opening text', () => {
    const snap = buildSnapshot(input({lastReadPage: 293}));
    expect(snap.lastRead).toEqual({
      page: 293,
      surahId: 18,
      surahName: SURAHS[17].name,
      juz: 15,
      openingText: 'opening',
    });
  });
});
```

`RecentlyPlayedTrack` required fields are `reciter, surah, rewayatId, progress, duration, timestamp` (`services/player/store/recentlyPlayedStore.ts:8-24`); if `tsc` reports another required field, add it to the literal with a neutral value.

- [ ] **Step 4: Run to verify failure**

Run: `npx jest services/widgets modules/bayaan-widgets`
Expected: FAIL, `../buildSnapshot` not found.

- [ ] **Step 5: Implement buildSnapshot.ts**

```ts
// services/widgets/buildSnapshot.ts
import type {Track} from '@/types/audio';
import type {Reciter} from '@/data/reciterData';
import type {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';
import {SURAHS} from '@/data/surahData';
import {getJuzForPage, getSurahForPage} from '@/utils/quranPages';
import {
  WIDGET_SNAPSHOT_VERSION,
  WidgetLastRead,
  WidgetReciter,
  WidgetSnapshot,
  WidgetTasbeehEntry,
  WidgetThemeMode,
  WidgetTrack,
} from 'bayaan-widgets/src/snapshot';

const UP_NEXT_LIMIT = 3;
const RECENT_LIMIT = 6;
const RECITER_RECENT_LIMIT = 3;

export interface SnapshotInput {
  now: number;
  theme: WidgetThemeMode;
  queueTracks: Track[];
  currentIndex: number;
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
  recentTracks: RecentlyPlayedTrack[];
  defaultReciter: Reciter | null;
  lastReadPage: number | null;
  openingTextForPage: (page: number) => string;
  tasbeeh: Record<string, WidgetTasbeehEntry>;
  artworkFileFor: (reciterId: string) => string | null;
  surahOfTheDayId: number;
}

export function artworkFileName(reciterId: string): string {
  return `reciter-${reciterId.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;
}

function surahName(surahId: number): string {
  return SURAHS[surahId - 1]?.name ?? '';
}

function fromQueueTrack(t: Track, input: SnapshotInput): WidgetTrack {
  const parsed = t.surahId ? parseInt(t.surahId, 10) : 0;
  const surahId = Number.isNaN(parsed) ? 0 : parsed;
  return {
    surahId,
    surahName: surahId > 0 && !t.isUserUpload ? surahName(surahId) : t.title,
    reciterId: t.reciterId,
    reciterName: t.reciterName,
    rewayatId: t.rewayatId ?? null,
    artworkFile: t.reciterId ? input.artworkFileFor(t.reciterId) : null,
    isUserUpload: t.isUserUpload ?? false,
  };
}

function fromRecent(r: RecentlyPlayedTrack, input: SnapshotInput): WidgetTrack {
  return {
    surahId: r.surah.id,
    surahName: r.surah.name,
    reciterId: r.reciter.id,
    reciterName: r.reciter.name,
    rewayatId: r.rewayatId || null,
    artworkFile: input.artworkFileFor(r.reciter.id),
    isUserUpload: r.isUserUpload ?? false,
  };
}

function toWidgetReciter(r: Reciter | null, input: SnapshotInput): WidgetReciter | null {
  if (!r || r.id === '') return null;
  return {id: r.id, name: r.name, artworkFile: input.artworkFileFor(r.id)};
}

function buildLastRead(input: SnapshotInput): WidgetLastRead | null {
  if (input.lastReadPage === null) return null;
  const surah = getSurahForPage(input.lastReadPage);
  if (!surah) return null;
  return {
    page: input.lastReadPage,
    surahId: surah.id,
    surahName: surah.name,
    juz: getJuzForPage(input.lastReadPage),
    openingText: input.openingTextForPage(input.lastReadPage),
  };
}

function buildReciterRecents(recent: WidgetTrack[]): Record<string, WidgetTrack[]> {
  const byReciter: Record<string, WidgetTrack[]> = {};
  for (const t of recent) {
    if (t.isUserUpload) continue;
    const list = byReciter[t.reciterId] ?? [];
    if (list.length < RECITER_RECENT_LIMIT) list.push(t);
    byReciter[t.reciterId] = list;
  }
  return byReciter;
}

export function buildSnapshot(input: SnapshotInput): WidgetSnapshot {
  const current = input.queueTracks[input.currentIndex];
  const defaultReciter = toWidgetReciter(input.defaultReciter, input);
  const allRecent = [...input.recentTracks]
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(r => fromRecent(r, input));

  let upNext = input.queueTracks
    .slice(input.currentIndex + 1, input.currentIndex + 1 + UP_NEXT_LIMIT)
    .map(t => fromQueueTrack(t, input));

  // Empty state: nothing queued or played yet, suggest surah of the day.
  if (!current && upNext.length === 0 && allRecent.length === 0 && defaultReciter) {
    upNext = [
      {
        surahId: input.surahOfTheDayId,
        surahName: surahName(input.surahOfTheDayId),
        reciterId: defaultReciter.id,
        reciterName: defaultReciter.name,
        rewayatId: null,
        artworkFile: defaultReciter.artworkFile,
        isUserUpload: false,
      },
    ];
  }

  return {
    version: WIDGET_SNAPSHOT_VERSION,
    generatedAt: input.now,
    theme: input.theme,
    nowPlaying: current
      ? {
          track: fromQueueTrack(current, input),
          isPlaying: input.isPlaying,
          positionSec: input.positionSec,
          durationSec: input.durationSec,
        }
      : null,
    upNext,
    recent: allRecent.slice(0, RECENT_LIMIT),
    defaultReciter,
    reciterRecents: buildReciterRecents(allRecent),
    lastRead: buildLastRead(input),
    tasbeeh: input.tasbeeh,
  };
}
```

`RecentlyPlayedTrack.isUserUpload` is optional (`recentlyPlayedStore.ts:16`). The test `reciterRecents.r1` expects surahs `[1, 2, 3]` because timestamps descend with id; keep the sort.

- [ ] **Step 6: Run tests**

Run: `npx jest services/widgets modules/bayaan-widgets && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npx prettier --write services/widgets modules/bayaan-widgets/src
git add services/widgets modules/bayaan-widgets/src
git commit -m "feat(widgets): build snapshots from app state with reload diffing"
```

---

### Task 5: Command handler (JS side)

**Files:**
- Create: `services/widgets/handleWidgetCommand.ts`, `services/widgets/__tests__/handleWidgetCommand.test.ts`

**Interfaces:**
- Consumes: `WidgetCommand` (Task 3), `createTrack` (`utils/track.ts`), `getReciterByIdSync` (`services/dataService.ts:243`), `getSurahById` (`services/dataService.ts:122`), `useReciterStore`, `usePlayerStore`, `useRecentlyPlayedStore`, `timestampService.getTimestampsForSurah(rewayatId, surah): Promise<AyahTimestamp[] | null>`.
- Produces: `handleWidgetCommand(command: WidgetCommand, deps?: CommandDeps): Promise<void>` and `interface CommandDeps` (injectable for tests).

- [ ] **Step 1: Note the timestamp shape**

`AyahTimestamp` (`types/timestamps.ts`) is `{surahNumber, ayahNumber, timestampFrom, timestampTo, durationMs}` with times in milliseconds. `usePlayerStore` actions: `play(): Promise<void>`, `pause(): Promise<void>`, `updateQueue(tracks, currentIndex?, startPosition?): Promise<void>` (startPosition in seconds).

- [ ] **Step 2: Write the failing test**

```ts
// services/widgets/__tests__/handleWidgetCommand.test.ts
import {handleWidgetCommand, CommandDeps} from '../handleWidgetCommand';
import type {Reciter} from '@/data/reciterData';
import type {Track} from '@/types/audio';

const reciter: Reciter = {
  id: 'r1',
  name: 'R',
  date: null,
  image_url: null,
  rewayat: [
    {
      id: 'rw1', reciter_id: 'r1', name: 'Hafs', style: 'murattal', server: '',
      surah_total: 114, surah_list: [], source_type: '', created_at: '',
    },
  ],
};

function deps(over: Partial<CommandDeps> = {}): CommandDeps & {calls: string[]} {
  const calls: string[] = [];
  return {
    calls,
    getReciter: id => (id === 'r1' ? reciter : undefined),
    getDefaultReciter: () => reciter,
    isPlaying: () => false,
    hasCurrentTrack: () => true,
    play: async () => void calls.push('play'),
    pause: async () => void calls.push('pause'),
    playTracks: async (tracks: Track[], startSec: number) =>
      void calls.push(`playTracks:${tracks[0].surahId}@${startSec}`),
    lastSurahForReciter: () => 67,
    ayahStartSec: async () => 42,
    ...over,
  };
}

describe('handleWidgetCommand', () => {
  it('toggles play and pause', async () => {
    const d = deps();
    await handleWidgetCommand({type: 'togglePlayback'}, d);
    expect(d.calls).toEqual(['play']);
    const d2 = deps({isPlaying: () => true});
    await handleWidgetCommand({type: 'togglePlayback'}, d2);
    expect(d2.calls).toEqual(['pause']);
  });

  it('plays a surah with the default reciter from an ayah', async () => {
    const d = deps();
    await handleWidgetCommand(
      {type: 'playTrack', surahId: 18, reciterId: null, rewayatId: null, ayah: 10},
      d,
    );
    expect(d.calls).toEqual(['playTracks:18@42']);
  });

  it('starts at 0 when no timestamps exist', async () => {
    const d = deps({ayahStartSec: async () => null});
    await handleWidgetCommand(
      {type: 'playTrack', surahId: 18, reciterId: 'r1', rewayatId: 'rw1', ayah: 10},
      d,
    );
    expect(d.calls).toEqual(['playTracks:18@0']);
  });

  it('ignores unknown reciters without throwing', async () => {
    const d = deps();
    await handleWidgetCommand({type: 'playReciter', reciterId: 'missing'}, d);
    expect(d.calls).toEqual([]);
  });

  it('resumes the last surah for a reciter', async () => {
    const d = deps();
    await handleWidgetCommand({type: 'playReciter', reciterId: 'r1'}, d);
    expect(d.calls).toEqual(['playTracks:67@0']);
  });

  it('togglePlayback with nothing loaded does nothing', async () => {
    const d = deps({hasCurrentTrack: () => false});
    await handleWidgetCommand({type: 'togglePlayback'}, d);
    expect(d.calls).toEqual([]);
  });
});
```

- [ ] **Step 3: Implement**

```ts
// services/widgets/handleWidgetCommand.ts
import type {WidgetCommand} from 'bayaan-widgets/src/commands';
import type {Reciter} from '@/data/reciterData';
import type {Track} from '@/types/audio';
import {createTrack} from '@/utils/track';
import {getReciterByIdSync, getSurahById} from '@/services/dataService';
import {useReciterStore} from '@/store/reciterStore';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {timestampService} from '@/services/timestamps/TimestampService';

const DEFAULT_SURAH_FOR_RECITER = 1;

export interface CommandDeps {
  getReciter: (id: string) => Reciter | undefined;
  getDefaultReciter: () => Reciter | null;
  isPlaying: () => boolean;
  hasCurrentTrack: () => boolean;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  playTracks: (tracks: Track[], startSec: number) => Promise<void>;
  lastSurahForReciter: (reciterId: string) => number | null;
  ayahStartSec: (rewayatId: string, surahId: number, ayah: number) => Promise<number | null>;
}

function defaultDeps(): CommandDeps {
  return {
    getReciter: id => getReciterByIdSync(id),
    getDefaultReciter: () => {
      const r = useReciterStore.getState().defaultReciter;
      return r.id === '' ? null : r;
    },
    isPlaying: () => usePlayerStore.getState().playback.state === 'playing',
    hasCurrentTrack: () => {
      const {queue} = usePlayerStore.getState();
      return queue.tracks[queue.currentIndex] !== undefined;
    },
    play: () => usePlayerStore.getState().play(),
    pause: () => usePlayerStore.getState().pause(),
    playTracks: async (tracks, startSec) => {
      const store = usePlayerStore.getState();
      await store.updateQueue(tracks, 0, startSec);
      await store.play();
    },
    lastSurahForReciter: reciterId => {
      const hit = useRecentlyPlayedStore
        .getState()
        .recentTracks.find(r => r.reciter.id === reciterId);
      return hit ? hit.surah.id : null;
    },
    ayahStartSec: async (rewayatId, surahId, ayah) => {
      const list = await timestampService.getTimestampsForSurah(rewayatId, surahId);
      const hit = list?.find(t => t.ayahNumber === ayah);
      return hit ? hit.timestampFrom / 1000 : null;
    },
  };
}

async function playSurah(
  reciter: Reciter,
  surahId: number,
  rewayatId: string | null,
  ayah: number | null,
  deps: CommandDeps,
): Promise<void> {
  const surah = getSurahById(surahId);
  if (!surah) return;
  const track = await createTrack(reciter, surah, rewayatId ?? undefined);
  const resolvedRewayat = track.rewayatId ?? reciter.rewayat[0]?.id;
  const startSec =
    ayah !== null && resolvedRewayat
      ? ((await deps.ayahStartSec(resolvedRewayat, surahId, ayah)) ?? 0)
      : 0;
  await deps.playTracks([track], startSec);
}

export async function handleWidgetCommand(
  command: WidgetCommand,
  deps: CommandDeps = defaultDeps(),
): Promise<void> {
  switch (command.type) {
    case 'togglePlayback': {
      if (!deps.hasCurrentTrack()) return;
      if (deps.isPlaying()) {
        await deps.pause();
        return;
      }
      await deps.play();
      return;
    }
    case 'playTrack': {
      const reciter = command.reciterId
        ? deps.getReciter(command.reciterId)
        : deps.getDefaultReciter();
      if (!reciter) return;
      await playSurah(reciter, command.surahId, command.rewayatId, command.ayah, deps);
      return;
    }
    case 'playReciter': {
      const reciter = deps.getReciter(command.reciterId);
      if (!reciter) return;
      const surahId = deps.lastSurahForReciter(reciter.id) ?? DEFAULT_SURAH_FOR_RECITER;
      await playSurah(reciter, surahId, null, null, deps);
      return;
    }
  }
}
```

The test mocks `createTrack` indirectly: add at the top of the test file

```ts
jest.mock('@/utils/track', () => ({
  createTrack: async (_r: unknown, surah: {id: number}) => ({
    id: `x-${surah.id}`, url: '', title: '', artist: '', reciterId: 'r1',
    reciterName: 'R', surahId: String(surah.id), rewayatId: 'rw1',
  }),
}));
jest.mock('@/services/timestamps/TimestampService', () => ({timestampService: {}}));
```

and assert on `tracks[0].surahId` as a string: change the `playTracks` mock in the test to push `` `playTracks:${tracks[0].surahId}@${startSec}` `` (string `'18'` renders the same).

- [ ] **Step 4: Run tests**

Run: `npx jest services/widgets && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx prettier --write services/widgets
git add services/widgets
git commit -m "feat(widgets): execute widget commands on the player"
```

---

### Task 6: Native module (iOS + Android bridge) and JS API

**Files:**
- Create: `modules/bayaan-widgets/src/NativeBayaanWidgets.ts`, `modules/bayaan-widgets/src/index.ts`, `modules/bayaan-widgets/ios/BayaanWidgets.podspec`, `modules/bayaan-widgets/ios/BayaanWidgetsModule.swift`, `modules/bayaan-widgets/android/build.gradle`, `modules/bayaan-widgets/android/src/main/AndroidManifest.xml`, `modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/BayaanWidgetsModule.kt`, `.../WidgetStorage.kt`, `.../ArtworkStore.kt`, `.../SnapshotModels.kt`, `modules/bayaan-widgets/android/src/test/java/expo/modules/bayaanwidgets/SnapshotModelsTest.kt`
- Modify: `app.config.js` (Info.plist key `BayaanAppGroup`, `ios.entitlements` app group)

**Interfaces:**
- Consumes: JSON formats from Tasks 2 and 3.
- Produces (JS, from `bayaan-widgets`):
  - `writeSnapshot(snapshot: WidgetSnapshot): void`
  - `reloadWidgets(kinds: WidgetKind[]): void`
  - `takeQueuedCommands(): QueuedWidgetCommand[]` (reads and clears native queue)
  - `addWidgetCommandListener(listener: () => void): {remove: () => void}` (signal only: "queue changed"; JS then calls `takeQueuedCommands`)
  - `takePendingTasbeeh(): PendingTasbeeh[]`
  - `cacheArtwork(sourceUrl: string, fileName: string): Promise<boolean>`
  - `hasArtwork(fileName: string): boolean`
  - re-exports all types and pure functions from `snapshot`, `commands`, `tasbeeh`, `widgetKinds`
- Produces (native storage contract, used by Tasks 7 and 8):
  - iOS App Group container: `widgets/snapshot.json`, `widgets/artwork/<file>`; UserDefaults(suiteName: appGroup) keys `widgets.commandQueue` (JSON string), `widgets.pendingTasbeeh` (JSON string)
  - Android: SharedPreferences `bayaan_widgets`, keys `snapshot`, `commandQueue`, `pendingTasbeeh`; files `filesDir/widgets/artwork/<file>`
  - In-process signal name: iOS `NotificationCenter` name `BayaanWidgetCommandQueued`; Android local broadcast-free callback via `WidgetStorage.onCommandQueued` listener.

- [ ] **Step 1: App config for the App Group**

In `app.config.js` under `expo.ios`, add:

```js
      entitlements: {
        'com.apple.security.application-groups': [
          `group.${IOS_BUNDLE_ID}`,
        ],
      },
```

Introduce `const IOS_BUNDLE_ID = process.env.IOS_BUNDLE_ID ?? 'com.bayaan.app';` next to the other fork-configurable identifiers, use it for `ios.bundleIdentifier`, and add `BayaanAppGroup: \`group.${IOS_BUNDLE_ID}\`` to `ios.infoPlist`. Run `npx expo config --type introspect | grep -n "application-groups\|BayaanAppGroup"` and confirm both appear. Confirm `ios/Bayaan/Bayaan.entitlements` already lists `group.com.bayaan.app` (it does today for the share extension), so this is not a new capability.

- [ ] **Step 2: JS binding and API**

```ts
// modules/bayaan-widgets/src/NativeBayaanWidgets.ts
import {requireOptionalNativeModule, type EventSubscription} from 'expo-modules-core';

export interface NativeBayaanWidgetsModule {
  writeSnapshot(json: string): void;
  reloadWidgets(kinds: string[]): void;
  takeQueuedCommands(): string;
  takePendingTasbeeh(): string;
  cacheArtwork(sourceUrl: string, fileName: string): Promise<boolean>;
  hasArtwork(fileName: string): boolean;
  addListener(event: 'onCommandQueued', listener: () => void): EventSubscription;
}

// null on web and in Jest
export const NativeBayaanWidgets: NativeBayaanWidgetsModule | null =
  requireOptionalNativeModule<NativeBayaanWidgetsModule>('BayaanWidgets');
```

If `requireOptionalNativeModule` is typed without a generic in SDK 56, use it untyped and narrow with a guard function `isNativeModule(value: unknown): value is NativeBayaanWidgetsModule` that checks `typeof value.writeSnapshot === 'function'`.

```ts
// modules/bayaan-widgets/src/index.ts
import {NativeBayaanWidgets} from './NativeBayaanWidgets';
import type {WidgetSnapshot} from './snapshot';
import type {WidgetKind} from './widgetKinds';
import {parseQueuedCommands, QueuedWidgetCommand} from './commands';
import {parsePendingTasbeeh, PendingTasbeeh} from './tasbeeh';

export * from './snapshot';
export * from './commands';
export * from './tasbeeh';
export * from './widgetKinds';

export function isWidgetsAvailable(): boolean {
  return NativeBayaanWidgets !== null;
}

export function writeSnapshot(snapshot: WidgetSnapshot): void {
  NativeBayaanWidgets?.writeSnapshot(JSON.stringify(snapshot));
}

export function reloadWidgets(kinds: WidgetKind[]): void {
  if (kinds.length === 0) return;
  NativeBayaanWidgets?.reloadWidgets(kinds);
}

export function takeQueuedCommands(): QueuedWidgetCommand[] {
  if (!NativeBayaanWidgets) return [];
  return parseQueuedCommands(NativeBayaanWidgets.takeQueuedCommands());
}

export function takePendingTasbeeh(): PendingTasbeeh[] {
  if (!NativeBayaanWidgets) return [];
  return parsePendingTasbeeh(NativeBayaanWidgets.takePendingTasbeeh());
}

export async function cacheArtwork(sourceUrl: string, fileName: string): Promise<boolean> {
  if (!NativeBayaanWidgets) return false;
  return NativeBayaanWidgets.cacheArtwork(sourceUrl, fileName);
}

export function hasArtwork(fileName: string): boolean {
  return NativeBayaanWidgets?.hasArtwork(fileName) ?? false;
}

export function addWidgetCommandListener(listener: () => void): {remove: () => void} {
  if (!NativeBayaanWidgets) return {remove: () => undefined};
  const sub = NativeBayaanWidgets.addListener('onCommandQueued', listener);
  return {remove: () => sub.remove()};
}
```

Update imports in `services/widgets/*.ts` from `bayaan-widgets/src/...` to `bayaan-widgets` now that `index.ts` exists.

- [ ] **Step 3: iOS podspec and module**

```ruby
# modules/bayaan-widgets/ios/BayaanWidgets.podspec
Pod::Spec.new do |s|
  s.name           = 'BayaanWidgets'
  s.version        = '0.1.0'
  s.summary        = 'Bayaan home screen widget bridge'
  s.author         = 'Bayaan'
  s.homepage       = 'https://thebayaan.com'
  s.license        = 'AGPL-3.0-or-later'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
```

```swift
// modules/bayaan-widgets/ios/BayaanWidgetsModule.swift
import ExpoModulesCore
import UIKit
import WidgetKit

let commandQueuedNotification = Notification.Name("BayaanWidgetCommandQueued")

private func appGroupId() -> String? {
  Bundle.main.object(forInfoDictionaryKey: "BayaanAppGroup") as? String
}

private func widgetsDir() -> URL? {
  guard let id = appGroupId(),
        let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id)
  else { return nil }
  let dir = base.appendingPathComponent("widgets", isDirectory: true)
  try? FileManager.default.createDirectory(
    at: dir.appendingPathComponent("artwork"), withIntermediateDirectories: true)
  return dir
}

private func takeString(_ key: String) -> String {
  guard let id = appGroupId(), let defaults = UserDefaults(suiteName: id) else { return "[]" }
  let value = defaults.string(forKey: key) ?? "[]"
  defaults.removeObject(forKey: key)
  return value
}

public class BayaanWidgetsModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("BayaanWidgets")
    Events("onCommandQueued")

    OnStartObserving {
      self.observer = NotificationCenter.default.addObserver(
        forName: commandQueuedNotification, object: nil, queue: .main
      ) { [weak self] _ in
        self?.sendEvent("onCommandQueued", [:])
      }
    }

    OnStopObserving {
      if let observer = self.observer { NotificationCenter.default.removeObserver(observer) }
      self.observer = nil
    }

    Function("writeSnapshot") { (json: String) in
      guard let dir = widgetsDir() else { return }
      try? json.data(using: .utf8)?.write(
        to: dir.appendingPathComponent("snapshot.json"), options: .atomic)
    }

    Function("reloadWidgets") { (kinds: [String]) in
      for kind in kinds { WidgetCenter.shared.reloadTimelines(ofKind: kind) }
    }

    Function("takeQueuedCommands") { () -> String in takeString("widgets.commandQueue") }
    Function("takePendingTasbeeh") { () -> String in takeString("widgets.pendingTasbeeh") }

    Function("hasArtwork") { (fileName: String) -> Bool in
      guard let dir = widgetsDir() else { return false }
      return FileManager.default.fileExists(
        atPath: dir.appendingPathComponent("artwork/\(fileName)").path)
    }

    AsyncFunction("cacheArtwork") { (sourceUrl: String, fileName: String) async -> Bool in
      guard let dir = widgetsDir(), let url = URL(string: sourceUrl) else { return false }
      let data: Data
      if url.isFileURL {
        guard let d = try? Data(contentsOf: url) else { return false }
        data = d
      } else {
        guard let (d, _) = try? await URLSession.shared.data(from: url) else { return false }
        data = d
      }
      guard let image = UIImage(data: data) else { return false }
      let side: CGFloat = 300
      let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side))
      let resized = renderer.jpegData(withCompressionQuality: 0.85) { _ in
        let scale = max(side / image.size.width, side / image.size.height)
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        image.draw(in: CGRect(
          x: (side - size.width) / 2, y: (side - size.height) / 2,
          width: size.width, height: size.height))
      }
      do {
        try resized.write(to: dir.appendingPathComponent("artwork/\(fileName)"), options: .atomic)
        return true
      } catch {
        return false
      }
    }
  }
}
```

The queue writer (`WidgetCommandQueue`) lives in `targets/widgets/_shared/` (Task 7) because intents need it in both processes. The module only reads and clears.

- [ ] **Step 4: Android module build.gradle and manifest**

```gradle
// modules/bayaan-widgets/android/build.gradle
buildscript {
  repositories { mavenCentral() }
  dependencies {
    classpath("org.jetbrains.kotlin.plugin.compose:org.jetbrains.kotlin.plugin.compose.gradle.plugin:${kotlinVersion}")
  }
}

apply plugin: 'com.android.library'
apply plugin: 'expo-module-gradle-plugin'
apply plugin: 'org.jetbrains.kotlin.plugin.compose'

group = 'expo.modules.bayaanwidgets'
version = '0.1.0'

android {
  namespace "expo.modules.bayaanwidgets"
  defaultConfig { versionCode 1; versionName "0.1.0" }
  buildFeatures { compose true }
  testOptions { unitTests { includeAndroidResources = true; returnDefaultValues = true } }
}

dependencies {
  implementation 'androidx.glance:glance-appwidget:1.1.1'
  implementation 'androidx.glance:glance-material3:1.1.1'
  implementation 'androidx.media3:media3-session:1.9.0'
  implementation 'androidx.palette:palette-ktx:1.0.0'
  testImplementation 'junit:junit:4.13.2'
  testImplementation 'org.json:json:20240303'
}
```

Media3 version must equal expo-audio's (`node_modules/expo-audio/android/build.gradle`, `androidxMedia3Version`); re-check after `npm ci` and match it. Glance: use the latest stable 1.x on Maven Google at implementation time.

```xml
<!-- modules/bayaan-widgets/android/src/main/AndroidManifest.xml -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application>
    <receiver
      android:name="expo.modules.bayaanwidgets.CommandReceiver"
      android:exported="false" />
    <receiver
      android:name="expo.modules.bayaanwidgets.continuelistening.ContinueListeningReceiver"
      android:label="@string/bayaan_widget_continue_listening"
      android:exported="true">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
      </intent-filter>
      <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/continue_listening_info" />
    </receiver>
  </application>
</manifest>
```

Add `modules/bayaan-widgets/android/src/main/res/values/strings.xml` with `bayaan_widget_continue_listening` = `Continue Listening` and `bayaan_widget_continue_listening_desc` = `Pick up where you left off`.

- [ ] **Step 5: Android storage, snapshot models, module**

```kotlin
// .../WidgetStorage.kt
package expo.modules.bayaanwidgets

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

object WidgetStorage {
  private const val PREFS = "bayaan_widgets"
  private const val KEY_SNAPSHOT = "snapshot"
  private const val KEY_QUEUE = "commandQueue"
  private const val KEY_TASBEEH = "pendingTasbeeh"

  @Volatile var onCommandQueued: (() -> Unit)? = null

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun writeSnapshot(context: Context, json: String) =
    prefs(context).edit().putString(KEY_SNAPSHOT, json).apply()

  fun readSnapshot(context: Context): WidgetSnapshot? =
    prefs(context).getString(KEY_SNAPSHOT, null)?.let { SnapshotModels.decode(it) }

  @Synchronized
  fun enqueueCommand(context: Context, command: JSONObject) {
    val queue = JSONArray(prefs(context).getString(KEY_QUEUE, "[]"))
    queue.put(JSONObject().put("command", command).put("enqueuedAt", System.currentTimeMillis()))
    prefs(context).edit().putString(KEY_QUEUE, queue.toString()).commit()
    onCommandQueued?.invoke()
  }

  @Synchronized
  fun take(context: Context, key: String): String {
    val value = prefs(context).getString(key, "[]") ?: "[]"
    prefs(context).edit().remove(key).commit()
    return value
  }

  fun takeQueue(context: Context) = take(context, KEY_QUEUE)
  fun takeTasbeeh(context: Context) = take(context, KEY_TASBEEH)

  fun artworkDir(context: Context): File =
    File(context.filesDir, "widgets/artwork").apply { mkdirs() }
}
```

```kotlin
// .../SnapshotModels.kt
package expo.modules.bayaanwidgets

import org.json.JSONObject

data class WidgetTrack(
  val surahId: Int, val surahName: String, val reciterId: String, val reciterName: String,
  val rewayatId: String?, val artworkFile: String?, val isUserUpload: Boolean,
)
data class WidgetNowPlaying(
  val track: WidgetTrack, val isPlaying: Boolean, val positionSec: Double, val durationSec: Double,
)
data class WidgetReciter(val id: String, val name: String, val artworkFile: String?)
data class WidgetLastRead(
  val page: Int, val surahId: Int, val surahName: String, val juz: Int, val openingText: String,
)
data class WidgetTasbeehEntry(val count: Int, val target: Int, val day: String)
data class WidgetSnapshot(
  val version: Int, val generatedAt: Long, val theme: String,
  val nowPlaying: WidgetNowPlaying?, val upNext: List<WidgetTrack>, val recent: List<WidgetTrack>,
  val defaultReciter: WidgetReciter?, val reciterRecents: Map<String, List<WidgetTrack>>,
  val lastRead: WidgetLastRead?, val tasbeeh: Map<String, WidgetTasbeehEntry>,
)

object SnapshotModels {
  const val VERSION = 1

  private fun JSONObject.optStringOrNull(key: String): String? =
    if (isNull(key)) null else getString(key)

  private fun track(o: JSONObject) = WidgetTrack(
    o.getInt("surahId"), o.getString("surahName"), o.getString("reciterId"),
    o.getString("reciterName"), o.optStringOrNull("rewayatId"),
    o.optStringOrNull("artworkFile"), o.getBoolean("isUserUpload"),
  )

  private fun tracks(o: JSONObject, key: String): List<WidgetTrack> {
    val arr = o.getJSONArray(key)
    return (0 until arr.length()).map { track(arr.getJSONObject(it)) }
  }

  /** Returns null for malformed JSON or a different schema version. */
  fun decode(json: String): WidgetSnapshot? = try {
    val o = JSONObject(json)
    if (o.getInt("version") != VERSION) null else {
      val np = if (o.isNull("nowPlaying")) null else o.getJSONObject("nowPlaying").let {
        WidgetNowPlaying(track(it.getJSONObject("track")), it.getBoolean("isPlaying"),
          it.getDouble("positionSec"), it.getDouble("durationSec"))
      }
      val dr = if (o.isNull("defaultReciter")) null else o.getJSONObject("defaultReciter").let {
        WidgetReciter(it.getString("id"), it.getString("name"), it.optStringOrNull("artworkFile"))
      }
      val lr = if (o.isNull("lastRead")) null else o.getJSONObject("lastRead").let {
        WidgetLastRead(it.getInt("page"), it.getInt("surahId"), it.getString("surahName"),
          it.getInt("juz"), it.getString("openingText"))
      }
      val rr = o.getJSONObject("reciterRecents")
      val tb = o.getJSONObject("tasbeeh")
      WidgetSnapshot(
        VERSION, o.getLong("generatedAt"), o.getString("theme"), np,
        tracks(o, "upNext"), tracks(o, "recent"), dr,
        rr.keys().asSequence().associateWith { tracks(rr, it) }, lr,
        tb.keys().asSequence().associateWith { k ->
          tb.getJSONObject(k).let { WidgetTasbeehEntry(it.getInt("count"), it.getInt("target"), it.getString("day")) }
        },
      )
    }
  } catch (e: Exception) { null }
}
```

```kotlin
// .../BayaanWidgetsModule.kt
package expo.modules.bayaanwidgets

import android.content.Context
import expo.modules.bayaanwidgets.continuelistening.ContinueListeningWidget
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import androidx.glance.appwidget.updateAll

class BayaanWidgetsModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context unavailable" }

  override fun definition() = ModuleDefinition {
    Name("BayaanWidgets")
    Events("onCommandQueued")

    OnStartObserving { WidgetStorage.onCommandQueued = { sendEvent("onCommandQueued", emptyMap<String, Any>()) } }
    OnStopObserving { WidgetStorage.onCommandQueued = null }

    Function("writeSnapshot") { json: String -> WidgetStorage.writeSnapshot(context, json) }

    Function("reloadWidgets") { kinds: List<String> ->
      val ctx = context
      CoroutineScope(Dispatchers.Default).launch {
        if ("ContinueListening" in kinds) ContinueListeningWidget().updateAll(ctx)
      }
    }

    Function("takeQueuedCommands") { WidgetStorage.takeQueue(context) }
    Function("takePendingTasbeeh") { WidgetStorage.takeTasbeeh(context) }

    Function("hasArtwork") { fileName: String ->
      java.io.File(WidgetStorage.artworkDir(context), fileName).exists()
    }

    AsyncFunction("cacheArtwork") { sourceUrl: String, fileName: String ->
      ArtworkStore.cache(context, sourceUrl, fileName)
    }
  }
}
```

```kotlin
// .../ArtworkStore.kt
package expo.modules.bayaanwidgets

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import androidx.core.graphics.ColorUtils
import androidx.palette.graphics.Palette
import java.io.File
import java.io.FileOutputStream
import java.net.URL

object ArtworkStore {
  private const val SIDE = 300
  private val tintCache = HashMap<String, Int>()

  /** Downloads or copies, center-crops to 300x300, writes JPEG. Runs off the main thread. */
  fun cache(context: Context, sourceUrl: String, fileName: String): Boolean = try {
    val uri = Uri.parse(sourceUrl)
    val input = when (uri.scheme) {
      "http", "https" -> URL(sourceUrl).openStream()
      "file" -> File(requireNotNull(uri.path)).inputStream()
      else -> context.contentResolver.openInputStream(uri)
    }
    val src = input.use { BitmapFactory.decodeStream(it) } ?: throw IllegalStateException("decode")
    val side = minOf(src.width, src.height)
    val cropped = Bitmap.createBitmap(src, (src.width - side) / 2, (src.height - side) / 2, side, side)
    val scaled = Bitmap.createScaledBitmap(cropped, SIDE, SIDE, true)
    FileOutputStream(File(WidgetStorage.artworkDir(context), fileName)).use {
      scaled.compress(Bitmap.CompressFormat.JPEG, 85, it)
    }
    synchronized(tintCache) { tintCache.remove(fileName) }
    true
  } catch (e: Exception) {
    false
  }

  /** Muted dark color from the artwork, darkened so white text stays legible. */
  fun tint(context: Context, fileName: String): Int? {
    synchronized(tintCache) { tintCache[fileName]?.let { return it } }
    val file = File(WidgetStorage.artworkDir(context), fileName)
    val bmp = BitmapFactory.decodeFile(file.path) ?: return null
    val palette = Palette.from(bmp).generate()
    val base = palette.darkMutedSwatch?.rgb ?: palette.dominantSwatch?.rgb ?: return null
    val hsl = FloatArray(3)
    ColorUtils.colorToHSL(base, hsl)
    hsl[2] = minOf(hsl[2], 0.3f)
    val color = ColorUtils.HSLToColor(hsl) or Color.BLACK
    synchronized(tintCache) { tintCache[fileName] = color }
    return color
  }
}
```

Add `implementation 'androidx.core:core-ktx:1.15.0'` to the module dependencies if `ColorUtils` does not resolve transitively.

- [ ] **Step 6: Kotlin fixture test**

```kotlin
// modules/bayaan-widgets/android/src/test/java/expo/modules/bayaanwidgets/SnapshotModelsTest.kt
package expo.modules.bayaanwidgets

import org.junit.Assert.*
import org.junit.Test
import java.io.File

class SnapshotModelsTest {
  private fun fixture(name: String) =
    File("../src/__fixtures__/$name").readText()

  @Test fun decodesFullFixture() {
    val s = SnapshotModels.decode(fixture("snapshot.full.json"))
    assertNotNull(s)
    assertEquals(18, s!!.nowPlaying!!.track.surahId)
    assertEquals(15, s.lastRead!!.juz)
    assertEquals(12, s.tasbeeh["tasbeeh-subhanallah"]!!.count)
  }

  @Test fun decodesEmptyFixture() {
    val s = SnapshotModels.decode(fixture("snapshot.empty.json"))
    assertNotNull(s)
    assertNull(s!!.nowPlaying)
  }

  @Test fun rejectsFutureVersionAndGarbage() {
    assertNull(SnapshotModels.decode(fixture("snapshot.full.json").replace("\"version\": 1", "\"version\": 2")))
    assertNull(SnapshotModels.decode("nope"))
  }
}
```

Run: `cd android && ./gradlew :bayaan-widgets:testDebugUnitTest` (after `npm run prebuild` regenerates `android/`; the Gradle project name is printed by `./gradlew projects | grep -i widgets`). Expected: 3 tests pass. The relative fixture path is relative to the module's `android/` dir; adjust if Gradle's working dir differs (print `File(".").absolutePath` on failure).

- [ ] **Step 7: Prebuild, build both platforms**

```bash
npm run prebuild
git status --short ios android | head -40
```
Expected: entitlements and Info.plist pick up the App Group key; autolinking adds `BayaanWidgets` pod and Gradle project. Then build (Android: `cd android && ./gradlew assembleDebug`; iOS: see Task 7 Step 8). Both must compile. Commit regenerated native output only if prebuild changed tracked files.

- [ ] **Step 8: Commit**

```bash
npx tsc --noEmit
npx prettier --write modules/bayaan-widgets/src app.config.js
git add modules/bayaan-widgets app.config.js ios android
git commit -m "feat(widgets): add native widget bridge for iOS and Android"
```

---

### Task 7: iOS widget extension and Continue Listening (SwiftUI)

**Files:**
- Create: everything under `targets/widgets/` listed in File Structure, `scripts/sync-widget-fonts.js`
- Modify: `app.config.js` (add `'@bacons/apple-targets'` to plugins), `package.json` (dev dependency `@bacons/apple-targets@5.0.0`, script `"sync:widget-fonts": "node scripts/sync-widget-fonts.js"`, and call it at the start of `prebuild`)

**Interfaces:**
- Consumes: storage contract from Task 6; widget kind string `ContinueListening`; command JSON format from Task 3.
- Produces: `TogglePlaybackIntent`, `PlayTrackIntent(surahId:reciterId:rewayatId:)` (AudioPlaybackIntents, compiled into app and extension); `WidgetCommandQueue.enqueue(_ json: [String: Any])`; `SnapshotStore.load() -> WidgetSnapshot?`; `SnapshotStore.artwork(_ file: String?) -> UIImage?`; `ArtworkTint.color(for file: String?) -> Color?`.

- [ ] **Step 1: Install and wire the plugin**

```bash
npm install --save-dev @bacons/apple-targets@5.0.0
```
Add `'@bacons/apple-targets'` to `plugins` in `app.config.js` after `'expo-router'`. `ios.appleTeamId` must be set: add `appleTeamId: APPLE_TEAM_ID` under `ios` (keep `teamId` as is for `withIOSTeam.js`).

- [ ] **Step 2: Font sync script (fonts stay single-source in `data/` and `assets/`)**

```js
// scripts/sync-widget-fonts.js
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const copies = [
  ['data/mushaf/digitalkhatt/DigitalKhattFont.otf', 'targets/widgets/DigitalKhattFont.otf'],
  ['assets/fonts/surah_names.ttf', 'targets/widgets/surah_names.ttf'],
];

for (const [from, to] of copies) {
  fs.copyFileSync(path.join(root, from), path.join(root, to));
}
console.log('[sync-widget-fonts] copied', copies.length, 'fonts');
```

Add `targets/widgets/*.otf` and `targets/widgets/*.ttf` to `.gitignore` (generated copies), and prefix the `prebuild` script: `"prebuild": "node scripts/sync-widget-fonts.js && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 expo prebuild --clean"`. Android copies the same fonts in Task 8.

- [ ] **Step 3: Target config and Info.plist**

```js
// targets/widgets/expo-target.config.js
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: 'widget',
  name: 'BayaanWidgets',
  displayName: config.name,
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit', 'AppIntents'],
  colors: {
    $widgetBackground: {light: '#FFFFFF', dark: '#111111'},
    $accent: {light: '#111111', dark: '#FFFFFF'},
  },
  entitlements: {
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
});
```

```xml
<!-- targets/widgets/Info.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.widgetkit-extension</string>
  </dict>
  <key>UIAppFonts</key>
  <array>
    <string>DigitalKhattFont.otf</string>
    <string>surah_names.ttf</string>
  </array>
</dict>
</plist>
```

The extension has no `BayaanAppGroup` key. `BayaanAppGroup.id` (Step 4) reads the key when present (main app, from Task 6) and otherwise derives `group.<main bundle id>` by stripping the extension suffix from its own bundle id, which stays correct for forks that change `IOS_BUNDLE_ID`. Before relying on the suffix, print the generated extension bundle id after prebuild (`grep -n "PRODUCT_BUNDLE_IDENTIFIER" ios/Bayaan.xcodeproj/project.pbxproj`) and make the suffix constant in `BayaanAppGroup` match it exactly (apple-targets sanitizes the target name, e.g. `com.bayaan.app.BayaanWidgets`).

- [ ] **Step 4: Shared Codable models and queue (`_shared/`, compiled into app and extension)**

```swift
// targets/widgets/_shared/WidgetSnapshot.swift
import Foundation

struct WidgetTrack: Codable, Hashable {
  let surahId: Int
  let surahName: String
  let reciterId: String
  let reciterName: String
  let rewayatId: String?
  let artworkFile: String?
  let isUserUpload: Bool
}

struct WidgetNowPlaying: Codable, Hashable {
  let track: WidgetTrack
  let isPlaying: Bool
  let positionSec: Double
  let durationSec: Double
}

struct WidgetReciter: Codable, Hashable {
  let id: String
  let name: String
  let artworkFile: String?
}

struct WidgetLastRead: Codable, Hashable {
  let page: Int
  let surahId: Int
  let surahName: String
  let juz: Int
  let openingText: String
}

struct WidgetTasbeehEntry: Codable, Hashable {
  let count: Int
  let target: Int
  let day: String
}

struct WidgetSnapshot: Codable {
  static let supportedVersion = 1
  let version: Int
  let generatedAt: Double
  let theme: String
  let nowPlaying: WidgetNowPlaying?
  let upNext: [WidgetTrack]
  let recent: [WidgetTrack]
  let defaultReciter: WidgetReciter?
  let reciterRecents: [String: [WidgetTrack]]
  let lastRead: WidgetLastRead?
  let tasbeeh: [String: WidgetTasbeehEntry]

  static func decode(_ data: Data) -> WidgetSnapshot? {
    guard let s = try? JSONDecoder().decode(WidgetSnapshot.self, from: data),
          s.version == supportedVersion else { return nil }
    return s
  }
}
```

```swift
// targets/widgets/_shared/WidgetCommandQueue.swift
import Foundation

enum BayaanAppGroup {
  static var id: String {
    if let v = Bundle.main.object(forInfoDictionaryKey: "BayaanAppGroup") as? String { return v }
    var bundle = Bundle.main.bundleIdentifier ?? "com.bayaan.app"
    if bundle.hasSuffix(".BayaanWidgets") { bundle = String(bundle.dropLast(".BayaanWidgets".count)) }
    return "group.\(bundle)"
  }

  static var defaults: UserDefaults? { UserDefaults(suiteName: id) }

  static var widgetsDir: URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id)?
      .appendingPathComponent("widgets", isDirectory: true)
  }
}

enum WidgetCommandQueue {
  static let key = "widgets.commandQueue"
  static let notification = Notification.Name("BayaanWidgetCommandQueued")

  static func enqueue(_ command: [String: Any]) {
    guard let defaults = BayaanAppGroup.defaults else { return }
    var queue: [[String: Any]] = []
    if let raw = defaults.string(forKey: key)?.data(using: .utf8),
       let parsed = try? JSONSerialization.jsonObject(with: raw) as? [[String: Any]] {
      queue = parsed
    }
    queue.append(["command": command, "enqueuedAt": Date().timeIntervalSince1970 * 1000])
    if let data = try? JSONSerialization.data(withJSONObject: queue),
       let json = String(data: data, encoding: .utf8) {
      defaults.set(json, forKey: key)
    }
    NotificationCenter.default.post(name: notification, object: nil)
  }
}
```

Update `BayaanWidgetsModule.swift` (Task 6) to use the notification name string `"BayaanWidgetCommandQueued"` (already identical) so the module does not depend on `_shared`.

- [ ] **Step 5: Playback intents (`_shared/`)**

```swift
// targets/widgets/_shared/PlaybackIntents.swift
import AppIntents
import Foundation

// AudioPlaybackIntent runs in the app process, so the queue notification
// reaches the JS module when the app is alive, and the app launches in the
// background when it is not.
struct TogglePlaybackIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play or Pause"
  static var isDiscoverable = false

  func perform() async throws -> some IntentResult {
    WidgetCommandQueue.enqueue(["type": "togglePlayback"])
    return .result()
  }
}

struct PlayTrackIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play Surah"
  static var isDiscoverable = false

  @Parameter(title: "Surah") var surahId: Int
  @Parameter(title: "Reciter") var reciterId: String?
  @Parameter(title: "Rewayah") var rewayatId: String?

  init() {}

  init(surahId: Int, reciterId: String?, rewayatId: String?) {
    self.surahId = surahId
    self.reciterId = reciterId
    self.rewayatId = rewayatId
  }

  func perform() async throws -> some IntentResult {
    WidgetCommandQueue.enqueue([
      "type": "playTrack",
      "surahId": surahId,
      "reciterId": reciterId ?? NSNull(),
      "rewayatId": rewayatId ?? NSNull(),
      "ayah": NSNull(),
    ])
    return .result()
  }
}
```

- [ ] **Step 6: Snapshot store and artwork tint (extension only)**

```swift
// targets/widgets/SnapshotStore.swift
import SwiftUI
import UIKit

enum SnapshotStore {
  static func load() -> WidgetSnapshot? {
    guard let url = BayaanAppGroup.widgetsDir?.appendingPathComponent("snapshot.json"),
          let data = try? Data(contentsOf: url) else { return nil }
    return WidgetSnapshot.decode(data)
  }

  static func artwork(_ file: String?) -> UIImage? {
    guard let file, let dir = BayaanAppGroup.widgetsDir else { return nil }
    return UIImage(contentsOfFile: dir.appendingPathComponent("artwork/\(file)").path)
  }
}
```

```swift
// targets/widgets/ArtworkTint.swift
import CoreImage
import SwiftUI
import UIKit

enum ArtworkTint {
  private static var cache: [String: Color] = [:]
  private static let context = CIContext(options: [.workingColorSpace: NSNull()])

  /// Average artwork color, darkened so white text stays legible.
  static func color(for file: String?) -> Color? {
    guard let file else { return nil }
    if let hit = cache[file] { return hit }
    guard let image = SnapshotStore.artwork(file), let ci = CIImage(image: image),
          let filter = CIFilter(name: "CIAreaAverage", parameters: [
            kCIInputImageKey: ci, kCIInputExtentKey: CIVector(cgRect: ci.extent),
          ]),
          let output = filter.outputImage else { return nil }
    var px = [UInt8](repeating: 0, count: 4)
    context.render(output, toBitmap: &px, rowBytes: 4,
                   bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
                   format: .RGBA8, colorSpace: nil)
    var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
    UIColor(red: CGFloat(px[0]) / 255, green: CGFloat(px[1]) / 255,
            blue: CGFloat(px[2]) / 255, alpha: 1).getHue(&h, saturation: &s, brightness: &b, alpha: &a)
    let color = Color(hue: h, saturation: min(s * 1.1, 0.8), brightness: min(b, 0.38))
    cache[file] = color
    return color
  }
}
```

- [ ] **Step 7: Continue Listening widget**

```swift
// targets/widgets/ContinueListening/ContinueListeningWidget.swift
import SwiftUI
import WidgetKit

struct ContinueListeningEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshot?
}

struct ContinueListeningProvider: TimelineProvider {
  func placeholder(in context: Context) -> ContinueListeningEntry {
    ContinueListeningEntry(date: .now, snapshot: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (ContinueListeningEntry) -> Void) {
    completion(ContinueListeningEntry(date: .now, snapshot: SnapshotStore.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ContinueListeningEntry>) -> Void) {
    // App pushes reloads on change; no polling.
    completion(Timeline(entries: [ContinueListeningEntry(date: .now, snapshot: SnapshotStore.load())],
                        policy: .never))
  }
}

struct ContinueListeningWidget: Widget {
  let kind = "ContinueListening"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ContinueListeningProvider()) { entry in
      ContinueListeningView(entry: entry)
    }
    .configurationDisplayName("Continue Listening")
    .description("Pick up where you left off.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}
```

```swift
// targets/widgets/WidgetsBundle.swift
import SwiftUI
import WidgetKit

@main
struct BayaanWidgetsBundle: WidgetBundle {
  var body: some Widget {
    ContinueListeningWidget()
  }
}
```

```swift
// targets/widgets/ContinueListening/ContinueListeningViews.swift
import AppIntents
import SwiftUI
import WidgetKit

private let deepLinkPlayer = URL(string: "bayaan://player")!

struct ContinueListeningView: View {
  @Environment(\.widgetFamily) private var family
  let entry: ContinueListeningEntry

  private var current: WidgetTrack? {
    entry.snapshot?.nowPlaying?.track ?? entry.snapshot?.recent.first ?? entry.snapshot?.upNext.first
  }

  var body: some View {
    Group {
      if let track = current {
        switch family {
        case .systemSmall:
          SmallView(track: track, nowPlaying: entry.snapshot?.nowPlaying,
                    generatedAt: entry.snapshot?.generatedAt ?? 0)
        case .systemMedium:
          MediumView(track: track, nowPlaying: entry.snapshot?.nowPlaying,
                     generatedAt: entry.snapshot?.generatedAt ?? 0,
                     side: sideList(limit: 3))
        default:
          LargeView(track: track, nowPlaying: entry.snapshot?.nowPlaying,
                    rows: sideList(limit: 6))
        }
      } else {
        EmptyStateView()
      }
    }
    .containerBackground(for: .widget) {
      (ArtworkTint.color(for: current?.artworkFile) ?? Color("$widgetBackground"))
    }
    .widgetURL(deepLinkPlayer)
  }

  private func sideList(limit: Int) -> [WidgetTrack] {
    guard let s = entry.snapshot else { return [] }
    let source = s.upNext.isEmpty ? s.recent.dropFirst(s.nowPlaying == nil ? 1 : 0).map { $0 } : s.upNext
    return Array(source.prefix(limit))
  }
}

struct Artwork: View {
  let file: String?
  let size: CGFloat

  var body: some View {
    Group {
      if let image = SnapshotStore.artwork(file) {
        Image(uiImage: image).resizable().widgetAccentedRenderingMode(.fullColor)
      } else {
        RoundedRectangle(cornerRadius: size * 0.16).fill(.white.opacity(0.15))
      }
    }
    .aspectRatio(1, contentMode: .fill)
    .frame(width: size, height: size)
    .clipShape(RoundedRectangle(cornerRadius: size * 0.16, style: .continuous))
  }
}

struct PlayPauseButton: View {
  let isPlaying: Bool
  var body: some View {
    Button(intent: TogglePlaybackIntent()) {
      Image(systemName: isPlaying ? "pause.fill" : "play.fill")
        .font(.system(size: 16, weight: .bold))
        .foregroundStyle(.white)
        .frame(width: 34, height: 34)
        .background(.white.opacity(0.18), in: Circle())
    }
    .buttonStyle(.plain)
  }
}

struct TimeLeft: View {
  let nowPlaying: WidgetNowPlaying?
  let generatedAt: Double

  var body: some View {
    if let np = nowPlaying, np.durationSec > 0 {
      let start = Date(timeIntervalSince1970: generatedAt / 1000)
      let end = start.addingTimeInterval(np.durationSec - np.positionSec)
      if np.isPlaying {
        Text(timerInterval: Date.now...max(end, .now), countsDown: true)
          .monospacedDigit()
      } else {
        Text("\(Int((np.durationSec - np.positionSec) / 60)) min left")
      }
    }
  }
}

struct SmallView: View {
  let track: WidgetTrack
  let nowPlaying: WidgetNowPlaying?
  let generatedAt: Double

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(alignment: .top) {
        Artwork(file: track.artworkFile, size: 58)
        Spacer()
        PlayPauseButton(isPlaying: nowPlaying?.isPlaying ?? false)
      }
      Spacer(minLength: 0)
      Text(track.surahName).font(.headline).lineLimit(1)
      HStack(spacing: 4) {
        Text(track.reciterName).lineLimit(1)
        TimeLeft(nowPlaying: nowPlaying, generatedAt: generatedAt)
      }
      .font(.caption).opacity(0.75)
    }
    .foregroundStyle(.white)
    .padding(14)
  }
}

struct MediumView: View {
  let track: WidgetTrack
  let nowPlaying: WidgetNowPlaying?
  let generatedAt: Double
  let side: [WidgetTrack]

  var body: some View {
    HStack(spacing: 14) {
      VStack(alignment: .leading, spacing: 6) {
        Artwork(file: track.artworkFile, size: 64)
        Spacer(minLength: 0)
        Text(track.surahName).font(.headline).lineLimit(1)
        Text(track.reciterName).font(.caption).opacity(0.75).lineLimit(1)
        HStack {
          PlayPauseButton(isPlaying: nowPlaying?.isPlaying ?? false)
          TimeLeft(nowPlaying: nowPlaying, generatedAt: generatedAt).font(.caption2).opacity(0.75)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      VStack(alignment: .leading, spacing: 8) {
        ForEach(side, id: \.self) { t in TrackRow(track: t, artSize: 30) }
        Spacer(minLength: 0)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .foregroundStyle(.white)
    .padding(14)
  }
}

struct LargeView: View {
  let track: WidgetTrack
  let nowPlaying: WidgetNowPlaying?
  let rows: [WidgetTrack]

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 12) {
        Artwork(file: track.artworkFile, size: 76)
        VStack(alignment: .leading, spacing: 4) {
          Text(track.surahName).font(.title3.bold()).lineLimit(1)
          Text(track.reciterName).font(.subheadline).opacity(0.75).lineLimit(1)
        }
        Spacer()
        PlayPauseButton(isPlaying: nowPlaying?.isPlaying ?? false)
      }
      Divider().overlay(.white.opacity(0.2))
      ForEach(rows, id: \.self) { t in TrackRow(track: t, artSize: 36) }
      Spacer(minLength: 0)
    }
    .foregroundStyle(.white)
    .padding(16)
  }
}

struct TrackRow: View {
  let track: WidgetTrack
  let artSize: CGFloat

  var body: some View {
    Button(intent: PlayTrackIntent(surahId: track.surahId, reciterId: track.reciterId,
                                   rewayatId: track.rewayatId)) {
      HStack(spacing: 8) {
        Artwork(file: track.artworkFile, size: artSize)
        VStack(alignment: .leading, spacing: 1) {
          Text(track.surahName).font(.caption.weight(.semibold)).lineLimit(1)
          Text(track.reciterName).font(.caption2).opacity(0.7).lineLimit(1)
        }
      }
    }
    .buttonStyle(.plain)
    .disabled(track.isUserUpload || track.surahId == 0)
  }
}

struct EmptyStateView: View {
  var body: some View {
    VStack(spacing: 6) {
      Image(systemName: "headphones").font(.title2)
      Text("Start listening").font(.caption.weight(.semibold))
    }
    .foregroundStyle(Color("$accent"))
  }
}
```

Add `#Preview(as: .systemSmall) { ContinueListeningWidget() } timeline: { ... }` blocks at the bottom of `ContinueListeningViews.swift` for small, medium and large with (a) a playing fixture built from `WidgetSnapshot.decode` of an inline copy of `snapshot.full.json` and (b) `nil` snapshot.

- [ ] **Step 8: Prebuild and build on the simulator (Xcode 27 path)**

```bash
npm run prebuild
cd ios && xcodebuild -workspace Bayaan.xcworkspace -scheme Bayaan \
  -configuration Debug -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  IPHONEOS_DEPLOYMENT_TARGET=16.4 build | tail -20
```
Expected: `BUILD SUCCEEDED`, and `ios/Bayaan.xcodeproj` shows an `expo:targets/widgets` group with the `BayaanWidgets` target embedded in the app. If the local `expo-modules-jsi` Swift patch from the Xcode 27 note is needed, apply it as documented in project memory (`project_xcode27_sim_build.md`) and do not commit it.

- [ ] **Step 9: Swift fixture decode test**

Add a `#if DEBUG` static self-check is not a real test; instead add a tiny Swift script test run on macOS:

```bash
cat targets/widgets/_shared/WidgetSnapshot.swift > $SCRATCH/decode-test.swift
cat >> $SCRATCH/decode-test.swift <<'EOF'
let dir = CommandLine.arguments[1]
for name in ["snapshot.full.json", "snapshot.empty.json"] {
  let data = try! Data(contentsOf: URL(fileURLWithPath: "\(dir)/\(name)"))
  precondition(WidgetSnapshot.decode(data) != nil, "failed to decode \(name)")
}
var bumped = try! String(contentsOfFile: "\(dir)/snapshot.full.json", encoding: .utf8)
bumped = bumped.replacingOccurrences(of: "\"version\": 1", with: "\"version\": 2")
precondition(WidgetSnapshot.decode(bumped.data(using: .utf8)!) == nil, "accepted future version")
print("swift fixture decode: OK")
EOF
swift $SCRATCH/decode-test.swift modules/bayaan-widgets/src/__fixtures__
```
Expected: `swift fixture decode: OK`. Promote this into `scripts/check-widget-fixtures.sh` (same content, writes to a temp dir) and commit it so CI or reviewers can rerun it.

- [ ] **Step 10: Simulator smoke test**

Install and launch the app on the simulator, play any surah, background the app, long-press the home screen and add Continue Listening (small, medium, large). Take screenshots with `xcrun simctl io booted screenshot $SCRATCH/cl-<size>.png` and look at them. Expected: artwork, tint, surah, reciter, live countdown. Tap pause: audio pauses and the icon flips within a second or two.

- [ ] **Step 11: Commit**

```bash
npx prettier --write scripts/sync-widget-fonts.js targets/widgets/expo-target.config.js app.config.js package.json
git add targets scripts/sync-widget-fonts.js scripts/check-widget-fixtures.sh app.config.js package.json package-lock.json .gitignore ios
git commit -m "feat(widgets): add iOS widget extension with Continue Listening"
```

---

### Task 8: Android Continue Listening (Glance)

**Files:**
- Create: `modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/continuelistening/ContinueListeningWidget.kt`, `.../continuelistening/ContinueListeningReceiver.kt`, `.../CommandReceiver.kt`, `modules/bayaan-widgets/android/src/main/res/xml/continue_listening_info.xml`
- Modify: `modules/bayaan-widgets/android/src/main/AndroidManifest.xml` (already lists receivers from Task 6)

**Interfaces:**
- Consumes: `WidgetStorage`, `SnapshotModels`, `ArtworkStore` (Task 6); command JSON format (Task 3).
- Produces: `CommandReceiver.pendingIntent(context, command: JSONObject, requestCode: Int): PendingIntent`; `ContinueListeningWidget` (`GlanceAppWidget`).

- [ ] **Step 1: Widget provider info**

```xml
<!-- modules/bayaan-widgets/android/src/main/res/xml/continue_listening_info.xml -->
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/bayaan_widget_continue_listening_desc"
  android:minWidth="110dp"
  android:minHeight="110dp"
  android:targetCellWidth="2"
  android:targetCellHeight="2"
  android:maxResizeWidth="400dp"
  android:maxResizeHeight="400dp"
  android:resizeMode="horizontal|vertical"
  android:updatePeriodMillis="0"
  android:widgetCategory="home_screen"
  android:initialLayout="@layout/glance_default_loading_layout" />
```

- [ ] **Step 2: Command receiver (toggle via MediaController when a session exists, else queue and launch)**

```kotlin
// .../CommandReceiver.kt
package expo.modules.bayaanwidgets

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.MoreExecutors
import org.json.JSONObject

class CommandReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val raw = intent.getStringExtra(EXTRA_COMMAND) ?: return
    val command = try { JSONObject(raw) } catch (e: Exception) { return }
    val pending = goAsync()

    if (command.optString("type") == "togglePlayback" && WidgetStorage.onCommandQueued == null) {
      // JS is not listening; try the live media session directly.
      val token = SessionToken(context, ComponentName(context, AUDIO_SERVICE))
      val future = MediaController.Builder(context, token).buildAsync()
      future.addListener({
        try {
          val controller = future.get()
          if (controller.currentMediaItem != null) {
            if (controller.isPlaying) controller.pause() else controller.play()
            controller.release()
            pending.finish()
            return@addListener
          }
          controller.release()
        } catch (e: Exception) { /* fall through to queue + launch */ }
        queueAndLaunch(context, command)
        pending.finish()
      }, MoreExecutors.directExecutor())
      return
    }

    queueAndLaunch(context, command)
    pending.finish()
  }

  private fun queueAndLaunch(context: Context, command: JSONObject) {
    WidgetStorage.enqueueCommand(context, command)
    if (WidgetStorage.onCommandQueued != null) return // JS alive, it will drain
    context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
      it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(it)
    }
  }

  companion object {
    private const val EXTRA_COMMAND = "command"
    private const val AUDIO_SERVICE = "expo.modules.audio.service.AudioControlsService"

    fun pendingIntent(context: Context, command: JSONObject, requestCode: Int): PendingIntent {
      val intent = Intent(context, CommandReceiver::class.java).putExtra(EXTRA_COMMAND, command.toString())
      return PendingIntent.getBroadcast(
        context, requestCode, intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
  }
}
```

Launching an activity from a broadcast receiver is restricted on Android 10+ unless the broadcast was triggered by a widget click (the PendingIntent sender is the launcher, which grants a background activity start for user taps). Verify on device (Task 10). If blocked, switch the play buttons to `PendingIntent.getActivity` pointing at `MainActivity` with the command as an extra plus `bayaan://player` data, and have `CommandReceiver` used only for toggle.

- [ ] **Step 3: Glance widget**

```kotlin
// .../continuelistening/ContinueListeningWidget.kt
package expo.modules.bayaanwidgets.continuelistening

import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.*
import androidx.glance.action.clickable
import androidx.glance.appwidget.*
import androidx.glance.appwidget.action.actionSendBroadcast
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.layout.*
import androidx.glance.text.*
import androidx.glance.unit.ColorProvider
import expo.modules.bayaanwidgets.*
import org.json.JSONObject
import java.io.File

class ContinueListeningWidget : GlanceAppWidget() {
  companion object {
    private val SMALL = DpSize(110.dp, 110.dp)
    private val MEDIUM = DpSize(250.dp, 110.dp)
    private val LARGE = DpSize(250.dp, 250.dp)
  }

  override val sizeMode = SizeMode.Responsive(setOf(SMALL, MEDIUM, LARGE))

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val snapshot = WidgetStorage.readSnapshot(context)
    provideContent { Content(context, snapshot) }
  }

  @Composable
  private fun Content(context: Context, s: WidgetSnapshot?) {
    val track = s?.nowPlaying?.track ?: s?.recent?.firstOrNull() ?: s?.upNext?.firstOrNull()
    val openPlayer = actionStartActivity(
      Intent(Intent.ACTION_VIEW, Uri.parse("bayaan://player")).setPackage(context.packageName),
    )
    val tint = track?.artworkFile?.let { ArtworkStore.tint(context, it) }
    val bg = tint?.let { ColorProvider(Color(it)) } ?: ColorProvider(Color(0xFF111111))

    Box(
      modifier = GlanceModifier.fillMaxSize().background(bg).cornerRadius(20.dp)
        .padding(14.dp).clickable(openPlayer),
    ) {
      if (track == null) {
        Text("Start listening", style = TextStyle(color = ColorProvider(Color.White), fontWeight = FontWeight.Medium))
        return@Box
      }
      val size = LocalSize.current
      val side = (if (s?.upNext.isNullOrEmpty()) s?.recent?.drop(if (s.nowPlaying == null) 1 else 0) else s?.upNext)
        ?.take(if (size.height >= LARGE.height) 6 else 3).orEmpty()
      when {
        size.width >= MEDIUM.width && size.height >= LARGE.height -> Large(context, track, s?.nowPlaying, side)
        size.width >= MEDIUM.width -> Medium(context, track, s?.nowPlaying, side)
        else -> Small(context, track, s?.nowPlaying)
      }
    }
  }

  @Composable
  private fun Art(context: Context, file: String?, size: Int) {
    val bmp = file?.let { File(WidgetStorage.artworkDir(context), it) }
      ?.takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path) }
    if (bmp != null) {
      Image(ImageProvider(bmp), contentDescription = null,
        modifier = GlanceModifier.size(size.dp).cornerRadius((size / 6).dp),
        contentScale = ContentScale.Crop)
    } else {
      Spacer(GlanceModifier.size(size.dp).background(ColorProvider(Color(0x26FFFFFF))).cornerRadius((size / 6).dp))
    }
  }

  @Composable
  private fun PlayPause(context: Context, isPlaying: Boolean) {
    val cmd = JSONObject().put("type", "togglePlayback")
    Image(
      ImageProvider(if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play),
      contentDescription = if (isPlaying) "Pause" else "Play",
      modifier = GlanceModifier.size(34.dp).background(ColorProvider(Color(0x2EFFFFFF))).cornerRadius(17.dp)
        .padding(7.dp).clickable(actionSendBroadcast(
          Intent(context, CommandReceiver::class.java).putExtra("command", cmd.toString()))),
    )
  }

  @Composable
  private fun Titles(track: WidgetTrack, titleSp: Int) {
    val white = ColorProvider(Color.White)
    Text(track.surahName, maxLines = 1, style = TextStyle(color = white, fontSize = titleSp.sp, fontWeight = FontWeight.Bold))
    Text(track.reciterName, maxLines = 1, style = TextStyle(color = ColorProvider(Color(0xBFFFFFFF)), fontSize = 12.sp))
  }

  @Composable
  private fun Small(context: Context, track: WidgetTrack, np: WidgetNowPlaying?) {
    Column(GlanceModifier.fillMaxSize()) {
      Row(GlanceModifier.fillMaxWidth()) {
        Art(context, track.artworkFile, 56)
        Spacer(GlanceModifier.defaultWeight())
        PlayPause(context, np?.isPlaying ?: false)
      }
      Spacer(GlanceModifier.defaultWeight())
      Titles(track, 15)
    }
  }

  @Composable
  private fun Medium(context: Context, track: WidgetTrack, np: WidgetNowPlaying?, side: List<WidgetTrack>) {
    Row(GlanceModifier.fillMaxSize()) {
      Column(GlanceModifier.defaultWeight().fillMaxHeight()) {
        Art(context, track.artworkFile, 60)
        Spacer(GlanceModifier.defaultWeight())
        Titles(track, 15)
        Spacer(GlanceModifier.height(6.dp))
        PlayPause(context, np?.isPlaying ?: false)
      }
      Spacer(GlanceModifier.width(12.dp))
      Column(GlanceModifier.defaultWeight()) { side.forEach { t -> TrackRow(context, t, 30) } }
    }
  }

  @Composable
  private fun Large(context: Context, track: WidgetTrack, np: WidgetNowPlaying?, rows: List<WidgetTrack>) {
    Column(GlanceModifier.fillMaxSize()) {
      Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Art(context, track.artworkFile, 72)
        Spacer(GlanceModifier.width(12.dp))
        Column(GlanceModifier.defaultWeight()) { Titles(track, 18) }
        PlayPause(context, np?.isPlaying ?: false)
      }
      Spacer(GlanceModifier.height(12.dp))
      rows.forEach { t -> TrackRow(context, t, 36) }
    }
  }

  @Composable
  private fun TrackRow(context: Context, t: WidgetTrack, art: Int) {
    val cmd = JSONObject().put("type", "playTrack").put("surahId", t.surahId)
      .put("reciterId", t.reciterId).put("rewayatId", t.rewayatId ?: JSONObject.NULL).put("ayah", JSONObject.NULL)
    val modifier = if (t.isUserUpload || t.surahId == 0) GlanceModifier
      else GlanceModifier.clickable(actionSendBroadcast(
        Intent(context, CommandReceiver::class.java).putExtra("command", cmd.toString())))
    Row(modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
      Art(context, t.artworkFile, art)
      Spacer(GlanceModifier.width(8.dp))
      Column { Titles(t, 13) }
    }
  }
}
```

Glance requires distinct intents for distinct click targets; the `command` extra differs per row, and Glance assigns its own request codes, so rows do not collide. If two rows ever share identical extras, add `.setData(Uri.parse("bayaan-widget://row/${t.surahId}/${t.reciterId}"))` to make them unique.

```kotlin
// .../continuelistening/ContinueListeningReceiver.kt
package expo.modules.bayaanwidgets.continuelistening

import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver

class ContinueListeningReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = ContinueListeningWidget()
}
```

- [ ] **Step 4: Copy fonts for Android (used by Plan 1b `ArabicBitmap`)**

Extend `scripts/sync-widget-fonts.js` copies with `['data/mushaf/digitalkhatt/DigitalKhattFont.otf', 'modules/bayaan-widgets/android/src/main/assets/fonts/DigitalKhattFont.otf']` and the surah names font into the same folder; add both paths to `.gitignore`. `mkdirSync(..., {recursive: true})` the destination dir before copying.

- [ ] **Step 5: Build and smoke test**

```bash
npm run sync:widget-fonts
cd android && ./gradlew assembleDebug && ./gradlew :bayaan-widgets:testDebugUnitTest
```
Install on an emulator, play a surah, add the widget, resize through small, medium, large. Screenshot each (`adb exec-out screencap -p > $SCRATCH/android-cl-<size>.png`) and inspect. Tap play/pause with the app alive and with the app swiped away.

- [ ] **Step 6: Commit**

```bash
git add modules/bayaan-widgets/android scripts/sync-widget-fonts.js .gitignore
git commit -m "feat(widgets): add Android Continue Listening Glance widget"
```

---

### Task 9: JS sync loop, command draining, and deep links

**Files:**
- Create: `services/widgets/collectSnapshotInput.ts`, `services/widgets/syncWidgets.ts`, `app/player.tsx`
- Modify: `app/_layout.tsx` (start sync once), `services/audio/ExpoAudioProvider.tsx:120-146` (drain after `expoAudioService.setPlayer`), `app/mushaf/[page].tsx`, `app/quran/[surah].tsx`

**Interfaces:**
- Consumes: everything above.
- Produces: `startWidgetSync(): () => void`, `drainWidgetCommands(): Promise<void>`.

- [ ] **Step 1: collectSnapshotInput**

```ts
// services/widgets/collectSnapshotInput.ts
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {useReciterStore} from '@/store/reciterStore';
import {useThemeStore} from '@/store/themeStore';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {getSurahOfTheDay} from '@/utils/quranPages';
import {hasArtwork} from 'bayaan-widgets';
import {artworkFileName, SnapshotInput} from './buildSnapshot';

const OPENING_WORDS = 6;

function openingTextForPage(page: number): string {
  if (!digitalKhattDataService.initialized) return '';
  const firstKey = mushafVerseMapService.getOrderedVerseKeysForPage(page)[0];
  if (!firstKey) return '';
  return digitalKhattDataService
    .getVerseText(firstKey)
    .split(' ')
    .slice(0, OPENING_WORDS)
    .join(' ');
}

export function collectSnapshotInput(now: Date): SnapshotInput {
  const player = usePlayerStore.getState();
  const reciter = useReciterStore.getState().defaultReciter;
  return {
    now: now.getTime(),
    theme: useThemeStore.getState().themeMode,
    queueTracks: player.queue.tracks,
    currentIndex: player.queue.currentIndex,
    isPlaying: player.playback.state === 'playing',
    positionSec: player.playback.position,
    durationSec: player.playback.duration,
    recentTracks: useRecentlyPlayedStore.getState().recentTracks,
    defaultReciter: reciter.id === '' ? null : reciter,
    lastReadPage: mushafSessionStore.getLastReadPage(),
    openingTextForPage,
    tasbeeh: {}, // filled in Plan 1b
    artworkFileFor: id => {
      const file = artworkFileName(id);
      return hasArtwork(file) ? file : null;
    },
    surahOfTheDayId: getSurahOfTheDay(now).id,
  };
}
```

Verify `useThemeStore` `themeMode` values are exactly `'light' | 'dark' | 'system'` (`store/themeStore.ts:8`); map if they differ.

- [ ] **Step 2: syncWidgets**

```ts
// services/widgets/syncWidgets.ts
import {AppState} from 'react-native';
import {
  changedWidgetKinds,
  isWidgetsAvailable,
  reloadWidgets,
  writeSnapshot,
  cacheArtwork,
  hasArtwork,
  addWidgetCommandListener,
  takeQueuedCommands,
  selectFreshCommands,
  WidgetSnapshot,
} from 'bayaan-widgets';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {useReciterStore} from '@/store/reciterStore';
import {useThemeStore} from '@/store/themeStore';
import {getReciterByIdSync} from '@/services/dataService';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {buildSnapshot, artworkFileName} from './buildSnapshot';
import {collectSnapshotInput} from './collectSnapshotInput';
import {handleWidgetCommand} from './handleWidgetCommand';

const DEBOUNCE_MS = 1000;

let lastSnapshot: WidgetSnapshot | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let playerReady = false;

async function ensureArtwork(snapshot: WidgetSnapshot): Promise<boolean> {
  const ids = new Set<string>();
  const tracks = [
    ...(snapshot.nowPlaying ? [snapshot.nowPlaying.track] : []),
    ...snapshot.upNext,
    ...snapshot.recent,
  ];
  for (const t of tracks) if (!t.isUserUpload && t.reciterId) ids.add(t.reciterId);
  if (snapshot.defaultReciter) ids.add(snapshot.defaultReciter.id);

  let added = false;
  for (const id of ids) {
    const file = artworkFileName(id);
    if (hasArtwork(file)) continue;
    const reciter = getReciterByIdSync(id);
    if (!reciter) continue;
    const url = getReciterArtwork(reciter);
    if (url.startsWith('data:')) continue;
    added = (await cacheArtwork(url, file)) || added;
  }
  return added;
}

export function flushWidgetSnapshot(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  const next = buildSnapshot(collectSnapshotInput(new Date()));
  const kinds = changedWidgetKinds(lastSnapshot, next);
  if (kinds.length === 0) return;
  writeSnapshot(next);
  reloadWidgets(kinds);
  lastSnapshot = next;
  // Artwork arrives async; rebuild once so snapshot references the files.
  void ensureArtwork(next).then(added => {
    if (added) {
      lastSnapshot = null;
      flushWidgetSnapshot();
    }
  });
}

function schedule(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(flushWidgetSnapshot, DEBOUNCE_MS);
}

export async function drainWidgetCommands(): Promise<void> {
  if (!playerReady) return;
  for (const command of selectFreshCommands(takeQueuedCommands(), Date.now())) {
    await handleWidgetCommand(command);
  }
}

export function markPlayerReadyForWidgets(): void {
  playerReady = true;
  void drainWidgetCommands();
}

export function startWidgetSync(): () => void {
  if (!isWidgetsAvailable()) return () => undefined;
  const unsubs = [
    usePlayerStore.subscribe(schedule),
    useRecentlyPlayedStore.subscribe(schedule),
    useReciterStore.subscribe(schedule),
    useThemeStore.subscribe(schedule),
  ];
  const appState = AppState.addEventListener('change', state => {
    if (state === 'background') flushWidgetSnapshot();
    if (state === 'active') void drainWidgetCommands();
  });
  const commands = addWidgetCommandListener(() => void drainWidgetCommands());
  schedule();
  return () => {
    unsubs.forEach(u => u());
    appState.remove();
    commands.remove();
    if (timer) clearTimeout(timer);
  };
}
```

- [ ] **Step 3: Wire into the app**

In `services/audio/ExpoAudioProvider.tsx`, inside `initializePlayer` right after `await lockScreenService.startSync();`, add:

```ts
        markPlayerReadyForWidgets();
```
with `import {markPlayerReadyForWidgets} from '@/services/widgets/syncWidgets';`.

In `app/_layout.tsx`, add a `useEffect(() => startWidgetSync(), []);` in the root layout component next to the existing effects (around line 133), with `import {startWidgetSync} from '@/services/widgets/syncWidgets';`.

- [ ] **Step 4: Deep links**

```tsx
// app/player.tsx
import React, {useEffect} from 'react';
import {Redirect} from 'expo-router';
import {usePlayerStore} from '@/services/player/store/playerStore';

// bayaan://player (widgets): land on home with the full player open.
export default function PlayerDeepLink(): React.ReactElement {
  useEffect(() => {
    usePlayerStore.getState().setSheetMode('full');
  }, []);
  return <Redirect href="/(tabs)/(a.home)" />;
}
```

```tsx
// app/mushaf/[page].tsx
import React from 'react';
import {Redirect, useLocalSearchParams} from 'expo-router';

// Canonical /mushaf/{page} URL (widgets, App Links). Hands off to the reader.
export default function MushafPageLink(): React.ReactElement {
  const {page} = useLocalSearchParams<{page: string}>();
  return <Redirect href={{pathname: '/mushaf', params: {page}}} />;
}
```

```tsx
// app/quran/[surah].tsx
import React from 'react';
import {Redirect, useLocalSearchParams} from 'expo-router';

// Canonical /quran/{surah}?ayah=N URL (widgets, App Links). Hands off to the reader.
export default function QuranSurahLink(): React.ReactElement {
  const {surah, ayah} = useLocalSearchParams<{surah: string; ayah?: string}>();
  return (
    <Redirect href={{pathname: '/mushaf', params: ayah ? {surah, ayah} : {surah}}} />
  );
}
```

`app/mushaf.tsx` already validates `page` (1 to 604) and `surah`, so invalid params degrade to its default.

- [ ] **Step 5: Verify links on the simulator**

```bash
xcrun simctl openurl booted "bayaan://mushaf/293"
xcrun simctl openurl booted "bayaan://quran/18?ayah=10"
xcrun simctl openurl booted "bayaan://player"
xcrun simctl openurl booted "bayaan://mushaf/9999"
```
Expected: mushaf at page 293; mushaf at Al-Kahf 18:10; home with full player; mushaf at its default page (no crash). Repeat on Android with `adb shell am start -a android.intent.action.VIEW -d "bayaan://mushaf/293"`.

- [ ] **Step 6: Typecheck, tests, commit**

```bash
npx tsc --noEmit && npm run test:ci -- --silent
npx prettier --write services/widgets app/player.tsx app/mushaf/[page].tsx app/quran/[surah].tsx app/_layout.tsx services/audio/ExpoAudioProvider.tsx
git add services/widgets app/player.tsx "app/mushaf/[page].tsx" "app/quran/[surah].tsx" app/_layout.tsx services/audio/ExpoAudioProvider.tsx
git commit -m "feat(widgets): sync snapshots, drain widget commands, real deep links"
```

---

### Task 10: Device verification and wrap-up

**Files:**
- Create: `docs/superpowers/plans/2026-10-08-widgets-phase-1a-device-checklist.md` (results)

- [ ] **Step 1: Run the checklist on a physical iPhone (iOS 17+) and an Android device or emulator (API 31+), recording pass/fail and notes for each**

1. App killed (swiped away). Tap Play on the small widget. Audio starts; time to audio noted. Widget flips to pause.
2. App alive in background. Tap pause, then play. No double toggle; icon flips each time.
3. Tap an up-next row (medium). That surah plays with the right reciter and rewayah.
4. Fresh install (delete app, reinstall, do not play). Widget shows surah of the day with default reciter, or "Start listening" before reciters load.
5. Play for 3 minutes with the widget visible. Countdown moves; no visible flicker or reload loop (iOS: Console.app filter `chronod` for reload count).
6. Change theme in the app (light/dark). Widgets update.
7. Airplane mode, new reciter played whose artwork is not cached. Widget shows neutral tile, no crash; artwork appears after reconnect and another track change.
8. iOS 26 tinted and clear home screen modes. Artwork stays full color; text legible.
9. Android: resize the widget through all three sizes; layout switches cleanly.
10. Deep links from Task 9 Step 5 from a cold start.
11. `npm run prebuild` from a clean checkout reproduces a building project (no manual Xcode or Gradle edits).

- [ ] **Step 2: Fix failures** via superpowers:systematic-debugging, each with its own commit. If item 1 fails on iOS because JS never boots in the background, record the observed behavior and apply this fallback: (a) in `BayaanWidgetsModule.swift`, while observing, write `Date().timeIntervalSince1970` to App Group defaults key `widgets.jsAliveAt` every 30 s (a `Timer` started in `OnStartObserving`, invalidated in `OnStopObserving`); (b) make both intents also conform to `ForegroundContinuableIntent` and, at the start of `perform()`, when `jsAliveAt` is missing or older than 60 s, call `try await requestToContinueInForeground()` before enqueueing, so the app opens and drains the command on launch. Re-run items 1 and 2.

- [ ] **Step 3: Final checks**

```bash
npx tsc --noEmit
npm run test:ci -- --silent
npx prettier --check $(git diff --name-only origin/develop... | grep -E '\.(ts|tsx|js|json|md)$')
bash scripts/check-widget-fixtures.sh
```
Expected: all clean.

- [ ] **Step 4: Commit the checklist**

```bash
git add docs/superpowers/plans/2026-10-08-widgets-phase-1a-device-checklist.md
git commit -m "docs: record widgets phase 1a device verification"
```

Then use superpowers:finishing-a-development-branch (PR targets `develop`).
