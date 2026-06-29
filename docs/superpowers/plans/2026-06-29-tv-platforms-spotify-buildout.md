# TV Platforms — Spotify-Level Build-Out (Resume) Implementation Plan

> **For agentic workers:** This plan is executed by an ultracode Workflow swarm. Each task is owned by one agent on a **disjoint file set** to avoid edit collisions. Every task ends green (its files tsc-clean + relevant jest passing) and committed. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Finish the standalone `tv-app/` Apple TV / Android TV listening experience to a Spotify-level, brand-consistent, tested bar.

**Architecture:** Standalone Expo + `react-native-tvos` app in `tv-app/`. Zustand stores + MMKV persistence + expo-audio. Focus-engine navigation (side rail + content rows + persistent now-playing bar; full-screen cinematic player). Data via `tvDataService` (bundled fallback JSON now; backend `/v1/` when `EXPO_PUBLIC_BAYAAN_API_URL` set).

**Tech Stack:** TypeScript (strict), React 19, react-native-tvos 0.83, expo ~55, zustand, react-native-mmkv, @shopify/flash-list, react-native-svg, expo-audio, expo-image, jest + @testing-library/react-native.

## Global Constraints

- Work only inside the worktree `.worktrees/tv-platforms`. **No push, no PR, no merge.** Commit-only on `feature/tv-platforms`.
- TypeScript strict. No `any`. No new `as` casts unless unavoidable (prefer type guards / normalizers).
- Quran text (if any) uses Digital Khatt / SkiaVerseText, never system fonts.
- Do not use deprecated `theme.colors.primary` / accent colors in new code.
- Conventional commits, frequent. Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. No em dashes in any output.
- All commands run from `tv-app/` unless stated. Verify: `npx tsc --noEmit` and `npx jest <suite>`.
- Each agent edits ONLY the files listed in its task. If a shared file (theme, store index) needs a change outside your set, note it for the brand/polish phase rather than editing it.

---

## Phase 1 (GATING, sequential) — Task 0: Green-baseline data reconcile

**Files:**
- Modify: `tv-app/services/tvDataService.ts` (cast sites L44, L60, L74, L94)
- Modify: `tv-app/hooks/useReciters.ts` (L9)
- Create: `tv-app/services/normalizeReciter.ts`
- Test: `tv-app/services/normalizeReciter.test.ts`, existing `tv-app/services/tvDataService.test.ts`

**Interfaces — Produces:**
- `normalizeReciters(raw: unknown): Reciter[]` — maps raw fallback/API JSON to fully-formed `Reciter[]` matching `tv-app/types/reciter.ts` (fills `name_arabic: null`, `bio: null`, `slug` from a slugified name, `is_featured: false`, `is_active: true`, `created_at`/`updated_at` from existing or `''`, coerces `mp3quran_read_id`/`qdc_reciter_id` to `string | null`). No `as` cast to `Reciter`.

- [ ] **Step 1:** Write `normalizeReciter.test.ts` asserting a raw fallback record (missing new fields) becomes a valid `Reciter` with `slug` derived, `is_active===true`, `mp3quran_read_id` string-or-null.
- [ ] **Step 2:** Run `npx jest normalizeReciter` — expect FAIL (module missing).
- [ ] **Step 3:** Implement `normalizeReciter.ts` with `normalizeReciters` + a per-rewayah normalizer. Pure functions, explicit return types.
- [ ] **Step 4:** Replace the 5 `fallbackReciters as Reciter[]` sites with `normalizeReciters(fallbackReciters)`. In the API branch, also pass responses through `normalizeReciters`.
- [ ] **Step 5:** Run `npx tsc --noEmit` (clean) and `npx jest` (7/7 suites green).
- [ ] **Step 6:** Commit `fix(tv): reconcile fallback reciter data with evolved Reciter type`.

**Phase 1 exit gate:** `tsc` clean + `jest` 7/7. No Phase 2 agent starts until this commit lands.

---

## Phase 2 (parallel pipeline) — Backlog + stub screens

Each task: one agent, disjoint files, TDD where a store/service is involved, self-verify (tsc on touched files + its jest suite), commit. Read the matching existing component/store before writing; follow its patterns.

