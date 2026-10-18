# Widgets Phase 2 (iOS System Surfaces) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Now Playing Live Activity with Dynamic Island (surah level, with an optional per-ayah layer that ships off), iOS 18 Control Center / Action Button controls, and Siri / Shortcuts phrases, on top of the Phase 1 widget plumbing.

**Architecture:** The Live Activity content state is derived by a pure function from the same `WidgetSnapshot` that `flushWidgetSnapshot` already writes, planned against what was last sent, and pushed through new ActivityKit functions on the `bayaan-widgets` module; the widget extension renders it. Controls and Siri add thin `AudioPlaybackIntent`s in `targets/widgets/_shared/` that emit the existing `WidgetCommand`s through the existing queue. `SurahEntity` moves to `_shared` (backed by a generated surah catalog) so the app process can resolve it, and the `AppShortcutsProvider` is added to the app target only, by a config plugin.

**Tech Stack:** Expo SDK 56, RN 0.83, TypeScript strict, Jest (jest-expo), Swift / SwiftUI / WidgetKit / ActivityKit / AppIntents (iOS 17 extension, iOS 16.4 app, iOS 18 controls), `@bacons/apple-targets` 5, `@expo/config-plugins`.

**Spec:** `docs/superpowers/specs/2026-10-11-widgets-phase-2-design.md` (rulings P2-R1 to P2-R19 in its section 11). Parent spec: `docs/superpowers/specs/2026-10-08-widgets-design.md`. Conventions and current shared code: `docs/superpowers/plans/2026-10-10-widgets-phase-1b.md`.

**Before Task 1:** Phase 1b's Task 12 (device verification) must have landed on `osmansaeday/widgets-1b`. Create a new worktree for branch `osmansaeday/widgets-2` from `osmansaeday/widgets-1b` (superpowers:using-git-worktrees; do not switch branches in the shared `widgets` worktree, other agents use it), run `npm ci` in it, copy the spec to `docs/superpowers/specs/2026-10-11-widgets-phase-2-design.md` and this plan to `docs/superpowers/plans/2026-10-11-widgets-phase-2.md`, and commit them with `git commit -m "docs: add widgets phase 2 spec and plan"`. All commands below run from that worktree's root.

## Global Constraints

- Branch `osmansaeday/widgets-2`; PRs target `develop` after 1b merges (P2-R19). Conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`).
- Never use the em dash character anywhere (code, comments, copy, commits). Use a period, comma, colon or parentheses.
- Never use `theme.colors.primary` or any accent color. Palette: background `#1C1C1E` (`WidgetPalette.background`), white text, secondary white 75%, tertiary white 60%, tiles white 15%, round 30 pt buttons (`RoundIntentButton`), Bayaan mark (`BayaanLogo`) top-right.
- Quran text is Digital Khatt (`WidgetFonts.quran`, PostScript name `DigitalKhattNewMadinaRegular`), centered or trailing, never justified.
- TypeScript strict. No `any`, no `as` casts in non-test code (JSON goes through type guards). Explicit parameter and return types. `function` keyword for pure functions. No classes in TS. Directories lowercase-with-hyphens (`services/widgets/live-activity/`); Swift folders under `targets/widgets/` keep the existing PascalCase convention.
- iOS only (P2-R17). Do not touch Android code.
- Platform floors: app iOS 16.4, extension iOS 17.0, Live Activity and Siri intents iOS 17.0, controls iOS 18.0. Every App Intents type in `targets/widgets/_shared/` carries `@available(iOS 17.0, *)` or `@available(iOS 18.0, *)`, because `_shared` compiles into the iOS 16.4 app too. Every `ControlWidget` type carries `@available(iOS 18.0, *)`.
- `targets/widgets/_shared/` files compile into the app and the extension; App Intents that must run in the app process live there. Extension-only Swift goes in a per-feature folder (`LiveActivity/`, `Controls/`) or `Support/`. App-only Swift goes in `plugins/app-shortcuts/` and is added by `plugins/withAppShortcuts.js`.
- `NowPlayingActivityState.swift` and `NowPlayingAttributes.swift` exist as two byte-identical copies, `modules/bayaan-widgets/ios/` and `targets/widgets/LiveActivity/` (P2-R4). Edit both or neither; `npm run test:widget-fixtures` fails if they differ.
- Everything survives `npm run prebuild` (`expo prebuild --clean`). Never hand edit `ios/`. Adding or removing a file in `_shared/`, in `modules/bayaan-widgets/ios/`, or changing `expo-target.config.js` / `app.config.js` requires `npm run prebuild` before building. Commit regenerated `ios/` output only when prebuild changes it.
- Do not edit `targets/widgets/ContinueListening/*` (reuse `Artwork` and `EffectivePlayback` from it as they are), any Android file, or any Phase 1 test except where a task names it.
- Live Activity mode: `liveActivityMode()` in `services/widgets/live-activity/config.ts` returns `'surah'`. Never commit `'ayah'` until the device prototype in Task 10 passes (P2-R1).
- Widget and control kind strings: `ContinueListening`, `ListeningAccessory` (existing), `PlaybackControl`, `PlaySurahControl` (new).
- Commands that exist in this repo:
  - Typecheck: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`
  - Jest: `npx jest <path>` for one file or folder, `npm run test:ci -- --silent` for all
  - Swift fixture and logic checks: `npm run test:widget-fixtures`
  - Regenerate static widget data: `npm run generate:widget-data`
  - Prebuild: `npm run prebuild`
  - iOS build (Xcode 27; no global `IPHONEOS_DEPLOYMENT_TARGET`, it drags the iOS 17 extension down; apply the local `expo-modules-jsi` Swift patch from project memory if the build stops there, never commit it): `xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20`
  - Format: `npx prettier --write <changed ts/tsx/js files>` (JSON and Markdown are in `.prettierignore`)
- Before calling any task done: typecheck and prettier pass clean, and the task's tests pass.
- Host memory is tight: one `xcodebuild` at a time, no Android emulator, and use the existing "Bayaan Widgets" simulator (B68030CC-7E5B-4127-BE07-EFA327BE6680, iPhone 17 Pro, iOS 26.2, has a Dynamic Island).

## Review Focus

1. **Rapid track changes (skip next several times in a second).** Expect one activity showing the final track, never two activities and no start/update race. Pinned by Task 5 "collapses rapid track changes into one start".
2. **The user swipes the Live Activity away while audio keeps playing.** Expect it to stay away for that track and come back on the next track. Pinned by Task 4 `afterUpdate` false test and Task 5 "does not restart a dismissed activity for the same track".
3. **Live Activities turned off in Settings for Bayaan.** Expect no activity and no native call on every snapshot. Pinned by Task 4 `afterStart` "disabled" test and Task 5 "does not retry a disabled start for the same track".
4. **Playback speed other than 1x (0.75x, 1.5x).** Expect the bar and countdown to finish exactly when the audio does, and ayah boundaries to fire on time. Pinned by Task 1 rate 1.5 vectors (TS and Swift), Task 4 `staleAtFor` rate test, Task 6 `msUntilNextAyah` rate test.
5. **App killed (or crashed) while an activity is up, then relaunched.** Expect the orphan to be removed before anything new starts, and no activity for a restored paused session. Pinned by Task 5 "ends orphans before the first start" and "does not start for a paused session".

---

## File Structure

```
modules/bayaan-widgets/
  src/liveActivity.ts                         NowPlayingActivityState types, guards, wall-time helpers
  src/__fixtures__/liveActivity.states.json   shared with Swift
  src/__tests__/liveActivity.test.ts
  src/__tests__/liveActivityBridge.test.ts
  src/index.ts, src/NativeBayaanWidgets.ts    (modified) Live Activity wrappers
  ios/NowPlayingActivityState.swift           copy A (identical to copy B)
  ios/NowPlayingAttributes.swift              copy A (identical to copy B)
  ios/NowPlayingActivityBridge.swift          ActivityKit start / update / end
  ios/BayaanWidgetsModule.swift               (modified) bridge functions, control reload, shortcut refresh
services/widgets/live-activity/
  config.ts                                   liveActivityMode()
  planActivity.ts                             pure policy
  syncLiveActivity.ts                         serialized native calls, foreground retry, orphan cleanup
  ayahLayer.ts                                pure ayah math and UTF-8 truncation
  ayahTicker.ts                               timer-driven ayah publisher
  __tests__/planActivity.test.ts, syncLiveActivity.test.ts, ayahLayer.test.ts, ayahTicker.test.ts
services/widgets/syncWidgets.ts               (modified) hands each written snapshot to the activity
services/widgets/widgetStaticData.ts          (modified) buildSurahCatalogSwift
test-utils/widgetSnapshots.ts                 snapshot builders for tests
targets/widgets/
  LiveActivity/NowPlayingActivityState.swift  copy B
  LiveActivity/NowPlayingAttributes.swift     copy B
  LiveActivity/NowPlayingLiveActivity.swift   Lock Screen + Dynamic Island views, previews
  Controls/PlaybackControls.swift             PlaybackControl, PlaySurahControl (iOS 18)
  _shared/PlaybackIntents.swift               (modified) PlaybackCommand, new intents
  _shared/PlaybackResume.swift                pure resume decision
  _shared/SurahEntity.swift                   moved from Support/Entities.swift
  _shared/SurahSynonyms.swift                 spoken name variants
  _shared/SurahCatalog.swift                  generated
  Support/Entities.swift                      (modified) SurahEntity removed
  WidgetsBundle.swift, expo-target.config.js  (modified)
plugins/withAppShortcuts.js                   adds the app-only Swift file on prebuild
plugins/app-shortcuts/BayaanAppShortcuts.swift
scripts/check-widget-system-surfaces.sh       Phase 2 Swift checks
scripts/generate-widget-data.ts               (modified) writes SurahCatalog.swift
app.config.js, app/_layout.tsx, package.json  (modified)
docs/superpowers/plans/2026-10-11-widgets-phase-2-device-checklist.md   Task 10 results
```

Task order: 1 content state contract, 2 native bridge, 3 Live Activity views, 4 pure policy, 5 JS sync, 6 per-ayah layer (off), 7 shared intents and surah entity, 8 controls, 9 Siri, 10 device verification. Native functions land (Task 2) before JS calls them (Task 5); intents land (Task 7) before controls and Siri use them (Tasks 8, 9).

---

### Task 1: Live Activity content state contract

The one data shape shared by TS, the module pod and the extension, with a fixture both languages decode and the wall-time math both sides use.

**Files:**
- Create: `modules/bayaan-widgets/src/liveActivity.ts`, `modules/bayaan-widgets/src/__fixtures__/liveActivity.states.json`, `modules/bayaan-widgets/src/__tests__/liveActivity.test.ts`, `modules/bayaan-widgets/ios/NowPlayingActivityState.swift`, `targets/widgets/LiveActivity/NowPlayingActivityState.swift`, `scripts/check-widget-system-surfaces.sh`
- Modify: `modules/bayaan-widgets/src/index.ts` (export), `package.json` (`test:widget-fixtures`)

**Interfaces:**
- Produces (TS, exported from `bayaan-widgets`): `NowPlayingAyah {number; count; text}`, `NowPlayingActivityState {surahId; surahName; reciterName; artworkFile: string | null; isPlaying; positionSec; durationSec; rate; anchorAt; ayah: NowPlayingAyah | null}`, `ActivityStartResult = 'started' | 'updated' | 'deferred' | 'disabled' | 'unsupported' | 'invalid' | 'error' | 'unavailable'`, `isNowPlayingAyah(v: unknown): v is NowPlayingAyah`, `isNowPlayingActivityState(v: unknown): v is NowPlayingActivityState`, `isActivityStartResult(v: unknown): v is ActivityStartResult`, `safeActivityRate(rate: number): number`, `activityWallStart(s: NowPlayingActivityState): number` (epoch ms), `activityWallEnd(s: NowPlayingActivityState): number` (epoch ms).
- Produces (Swift, both copies): `struct NowPlayingAyah: Codable, Hashable {number: Int; count: Int; text: String}`, `struct NowPlayingActivityState: Codable, Hashable` with the same fields (`anchorAt: Double` epoch ms) and computed `safeRate: Double`, `wallStart: Date`, `wallEnd: Date`, `fraction: Double`, `remainingWallSec: Double`.
- Produces: `scripts/check-widget-system-surfaces.sh`, which later tasks extend by inserting checks before its `print("swift system surfaces: OK")` line and files into its `cat` list.

- [ ] **Step 1: Write the fixture**

`modules/bayaan-widgets/src/__fixtures__/liveActivity.states.json`:

```json
[
  {
    "surahId": 18,
    "surahName": "Al-Kahf",
    "reciterName": "Mishary Alafasy",
    "artworkFile": "surah-18.jpg",
    "isPlaying": true,
    "positionSec": 120.5,
    "durationSec": 1800,
    "rate": 1,
    "anchorAt": 1791460800000,
    "ayah": {
      "number": 10,
      "count": 110,
      "text": "إِذۡ أَوَى ٱلۡفِتۡيَةُ إِلَى ٱلۡكَهۡفِ"
    }
  },
  {
    "surahId": 36,
    "surahName": "Ya-Sin",
    "reciterName": "Mishary Alafasy",
    "artworkFile": null,
    "isPlaying": false,
    "positionSec": 900,
    "durationSec": 1800,
    "rate": 1.5,
    "anchorAt": 1791460800000,
    "ayah": null
  }
]
```

- [ ] **Step 2: Write the failing TS test**

`modules/bayaan-widgets/src/__tests__/liveActivity.test.ts`:

```ts
import states from '../__fixtures__/liveActivity.states.json';
import {
  activityWallEnd,
  activityWallStart,
  isActivityStartResult,
  isNowPlayingActivityState,
  safeActivityRate,
  type NowPlayingActivityState,
} from '../liveActivity';

function fixture(index: number): NowPlayingActivityState {
  const value: unknown = states[index];
  if (!isNowPlayingActivityState(value)) throw new Error('bad fixture');
  return value;
}

describe('isNowPlayingActivityState', () => {
  it('accepts the shared fixtures', () => {
    expect(states.every(isNowPlayingActivityState)).toBe(true);
  });

  it('rejects missing fields, bad ayah and non objects', () => {
    const {rate: _rate, ...noRate} = fixture(0);
    expect(isNowPlayingActivityState(noRate)).toBe(false);
    expect(isNowPlayingActivityState({...fixture(0), ayah: {number: 1}})).toBe(
      false,
    );
    expect(isNowPlayingActivityState({...fixture(0), anchorAt: NaN})).toBe(
      false,
    );
    expect(isNowPlayingActivityState(null)).toBe(false);
    expect(isNowPlayingActivityState([])).toBe(false);
  });
});

describe('wall time', () => {
  it('matches the Swift vectors at 1x', () => {
    expect(activityWallStart(fixture(0))).toBe(1791460679500);
    expect(activityWallEnd(fixture(0))).toBe(1791462479500);
  });

  it('scales by the playback rate', () => {
    expect(activityWallStart(fixture(1))).toBe(1791460200000);
    expect(activityWallEnd(fixture(1))).toBe(1791461400000);
  });

  it('clamps the position and treats a bad rate as 1', () => {
    const past = {...fixture(0), positionSec: 5000, rate: 0};
    expect(activityWallEnd(past)).toBe(past.anchorAt);
    expect(safeActivityRate(-1)).toBe(1);
    expect(safeActivityRate(Number.POSITIVE_INFINITY)).toBe(1);
    expect(safeActivityRate(0.75)).toBe(0.75);
  });
});

