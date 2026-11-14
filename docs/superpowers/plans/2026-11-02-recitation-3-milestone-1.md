# Recitation 3.0, milestone 1: engine foundations and "Which ayah?" (in app)

**Goal:** Give every recitation feature one owner for the model and the microphone, keep a local log of each take, survive phone calls, and ship the first new feature on top: a "Which ayah?" sheet that names the ayah being recited, opened from "Recite to search" in the search tab.

**Architecture:** `engineHost` owns the Tilawa model (download, load, idle unload). `sessionRunner` owns the one active listening session (permission, pausing Bayaan's audio, mic, watchdog, interruptions, stop and flush). Purpose controllers sit on top: the existing follow-along service (`RecitationTrackingService`, public API unchanged, still writing `useRecitationTrackingStore`) and the new identify service (writing its own `useAyahIdentifyStore`, so the mushaf never reacts to it). Finished follow-along takes are reduced to events by a pure `take` reducer and saved to a local SQLite log.

**Tech stack:** `@tilawa/core` 0.4.0 (patched), `onnxruntime-react-native`, `react-native-audio-api`, zustand, expo-sqlite, react-native-actions-sheet, i18next, Jest (`jest-expo`).

**Spec:** the team doc "Bayaan 3.0: what to build on recitation recognition" (2026-10-29), sections "Sequencing" steps 1 (Foundations) and 2 (Which ayah?, in-app part). Earlier research: `docs/features/recitation-follow-along/phase-3-research.md`, `phase-4-research.md`.

**Out of this milestone (next ones):** native fbank port, locked-phone/background listening, iOS control / Siri / Action button, Android tile, Live Activity and Android Live Update, the post-take skip report (correction mode in hidden takes), quizzes, mutashabihat trainer, hifz coach.

## Global constraints

- Licence (NPL-1.2 on the model, corpus and look-alike index): nothing it powers may be charged for. No paywall, subscription, trial or ads on these features.
- Honest claims: say "follows your recitation", "may have skipped", "may have read the similar ayah". Never "correct", "perfect", "detects your mistakes" or anything about tajweed.
- Privacy: audio never leaves the phone. Takes store events (ayah, word indices, timings), never audio.
- Hafs only: Tilawa reports Hafs keys. Identify results are Hafs verses; "Play from here" is offered only over Hafs text.
- Main app only: the model (66 MB, 100 to 150 MB RAM) runs in the app process.
- Adab: no sounds, confetti or red styling for recitation results.
- Quran text shown in the UI comes from the app's own data (`digitalKhattDataService`, Hafs), never typed or edited.
- i18n: every visible string goes through `t()` with English and Arabic values in the same change (`docs/i18n/README.md`). `npm run i18n:check` must pass.
- Typecheck runs with `NODE_OPTIONS=--max-old-space-size=8192` (as CI does).

## Review focus

1. Follow-along is running in the mushaf when "Which ayah?" starts: follow-along must stop (reason `superseded`) and the mushaf must not highlight the identify result. Test in Task 3.
2. The sheet closes while the model is still downloading or loading: the mic must never start afterwards. Test in Task 8.
3. Bayaan's own Quran audio starts (for example "Play from here") during any session: the session stops with `playback_started`. Test in Task 3.
4. A phone call during a take: the session pauses, the watchdog and the identify timeout do not fire while paused, and listening resumes when the call ends. Tests in Tasks 4 and 8.
5. The mushaf is set to a non-Hafs rewayah: "Play from here" is hidden and "Open in mushaf" still opens the Hafs verse. Test in Task 9.

---

### Task 1: Engine wrapper exposes the whole session

**Files:**
- Modify: `services/recitation/recitationEngine.ts`
- Test: `services/recitation/__tests__/recitationEngine.test.ts` (new)

**Interfaces:**
- Produces:
  - `stop(): Promise<WorkerOutbound[]>`: the messages `session.stop()` returned (final_sequence, structural corrections, raw_transcript); `[]` after `dispose()`.
  - `setMode(mode: RecitationMode): void`, `setExpected(passage: ExpectedPassage | null): void`, `setStructural(on: boolean): void`, `correct(action: CorrectionAction): Promise<WorkerOutbound[]>`. All go through the same queue as `feed`.
  - `setStructural(true)` passes `DEFAULT_STRUCTURAL`; `false` passes `{ayahOrder: false, similarVerse: false}`. The session is still created with `structural: false` (rules load on demand).

- [ ] **Step 1: Write the failing tests** (mock `@tilawa/core` with a fake session that logs calls and tracks concurrency, `onnxruntime-react-native` with a fake `InferenceSession.create` and `Tensor`, `expo-file-system/legacy`):
  - `stop resolves with the session's final messages`: fake `stop()` returns `[{type: 'final_sequence', verses: [{surah: 1, ayah: 1, confidence: 0.9}], confidence: 0.9}]`; `await engine.stop()` equals it.
  - `queued calls run in order and never overlap`: `feed`, `setMode('correction')`, `setExpected({surah: 2, ayah: 1, ayahEnd: 5})`, `stop` → call log `['feed', 'setMode', 'setExpected', 'stop']`, max concurrency 1.
  - `setStructural maps on and off to the session options`.
  - `a failing feed sets stats.lastError and later calls still run`.
  - `stop after dispose resolves to []`.
- [ ] **Step 2: Run** `npx jest services/recitation/__tests__/recitationEngine.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Make the queue generic, `enqueue<T>(task: () => Promise<T>, fallback: T): Promise<T>`, so `stop` and `correct` return what the session returned.
- [ ] **Step 4: Run the test.** Expected: PASS.

### Task 2: Pin the follow-along service's behaviour

**Files:**
- Test: `services/recitation/__tests__/RecitationTrackingService.test.ts` (new)

**Interfaces:**
- Consumes the current exports of `RecitationTrackingService.ts`. Mocks: `../recitationEngine` (fake engine capturing `onEvent`), `../micStream` (capturing `onChunk` and the interruption callback), `../recitationAssets`, the analytics service, player stores, `digitalKhattDataService.getVerseWords`, `AppState.addEventListener`.

- [ ] **Step 1: Write the tests** against today's behaviour (they pass before Task 3 and must still pass after it):
  - `permission denied ends in error with errorKind 'permission'`
  - `start loads the model, starts the mic and ends in listening with the hint set`
  - `word_progress sets verseKey, wordIndex, totalWords and locked`
  - `verse_match adds the key to recitedVerseKeys once`
  - `stop returns to off and stops the mic and the engine`
  - `no audio chunk for 3 s ends in an error` (fake timers)
  - `going to the background stops the take`
  - `stop during loading cancels the start` (the mic is never started)
- [ ] **Step 2: Run** `npx jest services/recitation/__tests__/RecitationTrackingService.test.ts`. Expected: PASS.

### Task 3: One owner for the model and the mic

**Files:**
- Create: `services/recitation/engineHost.ts`, `services/recitation/sessionRunner.ts`
- Modify: `services/recitation/RecitationTrackingService.ts` (becomes the follow-along controller; exports unchanged), `services/audio/AudioCoordinator.ts:124-134` (stop any session), `services/analytics/events.ts` (`RecitationStopReason` gains `'superseded' | 'not_found'`)
- Test: `services/recitation/__tests__/sessionRunner.test.ts` (new); Task 2 tests unchanged

**Interfaces:**
- `engineHost.ts`:
  - `recitationModelNeedsDownload(): Promise<boolean>`
  - `acquireEngine(onDownload: (progress: number) => void): Promise<{engine: RecitationEngine; wasLoaded: boolean}>`: downloads (with the existing download analytics) and loads on first use.
  - `setEngineListener(listener: ((msg: WorkerOutbound) => void) | null): void`
  - `markEngineBusy(busy: boolean): void`
  - `scheduleUnload(delayMs: number): void`, `cancelUnload(): void`
  - `unloadRecitationModel(): Promise<void>`: no-op while busy.
  - `removeRecitationModel(): Promise<void>`
- `sessionRunner.ts`:
  - `type SessionPurpose = 'follow' | 'identify'`
  - `type SessionErrorStage = 'permission' | 'download' | 'model_load' | 'mic' | 'engine'`
  - `type SessionUpdate = {status: 'downloading'; progress: number} | {status: 'loading'} | {status: 'listening'} | {status: 'paused'} | {status: 'off'} | {status: 'error'; stage: SessionErrorStage; message: string; kind: 'permission' | 'other'}`
  - `interface SessionHandlers { onUpdate(u: SessionUpdate): void; onEvent(msg: WorkerOutbound): void; onFinish(result: SessionFinish): void }`
  - `interface SessionFinish { messages: WorkerOutbound[]; reason: RecitationStopReason; listened: boolean; stats: RecitationStats | null; modelWasLoaded: boolean; startedAt: number }`
  - `interface SessionOptions { purpose: SessionPurpose; hint: SearchHint | null }`
  - `startSession(options: SessionOptions, handlers: SessionHandlers): Promise<boolean>`: true once listening; false if cancelled or failed.
  - `stopSession(reason: RecitationStopReason): Promise<void>`
  - `activeSessionPurpose(): SessionPurpose | null`
  - `setSessionHint(hint: SearchHint | null): void`
- Error messages are i18n keys resolved by the controllers (Task 10 adds the strings).

- [ ] **Step 1: Write the failing runner tests:**
  - `starting identify while follow is active stops follow with 'superseded'`
  - `stopSession flushes the engine and hands its messages to onFinish`
  - `events after stop go to onFinish, not onEvent`
  - `background stops the session with 'background'`
  - `no chunk for 3 s → error update with stage 'mic'`
  - `AudioCoordinator playback start stops an identify session with 'playback_started'`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Move the code.** Engine lifecycle goes to `engineHost`. Permission, pausing Quran audio (`AFTER_PAUSE_MS` 300), the mic, the watchdog (`MIC_SILENT_MS` 3000), AppState and the generation counter go to `sessionRunner`. `RecitationTrackingService` keeps the store writes, reveal and peek, and the follow-along analytics: started on `listening`, locked on the first `word_progress`, stopped in `onFinish` when `listened`. Timings and behaviour stay identical.
- [ ] **Step 4: Run** `npx jest services/recitation`. Expected: PASS, including the Task 2 tests.

### Task 4: Survive interruptions

**Files:**
- Modify: `services/recitation/micStream.ts`, `services/recitation/sessionRunner.ts`, `store/recitationTrackingStore.ts` (status gains `'paused'`), `components/mushaf/RecitationMicButton.tsx` (paused label)
- Test: `services/recitation/__tests__/sessionRunner.test.ts`

**Interfaces:**
- `startMicStream(onChunk, onInterruption: (phase: 'began' | 'ended') => void): Promise<MicStream>`
- `MicStream.resume(): Promise<void>`: reactivates the audio session and restarts the recorder.
- Runner constants: `INTERRUPTION_GIVE_UP_MS = 60_000`.

- [ ] **Step 1: Write the failing tests:**
  - `an interruption pauses the session and the watchdog does not fire while paused`
  - `when the interruption ends the mic resumes and the session is listening again`
  - `no end within 60 s stops the session with 'interruption'`
  - `a failed resume ends in an error`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** On 'began' the runner sends `paused` and stops the watchdog. On 'ended' it resumes, resets `lastChunkAt` and sends `listening`. The engine is not reset, because the tracker re-finds the reader after silence.
- [ ] **Step 4: Run them.** Expected: PASS. Update the Task 2 interruption expectation to match.

### Task 5: Take reducer

**Files:**
- Create: `services/recitation/take.ts`
- Test: `services/recitation/__tests__/take.test.ts`

**Interfaces:**
- Constants: `STALL_MS = 3000`, `STALL_MAX_MS = 20_000`.
- Records:
  - `TakeAyah {surah; ayah; confidence: number | null}`
  - `TakeFlag {kind: CorrectionIssue['kind']; surah; ayah; word; source: 'ayah_order' | 'similar_verse' | 'word'}`
  - `TakePeek {surah; ayah; kind: 'word' | 'ayah'; at}`
  - `TakeStall {surah; ayah; wordIndex; ms; at}`
  - `TakeRecord {id; purpose: SessionPurpose; startedAt; endedAt; hidden; expected: ExpectedPassage | null; stopReason: RecitationStopReason; ayat; flags; peeks; stalls}`
- `startTake(init: {id; purpose; startedAt; hidden; expected}): TakeBuilder`
- `takeEvent(b: TakeBuilder, msg: WorkerOutbound, now: number): TakeBuilder`
- `takePeek(b: TakeBuilder, peek: TakePeek): TakeBuilder`
- `finishTake(b: TakeBuilder, finalMessages: WorkerOutbound[], reason: RecitationStopReason, now: number): TakeRecord`

- [ ] **Step 1: Write the failing tests:**
  - `final_sequence wins over verse_match for the ayah list`
  - `without final_sequence the ayat follow verse_match order`
  - `a 3 s gap before the next word of the same ayah is a stall on that word` (wordIndex = the word after the gap)
  - `a gap after an ayah's last word is not a stall`
  - `gaps over 20 s are breaks, not stalls`
  - `correction errors are logged once each with their source` (structural → `ayah_order` / `similar_verse`, word rules → `word`)
  - `peeks are kept in order`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** the pure functions. They have no I/O.
- [ ] **Step 4: Run them.** Expected: PASS.

### Task 6: Recitation log database

**Files:**
- Create: `services/recitation/RecitationLogDatabase.ts`
- Test: `services/recitation/__tests__/RecitationLogDatabase.test.ts` (with `test-utils/mockExpoSqlite`)

**Interfaces:**
- File `recitation-log.db`, WAL, `PRAGMA user_version = 1`.
- `takes(id TEXT PRIMARY KEY, purpose TEXT, started_at INTEGER, ended_at INTEGER, hidden INTEGER, stop_reason TEXT, payload TEXT)`. The payload is the TakeRecord JSON.
- `take_ayat(take_id TEXT, ordinal INTEGER, surah INTEGER, ayah INTEGER, recited INTEGER, hidden INTEGER, flags INTEGER, peeks INTEGER, stalls INTEGER, recited_at INTEGER, PRIMARY KEY (take_id, ordinal))`, with an index on `(surah, ayah, recited_at)`.
- `recitationLogDatabase`:
  - `recordTake(take: TakeRecord): Promise<void>`
  - `recentTakes(limit: number): Promise<TakeSummary[]>`
  - `getTake(id: string): Promise<TakeRecord | null>`
  - `ayahHistory(surah: number, ayah: number, limit?: number): Promise<AyahHistoryRow[]>`
  - `clearHistory(): Promise<void>`
- `TakeSummary {id; purpose; startedAt; endedAt; hidden; ayatCount; flagCount; peekCount; stallCount}`
- `AyahHistoryRow {takeId; recitedAt; recited; hidden; flags; peeks; stalls}`

- [ ] **Step 1: Write the failing tests:**
  - `records a take and lists it newest first with its counts`
  - `ayahHistory has one row per take that touched the ayah`
  - `an ayah flagged as skipped gets a row with recited = 0`
  - `getTake round-trips the record`
  - `a take with no ayat and no flags is not saved`
  - `clearHistory removes everything`
  - `takes survive reopening the database`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Follow `services/uploads/UploadsDatabaseService.ts` (idempotent `initialize()` with a mutex). Write each take in one transaction.
- [ ] **Step 4: Run them.** Expected: PASS.

### Task 7: Log follow-along takes

**Files:**
- Modify: `services/recitation/RecitationTrackingService.ts`, `components/MushafSettingsContent.tsx` (a "Clear recitation history" row in the recognition model section, with a confirmation)
- Test: `services/recitation/__tests__/RecitationTrackingService.test.ts`

- [ ] **Step 1: Write the failing tests:**
  - `a finished take is saved with its ayat from final_sequence and hidden from recitationHideText`
  - `peeks during the take are saved`
  - `a save failure does not break stopping`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Start a builder on `listening`, call `takeEvent` for every engine event and `takePeek` in `peekRecitation`, then `finishTake` and `recordTake` in `onFinish`. Fire and forget, with a warning on failure.
- [ ] **Step 4: Run them.** Expected: PASS.

### Task 8: Identify controller

**Files:**
- Create: `services/recitation/identify/identicalAyat.ts`, `services/recitation/identify/AyahIdentifyService.ts`, `store/ayahIdentifyStore.ts`
- Modify: `services/analytics/events.ts`, `services/analytics/AnalyticsService.ts` (`recitation_identify_started {model_loaded}`, `recitation_identify_ended {outcome: 'found' | 'not_found' | 'cancelled' | 'error', time_to_match_ms: number | null, surah_id: number | null, listened_ms: number}`)
- Test: `services/recitation/identify/__tests__/identicalAyat.test.ts`, `services/recitation/identify/__tests__/AyahIdentifyService.test.ts`

**Interfaces:**
- `buildIdenticalAyatIndex(keys: readonly string[], wordingOf: (key: string) => string | null): Map<string, readonly string[]>`: other keys with exactly the same wording, in mushaf order.
- `identicalAyatOf(verseKey: string): readonly string[]`: lazy index over the Hafs DigitalKhatt words without ayah markers; `[]` when the Hafs text is not loaded.
- `IdentifyStatus = 'idle' | 'downloading' | 'loading' | 'listening' | 'paused' | 'found' | 'notFound' | 'error'`
- `AyahIdentifyState {status; downloadProgress; match: {surah; ayah} | null; current: {surah; ayah} | null; twins: readonly string[]; error: string | null; errorKind: 'permission' | 'other' | null}`
- `AYAH_IDENTIFY_IDLE`, `useAyahIdentifyStore`
- `IDENTIFY_TIMEOUT_MS = 20_000`
- `startAyahIdentify(): Promise<void>`, `stopAyahIdentify(): Promise<void>`

- [ ] **Step 1: Write the failing tests:**
  - `groups exact wording only`
  - `the first located ayah becomes the match and status 'found'` (from `verse_candidate` or the first `word_progress`)
  - `later word_progress moves current, not match`
  - `no match within 20 s ends in notFound and stops with 'not_found'`
  - `the timeout does not run while paused`
  - `stop during loading never starts the mic`
  - `permission error ends in error with kind 'permission'`
  - `stop returns to idle`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** on top of `startSession({purpose: 'identify', hint: null})`.
- [ ] **Step 4: Run them.** Expected: PASS.

### Task 9: "Which ayah?" sheet and "Recite to search"

**Files:**
- Create: `components/sheets/WhichAyahSheet.tsx`
- Modify: `components/sheets/sheets.tsx` (register `'which-ayah'` with its type), `app/(tabs)/(b.search)/index.tsx` (a "Recite to search" button), `i18n/locales/{en,ar}/sheets.json`, `i18n/locales/{en,ar}/home.json`
- Test: `components/sheets/__tests__/WhichAyahSheet.test.tsx`

**Behaviour:**
- On open:
  - If the model still needs downloading, show the intro inline first: on device, a one-time 75 MB download, Hafs only. The buttons are "Allow microphone and download" and "Not now".
  - Otherwise, start at once.
  - Closing the sheet calls `stopAyahIdentify()`.
- States: downloading (progress), getting ready, listening, paused, found, not found (try again), error. A permission error offers "Open Settings".
- The found state shows:
  - the surah name (`getSurahDisplayName`) and ayah number (localized digits);
  - the Hafs text from `digitalKhattDataService.tryGetVerseText(key, 'hafs')`;
  - "The same words are also at …" when there are twins;
  - "Open in mushaf", which pushes `/mushaf` with `{surah, ayah, page}`;
  - "Play from here", only when `useMushafSettingsStore.rewayah === 'hafs'`. It opens the mushaf, then sets the range to the end of the surah and calls `startPlayback(page, key)`, as `VerseActionsSheet` does.
  - The current ayah updates while listening continues.

- [ ] **Step 1: Write the failing tests:**
  - `shows the found ayah with its surah and the twins note`
  - `Open in mushaf pushes the mushaf route at the ayah`
  - `no Play from here over a non-Hafs rewayah`
  - `closing the sheet stops identify`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** the sheet in the style of `RecitationIntroSheet` (theme colours, `ScaledSheet`, Manrope), and the search entry.
- [ ] **Step 4: Run them.** Expected: PASS.

### Task 10: Translate the follow-along strings

**Files:**
- Modify:
  - `components/sheets/RecitationIntroSheet.tsx`
  - `components/MushafSettingsContent.tsx` (recognition model section)
  - `components/mushaf/RecitationMicButton.tsx` (alert, toast and bar labels)
  - `services/recitation/RecitationTrackingService.ts` (error messages become keys)
  - `i18next.config.ts` (`app/recitation-spike.tsx` is a dev screen and goes to `lint.ignore`)
  - `i18n/locales/{en,ar}/{sheets,settings,reader}.json`

- [ ] **Step 1:** Run `npm run i18n:check`. Expected: the 12 current lint errors.
- [ ] **Step 2: Move every string to a key.** English stays word for word, Arabic is added, and the Arabic is flagged for native review in the PR.
- [ ] **Step 3:** Run `npm run i18n:check && npx jest i18n/`. Expected: no issues; PASS.

### Task 11: Verify the branch

- [ ] Run `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`. Expected: no errors.
- [ ] Run `npx jest --watchAll=false --ci`. Expected: every suite passes.
- [ ] Run `npm run i18n:check`. Expected: no issues.
- [ ] Run `npx eslint` on the changed files. Expected: clean.
- [ ] Device checklist (iPhone and an Android phone):
  - identify a recitation from another phone's speaker and from a mosque speaker;
  - take a call during follow-along and during identify;
  - after a hidden take, rows appear in `recitation-log.db`;
  - follow-along still locks, follows and turns pages as before.
