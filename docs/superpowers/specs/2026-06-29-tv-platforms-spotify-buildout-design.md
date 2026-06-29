# TV Platforms — Spotify-Level Build-Out (Resume) — Design

**Date:** 2026-06-29
**Branch:** `feature/tv-platforms` (worktree `.worktrees/tv-platforms`)
**Status:** Approved design, pre-implementation
**Builds on:** `docs/features/tv-app.md`, `docs/superpowers/specs/2026-04-18-tv-player-design.md`, `docs/superpowers/specs/2026-04-19-tv-polish-autonomous.md`

## Goal

Resume and finish the April "Spotify-caliber" Apple TV / Android TV build for Bayaan's
`tv-app/` (a standalone Expo + `react-native-tvos` app), now that the branch is current with
`develop` (SDK 56). Deliver a complete, polished, tested **listening experience** on a 10-foot UI.

## Locked decisions (user, 2026-06-29)

1. **Scope:** Listening experience only — browse reciters/surahs, full-screen player, search,
   collection, settings, ambient. **No** Mushaf / translations / tafseer / adhkar this push.
2. **Visual target:** Reuse Bayaan brand tokens (theme colors, Digital Khatt typography, artwork
   treatment, iconography) laid out as a native 10-foot Spotify-style TV UI (rails, focus rings,
   cinematic Now Playing). Not a literal mobile mirror.
3. **Test targets:** Apple TV (tvOS) is the **verified-first, must-pass** target. Android TV and
   Fire TV (Vega) are **best-effort** verification passes; a native build wall is documented as a
   blocker, not rabbit-holed.
4. **End state:** Commit-only on `feature/tv-platforms` in the worktree. **No push, no PR, no
   merge.** User reviews commits.

## Baseline findings (verified 2026-06-29)

