# Recitation 3.0, milestone 2: recite from memory with mistake checks, and the hifz set

**Goal:** Turn the mushaf's hide-text mode into a memorisation mode that may flag skipped words, skipped ayat and look-alike ayah swaps (live, and in a summary after the take), and build the hifz set on top of it: retry practice, quizzes, a mutashabihat trainer, a hifz coach (sabaq, sabqi, manzil by spaced repetition, with a page heatmap), recitation history, and a quiet streak and daily goal.

**Architecture:**
- The session runner learns correction-mode sessions: mode, expected passage, structural rules and auto-deferred live flags.
- The engine wrapper drains every flag around `stop()`; Tilawa skips the flush while a flag is open.
- Follow-along switches to correction mode after its first lock whenever the text is hidden.
- A practice service runs short targeted takes (retry an ayah, quiz questions, trainer drills) and judges them with a pure function.
- The hifz features are pure planners over the recitation log, with screens under `app/hifz/`.

**Spec:** the team doc "Bayaan 3.0: what to build on recitation recognition" (2026-10-29), ranked features 4 to 7, 10, 11 and the idea bank's consistency streak. The doc is not in the repo. Builds on `2026-11-02-recitation-3-milestone-1.md`.

**Out of this milestone:**
- taraweeh companion and background listening;
- Live Activity;
- OS entry points;
- native fbank;
- sync.

## Global constraints

- **Honest claims:** "may have skipped", "may have read a similar ayah". Never "mistake", "correct", "wrong", "perfect", or anything about tajweed or harakat. A visible note says tajweed needs a teacher.
- **No red for flags:** flags get a neutral tint. No sounds, confetti, lives or leaderboards.
- **Hidden kinds:** `possible_vowel`, `unclear_ayah` and `possible_repetition` are never shown. Their precision on real learners is near zero (`docs/features/recitation-follow-along/phase-3-research.md`).
- **Privacy:** events only, on the phone. Rewards are private.
- **Free:** NPL-1.2, so nothing here is ever paywalled.
- **Text and translation:** Quran text comes from DigitalKhatt (Hafs) only. Every string is in English and Arabic.

## Review focus

1. **Starting mid-page in hide mode.** No ayah before the start may be flagged as skipped.
2. **Stopping while a live flag is open.** The take must still flush and save its ayat.
3. **"I read it correctly".** It must stick: the same flag in a later take on the same word stays hidden.
4. **A page that spans two surahs.** The expected passage never crosses a surah.
5. **The hifz coach with an empty log.** A sensible first plan with no errors.

---

### Task 1: Correction-ready sessions

**Files:**
- Modify: `services/recitation/recitationEngine.ts` and `services/recitation/sessionRunner.ts`.
- Test: the engine and runner suites.

**Interfaces:**
- `RecitationEngine.stop()`:
  - Before `session.stop()`, it defers any open issue (`correct('review_later')` while `session.correction.state.phase !== 'idle'`, at most 64 times).
  - After the stop, it drains the same way, so every structural flag comes back in the returned messages.
- `SessionOptions` gains:
  - `mode?: RecitationMode` (default `'tracking'`);
  - `expected?: ExpectedPassage | null`;
  - `structural?: boolean` (default false);
  - `autoDefer?: boolean` (default true).
  - All are applied at start: `setMode`, `setExpected`, `setStructural`, then `setHint`.
- `configureSession(patch: {mode?, expected?, structural?})` changes the active session.
- Auto-defer: in a correction session, a live `correction` message with phase `error` is passed on, and the runner then calls `engine.correct('review_later')`.

- [ ] **Tests:**
  - `stop defers an open issue so the take still flushes`
  - `stop drains every structural flag`
  - `a correction session applies mode, expected passage and structural rules at start`
  - `a tracking session clears what a previous correction session set`
  - `a live flag is deferred so listening goes on`
  - `configureSession switches the active session to correction`

### Task 2: Flags and passages (pure)

**Files:**
- Create: `services/recitation/flags.ts` and `services/recitation/passage.ts`.
- Test: one suite for each.

**Interfaces:**
- `FlagKind = 'skippedAyah' | 'skippedWord' | 'similarAyah' | 'differentWord'`.
- `toShownFlag(flag: TakeFlag): ShownFlag | null`, where `ShownFlag = {kind: FlagKind; surah; ayah; word; key: string}`. It returns null for the hidden kinds.
- `shownFlags(flags: readonly TakeFlag[], dismissed: ReadonlySet<string>): ShownFlag[]` dedupes, drops dismissed keys and sorts by surah, ayah, word.
- `flagKey(f) = "<kind>:<surah>:<ayah>:<word>"`.
- `passageOnPage(keys: readonly string[], from?: {surah; ayah}): ExpectedPassage | null`. It takes the page's ordered verse keys and returns the run from `from` (or the first ayah) to the last ayah of the same surah on that page.

