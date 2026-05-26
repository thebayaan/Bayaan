# RFC-005 — Audio characterization tests

| Status | Open |
| --- | --- |
| Author | omar-zarka |
| Created | 2026-05-06 |
| Series | Audio extraction (ADR-0001) |

## Summary

Land the test harness and Group A characterization tests for the audio services. **No production code changes.** This is "PR #1" of the audio extraction series in ADR-0001 — characterization tests come before any refactor so subsequent refactor PRs can prove behavior parity with `npm test`.

This PR ships:
- `docs/rfcs/005-audio-characterization-tests.md` (this file).
- `services/audio/__tests__/ExpoAudioService.test.ts` — 9 tests covering Group A from the bayaan-platform [Characterization Test Plan](https://github.com/omar-zarka/bayaan-platform/blob/main/planning/Characterization-Test-Plan.md), exercising `ExpoAudioService`'s state machine: initialization idempotence, player set/replace, `loadTrack` happy path + error, play/pause/seek transitions, rate changes, listener subscribe/unsubscribe.

## Why characterization tests now

The audio extraction (ADR-0001) plans 8 PRs that culminate in `services/audio/` moving into `@bayaan/audio`. PRs 2–8 mutate `AudioCoordinator`, `ExpoAudioProvider`, and `LockScreenService` to consume the `PlayerController` port that landed in [#236](https://github.com/thebayaan/Bayaan/pull/236). Without behavior-locking tests, every refactor reviewer is on the hook for "does this preserve subtle behavior?" — which neither scales nor sleeps well at night.

Per ADR-0001 §"Sequencing": **PR #1 = characterization tests. PRs #2–8 = refactors that keep the tests green.** Bayaan currently has zero tests on `services/audio/`, `services/mushaf/`, `services/player/`. This PR seeds that test surface for audio specifically.

## A note on RFC numbering

PR #236 (RFC-004) said "the actual refactor of `AudioCoordinator`, `ExpoAudioProvider`, and `LockScreenService` to consume these ports is RFC-005." Per ADR-0001, characterization tests must precede that refactor. Re-numbering: **RFC-005 = characterization tests (this PR), RFC-006 = the AudioCoordinator/ExpoAudioProvider/LockScreenService refactor RFC-004's body called RFC-005.** Same content, sequencing preserved, one extra precondition PR.

## What's in scope (this PR)

**Group A — `ExpoAudioService` state machine** (9 tests). All tests use a local `FakeAudioPlayer` that mirrors the slice of `expo-audio`'s `AudioPlayer` surface that `ExpoAudioService.ts` actually consumes. The fake stays per-test for now; if subsequent groups (B–I) re-use it, it gets promoted into `@bayaan/test-utils`.

| ID | Behavior |
| --- | --- |
| A1 | `initialize()` is idempotent — second call is a no-op. |
| A2 | `setPlayer()` accepts the hook output once; second call replaces. |
| A3 | `loadTrack(url)` happy path → state machine `idle → loading → ready`. |
| A4 | `loadTrack(url)` error path → state `error`, `lastError` set, listeners notified. |
| A5 | `play()` from `ready` → `playing`; `pause()` from `playing` → `paused`. |
| A6 | `seekTo(seconds)` calls `player.seekTo` and does NOT change playback state. |
| A7 | `setRate(rate)` clamps to [0.5, 2.0] and calls `player.setPlaybackRate(rate, 'high')`. |
| A8 | State listeners receive correct state objects on each transition. |
| A9 | Listener unsubscribe works — no further notifications after unsubscribe. |

## What's out of scope (queued for follow-up PRs in this series)

- **Group B** — `AudioCoordinator` mutual exclusion (4 tests). Requires Zustand store mocking + lazy-`require()` probing. Separate PR to keep mock complexity isolated.
- **Group C** — `ExpoAudioProvider` lifecycle (5 tests). Component tests requiring `@testing-library/react-native` (not currently in deps). Adds the dep + the tests in one PR.
- **Group D** — `handleTrackEnd` repeat-mode branching (6 tests). The simulated-review surprise flagged in the original audit; high-value, depends on Group C harness.
- **Groups E–I** — Analytics call points, `MushafAudioService`, `AmbientAudioService`, `LockScreenService`, integration. Sequenced after the refactor sub-PRs they unblock.

Each follow-up PR cites this RFC and adds tests in `services/audio/__tests__/`. The full inventory and reasoning live in [Characterization-Test-Plan.md](https://github.com/omar-zarka/bayaan-platform/blob/main/planning/Characterization-Test-Plan.md).

## Test design notes

- **Singleton handling.** `ExpoAudioService` exports both the singleton instance (`expoAudioService`) and the class (`ExpoAudioService`). Tests use the class export with `getInstance()` plus `reset()` between cases — same pattern as the analytics tests.
- **`expo-audio` mock.** Only `setAudioModeAsync` is mocked at the module level (it's the side-effecting native call in `initialize()`); everything else flows through the injected `FakeAudioPlayer`.
- **`__DEV__` guard.** Tests run with `__DEV__ = true` so the dev-only logs run; this catches accidental crashes inside `console.log` interpolations.
- **No fake timers** for Group A (all transitions are synchronous or single-await). Group C will need fake timers for the throttled progress persistence test.

## Tidy First framing

- This PR is **tests only**. Zero production code touched. No refactor, no behavior change.
- The fake-player approach is intentionally per-test — moving it to `@bayaan/test-utils` is a future Tidy step once a second test file needs it.

## Acceptance criteria

- [ ] All 9 tests pass on first run.
- [ ] Test suite adds ≥9 to the project's test count visible in CI.
- [ ] `npm run test:ci` is green.
- [ ] No new lint or TypeScript errors.

## References

- ADR-0001: audio extraction seam (`bayaan-platform/adr/0001-audio-extraction-seam.md`)
- Characterization Test Plan: full inventory of Groups A–I
- PR #236: `PlayerController` port + `ExpoAudioPlayerControllerAdapter` scaffold (RFC-004)
