import {createMemoryContentRegistry, emptyRow} from '../contentRegistry';
import {
  AUTO_INSTALL_KEY,
  maybeAutoInstall,
  migrateLegacyContent,
} from '../legacyMigration';
import type {EngineDeps} from '../contentEngine';

function deps(
  registry = createMemoryContentRegistry(),
  installOk = true,
): EngineDeps {
  return {
    api: {
      fetchManifest: jest.fn(),
      getDownloadTicket: jest.fn(async () => ({
        url: 'u',
        version: 3,
        sha256: 's',
        bytes: 1,
        expires_at: 'x',
      })),
      fetchText: jest.fn(async () =>
        JSON.stringify({
          envelope: 1,
          key: AUTO_INSTALL_KEY,
          version: 3,
          source: 'qf',
          fetched_at: 'x',
          snapshot: {
            resource_group: 'tafsirs',
            resource_id: 169,
            schema_version: 1,
            records: [],
          },
        }),
      ),
    },
    registry,
    installers: {
      tafsir: {
        kind: 'tafsir',
        supportsSchemaVersion: () => true,
        install: installOk
          ? jest.fn().mockResolvedValue(undefined)
          : jest.fn().mockRejectedValue(new Error('offline')),
        remove: jest.fn(),
        onWithdrawn: jest.fn(),
      },
    },
    isOnWifi: jest.fn().mockResolvedValue(false),
    sha256: jest.fn().mockResolvedValue('s'),
    now: () => 1000,
    notify: jest.fn(),
    track: jest.fn(),
  };
}

describe('migrateLegacyContent', () => {
  it('marks existing tafsirs as legacy version 0, once', async () => {
    const registry = createMemoryContentRegistry();
    expect(await migrateLegacyContent(registry, ['169', '16'], 5)).toBe(2);
    expect(await registry.get('qf:tafsirs:169')).toMatchObject({
      version: 0,
      legacy: true,
    });
    expect(await migrateLegacyContent(registry, ['999'], 6)).toBe(0);
    expect(await registry.get('qf:tafsirs:999')).toBeNull();
  });
});

describe('maybeAutoInstall', () => {
  it('installs Ibn Kathir on a fresh install, even off Wi-Fi', async () => {
    const d = deps();
    expect(await maybeAutoInstall(d)).toBe(true);
    expect((await d.registry.get(AUTO_INSTALL_KEY))?.version).toBe(3);
    expect((await d.registry.getState()).autoInstallDone).toBe(true);
  });

  it('never reinstalls after the user removed it', async () => {
    const d = deps();
    await d.registry.upsert({
      ...emptyRow(AUTO_INSTALL_KEY, 'tafsir'),
      user_removed: true,
    });
    expect(await maybeAutoInstall(d)).toBe(false);
    expect(d.api.getDownloadTicket).not.toHaveBeenCalled();
  });

  it('does not run when a legacy copy exists (the check replaces it)', async () => {
    const d = deps();
    await d.registry.upsert({
      ...emptyRow(AUTO_INSTALL_KEY, 'tafsir'),
      legacy: true,
    });
    expect(await maybeAutoInstall(d)).toBe(false);
  });

  it('retries on the next run if the first attempt fails', async () => {
    const d = deps(createMemoryContentRegistry(), false);
    expect(await maybeAutoInstall(d)).toBe(false);
    expect((await d.registry.getState()).autoInstallDone).toBe(false);
  });
});
