# Adhkar Playback (Plan A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the screen-scoped adhkar audio with one app-wide, saved, coordinated adhkar session, and add the ways back to it: a Home tile, an Adhkar screen row, a jump pill, card indicators and the lock screen.

**Architecture:**
- A pure reducer holds every playback rule.
- A small zustand store wraps the reducer.
- A module-level engine owns one expo-audio player made with `keepAudioSessionActive`. It follows the store and reports player events back to it.
- Screens only dispatch events and read state.
- Saving, restoring and stale checks live in their own module on AsyncStorage.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router, expo-audio 57.0.5, zustand, react-native-reanimated, AsyncStorage, jest with @testing-library/react-native, i18next.

**Spec:** `docs/superpowers/specs/2026-10-13-adhkar-playback-design.md`, sections 3 to 6 and 8 to 10. The Live Activity (section 7) is Plan B and is not part of this plan.

## Global Constraints

**Code**
- TypeScript strict. No `any`, and no `as` casts unless unavoidable (state why in a comment).
- Functional patterns. No new classes; the engine is module functions with closure state.
- Use the `function` keyword for pure functions, and explicit parameter and return types on exported functions.
- Match the surrounding code's comment density and naming. No drive-by refactors.

**Copy and style**
- No em dashes anywhere: code, comments, commit messages, copy.
- Never use `theme.colors.primary` or accent colors. Use `theme.colors.text`, `textSecondary` and `background` with alpha.
- All new user-facing strings are i18n keys in `i18n/locales/en/*.json` and `i18n/locales/ar/*.json`, and `npm run i18n:check` passes. Reuse `home:adhkar.position` ("{{current}} of {{total}}").
- The playing bars and the pill respect Reduce Motion (`useReducedMotion` from react-native-reanimated).

**Commits**
- Conventional commits, each ending with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011eqXmha1bR7cUTY365d9K1
  ```
- Never commit `ios/` or `android/` drift. Never push.

**Before a task reports DONE**
- `npx tsc --noEmit` is clean. Errors only in `services/widgets/syncContentWidgets.ts` about HijriDate/Occasion come from the symlinked node_modules and are pre-existing; report them, don't fix them.
- `node node_modules/prettier/bin/prettier.cjs --check <changed files>` is clean. This is Prettier 3; `npx prettier` is v2, so never use it.
- The task's jest tests pass: `npx jest <paths>`.

**Fixed values from the spec**
- Storage key `adhkar-session-v1`.
- Window boundaries 04:00 and 15:00 local time.
- Other lists go stale after 24 h.
- Play confirmation timeout 1500 ms, with one retry.
- Progress polling every 250 ms.
- Arabic preview of 60 characters.
- Indicator tint: `theme.colors.text` at 6% alpha.
- Pill fade: 150 ms.

## Review Focus

1. **A clip ends while the app is in the background.** The next clip must start. The engine never builds a second player, and the stale-`didJustFinish` guard must not drop a real end. Task 3 tests "finish after replace" and "short clip".
2. **Lock screen or headphone pause and play.** The store must follow the player and must not fight it with an immediate re-play. Task 3 tests remote pause and resume.
3. **Restore after a reseed removed the saved dhikr.** The session is dropped, not restored at index 0. Task 2 tests it.
4. **Same dhikr in Morning and Evening.** Only the session's list shows the indicator, the pill and the "current" card state. Tasks 4, 6 and 7 assert on `listId`, never on `dhikrId` alone.
5. **Window boundaries:** 03:59, 04:00, 14:59 and 15:00, plus a session saved exactly on a boundary. Task 2 tests them.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `services/adhkar/playback/types.ts` | create | `SessionItem`, `SessionSource`, `AdhkarSession`, `SessionEvent`, `SavedSession` types |
| `services/adhkar/playback/sessionReducer.ts` | create | pure rules, `nextPlayableIndex`, `toSessionItems` |
| `services/adhkar/timeWindows.ts` | create | Morning/Evening windows and `nextWindowBoundaryAfter` |
| `services/adhkar/playback/sessionPersistence.ts` | create | save, load, stale check and restore |
| `store/adhkarSessionStore.ts` | create | zustand store: `session`, `revealToken`, `dispatch`, `requestReveal` |
| `services/adhkar/playback/adhkarPlaybackEngine.ts` | create | the single player, store follower, retry, remote events, position, lock screen calls |
| `services/audio/AudioCoordinator.ts` | modify | `'adhkar'` source |
| `services/audio/LockScreenService.ts` | modify | `activateAdhkar`, `clearAdhkar`, the main-store guard |
| `services/audio/ExpoAudioProvider.tsx` | modify | start the engine and the restore after `lockScreenService.startSync()` |
| `hooks/useAdhkarProgress.ts` | create | polling progress and seek for the current clip |
| `components/adhkar/AdhkarSessionSourceContext.tsx` | create | gives reader cards their list as a `SessionSource` |
| `components/adhkar/AdhkarAudioControls.tsx` | modify | rules 1 and 2, the fixed progress row, loop |
| `components/adhkar/DhikrReader.tsx` | modify | passes `dhikrId` to the controls |
| `app/(tabs)/(a.home)/adhkar/[superId]/[dhikrId].tsx` | modify | session follow, reveal, swipe, focus registry, source provider |
| `app/(tabs)/(a.home)/adhkar/saved/[dhikrId].tsx` | modify | same for Saved |
| `app/(tabs)/(a.home)/adhkar/[superId]/index.tsx` | modify | Play All through the store, focus registry, pill, indicator props |
| `app/(tabs)/(a.home)/adhkar/saved/index.tsx` | modify | same for Saved |
| `app/(tabs)/(a.home)/adhkar/_layout.tsx` | modify | drop `AdhkarAudioProvider` |
| `services/adhkar/playback/openPlayingDhikr.ts` | create | focus registry, `planOpenPlaying`, `openPlayingDhikr` |
| `app/adhkar-playing.tsx` | create | deep link `bayaan://adhkar-playing` |
| `components/adhkar/PlayingBars.tsx` | create | three animated bars |
| `components/adhkar/DhikrListItem.tsx` | modify | `isPlaying` and `isCurrent` props: bars and tint |
| `components/adhkar/AdhkarNowPlayingCard.tsx` | create | the `tile` (Home) and `row` (Adhkar screen) variants |
| `components/RecitersView.tsx` | modify | the adhkar tile at the head of Continue Listening |
| `components/AdhkarView.tsx` | modify | the row above `SavedAdhkarHero` |
| `components/adhkar/AdhkarJumpPill.tsx` | create | the pill and the pure `jumpPillDirection` |
| deleted | delete | `store/adhkarAudioStore.ts`, `store/adhkarPlayAllStore.ts`, `store/__tests__/adhkarPlayAllStore.test.ts`, `components/adhkar/AdhkarAudioProvider.tsx`, `hooks/useAdhkarAudio.ts`, `utils/adhkarTrackEnd.ts`, `utils/__tests__/adhkarTrackEnd.test.ts` |

`components/adhkar/playAllScrollGuard.ts` (`resolveViewableChange`) stays and is reused.

---

### Task 1: Session types and reducer

**Files:**
- Create: `services/adhkar/playback/types.ts`
- Create: `services/adhkar/playback/sessionReducer.ts`
- Test: `services/adhkar/playback/__tests__/sessionReducer.test.ts`

**Interfaces:**
- Consumes: `hasAudio(audioFile: string | null): boolean` from `@/utils/adhkarAudio`, `adhkarCopyText(arabic: string): string` from `@/utils/adhkarText`, and `Dhikr` from `@/types/adhkar`.
- Produces: every type in `types.ts`, plus these functions:
  - `reduceSession(state: AdhkarSession | null, event: SessionEvent, now: number): AdhkarSession | null`
  - `nextPlayableIndex(items: readonly SessionItem[], from: number): number`
  - `toSessionItems(list: readonly Dhikr[]): SessionItem[]`
  - `currentItem(session: AdhkarSession): SessionItem | null`

- [ ] **Step 1: Write the types**

```ts
// services/adhkar/playback/types.ts
// Adhkar playback session: one list playing (or paused, or saved) app-wide.

export interface SessionItem {
  dhikrId: string;
  audioFile: string | null;
  // False when the row has no bundled audio; such rows are skipped.
  playable: boolean;
  // First 60 characters of the clean Arabic (Live Activity, Plan B).
  preview: string;
}

export interface SessionSource {
  listId: string; // superId, or 'saved'
  listTitle: string; // already localized, as the list screen shows it
  items: SessionItem[];
}

export type SessionStatus = 'loading' | 'playing' | 'paused';
export type SessionMode = 'single' | 'all';

export interface AdhkarSession extends SessionSource {
  index: number;
  mode: SessionMode;
  loop: boolean;
  status: SessionStatus;
  error: boolean;
  trackToken: number;
  positionSec: number;
  lastActiveAt: number;
}

export type SessionEvent =
  | {type: 'pressCard'; source: SessionSource; index: number}
  | {type: 'pressPlayAll'; source: SessionSource}
  | {type: 'swipedTo'; listId: string; index: number}
  | {type: 'toggle'}
  | {type: 'stop'}
  | {type: 'toggleLoop'}
  | {type: 'trackEnded'; token: number}
  | {type: 'playStarted'; token: number}
  | {type: 'playFailed'; token: number}
  | {type: 'playerPaused'}
  | {type: 'playerResumed'}
  | {type: 'otherAudioStarted'}
  | {type: 'positionSaved'; positionSec: number}
  | {type: 'restored'; session: AdhkarSession};

export interface SavedSession {
  listId: string;
  listTitle: string;
  mode: SessionMode;
  loop: boolean;
  dhikrId: string;
  positionSec: number;
  lastActiveAt: number;
}
```

- [ ] **Step 2: Write the failing reducer tests**

