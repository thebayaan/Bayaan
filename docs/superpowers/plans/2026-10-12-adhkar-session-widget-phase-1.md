# Adhkar Session Widget (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the medium and large Adhkar widgets (iOS and Android) into an interactive morning/evening session: card through every dhikr, count repetitions on a ring, and tap through to the adhkar screen scrolled to the current dhikr.

**Architecture:** The generator emits the full ordered dhikr list per period, with precomputed medium and large display text, into the existing `adhkar-periods.json`. A pure session reducer (Swift and Kotlin, pinned by one shared vectors file) drives the state. That state lives in the app group (iOS UserDefaults, Android `bayaan_widgets` prefs) and is mutated by widget intents/actions. Completion events queue in the app group, and the app drains them on refresh into `trackAdhkarSessionCompleted`.

**Tech Stack:** SwiftUI WidgetKit + App Intents (iOS 17), Jetpack Glance (Android), TypeScript generator (tsx), Jest, JUnit, a Swift script check (`scripts/check-widget-content.sh`).

**Spec:** `docs/superpowers/specs/2026-10-12-adhkar-session-widget-design.md`

## Global Constraints

- Work on branch `feat/adhkar-session-widget`, created from `feat/widgets-trim-hijri-occasions` (it already makes the small Adhkar title English only and drops the Hijri/Occasion widgets). The PR targets `develop`.
- iOS and Android ship together with identical behavior. There are no swipe gestures, only buttons.
- The small Adhkar widget is unchanged.
- Never use the em dash character anywhere: code, comments, copy, commits.
- Do not commit `ios/Bayaan.xcodeproj/project.pbxproj`, `ios/Bayaan/Info.plist`, `ios/Podfile.lock` or `ios/ShareExtension/PrivacyInfo.xcprivacy`, which hold local version-sync and pod drift. Stage files by explicit path only. Never use bare `git stash`.
- Do not touch unrelated code. Match the surrounding style and comment density.
- Before calling any task done: `npx tsc --noEmit` and `npx prettier --write <changed js/ts files>` are clean.
- TypeScript: strict, no `any`, no `as` casts, explicit parameter and return types, the `function` keyword for pure functions, type guards for parsing.
- Commit message footer:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011eqXmha1bR7cUTY365d9K1
  ```
- Do not install builds on physical devices. Never touch the simulators named "(test)" or "(test 2)". Do not kill the BayaanAAOS15 emulator.
- iOS compile check (Xcode 27):
  ```
  xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release -sdk iphonesimulator -derivedDataPath /private/tmp/claude-501/-Users-osmansaeday-orca-workspaces-Bayaan-widgets/c0503663-a396-4272-91ae-d9723ef577f3/scratchpad/adhkardd build
  ```
  If Pods fail on a deployment target below 15, run `perl -pi -e 's/IPHONEOS_DEPLOYMENT_TARGET = (\d+)(\.\d+)?;/($1<15)?"IPHONEOS_DEPLOYMENT_TARGET = 16.4;":$&/e' ios/Pods/Pods.xcodeproj/project.pbxproj` (a generated, gitignored file). New Swift files under `targets/widgets/` need `npx expo prebuild -p ios --no-install` before xcodebuild sees them. Prebuild rewrites the four files listed above, and they still must not be committed.
- Android checks:
  - Unit tests: `cd android && ./gradlew :bayaan-widgets:testDebugUnitTest`.
  - Compile: `cd android && ./gradlew :bayaan-widgets:compileDebugKotlin`.

## Review Focus

1. **Session crosses midnight during the evening period.** Evening runs from 12:00 to 03:59 the next day. A session must not reset at 00:00. `sessionDay` shifts by 4 hours; this is pinned by a vector in Task 2.
2. **Data changes under a stored session.** If a stored index is past the end of the list (for example after an app update shortens it), resolve to a fresh session rather than crashing. Pinned by a vector in Task 2.
3. **Taps after completion.** On a completed session, Next/Count/Prev are no-ops and only Restart changes state. The completion event fires exactly once. Pinned by vectors in Task 2 and the event test in Task 5.
4. **A body tap on card 1 or on the completed state** opens `adhkar/<superId>` with no `dhikr` param, so the screen opens at the top. Pinned by the `sessionLink` vectors in Task 2.
5. **Malformed queue JSON from native.** `takePendingWidgetEvents` returns `[]` for junk and drops events with unknown names or bad props, never throwing. Pinned in Task 5.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `services/widgets/widgetStaticData.ts` (modify) | `SessionDhikr` type, `sessionDhikrText`, `cutToBudget`, and `items` on `AdhkarPeriodData` |
| `services/widgets/__tests__/widgetStaticData.test.ts` (modify) | Generator tests |
| `targets/widgets/adhkar-periods.json`, `modules/bayaan-widgets/android/src/main/assets/widgets/adhkar-periods.json` (regenerated) | Data |
| `modules/bayaan-widgets/src/__fixtures__/adhkarSession.vectors.json` (create) | Shared reducer vectors |
| `targets/widgets/Support/AdhkarSessionLogic.swift` (create) | Pure Swift reducer, Foundation only |
| `targets/widgets/Support/ContentModels.swift` (modify) | `SessionDhikr`, `items` |
| `scripts/check-widget-content.sh` (modify) | Run the Swift vectors |
| `modules/bayaan-widgets/android/.../AdhkarSessionLogic.kt` (create) | Pure Kotlin reducer |
| `modules/bayaan-widgets/android/.../ContentModels.kt` (modify) | `SessionDhikr`, `items` |
| `modules/bayaan-widgets/android/src/test/.../AdhkarSessionLogicTest.kt` (create) | Kotlin vectors |
| `targets/widgets/Support/WidgetStores.swift` (modify) | `AdhkarSessionStore`, `PendingWidgetEventStore` |
| `targets/widgets/Adhkar/AdhkarSessionIntents.swift` (create) | Four App Intents and the shared perform |
| `targets/widgets/Adhkar/AdhkarSessionView.swift` (create) | Medium/large session UI |
| `targets/widgets/Adhkar/AdhkarWidget.swift` (modify) | Entry carries the session, adds `.systemLarge`, routes families |
| `modules/bayaan-widgets/android/.../WidgetStorage.kt` (modify) | Session and pending event storage |
| `modules/bayaan-widgets/android/.../adhkar/AdhkarSessionActions.kt` (create) | Four ActionCallbacks |
| `modules/bayaan-widgets/android/.../adhkar/AdhkarSessionContent.kt` (create) | Medium/large Glance UI |
| `modules/bayaan-widgets/android/.../adhkar/AdhkarWidget.kt` (modify) | Adds the LARGE size and routes to the session content |
| `modules/bayaan-widgets/ios/BayaanWidgetsModule.swift`, `.../BayaanWidgetsModule.kt`, `modules/bayaan-widgets/src/NativeBayaanWidgets.ts`, `modules/bayaan-widgets/src/index.ts` (modify) | `takePendingWidgetEvents` bridge |
| `modules/bayaan-widgets/src/widgetEvents.ts` + `__tests__/widgetEvents.test.ts` (create) | Event parser |
| `services/widgets/syncConfiguredWidgets.ts` + test (modify) | `consumeWidgetEvents` |
| `app/(tabs)/(a.home)/adhkar/[superId]/index.tsx` (modify) | `dhikr` param scroll |

Android paths abbreviated `...` are `modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/` (tests: `modules/bayaan-widgets/android/src/test/java/expo/modules/bayaanwidgets/`).

---

### Task 1: Generator emits the full session list

**Files:**
- Modify: `services/widgets/widgetStaticData.ts` (Phase 3 adhkar section, about lines 147-273)
- Test: `services/widgets/__tests__/widgetStaticData.test.ts`
- Regenerate: both `adhkar-periods.json` copies via `npm run generate:widget-data`

**Interfaces:**
- Produces:
  ```ts
  export interface SessionDhikr {
    id: string;
    translation: string | null;
    repeatCount: number; // >= 1
    audioFile: string | null;
    mediumText: string;
    mediumCut: boolean;
    largeText: string;
    largeCut: boolean;
  }
  ```
  `AdhkarPeriodData.items: SessionDhikr[]`, in `order_index` order.
  `export const SESSION_MEDIUM_CHARS = 110; export const SESSION_LARGE_CHARS = 420;`

- [ ] **Step 1: Write the failing tests** (append to `widgetStaticData.test.ts`, reusing its existing imports and seed helpers where present)

```ts
import {
  sessionDhikrText,
  cutToBudget,
  buildAdhkarPeriods,
  SESSION_MEDIUM_CHARS,
} from '../widgetStaticData';

describe('sessionDhikrText', () => {
  it('uses the (( )) text without the count', () => {
    expect(
      sessionDhikrText('((سُبْحَانَ اللَّهِ وَبِحَمْدِهِ)) (مائة مرَّةٍ).'),
    ).toBe('سُبْحَانَ اللَّهِ وَبِحَمْدِهِ');
  });
  it('keeps unmarked text and drops bare parentheses', () => {
    expect(sessionDhikrText('(بسم الله ﴿قُلْ هُوَ اللَّهُ أَحَدٌ﴾.) (بسم الله ﴿قُلْ أَعُوذُ﴾)')).toBe(
      'بسم الله ﴿قُلْ هُوَ اللَّهُ أَحَدٌ﴾. بسم الله ﴿قُلْ أَعُوذُ﴾',
    );
  });
  it('trims trailing punctuation', () => {
    expect(sessionDhikrText('أَعُوذُ بِاللَّهِ ﴿اللَّهُ﴾.')).toBe('أَعُوذُ بِاللَّهِ ﴿اللَّهُ﴾');
  });
});