describe('isActivityStartResult', () => {
  it('accepts the bridge results only', () => {
    expect(isActivityStartResult('started')).toBe(true);
    expect(isActivityStartResult('deferred')).toBe(true);
    expect(isActivityStartResult('nope')).toBe(false);
    expect(isActivityStartResult(1)).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest modules/bayaan-widgets/src/__tests__/liveActivity.test.ts`
Expected: FAIL with "Cannot find module '../liveActivity'".

- [ ] **Step 4: Implement the TS contract**

`modules/bayaan-widgets/src/liveActivity.ts`:

```ts
// modules/bayaan-widgets/src/liveActivity.ts
// Content state of the Now Playing Live Activity. Field names match
// NowPlayingActivityState.swift (identical copies in modules/bayaan-widgets/ios
// and targets/widgets/LiveActivity); both decode __fixtures__/liveActivity.states.json.
import {isNullableString, isRecord} from './guards';

export interface NowPlayingAyah {
  number: number;
  count: number;
  text: string; // Digital Khatt, already truncated by the app
}

export interface NowPlayingActivityState {
  surahId: number; // 0 for user uploads without a surah
  surahName: string;
  reciterName: string;
  artworkFile: string | null; // file name inside the shared artwork dir
  isPlaying: boolean;
  positionSec: number; // at anchorAt
  durationSec: number;
  rate: number; // playback speed, 1 is normal
  anchorAt: number; // epoch ms when positionSec was sampled
  ayah: NowPlayingAyah | null;
}

export type ActivityStartResult =
  | 'started'
  | 'updated'
  | 'deferred'
  | 'disabled'
  | 'unsupported'
  | 'invalid'
  | 'error'
  | 'unavailable';

const START_RESULTS: readonly ActivityStartResult[] = [
  'started',
  'updated',
  'deferred',
  'disabled',
  'unsupported',
  'invalid',
  'error',
  'unavailable',
];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isActivityStartResult(
  value: unknown,
): value is ActivityStartResult {
  return typeof value === 'string' && START_RESULTS.some(r => r === value);
}

export function isNowPlayingAyah(value: unknown): value is NowPlayingAyah {
  return (
    isRecord(value) &&
    isFiniteNumber(value.number) &&
    isFiniteNumber(value.count) &&
    typeof value.text === 'string'
  );
}

export function isNowPlayingActivityState(
  value: unknown,
): value is NowPlayingActivityState {
  return (
    isRecord(value) &&
    isFiniteNumber(value.surahId) &&
    typeof value.surahName === 'string' &&
    typeof value.reciterName === 'string' &&
    isNullableString(value.artworkFile) &&
    typeof value.isPlaying === 'boolean' &&
    isFiniteNumber(value.positionSec) &&
    isFiniteNumber(value.durationSec) &&
    isFiniteNumber(value.rate) &&
    isFiniteNumber(value.anchorAt) &&
    (value.ayah === null || isNowPlayingAyah(value.ayah))
  );
}

export function safeActivityRate(rate: number): number {
  return rate > 0 && Number.isFinite(rate) ? rate : 1;
}

function clampedPosition(s: NowPlayingActivityState): number {
  return Math.min(Math.max(s.positionSec, 0), Math.max(s.durationSec, 0));
}

/** Epoch ms at which the track would have been at 0, playing at its rate. */
export function activityWallStart(s: NowPlayingActivityState): number {
  return s.anchorAt - (clampedPosition(s) / safeActivityRate(s.rate)) * 1000;
}

/** Epoch ms at which the track ends if playback continues. */
export function activityWallEnd(s: NowPlayingActivityState): number {
  return (
    s.anchorAt +
    ((Math.max(s.durationSec, 0) - clampedPosition(s)) /
      safeActivityRate(s.rate)) *
      1000
  );
}
```

In `modules/bayaan-widgets/src/index.ts`, after `export * from './dayMath';` add:

```ts
export * from './liveActivity';
```

- [ ] **Step 5: Run the TS test to verify it passes**

Run: `npx jest modules/bayaan-widgets/src/__tests__/liveActivity.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Write the Swift model (both copies, identical bytes)**

Write this exact content to both `modules/bayaan-widgets/ios/NowPlayingActivityState.swift` and `targets/widgets/LiveActivity/NowPlayingActivityState.swift`:

```swift
// NowPlayingActivityState.swift
// Two identical copies: modules/bayaan-widgets/ios (starts and updates the
// Live Activity) and targets/widgets/LiveActivity (renders it). Field names
// match modules/bayaan-widgets/src/liveActivity.ts.
// scripts/check-widget-system-surfaces.sh fails if the copies differ.
import Foundation

struct NowPlayingAyah: Codable, Hashable {
  let number: Int
  let count: Int
  let text: String
}

struct NowPlayingActivityState: Codable, Hashable {
  let surahId: Int
  let surahName: String
  let reciterName: String
  let artworkFile: String?
  let isPlaying: Bool
  let positionSec: Double
  let durationSec: Double
  let rate: Double
  /// Epoch milliseconds at which positionSec was sampled.
  let anchorAt: Double
  let ayah: NowPlayingAyah?

  var safeRate: Double { rate > 0 && rate.isFinite ? rate : 1 }
  private var duration: Double { max(0, durationSec) }
  private var position: Double { min(max(positionSec, 0), duration) }

  /// When the track would have been at 0, playing at its rate.
  var wallStart: Date { Date(timeIntervalSince1970: anchorAt / 1000 - position / safeRate) }
  /// When the track ends if playback continues.
  var wallEnd: Date { Date(timeIntervalSince1970: anchorAt / 1000 + (duration - position) / safeRate) }
  var fraction: Double { duration > 0 ? position / duration : 0 }
  var remainingWallSec: Double { (duration - position) / safeRate }
}
```

- [ ] **Step 7: Write the Swift check script**

`scripts/check-widget-system-surfaces.sh`:

```bash
#!/usr/bin/env bash
# Phase 2 Swift checks: files that must stay identical between the module pod
# and the widget extension, the Live Activity fixture decode, and pure logic
# compiled into the app and the extension.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fixtures="$root/modules/bayaan-widgets/src/__fixtures__"

cmp "$root/modules/bayaan-widgets/ios/NowPlayingActivityState.swift" \
    "$root/targets/widgets/LiveActivity/NowPlayingActivityState.swift"

cat "$root/targets/widgets/LiveActivity/NowPlayingActivityState.swift" > "$tmp/surfaces-test.swift"
cat >> "$tmp/surfaces-test.swift" <<'SWIFT'
let dir = CommandLine.arguments[1]
func load(_ path: String) -> Data { try! Data(contentsOf: URL(fileURLWithPath: path)) }

// Live Activity content state (same vectors as liveActivity.test.ts)
let states = try! JSONDecoder().decode([NowPlayingActivityState].self, from: load("\(dir)/liveActivity.states.json"))
precondition(states.count == 2 && states[0].ayah?.number == 10 && states[0].ayah?.count == 110, "state decode")
precondition(states[1].ayah == nil && states[1].artworkFile == nil, "nulls decode")
precondition(states[0].wallStart.timeIntervalSince1970 == 1_791_460_679.5, "wallStart")
precondition(states[0].wallEnd.timeIntervalSince1970 == 1_791_462_479.5, "wallEnd")
precondition(states[1].wallStart.timeIntervalSince1970 == 1_791_460_200, "wallStart rate 1.5")
precondition(states[1].wallEnd.timeIntervalSince1970 == 1_791_461_400, "wallEnd rate 1.5")
precondition(states[1].fraction == 0.5 && states[1].remainingWallSec == 600, "paused fraction")
print("swift system surfaces: OK")
SWIFT

swift "$tmp/surfaces-test.swift" "$fixtures"
```

Make it executable: `chmod +x scripts/check-widget-system-surfaces.sh`.

In `package.json`, replace the `test:widget-fixtures` script with:

```json
    "test:widget-fixtures": "bash scripts/check-widget-fixtures.sh && bash scripts/check-widget-system-surfaces.sh",
```

- [ ] **Step 8: Run the Swift checks**

Run: `npm run test:widget-fixtures`
Expected: the existing `swift fixture decode: OK` and `swift widget logic: OK`, then `swift system surfaces: OK`.

- [ ] **Step 9: Typecheck, format, commit**

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
npx prettier --write modules/bayaan-widgets/src/liveActivity.ts modules/bayaan-widgets/src/__tests__/liveActivity.test.ts modules/bayaan-widgets/src/index.ts
git add modules/bayaan-widgets/src/liveActivity.ts modules/bayaan-widgets/src/__fixtures__/liveActivity.states.json modules/bayaan-widgets/src/__tests__/liveActivity.test.ts modules/bayaan-widgets/src/index.ts modules/bayaan-widgets/ios/NowPlayingActivityState.swift targets/widgets/LiveActivity/NowPlayingActivityState.swift scripts/check-widget-system-surfaces.sh package.json
git commit -m "feat(widgets): add the Live Activity content state contract"
```

---

### Task 2: Native Live Activity bridge

ActivityKit start, update and end in the module pod, the TS wrappers, and the Info.plist key. Nothing renders yet (Task 3); the deliverable is a building app and tested wrappers.

**Files:**
- Create: `modules/bayaan-widgets/ios/NowPlayingAttributes.swift`, `modules/bayaan-widgets/ios/NowPlayingActivityBridge.swift`, `modules/bayaan-widgets/src/__tests__/liveActivityBridge.test.ts`
- Modify: `modules/bayaan-widgets/ios/BayaanWidgetsModule.swift`, `modules/bayaan-widgets/src/NativeBayaanWidgets.ts`, `modules/bayaan-widgets/src/index.ts`, `app.config.js`

**Interfaces:**
- Consumes: `NowPlayingActivityState`, `ActivityStartResult`, `isActivityStartResult` (Task 1).
- Produces (TS, exported from `bayaan-widgets`): `isLiveActivitySupported(): boolean`, `startNowPlayingActivity(state: NowPlayingActivityState, staleAt: number): Promise<ActivityStartResult>` (`'unavailable'` when the native function is absent, `'error'` for an unknown native result), `updateNowPlayingActivity(state: NowPlayingActivityState, staleAt: number): Promise<boolean>` (false when no activity is live or native is absent), `endNowPlayingActivities(): Promise<void>`. `staleAt` is epoch ms.
- Produces (native): module functions `isLiveActivitySupported`, `startNowPlayingActivity(json, staleAtMs)`, `updateNowPlayingActivity(json, staleAtMs)`, `endNowPlayingActivities()`; Swift `struct NowPlayingAttributes: ActivityAttributes { typealias ContentState = NowPlayingActivityState }` (copy A; Task 3 adds copy B).

- [ ] **Step 1: Write the failing wrapper test**

`modules/bayaan-widgets/src/__tests__/liveActivityBridge.test.ts`:

```ts
import type {NativeBayaanWidgetsModule} from '../NativeBayaanWidgets';
import states from '../__fixtures__/liveActivity.states.json';
import {
  endNowPlayingActivities,
  isLiveActivitySupported,
  startNowPlayingActivity,
  updateNowPlayingActivity,
} from '../index';
import {
  isNowPlayingActivityState,
  type NowPlayingActivityState,
} from '../liveActivity';

let mockNative: Partial<NativeBayaanWidgetsModule> | null = null;

jest.mock('../NativeBayaanWidgets', () => ({
  get NativeBayaanWidgets(): Partial<NativeBayaanWidgetsModule> | null {
    return mockNative;
  },
}));

function state(): NowPlayingActivityState {
  const value: unknown = states[0];
  if (!isNowPlayingActivityState(value)) throw new Error('bad fixture');
  return value;
}

describe('Live Activity wrappers', () => {
  beforeEach(() => {
    mockNative = null;
  });

  it('degrade without the native module', async () => {
    expect(isLiveActivitySupported()).toBe(false);
    await expect(startNowPlayingActivity(state(), 1)).resolves.toBe(
      'unavailable',
    );
    await expect(updateNowPlayingActivity(state(), 1)).resolves.toBe(false);
    await expect(endNowPlayingActivities()).resolves.toBeUndefined();
  });

  it('degrade when the functions are absent (Android)', async () => {
    mockNative = {writeSnapshot: jest.fn()};
    expect(isLiveActivitySupported()).toBe(false);
    await expect(startNowPlayingActivity(state(), 1)).resolves.toBe(
      'unavailable',
    );
    await expect(updateNowPlayingActivity(state(), 1)).resolves.toBe(false);
  });

  it('pass JSON and the stale time, and parse the result', async () => {
    const start = jest.fn(async () => 'started');
    const update = jest.fn(async () => true);
    const end = jest.fn(async () => undefined);
    mockNative = {
      isLiveActivitySupported: () => true,
      startNowPlayingActivity: start,
      updateNowPlayingActivity: update,
      endNowPlayingActivities: end,
    };
    expect(isLiveActivitySupported()).toBe(true);
    await expect(startNowPlayingActivity(state(), 42)).resolves.toBe('started');
    expect(start).toHaveBeenCalledWith(JSON.stringify(state()), 42);
    await expect(updateNowPlayingActivity(state(), 43)).resolves.toBe(true);
    expect(update).toHaveBeenCalledWith(JSON.stringify(state()), 43);
    await endNowPlayingActivities();
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('maps an unknown native result to error', async () => {
    mockNative = {startNowPlayingActivity: jest.fn(async () => 'weird')};
    await expect(startNowPlayingActivity(state(), 1)).resolves.toBe('error');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest modules/bayaan-widgets/src/__tests__/liveActivityBridge.test.ts`
Expected: FAIL with "isLiveActivitySupported is not a function" (or a TS error that the export does not exist).

- [ ] **Step 3: Add the TS wrappers**

In `modules/bayaan-widgets/src/NativeBayaanWidgets.ts`, inside `interface NativeBayaanWidgetsModule`, after `readArtworkRequests(): string;` add:

```ts
  // iOS only (absent on Android): the Now Playing Live Activity.
  isLiveActivitySupported?(): boolean;
  startNowPlayingActivity?(json: string, staleAtMs: number): Promise<string>;
  updateNowPlayingActivity?(json: string, staleAtMs: number): Promise<boolean>;
  endNowPlayingActivities?(): Promise<void>;
```

In `modules/bayaan-widgets/src/index.ts`, add to the imports:

```ts
import {
  isActivityStartResult,
  type ActivityStartResult,
  type NowPlayingActivityState,
} from './liveActivity';
```

and append at the end of the file:

```ts
export function isLiveActivitySupported(): boolean {
  return NativeBayaanWidgets?.isLiveActivitySupported?.() ?? false;
}

export async function startNowPlayingActivity(
  state: NowPlayingActivityState,
  staleAt: number,
): Promise<ActivityStartResult> {
  const native = NativeBayaanWidgets;
  if (!native?.startNowPlayingActivity) return 'unavailable';
  const result: unknown = await native.startNowPlayingActivity(
    JSON.stringify(state),
    staleAt,
  );
  return isActivityStartResult(result) ? result : 'error';
}

export async function updateNowPlayingActivity(
  state: NowPlayingActivityState,
  staleAt: number,
): Promise<boolean> {
  const native = NativeBayaanWidgets;
  if (!native?.updateNowPlayingActivity) return false;
  return native.updateNowPlayingActivity(JSON.stringify(state), staleAt);
}

export async function endNowPlayingActivities(): Promise<void> {
  const native = NativeBayaanWidgets;
  if (!native?.endNowPlayingActivities) return;
  await native.endNowPlayingActivities();
}
```

- [ ] **Step 4: Run the wrapper test to verify it passes**

Run: `npx jest modules/bayaan-widgets/src/__tests__/liveActivityBridge.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the Swift attributes and bridge**

`modules/bayaan-widgets/ios/NowPlayingAttributes.swift` (copy A; Task 3 writes the identical copy B):

```swift
// NowPlayingAttributes.swift
// Two identical copies: modules/bayaan-widgets/ios (starts and updates the
// Live Activity) and targets/widgets/LiveActivity (renders it). ActivityKit
// pairs them by type name. scripts/check-widget-system-surfaces.sh fails if
// the copies differ.
import ActivityKit
import Foundation

struct NowPlayingAttributes: ActivityAttributes {
  typealias ContentState = NowPlayingActivityState
}
```

`modules/bayaan-widgets/ios/NowPlayingActivityBridge.swift`:

```swift
// modules/bayaan-widgets/ios/NowPlayingActivityBridge.swift
import ActivityKit
import Foundation
import UIKit

/// Starts, updates and ends the Now Playing Live Activity for the JS layer.
/// The widget extension renders it (targets/widgets/LiveActivity).
enum NowPlayingActivityBridge {
  /// The extension that renders the activity, and Button(intent:) inside it, need iOS 17.
  static var isSupported: Bool {
    if #available(iOS 17.0, *) { return true }
    return false
  }

  private static func decode(_ json: String) -> NowPlayingActivityState? {
    guard let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(NowPlayingActivityState.self, from: data)
  }

  private static func content(_ state: NowPlayingActivityState, staleAtMs: Double)
    -> ActivityContent<NowPlayingActivityState>
  {
    ActivityContent(state: state, staleDate: Date(timeIntervalSince1970: staleAtMs / 1000))
  }

  /// The one Bayaan activity still on screen, if any.
  private static var current: Activity<NowPlayingAttributes>? {
    Activity<NowPlayingAttributes>.activities.first {
      $0.activityState == .active || $0.activityState == .stale
    }
  }

  /// Returns "started", "updated" (one already existed), "deferred" (the request
  /// failed while the app was not active; JS retries on foreground), "disabled",
  /// "unsupported", "invalid" or "error".
  @MainActor
  static func start(_ json: String, staleAtMs: Double) async -> String {
    guard isSupported else { return "unsupported" }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return "disabled" }
    guard let state = decode(json) else { return "invalid" }
    if let activity = current {
      await activity.update(content(state, staleAtMs: staleAtMs))
      return "updated"
    }
    do {
      _ = try Activity.request(
        attributes: NowPlayingAttributes(),
        content: content(state, staleAtMs: staleAtMs),
        pushType: nil)
      return "started"
    } catch {
      return UIApplication.shared.applicationState == .active ? "error" : "deferred"
    }
  }

  /// False when no activity is on screen (the user dismissed it or the system ended it).
  static func update(_ json: String, staleAtMs: Double) async -> Bool {
    guard let state = decode(json), let activity = current else { return false }
    await activity.update(content(state, staleAtMs: staleAtMs))
    return true
  }

  static func endAll() async {
    for activity in Activity<NowPlayingAttributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }
}
```

In `modules/bayaan-widgets/ios/BayaanWidgetsModule.swift`, after the line

```swift
    Function("takePendingTasbeeh") { () -> String in takeString("widgets.pendingTasbeeh") }
```

add:

```swift

    Function("isLiveActivitySupported") { () -> Bool in NowPlayingActivityBridge.isSupported }

    AsyncFunction("startNowPlayingActivity") { (json: String, staleAtMs: Double) async -> String in
      await NowPlayingActivityBridge.start(json, staleAtMs: staleAtMs)
    }

    AsyncFunction("updateNowPlayingActivity") { (json: String, staleAtMs: Double) async -> Bool in
      await NowPlayingActivityBridge.update(json, staleAtMs: staleAtMs)
    }

    AsyncFunction("endNowPlayingActivities") { () async in
      await NowPlayingActivityBridge.endAll()
    }
```

- [ ] **Step 6: Declare Live Activity support**

In `app.config.js`, inside `ios.infoPlist`, after the line ``BayaanAppGroup: `group.${IOS_BUNDLE_ID}`,`` add:

```js
        NSSupportsLiveActivities: true,
```

- [ ] **Step 7: Prebuild and build**

The pod gained Swift files and `app.config.js` changed, so prebuild first.

```bash
npm run prebuild
plutil -extract NSSupportsLiveActivities raw ios/Bayaan/Info.plist
xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20
```

Expected: `true`, then `** BUILD SUCCEEDED **`.

- [ ] **Step 8: Typecheck, format, commit**

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
npx prettier --write modules/bayaan-widgets/src/index.ts modules/bayaan-widgets/src/NativeBayaanWidgets.ts modules/bayaan-widgets/src/__tests__/liveActivityBridge.test.ts app.config.js
git add modules/bayaan-widgets/ios/NowPlayingAttributes.swift modules/bayaan-widgets/ios/NowPlayingActivityBridge.swift modules/bayaan-widgets/ios/BayaanWidgetsModule.swift modules/bayaan-widgets/src/index.ts modules/bayaan-widgets/src/NativeBayaanWidgets.ts modules/bayaan-widgets/src/__tests__/liveActivityBridge.test.ts app.config.js
git status --short ios/   # add regenerated ios/ files only if prebuild changed them
git commit -m "feat(widgets): add the native Live Activity bridge"
```

---

### Task 3: Live Activity and Dynamic Island views

The extension side: attributes copy B, Lock Screen and Dynamic Island layouts, previews.

**Files:**
- Create: `targets/widgets/LiveActivity/NowPlayingAttributes.swift`, `targets/widgets/LiveActivity/NowPlayingLiveActivity.swift`
- Modify: `targets/widgets/WidgetsBundle.swift`, `targets/widgets/expo-target.config.js`, `scripts/check-widget-system-surfaces.sh`

**Interfaces:**
- Consumes: `NowPlayingActivityState`, `NowPlayingAyah` (Task 1 copy B); `NowPlayingAttributes` (identical to Task 2 copy A); from Phase 1: `Artwork(file:size:)` (`ContinueListening/ContinueListeningViews.swift`), `RoundIntentButton`, `WidgetPalette`, `WidgetFonts` (`Support/WidgetChrome.swift`), `BayaanLogo` (`BayaanMark.swift`), `WidgetLogic.minutesLeftLabel` (`Support/WidgetLogic.swift`), `SetPlaybackIntent(playing:)` (`_shared/PlaybackIntents.swift`).
- Produces: `struct NowPlayingLiveActivity: Widget` (in the bundle).

- [ ] **Step 1: Add the identity check (fails until copy B exists)**

In `scripts/check-widget-system-surfaces.sh`, after the existing `cmp` command for `NowPlayingActivityState.swift`, add:

```bash
cmp "$root/modules/bayaan-widgets/ios/NowPlayingAttributes.swift" \
    "$root/targets/widgets/LiveActivity/NowPlayingAttributes.swift"
```

Run: `npm run test:widget-fixtures`
Expected: FAIL with `cmp: .../targets/widgets/LiveActivity/NowPlayingAttributes.swift: No such file or directory`.

- [ ] **Step 2: Write copy B of the attributes**

Copy the file byte for byte: `cp modules/bayaan-widgets/ios/NowPlayingAttributes.swift targets/widgets/LiveActivity/NowPlayingAttributes.swift`

Run: `npm run test:widget-fixtures`
Expected: all three OK lines.

- [ ] **Step 3: Write the views**

`targets/widgets/LiveActivity/NowPlayingLiveActivity.swift`:

```swift
// targets/widgets/LiveActivity/NowPlayingLiveActivity.swift
import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

private let playerURL = URL(string: "bayaan://player")!

/// Now Playing Live Activity: Lock Screen (also StandBy, scaled by the system)
/// and Dynamic Island. Started and updated by the app (NowPlayingActivityBridge).
struct NowPlayingLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: NowPlayingAttributes.self) { context in
      NowPlayingLockScreenView(state: context.state)
        .activityBackgroundTint(WidgetPalette.background)
        .activitySystemActionForegroundColor(.white)
        .widgetURL(playerURL)
    } dynamicIsland: { context in
      let state = context.state
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Artwork(file: state.artworkFile, size: 52).padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.center) {
          ActivityTitles(state: state)
        }
        DynamicIslandExpandedRegion(.trailing) {
          ActivityPlayButton(state: state).padding(.trailing, 4)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(spacing: 6) {
            if let ayah = state.ayah {
              AyahLine(ayah: ayah, lines: 2)
            }
            ActivityProgress(state: state)
          }
        }
      } compactLeading: {
        Artwork(file: state.artworkFile, size: 22)
      } compactTrailing: {
        CompactProgress(state: state)
      } minimal: {
        CompactProgress(state: state)
      }
      .widgetURL(playerURL)
      .keylineTint(.white)
    }
  }
}

struct NowPlayingLockScreenView: View {
  let state: NowPlayingActivityState

  var body: some View {
    VStack(spacing: 10) {
      HStack(spacing: 12) {
        Artwork(file: state.artworkFile, size: 56)
        ActivityTitles(state: state)
        ActivityPlayButton(state: state)
      }
      if let ayah = state.ayah {
        AyahLine(ayah: ayah, lines: 3)
      }
      ActivityProgress(state: state)
    }
    .padding(14)
    .overlay(alignment: .topTrailing) {
      BayaanLogo(size: 12).padding(8)
    }
  }
}

struct ActivityTitles: View {
  let state: NowPlayingActivityState

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(state.surahName)
        .font(.headline)
        .foregroundStyle(.white)
        .lineLimit(1)
      Text(state.reciterName)
        .font(.subheadline)
        .foregroundStyle(.white.opacity(0.75))
        .lineLimit(1)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct ActivityPlayButton: View {
  let state: NowPlayingActivityState

  var body: some View {
    RoundIntentButton(
      intent: SetPlaybackIntent(playing: !state.isPlaying),
      systemName: state.isPlaying ? "pause.fill" : "play.fill",
      label: state.isPlaying ? "Pause" : "Play")
  }
}

/// Linear bar plus remaining time. Timer views animate while playing with no
/// activity updates; paused shows a static bar and "Nm left".
struct ActivityProgress: View {
  let state: NowPlayingActivityState

  private var live: Bool { state.isPlaying && state.durationSec > 0 }

  var body: some View {
    HStack(spacing: 8) {
      Group {
        if live {
          ProgressView(timerInterval: state.wallStart...state.wallEnd, countsDown: false) {
            EmptyView()
          } currentValueLabel: {
            EmptyView()
          }
        } else {
          ProgressView(value: state.fraction)
        }
      }
      .progressViewStyle(.linear)
      .tint(.white)

      Group {
        if live {
          Text(timerInterval: state.wallStart...state.wallEnd, countsDown: true)
        } else {
          Text(WidgetLogic.minutesLeftLabel(state.remainingWallSec))
        }
      }
      .font(.caption2.monospacedDigit())
      .foregroundStyle(.white.opacity(0.6))
      .multilineTextAlignment(.trailing)
      .frame(width: 52, alignment: .trailing)
    }
  }
}

struct CompactProgress: View {
  let state: NowPlayingActivityState

  var body: some View {
    if state.isPlaying && state.durationSec > 0 {
      ProgressView(timerInterval: state.wallStart...state.wallEnd, countsDown: false) {
        EmptyView()
      } currentValueLabel: {
        EmptyView()
      }
      .progressViewStyle(.circular)
      .tint(.white)
      .frame(width: 20, height: 20)
    } else {
      Image(systemName: "pause.fill")
        .font(.system(size: 11, weight: .bold))
        .foregroundStyle(.white)
    }
  }
}

/// Current ayah in Digital Khatt (ayah mode only), right to left, centered.
struct AyahLine: View {
  let ayah: NowPlayingAyah
  let lines: Int

  var body: some View {
    VStack(spacing: 2) {
      Text(ayah.text)
        .font(WidgetFonts.quran(18))
        .foregroundStyle(.white)
        .lineLimit(lines)
        .multilineTextAlignment(.center)
        .environment(\.layoutDirection, .rightToLeft)
        .frame(maxWidth: .infinity)
      Text("Ayah \(ayah.number) of \(ayah.count)")
        .font(.caption2)
        .foregroundStyle(.white.opacity(0.6))
    }
  }
}

private extension NowPlayingActivityState {
  static var previewPlaying: NowPlayingActivityState {
    NowPlayingActivityState(
      surahId: 18, surahName: "Al-Kahf", reciterName: "Mishary Alafasy",
      artworkFile: "surah-18.jpg", isPlaying: true, positionSec: 120, durationSec: 1800,
      rate: 1, anchorAt: Date.now.timeIntervalSince1970 * 1000, ayah: nil)
  }

  static var previewPaused: NowPlayingActivityState {
    NowPlayingActivityState(
      surahId: 36, surahName: "Ya-Sin", reciterName: "Mishary Alafasy",
      artworkFile: nil, isPlaying: false, positionSec: 600, durationSec: 1500,
      rate: 1, anchorAt: Date.now.timeIntervalSince1970 * 1000, ayah: nil)
  }

  static var previewAyah: NowPlayingActivityState {
    NowPlayingActivityState(
      surahId: 18, surahName: "Al-Kahf", reciterName: "Mishary Alafasy",
      artworkFile: "surah-18.jpg", isPlaying: true, positionSec: 120, durationSec: 1800,
      rate: 1, anchorAt: Date.now.timeIntervalSince1970 * 1000,
      ayah: NowPlayingAyah(number: 10, count: 110, text: "إِذۡ أَوَى ٱلۡفِتۡيَةُ إِلَى ٱلۡكَهۡفِ"))
  }
}

#Preview("Lock Screen", as: .content, using: NowPlayingAttributes()) {
  NowPlayingLiveActivity()
} contentStates: {
  NowPlayingActivityState.previewPlaying
  NowPlayingActivityState.previewPaused
  NowPlayingActivityState.previewAyah
}

#Preview("Expanded", as: .dynamicIsland(.expanded), using: NowPlayingAttributes()) {
  NowPlayingLiveActivity()
} contentStates: {
  NowPlayingActivityState.previewPlaying
  NowPlayingActivityState.previewAyah
}

#Preview("Compact", as: .dynamicIsland(.compact), using: NowPlayingAttributes()) {
  NowPlayingLiveActivity()
} contentStates: {
  NowPlayingActivityState.previewPlaying
  NowPlayingActivityState.previewPaused
}

#Preview("Minimal", as: .dynamicIsland(.minimal), using: NowPlayingAttributes()) {
  NowPlayingLiveActivity()
} contentStates: {
  NowPlayingActivityState.previewPlaying
}
```

- [ ] **Step 4: Register the activity and the framework**

In `targets/widgets/WidgetsBundle.swift`, after `ListeningAccessoryWidget()` add:

```swift
    NowPlayingLiveActivity()
```

In `targets/widgets/expo-target.config.js`, replace the `frameworks` line with:

```js
  frameworks: ['SwiftUI', 'WidgetKit', 'AppIntents', 'ActivityKit'],
```

- [ ] **Step 5: Prebuild and build**

```bash
npm run prebuild
npm run test:widget-fixtures
xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20
```

Expected: the three OK lines, then `** BUILD SUCCEEDED **`. Open `NowPlayingLiveActivity.swift` previews in Xcode if available and check the four presentations against spec 5.4; otherwise this is covered on the simulator in Task 10.

- [ ] **Step 6: Format, commit**

```bash
npx prettier --write targets/widgets/expo-target.config.js
git add targets/widgets/LiveActivity/NowPlayingAttributes.swift targets/widgets/LiveActivity/NowPlayingLiveActivity.swift targets/widgets/WidgetsBundle.swift targets/widgets/expo-target.config.js scripts/check-widget-system-surfaces.sh
git status --short ios/   # add regenerated ios/ files only if prebuild changed them
git commit -m "feat(widgets): add the Now Playing Live Activity and Dynamic Island"
```

---

### Task 4: Live Activity policy (pure)

Snapshot to content state, what to ask ActivityKit for, and how each native result changes what JS remembers.

**Files:**
- Create: `services/widgets/live-activity/planActivity.ts`, `services/widgets/live-activity/__tests__/planActivity.test.ts`, `test-utils/widgetSnapshots.ts`

**Interfaces:**
- Consumes: `NowPlayingActivityState`, `NowPlayingAyah`, `ActivityStartResult`, `activityWallEnd`, `safeActivityRate`, `WidgetSnapshot`, `WidgetNowPlaying`, `WidgetTrack` (from `bayaan-widgets`).
- Produces: `SEEK_TOLERANCE_SEC = 2`, `END_TOLERANCE_SEC = 1`, `PAUSED_STALE_MS = 900000`, `ENDED_GRACE_MS = 60000`; `interface ActivityMemory {live: boolean; last: NowPlayingActivityState | null; suppressedTrack: string | null}`; `INITIAL_ACTIVITY_MEMORY`; `type ActivityPlan = {kind: 'start' | 'update'; state; staleAt} | {kind: 'end'} | {kind: 'none'}`; `activityStateFromSnapshot(snapshot: WidgetSnapshot, ayah: NowPlayingAyah | null): NowPlayingActivityState | null`; `activityTrackKey(s): string`; `activityNeedsUpdate(prev, next): boolean`; `staleAtFor(s, nowMs: number): number`; `planActivity(memory, next: NowPlayingActivityState | null, nowMs: number): ActivityPlan`; `afterStart(memory, state, result: ActivityStartResult): ActivityMemory`; `afterUpdate(memory, state, ok: boolean): ActivityMemory`; `afterEnd(): ActivityMemory`.
- Produces (test util): `KAHF_TRACK`, `YASIN_TRACK`, `MULK_TRACK: WidgetTrack`; `nowPlayingSnapshot(np: Partial<WidgetNowPlaying> | null, generatedAt?: number): WidgetSnapshot` (defaults: Al-Kahf playing at 100 of 1800 s, rate 1, generatedAt 1000000).

- [ ] **Step 1: Write the test util**

`test-utils/widgetSnapshots.ts`:

```ts
// test-utils/widgetSnapshots.ts
// Snapshot builders for Live Activity tests.
import type {
  WidgetNowPlaying,
  WidgetSnapshot,
  WidgetTrack,
} from 'bayaan-widgets';

export const KAHF_TRACK: WidgetTrack = {
  surahId: 18,
  surahName: 'Al-Kahf',
  reciterId: 'r1',
  reciterName: 'Mishary Alafasy',
  rewayatId: 'rw-1',
  artworkFile: 'surah-18.jpg',
  isUserUpload: false,
};

export const YASIN_TRACK: WidgetTrack = {
  ...KAHF_TRACK,
  surahId: 36,
  surahName: 'Ya-Sin',
  artworkFile: 'surah-36.jpg',
};

export const MULK_TRACK: WidgetTrack = {
  ...KAHF_TRACK,
  surahId: 67,
  surahName: 'Al-Mulk',
  artworkFile: 'surah-67.jpg',
};

/** Only nowPlaying is filled. Defaults: Al-Kahf playing at 100 of 1800 s, rate 1. */
export function nowPlayingSnapshot(
  np: Partial<WidgetNowPlaying> | null,
  generatedAt: number = 1_000_000,
): WidgetSnapshot {
  return {
    version: 1,
    generatedAt,
    theme: 'dark',
    nowPlaying:
      np === null
        ? null
        : {
            track: KAHF_TRACK,
            isPlaying: true,
            positionSec: 100,
            durationSec: 1800,
            rate: 1,
            ...np,
          },
    upNext: [],
    recent: [],
    defaultReciter: null,
    reciterRecents: {},
    lastRead: null,
    tasbeeh: {},
  };
}
```

- [ ] **Step 2: Write the failing tests**

`services/widgets/live-activity/__tests__/planActivity.test.ts`:

```ts
import type {NowPlayingActivityState, WidgetNowPlaying} from 'bayaan-widgets';
import {
  MULK_TRACK,
  YASIN_TRACK,
  nowPlayingSnapshot,
} from '@/test-utils/widgetSnapshots';
import {
  ENDED_GRACE_MS,
  INITIAL_ACTIVITY_MEMORY,
  PAUSED_STALE_MS,
  activityNeedsUpdate,
  activityStateFromSnapshot,
  activityTrackKey,
  afterEnd,
  afterStart,
  afterUpdate,
  planActivity,
  staleAtFor,
  type ActivityMemory,
} from '../planActivity';

function stateOf(
  np: Partial<WidgetNowPlaying>,
  generatedAt: number = 1_000_000,
): NowPlayingActivityState {
  const s = activityStateFromSnapshot(nowPlayingSnapshot(np, generatedAt), null);
  if (!s) throw new Error('expected a state');
  return s;
}

function liveWith(last: NowPlayingActivityState): ActivityMemory {
  return {live: true, last, suppressedTrack: null};
}

const AYAH = {number: 3, count: 110, text: 'x'};

describe('activityStateFromSnapshot', () => {
  it('maps the playing track and anchors at generatedAt', () => {
    expect(
      activityStateFromSnapshot(nowPlayingSnapshot({}, 1_000_000), AYAH),
    ).toEqual({
      surahId: 18,
      surahName: 'Al-Kahf',
      reciterName: 'Mishary Alafasy',
      artworkFile: 'surah-18.jpg',
      isPlaying: true,
      positionSec: 100,
      durationSec: 1800,
      rate: 1,
      anchorAt: 1_000_000,
      ayah: AYAH,
    });
  });

  it('is null with nothing loaded or a finished paused track', () => {
    expect(activityStateFromSnapshot(nowPlayingSnapshot(null), null)).toBe(
      null,
    );
    expect(
      activityStateFromSnapshot(
        nowPlayingSnapshot({isPlaying: false, positionSec: 1799.5}),
        null,
      ),
    ).toBe(null);
  });

  it('keeps a paused track that is not at the end', () => {
    expect(stateOf({isPlaying: false, positionSec: 1700}).isPlaying).toBe(
      false,
    );
  });
});

describe('activityNeedsUpdate', () => {
  const base = stateOf({});

  it('ignores normal progress ticks and small drift', () => {
    expect(activityNeedsUpdate(base, stateOf({positionSec: 110}, 1_010_000))).toBe(
      false,
    );
    expect(activityNeedsUpdate(base, stateOf({positionSec: 111}, 1_010_000))).toBe(
      false,
    );
  });

  it('updates on a seek, pause, track, artwork, rate or ayah change', () => {
    expect(activityNeedsUpdate(base, stateOf({positionSec: 200}, 1_010_000))).toBe(
      true,
    );
    expect(activityNeedsUpdate(base, stateOf({isPlaying: false}))).toBe(true);
    expect(activityNeedsUpdate(base, stateOf({track: YASIN_TRACK}))).toBe(true);
    expect(
      activityNeedsUpdate(base, {...base, artworkFile: 'reciter-r1.jpg'}),
    ).toBe(true);
    expect(activityNeedsUpdate(base, stateOf({rate: 1.5}))).toBe(true);
    expect(activityNeedsUpdate(base, {...base, ayah: AYAH})).toBe(true);
  });

  it('updates when the paused position moves', () => {
    const paused = stateOf({isPlaying: false, positionSec: 300});
    expect(
      activityNeedsUpdate(paused, stateOf({isPlaying: false, positionSec: 500})),
    ).toBe(true);
  });
});

describe('staleAtFor', () => {
  it('is the wall end plus grace while playing, at the playback rate', () => {
    const s = stateOf({positionSec: 900, rate: 1.5});
    expect(staleAtFor(s, 0)).toBe(1_000_000 + 600_000 + ENDED_GRACE_MS);
  });

  it('is now plus 15 minutes while paused', () => {
    expect(staleAtFor(stateOf({isPlaying: false}), 5_000)).toBe(
      5_000 + PAUSED_STALE_MS,
    );
  });
});

describe('planActivity', () => {
  it('starts only for a playing, unsuppressed track', () => {
    const playing = stateOf({});
    expect(planActivity(INITIAL_ACTIVITY_MEMORY, playing, 0)).toEqual({
      kind: 'start',
      state: playing,
      staleAt: staleAtFor(playing, 0),
    });
    expect(
      planActivity(INITIAL_ACTIVITY_MEMORY, stateOf({isPlaying: false}), 0)
        .kind,
    ).toBe('none');
    const suppressed: ActivityMemory = {
      ...INITIAL_ACTIVITY_MEMORY,
      suppressedTrack: activityTrackKey(playing),
    };
    expect(planActivity(suppressed, playing, 0).kind).toBe('none');
    expect(planActivity(suppressed, stateOf({track: MULK_TRACK}), 0).kind).toBe(
      'start',
    );
  });

  it('updates a live activity only when needed', () => {
    const base = stateOf({});
    expect(
      planActivity(liveWith(base), stateOf({positionSec: 110}, 1_010_000), 0)
        .kind,
    ).toBe('none');
    expect(planActivity(liveWith(base), stateOf({isPlaying: false}), 0).kind).toBe(
      'update',
    );
  });

  it('turns rapid track changes into updates of the one activity', () => {
    let memory = liveWith(stateOf({}));
    for (const track of [YASIN_TRACK, MULK_TRACK, YASIN_TRACK]) {
      const next = stateOf({track});
      const plan = planActivity(memory, next, 0);
      expect(plan.kind).toBe('update');
      memory = afterUpdate(memory, next, true);
    }
  });

  it('ends when nothing is loaded', () => {
    expect(planActivity(liveWith(stateOf({})), null, 0)).toEqual({kind: 'end'});
    expect(planActivity(INITIAL_ACTIVITY_MEMORY, null, 0)).toEqual({
      kind: 'none',
    });
  });
});

describe('memory transitions', () => {
  const s = stateOf({});

  it('goes live after started or updated', () => {
    for (const result of ['started', 'updated'] as const) {
      expect(afterStart(INITIAL_ACTIVITY_MEMORY, s, result)).toEqual({
        live: true,
        last: s,
        suppressedTrack: null,
      });
    }
  });

  it('retries a deferred start later without suppressing', () => {
    expect(afterStart(INITIAL_ACTIVITY_MEMORY, s, 'deferred')).toEqual(
      INITIAL_ACTIVITY_MEMORY,
    );
  });

  it('suppresses the track after a disabled or failed start', () => {
    for (const result of [
      'disabled',
      'error',
      'invalid',
      'unsupported',
      'unavailable',
    ] as const) {
      expect(afterStart(INITIAL_ACTIVITY_MEMORY, s, result)).toEqual({
        live: false,
        last: null,
        suppressedTrack: activityTrackKey(s),
      });
    }
  });

  it('suppresses the track when an update finds the activity gone', () => {
    expect(afterUpdate(liveWith(s), s, false)).toEqual({
      live: false,
      last: null,
      suppressedTrack: activityTrackKey(s),
    });
    const next = stateOf({isPlaying: false});
    expect(afterUpdate(liveWith(s), next, true)).toEqual(liveWith(next));
  });

  it('forgets everything after an end', () => {
    expect(afterEnd()).toEqual(INITIAL_ACTIVITY_MEMORY);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx jest services/widgets/live-activity/__tests__/planActivity.test.ts`
Expected: FAIL with "Cannot find module '../planActivity'".

- [ ] **Step 4: Implement the policy**

`services/widgets/live-activity/planActivity.ts`:

```ts
// services/widgets/live-activity/planActivity.ts
// Pure Live Activity policy: snapshot -> content state, what to ask ActivityKit
// for given what was last sent, and how each native result changes memory.
import {
  activityWallEnd,
  safeActivityRate,
  type ActivityStartResult,
  type NowPlayingActivityState,
  type NowPlayingAyah,
  type WidgetSnapshot,
} from 'bayaan-widgets';

// Same tolerance as changedWidgetKinds: seconds the playback anchor may drift
// before a playing activity is updated (a seek).
export const SEEK_TOLERANCE_SEC = 2;
// A paused track this close to its end has finished (last track ended).
export const END_TOLERANCE_SEC = 1;
export const PAUSED_STALE_MS = 15 * 60 * 1000;
export const ENDED_GRACE_MS = 60 * 1000;

export interface ActivityMemory {
  live: boolean;
  // Last state sent to ActivityKit; drift is measured against it.
  last: NowPlayingActivityState | null;
  // Track whose activity was dismissed or failed to start; not started again
  // until the track changes.
  suppressedTrack: string | null;
}

export const INITIAL_ACTIVITY_MEMORY: ActivityMemory = {
  live: false,
  last: null,
  suppressedTrack: null,
};

export type ActivityPlan =
  | {kind: 'start'; state: NowPlayingActivityState; staleAt: number}
  | {kind: 'update'; state: NowPlayingActivityState; staleAt: number}
  | {kind: 'end'}
  | {kind: 'none'};

export function activityStateFromSnapshot(
  snapshot: WidgetSnapshot,
  ayah: NowPlayingAyah | null,
): NowPlayingActivityState | null {
  const np = snapshot.nowPlaying;
  if (!np) return null;
  const finished =
    !np.isPlaying &&
    np.durationSec > 0 &&
    np.positionSec >= np.durationSec - END_TOLERANCE_SEC;
  if (finished) return null;
  return {
    surahId: np.track.surahId,
    surahName: np.track.surahName,
    reciterName: np.track.reciterName,
    artworkFile: np.track.artworkFile,
    isPlaying: np.isPlaying,
    positionSec: np.positionSec,
    durationSec: np.durationSec,
    rate: np.rate,
    anchorAt: snapshot.generatedAt,
    ayah,
  };
}

export function activityTrackKey(s: NowPlayingActivityState): string {
  return JSON.stringify([s.surahId, s.surahName, s.reciterName]);
}

// Wall-clock seconds at which the track would have been at 0. Constant during
// continuous playback; jumps on a seek.
function anchorSec(s: NowPlayingActivityState): number {
  return s.anchorAt / 1000 - s.positionSec / safeActivityRate(s.rate);
}

// Everything the activity renders except the playing position, which the
// timer views animate on their own.
function visibleKey(s: NowPlayingActivityState): string {
  return JSON.stringify([
    s.surahId,
    s.surahName,
    s.reciterName,
    s.artworkFile,
    s.isPlaying,
    Math.round(s.durationSec),
    safeActivityRate(s.rate),
    s.ayah ? s.ayah.number : null,
    s.ayah ? s.ayah.text : null,
    s.isPlaying ? null : Math.round(s.positionSec),
  ]);
}

export function activityNeedsUpdate(
  prev: NowPlayingActivityState,
  next: NowPlayingActivityState,
): boolean {
  if (visibleKey(prev) !== visibleKey(next)) return true;
  return (
    next.isPlaying && Math.abs(anchorSec(prev) - anchorSec(next)) > SEEK_TOLERANCE_SEC
  );
}

export function staleAtFor(s: NowPlayingActivityState, nowMs: number): number {
  return s.isPlaying ? activityWallEnd(s) + ENDED_GRACE_MS : nowMs + PAUSED_STALE_MS;
}

export function planActivity(
  memory: ActivityMemory,
  next: NowPlayingActivityState | null,
  nowMs: number,
): ActivityPlan {
  if (!next) return memory.live ? {kind: 'end'} : {kind: 'none'};
  if (!memory.live) {
    if (!next.isPlaying || activityTrackKey(next) === memory.suppressedTrack) {
      return {kind: 'none'};
    }
    return {kind: 'start', state: next, staleAt: staleAtFor(next, nowMs)};
  }
  if (memory.last && !activityNeedsUpdate(memory.last, next)) return {kind: 'none'};
  return {kind: 'update', state: next, staleAt: staleAtFor(next, nowMs)};
}

export function afterStart(
  memory: ActivityMemory,
  state: NowPlayingActivityState,
  result: ActivityStartResult,
): ActivityMemory {
  switch (result) {
    case 'started':
    case 'updated':
      return {live: true, last: state, suppressedTrack: null};
    case 'deferred':
      // The app was not active; syncLiveActivity retries on foreground.
      return {...memory, live: false, last: null};
    default:
      return {live: false, last: null, suppressedTrack: activityTrackKey(state)};
  }
}

export function afterUpdate(
  memory: ActivityMemory,
  state: NowPlayingActivityState,
  ok: boolean,
): ActivityMemory {
  if (ok) return {...memory, live: true, last: state};
  return {live: false, last: null, suppressedTrack: activityTrackKey(state)};
}

export function afterEnd(): ActivityMemory {
  return INITIAL_ACTIVITY_MEMORY;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest services/widgets/live-activity/__tests__/planActivity.test.ts`
Expected: PASS (17 tests).

- [ ] **Step 6: Typecheck, format, commit**

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
npx prettier --write services/widgets/live-activity/planActivity.ts services/widgets/live-activity/__tests__/planActivity.test.ts test-utils/widgetSnapshots.ts
git add services/widgets/live-activity/planActivity.ts services/widgets/live-activity/__tests__/planActivity.test.ts test-utils/widgetSnapshots.ts
git commit -m "feat(widgets): add the Live Activity update policy"
```

---

### Task 5: Live Activity sync

Wires the policy to the native bridge: every written widget snapshot reaches the activity, native calls are serialized, deferred starts retry on foreground, and orphans are ended at JS start.

**Files:**
- Create: `services/widgets/live-activity/config.ts`, `services/widgets/live-activity/syncLiveActivity.ts`, `services/widgets/live-activity/__tests__/syncLiveActivity.test.ts`
- Modify: `services/widgets/syncWidgets.ts`, `services/widgets/__tests__/syncWidgets.test.ts`, `app/_layout.tsx`

**Interfaces:**
- Consumes: Task 2 wrappers (`isLiveActivitySupported`, `startNowPlayingActivity`, `updateNowPlayingActivity`, `endNowPlayingActivities`); Task 4 (`activityStateFromSnapshot`, `planActivity`, `afterStart`, `afterUpdate`, `afterEnd`, `INITIAL_ACTIVITY_MEMORY`, `ActivityMemory`); `nowPlayingSnapshot`, `YASIN_TRACK`, `MULK_TRACK` (test util).
- Produces: `type LiveActivityMode = 'off' | 'surah' | 'ayah'`, `liveActivityMode(): LiveActivityMode`; `startLiveActivitySync(): () => void`; `noteSnapshotForLiveActivity(snapshot: WidgetSnapshot): void`; `setLiveActivityAyah(ayah: NowPlayingAyah | null): void`; `reconcileLiveActivity(): Promise<void>` (resolves after all queued native calls).

- [ ] **Step 1: Write the mode constant**

`services/widgets/live-activity/config.ts`:

```ts
// services/widgets/live-activity/config.ts
// 'surah' ships: surah card, names, play/pause and timer-driven progress, a
// few updates per track. 'ayah' adds the current ayah and updates on every
// ayah change; keep it off until the device prototype in
// docs/superpowers/plans/2026-10-11-widgets-phase-2-device-checklist.md passes
// (background updates may stop after about 30 s). 'off' disables the activity.
export type LiveActivityMode = 'off' | 'surah' | 'ayah';

export function liveActivityMode(): LiveActivityMode {
  return 'surah';
}
```

- [ ] **Step 2: Write the failing sync tests**

`services/widgets/live-activity/__tests__/syncLiveActivity.test.ts`:

```ts
import type {
  ActivityStartResult,
  NowPlayingActivityState,
} from 'bayaan-widgets';
import {
  MULK_TRACK,
  YASIN_TRACK,
  nowPlayingSnapshot,
} from '@/test-utils/widgetSnapshots';

const mockLog: string[] = [];
const mockStart = jest.fn<
  Promise<ActivityStartResult>,
  [NowPlayingActivityState, number]
>();
const mockUpdate = jest.fn<Promise<boolean>, [NowPlayingActivityState, number]>();
const mockEnd = jest.fn<Promise<void>, []>();
let mockSupported = true;
let mockPlatformOS = 'ios';
let mockMode: 'off' | 'surah' | 'ayah' = 'surah';
let mockAppStateListener: ((state: string) => void) | null = null;

function mockDescribe(s: NowPlayingActivityState): string {
  return `${s.surahName}:${s.isPlaying ? 'playing' : 'paused'}:${s.ayah ? s.ayah.number : '-'}`;
}

jest.mock('bayaan-widgets', () => ({
  ...jest.requireActual('bayaan-widgets'),
  isLiveActivitySupported: () => mockSupported,
  startNowPlayingActivity: (s: NowPlayingActivityState, at: number) => {
    mockLog.push(`start:${mockDescribe(s)}`);
    return mockStart(s, at);
  },
  updateNowPlayingActivity: (s: NowPlayingActivityState, at: number) => {
    mockLog.push(`update:${mockDescribe(s)}`);
    return mockUpdate(s, at);
  },
  endNowPlayingActivities: () => {
    mockLog.push('end');
    return mockEnd();
  },
}));
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const appState = {
    addEventListener: (_event: string, cb: (state: string) => void) => {
      mockAppStateListener = cb;
      return {remove: jest.fn()};
    },
  };
  const platform = {
    get OS(): string {
      return mockPlatformOS;
    },
  };
  return new Proxy(actual, {
    get: (target, prop) => {
      if (prop === 'AppState') return appState;
      if (prop === 'Platform') return platform;
      return target[prop];
    },
  });
});
jest.mock('../config', () => ({liveActivityMode: () => mockMode}));

type SyncModule = typeof import('../syncLiveActivity');

function loadModule(): SyncModule {
  let mod: SyncModule | null = null;
  jest.isolateModules(() => {
    mod = require('../syncLiveActivity');
  });
  if (!mod) throw new Error('module failed to load');
  return mod;
}

describe('syncLiveActivity', () => {
  beforeEach(() => {
    mockLog.length = 0;
    mockStart.mockReset().mockResolvedValue('started');
    mockUpdate.mockReset().mockResolvedValue(true);
    mockEnd.mockReset().mockResolvedValue(undefined);
    mockSupported = true;
    mockPlatformOS = 'ios';
    mockMode = 'surah';
    mockAppStateListener = null;
  });

  it('does nothing off iOS, when unsupported, or when the mode is off', async () => {
    for (const setup of [
      () => (mockPlatformOS = 'android'),
      () => (mockSupported = false),
      () => (mockMode = 'off'),
    ]) {
      setup();
      const sync = loadModule();
      sync.startLiveActivitySync();
      sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
      await sync.reconcileLiveActivity();
      mockPlatformOS = 'ios';
      mockSupported = true;
      mockMode = 'surah';
    }
    expect(mockLog).toEqual([]);
  });

  it('ends orphans before the first start', async () => {
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    expect(mockLog).toEqual(['end', 'start:Al-Kahf:playing:-']);
  });

  it('does not start for a paused session', async () => {
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({isPlaying: false}));
    await sync.reconcileLiveActivity();
    expect(mockLog).toEqual(['end']);
  });

  it('updates on pause and ends when the queue clears', async () => {
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({isPlaying: false}));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot(null));
    await sync.reconcileLiveActivity();
    expect(mockLog).toEqual([
      'end',
      'start:Al-Kahf:playing:-',
      'update:Al-Kahf:paused:-',
      'end',
    ]);
  });

  it('collapses rapid track changes into one start', async () => {
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({track: YASIN_TRACK}));
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({track: MULK_TRACK}));
    await sync.reconcileLiveActivity();
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockLog).toEqual(['end', 'start:Al-Mulk:playing:-']);
  });

  it('retries a deferred start on foreground', async () => {
    mockStart.mockResolvedValueOnce('deferred');
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    mockAppStateListener?.('active');
    await sync.reconcileLiveActivity();
    expect(mockStart).toHaveBeenCalledTimes(2);
  });

  it('does not restart a dismissed activity for the same track', async () => {
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    mockUpdate.mockResolvedValueOnce(false);
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({isPlaying: false}));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}, 2_000_000));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({track: YASIN_TRACK}));
    await sync.reconcileLiveActivity();
    expect(mockLog).toEqual([
      'end',
      'start:Al-Kahf:playing:-',
      'update:Al-Kahf:paused:-',
      'start:Ya-Sin:playing:-',
    ]);
  });

  it('does not retry a disabled start for the same track', async () => {
    mockStart.mockResolvedValue('disabled');
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({isPlaying: false}));
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}, 2_000_000));
    await sync.reconcileLiveActivity();
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('stops reacting after cleanup', async () => {
    const sync = loadModule();
    const stop = sync.startLiveActivitySync();
    stop();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    expect(mockStart).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx jest services/widgets/live-activity/__tests__/syncLiveActivity.test.ts`
Expected: FAIL with "Cannot find module '../syncLiveActivity'".

- [ ] **Step 4: Implement the sync**

`services/widgets/live-activity/syncLiveActivity.ts`:

```ts
// services/widgets/live-activity/syncLiveActivity.ts
// Drives the Now Playing Live Activity from the widget snapshot pipeline:
// syncWidgets hands over each written snapshot; native calls are serialized.
import {AppState, Platform} from 'react-native';
import {
  endNowPlayingActivities,
  isLiveActivitySupported,
  startNowPlayingActivity,
  updateNowPlayingActivity,
  type NowPlayingAyah,
  type WidgetSnapshot,
} from 'bayaan-widgets';
import {liveActivityMode} from './config';
import {
  INITIAL_ACTIVITY_MEMORY,
  activityStateFromSnapshot,
  afterEnd,
  afterStart,
  afterUpdate,
  planActivity,
  type ActivityMemory,
} from './planActivity';

let enabled = false;
let memory: ActivityMemory = INITIAL_ACTIVITY_MEMORY;
let snapshot: WidgetSnapshot | null = null;
let ayah: NowPlayingAyah | null = null;
// One chain for every native call, so a start cannot race an update or end.
let chain: Promise<void> = Promise.resolve();

function logError(error: unknown): void {
  console.error('[LiveActivity] Failed to sync:', error);
}

// Reads the latest snapshot when it runs, so queued calls collapse.
async function reconcileOnce(): Promise<void> {
  if (!enabled || !snapshot) return;
  const plan = planActivity(
    memory,
    activityStateFromSnapshot(snapshot, ayah),
    Date.now(),
  );
  switch (plan.kind) {
    case 'start':
      memory = afterStart(
        memory,
        plan.state,
        await startNowPlayingActivity(plan.state, plan.staleAt),
      );
      return;
    case 'update':
      memory = afterUpdate(
        memory,
        plan.state,
        await updateNowPlayingActivity(plan.state, plan.staleAt),
      );
      return;
    case 'end':
      await endNowPlayingActivities();
      memory = afterEnd();
      return;
    case 'none':
      return;
  }
}

export function reconcileLiveActivity(): Promise<void> {
  chain = chain.then(reconcileOnce).catch(logError);
  return chain;
}

/** Called by syncWidgets after each snapshot write. */
export function noteSnapshotForLiveActivity(next: WidgetSnapshot): void {
  if (!enabled) return;
  snapshot = next;
  void reconcileLiveActivity();
}

/** Set by the per-ayah layer (ayah mode); null hides the ayah line. */
export function setLiveActivityAyah(next: NowPlayingAyah | null): void {
  if (!enabled) return;
  ayah = next;
  void reconcileLiveActivity();
}

// The root layout starts this after init, before startWidgetSync.
export function startLiveActivitySync(): () => void {
  if (
    Platform.OS !== 'ios' ||
    liveActivityMode() === 'off' ||
    !isLiveActivitySupported()
  ) {
    return () => undefined;
  }
  enabled = true;
  memory = INITIAL_ACTIVITY_MEMORY;
  snapshot = null;
  ayah = null;
  // An activity left by a previous process has no owner; start clean.
  chain = chain.then(() => endNowPlayingActivities()).catch(logError);
  const appState = AppState.addEventListener('change', state => {
    if (state === 'active') void reconcileLiveActivity();
  });
  return () => {
    enabled = false;
    snapshot = null;
    ayah = null;
    appState.remove();
  };
}
```

- [ ] **Step 5: Run the sync tests to verify they pass**

Run: `npx jest services/widgets/live-activity/__tests__/syncLiveActivity.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Hand snapshots over from syncWidgets (test first)**

In `services/widgets/__tests__/syncWidgets.test.ts`, after the `jest.mock('../handleWidgetCommand', ...)` block add:

```ts
const mockNoteSnapshot = jest.fn();
jest.mock('../live-activity/syncLiveActivity', () => ({
  noteSnapshotForLiveActivity: (s: unknown) => mockNoteSnapshot(s),
}));
```

and inside `describe('drainWidgetCommands', ...)`, after the test `'forces a Continue Listening write after handling a command'`, add:

```ts
  it('hands each written snapshot to the Live Activity', async () => {
    const sync = loadModule();
    sync.markSessionRestoredForWidgets();
    sync.markPlayerReadyForWidgets();
    await flush();
    mockWriteSnapshot.mockClear();
    mockNoteSnapshot.mockClear();
    mockTakeQueuedCommands.mockReturnValueOnce([queued(toggle)]);
    mockTakeQueuedCommands.mockReturnValue([]);
    await sync.drainWidgetCommands();
    expect(mockNoteSnapshot).toHaveBeenCalledTimes(1);
    expect(mockNoteSnapshot).toHaveBeenCalledWith(
      mockWriteSnapshot.mock.calls[0][0],
    );
  });
```

Run: `npx jest services/widgets/__tests__/syncWidgets.test.ts`
Expected: FAIL in the new test (`mockNoteSnapshot` called 0 times).

In `services/widgets/syncWidgets.ts`, add to the imports:

```ts
import {noteSnapshotForLiveActivity} from './live-activity/syncLiveActivity';
```

and in `flushWidgetSnapshot`, replace

```ts
    writeSnapshot(next);
    reloadWidgets(kinds);
    lastSnapshot = next;
```

with

```ts
    writeSnapshot(next);
    reloadWidgets(kinds);
    lastSnapshot = next;
    noteSnapshotForLiveActivity(next);
```

Run: `npx jest services/widgets/__tests__/syncWidgets.test.ts`
Expected: PASS (all tests, including the new one).

- [ ] **Step 7: Start the sync in the root layout**

In `app/_layout.tsx`, after `import {startConfiguredWidgetSync} from '@/services/widgets/syncConfiguredWidgets';` add:

```ts
import {startLiveActivitySync} from '@/services/widgets/live-activity/syncLiveActivity';
```

and replace

```ts
    const stopSnapshot = startWidgetSync();
    const stopConfigured = startConfiguredWidgetSync();
    return () => {
      stopSnapshot();
      stopConfigured();
    };
```

with

```ts
    const stopLiveActivity = startLiveActivitySync();
    const stopSnapshot = startWidgetSync();
    const stopConfigured = startConfiguredWidgetSync();
    return () => {
      stopSnapshot();
      stopConfigured();
      stopLiveActivity();
    };
```

- [ ] **Step 8: Run the widget suites, typecheck, format, commit**

```bash
npx jest services/widgets modules/bayaan-widgets
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
npx prettier --write services/widgets/live-activity/config.ts services/widgets/live-activity/syncLiveActivity.ts services/widgets/live-activity/__tests__/syncLiveActivity.test.ts services/widgets/syncWidgets.ts services/widgets/__tests__/syncWidgets.test.ts app/_layout.tsx
git add services/widgets/live-activity/config.ts services/widgets/live-activity/syncLiveActivity.ts services/widgets/live-activity/__tests__/syncLiveActivity.test.ts services/widgets/syncWidgets.ts services/widgets/__tests__/syncWidgets.test.ts app/_layout.tsx
git commit -m "feat(widgets): drive the Live Activity from widget snapshots"
```

Expected: all suites PASS before the commit.

---

### Task 6: Per-ayah layer (built, ships off)

The ayah math and a timer-driven publisher that only runs in `ayah` mode. The default stays `surah` (P2-R1).

**Files:**
- Create: `services/widgets/live-activity/ayahLayer.ts`, `services/widgets/live-activity/ayahTicker.ts`, `services/widgets/live-activity/__tests__/ayahLayer.test.ts`, `services/widgets/live-activity/__tests__/ayahTicker.test.ts`
- Modify: `services/widgets/live-activity/syncLiveActivity.ts`, `services/widgets/live-activity/__tests__/syncLiveActivity.test.ts`

**Interfaces:**
- Consumes: `AyahTimestamp` (`@/types/timestamps`), `binarySearchAyah` (`@/utils/timestampUtils`), `timestampService.getTimestampsForSurah(rewayatId: string, surahNumber: number): Promise<AyahTimestamp[] | null>` (`@/services/timestamps/TimestampService`), `digitalKhattDataService.initialized` and `.getVerseText(verseKey: string): string` (`@/services/mushaf/DigitalKhattDataService`); Task 5 `setLiveActivityAyah`, `noteSnapshotForLiveActivity`, `startLiveActivitySync`.
- Produces: `MAX_AYAH_TEXT_BYTES = 600`, `BOUNDARY_SLACK_MS = 50`, `utf8Length(text: string): number`, `truncateUtf8Words(text: string, maxBytes: number): string`, `positionAt(np: WidgetNowPlaying, generatedAt: number, nowMs: number): number`, `currentAyahTimestamp(timestamps: AyahTimestamp[], positionSec: number): AyahTimestamp | null`, `msUntilNextAyah(timestamps: AyahTimestamp[], positionSec: number, rate: number): number | null`, `ayahCount(timestamps: AyahTimestamp[]): number`, `buildActivityAyah(t: AyahTimestamp, count: number, verseText: string): NowPlayingAyah`; `interface AyahTickerDeps {loadTimestamps; verseText; setAyah; now}`, `createAyahTicker(deps: AyahTickerDeps): {onSnapshot(s: WidgetSnapshot): void; stop(): void}`.

- [ ] **Step 1: Write the failing ayah math tests**

`services/widgets/live-activity/__tests__/ayahLayer.test.ts`:

```ts
import type {AyahTimestamp} from '@/types/timestamps';
import type {WidgetNowPlaying} from 'bayaan-widgets';
import {KAHF_TRACK} from '@/test-utils/widgetSnapshots';
import {
  ayahCount,
  buildActivityAyah,
  currentAyahTimestamp,
  msUntilNextAyah,
  positionAt,
  truncateUtf8Words,
  utf8Length,
} from '../ayahLayer';

const TS: AyahTimestamp[] = [
  {surahNumber: 18, ayahNumber: 1, timestampFrom: 5000, timestampTo: 12000, durationMs: 7000},
  {surahNumber: 18, ayahNumber: 2, timestampFrom: 12000, timestampTo: 20000, durationMs: 8000},
  {surahNumber: 18, ayahNumber: 3, timestampFrom: 20000, timestampTo: 26000, durationMs: 6000},
];

const NP: WidgetNowPlaying = {
  track: KAHF_TRACK,
  isPlaying: true,
  positionSec: 100,
  durationSec: 1800,
  rate: 1.5,
};

describe('current and next ayah', () => {
  it('finds the ayah at a position, null before the first', () => {
    expect(currentAyahTimestamp(TS, 4)).toBe(null);
    expect(currentAyahTimestamp(TS, 12)?.ayahNumber).toBe(2);
    expect(currentAyahTimestamp(TS, 30)?.ayahNumber).toBe(3);
  });

  it('measures wall time to the next boundary at the playback rate', () => {
    expect(msUntilNextAyah(TS, 0, 1)).toBe(5000);
    expect(msUntilNextAyah(TS, 10, 1)).toBe(2000);
    expect(msUntilNextAyah(TS, 10, 2)).toBe(1000);
    expect(msUntilNextAyah(TS, 10, 0)).toBe(2000);
    expect(msUntilNextAyah(TS, 21, 1)).toBe(null);
  });

  it('counts ayat by the last ayah number', () => {
    expect(ayahCount(TS)).toBe(3);
    expect(ayahCount([])).toBe(0);
  });
});

describe('positionAt', () => {
  it('extrapolates while playing, at the rate, clamped', () => {
    expect(positionAt(NP, 1_000_000, 1_010_000)).toBe(115);
    expect(positionAt({...NP, isPlaying: false}, 1_000_000, 1_010_000)).toBe(100);
    expect(positionAt(NP, 1_000_000, 9_000_000)).toBe(1800);
  });
});

describe('UTF-8 truncation', () => {
  it('counts bytes per code point', () => {
    expect(utf8Length('abc')).toBe(3);
    expect(utf8Length('ب')).toBe(2);
    expect(utf8Length('ﷺ')).toBe(3);
    expect(utf8Length('😀')).toBe(4);
  });

  it('keeps short text and cuts long text at a word with an ellipsis', () => {
    expect(truncateUtf8Words('aaaa bbbb', 20)).toBe('aaaa bbbb');
    expect(truncateUtf8Words('aaaa bbbb cccc', 12)).toBe('aaaa …');
    expect(utf8Length(truncateUtf8Words('بببب '.repeat(200), 600))).toBeLessThanOrEqual(600);
  });

  it('builds the activity ayah', () => {
    expect(buildActivityAyah(TS[1], 3, 'text')).toEqual({number: 2, count: 3, text: 'text'});
  });
});
```

Run: `npx jest services/widgets/live-activity/__tests__/ayahLayer.test.ts`
Expected: FAIL with "Cannot find module '../ayahLayer'".

- [ ] **Step 2: Implement the ayah math**

`services/widgets/live-activity/ayahLayer.ts`:

```ts
// services/widgets/live-activity/ayahLayer.ts
// Pure math for the per-ayah Live Activity layer.
import type {AyahTimestamp} from '@/types/timestamps';
import type {NowPlayingAyah, WidgetNowPlaying} from 'bayaan-widgets';
import {binarySearchAyah} from '@/utils/timestampUtils';

// ActivityKit caps the whole content state at 4 KB; leave room for the rest.
export const MAX_AYAH_TEXT_BYTES = 600;
// Fire just after a boundary so the position lands inside the next ayah.
export const BOUNDARY_SLACK_MS = 50;

const ELLIPSIS = ' …';

function safeRate(rate: number): number {
  return rate > 0 && Number.isFinite(rate) ? rate : 1;
}

export function utf8Length(text: string): number {
  let bytes = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** Whole words that fit in maxBytes, followed by an ellipsis when cut. */
export function truncateUtf8Words(text: string, maxBytes: number): string {
  if (utf8Length(text) <= maxBytes) return text;
  const budget = maxBytes - utf8Length(ELLIPSIS);
  let out = '';
  for (const word of text.split(' ')) {
    const candidate = out ? `${out} ${word}` : word;
    if (utf8Length(candidate) > budget) break;
    out = candidate;
  }
  return `${out}${ELLIPSIS}`;
}

/** Track position in seconds at nowMs, extrapolated from the snapshot. */
export function positionAt(
  np: WidgetNowPlaying,
  generatedAt: number,
  nowMs: number,
): number {
  const raw = np.isPlaying
    ? np.positionSec + ((nowMs - generatedAt) / 1000) * safeRate(np.rate)
    : np.positionSec;
  return Math.min(Math.max(raw, 0), Math.max(np.durationSec, 0));
}

export function currentAyahTimestamp(
  timestamps: AyahTimestamp[],
  positionSec: number,
): AyahTimestamp | null {
  return binarySearchAyah(timestamps, positionSec * 1000);
}

/** Wall ms until the next ayah starts, or null after the last one starts. */
export function msUntilNextAyah(
  timestamps: AyahTimestamp[],
  positionSec: number,
  rate: number,
): number | null {
  const positionMs = positionSec * 1000;
  const next = timestamps.find(t => t.timestampFrom > positionMs);
  if (!next) return null;
  return (next.timestampFrom - positionMs) / safeRate(rate);
}

export function ayahCount(timestamps: AyahTimestamp[]): number {
  return timestamps.reduce((max, t) => Math.max(max, t.ayahNumber), 0);
}

export function buildActivityAyah(
  t: AyahTimestamp,
  count: number,
  verseText: string,
): NowPlayingAyah {
  return {
    number: t.ayahNumber,
    count,
    text: truncateUtf8Words(verseText, MAX_AYAH_TEXT_BYTES),
  };
}
```

Run: `npx jest services/widgets/live-activity/__tests__/ayahLayer.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 3: Write the failing ticker tests**

`services/widgets/live-activity/__tests__/ayahTicker.test.ts`:

```ts
import type {AyahTimestamp} from '@/types/timestamps';
import type {NowPlayingAyah} from 'bayaan-widgets';
import {
  KAHF_TRACK,
  YASIN_TRACK,
  nowPlayingSnapshot,
} from '@/test-utils/widgetSnapshots';
import {createAyahTicker} from '../ayahTicker';

const TS: AyahTimestamp[] = [
  {surahNumber: 18, ayahNumber: 1, timestampFrom: 5000, timestampTo: 12000, durationMs: 7000},
  {surahNumber: 18, ayahNumber: 2, timestampFrom: 12000, timestampTo: 20000, durationMs: 8000},
  {surahNumber: 18, ayahNumber: 3, timestampFrom: 20000, timestampTo: 26000, durationMs: 6000},
];
const START = 1_000_000;

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

function setup(load: jest.Mock = jest.fn(async () => TS)) {
  const published: Array<NowPlayingAyah | null> = [];
  const ticker = createAyahTicker({
    loadTimestamps: load,
    verseText: key => `v${key}`,
    setAyah: a => published.push(a),
    now: () => Date.now(),
  });
  return {ticker, published, load};
}

describe('createAyahTicker', () => {
  beforeEach(() => {
    jest.useFakeTimers({now: START});
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('publishes the current ayah and advances at each boundary', async () => {
    const {ticker, published, load} = setup();
    ticker.onSnapshot(nowPlayingSnapshot({positionSec: 10}, START));
    await settle();
    expect(load).toHaveBeenCalledWith('rw-1', 18);
    expect(published).toEqual([{number: 1, count: 3, text: 'v18:1'}]);
    jest.advanceTimersByTime(2050);
    expect(published[1]).toEqual({number: 2, count: 3, text: 'v18:2'});
    jest.advanceTimersByTime(8000);
    expect(published[2]?.number).toBe(3);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('schedules nothing while paused', async () => {
    const {ticker, published} = setup();
    ticker.onSnapshot(nowPlayingSnapshot({positionSec: 13, isPlaying: false}, START));
    await settle();
    expect(published).toEqual([{number: 2, count: 3, text: 'v18:2'}]);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('skips uploads and tracks without a rewayah', async () => {
    const {ticker, published, load} = setup();
    ticker.onSnapshot(
      nowPlayingSnapshot({track: {...KAHF_TRACK, isUserUpload: true}}, START),
    );
    ticker.onSnapshot(
      nowPlayingSnapshot({track: {...YASIN_TRACK, rewayatId: null}}, START),
    );
    await settle();
    expect(load).not.toHaveBeenCalled();
    expect(published).toEqual([]);
  });

  it('clears the ayah on a track change and ignores a stale load', async () => {
    let resolveFirst: (v: AyahTimestamp[]) => void = () => undefined;
    const load = jest
      .fn()
      .mockImplementationOnce(
        () => new Promise<AyahTimestamp[]>(r => (resolveFirst = r)),
      )
      .mockImplementation(async () => [{...TS[0], surahNumber: 36}]);
    const {ticker, published} = setup(load);
    ticker.onSnapshot(nowPlayingSnapshot({positionSec: 10}, START));
    ticker.onSnapshot(nowPlayingSnapshot({track: YASIN_TRACK, positionSec: 10}, START));
    resolveFirst(TS);
    await settle();
    expect(published).toEqual([{number: 1, count: 1, text: 'v36:1'}]);
  });

  it('stops scheduling after stop', async () => {
    const {ticker} = setup();
    ticker.onSnapshot(nowPlayingSnapshot({positionSec: 10}, START));
    await settle();
    ticker.stop();
    expect(jest.getTimerCount()).toBe(0);
  });
});
```

Run: `npx jest services/widgets/live-activity/__tests__/ayahTicker.test.ts`
Expected: FAIL with "Cannot find module '../ayahTicker'".

- [ ] **Step 4: Implement the ticker**

`services/widgets/live-activity/ayahTicker.ts`:

```ts
// services/widgets/live-activity/ayahTicker.ts
// Publishes the current ayah of the playing track (ayah mode only). Sleeps
// until the next ayah boundary instead of polling; restarts on every snapshot.
import type {AyahTimestamp} from '@/types/timestamps';
import type {NowPlayingAyah, WidgetSnapshot} from 'bayaan-widgets';
import {
  BOUNDARY_SLACK_MS,
  ayahCount,
  buildActivityAyah,
  currentAyahTimestamp,
  msUntilNextAyah,
  positionAt,
} from './ayahLayer';

export interface AyahTickerDeps {
  loadTimestamps: (
    rewayatId: string,
    surahId: number,
  ) => Promise<AyahTimestamp[] | null>;
  verseText: (verseKey: string) => string;
  setAyah: (ayah: NowPlayingAyah | null) => void;
  now: () => number;
}

export interface AyahTicker {
  onSnapshot: (snapshot: WidgetSnapshot) => void;
  stop: () => void;
}

export function createAyahTicker(deps: AyahTickerDeps): AyahTicker {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let snapshot: WidgetSnapshot | null = null;
  let trackKey: string | null = null;
  let timestamps: AyahTimestamp[] | null = null;
  let lastNumber: number | null = null;
  let stopped = false;

  function clear(): void {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function publish(next: NowPlayingAyah | null): void {
    const number = next ? next.number : null;
    if (number === lastNumber) return;
    lastNumber = number;
    deps.setAyah(next);
  }

  function tick(): void {
    clear();
    const np = snapshot?.nowPlaying;
    if (stopped || !snapshot || !np || !timestamps || timestamps.length === 0) {
      return;
    }
    const position = positionAt(np, snapshot.generatedAt, deps.now());
    const current = currentAyahTimestamp(timestamps, position);
    publish(
      current
        ? buildActivityAyah(
            current,
            ayahCount(timestamps),
            deps.verseText(`${current.surahNumber}:${current.ayahNumber}`),
          )
        : null,
    );
    if (!np.isPlaying) return;
    const wait = msUntilNextAyah(timestamps, position, np.rate);
    if (wait === null) return;
    timer = setTimeout(tick, wait + BOUNDARY_SLACK_MS);
  }

  function onSnapshot(next: WidgetSnapshot): void {
    if (stopped) return;
    snapshot = next;
    const track = next.nowPlaying?.track;
    const rewayatId =
      track && !track.isUserUpload && track.surahId > 0 ? track.rewayatId : null;
    const key = track && rewayatId ? `${rewayatId}-${track.surahId}` : null;
    if (key === trackKey) {
      tick();
      return;
    }
    trackKey = key;
    timestamps = null;
    clear();
    publish(null);
    if (!key || !track || !rewayatId) return;
    deps
      .loadTimestamps(rewayatId, track.surahId)
      .then(list => {
        if (stopped || trackKey !== key) return;
        timestamps = list;
        tick();
      })
      .catch(() => undefined);
  }

  return {
    onSnapshot,
    stop: () => {
      stopped = true;
      clear();
    },
  };
}
```

Run: `npx jest services/widgets/live-activity/__tests__/ayahTicker.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Wire the ticker into the sync (test first)**

In `services/widgets/live-activity/__tests__/syncLiveActivity.test.ts`, after the `jest.mock('../config', ...)` line add:

```ts
jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {
    getTimestampsForSurah: jest.fn(async () => [
      {surahNumber: 18, ayahNumber: 1, timestampFrom: 0, timestampTo: 600000, durationMs: 600000},
    ]),
  },
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {initialized: true, getVerseText: () => 'ayah text'},
}));
```

and add this test at the end of the `describe`:

```ts
  it('adds the current ayah in ayah mode', async () => {
    mockMode = 'ayah';
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({positionSec: 10}, Date.now()));
    for (let i = 0; i < 10; i += 1) await sync.reconcileLiveActivity();
    // The ayah may arrive before or after the start runs; either way there is
    // one activity and the last state sent carries ayah 1.
    expect(mockLog[0]).toBe('end');
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockLog[mockLog.length - 1]).toMatch(
      /^(start|update):Al-Kahf:playing:1$/,
    );
  });
```

Run: `npx jest services/widgets/live-activity/__tests__/syncLiveActivity.test.ts`
Expected: FAIL in the new test (the last entry ends in `:-`, no ayah).

In `services/widgets/live-activity/syncLiveActivity.ts`, add to the imports:

```ts
import {timestampService} from '@/services/timestamps/TimestampService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {createAyahTicker, type AyahTicker} from './ayahTicker';
```

after `let chain: Promise<void> = Promise.resolve();` add:

```ts
let ticker: AyahTicker | null = null;
```

in `noteSnapshotForLiveActivity`, replace

```ts
  snapshot = next;
  void reconcileLiveActivity();
```

with

```ts
  snapshot = next;
  ticker?.onSnapshot(next);
  void reconcileLiveActivity();
```

in `startLiveActivitySync`, after `chain = chain.then(() => endNowPlayingActivities()).catch(logError);` add:

```ts
  ticker =
    liveActivityMode() === 'ayah'
      ? createAyahTicker({
          loadTimestamps: (rewayatId, surahId) =>
            timestampService.getTimestampsForSurah(rewayatId, surahId),
          verseText: key =>
            digitalKhattDataService.initialized
              ? digitalKhattDataService.getVerseText(key)
              : '',
          setAyah: setLiveActivityAyah,
          now: () => Date.now(),
        })
      : null;
```

and in the returned cleanup, before `appState.remove();` add:

```ts
    ticker?.stop();
    ticker = null;
```

Run: `npx jest services/widgets/live-activity`
Expected: PASS (all four suites).

- [ ] **Step 6: Typecheck, format, commit**

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
npx prettier --write services/widgets/live-activity/ayahLayer.ts services/widgets/live-activity/ayahTicker.ts services/widgets/live-activity/syncLiveActivity.ts services/widgets/live-activity/__tests__/ayahLayer.test.ts services/widgets/live-activity/__tests__/ayahTicker.test.ts services/widgets/live-activity/__tests__/syncLiveActivity.test.ts
grep -n "return 'surah'" services/widgets/live-activity/config.ts
git add services/widgets/live-activity/ayahLayer.ts services/widgets/live-activity/ayahTicker.ts services/widgets/live-activity/syncLiveActivity.ts services/widgets/live-activity/__tests__/ayahLayer.test.ts services/widgets/live-activity/__tests__/ayahTicker.test.ts services/widgets/live-activity/__tests__/syncLiveActivity.test.ts
git commit -m "feat(widgets): add the per-ayah Live Activity layer behind a mode flag"
```

Expected: the `grep` prints the `return 'surah';` line (the shipping default is unchanged).

---

### Task 7: Shared intents and the surah entity for Siri and controls

`SurahEntity` moves to `_shared` backed by a generated catalog, play/pause gets one shared code path, and three Siri-facing intents are added.

**Files:**
- Modify: `services/widgets/widgetStaticData.ts`, `services/widgets/__tests__/widgetStaticData.test.ts`, `scripts/generate-widget-data.ts`, `targets/widgets/_shared/PlaybackIntents.swift`, `targets/widgets/Support/Entities.swift`, `scripts/check-widget-system-surfaces.sh`
- Create: `targets/widgets/_shared/SurahCatalog.swift` (generated), `targets/widgets/_shared/SurahEntity.swift`, `targets/widgets/_shared/SurahSynonyms.swift`, `targets/widgets/_shared/PlaybackResume.swift`

**Interfaces:**
- Consumes: `StaticSurah`, `buildStaticSurahs` (`widgetStaticData.ts`); `WidgetSnapshot`, `WidgetTrack` (`_shared/WidgetSnapshot.swift`); `WidgetCommandQueue`, `PlaybackOverrideStore`, `BayaanAppGroup` (`_shared/WidgetCommandQueue.swift`).
- Produces (TS): `buildSurahCatalogSwift(surahs: StaticSurah[]): string`.
- Produces (Swift, `_shared`, compiled into app and extension): `struct SurahName {id; name; translatedName}`, `enum SurahCatalog {static let all: [SurahName]; static func surah(_ id: Int) -> SurahName?}`; `enum SurahSynonyms {static func of(name: String, translatedName: String) -> [String]}`; `@available(iOS 17.0, *) struct SurahEntity: AppEntity` (`id: Int`, `name`, `translatedName`, `init(_ surah: SurahName)`, `static var fallback` = Al-Kahf) with `SurahEntityQuery`; `enum ResumeAction: Equatable {setPlaying, playTrack(surahId:reciterId:rewayatId:), nothing}`, `enum PlaybackResume {static func action(for: WidgetSnapshot?) -> ResumeAction}`; `enum PlaybackCommand {static func setPlaying(_ playing: Bool); static func loadSnapshot() -> WidgetSnapshot?}`; `@available(iOS 17.0, *)` `PlaySurahIntent(surah: SurahEntity)`, `PausePlaybackIntent()`, `ResumePlaybackIntent()`.

- [ ] **Step 1: Write the failing catalog generator tests**

In `services/widgets/__tests__/widgetStaticData.test.ts`, add `buildSurahCatalogSwift` to the import from `'../widgetStaticData'`, then add after the `describe('buildStaticSurahs', ...)` block:

```ts
describe('buildSurahCatalogSwift', () => {
  it('writes one escaped row per surah', () => {
    const swift = buildSurahCatalogSwift(
      buildStaticSurahs(
        [
          {id: 1, name: 'Al-Fatihah', translated_name_english: 'The Opener'},
          {id: 2, name: 'Qaf', translated_name_english: 'The Letter "Qaf"'},
        ],
        {},
      ),
    );
    expect(swift).toContain('static let all: [SurahName] = [');
    expect(swift).toContain(
      '    SurahName(id: 1, name: "Al-Fatihah", translatedName: "The Opener"),',
    );
    expect(swift).toContain('translatedName: "The Letter \\"Qaf\\""');
  });

  it('rejects control characters', () => {
    expect(() =>
      buildSurahCatalogSwift(
        buildStaticSurahs([{id: 1, name: 'a\nb', translated_name_english: 'x'}], {}),
      ),
    ).toThrow('control character');
  });
});
```

and inside `describe('generated widget data', ...)` add:

```ts
  it('SurahCatalog.swift matches surahs.json (run npm run generate:widget-data)', () => {
    const surahs = readJson(iosSurahs) as StaticSurah[];
    expect(
      fs.readFileSync(
        path.join(root, 'targets/widgets/_shared/SurahCatalog.swift'),
        'utf8',
      ),
    ).toBe(buildSurahCatalogSwift(surahs));
  });
```

Run: `npx jest services/widgets/__tests__/widgetStaticData.test.ts`
Expected: FAIL with "buildSurahCatalogSwift is not a function".

- [ ] **Step 2: Implement the generator and regenerate**

In `services/widgets/widgetStaticData.ts`, append:

```ts
function swiftString(value: string): string {
  if ([...value].some(c => c.charCodeAt(0) < 0x20)) {
    throw new Error(`control character in "${value}"`);
  }
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Swift source for targets/widgets/_shared/SurahCatalog.swift. */
export function buildSurahCatalogSwift(surahs: StaticSurah[]): string {
  const rows = surahs.map(
    s =>
      `    SurahName(id: ${s.id}, name: ${swiftString(s.name)}, translatedName: ${swiftString(s.translatedName)}),`,
  );
  return [
    '// targets/widgets/_shared/SurahCatalog.swift',
    '// Generated by scripts/generate-widget-data.ts. Do not edit.',
    '// Compiled into the app and the widget extension, so Siri and controls',
    '// resolve surahs without the extension-only surahs.json.',
    'import Foundation',
    '',
    'struct SurahName: Hashable {',
    '  let id: Int',
    '  let name: String',
    '  let translatedName: String',
    '}',
    '',
    'enum SurahCatalog {',
    '  static let all: [SurahName] = [',
    ...rows,
    '  ]',
    '',
    '  static func surah(_ id: Int) -> SurahName? {',
    '    id >= 1 && id <= all.count ? all[id - 1] : nil',
    '  }',
    '}',
    '',
  ].join('\n');
}
```

In `scripts/generate-widget-data.ts`, change the import to:

```ts
import {
  buildStaticAyat,
  buildStaticSurahs,
  buildSurahCatalogSwift,
} from '../services/widgets/widgetStaticData';
```

and before the final `console.log(` in `main()` add:

```ts
  fs.writeFileSync(
    path.join(root, 'targets/widgets/_shared/SurahCatalog.swift'),
    buildSurahCatalogSwift(surahs),
  );
```

Run:

```bash
npm run generate:widget-data
git status --short targets/widgets modules/bayaan-widgets/android/src/main/assets
npx jest services/widgets/__tests__/widgetStaticData.test.ts
```

Expected: the generator prints `390 ayat, 114 surahs`; `git status` shows only `?? targets/widgets/_shared/SurahCatalog.swift` (the JSON files are unchanged); the tests PASS.

- [ ] **Step 3: Write the failing Swift checks**

In `scripts/check-widget-system-surfaces.sh`, replace the line

```bash
cat "$root/targets/widgets/LiveActivity/NowPlayingActivityState.swift" > "$tmp/surfaces-test.swift"
```

with

```bash
cat "$root/targets/widgets/LiveActivity/NowPlayingActivityState.swift" \
    "$root/targets/widgets/_shared/WidgetSnapshot.swift" \
    "$root/targets/widgets/_shared/SurahCatalog.swift" \
    "$root/targets/widgets/_shared/SurahSynonyms.swift" \
    "$root/targets/widgets/_shared/PlaybackResume.swift" > "$tmp/surfaces-test.swift"
```

and insert before `print("swift system surfaces: OK")`:

```swift
// Surah catalog and Siri synonyms
precondition(SurahCatalog.all.count == 114 && SurahCatalog.surah(18)?.name == "Al-Kahf", "surah catalog")
precondition(SurahCatalog.surah(0) == nil && SurahCatalog.surah(115) == nil, "surah catalog bounds")
precondition(SurahSynonyms.of(name: "Al-Kahf", translatedName: "The Cave")
  == ["Al-Kahf", "Al Kahf", "Kahf", "Surah Al-Kahf", "The Cave"], "synonyms Al-")
precondition(SurahSynonyms.of(name: "Ya-Sin", translatedName: "Ya Sin")
  == ["Ya-Sin", "Ya Sin", "Surah Ya-Sin"], "synonyms dedupe")
precondition(SurahSynonyms.of(name: "Ali 'Imran", translatedName: "Family of Imran")
  == ["Ali 'Imran", "Surah Ali 'Imran", "Family of Imran"], "synonyms no article")

// Resume Bayaan
let fullSnapshot = WidgetSnapshot.decode(load("\(dir)/snapshot.full.json"))!
let upload = WidgetTrack(surahId: 0, surahName: "My upload", reciterId: "u", reciterName: "Me",
                         rewayatId: nil, artworkFile: nil, isUserUpload: true)
let mulk = WidgetTrack(surahId: 67, surahName: "Al-Mulk", reciterId: "r2", reciterName: "R2",
                       rewayatId: "rw-2", artworkFile: nil, isUserUpload: false)
func idle(recent: [WidgetTrack], upNext: [WidgetTrack]) -> WidgetSnapshot {
  WidgetSnapshot(version: 1, generatedAt: 0, theme: .dark, nowPlaying: nil, upNext: upNext,
                 recent: recent, defaultReciter: nil, reciterRecents: [:], lastRead: nil, tasbeeh: [:])
}
precondition(PlaybackResume.action(for: fullSnapshot) == .setPlaying, "resume loaded track")
precondition(PlaybackResume.action(for: nil) == .nothing, "resume without snapshot")
precondition(PlaybackResume.action(for: idle(recent: [upload, mulk], upNext: fullSnapshot.upNext))
  == .playTrack(surahId: 67, reciterId: "r2", rewayatId: "rw-2"), "resume recent, skipping uploads")
precondition(PlaybackResume.action(for: idle(recent: [upload], upNext: fullSnapshot.upNext))
  == .playTrack(surahId: 36, reciterId: "r-alafasi", rewayatId: "rw-1"), "resume suggestion")
precondition(PlaybackResume.action(for: idle(recent: [upload], upNext: [])) == .nothing, "resume nothing")
```

Run: `npm run test:widget-fixtures`
Expected: FAIL with `cat: .../_shared/SurahSynonyms.swift: No such file or directory`.

- [ ] **Step 4: Write the pure Swift files**

`targets/widgets/_shared/SurahSynonyms.swift`:

```swift
// targets/widgets/_shared/SurahSynonyms.swift
import Foundation

/// Spoken variants of a surah name for Siri: "Al-Kahf" gives "Al Kahf",
/// "Kahf", "Surah Al-Kahf" and the English name. Order kept, duplicates dropped.
enum SurahSynonyms {
  static func of(name: String, translatedName: String) -> [String] {
    let spaced = name.replacingOccurrences(of: "-", with: " ")
    var bare = name
    if let article = name.range(of: "^A[a-z]{1,2}-", options: .regularExpression) {
      bare = String(name[article.upperBound...])
    }
    var seen = Set<String>()
    return [name, spaced, bare, "Surah \(name)", translatedName]
      .filter { !$0.isEmpty && seen.insert($0).inserted }
  }
}
```

`targets/widgets/_shared/PlaybackResume.swift`:

```swift
// targets/widgets/_shared/PlaybackResume.swift
import Foundation

enum ResumeAction: Equatable {
  case setPlaying
  case playTrack(surahId: Int, reciterId: String, rewayatId: String?)
  case nothing
}

/// What "Resume Bayaan" does: resume the loaded track, else start the most
/// recent surah, else the suggestion Continue Listening shows (upNext).
/// Uploads are skipped because a playTrack command cannot address them.
enum PlaybackResume {
  static func action(for snapshot: WidgetSnapshot?) -> ResumeAction {
    guard let snapshot else { return .nothing }
    if snapshot.nowPlaying != nil { return .setPlaying }
    guard let track = (snapshot.recent + snapshot.upNext)
      .first(where: { !$0.isUserUpload && $0.surahId > 0 }) else { return .nothing }
    return .playTrack(surahId: track.surahId, reciterId: track.reciterId, rewayatId: track.rewayatId)
  }
}
```

Run: `npm run test:widget-fixtures`
Expected: all OK lines, including `swift system surfaces: OK`.

- [ ] **Step 5: Move SurahEntity to `_shared`**

`targets/widgets/_shared/SurahEntity.swift`:

```swift
// targets/widgets/_shared/SurahEntity.swift
// In _shared so the app (Siri, App Shortcuts) and the extension (Quick Surah,
// Play Surah control) resolve the same entity. iOS 17, like every intent using it.
import AppIntents
import Foundation

@available(iOS 17.0, *)
struct SurahEntity: AppEntity {
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Surah")
  static var defaultQuery = SurahEntityQuery()
  /// Al-Kahf: what the Play Surah control plays until a surah is chosen.
  static var fallback: SurahEntity { SurahEntity(SurahCatalog.all[17]) }

  let id: Int
  let name: String
  let translatedName: String

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(
      title: "\(name)",
      subtitle: "\(id) · \(translatedName)",
      synonyms: SurahSynonyms.of(name: name, translatedName: translatedName).map { "\($0)" })
  }

  init(_ surah: SurahName) {
    id = surah.id
    name = surah.name
    translatedName = surah.translatedName
  }
}

@available(iOS 17.0, *)
struct SurahEntityQuery: EntityStringQuery {
  func entities(for identifiers: [Int]) async throws -> [SurahEntity] {
    identifiers.compactMap { SurahCatalog.surah($0).map(SurahEntity.init) }
  }

  func suggestedEntities() async throws -> [SurahEntity] {
    SurahCatalog.all.map(SurahEntity.init)
  }

  func entities(matching string: String) async throws -> [SurahEntity] {
    let q = string.lowercased().trimmingCharacters(in: .whitespaces)
    return SurahCatalog.all.filter { surah in
      String(surah.id) == q
        || SurahSynonyms.of(name: surah.name, translatedName: surah.translatedName)
          .contains { $0.lowercased().contains(q) }
    }.map(SurahEntity.init)
  }
}
```

Replace the whole of `targets/widgets/Support/Entities.swift` with (the reciter and dhikr entities are unchanged; only the surah entity and its query are removed):

```swift
// targets/widgets/Support/Entities.swift
// SurahEntity lives in _shared/SurahEntity.swift (the app needs it for Siri).
import AppIntents
import Foundation

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

Before replacing, run `git diff HEAD -- targets/widgets/Support/Entities.swift` and confirm it is empty; if it is not, keep any newer changes to the reciter and dhikr entities and remove only the surah entity and its query.

- [ ] **Step 6: Share play/pause and add the Siri intents**

In `targets/widgets/_shared/PlaybackIntents.swift`, replace `SetPlaybackIntent.perform()`:

```swift
  func perform() async throws -> some IntentResult {
    // Optimistic render first, then hand the command to the app.
    PlaybackOverrideStore.write(isPlaying: playing)
    WidgetCenter.shared.reloadTimelines(ofKind: "ContinueListening")
    WidgetCenter.shared.reloadTimelines(ofKind: "ListeningAccessory")
    WidgetCommandQueue.enqueue(["type": "setPlayback", "playing": playing])
    return .result()
  }
```

with:

```swift
  func perform() async throws -> some IntentResult {
    PlaybackCommand.setPlaying(playing)
    return .result()
  }
```

and append at the end of the file:

```swift

/// Every play/pause entry point (widgets, Live Activity, controls, Siri).
enum PlaybackCommand {
  static func setPlaying(_ playing: Bool) {
    // Optimistic render first, then hand the command to the app.
    PlaybackOverrideStore.write(isPlaying: playing)
    WidgetCenter.shared.reloadTimelines(ofKind: "ContinueListening")
    WidgetCenter.shared.reloadTimelines(ofKind: "ListeningAccessory")
    WidgetCommandQueue.enqueue(["type": "setPlayback", "playing": playing])
  }

  /// The app's last snapshot, readable from the app process (Siri) too.
  static func loadSnapshot() -> WidgetSnapshot? {
    guard let url = BayaanAppGroup.widgetsDir?.appendingPathComponent("snapshot.json"),
          let data = try? Data(contentsOf: url) else { return nil }
    return WidgetSnapshot.decode(data)
  }
}

/// Siri, Shortcuts and the Play Surah control: plays a surah with the default reciter.
@available(iOS 17.0, *)
struct PlaySurahIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play Surah"
  static var description = IntentDescription("Plays a surah in Bayaan with your default reciter.")

  @Parameter(title: "Surah") var surah: SurahEntity

  static var parameterSummary: some ParameterSummary {
    Summary("Play \(\.$surah)")
  }

  init() {}

  init(surah: SurahEntity) {
    self.surah = surah
  }

  func perform() async throws -> some IntentResult {
    WidgetCommandQueue.enqueue([
      "type": "playTrack",
      "surahId": surah.id,
      "reciterId": NSNull(),
      "rewayatId": NSNull(),
      "ayah": NSNull(),
    ])
    return .result()
  }
}

@available(iOS 17.0, *)
struct PausePlaybackIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Pause Recitation"
  static var description = IntentDescription("Pauses the recitation playing in Bayaan.")

  init() {}

  func perform() async throws -> some IntentResult {
    PlaybackCommand.setPlaying(false)
    return .result()
  }
}

@available(iOS 17.0, *)
struct ResumePlaybackIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Resume Recitation"
  static var description = IntentDescription(
    "Resumes your recitation in Bayaan, or plays your most recent surah.")

  init() {}

  func perform() async throws -> some IntentResult {
    switch PlaybackResume.action(for: PlaybackCommand.loadSnapshot()) {
    case .setPlaying:
      PlaybackCommand.setPlaying(true)
    case let .playTrack(surahId, reciterId, rewayatId):
      WidgetCommandQueue.enqueue([
        "type": "playTrack",
        "surahId": surahId,
        "reciterId": reciterId,
        "rewayatId": rewayatId ?? NSNull(),
        "ayah": NSNull(),
      ])
    case .nothing:
      break
    }
    return .result()
  }
}
```

- [ ] **Step 7: Prebuild and build**

`_shared` gained files, so prebuild first.

```bash
npm run prebuild
npm run test:widget-fixtures
xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20
python3 -c "import json; d=json.load(open('ios/build/dd/Build/Products/Release-iphonesimulator/Bayaan.app/Metadata.appintents/extract.actionsdata')); print(sorted(k for k in d['actions'] if k in ('PlaySurahIntent','PausePlaybackIntent','ResumePlaybackIntent')))"
```

Expected: OK lines; `** BUILD SUCCEEDED **`; `['PausePlaybackIntent', 'PlaySurahIntent', 'ResumePlaybackIntent']`. If the build rejects the `synonyms:` argument of `DisplayRepresentation`, drop that argument (keep title and subtitle) and record it in the Task 10 checklist as a Siri recognition risk.

- [ ] **Step 8: Typecheck, format, commit**

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
npx prettier --write services/widgets/widgetStaticData.ts services/widgets/__tests__/widgetStaticData.test.ts scripts/generate-widget-data.ts
git add services/widgets/widgetStaticData.ts services/widgets/__tests__/widgetStaticData.test.ts scripts/generate-widget-data.ts targets/widgets/_shared/SurahCatalog.swift targets/widgets/_shared/SurahEntity.swift targets/widgets/_shared/SurahSynonyms.swift targets/widgets/_shared/PlaybackResume.swift targets/widgets/_shared/PlaybackIntents.swift targets/widgets/Support/Entities.swift scripts/check-widget-system-surfaces.sh
git status --short ios/   # add regenerated ios/ files only if prebuild changed them
git commit -m "feat(widgets): share the surah entity and add Siri playback intents"
```

