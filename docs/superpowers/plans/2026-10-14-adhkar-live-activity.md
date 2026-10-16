# Adhkar Live Activity (Plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop Quran playback from starting a Live Activity, and give the adhkar session its own Live Activity (lock screen and Dynamic Island) that opens the playing dhikr. Also make the `bayaan://adhkar-playing` deep link wait for the saved session on a cold launch.

**Architecture:**
- Quran: `liveActivityMode()` returns `'off'` through one constant. With the mode off, `startLiveActivitySync()` ends any surviving Now Playing activity and does nothing else. The surah and ayah code stays in the tree.
- Native: a new ActivityKit type `AdhkarSessionAttributes` with its content state `AdhkarSessionActivityState`. Each file has two identical copies (module pod and widget extension), checked by `scripts/check-widget-system-surfaces.sh`. A new `AdhkarSessionActivityBridge` mirrors `NowPlayingActivityBridge`, and three module functions expose it to JS.
- Views: `AdhkarSessionLiveActivity` in the widget extension. It sits with `NowPlayingLiveActivity` in a nested `LiveActivities` bundle, because the main bundle is at the 10-child `WidgetBundleBuilder` limit.
- Policy: a pure `planAdhkarActivity(memory, session, now, otherSourceActive)` decides start, update, end, reset or nothing. A small sync module follows `useAdhkarSessionStore` and `audioCoordinator`, serializes the native calls on one chain, and runs where the adhkar engine starts.
- Deep link: `sessionPersistence` exposes `waitForSessionRestore(timeoutMs)`, and `app/adhkar-playing.tsx` waits on it before routing.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router, zustand, ActivityKit and WidgetKit (SwiftUI, iOS 17 widget extension), Expo Modules (Swift), @bacons/apple-targets, jest with @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-10-13-adhkar-playback-design.md`, section 7, with section 5 (the `adhkar-playing` deep link), section 3 (session store and engine) and the "app is killed" row of section 8. Plan A (`docs/superpowers/plans/2026-10-13-adhkar-playback.md`) is merged into this branch and is the base.

## Global Constraints

**Code**
- TypeScript strict. No `any`, and no `as` casts unless unavoidable (state why in a comment).
- Functional patterns. No new TS classes. `AudioCoordinator` is an existing class; Task 5 adds one method and one private helper to it. Swift structs and enums are fine (ActivityKit needs them).
- Use the `function` keyword for pure functions, with explicit parameter and return types on exported functions.
- Match the surrounding code's comment density and naming. No drive-by refactors.
- Android: no Live Activity. Every new JS path returns early off iOS, and the bayaan-widgets wrappers degrade when the native functions are absent.

**Copy and style**
- No em dashes anywhere: code, comments, Swift, commit messages. Where a separator is needed, use U+00B7 (`·`).
- Never use `theme.colors.primary` or accent colors. The activity uses the existing activity look: `WidgetPalette.background` with white text at the opacities `NowPlayingLiveActivity` uses.
- No new JS user-facing strings are planned. If a task adds one, it goes in `i18n/locales/en/*.json` and `i18n/locales/ar/*.json` and `npm run i18n:check` passes.

**Commits**
- Conventional commits, each ending with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011eqXmha1bR7cUTY365d9K1
  ```
- Never commit `ios/` or `android/` drift. Never push.

**Before a task reports DONE**
- `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit` is clean. Errors in files the task did not touch that also fail on the base commit are pre-existing: report them, don't fix them.
- `node node_modules/prettier/bin/prettier.cjs --check <changed TS/TSX/JSON/MD files>` is clean. This is Prettier 3; `npx prettier` is v2, so never use it. Prettier does not format Swift.
- The task's jest tests pass: `npx jest <paths>`.
- Swift files parse: `xcrun swiftc -parse <files>`. A full native build is not possible in the task; the controller builds and runs the device check after Task 6.

**Fixed values from the spec**
- Content state fields: `listTitle`, `preview`, `position` (1-based), `total`, `isPlaying`. Nothing else.
- `preview` is `SessionItem.preview` as is (first 60 characters of the clean Arabic, built in Plan A's `toSessionItems`).
- `position` and `total` match the lock screen title: `session.index + 1` and `session.items.length` (`adhkarLockScreenTitle`).
- Paused activity ends after 15 minutes (`ADHKAR_PAUSED_END_MS = 15 * 60 * 1000`).
- Stale date while playing: 10 minutes after the last update (`ADHKAR_PLAYING_STALE_MS = 10 * 60 * 1000`, spec section 8).
- Tap target: `AppLinks.url("adhkar-playing")`.
- Deep link restore wait: 3000 ms.

## Review Focus

1. **A surah activity left by the old version.** With the mode `'off'`, `startLiveActivitySync()` must still end it on launch (Task 1). Before this plan, mode `'off'` returned before touching ActivityKit.
2. **Quran takes over a paused session.** If the user paused adhkar and then starts a surah, the store does not change (already paused), so only the coordinator subscription (Task 5) ends the activity. Task 5 tests both orders.
3. **Reading the coordinator at the right time.** `pauseAdhkarIfActive()` sets the source to `'none'` and dispatches before the caller sets `'main'`. The sync reads the source inside the chained (asynchronous) reconcile, after the caller returns. Task 5's "Quran takes over a playing session" test proves it.
4. **Dismissal.** A dismissed activity (update returns false, or start is refused) is not restarted for the same session, but a new session starts one. Ending for a hand-off or after 15 minutes paused does not suppress: resuming the same session starts a new activity. Task 4 tests both.
5. **WidgetBundle limit.** The main `BayaanWidgetsBundle` already has 10 children. The adhkar activity must go into the nested `LiveActivities` bundle (Task 3), or the extension stops compiling.
6. **The two Swift copies.** `AdhkarSessionActivityState.swift` and `AdhkarSessionAttributes.swift` must be byte-identical in `modules/bayaan-widgets/ios` and `targets/widgets/LiveActivity` (Task 2, enforced by the check script).

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `services/widgets/live-activity/config.ts` | modify | Quran mode constant `'off'`; `adhkarLiveActivityEnabled()` |
| `services/widgets/live-activity/syncLiveActivity.ts` | modify | with the mode off, end surviving Now Playing activities |
| `services/widgets/__tests__/enabledWidgets.test.ts` | modify | Quran mode is off; the adhkar gate |
| `services/widgets/live-activity/__tests__/syncLiveActivity.test.ts` | modify | mode off ends a survivor |
| `modules/bayaan-widgets/src/adhkarActivity.ts` | create | `AdhkarSessionActivityState` and its guard |
| `modules/bayaan-widgets/src/__fixtures__/adhkarActivity.states.json` | create | shared TS and Swift decode vectors |
| `modules/bayaan-widgets/src/NativeBayaanWidgets.ts` | modify | three optional native functions |
| `modules/bayaan-widgets/src/index.ts` | modify | `startAdhkarSessionActivity`, `updateAdhkarSessionActivity`, `endAdhkarSessionActivities` |
| `modules/bayaan-widgets/src/__tests__/adhkarActivity.test.ts` | create | guard against the fixture |
| `modules/bayaan-widgets/src/__tests__/adhkarActivityBridge.test.ts` | create | wrappers degrade and pass JSON |
| `modules/bayaan-widgets/ios/AdhkarSessionActivityState.swift` | create | content state (copy 1) |
| `modules/bayaan-widgets/ios/AdhkarSessionAttributes.swift` | create | ActivityKit attributes (copy 1) |
| `modules/bayaan-widgets/ios/AdhkarSessionActivityBridge.swift` | create | start, update, end |
| `modules/bayaan-widgets/ios/BayaanWidgetsModule.swift` | modify | three `AsyncFunction`s |
| `targets/widgets/LiveActivity/AdhkarSessionActivityState.swift` | create | content state (copy 2) |
| `targets/widgets/LiveActivity/AdhkarSessionAttributes.swift` | create | ActivityKit attributes (copy 2) |
| `scripts/check-widget-system-surfaces.sh` | modify | `cmp` both copies; decode the fixture |
| `targets/widgets/LiveActivity/AdhkarSessionLiveActivity.swift` | create | lock screen and Dynamic Island views |
| `targets/widgets/LiveActivity/LiveActivities.swift` | create | nested bundle with both activities |
| `targets/widgets/WidgetsBundle.swift` | modify | `LiveActivities().body` replaces `NowPlayingLiveActivity()` |
| `services/widgets/live-activity/planAdhkarActivity.ts` | create | pure policy and memory transitions |
| `services/widgets/live-activity/__tests__/planAdhkarActivity.test.ts` | create | every transition |
| `services/audio/AudioCoordinator.ts` | modify | `subscribe()`; private `setActiveSource()` |
| `services/audio/__tests__/AudioCoordinator.test.ts` | modify | subscription test |
| `services/widgets/live-activity/syncAdhkarActivity.ts` | create | store and coordinator follower, native call chain, pause timer |
| `services/widgets/live-activity/__tests__/syncAdhkarActivity.test.ts` | create | sync behavior with mocked natives |
| `services/audio/ExpoAudioProvider.tsx` | modify | start and stop the sync with the engine |
| `services/adhkar/playback/sessionPersistence.ts` | modify | `waitForSessionRestore()`; restore always settles it |
| `services/adhkar/playback/__tests__/sessionPersistence.test.ts` | modify | restore readiness tests |
| `app/adhkar-playing.tsx` | modify | wait for the restore, then route |
| `services/adhkar/playback/__tests__/adhkarPlayingRoute.test.tsx` | create | route waits, routes, falls back |

The Now Playing activity files (`NowPlayingLiveActivity.swift`, `NowPlayingActivityBridge.swift`, `planActivity.ts`, `ayahTicker.ts`, `ayahLayer.ts`) are not edited. They stay compiled and tested so Quran can come back with a one-line change.

---

### Task 1: Turn the Quran Live Activity off

**Files:**
- Modify: `services/widgets/live-activity/config.ts`
- Modify: `services/widgets/live-activity/syncLiveActivity.ts`
- Test: `services/widgets/__tests__/enabledWidgets.test.ts`
- Test: `services/widgets/live-activity/__tests__/syncLiveActivity.test.ts`

**Interfaces:**
- Consumes: `isWidgetEnabled`, `widgetFeatures` from `services/widgets/enabledWidgets.ts`; `endNowPlayingActivities`, `isLiveActivitySupported` from `bayaan-widgets`.
- Produces:
  - `liveActivityMode(): LiveActivityMode`, now `'off'` for every config.
  - `adhkarLiveActivityEnabled(): boolean`, true when the `LiveActivity` widget ships and the `adhkar` feature is on. Task 5 uses it.

- [ ] **Step 1: Write the failing tests**

In `services/widgets/__tests__/enabledWidgets.test.ts`, give the helper an optional feature flag override and replace the `liveActivityMode` block:

```ts
// RFC-021: which widget kinds sync reloads, and the Live Activity gate.
type EnabledWidgets = typeof import('../enabledWidgets');
type LiveActivityConfig = typeof import('../live-activity/config');

function withWidgets<T>(
  widgets: string[] | undefined,
  run: (enabled: EnabledWidgets, live: LiveActivityConfig) => T,
  flags: Record<string, boolean> = {},
): T {
  let result: T | undefined;
  let ran = false;
  jest.isolateModules(() => {
    jest.doMock('@/config/nativeWidgets.config', () => ({
      __esModule: true,
      default: {widgets},
    }));
    jest.doMock('@/config/featureFlags', () => {
      const actual = jest.requireActual('@/config/featureFlags');
      return {...actual, featureFlags: {...actual.featureFlags, ...flags}};
    });
    const enabled: EnabledWidgets = require('../enabledWidgets');
    const live: LiveActivityConfig = require('../live-activity/config');
    result = run(enabled, live);
    ran = true;
  });
  if (!ran || result === undefined)
    throw new Error('isolateModules did not run');
  return result;
}
```

Keep the `enabledKinds` block as it is. Replace `describe('liveActivityMode', ...)` with:

```ts
describe('liveActivityMode', () => {
  it('is off for Quran playback, even with LiveActivity shipped', () => {
    expect(withWidgets(undefined, (_, live) => live.liveActivityMode())).toBe(
      'off',
    );
  });

  it('is off when a fork lists LiveActivity out', () => {
    expect(
      withWidgets(['ContinueListening'], (_, live) => live.liveActivityMode()),
    ).toBe('off');
  });
});

describe('adhkarLiveActivityEnabled', () => {
  it('is on by default', () => {
    expect(
      withWidgets(undefined, (_, live) => live.adhkarLiveActivityEnabled()),
    ).toBe(true);
  });

  it('is off when a fork lists LiveActivity out', () => {
    expect(
      withWidgets(['ContinueListening'], (_, live) =>
        live.adhkarLiveActivityEnabled(),
      ),
    ).toBe(false);
  });

  it('is off when the adhkar feature is off', () => {
    expect(
      withWidgets(
        undefined,
        (_, live) => live.adhkarLiveActivityEnabled(),
        {adhkar: false},
      ),
    ).toBe(false);
  });
});
```

In `services/widgets/live-activity/__tests__/syncLiveActivity.test.ts`, replace the first test (`'does nothing off iOS, when unsupported, or when the mode is off'`) with these two. The rest of the file keeps `mockMode = 'surah'`, so the disabled surah path stays covered.

```ts
  it('does nothing off iOS or when unsupported', async () => {
    for (const setup of [
      () => (mockPlatformOS = 'android'),
      () => (mockSupported = false),
    ]) {
      setup();
      const sync = loadModule();
      sync.startLiveActivitySync();
      sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
      await sync.reconcileLiveActivity();
      mockPlatformOS = 'ios';
      mockSupported = true;
    }
    expect(mockLog).toEqual([]);
  });

  it('with the mode off, ends a surviving activity and starts nothing', async () => {
    mockMode = 'off';
    mockSurvivor = survivorFor({});
    const sync = loadModule();
    sync.startLiveActivitySync();
    await Promise.resolve();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    expect(mockLog).toEqual(['end']);
    expect(mockStart).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest services/widgets/__tests__/enabledWidgets.test.ts services/widgets/live-activity/__tests__/syncLiveActivity.test.ts`
Expected: FAIL. `liveActivityMode()` returns `'surah'`, `adhkarLiveActivityEnabled` is not a function, and mode off logs nothing.

- [ ] **Step 3: Implement the config**

Replace `services/widgets/live-activity/config.ts` with:

```ts
// services/widgets/live-activity/config.ts
// Quran playback no longer starts a Live Activity (adhkar playback spec,
// section 7): the lock screen player covers it. The 'surah' and 'ayah' code
// paths stay compiled and tested. To bring the surah activity back, set
// QURAN_LIVE_ACTIVITY_MODE to 'surah'. 'ayah' adds the current ayah and
// updates on every ayah change; keep it off until the device prototype in
// docs/superpowers/plans/2026-10-11-widgets-phase-2-device-checklist.md passes.
// A fork that lists LiveActivity out (RFC-021) compiles every activity out of
// the widget extension, so both gates are off there too.
import {isWidgetEnabled, widgetFeatures} from '../enabledWidgets';

export type LiveActivityMode = 'off' | 'surah' | 'ayah';

const QURAN_LIVE_ACTIVITY_MODE: LiveActivityMode = 'off';

export function liveActivityMode(): LiveActivityMode {
  return isWidgetEnabled('LiveActivity') ? QURAN_LIVE_ACTIVITY_MODE : 'off';
}

/** The adhkar session Live Activity also needs the adhkar feature. */
export function adhkarLiveActivityEnabled(): boolean {
  return isWidgetEnabled('LiveActivity') && widgetFeatures.adhkar;
}
```

- [ ] **Step 4: End a surviving surah activity when the mode is off**

In `services/widgets/live-activity/syncLiveActivity.ts`, replace the opening guard of `startLiveActivitySync()`:

```ts
export function startLiveActivitySync(): () => void {
  if (
    Platform.OS !== 'ios' ||
    liveActivityMode() === 'off' ||
    !isLiveActivitySupported()
  ) {
    return () => undefined;
  }
```

with:

```ts
export function startLiveActivitySync(): () => void {
  if (Platform.OS !== 'ios' || !isLiveActivitySupported()) {
    return () => undefined;
  }
  if (liveActivityMode() === 'off') {
    // An earlier version may have left a surah activity on screen. The adhkar
    // activity is another ActivityKit type, so this does not touch it.
    endNowPlayingActivities().catch(logError);
    return () => undefined;
  }
```

`endNowPlayingActivities` is already imported in this file.

- [ ] **Step 5: Run the tests, tsc and Prettier**

Run: `npx jest services/widgets`
Expected: PASS (the other `syncLiveActivity` tests still run in `'surah'` mode through the mocked config).

Run: `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit && node node_modules/prettier/bin/prettier.cjs --check services/widgets/live-activity/config.ts services/widgets/live-activity/syncLiveActivity.ts services/widgets/__tests__/enabledWidgets.test.ts services/widgets/live-activity/__tests__/syncLiveActivity.test.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add services/widgets/live-activity/config.ts services/widgets/live-activity/syncLiveActivity.ts services/widgets/__tests__/enabledWidgets.test.ts services/widgets/live-activity/__tests__/syncLiveActivity.test.ts
git commit -m "feat(widgets): Quran playback no longer starts a Live Activity

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011eqXmha1bR7cUTY365d9K1"
```

---

### Task 2: Adhkar activity contract, native bridge and JS bindings

**Files:**
- Create: `modules/bayaan-widgets/src/adhkarActivity.ts`
- Create: `modules/bayaan-widgets/src/__fixtures__/adhkarActivity.states.json`
- Modify: `modules/bayaan-widgets/src/NativeBayaanWidgets.ts`
- Modify: `modules/bayaan-widgets/src/index.ts`
- Create: `modules/bayaan-widgets/ios/AdhkarSessionActivityState.swift`
- Create: `modules/bayaan-widgets/ios/AdhkarSessionAttributes.swift`
- Create: `modules/bayaan-widgets/ios/AdhkarSessionActivityBridge.swift`
- Modify: `modules/bayaan-widgets/ios/BayaanWidgetsModule.swift`
- Create: `targets/widgets/LiveActivity/AdhkarSessionActivityState.swift` (identical copy)
- Create: `targets/widgets/LiveActivity/AdhkarSessionAttributes.swift` (identical copy)
- Modify: `scripts/check-widget-system-surfaces.sh`
- Test: `modules/bayaan-widgets/src/__tests__/adhkarActivity.test.ts`
- Test: `modules/bayaan-widgets/src/__tests__/adhkarActivityBridge.test.ts`

**Interfaces:**
- Consumes: `isRecord` from `./guards`; `ActivityStartResult` and `isActivityStartResult` from `./liveActivity`; `NowPlayingActivityBridge.isSupported` (Swift).
- Produces (exported from `bayaan-widgets`):
  - `interface AdhkarSessionActivityState {listTitle: string; preview: string; position: number; total: number; isPlaying: boolean}`
  - `isAdhkarSessionActivityState(value: unknown): value is AdhkarSessionActivityState`
  - `startAdhkarSessionActivity(state: AdhkarSessionActivityState, staleAt: number): Promise<ActivityStartResult>`
  - `updateAdhkarSessionActivity(state: AdhkarSessionActivityState, staleAt: number): Promise<boolean>`
  - `endAdhkarSessionActivities(): Promise<void>`
- Produces (Swift, both targets): `struct AdhkarSessionActivityState` with `positionLabel` ("4 of 23") and `shortPositionLabel` ("4/23"); `struct AdhkarSessionAttributes: ActivityAttributes`.

There is no `currentAdhkarSessionActivity()`: spec section 8 ends a surviving adhkar activity at the next launch, so nothing adopts one (Task 5).

- [ ] **Step 1: Write the fixture**

```json
[
  {
    "listTitle": "Morning Adhkar",
    "preview": "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ",
    "position": 4,
    "total": 23,
    "isPlaying": true
  },
  {
    "listTitle": "أذكار المساء",
    "preview": "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ",
    "position": 23,
    "total": 23,
    "isPlaying": false
  }
]
```

Save it as `modules/bayaan-widgets/src/__fixtures__/adhkarActivity.states.json`.

- [ ] **Step 2: Write the failing TS tests**

```ts
// modules/bayaan-widgets/src/__tests__/adhkarActivity.test.ts
import states from '../__fixtures__/adhkarActivity.states.json';
import {isAdhkarSessionActivityState} from '../adhkarActivity';

describe('isAdhkarSessionActivityState', () => {
  it('accepts the shared fixtures', () => {
    expect(states.every(isAdhkarSessionActivityState)).toBe(true);
  });

  it('rejects missing fields, non-integer positions and non objects', () => {
    const {total: _total, ...noTotal} = states[0];
    expect(isAdhkarSessionActivityState(noTotal)).toBe(false);
    expect(isAdhkarSessionActivityState({...states[0], position: 1.5})).toBe(
      false,
    );
    expect(isAdhkarSessionActivityState({...states[0], isPlaying: 'yes'})).toBe(
      false,
    );
    expect(isAdhkarSessionActivityState(null)).toBe(false);
    expect(isAdhkarSessionActivityState([])).toBe(false);
  });
});
```

```ts
// modules/bayaan-widgets/src/__tests__/adhkarActivityBridge.test.ts
import type {NativeBayaanWidgetsModule} from '../NativeBayaanWidgets';
import states from '../__fixtures__/adhkarActivity.states.json';
import {
  endAdhkarSessionActivities,
  startAdhkarSessionActivity,
  updateAdhkarSessionActivity,
} from '../index';
import {
  isAdhkarSessionActivityState,
  type AdhkarSessionActivityState,
} from '../adhkarActivity';

let mockNative: Partial<NativeBayaanWidgetsModule> | null = null;

jest.mock('../NativeBayaanWidgets', () => ({
  get NativeBayaanWidgets(): Partial<NativeBayaanWidgetsModule> | null {
    return mockNative;
  },
}));

function state(): AdhkarSessionActivityState {
  const value: unknown = states[0];
  if (!isAdhkarSessionActivityState(value)) throw new Error('bad fixture');
  return value;
}

describe('adhkar Live Activity wrappers', () => {
  beforeEach(() => {
    mockNative = null;
  });

  it('degrade without the native module', async () => {
    await expect(startAdhkarSessionActivity(state(), 1)).resolves.toBe(
      'unavailable',
    );
    await expect(updateAdhkarSessionActivity(state(), 1)).resolves.toBe(false);
    await expect(endAdhkarSessionActivities()).resolves.toBeUndefined();
  });

  it('degrade when the functions are absent (Android)', async () => {
    mockNative = {writeSnapshot: jest.fn()};
    await expect(startAdhkarSessionActivity(state(), 1)).resolves.toBe(
      'unavailable',
    );
    await expect(updateAdhkarSessionActivity(state(), 1)).resolves.toBe(false);
    await expect(endAdhkarSessionActivities()).resolves.toBeUndefined();
  });

  it('pass JSON and the stale time, and parse the result', async () => {
    const start = jest.fn(async () => 'started');
    const update = jest.fn(async () => true);
    const end = jest.fn(async () => undefined);
    mockNative = {
      startAdhkarSessionActivity: start,
      updateAdhkarSessionActivity: update,
      endAdhkarSessionActivities: end,
    };
    await expect(startAdhkarSessionActivity(state(), 42)).resolves.toBe(
      'started',
    );
    expect(start).toHaveBeenCalledWith(JSON.stringify(state()), 42);
    await expect(updateAdhkarSessionActivity(state(), 43)).resolves.toBe(true);
    expect(update).toHaveBeenCalledWith(JSON.stringify(state()), 43);
    await endAdhkarSessionActivities();
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('maps an unknown native result to error', async () => {
    mockNative = {startAdhkarSessionActivity: jest.fn(async () => 'weird')};
    await expect(startAdhkarSessionActivity(state(), 1)).resolves.toBe(
      'error',
    );
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx jest modules/bayaan-widgets/src/__tests__/adhkarActivity.test.ts modules/bayaan-widgets/src/__tests__/adhkarActivityBridge.test.ts`
Expected: FAIL, `../adhkarActivity` does not exist.

- [ ] **Step 4: Implement the TS side**

```ts
// modules/bayaan-widgets/src/adhkarActivity.ts
// Content state of the adhkar session Live Activity. Field names match
// AdhkarSessionActivityState.swift (identical copies in modules/bayaan-widgets/ios
// and targets/widgets/LiveActivity); both decode
// __fixtures__/adhkarActivity.states.json.
import {isRecord} from './guards';

export interface AdhkarSessionActivityState {
  listTitle: string; // already localized, as the lock screen title shows it
  preview: string; // first 60 characters of the clean Arabic
  position: number; // 1-based
  total: number;
  isPlaying: boolean;
}

export function isAdhkarSessionActivityState(
  value: unknown,
): value is AdhkarSessionActivityState {
  return (
    isRecord(value) &&
    typeof value.listTitle === 'string' &&
    typeof value.preview === 'string' &&
    Number.isInteger(value.position) &&
    Number.isInteger(value.total) &&
    typeof value.isPlaying === 'boolean'
  );
}
```

In `modules/bayaan-widgets/src/NativeBayaanWidgets.ts`, after `endNowPlayingActivities?(): Promise<void>;` add:

```ts
  // iOS only (absent on Android): the adhkar session Live Activity.
  startAdhkarSessionActivity?(json: string, staleAtMs: number): Promise<string>;
  updateAdhkarSessionActivity?(
    json: string,
    staleAtMs: number,
  ): Promise<boolean>;
  endAdhkarSessionActivities?(): Promise<void>;
```

In `modules/bayaan-widgets/src/index.ts`, add the type import and the re-export next to the `./liveActivity` ones:

```ts
import type {AdhkarSessionActivityState} from './adhkarActivity';
```

```ts
export * from './adhkarActivity';
```

and append after `endNowPlayingActivities()`:

```ts
export async function startAdhkarSessionActivity(
  state: AdhkarSessionActivityState,
  staleAt: number,
): Promise<ActivityStartResult> {
  const native = NativeBayaanWidgets;
  if (!native?.startAdhkarSessionActivity) return 'unavailable';
  const result: unknown = await native.startAdhkarSessionActivity(
    JSON.stringify(state),
    staleAt,
  );
  return isActivityStartResult(result) ? result : 'error';
}

export async function updateAdhkarSessionActivity(
  state: AdhkarSessionActivityState,
  staleAt: number,
): Promise<boolean> {
  const native = NativeBayaanWidgets;
  if (!native?.updateAdhkarSessionActivity) return false;
  return native.updateAdhkarSessionActivity(JSON.stringify(state), staleAt);
}

export async function endAdhkarSessionActivities(): Promise<void> {
  const native = NativeBayaanWidgets;
  if (!native?.endAdhkarSessionActivities) return;
  await native.endAdhkarSessionActivities();
}
```

- [ ] **Step 5: Run the TS tests**

Run: `npx jest modules/bayaan-widgets`
Expected: PASS.

- [ ] **Step 6: Write the two Swift copies**

Write this file to both `modules/bayaan-widgets/ios/AdhkarSessionActivityState.swift` and `targets/widgets/LiveActivity/AdhkarSessionActivityState.swift`, byte for byte:

```swift
// AdhkarSessionActivityState.swift
// Two identical copies: modules/bayaan-widgets/ios (starts and updates the
// Live Activity) and targets/widgets/LiveActivity (renders it). Field names
// match modules/bayaan-widgets/src/adhkarActivity.ts.
// scripts/check-widget-system-surfaces.sh fails if the copies differ.
import Foundation

struct AdhkarSessionActivityState: Codable, Hashable {
  let listTitle: String
  /// First 60 characters of the clean Arabic of the current dhikr.
  let preview: String
  /// 1-based.
  let position: Int
  let total: Int
  let isPlaying: Bool

  /// "4 of 23". English like the Now Playing "Ayah 10 of 110": the extension
  /// has no string catalog.
  var positionLabel: String { "\(position) of \(total)" }
  /// "4/23", for the compact Dynamic Island.
  var shortPositionLabel: String { "\(position)/\(total)" }
}
```

Write this file to both `modules/bayaan-widgets/ios/AdhkarSessionAttributes.swift` and `targets/widgets/LiveActivity/AdhkarSessionAttributes.swift`, byte for byte:

```swift
// AdhkarSessionAttributes.swift
// Two identical copies: modules/bayaan-widgets/ios (starts and updates the
// Live Activity) and targets/widgets/LiveActivity (renders it). ActivityKit
// pairs them by type name. scripts/check-widget-system-surfaces.sh fails if
// the copies differ.
import ActivityKit
import Foundation

struct AdhkarSessionAttributes: ActivityAttributes {
  typealias ContentState = AdhkarSessionActivityState
}
```

Make each copy with the shell so they cannot drift:

```bash
cp modules/bayaan-widgets/ios/AdhkarSessionActivityState.swift targets/widgets/LiveActivity/AdhkarSessionActivityState.swift
cp modules/bayaan-widgets/ios/AdhkarSessionAttributes.swift targets/widgets/LiveActivity/AdhkarSessionAttributes.swift
```

- [ ] **Step 7: Write the bridge**

```swift
// modules/bayaan-widgets/ios/AdhkarSessionActivityBridge.swift
import ActivityKit
import Foundation
import UIKit

/// Starts, updates and ends the adhkar session Live Activity for the JS layer.
/// The widget extension renders it (targets/widgets/LiveActivity). Same
/// contract as NowPlayingActivityBridge, on its own ActivityKit type, so
/// ending one never ends the other.
enum AdhkarSessionActivityBridge {
  private static func decode(_ json: String) -> AdhkarSessionActivityState? {
    guard let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(AdhkarSessionActivityState.self, from: data)
  }

  private static func content(_ state: AdhkarSessionActivityState, staleAtMs: Double)
    -> ActivityContent<AdhkarSessionActivityState>
  {
    ActivityContent(state: state, staleDate: Date(timeIntervalSince1970: staleAtMs / 1000))
  }

  /// The adhkar activity still on screen, if any.
  private static var current: Activity<AdhkarSessionAttributes>? {
    Activity<AdhkarSessionAttributes>.activities.first {
      $0.activityState == .active || $0.activityState == .stale
    }
  }

  /// Returns "started", "updated" (one already existed), "deferred" (the request
  /// failed while the app was not active; JS retries on foreground), "disabled",
  /// "unsupported", "invalid" or "error".
  @MainActor
  static func start(_ json: String, staleAtMs: Double) async -> String {
    // The extension that renders activities targets iOS 17.
    guard NowPlayingActivityBridge.isSupported else { return "unsupported" }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return "disabled" }
    guard let state = decode(json) else { return "invalid" }
    if let activity = current {
      await activity.update(content(state, staleAtMs: staleAtMs))
      return "updated"
    }
    do {
      _ = try Activity.request(
        attributes: AdhkarSessionAttributes(),
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
    for activity in Activity<AdhkarSessionAttributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }
}
```

In `modules/bayaan-widgets/ios/BayaanWidgetsModule.swift`, after the `endNowPlayingActivities` function add:

```swift
    AsyncFunction("startAdhkarSessionActivity") { (json: String, staleAtMs: Double) async -> String in
      await AdhkarSessionActivityBridge.start(json, staleAtMs: staleAtMs)
    }

    AsyncFunction("updateAdhkarSessionActivity") { (json: String, staleAtMs: Double) async -> Bool in
      await AdhkarSessionActivityBridge.update(json, staleAtMs: staleAtMs)
    }

    AsyncFunction("endAdhkarSessionActivities") { () async in
      await AdhkarSessionActivityBridge.endAll()
    }
```

The pod's `source_files = '**/*.swift'` picks the new files up on the next `pod install` (the controller's native build). The widget target uses a synchronized folder group, so no `project.pbxproj` edit is needed and none may be committed.

- [ ] **Step 8: Extend the check script**

In `scripts/check-widget-system-surfaces.sh`, after the two existing `cmp` lines add:

```bash
cmp "$root/modules/bayaan-widgets/ios/AdhkarSessionActivityState.swift" \
    "$root/targets/widgets/LiveActivity/AdhkarSessionActivityState.swift"
cmp "$root/modules/bayaan-widgets/ios/AdhkarSessionAttributes.swift" \
    "$root/targets/widgets/LiveActivity/AdhkarSessionAttributes.swift"
```

Add the state file to the concatenated test source (it imports only Foundation; the attributes file imports ActivityKit and stays out, like `NowPlayingAttributes.swift`):

```bash
cat "$root/targets/widgets/LiveActivity/NowPlayingActivityState.swift" \
    "$root/targets/widgets/LiveActivity/AdhkarSessionActivityState.swift" \
    "$root/targets/widgets/_shared/WidgetSnapshot.swift" \
    "$root/targets/widgets/_shared/SurahCatalog.swift" \
    "$root/targets/widgets/_shared/SurahSynonyms.swift" \
    "$root/targets/widgets/_shared/PlaybackResume.swift" > "$tmp/surfaces-test.swift"
```

Both files start with `import Foundation`; a repeated import is valid in one Swift file.

Inside the heredoc, after the `paused fraction` precondition, add:

```swift
// Adhkar session Live Activity content state (same vectors as adhkarActivity.test.ts)
let adhkar = try! JSONDecoder().decode([AdhkarSessionActivityState].self, from: load("\(dir)/adhkarActivity.states.json"))
precondition(adhkar.count == 2 && adhkar[0].isPlaying && !adhkar[1].isPlaying, "adhkar state decode")
precondition(adhkar[0].positionLabel == "4 of 23" && adhkar[0].shortPositionLabel == "4/23", "adhkar position labels")
precondition(adhkar[1].listTitle == "أذكار المساء" && adhkar[1].preview.hasPrefix("أَمْسَيْنَا"), "adhkar Arabic decode")
```

- [ ] **Step 9: Check the Swift**

Run: `xcrun swiftc -parse modules/bayaan-widgets/ios/AdhkarSessionActivityState.swift modules/bayaan-widgets/ios/AdhkarSessionAttributes.swift modules/bayaan-widgets/ios/AdhkarSessionActivityBridge.swift modules/bayaan-widgets/ios/BayaanWidgetsModule.swift`
Expected: no output, exit 0.

Run: `bash scripts/check-widget-system-surfaces.sh`
Expected: `swift system surfaces: OK`.

- [ ] **Step 10: tsc and Prettier**

Run: `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit && node node_modules/prettier/bin/prettier.cjs --check modules/bayaan-widgets/src/adhkarActivity.ts modules/bayaan-widgets/src/NativeBayaanWidgets.ts modules/bayaan-widgets/src/index.ts modules/bayaan-widgets/src/__fixtures__/adhkarActivity.states.json modules/bayaan-widgets/src/__tests__/adhkarActivity.test.ts modules/bayaan-widgets/src/__tests__/adhkarActivityBridge.test.ts`
Expected: clean.

- [ ] **Step 11: Commit**

```bash
git add modules/bayaan-widgets/src modules/bayaan-widgets/ios targets/widgets/LiveActivity/AdhkarSessionActivityState.swift targets/widgets/LiveActivity/AdhkarSessionAttributes.swift scripts/check-widget-system-surfaces.sh
git commit -m "feat(widgets): adhkar session Live Activity contract and native bridge

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011eqXmha1bR7cUTY365d9K1"
```

---

### Task 3: Adhkar Live Activity views

**Files:**
- Create: `targets/widgets/LiveActivity/AdhkarSessionLiveActivity.swift`
- Create: `targets/widgets/LiveActivity/LiveActivities.swift`
- Modify: `targets/widgets/WidgetsBundle.swift`

**Interfaces:**
- Consumes: `AdhkarSessionAttributes`, `AdhkarSessionActivityState` (Task 2); `AppLinks.url(_:)` (`targets/widgets/_shared/AppIdentity.swift`); `WidgetPalette.background` (`Support/WidgetChrome.swift`); `BayaanLogo` (`BayaanMark.swift`); `NowPlayingLiveActivity`.
- Produces: `struct AdhkarSessionLiveActivity: Widget`; `struct LiveActivities: WidgetBundle`.

Design, per spec section 7:
- **Lock screen:** bars, the list title and "4 of 23" on the left, a play-state glyph on the right, and the Arabic preview right to left below, in the system font (SF Arabic). Same background, white text and corner logo as the Now Playing activity.
- **Dynamic Island:** compact leading bars and trailing "4/23"; minimal bars; expanded shows the lock screen content across leading, center, trailing and bottom.
- **Bars:** three static capsules (a Live Activity cannot run a custom animation). Full white while playing, 45% white while paused.
- **No buttons:** expo-audio offers no remote command for adhkar, so the whole activity is a tap target to `adhkar-playing`.

- [ ] **Step 1: Write the views**

```swift
// targets/widgets/LiveActivity/AdhkarSessionLiveActivity.swift
import ActivityKit
import SwiftUI
import WidgetKit

private let adhkarPlayingURL = AppLinks.url("adhkar-playing")!

/// Adhkar session Live Activity: Lock Screen (also StandBy) and Dynamic Island.
/// Started and updated by the app (AdhkarSessionActivityBridge). It has no
/// buttons; a tap opens the reader at the playing dhikr.
struct AdhkarSessionLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: AdhkarSessionAttributes.self) { context in
      AdhkarLockScreenView(state: context.state)
        .activityBackgroundTint(WidgetPalette.background)
        .activitySystemActionForegroundColor(.white)
        .widgetURL(adhkarPlayingURL)
    } dynamicIsland: { context in
      let state = context.state
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          AdhkarBars(isPlaying: state.isPlaying, height: 22).padding(.leading, 8)
        }
        DynamicIslandExpandedRegion(.center) {
          AdhkarTitles(state: state)
        }
        DynamicIslandExpandedRegion(.trailing) {
          AdhkarPlayStateGlyph(isPlaying: state.isPlaying).padding(.trailing, 8)
        }
        DynamicIslandExpandedRegion(.bottom) {
          AdhkarPreview(text: state.preview, lines: 2).padding(.horizontal, 8)
        }
      } compactLeading: {
        AdhkarBars(isPlaying: state.isPlaying, height: 14)
      } compactTrailing: {
        Text(state.shortPositionLabel)
          .font(.caption2.monospacedDigit())
          .foregroundStyle(.white)
      } minimal: {
        AdhkarBars(isPlaying: state.isPlaying, height: 12)
      }
      .widgetURL(adhkarPlayingURL)
      .keylineTint(.white)
    }
  }
}

struct AdhkarLockScreenView: View {
  let state: AdhkarSessionActivityState

  var body: some View {
    VStack(spacing: 10) {
      HStack(spacing: 12) {
        AdhkarBars(isPlaying: state.isPlaying, height: 22)
        AdhkarTitles(state: state)
        AdhkarPlayStateGlyph(isPlaying: state.isPlaying)
      }
      AdhkarPreview(text: state.preview, lines: 2)
    }
    .padding(14)
    .overlay(alignment: .topTrailing) {
      BayaanLogo(size: 12).padding(8)
    }
  }
}

/// List title and "4 of 23".
struct AdhkarTitles: View {
  let state: AdhkarSessionActivityState

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(state.listTitle)
        .font(.headline)
        .foregroundStyle(.white)
        .lineLimit(1)
      Text(state.positionLabel)
        .font(.subheadline.monospacedDigit())
        .foregroundStyle(.white.opacity(0.75))
        .lineLimit(1)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// The current dhikr's opening, right to left, in the system Arabic font.
struct AdhkarPreview: View {
  let text: String
  let lines: Int

  var body: some View {
    Text(text)
      .font(.system(size: 17))
      .foregroundStyle(.white)
      .lineLimit(lines)
      .multilineTextAlignment(.leading)
      .frame(maxWidth: .infinity, alignment: .leading)
      // Leading is the right edge here.
      .environment(\.layoutDirection, .rightToLeft)
  }
}

/// Shows the state, not an action: the activity has no buttons.
struct AdhkarPlayStateGlyph: View {
  let isPlaying: Bool

  var body: some View {
    Image(systemName: isPlaying ? "play.fill" : "pause.fill")
      .font(.system(size: 15, weight: .semibold))
      .foregroundStyle(.white.opacity(0.75))
      .frame(width: 28, height: 28)
      .accessibilityLabel(isPlaying ? "Playing" : "Paused")
  }
}

/// Three static bars, the app's playing indicator. Dimmed while paused.
struct AdhkarBars: View {
  let isPlaying: Bool
  let height: CGFloat

  private static let fractions: [CGFloat] = [0.55, 1, 0.75]

  var body: some View {
    HStack(alignment: .bottom, spacing: height * 0.14) {
      ForEach(Self.fractions.indices, id: \.self) { i in
        Capsule()
          .fill(.white.opacity(isPlaying ? 1 : 0.45))
          .frame(width: height * 0.2, height: height * Self.fractions[i])
      }
    }
    .frame(height: height, alignment: .bottom)
    .accessibilityHidden(true)
  }
}

private extension AdhkarSessionActivityState {
  static var previewPlaying: AdhkarSessionActivityState {
    AdhkarSessionActivityState(
      listTitle: "Morning Adhkar",
      preview: "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ",
      position: 4, total: 23, isPlaying: true)
  }

  static var previewPaused: AdhkarSessionActivityState {
    AdhkarSessionActivityState(
      listTitle: "أذكار المساء",
      preview: "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ",
      position: 23, total: 23, isPlaying: false)
  }
}

#Preview("Lock Screen", as: .content, using: AdhkarSessionAttributes()) {
  AdhkarSessionLiveActivity()
} contentStates: {
  AdhkarSessionActivityState.previewPlaying
  AdhkarSessionActivityState.previewPaused
}

#Preview("Expanded", as: .dynamicIsland(.expanded), using: AdhkarSessionAttributes()) {
  AdhkarSessionLiveActivity()
} contentStates: {
  AdhkarSessionActivityState.previewPlaying
}

#Preview("Compact", as: .dynamicIsland(.compact), using: AdhkarSessionAttributes()) {
  AdhkarSessionLiveActivity()
} contentStates: {
  AdhkarSessionActivityState.previewPlaying
  AdhkarSessionActivityState.previewPaused
}

#Preview("Minimal", as: .dynamicIsland(.minimal), using: AdhkarSessionAttributes()) {
  AdhkarSessionLiveActivity()
} contentStates: {
  AdhkarSessionActivityState.previewPlaying
}
```

- [ ] **Step 2: Nest both activities in one bundle**

```swift
// targets/widgets/LiveActivity/LiveActivities.swift
import SwiftUI
import WidgetKit

/// The Live Activities, nested because a WidgetBundleBuilder takes at most 10
/// children and BayaanWidgetsBundle is full (P3-R16). The Now Playing activity
/// stays registered although Quran playback no longer starts it
/// (services/widgets/live-activity/config.ts). WidgetsBundle.swift compiles
/// this bundle out with BAYAAN_NO_WIDGET_LIVE_ACTIVITY; the adhkar activity
/// also follows BAYAAN_NO_FEATURE_ADHKAR (RFC-021).
struct LiveActivities: WidgetBundle {
  var body: some Widget {
    NowPlayingLiveActivity()
    #if !BAYAAN_NO_FEATURE_ADHKAR
    AdhkarSessionLiveActivity()
    #endif
  }
}
```

In `targets/widgets/WidgetsBundle.swift`, replace:

```swift
    #if !BAYAAN_NO_WIDGET_LIVE_ACTIVITY
    NowPlayingLiveActivity()
    #endif
```

with:

```swift
    #if !BAYAAN_NO_WIDGET_LIVE_ACTIVITY
    LiveActivities().body
    #endif
```

The child count of `BayaanWidgetsBundle` stays at 10.

- [ ] **Step 3: Check the Swift**

Run: `xcrun swiftc -parse targets/widgets/LiveActivity/AdhkarSessionLiveActivity.swift targets/widgets/LiveActivity/LiveActivities.swift targets/widgets/WidgetsBundle.swift`
Expected: no output, exit 0. (`-parse` checks syntax only. Types are checked by the controller's native build; the names used here all exist in the extension.)

Run: `bash scripts/check-widget-system-surfaces.sh`
Expected: `swift system surfaces: OK`.

- [ ] **Step 4: Commit**

```bash
git add targets/widgets/LiveActivity/AdhkarSessionLiveActivity.swift targets/widgets/LiveActivity/LiveActivities.swift targets/widgets/WidgetsBundle.swift
git commit -m "feat(widgets): adhkar session Live Activity views

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011eqXmha1bR7cUTY365d9K1"
```

---

### Task 4: Pure adhkar activity policy

**Files:**
- Create: `services/widgets/live-activity/planAdhkarActivity.ts`
- Test: `services/widgets/live-activity/__tests__/planAdhkarActivity.test.ts`

**Interfaces:**
- Consumes: `AdhkarSession` from `@/services/adhkar/playback/types`; `AdhkarSessionActivityState`, `ActivityStartResult` from `bayaan-widgets`.
- Produces:
  - `ADHKAR_PAUSED_END_MS`, `ADHKAR_PLAYING_STALE_MS`
  - `interface AdhkarActivityMemory {live: boolean; last: AdhkarSessionActivityState | null; sessionKey: string | null; suppressedSession: string | null}` and `INITIAL_ADHKAR_ACTIVITY_MEMORY`
  - `type AdhkarActivityPlan = {kind: 'start' | 'update'; key: string; state: AdhkarSessionActivityState; staleAt: number} | {kind: 'end'} | {kind: 'reset'} | {kind: 'none'}`
  - `adhkarActivityState(session: AdhkarSession): AdhkarSessionActivityState | null`
  - `adhkarSessionKey(session: AdhkarSession): string`
  - `adhkarStaleAt(session: AdhkarSession, now: number): number`
  - `planAdhkarActivity(memory: AdhkarActivityMemory, session: AdhkarSession | null, now: number, otherSourceActive: boolean): AdhkarActivityPlan`
  - `afterAdhkarStart(memory, key, state, result: ActivityStartResult): AdhkarActivityMemory`
  - `afterAdhkarUpdate(memory, key, state, ok: boolean): AdhkarActivityMemory`
  - `afterAdhkarEnd(): AdhkarActivityMemory`

Rules:
- **Start** when a session is `playing` (the first confirmed play, not `loading`), nothing is live, and the session is not suppressed.
- **Update** a live activity when the shown state (title, preview, position, total, play state) or the session changes. `loading` counts as playing, so a track change does not flash "paused".
- **End** a live activity when the session is gone; when it is paused and another source (main or mushaf) is active; or when it has been paused 15 minutes (`now - lastActiveAt`, which the reducer stamps on every pause).
- **Suppress** a session when its start is refused or its update finds the activity gone (dismissed). Suppression lasts until the session changes (`adhkarSessionKey`) or ends (`reset`).
- **Session identity:** the reducer has no session id. An `all` session is identified by its list and mode; a `single` session also by its dhikr, because a card in the same list starts a new single session (rule 1) while a single session never changes its index.
- **Stale date:** 10 minutes after the update while playing; the 15-minute end while paused.

- [ ] **Step 1: Write the failing tests**

```ts
// services/widgets/live-activity/__tests__/planAdhkarActivity.test.ts
import type {
  AdhkarSession,
  SessionItem,
} from '@/services/adhkar/playback/types';
import {
  ADHKAR_PAUSED_END_MS,
  ADHKAR_PLAYING_STALE_MS,
  INITIAL_ADHKAR_ACTIVITY_MEMORY,
  adhkarActivityState,
  adhkarSessionKey,
  adhkarStaleAt,
  afterAdhkarEnd,
  afterAdhkarStart,
  afterAdhkarUpdate,
  planAdhkarActivity,
  type AdhkarActivityMemory,
} from '../planAdhkarActivity';

const NOW = 10_000_000;

function item(id: string): SessionItem {
  return {
    dhikrId: id,
    audioFile: `${id}.mp3`,
    playable: true,
    preview: `preview ${id}`,
  };
}

function session(over: Partial<AdhkarSession> = {}): AdhkarSession {
  return {
    listId: 'morning-adhkar',
    listTitle: 'Morning Adhkar',
    items: [item('a'), item('b'), item('c')],
    index: 0,
    mode: 'all',
    loop: false,
    status: 'playing',
    error: false,
    trackToken: 1,
    positionSec: 0,
    lastActiveAt: NOW,
    ...over,
  };
}

function liveFor(s: AdhkarSession): AdhkarActivityMemory {
  const state = adhkarActivityState(s);
  if (!state) throw new Error('expected a state');
  return {
    live: true,
    last: state,
    sessionKey: adhkarSessionKey(s),
    suppressedSession: null,
  };
}

const idle = INITIAL_ADHKAR_ACTIVITY_MEMORY;

describe('adhkarActivityState', () => {
  it('maps the current item, 1-based, and counts loading as playing', () => {
    expect(adhkarActivityState(session({index: 1, status: 'loading'}))).toEqual(
      {
        listTitle: 'Morning Adhkar',
        preview: 'preview b',
        position: 2,
        total: 3,
        isPlaying: true,
      },
    );
    expect(adhkarActivityState(session({status: 'paused'}))?.isPlaying).toBe(
      false,
    );
  });

  it('is null when the index is out of range', () => {
    expect(adhkarActivityState(session({index: 7}))).toBeNull();
  });
});

describe('adhkarSessionKey', () => {
  it('ignores the index of an all session', () => {
    expect(adhkarSessionKey(session({index: 2}))).toBe(
      adhkarSessionKey(session({index: 0})),
    );
  });

  it('includes the dhikr of a single session', () => {
    expect(adhkarSessionKey(session({mode: 'single', index: 1}))).not.toBe(
      adhkarSessionKey(session({mode: 'single', index: 2})),
    );
  });

  it('differs between lists and modes', () => {
    const base = adhkarSessionKey(session());
    expect(adhkarSessionKey(session({listId: 'evening-adhkar'}))).not.toBe(
      base,
    );
    expect(adhkarSessionKey(session({mode: 'single'}))).not.toBe(base);
  });
});

describe('adhkarStaleAt', () => {
  it('is 10 minutes out while playing or loading', () => {
    expect(adhkarStaleAt(session(), NOW + 5)).toBe(
      NOW + 5 + ADHKAR_PLAYING_STALE_MS,
    );
    expect(adhkarStaleAt(session({status: 'loading'}), NOW)).toBe(
      NOW + ADHKAR_PLAYING_STALE_MS,
    );
  });

  it('is 15 minutes after the pause while paused', () => {
    expect(
      adhkarStaleAt(session({status: 'paused', lastActiveAt: NOW}), NOW + 60_000),
    ).toBe(NOW + ADHKAR_PAUSED_END_MS);
  });
});

describe('planAdhkarActivity', () => {
  it('does nothing without a session', () => {
    expect(planAdhkarActivity(idle, null, NOW, false)).toEqual({kind: 'none'});
  });

  it('starts when a session first plays', () => {
    const s = session();
    expect(planAdhkarActivity(idle, s, NOW, false)).toEqual({
      kind: 'start',
      key: adhkarSessionKey(s),
      state: adhkarActivityState(s),
      staleAt: NOW + ADHKAR_PLAYING_STALE_MS,
    });
  });

  it('does not start a loading or paused (restored) session', () => {
    expect(
      planAdhkarActivity(idle, session({status: 'loading'}), NOW, false),
    ).toEqual({kind: 'none'});
    expect(
      planAdhkarActivity(idle, session({status: 'paused'}), NOW, false),
    ).toEqual({kind: 'none'});
  });

  it('updates on an index change', () => {
    const next = session({index: 1, status: 'loading'});
    expect(planAdhkarActivity(liveFor(session()), next, NOW, false)).toMatchObject(
      {kind: 'update', state: {position: 2, isPlaying: true}},
    );
  });

  it('updates on a play-state change', () => {
    const paused = session({status: 'paused', lastActiveAt: NOW});
    expect(planAdhkarActivity(liveFor(session()), paused, NOW, false)).toEqual({
      kind: 'update',
      key: adhkarSessionKey(paused),
      state: adhkarActivityState(paused),
      staleAt: NOW + ADHKAR_PAUSED_END_MS,
    });
  });

  it('does nothing when nothing shown changed', () => {
    const s = session();
    expect(
      planAdhkarActivity(liveFor(s), {...s, positionSec: 12}, NOW, false),
    ).toEqual({kind: 'none'});
    // loading after playing on the same row looks the same
    expect(
      planAdhkarActivity(liveFor(s), {...s, status: 'loading'}, NOW, false),
    ).toEqual({kind: 'none'});
  });

  it('ends when the session ends', () => {
    expect(planAdhkarActivity(liveFor(session()), null, NOW, false)).toEqual({
      kind: 'end',
    });
  });

  it('ends when another source took over a paused session', () => {
    const paused = session({status: 'paused'});
    expect(planAdhkarActivity(liveFor(session()), paused, NOW, true)).toEqual({
      kind: 'end',
    });
  });

  it('ignores another source while the session plays', () => {
    const s = session();
    expect(planAdhkarActivity(liveFor(s), s, NOW, true)).toEqual({
      kind: 'none',
    });
  });

  it('keeps a session the user paused until 15 minutes have passed', () => {
    const paused = session({status: 'paused', lastActiveAt: NOW});
    const memory = liveFor(paused);
    expect(
      planAdhkarActivity(memory, paused, NOW + ADHKAR_PAUSED_END_MS - 1, false),
    ).toEqual({kind: 'none'});
    expect(
      planAdhkarActivity(memory, paused, NOW + ADHKAR_PAUSED_END_MS, false),
    ).toEqual({kind: 'end'});
  });

  it('updates in place when a new session replaces a live one', () => {
    const next = session({listId: 'evening-adhkar', listTitle: 'Evening'});
    expect(
      planAdhkarActivity(liveFor(session()), next, NOW, false),
    ).toMatchObject({
      kind: 'update',
      key: adhkarSessionKey(next),
      state: {listTitle: 'Evening'},
    });
  });

  it('does not start a suppressed session, but starts a new one', () => {
    const s = session();
    const memory = {...idle, suppressedSession: adhkarSessionKey(s)};
    expect(planAdhkarActivity(memory, s, NOW, false)).toEqual({kind: 'none'});
    const other = session({listId: 'evening-adhkar'});
    expect(planAdhkarActivity(memory, other, NOW, false)).toMatchObject({
      kind: 'start',
    });
  });

  it('forgets the suppression once the session is gone', () => {
    const memory = {...idle, suppressedSession: 'x'};
    expect(planAdhkarActivity(memory, null, NOW, false)).toEqual({
      kind: 'reset',
    });
  });

  it('starts again when a session ended by a hand-off plays again', () => {
    expect(
      planAdhkarActivity(afterAdhkarEnd(), session(), NOW, false),
    ).toMatchObject({kind: 'start'});
  });
});

describe('memory transitions', () => {
  const s = session();
  const key = adhkarSessionKey(s);
  const state = adhkarActivityState(s);
  if (!state) throw new Error('expected a state');

  it('goes live after started or updated', () => {
    for (const result of ['started', 'updated'] as const) {
      expect(afterAdhkarStart(idle, key, state, result)).toEqual({
        live: true,
        last: state,
        sessionKey: key,
        suppressedSession: null,
      });
    }
  });

  it('retries a deferred start later without suppressing', () => {
    expect(afterAdhkarStart(idle, key, state, 'deferred')).toEqual(idle);
  });

  it('suppresses the session after a refused or failed start', () => {
    for (const result of [
      'disabled',
      'unsupported',
      'invalid',
      'error',
      'unavailable',
    ] as const) {
      expect(afterAdhkarStart(idle, key, state, result)).toEqual({
        ...idle,
        suppressedSession: key,
      });
    }
  });

  it('keeps a successful update and suppresses a dismissed activity', () => {
    const live = liveFor(s);
    const next = {...state, position: 2};
    expect(afterAdhkarUpdate(live, key, next, true)).toEqual({
      ...live,
      last: next,
    });
    expect(afterAdhkarUpdate(live, key, next, false)).toEqual({
      ...idle,
      suppressedSession: key,
    });
  });

  it('forgets everything after an end', () => {
    expect(afterAdhkarEnd()).toEqual(idle);
  });
});
```

`as const` on the literal arrays narrows them to `ActivityStartResult` members; that is a const assertion, not a type cast.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest services/widgets/live-activity/__tests__/planAdhkarActivity.test.ts`
Expected: FAIL, `../planAdhkarActivity` does not exist.

- [ ] **Step 3: Implement**

```ts
// services/widgets/live-activity/planAdhkarActivity.ts
// Pure adhkar session Live Activity policy (adhkar playback spec, section 7):
// session -> content state, what to ask ActivityKit for given what was last
// sent, and how each native result changes memory.
import type {
  ActivityStartResult,
  AdhkarSessionActivityState,
} from 'bayaan-widgets';
import type {AdhkarSession} from '@/services/adhkar/playback/types';

// A paused session's activity ends this long after the pause.
export const ADHKAR_PAUSED_END_MS = 15 * 60 * 1000;
// A playing activity goes stale this long after its last update (spec 8: the
// system shows it as stale if the app was killed).
export const ADHKAR_PLAYING_STALE_MS = 10 * 60 * 1000;

export interface AdhkarActivityMemory {
  live: boolean;
  // Last state sent to ActivityKit.
  last: AdhkarSessionActivityState | null;
  // adhkarSessionKey of the session the live activity shows.
  sessionKey: string | null;
  // Session whose activity was dismissed or refused; not started again until
  // the session changes or ends.
  suppressedSession: string | null;
}

export const INITIAL_ADHKAR_ACTIVITY_MEMORY: AdhkarActivityMemory = {
  live: false,
  last: null,
  sessionKey: null,
  suppressedSession: null,
};

export type AdhkarActivityPlan =
  | {
      kind: 'start' | 'update';
      key: string;
      state: AdhkarSessionActivityState;
      staleAt: number;
    }
  | {kind: 'end'}
  | {kind: 'reset'}
  | {kind: 'none'};

export function adhkarActivityState(
  session: AdhkarSession,
): AdhkarSessionActivityState | null {
  const item = session.items[session.index];
  if (!item) return null;
  return {
    listTitle: session.listTitle,
    preview: item.preview,
    position: session.index + 1,
    total: session.items.length,
    // Loading between tracks reads as playing, so the activity does not flash.
    isPlaying: session.status !== 'paused',
  };
}

/**
 * Identity of a session (the reducer has none). A single session also keys on
 * its dhikr: another card in the same list starts a new single session.
 */
export function adhkarSessionKey(session: AdhkarSession): string {
  const dhikrId =
    session.mode === 'single'
      ? (session.items[session.index]?.dhikrId ?? '')
      : '';
  return JSON.stringify([session.listId, session.mode, dhikrId]);
}

export function adhkarStaleAt(session: AdhkarSession, now: number): number {
  return session.status === 'paused'
    ? session.lastActiveAt + ADHKAR_PAUSED_END_MS
    : now + ADHKAR_PLAYING_STALE_MS;
}

function sameState(
  a: AdhkarSessionActivityState,
  b: AdhkarSessionActivityState,
): boolean {
  return (
    a.listTitle === b.listTitle &&
    a.preview === b.preview &&
    a.position === b.position &&
    a.total === b.total &&
    a.isPlaying === b.isPlaying
  );
}

export function planAdhkarActivity(
  memory: AdhkarActivityMemory,
  session: AdhkarSession | null,
  now: number,
  otherSourceActive: boolean,
): AdhkarActivityPlan {
  const state = session ? adhkarActivityState(session) : null;
  if (!session || !state) {
    if (memory.live) return {kind: 'end'};
    return memory.suppressedSession !== null ? {kind: 'reset'} : {kind: 'none'};
  }
  const key = adhkarSessionKey(session);
  if (memory.live) {
    const paused = session.status === 'paused';
    if (
      paused &&
      (otherSourceActive || now - session.lastActiveAt >= ADHKAR_PAUSED_END_MS)
    ) {
      return {kind: 'end'};
    }
    if (
      memory.sessionKey === key &&
      memory.last &&
      sameState(memory.last, state)
    ) {
      return {kind: 'none'};
    }
    return {kind: 'update', key, state, staleAt: adhkarStaleAt(session, now)};
  }
  if (session.status !== 'playing' || key === memory.suppressedSession) {
    return {kind: 'none'};
  }
  return {kind: 'start', key, state, staleAt: adhkarStaleAt(session, now)};
}

export function afterAdhkarStart(
  memory: AdhkarActivityMemory,
  key: string,
  state: AdhkarSessionActivityState,
  result: ActivityStartResult,
): AdhkarActivityMemory {
  switch (result) {
    case 'started':
    case 'updated':
      return {live: true, last: state, sessionKey: key, suppressedSession: null};
    case 'deferred':
      // The app was not active; the sync retries on foreground.
      return {...memory, live: false, last: null, sessionKey: null};
    default:
      return {...INITIAL_ADHKAR_ACTIVITY_MEMORY, suppressedSession: key};
  }
}

export function afterAdhkarUpdate(
  memory: AdhkarActivityMemory,
  key: string,
  state: AdhkarSessionActivityState,
  ok: boolean,
): AdhkarActivityMemory {
  if (ok) return {...memory, live: true, last: state, sessionKey: key};
  return {...INITIAL_ADHKAR_ACTIVITY_MEMORY, suppressedSession: key};
}

export function afterAdhkarEnd(): AdhkarActivityMemory {
  return INITIAL_ADHKAR_ACTIVITY_MEMORY;
}
```

- [ ] **Step 4: Run the tests, tsc and Prettier**

Run: `npx jest services/widgets/live-activity/__tests__/planAdhkarActivity.test.ts`
Expected: PASS.

Run: `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit && node node_modules/prettier/bin/prettier.cjs --check services/widgets/live-activity/planAdhkarActivity.ts services/widgets/live-activity/__tests__/planAdhkarActivity.test.ts`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add services/widgets/live-activity/planAdhkarActivity.ts services/widgets/live-activity/__tests__/planAdhkarActivity.test.ts
git commit -m "feat(widgets): pure adhkar Live Activity policy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011eqXmha1bR7cUTY365d9K1"
```

---

### Task 5: Coordinator subscription, sync module and wiring

**Files:**
- Modify: `services/audio/AudioCoordinator.ts`
- Test: `services/audio/__tests__/AudioCoordinator.test.ts`
- Create: `services/widgets/live-activity/syncAdhkarActivity.ts`
- Test: `services/widgets/live-activity/__tests__/syncAdhkarActivity.test.ts`
- Modify: `services/audio/ExpoAudioProvider.tsx`

**Interfaces:**
- Consumes: Task 1 `adhkarLiveActivityEnabled`; Task 2 wrappers; Task 4 policy; `useAdhkarSessionStore`; `audioCoordinator.getActiveSource()`.
- Produces:
  - `audioCoordinator.subscribe(listener: () => void): () => void`, called after every change of the active source.
  - `startAdhkarActivitySync(): () => void`
  - `reconcileAdhkarActivity(): Promise<void>` (exported for tests and the timer)

Why the coordinator subscription: when the user pauses adhkar and then starts a surah, `pauseAdhkarIfActive()` dispatches `otherAudioStarted` on a session that is already paused. The reducer returns the same state, the store does not notify, and only the source change tells the sync that Quran took over.

- [ ] **Step 1: Write the failing coordinator test**

Append inside the `describe` block of `services/audio/__tests__/AudioCoordinator.test.ts`:

```ts
  it('notifies subscribers after the active source changes', () => {
    const c = freshCoordinator();
    const seen: string[] = [];
    const unsubscribe = c.subscribe(() => seen.push(c.getActiveSource()));
    c.mainWillPlay();
    c.mainWillPlay(); // no change, no call
    c.sourceDidStop('main');
    unsubscribe();
    c.mushafWillPlay();
    expect(seen).toEqual(['main', 'none']);
  });
```

Run: `npx jest services/audio/__tests__/AudioCoordinator.test.ts`
Expected: FAIL, `c.subscribe is not a function`.

- [ ] **Step 2: Implement the subscription**

In `services/audio/AudioCoordinator.ts`, add a listener set and two methods to the class, after `private activeSource: AudioSource = 'none';`:

```ts
  private listeners = new Set<() => void>();
```

after `getActiveSource()`:

```ts
  /** Called after every change of the active source. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setActiveSource(next: AudioSource): void {
    if (this.activeSource === next) return;
    this.activeSource = next;
    this.listeners.forEach(listener => listener());
  }
```

Then replace each assignment of `this.activeSource` outside the field initializer with the helper:
- `mushafWillPlay()`: `this.activeSource = 'mushaf';` becomes `this.setActiveSource('mushaf');`
- `mainWillPlay()`: `this.activeSource = 'main';` becomes `this.setActiveSource('main');`
- `adhkarWillPlay()`: `this.activeSource = 'adhkar';` becomes `this.setActiveSource('adhkar');`
- `pauseAdhkarIfActive()`: `this.activeSource = 'none';` becomes `this.setActiveSource('none');`
- `sourceDidStop()`: `this.activeSource = 'none';` becomes `this.setActiveSource('none');`

Run: `npx jest services/audio/__tests__/AudioCoordinator.test.ts`
Expected: PASS, including the existing B1 to B4 and adhkar tests.

- [ ] **Step 3: Write the failing sync tests**

```ts
// services/widgets/live-activity/__tests__/syncAdhkarActivity.test.ts
import type {
  ActivityStartResult,
  AdhkarSessionActivityState,
} from 'bayaan-widgets';
import type {SessionSource} from '@/services/adhkar/playback/types';
import {ADHKAR_PAUSED_END_MS} from '../planAdhkarActivity';

const mockLog: string[] = [];
const mockStart = jest.fn<
  Promise<ActivityStartResult>,
  [AdhkarSessionActivityState, number]
>();
const mockUpdate = jest.fn<
  Promise<boolean>,
  [AdhkarSessionActivityState, number]
>();
const mockEnd = jest.fn<Promise<void>, []>();
let mockSupported = true;
let mockPlatformOS = 'ios';
let mockEnabled = true;
let mockActiveSource = 'adhkar';
let mockCoordinatorListener: (() => void) | null = null;
let mockAppStateListener: ((state: string) => void) | null = null;

function mockDescribe(s: AdhkarSessionActivityState): string {
  return `${s.position}/${s.total}:${s.isPlaying ? 'playing' : 'paused'}`;
}

jest.mock('bayaan-widgets', () => ({
  ...jest.requireActual('bayaan-widgets'),
  isLiveActivitySupported: () => mockSupported,
  startAdhkarSessionActivity: (s: AdhkarSessionActivityState, at: number) => {
    mockLog.push(`start:${mockDescribe(s)}`);
    return mockStart(s, at);
  },
  updateAdhkarSessionActivity: (s: AdhkarSessionActivityState, at: number) => {
    mockLog.push(`update:${mockDescribe(s)}`);
    return mockUpdate(s, at);
  },
  endAdhkarSessionActivities: () => {
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
jest.mock('../config', () => ({adhkarLiveActivityEnabled: () => mockEnabled}));
jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {
    getActiveSource: () => mockActiveSource,
    subscribe: (listener: () => void) => {
      mockCoordinatorListener = listener;
      return () => {
        mockCoordinatorListener = null;
      };
    },
  },
}));

type SyncModule = typeof import('../syncAdhkarActivity');
type Store = typeof import('@/store/adhkarSessionStore').useAdhkarSessionStore;

// The sync and the store must share one module registry.
function load(): {sync: SyncModule; store: Store} {
  let loaded: {sync: SyncModule; store: Store} | null = null;
  jest.isolateModules(() => {
    loaded = {
      sync: require('../syncAdhkarActivity'),
      store: require('@/store/adhkarSessionStore').useAdhkarSessionStore,
    };
  });
  if (!loaded) throw new Error('modules failed to load');
  return loaded;
}

const morning: SessionSource = {
  listId: 'morning-adhkar',
  listTitle: 'Morning Adhkar',
  items: ['a', 'b', 'c'].map(id => ({
    dhikrId: id,
    audioFile: `${id}.mp3`,
    playable: true,
    preview: id,
  })),
};

function confirmPlaying(store: Store): void {
  const session = store.getState().session;
  if (!session) throw new Error('expected a session');
  store.getState().dispatch({type: 'playStarted', token: session.trackToken});
}

function playAll(store: Store): void {
  store.getState().dispatch({type: 'pressPlayAll', source: morning});
  confirmPlaying(store);
}

function nextTrack(store: Store): void {
  const session = store.getState().session;
  if (!session) throw new Error('expected a session');
  store.getState().dispatch({type: 'trackEnded', token: session.trackToken});
}

describe('syncAdhkarActivity', () => {
  beforeEach(() => {
    mockLog.length = 0;
    mockStart.mockReset().mockResolvedValue('started');
    mockUpdate.mockReset().mockResolvedValue(true);
    mockEnd.mockReset().mockResolvedValue(undefined);
    mockSupported = true;
    mockPlatformOS = 'ios';
    mockEnabled = true;
    mockActiveSource = 'adhkar';
    mockCoordinatorListener = null;
    mockAppStateListener = null;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('does nothing off iOS, when unsupported, or when disabled', async () => {
    for (const setup of [
      () => (mockPlatformOS = 'android'),
      () => (mockSupported = false),
      () => (mockEnabled = false),
    ]) {
      setup();
      const {sync, store} = load();
      sync.startAdhkarActivitySync();
      playAll(store);
      await sync.reconcileAdhkarActivity();
      mockPlatformOS = 'ios';
      mockSupported = true;
      mockEnabled = true;
    }
    expect(mockLog).toEqual([]);
    expect(mockCoordinatorListener).toBeNull();
  });

  it('ends a surviving activity at start, then starts on the first play', async () => {
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual(['end']);
    store.getState().dispatch({type: 'pressPlayAll', source: morning});
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual(['end']); // loading does not start it
    confirmPlaying(store);
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual(['end', 'start:1/3:playing']);
  });

  it('updates on the next track and on pause, and ends on stop', async () => {
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    nextTrack(store);
    await sync.reconcileAdhkarActivity();
    confirmPlaying(store);
    await sync.reconcileAdhkarActivity();
    store.getState().dispatch({type: 'toggle'});
    await sync.reconcileAdhkarActivity();
    store.getState().dispatch({type: 'stop'});
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual([
      'end',
      'start:1/3:playing',
      'update:2/3:playing',
      'update:2/3:paused',
      'end',
    ]);
  });

  it('ends when Quran takes over a playing session', async () => {
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    // AudioCoordinator.mainWillPlay: the dispatch runs before the source is
    // set to main; the chained reconcile reads it after.
    mockActiveSource = 'none';
    store.getState().dispatch({type: 'otherAudioStarted'});
    mockActiveSource = 'main';
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual(['end', 'start:1/3:playing', 'end']);
  });

  it('ends when Quran starts after the user paused adhkar', async () => {
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    playAll(store);
    store.getState().dispatch({type: 'toggle'});
    await sync.reconcileAdhkarActivity();
    mockLog.length = 0;
    mockActiveSource = 'main';
    mockCoordinatorListener?.();
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual(['end']);
  });

  it('ends 15 minutes after a pause', async () => {
    jest.useFakeTimers({
      now: 1_000_000,
      doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'],
    });
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    store.getState().dispatch({type: 'toggle'});
    await sync.reconcileAdhkarActivity();
    mockLog.length = 0;
    jest.advanceTimersByTime(ADHKAR_PAUSED_END_MS - 1);
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual([]);
    jest.advanceTimersByTime(1);
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual(['end']);
  });

  it('does not restart a dismissed activity until a new session', async () => {
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    mockUpdate.mockResolvedValueOnce(false); // the user swiped it away
    nextTrack(store);
    await sync.reconcileAdhkarActivity();
    confirmPlaying(store);
    nextTrack(store);
    confirmPlaying(store);
    await sync.reconcileAdhkarActivity();
    expect(mockStart).toHaveBeenCalledTimes(1);
    store.getState().dispatch({type: 'stop'});
    await sync.reconcileAdhkarActivity();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    expect(mockStart).toHaveBeenCalledTimes(2);
  });

  it('retries a deferred start on foreground', async () => {
    mockStart.mockResolvedValueOnce('deferred');
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    mockAppStateListener?.('active');
    await sync.reconcileAdhkarActivity();
    expect(mockStart).toHaveBeenCalledTimes(2);
  });

  it('treats a rejecting native start as a failed start', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockStart.mockRejectedValue(new Error('native boom'));
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    nextTrack(store);
    confirmPlaying(store);
    await sync.reconcileAdhkarActivity();
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('stops reacting after cleanup', async () => {
    const {sync, store} = load();
    const stop = sync.startAdhkarActivitySync();
    await sync.reconcileAdhkarActivity();
    stop();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual(['end']);
    expect(mockCoordinatorListener).toBeNull();
  });
});
```

Run: `npx jest services/widgets/live-activity/__tests__/syncAdhkarActivity.test.ts`
Expected: FAIL, `../syncAdhkarActivity` does not exist.

- [ ] **Step 4: Implement the sync module**

```ts
// services/widgets/live-activity/syncAdhkarActivity.ts
// Drives the adhkar session Live Activity (adhkar playback spec, section 7)
// from the adhkar session store and the audio coordinator. The policy is
// planAdhkarActivity.ts; native calls are serialized on one chain. iOS only.
import {AppState, Platform} from 'react-native';
import {
  endAdhkarSessionActivities,
  isLiveActivitySupported,
  startAdhkarSessionActivity,
  updateAdhkarSessionActivity,
  type ActivityStartResult,
  type AdhkarSessionActivityState,
} from 'bayaan-widgets';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {audioCoordinator} from '@/services/audio/AudioCoordinator';
import {adhkarLiveActivityEnabled} from './config';
import {
  ADHKAR_PAUSED_END_MS,
  INITIAL_ADHKAR_ACTIVITY_MEMORY,
  afterAdhkarEnd,
  afterAdhkarStart,
  afterAdhkarUpdate,
  planAdhkarActivity,
  type AdhkarActivityMemory,
} from './planAdhkarActivity';

let enabled = false;
let memory: AdhkarActivityMemory = INITIAL_ADHKAR_ACTIVITY_MEMORY;
// One chain for every native call, so a start cannot race an update or end.
let chain: Promise<void> = Promise.resolve();
let pauseTimer: ReturnType<typeof setTimeout> | null = null;

function logError(error: unknown): void {
  console.error('[AdhkarActivity] Failed to sync:', error);
}

// Read inside the chained reconcile: AudioCoordinator dispatches
// otherAudioStarted before it sets the new source.
function otherSourceActive(): boolean {
  const source = audioCoordinator.getActiveSource();
  return source === 'main' || source === 'mushaf';
}

// A rejected native call counts as a failed start, so the policy suppresses
// the session instead of retrying it on every change.
async function safeStart(
  state: AdhkarSessionActivityState,
  staleAt: number,
): Promise<ActivityStartResult> {
  try {
    return await startAdhkarSessionActivity(state, staleAt);
  } catch (error) {
    logError(error);
    return 'error';
  }
}

async function safeUpdate(
  state: AdhkarSessionActivityState,
  staleAt: number,
): Promise<boolean> {
  try {
    return await updateAdhkarSessionActivity(state, staleAt);
  } catch (error) {
    logError(error);
    return false;
  }
}

// Nothing in the store marks the 15th minute of a pause, so a timer does.
// If the app is suspended the timer may not run: the stale date covers that
// and the next foreground reconcile ends the activity.
function schedulePauseEnd(now: number): void {
  if (pauseTimer) clearTimeout(pauseTimer);
  pauseTimer = null;
  const session = useAdhkarSessionStore.getState().session;
  if (!enabled || !memory.live || session?.status !== 'paused') return;
  const delay = Math.max(session.lastActiveAt + ADHKAR_PAUSED_END_MS - now, 0);
  pauseTimer = setTimeout(() => {
    reconcileAdhkarActivity().catch(logError);
  }, delay);
}

// Reads the latest session when it runs, so queued calls collapse.
async function reconcileOnce(): Promise<void> {
  if (!enabled) return;
  const session = useAdhkarSessionStore.getState().session;
  const plan = planAdhkarActivity(
    memory,
    session,
    Date.now(),
    otherSourceActive(),
  );
  switch (plan.kind) {
    case 'start':
      memory = afterAdhkarStart(
        memory,
        plan.key,
        plan.state,
        await safeStart(plan.state, plan.staleAt),
      );
      break;
    case 'update':
      memory = afterAdhkarUpdate(
        memory,
        plan.key,
        plan.state,
        await safeUpdate(plan.state, plan.staleAt),
      );
      break;
    case 'end':
      await endAdhkarSessionActivities();
      memory = afterAdhkarEnd();
      break;
    case 'reset':
      memory = INITIAL_ADHKAR_ACTIVITY_MEMORY;
      break;
    case 'none':
      break;
  }
  schedulePauseEnd(Date.now());
}

export function reconcileAdhkarActivity(): Promise<void> {
  chain = chain.then(reconcileOnce).catch(logError);
  return chain;
}

// ExpoAudioProvider starts this with the adhkar engine.
export function startAdhkarActivitySync(): () => void {
  if (
    Platform.OS !== 'ios' ||
    !adhkarLiveActivityEnabled() ||
    !isLiveActivitySupported()
  ) {
    return () => undefined;
  }
  enabled = true;
  memory = INITIAL_ADHKAR_ACTIVITY_MEMORY;
  // An activity left by a killed process shows a session that is no longer
  // playing (spec 8): end it before anything starts.
  chain = chain.then(() => endAdhkarSessionActivities()).catch(logError);
  reconcileAdhkarActivity().catch(logError);
  const unsubscribeStore = useAdhkarSessionStore.subscribe((state, prev) => {
    if (state.session !== prev.session) {
      reconcileAdhkarActivity().catch(logError);
    }
  });
  const unsubscribeCoordinator = audioCoordinator.subscribe(() => {
    reconcileAdhkarActivity().catch(logError);
  });
  const appState = AppState.addEventListener('change', next => {
    if (next === 'active') reconcileAdhkarActivity().catch(logError);
  });
  return () => {
    enabled = false;
    if (pauseTimer) clearTimeout(pauseTimer);
    pauseTimer = null;
    unsubscribeStore();
    unsubscribeCoordinator();
    appState.remove();
  };
}
```

- [ ] **Step 5: Start it with the adhkar engine**

In `services/audio/ExpoAudioProvider.tsx`:

Add the import next to the adhkar engine import:

```ts
import {startAdhkarActivitySync} from '@/services/widgets/live-activity/syncAdhkarActivity';
```

Add a module variable next to `stopAdhkarEngine`:

```ts
let stopAdhkarActivity: (() => void) | null = null;
```

In the `lockScreenSyncing` block, right after `stopAdhkarEngine = startAdhkarPlaybackEngine();`:

```ts
          stopAdhkarActivity = startAdhkarActivitySync();
```

In the cleanup `setTimeout`, right after `stopAdhkarEngine = null;`:

```ts
        stopAdhkarActivity?.();
        stopAdhkarActivity = null;
```

`services/car/__tests__/CarRoot.test.tsx` mocks `AudioCoordinator` without `subscribe`. That is safe: under jest, `isLiveActivitySupported()` is false (no native module), so the sync returns before subscribing. Step 6 runs that test to prove it.

- [ ] **Step 6: Run the tests, tsc and Prettier**

Run: `npx jest services/widgets services/audio services/car/__tests__/CarRoot.test.tsx services/adhkar`
Expected: PASS.

Run: `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit && node node_modules/prettier/bin/prettier.cjs --check services/audio/AudioCoordinator.ts services/audio/__tests__/AudioCoordinator.test.ts services/widgets/live-activity/syncAdhkarActivity.ts services/widgets/live-activity/__tests__/syncAdhkarActivity.test.ts services/audio/ExpoAudioProvider.tsx`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add services/audio/AudioCoordinator.ts services/audio/__tests__/AudioCoordinator.test.ts services/widgets/live-activity/syncAdhkarActivity.ts services/widgets/live-activity/__tests__/syncAdhkarActivity.test.ts services/audio/ExpoAudioProvider.tsx
git commit -m "feat(adhkar): Live Activity follows the adhkar session

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011eqXmha1bR7cUTY365d9K1"
```

---

### Task 6: The adhkar-playing deep link waits for the saved session

**Files:**
- Modify: `services/adhkar/playback/sessionPersistence.ts`
- Test: `services/adhkar/playback/__tests__/sessionPersistence.test.ts`
- Modify: `app/adhkar-playing.tsx`
- Test: `services/adhkar/playback/__tests__/adhkarPlayingRoute.test.tsx`

**Interfaces:**
- Consumes: `openPlayingDhikr(router, mode, current)` from Plan A.
- Produces:
  - `waitForSessionRestore(timeoutMs: number): Promise<void>`, which resolves when the launch restore settles (whatever its outcome), or after `timeoutMs`, whichever comes first. It resolves at once after a restore has already settled.
  - `restoreSavedSession()` keeps its signature and now always settles the restore, including when it throws.

The bug: a cold launch from the Live Activity mounts `app/adhkar-playing.tsx` before `ExpoAudioProvider` has run `restoreSavedSession()` (it waits for `expoAudioService.initialize()` and `lockScreenService.startSync()` first). `openPlayingDhikr` finds no session, and the route falls back to the Adhkar screen. The route waits at most 3000 ms; a warm launch has already settled, so it routes at once. The test file lives outside `app/` because expo-router treats every file there as a route.

- [ ] **Step 1: Write the failing persistence tests**

Append to `services/adhkar/playback/__tests__/sessionPersistence.test.ts`:

```ts
describe('waitForSessionRestore', () => {
  type Persistence =
    typeof import('@/services/adhkar/playback/sessionPersistence');

  // The readiness promise is module state: each test gets a fresh module.
  function fresh(): Persistence {
    let mod: Persistence | null = null;
    jest.isolateModules(() => {
      mod = require('@/services/adhkar/playback/sessionPersistence');
    });
    if (!mod) throw new Error('module failed to load');
    return mod;
  }

  afterEach(() => jest.useRealTimers());

  it('resolves once the restore settles', async () => {
    const p = fresh();
    let settled = false;
    const waiting = p.waitForSessionRestore(60_000).then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await p.restoreSavedSession(async () => null);
    await waiting;
    expect(settled).toBe(true);
  });

  it('resolves at once after a restore that already settled', async () => {
    const p = fresh();
    await p.restoreSavedSession(async () => null);
    // Fake timers after the restore (AsyncStorage stays real), and none is
    // advanced: only the settled restore can resolve it.
    jest.useFakeTimers();
    await expect(p.waitForSessionRestore(60_000)).resolves.toBeUndefined();
  });

  it('settles even when the restore throws', async () => {
    const p = fresh();
    await p.saveSession({
      ...live,
      listId: 'saved',
      status: 'paused',
      lastActiveAt: Date.now(),
    });
    await expect(
      p.restoreSavedSession(async () => {
        throw new Error('db');
      }),
    ).rejects.toThrow('db');
    await expect(p.waitForSessionRestore(60_000)).resolves.toBeUndefined();
  });

  it('resolves after the timeout when no restore runs', async () => {
    jest.useFakeTimers();
    const p = fresh();
    let settled = false;
    const waiting = p.waitForSessionRestore(3000).then(() => {
      settled = true;
    });
    jest.advanceTimersByTime(2999);
    await Promise.resolve();
    expect(settled).toBe(false);
    jest.advanceTimersByTime(1);
    await waiting;
    expect(settled).toBe(true);
  });
});
```

Run: `npx jest services/adhkar/playback/__tests__/sessionPersistence.test.ts`
Expected: FAIL, `p.waitForSessionRestore is not a function`.

- [ ] **Step 2: Implement restore readiness**

In `services/adhkar/playback/sessionPersistence.ts`, rename the existing exported `restoreSavedSession` to a private `restoreNow` (same body, drop `export` and its doc comment moves to the new wrapper), and add above it:

```ts
// Settles once per process, when the launch restore finishes (or fails).
let markRestoreSettled: () => void = () => undefined;
const restoreSettled = new Promise<void>(resolve => {
  markRestoreSettled = resolve;
});

/**
 * Resolves when the launch restore has settled, or after timeoutMs. The
 * bayaan://adhkar-playing route waits on it during a cold launch.
 */
export function waitForSessionRestore(timeoutMs: number): Promise<void> {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, timeoutMs);
    restoreSettled.then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}