### Task A1 [P0]: Default-reciter init on first launch
**Files:** Modify `tv-app/store/tvPlayerStore.ts` or app bootstrap (`tv-app/App.tsx` init path), `tv-app/services/tvDataService.ts` (read featured/first). Test: `tv-app/store/tvPlayerStore.test.ts`.
**Produces:** `getDefaultReciter(reciters: Reciter[]): Reciter | null` (prefers `is_featured`, else first).
- [ ] Failing test: with no persisted history, Quick Play resolves a non-null default reciter.
- [ ] Implement `getDefaultReciter` + wire into first-launch seed. - [ ] tsc + jest green. - [ ] Commit.

### Task A2 [P1]: Continue Listening persistence
**Files:** Modify `tv-app/services/continueListeningStore.ts`, the playback hook that fires on progress (`tv-app/hooks/usePlayer.ts` or audioEngine progress callback), `tv-app/screens/HomeScreen.tsx` (read row). Test: `tv-app/services/continueListeningStore.test.ts`.
**Consumes:** A1's default reciter not required. **Produces:** `recordProgress(entry)` writing after ≥5s; `getContinueListening(): Entry[]` sorted by recency.
- [ ] Failing test: recording progress ≥5s persists and re-reads after store re-init (MMKV). - [ ] Implement write-on-progress + Home surfacing. - [ ] tsc + jest green. - [ ] Commit.

### Task A3 [P2]: Transport secondary-row overlays (Speed / Sleep / Ambient)
**Files:** Modify `tv-app/store/overlayStore.ts`, create `tv-app/components/player/SpeedOverlay.tsx`, `SleepTimerOverlay.tsx`, `AmbientOverlay.tsx`; wire the NowPlaying secondary row to open them. Test: `tv-app/store/overlayStore.test.ts` + ambientStore.
**Consumes:** `ambientStore` (exists). **Produces:** overlay open/close actions + applied effects (rate set on audioEngine, sleep timer schedule, ambient toggle) that persist.
- [ ] Failing tests for overlay state + applied rate/sleep. - [ ] Implement 3 overlays + wiring, focus-navigable. - [ ] tsc + jest green. - [ ] Commit.

### Task A4 [P2]: Real search results
**Files:** Modify `tv-app/screens/SearchScreen.tsx`, create `tv-app/hooks/useSearch.ts`, `tv-app/services/searchRecentsStore.ts` (exists — extend). Test: `tv-app/hooks/useSearch.test.ts`.
**Produces:** `useSearch(query): {reciters, surahs, loading}` debounced over reciter names + surah names/numbers.
- [ ] Failing test: query "fati" returns Al-Fatihah; reciter substring matches. - [ ] Implement debounced search + render focusable results + recents. - [ ] tsc + jest green. - [ ] Commit.

### Task A5 [P2]: Settings default-reciter picker persists
**Files:** Modify `tv-app/screens/SettingsScreen.tsx`, a settings store (create `tv-app/store/settingsStore.ts` if none). Test: `tv-app/store/settingsStore.test.ts`.
**Consumes:** A1 `getDefaultReciter`. **Produces:** `settingsStore.defaultReciterId` persisted via MMKV; A1 seed respects it.
- [ ] Failing test: setting default reciter persists and overrides featured default. - [ ] Implement picker + persistence + integration with A1 seed. - [ ] tsc + jest green. - [ ] Commit.

### Task B1: CatalogGridScreen (stub → full)
**Files:** Modify `tv-app/screens/CatalogGridScreen.tsx`; reuse existing `tv-app/components` cards (ReciterCard/FocusableCard). No new store.
- [ ] Full focusable card grid of reciters with category rows, focus ring, artwork via expo-image + initials fallback. - [ ] tsc green; render test if a `__tests__` pattern exists. - [ ] Commit.

### Task B2: NowPlayingScreen (stub → full)
**Files:** Modify `tv-app/screens/NowPlayingScreen.tsx`; reuse existing player components. Coordinate with A3 (overlays) via `overlayStore` interface only.
- [ ] Cinematic full-screen player: large artwork card, title/reciter/rewayah stack, seek bar (±15s via left/right), transport row, secondary row that opens A3 overlays. - [ ] tsc green. - [ ] Commit.

