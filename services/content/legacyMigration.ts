import {installResource, retryIsDue, type EngineDeps} from './contentEngine';
import {emptyRow, type ContentRegistry} from './contentRegistry';
import {reportInstall} from './installActivity';

export const AUTO_INSTALL_KEY = 'qf:tafsirs:169';

export interface DownloadedContent {
  identifier: string;
  name?: string | null;
}

// Adopts each downloaded tafsir without a registry row as a legacy row, so the
// check replaces or purges it. A row of any kind (user_removed included) wins.
export async function adoptUnmanagedContent(
  registry: ContentRegistry,
  downloaded: DownloadedContent[],
): Promise<number> {
  let adopted = 0;
  for (const item of downloaded) {
    const key = `qf:tafsirs:${item.identifier}`;
    if (await registry.get(key)) continue;
    await registry.upsert({
      ...emptyRow(key, 'tafsir'),
      legacy: true,
      name: item.name ?? null,
    });
    adopted++;
  }
  return adopted;
}

// The first run (v2.3.0 downloads); later cycles call adoptUnmanagedContent
// directly, which heals a kill between saving rows and the registry write.
export async function migrateLegacyContent(
  registry: ContentRegistry,
  downloaded: DownloadedContent[],
  now: number,
): Promise<number> {
  const state = await registry.getState();
  if (state.migratedAt !== null) return 0;
  const migrated = await adoptUnmanagedContent(registry, downloaded);
  await registry.setState({migratedAt: now});
  return migrated;
}

export async function maybeAutoInstall(deps: EngineDeps): Promise<boolean> {
  const state = await deps.registry.getState();
  if (state.autoInstallDone) return false;
  const row = await deps.registry.get(AUTO_INSTALL_KEY);
  if (row && (row.user_removed || row.legacy || row.version > 0)) {
    // The first-launch install is settled for good: a legacy copy is replaced
    // by the check, an install exists, or the user removed it. Never retry, so
    // a later purge or removal cannot bring Ibn Kathir back.
    await deps.registry.setState({autoInstallDone: true});
    return false;
  }
  // A failed attempt left a placeholder with a backoff; wait it out.
  if (row && !retryIsDue(row.next_retry_at, deps.now())) return false;
  await reportInstall(AUTO_INSTALL_KEY, () =>
    installResource(deps, AUTO_INSTALL_KEY, 'tafsir', 'auto'),
  );
  const installed = await deps.registry.get(AUTO_INSTALL_KEY);
  if (!installed || installed.version === 0) return false;
  await deps.registry.setState({autoInstallDone: true});
  return true;
}
