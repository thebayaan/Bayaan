import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import branding from '@/config/branding';
import {analyticsService} from '@/services/analytics/AnalyticsService';
import {tafseerDbService} from '@/services/tafseer/TafseerDbService';
import type {Manifest} from '@/types/content';
import {createContentApi, resolveContentApiBase} from './contentApi';
import {
  installResource,
  removeResource,
  runContentCheck,
  type EngineDeps,
} from './contentEngine';
import {showWithdrawalNotice} from './contentNotices';
import {
  createSqliteContentRegistry,
  type ContentRegistry,
} from './contentRegistry';
import {
  AUTO_INSTALL_KEY,
  adoptUnmanagedContent,
  maybeAutoInstall,
  migrateLegacyContent,
} from './legacyMigration';
import {createTafsirInstaller} from './tafsirInstaller';

// After a failed manifest check, further checks in this session wait this long.
export const FAILED_CHECK_THROTTLE_MS = 3_600_000;
const TAFSIR_KEY_PREFIX = 'qf:tafsirs:';

let deps: EngineDeps | null = null;
let subscription: NativeEventSubscription | null = null;
let running: Promise<void> = Promise.resolve();
let checkBlockedUntil = 0;
let fallbackRegistry: ContentRegistry | null = null;

// The single gate for every caller: when false (a fork with its own
// tafsirProvider, or no API base URL), the engine owns nothing and
// initContentSync, installContent and removeContent must not be called.
export function isEngineManagingTafsir(): boolean {
  return !branding.tafsirProvider && resolveContentApiBase() !== null;
}

export function isOnWifi(state: {type: string}): boolean {
  return state.type === 'wifi' || state.type === 'ethernet';
}

function buildDeps(base: string): EngineDeps {
  return {
    api: createContentApi(base, process.env.EXPO_PUBLIC_BAYAAN_API_KEY ?? ''),
    registry: createSqliteContentRegistry(),
    installers: {tafsir: createTafsirInstaller()},
    isOnWifi: async () => isOnWifi(await NetInfo.fetch()),
    sha256: text =>
      Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text),
    now: () => Date.now(),
    notify: showWithdrawalNotice,
    track: (event, props) => analyticsService.trackContentEvent(event, props),
  };
}

function reportFailure(active: EngineDeps, error: unknown): void {
  try {
    active.track('failed', {
      key: 'sync',
      version: 0,
      reason: error instanceof Error ? error.message : 'unknown',
    });
  } catch {
    // Reporting must never break a sync cycle.
  }
}

// Runs one step of a cycle in isolation: a throwing step is reported and
// yields undefined, so the remaining steps still run.
async function attempt<T>(
  active: EngineDeps,
  task: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await task();
  } catch (error) {
    reportFailure(active, error);
    return undefined;
  }
}

function serialize(task: () => Promise<void>): Promise<void> {
  running = running.then(task, task).catch(() => undefined);
  return running;
}

// Every cycle adopts downloaded tafsirs that have no registry row; the first
// successful run also records migratedAt.
async function adoptLocalContent(active: EngineDeps): Promise<boolean> {
  const downloaded = (await tafseerDbService.getDownloadedTafaseer()).map(
    item => ({identifier: item.identifier, name: item.name}),
  );
  const state = await active.registry.getState();
  if (state.migratedAt === null) {
    await migrateLegacyContent(active.registry, downloaded, active.now());
  } else {
    await adoptUnmanagedContent(active.registry, downloaded);
  }
  return true;
}

async function isMigrated(active: EngineDeps): Promise<boolean> {
  return (await active.registry.getState()).migratedAt !== null;
}

function manifestAllowsAutoInstall(manifest: Manifest): boolean {
  // A paused manifest is the kill switch: nothing new installs.
  if (manifest.paused) return false;
  const entry = manifest.resources.find(item => item.key === AUTO_INSTALL_KEY);
  return entry !== undefined && entry.status !== 'withdrawn';
}