---

### Task 8: Control Center and Action Button controls (iOS 18)

**Files:**
- Create: `targets/widgets/Controls/PlaybackControls.swift`
- Modify: `targets/widgets/_shared/PlaybackIntents.swift`, `targets/widgets/WidgetsBundle.swift`, `modules/bayaan-widgets/ios/BayaanWidgetsModule.swift`

**Interfaces:**
- Consumes: `PlaybackCommand.setPlaying`, `PlaySurahIntent(surah:)`, `SurahEntity`, `SurahEntity.fallback` (Task 7); `EffectivePlayback(nowPlaying:generatedAt:override:now:)` (`ContinueListening/ContinueListeningViews.swift`); `SnapshotStore.load()`; `PlaybackOverrideStore.read()`.
- Produces: `@available(iOS 18.0, *)` `SetPlayingControlIntent` (`_shared`), `PlaybackControl` (kind `PlaybackControl`), `PlaySurahControl` (kind `PlaySurahControl`), `PlaySurahControlConfig`; `PlaybackControlState.isPlaying(snapshot:override:now:) -> Bool`. The module reloads `PlaybackControl` whenever JS reloads `ContinueListening`.

- [ ] **Step 1: Add the toggle intent and the control reload**

In `targets/widgets/_shared/PlaybackIntents.swift`, in `PlaybackCommand.setPlaying`, replace

