# RFC-004 — Audio seam: `PlayerController` port + adapter scaffold

| Field | Value |
| --- | --- |
| Status | Proposed |
| Author | Omar Zarka (Qariah) |
| Date | 2026-05-05 |
| Depends on | [RFC-001](./001-workspace-and-rfc-convention.md), [RFC-002](./002-bayaan-types-package.md), [RFC-003](./003-ci-gates-and-test-utils.md) |
| Drives | RFC-005 (audio services refactor + extraction) |

## TL;DR

Ship the `@bayaan/audio` workspace package with **ports only** — the five
interfaces from ADR-0001 plus a stub `ExpoAudioPlayerControllerAdapter`.
**No app code changes.** No imports from this package by `services/audio/*`.
The diff is exclusively under `packages/bayaan-audio/` and a small addition
to `@bayaan/test-utils` (`MockAudioPlayer` fixture).

This is ADR-0001's PR 2 ("port interfaces + no-op defaults"). The actual
refactor of `AudioCoordinator`, `ExpoAudioProvider`, and `LockScreenService`
to consume these ports is RFC-005, deliberately split off so this PR stays
mergeable on a single bounded review.

## What this PR adds

### `packages/bayaan-audio/`

- `src/ports.ts` — the five interfaces from [ADR-0001](https://github.com/omar-zarka/bayaan-platform/blob/main/adr/0001-audio-extraction-seam.md):
  - `PlayerController<TTrack>` — state / progress / persistence bridge
  - `CoordinatorHooks` — replaces the lazy-`require()` smell in `AudioCoordinator`
  - `PlayerEventSink<TTrack>` — analytics hook (with `NullPlayerEventSink` no-op)
  - `TimestampProvider` — ayah-timing fetch
  - `LockScreenMetadataSource` — subscription source for OS lock-screen metadata
  - `BayaanAudioConfig<TTrack>` — the full consumer config the future provider takes at init
- `src/adapters/expo-audio-player-controller.ts` — stub class implementing
  `PlayerController` end-to-end (no-op bodies). Demonstrates the seam compiles
  and is implementable as a class. Real wiring lands in RFC-005.
- `src/__tests__/ports.test.ts` — port shape contract: every method exists,
  every state is accepted without throwing, the `NullPlayerEventSink` is a
  full no-op, the stub adapter survives the realistic call ordering during
  playback.
- `package.json`, `tsconfig.json`, `jest.config.js`, `README.md` — same
  shape as `@bayaan/types` and `@bayaan/test-utils`. No build step;
  `main` and `types` both point at `src/index.ts`.

### `packages/bayaan-test-utils/`

- `src/audio/mock-audio-player.ts` — `MockAudioPlayer` test fixture mirroring
  `expo-audio`'s `AudioPlayer` surface (play / pause / seekTo / replace /
  setRate / setVolume / addListener) plus deterministic `simulate*` drivers.
- `src/__tests__/mock-audio-player.test.ts` — 6 tests covering initial state,
  listener subscription / removal, the natural-end (`didJustFinish`) transition,
  source replacement, and jest-mock surface.
- `src/index.ts` — re-export `MockAudioPlayer` and its types.

## What this PR does not do

- **No `services/audio/*` changes.** Provider, coordinator, services all untouched.
- **No `playerStore` decoupling.** Bidirectional coupling stays; RFC-005 fixes it.
- **No `expo-audio` import in the package.** `services/audio/*` keeps owning
  the engine until RFC-005 PR 6 (the move).
- **No characterization tests for current audio behavior.** ADR-0001's PR 1
  covers those — they need real-device fidelity for some flows (lock-screen
  metadata sync, AppState transitions, interruption rate-reset) and are best
  authored against the running app, not a new package. They land alongside
  RFC-005's first refactor PR.
- **No Qariah adoption.** Qariah's `PlayerController` implementation lives
  in the Qariah repo and lands when RFC-005 ships.

## Why ports-only as its own PR

Three reasons to land the seam before any refactor that consumes it:

1. **Surface review can happen now.** The five interfaces are the contract
   that drives every subsequent PR in this series (5a–5g per ADR-0001's
   sequence, possibly more). Catching shape problems at the type-only stage
   is cheap; catching them mid-refactor is expensive.
2. **The diff is bounded and reviewable in isolation.** If a later RFC is
   rejected, this package keeps compiling and harms nothing. Worst case: a
   small package sits in `packages/` alongside `@bayaan/types` and
   `@bayaan/test-utils`, no app code depends on it.
3. **Tidy First.** Mixing the seam definition with the first refactor would
   bundle "what shape" with "how to migrate to it" in one diff. Each PR
   should answer one question.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Port too narrow → RFC-005 has to widen mid-refactor. | Hew exactly to the interface drafted and reviewed in `bayaan-platform/scratch/ports.ts`. The `.contract.ts` file there has been the working reference for ~2 weeks. |
| Port too wide → adapter spans too many call sites in RFC-005. | Every port method maps to a single existing call site in `services/audio/*`. The mapping is documented in ADR-0001 §Decision and verified by the consumer-side stub being a class (not a free-function bag). |
| Stub adapter sets a bad precedent for "scaffolding without behavior". | The stub is class-based, every method has a `// RFC-005: ...` comment naming the migration that fills it in. The `ports.test.ts` exercises the stub through realistic call ordering so the contract is real, not paper. |
| `MockAudioPlayer` drifts from `expo-audio`'s actual `AudioPlayer` surface. | The shape is taken from current Bayaan service code that wraps `useAudioPlayer`. Drift becomes visible the moment a real service test is written against it (RFC-005). Acceptable risk given the alternative is hand-mocking the same surface in every test file. |

## Where the adapter lives

ADR-0001 says "package from day one" so the dependency direction is
established before any consumer adopts. This PR follows that: the stub
adapter ships in `packages/bayaan-audio/src/adapters/`, not in
`services/audio/`. **Open question for review:** Osman, does that match
your preference, or would you rather the stub stay in `services/` until
RFC-005 fills it in? Easy to redirect.

## Verification plan

| Check | What it shows |
| --- | --- |
| `npm install` | Workspace symlinks for `@bayaan/audio` and the updated `@bayaan/test-utils` register cleanly. |
| `npx jest packages/bayaan-audio` | Port + adapter contract suite passes (~13 tests). |
| `npx jest packages/bayaan-test-utils` | Existing matchers + new `MockAudioPlayer` tests pass (~15 tests total). |
| `npm run test:ci` | Full suite still green; no regressions in app-level tests. |
| `npx tsc --noEmit` | Zero new errors vs `develop` baseline. |
| Local iOS build (`npm run ios`) | App builds and launches with the new packages present in the workspace. No native footprint added. |
| Local Android build (`npm run android`) | Same — app builds and launches on emulator. |

A separate build-verification comment will follow with iOS + Android logs
and timing, posted at PR-open time per the lesson from RFC-003's retro.

## Open questions

1. **Adapter location:** in-package from day one, or stage in `services/`
   until RFC-005? See "Where the adapter lives" above.
2. **Should `BayaanAudioConfig.eventSink` be required-explicit or
   optional-with-default?** This RFC ships it as required (forces the
   consumer to acknowledge the analytics decision; pass `NullPlayerEventSink`
   to opt out). Easy to flip.
3. **Schema version field on `BayaanAudioConfig`?** Bayaan-Architecture
   §8.3 M10 flagged versioning as a candidate for the diff JSON; same idea
   could apply here. Probably premature — flagging only.

## Risk if this lands and RFC-005 is rejected

The package contains no app-side imports. If RFC-005 never ships, the only
consequence is a small workspace package with port interfaces nobody uses,
sitting alongside `@bayaan/types` and `@bayaan/test-utils`. No code outside
the package depends on it after this PR.

---

Happy to iterate on the port shapes, the stub adapter location, or the
required-vs-optional `eventSink` decision.
