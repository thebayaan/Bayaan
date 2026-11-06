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
import {translationDbService} from '@/services/translation/TranslationDbService';
import {remapLegacyTranslationId} from '@/services/translation/translationRemap';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTranslationStore} from '@/store/translationStore';
import type {
  ContentInstaller,
  ContentKind,
  ContentMeta,
  Manifest,
} from '@/types/content';
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
import {
  AUTO_INSTALL_KEY,
  adoptUnmanagedContent,
  maybeAutoInstall,
  migrateLegacyContent,
} from './legacyMigration';
import {createTafsirInstaller} from './tafsirInstaller';
import {createTranslationInstaller} from './translationInstaller';
import {
  maybeAutoInstallTranslation,
  migrateLegacyTranslations,
} from './translationMigration';

// After a failed manifest check, further checks in this session wait this long.
export const FAILED_CHECK_THROTTLE_MS = 3_600_000;

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

const INSTALLER_FACTORIES: Record<ContentKind, () => ContentInstaller> = {
  tafsir: createTafsirInstaller,
  translation: createTranslationInstaller,
};

/**
 * The single gate for every caller: the kinds this engine owns. Empty without
 * an API base URL, or when a fork keeps its own tafsirProvider: the cycle is
 * anchored on tafsir (adoption, first-launch install), so the engine only runs
 * while it owns tafsir. Translations ride along unless a fork keeps its own
 * translationProvider (RFC-009).
 */
export function managedKinds(): ContentKind[] {
  if (branding.tafsirProvider || resolveContentApiBase() === null) return [];
  return branding.translationProvider ? ['tafsir'] : ['tafsir', 'translation'];
}

// When false, initContentSync, installContent and removeContent must not be called.
export function isEngineManagingTafsir(): boolean {
  return managedKinds().includes('tafsir');
}

export function isEngineManagingTranslations(): boolean {
  return managedKinds().includes('translation');
}

// The manifest is requested for every kind with an installer, so translation
// entries are cached; nothing installs a translation without installContent.
function buildInstallers(): Partial<Record<ContentKind, ContentInstaller>> {
  return Object.fromEntries(
    managedKinds().map(kind => [kind, INSTALLER_FACTORIES[kind]()]),
  );
}

export function isOnWifi(state: {type: string}): boolean {
  return state.type === 'wifi' || state.type === 'ethernet';
}

function buildDeps(base: string): EngineDeps {
  return {
    api: createContentApi(base, process.env.EXPO_PUBLIC_BAYAAN_API_KEY ?? ''),
    registry: createSqliteContentRegistry(),
    installers: buildInstallers(),
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

// The selection must be read after the persisted settings loaded, or the
// default would be migrated instead of the reader's choice.
function settingsHydrated(): boolean {
  const persist = useMushafSettingsStore.persist;
  return !persist || persist.hasHydrated();
}

// The AlQuranCloud translations move to QF ids once (spec 4.7), before the
// check, so the check replaces the renamed copies. Before the settings
// loaded it waits for the next cycle rather than blocking this one.
async function migrateTranslations(active: EngineDeps): Promise<boolean> {
  if (!active.installers.translation || !settingsHydrated()) return false;
  return migrateLegacyTranslations({
    registry: active.registry,
    db: translationDbService,
    settings: useMushafSettingsStore,
    notifyRemoved: showRemovedTranslationsNotice,
    reload: () => useTranslationStore.getState().loadDownloadedMeta(),
    now: active.now(),
  });
}

async function isMigrated(active: EngineDeps): Promise<boolean> {
  return (await active.registry.getState()).migratedAt !== null;
}

function manifestAllowsAutoInstall(
  manifest: Manifest,
  key: string = AUTO_INSTALL_KEY,
): boolean {
  // A paused manifest is the kill switch: nothing new installs.
  if (manifest.paused) return false;
  const entry = manifest.resources.find(item => item.key === key);
  return entry !== undefined && entry.status !== 'withdrawn';
}

// The queued translation install (Saheeh as QF 20) follows the same manifest
// rules as the first-launch tafsir.
async function autoInstallTranslation(
  active: EngineDeps,
  manifest: Manifest | null,
): Promise<void> {
  if (!active.installers.translation) return;
  const {translationAutoInstallKey} = await active.registry.getState();
  if (translationAutoInstallKey === null) return;
  if (
    manifest &&
    !manifestAllowsAutoInstall(manifest, translationAutoInstallKey)
  )
    return;
  await maybeAutoInstallTranslation(active);
}

// Order: adoption (the migration is retried every cycle until it succeeds), then the check,
// then the first-launch install. Each step is isolated from the others.
async function cycle(active: EngineDeps): Promise<void> {
  const adopted = await attempt(active, () => adoptLocalContent(active));
  await attempt(active, () => migrateTranslations(active));
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
  await attempt(active, () => autoInstallTranslation(active, seen.manifest));
  if (migrated !== true) return;
  // Without a manifest this cycle (skipped, 304 or failed) the install may
  // proceed: the backend refuses tickets for withdrawn keys.
  if (seen.manifest && !manifestAllowsAutoInstall(seen.manifest)) return;
  await attempt(active, () => maybeAutoInstall(active));
}

// Without the engine's translations (a fork's own provider, or no content
// API), nothing migrates; only the retired bundled Saheeh selection moves to
// the bundled Clear Quran.
function retireBundledSaheehSelection(): void {
  const retire = () => {
    const settings = useMushafSettingsStore.getState();
    const next = remapLegacyTranslationId(
      settings.selectedTranslationId,
      false,
    );
    if (next !== settings.selectedTranslationId)
      settings.setSelectedTranslationId(next);
  };
  if (settingsHydrated()) {
    retire();
    return;
  }
  const unsubscribe = useMushafSettingsStore.persist.onFinishHydration(() => {
    unsubscribe();
    retire();
  });
}

export async function initContentSync(): Promise<void> {
  if (!isEngineManagingTranslations()) retireBundledSaheehSelection();
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
    removeResource({registry, installers: buildInstallers()}, key),
  );
}