```ts
// services/adhkar/playback/__tests__/sessionReducer.test.ts
import {
  reduceSession,
  nextPlayableIndex,
} from '@/services/adhkar/playback/sessionReducer';
import type {
  AdhkarSession,
  SessionItem,
  SessionSource,
} from '@/services/adhkar/playback/types';

const NOW = 1_000_000;

function item(id: string, playable = true): SessionItem {
  return {dhikrId: id, audioFile: playable ? `${id}.mp3` : null, playable, preview: id};
}

function source(listId: string, ids: string[], silent: string[] = []): SessionSource {
  return {
    listId,
    listTitle: listId,
    items: ids.map(id => item(id, !silent.includes(id))),
  };
}

const morning = source('morning-adhkar', ['a', 'b', 'c', 'd'], ['c']);
const evening = source('evening-adhkar', ['a', 'x']);

function session(over: Partial<AdhkarSession> = {}): AdhkarSession {
  return {
    ...morning,
    index: 0,
    mode: 'all',
    loop: false,
    status: 'playing',
    error: false,
    trackToken: 1,
    positionSec: 0,
    lastActiveAt: 0,
    ...over,
  };
}

describe('nextPlayableIndex', () => {
  it('skips rows without audio', () => {
    expect(nextPlayableIndex(morning.items, 2)).toBe(3);
  });
  it('returns -1 past the end', () => {
    expect(nextPlayableIndex(morning.items, 4)).toBe(-1);
  });
});

describe('rule 1: start from a card', () => {
  it('starts a single session when nothing plays', () => {
    const s = reduceSession(null, {type: 'pressCard', source: morning, index: 1}, NOW);
    expect(s).toMatchObject({listId: 'morning-adhkar', index: 1, mode: 'single', status: 'loading', positionSec: 0, lastActiveAt: NOW});
  });
  it('replaces an all session of another list with a single session', () => {
    const s = reduceSession(session(), {type: 'pressCard', source: evening, index: 1}, NOW);
    expect(s).toMatchObject({listId: 'evening-adhkar', index: 1, mode: 'single', status: 'loading'});
  });
  it('jumps inside an all session of the same list and stays all', () => {
    const before = session({index: 0, trackToken: 4});
    const s = reduceSession(before, {type: 'pressCard', source: morning, index: 3}, NOW);
    expect(s).toMatchObject({mode: 'all', index: 3, status: 'loading', trackToken: 5});
  });
  it('ignores a card without audio', () => {
    expect(reduceSession(null, {type: 'pressCard', source: morning, index: 2}, NOW)).toBeNull();
  });
  it('treats the same dhikr in another list as a different card', () => {
    const before = session({index: 0});
    const s = reduceSession(before, {type: 'pressCard', source: evening, index: 0}, NOW);
    expect(s).toMatchObject({listId: 'evening-adhkar', mode: 'single', status: 'loading'});
  });
});

describe('rule 2: toggle the current card', () => {
  it('pauses a playing current card', () => {
    const s = reduceSession(session({index: 1}), {type: 'pressCard', source: morning, index: 1}, NOW);
    expect(s).toMatchObject({status: 'paused', index: 1});
  });
  it('resumes a paused current card through loading', () => {
    const s = reduceSession(session({index: 1, status: 'paused', positionSec: 3}), {type: 'pressCard', source: morning, index: 1}, NOW);
    expect(s).toMatchObject({status: 'loading', positionSec: 3});
  });
});

describe('rule 3: Play All', () => {
  it('starts at the first playable row', () => {
    const s = reduceSession(null, {type: 'pressPlayAll', source: source('l', ['q', 'r'], ['q'])}, NOW);
    expect(s).toMatchObject({index: 1, mode: 'all', status: 'loading'});
  });
  it('ends the session when pressed on the active all list', () => {
    expect(reduceSession(session(), {type: 'pressPlayAll', source: morning}, NOW)).toBeNull();
  });
  it('replaces a single session of the same list', () => {
    const s = reduceSession(session({mode: 'single', index: 3}), {type: 'pressPlayAll', source: morning}, NOW);
    expect(s).toMatchObject({mode: 'all', index: 0});
  });
  it('does nothing for a list without audio', () => {
    expect(reduceSession(null, {type: 'pressPlayAll', source: source('l', ['q'], ['q'])}, NOW)).toBeNull();
  });
});

describe('rule 4: advance', () => {
  it('moves to the next playable row in all mode', () => {
    const s = reduceSession(session({index: 1, trackToken: 2}), {type: 'trackEnded', token: 2}, NOW);
    expect(s).toMatchObject({index: 3, status: 'loading', trackToken: 3, positionSec: 0});
  });
  it('ends after the last row', () => {
    expect(reduceSession(session({index: 3, trackToken: 2}), {type: 'trackEnded', token: 2}, NOW)).toBeNull();
  });
  it('ends a single session when its clip ends', () => {
    expect(reduceSession(session({mode: 'single', trackToken: 2}), {type: 'trackEnded', token: 2}, NOW)).toBeNull();
  });
  it('ignores an end for a stale token', () => {
    const before = session({index: 1, trackToken: 2});
    expect(reduceSession(before, {type: 'trackEnded', token: 1}, NOW)).toBe(before);
  });
});

describe('rule 5: swiping in the reader', () => {
  it('moves playback in the active all list', () => {
    const s = reduceSession(session({index: 0, trackToken: 1}), {type: 'swipedTo', listId: 'morning-adhkar', index: 1}, NOW);
    expect(s).toMatchObject({index: 1, status: 'loading', trackToken: 2});
  });
  it('stays paused when swiping a paused all session', () => {
    const s = reduceSession(session({status: 'paused'}), {type: 'swipedTo', listId: 'morning-adhkar', index: 1}, NOW);
    expect(s).toMatchObject({index: 1, status: 'paused'});
  });
  it('pauses on a row without audio', () => {
    const s = reduceSession(session(), {type: 'swipedTo', listId: 'morning-adhkar', index: 2}, NOW);
    expect(s).toMatchObject({index: 2, status: 'paused'});
  });
  it('ignores swipes in single mode', () => {
    const before = session({mode: 'single'});
    expect(reduceSession(before, {type: 'swipedTo', listId: 'morning-adhkar', index: 1}, NOW)).toBe(before);
  });
  it('ignores swipes in another list', () => {
    const before = session();
    expect(reduceSession(before, {type: 'swipedTo', listId: 'evening-adhkar', index: 1}, NOW)).toBe(before);
  });
});

describe('rules 7 and 8, player events', () => {
  it('stop ends the session', () => {
    expect(reduceSession(session(), {type: 'stop'}, NOW)).toBeNull();
  });
  it('other audio pauses but keeps the session', () => {
    expect(reduceSession(session(), {type: 'otherAudioStarted'}, NOW)).toMatchObject({status: 'paused'});
  });
  it('toggle flips playing and paused', () => {
    expect(reduceSession(session(), {type: 'toggle'}, NOW)).toMatchObject({status: 'paused'});
    expect(reduceSession(session({status: 'paused'}), {type: 'toggle'}, NOW)).toMatchObject({status: 'loading'});
  });
  it('playStarted confirms only the current token', () => {
    expect(reduceSession(session({status: 'loading', trackToken: 3}), {type: 'playStarted', token: 3}, NOW)).toMatchObject({status: 'playing', error: false});
    const before = session({status: 'loading', trackToken: 3});
    expect(reduceSession(before, {type: 'playStarted', token: 2}, NOW)).toBe(before);
  });
  it('playFailed pauses with an error', () => {
    expect(reduceSession(session({status: 'loading', trackToken: 3}), {type: 'playFailed', token: 3}, NOW)).toMatchObject({status: 'paused', error: true});
  });
  it('remote pause and resume follow the player', () => {
    expect(reduceSession(session(), {type: 'playerPaused'}, NOW)).toMatchObject({status: 'paused'});
    expect(reduceSession(session({status: 'paused'}), {type: 'playerResumed'}, NOW)).toMatchObject({status: 'playing'});
  });
  it('toggleLoop only applies in single mode', () => {
    expect(reduceSession(session({mode: 'single'}), {type: 'toggleLoop'}, NOW)).toMatchObject({loop: true});
    const all = session();
    expect(reduceSession(all, {type: 'toggleLoop'}, NOW)).toBe(all);
  });
  it('positionSaved does not touch lastActiveAt', () => {
    expect(reduceSession(session({lastActiveAt: 5}), {type: 'positionSaved', positionSec: 12}, NOW)).toMatchObject({positionSec: 12, lastActiveAt: 5});
  });
  it('restored replaces the state', () => {
    const restored = session({status: 'paused', index: 3});
    expect(reduceSession(null, {type: 'restored', session: restored}, NOW)).toBe(restored);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest services/adhkar/playback/__tests__/sessionReducer.test.ts`
Expected: FAIL with "Cannot find module '@/services/adhkar/playback/sessionReducer'".

- [ ] **Step 4: Implement the reducer**

```ts
// services/adhkar/playback/sessionReducer.ts
// Pure adhkar playback rules (spec section 3.3). The engine and the screens
// only dispatch events; every decision about what plays lives here.
import {hasAudio} from '@/utils/adhkarAudio';
import {adhkarCopyText} from '@/utils/adhkarText';
import type {Dhikr} from '@/types/adhkar';
import type {
  AdhkarSession,
  SessionEvent,
  SessionItem,
  SessionSource,
} from './types';

const PREVIEW_LENGTH = 60;

/** First index at or after `from` whose item has audio, or -1. */
export function nextPlayableIndex(
  items: readonly SessionItem[],
  from: number,
): number {
  for (let i = Math.max(0, from); i < items.length; i++) {
    if (items[i].playable) return i;
  }
  return -1;
}

export function toSessionItems(list: readonly Dhikr[]): SessionItem[] {
  return list.map(dhikr => ({
    dhikrId: dhikr.id,
    audioFile: dhikr.audioFile,
    playable: hasAudio(dhikr.audioFile),
    preview: adhkarCopyText(dhikr.arabic).slice(0, PREVIEW_LENGTH),
  }));
}

export function currentItem(session: AdhkarSession): SessionItem | null {
  return session.items[session.index] ?? null;
}

function startSession(
  source: SessionSource,
  index: number,
  mode: AdhkarSession['mode'],
  previousToken: number,
  now: number,
): AdhkarSession {
  return {
    listId: source.listId,
    listTitle: source.listTitle,
    items: source.items,
    index,
    mode,
    loop: false,
    status: 'loading',
    error: false,
    trackToken: previousToken + 1,
    positionSec: 0,
    lastActiveAt: now,
  };
}

function moveTo(
  session: AdhkarSession,
  index: number,
  keepPaused: boolean,
  now: number,
): AdhkarSession {
  const playable = session.items[index]?.playable ?? false;
  return {
    ...session,
    index,
    status: !playable || keepPaused ? 'paused' : 'loading',
    error: false,
    trackToken: session.trackToken + 1,
    positionSec: 0,
    lastActiveAt: now,
  };
}

function toggled(session: AdhkarSession, now: number): AdhkarSession {
  if (session.status === 'paused') {
    return {...session, status: 'loading', error: false, lastActiveAt: now};
  }
  return {...session, status: 'paused', lastActiveAt: now};
}

export function reduceSession(
  state: AdhkarSession | null,
  event: SessionEvent,
  now: number,
): AdhkarSession | null {
  const token = state?.trackToken ?? 0;
  switch (event.type) {
    case 'pressCard': {
      const target = event.source.items[event.index];
      if (!target?.playable) return state;
      if (
        state &&
        state.listId === event.source.listId &&
        state.items[state.index]?.dhikrId === target.dhikrId
      ) {
        return toggled(state, now);
      }
      if (state && state.mode === 'all' && state.listId === event.source.listId) {
        return moveTo(state, event.index, false, now);
      }
      return startSession(event.source, event.index, 'single', token, now);
    }
    case 'pressPlayAll': {
      if (state && state.mode === 'all' && state.listId === event.source.listId) {
        return null;
      }
      const first = nextPlayableIndex(event.source.items, 0);
      if (first < 0) return state;
      return startSession(event.source, first, 'all', token, now);
    }
    case 'swipedTo': {
      if (!state || state.mode !== 'all' || state.listId !== event.listId) return state;
      if (event.index === state.index) return state;
      return moveTo(state, event.index, state.status === 'paused', now);
    }
    case 'trackEnded': {
      if (!state || event.token !== state.trackToken) return state;
      if (state.mode === 'single') return null;
      const next = nextPlayableIndex(state.items, state.index + 1);
      if (next < 0) return null;
      return moveTo(state, next, false, now);
    }
    case 'toggle':
      return state ? toggled(state, now) : state;
    case 'stop':
      return null;
    case 'toggleLoop':
      if (!state || state.mode !== 'single') return state;
      return {...state, loop: !state.loop, lastActiveAt: now};
    case 'playStarted':
      if (!state || event.token !== state.trackToken || state.status !== 'loading') return state;
      return {...state, status: 'playing', error: false};
    case 'playFailed':
      if (!state || event.token !== state.trackToken) return state;
      return {...state, status: 'paused', error: true};
    case 'playerPaused':
      if (!state || state.status !== 'playing') return state;
      return {...state, status: 'paused', lastActiveAt: now};
    case 'playerResumed':
      if (!state || state.status !== 'paused') return state;
      return {...state, status: 'playing', error: false, lastActiveAt: now};
    case 'otherAudioStarted':
      if (!state || state.status === 'paused') return state;
      return {...state, status: 'paused', lastActiveAt: now};
    case 'positionSaved':
      if (!state) return state;
      return {...state, positionSec: event.positionSec};
    case 'restored':
      return event.session;
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest services/adhkar/playback/__tests__/sessionReducer.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/adhkar/playback
git commit -m "feat(adhkar): pure playback session reducer"
```

---

### Task 2: Time windows, store, saving and restore

**Files:**
- Create: `services/adhkar/timeWindows.ts`
- Create: `store/adhkarSessionStore.ts`
- Create: `services/adhkar/playback/sessionPersistence.ts`
- Test: `services/adhkar/__tests__/timeWindows.test.ts`
- Test: `services/adhkar/playback/__tests__/sessionPersistence.test.ts`

**Interfaces:**
- Consumes: the Task 1 types, `reduceSession` and `toSessionItems`; `adhkarService.getAdhkarForSuperCategory(superId)`, `adhkarService.getSaved()` and `adhkarService.getDhikr(id)` from `@/services/adhkar/AdhkarService`.
- Produces:
  - `useAdhkarSessionStore`, a zustand hook with state `{session: AdhkarSession | null; revealToken: number}` and actions `dispatch(event: SessionEvent): void`, `requestReveal(): void`.
  - `nextWindowBoundaryAfter(ms: number): number`
  - `adhkarWindowAt(ms: number): 'morning' | 'evening'`
  - `toSavedSession(session: AdhkarSession): SavedSession | null`
  - `isSavedSessionStale(saved: SavedSession, now: number): boolean`
  - `saveSession(session: AdhkarSession | null): Promise<void>`
  - `loadSavedSession(): Promise<SavedSession | null>`
  - `restoreSavedSession(loadItems?: (listId: string) => Promise<SessionItem[] | null>): Promise<void>`
  - `dropStaleSession(now: number): void`
  - `startSessionSaving(): () => void`

- [ ] **Step 1: Write the failing tests**

```ts
// services/adhkar/__tests__/timeWindows.test.ts
import {adhkarWindowAt, nextWindowBoundaryAfter} from '@/services/adhkar/timeWindows';

function at(h: number, m = 0, day = 13): number {
  return new Date(2026, 9, day, h, m).getTime();
}

describe('adhkarWindowAt', () => {
  it.each([
    [3, 59, 'evening'],
    [4, 0, 'morning'],
    [14, 59, 'morning'],
    [15, 0, 'evening'],
  ] as const)('%i:%i is %s', (h, m, expected) => {
    expect(adhkarWindowAt(at(h, m))).toBe(expected);
  });
});

describe('nextWindowBoundaryAfter', () => {
  it('10:00 -> 15:00 same day', () => {
    expect(nextWindowBoundaryAfter(at(10))).toBe(at(15));
  });
  it('20:00 -> 04:00 next day', () => {
    expect(nextWindowBoundaryAfter(at(20))).toBe(at(4, 0, 14));
  });
  it('02:00 -> 04:00 same day', () => {
    expect(nextWindowBoundaryAfter(at(2))).toBe(at(4));
  });
  it('exactly 15:00 -> 04:00 next day (strictly after)', () => {
    expect(nextWindowBoundaryAfter(at(15))).toBe(at(4, 0, 14));
  });
});
```

