import {AppState, type NativeEventSubscription} from 'react-native';
import type {EngineMessage} from './recitationEngine';
import {analyticsService} from '@/services/analytics/AnalyticsService';
import {
  ensureRecitationAssets,
  getRecitationAssets,
  type RecitationAssetPaths,
} from './recitationAssets';
import {
  createRecitationEngine,
  type RecitationEngine,
} from './recitationEngine';

// Owns the Tilawa model: downloads it once, loads it on first use, keeps it
// between sessions and drops it after a while idle or on a memory warning.
// The model holds ~100 to 150 MB once loaded.

let engine: RecitationEngine | null = null;
let listener: ((msg: EngineMessage) => void) | null = null;
let busy = false;
let unloadTimer: ReturnType<typeof setTimeout> | null = null;
let memoryWarningSub: NativeEventSubscription | null = null;

/** Which step of getting the model ready failed. */
export class EngineAcquireError extends Error {
  constructor(
    readonly stage: 'download' | 'model_load',
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'EngineAcquireError';
  }
}

export interface AcquireCallbacks {
  /** The model files are missing and downloading, 0 to 1. */
  onDownload: (progress: number) => void;
  /** The download finished and the model is loading. */
  onLoad: () => void;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Whether the ~75 MB model still has to be downloaded before use. */
export async function recitationModelNeedsDownload(): Promise<boolean> {
  return (await getRecitationAssets()) === null;
}

/** Engine events go to this listener; null drops them. */
export function setEngineListener(
  next: ((msg: EngineMessage) => void) | null,
): void {
  listener = next;
}

/** While busy, unloading is refused: a session is using the model. */
export function markEngineBusy(next: boolean): void {
  busy = next;
}

async function downloadModel(
  onDownload: (progress: number) => void,
): Promise<RecitationAssetPaths> {
  const startedAt = Date.now();
  try {
    const assets = await ensureRecitationAssets(onDownload);
    analyticsService.trackRecitationModelDownloaded({
      outcome: 'completed',
      duration_ms: Date.now() - startedAt,
      error_message: null,
    });
    return assets;
  } catch (error) {
    analyticsService.trackRecitationModelDownloaded({
      outcome: 'failed',
      duration_ms: Date.now() - startedAt,
      error_message: messageOf(error),
    });
    throw error;
  }
}

// The download and load in progress, shared by every caller, and the
// callbacks of everyone waiting on it.
let loading: Promise<RecitationEngine> | null = null;
const waiting = new Set<AcquireCallbacks>();

function notify(call: (callbacks: AcquireCallbacks) => void): void {
  for (const callbacks of [...waiting]) call(callbacks);
}

async function loadEngine(): Promise<RecitationEngine> {
  let assets: RecitationAssetPaths | null;
  try {
    assets = await getRecitationAssets();
  } catch (error) {
    throw new EngineAcquireError('model_load', error);
  }
  if (!assets) {
    notify(callbacks => callbacks.onDownload(0));
    try {
      assets = await downloadModel(progress =>
        notify(callbacks => callbacks.onDownload(progress)),
      );
    } catch (error) {
      throw new EngineAcquireError('download', error);
    }
    notify(callbacks => callbacks.onLoad());
  }
  let created: RecitationEngine;
  try {
    created = await createRecitationEngine(assets, msg => listener?.(msg));
  } catch (error) {
    throw new EngineAcquireError('model_load', error);
  }
  engine = created;
  memoryWarningSub ??= AppState.addEventListener('memoryWarning', () => {
    if (!busy) void unloadRecitationModel();
  });
  return created;
}

/**
 * The loaded engine, downloading and loading the model first if needed. A
 * caller that arrives while that is under way waits for the same download.
 * Throws an EngineAcquireError naming the step that failed.
 */
export async function acquireEngine(
  callbacks: AcquireCallbacks,
): Promise<{engine: RecitationEngine; wasLoaded: boolean}> {
  cancelUnload();
  if (engine) return {engine, wasLoaded: true};
  waiting.add(callbacks);
  try {
    loading ??= loadEngine().finally(() => {
      loading = null;
    });
    return {engine: await loading, wasLoaded: false};
  } finally {
    waiting.delete(callbacks);
  }
}

export function cancelUnload(): void {
  if (unloadTimer) clearTimeout(unloadTimer);
  unloadTimer = null;
}

/** Unloads the model after `delayMs` unless a session starts first. */
export function scheduleUnload(delayMs: number): void {
  cancelUnload();
  if (!engine) return;
  unloadTimer = setTimeout(() => {
    unloadTimer = null;
    void unloadRecitationModel();
  }, delayMs);
}

/** Releases the loaded model; the next session loads it again (~1 to 2 s). */
export async function unloadRecitationModel(): Promise<void> {
  cancelUnload();
  if (busy) return;
  const loaded = engine;
  engine = null;
  memoryWarningSub?.remove();
  memoryWarningSub = null;
  if (loaded) await loaded.dispose();
}
