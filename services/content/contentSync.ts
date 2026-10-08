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
import {createContentApi, resolveContentApiBase} from './contentApi';
import {
  installResource,
  removeResource,
  runContentCheck,
  type EngineDeps,
} from './contentEngine';
import {showWithdrawalNotice} from './contentNotices';
import {createSqliteContentRegistry} from './contentRegistry';
import {maybeAutoInstall, migrateLegacyContent} from './legacyMigration';
import {createTafsirInstaller} from './tafsirInstaller';

let deps: EngineDeps | null = null;
let subscription: NativeEventSubscription | null = null;
let running: Promise<void> = Promise.resolve();

export function isEngineManagingTafsir(): boolean {
  return !branding.tafsirProvider && resolveContentApiBase() !== null;
}

function buildDeps(base: string): EngineDeps {
  return {
    api: createContentApi(base, process.env.EXPO_PUBLIC_BAYAAN_API_KEY ?? ''),
    registry: createSqliteContentRegistry(),
    installers: {tafsir: createTafsirInstaller()},
    isOnWifi: async () => {
      const state = await NetInfo.fetch();
      return (
        state.type === 'wifi' || state.details?.isConnectionExpensive === false
      );
    },
    sha256: text =>
      Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text),
    now: Date.now,
    notify: showWithdrawalNotice,
    track: (event, props) => analyticsService.trackContentEvent(event, props),
  };
}

function serialize(task: () => Promise<void>): Promise<void> {
  running = running.then(task, task).catch(() => undefined);
  return running;
}

async function cycle(active: EngineDeps): Promise<void> {
  await maybeAutoInstall(active);
  await runContentCheck(active);
}

export async function initContentSync(): Promise<void> {
  const base = resolveContentApiBase();
  if (deps || !base || !isEngineManagingTafsir()) return;
  const active = buildDeps(base);
  deps = active;
  await serialize(async () => {
    const legacy = (await tafseerDbService.getDownloadedTafaseer()).map(
      item => item.identifier,
    );
    await migrateLegacyContent(active.registry, legacy, active.now());
    await cycle(active);
  });
  subscription = AppState.addEventListener(
    'change',
    (status: AppStateStatus) => {
      // serialize never rejects, so the returned promise can be dropped.
      if (status === 'active') serialize(() => cycle(active));
    },
  );
}

export function teardownContentSync(): void {
  subscription?.remove();
  subscription = null;
  deps = null;
}

export async function installContent(key: string): Promise<void> {
  if (!deps) throw new Error('content_sync_unavailable');
  const active = deps;
  let failure: unknown = null;
  await serialize(async () => {
    try {
      await installResource(active, key, 'tafsir', 'user');
    } catch (error) {
      failure = error;
    }
  });
  if (failure) throw failure;
}

export async function removeContent(key: string): Promise<void> {
  if (!deps) return;
  const active = deps;
  await serialize(() => removeResource(active, key));
}