```

and below `restoreNow`:

```ts
/** Rebuilds the saved session as paused, or drops it (stale, list gone, dhikr gone). */
export async function restoreSavedSession(
  loadItems: (listId: string) => Promise<SessionItem[] | null> = loadListItems,
): Promise<void> {
  try {
    await restoreNow(loadItems);
  } finally {
    markRestoreSettled();
  }
}
```

`restoreNow` takes the same `loadItems` parameter, without the default.

Run: `npx jest services/adhkar/playback/__tests__/sessionPersistence.test.ts`
Expected: PASS, the existing restore tests included.

- [ ] **Step 3: Write the failing route test**

```tsx
// services/adhkar/playback/__tests__/adhkarPlayingRoute.test.tsx
// app/adhkar-playing.tsx (tests cannot live under app/: expo-router would
// treat them as routes).
import React from 'react';
import {act, render} from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockRouter = {push: jest.fn(), replace: mockReplace};
let mockFinishRestore: () => void = () => undefined;
const mockWait = jest.fn(
  (_timeoutMs: number) =>
    new Promise<void>(resolve => {
      mockFinishRestore = resolve;
    }),
);
const mockOpen = jest.fn<boolean, [unknown, string, unknown]>();

jest.mock('expo-router', () => ({useRouter: () => mockRouter}));
jest.mock('@/services/adhkar/playback/sessionPersistence', () => ({
  waitForSessionRestore: (timeoutMs: number) => mockWait(timeoutMs),
}));
jest.mock('@/services/adhkar/playback/openPlayingDhikr', () => ({
  openPlayingDhikr: (router: unknown, mode: string, current: unknown) =>
    mockOpen(router, mode, current),
}));