```swift
    WidgetCenter.shared.reloadTimelines(ofKind: "ListeningAccessory")
    WidgetCommandQueue.enqueue(["type": "setPlayback", "playing": playing])
  }
```

with

```swift
    WidgetCenter.shared.reloadTimelines(ofKind: "ListeningAccessory")
    if #available(iOS 18.0, *) {
      ControlCenter.shared.reloadControls(ofKind: "PlaybackControl")
    }
    WidgetCommandQueue.enqueue(["type": "setPlayback", "playing": playing])
  }
```

and append at the end of the file:

```swift

/// The play/pause control's action. ControlWidgetToggle needs a SetValueIntent
/// whose `value` is the new state; AudioPlaybackIntent keeps it in the app process.
@available(iOS 18.0, *)
struct SetPlayingControlIntent: SetValueIntent, AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play or Pause Bayaan"
  static var isDiscoverable = false

  @Parameter(title: "Playing") var value: Bool

  init() {}

  func perform() async throws -> some IntentResult {
    PlaybackCommand.setPlaying(value)
    return .result()
  }
}
```

- [ ] **Step 2: Write the controls**

`targets/widgets/Controls/PlaybackControls.swift`:

```swift
// targets/widgets/Controls/PlaybackControls.swift
import AppIntents
import SwiftUI
import WidgetKit

/// Continue Listening's effective playing state (snapshot plus tap override).
enum PlaybackControlState {
  static func isPlaying(snapshot: WidgetSnapshot?, override: PlaybackOverride?, now: Date) -> Bool {
    guard let s = snapshot, let np = s.nowPlaying else { return false }
    return EffectivePlayback(nowPlaying: np, generatedAt: s.generatedAt, override: override, now: now)
      .isPlaying
  }
}

@available(iOS 18.0, *)
struct PlaybackControlValueProvider: ControlValueProvider {
  var previewValue: Bool { false }

  func currentValue() async throws -> Bool {
    PlaybackControlState.isPlaying(
      snapshot: SnapshotStore.load(), override: PlaybackOverrideStore.read(), now: .now)
  }
}

/// Control Center, Lock Screen and Action Button: play or pause in place.
@available(iOS 18.0, *)
struct PlaybackControl: ControlWidget {
  static let kind = "PlaybackControl"

  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: Self.kind, provider: PlaybackControlValueProvider()) { isPlaying in
      ControlWidgetToggle("Bayaan", isOn: isPlaying, action: SetPlayingControlIntent()) { isOn in
        Label(isOn ? "Playing" : "Paused", systemImage: isOn ? "pause.fill" : "play.fill")
      }
    }
    .displayName("Play or Pause")
    .description("Play or pause your recitation.")
  }
}

@available(iOS 18.0, *)
struct PlaySurahControlConfig: ControlConfigurationIntent {
  static var title: LocalizedStringResource = "Play Surah"
  static var description = IntentDescription("Choose the surah this control plays.")

  @Parameter(title: "Surah") var surah: SurahEntity?

  init() {}

  func perform() async throws -> some IntentResult { .result() }
}

/// Plays the configured surah (Al-Kahf until configured) with the default reciter.
@available(iOS 18.0, *)
struct PlaySurahControl: ControlWidget {
  static let kind = "PlaySurahControl"

  var body: some ControlWidgetConfiguration {
    AppIntentControlConfiguration(kind: Self.kind, intent: PlaySurahControlConfig.self) { config in
      let surah = config.surah ?? SurahEntity.fallback
      ControlWidgetButton(action: PlaySurahIntent(surah: surah)) {
        Label(surah.name, systemImage: "play.circle.fill")
      }
    }
    .displayName("Play Surah")
    .description("Play a chosen surah with your default reciter.")
    .promptsForUserConfiguration()
  }
}
```

