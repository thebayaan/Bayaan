# @bayaan/types

Shared TypeScript primitives and error machinery for the Bayaan platform.

This package is intentionally small. It contains only types that have no clear single-owning concern, plus the `BayaanError` hierarchy used across future platform packages.

## What lives here

- **Playback primitives** — `BaseTrack`, `PlaybackState` (native union)
- **Mushaf primitives** — `AyahTimestamp`
- **Lock-screen** — `LockScreenMetadata`
- **Ambient** — `AmbientSoundType`
- **Errors** — `BayaanError` base class, `BayaanAudioError` / `BayaanMushafError` / `BayaanLifecycleError` / `BayaanNetworkError` subclasses, `ErrorCode` enum

## What does not live here

- `RewayahId` — canonical at [`services/rewayah/RewayahIdentity.ts`](../../services/rewayah/RewayahIdentity.ts) per its file header.
- Port interfaces (`PlayerController`, `CoordinatorHooks`, etc.) — owned by the feature packages that publish them (e.g. future `@bayaan/audio`).
- Concrete `Track` shapes with metadata — consumer-defined; consumers extend `BaseTrack`.

See [RFC-002](../../docs/rfcs/002-bayaan-types-package.md) for the full distribution rationale.

## Status

Pre-1.0. The shapes here are stable in intent but may be revised as feature packages adopt them.
