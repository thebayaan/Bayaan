# Adhkar Playback Redesign

Date: 2026-10-13
Branch: `feat/adhkar-playback`, stacked on `fix/adhkar-text-polish` (#366)
Status: approved in conversation 2026-10-13; this document awaits review

## 1. Why

Osman reported five playback problems. Each has a root cause in the current code.

| Reported | Root cause |
|---|---|
| A card's play button sometimes plays the queued adhkar instead of that card | `AdhkarAudioControls.tsx` routes every card's button to the Play All toggle while `isPlayAllMode` is on, and that mode outlives the screen that started it. |
| Sometimes the next dhikr does not start, after a clip ends or after Next | `AdhkarAudioProvider` builds a new `useAudioPlayer` for every source. On iOS, expo-audio deactivates the audio session about 100 ms after a clip ends. The new player cannot reactivate it while the app is in the background. The `play()` error is swallowed, and the `lastCommand` ref blocks any retry. |
| No way back to the playing dhikr to stop it or follow along | The player lives in `adhkar/_layout.tsx`. It has no lock screen entry, is unknown to `AudioCoordinator`, and nothing outside the adhkar stack shows it. |
| The progress bar re-renders on every swipe, so the text shifts | The progress row animates its height from 0 to 40 pt depending on whether the page is the current audio file. The reader calls `setAudio` on every page, which resets `hasInteracted`. |
| Live Activity overlaps the lock screen player for Quran | Decided: drop the Live Activity for Quran and add one for adhkar. |

The provider also swaps `NoAudioProvider` for `AudioPlayerManager` whenever the source appears or disappears. That remounts the whole adhkar stack below it.

## 2. Goals and non-goals

Goals:
- One adhkar player for the whole app. It keeps playing while the user browses other tabs.
- A card's play button always acts on that card.
- Auto-advance never stalls silently, in the foreground or the background.
- Four ways back to the playing dhikr: a Home tile, a row on the Adhkar screen, the lock screen or Live Activity, and a pill inside the list.
- No layout shift when swiping between dhikr in the reader.

Non-goals:
- No floating button. iOS 26 exposes neither the tab bar frame nor its minimized state, so a floating button cannot follow the tab bar. Osman rejected a static one.
- No new full player UI and no change to the Quran mini player.
- No time-of-day suggestions. Osman wants a dedicated Home row that suggests adhkar and Quran for the moment (Morning Adhkar, Al-Mulk at night). It gets its own spec after this one, reusing `services/car/snapshot/situational.ts` (section 11).
- No next/previous buttons on the lock screen. expo-audio 57 offers only play, pause and seek there.
- The tasbeeh counter, ambient audio and the Quran players are unchanged, apart from their coordination with adhkar.

## 3. Playback engine

### 3.1 Units

| Unit | File | Responsibility |
|---|---|---|
| Session reducer | `services/adhkar/playback/sessionReducer.ts` | Pure. `(state, event) -> state`. Every rule in 3.3 lives here. |
| Session store | `store/adhkarSessionStore.ts` | Zustand store holding the reducer state. Components read from it. Only the engine dispatches player events. |
| Engine | `services/adhkar/playback/adhkarPlaybackEngine.ts` | Owns the single expo-audio player, follows the store, reports player events back. Module functions with closure state (no class), started once at audio boot. |
| Progress hook | `hooks/useAdhkarProgress.ts` | Current time, duration and seek for the playing clip. Polls the engine at 250 ms only while a component is mounted and the session is playing. |
| Navigation helper | `services/adhkar/playback/openPlayingDhikr.ts` | Opens the reader at the playing dhikr (section 5). |

The old units are removed: `store/adhkarAudioStore.ts`, `store/adhkarPlayAllStore.ts`, `components/adhkar/AdhkarAudioProvider.tsx` and `hooks/useAdhkarAudio.ts`. Their pure helpers move into the reducer with their tests: `nextPlayableIndex`, the skipping of rows without audio, and the short-clip handling from `utils/adhkarTrackEnd.ts`. The `AdhkarAudioProvider` wrapper leaves `adhkar/_layout.tsx`, so the stack no longer remounts.

### 3.2 State

```ts
type SessionStatus = 'loading' | 'playing' | 'paused';
type SessionMode = 'single' | 'all';

interface AdhkarSession {
  listId: string;          // superId, or 'saved'
  listTitle: string;       // e.g. "Morning Adhkar", already localized
  items: SessionItem[];    // the whole list, in display order
  index: number;           // current item
  mode: SessionMode;
  loop: boolean;           // repeat the current dhikr; single mode only
  status: SessionStatus;
  error: boolean;          // last play attempt failed (3.4)
  trackToken: number;      // increments on every track change
  positionSec: number;     // saved position in the current clip (3.5)
  lastActiveAt: number;    // epoch ms of the last play, pause or track change
}

interface SessionItem {
  dhikrId: string;
  audioFile: string | null;
  playable: boolean;       // false when the row has no bundled audio
  preview: string;         // first 60 characters of the clean Arabic
}

type AdhkarSessionState = {session: AdhkarSession | null};
```

`session === null` means nothing is playing, paused or saved. Every surface in section 4 hides when it is null.

### 3.3 Rules

1. **Start from a card.** Pressing play on a card whose dhikr is not the current item starts a `single` session on that dhikr. One exception: if the card belongs to the active session's list and that session is in `all` mode, the session jumps to the card and stays in `all` mode.
2. **Toggle the current card.** Pressing play or pause on the card that is the current item toggles `playing` and `paused`.
3. **Play All.** The list's Play All button starts an `all` session at the first row with audio, replacing any session (a `single` session of the same list or any session of another list). While that list's `all` session exists, the button reads "Pause" (playing or loading) or "Resume" (paused) and pressing it toggles the session between `playing` and `paused`. It never ends the session.
4. **Advance.** In `all` mode, when a clip ends the session moves to the next row with audio. After the last one the session ends. In `single` mode the clip either repeats (if `loop` is on) or ends the session.
5. **Swiping in the reader.** In the reader of the active `all` session's list, a hand swipe moves playback to the new page. This keeps the "follows a hand swipe" behavior shipped in #365. In `single` mode, swiping does not touch playback: the clip keeps playing and the other pages show an idle play button.
6. **Leaving the reader** does not stop playback.
7. **Stop.** "Stop adhkar" in the Home card's long-press sheet, or the close button on the Adhkar screen player, ends the session. Pause never ends it.
8. **One thing plays at a time.** Starting adhkar pauses the main Quran player and the mushaf player. Starting either of them pauses the adhkar session. The session stays saved, so the Home tile can resume it.
9. **Rows without audio** are skipped by advance and by Play All. A card without audio has no play button, as today.

The reducer test suite has one or more cases per rule.

### 3.4 Engine behavior

- **One player.** One player is made once with `createAudioPlayer(null, {keepAudioSessionActive: true})`. Tracks change through `player.replace(source)` followed by `play()`. The audio session therefore stays active between clips, which removes the background stall.
- **Track end.** The engine listens to `playbackStatusUpdate` and acts on `didJustFinish` only when the event's track token matches the current `trackToken`. That replaces the time guards and stale-status refs in `AdhkarAudioProvider`. The short-clip case (under 2 s) is covered by the same token check, with a test.
- **Retries.** If `play()` throws, or the player does not report `playing` within 1.5 s of a play request, the engine retries once. If the retry fails, it sets `status: 'paused'` and `error: true`. The UI then shows a paused state the user can tap again. Nothing stays stuck in "playing".
- **The player is the source of truth for play state.** A pause or play from the lock screen, headphones or Control Center arrives through `playbackStatusUpdate`. The engine dispatches `playerPaused` or `playerResumed` so the store follows. It does not fight it.
- **Coordination.** `AudioCoordinator` gains an `'adhkar'` source with `adhkarWillPlay()`, which pauses the main and mushaf players. `mainWillPlay()` and `mushafWillPlay()` end the adhkar session. The existing `usePlayerStore` subscription in `AdhkarAudioProvider` is removed.
- **Lazy load.** A restored session (3.5) does not load audio until the user presses play. Then the engine loads the current clip and seeks to `positionSec`.
- **Audio mode.** The engine relies on the app-wide audio mode that `ExpoAudioService` already sets (`interruptionMode: 'doNotMix'`, background playback on). It does not call `setAudioModeAsync` itself.

### 3.5 Saved sessions

- **What is saved.** A session is saved to AsyncStorage (the storage `store/adhkarSettingsStore.ts` uses) under the key `adhkar-session-v1`. Only these fields are saved: `listId`, `listTitle`, `mode`, `loop`, the current `dhikrId`, `positionSec` and `lastActiveAt`. `items` is not saved.
- **When it is saved.** On pause, on track change and when the app goes to the background. It is not saved on every progress tick.
- **Restore.** At launch the store rebuilds `items` from `adhkarService` for `listId` and finds the index of the saved `dhikrId`. The session comes back as `paused`. If the list or the dhikr no longer exists, the saved session is dropped.
- **Stale rules.** A saved session that is not playing is dropped:
  - for Morning and Evening, at the first window boundary (04:00 or 15:00) after `lastActiveAt`. A session lives until the period it was played in ends: Morning played at 10:00 is gone at 15:00, and Evening played at 20:00 is gone at 04:00. A list played outside its usual period follows the same rule;
  - for any other list, 24 hours after `lastActiveAt`.

  The stale check runs at launch, when the app returns to the foreground, and before any surface renders the tile.
- **Time windows.** The app has no prayer times, so the windows use the clock, like the CarPlay picks in `services/car/snapshot/situational.ts`. Morning runs 04:00 to 14:59 and Evening runs 15:00 to 03:59. The windows live in one module, `services/adhkar/timeWindows.ts`, so the suggestions row (section 11) and a later move to real prayer times change one file.
- **Ending a session.** Only these end the session and clear the saved copy: finishing the list (or a single clip ending), "Stop adhkar" in the Home card's long-press sheet, the close button on the Adhkar screen player, and the stale rules above. Pausing from any surface, including the Play All button, keeps the session.

## 4. Surfaces

All new copy uses i18n keys in every locale (`npm run i18n:check` must pass). The position label reuses `adhkar.position` ("4 of 23"). No `theme.colors.primary` or accent colors.

### 4.1 Reader card controls (`AdhkarAudioControls`)
- The play button reads `useAdhkarSessionStore` and dispatches rules 1 and 2. It never consults a mode flag.
- **Fixed progress row.** On any card with audio, the progress row always takes its full height. On the current item it shows the live slider and times. On other cards it shows the same track, empty, with "0:00", and is not interactive. The height animation is removed.
- The repeat toggle sets `loop`. It is visible in `single` mode only, as today in Play All.

### 4.2 Playing indicator on list cards (`DhikrListItem`)
- The card that is the current item of the session shows three small animated bars next to its number, plus a subtle background tint: `theme.colors.text` at 6% opacity.
- The bars are still when the session is paused.
- Reduce Motion shows them still.
- Applies to category lists and the Saved list.

### 4.3 Home tile (`components/RecitersView.tsx`, Continue Listening row)
- While a session exists (playing, paused or restored), the first card in Continue Listening is an adhkar card with the same design as the Quran recent card (`RecentReciterCard`): the list illustration on top (a neutral bookmark tile for Saved), the list title, "Dhikr 4 of 23", a read-only progress bar through the list, "19 left", and a play/pause button with `NowPlayingIndicator` while playing.
- Tapping the image or title calls `openPlayingDhikr()`. The playback zone toggles play and pause. A long press opens a sheet with "Stop adhkar", which ends the session.
- The row renders when it has recent tracks or a session. With no recent tracks it shows only the adhkar tile.
- `branding.homeRowConfig` ordering is respected. If a fork hides Continue Listening, the tile does not appear. That is accepted.

### 4.4 Adhkar screen row (`components/AdhkarView.tsx`)
- A player above `SavedAdhkarHero` with the look of the app's mini player pill (the glass pill on iOS 26, the frosted `FloatingPlayer` pill elsewhere): the list illustration as artwork, the list title, "Dhikr 4 of 23", a play/pause button and a close button that ends the session. Tapping the body calls `openPlayingDhikr()`.
- It sits inside the scroll content, so it needs no inset handling beyond the existing `headerHeight` padding.

### 4.5 Jump pill in a list (`adhkar/[superId]/index.tsx` and `adhkar/saved/index.tsx`)
- **When it shows:** only on the screen of the active session's list, and only while the current item's row is not visible (from `onViewableItemsChanged`).
- **Where it sits:** pinned just under the header (`top: headerHeight + 8`), centered horizontally.
- **What it shows:** the bars or a paused icon, the label `adhkar.jumpToPlaying`, and an arrow pointing toward the row, up or down.
- **Tap:** scrolls to the row with `scrollToLocation`, using the same retry-on-size-change approach as the deep link fix in #361.
- **Motion:** it fades in and out with a 150 ms Reanimated timing, or instantly with Reduce Motion.

## 5. Navigation to the playing dhikr

`openPlayingDhikr(router)`:
- With no session, it does nothing.
- If the reader for `session.listId` is on top, it scrolls the reader to `session.index`.
- Otherwise it pushes the reader route for the list with the session's `dhikrId` and `globalIndex = session.index`. For `saved`, it pushes `adhkar/saved/[dhikrId]`.
- Pushing from another tab switches to the Home tab first, so the adhkar stack is where the user expects it.

The Live Activity and lock screen use the URL `bayaan://adhkar-playing`. A new route file `app/adhkar-playing.tsx` calls `openPlayingDhikr` with `replace`. If no session exists, it shows the Adhkar screen instead.

## 6. Lock screen and Control Center

- When a session starts playing, the engine activates its player for the lock screen through `LockScreenService`. A new method, `activateAdhkarPlayer(title, artist)`, deactivates the main and mushaf players the same way `activateMushafPlayer` does. Seek buttons are off.
- **Title:** "Morning Adhkar · 4 of 23", built from `listTitle` and `adhkar.position`.
- **Artist:** `branding.appName`.
- The metadata updates on every index change.
- When the session ends, `LockScreenService` clears the adhkar player and restores the main player's entry, as it does after mushaf playback.
- Android gets the same entry through expo-audio's media session. No extra code is expected; the plan includes a device check.

## 7. Live Activity

- **Quran:** `liveActivityMode()` stops returning `'surah'`. Quran playback no longer starts a Live Activity. On first launch after the update, the sync ends any surah activity that is still running. The SwiftUI and planner code for surah mode stays in the tree, disabled, so a revert is a one-line change.
- **Adhkar:** a new `AdhkarSessionAttributes` type, with two identical copies in `modules/bayaan-widgets/ios` and `targets/widgets/LiveActivity`, enforced by `scripts/check-widget-system-surfaces.sh` like `NowPlayingAttributes`. Content state:

  ```swift
  struct AdhkarSessionActivityState: Codable, Hashable {
    let listTitle: String
    let preview: String     // first 60 characters of the clean Arabic
    let position: Int       // 1-based
    let total: Int
    let isPlaying: Bool
  }
  ```

- **Views:**
  - **Lock screen:** the list title, the Arabic preview right to left in the system Arabic font (widgets cannot load Digital Khatt), "4 of 23", and a play-state glyph.
  - **Dynamic Island:** compact shows the bars and "4/23"; minimal shows the bars; expanded matches the lock screen view.
  - **Stale:** past its stale date (`context.isStale`) every view shows the session as not playing, with the preview and progress dimmed. The stale date does not end the activity.
  - **Tapping** opens `bayaan://adhkar-playing`.
- **Planner:** a pure `planAdhkarActivity(memory, session)` in `services/widgets/live-activity/`:
  - it starts an activity when a session first plays;
  - it updates on index or play-state changes;
  - it ends the activity when the session ends, when the session pauses because Quran started, or after 15 minutes paused. If the app goes to the background while paused (it may then be suspended, so no timer runs), the sync ends the activity at once with a dismissal scheduled for the 15-minute mark; pressing play later starts a new one;
  - a dismissed activity is not restarted until a new session starts.

  Unit tests cover each transition.
- iOS 16.2 and later only, behind the existing `LiveActivity` widget flag. Android has no equivalent; the media notification from section 6 covers it.

## 8. Edge cases

| Case | Expected |
|---|---|
| A clip ends while the app is in the background | The next clip starts. Verified on a device with the screen locked. |
| A call or Siri interrupts | Playback pauses through the player. The store follows. No auto-resume, matching the Quran player. |
| Headphones are unplugged | Playback pauses and the store follows. |
| The adhkar data reseeds while a session exists | The session keeps its own `items` copy and plays on. A missing audio file counts as a row without audio. |
| The same dhikr is in Morning and Evening | Only the session's `listId` gets the indicator and the pill. The other list shows nothing. |
| The saved list changes during a Saved session | The session keeps its copy. The indicator matches by `dhikrId` and shows only if the row still exists. |
| Clips shorter than 2 s | They advance. Covered by the track-token test. |
| The app is killed | The saved session comes back paused at its dhikr and position, unless it is stale. The Live Activity stays on screen: once its stale date passes (10 minutes after the last update) it shows as not playing, and it is cleared at the next launch or by the system's limit on activity age. |
| The app is reopened after the window changes | A Morning session saved at 10:00 is gone at 16:00. An Evening session saved at 20:00 is still there at 23:00 and gone at 05:00. |
| A Quran surah starts during Play All | Adhkar pauses at its position and the tile shows it paused. Pressing play pauses the surah and resumes adhkar where it stopped. |

## 9. Testing

- **Unit tests (jest):**
  - the reducer, with every rule in 3.3 and every row in section 8 that is pure;
  - saving and restore: saved fields only, restore by `dhikrId`, a missing list or dhikr is dropped, and every stale rule, including the window boundaries at 03:59, 04:00, 14:59 and 15:00;
  - the engine with a mocked expo-audio player: track token, retry and failure, remote pause, coordination;
  - `openPlayingDhikr` routing;
  - `planAdhkarActivity`;
  - the lock screen title builder.
- **Component tests:** `AdhkarAudioControls` (rules 1 and 2, fixed row height); `DhikrListItem` indicator; Home tile and Adhkar row visibility; pill visibility from viewable items.
- **Simulator QA with screenshots** on "Bayaan Widgets" (iOS 26) and the Android emulator. Steps:
  1. Play All in Morning, leave to the Search tab: playback continues.
  2. The Home tile and Adhkar row appear; tapping either opens the reader at the playing page.
  3. In the list, scroll away: the pill appears with the right arrow, and tapping it scrolls back.
  4. Swipe in the reader: no text shift.
  5. Play a card in another list during Play All: that card plays.
  6. Start a surah: adhkar pauses and the tile shows it paused; resuming it pauses the surah.
  7. Kill and relaunch the app: the tile is back, paused, and plays from the saved position.
  8. Lock screen title updates.
- **Device check on Osman's phone (with his go-ahead):** auto-advance through five clips with the screen locked; the Live Activity updates and its tap target works.

## 10. Delivery

- **Two plans from this spec:**
  - **Plan A:** sections 3 to 6, covering the engine, the surfaces, navigation and the lock screen. It ships as one PR.
  - **Plan B:** section 7, the Live Activity. It ships as a second PR stacked on Plan A, because it touches Swift and the widget extension.
- Both go through SDD, with tsc, Prettier 3, jest and `npm run i18n:check` clean before review.
- After each PR is ready, the branch is merged into the local `build/combined-test` branch for device testing. It is never pushed.

## 11. Follow-up: a "For now" Home row

Osman wants a dedicated Home row for time-of-day suggestions covering both reading and listening: Morning or Evening Adhkar, Al-Mulk at night, Al-Kahf on Friday. It is out of scope here and gets its own spec. Starting points:
- `services/car/snapshot/situational.ts` already picks Al-Kahf on Fridays, Al-Mulk at night and time-of-day playlists for CarPlay;
- `services/adhkar/timeWindows.ts` from this spec;
- the Continue Listening adhkar tile, which stays in this spec as the place for a session in progress.