- [ ] **Step 3: Register the controls**

In `targets/widgets/WidgetsBundle.swift`, after `NowPlayingLiveActivity()` add:

```swift
    if #available(iOS 18.0, *) {
      PlaybackControl()
      PlaySurahControl()
    }
```

The bundle now has 9 entries; `WidgetBundleBuilder` accepts at most 10, so a future widget beyond that needs a nested bundle.

- [ ] **Step 4: Reload the control with Continue Listening**

In `modules/bayaan-widgets/ios/BayaanWidgetsModule.swift`, replace

```swift
        if kind == "ContinueListening" {
          WidgetCenter.shared.reloadTimelines(ofKind: "ListeningAccessory")
        }
```

with

```swift
        if kind == "ContinueListening" {
          WidgetCenter.shared.reloadTimelines(ofKind: "ListeningAccessory")
          if #available(iOS 18.0, *) {
            ControlCenter.shared.reloadControls(ofKind: "PlaybackControl")
          }
        }
```

and update the comment above `Function("reloadWidgets")` to:

```swift
    // ListeningAccessory and the play/pause control read the same snapshot slice as ContinueListening.
```

- [ ] **Step 5: Build**

`Controls/` is a new folder inside the synchronized `widgets` group (no prebuild needed) and `_shared` gained no files.