```ts
// services/adhkar/playback/__tests__/sessionPersistence.test.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isSavedSessionStale,
  toSavedSession,
  saveSession,
  loadSavedSession,
  restoreSavedSession,
} from '@/services/adhkar/playback/sessionPersistence';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import type {AdhkarSession, SavedSession} from '@/services/adhkar/playback/types';

function at(h: number, m = 0, day = 13): number {
  return new Date(2026, 9, day, h, m).getTime();
}

const items = [
  {dhikrId: 'a', audioFile: 'a.mp3', playable: true, preview: 'a'},
  {dhikrId: 'b', audioFile: 'b.mp3', playable: true, preview: 'b'},
];

const live: AdhkarSession = {
  listId: 'morning-adhkar', listTitle: 'Morning Adhkar', items,
  index: 1, mode: 'all', loop: false, status: 'playing', error: false,
  trackToken: 7, positionSec: 4.5, lastActiveAt: at(10),
};

function saved(over: Partial<SavedSession> = {}): SavedSession {
  return {listId: 'morning-adhkar', listTitle: 'Morning Adhkar', mode: 'all', loop: false, dhikrId: 'b', positionSec: 4.5, lastActiveAt: at(10), ...over};
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useAdhkarSessionStore.setState({session: null, revealToken: 0});
});
afterEach(() => jest.restoreAllMocks());

it('saves only the listed fields', () => {
  expect(toSavedSession(live)).toEqual(saved());
});

describe('isSavedSessionStale', () => {
  it('Morning played at 10:00 lives until 15:00', () => {
    expect(isSavedSessionStale(saved(), at(14, 59))).toBe(false);
    expect(isSavedSessionStale(saved(), at(15))).toBe(true);
  });
  it('Evening played at 20:00 lives until 04:00', () => {
    const s = saved({listId: 'evening-adhkar', lastActiveAt: at(20)});
    expect(isSavedSessionStale(s, at(3, 59, 14))).toBe(false);
    expect(isSavedSessionStale(s, at(4, 0, 14))).toBe(true);
  });
  it('a session saved exactly at 15:00 lives until 04:00', () => {
    const s = saved({lastActiveAt: at(15)});
    expect(isSavedSessionStale(s, at(23))).toBe(false);
  });
  it('other lists live 24 hours', () => {
    const s = saved({listId: 'saved', lastActiveAt: at(10)});
    expect(isSavedSessionStale(s, at(9, 59, 14))).toBe(false);
    expect(isSavedSessionStale(s, at(10, 0, 14))).toBe(true);
  });
});

it('round-trips through AsyncStorage and clears on null', async () => {
  await saveSession(live);
  expect(await loadSavedSession()).toEqual(saved());
  await saveSession(null);
  expect(await loadSavedSession()).toBeNull();
});

it('restores as paused at the saved dhikr', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(at(11));
  await saveSession(live);
  await restoreSavedSession(async () => items);
  expect(useAdhkarSessionStore.getState().session).toMatchObject({index: 1, status: 'paused', positionSec: 4.5, mode: 'all'});
});

it('drops a saved session whose dhikr no longer exists', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(at(11));
  await saveSession(live);
  await restoreSavedSession(async () => [items[0]]);
  expect(useAdhkarSessionStore.getState().session).toBeNull();
  expect(await loadSavedSession()).toBeNull();
});

it('drops a stale saved session', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(at(16));
  await saveSession(live);
  await restoreSavedSession(async () => items);
  expect(useAdhkarSessionStore.getState().session).toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest services/adhkar/__tests__/timeWindows.test.ts services/adhkar/playback/__tests__/sessionPersistence.test.ts`
Expected: FAIL, the modules do not exist.

- [ ] **Step 3: Implement the time windows**

```ts
// services/adhkar/timeWindows.ts
// Morning and evening adhkar windows by the clock (the app has no prayer
// times yet). Morning 04:00 to 14:59, evening 15:00 to 03:59. One module so a
// move to real prayer times changes one file.
const MORNING_START_HOUR = 4;
const EVENING_START_HOUR = 15;

export type AdhkarWindow = 'morning' | 'evening';

export function adhkarWindowAt(ms: number): AdhkarWindow {
  const hour = new Date(ms).getHours();
  return hour >= MORNING_START_HOUR && hour < EVENING_START_HOUR
    ? 'morning'
    : 'evening';
}

/** The first window start (04:00 or 15:00 local) strictly after `ms`. */
export function nextWindowBoundaryAfter(ms: number): number {
  const d = new Date(ms);
  const candidates = [
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), MORNING_START_HOUR),
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), EVENING_START_HOUR),
    new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, MORNING_START_HOUR),
  ];
  const next = candidates.find(c => c.getTime() > ms);
  // The third candidate is always after ms; find cannot miss.
  return (next ?? candidates[2]).getTime();
}
```

- [ ] **Step 4: Implement the store**

```ts
// store/adhkarSessionStore.ts
// The one adhkar playback session. Screens dispatch SessionEvents; the
// engine (services/adhkar/playback/adhkarPlaybackEngine.ts) follows it.
import {create} from 'zustand';
import {reduceSession} from '@/services/adhkar/playback/sessionReducer';
import type {AdhkarSession, SessionEvent} from '@/services/adhkar/playback/types';

interface AdhkarSessionState {
  session: AdhkarSession | null;
  // Increments when a surface asks the screen showing the session's list to
  // scroll to the current dhikr.
  revealToken: number;
  dispatch: (event: SessionEvent) => void;
  requestReveal: () => void;
}

export const useAdhkarSessionStore = create<AdhkarSessionState>(set => ({
  session: null,
  revealToken: 0,
  dispatch: event =>
    set(state => {
      const next = reduceSession(state.session, event, Date.now());
      return next === state.session ? state : {session: next};
    }),
  requestReveal: () => set(state => ({revealToken: state.revealToken + 1})),
}));
```

- [ ] **Step 5: Implement saving and restore**

```ts
// services/adhkar/playback/sessionPersistence.ts
// Saved adhkar session (spec 3.5): survives app restarts until it is
// finished, closed, or stale.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState} from 'react-native';
import {adhkarService} from '@/services/adhkar/AdhkarService';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {nextWindowBoundaryAfter} from '@/services/adhkar/timeWindows';
import {toSessionItems} from './sessionReducer';
import type {AdhkarSession, SavedSession, SessionItem} from './types';

const STORAGE_KEY = 'adhkar-session-v1';
const OTHER_LIST_TTL_MS = 24 * 60 * 60 * 1000;
const PERIOD_LISTS = new Set(['morning-adhkar', 'evening-adhkar']);

export function toSavedSession(session: AdhkarSession): SavedSession | null {
  const item = session.items[session.index];
  if (!item) return null;
  return {
    listId: session.listId,
    listTitle: session.listTitle,
    mode: session.mode,
    loop: session.loop,
    dhikrId: item.dhikrId,
    positionSec: session.positionSec,
    lastActiveAt: session.lastActiveAt,
  };
}

export function isSavedSessionStale(saved: SavedSession, now: number): boolean {
  if (PERIOD_LISTS.has(saved.listId)) {
    return now >= nextWindowBoundaryAfter(saved.lastActiveAt);
  }
  return now >= saved.lastActiveAt + OTHER_LIST_TTL_MS;
}

function isSavedSession(value: unknown): value is SavedSession {
  if (typeof value !== 'object' || value === null) return false;
  const v: Record<string, unknown> = {...value};
  return (
    typeof v.listId === 'string' &&
    typeof v.listTitle === 'string' &&
    (v.mode === 'single' || v.mode === 'all') &&
    typeof v.loop === 'boolean' &&
    typeof v.dhikrId === 'string' &&
    typeof v.positionSec === 'number' &&
    typeof v.lastActiveAt === 'number'
  );
}

export async function saveSession(session: AdhkarSession | null): Promise<void> {
  const saved = session ? toSavedSession(session) : null;
  if (!saved) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

export async function loadSavedSession(): Promise<SavedSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSavedSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function loadListItems(listId: string): Promise<SessionItem[] | null> {
  if (listId === 'saved') {
    const saved = await adhkarService.getSaved();
    const rows = await Promise.all(saved.map(s => adhkarService.getDhikr(s.dhikrId)));
    return toSessionItems(rows.filter(row => row !== null));
  }
  const data = await adhkarService.getAdhkarForSuperCategory(listId);
  if (!data) return null;
  return toSessionItems(data.categoryGroups.flatMap(g => g.adhkar));
}

/** Rebuilds the saved session as paused, or drops it (stale, list gone, dhikr gone). */
export async function restoreSavedSession(
  loadItems: (listId: string) => Promise<SessionItem[] | null> = loadListItems,
): Promise<void> {
  const saved = await loadSavedSession();
  if (!saved) return;
  if (isSavedSessionStale(saved, Date.now())) {
    await saveSession(null);
    return;
  }
  const items = await loadItems(saved.listId);
  const index = items?.findIndex(i => i.dhikrId === saved.dhikrId) ?? -1;
  if (!items || index < 0) {
    await saveSession(null);
    return;
  }
  // A session started meanwhile (the user pressed play during launch) wins.
  if (useAdhkarSessionStore.getState().session) return;
  useAdhkarSessionStore.getState().dispatch({
    type: 'restored',
    session: {
      listId: saved.listId,
      listTitle: saved.listTitle,
      items,
      index,
      mode: saved.mode,
      loop: saved.loop,
      status: 'paused',
      error: false,
      trackToken: 1,
      positionSec: saved.positionSec,
      lastActiveAt: saved.lastActiveAt,
    },
  });
}

/** Drops the live session if it is paused and stale (foreground return, tile render). */
export function dropStaleSession(now: number): void {
  const {session, dispatch} = useAdhkarSessionStore.getState();
  if (!session || session.status !== 'paused') return;
  const saved = toSavedSession(session);
  if (saved && isSavedSessionStale(saved, now)) dispatch({type: 'stop'});
}

/**
 * Saves on track change, status change, session end and app background, not
 * on every progress tick. Returns an unsubscribe function.
 */
export function startSessionSaving(): () => void {
  const unsubscribe = useAdhkarSessionStore.subscribe((state, prev) => {
    const a = state.session;
    const b = prev.session;
    if (a === b) return;
    if (
      !a ||
      !b ||
      a.trackToken !== b.trackToken ||
      a.status !== b.status ||
      a.positionSec !== b.positionSec ||
      a.loop !== b.loop
    ) {
      saveSession(a).catch(() => {});
    }
  });
  const appState = AppState.addEventListener('change', next => {
    if (next === 'active') dropStaleSession(Date.now());
  });
  return () => {
    unsubscribe();
    appState.remove();
  };
}
```

`restoreSavedSession` uses Date.now() when reading; the tests mock it. Check that AsyncStorage is mocked in jest: `grep -rn "async-storage" jest.setup* jest.config*`. If it isn't, add `jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));` at the top of the persistence test.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest services/adhkar/__tests__/timeWindows.test.ts services/adhkar/playback/__tests__/sessionPersistence.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add services/adhkar/timeWindows.ts services/adhkar/__tests__/timeWindows.test.ts services/adhkar/playback/sessionPersistence.ts services/adhkar/playback/__tests__/sessionPersistence.test.ts store/adhkarSessionStore.ts
git commit -m "feat(adhkar): session store, saving, restore and stale windows"
```

---

### Task 3: Playback engine, coordination and progress

**Files:**
- Create: `services/adhkar/playback/adhkarPlaybackEngine.ts`
- Create: `hooks/useAdhkarProgress.ts`
- Modify: `services/audio/AudioCoordinator.ts`
- Modify: `services/audio/ExpoAudioProvider.tsx`, next to `await lockScreenService.startSync();` at about line 177
- Test: `services/adhkar/playback/__tests__/adhkarPlaybackEngine.test.ts`
- Test: `services/audio/__tests__/AudioCoordinator.test.ts` (extend)

**Interfaces:**
- Consumes: `useAdhkarSessionStore` (Task 2), `startSessionSaving` and `restoreSavedSession` (Task 2), `currentItem` (Task 1), `getAudioSource(audioFile: string | null): number | null` from `@/utils/adhkarAudio`, and `createAudioPlayer` from `expo-audio`.
- Produces:
  - `startAdhkarPlaybackEngine(deps?: Partial<EngineDeps>): () => void`
  - `getAdhkarPlaybackPosition(): {currentTime: number; duration: number}`
  - `seekAdhkarPlayback(seconds: number): void`
  - `audioCoordinator.adhkarWillPlay(): void`, and an `AudioSource` type that now includes `'adhkar'`
  - `useAdhkarProgress(active: boolean): {currentTime: number; duration: number; seek: (progress: number) => void}`
  - the lock screen hooks `EngineDeps.lockScreen.activate(player, session)` and `EngineDeps.lockScreen.clear(player)`. Task 9 implements them; until then they are no-ops.

- [ ] **Step 1: Write the failing engine tests**

```ts
// services/adhkar/playback/__tests__/adhkarPlaybackEngine.test.ts
import {startAdhkarPlaybackEngine} from '@/services/adhkar/playback/adhkarPlaybackEngine';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import type {SessionSource} from '@/services/adhkar/playback/types';

jest.mock('expo-audio', () => ({createAudioPlayer: jest.fn()}));

type Listener = (s: {playing: boolean; didJustFinish: boolean; currentTime: number; duration: number}) => void;

