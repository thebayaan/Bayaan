import {installOnce} from './autoInstall';
import {AUTO_INSTALL_KEY, type EngineDeps} from './contentEngine';
import {emptyRow, type ContentRegistry} from './contentRegistry';

export {AUTO_INSTALL_KEY};

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

// The first-launch tafsir: installOnce, recorded in autoInstallDone once
// settled. Only a catalog purge reopens it (purge clears autoInstallDone).
export async function maybeAutoInstall(deps: EngineDeps): Promise<boolean> {
  const state = await deps.registry.getState();
  if (state.autoInstallDone) return false;
  const outcome = await installOnce(deps, AUTO_INSTALL_KEY, 'tafsir');
  if (outcome !== 'pending')
    await deps.registry.setState({autoInstallDone: true});
  return outcome === 'installed';
}