import AdhkarPlayingRoute from '@/app/adhkar-playing';

beforeEach(() => {
  mockReplace.mockClear();
  mockWait.mockClear();
  mockOpen.mockReset();
});

it('waits for the saved session, then opens the playing dhikr', async () => {
  mockOpen.mockReturnValue(true);
  render(<AdhkarPlayingRoute />);
  expect(mockWait).toHaveBeenCalledWith(3000);
  expect(mockOpen).not.toHaveBeenCalled();
  await act(async () => {
    mockFinishRestore();
  });
  expect(mockOpen).toHaveBeenCalledWith(mockRouter, 'replace', null);
  expect(mockReplace).not.toHaveBeenCalled();
});

it('falls back to the Adhkar screen when no session comes back', async () => {
  mockOpen.mockReturnValue(false);
  render(<AdhkarPlayingRoute />);
  await act(async () => {
    mockFinishRestore();
  });
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)/(a.home)/adhkar');
});

it('does not navigate after it unmounts', async () => {
  mockOpen.mockReturnValue(false);
  const {unmount} = render(<AdhkarPlayingRoute />);
  unmount();
  await act(async () => {
    mockFinishRestore();
  });
  expect(mockOpen).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});
```

Run: `npx jest services/adhkar/playback/__tests__/adhkarPlayingRoute.test.tsx`
Expected: FAIL, `mockWait` is never called (the route routes synchronously).

- [ ] **Step 4: Make the route wait**

Replace `app/adhkar-playing.tsx` with:

```tsx
// bayaan://adhkar-playing (lock screen, Live Activity): the playing dhikr's
// reader, or the Adhkar screen when nothing is playing or saved. A cold launch
// mounts this before the saved session is restored, so it waits for the
// restore first (at most RESTORE_WAIT_MS).
import {useEffect} from 'react';
import {useRouter} from 'expo-router';
import {openPlayingDhikr} from '@/services/adhkar/playback/openPlayingDhikr';
import {waitForSessionRestore} from '@/services/adhkar/playback/sessionPersistence';