- [ ] **Tests:**
  - `vowel, unclear and repetition flags are never shown`
  - `a similar_verse substitution is a similar-ayah flag`
  - `dismissed flags stay hidden`
  - `the passage stops at a surah boundary on the page`
  - `the passage starts where the reader started`

### Task 3: Memorisation mode in follow-along

**Files:**
- Modify:
  - `services/recitation/RecitationTrackingService.ts`
  - `store/recitationTrackingStore.ts`: adds `flags: ShownFlag[]` and `summary: TakeSummaryPayload | null`.
  - `components/mushaf/skia/useRecitationLineHighlights.ts`: neutral tint on flagged words.
  - `components/mushaf/RecitationMicButton.tsx`: hide setting and page wiring.
- Test: the follow-along suite.

**Behaviour:**
- With the hide setting on, the first lock switches the session to correction mode. The expected passage runs from the locked ayah to the end of that surah's part of the page.
- A page turn updates the expected passage to the new page's first passage.
- Live flags go to `store.flags`, minus the persisted dismissals.
- When a correction take finishes, the controller sets `summary` (range recited, flags, take id). The mushaf shows the `recitation-summary` sheet when `summary` becomes non-null.
- Turning hide off switches back to tracking.

- [ ] **Tests:**
  - `hide mode switches to correction after the first lock, from the locked ayah`
  - `live flags reach the store and dismissed ones do not`
  - `a hide-mode take ends with a summary`
  - `a plain follow-along take has no summary`

### Task 4: After-take summary and "I read it correctly"

**Files:**
- Create: `components/sheets/RecitationSummarySheet.tsx`.
- Modify:
  - `RecitationLogDatabase.ts`: adds `dismiss(flag: ShownFlag)`, `dismissedKeys(): Promise<Set<string>>`, and a `dismissed_flags` table in schema version 2.
  - `components/sheets/sheets.tsx`.
- Test: the database suite and a sheet test.

**Behaviour:**
- The sheet shows the ayat recited, then "Nothing to check" or one row per shown flag, worded by kind.
- Each row has three actions:
  - Show: opens the mushaf at the ayah;
  - Retry: Task 5 practice on that ayah;
  - I read it correctly: dismisses it and persists the dismissal.
- A footnote says these are possible slips found on the phone and that tajweed needs a teacher.

- [ ] **Tests:**
  - `a dismissed flag is remembered across reopening`
  - `the sheet lists each flag with its wording`
  - `I read it correctly removes the row and persists`

### Task 5: Practice takes

**Files:**
- Create:
  - `services/recitation/practice/judge.ts` (pure)
  - `services/recitation/practice/PracticeService.ts`
  - `store/practiceStore.ts`
- Test: one suite for each service.

**Interfaces:**
- `PracticeTarget = {expected: ExpectedPassage | null; mode: 'correction' | 'tracking'; accept?: (ayah: {surah; ayah}) => boolean; timeoutMs?: number}`.
- `judgePractice(target, take: TakeRecord, dismissed: ReadonlySet<string>): PracticeVerdict`.
  - `PracticeVerdict = {outcome: 'clean' | 'flagged' | 'other' | 'nothing'; flags: ShownFlag[]; recited: TakeAyah[]}`.
  - The outcomes:
    - `clean`: every expected ayah recited and no shown flags;
    - `flagged`: recited, with flags;
    - `other`: recited something the target does not accept;
    - `nothing`: nothing placed.
- `startPractice(target): Promise<void>` and `stopPractice(): Promise<void>`. The store holds the status and the last verdict.
- Practice takes are logged with purpose `'practice'`, which joins `SessionPurpose`.
- A take with nothing placed ends after 25 s.

- [ ] **Tests:**
  - `all expected ayat and no flags is clean`
  - `a skipped word is flagged`
  - `an ayah the target does not accept is other`
  - `a practice take ends after 25 s with nothing`
  - `a practice take is logged`

### Task 6: Hifz coach

**Files:**
- Create:
  - `store/hifzStore.ts` (persisted, and added to `services/persistedStores.ts`)
  - `services/hifz/strength.ts` (pure)
  - `services/hifz/plan.ts` (pure)
  - `services/hifz/pageProgress.ts` (log to page states)
  - `app/hifz/_layout.tsx`, `app/hifz/index.tsx`, `app/hifz/setup.tsx`, `app/hifz/heatmap.tsx`
  - a home row
- Modify: `config/branding.d.ts` (`HomeRowId` gains `'hifz'`) and `components/RecitersView.tsx`.
- Test: the pure suites.

