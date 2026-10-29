import {
  requireOptionalNativeModule,
  type EventSubscription,
} from 'expo-modules-core';

export interface NativeBayaanWidgetsModule {
  writeSnapshot(json: string): void;
  reloadWidgets(kinds: string[]): void;
  takeQueuedCommands(): string;
  // Newest enqueuedAt JS has handled; a waiting widget tap reads it. // @ai
  markCommandsHandled?(through: number): void; // @ai
  takePendingTasbeeh(): string;
  takePendingWidgetEvents(): string;
  cacheArtwork(sourceUrl: string, fileName: string): Promise<boolean>;
  hasArtwork(fileName: string): boolean;
  writeCatalog(json: string): void;
  readArtworkRequests(): string;
  writeContent(json: string): void;
  // iOS only (absent on Android): the Now Playing Live Activity.
  isLiveActivitySupported?(): boolean;
  startNowPlayingActivity?(json: string, staleAtMs: number): Promise<string>;
  updateNowPlayingActivity?(json: string, staleAtMs: number): Promise<boolean>;
  // JSON content state of the activity on screen, or "" when there is none.
  currentNowPlayingActivity?(): string;
  endNowPlayingActivities?(): Promise<void>;
  // iOS only (absent on Android): the adhkar session Live Activity.
  startAdhkarSessionActivity?(json: string, staleAtMs: number): Promise<string>;
  updateAdhkarSessionActivity?(
    json: string,
    staleAtMs: number,
  ): Promise<boolean>;
  // dismissAtMs: keep the ended activity on screen until then; omitted (or
  // null) dismisses it at once.
  endAdhkarSessionActivities?(dismissAtMs: number | null): Promise<void>;
  addListener(
    event: 'onCommandQueued',
    listener: () => void,
  ): EventSubscription;
}

// null on web and in Jest
export const NativeBayaanWidgets: NativeBayaanWidgetsModule | null =
  requireOptionalNativeModule<NativeBayaanWidgetsModule>('BayaanWidgets');