describe('cutToBudget', () => {
  it('returns short text unchanged', () => {
    expect(cutToBudget('a b c', 10)).toEqual({text: 'a b c', cut: false});
  });
  it('cuts at a word boundary and appends an ellipsis', () => {
    expect(cutToBudget('aaa bbb ccc ddd', 9)).toEqual({text: 'aaa bbb…', cut: true});
  });
});

describe('buildAdhkarPeriods items', () => {
  const seed = [
    {id: '2', category_id: '27', arabic: '((ب)) (ثلاثاً).', translation: 'B', repeat_count: 3, audio_file: 'adhkar_2.mp3', order_index: 1},
    {id: '1', category_id: '27', arabic: '((أ))', translation: null, repeat_count: 0, audio_file: null, order_index: 0},
    {id: '9', category_id: '30', arabic: '((x))', translation: null, repeat_count: 1, audio_file: null, order_index: 0},
  ];
  const src = {superId: 'morning-adhkar', title: 'Morning Adhkar', arabicTitle: 'أذكار الصباح', categoryId: '27', featured: ['1']};
  const periods = buildAdhkarPeriods({morning: src, evening: {...src, superId: 'evening-adhkar'}}, seed);

  it('lists the category in order with repeat counts of at least 1', () => {
    expect(periods.morning.items.map(i => [i.id, i.repeatCount])).toEqual([['1', 1], ['2', 3]]);
  });
  it('carries audio and display text', () => {
    expect(periods.morning.items[1]).toMatchObject({audioFile: 'adhkar_2.mp3', mediumText: 'ب', mediumCut: false, largeCut: false, translation: 'B'});
  });
  it('cuts long text for medium', () => {
    const long = {...seed[1], arabic: `((${'كلمة '.repeat(60)}))`};
    const p = buildAdhkarPeriods({morning: src, evening: src}, [long]);
    expect(p.morning.items[0].mediumCut).toBe(true);
    expect(p.morning.items[0].mediumText.length).toBeLessThanOrEqual(SESSION_MEDIUM_CHARS);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx jest services/widgets/__tests__/widgetStaticData.test.ts`
Expected: FAIL, `sessionDhikrText is not a function` or a type error on `items`.

- [ ] **Step 3: Implement in `widgetStaticData.ts`**

  1. Add `audio_file: string | null` and `order_index: number` to `AdhkarSeedRow`. Extend `isSeedRow`:
     ```ts
     (value.audio_file === undefined || value.audio_file === null || typeof value.audio_file === 'string') &&
     (value.order_index === undefined || typeof value.order_index === 'number')
     ```
     Normalize these in `parseAdhkarSeed` by mapping each filtered row to `{...row, audio_file: row.audio_file ?? null, order_index: row.order_index ?? 0}`. Use a type guard plus spread, not a cast.
  2. Add the `SessionDhikr` interface (above), the two constants, `items: SessionDhikr[]` on `AdhkarPeriodData`, and:

```ts
// Session card text: the (( )) dhikr when marked, else the whole text
// without bare parentheses (Ayat al-Kursi, the three Quls).
export function sessionDhikrText(arabic: string): string {
  const marked = tasbeehDisplayText(arabic);
  const text =
    marked ?? arabic.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  return text.replace(/[\s.،,:]+$/, '');
}

// Text that fits within budget characters, cut at a word boundary with an
// ellipsis when it does not.
export function cutToBudget(
  text: string,
  budget: number,
): {text: string; cut: boolean} {
  if (text.length <= budget) return {text, cut: false};
  const head = text.slice(0, budget - 1);
  const space = head.lastIndexOf(' ');
  return {text: `${(space > 0 ? head.slice(0, space) : head).trim()}…`, cut: true};
}

function sessionItem(row: AdhkarSeedRow): SessionDhikr {
  const text = sessionDhikrText(row.arabic);
  const medium = cutToBudget(text, SESSION_MEDIUM_CHARS);
  const large = cutToBudget(text, SESSION_LARGE_CHARS);
  return {
    id: row.id,
    translation: tasbeehTranslation(row.translation),
    repeatCount: Math.max(1, row.repeat_count),
    audioFile: row.audio_file,
    mediumText: medium.text,
    mediumCut: medium.cut,
    largeText: large.text,
    largeCut: large.cut,
  };
}
```

  3. In `buildAdhkarPeriods.period`, add to the returned object:
     ```ts
     items: [...inCategory].sort((a, b) => a.order_index - b.order_index).map(sessionItem),
     ```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx jest services/widgets/__tests__/widgetStaticData.test.ts`
Expected: PASS.

- [ ] **Step 5: Regenerate the data**

Run: `npm run generate:widget-data`
Then confirm the morning list has 24 items, starting with id 75, in both copies:
```
node -e "const d=require('./targets/widgets/adhkar-periods.json');console.log(d.morning.items.length,d.morning.items[0].id)"
```
Expected: `24 75`. Also run `git diff --stat` and confirm both JSON copies changed and nothing else was regenerated.

- [ ] **Step 6: Commit**

```bash
npx prettier --write services/widgets/widgetStaticData.ts services/widgets/__tests__/widgetStaticData.test.ts
git add services/widgets/widgetStaticData.ts services/widgets/__tests__/widgetStaticData.test.ts targets/widgets/adhkar-periods.json modules/bayaan-widgets/android/src/main/assets/widgets/adhkar-periods.json
git commit -m "feat(widgets): generate the full adhkar session list"
```

---

### Task 2: Session reducer (Swift and Kotlin) with shared vectors

**Files:**
- Create: `modules/bayaan-widgets/src/__fixtures__/adhkarSession.vectors.json`
- Create: `targets/widgets/Support/AdhkarSessionLogic.swift`
- Modify: `targets/widgets/Support/ContentModels.swift` (`AdhkarPeriodData`)
- Modify: `scripts/check-widget-content.sh`
- Create: `.../AdhkarSessionLogic.kt`
- Modify: `.../ContentModels.kt` (`AdhkarPeriodData`, `decodeAdhkarPeriods`)
- Create: `modules/bayaan-widgets/android/src/test/java/expo/modules/bayaanwidgets/AdhkarSessionLogicTest.kt`
- Modify: `.../ContentLogicTest.kt` (`parsesGeneratedStaticData`)

**Interfaces:**
- Consumes: the `items` JSON from Task 1.
- Produces (Swift):
  ```swift
  struct SessionDhikr: Codable, Hashable { let id: String; let translation: String?; let repeatCount: Int; let audioFile: String?; let mediumText: String; let mediumCut: Bool; let largeText: String; let largeCut: Bool }
  // AdhkarPeriodData gains: let items: [SessionDhikr]
  struct AdhkarSession: Codable, Equatable { var period: String; var day: String; var index: Int; var remaining: Int; var completed: Bool; var startedAtMs: Double? }
  enum AdhkarSessionAction: String, Codable { case next, prev, count, restart }
  enum AdhkarSessionLogic {
    static func sessionDay(_ date: Date, timeZone: TimeZone = .current) -> String
    static func fresh(period: String, day: String, repeatCounts: [Int]) -> AdhkarSession
    static func resolve(_ stored: AdhkarSession?, period: String, day: String, repeatCounts: [Int]) -> AdhkarSession
    static func apply(_ action: AdhkarSessionAction, to s: AdhkarSession, repeatCounts: [Int], nowMs: Double) -> AdhkarSession
    static func link(superId: String, session: AdhkarSession, ids: [String]) -> String
  }
  ```
- Produces (Kotlin, `object AdhkarSessionLogic`): `data class SessionDhikr(...)` with the same fields. `AdhkarPeriodData.items: List<SessionDhikr>`. `data class AdhkarSession(val period: String, val day: String, val index: Int, val remaining: Int, val completed: Boolean, val startedAtMs: Long?)`. `enum class AdhkarSessionAction { NEXT, PREV, COUNT, RESTART }`. Functions: `sessionDay(nowMs: Long, tz: TimeZone): String`, `fresh(...)`, `resolve(...)`, `apply(action, s, repeatCounts: List<Int>, nowMs: Long)`, `link(superId, s, ids: List<String>): String`, `encode(s: AdhkarSession): String`, `decode(json: String?): AdhkarSession?`.

Reducer rules (identical on both platforms):
- `count(i)` = `max(1, repeatCounts[i])`.
- `sessionDay` = the local `YYYY-MM-DD` of `now - 4h`, so 00:00-03:59 belongs to the previous evening.
- `fresh` = `{period, day, index 0, remaining count(0), completed false, startedAtMs nil}`.
- `resolve` returns `fresh` when stored is nil, period or day differ, or index is outside `0..<repeatCounts.count`. Otherwise it returns stored unchanged.
- `apply`:
  - `restart` returns `fresh(s.period, s.day)`.
  - If `s.completed`, return `s`.
  - Otherwise set `started = s.startedAtMs ?? nowMs`, then:
    - `next`: on the last index, `completed true, remaining 0`; otherwise `index+1, remaining count(index+1)`.
    - `prev`: at index 0, only stamp `started`; otherwise `index-1, remaining count(index-1)`.
    - `count`: if `remaining > 1`, `remaining-1`; otherwise behave like `next`.
  - Every non-restart result carries `startedAtMs = started`.
- `link` returns `adhkar/<superId>` when `completed` or `index == 0`, otherwise `adhkar/<superId>?dhikr=<ids[index]>`.

- [ ] **Step 1: Create the vectors file** `modules/bayaan-widgets/src/__fixtures__/adhkarSession.vectors.json`

```json
{
  "repeatCounts": [1, 3, 1],
  "ids": ["75", "76", "77"],
  "sessionDay": [
    [1791799200000, "2026-10-12"],
    [1791770400000, "2026-10-11"],
    [1791777540000, "2026-10-11"],
    [1791777600000, "2026-10-12"]
  ],
  "resolve": [
    {"name": "nil", "stored": null, "period": "morning", "day": "2026-10-12",
     "expect": {"period": "morning", "day": "2026-10-12", "index": 0, "remaining": 1, "completed": false, "startedAtMs": null}},
    {"name": "keeps", "stored": {"period": "morning", "day": "2026-10-12", "index": 1, "remaining": 2, "completed": false, "startedAtMs": 5}, "period": "morning", "day": "2026-10-12",
     "expect": {"period": "morning", "day": "2026-10-12", "index": 1, "remaining": 2, "completed": false, "startedAtMs": 5}},
    {"name": "period change", "stored": {"period": "morning", "day": "2026-10-12", "index": 1, "remaining": 2, "completed": false, "startedAtMs": 5}, "period": "evening", "day": "2026-10-12",
     "expect": {"period": "evening", "day": "2026-10-12", "index": 0, "remaining": 1, "completed": false, "startedAtMs": null}},
    {"name": "day change", "stored": {"period": "evening", "day": "2026-10-11", "index": 2, "remaining": 1, "completed": true, "startedAtMs": 5}, "period": "evening", "day": "2026-10-12",
     "expect": {"period": "evening", "day": "2026-10-12", "index": 0, "remaining": 1, "completed": false, "startedAtMs": null}},
    {"name": "index out of range", "stored": {"period": "morning", "day": "2026-10-12", "index": 9, "remaining": 1, "completed": false, "startedAtMs": 5}, "period": "morning", "day": "2026-10-12",
     "expect": {"period": "morning", "day": "2026-10-12", "index": 0, "remaining": 1, "completed": false, "startedAtMs": null}}
  ],
  "apply": [
    {"name": "next stamps start", "action": "next", "nowMs": 100, "start": {"period": "morning", "day": "d", "index": 0, "remaining": 1, "completed": false, "startedAtMs": null},
     "expect": {"period": "morning", "day": "d", "index": 1, "remaining": 3, "completed": false, "startedAtMs": 100}},
    {"name": "count decrements", "action": "count", "nowMs": 200, "start": {"period": "morning", "day": "d", "index": 1, "remaining": 3, "completed": false, "startedAtMs": 100},
     "expect": {"period": "morning", "day": "d", "index": 1, "remaining": 2, "completed": false, "startedAtMs": 100}},
    {"name": "count at one advances", "action": "count", "nowMs": 200, "start": {"period": "morning", "day": "d", "index": 1, "remaining": 1, "completed": false, "startedAtMs": 100},
     "expect": {"period": "morning", "day": "d", "index": 2, "remaining": 1, "completed": false, "startedAtMs": 100}},
    {"name": "next on last completes", "action": "next", "nowMs": 300, "start": {"period": "morning", "day": "d", "index": 2, "remaining": 1, "completed": false, "startedAtMs": 100},
     "expect": {"period": "morning", "day": "d", "index": 2, "remaining": 0, "completed": true, "startedAtMs": 100}},
    {"name": "count on last completes", "action": "count", "nowMs": 300, "start": {"period": "morning", "day": "d", "index": 2, "remaining": 1, "completed": false, "startedAtMs": 100},
     "expect": {"period": "morning", "day": "d", "index": 2, "remaining": 0, "completed": true, "startedAtMs": 100}},
    {"name": "prev resets remaining", "action": "prev", "nowMs": 300, "start": {"period": "morning", "day": "d", "index": 2, "remaining": 1, "completed": false, "startedAtMs": 100},
     "expect": {"period": "morning", "day": "d", "index": 1, "remaining": 3, "completed": false, "startedAtMs": 100}},
    {"name": "prev at first", "action": "prev", "nowMs": 300, "start": {"period": "morning", "day": "d", "index": 0, "remaining": 1, "completed": false, "startedAtMs": null},
     "expect": {"period": "morning", "day": "d", "index": 0, "remaining": 1, "completed": false, "startedAtMs": 300}},
    {"name": "completed ignores next", "action": "next", "nowMs": 400, "start": {"period": "morning", "day": "d", "index": 2, "remaining": 0, "completed": true, "startedAtMs": 100},
     "expect": {"period": "morning", "day": "d", "index": 2, "remaining": 0, "completed": true, "startedAtMs": 100}},
    {"name": "completed ignores count", "action": "count", "nowMs": 400, "start": {"period": "morning", "day": "d", "index": 2, "remaining": 0, "completed": true, "startedAtMs": 100},
     "expect": {"period": "morning", "day": "d", "index": 2, "remaining": 0, "completed": true, "startedAtMs": 100}},
    {"name": "restart", "action": "restart", "nowMs": 400, "start": {"period": "morning", "day": "d", "index": 2, "remaining": 0, "completed": true, "startedAtMs": 100},
     "expect": {"period": "morning", "day": "d", "index": 0, "remaining": 1, "completed": false, "startedAtMs": null}}
  ],
  "link": [
    {"session": {"period": "morning", "day": "d", "index": 0, "remaining": 1, "completed": false, "startedAtMs": null}, "expect": "adhkar/morning-adhkar"},
    {"session": {"period": "morning", "day": "d", "index": 1, "remaining": 3, "completed": false, "startedAtMs": 1}, "expect": "adhkar/morning-adhkar?dhikr=76"},
    {"session": {"period": "morning", "day": "d", "index": 2, "remaining": 0, "completed": true, "startedAtMs": 1}, "expect": "adhkar/morning-adhkar"}
  ]
}
```

The `sessionDay` timestamps are evaluated in UTC and were verified with node:
- 1791799200000 is 2026-10-12 10:00 UTC, giving 2026-10-12.
- 1791770400000 is 2026-10-12 02:00 UTC, giving 2026-10-11. This is the evening session crossing midnight (Review Focus 1).
- 1791777540000 (03:59) gives 2026-10-11 and 1791777600000 (04:00) gives 2026-10-12. This is the boundary.

- [ ] **Step 2: Write the Swift check (failing)**

  1. Add `"$root/targets/widgets/Support/AdhkarSessionLogic.swift"` to the `cat` list in `scripts/check-widget-content.sh`, after `ContentLogic.swift`.
  2. Create an empty `AdhkarSessionLogic.swift` containing only `import Foundation`.
  3. Before the final `print` of the heredoc, add:

```swift
// Adhkar session vectors (shared with AdhkarSessionLogicTest.kt)
let sv = json("\(dir)/adhkarSession.vectors.json") as! [String: Any]
let rc = sv["repeatCounts"] as! [Int]
let ids = sv["ids"] as! [String]
func session(_ v: Any) -> AdhkarSession? {
  guard let d = v as? [String: Any] else { return nil }
  return AdhkarSession(period: d["period"] as! String, day: d["day"] as! String, index: d["index"] as! Int,
                       remaining: d["remaining"] as! Int, completed: d["completed"] as! Bool,
                       startedAtMs: (d["startedAtMs"] as? NSNumber)?.doubleValue)
}
let utc = TimeZone(identifier: "UTC")!
for case let pair as [Any] in sv["sessionDay"] as! [Any] {
  let ms = (pair[0] as! NSNumber).doubleValue
  precondition(AdhkarSessionLogic.sessionDay(Date(timeIntervalSince1970: ms / 1000), timeZone: utc) == pair[1] as! String, "sessionDay \(ms)")
}
for case let c as [String: Any] in sv["resolve"] as! [Any] {
  let got = AdhkarSessionLogic.resolve(session(c["stored"]!), period: c["period"] as! String, day: c["day"] as! String, repeatCounts: rc)
  precondition(got == session(c["expect"]!)!, "resolve \(c["name"]!)")
}
for case let c as [String: Any] in sv["apply"] as! [Any] {
  let got = AdhkarSessionLogic.apply(AdhkarSessionAction(rawValue: c["action"] as! String)!, to: session(c["start"]!)!,
                                     repeatCounts: rc, nowMs: (c["nowMs"] as! NSNumber).doubleValue)
  precondition(got == session(c["expect"]!)!, "apply \(c["name"]!)")
}
for case let c as [String: Any] in sv["link"] as! [Any] {
  precondition(AdhkarSessionLogic.link(superId: "morning-adhkar", session: session(c["session"]!)!, ids: ids) == c["expect"] as! String, "link")
}
precondition(adhkar.morning.items.count == 24 && adhkar.morning.items.allSatisfy { $0.repeatCount >= 1 }, "adhkar items")
print("swift adhkar session: OK")
```

Run: `bash scripts/check-widget-content.sh`
Expected: a compile failure (`cannot find 'AdhkarSession' in scope`, and `items` is missing on `AdhkarPeriodData`).

- [ ] **Step 3: Implement the Swift side**

Add `SessionDhikr` to `ContentModels.swift` next to `FeaturedDhikr`, and add `let items: [SessionDhikr]` as the last property of `AdhkarPeriodData`. Write `AdhkarSessionLogic.swift`:

```swift
// targets/widgets/Support/AdhkarSessionLogic.swift
import Foundation

/// Where the Adhkar widget is in this period's session (spec 2026-10-12).
/// Foundation only: scripts/check-widget-content.sh compiles it standalone.
struct AdhkarSession: Codable, Equatable {
  var period: String
  var day: String
  var index: Int
  var remaining: Int
  var completed: Bool
  var startedAtMs: Double?
}

enum AdhkarSessionAction: String, Codable { case next, prev, count, restart }

enum AdhkarSessionLogic {
  /// The day a session belongs to: shifted 4 hours so the evening period
  /// (12:00 to 03:59) stays one session across midnight.
  static func sessionDay(_ date: Date, timeZone: TimeZone = .current) -> String {
    WidgetLogic.localDayKey(date.addingTimeInterval(-4 * 3600), timeZone: timeZone)
  }

  static func fresh(period: String, day: String, repeatCounts: [Int]) -> AdhkarSession {
    AdhkarSession(period: period, day: day, index: 0, remaining: count(repeatCounts, 0),
                  completed: false, startedAtMs: nil)
  }

  static func resolve(_ stored: AdhkarSession?, period: String, day: String, repeatCounts: [Int]) -> AdhkarSession {
    guard let s = stored, s.period == period, s.day == day, repeatCounts.indices.contains(s.index) else {
      return fresh(period: period, day: day, repeatCounts: repeatCounts)
    }
    return s
  }

  static func apply(_ action: AdhkarSessionAction, to s: AdhkarSession, repeatCounts: [Int], nowMs: Double) -> AdhkarSession {
    if action == .restart { return fresh(period: s.period, day: s.day, repeatCounts: repeatCounts) }
    if s.completed { return s }
    var out = s
    out.startedAtMs = s.startedAtMs ?? nowMs
    switch action {
    case .next: advance(&out, repeatCounts)
    case .count:
      if s.remaining > 1 { out.remaining = s.remaining - 1 } else { advance(&out, repeatCounts) }
    case .prev:
      if s.index > 0 { out.index = s.index - 1; out.remaining = count(repeatCounts, out.index) }
    case .restart: break
    }
    return out
  }

  /// Body-tap path: the top of the list on the first card or when done, else the current dhikr.
  static func link(superId: String, session: AdhkarSession, ids: [String]) -> String {
    guard !session.completed, session.index > 0, ids.indices.contains(session.index) else { return "adhkar/\(superId)" }
    return "adhkar/\(superId)?dhikr=\(ids[session.index])"
  }

  private static func advance(_ s: inout AdhkarSession, _ repeatCounts: [Int]) {
    if s.index + 1 >= repeatCounts.count {
      s.completed = true
      s.remaining = 0
    } else {
      s.index += 1
      s.remaining = count(repeatCounts, s.index)
    }
  }

  private static func count(_ repeatCounts: [Int], _ i: Int) -> Int {
    repeatCounts.indices.contains(i) ? max(1, repeatCounts[i]) : 1
  }
}
```

Run: `bash scripts/check-widget-content.sh`
Expected: `swift adhkar session: OK`. Every earlier OK line still prints.

- [ ] **Step 4: Write the Kotlin test (failing)**

Create `AdhkarSessionLogicTest.kt`:

```kotlin
package expo.modules.bayaanwidgets

import java.io.File
import java.util.TimeZone
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class AdhkarSessionLogicTest {
  private val v = JSONObject(File("../src/__fixtures__/adhkarSession.vectors.json").readText())
  private val rc = v.getJSONArray("repeatCounts").let { a -> List(a.length()) { a.getInt(it) } }
  private val ids = v.getJSONArray("ids").let { a -> List(a.length()) { a.getString(it) } }

  private fun session(o: Any?): AdhkarSession? = (o as? JSONObject)?.let {
    AdhkarSession(it.getString("period"), it.getString("day"), it.getInt("index"), it.getInt("remaining"),
      it.getBoolean("completed"), if (it.isNull("startedAtMs")) null else it.getLong("startedAtMs"))
  }

  private fun each(key: String, f: (JSONObject) -> Unit) {
    val a: JSONArray = v.getJSONArray(key)
    for (i in 0 until a.length()) f(a.getJSONObject(i))
  }

  @Test fun sessionDay() {
    val a = v.getJSONArray("sessionDay")
    for (i in 0 until a.length()) {
      val p = a.getJSONArray(i)
      assertEquals(p.getString(1), AdhkarSessionLogic.sessionDay(p.getLong(0), TimeZone.getTimeZone("UTC")))
    }
  }

  @Test fun resolve() = each("resolve") { c ->
    assertEquals(c.getString("name"), session(c.getJSONObject("expect")),
      AdhkarSessionLogic.resolve(session(c.opt("stored")), c.getString("period"), c.getString("day"), rc))
  }

  @Test fun apply() = each("apply") { c ->
    val action = AdhkarSessionAction.valueOf(c.getString("action").uppercase())
    assertEquals(c.getString("name"), session(c.getJSONObject("expect")),
      AdhkarSessionLogic.apply(action, session(c.getJSONObject("start"))!!, rc, c.getLong("nowMs")))
  }

  @Test fun link() = each("link") { c ->
    assertEquals(c.getString("expect"), AdhkarSessionLogic.link("morning-adhkar", session(c.getJSONObject("session"))!!, ids))
  }

  @Test fun encodeRoundTrips() {
    val s = AdhkarSession("evening", "2026-10-12", 3, 2, false, 99L)
    assertEquals(s, AdhkarSessionLogic.decode(AdhkarSessionLogic.encode(s)))
    assertEquals(null, AdhkarSessionLogic.decode("nope"))
  }
}
```

In `ContentLogicTest.parsesGeneratedStaticData`, add an assertion that `items` has size 24 and that `items[0].id == "75"`, using the variable that test already decodes.

Run: `cd android && ./gradlew :bayaan-widgets:testDebugUnitTest`
Expected: FAIL to compile (unresolved `AdhkarSession`).

- [ ] **Step 5: Implement the Kotlin side**

In `ContentModels.kt`:
- Add `data class SessionDhikr(val id: String, val translation: String?, val repeatCount: Int, val audioFile: String?, val mediumText: String, val mediumCut: Boolean, val largeText: String, val largeCut: Boolean)`.
- Add `val items: List<SessionDhikr>` as the last field of `AdhkarPeriodData`.
- In `decodeAdhkarPeriods`, parse `items` the same way it parses `featured`. Use `optString`/`isNull` for the nullable `translation` and `audioFile`.

Create `AdhkarSessionLogic.kt`:

```kotlin
package expo.modules.bayaanwidgets

import java.util.TimeZone
import org.json.JSONObject

/** Where the Adhkar widget is in this period's session (spec 2026-10-12). Mirrors AdhkarSessionLogic.swift. */
data class AdhkarSession(
  val period: String, val day: String, val index: Int, val remaining: Int,
  val completed: Boolean, val startedAtMs: Long?,
)

enum class AdhkarSessionAction { NEXT, PREV, COUNT, RESTART }

object AdhkarSessionLogic {
  private const val SHIFT_MS = 4L * 3600 * 1000

  /** Shifted 4 hours so the evening period (12:00 to 03:59) stays one session across midnight. */
  fun sessionDay(nowMs: Long, tz: TimeZone): String = DayMath.localDayKey(nowMs - SHIFT_MS, tz)

  fun fresh(period: String, day: String, repeatCounts: List<Int>) =
    AdhkarSession(period, day, 0, count(repeatCounts, 0), false, null)

  fun resolve(stored: AdhkarSession?, period: String, day: String, repeatCounts: List<Int>): AdhkarSession =
    if (stored == null || stored.period != period || stored.day != day || stored.index !in repeatCounts.indices) {
      fresh(period, day, repeatCounts)
    } else stored

  fun apply(action: AdhkarSessionAction, s: AdhkarSession, repeatCounts: List<Int>, nowMs: Long): AdhkarSession {
    if (action == AdhkarSessionAction.RESTART) return fresh(s.period, s.day, repeatCounts)
    if (s.completed) return s
    val started = s.copy(startedAtMs = s.startedAtMs ?: nowMs)
    return when (action) {
      AdhkarSessionAction.NEXT -> advance(started, repeatCounts)
      AdhkarSessionAction.COUNT -> if (s.remaining > 1) started.copy(remaining = s.remaining - 1) else advance(started, repeatCounts)
      AdhkarSessionAction.PREV -> if (s.index > 0) started.copy(index = s.index - 1, remaining = count(repeatCounts, s.index - 1)) else started
      AdhkarSessionAction.RESTART -> started
    }
  }

  /** Body-tap path: the top of the list on the first card or when done, else the current dhikr. */
  fun link(superId: String, s: AdhkarSession, ids: List<String>): String =
    if (s.completed || s.index == 0 || s.index !in ids.indices) "adhkar/$superId"
    else "adhkar/$superId?dhikr=${ids[s.index]}"

  fun encode(s: AdhkarSession): String = JSONObject()
    .put("period", s.period).put("day", s.day).put("index", s.index).put("remaining", s.remaining)
    .put("completed", s.completed).put("startedAtMs", s.startedAtMs ?: JSONObject.NULL).toString()

  fun decode(json: String?): AdhkarSession? = try {
    json?.let { JSONObject(it) }?.let {
      AdhkarSession(it.getString("period"), it.getString("day"), it.getInt("index"), it.getInt("remaining"),
        it.getBoolean("completed"), if (it.isNull("startedAtMs")) null else it.getLong("startedAtMs"))
    }
  } catch (e: Exception) { null }

  private fun advance(s: AdhkarSession, repeatCounts: List<Int>): AdhkarSession =
    if (s.index + 1 >= repeatCounts.size) s.copy(completed = true, remaining = 0)
    else s.copy(index = s.index + 1, remaining = count(repeatCounts, s.index + 1))

  private fun count(repeatCounts: List<Int>, i: Int): Int = repeatCounts.getOrNull(i)?.coerceAtLeast(1) ?: 1
}
```

Run: `cd android && ./gradlew :bayaan-widgets:testDebugUnitTest`
Expected: PASS, including the existing ContentLogicTest and WidgetLogicTest.

- [ ] **Step 6: Commit**

```bash
git add modules/bayaan-widgets/src/__fixtures__/adhkarSession.vectors.json targets/widgets/Support/AdhkarSessionLogic.swift targets/widgets/Support/ContentModels.swift scripts/check-widget-content.sh modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/AdhkarSessionLogic.kt modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/ContentModels.kt modules/bayaan-widgets/android/src/test/java/expo/modules/bayaanwidgets/AdhkarSessionLogicTest.kt modules/bayaan-widgets/android/src/test/java/expo/modules/bayaanwidgets/ContentLogicTest.kt
git commit -m "feat(widgets): add the adhkar session reducer with shared vectors"
```

---

### Task 3: iOS interactive session widget

**Files:**
- Modify: `targets/widgets/Support/WidgetStores.swift`
- Create: `targets/widgets/Adhkar/AdhkarSessionIntents.swift`
- Create: `targets/widgets/Adhkar/AdhkarSessionView.swift`
- Modify: `targets/widgets/Adhkar/AdhkarWidget.swift`

**Interfaces:**
- Consumes: `AdhkarSession`, `AdhkarSessionLogic`, `AdhkarSessionAction`, `SessionDhikr` (Task 2), `ContentStaticData.adhkar`, `ContentLogic.adhkarPeriod(hour:)`, `ContentLogic.hour(_:)`, `BayaanAppGroup.defaults`, `WidgetQueueLock.withLock`, `WidgetFonts.dhikr`, `DhikrText`, `WidgetPalette`, `BayaanLogo`, `AppLinks.url`, `RoundIntentButton`.
- Produces:
  - `enum AdhkarSessionStore { static func read() -> AdhkarSession?; static func write(_ s: AdhkarSession) }`, using key `"widgets.adhkarSession"`.
  - `enum PendingWidgetEventStore { static func add(name: String, props: [String: Any]) }`, using key `"widgets.pendingEvents"`, which holds a JSON string array of `{"name": String, "props": {...}}`.
  - Intents: `AdhkarNextIntent`, `AdhkarPrevIntent`, `AdhkarCountIntent`, `AdhkarRestartIntent`.
  - `AdhkarEntry.session: AdhkarSession?`.

- [ ] **Step 1: Add the stores to `WidgetStores.swift`** (after `PendingTasbeehStore`, same style)

```swift
/// The Adhkar widget's session. One record: resolve() resets it when the period or day changes.
enum AdhkarSessionStore {
  private static let key = "widgets.adhkarSession"

  static func read() -> AdhkarSession? {
    guard let s = BayaanAppGroup.defaults?.string(forKey: key), let d = s.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(AdhkarSession.self, from: d)
  }

  static func write(_ session: AdhkarSession) {
    guard let d = try? JSONEncoder().encode(session), let s = String(data: d, encoding: .utf8) else { return }
    BayaanAppGroup.defaults?.set(s, forKey: key)
  }
}

/// Analytics events raised in the extension; the app drains them (takePendingWidgetEvents).
enum PendingWidgetEventStore {
  static let key = "widgets.pendingEvents"

  static func add(name: String, props: [String: Any]) {
    WidgetQueueLock.withLock {
      let defaults = BayaanAppGroup.defaults
      var list = (defaults?.string(forKey: key)?.data(using: .utf8))
        .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [[String: Any]] } ?? []
      list.append(["name": name, "props": props])
      if let d = try? JSONSerialization.data(withJSONObject: list), let s = String(data: d, encoding: .utf8) {
        defaults?.set(s, forKey: key)
      }
    }
  }
}
```

Match `WidgetQueueLock.withLock`'s real signature, as `PendingTasbeehStore.add` uses it.

- [ ] **Step 2: Create `AdhkarSessionIntents.swift`**

```swift
// targets/widgets/Adhkar/AdhkarSessionIntents.swift
import AppIntents
import WidgetKit

/// Applies one session action for the current period, records completion once,
/// and reloads every widget that shows the session.
enum AdhkarSessionActions {
  static func perform(_ action: AdhkarSessionAction, now: Date = .now) {
    guard let data = ContentStaticData.adhkar?.data(for: ContentLogic.adhkarPeriod(hour: ContentLogic.hour(now))) else { return }
    let counts = data.items.map(\.repeatCount)
    let nowMs = now.timeIntervalSince1970 * 1000
    WidgetQueueLock.withLock {
      let before = AdhkarSessionLogic.resolve(AdhkarSessionStore.read(), period: data.period,
                                              day: AdhkarSessionLogic.sessionDay(now), repeatCounts: counts)
      let after = AdhkarSessionLogic.apply(action, to: before, repeatCounts: counts, nowMs: nowMs)
      AdhkarSessionStore.write(after)
      if !before.completed, after.completed {
        completedProps = ["category": data.superId, "duration_ms": Int(nowMs - (after.startedAtMs ?? nowMs)),
                          "dhikr_count": counts.count]
      }
    }
    if let props = completedProps {
      PendingWidgetEventStore.add(name: "adhkar_session_completed", props: props)
      completedProps = nil
    }
    WidgetCenter.shared.reloadTimelines(ofKind: "Adhkar")
    WidgetCenter.shared.reloadTimelines(ofKind: "BayaanNow")
  }

  // Set inside the lock and sent after it, because PendingWidgetEventStore takes the same lock.
  private static var completedProps: [String: Any]?
}

struct AdhkarNextIntent: AppIntent {
  static var title: LocalizedStringResource = "Next Dhikr"
  static var isDiscoverable = false
  func perform() async throws -> some IntentResult { AdhkarSessionActions.perform(.next); return .result() }
}

struct AdhkarPrevIntent: AppIntent {
  static var title: LocalizedStringResource = "Previous Dhikr"
  static var isDiscoverable = false
  func perform() async throws -> some IntentResult { AdhkarSessionActions.perform(.prev); return .result() }
}

struct AdhkarCountIntent: AppIntent {
  static var title: LocalizedStringResource = "Count Dhikr Repetition"
  static var isDiscoverable = false
  func perform() async throws -> some IntentResult { AdhkarSessionActions.perform(.count); return .result() }
}

struct AdhkarRestartIntent: AppIntent {
  static var title: LocalizedStringResource = "Restart Adhkar"
  static var isDiscoverable = false
  func perform() async throws -> some IntentResult { AdhkarSessionActions.perform(.restart); return .result() }
}
```

If `WidgetQueueLock.withLock` is not reentrant-safe with a static var under Swift 6 strict concurrency, replace `completedProps` with a local `var props: [String: Any]?` captured by the closure. That version is preferred whenever `withLock` takes a non-escaping closure. Check its signature first and use the local-variable form if it compiles.

- [ ] **Step 3: Create `AdhkarSessionView.swift`**

```swift
// targets/widgets/Adhkar/AdhkarSessionView.swift
import AppIntents
import SwiftUI
import WidgetKit

/// Medium and large Adhkar: card through the session (spec 2026-10-12).
/// Buttons run intents; any other tap opens the adhkar screen at the current dhikr.
struct AdhkarSessionView: View {
  @Environment(\.widgetFamily) private var family
  let data: AdhkarPeriodData
  let session: AdhkarSession

  private var large: Bool { family == .systemLarge }
  private var item: SessionDhikr? { data.items.indices.contains(session.index) ? data.items[session.index] : nil }

  var body: some View {
    VStack(alignment: .leading, spacing: large ? 10 : 6) {
      header
      if session.completed { completed } else if let item { card(item) }
    }
    .padding(large ? 16 : 14)
    .widgetURL(AppLinks.url(AdhkarSessionLogic.link(superId: data.superId, session: session, ids: data.items.map(\.id))))
  }

  private var header: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(data.title).font(.subheadline.weight(.bold)).lineLimit(1)
        Spacer(minLength: 0)
        if !session.completed {
          Text("\(session.index + 1) of \(data.items.count)").font(.caption2.weight(.semibold)).opacity(0.6)
        }
        BayaanLogo(size: 14)
      }
      ProgressView(value: Double(session.completed ? data.items.count : session.index), total: Double(max(1, data.items.count)))
        .tint(.white)
    }
  }

  private func card(_ item: SessionDhikr) -> some View {
    let text = large ? item.largeText : item.mediumText
    let cut = large ? item.largeCut : item.mediumCut
    return VStack(alignment: .leading, spacing: 6) {
      Spacer(minLength: 0)
      DhikrText(text: text, size: large ? 22 : 18, lines: large ? 9 : 3).frame(maxWidth: .infinity)
      if large, let t = item.translation {
        Text(t).font(.caption).opacity(0.75).lineLimit(3)
      }
      if cut {
        Text("Read the rest in \(AppBrand.name) \u{2192}").font(.caption2.weight(.semibold)).opacity(0.7)
      }
      Spacer(minLength: 0)
      controls(item)
    }
  }

  private func controls(_ item: SessionDhikr) -> some View {
    HStack(spacing: 12) {
      if session.index > 0 {
        RoundIntentButton(intent: AdhkarPrevIntent(), systemName: "chevron.left", label: "Previous")
      }
      Spacer(minLength: 0)
      Button(intent: AdhkarCountIntent()) {
        AdhkarCounterRing(remaining: session.remaining, total: item.repeatCount, size: 34)
      }
      .buttonStyle(.plain)
      .accessibilityLabel(item.repeatCount > 1 ? "Count, \(session.remaining) left" : "Done")
      RoundIntentButton(intent: AdhkarNextIntent(), systemName: "chevron.right", label: "Next")
    }
  }

  private var completed: some View {
    VStack(spacing: 8) {
      Spacer(minLength: 0)
      Image(systemName: "checkmark.circle.fill").font(.system(size: large ? 40 : 28))
      Text("\(data.title) completed").font(.subheadline.weight(.semibold))
      Button(intent: AdhkarRestartIntent()) {
        Text("Start again").font(.caption.weight(.bold)).padding(.horizontal, 12).padding(.vertical, 6)
          .background(WidgetPalette.tile, in: Capsule())
      }
      .buttonStyle(.plain)
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity)
  }
}

/// Small repetition ring: fills as you count, a check for a dhikr said once.
struct AdhkarCounterRing: View {
  let remaining: Int
  let total: Int
  let size: CGFloat

  var body: some View {
    ZStack {
      Circle().stroke(.white.opacity(0.2), lineWidth: 3)
      Circle().trim(from: 0, to: total > 1 ? CGFloat(total - remaining) / CGFloat(total) : 0)
        .stroke(.white, style: StrokeStyle(lineWidth: 3, lineCap: .round)).rotationEffect(.degrees(-90))
      if total > 1 {
        Text("\(remaining)").font(.system(size: size * 0.38, weight: .bold, design: .rounded)).minimumScaleFactor(0.5)
      } else {
        Image(systemName: "checkmark").font(.system(size: size * 0.38, weight: .bold))
      }
    }
    .frame(width: size, height: size)
  }
}
```

- [ ] **Step 4: Wire it into `AdhkarWidget.swift`**

  1. Add `let session: AdhkarSession?` to `AdhkarEntry`. In `make(at:next:)`, compute it after `data`:
     ```swift
     let session = data.map { d in
       AdhkarSessionLogic.resolve(AdhkarSessionStore.read(), period: d.period,
                                  day: AdhkarSessionLogic.sessionDay(date), repeatCounts: d.items.map(\.repeatCount))
     }
     ```
     Pass it to the initializer. Update the explicit initializer call in the Medium preview: `AdhkarEntry(date: .now, data: nil, featured: nil, session: nil, relevance: nil)`.
  2. Change `.supportedFamilies` to `[.systemSmall, .systemMedium, .systemLarge]` and `.description` to `"Go through the adhkar for this time of day."`.
  3. In `AdhkarView.body`, choose the view by family:
     ```swift
     if family == .systemSmall, let data = entry.data, let dhikr = entry.featured {
       small(data, dhikr).widgetURL(AppLinks.url("adhkar/\(data.superId)"))
     } else if let data = entry.data, let session = entry.session, !data.items.isEmpty {
       AdhkarSessionView(data: data, session: session)
     } else {
       ContentMessage(title: "Open \(AppBrand.name)")
     }
     ```
     Remove the old `.widgetURL(...)` modifier on the `Group`, since each branch now sets its own. Keep `.foregroundStyle(.white)` and `.containerBackground`. Delete the now-unused `medium(...)` function.
  4. Add `#Preview("Large", as: .systemLarge) { AdhkarWidget() } timeline: { AdhkarEntry.make(at: .now, next: nil) }`.

  Bayaan Now already renders `AdhkarView(entry: AdhkarEntry.make(...))`, so it picks this up with no change.

- [ ] **Step 5: Compile the widget extension**

Run `npx expo prebuild -p ios --no-install`, then the xcodebuild command from Global Constraints.
Expected: `** BUILD SUCCEEDED **`. Then run `bash scripts/check-widget-content.sh` and confirm all OK lines still print.

- [ ] **Step 6: Commit** (only the widget files; prebuild output under `ios/` stays uncommitted)

```bash
git add targets/widgets/Support/WidgetStores.swift targets/widgets/Adhkar/AdhkarSessionIntents.swift targets/widgets/Adhkar/AdhkarSessionView.swift targets/widgets/Adhkar/AdhkarWidget.swift
git commit -m "feat(widgets): make the iOS adhkar widget an interactive session"
```

---

### Task 4: Android interactive session widget

**Files:**
- Modify: `.../WidgetStorage.kt`
- Create: `.../adhkar/AdhkarSessionActions.kt`
- Create: `.../adhkar/AdhkarSessionContent.kt`
- Modify: `.../adhkar/AdhkarWidget.kt`
- Modify: `modules/bayaan-widgets/android/src/main/res/xml/adhkar_info.xml` (or whichever `appwidget-provider` XML `AdhkarReceiver` points to in `AndroidManifest.xml`)

**Interfaces:**
- Consumes: `AdhkarSessionLogic`, `AdhkarSession`, `AdhkarSessionAction`, `SessionDhikr` (Task 2), `ContentStaticData.adhkar(context)`, `ContentLogic.adhkarPeriod`, `ContentLogic.hour`, `GlanceState.push`, `RingBitmap.render`, `ArabicText`, `appLink`, `RoundButton`, `Logo`, `WidgetSizes`.
- Produces:
  - `WidgetStorage.readAdhkarSessionJson(context): String?`
  - `WidgetStorage.writeAdhkarSession(context, json: String)`
  - `WidgetStorage.addPendingEvent(context, event: JSONObject)` (`@Synchronized`, `commit()`)
  - `WidgetStorage.takePendingEvents(context): String`, which returns the JSON array string or `"[]"`, following the `takeTasbeeh` pattern.
  - `AdhkarNextAction`, `AdhkarPrevAction`, `AdhkarCountAction`, `AdhkarRestartAction : ActionCallback`.
  - `@Composable fun AdhkarSessionContent(context: Context, data: AdhkarPeriodData, session: AdhkarSession, large: Boolean)`.

- [ ] **Step 1: Add the storage functions to `WidgetStorage.kt`**

Use the existing prefs and the `take()` helper. Add the keys `KEY_ADHKAR_SESSION = "adhkarSession"` and `KEY_PENDING_EVENTS = "pendingEvents"`.

```kotlin
fun readAdhkarSessionJson(context: Context): String? = prefs(context).getString(KEY_ADHKAR_SESSION, null)

fun writeAdhkarSession(context: Context, json: String) {
  prefs(context).edit().putString(KEY_ADHKAR_SESSION, json).commit()
}

@Synchronized
fun addPendingEvent(context: Context, event: JSONObject) {
  val list = try { JSONArray(prefs(context).getString(KEY_PENDING_EVENTS, null) ?: "[]") } catch (e: Exception) { JSONArray() }
  list.put(event)
  prefs(context).edit().putString(KEY_PENDING_EVENTS, list.toString()).commit()
}

fun takePendingEvents(context: Context) = take(context, KEY_PENDING_EVENTS)
```

Use the real prefs accessor name from the file (whatever `addPendingTasbeeh` uses), and match `take`'s return convention for an empty queue.

- [ ] **Step 2: Create `AdhkarSessionActions.kt`**

```kotlin
package expo.modules.bayaanwidgets.adhkar

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback
import expo.modules.bayaanwidgets.AdhkarSessionAction
import expo.modules.bayaanwidgets.AdhkarSessionLogic
import expo.modules.bayaanwidgets.ContentLogic
import expo.modules.bayaanwidgets.ContentStaticData
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.WidgetStorage
import expo.modules.bayaanwidgets.bayaannow.BayaanNowWidget
import java.util.TimeZone
import org.json.JSONObject

/** Applies one session action for the current period, records completion once, and refreshes both widgets that show it. */
internal object AdhkarSessionActions {
  @Synchronized
  fun apply(context: Context, action: AdhkarSessionAction, nowMs: Long = System.currentTimeMillis()): Boolean {
    val tz = TimeZone.getDefault()
    val data = ContentStaticData.adhkar(context)?.of(ContentLogic.adhkarPeriod(ContentLogic.hour(nowMs, tz))) ?: return false
    val counts = data.items.map { it.repeatCount }
    val before = AdhkarSessionLogic.resolve(
      AdhkarSessionLogic.decode(WidgetStorage.readAdhkarSessionJson(context)),
      data.period, AdhkarSessionLogic.sessionDay(nowMs, tz), counts,
    )
    val after = AdhkarSessionLogic.apply(action, before, counts, nowMs)
    WidgetStorage.writeAdhkarSession(context, AdhkarSessionLogic.encode(after))
    if (!before.completed && after.completed) {
      val props = JSONObject().put("category", data.superId)
        .put("duration_ms", nowMs - (after.startedAtMs ?: nowMs)).put("dhikr_count", counts.size)
      WidgetStorage.addPendingEvent(context, JSONObject().put("name", "adhkar_session_completed").put("props", props))
    }
    return true
  }

  suspend fun run(context: Context, action: AdhkarSessionAction) {
    if (!apply(context, action)) return
    GlanceState.push(context, AdhkarWidget())
    GlanceState.push(context, BayaanNowWidget())
  }
}

class AdhkarNextAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) =
    AdhkarSessionActions.run(context, AdhkarSessionAction.NEXT)
}

class AdhkarPrevAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) =
    AdhkarSessionActions.run(context, AdhkarSessionAction.PREV)
}

class AdhkarCountAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) =
    AdhkarSessionActions.run(context, AdhkarSessionAction.COUNT)
}

class AdhkarRestartAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) =
    AdhkarSessionActions.run(context, AdhkarSessionAction.RESTART)
}
```

Check `ContentLogic.hour`'s real signature and `AdhkarPeriodData.period`'s type, and adapt if `period` is an enum rather than a String. The session stores the lowercase string `"morning"` or `"evening"`, the same value as the JSON.

- [ ] **Step 3: Add a JVM test for the completion event** (append to `AdhkarSessionLogicTest.kt` only if `WidgetStorage` can run without Robolectric; otherwise skip this step, since Task 5's JS test and the device checklist cover the event). Do not add a Robolectric dependency.

- [ ] **Step 4: Create `AdhkarSessionContent.kt`**

Follow the structure, padding and title row of the old medium layout in `AdhkarWidget.kt`, and the Ring bitmap pattern from `tasbeeh/TasbeehWidget.kt`.

```kotlin
package expo.modules.bayaanwidgets.adhkar

// imports: Context, Composable, remember, Glance (GlanceModifier, Image, ImageProvider, layout.*, text.*, action.clickable,
// appwidget.action.actionRunCallback, LocalSize, unit.ColorProvider), android.graphics.Color, and the module's
// ArabicBitmap, ArabicText, RingBitmap, Logo, RoundButton, AdhkarSession, AdhkarPeriodData, SessionDhikr, R

/** Medium and large Adhkar: card through the session (spec 2026-10-12). Mirrors AdhkarSessionView.swift. */
@Composable
fun AdhkarSessionContent(context: Context, data: AdhkarPeriodData, session: AdhkarSession, large: Boolean) {
  val size = LocalSize.current
  val pad = if (large) 16 else 14
  val item: SessionDhikr? = data.items.getOrNull(session.index)
  Column(GlanceModifier.fillMaxSize().padding(pad.dp)) {
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      Text(data.title, style = TextStyle(color = ColorProvider(androidx.compose.ui.graphics.Color.White), fontSize = 14.sp, fontWeight = FontWeight.Bold), maxLines = 1)
      Spacer(GlanceModifier.defaultWeight())
      if (!session.completed) {
        Text("${session.index + 1} of ${data.items.size}", style = TextStyle(color = ColorProvider(androidx.compose.ui.graphics.Color.White.copy(alpha = 0.6f)), fontSize = 11.sp, fontWeight = FontWeight.Medium))
        Spacer(GlanceModifier.width(8.dp))
      }
      Logo(14)
    }
    Spacer(GlanceModifier.height(6.dp))
    ProgressBar(if (session.completed) 1f else session.index.toFloat() / maxOf(1, data.items.size))
    if (session.completed || item == null) {
      Completed(data, large)
    } else {
      val text = if (large) item.largeText else item.mediumText
      val cut = if (large) item.largeCut else item.mediumCut
      val textHeight = size.height.value - pad * 2 - (if (large) 120 else 84)
      Spacer(GlanceModifier.defaultWeight())
      ArabicText(context, text, ArabicBitmap.DHIKR_FONT, size.width.value - pad * 2, textHeight,
        if (large) 22f else 18f, 11f, if (large) 9 else 3, center = true)
      if (large && item.translation != null) {
        Text(item.translation, style = TextStyle(color = ColorProvider(androidx.compose.ui.graphics.Color.White.copy(alpha = 0.75f)), fontSize = 12.sp), maxLines = 3)
      }
      if (cut) {
        Text("Read the rest in ${AppBrand.name(context)} →", style = TextStyle(color = ColorProvider(androidx.compose.ui.graphics.Color.White.copy(alpha = 0.7f)), fontSize = 11.sp, fontWeight = FontWeight.Medium))
      }
      Spacer(GlanceModifier.defaultWeight())
      Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        if (session.index > 0) RoundButton(R.drawable.widget_prev, "Previous", actionRunCallback<AdhkarPrevAction>())
        Spacer(GlanceModifier.defaultWeight())
        CounterRing(context, session.remaining, item.repeatCount, 34)
        Spacer(GlanceModifier.width(12.dp))
        RoundButton(R.drawable.widget_next, "Next", actionRunCallback<AdhkarNextAction>())
      }
    }
  }
}

@Composable
private fun CounterRing(context: Context, remaining: Int, total: Int, sizeDp: Int) {
  val px = (sizeDp * context.resources.displayMetrics.density).toInt()
  val progress = if (total > 1) (total - remaining).toFloat() / total else 0f
  val bmp = remember(remaining, total, px) { RingBitmap.render(px, px * 0.09f, progress, Color.WHITE, 0x33FFFFFF) }
  Box(GlanceModifier.size(sizeDp.dp).clickable(actionRunCallback<AdhkarCountAction>()), contentAlignment = Alignment.Center) {
    Image(ImageProvider(bmp), contentDescription = if (total > 1) "Count, $remaining left" else "Done")
    Text(if (total > 1) "$remaining" else "✓", style = TextStyle(color = ColorProvider(androidx.compose.ui.graphics.Color.White), fontSize = 13.sp, fontWeight = FontWeight.Bold))
  }
}
```

Also write `ProgressBar(fraction: Float)` (a full-width track Box with an inner weighted Box, or Glance's `LinearProgressIndicator` if the module already uses it) and `Completed(data, large)` (a check glyph, "${data.title} completed", and a "Start again" pill with `.clickable(actionRunCallback<AdhkarRestartAction>())`), following the existing UI helpers in `ui/WidgetUi.kt`.

For the prev and next icons:
- Reuse existing drawables if `ui/WidgetUi.kt` or `res/drawable` already has chevrons; check with `ls modules/bayaan-widgets/android/src/main/res/drawable | grep -i -E "prev|next|chevron|back"`.
- Otherwise add `widget_prev.xml` and `widget_next.xml` vector drawables, 24dp, white, Material `chevron_left`/`chevron_right` paths, styled like `widget_reset.xml`.
- `AppBrand.name(context)`: use whatever accessor `AppBrand.kt` actually exposes.

- [ ] **Step 5: Route sizes in `AdhkarWidget.kt`**

  1. Add `WidgetSizes.LARGE` to `SizeMode.Responsive(...)`.
  2. In `AdhkarContent`, keep the small branch (width below `WidgetSizes.MEDIUM.width`) exactly as it is. Replace the medium branch with:
     ```kotlin
     val session = AdhkarSessionLogic.resolve(
       AdhkarSessionLogic.decode(WidgetStorage.readAdhkarSessionJson(context)),
       data.period, AdhkarSessionLogic.sessionDay(nowMs, tz), data.items.map { it.repeatCount },
     )
     val link = appLink(context, AdhkarSessionLogic.link(data.superId, session, data.items.map { it.id }))
     Box(contentRoot().clickable(link)) {
       AdhkarSessionContent(context, data, session, large = LocalSize.current.height >= WidgetSizes.LARGE.height)
     }
     ```
     Keep the small branch's existing root click to `adhkar/${data.superId}`. Reuse the `tz` variable already in scope, or add `val tz = TimeZone.getDefault()`.
  3. In the provider XML, allow resizing to large: set `android:resizeMode="horizontal|vertical"` and a `maxResizeHeight` that covers 250dp, if one is set. Leave the default size as it is.

  Bayaan Now calls `AdhkarContent`, so it picks this up.

- [ ] **Step 6: Compile and test**

Run: `cd android && ./gradlew :bayaan-widgets:compileDebugKotlin :bayaan-widgets:testDebugUnitTest`
Expected: BUILD SUCCESSFUL, with all tests passing.

- [ ] **Step 7: Commit**

```bash
git add modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/WidgetStorage.kt modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/adhkar/ modules/bayaan-widgets/android/src/main/res/
git commit -m "feat(widgets): make the Android adhkar widget an interactive session"
```

Before committing, run `git status` and stage only the files that this task changed under `res/`.

---

### Task 5: Completion events reach analytics

**Files:**
- Modify: `modules/bayaan-widgets/ios/BayaanWidgetsModule.swift`: add `Function("takePendingWidgetEvents") { () -> String in takeString("widgets.pendingEvents") }` next to `takePendingTasbeeh`.
- Modify: `.../BayaanWidgetsModule.kt`: add `Function("takePendingWidgetEvents") { WidgetStorage.takePendingEvents(context) }` next to `takePendingTasbeeh`.
- Modify: `modules/bayaan-widgets/src/NativeBayaanWidgets.ts`: add `takePendingWidgetEvents(): string;` to the interface, plus the web or stub implementation if the file has one (mirror `takePendingTasbeeh`).
- Create: `modules/bayaan-widgets/src/widgetEvents.ts` and `modules/bayaan-widgets/src/__tests__/widgetEvents.test.ts`
- Modify: `modules/bayaan-widgets/src/index.ts`: export `takePendingWidgetEvents`.
- Modify: `services/widgets/syncConfiguredWidgets.ts` and `services/widgets/__tests__/syncConfiguredWidgets.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface AdhkarSessionCompletedEvent {
    name: 'adhkar_session_completed';
    props: {category: string; duration_ms: number; dhikr_count: number};
  }
  export type PendingWidgetEvent = AdhkarSessionCompletedEvent;
  export function parsePendingWidgetEvents(json: string | null): PendingWidgetEvent[];
  export function takePendingWidgetEvents(): PendingWidgetEvent[];
  export function consumeWidgetEvents(): void; // services/widgets/syncConfiguredWidgets.ts
  ```

- [ ] **Step 1: Write the failing parser test** `modules/bayaan-widgets/src/__tests__/widgetEvents.test.ts`

```ts
import {parsePendingWidgetEvents} from '../widgetEvents';

describe('parsePendingWidgetEvents', () => {
  it('parses completed sessions', () => {
    const json = JSON.stringify([
      {name: 'adhkar_session_completed', props: {category: 'morning-adhkar', duration_ms: 1200, dhikr_count: 24}},
    ]);
    expect(parsePendingWidgetEvents(json)).toEqual([
      {name: 'adhkar_session_completed', props: {category: 'morning-adhkar', duration_ms: 1200, dhikr_count: 24}},
    ]);
  });
  it('returns [] for junk', () => {
    expect(parsePendingWidgetEvents('nope')).toEqual([]);
    expect(parsePendingWidgetEvents(null)).toEqual([]);
    expect(parsePendingWidgetEvents('{}')).toEqual([]);
  });
  it('drops unknown names and bad props', () => {
    const json = JSON.stringify([
      {name: 'other', props: {}},
      {name: 'adhkar_session_completed', props: {category: 1, duration_ms: 1, dhikr_count: 1}},
    ]);
    expect(parsePendingWidgetEvents(json)).toEqual([]);
  });
});
```

Run: `npx jest modules/bayaan-widgets/src/__tests__/widgetEvents.test.ts`
Expected: FAIL (cannot find module).

- [ ] **Step 2: Implement `widgetEvents.ts`**

```ts
// modules/bayaan-widgets/src/widgetEvents.ts
// Analytics events raised by widget actions while the app was not running.

export interface AdhkarSessionCompletedEvent {
  name: 'adhkar_session_completed';
  props: {category: string; duration_ms: number; dhikr_count: number};
}

export type PendingWidgetEvent = AdhkarSessionCompletedEvent;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAdhkarSessionCompleted(
  value: unknown,
): value is AdhkarSessionCompletedEvent {
  if (!isRecord(value) || value.name !== 'adhkar_session_completed') {
    return false;
  }
  const props = value.props;
  return (
    isRecord(props) &&
    typeof props.category === 'string' &&
    typeof props.duration_ms === 'number' &&
    typeof props.dhikr_count === 'number'
  );
}

export function parsePendingWidgetEvents(
  json: string | null,
): PendingWidgetEvent[] {
  if (!json) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const items: unknown[] = parsed;
  return items.filter(isAdhkarSessionCompleted);
}
```

In `index.ts`, next to `takePendingTasbeeh`:

```ts
export function takePendingWidgetEvents(): PendingWidgetEvent[] {
  return parsePendingWidgetEvents(NativeBayaanWidgets.takePendingWidgetEvents());
}
```

Mirror whatever platform guard `takePendingTasbeeh` uses. Also re-export the types from `index.ts`.

Run: `npx jest modules/bayaan-widgets/src/__tests__/widgetEvents.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing consumer test** in `syncConfiguredWidgets.test.ts`

Mock `takePendingWidgetEvents` and `analyticsService.trackAdhkarSessionCompleted` the same way that file already mocks `takePendingTasbeeh` and its other dependencies.

```ts
it('sends queued adhkar completions to analytics once', () => {
  mockTakePendingWidgetEvents.mockReturnValueOnce([
    {name: 'adhkar_session_completed', props: {category: 'evening-adhkar', duration_ms: 90000, dhikr_count: 24}},
  ]);
  consumeWidgetEvents();
  expect(mockTrackAdhkarSessionCompleted).toHaveBeenCalledWith({category: 'evening-adhkar', duration_ms: 90000, dhikr_count: 24});
  mockTakePendingWidgetEvents.mockReturnValueOnce([]);
  consumeWidgetEvents();
  expect(mockTrackAdhkarSessionCompleted).toHaveBeenCalledTimes(1);
});

it('keeps going when the native queue throws', () => {
  mockTakePendingWidgetEvents.mockImplementationOnce(() => {
    throw new Error('boom');
  });
  expect(() => consumeWidgetEvents()).not.toThrow();
});
```

Run: `npx jest services/widgets/__tests__/syncConfiguredWidgets.test.ts`
Expected: FAIL (`consumeWidgetEvents` is not exported).

- [ ] **Step 4: Implement `consumeWidgetEvents`** in `syncConfiguredWidgets.ts`, after `consumeTasbeehIncrements`

```ts
// Sends analytics events raised by widget actions (adhkar session completed).
export function consumeWidgetEvents(): void {
  try {
    for (const event of takePendingWidgetEvents()) {
      if (event.name === 'adhkar_session_completed') {
        analyticsService.trackAdhkarSessionCompleted(event.props);
      }
    }
  } catch (error) {
    console.error('[WidgetSync] Failed to send widget events:', error);
  }
}
```

Call `consumeWidgetEvents();` in `refresh()`, right after the `consumeTasbeehIncrements()` call. Import `analyticsService` from the path other services use (`@/services/analytics/AnalyticsService`, verified by grep) and `takePendingWidgetEvents` from the module entry, the same way `takePendingTasbeeh` is imported.

Run: `npx jest services/widgets modules/bayaan-widgets/src`
Expected: PASS.

- [ ] **Step 5: Typecheck, format, commit**

```bash
npx tsc --noEmit
npx prettier --write modules/bayaan-widgets/src/widgetEvents.ts modules/bayaan-widgets/src/__tests__/widgetEvents.test.ts modules/bayaan-widgets/src/index.ts modules/bayaan-widgets/src/NativeBayaanWidgets.ts services/widgets/syncConfiguredWidgets.ts services/widgets/__tests__/syncConfiguredWidgets.test.ts
git add modules/bayaan-widgets/ios/BayaanWidgetsModule.swift modules/bayaan-widgets/android/src/main/java/expo/modules/bayaanwidgets/BayaanWidgetsModule.kt modules/bayaan-widgets/src/widgetEvents.ts modules/bayaan-widgets/src/__tests__/widgetEvents.test.ts modules/bayaan-widgets/src/index.ts modules/bayaan-widgets/src/NativeBayaanWidgets.ts services/widgets/syncConfiguredWidgets.ts services/widgets/__tests__/syncConfiguredWidgets.test.ts
git commit -m "feat(widgets): send adhkar session completions from the widget to analytics"
```

---

### Task 6: Adhkar screen scrolls to a dhikr from a link

**Files:**
- Modify: `app/(tabs)/(a.home)/adhkar/[superId]/index.tsx`

**Interfaces:**
- Consumes: the link format from Task 2, `adhkar/<superId>?dhikr=<id>`.

- [ ] **Step 1: Implement**

  1. Change line 64 to `const {superId, dhikr} = useLocalSearchParams<{superId: string; dhikr?: string}>();`.
  2. Add `const listRef = useRef<FlatList<DhikrItem>>(null);`. Import `useRef` and `useEffect` if they are not already imported.
  3. Add, after `flatAdhkarList` is defined:

```tsx
// A widget link (adhkar/<superId>?dhikr=<id>) opens the list at that dhikr.
const scrolledTo = useRef<string | null>(null);
useEffect(() => {
  if (!dhikr || scrolledTo.current === dhikr) return;
  const index = flatAdhkarList.findIndex(item => item.dhikr.id === dhikr);
  if (index <= 0) return;
  scrolledTo.current = dhikr;
  requestAnimationFrame(() => {
    listRef.current?.scrollToIndex({
      index,
      animated: false,
      viewOffset: USE_GLASS ? headerHeight : 0,
    });
  });
}, [dhikr, flatAdhkarList, headerHeight]);

const onScrollToIndexFailed = useCallback(
  (info: {index: number; averageItemLength: number}) => {
    listRef.current?.scrollToOffset({
      offset: info.averageItemLength * info.index,
      animated: false,
    });
    setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: info.index,
        animated: false,
        viewOffset: USE_GLASS ? headerHeight : 0,
      });
    }, 100);
  },
  [headerHeight],
);
```

  4. On the single-category `<FlatList>`, add `ref={listRef}` and `onScrollToIndexFailed={onScrollToIndexFailed}`. Leave the `SectionList` branch alone (morning and evening are single-category).

- [ ] **Step 2: Typecheck and format**

Run: `npx tsc --noEmit && npx prettier --write "app/(tabs)/(a.home)/adhkar/[superId]/index.tsx"`
Expected: no errors.

- [ ] **Step 3: Verify on the iOS simulator**

Use argent on a booted simulator. Never use "(test)" or "(test 2)".
- Open `bayaan://adhkar/morning-adhkar?dhikr=86` with argent `open-url`. Expected: the list opens with dhikr 86 at the top, below the header.
- Open `bayaan://adhkar/morning-adhkar`. Expected: the list opens at the top.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/(a.home)/adhkar/[superId]/index.tsx"
git commit -m "feat(adhkar): open the adhkar list at a dhikr from a widget link"
```

---

### Task 7: On-device checklist and text budget calibration

**Files:**
- Create: `docs/superpowers/plans/2026-10-12-adhkar-session-device-checklist.md`
- Possibly modify: `SESSION_MEDIUM_CHARS` / `SESSION_LARGE_CHARS` in `services/widgets/widgetStaticData.ts`, plus the regenerated JSON

- [ ] **Step 1: Build and install on simulators.** Do not use a physical device.
  - iOS simulator: install a debug build. Add a medium and a large Adhkar widget.
  - Android emulator: use a booted one (never kill BayaanAAOS15). Install the debug APK with `cd android && ./gradlew :app:installDebug` and add both sizes.

- [ ] **Step 2: Walk the checklist and record each result (pass/fail plus a screenshot path) in the checklist doc**
  1. Card 1 shows "1 of 24", no Prev button, and the counter shows a check (dhikr 75 is said once).
  2. Next goes to card 2 (dhikr 76, x3). The ring shows 3; tapping it goes 2, then 1, then advances to card 3.
  3. Prev from card 3 returns to card 2 with the ring back at 3.
  4. A long dhikr (77 on medium) shows the opening, the "…", and "Read the rest in Bayaan →". On large, 77 shows the full text unless its `largeCut` is true.
  5. A body tap on card 3 opens the list scrolled to dhikr 77. A body tap on card 1 opens the list at the top.
  6. Advance to the end. The completed state shows; Start again returns to card 1. Relaunch the app and confirm `adhkar_session_completed` is captured (debug log or PostHog live events).
  7. Bayaan Now during adhkar hours (set the simulator clock or wait) shows the same session, and a tap on either widget updates both.
  8. The small widget is unchanged, with the English title.

- [ ] **Step 3: Calibrate the budgets.**
  - If a medium card with `mediumCut == false` visibly shrinks below a readable size (about 14pt), lower `SESSION_MEDIUM_CHARS`.
  - If cards are cut while there is clearly room, raise it.
  - Do the same for large.
  - Re-run `npm run generate:widget-data` and the Task 1 tests, then commit:

```bash
git add services/widgets/widgetStaticData.ts targets/widgets/adhkar-periods.json modules/bayaan-widgets/android/src/main/assets/widgets/adhkar-periods.json docs/superpowers/plans/2026-10-12-adhkar-session-device-checklist.md
git commit -m "chore(widgets): calibrate adhkar session text budgets on device"
```

- [ ] **Step 4: Run the full verification**

Run each of these:
- `npx tsc --noEmit`
- `npx jest services/widgets modules/bayaan-widgets/src plugins`
- `bash scripts/check-widget-content.sh`
- `npm run test:widget-fixtures`
- `cd android && ./gradlew :bayaan-widgets:testDebugUnitTest`
- The iOS xcodebuild command from Global Constraints

Expected: all pass.
