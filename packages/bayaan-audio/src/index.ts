// Ports (ADR-0001 — the seam @bayaan/audio exposes to consumers)
export type {
  BayaanAudioConfig,
  CoordinatorHooks,
  LockScreenMetadataSource,
  PlayerController,
  PlayerEventSink,
  TimestampProvider,
  Unsubscribe,
} from './ports';
export {NullPlayerEventSink} from './ports';

// Adapters (stub today — fully wired in RFC-005)
export {ExpoAudioPlayerControllerAdapter} from './adapters/expo-audio-player-controller';