function fakePlayer() {
  let listener: Listener | null = null;
  return {
    loop: false,
    currentTime: 0,
    duration: 10,
    replace: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
    addListener: jest.fn((_e: string, l: Listener) => {
      listener = l;
      return {remove: jest.fn()};
    }),
    emit(s: Partial<Parameters<Listener>[0]>) {
      listener?.({playing: false, didJustFinish: false, currentTime: 0, duration: 10, ...s});
    },
  };
}

const src: SessionSource = {
  listId: 'morning-adhkar',
  listTitle: 'Morning',
  items: ['a', 'b'].map(id => ({dhikrId: id, audioFile: `${id}.mp3`, playable: true, preview: id})),
};

let player: ReturnType<typeof fakePlayer>;
let stop: () => void;
const coordinator = {adhkarWillPlay: jest.fn(), sourceDidStop: jest.fn()};
const lockScreen = {activate: jest.fn(), clear: jest.fn()};

beforeEach(() => {
  jest.useFakeTimers();
  useAdhkarSessionStore.setState({session: null, revealToken: 0});
  player = fakePlayer();
  stop = startAdhkarPlaybackEngine({
    createPlayer: () => player,
    getSource: file => (file ? 1 : null),
    coordinator,
    lockScreen,
  });
});
afterEach(() => {
  stop();
  jest.useRealTimers();
  jest.clearAllMocks();
});

const dispatch = useAdhkarSessionStore.getState().dispatch;

it('loads, plays and confirms through the player status', () => {
  dispatch({type: 'pressPlayAll', source: src});
  expect(player.replace).toHaveBeenCalledTimes(1);
  expect(player.play).toHaveBeenCalledTimes(1);
  expect(coordinator.adhkarWillPlay).toHaveBeenCalled();
  player.emit({playing: true});
  expect(useAdhkarSessionStore.getState().session?.status).toBe('playing');
});

it('advances on finish with the same player, no second player', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  player.emit({playing: false, didJustFinish: true});
  expect(useAdhkarSessionStore.getState().session?.index).toBe(1);
  expect(player.replace).toHaveBeenCalledTimes(2);
});

it('ignores a finish carried over from the previous clip', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  player.emit({didJustFinish: true}); // advance to b
  player.emit({didJustFinish: true}); // stale, b has not reported playing yet
  expect(useAdhkarSessionStore.getState().session?.index).toBe(1);
});

it('advances after a clip shorter than two seconds', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true, duration: 1.2});
  player.emit({didJustFinish: true, duration: 1.2});
  expect(useAdhkarSessionStore.getState().session?.index).toBe(1);
});

it('retries once, then pauses with an error', () => {
  dispatch({type: 'pressPlayAll', source: src});
  jest.advanceTimersByTime(1500);
  expect(player.play).toHaveBeenCalledTimes(2);
  jest.advanceTimersByTime(1500);
  expect(useAdhkarSessionStore.getState().session).toMatchObject({status: 'paused', error: true});
});

it('follows a remote pause and resume without re-playing', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  player.emit({playing: false});
  expect(useAdhkarSessionStore.getState().session?.status).toBe('paused');
  expect(player.play).toHaveBeenCalledTimes(1);
  player.emit({playing: true});
  expect(useAdhkarSessionStore.getState().session?.status).toBe('playing');
});

it('saves the position on pause and seeks to it on resume after restore', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  player.currentTime = 4;
  dispatch({type: 'toggle'});
  expect(player.pause).toHaveBeenCalled();
  expect(useAdhkarSessionStore.getState().session?.positionSec).toBe(4);
});

it('restored sessions do not load until play, then seek', () => {
  dispatch({type: 'restored', session: {...src, index: 1, mode: 'all', loop: false, status: 'paused', error: false, trackToken: 1, positionSec: 3, lastActiveAt: 0}});
  expect(player.replace).not.toHaveBeenCalled();
  dispatch({type: 'toggle'});
  expect(player.replace).toHaveBeenCalledTimes(1);
  expect(player.seekTo).toHaveBeenCalledWith(3);
});

it('pauses the player and clears the lock screen when the session ends', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  dispatch({type: 'stop'});
  expect(player.pause).toHaveBeenCalled();
  expect(lockScreen.clear).toHaveBeenCalled();
  expect(coordinator.sourceDidStop).toHaveBeenCalledWith('adhkar');
});

