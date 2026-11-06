import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import {analyticsService} from '@/services/analytics/AnalyticsService';
import {tafseerDbService} from '@/services/tafseer/TafseerDbService';
import {translationDbService} from '@/services/translation/TranslationDbService';
import type {
  ContentInstaller,
  ContentKind,
  ContentMeta,
  Manifest,
} from '@/types/content';
import {installSelectedTranslation, manifestOffers} from './autoInstall';
import {idFromKey, kindForKey} from './contentKeys';
import {createContentApi, resolveContentApiBase} from './contentApi';
import {
  installResource,
  removeResource,
  runContentCheck,
  type EngineDeps,
} from './contentEngine';
import {
  showRemovedTranslationsNotice,
  showWithdrawalNotice,
} from './contentNotices';
import {
  createSqliteContentRegistry,
  type ContentRegistry,
} from './contentRegistry';
import {isEngineManagingTafsir, managedKinds} from './contentScope';
import {
  AUTO_INSTALL_KEY,
  adoptUnmanagedContent,
  maybeAutoInstall,
  migrateLegacyContent,
} from './legacyMigration';
import {createTafsirInstaller} from './tafsirInstaller';
import {
  createTranslationInstaller,
  type TranslationHost,
} from './translationInstaller';
import {migrateLegacyTranslations} from './translationMigration';

export {
  isEngineManagingTafsir,
  isEngineManagingTranslations,
  managedKinds,
} from './contentScope';

// After a failed manifest check, further checks in this session wait this long.
export const FAILED_CHECK_THROTTLE_MS = 3_600_000;

// What the engine reads from and changes in the app, supplied by the caller
// (services/startContentSync) so neither this module nor its installers
// import the settings or translation stores.
export type ContentSyncHost = TranslationHost;

// An entry the last cached manifest offers for install.
export interface OfferedContent {
  key: string;
  id: string;
  meta: ContentMeta | undefined;
  bytes: number | undefined;
}

let deps: EngineDeps | null = null;
let subscription: NativeEventSubscription | null = null;
let running: Promise<void> = Promise.resolve();
let checkBlockedUntil = 0;
let fallbackRegistry: ContentRegistry | null = null;
// The host from the last initContentSync call; kept across teardown so a
// removal without deps can still build the translation installer.
let knownHost: ContentSyncHost | null = null;

const INSTALLER_FACTORIES: Record<
  ContentKind,
  (host: ContentSyncHost) => ContentInstaller
> = {
  tafsir: () => createTafsirInstaller(),
  translation: host => createTranslationInstaller({host}),
};

// The manifest is requested for every kind with an installer, so translation
// entries are cached; a translation installs only through installContent or
// as the reader's selection (installSelection).
function buildInstallers(
  host: ContentSyncHost,
): Partial<Record<ContentKind, ContentInstaller>> {
  return Object.fromEntries(
    managedKinds().map(kind => [kind, INSTALLER_FACTORIES[kind](host)]),
  );
}

export function isOnWifi(state: {type: string}): boolean {
  return state.type === 'wifi' || state.type === 'ethernet';
}

