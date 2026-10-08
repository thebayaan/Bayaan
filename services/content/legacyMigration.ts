import {installResource, type EngineDeps} from './contentEngine';
import {emptyRow, type ContentRegistry} from './contentRegistry';

export const AUTO_INSTALL_KEY = 'qf:tafsirs:169';

export async function migrateLegacyContent(
  registry: ContentRegistry,
  legacyTafsirIds: string[],
  now: number,
): Promise<number> {
  const state = await registry.getState();
  if (state.migratedAt !== null) return 0;
  let migrated = 0;
  for (const id of legacyTafsirIds) {
    const key = `qf:tafsirs:${id}`;
    if (await registry.get(key)) continue;
    await registry.upsert({...emptyRow(key, 'tafsir'), legacy: true});
    migrated++;
  }
  await registry.setState({migratedAt: now});
  return migrated;
}

export async function maybeAutoInstall(deps: EngineDeps): Promise<boolean> {
  const state = await deps.registry.getState();
  if (state.autoInstallDone) return false;
  const row = await deps.registry.get(AUTO_INSTALL_KEY);
  if (row && (row.user_removed || row.legacy || row.version > 0)) return false;
  await installResource(deps, AUTO_INSTALL_KEY, 'tafsir', 'auto');
  const installed = await deps.registry.get(AUTO_INSTALL_KEY);
  if (!installed || installed.version === 0) return false;
  await deps.registry.setState({autoInstallDone: true});
  return true;
}