it('sets loop in single mode only', () => {
  dispatch({type: 'pressCard', source: src, index: 0});
  dispatch({type: 'toggleLoop'});
  expect(player.loop).toBe(true);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest services/adhkar/playback/__tests__/adhkarPlaybackEngine.test.ts`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Implement the engine**

```ts
// services/adhkar/playback/adhkarPlaybackEngine.ts
// The single adhkar player (spec 3.4). One expo-audio player for the whole
// app, made with keepAudioSessionActive so iOS keeps the audio session
// between clips (a new player per clip could not restart in the background).
// It follows useAdhkarSessionStore and reports player events back to it.
import {createAudioPlayer} from 'expo-audio';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {getAudioSource} from '@/utils/adhkarAudio';
import {currentItem} from './sessionReducer';
import type {AdhkarSession} from './types';

const PLAY_CONFIRM_MS = 1500;

interface PlayerStatus {
  playing: boolean;
  didJustFinish: boolean;
}

export interface EnginePlayer {
  loop: boolean;
  currentTime: number;
  duration: number;
  replace(source: number): void;
  play(): void;
  pause(): void;
  seekTo(seconds: number): unknown;
  addListener(
    event: 'playbackStatusUpdate',
    listener: (status: PlayerStatus) => void,
  ): {remove(): void};
}

export interface EngineDeps {
  createPlayer: () => EnginePlayer;
  getSource: (audioFile: string | null) => number | null;
  coordinator: {adhkarWillPlay(): void; sourceDidStop(source: 'adhkar'): void};
  lockScreen: {
    activate(player: EnginePlayer, session: AdhkarSession): void;
    clear(player: EnginePlayer): void;
  };
}

function defaultDeps(): EngineDeps {
  // Lazy requires, resolved at call time: the coordinator and lock screen
  // import player stores, and tests that inject their own deps never load them.
  const coordinator = (): typeof import('@/services/audio/AudioCoordinator').audioCoordinator =>
    require('@/services/audio/AudioCoordinator').audioCoordinator;
  const lockScreen = (): typeof import('@/services/audio/LockScreenService').lockScreenService =>
    require('@/services/audio/LockScreenService').lockScreenService;
  return {
    createPlayer: () =>
      createAudioPlayer(null, {keepAudioSessionActive: true, updateInterval: 250}),
    getSource: getAudioSource,
    coordinator: {
      adhkarWillPlay: () => coordinator().adhkarWillPlay(),
      sourceDidStop: source => coordinator().sourceDidStop(source),
    },
    lockScreen: {
      activate: (player, session) => lockScreen().activateAdhkar(player, session),
      clear: player => lockScreen().clearAdhkar(player),
    },
  };
}

let activePlayer: EnginePlayer | null = null;

export function getAdhkarPlaybackPosition(): {currentTime: number; duration: number} {
  if (!activePlayer) return {currentTime: 0, duration: 0};
  return {currentTime: activePlayer.currentTime, duration: activePlayer.duration};
}

export function seekAdhkarPlayback(seconds: number): void {
  try {
    activePlayer?.seekTo(seconds);
  } catch (error) {
    if (__DEV__) console.warn('[AdhkarEngine] seek failed', error);
  }
}

export function startAdhkarPlaybackEngine(overrides: Partial<EngineDeps> = {}): () => void {
  const deps: EngineDeps = {...defaultDeps(), ...overrides};
  const store = useAdhkarSessionStore;
  let player: EnginePlayer | null = null;
  let loadedToken: number | null = null;
  // The token that has reported playing: true. A didJustFinish before that is
  // left over from the previous clip.
  let confirmedToken: number | null = null;
  let confirmTimer: ReturnType<typeof setTimeout> | null = null;
  let retried = false;
  let lockScreenToken: number | null = null;

  function ensurePlayer(): EnginePlayer {
    if (player) return player;
    player = deps.createPlayer();
    activePlayer = player;
    player.addListener('playbackStatusUpdate', onStatus);
    return player;
  }

  function clearConfirm(): void {
    if (confirmTimer) clearTimeout(confirmTimer);
    confirmTimer = null;
  }

  function armConfirm(token: number): void {
    clearConfirm();
    confirmTimer = setTimeout(() => {
      const s = store.getState().session;
      if (!s || s.trackToken !== token || s.status !== 'loading') return;
      if (!retried) {
        retried = true;
        tryPlay(token);
        return;
      }
      store.getState().dispatch({type: 'playFailed', token});
    }, PLAY_CONFIRM_MS);
  }

  function tryPlay(token: number): void {
    const p = ensurePlayer();
    try {
      deps.coordinator.adhkarWillPlay();
      p.play();
    } catch (error) {
      if (__DEV__) console.warn('[AdhkarEngine] play failed', error);
    }
    armConfirm(token);
  }

  function load(session: AdhkarSession): boolean {
    const item = currentItem(session);
    const source = deps.getSource(item?.audioFile ?? null);
    if (source === null) {
      store.getState().dispatch({type: 'playFailed', token: session.trackToken});
      return false;
    }
    const p = ensurePlayer();
    p.replace(source);
    loadedToken = session.trackToken;
    confirmedToken = null;
    if (session.positionSec > 0) p.seekTo(session.positionSec);
    return true;
  }

  function savePosition(): void {
    if (!player || loadedToken === null) return;
    store.getState().dispatch({type: 'positionSaved', positionSec: player.currentTime});
  }

  function onStatus(status: PlayerStatus): void {
    const s = store.getState().session;
    if (!s || loadedToken !== s.trackToken) return;
    if (status.playing) {
      confirmedToken = loadedToken;
      if (s.status === 'loading') {
        clearConfirm();
        store.getState().dispatch({type: 'playStarted', token: s.trackToken});
      } else if (s.status === 'paused') {
        // Play from the lock screen, headphones or Control Center.
        deps.coordinator.adhkarWillPlay();
        store.getState().dispatch({type: 'playerResumed'});
      }
      return;
    }
    if (status.didJustFinish) {
      if (confirmedToken !== loadedToken || player?.loop) return;
      store.getState().dispatch({type: 'trackEnded', token: s.trackToken});
      return;
    }
    if (s.status === 'playing') {
      savePosition();
      store.getState().dispatch({type: 'playerPaused'});
    }
  }

  function follow(session: AdhkarSession | null, prev: AdhkarSession | null): void {
    if (!session) {
      clearConfirm();
      if (prev && player) {
        player.pause();
        deps.lockScreen.clear(player);
        deps.coordinator.sourceDidStop('adhkar');
      }
      loadedToken = null;
      confirmedToken = null;
      lockScreenToken = null;
      return;
    }
    if (player) player.loop = session.mode === 'single' && session.loop;
    if (session.status === 'loading') {
      const isNewRequest =
        !prev || prev.status !== 'loading' || prev.trackToken !== session.trackToken;
      if (!isNewRequest) return;
      retried = false;
      if (loadedToken !== session.trackToken && !load(session)) return;
      if (player) player.loop = session.mode === 'single' && session.loop;
      tryPlay(session.trackToken);
      return;
    }
    if (session.status === 'playing') {
      if (player && lockScreenToken !== session.trackToken) {
        lockScreenToken = session.trackToken;
        deps.lockScreen.activate(player, session);
      }
      return;
    }
    // paused
    clearConfirm();
    if (prev && prev.status !== 'paused' && player) {
      savePosition();
      player.pause();
      // Another source took over: hand the lock screen back to it.
      deps.lockScreen.clear(player);
      lockScreenToken = null;
    }
  }

  const unsubscribe = store.subscribe((state, prevState) => {
    if (state.session !== prevState.session) follow(state.session, prevState.session);
  });

  return () => {
    unsubscribe();
    clearConfirm();
  };
}
```

Note for the implementer: `positionSaved` changes `session`, which calls `follow` again. That is harmless, because `follow` only acts on status or token transitions, and the paused branch needs `prev.status !== 'paused'`. Keep it that way.

- [ ] **Step 4: Extend AudioCoordinator and its test**

In `services/audio/AudioCoordinator.ts`:
- change `type AudioSource = 'main' | 'mushaf' | 'none';` to `'main' | 'mushaf' | 'adhkar' | 'none'`;
- add this method:

```ts
  /**
   * Called before the adhkar player plays. Pauses the main and mushaf players.
   */
  adhkarWillPlay(): void {
    const store = usePlayerStore.getState();
    if (store.playback.state === 'playing' || store.playback.state === 'buffering') {
      store.pause();
    }
    const {mushafAudioService} = require('./MushafAudioService');
    if (mushafAudioService.getIsPlaying()) {
      mushafAudioService.pause();
      const {useMushafPlayerStore} = require('@/store/mushafPlayerStore');
      useMushafPlayerStore.getState().setPlaybackState('paused');
    }
    this.activeSource = 'adhkar';
  }
```

- add `this.pauseAdhkarIfActive();` as the first line of both `mushafWillPlay()` and `mainWillPlay()`, with:

```ts
  private pauseAdhkarIfActive(): void {
    if (this.activeSource !== 'adhkar') return;
    const {useAdhkarSessionStore} = require('@/store/adhkarSessionStore');
    useAdhkarSessionStore.getState().dispatch({type: 'otherAudioStarted'});
  }
```

AudioCoordinator is an existing class, so it stays one. In `services/audio/__tests__/AudioCoordinator.test.ts`, add tests that follow the file's existing mocking style:
- `adhkarWillPlay` pauses a playing main player;
- `mainWillPlay` after `adhkarWillPlay` dispatches `otherAudioStarted` (assert that the session's status goes from `playing` to `paused` in `useAdhkarSessionStore`).

- [ ] **Step 5: Implement the progress hook**

```ts
// hooks/useAdhkarProgress.ts
// Live position of the current adhkar clip. Polls only while `active` and
// playing; reads once otherwise.
import {useCallback, useEffect, useState} from 'react';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {
  getAdhkarPlaybackPosition,
  seekAdhkarPlayback,
} from '@/services/adhkar/playback/adhkarPlaybackEngine';

const POLL_MS = 250;

export function useAdhkarProgress(active: boolean): {
  currentTime: number;
  duration: number;
  seek: (progress: number) => void;
} {
  const playing = useAdhkarSessionStore(s => s.session?.status === 'playing');
  const [position, setPosition] = useState({currentTime: 0, duration: 0});

  useEffect(() => {
    if (!active) {
      setPosition({currentTime: 0, duration: 0});
      return;
    }
    setPosition(getAdhkarPlaybackPosition());
    if (!playing) return;
    const id = setInterval(() => setPosition(getAdhkarPlaybackPosition()), POLL_MS);
    return () => clearInterval(id);
  }, [active, playing]);

  const seek = useCallback(
    (progress: number) => {
      if (position.duration > 0) seekAdhkarPlayback(progress * position.duration);
    },
    [position.duration],
  );

  return {...position, seek};
}
```

- [ ] **Step 6: Start the engine at audio boot**

In `services/audio/ExpoAudioProvider.tsx`, right after `await lockScreenService.startSync();`, add:

```ts
          stopAdhkarEngine = startAdhkarPlaybackEngine();
          stopAdhkarSaving = startSessionSaving();
          restoreSavedSession().catch(() => {});
```

- Declare `let stopAdhkarEngine: (() => void) | null = null; let stopAdhkarSaving: (() => void) | null = null;` in the same effect scope.
- Call both in the effect's existing cleanup.
- Add the imports from `@/services/adhkar/playback/adhkarPlaybackEngine` and `@/services/adhkar/playback/sessionPersistence`.

Read the effect first and follow its structure. If the effect has no cleanup, add one that calls both.

- [ ] **Step 7: Run the tests**

Run: `npx jest services/adhkar/playback services/audio/__tests__/AudioCoordinator.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add services/adhkar/playback/adhkarPlaybackEngine.ts services/adhkar/playback/__tests__/adhkarPlaybackEngine.test.ts hooks/useAdhkarProgress.ts services/audio/AudioCoordinator.ts services/audio/__tests__/AudioCoordinator.test.ts services/audio/ExpoAudioProvider.tsx
git commit -m "feat(adhkar): app-wide playback engine with one kept-alive player"
```

---

### Task 4: Move the reader and lists onto the session

**Files:**
- Create: `components/adhkar/AdhkarSessionSourceContext.tsx`
- Create: `services/adhkar/playback/openPlayingDhikr.ts`. Only the focus registry goes here now; Task 5 adds the rest.
- Modify: `components/adhkar/AdhkarAudioControls.tsx`
- Modify: `components/adhkar/DhikrReader.tsx` (pass `dhikrId={dhikr.id}` to `AdhkarAudioControls`, line ~139)
- Modify: `app/(tabs)/(a.home)/adhkar/[superId]/[dhikrId].tsx`
- Modify: `app/(tabs)/(a.home)/adhkar/saved/[dhikrId].tsx`
- Modify: `app/(tabs)/(a.home)/adhkar/[superId]/index.tsx` (`handlePlayAll`, `isThisCategoryPlaying`)
- Modify: `app/(tabs)/(a.home)/adhkar/saved/index.tsx` (same)
- Modify: `app/(tabs)/(a.home)/adhkar/_layout.tsx` (remove `AdhkarAudioProvider` and its import)
- Delete: `store/adhkarAudioStore.ts`, `store/adhkarPlayAllStore.ts`, `store/__tests__/adhkarPlayAllStore.test.ts`, `components/adhkar/AdhkarAudioProvider.tsx`, `hooks/useAdhkarAudio.ts`, `utils/adhkarTrackEnd.ts`, `utils/__tests__/adhkarTrackEnd.test.ts`
- Test: `components/adhkar/__tests__/AdhkarAudioControls.test.tsx`

**Interfaces:**
- Consumes: `useAdhkarSessionStore`, `toSessionItems`, `useAdhkarProgress`, and `resolveViewableChange` from `components/adhkar/playAllScrollGuard.ts` (unchanged).
- Produces:
  - `AdhkarSessionSourceProvider({source, children})`
  - `useAdhkarSessionSource(): SessionSource | null`
  - `setAdhkarFocus(focus: AdhkarFocus): void` and `getAdhkarFocus(): AdhkarFocus`, where `type AdhkarFocus = {kind: 'list' | 'reader'; listId: string} | null`
  - `AdhkarAudioControls`, with `dhikrId: string` replacing its old `audioFile` prop. It keeps `audioFile` for the no-audio check.

- [ ] **Step 1: Source context and focus registry**

```tsx
// components/adhkar/AdhkarSessionSourceContext.tsx
// The list a reader shows, as a SessionSource, so a card's play button can
// start or toggle the session without prop drilling through DhikrReader.
import React, {createContext, useContext} from 'react';
import type {SessionSource} from '@/services/adhkar/playback/types';

const SourceContext = createContext<SessionSource | null>(null);

export function AdhkarSessionSourceProvider({
  source,
  children,
}: {
  source: SessionSource | null;
  children: React.ReactNode;
}): React.JSX.Element {
  return <SourceContext.Provider value={source}>{children}</SourceContext.Provider>;
}

export function useAdhkarSessionSource(): SessionSource | null {
  return useContext(SourceContext);
}
```

```ts
// services/adhkar/playback/openPlayingDhikr.ts
// Which adhkar screen is focused, and (Task 5) how to get to the playing dhikr.
export type AdhkarFocus = {kind: 'list' | 'reader'; listId: string} | null;

let focus: AdhkarFocus = null;

export function setAdhkarFocus(next: AdhkarFocus): void {
  focus = next;
}

export function getAdhkarFocus(): AdhkarFocus {
  return focus;
}
```

- [ ] **Step 2: Write the failing controls test**

```tsx
// components/adhkar/__tests__/AdhkarAudioControls.test.tsx
import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {AdhkarAudioControls} from '@/components/adhkar/AdhkarAudioControls';
import {AdhkarSessionSourceProvider} from '@/components/adhkar/AdhkarSessionSourceContext';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import type {SessionSource} from '@/services/adhkar/playback/types';

jest.mock('@/utils/adhkarAudio', () => ({hasAudio: (f: string | null) => f !== null, getAudioSource: () => 1}));
jest.mock('@/services/adhkar/playback/adhkarPlaybackEngine', () => ({
  getAdhkarPlaybackPosition: () => ({currentTime: 0, duration: 10}),
  seekAdhkarPlayback: jest.fn(),
}));

const src: SessionSource = {
  listId: 'morning-adhkar',
  listTitle: 'Morning',
  items: ['a', 'b'].map(id => ({dhikrId: id, audioFile: `${id}.mp3`, playable: true, preview: id})),
};

function renderCard(dhikrId: string) {
  return render(
    <AdhkarSessionSourceProvider source={src}>
      <AdhkarAudioControls
        dhikrId={dhikrId}
        audioFile={`${dhikrId}.mp3`}
        onCopy={jest.fn()}
        onBookmark={jest.fn()}
        onShare={jest.fn()}
        onSettings={jest.fn()}
        isBookmarked={false}
      />
    </AdhkarSessionSourceProvider>,
  );
}

beforeEach(() => useAdhkarSessionStore.setState({session: null, revealToken: 0}));

it('plays this card even while another list plays all', () => {
  useAdhkarSessionStore.getState().dispatch({
    type: 'pressPlayAll',
    source: {...src, listId: 'evening-adhkar'},
  });
  const {getByTestId} = renderCard('b');
  fireEvent.press(getByTestId('adhkar-play-button'));
  expect(useAdhkarSessionStore.getState().session).toMatchObject({listId: 'morning-adhkar', index: 1, mode: 'single'});
});

it('reserves the progress row height on a card that is not current', () => {
  const {getByTestId} = renderCard('a');
  expect(getByTestId('adhkar-progress-row')).toBeTruthy();
});
```

Read the existing component tests in `components/adhkar/__tests__/` first and copy their theme, i18n and reanimated mocking setup into this file.

- [ ] **Step 3: Rewrite the controls' state wiring**

In `components/adhkar/AdhkarAudioControls.tsx`:
1. Remove the imports of `useAdhkarAudio`, `useAdhkarAudioStore` and `useAdhkarPlayAllStore`, and the Reanimated height animation (`useAnimatedStyle`, `withTiming`, `TIMING_CONFIG`, `progressRowAnimatedStyle`).
2. Add the prop `dhikrId: string` to `AdhkarAudioControlsProps`.
3. Replace the state block with:

```tsx
      const source = useAdhkarSessionSource();
      const dispatch = useAdhkarSessionStore(s => s.dispatch);
      const index = source?.items.findIndex(i => i.dhikrId === dhikrId) ?? -1;
      const isCurrent = useAdhkarSessionStore(
        s =>
          !!s.session &&
          !!source &&
          s.session.listId === source.listId &&
          s.session.items[s.session.index]?.dhikrId === dhikrId,
      );
      const status = useAdhkarSessionStore(s => (isCurrent ? s.session?.status : undefined));
      const isLooping = useAdhkarSessionStore(s => (isCurrent ? !!s.session?.loop : false));
      const isSingle = useAdhkarSessionStore(s => !isCurrent || s.session?.mode === 'single');
      const isPlaying = status === 'playing' || status === 'loading';
      const {currentTime, duration, seek} = useAdhkarProgress(isCurrent);
      const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

      const handleToggle = () => {
        if (!source || index < 0) return;
        dispatch({type: 'pressCard', source, index});
      };
      const toggleLooping = () => {
        if (isCurrent) dispatch({type: 'toggleLoop'});
      };
```

4. **The progress row.** Render it as a plain `View` with `testID="adhkar-progress-row"` and fixed `height: PROGRESS_BAR_HEIGHT` and `marginBottom: PROGRESS_BAR_MARGIN` whenever `hasAudio(audioFile)`.
   - When the card is current, keep the existing slider and time labels, wired to `progress` and `seek`.
   - When it isn't, render the same slider with `value={0}` and `disabled`, and the labels "0:00".
5. **The repeat button** renders only when `isSingle`.
6. **The play button** gets `testID="adhkar-play-button"`.
7. **Keep the visual style as it is.** If the old code set an `accessibilityLabel` from `isPlaying`, keep it.

- [ ] **Step 4: Rewire the category reader**

In `app/(tabs)/(a.home)/adhkar/[superId]/[dhikrId].tsx`:
1. **Remove** `setAudio`, `stopAudio`, both store imports, the `setAudio` effect, the unmount `stopAudio` effect, and every `useAdhkarPlayAllStore` selector.
2. **Add the session selectors and the source:**

```tsx
  const session = useAdhkarSessionStore(s => s.session);
  const revealToken = useAdhkarSessionStore(s => s.revealToken);
  const dispatch = useAdhkarSessionStore(s => s.dispatch);
  const isThisAllSession = session?.listId === superId && session.mode === 'all';
  const sessionIndex = session?.listId === superId ? session.index : null;

  const sessionSource = useMemo(
    () =>
      superId && adhkarList.length > 0
        ? {
            listId: superId,
            listTitle: superCategoryTitle || displayTitle,
            items: toSessionItems(adhkarList),
          }
        : null,
    [superId, adhkarList, superCategoryTitle, displayTitle],
  );
```

   If `displayTitle` is declared after this point, move the `sessionSource` memo below `displayTitle`. `listTitle` must be the list's title (`superCategoryTitle` param), so prefer `superCategoryTitle`. Fall back to `t('adhkar.dhikr')` only when it is missing, not to a per-dhikr category title. Adjust the memo to that order: `superCategoryTitle || t('adhkar.dhikr')`.

3. **Follow the session.** Replace the "Sync FlatList scroll when Play All index changes" effect body with the same logic keyed on `isThisAllSession && sessionIndex !== null && sessionIndex !== currentIndex`, scrolling to `sessionIndex`. Keep `playAllScrollTarget` and `resolveViewableChange` exactly as they are.
4. **Reveal:**

```tsx
  const lastReveal = useRef(revealToken);
  useEffect(() => {
    if (revealToken === lastReveal.current) return;
    lastReveal.current = revealToken;
    if (sessionIndex === null || !isDataLoaded) return;
    playAllScrollTarget.current = sessionIndex;
    flatListRef.current?.scrollToIndex({index: sessionIndex, animated: true});
    setCurrentIndex(sessionIndex);
  }, [revealToken, sessionIndex, isDataLoaded]);
```

5. **The swipe.** In `onViewableItemsChanged`, replace the `goToIndex(newIndex)` branch with:

```tsx
        if (isThisAllSession && newIndex !== sessionIndex && change.isUserSwipe && superId) {
          dispatch({type: 'swipedTo', listId: superId, index: newIndex});
        }
```

   Update the dependency array to match.

6. **Focus:**

```tsx
  useFocusEffect(
    useCallback(() => {
      if (superId) setAdhkarFocus({kind: 'reader', listId: superId});
      return () => setAdhkarFocus(null);
    }, [superId]),
  );
```

   Import `useFocusEffect` from `expo-router`.

7. **Wrap** the returned tree in `<AdhkarSessionSourceProvider source={sessionSource}>`.

- [ ] **Step 5: Rewire the Saved reader**

Apply the same changes to `app/(tabs)/(a.home)/adhkar/saved/[dhikrId].tsx`:
- `listId` is `'saved'`;
- `listTitle` is `t('adhkar.saved')`, from the `home` namespace (check that the file's `useTranslation` includes `home`);
- the focus is `{kind: 'reader', listId: 'saved'}`.

- [ ] **Step 6: Rewire Play All in the lists**

In `app/(tabs)/(a.home)/adhkar/[superId]/index.tsx`:
- remove the `useAdhkarPlayAllStore` selectors;
- set `isThisCategoryPlaying` with `useAdhkarSessionStore(s => s.session?.listId === superId && s.session.mode === 'all')`;
- replace `handlePlayAll` with:

```tsx
  const dispatch = useAdhkarSessionStore(s => s.dispatch);
  const handlePlayAll = useCallback(() => {
    if (!superId || allAdhkarForPlayAll.length === 0) return;
    const source = {
      listId: superId,
      listTitle: superCategory?.title ?? '',
      items: toSessionItems(allAdhkarForPlayAll),
    };
    const wasPlaying = isThisCategoryPlaying;
    dispatch({type: 'pressPlayAll', source});
    if (wasPlaying) return;
    const session = useAdhkarSessionStore.getState().session;
    if (!session || session.listId !== superId) return;
    const first = allAdhkarForPlayAll[session.index];
    const firstGroup = categoryGroups.find(group =>
      group.adhkar.some(d => d.id === first.id),
    );
    router.push({
      pathname: '/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]',
      params: {
        superId,
        dhikrId: first.id,
        globalIndex: String(session.index),
        categoryShortTitle: firstGroup ? shortenCategoryTitle(firstGroup.categoryTitle) : '',
        superCategoryTitle: superCategory?.title,
        playAll: 'true',
      },
    });
  }, [superId, allAdhkarForPlayAll, superCategory?.title, isThisCategoryPlaying, dispatch, categoryGroups, router]);
```

- add a list focus: `useFocusEffect(useCallback(() => { if (superId) setAdhkarFocus({kind: 'list', listId: superId}); return () => setAdhkarFocus(null); }, [superId]))`.

Make the same change in `saved/index.tsx`, with `listId: 'saved'`, `listTitle: t('adhkar.saved')`, and the push to `/(tabs)/(a.home)/adhkar/saved/[dhikrId]` using `globalIndex: String(session.index)`.

- [ ] **Step 7: Remove the old units**

Remove `AdhkarAudioProvider` from `adhkar/_layout.tsx`, so the `<Stack>` is the returned root. Delete the seven files listed above. Then check that nothing still references them:

`grep -rn "adhkarAudioStore\|adhkarPlayAllStore\|AdhkarAudioProvider\|useAdhkarAudio\b\|adhkarTrackEnd" app components hooks services store utils`

Expected: no matches. If `services/widgets` or another module imported `useAdhkarPlayAllStore`, move it to `useAdhkarSessionStore` with the equivalent read and note it in the report.

- [ ] **Step 8: Run tsc and the tests**

Run: `npx tsc --noEmit && npx jest components/adhkar services/adhkar store`
Expected: tsc clean, apart from the known `syncContentWidgets.ts` lines; tests PASS.

- [ ] **Step 9: Commit**

```bash
git add -A app/'(tabs)'/'(a.home)'/adhkar components/adhkar services/adhkar/playback hooks store utils
git commit -m "refactor(adhkar): readers and lists drive the app-wide session; fixed progress row"
```

---

### Task 5: Open the playing dhikr, and the deep link route

**Files:**
- Modify: `services/adhkar/playback/openPlayingDhikr.ts`
- Create: `app/adhkar-playing.tsx`
- Test: `services/adhkar/playback/__tests__/openPlayingDhikr.test.ts`

**Interfaces:**
- Consumes: `useAdhkarSessionStore` and the `AdhkarFocus` registry from Task 4.
- Produces:
  - `planOpenPlaying(session: AdhkarSession | null, focus: AdhkarFocus): OpenPlan`, where `type OpenPlan = {kind: 'none'} | {kind: 'reveal'} | {kind: 'push'; href: ReaderHref}`
  - `openPlayingDhikr(router: {push(href: ReaderHref): void; replace(href: ReaderHref): void}, mode?: 'push' | 'replace'): boolean`, which returns `false` when there is no session

- [ ] **Step 1: Write the failing test**

```ts
// services/adhkar/playback/__tests__/openPlayingDhikr.test.ts
import {planOpenPlaying} from '@/services/adhkar/playback/openPlayingDhikr';
import type {AdhkarSession} from '@/services/adhkar/playback/types';

const session: AdhkarSession = {
  listId: 'morning-adhkar', listTitle: 'Morning Adhkar',
  items: [{dhikrId: 'a', audioFile: 'a.mp3', playable: true, preview: 'a'}, {dhikrId: 'b', audioFile: 'b.mp3', playable: true, preview: 'b'}],
  index: 1, mode: 'all', loop: false, status: 'playing', error: false, trackToken: 1, positionSec: 0, lastActiveAt: 0,
};

it('does nothing without a session', () => {
  expect(planOpenPlaying(null, null)).toEqual({kind: 'none'});
});
it('reveals when the session list reader or list is focused', () => {
  expect(planOpenPlaying(session, {kind: 'reader', listId: 'morning-adhkar'})).toEqual({kind: 'reveal'});
  expect(planOpenPlaying(session, {kind: 'list', listId: 'morning-adhkar'})).toEqual({kind: 'reveal'});
});
it('pushes the category reader at the playing index otherwise', () => {
  expect(planOpenPlaying(session, {kind: 'reader', listId: 'evening-adhkar'})).toEqual({
    kind: 'push',
    href: {
      pathname: '/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]',
      params: {superId: 'morning-adhkar', dhikrId: 'b', globalIndex: '1', superCategoryTitle: 'Morning Adhkar'},
    },
  });
});
it('pushes the saved reader for a saved session', () => {
  expect(planOpenPlaying({...session, listId: 'saved'}, null)).toEqual({
    kind: 'push',
    href: {pathname: '/(tabs)/(a.home)/adhkar/saved/[dhikrId]', params: {dhikrId: 'b', globalIndex: '1'}},
  });
});
```

Revealing on the list screen is right: the list screen scrolls to the row (Task 8 listens to `revealToken`).

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest services/adhkar/playback/__tests__/openPlayingDhikr.test.ts`
Expected: FAIL, `planOpenPlaying` is not exported.

- [ ] **Step 3: Implement**

Append to `services/adhkar/playback/openPlayingDhikr.ts`:

```ts
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import type {AdhkarSession} from './types';

export type ReaderHref =
  | {
      pathname: '/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]';
      params: {superId: string; dhikrId: string; globalIndex: string; superCategoryTitle: string};
    }
  | {
      pathname: '/(tabs)/(a.home)/adhkar/saved/[dhikrId]';
      params: {dhikrId: string; globalIndex: string};
    };

export type OpenPlan = {kind: 'none'} | {kind: 'reveal'} | {kind: 'push'; href: ReaderHref};

export function planOpenPlaying(session: AdhkarSession | null, current: AdhkarFocus): OpenPlan {
  if (!session) return {kind: 'none'};
  const item = session.items[session.index];
  if (!item) return {kind: 'none'};
  if (current && current.listId === session.listId) return {kind: 'reveal'};
  const globalIndex = String(session.index);
  if (session.listId === 'saved') {
    return {
      kind: 'push',
      href: {pathname: '/(tabs)/(a.home)/adhkar/saved/[dhikrId]', params: {dhikrId: item.dhikrId, globalIndex}},
    };
  }
  return {
    kind: 'push',
    href: {
      pathname: '/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]',
      params: {superId: session.listId, dhikrId: item.dhikrId, globalIndex, superCategoryTitle: session.listTitle},
    },
  };
}

export function openPlayingDhikr(
  router: {push(href: ReaderHref): void; replace(href: ReaderHref): void},
  mode: 'push' | 'replace' = 'push',
): boolean {
  const {session, requestReveal} = useAdhkarSessionStore.getState();
  const plan = planOpenPlaying(session, getAdhkarFocus());
  if (plan.kind === 'none') return false;
  if (plan.kind === 'reveal') {
    requestReveal();
    return true;
  }
  router[mode](plan.href);
  return true;
}
```

The expo-router `router` type accepts these hrefs. If tsc rejects the structural parameter type, type the parameter as `Pick<Router, 'push' | 'replace'>` from `expo-router` instead.

- [ ] **Step 4: The deep link route**

```tsx
// app/adhkar-playing.tsx
// bayaan://adhkar-playing (lock screen, Live Activity): the playing dhikr's
// reader, or the Adhkar screen when nothing is playing or saved.
import {useEffect} from 'react';
import {useRouter} from 'expo-router';
import {openPlayingDhikr} from '@/services/adhkar/playback/openPlayingDhikr';

export default function AdhkarPlayingRoute(): null {
  const router = useRouter();
  useEffect(() => {
    if (!openPlayingDhikr(router, 'replace')) {
      router.replace('/(tabs)/(a.home)/adhkar');
    }
  }, [router]);
  return null;
}
```

Check `app/_layout.tsx` for a root `Stack` that lists screens explicitly. If it does, register `adhkar-playing` with `headerShown: false` and `animation: 'none'`, following how `player` is registered.

- [ ] **Step 5: Run the tests and tsc**

Run: `npx jest services/adhkar/playback && npx tsc --noEmit`
Expected: PASS and clean.

- [ ] **Step 6: Commit**

```bash
git add services/adhkar/playback/openPlayingDhikr.ts services/adhkar/playback/__tests__/openPlayingDhikr.test.ts app/adhkar-playing.tsx app/_layout.tsx
git commit -m "feat(adhkar): open the playing dhikr from anywhere; adhkar-playing deep link"
```

---

### Task 6: Playing indicator on list cards

**Files:**
- Create: `components/adhkar/PlayingBars.tsx`
- Modify: `components/adhkar/DhikrListItem.tsx`
- Modify: `app/(tabs)/(a.home)/adhkar/[superId]/index.tsx` (`renderItem`)
- Modify: `app/(tabs)/(a.home)/adhkar/saved/index.tsx` (`renderItem`)
- Test: `components/adhkar/__tests__/DhikrListItem.playing.test.tsx`

**Interfaces:**
- Consumes: `useAdhkarSessionStore`.
- Produces:
  - `PlayingBars({animating, color, size}: {animating: boolean; color: string; size?: number}): React.JSX.Element`
  - `DhikrListItem` props `isCurrent?: boolean` (default false) and `isPlaying?: boolean` (default false)

- [ ] **Step 1: Write the failing test**

```tsx
// components/adhkar/__tests__/DhikrListItem.playing.test.tsx
import React from 'react';
import {render} from '@testing-library/react-native';
import {DhikrListItem} from '@/components/adhkar/DhikrListItem';
import type {Dhikr} from '@/types/adhkar';

const dhikr: Dhikr = {id: 'a', categoryId: 'c', arabic: 'سُبْحَانَ اللَّهِ', translation: null, transliteration: null, instruction: null, repeatCount: 1, audioFile: 'a.mp3', sortOrder: 1};

it('shows bars only on the current card', () => {
  const {queryByTestId, rerender} = render(<DhikrListItem dhikr={dhikr} index={0} />);
  expect(queryByTestId('dhikr-playing-bars')).toBeNull();
  rerender(<DhikrListItem dhikr={dhikr} index={0} isCurrent isPlaying />);
  expect(queryByTestId('dhikr-playing-bars')).toBeTruthy();
});
```

Copy the mocks from `components/adhkar/__tests__/AdhkarArabicText.test.tsx`: theme, fonts and any Skia or Digital Khatt mocks `DhikrListItem` needs.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest components/adhkar/__tests__/DhikrListItem.playing.test.tsx`
Expected: FAIL, no element with testID `dhikr-playing-bars`.

- [ ] **Step 3: Implement the bars**

```tsx
// components/adhkar/PlayingBars.tsx
// Three small bars: moving while adhkar plays, still when paused or when
// Reduce Motion is on.
import React, {useEffect} from 'react';
import {View} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {moderateScale} from 'react-native-size-matters';

const BAR_DELAYS = [0, 180, 360];
const STILL_SCALES = [0.5, 0.9, 0.65];

function Bar({value, color, width, height}: {value: SharedValue<number>; color: string; width: number; height: number}): React.JSX.Element {
  const style = useAnimatedStyle(() => ({transform: [{scaleY: value.value}]}));
  return <Animated.View style={[{width, height, borderRadius: width / 2, backgroundColor: color}, style]} />;
}

export function PlayingBars({animating, color, size = moderateScale(12)}: {animating: boolean; color: string; size?: number}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const a = useSharedValue(STILL_SCALES[0]);
  const b = useSharedValue(STILL_SCALES[1]);
  const c = useSharedValue(STILL_SCALES[2]);

  useEffect(() => {
    const values = [a, b, c];
    values.forEach((v, i) => {
      cancelAnimation(v);
      if (animating && !reduceMotion) {
        v.value = withDelay(BAR_DELAYS[i], withRepeat(withTiming(1, {duration: 420}), -1, true));
      } else {
        v.value = withTiming(STILL_SCALES[i], {duration: 150});
      }
    });
  }, [animating, reduceMotion, a, b, c]);

  const width = Math.max(2, Math.round(size / 5));
  return (
    <View testID="dhikr-playing-bars" style={{flexDirection: 'row', alignItems: 'flex-end', gap: width / 1.5, height: size}}>
      {[a, b, c].map((v, i) => (
        <Bar key={i} value={v} color={color} width={width} height={size} />
      ))}
    </View>
  );
}
```

- [ ] **Step 4: Use the bars in DhikrListItem**

In `components/adhkar/DhikrListItem.tsx`:
- Add `isCurrent?: boolean; isPlaying?: boolean;` to `DhikrListItemProps`. Destructure both with a default of `false`, and add them to the `React.memo` comparator if the component has one.
- In the number header, when `isCurrent`, render `<PlayingBars animating={isPlaying} color={theme.colors.textSecondary} />` beside the number. Keep the number and lay the two out in a row with a small gap.
- When `isCurrent`, give the card container `backgroundColor: Color(theme.colors.text).alpha(0.06).toString()`, layered over its existing background. `Color` is already used in the adhkar components; import it as they do.

- [ ] **Step 5: Pass the props from the lists**

In `app/(tabs)/(a.home)/adhkar/[superId]/index.tsx`:

```tsx
  const currentDhikrId = useAdhkarSessionStore(s =>
    s.session?.listId === superId ? s.session.items[s.session.index]?.dhikrId ?? null : null,
  );
  const sessionPlaying = useAdhkarSessionStore(s =>
    s.session?.listId === superId && (s.session.status === 'playing' || s.session.status === 'loading'),
  );
```

- In `renderItem`, pass `isCurrent={item.dhikr.id === currentDhikrId}` and `isPlaying={item.dhikr.id === currentDhikrId && sessionPlaying}` to both `DhikrListItem` usages, and add both values to the `useCallback` dependencies.
- In `saved/index.tsx`, do the same with `'saved'` as the list id.

- [ ] **Step 6: Run the tests**

Run: `npx jest components/adhkar`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/adhkar/PlayingBars.tsx components/adhkar/DhikrListItem.tsx components/adhkar/__tests__/DhikrListItem.playing.test.tsx app/'(tabs)'/'(a.home)'/adhkar
git commit -m "feat(adhkar): playing indicator on the current list card"
```

---

### Task 7: Now-playing tile on Home and row on the Adhkar screen

**Files:**
- Create: `components/adhkar/AdhkarNowPlayingCard.tsx`
- Modify: `components/RecitersView.tsx` (`Section`, `MemoizedFlatList` and the `'continue-listening'` row node, about lines 84-170, 324-397 and 578-590)
- Modify: `components/AdhkarView.tsx` (above `<SavedAdhkarHero>`, about line 167)
- Modify: `i18n/locales/en/home.json` and `i18n/locales/ar/home.json`
- Test: `components/adhkar/__tests__/AdhkarNowPlayingCard.test.tsx`

**Interfaces:**
- Consumes: `useAdhkarSessionStore`, `openPlayingDhikr` (Task 5), `dropStaleSession` (Task 2) and `PlayingBars` (Task 6).
- Produces:
  - `AdhkarNowPlayingCard({variant}: {variant: 'tile' | 'row'}): React.JSX.Element | null`
  - `useHasAdhkarSession(): boolean`

**New i18n keys** in `home.json` under `adhkar`:

| Key | en | ar |
|---|---|---|
| `nowPlaying` | "Now playing" | "قيد التشغيل" |
| `paused` | "Paused" | "متوقف مؤقتًا" |
| `play` | "Play adhkar" | "تشغيل الأذكار" |
| `pause` | "Pause adhkar" | "إيقاف الأذكار مؤقتًا" |
| `stopSession` | "Stop adhkar" | "إنهاء الأذكار" |
| `openPlaying` | "Open the playing dhikr" | "فتح الذكر قيد التشغيل" |
| `jumpToPlaying` | "Now playing" | "قيد التشغيل" (used by Task 8) |

- [ ] **Step 1: Write the failing test**

```tsx
// components/adhkar/__tests__/AdhkarNowPlayingCard.test.tsx
import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {AdhkarNowPlayingCard} from '@/components/adhkar/AdhkarNowPlayingCard';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({useRouter: () => ({push: mockPush, replace: jest.fn()})}));

const items = [{dhikrId: 'a', audioFile: 'a.mp3', playable: true, preview: 'a'}, {dhikrId: 'b', audioFile: 'b.mp3', playable: true, preview: 'b'}];

beforeEach(() => {
  mockPush.mockClear();
  useAdhkarSessionStore.setState({session: null, revealToken: 0});
});

it('renders nothing without a session', () => {
  const {toJSON} = render(<AdhkarNowPlayingCard variant="row" />);
  expect(toJSON()).toBeNull();
});

describe('with a session', () => {
  beforeEach(() => {
    useAdhkarSessionStore.setState({
      session: {listId: 'morning-adhkar', listTitle: 'Morning Adhkar', items, index: 1, mode: 'all', loop: false, status: 'playing', error: false, trackToken: 1, positionSec: 0, lastActiveAt: Date.now()},
    });
  });
  it('shows the title and position', () => {
    const {getByText} = render(<AdhkarNowPlayingCard variant="row" />);
    expect(getByText('Morning Adhkar')).toBeTruthy();
    expect(getByText('2 of 2')).toBeTruthy();
  });
  it('toggles, stops and opens', () => {
    const {getByTestId} = render(<AdhkarNowPlayingCard variant="tile" />);
    fireEvent.press(getByTestId('adhkar-now-playing-toggle'));
    expect(useAdhkarSessionStore.getState().session?.status).toBe('paused');
    fireEvent.press(getByTestId('adhkar-now-playing-open'));
    expect(mockPush).toHaveBeenCalled();
    fireEvent.press(getByTestId('adhkar-now-playing-close'));
    expect(useAdhkarSessionStore.getState().session).toBeNull();
  });
});
```

Use the i18n test setup the repo already uses for component tests, so `getByText('2 of 2')` resolves through `home:adhkar.position`. Check an existing component test that renders translated text and copy its setup.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest components/adhkar/__tests__/AdhkarNowPlayingCard.test.tsx`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Implement the card**

Build `components/adhkar/AdhkarNowPlayingCard.tsx` with these properties:

**State**
- It reads `session` from the store. On mount, it calls `dropStaleSession(Date.now())` in an effect. It returns `null` without a session.

**Layout**
- `variant: 'tile'`:
  - 200 wide, the width `getItemLayout` uses for `recent`. Match the height, radius and background of the `recent` cards in `RenderSectionItem`; read that component and copy the style values.
  - Top line: `PlayingBars` (animating when status is `playing` or `loading`), then the `listTitle`, `numberOfLines={1}`.
  - Second line: `t('adhkar.position', {current: index + 1, total: items.length})`, muted.
  - Bottom row: a play/pause button (`testID="adhkar-now-playing-toggle"`, `PlayIcon` and `PauseIcon` from `@/components/Icons`) and a close button (`testID="adhkar-now-playing-close"`, Feather `x`).
- `variant: 'row'`:
  - Full width with horizontal padding matching `AdhkarView`'s `tileDimensions.horizontalPadding`, which the parent passes through its container.
  - One line: bars, then the title and position stacked, then toggle and close on the right.
  - Height about `moderateScale(56)`, radius 14, background `Color(theme.colors.text).alpha(0.06)`.

**Actions**
- The body is a `Pressable` with `testID="adhkar-now-playing-open"` and `accessibilityLabel={t('adhkar.openPlaying')}`. It calls `openPlayingDhikr(router)`.
- The toggle dispatches `{type: 'toggle'}`, with `accessibilityLabel` set to `t('adhkar.pause')` or `t('adhkar.play')`.
- The close button dispatches `{type: 'stop'}`, with `accessibilityLabel={t('adhkar.stopSession')}`.

**Style and export**
- Colors come only from `theme.colors.text`, `textSecondary` and `background`. Fonts come from `theme.fonts`, as in neighbouring components.
- Also export `useHasAdhkarSession(): boolean` (`useAdhkarSessionStore(s => s.session !== null)`).

- [ ] **Step 4: Put the tile at the head of Continue Listening**

In `components/RecitersView.tsx`:
1. Add `showAdhkarTile?: boolean` to the props of both `Section` and `MemoizedFlatList`, and add `prevProps.showAdhkarTile === nextProps.showAdhkarTile` to both memo comparators.
2. In `MemoizedFlatList`, pass `ListHeaderComponent={showAdhkarTile ? <View style={{marginRight: moderateScale(12)}}><AdhkarNowPlayingCard variant="tile" /></View> : null}`. Add the leading width to `getItemLayout`'s offset: `+ (showAdhkarTile && variant === 'recent' ? 200 : 0)`. Check the real gap between recent tiles in `styles` and use the same value for the header's margin.
3. In `Section`, change `if (!data.length) return null;` to `if (!data.length && !showAdhkarTile) return null;`. Render the Clear button only when `onClear && data.length > 0`.
4. In the `rowNodes['continue-listening']` builder, set `const showAdhkarTile = useHasAdhkarSession();` at the top level of the component, among the other hooks. Then render `<Section ... showAdhkarTile={showAdhkarTile} />` when `validRecentTracks.length > 0 || showAdhkarTile`.

- [ ] **Step 5: Add the row on the Adhkar screen**

In `components/AdhkarView.tsx`, right before `<SavedAdhkarHero ... />`, add:

```tsx
      <View style={{paddingHorizontal: tileDimensions.horizontalPadding, marginBottom: moderateScale(8)}}>
        <AdhkarNowPlayingCard variant="row" />
      </View>
```

`AdhkarNowPlayingCard` returns `null` without a session. Wrap it so the padded `View` renders only with a session: `useHasAdhkarSession() && (...)`. That keeps an empty 8 pt gap from shifting the layout.

- [ ] **Step 6: Run the tests and the i18n check**

Run: `npx jest components/adhkar && npm run i18n:check && npx tsc --noEmit`
Expected: PASS, clean, clean.

- [ ] **Step 7: Commit**

```bash
git add components/adhkar/AdhkarNowPlayingCard.tsx components/adhkar/__tests__/AdhkarNowPlayingCard.test.tsx components/RecitersView.tsx components/AdhkarView.tsx i18n/locales
git commit -m "feat(adhkar): now playing tile in Continue Listening and row on the Adhkar screen"
```

---

### Task 8: Jump-to-playing pill in the lists

**Files:**
- Create: `components/adhkar/AdhkarJumpPill.tsx`
- Modify: `app/(tabs)/(a.home)/adhkar/[superId]/index.tsx`
- Modify: `app/(tabs)/(a.home)/adhkar/saved/index.tsx`
- Test: `components/adhkar/__tests__/jumpPillDirection.test.ts`

**Interfaces:**
- Consumes: `useAdhkarSessionStore` (including `revealToken`), `PlayingBars`, and the `home:adhkar.jumpToPlaying` key.
- Produces:
  - `jumpPillDirection(visible: readonly number[], target: number | null): 'up' | 'down' | null`
  - `AdhkarJumpPill({direction, playing, top, onPress}: {direction: 'up' | 'down' | null; playing: boolean; top: number; onPress: () => void}): React.JSX.Element`

- [ ] **Step 1: Write the failing test**

```ts
// components/adhkar/__tests__/jumpPillDirection.test.ts
import {jumpPillDirection} from '@/components/adhkar/AdhkarJumpPill';

it('is null when the target is visible or missing', () => {
  expect(jumpPillDirection([3, 4, 5], 4)).toBeNull();
  expect(jumpPillDirection([3, 4, 5], null)).toBeNull();
  expect(jumpPillDirection([], 4)).toBeNull();
});
it('points up when the target is above the visible rows', () => {
  expect(jumpPillDirection([10, 11, 12], 2)).toBe('up');
});
it('points down when the target is below', () => {
  expect(jumpPillDirection([0, 1, 2], 9)).toBe('down');
});
```

An empty `visible` array means nothing is measured yet, so no pill.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest components/adhkar/__tests__/jumpPillDirection.test.ts`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Implement the pill**

```tsx
// components/adhkar/AdhkarJumpPill.tsx
// "Now playing" pill under the header: shown while the playing row of this
// list is scrolled away, pointing toward it.
import React, {useEffect} from 'react';
import {Pressable, Text} from 'react-native';
import Animated, {useAnimatedStyle, useReducedMotion, useSharedValue, withTiming} from 'react-native-reanimated';
import {Feather} from '@expo/vector-icons';
import {moderateScale} from 'react-native-size-matters';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {PlayingBars} from './PlayingBars';

const FADE_MS = 150;

export function jumpPillDirection(visible: readonly number[], target: number | null): 'up' | 'down' | null {
  if (target === null || visible.length === 0 || visible.includes(target)) return null;
  return target < Math.min(...visible) ? 'up' : 'down';
}

export function AdhkarJumpPill({
  direction,
  playing,
  top,
  onPress,
}: {
  direction: 'up' | 'down' | null;
  playing: boolean;
  top: number;
  onPress: () => void;
}): React.JSX.Element {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  useEffect(() => {
    const to = direction ? 1 : 0;
    opacity.value = reduceMotion ? to : withTiming(to, {duration: FADE_MS});
  }, [direction, reduceMotion, opacity]);
  const style = useAnimatedStyle(() => ({opacity: opacity.value}));

  return (
    <Animated.View
      pointerEvents={direction ? 'auto' : 'none'}
      style={[{position: 'absolute', top, alignSelf: 'center', zIndex: 10}, style]}>
      <Pressable
        testID="adhkar-jump-pill"
        accessibilityRole="button"
        accessibilityLabel={t('adhkar.jumpToPlaying')}
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: moderateScale(8),
          paddingHorizontal: moderateScale(14),
          height: moderateScale(34),
          borderRadius: moderateScale(17),
          backgroundColor: theme.colors.background,
          borderWidth: 1,
          borderColor: Color(theme.colors.text).alpha(0.12).toString(),
        }}>
        <PlayingBars animating={playing} color={theme.colors.textSecondary} size={moderateScale(11)} />
        <Text style={{fontFamily: theme.fonts.semiBold, fontSize: moderateScale(13), color: theme.colors.text}}>
          {t('adhkar.jumpToPlaying')}
        </Text>
        <Feather name={direction === 'up' ? 'arrow-up' : 'arrow-down'} size={moderateScale(14)} color={theme.colors.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}
```

If the theme's background is transparent under the glass header, add a shadow matching the app's floating elements: `shadowOpacity: 0.12`, `shadowRadius: 8` and `elevation: 3`.

- [ ] **Step 4: Wire it in the category list**

In `app/(tabs)/(a.home)/adhkar/[superId]/index.tsx`, after the selectors Task 6 added:

```tsx
  const sessionIndex = useAdhkarSessionStore(s => (s.session?.listId === superId ? s.session.index : null));
  const revealToken = useAdhkarSessionStore(s => s.revealToken);
  const [visibleIndices, setVisibleIndices] = useState<number[]>([]);
  const sectionListRef = useRef<SectionList<DhikrItem, Section>>(null);
```

- **Extend** `onViewableItemsChanged` (keep the section title logic) with:

```tsx
        setVisibleIndices(
          viewableItems
            .map(v => (v.item as DhikrItem | undefined)?.globalIndex)
            .filter((i): i is number => typeof i === 'number'),
        );
```

  Then remove the `as` cast by typing the callback as `({viewableItems}: {viewableItems: ViewToken<DhikrItem>[]})`, if the installed RN `ViewToken` type is generic. If it isn't, keep a narrowing helper `function globalIndexOf(token: ViewToken): number | null` that checks `typeof token.item === 'object' && token.item !== null && 'globalIndex' in token.item`.

- **Map a session index to a section location.** Add a helper inside the component: `locationOf(globalIndex)` walks `sections` and returns `{sectionIndex, itemIndex}`.

- **Scroll to the playing row** with `scrollToPlaying`:

```tsx
  const scrollToPlaying = useCallback(() => {
    if (sessionIndex === null) return;
    const loc = locationOf(sessionIndex);
    if (!loc) return;
    sectionListRef.current?.scrollToLocation({...loc, viewPosition: 0.3, animated: true});
  }, [sessionIndex, locationOf]);
```

  Add `onScrollToIndexFailed={info => setTimeout(() => sectionListRef.current?.scrollToLocation({sectionIndex: 0, itemIndex: Math.min(info.index, 0), viewPosition: 0, animated: false}), 50)}` only if the SectionList does not already handle it. The fallback is a jump to the top, followed by a retry of `scrollToPlaying` 100 ms later.

- **React to reveals:** on a `revealToken` change, scroll to the row, with the same ref-guard pattern as Task 4 step 4, calling `scrollToPlaying()`.
- **Render the pill** after the `SectionList`, inside the root `View`:

```tsx
      <AdhkarJumpPill
        direction={jumpPillDirection(visibleIndices, sessionIndex)}
        playing={sessionPlaying}
        top={headerHeight + moderateScale(8)}
        onPress={scrollToPlaying}
      />
```

  Attach `ref={sectionListRef}` to the existing `SectionList`.

- [ ] **Step 5: Wire it in the Saved list**

Make the same change in `saved/index.tsx` with its `FlatList`:
- the visible indices are `v.index`;
- the target is `sessionIndex` for `'saved'`;
- scroll with `flatListRef.current?.scrollToIndex({index, viewPosition: 0.3, animated: true})` and the same failure fallback.

- [ ] **Step 6: Run the tests and tsc**

Run: `npx jest components/adhkar && npx tsc --noEmit`
Expected: PASS and clean.

- [ ] **Step 7: Commit**

```bash
git add components/adhkar/AdhkarJumpPill.tsx components/adhkar/__tests__/jumpPillDirection.test.ts app/'(tabs)'/'(a.home)'/adhkar
git commit -m "feat(adhkar): jump to now playing pill in the lists"
```

---

### Task 9: Lock screen

**Files:**
- Modify: `services/audio/LockScreenService.ts`
- Modify: `services/adhkar/playback/adhkarPlaybackEngine.ts`. Only if the `activate`/`clear` dep signatures need adjusting; they should already match.
- Test: `services/audio/__tests__/LockScreenService.adhkar.test.ts`

**Interfaces:**
- Consumes: `AdhkarSession` and the engine's `EnginePlayer` type, plus `i18n` from `@/i18n` and `branding` from wherever `components/RecitersView.tsx` imports it.
- Produces:
  - `adhkarLockScreenTitle(session: AdhkarSession, position: (current: number, total: number) => string): string`
  - `lockScreenService.activateAdhkar(player: EnginePlayer, session: AdhkarSession): void`
  - `lockScreenService.clearAdhkar(player: EnginePlayer): void`

- [ ] **Step 1: Write the failing test**

```ts
// services/audio/__tests__/LockScreenService.adhkar.test.ts
import {adhkarLockScreenTitle} from '@/services/audio/LockScreenService';
import type {AdhkarSession} from '@/services/adhkar/playback/types';

const session: AdhkarSession = {
  listId: 'morning-adhkar', listTitle: 'Morning Adhkar',
  items: Array.from({length: 23}, (_, i) => ({dhikrId: String(i), audioFile: `${i}.mp3`, playable: true, preview: ''})),
  index: 3, mode: 'all', loop: false, status: 'playing', error: false, trackToken: 1, positionSec: 0, lastActiveAt: 0,
};

it('builds "Morning Adhkar · 4 of 23"', () => {
  expect(adhkarLockScreenTitle(session, (c, t) => `${c} of ${t}`)).toBe('Morning Adhkar · 4 of 23');
});
```

Also add tests to this file, following the mocking in `services/audio/__tests__/LockScreenService.test.ts`:
- `activateAdhkar` calls `player.setActiveForLockScreen(true, {title, artist}, {showSeekForward: false, showSeekBackward: false})`;
- it clears the main and mushaf players;
- while the adhkar entry is active, a main store track change does not re-activate the main player;
- `clearAdhkar` calls `setActiveForLockScreen(false)` on the adhkar player, then `syncCurrentState()`, which restores the main player.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest services/audio/__tests__/LockScreenService.adhkar.test.ts`
Expected: FAIL, `adhkarLockScreenTitle` is not exported.

- [ ] **Step 3: Implement**

In `services/audio/LockScreenService.ts`:
- Export:

```ts
export function adhkarLockScreenTitle(
  session: AdhkarSession,
  position: (current: number, total: number) => string,
): string {
  return `${session.listTitle} · ${position(session.index + 1, session.items.length)}`;
}
```

- Add a private field `private adhkarPlayer: AudioPlayer | null = null;`.
- Add `activateAdhkar(player, session)`:
  - set `this.adhkarPlayer = player`;
  - call `clearPlayer` for the main and mushaf players;
  - call `player.setActiveForLockScreen(true, {title: adhkarLockScreenTitle(session, (current, total) => i18n.t('home:adhkar.position', {current, total})), artist: branding.appName}, {showSeekForward: false, showSeekBackward: false})` inside try/catch, logging in `__DEV__` like the other activations.
  - When called again with the same player, it updates the metadata (`updateLockScreenMetadata`) instead of re-activating.
- Add `clearAdhkar(player)`: `this.clearPlayer(player)`, `this.adhkarPlayer = null`, `this.lastTrackId = null`, then `this.syncCurrentState()`.
- In `subscribeToStore`, change `if (this.isMushafActive) return;` to `if (this.isMushafActive || this.adhkarPlayer) return;`.
- In `stopSync`, also clear `this.adhkarPlayer` if it is set.

`EnginePlayer` is structural, while `setActiveForLockScreen` exists on the real `AudioPlayer`. Type the two new methods' `player` parameter as `AudioPlayer` from expo-audio. In the engine, add `setActiveForLockScreen` and `updateLockScreenMetadata` to the `EnginePlayer` interface, copying their signatures from `node_modules/expo-audio/build/AudioModule.types.d.ts`, so the real player satisfies both without a cast. Update the engine test's `fakePlayer` with `jest.fn()` for both.

- [ ] **Step 4: Update the metadata on track change**

The engine already calls `lockScreen.activate(player, session)` once per `trackToken` when playing (Task 3), which covers index changes. No engine change should be needed. Confirm that the engine test "advances on finish" now sees `lockScreen.activate` called twice: add that assertion.

- [ ] **Step 5: Run the tests**

Run: `npx jest services/audio services/adhkar/playback`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/audio/LockScreenService.ts services/audio/__tests__/LockScreenService.adhkar.test.ts services/adhkar/playback
git commit -m "feat(adhkar): lock screen and Control Center entry for the adhkar session"
```

---

### Task 10: Whole-branch verification and simulator QA

The controller runs this after the final review, not a subagent. Nothing is committed unless QA finds a defect; each fix goes through a new fix task.

- [ ] **Step 1: Full checks**

Run, in the worktree:

```bash
npx tsc --noEmit
node node_modules/prettier/bin/prettier.cjs --check $(git diff --name-only fix/adhkar-text-polish...HEAD -- '*.ts' '*.tsx' '*.json' '*.md')
npx jest services/adhkar services/audio store components/adhkar hooks utils services/widgets
npm run i18n:check
grep -rnP "\x{2014}" $(git diff --name-only fix/adhkar-text-polish...HEAD)
```

Expected:
- tsc is clean, apart from the known `syncContentWidgets.ts` lines;
- Prettier is clean;
- jest passes;
- the i18n check is clean;
- the em dash grep finds nothing.

- [ ] **Step 2: Merge into the local test branch**

In `~/orca/workspaces/Bayaan/widgets`, run `git merge --no-ff feat/adhkar-playback` on `build/combined-test`. Never push that branch.

Metro (port 8081, `--lan`) is already running from that worktree. Reload the app on "Bayaan Widgets" (B68030CC-7E5B-4127-BE07-EFA327BE6680) and on the Android emulator. Never touch the "(test)" or "(test 2)" simulators, and do not kill BayaanAAOS15.

- [ ] **Step 3: Simulator QA with screenshots (Argent)**

Take a screenshot at each step on iOS 26, and repeat steps 1, 2, 4 and 7 on Android:

1. **Play All continues across tabs.** Start Play All in Morning, wait for item 2, then switch to the Search tab. Playback continues: the position keeps moving in the Home tile when you return.
2. **Home tile and Adhkar row.** Home shows the tile first in Continue Listening, with "Morning Adhkar", "2 of 23" and moving bars. Tap it: the reader opens on the playing page. The Adhkar screen shows the row above Saved.
3. **List pill and indicator.** Open the Morning list and scroll to the bottom: the pill appears under the header with an up arrow. Tap it: the list scrolls to the playing card, which shows bars and the tint.
4. **No shift on swipe.** In the reader, swipe between two pages. Compare screenshots: the Arabic block's y-position is identical.
5. **Card play wins.** During Morning Play All, open Evening, open item 3 and press play. Evening item 3 plays, and the tile says "Evening Adhkar".
6. **Quran pauses adhkar.** Start any surah: adhkar pauses and the tile shows the paused icon. Press play on the tile: the surah pauses and adhkar resumes where it stopped.
7. **Restore.** Pause, kill the app and relaunch: the tile is back, paused. Press play: it continues from the saved position.
8. **Lock screen.** Lock the simulator (`xcrun simctl` is allowed for locking). The now-playing entry reads "Morning Adhkar · N of 23".

- [ ] **Step 4: Device check**

Ask Osman before installing on his phone. With his go-ahead:
- auto-advance through five clips with the screen locked;
- lock screen play and pause from the lock screen;
- relaunch restore.

Record the results in the PR body.