```bash
npm run test:widget-fixtures
xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20
python3 -c "import json; d=json.load(open('ios/build/dd/Build/Products/Release-iphonesimulator/Bayaan.app/PlugIns/BayaanWidgetsExtension.appex/Metadata.appintents/extract.actionsdata')); print('PlaySurahControlConfig' in d['actions'], 'SetPlayingControlIntent' in d['actions'])"
```

Expected: OK lines; `** BUILD SUCCEEDED **`; `True True`. If the compiler rejects `if #available` inside the bundle body, move the two controls into `@available(iOS 18.0, *) struct BayaanControlsBundle: WidgetBundle { var body: some Widget { PlaybackControl(); PlaySurahControl() } }` in `Controls/PlaybackControls.swift` and use `if #available(iOS 18.0, *) { BayaanControlsBundle().body }` in the main bundle.

- [ ] **Step 6: Commit**

```bash
git add targets/widgets/Controls/PlaybackControls.swift targets/widgets/_shared/PlaybackIntents.swift targets/widgets/WidgetsBundle.swift modules/bayaan-widgets/ios/BayaanWidgetsModule.swift
git commit -m "feat(widgets): add play/pause and Play Surah controls for iOS 18"
```

---

### Task 9: Siri and Shortcuts phrases

The `AppShortcutsProvider` goes into the app target only, through a config plugin, and the module refreshes its parameters at start.