// Order: adoption (the migration is retried every cycle until it succeeds), then the check,
// then the first-launch install. Each step is isolated from the others.
async function cycle(active: EngineDeps): Promise<void> {
  const adopted = await attempt(active, () => adoptLocalContent(active));
  // A failed adoption after the first migration must not block the install.
  const migrated =
    adopted === true || (await attempt(active, () => isMigrated(active)));
  const seen: {manifest: Manifest | null} = {manifest: null};
  if (active.now() >= checkBlockedUntil) {
    const outcome = await attempt(active, () =>
      runContentCheck(active, {
        onManifest: manifest => {
          seen.manifest = manifest;
        },
      }),
    );
    if (outcome === 'error' || outcome === undefined) {
      checkBlockedUntil = active.now() + FAILED_CHECK_THROTTLE_MS;
    }
  }
  if (migrated !== true) return;
  // Without a manifest this cycle (skipped, 304 or failed) the install may
  // proceed: the backend refuses tickets for withdrawn keys.
  if (seen.manifest && !manifestAllowsAutoInstall(seen.manifest)) return;
  await attempt(active, () => maybeAutoInstall(active));
}

export async function initContentSync(): Promise<void> {
  const base = resolveContentApiBase();
  if (deps || !base || !isEngineManagingTafsir()) return;
  const active = buildDeps(base);
  deps = active;
  await serialize(() => cycle(active));
  // Torn down (or replaced) while the first cycle ran: do not subscribe.
  if (deps !== active) return;
  subscription = AppState.addEventListener(
    'change',
    (status: AppStateStatus) => {
      // serialize never rejects, so the returned promise can be dropped.
      if (status === 'active' && deps === active)
        serialize(() => cycle(active));
    },
  );
}

export function teardownContentSync(): void {
  subscription?.remove();
  subscription = null;
  deps = null;
  checkBlockedUntil = 0;
}

// Runs a user action in the queue and rethrows its error to the caller; the
// queue itself keeps going.
async function exclusive(task: () => Promise<void>): Promise<void> {
  const outcome: {failed: boolean; error: unknown} = {
    failed: false,
    error: null,
  };
  await serialize(async () => {
    try {
      await task();
    } catch (error) {
      outcome.failed = true;
      outcome.error = error;
    }
  });
  if (outcome.failed) throw outcome.error;
}

export async function installContent(key: string): Promise<void> {
  if (!key.startsWith(TAFSIR_KEY_PREFIX)) {
    throw new Error('unsupported_content_key');
  }
  const active = deps;
  if (!active) throw new Error('content_sync_unavailable');
  const requestedAt = active.now();
  await exclusive(async () => {
    // Joins an install of the same key that finished while this request
    // waited in the queue (the first-launch install, or a repeated tap).
    const row = await active.registry.get(key);
    if (
      row &&
      !row.legacy &&
      row.version > 0 &&
      row.installed_at !== null &&
      row.installed_at >= requestedAt
    )
      return;
    await installResource(active, key, 'tafsir', 'user');
  });
}

// The tafsir ids the last cached manifest offers for install. Null when the
// engine is off or no manifest has loaded yet: the full static catalog shows.
export async function getOfferedTafsirIds(): Promise<ReadonlySet<string> | null> {
  if (!isEngineManagingTafsir()) return null;
  fallbackRegistry ??= createSqliteContentRegistry();
  const registry = deps?.registry ?? fallbackRegistry;
  const {manifest} = await registry.getState();
  if (!manifest) return null;
  const ids = new Set<string>();
  for (const entry of manifest.resources) {
    if (entry.status !== 'active' || !entry.key.startsWith(TAFSIR_KEY_PREFIX))
      continue;
    ids.add(entry.key.slice(TAFSIR_KEY_PREFIX.length));
  }
  return ids;
}

// Before init (or after teardown) there are no engine deps, but the removal
// must still stick: record the user_removed marker and delete the rows.
export async function removeContent(key: string): Promise<void> {
  const active = deps;
  if (active) {
    await exclusive(() => removeResource(active, key));
    return;
  }
  fallbackRegistry ??= createSqliteContentRegistry();
  const registry = fallbackRegistry;
  await exclusive(() =>
    removeResource(
      {registry, installers: {tafsir: createTafsirInstaller()}},
      key,
    ),
  );
}