**Interfaces:**
- Hifz profile: `{memorizedSurahs: number[]; sabaq: {surah; ayah} | null; newAyatPerDay: number; manzilPagesPerDay: number; dailyGoalAyat: number}`.
- `pageStrength(rows: AyahHistoryRow[] by take for the page, now): {level: 'unseen' | 'weak' | 'fair' | 'strong'; dueAt: number; lastAt: number | null}`.
  - A clean take means the page was recited with no shown flags and no peeks. Each clean take on a different day doubles the interval: 1, 2, 4, 8, 16, 30 days.
  - A take with flags or peeks resets the interval to 1 day.
- `todayPlan(profile, pages: Map<number, PageState>, now): {sabaq: ExpectedPassage | null; sabqi: number[]; manzil: number[]}`.
  - sabaq: `newAyatPerDay` from the sabaq point;
  - sabqi: up to 5 pages before the sabaq page that are memorised and recited in the last 7 days;
  - manzil: the memorised pages most overdue, up to `manzilPagesPerDay`.
- Screens:
  - Today: three cards. Each one opens the mushaf at the page with hide on.
  - Setup: memorised surahs, the sabaq point and the amounts.
  - Heatmap: 604 cells grouped by juz (`utils/quranPages.ts`), coloured by level with a legend.

- [ ] **Tests:**
  - `a clean take on a new day doubles the interval`
  - `flags reset the interval`
  - `an empty log plans the first sabaq and no manzil`
  - `manzil picks the most overdue memorised pages`
  - `sabqi takes the recent pages before the sabaq point`

### Task 7: Quizzes

**Files:**
- Create: `services/hifz/quiz.ts` (pure, seeded random), `app/hifz/quiz.tsx`.
- Test: the quiz suite.

**Interfaces:**
- `QuizKind = 'next' | 'continue' | 'whichSurah' | 'bridge'`.
- `makeQuestion(kind, memorized: readonly number[], rand: () => number, data): QuizQuestion`. Each question carries `{prompt: {verseKey; words?: number}; target: PracticeTarget; answer: string}`.
  - `next`: shows ayah N; the target is N+1, within the same surah.
  - `continue`: shows the first 3 words of N; the target is N to N+2.
  - `whichSurah`: shows an ayah; the target is tracking mode, accepting ayah 1 or 2 of its surah.
  - `bridge`: shows the last ayah of a page; the target is the first ayah of the next page.
- The screen asks the question, listens with Task 5 and shows the verdict and the answer, with no red and no sounds.

- [ ] **Tests:**
  - `next never crosses into another surah`
  - `bridge targets the next page's first ayah`
  - `questions come only from memorised surahs`
  - `the same seed gives the same question`

### Task 8: Mutashabihat trainer

**Files:**
- Create: `services/hifz/mutashabihat.ts` (pure), `app/hifz/mutashabihat.tsx`.
- Test: the trainer suite.

**Behaviour:**
- Pairs come from `qulDataService.getSimilarAyahs` for memorised ayat. Score ≥ 0.6, both ayat memorised.
- A drill shows the ayah before A, then the reader recites A, in correction mode with structural rules on.
- A `similar_verse` flag or an `other` verdict means the reader went into the look-alike. The screen shows both ayat with the shared words.
- Per-pair results are kept in the hifz store; pairs missed most recently come first.

- [ ] **Tests:**
  - `pairs are kept only when both ayat are memorised`
  - `missed pairs come back first`

### Task 9: History, streak and goal

**Files:**
- Create: `services/hifz/streak.ts` (pure), `app/hifz/history.tsx`.
- Modify: `RecitationLogDatabase.ts`, adding `takesBetween(from, to)`.
- Test: the streak suite.

**Behaviour:**
- History lists takes (date, range, hidden, flag count); a take opens its summary sheet in read-only mode.
- The streak counts days with a take that recited at least one ayah, with one grace day per 7.
- The daily goal is ayat recited today, against `dailyGoalAyat`. Quiet text only.

- [ ] **Tests:**
  - `consecutive days count`
  - `one missed day in a week is forgiven`
  - `two missed days end the streak`
  - `today's ayat sum only today's takes`

### Task 10: Verify and review

- [ ] Run `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`, `npx jest --watchAll=false --ci`, `npm run i18n:check`, eslint on the changed files, and `npx expo export --platform ios`.
- [ ] Get a fresh whole-branch review, then do one fix pass.
- [ ] Device checklist:
  - hide-mode take with a deliberate skip;
  - start mid-page;
  - retry;
  - each quiz kind;
  - a trainer drill;
  - the coach plan after a few takes.
