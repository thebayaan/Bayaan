import {AppState, type NativeEventSubscription} from 'react-native';
import type {EngineMessage} from './recitationEngine';
import {
  RECITATION_DOWNLOAD_MB,
  RECITATION_FOLLOWER_MB,
  RECITATION_V1_DOWNLOAD_MB,
} from '@/constants/recitation';
import {analyticsService} from '@/services/analytics/AnalyticsService';
import {
  ensureRecitationAssets,
  getRecitationAssets,
  secondLookModelPath,
  type RecitationAssetPaths,
} from './recitationAssets';
import {
  createRecitationEngine,
  type RecitationEngine,
} from './recitationEngine';
import {unloadSecondLook} from './secondLook/checkWord';
import {ensureV1Assets, getV1Assets, type V1AssetPaths} from './v1/assets';

/**
 * Which follower a session runs: 'v0' (Tilawa 0.4, the default) or 'v1' (the
 * Tilawa 1.0 preview, chosen on the hidden spike screen).
 */
export type EngineChoice = 'v0' | 'v1';

// Owns the Tilawa model: downloads it once, loads it on first use, keeps it
// between sessions and drops it after a while idle or on a memory warning.
// The model holds ~100 to 150 MB once loaded.

let engine: RecitationEngine | null = null;
// Which follower `engine` is, and which one `loading` is loading.
let engineKind: EngineChoice | null = null;
let loadingKind: EngineChoice | null = null;
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

/**
 * Whether the models (~111 MB) still have to be downloaded before use. Only the
 * follower's count: nothing waits for the second look's.
 */
export async function recitationModelNeedsDownload(
  kind: EngineChoice = 'v0',
): Promise<boolean> {
  if (kind === 'v1') {
    // Tilawa 1.0 shows nothing without the second model, so it counts too.
    const [files, second] = await Promise.all([
      getV1Assets(),
      secondLookModelPath(),
    ]);
    return files === null || second === null;
  }
  return (await getRecitationAssets()) === null;
}

/**
 * Whether the model is on the phone, and the size to state for it: what is there, as
 * the second look's model may not have arrived, or the whole download if nothing is.
 */
export async function recitationModelOnPhone(
  kind: EngineChoice = 'v0',
): Promise<{
  downloaded: boolean;
  sizeMb: number;
}> {
  if (kind === 'v1') {
    return {
      downloaded: !(await recitationModelNeedsDownload('v1')),
      sizeMb: RECITATION_V1_DOWNLOAD_MB,
    };
  }
  const [needed, second] = await Promise.all([
    recitationModelNeedsDownload(),
    secondLookModelPath(),
  ]);
  if (needed) return {downloaded: false, sizeMb: RECITATION_DOWNLOAD_MB};
  return {
    downloaded: true,
    sizeMb: second ? RECITATION_DOWNLOAD_MB : RECITATION_FOLLOWER_MB,
  };
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

function watchMemory(): void {
  memoryWarningSub ??= AppState.addEventListener('memoryWarning', () => {
    // The second look is optional, so it goes even during a take: marks then
    // show unchecked (with Tilawa 1.0 they then stay hidden).
    void unloadSecondLook();
    if (!busy) void unloadRecitationModel();
  });
}

async function loadV1Engine(): Promise<RecitationEngine> {
  let assets: V1AssetPaths | null;
  try {
    assets = await getV1Assets();
  } catch (error) {
    throw new EngineAcquireError('model_load', error);
  }
  if (!assets) {
    notify(callbacks => callbacks.onDownload(0));
    try {
      assets = await ensureV1Assets(progress =>
        notify(callbacks => callbacks.onDownload(progress)),
      );
    } catch (error) {
      throw new EngineAcquireError('download', error);
    }
    notify(callbacks => callbacks.onLoad());
  }
  let created: RecitationEngine;
  try {
    // Loaded only when chosen: the 0.4 follower never pulls in the 1.0 SDK.
    const {createTilawaV1Engine} =
      require('./v1/engine') as typeof import('./v1/engine');
    created = await createTilawaV1Engine(assets, msg => listener?.(msg));
  } catch (error) {
    throw new EngineAcquireError('model_load', error);
  }
  engine = created;
  engineKind = 'v1';
  watchMemory();
  return created;
}

async function loadEngine(kind: EngineChoice): Promise<RecitationEngine> {
  if (kind === 'v1') return loadV1Engine();
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
  engineKind = 'v0';
  watchMemory();
  return created;
}

/** Lets the loaded follower go so the other one can load; the caller owns it. */
async function swapOut(): Promise<void> {
  const loaded = engine;
  engine = null;
  engineKind = null;
  if (loaded) await loaded.dispose();
}

/**
 * The loaded engine, downloading and loading the model first if needed. A
 * caller that arrives while that is under way waits for the same download.
 * Throws an EngineAcquireError naming the step that failed.
 */
export async function acquireEngine(
  callbacks: AcquireCallbacks,
  kind: EngineChoice = 'v0',
): Promise<{engine: RecitationEngine; wasLoaded: boolean}> {
  cancelUnload();
  // A load of the other follower finishes first; then it is swapped out.
  if (loading && loadingKind !== kind) await loading.catch(() => undefined);
  if (engine && engineKind === kind) return {engine, wasLoaded: true};
  if (engine) await swapOut();
  waiting.add(callbacks);
  try {
    if (!loading) {
      loadingKind = kind;
      loading = loadEngine(kind).finally(() => {
        loading = null;
        loadingKind = null;
      });
    }
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
  engineKind = null;
  memoryWarningSub?.remove();
  memoryWarningSub = null;
  await unloadSecondLook();
  if (loaded) await loaded.dispose();
}