function buildDeps(base: string, host: ContentSyncHost): EngineDeps {
  return {
    api: createContentApi(base, process.env.EXPO_PUBLIC_BAYAAN_API_KEY ?? ''),
    registry: createSqliteContentRegistry(),
    installers: buildInstallers(host),
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

// The AlQuranCloud translations move to QF ids once (spec 4.7), before the
// check, so the check replaces the renamed copies.
async function migrateTranslations(
  active: EngineDeps,
  host: ContentSyncHost,
): Promise<boolean> {
  if (!active.installers.translation) return false;
  return migrateLegacyTranslations({
    registry: active.registry,
    db: translationDbService,
    notifyRemoved: showRemovedTranslationsNotice,
    reload: host.reloadTranslations,
    now: active.now(),
  });
}

async function isMigrated(active: EngineDeps): Promise<boolean> {
  return (await active.registry.getState()).migratedAt !== null;
}

// After the migration, so a downloaded AlQuranCloud copy is renamed rather
// than downloaded again. Uses the last stored manifest: this cycle's, or the
// cached one when the check was skipped or returned 304.
async function installSelection(
  active: EngineDeps,
  host: ContentSyncHost,
): Promise<void> {
  const {manifest, translationsMigratedAt} = await active.registry.getState();
  if (translationsMigratedAt === null) return;
  await installSelectedTranslation(
    active,
    host.selectedTranslationId(),
    manifest,
  );
}

// Order: adoption and the translations migration (each retried every cycle
// until it succeeds), then the check, then the selected translation and the
// first-launch tafsir installs. Each step is isolated from the others.
async function cycle(active: EngineDeps, host: ContentSyncHost): Promise<void> {
  const adopted = await attempt(active, () => adoptLocalContent(active));
  await attempt(active, () => migrateTranslations(active, host));
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
  await attempt(active, () => installSelection(active, host));
  if (migrated !== true) return;
  // Without a manifest this cycle (skipped, 304 or failed) the install may
  // proceed: the backend refuses tickets for withdrawn keys.
  if (seen.manifest && !manifestOffers(seen.manifest, AUTO_INSTALL_KEY)) return;
  await attempt(active, () => maybeAutoInstall(active));
}

export async function initContentSync(host: ContentSyncHost): Promise<void> {
  knownHost = host;
  const base = resolveContentApiBase();
  if (deps || !base || !isEngineManagingTafsir()) return;
  const active = buildDeps(base, host);
  deps = active;
  await serialize(() => cycle(active, host));
  // Torn down (or replaced) while the first cycle ran: do not subscribe.
  if (deps !== active) return;
  subscription = AppState.addEventListener(
    'change',
    (status: AppStateStatus) => {
      // serialize never rejects, so the returned promise can be dropped.
      if (status === 'active' && deps === active)
        serialize(() => cycle(active, host));
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
  const kind = kindForKey(key);
  const active = deps;
  if (!active) throw new Error('content_sync_unavailable');
  if (kind === null || !active.installers[kind])
    throw new Error('unsupported_content_key');
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
    await installResource(active, key, kind, 'user');
  });
}

// The active entries of one kind in the last cached manifest. Null when the
// engine does not manage that kind or no manifest has loaded yet.
export async function getOfferedContent(
  kind: ContentKind,
): Promise<OfferedContent[] | null> {
  if (!managedKinds().includes(kind)) return null;
  fallbackRegistry ??= createSqliteContentRegistry();
  const registry = deps?.registry ?? fallbackRegistry;
  const {manifest, manifestKinds} = await registry.getState();
  // A manifest cached before this kind was requested has no entries for it:
  // treat it as no manifest until the next check refetches. Caches from
  // before kinds were recorded were fetched for tafsir only.
  const cachedKinds = manifestKinds?.split(',') ?? ['tafsir'];
  if (!manifest || !cachedKinds.includes(kind)) return null;
  return manifest.resources
    .filter(entry => entry.status === 'active' && entry.kind === kind)
    .map(entry => ({
      key: entry.key,
      id: idFromKey(entry.key),
      meta: entry.meta,
      bytes: entry.bytes,
    }));
}

// The tafsir ids on offer; null shows the full static catalog.
export async function getOfferedTafsirIds(): Promise<ReadonlySet<string> | null> {
  const offered = await getOfferedContent('tafsir');
  return offered && new Set(offered.map(entry => entry.id));
}

// After teardown there are no engine deps, but the removal must still stick:
// record the user_removed marker and delete the rows. The installers need the
// host, so a removal before initContentSync was ever called is refused (boot
// calls it before the splash hides, so no screen can get there first).
export async function removeContent(key: string): Promise<void> {
  const active = deps;
  if (active) {
    await exclusive(() => removeResource(active, key));
    return;
  }
  const host = knownHost;
  if (!host) throw new Error('content_sync_unavailable');
  fallbackRegistry ??= createSqliteContentRegistry();
  const registry = fallbackRegistry;
  await exclusive(() =>
    removeResource({registry, installers: buildInstallers(host)}, key),
  );
}