- Worktree `.worktrees/tv-platforms` is clean, was on branch tip `74b132b`.
- Merged `origin/develop` (tip `86c6718`, the SDK 56 / PR #294 merge) into the branch:
  **zero file conflicts** (the 90 branch-changed files are all under `tv-app/` + `docs/`, which
  develop never touched). Branch is now 0 behind develop.
- `tv-app` install present (node_modules ~4 GB).
- **Single drift issue:** `develop`'s `Reciter` type gained required fields
  (`name_arabic, bio, slug, is_featured, is_active, created_at, updated_at`) and the Rewayah
  `mp3quran_read_id`/`qdc_reciter_id` types changed (`string | null`). `tv-app`'s
  `reciters-fallback.json` predates this, so 5 `as Reciter[]` cast sites fail:
  - `tv-app/services/tvDataService.ts` (lines 44, 60, 74, 94)
  - `tv-app/hooks/useReciters.ts` (line 9)
- Jest: **6/7 suites pass, 34/34 tests pass.** The one failing suite (`tvDataService.test.ts`)
  fails only on the same cast type errors (ts-jest type-check), not on assertions.

**Conclusion:** the entire red baseline collapses to one data-layer reconcile. Fixing it yields a
fully green tree. This is the gating Task 0; no parallel work starts until tsc + jest are green.

## Architecture (unchanged from April)

`tv-app/` standalone app: `screens/` (8), `components/` (29), `store/` + `services/` (zustand +
MMKV + expo-audio), `hooks/`, `theme/`, `types/`. Focus-driven navigation via `react-native-tvos`
Pressable focus engine. Side-rail + content rows + persistent now-playing bar; full-screen
cinematic player. Data via `tvDataService` (fallback JSON now, backend `/v1/` when configured).

## Work breakdown

### Task 0 — Green-baseline data reconcile (GATING, sequential)
Reconcile `reciters-fallback.json` ⇄ `Reciter` type. Add a typed normalizer mapping raw fallback
data → `Reciter[]` (fill `slug` from name, `is_active: true`, null defaults, coerce id types) so
no `as` cast is needed and runtime data is well-formed. Update `tvDataService` + `useReciters`.
**Exit:** `tsc --noEmit` clean, `jest` 7/7 green. Commit.

### Task group A — Finish the April backlog (parallel, disjoint files)
- **A1 [P0]** Default-reciter init on first launch so Quick Play works with no history.
- **A2 [P1]** Continue Listening persistence: write on ≥5s playback, surface on Home re-open.
- **A3 [P2]** Transport secondary row overlays: Speed, Sleep timer, Ambient — open + apply + persist.
- **A4 [P2]** Search returns real results when typing (debounced query over reciters/surahs).
- **A5 [P2]** Settings default-reciter picker persists.

### Task group B — Complete stub screens (parallel, disjoint files)
- **B1** `CatalogGridScreen` (52-line stub) → full focusable card grid, rows by category.
- **B2** `NowPlayingScreen` (52-line stub) → full cinematic player (verify vs existing components).
- **B3** Round out `ReciterDetailScreen`, `CollectionScreen`, `OnboardingScreen` (already substantial).

### Task group C — Brand + polish (after A/B land)
- **C1** Brand alignment: pull mobile theme tokens, Digital Khatt typography, artwork treatment into
  `tv-app/theme`. Respect memory rules (Digital Khatt for Quran text; no deprecated `primaryColor`).
- **C2** Focus animation audit (stiffness/easing/duration; no D-pad-repeat jank).
- **C3** 10-foot typography pass across all screens.
- **C4** Cinematic Now Playing: blurred artwork backdrop + gradient.

### Task group D — Multi-platform verification
- **D1** Apple TV sim: boot, build, walk every quality-bar criterion (focus nav, audio, transport,
  Continue Listening, overlays, search). Drive focus via simulator remote keystrokes + screenshots.
- **D2** Android TV emulator: best-effort build + focus/playback smoke. Document blockers.
- **D3** Fire TV (Vega): best-effort build + remote-nav smoke. Document blockers.

## Swarm structure (execution)

1. **Phase 0 (done, by hand):** worktree + merge develop + baseline characterization.
2. **Phase 1 (sequential, 1 agent):** Task 0 green-baseline reconcile → verify tsc+jest green.
3. **Phase 2 (parallel pipeline):** Task groups A + B, one agent per item on disjoint files; each
   agent self-verifies (tsc on its files + jest + render reasoning) and commits.
4. **Phase 3 (parallel):** Task group C brand/polish.
5. **Phase 4 (sequential/parallel):** Task group D platform verification (tvOS must-pass first).
6. **Phase 5 (adversarial):** completeness critic re-checks the 10-point Spotify bar; failures spawn
   targeted fix-ups; loop until clean or budget bound.

Frequent commits throughout. All work confined to the worktree.

## Quality bar (from April `tv-polish-autonomous.md`)

Zero crashes/red-boxes; artwork on every card + NowPlaying backdrop; full Home→Reciter→Surah→
NowPlaying nav; real audio plays from CDN; transport (play/pause, ±15s, next/prev) responds;
Continue Listening populates and persists; fluid focus (scale + ring, no jank); cinematic Now
Playing; sensible Quick Play defaults; no empty/placeholder states. **Plus:** tsc clean, jest green,
tvOS build verified end-to-end.

## Guardrails & risks

- **Guardrails:** commit-only; no push/PR/merge; each agent verifies its own output; final
  adversarial pass before "done."
- **Risk — Android TV / Fire TV native build:** `react-native-tvos` Android/Fire builds may not
  compile without native work. Mitigation: tvOS verified-first; Android/Fire blockers documented,
  not chased.
- **Risk — `react-native-tvos` 0.83 vs develop's RN 0.85 (SDK 56):** `tv-app` keeps its own pinned
  toolchain (independent node_modules); shared imports are source-level TS. Task 0 + tvOS build
  confirm no runtime drift. Upgrading `tv-app` to a 0.85 tvOS build is out of scope unless the
  build forces it (then: document + ask).
- **Risk — parallel edit collisions:** mitigated by assigning each agent disjoint files; brand/polish
  (group C) runs after A/B land to avoid theme-file contention.

## Out of scope

Mushaf on TV, translations/tafseer, adhkar/tasbeeh, App Store/Play Store submission, CI config,
pushing or PR-ing the branch.