**Files:**
- Create: `plugins/withAppShortcuts.js`, `plugins/app-shortcuts/BayaanAppShortcuts.swift`
- Modify: `app.config.js`, `modules/bayaan-widgets/ios/BayaanWidgetsModule.swift`

**Interfaces:**
- Consumes: `PlaySurahIntent`, `PausePlaybackIntent`, `ResumePlaybackIntent`, `SurahEntity` (Task 7, compiled into the app via `_shared`).
- Produces: `BayaanAppShortcuts: AppShortcutsProvider` (app target), `@objc(BayaanAppShortcutsRefresher)` with class method `refresh` (called by the module through the Objective-C runtime).

- [ ] **Step 1: Write the app-only Swift file**

`plugins/app-shortcuts/BayaanAppShortcuts.swift`:

```swift
// plugins/app-shortcuts/BayaanAppShortcuts.swift
// Copied into the app target by plugins/withAppShortcuts.js on every prebuild.
// App only: putting this in targets/widgets/_shared would also declare App
// Shortcuts in the widget extension.
import AppIntents
import Foundation

@available(iOS 17.0, *)
struct BayaanAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: PlaySurahIntent(),
      phrases: [
        "Play \(\.$surah) in \(.applicationName)",
        "Play Surah \(\.$surah) in \(.applicationName)",
        "Play \(\.$surah) on \(.applicationName)",
      ],
      shortTitle: "Play Surah",
      systemImageName: "play.circle")
    AppShortcut(
      intent: PausePlaybackIntent(),
      phrases: [
        "Pause \(.applicationName)",
        "Stop \(.applicationName)",
      ],
      shortTitle: "Pause",
      systemImageName: "pause.circle")
    AppShortcut(
      intent: ResumePlaybackIntent(),
      phrases: [
        "Resume \(.applicationName)",
        "Continue \(.applicationName)",
      ],
      shortTitle: "Resume",
      systemImageName: "play.circle.fill")
  }
}

/// The bayaan-widgets pod cannot import app-target code, so it calls this
/// through the Objective-C runtime when the module is created.
@objc(BayaanAppShortcutsRefresher)
final class BayaanAppShortcutsRefresher: NSObject {
  @objc static func refresh() {
    if #available(iOS 17.0, *) {
      BayaanAppShortcuts.updateAppShortcutParameters()
    }
  }
}
```