### Task B3: Round out ReciterDetail / Collection / Onboarding
**Files:** Modify `tv-app/screens/ReciterDetailScreen.tsx`, `CollectionScreen.tsx`, `OnboardingScreen.tsx` (already substantial — fill gaps, no empty states, ensure focus order).
- [ ] Verify each renders real data, no placeholder/grey tiles, focus order sane. Fix gaps only. - [ ] tsc green. - [ ] Commit per screen.

**Phase 2 exit gate:** all Phase 2 commits land; `tsc --noEmit` clean; `jest` fully green.

---

## Phase 3 (parallel) — Brand + polish (runs after Phase 2; theme files single-owned)

### Task C1: Brand alignment
**Files:** Modify `tv-app/theme/colors.ts`, `spacing.ts`, `typography.ts`; map mobile theme tokens + Digital Khatt typography + artwork treatment. Single agent owns `theme/`.
- [ ] Align tokens to mobile brand (no deprecated primary/accent). - [ ] tsc green. - [ ] Commit.

### Task C2: Focus animation audit
**Files:** Modify the shared focusable card/pressable component(s) in `tv-app/components/` (single agent owns the focus primitive). - [ ] Stiffness/easing/duration audit, no D-pad-repeat jank. - [ ] tsc green. - [ ] Commit.

### Task C3: 10-foot typography pass
**Files:** Per-screen text-size pass (coordinate with C1 token owner; consume tokens, do not redefine). - [ ] Legibility at distance across screens. - [ ] tsc green. - [ ] Commit.

### Task C4: Cinematic Now Playing backdrop
**Files:** Create `tv-app/components/player/ArtworkBackdrop.tsx`; consume in NowPlaying. - [ ] Blurred artwork + gradient. - [ ] tsc green. - [ ] Commit.

---

## Phase 4 — Multi-platform verification

### Task D1 [MUST PASS]: Apple TV (tvOS)
- [ ] `cd tv-app && EXPO_TV=1 npx expo prebuild --clean` then build/boot the Apple TV 4K simulator (argent boot-device / `npm run tvos`).
- [ ] Walk the quality bar: launch (no red box), Home rails + artwork, Home→Reciter→Surah→NowPlaying, real audio from CDN plays, transport (play/pause, ±15s, next/prev), Continue Listening populates + persists across relaunch, A3 overlays open + apply, search returns results. Capture screenshots per screen.
- [ ] Record results in the work log. Any failure spawns a targeted fix task.

### Task D2 [BEST EFFORT]: Android TV
- [ ] Best-effort `EXPO_TV=1` Android build + boot an Android TV emulator; focus-nav + playback smoke. Document any native build blocker precisely; do not rabbit-hole.

### Task D3 [BEST EFFORT]: Fire TV (Vega)
- [ ] Best-effort build + Vega VVD boot; tv-remote nav + playback smoke. Document blockers.

---

## Phase 5 (adversarial) — Completeness critic

- [ ] One agent re-checks the 10-point Spotify bar (spec "Quality bar") against the built app + D1 evidence. For each unmet criterion, emit a precise fix task. Loop Phase 2-style fixes until the bar is met or the token budget bound is reached.
- [ ] Final: `tsc --noEmit` clean, `jest` fully green, tvOS build verified. Summarize built vs blocked.

## Self-Review (author)

- **Spec coverage:** Task 0 ↔ baseline; A1-A5 ↔ April backlog P0-P2; B1-B3 ↔ stubs + screens; C1-C4 ↔ P3 polish + brand; D1-D3 ↔ test targets; Phase 5 ↔ quality bar. Covered.
- **Disjoint ownership:** theme/ (C1), focus primitive (C2), overlayStore (A3) are single-owned; B2/A3 share only via `overlayStore` interface. No two Phase-2 tasks write the same file.
- **No placeholders:** Task 0 fully specified; feature tasks reference exact files + existing patterns the agent reads. Acceptance criteria concrete per task.
