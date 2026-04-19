# TV Player Autonomous Polish — Spec & Work Log

**Started:** 2026-04-19 01:52 (user going to sleep)
**Goal:** Ship a Spotify-caliber Apple TV + Android TV experience for Bayaan. Iterate autonomously on runtime issues + polish until user wakes.

## Hard Constraints (from user)

1. **DO NOT merge this branch.** No `git merge`, `git push`, `gh pr create`, or anything that touches the shared remote or integrates this work into other branches. Iterate locally on `feature/tv-platforms` only.
2. Commit frequently on the branch so the user can review commits on wake.
3. If about to do anything with external blast radius (push, deploy, submission), STOP and note in the work log instead.
**Baseline at start:** HomeScreen renders with rails (from `feature/tv-platforms` at commit `46b7ea1e`). All tsc passes. Reciter cards are empty (no artwork), audio untested end-to-end.

## Quality Bar ("Spotify level")

1. **Zero crashes, zero red-boxes, zero infinite-loop warnings.**
2. **Artwork loads** on every reciter card and Now-Playing backdrop.
3. **Full navigation works:** Home → Reciter → Surah → Now Playing and back.
4. **Audio actually plays** a real surah from a real Supabase/CDN URL.
5. **Transport responds:** play/pause, ±15s seek, next/prev walks the queue.
6. **Continue Listening populates** after 5s of playback and shows up on Home.
7. **Focus feels fluid** — scale + ring animates crisply, no jank on D-pad repeat.
8. **Now Playing is cinematic** — large surah title, blurred artwork backdrop, metadata stack.
9. **Quick Play has sensible defaults** even when user has no history.
10. **No empty/placeholder states** (no grey tiles, no "refs: 12" debug strings).

## Priority Backlog

Priority descends. `[ ]` = pending, `[x]` = done, `[!]` = blocked (with note).

- [x] P0: Metro monorepo resolver so shared-code imports work (done, commit `46b7ea1e`)
- [ ] P0: Reciter artwork loads on Home cards
- [ ] P0: Default reciter initializes on first launch (so Quick Play works)
- [ ] P0: Navigate into a reciter → see real surah list → pick one → Now Playing
- [ ] P1: Audio URL resolves and plays a real surah
- [ ] P1: Now Playing shows real title/reciter/artwork + transport functions
- [ ] P1: Continue Listening writes + shows up on re-open
- [ ] P2: Remove "Open debugger" yellow warning / investigate root cause
- [ ] P2: Quick Play surah cards show number + name (currently empty)
- [ ] P2: Transport secondary row (Speed/Sleep/Ambient) actually opens overlays
- [ ] P2: Search returns real results when typing
- [ ] P2: Settings default-reciter picker persists
- [ ] P3: Focus animation polish — stiffness, easing, duration audit
- [ ] P3: Typography pass — ensure 10-foot legibility across screens
- [ ] P3: ArtworkBackdrop blur + gradient look premium

## Work Log (append-only, latest at top)

### 01:52 — Setup
- Wrote this spec. Next: inspect screenshot to identify immediate visible bugs.