const RESTORE_WAIT_MS = 3000;

export default function AdhkarPlayingRoute(): null {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    waitForSessionRestore(RESTORE_WAIT_MS).then(() => {
      if (cancelled) return;
      if (!openPlayingDhikr(router, 'replace', null)) {
        router.replace('/(tabs)/(a.home)/adhkar');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router]);
  return null;
}
```

- [ ] **Step 5: Run the tests, tsc and Prettier**

Run: `npx jest services/adhkar`
Expected: PASS.

Run: `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit && node node_modules/prettier/bin/prettier.cjs --check services/adhkar/playback/sessionPersistence.ts services/adhkar/playback/__tests__/sessionPersistence.test.ts app/adhkar-playing.tsx services/adhkar/playback/__tests__/adhkarPlayingRoute.test.tsx`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add services/adhkar/playback/sessionPersistence.ts services/adhkar/playback/__tests__/sessionPersistence.test.ts app/adhkar-playing.tsx services/adhkar/playback/__tests__/adhkarPlayingRoute.test.tsx
git commit -m "fix(adhkar): adhkar-playing waits for the saved session on a cold launch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011eqXmha1bR7cUTY365d9K1"
```

---

## Final verification (controller)

After Task 6, on the whole branch:

1. `npx jest --watchAll=false` passes. `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit` is clean. `npm run test:widget-fixtures` prints `swift system surfaces: OK`. `npm run i18n:check` passes (no JS strings were added; it guards against an accidental one).
2. `perl -CSD -ne 'print "$ARGV:$.: $_" if /\x{2014}/' <every changed file>` finds nothing.
3. `git status --short ios android` shows no staged drift. `pod install` and the native build pick up the new Swift files; their `ios/` changes stay uncommitted.
4. Native build to "Bayaan Widgets" (iOS 26) and the device, with Osman's go-ahead:
   - Start a surah: no Live Activity appears, and the lock screen player does. An activity left by the old build ends on the first launch.
   - Play All in Morning: the activity appears on the lock screen and in the Dynamic Island with the title, the Arabic preview right to left, "1 of N" and the play glyph. Compact shows the bars and "1/N", minimal the bars.
   - Auto-advance with the screen locked: the position and preview update.
   - Pause: the glyph and bars change. Start a surah: the activity ends.
   - Swipe the activity away while playing: it does not come back for that session; a new Play All shows it again.
   - Kill the app while adhkar plays, tap the activity: the app cold-launches into the reader at the playing dhikr, not the Adhkar screen.
   - Android emulator: adhkar plays as before, nothing new appears and nothing logs errors.