- [ ] **Step 2: Write the config plugin**

`plugins/withAppShortcuts.js`:

```js
// plugins/withAppShortcuts.js
// Adds plugins/app-shortcuts/BayaanAppShortcuts.swift to the main app target
// (never the widget extension), so it survives `expo prebuild --clean`.
const fs = require('fs');
const path = require('path');
const {
  IOSConfig,
  withDangerousMod,
  withXcodeProject,
} = require('@expo/config-plugins');

const FILE_NAME = 'BayaanAppShortcuts.swift';
const SOURCE = path.join(__dirname, 'app-shortcuts', FILE_NAME);

function withAppShortcuts(config) {
  const copied = withDangerousMod(config, [
    'ios',
    async cfg => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(
        cfg.modRequest.projectRoot,
      );
      const dest = path.join(
        cfg.modRequest.platformProjectRoot,
        projectName,
        FILE_NAME,
      );
      fs.copyFileSync(SOURCE, dest);
      return cfg;
    },
  ]);
  return withXcodeProject(copied, cfg => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(
      cfg.modRequest.projectRoot,
    );
    const filepath = `${projectName}/${FILE_NAME}`;
    if (!cfg.modResults.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath,
        groupName: projectName,
        project: cfg.modResults,
      });
    }
    return cfg;
  });
}

module.exports = withAppShortcuts;
```

In `app.config.js`, in `plugins`, after `'./withIOSTeam.js',` add:

```js
      './plugins/withAppShortcuts.js',
```

- [ ] **Step 3: Refresh shortcut parameters from the module**

In `modules/bayaan-widgets/ios/BayaanWidgetsModule.swift`, after `Events("onCommandQueued")` add:

```swift

    // App Shortcuts live in the app target (plugins/withAppShortcuts.js).
    // Refresh their surah parameters so Siri knows every surah name.
    OnCreate {
      if let cls = NSClassFromString("BayaanAppShortcutsRefresher") {
        let target = cls as AnyObject
        let selector = NSSelectorFromString("refresh")
        if target.responds(to: selector) { _ = target.perform(selector) }
      }
    }
```

- [ ] **Step 4: Prebuild, check the target membership, build, check the metadata**

```bash
npm run prebuild
ls ios/Bayaan/BayaanAppShortcuts.swift
grep -c "BayaanAppShortcuts.swift" ios/Bayaan.xcodeproj/project.pbxproj
xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -destination 'id=B68030CC-7E5B-4127-BE07-EFA327BE6680' -derivedDataPath ios/build/dd build | tail -20
P=ios/build/dd/Build/Products/Release-iphonesimulator/Bayaan.app
python3 -c "import json,sys; a=json.load(open(sys.argv[1])); e=json.load(open(sys.argv[2])); print(len(a['autoShortcuts']), len(e['autoShortcuts']))" "$P/Metadata.appintents/extract.actionsdata" "$P/PlugIns/BayaanWidgetsExtension.appex/Metadata.appintents/extract.actionsdata"
```

Expected: the file exists; the grep count is at least 2 (file reference and build file); `** BUILD SUCCEEDED **`; `3 0` (three App Shortcuts in the app, none in the extension).

- [ ] **Step 5: Format, commit**

```bash
npx prettier --write plugins/withAppShortcuts.js app.config.js
git add plugins/withAppShortcuts.js plugins/app-shortcuts/BayaanAppShortcuts.swift app.config.js modules/bayaan-widgets/ios/BayaanWidgetsModule.swift
git status --short ios/   # add regenerated ios/ files only if prebuild changed them
git commit -m "feat(widgets): add Siri and Shortcuts phrases for playback"
```

---

### Task 10: Device verification and wrap-up

Use the argent MCP tools for all simulator interaction (read `argent-device-interact` first; take tap coordinates from the element tree, never from screenshot pixels). Release build: the Debug dev client cannot run app JS on a background launch.

**Files:**
- Create: `docs/superpowers/plans/2026-10-11-widgets-phase-2-device-checklist.md` (results, same table format as the 1a checklist: `| # | Check | Result | Notes |`, status PASS / PARTIAL / FAIL / PENDING)

- [ ] **Step 1: Install and set up on the "Bayaan Widgets" simulator (B68030CC-7E5B-4127-BE07-EFA327BE6680)**

Build Release (Global Constraints command), install with argent `reinstall-app` or `xcrun simctl install B68030CC-7E5B-4127-BE07-EFA327BE6680 ios/build/dd/Build/Products/Release-iphonesimulator/Bayaan.app`, clear `DYLD_INSERT_LIBRARIES` before timing anything (`xcrun simctl spawn B68030CC-7E5B-4127-BE07-EFA327BE6680 launchctl unsetenv DYLD_INSERT_LIBRARIES`, per the 1a checklist), launch, allow Live Activities if asked.

- [ ] **Step 2: Run and record the simulator checks**

1. Play Al-Kahf in the app (foreground). Lock the device (argent `button` lock): the Live Activity shows the surah card, "Al-Kahf", the reciter, a pause button, a moving bar and a countdown, on `#1C1C1E`, with the Bayaan mark.
2. Unlock and background the app: the Dynamic Island compact shows the card and a circular progress ring; long-press the island to expand: card, names, pause button, bar and countdown.
3. Tap pause in the expanded island: audio pauses and the activity shows a static bar and "Nm left" within about 2 s; tap play resumes.
4. Skip to the next track in the app: the same activity changes to the new surah (no second activity in the island or on the Lock Screen).
5. Seek forward 5 minutes in the app: the bar jumps once and keeps moving.
6. Clear the queue (or let the last track finish): the activity disappears.
7. Play, then terminate the app (argent `restart-app` or swipe away), relaunch without playing: the old activity is gone and no new one appears for the restored paused session.
8. Play, swipe the activity away on the Lock Screen: it stays away for that track; skipping to the next track brings it back (with the app in the foreground).
9. Settings > Bayaan > Live Activities off, play: no activity; turn it on, skip to the next track: the activity appears.
10. Control Center: add "Play or Pause" and "Play Surah" (configure Ya-Sin). The toggle shows the current state and flips playback; "Play Surah" plays Ya-Sin with the default reciter.
11. Shortcuts app (argent `launch-app` `com.apple.shortcuts`): the Bayaan App Shortcuts section lists Play Surah, Pause and Resume; running Play Surah with Al-Mulk plays it; Pause pauses; Resume resumes; with the queue cleared, Resume plays the most recent surah.
12. Quick Surah regression: the picker lists "Al-Kahf" with subtitle "18 · The Cave"; an existing configured Quick Surah widget still shows and plays its surah.
13. Phase 1 regression: Continue Listening play/pause in place and the Lock Screen listening accessory still work (1b checklist items 7 and 8).
14. `npm run prebuild` from clean followed by the build reproduces a building project; `ios/Bayaan/BayaanAppShortcuts.swift` is regenerated and belongs to the app target only (Task 9 metadata check prints `3 0`).

- [ ] **Step 3: Record the real-phone checks as PENDING with their protocols**

Add a "Needs a real phone" section to the checklist with these items, each PENDING unless a phone run happens:

- P1. **`ayah` mode prototype (gate for P2-R1).** On a physical iPhone with a Dynamic Island, iOS 17 or later, Release build, not attached to the Xcode debugger (the debugger keeps the app from suspending): locally change `liveActivityMode()` to return `'ayah'` (do not commit), play Al-Baqarah with Mishary Alafasy (Hafs, has timestamps), lock the phone and screen record the Lock Screen. Compare the ayah line with the audio at 1, 5 and 10 minutes. Repeat on battery (not charging), with Low Power Mode on, and once after switching to another app first. PASS: the ayah line is within one ayah of the audio at every observation in every run. Record the time of the last observed change if it stalls. On PASS, flip the default in a separate commit `feat(widgets): show the current ayah in the Live Activity`; on FAIL, keep `'surah'`.
- P2. **Redundancy with system Now Playing (P2-R1).** With the default `'surah'` mode, look at the Lock Screen and island while playing. If the activity reads as a duplicate of the system Now Playing card, record it and propose `'off'` until P1 passes.
- P3. **Background start (P2-R2).** Kill the app, start playback from the Continue Listening widget, the Play Surah control and Siri. Expected: no activity until the app is opened, then the activity appears. Record whether any start succeeded in the background.
- P4. **Siri voice.** "Play Al Kahf in Bayaan", "Play Surah Yasin in Bayaan", "Play The Cave in Bayaan", "Pause Bayaan", "Resume Bayaan".
- P5. **Action Button.** Assign each control under Settings > Action Button > Controls and press it.
- P6. **StandBy (P2-R16).** Charging, landscape, locked: small widgets and the Live Activity render legibly, including night mode (red tint).
- P7. **Cold start from a control or Siri.** As 1a item 1 (60 s command window).

- [ ] **Step 4: Fix failures** with superpowers:systematic-debugging, one commit per fix. Known fallbacks: drop `synonyms:` (Task 7) if Siri entity resolution misbehaves; the nested controls bundle (Task 8); if the activity starts but renders blank, the attributes pairing failed (P2-R4): confirm both copies are identical and named `NowPlayingAttributes`, then move the bridge into the app target with the Task 9 plugin mechanism; if artwork renders blank in the activity but not in widgets, add a 120 px derivative for the activity.

- [ ] **Step 5: Final checks**

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
npm run test:ci -- --silent
npm run test:widget-fixtures
npx prettier --check $(git diff --name-only osmansaeday/widgets-1b... | grep -E '\.(ts|tsx|js)$')
git diff --name-only osmansaeday/widgets-1b... | xargs grep -ln $'\xe2\x80\x94' || echo "no em dashes"
grep -n "return 'surah'" services/widgets/live-activity/config.ts
```

Expected: all clean; `no em dashes`; the shipping mode is still `'surah'`.

- [ ] **Step 6: Commit the checklist**

```bash
git add docs/superpowers/plans/2026-10-11-widgets-phase-2-device-checklist.md
git commit -m "docs: record widgets phase 2 device verification"
```

Then use superpowers:finishing-a-development-branch (PR targets `develop` once 1b has merged; until then, keep the branch stacked on `osmansaeday/widgets-1b`).

---

## Spec coverage

| Spec item | Task |
|---|---|
| 1, 5.1 content state, wall-time formulas, 4 KB cap | 1, 6 |
| 4 one derivation point, commands unchanged, pod/extension copies | 1, 2, 3, 5 |
| 5.2 lifecycle (start, update, end, deferred, suppression, orphan cleanup, serialization, stale dates) | 2, 4, 5 |
| 5.3 local updates only, flush throttle, post-command flush | 5 (existing drain flush) |
| 5.4 Lock Screen, Dynamic Island compact / minimal / expanded, palette, deep link | 3 |
| 5.5 per-ayah layer behind `liveActivityMode()`, default `surah` | 5, 6, 10 (P1) |
| 6 controls, toggle intent, control reload | 8 |
| 7 Siri: app-only provider, intents, phrases, SurahEntity move, catalog, synonyms, refresh | 7, 9 |
| 8 StandBy (no code) | 10 (P6) |
| 3 platform floors | 2 (`unsupported` below 17), 7, 8 |
| 10 testing (TS, Swift, builds, simulator, phone) | 1 to 10 |
| 12 open phone checks | 10 Step 3 |

## Self-review notes

- Spec coverage: every section maps to a task above; StandBy is verification only by ruling P2-R16.
- Placeholder scan: no TBD or "similar to" steps; every code step has full code; fallbacks are named with their exact replacement.
- Type consistency: `NowPlayingActivityState` fields match across `liveActivity.ts`, both Swift copies, the fixture and `planActivity.ts`; `ActivityStartResult` values match `NowPlayingActivityBridge.start`; `startNowPlayingActivity` / `updateNowPlayingActivity` / `endNowPlayingActivities` / `isLiveActivitySupported` names match across Swift, `NativeBayaanWidgets.ts`, `index.ts` and `syncLiveActivity.ts`; `PlaybackCommand.setPlaying`, `PlaySurahIntent(surah:)`, `SurahEntity.fallback`, `SetPlayingControlIntent` match across Tasks 7 to 9; kind strings `PlaybackControl` and `PlaySurahControl` match in the controls, `PlaybackCommand` and the module.
- Review Focus: each of the five lines has a pinning test in Tasks 1, 4, 5 or 6.
