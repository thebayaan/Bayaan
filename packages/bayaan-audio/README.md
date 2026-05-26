# @bayaan/audio

The audio playback layer for the Bayaan platform. Owns the service singletons
and the React provider; consumers own all state.

## Status

**RFC-004 (this PR):** Port interfaces only. The package is workspace-only and
contains no app code yet — services still live in Bayaan's `services/audio/*`.

**RFC-005 (queued):** Refactor of `services/audio/*` to consume these ports
in-place, then a mechanical move into this package. See [ADR-0001](../../docs/rfcs/004-audio-seam.md)
and the [extraction plan](https://github.com/omar-zarka/bayaan-platform/blob/main/planning/Bayaan-Extraction-Plan.md)
for the full sequence.

## What this package exposes today

```ts
import {
  // Ports — five interfaces a consumer implements when integrating.
  type PlayerController,
  type CoordinatorHooks,
  type PlayerEventSink,
  type TimestampProvider,
  type LockScreenMetadataSource,
  type BayaanAudioConfig,
  type Unsubscribe,

  // No-op analytics sink for consumers that opt out.
  NullPlayerEventSink,

  // Stub adapter — fully wired in RFC-005.
  ExpoAudioPlayerControllerAdapter,
} from '@bayaan/audio';
```

## Design invariants

- **Flow is one-directional:** package → port → consumer. Ports never call back
  into package services.
- **Every port method is sync void or returns a Promise.** No hidden state.
- **The package does not know the consumer's store exists.** No imports of
  `usePlayerStore`, `useMushafPlayerStore`, or any consumer-side state model.
- **Repeat / queue / shuffle logic is consumer-side.** The package fires
  `onTrackEnded(track)`; the consumer decides what happens next.

## Why ports-and-adapters

The audio layer in Bayaan today has bidirectional coupling between
`ExpoAudioProvider` and `playerStore`, plus a circular dep between
`AudioCoordinator` and `mushafPlayerStore` patched with a lazy `require()`.
Neither can be moved into a reusable package without inverting that direction.
ADR-0001 details the alternatives considered and why the hexagonal split won.

## Testing

```sh
npx jest packages/bayaan-audio
```

The package's tests use jest matchers and the `MockAudioPlayer` fixture from
`@bayaan/test-utils`. Once RFC-005 lands, the same fixture will drive the
service-layer state-machine tests.

## License

AGPL-3.0-or-later (matches the parent repo).
