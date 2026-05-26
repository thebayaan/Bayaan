# RFC-006: Audio characterization tests — Group B (`AudioCoordinator`)

| Status | Date | Author | Predecessors |
|---|---|---|---|
| Proposed | 2026-05-07 | omar-zarka | RFC-005 (Group A), ADR-0001 |

---

## Summary

Lock in the current behavior of `services/audio/AudioCoordinator.ts` — the singleton that mediates mutual exclusion between the main player and the mushaf player — with 4 Jest tests (B1–B4) from the [Characterization Test Plan](https://github.com/omar-zarka/bayaan-platform/blob/main/planning/Characterization-Test-Plan.md). Tests-only — no production code touched.

This is PR #2 of the audio extraction's characterization sweep. RFC-005 locked Group A (`ExpoAudioService` state machine, 9 tests). Group B locks the AudioCoordinator's lazy-`require()` mutual-exclusion behavior so the upcoming RFC-008 refactor (replace lazy-require with `CoordinatorHooks` injection per ADR-0001 §PR-3) can prove parity.

## What's in this PR

| ID | Behavior locked in |
|---|---|
| B1 | `mushafWillPlay()` pauses the main player **only** when `activeSource === 'main'` AND main is in `playing` or `buffering` state (state guard) |
| B2 | `mainWillPlay()` calls `mushafAudioService.pause()` AND `useMushafPlayerStore.getState().setPlaybackState('paused')` via lazy-`require()`, when `activeSource === 'mushaf'` |
| B3 | `sourceDidStop('mushaf')` followed by `mainWillPlay()` triggers no pause — clean handoff, no recursion |
| B4 | `mainWillPlay()` lazy-`require()` resolves at function-call time without throwing (baseline before RFC-008 deletes the lazy-require) |

## Note on the Plan's prose vs. actual code

The Plan's B1 prose said "`mainWillPlay()` calls `usePlayerStore.getState().pause()`", but the real code path for that call is `mushafWillPlay()` (mushaf is starting → pause main). Tests lock in actual behavior; the Plan will be updated to match.

## Test design

- **`AudioCoordinator` is a singleton with no public reset.** Each test calls a `freshCoordinator()` helper that uses `jest.isolateModules()` to import a fresh module — keeps tests independent without adding a `__resetForTests` to production code (which would violate Tidy First for a tests-only PR).
- **Three modules mocked at the top level:** `@/services/player/store/playerStore` (eager import in AudioCoordinator), `@/store/mushafPlayerStore` (lazy require inside `mainWillPlay`), `../MushafAudioService` (lazy require inside `mainWillPlay`). `jest.mock` is hoisted, so the lazy-require sites pick up the mock.
- **Same style as RFC-005's `ExpoAudioService.test.ts`** — module-level mocks, factory pattern for fakes, in-test assertions on `jest.fn()` mock call history.

## Scope discipline (Tidy First)

- No production code touched — `git diff develop --stat` shows only `docs/rfcs/` and `services/audio/__tests__/`.
- No new dependencies.
- Singleton `reset()` not added — would be production-code change.

## Sequence forward

After this merges, the audio extraction series proceeds per ADR-0001:
- **RFC-008** (RFC-007 skipped): refactor `AudioCoordinator` onto `CoordinatorHooks`, deleting the lazy-`require()` block. Group B tests are the safety net.
- RFC-009: refactor `ExpoAudioProvider` onto `PlayerController` (preceded by Group C/D characterization tests).
- RFC-010: refactor `LockScreenService` onto `LockScreenMetadataSource` (preceded by Group H tests).

## Test plan

- [x] `npm run test:ci` — 86 + 4 = 90 passing
- [x] `npx tsc --noEmit -p .` — clean
- [x] No production code touched

## References

- ADR-0001 — `bayaan-platform/adr/0001-audio-extraction-seam.md`
- Characterization Test Plan — `bayaan-platform/planning/Characterization-Test-Plan.md` §Group B
- RFC-005 (Group A) — `docs/rfcs/005-audio-characterization-tests.md`
