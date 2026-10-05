# RFC-002: `@bayaan/types` shared primitives package

| Field    | Value      |
| -------- | ---------- |
| Status   | Proposed   |
| Date     | 2026-05-01 |
| Author   | Omar Zarka |

## Summary

Add the first package to the workspace established by [RFC-001](001-workspace-and-rfc-convention.md): `@bayaan/types`, a small TypeScript-only library that holds shared primitives (`BaseTrack`, `PlaybackState`, `AyahTimestamp`, `LockScreenMetadata`, `AmbientSoundType`) and the `BayaanError` class hierarchy with a stable `ErrorCode` enum. Includes a contract test suite for the error machinery. Does not move or rename any existing app-side type today.

## Motivation

When future RFCs propose extracting feature packages (e.g., audio engine, mushaf rendering), each one will need to express types that cross package boundaries — `BaseTrack` for track payloads, `AyahTimestamp` for follow-along data, `LockScreenMetadata` for OS integration, error types for callback APIs. If each feature package re-defines those primitives locally, identical-shape types diverge silently and consumers get instanceof failures across package boundaries.

A small shared types package solves this once. The constraint is keeping it small — the trap to avoid is `@bayaan/types` becoming a grab-bag every package depends on, where every schema change ripples through the whole platform. Three rules of thumb to keep it bounded (see [Decision §Scope rules](#scope-rules) below):

1. Only types with no clear single-owning concern.
2. Only types reachable from 3+ feature packages, or atomic primitives / enums.
3. Promotion from a feature package to `@bayaan/types` is a deliberate breaking-change event.

The error machinery deserves special attention. Today the codebase throws plain `Error` with message strings; consumers (analytics, UI banners, retry logic) parse messages to decide behavior, which is fragile. A `BayaanError` base class with a stable `code` enum gives every consumer a reliable branch point. Subclasses (`BayaanAudioError`, etc.) preserve `instanceof` matching across the platform. This RFC introduces the machinery without rewriting any existing throw sites; a future RFC will migrate them.

## Decision

### Package layout

```
packages/bayaan-types/
├── package.json          # name: @bayaan/types, version: 0.1.0, AGPL-3.0-or-later, "private": true
├── tsconfig.json         # extends expo/tsconfig.base
├── jest.config.js        # preset: jest-expo, testMatch: src/**/__tests__/**/*.test.ts
├── README.md
└── src/
    ├── index.ts          # re-exports
    ├── playback.ts       # BaseTrack, PlaybackState
    ├── mushaf.ts         # AyahTimestamp
    ├── lock-screen.ts    # LockScreenMetadata
    ├── ambient.ts        # AmbientSoundType
    ├── errors.ts         # BayaanError, subclasses, ErrorCode
    └── __tests__/
        └── errors.test.ts
```

The package's `main` and `types` both point at `src/index.ts`. No build step. Metro and `tsc` both consume `.ts` directly via the workspace symlink at `node_modules/@bayaan/types`.

### What the package contains

**Playback primitives** (`src/playback.ts`):

```ts
export type PlaybackState =
  | 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

export interface BaseTrack {
  id: string;
  url: string;
  title: string;
  artist?: string;
  artworkUrl?: string;
  durationMs?: number;
}
```

**Mushaf** (`src/mushaf.ts`): `AyahTimestamp` (`{ ayahNumber, timestampFromMs, timestampToMs }`).

**Lock-screen** (`src/lock-screen.ts`): `LockScreenMetadata` (`{ title, artist, artworkUrl?, durationMs, positionMs, isPlaying }`).

**Ambient** (`src/ambient.ts`): `AmbientSoundType` union of seven sound types.

**Errors** (`src/errors.ts`):

```ts
export class BayaanError extends Error {
  readonly code: ErrorCode;
  readonly recoverable: boolean;
  readonly context: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
  // ...
}

export class BayaanAudioError extends BayaanError { /* name = 'BayaanAudioError' */ }
export class BayaanMushafError extends BayaanError { /* name = 'BayaanMushafError' */ }
export class BayaanLifecycleError extends BayaanError { /* name = 'BayaanLifecycleError' */ }
export class BayaanNetworkError extends BayaanError { /* name = 'BayaanNetworkError' */ }

export type ErrorCode =
  | 'LIFECYCLE_AFTER_DESTROY' | 'LIFECYCLE_BEFORE_INIT' | 'PRECONDITION_VIOLATED'
  | 'AUDIO_LOAD_FAILED' | 'AUDIO_SEEK_FAILED' | /* ... 17 codes total ... */;
```

Twenty starting `ErrorCode` values across audio, mushaf, lifecycle, and network domains. Adding a code is a minor-version bump; renaming or removing is a major-version bump.

### What the package does NOT contain

- **`RewayahId`** stays at [`services/rewayah/RewayahIdentity.ts`](../../services/rewayah/RewayahIdentity.ts) per its file-header directive ("All other rewayah-aware code imports from here. Do not define a RewayahId literal […] anywhere else."). A future RFC may propose moving its canonical home, but only with explicit alignment.
- **Port interfaces** (`PlayerController`, `CoordinatorHooks`, etc.) — owned by future feature packages (e.g., `@bayaan/audio`), not the types package.
- **Concrete `Track` shape with metadata** — consumer-defined; consumers extend `BaseTrack` with their own meta type.
- **Logger / event-bus / runtime utility code** — types-only package by design.

### Scope rules

Future contributors deciding where a new type belongs:

1. Used by **0–1 feature packages** → stays in the feature package; export from there.
2. Used by **2+ feature packages**, with a clear owning concept → stays in the most-related feature package; others import from there.
3. Used by **3+ feature packages**, or is a primitive/enum with no owner → promote to `@bayaan/types` (breaking change; major version of every dependent).

### Smoke test

The contract test suite at `packages/bayaan-types/src/__tests__/errors.test.ts` is the proof-of-life. Twelve tests covering construction, frozen context, defensive copying, instanceof, name property, stack-trace preservation, and per-subclass discrimination.

Running `npx jest packages/bayaan-types` (or eventually `npm test --workspace=@bayaan/types` once npm workspaces test integration is wired up) executes the suite. Passing means: workspace resolution works, the package compiles, classes behave as documented, future feature packages can throw / catch them with confidence.

This RFC deliberately does NOT add app-side imports of `@bayaan/types` symbols. That work happens in subsequent RFCs as each feature is migrated. Decoupling "package exists" from "package consumed" keeps this PR's diff bounded and respects the Tidy First constraint.

### Versioning

Starts at `0.1.0`. Stays `0.x` until a feature package consumes it in production. Promotes to `1.0.0` after the first stable adoption.

## Alternatives considered

### A — Maximal-shared (every cross-boundary type lives here)

Every type touching any package boundary lands in `@bayaan/types`.

**Rejected.** Becomes a coordination point — any schema change requires cascading releases. Feature packages become skeletal. Skia-typed values (e.g., justification results) end up in a types-only package that can't take a Skia peer dependency cleanly.

### B — Minimal-shared (every package owns its types)

`@bayaan/types` doesn't exist; each feature package exports its own types.

**Rejected.** Consumers import from N packages to compose a config. Identical-shape types like `BaseTrack` get duplicated and diverge subtly. Port interfaces can't reference each other's basic shapes without circular package deps.

### C — Re-export wrapper

`@bayaan/types` is a thin file that re-exports from `services/`, `types/`, `store/`. The package is a pointer.

**Rejected.** Forces the package to import from `@/services/...`, which inverts the dependency — the package becomes a dependent of the app instead of a leaf. Defeats the purpose.

### D — Defer the package; use TypeScript path aliases

Add `@bayaan/types` as a `tsconfig.json` `paths` alias pointing at a `types/shared/` directory. No npm workspace package.

**Rejected.** Path aliases don't resolve in `npm pack` / `npm install` flows — the moment the platform is consumed cross-repo (which is where the workspace pays off), aliases break. Workspace symlinks survive the cross-repo case.

## Consequences

**Positive**

- One canonical home for the small set of types that genuinely cross feature boundaries.
- `BayaanError` machinery available for future feature packages from day one.
- Zero behavior change in the existing app — the package exists but no app code imports from it yet.
- The RFC-001 workspace gets its first real package, validating the npm-workspaces approach end-to-end.

**Neutral**

- `npm install` continues to work unchanged. Adding the workspace package adds a single symlink under `node_modules/@bayaan/types` pointing at `packages/bayaan-types`.
- Existing CI (`lint.yml`'s `tsc --noEmit` step) covers the package automatically because the root `tsconfig.json` includes `**/*.ts`.

**Negative / risks**

- The 20 `ErrorCode` values are a guess at what future packages will need. Some may be wrong, others missing. Mitigation: codes are additive (minor-version bump), so wrong-by-omission is cheap to fix.
- Twenty codes is enough rope for cargo-cult adoption — contributors might create new code names instead of reusing existing ones. Mitigation: explicit guidance in the package README and code review.

## How we'll know it worked

- The package's `errors.test.ts` suite passes (`npx jest packages/bayaan-types`): 12 tests, ~30ms.
- `npx tsc --noEmit` from repo root produces no new errors versus develop's baseline.
- iOS and Android builds produce identical artifacts to develop (no Metro / Babel resolution surprises from the new workspace package).
- A subsequent RFC (likely the audio seam RFC) imports `BayaanError` from `@bayaan/types` and the import resolves cleanly without further configuration.

## Open questions (deferred)

- **Jest workspace integration.** Does `npm test` from root pick up the package's tests, or do they need an explicit invocation? Will validate during this PR; if not auto-discovered, a follow-up RFC adds a Jest projects config.
- **`@bayaan/types` consumption pattern in app code.** Should app files import directly from `@bayaan/types` (`import { BayaanError } from '@bayaan/types'`) or from a relay (e.g., `@/lib/errors` re-exports)? Not decided here. Will surface naturally in the first migration RFC.
- **Where `RewayahId` ultimately lives.** Today: `services/rewayah/RewayahIdentity.ts` per its file-header directive. Whether to relocate is a separate discussion with its own RFC.
