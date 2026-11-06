// @ai-generated
import type {BayaanSettingsApiClient} from '@/services/settings/bayaanSettingsApiClient';
import {
  offeredContentStorage,
  syncInstalledContent,
} from './qfInstalledContentSync';
import {
  purgeSyncedLibrary,
  syncQfLibrary,
  type QfLibraryLocalAdapter,
  type QfLibrarySyncInput,
  type QfLibrarySyncResult,
} from './qfLibrarySync';
import {qfLibrarySyncStorage} from './qfLibrarySyncStorage';

/**
 * Library sync wired to this device's stores: what the annotation lifecycle
 * runs each round, and what sign-out purges.
 *
 * The adapters reach into the player, catalog and i18n modules, so they load
 * on first use rather than with the lifecycle.
 */
let adapters: QfLibraryLocalAdapter[] | undefined;

function libraryAdapters(): QfLibraryLocalAdapter[] {
  if (!adapters) {
    const module =
      require('./qfLibraryAdapters') as typeof import('./qfLibraryAdapters');
    adapters = [
      module.createLibraryAdapter(),
      module.createPlaylistsAdapter(),
      module.createAdhkarAdapter(),
    ];
  }
  return adapters;
}

/** Syncs the library collections, then the installed content list. */
export async function syncAccountLibrary(
  api: BayaanSettingsApiClient,
  input: QfLibrarySyncInput,
): Promise<QfLibrarySyncResult> {
  const library = await syncQfLibrary(
    {api, storage: qfLibrarySyncStorage, adapters: libraryAdapters()},
    input,
  );
  if (!input.isCurrent()) return library;
  const content =
    require('./qfInstalledContentAdapters') as typeof import('./qfInstalledContentAdapters');
  const installed = await syncInstalledContent(
    {
      api,
      readInstalled: content.readInstalledContent,
      offerDownloads: content.offerContentDownloads,
      offered: offeredContentStorage,
    },
    input,
  );
  return {...library, rerun: library.rerun || installed.rerun};
}

/** On explicit sign-out: see purgeSyncedLibrary. */
export function purgeAccountLibrary(accountId: string): Promise<void> {
  return purgeSyncedLibrary(
    {storage: qfLibrarySyncStorage, adapters: libraryAdapters()},
    accountId,
  );
}
