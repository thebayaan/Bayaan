import {createMemoryContentRegistry, emptyRow} from '../contentRegistry';
import {
  AUTO_INSTALL_KEY,
  maybeAutoInstall,
  migrateLegacyContent,
} from '../legacyMigration';
import {BACKOFF_MS, type EngineDeps} from '../contentEngine';

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

describe('migrateLegacyContent partial failure', () => {
  it('completes on a rerun after an upsert throws midway', async () => {
    const registry = createMemoryContentRegistry();
    const upsert = registry.upsert.bind(registry);
    let calls = 0;
    registry.upsert = async row => {
      calls++;
      if (calls === 2) throw new Error('disk_full');
      await upsert(row);
    };
    await expect(
      migrateLegacyContent(registry, ['169', '16', '7'], 5),
    ).rejects.toThrow('disk_full');
    expect((await registry.getState()).migratedAt).toBeNull();
    expect(await migrateLegacyContent(registry, ['169', '16', '7'], 6)).toBe(2);
    for (const id of ['169', '16', '7']) {
      expect(await registry.get(`qf:tafsirs:${id}`)).toMatchObject({
        version: 0,
        legacy: true,
      });
    }
    expect((await registry.getState()).migratedAt).toBe(6);
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

  it('honors the backoff after a failed attempt, then retries', async () => {
    let now = 1000;
    const d = {...deps(createMemoryContentRegistry(), false), now: () => now};
    expect(await maybeAutoInstall(d)).toBe(false);
    expect((await d.registry.getState()).autoInstallDone).toBe(false);
    expect(d.api.getDownloadTicket).toHaveBeenCalledTimes(1);

    now += BACKOFF_MS[0] - 1;
    expect(await maybeAutoInstall(d)).toBe(false);
    expect(d.api.getDownloadTicket).toHaveBeenCalledTimes(1);

    now += 1;
    expect(await maybeAutoInstall(d)).toBe(false);
    expect(d.api.getDownloadTicket).toHaveBeenCalledTimes(2);
  });

  it('settles for good once a legacy copy was seen, even if the row goes away', async () => {
    const d = deps();
    await d.registry.upsert({
      ...emptyRow(AUTO_INSTALL_KEY, 'tafsir'),
      legacy: true,
    });
    expect(await maybeAutoInstall(d)).toBe(false);
    expect((await d.registry.getState()).autoInstallDone).toBe(true);
    await d.registry.delete(AUTO_INSTALL_KEY);
    expect(await maybeAutoInstall(d)).toBe(false);
    expect(d.api.getDownloadTicket).not.toHaveBeenCalled();
  });

  it('settles for good after the user removed it', async () => {
    const d = deps();
    await d.registry.upsert({
      ...emptyRow(AUTO_INSTALL_KEY, 'tafsir'),
      user_removed: true,
    });
    expect(await maybeAutoInstall(d)).toBe(false);
    expect((await d.registry.getState()).autoInstallDone).toBe(true);
  });
});
